use napi::bindgen_prelude::Error;
use once_cell::sync::Lazy;
use std::collections::{HashMap, VecDeque};
use std::ffi::c_void;
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::sync::{Mutex, MutexGuard};

type CallbackFn = Box<dyn FnMut(*mut c_void) + Send + 'static>;
type WarningMessageFn = Box<dyn FnMut(i32, String) + Send + 'static>;
type NetworkingDebugOutputFn = Box<dyn FnMut(i32, String) + Send + 'static>;

static INITIALIZED: AtomicBool = AtomicBool::new(false);
static GAME_SERVER_INITIALIZED: AtomicBool = AtomicBool::new(false);
static NEXT_CALLBACK_ID: AtomicU64 = AtomicU64::new(1);
static CALLBACKS: Lazy<Mutex<CallbackRegistry>> =
    Lazy::new(|| Mutex::new(CallbackRegistry::default()));
static MANUAL_DISPATCH: Lazy<Mutex<()>> = Lazy::new(|| Mutex::new(()));
#[cfg(test)]
static TEST_STATE: Lazy<Mutex<()>> = Lazy::new(|| Mutex::new(()));

const MAX_COMPLETED_API_CALLS_PER_DOMAIN: usize = 4096;
const MAX_COMPLETED_API_CALL_BYTES_PER_DOMAIN: usize = 16 * 1024 * 1024;

#[derive(Clone, Copy, Debug, Eq, Hash, PartialEq)]
pub enum CallbackDomain {
    Client,
    GameServer,
}

#[derive(Debug)]
pub struct CompletedApiCall {
    pub callback_id: i32,
    pub byte_length: usize,
    pub data: Vec<u8>,
    pub ok: bool,
    pub failed: bool,
    pub failure_reason: Option<i32>,
}

#[derive(Debug)]
pub enum CompletedApiCallLookup {
    Pending,
    MetadataMismatch {
        callback_id: i32,
        byte_length: usize,
    },
    Ready(CompletedApiCall),
}

#[derive(Default)]
struct CallbackRegistry {
    callbacks: HashMap<(CallbackDomain, i32), HashMap<u64, CallbackFn>>,
    completed_api_calls: HashMap<(CallbackDomain, u64), CompletedApiCall>,
    completed_api_call_order: VecDeque<(CallbackDomain, u64)>,
    warning_message_hooks: HashMap<u64, WarningMessageFn>,
    networking_debug_output_hooks: HashMap<u64, NetworkingDebugOutputFn>,
}

pub struct CallbackRegistration {
    domain: CallbackDomain,
    callback_id: i32,
    registration_id: u64,
}

pub struct WarningMessageRegistration {
    registration_id: u64,
}

pub struct NetworkingDebugOutputRegistration {
    registration_id: u64,
}

impl Drop for CallbackRegistration {
    fn drop(&mut self) {
        unregister_callback(self.domain, self.callback_id, self.registration_id);
    }
}

impl Drop for WarningMessageRegistration {
    fn drop(&mut self) {
        unregister_warning_message_hook(self.registration_id);
    }
}

impl Drop for NetworkingDebugOutputRegistration {
    fn drop(&mut self) {
        unregister_networking_debug_output_hook(self.registration_id);
    }
}

pub fn mark_initialized(initialized: bool) {
    INITIALIZED.store(initialized, Ordering::SeqCst);
}

pub fn is_initialized() -> bool {
    INITIALIZED.load(Ordering::SeqCst)
}

pub fn ensure_initialized() -> Result<(), Error> {
    if is_initialized() {
        Ok(())
    } else {
        Err(Error::from_reason("Steam Bridge has not been initialized"))
    }
}

pub fn mark_game_server_initialized(initialized: bool) {
    GAME_SERVER_INITIALIZED.store(initialized, Ordering::SeqCst);
}

pub fn is_game_server_initialized() -> bool {
    GAME_SERVER_INITIALIZED.load(Ordering::SeqCst)
}

pub fn ensure_game_server_initialized() -> Result<(), Error> {
    if is_game_server_initialized() {
        Ok(())
    } else {
        Err(Error::from_reason(
            "Steam Game Server has not been initialized",
        ))
    }
}

