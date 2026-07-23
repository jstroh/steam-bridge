# Current Work Checkpoint

Last reviewed: 2026-07-22

Review anchor: `45a43686b465e8fa6c84184f946fbc372705c496`
(`Bound Windows restore pacing proof`). npm `latest` is `0.3.8`. Exact
`v0.3.0`, `v0.3.1`, `v0.3.2`, and `v0.3.3` are immutable, unpublished,
rejected candidates. Exact `v0.3.5` is also immutable
and unpublished, but is obsolete because the current native and consumer
repairs were made afterward. Exact `v0.3.6` is tagged and its cross-platform
candidate workflow passed, but it remains unpublished and must not be moved or
published: the candidate-bound proof contract still required repeated physical
Shift+Tab input and treated a bounded Win32 modal-menu wait as a GPU failure.
Exact `v0.3.7` is also immutable and unpublished. Its release workflow and
actual-game runtime passed, but its receipt classified one valid 1 FPS -> 60 Hz
minimize/restore target transition as steady-state pacing. `v0.3.8` is the
published successor and current stable release. Never move, reuse, or publish
any rejected tag.

## Read First After Compaction: Windows Architecture

This checkpoint overrides any shortened-context inference that Windows attached
presentation should be repaired with another popup or child-window experiment.

- The requested audit covered all 794 commits in the repository (the entire
  history available to the requested 800-commit window) and inspected the
  Windows host commits and their recorded live failures.
- `e1dfd73` introduced the attached Windows presenter as `WS_POPUP`.
  `f0215bd` added a "control" comparison that was still an unparented
  `WS_OVERLAPPEDWINDOW`. Activation, focus, bounds, message-pump, clipping, and
  parking repairs accumulated through `6577856` without changing the second
  top-level-window architecture. `2a24089` renamed that attached path
  `owned-popup` and separately introduced the successful standalone shared-
  texture game host.
- No committed revision before the current abandoned re-entry contains
  `WS_CHILD` or `SetParent` in the Windows native host. The real-child result was
  a source-linked, uncommitted experiment recorded by `2a24089`: Windows made
  geometry, clipping, move, focus, and minimize behavior automatic, but Steam
  activated without drawing overlay pixels into the child swapchain.
- Attached top-level presenters are a closed path. Live failures included
  Electron chrome coverage, purple startup/Alt+Tab surfaces, tiny or partial
  Steam surfaces, DPI seams, lost rounded corners, toolbar/menu/title-drag and
  maximize conflicts, minimize/focus desynchronization, drag/resize flicker,
  retained or stale pixels, hangs, and crashes. Region synchronization,
  terminal geometry updates, timing delays, DevTools activity, and retained-
  frame resize stretching patched symptoms and must not be retried.
- The true attached `WS_CHILD` path is also closed unless Steam hook selection
  or the renderer architecture materially changes. Its no-pixels result must
  never trigger a popup fallback.
- The proven Windows production path is one visible standalone top-level native
  D3D host which composites a hidden Electron offscreen renderer. FOV4 already
  uses `client.overlay.startNativeOverlaySession()` in `main/main.js` and creates
  its renderer `BrowserWindow` with `show: false`, `frame: false`, and offscreen
  shared-texture presentation.
- Therefore test the actual FOV4 game-host path. Windows attached mode should
  fail clearly rather than create any popup. During iteration, run only tests
  and live transitions affected by the current edit. Run the full cross-
  platform release matrix once after the implementation is stable and directly
  before publication.

## Completed Goal

Steam Bridge and the FOV4 port now use the proven standalone native-host
architecture. The release permanently closes failed Windows attached
popup/child paths, makes unsupported attached Windows use fail clearly,
validates the actual game with change-scoped manual and automated QA,
requalifies affected platforms, and completes one immutable release-candidate
review through documentation, version, commit, push, tag, GitHub Release, npm
publication, and registry verification. That sequence completed for `v0.3.8`;
do not reopen it without a new code change and a new version.

## Current State

`steam-bridge@0.3.8` is published to npm and is the stable GitHub Release:
<https://github.com/jstroh/steam-bridge/releases/tag/v0.3.8>. Source commit
`45a43686b465e8fa6c84184f946fbc372705c496` is bound to immutable tag
`v0.3.8`. Tag workflow `29973234900` passed macOS arm64, Windows x64, Linux
x64, and the exact Windows publish-tarball ASAR/package gate. Trusted publish
workflow `29974384230` passed from the tag. The earlier main-ref dispatch
`29974354896` was rejected before any step ran and changed no npm state.

The canonical Windows candidate contains 118 files with content SHA-256
`69b706aff775f227e241e9080adbb38da6d259b6dcba8940ac9e0e3a429c56ff`.
Its Windows archive SHA-256 is
`a429b0fb8115c8ddc224f0d6ad803ed02d69858609c5c49749726a9b9bec98ce` and
the npm tarball SHA-256 is
`b3bf553560f40455ca36c22854d02c31f770b2588c71e238258140f340c7ae13`.
The downloaded registry tarball is byte-identical to that audited tarball.
npm reports integrity
`sha512-Cth1icQaTBf+Q21HZSdzaWjDel2J8+PODgH1JcRNAAHESDJfzYAHbQfLsEHmGDyVS7wDTdpJm44HaydOaf9pKQ==`,
shasum `72154de8b9b5a489ae7b5e924c14a21e2da524c2`, and SLSA provenance.

The final candidate-bound actual-game receipt is schema 4 with SHA-256
`facfddeacd9c32f30a5208dee1046e7091b5e8a9000e7d5f5c95f8a9b9b9ab41`.
It contains 110 game samples and 14 ordinary Friends-overlay samples. Game
paint, game present, and overlay present medians were all 59.9 FPS against the
60 Hz display, with zero unsynchronized steady-state samples, latency waits,
slow copies, device losses, or recoveries. It records
`humanInputRequired: false`. One earlier physical Shift+Tab qualification is
retained as sufficient product evidence and must never become recurring QA
input; automated releases use the opt-in native QA menu and the same safe
`activateDialog("Friends")` API. No purchase or subscription was authorized.

