#![allow(unexpected_cfgs)]

use napi::bindgen_prelude::{BigInt, Buffer, Error, Function, Status};
use napi::threadsafe_function::{ThreadsafeFunction, ThreadsafeFunctionCallMode};
use napi_derive::napi;
use once_cell::sync::Lazy;
use std::ffi::{c_char, c_void, CStr, CString};
use std::ptr;
use std::sync::atomic::{AtomicU32, Ordering};
use std::sync::{Arc, Mutex};
use steamworks_sys as sys;
use tokio::sync::oneshot;

mod compat;
mod native_surface;
mod state;

extern "C" {
    fn SteamAPI_InitAnonymousUser() -> bool;
    fn SteamAPI_InitSafe() -> bool;
    fn SteamAPI_UseBreakpadCrashHandler(
        pchVersion: *const c_char,
        pchDate: *const c_char,
        pchTime: *const c_char,
        bFullMemoryDumps: bool,
        pvContext: *mut c_void,
        m_pfnPreMinidumpCallback: sys::PFNPreMinidumpCallback,
    );
    fn SteamAPI_SetBreakpadAppID(unAppID: u32);
}

const CALLBACK_GET_TICKET_FOR_WEB_API_RESPONSE: i32 = 168;
const CALLBACK_MICRO_TXN_AUTHORIZATION_RESPONSE: i32 = 152;
const CALLBACK_GAME_OVERLAY_ACTIVATED: i32 = 331;
const H_AUTH_TICKET_INVALID: sys::HAuthTicket = 0;

// steamworks-sys 0.13.0 generates Valve's header-local
// k_SteamItemInstanceIDInvalid as an extern static. Export the literal value so
// Linux/macOS loaders never need a non-exported Steamworks SDK symbol.
#[cfg(any(target_os = "linux", target_os = "macos"))]
#[used]
#[no_mangle]
pub static _ZL28k_SteamItemInstanceIDInvalid: sys::SteamItemInstanceID_t = u64::MAX;

#[cfg(target_os = "windows")]
#[used]
#[no_mangle]
pub static k_SteamItemInstanceIDInvalid: sys::SteamItemInstanceID_t = u64::MAX;

static BREAKPAD_CRASH_HANDLER_STRINGS: Lazy<Mutex<Option<BreakpadCrashHandlerStrings>>> =
    Lazy::new(|| Mutex::new(None));

type FatalThreadsafeFunction<T> = ThreadsafeFunction<T, (), Vec<T>, Status, false>;
type JsCallback<'scope, T> = Function<'scope, T, ()>;

struct BreakpadCrashHandlerStrings {
    version: CString,
    date: CString,
    time: CString,
}

#[derive(Debug)]
#[napi(object)]
pub struct PlayerSteamId {
    pub steam_id64: BigInt,
    pub steam_id32: String,
    pub account_id: u32,
}

#[derive(Debug)]
#[napi(object)]
pub struct OverlayDiagnostics {
    pub steam_running: bool,
    pub steam_install_path: Option<String>,
    pub app_id: u32,
    pub overlay_enabled: bool,
    pub overlay_needs_present: bool,
    pub overlay_needs_present_polling_enabled: bool,
    pub steam_deck: bool,
    pub big_picture: bool,
}

#[derive(Debug)]
#[napi(object)]
pub struct MacOverlayEnvironment {
    pub screen_locked: bool,
    pub display_asleep: bool,
}

#[napi]
pub struct AuthTicket {
    pub(crate) data: Vec<u8>,
    pub(crate) handle: sys::HAuthTicket,
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
    warning_message_registration: Option<state::WarningMessageRegistration>,
    networking_debug_output_registration: Option<state::NetworkingDebugOutputRegistration>,
    input_action_event_registration: Option<compat::InputActionEventRegistration>,
    client_process_hook_registration: Option<compat::ClientProcessHookRegistration>,
}

