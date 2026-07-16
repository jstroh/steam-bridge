# Current Work Checkpoint

Last reviewed: 2026-07-16

Review anchor: `c845066` (`Record v0.1.5 candidate CI`).

## Active Goal

Publish `steam-bridge@0.1.6` as a documentation-only patch so npmjs.com shows
the concise package README. The package page is reduced from 1,863 lines to 217
lines while retaining install, supported targets, quick starts, managed
Electron overlay guidance, packaging requirements, the macOS electron-builder
helper, CLI names, and links to canonical deeper docs.

Do not repeat unchanged Windows foreground, Windows receipt, Mac, Deck, or
Linux live experiments. Publication may reuse `v0.1.4` live proof only when the
new tarball contains the exact same non-documentation payload.

## Current State

`steam-bridge@0.1.4` remains public and `latest`. Its protected tag, exact
release assets, registry signature, provenance, tokenless trusted publisher,
and cross-platform evidence remain settled. No npm or GitHub publication token
exists.

Protected `v0.1.5` at `c845066` passed tag CI `29535232461` and complete Release
run `29535232465`, including all native prebuilds and the Windows ASAR/package
gate. It was not published: the documentation-only verifier correctly rejected
the exact candidate because its freshly rebuilt macOS addon differed from the
proved `v0.1.4` bytes. Preserve that tag and candidate as rejected; do not rerun
live Steam matrices for it.

The workspace and package versions are now `0.1.6`. For this replacement tag,
the Release workflow restores the nine exact native addons and Valve runtime
libraries from the protected `v0.1.4` package before building the audited npm
tarball. The tag candidate itself must then pass the strict full package
comparison: only `README.md` and package `version` may differ across the 38-file
inventory. The tokenless publish workflow repeats the same comparison against
the retained `v0.1.4` tarball and receipt.

The Windows checkout still has unrelated local `AGENTS.md`, `.codex`, and
input-probe changes that belong to the user and must remain untouched.

## Last Verification

- Exact main CI `29535032768` passes all four jobs for checkpoint commit
  `c845066`; exact tag CI `29535232461` also passes all four jobs.
- Exact Release `29535232465` passes all three native prebuilds and the complete
  Windows package/audit gate for protected `v0.1.5`.
- The real equivalence verifier rejects that exact tarball at the first changed
  runtime file, the rebuilt macOS addon. npm still reports only `0.1.4`.
- Publisher self-tests cover documentation-only success, incomplete inputs,
  mixed proof modes, predecessor-tag mismatch, version policy, and rejection of
  a changed runtime file.
- The `0.1.6` release and publish workflows parse, their retained `v0.1.4`
  tarball and receipt assets exist under a stable GitHub Release, and static
  package policy checks cover the exact-payload restore and comparison route.
- All 198 unit and TypeScript tests, platform policy, API coverage, Rust
  formatting, native checks, publisher self-tests, JavaScript syntax checks,
  and `git diff --check` pass for the `0.1.6` candidate source.
- Local package smoke passes every applicable Windows check and stops only at
  the recorded native-Windows `bash` boundary. Exact CI must complete that
  Unix-hosted portion.
- No private app, product, account, shortcut, transaction, Steam, key, price,
  or fixture identifier has been added.

## Next Actions

1. Commit and push the validated exact-payload Release change, require exact
   green main CI, then create protected tag
   `v0.1.6`.
2. Require the tag Release to pass byte equivalence before retaining its
   candidate artifacts.
3. Publish through the tokenless workflow with
   `previous_release_tag=v0.1.4` and verify registry integrity, provenance,
   `latest`, and the concise README in the public tarball.

## Exact Next Step

Commit and push the validated `0.1.6` source, then require exact green main CI.

Detailed settled platform evidence is in
`docs/research/cross-platform-overlay-status.md`; rerun contracts are in
`docs/research/test-findings-ledger.md`; architecture is in
`docs/research/native-overlay-presenter-plan.md`.
