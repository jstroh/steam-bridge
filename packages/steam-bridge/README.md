# Steam Bridge

[![npm](https://img.shields.io/npm/v/steam-bridge)](https://www.npmjs.com/package/steam-bridge)
[![CI](https://github.com/jstroh/steam-bridge/actions/workflows/ci.yml/badge.svg)](https://github.com/jstroh/steam-bridge/actions/workflows/ci.yml)
[![license](https://img.shields.io/npm/l/steam-bridge)](https://github.com/jstroh/steam-bridge/blob/main/LICENSE)

Native Steamworks for Electron and Node, with a TypeScript API and a Rust
`napi-rs` core.

Steam Bridge handles Steam API initialization, callbacks, native library
loading, and managed Electron overlays. The npm package includes prebuilt
native addons and Valve runtime redistributables for every supported platform,
so consumers do not need to download the Steamworks SDK.

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

## What is included

- Typed Steamworks APIs for auth, achievements, stats, cloud, input,
  inventory, workshop, networking, matchmaking, game servers, and more.
- A compatibility-style grouped client for familiar JavaScript call patterns.
- Managed Electron overlays for store, web, checkout, Friends/chat, profiles,
  community, achievements, stats, and other Steam surfaces.
- A Steam Web API client for public and publisher endpoints.
- Prebuilt native addons and Valve Steam runtime libraries.

See the [Steam API coverage](https://github.com/jstroh/steam-bridge/blob/main/docs/steam-api-coverage.md)
for the complete implemented surface and known gaps.

## Platform Targets

| Platform | Target |
| --- | --- |
| Windows x64 | `x86_64-pc-windows-msvc` |
| Linux x64 and Steam Deck | `x86_64-unknown-linux-gnu` |
| macOS Apple Silicon | `aarch64-apple-darwin` |

### macOS Apple Silicon Only

Intel macOS, Rosetta, and universal macOS builds are not supported. Build and
run macOS test apps only on native `darwin/arm64` Apple Silicon hosts.
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

Wait helpers resolve after the Steam overlay closes and control returns to the
application. Steam Bridge supports one managed native presenter per process,
controlled from Electron's main thread. Raw activation helpers remain
available for diagnostics, but Electron product UI should use the managed
overlay path.

On Windows, a managed presenter is non-activating and click-through while it
is parked. When Steam opens an interactive surface, the presenter becomes
focusable inside the Electron content bounds; after Steam closes, it returns
to the parked state and restores application focus. This keeps the ordinary
title bar, menus, minimize, maximize, window drag, and rounded-corner behavior
owned by the Electron window.

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
offscreen surface or Win32 child window is not a complete Steam presentation
target. Games that need native title-bar behavior and continuous rendering
while Steam is open can use `startNativeOverlaySession()` as a standalone D3D11
host and render the game in a hidden Electron window created with:

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

For every frame paint event, pass the frame texture's
`textureInfo.handle.ntHandle`, coded width, and coded height to
`session.updateSharedTexture()`, then release Electron's texture immediately
in a `finally` block. Steam Bridge copies the pooled texture before the call
returns, uses the matching high-performance DXGI adapter, aspect-fits the
source, and presents through a two-buffer flip-discard swap chain.
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
  clientWidth: 1024,
  clientHeight: 768,
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

The native host owns ordinary Windows movement, resize, maximize, minimize,
fullscreen, focus visibility, rounded-corner clipping, cursor state, and the
Steam presentation surface. The consumer must map `onInputEvent` coordinates
through the same aspect-fit transform and forward them to the offscreen
`webContents`; release pressed input on capture or focus loss. This is an
advanced path. Prefer `createElectronSteamOverlay()` unless the application
needs a standalone game host.

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

## Packaging

The published package includes:

| Platform | Native addon | Valve runtime libraries |
| --- | --- | --- |
| Windows x64 | `steam_bridge_native.win32-x64-msvc.node` | `steam_api64.dll`, `sdkencryptedappticket64.dll` |
| Linux x64 | `steam_bridge_native.linux-x64-gnu.node` | `libsteam_api.so`, `libsdkencryptedappticket.so` |
| macOS Apple Silicon | `steam_bridge_native.darwin-arm64.node` | `libsteam_api.dylib`, `libsdkencryptedappticket.dylib` |

`STEAMWORKS_SDK_PATH` is needed only when building the native addon from
source.

Electron packagers must keep the native addon and its matching Steam runtime
libraries outside ASAR. The repository's
[packaged Electron example](https://github.com/jstroh/steam-bridge/tree/main/examples/electron-basic)
demonstrates the supported layout.

Windows application signing belongs to the final application distributor. It
is not required to install or publish this package. Valve's runtime DLLs should
retain their upstream signatures.

Steam Deck uses the Linux x64 package in both Game Mode and Desktop Mode.

### macOS electron-builder helper

Steam overlays on macOS require the package's native launcher and Steam-compatible
entitlements. Add the provided helper to electron-builder's `afterPack` hook:

```js
const {
  prepareMacosSteamAppAfterPack
} = require("steam-bridge/electron-builder");

exports.afterPack = async (context) => {
  prepareMacosSteamAppAfterPack(context);
};
```

Use your normal Apple signing and notarization pipeline after preparation. The
helper rejects Intel, Rosetta, and universal targets.

For the complete packaging matrix and platform procedures, see the
[Electron example guide](https://github.com/jstroh/steam-bridge/blob/main/examples/electron-basic/README.md#packaged-smoke-builds).

## Command-line helpers

The package exposes focused tools used by advanced checkout and packaging
workflows:

- `steam-bridge-init-client-txn`
- `steam-bridge-prepare-macos-app`
- `steam-bridge-verify-macos-signing`
- `steam-bridge-validate-checkout-target`

Run a command with `--help` for its supported options. The full examples and
operational guidance live in the
[Electron example guide](https://github.com/jstroh/steam-bridge/blob/main/examples/electron-basic/README.md).

## Building from source

Repository development requires Node.js 22.13 or newer, Rust stable, and the
Steamworks SDK through the normal `steamworks-sys` setup or
`STEAMWORKS_SDK_PATH`.

```sh
npm install
npm run native:build
npm test
```

See [Contributing](https://github.com/jstroh/steam-bridge/blob/main/CONTRIBUTING.md)
for the full development and release checks.

## Documentation

- [Project overview](https://github.com/jstroh/steam-bridge#readme)
- [Electron example and platform guide](https://github.com/jstroh/steam-bridge/blob/main/examples/electron-basic/README.md)
- [Steam API coverage](https://github.com/jstroh/steam-bridge/blob/main/docs/steam-api-coverage.md)
- [Contribution guide](https://github.com/jstroh/steam-bridge/blob/main/CONTRIBUTING.md)

## License

[MIT](https://github.com/jstroh/steam-bridge/blob/main/LICENSE)
