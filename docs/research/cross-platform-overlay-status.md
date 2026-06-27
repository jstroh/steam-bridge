# Linux and Steam Deck Overlay Status

Last updated: 2026-06-27

This tracks the current runtime evidence for the Electron smoke app on Linux x64
and Steam Deck. The public smoke target is Valve's SpaceWar App ID `480`.

## Current Evidence

| Target | Status | Evidence |
| --- | --- | --- |
| Linux x64 | Verified through Steam Deck | The packaged Linux x64 smoke app launches on Steam Deck and initializes Steam as App ID `480`. The Linux package includes `linux-electron-smoke.sh` for direct, Steam-launched, and verification checks. A Deck-side `ldd -r` check of the packaged native binding did not report unresolved `steam_bridge_music_remote_*` symbols. |
| Steam Deck Game Mode | Verified for smoke coverage | A Steam-launched non-Steam shortcut reports `steamDeck=true`, `bigPicture=true`, `steamLaunch=true`, `overlayInjection=true`, `overlayEnabled=true`, and can emit overlay events. |
| Steam Deck Desktop Mode | Verified for smoke coverage | The same packaged app can be launched from Desktop Mode with `steamDeck=true`, `bigPicture=false`, `steamLaunch=true`, `overlayInjection=true`, and `overlayEnabled=true`. Desktop Mode uses the Electron `repaint` overlay profile by default. |
| Desktop Mode Electron-only overlay | Partial | The Electron-only `friends` action can activate visible Steam overlay UI and emit `callback:overlay-activated` with `active=true`, but Shift+Tab, overlay X, and Back to Game did not reliably dismiss the overlay while the app stayed open. Treat it as callback/render evidence, not full input proof. |
| Desktop Mode reusable native presenter web overlay | Verified for open, close, input, and back-to-app | The `presenter-web --web-modal true` action calls `client.overlay.attachPresenter(...)` and `client.overlay.openWebOverlay(...)` with the reusable X11/GLX presenter. Deck Desktop testing showed the modal Steam web overlay, emitted paired `active=true` and `active=false` callbacks, returned to the running Electron app, left no crash dumps, and used a single `gameoverlayui` process attached to the main/native process. `electronConfigureSteamOverlay()` now scrubs Steam overlay preload entries for Electron children and adds Linux `no-zygote` isolation by default so Chromium GPU/renderer children do not become competing overlay targets. |
| Desktop Mode reusable native presenter passive toast | Verified | The `presenter-achievement-progress` action attaches the reusable presenter, keeps it passive/click-through/transparent, calls `achievement.indicateProgress(...)` against public App ID `480`, receives `callback:achievement-stored`, and captures the Steam achievement progress toast over the running Electron app. The host remains passive, uses a single overlay target, and does not require `GameOverlayActivated`. |
| Desktop Mode overlay hotkey/toggle | Open blocker | A Deck Desktop `--visual-toggle-probe` run after the passive presenter toast proof sent Shift+Tab through the Deck-side input probe. The screenshots stayed in the Electron app and no `GameOverlayActivated` callback was emitted. Treat Steam overlay hotkey/social toggling as unresolved; do not expose a standalone presenter "ready" action that makes the native host opaque without an actual overlay API call. |
| Desktop Mode reusable native presenter social overlay | Open blocker; not a product proof | With default Electron child-process isolation, `presenter-dialog` calls `ActivateGameOverlay("Friends")` but does not render the Friends/Game Overview overlay or emit `callback:overlay-activated` on Deck Desktop Mode. A focused/raised X11 host experiment on 2026-06-27 still produced no visible social overlay and no activation callback with a single `gameoverlayui` target, so focus handoff is not a useful workaround. Without isolation, Steam can hook Electron's GPU process and render social UI, but that duplicate hook can leave stale overlay surfaces after close. Treat Friends/Game Overview as an unresolved social-overlay investigation path, not as a checkout/product overlay requirement. |
| Desktop Mode managed native web session | Compatibility coverage | The `native-web` action with `--web-modal true` calls `activateToWebPageWithNativeSession(...)`, opens a bridge-owned X11/GLX native presenter, keeps it presenting frames, and exercises the older managed-session API. Prefer the reusable `presenter-web --web-modal true` path for current Deck Desktop open/close proof because it also isolates Electron child overlay targets. |
| Desktop Mode managed native social session | Open blocker | The `native-dialog` action calls `activateDialogWithNativeSession("Friends")`, but Deck Desktop social behavior is not a product proof. With child-process isolation enabled the social overlay may not render; with isolation disabled it can render through Electron's Chromium hook but can leave stale overlay surfaces after close. Treat social close/back-to-app as unresolved. |
| Store overlay | Verified from the smoke app | `ActivateGameOverlayToStore` can activate the Steam overlay from the Deck smoke shortcut and produce `callback:overlay-activated` with `active=true`. |
| General web-page overlay | Not working from the Deck Game Mode smoke shortcut | `ActivateGameOverlayToWebPage` to a normal Steam web page was called successfully, but did not show a visible web overlay or produce `active=true`. |
| Desktop web-page overlay | Verified through the reusable presenter | With the Desktop overlay profile and reusable presenter, `openWebOverlay(..., { modal: true })` to the public SpaceWar store page produced visible Steam web overlay UI, `active=true`, `active=false` after the overlay close control, and a clean return to the smoke app. |
| Web checkout overlay | Requires a real app/product proof | A non-Steam shortcut is not enough to prove checkout or transaction overlay behavior. Use a real Steam-launched app ID with a configured product or transaction. |

