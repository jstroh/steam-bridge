# Cross-platform Actual-game Exhaustive QA

Last updated: 2026-07-28

This is the release-grade manual verification contract for a real game using
Steam Bridge. It complements the API/route matrices; it does not multiply every
Steam route by every window state. Each platform runs the same product-behavior
core plus a strict platform adapter, using the exact packaged candidate and the
actual game renderer.

## Operating rules

- Run Steam on only the target platform. Stop Steam on every other test host.
- Close Chromium DevTools. Recording is a separate stress case, not baseline
  performance evidence.
- Use an exact candidate identity. Record source commit, package version,
  package/archive hashes, app executable hash, native addon hash, Electron
  version, architecture, and sanitized Steam client version.
- Public plumbing may use App ID `480`. Actual-game proof uses the consumer's
  configured app identity, but retained artifacts must redact private app,
  account, order, transaction, auth-ticket, and local-user identifiers.
- Never authorize a purchase or subscription. Opening and cancelling a surface
  is allowed only when that route is explicitly in scope.
- Automation must target the exact app PID/window, verify state before input,
  and always release synthetic keys and mouse buttons during cleanup.
- A failing case gets a focused fix and focused retest. Do not rerun the full
  suite after each edit. Run one complete suite only when all individual cases
  are green and immediately before the release decision.
- Preserve failed roots as diagnostic evidence. A passing receipt may contain
  only one unchanged candidate, one continuous Steam identity, and one clean
  run.
- Restore the user's exact original display configuration even after a failed
  case. Prefer lifetime-scoped OS transactions and a separate restore guard to
  permanent display mutation.
- Lock-capable display-sleep and system-sleep automation is permanently retired
  on macOS because it can invoke the security lock screen. Preflight must reject
  an already locked/asleep host, but QA and release must never induce sleep,
  wake, or lock. Historical receipts remain diagnostic-only evidence.

## Result vocabulary

Every case is exactly one of:

- `pass`: all mandatory assertions and evidence are present;
- `fail`: a product, harness, cleanup, or evidence assertion failed;
- `not-applicable`: the capability is genuinely absent and the adapter permits
  omission, with the detected reason recorded;
- `blocked`: the host cannot execute a required case. A required `blocked` case
  rejects a release receipt.

"Looked okay" is not a result. Visual cases require a screenshot sequence,
short capture, or an explicit inspected-frame record tied to the case and exact
window rectangle.

## Shared core matrix

The platform adapter may split a row into narrower cases, but it may not remove
a required behavior.

