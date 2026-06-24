use napi::bindgen_prelude::{BigInt, Buffer, Error};
use napi::threadsafe_function::{ErrorStrategy, ThreadsafeFunction, ThreadsafeFunctionCallMode};
use napi::JsFunction;
use napi_derive::napi;
use std::ffi::{c_void, CStr, CString};
use std::ptr;
use std::sync::atomic::{AtomicU32, Ordering};
use std::sync::{Arc, Mutex};
use steamworks_sys as sys;
use tokio::sync::oneshot;

mod state;

const CALLBACK_GET_TICKET_FOR_WEB_API_RESPONSE: i32 = 168;
const CALLBACK_MICRO_TXN_AUTHORIZATION_RESPONSE: i32 = 152;
const H_AUTH_TICKET_INVALID: sys::HAuthTicket = 0;

#[derive(Debug)]
#[napi(object)]
pub struct PlayerSteamId {
    pub steam_id64: BigInt,
    pub steam_id32: String,
    pub account_id: u32,
}

#[napi]
pub struct AuthTicket {
    data: Vec<u8>,
    handle: sys::HAuthTicket,
}

#[napi]
impl AuthTicket {
    #[napi]
    pub fn cancel(&mut self) {
        cancel_auth_ticket(self.handle);
        self.handle = H_AUTH_TICKET_INVALID;
    }

    #[napi(js_name = "getBytes")]
    pub fn get_bytes(&self) -> Buffer {
        self.data.clone().into()
    }
}

#[napi]
pub struct CallbackHandle {
    registration: Option<state::CallbackRegistration>,
}

#[napi]
impl CallbackHandle {
    #[napi]
    pub fn disconnect(&mut self) {
        self.registration.take();
    }
}

#[napi(js_name = "init")]
pub fn init(app_id: u32) -> Result<(), Error> {
    if state::is_initialized() {
        shutdown();
    }

    std::env::set_var("SteamAppId", app_id.to_string());
    std::env::set_var("SteamGameId", app_id.to_string());

    let mut err_msg: sys::SteamErrMsg = [0; 1024];
    let result = unsafe { sys::SteamAPI_InitFlat(&mut err_msg) };
    if result != sys::ESteamAPIInitResult::k_ESteamAPIInitResult_OK {
        return Err(Error::from_reason(init_error_message(result, &err_msg)));
    }

    unsafe {
        sys::SteamAPI_ManualDispatch_Init();
    }
    state::mark_initialized(true);

    Ok(())
}

#[napi(js_name = "shutdown")]
pub fn shutdown() {
    if state::is_initialized() {
        state::clear_callbacks();
        unsafe {
            sys::SteamAPI_Shutdown();
        }
        state::mark_initialized(false);
    }
}

#[napi(js_name = "restartAppIfNecessary")]
pub fn restart_app_if_necessary(app_id: u32) -> bool {
    unsafe { sys::SteamAPI_RestartAppIfNecessary(app_id) }
}

#[napi(js_name = "runCallbacks")]
pub fn run_callbacks() {
    if !state::is_initialized() {
        return;
    }

    unsafe {
        let pipe = sys::SteamAPI_GetHSteamPipe();
        if pipe == 0 {
            return;
        }

        sys::SteamAPI_ManualDispatch_RunFrame(pipe);
        let mut callback = std::mem::zeroed::<sys::CallbackMsg_t>();

        while sys::SteamAPI_ManualDispatch_GetNextCallback(pipe, &mut callback) {
            let callback_id = ptr::addr_of!(callback.m_iCallback).read_unaligned();
            let param = ptr::addr_of!(callback.m_pubParam).read_unaligned();

            if callback_id != sys::SteamAPICallCompleted_t_k_iCallback as i32 {
                state::dispatch_callback(callback_id, param.cast::<c_void>());
            }

            sys::SteamAPI_ManualDispatch_FreeLastCallback(pipe);
        }
    }
}