The 2026-07-21 source-linked FOV4 Windows pass now exercises the actual game on
the standalone native host rather than any attached presenter. A long modal
resize first reproduced `DXGI_ERROR_DEVICE_REMOVED` from competing one-
millisecond timer and `WM_SIZE` renders. Modal presentation is now coalesced at
16 ms, device loss is classified and recoverable on the next shared texture,
and diagnostics expose loss/recovery counts. Repeating the exact stress reached
the enforced 640 by 480 logical minimum and returned to 59.9 FPS without device
loss, slow copies, a crash, or Steam-client damage. Minimize also no longer
turns Windows' iconic sentinel geometry into a tiny renderer: the host reports
`minimized`, skips D3D presentation, and the consumer retains its real viewport
while throttled to 1 FPS. Restore returned the unchanged 2883 by 1623 coded
source to 59.9 FPS without recreating texture storage.

That same actual-game run passed default 1280 by 720 geometry at 225% scale,
File/Edit/View chrome, title drag, edge and exact-minimum resize,
maximize/restore, minimize/restore, fullscreen/restore, and focus loss/return.
One OS-level Shift+Tab qualification generated the native shortcut event and
Steam active/inactive callbacks, opened the ordinary Friends overlay, and
closed it. That one-time qualification is retained evidence; a human is not a
recurring release-harness dependency. The consumer now exposes an opt-in
`STEAM_BRIDGE_QA_OVERLAY=1` native View-menu command which calls the same safe
`activateDialog("Friends")` API, logs a closed-schema `qa-menu` marker, and is
absent from production menus. Computer-driven QA opens the ordinary surface
through that visible command and closes it with Escape. The overlay was
correctly bounded to the native client at both
1280 by 720 and maximized sizes, with no right/bottom seam, purple surface, tiny
top-left surface, hang, or crash. The final steady state measured 59.8-59.9
source and native-present FPS against the current 60 Hz display, with zero
frame-latency timeouts and zero device losses. No checkout or subscription was
opened in this pass.

The Windows native module has now physically removed the abandoned attached
implementation rather than merely hiding it behind policy. It contains no
popup host style, owner/parent handle, parent subclass, popup clipping region,
external bounds override, or fallback branch. The ABI-compatible attach calls
return an explicit unsupported error without closing or replacing an existing
standalone surface, and external `setBounds` calls fail because the standalone
host owns its native geometry. Linux and macOS attachment code is unchanged.
The focused Rust, TypeScript, package, and unit gates pass, including 203/203
repository tests.

The post-pruning actual-game regression repeated ordinary Steam Friends open
and close through OS-level Shift+Tab, minimize/restore, maximize/restore,
fullscreen/restore, a live resize, and clean process shutdown. The overlay
remained inside the client with no seam, purple/tiny surface, flicker, hang, or
crash. A separate instrumented launch at 225% DPI recorded the exact 1280 by
720 logical client, 640 by 480 logical minimum, 60 Hz target, 59.9 native
present FPS at steady state, a frame-latency waitable swapchain, and zero frame-
latency timeouts, device losses, recoveries, or slow shared-texture copies.
Artifact roots are
`C:\Users\admin\steam-bridge-artifacts\fov-popup-prune-regression-20260721-220604`
and
`C:\Users\admin\steam-bridge-artifacts\fov-popup-prune-fps-20260721-221429`.

The exact local `0.3.6` tarball then exposed and closed an overlay-only pacing
gap. Game paint/native present held 59.9 FPS against the current 60 Hz display,
but Steam-active retained-frame pumping initially fell to a 47.7 FPS median
because the session scheduler reserved its early DXGI wake-up for construction-
time `continuousPresent`, while overlay activation enabled the same native mode
later. Scheduling from the applied continuous-present state raised a fresh real
checkout overlay to 60.0 FPS median pump/present across 32 samples (57.6 FPS
minimum during activation), with zero device loss, recovery, latency timeout, or
slow-copy counts. Electron paint was zero while Steam owned the visible frame;
the receipt therefore enforces game paint plus present and overlay present while
retaining overlay paint as a reported diagnostic. No transaction or subscription
was authorized. The focused artifact root is
`C:\Users\admin\steam-bridge-artifacts\fov-v0.3.6-pacing-manual-20260721-2330`.

The final `v0.3.6` proof attempt also exposed a receipt-design defect rather
than a runtime regression. Win32's modal menu loop can pause the telemetry
interval and produce one bounded DXGI frame-latency wait timeout; the window
then immediately returns to 59.9-60.4 FPS. Receipt schema 4 excludes telemetry
intervals longer than two seconds from pacing medians, allows at most three
cumulative menu-transition wait timeouts and three valid target/display
transition samples, and still rejects device loss,
recovery, slow shared-texture copies, stderr, crashes, unsafe transaction
activity, or sub-95%-of-refresh game/overlay medians. It also requires the
`qa-menu` ordinary-overlay marker and declares `humanInputRequired: false`, so
future candidate proof cannot silently restore the rejected physical-input
dependency.

Exact `v0.3.7` then passed its tag-bound GitHub Release workflow on macOS
arm64, Windows x64, Linux x64, and the exact Windows package/ASAR gate. Its
fully computer-driven actual-game pass covered the native File/Edit/View menus,
title drag, exact 640 by 480 minimum, maximize/restore, minimize/restore,
fullscreen/restore, focus return, rounded client edges, and an ordinary Friends
overlay opened at minimum size through the opt-in QA menu and closed with
Escape. The surface remained aligned to the client with no purple or tiny
surface, seam, flicker, device loss, slow copy, crash, or stderr. Focused
overlay presentation held a roughly 59.9 FPS median against 60 Hz. One valid
post-minimize sample reported the restored window while the renderer target was
still 1 FPS; later samples immediately returned to 60 FPS. Schema 3 rejected
that transition, so `v0.3.7` remains immutable and unpublished. Schema 4 was
tested against the unchanged raw logs and exact extracted 118-file candidate
and accepts that single transition while rejecting four. The retained evidence
root is
`C:\Users\admin\steam-bridge-artifacts\v0.3.7-rc-run-29971691514`.

