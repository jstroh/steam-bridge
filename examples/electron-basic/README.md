# Steam Bridge Electron Smoke

This is a tiny Electron app for proving that Steam Bridge can initialize Steam,
read basic Steamworks state, and exercise overlay paths on Linux x64 and Steam
Deck.

It uses Valve's SpaceWar sample App ID `480` by default. Override it with
`STEAM_BRIDGE_APP_ID` when testing your own app.

The default Electron overlay profile is `diagnostic`, which applies conservative
Electron switches and avoids forcing Chromium's in-process GPU path. Set
`STEAM_BRIDGE_ELECTRON_OVERLAY_PROFILE=repaint` when an event-driven Electron
renderer needs fresh frames for Steam's overlay. Set
`STEAM_BRIDGE_ELECTRON_OVERLAY_PROFILE=compatibility` only when you specifically
want the more aggressive Linux/Desktop workaround that also enables Chromium's
in-process GPU path.

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

For web overlay checks, the default URL is the app's Steam store page. Override
it with `STEAM_BRIDGE_SMOKE_WEB_URL` and set
`STEAM_BRIDGE_SMOKE_WEB_MODAL=1` when you need to exercise a modal checkout or
approval URL for your own Steam app. Add
`STEAM_BRIDGE_SMOKE_REQUIRE_OVERLAY_ACTIVE=1` when the test must fail unless
Steam reports an active overlay.

The Linux and Steam Deck helpers expose the same settings as `--web-url` and
`--web-modal`:

```sh
npm run steam-deck:smoke -- \
  --host deck@<deck-host-or-ip> \
  --mode game \
  --action web \
  --web-url https://store.steampowered.com/app/480/ \
  --web-modal false
```

The same controls are also available as launch options, which is usually easier
for Steam non-Steam shortcuts:

```sh
--steam-bridge-app-id=480 \
--steam-bridge-electron-overlay-profile=diagnostic \
--steam-bridge-smoke-autorun \
--steam-bridge-smoke-autorun-action=dialog \
--steam-bridge-smoke-autorun-result-delay-ms=8000 \
--steam-bridge-smoke-web-url=https://store.steampowered.com/app/480/ \
--steam-bridge-smoke-web-modal=false \
--steam-bridge-smoke-require-overlay-active=false \
--steam-bridge-smoke-keep-open-after-result=false \
--steam-bridge-smoke-result-file=/tmp/steam-bridge-smoke.log
```

Supported autorun actions are `none`, `dialog`, `friends`, `store`, `web`,
`native-dialog`, `native-store`, `native-web`, `native-probe`,
`presenter-dialog`, `presenter-store`, `presenter-web`, and
`presenter-achievement-progress`.
`native-probe` is a compatibility alias for `native-dialog`. On Linux, the
`native-*` actions open a bridge-owned X11/GLX native presenter, keep it
presenting frames, and activate the requested Steam overlay target through the
managed Steam Bridge session API. The current Deck Desktop Mode open, input,
close, and back-to-app proof is the reusable `presenter-web --web-modal true`
path below; `native-web` remains compatibility coverage. Current Deck Desktop
testing still leaves Steam's social overlay visually stuck when Electron child
overlay targets are allowed, so neither the native nor Electron-only
`dialog`/`friends` actions prove reliable Desktop Mode social-overlay dismissal
yet.

The `presenter-*` actions use `client.overlay.attachPresenter(...)` and reuse the
same passive, click-through presenter for the requested overlay target. Use
`presenter-web --web-modal true` to verify the app-facing persistent presenter
path. On Linux/X11, the presenter is transparent and click-through while fully
idle, can become visible while remaining click-through for `overlayNeedsPresent`,
restores both opacity and input while opening or showing Steam UI, and parks
transparent after Steam emits overlay inactive callbacks. The Electron overlay
helper isolates Chromium children by default so Deck Desktop proof runs have one
`gameoverlayui` process attached to the main/native process, not a duplicate GPU
overlay target. `presenter-dialog` is an investigation action: with child-process
isolation enabled, Friends/Game Overview may not render; with isolation disabled,
it may render through the Chromium hook but still fail close/back-to-app proof.
Use
`presenter-achievement-progress` to verify passive Steam notification rendering:
the action keeps the presenter transparent and click-through, calls
`achievement.indicateProgress(...)`, and records `achievement:progress` plus
`callback:achievement-stored` when Steam accepts the progress notification.

Each autorun also writes local diagnostics. Pass
`--steam-bridge-smoke-diagnostic-dir=/tmp/steam-bridge-smoke.log.diagnostics`
or set `STEAM_BRIDGE_SMOKE_DIAGNOSTIC_DIR` to choose the directory. The app
starts Electron's crash reporter with uploads disabled, stores Crashpad files
under `crash-dumps/`, and writes lifecycle JSON lines to `lifecycle.jsonl`.
The smoke snapshot includes `snapshot.app.diagnosticDir`,
`snapshot.app.lifecycleLogFile`, and `snapshot.app.crashDumpDir`.
For visual debugging, pass `--steam-bridge-smoke-keep-open-after-result` or set
`STEAM_BRIDGE_SMOKE_KEEP_OPEN_AFTER_RESULT=1` so the verifier can read a result
while the app stays open for overlay close/back-to-game checks.

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

