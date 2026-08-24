# Steam Bridge

Steam Bridge gives Node and Electron applications a small, lifecycle-owned API
for Steamworks, Steam Input, secure renderer input, native Steam presentation,
trusted publisher Web API calls, and Steam-safe packaging.

## Code signing policy

Free code signing provided by [SignPath.io](https://about.signpath.io/),
certificate by [SignPath Foundation](https://signpath.org/).

The free OSS signing scope is limited to binaries built from this repository's
MIT-licensed source, beginning with the project-owned Windows native addon.
Valve Steamworks redistributables and applications that consume Steam Bridge
are explicitly excluded. See the complete [code signing policy](CODE_SIGNING_POLICY.md)
and [privacy policy](PRIVACY.md).

Version 0.4 intentionally simplifies the public API. Applications start one
Steam lifetime, configure one Electron integration, and read one normalized
renderer-input boundary. Exhaustive SDK mirrors and low-level integration
primitives remain available from explicit advanced entrypoints.

## Platform Targets

| Platform | Target | Product window model |
| --- | --- | --- |
| Windows | x64 | One standalone native D3D11 host with an offscreen Electron renderer |
| Linux | x64 | Native X11/GLX application host; Steam Deck Desktop and Game Mode supported |
| macOS | Apple Silicon arm64 | One managed Metal child attached to the Electron window |

Intel macOS, Rosetta, universal macOS packages, Windows attached/popup overlay
hosts, and a CPU-rendering fallback are not supported.

## Install

```sh
npm install steam-bridge
```

Electron is an optional peer dependency. Use a stable Electron release; do not
ship alpha or beta Electron builds.

## Public entrypoints

| Entrypoint | Ordinary application use |
| --- | --- |
| `steam-bridge` | Start and own one Steam application |
| `steam-bridge/electron` | Configure Electron and connect renderer/native input |
| `steam-bridge/renderer` | Read normalized input inside a context-isolated renderer |
| `steam-bridge/server` | Create a trusted publisher Web API client |
| `steam-bridge/electron-builder` | Install the complete packaging hook pair |
| `steam-bridge/steam-input/layouts` | Generate device-correct legacy layouts |

Low-level surfaces are deliberately explicit:

- `steam-bridge/steamworks`
- `steam-bridge/electron/advanced`
- `steam-bridge/renderer/advanced`
- `steam-bridge/server/advanced`
- `steam-bridge/electron-builder/advanced`

## Start one Steam application

```ts
import { startSteam } from "steam-bridge";

const steam = startSteam({ appId: 480 });

console.log(steam.localPlayer.getName());
console.log({
  steamDeck: steam.isSteamDeck,
  bigPicture: steam.isBigPicture,
  overlay: steam.overlay.isAvailable()
});

const stopOverlayEvents = steam.events.onOverlayChanged((active) => {
  console.log("Steam overlay active:", active);
});

steam.overlay.open({ type: "store" });

// Application shutdown:
stopOverlayEvents();
steam.close();
```

`startSteam()` permits one active application per process. The returned object
owns callbacks, managed Steam Input sessions, game hosts, and Steam shutdown.
`close()` is idempotent.

The grouped services cover ordinary app needs:

- `apps`, `localPlayer`, `achievements`, `auth`, `cloud`, and `friends`;
- `inventory`, `matchmaking`, `networking`, `screenshots`, `stats`, and
  `workshop`;
- `events`, `overlay`, `gameHost`, and managed `steamInput` sessions.

Use `steam-bridge/steamworks` only when the managed surface does not expose a
required SDK feature.

## Configure Electron once

Call `configureSteamElectron()` before Electron becomes ready:

```ts
import { app, session } from "electron";
import { configureSteamElectron } from "steam-bridge/electron";

const steamElectron = configureSteamElectron();

app.whenReady().then(() => {
  const rendererInput = steamElectron.installRendererInput(session.defaultSession);

  app.once("before-quit", () => {
    rendererInput.close();
    steamElectron.close();
  });
});
```

The integration owns its preload registrations, main/renderer Steam Input
connections, native input forwarders, and any repaint policy it started. Only
one integration may be active in a process.

## Read input in the renderer

The preload exposes no `ipcRenderer` and starts no animation-frame loop. The
application reads input from its existing game/update scheduler:

```ts
import { getRendererInput } from "steam-bridge/renderer";

const input = getRendererInput();

function updateGame(): void {
  const frame = input?.gamepads.read();
  const pad = frame?.primary;

  if (pad?.sticks.left.available) {
    movePlayer(pad.sticks.left.x, pad.sticks.left.y);
  }
  if (pad?.buttons.south.pressed) {
    interact();
  }
}
```

Use `input.read()` when the application also needs keyboard state, modifiers,
pointer/touch/pen state, wheel accumulation, text/composition, ordered input
edges, focus, the last meaningful input source, or Steam action frames.

Steam Bridge owns:

- focus/visibility neutralization and held-state cleanup;
- keyboard, mouse, wheel, touch, pen, and controller normalization;
- hot-plugging, sparse controller indexes, multiple controllers, and primary
  controller selection;
- position-named buttons and semantic left/right sticks;
- complete raw axes/buttons for advanced binding UIs;
- bounded event storage and bounded/coalesced Steam Input IPC;
- one-second no-controller discovery instead of per-frame empty enumeration.

An inactive game exposes no actionable primary controller or stale Steam
actions. An idle connected Steam controller does not steal prompt ownership.

The controller-only path is designed for frame loops. The repository benchmark
runs 20,000 reads and enforces a sub-millisecond budget; it does not create a
second scheduler.

## Managed Steam Input actions

Define game meaning in the application and let Steam Bridge own controller
handles, frame batching, edges, prompts, output, and lifecycle:

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

Generate and verify typed manifests with:

```sh
npx steam-bridge-input validate ./input/steam_input_manifest.vdf
npx steam-bridge-input generate ./input/steam_input_manifest.vdf \
  --out ./src/generated/steam-input.ts
npx steam-bridge-input generate ./input/steam_input_manifest.vdf \
  --out ./src/generated/steam-input.ts --check
```

For legacy keyboard/mouse-style games, generate controller-family layouts from
one semantic JSON spec:

```sh
steam-bridge-generate-legacy-layouts ./input/layout.json --out ./input/layouts
steam-bridge-generate-legacy-layouts ./input/layout.json --out ./input/layouts --check
```

The generator owns Xbox, PlayStation, Switch/Joy-Con, Steam Controller, Steam
Deck, generic-controller, and Remote Play layout details. Application code does
not carry controller model tables.

See [Steam Input for game developers](docs/steam-input.md).

## Choose the correct window model

### Windows

Use one standalone native game host. Electron renders offscreen and Steam
Bridge imports/presents the GPU texture in the native D3D11 window. Do not add
a visible Electron game window underneath it and do not attach a popup or child
presenter.

```ts
const host = steam.gameHost.createNativeWindow({
  title: "My Game",
  clientWidth: 1280,
  clientHeight: 720,
  frameRate: 120
});
```

Connect the host's native input events to the offscreen renderer with
`steamElectron.connectNativeInput(...)`. Keep the same host for launch, resize,
maximize, fullscreen, minimize, overlay, and shutdown.

Submit Electron pooled textures with `host.updateSharedTextureAsync(texture)`
and release each texture only after that submission promise settles. A `false`
result is bounded backpressure and retains the prior frame; never retry or reuse
the pooled handle. The synchronous `updateSharedTexture(...)` method exists for
compatibility, not as the preferred frame loop.

### Linux and Steam Deck

Use the native X11/GLX application host for Steam-over-live-WebGL presentation.
The packaged launcher must retain `--no-zygote --no-sandbox`; Steam otherwise
injects into Chromium children and creates competing overlay targets.

Steam Deck remains a Steam platform. Use `steam.isSteamDeck` and
`steam.isBigPicture` only to choose presentation/UI policy.

General non-Deck Linux remains a separate physical X11/Wayland qualification lane;
Steam Deck evidence does not qualify ordinary Linux desktops.

### macOS Apple Silicon Only

Use one managed Electron attachment and reuse it through resize, maximize,
minimize, and fullscreen transitions:

```ts
const overlay = steam.gameHost.attachElectronWindow(mainWindow);
await overlay.openStoreAndWaitIfAvailable({ appId: steam.appId });
```

The supported package is Apple Silicon arm64, signed and notarized. Do not
build or test it through Rosetta.

Do not package, launch, or verify macOS smoke apps through Rosetta.

## Client code and trusted server code

Never place publisher keys in an Electron main process, preload, renderer, or
browser bundle.

```ts
import { createSteamPublisherApi } from "steam-bridge/server";

const steamApi = createSteamPublisherApi({
  publisherApiKey: process.env.STEAM_PUBLISHER_WEB_API_KEY
});
```

The safe server facade rejects client-runtime publisher-secret overrides. More
specialized server primitives are available only from
`steam-bridge/server/advanced`.

Authentication tickets and inventory result handles are live native resources.
Cancel/destroy them in `finally`; garbage collection is only a safety net.

## Package Electron applications

```js
const { createSteamBuildHooks } = require("steam-bridge/electron-builder");
const steamBuild = createSteamBuildHooks();

exports.afterPack = steamBuild.afterPack;
exports.afterSign = steamBuild.afterSign;
```

The hook pair:

- prepares the Linux launcher after packing;
- prepares the macOS launcher/entitlements after packing;
- verifies the signed macOS app after signing; and
- deliberately does nothing to Windows packages.

Keep the native addon and matching Valve runtime libraries outside ASAR.
Windows signing remains the application distributor's responsibility.

## Compatibility and migration

0.4 is intentionally breaking at the npm import boundary:

| Before 0.4 | 0.4 |
| --- | --- |
| `steam-bridge` low-level API | `steam-bridge/steamworks` |
| `steam-bridge/electron` primitives | `steam-bridge/electron/advanced` |
| `steam-bridge/input` | `steam-bridge/renderer` |
| `steam-bridge/server` primitives | `steam-bridge/server/advanced` |
| `steam-bridge/electron-builder` primitives | `steam-bridge/electron-builder/advanced` |
| `steam-bridge/steam-input-layouts` | `steam-bridge/steam-input/layouts` |

The Electron shell/client protocol has a narrower compatibility requirement
than npm imports. New shells temporarily expose a migration-only legacy
controller reader for cached 0.3 Client-PX bundles, while new Client-PX builds
accept both the 0.4 and 0.3 boundaries. The adapter does no work unless an old
client calls it.

## Troubleshooting

| Symptom | Check first |
| --- | --- |
| Steam does not initialize | Steam is running, the account owns the app, the App ID is correct, and local launches have `steam_appid.txt` in the real working directory |
| Overlay does not appear | Launch through Steam, initialize before graphics-device creation, close DevTools, and ensure only one test machine owns the Steam session |
| Windows window/overlay is missing | Use the standalone native host, not Electron attachment or a popup |
| Linux crashes or has duplicate overlay targets | Use the packaged Steam Bridge launcher and retain the Xwayland `DISPLAY` |
| macOS overlay loses alignment | Reuse one managed attachment through every window-state transition |
| Controller input sticks after focus loss | Consume the normalized renderer boundary and propagate native-host active/inactive state |
| Native addon works unpackaged only | Keep the addon and platform Valve libraries outside ASAR and verify OS/architecture matching |

## Development and release gates

```sh
npm ci
npm run build
npm test
npm run package:smoke
npm run check:platform
npm run native:fmt
npm run native:check
npm run api:check
npm run steam-input:benchmark:electron
npm audit
```

Automated checks are not physical-device proof. Before release, qualify the
exact packed candidate on supported hosts, with one Steam client running at a
time, and inspect the resulting diagnostics/receipts.

## More documentation

- [Steam Input guide](docs/steam-input.md)
- [Steam API coverage](docs/steam-api-coverage.md)
- [Code signing policy](CODE_SIGNING_POLICY.md)
- [Privacy policy](PRIVACY.md)
- [Current engineering checkpoint](docs/research/current-work.md)
- [Electron smoke and actual-game QA](examples/electron-basic/README.md)
- [Steam Input example](examples/steam-input/README.md)

Files under `docs/research/` preserve design decisions, experiments, and
historical qualification evidence. They are not the recommended 0.4 API guide.

## License

MIT