| ID | Scenario | Required proof |
| --- | --- | --- |
| `CORE-PREFLIGHT-IDENTITY` | Exact candidate and actual game | Candidate hashes, package provenance, app/native architecture, versions, no source/runtime mutation during the run |
| `CORE-PREFLIGHT-STEAM` | One healthy Steam session | Target Steam ready and signed in, overlay permitted, other platform sessions stopped, no stale target process |
| `CORE-PREFLIGHT-DISPLAY` | Snapshot original desktop | Complete output topology, logical/pixel dimensions, work area, scale, refresh, rotation/mirroring, focused app, pointer position |
| `CORE-LAUNCH-COLD` | Cold Steam launch | Actual game reaches playable renderer; expected app/host/overlay-target counts; no tiny, purple, black, or desktop-sized transient surface |
| `CORE-LAUNCH-WARM` | Warm relaunch | Same identity and geometry, no stale host/process reuse, no additional crash report |
| `CORE-BASE-GEOMETRY` | Default restored window | Sane default content size, outer/content/host alignment, work-area containment, expected chrome and corners |
| `CORE-BASE-ASPECT` | Game aspect and canvas | CSS viewport, canvas CSS/backing size, DPR, presentation rectangle, no squash/crop/unintended bars |
| `CORE-BASE-MENU` | Native/application menus | Expected labels readable, mouse and keyboard access work, actions route once, no Steam surface covers menu/chrome |
| `CORE-BASE-INPUT` | Game keyboard/mouse/cursor | Native input reaches game, Escape behavior is correct, cursor hidden over live game and restored where expected |
| `CORE-MOVE-SLOW` | Genuine slow title drag | Manual move event, continuously changing window/host geometry, same host/process, no drift or flicker |
| `CORE-MOVE-FAST` | Genuine fast title drag | Large rapid displacement, final exact alignment, no hang/crash/stale frame |
| `CORE-MOVE-REVERSE` | Direction-reversing drag | Several reversals in one held drag, one continuous host, no delayed snap or wrong final bounds |
| `CORE-RESIZE-RIGHT` | Genuine right-edge resize | Manual resize event, live content/host updates, aspect policy preserved |
| `CORE-RESIZE-BOTTOM` | Genuine bottom-edge resize | Same assertions for vertical sizing |
| `CORE-RESIZE-CORNER` | Genuine corner resize | Both dimensions change, exact final alignment and input mapping |
| `CORE-RESIZE-RAPID` | Rapid reversing resize | Repeated grow/shrink reversals, no recreate/remap unless the architecture explicitly requires it, no black/stale frame or crash |
| `CORE-RESIZE-MINIMUM` | Resize below declared minimum | Clamp is exactly the consumer's logical minimum (normally `640x480` content), including platform chrome; cannot be bypassed on either axis |
| `CORE-RESIZE-RESTORE` | Return to default size | Exact logical size/aspect restored with no cumulative rounding drift |
| `CORE-STATE-MAXIMIZE` | Maximize/fill and restore | Work-area geometry is correct and normal bounds restore exactly |
| `CORE-STATE-MINIMIZE` | Minimize and restore | Renderer/presenter throttles as designed, no tiny sentinel geometry, focus/input/steady cadence recover |
| `CORE-STATE-FULLSCREEN` | Product fullscreen and restore | Correct display bounds/content/aspect, no chrome or seam, exact normal bounds restore |
| `CORE-FOCUS-SWITCH` | Switch to another app and back | Activation/occlusion callbacks, no purple/tiny/parked visible host, focus/input/cursor recover |
| `CORE-OVERLAY-OPEN` | Ordinary Friends overlay | Enabled/readiness handshake, active callback, one target, visible Steam pixels bounded to game content |
| `CORE-OVERLAY-DUPLICATE` | Repeated open requests | One surface/target; duplicate request rejected or coalesced; one close returns to game |
| `CORE-OVERLAY-CLOSE` | Close with native Escape | Inactive callback, parked presenter, focus/game/cursor recovery, no stale Steam pixels |
| `CORE-ACTIVE-MOVE` | Attempt move while overlay active | Either the platform-supported drag stays aligned throughout, or the adapter proves an owned native modal constraint, unchanged bounds, and immediate post-close drag recovery |
| `CORE-ACTIVE-RESIZE` | Attempt resize while overlay active | Either the supported resize sequence stays aligned, or the adapter proves an owned native modal constraint, unchanged bounds, and immediate post-close resize recovery |
| `CORE-ACTIVE-MAXIMIZE` | Attempt maximize/restore while active | Either the state transition preserves active geometry and normal bounds, or the adapter proves modal suppression and post-close command recovery |
| `CORE-ACTIVE-MINIMIZE` | Attempt minimize/restore while active | Either the transition preserves lifecycle with no orphan/stale frame, or the adapter proves modal suppression and post-close command recovery |
| `CORE-ACTIVE-FULLSCREEN` | Attempt product fullscreen while active | Either the overlay follows the supported fullscreen lane and restores exactly, or the adapter proves modal suppression and post-close fullscreen recovery |
| `CORE-ACTIVE-FOCUS` | Focus/occlusion round trip while active | No purple/tiny replacement, hidden orphan, or focus theft; close returns to game |
| `CORE-DISPLAY-LIVE` | Change display mode with app alive | Correct display/scale/refresh detection, window clamp/recovery, exact host alignment, no crash |
| `CORE-PACING-BASELINE` | Visible focused game | At least three settled samples; renderer and native presentation compared with authoritative display cadence |
| `CORE-PACING-ACTIVE` | Visible overlay | At least three settled samples; native presentation remains at least 95% of fixed target unless the adapter defines an adaptive-range rule |
| `CORE-PACING-POSTCLOSE` | Settled game after close | At least three settled samples; renderer/native cadence and input recover |
| `CORE-CLEAN-EXIT` | App-requested shutdown | Overlay closed, app and target processes gone, empty unexpected stderr, no new crash reports |
| `CORE-CLEAN-DISPLAY` | Restore desktop | Exact original topology/mode/scale/refresh/focus/pointer restored and independently verified |

