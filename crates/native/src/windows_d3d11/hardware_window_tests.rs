use super::*;
use windows::Win32::Graphics::Direct3D11::{
    D3D11_CPU_ACCESS_READ, D3D11_MAPPED_SUBRESOURCE, D3D11_MAP_READ, D3D11_USAGE_STAGING,
};
use windows_sys::Win32::System::LibraryLoader::GetModuleHandleW;
use windows_sys::Win32::UI::WindowsAndMessaging as wm;

unsafe extern "system" fn test_window_proc(
    hwnd: *mut c_void,
    message: u32,
    wparam: usize,
    lparam: isize,
) -> isize {
    wm::DefWindowProcW(hwnd, message, wparam, lparam)
}

pub(super) unsafe fn create_test_window(width: i32, height: i32) -> *mut c_void {
    let class_name: Vec<u16> = "SteamBridgeD3d11TestWindow\0".encode_utf16().collect();
    let instance = GetModuleHandleW(std::ptr::null());
    let class = wm::WNDCLASSW {
        style: 0,
        lpfnWndProc: Some(test_window_proc),
        cbClsExtra: 0,
        cbWndExtra: 0,
        hInstance: instance,
        hIcon: std::ptr::null_mut(),
        hCursor: std::ptr::null_mut(),
        hbrBackground: std::ptr::null_mut(),
        lpszMenuName: std::ptr::null(),
        lpszClassName: class_name.as_ptr(),
    };
    wm::RegisterClassW(&class);
    let hwnd = wm::CreateWindowExW(
        0,
        class_name.as_ptr(),
        class_name.as_ptr(),
        wm::WS_OVERLAPPEDWINDOW | wm::WS_VISIBLE,
        40,
        40,
        width,
        height,
        std::ptr::null_mut(),
        std::ptr::null_mut(),
        instance,
        std::ptr::null(),
    );
    assert!(!hwnd.is_null(), "CreateWindowExW failed");
    pump_test_window_messages();
    hwnd
}

pub(super) unsafe fn pump_test_window_messages() {
    let mut message: wm::MSG = std::mem::zeroed();
    while wm::PeekMessageW(&mut message, std::ptr::null_mut(), 0, 0, wm::PM_REMOVE) != 0 {
        wm::TranslateMessage(&message);
        wm::DispatchMessageW(&message);
    }
}

pub(super) struct SharedProducerTexture {
    device: ID3D11Device,
    context: ID3D11DeviceContext,
    view: ID3D11RenderTargetView,
    _texture: ID3D11Texture2D,
    pub(super) handle: HANDLE,
}

impl SharedProducerTexture {
    pub(super) unsafe fn paint(&self, color: [f32; 4]) {
        self.context.ClearRenderTargetView(&self.view, &color);
        let mut query = None;
        self.device
            .CreateQuery(
                &D3D11_QUERY_DESC {
                    Query: D3D11_QUERY_EVENT,
                    MiscFlags: 0,
                },
                Some(&mut query),
            )
            .expect("producer event query");
        let query = query.expect("producer event query");
        self.context.End(&query);
        self.context.Flush();
        loop {
            let mut done = 0i32;
            let _ = self.context.GetData(
                &query,
                Some((&mut done as *mut i32).cast()),
                std::mem::size_of::<i32>() as u32,
                0,
            );
            if done != 0 {
                break;
            }
            std::thread::yield_now();
        }
    }
}

pub(super) unsafe fn read_presented_source_pixels(
    renderer: &WindowsD3d11Renderer,
    points: &[(u32, u32)],
) -> Vec<[u8; 4]> {
    let view = renderer.source_view.as_ref().expect("source view");
    let texture: ID3D11Texture2D = view
        .GetResource()
        .expect("source resource")
        .cast()
        .expect("texture");
    let mut desc = D3D11_TEXTURE2D_DESC::default();
    texture.GetDesc(&mut desc);
    let staging_desc = D3D11_TEXTURE2D_DESC {
        Usage: D3D11_USAGE_STAGING,
        BindFlags: 0,
        CPUAccessFlags: D3D11_CPU_ACCESS_READ.0 as u32,
        MiscFlags: 0,
        ..desc
    };
    let mut staging = None;
    renderer
        .device
        .CreateTexture2D(&staging_desc, None, Some(&mut staging))
        .expect("staging texture");
    let staging: ID3D11Texture2D = staging.expect("staging texture");
    renderer.context.CopyResource(&staging, &texture);
    let mut mapped = D3D11_MAPPED_SUBRESOURCE::default();
    renderer
        .context
        .Map(&staging, 0, D3D11_MAP_READ, 0, Some(&mut mapped))
        .expect("map staging");
    let pixels = points
        .iter()
        .map(|&(x, y)| {
            let offset = y as usize * mapped.RowPitch as usize + x as usize * 4;
            let bytes = std::slice::from_raw_parts((mapped.pData as *const u8).add(offset), 4);
            [bytes[0], bytes[1], bytes[2], bytes[3]]
        })
        .collect();
    renderer.context.Unmap(&staging, 0);
    pixels
}

