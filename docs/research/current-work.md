# Current Work Checkpoint

Last reviewed: 2026-07-10

Implementation anchor: `57c458f` (`Harden Windows overlay ownership and reuse`).
Always inspect Git history and the worktree before trusting this checkpoint.

This is the canonical, short, replace-in-place operational checkpoint for fast
recovery. It is not an append-only history and does not replace code, tests,
the detailed platform evidence log, or the presenter design plan.

## Current Workspace State

During workspace setup, another process added continuity changes in `AGENTS.md`
and `.codex/`; preserve those uncommitted changes. This checkpoint integrates
the focused `53b4ab3` owner-process result without taking ownership of the other
continuity files. The implementation anchor is `53b4ab3`; this result-recording
commit is documentation-only.

## Active Goal

Make the supported Windows x64 managed-overlay path production-ready using only
public App ID `480` for generic live proof. Preserve D3D11 as the default and
finish current-package evidence for foreground/user activation, managed routes,
raw-native observe controls, shortcuts, passive notifications, synthetic
checkout routing, close/back-to-app, native renderer identity, high-DPI input,
render health, signing/rollback, and crash cleanup. Then close the remaining
Windows release-claim, persistent-reuse, packaging, and support-boundary gaps
identified by the final production-readiness audit before calling the path
ready.

Do not run another private `InitTxn` suite. Real purchase proof remains paused
until its separate prerequisites exist; it is not part of the active Windows
matrix work.

The authorized owner-process handoff goal is complete at its stop condition.
One focused public run exercised the materially changed mechanism and
established that the existing native-show call still does not reacquire OS
foreground in this automated environment; commit `943dfad` records the result
and its CI is green. Official Valve, Microsoft, and Electron research now
provides the permitted next experiment: a genuine click in the existing visible
Smoke window makes the same Electron main process eligible to activate its
owned presenter. A separate foreground broker is only a fallback if that
same-process path is disproved.

The unchanged signed package and stable Steam shortcut have been verified and
launched in the interactive Windows session with public App ID `480`, autorun
disabled, a fixed diagnostic directory, and the prior launch env preserved by
rename. Steam initialization and first render completed; no overlay action or
synthetic input has run. The app is waiting for one genuine **Presenter Web
Wait** click and a manual overlay close. Duplicate-open and the broad public
suites remain gated behind that complete focused close pass.

## Proven Baseline

- Public App ID `480` proves generic Steam initialization and overlay plumbing,
  not real purchase authorization.
- Explicit Windows D3D11 runs have broad passing managed evidence. A fresh
  CI-built addon from `da632f8` proves the unset/default renderer is actually
  D3D11 in the top-level presenter, native host, and renderer diagnostics on one
  attached public route. The `c880d51` package also passed the strict physical
  high-DPI target, screenshot, and input-delivery evidence contract.
- macOS Apple Silicon and Steam Deck managed presenter coverage is broad and
  green for generic routes. Intel/Rosetta/universal macOS remains unsupported.
- Private purchase work is paused and out of scope. Its prerequisite and rerun
  rules remain in `WIN-CHECKOUT-CLIENT-001` and `WIN-CLIENTQUERY-001`.

## Current Findings and Open Questions

### D3D11 and high-DPI targeting are proved; owner-process focus remains blocked

The signed `c880d51` package passed interactive Session 1 readiness, native
load, shortcut validation, default render health, and current Steam-client
health without a Steam restart. Its focused public managed-web run proved all
three `windows-d3d11` fields, process/thread per-monitor-v2 awareness, readable
physical-resolution captures, a window-DPI scale that agreed with independent
presenter geometry, a scale-aware close target inside the detected panel, and
all three expected pointer inputs with no API error. This settles the coordinate
and target evidence; it does not prove close/back-to-app.

Both that click run and one independent Escape comparison left the overlay
active until the managed wait timed out. In every close-probe sample, an
unrelated zero-area window owned foreground and lifecycle diagnostics reported
the native presenter was not foreground. Both runs kept render health, crash
diagnostics, and cleanup clean. Commit `a58280c` focuses the exact valid
lifecycle native-host window once, verifies it is foreground, rechecks the same
handle immediately before dispatch, logs only sanitized focus evidence, and
refuses to send close input when either verification fails.

That exact commit was packaged around the verified Windows addon, deployed and
signed with all 12 signable files valid, and exercised after the interactive
remote desktop was reconnected. The public managed-web surface rendered visibly
and all three backend fields remained `windows-d3d11`. The sanitized focus event
proved that the lifecycle handle was present, well formed, and a valid window,
but `SetForegroundWindow` was not accepted and the exact host still was not
foreground. The new guard correctly emitted a skip event and sent no close
input. The overlay then timed out active as expected, while readiness, default
render health, crash diagnostics, process/task cleanup, and the preserved Steam
session stayed clean without a Steam restart.