## Steam Deck Shortcut Gate

Steam Deck smoke testing uses the packaged Linux x64 app with SpaceWar App ID
`480` inside the process. The Steam launch URL must use the full non-Steam
shortcut game ID printed by the helper, not `480` and not Steam's internal
32-bit shortcut app ID. Launching the wrong ID can show Steam's `Game
configuration unavailable` dialog.

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

The repository also includes a Deck-only host runner for SSH-driven checks. It
copies the Linux x64 package to the Deck, writes `SteamAppId`, `SteamGameId`,
and `SteamOverlayGameId` into the Steam shortcut wrapper, starts a temporary
sleep inhibitor, and runs the packaged helper:

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

Use `--mode desktop` for the Steam Deck Desktop Mode shortcut check. Discovery
finds SSH candidates when the Deck address changes; preflight separates a
network/SSH blocker from package, Steam command, and shortcut setup problems.
The host runner writes a wrapper script and env file before each Steam launch so
the shortcut can switch between Game Mode diagnostic checks and Desktop Mode
repaint checks without rewriting `shortcuts.vdf`.

## Overlay Proof Matrix

Use the smoke app to prove generic overlay plumbing, then use a real Steam app
to prove checkout or transaction behavior:

| API path | Smoke app expectation | What it proves |
| --- | --- | --- |
| `activateDialog("Friends")` | May show the Friends panel and emit an overlay callback when Electron child-process isolation is disabled. | Steamworks initialized, callbacks are flowing, and the overlay IPC path is alive. This is not a product overlay proof. |
| `activateDialogWithNativeSession("Friends")` | Social/Friends remains unresolved. With Electron child-process isolation enabled, the Desktop social overlay may not render; with isolation disabled, duplicate Chromium hooks can render it but leave stale surfaces after close. | Steam Bridge can own the native presenter lifecycle, but Desktop Mode social-overlay close/render behavior remains a blocker. |
| `activateToStoreWithNativeSession(480, ...)` | Should open the bridge-owned native presenter and activate the Steam store overlay path. | The managed presenter lifecycle is reusable across non-dialog overlay entry points. |
| `client.overlay.openWebOverlay("https://store.steampowered.com/app/480/", { modal: true, presenter })` | Reuses one attached presenter, shows Steam's web overlay in Deck Desktop Mode, isolates Electron child processes so only the main/native process is an overlay target, emits `active=false`, and returns cleanly to the smoke app. | The current generic Deck Desktop Mode proof for the app-facing reusable presenter API and checkout-style overlays. |
| `presenter-achievement-progress` | Reuses one attached passive presenter, calls `achievement.indicateProgress(...)`, and captures a visible Steam achievement-progress toast over the app with a single overlay target. | Passive notification/toast behavior works without making the native host interactive or requiring a modal overlay activation callback. |
| `activateToWebPageWithNativeSession("https://store.steampowered.com/app/480/", { modal: true, ... })` | Opens the bridge-owned native presenter and exercises the older managed-session API. | Compatibility coverage; prefer `presenter-web --web-modal true` for the current Deck Desktop open/close proof. |
| `activateToStore(480, ...)` | Should activate the Steam overlay and emit `active=true` from a Steam-launched Deck shortcut. | The Deck/Electron/Steam launch path can display Steam overlay UI. |
| `activateToWebPage("https://store.steampowered.com/app/480/", ...)` | Currently does not activate a visible web overlay from the Deck Game Mode smoke shortcut, but passes from Desktop Mode with the Desktop overlay profile. | The web-page API call was issued; it does not prove purchase UI unless Steam activates the overlay. |
| `activateToWebPage(<checkout-or-approval-url>, { modal: true })` | Must be run from the actual Steam app with the matching App ID and a configured product or transaction. | Purchase or transaction overlay behavior. |
| Web API `InitTxn` flow | Requires your own backend or publisher credentials. | End-to-end transaction overlay behavior for your app. Deck Game Mode and Desktop Mode should both be validated from the real Steam app, not from the public smoke shortcut. |

Important Deck finding: a non-Steam shortcut can initialize Steamworks with
App ID `480` and can prove the store overlay, but it should not be used to
impersonate another app for purchase-flow proof. For checkout testing, launch
the actual installed Steam app with `steam://rungameid/<your-app-id>` or through
Steam's UI, then trigger the checkout or approval overlay from inside that app's
renderer/main process.

