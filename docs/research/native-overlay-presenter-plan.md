# Native Overlay Presenter Plan

Last updated: 2026-06-27

This is the forward plan for reliable Steam overlay behavior in Electron apps on
Linux/Steam Deck and macOS. Windows overlay behavior appears lower risk, so the
plan treats Windows as a regression baseline rather than the design driver.

The goal is to make Steam Bridge own the hard platform work. Electron app
builders should initialize Steam, attach one presenter to their main window, and
open overlays through bridge APIs. They should not need app-specific overlay
controllers, X11 or Cocoa window code, Steam renderer process knowledge, or
timing hacks.

## Research Summary

- Valve documents the Steam overlay as a native graphics overlay for DirectX,
  OpenGL, Metal, and Vulkan. Steam API initialization should happen before the
  game initializes its graphics device so Steam can hook the right rendering
  path.
- Valve's overlay documentation specifically calls out browser-based games as a
  hard case. Their suggested direction is a native app with a graphics window
  that drives Chromium rendering, not relying on the browser window itself as
  the overlay target.
- `ISteamUtils::BOverlayNeedsPresent()` exists because event-driven renderers can
  starve overlay notifications. Steam may need the app to keep presenting frames
  so achievement toasts, invites, and other overlay UI can advance.
- Public Electron, WebView2, CEF, Tauri, and Steamworks binding reports point to
  the same failure mode: the web runtime often renders in a GPU child process or
  a surface Steam does not reliably hook. Steamworks calls can succeed while the
  visible overlay never appears.
- Steam Bridge's Deck Desktop testing confirmed a second Electron-specific
  failure mode: if Steam's overlay renderer is inherited by Chromium child
  processes, Steam can create competing `gameoverlayui` targets for both the
  Electron GPU process and the bridge-owned native presenter. The duplicate GPU
  hook can leave stale overlay surfaces after the native presenter receives
  `GameOverlayActivated(false)`.
- Steam Bridge's Deck Desktop proof already validates the core idea on Linux:
  a bridge-owned X11/GLX native presenter can show a modal Steam web overlay,
  emit active/inactive overlay callbacks, and return to the Electron smoke app
  cleanly.
- The app-facing reusable presenter path has been verified on Steam Deck Desktop
  Mode for a modal web overlay: passive host attached, active input/opacity
  during overlay UI, Electron child overlay targets isolated, inactive callbacks
  received, and clean return to the Electron smoke app.
- The reusable presenter path has also been verified for passive Steam
  achievement-progress notifications on Steam Deck Desktop Mode: the host stays
  transparent and click-through, Steam emits `UserAchievementStored`, and the
  achievement-progress toast renders over the Electron app without a modal
  `GameOverlayActivated` callback.
- Deck Desktop social overlays remain separate from the current product proof.
  With Electron child-process isolation enabled, Friends/Game Overview may not
  render; with isolation disabled, Steam can hook Chromium children and render
  social UI but may leave stale overlay surfaces after close.
- Steam Bridge's macOS evidence is weaker: Steam launch and native probe coverage
  exist, and a Metal host path exists, but completed product overlay behavior on
  macOS is not proven yet.

Useful public references:

- Steam Overlay:
  https://partner.steamgames.com/doc/features/overlay
- `ISteamUtils::BOverlayNeedsPresent()`:
  https://partner.steamgames.com/doc/api/ISteamUtils
- Steam Microtransactions implementation:
  https://partner.steamgames.com/doc/features/microtransactions/implementation
- Electron transparent/click-through window behavior:
  https://www.electronjs.org/docs/latest/api/browser-window
- WebView2 overlay failure analysis:
  https://www.construct.net/en/blogs/ashleys-blog-2/trying-show-steam-overlay-1861
- Browser-based game overlay discussion:
  https://steamcommunity.com/discussions/forum/10/591756872987476379/
- Electron overlay regression report:
  https://github.com/electron/electron/issues/47662
- Steamworks.js overlay reports:
  https://github.com/ceifa/steamworks.js/issues/160
  https://github.com/ceifa/steamworks.js/issues/195
- Tauri overlay report:
  https://github.com/tauri-apps/tauri/issues/6196
- Native-presenter style reference implementation:
  https://github.com/ArtyProf/steamworks-ffi-node/blob/main/docs/STEAM_OVERLAY_INTEGRATION.md

## Design Direction

Build a Steam Bridge owned native overlay presenter:

```ts
const presenter = steam.overlay.attachPresenter(mainWindow, {
  mode: "passive",
  idleFps: 0,
  needsPresentFps: 30,
  activeOverlayFps: 30
});

await steam.overlay.openWebCheckout(checkoutUrl, { modal: true });
```

The presenter should:

- be created early enough for Steam to hook a native graphics surface;
- stay attached to the Electron game window while the game is running;
- be transparent, non-focusable, and click-through during passive mode;
- follow Electron window moves, resizes, fullscreen changes, and visibility;
- present no frames or very few frames while idle;
- increase presentation only when `overlayNeedsPresent` is true or a Steam
  overlay is active;
