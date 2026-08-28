# Steam Bridge

[![npm](https://img.shields.io/npm/v/steam-bridge)](https://www.npmjs.com/package/steam-bridge)
[![CI](https://github.com/jstroh/steam-bridge/actions/workflows/ci.yml/badge.svg)](https://github.com/jstroh/steam-bridge/actions/workflows/ci.yml)
[![license](https://img.shields.io/npm/l/steam-bridge)](https://github.com/jstroh/steam-bridge/blob/main/LICENSE)

Steam Bridge is a typed native Steamworks bridge for Node and Electron. It
ships prebuilt native addons and Valve runtime libraries for Windows x64,
Linux x64/Steam Deck, and Apple Silicon macOS.

Version 0.4 intentionally gives ordinary applications a small API:

- start and own one Steam application;
- configure one Electron integration;
- read one normalized renderer-input boundary;
- create one trusted publisher API client; and
- install one complete electron-builder hook pair.

The exhaustive Steamworks and integration surfaces remain available from
explicit advanced entrypoints.

## Install

```sh
npm install steam-bridge
```

Runtime requirements:

- Node.js 18 or newer;
- Electron 24 or newer when Electron is used;
- a stable Electron release, not an alpha or beta build;
- a running Steam client; and
- a Steam App ID the current account may run.

Valve's SpaceWar App ID `480` is appropriate for generic local smoke tests.
Use your own App ID for production and app-specific inventory, achievements,
commerce, cloud, Workshop, or matchmaking proof. A non-Steam local launch also
needs `steam_appid.txt` beside the executable or in its real working directory.

## Platform Targets

| Platform | Target | Supported game-window model |
| --- | --- | --- |
| Windows | x64 | One standalone D3D11 native host fed by offscreen Electron |
| Linux | x64 | One native X11/GLX application host, including Steam Deck |
| macOS | Apple Silicon arm64 | One managed Metal child attached to Electron |

Intel macOS, Rosetta, universal macOS packages, Windows ARM, Linux ARM,
Windows popup/attached presenters, and CPU rendering are unsupported.

General non-Deck Linux requires its own physical X11/Wayland qualification.
Steam Deck or CI evidence alone does not qualify every Linux desktop.
General non-Deck Linux desktop is a separate release-evidence lane and is **not green**
without its own current physical-host receipt.

## Entrypoints

| Entrypoint | Recommended use |
| --- | --- |
| `steam-bridge` | Start and own one Steam application |
| `steam-bridge/electron` | Configure Electron and connect renderer/native input |
| `steam-bridge/renderer` | Read normalized input in a context-isolated renderer |
| `steam-bridge/server` | Create a trusted publisher Web API client |
| `steam-bridge/electron-builder` | Create the complete packaging hook pair |
| `steam-bridge/steam-input/layouts` | Generate device-correct legacy layouts |

Advanced entrypoints:

- `steam-bridge/steamworks`
- `steam-bridge/electron/advanced`
- `steam-bridge/renderer/advanced`
- `steam-bridge/server/advanced`
- `steam-bridge/electron-builder/advanced`

## Start Steam once

```ts
import { startSteam } from "steam-bridge";

const steam = startSteam({ appId: 480 });

console.log({
  name: steam.localPlayer.getName(),
  subscribed: steam.apps.isSubscribed(),
  steamDeck: steam.isSteamDeck,
  bigPicture: steam.isBigPicture,
  overlayAvailable: steam.overlay.isAvailable()
});

const stopOverlayEvents = steam.events.onOverlayChanged((active) => {
  console.log("Steam overlay active:", active);
});

steam.overlay.open({ type: "store" });

// Application shutdown:
stopOverlayEvents();
steam.close();
```

`startSteam()` permits one active application per process. The returned
application owns callback dispatch, managed Steam Input sessions, game hosts,
subscriptions, and native shutdown. `close()` is idempotent and closes owned
resources in reverse order.

The ordinary service groups are:

- `apps`, `localPlayer`, `achievements`, `auth`, `cloud`, and `friends`;
- `inventory`, `matchmaking`, `networking`, `screenshots`, `stats`, and
  `workshop`;
- `events`, `overlay`, `gameHost`, and `steamInput`.

Import `steam-bridge/steamworks` when the managed application does not expose a
required SDK feature. Native Steam APIs belong on Node's main thread. Await
native promises before changing Steam lifecycle state.

## Configure Electron once

Configure the integration before Electron becomes ready, then register its
sandbox-compatible preload before creating the game renderer:

```ts
import { app, session } from "electron";
import { configureSteamElectron } from "steam-bridge/electron";

const steamElectron = configureSteamElectron();

app.whenReady().then(() => {
  steamElectron.installRendererInput(session.defaultSession);
});

app.once("before-quit", () => {
  steamElectron.close();
});
```

The integration owns preload registration, bounded Steam-action transport,
native-host input translation, and any repaint policy it enabled. Only one
integration may be active in a process. It never exposes `ipcRenderer` to the
page.

## Read normalized input

The preload exposes the versioned `window.steamBridge.input` boundary. It does
not create an animation-frame scheduler; read it from the application's
existing frame/update owner:

```ts
import { getRendererInput } from "steam-bridge/renderer";

const input = getRendererInput();

function updateGame(): void {
  const gamepads = input?.gamepads.read();
  const pad = gamepads?.primary;

  if (pad?.sticks.left.available) {
    movePlayer(pad.sticks.left.x, pad.sticks.left.y);
  }
  if (pad?.buttons.south.pressed) {
    interact();
  }
}
```

`gamepads.read()` is the controller-only frame-loop path. It includes:

- every connected controller and a Bridge-selected primary controller;
- semantic left/right sticks for standard and non-standard devices;
- position-named buttons instead of Xbox-only names;
- touch surfaces and complete raw axes/buttons for advanced binding UIs; and
- the newest managed Steam Input action frame when connected.

Use `input.read()` for the complete version-2 snapshot: focus, keyboard,
modifiers, pointer/touch/pen, wheel, text/composition, controller state, Steam
actions, ordered input edges, last meaningful input source, and dropped-edge
accounting.

Steam Bridge owns hot-plugging, sparse indexes, multiple controllers, stick
mapping, primary selection, focus-loss releases, stale-state cleanup,
coalescing, and bounded storage. An inactive game exposes neither an actionable
primary controller nor a stale Steam action frame. An idle controller does not
steal prompt ownership. Applications do not need controller-family tables,
raw-axis heuristics, renderer IPC, or another polling loop.

## Managed Steam Input actions

Define game meaning, not controller hardware:

```ts
import { defineSteamInput, startSteam } from "steam-bridge";

const definition = defineSteamInput({
  actionSets: { gameplay: "Gameplay" },
  digital: { interact: "Interact", pause: "Pause" },
  analog: { move: "Move" }
});

const steam = startSteam({ appId: 480 });
const actions = steam.steamInput.createSession({ definition }).start();
actions.activateActionSet("gameplay");

function updateGame(): void {
  const controller = actions.update().primaryController;
  if (controller?.digital.interact.pressedThisFrame) interact();
  if (controller?.analog.move.active) {
    movePlayer(controller.analog.move.x, controller.analog.move.y);
  }
}
```

The session owns Valve's explicit frame, action handles, batching, edges,
controller selection, disconnect releases, prompts, rebinding, haptics, and
shutdown. Poll `update()` once from the game-frame owner.

Validate and generate typed action definitions:

```sh
npx steam-bridge-input validate ./input/steam_input_manifest.vdf
npx steam-bridge-input generate ./input/steam_input_manifest.vdf \
  --out ./src/generated/steam-input.ts
npx steam-bridge-input generate ./input/steam_input_manifest.vdf \
  --out ./src/generated/steam-input.ts --check
```

Generate device-correct legacy layouts from one application-owned semantic
specification:

```sh
steam-bridge-generate-legacy-layouts ./input/layout.json --out ./input/layouts
steam-bridge-generate-legacy-layouts ./input/layout.json --out ./input/layouts --check
```

Steam Bridge owns the Xbox, PlayStation, Nintendo/Joy-Con, Steam Controller,
Steam Deck, generic-controller, and Remote Play layout families.

See the complete [Steam Input guide](https://github.com/jstroh/steam-bridge/blob/main/docs/steam-input.md)
and [runnable example](https://github.com/jstroh/steam-bridge/tree/main/examples/steam-input).

## Native game hosts

Choose one platform model and retain the same host for its lifetime.

### Windows

Use one standalone native D3D11 window. Electron renders offscreen and Steam
Bridge imports, buffers, and presents its GPU texture in the native host. The
host owns window chrome, per-monitor DPI, menus, input, resize, maximize,
fullscreen, minimize, focus, and Steam overlay targeting.

```ts
const nativeInput = steamElectron.connectNativeInput(gameWindow.webContents, {
  getContentSize: () => gameWindow.getContentSize()
});

const host = steam.gameHost.createNativeWindow({
  title: "My Game",
  clientWidth: 1280,
  clientHeight: 720,
  minClientWidth: 640,
  minClientHeight: 480,
  frameRate: 120,
  onInputEvent: (event) => nativeInput.handle(event)
});
```

Forward Electron shared textures according to Electron's pooled-texture
contract. Prefer `host.updateSharedTextureAsync(texture)` and release that exact
Electron texture after the returned promise resolves. This keeps GPU-copy
completion asynchronous without releasing Electron's pooled producer early. A
`false` result is bounded backpressure before native submission and means the
retained frame stays on screen. A rejected
`NativeOverlaySharedTextureCopyError` reports `producerReleaseSafe`. If it is
`false`, retain that exact producer without calling `texture.release()` for the
remainder of the application process, then terminate and relaunch the
application. Closing the native host or session, or reconstructing the graphics
device in the same process, is not a proven release boundary. Do not retry or
reuse that pooled handle. Do not add a popup, topmost companion, visible
Electron window underneath, attached Windows child, in-process GPU fallback, or
CPU upload path.

### Linux and Steam Deck

Use the native X11/GLX application host. Electron may use native Wayland, but
Steam still requires an Xwayland `DISPLAY` for the GLX target. The packaged
launcher must retain `--no-zygote --no-sandbox`; removing either switch creates
competing Chromium injection targets.

Steam Deck remains a Steam platform. Use `steam.isSteamDeck` and
`steam.isBigPicture` only for presentation or UI policy.

### macOS Apple Silicon Only

Use `steam.gameHost.attachElectronWindow(window)` once and retain the same
managed Metal child across normal, maximized, minimized, and fullscreen states.
The package must be Apple Silicon arm64, signed, notarized, and launched without
Rosetta.

Build and run macOS test apps only on native `darwin/arm64` Apple Silicon hosts.
Do not package, launch, or verify macOS smoke apps through Rosetta.

The complete implementation and live matrices are in the
[Electron smoke application](https://github.com/jstroh/steam-bridge/tree/main/examples/electron-basic).

## Trusted publisher Web API

Publisher keys belong only on a trusted Node server:

```ts
import { createSteamPublisherApi } from "steam-bridge/server";

const steamApi = createSteamPublisherApi({
  publisherApiKey: process.env.STEAM_PUBLISHER_WEB_API_KEY
});
```

If no key is passed, the server facade reads
`STEAM_PUBLISHER_WEB_API_KEY`, with `STEAM_WEB_API_KEY` retained as a
server-only compatibility alias. Keys travel in an HTTPS header and are
redacted from errors and response URLs. The facade rejects renderer/browser
runtimes and excludes the client-secret escape hatch. Specialized URL,
transport, and encrypted-ticket helpers live under
`steam-bridge/server/advanced`.

Never put a publisher key in Electron main, preload, renderer, or browser code.

## electron-builder hooks

```js
const { createSteamBuildHooks } = require("steam-bridge/electron-builder");
const steamBuild = createSteamBuildHooks();

exports.afterPack = steamBuild.afterPack;
exports.afterSign = steamBuild.afterSign;
```

The hook pair:

- installs the required Linux launcher after packing;
- prepares the macOS launcher and Steam-compatible entitlements;
- verifies the signed macOS app after signing; and
- intentionally leaves Windows packages unchanged.

Keep the native addon and matching Valve runtime libraries outside ASAR.
Windows application signing is the distributor's responsibility. Individual
packaging helpers are available from
`steam-bridge/electron-builder/advanced` for unusual pipelines.

## Migrating from 0.3

The npm import boundary is intentionally breaking:

| 0.3 | 0.4 |
| --- | --- |
| `steam-bridge` low-level API | `steam-bridge/steamworks` |
| `steam-bridge/electron` primitives | `steam-bridge/electron/advanced` |
| `steam-bridge/input` | `steam-bridge/renderer` |
| `steam-bridge/server` primitives | `steam-bridge/server/advanced` |
| `steam-bridge/electron-builder` primitives | `steam-bridge/electron-builder/advanced` |
| `steam-bridge/steam-input-layouts` | `steam-bridge/steam-input/layouts` |

New code should use `startSteam()`, `configureSteamElectron()`,
`getRendererInput()`, `createSteamPublisherApi()`, and
`createSteamBuildHooks()`.

The Electron shell/client protocol has a separate migration rule. A 0.4 shell
temporarily exposes a dormant legacy controller adapter so an already-cached
0.3 Client-PX bundle can still start. The adapter is not a public npm API and
does no work unless old client code calls it.

## Resource and security rules

- Authentication tickets, inventory results, query handles, native surfaces,
  transports, and subscriptions are live resources. Cancel, destroy, close, or
  release them explicitly; garbage collection is only a final safety net.
- Do not initialize Steamworks in an Electron renderer or a worker thread.
- Do not mix Steam Bridge's callback dispatcher with raw
  `CCallbackBase`/`CCallResult` registration.
- Do not pass unowned native pointers through networking or callback escape
  hatches.
- Keep publisher credentials and private product data out of client packages,
  logs, diagnostics, examples, and bug reports.
- Use one Steam client/test machine at a time for live overlay qualification.

## Troubleshooting

| Symptom | Check first |
| --- | --- |
| Steam initialization fails | Steam is running, account ownership is valid, App ID is correct, and `steam_appid.txt` is in the real local working directory |
| Overlay does not appear | Launch through Steam, initialize before graphics-device creation, close DevTools, and ensure no second machine owns the Steam session |
| Windows game window is missing | Use the standalone native host, not an attached Electron window or popup |
| Linux shows duplicate targets or crashes | Use the packaged launcher and retain the Xwayland `DISPLAY` |
| macOS child loses alignment | Keep one managed attachment through every window-state transition |
| Input sticks after focus loss | Use normalized renderer input and propagate native-host active/inactive state |
| Native addon works only unpackaged | Keep the addon and platform Valve libraries outside ASAR and verify OS/architecture matching |

## Validation

Repository development uses Node 22.13 or newer and Rust stable:

```sh
npm run check:platform
npm test
npm run package:smoke
npm run native:fmt
npm run native:check
npm run api:check
npm run steam-input:benchmark:electron
npm audit
```

Builds and automated tests do not prove physical overlay, controller, refresh,
window-state, or platform behavior. Qualify the exact packaged candidate and
retain sanitized evidence before publication.

## Documentation

- [Project guide](https://github.com/jstroh/steam-bridge#readme)
- [Steam Input](https://github.com/jstroh/steam-bridge/blob/main/docs/steam-input.md)
- [Steam API coverage](https://github.com/jstroh/steam-bridge/blob/main/docs/steam-api-coverage.md)
- [Electron smoke and live QA](https://github.com/jstroh/steam-bridge/tree/main/examples/electron-basic)
- [Contributing](https://github.com/jstroh/steam-bridge/blob/main/CONTRIBUTING.md)
- [Releasing](https://github.com/jstroh/steam-bridge/blob/main/RELEASING.md)

## License

MIT