#[napi]
impl CallbackHandle {
    #[napi]
    pub fn disconnect(&mut self) {
        self.registration.take();
        self.warning_message_registration.take();
        self.networking_debug_output_registration.take();
        self.input_action_event_registration.take();
        self.client_process_hook_registration.take();
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
    compat::game_server_shutdown();
    if state::is_initialized() {
        native_surface::close();
        compat::clear_warning_message_hook();
        compat::clear_input_action_event_callback(None);
        compat::clear_client_process_hooks();
        compat::clear_networking_utils_global_callbacks();
        compat::clear_networking_debug_output_hook();
        compat::clear_networking_fake_udp_ports();
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

#[napi(js_name = "isSteamRunning")]
pub fn is_steam_running() -> bool {
    unsafe { sys::SteamAPI_IsSteamRunning() }
}

#[napi(js_name = "getSteamInstallPath")]
pub fn get_steam_install_path() -> Option<String> {
    steam_install_path()
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

            state::dispatch_callback(callback_id, param.cast::<c_void>());
            sys::SteamAPI_ManualDispatch_FreeLastCallback(pipe);
        }
    }
}

#[napi(js_name = "initAnonymousUser")]
pub fn init_anonymous_user() -> bool {
    if state::is_initialized() {
        shutdown();
    }

    let initialized = unsafe { SteamAPI_InitAnonymousUser() };
    if initialized {
        unsafe {
            sys::SteamAPI_ManualDispatch_Init();
        }
        state::mark_initialized(true);
    }
    initialized
}

#[napi(js_name = "initSafe")]
pub fn init_safe() -> bool {
    unsafe { SteamAPI_InitSafe() }
}

#[napi(js_name = "runLegacyCallbacks")]
pub fn run_legacy_callbacks() {
    unsafe { sys::SteamAPI_RunCallbacks() };
}

#[napi(js_name = "releaseCurrentThreadMemory")]
pub fn release_current_thread_memory() {
    unsafe { sys::SteamAPI_ReleaseCurrentThreadMemory() };
}

#[napi(js_name = "setTryCatchCallbacks")]
pub fn set_try_catch_callbacks(enabled: bool) {
    unsafe { sys::SteamAPI_SetTryCatchCallbacks(enabled) };
}

#[napi(js_name = "setMiniDumpComment")]
pub fn set_mini_dump_comment(comment: String) -> Result<(), Error> {
    let comment = cstring(comment, "mini dump comment")?;
    unsafe { sys::SteamAPI_SetMiniDumpComment(comment.as_ptr()) };
    Ok(())
}

#[napi(js_name = "writeMiniDump")]
pub fn write_mini_dump(structured_exception_code: u32, build_id: u32) {
    unsafe { sys::SteamAPI_WriteMiniDump(structured_exception_code, ptr::null_mut(), build_id) };
}

#[napi(js_name = "useBreakpadCrashHandler")]
pub fn use_breakpad_crash_handler(
    version: String,
    date: String,
    time: String,
    full_memory_dumps: bool,
) -> Result<(), Error> {
    let version = cstring(version, "breakpad version")?;
    let date = cstring(date, "breakpad date")?;
    let time = cstring(time, "breakpad time")?;
    let mut strings = BREAKPAD_CRASH_HANDLER_STRINGS.lock().map_err(|_| {
        Error::new(
            Status::GenericFailure,
            "breakpad crash handler string lock poisoned",
        )
    })?;
    *strings = Some(BreakpadCrashHandlerStrings {
        version,
        date,
        time,
    });
    let strings = strings
        .as_ref()
        .expect("breakpad crash handler strings were just set");
    unsafe {
        SteamAPI_UseBreakpadCrashHandler(
            strings.version.as_ptr(),
            strings.date.as_ptr(),
            strings.time.as_ptr(),
            full_memory_dumps,
            ptr::null_mut(),
            None,
        )
    };
    Ok(())
}

#[napi(js_name = "setBreakpadAppId")]
pub fn set_breakpad_app_id(app_id: u32) {
    unsafe { SteamAPI_SetBreakpadAppID(app_id) };
}

#[napi(js_name = "getSteamId")]
pub fn get_steam_id() -> Result<PlayerSteamId, Error> {
    let user = steam_user()?;
    let steam_id = unsafe { sys::SteamAPI_ISteamUser_GetSteamID(user) };
    Ok(steam_id_to_player(steam_id))
}

#[napi(js_name = "isSteamDeck")]
pub fn is_steam_deck() -> Result<bool, Error> {
    let utils = steam_utils()?;
    Ok(unsafe { sys::SteamAPI_ISteamUtils_IsSteamRunningOnSteamDeck(utils) })
}

#[napi(js_name = "getAppId")]
pub fn get_app_id() -> Result<u32, Error> {
    let utils = steam_utils()?;
    Ok(unsafe { sys::SteamAPI_ISteamUtils_GetAppID(utils) })
}

#[napi(js_name = "isSteamInBigPictureMode")]
pub fn is_steam_in_big_picture_mode() -> Result<bool, Error> {
    let utils = steam_utils()?;
    Ok(unsafe { sys::SteamAPI_ISteamUtils_IsSteamInBigPictureMode(utils) })
}

#[napi(js_name = "isOverlayEnabled")]
pub fn is_overlay_enabled() -> Result<bool, Error> {
    let utils = steam_utils()?;
    Ok(unsafe { sys::SteamAPI_ISteamUtils_IsOverlayEnabled(utils) })
}

#[napi(js_name = "overlayNeedsPresent")]
pub fn overlay_needs_present() -> Result<bool, Error> {
    let utils = steam_utils()?;
    Ok(overlay_needs_present_value(utils))
}

#[napi(js_name = "isOverlayNeedsPresentPollingEnabled")]
pub fn is_overlay_needs_present_polling_enabled() -> bool {
    overlay_needs_present_polling_enabled()
}

#[napi(js_name = "getOverlayDiagnostics")]
pub fn get_overlay_diagnostics() -> Result<OverlayDiagnostics, Error> {
    let utils = steam_utils()?;

    Ok(OverlayDiagnostics {
        steam_running: unsafe { sys::SteamAPI_IsSteamRunning() },
        steam_install_path: steam_install_path(),
        app_id: unsafe { sys::SteamAPI_ISteamUtils_GetAppID(utils) },
        overlay_enabled: unsafe { sys::SteamAPI_ISteamUtils_IsOverlayEnabled(utils) },
        overlay_needs_present: overlay_needs_present_value(utils),
        overlay_needs_present_polling_enabled: overlay_needs_present_polling_enabled(),
        steam_deck: unsafe { sys::SteamAPI_ISteamUtils_IsSteamRunningOnSteamDeck(utils) },
        big_picture: unsafe { sys::SteamAPI_ISteamUtils_IsSteamInBigPictureMode(utils) },
    })
}

fn overlay_needs_present_value(utils: *mut sys::ISteamUtils) -> bool {
    if overlay_needs_present_disabled() {
        return false;
    }
    unsafe { sys::SteamAPI_ISteamUtils_BOverlayNeedsPresent(utils) }
}

fn overlay_needs_present_polling_enabled() -> bool {
    !overlay_needs_present_disabled()
}

fn overlay_needs_present_disabled() -> bool {
    if steam_bridge_env_flag("STEAM_BRIDGE_DISABLE_OVERLAY_NEEDS_PRESENT") {
        return true;
    }

    #[cfg(target_os = "macos")]
    {
        true
    }

    #[cfg(not(target_os = "macos"))]
    {
        false
    }
}

fn steam_bridge_env_flag(name: &str) -> bool {
    let Ok(value) = std::env::var(name) else {
        return false;
    };
    matches!(
        value.to_ascii_lowercase().as_str(),
        "1" | "true" | "yes" | "on"
    )
}

#[napi(js_name = "activateOverlay")]
pub fn activate_overlay(dialog: Option<String>) -> Result<(), Error> {
    let friends = steam_friends()?;
    let dialog = cstring(
        dialog.unwrap_or_else(|| "Friends".to_owned()),
        "overlay dialog",
    )?;

    unsafe {
        sys::SteamAPI_ISteamFriends_ActivateGameOverlay(friends, dialog.as_ptr());
    }

    Ok(())
}

#[napi(js_name = "activateOverlayToWebPage")]
pub fn activate_overlay_to_web_page(url: String, modal: Option<bool>) -> Result<(), Error> {
    let friends = steam_friends()?;
    let url = cstring(url, "url")?;
    let mode = if modal.unwrap_or(false) {
        sys::EActivateGameOverlayToWebPageMode::k_EActivateGameOverlayToWebPageMode_Modal
    } else {
        sys::EActivateGameOverlayToWebPageMode::k_EActivateGameOverlayToWebPageMode_Default
    };

    unsafe {
        sys::SteamAPI_ISteamFriends_ActivateGameOverlayToWebPage(friends, url.as_ptr(), mode);
    }

    Ok(())
}

#[napi(js_name = "openNativeOverlayProbeWindow")]
pub fn open_native_overlay_probe_window(title: Option<String>) -> Result<(), Error> {
    state::ensure_initialized()?;
    native_surface::open(title)
}

#[napi(js_name = "attachNativeOverlayHostView")]
pub fn attach_native_overlay_host_view(native_window_handle: Buffer) -> Result<(), Error> {
    state::ensure_initialized()?;
    native_surface::attach_to_parent(native_handle_from_buffer(&native_window_handle)?)
}

#[napi(js_name = "pumpNativeOverlayProbeWindow")]
pub fn pump_native_overlay_probe_window() -> Result<(), Error> {
    native_surface::pump()
}

#[napi(js_name = "pumpNativeOverlayHostView")]
pub fn pump_native_overlay_host_view() -> Result<(), Error> {
    native_surface::pump()
}

#[napi(js_name = "showNativeOverlayHostView")]
pub fn show_native_overlay_host_view() -> Result<(), Error> {
    native_surface::show()
}

#[napi(js_name = "hideNativeOverlayHostView")]
pub fn hide_native_overlay_host_view() -> Result<(), Error> {
    native_surface::hide()
}

#[napi(js_name = "setNativeOverlayHostInputPassthrough")]
pub fn set_native_overlay_host_input_passthrough(pass_through: bool) -> Result<(), Error> {
    native_surface::set_input_passthrough(pass_through)
}

#[napi(js_name = "setNativeOverlayHostOpacity")]
pub fn set_native_overlay_host_opacity(opaque: bool) -> Result<(), Error> {
    native_surface::set_opaque(opaque)
}

#[napi(js_name = "updateNativeOverlayHostFrame")]
pub fn update_native_overlay_host_frame(
    frame: Buffer,
    width: u32,
    height: u32,
) -> Result<(), Error> {
    native_surface::update_frame(frame, width, height)
}

#[napi(js_name = "closeNativeOverlayProbeWindow")]
pub fn close_native_overlay_probe_window() {
    native_surface::close_probe();
}

#[napi(js_name = "detachNativeOverlayHostView")]
pub fn detach_native_overlay_host_view() {
    native_surface::detach_host();
}

#[napi(js_name = "isNativeOverlayProbeWindowOpen")]
pub fn is_native_overlay_probe_window_open() -> bool {
    native_surface::is_probe_open()
}

#[napi(js_name = "isNativeOverlayHostViewOpen")]
pub fn is_native_overlay_host_view_open() -> bool {
    native_surface::is_embedded()
}

#[napi(js_name = "getMacWindowSnapshot")]
pub fn get_mac_window_snapshot(app_id: Option<u32>) -> Option<String> {
    native_surface::mac_window_snapshot_json(app_id.unwrap_or(0))
}

#[napi(js_name = "getMacOverlayEnvironment")]
pub fn get_mac_overlay_environment() -> MacOverlayEnvironment {
    MacOverlayEnvironment {
        screen_locked: native_surface::mac_screen_locked(),
        display_asleep: native_surface::mac_display_asleep(),
    }
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
    #[napi(ts_arg_type = "(value: any) => void")] handler: JsCallback<'_, serde_json::Value>,
) -> Result<CallbackHandle, Error> {
    state::ensure_initialized()?;

    let threadsafe_handler: FatalThreadsafeFunction<serde_json::Value> = handler
        .build_threadsafe_function::<serde_json::Value>()
        .build_callback(|ctx| Ok(vec![ctx.value]))?;

    let registration =
        state::register_callback(CALLBACK_MICRO_TXN_AUTHORIZATION_RESPONSE, move |param| {
            let value = unsafe { micro_txn_to_json(param) };
            threadsafe_handler.call(value, ThreadsafeFunctionCallMode::NonBlocking);
        });

    Ok(CallbackHandle {
        registration: Some(registration),
        warning_message_registration: None,
        networking_debug_output_registration: None,
        input_action_event_registration: None,
        client_process_hook_registration: None,
    })
}

#[napi(js_name = "registerGameOverlayActivated")]
pub fn register_game_overlay_activated(
    #[napi(ts_arg_type = "(value: any) => void")] handler: JsCallback<'_, serde_json::Value>,
) -> Result<CallbackHandle, Error> {
    state::ensure_initialized()?;

    let threadsafe_handler: FatalThreadsafeFunction<serde_json::Value> = handler
        .build_threadsafe_function::<serde_json::Value>()
        .build_callback(|ctx| Ok(vec![ctx.value]))?;

    let registration = state::register_callback(CALLBACK_GAME_OVERLAY_ACTIVATED, move |param| {
        let value = unsafe { game_overlay_activated_to_json(param) };
        threadsafe_handler.call(value, ThreadsafeFunctionCallMode::NonBlocking);
    });

    Ok(CallbackHandle {
        registration: Some(registration),
        warning_message_registration: None,
        networking_debug_output_registration: None,
        input_action_event_registration: None,
        client_process_hook_registration: None,
    })
}

pub(crate) fn steam_user() -> Result<*mut sys::ISteamUser, Error> {
    state::ensure_initialized()?;
    let user = unsafe { sys::SteamAPI_SteamUser_v023() };
    non_null(user, "ISteamUser")
}

pub(crate) fn steam_friends() -> Result<*mut sys::ISteamFriends, Error> {
    state::ensure_initialized()?;
    let friends = unsafe { sys::SteamAPI_SteamFriends_v018() };
    non_null(friends, "ISteamFriends")
}

pub(crate) fn steam_utils() -> Result<*mut sys::ISteamUtils, Error> {
    state::ensure_initialized()?;
    let utils = unsafe { sys::SteamAPI_SteamUtils_v010() };
    non_null(utils, "ISteamUtils")
}

pub(crate) fn steam_user_stats() -> Result<*mut sys::ISteamUserStats, Error> {
    state::ensure_initialized()?;
    let stats = unsafe { sys::SteamAPI_SteamUserStats_v013() };
    non_null(stats, "ISteamUserStats")
}

pub(crate) fn non_null<T>(ptr: *mut T, interface_name: &str) -> Result<*mut T, Error> {
    if ptr.is_null() {
        Err(Error::from_reason(format!(
            "Steam interface {interface_name} is unavailable"
        )))
    } else {
        Ok(ptr)
    }
}

pub(crate) fn cancel_auth_ticket(ticket_handle: sys::HAuthTicket) {
    if ticket_handle == H_AUTH_TICKET_INVALID || !state::is_initialized() {
        return;
    }

    if let Ok(user) = steam_user() {
        unsafe {
            sys::SteamAPI_ISteamUser_CancelAuthTicket(user, ticket_handle);
        }
    }
}

pub(crate) fn cstring(value: String, label: &str) -> Result<CString, Error> {
    CString::new(value).map_err(|_| Error::from_reason(format!("{label} contains a NUL byte")))
}

pub(crate) fn make_auth_ticket(data: Vec<u8>, handle: sys::HAuthTicket) -> AuthTicket {
    AuthTicket { data, handle }
}

pub(crate) fn steam_id_to_player(steam_id: u64) -> PlayerSteamId {
    let account_id = (steam_id & 0xffff_ffff) as u32;
    let last_bit = account_id & 1;

    PlayerSteamId {
        steam_id64: steam_id.into(),
        steam_id32: format!("STEAM_0:{}:{}", last_bit, account_id >> 1),
        account_id,
    }
}

pub(crate) fn string_from_ptr(ptr: *const c_char) -> String {
    if ptr.is_null() {
        String::new()
    } else {
        unsafe { CStr::from_ptr(ptr) }
            .to_string_lossy()
            .into_owned()
    }
}

fn native_handle_from_buffer(handle: &Buffer) -> Result<usize, Error> {
    let bytes: &[u8] = handle.as_ref();
    let pointer_size = std::mem::size_of::<usize>();
    let handle_size = if bytes.len() >= pointer_size {
        pointer_size
    } else if cfg!(target_os = "linux") && bytes.len() >= std::mem::size_of::<u32>() {
        std::mem::size_of::<u32>()
    } else {
        let minimum_size = if cfg!(target_os = "linux") {
            std::mem::size_of::<u32>()
        } else {
            pointer_size
        };
        return Err(Error::from_reason(format!(
            "Electron native window handle buffer is too small: expected at least {minimum_size} bytes, got {}",
            bytes.len()
        )));
    };

    let mut raw = 0usize;
    for (index, byte) in bytes.iter().take(handle_size).enumerate() {
        raw |= (*byte as usize) << (index * 8);
    }

    if raw == 0 {
        return Err(Error::from_reason(
            "Electron native window handle buffer contained a null pointer",
        ));
    }

    Ok(raw)
}

fn steam_install_path() -> Option<String> {
    let path = unsafe { sys::SteamAPI_GetSteamInstallPath() };
    if path.is_null() {
        None
    } else {
        Some(
            unsafe { CStr::from_ptr(path) }
                .to_string_lossy()
                .into_owned(),
        )
    }
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
        "order_id": order_id.to_string(),
        "authorized": authorized
    })
}

unsafe fn game_overlay_activated_to_json(param: *mut c_void) -> serde_json::Value {
    let event = param as *const sys::GameOverlayActivated_t;
    let active = ptr::addr_of!((*event).m_bActive).read_unaligned() != 0;
    let user_initiated = ptr::addr_of!((*event).m_bUserInitiated).read_unaligned();
    let app_id = ptr::addr_of!((*event).m_nAppID).read_unaligned();
    let overlay_pid = ptr::addr_of!((*event).m_dwOverlayPID).read_unaligned();

    serde_json::json!({
        "active": active,
        "user_initiated": user_initiated,
        "app_id": app_id,
        "overlay_pid": overlay_pid
    })
}