## Verification Signals

The verifier can require an active overlay callback:

```sh
npm run example:verify-result -- \
  --file /tmp/steam-bridge-smoke.log \
  --action store \
  --require-event overlay:store \
  --require-event callback:overlay-activated \
  --require-overlay-activated
```

The callback payload can be either flat or nested, depending on the native
callback binding shape:

```json
{ "active": true }
```

```json
{ "0": { "active": true } }
```

Both shapes are handled by the smoke app and verifier. For visual Deck testing,
a checkout pass means the modal Steam surface appears over the game, and backing
out returns to the running app.

In Deck Desktop Mode, touch, keyboard, and overlay dismissal behavior can differ
from Game Mode. Record the pass only after the Steam surface appears and the
running app regains focus after backing out or closing the surface. The current
generic visual pass is the reusable presenter `--action presenter-web
--web-modal true` path. The Electron overlay helper scrubs Steam overlay preload
entries for child processes and adds Linux `no-zygote` isolation by default; the
expected Deck process list has one `gameoverlayui` attached to the main/native
process, not a second one attached to Electron's GPU process. The older managed
native `--action native-web --web-modal true` path remains compatibility
coverage.

The Electron-only and managed native social paths can show Steam's desktop
overlay panels over the Electron window when child-process isolation is disabled,
such as Game Overview/Friends with a "Back to Game" affordance, but those panels
do not currently prove input dismissal on Deck Desktop Mode because the close
capture can still show the social overlay after Steam has already emitted a
matching `active=false` callback. With default child-process isolation enabled,
`presenter-dialog` is expected to remain an investigation path and may not render
the social overlay. A Deck Desktop run that temporarily focused and raised the
X11 presenter immediately before `ActivateGameOverlay("Friends")` still captured
only the Electron smoke app and emitted no `GameOverlayActivated` callback, so
the presenter should remain non-focusable for the product path.

