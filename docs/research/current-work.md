# Current Work Checkpoint

Last reviewed: 2026-07-15

Review anchor: `47d7749` (`Record npm publication setup`).
Reconcile this checkpoint with newer Git history and worktree changes before
acting.

## Active Goal

Prepare the first npm release without weakening its exact-candidate evidence
boundary. Finish the fresh macOS Apple Silicon production-readiness review,
configure the protected tag/signing/publication path, build the exact signed
cross-platform candidate, bind its complete public Windows live-proof receipt,
retain the required artifacts, and publish only the verified tarball with npm
provenance after explicit credentials and authority exist.

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

The host-neutral macOS self-test fixes and this recovery checkpoint are pushed
as `d456c7e`. First-release setup is now a separate slice. The repository has a
cross-platform candidate workflow and exact Windows publication verifier, but
the public npm package does not yet exist, no production signing identity is
configured in GitHub, and npm is not authenticated on this host. The installed
local test certificate is not a production release identity and must not be
uploaded as one.

The publication setup is pushed as `5d95bb3`. It uses a manual `publish.yml`
workflow, an exact tag-triggered Release run ID, the retained candidate
artifact, and a compressed environment-secret handoff for the matching
sanitized Windows live-proof receipt. The `npm-production` GitHub environment
exists, permits only `v*` tag deployments, and requires approval. An active tag
ruleset prevents deletion or non-fast-forward updates of `refs/tags/v*`.

The assembled npm candidate already ships Valve's Steam API and encrypted app
ticket redistributables for all three supported targets. Retained Release
artifact inspection confirms all six files are present in the tarball, while
the Windows ASAR publish gate independently requires the complete set before a
candidate can pass. Public install guidance now distinguishes this zero-SDK
consumer path from contributor source builds, which still require a local SDK.

Unrelated local `AGENTS.md`, `.codex`, and input-probe worktree changes belong to
the user and must remain untouched.

## Last Verification

- `d456c7e` is pushed to `origin/main` with only the five intended macOS
  verification/checkpoint files; unrelated user work remains unstaged.
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
- The npm registry has no public `steam-bridge` package yet. Current npm trusted
  publishing requires an existing package, npm 11.5.1 or newer, Node 22.14.0 or
  newer, a matching workflow filename, and OIDC. The first publish therefore
  needs a short-lived approved bootstrap token; later publishes can remove it.
- Exact CI `29463529919` for `d456c7e` passes all four required jobs: package
  smoke plus Linux x64, Windows x64, and Apple Silicon macOS checks.
- The publication workflow passes PyYAML parsing and `actionlint` 1.7.12. The
  proof configurator validates candidate binding, receipt schema/hash, gzip
  round-trip, arguments, and failure cases in its self-test.
- Current local `check:platform`, all 196 unit/TypeScript tests, `api:check`,
  Rust formatting/native check, and `git diff --check` pass. Native-Windows
  `package:smoke` reaches only the existing Linux shortcut-ID fixture boundary
  after all macOS and release-helper self-tests pass; exact Linux package smoke
  remains green in CI.
- Exact CI `29464185812` for `5d95bb3` passes all four required jobs: package
  smoke plus Linux x64, Windows x64, and Apple Silicon macOS checks. GitHub
  recognizes the new manual workflow, and `main` equals `origin/main` at that
  commit with only the unrelated user work remaining locally.
- Retained Release run `29363098329` contains all six expected Valve runtime
  files in its canonical npm tarball: the Steam API and encrypted-app-ticket
  redistributables for Windows x64, Linux x64, and Apple Silicon macOS.

## Next Actions

1. Establish unattended Remote Login on the intended Mac without weakening the
   broader machine, then collect a sanitized read-only preflight and Steam
   health artifact.
2. Run the current signed minimal matrix first. Expand to persistent/full proof
   only according to the changed surfaces and live findings; avoid unnecessary
   Steam restarts and unchanged negative experiments.
3. Configure the real production Windows signing identity and first-publish npm
   bootstrap authority, then build, live-prove, retain, and publish the exact
   protected `v0.1.0` candidate.

## Exact Next Step

Enable Mac Remote Login and finish the physical-Mac review. In parallel, obtain
the real production Windows signing identity and create the short-lived npm
bootstrap token through the maintainer accounts. Do not create the release tag
or publish until those credential gates and the Mac review are complete.

Detailed platform evidence is in
`docs/research/cross-platform-overlay-status.md`; rerun contracts are in
`docs/research/test-findings-ledger.md`; architecture is in
`docs/research/native-overlay-presenter-plan.md`.
