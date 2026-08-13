#![allow(unexpected_cfgs)]

use napi::bindgen_prelude::{Buffer, Error};

fn checked_native_overlay_frame_byte_len(
    width: u32,
    height: u32,
    platform: &str,
) -> Result<usize, Error> {
    if width == 0 || height == 0 || width > i32::MAX as u32 || height > i32::MAX as u32 {
        return Err(Error::from_reason(format!(
            "{platform} native overlay frame dimensions must be non-zero signed 32-bit values"
        )));
    }
    (width as usize)
        .checked_mul(height as usize)
        .and_then(|pixels| pixels.checked_mul(4))
        .ok_or_else(|| {
            Error::from_reason(format!(
                "{platform} native overlay frame dimensions overflow"
            ))
        })
}

#[cfg(any(target_os = "linux", test))]
#[derive(Default)]
struct ConfigureNotifyCoalescer {
    configured_size: Option<(u32, u32)>,
    configure_count: u64,
}

#[cfg(any(target_os = "linux", test))]
impl ConfigureNotifyCoalescer {
    fn observe(&mut self, target_window: u64, event_window: u64, width: i32, height: i32) {
        if event_window != target_window {
            return;
        }

        self.configured_size = Some((width.max(1) as u32, height.max(1) as u32));
        self.configure_count = self.configure_count.wrapping_add(1);
    }
}

#[cfg(any(target_os = "linux", test))]
fn input_shape_readback_matches(
    pass_through: bool,
    rectangle_count: i32,
    rectangles_null: bool,
    first_rectangle: Option<(i16, i16, u16, u16)>,
    enabled_rectangle: Option<(i16, i16, u16, u16)>,
) -> bool {
    if pass_through {
        return rectangle_count == 0 && rectangles_null;
    }

    rectangle_count == 1
        && !rectangles_null
        && first_rectangle.is_some()
        && first_rectangle == enabled_rectangle
}

#[cfg(any(target_os = "linux", test))]
fn x11_cardinal32_readback_matches(observed: u64, expected: u32) -> bool {
    observed as u32 == expected
}

#[cfg(any(target_os = "linux", test))]
fn x11_attached_child_bounds(
    parent_root_x: i32,
    parent_root_y: i32,
    content_root_x: i32,
    content_root_y: i32,
    width: u32,
    height: u32,
) -> (i32, i32, u32, u32) {
    (
        content_root_x.saturating_sub(parent_root_x),
        content_root_y.saturating_sub(parent_root_y),
        width.max(1),
        height.max(1),
    )
}

#[cfg(any(target_os = "linux", test))]
fn xrandr_mode_refresh_rate(
    dot_clock: u64,
    horizontal_total: u32,
    vertical_total: u32,
    mode_flags: u64,
) -> Option<f64> {
    const RR_INTERLACE: u64 = 0x0000_0010;
    const RR_DOUBLE_SCAN: u64 = 0x0000_0020;
    if dot_clock == 0 || horizontal_total == 0 || vertical_total == 0 {
        return None;
    }

    let mut refresh_rate = dot_clock as f64 / (horizontal_total as f64 * vertical_total as f64);
    if mode_flags & RR_INTERLACE != 0 {
        refresh_rate *= 2.0;
    }
    if mode_flags & RR_DOUBLE_SCAN != 0 {
        refresh_rate /= 2.0;
    }
    refresh_rate
        .is_finite()
        .then_some(refresh_rate)
        .filter(|rate| *rate > 0.0)
}

#[cfg(test)]
mod configure_notify_coalescer_tests {
    use super::{
        checked_native_overlay_frame_byte_len, input_shape_readback_matches,
        x11_attached_child_bounds, x11_cardinal32_readback_matches, xrandr_mode_refresh_rate,
        ConfigureNotifyCoalescer,
    };

    #[test]
    fn ignores_unrelated_windows() {
        let mut coalescer = ConfigureNotifyCoalescer::default();

        coalescer.observe(10, 11, 1280, 720);

        assert_eq!(coalescer.configured_size, None);
        assert_eq!(coalescer.configure_count, 0);
    }

    #[test]
    fn last_matching_event_wins() {
        let mut coalescer = ConfigureNotifyCoalescer::default();

        coalescer.observe(10, 10, 640, 480);
        coalescer.observe(10, 10, 1024, 768);
        coalescer.observe(10, 11, 1920, 1080);

        assert_eq!(coalescer.configured_size, Some((1024, 768)));
        assert_eq!(coalescer.configure_count, 2);
    }

    #[test]
    fn zero_dimensions_clamp_to_one() {
        let mut coalescer = ConfigureNotifyCoalescer::default();

        coalescer.observe(10, 10, 0, 0);

        assert_eq!(coalescer.configured_size, Some((1, 1)));
        assert_eq!(coalescer.configure_count, 1);
    }

    #[test]
    fn attached_child_bounds_translate_content_from_root_to_parent_coordinates() {
        assert_eq!(
            x11_attached_child_bounds(100, 228, 100, 260, 1280, 686),
            (0, 32, 1280, 686)
        );
    }

    #[test]
    fn attached_child_bounds_are_invariant_when_parent_and_content_move_together() {
        assert_eq!(
            x11_attached_child_bounds(-240, 128, -232, 160, 0, 0),
            (8, 32, 1, 1)
        );
    }

    #[test]
    fn accepts_only_the_explicit_empty_input_shape_for_passthrough() {
        assert!(input_shape_readback_matches(true, 0, true, None, None));
        assert!(!input_shape_readback_matches(true, -1, true, None, None));
        assert!(!input_shape_readback_matches(true, 0, false, None, None));
        assert!(!input_shape_readback_matches(
            true,
            1,
            false,
            Some((0, 0, 640, 480)),
            None,
        ));
    }

    #[test]
    fn accepts_only_the_exact_default_rectangle_for_enabled_input() {
        let expected = Some((0, 0, 640, 480));
        assert!(input_shape_readback_matches(
            false, 1, false, expected, expected,
        ));
        assert!(!input_shape_readback_matches(
            false, 0, true, None, expected,
        ));
        assert!(!input_shape_readback_matches(
            false,
            1,
            false,
            Some((0, 0, 639, 480)),
            expected,
        ));
        assert!(!input_shape_readback_matches(
            false, 2, false, expected, expected,
        ));
    }

    #[test]
    fn compares_x11_cardinal_properties_at_the_protocol_width() {
        assert!(x11_cardinal32_readback_matches(0, 0));
        assert!(x11_cardinal32_readback_matches(u32::MAX as u64, u32::MAX,));
        assert!(x11_cardinal32_readback_matches(u64::MAX, u32::MAX));
        assert!(!x11_cardinal32_readback_matches(0, u32::MAX));
    }

    #[test]
    fn computes_xrandr_mode_refresh_rate_and_applies_scan_flags() {
        let rate = xrandr_mode_refresh_rate(132_000_000, 1088, 1350, 0).unwrap();
        assert!((rate - 89.869_281).abs() < 0.000_001);
        assert!(
            (xrandr_mode_refresh_rate(132_000_000, 1088, 1350, 0x10).unwrap() - rate * 2.0).abs()
                < 0.000_001
        );
        assert!(
            (xrandr_mode_refresh_rate(132_000_000, 1088, 1350, 0x20).unwrap() - rate / 2.0).abs()
                < 0.000_001
        );
        assert!(xrandr_mode_refresh_rate(0, 1088, 1350, 0).is_none());
        assert!(xrandr_mode_refresh_rate(132_000_000, 0, 1350, 0).is_none());
    }

    #[test]
    fn validates_native_overlay_frame_dimensions_before_byte_arithmetic() {
        assert_eq!(
            checked_native_overlay_frame_byte_len(2, 3, "Test").unwrap(),
            24
        );
        assert!(checked_native_overlay_frame_byte_len(0, 1, "Test").is_err());
        assert!(checked_native_overlay_frame_byte_len(1, 0, "Test").is_err());
        assert!(checked_native_overlay_frame_byte_len(u32::MAX, u32::MAX, "Test").is_err());
    }
}

#[cfg(target_os = "macos")]
mod macos {
    use super::{checked_native_overlay_frame_byte_len, Buffer, Error};
    use objc::declare::ClassDecl;
    use objc::runtime::{Class, Object, Sel, BOOL, NO, YES};
    use objc::{class, msg_send, sel, sel_impl};
    use once_cell::sync::Lazy;
    use std::env;
    use std::ffi::{c_void, CStr, CString};
    use std::ptr;
    use std::sync::Mutex;
    use std::time::{SystemTime, UNIX_EPOCH};

    type Id = *mut Object;
    type CGFloat = f64;
    type NSUInteger = u64;

    const NIL: Id = ptr::null_mut();
    const NS_UTF8_STRING_ENCODING: NSUInteger = 4;
    const NS_BACKING_STORE_BUFFERED: NSUInteger = 2;
    const NS_WINDOW_STYLE_TITLED: NSUInteger = 1 << 0;
    const NS_WINDOW_STYLE_CLOSABLE: NSUInteger = 1 << 1;
    const NS_WINDOW_STYLE_MINIATURIZABLE: NSUInteger = 1 << 2;
    const NS_WINDOW_STYLE_RESIZABLE: NSUInteger = 1 << 3;
    const NS_WINDOW_ABOVE: isize = 1;
    const NS_VIEW_WIDTH_SIZABLE: NSUInteger = 1 << 1;
    const NS_VIEW_HEIGHT_SIZABLE: NSUInteger = 1 << 4;
    const NS_OPENGL_PFA_DOUBLE_BUFFER: u32 = 5;
    const NS_OPENGL_PFA_COLOR_SIZE: u32 = 8;
    const NS_OPENGL_PFA_ALPHA_SIZE: u32 = 11;
    const NS_OPENGL_PFA_DEPTH_SIZE: u32 = 12;
    const NS_OPENGL_PFA_ACCELERATED: u32 = 73;
    const NS_OPENGL_PFA_NO_RECOVERY: u32 = 72;
    const GL_COLOR_BUFFER_BIT: u32 = 0x0000_4000;
    const GL_DEPTH_TEST: u32 = 0x0B71;
    const GL_TEXTURE_2D: u32 = 0x0DE1;
    const GL_PROJECTION: u32 = 0x1701;
    const GL_MODELVIEW: u32 = 0x1700;
    const GL_QUADS: u32 = 0x0007;
    const GL_UNSIGNED_BYTE: u32 = 0x1401;
    const GL_BGRA: u32 = 0x80E1;
    const GL_RGBA: u32 = 0x1908;
    const GL_UNPACK_ALIGNMENT: u32 = 0x0CF5;
    const GL_TEXTURE_MIN_FILTER: u32 = 0x2801;
    const GL_TEXTURE_MAG_FILTER: u32 = 0x2800;
    const GL_TEXTURE_WRAP_S: u32 = 0x2802;
    const GL_TEXTURE_WRAP_T: u32 = 0x2803;
    const GL_LINEAR: i32 = 0x2601;
    const GL_CLAMP_TO_EDGE: i32 = 0x812F;

    #[repr(C)]
    #[derive(Clone, Copy)]
    struct NSPoint {
        x: CGFloat,
        y: CGFloat,
    }

    #[repr(C)]
    #[derive(Clone, Copy)]
    struct NSSize {
        width: CGFloat,
        height: CGFloat,
    }

    #[repr(C)]
    #[derive(Clone, Copy)]
    struct NSRect {
        origin: NSPoint,
        size: NSSize,
    }

    #[derive(Clone, Copy)]
    enum SurfaceOwner {
        ProbeWindow {
            window: Id,
        },
        EmbeddedWindow {
            window: Id,
            parent_window: Id,
            parent_view: Id,
            attached_as_child: bool,
        },
        MetalOverlayWindow {
            parent_window: Id,
            parent_view: Id,
        },
    }

    struct NativeSurface {
        owner: SurfaceOwner,
        view: Id,
        context: Id,
        metal_surface: *mut c_void,
        frame: u64,
        texture: u32,
        texture_width: i32,
        texture_height: i32,
        pending_frame: Option<FrameUpload>,
        transparent_background: bool,
    }

    unsafe impl Send for NativeSurface {}

    struct FrameUpload {
        width: i32,
        height: i32,
        data: Vec<u8>,
    }

    static SURFACE: Lazy<Mutex<Option<NativeSurface>>> = Lazy::new(|| Mutex::new(None));
    static TRANSPARENT_OPEN_GL_VIEW_CLASS: Lazy<&'static Class> =
        Lazy::new(register_transparent_open_gl_view_class);

    #[link(name = "OpenGL", kind = "framework")]
    extern "C" {
        fn glBegin(mode: u32);
        fn glBindTexture(target: u32, texture: u32);
        fn glClear(mask: u32);
        fn glClearColor(red: f32, green: f32, blue: f32, alpha: f32);
        fn glColor4f(red: f32, green: f32, blue: f32, alpha: f32);
        fn glDeleteTextures(n: i32, textures: *const u32);
        fn glDisable(cap: u32);
        fn glEnable(cap: u32);
        fn glEnd();
        fn glGenTextures(n: i32, textures: *mut u32);
        fn glLoadIdentity();
        fn glMatrixMode(mode: u32);
        fn glOrtho(left: f64, right: f64, bottom: f64, top: f64, z_near: f64, z_far: f64);
        fn glPixelStorei(pname: u32, param: i32);
        fn glTexCoord2f(s: f32, t: f32);
        fn glTexImage2D(
            target: u32,
            level: i32,
            internal_format: i32,
            width: i32,
            height: i32,
            border: i32,
            format: u32,
            ty: u32,
            pixels: *const c_void,
        );
        fn glTexParameteri(target: u32, pname: u32, param: i32);
        fn glVertex2f(x: f32, y: f32);
        fn glViewport(x: i32, y: i32, width: i32, height: i32);
    }

    extern "C" {
        fn steam_bridge_metal_surface_create(
            x: f64,
            y: f64,
            width: f64,
            height: f64,
            title: *const i8,
        ) -> *mut c_void;
        fn steam_bridge_metal_surface_set_frame(
            surface: *mut c_void,
            x: f64,
            y: f64,
            width: f64,
            height: f64,
        );
        fn steam_bridge_metal_surface_attach_to_parent(
            surface: *mut c_void,
            parent_window: *mut c_void,
        );
        fn steam_bridge_metal_surface_show(surface: *mut c_void);
        fn steam_bridge_metal_surface_hide(surface: *mut c_void);
        fn steam_bridge_metal_surface_set_input_passthrough(
            surface: *mut c_void,
            pass_through: bool,
        );
        fn steam_bridge_metal_surface_set_opaque(surface: *mut c_void, opaque: bool);
        fn steam_bridge_metal_surface_render_frame(
            surface: *mut c_void,
            bytes: *const c_void,
            width: u32,
            height: u32,
        );
        fn steam_bridge_metal_surface_pump(surface: *mut c_void);
        fn steam_bridge_metal_surface_set_continuous_present(
            surface: *mut c_void,
            continuous: bool,
            frame_rate: f64,
        );
        fn steam_bridge_metal_surface_diagnostics_json(surface: *mut c_void) -> *mut i8;
        fn steam_bridge_metal_surface_destroy(surface: *mut c_void);
        fn steam_bridge_macos_window_snapshot_json(app_id: u32) -> *mut i8;
        fn steam_bridge_macos_session_screen_is_locked() -> bool;
        fn steam_bridge_macos_main_display_is_asleep() -> bool;
        fn steam_bridge_macos_free_string(value: *mut i8);
    }

    pub fn open(
        title: Option<String>,
        _client_width: Option<u32>,
        _client_height: Option<u32>,
        _min_client_width: Option<u32>,
        _min_client_height: Option<u32>,
    ) -> Result<(), Error> {
        ensure_main_thread()?;
        close();

        let title = title.unwrap_or_else(|| "Steam Bridge Native Overlay Probe".to_owned());
        let surface = unsafe { create_probe_window(&title)? };

        *SURFACE
            .lock()
            .expect("Steam overlay native surface lock poisoned") = Some(surface);

        pump()?;
        Ok(())
    }

    pub fn attach_to_parent(
        parent_handle: usize,
        _initial_bounds: Option<(i32, i32, u32, u32)>,
    ) -> Result<(), Error> {
        ensure_main_thread()?;
        close();

        if parent_handle == 0 {
            return Err(Error::from_reason(
                "Electron native window handle was empty",
            ));
        }

        let surface = unsafe { create_embedded_view(parent_handle as Id)? };

        *SURFACE
            .lock()
            .expect("Steam overlay native surface lock poisoned") = Some(surface);

        pump()?;
        Ok(())
    }

    pub fn attach_to_parent_for_overlay(parent_handle: usize) -> Result<(), Error> {
        attach_to_parent(parent_handle, None)
    }

    pub fn show() -> Result<(), Error> {
        ensure_main_thread()?;

        let mut guard = SURFACE
            .lock()
            .expect("Steam overlay native surface lock poisoned");
        let Some(surface) = guard.as_mut() else {
            return Ok(());
        };

        unsafe {
            if !surface.metal_surface.is_null() {
                steam_bridge_metal_surface_show(surface.metal_surface);
                return Ok(());
            }

            match surface.owner {
                SurfaceOwner::ProbeWindow { window } => {
                    let _: () = msg_send![window, orderFrontRegardless];
                }
                SurfaceOwner::EmbeddedWindow { window, .. } => {
                    let _: () = msg_send![window, orderFrontRegardless];
                }
                SurfaceOwner::MetalOverlayWindow { .. } => {}
            }
        }

        Ok(())
    }

    pub fn hide() -> Result<(), Error> {
        ensure_main_thread()?;

        let mut guard = SURFACE
            .lock()
            .expect("Steam overlay native surface lock poisoned");
        let Some(surface) = guard.as_mut() else {
            return Ok(());
        };

        unsafe {
            if !surface.metal_surface.is_null() {
                steam_bridge_metal_surface_hide(surface.metal_surface);
                return Ok(());
            }

            match surface.owner {
                SurfaceOwner::ProbeWindow { window } => {
                    let _: () = msg_send![window, orderOut: NIL];
                }
                SurfaceOwner::EmbeddedWindow { window, .. } => {
                    let _: () = msg_send![window, orderOut: NIL];
                }
                SurfaceOwner::MetalOverlayWindow { .. } => {}
            }
        }

        Ok(())
    }

    pub fn set_input_passthrough(pass_through: bool) -> Result<(), Error> {
        ensure_main_thread()?;

        let mut guard = SURFACE
            .lock()
            .expect("Steam overlay native surface lock poisoned");
        let Some(surface) = guard.as_mut() else {
            return Ok(());
        };

        unsafe {
            if !surface.metal_surface.is_null() {
                steam_bridge_metal_surface_set_input_passthrough(
                    surface.metal_surface,
                    pass_through,
                );
                return Ok(());
            }

            match surface.owner {
                SurfaceOwner::EmbeddedWindow { window, .. } => {
                    let _: () = msg_send![
                        window,
                        setIgnoresMouseEvents: if pass_through { YES } else { NO }
                    ];
                    let _: () = msg_send![
                        window,
                        setAcceptsMouseMovedEvents: if pass_through { NO } else { YES }
                    ];
                }
                SurfaceOwner::ProbeWindow { .. } | SurfaceOwner::MetalOverlayWindow { .. } => {}
            }
        }

        Ok(())
    }

    pub fn set_opaque(opaque: bool) -> Result<(), Error> {
        ensure_main_thread()?;

        let mut guard = SURFACE
            .lock()
            .expect("Steam overlay native surface lock poisoned");
        let Some(surface) = guard.as_mut() else {
            return Ok(());
        };

        unsafe {
            if !surface.metal_surface.is_null() {
                steam_bridge_metal_surface_set_opaque(surface.metal_surface, opaque);
                return Ok(());
            }

            if let SurfaceOwner::EmbeddedWindow { window, .. } = surface.owner {
                set_embedded_window_opacity(window, surface.view, opaque);
                surface.transparent_background = !opaque;
            }
        }

        Ok(())
    }

    pub fn set_cursor_hidden(_hidden: bool) -> Result<(), Error> {
        Ok(())
    }

    pub fn set_continuous_present(continuous: bool, frame_rate: Option<f64>) -> Result<(), Error> {
        ensure_main_thread()?;
        let mut guard = SURFACE
            .lock()
            .expect("Steam overlay native surface lock poisoned");
        let Some(surface) = guard.as_mut() else {
            return Ok(());
        };
        unsafe {
            if !surface.metal_surface.is_null() {
                steam_bridge_metal_surface_set_continuous_present(
                    surface.metal_surface,
                    continuous,
                    frame_rate.unwrap_or(0.0),
                );
            }
        }
        Ok(())
    }

    pub fn set_full_screen(_full_screen: bool) -> Result<(), Error> {
        Ok(())
    }

    pub fn set_presentation_marker(_marker: String) -> Result<(), Error> {
        Ok(())
    }

    pub fn set_menu_json(_menu_json: String) -> Result<(), Error> {
        Ok(())
    }

    pub fn set_bounds(_x: i32, _y: i32, _width: u32, _height: u32) -> Result<(), Error> {
        Ok(())
    }

    pub fn pump() -> Result<(), Error> {
        ensure_main_thread()?;

        let mut guard = SURFACE
            .lock()
            .expect("Steam overlay native surface lock poisoned");
        let Some(surface) = guard.as_mut() else {
            return Ok(());
        };

        unsafe {
            if !surface.metal_surface.is_null() {
                if let SurfaceOwner::MetalOverlayWindow {
                    parent_window,
                    parent_view,
                } = &surface.owner
                {
                    let screen_rect = screen_rect_for_parent_view(*parent_window, *parent_view);
                    steam_bridge_metal_surface_set_frame(
                        surface.metal_surface,
                        screen_rect.origin.x,
                        screen_rect.origin.y,
                        screen_rect.size.width,
                        screen_rect.size.height,
                    );
                }

                if let Some(frame) = surface.pending_frame.take() {
                    steam_bridge_metal_surface_render_frame(
                        surface.metal_surface,
                        frame.data.as_ptr().cast::<c_void>(),
                        frame.width as u32,
                        frame.height as u32,
                    );
                }

                steam_bridge_metal_surface_pump(surface.metal_surface);
                surface.frame = surface.frame.wrapping_add(1);
                return Ok(());
            }

            if let SurfaceOwner::EmbeddedWindow {
                window,
                parent_window,
                parent_view,
                ..
            } = surface.owner
            {
                update_embedded_window_frame(window, parent_window, parent_view);
                let content_view: Id = msg_send![window, contentView];
                let bounds: NSRect = msg_send![content_view, bounds];
                let _: () = msg_send![surface.view, setFrame: bounds];
            }

            let _: () = msg_send![surface.context, makeCurrentContext];
            let content_view: Id = match surface.owner {
                SurfaceOwner::EmbeddedWindow { window, .. } => msg_send![window, contentView],
                SurfaceOwner::ProbeWindow { window } => msg_send![window, contentView],
                SurfaceOwner::MetalOverlayWindow { .. } => return Ok(()),
            };
            let bounds: NSRect = msg_send![content_view, bounds];

            let t = SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .map(|duration| duration.as_millis() as f32 / 1000.0)
                .unwrap_or(0.0);
            match &surface.owner {
                SurfaceOwner::EmbeddedWindow { .. } if surface.transparent_background => {
                    glClearColor(0.0, 0.0, 0.0, 0.0);
                }
                SurfaceOwner::EmbeddedWindow { .. } => {
                    glClearColor(0.0, 0.0, 0.0, 1.0);
                }
                SurfaceOwner::ProbeWindow { .. } => {
                    let red = 0.015 + (t.sin() + 1.0) * 0.015;
                    let green = 0.02 + (t.cos() + 1.0) * 0.012;
                    glClearColor(red, green, 0.035, 1.0);
                }
                SurfaceOwner::MetalOverlayWindow { .. } => {
                    glClearColor(0.0, 0.0, 0.0, 0.0);
                }
            }
            glClear(GL_COLOR_BUFFER_BIT);
            draw_frame_texture(surface, bounds);

            let _: () = msg_send![surface.context, flushBuffer];
            let _: () = msg_send![surface.view, displayIfNeeded];
            surface.frame = surface.frame.wrapping_add(1);
        }

        Ok(())
    }

    pub fn update_frame(buffer: Buffer, width: u32, height: u32) -> Result<(), Error> {
        ensure_main_thread()?;

        let expected_len = checked_native_overlay_frame_byte_len(width, height, "macOS")?;
        if buffer.len() < expected_len {
            return Err(Error::from_reason(format!(
                "Native overlay frame buffer is too small: got {}, expected at least {}",
                buffer.len(),
                expected_len
            )));
        }

        let mut guard = SURFACE
            .lock()
            .expect("Steam overlay native surface lock poisoned");
        let Some(surface) = guard.as_mut() else {
            return Ok(());
        };

        surface.pending_frame = Some(FrameUpload {
            width: width as i32,
            height: height as i32,
            data: buffer[..expected_len].to_vec(),
        });

        Ok(())
    }

    pub fn update_shared_texture(
        _handle: Buffer,
        _width: u32,
        _height: u32,
        _content_x: Option<u32>,
        _content_y: Option<u32>,
        _content_width: Option<u32>,
        _content_height: Option<u32>,
        _presentation_x: Option<u32>,
        _presentation_y: Option<u32>,
        _presentation_width: Option<u32>,
        _presentation_height: Option<u32>,
    ) -> Result<(), Error> {
        Err(Error::from_reason(
            "Electron shared textures are currently supported only by the Windows D3D11 native host",
        ))
    }

    pub fn close() {
        let Some(surface) = take_surface() else {
            return;
        };
        destroy_surface(surface);
    }

    pub fn close_probe() {
        close_matching(|surface| matches!(surface.owner, SurfaceOwner::ProbeWindow { .. }));
    }

    pub fn detach_host() {
        close_matching(|surface| {
            matches!(
                surface.owner,
                SurfaceOwner::EmbeddedWindow { .. } | SurfaceOwner::MetalOverlayWindow { .. }
            )
        });
    }

    fn close_matching(matches: impl FnOnce(&NativeSurface) -> bool) {
        let surface = {
            let mut guard = SURFACE
                .lock()
                .expect("Steam overlay native surface lock poisoned");
            if guard.as_ref().map(matches).unwrap_or(false) {
                guard.take()
            } else {
                None
            }
        };

        if let Some(surface) = surface {
            destroy_surface(surface);
        }
    }

    fn take_surface() -> Option<NativeSurface> {
        SURFACE
            .lock()
            .expect("Steam overlay native surface lock poisoned")
            .take()
    }

    fn destroy_surface(surface: NativeSurface) {
        unsafe {
            if !surface.metal_surface.is_null() {
                steam_bridge_metal_surface_destroy(surface.metal_surface);
                if let SurfaceOwner::MetalOverlayWindow {
                    parent_window,
                    parent_view,
                } = surface.owner
                {
                    let _: () = msg_send![parent_view, setNeedsDisplay: YES];
                    let _: () = msg_send![parent_view, displayIfNeeded];
                    let _: () = msg_send![parent_view, release];
                    if !parent_window.is_null() {
                        let _: () = msg_send![parent_window, makeKeyAndOrderFront: NIL];
                        let _: () = msg_send![parent_window, displayIfNeeded];
                        let _: () = msg_send![parent_window, release];
                    }
                }
                return;
            }

            let _: () = msg_send![surface.context, makeCurrentContext];
            if surface.texture != 0 {
                glDeleteTextures(1, &surface.texture);
            }
            glClearColor(0.0, 0.0, 0.0, 0.0);
            glClear(GL_COLOR_BUFFER_BIT);
            let _: () = msg_send![surface.context, flushBuffer];
            let _: () = msg_send![surface.view, setHidden: YES];
            let _: () = msg_send![surface.view, setNeedsDisplay: YES];
            let _: () = msg_send![surface.context, clearDrawable];
            let _: () = msg_send![surface.view, removeFromSuperview];
            let _: () = msg_send![surface.context, release];
            let _: () = msg_send![surface.view, release];

            match surface.owner {
                SurfaceOwner::ProbeWindow { window } => {
                    let _: () = msg_send![window, orderOut: NIL];
                    let _: () = msg_send![window, close];
                    let _: () = msg_send![window, release];
                }
                SurfaceOwner::EmbeddedWindow {
                    window,
                    parent_window,
                    parent_view,
                    attached_as_child,
                } => {
                    if attached_as_child {
                        let _: () = msg_send![parent_window, removeChildWindow: window];
                    }
                    let _: () = msg_send![window, orderOut: NIL];
                    let _: () = msg_send![window, close];
                    let _: () = msg_send![window, release];
                    let _: () = msg_send![parent_view, setNeedsDisplay: YES];
                    let _: () = msg_send![parent_view, displayIfNeeded];
                    if !parent_window.is_null() {
                        let _: () = msg_send![parent_window, makeKeyAndOrderFront: NIL];
                        let _: () = msg_send![parent_window, displayIfNeeded];
                    }
                    let _: () = msg_send![parent_window, release];
                    let _: () = msg_send![parent_view, release];
                }
                SurfaceOwner::MetalOverlayWindow {
                    parent_window,
                    parent_view,
                } => {
                    let _: () = msg_send![parent_view, setNeedsDisplay: YES];
                    let _: () = msg_send![parent_view, displayIfNeeded];
                    let _: () = msg_send![parent_view, release];
                    if !parent_window.is_null() {
                        let _: () = msg_send![parent_window, makeKeyAndOrderFront: NIL];
                        let _: () = msg_send![parent_window, displayIfNeeded];
                        let _: () = msg_send![parent_window, release];
                    }
                }
            }
        }
    }

    pub fn is_probe_open() -> bool {
        SURFACE
            .lock()
            .expect("Steam overlay native surface lock poisoned")
            .as_ref()
            .is_some_and(|surface| matches!(surface.owner, SurfaceOwner::ProbeWindow { .. }))
    }

    pub fn is_embedded() -> bool {
        SURFACE
            .lock()
            .expect("Steam overlay native surface lock poisoned")
            .as_ref()
            .is_some_and(|surface| {
                matches!(
                    surface.owner,
                    SurfaceOwner::EmbeddedWindow { .. } | SurfaceOwner::MetalOverlayWindow { .. }
                )
            })
    }

    pub fn mac_window_snapshot_json(app_id: u32) -> Option<String> {
        unsafe {
            let value = steam_bridge_macos_window_snapshot_json(app_id);
            if value.is_null() {
                return None;
            }

            let json = CStr::from_ptr(value).to_string_lossy().into_owned();
            steam_bridge_macos_free_string(value);
            Some(json)
        }
    }

    pub fn mac_screen_locked() -> bool {
        unsafe { steam_bridge_macos_session_screen_is_locked() }
    }

    pub fn mac_display_asleep() -> bool {
        unsafe { steam_bridge_macos_main_display_is_asleep() }
    }

    pub fn host_diagnostics_json() -> Option<String> {
        if ensure_main_thread().is_err() {
            return None;
        }

        let guard = SURFACE
            .lock()
            .expect("Steam overlay native surface lock poisoned");
        let surface = guard.as_ref()?;
        if surface.metal_surface.is_null() {
            return None;
        }

        unsafe {
            let value = steam_bridge_metal_surface_diagnostics_json(surface.metal_surface);
            if value.is_null() {
                return None;
            }

            let json = CStr::from_ptr(value).to_string_lossy().into_owned();
            steam_bridge_macos_free_string(value);
            Some(json)
        }
    }

    pub fn drain_input_events_json() -> String {
        "[]".to_owned()
    }

    unsafe fn create_probe_window(title: &str) -> Result<NativeSurface, Error> {
        let pool: Id = msg_send![class!(NSAutoreleasePool), new];

        let window_rect = NSRect {
            origin: NSPoint { x: 160.0, y: 160.0 },
            size: NSSize {
                width: 960.0,
                height: 540.0,
            },
        };
        let style = NS_WINDOW_STYLE_TITLED
            | NS_WINDOW_STYLE_CLOSABLE
            | NS_WINDOW_STYLE_MINIATURIZABLE
            | NS_WINDOW_STYLE_RESIZABLE;

        let window: Id = msg_send![class!(NSWindow), alloc];
        let window: Id = msg_send![
            window,
            initWithContentRect: window_rect
            styleMask: style
            backing: NS_BACKING_STORE_BUFFERED
            defer: NO
        ];
        if window.is_null() {
            drain(pool);
            return Err(Error::from_reason(
                "Failed to create macOS native overlay probe window",
            ));
        }

        let title = ns_string(title);
        let _: () = msg_send![window, setTitle: title];
        let _: () = msg_send![window, setReleasedWhenClosed: NO];

        let content_view: Id = msg_send![window, contentView];
        let (view, context) = create_open_gl_view(content_view, false)?;

        let _: () = msg_send![window, center];
        let _: () = msg_send![window, makeKeyAndOrderFront: NIL];
        let _: () = msg_send![window, orderFrontRegardless];

        drain(pool);

        Ok(NativeSurface {
            owner: SurfaceOwner::ProbeWindow { window },
            view,
            context,
            metal_surface: ptr::null_mut(),
            frame: 0,
            texture: 0,
            texture_width: 0,
            texture_height: 0,
            pending_frame: None,
            transparent_background: false,
        })
    }

    unsafe fn create_embedded_view(native_handle: Id) -> Result<NativeSurface, Error> {
        let pool: Id = msg_send![class!(NSAutoreleasePool), new];
        let parent_view = resolve_parent_view(native_handle);
        if parent_view.is_null() {
            drain(pool);
            return Err(Error::from_reason(
                "Electron native window handle did not resolve to an NSView",
            ));
        }

        let parent_window: Id = msg_send![parent_view, window];
        if parent_window.is_null() {
            drain(pool);
            return Err(Error::from_reason(
                "Electron native window handle did not resolve to an NSWindow",
            ));
        }

        let _: Id = msg_send![parent_view, retain];
        let _: Id = msg_send![parent_window, retain];

        let screen_rect = screen_rect_for_parent_view(parent_window, parent_view);
        if should_use_metal_host() {
            let title = CString::new("Steam Bridge Metal Overlay Host")
                .map_err(|error| Error::from_reason(error.to_string()))?;
            let metal_surface = steam_bridge_metal_surface_create(
                screen_rect.origin.x,
                screen_rect.origin.y,
                screen_rect.size.width,
                screen_rect.size.height,
                title.as_ptr(),
            );
            if metal_surface.is_null() {
                let _: () = msg_send![parent_window, release];
                let _: () = msg_send![parent_view, release];
                drain(pool);
                return Err(Error::from_reason(
                    "Failed to create macOS Metal overlay host window",
                ));
            }
            steam_bridge_metal_surface_attach_to_parent(
                metal_surface,
                parent_window.cast::<c_void>(),
            );

            drain(pool);
            return Ok(NativeSurface {
                owner: SurfaceOwner::MetalOverlayWindow {
                    parent_window,
                    parent_view,
                },
                view: NIL,
                context: NIL,
                metal_surface,
                frame: 0,
                texture: 0,
                texture_width: 0,
                texture_height: 0,
                pending_frame: None,
                transparent_background: true,
            });
        }

        // The legacy OpenGL diagnostic backend follows the same hard ownership
        // contract as Metal: it is always an attached borderless child. A
        // diagnostic environment switch must never resurrect the closed
        // independent-popup architecture.
        let transparent_background = true;
        let style = 0_u64;
        let window: Id = msg_send![class!(NSWindow), alloc];
        let window: Id = msg_send![
            window,
            initWithContentRect: screen_rect
            styleMask: style
            backing: NS_BACKING_STORE_BUFFERED
            defer: NO
        ];
        if window.is_null() {
            let _: () = msg_send![parent_window, release];
            let _: () = msg_send![parent_view, release];
            drain(pool);
            return Err(Error::from_reason(
                "Failed to create macOS transparent overlay child window",
            ));
        }

        let clear_color: Id = msg_send![class!(NSColor), clearColor];
        let black_color: Id = msg_send![class!(NSColor), blackColor];
        let _: () = msg_send![window, setOpaque: if transparent_background { NO } else { YES }];
        let _: () = msg_send![
            window,
            setBackgroundColor: if transparent_background {
                clear_color
            } else {
                black_color
            }
        ];
        let _: () = msg_send![window, setHasShadow: NO];
        let _: () = msg_send![window, setReleasedWhenClosed: NO];
        let _: () = msg_send![window, setIgnoresMouseEvents: YES];
        let _: () = msg_send![window, setAcceptsMouseMovedEvents: NO];

        let content_view: Id = msg_send![window, contentView];
        let (view, context) = match create_open_gl_view(content_view, transparent_background) {
            Ok(result) => result,
            Err(error) => {
                let _: () = msg_send![window, close];
                let _: () = msg_send![window, release];
                let _: () = msg_send![parent_window, release];
                let _: () = msg_send![parent_view, release];
                drain(pool);
                return Err(error);
            }
        };

        let _: () = msg_send![parent_window, addChildWindow: window ordered: NS_WINDOW_ABOVE];
        let _: () = msg_send![parent_window, makeKeyAndOrderFront: NIL];
        let _: () = msg_send![window, orderFront: NIL];

        drain(pool);

        Ok(NativeSurface {
            owner: SurfaceOwner::EmbeddedWindow {
                window,
                parent_window,
                parent_view,
                attached_as_child: true,
            },
            view,
            context,
            metal_surface: ptr::null_mut(),
            frame: 0,
            texture: 0,
            texture_width: 0,
            texture_height: 0,
            pending_frame: None,
            transparent_background,
        })
    }

    unsafe fn draw_frame_texture(surface: &mut NativeSurface, bounds: NSRect) {
        if let Some(frame) = surface.pending_frame.take() {
            upload_frame_texture(surface, frame);
        }

        if surface.texture == 0 {
            return;
        }

        let backing_bounds: NSRect = msg_send![surface.view, convertRectToBacking: bounds];
        let width = backing_bounds.size.width.max(1.0) as i32;
        let height = backing_bounds.size.height.max(1.0) as i32;

        glViewport(0, 0, width, height);
        glDisable(GL_DEPTH_TEST);
        glEnable(GL_TEXTURE_2D);
        glBindTexture(GL_TEXTURE_2D, surface.texture);
        glColor4f(1.0, 1.0, 1.0, 1.0);

        glMatrixMode(GL_PROJECTION);
        glLoadIdentity();
        glOrtho(0.0, width as f64, height as f64, 0.0, -1.0, 1.0);
        glMatrixMode(GL_MODELVIEW);
        glLoadIdentity();

        glBegin(GL_QUADS);
        glTexCoord2f(0.0, 0.0);
        glVertex2f(0.0, 0.0);
        glTexCoord2f(1.0, 0.0);
        glVertex2f(width as f32, 0.0);
        glTexCoord2f(1.0, 1.0);
        glVertex2f(width as f32, height as f32);
        glTexCoord2f(0.0, 1.0);
        glVertex2f(0.0, height as f32);
        glEnd();
    }

    unsafe fn upload_frame_texture(surface: &mut NativeSurface, frame: FrameUpload) {
        if surface.texture == 0 {
            glGenTextures(1, &mut surface.texture);
            glBindTexture(GL_TEXTURE_2D, surface.texture);
            glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MIN_FILTER, GL_LINEAR);
            glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MAG_FILTER, GL_LINEAR);
            glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_WRAP_S, GL_CLAMP_TO_EDGE);
            glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_WRAP_T, GL_CLAMP_TO_EDGE);
        } else {
            glBindTexture(GL_TEXTURE_2D, surface.texture);
        }

        glPixelStorei(GL_UNPACK_ALIGNMENT, 1);
        glTexImage2D(
            GL_TEXTURE_2D,
            0,
            GL_RGBA as i32,
            frame.width,
            frame.height,
            0,
            GL_BGRA,
            GL_UNSIGNED_BYTE,
            frame.data.as_ptr().cast::<c_void>(),
        );
        surface.texture_width = frame.width;
        surface.texture_height = frame.height;
    }

    unsafe fn resolve_parent_view(native_handle: Id) -> Id {
        if native_handle.is_null() {
            return NIL;
        }

        let responds_to_content_view: BOOL =
            msg_send![native_handle, respondsToSelector: sel!(contentView)];
        if responds_to_content_view == YES {
            let content_view: Id = msg_send![native_handle, contentView];
            return content_view;
        }

        native_handle
    }

    unsafe fn create_open_gl_view(parent_view: Id, transparent: bool) -> Result<(Id, Id), Error> {
        let attrs = [
            NS_OPENGL_PFA_DOUBLE_BUFFER,
            NS_OPENGL_PFA_ACCELERATED,
            NS_OPENGL_PFA_NO_RECOVERY,
            NS_OPENGL_PFA_COLOR_SIZE,
            24,
            NS_OPENGL_PFA_ALPHA_SIZE,
            8,
            NS_OPENGL_PFA_DEPTH_SIZE,
            24,
            0,
        ];
        let pixel_format: Id = msg_send![class!(NSOpenGLPixelFormat), alloc];
        let pixel_format: Id = msg_send![pixel_format, initWithAttributes: attrs.as_ptr()];
        if pixel_format.is_null() {
            return Err(Error::from_reason(
                "Failed to create macOS native OpenGL pixel format",
            ));
        }

        let parent_bounds: NSRect = msg_send![parent_view, bounds];
        let view_class = if transparent {
            *TRANSPARENT_OPEN_GL_VIEW_CLASS
        } else {
            class!(NSOpenGLView)
        };
        let view: Id = msg_send![view_class, alloc];
        let view: Id = msg_send![view, initWithFrame: parent_bounds pixelFormat: pixel_format];
        let _: () = msg_send![pixel_format, release];

        if view.is_null() {
            return Err(Error::from_reason(
                "Failed to create macOS native OpenGL view",
            ));
        }

        let autoresizing = NS_VIEW_WIDTH_SIZABLE | NS_VIEW_HEIGHT_SIZABLE;
        let _: () = msg_send![view, setAutoresizingMask: autoresizing];
        let _: () = msg_send![view, setWantsBestResolutionOpenGLSurface: YES];
        if transparent {
            let _: () = msg_send![view, setAlphaValue: 1.0_f64];
        }
        let _: () = msg_send![parent_view, addSubview: view];

        let context: Id = msg_send![view, openGLContext];
        if context.is_null() {
            let _: () = msg_send![view, removeFromSuperview];
            let _: () = msg_send![view, release];
            return Err(Error::from_reason(
                "Failed to create macOS native OpenGL context",
            ));
        }
        let _: Id = msg_send![context, retain];

        Ok((view, context))
    }

    unsafe fn update_embedded_window_frame(window: Id, parent_window: Id, parent_view: Id) {
        let screen_rect = screen_rect_for_parent_view(parent_window, parent_view);
        let _: () = msg_send![window, setFrame: screen_rect display: NO];
    }

    unsafe fn set_embedded_window_opacity(window: Id, view: Id, opaque: bool) {
        let clear_color: Id = msg_send![class!(NSColor), clearColor];
        let black_color: Id = msg_send![class!(NSColor), blackColor];
        let _: () = msg_send![window, setOpaque: if opaque { YES } else { NO }];
        let _: () = msg_send![
            window,
            setBackgroundColor: if opaque { black_color } else { clear_color }
        ];
        let _: () = msg_send![view, setAlphaValue: 1.0_f64];
        let _: () = msg_send![view, setNeedsDisplay: YES];
    }

    unsafe fn screen_rect_for_parent_view(parent_window: Id, parent_view: Id) -> NSRect {
        if !parent_window.is_null() {
            let content_layout_rect: NSRect = msg_send![parent_window, contentLayoutRect];
            if content_layout_rect.origin.x.is_finite()
                && content_layout_rect.origin.y.is_finite()
                && content_layout_rect.size.width.is_finite()
                && content_layout_rect.size.height.is_finite()
                && content_layout_rect.size.width > 0.0
                && content_layout_rect.size.height > 0.0
            {
                return msg_send![parent_window, convertRectToScreen: content_layout_rect];
            }
        }

        // Electron can retain a full-frame content view after leaving simple
        // fullscreen. Fall back to that view only when AppKit has no usable
        // non-obscured content layout for the parent window.
        let bounds: NSRect = msg_send![parent_view, bounds];
        let rect_in_window: NSRect = msg_send![parent_view, convertRect: bounds toView: NIL];
        msg_send![parent_window, convertRectToScreen: rect_in_window]
    }

    fn register_transparent_open_gl_view_class() -> &'static Class {
        if let Some(existing) = Class::get("SteamBridgeTransparentOpenGLView") {
            return existing;
        }

        let superclass = class!(NSOpenGLView);
        let mut decl = ClassDecl::new("SteamBridgeTransparentOpenGLView", superclass)
            .expect("failed to allocate SteamBridgeTransparentOpenGLView class");

        unsafe {
            decl.add_method(
                sel!(isOpaque),
                steam_bridge_open_gl_view_is_opaque as extern "C" fn(&Object, Sel) -> BOOL,
            );
            decl.add_method(
                sel!(acceptsFirstResponder),
                steam_bridge_open_gl_view_accepts_first_responder
                    as extern "C" fn(&Object, Sel) -> BOOL,
            );
        }

        decl.register()
    }

    extern "C" fn steam_bridge_open_gl_view_is_opaque(_: &Object, _: Sel) -> BOOL {
        NO
    }

    extern "C" fn steam_bridge_open_gl_view_accepts_first_responder(_: &Object, _: Sel) -> BOOL {
        YES
    }

    fn should_use_metal_host() -> bool {
        if env::var_os("STEAM_BRIDGE_MAC_NATIVE_OPENGL_HOST").is_some() {
            return false;
        }

        env::var("STEAM_BRIDGE_MAC_NATIVE_METAL_HOST")
            .map(|value| {
                !matches!(
                    value.to_ascii_lowercase().as_str(),
                    "0" | "false" | "no" | "off"
                )
            })
            .unwrap_or(true)
    }

    pub fn ensure_main_thread() -> Result<(), Error> {
        let is_main_thread: BOOL = unsafe { msg_send![class!(NSThread), isMainThread] };
        if is_main_thread == YES {
            Ok(())
        } else {
            Err(Error::from_reason(
                "macOS native overlay surface must be called on the main thread",
            ))
        }
    }

    unsafe fn ns_string(value: &str) -> Id {
        let string: Id = msg_send![class!(NSString), alloc];
        let string: Id = msg_send![
            string,
            initWithBytes: value.as_ptr() as *const c_void
            length: value.len()
            encoding: NS_UTF8_STRING_ENCODING
        ];
        let string: Id = msg_send![string, autorelease];
        string
    }

    unsafe fn drain(pool: Id) {
        let _: () = msg_send![pool, drain];
    }
}

#[cfg(not(any(target_os = "macos", target_os = "linux", target_os = "windows")))]
mod fallback {
    use super::Error;

    pub fn ensure_main_thread() -> Result<(), Error> {
        Ok(())
    }

    pub fn open(
        _title: Option<String>,
        _client_width: Option<u32>,
        _client_height: Option<u32>,
    ) -> Result<(), Error> {
        Err(Error::from_reason(
            "Steam Bridge native overlay probe is not implemented on this platform",
        ))
    }

    pub fn attach_to_parent(
        _parent_handle: usize,
        _initial_bounds: Option<(i32, i32, u32, u32)>,
    ) -> Result<(), Error> {
        Err(Error::from_reason(
            "Steam Bridge native overlay host view is not implemented on this platform",
        ))
    }

    pub fn attach_to_parent_for_overlay(parent_handle: usize) -> Result<(), Error> {
        attach_to_parent(parent_handle, None)
    }

    pub fn pump() -> Result<(), Error> {
        Ok(())
    }

    pub fn show() -> Result<(), Error> {
        Ok(())
    }

    pub fn hide() -> Result<(), Error> {
        Ok(())
    }

    pub fn set_input_passthrough(_pass_through: bool) -> Result<(), Error> {
        Ok(())
    }

    pub fn set_opaque(_opaque: bool) -> Result<(), Error> {
        Ok(())
    }

    pub fn set_cursor_hidden(_hidden: bool) -> Result<(), Error> {
        Ok(())
    }

    pub fn set_continuous_present(
        _continuous: bool,
        _frame_rate: Option<f64>,
    ) -> Result<(), Error> {
        Ok(())
    }

    pub fn set_full_screen(_full_screen: bool) -> Result<(), Error> {
        Ok(())
    }

    pub fn set_presentation_marker(_marker: String) -> Result<(), Error> {
        Ok(())
    }

    pub fn set_menu_json(_menu_json: String) -> Result<(), Error> {
        Ok(())
    }

    pub fn set_bounds(_x: i32, _y: i32, _width: u32, _height: u32) -> Result<(), Error> {
        Ok(())
    }

    pub fn update_frame(_buffer: super::Buffer, _width: u32, _height: u32) -> Result<(), Error> {
        Ok(())
    }

    pub fn update_shared_texture(
        _handle: super::Buffer,
        _width: u32,
        _height: u32,
        _content_x: Option<u32>,
        _content_y: Option<u32>,
        _content_width: Option<u32>,
        _content_height: Option<u32>,
        _presentation_x: Option<u32>,
        _presentation_y: Option<u32>,
        _presentation_width: Option<u32>,
        _presentation_height: Option<u32>,
    ) -> Result<(), Error> {
        Err(Error::from_reason(
            "Electron shared textures are currently supported only by the Windows D3D11 native host",
        ))
    }

    pub fn close() {}

    pub fn close_probe() {}

    pub fn detach_host() {}

    pub fn is_probe_open() -> bool {
        false
    }

    pub fn is_embedded() -> bool {
        false
    }

    pub fn mac_window_snapshot_json(_app_id: u32) -> Option<String> {
        None
    }

    pub fn mac_screen_locked() -> bool {
        false
    }

    pub fn mac_display_asleep() -> bool {
        false
    }

    pub fn host_diagnostics_json() -> Option<String> {
        None
    }

    pub fn drain_input_events_json() -> String {
        "[]".to_owned()
    }
}

#[cfg(not(any(target_os = "macos", target_os = "linux", target_os = "windows")))]
pub use fallback::*;
#[cfg(target_os = "macos")]
pub use macos::*;

#[cfg(target_os = "windows")]
mod windows {
    use super::{checked_native_overlay_frame_byte_len, Buffer, Error};
    use crate::windows_d3d11::{
        self, FrameLatencyWaitHandle, SharedTextureCopyWaitHandle, SharedTextureImportSubmission,
        WindowsD3d11Renderer,
    };
    use once_cell::sync::Lazy;
    use serde::{Deserialize, Serialize};
    use serde_json::json;
    use std::collections::HashMap;
    use std::env;
    use std::mem;
    use std::ptr;
    use std::sync::atomic::{AtomicBool, AtomicU32, AtomicU64, Ordering};
    use std::sync::{Mutex, OnceLock};
    use std::time::{Duration, Instant, SystemTime, UNIX_EPOCH};

    pub fn ensure_main_thread() -> Result<(), Error> {
        Ok(())
    }
    use windows_sys::Win32::Foundation::{
        CloseHandle, GetLastError, SetLastError, HWND, LPARAM, LRESULT, POINT, RECT, SIZE, WPARAM,
    };
    use windows_sys::Win32::Graphics::Dwm::{
        DwmSetWindowAttribute, DWMWA_TRANSITIONS_FORCEDISABLED, DWMWA_WINDOW_CORNER_PREFERENCE,
        DWMWCP_DONOTROUND, DWMWCP_ROUND,
    };
    use windows_sys::Win32::Graphics::Gdi::{
        BeginPaint, ClientToScreen, CreateFontIndirectW, DeleteObject, DrawFrameControl, DrawTextW,
        EndPaint, EnumDisplaySettingsW, FillRect, GetDC, GetMonitorInfoW, GetStockObject,
        GetSysColor, GetSysColorBrush, GetTextExtentPoint32W, MonitorFromWindow, ReleaseDC,
        ScreenToClient, SelectObject, SetBkMode, SetTextColor, COLOR_GRAYTEXT, COLOR_HIGHLIGHT,
        COLOR_HIGHLIGHTTEXT, COLOR_MENU, COLOR_MENUBAR, COLOR_MENUTEXT, DEFAULT_GUI_FONT, DEVMODEW,
        DFCS_INACTIVE, DFCS_MENUARROW, DFC_MENU, DT_HIDEPREFIX, DT_LEFT, DT_RIGHT, DT_SINGLELINE,
        DT_VCENTER, ENUM_CURRENT_SETTINGS, HDC, MONITORINFO, MONITORINFOEXW,
        MONITOR_DEFAULTTONEAREST, PAINTSTRUCT, TRANSPARENT,
    };
    use windows_sys::Win32::Graphics::OpenGL::{
        ChoosePixelFormat, SetPixelFormat, SwapBuffers, PFD_DOUBLEBUFFER, PFD_DRAW_TO_WINDOW,
        PFD_MAIN_PLANE, PFD_SUPPORT_OPENGL, PFD_TYPE_RGBA, PIXELFORMATDESCRIPTOR,
    };
    use windows_sys::Win32::System::LibraryLoader::GetModuleHandleW;
    use windows_sys::Win32::System::Threading::{
        OpenProcess, QueryFullProcessImageNameW, PROCESS_QUERY_LIMITED_INFORMATION,
    };
    use windows_sys::Win32::UI::Accessibility::{MSAAMENUINFO, MSAA_MENU_SIG};
    use windows_sys::Win32::UI::Controls::{
        DRAWITEMSTRUCT, MEASUREITEMSTRUCT, ODS_DISABLED, ODS_GRAYED, ODS_NOACCEL, ODS_SELECTED,
        ODT_MENU,
    };
    use windows_sys::Win32::UI::HiDpi::{
        AdjustWindowRectExForDpi, AreDpiAwarenessContextsEqual, GetDpiForSystem, GetDpiForWindow,
        GetSystemMetricsForDpi, GetWindowDpiAwarenessContext, SetThreadDpiAwarenessContext,
        SystemParametersInfoForDpi, DPI_AWARENESS_CONTEXT,
        DPI_AWARENESS_CONTEXT_PER_MONITOR_AWARE_V2,
    };
    use windows_sys::Win32::UI::Input::KeyboardAndMouse::{
        ActivateKeyboardLayout, GetAsyncKeyState, GetCapture, GetKeyState, GetKeyboardLayout,
        ReleaseCapture, SetActiveWindow, SetCapture, SetFocus, VK_LBUTTON, VK_RBUTTON,
    };
    use windows_sys::Win32::UI::WindowsAndMessaging::{
        AppendMenuW, CreateCursor, CreateMenu, CreatePopupMenu, CreateWindowExW, DefWindowProcW,
        DestroyCursor, DestroyMenu, DestroyWindow, DispatchMessageW, DrawMenuBar, EnumWindows,
        GetClassNameW, GetClientRect, GetCursorPos, GetForegroundWindow, GetMenu, GetMenuBarInfo,
        GetSystemMetrics, GetWindow, GetWindowLongPtrW, GetWindowPlacement, GetWindowRect,
        GetWindowTextW, GetWindowThreadProcessId, InsertMenuItemW, IsIconic, IsWindow,
        IsWindowVisible, IsZoomed, KillTimer, LoadCursorW, PeekMessageW, RegisterClassW, SetCursor,
        SetForegroundWindow, SetLayeredWindowAttributes, SetMenu, SetTimer, SetWindowLongPtrW,
        SetWindowPlacement, SetWindowPos, ShowCursor, ShowWindow, SystemParametersInfoW,
        TranslateMessage, CS_OWNDC, GWLP_HWNDPARENT, GWL_EXSTYLE, GWL_STYLE, GW_OWNER, HCURSOR,
        HMENU, IDC_ARROW, LWA_ALPHA, MA_NOACTIVATE, MENUBARINFO, MENUITEMINFOW, MFS_DISABLED,
        MFS_ENABLED, MFT_OWNERDRAW, MFT_SEPARATOR, MF_GRAYED, MF_POPUP, MF_SEPARATOR, MF_STRING,
        MIIM_DATA, MIIM_FTYPE, MIIM_ID, MIIM_STATE, MIIM_STRING, MIIM_SUBMENU, MINMAXINFO, MSG,
        NONCLIENTMETRICSW, OBJID_MENU, PM_REMOVE, SIZE_MINIMIZED, SM_CXMENUCHECK, SM_CXMENUSIZE,
        SM_CXSCREEN, SM_CYMENU, SM_CYMENUSIZE, SM_CYSCREEN, SM_SWAPBUTTON, SPI_GETNONCLIENTMETRICS,
        SPI_GETWORKAREA, SWP_FRAMECHANGED, SWP_HIDEWINDOW, SWP_NOACTIVATE, SWP_NOMOVE,
        SWP_NOOWNERZORDER, SWP_NOSIZE, SWP_NOZORDER, SW_HIDE, SW_SHOW, SW_SHOWNOACTIVATE,
        WINDOWPLACEMENT, WM_ACTIVATE, WM_ACTIVATEAPP, WM_CANCELMODE, WM_CAPTURECHANGED, WM_CHAR,
        WM_CLOSE, WM_COMMAND, WM_DISPLAYCHANGE, WM_DPICHANGED, WM_DRAWITEM, WM_ENTERSIZEMOVE,
        WM_ERASEBKGND, WM_EXITSIZEMOVE, WM_GETMINMAXINFO, WM_KEYDOWN, WM_KEYUP, WM_KILLFOCUS,
        WM_LBUTTONDOWN, WM_LBUTTONUP, WM_MBUTTONDOWN, WM_MBUTTONUP, WM_MEASUREITEM,
        WM_MOUSEACTIVATE, WM_MOUSEMOVE, WM_MOUSEWHEEL, WM_MOVE, WM_NCHITTEST, WM_NCLBUTTONDOWN,
        WM_NCLBUTTONUP, WM_PAINT, WM_RBUTTONDOWN, WM_RBUTTONUP, WM_SETCURSOR, WM_SETFOCUS,
        WM_SETTINGCHANGE, WM_SIZE, WM_SYSCOMMAND, WM_SYSKEYDOWN, WM_SYSKEYUP, WM_TIMER, WNDCLASSW,
        WS_CLIPCHILDREN, WS_CLIPSIBLINGS, WS_EX_LAYERED, WS_EX_NOACTIVATE, WS_EX_TOOLWINDOW,
        WS_EX_TOPMOST, WS_EX_TRANSPARENT, WS_OVERLAPPEDWINDOW,
    };

    type Hglrc = isize;

    const GL_COLOR_BUFFER_BIT: u32 = 0x0000_4000;
    const MK_LBUTTON: u32 = 0x0001;
    const MK_RBUTTON: u32 = 0x0002;
    const MK_MBUTTON: u32 = 0x0010;
    const RETAINED_FRAME_REFRESH_INTERVAL: Duration = Duration::from_millis(250);
    const STEAM_DIALOG_SCAN_INTERVAL: Duration = Duration::from_millis(100);
    const MAX_STEAM_DIALOG_WINDOWS: usize = 16;
    const MODAL_PRESENT_TIMER_ID: usize = 0x5342;
    // Live sizing enters a nested Win32 modal loop. Presenting every 1 ms made
    // ResizeBuffers race prior flips repeatedly and could remove the D3D
    // device. Coalesce sizing paints to 60 Hz; normal display-rate presentation
    // resumes immediately after the modal loop exits.
    const MODAL_PRESENT_INTERVAL_MS: u32 = 16;
    const VK_TAB_CODE: i32 = 0x09;
    const VK_SHIFT_CODE: i32 = 0x10;
    const VK_CONTROL_CODE: i32 = 0x11;
    const VK_ALT_CODE: i32 = 0x12;
    const VK_CAPS_LOCK_CODE: i32 = 0x14;
    const VK_NUM_LOCK_CODE: i32 = 0x90;
    const VK_LEFT_SHIFT_CODE: i32 = 0xA0;
    const VK_RIGHT_SHIFT_CODE: i32 = 0xA1;
    const VK_LEFT_CONTROL_CODE: i32 = 0xA2;
    const VK_RIGHT_CONTROL_CODE: i32 = 0xA3;
    const VK_LEFT_ALT_CODE: i32 = 0xA4;
    const VK_RIGHT_ALT_CODE: i32 = 0xA5;

    struct WindowDisplayDiagnostics {
        device_name: String,
        refresh_rate: Option<u32>,
    }

    fn normalize_windows_display_refresh_rate(refresh_rate: u32) -> Option<u32> {
        // EnumDisplaySettings documents 0 and 1 as driver-defined default-rate
        // sentinels rather than measured Hz values. Let the consumer use its
        // Electron fallback when Windows returns either sentinel.
        (refresh_rate > 1).then_some(refresh_rate)
    }

    unsafe fn window_display_diagnostics(hwnd: HWND) -> Option<WindowDisplayDiagnostics> {
        let monitor = MonitorFromWindow(hwnd, MONITOR_DEFAULTTONEAREST);
        if monitor.is_null() {
            return None;
        }

        let mut monitor_info: MONITORINFOEXW = mem::zeroed();
        monitor_info.monitorInfo.cbSize = mem::size_of::<MONITORINFOEXW>() as u32;
        if GetMonitorInfoW(monitor, &mut monitor_info.monitorInfo) == 0 {
            return None;
        }

        let device_name_end = monitor_info
            .szDevice
            .iter()
            .position(|value| *value == 0)
            .unwrap_or(monitor_info.szDevice.len());
        let device_name = String::from_utf16_lossy(&monitor_info.szDevice[..device_name_end]);
        if device_name.is_empty() {
            return None;
        }

        let mut display_mode: DEVMODEW = mem::zeroed();
        display_mode.dmSize = mem::size_of::<DEVMODEW>() as u16;
        let refresh_rate = if EnumDisplaySettingsW(
            monitor_info.szDevice.as_ptr(),
            ENUM_CURRENT_SETTINGS,
            &mut display_mode,
        ) != 0
        {
            normalize_windows_display_refresh_rate(display_mode.dmDisplayFrequency)
        } else {
            None
        };

        Some(WindowDisplayDiagnostics {
            device_name,
            refresh_rate,
        })
    }

    pub struct FrameLatencyWaitRequest {
        surface_generation: u64,
        handle: FrameLatencyWaitHandle,
    }

    #[derive(Clone, Copy)]
    pub struct FrameLatencyReadyToken {
        surface_generation: u64,
        renderer_generation: u64,
    }

    impl FrameLatencyWaitRequest {
        pub fn token(&self) -> FrameLatencyReadyToken {
            FrameLatencyReadyToken {
                surface_generation: self.surface_generation,
                renderer_generation: self.handle.generation(),
            }
        }

        pub fn wait(self, timeout_ms: u32) -> Result<Option<FrameLatencyReadyToken>, String> {
            let token = self.token();
            let ready = self.handle.wait(timeout_ms)?;
            Ok(ready.then_some(token))
        }
    }

    pub struct SharedTextureUpdateRequest {
        accepted: bool,
        copy_wait: Option<SharedTextureCopyWaitHandle>,
    }

    impl SharedTextureUpdateRequest {
        pub fn is_accepted(&self) -> bool {
            self.accepted
        }

        pub fn wait(self) -> Result<bool, String> {
            if let Some(copy_wait) = self.copy_wait {
                copy_wait.wait()?;
            }
            Ok(self.accepted)
        }
    }
    #[link(name = "opengl32")]
    extern "system" {
        fn glClear(mask: u32);
        fn glClearColor(red: f32, green: f32, blue: f32, alpha: f32);
        fn glViewport(x: i32, y: i32, width: i32, height: i32);
        fn wglCreateContext(hdc: HDC) -> Hglrc;
        fn wglDeleteContext(context: Hglrc) -> i32;
        fn wglMakeCurrent(hdc: HDC, context: Hglrc) -> i32;
    }

    struct NativeSurface {
        instance_generation: u64,
        hwnd: HWND,
        backend: WindowsNativeBackend,
        renderer: WindowsSurfaceRenderer,
        frame: u64,
        input_passthrough: bool,
        opaque: bool,
        cursor_hidden_requested: bool,
        cursor_suppressed: bool,
        cursor_display_count: Option<i32>,
        transparent_cursor: HCURSOR,
        continuous_present_requested: bool,
        target_frame_rate: Option<f64>,
        full_screen: bool,
        windowed_style: Option<u32>,
        windowed_placement: Option<WINDOWPLACEMENT>,
        presentation_ready: bool,
        requested_visible: bool,
        visible: bool,
        source_frame: Option<FrameUpload>,
        source_frame_dirty: bool,
        last_present_at: Option<Instant>,
        present_after_modal_loop: bool,
        modal_size_move_active: bool,
        overlay_shortcut_down: bool,
        overlay_active: bool,
        steam_dialog_baseline: SteamDialogWindowList,
        adopted_steam_dialog: Option<AdoptedSteamDialog>,
        last_steam_dialog_scan_at: Option<Instant>,
        steam_dialog_adoption_count: u64,
        last_adopted_steam_dialog_hwnd: Option<HWND>,
        standalone_min_client_size: Option<(i32, i32)>,
        menu: Option<HMENU>,
        menu_draw_tokens: Vec<usize>,
        menu_minimum_dpi: Option<u32>,
    }

    struct FrameUpload {
        width: i32,
        height: i32,
        data: Vec<u8>,
    }

    #[derive(Clone, Copy)]
    struct SteamDialogWindowList {
        hwnds: [HWND; MAX_STEAM_DIALOG_WINDOWS],
        len: usize,
    }

    impl Default for SteamDialogWindowList {
        fn default() -> Self {
            Self {
                hwnds: [ptr::null_mut(); MAX_STEAM_DIALOG_WINDOWS],
                len: 0,
            }
        }
    }

    impl SteamDialogWindowList {
        fn contains(&self, hwnd: HWND) -> bool {
            self.hwnds[..self.len].contains(&hwnd)
        }
    }

    struct AdoptedSteamDialog {
        hwnd: HWND,
        process_id: u32,
        original_owner_hwnd: HWND,
        original_rect: RECT,
        last_host_client_rect: RECT,
    }

    #[allow(clippy::large_enum_variant)] // One process-global surface; boxing D3D state adds no useful density.
    enum WindowsSurfaceRenderer {
        OpenGl {
            hdc: HDC,
            hglrc: Hglrc,
        },
        D3d11 {
            renderer: WindowsD3d11Renderer,
            last_frame_upload: bool,
            frame_upload_failures: u64,
            device_lost: bool,
            device_lost_count: u64,
            device_recovery_count: u64,
        },
    }

    #[derive(Clone, Copy, PartialEq, Eq)]
    enum WindowsNativeBackend {
        OpenGl,
        D3d11,
    }

    impl WindowsNativeBackend {
        fn from_env() -> Self {
            match env::var("STEAM_BRIDGE_WINDOWS_NATIVE_HOST_BACKEND") {
                Ok(value) => match value.trim().to_ascii_lowercase().as_str() {
                    "opengl" | "gl" | "wgl" | "windows-opengl" => Self::OpenGl,
                    _ => Self::D3d11,
                },
                Err(_) => Self::D3d11,
            }
        }

        fn as_str(self) -> &'static str {
            match self {
                Self::OpenGl => "windows-opengl",
                Self::D3d11 => "windows-d3d11",
            }
        }
    }

    unsafe impl Send for NativeSurface {}

    static SURFACE: Lazy<Mutex<Option<NativeSurface>>> = Lazy::new(|| Mutex::new(None));
    static NEXT_SURFACE_INSTANCE_GENERATION: AtomicU64 = AtomicU64::new(0);
    static STANDALONE_MIN_CLIENT_SIZE: AtomicU64 = AtomicU64::new(0);
    static STANDALONE_LOGICAL_CLIENT_SIZE: AtomicU64 = AtomicU64::new(0);
    static STANDALONE_WINDOW_DPI: AtomicU32 = AtomicU32::new(96);
    static STANDALONE_DISPLAY_CLAMPED: AtomicBool = AtomicBool::new(false);
    static WINDOW_CLASS_RESULT: OnceLock<Result<(), String>> = OnceLock::new();
    static WINDOW_MESSAGE_DIAGNOSTICS: Lazy<Mutex<WindowMessageDiagnostics>> =
        Lazy::new(|| Mutex::new(WindowMessageDiagnostics::default()));
    static WINDOW_INPUT_EVENTS: Lazy<Mutex<Vec<WindowInputEvent>>> =
        Lazy::new(|| Mutex::new(Vec::new()));
    static MENU_DRAW_ITEMS: Lazy<Mutex<HashMap<usize, Box<NativeMenuOwnerDrawData>>>> =
        Lazy::new(|| Mutex::new(HashMap::new()));

    #[derive(Clone, Default, Serialize)]
    struct WindowMessageCounters {
        total: u64,
        key_down: u64,
        key_up: u64,
        sys_key_down: u64,
        sys_key_up: u64,
        mouse_move: u64,
        left_button_down: u64,
        left_button_up: u64,
        close: u64,
        set_focus: u64,
        kill_focus: u64,
        activate: u64,
        activate_app: u64,
        mouse_activate: u64,
        command: u64,
        nc_hit_test: u64,
        nc_left_button_down: u64,
        nc_left_button_up: u64,
        system_command: u64,
        enter_size_move: u64,
        exit_size_move: u64,
        capture_changed: u64,
    }

    #[derive(Clone, Serialize)]
    struct WindowMessageEvent {
        at_ms: u64,
        hwnd: String,
        message: u32,
        name: &'static str,
        wparam: u64,
        lparam: i64,
    }

    #[derive(Clone, Default, Serialize)]
    struct WindowMessageDiagnostics {
        counters: WindowMessageCounters,
        recent: Vec<WindowMessageEvent>,
    }

    #[derive(Clone, Serialize)]
    #[serde(rename_all = "camelCase")]
    struct WindowInputEvent {
        kind: &'static str,
        captured_at_ms: u64,
        message: u32,
        wparam: u64,
        lparam: i64,
        shift: bool,
        control: bool,
        alt: bool,
        caps_lock: bool,
        num_lock: bool,
        x: Option<i32>,
        y: Option<i32>,
        delta_y: Option<i32>,
        command_id: Option<u32>,
        client_width: i32,
        client_height: i32,
        minimized: bool,
    }

    #[derive(Deserialize)]
    #[serde(rename_all = "camelCase")]
    struct NativeMenuItem {
        #[serde(default)]
        label: String,
        command_id: Option<u32>,
        #[serde(default = "menu_item_enabled")]
        enabled: bool,
        #[serde(default)]
        separator: bool,
        #[serde(default)]
        items: Vec<NativeMenuItem>,
    }

    #[derive(Deserialize)]
    #[serde(rename_all = "camelCase")]
    struct NativeMenuOptions {
        items: Vec<NativeMenuItem>,
        minimum_scale: f64,
    }

    #[derive(Deserialize)]
    #[serde(untagged)]
    enum NativeMenuDefinition {
        Items(Vec<NativeMenuItem>),
        Options(NativeMenuOptions),
    }

    #[derive(Clone)]
    struct NativeMenuDrawItem {
        label: Vec<u16>,
        measure_label: Vec<u16>,
        top_level: bool,
        submenu: bool,
        separator: bool,
        minimum_dpi: u32,
    }

    #[repr(C)]
    struct NativeMenuOwnerDrawData {
        // Microsoft Active Accessibility requires this to be the first member of an
        // owner-drawn menu item's application data.
        msaa: MSAAMENUINFO,
        draw: NativeMenuDrawItem,
        _accessible_text: Box<[u16]>,
    }

    // The registry owns this allocation for exactly as long as the HMENU can refer to it.
    // Its embedded MSAA pointer targets its own stable boxed UTF-16 allocation.
    unsafe impl Send for NativeMenuOwnerDrawData {}

    struct ThreadDpiAwarenessGuard {
        previous: DPI_AWARENESS_CONTEXT,
    }

    impl ThreadDpiAwarenessGuard {
        unsafe fn per_monitor_v2() -> Self {
            Self {
                previous: SetThreadDpiAwarenessContext(DPI_AWARENESS_CONTEXT_PER_MONITOR_AWARE_V2),
            }
        }
    }

    impl Drop for ThreadDpiAwarenessGuard {
        fn drop(&mut self) {
            if !self.previous.is_null() {
                unsafe {
                    SetThreadDpiAwarenessContext(self.previous);
                }
            }
        }
    }

    fn menu_item_enabled() -> bool {
        true
    }

    pub fn open(
        title: Option<String>,
        client_width: Option<u32>,
        client_height: Option<u32>,
        min_client_width: Option<u32>,
        min_client_height: Option<u32>,
    ) -> Result<(), Error> {
        close();
        let title = title.unwrap_or_else(|| "Steam Bridge Native Overlay Probe".to_owned());
        let mut client_size = client_width.zip(client_height).map(|(width, height)| {
            (
                width.max(1).min(i32::MAX as u32) as i32,
                height.max(1).min(i32::MAX as u32) as i32,
            )
        });
        let min_client_size = min_client_width
            .zip(min_client_height)
            .map(|(width, height)| {
                (
                    width.max(1).min(i32::MAX as u32) as i32,
                    height.max(1).min(i32::MAX as u32) as i32,
                )
            });
        client_size = clamp_client_size_to_minimum(client_size, min_client_size);
        set_standalone_min_client_size(min_client_size);
        set_standalone_logical_client_size(client_size);
        STANDALONE_DISPLAY_CLAMPED.store(false, Ordering::Relaxed);
        let surface = match unsafe { create_surface(&title, client_size, min_client_size) } {
            Ok(surface) => surface,
            Err(error) => {
                set_standalone_min_client_size(None);
                set_standalone_logical_client_size(None);
                STANDALONE_DISPLAY_CLAMPED.store(false, Ordering::Relaxed);
                return Err(error);
            }
        };
        *SURFACE
            .lock()
            .expect("Steam overlay native surface lock poisoned") = Some(surface);
        pump()?;
        Ok(())
    }

    pub fn attach_to_parent(
        parent_handle: usize,
        _initial_bounds: Option<(i32, i32, u32, u32)>,
    ) -> Result<(), Error> {
        if parent_handle == 0 {
            return Err(Error::from_reason(
                "Electron native window handle was empty",
            ));
        }

        Err(Error::from_reason(
            "Windows attached overlay hosts are unsupported: Steam did not render into the tested WS_CHILD swapchain, and popup hosts do not safely follow Electron window lifecycle. Use startNativeOverlaySession() with an offscreen Electron renderer.",
        ))
    }

    pub fn attach_to_parent_for_overlay(parent_handle: usize) -> Result<(), Error> {
        attach_to_parent(parent_handle, None)
    }

    pub fn show() -> Result<(), Error> {
        with_surface(|surface| unsafe {
            surface.requested_visible = true;
            sync_window_style(surface);
            sync_surface_visibility(surface);
            if surface.visible && !surface.input_passthrough {
                activate_window(surface);
            }
        })
    }

    pub fn hide() -> Result<(), Error> {
        with_surface(|surface| unsafe {
            surface.requested_visible = false;
            hide_window_without_activation(surface.hwnd);
            surface.visible = false;
            surface.presentation_ready = false;
        })
    }

    pub fn set_bounds(_x: i32, _y: i32, _width: u32, _height: u32) -> Result<(), Error> {
        Err(Error::from_reason(
            "Windows standalone overlay hosts own their native position and size. Use the host window's ordinary move and resize controls.",
        ))
    }

    pub fn set_input_passthrough(pass_through: bool) -> Result<(), Error> {
        with_surface(|surface| unsafe {
            if surface.input_passthrough == pass_through {
                return;
            }
            surface.input_passthrough = pass_through;
            sync_window_style(surface);
            sync_surface_visibility(surface);
            if surface.visible && !pass_through {
                activate_window(surface);
            }
        })
    }

    pub fn set_opaque(opaque: bool) -> Result<(), Error> {
        with_surface(|surface| unsafe {
            if surface.opaque == opaque {
                return;
            }
            surface.opaque = opaque;
            if opaque {
                surface.presentation_ready = false;
                surface.source_frame = None;
                if let WindowsSurfaceRenderer::D3d11 {
                    last_frame_upload, ..
                } = &mut surface.renderer
                {
                    *last_frame_upload = false;
                }
            }
            sync_window_style(surface);
            sync_surface_visibility(surface);
        })
    }

    pub fn set_cursor_hidden(hidden: bool) -> Result<(), Error> {
        with_surface(|surface| unsafe {
            surface.cursor_hidden_requested = hidden;
            sync_cursor_visibility(surface);
        })
    }

    pub fn set_overlay_active(active: bool) -> Result<(), Error> {
        with_surface(|surface| unsafe {
            if surface.overlay_active == active {
                return;
            }
            surface.overlay_active = active;
            surface.last_steam_dialog_scan_at = None;
            if active {
                surface.steam_dialog_baseline = enumerate_steam_dialog_windows();
            } else {
                restore_adopted_steam_dialog(surface);
                surface.steam_dialog_baseline = SteamDialogWindowList::default();
            }
        })
    }

    pub fn set_continuous_present(continuous: bool, frame_rate: Option<f64>) -> Result<(), Error> {
        with_surface(|surface| unsafe {
            let target_frame_rate = frame_rate.filter(|value| value.is_finite() && *value > 0.0);
            surface.target_frame_rate = target_frame_rate;
            let display_refresh_rate =
                window_display_diagnostics(surface.hwnd).and_then(|display| display.refresh_rate);
            if let WindowsSurfaceRenderer::D3d11 { renderer, .. } = &mut surface.renderer {
                renderer.set_present_sync_interval(
                    windows_d3d11::present_sync_interval_for_frame_rate(
                        display_refresh_rate,
                        target_frame_rate,
                    ),
                );
            }
            if surface.continuous_present_requested != continuous {
                surface.continuous_present_requested = continuous;
                // Steam composites its UI into the presented backbuffer. When
                // continuous presentation starts or stops, upload the clean
                // Electron frame so Steam pixels cannot become retained input.
                surface.source_frame_dirty = true;
            }
        })
    }

    pub fn set_full_screen(full_screen: bool) -> Result<(), Error> {
        let mut guard = SURFACE
            .lock()
            .expect("Steam overlay native surface lock poisoned");
        let Some(surface) = guard.as_mut() else {
            return Ok(());
        };
        if surface.full_screen == full_screen {
            return Ok(());
        }

        unsafe {
            if full_screen {
                let mut placement: WINDOWPLACEMENT = mem::zeroed();
                placement.length = mem::size_of::<WINDOWPLACEMENT>() as u32;
                let monitor = MonitorFromWindow(surface.hwnd, MONITOR_DEFAULTTONEAREST);
                let mut monitor_info: MONITORINFO = mem::zeroed();
                monitor_info.cbSize = mem::size_of::<MONITORINFO>() as u32;
                if GetWindowPlacement(surface.hwnd, &mut placement) == 0
                    || monitor.is_null()
                    || GetMonitorInfoW(monitor, &mut monitor_info) == 0
                {
                    return Err(Error::from_reason(
                        "Failed to inspect the native overlay host before fullscreen",
                    ));
                }

                let style = GetWindowLongPtrW(surface.hwnd, GWL_STYLE) as u32;
                surface.windowed_style = Some(style);
                surface.windowed_placement = Some(placement);
                if !set_window_menu_attached(surface, false) {
                    surface.windowed_style = None;
                    surface.windowed_placement = None;
                    return Err(Error::from_reason(
                        "Failed to hide the native overlay host menu for fullscreen",
                    ));
                }
                SetWindowLongPtrW(
                    surface.hwnd,
                    GWL_STYLE,
                    (style & !WS_OVERLAPPEDWINDOW) as isize,
                );
                let rect = monitor_info.rcMonitor;
                if SetWindowPos(
                    surface.hwnd,
                    ptr::null_mut(),
                    rect.left,
                    rect.top,
                    (rect.right - rect.left).max(1),
                    (rect.bottom - rect.top).max(1),
                    SWP_NOOWNERZORDER | SWP_NOZORDER | SWP_FRAMECHANGED,
                ) == 0
                {
                    SetWindowLongPtrW(surface.hwnd, GWL_STYLE, style as isize);
                    SetWindowPos(
                        surface.hwnd,
                        ptr::null_mut(),
                        0,
                        0,
                        0,
                        0,
                        SWP_NOMOVE
                            | SWP_NOSIZE
                            | SWP_NOOWNERZORDER
                            | SWP_NOZORDER
                            | SWP_FRAMECHANGED,
                    );
                    surface.windowed_style = None;
                    surface.windowed_placement = None;
                    set_window_menu_attached(surface, true);
                    return Err(Error::from_reason(
                        "Failed to resize the native overlay host for fullscreen",
                    ));
                }
            } else {
                let style = surface
                    .windowed_style
                    .unwrap_or(WS_OVERLAPPEDWINDOW | WS_CLIPSIBLINGS | WS_CLIPCHILDREN);
                SetWindowLongPtrW(surface.hwnd, GWL_STYLE, style as isize);
                if !set_window_menu_attached(surface, true) {
                    return Err(Error::from_reason(
                        "Failed to restore the native overlay host menu from fullscreen",
                    ));
                }
                let placement_restored = if let Some(mut placement) = surface.windowed_placement {
                    placement.length = mem::size_of::<WINDOWPLACEMENT>() as u32;
                    SetWindowPlacement(surface.hwnd, &placement) != 0
                } else {
                    true
                };
                let frame_refreshed = SetWindowPos(
                    surface.hwnd,
                    ptr::null_mut(),
                    0,
                    0,
                    0,
                    0,
                    SWP_NOMOVE | SWP_NOSIZE | SWP_NOOWNERZORDER | SWP_NOZORDER | SWP_FRAMECHANGED,
                ) != 0;
                if !placement_restored || !frame_refreshed {
                    return Err(Error::from_reason(
                        "Failed to restore the native overlay host from fullscreen",
                    ));
                }
                surface.windowed_style = None;
                surface.windowed_placement = None;
            }
        }

        surface.full_screen = full_screen;
        unsafe {
            set_window_corner_preference(surface.hwnd, full_screen);
        }
        surface.source_frame_dirty = true;
        if surface.visible {
            unsafe {
                render_surface(surface)?;
            }
        }
        Ok(())
    }

    pub fn set_presentation_marker(_marker: String) -> Result<(), Error> {
        Ok(())
    }

    pub fn set_menu_json(menu_json: String) -> Result<(), Error> {
        let definition: NativeMenuDefinition =
            serde_json::from_str(&menu_json).map_err(|error| {
                Error::from_reason(format!("Invalid native overlay host menu JSON: {error}"))
            })?;
        let (items, minimum_dpi) = match definition {
            NativeMenuDefinition::Items(items) => (items, None),
            NativeMenuDefinition::Options(options) => {
                let minimum_dpi = minimum_menu_dpi(options.minimum_scale)?;
                (options.items, Some(minimum_dpi))
            }
        };
        let mut guard = SURFACE
            .lock()
            .expect("Steam overlay native surface lock poisoned");
        let Some(surface) = guard.as_mut() else {
            return Ok(());
        };
        unsafe {
            let client = read_client_rect(surface.hwnd).ok_or_else(|| {
                Error::from_reason("Failed to inspect the native overlay host client size")
            })?;
            let window = read_window_rect(surface.hwnd).ok_or_else(|| {
                Error::from_reason("Failed to inspect the native overlay host window size")
            })?;
            let mut menu_draw_tokens = Vec::new();
            let menu = if items.is_empty() {
                None
            } else {
                match build_native_menu(&items, false, minimum_dpi, &mut menu_draw_tokens) {
                    Ok(menu) => Some(menu),
                    Err(error) => {
                        unregister_menu_draw_items(&menu_draw_tokens);
                        return Err(error);
                    }
                }
            };
            let menu_handle = menu.unwrap_or(ptr::null_mut());
            let attached_menu_handle = if surface.full_screen {
                ptr::null_mut()
            } else {
                menu_handle
            };
            if SetMenu(surface.hwnd, attached_menu_handle) == 0 {
                if let Some(menu) = menu {
                    DestroyMenu(menu);
                }
                unregister_menu_draw_items(&menu_draw_tokens);
                return Err(Error::from_reason(
                    "Failed to attach the native overlay host menu",
                ));
            }
            DrawMenuBar(surface.hwnd);
            let previous_draw_tokens =
                mem::replace(&mut surface.menu_draw_tokens, menu_draw_tokens);
            surface.menu_minimum_dpi = minimum_dpi;
            if let Some(previous) = surface.menu.replace(menu_handle) {
                if !previous.is_null() {
                    DestroyMenu(previous);
                }
            }
            unregister_menu_draw_items(&previous_draw_tokens);
            if menu.is_none() {
                surface.menu = None;
            }
            if !surface.full_screen {
                resize_window_for_client_size(
                    surface.hwnd,
                    window.left,
                    window.top,
                    (client.right - client.left).max(1),
                    (client.bottom - client.top).max(1),
                )?;
            }
        }
        Ok(())
    }

    pub fn pump() -> Result<(), Error> {
        let hwnd = SURFACE
            .lock()
            .expect("Steam overlay native surface lock poisoned")
            .as_ref()
            .map(|surface| surface.hwnd);
        let Some(hwnd) = hwnd else {
            return Ok(());
        };

        unsafe {
            // Dispatching SC_SIZE/SC_MOVE enters a nested Windows modal loop.
            // Do not hold the surface lock across it: WM_SIZE/WM_PAINT must be
            // able to repaint the retained frame while the user is dragging.
            pump_messages(hwnd);
        }

        let mut guard = SURFACE
            .lock()
            .expect("Steam overlay native surface lock poisoned");
        let Some(surface) = guard.as_mut().filter(|surface| surface.hwnd == hwnd) else {
            return Ok(());
        };

        let result = unsafe {
            sync_steam_dialog(surface);
            sync_cursor_visibility(surface);
            poll_overlay_shortcut(surface);
            let present_after_modal_loop = mem::take(&mut surface.present_after_modal_loop);
            if surface.visible && (present_after_modal_loop || surface_needs_render(surface)) {
                render_surface(surface)
            } else {
                Ok(())
            }
        };

        if let Err(error) = result {
            let failed_surface = guard.take();
            drop(guard);
            if let Some(surface) = failed_surface {
                unsafe {
                    destroy_surface(surface);
                }
            }
            return Err(error);
        }

        Ok(())
    }

    pub fn frame_pending() -> bool {
        SURFACE
            .lock()
            .expect("Steam overlay native surface lock poisoned")
            .as_ref()
            .is_some_and(|surface| {
                // Presentation readiness stays false until the first real
                // source frame has been shown. It does not itself mean a frame
                // exists to present. Restrict the async DXGI path to a D3D
                // renderer that actually retains a source; otherwise an
                // unavailable wait handle could resolve false in a microtask
                // loop during startup or under the diagnostic OpenGL backend.
                surface.source_frame_dirty
                    && matches!(
                        &surface.renderer,
                        WindowsSurfaceRenderer::D3d11 { renderer, .. }
                            if renderer.has_source() || surface.source_frame.is_some()
                    )
            })
    }

    pub fn frame_latency_wait_bypassed() -> bool {
        SURFACE
            .lock()
            .expect("Steam overlay native surface lock poisoned")
            .as_ref()
            .is_some_and(|surface| {
                matches!(
                    &surface.renderer,
                    WindowsSurfaceRenderer::D3d11 { renderer, .. }
                        if renderer.frame_latency_wait_bypassed()
                )
            })
    }

    pub fn begin_frame_latency_wait() -> Result<Option<FrameLatencyWaitRequest>, Error> {
        let guard = SURFACE
            .lock()
            .expect("Steam overlay native surface lock poisoned");
        let Some(surface) = guard.as_ref() else {
            return Ok(None);
        };
        let WindowsSurfaceRenderer::D3d11 { renderer, .. } = &surface.renderer else {
            return Ok(None);
        };
        let Some(handle) = renderer
            .duplicate_frame_latency_wait_handle()
            .map_err(Error::from_reason)?
        else {
            return Ok(None);
        };
        Ok(Some(FrameLatencyWaitRequest {
            surface_generation: surface.instance_generation,
            handle,
        }))
    }

    pub fn grant_frame_latency_ready(token: FrameLatencyReadyToken) -> bool {
        let mut guard = SURFACE
            .lock()
            .expect("Steam overlay native surface lock poisoned");
        let Some(surface) = guard
            .as_mut()
            .filter(|surface| surface.instance_generation == token.surface_generation)
        else {
            return false;
        };
        let WindowsSurfaceRenderer::D3d11 { renderer, .. } = &mut surface.renderer else {
            return false;
        };
        renderer.grant_frame_latency_ready_permit(token.renderer_generation)
    }

    pub fn bypass_frame_latency_wait(token: FrameLatencyReadyToken) -> bool {
        let mut guard = SURFACE
            .lock()
            .expect("Steam overlay native surface lock poisoned");
        let Some(surface) = guard
            .as_mut()
            .filter(|surface| surface.instance_generation == token.surface_generation)
        else {
            return false;
        };
        let WindowsSurfaceRenderer::D3d11 { renderer, .. } = &mut surface.renderer else {
            return false;
        };
        renderer.bypass_frame_latency_wait(token.renderer_generation)
    }

    pub fn update_frame(buffer: Buffer, width: u32, height: u32) -> Result<(), Error> {
        let expected_len = checked_native_overlay_frame_byte_len(width, height, "Windows")?;
        let width = width as i32;
        let height = height as i32;
        if buffer.len() < expected_len {
            return Err(Error::from_reason(format!(
                "Windows native overlay frame needs {expected_len} BGRA bytes, received {}",
                buffer.len()
            )));
        }

        with_surface(|surface| {
            surface.source_frame = Some(FrameUpload {
                width,
                height,
                data: buffer[..expected_len].to_vec(),
            });
            surface.source_frame_dirty = true;
        })
    }

    pub fn update_shared_texture(
        handle_buffer: Buffer,
        width: u32,
        height: u32,
        content_x: Option<u32>,
        content_y: Option<u32>,
        content_width: Option<u32>,
        content_height: Option<u32>,
        presentation_x: Option<u32>,
        presentation_y: Option<u32>,
        presentation_width: Option<u32>,
        presentation_height: Option<u32>,
    ) -> Result<(), Error> {
        begin_shared_texture_update_internal(
            handle_buffer,
            width,
            height,
            content_x,
            content_y,
            content_width,
            content_height,
            presentation_x,
            presentation_y,
            presentation_width,
            presentation_height,
            false,
        )?
        .wait()
        .map(|_| ())
        .map_err(Error::from_reason)
    }

    pub fn begin_shared_texture_update(
        handle_buffer: Buffer,
        width: u32,
        height: u32,
        content_x: Option<u32>,
        content_y: Option<u32>,
        content_width: Option<u32>,
        content_height: Option<u32>,
        presentation_x: Option<u32>,
        presentation_y: Option<u32>,
        presentation_width: Option<u32>,
        presentation_height: Option<u32>,
    ) -> Result<SharedTextureUpdateRequest, Error> {
        begin_shared_texture_update_internal(
            handle_buffer,
            width,
            height,
            content_x,
            content_y,
            content_width,
            content_height,
            presentation_x,
            presentation_y,
            presentation_width,
            presentation_height,
            true,
        )
    }

    #[allow(clippy::too_many_arguments)]
    fn begin_shared_texture_update_internal(
        handle_buffer: Buffer,
        width: u32,
        height: u32,
        content_x: Option<u32>,
        content_y: Option<u32>,
        content_width: Option<u32>,
        content_height: Option<u32>,
        presentation_x: Option<u32>,
        presentation_y: Option<u32>,
        presentation_width: Option<u32>,
        presentation_height: Option<u32>,
        asynchronous_completion: bool,
    ) -> Result<SharedTextureUpdateRequest, Error> {
        let handle_size = mem::size_of::<usize>();
        if handle_buffer.len() < handle_size {
            return Err(Error::from_reason(format!(
                "Windows shared texture handle needs {handle_size} bytes, received {}",
                handle_buffer.len()
            )));
        }
        let mut handle_bytes = [0_u8; mem::size_of::<usize>()];
        handle_bytes.copy_from_slice(&handle_buffer[..handle_size]);
        let handle = usize::from_ne_bytes(handle_bytes);
        let width = width.max(1);
        let height = height.max(1);
        let content_rect = (
            content_x.unwrap_or(0),
            content_y.unwrap_or(0),
            content_width.unwrap_or(width),
            content_height.unwrap_or(height),
        );
        let presentation_rect = (
            presentation_x.unwrap_or(0),
            presentation_y.unwrap_or(0),
            presentation_width.unwrap_or(width),
            presentation_height.unwrap_or(height),
        );
        let content_right = content_rect.0.checked_add(content_rect.2).ok_or_else(|| {
            Error::from_reason("Windows shared texture content rectangle overflows")
        })?;
        let content_bottom = content_rect.1.checked_add(content_rect.3).ok_or_else(|| {
            Error::from_reason("Windows shared texture content rectangle overflows")
        })?;
        if content_rect.2 == 0
            || content_rect.3 == 0
            || content_right > width
            || content_bottom > height
        {
            return Err(Error::from_reason(format!(
                "Windows shared texture content rectangle {},{} {}x{} exceeds {}x{}",
                content_rect.0, content_rect.1, content_rect.2, content_rect.3, width, height
            )));
        }
        let presentation_right = presentation_rect
            .0
            .checked_add(presentation_rect.2)
            .ok_or_else(|| {
                Error::from_reason("Windows shared texture presentation rectangle overflows")
            })?;
        let presentation_bottom = presentation_rect
            .1
            .checked_add(presentation_rect.3)
            .ok_or_else(|| {
                Error::from_reason("Windows shared texture presentation rectangle overflows")
            })?;
        if presentation_rect.2 == 0
            || presentation_rect.3 == 0
            || presentation_right > width
            || presentation_bottom > height
        {
            return Err(Error::from_reason(format!(
                "Windows shared texture presentation rectangle {},{} {}x{} exceeds {}x{}",
                presentation_rect.0,
                presentation_rect.1,
                presentation_rect.2,
                presentation_rect.3,
                width,
                height
            )));
        }

        let mut guard = SURFACE
            .lock()
            .expect("Steam overlay native surface lock poisoned");
        let surface = guard
            .as_mut()
            .ok_or_else(|| Error::from_reason("Native overlay host is not open"))?;
        let hwnd = surface.hwnd;
        let mut accepted = true;
        let mut copy_wait = None;
        match &mut surface.renderer {
            WindowsSurfaceRenderer::D3d11 {
                renderer,
                last_frame_upload,
                device_lost,
                device_lost_count,
                device_recovery_count,
                ..
            } => unsafe {
                let recovering_device = *device_lost;
                let import_result = if recovering_device {
                    Ok(SharedTextureImportSubmission::Dropped)
                } else if asynchronous_completion {
                    renderer.begin_import_shared_texture(
                        handle,
                        width,
                        height,
                        content_rect,
                        presentation_rect,
                    )
                } else {
                    renderer
                        .import_shared_texture(
                            handle,
                            width,
                            height,
                            content_rect,
                            presentation_rect,
                        )
                        .map(|_| SharedTextureImportSubmission::Accepted(None))
                };
                let import_detected_device_loss = import_result
                    .as_ref()
                    .err()
                    .map(String::as_str)
                    .is_some_and(windows_d3d11::is_device_lost_error);
                let import_requires_adapter_switch = import_result
                    .as_ref()
                    .err()
                    .map(String::as_str)
                    .is_some_and(windows_d3d11::is_shared_texture_adapter_open_error);
                if import_detected_device_loss {
                    *device_lost = true;
                    *device_lost_count = (*device_lost_count).saturating_add(1);
                    *last_frame_upload = false;
                }
                if recovering_device
                    || import_detected_device_loss
                    || import_requires_adapter_switch
                {
                    renderer
                        .switch_to_shared_texture_adapter(
                            hwnd.cast(),
                            handle,
                            width,
                            height,
                            content_rect,
                            presentation_rect,
                        )
                        .map_err(Error::from_reason)?;
                } else {
                    match import_result {
                        Ok(SharedTextureImportSubmission::Accepted(wait)) => copy_wait = wait,
                        Ok(SharedTextureImportSubmission::Dropped) => accepted = false,
                        Err(error) => {
                            // The current device opened the handle, so validation
                            // or copy-completion failures are not evidence of an
                            // adapter mismatch. Preserve the existing device and
                            // let the producer submit a fresh texture.
                            return Err(Error::from_reason(error));
                        }
                    }
                }
                if recovering_device || import_detected_device_loss {
                    *device_lost = false;
                    *device_recovery_count = (*device_recovery_count).saturating_add(1);
                }
                if accepted {
                    *last_frame_upload = true;
                }
            },
            WindowsSurfaceRenderer::OpenGl { .. } => {
                return Err(Error::from_reason(
                    "Electron shared textures require the Windows D3D11 native host backend",
                ));
            }
        }
        if accepted {
            surface.source_frame = None;
            // Importing updates the retained D3D source, but a non-continuous
            // session still needs its next pump to present that new source.
            surface.source_frame_dirty = true;
        }
        Ok(SharedTextureUpdateRequest {
            accepted,
            copy_wait,
        })
    }

    pub fn close() {
        let surface = SURFACE
            .lock()
            .expect("Steam overlay native surface lock poisoned")
            .take();
        if let Some(surface) = surface {
            unsafe {
                destroy_surface(surface);
            }
        }
    }

    pub fn close_probe() {
        close();
    }

    pub fn detach_host() {}

    pub fn is_probe_open() -> bool {
        SURFACE
            .lock()
            .expect("Steam overlay native surface lock poisoned")
            .is_some()
    }

    pub fn is_embedded() -> bool {
        false
    }

    pub fn mac_window_snapshot_json(_app_id: u32) -> Option<String> {
        None
    }

    pub fn mac_screen_locked() -> bool {
        false
    }

    pub fn mac_display_asleep() -> bool {
        false
    }

    pub fn host_diagnostics_json() -> Option<String> {
        let guard = SURFACE
            .lock()
            .expect("Steam overlay native surface lock poisoned");
        let surface = guard.as_ref()?;
        let message_diagnostics = WINDOW_MESSAGE_DIAGNOSTICS
            .lock()
            .expect("Steam overlay window message diagnostics lock poisoned")
            .clone();

        unsafe {
            let foreground = GetForegroundWindow();
            let foreground_thread = if foreground.is_null() {
                0
            } else {
                GetWindowThreadProcessId(foreground, ptr::null_mut())
            };
            let foreground_keyboard_layout = if foreground_thread == 0 {
                None
            } else {
                let layout = GetKeyboardLayout(foreground_thread);
                (!layout.is_null()).then_some(format!("0x{:016X}", layout as usize))
            };
            let keyboard_layout = format!("0x{:016X}", GetKeyboardLayout(0) as usize);
            let rect = read_window_rect(surface.hwnd).map(window_rect_json);
            let client_rect = read_client_rect_in_screen(surface.hwnd);
            let capture = GetCapture();
            let primary_button = if GetSystemMetrics(SM_SWAPBUTTON) != 0 {
                VK_RBUTTON
            } else {
                VK_LBUTTON
            };
            let primary_button_down =
                GetAsyncKeyState(i32::from(primary_button)) as u16 & 0x8000 != 0;
            let mut cursor = POINT { x: 0, y: 0 };
            let pointer = if GetCursorPos(&mut cursor) != 0 {
                let hit_test = read_window_rect(surface.hwnd)
                    .filter(|window| {
                        cursor.x >= window.left
                            && cursor.y >= window.top
                            && cursor.x < window.right
                            && cursor.y < window.bottom
                    })
                    .map(|_| {
                        let packed = (u32::from(cursor.x as i16 as u16)
                            | (u32::from(cursor.y as i16 as u16) << 16))
                            as LPARAM;
                        DefWindowProcW(surface.hwnd, WM_NCHITTEST, 0, packed) as i64
                    });
                json!({
                    "captureHwnd": (!capture.is_null()).then(|| hwnd_hex(capture)),
                    "primaryButtonDown": primary_button_down,
                    "cursorScreen": { "x": cursor.x, "y": cursor.y },
                    "hitTest": hit_test,
                })
            } else {
                json!({
                    "captureHwnd": (!capture.is_null()).then(|| hwnd_hex(capture)),
                    "primaryButtonDown": primary_button_down,
                    "cursorScreen": null,
                    "hitTest": null,
                })
            };
            let window_dpi = GetDpiForWindow(surface.hwnd).max(96);
            let window_per_monitor_v2 = AreDpiAwarenessContextsEqual(
                GetWindowDpiAwarenessContext(surface.hwnd),
                DPI_AWARENESS_CONTEXT_PER_MONITOR_AWARE_V2,
            ) != 0;
            let effective_menu_dpi = surface
                .menu_minimum_dpi
                .map(|minimum_dpi| minimum_dpi.max(window_dpi));
            let mut menu_bar_info: MENUBARINFO = mem::zeroed();
            menu_bar_info.cbSize = mem::size_of::<MENUBARINFO>() as u32;
            let menu_bar_rect =
                if GetMenuBarInfo(surface.hwnd, OBJID_MENU, 0, &mut menu_bar_info) != 0 {
                    Some(window_rect_json(menu_bar_info.rcBar))
                } else {
                    None
                };
            let logical_client_size = client_rect.map(|rect| {
                json!({
                    "width": physical_pixels_to_logical((rect.right - rect.left).max(1), window_dpi),
                    "height": physical_pixels_to_logical((rect.bottom - rect.top).max(1), window_dpi),
                })
            });
            let style = GetWindowLongPtrW(surface.hwnd, GWL_STYLE) as u32;
            let ex_style = GetWindowLongPtrW(surface.hwnd, GWL_EXSTYLE) as u32;
            let renderer = renderer_diagnostics_json(&surface.renderer);
            let display = window_display_diagnostics(surface.hwnd);
            let adopted_steam_dialog = surface.adopted_steam_dialog.as_ref().map(|dialog| {
                json!({
                    "hwnd": hwnd_hex(dialog.hwnd),
                    "processId": dialog.process_id,
                    "ownerHwnd": hwnd_hex(GetWindow(dialog.hwnd, GW_OWNER)),
                    "originalOwnerHwnd": hwnd_hex(dialog.original_owner_hwnd),
                    "rect": read_window_rect(dialog.hwnd).map(window_rect_json),
                    "originalRect": window_rect_json(dialog.original_rect),
                    "lastHostClientRect": window_rect_json(dialog.last_host_client_rect),
                })
            });
            let mut diagnostics = json!({
                "platform": "win32",
                "backend": surface.backend.as_str(),
                "surfaceInstanceGeneration": surface.instance_generation,
                "hostStyle": "standalone",
                "renderer": renderer,
                "hwnd": hwnd_hex(surface.hwnd),
                "parentHwnd": null,
                "foregroundHwnd": hwnd_hex(foreground),
                "isForeground": surface.hwnd == foreground,
                "style": format!("0x{style:08X}"),
                "exStyle": format!("0x{ex_style:08X}"),
                "inputPassthrough": surface.input_passthrough,
                "opaque": surface.opaque,
                "cursorHiddenRequested": surface.cursor_hidden_requested,
                "cursorSuppressed": surface.cursor_suppressed,
                "cursorDisplayCount": surface.cursor_display_count,
                "continuousPresentRequested": surface.continuous_present_requested,
                "fullScreen": surface.full_screen,
                "presentationReady": surface.presentation_ready,
                "requestedVisible": surface.requested_visible,
                "visible": surface.visible,
                "minimized": IsIconic(surface.hwnd) != 0,
                "parentAllowsSurface": surface.requested_visible
                    && !(surface.input_passthrough && !surface.opaque),
                "sourceFrame": surface.source_frame.as_ref().map(|frame| json!({
                    "width": frame.width,
                    "height": frame.height,
                    "bytes": frame.data.len(),
                })),
                "sourceFrameDirty": surface.source_frame_dirty,
                "frame": surface.frame,
                "rect": rect,
                "clientRect": client_rect.map(window_rect_json),
                "windowDpi": window_dpi,
                "logicalClientSize": logical_client_size,
                "minimumClientSize": surface.standalone_min_client_size.map(|(width, height)| json!({
                    "width": width,
                    "height": height,
                })),
                "menuConfigured": surface.menu.is_some(),
                "menuAttached": !GetMenu(surface.hwnd).is_null(),
                "parentRect": null,
                "parentClientRect": null,
                "steamDialog": {
                    "overlayActive": surface.overlay_active,
                    "baselineCount": surface.steam_dialog_baseline.len,
                    "adoptionCount": surface.steam_dialog_adoption_count,
                    "lastAdoptedHwnd": surface.last_adopted_steam_dialog_hwnd.map(hwnd_hex),
                    "adopted": adopted_steam_dialog,
                },
                "messages": message_diagnostics,
            });
            if let Some(object) = diagnostics.as_object_mut() {
                object.insert(
                    "displayWorkAreaClamped".to_owned(),
                    json!(STANDALONE_DISPLAY_CLAMPED.load(Ordering::Relaxed)),
                );
                object.insert(
                    "targetFrameRate".to_owned(),
                    json!(surface.target_frame_rate),
                );
                object.insert("keyboardLayout".to_owned(), json!(keyboard_layout));
                object.insert(
                    "foregroundKeyboardLayout".to_owned(),
                    json!(foreground_keyboard_layout),
                );
                object.insert(
                    "displayDeviceName".to_owned(),
                    json!(display.as_ref().map(|value| &value.device_name)),
                );
                object.insert(
                    "displayRefreshRate".to_owned(),
                    json!(display.as_ref().and_then(|value| value.refresh_rate)),
                );
                object.insert("pointer".to_string(), pointer);
                object.insert(
                    "dpiAwareness".to_owned(),
                    json!({
                        "systemDpi": GetDpiForSystem().max(96),
                        "windowPerMonitorV2": window_per_monitor_v2,
                    }),
                );
                object.insert(
                    "menuMetrics".to_owned(),
                    json!({
                        "ownerDrawn": !surface.menu_draw_tokens.is_empty(),
                        "minimumScale": surface.menu_minimum_dpi.map(|dpi| f64::from(dpi) / 96.0),
                        "effectiveDpi": effective_menu_dpi,
                        "metricHeight": effective_menu_dpi.map(|dpi| GetSystemMetricsForDpi(SM_CYMENU, dpi)),
                        "barRect": menu_bar_rect,
                    }),
                );
            }
            Some(diagnostics.to_string())
        }
    }

    pub fn drain_input_events_json() -> String {
        let events = mem::take(
            &mut *WINDOW_INPUT_EVENTS
                .lock()
                .expect("Steam overlay window input event lock poisoned"),
        );
        serde_json::to_string(&events).unwrap_or_else(|_| "[]".to_owned())
    }

    fn with_surface(run: impl FnOnce(&mut NativeSurface)) -> Result<(), Error> {
        let mut guard = SURFACE
            .lock()
            .expect("Steam overlay native surface lock poisoned");
        if let Some(surface) = guard.as_mut() {
            run(surface);
        }
        Ok(())
    }

    unsafe fn create_surface(
        title: &str,
        standalone_client_size: Option<(i32, i32)>,
        standalone_min_client_size: Option<(i32, i32)>,
    ) -> Result<NativeSurface, Error> {
        let _dpi_awareness = ThreadDpiAwarenessGuard::per_monitor_v2();
        inherit_foreground_keyboard_layout();
        ensure_window_class()?;
        reset_window_message_diagnostics();
        let title = wide_string(title);
        let class_name = window_class_name();
        let backend = WindowsNativeBackend::from_env();
        let input_passthrough = false;
        let ex_style = base_ex_style();
        let style = WS_OVERLAPPEDWINDOW | WS_CLIPSIBLINGS | WS_CLIPCHILDREN;
        let (x, y, width, height) =
            if let Some((client_width, client_height)) = standalone_client_size {
                let dpi = GetDpiForSystem().max(96);
                let mut adjusted = RECT {
                    left: 0,
                    top: 0,
                    right: logical_pixels_to_physical(client_width, dpi),
                    bottom: logical_pixels_to_physical(client_height, dpi),
                };
                if AdjustWindowRectExForDpi(&mut adjusted, style, 0, ex_style, dpi) == 0 {
                    return Err(Error::from_reason(
                        "Failed to size the Windows native overlay client area",
                    ));
                }
                let width = (adjusted.right - adjusted.left).max(1);
                let height = (adjusted.bottom - adjusted.top).max(1);
                centered_window_rect(width, height, &primary_work_area())
            } else {
                (100, 100, 960, 540)
            };
        let hwnd = CreateWindowExW(
            ex_style,
            class_name.as_ptr(),
            title.as_ptr(),
            style,
            x,
            y,
            width,
            height,
            ptr::null_mut(),
            ptr::null_mut(),
            GetModuleHandleW(ptr::null()),
            ptr::null_mut(),
        );
        if hwnd.is_null() {
            return Err(Error::from_reason(
                "Failed to create Windows native overlay host window",
            ));
        }
        STANDALONE_WINDOW_DPI.store(GetDpiForWindow(hwnd).max(96), Ordering::Relaxed);
        let transitions_disabled = 1i32;
        DwmSetWindowAttribute(
            hwnd,
            DWMWA_TRANSITIONS_FORCEDISABLED as u32,
            &transitions_disabled as *const i32 as *const std::ffi::c_void,
            mem::size_of::<i32>() as u32,
        );
        set_window_corner_preference(hwnd, false);

        let renderer = match create_renderer(hwnd, backend, width, height) {
            Ok(renderer) => renderer,
            Err(error) => {
                DestroyWindow(hwnd);
                return Err(error);
            }
        };

        let and_mask = [0xFF_u8; 128];
        let xor_mask = [0_u8; 128];
        let transparent_cursor = CreateCursor(
            GetModuleHandleW(ptr::null()),
            0,
            0,
            32,
            32,
            and_mask.as_ptr().cast(),
            xor_mask.as_ptr().cast(),
        );
        let mut surface = NativeSurface {
            instance_generation: NEXT_SURFACE_INSTANCE_GENERATION
                .fetch_add(1, Ordering::Relaxed)
                .wrapping_add(1),
            hwnd,
            backend,
            renderer,
            frame: 0,
            input_passthrough,
            opaque: true,
            cursor_hidden_requested: false,
            cursor_suppressed: false,
            cursor_display_count: None,
            transparent_cursor,
            continuous_present_requested: false,
            target_frame_rate: None,
            full_screen: false,
            windowed_style: None,
            windowed_placement: None,
            presentation_ready: false,
            requested_visible: true,
            visible: false,
            source_frame: None,
            source_frame_dirty: true,
            last_present_at: None,
            present_after_modal_loop: false,
            modal_size_move_active: false,
            overlay_shortcut_down: false,
            overlay_active: false,
            steam_dialog_baseline: SteamDialogWindowList::default(),
            adopted_steam_dialog: None,
            last_steam_dialog_scan_at: None,
            steam_dialog_adoption_count: 0,
            last_adopted_steam_dialog_hwnd: None,
            standalone_min_client_size,
            menu: None,
            menu_draw_tokens: Vec::new(),
            menu_minimum_dpi: None,
        };
        sync_window_style(&mut surface);
        sync_surface_visibility(&mut surface);
        if surface.visible && !surface.input_passthrough {
            activate_window(&surface);
        }
        Ok(surface)
    }

    unsafe fn render_surface(surface: &mut NativeSurface) -> Result<(), Error> {
        if IsIconic(surface.hwnd) != 0 {
            return Ok(());
        }
        let mut rect: RECT = mem::zeroed();
        if GetClientRect(surface.hwnd, &mut rect) == 0 {
            return Ok(());
        }
        let width = (rect.right - rect.left).max(1);
        let height = (rect.bottom - rect.top).max(1);
        let color = if surface.opaque {
            [0.0, 0.0, 0.0, 1.0]
        } else {
            [0.0, 0.0, 0.0, 0.0]
        };
        let source_frame = surface.source_frame.as_ref();
        let upload_source_frame =
            surface.source_frame_dirty || surface.continuous_present_requested;

        match &mut surface.renderer {
            WindowsSurfaceRenderer::OpenGl { hdc, hglrc } => {
                render_opengl(*hdc, *hglrc, width, height, color)?
            }
            WindowsSurfaceRenderer::D3d11 {
                renderer,
                last_frame_upload,
                frame_upload_failures,
                device_lost,
                device_lost_count,
                ..
            } => {
                if *device_lost {
                    surface.source_frame_dirty = true;
                    return Ok(());
                }
                if let Err(error) = renderer.resize(width as u32, height as u32) {
                    if windows_d3d11::is_device_lost_error(&error) {
                        *device_lost = true;
                        *device_lost_count = (*device_lost_count).saturating_add(1);
                        *last_frame_upload = false;
                        surface.source_frame_dirty = true;
                        return Ok(());
                    }
                    return Err(Error::from_reason(error));
                }
                if upload_source_frame {
                    if let Some(frame) = source_frame {
                        match renderer.upload_cpu_frame(
                            &frame.data,
                            frame.width as u32,
                            frame.height as u32,
                        ) {
                            Ok(()) => *last_frame_upload = true,
                            Err(error) => {
                                *last_frame_upload = false;
                                *frame_upload_failures = frame_upload_failures.saturating_add(1);
                                return Err(Error::from_reason(error));
                            }
                        }
                    }
                }
                match renderer.render(color) {
                    Ok(Some(_)) => {}
                    Ok(None) => {
                        // DXGI is still presenting the previous frame. Retain
                        // the newest source and let the JS scheduler retry
                        // without blocking Electron's main process.
                        surface.source_frame_dirty = true;
                        return Ok(());
                    }
                    Err(error) => {
                        if windows_d3d11::is_device_lost_error(&error) {
                            *device_lost = true;
                            *device_lost_count = (*device_lost_count).saturating_add(1);
                            *last_frame_upload = false;
                            surface.source_frame_dirty = true;
                            return Ok(());
                        }
                        return Err(Error::from_reason(error));
                    }
                }
            }
        }

        surface.frame = surface.frame.wrapping_add(1);
        surface.source_frame_dirty = matches!(
            &surface.renderer,
            WindowsSurfaceRenderer::D3d11 {
                last_frame_upload: false,
                ..
            }
        ) && surface.source_frame.is_some();
        surface.last_present_at = Some(Instant::now());
        let has_required_frame = matches!(&surface.renderer, WindowsSurfaceRenderer::OpenGl { .. })
            || matches!(
                &surface.renderer,
                WindowsSurfaceRenderer::D3d11 { renderer, .. } if renderer.has_source()
            );
        if !surface.presentation_ready && has_required_frame {
            surface.presentation_ready = true;
            apply_window_style(surface);
        }
        Ok(())
    }

    unsafe fn create_renderer(
        hwnd: HWND,
        backend: WindowsNativeBackend,
        width: i32,
        height: i32,
    ) -> Result<WindowsSurfaceRenderer, Error> {
        match backend {
            WindowsNativeBackend::OpenGl => create_opengl_renderer(hwnd),
            WindowsNativeBackend::D3d11 => create_d3d11_renderer(hwnd, width, height),
        }
    }

    unsafe fn create_opengl_renderer(hwnd: HWND) -> Result<WindowsSurfaceRenderer, Error> {
        let hdc = GetDC(hwnd);
        if hdc.is_null() {
            return Err(Error::from_reason(
                "Failed to acquire Windows native overlay device context",
            ));
        }

        let descriptor = pixel_format_descriptor();
        let pixel_format = ChoosePixelFormat(hdc, &descriptor);
        if pixel_format == 0 {
            ReleaseDC(hwnd, hdc);
            return Err(Error::from_reason(
                "Failed to choose Windows native overlay pixel format",
            ));
        }
        if SetPixelFormat(hdc, pixel_format, &descriptor) == 0 {
            ReleaseDC(hwnd, hdc);
            return Err(Error::from_reason(
                "Failed to set Windows native overlay pixel format",
            ));
        }

        let hglrc = wglCreateContext(hdc);
        if hglrc == 0 {
            ReleaseDC(hwnd, hdc);
            return Err(Error::from_reason(
                "Failed to create Windows native overlay OpenGL context",
            ));
        }
        if wglMakeCurrent(hdc, hglrc) == 0 {
            wglDeleteContext(hglrc);
            ReleaseDC(hwnd, hdc);
            return Err(Error::from_reason(
                "Failed to make Windows native overlay OpenGL context current",
            ));
        }

        Ok(WindowsSurfaceRenderer::OpenGl { hdc, hglrc })
    }

    unsafe fn create_d3d11_renderer(
        hwnd: HWND,
        width: i32,
        height: i32,
    ) -> Result<WindowsSurfaceRenderer, Error> {
        Ok(WindowsSurfaceRenderer::D3d11 {
            renderer: WindowsD3d11Renderer::new(
                hwnd.cast(),
                width.max(1) as u32,
                height.max(1) as u32,
            )
            .map_err(Error::from_reason)?,
            last_frame_upload: false,
            frame_upload_failures: 0,
            device_lost: false,
            device_lost_count: 0,
            device_recovery_count: 0,
        })
    }

    unsafe fn render_opengl(
        hdc: HDC,
        hglrc: Hglrc,
        width: i32,
        height: i32,
        color: [f32; 4],
    ) -> Result<(), Error> {
        if wglMakeCurrent(hdc, hglrc) == 0 {
            return Err(Error::from_reason(
                "Failed to make Windows native overlay OpenGL context current",
            ));
        }

        glViewport(0, 0, width, height);
        glClearColor(color[0], color[1], color[2], color[3]);
        glClear(GL_COLOR_BUFFER_BIT);
        SwapBuffers(hdc);
        Ok(())
    }

    unsafe fn release_renderer(renderer: WindowsSurfaceRenderer, hwnd: HWND) {
        match renderer {
            WindowsSurfaceRenderer::OpenGl { hdc, hglrc } => {
                wglMakeCurrent(ptr::null_mut(), 0);
                if hglrc != 0 {
                    wglDeleteContext(hglrc);
                }
                if !hdc.is_null() {
                    ReleaseDC(hwnd, hdc);
                }
            }
            WindowsSurfaceRenderer::D3d11 { .. } => {}
        }
    }

    unsafe fn renderer_diagnostics_json(renderer: &WindowsSurfaceRenderer) -> serde_json::Value {
        match renderer {
            WindowsSurfaceRenderer::OpenGl { .. } => json!({
                "backend": "windows-opengl",
            }),
            WindowsSurfaceRenderer::D3d11 {
                renderer,
                last_frame_upload,
                frame_upload_failures,
                device_lost,
                device_lost_count,
                device_recovery_count,
            } => json!({
                "backend": "windows-d3d11",
                "width": renderer.width(),
                "height": renderer.height(),
                "format": "bgra8-unorm",
                "presentationMode": "flip-sequential",
                "bufferCount": 2,
                "gdiCompatible": false,
                "frameLatencyWaitable": renderer.frame_latency_waitable(),
                "frameLatencyWaitBypassed": renderer.frame_latency_wait_bypassed(),
                "frameLatencyFallbackTimerResolutionRequested": renderer.fallback_timer_resolution_requested(),
                "frameLatencyFallbackTimerResolutionActive": renderer.fallback_timer_resolution_active(),
                "frameLatencyFallbackTimerResolutionMs": if renderer.fallback_timer_resolution_active() { Some(1) } else { None },
                "maximumFrameLatency": 2,
                "presentSyncInterval": renderer.present_sync_interval(),
                "frameLatencyWaitTimeoutCount": renderer.frame_latency_wait_timeout_count(),
                "timing": {
                    "asyncFrameLatencyReadyCount": renderer.async_frame_latency_ready_count(),
                    "frameLatencyNotReadyCount": renderer.frame_latency_not_ready_count(),
                    "lastRenderIntervalMs": renderer.last_render_interval_ms(),
                    "maxRenderIntervalMs": renderer.max_render_interval_ms(),
                    "renderIntervalOver25MsCount": renderer.render_interval_over_25_ms_count(),
                    "renderIntervalOver50MsCount": renderer.render_interval_over_50_ms_count(),
                    "renderIntervalOver100MsCount": renderer.render_interval_over_100_ms_count(),
                    "lastFrameLatencyWaitDurationMs": renderer.last_frame_latency_wait_duration_ms(),
                    "maxFrameLatencyWaitDurationMs": renderer.max_frame_latency_wait_duration_ms(),
                    "frameLatencyWaitOver25MsCount": renderer.frame_latency_wait_over_25_ms_count(),
                    "lastPresentDurationMs": renderer.last_present_duration_ms(),
                    "maxPresentDurationMs": renderer.max_present_duration_ms(),
                    "presentOver25MsCount": renderer.present_over_25_ms_count(),
                    "lastRenderDurationMs": renderer.last_render_duration_ms(),
                    "maxRenderDurationMs": renderer.max_render_duration_ms(),
                    "renderOver25MsCount": renderer.render_over_25_ms_count(),
                    "frameStatisticsAvailable": renderer.frame_statistics_available(),
                    "frameStatisticsPresentCount": renderer.frame_statistics_present_count(),
                    "frameStatisticsRefreshCount": renderer.frame_statistics_refresh_count(),
                    "lastFrameStatisticsPresentDelta": renderer.last_frame_statistics_present_delta(),
                    "lastFrameStatisticsRefreshDelta": renderer.last_frame_statistics_refresh_delta(),
                    "repeatedRefreshCount": renderer.repeated_refresh_count(),
                    "maxRepeatedRefreshesPerSample": renderer.max_repeated_refreshes_per_sample(),
                },
                "sharedTextureCopySlowCount": renderer.shared_texture_copy_slow_count(),
                "sharedTextureCopy": {
                    "completionMode": renderer.shared_texture_copy_completion_mode(),
                    "completedCount": renderer.shared_texture_copy_completed_count(),
                    "timeoutCount": renderer.shared_texture_copy_timeout_count(),
                    "fatalTimeoutCount": renderer.shared_texture_copy_fatal_timeout_count(),
                    "lastDispatchDelayMs": renderer.last_shared_texture_copy_dispatch_delay_ms(),
                    "maxDispatchDelayMs": renderer.max_shared_texture_copy_dispatch_delay_ms(),
                    "lastDurationMs": renderer.last_shared_texture_copy_duration_ms(),
                    "maxDurationMs": renderer.max_shared_texture_copy_duration_ms(),
                    "inFlight": crate::native_overlay_shared_texture_copy_job_count(),
                    "maxInFlight": crate::native_overlay_shared_texture_copy_job_max(),
                    "saturationDropCount": crate::native_overlay_shared_texture_copy_saturation_drop_count(),
                    "rendererInFlight": renderer.shared_texture_copies_in_flight(),
                    "rendererMaxInFlight": renderer.max_shared_texture_copies_in_flight(),
                    "rendererSaturationDropCount": renderer.shared_texture_copy_saturation_drop_count(),
                },
                "sharedTextureFullCopyCount": renderer.shared_texture_full_copy_count(),
                "sharedTexturePartialCopyCount": renderer.shared_texture_partial_copy_count(),
                "sharedTextureStorageRecreateCount": renderer.shared_texture_storage_recreate_count(),
                "lastSharedTextureContentRect": renderer.last_shared_texture_content_rect(),
                "lastSharedTexturePresentationRect": renderer.last_shared_texture_presentation_rect(),
                "featureLevel": format!("0x{:04X}", renderer.feature_level()),
                "adapter": renderer.adapter_name(),
                "lastPresent": format!("0x{:08X}", renderer.last_present() as u32),
                "lastFrameUpload": last_frame_upload,
                "frameUploadFailures": frame_upload_failures,
                "deviceLost": device_lost,
                "deviceLostCount": device_lost_count,
                "deviceRecoveryCount": device_recovery_count,
                "sourceMode": renderer.source_mode(),
                "sourceWidth": renderer.source_width(),
                "sourceHeight": renderer.source_height(),
                "sourceFormat": renderer.source_format(),
                "sourceSampleCount": renderer.source_sample_count(),
                "cpuUploadCount": renderer.cpu_upload_count(),
                "sharedTextureImportCount": renderer.shared_texture_import_count(),
            }),
        }
    }

    unsafe fn sync_steam_dialog(surface: &mut NativeSurface) {
        if !surface.overlay_active {
            restore_adopted_steam_dialog(surface);
            return;
        }

        if let Some(dialog) = surface.adopted_steam_dialog.as_mut() {
            if IsWindow(dialog.hwnd) == 0 || GetWindow(dialog.hwnd, GW_OWNER) != surface.hwnd {
                surface.adopted_steam_dialog = None;
                return;
            }
            sync_adopted_steam_dialog_position(surface.hwnd, dialog);
            return;
        }

        if surface
            .last_steam_dialog_scan_at
            .is_some_and(|last_scan_at| last_scan_at.elapsed() < STEAM_DIALOG_SCAN_INTERVAL)
        {
            return;
        }
        surface.last_steam_dialog_scan_at = Some(Instant::now());

        let candidates = enumerate_steam_dialog_windows();
        for &hwnd in &candidates.hwnds[..candidates.len] {
            if surface.steam_dialog_baseline.contains(hwnd) {
                continue;
            }
            let Some(dialog) = adopt_steam_dialog(surface.hwnd, hwnd) else {
                continue;
            };
            surface.steam_dialog_adoption_count =
                surface.steam_dialog_adoption_count.saturating_add(1);
            surface.last_adopted_steam_dialog_hwnd = Some(hwnd);
            surface.adopted_steam_dialog = Some(dialog);
            break;
        }
    }

    unsafe fn enumerate_steam_dialog_windows() -> SteamDialogWindowList {
        let mut windows = SteamDialogWindowList::default();
        EnumWindows(
            Some(collect_steam_dialog_window),
            &mut windows as *mut SteamDialogWindowList as LPARAM,
        );
        windows
    }

    unsafe extern "system" fn collect_steam_dialog_window(hwnd: HWND, lparam: LPARAM) -> i32 {
        if !is_matching_steam_dialog(hwnd) {
            return 1;
        }
        let windows = &mut *(lparam as *mut SteamDialogWindowList);
        if windows.len < windows.hwnds.len() {
            windows.hwnds[windows.len] = hwnd;
            windows.len += 1;
        }
        1
    }

    unsafe fn is_matching_steam_dialog(hwnd: HWND) -> bool {
        if hwnd.is_null()
            || IsWindow(hwnd) == 0
            || IsWindowVisible(hwnd) == 0
            || !GetWindow(hwnd, GW_OWNER).is_null()
            || !window_text_equals_ascii(hwnd, "Steam Dialog")
            || !window_class_equals_ascii(hwnd, "SDL_app")
        {
            return false;
        }

        let mut process_id = 0u32;
        GetWindowThreadProcessId(hwnd, &mut process_id);
        process_id != 0 && process_image_basename_equals(process_id, "steamwebhelper.exe")
    }

    unsafe fn window_text_equals_ascii(hwnd: HWND, expected: &str) -> bool {
        let mut buffer = [0u16; 64];
        let length = GetWindowTextW(hwnd, buffer.as_mut_ptr(), buffer.len() as i32);
        length > 0 && wide_equals_ascii(&buffer[..length as usize], expected, false)
    }

    unsafe fn window_class_equals_ascii(hwnd: HWND, expected: &str) -> bool {
        let mut buffer = [0u16; 64];
        let length = GetClassNameW(hwnd, buffer.as_mut_ptr(), buffer.len() as i32);
        length > 0 && wide_equals_ascii(&buffer[..length as usize], expected, false)
    }

    unsafe fn process_image_basename_equals(process_id: u32, expected: &str) -> bool {
        let process = OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, 0, process_id);
        if process.is_null() {
            return false;
        }
        let mut buffer = [0u16; 1024];
        let mut length = buffer.len() as u32;
        let queried = QueryFullProcessImageNameW(process, 0, buffer.as_mut_ptr(), &mut length) != 0;
        CloseHandle(process);
        if !queried || length == 0 {
            return false;
        }
        let path = &buffer[..length as usize];
        let basename_start = path
            .iter()
            .rposition(|value| matches!(*value, 47 | 92))
            .map_or(0, |index| index + 1);
        wide_equals_ascii(&path[basename_start..], expected, true)
    }

    fn wide_equals_ascii(value: &[u16], expected: &str, ignore_ascii_case: bool) -> bool {
        let expected = expected.as_bytes();
        value.len() == expected.len()
            && value.iter().zip(expected).all(|(&actual, &expected)| {
                if ignore_ascii_case {
                    ascii_lower_u16(actual) == ascii_lower_u16(expected as u16)
                } else {
                    actual == expected as u16
                }
            })
    }

    fn ascii_lower_u16(value: u16) -> u16 {
        if (b'A' as u16..=b'Z' as u16).contains(&value) {
            value + (b'a' - b'A') as u16
        } else {
            value
        }
    }

    unsafe fn adopt_steam_dialog(host_hwnd: HWND, dialog_hwnd: HWND) -> Option<AdoptedSteamDialog> {
        if !is_matching_steam_dialog(dialog_hwnd) {
            return None;
        }
        let original_rect = read_window_rect(dialog_hwnd)?;
        let host_client_rect = read_client_rect_in_screen(host_hwnd)?;
        let mut process_id = 0u32;
        GetWindowThreadProcessId(dialog_hwnd, &mut process_id);

        SetLastError(0);
        let original_owner_hwnd =
            SetWindowLongPtrW(dialog_hwnd, GWLP_HWNDPARENT, host_hwnd as isize) as HWND;
        if original_owner_hwnd.is_null() && GetLastError() != 0 {
            return None;
        }

        let (x, y) = centered_dialog_position(host_hwnd, host_client_rect, original_rect);
        if SetWindowPos(
            dialog_hwnd,
            ptr::null_mut(),
            x,
            y,
            0,
            0,
            SWP_NOACTIVATE | SWP_NOOWNERZORDER | SWP_NOSIZE | SWP_NOZORDER,
        ) == 0
        {
            SetWindowLongPtrW(dialog_hwnd, GWLP_HWNDPARENT, original_owner_hwnd as isize);
            return None;
        }

        Some(AdoptedSteamDialog {
            hwnd: dialog_hwnd,
            process_id,
            original_owner_hwnd,
            original_rect,
            last_host_client_rect: host_client_rect,
        })
    }

    unsafe fn sync_adopted_steam_dialog_position(host_hwnd: HWND, dialog: &mut AdoptedSteamDialog) {
        if IsIconic(host_hwnd) != 0 || IsWindowVisible(host_hwnd) == 0 {
            return;
        }
        let Some(host_client_rect) = read_client_rect_in_screen(host_hwnd) else {
            return;
        };
        if rect_equals(host_client_rect, dialog.last_host_client_rect) {
            return;
        }
        let Some(dialog_rect) = read_window_rect(dialog.hwnd) else {
            return;
        };
        let host_size_changed = rect_width(host_client_rect)
            != rect_width(dialog.last_host_client_rect)
            || rect_height(host_client_rect) != rect_height(dialog.last_host_client_rect);
        let (x, y) = if host_size_changed {
            centered_dialog_position(host_hwnd, host_client_rect, dialog_rect)
        } else {
            clamp_dialog_position(
                host_hwnd,
                dialog_rect.left + host_client_rect.left - dialog.last_host_client_rect.left,
                dialog_rect.top + host_client_rect.top - dialog.last_host_client_rect.top,
                rect_width(dialog_rect),
                rect_height(dialog_rect),
            )
        };
        if SetWindowPos(
            dialog.hwnd,
            ptr::null_mut(),
            x,
            y,
            0,
            0,
            SWP_NOACTIVATE | SWP_NOOWNERZORDER | SWP_NOSIZE | SWP_NOZORDER,
        ) != 0
        {
            dialog.last_host_client_rect = host_client_rect;
        }
    }

    unsafe fn restore_adopted_steam_dialog(surface: &mut NativeSurface) {
        let Some(dialog) = surface.adopted_steam_dialog.take() else {
            return;
        };
        if IsWindow(dialog.hwnd) == 0 || GetWindow(dialog.hwnd, GW_OWNER) != surface.hwnd {
            return;
        }
        SetWindowLongPtrW(
            dialog.hwnd,
            GWLP_HWNDPARENT,
            dialog.original_owner_hwnd as isize,
        );
        SetWindowPos(
            dialog.hwnd,
            ptr::null_mut(),
            dialog.original_rect.left,
            dialog.original_rect.top,
            rect_width(dialog.original_rect),
            rect_height(dialog.original_rect),
            SWP_NOACTIVATE | SWP_NOOWNERZORDER | SWP_NOZORDER,
        );
    }

    unsafe fn centered_dialog_position(
        host_hwnd: HWND,
        host_rect: RECT,
        dialog_rect: RECT,
    ) -> (i32, i32) {
        let width = rect_width(dialog_rect);
        let height = rect_height(dialog_rect);
        clamp_dialog_position(
            host_hwnd,
            host_rect.left + (rect_width(host_rect) - width) / 2,
            host_rect.top + (rect_height(host_rect) - height) / 2,
            width,
            height,
        )
    }

    unsafe fn clamp_dialog_position(
        host_hwnd: HWND,
        x: i32,
        y: i32,
        width: i32,
        height: i32,
    ) -> (i32, i32) {
        let monitor = MonitorFromWindow(host_hwnd, MONITOR_DEFAULTTONEAREST);
        let mut monitor_info: MONITORINFO = mem::zeroed();
        monitor_info.cbSize = mem::size_of::<MONITORINFO>() as u32;
        if monitor.is_null() || GetMonitorInfoW(monitor, &mut monitor_info) == 0 {
            return (x, y);
        }
        let work = monitor_info.rcWork;
        (
            x.clamp(work.left, (work.right - width).max(work.left)),
            y.clamp(work.top, (work.bottom - height).max(work.top)),
        )
    }

    fn rect_equals(left: RECT, right: RECT) -> bool {
        left.left == right.left
            && left.top == right.top
            && left.right == right.right
            && left.bottom == right.bottom
    }

    fn rect_width(rect: RECT) -> i32 {
        (rect.right - rect.left).max(1)
    }

    fn rect_height(rect: RECT) -> i32 {
        (rect.bottom - rect.top).max(1)
    }

    unsafe fn hide_window_without_activation(hwnd: HWND) {
        SetWindowPos(
            hwnd,
            ptr::null_mut(),
            0,
            0,
            0,
            0,
            SWP_HIDEWINDOW
                | SWP_NOMOVE
                | SWP_NOSIZE
                | SWP_NOZORDER
                | SWP_NOOWNERZORDER
                | SWP_NOACTIVATE,
        );
    }

    unsafe fn sync_surface_visibility(surface: &mut NativeSurface) {
        let should_be_visible =
            surface.requested_visible && !(surface.input_passthrough && !surface.opaque);
        if should_be_visible == surface.visible {
            return;
        }
        if should_be_visible {
            surface.presentation_ready = false;
            apply_window_style(surface);
            let command = if surface.input_passthrough {
                SW_SHOWNOACTIVATE
            } else {
                SW_SHOW
            };
            ShowWindow(surface.hwnd, command);
        } else {
            hide_window_without_activation(surface.hwnd);
            surface.presentation_ready = false;
        }
        surface.visible = should_be_visible;
        if should_be_visible && !surface.input_passthrough {
            activate_window(surface);
        }
    }

    unsafe fn sync_window_style(surface: &mut NativeSurface) {
        apply_window_style(surface);
        sync_surface_visibility(surface);
    }

    unsafe fn apply_window_style(surface: &mut NativeSurface) {
        let mut ex_style = GetWindowLongPtrW(surface.hwnd, GWL_EXSTYLE) as u32;
        ex_style &= !(WS_EX_TOOLWINDOW | WS_EX_NOACTIVATE | WS_EX_TOPMOST);
        // Keep the presenter transparent until it has copied and presented a
        // fresh Electron frame. Once ready, it is a normal opaque game window;
        // Steam then composites over the copied game pixels in its swapchain.
        if surface.opaque && surface.presentation_ready {
            ex_style &= !WS_EX_LAYERED;
        } else {
            ex_style |= WS_EX_LAYERED;
        }
        if surface.input_passthrough {
            ex_style |= WS_EX_TRANSPARENT;
        } else {
            ex_style &= !WS_EX_TRANSPARENT;
        }
        SetWindowLongPtrW(surface.hwnd, GWL_EXSTYLE, ex_style as isize);
        let mut flags =
            SWP_NOMOVE | SWP_NOSIZE | SWP_NOOWNERZORDER | SWP_NOZORDER | SWP_FRAMECHANGED;
        if surface.input_passthrough {
            flags |= SWP_NOACTIVATE;
        }
        SetWindowPos(surface.hwnd, ptr::null_mut(), 0, 0, 0, 0, flags);
        if ex_style & WS_EX_LAYERED != 0 {
            SetLayeredWindowAttributes(surface.hwnd, 0, 0, LWA_ALPHA);
        }
    }

    unsafe fn set_window_corner_preference(hwnd: HWND, full_screen: bool) {
        let corner_preference = if full_screen {
            DWMWCP_DONOTROUND
        } else {
            DWMWCP_ROUND
        };
        DwmSetWindowAttribute(
            hwnd,
            DWMWA_WINDOW_CORNER_PREFERENCE as u32,
            &corner_preference as *const i32 as *const std::ffi::c_void,
            mem::size_of::<i32>() as u32,
        );
    }

    unsafe fn activate_window(surface: &NativeSurface) {
        SetForegroundWindow(surface.hwnd);
        SetActiveWindow(surface.hwnd);
        SetFocus(surface.hwnd);
    }

    unsafe fn inherit_foreground_keyboard_layout() {
        let foreground = GetForegroundWindow();
        if foreground.is_null() {
            return;
        }
        let foreground_thread = GetWindowThreadProcessId(foreground, ptr::null_mut());
        if foreground_thread == 0 {
            return;
        }
        let foreground_layout = GetKeyboardLayout(foreground_thread);
        if foreground_layout.is_null() || foreground_layout == GetKeyboardLayout(0) {
            return;
        }
        // Keyboard layouts are thread-local on Windows. The standalone Steam
        // host becomes the application's focused window, so inherit the layout
        // that was active immediately before the host is created instead of
        // silently reverting players to this process thread's default layout.
        ActivateKeyboardLayout(foreground_layout, 0);
    }

    unsafe fn destroy_surface(mut surface: NativeSurface) {
        restore_adopted_steam_dialog(&mut surface);
        if surface.cursor_suppressed {
            normalize_cursor_display_count(true);
        }
        if let Some(menu) = surface.menu.take() {
            SetMenu(surface.hwnd, ptr::null_mut());
            DestroyMenu(menu);
        }
        unregister_menu_draw_items(&surface.menu_draw_tokens);
        release_renderer(surface.renderer, surface.hwnd);
        if !surface.hwnd.is_null() {
            DestroyWindow(surface.hwnd);
        }
        if !surface.transparent_cursor.is_null() {
            DestroyCursor(surface.transparent_cursor);
        }
        set_standalone_min_client_size(None);
        set_standalone_logical_client_size(None);
        STANDALONE_DISPLAY_CLAMPED.store(false, Ordering::Relaxed);
        STANDALONE_WINDOW_DPI.store(96, Ordering::Relaxed);
    }

    unsafe fn surface_needs_render(surface: &NativeSurface) -> bool {
        if surface.source_frame_dirty || !surface.presentation_ready {
            return true;
        }

        // The DXGI frame-latency waitable object is the cadence boundary for the
        // D3D11 host. Continuous presentation keeps the retained frame eligible;
        // new Electron frames also arrive through the immediate update path.
        if surface.continuous_present_requested {
            return true;
        }

        // Some desktop-capture paths stop exposing an idle legacy swapchain
        // even though its source bitmap has not changed. Refresh the retained
        // frame at a deliberately low cadence; active Electron paint still
        // drives the real display-rate path.
        if surface.source_frame.is_some()
            && surface.last_present_at.is_none_or(|last_present_at| {
                last_present_at.elapsed() >= RETAINED_FRAME_REFRESH_INTERVAL
            })
        {
            return true;
        }

        match &surface.renderer {
            WindowsSurfaceRenderer::OpenGl { .. } => true,
            WindowsSurfaceRenderer::D3d11 { renderer, .. } => {
                let mut rect: RECT = mem::zeroed();
                GetClientRect(surface.hwnd, &mut rect) != 0
                    && (renderer.width() != (rect.right - rect.left).max(1) as u32
                        || renderer.height() != (rect.bottom - rect.top).max(1) as u32)
            }
        }
    }

    unsafe fn sync_cursor_visibility(surface: &mut NativeSurface) {
        let should_suppress = surface.cursor_hidden_requested
            && surface.visible
            && surface_has_foreground(surface)
            && cursor_is_in_client(surface.hwnd);

        if should_suppress != surface.cursor_suppressed {
            surface.cursor_display_count = Some(normalize_cursor_display_count(!should_suppress));
            surface.cursor_suppressed = should_suppress;
        }
        if should_suppress {
            SetCursor(surface.transparent_cursor);
        }
    }

    unsafe fn sync_cursor_for_window_message(hwnd: HWND) -> bool {
        let Ok(mut guard) = SURFACE.try_lock() else {
            return false;
        };
        let Some(surface) = guard.as_mut().filter(|surface| surface.hwnd == hwnd) else {
            return false;
        };
        sync_cursor_visibility(surface);
        if !surface.cursor_suppressed {
            return false;
        }
        SetCursor(surface.transparent_cursor);
        true
    }

    unsafe fn normalize_cursor_display_count(visible: bool) -> i32 {
        let mut display_count = ShowCursor(if visible { 1 } else { 0 });
        for _ in 0..32 {
            if (visible && display_count >= 0) || (!visible && display_count < 0) {
                break;
            }
            display_count = ShowCursor(if visible { 1 } else { 0 });
        }
        display_count
    }

    unsafe fn surface_has_foreground(surface: &NativeSurface) -> bool {
        GetForegroundWindow() == surface.hwnd
    }

    unsafe fn poll_overlay_shortcut(surface: &mut NativeSurface) {
        let tab_state = async_key_state(VK_TAB_CODE);
        let shift_state = async_key_state(VK_SHIFT_CODE)
            | async_key_state(VK_LEFT_SHIFT_CODE)
            | async_key_state(VK_RIGHT_SHIFT_CODE);
        let has_foreground = surface_has_foreground(surface);
        let shortcut_down = has_foreground && tab_state & 0x8000 != 0 && shift_state & 0x8000 != 0;
        let shortcut_signaled =
            has_foreground && tab_state & 0x8001 != 0 && shift_state & 0x8001 != 0;
        if shortcut_signaled && !surface.overlay_shortcut_down {
            record_overlay_shortcut(surface.hwnd);
        }
        surface.overlay_shortcut_down = shortcut_down;
    }

    unsafe fn async_key_state(virtual_key: i32) -> u16 {
        GetAsyncKeyState(virtual_key) as u16
    }

    unsafe fn cursor_is_in_client(hwnd: HWND) -> bool {
        let mut point: POINT = mem::zeroed();
        if GetCursorPos(&mut point) == 0 || ScreenToClient(hwnd, &mut point) == 0 {
            return false;
        }
        let mut rect: RECT = mem::zeroed();
        GetClientRect(hwnd, &mut rect) != 0
            && point.x >= rect.left
            && point.y >= rect.top
            && point.x < rect.right
            && point.y < rect.bottom
    }

    unsafe fn pump_messages(hwnd: HWND) {
        let mut message: MSG = mem::zeroed();
        while PeekMessageW(&mut message, hwnd, 0, 0, PM_REMOVE) != 0 {
            TranslateMessage(&message);
            DispatchMessageW(&message);
        }
    }

    unsafe fn render_retained_frame_from_window_message(
        hwnd: HWND,
        present_after_modal_loop: bool,
        allow_during_modal_size_move: bool,
    ) {
        let Ok(mut guard) = SURFACE.try_lock() else {
            return;
        };
        let Some(surface) = guard
            .as_mut()
            .filter(|surface| surface.hwnd == hwnd && surface.visible)
        else {
            return;
        };
        surface.present_after_modal_loop |= present_after_modal_loop;
        if surface.modal_size_move_active && !allow_during_modal_size_move {
            surface.source_frame_dirty = true;
            return;
        }
        if render_surface(surface).is_err() {
            // The ordinary pump owns error teardown. Keep the retained frame
            // dirty so it retries immediately after the modal sizing loop.
            surface.source_frame_dirty = true;
        }
    }

    unsafe fn set_modal_size_move_active(hwnd: HWND, active: bool) {
        let Ok(mut guard) = SURFACE.try_lock() else {
            return;
        };
        let Some(surface) = guard.as_mut().filter(|surface| surface.hwnd == hwnd) else {
            return;
        };
        surface.modal_size_move_active = active;
        if !active {
            surface.present_after_modal_loop = true;
        }
    }

    fn dpi_scaled(value: i32, dpi: u32) -> i32 {
        ((i64::from(value) * i64::from(dpi.max(96)) + 48) / 96).clamp(1, i64::from(i32::MAX)) as i32
    }

    unsafe fn with_menu_font<T>(dpi: u32, run: impl FnOnce(isize) -> T) -> T {
        let mut metrics: NONCLIENTMETRICSW = mem::zeroed();
        metrics.cbSize = mem::size_of::<NONCLIENTMETRICSW>() as u32;
        let font = if SystemParametersInfoForDpi(
            SPI_GETNONCLIENTMETRICS,
            metrics.cbSize,
            &mut metrics as *mut NONCLIENTMETRICSW as *mut std::ffi::c_void,
            0,
            dpi,
        ) != 0
        {
            CreateFontIndirectW(&metrics.lfMenuFont) as isize
        } else {
            0
        };
        let owns_font = font != 0;
        let font = if owns_font {
            font
        } else {
            GetStockObject(DEFAULT_GUI_FONT) as isize
        };
        let result = run(font);
        if owns_font {
            DeleteObject(font as *mut std::ffi::c_void);
        }
        result
    }

    unsafe fn menu_text_extent(hdc: HDC, text: &[u16]) -> SIZE {
        let mut size: SIZE = mem::zeroed();
        if !text.is_empty() {
            GetTextExtentPoint32W(hdc, text.as_ptr(), text.len() as i32, &mut size);
        }
        size
    }

    fn split_menu_text(text: &[u16]) -> (&[u16], &[u16]) {
        match text.iter().position(|value| *value == b'\t' as u16) {
            Some(index) => (&text[..index], &text[index + 1..]),
            None => (text, &[]),
        }
    }

    unsafe fn measure_native_menu_item(hwnd: HWND, measure: &mut MEASUREITEMSTRUCT) -> bool {
        if measure.CtlType != ODT_MENU || measure.itemData == 0 {
            return false;
        }
        let Some(item) = read_menu_draw_item(measure.itemData) else {
            return false;
        };
        let dpi = GetDpiForWindow(hwnd).max(96).max(item.minimum_dpi);
        if item.separator {
            measure.itemWidth = dpi_scaled(8, dpi) as u32;
            measure.itemHeight = dpi_scaled(7, dpi) as u32;
            return true;
        }

        let hdc = GetDC(hwnd);
        if hdc.is_null() {
            return false;
        }
        let (left_text, accelerator_text) = split_menu_text(&item.measure_label);
        let (left_size, accelerator_size) = with_menu_font(dpi, |font| {
            let previous = SelectObject(hdc, font as *mut std::ffi::c_void);
            let sizes = (
                menu_text_extent(hdc, left_text),
                menu_text_extent(hdc, accelerator_text),
            );
            if !previous.is_null() {
                SelectObject(hdc, previous);
            }
            sizes
        });
        ReleaseDC(hwnd, hdc);

        let horizontal_padding = dpi_scaled(if item.top_level { 8 } else { 6 }, dpi);
        let vertical_padding = dpi_scaled(3, dpi);
        let text_height = left_size.cy.max(accelerator_size.cy).max(1);
        let item_height =
            GetSystemMetricsForDpi(SM_CYMENU, dpi).max(text_height + vertical_padding * 2);
        let item_width = if item.top_level {
            left_size.cx + horizontal_padding * 2
        } else {
            let check_width = GetSystemMetricsForDpi(SM_CXMENUCHECK, dpi).max(dpi_scaled(12, dpi));
            let arrow_width = GetSystemMetricsForDpi(SM_CXMENUSIZE, dpi).max(dpi_scaled(12, dpi));
            check_width
                + left_size.cx
                + if accelerator_text.is_empty() {
                    0
                } else {
                    dpi_scaled(24, dpi) + accelerator_size.cx
                }
                + arrow_width
                + horizontal_padding * 4
        };
        measure.itemWidth = item_width.max(1) as u32;
        measure.itemHeight = item_height.max(1) as u32;
        true
    }

    unsafe fn draw_native_menu_item(hwnd: HWND, draw: &DRAWITEMSTRUCT) -> bool {
        if draw.CtlType != ODT_MENU || draw.itemData == 0 || draw.hDC.is_null() {
            return false;
        }
        let Some(item) = read_menu_draw_item(draw.itemData) else {
            return false;
        };
        let dpi = GetDpiForWindow(hwnd).max(96).max(item.minimum_dpi);
        let selected = draw.itemState & ODS_SELECTED != 0;
        let disabled = draw.itemState & (ODS_DISABLED | ODS_GRAYED) != 0;
        let background_color = if selected {
            COLOR_HIGHLIGHT
        } else if item.top_level {
            COLOR_MENUBAR
        } else {
            COLOR_MENU
        };
        FillRect(draw.hDC, &draw.rcItem, GetSysColorBrush(background_color));

        if item.separator {
            let mut line = draw.rcItem;
            let center = line.top + (line.bottom - line.top) / 2;
            line.left += dpi_scaled(18, dpi);
            line.right -= dpi_scaled(6, dpi);
            line.top = center;
            line.bottom = center + 1;
            FillRect(draw.hDC, &line, GetSysColorBrush(COLOR_GRAYTEXT));
            return true;
        }

        let text_color = if disabled {
            COLOR_GRAYTEXT
        } else if selected {
            COLOR_HIGHLIGHTTEXT
        } else {
            COLOR_MENUTEXT
        };
        SetBkMode(draw.hDC, TRANSPARENT as i32);
        SetTextColor(draw.hDC, GetSysColor(text_color));
        let horizontal_padding = dpi_scaled(if item.top_level { 8 } else { 6 }, dpi);
        let check_width = if item.top_level {
            0
        } else {
            GetSystemMetricsForDpi(SM_CXMENUCHECK, dpi).max(dpi_scaled(12, dpi))
        };
        let arrow_width = if item.top_level {
            0
        } else {
            GetSystemMetricsForDpi(SM_CXMENUSIZE, dpi).max(dpi_scaled(12, dpi))
        };
        let (left_text, accelerator_text) = split_menu_text(&item.label);
        let mut format = DT_SINGLELINE | DT_VCENTER;
        if draw.itemState & ODS_NOACCEL != 0 {
            format |= DT_HIDEPREFIX;
        }

        with_menu_font(dpi, |font| {
            let previous = SelectObject(draw.hDC, font as *mut std::ffi::c_void);
            let mut left_rect = draw.rcItem;
            left_rect.left += horizontal_padding + check_width;
            left_rect.right -= horizontal_padding + arrow_width;
            DrawTextW(
                draw.hDC,
                left_text.as_ptr(),
                left_text.len() as i32,
                &mut left_rect,
                format | DT_LEFT,
            );
            if !accelerator_text.is_empty() {
                let mut accelerator_rect = left_rect;
                accelerator_rect.left += dpi_scaled(24, dpi);
                DrawTextW(
                    draw.hDC,
                    accelerator_text.as_ptr(),
                    accelerator_text.len() as i32,
                    &mut accelerator_rect,
                    format | DT_RIGHT,
                );
            }
            if !previous.is_null() {
                SelectObject(draw.hDC, previous);
            }
        });

        if item.submenu && !item.top_level {
            let mut arrow_rect = draw.rcItem;
            arrow_rect.left = arrow_rect.right - arrow_width - horizontal_padding;
            arrow_rect.right -= horizontal_padding;
            let arrow_size = GetSystemMetricsForDpi(SM_CYMENUSIZE, dpi)
                .max(dpi_scaled(12, dpi))
                .min((arrow_rect.bottom - arrow_rect.top).max(1));
            let center = arrow_rect.top + (arrow_rect.bottom - arrow_rect.top) / 2;
            arrow_rect.top = center - arrow_size / 2;
            arrow_rect.bottom = arrow_rect.top + arrow_size;
            DrawFrameControl(
                draw.hDC,
                &mut arrow_rect,
                DFC_MENU,
                DFCS_MENUARROW | if disabled { DFCS_INACTIVE } else { 0 },
            );
        }
        true
    }

    unsafe extern "system" fn window_proc(
        hwnd: HWND,
        message: u32,
        wparam: WPARAM,
        lparam: LPARAM,
    ) -> LRESULT {
        record_window_message(hwnd, message, wparam, lparam);
        record_window_input(hwnd, message, wparam, lparam);
        if message == WM_MEASUREITEM && lparam != 0 {
            let measure = &mut *(lparam as *mut MEASUREITEMSTRUCT);
            if measure_native_menu_item(hwnd, measure) {
                return 1;
            }
        }
        if message == WM_DRAWITEM && lparam != 0 {
            let draw = &*(lparam as *const DRAWITEMSTRUCT);
            if draw_native_menu_item(hwnd, draw) {
                return 1;
            }
        }
        if matches!(message, WM_LBUTTONDOWN | WM_RBUTTONDOWN | WM_MBUTTONDOWN) {
            SetCapture(hwnd);
        }
        if matches!(message, WM_LBUTTONUP | WM_RBUTTONUP | WM_MBUTTONUP)
            && (wparam as u32 & (MK_LBUTTON | MK_RBUTTON | MK_MBUTTON)) == 0
            && GetCapture() == hwnd
        {
            ReleaseCapture();
        }
        if message == WM_CANCELMODE && GetCapture() == hwnd {
            ReleaseCapture();
        }
        if message == WM_GETMINMAXINFO && lparam != 0 {
            if let Some((width, height)) = minimum_window_track_size(hwnd) {
                let min_max_info = &mut *(lparam as *mut MINMAXINFO);
                min_max_info.ptMinTrackSize.x = min_max_info.ptMinTrackSize.x.max(width);
                min_max_info.ptMinTrackSize.y = min_max_info.ptMinTrackSize.y.max(height);
                return 0;
            }
        }
        if message == WM_CLOSE {
            ShowWindow(hwnd, SW_HIDE);
            return 0;
        }
        if message == WM_MOUSEACTIVATE
            && GetWindowLongPtrW(hwnd, GWL_EXSTYLE) as u32 & WS_EX_NOACTIVATE != 0
        {
            return MA_NOACTIVATE as LRESULT;
        }
        if message == WM_SETCURSOR && sync_cursor_for_window_message(hwnd) {
            return 1;
        }
        if message == WM_ERASEBKGND {
            render_retained_frame_from_window_message(hwnd, false, false);
            return 1;
        }
        if message == WM_SIZE && wparam != SIZE_MINIMIZED as usize {
            render_retained_frame_from_window_message(hwnd, false, false);
        }
        if message == WM_DPICHANGED && lparam != 0 {
            let new_dpi = (wparam as u32 & 0xffff).max(96);
            let previous_dpi = STANDALONE_WINDOW_DPI
                .swap(new_dpi, Ordering::Relaxed)
                .max(96);
            // GetDpiForWindow and owner-drawn menu metrics can already reflect
            // the new DPI before WM_DPICHANGED reaches this procedure. Reading
            // the client rect here therefore loses pixels from the old logical
            // viewport. Keep the last normal logical client size separately so
            // a DPI transition cannot reinterpret new non-client metrics as a
            // user resize.
            let logical_client_size = standalone_logical_client_size().or_else(|| {
                read_client_rect(hwnd).map(|client| {
                    (
                        physical_pixels_to_logical(
                            (client.right - client.left).max(1),
                            previous_dpi,
                        ),
                        physical_pixels_to_logical(
                            (client.bottom - client.top).max(1),
                            previous_dpi,
                        ),
                    )
                })
            });
            let suggested = &*(lparam as *const RECT);
            SetWindowPos(
                hwnd,
                ptr::null_mut(),
                suggested.left,
                suggested.top,
                (suggested.right - suggested.left).max(1),
                (suggested.bottom - suggested.top).max(1),
                SWP_NOACTIVATE | SWP_NOOWNERZORDER | SWP_NOZORDER,
            );
            let style = GetWindowLongPtrW(hwnd, GWL_STYLE) as u32;
            if IsZoomed(hwnd) == 0 && style & WS_OVERLAPPEDWINDOW != 0 {
                if let Some((logical_width, logical_height)) = logical_client_size {
                    let _ = resize_window_for_client_size(
                        hwnd,
                        suggested.left,
                        suggested.top,
                        logical_pixels_to_physical(logical_width, new_dpi),
                        logical_pixels_to_physical(logical_height, new_dpi),
                    );
                }
            }
            DrawMenuBar(hwnd);
            reconcile_standalone_window_with_work_area(hwnd);
            render_retained_frame_from_window_message(hwnd, true, false);
            return 0;
        }
        if matches!(message, WM_DISPLAYCHANGE | WM_SETTINGCHANGE) {
            reconcile_standalone_window_with_work_area(hwnd);
            render_retained_frame_from_window_message(hwnd, true, false);
        }
        if message == WM_ENTERSIZEMOVE {
            // DefWindowProc owns a nested modal loop while a top-level window is
            // moved or resized. The ordinary JS-driven pump is blocked during
            // that loop, so keep capture/composition alive from a window timer.
            set_modal_size_move_active(hwnd, true);
            SetTimer(
                hwnd,
                MODAL_PRESENT_TIMER_ID,
                MODAL_PRESENT_INTERVAL_MS,
                None,
            );
            render_retained_frame_from_window_message(hwnd, true, false);
        }
        if message == WM_TIMER && wparam == MODAL_PRESENT_TIMER_ID {
            render_retained_frame_from_window_message(hwnd, false, true);
            return 0;
        }
        if message == WM_EXITSIZEMOVE {
            KillTimer(hwnd, MODAL_PRESENT_TIMER_ID);
            set_modal_size_move_active(hwnd, false);
            remember_standalone_logical_client_size(hwnd);
            STANDALONE_DISPLAY_CLAMPED.store(false, Ordering::Relaxed);
            render_retained_frame_from_window_message(hwnd, true, true);
        }
        if message == WM_MOVE {
            render_retained_frame_from_window_message(hwnd, false, false);
        }
        if message == WM_PAINT {
            let mut paint: PAINTSTRUCT = mem::zeroed();
            BeginPaint(hwnd, &mut paint);
            render_retained_frame_from_window_message(hwnd, false, false);
            EndPaint(hwnd, &paint);
            return 0;
        }
        DefWindowProcW(hwnd, message, wparam, lparam)
    }

    unsafe fn ensure_window_class() -> Result<(), Error> {
        WINDOW_CLASS_RESULT
            .get_or_init(|| register_window_class().map_err(|error| error.to_owned()))
            .clone()
            .map_err(Error::from_reason)
    }

    unsafe fn register_window_class() -> Result<(), &'static str> {
        let class_name = window_class_name();
        let window_class = WNDCLASSW {
            style: CS_OWNDC,
            lpfnWndProc: Some(window_proc),
            cbClsExtra: 0,
            cbWndExtra: 0,
            hInstance: GetModuleHandleW(ptr::null()),
            hIcon: ptr::null_mut(),
            hCursor: LoadCursorW(ptr::null_mut(), IDC_ARROW),
            hbrBackground: ptr::null_mut(),
            lpszMenuName: ptr::null(),
            lpszClassName: class_name.as_ptr(),
        };

        if RegisterClassW(&window_class) == 0 {
            return Err("Failed to register Windows native overlay window class");
        }
        Ok(())
    }

    fn pixel_format_descriptor() -> PIXELFORMATDESCRIPTOR {
        PIXELFORMATDESCRIPTOR {
            nSize: mem::size_of::<PIXELFORMATDESCRIPTOR>() as u16,
            nVersion: 1,
            dwFlags: PFD_DRAW_TO_WINDOW | PFD_SUPPORT_OPENGL | PFD_DOUBLEBUFFER,
            iPixelType: PFD_TYPE_RGBA,
            cColorBits: 32,
            cRedBits: 0,
            cRedShift: 0,
            cGreenBits: 0,
            cGreenShift: 0,
            cBlueBits: 0,
            cBlueShift: 0,
            cAlphaBits: 8,
            cAlphaShift: 0,
            cAccumBits: 0,
            cAccumRedBits: 0,
            cAccumGreenBits: 0,
            cAccumBlueBits: 0,
            cAccumAlphaBits: 0,
            cDepthBits: 24,
            cStencilBits: 8,
            cAuxBuffers: 0,
            iLayerType: PFD_MAIN_PLANE as u8,
            bReserved: 0,
            dwLayerMask: 0,
            dwVisibleMask: 0,
            dwDamageMask: 0,
        }
    }

    fn read_window_rect(hwnd: HWND) -> Option<RECT> {
        unsafe {
            let mut rect: RECT = mem::zeroed();
            if GetWindowRect(hwnd, &mut rect) == 0 {
                return None;
            }
            Some(rect)
        }
    }

    fn read_client_rect(hwnd: HWND) -> Option<RECT> {
        unsafe {
            let mut rect: RECT = mem::zeroed();
            if GetClientRect(hwnd, &mut rect) == 0 {
                return None;
            }
            Some(rect)
        }
    }

    fn read_client_rect_in_screen(hwnd: HWND) -> Option<RECT> {
        unsafe {
            let rect = read_client_rect(hwnd)?;

            let width = rect.right - rect.left;
            let height = rect.bottom - rect.top;
            let mut origin = POINT {
                x: rect.left,
                y: rect.top,
            };
            if ClientToScreen(hwnd, &mut origin) == 0 {
                return None;
            }

            Some(RECT {
                left: origin.x,
                top: origin.y,
                right: origin.x + width,
                bottom: origin.y + height,
            })
        }
    }

    fn base_ex_style() -> u32 {
        WS_EX_LAYERED
    }

    fn reset_window_message_diagnostics() {
        *WINDOW_MESSAGE_DIAGNOSTICS
            .lock()
            .expect("Steam overlay window message diagnostics lock poisoned") =
            WindowMessageDiagnostics::default();
        WINDOW_INPUT_EVENTS
            .lock()
            .expect("Steam overlay window input event lock poisoned")
            .clear();
    }

    fn record_overlay_shortcut(hwnd: HWND) {
        let client = read_client_rect(hwnd).unwrap_or(RECT {
            left: 0,
            top: 0,
            right: 1,
            bottom: 1,
        });
        let event = WindowInputEvent {
            kind: "overlayShortcut",
            captured_at_ms: now_ms(),
            message: 0,
            wparam: 0,
            lparam: 0,
            shift: true,
            control: false,
            alt: false,
            caps_lock: unsafe { lock_key_toggled(VK_CAPS_LOCK_CODE) },
            num_lock: unsafe { lock_key_toggled(VK_NUM_LOCK_CODE) },
            x: None,
            y: None,
            delta_y: None,
            command_id: None,
            client_width: (client.right - client.left).max(1),
            client_height: (client.bottom - client.top).max(1),
            minimized: unsafe { IsIconic(hwnd) != 0 },
        };
        let mut events = WINDOW_INPUT_EVENTS
            .lock()
            .expect("Steam overlay window input event lock poisoned");
        events.push(event);
        if events.len() > 256 {
            events.remove(0);
        }
    }

    fn record_window_input(hwnd: HWND, message: u32, wparam: WPARAM, lparam: LPARAM) {
        let kind = match message {
            WM_MOUSEMOVE => "mouseMove",
            WM_LBUTTONDOWN => "leftMouseDown",
            WM_LBUTTONUP => "leftMouseUp",
            WM_RBUTTONDOWN => "rightMouseDown",
            WM_RBUTTONUP => "rightMouseUp",
            WM_MBUTTONDOWN => "middleMouseDown",
            WM_MBUTTONUP => "middleMouseUp",
            WM_MOUSEWHEEL => "mouseWheel",
            WM_KEYDOWN | WM_SYSKEYDOWN => "keyDown",
            WM_KEYUP | WM_SYSKEYUP => "keyUp",
            WM_CHAR => "char",
            WM_SETFOCUS => "focus",
            WM_KILLFOCUS => "blur",
            WM_CAPTURECHANGED | WM_CANCELMODE => "captureLost",
            WM_COMMAND => "menuCommand",
            WM_CLOSE => "close",
            WM_MOVE | WM_SIZE => "windowChanged",
            _ => return,
        };
        let (x, y) = if message == WM_MOUSEWHEEL {
            let packed = lparam as u32;
            let mut point = POINT {
                x: (packed as u16 as i16) as i32,
                y: ((packed >> 16) as u16 as i16) as i32,
            };
            if unsafe { ScreenToClient(hwnd, &mut point) } != 0 {
                (Some(point.x), Some(point.y))
            } else {
                (None, None)
            }
        } else if matches!(
            message,
            WM_MOUSEMOVE
                | WM_LBUTTONDOWN
                | WM_LBUTTONUP
                | WM_RBUTTONDOWN
                | WM_RBUTTONUP
                | WM_MBUTTONDOWN
                | WM_MBUTTONUP
        ) {
            let packed = lparam as u32;
            (
                Some((packed as u16 as i16) as i32),
                Some(((packed >> 16) as u16 as i16) as i32),
            )
        } else {
            (None, None)
        };
        let client = read_client_rect(hwnd).unwrap_or(RECT {
            left: 0,
            top: 0,
            right: 1,
            bottom: 1,
        });
        let event = WindowInputEvent {
            kind,
            captured_at_ms: now_ms(),
            message,
            wparam: wparam as u64,
            lparam: lparam as i64,
            shift: unsafe {
                modifier_key_down(&[VK_SHIFT_CODE, VK_LEFT_SHIFT_CODE, VK_RIGHT_SHIFT_CODE])
            },
            control: unsafe {
                modifier_key_down(&[VK_CONTROL_CODE, VK_LEFT_CONTROL_CODE, VK_RIGHT_CONTROL_CODE])
            },
            alt: unsafe { modifier_key_down(&[VK_ALT_CODE, VK_LEFT_ALT_CODE, VK_RIGHT_ALT_CODE]) },
            caps_lock: unsafe { lock_key_toggled(VK_CAPS_LOCK_CODE) },
            num_lock: unsafe { lock_key_toggled(VK_NUM_LOCK_CODE) },
            x,
            y,
            delta_y: (message == WM_MOUSEWHEEL)
                .then_some(((wparam as u32 >> 16) as u16 as i16) as i32),
            command_id: (message == WM_COMMAND).then_some(wparam as u32 & u16::MAX as u32),
            client_width: (client.right - client.left).max(1),
            client_height: (client.bottom - client.top).max(1),
            minimized: (message == WM_SIZE && wparam == SIZE_MINIMIZED as usize)
                || unsafe { IsIconic(hwnd) != 0 },
        };
        let mut events = WINDOW_INPUT_EVENTS
            .lock()
            .expect("Steam overlay window input event lock poisoned");
        if matches!(message, WM_MOUSEMOVE | WM_MOVE | WM_SIZE)
            && events.last().is_some_and(|last| last.kind == kind)
        {
            *events.last_mut().expect("input event disappeared") = event;
        } else {
            events.push(event);
        }
        if events.len() > 256 {
            events.remove(0);
        }
    }

    fn record_window_message(hwnd: HWND, message: u32, wparam: WPARAM, lparam: LPARAM) {
        let name = window_message_name(message);
        let mut diagnostics = WINDOW_MESSAGE_DIAGNOSTICS
            .lock()
            .expect("Steam overlay window message diagnostics lock poisoned");
        diagnostics.counters.total = diagnostics.counters.total.saturating_add(1);
        match message {
            WM_KEYDOWN => {
                diagnostics.counters.key_down = diagnostics.counters.key_down.saturating_add(1)
            }
            WM_KEYUP => diagnostics.counters.key_up = diagnostics.counters.key_up.saturating_add(1),
            WM_SYSKEYDOWN => {
                diagnostics.counters.sys_key_down =
                    diagnostics.counters.sys_key_down.saturating_add(1)
            }
            WM_SYSKEYUP => {
                diagnostics.counters.sys_key_up = diagnostics.counters.sys_key_up.saturating_add(1)
            }
            WM_MOUSEMOVE => {
                diagnostics.counters.mouse_move = diagnostics.counters.mouse_move.saturating_add(1)
            }
            WM_LBUTTONDOWN => {
                diagnostics.counters.left_button_down =
                    diagnostics.counters.left_button_down.saturating_add(1)
            }
            WM_LBUTTONUP => {
                diagnostics.counters.left_button_up =
                    diagnostics.counters.left_button_up.saturating_add(1)
            }
            WM_CLOSE => diagnostics.counters.close = diagnostics.counters.close.saturating_add(1),
            WM_SETFOCUS => {
                diagnostics.counters.set_focus = diagnostics.counters.set_focus.saturating_add(1)
            }
            WM_KILLFOCUS => {
                diagnostics.counters.kill_focus = diagnostics.counters.kill_focus.saturating_add(1)
            }
            WM_ACTIVATE => {
                diagnostics.counters.activate = diagnostics.counters.activate.saturating_add(1)
            }
            WM_ACTIVATEAPP => {
                diagnostics.counters.activate_app =
                    diagnostics.counters.activate_app.saturating_add(1)
            }
            WM_MOUSEACTIVATE => {
                diagnostics.counters.mouse_activate =
                    diagnostics.counters.mouse_activate.saturating_add(1)
            }
            WM_COMMAND => {
                diagnostics.counters.command = diagnostics.counters.command.saturating_add(1);
            }
            WM_NCHITTEST => {
                diagnostics.counters.nc_hit_test =
                    diagnostics.counters.nc_hit_test.saturating_add(1);
            }
            WM_NCLBUTTONDOWN => {
                diagnostics.counters.nc_left_button_down =
                    diagnostics.counters.nc_left_button_down.saturating_add(1);
            }
            WM_NCLBUTTONUP => {
                diagnostics.counters.nc_left_button_up =
                    diagnostics.counters.nc_left_button_up.saturating_add(1);
            }
            WM_SYSCOMMAND => {
                diagnostics.counters.system_command =
                    diagnostics.counters.system_command.saturating_add(1);
            }
            WM_ENTERSIZEMOVE => {
                diagnostics.counters.enter_size_move =
                    diagnostics.counters.enter_size_move.saturating_add(1);
            }
            WM_EXITSIZEMOVE => {
                diagnostics.counters.exit_size_move =
                    diagnostics.counters.exit_size_move.saturating_add(1);
            }
            WM_CAPTURECHANGED => {
                diagnostics.counters.capture_changed =
                    diagnostics.counters.capture_changed.saturating_add(1);
            }
            _ => {}
        }

        if is_diagnostic_window_message(message) {
            diagnostics.recent.push(WindowMessageEvent {
                at_ms: now_ms(),
                hwnd: hwnd_hex(hwnd),
                message,
                name,
                wparam: wparam as u64,
                lparam: lparam as i64,
            });
            if diagnostics.recent.len() > 64 {
                diagnostics.recent.remove(0);
            }
        }
    }

    fn is_diagnostic_window_message(message: u32) -> bool {
        matches!(
            message,
            WM_KEYDOWN
                | WM_KEYUP
                | WM_SYSKEYDOWN
                | WM_SYSKEYUP
                | WM_LBUTTONDOWN
                | WM_LBUTTONUP
                | WM_CLOSE
                | WM_SETFOCUS
                | WM_KILLFOCUS
                | WM_ACTIVATE
                | WM_ACTIVATEAPP
                | WM_MOUSEACTIVATE
                | WM_COMMAND
                | WM_NCHITTEST
                | WM_NCLBUTTONDOWN
                | WM_NCLBUTTONUP
                | WM_SYSCOMMAND
                | WM_ENTERSIZEMOVE
                | WM_EXITSIZEMOVE
                | WM_CAPTURECHANGED
        )
    }

    fn window_message_name(message: u32) -> &'static str {
        match message {
            WM_KEYDOWN => "WM_KEYDOWN",
            WM_KEYUP => "WM_KEYUP",
            WM_SYSKEYDOWN => "WM_SYSKEYDOWN",
            WM_SYSKEYUP => "WM_SYSKEYUP",
            WM_MOUSEMOVE => "WM_MOUSEMOVE",
            WM_LBUTTONDOWN => "WM_LBUTTONDOWN",
            WM_LBUTTONUP => "WM_LBUTTONUP",
            WM_CLOSE => "WM_CLOSE",
            WM_SETFOCUS => "WM_SETFOCUS",
            WM_KILLFOCUS => "WM_KILLFOCUS",
            WM_ACTIVATE => "WM_ACTIVATE",
            WM_ACTIVATEAPP => "WM_ACTIVATEAPP",
            WM_MOUSEACTIVATE => "WM_MOUSEACTIVATE",
            WM_COMMAND => "WM_COMMAND",
            WM_NCHITTEST => "WM_NCHITTEST",
            WM_NCLBUTTONDOWN => "WM_NCLBUTTONDOWN",
            WM_NCLBUTTONUP => "WM_NCLBUTTONUP",
            WM_SYSCOMMAND => "WM_SYSCOMMAND",
            WM_ENTERSIZEMOVE => "WM_ENTERSIZEMOVE",
            WM_EXITSIZEMOVE => "WM_EXITSIZEMOVE",
            WM_CAPTURECHANGED => "WM_CAPTURECHANGED",
            _ => "other",
        }
    }

    fn window_rect_json(rect: RECT) -> serde_json::Value {
        json!({
            "left": rect.left,
            "top": rect.top,
            "right": rect.right,
            "bottom": rect.bottom,
            "width": (rect.right - rect.left).max(0),
            "height": (rect.bottom - rect.top).max(0),
        })
    }

    fn hwnd_hex(hwnd: HWND) -> String {
        format!("0x{:X}", hwnd as usize)
    }

    fn now_ms() -> u64 {
        SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map(|duration| duration.as_millis().min(u128::from(u64::MAX)) as u64)
            .unwrap_or(0)
    }

    unsafe fn modifier_key_down(virtual_keys: &[i32]) -> bool {
        virtual_keys
            .iter()
            .any(|virtual_key| async_key_state(*virtual_key) & 0x8000 != 0)
    }

    unsafe fn lock_key_toggled(virtual_key: i32) -> bool {
        GetKeyState(virtual_key) as u16 & 0x0001 != 0
    }

    fn minimum_menu_dpi(scale: f64) -> Result<u32, Error> {
        if !scale.is_finite() || !(1.0..=4.0).contains(&scale) {
            return Err(Error::from_reason(
                "Native overlay host minimum menu scale must be between 1 and 4",
            ));
        }
        Ok((scale * 96.0).round().clamp(96.0, 384.0) as u32)
    }

    fn menu_text_without_mnemonics(label: &str) -> Vec<u16> {
        let mut text = String::with_capacity(label.len());
        let mut characters = label.chars().peekable();
        while let Some(character) = characters.next() {
            if character == '&' {
                if characters.peek() == Some(&'&') {
                    text.push('&');
                    characters.next();
                }
                continue;
            }
            text.push(character);
        }
        text.encode_utf16().collect()
    }

    fn register_menu_draw_item(item: NativeMenuDrawItem) -> usize {
        let mut accessible_text = if item.separator {
            Vec::new().into_boxed_slice()
        } else {
            let mut text = item.measure_label.clone();
            text.push(0);
            text.into_boxed_slice()
        };
        let mut data = Box::new(NativeMenuOwnerDrawData {
            msaa: MSAAMENUINFO {
                dwMSAASignature: MSAA_MENU_SIG as u32,
                cchWText: accessible_text.len().saturating_sub(1) as u32,
                pszWText: if accessible_text.is_empty() {
                    ptr::null_mut()
                } else {
                    accessible_text.as_mut_ptr()
                },
            },
            draw: item,
            _accessible_text: accessible_text,
        });
        let token = ptr::addr_of_mut!(data.msaa) as usize;
        MENU_DRAW_ITEMS
            .lock()
            .expect("Steam overlay menu draw item lock poisoned")
            .insert(token, data);
        token
    }

    fn unregister_menu_draw_items(tokens: &[usize]) {
        if tokens.is_empty() {
            return;
        }
        let mut items = MENU_DRAW_ITEMS
            .lock()
            .expect("Steam overlay menu draw item lock poisoned");
        for token in tokens {
            items.remove(token);
        }
    }

    fn read_menu_draw_item(token: usize) -> Option<NativeMenuDrawItem> {
        MENU_DRAW_ITEMS
            .lock()
            .ok()?
            .get(&token)
            .map(|data| data.draw.clone())
    }

    unsafe fn build_native_menu(
        items: &[NativeMenuItem],
        popup: bool,
        minimum_dpi: Option<u32>,
        draw_tokens: &mut Vec<usize>,
    ) -> Result<HMENU, Error> {
        let menu = if popup {
            CreatePopupMenu()
        } else {
            CreateMenu()
        };
        if menu.is_null() {
            return Err(Error::from_reason(
                "Failed to create the native overlay host menu",
            ));
        }

        for (position, item) in items.iter().enumerate() {
            if !item.separator && item.label.is_empty() {
                DestroyMenu(menu);
                return Err(Error::from_reason(
                    "Native overlay host menu labels cannot be empty",
                ));
            }
            if let Some(minimum_dpi) = minimum_dpi {
                let submenu = if item.items.is_empty() {
                    None
                } else {
                    match build_native_menu(&item.items, true, Some(minimum_dpi), draw_tokens) {
                        Ok(submenu) => Some(submenu),
                        Err(error) => {
                            DestroyMenu(menu);
                            return Err(error);
                        }
                    }
                };
                let label = item.label.encode_utf16().collect::<Vec<_>>();
                let token = register_menu_draw_item(NativeMenuDrawItem {
                    measure_label: menu_text_without_mnemonics(&item.label),
                    label,
                    top_level: !popup,
                    submenu: submenu.is_some(),
                    separator: item.separator,
                    minimum_dpi,
                });
                draw_tokens.push(token);
                let mut info: MENUITEMINFOW = mem::zeroed();
                info.cbSize = mem::size_of::<MENUITEMINFOW>() as u32;
                info.fMask = MIIM_FTYPE | MIIM_STATE | MIIM_DATA;
                info.fType = MFT_OWNERDRAW | if item.separator { MFT_SEPARATOR } else { 0 };
                info.fState = if item.enabled {
                    MFS_ENABLED
                } else {
                    MFS_DISABLED
                };
                info.dwItemData = token;
                let submenu_handle = submenu.unwrap_or(ptr::null_mut());
                if !submenu_handle.is_null() {
                    info.fMask |= MIIM_SUBMENU;
                    info.hSubMenu = submenu_handle;
                } else if !item.separator {
                    let Some(command_id) = item
                        .command_id
                        .filter(|value| (1..=u16::MAX as u32).contains(value))
                    else {
                        DestroyMenu(menu);
                        return Err(Error::from_reason(
                            "Native overlay host menu command IDs must be between 1 and 65535",
                        ));
                    };
                    info.fMask |= MIIM_ID;
                    info.wID = command_id;
                }
                if !item.separator {
                    let mut accessible_label = wide_string(&item.label);
                    info.fMask |= MIIM_STRING;
                    info.dwTypeData = accessible_label.as_mut_ptr();
                    info.cch = accessible_label.len().saturating_sub(1) as u32;
                    if InsertMenuItemW(menu, position as u32, 1, &info) == 0 {
                        if !submenu_handle.is_null() {
                            DestroyMenu(submenu_handle);
                        }
                        DestroyMenu(menu);
                        return Err(Error::from_reason(
                            "Failed to append an owner-drawn native overlay host menu item",
                        ));
                    }
                } else if InsertMenuItemW(menu, position as u32, 1, &info) == 0 {
                    if !submenu_handle.is_null() {
                        DestroyMenu(submenu_handle);
                    }
                    DestroyMenu(menu);
                    return Err(Error::from_reason(
                        "Failed to append an owner-drawn native overlay host menu item",
                    ));
                }
                continue;
            }

            if item.separator {
                if AppendMenuW(menu, MF_SEPARATOR, 0, ptr::null()) == 0 {
                    DestroyMenu(menu);
                    return Err(Error::from_reason(
                        "Failed to append a native overlay host menu separator",
                    ));
                }
                continue;
            }
            let label = wide_string(&item.label);
            let enabled_flag = if item.enabled { 0 } else { MF_GRAYED };
            if !item.items.is_empty() {
                let submenu = match build_native_menu(&item.items, true, None, draw_tokens) {
                    Ok(submenu) => submenu,
                    Err(error) => {
                        DestroyMenu(menu);
                        return Err(error);
                    }
                };
                if AppendMenuW(
                    menu,
                    MF_STRING | MF_POPUP | enabled_flag,
                    submenu as usize,
                    label.as_ptr(),
                ) == 0
                {
                    DestroyMenu(submenu);
                    DestroyMenu(menu);
                    return Err(Error::from_reason(
                        "Failed to append a native overlay host submenu",
                    ));
                }
                continue;
            }

            let Some(command_id) = item
                .command_id
                .filter(|value| (1..=u16::MAX as u32).contains(value))
            else {
                DestroyMenu(menu);
                return Err(Error::from_reason(
                    "Native overlay host menu command IDs must be between 1 and 65535",
                ));
            };
            if AppendMenuW(
                menu,
                MF_STRING | enabled_flag,
                command_id as usize,
                label.as_ptr(),
            ) == 0
            {
                DestroyMenu(menu);
                return Err(Error::from_reason(
                    "Failed to append a native overlay host menu command",
                ));
            }
        }
        Ok(menu)
    }

    unsafe fn set_window_menu_attached(surface: &NativeSurface, attached: bool) -> bool {
        let menu = if attached {
            surface.menu.unwrap_or(ptr::null_mut())
        } else {
            ptr::null_mut()
        };
        if GetMenu(surface.hwnd) == menu {
            return true;
        }
        SetMenu(surface.hwnd, menu) != 0 && DrawMenuBar(surface.hwnd) != 0
    }

    unsafe fn resize_window_for_client_size(
        hwnd: HWND,
        x: i32,
        y: i32,
        client_width: i32,
        client_height: i32,
    ) -> Result<(), Error> {
        let window_dpi = GetDpiForWindow(hwnd);
        let dpi = if window_dpi == 0 {
            GetDpiForSystem().max(96)
        } else {
            window_dpi.max(96)
        };
        let mut adjusted = RECT {
            left: 0,
            top: 0,
            right: client_width.max(1),
            bottom: client_height.max(1),
        };
        let style = GetWindowLongPtrW(hwnd, GWL_STYLE) as u32;
        let ex_style = GetWindowLongPtrW(hwnd, GWL_EXSTYLE) as u32;
        let has_menu = i32::from(!GetMenu(hwnd).is_null());
        if AdjustWindowRectExForDpi(&mut adjusted, style, has_menu, ex_style, dpi) == 0 {
            return Err(Error::from_reason(
                "Failed to preserve the native overlay host client size after changing its menu",
            ));
        }
        let mut window_width = (adjusted.right - adjusted.left).max(1);
        let mut window_height = (adjusted.bottom - adjusted.top).max(1);
        for _ in 0..3 {
            if SetWindowPos(
                hwnd,
                ptr::null_mut(),
                x,
                y,
                window_width,
                window_height,
                SWP_NOACTIVATE | SWP_NOOWNERZORDER | SWP_NOZORDER | SWP_FRAMECHANGED,
            ) == 0
            {
                return Err(Error::from_reason(
                    "Failed to preserve the native overlay host client size after changing its menu",
                ));
            }
            let Some(client) = read_client_rect(hwnd) else {
                break;
            };
            let actual_width = (client.right - client.left).max(1);
            let actual_height = (client.bottom - client.top).max(1);
            let width_delta = client_width.max(1) - actual_width;
            let height_delta = client_height.max(1) - actual_height;
            if width_delta == 0 && height_delta == 0 {
                return Ok(());
            }
            window_width = (window_width + width_delta).max(1);
            window_height = (window_height + height_delta).max(1);
        }
        let client = read_client_rect(hwnd).ok_or_else(|| {
            Error::from_reason("Failed to verify the native overlay host client size")
        })?;
        if (client.right - client.left).max(1) != client_width.max(1)
            || (client.bottom - client.top).max(1) != client_height.max(1)
        {
            return Err(Error::from_reason(
                "Native overlay host client size did not stabilize after changing its menu",
            ));
        }
        Ok(())
    }

    fn logical_pixels_to_physical(value: i32, dpi: u32) -> i32 {
        let scaled = (i64::from(value.max(1)) * i64::from(dpi.max(96)) + 48) / 96;
        scaled.clamp(1, i64::from(i32::MAX)) as i32
    }

    fn physical_pixels_to_logical(value: i32, dpi: u32) -> i32 {
        let dpi = dpi.max(96);
        let scaled = (i64::from(value.max(1)) * 96 + i64::from(dpi / 2)) / i64::from(dpi);
        scaled.clamp(1, i64::from(i32::MAX)) as i32
    }

    fn clamp_client_size_to_minimum(
        client_size: Option<(i32, i32)>,
        min_client_size: Option<(i32, i32)>,
    ) -> Option<(i32, i32)> {
        match (client_size, min_client_size) {
            (Some((width, height)), Some((min_width, min_height))) => {
                Some((width.max(min_width), height.max(min_height)))
            }
            (None, Some(minimum)) => Some(minimum),
            (client_size, _) => client_size,
        }
    }

    fn set_standalone_min_client_size(size: Option<(i32, i32)>) {
        let packed = size.map_or(0, |(width, height)| {
            ((width.max(1) as u64) << 32) | height.max(1) as u32 as u64
        });
        STANDALONE_MIN_CLIENT_SIZE.store(packed, Ordering::Relaxed);
    }

    fn standalone_min_client_size() -> Option<(i32, i32)> {
        let packed = STANDALONE_MIN_CLIENT_SIZE.load(Ordering::Relaxed);
        if packed == 0 {
            return None;
        }
        Some(((packed >> 32) as u32 as i32, packed as u32 as i32))
    }

    fn set_standalone_logical_client_size(size: Option<(i32, i32)>) {
        let packed = size.map_or(0, |(width, height)| {
            ((width.max(1) as u64) << 32) | height.max(1) as u32 as u64
        });
        STANDALONE_LOGICAL_CLIENT_SIZE.store(packed, Ordering::Relaxed);
    }

    fn standalone_logical_client_size() -> Option<(i32, i32)> {
        let packed = STANDALONE_LOGICAL_CLIENT_SIZE.load(Ordering::Relaxed);
        if packed == 0 {
            return None;
        }
        Some(((packed >> 32) as u32 as i32, packed as u32 as i32))
    }

    unsafe fn remember_standalone_logical_client_size(hwnd: HWND) {
        let style = GetWindowLongPtrW(hwnd, GWL_STYLE) as u32;
        if style & WS_OVERLAPPEDWINDOW == 0 || IsIconic(hwnd) != 0 || IsZoomed(hwnd) != 0 {
            return;
        }
        let dpi = GetDpiForWindow(hwnd).max(96);
        if let Some(client) = read_client_rect(hwnd) {
            set_standalone_logical_client_size(Some((
                physical_pixels_to_logical((client.right - client.left).max(1), dpi),
                physical_pixels_to_logical((client.bottom - client.top).max(1), dpi),
            )));
        }
    }

    unsafe fn minimum_window_track_size(hwnd: HWND) -> Option<(i32, i32)> {
        let (client_width, client_height) = standalone_min_client_size()?;
        let window_dpi = GetDpiForWindow(hwnd);
        let dpi = if window_dpi == 0 {
            GetDpiForSystem().max(96)
        } else {
            window_dpi.max(96)
        };
        let target_client_width = logical_pixels_to_physical(client_width, dpi);
        let target_client_height = logical_pixels_to_physical(client_height, dpi);
        if let (Some(window), Some(client)) = (read_window_rect(hwnd), read_client_rect(hwnd)) {
            let non_client_width =
                ((window.right - window.left) - (client.right - client.left)).max(0);
            let non_client_height =
                ((window.bottom - window.top) - (client.bottom - client.top)).max(0);
            return Some((
                target_client_width.saturating_add(non_client_width).max(1),
                target_client_height
                    .saturating_add(non_client_height)
                    .max(1),
            ));
        }
        let mut adjusted = RECT {
            left: 0,
            top: 0,
            right: target_client_width,
            bottom: target_client_height,
        };
        let style = GetWindowLongPtrW(hwnd, GWL_STYLE) as u32;
        let ex_style = GetWindowLongPtrW(hwnd, GWL_EXSTYLE) as u32;
        let has_menu = i32::from(!GetMenu(hwnd).is_null());
        if AdjustWindowRectExForDpi(&mut adjusted, style, has_menu, ex_style, dpi) == 0 {
            return None;
        }
        Some((
            (adjusted.right - adjusted.left).max(1),
            (adjusted.bottom - adjusted.top).max(1),
        ))
    }

    unsafe fn reconcile_standalone_window_with_work_area(hwnd: HWND) {
        let style = GetWindowLongPtrW(hwnd, GWL_STYLE) as u32;
        if style & WS_OVERLAPPEDWINDOW == 0 || IsIconic(hwnd) != 0 || IsZoomed(hwnd) != 0 {
            return;
        }
        let Some(current) = read_window_rect(hwnd) else {
            return;
        };
        let monitor = MonitorFromWindow(hwnd, MONITOR_DEFAULTTONEAREST);
        let mut monitor_info: MONITORINFO = mem::zeroed();
        monitor_info.cbSize = mem::size_of::<MONITORINFO>() as u32;
        if monitor.is_null() || GetMonitorInfoW(monitor, &mut monitor_info) == 0 {
            return;
        }
        let work = monitor_info.rcWork;
        let work_width = rect_width(work);
        let work_height = rect_height(work);
        let current_outside = current.left < work.left
            || current.top < work.top
            || current.right > work.right
            || current.bottom > work.bottom;
        let was_clamped = STANDALONE_DISPLAY_CLAMPED.load(Ordering::Relaxed);
        if !current_outside && !was_clamped {
            return;
        }

        let dpi = GetDpiForWindow(hwnd).max(96);
        let (logical_width, logical_height) =
            standalone_logical_client_size().unwrap_or_else(|| {
                let client = read_client_rect(hwnd).unwrap_or(RECT {
                    left: 0,
                    top: 0,
                    right: rect_width(current),
                    bottom: rect_height(current),
                });
                (
                    physical_pixels_to_logical(rect_width(client), dpi),
                    physical_pixels_to_logical(rect_height(client), dpi),
                )
            });
        let mut desired = RECT {
            left: 0,
            top: 0,
            right: logical_pixels_to_physical(logical_width, dpi),
            bottom: logical_pixels_to_physical(logical_height, dpi),
        };
        let ex_style = GetWindowLongPtrW(hwnd, GWL_EXSTYLE) as u32;
        let has_menu = i32::from(!GetMenu(hwnd).is_null());
        if AdjustWindowRectExForDpi(&mut desired, style, has_menu, ex_style, dpi) == 0 {
            return;
        }
        let desired_width = rect_width(desired);
        let desired_height = rect_height(desired);
        let should_clamp = desired_width > work_width || desired_height > work_height;
        let (x, y, width, height) = centered_window_rect(desired_width, desired_height, &work);
        if SetWindowPos(
            hwnd,
            ptr::null_mut(),
            x,
            y,
            width,
            height,
            SWP_NOACTIVATE | SWP_NOOWNERZORDER | SWP_NOZORDER | SWP_FRAMECHANGED,
        ) != 0
        {
            STANDALONE_DISPLAY_CLAMPED.store(should_clamp, Ordering::Relaxed);
        }
    }

    unsafe fn primary_work_area() -> RECT {
        let mut work_area: RECT = mem::zeroed();
        if SystemParametersInfoW(
            SPI_GETWORKAREA,
            0,
            &mut work_area as *mut RECT as *mut std::ffi::c_void,
            0,
        ) != 0
            && work_area.right > work_area.left
            && work_area.bottom > work_area.top
        {
            return work_area;
        }
        RECT {
            left: 0,
            top: 0,
            right: GetSystemMetrics(SM_CXSCREEN).max(1),
            bottom: GetSystemMetrics(SM_CYSCREEN).max(1),
        }
    }

    fn centered_window_rect(width: i32, height: i32, work_area: &RECT) -> (i32, i32, i32, i32) {
        let work_width = (work_area.right - work_area.left).max(1);
        let work_height = (work_area.bottom - work_area.top).max(1);
        let width = width.max(1).min(work_width);
        let height = height.max(1).min(work_height);
        (
            work_area.left + (work_width - width) / 2,
            work_area.top + (work_height - height) / 2,
            width,
            height,
        )
    }

    #[cfg(test)]
    #[allow(clippy::items_after_test_module)]
    mod tests {
        use super::{
            centered_window_rect, clamp_client_size_to_minimum, logical_pixels_to_physical,
            menu_text_without_mnemonics, minimum_menu_dpi, normalize_windows_display_refresh_rate,
            physical_pixels_to_logical, set_standalone_logical_client_size,
            set_standalone_min_client_size, standalone_logical_client_size,
            standalone_min_client_size, RECT,
        };

        #[test]
        fn windows_display_refresh_rejects_driver_default_sentinels() {
            assert_eq!(normalize_windows_display_refresh_rate(0), None);
            assert_eq!(normalize_windows_display_refresh_rate(1), None);
            assert_eq!(normalize_windows_display_refresh_rate(60), Some(60));
            assert_eq!(normalize_windows_display_refresh_rate(200), Some(200));
        }

        #[test]
        fn standalone_client_dimensions_scale_from_logical_pixels() {
            assert_eq!(logical_pixels_to_physical(1024, 96), 1024);
            assert_eq!(logical_pixels_to_physical(1024, 216), 2304);
            assert_eq!(logical_pixels_to_physical(768, 216), 1728);
            assert_eq!(logical_pixels_to_physical(1, 120), 1);
            assert_eq!(physical_pixels_to_logical(2304, 216), 1024);
            assert_eq!(physical_pixels_to_logical(1728, 216), 768);
        }

        #[test]
        fn standalone_minimum_client_dimensions_round_trip_atomically() {
            set_standalone_min_client_size(Some((640, 480)));
            assert_eq!(standalone_min_client_size(), Some((640, 480)));
            set_standalone_min_client_size(None);
            assert_eq!(standalone_min_client_size(), None);
        }

        #[test]
        fn standalone_logical_client_dimensions_round_trip_atomically() {
            set_standalone_logical_client_size(Some((1280, 720)));
            assert_eq!(standalone_logical_client_size(), Some((1280, 720)));
            set_standalone_logical_client_size(None);
            assert_eq!(standalone_logical_client_size(), None);
        }

        #[test]
        fn standalone_initial_client_size_respects_its_minimum() {
            assert_eq!(
                clamp_client_size_to_minimum(Some((320, 700)), Some((640, 480))),
                Some((640, 700))
            );
            assert_eq!(
                clamp_client_size_to_minimum(Some((1280, 720)), Some((640, 480))),
                Some((1280, 720))
            );
            assert_eq!(
                clamp_client_size_to_minimum(Some((320, 240)), None),
                Some((320, 240))
            );
            assert_eq!(
                clamp_client_size_to_minimum(None, Some((640, 480))),
                Some((640, 480))
            );
        }

        #[test]
        fn standalone_window_is_centered_and_clamped_to_the_work_area() {
            let work_area = RECT {
                left: 0,
                top: 0,
                right: 1920,
                bottom: 1040,
            };
            assert_eq!(
                centered_window_rect(1280, 760, &work_area),
                (320, 140, 1280, 760)
            );
            assert_eq!(
                centered_window_rect(2300, 1200, &work_area),
                (0, 0, 1920, 1040)
            );
        }

        #[test]
        fn standalone_menu_scale_is_a_bounded_dpi_floor() {
            assert_eq!(minimum_menu_dpi(1.0).unwrap(), 96);
            assert_eq!(minimum_menu_dpi(1.25).unwrap(), 120);
            assert_eq!(minimum_menu_dpi(1.5).unwrap(), 144);
            assert!(minimum_menu_dpi(0.99).is_err());
            assert!(minimum_menu_dpi(4.01).is_err());
        }

        #[test]
        fn owner_drawn_menu_measurement_ignores_mnemonic_markers() {
            assert_eq!(
                String::from_utf16(&menu_text_without_mnemonics("&File")).unwrap(),
                "File"
            );
            assert_eq!(
                String::from_utf16(&menu_text_without_mnemonics("Save && E&xit\tAlt+F4")).unwrap(),
                "Save & Exit\tAlt+F4"
            );
        }
    }

    fn window_class_name() -> Vec<u16> {
        wide_string("SteamBridgeNativeOverlayWindow")
    }

    fn wide_string(value: &str) -> Vec<u16> {
        value.encode_utf16().chain(std::iter::once(0)).collect()
    }
}

#[cfg(target_os = "windows")]
pub use windows::*;

#[cfg(target_os = "linux")]
mod linux {
    use super::{
        checked_native_overlay_frame_byte_len, input_shape_readback_matches,
        x11_attached_child_bounds, x11_cardinal32_readback_matches, xrandr_mode_refresh_rate,
        Buffer, ConfigureNotifyCoalescer, Error,
    };
    use libloading::Library;
    use once_cell::sync::Lazy;
    use serde::Serialize;
    use serde_json::json;
    use std::ffi::{c_void, CString};
    use std::mem;
    use std::os::fd::{BorrowedFd, IntoRawFd};
    use std::os::raw::{c_int, c_long, c_uchar, c_uint, c_ulong};
    use std::ptr;
    use std::sync::atomic::{AtomicI32, AtomicUsize, Ordering};
    use std::sync::Mutex;
    use std::time::{Duration, Instant, SystemTime, UNIX_EPOCH};
    use x11_dl::{glx, keysym, xfixes, xlib, xrandr};

    pub fn ensure_main_thread() -> Result<(), Error> {
        Ok(())
    }

    const SHAPE_BOUNDING: c_int = 0;
    const SHAPE_CLIP: c_int = 1;
    const SHAPE_INPUT: c_int = 2;
    const WINDOWED_BOTTOM_CORNER_RADIUS: u32 = 8;
    const STANDALONE_HOST_ACTIVATION_TIMEOUT: Duration = Duration::from_millis(250);
    const STANDALONE_HOST_ACTIVATION_MAX_PUMP_OBSERVATIONS: u8 = 8;
    const STANDALONE_HOST_FOCUS_CONFIRMATION_OBSERVATIONS: u8 = 2;

    struct LinuxFrameUpload {
        width: c_int,
        height: c_int,
        data: Vec<u8>,
    }

    struct LinuxFrameRenderer {
        program: gl::types::GLuint,
        flip_frame_y_uniform: gl::types::GLint,
        vertex_array: gl::types::GLuint,
        texture: gl::types::GLuint,
        texture_width: c_int,
        texture_height: c_int,
    }

    const DRM_FORMAT_MOD_LINEAR: u64 = 0;
    const CHROMIUM_NO_DRM_MODIFIER: u64 = 0x00ff_ffff_ffff_ffff;

    fn supports_dri3_pixmap_modifier(modifier: u64) -> bool {
        modifier == DRM_FORMAT_MOD_LINEAR
            || modifier == CHROMIUM_NO_DRM_MODIFIER
            || modifier == u64::MAX
    }

    #[repr(C)]
    #[derive(Clone, Copy)]
    struct XcbVoidCookie {
        sequence: c_uint,
    }

    type XGetXcbConnection = unsafe extern "C" fn(*mut xlib::Display) -> *mut c_void;
    type XcbGenerateId = unsafe extern "C" fn(*mut c_void) -> c_uint;
    type XcbFlush = unsafe extern "C" fn(*mut c_void) -> c_int;
    type XcbRequestCheck = unsafe extern "C" fn(*mut c_void, XcbVoidCookie) -> *mut c_void;
    type XcbFreePixmapChecked = unsafe extern "C" fn(*mut c_void, c_uint) -> XcbVoidCookie;
    type XcbDri3PixmapFromBufferChecked = unsafe extern "C" fn(
        *mut c_void,
        c_uint,
        c_uint,
        c_uint,
        u16,
        u16,
        u16,
        u8,
        u8,
        i32,
    ) -> XcbVoidCookie;
    type GlXChooseFbConfig = unsafe extern "C" fn(
        *mut xlib::Display,
        c_int,
        *const c_int,
        *mut c_int,
    ) -> *mut glx::GLXFBConfig;
    type GlXGetVisualFromFbConfig =
        unsafe extern "C" fn(*mut xlib::Display, glx::GLXFBConfig) -> *mut xlib::XVisualInfo;
    type GlXGetFbConfigAttrib =
        unsafe extern "C" fn(*mut xlib::Display, glx::GLXFBConfig, c_int, *mut c_int) -> c_int;
    type GlXCreatePixmap = unsafe extern "C" fn(
        *mut xlib::Display,
        glx::GLXFBConfig,
        xlib::Pixmap,
        *const c_int,
    ) -> glx::GLXPixmap;
    type GlXDestroyPixmap = unsafe extern "C" fn(*mut xlib::Display, glx::GLXPixmap);
    type GlXBindTexImageExt =
        unsafe extern "C" fn(*mut xlib::Display, glx::GLXDrawable, c_int, *const c_int);
    type GlXReleaseTexImageExt = unsafe extern "C" fn(*mut xlib::Display, glx::GLXDrawable, c_int);

    const GLX_DRAWABLE_TYPE: c_int = 0x8010;
    const GLX_RENDER_TYPE: c_int = 0x8011;
    const GLX_X_RENDERABLE: c_int = 0x8012;
    const GLX_RGBA_BIT: c_int = 0x0001;
    const GLX_PIXMAP_BIT: c_int = 0x0002;
    const GLX_BIND_TO_TEXTURE_RGBA_EXT: c_int = 0x20D1;
    const GLX_BIND_TO_TEXTURE_TARGETS_EXT: c_int = 0x20D3;
    const GLX_Y_INVERTED_EXT: c_int = 0x20D4;
    const GLX_TEXTURE_2D_BIT_EXT: c_int = 0x0002;
    const GLX_TEXTURE_FORMAT_EXT: c_int = 0x20D5;
    const GLX_TEXTURE_TARGET_EXT: c_int = 0x20D6;
    const GLX_TEXTURE_FORMAT_RGBA_EXT: c_int = 0x20DA;
    const GLX_TEXTURE_2D_EXT: c_int = 0x20DC;
    const GLX_FRONT_LEFT_EXT: c_int = 0x20DE;

    struct Dri3DmaBufImporter {
        _x11_xcb_library: Library,
        _xcb_library: Library,
        _xcb_dri3_library: Library,
        connection: *mut c_void,
        root: c_uint,
        fb_config: glx::GLXFBConfig,
        y_inverted: bool,
        generate_id: XcbGenerateId,
        flush: XcbFlush,
        request_check: XcbRequestCheck,
        free_pixmap_checked: XcbFreePixmapChecked,
        pixmap_from_buffer_checked: XcbDri3PixmapFromBufferChecked,
        create_pixmap: GlXCreatePixmap,
        destroy_pixmap: GlXDestroyPixmap,
        bind_tex_image: GlXBindTexImageExt,
        release_tex_image: GlXReleaseTexImageExt,
    }

    type GlXChooseVisual =
        unsafe extern "C" fn(*mut xlib::Display, c_int, *mut c_int) -> *mut xlib::XVisualInfo;
    type GlXCreateContext = unsafe extern "C" fn(
        *mut xlib::Display,
        *mut xlib::XVisualInfo,
        glx::GLXContext,
        c_int,
    ) -> glx::GLXContext;
    type GlXDestroyContext = unsafe extern "C" fn(*mut xlib::Display, glx::GLXContext);
    type GlXMakeCurrent =
        unsafe extern "C" fn(*mut xlib::Display, c_ulong, glx::GLXContext) -> c_int;
    type GlXSwapBuffers = unsafe extern "C" fn(*mut xlib::Display, c_ulong);
    type GlXGetProcAddress = unsafe extern "C" fn(*const c_uchar) -> Option<unsafe extern "C" fn()>;
    type GlXSwapIntervalExt = unsafe extern "C" fn(*mut xlib::Display, c_ulong, c_int);
    type GlXSwapIntervalMesa = unsafe extern "C" fn(c_uint) -> c_int;
    type GlXSwapIntervalSgi = unsafe extern "C" fn(c_int) -> c_int;

    type XPending = unsafe extern "C" fn(*mut xlib::Display) -> c_int;
    type XNextEvent = unsafe extern "C" fn(*mut xlib::Display, *mut xlib::XEvent) -> c_int;

    #[derive(Clone, Copy)]
    struct XlibDispatch {
        pending: XPending,
        next_event: XNextEvent,
        pending_interposed: bool,
        next_event_interposed: bool,
    }

    #[derive(Clone, Copy)]
    struct GlxDispatch {
        choose_visual: GlXChooseVisual,
        create_context: GlXCreateContext,
        destroy_context: GlXDestroyContext,
        make_current: GlXMakeCurrent,
        swap_buffers: GlXSwapBuffers,
        get_proc_address: GlXGetProcAddress,
        choose_visual_interposed: bool,
        create_context_interposed: bool,
        destroy_context_interposed: bool,
        make_current_interposed: bool,
        swap_buffers_interposed: bool,
        get_proc_address_interposed: bool,
    }

    type X11ErrorHandler =
        unsafe extern "C" fn(*mut xlib::Display, *mut xlib::XErrorEvent) -> c_int;

    static X11_ERROR_TRAP_LOCK: Lazy<Mutex<()>> = Lazy::new(|| Mutex::new(()));
    static X11_ERROR_TRAP_DISPLAY: AtomicUsize = AtomicUsize::new(0);
    static X11_ERROR_TRAP_CODE: AtomicI32 = AtomicI32::new(0);
    static X11_ERROR_TRAP_PREVIOUS: AtomicUsize = AtomicUsize::new(0);

    type XShapeQueryExtension =
        unsafe extern "C" fn(*mut xlib::Display, *mut c_int, *mut c_int) -> xlib::Bool;
    type XShapeQueryVersion =
        unsafe extern "C" fn(*mut xlib::Display, *mut c_int, *mut c_int) -> xlib::Status;
    type XShapeGetRectangles = unsafe extern "C" fn(
        *mut xlib::Display,
        xlib::Window,
        c_int,
        *mut c_int,
        *mut c_int,
    ) -> *mut xlib::XRectangle;

    struct XShapeLibrary {
        _library: Library,
        query_extension: XShapeQueryExtension,
        query_version: XShapeQueryVersion,
        get_rectangles: XShapeGetRectangles,
    }

    impl XShapeLibrary {
        unsafe fn open() -> Result<Self, Error> {
            let library = Library::new("libXext.so.6")
                .or_else(|_| Library::new("libXext.so"))
                .map_err(|error| {
                    Error::from_reason(format!(
                        "Failed to load Xext for Linux standalone overlay input safety: {error}"
                    ))
                })?;
            let query_extension = *library
                .get::<XShapeQueryExtension>(b"XShapeQueryExtension\0")
                .map_err(|error| {
                    Error::from_reason(format!(
                        "Failed to load XShapeQueryExtension for Linux standalone overlay input safety: {error}"
                    ))
                })?;
            let query_version = *library
                .get::<XShapeQueryVersion>(b"XShapeQueryVersion\0")
                .map_err(|error| {
                    Error::from_reason(format!(
                        "Failed to load XShapeQueryVersion for Linux standalone overlay input safety: {error}"
                    ))
                })?;
            let get_rectangles = *library
                .get::<XShapeGetRectangles>(b"XShapeGetRectangles\0")
                .map_err(|error| {
                    Error::from_reason(format!(
                        "Failed to load XShapeGetRectangles for Linux standalone overlay input safety: {error}"
                    ))
                })?;
            Ok(Self {
                _library: library,
                query_extension,
                query_version,
                get_rectangles,
            })
        }

        unsafe fn supports_input_shape(&self, display: *mut xlib::Display) -> bool {
            let mut event_base = 0;
            let mut error_base = 0;
            if (self.query_extension)(display, &mut event_base, &mut error_base) == 0 {
                return false;
            }
            let mut major = 0;
            let mut minor = 0;
            (self.query_version)(display, &mut major, &mut minor) != 0
                && (major > 1 || (major == 1 && minor >= 1))
        }
    }

    struct StandaloneHostActivationRequest {
        generation: u64,
        deadline: Instant,
        remaining_pump_observations: u8,
        sent: bool,
    }

    struct StandaloneHostInputCommit {
        generation: u64,
        deadline: Instant,
        remaining_pump_observations: u8,
        consecutive_focus_observations: u8,
    }

    struct NativeSurface {
        xlib: xlib::Xlib,
        xlib_dispatch: XlibDispatch,
        _glx: glx::Glx,
        glx_dispatch: GlxDispatch,
        xfixes: Option<xfixes::Xlib>,
        xshape: Option<XShapeLibrary>,
        xrandr: Option<xrandr::Xrandr>,
        display: *mut xlib::Display,
        window: xlib::Window,
        parent_window: Option<xlib::Window>,
        managed_host: bool,
        application_host: bool,
        wm_protocols_atom: xlib::Atom,
        wm_delete_window_atom: xlib::Atom,
        opacity_atom: xlib::Atom,
        colormap: xlib::Colormap,
        context: glx::GLXContext,
        swap_interval_control: &'static str,
        frame: u64,
        input_passthrough: bool,
        opaque: bool,
        cursor_hidden: bool,
        full_screen: bool,
        configure_count: u64,
        viewport_width: c_uint,
        viewport_height: c_uint,
        overlay_active: bool,
        activation_generation: u64,
        input_activation_prepared: bool,
        input_activation_commit: Option<StandaloneHostInputCommit>,
        activation_commit_failed: bool,
        activation_commit_failure_count: u64,
        activation_request: Option<StandaloneHostActivationRequest>,
        activation_requested_for_input_epoch: bool,
        activation_request_count: u64,
        display_refresh_rate: Option<f64>,
        display_refresh_rate_queried_at: Instant,
        source_frame: Option<LinuxFrameUpload>,
        source_frame_dirty: bool,
        frame_renderer: Option<LinuxFrameRenderer>,
        frame_upload_count: u64,
        shared_texture_import_count: u64,
        shared_texture_import_failure_count: u64,
        dri3_dma_buf_importer: Option<Dri3DmaBufImporter>,
        frame_draw_count: u64,
    }

    #[derive(Clone, Serialize)]
    #[serde(rename_all = "camelCase")]
    struct LinuxInputEvent {
        kind: &'static str,
        captured_at_ms: u64,
        message: u32,
        wparam: u64,
        lparam: i64,
        shift: bool,
        control: bool,
        alt: bool,
        x: Option<i32>,
        y: Option<i32>,
        delta_y: Option<i32>,
        command_id: Option<u32>,
        client_width: i32,
        client_height: i32,
        minimized: bool,
    }

    unsafe impl Send for NativeSurface {}

    static SURFACE: Lazy<Mutex<Option<NativeSurface>>> = Lazy::new(|| Mutex::new(None));
    static LINUX_INPUT_EVENTS: Lazy<Mutex<Vec<LinuxInputEvent>>> =
        Lazy::new(|| Mutex::new(Vec::new()));

    pub fn open(
        title: Option<String>,
        client_width: Option<u32>,
        client_height: Option<u32>,
        _min_client_width: Option<u32>,
        _min_client_height: Option<u32>,
    ) -> Result<(), Error> {
        close();

        let title = title.unwrap_or_else(|| "Steam Bridge Native Overlay Probe".to_owned());
        let standalone_bounds = match (client_width, client_height) {
            (Some(width), Some(height)) if width > 0 && height > 0 => Some((0, 0, width, height)),
            _ => None,
        };
        let surface = unsafe {
            create_probe_window(
                &title,
                None,
                None,
                standalone_bounds,
                false,
                false,
                false,
                None,
            )?
        };
        *SURFACE
            .lock()
            .expect("Steam overlay native surface lock poisoned") = Some(surface);

        pump()?;
        Ok(())
    }

    pub fn open_application_host(
        title: Option<String>,
        client_width: Option<u32>,
        client_height: Option<u32>,
        min_client_width: Option<u32>,
        min_client_height: Option<u32>,
    ) -> Result<(), Error> {
        close();

        let title = title.unwrap_or_else(|| "Steam Bridge Application Host".to_owned());
        let width = client_width.unwrap_or(1280).max(1);
        let height = client_height.unwrap_or(720).max(1);
        let minimum_size = Some((
            min_client_width.unwrap_or(640).max(1),
            min_client_height.unwrap_or(480).max(1),
        ));
        let surface = unsafe {
            create_probe_window(
                &title,
                None,
                None,
                Some((0, 0, width, height)),
                true,
                false,
                true,
                minimum_size,
            )?
        };
        *SURFACE
            .lock()
            .expect("Steam overlay native surface lock poisoned") = Some(surface);

        pump()?;
        Ok(())
    }

    pub fn attach_to_parent(
        parent_handle: usize,
        initial_bounds: Option<(i32, i32, u32, u32)>,
    ) -> Result<(), Error> {
        close();

        let surface = unsafe {
            create_probe_window(
                "Steam Bridge Native Overlay",
                Some(parent_handle as xlib::Window),
                initial_bounds,
                None,
                true,
                false,
                false,
                None,
            )?
        };
        *SURFACE
            .lock()
            .expect("Steam overlay native surface lock poisoned") = Some(surface);

        pump()?;
        Ok(())
    }

    pub fn attach_to_parent_for_overlay(parent_handle: usize) -> Result<(), Error> {
        attach_to_parent(parent_handle, None)
    }

    pub fn attach_to_root(
        x: i32,
        y: i32,
        width: u32,
        height: u32,
        full_screen: bool,
    ) -> Result<(), Error> {
        close();

        let surface = unsafe {
            create_probe_window(
                "Steam Bridge Native Overlay",
                None,
                None,
                Some((x, y, width.max(1), height.max(1))),
                true,
                full_screen,
                false,
                None,
            )?
        };
        *SURFACE
            .lock()
            .expect("Steam overlay native surface lock poisoned") = Some(surface);

        pump()?;
        Ok(())
    }

    pub fn pump() -> Result<(), Error> {
        let mut guard = SURFACE
            .lock()
            .expect("Steam overlay native surface lock poisoned");
        let Some(surface) = guard.as_mut() else {
            return Ok(());
        };

        unsafe {
            let mut configure_events = ConfigureNotifyCoalescer::default();
            let mut drawable_destroyed = false;
            while (surface.xlib_dispatch.pending)(surface.display) > 0 {
                let mut event: xlib::XEvent = mem::MaybeUninit::uninit().assume_init();
                (surface.xlib_dispatch.next_event)(surface.display, &mut event);
                if event.get_type() == xlib::DestroyNotify
                    && event.destroy_window.window == surface.window
                {
                    drawable_destroyed = true;
                } else if event.get_type() == xlib::ConfigureNotify {
                    let configure = event.configure;
                    configure_events.observe(
                        surface.window as u64,
                        configure.window as u64,
                        configure.width,
                        configure.height,
                    );
                } else {
                    record_linux_input_event(surface, &event);
                }
            }

            if drawable_destroyed {
                return Err(Error::from_reason(
                    "The Electron X11 parent destroyed the native overlay child",
                ));
            }

            if (surface.glx_dispatch.make_current)(surface.display, surface.window, surface.context)
                == 0
            {
                return Err(Error::from_reason(
                    "Failed to make Linux native overlay host GLX context current",
                ));
            }
            if let Some((width, height)) = configure_events.configured_size {
                record_linux_window_changed(surface, width as i32, height as i32, false);
                gl::Viewport(0, 0, width as c_int, height as c_int);
                if surface.managed_host
                    && surface.parent_window.is_none()
                    && !surface.application_host
                {
                    apply_standalone_host_shape(
                        surface.xfixes.as_ref(),
                        surface.display,
                        surface.window,
                        width,
                        height,
                        surface.full_screen,
                    );
                }
                surface.configure_count = surface
                    .configure_count
                    .wrapping_add(configure_events.configure_count);
                surface.viewport_width = width;
                surface.viewport_height = height;
                if configure_events.configure_count > 0 {
                    surface.display_refresh_rate = surface.xrandr.as_ref().and_then(|binding| {
                        display_refresh_rate_for_window(
                            binding,
                            &surface.xlib,
                            surface.display,
                            surface.window,
                        )
                    });
                    surface.display_refresh_rate_queried_at = Instant::now();
                }
            }
            // Generic-WM activation is a short-lived best-effort aid. A WM
            // mediation failure must never tear down the GL pump or surface.
            if advance_standalone_host_activation(surface, true).is_err() {
                surface.activation_request = None;
            }
            advance_standalone_host_input_commit(surface)?;
            if surface.managed_host {
                gl::ClearColor(
                    0.0,
                    0.0,
                    0.0,
                    if surface.source_frame.is_some()
                        || surface
                            .frame_renderer
                            .as_ref()
                            .is_some_and(|renderer| renderer.texture_width > 0)
                    {
                        1.0
                    } else {
                        0.0
                    },
                );
            } else {
                let t = SystemTime::now()
                    .duration_since(UNIX_EPOCH)
                    .map(|duration| duration.as_millis() as f32 / 1000.0)
                    .unwrap_or(0.0);
                gl::ClearColor(0.015 + (t.sin() + 1.0) * 0.015, 0.02, 0.035, 1.0);
            }
            gl::Clear(gl::COLOR_BUFFER_BIT);
            draw_source_frame(surface)?;
            (surface.glx_dispatch.swap_buffers)(surface.display, surface.window);
            surface.frame = surface.frame.wrapping_add(1);
        }

        Ok(())
    }

    pub fn show() -> Result<(), Error> {
        let mut guard = SURFACE
            .lock()
            .expect("Steam overlay native surface lock poisoned");
        let surface = guard
            .as_mut()
            .ok_or_else(|| Error::from_reason("Native overlay show requires an open surface"))?;
        unsafe {
            (surface.xlib.XMapRaised)(surface.display, surface.window);
            (surface.xlib.XSync)(surface.display, xlib::False);
            // KWin redirects MapRequest for this managed top-level. XSync
            // confirms server receipt, but IsViewable may change only after
            // the compositor handles that request asynchronously.
        }
        Ok(())
    }

    pub fn hide() -> Result<(), Error> {
        let mut guard = SURFACE
            .lock()
            .expect("Steam overlay native surface lock poisoned");
        let surface = guard
            .as_mut()
            .ok_or_else(|| Error::from_reason("Native overlay hide requires an open surface"))?;
        let inert_input_result = unsafe { restore_standalone_host_inert_input(surface) };
        unsafe {
            (surface.xlib.XUnmapWindow)(surface.display, surface.window);
            (surface.xlib.XSync)(surface.display, xlib::False);
            let mut attributes: xlib::XWindowAttributes = mem::MaybeUninit::zeroed().assume_init();
            if (surface.xlib.XGetWindowAttributes)(surface.display, surface.window, &mut attributes)
                == 0
                || attributes.map_state == xlib::IsViewable
            {
                return Err(Error::from_reason(
                    "Could not confirm the native overlay surface was unmapped",
                ));
            }
        }
        inert_input_result?;
        Ok(())
    }

    pub fn prepare_activation() -> Result<(), Error> {
        let mut guard = SURFACE
            .lock()
            .expect("Steam overlay native surface lock poisoned");
        let surface = guard.as_mut().ok_or_else(|| {
            Error::from_reason("Native overlay activation requires an open managed host")
        })?;
        unsafe { prepare_standalone_host_input_activation(surface) }
    }

    pub fn commit_activation(request_window_manager_activation: bool) -> Result<(), Error> {
        let mut guard = SURFACE
            .lock()
            .expect("Steam overlay native surface lock poisoned");
        let surface = guard.as_mut().ok_or_else(|| {
            Error::from_reason("Native overlay activation requires an open managed host")
        })?;
        unsafe {
            arm_standalone_host_input_commit(surface)?;
            if request_window_manager_activation {
                arm_standalone_host_wm_activation(surface)?;
            }
        }
        Ok(())
    }

    pub fn set_input_passthrough(pass_through: bool) -> Result<(), Error> {
        let mut guard = SURFACE
            .lock()
            .expect("Steam overlay native surface lock poisoned");
        let surface = guard.as_mut().ok_or_else(|| {
            Error::from_reason("Native overlay input policy requires an open managed host")
        })?;
        if !surface.managed_host {
            return Err(Error::from_reason(
                "Native overlay input policy requires a managed host",
            ));
        }
        unsafe {
            if pass_through && surface.parent_window.is_none() {
                return restore_standalone_host_inert_input(surface);
            }
            if !pass_through && surface.parent_window.is_none() {
                return Err(Error::from_reason(
                    "Standalone native overlay input must be enabled through the deferred activation commit",
                ));
            }
            if surface.input_passthrough != pass_through {
                apply_host_input_mode(
                    &surface.xlib,
                    surface.xfixes.as_ref(),
                    surface.xshape.as_ref(),
                    surface.display,
                    surface.window,
                    pass_through,
                )?;
                surface.input_passthrough = pass_through;
            }
        }
        Ok(())
    }

    pub fn set_opaque(opaque: bool) -> Result<(), Error> {
        let mut guard = SURFACE
            .lock()
            .expect("Steam overlay native surface lock poisoned");
        let surface = guard.as_mut().ok_or_else(|| {
            Error::from_reason("Native overlay opacity policy requires an open managed host")
        })?;
        if !surface.managed_host {
            return Err(Error::from_reason(
                "Native overlay opacity policy requires a managed host",
            ));
        }
        unsafe {
            if surface.parent_window.is_none() {
                if !opaque {
                    restore_standalone_host_inert_input(surface)?;
                    // A preceding opaque=true property write can reach X11 and
                    // still fail its readback, leaving the cached flag false.
                    // Always reassert transparent for the standalone fail-safe;
                    // never skip rollback based only on that cache.
                    apply_host_opacity(
                        &surface.xlib,
                        surface.display,
                        surface.window,
                        surface.opacity_atom,
                        false,
                    )?;
                    surface.opaque = false;
                    return Ok(());
                } else if surface.opaque != opaque && !surface.input_activation_prepared {
                    return Err(Error::from_reason(
                        "Standalone native overlay opacity requires prepared focus intent",
                    ));
                }
            }
            if surface.opaque != opaque {
                apply_host_opacity(
                    &surface.xlib,
                    surface.display,
                    surface.window,
                    surface.opacity_atom,
                    opaque,
                )?;
                surface.opaque = opaque;
            }
        }
        Ok(())
    }

    pub fn set_overlay_active(active: bool) -> Result<(), Error> {
        let mut guard = SURFACE
            .lock()
            .expect("Steam overlay native surface lock poisoned");
        if let Some(surface) = guard.as_mut() {
            if !active
                && surface.managed_host
                && surface.parent_window.is_none()
                && !surface.application_host
            {
                unsafe {
                    // Preserve the visible fail-safe if empty input cannot be
                    // confirmed. The caller can unmap an uncertain host; making
                    // it transparent first could create an invisible click trap.
                    restore_standalone_host_inert_input(surface)?;
                    apply_host_opacity(
                        &surface.xlib,
                        surface.display,
                        surface.window,
                        surface.opacity_atom,
                        false,
                    )?;
                    surface.opaque = false;
                }
            }
            // Commit the intent flag only after the fallible false transition
            // is fully parked. JavaScript retains its previous applied cache
            // on error, so the native flag must retain that same value too.
            surface.overlay_active = active;
        }
        Ok(())
    }

    pub fn set_cursor_hidden(hidden: bool) -> Result<(), Error> {
        let mut guard = SURFACE
            .lock()
            .expect("Steam overlay native surface lock poisoned");
        let Some(surface) = guard.as_mut() else {
            return Ok(());
        };
        if surface.cursor_hidden == hidden {
            return Ok(());
        }
        let Some(xfixes) = surface.xfixes.as_ref() else {
            return if hidden {
                Err(Error::from_reason(
                    "The Linux native host cannot hide the game cursor because XFixes is unavailable",
                ))
            } else {
                surface.cursor_hidden = false;
                Ok(())
            };
        };
        unsafe {
            if hidden {
                (xfixes.XFixesHideCursor)(surface.display, surface.window);
            } else {
                (xfixes.XFixesShowCursor)(surface.display, surface.window);
            }
            (surface.xlib.XFlush)(surface.display);
        }
        surface.cursor_hidden = hidden;
        Ok(())
    }

    pub fn set_continuous_present(
        _continuous: bool,
        _frame_rate: Option<f64>,
    ) -> Result<(), Error> {
        Ok(())
    }

    pub fn set_full_screen(full_screen: bool) -> Result<(), Error> {
        with_surface(|surface| unsafe {
            if surface.managed_host
                && surface.parent_window.is_none()
                && surface.full_screen != full_screen
            {
                request_standalone_host_full_screen(
                    &surface.xlib,
                    surface.display,
                    surface.window,
                    full_screen,
                );
                surface.full_screen = full_screen;
                if !surface.application_host {
                    let (_, _, width, height) = window_bounds_on_root(
                        &surface.xlib,
                        surface.display,
                        surface.window,
                        0,
                        0,
                        1,
                        1,
                    );
                    apply_standalone_host_shape(
                        surface.xfixes.as_ref(),
                        surface.display,
                        surface.window,
                        width,
                        height,
                        full_screen,
                    );
                }
            }
        })
    }

    pub fn set_presentation_marker(marker: String) -> Result<(), Error> {
        let mut guard = SURFACE
            .lock()
            .expect("Steam overlay native surface lock poisoned");
        let surface = guard.as_mut().ok_or_else(|| {
            Error::from_reason(
                "Native overlay presentation markers require an open standalone managed host",
            )
        })?;
        if !surface.managed_host || surface.parent_window.is_some() {
            return Err(Error::from_reason(
                "Native overlay presentation markers require a standalone managed host",
            ));
        }
        unsafe {
            apply_standalone_host_presentation_marker(
                &surface.xlib,
                surface.display,
                surface.window,
                &marker,
            )
        }
    }

    pub fn set_presentation_transport_closed(marker: String) -> Result<(), Error> {
        let mut guard = SURFACE
            .lock()
            .expect("Steam overlay native surface lock poisoned");
        let surface = guard.as_mut().ok_or_else(|| {
            Error::from_reason(
                "Native overlay presentation transport closure requires an open standalone managed host",
            )
        })?;
        if !surface.managed_host || surface.parent_window.is_some() {
            return Err(Error::from_reason(
                "Native overlay presentation transport closure requires a standalone managed host",
            ));
        }

        unsafe {
            // The degraded role is a one-way compositor handoff. Park and
            // confirm the same native window first, on this same X connection,
            // so KWin can never observe the degraded marker while an old
            // presentation is still opaque or interactive.
            restore_standalone_host_inert_input(surface)?;
            apply_host_opacity(
                &surface.xlib,
                surface.display,
                surface.window,
                surface.opacity_atom,
                false,
            )?;
            surface.opaque = false;

            apply_standalone_host_presentation_marker(
                &surface.xlib,
                surface.display,
                surface.window,
                &marker,
            )
        }
    }

    pub fn set_menu_json(_menu_json: String) -> Result<(), Error> {
        Ok(())
    }

    pub fn set_bounds(x: i32, y: i32, width: u32, height: u32) -> Result<(), Error> {
        with_surface(|surface| unsafe {
            if surface.managed_host {
                let width = width.max(1);
                let height = height.max(1);
                let (x, y, width, height) = if let Some(parent_window) = surface.parent_window {
                    let (parent_x, parent_y, _, _) = window_bounds_on_root(
                        &surface.xlib,
                        surface.display,
                        parent_window,
                        x,
                        y,
                        1,
                        1,
                    );
                    x11_attached_child_bounds(parent_x, parent_y, x, y, width, height)
                } else {
                    (x, y, width, height)
                };
                (surface.xlib.XMoveResizeWindow)(
                    surface.display,
                    surface.window,
                    x,
                    y,
                    width,
                    height,
                );
                (surface.xlib.XSync)(surface.display, xlib::False);
            }
        })
    }

    pub fn update_frame(buffer: Buffer, width: u32, height: u32) -> Result<(), Error> {
        let expected_len = checked_native_overlay_frame_byte_len(width, height, "Linux")?;
        if buffer.len() < expected_len {
            return Err(Error::from_reason(format!(
                "Linux native overlay frame needs {expected_len} BGRA bytes, received {}",
                buffer.len()
            )));
        }

        with_surface(|surface| {
            surface.source_frame = Some(LinuxFrameUpload {
                width: width as c_int,
                height: height as c_int,
                data: buffer[..expected_len].to_vec(),
            });
            surface.source_frame_dirty = true;
        })
    }

    pub fn update_shared_texture(
        _handle: Buffer,
        _width: u32,
        _height: u32,
        _content_x: Option<u32>,
        _content_y: Option<u32>,
        _content_width: Option<u32>,
        _content_height: Option<u32>,
        _presentation_x: Option<u32>,
        _presentation_y: Option<u32>,
        _presentation_width: Option<u32>,
        _presentation_height: Option<u32>,
    ) -> Result<(), Error> {
        Err(Error::from_reason(
            "Electron shared textures are currently supported only by the Windows D3D11 native host",
        ))
    }

    #[allow(clippy::too_many_arguments)]
    pub fn update_linux_dma_buf_shared_texture(
        fd: i32,
        stride: u32,
        offset: String,
        size: String,
        modifier: String,
        pixel_format: String,
        width: u32,
        height: u32,
        presentation_x: Option<u32>,
        presentation_y: Option<u32>,
        presentation_width: Option<u32>,
        presentation_height: Option<u32>,
    ) -> Result<(), Error> {
        if fd < 0 {
            return Err(Error::from_reason(
                "Linux shared texture dma-buf file descriptor must be non-negative",
            ));
        }
        if pixel_format != "bgra" {
            return Err(Error::from_reason(format!(
                "Linux shared texture format {pixel_format:?} is unsupported; expected single-plane bgra",
            )));
        }
        if width == 0 || height == 0 || width > c_int::MAX as u32 || height > c_int::MAX as u32 {
            return Err(Error::from_reason(
                "Linux shared texture dimensions must be non-zero signed 32-bit values",
            ));
        }
        let offset = offset.parse::<u64>().map_err(|_| {
            Error::from_reason("Linux shared texture dma-buf offset must be an unsigned integer")
        })?;
        let size = size.parse::<u64>().map_err(|_| {
            Error::from_reason("Linux shared texture dma-buf size must be an unsigned integer")
        })?;
        let modifier = modifier.parse::<u64>().map_err(|_| {
            Error::from_reason("Linux shared texture dma-buf modifier must be an unsigned integer")
        })?;
        if offset != 0 {
            return Err(Error::from_reason(
                "Linux X11 DRI3 shared textures currently require a zero dma-buf plane offset",
            ));
        }
        if stride == 0 || stride > c_int::MAX as u32 {
            return Err(Error::from_reason(
                "Linux shared texture dma-buf stride must be a non-zero signed 32-bit value",
            ));
        }
        let minimum_row_bytes = (width as u64)
            .checked_mul(4)
            .ok_or_else(|| Error::from_reason("Linux shared texture row byte count overflows"))?;
        if (stride as u64) < minimum_row_bytes {
            return Err(Error::from_reason(format!(
                "Linux shared texture stride {stride} is smaller than the {minimum_row_bytes}-byte BGRA row",
            )));
        }
        let minimum_size = offset
            .checked_add((height as u64 - 1).saturating_mul(stride as u64))
            .and_then(|last_row| last_row.checked_add(minimum_row_bytes))
            .ok_or_else(|| Error::from_reason("Linux shared texture plane size overflows"))?;
        if size < minimum_size {
            return Err(Error::from_reason(format!(
                "Linux shared texture plane has {size} bytes; at least {minimum_size} are required",
            )));
        }
        if !supports_dri3_pixmap_modifier(modifier) {
            return Err(Error::from_reason(format!(
                "Linux shared texture dma-buf modifier {modifier} is not yet supported",
            )));
        }
        let presentation_rect = (
            presentation_x.unwrap_or(0),
            presentation_y.unwrap_or(0),
            presentation_width.unwrap_or(width),
            presentation_height.unwrap_or(height),
        );
        if presentation_rect != (0, 0, width, height) {
            return Err(Error::from_reason(format!(
                "Linux shared texture currently requires a full-frame presentation rectangle, received {},{} {}x{} for {}x{}",
                presentation_rect.0,
                presentation_rect.1,
                presentation_rect.2,
                presentation_rect.3,
                width,
                height,
            )));
        }

        let mut guard = SURFACE
            .lock()
            .expect("Steam overlay native surface lock poisoned");
        let surface = guard.as_mut().ok_or_else(|| {
            Error::from_reason("Linux shared texture import requires an open native host")
        })?;
        unsafe {
            if (surface.glx_dispatch.make_current)(surface.display, surface.window, surface.context)
                == 0
            {
                return Err(Error::from_reason(
                    "Failed to make the Linux native host GLX context current for dma-buf import",
                ));
            }
            if surface.dri3_dma_buf_importer.is_none() {
                surface.dri3_dma_buf_importer = Some(create_dri3_dma_buf_importer(
                    &surface.xlib,
                    surface.display,
                    &surface.glx_dispatch,
                )?);
            }
            if surface.frame_renderer.is_none() {
                surface.frame_renderer = Some(create_frame_renderer()?);
            }
            let importer = surface
                .dri3_dma_buf_importer
                .as_ref()
                .expect("Linux DRI3 dma-buf importer was just initialized");
            let renderer = surface
                .frame_renderer
                .as_mut()
                .expect("Linux frame renderer was just initialized");
            if let Err(error) = copy_dri3_dma_buf_into_frame_texture(
                importer,
                renderer,
                fd,
                stride,
                offset,
                size,
                width as c_int,
                height as c_int,
                &surface.xlib,
                surface.display,
            ) {
                surface.shared_texture_import_failure_count =
                    surface.shared_texture_import_failure_count.wrapping_add(1);
                return Err(error);
            }
            surface.source_frame = None;
            surface.source_frame_dirty = false;
            surface.shared_texture_import_count =
                surface.shared_texture_import_count.wrapping_add(1);
        }
        Ok(())
    }

    pub fn close() {
        let surface = SURFACE
            .lock()
            .expect("Steam overlay native surface lock poisoned")
            .take();
        if let Some(surface) = surface {
            unsafe {
                // Context destruction owns every renderer object. Never bind
                // the drawable during teardown: DestroyNotify may mean the
                // Electron parent already destroyed this child XID.
                (surface.glx_dispatch.make_current)(surface.display, 0, ptr::null_mut());
                (surface.glx_dispatch.destroy_context)(surface.display, surface.context);
                // Closing this dedicated Display destroys every surviving XID
                // it owns and is safe when the WM already destroyed the host.
                (surface.xlib.XFreeColormap)(surface.display, surface.colormap);
                (surface.xlib.XCloseDisplay)(surface.display);
            }
        }
    }

    pub fn close_probe() {
        close_matching(|surface| !surface.managed_host);
    }

    pub fn detach_host() {
        close_matching(|surface| surface.managed_host);
    }

    pub fn is_probe_open() -> bool {
        SURFACE
            .lock()
            .expect("Steam overlay native surface lock poisoned")
            .as_ref()
            .is_some_and(|surface| !surface.managed_host)
    }

    pub fn is_embedded() -> bool {
        SURFACE
            .lock()
            .expect("Steam overlay native surface lock poisoned")
            .as_ref()
            .is_some_and(|surface| surface.managed_host)
    }

    pub fn mac_window_snapshot_json(_app_id: u32) -> Option<String> {
        None
    }

    pub fn mac_screen_locked() -> bool {
        false
    }

    pub fn mac_display_asleep() -> bool {
        false
    }

    pub fn host_diagnostics_json() -> Option<String> {
        let mut guard = SURFACE
            .lock()
            .expect("Steam overlay native surface lock poisoned");
        let surface = guard.as_mut()?;
        unsafe {
            if surface.display_refresh_rate_queried_at.elapsed() >= Duration::from_secs(1) {
                surface.display_refresh_rate = surface.xrandr.as_ref().and_then(|binding| {
                    display_refresh_rate_for_window(
                        binding,
                        &surface.xlib,
                        surface.display,
                        surface.window,
                    )
                });
                surface.display_refresh_rate_queried_at = Instant::now();
            }
            let (x, y, width, height) =
                window_bounds_on_root(&surface.xlib, surface.display, surface.window, 0, 0, 1, 1);
            let mut attributes: xlib::XWindowAttributes = mem::MaybeUninit::zeroed().assume_init();
            let map_state = if (surface.xlib.XGetWindowAttributes)(
                surface.display,
                surface.window,
                &mut attributes,
            ) == 0
            {
                None
            } else {
                Some(attributes.map_state)
            };
            Some(
                json!({
                    "backend": "x11-glx",
                    "glxInterposition": {
                        "chooseVisual": surface.glx_dispatch.choose_visual_interposed,
                        "createContext": surface.glx_dispatch.create_context_interposed,
                        "destroyContext": surface.glx_dispatch.destroy_context_interposed,
                        "makeCurrent": surface.glx_dispatch.make_current_interposed,
                        "swapBuffers": surface.glx_dispatch.swap_buffers_interposed,
                        "getProcAddress": surface.glx_dispatch.get_proc_address_interposed,
                    },
                    "xlibInterposition": {
                        "pending": surface.xlib_dispatch.pending_interposed,
                        "nextEvent": surface.xlib_dispatch.next_event_interposed,
                    },
                    "swapIntervalControl": surface.swap_interval_control,
                    "managedHost": surface.managed_host,
                    "applicationHost": surface.application_host,
                    "standaloneHost": surface.managed_host
                        && surface.parent_window.is_none()
                        && !surface.application_host,
                    "attachedChildHost": surface.managed_host && surface.parent_window.is_some(),
                    "hiddenRootBootstrap": surface.managed_host && surface.parent_window.is_some(),
                    "bounds": {
                        "x": x,
                        "y": y,
                        "width": width,
                        "height": height,
                    },
                    "mapped": map_state == Some(xlib::IsViewable),
                    "fullScreen": surface.full_screen,
                    "inputPassthrough": surface.input_passthrough,
                    "opaque": surface.opaque,
                    "cursorHidden": surface.cursor_hidden,
                    "overlayActive": surface.overlay_active,
                    "roundedBottomCorners": surface.managed_host
                        && surface.parent_window.is_none()
                        && !surface.application_host
                        && !surface.full_screen,
                    "frame": surface.frame,
                    "sourceFrame": surface.source_frame.as_ref().map(|frame| json!({
                        "width": frame.width,
                        "height": frame.height,
                        "bytes": frame.data.len(),
                    })),
                    "sourceFrameDirty": surface.source_frame_dirty,
                    "frameUploadCount": surface.frame_upload_count,
                    "sharedTextureImportCount": surface.shared_texture_import_count,
                    "sharedTextureImportFailureCount": surface.shared_texture_import_failure_count,
                    "sharedTextureImportAvailable": surface.dri3_dma_buf_importer.is_some(),
                    "sharedTextureImportBackend": surface
                        .dri3_dma_buf_importer
                        .as_ref()
                        .map(|_| "x11-dri3-glx-texture-from-pixmap"),
                    "sharedTextureImportYInverted": surface
                        .dri3_dma_buf_importer
                        .as_ref()
                        .map(|importer| importer.y_inverted),
                    "frameDrawCount": surface.frame_draw_count,
                    "configureCount": surface.configure_count,
                    "viewportSize": {
                        "width": surface.viewport_width,
                        "height": surface.viewport_height,
                    },
                    "displayRefreshRate": surface.display_refresh_rate,
                    "inputActivationPrepared": surface.input_activation_prepared,
                    "inputActivationCommitPending": surface.input_activation_commit.is_some(),
                    "inputActivationFocusConfirmationCount": surface
                        .input_activation_commit
                        .as_ref()
                        .map(|commit| commit.consecutive_focus_observations)
                        .unwrap_or(0),
                    "activationGeneration": surface.activation_generation,
                    "activationCommitFailed": surface.activation_commit_failed,
                    "activationCommitFailureCount": surface.activation_commit_failure_count,
                    "activationRequestPending": surface.activation_request.is_some(),
                    "activationRequestSent": surface
                        .activation_request
                        .as_ref()
                        .map(|request| request.sent)
                        .unwrap_or(false),
                    "activationRequestCount": surface.activation_request_count,
                })
                .to_string(),
            )
        }
    }

    pub fn drain_input_events_json() -> String {
        let events = mem::take(
            &mut *LINUX_INPUT_EVENTS
                .lock()
                .expect("Steam overlay Linux input event lock poisoned"),
        );
        serde_json::to_string(&events).unwrap_or_else(|_| "[]".to_owned())
    }

    fn with_surface(run: impl FnOnce(&mut NativeSurface)) -> Result<(), Error> {
        let mut guard = SURFACE
            .lock()
            .expect("Steam overlay native surface lock poisoned");
        if let Some(surface) = guard.as_mut() {
            run(surface);
        }
        Ok(())
    }

    fn close_matching(matches: impl FnOnce(&NativeSurface) -> bool) {
        let surface = {
            let mut guard = SURFACE
                .lock()
                .expect("Steam overlay native surface lock poisoned");
            if guard.as_ref().map(matches).unwrap_or(false) {
                guard.take()
            } else {
                None
            }
        };

        if let Some(surface) = surface {
            unsafe {
                // Context destruction owns every renderer object. Never bind
                // a child drawable that may already have died with its parent.
                (surface.glx_dispatch.make_current)(surface.display, 0, ptr::null_mut());
                (surface.glx_dispatch.destroy_context)(surface.display, surface.context);
                // XCloseDisplay owns surviving-window teardown without a
                // second BadWindow-prone request after DestroyNotify.
                (surface.xlib.XFreeColormap)(surface.display, surface.colormap);
                (surface.xlib.XCloseDisplay)(surface.display);
            }
        }
    }

    unsafe fn create_probe_window(
        title: &str,
        parent_window: Option<xlib::Window>,
        attached_initial_bounds: Option<(i32, i32, u32, u32)>,
        standalone_bounds: Option<(i32, i32, u32, u32)>,
        managed_host: bool,
        full_screen: bool,
        application_host: bool,
        minimum_client_size: Option<(u32, u32)>,
    ) -> Result<NativeSurface, Error> {
        let title = CString::new(title)
            .map_err(|error| Error::from_reason(format!("Invalid native probe title: {error}")))?;
        let class_name = CString::new("SteamBridgeNativeProbe").expect("static class name");
        let xlib = xlib::Xlib::open()
            .map_err(|error| Error::from_reason(format!("Failed to load Xlib: {error}")))?;
        let glx = glx::Glx::open()
            .map_err(|error| Error::from_reason(format!("Failed to load GLX: {error}")))?;
        // Steam's Linux renderer is injected through LD_PRELOAD. x11-dl's
        // private libGL dlsym table bypasses those symbols, so resolve GLX
        // device/swap entry points from the process-global scope first.
        let glx_dispatch = resolve_glx_dispatch(&glx);
        let xlib_dispatch = resolve_xlib_dispatch(&xlib);
        let xfixes = xfixes::Xlib::open().ok();
        let xshape = XShapeLibrary::open().ok();
        let xrandr = xrandr::Xrandr::open().ok();
        let standalone_managed_host = managed_host && parent_window.is_none();
        let standalone_overlay_host = standalone_managed_host && !application_host;

        let display = (xlib.XOpenDisplay)(ptr::null());
        if display.is_null() {
            return Err(Error::from_reason(
                "Failed to open X11 display for Linux native overlay probe",
            ));
        }
        if managed_host && !application_host {
            let Some(xfixes) = xfixes.as_ref() else {
                (xlib.XCloseDisplay)(display);
                return Err(Error::from_reason(
                    "Linux managed overlay input safety requires XFixes",
                ));
            };
            let mut event_base = 0;
            let mut error_base = 0;
            if (xfixes.XFixesQueryExtension)(display, &mut event_base, &mut error_base) == 0 {
                (xlib.XCloseDisplay)(display);
                return Err(Error::from_reason(
                    "Linux managed overlay input safety requires the XFixes extension",
                ));
            }
            let mut xfixes_major = 0;
            let mut xfixes_minor = 0;
            if (xfixes.XFixesQueryVersion)(display, &mut xfixes_major, &mut xfixes_minor) == 0
                || xfixes_major < 2
            {
                (xlib.XCloseDisplay)(display);
                return Err(Error::from_reason(
                    "Linux managed overlay input safety requires XFixes 2.0",
                ));
            }
            let Some(xshape) = xshape.as_ref() else {
                (xlib.XCloseDisplay)(display);
                return Err(Error::from_reason(
                    "Linux managed overlay input safety requires Xext Shape support",
                ));
            };
            if !xshape.supports_input_shape(display) {
                (xlib.XCloseDisplay)(display);
                return Err(Error::from_reason(
                    "Linux managed overlay input safety requires Shape 1.1 input regions",
                ));
            }
        }

        let (screen, parent, x, y, width, height, attached_x, attached_y) =
            if let Some(parent_window) = parent_window {
                let mut attributes: xlib::XWindowAttributes =
                    mem::MaybeUninit::zeroed().assume_init();
                if (xlib.XGetWindowAttributes)(display, parent_window, &mut attributes) == 0 {
                    (xlib.XCloseDisplay)(display);
                    return Err(Error::from_reason(
                        "Failed to inspect Electron X11 window for Linux native overlay host",
                    ));
                }

                let screen = if attributes.screen.is_null() {
                    (xlib.XDefaultScreen)(display)
                } else {
                    (xlib.XScreenNumberOfScreen)(attributes.screen)
                };
                let (parent_root_x, parent_root_y, _, _) = window_bounds_on_root(
                    &xlib,
                    display,
                    parent_window,
                    0,
                    0,
                    attributes.width.max(1) as c_uint,
                    attributes.height.max(1) as c_uint,
                );
                let (x, y, width, height) = attached_initial_bounds.unwrap_or((
                    parent_root_x,
                    parent_root_y,
                    attributes.width.max(1) as c_uint,
                    attributes.height.max(1) as c_uint,
                ));
                let (attached_x, attached_y, width, height) =
                    x11_attached_child_bounds(parent_root_x, parent_root_y, x, y, width, height);
                (
                    screen,
                    parent_window,
                    x,
                    y,
                    width,
                    height,
                    attached_x,
                    attached_y,
                )
            } else if let Some((x, y, width, height)) = standalone_bounds {
                let screen = (xlib.XDefaultScreen)(display);
                (
                    screen,
                    (xlib.XRootWindow)(display, screen),
                    x,
                    y,
                    width.max(1),
                    height.max(1),
                    0,
                    0,
                )
            } else {
                let screen = (xlib.XDefaultScreen)(display);
                (
                    screen,
                    (xlib.XRootWindow)(display, screen),
                    0,
                    0,
                    (xlib.XDisplayWidth)(display, screen).max(640) as c_uint,
                    (xlib.XDisplayHeight)(display, screen).max(480) as c_uint,
                    0,
                    0,
                )
            };

        let mut visual_attrs = [
            glx::GLX_RGBA,
            glx::GLX_DOUBLEBUFFER,
            glx::GLX_RED_SIZE,
            8,
            glx::GLX_GREEN_SIZE,
            8,
            glx::GLX_BLUE_SIZE,
            8,
            glx::GLX_ALPHA_SIZE,
            8,
            glx::GLX_DEPTH_SIZE,
            24,
            0,
        ];
        let visual_info = (glx_dispatch.choose_visual)(display, screen, visual_attrs.as_mut_ptr());
        if visual_info.is_null() {
            (xlib.XCloseDisplay)(display);
            return Err(Error::from_reason(
                "Failed to choose a GLX visual for Linux native overlay probe",
            ));
        }

        // Steam's Linux overlay intentionally skips nested GLX windows. Build
        // an attached host as an unmapped root child long enough for one GLX
        // registration swap, then reparent that same XID under Electron before
        // it is ever mapped. The visible lifetime remains a real child; no
        // popup/transient top-level is exposed to the window manager.
        let creation_parent = if parent_window.is_some() {
            (xlib.XRootWindow)(display, screen)
        } else {
            parent
        };
        let colormap = (xlib.XCreateColormap)(
            display,
            creation_parent,
            (*visual_info).visual,
            xlib::AllocNone,
        );
        let mut attributes: xlib::XSetWindowAttributes = mem::MaybeUninit::zeroed().assume_init();
        attributes.colormap = colormap;
        attributes.background_pixel = (xlib.XBlackPixel)(display, screen);
        attributes.border_pixel = 0;
        attributes.override_redirect = xlib::False;
        attributes.event_mask = xlib::ExposureMask
            | xlib::StructureNotifyMask
            | xlib::KeyPressMask
            | xlib::KeyReleaseMask
            | xlib::ButtonPressMask
            | xlib::ButtonReleaseMask
            | xlib::PointerMotionMask
            | xlib::FocusChangeMask
            | xlib::EnterWindowMask
            | xlib::LeaveWindowMask;

        let window = (xlib.XCreateWindow)(
            display,
            creation_parent,
            x,
            y,
            width,
            height,
            0,
            (*visual_info).depth,
            xlib::InputOutput as c_uint,
            (*visual_info).visual,
            xlib::CWColormap | xlib::CWBackPixel | xlib::CWBorderPixel | xlib::CWEventMask,
            &mut attributes,
        );
        if window == 0 {
            (xlib.XFree)(visual_info.cast::<c_void>());
            (xlib.XFreeColormap)(display, colormap);
            (xlib.XCloseDisplay)(display);
            return Err(Error::from_reason(
                "Failed to create Linux native overlay probe window",
            ));
        }

        (xlib.XStoreName)(display, window, title.as_ptr());
        let wm_protocols_name = CString::new("WM_PROTOCOLS").expect("static atom");
        let wm_delete_window_name = CString::new("WM_DELETE_WINDOW").expect("static atom");
        let wm_protocols_atom =
            (xlib.XInternAtom)(display, wm_protocols_name.as_ptr(), xlib::False);
        let wm_delete_window_atom =
            (xlib.XInternAtom)(display, wm_delete_window_name.as_ptr(), xlib::False);
        let opacity_atom_name = CString::new("_NET_WM_WINDOW_OPACITY").expect("static atom");
        let opacity_atom = (xlib.XInternAtom)(display, opacity_atom_name.as_ptr(), xlib::False);
        let mut input_passthrough = false;
        let mut opaque = true;
        if application_host {
            apply_application_host_window_hints(
                &xlib,
                display,
                window,
                minimum_client_size,
                wm_delete_window_atom,
            );
        } else if managed_host {
            if standalone_overlay_host {
                apply_standalone_host_window_hints(&xlib, display, window, full_screen);
                apply_standalone_host_shape(
                    xfixes.as_ref(),
                    display,
                    window,
                    width,
                    height,
                    full_screen,
                );
            }
            if let Err(error) = apply_host_input_mode(
                &xlib,
                xfixes.as_ref(),
                xshape.as_ref(),
                display,
                window,
                true,
            ) {
                (xlib.XDestroyWindow)(display, window);
                (xlib.XFree)(visual_info.cast::<c_void>());
                (xlib.XFreeColormap)(display, colormap);
                (xlib.XCloseDisplay)(display);
                return Err(error);
            }
            if let Err(error) = apply_host_opacity(&xlib, display, window, opacity_atom, false) {
                (xlib.XDestroyWindow)(display, window);
                (xlib.XFree)(visual_info.cast::<c_void>());
                (xlib.XFreeColormap)(display, colormap);
                (xlib.XCloseDisplay)(display);
                return Err(error);
            }
            input_passthrough = true;
            opaque = false;
        }
        let mut class_hint = xlib::XClassHint {
            res_name: class_name.as_ptr().cast_mut(),
            res_class: class_name.as_ptr().cast_mut(),
        };
        (xlib.XSetClassHint)(display, window, &mut class_hint);

        let context =
            (glx_dispatch.create_context)(display, visual_info, ptr::null_mut(), xlib::True);
        (xlib.XFree)(visual_info.cast::<c_void>());
        if context.is_null() {
            (xlib.XDestroyWindow)(display, window);
            (xlib.XFreeColormap)(display, colormap);
            (xlib.XCloseDisplay)(display);
            return Err(Error::from_reason(
                "Failed to create GLX context for Linux native overlay probe",
            ));
        }

        if (glx_dispatch.make_current)(display, window, context) == 0 {
            (glx_dispatch.destroy_context)(display, context);
            (xlib.XDestroyWindow)(display, window);
            (xlib.XFreeColormap)(display, colormap);
            (xlib.XCloseDisplay)(display);
            return Err(Error::from_reason(
                "Failed to make Linux native overlay probe GLX context current",
            ));
        }
        load_gl_functions(&glx_dispatch);
        // JavaScript schedules the native host at the display rate, and every
        // newly delivered Electron frame is an immediate presentation trigger.
        // Leaving Mesa/Xwayland's implicit vblank wait enabled blocks Electron's
        // main thread inside Steam's interposed glXSwapBuffers (observed at one
        // second per call on Steam Deck). Disable that second scheduler and keep
        // Steam's interposed swap as the presentation boundary.
        let swap_interval_control = disable_glx_swap_interval(&glx_dispatch, display, window);
        gl::Viewport(0, 0, width as c_int, height as c_int);

        if let Some(attached_parent) = parent_window {
            gl::ClearColor(0.0, 0.0, 0.0, 0.0);
            gl::Clear(gl::COLOR_BUFFER_BIT);
            (glx_dispatch.swap_buffers)(display, window);
            let mut root_return = 0;
            let mut parent_return = 0;
            let mut children_return: *mut xlib::Window = ptr::null_mut();
            let mut child_count = 0;
            let (query_status, x11_error_code) = with_x11_error_trap(&xlib, display, || {
                (xlib.XReparentWindow)(display, window, attached_parent, attached_x, attached_y);
                let query_status = (xlib.XQueryTree)(
                    display,
                    window,
                    &mut root_return,
                    &mut parent_return,
                    &mut children_return,
                    &mut child_count,
                );
                if query_status != 0 && parent_return == attached_parent {
                    (xlib.XMapRaised)(display, window);
                }
                query_status
            });
            if !children_return.is_null() {
                (xlib.XFree)(children_return.cast::<c_void>());
            }
            if x11_error_code != 0 || query_status == 0 || parent_return != attached_parent {
                (glx_dispatch.make_current)(display, 0, ptr::null_mut());
                (glx_dispatch.destroy_context)(display, context);
                (xlib.XFreeColormap)(display, colormap);
                (xlib.XCloseDisplay)(display);
                return Err(Error::from_reason(
                    format!(
                        "Failed to confirm the bootstrapped GLX host as an Electron X11 child (X11 error {x11_error_code})"
                    ),
                ));
            }
        }

        // A standalone overlay host is role-authenticated by JavaScript before
        // first presentation. Keep it unmapped in its native fail-closed state
        // until the KWin state/degraded marker has been written; subsequent
        // hide/remap cycles retain the same native window and KWin lease. An
        // attached child was already mapped inside the checked reparent trap.
        if (!standalone_overlay_host && parent_window.is_none()) || application_host {
            (xlib.XMapRaised)(display, window);
        }
        (xlib.XFlush)(display);
        let display_refresh_rate = xrandr
            .as_ref()
            .and_then(|binding| display_refresh_rate_for_window(binding, &xlib, display, window));

        Ok(NativeSurface {
            xlib,
            xlib_dispatch,
            _glx: glx,
            glx_dispatch,
            xfixes,
            xshape,
            xrandr,
            display,
            window,
            parent_window,
            managed_host,
            application_host,
            wm_protocols_atom,
            wm_delete_window_atom,
            opacity_atom,
            colormap,
            context,
            swap_interval_control,
            frame: 0,
            input_passthrough,
            opaque,
            cursor_hidden: false,
            full_screen,
            configure_count: 0,
            viewport_width: width,
            viewport_height: height,
            overlay_active: false,
            activation_generation: 0,
            input_activation_prepared: false,
            input_activation_commit: None,
            activation_commit_failed: false,
            activation_commit_failure_count: 0,
            activation_request: None,
            activation_requested_for_input_epoch: false,
            activation_request_count: 0,
            display_refresh_rate,
            display_refresh_rate_queried_at: Instant::now(),
            source_frame: None,
            source_frame_dirty: false,
            frame_renderer: None,
            frame_upload_count: 0,
            shared_texture_import_count: 0,
            shared_texture_import_failure_count: 0,
            dri3_dma_buf_importer: None,
            frame_draw_count: 0,
        })
    }

    unsafe fn display_refresh_rate_for_window(
        xrandr: &xrandr::Xrandr,
        xlib: &xlib::Xlib,
        display: *mut xlib::Display,
        window: xlib::Window,
    ) -> Option<f64> {
        let mut event_base = 0;
        let mut error_base = 0;
        if (xrandr.XRRQueryExtension)(display, &mut event_base, &mut error_base) == 0 {
            return None;
        }

        let mut attributes: xlib::XWindowAttributes = mem::MaybeUninit::zeroed().assume_init();
        if (xlib.XGetWindowAttributes)(display, window, &mut attributes) == 0 {
            return None;
        }
        let (window_x, window_y, window_width, window_height) =
            window_bounds_on_root(xlib, display, window, 0, 0, 1, 1);
        let resources = (xrandr.XRRGetScreenResourcesCurrent)(display, attributes.root);
        if resources.is_null() {
            return None;
        }

        let mut best_rate = None;
        let mut best_overlap_area = 0_u64;
        let mut best_center_distance = i128::MAX;
        if (*resources).ncrtc > 0
            && !(*resources).crtcs.is_null()
            && (*resources).nmode > 0
            && !(*resources).modes.is_null()
        {
            let crtcs = std::slice::from_raw_parts((*resources).crtcs, (*resources).ncrtc as usize);
            let modes = std::slice::from_raw_parts((*resources).modes, (*resources).nmode as usize);
            let window_left = window_x as i64;
            let window_top = window_y as i64;
            let window_right = window_left + window_width as i64;
            let window_bottom = window_top + window_height as i64;
            let window_center_x2 = window_left * 2 + window_width as i64;
            let window_center_y2 = window_top * 2 + window_height as i64;

            for crtc in crtcs {
                let crtc_info = (xrandr.XRRGetCrtcInfo)(display, resources, *crtc);
                if crtc_info.is_null() {
                    continue;
                }
                let crtc_x = (*crtc_info).x;
                let crtc_y = (*crtc_info).y;
                let crtc_width = (*crtc_info).width;
                let crtc_height = (*crtc_info).height;
                let mode_id = (*crtc_info).mode;
                (xrandr.XRRFreeCrtcInfo)(crtc_info);
                if mode_id == 0 || crtc_width == 0 || crtc_height == 0 {
                    continue;
                }

                let Some(mode) = modes.iter().find(|mode| mode.id == mode_id) else {
                    continue;
                };
                let Some(refresh_rate) = xrandr_mode_refresh_rate(
                    mode.dotClock as u64,
                    mode.hTotal,
                    mode.vTotal,
                    mode.modeFlags as u64,
                ) else {
                    continue;
                };

                let crtc_left = crtc_x as i64;
                let crtc_top = crtc_y as i64;
                let crtc_right = crtc_left + crtc_width as i64;
                let crtc_bottom = crtc_top + crtc_height as i64;
                let overlap_width =
                    (window_right.min(crtc_right) - window_left.max(crtc_left)).max(0);
                let overlap_height =
                    (window_bottom.min(crtc_bottom) - window_top.max(crtc_top)).max(0);
                let overlap_area = (overlap_width * overlap_height) as u64;
                let center_dx = window_center_x2 - (crtc_left * 2 + crtc_width as i64);
                let center_dy = window_center_y2 - (crtc_top * 2 + crtc_height as i64);
                let center_distance =
                    center_dx as i128 * center_dx as i128 + center_dy as i128 * center_dy as i128;

                if best_rate.is_none()
                    || overlap_area > best_overlap_area
                    || (overlap_area == best_overlap_area && center_distance < best_center_distance)
                {
                    best_rate = Some(refresh_rate);
                    best_overlap_area = overlap_area;
                    best_center_distance = center_distance;
                }
            }
        }

        (xrandr.XRRFreeScreenResources)(resources);
        best_rate
    }

    unsafe fn window_bounds_on_root(
        xlib: &xlib::Xlib,
        display: *mut xlib::Display,
        window: xlib::Window,
        fallback_x: c_int,
        fallback_y: c_int,
        fallback_width: c_uint,
        fallback_height: c_uint,
    ) -> (c_int, c_int, c_uint, c_uint) {
        let mut attributes: xlib::XWindowAttributes = mem::MaybeUninit::zeroed().assume_init();
        if (xlib.XGetWindowAttributes)(display, window, &mut attributes) == 0 {
            return (fallback_x, fallback_y, fallback_width, fallback_height);
        }

        let mut x = fallback_x;
        let mut y = fallback_y;
        let mut child: xlib::Window = 0;
        if (xlib.XTranslateCoordinates)(
            display,
            window,
            attributes.root,
            0,
            0,
            &mut x,
            &mut y,
            &mut child,
        ) == 0
        {
            x = fallback_x;
            y = fallback_y;
        }
        (
            x,
            y,
            attributes.width.max(1) as c_uint,
            attributes.height.max(1) as c_uint,
        )
    }

    unsafe fn apply_application_host_window_hints(
        xlib: &xlib::Xlib,
        display: *mut xlib::Display,
        window: xlib::Window,
        minimum_client_size: Option<(u32, u32)>,
        wm_delete_window_atom: xlib::Atom,
    ) {
        let mut input_hints: xlib::XWMHints = mem::MaybeUninit::zeroed().assume_init();
        input_hints.flags = xlib::InputHint;
        input_hints.input = xlib::True;
        (xlib.XSetWMHints)(display, window, &mut input_hints);

        if let Some((minimum_width, minimum_height)) = minimum_client_size {
            let mut size_hints: xlib::XSizeHints = mem::MaybeUninit::zeroed().assume_init();
            size_hints.flags = xlib::PMinSize;
            size_hints.min_width = minimum_width.min(c_int::MAX as u32) as c_int;
            size_hints.min_height = minimum_height.min(c_int::MAX as u32) as c_int;
            (xlib.XSetWMNormalHints)(display, window, &mut size_hints);
        }

        if wm_delete_window_atom != 0 {
            let mut protocols = [wm_delete_window_atom];
            (xlib.XSetWMProtocols)(display, window, protocols.as_mut_ptr(), 1);
        }
    }

    unsafe fn record_linux_input_event(surface: &mut NativeSurface, event: &xlib::XEvent) {
        let event_type = event.get_type();
        match event_type {
            xlib::MotionNotify => {
                let motion = event.motion;
                if motion.window == surface.window {
                    push_linux_input_event(linux_pointer_event(
                        surface,
                        "mouseMove",
                        event_type,
                        motion.state,
                        motion.x,
                        motion.y,
                        None,
                    ));
                }
            }
            xlib::ButtonPress | xlib::ButtonRelease => {
                let button = event.button;
                if button.window != surface.window {
                    return;
                }
                let kind = match (button.button, event_type) {
                    (1, xlib::ButtonPress) => Some("leftMouseDown"),
                    (1, xlib::ButtonRelease) => Some("leftMouseUp"),
                    (2, xlib::ButtonPress) => Some("middleMouseDown"),
                    (2, xlib::ButtonRelease) => Some("middleMouseUp"),
                    (3, xlib::ButtonPress) => Some("rightMouseDown"),
                    (3, xlib::ButtonRelease) => Some("rightMouseUp"),
                    (4 | 5 | 6 | 7, xlib::ButtonPress) => Some("mouseWheel"),
                    _ => None,
                };
                if let Some(kind) = kind {
                    let delta_y = match button.button {
                        4 => Some(120),
                        5 => Some(-120),
                        _ => Some(0),
                    };
                    push_linux_input_event(linux_pointer_event(
                        surface,
                        kind,
                        event_type,
                        button.state,
                        button.x,
                        button.y,
                        (kind == "mouseWheel").then_some(delta_y.unwrap_or(0)),
                    ));
                }
            }
            xlib::KeyPress | xlib::KeyRelease => {
                let mut key = event.key;
                if key.window != surface.window {
                    return;
                }
                let shift = key.state & xlib::ShiftMask != 0;
                let control = key.state & xlib::ControlMask != 0;
                let alt = key.state & xlib::Mod1Mask != 0;
                let key_symbol = (surface.xlib.XLookupKeysym)(&mut key, 0);
                let virtual_key = virtual_key_from_keysym(key_symbol);
                let (client_width, client_height, minimized) = linux_client_state(surface);
                let lparam = if alt { 0x2000_0000 } else { 0 };
                push_linux_input_event(LinuxInputEvent {
                    kind: if event_type == xlib::KeyPress {
                        "keyDown"
                    } else {
                        "keyUp"
                    },
                    captured_at_ms: linux_now_ms(),
                    message: event_type as u32,
                    wparam: virtual_key,
                    lparam,
                    shift,
                    control,
                    alt,
                    x: None,
                    y: None,
                    delta_y: None,
                    command_id: None,
                    client_width,
                    client_height,
                    minimized,
                });

                if event_type == xlib::KeyPress {
                    let character_symbol =
                        (surface.xlib.XLookupKeysym)(&mut key, if shift { 1 } else { 0 });
                    if let Some(character) = character_from_keysym(character_symbol) {
                        push_linux_input_event(LinuxInputEvent {
                            kind: "char",
                            captured_at_ms: linux_now_ms(),
                            message: event_type as u32,
                            wparam: character as u64,
                            lparam,
                            shift,
                            control,
                            alt,
                            x: None,
                            y: None,
                            delta_y: None,
                            command_id: None,
                            client_width,
                            client_height,
                            minimized,
                        });
                    }
                }
            }
            xlib::FocusIn | xlib::FocusOut => {
                let focus = event.focus_change;
                if focus.window == surface.window {
                    let (client_width, client_height, minimized) = linux_client_state(surface);
                    push_linux_input_event(LinuxInputEvent {
                        kind: if event_type == xlib::FocusIn {
                            "focus"
                        } else {
                            "blur"
                        },
                        captured_at_ms: linux_now_ms(),
                        message: event_type as u32,
                        wparam: 0,
                        lparam: 0,
                        shift: false,
                        control: false,
                        alt: false,
                        x: None,
                        y: None,
                        delta_y: None,
                        command_id: None,
                        client_width,
                        client_height,
                        minimized,
                    });
                }
            }
            xlib::MapNotify => {
                if event.map.window == surface.window {
                    let (width, height, _) = linux_client_state(surface);
                    record_linux_window_changed(surface, width, height, false);
                }
            }
            xlib::UnmapNotify => {
                if event.unmap.window == surface.window {
                    let (width, height, _) = linux_client_state(surface);
                    record_linux_window_changed(surface, width, height, true);
                }
            }
            xlib::ClientMessage => {
                let client = event.client_message;
                if client.window == surface.window
                    && client.message_type == surface.wm_protocols_atom
                    && client.data.get_long(0) as xlib::Atom == surface.wm_delete_window_atom
                {
                    let (client_width, client_height, minimized) = linux_client_state(surface);
                    push_linux_input_event(LinuxInputEvent {
                        kind: "close",
                        captured_at_ms: linux_now_ms(),
                        message: event_type as u32,
                        wparam: 0,
                        lparam: 0,
                        shift: false,
                        control: false,
                        alt: false,
                        x: None,
                        y: None,
                        delta_y: None,
                        command_id: None,
                        client_width,
                        client_height,
                        minimized,
                    });
                }
            }
            _ => {}
        }
    }

    unsafe fn linux_pointer_event(
        surface: &NativeSurface,
        kind: &'static str,
        message: c_int,
        state: c_uint,
        x: c_int,
        y: c_int,
        delta_y: Option<i32>,
    ) -> LinuxInputEvent {
        let (client_width, client_height, minimized) = linux_client_state(surface);
        LinuxInputEvent {
            kind,
            captured_at_ms: linux_now_ms(),
            message: message as u32,
            wparam: windows_mouse_key_state(state),
            lparam: 0,
            shift: state & xlib::ShiftMask != 0,
            control: state & xlib::ControlMask != 0,
            alt: state & xlib::Mod1Mask != 0,
            x: Some(x),
            y: Some(y),
            delta_y,
            command_id: None,
            client_width,
            client_height,
            minimized,
        }
    }

    unsafe fn linux_client_state(surface: &NativeSurface) -> (i32, i32, bool) {
        let mut attributes: xlib::XWindowAttributes = mem::MaybeUninit::zeroed().assume_init();
        if (surface.xlib.XGetWindowAttributes)(surface.display, surface.window, &mut attributes)
            == 0
        {
            return (
                surface.viewport_width.max(1) as i32,
                surface.viewport_height.max(1) as i32,
                false,
            );
        }
        (
            attributes.width.max(1),
            attributes.height.max(1),
            attributes.map_state != xlib::IsViewable,
        )
    }

    fn record_linux_window_changed(
        surface: &NativeSurface,
        client_width: i32,
        client_height: i32,
        minimized: bool,
    ) {
        push_linux_input_event(LinuxInputEvent {
            kind: "windowChanged",
            captured_at_ms: linux_now_ms(),
            message: xlib::ConfigureNotify as u32,
            wparam: 0,
            lparam: 0,
            shift: false,
            control: false,
            alt: false,
            x: None,
            y: None,
            delta_y: None,
            command_id: None,
            client_width: client_width.max(1),
            client_height: client_height.max(1),
            minimized,
        });
        let _ = surface;
    }

    fn push_linux_input_event(event: LinuxInputEvent) {
        let mut events = LINUX_INPUT_EVENTS
            .lock()
            .expect("Steam overlay Linux input event lock poisoned");
        if matches!(event.kind, "mouseMove" | "windowChanged")
            && events.last().is_some_and(|last| last.kind == event.kind)
        {
            *events.last_mut().expect("Linux input event disappeared") = event;
        } else {
            events.push(event);
        }
        if events.len() > 256 {
            events.remove(0);
        }
    }

    fn windows_mouse_key_state(state: c_uint) -> u64 {
        u64::from(state & xlib::Button1Mask != 0)
            | (u64::from(state & xlib::Button3Mask != 0) << 1)
            | (u64::from(state & xlib::ShiftMask != 0) << 2)
            | (u64::from(state & xlib::ControlMask != 0) << 3)
            | (u64::from(state & xlib::Button2Mask != 0) << 4)
    }

    fn virtual_key_from_keysym(symbol: xlib::KeySym) -> u64 {
        let symbol = symbol as c_uint;
        match symbol {
            keysym::XK_BackSpace => 0x08,
            keysym::XK_Tab => 0x09,
            keysym::XK_Return => 0x0D,
            keysym::XK_Shift_L => 0xA0,
            keysym::XK_Shift_R => 0xA1,
            keysym::XK_Control_L => 0xA2,
            keysym::XK_Control_R => 0xA3,
            keysym::XK_Alt_L => 0xA4,
            keysym::XK_Alt_R => 0xA5,
            keysym::XK_Escape => 0x1B,
            keysym::XK_space => 0x20,
            keysym::XK_Page_Up => 0x21,
            keysym::XK_Page_Down => 0x22,
            keysym::XK_End => 0x23,
            keysym::XK_Home => 0x24,
            keysym::XK_Left => 0x25,
            keysym::XK_Up => 0x26,
            keysym::XK_Right => 0x27,
            keysym::XK_Down => 0x28,
            keysym::XK_Insert => 0x2D,
            keysym::XK_Delete => 0x2E,
            keysym::XK_F1..=keysym::XK_F24 => 0x70 + u64::from(symbol - keysym::XK_F1),
            0x61..=0x7A => u64::from(symbol - 0x61 + 0x41),
            0x41..=0x5A | 0x30..=0x39 => u64::from(symbol),
            0x20..=0x7E => u64::from(symbol),
            _ => 0,
        }
    }

    fn character_from_keysym(symbol: xlib::KeySym) -> Option<u32> {
        let symbol = symbol as u32;
        (0x20..=0x7E).contains(&symbol).then_some(symbol)
    }

    fn linux_now_ms() -> u64 {
        SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map(|duration| duration.as_millis() as u64)
            .unwrap_or(0)
    }

    unsafe fn apply_standalone_host_window_hints(
        xlib: &xlib::Xlib,
        display: *mut xlib::Display,
        window: xlib::Window,
        full_screen: bool,
    ) {
        const MWM_HINTS_FUNCTIONS: c_long = 1 << 0;
        const MWM_HINTS_DECORATIONS: c_long = 1 << 1;
        const MWM_FUNC_ALL: c_long = 1 << 0;

        let motif_hints_atom_name = CString::new("_MOTIF_WM_HINTS").expect("static atom");
        let motif_hints_atom =
            (xlib.XInternAtom)(display, motif_hints_atom_name.as_ptr(), xlib::False);
        if motif_hints_atom != 0 {
            // Keep the managed host undecorated while retaining ordinary WM
            // operations. KWin treats a decorations-only zero-function hint
            // as non-minimizable, which prevents its script from mirroring a
            // minimized native-Wayland Electron owner onto this Xwayland host.
            let hints: [c_long; 5] = [
                MWM_HINTS_FUNCTIONS | MWM_HINTS_DECORATIONS,
                MWM_FUNC_ALL,
                0,
                0,
                0,
            ];
            (xlib.XChangeProperty)(
                display,
                window,
                motif_hints_atom,
                motif_hints_atom,
                32,
                xlib::PropModeReplace,
                hints.as_ptr().cast::<c_uchar>(),
                hints.len() as c_int,
            );
        }

        if full_screen {
            let state_atom_name = CString::new("_NET_WM_STATE").expect("static atom");
            let full_screen_atom_name =
                CString::new("_NET_WM_STATE_FULLSCREEN").expect("static atom");
            let state_atom = (xlib.XInternAtom)(display, state_atom_name.as_ptr(), xlib::False);
            let full_screen_atom =
                (xlib.XInternAtom)(display, full_screen_atom_name.as_ptr(), xlib::False);
            if state_atom != 0 && full_screen_atom != 0 {
                let states = [full_screen_atom];
                (xlib.XChangeProperty)(
                    display,
                    window,
                    state_atom,
                    xlib::XA_ATOM,
                    32,
                    xlib::PropModeReplace,
                    states.as_ptr().cast::<c_uchar>(),
                    states.len() as c_int,
                );
            }
        }
    }

    unsafe fn request_standalone_host_full_screen(
        xlib: &xlib::Xlib,
        display: *mut xlib::Display,
        window: xlib::Window,
        full_screen: bool,
    ) {
        let state_atom_name = CString::new("_NET_WM_STATE").expect("static atom");
        let full_screen_atom_name = CString::new("_NET_WM_STATE_FULLSCREEN").expect("static atom");
        let state_atom = (xlib.XInternAtom)(display, state_atom_name.as_ptr(), xlib::False);
        let full_screen_atom =
            (xlib.XInternAtom)(display, full_screen_atom_name.as_ptr(), xlib::False);
        if state_atom == 0 || full_screen_atom == 0 {
            return;
        }

        let mut data = xlib::ClientMessageData::new();
        data.set_long(0, if full_screen { 1 } else { 0 });
        data.set_long(1, full_screen_atom as c_long);
        data.set_long(3, 1);
        let client_message = xlib::XClientMessageEvent {
            type_: xlib::ClientMessage,
            serial: 0,
            send_event: xlib::True,
            display,
            window,
            message_type: state_atom,
            format: 32,
            data,
        };
        let mut event = xlib::XEvent::from(client_message);
        let root = (xlib.XDefaultRootWindow)(display);
        (xlib.XSendEvent)(
            display,
            root,
            xlib::False,
            xlib::SubstructureRedirectMask | xlib::SubstructureNotifyMask,
            &mut event,
        );
        (xlib.XFlush)(display);
    }

    fn next_activation_generation(surface: &mut NativeSurface) {
        surface.activation_generation = surface.activation_generation.wrapping_add(1);
        if surface.activation_generation == 0 {
            surface.activation_generation = 1;
        }
    }

    fn cancel_standalone_host_activation(surface: &mut NativeSurface) {
        surface.activation_request = None;
        surface.activation_requested_for_input_epoch = false;
    }

    unsafe fn restore_standalone_host_inert_input(
        surface: &mut NativeSurface,
    ) -> Result<(), Error> {
        if !surface.managed_host || surface.parent_window.is_some() {
            return Ok(());
        }

        next_activation_generation(surface);
        cancel_standalone_host_activation(surface);
        surface.input_activation_commit = None;
        surface.input_activation_prepared = false;

        // Always re-assert and read back both pieces of the inert policy. The
        // cached flag alone cannot prove that a partially completed focus
        // transition did not leave WM_HINTS eligible while the input shape is
        // empty (or vice versa).
        apply_host_input_mode(
            &surface.xlib,
            surface.xfixes.as_ref(),
            surface.xshape.as_ref(),
            surface.display,
            surface.window,
            true,
        )?;
        surface.input_passthrough = true;
        Ok(())
    }

    unsafe fn fail_standalone_host_input_activation(
        surface: &mut NativeSurface,
    ) -> Result<(), Error> {
        let input_result = restore_standalone_host_inert_input(surface);
        if let Err(error) = input_result {
            surface.activation_commit_failed = true;
            surface.activation_commit_failure_count =
                surface.activation_commit_failure_count.wrapping_add(1);
            return Err(error);
        }
        let opacity_result = apply_host_opacity(
            &surface.xlib,
            surface.display,
            surface.window,
            surface.opacity_atom,
            false,
        );
        if opacity_result.is_ok() {
            surface.opaque = false;
        }
        surface.activation_commit_failed = true;
        surface.activation_commit_failure_count =
            surface.activation_commit_failure_count.wrapping_add(1);

        opacity_result
    }

    unsafe fn prepare_standalone_host_input_activation(
        surface: &mut NativeSurface,
    ) -> Result<(), Error> {
        if !surface.managed_host || surface.parent_window.is_some() {
            return Err(Error::from_reason(
                "Native overlay activation requires a standalone managed host",
            ));
        }
        if surface.input_activation_prepared {
            return Ok(());
        }
        if !surface.input_passthrough || surface.opaque {
            return Err(Error::from_reason(
                "Native overlay activation preparation requires an inert transparent host",
            ));
        }

        next_activation_generation(surface);
        cancel_standalone_host_activation(surface);
        surface.input_activation_commit = None;
        surface.activation_commit_failed = false;

        // KWin's wantsInput() consults WM_HINTS during its opacity-edge
        // activation. Advertise focus eligibility now, but deliberately leave
        // the XFixes input shape empty so this transparent preparation phase
        // cannot capture a click.
        apply_host_input_hint(&surface.xlib, surface.display, surface.window, true)?;
        surface.input_activation_prepared = true;
        Ok(())
    }

    unsafe fn arm_standalone_host_input_commit(surface: &mut NativeSurface) -> Result<(), Error> {
        if !surface.managed_host || surface.parent_window.is_some() {
            return Err(Error::from_reason(
                "Native overlay activation requires a standalone managed host",
            ));
        }
        if !surface.overlay_active
            || !surface.input_activation_prepared
            || !surface.input_passthrough
            || !surface.opaque
        {
            return Err(Error::from_reason(
                "Native overlay activation commit requires an active opaque prepared host",
            ));
        }
        if surface
            .input_activation_commit
            .as_ref()
            .is_some_and(|commit| commit.generation == surface.activation_generation)
        {
            return Ok(());
        }

        surface.input_activation_commit = Some(StandaloneHostInputCommit {
            generation: surface.activation_generation,
            deadline: Instant::now() + STANDALONE_HOST_ACTIVATION_TIMEOUT,
            remaining_pump_observations: STANDALONE_HOST_ACTIVATION_MAX_PUMP_OBSERVATIONS,
            consecutive_focus_observations: 0,
        });
        Ok(())
    }

    unsafe fn arm_standalone_host_wm_activation(surface: &mut NativeSurface) -> Result<(), Error> {
        if !surface.managed_host
            || surface.parent_window.is_some()
            || !surface.overlay_active
            || !surface.input_activation_prepared
            || !surface.input_passthrough
            || !surface.opaque
        {
            return Err(Error::from_reason(
                "Window-manager activation requires an active opaque prepared host",
            ));
        }
        if surface.activation_requested_for_input_epoch {
            return Ok(());
        }

        surface.activation_requested_for_input_epoch = true;
        surface.activation_request = Some(StandaloneHostActivationRequest {
            generation: surface.activation_generation,
            deadline: Instant::now() + STANDALONE_HOST_ACTIVATION_TIMEOUT,
            remaining_pump_observations: STANDALONE_HOST_ACTIVATION_MAX_PUMP_OBSERVATIONS,
            sent: false,
        });
        // Send immediately if the compositor has already mapped the host, but
        // do not consume one of the later native-pump observations here.
        advance_standalone_host_activation(surface, false)
    }

    unsafe fn advance_standalone_host_activation(
        surface: &mut NativeSurface,
        count_pump_observation: bool,
    ) -> Result<(), Error> {
        let Some(mut request) = surface.activation_request.take() else {
            return Ok(());
        };
        if request.generation != surface.activation_generation
            || !surface.managed_host
            || surface.parent_window.is_some()
            || !surface.overlay_active
            || !surface.input_activation_prepared
            || !surface.input_passthrough
            || !surface.opaque
            || Instant::now() >= request.deadline
        {
            return Ok(());
        }
        if count_pump_observation {
            if request.remaining_pump_observations == 0 {
                return Ok(());
            }
            request.remaining_pump_observations -= 1;
        }

        let mut attributes: xlib::XWindowAttributes = mem::MaybeUninit::zeroed().assume_init();
        if (surface.xlib.XGetWindowAttributes)(surface.display, surface.window, &mut attributes)
            == 0
        {
            return Err(Error::from_reason(
                "Could not inspect the native overlay host before activation",
            ));
        }

        if !request.sent && attributes.map_state == xlib::IsViewable {
            request_standalone_host_activation(
                &surface.xlib,
                surface.display,
                attributes.root,
                surface.window,
            )?;
            request.sent = true;
            surface.activation_request_count = surface.activation_request_count.wrapping_add(1);
        }

        // _NET_ACTIVE_WINDOW is one-shot per prepared generation. Focus is
        // confirmed independently by the deferred input-commit state machine.
        if !request.sent
            && request.remaining_pump_observations > 0
            && Instant::now() < request.deadline
        {
            surface.activation_request = Some(request);
        }
        Ok(())
    }

    unsafe fn advance_standalone_host_input_commit(
        surface: &mut NativeSurface,
    ) -> Result<(), Error> {
        let Some(mut commit) = surface.input_activation_commit.take() else {
            return Ok(());
        };
        if commit.generation != surface.activation_generation {
            return Ok(());
        }
        if !surface.managed_host
            || surface.parent_window.is_some()
            || !surface.overlay_active
            || !surface.input_activation_prepared
            || !surface.input_passthrough
            || !surface.opaque
        {
            return restore_standalone_host_inert_input(surface);
        }
        if Instant::now() >= commit.deadline || commit.remaining_pump_observations == 0 {
            return fail_standalone_host_input_activation(surface);
        }
        commit.remaining_pump_observations -= 1;

        let mut attributes: xlib::XWindowAttributes = mem::MaybeUninit::zeroed().assume_init();
        if (surface.xlib.XGetWindowAttributes)(surface.display, surface.window, &mut attributes)
            == 0
        {
            return fail_standalone_host_input_activation(surface);
        }
        let mut focused_window: xlib::Window = 0;
        let mut revert_to: c_int = 0;
        if (surface.xlib.XGetInputFocus)(surface.display, &mut focused_window, &mut revert_to) == 0
        {
            return fail_standalone_host_input_activation(surface);
        }

        if attributes.map_state == xlib::IsViewable && focused_window == surface.window {
            commit.consecutive_focus_observations =
                commit.consecutive_focus_observations.saturating_add(1);
        } else {
            commit.consecutive_focus_observations = 0;
        }

        if commit.consecutive_focus_observations >= STANDALONE_HOST_FOCUS_CONFIRMATION_OBSERVATIONS
        {
            if apply_host_input_mode(
                &surface.xlib,
                surface.xfixes.as_ref(),
                surface.xshape.as_ref(),
                surface.display,
                surface.window,
                false,
            )
            .is_err()
            {
                return fail_standalone_host_input_activation(surface);
            }
            surface.input_passthrough = false;
            surface.input_activation_prepared = false;
            cancel_standalone_host_activation(surface);
            surface.activation_commit_failed = false;
            return Ok(());
        }

        if commit.remaining_pump_observations == 0 || Instant::now() >= commit.deadline {
            return fail_standalone_host_input_activation(surface);
        }
        surface.input_activation_commit = Some(commit);
        Ok(())
    }

    unsafe fn request_standalone_host_activation(
        xlib: &xlib::Xlib,
        display: *mut xlib::Display,
        root: xlib::Window,
        window: xlib::Window,
    ) -> Result<(), Error> {
        let active_window_atom_name = CString::new("_NET_ACTIVE_WINDOW").expect("static atom");
        let active_window_atom =
            (xlib.XInternAtom)(display, active_window_atom_name.as_ptr(), xlib::False);
        if active_window_atom == 0 {
            return Err(Error::from_reason(
                "Could not resolve _NET_ACTIVE_WINDOW for native overlay activation",
            ));
        }

        let mut data = xlib::ClientMessageData::new();
        data.set_long(0, 1); // EWMH source indication: normal application.
        data.set_long(1, xlib::CurrentTime as c_long);
        data.set_long(2, 0); // No independently known currently-active top level.
        let client_message = xlib::XClientMessageEvent {
            type_: xlib::ClientMessage,
            serial: 0,
            send_event: xlib::True,
            display,
            window,
            message_type: active_window_atom,
            format: 32,
            data,
        };
        let mut event = xlib::XEvent::from(client_message);
        if (xlib.XSendEvent)(
            display,
            root,
            xlib::False,
            xlib::SubstructureRedirectMask | xlib::SubstructureNotifyMask,
            &mut event,
        ) == 0
        {
            return Err(Error::from_reason(
                "The window manager rejected native overlay activation",
            ));
        }
        (xlib.XSync)(display, xlib::False);
        Ok(())
    }

    unsafe fn apply_standalone_host_presentation_marker(
        xlib: &xlib::Xlib,
        display: *mut xlib::Display,
        window: xlib::Window,
        marker: &str,
    ) -> Result<(), Error> {
        if marker.is_empty() {
            return Err(Error::from_reason(
                "Native overlay presentation marker cannot be empty",
            ));
        }
        let role_atom_name = CString::new("WM_WINDOW_ROLE").expect("static atom");
        let role_atom = (xlib.XInternAtom)(display, role_atom_name.as_ptr(), xlib::False);
        if role_atom == 0 {
            return Err(Error::from_reason(
                "Could not resolve WM_WINDOW_ROLE for the native overlay host",
            ));
        }
        (xlib.XChangeProperty)(
            display,
            window,
            role_atom,
            xlib::XA_STRING,
            8,
            xlib::PropModeReplace,
            marker.as_bytes().as_ptr(),
            marker.len() as c_int,
        );
        // Complete the request and read the exact bytes back before reporting
        // success to JavaScript. Strict/degraded marker acknowledgements gate
        // whether a mapped host may regain opacity and input.
        (xlib.XSync)(display, xlib::False);
        let mut actual_type: xlib::Atom = 0;
        let mut actual_format: c_int = 0;
        let mut item_count: c_ulong = 0;
        let mut bytes_after: c_ulong = 0;
        let mut property: *mut c_uchar = ptr::null_mut();
        let long_length = ((marker.len() + 3) / 4).max(1) as c_long;
        let status = (xlib.XGetWindowProperty)(
            display,
            window,
            role_atom,
            0,
            long_length,
            xlib::False,
            xlib::XA_STRING,
            &mut actual_type,
            &mut actual_format,
            &mut item_count,
            &mut bytes_after,
            &mut property,
        );
        let matches = status == 0
            && actual_type == xlib::XA_STRING
            && actual_format == 8
            && bytes_after == 0
            && item_count as usize == marker.len()
            && !property.is_null()
            && std::slice::from_raw_parts(property, item_count as usize) == marker.as_bytes();
        if !property.is_null() {
            (xlib.XFree)(property.cast::<c_void>());
        }
        if !matches {
            return Err(Error::from_reason(
                "Could not confirm WM_WINDOW_ROLE on the native overlay host",
            ));
        }
        Ok(())
    }

    unsafe fn apply_host_input_mode(
        xlib: &xlib::Xlib,
        xfixes: Option<&xfixes::Xlib>,
        xshape: Option<&XShapeLibrary>,
        display: *mut xlib::Display,
        window: xlib::Window,
        pass_through: bool,
    ) -> Result<(), Error> {
        let mut input_shape_ready = false;
        if let Some(xfixes) = xfixes {
            let mut event_base = 0;
            let mut error_base = 0;
            if (xfixes.XFixesQueryExtension)(display, &mut event_base, &mut error_base) != 0 {
                let region = if pass_through {
                    (xfixes.XFixesCreateRegion)(display, ptr::null_mut(), 0)
                } else {
                    0
                };
                if pass_through && region == 0 {
                    return Err(Error::from_reason(
                        "Could not create the empty XFixes input region for the native overlay host",
                    ));
                }
                (xfixes.XFixesSetWindowShapeRegion)(display, window, SHAPE_INPUT, 0, 0, region);
                if region != 0 {
                    (xfixes.XFixesDestroyRegion)(display, region);
                }
                (xlib.XSync)(display, xlib::False);

                let Some(xshape) = xshape else {
                    return Err(Error::from_reason(
                        "Could not inspect the Shape input region for the native overlay host",
                    ));
                };
                let mut rectangle_count: c_int = -1;
                let mut ordering: c_int = 0;
                let rectangles = (xshape.get_rectangles)(
                    display,
                    window,
                    SHAPE_INPUT,
                    &mut rectangle_count,
                    &mut ordering,
                );
                let first_rectangle = if rectangle_count > 0 && !rectangles.is_null() {
                    let rectangle = *rectangles;
                    Some((rectangle.x, rectangle.y, rectangle.width, rectangle.height))
                } else {
                    None
                };
                let mut window_attributes: xlib::XWindowAttributes =
                    mem::MaybeUninit::zeroed().assume_init();
                let enabled_rectangle = if !pass_through
                    && (xlib.XGetWindowAttributes)(display, window, &mut window_attributes) != 0
                {
                    let border = window_attributes.border_width.max(0);
                    let x = -border;
                    let y = -border;
                    let width = window_attributes
                        .width
                        .saturating_add(border.saturating_mul(2));
                    let height = window_attributes
                        .height
                        .saturating_add(border.saturating_mul(2));
                    if x >= i16::MIN as c_int
                        && y >= i16::MIN as c_int
                        && width > 0
                        && height > 0
                        && width <= u16::MAX as c_int
                        && height <= u16::MAX as c_int
                    {
                        Some((x as i16, y as i16, width as u16, height as u16))
                    } else {
                        None
                    }
                } else {
                    None
                };
                let expected_shape = input_shape_readback_matches(
                    pass_through,
                    rectangle_count,
                    rectangles.is_null(),
                    first_rectangle,
                    enabled_rectangle,
                );
                if !rectangles.is_null() {
                    (xlib.XFree)(rectangles.cast::<c_void>());
                }
                if !expected_shape {
                    return Err(Error::from_reason(if pass_through {
                        "Could not confirm the empty Shape input region for the native overlay host"
                    } else {
                        "Could not confirm the enabled Shape input region for the native overlay host"
                    }));
                }
                input_shape_ready = true;
            }
        }
        if !input_shape_ready {
            return Err(Error::from_reason(
                "Could not establish the XFixes input shape for the native overlay host",
            ));
        }

        apply_host_input_hint(xlib, display, window, !pass_through)
    }

    unsafe fn apply_host_input_hint(
        xlib: &xlib::Xlib,
        display: *mut xlib::Display,
        window: xlib::Window,
        wants_input: bool,
    ) -> Result<(), Error> {
        let mut wm_hints: xlib::XWMHints = mem::MaybeUninit::zeroed().assume_init();
        wm_hints.flags = xlib::InputHint;
        wm_hints.input = if wants_input { xlib::True } else { xlib::False };
        if (xlib.XSetWMHints)(display, window, &mut wm_hints) == 0 {
            return Err(Error::from_reason(
                "Could not set WM_HINTS input policy on the native overlay host",
            ));
        }
        (xlib.XSync)(display, xlib::False);

        let observed_hints = (xlib.XGetWMHints)(display, window);
        if observed_hints.is_null() {
            return Err(Error::from_reason(
                "Could not inspect WM_HINTS input policy on the native overlay host",
            ));
        }
        let observed = *observed_hints;
        (xlib.XFree)(observed_hints.cast::<c_void>());
        let observed_wants_input = observed.input != xlib::False;
        if observed.flags & xlib::InputHint == 0 || observed_wants_input != wants_input {
            return Err(Error::from_reason(
                "Could not confirm WM_HINTS input policy on the native overlay host",
            ));
        }
        Ok(())
    }

    unsafe fn apply_standalone_host_shape(
        xfixes: Option<&xfixes::Xlib>,
        display: *mut xlib::Display,
        window: xlib::Window,
        width: c_uint,
        height: c_uint,
        full_screen: bool,
    ) {
        let Some(xfixes) = xfixes else {
            return;
        };
        if full_screen
            || width <= WINDOWED_BOTTOM_CORNER_RADIUS * 2
            || height <= WINDOWED_BOTTOM_CORNER_RADIUS
            || width > u16::MAX as c_uint
            || height > i16::MAX as c_uint
        {
            (xfixes.XFixesSetWindowShapeRegion)(display, window, SHAPE_BOUNDING, 0, 0, 0);
            (xfixes.XFixesSetWindowShapeRegion)(display, window, SHAPE_CLIP, 0, 0, 0);
            return;
        }

        let width = width as u16;
        let height = height as u16;
        let radius = WINDOWED_BOTTOM_CORNER_RADIUS as u16;
        let insets = [0u16, 0, 1, 1, 2, 3, 4, 6];
        let mut rectangles = Vec::with_capacity(insets.len() + 1);
        rectangles.push(xlib::XRectangle {
            x: 0,
            y: 0,
            width,
            height: height - radius,
        });
        for (row, inset) in insets.into_iter().enumerate() {
            rectangles.push(xlib::XRectangle {
                x: inset as i16,
                y: (height - radius + row as u16) as i16,
                width: width - inset * 2,
                height: 1,
            });
        }
        let region = (xfixes.XFixesCreateRegion)(
            display,
            rectangles.as_mut_ptr(),
            rectangles.len() as c_int,
        );
        if region == 0 {
            return;
        }
        (xfixes.XFixesSetWindowShapeRegion)(display, window, SHAPE_BOUNDING, 0, 0, region);
        (xfixes.XFixesSetWindowShapeRegion)(display, window, SHAPE_CLIP, 0, 0, region);
        (xfixes.XFixesDestroyRegion)(display, region);
    }

    unsafe fn apply_host_opacity(
        xlib: &xlib::Xlib,
        display: *mut xlib::Display,
        window: xlib::Window,
        opacity_atom: xlib::Atom,
        opaque: bool,
    ) -> Result<(), Error> {
        if opacity_atom == 0 {
            return Err(Error::from_reason(
                "Could not resolve _NET_WM_WINDOW_OPACITY for the native overlay host",
            ));
        }
        let opacity: c_ulong = if opaque { u32::MAX as c_ulong } else { 0 };
        (xlib.XChangeProperty)(
            display,
            window,
            opacity_atom,
            xlib::XA_CARDINAL,
            32,
            xlib::PropModeReplace,
            (&opacity as *const c_ulong).cast::<c_uchar>(),
            1,
        );
        (xlib.XSync)(display, xlib::False);
        let mut actual_type: xlib::Atom = 0;
        let mut actual_format: c_int = 0;
        let mut item_count: c_ulong = 0;
        let mut bytes_after: c_ulong = 0;
        let mut property: *mut c_uchar = ptr::null_mut();
        let status = (xlib.XGetWindowProperty)(
            display,
            window,
            opacity_atom,
            0,
            1,
            xlib::False,
            xlib::XA_CARDINAL,
            &mut actual_type,
            &mut actual_format,
            &mut item_count,
            &mut bytes_after,
            &mut property,
        );
        let matches = status == 0
            && actual_type == xlib::XA_CARDINAL
            && actual_format == 32
            && item_count == 1
            && bytes_after == 0
            && !property.is_null()
            // XGetWindowProperty stores protocol format-32 CARDINALs in a
            // native long. Xlib sign-extends values with bit 31 set on LP64,
            // so compare only the 32 bits that exist on the wire.
            && x11_cardinal32_readback_matches(
                *(property.cast::<c_ulong>()) as u64,
                opacity as u32,
            );
        if !property.is_null() {
            (xlib.XFree)(property.cast::<c_void>());
        }
        if !matches {
            return Err(Error::from_reason(
                "Could not confirm _NET_WM_WINDOW_OPACITY on the native overlay host",
            ));
        }
        Ok(())
    }

    unsafe fn create_dri3_dma_buf_importer(
        xlib: &xlib::Xlib,
        display: *mut xlib::Display,
        glx_dispatch: &GlxDispatch,
    ) -> Result<Dri3DmaBufImporter, Error> {
        let x11_xcb_library = Library::new("libX11-xcb.so.1")
            .or_else(|_| Library::new("libX11-xcb.so"))
            .map_err(|error| {
                Error::from_reason(format!(
                    "Failed to load Xlib-XCB for Linux shared texture import: {error}",
                ))
            })?;
        let get_xcb_connection = *x11_xcb_library
            .get::<XGetXcbConnection>(b"XGetXCBConnection\0")
            .map_err(|error| {
                Error::from_reason(format!("Failed to load XGetXCBConnection: {error}"))
            })?;
        let connection = get_xcb_connection(display);
        if connection.is_null() {
            return Err(Error::from_reason(
                "Xlib did not expose its XCB connection for Linux shared texture import",
            ));
        }

        let xcb_library = Library::new("libxcb.so.1")
            .or_else(|_| Library::new("libxcb.so"))
            .map_err(|error| {
                Error::from_reason(format!(
                    "Failed to load XCB for Linux shared texture import: {error}"
                ))
            })?;
        let generate_id = *xcb_library
            .get::<XcbGenerateId>(b"xcb_generate_id\0")
            .map_err(|error| {
                Error::from_reason(format!("Failed to load xcb_generate_id: {error}"))
            })?;
        let flush = *xcb_library
            .get::<XcbFlush>(b"xcb_flush\0")
            .map_err(|error| Error::from_reason(format!("Failed to load xcb_flush: {error}")))?;
        let request_check = *xcb_library
            .get::<XcbRequestCheck>(b"xcb_request_check\0")
            .map_err(|error| {
                Error::from_reason(format!("Failed to load xcb_request_check: {error}"))
            })?;
        let free_pixmap_checked = *xcb_library
            .get::<XcbFreePixmapChecked>(b"xcb_free_pixmap_checked\0")
            .map_err(|error| {
                Error::from_reason(format!("Failed to load xcb_free_pixmap_checked: {error}"))
            })?;

        let xcb_dri3_library = Library::new("libxcb-dri3.so.0")
            .or_else(|_| Library::new("libxcb-dri3.so"))
            .map_err(|error| {
                Error::from_reason(format!(
                    "Failed to load XCB DRI3 for Linux shared texture import: {error}",
                ))
            })?;
        let pixmap_from_buffer_checked = *xcb_dri3_library
            .get::<XcbDri3PixmapFromBufferChecked>(b"xcb_dri3_pixmap_from_buffer_checked\0")
            .map_err(|error| {
                Error::from_reason(format!(
                    "Failed to load xcb_dri3_pixmap_from_buffer_checked: {error}",
                ))
            })?;

        let choose_fb_config_pointer =
            (glx_dispatch.get_proc_address)(b"glXChooseFBConfig\0".as_ptr())
                .ok_or_else(|| Error::from_reason("GLX does not expose glXChooseFBConfig"))?;
        let choose_fb_config =
            mem::transmute::<unsafe extern "C" fn(), GlXChooseFbConfig>(choose_fb_config_pointer);
        let get_visual_pointer = (glx_dispatch.get_proc_address)(
            b"glXGetVisualFromFBConfig\0".as_ptr(),
        )
        .ok_or_else(|| Error::from_reason("GLX does not expose glXGetVisualFromFBConfig"))?;
        let get_visual =
            mem::transmute::<unsafe extern "C" fn(), GlXGetVisualFromFbConfig>(get_visual_pointer);
        let get_fb_config_attrib_pointer =
            (glx_dispatch.get_proc_address)(b"glXGetFBConfigAttrib\0".as_ptr())
                .ok_or_else(|| Error::from_reason("GLX does not expose glXGetFBConfigAttrib"))?;
        let get_fb_config_attrib = mem::transmute::<unsafe extern "C" fn(), GlXGetFbConfigAttrib>(
            get_fb_config_attrib_pointer,
        );
        let create_pixmap_pointer = (glx_dispatch.get_proc_address)(b"glXCreatePixmap\0".as_ptr())
            .ok_or_else(|| Error::from_reason("GLX does not expose glXCreatePixmap"))?;
        let create_pixmap =
            mem::transmute::<unsafe extern "C" fn(), GlXCreatePixmap>(create_pixmap_pointer);
        let destroy_pixmap_pointer =
            (glx_dispatch.get_proc_address)(b"glXDestroyPixmap\0".as_ptr())
                .ok_or_else(|| Error::from_reason("GLX does not expose glXDestroyPixmap"))?;
        let destroy_pixmap =
            mem::transmute::<unsafe extern "C" fn(), GlXDestroyPixmap>(destroy_pixmap_pointer);
        let bind_tex_image_pointer =
            (glx_dispatch.get_proc_address)(b"glXBindTexImageEXT\0".as_ptr())
                .ok_or_else(|| Error::from_reason("GLX does not expose glXBindTexImageEXT"))?;
        let bind_tex_image =
            mem::transmute::<unsafe extern "C" fn(), GlXBindTexImageExt>(bind_tex_image_pointer);
        let release_tex_image_pointer =
            (glx_dispatch.get_proc_address)(b"glXReleaseTexImageEXT\0".as_ptr())
                .ok_or_else(|| Error::from_reason("GLX does not expose glXReleaseTexImageEXT"))?;
        let release_tex_image = mem::transmute::<unsafe extern "C" fn(), GlXReleaseTexImageExt>(
            release_tex_image_pointer,
        );

        let attributes = [
            GLX_X_RENDERABLE,
            xlib::True,
            GLX_DRAWABLE_TYPE,
            GLX_PIXMAP_BIT,
            GLX_RENDER_TYPE,
            GLX_RGBA_BIT,
            glx::GLX_RED_SIZE,
            8,
            glx::GLX_GREEN_SIZE,
            8,
            glx::GLX_BLUE_SIZE,
            8,
            glx::GLX_ALPHA_SIZE,
            8,
            GLX_BIND_TO_TEXTURE_RGBA_EXT,
            xlib::True,
            GLX_BIND_TO_TEXTURE_TARGETS_EXT,
            GLX_TEXTURE_2D_BIT_EXT,
            0,
        ];
        let screen = (xlib.XDefaultScreen)(display);
        let mut config_count = 0;
        let configs = choose_fb_config(display, screen, attributes.as_ptr(), &mut config_count);
        if configs.is_null() || config_count <= 0 {
            return Err(Error::from_reason(
                "GLX did not expose a BGRA pixmap texture configuration",
            ));
        }
        let mut fb_config = ptr::null_mut();
        for config in std::slice::from_raw_parts(configs, config_count as usize) {
            let visual = get_visual(display, *config);
            if !visual.is_null() {
                let depth_matches = (*visual).depth == 32;
                (xlib.XFree)(visual.cast::<c_void>());
                if depth_matches {
                    fb_config = *config;
                    break;
                }
            }
        }
        (xlib.XFree)(configs.cast::<c_void>());
        if fb_config.is_null() {
            return Err(Error::from_reason(
                "GLX did not expose a depth-32 BGRA pixmap texture configuration",
            ));
        }
        let mut y_inverted = 0;
        let y_inverted_status =
            get_fb_config_attrib(display, fb_config, GLX_Y_INVERTED_EXT, &mut y_inverted);
        if y_inverted_status != 0 {
            return Err(Error::from_reason(format!(
                "GLX could not report GLX_Y_INVERTED_EXT for Linux shared texture import (status {y_inverted_status})",
            )));
        }

        Ok(Dri3DmaBufImporter {
            _x11_xcb_library: x11_xcb_library,
            _xcb_library: xcb_library,
            _xcb_dri3_library: xcb_dri3_library,
            connection,
            root: (xlib.XDefaultRootWindow)(display) as c_uint,
            fb_config,
            y_inverted: y_inverted != 0,
            generate_id,
            flush,
            request_check,
            free_pixmap_checked,
            pixmap_from_buffer_checked,
            create_pixmap,
            destroy_pixmap,
            bind_tex_image,
            release_tex_image,
        })
    }

    unsafe fn free_dri3_pixmap(importer: &Dri3DmaBufImporter, pixmap: c_uint) {
        let cookie = (importer.free_pixmap_checked)(importer.connection, pixmap);
        let error = (importer.request_check)(importer.connection, cookie);
        if !error.is_null() {
            libc::free(error);
        }
        (importer.flush)(importer.connection);
    }

    #[allow(clippy::too_many_arguments)]
    unsafe fn copy_dri3_dma_buf_into_frame_texture(
        importer: &Dri3DmaBufImporter,
        renderer: &mut LinuxFrameRenderer,
        fd: i32,
        stride: u32,
        offset: u64,
        size: u64,
        width: c_int,
        height: c_int,
        xlib: &xlib::Xlib,
        display: *mut xlib::Display,
    ) -> Result<(), Error> {
        if offset != 0 {
            return Err(Error::from_reason(
                "Linux DRI3 shared texture import requires a zero plane offset",
            ));
        }
        if size > c_uint::MAX as u64
            || width > u16::MAX as c_int
            || height > u16::MAX as c_int
            || stride > u16::MAX as u32
        {
            return Err(Error::from_reason(
                "Linux DRI3 shared texture metadata exceeds protocol limits",
            ));
        }
        let duplicate_fd = BorrowedFd::borrow_raw(fd)
            .try_clone_to_owned()
            .map_err(|error| {
                Error::from_reason(format!(
                    "Could not duplicate the Electron dma-buf for DRI3 import: {error}",
                ))
            })?
            .into_raw_fd();
        let pixmap = (importer.generate_id)(importer.connection);
        if pixmap == 0 {
            libc::close(duplicate_fd);
            return Err(Error::from_reason(
                "XCB could not allocate a pixmap ID for Linux shared texture import",
            ));
        }
        let cookie = (importer.pixmap_from_buffer_checked)(
            importer.connection,
            pixmap,
            importer.root,
            size as c_uint,
            width as u16,
            height as u16,
            stride as u16,
            32,
            32,
            duplicate_fd,
        );
        let error = (importer.request_check)(importer.connection, cookie);
        if !error.is_null() {
            let error_code = *(error.cast::<u8>().add(1));
            libc::free(error);
            return Err(Error::from_reason(format!(
                "XCB DRI3 could not import the Electron dma-buf (X11 error {error_code})",
            )));
        }
        (importer.flush)(importer.connection);
        (xlib.XSync)(display, xlib::False);

        let pixmap_attributes = [
            GLX_TEXTURE_TARGET_EXT,
            GLX_TEXTURE_2D_EXT,
            GLX_TEXTURE_FORMAT_EXT,
            GLX_TEXTURE_FORMAT_RGBA_EXT,
            0,
        ];
        let (glx_pixmap, x11_error_code) = with_x11_error_trap(xlib, display, || {
            let glx_pixmap = (importer.create_pixmap)(
                display,
                importer.fb_config,
                pixmap as xlib::Pixmap,
                pixmap_attributes.as_ptr(),
            );
            (xlib.XSync)(display, xlib::False);
            glx_pixmap
        });
        if glx_pixmap == 0 || x11_error_code != 0 {
            free_dri3_pixmap(importer, pixmap);
            return Err(Error::from_reason(format!(
                "GLX could not create a texture pixmap from the DRI3 buffer (X11 error {x11_error_code})",
            )));
        }

        while gl::GetError() != gl::NO_ERROR {}
        let mut imported_texture = 0;
        gl::GenTextures(1, &mut imported_texture);
        gl::BindTexture(gl::TEXTURE_2D, imported_texture);
        gl::TexParameteri(gl::TEXTURE_2D, gl::TEXTURE_MIN_FILTER, gl::LINEAR as c_int);
        gl::TexParameteri(gl::TEXTURE_2D, gl::TEXTURE_MAG_FILTER, gl::LINEAR as c_int);
        (importer.bind_tex_image)(display, glx_pixmap, GLX_FRONT_LEFT_EXT, ptr::null());
        let bind_error = gl::GetError();
        if bind_error != gl::NO_ERROR {
            gl::BindTexture(gl::TEXTURE_2D, 0);
            gl::DeleteTextures(1, &imported_texture);
            (importer.destroy_pixmap)(display, glx_pixmap);
            free_dri3_pixmap(importer, pixmap);
            return Err(Error::from_reason(format!(
                "GLX could not bind the DRI3 pixmap as a texture (0x{bind_error:04X})",
            )));
        }

        gl::BindTexture(gl::TEXTURE_2D, renderer.texture);
        if renderer.texture_width != width || renderer.texture_height != height {
            gl::TexImage2D(
                gl::TEXTURE_2D,
                0,
                gl::RGBA8 as c_int,
                width,
                height,
                0,
                gl::RGBA,
                gl::UNSIGNED_BYTE,
                ptr::null(),
            );
        }
        let mut framebuffer = 0;
        gl::GenFramebuffers(1, &mut framebuffer);
        gl::BindFramebuffer(gl::FRAMEBUFFER, framebuffer);
        gl::FramebufferTexture2D(
            gl::FRAMEBUFFER,
            gl::COLOR_ATTACHMENT0,
            gl::TEXTURE_2D,
            renderer.texture,
            0,
        );
        let framebuffer_status = gl::CheckFramebufferStatus(gl::FRAMEBUFFER);
        if framebuffer_status == gl::FRAMEBUFFER_COMPLETE {
            gl::ActiveTexture(gl::TEXTURE0);
            gl::BindTexture(gl::TEXTURE_2D, imported_texture);
            gl::Disable(gl::BLEND);
            gl::Disable(gl::DEPTH_TEST);
            gl::Disable(gl::SCISSOR_TEST);
            gl::Viewport(0, 0, width, height);
            gl::UseProgram(renderer.program);
            gl::Uniform1i(
                renderer.flip_frame_y_uniform,
                c_int::from(importer.y_inverted),
            );
            gl::BindVertexArray(renderer.vertex_array);
            gl::DrawArrays(gl::TRIANGLE_STRIP, 0, 4);
            gl::BindVertexArray(0);
            gl::Uniform1i(renderer.flip_frame_y_uniform, 0);
            gl::UseProgram(0);
        }
        let copy_error = gl::GetError();
        gl::Finish();
        gl::BindFramebuffer(gl::FRAMEBUFFER, 0);
        gl::DeleteFramebuffers(1, &framebuffer);
        (importer.release_tex_image)(display, glx_pixmap, GLX_FRONT_LEFT_EXT);
        gl::BindTexture(gl::TEXTURE_2D, 0);
        gl::DeleteTextures(1, &imported_texture);
        (importer.destroy_pixmap)(display, glx_pixmap);
        free_dri3_pixmap(importer, pixmap);
        if framebuffer_status != gl::FRAMEBUFFER_COMPLETE {
            return Err(Error::from_reason(format!(
                "GL could not attach the retained Linux frame texture (0x{framebuffer_status:04X})",
            )));
        }
        if copy_error != gl::NO_ERROR {
            return Err(Error::from_reason(format!(
                "GL could not render the DRI3 shared texture into the retained frame (0x{copy_error:04X})",
            )));
        }
        renderer.texture_width = width;
        renderer.texture_height = height;
        Ok(())
    }

    unsafe fn draw_source_frame(surface: &mut NativeSurface) -> Result<(), Error> {
        if surface.frame_renderer.is_none() {
            if surface.source_frame.is_none() {
                return Ok(());
            }
            surface.frame_renderer = Some(create_frame_renderer()?);
        }
        let renderer = surface
            .frame_renderer
            .as_mut()
            .expect("Linux frame renderer was just initialized");

        gl::ActiveTexture(gl::TEXTURE0);
        gl::BindTexture(gl::TEXTURE_2D, renderer.texture);
        gl::PixelStorei(gl::UNPACK_ALIGNMENT, 4);
        if surface.source_frame_dirty {
            let frame = surface.source_frame.as_ref().ok_or_else(|| {
                Error::from_reason("Linux CPU frame was marked dirty without frame data")
            })?;
            if renderer.texture_width != frame.width || renderer.texture_height != frame.height {
                gl::TexImage2D(
                    gl::TEXTURE_2D,
                    0,
                    gl::RGBA8 as c_int,
                    frame.width,
                    frame.height,
                    0,
                    gl::BGRA,
                    gl::UNSIGNED_BYTE,
                    frame.data.as_ptr().cast::<c_void>(),
                );
                renderer.texture_width = frame.width;
                renderer.texture_height = frame.height;
            } else {
                gl::TexSubImage2D(
                    gl::TEXTURE_2D,
                    0,
                    0,
                    0,
                    frame.width,
                    frame.height,
                    gl::BGRA,
                    gl::UNSIGNED_BYTE,
                    frame.data.as_ptr().cast::<c_void>(),
                );
            }
            surface.source_frame_dirty = false;
            surface.frame_upload_count = surface.frame_upload_count.wrapping_add(1);
        }

        gl::Disable(gl::BLEND);
        gl::Disable(gl::DEPTH_TEST);
        gl::Disable(gl::SCISSOR_TEST);
        gl::Viewport(
            0,
            0,
            surface.viewport_width.min(c_int::MAX as u32) as c_int,
            surface.viewport_height.min(c_int::MAX as u32) as c_int,
        );
        gl::UseProgram(renderer.program);
        gl::Uniform1i(renderer.flip_frame_y_uniform, 0);
        gl::BindVertexArray(renderer.vertex_array);
        gl::DrawArrays(gl::TRIANGLE_STRIP, 0, 4);
        gl::BindVertexArray(0);
        gl::UseProgram(0);
        gl::BindTexture(gl::TEXTURE_2D, 0);
        surface.frame_draw_count = surface.frame_draw_count.wrapping_add(1);
        Ok(())
    }

    unsafe fn create_frame_renderer() -> Result<LinuxFrameRenderer, Error> {
        let vertex_shader = compile_shader(
            gl::VERTEX_SHADER,
            r#"#version 130
const vec2 positions[4] = vec2[4](
    vec2(-1.0,  1.0),
    vec2(-1.0, -1.0),
    vec2( 1.0,  1.0),
    vec2( 1.0, -1.0)
);
const vec2 textureCoordinates[4] = vec2[4](
    vec2(0.0, 0.0),
    vec2(0.0, 1.0),
    vec2(1.0, 0.0),
    vec2(1.0, 1.0)
);
out vec2 frameTextureCoordinate;
void main() {
    gl_Position = vec4(positions[gl_VertexID], 0.0, 1.0);
    frameTextureCoordinate = textureCoordinates[gl_VertexID];
}
"#,
        )?;
        let fragment_shader = match compile_shader(
            gl::FRAGMENT_SHADER,
            r#"#version 130
uniform sampler2D frameTexture;
uniform int flipFrameY;
in vec2 frameTextureCoordinate;
out vec4 outputColor;
void main() {
    vec2 coordinate = vec2(
        frameTextureCoordinate.x,
        flipFrameY != 0 ? 1.0 - frameTextureCoordinate.y : frameTextureCoordinate.y
    );
    outputColor = texture(frameTexture, coordinate);
}
"#,
        ) {
            Ok(shader) => shader,
            Err(error) => {
                gl::DeleteShader(vertex_shader);
                return Err(error);
            }
        };

        let program = gl::CreateProgram();
        gl::AttachShader(program, vertex_shader);
        gl::AttachShader(program, fragment_shader);
        let output_name = CString::new("outputColor").expect("static shader output");
        gl::BindFragDataLocation(program, 0, output_name.as_ptr());
        gl::LinkProgram(program);
        gl::DeleteShader(vertex_shader);
        gl::DeleteShader(fragment_shader);

        let mut linked = 0;
        gl::GetProgramiv(program, gl::LINK_STATUS, &mut linked);
        if linked == 0 {
            let message = program_info_log(program);
            gl::DeleteProgram(program);
            return Err(Error::from_reason(format!(
                "Failed to link Linux native overlay frame shader: {message}"
            )));
        }

        gl::UseProgram(program);
        let sampler_name = CString::new("frameTexture").expect("static shader uniform");
        let sampler = gl::GetUniformLocation(program, sampler_name.as_ptr());
        if sampler >= 0 {
            gl::Uniform1i(sampler, 0);
        }
        let flip_frame_y_name = CString::new("flipFrameY").expect("static shader uniform");
        let flip_frame_y_uniform = gl::GetUniformLocation(program, flip_frame_y_name.as_ptr());
        if flip_frame_y_uniform < 0 {
            gl::UseProgram(0);
            gl::DeleteProgram(program);
            return Err(Error::from_reason(
                "Linux native overlay frame shader does not expose flipFrameY",
            ));
        }
        gl::Uniform1i(flip_frame_y_uniform, 0);
        gl::UseProgram(0);

        let mut vertex_array = 0;
        gl::GenVertexArrays(1, &mut vertex_array);
        let mut texture = 0;
        gl::GenTextures(1, &mut texture);
        gl::BindTexture(gl::TEXTURE_2D, texture);
        gl::TexParameteri(gl::TEXTURE_2D, gl::TEXTURE_MIN_FILTER, gl::LINEAR as c_int);
        gl::TexParameteri(gl::TEXTURE_2D, gl::TEXTURE_MAG_FILTER, gl::LINEAR as c_int);
        gl::TexParameteri(
            gl::TEXTURE_2D,
            gl::TEXTURE_WRAP_S,
            gl::CLAMP_TO_EDGE as c_int,
        );
        gl::TexParameteri(
            gl::TEXTURE_2D,
            gl::TEXTURE_WRAP_T,
            gl::CLAMP_TO_EDGE as c_int,
        );
        gl::BindTexture(gl::TEXTURE_2D, 0);

        Ok(LinuxFrameRenderer {
            program,
            flip_frame_y_uniform,
            vertex_array,
            texture,
            texture_width: 0,
            texture_height: 0,
        })
    }

    unsafe fn compile_shader(
        kind: gl::types::GLenum,
        source: &str,
    ) -> Result<gl::types::GLuint, Error> {
        let shader = gl::CreateShader(kind);
        let source = CString::new(source).expect("static shader source");
        gl::ShaderSource(shader, 1, &source.as_ptr(), ptr::null());
        gl::CompileShader(shader);
        let mut compiled = 0;
        gl::GetShaderiv(shader, gl::COMPILE_STATUS, &mut compiled);
        if compiled != 0 {
            return Ok(shader);
        }

        let message = shader_info_log(shader);
        gl::DeleteShader(shader);
        Err(Error::from_reason(format!(
            "Failed to compile Linux native overlay frame shader: {message}"
        )))
    }

    unsafe fn shader_info_log(shader: gl::types::GLuint) -> String {
        let mut length = 0;
        gl::GetShaderiv(shader, gl::INFO_LOG_LENGTH, &mut length);
        gl_info_log(length, |buffer, written| {
            gl::GetShaderInfoLog(shader, length, written, buffer)
        })
    }

    unsafe fn program_info_log(program: gl::types::GLuint) -> String {
        let mut length = 0;
        gl::GetProgramiv(program, gl::INFO_LOG_LENGTH, &mut length);
        gl_info_log(length, |buffer, written| {
            gl::GetProgramInfoLog(program, length, written, buffer)
        })
    }

    unsafe fn gl_info_log(
        length: c_int,
        read: impl FnOnce(*mut gl::types::GLchar, *mut c_int),
    ) -> String {
        if length <= 1 {
            return "no OpenGL diagnostic was provided".to_owned();
        }
        let mut bytes = vec![0_u8; length as usize];
        let mut written = 0;
        read(bytes.as_mut_ptr().cast::<gl::types::GLchar>(), &mut written);
        let written = (written.max(0) as usize).min(bytes.len());
        String::from_utf8_lossy(&bytes[..written])
            .trim_end_matches('\0')
            .to_owned()
    }

    unsafe extern "C" fn x11_error_trap_handler(
        display: *mut xlib::Display,
        event: *mut xlib::XErrorEvent,
    ) -> c_int {
        if X11_ERROR_TRAP_DISPLAY.load(Ordering::SeqCst) == display as usize {
            if !event.is_null() {
                X11_ERROR_TRAP_CODE.store((*event).error_code as c_int, Ordering::SeqCst);
            }
            return 0;
        }

        let previous = X11_ERROR_TRAP_PREVIOUS.load(Ordering::SeqCst);
        if previous != 0 {
            let handler: X11ErrorHandler = mem::transmute(previous);
            return handler(display, event);
        }
        0
    }

    unsafe fn with_x11_error_trap<T>(
        xlib: &xlib::Xlib,
        display: *mut xlib::Display,
        operation: impl FnOnce() -> T,
    ) -> (T, c_int) {
        // XSetErrorHandler is process-global. Serialize the very short trap
        // and drain this dedicated display first. When Xlib exposes a callable
        // prior handler we forward unrelated-display errors to it; a null
        // prior value represents Xlib's internal default and cannot be invoked
        // directly, so that extremely narrow overlap is intentionally benign.
        let _trap_guard = X11_ERROR_TRAP_LOCK
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner());
        (xlib.XSync)(display, xlib::False);
        X11_ERROR_TRAP_CODE.store(0, Ordering::SeqCst);
        let previous = (xlib.XSetErrorHandler)(Some(x11_error_trap_handler));
        X11_ERROR_TRAP_PREVIOUS.store(
            previous.map(|handler| handler as usize).unwrap_or(0),
            Ordering::SeqCst,
        );
        X11_ERROR_TRAP_DISPLAY.store(display as usize, Ordering::SeqCst);

        let result = operation();
        (xlib.XSync)(display, xlib::False);
        let error_code = X11_ERROR_TRAP_CODE.load(Ordering::SeqCst);

        X11_ERROR_TRAP_DISPLAY.store(0, Ordering::SeqCst);
        (xlib.XSetErrorHandler)(previous);
        X11_ERROR_TRAP_PREVIOUS.store(0, Ordering::SeqCst);
        (result, error_code)
    }

    unsafe fn resolve_glx_dispatch(glx: &glx::Glx) -> GlxDispatch {
        let choose_visual = process_glx_symbol::<GlXChooseVisual>(b"glXChooseVisual\0")
            .unwrap_or(glx.glXChooseVisual);
        let create_context = process_glx_symbol::<GlXCreateContext>(b"glXCreateContext\0")
            .unwrap_or(glx.glXCreateContext);
        let destroy_context = process_glx_symbol::<GlXDestroyContext>(b"glXDestroyContext\0")
            .unwrap_or(glx.glXDestroyContext);
        let make_current =
            process_glx_symbol::<GlXMakeCurrent>(b"glXMakeCurrent\0").unwrap_or(glx.glXMakeCurrent);
        let swap_buffers =
            process_glx_symbol::<GlXSwapBuffers>(b"glXSwapBuffers\0").unwrap_or(glx.glXSwapBuffers);
        let get_proc_address = process_glx_symbol::<GlXGetProcAddress>(b"glXGetProcAddress\0")
            .unwrap_or(glx.glXGetProcAddress);
        GlxDispatch {
            choose_visual,
            create_context,
            destroy_context,
            make_current,
            swap_buffers,
            get_proc_address,
            choose_visual_interposed: choose_visual as usize != glx.glXChooseVisual as usize,
            create_context_interposed: create_context as usize != glx.glXCreateContext as usize,
            destroy_context_interposed: destroy_context as usize != glx.glXDestroyContext as usize,
            make_current_interposed: make_current as usize != glx.glXMakeCurrent as usize,
            swap_buffers_interposed: swap_buffers as usize != glx.glXSwapBuffers as usize,
            get_proc_address_interposed: get_proc_address as usize
                != glx.glXGetProcAddress as usize,
        }
    }

    unsafe fn resolve_xlib_dispatch(xlib: &xlib::Xlib) -> XlibDispatch {
        // Steam's overlay consumes input by interposing XPending/XNextEvent.
        // Calling x11-dl's private libX11 table would bypass that hook and make
        // an otherwise correctly rendered overlay unable to receive input.
        let pending = process_symbol::<XPending>(b"XPending\0").unwrap_or(xlib.XPending);
        let next_event = process_symbol::<XNextEvent>(b"XNextEvent\0").unwrap_or(xlib.XNextEvent);
        XlibDispatch {
            pending,
            next_event,
            pending_interposed: pending as usize != xlib.XPending as usize,
            next_event_interposed: next_event as usize != xlib.XNextEvent as usize,
        }
    }

    unsafe fn disable_glx_swap_interval(
        dispatch: &GlxDispatch,
        display: *mut xlib::Display,
        drawable: c_ulong,
    ) -> &'static str {
        if let Some(set_interval) =
            glx_extension::<GlXSwapIntervalExt>(dispatch, b"glXSwapIntervalEXT\0")
        {
            set_interval(display, drawable, 0);
            return "ext-disabled";
        }
        if let Some(set_interval) =
            glx_extension::<GlXSwapIntervalMesa>(dispatch, b"glXSwapIntervalMESA\0")
        {
            if set_interval(0) == 0 {
                return "mesa-disabled";
            }
        }
        if let Some(set_interval) =
            glx_extension::<GlXSwapIntervalSgi>(dispatch, b"glXSwapIntervalSGI\0")
        {
            if set_interval(0) == 0 {
                return "sgi-disabled";
            }
        }
        "unavailable"
    }

    unsafe fn glx_extension<T: Copy>(dispatch: &GlxDispatch, name: &[u8]) -> Option<T> {
        (dispatch.get_proc_address)(name.as_ptr())
            .map(|function| mem::transmute_copy::<unsafe extern "C" fn(), T>(&function))
    }

    unsafe fn process_glx_symbol<T: Copy>(name: &[u8]) -> Option<T> {
        process_symbol(name)
    }

    unsafe fn process_symbol<T: Copy>(name: &[u8]) -> Option<T> {
        let process = libloading::os::unix::Library::this();
        process.get::<T>(name).ok().map(|symbol| *symbol)
    }

    fn load_gl_functions(dispatch: &GlxDispatch) {
        gl::load_with(|name| {
            let Ok(symbol) = CString::new(name) else {
                return ptr::null();
            };
            unsafe {
                (dispatch.get_proc_address)(symbol.as_ptr().cast())
                    .map(|function| function as *const () as *const c_void)
                    .unwrap_or(ptr::null())
            }
        });
    }

    #[cfg(test)]
    mod tests {
        use super::{supports_dri3_pixmap_modifier, CHROMIUM_NO_DRM_MODIFIER};

        #[test]
        fn dri3_pixmap_import_accepts_linear_and_unspecified_modifiers() {
            assert!(supports_dri3_pixmap_modifier(0));
            assert!(supports_dri3_pixmap_modifier(CHROMIUM_NO_DRM_MODIFIER));
            assert!(supports_dri3_pixmap_modifier(u64::MAX));
            assert!(!supports_dri3_pixmap_modifier(1));
        }
    }
}

#[cfg(target_os = "linux")]
pub use linux::*;
