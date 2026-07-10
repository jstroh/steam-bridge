# Current Work Checkpoint

Last reviewed: 2026-07-10

Implementation anchor: `a58280c` (`Harden Windows close focus proof`). Always
inspect Git history and the worktree before trusting this checkpoint.

This is the canonical, short, replace-in-place operational checkpoint for fast
recovery. It is not an append-only history and does not replace code, tests,
the detailed platform evidence log, or the presenter design plan.

## Current Workspace State

During workspace setup, another process added continuity changes in `AGENTS.md`
and `.codex/`; preserve those uncommitted changes. This checkpoint integrates
the subsequent Windows focus-gate live result without taking ownership of the
other continuity files. The implementation anchor remains `a58280c`; the
result-recording commit for this slice is documentation-only and may follow it.

## Active Goal

Finish current-package Windows x64 proof for every non-purchase path using only
public App ID `480`: managed routes, raw-native observe controls, shortcuts,
passive notifications, synthetic checkout routing, close/back-to-app, native
renderer identity, high-DPI input, render health, and crash cleanup.

Do not run another private `InitTxn` suite. Real purchase proof remains paused
until its separate prerequisites exist; it is not part of the active Windows
matrix work.

The user has now authorized the next product goal: replace the blocked
foreground precondition with one bounded, state-driven handoff, bundle compatible
activation diagnostics and auditor coverage into the same package, and avoid
another build/deploy/live cycle until that package can distinguish the remaining
focus hypotheses in one focused public run.

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

### D3D11 and high-DPI targeting are proved; close focus remains open

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

The current product slice materially changes that precondition without changing
the verified addon. It resolves the close target before handoff, binds the exact
lifecycle HWND to the Smoke process/session, sends that HWND only inside one
authenticated handoff-only loopback request, and has the owning process call its
existing native show/activation path at most once. Both sides retain only
sanitized match/state booleans and counts. The probe then revalidates the same
owner, enabled/non-iconic state, and exact foreground immediately before one
`SendInput` close call. Missing, ambiguous, mismatched, or lost focus emits one
skip branch and no input; partial pointer dispatch has no fallback mechanism.
Schema 2 also requires the corresponding app event, target-before-handoff
ordering, app focus return, and a single sent-or-skipped terminal branch. Local
fixtures cover owner/control/session mismatch, raw-ID leakage, HWND drift,
duplicate or reordered events, transport ambiguity, multiple native show calls,
pre-dispatch loss, pointer fallback, focus-return failure, and independently
already-foreground success through the same exact-HWND binding.

Do not use the legacy raw `full` baseline as the product gate; use `managed`,
`shortcut-routes`, and public synthetic `checkout`.

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

Commit and push the reviewed product slice without the unrelated continuity
files, verify GitHub CI, then reuse the verified Windows addon while packaging,
deploying, and signing once. Run only `11-managed-web-open-and-wait` with public
App ID `480`. Stop and update `WIN-FOCUS-001` on the first meaningful failure;
advance to duplicate-open only if the focused close gate passes completely.

## Subsequent Actions

1. After the foreground-acquisition condition materially changes, rerun one
   focused managed web case at the current scaling. Require one
   sanitized successful exact-host focus event plus a successful pre-dispatch
   recheck before the single close input, all three D3D11 fields, the strict
   physical-DPI evidence, inactive callback,
   close/back-to-app, parking, focus return, and clean crashes. Stop without
   sending input if either focus check fails.
2. Run the new duplicate-open case and require the named suppression evidence,
   no checkout operation invocation, close/back-to-app, parking, and clean
   crashes.
3. If both focused gates pass, run the broad public `managed`,
   `shortcut-routes`, and synthetic `checkout` suites. Do not use the unchanged
   raw `full` baseline as the product gate.
4. Record results in the existing ledger/detailed evidence, run final checks,
   commit, push, and verify CI.

## Last Reported Verification

Against the current owner-process handoff worktree:

- `npm run package:smoke` passed after both independent reviews and includes
  schema-1 compatibility plus schema-2 positive, already-foreground, ordering,
  binding, privacy, one-shot, terminal-branch, pointer, and focus-return fixtures.
- `npm test` passed all 175 tests. `npm run check:platform`,
  `npm run native:fmt`, `npm run native:check`, and `npm run api:check` passed;
  `native:check` retained only the known transitive `block 0.1.6` warning.
- `node --check` passed for the changed JavaScript files, the Windows summary
  self-test passed directly, and `git diff --check` passed.
- No live Steam case has run from this worktree yet.

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
