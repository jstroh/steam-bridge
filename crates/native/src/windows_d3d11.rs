use std::ffi::c_void;
use std::slice;
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::sync::{Arc, Mutex, MutexGuard};
use std::time::{Duration, Instant};
use windows::core::{Interface, PCSTR};
use windows::Win32::Foundation::{
    CloseHandle, DuplicateHandle, DUPLICATE_SAME_ACCESS, DXGI_STATUS_OCCLUDED, GENERIC_ALL, HANDLE,
    HMODULE, HWND, LUID, WAIT_EVENT, WAIT_FAILED, WAIT_OBJECT_0, WAIT_TIMEOUT,
};
use windows::Win32::Graphics::Direct3D::Fxc::D3DCompile;
use windows::Win32::Graphics::Direct3D::{
    ID3DBlob, ID3DInclude, D3D_DRIVER_TYPE_HARDWARE, D3D_DRIVER_TYPE_UNKNOWN, D3D_FEATURE_LEVEL,
    D3D_FEATURE_LEVEL_10_0, D3D_FEATURE_LEVEL_10_1, D3D_FEATURE_LEVEL_11_0, D3D_FEATURE_LEVEL_11_1,
    D3D_PRIMITIVE_TOPOLOGY_TRIANGLELIST,
};
use windows::Win32::Graphics::Direct3D11::{
    D3D11CreateDevice, ID3D11ClassLinkage, ID3D11DepthStencilView, ID3D11Device, ID3D11Device1,
    ID3D11Device5, ID3D11DeviceContext, ID3D11DeviceContext4, ID3D11Fence, ID3D11InputLayout,
    ID3D11PixelShader, ID3D11Query, ID3D11RenderTargetView, ID3D11SamplerState,
    ID3D11ShaderResourceView, ID3D11Texture2D, ID3D11VertexShader, D3D11_ASYNC_GETDATA_DONOTFLUSH,
    D3D11_BIND_RENDER_TARGET, D3D11_BIND_SHADER_RESOURCE, D3D11_BOX, D3D11_COMPARISON_NEVER,
    D3D11_CREATE_DEVICE_BGRA_SUPPORT, D3D11_FENCE_FLAG_NONE, D3D11_FENCE_FLAG_SHARED,
    D3D11_FILTER_MIN_MAG_MIP_LINEAR, D3D11_QUERY_DATA_TIMESTAMP_DISJOINT, D3D11_QUERY_DESC,
    D3D11_QUERY_EVENT, D3D11_QUERY_TIMESTAMP, D3D11_QUERY_TIMESTAMP_DISJOINT,
    D3D11_RESOURCE_MISC_SHARED, D3D11_RESOURCE_MISC_SHARED_NTHANDLE, D3D11_SAMPLER_DESC,
    D3D11_SDK_VERSION, D3D11_TEXTURE2D_DESC, D3D11_TEXTURE_ADDRESS_CLAMP, D3D11_USAGE_DEFAULT,
    D3D11_VIEWPORT,
};
use windows::Win32::Graphics::Dxgi::Common::{
    DXGI_ALPHA_MODE_IGNORE, DXGI_FORMAT, DXGI_FORMAT_B8G8R8A8_UNORM, DXGI_FORMAT_UNKNOWN,
    DXGI_SAMPLE_DESC,
};
use windows::Win32::Graphics::Dxgi::{
    CreateDXGIFactory2, IDXGIAdapter, IDXGIAdapter1, IDXGIDevice, IDXGIFactory2, IDXGIFactory4,
    IDXGIFactory6, IDXGIOutput, IDXGIResource1, IDXGISwapChain1, IDXGISwapChain2,
    DXGI_ADAPTER_FLAG_SOFTWARE, DXGI_CREATE_FACTORY_FLAGS, DXGI_ERROR_WAS_STILL_DRAWING,
    DXGI_FRAME_STATISTICS, DXGI_GPU_PREFERENCE_HIGH_PERFORMANCE, DXGI_MWA_NO_ALT_ENTER,
    DXGI_PRESENT, DXGI_PRESENT_DO_NOT_WAIT, DXGI_PRESENT_TEST, DXGI_SCALING_STRETCH,
    DXGI_SHARED_RESOURCE_READ, DXGI_SHARED_RESOURCE_WRITE, DXGI_SWAP_CHAIN_DESC1,
    DXGI_SWAP_CHAIN_FLAG_FRAME_LATENCY_WAITABLE_OBJECT, DXGI_SWAP_EFFECT_FLIP_SEQUENTIAL,
    DXGI_USAGE_RENDER_TARGET_OUTPUT,
};
use windows::Win32::Graphics::Gdi::{MonitorFromWindow, MONITOR_DEFAULTTONEAREST};
use windows::Win32::Media::{timeBeginPeriod, timeEndPeriod, TIMERR_NOERROR};
use windows::Win32::System::Threading::{
    CreateEventW, GetCurrentProcess, ResetEvent, WaitForSingleObjectEx,
};

const FRAME_LATENCY_WAIT_POLL_MS: u32 = 0;
const SHARED_TEXTURE_COPY_SLOW_MS: u128 = 50;
const SHARED_TEXTURE_COPY_TIMEOUT_MS: u128 = 500;
const SHARED_TEXTURE_COPY_FATAL_TIMEOUT_MS: u128 = 2_000;
// Match the process-wide submission limit. Two slots preserve normal
// high-refresh pipelining while reserving eight of Electron 43's ten offscreen
// producer frames during a slow or wedged cross-device GPU copy.
const SHARED_TEXTURE_COPY_SLOT_COUNT: usize = 2;
static NEXT_FRAME_LATENCY_WAIT_GENERATION: AtomicU64 = AtomicU64::new(1);

struct SharedTextureCopySlot {
    event: HANDLE,
    query: Option<ID3D11Query>,
    in_flight: AtomicBool,
}

unsafe impl Send for SharedTextureCopySlot {}
unsafe impl Sync for SharedTextureCopySlot {}

impl Drop for SharedTextureCopySlot {
    fn drop(&mut self) {
        if !self.event.is_invalid() {
            unsafe {
                let _ = CloseHandle(self.event);
            }
            self.event = HANDLE::default();
        }
    }
}

struct SharedTextureCopySlotReservation {
    slot: Option<Arc<SharedTextureCopySlot>>,
}

impl SharedTextureCopySlotReservation {
    fn into_slot(mut self) -> Arc<SharedTextureCopySlot> {
        self.slot
            .take()
            .expect("shared-texture copy reservation must own a slot")
    }
}

impl Drop for SharedTextureCopySlotReservation {
    fn drop(&mut self) {
        if let Some(slot) = self.slot.as_ref() {
            slot.in_flight.store(false, Ordering::Release);
        }
    }
}

fn try_reserve_shared_texture_copy_slot(
    slots: &[Arc<SharedTextureCopySlot>],
) -> Option<SharedTextureCopySlotReservation> {
    slots.iter().find_map(|slot| {
        slot.in_flight
            .compare_exchange(false, true, Ordering::AcqRel, Ordering::Acquire)
            .is_ok()
            .then(|| SharedTextureCopySlotReservation {
                slot: Some(Arc::clone(slot)),
            })
    })
}

fn shared_texture_copy_completion_mode_name(
    has_fence: bool,
    asynchronous_slot_count: usize,
) -> &'static str {
    if has_fence {
        "d3d11-fence-async"
    } else if asynchronous_slot_count > 0 {
        "d3d11-query-async"
    } else {
        "d3d11-query-legacy-only"
    }
}

fn lock_shared_texture_context(
    context_lock: &Option<Arc<Mutex<()>>>,
) -> Result<Option<MutexGuard<'_, ()>>, String> {
    context_lock
        .as_ref()
        .map(|lock| {
            lock.lock()
                .map_err(|_| "D3D11 shared-texture context lock was poisoned".to_owned())
        })
        .transpose()
}

#[derive(Default)]
struct SharedTextureCopyTelemetry {
    slow_count: AtomicU64,
    timeout_count: AtomicU64,
    fatal_timeout_count: AtomicU64,
    completed_count: AtomicU64,
    submission_failure_count: AtomicU64,
    terminal_failure_count: AtomicU64,
    last_dispatch_delay_micros: AtomicU64,
    max_dispatch_delay_micros: AtomicU64,
    last_duration_micros: AtomicU64,
    max_duration_micros: AtomicU64,
    fence_wait: SharedTextureFenceWaitTelemetry,
}

#[derive(Default)]
struct SharedTextureFenceWaitTelemetry {
    event_timeout_count: AtomicU64,
    completed_after_timeout_count: AtomicU64,
    early_event_count: AtomicU64,
    event_failure_count: AtomicU64,
}

fn shared_texture_fence_complete(value: u64, expected: u64) -> Result<bool, String> {
    if value == u64::MAX {
        Err("D3D11 shared-texture fence reports device removal; the native graphics device must be restarted".to_owned())
    } else {
        Ok(value >= expected)
    }
}

fn register_shared_texture_copy_fence_event(
    event: HANDLE,
    register: impl FnOnce() -> bool,
) -> bool {
    unsafe { ResetEvent(event) }.is_ok() && register()
}

fn poll_shared_texture_copy_fence(
    fence_value: u64,
    use_event_wait: &mut bool,
    telemetry: &SharedTextureFenceWaitTelemetry,
    mut completed_value: impl FnMut() -> u64,
    mut wait_event: impl FnMut() -> WAIT_EVENT,
) -> Result<bool, String> {
    if shared_texture_fence_complete(completed_value(), fence_value)? {
        return Ok(true);
    }
    if !*use_event_wait {
        return Ok(false);
    }
    let result = wait_event();
    if result != WAIT_OBJECT_0 && result != WAIT_TIMEOUT {
        *use_event_wait = false;
        telemetry
            .event_failure_count
            .fetch_add(1, Ordering::Relaxed);
    }
    let complete = shared_texture_fence_complete(completed_value(), fence_value)?;
    if result == WAIT_TIMEOUT {
        telemetry
            .event_timeout_count
            .fetch_add(1, Ordering::Relaxed);
        if complete {
            telemetry
                .completed_after_timeout_count
                .fetch_add(1, Ordering::Relaxed);
        }
    } else if result == WAIT_OBJECT_0 && !complete {
        *use_event_wait = false;
        telemetry.early_event_count.fetch_add(1, Ordering::Relaxed);
    }
    Ok(complete)
}

pub struct SharedTextureCopyWaitHandle {
    device: ID3D11Device,
    completion: SharedTextureCopyCompletion,
    slot: Arc<SharedTextureCopySlot>,
    submitted_at: Instant,
    telemetry: Arc<SharedTextureCopyTelemetry>,
    submission_error: Option<String>,
}

unsafe impl Send for SharedTextureCopyWaitHandle {}

enum SharedTextureCopyCompletion {
    Fence {
        fence: ID3D11Fence,
        fence_value: u64,
    },
    Query {
        context: ID3D11DeviceContext,
        query: ID3D11Query,
        context_lock: Arc<Mutex<()>>,
    },
}

impl SharedTextureCopyWaitHandle {
    pub fn wait(self) -> Result<(), String> {
        let dispatch_delay_micros = self
            .submitted_at
            .elapsed()
            .as_micros()
            .min(u64::MAX as u128) as u64;
        self.telemetry
            .last_dispatch_delay_micros
            .store(dispatch_delay_micros, Ordering::Relaxed);
        self.telemetry
            .max_dispatch_delay_micros
            .fetch_max(dispatch_delay_micros, Ordering::Relaxed);
        if let Some(error) = self.submission_error.as_ref() {
            self.telemetry
                .terminal_failure_count
                .fetch_add(1, Ordering::Release);
            return Err(error.clone());
        }
        let started = self.submitted_at;
        let mut recorded_slow_copy = false;
        let mut recorded_timeout = false;
        let mut event_registration_attempted = false;
        let mut use_event_wait =
            matches!(&self.completion, SharedTextureCopyCompletion::Fence { .. });
        loop {
            let complete = match &self.completion {
                SharedTextureCopyCompletion::Fence { fence, fence_value } => {
                    poll_shared_texture_copy_fence(
                        *fence_value,
                        &mut use_event_wait,
                        &self.telemetry.fence_wait,
                        || unsafe { fence.GetCompletedValue() },
                        || unsafe {
                            if !event_registration_attempted {
                                event_registration_attempted = true;
                                if !register_shared_texture_copy_fence_event(
                                    self.slot.event,
                                    || {
                                        fence
                                            .SetEventOnCompletion(*fence_value, self.slot.event)
                                            .is_ok()
                                    },
                                ) {
                                    return WAIT_FAILED;
                                }
                            }
                            WaitForSingleObjectEx(self.slot.event, 10, false)
                        },
                    )
                    .map_err(|error| {
                        self.telemetry
                            .terminal_failure_count
                            .fetch_add(1, Ordering::Release);
                        error
                    })?
                }
                SharedTextureCopyCompletion::Query {
                    context,
                    query,
                    context_lock,
                } => {
                    // The old immediate context is shared with rendering and
                    // DXGI Present. Poll it only while holding the same lock as
                    // every main-thread context/DXGI transaction. The copy was
                    // explicitly flushed at submission, so polling must not
                    // flush again and turn this worker into another producer.
                    let _context_guard = match context_lock.lock() {
                        Ok(guard) => guard,
                        Err(_) => {
                            self.telemetry
                                .terminal_failure_count
                                .fetch_add(1, Ordering::Release);
                            return Err(
                                "D3D11 shared-texture context lock was poisoned; the native graphics device must be restarted"
                                    .to_owned(),
                            );
                        }
                    };
                    let mut completed = 0i32;
                    let get_data = unsafe {
                        context.GetData(
                            query,
                            Some((&mut completed as *mut i32).cast()),
                            std::mem::size_of::<i32>() as u32,
                            D3D11_ASYNC_GETDATA_DONOTFLUSH.0 as u32,
                        )
                    };
                    if let Err(error) = get_data {
                        self.telemetry
                            .terminal_failure_count
                            .fetch_add(1, Ordering::Release);
                        return Err(format!(
                            "ID3D11DeviceContext::GetData for asynchronous shared texture copy failed: {error}; the native graphics device must be restarted"
                        ));
                    }
                    completed != 0
                }
            };
            if complete {
                let duration_micros = started.elapsed().as_micros().min(u64::MAX as u128) as u64;
                self.telemetry
                    .last_duration_micros
                    .store(duration_micros, Ordering::Relaxed);
                self.telemetry
                    .max_duration_micros
                    .fetch_max(duration_micros, Ordering::Relaxed);
                self.telemetry
                    .completed_count
                    .fetch_add(1, Ordering::Relaxed);
                return Ok(());
            }

            let elapsed_ms = started.elapsed().as_millis();
            if !recorded_slow_copy && elapsed_ms >= SHARED_TEXTURE_COPY_SLOW_MS {
                self.telemetry.slow_count.fetch_add(1, Ordering::Relaxed);
                recorded_slow_copy = true;
            }
            if !recorded_timeout && elapsed_ms >= SHARED_TEXTURE_COPY_TIMEOUT_MS {
                self.telemetry.timeout_count.fetch_add(1, Ordering::Relaxed);
                recorded_timeout = true;
            }
            if elapsed_ms >= SHARED_TEXTURE_COPY_FATAL_TIMEOUT_MS {
                self.telemetry
                    .fatal_timeout_count
                    .fetch_add(1, Ordering::Relaxed);
                return Err(format!(
                    "D3D11 shared-texture copy did not complete within {SHARED_TEXTURE_COPY_FATAL_TIMEOUT_MS} ms; the native graphics device must be restarted"
                ));
            }
            if let Err(error) = unsafe { self.device.GetDeviceRemovedReason() } {
                self.telemetry
                    .terminal_failure_count
                    .fetch_add(1, Ordering::Release);
                return Err(format!(
                    "D3D11 device was removed while waiting for the Electron shared-texture copy: {error}"
                ));
            }
            if matches!(&self.completion, SharedTextureCopyCompletion::Query { .. })
                || !use_event_wait
            {
                std::thread::sleep(Duration::from_millis(1));
            }
        }
    }
}

impl Drop for SharedTextureCopyWaitHandle {
    fn drop(&mut self) {
        self.slot.in_flight.store(false, Ordering::Release);
    }
}

pub enum SharedTextureImportSubmission {
    Accepted(Option<SharedTextureCopyWaitHandle>),
    Dropped,
}

pub struct FrameLatencyWaitHandle {
    handle: HANDLE,
    generation: u64,
}

// Win32 kernel handles may be waited from any process thread. This wrapper
// exclusively owns a duplicated handle, so moving it to napi-rs' blocking
// worker cannot race the renderer's original handle lifetime.
unsafe impl Send for FrameLatencyWaitHandle {}

impl FrameLatencyWaitHandle {
    pub fn generation(&self) -> u64 {
        self.generation
    }

    pub fn wait(&self, timeout_ms: u32) -> Result<bool, String> {
        let wait_result = unsafe { WaitForSingleObjectEx(self.handle, timeout_ms, false) };
        if wait_result == WAIT_FAILED {
            return Err(
                "WaitForSingleObjectEx for duplicated DXGI frame latency handle failed".to_owned(),
            );
        }
        if wait_result == WAIT_OBJECT_0 {
            return Ok(true);
        }
        if wait_result == WAIT_TIMEOUT {
            return Ok(false);
        }
        Err("WaitForSingleObjectEx for duplicated DXGI frame latency handle returned an unexpected result".to_owned())
    }
}

impl Drop for FrameLatencyWaitHandle {
    fn drop(&mut self) {
        if !self.handle.is_invalid() {
            unsafe {
                let _ = CloseHandle(self.handle);
            }
            self.handle = HANDLE::default();
        }
    }
}

pub fn is_device_lost_error(error: &str) -> bool {
    // DXGI_ERROR_DEVICE_REMOVED, DXGI_ERROR_DEVICE_HUNG, and
    // DXGI_ERROR_DEVICE_RESET all require rebuilding the D3D device and its
    // swap chain. Match the HRESULT instead of localized Windows error text.
    ["0X887A0005", "0X887A0006", "0X887A0007"]
        .iter()
        .any(|code| error.to_ascii_uppercase().contains(code))
}

pub fn is_shared_texture_adapter_open_error(error: &str) -> bool {
    // A shared handle that cannot be opened by the current D3D11 device can
    // legitimately belong to another adapter. Validation, copy-query, and
    // timeout failures happen after the handle was opened and must never be
    // mistaken for an adapter mismatch: rebuilding the HWND swap chain from
    // inside one of those transient failures can race Steam's overlay hook.
    error.contains("ID3D11Device1::OpenSharedResource1 failed:")
}

pub fn present_sync_interval_for_frame_rate(
    display_refresh_rate: Option<u32>,
    target_frame_rate: Option<f64>,
) -> u32 {
    let (Some(display_refresh_rate), Some(target_frame_rate)) =
        (display_refresh_rate, target_frame_rate)
    else {
        return 1;
    };
    if display_refresh_rate < 2 || !target_frame_rate.is_finite() || target_frame_rate <= 0.0 {
        return 1;
    }

    for sync_interval in 1..=4 {
        let synchronized_frame_rate = display_refresh_rate as f64 / sync_interval as f64;
        let relative_error =
            (synchronized_frame_rate - target_frame_rate).abs() / synchronized_frame_rate;
        if relative_error <= 0.02 {
            return sync_interval;
        }
    }
    1
}

const FRAME_STATISTICS_MAX_DELTA_PER_PRESENT: u32 = 10_000;
const FRAME_STATISTICS_WRAP_HIGH_WATERMARK: u32 = 0xF000_0000;
const FRAME_STATISTICS_WRAP_LOW_WATERMARK: u32 = 0x0FFF_FFFF;

fn frame_statistics_counter_delta(current: u32, previous: u32) -> Option<u32> {
    let delta = if current >= previous {
        current - previous
    } else if previous >= FRAME_STATISTICS_WRAP_HIGH_WATERMARK
        && current <= FRAME_STATISTICS_WRAP_LOW_WATERMARK
    {
        current.wrapping_sub(previous)
    } else {
        return None;
    };
    (delta <= FRAME_STATISTICS_MAX_DELTA_PER_PRESENT).then_some(delta)
}

const VERTEX_SHADER: &[u8] = br#"
struct VertexOutput {
    float4 position : SV_POSITION;
    float2 uv : TEXCOORD0;
};

VertexOutput main(uint vertexId : SV_VertexID) {
    float2 uv = float2((vertexId << 1) & 2, vertexId & 2);
    VertexOutput output;
    output.position = float4(uv * float2(2.0, -2.0) + float2(-1.0, 1.0), 0.0, 1.0);
    output.uv = uv;
    return output;
}
"#;

const PIXEL_SHADER: &[u8] = br#"
Texture2D sourceTexture : register(t0);
SamplerState sourceSampler : register(s0);

float4 main(float4 position : SV_POSITION, float2 uv : TEXCOORD0) : SV_TARGET {
    return sourceTexture.Sample(sourceSampler, uv);
}
"#;

#[derive(Clone, Copy, PartialEq, Eq)]
enum SourceMode {
    Cpu,
    SharedTexture,
}

