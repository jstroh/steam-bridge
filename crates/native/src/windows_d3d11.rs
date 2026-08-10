use std::ffi::c_void;
use std::slice;
use std::sync::atomic::{AtomicU64, Ordering};
use std::time::Instant;
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
    ID3D11DeviceContext, ID3D11InputLayout, ID3D11PixelShader, ID3D11Query, ID3D11RenderTargetView,
    ID3D11SamplerState, ID3D11ShaderResourceView, ID3D11Texture2D, ID3D11VertexShader,
    D3D11_BIND_RENDER_TARGET, D3D11_BIND_SHADER_RESOURCE, D3D11_BOX, D3D11_COMPARISON_NEVER,
    D3D11_CREATE_DEVICE_BGRA_SUPPORT, D3D11_FILTER_MIN_MAG_MIP_LINEAR, D3D11_QUERY_DESC,
    D3D11_QUERY_EVENT, D3D11_SAMPLER_DESC, D3D11_SDK_VERSION, D3D11_TEXTURE2D_DESC,
    D3D11_TEXTURE_ADDRESS_CLAMP, D3D11_USAGE_DEFAULT, D3D11_VIEWPORT,
};
use windows::Win32::Graphics::Dxgi::Common::{
    DXGI_ALPHA_MODE_IGNORE, DXGI_FORMAT, DXGI_FORMAT_B8G8R8A8_UNORM, DXGI_FORMAT_UNKNOWN,
    DXGI_SAMPLE_DESC,
};
use windows::Win32::Graphics::Dxgi::{
    CreateDXGIFactory2, IDXGIAdapter, IDXGIAdapter1, IDXGIDevice, IDXGIFactory2, IDXGIFactory6,
    IDXGIOutput, IDXGISwapChain1, IDXGISwapChain2, DXGI_CREATE_FACTORY_FLAGS,
    DXGI_FRAME_STATISTICS, DXGI_GPU_PREFERENCE_HIGH_PERFORMANCE, DXGI_MWA_NO_ALT_ENTER,
    DXGI_PRESENT, DXGI_SCALING_STRETCH, DXGI_SWAP_CHAIN_DESC1,
    DXGI_SWAP_CHAIN_FLAG_FRAME_LATENCY_WAITABLE_OBJECT, DXGI_SWAP_EFFECT_FLIP_SEQUENTIAL,
    DXGI_USAGE_RENDER_TARGET_OUTPUT,
};
use windows::Win32::System::Threading::{GetCurrentProcess, WaitForSingleObjectEx};

const FRAME_LATENCY_WAIT_POLL_MS: u32 = 0;
const SHARED_TEXTURE_COPY_SLOW_MS: u128 = 50;
const SHARED_TEXTURE_COPY_TIMEOUT_MS: u128 = 500;
static NEXT_FRAME_LATENCY_WAIT_GENERATION: AtomicU64 = AtomicU64::new(1);

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
    shared_texture_copy_query: ID3D11Query,
    shared_texture_copy_slow_count: u64,
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
        Self::new_with_adapter(
            hwnd,
            width,
            height,
            preferred_high_performance_adapter(),
            true,
        )
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
        // paint callback. A D3D11 CopyResource call only queues GPU work, so an
        // event query is required to prove that the bridge-owned copy no
        // longer reads Electron's texture before the callback releases it.
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
            shared_texture_copy_query,
            shared_texture_copy_slow_count: 0,
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
        if let Some((copy_x, copy_y, copy_width, copy_height)) = copy_rect {
            let source_box = D3D11_BOX {
                left: copy_x,
                top: copy_y,
                front: 0,
                right: copy_x + copy_width,
                bottom: copy_y + copy_height,
                back: 1,
            };
            self.context.CopySubresourceRegion(
                self.source_texture
                    .as_ref()
                    .ok_or_else(|| "Shared-copy texture was not created".to_owned())?,
                0,
                copy_x - presentation_x,
                copy_y - presentation_y,
                0,
                &texture,
                0,
                Some(&source_box),
            );
            self.wait_for_shared_texture_copy()?;
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
        Ok(())
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
                return Ok(());
            }
            if !recorded_slow_copy && started.elapsed().as_millis() >= SHARED_TEXTURE_COPY_SLOW_MS {
                self.shared_texture_copy_slow_count =
                    self.shared_texture_copy_slow_count.saturating_add(1);
                recorded_slow_copy = true;
            }
            if started.elapsed().as_millis() >= SHARED_TEXTURE_COPY_TIMEOUT_MS {
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
        let render_started_at = Instant::now();
        if self.frame_latency_ready_permits > 0 {
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
        // The frame-latency waitable object starts each frame only after the
        // previous presentation completes. Sync to the next vertical blank as
        // well: flip-model Present(0) is an unsynchronized path that Microsoft
        // recommends only with explicit tearing support, which this tear-free
        // desktop/streaming host intentionally does not request.
        let present_started_at = Instant::now();
        let result = swap_chain.Present(self.present_sync_interval, DXGI_PRESENT(0));
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
                    let present_delta =
                        statistics.PresentCount.wrapping_sub(previous_present_count);
                    if previous_present_count > 0 && previous_refresh_count > 0 && present_delta > 0
                    {
                        let refresh_delta = statistics
                            .PresentRefreshCount
                            .wrapping_sub(previous_refresh_count);
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
        if self.frame_latency_waitable_object.is_invalid() {
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
        {
            return false;
        }
        self.frame_latency_ready_permits =
            self.frame_latency_ready_permits.saturating_add(1).min(1);
        self.async_frame_latency_ready_count =
            self.async_frame_latency_ready_count.saturating_add(1);
        true
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
        self.shared_texture_copy_slow_count
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
        if !self.frame_latency_waitable_object.is_invalid() {
            unsafe {
                let _ = CloseHandle(self.frame_latency_waitable_object);
            }
            self.frame_latency_waitable_object = HANDLE::default();
        }
    }
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
    use super::{is_device_lost_error, present_sync_interval_for_frame_rate};

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
}
