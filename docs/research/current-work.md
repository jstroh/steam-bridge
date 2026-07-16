# Current Work Checkpoint

Last reviewed: 2026-07-16

Review anchor: `2f797aa` (`Record v0.1.4 exact CI`).

## Active Goal

Close the first `steam-bridge` npm release without weakening the exact-candidate
evidence boundary. `steam-bridge@0.1.4` is public and verified; the remaining
security cleanup is to revoke the bootstrap npm token that was exposed during
setup and keep later publication tokenless through npm trusted publishing.

Public App ID `480` proves generic Steam overlay plumbing only. Do not claim or
run configured-product purchase proof without the separate complete private
runtime handoff and configured-game path.

## Current State

Windows x64, Steam Deck Game Mode/Desktop Mode, Linux x64 packaging, and macOS
Apple Silicon are ready within their recorded boundaries. Do not repeat
unchanged Mac, Deck, Windows foreground, or Windows receipt experiments.

Protected `v0.1.4` points to exact `2f797aa`. Exact CI `29488304063`, tag CI
`29488457804`, and protected Release `29488457815` pass. The public GitHub
Release retains the required tarball, Windows archive, package audit,
executable-load result, and Windows live-proof receipt together.

The independently verified 114-file Windows candidate retains its exact
398,180,793-byte binding, canonical read/execute ACL, stable public shortcut,
and one unchanged interactive Steam identity. Fresh focused progress,
persistent-reuse, public checkout, shortcut-routes, and managed-routes roots
pass without human clicks or another Steam restart. The four receipt profiles
contain 31/31 clean cases and 27 active cases; the receipt semantic SHA-256 is
`6d2302ee100fde1f7123e4454994e18b079599a519d412623f6d64a1e7d91740`.

Protected publish run `29491067145` succeeded from exact tag `v0.1.4` after the
production environment approval. npm reports `0.1.4` as `latest`; its tarball
SHA-256 is
`2d794025df443d46719d1519e095ee67ec598e99d53e064b73a94b72505ed201`,
which exactly matches the independently retained Release artifact. npm also
reports SLSA provenance bound to tag `v0.1.4`, commit `2f797aa`, publish run
`29491067145`, and the `npm-production` environment. A clean registry install
passes `npm audit signatures` with one verified registry signature and one
verified attestation.

The temporary GitHub environment secrets `NPM_TOKEN` and
`STEAM_BRIDGE_WINDOWS_LIVE_PROOF_GZIP_BASE64` were deleted after publication;
the environment secret list is empty. The bootstrap npm token itself was pasted
into chat and must still be revoked at npm. This Windows npm CLI has no account
session, and browser work is explicitly stopped, so it cannot revoke or replace
that external account credential. Do not reuse it. npm 11.16 provides the
supported CLI path needed to finish without npm settings-page automation:
`npm trust github` creates the GitHub OIDC relationship, `npm trust list`
verifies it, and `npm token revoke` removes the bootstrap token once an npm
account session exists.

The main-branch `publish.yml` is now tokenless: it retains `id-token: write`,
the tag/source/receipt/candidate gates, protected `npm-production` environment,
and provenance, but no longer references `NPM_TOKEN` or `NODE_AUTH_TOKEN`.
Package smoke rejects either bootstrap name if it returns. This fail-closes the
next release until the npm trusted publisher is configured.

The Windows checkout has unrelated local `AGENTS.md`, `.codex`, and input-probe
changes that belong to the user and must remain untouched.

## Last Verification

- Exact CI, tag CI, protected Release, five-asset GitHub Release, candidate
  binding, canonical ACL, shortcut, readiness, focused progress, four receipt
  profiles, cleanup, and Steam continuity pass for exact `v0.1.4`.
- The repaired persistent auditor accepts the fresh three-cycle root while
  retaining direct cycle-one glyph proof and exact per-cycle host, DPI, inset,
  pointer, screenshot, focus, close, park, and D3D11 checks.
- All 198 unit/TypeScript tests, platform policy, API coverage, Rust formatting,
  native check, package smoke in exact CI, and `git diff --check` pass.
- The public npm bytes exactly match the retained audited tarball; npm registry
  metadata, `latest`, signature verification, and SLSA provenance pass.
- Both temporary GitHub environment secrets are deleted. No private app,
  product, account, shortcut, transaction, or Steam identifiers were added to
  committed evidence.

## Next Actions

1. Revoke the exposed bootstrap token in the npm account; it is no longer
   present in GitHub and must never be reused.
2. From an authenticated npm CLI, run `npm trust github steam-bridge --file
   publish.yml --repo jstroh/steam-bridge --env npm-production --allow-publish
   --yes`, verify it with `npm trust list steam-bridge --json`, then revoke the
   exposed bootstrap token by its npm token ID. Keep `NPM_TOKEN` absent.
3. Retain the published release and all rejected protected candidates. Do not
   rerun live platform matrices merely for confidence.
4. Defer real purchase proof until the configured game, `InitTxn`-capable
   application/backend lane, and complete private request handoff exist.

## Exact Next Step

Revoke the exposed npm token from the npm account. Publication and repository
verification are otherwise complete; no additional Windows, Linux, Deck, or
macOS live run is warranted.

Detailed platform evidence is in
`docs/research/cross-platform-overlay-status.md`; rerun contracts are in
`docs/research/test-findings-ledger.md`; architecture is in
`docs/research/native-overlay-presenter-plan.md`.
