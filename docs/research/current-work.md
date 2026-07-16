# Current Work Checkpoint

Last reviewed: 2026-07-16

Review anchor: `df760ef` (`Record v0.1.6 candidate CI`).

## Active Goal

The documentation-only npm release is complete. `steam-bridge@0.1.6` is public
and `latest`, and npmjs.com now receives the concise package README. No further
live Windows, Mac, Deck, or Linux testing is required for this release.

## Current State

Protected `v0.1.6` points to `df760ef`. Its source, tag CI, three-platform
prebuild, Windows Electron ASAR/package gate, strict package-equivalence gate,
tokenless trusted publication, and public GitHub Release all pass.

The published 38-file npm package differs from proved `v0.1.4` only in
`README.md` and package `version`. All code, helpers, templates, native addons,
and Valve runtime libraries are byte-identical. The `v0.1.4` live-proof receipt
remains attached to its original Release and is linked from `v0.1.6`; it was
not duplicated or relabeled as new live evidence.

Protected `v0.1.5` remains intentionally unpublished. Its successful build but
failed byte-equivalence check is preserved as negative evidence and must not be
retried or retagged.

The Windows checkout still has unrelated local `AGENTS.md`, `.codex`, and
input-probe changes that belong to the user and must remain untouched.

## Last Verification

- Exact main CI `29536299505` passes the implementation commit, and checkpoint
  CI `29536476387` passes all four jobs for protected source `df760ef`.
- Tag CI `29536631652` passes complete package smoke plus Windows x64, Linux
  x64, and Apple Silicon checks.
- Release `29536631627` passes all three native prebuilds, restores the nine
  exact proved runtime files, passes the Windows packaged Electron gate, and
  passes the strict 38-file documentation-only comparison.
- Independent verification passes against the exact retained Release artifact
  and `v0.1.4` receipt. The npm tarball SHA-256 is
  `529ebdd5cb45add4288dd73efea497e46f237dfb7bb8a27c275ba00cbfb3dd33`.
- Tokenless publish run `29537214839` succeeds. npm reports `latest=0.1.6`, 38
  files, a verified registry signature, and a verified provenance attestation.
- The registry tarball is byte-identical to the Release artifact. Its packaged
  README is 217 lines, 7,739 bytes, and begins with `# Steam Bridge`.
- GitHub Release `v0.1.6` is public and stable with the exact npm tarball,
  398,266,880-byte Windows bundle, package audit, and native-load result.
- Local validation passes all 198 unit and TypeScript tests, platform policy,
  API coverage, Rust formatting, native checks, publisher self-tests,
  JavaScript and workflow syntax checks, `git diff --check`, and the applicable
  Windows package-smoke path. The full Unix package smoke passes in exact CI.
- No private app, product, account, shortcut, transaction, Steam, key, price,
  or fixture identifier was added.

## Next Actions

1. No further action is required for the npm README release.
2. Preserve `v0.1.5` as rejected evidence and `v0.1.6` as the published exact
   documentation-only successor.
3. Any future package payload change requires proportionate new build and live
   proof; documentation-only proof reuse remains fail-closed.

## Exact Next Step

None. This goal is complete.

Detailed settled platform evidence is in
`docs/research/cross-platform-overlay-status.md`; rerun contracts are in
`docs/research/test-findings-ledger.md`; architecture is in
`docs/research/native-overlay-presenter-plan.md`.