This proves the focus guard fails closed; it still does not prove
close/back-to-app. Reconnecting the remote desktop alone is not a meaningful
rerun condition. Do not repeat the unchanged `SetForegroundWindow` attempt, add
a second close input, or lengthen the wait.

Commit `53b4ab3` materially changed that precondition without changing the
verified addon. It resolves the close target first, binds the exact lifecycle
HWND to the Smoke process/session, sends that HWND only inside one authenticated
handoff-only loopback request, and has the owning process call its existing
native show/activation path at most once. Both sides retain only sanitized
match/state booleans and counts. The probe revalidates the same owner,
enabled/non-iconic state, and exact foreground immediately before one
`SendInput` close call; any failure produces one skip branch and no input.

The signed package then ran exactly one focused public managed-web case. Target,
owner, control-process, and interactive-session relationships matched; one
authenticated request received one valid response; the requested window stayed
the same; and one native-show call completed. Windows still left the exact host
non-foreground, the owning process reported no focus, and native focus/activation
message deltas remained zero. The schema-2 guard emitted one skip event, sent
zero close input, and the active wait timed out without close, park, completion,
or app-focus return. Visible rendering, physical-DPI target and screenshot
evidence, all three D3D11 fields, readiness, render health, zero-crash evidence,
process/task cleanup, rollback, and the existing Steam session remained clean.

This disproves the existing owner-process native-show call as an unattended
foreground-reacquisition mechanism in this environment. It does not prove that
a focus-delivered click or Escape fails, and it does not prove
close/back-to-app. Repackaging either existing focus call, reconnecting remote
desktop, retrying focus, adding another input, or lengthening the wait is not a
meaningful experiment.

Do not use the legacy raw `full` baseline as the product gate; use `managed`,
`shortcut-routes`, and public synthetic `checkout`.

### Windows needs-present polling is aligned in `a75ad43`; live proof is pending

The committed presenter slice changes the persistent Windows default from a
250 ms full-diagnostics loop to a 30 ms lightweight
`BOverlayNeedsPresent()` signal poll while rate-limiting the full diagnostics
snapshot to at least 250 ms. Windows polling disabled by policy stays on the
slow safe path, non-Windows defaults are unchanged, lightweight cache updates
replace the diagnostics object only on signal transitions between normal full
refreshes, and closing the presenter cancels further polls. Unchanged
lightweight ticks stay silent, managed readiness uses the cheap
`IsOverlayEnabled()` signal rather than forcing full diagnostics, and the smoke
app no longer overrides the library default. All 179 unit tests, package smoke,
API/platform checks, native formatting/checks, syntax checks, and diff checks
pass; one public passive-notification exact-package proof remains pending.

The same committed documentation slice corrects the stale claim that Windows
uses only Electron's direct hook, limits the supported topology to one presenter
per process/main game window, distinguishes historical artifacts from
exact-package release proof, and records the current D3D11 device-loss,
Electron-range, and unpacked-ASAR evidence boundaries. These corrections do not
depend on the pending manual foreground result.

### Native surface ownership and terminal failure handling are hardened in `57c458f`

An independent production audit found process-global lifecycle hazards that do
not require another Steam launch to fix: concurrent or duplicate-module
presenters could detach one another's native surface, partial controller setup
could leak listeners/leases, raw mismatched closes could orphan a host, and an
attach or scheduled D3D11 present failure could escape without completing
managed cleanup. The committed slice now permits one managed Electron controller
and one presenter/session/raw surface owner per process, shares that registry
across package evaluations, rejects `worker_threads` overlay control at the
main-thread boundary, and rejects collisions before environment or listener
side effects, rolls back partial setup, assigns monotonically increasing
controller/surface-lease generations, and prevents stale handles or callbacks
from mutating or reporting a later owner.

Windows native `Present`, render-target recreation, and `ResizeBuffers`
failures now remove and destroy the Rust surface before returning the original
error. The JavaScript presenter records that error with `closeReason: "error"`,
stops timers, disconnects callbacks, best-effort detaches without replacing the
primary error, closes the managed controller, removes Electron listeners,
wakes pending lifecycle waits with a closed error, and releases ownership for a
clean new instance. All 194 unit tests, native formatting/checks, and package
smoke pass locally. No live suite was run; the genuine foreground click remains
the next Windows runtime experiment.

