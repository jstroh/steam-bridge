# Current Work Checkpoint

Last reviewed: 2026-07-17

Review anchor: `44fca9e` (`Fix Windows DPI proof for physical presenter bounds`).

## Active Goal

Release-gate `steam-bridge@0.2.7`, whose code-bearing predecessor adds the verified
Windows top-level D3D11 game host, Electron shared-texture ingestion, native
input delivery, production window-state behavior, an interactive owned-popup
focus fix, and display-rate presentation control. The new candidate also makes
the Windows managed-route proof fail closed on the actual inset Steam modal,
sequences repeatable achievement mutations through Steam's stored callbacks,
and gives delayed passive notifications a bounded 20-second evidence window.
Published `steam-bridge@0.1.6` remains the unchanged predecessor. Exact
`v0.2.0` through `v0.2.3` are preserved as rejected product evidence. Exact
`v0.2.4` passed CI and Release assembly and its product behavior passed protected
persistent and checkout profiles, but its immutable proof harness could mistake
the still-light smoke UI for Steam's first modal frame during shortcut coverage.
It was not published. `0.2.5` rejects that frame, searches narrower Steam panels
within bounded DPI-aware geometry, and recomputes the glyph from the exact
pre-dispatch screenshot. It also combines candidate copy, protection,
transactional activation, rollback, and re-audit behind one elevation prompt.
Exact protected `v0.2.5` completed all 31 product cases and 27 active overlay
routes, but its receipt auditor incorrectly reinterpreted already-physical
Windows presenter bounds as logical DIPs. `0.2.6` corrects that evidence model
by independently reconciling native-window DPI with authenticated renderer DPR
and physical-client/renderer-viewport geometry. Exact protected `v0.2.6` then
completed all three persistent opens and closes, but its packaged auditor
required cycle one's initial ready-panel bottom edge to equal the later exact
pre-dispatch frame. `0.2.7` permits only that vertical bottom/height refinement
while requiring the same glyph-bound target, left/top/right panel anchor,
physical scale, click containment, and independently valid panel evidence.

## Current State

The Windows native host is a normal top-level Win32 window with a two-buffer
flip-discard D3D11 swap chain. It preserves source aspect ratio, keeps Steam
inside the native client area, respects Windows 11 restored-window corners,
and implements title drag, edge resize, maximize/restore, minimize/restore,
monitor fullscreen, focus parking, DPI changes, modal move/size repaint, and
cursor suppression. A bounded native queue carries mouse, capture, wheel,
keyboard, text, focus, blur, close, and window-change events to the JavaScript
session owner.

Electron offscreen frame textures now use the documented process-local NT
handle path. The bridge reads the shared-resource adapter LUID, creates the
host on Windows' high-performance DXGI adapter with a compatibility fallback,
opens every pooled texture with `ID3D11Device1::OpenSharedResource1`, and copies
it into a bridge-owned shader-resource texture before returning control to
Electron. The caller can therefore release Electron's pooled texture
immediately. The previous BGRA `updateFrame()` path remains as a bounded CPU
fallback; GDI presentation is absent.

The source-linked consumer uses an exact Electron `43.1.1` offscreen shared
texture and the optimized local addon. Live gameplay rendered at the active
display rate without purple startup pixels, idle flicker, top-left shrink, or
aspect distortion. The same run passed title drag, maximize/restore,
minimize/restore, focus loss/return, Alt+Tab, F11 enter/exit, rounded restored
corners, native chrome controls, mapped mouse input, one-time purchase overlay,
and recurring-subscription overlay. Both Steam panels rendered inside the game
client rather than over native chrome; close/cancel returned to gameplay without
authorizing a purchase or subscription. Diagnostics retained the selected
high-performance adapter, D3D feature level 11.1, exact source dimensions,
successful presents, increasing shared-texture imports, and zero upload
failures.