impl SourceMode {
    fn as_str(self) -> &'static str {
        match self {
            Self::Cpu => "cpu-bgra",
            Self::SharedTexture => "electron-shared-texture",
        }
    }
}

pub const FRAME_LATENCY_WAIT_BYPASS_TIMEOUTS: u32 = 3;
pub const FRAME_LATENCY_WAIT_REARM_READY_POLLS: u32 = 4;
const GPU_COPY_TIMING_SAMPLE_INTERVAL: u64 = 30;
const GPU_COPY_TIMING_RING_SIZE: usize = 4;
const GPU_COPY_TIMING_ABANDON_SKIPS: u32 = 2;

struct GpuCopyTimingEntry {
    disjoint: ID3D11Query,
    start: ID3D11Query,
    end: ID3D11Query,
}

#[derive(Default)]
struct GpuCopyTimingRing {
    pending: [bool; GPU_COPY_TIMING_RING_SIZE],
    skipped: [u32; GPU_COPY_TIMING_RING_SIZE],
    next: usize,
    abandoned_count: u64,
}

impl GpuCopyTimingRing {
    fn claim(&mut self) -> Option<usize> {
        let index = self.next;
        self.next = (index + 1) % GPU_COPY_TIMING_RING_SIZE;
        if self.pending[index] {
            self.skipped[index] = self.skipped[index].saturating_add(1);
            if self.skipped[index] < GPU_COPY_TIMING_ABANDON_SKIPS {
                return None;
            }
            self.abandoned_count = self.abandoned_count.saturating_add(1);
        }
        self.skipped[index] = 0;
        Some(index)
    }

    fn issued(&mut self, index: usize) {
        self.pending[index] = true;
    }

    fn resolved(&mut self, index: usize) {
        self.pending[index] = false;
    }
}

#[derive(Default)]
struct GpuCopyTimingStats {
    sample_count: u64,
    total_micros: f64,
    last_micros: f64,
    max_micros: f64,
    disjoint_count: u64,
}

struct GpuCopyTiming {
    entries: Vec<GpuCopyTimingEntry>,
    ring: GpuCopyTimingRing,
    copy_count: u64,
    stats: GpuCopyTimingStats,
}

impl GpuCopyTiming {
    unsafe fn new(device: &ID3D11Device) -> Option<Self> {
        let create = |query| {
            let mut created = None;
            device
                .CreateQuery(
                    &D3D11_QUERY_DESC {
                        Query: query,
                        MiscFlags: 0,
                    },
                    Some(&mut created),
                )
                .ok()?;
            created
        };
        let mut entries = Vec::with_capacity(GPU_COPY_TIMING_RING_SIZE);
        for _ in 0..GPU_COPY_TIMING_RING_SIZE {
            entries.push(GpuCopyTimingEntry {
                disjoint: create(D3D11_QUERY_TIMESTAMP_DISJOINT)?,
                start: create(D3D11_QUERY_TIMESTAMP)?,
                end: create(D3D11_QUERY_TIMESTAMP)?,
            });
        }
        Some(Self {
            entries,
            ring: GpuCopyTimingRing::default(),
            copy_count: 0,
            stats: GpuCopyTimingStats::default(),
        })
    }

    unsafe fn begin(&mut self, context: &ID3D11DeviceContext) -> Option<usize> {
        self.poll(context);
        self.copy_count = self.copy_count.saturating_add(1);
        if (self.copy_count - 1) % GPU_COPY_TIMING_SAMPLE_INTERVAL != 0 {
            return None;
        }
        let index = self.ring.claim()?;
        let entry = &self.entries[index];
        context.Begin(&entry.disjoint);
        context.End(&entry.start);
        Some(index)
    }

    unsafe fn end(&mut self, context: &ID3D11DeviceContext, index: Option<usize>) {
        let Some(index) = index else {
            return;
        };
        let entry = &self.entries[index];
        context.End(&entry.end);
        context.End(&entry.disjoint);
        self.ring.issued(index);
    }

    unsafe fn poll(&mut self, context: &ID3D11DeviceContext) {
        for (index, entry) in self.entries.iter().enumerate() {
            if !self.ring.pending[index] {
                continue;
            }
            let mut disjoint = D3D11_QUERY_DATA_TIMESTAMP_DISJOINT::default();
            let ready = context
                .GetData(
                    &entry.disjoint,
                    Some((&mut disjoint as *mut D3D11_QUERY_DATA_TIMESTAMP_DISJOINT).cast()),
                    std::mem::size_of::<D3D11_QUERY_DATA_TIMESTAMP_DISJOINT>() as u32,
                    D3D11_ASYNC_GETDATA_DONOTFLUSH.0 as u32,
                )
                .is_ok()
                && disjoint.Frequency != 0;
            if !ready {
                continue;
            }
            let mut start = u64::MAX;
            let mut end = u64::MAX;
            let start_ready = context
                .GetData(
                    &entry.start,
                    Some((&mut start as *mut u64).cast()),
                    std::mem::size_of::<u64>() as u32,
                    D3D11_ASYNC_GETDATA_DONOTFLUSH.0 as u32,
                )
                .is_ok();
            let end_ready = context
                .GetData(
                    &entry.end,
                    Some((&mut end as *mut u64).cast()),
                    std::mem::size_of::<u64>() as u32,
                    D3D11_ASYNC_GETDATA_DONOTFLUSH.0 as u32,
                )
                .is_ok();
            if !start_ready || !end_ready || start == u64::MAX || end == u64::MAX {
                continue;
            }
            self.ring.resolved(index);
            self.stats.record(start, end, disjoint);
        }
    }

    fn diagnostics(&self) -> serde_json::Value {
        let mut diagnostics = self.stats.diagnostics(GPU_COPY_TIMING_SAMPLE_INTERVAL);
        diagnostics["abandonedCount"] = self.ring.abandoned_count.into();
        diagnostics
    }
}

impl GpuCopyTimingStats {
    fn record(&mut self, start: u64, end: u64, disjoint: D3D11_QUERY_DATA_TIMESTAMP_DISJOINT) {
        if disjoint.Disjoint.as_bool() || end < start || disjoint.Frequency == 0 {
            self.disjoint_count = self.disjoint_count.saturating_add(1);
            return;
        }
        let micros = (end - start) as f64 * 1_000_000.0 / disjoint.Frequency as f64;
        self.sample_count = self.sample_count.saturating_add(1);
        self.total_micros += micros;
        self.last_micros = micros;
        self.max_micros = self.max_micros.max(micros);
    }

    fn diagnostics(&self, sample_interval: u64) -> serde_json::Value {
        serde_json::json!({
            "sampleInterval": sample_interval,
            "sampleCount": self.sample_count,
            "lastMs": self.last_micros / 1_000.0,
            "meanMs": if self.sample_count > 0 {
                self.total_micros / self.sample_count as f64 / 1_000.0
            } else {
                0.0
            },
            "maxMs": self.max_micros / 1_000.0,
            "disjointCount": self.disjoint_count,
        })
    }
}

const DEDICATED_COPY_RING_SIZE: usize = 4;
const DEDICATED_COPY_CREATION_ATTEMPTS: u64 = 3;
static DEDICATED_COPY_DEVICE_REQUESTED: AtomicBool = AtomicBool::new(false);

pub fn set_dedicated_copy_device_requested(enabled: bool) {
    DEDICATED_COPY_DEVICE_REQUESTED.store(enabled, Ordering::Release);
}

fn swap_chain_attach_failure_error(attach_error: &str, restore_error: &str) -> String {
    format!(
        "D3D11 swap chain could not be attached after an adapter switch ({attach_error}; restoring the previous adapter also failed: {restore_error}); the native graphics device must be restarted"
    )
}

fn stalled_shared_texture_copy_error(
    host_removed: Option<&windows::core::Error>,
    copy_removed: Option<&windows::core::Error>,
) -> String {
    if let Some(error) = host_removed {
        return format!(
            "D3D11 device was removed while a shared-texture copy was outstanding: {error}; the native graphics device must be restarted"
        );
    }
    if let Some(error) = copy_removed {
        return dedicated_copy_device_removed_error(error);
    }
    "D3D11 shared-texture copy completion previously stalled; the native graphics device must be restarted"
        .to_owned()
}

fn present_submitted_frame(result: windows::core::HRESULT) -> bool {
    result.is_ok() && result != DXGI_STATUS_OCCLUDED
}

fn dedicated_copy_device_removed_error(error: &windows::core::Error) -> String {
    format!(
        "D3D11 dedicated copy device was removed: {error}; the native graphics device must be restarted"
    )
}

struct DedicatedCopySlot {
    host_view: ID3D11ShaderResourceView,
    copy_texture: ID3D11Texture2D,
    last_sampled_value: u64,
}

struct DedicatedCopyDevice {
    device: ID3D11Device,
    device1: ID3D11Device1,
    context: ID3D11DeviceContext,
    context4: ID3D11DeviceContext4,
    copy_fence: ID3D11Fence,
    host_copy_fence: ID3D11Fence,
    next_copy_value: u64,
    sampled_fence: ID3D11Fence,
    copy_sampled_fence: ID3D11Fence,
    next_sampled_value: u64,
    ring: Vec<DedicatedCopySlot>,
    ring_width: u32,
    ring_height: u32,
    ring_format: DXGI_FORMAT,
    next_ring_index: usize,
    pending: Option<(usize, u64)>,
    displayed: Option<usize>,
    newest: Option<usize>,
    gpu_timing: Option<GpuCopyTiming>,
}

unsafe fn share_fence(fence: &ID3D11Fence, device5: &ID3D11Device5) -> Result<ID3D11Fence, String> {
    let handle = fence
        .CreateSharedHandle(None, GENERIC_ALL.0, windows::core::PCWSTR::null())
        .map_err(|error| format!("ID3D11Fence::CreateSharedHandle failed: {error}"))?;
    let mut opened: Option<ID3D11Fence> = None;
    let result = device5.OpenSharedFence(handle, &mut opened);
    let _ = CloseHandle(handle);
    result.map_err(|error| format!("ID3D11Device5::OpenSharedFence failed: {error}"))?;
    opened.ok_or_else(|| "ID3D11Device5::OpenSharedFence returned no fence".to_owned())
}

impl DedicatedCopyDevice {
    unsafe fn new(host_device: &ID3D11Device) -> Result<Self, String> {
        let adapter = host_device
            .cast::<IDXGIDevice>()
            .and_then(|device| device.GetAdapter())
            .map_err(|error| format!("host DXGI adapter is unavailable: {error}"))?;
        let mut device = None;
        let mut context = None;
        D3D11CreateDevice(
            &adapter,
            D3D_DRIVER_TYPE_UNKNOWN,
            HMODULE::default(),
            D3D11_CREATE_DEVICE_BGRA_SUPPORT,
            Some(&[D3D_FEATURE_LEVEL_11_1, D3D_FEATURE_LEVEL_11_0]),
            D3D11_SDK_VERSION,
            Some(&mut device),
            None,
            Some(&mut context),
        )
        .map_err(|error| {
            format!("D3D11CreateDevice for the dedicated copy device failed: {error}")
        })?;
        let device: ID3D11Device = device
            .ok_or_else(|| "D3D11CreateDevice returned no dedicated copy device".to_owned())?;
        let context: ID3D11DeviceContext = context
            .ok_or_else(|| "D3D11CreateDevice returned no dedicated copy context".to_owned())?;
        let device1: ID3D11Device1 = device
            .cast()
            .map_err(|error| format!("dedicated ID3D11Device1 is unavailable: {error}"))?;
        let device5: ID3D11Device5 = device
            .cast()
            .map_err(|error| format!("dedicated ID3D11Device5 is unavailable: {error}"))?;
        let context4: ID3D11DeviceContext4 = context
            .cast()
            .map_err(|error| format!("dedicated ID3D11DeviceContext4 is unavailable: {error}"))?;
        let host_device5: ID3D11Device5 = host_device
            .cast()
            .map_err(|error| format!("host ID3D11Device5 is unavailable: {error}"))?;
        let mut copy_fence = None;
        device5
            .CreateFence(0, D3D11_FENCE_FLAG_SHARED, &mut copy_fence)
            .map_err(|error| format!("dedicated copy fence creation failed: {error}"))?;
        let copy_fence: ID3D11Fence =
            copy_fence.ok_or_else(|| "dedicated copy fence was not created".to_owned())?;
        let host_copy_fence = share_fence(&copy_fence, &host_device5)?;
        let mut sampled_fence = None;
        host_device5
            .CreateFence(0, D3D11_FENCE_FLAG_SHARED, &mut sampled_fence)
            .map_err(|error| format!("host sampled fence creation failed: {error}"))?;
        let sampled_fence: ID3D11Fence =
            sampled_fence.ok_or_else(|| "host sampled fence was not created".to_owned())?;
        let copy_sampled_fence = share_fence(&sampled_fence, &device5)?;
        let gpu_timing = GpuCopyTiming::new(&device);
        Ok(Self {
            device,
            device1,
            context,
            context4,
            copy_fence,
            host_copy_fence,
            next_copy_value: 0,
            sampled_fence,
            copy_sampled_fence,
            next_sampled_value: 0,
            ring: Vec::with_capacity(DEDICATED_COPY_RING_SIZE),
            ring_width: 0,
            ring_height: 0,
            ring_format: DXGI_FORMAT_UNKNOWN,
            next_ring_index: 0,
            pending: None,
            displayed: None,
            newest: None,
            gpu_timing,
        })
    }

    unsafe fn ensure_ring(
        &mut self,
        host_device: &ID3D11Device,
        width: u32,
        height: u32,
        format: DXGI_FORMAT,
    ) -> Result<bool, String> {
        if !self.ring.is_empty()
            && self.ring_width == width
            && self.ring_height == height
            && self.ring_format == format
        {
            return Ok(false);
        }
        let desc = D3D11_TEXTURE2D_DESC {
            Width: width,
            Height: height,
            MipLevels: 1,
            ArraySize: 1,
            Format: format,
            SampleDesc: DXGI_SAMPLE_DESC {
                Count: 1,
                Quality: 0,
            },
            Usage: D3D11_USAGE_DEFAULT,
            BindFlags: (D3D11_BIND_SHADER_RESOURCE | D3D11_BIND_RENDER_TARGET).0 as u32,
            CPUAccessFlags: 0,
            MiscFlags: (D3D11_RESOURCE_MISC_SHARED_NTHANDLE | D3D11_RESOURCE_MISC_SHARED).0 as u32,
        };
        let mut ring = Vec::with_capacity(DEDICATED_COPY_RING_SIZE);
        for _ in 0..DEDICATED_COPY_RING_SIZE {
            let mut texture = None;
            host_device
                .CreateTexture2D(&desc, None, Some(&mut texture))
                .map_err(|error| format!("dedicated copy ring texture creation failed: {error}"))?;
            let texture: ID3D11Texture2D =
                texture.ok_or_else(|| "dedicated copy ring texture was not created".to_owned())?;
            let host_view = create_source_view(host_device, &texture)?;
            let handle = texture
                .cast::<IDXGIResource1>()
                .and_then(|resource| {
                    resource.CreateSharedHandle(
                        None,
                        DXGI_SHARED_RESOURCE_READ.0 | DXGI_SHARED_RESOURCE_WRITE.0,
                        windows::core::PCWSTR::null(),
                    )
                })
                .map_err(|error| {
                    format!("dedicated copy ring CreateSharedHandle failed: {error}")
                })?;
            let copy_texture = self.device1.OpenSharedResource1(handle);
            let _ = CloseHandle(handle);
            ring.push(DedicatedCopySlot {
                host_view,
                copy_texture: copy_texture
                    .map_err(|error| format!("dedicated copy ring open failed: {error}"))?,
                last_sampled_value: 0,
            });
        }
        self.ring = ring;
        self.ring_width = width;
        self.ring_height = height;
        self.ring_format = format;
        self.next_ring_index = 0;
        self.pending = None;
        self.displayed = None;
        self.newest = None;
        Ok(true)
    }

    fn select_ring_slot(&mut self) -> usize {
        let len = self.ring.len();
        let mut index = self.next_ring_index;
        for _ in 0..len {
            let reserved = self.displayed == Some(index)
                || self.pending.is_some_and(|(slot, _)| slot == index)
                || self.newest == Some(index);
            if !reserved {
                break;
            }
            index = (index + 1) % len;
        }
        self.next_ring_index = (index + 1) % len;
        index
    }
}

fn adapter_for_monitor<M: PartialEq>(
    monitor: &M,
    outputs: impl IntoIterator<Item = (LUID, M)>,
) -> Option<LUID> {
    outputs
        .into_iter()
        .find(|(_, output_monitor)| output_monitor == monitor)
        .map(|(luid, _)| luid)
}

unsafe fn output_adapter_luid_for_window(hwnd: HWND) -> Option<LUID> {
    if hwnd.0.is_null() {
        return None;
    }
    let monitor = MonitorFromWindow(hwnd, MONITOR_DEFAULTTONEAREST);
    if monitor.is_invalid() {
        return None;
    }
    let factory: IDXGIFactory2 = CreateDXGIFactory2(DXGI_CREATE_FACTORY_FLAGS(0)).ok()?;
    let mut outputs = Vec::new();
    let mut adapter_index = 0;
    while let Ok(adapter) = factory.EnumAdapters1(adapter_index) {
        adapter_index += 1;
        let Ok(adapter_desc) = adapter.GetDesc1() else {
            continue;
        };
        let mut output_index = 0;
        while let Ok(output) = adapter.EnumOutputs(output_index) {
            output_index += 1;
            if let Ok(output_desc) = output.GetDesc() {
                outputs.push((adapter_desc.AdapterLuid, output_desc.Monitor));
            }
        }
    }
    adapter_for_monitor(&monitor, outputs)
}

fn adapter_luid_string(luid: LUID) -> String {
    format!("{:08x}-{:08x}", luid.HighPart as u32, luid.LowPart)
}

fn device_adapter_luid(device: &ID3D11Device) -> Option<LUID> {
    unsafe {
        let adapter = device.cast::<IDXGIDevice>().ok()?.GetAdapter().ok()?;
        Some(adapter.GetDesc().ok()?.AdapterLuid)
    }
}

