use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::OnceLock;

#[derive(Clone, Copy, Debug, PartialEq)]
pub(super) struct CopyTimeoutEvidence {
    pub elapsed_ms: f64,
    pub dispatch_delay_ms: f64,
    pub target_fence_value: Option<u64>,
    pub observed_fence_value: Option<u64>,
    pub device_status: Option<(f64, i32, Option<i32>)>,
}

#[derive(Default)]
pub(super) struct FirstCopyTimeout {
    claimed: AtomicBool,
    value: OnceLock<CopyTimeoutEvidence>,
}

impl FirstCopyTimeout {
    pub fn record(&self, evidence: CopyTimeoutEvidence) {
        if self
            .claimed
            .compare_exchange(false, true, Ordering::Relaxed, Ordering::Relaxed)
            .is_ok()
        {
            let _ = self.value.set(evidence);
        }
    }

    pub fn get(&self) -> Option<CopyTimeoutEvidence> {
        self.value.get().copied()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn evidence() -> CopyTimeoutEvidence {
        CopyTimeoutEvidence {
            elapsed_ms: 5032.75,
            dispatch_delay_ms: 4920.125,
            target_fence_value: Some((1u64 << 53) + 17),
            observed_fence_value: Some(9),
            device_status: None,
        }
    }

    #[test]
    fn unrecorded_is_absent_and_missing_device_check_stays_absent() {
        let store = FirstCopyTimeout::default();
        assert_eq!(store.get(), None);
        store.record(evidence());
        assert_eq!(store.get().unwrap().device_status, None);
    }

    #[test]
    fn preserves_actual_timing_and_full_precision_fence() {
        let store = FirstCopyTimeout::default();
        store.record(evidence());
        let value = store.get().unwrap();
        assert_eq!(value.elapsed_ms, 5032.75);
        assert_eq!(value.dispatch_delay_ms, 4920.125);
        assert_eq!(
            value.target_fence_value.unwrap().to_string(),
            "9007199254741009"
        );
    }

    #[test]
    fn subsequent_terminal_records_do_not_replace_first() {
        let store = FirstCopyTimeout::default();
        store.record(evidence());
        store.record(CopyTimeoutEvidence {
            elapsed_ms: 6000.0,
            ..evidence()
        });
        assert_eq!(store.get(), Some(evidence()));
    }

    #[test]
    fn concurrent_writers_publish_one_complete_record() {
        let store = std::sync::Arc::new(FirstCopyTimeout::default());
        let threads: Vec<_> = (0..16)
            .map(|i| {
                let store = store.clone();
                std::thread::spawn(move || {
                    store.record(CopyTimeoutEvidence {
                        elapsed_ms: i as f64,
                        dispatch_delay_ms: i as f64,
                        ..evidence()
                    })
                })
            })
            .collect();
        for thread in threads {
            thread.join().unwrap();
        }
        let value = store.get().unwrap();
        assert_eq!(value.elapsed_ms, value.dispatch_delay_ms);
        assert_eq!(value.target_fence_value, evidence().target_fence_value);
    }
}
