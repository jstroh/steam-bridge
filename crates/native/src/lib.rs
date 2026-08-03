#![allow(unexpected_cfgs)]
// napi-rs removes exported wrappers from the Rust unit-test build, which makes
// the compatibility facade appear unused even though the cdylib exports it.
#![cfg_attr(test, allow(dead_code))]
// The flat Steamworks/N-API compatibility surface intentionally preserves
// upstream positional call shapes instead of wrapping them in breaking structs.
#![allow(clippy::too_many_arguments)]

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
#[cfg(target_os = "linux")]
mod kwin_dbus;
mod native_surface;
mod resource;
mod state;
#[cfg(target_os = "windows")]
mod windows_d3d11;

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
const MAX_MANUAL_API_CALL_RESULT_BYTES: u32 = 1024 * 1024;

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

trait ManualDispatchBackend {
    fn run_frame(&self, pipe: sys::HSteamPipe);
    fn get_next_callback(&self, pipe: sys::HSteamPipe, callback: &mut sys::CallbackMsg_t) -> bool;
    fn get_api_call_result(
        &self,
        pipe: sys::HSteamPipe,
        api_call: sys::SteamAPICall_t,
        data: *mut c_void,
        byte_length: i32,
        expected_callback: i32,
        failed: &mut bool,
    ) -> bool;
    fn get_api_call_failure_reason(
        &self,
        domain: state::CallbackDomain,
        api_call: sys::SteamAPICall_t,
    ) -> Option<i32>;
    fn free_last_callback(&self, pipe: sys::HSteamPipe);
}

struct SteamManualDispatchBackend;

impl ManualDispatchBackend for SteamManualDispatchBackend {
    fn run_frame(&self, pipe: sys::HSteamPipe) {
        unsafe { sys::SteamAPI_ManualDispatch_RunFrame(pipe) };
    }

    fn get_next_callback(&self, pipe: sys::HSteamPipe, callback: &mut sys::CallbackMsg_t) -> bool {
        unsafe { sys::SteamAPI_ManualDispatch_GetNextCallback(pipe, callback) }
    }

    fn get_api_call_result(
        &self,
        pipe: sys::HSteamPipe,
        api_call: sys::SteamAPICall_t,
        data: *mut c_void,
        byte_length: i32,
        expected_callback: i32,
        failed: &mut bool,
    ) -> bool {
        unsafe {
            sys::SteamAPI_ManualDispatch_GetAPICallResult(
                pipe,
                api_call,
                data,
                byte_length,
                expected_callback,
                failed,
            )
        }
    }

    fn get_api_call_failure_reason(
        &self,
        domain: state::CallbackDomain,
        api_call: sys::SteamAPICall_t,
    ) -> Option<i32> {
        let utils = match domain {
            state::CallbackDomain::Client => unsafe { sys::SteamAPI_SteamUtils_v010() },
            state::CallbackDomain::GameServer => unsafe {
                sys::SteamAPI_SteamGameServerUtils_v010()
            },
        };
        (!utils.is_null()).then(|| unsafe {
            sys::SteamAPI_ISteamUtils_GetAPICallFailureReason(utils, api_call) as i32
        })
    }

    fn free_last_callback(&self, pipe: sys::HSteamPipe) {
        unsafe { sys::SteamAPI_ManualDispatch_FreeLastCallback(pipe) };
    }
}

struct ManualCallbackLease<'a, B: ManualDispatchBackend> {
    backend: &'a B,
    pipe: sys::HSteamPipe,
}

impl<B: ManualDispatchBackend> Drop for ManualCallbackLease<'_, B> {
    fn drop(&mut self) {
        self.backend.free_last_callback(self.pipe);
    }
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
    handle: resource::NativeResourceHandle<sys::HAuthTicket, state::LifecycleToken>,
}