#[napi(js_name = "getSteamId")]
pub fn get_steam_id() -> Result<PlayerSteamId, Error> {
    let user = steam_user()?;
    let steam_id = unsafe { sys::SteamAPI_ISteamUser_GetSteamID(user) };
    let account_id = (steam_id & 0xffff_ffff) as u32;
    let last_bit = account_id & 1;

    Ok(PlayerSteamId {
        steam_id64: steam_id.into(),
        steam_id32: format!("STEAM_0:{}:{}", last_bit, account_id >> 1),
        account_id,
    })
}

#[napi(js_name = "isSteamDeck")]
pub fn is_steam_deck() -> Result<bool, Error> {
    let utils = steam_utils()?;
    Ok(unsafe { sys::SteamAPI_ISteamUtils_IsSteamRunningOnSteamDeck(utils) })
}

#[napi(js_name = "activateOverlayToWebPage")]
pub fn activate_overlay_to_web_page(url: String) -> Result<(), Error> {
    let friends = steam_friends()?;
    let url = cstring(url, "url")?;

    unsafe {
        sys::SteamAPI_ISteamFriends_ActivateGameOverlayToWebPage(
            friends,
            url.as_ptr(),
            sys::EActivateGameOverlayToWebPageMode::k_EActivateGameOverlayToWebPageMode_Default,
        );
    }

    Ok(())
}

#[napi(js_name = "isAchievementActivated")]
pub fn is_achievement_activated(name: String) -> Result<bool, Error> {
    let stats = steam_user_stats()?;
    let name = cstring(name, "achievement name")?;
    let mut achieved = false;
    let ok = unsafe {
        sys::SteamAPI_ISteamUserStats_GetAchievement(stats, name.as_ptr(), &mut achieved)
    };

    Ok(ok && achieved)
}

#[napi(js_name = "getAuthTicketForWebApi")]
pub async fn get_auth_ticket_for_web_api(
    identity: String,
    timeout_seconds: Option<u32>,
) -> Result<AuthTicket, Error> {
    state::ensure_initialized()?;

    let identity = cstring(identity, "identity")?;
    let (tx, rx) = oneshot::channel::<Result<Vec<u8>, String>>();
    let tx = Arc::new(Mutex::new(Some(tx)));
    let expected_ticket = Arc::new(AtomicU32::new(H_AUTH_TICKET_INVALID));

    let tx_for_callback = tx.clone();
    let expected_for_callback = expected_ticket.clone();
    let _registration =
        state::register_callback(CALLBACK_GET_TICKET_FOR_WEB_API_RESPONSE, move |param| {
            let response = unsafe { &*(param as *const sys::GetTicketForWebApiResponse_t) };
            let expected = expected_for_callback.load(Ordering::SeqCst);
            if expected == H_AUTH_TICKET_INVALID || response.m_hAuthTicket != expected {
                return;
            }

            let result = if response.m_eResult == sys::EResult::k_EResultOK {
                let len = response
                    .m_cubTicket
                    .clamp(0, sys::GetTicketForWebApiResponse_t_k_nCubTicketMaxLength)
                    as usize;
                Ok(response.m_rgubTicket[..len].to_vec())
            } else {
                Err(format!(
                    "Steam Web API ticket failed: {:?}",
                    response.m_eResult
                ))
            };

            if let Some(tx) = tx_for_callback
                .lock()
                .expect("Steam ticket callback sender poisoned")
                .take()
            {
                let _ = tx.send(result);
            }
        });

    let user = steam_user()?;
    let ticket_handle =
        unsafe { sys::SteamAPI_ISteamUser_GetAuthTicketForWebApi(user, identity.as_ptr()) };
    if ticket_handle == H_AUTH_TICKET_INVALID {
        return Err(Error::from_reason(
            "Steam returned an invalid Web API auth ticket handle",
        ));
    }
    expected_ticket.store(ticket_handle, Ordering::SeqCst);

    let timeout_seconds = u64::from(timeout_seconds.unwrap_or(10));
    let result = tokio::time::timeout(std::time::Duration::from_secs(timeout_seconds), rx).await;

    match result {
        Ok(Ok(Ok(data))) => Ok(AuthTicket {
            data,
            handle: ticket_handle,
        }),
        Ok(Ok(Err(message))) => {
            cancel_auth_ticket(ticket_handle);
            Err(Error::from_reason(message))
        }
        Ok(Err(err)) => {
            cancel_auth_ticket(ticket_handle);
            Err(Error::from_reason(err.to_string()))
        }
        Err(_) => {
            cancel_auth_ticket(ticket_handle);
            Err(Error::from_reason(
                "Steam did not validate the Web API ticket before the timeout",
            ))
        }
    }
}

