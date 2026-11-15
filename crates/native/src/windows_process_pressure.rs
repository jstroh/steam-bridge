use serde_json::{json, Value};
use std::mem::size_of;
use windows::Win32::Foundation::{CloseHandle, FILETIME};
use windows::Win32::System::ProcessStatus::{K32GetPerformanceInfo, PERFORMANCE_INFORMATION};
use windows::Win32::System::Threading::{
    GetCurrentProcess, GetCurrentProcessId, GetProcessHandleCount, GetProcessTimes, OpenProcess,
    PROCESS_QUERY_LIMITED_INFORMATION,
};

const MAX_PROCESS_IDS: usize = 16;
const UNIX_EPOCH_FILETIME: u64 = 116_444_736_000_000_000;

pub fn sample(pids: &[u32]) -> Option<Value> {
    if pids.len() > MAX_PROCESS_IDS || pids.contains(&0) {
        return None;
    }

    let system = sample_system();
    let processes: Vec<_> = pids
        .iter()
        .enumerate()
        .filter(|(index, pid)| !pids[..*index].contains(pid))
        .filter_map(|(_, pid)| sample_process(*pid))
        .collect();
    if system.is_none() && processes.is_empty() {
        return None;
    }
    Some(json!({ "version": 1, "system": system, "processes": processes }))
}

fn sample_system() -> Option<Value> {
    let size = size_of::<PERFORMANCE_INFORMATION>() as u32;
    let mut info = PERFORMANCE_INFORMATION {
        cb: size,
        ..Default::default()
    };
    if !unsafe { K32GetPerformanceInfo(&mut info, size) }.as_bool() || info.PageSize == 0 {
        return None;
    }

    let kib = |pages: usize| pages.checked_mul(info.PageSize).map(|bytes| bytes / 1024);
    let commit_total = kib(info.CommitTotal)?;
    let commit_limit = kib(info.CommitLimit)?;
    Some(json!({
        "commitTotalKiB": commit_total,
        "commitLimitKiB": commit_limit,
        "commitPeakKiB": kib(info.CommitPeak)?,
        "commitHeadroomKiB": commit_limit.saturating_sub(commit_total),
        "systemHandleCount": info.HandleCount,
        "systemThreadCount": info.ThreadCount,
        "systemProcessCount": info.ProcessCount,
        "kernelPagedKiB": kib(info.KernelPaged)?,
        "kernelNonpagedKiB": kib(info.KernelNonpaged)?,
    }))
}

fn sample_process(pid: u32) -> Option<Value> {
    let mut creation = FILETIME::default();
    let mut exit = FILETIME::default();
    let mut kernel = FILETIME::default();
    let mut user = FILETIME::default();
    let mut count = 0;
    unsafe {
        let current_process = pid == GetCurrentProcessId();
        let process = if current_process {
            GetCurrentProcess()
        } else {
            OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, false, pid).ok()?
        };
        let creation_read =
            GetProcessTimes(process, &mut creation, &mut exit, &mut kernel, &mut user);
        let count_read = GetProcessHandleCount(process, &mut count);
        if !current_process {
            let _ = CloseHandle(process);
        }
        creation_read.ok()?;
        count_read.ok()?;
    }

    let created_at = (u64::from(creation.dwHighDateTime) << 32) | u64::from(creation.dwLowDateTime);
    let creation_time_ms = created_at.checked_sub(UNIX_EPOCH_FILETIME)? as f64 / 10_000.0;
    Some(json!({ "pid": pid, "creationTimeMs": creation_time_ms, "handleCount": count }))
}