The Windows activation path also now reactivates a parked host in place instead
of calling the native attach path again. Native diagnostics expose
`surfaceInstanceGeneration` and `hwnd` as actual HWND/D3D11 reuse evidence;
`nativeSurfaceLeaseGeneration` remains ownership evidence only. The focused
three-cycle live harness must require stable native instance/HWND plus one
attach and no detach before final shutdown, not merely a stable lease.
It must capture one managed controller before the loop, reject missing or
nonpositive controller/lease/instance generations and a missing HWND, compare
them in every shown and parked snapshot, require owned/open/attached/nonterminal
state throughout, and stop without re-ensuring or retrying after any failure.

### Duplicate-open coverage is packaged; live proof is open

The public `presenter-duplicate-open-guard` smoke action exists and has live
coverage on other supported platforms, but the Windows managed suite before
`c880d51` did not contain a case for it. Commit `c880d51` adds a complete
managed case and audits every named direct/wait helper, generic helper,
shortcut helper, and checkout-operation suppression. Historical Windows route
matrices still do not prove that behavior; one focused public live pass is
required after the web close/focus gate passes. It was not run in this slice.

### Freshness

- The smoke app is pinned to Electron `43.0.0`; on 2026-07-09,
  `npm run check:electron:latest` reported `43.1.0`.
- A fresh CI-built Windows addon from `da632f8` was loaded successfully by the
  `a58280c` package. Its pre-sign hash matched the verified Release artifact;
  another native Release build is not justified for the current blocker.
- There are no Git tags or GitHub releases yet; package version is `0.1.0`.

## Exact Next Step

Do not synthesize the missing gesture. In the already-running interactive Smoke
window, click **Presenter Web Wait** once, manually close the public Steam web
overlay, and leave Smoke open while its lifecycle evidence is collected. Then
close Smoke and atomically restore the preserved launch env. If the natural
flow passes, classify the current blocker as unattended-harness focus and add
the smallest state-driven same-process click/exact-host gate needed for one
repeatable schema-2 proof. If it fails after the real click, do not build a
broker; investigate native-host ownership/activation and input forwarding.

## Subsequent Actions

1. Complete the current natural user-click diagnostic. On a pass, implement and
   test the smallest same-process exact-host gate, then run one focused managed
   web proof requiring one successful pre-dispatch foreground recheck before
   the single close input, all three D3D11 fields, strict physical-DPI evidence,
   inactive callback, close/back-to-app, parking, focus return, and clean
   crashes. Stop without input if any binding or focus check fails.
2. Run the new duplicate-open case and require the named suppression evidence,
   no checkout operation invocation, close/back-to-app, parking, and clean
   crashes.
3. If both focused gates pass, run the broad public `managed`,
   `shortcut-routes`, and synthetic `checkout` suites. Do not use the unchanged
   raw `full` baseline as the product gate.
4. Run one public passive exact-package case for the committed Windows
   `BOverlayNeedsPresent()` cadence and require a false-to-true wake, D3D11
   renderer agreement, close/park completion, and no hot full-diagnostics loop.
5. Add the designed state-driven three-cycle persistent-presenter reuse/soak
   proof, then verify the documented one-window, recovery/compatibility, and
   production-like Windows native-addon packaging boundaries.
6. Build the audited `electron-builder` ASAR fixture and exact publish-tarball
   gate: require colocated Windows x64 addon/runtime DLLs, PE/ABI checks,
   ASAR-aware native-load/signing discovery, source/integrity hashes, and a
   Windows CI executable load from the final staged bundle without a native
   override or post-install artifact repair.
7. Record results in the existing ledger/detailed evidence, run final checks,
   scan for private data, commit, push, verify CI, and complete the final
   production-readiness audit.

## Last Reported Verification

Against owner-process handoff commit `53b4ab3` and its single focused run:

- `npm run package:smoke` passed after both independent reviews and includes
  schema-1 compatibility plus schema-2 positive, already-foreground, ordering,
  binding, privacy, one-shot, terminal-branch, pointer, and focus-return fixtures.
- `npm test` passed all 175 tests. `npm run check:platform`,
  `npm run native:fmt`, `npm run native:check`, and `npm run api:check` passed;
  `native:check` retained only the known transitive `block 0.1.6` warning.
- `node --check` passed for the changed JavaScript files, the Windows summary
  self-test passed directly, and `git diff --check` passed.
- `53b4ab3` was pushed to `origin/main`; its package-smoke, macOS arm64,
  Windows x64, and Linux x64 CI jobs all passed.
- Result-recording commit `943dfad` was pushed to `origin/main`; its same four
  CI jobs all passed.