Native sessions now accept `frameRate`, expose `setFrameRate(...)`, and report
their frame rate and pump interval. The timer wakes just ahead of the selected
display cadence while Windows `Present(1)` synchronizes to vertical blank. The
native continuous-present debounce is 1 ms instead of a product-level 32 ms
cap. Opt-in `continuousPresent` has one timer-owned present path, so Electron
texture updates cannot double-pump the swap chain; the default remains false.

Automation could not make Steam accept a synthetic global Shift+Tab chord, so
that run does not claim physical hotkey deactivation. More importantly, this
consumer run is development evidence, not the repository's publication proof.
Because `0.2.7` carries the corrected immutable release auditor,
the exact protected packaged candidate still requires fresh public
`persistent-reuse`, `checkout`, `shortcut-routes`,
and `managed-routes` roots and a valid 31-case / 27-activation sanitized receipt
before npm publication.

The exact protected `v0.2.5` Release candidate passed persistent-reuse,
checkout, shortcut-routes, and managed-routes behavior. All 31 cases and 27
active overlays completed with clean candidate/process/task/Steam continuity.
Receipt generation then failed closed because the auditor derived scale `1`
from equal physical presenter/native-host bounds while the authoritative window
DPI and authenticated renderer geometry both proved `2.25`. Cycle two also
legitimately refined its current-panel height from the exact pre-dispatch frame,
which the immutable auditor rejected despite an unchanged glyph, coordinate,
scale, host, and top-edge tolerance. No receipt or publication was attempted;
`v0.2.5` remains immutable rejected evidence.

Exact `v0.2.6` at `44fca9e` passed main CI `29623694561`, tag CI
`29623786452`, and Release assembly `29623786437`. Its exact 114-file,
398,227,165-byte Windows candidate passed transactional deployment and all three
persistent open/close/park cycles with unchanged candidate and Steam identity.
The packaged auditor still rejected cycle one because the ready frame's panel
bottom/height refined before the exact pre-dispatch screenshot. The target's
glyph, coordinates, scale, host, left/top/right panel anchor, and click
containment were unchanged. No other profile, receipt, or publication was
attempted; `v0.2.6` remains immutable rejected evidence.

The exact protected `v0.2.4` Release candidate passed the persistent-reuse and
synthetic checkout profiles unchanged. Its shortcut-routes profile then failed
closed: the first readiness screenshot preceded Steam's rendered modal, a broad
fallback matched light smoke-application pixels, and the final click did not
close Steam. The candidate remained byte-identical and write protected. The
`0.2.5` harness now requires Steam's dimmed modal backdrop for every direct web
close, carries the detected panel through one analysis pass, and independently
resolves and validates the target again from the exact before-send frame. A
fresh source-linked 16/16 managed-routes run passed after that repair, including
web, store, Friends, dialog, shortcut keyboard, profile, players, community,
stats, achievements, user, progress, and unlock coverage.

