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

Close Chromium DevTools before validating Steam overlay behavior. DevTools can
change Chromium surface activity and timing; it is not a supported way to make
the Steam surface repaint.

The repository's Windows release matrix is fail-closed around synthetic close
input. An exact pre-dispatch screenshot must prove the foreground native host,
contained modal geometry, a DPI-scaled Steam close glyph, the dimmed backdrop,
and loaded content. Coordinates are never reused across frames. Friends/chat's
dark navigation layout is accepted only when the close glyph itself passes the
direct pixel score.

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
`textureInfo.handle.ntHandle`, coded width and height, and
`textureInfo.contentRect` (or the paint event's dirty rectangle) to
`session.updateSharedTexture()`. Electron only guarantees that update region
was populated, so Steam Bridge copies it into a retained bridge-owned texture
without erasing unchanged pixels. The call uses a bounded GPU query wait and
fails instead of hanging if the copy does not complete; release Electron's
texture in a `finally` block after it returns. Steam Bridge
then uses the matching high-performance DXGI adapter, aspect-fits the source,
and presents through a two-buffer flip-sequential swap chain.
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
When both `minClientWidth` and `minClientHeight` are provided, the standalone
Windows host enforces that minimum logical client size during edge and corner
resize operations and clamps a smaller initial client request to that minimum.
The two minimum dimensions must be provided together.

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

The native host owns ordinary Windows movement, resize, maximize, minimize,
fullscreen, focus visibility, rounded-corner clipping, cursor state, and the
Steam presentation surface. The consumer must map `onInputEvent` coordinates
through the same aspect-fit transform and forward them to the offscreen
`webContents`; release pressed input on capture or focus loss. This is an
advanced path. Prefer `createElectronSteamOverlay()` unless the application
needs a standalone game host.

Steam checkout cancellation can create a separate top-level `Steam Dialog`
instead of drawing the confirmation inside the hooked swap chain. While a
standalone host's Steam overlay is active, Steam Bridge narrowly recognizes a
new visible, unowned `Steam Dialog`/`SDL_app` window from
`steamwebhelper.exe`, makes it an owned popup of the game host, and keeps it
centered with the host. Pre-existing Steam dialogs and managed attached
presenters are excluded, and the original owner and rectangle are restored when
the overlay or host ends. `session.snapshot().nativeHostDiagnostics.steamDialog`
reports the baseline and adoption state for troubleshooting.

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

`native:build` links the newest matching Cargo artifact from either the target
release directory or its `deps` directory, which keeps source-linked consumer
testing from accidentally loading an older addon.

See [Contributing](https://github.com/jstroh/steam-bridge/blob/main/CONTRIBUTING.md)
for the full development and release checks.

## Documentation

- [Project overview](https://github.com/jstroh/steam-bridge#readme)
- [Electron example and platform guide](https://github.com/jstroh/steam-bridge/blob/main/examples/electron-basic/README.md)
- [Steam API coverage](https://github.com/jstroh/steam-bridge/blob/main/docs/steam-api-coverage.md)
- [Contribution guide](https://github.com/jstroh/steam-bridge/blob/main/CONTRIBUTING.md)

## License

[MIT](https://github.com/jstroh/steam-bridge/blob/main/LICENSE)
