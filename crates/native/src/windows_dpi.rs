use std::ffi::c_void;
use std::mem::{size_of, transmute_copy};
use std::ptr;
use std::sync::OnceLock;
use windows_sys::core::BOOL;
use windows_sys::Win32::Foundation::{HMODULE, HWND, RECT};
use windows_sys::Win32::Graphics::Gdi::{GetDC, GetDeviceCaps, ReleaseDC, LOGPIXELSX};
use windows_sys::Win32::System::LibraryLoader::{GetModuleHandleW, GetProcAddress};
pub use windows_sys::Win32::UI::HiDpi::DPI_AWARENESS_CONTEXT;
use windows_sys::Win32::UI::HiDpi::DPI_AWARENESS_CONTEXT_PER_MONITOR_AWARE_V2;
use windows_sys::Win32::UI::WindowsAndMessaging::{
    AdjustWindowRectEx, GetSystemMetrics, SystemParametersInfoW,
};

type AdjustWindowRectExForDpiFn = unsafe extern "system" fn(*mut RECT, u32, BOOL, u32, u32) -> BOOL;
type AreDpiAwarenessContextsEqualFn =
    unsafe extern "system" fn(DPI_AWARENESS_CONTEXT, DPI_AWARENESS_CONTEXT) -> BOOL;
type GetDpiForSystemFn = unsafe extern "system" fn() -> u32;
type GetDpiForWindowFn = unsafe extern "system" fn(HWND) -> u32;
type GetSystemMetricsForDpiFn = unsafe extern "system" fn(i32, u32) -> i32;
type GetWindowDpiAwarenessContextFn = unsafe extern "system" fn(HWND) -> DPI_AWARENESS_CONTEXT;
type SetThreadDpiAwarenessContextFn =
    unsafe extern "system" fn(DPI_AWARENESS_CONTEXT) -> DPI_AWARENESS_CONTEXT;
type SystemParametersInfoForDpiFn =
    unsafe extern "system" fn(u32, u32, *mut c_void, u32, u32) -> BOOL;

const USER32_DLL: [u16; 11] = [
    b'u' as u16,
    b's' as u16,
    b'e' as u16,
    b'r' as u16,
    b'3' as u16,
    b'2' as u16,
    b'.' as u16,
    b'd' as u16,
    b'l' as u16,
    b'l' as u16,
    0,
];

static USER32_MODULE: OnceLock<usize> = OnceLock::new();
static ADJUST_WINDOW_RECT_EX_FOR_DPI: OnceLock<Option<AdjustWindowRectExForDpiFn>> =
    OnceLock::new();
static ARE_DPI_AWARENESS_CONTEXTS_EQUAL: OnceLock<Option<AreDpiAwarenessContextsEqualFn>> =
    OnceLock::new();
static GET_DPI_FOR_SYSTEM: OnceLock<Option<GetDpiForSystemFn>> = OnceLock::new();
static GET_DPI_FOR_WINDOW: OnceLock<Option<GetDpiForWindowFn>> = OnceLock::new();
static GET_SYSTEM_METRICS_FOR_DPI: OnceLock<Option<GetSystemMetricsForDpiFn>> = OnceLock::new();
static GET_WINDOW_DPI_AWARENESS_CONTEXT: OnceLock<Option<GetWindowDpiAwarenessContextFn>> =
    OnceLock::new();
static SET_THREAD_DPI_AWARENESS_CONTEXT: OnceLock<Option<SetThreadDpiAwarenessContextFn>> =
    OnceLock::new();
static SYSTEM_PARAMETERS_INFO_FOR_DPI: OnceLock<Option<SystemParametersInfoForDpiFn>> =
    OnceLock::new();

fn user32_module() -> HMODULE {
    *USER32_MODULE.get_or_init(|| unsafe { GetModuleHandleW(USER32_DLL.as_ptr()) as usize })
        as HMODULE
}