fn shared_resource_adapter_luid(handle: usize) -> Option<LUID> {
    unsafe {
        let factory: IDXGIFactory4 = CreateDXGIFactory2(DXGI_CREATE_FACTORY_FLAGS(0)).ok()?;
        factory
            .GetSharedResourceAdapterLuid(HANDLE(handle as *mut c_void))
            .ok()
    }
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum FrameLatencyTimeoutOutcome {
    Expected,
    Counted,
    Bypassed,
}

#[derive(Debug, Default)]
struct FrameLatencyWaitGate {
    bypassed: bool,
    consecutive_timeouts: u32,
    consecutive_bypass_ready_polls: u32,
    expected_timeout_count: u64,
    bypass_count: u64,
    rearm_count: u64,
}

impl FrameLatencyWaitGate {
    fn record_timeout(&mut self, expected: bool) -> FrameLatencyTimeoutOutcome {
        if self.bypassed {
            return FrameLatencyTimeoutOutcome::Bypassed;
        }
        if expected {
            self.consecutive_timeouts = 0;
            self.expected_timeout_count = self.expected_timeout_count.saturating_add(1);
            return FrameLatencyTimeoutOutcome::Expected;
        }
        self.consecutive_timeouts = self.consecutive_timeouts.saturating_add(1);
        if self.consecutive_timeouts >= FRAME_LATENCY_WAIT_BYPASS_TIMEOUTS {
            self.bypass();
            FrameLatencyTimeoutOutcome::Bypassed
        } else {
            FrameLatencyTimeoutOutcome::Counted
        }
    }

    fn record_ready(&mut self) {
        self.consecutive_timeouts = 0;
    }

    fn record_bypass_poll(&mut self, ready: bool) -> bool {
        if !self.bypassed {
            return false;
        }
        if !ready {
            self.consecutive_bypass_ready_polls = 0;
            return false;
        }
        self.consecutive_bypass_ready_polls = self.consecutive_bypass_ready_polls.saturating_add(1);
        self.consecutive_bypass_ready_polls >= FRAME_LATENCY_WAIT_REARM_READY_POLLS && self.rearm()
    }

    fn bypass(&mut self) -> bool {
        self.consecutive_timeouts = 0;
        self.consecutive_bypass_ready_polls = 0;
        if self.bypassed {
            return false;
        }
        self.bypassed = true;
        self.bypass_count = self.bypass_count.saturating_add(1);
        true
    }

    fn rearm(&mut self) -> bool {
        self.consecutive_timeouts = 0;
        self.consecutive_bypass_ready_polls = 0;
        if !self.bypassed {
            return false;
        }
        self.bypassed = false;
        self.rearm_count = self.rearm_count.saturating_add(1);
        true
    }

    fn reset_for_new_swap_chain(&mut self) {
        self.bypassed = false;
        self.consecutive_timeouts = 0;
        self.consecutive_bypass_ready_polls = 0;
    }
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
enum PresentMode {
    Standard,
    NonblockingVsync,
    NonblockingImmediate,
}

impl PresentMode {
    fn from_qa_environment(enabled: bool, value: Option<&str>) -> Self {
        match (enabled, value) {
            (false, _) | (true, None) => Self::NonblockingVsync,
            (true, Some("nonblocking-vsync")) => Self::NonblockingVsync,
            (true, Some("nonblocking-immediate")) => Self::NonblockingImmediate,
            _ => Self::Standard,
        }
    }

    fn as_str(self) -> &'static str {
        match self {
            Self::Standard => "standard",
            Self::NonblockingVsync => "nonblocking-vsync",
            Self::NonblockingImmediate => "nonblocking-immediate",
        }
    }

    fn parameters(self, sync_interval: u32, bypassed: bool) -> (u32, DXGI_PRESENT) {
        if bypassed || self == Self::NonblockingImmediate {
            (0, DXGI_PRESENT_DO_NOT_WAIT)
        } else if self == Self::NonblockingVsync {
            (sync_interval, DXGI_PRESENT_DO_NOT_WAIT)
        } else {
            (sync_interval, DXGI_PRESENT(0))
        }
    }

    fn needs_frame_timer_resolution(self, bypassed: bool, busy: bool) -> bool {
        bypassed || busy || self == Self::NonblockingImmediate
    }
}

pub struct WindowsD3d11Renderer {
    device: ID3D11Device,
    context: ID3D11DeviceContext,
    swap_chain: Option<IDXGISwapChain1>,
    render_target: Option<ID3D11RenderTargetView>,
    vertex_shader: ID3D11VertexShader,
    pixel_shader: ID3D11PixelShader,
    sampler: Option<ID3D11SamplerState>,
    source_texture: Option<ID3D11Texture2D>,
    source_view: Option<ID3D11ShaderResourceView>,
    source_mode: Option<SourceMode>,
    source_width: u32,
    source_height: u32,
    source_format: DXGI_FORMAT,
    source_sample_count: u32,
    source_sample_quality: u32,
    width: u32,
    height: u32,
    feature_level: D3D_FEATURE_LEVEL,
    adapter_name: String,
    last_present: i32,
    present_sync_interval: u32,
    present_mode: PresentMode,
    present_budget_ms: Option<f64>,
    present_over_budget_count: u64,
    present_busy_count: u64,
    present_retry_pending: bool,
    last_present_flags: u32,
    frame_latency_waitable_object: HANDLE,
    frame_latency_wait_generation: u64,
    frame_latency_ready_permits: u32,
    frame_latency_wait: FrameLatencyWaitGate,
    present_occluded: bool,
    fallback_timer_resolution_requested: bool,
    fallback_timer_resolution_active: bool,
    async_frame_latency_ready_count: u64,
    frame_latency_wait_timeout_count: u64,
    frame_latency_not_ready_count: u64,
    last_render_started_at: Option<Instant>,
    last_render_interval_ms: f64,
    max_render_interval_ms: f64,
    render_interval_over_25_ms_count: u64,
    render_interval_over_50_ms_count: u64,
    render_interval_over_100_ms_count: u64,
    last_frame_latency_wait_duration_ms: f64,
    max_frame_latency_wait_duration_ms: f64,
    frame_latency_wait_over_25_ms_count: u64,
    last_present_duration_ms: f64,
    max_present_duration_ms: f64,
    present_over_25_ms_count: u64,
    last_render_duration_ms: f64,
    max_render_duration_ms: f64,
    render_over_25_ms_count: u64,
    frame_statistics_available: bool,
    last_frame_statistics_present_count: Option<u32>,
    last_frame_statistics_refresh_count: Option<u32>,
    last_frame_statistics_present_delta: u32,
    last_frame_statistics_refresh_delta: u32,
    repeated_refresh_count: u64,
    max_repeated_refreshes_per_sample: u32,
    // Legacy D3D11 event-query completion is polled from the dedicated copy
    // worker. Serialize that immediate-context access with every renderer and
    // DXGI transaction so old drivers never see concurrent context/Present
    // calls. Modern fence waits do not touch the context after submission, so
    // fence-capable renderers do not allocate or acquire this lock.
    shared_texture_context_lock: Option<Arc<Mutex<()>>>,
    shared_texture_copy_query: ID3D11Query,
    shared_texture_copy_fence: Option<ID3D11Fence>,
    shared_texture_copy_context4: Option<ID3D11DeviceContext4>,
    shared_texture_copy_slots: Vec<Arc<SharedTextureCopySlot>>,
    next_shared_texture_copy_fence_value: u64,
    shared_texture_copy_telemetry: Arc<SharedTextureCopyTelemetry>,
    shared_texture_copy_saturation_drop_count: u64,
    max_shared_texture_copies_in_flight: u64,
    shared_texture_full_copy_count: u64,
    shared_texture_partial_copy_count: u64,
    shared_texture_storage_recreate_count: u64,
    last_shared_texture_content_rect: [u32; 4],
    last_shared_texture_presentation_rect: [u32; 4],
    cpu_upload_count: u64,
    shared_texture_import_count: u64,
    gpu_copy_timing: Option<GpuCopyTiming>,
    host_adapter_luid: Option<LUID>,
    texture_adapter_luid: Option<LUID>,
    window: HWND,
    swap_chain_attach_failure: Option<String>,
    dedicated_copy: Option<DedicatedCopyDevice>,
    dedicated_copy_requested: bool,
    dedicated_copy_creation_failures: u64,
    dedicated_copy_last_error: Option<String>,
    dedicated_copy_count: u64,
}

unsafe impl Send for WindowsD3d11Renderer {}

impl WindowsD3d11Renderer {
    pub unsafe fn new(hwnd: *mut c_void, width: u32, height: u32) -> Result<Self, String> {
        let mut candidates = Vec::new();
        let mut adapter_luids = Vec::new();
        if let Some(adapter) = preferred_high_performance_adapter() {
            push_hardware_adapter_candidate(&mut candidates, &mut adapter_luids, adapter);
        }
        for adapter in adapters_in_enum_order() {
            push_hardware_adapter_candidate(&mut candidates, &mut adapter_luids, adapter);
        }
        candidates.push(("default hardware adapter".to_owned(), None));

        try_candidates_in_order(candidates, |adapter| {
            Self::new_with_adapter(hwnd, width, height, adapter, true)
        })
        .map_err(|failures| {
            format!(
                "D3D11 renderer creation failed on every hardware adapter ({})",
                failures.join("; ")
            )
        })
    }

    pub unsafe fn new_for_shared_texture(
        hwnd: *mut c_void,
        width: u32,
        height: u32,
        handle: usize,
        source_width: u32,
        source_height: u32,
        content_rect: (u32, u32, u32, u32),
        presentation_rect: (u32, u32, u32, u32),
    ) -> Result<Self, String> {
        let mut failures = Vec::new();
        if let Ok(adapter) = adapter_for_shared_resource(handle) {
            let label =
                adapter_name(&adapter).unwrap_or_else(|_| "matched DXGI adapter".to_owned());
            match Self::new_with_adapter(hwnd, width, height, Some(adapter), false) {
                Ok(mut renderer) => {
                    match renderer.import_shared_texture(
                        handle,
                        source_width,
                        source_height,
                        content_rect,
                        presentation_rect,
                    ) {
                        Ok(()) => return Ok(renderer),
                        Err(error) => failures.push(format!("{label}: {error}")),
                    }
                }
                Err(error) => failures.push(format!("{label}: renderer creation failed: {error}")),
            }
        }

        let adapters = adapters_in_enum_order();
        for adapter in adapters {
            let label =
                adapter_name(&adapter).unwrap_or_else(|_| "unnamed DXGI adapter".to_owned());
            match Self::new_with_adapter(hwnd, width, height, Some(adapter), false) {
                Ok(mut renderer) => {
                    match renderer.import_shared_texture(
                        handle,
                        source_width,
                        source_height,
                        content_rect,
                        presentation_rect,
                    ) {
                        Ok(()) => return Ok(renderer),
                        Err(error) => failures.push(format!("{label}: {error}")),
                    }
                }
                Err(error) => failures.push(format!("{label}: renderer creation failed: {error}")),
            }
        }

        if failures.is_empty() {
            match Self::new_with_adapter(hwnd, width, height, None, false) {
                Ok(mut renderer) => {
                    renderer.import_shared_texture(
                        handle,
                        source_width,
                        source_height,
                        content_rect,
                        presentation_rect,
                    )?;
                    return Ok(renderer);
                }
                Err(error) => failures.push(format!("default DXGI adapter: {error}")),
            }
        }

        Err(format!(
            "No DXGI adapter could open the Electron shared texture ({})",
            failures.join("; ")
        ))
    }

    unsafe fn new_with_adapter(
        hwnd: *mut c_void,
        width: u32,
        height: u32,
        preferred_adapter: Option<IDXGIAdapter1>,
        attach_swap_chain: bool,
    ) -> Result<Self, String> {
        let feature_levels = [
            D3D_FEATURE_LEVEL_11_1,
            D3D_FEATURE_LEVEL_11_0,
            D3D_FEATURE_LEVEL_10_1,
            D3D_FEATURE_LEVEL_10_0,
        ];
        let mut device = None;
        let mut context = None;
        let mut feature_level = D3D_FEATURE_LEVEL_10_0;
        let adapter_name = preferred_adapter
            .as_ref()
            .and_then(|adapter| adapter_name(adapter).ok())
            .unwrap_or_else(|| "default DXGI adapter".to_owned());
        let adapter = preferred_adapter
            .as_ref()
            .and_then(|adapter| adapter.cast::<IDXGIAdapter>().ok());
        D3D11CreateDevice(
            adapter.as_ref(),
            if adapter.is_some() {
                D3D_DRIVER_TYPE_UNKNOWN
            } else {
                D3D_DRIVER_TYPE_HARDWARE
            },
            HMODULE::default(),
            D3D11_CREATE_DEVICE_BGRA_SUPPORT,
            Some(&feature_levels),
            D3D11_SDK_VERSION,
            Some(&mut device),
            Some(&mut feature_level),
            Some(&mut context),
        )
        .map_err(|error| format!("D3D11CreateDevice failed: {error}"))?;
        let device = device.ok_or_else(|| "D3D11CreateDevice returned no device".to_owned())?;
        let context = context.ok_or_else(|| "D3D11CreateDevice returned no context".to_owned())?;

        // Electron owns and pools the shared texture handles supplied to the
        // paint callback. A D3D11 copy only queues GPU work, so completion must
        // be proven before the callback releases its producer texture. Modern
        // Windows uses a fence plus a fixed pool of reusable kernel events.
        // Older drivers receive a matching pool of event queries, polled from
        // the dedicated completion worker under a context/DXGI serialization
        // lock. Both paths keep Electron's main thread out of the GPU wait.
        let query_desc = D3D11_QUERY_DESC {
            Query: D3D11_QUERY_EVENT,
            MiscFlags: 0,
        };
        let mut shared_texture_copy_query = None;
        device
            .CreateQuery(&query_desc, Some(&mut shared_texture_copy_query))
            .map_err(|error| {
                format!("ID3D11Device::CreateQuery for shared texture copies failed: {error}")
            })?;
        let shared_texture_copy_query = shared_texture_copy_query
            .ok_or_else(|| "CreateQuery for shared texture copies returned no query".to_owned())?;
        let force_query_completion =
            std::env::var_os("STEAM_BRIDGE_QA_FORCE_D3D11_QUERY_COMPLETION")
                .is_some_and(|value| value == "1");
        let shared_texture_copy_fence_support = if force_query_completion {
            None
        } else {
            (|| -> Result<_, String> {
                let device5: ID3D11Device5 = device
                    .cast()
                    .map_err(|error| format!("ID3D11Device5 is unavailable: {error}"))?;
                let context4: ID3D11DeviceContext4 = context
                    .cast()
                    .map_err(|error| format!("ID3D11DeviceContext4 is unavailable: {error}"))?;
                let mut fence = None;
                device5
                    .CreateFence(0, D3D11_FENCE_FLAG_NONE, &mut fence)
                    .map_err(|error| format!("ID3D11Device5::CreateFence failed: {error}"))?;
                let fence = fence.ok_or_else(|| "CreateFence returned no fence".to_owned())?;
                let mut slots = Vec::with_capacity(SHARED_TEXTURE_COPY_SLOT_COUNT);
                for _ in 0..SHARED_TEXTURE_COPY_SLOT_COUNT {
                    let event = CreateEventW(None, false, false, None).map_err(|error| {
                        format!("CreateEventW for shared-texture fence failed: {error}")
                    })?;
                    slots.push(Arc::new(SharedTextureCopySlot {
                        event,
                        query: None,
                        in_flight: AtomicBool::new(false),
                    }));
                }
                Ok((fence, context4, slots))
            })()
            .ok()
        };
        let (shared_texture_copy_fence, shared_texture_copy_context4, shared_texture_copy_slots) =
            match shared_texture_copy_fence_support {
                Some((fence, context4, slots)) => (Some(fence), Some(context4), slots),
                None => {
                    let legacy_query_slots = (|| -> Result<Vec<_>, String> {
                        let mut slots = Vec::with_capacity(SHARED_TEXTURE_COPY_SLOT_COUNT);
                        for _ in 0..SHARED_TEXTURE_COPY_SLOT_COUNT {
                            let mut query = None;
                            device.CreateQuery(&query_desc, Some(&mut query)).map_err(|error| {
                                format!(
                                    "ID3D11Device::CreateQuery for asynchronous shared texture copies failed: {error}"
                                )
                            })?;
                            slots.push(Arc::new(SharedTextureCopySlot {
                                event: HANDLE::default(),
                                query: Some(query.ok_or_else(|| {
                                    "CreateQuery for asynchronous shared texture copies returned no query"
                                        .to_owned()
                                })?),
                                in_flight: AtomicBool::new(false),
                            }));
                        }
                        Ok(slots)
                    })()
                    .unwrap_or_default();
                    (None, None, legacy_query_slots)
                }
            };
        let shared_texture_context_lock = (shared_texture_copy_fence.is_none()
            && !shared_texture_copy_slots.is_empty())
        .then(|| Arc::new(Mutex::new(())));
        let shared_texture_copy_telemetry = Arc::new(SharedTextureCopyTelemetry::default());

        let vertex_shader_bytes = compile_shader(VERTEX_SHADER, b"vs_4_0\0")?;
        let pixel_shader_bytes = compile_shader(PIXEL_SHADER, b"ps_4_0\0")?;
        let mut vertex_shader = None;
        device
            .CreateVertexShader(
                &vertex_shader_bytes,
                None::<&ID3D11ClassLinkage>,
                Some(&mut vertex_shader),
            )
            .map_err(|error| format!("ID3D11Device::CreateVertexShader failed: {error}"))?;
        let mut pixel_shader = None;
        device
            .CreatePixelShader(
                &pixel_shader_bytes,
                None::<&ID3D11ClassLinkage>,
                Some(&mut pixel_shader),
            )
            .map_err(|error| format!("ID3D11Device::CreatePixelShader failed: {error}"))?;

        let sampler_desc = D3D11_SAMPLER_DESC {
            Filter: D3D11_FILTER_MIN_MAG_MIP_LINEAR,
            AddressU: D3D11_TEXTURE_ADDRESS_CLAMP,
            AddressV: D3D11_TEXTURE_ADDRESS_CLAMP,
            AddressW: D3D11_TEXTURE_ADDRESS_CLAMP,
            MipLODBias: 0.0,
            MaxAnisotropy: 1,
            ComparisonFunc: D3D11_COMPARISON_NEVER,
            BorderColor: [0.0; 4],
            MinLOD: 0.0,
            MaxLOD: f32::MAX,
        };
        let mut sampler = None;
        device
            .CreateSamplerState(&sampler_desc, Some(&mut sampler))
            .map_err(|error| format!("ID3D11Device::CreateSamplerState failed: {error}"))?;

        let mut renderer = Self {
            device,
            context,
            swap_chain: None,
            render_target: None,
            vertex_shader: vertex_shader
                .ok_or_else(|| "CreateVertexShader returned no shader".to_owned())?,
            pixel_shader: pixel_shader
                .ok_or_else(|| "CreatePixelShader returned no shader".to_owned())?,
            sampler,
            source_texture: None,
            source_view: None,
            source_mode: None,
            source_width: 0,
            source_height: 0,
            source_format: DXGI_FORMAT_UNKNOWN,
            source_sample_count: 0,
            source_sample_quality: 0,
            width: width.max(1),
            height: height.max(1),
            feature_level,
            adapter_name,
            last_present: 0,
            present_sync_interval: 1,
            present_mode: PresentMode::from_qa_environment(
                std::env::var("STEAM_BRIDGE_QA_OVERLAY").as_deref() == Ok("1"),
                std::env::var("STEAM_BRIDGE_QA_PRESENT_MODE")
                    .ok()
                    .as_deref(),
            ),
            present_budget_ms: None,
            present_over_budget_count: 0,
            present_busy_count: 0,
            present_retry_pending: false,
            last_present_flags: 0,
            frame_latency_waitable_object: HANDLE::default(),
            frame_latency_wait_generation: 0,
            frame_latency_ready_permits: 0,
            frame_latency_wait: FrameLatencyWaitGate::default(),
            present_occluded: false,
            fallback_timer_resolution_requested: false,
            fallback_timer_resolution_active: false,
            async_frame_latency_ready_count: 0,
            frame_latency_wait_timeout_count: 0,
            frame_latency_not_ready_count: 0,
            last_render_started_at: None,
            last_render_interval_ms: 0.0,
            max_render_interval_ms: 0.0,
            render_interval_over_25_ms_count: 0,
            render_interval_over_50_ms_count: 0,
            render_interval_over_100_ms_count: 0,
            last_frame_latency_wait_duration_ms: 0.0,
            max_frame_latency_wait_duration_ms: 0.0,
            frame_latency_wait_over_25_ms_count: 0,
            last_present_duration_ms: 0.0,
            max_present_duration_ms: 0.0,
            present_over_25_ms_count: 0,
            last_render_duration_ms: 0.0,
            max_render_duration_ms: 0.0,
            render_over_25_ms_count: 0,
            frame_statistics_available: false,
            last_frame_statistics_present_count: None,
            last_frame_statistics_refresh_count: None,
            last_frame_statistics_present_delta: 0,
            last_frame_statistics_refresh_delta: 0,
            repeated_refresh_count: 0,
            max_repeated_refreshes_per_sample: 0,
            shared_texture_context_lock,
            shared_texture_copy_query,
            shared_texture_copy_fence,
            shared_texture_copy_context4,
            shared_texture_copy_slots,
            next_shared_texture_copy_fence_value: 0,
            shared_texture_copy_telemetry,
            shared_texture_copy_saturation_drop_count: 0,
            max_shared_texture_copies_in_flight: 0,
            shared_texture_full_copy_count: 0,
            shared_texture_partial_copy_count: 0,
            shared_texture_storage_recreate_count: 0,
            last_shared_texture_content_rect: [0; 4],
            last_shared_texture_presentation_rect: [0; 4],
            cpu_upload_count: 0,
            shared_texture_import_count: 0,
            gpu_copy_timing: None,
            host_adapter_luid: None,
            texture_adapter_luid: None,
            window: HWND(hwnd),
            swap_chain_attach_failure: None,
            dedicated_copy: None,
            dedicated_copy_requested: DEDICATED_COPY_DEVICE_REQUESTED.load(Ordering::Acquire),
            dedicated_copy_creation_failures: 0,
            dedicated_copy_last_error: None,
            dedicated_copy_count: 0,
        };
        renderer.gpu_copy_timing = GpuCopyTiming::new(&renderer.device);
        renderer.host_adapter_luid = device_adapter_luid(&renderer.device);
        if attach_swap_chain {
            renderer.attach_swap_chain(hwnd)?;
        }
        if renderer.present_mode == PresentMode::NonblockingImmediate {
            renderer.request_frame_timer_resolution();
        }
        Ok(renderer)
    }

    unsafe fn attach_swap_chain(&mut self, hwnd: *mut c_void) -> Result<(), String> {
        let dxgi_device: IDXGIDevice = self
            .device
            .cast()
            .map_err(|error| format!("ID3D11Device to IDXGIDevice failed: {error}"))?;
        let adapter = dxgi_device
            .GetAdapter()
            .map_err(|error| format!("IDXGIDevice::GetAdapter failed: {error}"))?;
        let factory: IDXGIFactory2 = adapter
            .GetParent()
            .map_err(|error| format!("IDXGIAdapter::GetParent failed: {error}"))?;
        let hwnd = HWND(hwnd);
        factory
            .MakeWindowAssociation(hwnd, DXGI_MWA_NO_ALT_ENTER)
            .map_err(|error| format!("IDXGIFactory::MakeWindowAssociation failed: {error}"))?;
        let desc = DXGI_SWAP_CHAIN_DESC1 {
            Width: self.width,
            Height: self.height,
            Format: DXGI_FORMAT_B8G8R8A8_UNORM,
            Stereo: false.into(),
            SampleDesc: DXGI_SAMPLE_DESC {
                Count: 1,
                Quality: 0,
            },
            BufferUsage: DXGI_USAGE_RENDER_TARGET_OUTPUT,
            BufferCount: 2,
            Scaling: DXGI_SCALING_STRETCH,
            // Preserve each presented buffer for Steam's Present hook and
            // desktop/remote capture while retaining the modern flip-model,
            // low-latency waitable-object path.
            SwapEffect: DXGI_SWAP_EFFECT_FLIP_SEQUENTIAL,
            AlphaMode: DXGI_ALPHA_MODE_IGNORE,
            Flags: DXGI_SWAP_CHAIN_FLAG_FRAME_LATENCY_WAITABLE_OBJECT.0 as u32,
        };
        let swap_chain = factory
            .CreateSwapChainForHwnd(&self.device, hwnd, &desc, None, None::<&IDXGIOutput>)
            .map_err(|error| format!("IDXGIFactory2::CreateSwapChainForHwnd failed: {error}"))?;
        let swap_chain2: IDXGISwapChain2 = swap_chain
            .cast()
            .map_err(|error| format!("IDXGISwapChain1 to IDXGISwapChain2 failed: {error}"))?;
        // Two frames preserve CPU/GPU parallelism while the async wait keeps
        // Electron's message thread free. Controlled physical-input traces
        // showed fewer missed refreshes than a one-frame queue with either
        // timer polling or the same worker-wakeup scheduler.
        swap_chain2
            .SetMaximumFrameLatency(2)
            .map_err(|error| format!("IDXGISwapChain2::SetMaximumFrameLatency failed: {error}"))?;
        let frame_latency_waitable_object = swap_chain2.GetFrameLatencyWaitableObject();
        if frame_latency_waitable_object.is_invalid() {
            return Err(
                "IDXGISwapChain2::GetFrameLatencyWaitableObject returned no handle".to_owned(),
            );
        }
        let render_target = match create_render_target(&self.device, &swap_chain) {
            Ok(render_target) => render_target,
            Err(error) => {
                let _ = CloseHandle(frame_latency_waitable_object);
                return Err(error);
            }
        };
        if !self.frame_latency_waitable_object.is_invalid() {
            let _ = CloseHandle(self.frame_latency_waitable_object);
        }
        self.frame_latency_waitable_object = frame_latency_waitable_object;
        self.frame_latency_wait_generation =
            NEXT_FRAME_LATENCY_WAIT_GENERATION.fetch_add(1, Ordering::Relaxed);
        self.frame_latency_ready_permits = 0;
        self.frame_latency_wait.reset_for_new_swap_chain();
        self.present_occluded = false;
        self.swap_chain = Some(swap_chain);
        self.render_target = Some(render_target);
        Ok(())
    }

    pub unsafe fn resize(&mut self, width: u32, height: u32) -> Result<(), String> {
        let width = width.max(1);
        let height = height.max(1);
        if self.width == width && self.height == height {
            return Ok(());
        }
        let context_lock = self.shared_texture_context_lock.clone();
        let _context_guard = lock_shared_texture_context(&context_lock)?;
        self.context
            .OMSetRenderTargets(None, None::<&ID3D11DepthStencilView>);
        self.render_target = None;
        let swap_chain = self
            .swap_chain
            .as_ref()
            .ok_or_else(|| "D3D11 swap chain is unavailable".to_owned())?;
        swap_chain
            .ResizeBuffers(
                2,
                width,
                height,
                DXGI_FORMAT_B8G8R8A8_UNORM,
                DXGI_SWAP_CHAIN_FLAG_FRAME_LATENCY_WAITABLE_OBJECT,
            )
            .map_err(|error| format!("IDXGISwapChain::ResizeBuffers failed: {error}"))?;
        self.render_target = Some(create_render_target(&self.device, swap_chain)?);
        self.width = width;
        self.height = height;
        self.rearm_frame_latency_wait();
        Ok(())
    }

    pub unsafe fn upload_cpu_frame(
        &mut self,
        data: &[u8],
        width: u32,
        height: u32,
    ) -> Result<(), String> {
        let width = width.max(1);
        let height = height.max(1);
        let expected = width as usize * height as usize * 4;
        if data.len() < expected {
            return Err(format!(
                "CPU frame needs {expected} BGRA bytes, received {}",
                data.len()
            ));
        }
        let context_lock = self.shared_texture_context_lock.clone();
        let _context_guard = lock_shared_texture_context(&context_lock)?;
        if self.source_mode != Some(SourceMode::Cpu)
            || self.source_width != width
            || self.source_height != height
            || self.source_texture.is_none()
        {
            let desc = D3D11_TEXTURE2D_DESC {
                Width: width,
                Height: height,
                MipLevels: 1,
                ArraySize: 1,
                Format: DXGI_FORMAT_B8G8R8A8_UNORM,
                SampleDesc: DXGI_SAMPLE_DESC {
                    Count: 1,
                    Quality: 0,
                },
                Usage: D3D11_USAGE_DEFAULT,
                BindFlags: D3D11_BIND_SHADER_RESOURCE.0 as u32,
                CPUAccessFlags: 0,
                MiscFlags: 0,
            };
            let mut texture = None;
            self.device
                .CreateTexture2D(&desc, None, Some(&mut texture))
                .map_err(|error| format!("ID3D11Device::CreateTexture2D failed: {error}"))?;
            let texture =
                texture.ok_or_else(|| "CreateTexture2D returned no texture".to_owned())?;
            let view = create_source_view(&self.device, &texture)?;
            self.source_texture = Some(texture);
            self.source_view = Some(view);
            self.source_mode = Some(SourceMode::Cpu);
            self.source_width = width;
            self.source_height = height;
        }
        self.forget_dedicated_frames();
        let texture = self
            .source_texture
            .as_ref()
            .ok_or_else(|| "CPU source texture was not created".to_owned())?;
        self.context.UpdateSubresource(
            texture,
            0,
            None,
            data.as_ptr().cast(),
            width.saturating_mul(4),
            0,
        );
        self.cpu_upload_count = self.cpu_upload_count.saturating_add(1);
        Ok(())
    }

    pub unsafe fn import_shared_texture(
        &mut self,
        handle: usize,
        expected_width: u32,
        expected_height: u32,
        content_rect: (u32, u32, u32, u32),
        presentation_rect: (u32, u32, u32, u32),
    ) -> Result<(), String> {
        match self.import_shared_texture_internal(
            handle,
            expected_width,
            expected_height,
            content_rect,
            presentation_rect,
            false,
        )? {
            SharedTextureImportSubmission::Accepted(Some(wait)) => wait.wait(),
            SharedTextureImportSubmission::Accepted(None) => Ok(()),
            SharedTextureImportSubmission::Dropped => {
                Err("Synchronous Electron shared-texture copy was unexpectedly dropped".to_owned())
            }
        }
    }

    pub unsafe fn begin_import_shared_texture(
        &mut self,
        handle: usize,
        expected_width: u32,
        expected_height: u32,
        content_rect: (u32, u32, u32, u32),
        presentation_rect: (u32, u32, u32, u32),
    ) -> Result<SharedTextureImportSubmission, String> {
        self.import_shared_texture_internal(
            handle,
            expected_width,
            expected_height,
            content_rect,
            presentation_rect,
            true,
        )
    }

    unsafe fn import_shared_texture_internal(
        &mut self,
        handle: usize,
        expected_width: u32,
        expected_height: u32,
        content_rect: (u32, u32, u32, u32),
        presentation_rect: (u32, u32, u32, u32),
        asynchronous_completion: bool,
    ) -> Result<SharedTextureImportSubmission, String> {
        if let Some(failure) = self.swap_chain_attach_failure.as_ref() {
            return Err(failure.clone());
        }
        let context_lock = self.shared_texture_context_lock.clone();
        let _context_guard = lock_shared_texture_context(&context_lock)?;
        if asynchronous_completion
            && (self
                .shared_texture_copy_telemetry
                .fatal_timeout_count
                .load(Ordering::Acquire)
                > 0
                || self
                    .shared_texture_copy_telemetry
                    .terminal_failure_count
                    .load(Ordering::Acquire)
                    > 0)
        {
            let host_removed = self.device.GetDeviceRemovedReason().err();
            let copy_removed = self
                .dedicated_copy
                .as_ref()
                .and_then(|dedicated| dedicated.device.GetDeviceRemovedReason().err());
            return Err(stalled_shared_texture_copy_error(
                host_removed.as_ref(),
                copy_removed.as_ref(),
            ));
        }
        if handle == 0 {
            return Err("Electron shared texture handle is null".to_owned());
        }
        if asynchronous_completion && self.ensure_dedicated_copy_device() {
            return self.import_shared_texture_dedicated(
                handle,
                expected_width,
                expected_height,
                content_rect,
                presentation_rect,
            );
        }
        self.forget_dedicated_frames();
        let device1: ID3D11Device1 = self
            .device
            .cast()
            .map_err(|error| format!("ID3D11Device1 is unavailable: {error}"))?;
        let texture: ID3D11Texture2D =
            device1
                .OpenSharedResource1(HANDLE(handle as *mut c_void))
                .map_err(|error| format!("ID3D11Device1::OpenSharedResource1 failed: {error}"))?;
        let mut desc = D3D11_TEXTURE2D_DESC::default();
        texture.GetDesc(&mut desc);
        if desc.Width != expected_width.max(1) || desc.Height != expected_height.max(1) {
            return Err(format!(
                "Electron shared texture is {}x{}, expected {}x{}",
                desc.Width,
                desc.Height,
                expected_width.max(1),
                expected_height.max(1)
            ));
        }
        let (content_x, content_y, content_width, content_height) = content_rect;
        let content_right = content_x
            .checked_add(content_width)
            .ok_or_else(|| "Electron shared texture content rectangle overflows".to_owned())?;
        let content_bottom = content_y
            .checked_add(content_height)
            .ok_or_else(|| "Electron shared texture content rectangle overflows".to_owned())?;
        if content_width == 0
            || content_height == 0
            || content_right > desc.Width
            || content_bottom > desc.Height
        {
            return Err(format!(
                "Electron shared texture content rectangle {},{} {}x{} exceeds {}x{}",
                content_x, content_y, content_width, content_height, desc.Width, desc.Height
            ));
        }
        let (presentation_x, presentation_y, presentation_width, presentation_height) =
            presentation_rect;
        let presentation_right = presentation_x
            .checked_add(presentation_width)
            .ok_or_else(|| "Electron shared texture presentation rectangle overflows".to_owned())?;
        let presentation_bottom = presentation_y
            .checked_add(presentation_height)
            .ok_or_else(|| "Electron shared texture presentation rectangle overflows".to_owned())?;
        if presentation_width == 0
            || presentation_height == 0
            || presentation_right > desc.Width
            || presentation_bottom > desc.Height
        {
            return Err(format!(
                "Electron shared texture presentation rectangle {},{} {}x{} exceeds {}x{}",
                presentation_x,
                presentation_y,
                presentation_width,
                presentation_height,
                desc.Width,
                desc.Height
            ));
        }
        let storage_recreated = self.source_mode != Some(SourceMode::SharedTexture)
            || self.source_width != presentation_width
            || self.source_height != presentation_height
            || self.source_format != desc.Format
            || self.source_sample_count != desc.SampleDesc.Count
            || self.source_sample_quality != desc.SampleDesc.Quality
            || self.source_texture.is_none();
        let presentation_changed = self.last_shared_texture_presentation_rect
            != [
                presentation_x,
                presentation_y,
                presentation_width,
                presentation_height,
            ];
        let copy_rect = if storage_recreated || presentation_changed {
            Some(presentation_rect)
        } else {
            intersect_rect(content_rect, presentation_rect)
        };
        if asynchronous_completion
            && copy_rect.is_some()
            && self.shared_texture_copy_slots.is_empty()
        {
            // Fail before CopySubresourceRegion takes ownership of the producer
            // texture only when neither fences nor isolated event-query slots
            // can prove completion asynchronously.
            return Err(
                // Keep the established text for older shell compatibility.
                "The Windows D3D11 device does not support asynchronous shared-texture fences"
                    .to_owned(),
            );
        }
        let copy_slot_reservation = if asynchronous_completion && copy_rect.is_some() {
            let Some(reservation) =
                try_reserve_shared_texture_copy_slot(&self.shared_texture_copy_slots)
            else {
                self.shared_texture_copy_saturation_drop_count = self
                    .shared_texture_copy_saturation_drop_count
                    .saturating_add(1);
                return Ok(SharedTextureImportSubmission::Dropped);
            };
            let in_flight = self
                .shared_texture_copy_slots
                .iter()
                .filter(|slot| slot.in_flight.load(Ordering::Acquire))
                .count() as u64;
            self.max_shared_texture_copies_in_flight =
                self.max_shared_texture_copies_in_flight.max(in_flight);
            Some(reservation)
        } else {
            None
        };
        if storage_recreated {
            self.texture_adapter_luid = shared_resource_adapter_luid(handle);
            self.shared_texture_storage_recreate_count =
                self.shared_texture_storage_recreate_count.saturating_add(1);
            let owned_desc = D3D11_TEXTURE2D_DESC {
                Width: presentation_width,
                Height: presentation_height,
                BindFlags: (D3D11_BIND_SHADER_RESOURCE | D3D11_BIND_RENDER_TARGET).0 as u32,
                CPUAccessFlags: 0,
                MiscFlags: 0,
                Usage: D3D11_USAGE_DEFAULT,
                ..desc
            };
            let mut owned_texture = None;
            self.device
                .CreateTexture2D(&owned_desc, None, Some(&mut owned_texture))
                .map_err(|error| {
                    format!("ID3D11Device::CreateTexture2D for shared copy failed: {error}")
                })?;
            let owned_texture = owned_texture
                .ok_or_else(|| "CreateTexture2D for shared copy returned no texture".to_owned())?;
            let view = create_source_view(&self.device, &owned_texture)?;
            let mut clear_view = None;
            self.device
                .CreateRenderTargetView(&owned_texture, None, Some(&mut clear_view))
                .map_err(|error| {
                    format!("ID3D11Device::CreateRenderTargetView for shared copy failed: {error}")
                })?;
            let clear_view = clear_view.ok_or_else(|| {
                "CreateRenderTargetView for shared copy returned no view".to_owned()
            })?;
            self.context
                .ClearRenderTargetView(&clear_view, &[0.0, 0.0, 0.0, 1.0]);
            self.source_texture = Some(owned_texture);
            self.source_view = Some(view);
        }
        let mut copy_wait = None;
        if let Some((copy_x, copy_y, copy_width, copy_height)) = copy_rect {
            let copy_submitted_at = Instant::now();
            let source_box = D3D11_BOX {
                left: copy_x,
                top: copy_y,
                front: 0,
                right: copy_x + copy_width,
                bottom: copy_y + copy_height,
                back: 1,
            };
            let destination_texture = self
                .source_texture
                .as_ref()
                .ok_or_else(|| "Shared-copy texture was not created".to_owned())?
                .clone();
            enum AsyncCopySubmission {
                Fence {
                    reservation: SharedTextureCopySlotReservation,
                    fence: ID3D11Fence,
                    context4: ID3D11DeviceContext4,
                    fence_value: u64,
                },
                Query {
                    reservation: SharedTextureCopySlotReservation,
                    query: ID3D11Query,
                },
            }
            let async_copy_submission = if let Some(reservation) = copy_slot_reservation {
                if let (Some(fence), Some(context4)) = (
                    self.shared_texture_copy_fence.as_ref(),
                    self.shared_texture_copy_context4.as_ref(),
                ) {
                    let fence_value = self
                        .next_shared_texture_copy_fence_value
                        .checked_add(1)
                        .filter(|value| *value != u64::MAX)
                        .ok_or_else(|| "D3D11 shared-texture fence value overflowed".to_owned())?;
                    self.next_shared_texture_copy_fence_value = fence_value;
                    Some(AsyncCopySubmission::Fence {
                        reservation,
                        fence: fence.clone(),
                        context4: context4.clone(),
                        fence_value,
                    })
                } else {
                    let query = reservation
                        .slot
                        .as_ref()
                        .and_then(|slot| slot.query.as_ref())
                        .cloned()
                        .ok_or_else(|| {
                            "D3D11 asynchronous shared-texture query slot is unavailable".to_owned()
                        })?;
                    Some(AsyncCopySubmission::Query { reservation, query })
                }
            } else {
                None
            };
            let gpu_copy_sample = match self.gpu_copy_timing.as_mut() {
                Some(timing) => timing.begin(&self.context),
                None => None,
            };
            self.context.CopySubresourceRegion(
                &destination_texture,
                0,
                copy_x - presentation_x,
                copy_y - presentation_y,
                0,
                &texture,
                0,
                Some(&source_box),
            );
            if let Some(timing) = self.gpu_copy_timing.as_mut() {
                timing.end(&self.context, gpu_copy_sample);
            }
            match async_copy_submission {
                Some(AsyncCopySubmission::Fence {
                    reservation,
                    fence,
                    context4,
                    fence_value,
                }) => {
                    // The copy already references Electron's producer texture.
                    // A post-submit Signal failure must settle through the
                    // callback so JavaScript retains that producer until the
                    // graphics device is restarted.
                    let signal_error = context4.Signal(&fence, fence_value).err();
                    if signal_error.is_some() {
                        self.shared_texture_copy_telemetry
                            .submission_failure_count
                            .fetch_add(1, Ordering::Release);
                    }
                    let mut fallback_query = None;
                    let fallback_query_error = if signal_error.is_some() {
                        self.device
                            .CreateQuery(
                                &D3D11_QUERY_DESC {
                                    Query: D3D11_QUERY_EVENT,
                                    MiscFlags: 0,
                                },
                                Some(&mut fallback_query),
                            )
                            .err()
                    } else {
                        None
                    };
                    let completion = if let Some(query) = fallback_query {
                        let context_lock = self
                            .shared_texture_context_lock
                            .get_or_insert_with(|| Arc::new(Mutex::new(())))
                            .clone();
                        self.context.End(&query);
                        SharedTextureCopyCompletion::Query {
                            context: self.context.clone(),
                            query,
                            context_lock,
                        }
                    } else {
                        SharedTextureCopyCompletion::Fence { fence, fence_value }
                    };
                    let submission_error = signal_error.map(|error| {
                        let fallback = fallback_query_error
                            .map(|fallback_error| format!("; fallback event query creation failed: {fallback_error}"))
                            .unwrap_or_else(|| "; fallback event query returned no query".to_owned());
                        format!(
                            "ID3D11DeviceContext4::Signal for shared texture copy failed after submission: {error}{fallback}; the native graphics device must be restarted"
                        )
                    }).filter(|_| matches!(&completion, SharedTextureCopyCompletion::Fence { .. }));
                    self.context.Flush();
                    copy_wait = Some(SharedTextureCopyWaitHandle {
                        device: self.device.clone(),
                        completion,
                        slot: reservation.into_slot(),
                        submitted_at: copy_submitted_at,
                        telemetry: Arc::clone(&self.shared_texture_copy_telemetry),
                        submission_error,
                    });
                }
                Some(AsyncCopySubmission::Query { reservation, query }) => {
                    // D3D11_QUERY_EVENT marks every command submitted before
                    // End. Flush exactly once here, then let the worker poll
                    // without flushing while the producer texture stays alive.
                    self.context.End(&query);
                    self.context.Flush();
                    copy_wait = Some(SharedTextureCopyWaitHandle {
                        device: self.device.clone(),
                        completion: SharedTextureCopyCompletion::Query {
                            context: self.context.clone(),
                            query,
                            context_lock: Arc::clone(
                                self.shared_texture_context_lock
                                    .as_ref()
                                    .expect("query completion context lock is unavailable"),
                            ),
                        },
                        slot: reservation.into_slot(),
                        submitted_at: copy_submitted_at,
                        telemetry: Arc::clone(&self.shared_texture_copy_telemetry),
                        submission_error: None,
                    });
                }
                None => self.wait_for_shared_texture_copy()?,
            }
            if copy_rect == Some(presentation_rect) {
                self.shared_texture_full_copy_count =
                    self.shared_texture_full_copy_count.saturating_add(1);
            } else {
                self.shared_texture_partial_copy_count =
                    self.shared_texture_partial_copy_count.saturating_add(1);
            }
        }
        self.source_mode = Some(SourceMode::SharedTexture);
        self.source_width = presentation_width;
        self.source_height = presentation_height;
        self.source_format = desc.Format;
        self.source_sample_count = desc.SampleDesc.Count;
        self.source_sample_quality = desc.SampleDesc.Quality;
        self.last_shared_texture_content_rect =
            [content_x, content_y, content_width, content_height];
        self.last_shared_texture_presentation_rect = [
            presentation_x,
            presentation_y,
            presentation_width,
            presentation_height,
        ];
        self.shared_texture_import_count = self.shared_texture_import_count.saturating_add(1);
        Ok(SharedTextureImportSubmission::Accepted(copy_wait))
    }

    unsafe fn wait_for_shared_texture_copy(&mut self) -> Result<(), String> {
        self.context.End(&self.shared_texture_copy_query);
        self.context.Flush();

        let started = std::time::Instant::now();
        let mut recorded_slow_copy = false;
        loop {
            let mut completed = 0i32;
            self.context
                .GetData(
                    &self.shared_texture_copy_query,
                    Some((&mut completed as *mut i32).cast()),
                    std::mem::size_of::<i32>() as u32,
                    0,
                )
                .map_err(|error| {
                    format!("ID3D11DeviceContext::GetData for shared texture copy failed: {error}")
                })?;
            if completed != 0 {
                let duration_micros = started.elapsed().as_micros().min(u64::MAX as u128) as u64;
                self.shared_texture_copy_telemetry
                    .last_duration_micros
                    .store(duration_micros, Ordering::Relaxed);
                self.shared_texture_copy_telemetry
                    .max_duration_micros
                    .fetch_max(duration_micros, Ordering::Relaxed);
                self.shared_texture_copy_telemetry
                    .completed_count
                    .fetch_add(1, Ordering::Relaxed);
                return Ok(());
            }
            if !recorded_slow_copy && started.elapsed().as_millis() >= SHARED_TEXTURE_COPY_SLOW_MS {
                self.shared_texture_copy_telemetry
                    .slow_count
                    .fetch_add(1, Ordering::Relaxed);
                recorded_slow_copy = true;
            }
            if started.elapsed().as_millis() >= SHARED_TEXTURE_COPY_TIMEOUT_MS {
                self.shared_texture_copy_telemetry
                    .timeout_count
                    .fetch_add(1, Ordering::Relaxed);
                return Err(format!(
                    "Timed out waiting {SHARED_TEXTURE_COPY_TIMEOUT_MS} ms for the Electron shared texture copy"
                ));
            }
            std::thread::yield_now();
        }
    }

    pub unsafe fn switch_to_shared_texture_adapter(
        &mut self,
        hwnd: *mut c_void,
        handle: usize,
        source_width: u32,
        source_height: u32,
        content_rect: (u32, u32, u32, u32),
        presentation_rect: (u32, u32, u32, u32),
    ) -> Result<(), String> {
        let width = self.width;
        let height = self.height;
        let present_sync_interval = self.present_sync_interval;
        let mut replacement = Self::new_for_shared_texture(
            hwnd,
            width,
            height,
            handle,
            source_width,
            source_height,
            content_rect,
            presentation_rect,
        )?;
        replacement.set_present_sync_interval(present_sync_interval);
        replacement.present_mode = self.present_mode;
        replacement.present_budget_ms = self.present_budget_ms;
        let context_lock = self.shared_texture_context_lock.clone();
        let _context_guard = lock_shared_texture_context(&context_lock)?;
        self.release_swap_chain_for_replacement();

        match replacement.attach_swap_chain(hwnd) {
            Ok(()) => {
                *self = replacement;
                Ok(())
            }
            Err(error) => match Self::new(hwnd, width, height) {
                Ok(mut restored) => {
                    restored.set_present_sync_interval(present_sync_interval);
                    restored.present_mode = self.present_mode;
                    restored.present_budget_ms = self.present_budget_ms;
                    *self = restored;
                    Err(error)
                }
                Err(restore_error) => {
                    let terminal = swap_chain_attach_failure_error(&error, &restore_error);
                    self.swap_chain_attach_failure = Some(terminal.clone());
                    Err(terminal)
                }
            },
        }
    }

    pub fn swap_chain_attach_failure(&self) -> Option<&str> {
        self.swap_chain_attach_failure.as_deref()
    }

    pub fn set_dedicated_copy_device(&mut self, enabled: bool) {
        if self.dedicated_copy_requested == enabled {
            return;
        }
        self.dedicated_copy_requested = enabled;
        if !enabled {
            unsafe {
                self.bind_dedicated_copy_for_render();
            }
            self.dedicated_copy = None;
        }
        self.source_texture = None;
    }

    fn forget_dedicated_frames(&mut self) {
        if let Some(dedicated) = self.dedicated_copy.as_mut() {
            dedicated.pending = None;
            dedicated.newest = None;
            dedicated.displayed = None;
        }
    }

    pub fn dedicated_copy_device_active(&self) -> bool {
        self.dedicated_copy.is_some()
    }

    fn dedicated_copy_diagnostics(&self) -> serde_json::Value {
        serde_json::json!({
            "requested": self.dedicated_copy_requested,
            "active": self.dedicated_copy.is_some(),
            "copyCount": self.dedicated_copy_count,
            "creationFailureCount": self.dedicated_copy_creation_failures,
            "lastError": self.dedicated_copy_last_error,
        })
    }

    unsafe fn ensure_dedicated_copy_device(&mut self) -> bool {
        if !self.dedicated_copy_requested || self.shared_texture_copy_context4.is_none() {
            return false;
        }
        if self.dedicated_copy.is_some() {
            return true;
        }
        if self.dedicated_copy_creation_failures >= DEDICATED_COPY_CREATION_ATTEMPTS {
            return false;
        }
        match DedicatedCopyDevice::new(&self.device) {
            Ok(dedicated) => {
                self.dedicated_copy = Some(dedicated);
                true
            }
            Err(error) => {
                self.dedicated_copy_creation_failures =
                    self.dedicated_copy_creation_failures.saturating_add(1);
                self.dedicated_copy_last_error = Some(error);
                false
            }
        }
    }

    unsafe fn import_shared_texture_dedicated(
        &mut self,
        handle: usize,
        expected_width: u32,
        expected_height: u32,
        content_rect: (u32, u32, u32, u32),
        presentation_rect: (u32, u32, u32, u32),
    ) -> Result<SharedTextureImportSubmission, String> {
        let host_device = self.device.clone();
        let source_was_shared_texture = self.source_mode == Some(SourceMode::SharedTexture);
        let presentation_changed = self.last_shared_texture_presentation_rect
            != [
                presentation_rect.0,
                presentation_rect.1,
                presentation_rect.2,
                presentation_rect.3,
            ];
        let dedicated = self
            .dedicated_copy
            .as_mut()
            .ok_or_else(|| "The dedicated copy device is unavailable".to_owned())?;
        if let Err(error) = dedicated.device.GetDeviceRemovedReason() {
            self.dedicated_copy = None;
            return Err(dedicated_copy_device_removed_error(&error));
        }
        let texture: ID3D11Texture2D = dedicated
            .device1
            .OpenSharedResource1(HANDLE(handle as *mut c_void))
            .map_err(|error| format!("ID3D11Device1::OpenSharedResource1 failed: {error}"))?;
        let mut desc = D3D11_TEXTURE2D_DESC::default();
        texture.GetDesc(&mut desc);
        if desc.Width != expected_width.max(1) || desc.Height != expected_height.max(1) {
            return Err(format!(
                "Electron shared texture is {}x{}, expected {}x{}",
                desc.Width,
                desc.Height,
                expected_width.max(1),
                expected_height.max(1)
            ));
        }
        let (content_x, content_y, content_width, content_height) = content_rect;
        let content_right = content_x
            .checked_add(content_width)
            .ok_or_else(|| "Electron shared texture content rectangle overflows".to_owned())?;
        let content_bottom = content_y
            .checked_add(content_height)
            .ok_or_else(|| "Electron shared texture content rectangle overflows".to_owned())?;
        if content_width == 0
            || content_height == 0
            || content_right > desc.Width
            || content_bottom > desc.Height
        {
            return Err(format!(
                "Electron shared texture content rectangle {},{} {}x{} exceeds {}x{}",
                content_x, content_y, content_width, content_height, desc.Width, desc.Height
            ));
        }
        let (presentation_x, presentation_y, presentation_width, presentation_height) =
            presentation_rect;
        let presentation_right = presentation_x
            .checked_add(presentation_width)
            .ok_or_else(|| "Electron shared texture presentation rectangle overflows".to_owned())?;
        let presentation_bottom = presentation_y
            .checked_add(presentation_height)
            .ok_or_else(|| "Electron shared texture presentation rectangle overflows".to_owned())?;
        if presentation_width == 0
            || presentation_height == 0
            || presentation_right > desc.Width
            || presentation_bottom > desc.Height
        {
            return Err(format!(
                "Electron shared texture presentation rectangle {},{} {}x{} exceeds {}x{}",
                presentation_x,
                presentation_y,
                presentation_width,
                presentation_height,
                desc.Width,
                desc.Height
            ));
        }
        let ring_recreated = dedicated.ensure_ring(
            &host_device,
            presentation_width,
            presentation_height,
            desc.Format,
        )?;
        let full_copy = ring_recreated
            || presentation_changed
            || !source_was_shared_texture
            || dedicated.newest.is_none();
        let copy_rect = if full_copy {
            Some(presentation_rect)
        } else {
            intersect_rect(content_rect, presentation_rect)
        };
        let Some((copy_x, copy_y, copy_width, copy_height)) = copy_rect else {
            self.shared_texture_import_count = self.shared_texture_import_count.saturating_add(1);
            return Ok(SharedTextureImportSubmission::Accepted(None));
        };
        let Some(reservation) =
            try_reserve_shared_texture_copy_slot(&self.shared_texture_copy_slots)
        else {
            self.shared_texture_copy_saturation_drop_count = self
                .shared_texture_copy_saturation_drop_count
                .saturating_add(1);
            return Ok(SharedTextureImportSubmission::Dropped);
        };
        let in_flight = self
            .shared_texture_copy_slots
            .iter()
            .filter(|slot| slot.in_flight.load(Ordering::Acquire))
            .count() as u64;
        self.max_shared_texture_copies_in_flight =
            self.max_shared_texture_copies_in_flight.max(in_flight);
        let copy_submitted_at = Instant::now();
        let base_slot = if full_copy { None } else { dedicated.newest };
        let slot_index = dedicated.select_ring_slot();
        let mut submission_error = None;
        let last_sampled_value = dedicated.ring[slot_index].last_sampled_value;
        if last_sampled_value > 0 {
            if let Err(error) = dedicated
                .context4
                .Wait(&dedicated.copy_sampled_fence, last_sampled_value)
            {
                submission_error = Some(format!(
                    "The dedicated copy device could not wait for host sampling: {error}; the native graphics device must be restarted"
                ));
            }
        }
        let mut copy_value = dedicated.next_copy_value;
        if submission_error.is_none() {
            let gpu_copy_sample = match dedicated.gpu_timing.as_mut() {
                Some(timing) => timing.begin(&dedicated.context),
                None => None,
            };
            if let Some(base_slot) = base_slot {
                dedicated.context.CopyResource(
                    &dedicated.ring[slot_index].copy_texture,
                    &dedicated.ring[base_slot].copy_texture,
                );
            }
            dedicated.context.CopySubresourceRegion(
                &dedicated.ring[slot_index].copy_texture,
                0,
                copy_x - presentation_x,
                copy_y - presentation_y,
                0,
                &texture,
                0,
                Some(&D3D11_BOX {
                    left: copy_x,
                    top: copy_y,
                    front: 0,
                    right: copy_x + copy_width,
                    bottom: copy_y + copy_height,
                    back: 1,
                }),
            );
            if let Some(timing) = dedicated.gpu_timing.as_mut() {
                timing.end(&dedicated.context, gpu_copy_sample);
            }
            dedicated.next_copy_value = dedicated.next_copy_value.saturating_add(1);
            copy_value = dedicated.next_copy_value;
            if let Err(error) = dedicated.context4.Signal(&dedicated.copy_fence, copy_value) {
                self.shared_texture_copy_telemetry
                    .submission_failure_count
                    .fetch_add(1, Ordering::Release);
                submission_error.get_or_insert(format!(
                    "ID3D11DeviceContext4::Signal for the dedicated shared texture copy failed after submission: {error}; the native graphics device must be restarted"
                ));
            }
            dedicated.context.Flush();
        }
        if submission_error.is_none() {
            dedicated.pending = Some((slot_index, copy_value));
            dedicated.newest = Some(slot_index);
        }
        let copy_wait = SharedTextureCopyWaitHandle {
            device: dedicated.device.clone(),
            completion: SharedTextureCopyCompletion::Fence {
                fence: dedicated.copy_fence.clone(),
                fence_value: copy_value,
            },
            slot: reservation.into_slot(),
            submitted_at: copy_submitted_at,
            telemetry: Arc::clone(&self.shared_texture_copy_telemetry),
            submission_error,
        };
        if ring_recreated {
            self.texture_adapter_luid = shared_resource_adapter_luid(handle);
            self.shared_texture_storage_recreate_count =
                self.shared_texture_storage_recreate_count.saturating_add(1);
        }
        if full_copy {
            self.shared_texture_full_copy_count =
                self.shared_texture_full_copy_count.saturating_add(1);
        } else {
            self.shared_texture_partial_copy_count =
                self.shared_texture_partial_copy_count.saturating_add(1);
        }
        self.dedicated_copy_count = self.dedicated_copy_count.saturating_add(1);
        self.source_texture = None;
        self.source_mode = Some(SourceMode::SharedTexture);
        self.source_width = presentation_width;
        self.source_height = presentation_height;
        self.source_format = desc.Format;
        self.source_sample_count = desc.SampleDesc.Count;
        self.source_sample_quality = desc.SampleDesc.Quality;
        self.last_shared_texture_content_rect =
            [content_x, content_y, content_width, content_height];
        self.last_shared_texture_presentation_rect = [
            presentation_x,
            presentation_y,
            presentation_width,
            presentation_height,
        ];
        self.shared_texture_import_count = self.shared_texture_import_count.saturating_add(1);
        Ok(SharedTextureImportSubmission::Accepted(Some(copy_wait)))
    }

    unsafe fn bind_dedicated_copy_for_render(&mut self) {
        let (Some(dedicated), Some(context4)) = (
            self.dedicated_copy.as_mut(),
            self.shared_texture_copy_context4.as_ref(),
        ) else {
            return;
        };
        if let Some((slot, copy_value)) = dedicated.pending.take() {
            if context4
                .Wait(&dedicated.host_copy_fence, copy_value)
                .is_ok()
            {
                dedicated.displayed = Some(slot);
                self.source_view = Some(dedicated.ring[slot].host_view.clone());
            }
        }
    }

    unsafe fn signal_dedicated_copy_sampled(&mut self) -> bool {
        let (Some(dedicated), Some(context4)) = (
            self.dedicated_copy.as_mut(),
            self.shared_texture_copy_context4.as_ref(),
        ) else {
            return false;
        };
        let Some(slot) = dedicated.displayed else {
            return false;
        };
        let sampled_value = dedicated.next_sampled_value.saturating_add(1);
        if context4
            .Signal(&dedicated.sampled_fence, sampled_value)
            .is_err()
        {
            return false;
        }
        dedicated.next_sampled_value = sampled_value;
        dedicated.ring[slot].last_sampled_value = sampled_value;
        true
    }

    unsafe fn release_swap_chain_for_replacement(&mut self) {
        self.render_target = None;
        self.source_view = None;
        self.source_texture = None;
        self.swap_chain = None;
        if !self.frame_latency_waitable_object.is_invalid() {
            let _ = CloseHandle(self.frame_latency_waitable_object);
            self.frame_latency_waitable_object = HANDLE::default();
        }
        self.frame_latency_ready_permits = 0;
        self.context.ClearState();
        self.context.Flush();
    }

    pub unsafe fn render(&mut self, clear_color: [f32; 4]) -> Result<Option<i32>, String> {
        if let Some(failure) = self.swap_chain_attach_failure.as_ref() {
            return Err(failure.clone());
        }
        self.present_retry_pending = false;
        let context_lock = self.shared_texture_context_lock.clone();
        let _context_guard = lock_shared_texture_context(&context_lock)?;
        let render_started_at = Instant::now();
        if self.present_occluded {
            let swap_chain = self
                .swap_chain
                .as_ref()
                .ok_or_else(|| "D3D11 swap chain is unavailable".to_owned())?;
            if swap_chain.Present(0, DXGI_PRESENT_TEST) == DXGI_STATUS_OCCLUDED {
                return Ok(None);
            }
            self.present_occluded = false;
            self.rearm_frame_latency_wait();
        }
        if self.frame_latency_wait.bypassed {
            // The waitable object stopped signaling. The timer-driven
            // nonblocking Present fallback provides bounded retries, and a
            // zero-timeout poll re-arms the wait once it signals repeatedly.
            self.last_frame_latency_wait_duration_ms = 0.0;
            let ready = !self.frame_latency_waitable_object.is_invalid()
                && WaitForSingleObjectEx(self.frame_latency_waitable_object, 0, false)
                    == WAIT_OBJECT_0;
            if self.frame_latency_wait.record_bypass_poll(ready) {
                self.frame_latency_ready_permits = 0;
                self.release_frame_timer_resolution();
            }
        } else if self.frame_latency_ready_permits > 0 {
            // The async worker consumed the auto-reset waitable-object signal.
            // Spend its matching permit instead of polling the same handle a
            // second time and incorrectly treating the frame as not ready.
            self.frame_latency_ready_permits -= 1;
            self.last_frame_latency_wait_duration_ms = 0.0;
        } else if !self.frame_latency_waitable_object.is_invalid() {
            let wait_started_at = Instant::now();
            let wait_result = WaitForSingleObjectEx(
                self.frame_latency_waitable_object,
                FRAME_LATENCY_WAIT_POLL_MS,
                false,
            );
            let wait_duration_ms = wait_started_at.elapsed().as_secs_f64() * 1_000.0;
            self.last_frame_latency_wait_duration_ms = wait_duration_ms;
            self.max_frame_latency_wait_duration_ms = self
                .max_frame_latency_wait_duration_ms
                .max(wait_duration_ms);
            if wait_duration_ms >= 25.0 {
                self.frame_latency_wait_over_25_ms_count =
                    self.frame_latency_wait_over_25_ms_count.saturating_add(1);
            }
            if wait_result == WAIT_FAILED {
                return Err("WaitForSingleObjectEx for DXGI frame latency failed".to_owned());
            }
            if wait_result == WAIT_TIMEOUT {
                self.frame_latency_not_ready_count =
                    self.frame_latency_not_ready_count.saturating_add(1);
                return Ok(None);
            }
            if wait_result != WAIT_OBJECT_0 {
                self.frame_latency_wait_timeout_count =
                    self.frame_latency_wait_timeout_count.saturating_add(1);
                return Ok(None);
            }
            self.frame_latency_wait.record_ready();
        }
        if let Some(previous_render_started_at) =
            self.last_render_started_at.replace(render_started_at)
        {
            let interval_ms = previous_render_started_at.elapsed().as_secs_f64() * 1_000.0;
            self.last_render_interval_ms = interval_ms;
            self.max_render_interval_ms = self.max_render_interval_ms.max(interval_ms);
            if interval_ms >= 25.0 {
                self.render_interval_over_25_ms_count =
                    self.render_interval_over_25_ms_count.saturating_add(1);
            }
            if interval_ms >= 50.0 {
                self.render_interval_over_50_ms_count =
                    self.render_interval_over_50_ms_count.saturating_add(1);
            }
            if interval_ms >= 100.0 {
                self.render_interval_over_100_ms_count =
                    self.render_interval_over_100_ms_count.saturating_add(1);
            }
        }
        self.bind_dedicated_copy_for_render();
        // Steam renders its overlay from the Present hook on this device and
        // can transiently touch rasterizer/scissor and other pipeline state.
        // Start every game frame from known D3D11 defaults before rebinding
        // the complete bridge pipeline; otherwise an injected scissor can
        // clip a later game frame to a narrow overlay-sized slice.
        self.context.ClearState();
        let render_target = self
            .render_target
            .as_ref()
            .ok_or_else(|| "D3D11 render target is unavailable".to_owned())?;
        self.context.OMSetRenderTargets(
            Some(slice::from_ref(&self.render_target)),
            None::<&ID3D11DepthStencilView>,
        );
        self.context
            .ClearRenderTargetView(render_target, &clear_color);

        let mut sampled_signalled = false;
        if self.source_view.is_some() && self.source_width > 0 && self.source_height > 0 {
            let (x, y, width, height) = aspect_fit(
                self.width,
                self.height,
                self.source_width,
                self.source_height,
            );
            let viewport = D3D11_VIEWPORT {
                TopLeftX: x,
                TopLeftY: y,
                Width: width,
                Height: height,
                MinDepth: 0.0,
                MaxDepth: 1.0,
            };
            self.context
                .RSSetViewports(Some(slice::from_ref(&viewport)));
            self.context.IASetInputLayout(None::<&ID3D11InputLayout>);
            self.context
                .IASetPrimitiveTopology(D3D_PRIMITIVE_TOPOLOGY_TRIANGLELIST);
            self.context.VSSetShader(&self.vertex_shader, None);
            self.context.PSSetShader(&self.pixel_shader, None);
            self.context
                .PSSetShaderResources(0, Some(slice::from_ref(&self.source_view)));
            self.context
                .PSSetSamplers(0, Some(slice::from_ref(&self.sampler)));
            self.context.Draw(3, 0);
            self.context.PSSetShaderResources(0, Some(&[None]));
            sampled_signalled = self.signal_dedicated_copy_sampled();
        }

        let swap_chain = self
            .swap_chain
            .as_ref()
            .ok_or_else(|| "D3D11 swap chain is unavailable".to_owned())?;
        // The healthy path is paced by both the frame-latency handle and
        // Present(1). If a driver stops signaling that handle, never let
        // Steam's Present hook synchronously stall Electron's message thread:
        // the fallback is timer-paced and submits without waiting. Windowed
        // flip-model composition remains owned by DWM.
        let (present_sync_interval, present_flags) = self
            .present_mode
            .parameters(self.present_sync_interval, self.frame_latency_wait.bypassed);
        self.last_present_flags = present_flags.0;
        let present_started_at = Instant::now();
        let result = swap_chain.Present(present_sync_interval, present_flags);
        let present_duration_ms = present_started_at.elapsed().as_secs_f64() * 1_000.0;
        if sampled_signalled && !present_submitted_frame(result) {
            self.context.Flush();
        }
        self.last_present_duration_ms = present_duration_ms;
        self.max_present_duration_ms = self.max_present_duration_ms.max(present_duration_ms);
        if self
            .present_budget_ms
            .is_some_and(|budget| present_duration_ms > budget)
        {
            self.present_over_budget_count = self.present_over_budget_count.saturating_add(1);
        }
        if present_duration_ms >= 25.0 {
            self.present_over_25_ms_count = self.present_over_25_ms_count.saturating_add(1);
        }
        let render_duration_ms = render_started_at.elapsed().as_secs_f64() * 1_000.0;
        self.last_render_duration_ms = render_duration_ms;
        self.max_render_duration_ms = self.max_render_duration_ms.max(render_duration_ms);
        if render_duration_ms >= 25.0 {
            self.render_over_25_ms_count = self.render_over_25_ms_count.saturating_add(1);
        }
        self.last_present = result.0;
        self.present_occluded = result == DXGI_STATUS_OCCLUDED;
        if result == DXGI_ERROR_WAS_STILL_DRAWING {
            self.present_retry_pending = true;
            self.request_frame_timer_resolution();
            if !self.frame_latency_wait.bypassed {
                self.frame_latency_ready_permits = 1;
            }
            self.present_busy_count = self.present_busy_count.saturating_add(1);
            self.frame_latency_not_ready_count =
                self.frame_latency_not_ready_count.saturating_add(1);
            return Ok(None);
        }
        if result.is_err() && result != DXGI_STATUS_OCCLUDED {
            return Err(format!(
                "IDXGISwapChain::Present failed: 0x{:08X}",
                result.0 as u32
            ));
        }
        if result.is_ok() {
            let mut statistics = DXGI_FRAME_STATISTICS::default();
            if swap_chain.GetFrameStatistics(&mut statistics).is_ok() {
                self.frame_statistics_available = true;
                if let (Some(previous_present_count), Some(previous_refresh_count)) = (
                    self.last_frame_statistics_present_count,
                    self.last_frame_statistics_refresh_count,
                ) {
                    let present_delta = frame_statistics_counter_delta(
                        statistics.PresentCount,
                        previous_present_count,
                    );
                    let refresh_delta = frame_statistics_counter_delta(
                        statistics.PresentRefreshCount,
                        previous_refresh_count,
                    );
                    if let (Some(present_delta), Some(refresh_delta)) =
                        (present_delta, refresh_delta)
                    {
                        if previous_present_count == 0
                            || previous_refresh_count == 0
                            || present_delta == 0
                        {
                            self.last_frame_statistics_present_delta = 0;
                            self.last_frame_statistics_refresh_delta = 0;
                        } else {
                            let repeated_refreshes = refresh_delta.saturating_sub(present_delta);
                            self.last_frame_statistics_present_delta = present_delta;
                            self.last_frame_statistics_refresh_delta = refresh_delta;
                            self.repeated_refresh_count = self
                                .repeated_refresh_count
                                .saturating_add(u64::from(repeated_refreshes));
                            self.max_repeated_refreshes_per_sample = self
                                .max_repeated_refreshes_per_sample
                                .max(repeated_refreshes);
                        }
                    } else {
                        self.last_frame_statistics_present_delta = 0;
                        self.last_frame_statistics_refresh_delta = 0;
                    }
                }
                self.last_frame_statistics_present_count = Some(statistics.PresentCount);
                self.last_frame_statistics_refresh_count = Some(statistics.PresentRefreshCount);
            }
        }
        if self
            .present_mode
            .needs_frame_timer_resolution(self.frame_latency_wait.bypassed, false)
        {
            self.request_frame_timer_resolution();
        } else {
            self.release_frame_timer_resolution();
        }
        Ok(Some(result.0))
    }

    pub fn has_source(&self) -> bool {
        self.source_view.is_some()
    }

    pub fn width(&self) -> u32 {
        self.width
    }

    pub fn height(&self) -> u32 {
        self.height
    }

    pub fn source_width(&self) -> u32 {
        self.source_width
    }

    pub fn source_height(&self) -> u32 {
        self.source_height
    }

    pub fn source_mode(&self) -> Option<&'static str> {
        self.source_mode.map(SourceMode::as_str)
    }

    pub fn feature_level(&self) -> i32 {
        self.feature_level.0
    }

    pub fn adapter_name(&self) -> &str {
        &self.adapter_name
    }

    pub fn last_present(&self) -> i32 {
        self.last_present
    }

    pub fn set_present_sync_interval(&mut self, sync_interval: u32) {
        self.present_sync_interval = sync_interval.clamp(1, 4);
    }

    pub fn present_sync_interval(&self) -> u32 {
        self.present_mode
            .parameters(self.present_sync_interval, self.frame_latency_wait.bypassed)
            .0
    }

    pub fn set_present_frame_rate(&mut self, frame_rate: Option<f64>) {
        self.present_budget_ms = frame_rate
            .filter(|value| value.is_finite() && *value > 0.0)
            .map(|value| 1_000.0 / value);
    }

    pub fn present_busy(&self) -> bool {
        self.present_retry_pending
    }

    pub fn suspend_presentation(&mut self) {
        self.present_retry_pending = false;
        self.release_frame_timer_resolution();
    }

    pub fn present_diagnostics(&self) -> serde_json::Value {
        serde_json::json!({
            "mode": self.present_mode.as_str(),
            "lastFlags": self.last_present_flags,
            "lastResult": self.last_present,
            "budgetMs": self.present_budget_ms,
            "overBudgetCount": self.present_over_budget_count,
            "busyCount": self.present_busy_count,
        })
    }

    pub fn frame_latency_waitable(&self) -> bool {
        !self.frame_latency_waitable_object.is_invalid()
    }

    pub fn duplicate_frame_latency_wait_handle(
        &self,
    ) -> Result<Option<FrameLatencyWaitHandle>, String> {
        if self.frame_latency_waitable_object.is_invalid() || self.frame_latency_wait.bypassed {
            return Ok(None);
        }

        let process = unsafe { GetCurrentProcess() };
        let mut duplicated = HANDLE::default();
        unsafe {
            DuplicateHandle(
                process,
                self.frame_latency_waitable_object,
                process,
                &mut duplicated,
                0,
                false,
                DUPLICATE_SAME_ACCESS,
            )
            .map_err(|error| format!("DuplicateHandle for DXGI frame latency failed: {error}"))?;
        }
        Ok(Some(FrameLatencyWaitHandle {
            handle: duplicated,
            generation: self.frame_latency_wait_generation,
        }))
    }

    pub fn grant_frame_latency_ready_permit(&mut self, generation: u64) -> bool {
        if generation == 0
            || generation != self.frame_latency_wait_generation
            || self.frame_latency_waitable_object.is_invalid()
            || self.frame_latency_wait.bypassed
        {
            return false;
        }
        self.frame_latency_wait.record_ready();
        self.frame_latency_ready_permits =
            self.frame_latency_ready_permits.saturating_add(1).min(1);
        self.async_frame_latency_ready_count =
            self.async_frame_latency_ready_count.saturating_add(1);
        true
    }

    pub fn bypass_frame_latency_wait(&mut self, generation: u64) -> bool {
        if generation == 0
            || generation != self.frame_latency_wait_generation
            || self.frame_latency_waitable_object.is_invalid()
        {
            return false;
        }
        self.frame_latency_wait.bypass();
        self.frame_latency_ready_permits = 0;
        self.request_frame_timer_resolution();
        true
    }

    pub fn record_frame_latency_timeout(
        &mut self,
        generation: u64,
        expected: bool,
    ) -> Option<FrameLatencyTimeoutOutcome> {
        if generation == 0
            || generation != self.frame_latency_wait_generation
            || self.frame_latency_waitable_object.is_invalid()
        {
            return None;
        }
        let outcome = self
            .frame_latency_wait
            .record_timeout(expected || self.present_occluded);
        if outcome == FrameLatencyTimeoutOutcome::Bypassed {
            self.frame_latency_ready_permits = 0;
            self.request_frame_timer_resolution();
        }
        Some(outcome)
    }

    pub fn rearm_frame_latency_wait(&mut self) -> bool {
        if self.frame_latency_waitable_object.is_invalid() || !self.frame_latency_wait.rearm() {
            return false;
        }
        self.frame_latency_ready_permits = 0;
        self.release_frame_timer_resolution();
        true
    }

    pub fn present_occluded(&self) -> bool {
        self.present_occluded
    }

    pub fn frame_latency_wait_diagnostics(&self) -> serde_json::Value {
        let gate = &self.frame_latency_wait;
        serde_json::json!({
            "bypassed": gate.bypassed,
            "consecutiveTimeouts": gate.consecutive_timeouts,
            "bypassTimeoutThreshold": FRAME_LATENCY_WAIT_BYPASS_TIMEOUTS,
            "bypassCount": gate.bypass_count,
            "rearmCount": gate.rearm_count,
            "expectedTimeoutCount": gate.expected_timeout_count,
            "presentOccluded": self.present_occluded,
        })
    }

    pub fn shared_texture_copy_gpu_timing_diagnostics(&self) -> serde_json::Value {
        self.dedicated_copy
            .as_ref()
            .and_then(|dedicated| dedicated.gpu_timing.as_ref())
            .or(self.gpu_copy_timing.as_ref())
            .map_or(serde_json::Value::Null, GpuCopyTiming::diagnostics)
    }

    pub fn shared_texture_copy_dedicated_device_diagnostics(&self) -> serde_json::Value {
        self.dedicated_copy_diagnostics()
    }

    pub fn adapter_diagnostics(&self) -> serde_json::Value {
        let output_luid = unsafe {
            output_adapter_luid_for_window(self.window).or_else(|| {
                self.swap_chain
                    .as_ref()
                    .and_then(|swap_chain| swap_chain.GetContainingOutput().ok())
                    .and_then(|output| output.GetParent::<IDXGIAdapter>().ok())
                    .and_then(|adapter| adapter.GetDesc().ok())
                    .map(|desc| desc.AdapterLuid)
            })
        };
        let luid_equal = |left: Option<LUID>, right: Option<LUID>| match (left, right) {
            (Some(left), Some(right)) => {
                Some(left.HighPart == right.HighPart && left.LowPart == right.LowPart)
            }
            _ => None,
        };
        serde_json::json!({
            "hostAdapterLuid": self.host_adapter_luid.map(adapter_luid_string),
            "textureAdapterLuid": self.texture_adapter_luid.map(adapter_luid_string),
            "outputAdapterLuid": output_luid.map(adapter_luid_string),
            "crossAdapterPresent": luid_equal(self.host_adapter_luid, output_luid).map(|same| !same),
            "crossAdapterTexture": luid_equal(self.host_adapter_luid, self.texture_adapter_luid).map(|same| !same),
        })
    }

    pub fn frame_latency_wait_counts(&self) -> (u64, u64, u64) {
        (
            self.frame_latency_wait.bypass_count,
            self.frame_latency_wait.rearm_count,
            self.frame_latency_wait.expected_timeout_count,
        )
    }

    fn request_frame_timer_resolution(&mut self) {
        if !self.fallback_timer_resolution_requested {
            self.fallback_timer_resolution_requested = true;
            self.fallback_timer_resolution_active = unsafe { timeBeginPeriod(1) == TIMERR_NOERROR };
        }
    }

    fn release_frame_timer_resolution(&mut self) {
        if self.fallback_timer_resolution_active {
            unsafe {
                let _ = timeEndPeriod(1);
            }
            self.fallback_timer_resolution_active = false;
        }
        self.fallback_timer_resolution_requested = false;
    }

    pub fn frame_latency_wait_bypassed(&self) -> bool {
        self.frame_latency_wait.bypassed
    }

    pub fn fallback_timer_resolution_requested(&self) -> bool {
        self.fallback_timer_resolution_requested
    }

    pub fn fallback_timer_resolution_active(&self) -> bool {
        self.fallback_timer_resolution_active
    }

    pub fn async_frame_latency_ready_count(&self) -> u64 {
        self.async_frame_latency_ready_count
    }

    pub fn frame_latency_wait_timeout_count(&self) -> u64 {
        self.frame_latency_wait_timeout_count
    }

    pub fn frame_latency_not_ready_count(&self) -> u64 {
        self.frame_latency_not_ready_count
    }

    pub fn last_render_interval_ms(&self) -> f64 {
        self.last_render_interval_ms
    }

    pub fn max_render_interval_ms(&self) -> f64 {
        self.max_render_interval_ms
    }

    pub fn render_interval_over_25_ms_count(&self) -> u64 {
        self.render_interval_over_25_ms_count
    }

    pub fn render_interval_over_50_ms_count(&self) -> u64 {
        self.render_interval_over_50_ms_count
    }

    pub fn render_interval_over_100_ms_count(&self) -> u64 {
        self.render_interval_over_100_ms_count
    }

    pub fn last_frame_latency_wait_duration_ms(&self) -> f64 {
        self.last_frame_latency_wait_duration_ms
    }

    pub fn max_frame_latency_wait_duration_ms(&self) -> f64 {
        self.max_frame_latency_wait_duration_ms
    }

    pub fn frame_latency_wait_over_25_ms_count(&self) -> u64 {
        self.frame_latency_wait_over_25_ms_count
    }

    pub fn last_present_duration_ms(&self) -> f64 {
        self.last_present_duration_ms
    }

    pub fn max_present_duration_ms(&self) -> f64 {
        self.max_present_duration_ms
    }

    pub fn present_over_25_ms_count(&self) -> u64 {
        self.present_over_25_ms_count
    }

    pub fn last_render_duration_ms(&self) -> f64 {
        self.last_render_duration_ms
    }

    pub fn max_render_duration_ms(&self) -> f64 {
        self.max_render_duration_ms
    }

    pub fn render_over_25_ms_count(&self) -> u64 {
        self.render_over_25_ms_count
    }

    pub fn frame_statistics_available(&self) -> bool {
        self.frame_statistics_available
    }

    pub fn frame_statistics_present_count(&self) -> Option<u32> {
        self.last_frame_statistics_present_count
    }

    pub fn frame_statistics_refresh_count(&self) -> Option<u32> {
        self.last_frame_statistics_refresh_count
    }

    pub fn last_frame_statistics_present_delta(&self) -> u32 {
        self.last_frame_statistics_present_delta
    }

    pub fn last_frame_statistics_refresh_delta(&self) -> u32 {
        self.last_frame_statistics_refresh_delta
    }

    pub fn repeated_refresh_count(&self) -> u64 {
        self.repeated_refresh_count
    }

    pub fn max_repeated_refreshes_per_sample(&self) -> u32 {
        self.max_repeated_refreshes_per_sample
    }

    pub fn shared_texture_copy_slow_count(&self) -> u64 {
        self.shared_texture_copy_telemetry
            .slow_count
            .load(Ordering::Relaxed)
    }

    pub fn shared_texture_copy_timeout_count(&self) -> u64 {
        self.shared_texture_copy_telemetry
            .timeout_count
            .load(Ordering::Relaxed)
    }

    pub fn shared_texture_copy_fatal_timeout_count(&self) -> u64 {
        self.shared_texture_copy_telemetry
            .fatal_timeout_count
            .load(Ordering::Relaxed)
    }

    pub fn shared_texture_copy_completed_count(&self) -> u64 {
        self.shared_texture_copy_telemetry
            .completed_count
            .load(Ordering::Relaxed)
    }

    pub fn shared_texture_copy_submission_failure_count(&self) -> u64 {
        self.shared_texture_copy_telemetry
            .submission_failure_count
            .load(Ordering::Relaxed)
    }

    pub fn shared_texture_copy_terminal_failure_count(&self) -> u64 {
        self.shared_texture_copy_telemetry
            .terminal_failure_count
            .load(Ordering::Relaxed)
    }

    pub fn last_shared_texture_copy_duration_ms(&self) -> f64 {
        self.shared_texture_copy_telemetry
            .last_duration_micros
            .load(Ordering::Relaxed) as f64
            / 1_000.0
    }

    pub fn last_shared_texture_copy_dispatch_delay_ms(&self) -> f64 {
        self.shared_texture_copy_telemetry
            .last_dispatch_delay_micros
            .load(Ordering::Relaxed) as f64
            / 1_000.0
    }

    pub fn max_shared_texture_copy_dispatch_delay_ms(&self) -> f64 {
        self.shared_texture_copy_telemetry
            .max_dispatch_delay_micros
            .load(Ordering::Relaxed) as f64
            / 1_000.0
    }

    pub fn max_shared_texture_copy_duration_ms(&self) -> f64 {
        self.shared_texture_copy_telemetry
            .max_duration_micros
            .load(Ordering::Relaxed) as f64
            / 1_000.0
    }

    pub fn shared_texture_copy_completion_mode(&self) -> &'static str {
        shared_texture_copy_completion_mode_name(
            self.shared_texture_copy_fence.is_some(),
            self.shared_texture_copy_slots.len(),
        )
    }

    pub fn shared_texture_fence_wait_diagnostics(&self) -> serde_json::Value {
        let telemetry = &self.shared_texture_copy_telemetry.fence_wait;
        serde_json::json!({
            "eventTimeoutCount": telemetry.event_timeout_count.load(Ordering::Relaxed),
            "completedAfterTimeoutCount": telemetry.completed_after_timeout_count.load(Ordering::Relaxed),
            "earlyEventCount": telemetry.early_event_count.load(Ordering::Relaxed),
            "eventFailureCount": telemetry.event_failure_count.load(Ordering::Relaxed),
        })
    }

    pub fn shared_texture_copies_in_flight(&self) -> u64 {
        self.shared_texture_copy_slots
            .iter()
            .filter(|slot| slot.in_flight.load(Ordering::Acquire))
            .count() as u64
    }

    pub fn max_shared_texture_copies_in_flight(&self) -> u64 {
        self.max_shared_texture_copies_in_flight
    }

    pub fn shared_texture_copy_saturation_drop_count(&self) -> u64 {
        self.shared_texture_copy_saturation_drop_count
    }

    pub fn shared_texture_full_copy_count(&self) -> u64 {
        self.shared_texture_full_copy_count
    }

    pub fn shared_texture_partial_copy_count(&self) -> u64 {
        self.shared_texture_partial_copy_count
    }

    pub fn shared_texture_storage_recreate_count(&self) -> u64 {
        self.shared_texture_storage_recreate_count
    }

    pub fn source_format(&self) -> i32 {
        self.source_format.0
    }

    pub fn source_sample_count(&self) -> u32 {
        self.source_sample_count
    }

    pub fn last_shared_texture_content_rect(&self) -> [u32; 4] {
        self.last_shared_texture_content_rect
    }

    pub fn last_shared_texture_presentation_rect(&self) -> [u32; 4] {
        self.last_shared_texture_presentation_rect
    }

    pub fn cpu_upload_count(&self) -> u64 {
        self.cpu_upload_count
    }

    pub fn shared_texture_import_count(&self) -> u64 {
        self.shared_texture_import_count
    }
}

