# Steam Bridge

[![npm](https://img.shields.io/npm/v/steam-bridge)](https://www.npmjs.com/package/steam-bridge)
[![CI](https://github.com/jstroh/steam-bridge/actions/workflows/ci.yml/badge.svg)](https://github.com/jstroh/steam-bridge/actions/workflows/ci.yml)
[![license](https://img.shields.io/npm/l/steam-bridge)](LICENSE)

Steamworks for Electron and Node, with a typed JavaScript API and prebuilt
native binaries for Windows, Linux/Steam Deck, and Apple Silicon macOS.

```sh
npm install steam-bridge
```

Steam Bridge handles Steam initialization, callback dispatch, native library
loading, achievements, stats, cloud saves, inventory, input, networking,
matchmaking, Workshop/UGC, game servers, overlays, and the Steam Web API. A
normal package install includes the supported native addons and Valve runtime
libraries; application developers do not need a local Steamworks SDK.

## Start here

You need:

- Node.js 18 or newer;
- Electron 24 or newer for Electron applications;
- a running Steam client; and
- a Steam app ID that the current Steam account can run.

## Platform Targets

| Supported system | Native target |
| --- | --- |
| Windows x64 | `x86_64-pc-windows-msvc` |
| Linux x64 and Steam Deck | `x86_64-unknown-linux-gnu` |
| Apple Silicon macOS | `aarch64-apple-darwin` |

### macOS Apple Silicon Only

Intel macOS, Rosetta, universal macOS packages, Windows ARM, and Linux ARM are
not supported.
Do not package, launch, or verify macOS smoke apps through Rosetta.

Valve's SpaceWar App ID `480` is useful for generic smoke testing. Use your own
app ID for production and for app-specific inventory, achievements, or
commerce. When developing outside a Steam launch, put a `steam_appid.txt`
containing the app ID beside the executable or in its working directory.

## Five-minute client setup

```ts
import steamworks from "steam-bridge";

const client = steamworks.init(480);

console.log("Steam ID:", client.localplayer.getSteamId().steamId64);
console.log("Subscribed:", client.apps.isSubscribed());

client.callback.register("GameOverlayActivated", ({ active }) => {
  console.log("Steam overlay active:", active);
});

client.overlay.activateToStore(480, client.overlay.StoreFlag.None);
```

Steam Bridge owns Valve's manual callback dispatcher and starts its safe
callback pump for initialized clients. If your application uses a custom pump,
call `runCallbacks()`. Register client callbacks with
`client.callback.register(...)` and game-server callbacks with
`client.gameServer.onCallback(...)`; the two domains are isolated. Do not mix
Steam Bridge with raw `CCallbackBase` or `CCallResult` registration.

## Choose the correct Electron window model

Steam hooks platform surfaces differently. Choose the model before building
your window integration and keep the same native host for its lifetime.

| Use case | Supported model |
| --- | --- |
| Windows game window | One visible Steam Bridge D3D11 host fed by one hidden Electron offscreen renderer |
| Linux or Steam Deck live game window | One visible Steam Bridge X11/GLX application host fed by one hidden Electron offscreen renderer |
| macOS game window | One Metal child attached to the Electron parent window |
| Ordinary Linux/macOS Electron overlay routes | One managed controller attached to the existing Electron window |

The important rules are simple:

- Keep exactly one visible game host.
- Never turn the Steam surface into a popup, topmost companion, `keepAbove`
  window, or recreate-on-resize fallback.
- Windows attached/child presentation intentionally fails closed. Use the
  standalone D3D11 host.
- Linux still needs an Xwayland `DISPLAY` because Steam hooks the GLX host,
  even if Electron itself uses native Wayland.
- The macOS surface stays an AppKit child. In fullscreen it remains transparent
  so Steam's translucent pixels composite over the live game.
- Close Chromium DevTools during live Steam overlay testing.

### Managed routes on Linux and macOS

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

Wait helpers resolve after the Steam surface closes and focus returns. Store,
browser, Friends/chat, profile, community, achievement, statistics, and
checkout routes share the same controller.

### Standalone game host on Windows and Linux

Render Electron offscreen and forward its frames and mapped input to one native
application host:

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

The native host owns window chrome, movement, resize, maximize, minimize,
fullscreen, focus, cursor, rounded corners, input, DPI, and the surface Steam
hooks. The application owns its logical size, aspect-fit policy, menus, and
renderer frame rate. `1280x720` with a `640x480` minimum is a safe desktop
default; Steam Deck Game Mode may use the full `1280x800` display.

Set both Electron and the native session to the active display rate. Preserve
aspect ratio in the renderer—Steam Bridge deliberately does not force one.
The [Electron integration guide](examples/electron-basic/README.md) contains
the complete shared-texture, input-mapping, checkout-reservation, fullscreen,
and packaging implementation.

## Client code and server code

Keep publisher credentials out of Electron and browser processes.

| Import | Use it for |
| --- | --- |
| `steam-bridge` | Native Steam client/game-server APIs and public, keyless Web API calls |
| `steam-bridge/server` | Publisher-key Web API calls, MicroTxn operations, and encrypted-ticket decryption on a trusted Node.js server |
| `steam-bridge/electron-builder` | Linux and macOS packaging preparation |

```ts
import { createPublisherWebApiClient } from "steam-bridge/server";

const steamWebApi = createPublisherWebApiClient();
const transaction = await steamWebApi.microTxn.initClientTxn(request);
```

`createPublisherWebApiClient()` reads `STEAM_PUBLISHER_WEB_API_KEY`, with
`STEAM_WEB_API_KEY` retained as a server-only compatibility alias. Steam Bridge
sends keys in `x-webapi-key`, requires HTTPS, rejects credential-bearing
redirects, and keeps keys out of generated and returned URLs. Requests with
caller-provided headers receive the same HTTPS, no-redirect, and error-redaction
protections.

See the [Web API reference](packages/steam-bridge/README.md#steam-web-api) for
public, user-key, publisher-key, authentication-ticket, and encrypted-ticket
examples.

## Package Electron applications

The native addon and matching Valve runtime libraries must remain outside ASAR.
With electron-builder, prepare Linux and macOS packages in `afterPack`:

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

The Linux helper installs the Steam-safe launcher before Chromium creates its
zygote. The macOS helper installs the native launcher and Steam-compatible
entitlements; run your normal Apple signing and notarization pipeline after
it. Windows application signing remains the application distributor's
responsibility.

## Steam Deck Game Mode

Desktop Mode and Game Mode use the same Linux package but not identical Steam
UI routes. Gamescope can present compositor-native routes such as Store, while
a managed desktop web route may not activate.

Use `client.utils.isSteamRunningOnSteamDeck()` and
`client.utils.isSteamInBigPictureMode()` to choose Game Mode policy. Do not
retry a desktop route indefinitely or create a second window as a fallback.

## Troubleshooting checklist

| Symptom | Check first |
| --- | --- |
| Steam does not initialize | Steam is running, the account owns the app, the app ID is correct, and `steam_appid.txt` is in the actual working directory for non-Steam launches |
| Overlay never appears | The game was launched through Steam, initialization happened before graphics-device creation, DevTools is closed, and only one machine is running Steam for the account |
| Windows overlay is missing or covers the wrong window | Use the standalone D3D11 host; do not attach a popup or child to a visible Electron window |
| Linux overlay crashes at startup | Run the packaged executable prepared by `prepareLinuxSteamAppAfterPack()` and retain the Xwayland `DISPLAY` |
| macOS overlay loses alignment | Keep one attached child and reuse one controller through resize, focus, minimize, and fullscreen transitions |
| Native addon works unpackaged but not after packaging | Keep the addon and Valve libraries outside ASAR and verify the packaged target matches the current OS/architecture |
| Overlay is tiny, duplicated, or stale | Keep one visible host and stop forwarding Steam-contaminated offscreen frames while Steam's overlay is active |

## Before release QA

- Use an exact stable Electron release—never alpha, beta, nightly, or another
  prerelease.
- Force-close Steam and its helper processes on every other test machine.
- Exercise the actual Steam-launched game, not only a synthetic example.
- Cover ordinary and high refresh, low resolution, DPI/scale, drag, resize,
  minimum size, maximize, minimize, focus, fullscreen, overlay open/close, and
  clean shutdown.
- Never complete a purchase or subscription during QA.

## Documentation

- [npm package reference](packages/steam-bridge/README.md)
- [Electron example and platform guide](examples/electron-basic/README.md)
- [Steam API coverage](docs/steam-api-coverage.md)
- [Contributing and release process](CONTRIBUTING.md)
- [Architecture decisions and retained QA evidence](docs/research)

Repository development uses Node.js 22.13 or newer, Rust stable, and the
Steamworks SDK through `steamworks-sys` or `STEAMWORKS_SDK_PATH`.

```sh
npm install
npm run native:build
npm test
npm run package:smoke
```

## License

[MIT](LICENSE)
