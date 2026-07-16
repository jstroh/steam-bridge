# Current Work Checkpoint

Last reviewed: 2026-07-16

Review anchor: `7a56b3a` (`Keep README policy concise`).

## Active Goal

The first `steam-bridge` npm release and its repository-readiness follow-up are
complete. Publication is tokenless, bootstrap authority is revoked, and the
1,199-line root README is now a concise product-first entry point with links to
the package reference, platform smoke guide, API coverage, contribution policy,
and detailed evidence.

Public App ID `480` proves generic Steam overlay plumbing only. Do not claim or
run configured-product purchase proof without the separate complete private
runtime handoff and configured-game path.

## Current State

Windows x64, Steam Deck Game Mode/Desktop Mode, Linux x64 packaging, and macOS
Apple Silicon are ready within their recorded boundaries. Do not repeat
unchanged Mac, Deck, Windows foreground, or Windows receipt experiments.

Protected `v0.1.4` points to exact `2f797aa`. Exact CI `29488304063`, tag CI
`29488457804`, protected Release `29488457815`, and protected publish run
`29491067145` pass. npm reports `steam-bridge@0.1.4` as `latest`; its public
tarball exactly matches the retained audited Release artifact and has verified
registry signature and SLSA provenance.

The npm trusted publisher is configured for GitHub repository
`jstroh/steam-bridge`, workflow `publish.yml`, protected environment
`npm-production`, and `createPackage` permission. It was verified through
`npm trust list` after creation. The main-branch publish workflow retains
`id-token: write`, the exact candidate gates, protected environment, and
provenance while referencing neither `NPM_TOKEN` nor `NODE_AUTH_TOKEN`.

The temporary GitHub environment secrets are deleted and the environment
secret list is empty. The exposed `steam-bridge-bootstrap` npm token was revoked
through npm's authenticated token API after the CLI's redacted JSON output hid
its token ID. A direct authenticated readback reports zero remaining npm tokens.
Future publication is tokenless through the trusted publisher.

The root README rewrite reduces onboarding from 1,199 lines to 177 lines. It
keeps install requirements, supported targets, quick-start examples, the
managed Electron overlay path, a Web API example, essential packaging notes,
development setup, and links to canonical deeper documentation. Release
forensics, live-test procedures, and internal matrix detail are no longer in
the repository front door. Package smoke now requires the concise platform and
Rosetta policy there while continuing to enforce detailed macOS commands,
runner guards, and matrix behavior in their canonical example, workflow, and
implementation files.

CI run `29531616552` exposed that the old static package-smoke contract required
four paragraphs of macOS test-runner and matrix internals in the root README.
Commit `7a56b3a` scopes that contract to the prominent platform/Rosetta policy
while leaving the detailed example, workflow, and implementation assertions
intact. Replacement CI `29531975098` passes all four jobs.

The Windows checkout has unrelated local `AGENTS.md`, `.codex`, and input-probe
changes that belong to the user and must remain untouched.

## Last Verification

- Exact release, package, provenance, Windows receipt, and platform evidence
  remain settled for `v0.1.4`; no new live platform run is warranted.
- Tokenless workflow commit `5b363dc` passes exact CI `29491937155`; checkpoint
  commit `a0108e2` passes exact CI `29492148250`, including all platform jobs.
- The npm trusted-publisher relationship was created and read back with the
  intended repository, workflow, environment, and permission.
- The bootstrap token DELETE succeeded; a direct authenticated token inventory
  readback reports zero tokens. The GitHub production environment reports zero
  secrets and `publish.yml` contains zero token references.
- Every local path referenced by the rewritten root README exists, documented
  API symbols used by its examples exist in the TypeScript implementation, and
  `git diff --check` passes.
- All 198 unit/TypeScript tests, platform policy, API coverage, Rust formatting,
  and native checks pass after the rewrite. Local package smoke passes its
  applicable self-tests and then reaches the recorded native-Windows Unix-shell
  boundary because `bash` is unavailable; exact CI covers the complete package
  smoke path.
- The focused root-README platform policy test and revised package-smoke policy
  assertions pass locally. Exact CI `29531975098` passes complete package smoke
  plus Windows x64, Linux x64, and Apple Silicon jobs.
- No private app, product, account, shortcut, transaction, Steam, key, price,
  or fixture identifier was added to committed evidence.

## Next Actions

1. Retain the published release and all rejected protected candidates. Do not
   rerun live matrices merely for confidence.
2. Keep future releases tokenless through the configured npm trusted publisher
   and the protected `npm-production` environment.
3. Defer real purchase proof until the configured game, `InitTxn`-capable
   application/backend lane, and complete private request handoff exist.

## Exact Next Step

No further action is required for the first npm release or README cleanup. The
next release should use the existing tokenless protected workflow. No additional
Windows, Linux, Steam Deck, or macOS live run is warranted without a relevant
implementation, dependency, platform, or environment change.

Detailed platform evidence is in
`docs/research/cross-platform-overlay-status.md`; rerun contracts are in
`docs/research/test-findings-ledger.md`; architecture is in
`docs/research/native-overlay-presenter-plan.md`.