Steam Deck requalification is complete for the current working candidate. The
Desktop core passed 21/21 routes and 42 screenshots; focused move, resize,
fullscreen, minimize/restore, same-host reuse, bottom-corner, progress-toast,
and unlock-toast proofs also passed. A true cold launch found that Steam can
report the overlay enabled before Linux `gameoverlayui` is safe to call;
immediate web activation crashed at address zero. The managed Wayland path now
has a configurable 3000 ms activation warmup, fail-closed synchronous helpers,
and wait-aware asynchronous helpers. Managed waits reserve the operation
without activating the presenter, leaving the host transparent, input-empty,
and at zero FPS until readiness is proven. The exact rebuilt package passed a
fresh 6/6 Desktop matrix with 11 screenshots and the bounded 2/2 Game Mode
readiness/compositor-native Store contract at 1280x800. The final checkout
reservation fix then passed the focused exact-candidate duplicate-open guard:
one target, duplicate suppression, visible activation, Escape close,
`active=false`, focus return, stable zero-FPS parking, and no crashes. The SSH
close probe found during that run now discovers and authenticates the active
Xauthority before sending input, and its self-test passes locally and on Deck.

Deck Desktop frame pacing is measured against KWin's authoritative output
state because Electron reports `displayFrequency=0` in this Wayland session.
KWin reports 90.004 Hz. Before presenter attachment the renderer measured
90.000 FPS (99.996% of refresh, 11.1 ms p50/p99). While the Steam browser was
visibly active it measured 86.68 and 86.84 FPS (96.3-96.5% of refresh), with
11.1 ms p50 and sparse 22.2-88.9 ms tail stalls. After Escape, the presenter
was conclusively parked at `currentFps=0` and its `pumpCount` remained exactly
2567, while the renderer measured 86.35 then 83.36 FPS. The remaining tail
stalls therefore occur while Steam's injected `gameoverlayui` process remains
attached, not from passive presenter pumping. A fresh app without that
post-activation process returns to the 90 FPS baseline.

Current Apple Silicon qualification uses the signed arm64 package on
`jeromystroh@Jeromys-MacBook-Pro.local`. Metal host readiness, Steam
launch/injection, direct web activation, native window transitions, and frame
pacing all pass. The 120.000 Hz Retina display (scale factor 2) measured
120.004 FPS before activation, 118.676 FPS with the browser overlay active, and
118.367 FPS after close. Restored, maximized, minimized/restored, and simple
fullscreen states retained exact content/host geometry and one native host
attachment; simple fullscreen measured 116.92 FPS and maximized measured
118.35 FPS. Steam-launched native Spaces fullscreen did not enter reliably, so
the smoke app uses Electron simple fullscreen while Steam Bridge recognizes
both native and simple fullscreen as fullscreen geometry. Window-state policy
remains application-owned.

The exact signed Apple Silicon full route matrix is now complete: 55/55 checks
passed at `/tmp/steam-bridge-macos-overlay-matrix-full-exact-final-20260719`.
It verified screen-pixel visibility, input close, focus return, capture health,
route lifecycle, passive parking, crash diagnostics, and all 1,130 native
methods against contract hash
`25cfd24fac158d8768732933c153bab01aa1618ac44a6f39eeba23920a443ba4`.
Earlier attempts correctly stopped at macOS TCC boundaries until Screen & System
Audio Recording and Accessibility were granted to the SSH automation host; the
accepted run used those permissions and did not weaken the proof fallback.

The Mac checkout is now fast-forwarded to the same `3da802d`/`0.2.14` baseline
as the Windows working tree and the modified runtime inputs match by SHA-256.
That exact rebuild exposed a package-source precedence bug: an old
target-named addon could override the fresh `steam_bridge_native.local.node`
created by `npm run native:build`. For ordinary current-host builds, the example
packager now prefers that local addon. Cross-target packages and explicit
`--artifacts-dir` release assemblies retain target-named artifact precedence.
Regression coverage proves all three branches. The
rebuilt signed arm64 package verifies all 1,130 expected native methods with
contract hash `25cfd24fac158d8768732933c153bab01aa1618ac44a6f39eeba23920a443ba4`,
and its launcher/Electron pair pass the arm64, signing, entitlement, launcher,
helper, and matrix self-test gates without starting Steam.

Live qualification uses one Steam client at a time. The Deck and macOS Steam
sessions were stopped before final Windows consumer QA. Exact `v0.3.0` at
`f5063b7` passed candidate workflow `29725066150`, but a later true cold Windows
launch exposed a first-activation race and rejects that unpublished tag. Steam
could discover the D3D surface before its `Present` hook was ready; an activation
could then be emitted without opening a usable Steam surface. A five-second
fallback was disproved by consecutive cold runs and has been removed. Exact
`v0.2.14` reproduced the same current-client timing, so this was not introduced
by `v0.3.0`, but the replacement must still handle it correctly.