The rejected `v0.2.0` tag exposed two standard Windows imports that the
fail-closed artifact verifier had not yet classified: `comctl32.dll` for native
window subclassing and `d3dcompiler_47.dll` for the D3D presentation shaders.
The replacement verifier explicitly accepts both system components, retains
the static CRT and arbitrary third-party DLL rejection rules, and passes both
its synthetic regression test and the exact locally packaged native binary.
Exact `v0.2.1` passed CI and Release assembly, but formal proof rejected its
interactive attached presenter because `WS_EX_NOACTIVATE` remained set. The
replacement keeps `WS_EX_NOACTIVATE | WS_EX_TRANSPARENT` only while parked,
removes both while Steam is interactive, and activates only while the visible
parent permits the surface. Exact `v0.2.2` then passed CI and Release assembly,
but its candidate-bound managed-route proof exposed an asynchronous achievement
clear/store race and close-glyph evidence that could fall back to an unproved
target. Development follow-up also caught a false outer-host glyph match and a
progress toast arriving at the old 10-second boundary after a long route
sequence. The replacement waits for a fresh `UserStatsStored` callback before
progress or unlock mutation, requires every web close to use a directly detected
glyph inside an inset modal panel, independently audits that panel geometry,
and allows 20 seconds for passive toast presentation. None of the four failed
tags may be moved, reused, or published. Exact `v0.2.3` then passed main CI
`29592224120`, tag CI `29592471104`, and Release assembly `29592467768`, but
its first protected persistent-reuse root exposed a final-cycle lifecycle
race: the native presenter parked successfully, while the smoke result was
snapshotted 42 ms before its third typed inactive callback. The same run also
retained a recovered Electron frame-capture error in `lastError`, causing the
authenticated final close audit to fail. The `0.2.4` replacement awaits one
fresh active and inactive callback in every reuse cycle, keeps monotonic
callback counters outside the bounded event log, serializes nested smoke
errors, and clears only the exact recovered capture error after a later frame
upload succeeds. `v0.2.3` remains immutable rejected evidence; `v0.2.4` is the
fresh candidate. A first corrected development run completed three typed
callback pairs but exposed a separate proof-auditor assumption: an asynchronous
stability sample from cycle two can legitimately remain alongside the final
shutdown sample. The auditor now accepts one to three samples for a three-cycle
reuse case, selects the final sample for the shutdown handshake, requires that
sample after result/keep-open and before completion quit, and still rejects zero
or more than one sample per cycle. Focus return and the final asynchronous
sample may occur in either order while both remain bounded by reuse completion
and completion quit.

The next exact development run exposed a second independent race in the
physical-close harness: cycle three could reuse cycle one's close coordinate
while Steam was still showing a dark pre-modal frame. The harness now requires
each later cycle to detect a fresh substantial Steam panel whose top edge aligns
with cycle one's directly proved modal within eight logical pixels, while still
binding the click to cycle one's glyph-derived coordinate, the same native HWND,
unchanged host rectangle, current DPI, focus, and a fresh screenshot. It ignores
short pointer-glow fragments before looking for the real panel. The packaged
auditor requires schema 2 at the root and case levels and binds the sole
`probe:web-close-ready` record in each cycle to the dispatched target. A
behaviorally clean intermediate run was correctly rejected when the case
projection omitted that schema field. The final exact-source development package
and run include the corrected projection.

The true `WS_CHILD` experiment remains diagnostic because Steam activates but
does not render into its child swap chain. The repaired attached owned popup is
supported only as the managed, content-bounded overlay presenter; it is not the
standalone Windows game-host design.

The checkout contains unrelated local `AGENTS.md`, `.codex`, and input-probe
changes that belong to the user and must remain untouched.

## Last Verification

- `npm run native:build` produced the exact optimized
  `x86_64-pc-windows-msvc` addon and linked it into the package. The
  source-linked consumer resolves the same bytes.
- `npm test` passes all 206 tests after the callback, modal-geometry, and
  passive-notification timing review, plus TypeScript, Electron-version,
  shortcut, all Windows package-gate self-tests, the final-cycle callback
  regression, and recovered-frame-error regression.
- `npm run example:package:win` builds the `0.2.7` Electron `43.1.1` unpacked
  app, verifies all 1,127 required native methods and their declaration hash,
  passes the packaged matrix self-test, and loads the exact addon through the
  packaged executable. The package path retains argument-safe npm invocation
  on Windows and the matrix summarizer's fingerprint dependency.
- `npm run native:fmt`, bridge typecheck, consumer typecheck, consumer lint,
  consumer 4/4 tests, consumer main-process syntax, and `git diff --check`
  pass.
- `npm run check:platform`, `npm run native:check`, and `npm run api:check`
  pass. The API audit retains 1,127 required native methods.
