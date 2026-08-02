pub(crate) struct NativeResourceHandle<H, C>
where
    H: Copy + PartialEq,
    C: Copy,
{
    handle: H,
    invalid: H,
    context: C,
    release: fn(C, H),
}

impl<H, C> NativeResourceHandle<H, C>
where
    H: Copy + PartialEq,
    C: Copy,
{
    pub(crate) fn new(handle: H, invalid: H, context: C, release: fn(C, H)) -> Self {
        Self {
            handle,
            invalid,
            context,
            release,
        }
    }

    pub(crate) fn get(&self) -> H {
        self.handle
    }

    pub(crate) fn context(&self) -> C {
        self.context
    }

    pub(crate) fn release(&mut self) {
        if self.handle == self.invalid {
            return;
        }
        let handle = self.handle;
        self.handle = self.invalid;
        (self.release)(self.context, handle);
    }
}

impl<H, C> Drop for NativeResourceHandle<H, C>
where
    H: Copy + PartialEq,
    C: Copy,
{
    fn drop(&mut self) {
        self.release();
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::atomic::{AtomicU64, Ordering};

    static RELEASED: AtomicU64 = AtomicU64::new(0);
    static PANICKED_RELEASES: AtomicU64 = AtomicU64::new(0);

    fn record_release(context: u64, handle: u64) {
        RELEASED.store(context + handle, Ordering::SeqCst);
    }

    fn panic_after_recording_release(_context: u64, _handle: u64) {
        PANICKED_RELEASES.fetch_add(1, Ordering::SeqCst);
        panic!("release failed");
    }

    #[test]
    fn native_resource_releases_once_explicitly_or_on_drop() {
        RELEASED.store(0, Ordering::SeqCst);
        {
            let mut resource = NativeResourceHandle::new(40, 0, 2, record_release);
            assert_eq!(resource.get(), 40);
            resource.release();
            resource.release();
            assert_eq!(RELEASED.load(Ordering::SeqCst), 42);
        }
        assert_eq!(RELEASED.load(Ordering::SeqCst), 42);

        RELEASED.store(0, Ordering::SeqCst);
        drop(NativeResourceHandle::new(41, 0, 1, record_release));
        assert_eq!(RELEASED.load(Ordering::SeqCst), 42);
    }

    #[test]
    fn native_resource_consumes_ownership_before_a_panicking_release() {
        PANICKED_RELEASES.store(0, Ordering::SeqCst);
        let mut resource = NativeResourceHandle::new(42, 0, 1, panic_after_recording_release);
        let release = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
            resource.release();
        }));
        assert!(release.is_err());
        drop(resource);
        assert_eq!(PANICKED_RELEASES.load(Ordering::SeqCst), 1);
    }
}