impl Drop for WindowsD3d11Renderer {
    fn drop(&mut self) {
        self.release_frame_timer_resolution();
        if !self.frame_latency_waitable_object.is_invalid() {
            unsafe {
                let _ = CloseHandle(self.frame_latency_waitable_object);
            }
            self.frame_latency_waitable_object = HANDLE::default();
        }
    }
}

#[cfg(test)]
mod shared_texture_copy_slot_tests {
    use super::{
        poll_shared_texture_copy_fence, register_shared_texture_copy_fence_event,
        shared_texture_copy_completion_mode_name, try_candidates_in_order,
        try_reserve_shared_texture_copy_slot, SharedTextureCopyCompletion, SharedTextureCopySlot,
        SharedTextureCopyTelemetry, SharedTextureCopyWaitHandle, SharedTextureFenceWaitTelemetry,
        WindowsD3d11Renderer, SHARED_TEXTURE_COPY_SLOT_COUNT,
    };
    use std::sync::atomic::{AtomicBool, Ordering};
    use std::sync::{Arc, Mutex};
    use std::time::{Duration, Instant};
    use windows::core::Interface;
    use windows::Win32::Foundation::{
        HANDLE, WAIT_EVENT, WAIT_FAILED, WAIT_OBJECT_0, WAIT_TIMEOUT,
    };
    use windows::Win32::Graphics::Direct3D11::{
        D3D11_BIND_RENDER_TARGET, D3D11_BIND_SHADER_RESOURCE, D3D11_QUERY_DESC, D3D11_QUERY_EVENT,
        D3D11_TEXTURE2D_DESC, D3D11_USAGE_DEFAULT,
    };
    use windows::Win32::Graphics::Dxgi::Common::{DXGI_FORMAT_B8G8R8A8_UNORM, DXGI_SAMPLE_DESC};
    use windows::Win32::System::Threading::{CreateEventW, SetEvent, WaitForSingleObjectEx};

