# Steam Bridge

[![npm](https://img.shields.io/npm/v/steam-bridge)](https://www.npmjs.com/package/steam-bridge)
[![CI](https://github.com/jstroh/steam-bridge/actions/workflows/ci.yml/badge.svg)](https://github.com/jstroh/steam-bridge/actions/workflows/ci.yml)
[![license](https://img.shields.io/npm/l/steam-bridge)](LICENSE)

Native Steamworks for Electron and Node, with a TypeScript API and a Rust
`napi-rs` core.

Steam Bridge handles Steam API initialization, callbacks, native library
loading, and managed Electron overlays. The npm package ships ready-to-use
native addons and Valve runtime redistributables for every supported platform,
so application developers do not need to download the Steamworks SDK.

## What you get

- A typed Steamworks API for auth, achievements, stats, cloud, input,
  inventory, workshop, networking, matchmaking, game servers, and more.
- A compatibility-style grouped client for familiar JavaScript call patterns.
- Managed Electron overlays with one application-facing API across Windows,
  Linux, Steam Deck, and macOS.
- A Steam Web API client for public and publisher endpoints.
- Prebuilt native binaries and Valve runtime libraries in the npm package.

See the [Steam API coverage](docs/steam-api-coverage.md) for the complete
implemented surface and known gaps.

## Install

```sh
npm install steam-bridge
```

Requirements:

- Node.js 18 or newer
- Electron 24 or newer when used with Electron
- A running Steam client and a Steam app ID

The repository smoke application tracks Electron `43.1.1`. Windows
shared-texture hosting is tested against that runtime; applications using the
lower-level host should feature-detect Electron's offscreen texture event.

## Platform Targets

| Platform | Target |
| --- | --- |
| Windows x64 | `x86_64-pc-windows-msvc` |
| Linux x64 and Steam Deck | `x86_64-unknown-linux-gnu` |
| macOS Apple Silicon | `aarch64-apple-darwin` |

### macOS Apple Silicon Only

Intel macOS and universal macOS builds are not supported.
Do not package, launch, or verify macOS smoke apps through Rosetta.

### Cross-platform live QA

Qualify one Steam client at a time. Before starting a live overlay run on a
target machine, force-close the Steam client and its web/overlay descendants on
every other Windows, Linux/Steam Deck, or macOS test machine and verify that
none remain. Common process names include `Steam.exe`/`steam`, `steam_osx`,
`steamwebhelper`, and `gameoverlayui`. Reopen Steam only on the target platform.
This repository treats that clean client handoff as a required precondition so
a competing session cannot distort launch, focus, overlay-routing, or
client-health evidence.

Windows release proof is computer-driven. The actual-game consumer exposes an
opt-in native-menu command for the ordinary Friends overlay, and the receipt
requires its `qa-menu` marker plus real Steam active/inactive callbacks. A human
Shift+Tab is a one-time qualification only when shortcut routing changes, not a
recurring candidate or publication requirement.

Windows release qualification has two independent proof layers: the
consumer-owned canonical 37-CORE actual-game receipt and Steam Bridge's
candidate-bound Windows live-proof receipt for package/runtime/native telemetry
and npm publication. A release needs both; one cannot stand in for the other.

Every actual-game QA and release candidate must use an exact stable Electron
version. Alpha, beta, nightly, and every other prerelease are forbidden. If a
required fix exists only in upstream Electron/Chromium source, record the exact
commit or TODO and wait for a supported stable Electron release instead of
testing a prerelease.

## Quick start

```ts
import steamworks from "steam-bridge";

const client = steamworks.init(480);

const steamId = client.localplayer.getSteamId().steamId64;
const ticket = await client.auth.getAuthTicketForWebApi("my-game");

client.callback.register("MicroTxnAuthorizationResponse", (event) => {
  console.log(event);
});

client.overlay.activateToWebPage(
  "https://store.steampowered.com/app/480/"
);

console.log({ steamId, ticketBytes: ticket.getBytes().length });
```

Valve's SpaceWar App ID `480` is useful for generic local smoke testing.
Replace it with your own app ID for app-specific features and production.
Purchase flows require your real Steam-launched app and configured products;
SpaceWar cannot prove them.

When launching outside Steam during development, place a `steam_appid.txt`
containing your app ID next to the executable or in its working directory.

## Electron overlay

On Linux and macOS, configure Electron before `app.ready`, then create one
managed overlay for the main game window and reuse it. Windows applications
must use the standalone game-host API described below; attached Electron
presentation deliberately fails closed there.

```ts
import { app, BrowserWindow } from "electron";
import steamworks from "steam-bridge";

steamworks.electronConfigureSteamOverlay();
const client = steamworks.init(480);

app.whenReady().then(async () => {
  const mainWindow = new BrowserWindow({ width: 1280, height: 720 });
  const overlay = client.overlay.createElectronSteamOverlay(mainWindow);

  const result = await overlay.openStoreAndWaitIfAvailable({ appId: 480 });
  if (!result) {
    console.warn("The Steam overlay is not available yet");
  }
});
```

The managed overlay supports store, web, checkout, Friends/chat, profiles,
community, achievements, stats, and other Steam surfaces. Its wait helpers
resolve after the Steam overlay closes and control returns to the app.

Steam Bridge supports one managed native presenter per process, controlled
from Electron's main thread. On Linux and macOS this can follow an Electron
window. On Windows the one supported production presenter is the standalone
native host driven by an offscreen Electron renderer.

### Linux and Steam Deck

Electron games that need Steam over live WebGL content should use one visible
native application host and render Electron offscreen into it:

```ts
const session = client.overlay.startNativeOverlaySession({
  title: "My Game",
  clientWidth: 1280,
  clientHeight: 720,
  minClientWidth: 640,
  minClientHeight: 480,
  useLinuxApplicationHost: true,
  frameRate: 90,
  onInputEvent: forwardInputToOffscreenRenderer,
});
```

The native window is the application window. It owns the title bar, menu,
rounded frame, move, resize, maximize, fullscreen, minimize, focus, cursor, and
Steam's injected overlay. Do not add a visible Electron window beneath it and
do not turn the Steam surface into a popup/topmost/`keepAbove` companion. Keep
the same host for its full lifetime.

Electron 43 exposes Linux offscreen frames as one-plane BGRA native pixmaps.
Pass the `nativePixmap`, `pixelFormat`, dimensions, and presentation rectangle
from `paint` to `session.updateSharedTexture(...)`, and release Electron's
texture in `finally`. Steam Bridge imports the dma-buf through XCB DRI3 and
`GLX_EXT_texture_from_pixmap`, copies it into a retained GL texture, and keeps
presenting that texture while Steam pauses Electron paint. A native-Wayland
desktop still needs an Xwayland `DISPLAY` because Steam hooks the GLX host.
The importer reads `GLX_Y_INVERTED_EXT` from the selected FBConfig and applies
that orientation only while copying the imported pixmap into the retained
texture. Consumers must not add a platform-wide vertical flip: CPU-uploaded
frames and the final host draw remain in their ordinary orientation.

`createElectronSteamOverlay(mainWindow)` remains available for managed
browser/dialog presentation genuinely attached to an existing Linux window.
Do not use that two-surface controller as a fallback for a game host. Popup
companions, `keepAbove`, resize-time recreate/remap, nested-child GLX, direct
Electron desktop GL/Vulkan, and EGLImage-to-GLX import are closed game-host
paths.

Steam can report the Linux overlay as enabled just before its injected helper
is safe to call on a freshly launched game. The managed Wayland/Xwayland path
therefore applies a 3000 ms cold-start activation guard. `open*IfAvailable()`
returns `null` during that guard, while `open*AndWait()` waits through it;
the wait reserves the managed open against duplicates but leaves the host
transparent, input-empty, and idle at zero FPS until readiness is proven.
snapshots expose `activationWarmupMs`, `activationWarmupRemainingMs`, and
`activationWarmupReady` under `electronOverlay`. Create the managed controller
with the game window, reuse it, and prefer the wait helpers for user-triggered
Store, browser, and checkout flows. `activationWarmupMs` is configurable when
platform evidence requires a different value.

For an application-owned checkout operation, reserve readiness on the existing
native session before starting application or backend work:

```ts
const checkoutLease = await session.acquireCheckoutReservation({
  timeoutMs: 15_000,
  leaseTimeoutMs: 35_000
});

try {
  await startApplicationCheckout();
} finally {
  checkoutLease.release();
}
```

The readiness wait keeps that same native session surface presenting until
Steam passes a fresh positive `IsOverlayEnabled` check and the session's
activation warmup. The 35-second hard lease starts when readiness is confirmed,
not when acquisition begins. Acquiring a reservation does not create or replace
a popup, presenter, or window, and does not open checkout UI. Only one pending
or ready reservation can exist on that native session;
`getCheckoutReservationStatus()` is diagnostic, not a race-free substitute for
acquisition. A stale, released, or expired handle cannot release a later
reservation.

Keep the returned handle in Electron's main process; expose only an opaque owner
token over IPC when a renderer initiates checkout. `release()` and
`disconnect()` are idempotent aliases. An abort signal releases either a pending
or acquired reservation, `leaseTimeoutMs` releases an acquired reservation at
expiry, and `session.close()` clears both states. Before readiness, abort,
timeout, and session close reject with `SteamOverlayWaitAbortedError`,
`SteamOverlayWaitTimeoutError`, and `SteamOverlayWaitClosedError`, respectively,
without running application work. For a single-scope operation,
`session.withCheckoutPrepared(operation, options)` performs the same acquisition
and releases on synchronous return or throw and asynchronous resolve or reject.
Pass the signal to the application operation too when that work must itself be
cancelled. The main-process owner must also release its lease on backend response
or send failure, request timeout, renderer navigation or crash, and application
quit; shutting down the host should close the session.

The application owns its size and refresh policy. `1280x720` client pixels with
a `640x480` minimum is a safe desktop default; Steam Bridge applies those
constraints to the same native application host and follows the current display
cadence. It does not force an aspect ratio on desktop windows.

Game Mode is a different presentation contract. Gamescope/SteamUI presents
compositor-native surfaces such as Store, while the current managed web control
does not activate there. Current qualification proves managed presenter
readiness plus native Store activation, close, and focus return; it does not
claim parity with Desktop's browser/dialog matrix. If a game exposes both
lanes, use `client.utils.isSteamInBigPictureMode()` (and, when useful,
`isSteamRunningOnSteamDeck()`) to select a compositor-native Steam action in
Game Mode rather than retrying a non-activating managed web route.

For KWin troubleshooting, `steam-bridge/electron` exports
`getKWinWaylandOverlayHostSyncStatus()`. Ordinary applications do not need to
call or install the script themselves.

Close Chromium DevTools before validating Steam overlay behavior. DevTools can
change Chromium surface activity and timing; it is not a supported way to make
the Steam surface repaint, and results collected with it open are not treated as
release evidence.

For live qualification, keep only one Steam client signed in and running at a
time. Close Steam on other platforms before collecting evidence from the current
machine; cross-machine client ownership drift is an environment failure, not
package proof.

### macOS managed window states

The application owns macOS window transitions. Reuse one managed overlay
controller while the `BrowserWindow` moves through restored, maximized,
minimized, and fullscreen states; Steam Bridge follows the content bounds and
treats either Electron native fullscreen or simple fullscreen as fullscreen
geometry. Native Spaces fullscreen can depend on the current interactive
session and did not enter reliably for the Steam-launched qualification app;
`setSimpleFullScreen(true)` is the proved fallback when an application does not
need a separate macOS Space. Do not have Steam Bridge force that product choice.

Retina coordinates remain in Electron display-independent pixels while the
native Metal host uses the corresponding physical backing scale. Do not add a
process-wide Chromium scale override to compensate for the overlay. macOS also
keeps Steam's needs-present poll disabled because current Steam clients crash in
that path; managed presentation and lifecycle callbacks require no app polling
loop.

### Windows standalone overlay readiness

Initialize Steam during main-process bootstrap, before creating a
`BrowserWindow` or otherwise causing Electron to create its graphics device.
Register Steam callbacks at the same time, then create the standalone native
host and its offscreen renderer after `app.whenReady()`. This ordering gives
Steam's overlay hook the process and graphics-device lifecycle that Valve
documents. Do not create a normal visible Electron game window and attach a
second presenter to it: the Windows attached entrypoints return an explicit
unsupported error before closing or creating any surface.

Windows release proof is candidate-bound to an actual standalone game
consumer. It requires a normal non-linked install whose addon and Steam DLL
hashes match the audited candidate, real-game logs with standalone/no-parent
diagnostics, ordinary Steam active/inactive callbacks, resize/minimize/
fullscreen transitions, frame pacing within 95% of the display target, and
zero device loss, latency timeout, slow-copy, stderr, or crash signals. A
valid pacing result requires median paint and native-present FPS from at least
three ordinary-game samples, plus median native-present FPS from at least three
Steam-overlay-active samples, not one best frame. Overlay-phase Electron paint
FPS is retained in the receipt but may be zero when Steam owns the visible
frame. A manual visual checklist covers chrome, menus, title drag, minimum size,
alignment, corners, cursor behavior, focus return, and flicker. The retired
attached matrix, task wrapper, and normal matrix summarizer entrypoints
intentionally fail and cannot be used as release evidence.

On Windows, use standalone game-host mode: one visible top-level native D3D
window with Electron rendered offscreen into it. Attached Windows presentation
is not a production path. The real `WS_CHILD` experiment fixed geometry but
Steam drew no overlay pixels; `popup-layered`, the unparented overlapped
comparison, and `owned-popup` rendered Steam but failed chrome, DPI, movement,
resize, focus, clipping, and lifecycle behavior. Attached mode must fail clearly
and must never fall back from a child to a popup.
Accordingly, do not pass `nativeWindowHandle` or an Electron-following
`getBounds` callback on Windows. The standalone host owns its native position
and size. Raw attachment, `startNativeOverlaySession({ nativeWindowHandle })`,
`attachPresenter({ nativeWindowHandle })`, and the default attached mode of
`createElectronSteamOverlay(...)` all reject before claiming or mutating the
native surface. An earlier standalone session therefore remains intact.

The standalone host reports minimized `windowChanged` events and retains its
real D3D client size instead of resizing to Windows' synthetic iconic `1x1`
surface. Offscreen Electron consumers should keep their last real viewport and
throttle rendering until the corresponding restore event.

The Linux/macOS managed overlay also prepares passive Steam notifications, including
achievement progress and unlock toasts. The presenter stays transparent,
click-through, and idle until Steam requests a frame, then parks again without
an overlay-activation callback. Applications do not need a separate polling or
repaint loop. When a development tool clears and immediately re-awards an
achievement, wait for `client.stats.onUserStatsStored(...)` before the next
mutation; `store()` is accepted synchronously, but Steam confirms the state
change asynchronously. `client.achievement.onStored(...)` reports the later
progress or unlock notification update.

`overlay.snapshot().lastError` reports an unrecovered presenter fault. A
transient Electron frame-capture failure is retried and cleared after a later
capture succeeds; a terminal presenter failure remains available with
`closeReason: "error"` for diagnostics.

### Windows game-host mode

Steam renders into a top-level native swap chain on Windows. A Chromium
offscreen surface or a Win32 child window is not, by itself, a Steam overlay
presentation target. Games that need native title-bar behavior and continuous
game rendering while Steam is open can use `startNativeOverlaySession()` as a
standalone D3D11 host and render their hidden Electron game window with
offscreen shared textures.

Electron 42 and newer default Windows offscreen rendering to a scale factor of
`1`, even on a scaled display. Live WebGL content can turn black after resize in
that configuration. Capture the launch display scale once, apply it to the
hidden renderer, and keep that renderer scale stable while the native presenter
handles later monitor DPI changes:

```ts
const offscreenScaleFactor = Math.max(
  0.1,
  screen.getPrimaryDisplay().scaleFactor || 1
);

const gameWindow = new BrowserWindow({
  show: false,
  webPreferences: {
    offscreen: {
      useSharedTexture: true,
      sharedTexturePixelFormat: "argb",
      deviceScaleFactor: offscreenScaleFactor
    }
  }
});
```

For each frame paint event, pass the frame texture's
`textureInfo.handle.ntHandle`, coded width and height, and
`textureInfo.contentRect` (or the paint event's dirty rectangle) to
`session.updateSharedTexture()`. Chromium can allocate a coded texture one
logical pixel larger than the application viewport. When it does, pass a
`presentationRect` for the exact viewport in physical pixels; Steam Bridge crops
that region before fitting it to the native client. If omitted, the full coded
texture is presented for backward compatibility.

```ts
session.updateSharedTexture({
  handle: textureInfo.handle.ntHandle,
  width: textureInfo.codedSize.width,
  height: textureInfo.codedSize.height,
  contentRect: textureInfo.contentRect,
  presentationRect: {
    x: 0,
    y: 0,
    width: Math.min(
      textureInfo.codedSize.width,
      Math.round(viewportWidth * offscreenScaleFactor)
    ),
    height: Math.min(
      textureInfo.codedSize.height,
      Math.round(viewportHeight * offscreenScaleFactor)
    )
  }
});
```

Electron only guarantees that the update region was populated, so Steam Bridge
copies it into a retained bridge-owned texture without erasing unchanged pixels.
The call uses a bounded GPU query wait and fails instead of hanging if the copy
does not complete; release Electron's texture in a `finally` block after it
returns. Steam Bridge then selects the matching high-performance DXGI adapter,
crops the explicit presentation region, preserves that region's aspect ratio,
and presents with a two-buffer flip-sequential swap chain.
`updateFrame()` remains available as a BGRA CPU fallback.

Set `frameRate` to the active display's refresh rate and update it with
`session.setFrameRate(...)` when the native host moves to another monitor. The
Windows standalone host uses a DXGI frame-latency waitable swap chain as its
presentation boundary and submits tear-free frames with `Present(1)`. Waiting
on DXGI before each frame avoids relying on JavaScript timer precision while
still following the active display's refresh cadence.
New CPU frames and shared textures are marked dirty and pump at least once
immediately, including when `continuousPresent` is `false`; the session timer
remains the retained-frame and Steam-overlay fallback. Set
`continuousPresent: true` for game-streaming or desktop-capture hosts that must
keep exposing a retained frame while the Electron source is static. It is
`false` by default. DXGI gates continuous Windows presentation to the display
instead of relying on millisecond timer precision.

Steam can hook both the hidden Electron offscreen surface and the visible
native host when they live in the same Windows process. If the offscreen paint
already contains Steam UI, forwarding it while the host hook is also active
composites the overlay twice; different source and host sizes make the duplicate
obvious. Track `onGameOverlayActivated(...)` in this topology. While it reports
active, release incoming Electron paint textures without forwarding them so the
session retains its last clean game frame and Steam composites only into the
visible host. When it reports inactive, invalidate the offscreen
`webContents` once to resume fresh game frames.

```ts
const session = steamworks.overlay.startNativeOverlaySession({
  clientWidth: 1280,
  clientHeight: 720,
  minClientWidth: 640,
  minClientHeight: 480,
  minimumMenuScale: 1.25,
  frameRate: 60,
  continuousPresent: true,
  menu: [
    {
      label: "&File",
      items: [{ label: "E&xit", commandId: 1 }]
    }
  ],
  onInputEvent(event) {
    if (event.kind === "menuCommand" && event.commandId === 1) {
      app.quit();
      return;
    }
    // Forward other mapped input to gameWindow.webContents.
  }
});

function applyDisplayRate(displayFrequency: number | undefined) {
  const frameRate = Math.max(1, Math.round(displayFrequency || 60));
  gameWindow.webContents.setFrameRate(frameRate);
  session.setFrameRate(frameRate);
}
```

`clientWidth` and `clientHeight` are logical pixels. On Windows, Steam Bridge
scales them to the primary display's DPI at creation and clamps the restored
window to that display's usable work area. Moving the host between monitors
preserves its logical size through the normal per-monitor-DPI transition.
Resolution and work-area changes also reconcile the existing standalone host:
an off-screen or oversized window is centered and clamped without replacing the
host or forgetting its requested logical client size, then expands back when
the work area can contain it. The current state is exposed as
`nativeHostDiagnostics.displayWorkAreaClamped`.
When both `minClientWidth` and `minClientHeight` are provided, the standalone
Windows host enforces that minimum logical client size during edge and corner
resize operations and clamps a smaller initial client request to that minimum.
The two minimum dimensions must be provided together.

Every native host input event includes `capturedAtMs` plus `shift`, `control`,
and `alt` state captured at the Win32 message boundary. Consumers should use
those fields instead of reconstructing modifier state at JavaScript dispatch
time. If input is correlated with Steam activation callbacks, compare callback
transitions with `capturedAtMs`; a callback can arrive first while the Node
event loop is busy.

The optional `menu` tree creates a real Windows menu bar on a standalone host.
Leaf `commandId` values are returned as `menuCommand` input events. The menu is
removed in fullscreen, restored when returning to windowed mode, and changing
it preserves the existing client size. By default Windows draws the menu at the
monitor's configured scale. A consumer may opt into `minimumMenuScale` (from
`1` through `4`) when its product design needs a larger menu at low Windows
scale settings. The floor affects only that menu: it does not override Chromium,
the native title bar, the game client area, or the user's system settings, and a
monitor with a higher effective scale still wins. The scaled path keeps the
native `HMENU`, command routing, keyboard mnemonics, system colors, and Microsoft
Active Accessibility metadata.

Steam Bridge owns the generic per-monitor-DPI mechanics and exact logical-to-
physical client sizing. The application owns policy: its logical game size,
minimum client size, and whether to request a menu scale floor. Do not use a
process-wide Chromium `force-device-scale-factor` switch to compensate for one
piece of native chrome; it also changes browser UI and content and creates two
competing coordinate systems.

The standalone host owns window movement, resize, maximize, minimize,
fullscreen, focus visibility, rounded-corner clipping, cursor state, and the
Steam presentation surface. The consumer remains responsible for translating
`onInputEvent` coordinates through the same aspect-fit transform and forwarding
them to its offscreen `webContents`. Mouse capture-loss and focus-loss events
must release any pressed input state. This is the required Windows production
path. See the native session types and the
[Electron example guide](examples/electron-basic/README.md) before adopting it.

Steam checkout cancellation can create a separate top-level `Steam Dialog`
instead of drawing the confirmation inside the hooked swap chain. While a
standalone host's Steam overlay is active, Steam Bridge narrowly recognizes a
new visible, unowned `Steam Dialog`/`SDL_app` window from
`steamwebhelper.exe`, makes it an owned popup of the game host, and keeps it
centered with the host. Pre-existing Steam dialogs and managed attached
presenters are excluded, and the original owner and rectangle are restored when
the overlay or host ends. `session.snapshot().nativeHostDiagnostics.steamDialog`
reports the baseline and adoption state for troubleshooting.

If the game draws its own cursor, call `session.setCursorHidden(true)` while
gameplay is active. The host suppresses the Windows cursor across both the
rendered frame and its aspect-fit letterbox area, reapplies suppression after
Windows cursor-reset messages, and restores the native cursor when the host
loses focus, becomes hidden, or the session closes.

## Steam Web API

Set `STEAM_WEB_API_KEY` for endpoints that require a publisher key, or provide
an explicit key when creating or calling the client:

```ts
import steamworks from "steam-bridge";

const players = await steamworks.webApi.userStats
  .getNumberOfCurrentPlayers(480);

const news = await steamworks.webApi.news.getNewsForApp({
  appId: 480,
  count: 5
});

console.log({ players, news });
```

Keep publisher keys and private app, product, account, and transaction data out
of source control and logs.

## Packaging notes

- The npm package already contains the supported native addons and Valve
  redistributables. `STEAMWORKS_SDK_PATH` is only needed when building the
  native addon from source.
- Electron packagers must keep the native addon and its Steam runtime libraries
  outside ASAR. The repository's smoke app demonstrates the supported package
  shape.
- Linux Electron packages should call
  `prepareLinuxSteamAppAfterPack(context)` from
  `steam-bridge/electron-builder`. The helper writes a process-start launcher
  with the paired `--no-zygote --no-sandbox` switches required before
  Chromium's first zygote. Linux game-host mode uses one native application
  window and a hidden offscreen Electron renderer; the application still owns
  size, fullscreen, cursor, input, and refresh policy.
- Linux source builds create a link-only encrypted-ticket import stub whose
  SONAME is `libsdkencryptedappticket.so`. The published addon therefore keeps
  a portable runtime dependency without requiring `patchelf`; packages still
  ship Valve's real redistributable beside the addon.
- macOS applications must be packaged and run as native Apple Silicon apps.
- Windows application signing is the responsibility of the final application
  distributor. It is not required to install or publish this npm package.
- Steam Deck uses the Linux x64 package in both Game Mode and Desktop Mode.

For complete packaging and platform procedures, use the
[Electron example guide](examples/electron-basic/README.md#packaged-smoke-builds)
and the [npm package reference](packages/steam-bridge/README.md).

## Repository development

Building the native addon from source requires Node.js 22.13 or newer, Rust
stable, and the Steamworks SDK through the normal `steamworks-sys` setup or
`STEAMWORKS_SDK_PATH`.

```sh
npm install
npm run native:build
npm test
```

`native:build` links the newest matching Cargo artifact from either the target
release directory or its `deps` directory, which keeps source-linked consumer
testing from accidentally loading an older addon.

The TypeScript build minifies ordinary distributable JavaScript with source
maps. `kwin.js` intentionally remains in TypeScript's emitted form because it
serializes selected functions into KWin's separate JavaScript runtime;
top-level mangling would break that code-generation boundary. Declarations and
exports are unchanged.

The normal repository checks are documented in [Contributing](CONTRIBUTING.md).

## Documentation

- [npm package reference](packages/steam-bridge/README.md)
- [Electron example and platform smoke guide](examples/electron-basic/README.md)
- [Steam API coverage](docs/steam-api-coverage.md)
- [Contribution and release policy](CONTRIBUTING.md)
- [Cross-platform overlay status](docs/research/cross-platform-overlay-status.md)

## License

[MIT](LICENSE)
