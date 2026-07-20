#![allow(unexpected_cfgs)]

use napi::bindgen_prelude::{Buffer, Error};

#[cfg(target_os = "macos")]
mod macos {
    use super::{Buffer, Error};
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
    type NSInteger = i64;
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

    pub fn attach_to_parent(parent_handle: usize) -> Result<(), Error> {
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
        attach_to_parent(parent_handle)
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

    pub fn set_continuous_present(_continuous: bool) -> Result<(), Error> {
        Ok(())
    }

    pub fn set_full_screen(_full_screen: bool) -> Result<(), Error> {
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

        if width == 0 || height == 0 {
            return Err(Error::from_reason(
                "Native overlay frame dimensions must be non-zero",
            ));
        }

        let expected_len = width as usize * height as usize * 4;
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
        None
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

        let attach_as_child = env::var_os("STEAM_BRIDGE_MAC_NATIVE_CHILD_WINDOW").is_some();
        let titled_transparent_host = !attach_as_child
            && env::var_os("STEAM_BRIDGE_MAC_NATIVE_TITLED_TRANSPARENT_HOST").is_some();
        let transparent_host = !attach_as_child
            && (titled_transparent_host
                || env::var_os("STEAM_BRIDGE_MAC_NATIVE_TRANSPARENT_HOST").is_some());
        let transparent_background = attach_as_child || transparent_host;
        let titled_host = !attach_as_child
            && (titled_transparent_host
                || env::var_os("STEAM_BRIDGE_MAC_NATIVE_TITLED_HOST").is_some());
        let style = if titled_host {
            NS_WINDOW_STYLE_TITLED
                | NS_WINDOW_STYLE_CLOSABLE
                | NS_WINDOW_STYLE_MINIATURIZABLE
                | NS_WINDOW_STYLE_RESIZABLE
        } else {
            0_u64
        };
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
        if titled_host {
            let title = ns_string("Steam Bridge Overlay Host");
            let _: () = msg_send![window, setTitle: title];
        }
        let _: () = msg_send![window, setReleasedWhenClosed: NO];
        let _: () = msg_send![window, setIgnoresMouseEvents: NO];
        let _: () = msg_send![window, setAcceptsMouseMovedEvents: YES];

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

        if attach_as_child {
            let _: () = msg_send![parent_window, addChildWindow: window ordered: NS_WINDOW_ABOVE];
            let _: () = msg_send![parent_window, makeKeyAndOrderFront: NIL];
            let _: () = msg_send![window, orderFront: NIL];
        } else {
            let parent_level: NSInteger = msg_send![parent_window, level];
            let _: () = msg_send![window, setLevel: parent_level + 1];
            let _: () = msg_send![window, makeKeyAndOrderFront: NIL];
            let _: () = msg_send![window, orderFrontRegardless];
        }

        drain(pool);

        Ok(NativeSurface {
            owner: SurfaceOwner::EmbeddedWindow {
                window,
                parent_window,
                parent_view,
                attached_as_child: attach_as_child,
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

    fn ensure_main_thread() -> Result<(), Error> {
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

    pub fn open(
        _title: Option<String>,
        _client_width: Option<u32>,
        _client_height: Option<u32>,
    ) -> Result<(), Error> {
        Err(Error::from_reason(
            "Steam Bridge native overlay probe is not implemented on this platform",
        ))
    }

    pub fn attach_to_parent(_parent_handle: usize) -> Result<(), Error> {
        Err(Error::from_reason(
            "Steam Bridge native overlay host view is not implemented on this platform",
        ))
    }

    pub fn attach_to_parent_for_overlay(parent_handle: usize) -> Result<(), Error> {
        attach_to_parent(parent_handle)
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

    pub fn set_continuous_present(_continuous: bool) -> Result<(), Error> {
        Ok(())
    }

    pub fn set_full_screen(_full_screen: bool) -> Result<(), Error> {
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
    use super::{Buffer, Error};
    use crate::windows_d3d11::WindowsD3d11Renderer;
    use once_cell::sync::Lazy;
    use serde::{Deserialize, Serialize};
    use serde_json::json;
    use std::collections::HashMap;
    use std::env;
    use std::mem;
    use std::ptr;
    use std::sync::atomic::{AtomicU32, AtomicU64, Ordering};
    use std::sync::{Mutex, OnceLock};
    use std::time::{Duration, Instant, SystemTime, UNIX_EPOCH};
    use windows_sys::Win32::Foundation::{
        CloseHandle, GetLastError, SetLastError, HWND, LPARAM, LRESULT, POINT, RECT, SIZE, WPARAM,
    };
    use windows_sys::Win32::Graphics::Dwm::{
        DwmGetWindowAttribute, DwmSetWindowAttribute, DWMWA_EXTENDED_FRAME_BOUNDS,
        DWMWA_TRANSITIONS_FORCEDISABLED, DWMWA_WINDOW_CORNER_PREFERENCE, DWMWCP_DONOTROUND,
        DWMWCP_ROUND, DWMWCP_ROUNDSMALL,
    };
    use windows_sys::Win32::Graphics::Gdi::{
        BeginPaint, ClientToScreen, CombineRgn, CreateFontIndirectW, CreateRectRgn,
        CreateRoundRectRgn, DeleteObject, DrawFrameControl, DrawTextW, EndPaint, FillRect, GetDC,
        GetMonitorInfoW, GetStockObject, GetSysColor, GetSysColorBrush, GetTextExtentPoint32W,
        MonitorFromWindow, ReleaseDC, ScreenToClient, SelectObject, SetBkMode, SetTextColor,
        SetWindowRgn, COLOR_GRAYTEXT, COLOR_HIGHLIGHT, COLOR_HIGHLIGHTTEXT, COLOR_MENU,
        COLOR_MENUBAR, COLOR_MENUTEXT, DEFAULT_GUI_FONT, DFCS_INACTIVE, DFCS_MENUARROW, DFC_MENU,
        DT_HIDEPREFIX, DT_LEFT, DT_RIGHT, DT_SINGLELINE, DT_VCENTER, HDC, MONITORINFO,
        MONITOR_DEFAULTTONEAREST, PAINTSTRUCT, RGN_AND, TRANSPARENT,
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
        GetAsyncKeyState, GetCapture, ReleaseCapture, SetActiveWindow, SetCapture, SetFocus,
    };
    use windows_sys::Win32::UI::WindowsAndMessaging::{
        AppendMenuW, CreateCursor, CreateMenu, CreatePopupMenu, CreateWindowExW, DefWindowProcW,
        DestroyCursor, DestroyMenu, DestroyWindow, DispatchMessageW, DrawMenuBar, EnumWindows,
        GetAncestor, GetClassNameW, GetClientRect, GetCursorPos, GetForegroundWindow, GetMenu,
        GetMenuBarInfo, GetSystemMetrics, GetWindow, GetWindowLongPtrW, GetWindowPlacement,
        GetWindowRect, GetWindowTextW, GetWindowThreadProcessId, InsertMenuItemW, IsIconic,
        IsWindow, IsWindowVisible, IsZoomed, KillTimer, LoadCursorW, PeekMessageW, RegisterClassW,
        SetCursor, SetForegroundWindow, SetLayeredWindowAttributes, SetMenu, SetTimer,
        SetWindowLongPtrW, SetWindowPlacement, SetWindowPos, ShowCursor, ShowWindow,
        SystemParametersInfoW, TranslateMessage, CS_OWNDC, GA_ROOTOWNER, GWLP_HWNDPARENT,
        GWL_EXSTYLE, GWL_STYLE, GW_OWNER, HCURSOR, HMENU, IDC_ARROW, LWA_ALPHA, MA_NOACTIVATE,
        MENUBARINFO, MENUITEMINFOW, MFS_DISABLED, MFS_ENABLED, MFT_OWNERDRAW, MFT_SEPARATOR,
        MF_GRAYED, MF_POPUP, MF_SEPARATOR, MF_STRING, MIIM_DATA, MIIM_FTYPE, MIIM_ID, MIIM_STATE,
        MIIM_STRING, MIIM_SUBMENU, MINMAXINFO, MSG, NONCLIENTMETRICSW, OBJID_MENU, PM_REMOVE,
        SIZE_MINIMIZED, SM_CXMENUCHECK, SM_CXMENUSIZE, SM_CXSCREEN, SM_CYMENU, SM_CYMENUSIZE,
        SM_CYSCREEN, SPI_GETNONCLIENTMETRICS, SPI_GETWORKAREA, SWP_FRAMECHANGED, SWP_HIDEWINDOW,
        SWP_NOACTIVATE, SWP_NOMOVE, SWP_NOOWNERZORDER, SWP_NOSIZE, SWP_NOZORDER, SW_HIDE, SW_SHOW,
        SW_SHOWNOACTIVATE, WINDOWPLACEMENT, WM_ACTIVATE, WM_ACTIVATEAPP, WM_CANCELMODE,
        WM_CAPTURECHANGED, WM_CHAR, WM_CLOSE, WM_COMMAND, WM_DPICHANGED, WM_DRAWITEM,
        WM_ENTERSIZEMOVE, WM_ERASEBKGND, WM_EXITSIZEMOVE, WM_GETMINMAXINFO, WM_KEYDOWN, WM_KEYUP,
        WM_KILLFOCUS, WM_LBUTTONDOWN, WM_LBUTTONUP, WM_MBUTTONDOWN, WM_MBUTTONUP, WM_MEASUREITEM,
        WM_MOUSEACTIVATE, WM_MOUSEMOVE, WM_MOUSEWHEEL, WM_MOVE, WM_NCDESTROY, WM_PAINT,
        WM_RBUTTONDOWN, WM_RBUTTONUP, WM_SETCURSOR, WM_SETFOCUS, WM_SHOWWINDOW, WM_SIZE,
        WM_SYSKEYDOWN, WM_SYSKEYUP, WM_TIMER, WM_WINDOWPOSCHANGED, WNDCLASSW, WS_CLIPCHILDREN,
        WS_CLIPSIBLINGS, WS_EX_LAYERED, WS_EX_NOACTIVATE, WS_EX_TOOLWINDOW, WS_EX_TOPMOST,
        WS_EX_TRANSPARENT, WS_OVERLAPPEDWINDOW, WS_POPUP,
    };

    type SubclassProc =
        unsafe extern "system" fn(HWND, u32, WPARAM, LPARAM, usize, usize) -> LRESULT;

    #[link(name = "comctl32")]
    extern "system" {
        fn SetWindowSubclass(
            hwnd: HWND,
            proc: Option<SubclassProc>,
            id: usize,
            reference_data: usize,
        ) -> i32;
        fn RemoveWindowSubclass(hwnd: HWND, proc: Option<SubclassProc>, id: usize) -> i32;
        fn DefSubclassProc(hwnd: HWND, message: u32, wparam: WPARAM, lparam: LPARAM) -> LRESULT;
    }

    type Hglrc = isize;

    const GL_COLOR_BUFFER_BIT: u32 = 0x0000_4000;
    const MK_LBUTTON: u32 = 0x0001;
    const MK_RBUTTON: u32 = 0x0002;
    const MK_MBUTTON: u32 = 0x0010;
    const PARENT_SUBCLASS_ID: usize = 0x5354_4252_4944_4745;
    const RETAINED_FRAME_REFRESH_INTERVAL: Duration = Duration::from_millis(250);
    const STEAM_DIALOG_SCAN_INTERVAL: Duration = Duration::from_millis(100);
    const MAX_STEAM_DIALOG_WINDOWS: usize = 16;
    const MODAL_PRESENT_TIMER_ID: usize = 0x5342;
    const MODAL_PRESENT_INTERVAL_MS: u32 = 1;
    const VK_TAB_CODE: i32 = 0x09;
    const VK_SHIFT_CODE: i32 = 0x10;
    const VK_LEFT_SHIFT_CODE: i32 = 0xA0;
    const VK_RIGHT_SHIFT_CODE: i32 = 0xA1;
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
        parent_hwnd: Option<HWND>,
        backend: WindowsNativeBackend,
        host_style: WindowsHostStyle,
        renderer: WindowsSurfaceRenderer,
        frame: u64,
        input_passthrough: bool,
        opaque: bool,
        cursor_hidden_requested: bool,
        cursor_suppressed: bool,
        cursor_display_count: Option<i32>,
        transparent_cursor: HCURSOR,
        continuous_present_requested: bool,
        full_screen: bool,
        windowed_style: Option<u32>,
        windowed_placement: Option<WINDOWPLACEMENT>,
        presentation_ready: bool,
        requested_visible: bool,
        visible: bool,
        bounds_override: Option<RECT>,
        parent_subclass_state: Option<*mut ParentWindowSubclassState>,
        last_parent_client_bounds: Option<(i32, i32, i32, i32)>,
        source_frame: Option<FrameUpload>,
        source_frame_dirty: bool,
        last_present_at: Option<Instant>,
        present_after_modal_loop: bool,
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

    struct ParentWindowSubclassState {
        popup_hwnd: HWND,
        content_insets: RECT,
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

    enum WindowsSurfaceRenderer {
        OpenGl {
            hdc: HDC,
            hglrc: Hglrc,
        },
        D3d11 {
            renderer: WindowsD3d11Renderer,
            last_frame_upload: bool,
            frame_upload_failures: u64,
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

    #[derive(Clone, Copy, PartialEq, Eq)]
    enum WindowsHostStyle {
        OwnedPopup,
        Standalone,
    }

    impl WindowsHostStyle {
        fn from_env(attached: bool) -> Self {
            if attached {
                Self::OwnedPopup
            } else {
                Self::Standalone
            }
        }

        fn as_str(self) -> &'static str {
            match self {
                Self::OwnedPopup => "owned-popup",
                Self::Standalone => "standalone",
            }
        }
    }

    unsafe impl Send for NativeSurface {}

    static SURFACE: Lazy<Mutex<Option<NativeSurface>>> = Lazy::new(|| Mutex::new(None));
    static NEXT_SURFACE_INSTANCE_GENERATION: AtomicU64 = AtomicU64::new(0);
    static STANDALONE_MIN_CLIENT_SIZE: AtomicU64 = AtomicU64::new(0);
    static STANDALONE_LOGICAL_CLIENT_SIZE: AtomicU64 = AtomicU64::new(0);
    static STANDALONE_WINDOW_DPI: AtomicU32 = AtomicU32::new(96);
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
        message: u32,
        wparam: u64,
        lparam: i64,
        x: Option<i32>,
        y: Option<i32>,
        delta_y: Option<i32>,
        command_id: Option<u32>,
        client_width: i32,
        client_height: i32,
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
        let surface =
            match unsafe { create_surface(&title, None, false, client_size, min_client_size) } {
                Ok(surface) => surface,
                Err(error) => {
                    set_standalone_min_client_size(None);
                    set_standalone_logical_client_size(None);
                    return Err(error);
                }
            };
        *SURFACE
            .lock()
            .expect("Steam overlay native surface lock poisoned") = Some(surface);
        pump()?;
        Ok(())
    }

    pub fn attach_to_parent(parent_handle: usize) -> Result<(), Error> {
        close();

        if parent_handle == 0 {
            return Err(Error::from_reason(
                "Electron native window handle was empty",
            ));
        }

        let surface = unsafe {
            create_surface(
                "Steam Bridge Native Overlay Host",
                Some(parent_handle as HWND),
                true,
                None,
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
        close();

        if parent_handle == 0 {
            return Err(Error::from_reason(
                "Electron native window handle was empty",
            ));
        }

        let surface = unsafe {
            create_surface(
                "Steam Bridge Native Overlay Host",
                Some(parent_handle as HWND),
                false,
                None,
                None,
            )?
        };
        *SURFACE
            .lock()
            .expect("Steam overlay native surface lock poisoned") = Some(surface);
        pump()?;
        Ok(())
    }

    pub fn show() -> Result<(), Error> {
        with_surface(|surface| unsafe {
            surface.requested_visible = true;
            update_window_frame(surface);
            sync_window_style(surface);
            sync_surface_visibility(surface);
            if surface.visible && !surface.input_passthrough && parent_allows_surface(surface) {
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

    pub fn set_bounds(x: i32, y: i32, width: u32, height: u32) -> Result<(), Error> {
        with_surface(|surface| unsafe {
            let width = width.max(1).min(i32::MAX as u32) as i32;
            let height = height.max(1).min(i32::MAX as u32) as i32;
            let next_bounds = RECT {
                left: x,
                top: y,
                right: x.saturating_add(width),
                bottom: y.saturating_add(height),
            };
            let bounds_changed = surface.bounds_override.as_ref().map_or(true, |bounds| {
                bounds.left != next_bounds.left
                    || bounds.top != next_bounds.top
                    || bounds.right != next_bounds.right
                    || bounds.bottom != next_bounds.bottom
            });
            surface.bounds_override = Some(next_bounds);
            if bounds_changed {
                surface.presentation_ready = false;
                apply_window_style(surface);
            }
            surface.last_parent_client_bounds = None;
            update_window_frame(surface);
        })
    }

    pub fn set_input_passthrough(pass_through: bool) -> Result<(), Error> {
        with_surface(|surface| unsafe {
            if surface.input_passthrough == pass_through {
                return;
            }
            surface.input_passthrough = pass_through;
            sync_window_style(surface);
            sync_surface_visibility(surface);
            if surface.visible && !pass_through && parent_allows_surface(surface) {
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
            if active && surface.host_style == WindowsHostStyle::Standalone {
                surface.steam_dialog_baseline = enumerate_steam_dialog_windows();
            } else {
                restore_adopted_steam_dialog(surface);
                surface.steam_dialog_baseline = SteamDialogWindowList::default();
            }
        })
    }

    pub fn set_continuous_present(continuous: bool) -> Result<(), Error> {
        with_surface(|surface| {
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
        if surface.parent_hwnd.is_some() || surface.full_screen == full_screen {
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
        if surface.parent_hwnd.is_some() {
            return Err(Error::from_reason(
                "Native overlay host menus require a standalone host window",
            ));
        }

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
            update_window_frame(surface);
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

    pub fn update_frame(buffer: Buffer, width: u32, height: u32) -> Result<(), Error> {
        let width = width.max(1).min(i32::MAX as u32) as i32;
        let height = height.max(1).min(i32::MAX as u32) as i32;
        let expected_len = width as usize * height as usize * 4;
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
        match &mut surface.renderer {
            WindowsSurfaceRenderer::D3d11 {
                renderer,
                last_frame_upload,
                ..
            } => unsafe {
                if renderer
                    .import_shared_texture(handle, width, height, content_rect, presentation_rect)
                    .is_err()
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
                }
                *last_frame_upload = true;
            },
            WindowsSurfaceRenderer::OpenGl { .. } => {
                return Err(Error::from_reason(
                    "Electron shared textures require the Windows D3D11 native host backend",
                ));
            }
        }
        surface.source_frame = None;
        // Importing updates the retained D3D source, but a non-continuous
        // session still needs its next pump to present that new source. Keep
        // shared-texture semantics aligned with update_frame instead of
        // silently freezing unless continuous presentation is enabled.
        surface.source_frame_dirty = true;
        Ok(())
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
        close_matching(|surface| surface.parent_hwnd.is_none());
    }

    pub fn detach_host() {
        close_matching(|surface| surface.parent_hwnd.is_some());
    }

    pub fn is_probe_open() -> bool {
        SURFACE
            .lock()
            .expect("Steam overlay native surface lock poisoned")
            .as_ref()
            .is_some_and(|surface| surface.parent_hwnd.is_none())
    }

    pub fn is_embedded() -> bool {
        SURFACE
            .lock()
            .expect("Steam overlay native surface lock poisoned")
            .as_ref()
            .is_some_and(|surface| surface.parent_hwnd.is_some())
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
            let rect = read_window_rect(surface.hwnd).map(window_rect_json);
            let client_rect = read_client_rect_in_screen(surface.hwnd);
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
            let parent_rect = surface
                .parent_hwnd
                .and_then(read_window_rect)
                .map(window_rect_json);
            let parent_client_rect = surface
                .parent_hwnd
                .and_then(read_client_rect_in_screen)
                .map(window_rect_json);
            let style = GetWindowLongPtrW(surface.hwnd, GWL_STYLE) as u32;
            let ex_style = GetWindowLongPtrW(surface.hwnd, GWL_EXSTYLE) as u32;
            let renderer = renderer_diagnostics_json(&surface.renderer);
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
                "hostStyle": surface.host_style.as_str(),
                "renderer": renderer,
                "hwnd": hwnd_hex(surface.hwnd),
                "parentHwnd": surface.parent_hwnd.map(hwnd_hex),
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
                "parentAllowsSurface": parent_allows_surface(surface),
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
                "parentRect": parent_rect,
                "parentClientRect": parent_client_rect,
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
                destroy_surface(surface);
            }
        }
    }

    unsafe fn create_surface(
        title: &str,
        parent_hwnd: Option<HWND>,
        initial_input_passthrough: bool,
        standalone_client_size: Option<(i32, i32)>,
        standalone_min_client_size: Option<(i32, i32)>,
    ) -> Result<NativeSurface, Error> {
        let _dpi_awareness = ThreadDpiAwarenessGuard::per_monitor_v2();
        ensure_window_class()?;
        reset_window_message_diagnostics();
        let title = wide_string(title);
        let class_name = window_class_name();
        let backend = WindowsNativeBackend::from_env();
        let host_style = WindowsHostStyle::from_env(parent_hwnd.is_some());
        let input_passthrough = parent_hwnd.is_some() && initial_input_passthrough;
        let ex_style = base_ex_style(parent_hwnd.is_some(), input_passthrough);
        let style = if parent_hwnd.is_some() {
            WS_POPUP | WS_CLIPSIBLINGS | WS_CLIPCHILDREN
        } else {
            WS_OVERLAPPEDWINDOW | WS_CLIPSIBLINGS | WS_CLIPCHILDREN
        };
        let owner = parent_hwnd.unwrap_or(ptr::null_mut());
        let parent_rect = parent_hwnd.and_then(read_client_rect_in_screen);
        let (x, y, width, height) = if let Some(rect) = parent_rect {
            (
                rect.left,
                rect.top,
                (rect.right - rect.left).max(1),
                (rect.bottom - rect.top).max(1),
            )
        } else if let Some((client_width, client_height)) = standalone_client_size {
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
            owner,
            ptr::null_mut(),
            GetModuleHandleW(ptr::null()),
            ptr::null_mut(),
        );
        if hwnd.is_null() {
            return Err(Error::from_reason(
                "Failed to create Windows native overlay host window",
            ));
        }
        if parent_hwnd.is_none() {
            STANDALONE_WINDOW_DPI.store(GetDpiForWindow(hwnd).max(96), Ordering::Relaxed);
        }
        if parent_hwnd.is_none() {
            let transitions_disabled = 1i32;
            DwmSetWindowAttribute(
                hwnd,
                DWMWA_TRANSITIONS_FORCEDISABLED as u32,
                &transitions_disabled as *const i32 as *const std::ffi::c_void,
                mem::size_of::<i32>() as u32,
            );
            set_window_corner_preference(hwnd, false);
        }

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
            parent_hwnd,
            backend,
            host_style,
            renderer,
            frame: 0,
            input_passthrough,
            opaque: parent_hwnd.is_none() || !input_passthrough,
            cursor_hidden_requested: false,
            cursor_suppressed: false,
            cursor_display_count: None,
            transparent_cursor,
            continuous_present_requested: false,
            full_screen: false,
            windowed_style: None,
            windowed_placement: None,
            presentation_ready: false,
            requested_visible: parent_hwnd.is_none(),
            visible: false,
            bounds_override: None,
            parent_subclass_state: None,
            last_parent_client_bounds: None,
            source_frame: None,
            source_frame_dirty: true,
            last_present_at: None,
            present_after_modal_loop: false,
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
        if let Some(parent_hwnd) = parent_hwnd {
            let subclass_state = Box::into_raw(Box::new(ParentWindowSubclassState {
                popup_hwnd: hwnd,
                content_insets: RECT {
                    left: 0,
                    top: 0,
                    right: 0,
                    bottom: 0,
                },
            }));
            if SetWindowSubclass(
                parent_hwnd,
                Some(parent_window_subclass_proc),
                PARENT_SUBCLASS_ID,
                subclass_state as usize,
            ) == 0
            {
                drop(Box::from_raw(subclass_state));
                release_renderer(surface.renderer, surface.hwnd);
                DestroyWindow(surface.hwnd);
                return Err(Error::from_reason(
                    "Failed to observe the Electron parent window lifecycle",
                ));
            }
            surface.parent_subclass_state = Some(subclass_state);
        }
        sync_window_style(&mut surface);
        update_window_frame(&mut surface);
        sync_surface_visibility(&mut surface);
        if surface.parent_hwnd.is_none() && surface.visible && !surface.input_passthrough {
            activate_window(&surface);
        }
        Ok(surface)
    }

    unsafe fn render_surface(surface: &mut NativeSurface) -> Result<(), Error> {
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
            } => {
                renderer
                    .resize(width as u32, height as u32)
                    .map_err(Error::from_reason)?;
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
                renderer.render(color).map_err(Error::from_reason)?;
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
            } => json!({
                "backend": "windows-d3d11",
                "width": renderer.width(),
                "height": renderer.height(),
                "format": "bgra8-unorm",
                "presentationMode": "flip-sequential",
                "bufferCount": 2,
                "gdiCompatible": false,
                "frameLatencyWaitable": renderer.frame_latency_waitable(),
                "frameLatencyWaitTimeoutCount": renderer.frame_latency_wait_timeout_count(),
                "sharedTextureCopySlowCount": renderer.shared_texture_copy_slow_count(),
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

    unsafe fn update_window_frame(surface: &mut NativeSurface) {
        let Some(parent_hwnd) = surface.parent_hwnd else {
            return;
        };
        let Some(parent_client_rect) = read_client_rect_in_screen(parent_hwnd) else {
            sync_surface_visibility(surface);
            return;
        };
        let rect = surface.bounds_override.unwrap_or(parent_client_rect);
        if let Some(subclass_state) = surface.parent_subclass_state {
            (*subclass_state).content_insets = RECT {
                left: rect.left - parent_client_rect.left,
                top: rect.top - parent_client_rect.top,
                right: parent_client_rect.right - rect.right,
                bottom: parent_client_rect.bottom - rect.bottom,
            };
        }
        let width = (rect.right - rect.left).max(1);
        let height = (rect.bottom - rect.top).max(1);
        let bounds = (rect.left, rect.top, width, height);
        if surface.last_parent_client_bounds != Some(bounds) {
            if SetWindowPos(
                surface.hwnd,
                ptr::null_mut(),
                rect.left,
                rect.top,
                width,
                height,
                SWP_NOACTIVATE | SWP_NOOWNERZORDER | SWP_NOZORDER,
            ) != 0
            {
                surface.last_parent_client_bounds = Some(bounds);
                sync_owned_popup_clip(surface.hwnd, parent_hwnd, rect);
            }
        }
        sync_surface_visibility(surface);
    }

    unsafe fn sync_steam_dialog(surface: &mut NativeSurface) {
        if surface.host_style != WindowsHostStyle::Standalone || !surface.overlay_active {
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

    unsafe fn sync_owned_popup_clip(popup_hwnd: HWND, parent_hwnd: HWND, bounds: RECT) {
        let mut visible_frame: RECT = mem::zeroed();
        let frame_result = DwmGetWindowAttribute(
            parent_hwnd,
            DWMWA_EXTENDED_FRAME_BOUNDS as u32,
            &mut visible_frame as *mut RECT as *mut std::ffi::c_void,
            mem::size_of::<RECT>() as u32,
        );
        if frame_result < 0 {
            let Some(frame) = read_window_rect(parent_hwnd) else {
                return;
            };
            visible_frame = frame;
        }

        let mut corner_preference = 0i32;
        let corner_result = DwmGetWindowAttribute(
            parent_hwnd,
            DWMWA_WINDOW_CORNER_PREFERENCE as u32,
            &mut corner_preference as *mut i32 as *mut std::ffi::c_void,
            mem::size_of::<i32>() as u32,
        );
        if corner_result < 0 || corner_preference == DWMWCP_DONOTROUND || IsZoomed(parent_hwnd) != 0
        {
            SetWindowRgn(popup_hwnd, ptr::null_mut(), 1);
            return;
        }

        let dpi = GetDpiForWindow(parent_hwnd).max(96);
        let base_radius = if corner_preference == DWMWCP_ROUNDSMALL {
            4
        } else {
            8
        };
        let radius = ((base_radius * dpi as i32) + 48) / 96;
        let diameter = (radius * 2).max(2);
        let width = (bounds.right - bounds.left).max(1);
        let height = (bounds.bottom - bounds.top).max(1);
        let content_region = CreateRectRgn(0, 0, width + 1, height + 1);
        let frame_region = CreateRoundRectRgn(
            visible_frame.left - bounds.left,
            visible_frame.top - bounds.top,
            visible_frame.right - bounds.left + 1,
            visible_frame.bottom - bounds.top + 1,
            diameter,
            diameter,
        );
        if content_region.is_null() || frame_region.is_null() {
            if !content_region.is_null() {
                DeleteObject(content_region);
            }
            if !frame_region.is_null() {
                DeleteObject(frame_region);
            }
            return;
        }

        CombineRgn(content_region, content_region, frame_region, RGN_AND);
        DeleteObject(frame_region);
        if SetWindowRgn(popup_hwnd, content_region, 1) == 0 {
            DeleteObject(content_region);
        }
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

    unsafe extern "system" fn parent_window_subclass_proc(
        hwnd: HWND,
        message: u32,
        wparam: WPARAM,
        lparam: LPARAM,
        _id: usize,
        reference_data: usize,
    ) -> LRESULT {
        let subclass_state = &*(reference_data as *const ParentWindowSubclassState);
        let popup_hwnd = subclass_state.popup_hwnd;
        if matches!(message, WM_WINDOWPOSCHANGED | WM_SIZE | WM_SHOWWINDOW) {
            if IsWindowVisible(hwnd) == 0 || IsIconic(hwnd) != 0 {
                hide_window_without_activation(popup_hwnd);
            } else if let Some(parent_client_rect) = read_client_rect_in_screen(hwnd) {
                let bounds = RECT {
                    left: parent_client_rect.left + subclass_state.content_insets.left,
                    top: parent_client_rect.top + subclass_state.content_insets.top,
                    right: parent_client_rect.right - subclass_state.content_insets.right,
                    bottom: parent_client_rect.bottom - subclass_state.content_insets.bottom,
                };
                SetWindowPos(
                    popup_hwnd,
                    ptr::null_mut(),
                    bounds.left,
                    bounds.top,
                    (bounds.right - bounds.left).max(1),
                    (bounds.bottom - bounds.top).max(1),
                    SWP_NOACTIVATE | SWP_NOOWNERZORDER | SWP_NOZORDER,
                );
                sync_owned_popup_clip(popup_hwnd, hwnd, bounds);
            }
        } else if message == WM_NCDESTROY {
            RemoveWindowSubclass(hwnd, Some(parent_window_subclass_proc), PARENT_SUBCLASS_ID);
        }

        DefSubclassProc(hwnd, message, wparam, lparam)
    }

    unsafe fn parent_allows_surface(surface: &NativeSurface) -> bool {
        if !surface.requested_visible {
            return false;
        }
        if surface.input_passthrough && !surface.opaque {
            return false;
        }
        let Some(parent_hwnd) = surface.parent_hwnd else {
            return true;
        };
        if IsWindowVisible(parent_hwnd) == 0 || IsIconic(parent_hwnd) != 0 {
            return false;
        }

        let foreground = GetForegroundWindow();
        foreground == parent_hwnd
            || foreground == surface.hwnd
            || (!foreground.is_null() && GetAncestor(foreground, GA_ROOTOWNER) == parent_hwnd)
    }

    unsafe fn sync_surface_visibility(surface: &mut NativeSurface) {
        let should_be_visible = parent_allows_surface(surface);
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
        if surface.parent_hwnd.is_some() {
            ex_style &= !WS_EX_TOPMOST;
            ex_style |= WS_EX_TOOLWINDOW;
            if surface.input_passthrough {
                // A parked presenter follows the Electron window without
                // taking activation from its title bar or menu. Once Steam is
                // interactive, remove both flags so the clipped content popup
                // can receive ordinary overlay mouse and keyboard input.
                ex_style |= WS_EX_NOACTIVATE | WS_EX_TRANSPARENT;
            } else {
                ex_style &= !(WS_EX_NOACTIVATE | WS_EX_TRANSPARENT);
            }
        } else {
            ex_style &= !(WS_EX_TOOLWINDOW | WS_EX_NOACTIVATE | WS_EX_TOPMOST);
        }
        // Keep the presenter transparent until it has copied and presented a
        // fresh Electron frame. Once ready, it is a normal opaque owned popup;
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
        if surface.parent_hwnd.is_some() || surface.input_passthrough {
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

    unsafe fn destroy_surface(mut surface: NativeSurface) {
        restore_adopted_steam_dialog(&mut surface);
        if surface.cursor_suppressed {
            normalize_cursor_display_count(true);
        }
        if let Some(parent_hwnd) = surface.parent_hwnd {
            RemoveWindowSubclass(
                parent_hwnd,
                Some(parent_window_subclass_proc),
                PARENT_SUBCLASS_ID,
            );
        }
        if let Some(subclass_state) = surface.parent_subclass_state {
            drop(Box::from_raw(subclass_state));
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
        if surface.parent_hwnd.is_none() {
            set_standalone_min_client_size(None);
            set_standalone_logical_client_size(None);
            STANDALONE_WINDOW_DPI.store(96, Ordering::Relaxed);
        }
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
        let foreground = GetForegroundWindow();
        if foreground.is_null() {
            return false;
        }
        if foreground == surface.hwnd {
            return true;
        }
        surface.parent_hwnd.is_some_and(|parent_hwnd| {
            foreground == parent_hwnd || GetAncestor(foreground, GA_ROOTOWNER) == parent_hwnd
        })
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
        if render_surface(surface).is_err() {
            // The ordinary pump owns error teardown. Keep the retained frame
            // dirty so it retries immediately after the modal sizing loop.
            surface.source_frame_dirty = true;
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
            render_retained_frame_from_window_message(hwnd, false);
            return 1;
        }
        if message == WM_SIZE && wparam != SIZE_MINIMIZED as usize {
            render_retained_frame_from_window_message(hwnd, false);
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
            render_retained_frame_from_window_message(hwnd, true);
            return 0;
        }
        if message == WM_ENTERSIZEMOVE {
            // DefWindowProc owns a nested modal loop while a top-level window is
            // moved or resized. The ordinary JS-driven pump is blocked during
            // that loop, so keep capture/composition alive from a window timer.
            SetTimer(
                hwnd,
                MODAL_PRESENT_TIMER_ID,
                MODAL_PRESENT_INTERVAL_MS,
                None,
            );
            render_retained_frame_from_window_message(hwnd, true);
        }
        if message == WM_TIMER && wparam == MODAL_PRESENT_TIMER_ID {
            render_retained_frame_from_window_message(hwnd, false);
            return 0;
        }
        if message == WM_EXITSIZEMOVE {
            KillTimer(hwnd, MODAL_PRESENT_TIMER_ID);
            remember_standalone_logical_client_size(hwnd);
            render_retained_frame_from_window_message(hwnd, true);
        }
        if message == WM_MOVE {
            render_retained_frame_from_window_message(hwnd, false);
        }
        if message == WM_PAINT {
            let mut paint: PAINTSTRUCT = mem::zeroed();
            BeginPaint(hwnd, &mut paint);
            render_retained_frame_from_window_message(hwnd, false);
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

    fn base_ex_style(attached: bool, pass_through: bool) -> u32 {
        let mut style = WS_EX_LAYERED;
        if attached {
            style |= WS_EX_TOOLWINDOW;
        }
        if pass_through {
            style |= WS_EX_NOACTIVATE | WS_EX_TRANSPARENT;
        }
        style
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
            message: 0,
            wparam: 0,
            lparam: 0,
            x: None,
            y: None,
            delta_y: None,
            command_id: None,
            client_width: (client.right - client.left).max(1),
            client_height: (client.bottom - client.top).max(1),
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
            message,
            wparam: wparam as u64,
            lparam: lparam as i64,
            x,
            y,
            delta_y: (message == WM_MOUSEWHEEL)
                .then(|| ((wparam as u32 >> 16) as u16 as i16) as i32),
            command_id: (message == WM_COMMAND).then(|| wparam as u32 & u16::MAX as u32),
            client_width: (client.right - client.left).max(1),
            client_height: (client.bottom - client.top).max(1),
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
    mod tests {
        use super::{
            centered_window_rect, clamp_client_size_to_minimum, logical_pixels_to_physical,
            menu_text_without_mnemonics, minimum_menu_dpi, physical_pixels_to_logical,
            set_standalone_logical_client_size, set_standalone_min_client_size,
            standalone_logical_client_size, standalone_min_client_size, RECT,
        };

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
    use super::{Buffer, Error};
    use once_cell::sync::Lazy;
    use serde_json::json;
    use std::ffi::{c_void, CString};
    use std::mem;
    use std::os::raw::{c_int, c_long, c_uchar, c_uint};
    use std::ptr;
    use std::sync::Mutex;
    use std::time::{SystemTime, UNIX_EPOCH};
    use x11_dl::{glx, xfixes, xlib};

    const SHAPE_BOUNDING: c_int = 0;
    const SHAPE_CLIP: c_int = 1;
    const SHAPE_INPUT: c_int = 2;
    const WINDOWED_BOTTOM_CORNER_RADIUS: u32 = 8;

    struct NativeSurface {
        xlib: xlib::Xlib,
        glx: glx::Glx,
        xfixes: Option<xfixes::Xlib>,
        display: *mut xlib::Display,
        window: xlib::Window,
        parent_window: Option<xlib::Window>,
        managed_host: bool,
        opacity_atom: xlib::Atom,
        colormap: xlib::Colormap,
        context: glx::GLXContext,
        frame: u64,
        input_passthrough: bool,
        opaque: bool,
        full_screen: bool,
    }

    unsafe impl Send for NativeSurface {}

    static SURFACE: Lazy<Mutex<Option<NativeSurface>>> = Lazy::new(|| Mutex::new(None));

    pub fn open(
        title: Option<String>,
        _client_width: Option<u32>,
        _client_height: Option<u32>,
        _min_client_width: Option<u32>,
        _min_client_height: Option<u32>,
    ) -> Result<(), Error> {
        close();

        let title = title.unwrap_or_else(|| "Steam Bridge Native Overlay Probe".to_owned());
        let surface = unsafe { create_probe_window(&title, None, None, false, false)? };
        *SURFACE
            .lock()
            .expect("Steam overlay native surface lock poisoned") = Some(surface);

        pump()?;
        Ok(())
    }

    pub fn attach_to_parent(parent_handle: usize) -> Result<(), Error> {
        close();

        let surface = unsafe {
            create_probe_window(
                "Steam Bridge Native Overlay",
                Some(parent_handle as xlib::Window),
                None,
                true,
                false,
            )?
        };
        *SURFACE
            .lock()
            .expect("Steam overlay native surface lock poisoned") = Some(surface);

        pump()?;
        Ok(())
    }

    pub fn attach_to_parent_for_overlay(parent_handle: usize) -> Result<(), Error> {
        attach_to_parent(parent_handle)
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
                Some((x, y, width.max(1), height.max(1))),
                true,
                full_screen,
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
            while (surface.xlib.XPending)(surface.display) > 0 {
                let mut event: xlib::XEvent = mem::MaybeUninit::uninit().assume_init();
                (surface.xlib.XNextEvent)(surface.display, &mut event);
            }

            if let Some(parent_window) = surface.parent_window {
                let (x, y, width, height) = window_bounds_on_root(
                    &surface.xlib,
                    surface.display,
                    parent_window,
                    0,
                    0,
                    640,
                    480,
                );
                (surface.xlib.XMoveResizeWindow)(
                    surface.display,
                    surface.window,
                    x,
                    y,
                    width,
                    height,
                );
                gl::Viewport(0, 0, width as c_int, height as c_int);
            }

            (surface.glx.glXMakeCurrent)(surface.display, surface.window, surface.context);
            if surface.managed_host {
                gl::ClearColor(0.0, 0.0, 0.0, 0.0);
            } else {
                let t = SystemTime::now()
                    .duration_since(UNIX_EPOCH)
                    .map(|duration| duration.as_millis() as f32 / 1000.0)
                    .unwrap_or(0.0);
                gl::ClearColor(0.015 + (t.sin() + 1.0) * 0.015, 0.02, 0.035, 1.0);
            }
            gl::Clear(gl::COLOR_BUFFER_BIT);
            (surface.glx.glXSwapBuffers)(surface.display, surface.window);
            surface.frame = surface.frame.wrapping_add(1);
        }

        Ok(())
    }

    pub fn show() -> Result<(), Error> {
        with_surface(|surface| unsafe {
            (surface.xlib.XMapRaised)(surface.display, surface.window);
            (surface.xlib.XFlush)(surface.display);
        })
    }

    pub fn hide() -> Result<(), Error> {
        with_surface(|surface| unsafe {
            (surface.xlib.XUnmapWindow)(surface.display, surface.window);
            (surface.xlib.XFlush)(surface.display);
        })
    }

    pub fn set_input_passthrough(pass_through: bool) -> Result<(), Error> {
        with_surface(|surface| unsafe {
            if surface.managed_host && surface.input_passthrough != pass_through {
                apply_host_input_mode(
                    &surface.xlib,
                    surface.xfixes.as_ref(),
                    surface.display,
                    surface.window,
                    pass_through,
                    surface.parent_window.is_none(),
                );
                surface.input_passthrough = pass_through;
            }
        })
    }

    pub fn set_opaque(opaque: bool) -> Result<(), Error> {
        with_surface(|surface| unsafe {
            if surface.managed_host && surface.opaque != opaque {
                apply_host_opacity(
                    &surface.xlib,
                    surface.display,
                    surface.window,
                    surface.opacity_atom,
                    opaque,
                );
                surface.opaque = opaque;
            }
        })
    }

    pub fn set_cursor_hidden(_hidden: bool) -> Result<(), Error> {
        Ok(())
    }

    pub fn set_continuous_present(_continuous: bool) -> Result<(), Error> {
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
        })
    }

    pub fn set_menu_json(_menu_json: String) -> Result<(), Error> {
        Ok(())
    }

    pub fn set_bounds(x: i32, y: i32, width: u32, height: u32) -> Result<(), Error> {
        with_surface(|surface| unsafe {
            if surface.managed_host && surface.parent_window.is_none() {
                let width = width.max(1);
                let height = height.max(1);
                (surface.xlib.XMoveResizeWindow)(
                    surface.display,
                    surface.window,
                    x,
                    y,
                    width,
                    height,
                );
                apply_standalone_host_shape(
                    surface.xfixes.as_ref(),
                    surface.display,
                    surface.window,
                    width,
                    height,
                    surface.full_screen,
                );
                (surface.glx.glXMakeCurrent)(surface.display, surface.window, surface.context);
                gl::Viewport(0, 0, width as c_int, height as c_int);
                (surface.xlib.XFlush)(surface.display);
            }
        })
    }

    pub fn update_frame(_buffer: Buffer, _width: u32, _height: u32) -> Result<(), Error> {
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
        let surface = SURFACE
            .lock()
            .expect("Steam overlay native surface lock poisoned")
            .take();
        if let Some(surface) = surface {
            unsafe {
                (surface.glx.glXMakeCurrent)(surface.display, 0, ptr::null_mut());
                (surface.glx.glXDestroyContext)(surface.display, surface.context);
                (surface.xlib.XDestroyWindow)(surface.display, surface.window);
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
        let guard = SURFACE
            .lock()
            .expect("Steam overlay native surface lock poisoned");
        let surface = guard.as_ref()?;
        unsafe {
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
                    "managedHost": surface.managed_host,
                    "standaloneHost": surface.managed_host && surface.parent_window.is_none(),
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
                    "roundedBottomCorners": surface.managed_host
                        && surface.parent_window.is_none()
                        && !surface.full_screen,
                    "frame": surface.frame,
                })
                .to_string(),
            )
        }
    }

    pub fn drain_input_events_json() -> String {
        "[]".to_owned()
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
                (surface.glx.glXMakeCurrent)(surface.display, 0, ptr::null_mut());
                (surface.glx.glXDestroyContext)(surface.display, surface.context);
                (surface.xlib.XDestroyWindow)(surface.display, surface.window);
                (surface.xlib.XFreeColormap)(surface.display, surface.colormap);
                (surface.xlib.XCloseDisplay)(surface.display);
            }
        }
    }

    unsafe fn create_probe_window(
        title: &str,
        parent_window: Option<xlib::Window>,
        standalone_bounds: Option<(i32, i32, u32, u32)>,
        managed_host: bool,
        full_screen: bool,
    ) -> Result<NativeSurface, Error> {
        let title = CString::new(title)
            .map_err(|error| Error::from_reason(format!("Invalid native probe title: {error}")))?;
        let class_name = CString::new("SteamBridgeNativeProbe").expect("static class name");
        let xlib = xlib::Xlib::open()
            .map_err(|error| Error::from_reason(format!("Failed to load Xlib: {error}")))?;
        let glx = glx::Glx::open()
            .map_err(|error| Error::from_reason(format!("Failed to load GLX: {error}")))?;
        let xfixes = xfixes::Xlib::open().ok();

        let display = (xlib.XOpenDisplay)(ptr::null());
        if display.is_null() {
            return Err(Error::from_reason(
                "Failed to open X11 display for Linux native overlay probe",
            ));
        }

        let (screen, parent, x, y, width, height) = if let Some(parent_window) = parent_window {
            let mut attributes: xlib::XWindowAttributes = mem::MaybeUninit::zeroed().assume_init();
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
            let (x, y, width, height) =
                window_bounds_on_root(&xlib, display, parent_window, 0, 0, 640, 480);
            (screen, attributes.root, x, y, width, height)
        } else if let Some((x, y, width, height)) = standalone_bounds {
            let screen = (xlib.XDefaultScreen)(display);
            (
                screen,
                (xlib.XRootWindow)(display, screen),
                x,
                y,
                width.max(1),
                height.max(1),
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
        let visual_info = (glx.glXChooseVisual)(display, screen, visual_attrs.as_mut_ptr());
        if visual_info.is_null() {
            (xlib.XCloseDisplay)(display);
            return Err(Error::from_reason(
                "Failed to choose a GLX visual for Linux native overlay probe",
            ));
        }

        let colormap =
            (xlib.XCreateColormap)(display, parent, (*visual_info).visual, xlib::AllocNone);
        let mut attributes: xlib::XSetWindowAttributes = mem::MaybeUninit::zeroed().assume_init();
        attributes.colormap = colormap;
        attributes.background_pixel = (xlib.XBlackPixel)(display, screen);
        attributes.border_pixel = 0;
        let standalone_managed_host = managed_host && parent_window.is_none();
        attributes.override_redirect = xlib::False;
        attributes.event_mask = xlib::ExposureMask
            | xlib::StructureNotifyMask
            | xlib::KeyPressMask
            | xlib::ButtonPressMask
            | xlib::ButtonReleaseMask
            | xlib::PointerMotionMask;

        let window = (xlib.XCreateWindow)(
            display,
            parent,
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
        let opacity_atom_name = CString::new("_NET_WM_WINDOW_OPACITY").expect("static atom");
        let opacity_atom = (xlib.XInternAtom)(display, opacity_atom_name.as_ptr(), xlib::False);
        let mut input_passthrough = false;
        let mut opaque = true;
        if managed_host {
            if let Some(parent_window) = parent_window {
                (xlib.XSetTransientForHint)(display, window, parent_window);
            }
            if standalone_managed_host {
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
            apply_host_input_mode(
                &xlib,
                xfixes.as_ref(),
                display,
                window,
                true,
                standalone_managed_host,
            );
            apply_host_opacity(&xlib, display, window, opacity_atom, false);
            input_passthrough = true;
            opaque = false;
        }
        let mut class_hint = xlib::XClassHint {
            res_name: class_name.as_ptr().cast_mut(),
            res_class: class_name.as_ptr().cast_mut(),
        };
        (xlib.XSetClassHint)(display, window, &mut class_hint);

        let context = (glx.glXCreateContext)(display, visual_info, ptr::null_mut(), xlib::True);
        (xlib.XFree)(visual_info.cast::<c_void>());
        if context.is_null() {
            (xlib.XDestroyWindow)(display, window);
            (xlib.XFreeColormap)(display, colormap);
            (xlib.XCloseDisplay)(display);
            return Err(Error::from_reason(
                "Failed to create GLX context for Linux native overlay probe",
            ));
        }

        if (glx.glXMakeCurrent)(display, window, context) == 0 {
            (glx.glXDestroyContext)(display, context);
            (xlib.XDestroyWindow)(display, window);
            (xlib.XFreeColormap)(display, colormap);
            (xlib.XCloseDisplay)(display);
            return Err(Error::from_reason(
                "Failed to make Linux native overlay probe GLX context current",
            ));
        }
        load_gl_functions(&glx);
        gl::Viewport(0, 0, width as c_int, height as c_int);

        (xlib.XSelectInput)(display, window, attributes.event_mask as c_long);
        (xlib.XMapRaised)(display, window);
        (xlib.XFlush)(display);

        Ok(NativeSurface {
            xlib,
            glx,
            xfixes,
            display,
            window,
            parent_window,
            managed_host,
            opacity_atom,
            colormap,
            context,
            frame: 0,
            input_passthrough,
            opaque,
            full_screen,
        })
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

    unsafe fn apply_host_input_mode(
        xlib: &xlib::Xlib,
        xfixes: Option<&xfixes::Xlib>,
        display: *mut xlib::Display,
        window: xlib::Window,
        pass_through: bool,
        focus_on_activate: bool,
    ) {
        let mut wm_hints: xlib::XWMHints = mem::MaybeUninit::zeroed().assume_init();
        wm_hints.flags = xlib::InputHint;
        wm_hints.input = if pass_through {
            xlib::False
        } else {
            xlib::True
        };
        (xlib.XSetWMHints)(display, window, &mut wm_hints);

        if let Some(xfixes) = xfixes {
            let mut event_base = 0;
            let mut error_base = 0;
            if (xfixes.XFixesQueryExtension)(display, &mut event_base, &mut error_base) != 0 {
                let region = if pass_through {
                    (xfixes.XFixesCreateRegion)(display, ptr::null_mut(), 0)
                } else {
                    0
                };
                (xfixes.XFixesSetWindowShapeRegion)(display, window, SHAPE_INPUT, 0, 0, region);
                if region != 0 {
                    (xfixes.XFixesDestroyRegion)(display, region);
                }
            }
        }

        if focus_on_activate && !pass_through {
            (xlib.XMapRaised)(display, window);
            (xlib.XSetInputFocus)(display, window, xlib::RevertToParent, xlib::CurrentTime);
        }

        (xlib.XFlush)(display);
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
    ) {
        if opacity_atom != 0 {
            let opacity: u32 = if opaque { u32::MAX } else { 0 };
            (xlib.XChangeProperty)(
                display,
                window,
                opacity_atom,
                xlib::XA_CARDINAL,
                32,
                xlib::PropModeReplace,
                (&opacity as *const u32).cast::<c_uchar>(),
                1,
            );
        }
        (xlib.XFlush)(display);
    }

    fn load_gl_functions(glx: &glx::Glx) {
        gl::load_with(|name| {
            let Ok(symbol) = CString::new(name) else {
                return ptr::null();
            };
            unsafe {
                (glx.glXGetProcAddress)(symbol.as_ptr().cast())
                    .map(|function| function as *const () as *const c_void)
                    .unwrap_or(ptr::null())
            }
        });
    }
}

#[cfg(target_os = "linux")]
pub use linux::*;
