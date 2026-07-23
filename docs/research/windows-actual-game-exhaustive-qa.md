# Windows Actual-Game Exhaustive QA

Last updated: 2026-07-22

This is the required Windows actual-game QA pass for the standalone native D3D
host path used by FOV4. It exists so future compactions and release passes do
not shrink "manual QA" back into a single overlay open.

## Scope

This pass validates the shipped/registry-backed FOV4 integration with
`steam-bridge@0.3.8` or later. It does not validate retired attached presenters.
Windows `WS_CHILD`, owned-popup, and unparented popup approaches are closed
paths and must not be revived during this QA.

Use the actual game consumer, not the smoke app, for this pass:

- FOV4 repo: `C:\Users\admin\source\fov4-steam`
- Launch command: `npm run dev`
- Required env:
  - `STEAM_BRIDGE_QA_OVERLAY=1`
  - `STEAM_BRIDGE_FPS_REPORT=1`
  - `STEAM_BRIDGE_DEBUG_OVERLAY_SNAPSHOT=1`

The QA overlay entrypoint must be the opt-in native View menu item that opens
the ordinary Friends overlay via `activateDialog("Friends")`. A physical
Shift+Tab is not recurring QA input unless shortcut routing itself changed.
Never authorize purchase, checkout, subscription, or payment flows during this
pass.

## Preconditions

- Steam is running only on the Windows target machine.
- Steam, `steamwebhelper`, and `gameoverlayui` are force-closed on every other
  platform before live overlay testing.
- Chromium DevTools are closed.
- The app uses the registry package unless the pass is explicitly testing a
  local unpublished Steam Bridge fix.
- The app starts at a normal desktop window size, preferably `1280x720`, with
  minimum client size `640x480`.

## Matrix

Run the actual game through each display state below. Restore the user's
preferred Windows display settings when the pass finishes.

| Case | Windows display state | Required checks |
| --- | --- | --- |
| Baseline | Current resolution, current scale, current refresh rate | Launch, menus, title drag, fast drag, edge resize, corner resize, exact minimum, maximize/restore, minimize/restore, fullscreen/restore, focus loss/return, Friends overlay open/close, clean close |
| High refresh | Highest available refresh rate at current resolution | Same as baseline, with FPS target matching display Hz |
| 60 Hz fallback | 60 Hz at current resolution | Same as baseline, with FPS target near 60 |
| Scale change | At least one non-100% scale and one lower scale when available | Launch or relaunch after the scale change, verify menu size, client size, rounded corners, input mapping, overlay alignment, and no black/purple/tiny surface |
| Resolution change | At least one lower desktop resolution and the preferred resolution | Relaunch or restore after the change, verify initial clamp to work area, resize behavior, overlay alignment, and FPS target |

If the Windows settings UI offers a "Keep changes" confirmation, accept it
only for the intentionally selected test state and restore the original state
before finishing.

## Manual Interaction Checklist

For each applicable display state:

- Launch the actual game and wait for the native host to become interactive.
- Confirm default logical client size is sane, usually `1280x720`.
- Confirm File/Edit/View menu text is readable and clickable.
- Confirm the opt-in Friends overlay QA menu item exists only with
  `STEAM_BRIDGE_QA_OVERLAY=1`.
- Drag the title bar slowly and quickly across the desktop.
- Resize from right, bottom, and bottom-right edges.
- Resize quickly and aggressively enough to stress `WM_SIZE` and modal resize
  behavior.
- Confirm the client cannot resize below `640x480`.
- Maximize and restore.
- Minimize and restore.
- Toggle fullscreen and restore.
- Alt+Tab or otherwise move focus away and back.
- Confirm rounded bottom corners in restored windowed mode.
- Confirm the Windows cursor is hidden over the game surface while gameplay is
  active and restored outside/focus-lost states.
- Open the ordinary Friends overlay from the native QA menu.
- While the overlay is visible, confirm it is bounded to the game client, not
  the title bar or desktop chrome.
- While the overlay is visible, confirm there is no right/bottom seam, tiny
  top-left Steam surface, black/purple startup surface, flicker during steady
  state, retained stale pixels, hang, or crash.
- Close the overlay with Escape and confirm focus returns to the game.
- Cleanly close the app and confirm there are no leftover `gameoverlayui`
  targets for the app process.

## Telemetry Requirements

Collect `[steam-native-host-fps]` samples from the game log. For each display
state, record:

- Windows resolution, scale percentage, and refresh rate.
- Electron display `displayFrequency`.
- Native host target FPS.
- Median game paint FPS from at least three ordinary-game samples.
- Median game native-present FPS from at least three ordinary-game samples.
- Median overlay native-present FPS from at least three Steam-overlay-active
  samples.