#[napi(js_name = "registerMicroTxnAuthorizationResponse")]
pub fn register_micro_txn_authorization_response(
    #[napi(ts_arg_type = "(value: any) => void")] handler: JsFunction,
) -> Result<CallbackHandle, Error> {
    state::ensure_initialized()?;

    let threadsafe_handler: ThreadsafeFunction<serde_json::Value, ErrorStrategy::Fatal> =
        handler.create_threadsafe_function(0, |ctx| Ok(vec![ctx.value]))?;

    let registration =
        state::register_callback(CALLBACK_MICRO_TXN_AUTHORIZATION_RESPONSE, move |param| {
            let value = unsafe { micro_txn_to_json(param) };
            threadsafe_handler.call(value, ThreadsafeFunctionCallMode::NonBlocking);
        });

    Ok(CallbackHandle {
        registration: Some(registration),
    })
}

fn steam_user() -> Result<*mut sys::ISteamUser, Error> {
    state::ensure_initialized()?;
    let user = unsafe { sys::SteamAPI_SteamUser_v023() };
    non_null(user, "ISteamUser")
}

fn steam_friends() -> Result<*mut sys::ISteamFriends, Error> {
    state::ensure_initialized()?;
    let friends = unsafe { sys::SteamAPI_SteamFriends_v018() };
    non_null(friends, "ISteamFriends")
}

fn steam_utils() -> Result<*mut sys::ISteamUtils, Error> {
    state::ensure_initialized()?;
    let utils = unsafe { sys::SteamAPI_SteamUtils_v010() };
    non_null(utils, "ISteamUtils")
}

fn steam_user_stats() -> Result<*mut sys::ISteamUserStats, Error> {
    state::ensure_initialized()?;
    let stats = unsafe { sys::SteamAPI_SteamUserStats_v013() };
    non_null(stats, "ISteamUserStats")
}

fn non_null<T>(ptr: *mut T, interface_name: &str) -> Result<*mut T, Error> {
    if ptr.is_null() {
        Err(Error::from_reason(format!(
            "Steam interface {interface_name} is unavailable"
        )))
    } else {
        Ok(ptr)
    }
}

fn cancel_auth_ticket(ticket_handle: sys::HAuthTicket) {
    if ticket_handle == H_AUTH_TICKET_INVALID || !state::is_initialized() {
        return;
    }

    if let Ok(user) = steam_user() {
        unsafe {
            sys::SteamAPI_ISteamUser_CancelAuthTicket(user, ticket_handle);
        }
    }
}

fn cstring(value: String, label: &str) -> Result<CString, Error> {
    CString::new(value).map_err(|_| Error::from_reason(format!("{label} contains a NUL byte")))
}

fn init_error_message(result: sys::ESteamAPIInitResult, err_msg: &sys::SteamErrMsg) -> String {
    let message = unsafe { CStr::from_ptr(err_msg.as_ptr()) }
        .to_string_lossy()
        .trim()
        .to_owned();

    if message.is_empty() {
        format!("SteamAPI_InitFlat failed: {result:?}")
    } else {
        format!("SteamAPI_InitFlat failed: {result:?}: {message}")
    }
}

unsafe fn micro_txn_to_json(param: *mut c_void) -> serde_json::Value {
    let event = param as *const sys::MicroTxnAuthorizationResponse_t;
    let app_id = ptr::addr_of!((*event).m_unAppID).read_unaligned();
    let order_id = ptr::addr_of!((*event).m_ulOrderID).read_unaligned();
    let authorized = ptr::addr_of!((*event).m_bAuthorized).read_unaligned() == 1;

    serde_json::json!({
        "app_id": app_id,
        "order_id": order_id,
        "authorized": authorized
    })
}
