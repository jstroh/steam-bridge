# Steam Bridge

[![npm](https://img.shields.io/npm/v/steam-bridge)](https://www.npmjs.com/package/steam-bridge)
[![CI](https://github.com/jstroh/steam-bridge/actions/workflows/ci.yml/badge.svg)](https://github.com/jstroh/steam-bridge/actions/workflows/ci.yml)
[![license](https://img.shields.io/npm/l/steam-bridge)](LICENSE)

Steamworks for Electron and Node, with a typed JavaScript API and prebuilt
native binaries for Windows, Linux/Steam Deck, and Apple Silicon macOS.

Steam Bridge handles Steam API startup, callbacks, native library loading,
inventory, achievements, cloud, networking, workshop, game servers, overlays,
and the Steam Web API. Applications install one npm package; they do not need a
local Steamworks SDK.

```sh
npm install steam-bridge
```

## Quick start

```ts
import steamworks from "steam-bridge";

const client = steamworks.init(480);

console.log(client.localplayer.getSteamId().steamId64);
console.log(client.apps.isSubscribed());

client.callback.register("GameOverlayActivated", ({ active }) => {
  console.log("Steam overlay active:", active);
});

client.overlay.activateToStore(480, client.overlay.StoreFlag.None);
```

App ID `480` is Valve's SpaceWar test application. Use your own Steam app ID for
production and for app-specific inventory or commerce. When running outside
Steam during development, put `steam_appid.txt` beside the executable or in its
working directory.

Steam Bridge owns Valve's manual callback dispatcher. Client subscriptions use
`client.callback.register(...)`; game-server subscriptions use
`client.gameServer.onCallback(...)`, and the two domains never receive each
other's events. Call `runCallbacks()` when using a custom pump. The legacy-named
`runLegacyCallbacks()` remains only as a deprecated alias to that same safe
manual pump. Do not combine Steam Bridge with raw `CCallbackBase` or
`CCallResult` registration; those registration methods reject because Valve
does not permit legacy and manual callback dispatch to be mixed.

Requirements:

- Node.js 18 or newer
- Electron 24 or newer for Electron applications
- a running Steam client

## Platform Targets

| Platform | Native target |
| --- | --- |
| Windows x64 | `x86_64-pc-windows-msvc` |
| Linux x64 and Steam Deck | `x86_64-unknown-linux-gnu` |
| macOS Apple Silicon | `aarch64-apple-darwin` |

### macOS Apple Silicon Only

Build and run macOS applications only on native Apple Silicon. Intel and
universal macOS builds are not supported.
Do not package, launch, or verify macOS smoke apps through Rosetta.

## Choose the right Electron architecture

Steam does not hook every kind of Electron surface the same way. Pick the
platform model first and keep it for the window's lifetime.

| Platform | Supported game-window model |
| --- | --- |
| Windows | One visible standalone Steam Bridge D3D11 application host, fed by one hidden Electron offscreen renderer |
| Linux / Steam Deck Desktop | One visible Steam Bridge X11/GLX application host, fed by one hidden Electron offscreen renderer |
| Steam Deck Game Mode | The same single Linux application host, with Gamescope-native Steam routes |
| Apple Silicon macOS | One Metal child window attached to the Electron parent window |

These are product rules, not implementation suggestions:

- Keep exactly one visible game host.
- Never replace it with a popup, topmost companion, `keepAbove` window, or a
  recreate-on-resize surface.
- Windows attached/child presenters deliberately fail closed. The supported
  Windows host is a standalone top-level D3D window.
- Linux requires an Xwayland `DISPLAY` even when Electron uses native Wayland,
  because Steam hooks the GLX application host.
- The macOS presenter remains an AppKit child of the Electron window. Do not
  detach it or fall back to an independent popup.
- In macOS fullscreen, that same child keeps a transparent Metal background so
  Steam's translucent overlay pixels composite over the live game. Do not make
  the full-frame child opaque; windowed opacity and corner clipping are restored
  with the titled parent.

The detailed integration contracts and frame-forwarding examples live in the
[npm package reference](packages/steam-bridge/README.md).

## Managed overlays on Linux and macOS

Configure Electron before readiness, create one controller for the main window,
and reuse it:

```ts
import { app, BrowserWindow } from "electron";
import steamworks from "steam-bridge";

steamworks.electronConfigureSteamOverlay();
const client = steamworks.init(480);

app.whenReady().then(async () => {
  const gameWindow = new BrowserWindow({ width: 1280, height: 720 });
  const overlay = client.overlay.createElectronSteamOverlay(gameWindow);

  const result = await overlay.openStoreAndWaitIfAvailable({ appId: 480 });
  if (!result) console.warn("Steam overlay is not ready");
});
```

Wait helpers resolve after the Steam surface closes and focus returns to the
application. The controller supports Store, browser, Friends/chat, profiles,
community, achievements, stats, and checkout routes.

Windows games should not call `createElectronSteamOverlay()` for their game
window. Use the standalone game host below.

## Standalone game host on Windows and Linux

Use a hidden Electron offscreen renderer to feed the one native application
host:

```ts
const session = client.overlay.startNativeOverlaySession({
  title: "My Game",
  clientWidth: 1280,
  clientHeight: 720,
  minClientWidth: 640,
  minClientHeight: 480,
  frameRate: 60,
  useLinuxApplicationHost: process.platform === "linux",
  onInputEvent: forwardInputToOffscreenRenderer,
});
```

Forward Electron's offscreen shared textures with
`session.updateSharedTexture(...)` and release each Electron texture in a
`finally` block. The native host owns chrome, movement, resize, maximize,
minimize, fullscreen, focus, cursor, input, rounded corners, and the surface
Steam hooks.

The application still owns policy:

- `1280x720` with a `640x480` minimum is a safe desktop default.
- Game Mode may use the full `1280x800` Deck surface and omit desktop menus.
- Set both the Electron renderer and `session.setFrameRate(...)` to the current
  display rate.
- Preserve aspect ratio in the renderer; Steam Bridge does not force one.

Steam Bridge owns the platform mechanics:

- Windows logical sizes follow per-monitor DPI. Resolution and work-area
  changes clamp the same host without forgetting its requested size, and the
  window expands again when space returns.
- The Windows D3D11 presenter synchronizes to DXGI rather than JavaScript timer
  precision and remains paced while Steam owns the visible overlay frame.
- Linux imports Electron BGRA dma-bufs through DRI3/GLX, honors the selected
  FBConfig's `GLX_Y_INVERTED_EXT` orientation, and retains the last clean game
  frame while Steam pauses Electron paint.

See the [Electron example](examples/electron-basic/README.md) for complete
offscreen rendering, input mapping, checkout reservations, and packaging.

## Steam Deck Game Mode

Desktop Mode and Game Mode share the Linux package but not every Steam UI
route. Gamescope presents native surfaces such as Store; a managed desktop web
route may not activate there.

Use `client.utils.isSteamRunningOnSteamDeck()` and
`client.utils.isSteamInBigPictureMode()` to choose Game Mode policy. Do not retry
a desktop web route indefinitely or create a second window as a fallback.

## Packaging Electron apps

The npm package includes the supported native addons and Valve runtime
redistributables. With electron-builder, prepare Linux and macOS packages in
`afterPack`:

```js
const {
  prepareLinuxSteamAppAfterPack,
  prepareMacosSteamAppAfterPack,
} = require("steam-bridge/electron-builder");

exports.afterPack = async (context) => {
  prepareLinuxSteamAppAfterPack(context);
  prepareMacosSteamAppAfterPack(context);
};
```

The Linux helper installs the Steam-safe launcher before Chromium starts its
zygote. The macOS helper installs the native launcher and overlay entitlements;
use your normal signing and notarization pipeline afterward. Windows
application signing remains the application's responsibility.

## Before live overlay QA

- Run an exact stable Electron release. Never qualify an alpha, beta, or
  nightly build.
- Close Chromium DevTools.
- Run Steam on only one test machine at a time. Force-close Steam and its
  helpers on every other Windows, macOS, Linux, and Steam Deck machine first.
- Test the actual Steam-launched game, not only a synthetic window.
- Cover ordinary, high-refresh, low-resolution, DPI/scale, drag, resize,
  minimum size, maximize, minimize, focus, fullscreen, overlay, and cleanup
  transitions.
- Never complete a purchase or subscription during QA.

The repository keeps platform-specific exhaustive procedures and failure
history under [`docs/research`](docs/research). Closed paths are documented so
future work does not repeat popup/child/window experiments that already failed.

## API and documentation

- [npm package reference](packages/steam-bridge/README.md)
- [Steam API coverage](docs/steam-api-coverage.md)
- [Electron example and platform guide](examples/electron-basic/README.md)
- [Research, architecture, and QA history](docs/research)
- [Contributing and release process](CONTRIBUTING.md)

## Repository development

Repository work requires Node.js 22.13 or newer, Rust stable, and the Steamworks
SDK through the normal `steamworks-sys` setup or `STEAMWORKS_SDK_PATH`.

```sh
npm install
npm run native:build
npm test
npm run package:smoke
```

## License

[MIT](LICENSE)