#[napi]
impl AuthTicket {
    #[napi]
    pub fn cancel(&mut self) {
        self.handle.release();
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
    let _dispatch = state::lock_manual_dispatch(state::CallbackDomain::Client);
    if state::is_initialized() {
        native_surface::ensure_main_thread()?;
        shutdown_all_locked();
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
pub fn shutdown() -> Result<(), Error> {
    // macOS AppKit/MTKView ownership is main-thread-only. Reject worker
    // teardown before touching Steam callbacks or the attached child.
    native_surface::ensure_main_thread()?;
    let _dispatch = state::lock_manual_dispatch(state::CallbackDomain::Client);
    shutdown_all_locked();
    Ok(())
}

fn shutdown_all_locked() {
    compat::game_server_shutdown_locked();
    if state::is_initialized() {
        state::invalidate_lifecycle_generation(state::CallbackDomain::Client);
        native_surface::close();
        compat::clear_warning_message_hook();
        compat::clear_input_action_event_callback(None);
        compat::clear_client_process_hooks();
        compat::clear_networking_utils_global_callbacks();
        compat::clear_networking_debug_output_hook();
        compat::clear_matchmaking_server_list_requests();
        compat::clear_networking_fake_udp_ports(state::CallbackDomain::Client);
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
    run_manual_callbacks(state::CallbackDomain::Client);
}

pub(crate) fn run_manual_callbacks(domain: state::CallbackDomain) {
    let _dispatch = state::lock_manual_dispatch(domain);
    let initialized = match domain {
        state::CallbackDomain::Client => state::is_initialized(),
        state::CallbackDomain::GameServer => state::is_game_server_initialized(),
    };
    if !initialized {
        return;
    }

    let pipe = match domain {
        state::CallbackDomain::Client => unsafe { sys::SteamAPI_GetHSteamPipe() },
        state::CallbackDomain::GameServer => unsafe { sys::SteamGameServer_GetHSteamPipe() },
    };
    if pipe == 0 {
        return;
    }

    drain_manual_callbacks(
        domain,
        pipe,
        &SteamManualDispatchBackend,
        |callback_id, param| match domain {
            state::CallbackDomain::Client => {
                state::dispatch_callback(callback_id, param.cast::<c_void>());
            }
            state::CallbackDomain::GameServer => {
                state::dispatch_game_server_callback(callback_id, param.cast::<c_void>());
            }
        },
    );
}

fn drain_manual_callbacks<B, F>(
    domain: state::CallbackDomain,
    pipe: sys::HSteamPipe,
    backend: &B,
    mut route: F,
) where
    B: ManualDispatchBackend,
    F: FnMut(i32, *mut u8),
{
    backend.run_frame(pipe);
    let mut callback = unsafe { std::mem::zeroed::<sys::CallbackMsg_t>() };

    while backend.get_next_callback(pipe, &mut callback) {
        let _lease = ManualCallbackLease { backend, pipe };
        let callback_id = unsafe { ptr::addr_of!(callback.m_iCallback).read_unaligned() };
        let param = unsafe { ptr::addr_of!(callback.m_pubParam).read_unaligned() };

        if callback_id == sys::SteamAPICallCompleted_t_k_iCallback as i32 {
            capture_completed_api_call(domain, pipe, &callback, backend);
        }

        route(callback_id, param);
    }
}

fn capture_completed_api_call<B: ManualDispatchBackend>(
    domain: state::CallbackDomain,
    pipe: sys::HSteamPipe,
    callback: &sys::CallbackMsg_t,
    backend: &B,
) {
    let param = unsafe { ptr::addr_of!(callback.m_pubParam).read_unaligned() };
    let callback_size = unsafe { ptr::addr_of!(callback.m_cubParam).read_unaligned() };
    if param.is_null() || callback_size < std::mem::size_of::<sys::SteamAPICallCompleted_t>() as i32
    {
        return;
    }

    let completed = unsafe {
        param
            .cast::<sys::SteamAPICallCompleted_t>()
            .read_unaligned()
    };
    let byte_length = unsafe { ptr::addr_of!(completed.m_cubParam).read_unaligned() };
    let expected_callback = unsafe { ptr::addr_of!(completed.m_iCallback).read_unaligned() };
    let api_call = unsafe { ptr::addr_of!(completed.m_hAsyncCall).read_unaligned() };

    let Some(byte_length_i32) = i32::try_from(byte_length).ok() else {
        state::store_completed_api_call(
            domain,
            api_call,
            state::CompletedApiCall {
                callback_id: expected_callback,
                byte_length: byte_length as usize,
                data: Vec::new(),
                ok: false,
                failed: true,
                failure_reason: None,
            },
        );
        return;
    };

    if byte_length > MAX_MANUAL_API_CALL_RESULT_BYTES {
        state::store_completed_api_call(
            domain,
            api_call,
            state::CompletedApiCall {
                callback_id: expected_callback,
                byte_length: byte_length as usize,
                data: Vec::new(),
                ok: false,
                failed: true,
                failure_reason: None,
            },
        );
        return;
    }

    let byte_length_usize = byte_length as usize;
    let aligned_slots = byte_length_usize
        .div_ceil(std::mem::size_of::<u128>())
        .max(1);
    let mut aligned_data = vec![0u128; aligned_slots];
    let mut failed = false;
    let ok = backend.get_api_call_result(
        pipe,
        api_call,
        aligned_data.as_mut_ptr().cast::<c_void>(),
        byte_length_i32,
        expected_callback,
        &mut failed,
    );
    let data = if ok {
        unsafe {
            std::slice::from_raw_parts(aligned_data.as_ptr().cast::<u8>(), byte_length_usize)
                .to_vec()
        }
    } else {
        Vec::new()
    };
    let failure_reason = if failed || !ok {
        backend.get_api_call_failure_reason(domain, api_call)
    } else {
        None
    };

    state::store_completed_api_call(
        domain,
        api_call,
        state::CompletedApiCall {
            callback_id: expected_callback,
            byte_length: byte_length_usize,
            data,
            ok,
            failed,
            failure_reason,
        },
    );
}

#[cfg(test)]
mod manual_dispatch_tests {
    use super::*;
    use std::collections::VecDeque;

    enum FakePayload {
        Empty,
        ApiCall {
            completion: Box<sys::SteamAPICallCompleted_t>,
            result: Vec<u8>,
            ok: bool,
            failed: bool,
            failure_reason: Option<i32>,
        },
    }

    struct FakeCallback {
        callback_id: i32,
        payload: FakePayload,
    }

    struct FakeState {
        queued: VecDeque<FakeCallback>,
        current: Option<FakeCallback>,
        trace: Vec<String>,
    }

    struct FakeManualDispatchBackend {
        state: Mutex<FakeState>,
    }

    impl FakeManualDispatchBackend {
        fn new(callbacks: impl IntoIterator<Item = FakeCallback>) -> Self {
            Self {
                state: Mutex::new(FakeState {
                    queued: callbacks.into_iter().collect(),
                    current: None,
                    trace: Vec::new(),
                }),
            }
        }

        fn trace(&self) -> Vec<String> {
            self.state
                .lock()
                .expect("fake dispatcher poisoned")
                .trace
                .clone()
        }
    }

    impl ManualDispatchBackend for FakeManualDispatchBackend {
        fn run_frame(&self, _pipe: sys::HSteamPipe) {
            self.state
                .lock()
                .expect("fake dispatcher poisoned")
                .trace
                .push("run_frame".to_owned());
        }

        fn get_next_callback(
            &self,
            _pipe: sys::HSteamPipe,
            callback: &mut sys::CallbackMsg_t,
        ) -> bool {
            let mut state = self.state.lock().expect("fake dispatcher poisoned");
            assert!(state.current.is_none(), "callback was not freed");
            state.trace.push("get_next".to_owned());
            let Some(next) = state.queued.pop_front() else {
                return false;
            };
            state.current = Some(next);
            let current = state.current.as_mut().expect("current callback missing");
            callback.m_hSteamUser = 0;
            callback.m_iCallback = current.callback_id;
            match &mut current.payload {
                FakePayload::Empty => {
                    callback.m_pubParam = ptr::null_mut();
                    callback.m_cubParam = 0;
                }
                FakePayload::ApiCall { completion, .. } => {
                    callback.m_pubParam = completion.as_mut() as *mut _ as *mut u8;
                    callback.m_cubParam =
                        std::mem::size_of::<sys::SteamAPICallCompleted_t>() as i32;
                }
            }
            true
        }

        fn get_api_call_result(
            &self,
            _pipe: sys::HSteamPipe,
            api_call: sys::SteamAPICall_t,
            data: *mut c_void,
            byte_length: i32,
            expected_callback: i32,
            failed: &mut bool,
        ) -> bool {
            let mut state = self.state.lock().expect("fake dispatcher poisoned");
            state.trace.push("get_api_call_result".to_owned());
            let current = state.current.as_ref().expect("current callback missing");
            let FakePayload::ApiCall {
                completion,
                result,
                ok,
                failed: result_failed,
                ..
            } = &current.payload
            else {
                panic!("API result requested for a non-completion callback");
            };
            let completion_api_call =
                unsafe { ptr::addr_of!(completion.m_hAsyncCall).read_unaligned() };
            assert_eq!(completion_api_call, api_call);
            assert_eq!(completion.m_iCallback, expected_callback);
            assert_eq!(result.len(), byte_length as usize);
            *failed = *result_failed;
            if *ok {
                unsafe {
                    ptr::copy_nonoverlapping(result.as_ptr(), data.cast::<u8>(), result.len())
                };
            }
            *ok
        }

        fn get_api_call_failure_reason(
            &self,
            _domain: state::CallbackDomain,
            _api_call: sys::SteamAPICall_t,
        ) -> Option<i32> {
            let state = self.state.lock().expect("fake dispatcher poisoned");
            let current = state.current.as_ref()?;
            let FakePayload::ApiCall { failure_reason, .. } = &current.payload else {
                return None;
            };
            *failure_reason
        }

        fn free_last_callback(&self, _pipe: sys::HSteamPipe) {
            let mut state = self.state.lock().expect("fake dispatcher poisoned");
            state.trace.push("free_last".to_owned());
            assert!(state.current.take().is_some(), "no callback to free");
        }
    }

    #[test]
    fn dispatcher_retrieves_api_results_and_frees_every_callback_in_order() {
        let _test = state::lock_test_state();
        state::clear_callbacks();
        let backend = FakeManualDispatchBackend::new([
            FakeCallback {
                callback_id: sys::SteamAPICallCompleted_t_k_iCallback as i32,
                payload: FakePayload::ApiCall {
                    completion: Box::new(sys::SteamAPICallCompleted_t {
                        m_hAsyncCall: 42,
                        m_iCallback: 9001,
                        m_cubParam: 4,
                    }),
                    result: vec![1, 2, 3, 4],
                    ok: true,
                    failed: false,
                    failure_reason: None,
                },
            },
            FakeCallback {
                callback_id: 999,
                payload: FakePayload::Empty,
            },
        ]);
        let mut routed = Vec::new();

        drain_manual_callbacks(
            state::CallbackDomain::Client,
            1,
            &backend,
            |callback_id, _| {
                backend
                    .state
                    .lock()
                    .expect("fake dispatcher poisoned")
                    .trace
                    .push(format!("route:{callback_id}"));
                routed.push(callback_id);
            },
        );

        assert_eq!(
            backend.trace(),
            [
                "run_frame",
                "get_next",
                "get_api_call_result",
                "route:703",
                "free_last",
                "get_next",
                "route:999",
                "free_last",
                "get_next",
            ]
        );
        assert_eq!(routed, [703, 999]);
        assert!(matches!(
            state::take_completed_api_call(state::CallbackDomain::Client, 42, 9001, 4),
            state::CompletedApiCallLookup::Ready(state::CompletedApiCall { data, .. })
                if data == vec![1, 2, 3, 4]
        ));
    }

    #[test]
    fn dispatcher_frees_the_current_callback_when_routing_unwinds() {
        let _test = state::lock_test_state();
        let backend = FakeManualDispatchBackend::new([FakeCallback {
            callback_id: 999,
            payload: FakePayload::Empty,
        }]);

        let unwind = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
            drain_manual_callbacks(state::CallbackDomain::Client, 1, &backend, |_, _| {
                panic!("route failed")
            });
        }));

        assert!(unwind.is_err());
        assert_eq!(backend.trace(), ["run_frame", "get_next", "free_last"]);
    }
}

#[napi(js_name = "initAnonymousUser")]
pub fn init_anonymous_user() -> bool {
    let _dispatch = state::lock_manual_dispatch(state::CallbackDomain::Client);
    if state::is_initialized() {
        if native_surface::ensure_main_thread().is_err() {
            return false;
        }
        shutdown_all_locked();
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
    let _dispatch = state::lock_manual_dispatch(state::CallbackDomain::Client);
    if state::is_initialized() {
        return true;
    }

    let initialized = unsafe { SteamAPI_InitSafe() };
    if initialized {
        unsafe {
            sys::SteamAPI_ManualDispatch_Init();
        }
        state::mark_initialized(true);
    }
    initialized
}

#[napi(js_name = "runLegacyCallbacks")]
pub fn run_legacy_callbacks() {
    run_callbacks();
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

#[napi(js_name = "getNativeOverlayHostDiagnosticsJson")]
pub fn get_native_overlay_host_diagnostics_json() -> Option<String> {
    native_surface::host_diagnostics_json()
}

#[napi(js_name = "getKWinWaylandOverlayPresentationProtocolVersion")]
pub fn get_kwin_wayland_overlay_presentation_protocol_version() -> u32 {
    1
}

#[napi(js_name = "startKWinWaylandOverlayHostSyncEvents")]
pub fn start_kwin_wayland_overlay_host_sync_events(
    token: String,
    #[napi(ts_arg_type = "(value: any) => void")] handler: JsCallback<'_, serde_json::Value>,
) -> Result<Option<String>, Error> {
    #[cfg(target_os = "linux")]
    {
        return kwin_dbus::start(token, handler).map(Some);
    }

    #[cfg(not(target_os = "linux"))]
    {
        let _ = (token, handler);
        Ok(None)
    }
}

#[napi(js_name = "stopKWinWaylandOverlayHostSyncEvents")]
pub fn stop_kwin_wayland_overlay_host_sync_events() {
    #[cfg(target_os = "linux")]
    kwin_dbus::stop();
}

#[napi(js_name = "isKWinWaylandOverlayHostSyncEventsRunning")]
pub fn is_kwin_wayland_overlay_host_sync_events_running() -> bool {
    #[cfg(target_os = "linux")]
    {
        return kwin_dbus::is_running();
    }

    #[cfg(not(target_os = "linux"))]
    {
        false
    }
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
pub fn open_native_overlay_probe_window(
    title: Option<String>,
    client_width: Option<u32>,
    client_height: Option<u32>,
    min_client_width: Option<u32>,
    min_client_height: Option<u32>,
) -> Result<(), Error> {
    state::ensure_initialized()?;
    native_surface::open(
        title,
        client_width,
        client_height,
        min_client_width,
        min_client_height,
    )
}

#[napi(js_name = "openNativeApplicationHostWindow")]
pub fn open_native_application_host_window(
    title: Option<String>,
    client_width: Option<u32>,
    client_height: Option<u32>,
    min_client_width: Option<u32>,
    min_client_height: Option<u32>,
) -> Result<(), Error> {
    state::ensure_initialized()?;

    #[cfg(target_os = "linux")]
    {
        native_surface::open_application_host(
            title,
            client_width,
            client_height,
            min_client_width,
            min_client_height,
        )
    }

    #[cfg(not(target_os = "linux"))]
    {
        let _ = (
            title,
            client_width,
            client_height,
            min_client_width,
            min_client_height,
        );
        Err(Error::from_reason(
            "A native application host window is currently supported only on Linux",
        ))
    }
}

#[napi(js_name = "attachNativeOverlayHostView")]
pub fn attach_native_overlay_host_view(
    native_window_handle: Buffer,
    initial_x: Option<i32>,
    initial_y: Option<i32>,
    initial_width: Option<u32>,
    initial_height: Option<u32>,
) -> Result<(), Error> {
    state::ensure_initialized()?;
    let initial_bounds = match (initial_x, initial_y, initial_width, initial_height) {
        (None, None, None, None) => None,
        (Some(x), Some(y), Some(width), Some(height)) if width > 0 && height > 0 => {
            Some((x, y, width, height))
        }
        _ => {
            return Err(Error::from_reason(
                "Initial attached overlay bounds require x, y, positive width, and positive height",
            ));
        }
    };
    native_surface::attach_to_parent(
        native_handle_from_buffer(&native_window_handle)?,
        initial_bounds,
    )
}

#[napi(js_name = "attachNativeOverlayHostViewForOverlay")]
pub fn attach_native_overlay_host_view_for_overlay(
    native_window_handle: Buffer,
) -> Result<(), Error> {
    state::ensure_initialized()?;
    native_surface::attach_to_parent_for_overlay(native_handle_from_buffer(&native_window_handle)?)
}

#[napi(js_name = "attachNativeOverlayHostWindow")]
pub fn attach_native_overlay_host_window(
    x: i32,
    y: i32,
    width: u32,
    height: u32,
    full_screen: Option<bool>,
) -> Result<(), Error> {
    state::ensure_initialized()?;

    #[cfg(target_os = "linux")]
    {
        native_surface::attach_to_root(x, y, width, height, full_screen.unwrap_or(false))
    }

    #[cfg(not(target_os = "linux"))]
    {
        let _ = (x, y, width, height, full_screen);
        Err(Error::from_reason(
            "A standalone managed overlay host window is currently supported only on Linux",
        ))
    }
}

#[napi(js_name = "pumpNativeOverlayProbeWindow")]
pub fn pump_native_overlay_probe_window() -> Result<(), Error> {
    native_surface::pump()
}

#[napi(js_name = "pumpNativeOverlayHostView")]
pub fn pump_native_overlay_host_view() -> Result<(), Error> {
    native_surface::pump()
}

#[napi(js_name = "isNativeOverlayHostFramePending")]
pub fn is_native_overlay_host_frame_pending() -> bool {
    #[cfg(target_os = "windows")]
    {
        native_surface::frame_pending()
    }

    #[cfg(not(target_os = "windows"))]
    {
        false
    }
}

#[napi(js_name = "waitForNativeOverlayHostFrameReady")]
pub async fn wait_for_native_overlay_host_frame_ready(
    timeout_ms: Option<u32>,
) -> Result<bool, Error> {
    #[cfg(target_os = "windows")]
    {
        let Some(request) = native_surface::begin_frame_latency_wait()? else {
            return Ok(false);
        };
        let timeout_ms = timeout_ms.unwrap_or(100).clamp(1, 1_000);
        let ready_token = tokio::task::spawn_blocking(move || request.wait(timeout_ms))
            .await
            .map_err(|error| {
                Error::from_reason(format!("DXGI frame latency worker failed: {error}"))
            })?
            .map_err(Error::from_reason)?;
        Ok(ready_token
            .map(native_surface::grant_frame_latency_ready)
            .unwrap_or(false))
    }

    #[cfg(not(target_os = "windows"))]
    {
        let _ = timeout_ms;
        Ok(false)
    }
}

#[napi(js_name = "showNativeOverlayHostView")]
pub fn show_native_overlay_host_view() -> Result<(), Error> {
    native_surface::show()
}

#[napi(js_name = "hideNativeOverlayHostView")]
pub fn hide_native_overlay_host_view() -> Result<(), Error> {
    native_surface::hide()
}

#[napi(js_name = "prepareNativeOverlayHostActivation")]
pub fn prepare_native_overlay_host_activation() -> Result<(), Error> {
    #[cfg(target_os = "linux")]
    {
        native_surface::prepare_activation()
    }

    #[cfg(not(target_os = "linux"))]
    {
        Err(Error::from_reason(
            "Deferred standalone overlay activation is supported only on Linux",
        ))
    }
}

#[napi(js_name = "commitNativeOverlayHostActivation")]
pub fn commit_native_overlay_host_activation(
    request_window_manager_activation: bool,
) -> Result<(), Error> {
    #[cfg(target_os = "linux")]
    {
        native_surface::commit_activation(request_window_manager_activation)
    }

    #[cfg(not(target_os = "linux"))]
    {
        let _ = request_window_manager_activation;
        Err(Error::from_reason(
            "Deferred standalone overlay activation is supported only on Linux",
        ))
    }
}

#[napi(js_name = "setNativeOverlayHostInputPassthrough")]
pub fn set_native_overlay_host_input_passthrough(pass_through: bool) -> Result<(), Error> {
    native_surface::set_input_passthrough(pass_through)
}

#[napi(js_name = "setNativeOverlayHostOpacity")]
pub fn set_native_overlay_host_opacity(opaque: bool) -> Result<(), Error> {
    native_surface::set_opaque(opaque)
}

#[napi(js_name = "setNativeOverlayHostOverlayActive")]
pub fn set_native_overlay_host_overlay_active(active: bool) -> Result<(), Error> {
    #[cfg(any(target_os = "windows", target_os = "linux"))]
    {
        native_surface::set_overlay_active(active)
    }

    #[cfg(not(any(target_os = "windows", target_os = "linux")))]
    {
        let _ = active;
        Ok(())
    }
}

#[napi(js_name = "setNativeOverlayHostCursorHidden")]
pub fn set_native_overlay_host_cursor_hidden(hidden: bool) -> Result<(), Error> {
    native_surface::set_cursor_hidden(hidden)
}

#[napi(js_name = "setNativeOverlayHostContinuousPresent")]
pub fn set_native_overlay_host_continuous_present(
    continuous: bool,
    frame_rate: Option<f64>,
) -> Result<(), Error> {
    native_surface::set_continuous_present(continuous, frame_rate)
}

#[napi(js_name = "setNativeOverlayHostFullScreen")]
pub fn set_native_overlay_host_full_screen(full_screen: bool) -> Result<(), Error> {
    native_surface::set_full_screen(full_screen)
}

fn validate_overlay_presentation_instance_id(instance_id: &str) -> Result<(), Error> {
    if instance_id.len() == 16
        && instance_id
            .bytes()
            .all(|byte| byte.is_ascii_digit() || (b'a'..=b'f').contains(&byte))
    {
        return Ok(());
    }
    Err(Error::from_reason(
        "Native overlay presentation instance id must be 16 lowercase hexadecimal characters",
    ))
}

fn overlay_content_seed_geometry_is_valid(
    source_x: f64,
    source_y: f64,
    source_width: f64,
    source_height: f64,
    width: u32,
    height: u32,
) -> bool {
    source_x.is_finite()
        && source_y.is_finite()
        && source_width.is_finite()
        && source_height.is_finite()
        && source_x >= i32::MIN as f64
        && source_x <= i32::MAX as f64
        && source_y >= i32::MIN as f64
        && source_y <= i32::MAX as f64
        && source_width > 0.0
        && source_width <= i32::MAX as f64
        && source_height > 0.0
        && source_height <= i32::MAX as f64
        && width > 0
        && width <= i32::MAX as u32
        && height > 0
        && height <= i32::MAX as u32
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
#[cfg_attr(not(target_os = "linux"), allow(dead_code))]
enum OverlayPresentationMarkerMode {
    Strict,
    Degraded,
}

#[cfg(any(target_os = "linux", test))]
fn overlay_presentation_marker_mode(receiver_running: bool) -> OverlayPresentationMarkerMode {
    if receiver_running {
        OverlayPresentationMarkerMode::Strict
    } else {
        OverlayPresentationMarkerMode::Degraded
    }
}

fn current_overlay_presentation_marker_mode() -> OverlayPresentationMarkerMode {
    #[cfg(target_os = "linux")]
    {
        return overlay_presentation_marker_mode(kwin_dbus::is_running());
    }

    #[cfg(not(target_os = "linux"))]
    {
        OverlayPresentationMarkerMode::Strict
    }
}

fn apply_overlay_presentation_marker(
    mode: OverlayPresentationMarkerMode,
    marker: String,
) -> Result<(), Error> {
    #[cfg(target_os = "linux")]
    if mode == OverlayPresentationMarkerMode::Degraded {
        return native_surface::set_presentation_transport_closed(marker);
    }

    #[cfg(not(target_os = "linux"))]
    let _ = mode;

    native_surface::set_presentation_marker(marker)
}

#[napi(js_name = "setNativeOverlayHostPresentationEpoch")]
pub fn set_native_overlay_host_presentation_epoch(
    instance_id: String,
    epoch: u32,
) -> Result<bool, Error> {
    validate_overlay_presentation_instance_id(&instance_id)?;
    let mode = current_overlay_presentation_marker_mode();
    let marker = match mode {
        OverlayPresentationMarkerMode::Strict => {
            format!("steam-bridge:{instance_id}:state:{epoch}")
        }
        OverlayPresentationMarkerMode::Degraded => {
            format!("steam-bridge:{instance_id}:degraded")
        }
    };
    apply_overlay_presentation_marker(mode, marker)?;
    Ok(mode == OverlayPresentationMarkerMode::Strict)
}

#[napi(js_name = "setNativeOverlayHostPresentationTransportClosed")]
pub fn set_native_overlay_host_presentation_transport_closed(
    instance_id: String,
) -> Result<(), Error> {
    validate_overlay_presentation_instance_id(&instance_id)?;
    let marker = format!("steam-bridge:{instance_id}:degraded");
    #[cfg(target_os = "linux")]
    {
        return native_surface::set_presentation_transport_closed(marker);
    }

    #[cfg(not(target_os = "linux"))]
    {
        native_surface::set_presentation_marker(marker)
    }
}

#[napi(js_name = "setNativeOverlayHostContentSeed")]
pub fn set_native_overlay_host_content_seed(
    instance_id: String,
    epoch: u32,
    pair_generation: u32,
    receipt_sequence: u32,
    source_x: f64,
    source_y: f64,
    source_width: f64,
    source_height: f64,
    x: i32,
    y: i32,
    width: u32,
    height: u32,
) -> Result<bool, Error> {
    validate_overlay_presentation_instance_id(&instance_id)?;
    if pair_generation == 0
        || receipt_sequence == 0
        || !overlay_content_seed_geometry_is_valid(
            source_x,
            source_y,
            source_width,
            source_height,
            width,
            height,
        )
    {
        return Err(Error::from_reason(
            "Native overlay content seed receipt and geometry must be valid",
        ));
    }
    let mode = current_overlay_presentation_marker_mode();
    let marker = match mode {
        OverlayPresentationMarkerMode::Strict => format!(
            "steam-bridge:{instance_id}:seed:{epoch}:{pair_generation}:{receipt_sequence}:\
             {source_x}:{source_y}:{source_width}:{source_height}:{x}:{y}:{width}:{height}"
        ),
        OverlayPresentationMarkerMode::Degraded => {
            format!("steam-bridge:{instance_id}:degraded")
        }
    };
    apply_overlay_presentation_marker(mode, marker)?;
    Ok(mode == OverlayPresentationMarkerMode::Strict)
}

#[cfg(test)]
mod overlay_presentation_tests {
    use super::{
        overlay_content_seed_geometry_is_valid, overlay_presentation_marker_mode,
        validate_overlay_presentation_instance_id, OverlayPresentationMarkerMode,
    };

    #[test]
    fn marker_mode_routes_closed_receivers_to_the_one_way_degraded_role() {
        assert_eq!(
            overlay_presentation_marker_mode(true),
            OverlayPresentationMarkerMode::Strict
        );
        assert_eq!(
            overlay_presentation_marker_mode(false),
            OverlayPresentationMarkerMode::Degraded
        );
    }

    #[test]
    fn presentation_instance_ids_are_exact_lowercase_hex() {
        assert!(validate_overlay_presentation_instance_id("0123456789abcdef").is_ok());
        for invalid in [
            "0123456789abcde",
            "0123456789abcdef0",
            "0123456789abcdeF",
            "0123456789abc:ef",
        ] {
            assert!(validate_overlay_presentation_instance_id(invalid).is_err());
        }
    }

    #[test]
    fn content_seed_geometry_matches_the_kwin_signed_32_bit_domain() {
        assert!(overlay_content_seed_geometry_is_valid(
            i32::MIN as f64,
            i32::MAX as f64,
            i32::MAX as f64,
            1.0,
            i32::MAX as u32,
            1,
        ));
        assert!(!overlay_content_seed_geometry_is_valid(
            i32::MIN as f64 - 1.0,
            0.0,
            1.0,
            1.0,
            1,
            1,
        ));
        assert!(!overlay_content_seed_geometry_is_valid(
            0.0,
            i32::MAX as f64 + 1.0,
            1.0,
            1.0,
            1,
            1,
        ));
        assert!(!overlay_content_seed_geometry_is_valid(
            0.0,
            0.0,
            i32::MAX as f64 + 1.0,
            1.0,
            1,
            1,
        ));
        assert!(!overlay_content_seed_geometry_is_valid(
            0.0,
            0.0,
            1.0,
            1.0,
            i32::MAX as u32 + 1,
            1,
        ));
    }
}

#[napi(js_name = "setNativeOverlayHostMenuJson")]
pub fn set_native_overlay_host_menu_json(menu_json: String) -> Result<(), Error> {
    native_surface::set_menu_json(menu_json)
}

#[napi(js_name = "setNativeOverlayHostBounds")]
pub fn set_native_overlay_host_bounds(
    x: i32,
    y: i32,
    width: u32,
    height: u32,
) -> Result<(), Error> {
    native_surface::set_bounds(x, y, width, height)
}

#[napi(js_name = "updateNativeOverlayHostFrame")]
pub fn update_native_overlay_host_frame(
    frame: Buffer,
    width: u32,
    height: u32,
) -> Result<(), Error> {
    native_surface::update_frame(frame, width, height)
}

#[napi(js_name = "updateNativeOverlayHostSharedTexture")]
pub fn update_native_overlay_host_shared_texture(
    handle: Buffer,
    width: u32,
    height: u32,
    content_x: Option<u32>,
    content_y: Option<u32>,
    content_width: Option<u32>,
    content_height: Option<u32>,
    presentation_x: Option<u32>,
    presentation_y: Option<u32>,
    presentation_width: Option<u32>,
    presentation_height: Option<u32>,
) -> Result<(), Error> {
    native_surface::update_shared_texture(
        handle,
        width,
        height,
        content_x,
        content_y,
        content_width,
        content_height,
        presentation_x,
        presentation_y,
        presentation_width,
        presentation_height,
    )
}

#[napi(js_name = "updateNativeOverlayHostLinuxDmaBufSharedTexture")]
#[allow(clippy::too_many_arguments)]
pub fn update_native_overlay_host_linux_dma_buf_shared_texture(
    fd: i32,
    stride: u32,
    offset: String,
    size: String,
    modifier: String,
    pixel_format: String,
    width: u32,
    height: u32,
    presentation_x: Option<u32>,
    presentation_y: Option<u32>,
    presentation_width: Option<u32>,
    presentation_height: Option<u32>,
) -> Result<(), Error> {
    state::ensure_initialized()?;

    #[cfg(target_os = "linux")]
    {
        native_surface::update_linux_dma_buf_shared_texture(
            fd,
            stride,
            offset,
            size,
            modifier,
            pixel_format,
            width,
            height,
            presentation_x,
            presentation_y,
            presentation_width,
            presentation_height,
        )
    }

    #[cfg(not(target_os = "linux"))]
    {
        let _ = (
            fd,
            stride,
            offset,
            size,
            modifier,
            pixel_format,
            width,
            height,
            presentation_x,
            presentation_y,
            presentation_width,
            presentation_height,
        );
        Err(Error::from_reason(
            "Electron dma-buf shared textures are supported only by the Linux native host",
        ))
    }
}

#[napi(js_name = "drainNativeOverlayHostInputEventsJson")]
pub fn drain_native_overlay_host_input_events_json() -> Result<String, Error> {
    state::ensure_initialized()?;
    Ok(native_surface::drain_input_events_json())
}

#[napi(js_name = "closeNativeOverlayProbeWindow")]
pub fn close_native_overlay_probe_window() -> Result<(), Error> {
    native_surface::ensure_main_thread()?;
    native_surface::close_probe();
    Ok(())
}

#[napi(js_name = "detachNativeOverlayHostView")]
pub fn detach_native_overlay_host_view() -> Result<(), Error> {
    native_surface::ensure_main_thread()?;
    native_surface::detach_host();
    Ok(())
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
    let identity = cstring(identity, "identity")?;
    let (tx, rx) = oneshot::channel::<Result<Vec<u8>, String>>();
    let tx_for_callback = Arc::new(Mutex::new(Some(tx)));
    let expected_ticket = Arc::new(AtomicU32::new(H_AUTH_TICKET_INVALID));

    let expected_for_callback = expected_ticket.clone();
    let (_registration, ticket_handle, lifecycle) = {
        let _dispatch = state::lock_manual_dispatch(state::CallbackDomain::Client);
        state::ensure_initialized()?;
        let lifecycle = state::current_lifecycle_token(state::CallbackDomain::Client)?;

        let registration =
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
        (registration, ticket_handle, lifecycle)
    };

    let timeout_seconds = u64::from(timeout_seconds.unwrap_or(10));
    let result = tokio::time::timeout(std::time::Duration::from_secs(timeout_seconds), rx).await;

    match result {
        Ok(Ok(Ok(data))) => {
            state::ensure_current_lifecycle_token(lifecycle)?;
            Ok(make_auth_ticket(data, ticket_handle, lifecycle))
        }
        Ok(Ok(Err(message))) => {
            cancel_auth_ticket(lifecycle, ticket_handle);
            Err(Error::from_reason(message))
        }
        Ok(Err(err)) => {
            cancel_auth_ticket(lifecycle, ticket_handle);
            Err(Error::from_reason(err.to_string()))
        }
        Err(_) => {
            cancel_auth_ticket(lifecycle, ticket_handle);
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
    let threadsafe_handler: FatalThreadsafeFunction<serde_json::Value> = handler
        .build_threadsafe_function::<serde_json::Value>()
        .build_callback(|ctx| Ok(vec![ctx.value]))?;

    let registration = {
        let _dispatch = state::lock_manual_dispatch(state::CallbackDomain::Client);
        state::ensure_initialized()?;
        state::register_callback(CALLBACK_MICRO_TXN_AUTHORIZATION_RESPONSE, move |param| {
            let value = unsafe { micro_txn_to_json(param) };
            threadsafe_handler.call(value, ThreadsafeFunctionCallMode::NonBlocking);
        })
    };

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
    let threadsafe_handler: FatalThreadsafeFunction<serde_json::Value> = handler
        .build_threadsafe_function::<serde_json::Value>()
        .build_callback(|ctx| Ok(vec![ctx.value]))?;

    let registration = {
        let _dispatch = state::lock_manual_dispatch(state::CallbackDomain::Client);
        state::ensure_initialized()?;
        state::register_callback(CALLBACK_GAME_OVERLAY_ACTIVATED, move |param| {
            let value = unsafe { game_overlay_activated_to_json(param) };
            threadsafe_handler.call(value, ThreadsafeFunctionCallMode::NonBlocking);
        })
    };

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

pub(crate) fn cancel_auth_ticket(
    lifecycle: state::LifecycleToken,
    ticket_handle: sys::HAuthTicket,
) {
    if ticket_handle == H_AUTH_TICKET_INVALID {
        return;
    }

    let _dispatch = state::lock_manual_dispatch(lifecycle.domain());
    if state::ensure_current_lifecycle_token(lifecycle).is_err() {
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

pub(crate) fn make_auth_ticket(
    data: Vec<u8>,
    handle: sys::HAuthTicket,
    lifecycle: state::LifecycleToken,
) -> AuthTicket {
    AuthTicket {
        data,
        handle: resource::NativeResourceHandle::new(
            handle,
            H_AUTH_TICKET_INVALID,
            lifecycle,
            cancel_auth_ticket,
        ),
    }
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
