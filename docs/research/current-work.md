# Current Work Checkpoint

Last reviewed: 2026-07-15

Review anchor: `f418450` (`Record completed Steam Deck readiness pass`).
Reconcile this checkpoint with newer Git history and worktree changes before
acting.

## Active Goal

Complete and publish a fresh macOS Apple Silicon production-readiness review.
Reconcile the existing live evidence with the current package and Electron
runtime; verify the launcher, signing, Metal presenter, managed routes,
shortcuts, passive notifications, close/back-to-app, focus, crash, host-health,
and cleanup contracts; diagnose and fix regressions; update the ledger and
public guidance; run proportionate checks; commit, push, and verify exact CI.

Public App ID `480` remains generic overlay plumbing only. Do not claim or run
real configured-product purchase proof without the separate complete private
runtime handoff and configured-game path.

## Current State

The Windows and Steam Deck public production-readiness slices are settled
through `37705e1` and `ffcbeec`. Their exact CI runs passed all supported
platform and package-smoke jobs. Do not rerun those live matrices for this macOS
goal.

Existing Apple Silicon evidence is broad but predates the current review. The
latest retained process-per-case matrix passed 44 managed App ID `480` cases,
and the latest retained persistent matrix passed 45 cases in one Steam-owned
process. Those runs covered the signed in-bundle launcher, arm64-only package,
Metal presenter, managed web/store/Friends/dialog/profile/community/stats/
achievements/user routes, shortcuts, passive progress/unlock notifications,
synthetic checkout plumbing, active/inactive callbacks, close and focus return,
zero-FPS parking, one overlay target, zero managed timing, crash health, and
cleanup.

The macOS host contract remains fail-closed: locked or display-asleep sessions
are unavailable success environments, current Steam IPC/client health is
required, and `BOverlayNeedsPresent()` polling stays disabled because it crashed
Steam's injected renderer on both OpenGL and Metal. Do not retry that poll or
promote OpenGL beyond diagnostics without a material implementation or Valve
change.

A fresh pass is justified because the retained live artifacts used an earlier
Electron runtime and predate the latest shared smoke, notification, privacy,
matrix-completeness, and cleanup changes. Start with static/self-test review and
a current signed minimal gate; expand to persistent/full only when the narrower
contract is healthy or when a changed surface requires broader proof.

The intended Apple Silicon Mac resolves on the local network and is powered on,
but Remote Login remains closed and no unattended shell path has yet been
established. A dedicated least-privilege SSH key is ready outside the repo and
the single authorization command has been provided to the user. AirPlay
availability is not a control path. Do not infer live macOS success from GitHub
runners or builds alone.

Unrelated local `AGENTS.md`, `.codex`, and input-probe worktree changes belong to
the user and must remain untouched.

## Last Verification

- `main` equals `origin/main` at `f418450`; only the unrelated user changes are
  present before this checkpoint edit.
- The macOS ledger entries and detailed Metal/launcher/host evidence were
  reviewed before starting new live work.
- Local discovery resolves the intended Mac, but bounded TCP checks show Remote
  Login/SSH and Screen Sharing are closed.
- Current repository commands expose minimal, core, full, checkout, persistent,
  and unavailable macOS suites plus signing, Steam-health, preflight, and
  summary auditors.
- `npm run macos:overlay-matrix:check`, the macOS Electron smoke helper
  self-test, and `git diff --check` pass on the Windows development host after
  making four path assertions platform-neutral. The changes affect self-tests
  only: matrix crash-report separators, signing and prepared-app paths, and the
  control-action checkout fixture path.
- Native Windows `npm run package:smoke` now passes the macOS preparation and
  signing self-tests before reaching the existing Linux-helper fixture boundary
  recorded by `WIN-PACKAGE-SMOKE-HOST-001`; exact Linux CI remains authoritative
  for that fixture.
- `npm run check:platform`, all 196 unit/TypeScript tests,
  `npm run api:check`, `npm run native:fmt`, and `npm run native:check` pass on
  the current worktree. The preparation, signing, smoke-helper, matrix, and
  summary macOS self-tests also pass individually.
- Exact head CI `29401204874` passes Windows x64, Linux x64, macOS Apple Silicon,
  and full Linux package smoke. This is build/test evidence, not a substitute
  for a fresh physical-Mac Steam overlay run.

## Next Actions

1. Establish unattended Remote Login on the intended Mac without weakening the
   broader machine, then collect a sanitized read-only preflight and Steam
   health artifact.
2. Run the current signed minimal matrix first. Expand to persistent/full proof
   only according to the changed surfaces and live findings; avoid unnecessary
   Steam restarts and unchanged negative experiments.
3. Update the checkpoint and ledger, run full repository validation and privacy
   review, commit and push intentional changes, and verify exact GitHub CI.

## Exact Next Step

Wait for the one bounded Mac Remote Login action, verify key-only SSH, then run
sanitized architecture/session/toolchain/repository and Steam-health preflight
without reading private runtime inputs.

Detailed platform evidence is in
`docs/research/cross-platform-overlay-status.md`; rerun contracts are in
`docs/research/test-findings-ledger.md`; architecture is in
`docs/research/native-overlay-presenter-plan.md`.