- reuse the same surface for checkout, store, web, and passive Steam
  notifications;
- route overlay targets by behavior: interactive native host for web, store, and
  checkout; passive host pumping for notifications; social/dialog panels remain
  a separate investigation path;
- expose diagnostics so app code and tests can tell whether the presenter is
  attached, visible, passive, active, pumping, and recently touched by overlay
  callbacks.

This should replace app-owned overlay controllers. App builders should not need
to know whether the active platform uses X11/GLX, Metal, or another backend.

## Proposed Public API

Initial product-shaped API:

```ts
const presenter = client.overlay.attachPresenter(
  steamworks.electronOverlayPresenterOptions(mainWindow, {
    mode: "passive"
  })
);

const session = client.overlay.openWebOverlay(url, {
  modal: true,
  presenter
});

const diagnostics = client.overlay.getPresenterDiagnostics();
```

Near-term compatibility API:

```ts
client.overlay.activateToWebPageWithNativeSession(url, {
  ...steamworks.electronNativeOverlaySessionOptions(mainWindow),
  modal: true
});
```

The compatibility API should keep working while the presenter API matures. The
new API should eventually own the native surface lifecycle instead of creating a
fresh session per overlay action.

## Linux and Steam Deck Plan

Primary backend: X11/GLX.

Current evidence:

- Deck Desktop Mode can display and close a modal Steam web overlay over the
  bridge-owned GLX presenter.
- Deck Desktop Mode can do the same through the reusable app-facing presenter
  API (`attachPresenter` plus `openWebOverlay`) while returning the host to
  transparent, click-through passive mode after overlay close. This proof uses
  `electronConfigureSteamOverlay()` child-process isolation so there is only one
  `gameoverlayui` target attached to the main/native process.
- Deck Desktop Mode can show a passive achievement-progress toast over the
  Electron smoke app through the reusable presenter path while the native host
  remains click-through and transparent, also with a single overlay target.
- The same path is good enough for checkout-style proof when launched under a
  real installed Steam app with a configured product or transaction.
- Deck Desktop Mode does not yet have a passing Shift+Tab/hotkey proof. The
  `--visual-toggle-probe` evidence after a passive-presenter toast run stayed in
  the Electron app and did not emit `GameOverlayActivated`, so hotkey/social
  toggling remains separate from the product web/checkout path.
- Electron-only social overlay can render only when Electron child overlay
  targets are allowed. A Deck Desktop diagnostic run with child env scrubbing and
  `no-zygote` isolation disabled produced visible Steam desktop overlay UI and
  `active=true` from the raw `dialog` action, with `gameoverlayui` attached to
  Electron's GPU process. The same run did not close from Shift+Tab/Escape or an
  X-click probe, so this is not a pass. Reusable presenter dialog activation
  remains an investigation path, not product proof: when children are isolated it
  does not render or emit active=true; when children are unisolated it creates
  duplicate `gameoverlayui` targets for the GPU child and main/native process and
  still fails close/back-to-app proof. A focused/raised X11 host experiment did
  not make `ActivateGameOverlay("Friends")` render or emit an activation
  callback, so do not promote host focus handoff into the presenter API as a
  social-overlay fix. Making the dialog host opaque/input-capable like the
  web/store path only exposes a black presenter surface and still does not
  activate Steam social UI, so opacity handoff is also not a social-overlay fix.

Next work:

1. Promote the current X11/GLX probe into a persistent presenter object.
2. Add passive mode:
   - transparent background;
   - click-through input region;
   - non-focusable window hints;
   - attached/transient relationship to the Electron game window;
   - idle frame budget of zero or near-zero.
   - On Linux/X11, fully idle mode currently uses an empty XFixes input shape
     and `_NET_WM_WINDOW_OPACITY=0`; `overlayNeedsPresent` can restore opacity
     while leaving input click-through for passive notifications; active overlay
     mode restores both input and opacity so Steam UI can receive clicks.
   - When Steam emits `GameOverlayActivated(false)`, park the host transparent
     even if `overlayNeedsPresent` lingers so stale modal surfaces do not remain
     over the app.
3. Add an adaptive pump scheduler:
   - idle: no fixed 30 FPS loop;
   - `overlayNeedsPresent=true`: pump around 30 FPS;
   - `GameOverlayActivated(true)`: pump around 30 FPS;
   - `GameOverlayActivated(false)`: return to passive after a short grace period.
4. Track resize/fullscreen state every pump and through window events where
   available.
5. Add a kill switch/env flag that disables the presenter and falls back to the
   existing explicit session helpers.
6. Keep Electron child overlay targets isolated for product proofs:
   - scrub Steam overlay renderer entries from `LD_PRELOAD` /
     `DYLD_INSERT_LIBRARIES` before Electron spawns children;
   - on Linux, use Electron's `no-zygote` switch so Chromium children exec
     clean instead of forking the already-loaded Steam overlay library;
   - assert Deck proofs have one `gameoverlayui` process for the app.
