# Current Work Checkpoint

Last reviewed: 2026-07-15

Review anchor: `fe037ef` (`Fix scale-aware Windows close glyph proof`).

## Active Goal

Publish the first `steam-bridge` npm release without weakening the exact-candidate
evidence boundary. Preserve the rejected protected `v0.1.0` candidate, repair
the release-proof close-glyph detector, create a higher protected patch
candidate, bind its complete public Windows live-proof receipt, retain the
required artifacts, and publish only that verified tarball with npm provenance.

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

The protected annotated `v0.1.0` tag resolves to exact commit `fd26887`. Its
tag-triggered Release run `29474570221` passed all three supported native
prebuilds, the Windows Electron/ASAR package gate, canonical-candidate
verification, and artifact upload. The downloaded canonical tarball SHA-256 is
`829723ceb8a802e49dc5d3b572ac291f00e6ab4e4348dc55d4a560cdc53495dd`.
The retained Windows archive contains 114 files and binds to content SHA-256
`98012c5bb1b8bf93a4b164a2cc0cff089c58b61fcaba1234881d5bfb193fabea`.

The exact unsigned application-owned Windows candidate is deployed at a new
dedicated local root without replacing earlier evidence. Its audit binding,
canonical read/execute-only ACL, stable public App ID `480` shortcut, Steam
readiness task, and unchanged default D3D11 configuration pass. The package
ships Valve's signed Steam API and encrypted-app-ticket redistributables for
Windows x64, Linux x64, and Apple Silicon macOS. Windows Authenticode remains
optional for application distributors and is not an npm release prerequisite.

`v0.1.0` is now a rejected, preserved candidate and must not be published. Its
complete `persistent-reuse` and public synthetic `checkout` profiles pass, but
two complete `shortcut-routes` attempts stop at the ordered user route. At 100%
display scale the screenshot panel detector can select the compact inner panel;
the existing close-glyph sampler then misses the smaller 100%-scale glyph and
falls back to a point 16 physical pixels left of it. That click blanks the panel
without producing inactive/close/park callbacks. A focused user route selects
the full panel and passes, proving the runtime route and exact close lifecycle;
the ordered failure is a deterministic proof-driver geometry defect. The
earlier 225%-scale roots remain valid for their exact candidate and scale.

The worktree patch scales four logical diagonal distances through the measured
presenter DPI while preserving the 16-sample/10-point score and existing search
and lifecycle contract. Retained screenshots score 15/16 at 100% and 16/16 at
225%. A focused worktree-matrix user route passed the product lifecycle, but its
panel detector took the foreground-window fallback, so the semantic summary
correctly rejected it as glyph/scale proof. The package and workspace versions
are bumped to `0.1.1`; no new tag exists yet.

Exact CI `29477731391` passes all three platform jobs at `fe037ef`, while package
smoke correctly rejects a generated PowerShell line continuation introduced by
formatting the new sampler call. The follow-up worktree correction keeps the
same arguments and behavior on one line, satisfying that established packaging
contract without changing the scale-aware detector.

The npm registry still has no public `steam-bridge` package. A newly generated,
unexposed bootstrap token is configured only as the protected
`npm-production` environment secret `NPM_TOKEN`; the previously exposed token
was revoked. The environment requires maintainer approval and accepts protected
`v*` tags. Remove bootstrap authority only after the first publish exists and
npm trusted publishing is configured and verified.

## Last Verification

- Exact CI `29468266079` for `0846e7b` passes package smoke plus Windows x64,
  Linux x64, and Apple Silicon macOS checks.
- Exact CI `29472399883` for the committed Apple Silicon review at `209a108`
  passes the same four required jobs.
- Exact CI `29472516874` for `fd26887` passes package smoke plus Windows x64,
  Linux x64, and Apple Silicon macOS checks.
- Exact CI `29477731391` for `fe037ef` passes all three platform jobs and fails
  only the package-smoke guard against a generated PowerShell line continuation;
  the worktree correction removes that continuation without changing behavior.
- Protected tag Release `29474570221` passes all three prebuilds and the exact
  Windows publish-tarball/ASAR gate at `fd26887`. Independent local verification
  revalidates the retained tarball, Windows archive, package audit, release tag,
  commit, native 1,121-method shape, and publishable candidate contract.
- The newly deployed `v0.1.0` Windows candidate passes the exact 114-file
  fingerprint, canonical write-protection audit, stable shortcut update while
  Steam was closed, and a Limited interactive readiness task after one Steam
  start.
- Its complete protected `persistent-reuse` and public synthetic `checkout`
  roots pass with clean Limited-task, process, launch-environment, broker, Steam
  continuity, ACL, and post-profile fingerprint evidence.
- Two preserved complete shortcut roots pass the first eight routes and then
  reproduce the same 100%-scale user-panel close miss. The failing target is
  `x=1324`; a focused passing user route detects the full panel and closes at
  the actual glyph center `x=1340`. All three tasks clean up fully and retain
  the same candidate and Steam identity.
- The scale-aware worktree sampler passes PowerShell 5.1 parsing, all Windows
  package-gate self-tests, its static packaged-helper contract, and retained
  100%/225% pixel scoring. The focused live diagnostic passes runtime close and
  cleanup but is deliberately not accepted as glyph evidence because that
  launch used the non-screenshot fallback target.
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

1. Commit and push the package-guard correction, then require exact CI for the
   resulting `0.1.1` commit before creating its protected tag.
2. Pass the protected Release, deploy its exact Windows candidate, and collect
   all four complete receipt profiles without reusing `v0.1.0` evidence.
3. Retain the exact tarball, Windows archive, audit, executable probe, and live
   receipt together on the new protected tag.
4. Bind the receipt to `npm-production`, approve the deployment, and publish
   only the new verified candidate with provenance.
5. Configure and verify npm trusted publishing, then remove both the bootstrap
   token and release-scoped receipt secret.

## Exact Next Step

Run the focused generated-template guard and repository checks for the one-line
sampler call, review the exact follow-up diff, then commit and push it. Do not
tag until exact CI passes.

Detailed platform evidence is in
`docs/research/cross-platform-overlay-status.md`; rerun contracts are in
`docs/research/test-findings-ledger.md`; architecture is in
`docs/research/native-overlay-presenter-plan.md`.