pub fn lock_manual_dispatch(_domain: CallbackDomain) -> MutexGuard<'static, ()> {
    MANUAL_DISPATCH
        .lock()
        .expect("Steam manual-dispatch lock poisoned")
}

#[cfg(test)]
pub(crate) fn lock_test_state() -> MutexGuard<'static, ()> {
    TEST_STATE.lock().expect("Steam test-state lock poisoned")
}

pub fn register_callback<F>(callback_id: i32, callback: F) -> CallbackRegistration
where
    F: FnMut(*mut c_void) + Send + 'static,
{
    register_callback_for_domain(CallbackDomain::Client, callback_id, callback)
}

pub fn register_game_server_callback<F>(callback_id: i32, callback: F) -> CallbackRegistration
where
    F: FnMut(*mut c_void) + Send + 'static,
{
    register_callback_for_domain(CallbackDomain::GameServer, callback_id, callback)
}

fn register_callback_for_domain<F>(
    domain: CallbackDomain,
    callback_id: i32,
    callback: F,
) -> CallbackRegistration
where
    F: FnMut(*mut c_void) + Send + 'static,
{
    let registration_id = NEXT_CALLBACK_ID.fetch_add(1, Ordering::Relaxed);
    let mut registry = CALLBACKS.lock().expect("Steam callback registry poisoned");
    registry
        .callbacks
        .entry((domain, callback_id))
        .or_default()
        .insert(registration_id, Box::new(callback));

    CallbackRegistration {
        domain,
        callback_id,
        registration_id,
    }
}

pub fn register_warning_message_hook<F>(callback: F) -> WarningMessageRegistration
where
    F: FnMut(i32, String) + Send + 'static,
{
    let registration_id = NEXT_CALLBACK_ID.fetch_add(1, Ordering::Relaxed);
    let mut registry = CALLBACKS.lock().expect("Steam callback registry poisoned");
    registry
        .warning_message_hooks
        .insert(registration_id, Box::new(callback));

    WarningMessageRegistration { registration_id }
}

pub fn register_networking_debug_output_hook<F>(callback: F) -> NetworkingDebugOutputRegistration
where
    F: FnMut(i32, String) + Send + 'static,
{
    let registration_id = NEXT_CALLBACK_ID.fetch_add(1, Ordering::Relaxed);
    let mut registry = CALLBACKS.lock().expect("Steam callback registry poisoned");
    registry
        .networking_debug_output_hooks
        .insert(registration_id, Box::new(callback));

    NetworkingDebugOutputRegistration { registration_id }
}

pub fn dispatch_callback(callback_id: i32, param: *mut c_void) {
    dispatch_callback_for_domain(CallbackDomain::Client, callback_id, param);
}

pub fn dispatch_game_server_callback(callback_id: i32, param: *mut c_void) {
    dispatch_callback_for_domain(CallbackDomain::GameServer, callback_id, param);
}

fn dispatch_callback_for_domain(domain: CallbackDomain, callback_id: i32, param: *mut c_void) {
    let mut registry = CALLBACKS.lock().expect("Steam callback registry poisoned");
    if let Some(callbacks) = registry.callbacks.get_mut(&(domain, callback_id)) {
        for callback in callbacks.values_mut() {
            callback(param);
        }
    }
}

pub fn dispatch_warning_message(severity: i32, message: String) {
    let mut registry = CALLBACKS.lock().expect("Steam callback registry poisoned");
    for callback in registry.warning_message_hooks.values_mut() {
        callback(severity, message.clone());
    }
}

pub fn dispatch_networking_debug_output(detail_level: i32, message: String) {
    let mut registry = CALLBACKS.lock().expect("Steam callback registry poisoned");
    for callback in registry.networking_debug_output_hooks.values_mut() {
        callback(detail_level, message.clone());
    }
}

pub fn clear_callbacks() {
    let mut registry = CALLBACKS.lock().expect("Steam callback registry poisoned");
    clear_callback_domain(&mut registry, CallbackDomain::Client);
    registry.warning_message_hooks.clear();
    registry.networking_debug_output_hooks.clear();
}

pub fn clear_game_server_callbacks() {
    let mut registry = CALLBACKS.lock().expect("Steam callback registry poisoned");
    clear_callback_domain(&mut registry, CallbackDomain::GameServer);
}