    #[test]
    fn reused_fence_event_clears_old_notifications_without_losing_new_ones() {
        let slot = SharedTextureCopySlot {
            event: unsafe { CreateEventW(None, false, false, None) }.unwrap(),
            query: None,
            in_flight: AtomicBool::new(false),
        };
        for _ in 0..128 {
            unsafe { SetEvent(slot.event) }.unwrap();
            let mut cleared_before_registration = false;
            assert!(register_shared_texture_copy_fence_event(slot.event, || {
                cleared_before_registration =
                    unsafe { WaitForSingleObjectEx(slot.event, 0, false) } == WAIT_TIMEOUT;
                unsafe { SetEvent(slot.event) }.unwrap();
                true
            }));
            assert!(cleared_before_registration);
            assert_eq!(
                unsafe { WaitForSingleObjectEx(slot.event, 0, false) },
                WAIT_OBJECT_0
            );
        }
    }

    #[test]
    fn failed_fence_event_reset_does_not_register_an_unusable_handle() {
        let mut registered = false;
        assert!(!register_shared_texture_copy_fence_event(
            HANDLE::default(),
            || {
                registered = true;
                true
            }
        ));
        assert!(!registered);
    }

    #[test]
    fn completed_fence_recovers_a_missing_event_notification() {
        let mut use_event_wait = true;
        let mut reads = 0;
        let telemetry = SharedTextureFenceWaitTelemetry::default();
        assert_eq!(
            poll_shared_texture_copy_fence(
                7,
                &mut use_event_wait,
                &telemetry,
                || {
                    reads += 1;
                    if reads == 1 {
                        6
                    } else {
                        7
                    }
                },
                || WAIT_TIMEOUT
            ),
            Ok(true)
        );
        assert_eq!(reads, 2);
        assert_eq!(telemetry.event_timeout_count.load(Ordering::Relaxed), 1);
        assert_eq!(
            telemetry
                .completed_after_timeout_count
                .load(Ordering::Relaxed),
            1
        );
        assert!(use_event_wait);
    }