- The Windows package reused the verified addon without a native rebuild,
  matched the current app/matrix/task/summary sources before signing, deployed
  with all 12 signable files `Valid`, preserved rollback, and did not restart
  Steam.
- The one public `11-managed-web-open-and-wait` case passed interactive
  readiness, native load, shortcut verification, default render health,
  visible Steam web rendering, all three D3D11 fields, and clean crash/process/
  task evidence. Its exact-bound owner-process handoff completed once but did
  not acquire foreground or produce new focus/activation messages. The guard
  sent zero input and the managed wait timed out active. No duplicate-open or
  broad suite ran.

Against the focus-gate slice now committed as `a58280c` on 2026-07-10:

- `npm run package:smoke` passed.
- `npm test` passed all 175 tests.
- `npm run api:check`, `npm run check:platform`, `npm run native:fmt`, and
  `npm run native:check` passed. `native:check` reported only the existing
  future-incompatibility warning for transitive `block 0.1.6`.
- `git diff --check` passed; `a58280c` was pushed to `origin/main`, and its CI
  run passed every job.
- The manual Release workflow for `da632f8` produced the Windows addon used by
  the `a58280c` package. Its pre-sign hash matched, the deployed bundle retained
  the exact current matrix/task/summary scripts, all 12 signable files verified
  `Valid`, rollback was preserved, and Steam was not restarted.
- The single `a58280c` focused managed-web run passed interactive readiness,
  native load, shortcut verification, default render health, visible Steam web
  rendering, all three D3D11 backend fields, zero crash dumps, and cleanup. Its
  exact valid native host could not become foreground; the guard sent no input
  and the managed close wait timed out. No duplicate-open or broad suite ran.
- `npm run check:electron:latest` failed only on the intentional/latest-version
  comparison described above; it is not part of normal `npm test`.

Against polling and release-guidance commit `a75ad43` on 2026-07-10:

- `npm test` passed all 179 tests, including Windows default-cadence,
  false-to-true transition, disabled-policy, dynamic native-guard, cache,
  readiness, and timer-cleanup coverage.
- `npm run package:smoke`, `npm run api:check`, `npm run check:platform`,
  `npm run native:fmt`, and `npm run native:check` passed; `native:check`
  retained only the known transitive `block 0.1.6` warning.
- Syntax checks, the added-line private-data scan, `git diff --check`, and an
  independent final implementation/documentation review passed.
- `a75ad43` was pushed to `origin/main`; package smoke, Linux x64, Windows x64,
  and macOS arm64 CI jobs all passed.
- No live suite was run. One public passive exact-package proof and the genuine
  foreground user-click diagnostic remain pending.

Against ownership/reuse implementation commit `57c458f` on 2026-07-10:

- `npm test` passed all 194 tests, including module-reload and worker-thread
  ownership boundaries, raw-subtype and no-surface behavior, transactional
  controller rollback, stale callback containment, session/presenter terminal
  failure, closed-wait ordering, and three-cycle Windows native-instance reuse.
- `npm run package:smoke`, `npm run api:check`, `npm run check:platform`,
  `npm run native:fmt`, and `npm run native:check` passed; `native:check`
  retained only the known transitive `block 0.1.6` warning.
- Syntax checks, the added-line private-data scan, `git diff --check`, and three
  independent implementation reviews passed. A local cross-target Rust attempt
  reached the Windows C++ bridge but could not compile it without MSVC C++
  headers; the native Windows CI job then compiled the exact commit successfully.
- `57c458f` was pushed to `origin/main`; package smoke, Linux x64, Windows x64,
  and macOS arm64 CI jobs all passed. No live Steam suite was run; the existing
  genuine-click experiment remains untouched and pending.

Live Windows review on 2026-07-10 UTC is summarized under Current Findings;
detailed sanitized chronology lives in the platform evidence log and ledger.

Reverify these claims after newer commits. Branch cleanliness and CI status are
live facts and must always be checked rather than inferred from this checkpoint.

## Detailed Sources

- [Test findings and rerun gates](test-findings-ledger.md)
- [Cross-platform live evidence](cross-platform-overlay-status.md)
- [Native presenter architecture](native-overlay-presenter-plan.md)
- [Windows smoke and matrix runbook](../../examples/electron-basic/README.md)
- [Public project guidance](../../README.md)
- [Package consumer guidance](../../packages/steam-bridge/README.md)

## Update Contract

Keep this file short and current. Replace stale goal/finding/next-step text
rather than accumulating session history. Put durable live results in the test
ledger and cross-platform evidence log, architecture decisions in the presenter
plan, and public recommendations in the READMEs.