Valve's browser-game guidance requires Steam initialization before graphics
device creation and continuous full-frame presentation from Chromium into a
native D3D window. The Windows persistent managed path now follows that contract:
the smoke app initializes Steam and registers callbacks before Electron readiness
and lazy-loads display services later; a managed readiness wait holds the native
surface transparent, non-activating, and click-through while presenting at 30
FPS; `IsOverlayEnabled` is the positive hook handshake; and the hold releases to
zero FPS on ready, abort, timeout, or close. No overlay activation or client-
session checkout operation is dispatched before that handshake. See
[Valve's overlay guide](https://partner.steamgames.com/doc/features/overlay?language=english),
[Valve's `ISteamUtils` reference](https://partner.steamgames.com/doc/api/isteamutils?l=english),
and the analogous Chromium multi-process constraint documented in
[WebView2Feedback #3200](https://github.com/MicrosoftEdge/WebView2Feedback/issues/3200).

The rebuilt source passed five consecutive full Steam shutdown/restart cycles:
all five Friends waits produced a visible, interactive, closable overlay, returned
focus, parked at zero FPS, and produced zero crash dumps. Hook readiness varied
from roughly 1.0 to 4.8 seconds, directly confirming that a fixed delay was the
wrong primitive. The focused regression suite proves attach and at least three
presents before activation, operation ordering for client-session checkout, and
zero-FPS cleanup after success and abort. All 215 repository tests, TypeScript
build, API/platform audits, Rust format/check, the complete package smoke, and
the platform helper and matrix self-tests pass. The complete locally assembled
package contains 42 entries and all nine target-native/runtime files; its
Windows Electron-builder ASAR/package gate passes. That local assembly reused
the verified `v0.3.0` cross-platform prebuilds because no native source changed;
exact `v0.3.1` main/tag CI and Release assembly rebuilt and bound fresh
artifacts successfully. Its protected Windows deployment also matched that
candidate exactly. Before the live route profiles, the required Steam-off
shortcut refresh exposed a QA-harness defect: diagnostic collection passed an
absent Steam process timestamp into a non-nullable PowerShell `DateTime`
parameter and emitted a false capture failure. The `0.3.2` replacement models
that timestamp as nullable; the same Steam-off shortcut flow captures its
diagnostics cleanly, verifies the shortcut, and passes all 215 tests. No native
or application runtime behavior changed from `v0.3.1`.

Exact `v0.3.2` then passed main/tag CI, Release assembly, independent candidate
verification, and protected deployment. Its persistent-reuse and checkout
profiles passed, and the shortcut profile completed its first eight routes.
The User route then rendered stacked Steam chat, suspicious-chat warning, and
Community-profile headers. The generic glyph detector correctly proved a
Steam web surface but selected an inner header's X; that click did not dismiss
the whole overlay, so the run failed closed and the final Dialog route was not
started. A focused Escape comparison also failed closed because it sent Escape
after activation but before the Steam web panel was visibly rendered. Those
two immutable roots prove the required composite boundary: User and Dialog
wait for the established modal geometry, dimmed backdrop, loaded content,
direct close glyph, exact pre-dispatch screenshot, and native-host focus, then
send native Escape to dismiss the complete stacked overlay. Ordinary web,
checkout, Store, Friends, profile, and other routes retain glyph-bound pointer
close coverage. `0.3.3` implements that harness-only split and its auditor
rejects missing readiness, reordered evidence, or incomplete native key input.
Current-source live diagnostics against the protected exact `v0.3.2` runtime
then passed User at
`C:\Users\admin\steam-bridge-artifacts\source-v0.3.3-user-diagnostic-20260721`
and Dialog at
`C:\Users\admin\steam-bridge-artifacts\source-v0.3.3-dialog-diagnostic-20260721`:
each proved full Steam web readiness, an exact physical pre-dispatch frame,
native Escape `2/2/0`, inactive/parked/focus-return completion, and zero
crashes. The faster Dialog close also exposed an auditor-only total-order bug:
the managed close-stable event can correctly precede result-file publication
because those are independent completion branches. The corrected partial-order
contract requires both branches before focus return and the single graceful
completion quit, and a fixture now covers that real ordering.
The exact `v0.3.3` workflow rebuilt and bound fresh artifacts; it did not reuse
either failed `v0.3.2` root.

Exact `v0.3.3` passed main/tag CI, three-platform Release assembly, canonical
tarball verification, protected deployment, and the persistent-reuse profile.
Its public checkout profile then passed the first three cases, but the
independent packaged auditor rejected
`04-shortcut-checkout-open-and-wait` at
`C:\Users\admin\steam-bridge-artifacts\windows-v0.3.3-receipt-checkout-20260721-220100`.
The surface opened and closed cleanly with exact glyph-bound pointer input
`3/3/0`, focus returned, the presenter parked, and crash count stayed zero.
The valid event order was close-stable, focus return, result publication, then
completion quit. Focus return and managed-result publication are independent
branches; requiring publication before focus return was another false total
order. `0.3.4` requires input before each branch and all focus, stable, and
result branches before the single completion quit, without ordering the
branches against one another. A checkout-shaped fixture covers the exact live
ordering. The run also exposed that the task wrapper reported only the inner
matrix exit and did not propagate its post-cleanup semantic audit. The `0.3.4`
wrapper now runs the packaged summarizer after cleanup evidence is durable and
returns nonzero on any rejection. No `v0.3.3` artifact may be reused for the
new receipt.

The release assembler now invokes the current Node executable directly instead
of using a deprecated Windows shell argument path. Commit/push, exact candidate
workflow, candidate-bound Windows receipt, GitHub Release, trusted npm
publication, and downstream registry verification remain. Package smoke on this
host requires Git Bash plus a real Python interpreter; the Microsoft Store
`python3` alias is not a valid POSIX-fixture runtime.

The source-linked Windows host now creates a frame-latency-waitable flip-model
swap chain, sets maximum frame latency to one, waits on the DXGI object, and
submits through `Present(1)` on a two-buffer flip-sequential chain. New shared
textures and CPU frames pump
immediately; the scheduled pump remains a retained-frame and Steam-overlay
fallback. On the development display's native 1920 by 1200, 165 Hz mode, DWM
reported 164.766 Hz. An opt-in renderer animation produced 145-149 game-surface
FPS and 162-165 native presents during gameplay. With the Steam checkout
overlay active, the source remained at 147-150 FPS and the native presenter at
163-165 FPS. Both phases had zero frame-latency wait timeouts and zero slow
shared-texture copies on the matching discrete-GPU adapter. The animation runs
only under the local FPS-report flag and is absent from normal development and
release execution. The shared-texture fence wait now has a hard upper bound so
a wedged GPU copy fails instead of spinning the Electron main thread forever;
swap-chain setup also closes a newly acquired wait handle on every failure path.

The final actual-game Windows pass used the production Electron `43.1.1`
consumer at 225% desktop scale. Electron's hidden renderer produced a
2883-by-1623 coded shared texture for a 1280-by-720 logical viewport, and
3459-by-2172 in fullscreen; the extra logical pixel was Chromium allocation
padding, not game content. Forwarding the full coded texture created narrow
side bars and a bottom overrun. Steam Bridge now accepts an explicit
`presentationRect`, crops that viewport into its retained texture, and then
presents it without imposing a browser-client aspect policy. The consumer sets
Electron 42+ offscreen `deviceScaleFactor` to the launch display scale and keeps
that renderer scale stable; scale factor 1 on Electron 42/43 reproducibly turned
live WebGL captures black after resize in both CPU and D3D forwarding, while
Electron 41 native scale and Electron 42/43 explicit native scale passed. The
corrected production game remained live through 1280-by-720 windowed,
1536-by-964 fullscreen, and restored 1280-by-720 transitions at 59-60 game and
native FPS against the current 60 Hz desktop, with zero bitmap fallbacks,
frame-latency wait timeouts, or slow shared-texture copies.

That same actual-game run passed native title drag, edge resize and the retained
640-by-480 logical minimum, rounded restored corners, File/View menu input,
maximize/restore, minimize/restore, fullscreen/restore, focus loss to Steam and
return, Win11 Snap Layout dismissal, and clean exit. Real checkout and
subscription routes opened at the correct centered size. Rapid repeated Buy
clicks had stacked multiple Steam pages, so the consumer now owns a request gate
that admits one pending/active web overlay and releases on close, activation
failure, or a bounded no-activation timeout. A triple-click then opened one
checkout and one close returned directly to gameplay; the next subscription
route proved gate release. No purchase or subscription was authorized.

The standalone host also accepts a validated menu tree, attaches a real Win32
menu, dispatches command IDs as `menuCommand` input events, preserves client
size when the menu changes, removes it in fullscreen, and restores it on return
to windowed mode. `WM_GETMINMAXINFO` enforces a logical minimum client size with
menu- and DPI-aware non-client adjustment. The source-linked consumer exposes
File/Edit/View, reports an exact 1280 by 720 client and 640 by 480 minimum at 96
DPI, and manually passed every File/Edit/View menu click, title drag,
maximize/restore, minimize/focus return, aspect-fit fullscreen, exact windowed
placement restore, rounded restored corners, and both minimum resize axes. The
instrumented host stopped at a 642 by 532 visible frame,
exactly the 640 by 480 client plus border/title/menu chrome. The menu/fullscreen
round trip returned to 162-165 native presents with zero wait timeouts.

The DPI follow-up keeps the standalone thread in per-monitor-v2 awareness,
reports the effective window/menu DPI, and stores the last normal logical
client size independently of whichever menu metrics Windows has already
switched during `WM_DPICHANGED`. It applies the suggested monitor rectangle and
then restores that stored logical client size with the new DPI's non-client
metrics. A live 100%-to-125%-to-100% transition retained an exact 1280 by 720
logical host (1600 by 900 physical at 125%, then 1280 by 720 physical at 100%)
and a 640 by 480 logical minimum. The menu can apply a consumer-requested 1.25
scale floor without changing the title bar, renderer, process scale, Windows
settings, or higher monitor scale. Its owner-drawn path retains the real HMENU,
system colors/font, keyboard mnemonics, command routing, and `MSAAMENUINFO`
accessibility metadata.

Shared-texture imports now mark the copied source frame dirty before Electron's
pooled texture is released. This closes the non-continuous-session hole where
the frame was copied but never presented. With the consumer's production
policy changed to `continuousPresent: false`, ordinary animated gameplay drove
both source and native presentation at roughly 159-165 FPS on the 165 Hz
display. Activating the real checkout automatically restored overlay-driven
continuous presentation: the source ran roughly 140-146 FPS and native
presentation roughly 155-162 FPS, with zero frame-latency wait timeouts and
zero slow shared-texture copies. Checkout was cancelled without authorization.

The local native linker now considers both Cargo's target release directory and
its `deps` directory and chooses the newest matching addon, preventing a stale
top-level DLL from masking current source changes. Native build/check and API
audit subprocesses no longer use deprecated Windows shell argument handling.
The final native review also closes an error-only ownership gap: if Windows
rejects insertion of a newly built owner-drawn menu item, the still-unattached
submenu is destroyed before the partial parent menu is torn down.

`steam-bridge@0.2.14` is npm `latest`. The earlier registry-backed checkout pass
that led to `v0.2.10` exposed one unhandled Steam window shape: closing a recurring
checkout approval surface creates a separate visible, enabled, foreground
top-level window titled `Steam Dialog`, class `SDL_app`, from
`steamwebhelper.exe`. It has no owner while the bridge's standalone D3D11 host
remains dimmed, so the confirmation appears outside the game host instead of
behaving as its modal. Cancelling the transaction from that dialog closes it,
returns to the game, and authorizes nothing.

The published repair forwards overlay-active state into the native surface.
On Windows standalone hosts only, it snapshots matching dialogs when the
overlay activates, then at a bounded cadence adopts only a newly appearing,
visible, unowned exact-title/exact-class window whose process image basename is
`steamwebhelper.exe`. The bridge assigns the game host as owner, centers the
dialog over the host client area, follows host move/resize, and restores the
original owner and rectangle on deactivation or host teardown. Existing Steam
dialogs and attached managed presenters are excluded. Diagnostics retain the
baseline, adoption count, current owner, and rectangles. In the optimized
source-linked run, the live dialog's owner exactly equalled the native host, its
rectangle was centered over the host, Cancel Transaction removed it cleanly,
and gameplay resumed with the subscription not authorized.

The published sizing repair treats standalone `clientWidth` and
`clientHeight` as logical pixels, scales them with the system DPI before
`AdjustWindowRectExForDpi`, and centers/clamps the resulting outer rectangle in
the primary usable work area. On the 225%-scaled development display, the
source-linked game now opens with an exact 1280 by 720 logical client instead
of a tiny top-left surface. Live restore, maximize/restore, minimize/focus
return, title drag, mapped input, the custom cursor, and ordinary Steam overlay
rendering preserve the corrected geometry. The consumer's real checkout URL is
now routed with Steam's supported modal web-page option; the live one-time Buy
route rendered as a large centered checkout surface, closed without
authorization, and left the ordinary Shift+Tab overlay working independently.

The underlying Windows product path remains the top-level Win32 D3D11 game
host introduced by the `0.2.x` series. It uses Electron offscreen shared
textures, a bridge-owned copy before Electron releases its pool texture,
two-buffer flip-sequential presentation, source-aspect preservation,
per-monitor DPI,
display-rate presentation, Windows 11 restored corners, title drag, edge
resize, minimize/maximize/restore, monitor fullscreen, focus parking, and the
managed Electron-owned Steam presenter surface. The diagnostic `WS_CHILD`
experiment is not the product path because Steam activates but does not render
reliably into that child swap chain.

Exact `v0.2.0` through `v0.2.7` remain immutable rejected evidence from the
progressively hardened import, activation-style, lifecycle, modal-target, DPI,
panel-refinement, and receipt-contract gates. `v0.2.8` corrected the final
owned-popup and passive-notification receipt assumptions and was published.
`v0.2.9` is the cursor-suppression predecessor. `v0.2.10` adds exact Steam
checkout-dialog adoption. `v0.2.11` corrects logical standalone client sizing
at high DPI and carries a fresh full live proof and downstream registry-backed
pass. Exact `v0.2.12` at `2b66ef4` passed CI, Release assembly, independent
tarball verification, protected deployment, and public Steam readiness, but is
rejected and unpublished. During persistent-reuse close proof Steam replaced a
just-proved bright/spinner frame with its blank navigation frame before the
exact pre-dispatch screenshot. The probe correctly sent no input, but
incorrectly made that transient invalidation terminal. The retained failed
roots and immutable tag are diagnostic evidence only.

The `v0.2.13` repair kept the same fail-closed boundary: input remained
forbidden unless the exact pre-dispatch screenshot proves the current Steam
panel and close target. A transient frame replacement now records an explicit
readiness-invalidation event and retries inside the existing overall deadline.
The semantic auditor requires every extra readiness proof to have exactly one
ordered invalidation before the final successful proof for that cycle. Package
smoke also now derives Steam userdata IDs with native path components instead
of literal POSIX separators, so the Linux fixture is valid under both POSIX and
Windows-native Python hosts. Exact `v0.2.13` passed main/tag CI, Release
assembly, independent candidate verification, protected deployment, the
three-cycle persistent profile, all four checkout cases, and all ten shortcut
routes. Its managed profile then stopped fail-closed on the fully rendered
Friends panel. The coarse close-glyph scan had forced an even coordinate
origin, permanently skipping a valid close glyph centered on the other Y
phase. After that was repaired, a generic brightness sampler still rejected
Friends' intentionally near-black navigation strip even though the direct
close glyph, modal backdrop, geometry, and loaded content were all proved.
No input was sent in either rejected run, no process crashed, and the tag is
unpublished diagnostic evidence only.

The `v0.2.14` repair preserves each screenshot search rectangle's coordinate
phase and accepts the directly sampled, thresholded close glyph as chrome
evidence for the black-navigation layout. It does not relax dispatch: exact
glyph score/coordinates, modal containment, dark backdrop, loaded content,
foreground ownership, and the exact pre-dispatch frame remain independently
mandatory. A focused protected-candidate Friends rerun found the glyph at its
actual coordinate with a 15/16 score, dispatched one bounded click, completed
the active/inactive/park lifecycle, retained Steam continuity, deleted its
task, and passed the independent semantic summarizer with zero crashes.
The final immutable candidate then passed all four ordered profiles: 31/31
clean cases, 27 active Steam routes, one unchanged protected candidate and
Steam identity, and zero crashes. The exact npm tarball and five GitHub Release
assets were independently verified before and after trusted publication.

## Consumer Evidence

FOV4 commit `04769fd` (`Port native host to Steam Bridge 0.3.8`) is pushed to
`master`. Its manifest, lockfile, and ordinary non-link install resolve exact
registry `steam-bridge@0.3.8` with the published integrity above. The final
registry-backed actual-game smoke opened the ordinary Friends overlay at the
same 1280 by 720 client bounds, closed it with Escape, returned to the game,
and shut down with empty stderr. The broad immutable candidate pass also
covered exact 640 by 480 minimum sizing, title move, native menus,
maximize/restore, minimize/restore, focus loss/return, fullscreen/restore,
rounded bottom corners, cursor behavior, overlay alignment, and clean close.
The consumer passes 16/16 tests, ESLint, TypeScript, 705 verified registry
signatures, and 132 verified attestations.

The remaining consumer paragraphs are retained historical evidence from the
`0.2.x` qualification path; they do not override the current `0.3.8` state.

The Electron game consumer now has an exact non-junction registry install of
`steam-bridge@0.2.14`; its manifest and lockfile bind the published tarball and
integrity. The opt-in FPS report measured both Electron paint/
shared-texture arrivals and native presenter frames across game and checkout-
overlay phases without changing normal execution. The source ran at roughly
146-150 FPS while the native presenter held roughly 163-165 FPS against the
164.766 Hz DWM cadence. Native diagnostics measured a 1280 by 720 logical
client, 640 by 480 logical minimum, attached menu, 96 DPI, and the 165 Hz
target. File/Edit/View menu interaction, title drag, maximize/restore,
minimize/focus return, fullscreen round trip, and an exact 640 by 480
minimum-client resize passed. A fresh 2026-07-19 clean restart repeated the
exact 1280 by 720 default client, keyboard and mouse menu traversal, title drag,
minimum resize, maximize/restore, minimize/focus return, and fullscreen aspect
preservation. Buy and subscription routes opened at the correct size in both
default and manually resized hosts; Escape closed them without authorization,
and the adopted Steam confirmation dialog remained centered after a focus
round trip. The process then shut down cleanly. A prior synthetic Shift+Tab
injection was not accepted by Steam, so it is not counted as ordinary-overlay
proof.

The final DPI and presentation pass removed the process-wide Chromium
`force-device-scale-factor` override. The bridge owns PMv2 conversion,
non-client/menu metrics, minimum tracking, DPI-transition geometry, and the
one-shot/continuous presentation contract; the consumer owns the 1280 by 720
logical viewport, 640 by 480 minimum, 1.25 menu floor, and non-continuous game
policy. The hidden Electron renderer reconciles its content size after a host
DPI change without changing the game aspect ratio. Live testing at 100%, 125%,
and the earlier 225% environment passed title drag, edge resize, minimum size,
rounded corners, maximize/restore, minimize/focus return, fullscreen round
trip, menu keyboard/mouse input, aspect-preserving rendering, and real checkout
open/cancel at both default and manually resized host sizes. The overlay stayed
inside the game client and did not collapse into the former tiny top-right
surface.

The Electron game consumer was linked to `packages/steam-bridge` while the
sizing repair was developed, then returned to an exact non-junction registry
install of `steam-bridge@0.2.11`. At 225% Windows scaling, the requested 1280 by
720 logical client measures 1282 by 750 including native chrome. The
source-linked pass exercised title drag, resize, minimize, maximize/restore,
focus return, aspect preservation, cursor behavior, ordinary overlay, and the
real one-time Buy route. The consumer opens checkout URLs through
`activateToWebPage(url, { modal: true })`; the Buy page rendered as a large
centered Steam surface and was cancelled without authorization.

After npm publication, the consumer lockfile resolved the exact registry
tarball and integrity and `node_modules/steam-bridge` was verified as a normal
directory at `0.2.14`. The final registry-backed process repeated the exact
1280 by 720 client geometry, native File/Edit/View menus, title drag,
maximize/restore, minimize/focus return, aspect-fit fullscreen, exact 640 by
480 minimum-client sizing, and checkout open/cancel without flicker, hang, or
crash. The minimum-size checkout pass exposed a consumer compositor issue:
Steam hooked both the fixed offscreen Electron surface and the visible native
host, so differently scaled viewports revealed the same overlay twice. The
consumer now retains its last clean game frame while Steam is active and lets
Steam composite only into the visible host. A repeat at the exact minimum
showed one centered checkout surface; Escape returned to a fresh game frame and
authorized no transaction. Consumer commit `44b8928` is pushed to `master`.

## Historical `v0.2.14` Release Evidence

Source and automation:

- commit `3d0678bbe4d8c98c3511904aedcbdbead0250cf6`;
- tag CI `29681862974` and Release assembly `29681862973` passed, including
  macOS arm64, Linux x64, Windows x64 prebuilds, package assembly, and packaged
  Electron validation;
- trusted npm publication `29682898297` passed after restoring the exact
  candidate-bound receipt in the `npm-production` environment;
- public GitHub Release: <https://github.com/jstroh/steam-bridge/releases/tag/v0.2.14>.

Candidate identity:

- npm tarball SHA-256
  `70de36d8b5c9e5f76a4957f4392023ffdd825d94a101de20336513a6840b8947`;
- Windows archive SHA-256
  `6498a57fa8921677f82e47af1ec3747abb2304ab3d2f3aa14bb7ff803b70b7a2`;
- Windows bundle content: 114 files, 398,368,378 bytes, SHA-256
  `de6d5e5166d9f1b2efe23ae471815d2c0ce1b2a2d43cea9acef9ca69a859ef12`;
- native binding: 1,129 methods, declaration SHA-256
  `7cce9c4c750e754c8b804e6cb7d9ba6a0526d0e03cd16adb8c3f78c5a3c23bf8`;
- candidate binding SHA-256
  `b80aa46d8ea63d70d48bb13fa9fe5ccfe5af5d374a294d627697d6c40876dbe8`;
- live-proof receipt semantic SHA-256
  `3daadf8eca5ca79efc71b000c7b69198ee7917498b8d8ca5d1f514676d6d4509`.

The exact protected candidate passed the four required profiles in order:

- `persistent-reuse`: 1 case, 3 active open/close/park cycles;
- `checkout`: 4/4 cases, 3 active routes;
- `shortcut-routes`: 10/10 active routes;
- `managed-routes`: 16/16 cases, 13 active routes.

That is 31/31 clean cases and 27 active Steam routes with D3D11
presenter/host/renderer agreement where applicable, authenticated foreground
handoff, high-DPI target containment, visible modal-frame checks, clean
close/park/focus return, canonical candidate protection after every profile,
one continuous Steam identity, and zero crashes.

All four profiles ran in the required order against one unchanged protected
candidate and one Steam identity. The npm registry tarball is byte-identical to
the audited Release tarball. npm reports the package's SLSA provenance, and the
consumer-wide `npm audit signatures` verifies 705 registry signatures and 132
attestations. All five GitHub Release asset digests match their retained local
files. The release-scoped GitHub proof secret was deleted after publication.

## Verification

Current `v0.3.8` verification is complete: 203/203 Steam Bridge tests pass with
zero skips, the full cross-platform package smoke and exact Windows packaged
native-load gate pass, tag workflow `29973234900` passes all release jobs, the
candidate-bound actual-game receipt passes, all five public GitHub Release
assets match retained local digests, the registry tarball is byte-identical to
the audited candidate, and npm provenance is present. FOV4's exact registry
consumer passes 16/16 tests, ESLint, TypeScript, signature/attestation audit,
and the focused post-publication actual-game smoke. The temporary release proof
secret was deleted after publication.

The remaining paragraphs in this section are retained historical verification
for `v0.2.14`; they are not the current release status.

The reviewed `0.2.14` source passes 206/206 repository tests, TypeScript, Rust
format and compile checks, the platform policy, Steam API coverage, and the
complete package smoke on Windows with the available Git Bash host. The first
smoke invocation correctly exposed that `bash` was absent from the default
PowerShell path and that the available Windows-native Python needed an explicit
Git-Bash path/home adapter; rerunning with those host tools supplied completed
the gate. The package fixture's separator bug was fixed in source rather than
hidden by the adapter. Strict workspace Clippy remains an informational baseline
failure across generated compatibility declarations and longstanding crate-
wide lints; the required zero-warning release checks are Rust formatting and
compilation. The consumer passes ESLint, TypeScript, 4/4 tests, and its
optimized renderer build. Commit, exact-candidate proof, publication, release
assembly, registry verification, and the final consumer pass are complete.

The published source tree passes 206/206 repository tests, Rust format
and compile checks, the API and platform audits, and the focused standalone
sizing unit tests. The consumer passes 4/4 tests, TypeScript, ESLint, and the
optimized renderer build. The source-linked process produced the large centered
one-time checkout open/cancel without authorization. The final registry-backed
process retained the measured 1282 by 750 outer window for a 1280 by 720 client
and repeated window-state and ordinary-overlay interaction.

Bridge gates for the exact source passed:

- `npm test`: 206/206;
- platform policy, Rust formatting and compilation, API coverage, package
  smoke/dry-run, diff checks, Windows package assembly, and packaged Electron
  native-load validation;
- exact Windows protected deployment, candidate fingerprint/ACL re-audit, four
  live profiles, receipt generation, trusted publication, registry integrity,
  signature, provenance, and Release-asset digest verification.

Consumer gates on registry `0.2.14` passed:

- 4/4 tests, TypeScript, ESLint, optimized Next renderer build;
- exact non-junction install, lockfile integrity, registry tarball byte identity,
  package signatures, and provenance;
- live 1280 by 720 geometry, title drag, minimize/focus return,
  maximize/restore, aspect-fit fullscreen, exact 640 by 480 minimum sizing,
  single-surface checkout at default and minimum size, and clean cancel return.

## Operational Notes

- Windows production invariant: use one standalone top-level native D3D game
  host with Electron offscreen. Attached `popup-layered`, the unparented
  overlapped comparison, `owned-popup`, popup-region synchronization,
  retained-frame resize stretching, and the no-Steam-pixels `WS_CHILD`
  experiment are closed paths. Attached Windows mode must fail clearly and must
  not fall back between these models.
- The JavaScript boundary now rejects every Windows `nativeWindowHandle`
  attachment before it claims a surface lease or invokes the native addon. The
  unreachable deferred-attach presenter branch and its Windows popup-era tests
  were removed. Platform-neutral presenter lifecycle and ownership coverage
  remains active under supported Linux attachment; a Windows regression proves
  raw attach, session attach, presenter attach, and default managed Electron
  attach all reject without native attach/detach calls, after which a standalone
  session still opens and closes normally.
- Shared-texture import now classifies device-loss HRESULTs at the point of
  detection. A successful adapter/swap-chain rebuild increments both loss and
  recovery telemetry; a failed rebuild leaves the surface marked device-lost
  for the next valid shared texture. Native check/test, TypeScript, the
  standalone receipt self-test, and all 203 active repository tests pass with
  zero skips after this review.
- The standalone receipt no longer accepts a single best FPS sample or ignores
  Steam-overlay-active pacing. It requires at least three synchronized,
  non-minimized game samples and three synchronized overlay samples. A target
  within 1 Hz of the current display is steady state; at most three otherwise-
  valid target/display transition samples may be excluded, while four fail the
  proof. It requires median Electron paint plus native present FPS to reach 95%
  during the game phase, and median native present FPS to reach 95% while Steam
  owns the visible overlay frame. Overlay-phase Electron paint FPS remains
  reported but may be zero. Critical consumer files, the evidence manifest,
  and both logs must be real in-root files rather than symlink or reparse
  escapes, and the consumer runtime is re-read after validation to detect
  mutation during receipt generation.
- During implementation, run only tests and live transitions affected by the
  current edit. Run the complete cross-platform/release matrix once, after the
  implementation is stable and immediately before publication.
- App ID `480` proves public Steam overlay plumbing and synthetic routing only;
  it does not prove a real commercial authorization.
- Opening and cancelling checkout/subscription panels is allowed proof; never
  finalize a purchase or subscription during smoke testing.
- Do not move or reuse a release tag. A code or native-runtime change requires a
  new version, new exact artifacts, and fresh candidate-bound live proof.
- Preserve failed release roots as diagnostic evidence; receipts may contain
  only complete clean roots from one unchanged candidate and Steam identity.
- The checkout contains unrelated user-owned `AGENTS.md`, `.codex`, and input
  probe files. They must remain unstaged and untouched.

## 2026-07-22 Windows actual-game exhaustive QA update

An actual FOV4 game pass was run from
`C:\Users\admin\source\fov4-steam` with Steam Bridge QA overlay and FPS
reporting enabled. Receipts live under
`C:\Users\admin\steam-bridge-artifacts\fov-windows-exhaustive-qa-20260722-205311`.

Covered launch, menu clickability, fast title drag, resize sweeps, exact
`640x480` logical minimum, maximize/restore, minimize/restore,
fullscreen/restore, focus loss/return, Friends overlay open/close, 165 Hz,
60 Hz, high DPI, and `1280x800` low-resolution mode. The overlay stayed bounded
to the client and did not reproduce the old purple/tiny/full-chrome/seam/crash
failures.

Important result: game presentation hits the active display target at both
60 Hz and 165 Hz after transitions. The initial exhaustive pass found
Steam-overlay-active presentation visually correct but paced around 130-133 FPS
median on the 165 Hz display, below the 95% high-refresh pass threshold.

A focused local-source repair retest then linked the unpublished Steam Bridge
build into FOV4 and repeated only that failing 165 Hz Friends-overlay scenario.
Receipts live under
`C:\Users\admin\steam-bridge-artifacts\fov-windows-overlay-165-focused-20260722-212404`.
The display was switched from `1920x1200@60` to `1920x1200@165` for the retest
and restored to `1920x1200@60` afterward. The overlay stayed bounded to the
game client, no FOV/Electron process remained after close, stderr was empty,
and 48 overlay-active 165 Hz samples produced `163.75 FPS` median native
present against the `156.75 FPS` pass threshold. Treat this individual finding
as green; do not reopen retired popup, owned-popup, or `WS_CHILD` presenter
paths for it.

Final Windows actual-game QA then passed after the individual failures were
green. Receipts live under
`C:\Users\admin\steam-bridge-artifacts\fov-windows-exhaustive-qa-final-20260722-2230`.
The final run covered actual-game launch into the world, Steam startup toast,
File/Edit/View menu clicks, title drag, fast drag, resize, minimum clamp,
maximize/restore, fullscreen/restore, focus away/back, baseline overlay,
60->165 Hz live transition, 165 Hz game hold, 165 Hz overlay, `1280x800@60`
low-resolution overlay, restore to `1920x1200@60`, `200%->100%` scale change,
overlay at `100%`, restore to `200%`, and clean File -> Exit. The overlay
remained bounded to the client with no chrome coverage, no right/bottom seam,
no tiny top-left Steam surface, no steady flicker, no crash, empty stderr, and
no leftover Electron process. Display settings were restored to
`1920x1200@60` and `200%` scale.

Final representative medians were: baseline 60 Hz overlay `59.9 FPS`, 165 Hz
overlay `162.65 FPS`, 165 Hz steady-state game surface `157.55 FPS` against
the `156.75 FPS` pass threshold, low-resolution overlay `59.9 FPS`, and
`100%`-scale overlay `59.9 FPS`. High-refresh game-surface scoring must use
steady-state windows after the live mode transition and outside overlay
open/close boundaries; transition-contaminated all-sample medians are useful
diagnostics, not the pass/fail number.

The current fixes validated by the pass are Steam Bridge's Windows standalone
display-synchronized immediate pump scheduling and FOV4's renderer display /
`webContents.setFrameRate()` refresh pulses after live display or DPI changes.
Going forward, if a QA item fails, fix and focused-retest only that item until
it is green. Run the full exhaustive Windows actual-game pass only after every
known individual failure is green and immediately before a release decision.
