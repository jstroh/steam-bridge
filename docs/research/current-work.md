# Current Work Checkpoint

Last reviewed: 2026-07-10

Implementation anchor: `c880d51` (`Harden Windows public overlay proof`).
This checkpoint may be committed immediately after that implementation; always
inspect Git history and the worktree before trusting it.

This is the short, replace-in-place operational checkpoint for fast recovery.
It is not an append-only history and does not replace code, tests, the detailed
platform evidence log, or the presenter design plan.

## Active Goal

Finish current-package Windows x64 proof for every non-purchase path using only
public App ID `480`: managed routes, raw-native observe controls, shortcuts,
passive notifications, synthetic checkout routing, close/back-to-app, native
renderer identity, high-DPI input, render health, and crash cleanup.

Do not run another private `InitTxn` suite. Real purchase proof remains paused
until its separate prerequisites exist; it is not part of the active Windows
matrix work.

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
diagnostics, and cleanup clean. The current local diff focuses the exact valid
lifecycle native-host window once, verifies it is foreground, rechecks the same
handle immediately before dispatch, logs only sanitized focus evidence, and
refuses to send close input when either verification fails. The interactive
remote desktop has since been reconnected, so one focused current-package rerun
is justified after this guard is committed and
deployed. Do not add a second close input, lengthen the wait, or repeat the
unchanged unfocused experiment.

Do not use the legacy raw `full` baseline as the product gate; use `managed`,
`shortcut-routes`, and public synthetic `checkout`.

### Duplicate-open coverage is packaged; live proof is open

The public `presenter-duplicate-open-guard` smoke action exists and has live
coverage on other supported platforms, but the Windows managed suite before
`c880d51` did not contain a case for it. Commit `c880d51` adds a complete
managed case and audits every named direct/wait helper, generic helper,
shortcut helper, and checkout-operation suppression. Historical Windows route
matrices still do not prove that behavior; one focused public live pass is
required after the web close/focus gate passes.

### Freshness

- The smoke app is pinned to Electron `43.0.0`; on 2026-07-09,
  `npm run check:electron:latest` reported `43.1.0`.
- A fresh CI-built Windows addon from `da632f8` was loaded successfully by the
  `c880d51` package. The current diff changes scripts, tests, and docs only, so
  repackage that verified addon rather than triggering another native Release
  build.
- There are no Git tags or GitHub releases yet; package version is `0.1.0`.

## Next Actions

1. Finish review and full local checks for the exact native-presenter focus
   gate, then commit, push, and verify CI.
2. Repackage the verified `da632f8` Windows addon with the current scripts,
   deploy and sign that exact package, and do not restart Steam unless current
   health evidence independently requires it.
3. Rerun one focused managed web case at the current scaling. Require one
   sanitized successful exact-host focus event plus a successful pre-dispatch
   recheck before the single close input, all three D3D11 fields, the strict
   physical-DPI evidence, inactive callback,
   close/back-to-app, parking, focus return, and clean crashes. Stop without
   sending input if either focus check fails.
4. Run the new duplicate-open case and require the named suppression evidence,
   no checkout operation invocation, close/back-to-app, parking, and clean
   crashes.
5. If both focused gates pass, run the broad public `managed`,
   `shortcut-routes`, and synthetic `checkout` suites. Do not use the unchanged
   raw `full` baseline as the product gate.
6. Record results in the existing ledger/detailed evidence, run final checks,
   commit, push, and verify CI.

## Last Reported Verification

Against the current local diff on 2026-07-10:

- `npm run package:smoke` passed.
- `npm test` passed all 175 tests.
- `npm run api:check`, `npm run check:platform`, `npm run native:fmt`, and
  `npm run native:check` passed. `native:check` reported only the existing
  future-incompatibility warning for transitive `block 0.1.6`.
- `git diff --check` passed; `c880d51` was pushed to `origin/main` and its normal
  CI run passed every job.
- The manual Release workflow for `da632f8` passed and produced the Windows
  addon used by both `c880d51` focused live runs. The current exact-focus diff
  is not committed or live-proved yet.
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