unsafe fn resolve_user32<T>(name: &'static [u8]) -> Option<T>
where
    T: Copy,
{
    let module = user32_module();
    if module.is_null() {
        return None;
    }
    let function = GetProcAddress(module, name.as_ptr())?;
    if size_of::<T>() != size_of_val(&function) {
        return None;
    }
    Some(transmute_copy(&function))
}

fn scale_metric(value: i32, source_dpi: u32, target_dpi: u32) -> i32 {
    let scaled = i64::from(value) * i64::from(target_dpi.max(96));
    let rounded = if scaled >= 0 {
        scaled + i64::from(source_dpi.max(96) / 2)
    } else {
        scaled - i64::from(source_dpi.max(96) / 2)
    };
    (rounded / i64::from(source_dpi.max(96))).clamp(i64::from(i32::MIN), i64::from(i32::MAX)) as i32
}

pub unsafe fn set_thread_per_monitor_v2() -> DPI_AWARENESS_CONTEXT {
    let function = SET_THREAD_DPI_AWARENESS_CONTEXT
        .get_or_init(|| resolve_user32(b"SetThreadDpiAwarenessContext\0"));
    function.map_or(ptr::null_mut(), |function| {
        function(DPI_AWARENESS_CONTEXT_PER_MONITOR_AWARE_V2)
    })
}

pub unsafe fn restore_thread_dpi_awareness(context: DPI_AWARENESS_CONTEXT) {
    if context.is_null() {
        return;
    }
    if let Some(function) = *SET_THREAD_DPI_AWARENESS_CONTEXT
        .get_or_init(|| resolve_user32(b"SetThreadDpiAwarenessContext\0"))
    {
        function(context);
    }
}

pub unsafe fn dpi_for_system() -> u32 {
    if let Some(function) = *GET_DPI_FOR_SYSTEM.get_or_init(|| resolve_user32(b"GetDpiForSystem\0"))
    {
        return function().max(96);
    }
    let hdc = GetDC(ptr::null_mut());
    if !hdc.is_null() {
        let dpi = GetDeviceCaps(hdc, LOGPIXELSX as i32);
        ReleaseDC(ptr::null_mut(), hdc);
        if dpi > 0 {
            return dpi as u32;
        }
    }
    96
}

pub unsafe fn dpi_for_window(hwnd: HWND) -> u32 {
    if let Some(function) = *GET_DPI_FOR_WINDOW.get_or_init(|| resolve_user32(b"GetDpiForWindow\0"))
    {
        let dpi = function(hwnd);
        if dpi > 0 {
            return dpi;
        }
    }
    dpi_for_system()
}

pub unsafe fn system_metrics_for_dpi(index: i32, dpi: u32) -> i32 {
    if let Some(function) =
        *GET_SYSTEM_METRICS_FOR_DPI.get_or_init(|| resolve_user32(b"GetSystemMetricsForDpi\0"))
    {
        return function(index, dpi);
    }
    scale_metric(GetSystemMetrics(index), dpi_for_system(), dpi)
}

pub unsafe fn adjust_window_rect_ex_for_dpi(
    rect: *mut RECT,
    style: u32,
    has_menu: BOOL,
    ex_style: u32,
    dpi: u32,
) -> BOOL {
    if let Some(function) =
        *ADJUST_WINDOW_RECT_EX_FOR_DPI.get_or_init(|| resolve_user32(b"AdjustWindowRectExForDpi\0"))
    {
        return function(rect, style, has_menu, ex_style, dpi);
    }
    AdjustWindowRectEx(rect, style, has_menu, ex_style)
}

pub unsafe fn system_parameters_info_for_dpi(
    action: u32,
    parameter: u32,
    value: *mut c_void,
    flags: u32,
    dpi: u32,
) -> BOOL {
    if let Some(function) = *SYSTEM_PARAMETERS_INFO_FOR_DPI
        .get_or_init(|| resolve_user32(b"SystemParametersInfoForDpi\0"))
    {
        return function(action, parameter, value, flags, dpi);
    }
    SystemParametersInfoW(action, parameter, value, flags)
}

pub unsafe fn window_is_per_monitor_v2(hwnd: HWND) -> bool {
    let get_context = GET_WINDOW_DPI_AWARENESS_CONTEXT
        .get_or_init(|| resolve_user32(b"GetWindowDpiAwarenessContext\0"));
    let contexts_equal = ARE_DPI_AWARENESS_CONTEXTS_EQUAL
        .get_or_init(|| resolve_user32(b"AreDpiAwarenessContextsEqual\0"));
    match (*get_context, *contexts_equal) {
        (Some(get_context), Some(contexts_equal)) => {
            contexts_equal(
                get_context(hwnd),
                DPI_AWARENESS_CONTEXT_PER_MONITOR_AWARE_V2,
            ) != 0
        }
        _ => false,
    }
}

#[cfg(test)]
mod tests {
    use super::scale_metric;

    #[test]
    fn legacy_metrics_scale_without_overflow() {
        assert_eq!(scale_metric(20, 96, 144), 30);
        assert_eq!(scale_metric(-20, 96, 144), -30);
        assert_eq!(scale_metric(i32::MAX, 96, u32::MAX), i32::MAX);
        assert_eq!(scale_metric(i32::MIN, 96, u32::MAX), i32::MIN);
    }
}
