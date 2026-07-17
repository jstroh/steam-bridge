# Electron and the Steam Overlay on Windows

Last reviewed: 2026-07-16

## Decision

Do not continue treating the Steam overlay as a normal Electron child-window
positioning problem. A Win32 child window is the right primitive for geometry,
clipping, parent movement, and lifetime, but the source-linked live test showed
that Steam did not render into its D3D11 child swapchain. The owned top-level
presenter is hookable and can be synchronized to Electron's content rectangle,
but it cannot make Electron's native chrome interactive while Steam is
deliberately suppressing application input.

The supported long-term Windows design is one authoritative native D3D
top-level host which composites an offscreen Chromium/Electron surface every
frame and forwards host input to Chromium. Before replacing the current
consumer window, prove that design in a minimal native host, including overlay
rendering and native non-client behavior.

## Primary findings

### Valve's rendering contract

Valve says the overlay hooks a game's rendering API and requires
`SteamAPI_Init` before the OpenGL/D3D device is created. Valve also explicitly
says browsers are unsupported because they pause or repaint only dirty regions.
Its documented workaround for a web game is a native D3D window containing
offscreen Chromium, copying Chromium's texture every frame and forwarding input
to Chromium. Partners commonly use CEF for that architecture.

Source: [Valve Steam Overlay documentation](https://partner.steamgames.com/doc/features/overlay)

This is materially different from placing a second D3D HWND above an existing
Electron window. The native D3D host must be the authoritative presentation
surface that Steam hooks.

### Child and owned HWND semantics

Microsoft documents that a `WS_CHILD` window is confined to its parent's client
area, uses parent-client coordinates, moves with the parent, and receives input
for the area surrendered by the parent. That makes it the cleanest geometry
model. An owned popup instead remains above its owner, is destroyed with it,
and is automatically hidden when the owner is minimized.

Source: [Microsoft Window Features](https://learn.microsoft.com/en-us/windows/win32/winmsg/window-features)

The bridge tested both models:

- `WS_CHILD` fixed geometry, clipping, move, focus, and minimize behavior, but
  Steam activated without drawing its overlay into the child's swapchain.
- An owned D3D11 popup rendered the Steam overlay and can be clipped to the
  Electron content and DWM frame, but requires explicit geometry/focus/lifetime
  synchronization.

Therefore a child HWND is not rejected because it is bad Windows design. It is
rejected because the live Steam renderer did not select that presentation
surface.

### Why title-bar and menu input still fails

NW.js has an exact Chromium-family report: the Steam overlay draws over the
title bar and overrides its functions. This independently matches the consumer
failure rather than indicating a bridge-only bounds mistake.

Source: [NW.js issue #7362](https://github.com/nwjs/nw.js/issues/7362)

Valve does not publish the proprietary overlay input-hook implementation. As a
directly inspectable surrogate, Nemirtingas' Steam-compatible in-game overlay
hooks `GetMessageA/W`, `PeekMessageA/W`, raw input, key-state, cursor, clipping,
and controller APIs. While application input is hidden it consumes mouse and
keyboard messages and zeroes raw input. The Goldberg overlay using that library
explicitly sets `WantCaptureMouse`, `WantCaptureKeyboard`, and
`HideAppInputs(true)` while the overlay is shown.

Sources:

- [Nemirtingas ingame_overlay](https://github.com/Nemirtingas/ingame_overlay)
- [Goldberg Steam Emulator fork](https://github.com/Detanup01/gbe_fork)

This is not proof of Valve's private source code, but it explains the observed
behavior and is consistent with the independent NW.js report. It also explains
why `WS_EX_NOACTIVATE`, `HTTRANSPARENT`, or shrinking the popup to the exact
content rectangle cannot by themselves restore Electron menu/title input: the
suppression occurs in the injected process input path, not only in HWND hit
testing.

### Chromium frame production and legacy flags

Chromium normally updates changed regions rather than producing a complete game
frame. Electron's `webContents.invalidate()` schedules a full repaint, and
community Electron/NW.js workarounds depend on continuous repainting. DevTools
can accidentally become the active surface or generate the activity that makes
the overlay appear, which matches the unstable DevTools behavior observed in
the consumer.

Sources:

- [Electron `webContents` documentation](https://www.electronjs.org/docs/latest/api/web-contents/)
- [NW.js force-repaint issue #7591](https://github.com/nwjs/nw.js/issues/7591)
- [steamworks.js DevTools issue #23](https://github.com/ceifa/steamworks.js/issues/23)

Do not restore `--disable-direct-composition`. steamworks.js users isolated it
as the cause of duplicate Alt+Tab ghost windows while the overlay continued to
work with only `--in-process-gpu` in that test. A 2025 Greenworks example also
reported only `--in-process-gpu` as necessary on its test system. The bridge's
separate native D3D presenter should need neither Chromium rendering switch.

Sources:

- [steamworks.js issue #95](https://github.com/ceifa/steamworks.js/issues/95)
- [Greenworks PR #338](https://github.com/greenheartgames/greenworks/pull/338)

### Electron can implement Valve's prescribed model

Electron offscreen rendering can emit a CPU bitmap or a shared GPU texture. The
shared-texture path avoids a CPU-to-GPU round trip but requires a native module.
`webContents.sendInputEvent()` can forward mouse, wheel, and keyboard events to
the page, subject to Electron's focus requirement. This is the direct Electron
equivalent of Valve's CEF recommendation.

Sources:

- [Electron offscreen rendering](https://www.electronjs.org/docs/latest/tutorial/offscreen-rendering)
- [Electron `webContents.sendInputEvent`](https://www.electronjs.org/docs/latest/api/web-contents/#contentssendinputeventinputevent)

## Implementation path

1. Build a minimal top-level `WS_OVERLAPPEDWINDOW` D3D11 host. Initialize Steam
   before creating D3D, present continuously, and do not embed Electron yet.
2. Manually prove Shift+Tab rendering, Steam clicks, native title drag,
   minimize/maximize/restore, menu input, rounded corners, Alt+Tab, DPI changes,
   and shutdown. If Steam suppresses true Win32 non-client input here too,
   record that as an overlay-active product constraint rather than adding more
   child/popup styles.
3. Add an offscreen Electron `BrowserWindow`. Start with full CPU frames for a
   correctness proof, then import Electron's shared GPU texture into the D3D11
   compositor for production performance.
4. Forward D3D-host client input to Electron with `sendInputEvent`. Stop
   forwarding game input and pause/resume appropriate state from
   `GameOverlayActivated_t`.
5. Make the native host the only visible top-level game surface. Remove the
   attached-popup presenter, `capturePage()` loop, and Chromium compatibility
   flags only after the replacement passes the complete manual matrix.

## Short-term boundary

The current owned presenter remains useful as a source-linked diagnostic and as
a visually correct overlay surface. It is not a finished solution for an app
that requires native Electron chrome to remain interactive while the Steam
overlay is open. Do not publish or commit it as complete until the native-host
prototype resolves that requirement or the overlay-active chrome limitation is
explicitly accepted.