- Frame-latency wait timeout count.
- Slow shared-texture copy count.
- Device loss and recovery counts.
- Any stderr, crash, or Steam client instability.

Passing pacing means ordinary game and overlay native-present medians are at
least 95% of the active display refresh rate, excluding clearly bounded
transition samples such as minimize/restore, resolution switch, or modal-menu
loops. Transition exclusions must be called out in the receipt.

## Receipt Template

Create an artifact directory named like:

`C:\Users\admin\steam-bridge-artifacts\fov-windows-exhaustive-qa-YYYYMMDD-HHMMSS`

Include:

- raw combined `npm run dev` log
- extracted FPS samples as JSONL
- summary JSON with matrix results
- screenshots when a visual issue is suspected
- notes for every transition that was exercised

Append a dated result summary to this file and to `current-work.md` before a
release decision.

## 2026-07-22 actual FOV4 Windows pass

Artifact root:
`C:\Users\admin\steam-bridge-artifacts\fov-windows-exhaustive-qa-20260722-205311`

Command:

- `STEAM_BRIDGE_QA_OVERLAY=1`
- `STEAM_BRIDGE_FPS_REPORT=1`
- `STEAM_BRIDGE_DEBUG_OVERLAY_SNAPSHOT=1`
- `npm.cmd run dev`

Static consumer gates passed before manual QA:

- `npm.cmd test`: 16/16 passing
- `npm.cmd run lint`: passing
- `npm.cmd run typecheck`: passing

Manual matrix covered against the actual `Fantasy Online 2` game window, not
the smoke app:

- baseline launch at 225% Windows scale and 60 Hz;
- File/Edit/View menu clickability and opt-in Friends overlay QA menu item;
- fast title-bar drag without hang/crash;
- native resize sweeps through normal, large, small, and exact minimum sizes;
- exact minimum clamp to `640x480` logical client;
- maximize/restore;
- minimize/restore;
- fullscreen/restore with `F11`;
- focus loss/return;
- 165 Hz high-refresh mode;
- 100% scale mode caused by the 165 Hz display-mode switch;
- `1280x800` low-resolution mode;
- 60 Hz restore path;
- high-DPI restore path. Windows no longer exposed 225% after the display-mode
  switch, so the pass restored the nearest normal UI option, 200%, and did not
  enter custom scaling/sign-out flows.

Visual results:

- The Steam overlay stayed bounded to the game client at 60 Hz/minimum size,
  165 Hz/default size, and 165 Hz/low-resolution size.
- It did not cover the title bar or File/Edit/View menu.
- No purple startup surface, tiny top-left Steam surface, full-chrome overlay,
  right/bottom seam, steady-state flicker, hang, crash, or Steam client crash
  was observed in the covered states.
- The Windows 11 Snap Layout panel can appear when hovering the maximize button;
  this is OS chrome, not a Steam modal.
- Computer Use could not reliably grab the high-DPI resize border because the
  effective resize frame sits outside the captured window-relative pixels.
  Native `SetWindowPos` resize sweeps were used to exercise real `WM_SIZE` and
  host resizing instead. Do not record that automation limitation as a product
  failure.

Telemetry receipts:

- Raw log: `npm-run-dev.out.log`
- Extracted samples: `fps-samples.jsonl`
- Summary: `summary.json`
- Parsed FPS samples: 1,075
- Run-wide device loss/recovery: `0 / 0`
- Run-wide transition counters after all abuse: frame-latency wait timeouts
  `4`, slow shared-texture copies `9`, storage recreates `20`

Representative medians:

| Phase | Display state | Logical client | Native-present median | Result |
| --- | --- | --- | --- | --- |
| game | 60 Hz, 225% scale | `1280x720` | `59.9 FPS` | Pass |
| overlay | 60 Hz, 225% scale, minimum window | `640x480` | `59.9 FPS` | Pass |
| game | 165 Hz, 100% scale | `1280x720` | `161.1 FPS` | Pass after excluding transition samples |
| game | 165 Hz, 100% scale, low resolution | `1234x681` | `164.7 FPS` | Pass |
| overlay | 165 Hz, 100% scale | `1280x720` | `133.0 FPS` | Initial performance finding |
| overlay | 165 Hz, 100% scale, low resolution | `1234x681` | `130.6 FPS` | Initial performance finding |
| game | restored 60 Hz, 200% scale | `963x561` | `59.9 FPS` | Pass |

Focused repair retest:

- Artifact root:
  `C:\Users\admin\steam-bridge-artifacts\fov-windows-overlay-165-focused-20260722-212404`