pub fn store_completed_api_call(domain: CallbackDomain, api_call: u64, result: CompletedApiCall) {
    let mut registry = CALLBACKS.lock().expect("Steam callback registry poisoned");
    let key = (domain, api_call);
    if registry.completed_api_calls.insert(key, result).is_none() {
        registry.completed_api_call_order.push_back(key);
    }

    while completed_api_call_count(&registry, domain) > MAX_COMPLETED_API_CALLS_PER_DOMAIN
        || completed_api_call_bytes(&registry, domain) > MAX_COMPLETED_API_CALL_BYTES_PER_DOMAIN
    {
        let Some(index) = registry
            .completed_api_call_order
            .iter()
            .position(|(entry_domain, _)| *entry_domain == domain)
        else {
            break;
        };
        if let Some(expired) = registry.completed_api_call_order.remove(index) {
            registry.completed_api_calls.remove(&expired);
        }
    }
}

fn completed_api_call_count(registry: &CallbackRegistry, domain: CallbackDomain) -> usize {
    registry
        .completed_api_calls
        .keys()
        .filter(|(entry_domain, _)| *entry_domain == domain)
        .count()
}

fn completed_api_call_bytes(registry: &CallbackRegistry, domain: CallbackDomain) -> usize {
    registry
        .completed_api_calls
        .iter()
        .filter(|((entry_domain, _), _)| *entry_domain == domain)
        .map(|(_, result)| result.data.len())
        .sum()
}

pub fn completed_api_call_status(domain: CallbackDomain, api_call: u64) -> Option<(bool, bool)> {
    CALLBACKS
        .lock()
        .expect("Steam callback registry poisoned")
        .completed_api_calls
        .get(&(domain, api_call))
        .map(|result| (true, result.failed || !result.ok))
}

pub fn completed_api_call_failure_reason(
    domain: CallbackDomain,
    api_call: u64,
) -> Option<Option<i32>> {
    CALLBACKS
        .lock()
        .expect("Steam callback registry poisoned")
        .completed_api_calls
        .get(&(domain, api_call))
        .map(|result| result.failure_reason)
}

pub fn take_completed_api_call(
    domain: CallbackDomain,
    api_call: u64,
    expected_callback: i32,
    expected_byte_length: usize,
) -> CompletedApiCallLookup {
    let mut registry = CALLBACKS.lock().expect("Steam callback registry poisoned");
    let key = (domain, api_call);
    let Some(result) = registry.completed_api_calls.get(&key) else {
        return CompletedApiCallLookup::Pending;
    };
    if result.callback_id != expected_callback || result.byte_length != expected_byte_length {
        return CompletedApiCallLookup::MetadataMismatch {
            callback_id: result.callback_id,
            byte_length: result.byte_length,
        };
    }

    let result = registry
        .completed_api_calls
        .remove(&key)
        .expect("Steam API call result disappeared while locked");
    registry
        .completed_api_call_order
        .retain(|candidate| *candidate != key);
    CompletedApiCallLookup::Ready(result)
}

fn clear_callback_domain(registry: &mut CallbackRegistry, domain: CallbackDomain) {
    registry
        .callbacks
        .retain(|(entry_domain, _), _| *entry_domain != domain);
    registry
        .completed_api_calls
        .retain(|(entry_domain, _), _| *entry_domain != domain);
    registry
        .completed_api_call_order
        .retain(|(entry_domain, _)| *entry_domain != domain);
}

fn unregister_callback(domain: CallbackDomain, callback_id: i32, registration_id: u64) {
    let mut registry = CALLBACKS.lock().expect("Steam callback registry poisoned");
    let key = (domain, callback_id);
    if let Some(callbacks) = registry.callbacks.get_mut(&key) {
        callbacks.remove(&registration_id);
        if callbacks.is_empty() {
            registry.callbacks.remove(&key);
        }
    }
}

fn unregister_warning_message_hook(registration_id: u64) {
    CALLBACKS
        .lock()
        .expect("Steam callback registry poisoned")
        .warning_message_hooks
        .remove(&registration_id);
}