- `npm run package:smoke` passes the package consumer, native manifest, Windows
  helper static contracts, candidate ACL self-test, and combined deployment
  self-test before reaching the documented Git-Bash/Linux shortcut-discovery
  path-translation mismatch. Exact CI must run the POSIX fixtures natively. No
  WSL or host reconfiguration was introduced.
- The latest manual consumer matrix passed gameplay, mapped input, window-state
  and focus transitions, shared-texture presentation at the current display
  rate, one-time checkout activation/close, and recurring-subscription
  activation/cancel without authorization.
- A full source-linked persistent run passed native/render gates, its foreground
  grant, all three exact close/park cycles, input and lifecycle audits, strict
  verification, cleanup, and unchanged Steam identity. It is development
  evidence and does not replace candidate-bound proof.
- The rebuilt development package passed focused achievement-progress and
  achievement-unlock reruns, plus an uninterrupted 16/16 managed-routes run.
  All 13 active routes had
  clean close/park lifecycles; every web route directly targeted a glyph inside
  the scale-aware inset modal panel; progress and unlock both recorded their
  stored callbacks, false-to-true needs-present transitions, passive parking,
  zero crashes, complete cleanup, and unchanged Steam continuity.
- The exhaustive Steam API coverage audit passes against all 1,127 required
  native methods, SDK exports, callback aliases, facade helpers, shim
  references, and generated enum constants. Clean GitHub CI must repeat it
  before a tag candidate is created.
- GitHub CI run `29575410461` passed the Windows, Linux, macOS, package-smoke,
  and API gates for commit `2a24089`. Tag Release run `29575564317` built all
  three platform prebuilds but correctly rejected `v0.2.0` before artifact
  assembly because the Windows system-DLL allowlist lacked the new native host
  imports. Nothing was published.
- Commit `9837ff5` passed main CI `29583417694`, tag CI `29583616413`, and tag
  Release assembly `29583614808` for `v0.2.2`. The downloaded exact candidate
  was protected and audited, but the managed-route proof rejected it before
  receipt generation or npm publication. The tag remains immutable evidence.
- Commit `fed9b83` passed main CI `29592224120`, tag CI `29592471104`, and tag
  Release assembly `29592467768` for `v0.2.3`. Its exact 114-file protected
  package completed all three persistent reuse opens and physical closes, but
  the independent packaged auditor rejected the missing third inactive event
  in the result projection and a stale recovered `lastError`. No receipt or npm
  publication was attempted, and the tag remains immutable rejected evidence.
- Rejected development roots are retained for the recovered-error lifecycle
  race, dark pre-modal false readiness, pointer-fragment panel miss, and omitted
  per-case schema projection. They are diagnostic evidence, not release proof.
- The final protected local `0.2.4` package at
  `C:\Users\admin\steam-bridge-artifacts\windows-v0.2.4-dev-asar-panel-v4-20260717-101239`
  contains 114 files, all 1,127 native methods, the current callback/error
  fixes, and the current packaged
  schema-2 auditor. Exact-source root
  `C:\Users\admin\steam-bridge-artifacts\windows-v0.2.4-dev-persistent-panel-v4-20260717-101426`
  passed candidate binding, canonical ACL, native/render/readiness gates, one
  foreground grant, all three overlay opens and physical closes, three active
  and three inactive callbacks, final clean detach with no unrecovered error,
  exact packaged summary, task/process/environment cleanup, and unchanged Steam
  identity. Cycles two and three both proved a current substantial Steam panel
  aligned to the baseline modal before input. Retained-image checks reject both
  dark pre-modal frames (39- and 147-logical-pixel top deltas) and accept the
  rendered modal (one-logical-pixel delta). The auditor regression accepts one
  legitimate asynchronous stability sample per cycle and rejects missing or
  excess samples.
- The corrected Windows verifier self-test passes and accepts the complete
  import table of the exact local 8,130,560-byte addon while continuing to
  reject dynamic MSVC/UCRT and arbitrary non-system dependencies.