    #[test]
    fn stale_event_cannot_release_an_unfinished_producer() {
        let mut use_event_wait = true;
        let telemetry = SharedTextureFenceWaitTelemetry::default();
        assert_eq!(
            poll_shared_texture_copy_fence(
                7,
                &mut use_event_wait,
                &telemetry,
                || 6,
                || WAIT_OBJECT_0
            ),
            Ok(false)
        );
        assert!(!use_event_wait);
        assert_eq!(telemetry.early_event_count.load(Ordering::Relaxed), 1);
        assert_eq!(
            poll_shared_texture_copy_fence(
                7,
                &mut use_event_wait,
                &telemetry,
                || 7,
                || { panic!("stale signals must fall back to bounded fence polling") }
            ),
            Ok(true)
        );
    }

    #[test]
    fn removed_device_fence_is_not_successful_completion() {
        assert!(poll_shared_texture_copy_fence(
            7,
            &mut false,
            &SharedTextureFenceWaitTelemetry::default(),
            || u64::MAX,
            || { panic!("polling fallback must not wait on an event") }
        )
        .is_err());
    }

    #[test]
    fn completed_fence_fast_path_does_not_register_or_wait_on_an_event() {
        let telemetry = SharedTextureFenceWaitTelemetry::default();
        for completed in [7, 8, u64::MAX - 1] {
            assert_eq!(
                poll_shared_texture_copy_fence(
                    7,
                    &mut true,
                    &telemetry,
                    || completed,
                    || { panic!("completed copies must not call the event API") }
                ),
                Ok(true)
            );
        }
        assert_eq!(telemetry.event_timeout_count.load(Ordering::Relaxed), 0);
        assert_eq!(
            telemetry
                .completed_after_timeout_count
                .load(Ordering::Relaxed),
            0
        );
        assert_eq!(telemetry.early_event_count.load(Ordering::Relaxed), 0);
        assert_eq!(telemetry.event_failure_count.load(Ordering::Relaxed), 0);
    }

