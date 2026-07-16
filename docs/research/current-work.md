# Current Work Checkpoint

Last reviewed: 2026-07-16

Review anchor: `1f0af41` (`Publish a concise npm package page`).

## Active Goal

Publish `steam-bridge@0.1.5` as a documentation-only patch so npmjs.com shows a
human-friendly package page. The package README has been reduced from 1,863
lines to 217 lines while retaining install, supported targets, quick starts,
managed Electron overlay guidance, packaging requirements, the macOS
electron-builder helper, CLI names, and links to canonical deeper docs.

Do not repeat unchanged Windows foreground, Windows receipt, Mac, Deck, or
Linux live experiments. The patch may reuse `v0.1.4` live proof only if the
publisher proves that every shipped runtime byte is identical.

## Current State

`steam-bridge@0.1.4` remains public and `latest`. Its protected tag, exact
release assets, registry signature, provenance, tokenless trusted publisher,
and cross-platform evidence remain settled. No npm or GitHub publication token
exists.

The workspace and package versions are bumped to `0.1.5`. The package README
now serves consumers instead of embedding release forensics and live-test logs.
Internal wrapper and matrix detail remains in the Electron example guide.
Commit `1f0af41` is pushed to `main`, and exact CI `29534842260` passes complete
package smoke plus Windows x64, Linux x64, and Apple Silicon jobs.

The protected publish workflow now supports an explicit
`previous_release_tag` route for documentation-only patch successors. The
publisher validates the prior retained receipt against its exact tarball,
requires the next stable patch version in the same major/minor line, compares
the complete extracted npm file inventories, permits differences only in
`README.md` and the package `version`, and requires all code, helpers,
templates, native addons, and Valve runtime libraries to remain byte-identical.
Any runtime difference fails closed and requires new exact live proof.

The Windows checkout still has unrelated local `AGENTS.md`, `.codex`, and
input-probe changes that belong to the user and must remain untouched.

## Last Verification

- The release-candidate publisher self-test covers the documentation-only
  successor success path, incomplete inputs, mixed proof modes, predecessor-tag
  mismatch, and rejection of a changed runtime file.
- The real equivalence verifier passes against the retained `v0.1.4` tarball
  and receipt with a staged `0.1.5` package containing the new README and exact
  prior payload: 36 non-documentation published files remain byte-identical.
- JavaScript syntax checks and `git diff --check` pass.
- Platform policy, API coverage, Rust formatting, and native checks pass.
- All 198 unit and TypeScript tests pass after retaining the exact package
  README Rosetta prohibition.
- Local package smoke passes its applicable Windows self-tests, package CLIs,
  and static policy checks, then stops at the already-recorded Windows host
  boundary because `bash` is unavailable. Exact CI must complete that path.
- Exact main CI `29534842260` passes all four jobs for commit `1f0af41`.
- No private app, product, account, shortcut, transaction, Steam, key, price,
  or fixture identifier has been added.

## Next Actions

1. Create protected tag `v0.1.5`, wait for the exact Release candidate gate,
   and retain the five candidate artifacts.
2. Publish through the tokenless workflow with
   `previous_release_tag=v0.1.4`. The byte-equivalence verifier must pass before
   npm publication.
3. Verify registry metadata, tarball integrity, provenance, `latest`, and the
   concise README in the published tarball.

## Exact Next Step

Commit this checkpoint, require its exact CI, then create protected tag
`v0.1.5` at that commit.

Detailed settled platform evidence is in
`docs/research/cross-platform-overlay-status.md`; rerun contracts are in
`docs/research/test-findings-ledger.md`; architecture is in
`docs/research/native-overlay-presenter-plan.md`.