The Deck host runner also has `--visual-toggle-probe` for hotkey evidence. It
captures the app before the probe, sends Shift+Tab, captures again, then sends
the close probe and captures the return state. The latest passive-presenter
Desktop run used this after `presenter-achievement-progress`: the toast proof
passed, but Shift+Tab only focused/scrolled the Electron app and did not open
Steam overlay UI. That is evidence for the current hotkey blocker, not a pass.

`overlayNeedsPresent=true` is not a hard failure by itself. It means Steam is
asking an event-driven renderer to keep presenting frames for the overlay. The
Electron `repaint` profile keeps invalidating the window at about 30 FPS without
forcing Chromium's GPU work in-process, and the verifier accepts an active
overlay callback as the stronger pass signal. Use the stronger `compatibility`
profile only when the repaint profile is not enough.

For Deck Desktop Mode visual testing, the Linux native probe must keep pumping
after the smoke result is written. Without continuing GLX presents, Steam may
report activation but later overlay interactions can become visually inert.
Keeping the presenter alive is necessary for the web modal proof. The reusable
presenter path switches to an input-capable, opaque active mode before opening
Steam web/store/checkout UI and returns to a click-through, transparent idle
mode after Steam reports overlay inactive, even if `overlayNeedsPresent` lingers
briefly. Dialog/social overlays are not part of the current product pass
criteria. `overlayNeedsPresent` can keep the host visible while input remains
click-through for passive notifications.

For repeatable Deck Desktop evidence, run the host helper with artifact
collection:

```sh
npm run steam-deck:smoke -- \
  --host deck@<deck-host-or-ip> \
  --mode desktop \
  --action presenter-dialog \
  --overlay-profile repaint \
  --window-mode fullscreen \
  --keep-open-after-result \
  --collect-diagnostics-dir /tmp/steam-bridge-deck-artifacts \
  --visual-capture-dir /tmp/steam-bridge-deck-screens \
  --visual-close-probe
```

The helper copies the remote result log and diagnostics directory locally,
captures `overlay-open.png`, sends a Deck-side Shift+Tab/Escape close probe, and
captures `after-close-probe.png`. These screenshots are evidence for the current
social-overlay investigation; they are not a passing assertion unless the first
capture visibly shows Steam social UI and the second capture visibly returns to
the running app.

Use `--visual-toggle-probe` when the question is whether Shift+Tab opens the
overlay from the current app state. It captures `before-toggle-probe.png`,
`after-toggle-open.png`, and `after-toggle-close.png` in addition to the normal
`overlay-open.png`.

For passive toast proof, run:

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

A passing capture shows the Steam achievement-progress toast over the running
Electron app while the lifecycle log includes `achievement:progress`,
`callback:achievement-stored`, and a passive presenter snapshot
(`clickThrough=true`, `transparent=true`, `overlayActive=false`). The current
Deck proof selected SpaceWar achievement `ACH_TRAVEL_FAR_ACCUM` displayed as
`Interstellar`, reported `indicated=true`, and captured the toast over the app.

## Purchase Overlay Checklist

Use this checklist for app-specific purchase validation without committing
private app details to this repository:

1. Install the real Steam app on the Deck.
2. Launch it through Steam, not through the generic smoke shortcut.
3. Confirm `utils.getAppId()` reports your real app ID.
4. Trigger `activateToWebPage(<checkout-or-approval-url>, { modal: true })` or
   the app's real `InitTxn` approval path from inside the running app.
5. Verify the Steam checkout or approval surface appears.
6. Press Back to confirm Steam returns to the running app.
7. Keep private app IDs, item definitions, transaction IDs, publisher keys, and
   private URLs out of committed docs, tests, and examples.
