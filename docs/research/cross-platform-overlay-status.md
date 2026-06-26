# Cross-Platform Overlay Status

Date: 2026-06-26

This tracks runtime evidence for the Electron smoke app using Valve's SpaceWar
App ID `480`.

## Current Evidence

| Target | Status | Evidence |
| --- | --- | --- |
| macOS Apple Silicon | Verified | Packaged `aarch64-apple-darwin` smoke app launched through a Steam non-Steam shortcut. `native-probe` autorun reported `steamLaunch=true`, `overlayInjection=true`, `nativeProbeOpen=true`, `overlayEnabled=true`, and `overlayNeedsPresent=false`. |
| Linux x64 | Verified through Steam Deck | Packaged Linux x64 smoke app launches on Steam Deck and initializes Steam as App ID `480`. |
| Steam Deck Game Mode | Verified | Steam-launched shortcut reported `steamDeck=true`, `bigPicture=true`, `steamLaunch=true`, `overlayInjection=true`, `overlayEnabled=true`, and emitted the `overlay:dialog` autorun event. |
| Steam Deck Desktop Mode | Verified | Desktop Mode uses the same Linux x64 package and Steam shortcut flow. The verifier gate omits `--require-big-picture` but keeps `--require-steam-deck`, `--require-overlay-ready`, `--require-steam-launch`, `--require-overlay-injection`, and the overlay dialog event assertions. |
| Windows x64 | Packaged, runtime pending | The Windows x64 smoke app packages locally and CI checks `x86_64-pc-windows-msvc`. Runtime overlay proof still needs the Windows laptop to run the Steam-launched shortcut and return the autorun log. |

## Windows Runtime Gate

The Windows package was rebuilt locally from the current repo state:

```sh
npm run example:package:win -- --artifacts-dir /tmp/steam-bridge-release-macos
```

Expected launch path:

```text
dist/electron-smoke/x86_64-pc-windows-msvc/SteamBridgeSmoke-win32-x64/SteamBridgeSmoke.exe
```

The Windows package contains:

- `steam_bridge_native.win32-x64-msvc.node`
- `steam_api64.dll`
- `sdkencryptedappticket64.dll`

The required Windows overlay proof is a Steam-launched autorun result that
passes:

```sh
npm run example:verify-result -- \
  --file /tmp/steam-bridge-smoke-windows-steam-launch.log \
  --platform win32/x64 \
  --app-id 480 \
  --require-steam-launch \
  --require-overlay-ready \
  --action dialog \
  --require-event overlay:dialog
```

Windows does not expose the same stable overlay injection environment marker as
macOS and Linux, so `--require-overlay-injection` is intentionally not part of
the Windows gate.
