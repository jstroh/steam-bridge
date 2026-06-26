# Steam Bridge Electron Smoke

This is a tiny Electron app for proving that Steam Bridge can initialize Steam,
read basic Steamworks state, and exercise overlay paths on macOS Apple Silicon,
Windows x64, Linux x64, and Steam Deck.

It uses Valve's SpaceWar sample App ID `480` by default. Override it with
`STEAM_BRIDGE_APP_ID` when testing your own app.

The default Electron overlay profile is `diagnostic`, which applies conservative
Electron switches and avoids forcing Chromium's in-process GPU path. Set
`STEAM_BRIDGE_ELECTRON_OVERLAY_PROFILE=compatibility` when you specifically want
to test the more aggressive overlay workaround profile.

## Development

```sh
npm run native:build
npm run example:start
```

The app writes `steam_appid.txt` for local smoke testing before it initializes
Steam.

## Packaged Smoke Builds

Download release artifacts from a successful `Release` workflow, then package a
self-contained Electron smoke app:

```sh
gh run download <run-id> --dir /tmp/steam-bridge-release
npm run example:package:linux -- --artifacts-dir /tmp/steam-bridge-release
npm run example:package:win -- --artifacts-dir /tmp/steam-bridge-release
npm run example:package:mac -- --artifacts-dir /tmp/steam-bridge-release
```

Outputs are written under `dist/electron-smoke/<target>/`.

## Autorun Logs

For scripted checks, set `STEAM_BRIDGE_SMOKE_AUTORUN=1`. The app will open,
optionally trigger one overlay action, print one line beginning with
`STEAM_BRIDGE_SMOKE_RESULT `, and quit.

```sh
STEAM_BRIDGE_SMOKE_AUTORUN=1 \
STEAM_BRIDGE_SMOKE_AUTORUN_ACTION=dialog \
STEAM_BRIDGE_SMOKE_AUTORUN_RESULT_DELAY_MS=5000 \
./SteamBridgeSmoke --no-sandbox
```

Supported autorun actions are `none`, `dialog`, `friends`, `store`, `web`, and
`native-probe`.

To verify an autorun log:

```sh
npm run example:verify-result -- \
  --file /tmp/steam-bridge-smoke.log \
  --app-id 480 \
  --platform linux \
  --arch x64
```

## Steam Deck Checks

For Game Mode, copy the Linux x64 output folder to the Deck and add the packaged
`SteamBridgeSmoke` executable as a non-Steam game. Launch it from Game Mode and
use the overlay buttons in the app.

For scripted setup, back up and upsert the non-Steam shortcut with:

```sh
npm run steam-shortcut:upsert -- \
  --shortcuts "$HOME/.local/share/Steam/userdata/<steam-user-id>/config/shortcuts.vdf" \
  --app-name "Steam Bridge Smoke" \
  --exe "$HOME/steam-bridge-smoke/SteamBridgeSmoke-linux-x64/SteamBridgeSmoke" \
  --start-dir "$HOME/steam-bridge-smoke/SteamBridgeSmoke-linux-x64" \
  --launch-options "--no-sandbox"
```

Use the numeric `userdata` folder for the Steam account currently signed in on
the Deck. The helper backs up an existing shortcut file, writes Steam's binary
shortcut format, and prints both the shortcut app ID and the full shortcut game
ID. Launch the full game ID after Steam has reloaded shortcuts:

```sh
steam steam://rungameid/<shortcut-game-id>
```

For Desktop Mode, launch the same Linux x64 executable from the desktop shell or
file manager while Steam is running. The diagnostics panel should show whether
Steam is running, whether the app is on Steam Deck, and whether the overlay is
enabled.

For longer SSH-driven checks, keep the Deck awake from SteamOS/Desktop Mode
power settings. `systemd-inhibit` can require interactive authorization over SSH
on SteamOS.

## Overlay Signals

The important fields are:

- `Initialized`
- `Steam Running`
- `Overlay Enabled`
- `Needs Present`
- `Native Probe`
- `callback:overlay-activated`

If Steam initializes but overlay does not show, compare those fields between
macOS, Deck Game Mode, Deck Desktop Mode, and Windows.

In autorun output, inspect `snapshot.steam.overlayEnabled`,
`snapshot.steam.overlayNeedsPresent`, `snapshot.steam.overlayDiagnostics`, and
the final `snapshot.events` list. `snapshot.launch.steamLaunch` reports whether
Steam launch environment markers were present. `snapshot.launch.overlayInjection`
reports whether the process environment includes a Steam overlay hook marker such
as `gameoverlayrenderer`.

For Steam Deck Game Mode or gamescope checks, the verifier can assert the Deck
signals:

```sh
npm run example:verify-result -- \
  --file /tmp/steam-bridge-smoke.log \
  --platform linux/x64 \
  --require-steam-deck \
  --require-big-picture \
  --require-overlay-ready
```

For a Steam-launched non-Steam game check, add the stronger launch assertions
when they are expected on the target platform:

```sh
npm run example:verify-result -- \
  --file /tmp/steam-bridge-smoke.log \
  --require-steam-launch \
  --require-overlay-injection
```

For an autorun overlay command, assert both the requested action and the emitted
event:

```sh
npm run example:verify-result -- \
  --file /tmp/steam-bridge-smoke.log \
  --action dialog \
  --require-event overlay:dialog
```