fn unregister_networking_debug_output_hook(registration_id: u64) {
    CALLBACKS
        .lock()
        .expect("Steam callback registry poisoned")
        .networking_debug_output_hooks
        .remove(&registration_id);
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::atomic::{AtomicUsize, Ordering};
    use std::sync::Arc;

    fn completed(callback_id: i32, byte: u8) -> CompletedApiCall {
        CompletedApiCall {
            callback_id,
            byte_length: 1,
            data: vec![byte],
            ok: true,
            failed: false,
            failure_reason: None,
        }
    }

    #[test]
    fn callback_domains_route_and_clear_independently() {
        let _test = lock_test_state();
        clear_callbacks();
        clear_game_server_callbacks();

        let client_count = Arc::new(AtomicUsize::new(0));
        let server_count = Arc::new(AtomicUsize::new(0));
        let client_counter = Arc::clone(&client_count);
        let server_counter = Arc::clone(&server_count);
        let _client = register_callback(777, move |_| {
            client_counter.fetch_add(1, Ordering::SeqCst);
        });
        let _server = register_game_server_callback(777, move |_| {
            server_counter.fetch_add(1, Ordering::SeqCst);
        });

        dispatch_callback(777, std::ptr::null_mut());
        assert_eq!(client_count.load(Ordering::SeqCst), 1);
        assert_eq!(server_count.load(Ordering::SeqCst), 0);

        dispatch_game_server_callback(777, std::ptr::null_mut());
        assert_eq!(client_count.load(Ordering::SeqCst), 1);
        assert_eq!(server_count.load(Ordering::SeqCst), 1);

        clear_callbacks();
        dispatch_callback(777, std::ptr::null_mut());
        dispatch_game_server_callback(777, std::ptr::null_mut());
        assert_eq!(client_count.load(Ordering::SeqCst), 1);
        assert_eq!(server_count.load(Ordering::SeqCst), 2);

        clear_game_server_callbacks();
    }

    #[test]
    fn completed_api_calls_are_domain_scoped_and_mismatch_safe() {
        let _test = lock_test_state();
        clear_callbacks();
        clear_game_server_callbacks();

        store_completed_api_call(CallbackDomain::Client, 99, completed(100, 1));
        store_completed_api_call(CallbackDomain::GameServer, 99, completed(200, 2));

        assert!(matches!(
            take_completed_api_call(CallbackDomain::Client, 99, 999, 1),
            CompletedApiCallLookup::MetadataMismatch {
                callback_id: 100,
                byte_length: 1
            }
        ));
        assert!(matches!(
            take_completed_api_call(CallbackDomain::Client, 99, 100, 1),
            CompletedApiCallLookup::Ready(CompletedApiCall { data, .. }) if data == vec![1]
        ));
        assert!(matches!(
            take_completed_api_call(CallbackDomain::GameServer, 99, 200, 1),
            CompletedApiCallLookup::Ready(CompletedApiCall { data, .. }) if data == vec![2]
        ));
        assert!(matches!(
            take_completed_api_call(CallbackDomain::Client, 99, 100, 1),
            CompletedApiCallLookup::Pending
        ));
    }

    #[test]
    fn client_and_game_server_share_one_manual_dispatch_lock() {
        let _test = lock_test_state();
        let client = lock_manual_dispatch(CallbackDomain::Client);
        assert!(MANUAL_DISPATCH.try_lock().is_err());
        drop(client);

        let server = lock_manual_dispatch(CallbackDomain::GameServer);
        assert!(MANUAL_DISPATCH.try_lock().is_err());
        drop(server);
        assert!(MANUAL_DISPATCH.try_lock().is_ok());
    }

    #[test]
    fn clearing_a_domain_drops_pending_callback_state() {
        let _test = lock_test_state();
        clear_callbacks();

        let (sender, mut receiver) = tokio::sync::oneshot::channel::<()>();
        let _registration = register_callback(888, move |_| {
            let _ = &sender;
        });
        assert!(matches!(
            receiver.try_recv(),
            Err(tokio::sync::oneshot::error::TryRecvError::Empty)
        ));

        clear_callbacks();
        assert!(matches!(
            receiver.try_recv(),
            Err(tokio::sync::oneshot::error::TryRecvError::Closed)
        ));
    }
}