    #[test]
    fn unfinished_fence_timeouts_do_not_release_or_claim_recovery() {
        let telemetry = SharedTextureFenceWaitTelemetry::default();
        let mut use_event_wait = true;
        for _ in 0..60 {
            assert_eq!(
                poll_shared_texture_copy_fence(
                    7,
                    &mut use_event_wait,
                    &telemetry,
                    || 6,
                    || WAIT_TIMEOUT
                ),
                Ok(false)
            );
        }
        assert!(use_event_wait);
        assert_eq!(telemetry.event_timeout_count.load(Ordering::Relaxed), 60);
        assert_eq!(
            telemetry
                .completed_after_timeout_count
                .load(Ordering::Relaxed),
            0
        );
    }

    #[test]
    fn fence_wait_failure_uses_authoritative_bounded_polling() {
        for failure in [WAIT_FAILED, WAIT_EVENT(0x80)] {
            let telemetry = SharedTextureFenceWaitTelemetry::default();
            let mut use_event_wait = true;
            assert_eq!(
                poll_shared_texture_copy_fence(
                    7,
                    &mut use_event_wait,
                    &telemetry,
                    || 6,
                    || failure
                ),
                Ok(false)
            );
            assert!(!use_event_wait);
            assert_eq!(telemetry.event_failure_count.load(Ordering::Relaxed), 1);
            assert_eq!(
                poll_shared_texture_copy_fence(
                    7,
                    &mut use_event_wait,
                    &telemetry,
                    || 7,
                    || { panic!("failed event must not be reused for this copy") }
                ),
                Ok(true)
            );
        }
    }

    #[test]
    fn device_removal_during_a_signaled_wait_is_not_completion() {
        for result in [WAIT_OBJECT_0, WAIT_TIMEOUT, WAIT_FAILED] {
            let mut reads = 0;
            assert!(poll_shared_texture_copy_fence(
                7,
                &mut true,
                &SharedTextureFenceWaitTelemetry::default(),
                || {
                    reads += 1;
                    if reads == 1 {
                        6
                    } else {
                        u64::MAX
                    }
                },
                || result
            )
            .is_err());
        }
    }

    #[test]
    #[ignore = "requires an interactive Windows D3D11 hardware device"]
    fn paused_presentation_releases_busy_retry_without_losing_diagnostics() {
        unsafe {
            let mut renderer =
                WindowsD3d11Renderer::new_with_adapter(std::ptr::null_mut(), 64, 64, None, false)
                    .expect("headless D3D11 renderer should initialize");
            renderer.last_present = windows::Win32::Graphics::Dxgi::DXGI_ERROR_WAS_STILL_DRAWING.0;
            renderer.request_frame_timer_resolution();
            assert!(
                !renderer.present_busy(),
                "an idle renderer must not inherit a historical busy result"
            );
            renderer.present_retry_pending = true;
            renderer.frame_latency_ready_permits = 1;
            assert!(renderer.present_busy());
            renderer.suspend_presentation();
            renderer.suspend_presentation();
            assert!(!renderer.present_busy());
            assert!(!renderer.fallback_timer_resolution_requested());
            assert!(!renderer.fallback_timer_resolution_active());
            assert_eq!(renderer.frame_latency_ready_permits, 1);
            assert_eq!(
                renderer.last_present,
                windows::Win32::Graphics::Dxgi::DXGI_ERROR_WAS_STILL_DRAWING.0
            );
            renderer.request_frame_timer_resolution();
            assert!(renderer.fallback_timer_resolution_requested());
        }
    }

    #[test]
    #[ignore = "requires an interactive Windows D3D11 hardware device"]
    fn fence_completion_recovers_missing_notifications_on_hardware() {
        unsafe {
            let renderer =
                WindowsD3d11Renderer::new_with_adapter(std::ptr::null_mut(), 64, 64, None, false)
                    .expect("headless D3D11 renderer should initialize");
            let fence = renderer
                .shared_texture_copy_fence
                .as_ref()
                .expect("hardware must support fences");
            let context = renderer
                .shared_texture_copy_context4
                .as_ref()
                .expect("fence context should exist");
            let baseline_event = renderer.shared_texture_copy_slots[0].event;
            let repaired_event = renderer.shared_texture_copy_slots[1].event;
            let desc = D3D11_TEXTURE2D_DESC {
                Width: 1920,
                Height: 1080,
                MipLevels: 1,
                ArraySize: 1,
                Format: DXGI_FORMAT_B8G8R8A8_UNORM,
                SampleDesc: DXGI_SAMPLE_DESC {
                    Count: 1,
                    Quality: 0,
                },
                Usage: D3D11_USAGE_DEFAULT,
                BindFlags: (D3D11_BIND_RENDER_TARGET | D3D11_BIND_SHADER_RESOURCE).0 as u32,
                CPUAccessFlags: 0,
                MiscFlags: 0,
            };
            let mut source = None;
            let mut destination = None;
            renderer
                .device
                .CreateTexture2D(&desc, None, Some(&mut source))
                .unwrap();
            renderer
                .device
                .CreateTexture2D(&desc, None, Some(&mut destination))
                .unwrap();
            let source = source.unwrap();
            let destination = destination.unwrap();
            renderer.context.CopyResource(&destination, &source);
            context.Signal(fence, 1).unwrap();
            renderer.context.Flush();
            let telemetry = SharedTextureFenceWaitTelemetry::default();
            let mut initial_read = true;
            let mut use_event_wait = true;
            let started = Instant::now();
            loop {
                if poll_shared_texture_copy_fence(
                    1,
                    &mut use_event_wait,
                    &telemetry,
                    || {
                        if initial_read {
                            initial_read = false;
                            0
                        } else {
                            fence.GetCompletedValue()
                        }
                    },
                    || {
                        std::thread::sleep(Duration::from_millis(10));
                        WAIT_TIMEOUT
                    },
                )
                .unwrap()
                {
                    break;
                }
                assert!(
                    started.elapsed() < Duration::from_secs(2),
                    "real copy must complete without event notification"
                );
            }
            assert_eq!(
                telemetry
                    .completed_after_timeout_count
                    .load(Ordering::Relaxed),
                1
            );
            assert!(fence.GetCompletedValue() >= 1 && fence.GetCompletedValue() != u64::MAX);

            let mut baseline_micros = Vec::with_capacity(256);
            let mut repaired_micros = Vec::with_capacity(256);
            let mut value = 1;
            for iteration in 0..288 {
                for repaired in if iteration % 2 == 0 {
                    [false, true]
                } else {
                    [true, false]
                } {
                    value += 1;
                    let started = Instant::now();
                    renderer.context.CopyResource(&destination, &source);
                    context.Signal(fence, value).unwrap();
                    renderer.context.Flush();
                    if repaired {
                        let mut registered = false;
                        let mut use_event_wait = true;
                        while !poll_shared_texture_copy_fence(
                            value,
                            &mut use_event_wait,
                            &telemetry,
                            || fence.GetCompletedValue(),
                            || {
                                if !registered {
                                    registered = true;
                                    assert!(register_shared_texture_copy_fence_event(
                                        repaired_event,
                                        || fence
                                            .SetEventOnCompletion(value, repaired_event)
                                            .is_ok()
                                    ));
                                }
                                WaitForSingleObjectEx(repaired_event, 10, false)
                            },
                        )
                        .unwrap()
                        {
                            assert!(started.elapsed() < Duration::from_secs(2));
                            if !use_event_wait {
                                std::thread::sleep(Duration::from_millis(1));
                            }
                        }
                    } else {
                        fence.SetEventOnCompletion(value, baseline_event).unwrap();
                        assert_eq!(
                            WaitForSingleObjectEx(baseline_event, 2_000, false),
                            WAIT_OBJECT_0
                        );
                    }
                    let elapsed_micros = started.elapsed().as_secs_f64() * 1_000_000.0;
                    let completed = fence.GetCompletedValue();
                    assert!(completed >= value && completed != u64::MAX);
                    if iteration >= 32 {
                        if repaired {
                            &mut repaired_micros
                        } else {
                            &mut baseline_micros
                        }
                        .push(elapsed_micros);
                    }
                }
            }
            let adapter = renderer
                .device
                .cast::<windows::Win32::Graphics::Dxgi::IDXGIDevice>()
                .unwrap()
                .GetAdapter()
                .unwrap()
                .cast::<windows::Win32::Graphics::Dxgi::IDXGIAdapter1>()
                .unwrap();
            println!(
                "Hardware fence test adapter: {}",
                super::adapter_name(&adapter).unwrap()
            );
            for (name, mut values) in [("baseline", baseline_micros), ("repaired", repaired_micros)]
            {
                values.sort_by(f64::total_cmp);
                println!(
                    "{name} real 1080p copy+completion: median={:.3}us p95={:.3}us mean={:.3}us",
                    values[128],
                    values[243],
                    values.iter().sum::<f64>() / values.len() as f64
                );
            }
        }
    }

    fn slots() -> Vec<Arc<SharedTextureCopySlot>> {
        (0..SHARED_TEXTURE_COPY_SLOT_COUNT)
            .map(|_| {
                Arc::new(SharedTextureCopySlot {
                    event: HANDLE::default(),
                    query: None,
                    in_flight: AtomicBool::new(false),
                })
            })
            .collect()
    }

    #[test]
    fn bounds_in_flight_copies_and_reuses_only_a_released_slot() {
        let slots = slots();
        let mut reservations = Vec::new();
        for _ in 0..SHARED_TEXTURE_COPY_SLOT_COUNT {
            reservations.push(
                try_reserve_shared_texture_copy_slot(&slots)
                    .expect("each free copy slot should be reservable"),
            );
        }
        assert!(try_reserve_shared_texture_copy_slot(&slots).is_none());
        assert!(slots
            .iter()
            .all(|slot| slot.in_flight.load(Ordering::Acquire)));

        reservations.pop();
        assert_eq!(
            slots
                .iter()
                .filter(|slot| slot.in_flight.load(Ordering::Acquire))
                .count(),
            SHARED_TEXTURE_COPY_SLOT_COUNT - 1
        );
        assert!(try_reserve_shared_texture_copy_slot(&slots).is_some());
    }

    #[test]
    fn reports_fence_query_and_synchronous_completion_capabilities() {
        assert_eq!(
            shared_texture_copy_completion_mode_name(true, SHARED_TEXTURE_COPY_SLOT_COUNT),
            "d3d11-fence-async"
        );
        assert_eq!(
            shared_texture_copy_completion_mode_name(false, SHARED_TEXTURE_COPY_SLOT_COUNT),
            "d3d11-query-async"
        );
        assert_eq!(
            shared_texture_copy_completion_mode_name(false, 0),
            "d3d11-query-legacy-only"
        );
    }

    #[test]
    fn adapter_fallback_preserves_order_and_reports_every_failed_candidate() {
        let mut attempts = Vec::new();
        let selected = try_candidates_in_order(
            vec![
                ("preferred".to_owned(), 1),
                ("integrated".to_owned(), 2),
                ("default".to_owned(), 3),
            ],
            |candidate| {
                attempts.push(candidate);
                (candidate == 2)
                    .then_some(candidate)
                    .ok_or_else(|| format!("candidate {candidate} failed"))
            },
        )
        .expect("the second hardware adapter should be selected");
        assert_eq!(selected, 2);
        assert_eq!(attempts, vec![1, 2]);

        let failures = try_candidates_in_order(
            vec![("first".to_owned(), 1), ("second".to_owned(), 2)],
            |candidate| Err::<(), _>(format!("failure {candidate}")),
        )
        .expect_err("all adapter failures should remain diagnostic");
        assert_eq!(failures, vec!["first: failure 1", "second: failure 2"]);
    }

    #[test]
    #[ignore = "requires an interactive Windows D3D11 hardware device"]
    fn event_query_completion_serializes_the_context_and_releases_its_slot() {
        unsafe {
            let renderer =
                WindowsD3d11Renderer::new_with_adapter(std::ptr::null_mut(), 64, 64, None, false)
                    .expect("headless D3D11 renderer should initialize");
            let texture_desc = D3D11_TEXTURE2D_DESC {
                Width: 64,
                Height: 64,
                MipLevels: 1,
                ArraySize: 1,
                Format: DXGI_FORMAT_B8G8R8A8_UNORM,
                SampleDesc: DXGI_SAMPLE_DESC {
                    Count: 1,
                    Quality: 0,
                },
                Usage: D3D11_USAGE_DEFAULT,
                BindFlags: (D3D11_BIND_RENDER_TARGET | D3D11_BIND_SHADER_RESOURCE).0 as u32,
                CPUAccessFlags: 0,
                MiscFlags: 0,
            };
            let mut source = None;
            let mut destination = None;
            renderer
                .device
                .CreateTexture2D(&texture_desc, None, Some(&mut source))
                .expect("source texture should be created");
            renderer
                .device
                .CreateTexture2D(&texture_desc, None, Some(&mut destination))
                .expect("destination texture should be created");
            let source = source.expect("source texture should be returned");
            let destination = destination.expect("destination texture should be returned");
            let mut query = None;
            renderer
                .device
                .CreateQuery(
                    &D3D11_QUERY_DESC {
                        Query: D3D11_QUERY_EVENT,
                        MiscFlags: 0,
                    },
                    Some(&mut query),
                )
                .expect("event query should be created");
            let query = query.expect("event query should be returned");
            let slot = Arc::new(SharedTextureCopySlot {
                event: HANDLE::default(),
                query: Some(query.clone()),
                in_flight: AtomicBool::new(true),
            });
            let telemetry = Arc::new(SharedTextureCopyTelemetry::default());
            let context_lock = Arc::new(Mutex::new(()));
            {
                let _context_guard = context_lock
                    .lock()
                    .expect("context lock should be available");
                renderer.context.CopyResource(&destination, &source);
                renderer.context.End(&query);
                renderer.context.Flush();
            }
            let wait = SharedTextureCopyWaitHandle {
                device: renderer.device.clone(),
                completion: SharedTextureCopyCompletion::Query {
                    context: renderer.context.clone(),
                    query,
                    context_lock: Arc::clone(&context_lock),
                },
                slot: Arc::clone(&slot),
                submitted_at: Instant::now(),
                telemetry: Arc::clone(&telemetry),
                submission_error: None,
            };
            let completion = std::thread::spawn(move || wait.wait());
            {
                let _context_guard = context_lock
                    .lock()
                    .expect("main context transaction should serialize with query polling");
                renderer.context.Flush();
            }
            completion
                .join()
                .expect("query worker should not panic")
                .expect("event query should prove the copy completed");
            assert_eq!(telemetry.completed_count.load(Ordering::Relaxed), 1);
            assert!(!slot.in_flight.load(Ordering::Acquire));
        }
    }
}

fn try_candidates_in_order<T, R>(
    candidates: Vec<(String, T)>,
    mut attempt: impl FnMut(T) -> Result<R, String>,
) -> Result<R, Vec<String>> {
    let mut failures = Vec::new();
    for (label, candidate) in candidates {
        match attempt(candidate) {
            Ok(result) => return Ok(result),
            Err(error) => failures.push(format!("{label}: {error}")),
        }
    }
    Err(failures)
}

unsafe fn push_hardware_adapter_candidate(
    candidates: &mut Vec<(String, Option<IDXGIAdapter1>)>,
    adapter_luids: &mut Vec<(i32, u32)>,
    adapter: IDXGIAdapter1,
) {
    let description = adapter.GetDesc1().ok();
    if description
        .as_ref()
        .is_some_and(|desc| desc.Flags & DXGI_ADAPTER_FLAG_SOFTWARE.0 as u32 != 0)
    {
        return;
    }
    if let Some(luid) = description
        .as_ref()
        .map(|desc| (desc.AdapterLuid.HighPart, desc.AdapterLuid.LowPart))
    {
        if adapter_luids.contains(&luid) {
            return;
        }
        adapter_luids.push(luid);
    }
    let label = adapter_name(&adapter).unwrap_or_else(|_| "unnamed hardware adapter".to_owned());
    candidates.push((label, Some(adapter)));
}

unsafe fn preferred_high_performance_adapter() -> Option<IDXGIAdapter1> {
    if let Ok(factory) = CreateDXGIFactory2::<IDXGIFactory6>(DXGI_CREATE_FACTORY_FLAGS(0)) {
        if let Ok(adapter) = factory
            .EnumAdapterByGpuPreference::<IDXGIAdapter1>(0, DXGI_GPU_PREFERENCE_HIGH_PERFORMANCE)
        {
            return Some(adapter);
        }
    }

    // IDXGIFactory6 requires Windows 10 1803. Retain a deterministic fallback
    // for older Windows builds and unusual DXGI implementations.
    adapters_in_enum_order().into_iter().max_by_key(|adapter| {
        adapter
            .GetDesc1()
            .map(|desc| desc.DedicatedVideoMemory)
            .unwrap_or_default()
    })
}

unsafe fn adapters_in_enum_order() -> Vec<IDXGIAdapter1> {
    let Ok(factory): Result<IDXGIFactory2, _> = CreateDXGIFactory2(DXGI_CREATE_FACTORY_FLAGS(0))
    else {
        return Vec::new();
    };
    let mut adapters = Vec::new();
    for index in 0..64 {
        match factory.EnumAdapters(index) {
            Ok(adapter) => {
                if let Ok(adapter) = adapter.cast::<IDXGIAdapter1>() {
                    adapters.push(adapter);
                }
            }
            Err(_) => break,
        }
    }
    adapters
}