The Linux package also includes `linux-electron-smoke.sh`. Use it on Steam Deck
or Linux x64 to print the launch options, discover the full shortcut game ID,
launch the Steam shortcut, and verify the autorun log.

```sh
cd "$HOME/steam-bridge-smoke/SteamBridgeSmoke-linux-x64"

./linux-electron-smoke.sh \
  --mode print-launch-options \
  --action dialog \
  --result-file /tmp/steam-bridge-smoke-steam-launch.log
```

From this repository, the Deck-only SSH runner can copy the packaged Linux x64
app to the Deck, keep it awake for the run, and execute the same Steam-launched
gate:

```sh
npm run steam-deck:smoke -- \
  --mode discover \
  --discover-subnet <lan-prefix>

npm run steam-deck:smoke -- \
  --host deck@<deck-host-or-ip> \
  --mode preflight

npm run steam-deck:smoke -- \
  --host deck@<deck-host-or-ip> \
  --mode game
```

Run the same command with `--mode desktop` after switching the Deck to Desktop
Mode. Game Mode defaults to the `diagnostic` overlay profile and requires the Big
Picture signal. Desktop Mode defaults to the `repaint` overlay profile,
omits the Big Picture assertion, and keeps Steam launch, overlay injection,
overlay readiness, and overlay callback checks. If preflight cannot reach SSH,
verify the Deck is awake, SSH is enabled, and the `--host` IP address is still
current; then rerun `--mode discover`.

For the current Desktop Mode visual proof of the reusable presenter path, use the
presenter web action with a modal web overlay and leave the app open after the
verifier result:

```sh
npm run steam-deck:smoke -- \
  --host deck@<deck-host-or-ip> \
  --mode desktop \
  --action presenter-web \
  --web-url https://store.steampowered.com/app/480/ \
  --web-modal true \
  --keep-open-after-result \
  --collect-diagnostics-dir /tmp/steam-bridge-deck-artifacts \
  --visual-capture-dir /tmp/steam-bridge-deck-screens
```

After the result passes, close the Steam web overlay with its in-overlay close
control. The lifecycle log should include `callback:overlay-activated` with
`active=true` followed by `active=false`, and the screenshot must return cleanly
to the running app with no black native presenter covering it. The Deck process
list should show one `gameoverlayui` process for the app, attached to the
main/native process.

For social-overlay investigation, add `--visual-close-probe` to the same Deck
Desktop command. The runner captures `overlay-open.png`, sends a Deck-side
Shift+Tab/Escape probe through `/dev/uinput` when available, captures
`after-close-probe.png`, and copies the remote result log plus diagnostics back
to the local artifact directory. Treat this as evidence collection, not a pass
condition: Friends/Game Overview is only passed once the captured pixels return
cleanly to the running app.

For passive toast proof, use the achievement-progress presenter action:

```sh
npm run steam-deck:smoke -- \
  --host deck@<deck-host-or-ip> \
  --mode desktop \
  --action presenter-achievement-progress \
  --overlay-profile repaint \
  --window-mode fullscreen \
  --keep-open-after-result \
  --result-delay-ms 1200 \
  --collect-diagnostics-dir /tmp/steam-bridge-deck-artifacts \
  --visual-capture-dir /tmp/steam-bridge-deck-screens
```

A passing screenshot shows the Steam achievement progress toast over the running
app while the presenter snapshot remains passive (`clickThrough=true`,
`transparent=true`, `overlayActive=false`). With App ID `480`, the current Deck
proof selected the public SpaceWar achievement `ACH_TRAVEL_FAR_ACCUM` displayed
as `Interstellar`.

For scripted setup, back up and upsert the non-Steam shortcut with:

```sh
npm run steam-shortcut:upsert -- \
  --shortcuts "$HOME/.local/share/Steam/userdata/<steam-user-id>/config/shortcuts.vdf" \
  --app-name "Steam Bridge Smoke" \
  --exe "$HOME/steam-bridge-smoke/run-smoke-autorun.sh" \
  --start-dir "$HOME/steam-bridge-smoke"
```

Use the numeric `userdata` folder for the Steam account currently signed in on
the Deck. The helper backs up an existing shortcut file, writes Steam's binary
shortcut format, and prints both Steam's internal shortcut app ID and the full
shortcut game ID. The host runner writes `run-smoke-autorun.sh` and
`run-smoke-autorun.env` before each Game Mode or Desktop Mode launch, so the same
Steam shortcut can run different smoke actions without editing Steam's shortcut
database every time. Launch with the printed `Launch URL` after Steam has
reloaded shortcuts. On Steam Deck, restart Steam or switch out of and back into
Game Mode after writing `shortcuts.vdf`; Game Mode can keep a stale shortcut
cache:

```sh
steam steam://rungameid/<shortcut-game-id>
```

