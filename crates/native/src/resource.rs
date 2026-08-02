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

    pub(crate) fn release(&mut self) {
        if self.handle == self.invalid {
            return;
        }
        (self.release)(self.context, self.handle);
        self.handle = self.invalid;
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

    fn record_release(context: u64, handle: u64) {
        RELEASED.store(context + handle, Ordering::SeqCst);
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
}