For active stress cases, capture several frames during the transition rather
than only before and after. A correct final rectangle does not disprove drag or
resize flicker. A platform modal disposition does not remove the case: its
receipt must prove the native owner/capture, unchanged host identity and bounds,
stable presentation during the attempted command, and immediate recovery after
overlay close.

## Display-profile selection

First enumerate the modes the OS marks safe for desktop GUI use. Run the deep
shared matrix on representative profiles, then a lighter launch/window/overlay/
pacing/cleanup smoke over every distinct safe logical-size, pixel-size,
scale-factor, and fixed-refresh class.

Required representative profiles when exposed by the host:

1. the exact original/preferred profile at maximum/adaptive refresh;
2. the same logical and pixel mode at fixed 60 Hz;
3. a lower useful logical resolution at 60 Hz;
4. the largest useful scaled/more-space profile;
5. a profile that changes backing scale/DPI without changing the physical
   panel, when the OS exposes one;
6. each additional distinct fixed refresh class (for example 48, 50, 59.94,
   60, and 120) in the light mode sweep;
7. each attached display and a mixed-DPI/mixed-refresh boundary crossing when
   multiple displays exist.

Mode aliases that differ only by an insignificant fractional refresh may share
the deep matrix, but the receipt must retain the raw values and show which mode
was selected.

## Pacing rules

Record three independent clocks when the platform exposes them:

1. authoritative OS display mode/cadence;
2. Electron display frequency plus renderer `requestAnimationFrame` intervals;
3. native host draw/present or compositor-bound counters.

Each scored phase has a warmup and at least three independent steady samples.
Retain raw timestamps, FPS, p50/p95/p99 intervals, configured target, focused/
visible/occluded state, overlay-active state, geometry, and relevant native
counters. Do not score samples that cross a mode switch, minimize/restore,
fullscreen transition, menu modal loop, overlay open/close boundary, or world
loading boundary. Those samples remain in the receipt as transitions.

For fixed refresh, renderer and required native presentation medians must reach
95% of the active display rate. Accept 59.94 as its actual target rather than
rounding it to 60. For adaptive/ProMotion displays, record the observed range
under sustained animation and compare phase distributions; do not claim exact
scanout merely because `requestAnimationFrame` approaches the maximum rate.

## macOS Apple Silicon adapter

The supported Mac lane is signed arm64 only. Intel, Rosetta, and universal
claims are out of scope. The product architecture is one Electron application
window with one attached Metal child host. Keep it a child; a popup or companion
window is not an allowed fallback. `BOverlayNeedsPresent()` polling remains
permanently disabled because it crashed Steam's injected renderer on both
OpenGL and Metal.

Required Mac additions:

- Verify launcher, renamed Electron executable, library-validation/DYLD
  entitlements, hardened signing, native addon precedence, and Metal backend.
- Fail fast when the screen is locked or display asleep. Verify Screen & System
  Audio Recording and Accessibility authority for the exact automation host.
- Change modes with a CoreGraphics application-scoped display transaction held
  by a long-lived Swift supervisor. Enumerate only public, desktop-usable
  `CGDisplayMode` values, verify the actual selected mode, monitor the harness,
  and exit to restore automatically. Do not use private CGS APIs or permanently
  apply modes.
- Record CoreGraphics logical/pixel dimensions, Electron bounds/work area,
  `scaleFactor`, renderer DPR/canvas sizes, outer/content bounds, child-host
  frame/drawable size/backing scale, and Metal pump/upload/draw/present counters.