7. Re-run checkout proof:
   - generic App ID `480` for public plumbing where possible;
   - a real app/product only for private purchase proof;
   - keep private app IDs, item definitions, transaction IDs, and URLs out of
     committed files.
8. Treat Wayland as a later backend unless Steam/Electron are running through
   Xwayland. If no X11 display is available, fail with explicit diagnostics.

Pass criteria:

- Steam launch, overlay injection, and `overlayEnabled=true`.
- One Steam overlay target for product overlay proofs: no competing
  `gameoverlayui` process attached to Electron's GPU/renderer children.
- Presenter attached and passive without stealing focus.
- App receives pointer/keyboard/controller input while presenter is passive.
- Achievement or notification toast appears and disappears.
- Modal web/checkout overlay opens, accepts input, closes, emits active then
  inactive callbacks, and returns to the app.
- No crash dumps from Electron or the native binding.
- No sustained 30 FPS pumping while idle.

## macOS Apple Silicon Plan

Primary backend: Metal host window. OpenGL can remain as a diagnostic fallback,
but Metal should be the product path.

Current evidence:

- Steam Bridge can create a macOS native presenter/probe.
- A Metal host implementation exists and can attach above an Electron window.
- BrowserWindow-only overlay support is not proven.
- Steam launch, app ID, auth, and callbacks are not enough to claim overlay
  support.

Next work:

1. Make the Metal presenter the default macOS host path for Apple Silicon.
2. Keep the host borderless, transparent, click-through, and unable to become key
   or main.
3. Attach it as a child/auxiliary window above the Electron game window and keep
   it aligned during move, resize, fullscreen, display scale, and space changes.
4. Add passive mode and adaptive pumping like Linux:
   - idle: no steady render loop;
   - `overlayNeedsPresent` or active overlay: present around 30 FPS;
   - after overlay close: return to passive.
5. Add screen-lock/display-sleep awareness so the presenter does not open into a
   black or invalid state while the user cannot interact.
6. Keep code signing requirements explicit in docs and examples. Local smoke
   signing is not enough to claim shipped macOS overlay support.
7. Prove the same three behaviors on Apple Silicon:
   - passive Steam notification/toast;
   - modal web/checkout overlay;
   - close/back-to-app without focus loss or stuck overlay UI.

Pass criteria:

- Steam launch preserves overlay injection into the shipped app process.
- `overlayEnabled=true` with the native presenter path.
- Passive presenter does not steal focus, input, or visible pixels.
- Notification/toast appears over the app.
- Web/checkout overlay opens and closes with active/inactive callbacks.
- No sustained high-FPS idle rendering.

Unsupported for now:

- Intel macOS. The project target is Apple Silicon macOS only.

## Windows Position

Windows should stay in the verification matrix, but it should not drive this
design. If the ordinary Electron overlay path works on Windows, keep it as the
default there and use the presenter only if a future regression proves it is
needed.

Windows gates:

- existing Electron overlay path still passes;
- native package still loads;
- checkout/web/store overlay smoke checks do not regress.

## Diagnostics to Add

Presenter diagnostics should be machine-readable:

```ts
{
  attached: boolean;
  backend: "x11-glx" | "macos-metal" | "macos-opengl" | "none";
  mode: "passive" | "active" | "hidden" | "closed";
  clickThrough: boolean;
  focusable: boolean;
  transparent: boolean;
  bounds: { x: number; y: number; width: number; height: number };
  idleFps: number;
  activeFps: number;
  pumpCount: number;
  lastPumpAt?: number;
  overlayActive: boolean;
  overlayNeedsPresent: boolean;
  lastOverlayEvent?: unknown;
  lastError?: unknown;
}
```

Keep the current `getOverlayDiagnostics()` fields and add presenter diagnostics
beside them instead of replacing them.

## Milestones

1. Document the plan and keep existing session helpers intact.
2. Add `attachPresenter` as an experimental API behind an explicit option or
   environment flag.
3. Refactor the existing native-session helpers to use the same presenter
   lifecycle internally.
4. Harden Linux X11/GLX passive mode and verify on Steam Deck Desktop Mode.
5. Verify Linux passive achievement/toast behavior.
6. Verify Linux checkout/web close and back-to-app behavior with the persistent
   presenter.
7. Harden macOS Apple Silicon Metal passive mode.
8. Verify macOS passive notification/toast behavior.
9. Verify macOS checkout/web close and back-to-app behavior.
10. Promote the presenter API from experimental to recommended only after both
    Linux/Deck and macOS Apple Silicon meet the pass criteria.

## Non-Goals

- Do not commit private app IDs, item definitions, publisher keys, transaction
  IDs, or private purchase URLs.
- Do not require app builders to copy an app-specific native overlay controller.
- Do not claim generic purchase support from App ID `480`; purchase and economy
  proof requires the real app and configured products.
- Do not keep a high-FPS transparent surface running forever while idle.
- Do not treat callback-only social overlay behavior as visual close/back-to-app
  proof.
