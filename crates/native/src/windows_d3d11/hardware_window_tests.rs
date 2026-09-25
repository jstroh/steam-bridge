use super::*;
use windows::Win32::Graphics::Direct3D11::{
    D3D11_RESOURCE_MISC_SHARED, D3D11_RESOURCE_MISC_SHARED_NTHANDLE,
};
use windows::Win32::Graphics::Dxgi::{
    IDXGIResource1, DXGI_SHARED_RESOURCE_READ, DXGI_SHARED_RESOURCE_WRITE,
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
    _device: ID3D11Device,
    _texture: ID3D11Texture2D,
    pub(super) handle: HANDLE,
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
    D3D11CreateDevice(
        None,
        D3D_DRIVER_TYPE_HARDWARE,
        HMODULE::default(),
        D3D11_CREATE_DEVICE_BGRA_SUPPORT,
        Some(&[D3D_FEATURE_LEVEL_11_1, D3D_FEATURE_LEVEL_11_0]),
        D3D11_SDK_VERSION,
        Some(&mut device),
        None,
        None,
    )
    .expect("producer D3D11CreateDevice");
    let device: ID3D11Device = device.expect("producer device");
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
    SharedProducerTexture {
        _device: device,
        _texture: texture,
        handle,
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
