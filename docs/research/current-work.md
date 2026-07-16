# Current Work Checkpoint

Last reviewed: 2026-07-16

Review anchor: `13de023` (`Preserve generated PowerShell template contract`).

## Active Goal

Publish the first `steam-bridge` npm release without weakening the exact-candidate
evidence boundary. Preserve rejected candidates, repair any deterministic proof
defect they expose, retain the five required release artifacts together, publish
only the verified tarball with npm provenance, and remove bootstrap authority
after trusted publishing is active.

Public App ID `480` proves generic Steam overlay plumbing only. Do not claim or
run configured-product purchase proof without the separate complete private
runtime handoff and configured-game path.

## Current State

Windows x64, Steam Deck Game Mode/Desktop Mode, Linux x64 packaging, and macOS
Apple Silicon are ready for the first public package within their recorded
boundaries. The physical Apple Silicon review is complete through `0846e7b`.
Do not repeat unchanged Mac or Deck input experiments under the recorded
permission and route boundaries.

Protected `v0.1.0` is preserved and rejected because its fixed-distance Windows
close-glyph proof misses the 100%-scale user route in the ordered shortcut
profile. Protected `v0.1.1` at `13de023` contains the scale-aware sampler. Exact
CI `29477956921`, tag CI `29478111273`, and protected Release `29478111221`
pass. The canonical tarball, Windows archive, audit, and executable result are
downloaded and independently verified. The protected 114-file Windows
candidate retains its exact binding and canonical read/execute ACL.

Fresh `v0.1.1` persistent-reuse, public checkout, and all ten ordered shortcut
routes pass against one unchanged Steam identity. The shortcut root includes
the formerly failing 100%-scale user route and settles the scale-aware glyph
repair. Candidate ACL, content fingerprint, cleanup, and Steam continuity remain
unchanged after every profile.

The complete managed profile exposed a separate repeatability defect in the
packaged smoke harness. All 16 cases launched and 15 pass semantically, but the
achievement-progress case accepted the same public `1/2` progress value already
stored by earlier proof attempts. The harness cleared the selected achievement
only when fully unlocked, so repeated partial progress produced no new toast and
no Windows false-to-true `needs-present` transition. The following unlock case
passes. The final detached controller run also proves successful Limited-task
deletion, runner/process cleanup, launch-environment rollback, exact Steam
continuity, and handoff-file cleanup. This isolates account-state reset in the
smoke driver rather than presenter, renderer, broker, or task failure.

`v0.1.1` is therefore preserved and rejected for publication. The worktree now
clears and stores the selected public achievement before every progress probe,
retains whether it had already been unlocked as evidence, adds a source-level
repeatability regression test, and bumps the monorepo, package, and example to
`0.1.2`. A fresh protected candidate and all four receipt profiles are required;
do not splice focused evidence into a prior root or alter account state manually.

The npm registry still has no public `steam-bridge` package. The protected
`npm-production` environment has a bootstrap `NPM_TOKEN`, but because a token
was exposed during setup it must not remain as durable authority. Delete the
GitHub secret and revoke the npm token after publication, then verify trusted
publishing before considering the authority cleanup complete.

The Windows checkout has unrelated local `AGENTS.md`, `.codex`, and input-probe
changes that belong to the user and must remain untouched.

## Last Verification

- Exact `v0.1.1` CI and tag CI pass all supported platform and package-smoke
  jobs; protected Release `29478111221` passes all three prebuilds plus the
  Windows publish-tarball/ASAR gate.
- The canonical `v0.1.1` tarball, Windows archive, audit, executable result,
  release tag, commit, 1,121-method native shape, and publishable-candidate
  contract pass independent verification.
- Fresh protected `v0.1.1` persistent-reuse, checkout, and shortcut-routes roots
  pass with complete broker, D3D11 agreement, close/park, crash, cleanup, ACL,
  fingerprint, and Steam-continuity evidence.
- The final managed root launches all 16 cases and passes 15. Its only semantic
  failures are the missing achievement-progress false-to-true needs-present
  transition and its dependent polling assertions. Structured evidence records
  `indicated=true`, callback completion, passive D3D11 attachment, zero modal
  activation, parking, and clean crashes, but also `wasUnlocked=false`, no clear,
  and the already-stored `1/2` value.
- The same managed root's detached wrapper passes task deletion, runner-tree and
  package-process guards, launch-environment rollback, handoff cleanup, and
  exact Steam identity/session continuity with no controller stderr.
- The candidate remains write-protected with the same 114-file fingerprint and
  binding after every successful and rejected profile.
- The `0.1.2` worktree passes the focused repeatability regression, JavaScript
  parsing, all 197 unit/TypeScript tests, platform policy, API coverage, Rust
  formatting, native check, sanitized added-line scan, and `git diff --check`.
  Native-Windows package smoke passes its applicable static, package, and
  self-test gates before the recorded missing-`bash` host boundary.
- No private app, product, account, shortcut, transaction, or Steam identifiers
  were added to committed evidence.

## Next Actions

1. Commit and push `0.1.2`; require exact CI before creating its protected tag.
2. Pass the protected Release, deploy its exact Windows candidate, and collect
   all four fresh receipt profiles with the manifest-derived broker watcher.
3. Generate and independently verify the sanitized receipt, then retain the
   tarball, Windows archive, audit, executable result, and receipt together on
   the protected tag.
4. Bind the receipt to `npm-production`, approve and verify the provenance-backed
   publish, configure trusted publishing, and remove/revoke bootstrap authority.

## Exact Next Step

Commit the reviewed eight-file `0.1.2` slice without staging `AGENTS.md` or the
user's untracked probe/Codex files, push `main`, and require exact CI. Do not tag
before every required job passes.

Detailed platform evidence is in
`docs/research/cross-platform-overlay-status.md`; rerun contracts are in
`docs/research/test-findings-ledger.md`; architecture is in
`docs/research/native-overlay-presenter-plan.md`.