impl Drop for SharedProducerTexture {
    fn drop(&mut self) {
        unsafe {
            let _ = CloseHandle(self.handle);
        }
    }
}

pub(super) unsafe fn create_shared_producer_texture(
    width: u32,
    height: u32,
) -> SharedProducerTexture {
    let mut device = None;
    let mut context = None;
    D3D11CreateDevice(
        None,
        D3D_DRIVER_TYPE_HARDWARE,
        HMODULE::default(),
        D3D11_CREATE_DEVICE_BGRA_SUPPORT,
        Some(&[D3D_FEATURE_LEVEL_11_1, D3D_FEATURE_LEVEL_11_0]),
        D3D11_SDK_VERSION,
        Some(&mut device),
        None,
        Some(&mut context),
    )
    .expect("producer D3D11CreateDevice");
    let device: ID3D11Device = device.expect("producer device");
    let context: ID3D11DeviceContext = context.expect("producer context");
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
        BindFlags: (D3D11_BIND_SHADER_RESOURCE | D3D11_BIND_RENDER_TARGET).0 as u32,
        CPUAccessFlags: 0,
        MiscFlags: (D3D11_RESOURCE_MISC_SHARED_NTHANDLE | D3D11_RESOURCE_MISC_SHARED).0 as u32,
    };
    let mut texture = None;
    device
        .CreateTexture2D(&desc, None, Some(&mut texture))
        .expect("producer texture");
    let texture: ID3D11Texture2D = texture.expect("producer texture");
    let handle = texture
        .cast::<IDXGIResource1>()
        .expect("IDXGIResource1")
        .CreateSharedHandle(
            None,
            DXGI_SHARED_RESOURCE_READ.0 | DXGI_SHARED_RESOURCE_WRITE.0,
            windows::core::PCWSTR::null(),
        )
        .expect("producer shared handle");
    let mut view = None;
    device
        .CreateRenderTargetView(&texture, None, Some(&mut view))
        .expect("producer render target");
    SharedProducerTexture {
        device,
        context,
        view: view.expect("producer render target"),
        _texture: texture,
        handle,
    }
}

unsafe fn render_until_presented(renderer: &mut WindowsD3d11Renderer) {
    for _ in 0..500 {
        if renderer
            .render([0.0, 0.0, 0.0, 1.0])
            .expect("render")
            .is_some()
        {
            return;
        }
        pump_test_window_messages();
        std::thread::sleep(Duration::from_millis(1));
    }
    panic!("the renderer did not present within 500 attempts");
}

unsafe fn import_and_wait(
    renderer: &mut WindowsD3d11Renderer,
    producer: &SharedProducerTexture,
    content_rect: (u32, u32, u32, u32),
) {
    match renderer
        .begin_import_shared_texture(
            producer.handle.0 as usize,
            320,
            200,
            content_rect,
            (0, 0, 320, 200),
        )
        .expect("import")
    {
        SharedTextureImportSubmission::Accepted(Some(wait)) => wait.wait().expect("copy"),
        SharedTextureImportSubmission::Accepted(None) => {}
        SharedTextureImportSubmission::Dropped => panic!("single in-flight copy was dropped"),
    }
}

#[test]
#[ignore = "requires a real GPU and a visible desktop"]
fn dedicated_copy_device_presents_full_and_dirty_rect_frames() {
    unsafe {
        set_dedicated_copy_device_requested(true);
        let hwnd = create_test_window(336, 239);
        let mut renderer = WindowsD3d11Renderer::new(hwnd, 320, 200).expect("renderer");
        set_dedicated_copy_device_requested(false);
        assert!(
            renderer.dedicated_copy_requested,
            "new renderers inherit the process flag"
        );
        let producer = create_shared_producer_texture(320, 200);
        let inside = (100, 60);
        let outside = (10, 10);

        producer.paint([1.0, 0.0, 0.0, 1.0]);
        import_and_wait(&mut renderer, &producer, (0, 0, 320, 200));
        assert!(renderer.dedicated_copy_device_active());
        render_until_presented(&mut renderer);
        let full = read_presented_source_pixels(&renderer, &[inside, outside]);
        assert_eq!(
            full,
            vec![[0, 0, 255, 255], [0, 0, 255, 255]],
            "full red frame (BGRA)"
        );

        producer.paint([0.0, 1.0, 0.0, 1.0]);
        import_and_wait(&mut renderer, &producer, (80, 40, 80, 60));
        render_until_presented(&mut renderer);
        let partial = read_presented_source_pixels(&renderer, &[inside, outside]);
        assert_eq!(
            partial[0],
            [0, 255, 0, 255],
            "dirty rect shows the new frame"
        );
        assert_eq!(
            partial[1],
            [0, 0, 255, 255],
            "pixels outside the dirty rect keep the previous frame"
        );
        assert_eq!(renderer.shared_texture_partial_copy_count, 1);

        for frame in 0..8 {
            let shade = if frame % 2 == 0 { 1.0 } else { 0.0 };
            producer.paint([shade, 0.0, 1.0 - shade, 1.0]);
            import_and_wait(&mut renderer, &producer, (0, 0, 320, 200));
            render_until_presented(&mut renderer);
            let expected = if frame % 2 == 0 {
                [0, 0, 255, 255]
            } else {
                [255, 0, 0, 255]
            };
            assert_eq!(
                read_presented_source_pixels(&renderer, &[inside])[0],
                expected,
                "ring frame {frame}"
            );
        }
        assert_eq!(renderer.dedicated_copy_count, 10);

        renderer.set_dedicated_copy_device(false);
        assert!(!renderer.dedicated_copy_device_active());
        producer.paint([0.0, 0.0, 1.0, 1.0]);
        import_and_wait(&mut renderer, &producer, (0, 0, 320, 200));
        render_until_presented(&mut renderer);
        assert_eq!(
            read_presented_source_pixels(&renderer, &[inside])[0],
            [255, 0, 0, 255]
        );
        assert_eq!(
            renderer.dedicated_copy_count, 10,
            "disabled option returns to the host path"
        );
        drop(renderer);
        wm::DestroyWindow(hwnd);
    }
}

