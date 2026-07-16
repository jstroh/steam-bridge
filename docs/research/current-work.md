# Current Work Checkpoint

Last reviewed: 2026-07-15

Review anchor: `0846e7b` (`Record npm signing gate correction`). Reconcile this
checkpoint with newer Git history and worktree changes before acting.

## Active Goal

Publish the first `steam-bridge` npm release without weakening the exact-candidate
evidence boundary. Configure first-publish npm authority, create the protected
`v0.1.0` candidate, bind its complete public Windows live-proof receipt, retain
the required artifacts, and publish only that verified tarball with npm
provenance.

Public App ID `480` proves generic Steam overlay plumbing only. Do not claim or
run configured-product purchase proof without the separate complete private
runtime handoff and configured-game path.

## Current State

Windows x64, Steam Deck Game Mode/Desktop Mode, Linux x64 packaging, and macOS
Apple Silicon are ready for the first public package within their recorded
boundaries. The Windows and Deck public production-readiness slices are settled
through `37705e1` and `ffcbeec`; do not rerun those live matrices for the npm
bootstrap slice.

The physical Apple Silicon review is complete at exact head `0846e7b`. A clean
Mac checkout used the retained official Apple Silicon Release artifact to build
the arm64-only signed Electron `43.1.0` package. Release verification, signing,
matrix self-tests, interactive preflight, Steam launch/injection, presenter
readiness, direct web activation, the changed passive achievement-progress path,
crash checks, cleanup, and pre/post-run Steam health passed without restarting
Steam.

The current minimal matrix could not re-collect its unchanged screenshot and
Escape-close evidence because neither SSH nor Terminal has macOS Screen
Recording or Accessibility permission. The run had already verified direct web
activation. Since the retained broad artifact's Metal lifecycle/close code is
unchanged and the only intervening runtime change was passive notification
completion, the focused passing passive case closes the changed-surface review.
Do not retry the same close probe or install another click tool under unchanged
TCC permissions; see `MAC-AUTOMATION-001`.

The Mac checkout is clean at `origin/main`. The Windows development checkout
still has unrelated local `AGENTS.md`, `.codex`, and input-probe changes that
belong to the user and must remain untouched.

The release workflows and public package shape are prepared. The candidate
ships Valve's Steam API and encrypted-app-ticket redistributables for Windows
x64, Linux x64, and Apple Silicon macOS. Windows Authenticode is optional for
application distributors and is not an npm release prerequisite. Only the
protected `npm-production` GitHub environment remains.

The npm registry has no public `steam-bridge` package yet and this host is not
authenticated to npm. The first publish requires explicit maintainer-granted
bootstrap authority; subsequent releases can use the configured trusted
publisher/OIDC path. Do not create the release tag or publish until that
authority exists.

## Last Verification

- Exact CI `29468266079` for `0846e7b` passes package smoke plus Windows x64,
  Linux x64, and Apple Silicon macOS checks.
- Retained Release run `29363098329` supplies the verified Apple Silicon native
  binding and both Valve dylibs used by the fresh physical-Mac package.
- `npm run release:verify -- --target aarch64-apple-darwin`, the macOS signing
  verifier, `npm run macos:overlay-matrix:check`, interactive preflight, and
  pre/post-run Steam client health passed on the physical Mac.
- The signed current package passed presenter readiness and direct web
  activation before the TCC-blocked close probe. A focused
  `presenter-achievement-progress` run then passed Steam launch/injection,
  overlay-enabled, callback-driven passive completion, parked non-modal state,
  disabled needs-present polling, managed isolation/timing, and crash checks.
- Current local `check:platform`, all 196 unit/TypeScript tests, `api:check`,
  Rust formatting/native check, the sanitized-diff scan, and `git diff --check`
  pass. Native-Windows `package:smoke` passes the current static/self-tests and
  reaches the recorded unsupported Unix-helper boundary.
- The Mac checkout is clean at `0846e7b`. No private app, product, account,
  shortcut, transaction, or Steam identifiers were added to committed evidence.

## Next Actions

1. Obtain explicit short-lived npm bootstrap authority for the first package.
2. Create the protected exact `v0.1.0` tag/candidate and retain the Release run
   and canonical tarball.
3. Run the public Windows proof against that exact protected candidate, bind its
   sanitized receipt to the publication workflow, and verify required CI.
4. Approve `npm-production` and publish only the verified candidate with
   provenance. Remove bootstrap authority after trusted publishing is active.

## Exact Next Step

Verify npm authentication state and obtain the maintainer-approved first-publish
bootstrap token. Do not open a browser, create the tag, or publish without that
explicit authority.

Detailed platform evidence is in
`docs/research/cross-platform-overlay-status.md`; rerun contracts are in
`docs/research/test-findings-ledger.md`; architecture is in
`docs/research/native-overlay-presenter-plan.md`.
