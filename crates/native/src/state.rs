use napi::bindgen_prelude::Error;
use once_cell::sync::Lazy;
use std::collections::HashMap;
use std::ffi::c_void;
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::sync::Mutex;

type CallbackFn = Box<dyn FnMut(*mut c_void) + Send + 'static>;

static INITIALIZED: AtomicBool = AtomicBool::new(false);
static NEXT_CALLBACK_ID: AtomicU64 = AtomicU64::new(1);
static CALLBACKS: Lazy<Mutex<CallbackRegistry>> =
    Lazy::new(|| Mutex::new(CallbackRegistry::default()));

#[derive(Default)]
struct CallbackRegistry {
    callbacks: HashMap<i32, HashMap<u64, CallbackFn>>,
}

pub struct CallbackRegistration {
    callback_id: i32,
    registration_id: u64,
}

impl Drop for CallbackRegistration {
    fn drop(&mut self) {
        unregister_callback(self.callback_id, self.registration_id);
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

pub fn register_callback<F>(callback_id: i32, callback: F) -> CallbackRegistration
where
    F: FnMut(*mut c_void) + Send + 'static,
{
    let registration_id = NEXT_CALLBACK_ID.fetch_add(1, Ordering::Relaxed);
    let mut registry = CALLBACKS.lock().expect("Steam callback registry poisoned");
    registry
        .callbacks
        .entry(callback_id)
        .or_default()
        .insert(registration_id, Box::new(callback));

    CallbackRegistration {
        callback_id,
        registration_id,
    }
}

pub fn dispatch_callback(callback_id: i32, param: *mut c_void) {
    let mut registry = CALLBACKS.lock().expect("Steam callback registry poisoned");
    if let Some(callbacks) = registry.callbacks.get_mut(&callback_id) {
        for callback in callbacks.values_mut() {
            callback(param);
        }
    }
}

pub fn clear_callbacks() {
    CALLBACKS
        .lock()
        .expect("Steam callback registry poisoned")
        .callbacks
        .clear();
}

fn unregister_callback(callback_id: i32, registration_id: u64) {
    let mut registry = CALLBACKS.lock().expect("Steam callback registry poisoned");
    if let Some(callbacks) = registry.callbacks.get_mut(&callback_id) {
        callbacks.remove(&registration_id);
        if callbacks.is_empty() {
            registry.callbacks.remove(&callback_id);
        }
    }
}
