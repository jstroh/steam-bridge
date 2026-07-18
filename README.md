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

Configure Electron before `app.ready`, then create one managed overlay for the
main game window and reuse it:

```ts
import { app, BrowserWindow } from "electron";
import steamworks from "steam-bridge";

steamworks.electronConfigureSteamOverlay();

app.whenReady().then(async () => {
  const mainWindow = new BrowserWindow({ width: 1280, height: 720 });
  const client = steamworks.init(480);
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
from Electron's main thread. Raw activation helpers remain available for
native diagnostics, but Electron applications should use the managed overlay
path for product UI.

Close Chromium DevTools before validating Steam overlay behavior. DevTools can
change Chromium surface activity and timing; it is not a supported way to make
the Steam surface repaint, and results collected with it open are not treated as
release evidence.

On Windows, a managed presenter is non-activating and click-through while it
is parked. When Steam opens an interactive surface, the presenter becomes
focusable inside the Electron content bounds; after Steam closes, it returns
to the parked state and restores application focus. This keeps the ordinary
title bar, menus, minimize, maximize, window drag, and rounded-corner behavior
owned by the Electron window. The interactive surface is an Electron-owned
popup (`owned-popup` in diagnostics); the release proof rejects the obsolete
standalone `popup-layered` identity.

The same managed overlay also prepares passive Steam notifications, including
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

Create the hidden renderer with:

```ts
const gameWindow = new BrowserWindow({
  show: false,
  webPreferences: {
    offscreen: {
      useSharedTexture: true,
      sharedTexturePixelFormat: "argb"
    }
  }
});
```

For each frame paint event, pass the frame texture's
`textureInfo.handle.ntHandle`, coded width, and coded height to
`session.updateSharedTexture()`, then release Electron's texture immediately
in a `finally` block. Steam Bridge copies the pooled texture before the call
returns, selects the matching high-performance DXGI adapter, preserves the
source aspect ratio, and presents with a two-buffer flip-discard swap chain.
`updateFrame()` remains available as a BGRA CPU fallback.

Set `frameRate` to the active display's refresh rate and update it with
`session.setFrameRate(...)` when the native host moves to another monitor. The
whole-millisecond session timer wakes just ahead of that cadence; Windows
`Present(1)` performs the vertical-blank synchronization. Set
`continuousPresent: true` for game-streaming or desktop-capture hosts that must
keep exposing a retained frame while the Electron source is static. It is
`false` by default, and in continuous mode the cadence timer is the sole
presentation driver so frame uploads cannot double-pump the swap chain.

```ts
const session = steamworks.overlay.startNativeOverlaySession({
  clientWidth: 1280,
  clientHeight: 720,
  frameRate: 60,
  continuousPresent: true,
  onInputEvent(event) {
    // Forward mapped input to gameWindow.webContents.
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

The standalone host owns window movement, resize, maximize, minimize,
fullscreen, focus visibility, rounded-corner clipping, cursor state, and the
Steam presentation surface. The consumer remains responsible for translating
`onInputEvent` coordinates through the same aspect-fit transform and forwarding
them to its offscreen `webContents`. Mouse capture-loss and focus-loss events
must release any pressed input state. See the native session types and the
[Electron example guide](examples/electron-basic/README.md) before adopting
this advanced path.

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

The normal repository checks are documented in [Contributing](CONTRIBUTING.md).

## Documentation

- [npm package reference](packages/steam-bridge/README.md)
- [Electron example and platform smoke guide](examples/electron-basic/README.md)
- [Steam API coverage](docs/steam-api-coverage.md)
- [Contribution and release policy](CONTRIBUTING.md)
- [Cross-platform overlay status](docs/research/cross-platform-overlay-status.md)

## License

[MIT](LICENSE)