#[test]
#[ignore = "requires a real GPU and a visible desktop"]
fn copy_diagnostics_report_gpu_timing_and_same_adapter_luids() {
    unsafe {
        let hwnd = create_test_window(336, 239);
        let mut renderer = WindowsD3d11Renderer::new(hwnd, 320, 200).expect("renderer");
        let producer = create_shared_producer_texture(320, 200);
        for _ in 0..(GPU_COPY_TIMING_SAMPLE_INTERVAL * 3 + 1) {
            match renderer
                .begin_import_shared_texture(
                    producer.handle.0 as usize,
                    320,
                    200,
                    (0, 0, 320, 200),
                    (0, 0, 320, 200),
                )
                .expect("import")
            {
                SharedTextureImportSubmission::Accepted(Some(wait)) => wait.wait().expect("copy"),
                SharedTextureImportSubmission::Accepted(None) => {}
                SharedTextureImportSubmission::Dropped => {
                    panic!("single in-flight copy was dropped")
                }
            }
            renderer.render([0.0, 0.0, 0.0, 1.0]).expect("render");
            pump_test_window_messages();
        }
        let timing = renderer.shared_texture_copy_gpu_timing_diagnostics();
        assert_eq!(timing["sampleInterval"], GPU_COPY_TIMING_SAMPLE_INTERVAL);
        assert!(timing["sampleCount"].as_u64().unwrap() >= 2, "{timing}");
        assert!(timing["meanMs"].as_f64().unwrap() > 0.0, "{timing}");
        let adapters = renderer.adapter_diagnostics();
        assert!(adapters["hostAdapterLuid"].is_string(), "{adapters}");
        assert_eq!(
            adapters["textureAdapterLuid"], adapters["hostAdapterLuid"],
            "{adapters}"
        );
        assert_eq!(adapters["crossAdapterTexture"], false, "{adapters}");
        assert!(adapters["outputAdapterLuid"].is_string(), "{adapters}");
        let wait = renderer.frame_latency_wait_diagnostics();
        assert_eq!(wait["bypassed"], false, "{wait}");
        assert_eq!(
            wait["bypassTimeoutThreshold"],
            FRAME_LATENCY_WAIT_BYPASS_TIMEOUTS
        );
        drop(renderer);
        wm::DestroyWindow(hwnd);
    }
}

#[test]
#[ignore = "requires a real GPU and a visible desktop"]
fn adapter_switch_attaches_a_new_swap_chain_to_the_same_window() {
    unsafe {
        let hwnd = create_test_window(336, 239);
        let mut renderer = WindowsD3d11Renderer::new(hwnd, 320, 200).expect("renderer");
        renderer.render([0.0, 0.0, 0.0, 1.0]).expect("first render");
        let producer = create_shared_producer_texture(320, 200);
        for attempt in 1..=3 {
            renderer
                .switch_to_shared_texture_adapter(
                    hwnd,
                    producer.handle.0 as usize,
                    320,
                    200,
                    (0, 0, 320, 200),
                    (0, 0, 320, 200),
                )
                .unwrap_or_else(|error| panic!("switch {attempt} failed: {error}"));
            pump_test_window_messages();
            assert!(renderer.frame_latency_waitable());
            renderer
                .render([0.0, 0.0, 0.0, 1.0])
                .expect("render after switch");
        }
        drop(renderer);
        wm::DestroyWindow(hwnd);
    }
}