- Resolve the deep profiles from current public display capabilities on every
  run: original logical/pixel size at maximum refresh, the same size at fixed
  60 Hz, the same size at fixed 48 Hz, the smallest distinct desktop-usable
  approximately-2x Retina mode at 60 Hz that can still exercise both narrow
  and wider-than-21:9 game areas, and a safe 1x logical-to-pixel mode at 60 Hz.
  The current runner happens to start at `1728x1117@120`, but neither a numeric
  mode ID nor a historical `1280x800` mode is test configuration. Missing,
  aliased, unsafe, or duplicate required capabilities fail closed.
- Treat CoreGraphics mode refresh as the nominal selected target, not direct
  scanout proof. Pin Chromium `PipelineReporter` events to the exact game
  renderer OS PID, deduplicate by display trace ID, require one stable layer
  tree and no trace loss, and bracket the short trace with untraced rAF samples
  to reject more than 5% measurement perturbation. Use the attached Metal
  drawable-presented callback as the child host's presentation clock.
  ScreenCaptureKit is visual evidence only and must never be used as cadence
  authority.
- On macOS 14 or newer, launch the candidate with Chromium's exact browser-only
  field-trial arm, merged before Electron readiness:
  `--enable-features=CADisplayLinkInBrowser` and
  `--disable-features=CADisplayLinkInGpuThenBrowser`. Record the effective
  feature lists in the receipt. Chromium hard-gates this browser-side path to
  macOS 14+, so do not imply that the flag repairs older systems. Do not enable
  the GPU-then-browser arm: Chromium abandoned it after random power-resume
  hangs and a sleep/wake unresponsive-UI regression.
- Keep exactly one Metal presentation clock: MTKView's timed loop is
  display-synchronized while its child and parent can present, while JavaScript
  performs only lifecycle, geometry, callbacks, and bounded diagnostic
  maintenance. Pause the same view when the child or parent is hidden, the
  parent is miniaturized, or `NSApp` is hidden; do not gate on advisory
  occlusion state and do not recreate the child. Hidden-state receipts require
  two same-surface samples with `viewPaused=true` and stable draw, present,
  no-drawable, no-render-pass, not-presented, and render-failure counters.
  Active preference is the smaller of the requested presenter rate and the
  selected CoreGraphics mode rate; passive preference is bounded to 60 FPS.
  Reapply that policy on display changes. For fixed-rate release samples,
  renderer and required Metal presentation must remain within 95%-108% of
  nominal; the lower bound rejects timer starvation and the upper bound rejects
  duplicate clocks or over-presentation. This is an independently scored child
  policy, not a workaround for Electron cadence: receipts 59, 61, and 64
  exonerated the attached child by reproducing the renderer failure while the
  child was respectively synchronized, repainted, and fully paused.
- For every fixed-rate transition, retain pre/target/restored renderer rAF,
  renderer-PID-pinned `PipelineReporter`, persistent
  `ExternalBeginFrameSourceMac::OnDisplayLinkCallback`, Metal-child cadence,
  focus/visibility/occlusion, renderer/process identity, and exact mode
  restoration. The focused and fully occluded/unfocused plain-Electron
  browser-only controls held 120 -> 60 -> 120, but they are causal diagnostics,
  not substitutes for actual-game evidence. Their light CSS workload was not
  required to submit a physical frame every vsync; do not weaken the
  continuously animating actual-game presentation gate to match it.
- User-path interaction includes genuine stepped CoreGraphics mouse drags,
  `Cmd-M` minimize, `Cmd-H` hide/show, `Cmd-Tab` away/back, menu-bar mouse and
  keyboard access, and pointer release in every failure path. The title-drag
  helper gives AppKit one bounded post-mousedown latch interval before the
  timed motion begins; that prevents synthetic event-queue scheduling from
  discarding an otherwise valid rapid drag without weakening the measured
  motion or final-geometry assertions.
- The first macOS Friends-overlay open remains an exact visible QA-menu action.
  While that modal overlay is already active, duplicate suppression uses the
  QA-gated menu accelerator through a real `Cmd-Shift-O` HID sequence; unlike
  an Accessibility menu press, posting the shortcut cannot block the harness
  until Steam later closes its modal run loop.