unsafe fn adapter_for_shared_resource(handle: usize) -> Result<IDXGIAdapter1, String> {
    let factory: IDXGIFactory2 = CreateDXGIFactory2(DXGI_CREATE_FACTORY_FLAGS(0))
        .map_err(|error| format!("CreateDXGIFactory2 failed: {error}"))?;
    let resource_luid = factory
        .GetSharedResourceAdapterLuid(HANDLE(handle as *mut c_void))
        .map_err(|error| format!("GetSharedResourceAdapterLuid failed: {error}"))?;
    for index in 0..64 {
        let Ok(adapter) = factory.EnumAdapters(index) else {
            break;
        };
        let desc = adapter
            .GetDesc()
            .map_err(|error| format!("IDXGIAdapter::GetDesc failed: {error}"))?;
        if desc.AdapterLuid == resource_luid {
            return adapter
                .cast()
                .map_err(|error| format!("IDXGIAdapter1 is unavailable: {error}"));
        }
    }
    Err(format!(
        "No DXGI adapter matched shared-resource LUID {:08X}:{:08X}",
        resource_luid.HighPart as u32, resource_luid.LowPart
    ))
}

unsafe fn adapter_name(adapter: &IDXGIAdapter1) -> Result<String, String> {
    let desc = adapter
        .GetDesc1()
        .map_err(|error| format!("IDXGIAdapter1::GetDesc1 failed: {error}"))?;
    let length = desc
        .Description
        .iter()
        .position(|character| *character == 0)
        .unwrap_or(desc.Description.len());
    Ok(String::from_utf16_lossy(&desc.Description[..length]))
}

unsafe fn create_render_target(
    device: &ID3D11Device,
    swap_chain: &IDXGISwapChain1,
) -> Result<ID3D11RenderTargetView, String> {
    let back_buffer: ID3D11Texture2D = swap_chain
        .GetBuffer(0)
        .map_err(|error| format!("IDXGISwapChain::GetBuffer failed: {error}"))?;
    let mut render_target = None;
    device
        .CreateRenderTargetView(&back_buffer, None, Some(&mut render_target))
        .map_err(|error| format!("ID3D11Device::CreateRenderTargetView failed: {error}"))?;
    render_target.ok_or_else(|| "CreateRenderTargetView returned no view".to_owned())
}

unsafe fn create_source_view(
    device: &ID3D11Device,
    texture: &ID3D11Texture2D,
) -> Result<ID3D11ShaderResourceView, String> {
    let mut view = None;
    device
        .CreateShaderResourceView(texture, None, Some(&mut view))
        .map_err(|error| format!("ID3D11Device::CreateShaderResourceView failed: {error}"))?;
    view.ok_or_else(|| "CreateShaderResourceView returned no view".to_owned())
}

unsafe fn compile_shader(source: &[u8], target: &'static [u8]) -> Result<Vec<u8>, String> {
    let mut code: Option<ID3DBlob> = None;
    let mut errors: Option<ID3DBlob> = None;
    let result = D3DCompile(
        source.as_ptr().cast(),
        source.len(),
        PCSTR::null(),
        None,
        None::<&ID3DInclude>,
        PCSTR(c"main".as_ptr().cast()),
        PCSTR(target.as_ptr()),
        0,
        0,
        &mut code,
        Some(&mut errors),
    );
    if let Err(error) = result {
        let details = errors
            .as_ref()
            .map(|blob| {
                let bytes = slice::from_raw_parts(
                    blob.GetBufferPointer().cast::<u8>(),
                    blob.GetBufferSize(),
                );
                String::from_utf8_lossy(bytes).trim().to_owned()
            })
            .filter(|message| !message.is_empty());
        return Err(match details {
            Some(details) => format!("D3DCompile failed: {error}: {details}"),
            None => format!("D3DCompile failed: {error}"),
        });
    }
    let code = code.ok_or_else(|| "D3DCompile returned no bytecode".to_owned())?;
    Ok(slice::from_raw_parts(code.GetBufferPointer().cast::<u8>(), code.GetBufferSize()).to_vec())
}

fn aspect_fit(
    destination_width: u32,
    destination_height: u32,
    source_width: u32,
    source_height: u32,
) -> (f32, f32, f32, f32) {
    let destination_width = destination_width.max(1) as f32;
    let destination_height = destination_height.max(1) as f32;
    let source_width = source_width.max(1) as f32;
    let source_height = source_height.max(1) as f32;
    let scale = (destination_width / source_width).min(destination_height / source_height);
    let width = (source_width * scale).max(1.0);
    let height = (source_height * scale).max(1.0);
    (
        (destination_width - width) * 0.5,
        (destination_height - height) * 0.5,
        width,
        height,
    )
}

fn intersect_rect(
    first: (u32, u32, u32, u32),
    second: (u32, u32, u32, u32),
) -> Option<(u32, u32, u32, u32)> {
    let left = first.0.max(second.0);
    let top = first.1.max(second.1);
    let right = (first.0 + first.2).min(second.0 + second.2);
    let bottom = (first.1 + first.3).min(second.1 + second.3);
    (right > left && bottom > top).then_some((left, top, right - left, bottom - top))
}

#[cfg(test)]
mod hardware_window_tests;

#[cfg(test)]
mod dedicated_copy_device_tests {
    use super::{
        dedicated_copy_device_removed_error, is_device_lost_error, present_submitted_frame,
        stalled_shared_texture_copy_error, DXGI_ERROR_WAS_STILL_DRAWING, DXGI_STATUS_OCCLUDED,
    };

    #[test]
    fn only_a_submitted_present_carries_the_sampled_signal_to_the_gpu() {
        assert!(present_submitted_frame(windows::core::HRESULT(0)));
        assert!(!present_submitted_frame(DXGI_ERROR_WAS_STILL_DRAWING));
        assert!(!present_submitted_frame(DXGI_STATUS_OCCLUDED));
        assert!(!present_submitted_frame(DXGI_ERROR_DEVICE_REMOVED));
    }

    #[test]
    fn a_stalled_copy_after_either_device_was_removed_is_device_loss() {
        let removed = windows::core::Error::from(DXGI_ERROR_DEVICE_REMOVED);
        let stalled = stalled_shared_texture_copy_error(None, None);
        assert!(stalled.contains("previously stalled"));
        assert!(!is_device_lost_error(&stalled));
        let host = stalled_shared_texture_copy_error(Some(&removed), None);
        assert!(is_device_lost_error(&host), "{host}");
        let copy = stalled_shared_texture_copy_error(None, Some(&removed));
        assert!(is_device_lost_error(&copy), "{copy}");
        assert!(copy.contains("dedicated copy device"), "{copy}");
    }
    use windows::Win32::Graphics::Dxgi::{
        DXGI_ERROR_DEVICE_HUNG, DXGI_ERROR_DEVICE_REMOVED, DXGI_ERROR_DEVICE_RESET,
    };

    #[test]
    fn a_removed_dedicated_copy_device_is_reported_as_device_loss() {
        for code in [
            DXGI_ERROR_DEVICE_REMOVED,
            DXGI_ERROR_DEVICE_HUNG,
            DXGI_ERROR_DEVICE_RESET,
        ] {
            let message = dedicated_copy_device_removed_error(&windows::core::Error::from(code));
            assert!(is_device_lost_error(&message), "{message}");
        }
    }
}

#[cfg(test)]
mod adapter_and_gpu_timing_diagnostics_tests {
    use super::{
        adapter_for_monitor, adapter_luid_string, GpuCopyTimingRing, GpuCopyTimingStats,
        D3D11_QUERY_DATA_TIMESTAMP_DISJOINT, GPU_COPY_TIMING_RING_SIZE, LUID,
    };

    #[test]
    fn a_query_that_never_resolves_does_not_stop_gpu_copy_sampling() {
        let mut ring = GpuCopyTimingRing::default();
        let stuck = ring.claim().expect("first sample");
        ring.issued(stuck);
        let mut sampled = 0;
        for _ in 0..GPU_COPY_TIMING_RING_SIZE * 8 {
            if let Some(index) = ring.claim() {
                ring.issued(index);
                if index != stuck {
                    ring.resolved(index);
                }
                sampled += 1;
            }
        }
        assert!(
            sampled >= GPU_COPY_TIMING_RING_SIZE * 6,
            "sampling continued past a stuck entry only {sampled} times"
        );
        let mut reissued = false;
        for _ in 0..GPU_COPY_TIMING_RING_SIZE * 8 {
            if let Some(index) = ring.claim() {
                reissued |= index == stuck;
                ring.issued(index);
                ring.resolved(index);
            }
        }
        assert!(reissued, "a stuck entry is eventually abandoned and reused");
        assert!(ring.abandoned_count >= 1);
    }

    #[test]
    fn the_output_adapter_is_the_one_that_owns_the_window_monitor() {
        let integrated = LUID {
            LowPart: 1,
            HighPart: 0,
        };
        let discrete = LUID {
            LowPart: 2,
            HighPart: 0,
        };
        let outputs = [(discrete, 30), (integrated, 10), (integrated, 20)];
        let found = adapter_for_monitor(&20, outputs).expect("monitor owner");
        assert_eq!((found.LowPart, found.HighPart), (1, 0));
        assert!(adapter_for_monitor(&40, outputs).is_none());
    }

    #[test]
    fn adapter_luids_format_as_stable_hex_pairs() {
        assert_eq!(
            adapter_luid_string(LUID {
                LowPart: 0x0001_2f3a,
                HighPart: 0,
            }),
            "00000000-00012f3a"
        );
        assert_eq!(
            adapter_luid_string(LUID {
                LowPart: 7,
                HighPart: -1,
            }),
            "ffffffff-00000007"
        );
    }

    #[test]
    fn gpu_copy_timing_converts_ticks_and_rejects_disjoint_samples() {
        let mut stats = GpuCopyTimingStats::default();
        let frequency = D3D11_QUERY_DATA_TIMESTAMP_DISJOINT {
            Frequency: 1_000_000,
            Disjoint: false.into(),
        };
        stats.record(1_000, 1_250, frequency);
        stats.record(2_000, 2_150, frequency);
        stats.record(
            3_000,
            3_900,
            D3D11_QUERY_DATA_TIMESTAMP_DISJOINT {
                Frequency: 1_000_000,
                Disjoint: true.into(),
            },
        );
        stats.record(5_000, 4_000, frequency);
        let diagnostics = stats.diagnostics(30);
        assert_eq!(diagnostics["sampleCount"], 2);
        assert_eq!(diagnostics["disjointCount"], 2);
        assert_eq!(diagnostics["sampleInterval"], 30);
        assert!((diagnostics["lastMs"].as_f64().unwrap() - 0.15).abs() < 1e-9);
        assert!((diagnostics["maxMs"].as_f64().unwrap() - 0.25).abs() < 1e-9);
        assert!((diagnostics["meanMs"].as_f64().unwrap() - 0.2).abs() < 1e-9);
    }
}

#[cfg(test)]
mod frame_latency_wait_gate_tests {
    use super::{
        FrameLatencyTimeoutOutcome, FrameLatencyWaitGate, FRAME_LATENCY_WAIT_BYPASS_TIMEOUTS,
        FRAME_LATENCY_WAIT_REARM_READY_POLLS,
    };

    #[test]
    fn only_consecutive_unexpected_timeouts_latch_the_bypass() {
        let mut gate = FrameLatencyWaitGate::default();
        for _ in 1..FRAME_LATENCY_WAIT_BYPASS_TIMEOUTS {
            assert_eq!(
                gate.record_timeout(false),
                FrameLatencyTimeoutOutcome::Counted
            );
            assert!(!gate.bypassed);
        }
        assert_eq!(
            gate.record_timeout(false),
            FrameLatencyTimeoutOutcome::Bypassed
        );
        assert!(gate.bypassed);
        assert_eq!(gate.bypass_count, 1);
    }

    #[test]
    fn expected_timeouts_never_latch_and_restart_the_count() {
        let mut gate = FrameLatencyWaitGate::default();
        for _ in 0..10 {
            assert_eq!(
                gate.record_timeout(true),
                FrameLatencyTimeoutOutcome::Expected
            );
        }
        assert!(!gate.bypassed);
        assert_eq!(gate.expected_timeout_count, 10);
        for _ in 1..FRAME_LATENCY_WAIT_BYPASS_TIMEOUTS {
            gate.record_timeout(false);
        }
        gate.record_timeout(true);
        for _ in 1..FRAME_LATENCY_WAIT_BYPASS_TIMEOUTS {
            assert_eq!(
                gate.record_timeout(false),
                FrameLatencyTimeoutOutcome::Counted
            );
        }
        assert!(!gate.bypassed);
    }

    #[test]
    fn a_ready_signal_restarts_the_timeout_count() {
        let mut gate = FrameLatencyWaitGate::default();
        for _ in 1..FRAME_LATENCY_WAIT_BYPASS_TIMEOUTS {
            gate.record_timeout(false);
        }
        gate.record_ready();
        for _ in 1..FRAME_LATENCY_WAIT_BYPASS_TIMEOUTS {
            assert_eq!(
                gate.record_timeout(false),
                FrameLatencyTimeoutOutcome::Counted
            );
        }
        assert!(!gate.bypassed);
    }

    #[test]
    fn rearm_clears_a_latched_bypass_and_counts_each_recovery() {
        let mut gate = FrameLatencyWaitGate::default();
        assert!(!gate.rearm(), "an armed wait has nothing to re-arm");
        assert!(gate.bypass());
        assert!(!gate.bypass(), "a second bypass is not a new latch");
        assert_eq!(
            gate.record_timeout(false),
            FrameLatencyTimeoutOutcome::Bypassed
        );
        assert_eq!(gate.bypass_count, 1);
        assert!(gate.rearm());
        assert!(!gate.bypassed);
        assert_eq!(gate.rearm_count, 1);
        for _ in 1..FRAME_LATENCY_WAIT_BYPASS_TIMEOUTS {
            assert_eq!(
                gate.record_timeout(false),
                FrameLatencyTimeoutOutcome::Counted
            );
        }
    }

    #[test]
    fn consecutive_ready_polls_rearm_a_bypass_without_a_window_transition() {
        let mut gate = FrameLatencyWaitGate::default();
        assert!(
            !gate.record_bypass_poll(true),
            "an armed wait ignores bypass polls"
        );
        gate.bypass();
        for _ in 1..FRAME_LATENCY_WAIT_REARM_READY_POLLS {
            assert!(!gate.record_bypass_poll(true));
        }
        assert!(
            !gate.record_bypass_poll(false),
            "a not-ready poll restarts the count"
        );
        for _ in 1..FRAME_LATENCY_WAIT_REARM_READY_POLLS {
            assert!(!gate.record_bypass_poll(true));
        }
        assert!(gate.bypassed);
        assert!(gate.record_bypass_poll(true));
        assert!(!gate.bypassed);
        assert_eq!(gate.rearm_count, 1);
    }

    #[test]
    fn a_waitable_that_never_signals_stays_bypassed() {
        let mut gate = FrameLatencyWaitGate::default();
        gate.bypass();
        for _ in 0..1_000 {
            assert!(!gate.record_bypass_poll(false));
        }
        assert!(gate.bypassed);
        assert_eq!(gate.rearm_count, 0);
    }

    #[test]
    fn a_new_swap_chain_starts_armed_without_losing_history() {
        let mut gate = FrameLatencyWaitGate::default();
        gate.bypass();
        gate.reset_for_new_swap_chain();
        assert!(!gate.bypassed);
        assert_eq!(gate.consecutive_timeouts, 0);
        assert_eq!(gate.bypass_count, 1);
    }
}

#[cfg(test)]
mod tests {
    use super::{
        frame_statistics_counter_delta, is_device_lost_error, is_shared_texture_adapter_open_error,
        present_sync_interval_for_frame_rate, PresentMode,
    };

    #[test]
    fn nonblocking_vsync_is_default_and_legacy_comparisons_require_qa() {
        assert_eq!(
            PresentMode::from_qa_environment(false, Some("standard")),
            PresentMode::NonblockingVsync
        );
        assert_eq!(
            PresentMode::from_qa_environment(true, Some("standard")),
            PresentMode::Standard
        );
        assert_eq!(
            PresentMode::from_qa_environment(false, Some("nonblocking-vsync")),
            PresentMode::NonblockingVsync
        );
        assert_eq!(
            PresentMode::from_qa_environment(true, None),
            PresentMode::NonblockingVsync
        );
        assert_eq!(
            PresentMode::from_qa_environment(true, Some("typo")),
            PresentMode::Standard
        );
        assert_eq!(
            PresentMode::from_qa_environment(true, Some("nonblocking-vsync")),
            PresentMode::NonblockingVsync
        );
        assert_eq!(
            PresentMode::from_qa_environment(true, Some("nonblocking-immediate")),
            PresentMode::NonblockingImmediate
        );
    }

    #[test]
    fn nonblocking_present_flags_do_not_depend_on_a_readiness_timeout() {
        let parameters = |mode: PresentMode, interval, bypassed| {
            let (sync, flags) = mode.parameters(interval, bypassed);
            (sync, flags.0)
        };
        assert_eq!(parameters(PresentMode::Standard, 1, false), (1, 0));
        assert_eq!(parameters(PresentMode::NonblockingVsync, 1, false), (1, 8));
        assert_eq!(parameters(PresentMode::NonblockingVsync, 2, false), (2, 8));
        assert_eq!(
            parameters(PresentMode::NonblockingImmediate, 1, false),
            (0, 8)
        );
        for mode in [
            PresentMode::Standard,
            PresentMode::NonblockingVsync,
            PresentMode::NonblockingImmediate,
        ] {
            assert_eq!(parameters(mode, 1, true), (0, 8));
        }
    }

    #[test]
    fn high_resolution_timers_only_cover_timer_paced_presentation() {
        for mode in [PresentMode::Standard, PresentMode::NonblockingVsync] {
            assert!(!mode.needs_frame_timer_resolution(false, false));
            assert!(mode.needs_frame_timer_resolution(false, true));
            assert!(mode.needs_frame_timer_resolution(true, false));
            assert!(mode.needs_frame_timer_resolution(true, true));
            assert!(!mode.needs_frame_timer_resolution(false, false));
        }
        assert!(PresentMode::NonblockingImmediate.needs_frame_timer_resolution(false, false));
    }

    #[test]
    fn classifies_recoverable_dxgi_device_loss_codes() {
        assert!(is_device_lost_error(
            "IDXGISwapChain::ResizeBuffers failed: device removed (0x887A0005)"
        ));
        assert!(is_device_lost_error(
            "IDXGISwapChain::Present failed: 0x887A0006"
        ));
        assert!(is_device_lost_error(
            "ID3D11DeviceContext failed: 0x887a0007"
        ));
        assert!(!is_device_lost_error(
            "IDXGISwapChain::ResizeBuffers failed: invalid call (0x887A0001)"
        ));
    }

    #[test]
    fn only_adapter_open_failures_request_shared_texture_device_switches() {
        assert!(is_shared_texture_adapter_open_error(
            "ID3D11Device1::OpenSharedResource1 failed: invalid argument (0x80070057)"
        ));
        assert!(!is_shared_texture_adapter_open_error(
            "Timed out waiting 500 ms for the Electron shared texture copy"
        ));
        assert!(!is_shared_texture_adapter_open_error(
            "Electron shared texture is 1x1, expected 1280x720"
        ));
    }

    #[test]
    fn maps_supported_frame_rates_to_exact_vblank_divisors() {
        assert_eq!(
            present_sync_interval_for_frame_rate(Some(200), Some(200.0)),
            1
        );
        assert_eq!(
            present_sync_interval_for_frame_rate(Some(200), Some(100.0)),
            2
        );
        assert_eq!(
            present_sync_interval_for_frame_rate(Some(165), Some(83.0)),
            2
        );
        assert_eq!(
            present_sync_interval_for_frame_rate(Some(165), Some(55.0)),
            3
        );
        assert_eq!(
            present_sync_interval_for_frame_rate(Some(120), Some(30.0)),
            4
        );
    }

    #[test]
    fn leaves_non_divisor_and_invalid_rates_on_the_next_vblank() {
        assert_eq!(
            present_sync_interval_for_frame_rate(Some(165), Some(120.0)),
            1
        );
        assert_eq!(
            present_sync_interval_for_frame_rate(Some(200), Some(60.0)),
            1
        );
        assert_eq!(present_sync_interval_for_frame_rate(None, Some(100.0)), 1);
        assert_eq!(present_sync_interval_for_frame_rate(Some(200), None), 1);
        assert_eq!(
            present_sync_interval_for_frame_rate(Some(200), Some(f64::NAN)),
            1
        );
    }

    #[test]
    fn frame_statistics_deltas_reject_resets_and_implausible_jumps() {
        assert_eq!(frame_statistics_counter_delta(1_075, 1_000), Some(75));
        assert_eq!(frame_statistics_counter_delta(10, 1_000), None);
        assert_eq!(frame_statistics_counter_delta(20_001, 10_000), None);
    }

    #[test]
    fn frame_statistics_deltas_allow_a_small_unsigned_wrap() {
        assert_eq!(frame_statistics_counter_delta(3, u32::MAX - 2), Some(6));
    }
}