Do not launch the internal shortcut app ID with `steam://rungameid`. Steam can
show `Game configuration unavailable` when the short app ID is used instead of
the full shortcut game ID. Do not launch `steam://rungameid/480`; `480` is the
SpaceWar test App ID used inside the running process, not the non-Steam shortcut
ID. The same dialog can appear briefly after editing `shortcuts.vdf` while Steam
is running; reload Steam, then launch the full shortcut game ID again.

After Steam has reloaded the shortcut, the packaged helper can auto-discover the
full shortcut game ID and run the Game Mode smoke check:

```sh
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

For Desktop Mode overlay checks, launch the same shortcut URL while Steam is
running in Desktop Mode. A direct shell or file-manager launch can prove Steam
Bridge initialization, but Steam overlay injection is only expected when Steam
launches the shortcut. If you choose a direct executable shortcut instead of the
wrapper, include `--steam-bridge-electron-overlay-profile=repaint` in that
shortcut's launch options before running Desktop Mode overlay checks.

Desktop Mode visual proof for the Electron-only social actions looks like
Steam's desktop overlay panels over the Electron window, such as Game
Overview/Friends and a "Back to Game" control. Those panels can remain visually
stuck after Steam has already emitted `active=false`, so do not record Desktop
Mode social-overlay close/back-to-app as passed until the pixels return cleanly
to the running app. With the default child-process isolation, those panels may
not render because Steam is prevented from hooking Electron's Chromium GPU
process. The current reusable-presenter close proof is
`--action presenter-web` with `--web-modal true`, which calls
`client.overlay.openWebOverlay(...)`, shows Steam's web overlay over the
bridge-owned native presenter, emits `active=false`, and returns to the smoke
app. The older `--action native-web` path remains as compatibility coverage for
`activateToWebPageWithNativeSession(...)`.

For longer SSH-driven checks, keep the Deck awake from SteamOS/Desktop Mode
power settings. Over SSH, `systemd-inhibit --what=sleep sleep infinity` can keep
the Deck awake while a test slice is running. The host runner starts and stops a
temporary sleep inhibitor automatically unless `--no-keep-awake` is passed.

## Overlay Signals

The important fields are:

- `Initialized`
- `Steam Running`
- `Overlay Enabled`
- `Needs Present`
- `Native Probe`
- `Native Session`
- `callback:overlay-activated`

The Friends dialog is useful as a baseline that Steamworks and overlay IPC are
alive. It is not enough to prove the browser or checkout overlay path. For web,
store, or purchase-style checks, require `callback:overlay-activated` with an
`active: true` payload by passing `--require-overlay-activated`.

On Steam Deck, `activateToStore` is the best generic proof that the smoke app can
bring Steam overlay UI over Electron. In current Game Mode smoke testing,
`activateToWebPage` to a normal Steam web page does not show a visible web
overlay or emit `active: true`. A web checkout or transaction approval flow
needs a real Steam app launch and a real configured product or transaction. Do
not use the non-Steam smoke shortcut to impersonate a private app ID for
purchase-flow proof.

If Steam initializes but overlay does not show, compare those fields between
Deck Game Mode and Deck Desktop Mode.

In autorun output, inspect `snapshot.steam.overlayEnabled`,
`snapshot.steam.overlayNeedsPresent`, `snapshot.steam.overlayDiagnostics`, and
the final `snapshot.events` list. `snapshot.launch.steamLaunch` reports whether
Steam launch environment markers were present. `snapshot.launch.overlayInjection`
reports whether the process environment includes a Steam overlay hook marker such
as `gameoverlayrenderer`.

`overlayNeedsPresent=true` is not a failure by itself. It means Steam is asking
the app to keep presenting frames for the overlay. The smoke verifier treats an
active overlay callback as stronger evidence than the raw present-needed flag.

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

For a web overlay command that must prove Steam actually activated the overlay,
also assert the active callback:

```sh
npm run example:verify-result -- \
  --file /tmp/steam-bridge-smoke.log \
  --action web \
  --require-event overlay:web \
  --require-event callback:overlay-activated \
  --require-overlay-activated
```

For purchase or `InitTxn` validation, keep this repo generic and run the
app-specific proof outside the committed examples:

1. Launch your real installed Steam app through Steam.
2. Confirm the running process reports your real app ID.
3. Trigger your checkout URL or transaction approval path from inside that app.
4. Verify the Steam modal appears in both Deck Game Mode and Desktop Mode.
5. Confirm backing out or closing the Steam surface returns focus to the app.
6. Keep private app IDs, item definitions, transaction IDs, publisher keys, and
   private URLs out of committed docs and examples.

For a Steam Deck Desktop Mode shortcut launch, omit the Big Picture assertion
but keep the Steam launch and overlay injection assertions:

```sh
npm run example:verify-result -- \
  --file /tmp/steam-bridge-smoke-steam-launch.log \
  --platform linux/x64 \
  --require-steam-deck \
  --require-overlay-ready \
  --require-steam-launch \
  --require-overlay-injection \
  --action dialog \
  --require-event overlay:dialog \
  --require-event callback:overlay-activated
```