- Treat Steam's exact-app activation callback as authoritative, without assuming
  the overlay persists across prolonged minimize. Prove fresh active telemetry
  on the established child and checkpoint callbacks immediately before the
  exact minimize action. Hidden proof requires two adjacent eligible samples on
  that child with one resolved boolean activation state, paused presentation,
  and stable counters; any visibility, display, activation-state, or invalid-
  telemetry boundary resets the pair. If no exact inactive callback follows,
  hidden and restored telemetry must remain active. If one does, require a later
  exact active callback in order for an already-active restore. For a passive
  restore, first prove passive input and exact child alignment, then reopen only
  through the public Friends QA menu and require a fresh `active=true` callback,
  healthy active telemetry on the same child, and visual coverage. Wrong-app,
  stale, telemetry-only, or incidental window-event evidence cannot prove the
  lifecycle.
- Product fullscreen is Electron simple fullscreen unless the consumer
  explicitly chooses native Spaces. Run simple fullscreen as a release case.
  Run native Spaces (`Ctrl-Cmd-F`/green control) as a separate diagnostic and
  await asynchronous enter/leave events; the bridge must recognize either, but
  it must not force application window policy.
- Add conditional Mission Control/Space return, Stage Manager, tiling, Dock
  activation, notch/work-area, recording-stress, and mixed-display cases when
  those capabilities are present. Unsupported/private Space enumeration is not
  required.
- Exercise the browser-only display-link path through cold and warm startup and
  deliberate GPU-process failure/recovery. Require the same renderer/application
  recovery semantics, correct selected display cadence, no duplicate display-link
  clock, and zero new crash or hang evidence. Lock-capable display-sleep and
  system-sleep cases are excluded by the operating rule above and must not be
  restored as release gates.
- Search current macOS DiagnosticReports plus Steam crash evidence from the
  exact run interval. Zero new app, native host, Steam, or injected renderer
  crashes are allowed.
- Every live QA lane must read Electron Framework's `CFBundleVersion` and
  accept only a stable Electron version before any display mutation or
  Steam/game launch. Alpha, beta, nightly, and every other prerelease are
  forbidden for both testing and release. Historical `qualification` receipts
  remain causal evidence only; the retained lane now uses the same stable-only
  preflight. Missing, malformed, or prerelease dependency metadata fails closed
  and remains visible in the sanitized candidate fingerprint. If the required
  repair exists only upstream, record the exact upstream commit/TODO and move
  on until it ships in a supported stable Electron release.

The complete Steam route matrix remains a separate final-candidate gate. Do not
rerun its 55 cases during window/display development; run focused affected
routes, then the full route matrix once beside the final actual-game receipt.

## Windows adapter

- Use the single standalone top-level D3D11 game host with hidden Electron
  offscreen renderer. Attached popup, owned-popup, and `WS_CHILD` paths are
  closed and must not be retried.
- Classify active move, resize, maximize, minimize, system-menu, and application
  fullscreen attempts as `STEAM-MODAL-CONSTRAINT`. A 2026-07-26 actual-game
  checkout probe measured `GetCapture()` as the exact standalone host HWND while
  active; the attempted commands produced no `WM_NCLBUTTONDOWN/UP`,
  `WM_SYSCOMMAND`, or enter/exit-size-move messages. The overlay remained
  aligned and stable near 165 Hz; Escape cleared capture and title dragging
  resumed immediately. These cases pass by proving modal ownership, unchanged
  geometry, stable presentation, close, and post-close recovery, not by forcing
  the window to move beneath Steam.
- Active focus/occlusion round trips and externally forced display, refresh,
  resolution, and DPI transitions remain required when the profile calls for
  them. They are not covered by the window-management modal disposition.
- Never call `ReleaseCapture()` for Steam or synthesize
  `WM_NCLBUTTONDOWN`/`DefWindowProc` move-size loops. Popup, owned-popup, and
  `WS_CHILD` hosts remain closed and are not modal-input workarounds.
- Exercise PMv2 DPI, native menus and rounded corners, exact client minimum,
  modal `WM_SIZE` stress, 60 and maximum refresh, low/preferred resolution, and
  at least two exposed scale settings.
