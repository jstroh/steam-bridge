use std::ffi::c_void;
use std::slice;
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::sync::{Arc, Mutex, MutexGuard};
use std::time::{Duration, Instant};
use windows::core::{Interface, PCSTR};
use windows::Win32::Foundation::{
    CloseHandle, DuplicateHandle, DUPLICATE_SAME_ACCESS, DXGI_STATUS_OCCLUDED, HANDLE, HMODULE,
    HWND, WAIT_FAILED, WAIT_OBJECT_0, WAIT_TIMEOUT,
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
    D3D11_CREATE_DEVICE_BGRA_SUPPORT, D3D11_FENCE_FLAG_NONE, D3D11_FILTER_MIN_MAG_MIP_LINEAR,
    D3D11_QUERY_DESC, D3D11_QUERY_EVENT, D3D11_SAMPLER_DESC, D3D11_SDK_VERSION,
    D3D11_TEXTURE2D_DESC, D3D11_TEXTURE_ADDRESS_CLAMP, D3D11_USAGE_DEFAULT, D3D11_VIEWPORT,
};
use windows::Win32::Graphics::Dxgi::Common::{
    DXGI_ALPHA_MODE_IGNORE, DXGI_FORMAT, DXGI_FORMAT_B8G8R8A8_UNORM, DXGI_FORMAT_UNKNOWN,
    DXGI_SAMPLE_DESC,
};
use windows::Win32::Graphics::Dxgi::{
    CreateDXGIFactory2, IDXGIAdapter, IDXGIAdapter1, IDXGIDevice, IDXGIFactory2, IDXGIFactory6,
    IDXGIOutput, IDXGISwapChain1, IDXGISwapChain2, DXGI_ADAPTER_FLAG_SOFTWARE,
    DXGI_CREATE_FACTORY_FLAGS, DXGI_ERROR_WAS_STILL_DRAWING, DXGI_FRAME_STATISTICS,
    DXGI_GPU_PREFERENCE_HIGH_PERFORMANCE, DXGI_MWA_NO_ALT_ENTER, DXGI_PRESENT,
    DXGI_PRESENT_DO_NOT_WAIT, DXGI_SCALING_STRETCH, DXGI_SWAP_CHAIN_DESC1,
    DXGI_SWAP_CHAIN_FLAG_FRAME_LATENCY_WAITABLE_OBJECT, DXGI_SWAP_EFFECT_FLIP_SEQUENTIAL,
    DXGI_USAGE_RENDER_TARGET_OUTPUT,
};
use windows::Win32::Media::{timeBeginPeriod, timeEndPeriod, TIMERR_NOERROR};
use windows::Win32::System::Threading::{CreateEventW, GetCurrentProcess, WaitForSingleObjectEx};

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
        let event_registered = match &self.completion {
            SharedTextureCopyCompletion::Fence { fence, fence_value } => unsafe {
                fence
                    .SetEventOnCompletion(*fence_value, self.slot.event)
                    .is_ok()
            },
            SharedTextureCopyCompletion::Query { .. } => false,
        };

        let mut use_event_wait = event_registered;
        loop {
            let complete = match &self.completion {
                SharedTextureCopyCompletion::Fence { fence, fence_value } => {
                    if use_event_wait {
                        let wait_result =
                            unsafe { WaitForSingleObjectEx(self.slot.event, 10, false) };
                        if wait_result == WAIT_FAILED
                            || (wait_result != WAIT_OBJECT_0 && wait_result != WAIT_TIMEOUT)
                        {
                            // The event is only a notification optimization. A
                            // failed or unexpected kernel wait does not make the
                            // fence value unavailable, so continue with direct
                            // nonblocking fence polling instead of abandoning a
                            // submitted producer texture.
                            use_event_wait = false;
                            false
                        } else {
                            wait_result == WAIT_OBJECT_0
                        }
                    } else {
                        unsafe { fence.GetCompletedValue() >= *fence_value }
                    }
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
    frame_latency_waitable_object: HANDLE,
    frame_latency_wait_generation: u64,
    frame_latency_ready_permits: u32,
    frame_latency_wait_bypassed: bool,
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
            frame_latency_waitable_object: HANDLE::default(),
            frame_latency_wait_generation: 0,
            frame_latency_ready_permits: 0,
            frame_latency_wait_bypassed: false,
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
        };
        if attach_swap_chain {
            renderer.attach_swap_chain(hwnd)?;
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
        self.frame_latency_wait_bypassed = false;
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
            return Err(
                "D3D11 shared-texture copy completion previously stalled; the native graphics device must be restarted"
                    .to_owned(),
            );
        }
        if handle == 0 {
            return Err("Electron shared texture handle is null".to_owned());
        }
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
        let context_lock = self.shared_texture_context_lock.clone();
        let _context_guard = lock_shared_texture_context(&context_lock)?;
        self.context.ClearState();
        self.context.Flush();
        self.render_target = None;
        self.source_view = None;
        self.source_texture = None;
        self.swap_chain = None;

        match replacement.attach_swap_chain(hwnd) {
            Ok(()) => {
                *self = replacement;
                Ok(())
            }
            Err(error) => {
                if let Ok(mut restored) = Self::new(hwnd, width, height) {
                    restored.set_present_sync_interval(present_sync_interval);
                    *self = restored;
                }
                Err(error)
            }
        }
    }

    pub unsafe fn render(&mut self, clear_color: [f32; 4]) -> Result<Option<i32>, String> {
        let context_lock = self.shared_texture_context_lock.clone();
        let _context_guard = lock_shared_texture_context(&context_lock)?;
        let render_started_at = Instant::now();
        if self.frame_latency_wait_bypassed {
            // The waitable object stopped signaling after a native window
            // transition. The timer-driven nonblocking Present fallback now
            // provides bounded retries; do not poll the stale signal again.
            self.last_frame_latency_wait_duration_ms = 0.0;
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
        let (present_sync_interval, present_flags) = if self.frame_latency_wait_bypassed {
            (0, DXGI_PRESENT_DO_NOT_WAIT)
        } else {
            (self.present_sync_interval, DXGI_PRESENT(0))
        };
        let present_started_at = Instant::now();
        let result = swap_chain.Present(present_sync_interval, present_flags);
        let present_duration_ms = present_started_at.elapsed().as_secs_f64() * 1_000.0;
        self.last_present_duration_ms = present_duration_ms;
        self.max_present_duration_ms = self.max_present_duration_ms.max(present_duration_ms);
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
        if result == DXGI_ERROR_WAS_STILL_DRAWING {
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
        self.present_sync_interval
    }

    pub fn frame_latency_waitable(&self) -> bool {
        !self.frame_latency_waitable_object.is_invalid()
    }

    pub fn duplicate_frame_latency_wait_handle(
        &self,
    ) -> Result<Option<FrameLatencyWaitHandle>, String> {
        if self.frame_latency_waitable_object.is_invalid() || self.frame_latency_wait_bypassed {
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
            || self.frame_latency_wait_bypassed
        {
            return false;
        }
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
        self.frame_latency_wait_bypassed = true;
        self.frame_latency_ready_permits = 0;
        if !self.fallback_timer_resolution_requested {
            self.fallback_timer_resolution_requested = true;
            self.fallback_timer_resolution_active = unsafe { timeBeginPeriod(1) == TIMERR_NOERROR };
        }
        true
    }

    pub fn frame_latency_wait_bypassed(&self) -> bool {
        self.frame_latency_wait_bypassed
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
        if self.fallback_timer_resolution_active {
            unsafe {
                let _ = timeEndPeriod(1);
            }
            self.fallback_timer_resolution_active = false;
        }
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
        shared_texture_copy_completion_mode_name, try_candidates_in_order,
        try_reserve_shared_texture_copy_slot, SharedTextureCopyCompletion, SharedTextureCopySlot,
        SharedTextureCopyTelemetry, SharedTextureCopyWaitHandle, WindowsD3d11Renderer,
        SHARED_TEXTURE_COPY_SLOT_COUNT,
    };
    use std::sync::atomic::{AtomicBool, Ordering};
    use std::sync::{Arc, Mutex};
    use std::time::Instant;
    use windows::Win32::Foundation::HANDLE;
    use windows::Win32::Graphics::Direct3D11::{
        D3D11_BIND_RENDER_TARGET, D3D11_BIND_SHADER_RESOURCE, D3D11_QUERY_DESC, D3D11_QUERY_EVENT,
        D3D11_TEXTURE2D_DESC, D3D11_USAGE_DEFAULT,
    };
    use windows::Win32::Graphics::Dxgi::Common::{DXGI_FORMAT_B8G8R8A8_UNORM, DXGI_SAMPLE_DESC};

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
mod tests {
    use super::{
        frame_statistics_counter_delta, is_device_lost_error, is_shared_texture_adapter_open_error,
        present_sync_interval_for_frame_rate,
    };

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