- Local unpublished Steam Bridge source was linked into FOV4.
- The Windows display was switched from `1920x1200@60` to `1920x1200@165`
  for this targeted retest and restored to `1920x1200@60` afterward.
- The real FOV4 game launched with `STEAM_BRIDGE_QA_OVERLAY=1`,
  `STEAM_BRIDGE_FPS_REPORT=1`, and
  `STEAM_BRIDGE_DEBUG_OVERLAY_SNAPSHOT=1`.
- The View menu opened the ordinary Friends overlay through the opt-in QA
  command. The overlay was visually bounded to the game client and did not
  cover the title bar or File/Edit/View menu.
- 48 Steam-overlay-active 165 Hz samples were collected. Median overlay native
  present was `163.75 FPS` against the `156.75 FPS` 95% pass threshold; median
  overlay session pump was also `163.75 FPS`.
- The game closed cleanly, no FOV/Electron process remained, and stderr was
  empty.

Result: the initial 165 Hz overlay pacing finding is green for the focused
scenario. Do not rerun the whole Windows manual matrix because of this fix
alone; keep using targeted retests for any new breakage, and run the full
exhaustive Windows actual-game pass only after all individual findings are
green.

## 2026-07-22 final Windows actual-game QA rerun

Artifact root:
`C:\Users\admin\steam-bridge-artifacts\fov-windows-exhaustive-qa-final-20260722-2230`

Result: green. This pass was run only after the individually failing 165 Hz
overlay and 165 Hz game-surface pacing scenarios were fixed with focused
retests.

Manual matrix covered against the actual FOV4 game:

- actual-game launch, character selection, and entry into the world;
- normal Steam overlay toast on startup;
- File/Edit/View menu click sweep;
- title-bar drag and fast drag;
- edge/corner resize and minimum-size clamp;
- maximize/restore;
- fullscreen/restore;
- focus away/back through Windows Settings;
- baseline Friends overlay open/close at `1920x1200@60`, `200%` scale;
- live display switch from 60 Hz to 165 Hz, with high-refresh game hold and
  high-refresh overlay open/close;
- live switch to `1280x800@60` low-resolution mode with overlay open/close;
- restore to `1920x1200@60`;
- live scale switch from `200%` to `100%` with overlay open/close;
- restore to `200%` scale;
- clean close through File -> Exit.

Visual results:

- overlays stayed bounded to the game client and did not cover native chrome;
- no right/bottom seam was visible;
- no tiny top-left Steam surface appeared;
- no purple/full-window startup regression was observed beyond normal Steam UI;
- menus were clickable and scaled correctly;
- the game surface kept the expected aspect instead of stretching/squashing;
- Escape reliably closed the overlay in shifted, low-resolution, and
  `100%`-scale layouts without relying on fragile coordinates;
- no Electron process remained after close;
- `npm-run-dev.stderr.log` was empty;
- Windows display settings were restored to `1920x1200@60` and `200%` scale.

Representative telemetry from `npm-run-dev.stdout.log`:

| Phase | Display state | Samples | Native-present median | Threshold | Result |
| --- | --- | ---: | ---: | ---: | --- |
| overlay | 60 Hz, 200% scale | 9 | `59.9 FPS` | `57.0 FPS` | Pass |
| overlay | 165 Hz, 200% scale | 24 | `162.65 FPS` | `156.75 FPS` | Pass |
| game steady-state | 165 Hz, 200% scale | 28 | `157.55 FPS` | `156.75 FPS` | Pass |
| overlay | 60 Hz, low resolution | 10 | `59.9 FPS` | `57.0 FPS` | Pass |
| overlay | 60 Hz, 100% scale | 10 | `59.9 FPS` | `57.0 FPS` | Pass |

High-refresh game-surface scoring uses steady-state windows after the display
mode has settled and outside overlay open/close boundaries. The all-sample
165 Hz game median included live display-switch and overlay-transition samples,
so it is retained as diagnostic data rather than the pass/fail metric.

Implementation fixes validated by this pass:

- Steam Bridge Windows standalone display-synchronized pumping now schedules
  immediate work and relies on DXGI/Steam frame-latency gating instead of
  layering Windows timer jitter onto hooked `Present`.
- FOV4 reasserts the hidden renderer display and `webContents.setFrameRate()`
  after display/FPS changes, including delayed refresh pulses after live
  mode/scale transitions.

Operational rule going forward: when a QA item is red, fix and focused-retest
only that item until it is green. Do not spend another cycle rerunning the
entire Windows actual-game matrix after each local change. The full exhaustive
Windows pass is the final confirmation step after all known individual
failures are green.