- Record DXGI waitable-swapchain cadence, source copies, native presents,
  frame-latency timeouts, slow copies, device loss/recovery, and adapter identity.
- The consumer-owned `scripts/windows-actual-game-qa.mjs` lane requires an
  explicit `windows-desktop` target, Windows renderer attestation,
  `isSteamDeck() === false`, and local-loopback transport. Its canonical
  `scripts/windows-final-qa-receipt.mjs` root uses the same exact ordered
  37-CORE contract as macOS/Linux/Deck and accepts no `not-applicable` row.
- The consumer canonical receipt complements the package-owned
  `windows-live-proof-receipt.cjs`; neither substitutes for the other. The
  former binds actual-game/manual cross-platform behavior, while the latter
  binds the package/runtime/native telemetry and npm publication candidate.
- The detailed specialization remains in
  [Windows Actual-Game Exhaustive QA](windows-actual-game-exhaustive-qa.md).

## Linux and Steam Deck adapters

Desktop Linux/Deck uses one visible X11/GLX application host plus one hidden
Electron offscreen renderer. Popup/topmost companions, resize recreate/remap,
nested child GLX, proxy dual-drawables, and direct Electron GPU paths are closed.

- Desktop mode: verify menu inset, exact minimum, KWin/XRandR geometry and
  refresh, genuine compositor move/resize, maximize/minimize/fullscreen/focus,
  native EIS input, cursor, dma-buf import/draw counters, one-host reuse, and
  overlay-active retained presentation.
- Steam Deck Game Mode is a separate compositor-native lane at `1280x800`.
  Verify launch geometry, SteamUI store/overlay behavior, controller/Escape,
  focus/return, and cleanup; do not generalize Desktop proof to Game Mode.
- Remote Deck pixel capture may be unavailable. Record that limitation and do
  not claim screenshot comparison; geometry, lifecycle, input, import, cadence,
  and crash evidence remain mandatory.
- Non-Deck Linux Desktop is a separate physical x64 lane. Exercise each
  supported X11 and Wayland session across native/max-Hz, fixed 60 Hz when
  exposed, lower resolution, 100% scale, and supported fractional/high-DPI
  profiles. It accepts no `not-applicable` CORE behavior and requires the same
  actual-game, native-window, overlay-active transition, cadence, restoration,
  crash, and cleanup evidence as Desktop Mode.
- The consumer's neutral `scripts/linux-actual-game-qa.mjs` entrypoint requires
  an explicit `linux-desktop`, `steam-deck-desktop`, or
  `steam-deck-game-mode` target. Its closed CDP attestation requires Linux and
  exact Deck/non-Deck identity; evidence cannot cross platform lanes.

## Receipt schema

The canonical `summary.json` is closed-schema and contains:

```json
{
  "schemaVersion": 1,
  "suite": "cross-platform-actual-game-exhaustive",
  "candidate": {},
  "consumer": {},
  "platform": {},
  "steam": { "singleTargetSession": true },
  "originalDisplayConfiguration": {},
  "displayProfiles": [],
  "cases": [],
  "pacingSamples": [],
  "crashes": [],
  "cleanup": {},
  "redactions": {},
  "result": "pass"
}
```

Each case entry includes `id`, `platformCaseId`, `status`, start/end timestamps,
display profile, app/host/target PIDs in run-local form, pre/post state, exact
assertions, artifact-relative evidence paths, and a failure code when not
passing. The summary includes SHA-256 for every raw log, screenshot/capture,
mode journal, case event stream, executable, package, and native addon.

Required artifact layout:

```text
manifest.json
events.jsonl
summary.json
display-original.json
display-final.json
cases/<case-id>/...
logs/app.stdout.log
logs/app.stderr.log
logs/steam-sanitized.log
crashes/manifest.json
```

The auditor rejects unknown case IDs/statuses, duplicate IDs, missing required
cases, path escapes/symlinks, absolute evidence paths, inconsistent candidate
identity, raw private identifiers, missing hashes, mutated files, dirty cleanup,
display mismatch after restore, crash evidence, or a passing top-level result
with any required non-pass case.