- Exact `v0.2.4` Release run `29600153021` assembled the audited npm tarball and
  114-file Windows candidate. The protected candidate remained bound to content
  SHA-256 `2269d27e34d8b9b83c50e379dc900ec1ecacab7e712f5e558e8fb714b22474d4`
  and binding SHA-256
  `7244e3d462f69bde16e2c6a892b001f495e9e6a712086dd0690bc5645e4f7791`
  throughout the partial proof. Persistent-reuse and checkout passed; the
  shortcut proof failure was preserved and no publication was attempted.
- Exact `v0.2.5` main CI `29620892207`, tag CI `29621012453`, and Release
  assembly `29621012452` passed. Its protected four-profile live run completed
  31/31 cases and 27/27 active overlays, but the receipt failed on the physical-
  bounds scale-model mismatch above. The corrected auditor self-test passes,
  and all four preserved roots now summarize with zero failures and warnings.
- Exact `v0.2.6` main CI `29623694561`, tag CI `29623786452`, and Release
  assembly `29623786437` passed. Its protected persistent behavior completed
  three opens, closes, and parks, but the immutable auditor rejected cycle one's
  vertical ready-panel refinement. The failed root and exact candidate remain
  protected and preserved; no receipt or publication was attempted.
- Local `0.2.7` passes 206/206 tests, platform policy, native formatting and
  compilation, API coverage, Windows example packaging, the packaged all-1,127-
  method native-load probe, and the auditor self-test. It re-audits the rejected
  exact `v0.2.6` persistent root plus all four preserved `v0.2.5` roots with zero
  failures or warnings. Its cycle-one and later-cycle height-refinement
  regressions pass; paired target-panel and current-panel horizontal- and
  top-drift regressions fail closed. `package:smoke` reaches and passes every
  applicable Windows package/protection/deployment check before the known
  native-Windows `bash` environment blocker; exact CI must run the remaining
  POSIX fixture.
- Local `0.2.6` passed 206/206 tests, platform policy, native formatting and
  compilation, API coverage, Windows example packaging, the packaged all-1,127-
  method native-load probe, the corrected auditor self-test, and all four
  preserved exact-candidate summaries. Its height-refinement regression accepts
  the legitimate current-panel change and a paired horizontal-drift regression
  fails closed. `package:smoke` reaches and passes every applicable Windows
  package/protection/deployment check before the known native-Windows `bash`
  environment blocker; exact CI must run the remaining POSIX fixture.
- Final local `0.2.5` validation passes 206/206 automated tests, Windows package
  construction, packaged native loading for all 1,127 methods, the packaged
  deployment-helper self-test, and a protected source-linked 16/16 managed
  matrix with exact post-run candidate fingerprint and canonical ACL audits.
- No private app, product, account, transaction, Steam, key, price, checkout
  URL, or fixture identifier is recorded in committed documentation.

## Next Actions

1. Complete local validation, commit and push the `0.2.7` auditor correction,
   wait for exact CI, and create the fresh `v0.2.7` candidate through the
   tag-triggered Release workflow. Preserve and never move rejected `v0.2.0`
   through `v0.2.6`.
2. Repeat the required candidate-bound Windows public proof profiles without
   private checkout inputs or evidence overrides, generate the sanitized
   receipt, and configure the publish proof.
3. Dispatch the manual npm publication workflow only after the exact candidate
   and receipt validate. Preserve `0.1.6` as the last known-good package if any
   gate fails.

## Exact Next Step

Validate, review, commit, and push the `0.2.7` auditor correction, then require clean
exact CI before creating the fresh tag. Do not tag or publish if the protected Windows
live-proof workflow cannot be completed for the same exact candidate.

Detailed settled platform evidence is in
`docs/research/cross-platform-overlay-status.md`; rerun contracts are in
`docs/research/test-findings-ledger.md`; architecture is in
`docs/research/electron-steam-overlay-architecture.md`.
