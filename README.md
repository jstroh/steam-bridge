# Steam Bridge

Steam Bridge is a native-backed TypeScript package for Electron and Node. It
provides a focused Steamworks API surface through a Rust `napi-rs` addon, plus a
compatibility-shaped default export for projects migrating from Steamworks
wrappers with similar call patterns.

This project is 100% created and maintained by Codex.

The native crate calls the Steamworks flat C API through `steamworks-sys` and
owns Steam API initialization, manual callback dispatch, auth tickets, overlay
helpers, Steam Deck and Steam utility checks, Steam ID helpers, achievements,
networking, matchmaking, app metadata and DLC helpers, cloud, input, stats,
inventory, and workshop helpers.

Steam SDK redistributables are not committed. For local/native builds, provide
the Steamworks SDK in the normal location expected by `steamworks-sys`, or set
`STEAMWORKS_SDK_PATH` according to your SDK setup.

Prebuild scaffolding currently targets Windows x64, Linux x64, and Apple
Silicon macOS (`aarch64-apple-darwin`). Intel macOS is intentionally
unsupported, and native macOS builds are limited to Apple Silicon.

## Quick Start

Valve's public Steamworks example app is SpaceWar, App ID `480`. It is useful for
local smoke testing, but it is not a substitute for your own Steam app ID in
production.

```ts
import {
  init,
  getSteamId,
  getAuthTicketForWebApi,
  isSteamDeck,
  onMicroTxnAuthorizationResponse,
  getOverlayDiagnostics,
  activateOverlayToWebPage,
  isAchievementActivated
} from "steam-bridge";

init({ appId: 480 });

const steamId = getSteamId().steamId64;
const ticket = await getAuthTicketForWebApi("steam-bridge-example");
const bytes = ticket.getBytes();

console.log({
  steamId,
  ticketBytes: bytes.length,
  steamDeck: isSteamDeck(),
  overlay: getOverlayDiagnostics()
});

onMicroTxnAuthorizationResponse((event) => console.log(event));
activateOverlayToWebPage("https://store.steampowered.com/app/480/");
isAchievementActivated("ACH_WIN_ONE_GAME");
```

The compatibility-style default export exposes grouped APIs:

```ts
import steamworks from "steam-bridge";

const client = steamworks.init(480);

client.localplayer.getSteamId().steamId64;
client.auth
  .getAuthTicketForWebApi("steam-bridge-example")
  .then((ticket) => ticket.getBytes());
client.callback.register(
  client.callback.SteamCallback.MicroTxnAuthorizationResponse,
  (event) => console.log(event)
);
client.utils.getOverlayDiagnostics();
client.overlay.activateToWebPage("https://store.steampowered.com/app/480/");
client.achievement.isActivated("ACH_WIN_ONE_GAME");
```

## Layout

- `crates/native`: Rust N-API module.
- `packages/steam-bridge`: TypeScript public package and compatibility adapter.
- `examples/electron-basic`: minimal Electron smoke app using App ID `480`.
- `docs/steam-api-coverage.md`: current Steamworks coverage and known gaps.
- `docs/research`: implementation notes and platform research.
- `.github/workflows`: CI and release/prebuild scaffolding.

## Local Development

Prerequisites:

- Node.js 22.13 or newer for the repository toolchain.
- Rust stable.
- Steamworks SDK files available through the standard `steamworks-sys` setup or
  `STEAMWORKS_SDK_PATH`.

```sh
npm install
npm run native:build
npm run build
```

If you build the native module by another path, set `STEAM_BRIDGE_NATIVE_PATH`
to the `.node` file before requiring the package.

To run the Electron smoke app:

```sh
npm install
npm run native:build
npm start -w steam-bridge-electron-example
```

You can override the smoke app ID if you have your own Steam app:

```sh
STEAM_BRIDGE_APP_ID=480 npm start -w steam-bridge-electron-example
```

When launching outside Steam, put a `steam_appid.txt` file containing the app ID
next to the executable or in the working directory used by your app.

Before opening a pull request, run the checks that CI runs:

```sh
npm test
npm run native:fmt
npm run native:check
```

## macOS Overlay Diagnostics

On macOS, Steam API initialization and the in-game overlay are separate
successes. `steam_appid.txt` can be enough for Steam ID, auth tickets, and
callbacks while the overlay still never hooks an Electron `BrowserWindow`.

Steam Bridge exposes `client.utils.getOverlayDiagnostics()` so the host app can
log what Steam sees:

- `steamRunning`
- `appId`
- `overlayEnabled`
- `overlayNeedsPresent`
- `steamDeck`
- `bigPicture`
- `steamInstallPath`

Steam Bridge also includes a macOS native overlay probe surface:

```ts
client.overlay.openNativeOverlayProbeWindow("Steam Overlay Probe");
client.overlay.pumpNativeOverlayProbeWindow();
client.overlay.closeNativeOverlayProbeWindow();
```

Set `STEAM_BRIDGE_ELECTRON_OVERLAY_PROFILE=compatibility` to opt into the older
Electron overlay workaround profile. That profile enables `in-process-gpu`, so
keep it diagnostic-only unless it proves useful on your target machine.

## Notes

- Use App ID `480` only for local Steamworks smoke tests.
- Use your own App ID before shipping, publishing builds, or testing
  app-specific achievements, stats, inventory, UGC, or economy flows.
- Steam Bridge does not vendor the Steamworks SDK or Valve redistributables.