The consumer repository now owns the executable Linux/Deck auditor at
`scripts/linux-final-qa-receipt.mjs` (with the prior Deck-named path retained as
a compatibility entrypoint). It recomputes every artifact hash and
requires both consumer and Steam Bridge commit/version identity, package
archive/tree and executable/native-addon hashes, the exact ordered 37-row CORE
contract, hashed per-case evidence, run-local process continuity, closed
pre/post state, fixed case-specific assertion sets, one distinct evidence
directory per CORE row, the prescribed logs/display/crash files, exact desktop
restore,
empty application stderr, zero crash counts, and three settled renderer/native
presentation samples for baseline, overlay-active, and post-close phases on
every display profile. Its CDP stream is resanitized during verification, so a
new unknown/raw target field invalidates the receipt even if the manifest was
recomputed afterward. Bounded text evidence is also rejected when it contains
URLs, local home paths, Steam-ID-shaped values, email addresses, or known
private Steam/commerce identity fields. Fixed-rate Linux/Deck samples must
target the measured display rate; a lower self-declared target is not accepted.
The receipt binds one exact ordered five-case CDP stream to the same platform
ID and loopback-forward transport, and rejects missing/duplicate/reordered
cases or a Deck/non-Deck attestation mismatch.

Desktop Mode accepts no `not-applicable` CORE behavior. Game Mode is audited as
a separate `1280x800` gamescope lane: only the explicitly absent desktop menu,
move/resize, minimize/maximize, and corresponding active window-management
rows may be `not-applicable`. The auditor rejects those compositor-absent rows
as fake passes and rejects `not-applicable` for every supported Game Mode
launch, renderer, input, fullscreen, SteamUI overlay, focus, pacing, display,
and cleanup behavior. This auditor qualifies a retained root; it never creates
manual observations or turns operator answers into a pass.

## Current coverage status

In this table, an "acceptable Electron" means an exact stable release only.
Historical alpha evidence is not authorization to run alpha, beta, nightly, or
another prerelease. The M152 cadence repair is an upstream dependency until it
ships in a supported stable Electron release.

| Platform | Durable evidence | Remaining before next release |
| --- | --- | --- |
| Windows | Complete 2026-07-22 actual-game pass at 60/165 Hz, low/preferred resolution and 100/200% scale; 2026-07-26 actual-game proof of exact-host Steam modal capture, stable 165 Hz presentation, Escape release, and immediate title-drag recovery | Focused-retest only if the final candidate affects the modal/input diagnostics or a post-close transition, then run one final exact-candidate pass |
| macOS Apple Silicon | Exact `338f203` signed smoke package passed 55/55 Steam route cases on Retina/Metal. RC80/RC85 focused actual-game receipts close the attached-child geometry, gesture, minimum-size, native-state, overlay lifecycle, GPU-recovery, Retina/1x visual-shape, and display-supervisor defects. Exact signed/notarized/stapled test-only RC89 fingerprint `cb1d53b7631ba74444b0d06eaac6d905351e5be91acdbb5894620d4b3a4c5b98` ran Electron 44.0.0-alpha.7 / Chromium 152 twice and repeatably removed the Chromium 150 post-restore half-rate failure: factors stayed `[1,1]`, skipped callbacks stayed zero, restored cadence remained approximately 60 FPS, the display restored exactly, Steam survived, and all crash categories stayed zero. | Do not ship the isolation alpha. Promote an acceptable Electron 44 build or supported backport through the exact signed cadence gate; focused-retest the affected Retina/1x zoom shapes; then run one final complete 25-case/five-profile actual-game pass and the 55-route gate on that exact signed/notarized/stapled candidate. Lock-capable sleep is permanently excluded. |
| Steam Deck Desktop | Actual-game one-host geometry/input/overlay/90 Hz pass | Bind to the final candidate and canonical receipt |
| Steam Deck Game Mode | Focused `1280x800` compositor-native checks | Complete canonical Game Mode receipt on the final candidate |
| Other Linux desktop | Closed explicit-platform CDP harness, stable-only candidate gate, canonical 37-CORE receipt auditor, and exhaustive X11/Wayland physical matrix are implemented | Execute and retain the physical desktop matrix when a supported runner is available |
