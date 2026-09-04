# Steam Bridge

[![npm](https://img.shields.io/npm/v/steam-bridge)](https://www.npmjs.com/package/steam-bridge)
[![CI](https://github.com/jstroh/steam-bridge/actions/workflows/ci.yml/badge.svg)](https://github.com/jstroh/steam-bridge/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/npm/l/steam-bridge)](LICENSE)

**Steamworks for Node.js and Electron, with typed APIs and prebuilt native addons.**

Add authentication, achievements, cloud saves, friends, inventory, matchmaking,
Workshop, and Steam Input to your game. For Electron games, Steam Bridge also
provides native Steam-overlay presentation, context-isolated renderer input,
and packaging helpers.

The package includes the native addon and matching Valve runtime libraries.
Installing the published package does not require Rust or a separate Steamworks
SDK download. Building Steam Bridge itself does.

## Quick start

```sh
npm install steam-bridge
```

Start Steam, save this as `steam-check.cjs`, and run `node steam-check.cjs`:

```js
const { startSteam } = require("steam-bridge");

const steam = startSteam({ appId: 480 });

try {
  console.log({
    appId: steam.appId,
    bridgeVersion: steam.packageVersion,
    steamDeck: steam.isSteamDeck,
    bigPicture: steam.isBigPicture
  });
} finally {
  steam.close();
}
```

This checks native loading and Steam initialization. It does not create a game
window or prove that the Steam overlay works. App ID `480` is Valve's SpaceWar
sample; use your own App ID and an entitled account for your game's features.

For a running game, keep the returned application alive until shutdown.
`startSteam()` owns callback dispatch and permits one active application per
process. Do not initialize Steamworks again in a renderer or worker.

## Pick your next step

| You want to… | Start here |
| --- | --- |
| Connect a Node game, use Steam services, or understand lifecycle | [Getting started](docs/getting-started.md) |
| Add Steam to an Electron game | [Electron integration](docs/electron.md) |
| Read controllers, bind actions, or display button glyphs | [Steam Input and renderer input](docs/steam-input.md) |
| Ship an Electron game on Steam | [Packaging your game](docs/packaging.md) |
| Diagnose initialization, input, overlay, or frame-delivery problems | [Troubleshooting](docs/troubleshooting.md) |
| Find a lower-level Steamworks API | [API coverage](docs/steam-api-coverage.md) |
| Work on this library | [Contributing](CONTRIBUTING.md) |
| Publish a new Steam Bridge package | [Maintainer release procedure](RELEASING.md) |

These guides describe the 0.4 API. The [release history](https://github.com/jstroh/steam-bridge/releases)
records published versions; `main` may contain unreleased documentation or code.

## Platform Targets

The npm package supports Node.js 18+ and declares Electron 24+ as an optional
peer. That peer floor is not a promise that every modern shared-texture feature
exists in Electron 24. Use a stable Electron version and qualify the exact
runtime and packaged application you ship.

| Platform | Native target | Electron game-window model |
| --- | --- | --- |
| Windows x64 | `x86_64-pc-windows-msvc` | Standalone native D3D11 window, fed by offscreen Electron |
| Linux x64 / Steam Deck | `x86_64-unknown-linux-gnu` | Native X11/GLX application host |
| macOS Apple Silicon | `aarch64-apple-darwin` | Managed Metal child attached to an Electron window |

Windows ARM, Linux ARM, Intel macOS, Rosetta, and universal macOS packages are
not supported. A browser page alone cannot initialize the native Steam client.

General non-Deck Linux remains a separate physical X11/Wayland qualification lane.
General non-Deck Linux desktop is a separate release-evidence lane and is **not green**
without its own physical-host receipt. Deck Desktop/Game Mode and CI results
do not qualify every Linux distribution, compositor, and driver.

### macOS Apple Silicon Only

Build and run macOS test apps only on native `darwin/arm64` Apple Silicon hosts.
Do not package, launch, or verify macOS smoke apps through Rosetta.
Shipping applications must be signed and notarized. Keep the same managed
attachment through resize, minimize, maximize, and fullscreen transitions.

## Where each API runs

| Import | Process | Purpose |
| --- | --- | --- |
| `steam-bridge` | Node main thread / Electron main | `startSteam()`, Steam services, managed actions and game hosts |
| `steam-bridge/electron` | Electron main | `configureSteamElectron()`, preload registration and input connections |
| `steam-bridge/renderer` | Game renderer | `getRendererInput()`, normalized input snapshots |
| `steam-bridge/server` | Trusted backend only | `createSteamPublisherApi()`, publisher Web API calls |
| `steam-bridge/electron-builder` | Build process | `createSteamBuildHooks()`: `afterPack` and `afterSign` |
| `steam-bridge/steam-input/layouts` | Tooling / Node | Device-specific legacy layout generation |

Start with these APIs. Use `steam-bridge/steamworks` or the
`electron/advanced`, `renderer/advanced`, `server/advanced`, and
`electron-builder/advanced` subpaths only when you need a lower-level feature.

## Important integration rules

**Electron startup has an order.** Configure Steam Electron before
`app.whenReady()`, initialize Steam before creating graphics devices, register
the input preload before loading the page, and connect action input before
navigation. The [Electron guide](docs/electron.md) shows the sequence.

**Input has one frame owner.** Read input from your existing game loop.
For a main-thread game, call the managed action session's `update()` once per
game frame. For renderer-owned gameplay, let `connectActionInput()` service
renderer requests. Do not add a second polling loop.

**Windows textures have an ownership contract.** Prefer
`host.updateSharedTextureAsync(descriptor)`. A resolved promise permits
release of that event's Electron producer; `false` means the frame was rejected
before submission, not that it should be retried. If a
`NativeOverlaySharedTextureCopyError` reports `producerReleaseSafe: false`,
retain the exact producer without `texture.release()` for the
remainder of the application process, then terminate and relaunch. Closing the
native host/session or reconstructing the device in the same process is
not a proven release boundary. The synchronous compatibility method has the
same unsafe-error rule. See [texture ownership](docs/electron.md#windows-texture-ownership)
before writing a paint handler.

**Publisher credentials stay on your server.** Never ship a publisher key in
Electron main, preload, renderer, browser code, or a game package. An overlay
authorization callback alone does not finalize a purchase.

**A successful build is not live proof.** Test the installed package through
Steam, including focus, resize, overlay, input, and shutdown. The
[advanced QA harness](examples/electron-basic/README.md) is a qualification tool,
not a minimal application template.

## Windows signing and privacy

The Windows native addon is unsigned. Valve libraries retain their original
bytes and signatures; signing a consuming application is the distributor's
responsibility. Microsoft Security Intelligence submission is reputation review,
not code signing or a guarantee of Smart App Control approval.

Steam Bridge does not send telemetry to its maintainers. Your application owns
its diagnostics, collection policy, and retention. Read the
[code signing policy](CODE_SIGNING_POLICY.md) and [privacy policy](PRIVACY.md).

## Migrating from 0.3

The 0.4 import boundary is intentionally breaking:

| Old import | 0.4 equivalent |
| --- | --- |
| `steam-bridge` low-level SDK mirror | `steam-bridge/steamworks` |
| `steam-bridge/electron` primitives | `steam-bridge/electron/advanced` |
| `steam-bridge/input` | `steam-bridge/renderer` for ordinary input; `renderer/advanced` for primitives |
| `steam-bridge/server` primitives | `steam-bridge/server/advanced` |
| `steam-bridge/electron-builder` primitives | `steam-bridge/electron-builder/advanced` |
| `steam-bridge/steam-input-layouts` | `steam-bridge/steam-input/layouts` |

Prefer the managed APIs for new code rather than mechanically moving every
import to an advanced path. A narrow dormant legacy preload adapter exists for
cached older clients; it is not a public npm API or a migration target.

## License

[MIT](LICENSE). Steamworks use remains subject to Valve's terms.
