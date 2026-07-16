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

    pub fn open(title: Option<String>) -> Result<(), Error> {
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

    pub fn open(_title: Option<String>) -> Result<(), Error> {
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

    pub fn update_frame(_buffer: super::Buffer, _width: u32, _height: u32) -> Result<(), Error> {
        Ok(())
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
}

#[cfg(not(any(target_os = "macos", target_os = "linux", target_os = "windows")))]
pub use fallback::*;
#[cfg(target_os = "macos")]
pub use macos::*;

#[cfg(target_os = "windows")]
mod windows {
    use super::{Buffer, Error};
    use once_cell::sync::Lazy;
    use serde::Serialize;
    use serde_json::json;
    use std::env;
    use std::mem;
    use std::ptr;
    use std::sync::atomic::{AtomicU64, Ordering};
    use std::sync::{Mutex, OnceLock};
    use std::time::{SystemTime, UNIX_EPOCH};
    use windows_sys::core::{GUID, HRESULT};
    use windows_sys::Win32::Foundation::{HWND, LPARAM, LRESULT, POINT, RECT, WPARAM};
    use windows_sys::Win32::Graphics::Gdi::{ClientToScreen, GetDC, ReleaseDC, HDC};
    use windows_sys::Win32::Graphics::OpenGL::{
        ChoosePixelFormat, SetPixelFormat, SwapBuffers, PFD_DOUBLEBUFFER, PFD_DRAW_TO_WINDOW,
        PFD_MAIN_PLANE, PFD_SUPPORT_OPENGL, PFD_TYPE_RGBA, PIXELFORMATDESCRIPTOR,
    };
    use windows_sys::Win32::System::LibraryLoader::GetModuleHandleW;
    use windows_sys::Win32::UI::Input::KeyboardAndMouse::{SetActiveWindow, SetFocus};
    use windows_sys::Win32::UI::WindowsAndMessaging::{
        CreateWindowExW, DefWindowProcW, DestroyWindow, DispatchMessageW, GetClientRect,
        GetForegroundWindow, GetWindowLongPtrW, GetWindowRect, PeekMessageW, RegisterClassW,
        SetForegroundWindow, SetLayeredWindowAttributes, SetWindowLongPtrW, SetWindowPos,
        ShowWindow, TranslateMessage, CS_OWNDC, GWL_EXSTYLE, GWL_STYLE, LWA_ALPHA, MA_NOACTIVATE,
        MSG, PM_REMOVE, SWP_FRAMECHANGED, SWP_NOACTIVATE, SWP_NOMOVE, SWP_NOOWNERZORDER,
        SWP_NOSIZE, SWP_NOZORDER, SW_HIDE, SW_SHOW, SW_SHOWNOACTIVATE, WM_ACTIVATE, WM_ACTIVATEAPP,
        WM_CLOSE, WM_KEYDOWN, WM_KEYUP, WM_KILLFOCUS, WM_LBUTTONDOWN, WM_LBUTTONUP,
        WM_MOUSEACTIVATE, WM_MOUSEMOVE, WM_SETFOCUS, WM_SYSKEYDOWN, WM_SYSKEYUP, WNDCLASSW,
        WS_CLIPCHILDREN, WS_CLIPSIBLINGS, WS_EX_LAYERED, WS_EX_NOACTIVATE, WS_EX_TOOLWINDOW,
        WS_EX_TOPMOST, WS_EX_TRANSPARENT, WS_OVERLAPPEDWINDOW, WS_POPUP,
    };

    type Hglrc = isize;
    type IUnknownPtr = *mut std::ffi::c_void;
    type ID3D11DevicePtr = *mut std::ffi::c_void;
    type ID3D11DeviceContextPtr = *mut std::ffi::c_void;
    type ID3D11RenderTargetViewPtr = *mut std::ffi::c_void;
    type IDXGISwapChainPtr = *mut std::ffi::c_void;

    const GL_COLOR_BUFFER_BIT: u32 = 0x0000_4000;
    const D3D_DRIVER_TYPE_HARDWARE: u32 = 1;
    const D3D_FEATURE_LEVEL_11_0: u32 = 0x0000_B000;
    const D3D_FEATURE_LEVEL_10_1: u32 = 0x0000_A100;
    const D3D_FEATURE_LEVEL_10_0: u32 = 0x0000_A000;
    const D3D11_SDK_VERSION: u32 = 7;
    const DXGI_FORMAT_R8G8B8A8_UNORM: u32 = 28;
    const DXGI_USAGE_RENDER_TARGET_OUTPUT: u32 = 0x0000_0020;
    const DXGI_SWAP_EFFECT_DISCARD: u32 = 0;
    const S_OK: HRESULT = 0;
    const IID_ID3D11_TEXTURE_2D: GUID = GUID {
        data1: 0x6f15_aaf2,
        data2: 0xd208,
        data3: 0x4e89,
        data4: [0x9a, 0xb4, 0x48, 0x95, 0x35, 0xd3, 0x4f, 0x9c],
    };

    #[link(name = "opengl32")]
    extern "system" {
        fn glClear(mask: u32);
        fn glClearColor(red: f32, green: f32, blue: f32, alpha: f32);
        fn glViewport(x: i32, y: i32, width: i32, height: i32);
        fn wglCreateContext(hdc: HDC) -> Hglrc;
        fn wglDeleteContext(context: Hglrc) -> i32;
        fn wglMakeCurrent(hdc: HDC, context: Hglrc) -> i32;
    }

    #[link(name = "d3d11")]
    extern "system" {
        fn D3D11CreateDeviceAndSwapChain(
            adapter: IUnknownPtr,
            driver_type: u32,
            software: isize,
            flags: u32,
            feature_levels: *const u32,
            feature_levels_count: u32,
            sdk_version: u32,
            swap_chain_desc: *const DxgiSwapChainDesc,
            swap_chain: *mut IDXGISwapChainPtr,
            device: *mut ID3D11DevicePtr,
            feature_level: *mut u32,
            immediate_context: *mut ID3D11DeviceContextPtr,
        ) -> HRESULT;
    }

    #[repr(C)]
    struct DxgiRational {
        numerator: u32,
        denominator: u32,
    }

    #[repr(C)]
    struct DxgiModeDesc {
        width: u32,
        height: u32,
        refresh_rate: DxgiRational,
        format: u32,
        scanline_ordering: u32,
        scaling: u32,
    }

    #[repr(C)]
    struct DxgiSampleDesc {
        count: u32,
        quality: u32,
    }

    #[repr(C)]
    struct DxgiSwapChainDesc {
        buffer_desc: DxgiModeDesc,
        sample_desc: DxgiSampleDesc,
        buffer_usage: u32,
        buffer_count: u32,
        output_window: HWND,
        windowed: i32,
        swap_effect: u32,
        flags: u32,
    }

    #[repr(C)]
    struct UnknownVtbl {
        query_interface:
            unsafe extern "system" fn(IUnknownPtr, *const GUID, *mut IUnknownPtr) -> HRESULT,
        add_ref: unsafe extern "system" fn(IUnknownPtr) -> u32,
        release: unsafe extern "system" fn(IUnknownPtr) -> u32,
    }

    #[repr(C)]
    struct DxgiSwapChainVtbl {
        query_interface:
            unsafe extern "system" fn(IDXGISwapChainPtr, *const GUID, *mut IUnknownPtr) -> HRESULT,
        add_ref: unsafe extern "system" fn(IDXGISwapChainPtr) -> u32,
        release: unsafe extern "system" fn(IDXGISwapChainPtr) -> u32,
        set_private_data: usize,
        set_private_data_interface: usize,
        get_private_data: usize,
        get_parent: usize,
        get_device: usize,
        present: unsafe extern "system" fn(IDXGISwapChainPtr, u32, u32) -> HRESULT,
        get_buffer: unsafe extern "system" fn(
            IDXGISwapChainPtr,
            u32,
            *const GUID,
            *mut IUnknownPtr,
        ) -> HRESULT,
        set_fullscreen_state: usize,
        get_fullscreen_state: usize,
        get_desc: usize,
        resize_buffers:
            unsafe extern "system" fn(IDXGISwapChainPtr, u32, u32, u32, u32, u32) -> HRESULT,
    }

    #[repr(C)]
    struct D3d11DeviceVtbl {
        query_interface:
            unsafe extern "system" fn(ID3D11DevicePtr, *const GUID, *mut IUnknownPtr) -> HRESULT,
        add_ref: unsafe extern "system" fn(ID3D11DevicePtr) -> u32,
        release: unsafe extern "system" fn(ID3D11DevicePtr) -> u32,
        create_buffer: usize,
        create_texture_1d: usize,
        create_texture_2d: usize,
        create_texture_3d: usize,
        create_shader_resource_view: usize,
        create_unordered_access_view: usize,
        create_render_target_view: unsafe extern "system" fn(
            ID3D11DevicePtr,
            IUnknownPtr,
            *const std::ffi::c_void,
            *mut ID3D11RenderTargetViewPtr,
        ) -> HRESULT,
    }

    #[repr(C)]
    struct D3d11DeviceContextVtbl {
        query_interface: unsafe extern "system" fn(
            ID3D11DeviceContextPtr,
            *const GUID,
            *mut IUnknownPtr,
        ) -> HRESULT,
        add_ref: unsafe extern "system" fn(ID3D11DeviceContextPtr) -> u32,
        release: unsafe extern "system" fn(ID3D11DeviceContextPtr) -> u32,
        get_device: usize,
        get_private_data: usize,
        set_private_data: usize,
        set_private_data_interface: usize,
        vs_set_constant_buffers: usize,
        ps_set_shader_resources: usize,
        ps_set_shader: usize,
        ps_set_samplers: usize,
        vs_set_shader: usize,
        draw_indexed: usize,
        draw: usize,
        map: usize,
        unmap: usize,
        ps_set_constant_buffers: usize,
        ia_set_input_layout: usize,
        ia_set_vertex_buffers: usize,
        ia_set_index_buffer: usize,
        draw_indexed_instanced: usize,
        draw_instanced: usize,
        gs_set_constant_buffers: usize,
        gs_set_shader: usize,
        ia_set_primitive_topology: usize,
        vs_set_shader_resources: usize,
        vs_set_samplers: usize,
        begin: usize,
        end: usize,
        get_data: usize,
        set_predication: usize,
        gs_set_shader_resources: usize,
        gs_set_samplers: usize,
        om_set_render_targets: usize,
        om_set_render_targets_and_unordered_access_views: usize,
        om_set_blend_state: usize,
        om_set_depth_stencil_state: usize,
        so_set_targets: usize,
        draw_auto: usize,
        draw_indexed_instanced_indirect: usize,
        draw_instanced_indirect: usize,
        dispatch: usize,
        dispatch_indirect: usize,
        rs_set_state: usize,
        rs_set_viewports: usize,
        rs_set_scissor_rects: usize,
        copy_subresource_region: usize,
        copy_resource: usize,
        update_subresource: usize,
        copy_structure_count: usize,
        clear_render_target_view: unsafe extern "system" fn(
            ID3D11DeviceContextPtr,
            ID3D11RenderTargetViewPtr,
            *const f32,
        ),
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
        visible: bool,
        last_parent_client_bounds: Option<(i32, i32, i32, i32)>,
    }

    enum WindowsSurfaceRenderer {
        OpenGl {
            hdc: HDC,
            hglrc: Hglrc,
        },
        D3d11 {
            device: ID3D11DevicePtr,
            context: ID3D11DeviceContextPtr,
            swap_chain: IDXGISwapChainPtr,
            render_target: ID3D11RenderTargetViewPtr,
            width: i32,
            height: i32,
            feature_level: u32,
            last_present: HRESULT,
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
        PopupLayered,
        Control,
    }

    impl WindowsHostStyle {
        fn from_env(attached: bool) -> Self {
            if !attached {
                return Self::PopupLayered;
            }

            match env::var("STEAM_BRIDGE_WINDOWS_NATIVE_HOST_STYLE") {
                Ok(value) => match value.trim().to_ascii_lowercase().as_str() {
                    "control" | "overlapped" | "plain" => Self::Control,
                    _ => Self::PopupLayered,
                },
                Err(_) => Self::PopupLayered,
            }
        }

        fn as_str(self) -> &'static str {
            match self {
                Self::PopupLayered => "popup-layered",
                Self::Control => "control",
            }
        }
    }

    unsafe impl Send for NativeSurface {}

    static SURFACE: Lazy<Mutex<Option<NativeSurface>>> = Lazy::new(|| Mutex::new(None));
    static NEXT_SURFACE_INSTANCE_GENERATION: AtomicU64 = AtomicU64::new(0);
    static WINDOW_CLASS_RESULT: OnceLock<Result<(), String>> = OnceLock::new();
    static WINDOW_MESSAGE_DIAGNOSTICS: Lazy<Mutex<WindowMessageDiagnostics>> =
        Lazy::new(|| Mutex::new(WindowMessageDiagnostics::default()));

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

    pub fn open(title: Option<String>) -> Result<(), Error> {
        close();
        let title = title.unwrap_or_else(|| "Steam Bridge Native Overlay Probe".to_owned());
        let surface = unsafe { create_surface(&title, None, false)? };
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
            show_surface(surface);
            surface.visible = true;
            update_window_frame(surface);
            sync_window_style(surface);
            if !surface.input_passthrough {
                activate_window(surface);
            }
        })
    }

    pub fn hide() -> Result<(), Error> {
        with_surface(|surface| unsafe {
            ShowWindow(surface.hwnd, SW_HIDE);
            surface.visible = false;
        })
    }

    pub fn set_input_passthrough(pass_through: bool) -> Result<(), Error> {
        with_surface(|surface| unsafe {
            if surface.input_passthrough == pass_through {
                return;
            }
            surface.input_passthrough = pass_through;
            sync_window_style(surface);
            if !pass_through {
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
            sync_window_style(surface);
        })
    }

    pub fn pump() -> Result<(), Error> {
        let mut guard = SURFACE
            .lock()
            .expect("Steam overlay native surface lock poisoned");
        let Some(surface) = guard.as_mut() else {
            return Ok(());
        };

        let result = unsafe {
            pump_messages(surface.hwnd);
            update_window_frame(surface);
            if surface.visible {
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

    pub fn update_frame(_buffer: Buffer, _width: u32, _height: u32) -> Result<(), Error> {
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
            Some(
                json!({
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
                    "visible": surface.visible,
                    "frame": surface.frame,
                    "rect": rect,
                    "parentRect": parent_rect,
                    "parentClientRect": parent_client_rect,
                    "messages": message_diagnostics,
                })
                .to_string(),
            )
        }
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
    ) -> Result<NativeSurface, Error> {
        ensure_window_class()?;
        reset_window_message_diagnostics();
        let title = wide_string(title);
        let class_name = window_class_name();
        let parent_rect = parent_hwnd.and_then(read_client_rect_in_screen);
        let (x, y, width, height) = parent_rect
            .map(|rect| {
                (
                    rect.left,
                    rect.top,
                    (rect.right - rect.left).max(1),
                    (rect.bottom - rect.top).max(1),
                )
            })
            .unwrap_or((100, 100, 960, 540));
        let backend = WindowsNativeBackend::from_env();
        let host_style = WindowsHostStyle::from_env(parent_hwnd.is_some());
        let input_passthrough = parent_hwnd.is_some()
            && host_style != WindowsHostStyle::Control
            && initial_input_passthrough;
        let ex_style = base_ex_style(parent_hwnd.is_some(), input_passthrough, host_style);
        let style = if parent_hwnd.is_some() && host_style == WindowsHostStyle::PopupLayered {
            WS_POPUP | WS_CLIPSIBLINGS | WS_CLIPCHILDREN
        } else {
            WS_OVERLAPPEDWINDOW | WS_CLIPSIBLINGS | WS_CLIPCHILDREN
        };
        let owner = if parent_hwnd.is_some() && host_style == WindowsHostStyle::PopupLayered {
            parent_hwnd.unwrap_or(ptr::null_mut())
        } else {
            ptr::null_mut()
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

        let renderer = match create_renderer(hwnd, backend, width, height) {
            Ok(renderer) => renderer,
            Err(error) => {
                DestroyWindow(hwnd);
                return Err(error);
            }
        };

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
            opaque: parent_hwnd.is_none()
                || !input_passthrough
                || host_style == WindowsHostStyle::Control,
            visible: true,
            last_parent_client_bounds: None,
        };
        sync_window_style(&mut surface);
        show_surface(&surface);
        update_window_frame(&mut surface);
        if !surface.input_passthrough {
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
        let seconds = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map(|duration| duration.as_millis() as f32 / 1000.0)
            .unwrap_or(0.0);
        let wave = (seconds * 1.7).sin() * 0.5 + 0.5;
        let color = if surface.opaque {
            [0.05 + wave * 0.10, 0.08, 0.14 + wave * 0.08, 1.0]
        } else {
            [0.0, 0.0, 0.0, 0.0]
        };

        match &mut surface.renderer {
            WindowsSurfaceRenderer::OpenGl { hdc, hglrc } => {
                render_opengl(*hdc, *hglrc, width, height, color)?
            }
            WindowsSurfaceRenderer::D3d11 {
                device,
                context,
                swap_chain,
                render_target,
                width: render_width,
                height: render_height,
                last_present,
                ..
            } => {
                if *render_width != width || *render_height != height {
                    resize_d3d11_render_target(*device, *swap_chain, render_target, width, height)?;
                    *render_width = width;
                    *render_height = height;
                }
                *last_present = render_d3d11(*context, *swap_chain, *render_target, color)?;
            }
        }

        surface.frame = surface.frame.wrapping_add(1);
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
        let swap_chain_desc = DxgiSwapChainDesc {
            buffer_desc: DxgiModeDesc {
                width: width.max(1) as u32,
                height: height.max(1) as u32,
                refresh_rate: DxgiRational {
                    numerator: 0,
                    denominator: 1,
                },
                format: DXGI_FORMAT_R8G8B8A8_UNORM,
                scanline_ordering: 0,
                scaling: 0,
            },
            sample_desc: DxgiSampleDesc {
                count: 1,
                quality: 0,
            },
            buffer_usage: DXGI_USAGE_RENDER_TARGET_OUTPUT,
            buffer_count: 1,
            output_window: hwnd,
            windowed: 1,
            swap_effect: DXGI_SWAP_EFFECT_DISCARD,
            flags: 0,
        };
        let feature_levels = [
            D3D_FEATURE_LEVEL_11_0,
            D3D_FEATURE_LEVEL_10_1,
            D3D_FEATURE_LEVEL_10_0,
        ];
        let mut swap_chain: IDXGISwapChainPtr = ptr::null_mut();
        let mut device: ID3D11DevicePtr = ptr::null_mut();
        let mut feature_level = 0;
        let mut context: ID3D11DeviceContextPtr = ptr::null_mut();
        let hr = D3D11CreateDeviceAndSwapChain(
            ptr::null_mut(),
            D3D_DRIVER_TYPE_HARDWARE,
            0,
            0,
            feature_levels.as_ptr(),
            feature_levels.len() as u32,
            D3D11_SDK_VERSION,
            &swap_chain_desc,
            &mut swap_chain,
            &mut device,
            &mut feature_level,
            &mut context,
        );
        if failed(hr) || swap_chain.is_null() || device.is_null() || context.is_null() {
            release_unknown(context);
            release_unknown(device);
            release_unknown(swap_chain);
            return Err(Error::from_reason(format!(
                "Failed to create Windows native overlay D3D11 swapchain: {}",
                hresult_hex(hr)
            )));
        }

        let mut render_target = ptr::null_mut();
        if let Err(error) = create_d3d11_render_target(device, swap_chain, &mut render_target) {
            release_unknown(context);
            release_unknown(device);
            release_unknown(swap_chain);
            return Err(error);
        }

        Ok(WindowsSurfaceRenderer::D3d11 {
            device,
            context,
            swap_chain,
            render_target,
            width: width.max(1),
            height: height.max(1),
            feature_level,
            last_present: S_OK,
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

    unsafe fn render_d3d11(
        context: ID3D11DeviceContextPtr,
        swap_chain: IDXGISwapChainPtr,
        render_target: ID3D11RenderTargetViewPtr,
        color: [f32; 4],
    ) -> Result<HRESULT, Error> {
        if context.is_null() || swap_chain.is_null() || render_target.is_null() {
            return Err(Error::from_reason(
                "Windows native overlay D3D11 renderer was not initialized",
            ));
        }
        ((*d3d11_context_vtbl(context)).clear_render_target_view)(
            context,
            render_target,
            color.as_ptr(),
        );
        let hr = ((*dxgi_swap_chain_vtbl(swap_chain)).present)(swap_chain, 1, 0);
        if failed(hr) {
            return Err(Error::from_reason(format!(
                "Windows native overlay D3D11 Present failed: {}",
                hresult_hex(hr)
            )));
        }
        Ok(hr)
    }

    unsafe fn resize_d3d11_render_target(
        device: ID3D11DevicePtr,
        swap_chain: IDXGISwapChainPtr,
        render_target: &mut ID3D11RenderTargetViewPtr,
        width: i32,
        height: i32,
    ) -> Result<(), Error> {
        release_unknown(*render_target);
        *render_target = ptr::null_mut();
        let hr = ((*dxgi_swap_chain_vtbl(swap_chain)).resize_buffers)(
            swap_chain,
            0,
            width.max(1) as u32,
            height.max(1) as u32,
            DXGI_FORMAT_R8G8B8A8_UNORM,
            0,
        );
        if failed(hr) {
            return Err(Error::from_reason(format!(
                "Windows native overlay D3D11 ResizeBuffers failed: {}",
                hresult_hex(hr)
            )));
        }
        create_d3d11_render_target(device, swap_chain, render_target)
    }

    unsafe fn create_d3d11_render_target(
        device: ID3D11DevicePtr,
        swap_chain: IDXGISwapChainPtr,
        render_target: &mut ID3D11RenderTargetViewPtr,
    ) -> Result<(), Error> {
        let mut back_buffer: IUnknownPtr = ptr::null_mut();
        let hr = ((*dxgi_swap_chain_vtbl(swap_chain)).get_buffer)(
            swap_chain,
            0,
            &IID_ID3D11_TEXTURE_2D,
            &mut back_buffer,
        );
        if failed(hr) || back_buffer.is_null() {
            return Err(Error::from_reason(format!(
                "Windows native overlay D3D11 GetBuffer failed: {}",
                hresult_hex(hr)
            )));
        }

        let hr = ((*d3d11_device_vtbl(device)).create_render_target_view)(
            device,
            back_buffer,
            ptr::null(),
            render_target,
        );
        release_unknown(back_buffer);
        if failed(hr) || render_target.is_null() {
            release_unknown(*render_target);
            *render_target = ptr::null_mut();
            return Err(Error::from_reason(format!(
                "Windows native overlay D3D11 CreateRenderTargetView failed: {}",
                hresult_hex(hr)
            )));
        }
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
            WindowsSurfaceRenderer::D3d11 {
                render_target,
                context,
                device,
                swap_chain,
                ..
            } => {
                release_unknown(render_target);
                release_unknown(context);
                release_unknown(device);
                release_unknown(swap_chain);
            }
        }
    }

    unsafe fn renderer_diagnostics_json(renderer: &WindowsSurfaceRenderer) -> serde_json::Value {
        match renderer {
            WindowsSurfaceRenderer::OpenGl { .. } => json!({
                "backend": "windows-opengl",
            }),
            WindowsSurfaceRenderer::D3d11 {
                width,
                height,
                feature_level,
                last_present,
                ..
            } => json!({
                "backend": "windows-d3d11",
                "width": width,
                "height": height,
                "featureLevel": format!("0x{feature_level:04X}"),
                "lastPresent": hresult_hex(*last_present),
            }),
        }
    }

    unsafe fn dxgi_swap_chain_vtbl(swap_chain: IDXGISwapChainPtr) -> *const DxgiSwapChainVtbl {
        *(swap_chain as *const *const DxgiSwapChainVtbl)
    }

    unsafe fn d3d11_device_vtbl(device: ID3D11DevicePtr) -> *const D3d11DeviceVtbl {
        *(device as *const *const D3d11DeviceVtbl)
    }

    unsafe fn d3d11_context_vtbl(context: ID3D11DeviceContextPtr) -> *const D3d11DeviceContextVtbl {
        *(context as *const *const D3d11DeviceContextVtbl)
    }

    unsafe fn release_unknown(pointer: IUnknownPtr) {
        if pointer.is_null() {
            return;
        }
        let vtbl = *(pointer as *const *const UnknownVtbl);
        ((*vtbl).release)(pointer);
    }

    fn failed(hr: HRESULT) -> bool {
        hr < 0
    }

    fn hresult_hex(hr: HRESULT) -> String {
        format!("0x{:08X}", hr as u32)
    }

    unsafe fn update_window_frame(surface: &mut NativeSurface) {
        let Some(parent_hwnd) = surface.parent_hwnd else {
            return;
        };
        let Some(rect) = read_client_rect_in_screen(parent_hwnd) else {
            return;
        };
        let width = (rect.right - rect.left).max(1);
        let height = (rect.bottom - rect.top).max(1);
        let bounds = (rect.left, rect.top, width, height);
        if surface.last_parent_client_bounds == Some(bounds) {
            return;
        }
        let mut flags = SWP_NOOWNERZORDER | SWP_NOZORDER;
        if surface.input_passthrough {
            flags |= SWP_NOACTIVATE;
        }
        if SetWindowPos(
            surface.hwnd,
            ptr::null_mut(),
            rect.left,
            rect.top,
            width,
            height,
            flags,
        ) != 0
        {
            surface.last_parent_client_bounds = Some(bounds);
        }
    }

    unsafe fn sync_window_style(surface: &mut NativeSurface) {
        let mut ex_style = GetWindowLongPtrW(surface.hwnd, GWL_EXSTYLE) as u32;
        if surface.host_style == WindowsHostStyle::Control {
            ex_style &= !(WS_EX_LAYERED
                | WS_EX_TOOLWINDOW
                | WS_EX_NOACTIVATE
                | WS_EX_TRANSPARENT
                | WS_EX_TOPMOST);
            SetWindowLongPtrW(surface.hwnd, GWL_EXSTYLE, ex_style as isize);
            SetWindowPos(
                surface.hwnd,
                ptr::null_mut(),
                0,
                0,
                0,
                0,
                SWP_NOMOVE | SWP_NOSIZE | SWP_NOOWNERZORDER | SWP_NOZORDER | SWP_FRAMECHANGED,
            );
            if surface.input_passthrough || !surface.opaque {
                ShowWindow(surface.hwnd, SW_HIDE);
                surface.visible = false;
            } else {
                ShowWindow(surface.hwnd, SW_SHOW);
                surface.visible = true;
                activate_window(surface);
            }
            return;
        }

        if surface.parent_hwnd.is_some() {
            ex_style |= WS_EX_TOPMOST;
            if surface.input_passthrough {
                ex_style |= WS_EX_LAYERED | WS_EX_TOOLWINDOW | WS_EX_NOACTIVATE;
            } else {
                ex_style &= !(WS_EX_LAYERED | WS_EX_TOOLWINDOW | WS_EX_NOACTIVATE);
            }
        } else {
            ex_style |= WS_EX_LAYERED | WS_EX_TOOLWINDOW;
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
            let alpha = if surface.opaque { 255 } else { 1 };
            SetLayeredWindowAttributes(surface.hwnd, 0, alpha, LWA_ALPHA);
        }
    }

    unsafe fn activate_window(surface: &NativeSurface) {
        SetForegroundWindow(surface.hwnd);
        SetActiveWindow(surface.hwnd);
        SetFocus(surface.hwnd);
    }

    unsafe fn show_surface(surface: &NativeSurface) {
        let show_command = if surface.input_passthrough {
            SW_SHOWNOACTIVATE
        } else {
            SW_SHOW
        };
        ShowWindow(surface.hwnd, show_command);
    }

    unsafe fn destroy_surface(surface: NativeSurface) {
        release_renderer(surface.renderer, surface.hwnd);
        if !surface.hwnd.is_null() {
            DestroyWindow(surface.hwnd);
        }
    }

    unsafe fn pump_messages(hwnd: HWND) {
        let mut message: MSG = mem::zeroed();
        while PeekMessageW(&mut message, hwnd, 0, 0, PM_REMOVE) != 0 {
            TranslateMessage(&message);
            DispatchMessageW(&message);
        }
    }

    unsafe extern "system" fn window_proc(
        hwnd: HWND,
        message: u32,
        wparam: WPARAM,
        lparam: LPARAM,
    ) -> LRESULT {
        record_window_message(hwnd, message, wparam, lparam);
        if message == WM_CLOSE {
            ShowWindow(hwnd, SW_HIDE);
            return 0;
        }
        if message == WM_MOUSEACTIVATE
            && GetWindowLongPtrW(hwnd, GWL_EXSTYLE) as u32 & WS_EX_NOACTIVATE != 0
        {
            return MA_NOACTIVATE as LRESULT;
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
            hCursor: ptr::null_mut(),
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

    fn read_client_rect_in_screen(hwnd: HWND) -> Option<RECT> {
        unsafe {
            let mut rect: RECT = mem::zeroed();
            if GetClientRect(hwnd, &mut rect) == 0 {
                return None;
            }

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

    fn base_ex_style(attached: bool, pass_through: bool, host_style: WindowsHostStyle) -> u32 {
        if host_style == WindowsHostStyle::Control {
            return 0;
        }

        if attached && !pass_through {
            return WS_EX_TOPMOST;
        }

        let mut style = WS_EX_LAYERED | WS_EX_TOOLWINDOW;
        if attached {
            style |= WS_EX_TOPMOST | WS_EX_NOACTIVATE;
        }
        if pass_through {
            style |= WS_EX_TRANSPARENT;
        }
        style
    }

    fn reset_window_message_diagnostics() {
        *WINDOW_MESSAGE_DIAGNOSTICS
            .lock()
            .expect("Steam overlay window message diagnostics lock poisoned") =
            WindowMessageDiagnostics::default();
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
    use std::ffi::{c_void, CString};
    use std::mem;
    use std::os::raw::{c_int, c_long, c_uchar, c_uint};
    use std::ptr;
    use std::sync::Mutex;
    use std::time::{SystemTime, UNIX_EPOCH};
    use x11_dl::{glx, xfixes, xlib};

    const SHAPE_INPUT: c_int = 2;

    struct NativeSurface {
        xlib: xlib::Xlib,
        glx: glx::Glx,
        xfixes: Option<xfixes::Xlib>,
        display: *mut xlib::Display,
        window: xlib::Window,
        parent_window: Option<xlib::Window>,
        opacity_atom: xlib::Atom,
        colormap: xlib::Colormap,
        context: glx::GLXContext,
        frame: u64,
        input_passthrough: bool,
        opaque: bool,
    }

    unsafe impl Send for NativeSurface {}

    static SURFACE: Lazy<Mutex<Option<NativeSurface>>> = Lazy::new(|| Mutex::new(None));

    pub fn open(title: Option<String>) -> Result<(), Error> {
        close();

        let title = title.unwrap_or_else(|| "Steam Bridge Native Overlay Probe".to_owned());
        let surface = unsafe { create_probe_window(&title, None)? };
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
            if surface.parent_window.is_some() {
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
            if surface.parent_window.is_some() && surface.input_passthrough != pass_through {
                apply_host_input_mode(
                    &surface.xlib,
                    surface.xfixes.as_ref(),
                    surface.display,
                    surface.window,
                    pass_through,
                );
                surface.input_passthrough = pass_through;
            }
        })
    }

    pub fn set_opaque(opaque: bool) -> Result<(), Error> {
        with_surface(|surface| unsafe {
            if surface.parent_window.is_some() && surface.opaque != opaque {
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

    pub fn update_frame(_buffer: Buffer, _width: u32, _height: u32) -> Result<(), Error> {
        Ok(())
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
        close_matching(|surface| surface.parent_window.is_none());
    }

    pub fn detach_host() {
        close_matching(|surface| surface.parent_window.is_some());
    }

    pub fn is_probe_open() -> bool {
        SURFACE
            .lock()
            .expect("Steam overlay native surface lock poisoned")
            .as_ref()
            .is_some_and(|surface| surface.parent_window.is_none())
    }

    pub fn is_embedded() -> bool {
        SURFACE
            .lock()
            .expect("Steam overlay native surface lock poisoned")
            .as_ref()
            .is_some_and(|surface| surface.parent_window.is_some())
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
        if let Some(parent_window) = parent_window {
            (xlib.XSetTransientForHint)(display, window, parent_window);
            apply_host_input_mode(&xlib, xfixes.as_ref(), display, window, true);
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
            opacity_atom,
            colormap,
            context,
            frame: 0,
            input_passthrough,
            opaque,
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

    unsafe fn apply_host_input_mode(
        xlib: &xlib::Xlib,
        xfixes: Option<&xfixes::Xlib>,
        display: *mut xlib::Display,
        window: xlib::Window,
        pass_through: bool,
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

        (xlib.XFlush)(display);
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
