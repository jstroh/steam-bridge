# Cross-Platform Overlay Status

Date: 2026-06-26

This tracks runtime evidence for the Electron smoke app using Valve's SpaceWar
App ID `480`.

## Current Evidence

| Target | Status | Evidence |
| --- | --- | --- |
| macOS Apple Silicon | Verified | Packaged `aarch64-apple-darwin` smoke app launched through a Steam non-Steam shortcut. `native-probe` autorun reported `steamLaunch=true`, `overlayInjection=true`, `nativeProbeOpen=true`, `overlayEnabled=true`, and `overlayNeedsPresent=false`. |
| Linux x64 | Verified through Steam Deck | Packaged Linux x64 smoke app launches on Steam Deck and initializes Steam as App ID `480`. The Linux package includes `linux-electron-smoke.sh` for direct, Steam-launched, and verification checks. |
| Steam Deck Game Mode | Verified | Steam-launched shortcut reported `steamDeck=true`, `bigPicture=true`, `steamLaunch=true`, `overlayInjection=true`, `overlayEnabled=true`, and emitted the `overlay:dialog` autorun event. Fresh check on 2026-06-26 launched full shortcut game ID `16558333557412462592` and passed. |
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
- `windows-electron-smoke.ps1`

The helper script for the Windows laptop is copied to:

```text
dist/electron-smoke/x86_64-pc-windows-msvc/SteamBridgeSmoke-win32-x64/windows-electron-smoke.ps1
```

The required Windows overlay proof is a Steam-launched autorun result that
passes either the local PowerShell verifier:

```powershell
.\windows-electron-smoke.ps1 `
  -Mode verify `
  -Action dialog `
  -ResultFile C:\Temp\steam-bridge-smoke-windows-steam-launch.log `
  -RequireSteamLaunch `
  -RequireOverlayReady `
  -RequireEvent overlay:dialog
```

or the repo-host verifier:

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

## Steam Deck Shortcut Gate

Steam Deck testing uses the packaged Linux x64 app with SpaceWar App ID `480`
inside the process. The Steam launch URL must use the full non-Steam shortcut
game ID, not `480` and not Steam's internal 32-bit shortcut app ID. Launching
the wrong ID can show Steam's `Game configuration unavailable` dialog.

The packaged Linux helper can discover the current shortcut ID from
`shortcuts.vdf`, launch it, and verify the overlay signal:

```sh
cd "$HOME/steam-bridge-smoke/SteamBridgeSmoke-linux-x64"

./linux-electron-smoke.sh \
  --mode steam-launch \
  --shortcut-game-id auto \
  --action dialog \
  --result-file /tmp/steam-bridge-smoke-steam-launch.log \
  --require-steam-deck \
  --require-big-picture \
  --require-overlay-injection \
  --require-event callback:overlay-activated
```

The latest Deck Game Mode proof was captured at 2026-06-26 17:03 PDT from
`/tmp/steam-bridge-smoke-steam-launch.log` with `appId=480`,
`steamLaunch=true`, `overlayInjection=true`, `overlayEnabled=true`,
`overlayNeedsPresent=false`, `steamDeck=true`, `bigPicture=true`, and
`overlay:dialog`.
