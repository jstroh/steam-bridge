# Current Work Checkpoint

Last reviewed: 2026-07-10

Implementation anchor: `da632f8` (`Fix Windows renderer default and high-DPI
probes`).
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
  CI-built addon from `da632f8` now also proves the unset/default renderer is
  actually D3D11 in the top-level presenter, native host, and renderer
  diagnostics on one attached public route.
- macOS Apple Silicon and Steam Deck managed presenter coverage is broad and
  green for generic routes. Intel/Rosetta/universal macOS remains unsupported.
- Private purchase work is paused and out of scope. Its prerequisite and rerun
  rules remain in `WIN-CHECKOUT-CLIENT-001` and `WIN-CLIENTQUERY-001`.

## Current Findings and Open Questions

### Default D3D11 identity is proved; scaled close targeting remains open

The signed `da632f8` package passed interactive Session 1 readiness, native
load, shortcut validation, default render health, and current Steam-client
health without a Steam restart. One attached public managed-web run proved the
top-level presenter, native host, and renderer all default to
`windows-d3d11`. It also proved process/thread per-monitor-v2 awareness and a
physical `3456x2170` capture, but the old literal `right-16`, `top+18` inset
missed the 225%-scaled close control. All three `SendInput` events were sent
without an API error; Steam remained active, close/park timed out, crash dumps
stayed zero, and cleanup was clean.

The current local diff derives the close target from actual DPI scale, records
the resolved per-case input and geometry, and makes schema-1 summaries reject
unscaled, mismatched, missing, or nonphysical screenshot evidence. It has local
test coverage but no post-change Windows pass yet. Do not rerun the unchanged
literal target or substitute a longer wait. Do not use the legacy raw `full`
baseline as the product gate; use `managed`, `shortcut-routes`, and public
synthetic `checkout`.

### Duplicate-open coverage is implemented locally; live proof is open

The public `presenter-duplicate-open-guard` smoke action exists and has live
coverage on other supported platforms, but the Windows managed suite shipped in
`da632f8` did not contain a case for it. The current local diff adds a complete
managed case and audits every named direct/wait helper, generic helpers,
shortcut helpers, and checkout-operation suppression. Historical Windows route
matrices still do not prove that behavior; one focused public live pass is
required before the gap can be settled.

### Freshness

- The smoke app is pinned to Electron `43.0.0`; on 2026-07-09,
  `npm run check:electron:latest` reported `43.1.0`.
- A fresh CI-built Windows addon from `da632f8` was loaded successfully in the
  focused live run. The current diff changes JavaScript, scripts, tests, and
  docs only, so repackage that verified addon rather than triggering another
  native Release build.
- There are no Git tags or GitHub releases yet; package version is `0.1.0`.

## Next Actions

1. Finish review and full local checks for the DPI evidence contract and
   duplicate-open coverage, then commit, push, and verify CI.
2. Repackage the verified `da632f8` Windows addon with the current scripts,
   deploy and sign that exact package, and do not restart Steam unless current
   health evidence independently requires it.
3. Rerun one focused managed web case at the current 225% scaling. Require all
   three D3D11 fields, process and thread per-monitor-v2 evidence, a
   physical-resolution screenshot, a scale-aware in-control target,
   close/back-to-app, parking, focus return, and clean crashes.
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
- `git diff --check` passed; `da632f8` was pushed to `origin/main`.
- Normal CI and the manual Release workflow for `da632f8` passed; the Release
  workflow produced the Windows addon used by the focused live run. The current
  diff is not committed or live-proved yet.
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
