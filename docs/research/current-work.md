# Current Work Checkpoint

Last reviewed: 2026-07-14

Review anchor: `cba9c7b` (`Record signed containment deployment`).
Reconcile this checkpoint with newer Git history and worktree changes before
acting.

## Active Goal

Complete Steam Bridge Windows x64 production readiness on exact signed D3D11
candidate `3abcc3f`. Collect candidate-bound public App ID `480` `persistent-reuse`,
`checkout`, `shortcut-routes`, and `managed-routes` roots and generate the exact
31-case/27-activation receipt. Preserve fingerprints, signatures, rollback/stage
state, three-way renderer agreement, cleanup, privacy, and exact Steam
continuity after every profile.

## Current State

Commit `3abcc3f` is pushed. Exact CI `29362884310` passes package smoke plus
Windows x64, Linux x64, and Apple Silicon checks. Candidate-only Release
`29363098329` passes all three prebuilds, the unsigned Windows ASAR/package gate,
canonical candidate verification, and artifact upload. Independent download
verification binds the artifact to `3abcc3f`/`main`, Electron `43.1.0`, all 1,121
native methods, a 114-file unsigned bundle, and canonical tarball SHA-256
`4a5da4831975d627e7f4f629cc2053f20b32111f4a357a2e396bf9ba374350ef`.

The installed-certificate gate regenerated that exact tarball with signing
required. The signed bundle has 114 files/398,128,652 bytes, no package-local
`debug.log`, 4/4 valid required signatures, app/addon publisher agreement,
content SHA-256
`f4b975e696bcdf0ab926db3ca7027b11402401f2c5d00f731bb62a9837959fce`,
archive SHA-256
`e86f1c11fe8ad311abad4f02b6165b58e40682e6cf2bb9bc9d0f2bf2dd4ecd84`,
audit SHA-256
`60d06deb9a5df907b65aeb9adc087067c65452700de8a3a23284a6f3f9c15766`,
and binding SHA-256
`65469171fc83fa3e699e6ccb32db5ddf52659f6869006421e245b0a2f8375e7b`.
Signer identity is intentionally omitted.

Transactional deployment copied the signed package to a unique stage, rebound
it, preserved the invalid active `509f3fe` directory byte-for-byte as
`rollback-509f3fe-invalid-20260714125922`, activated `3abcc3f` through same-
volume renames, and removed the stage. The preserved rollback has its exact
115-file/398,126,943-byte fingerprint and zero-byte unexpected file. The valid
114-file `rollback-5a2ee54-20260714170053` still binds to its signed audit; the
older invalid 115-file `2d2178c` rollback still retains its 157-byte unexpected
file. Independent active signature/binding, rollback, stage, process, and Steam
audits pass with zero package processes, no stage, and unchanged Steam PID
`16720`, session `1`, and native start ticks `639195030301407830`. Deployment
evidence is under
`C:\Users\admin\steam-bridge-artifacts\release-3abcc3f-29363098329`.

The repaired boundary has two independent controls. Every render-health
Electron process starts in its external case-artifact directory while retaining
external `ELECTRON_LOG_FILE` and `--log-file`. After render-health process
cleanup, a candidate-bound matrix re-runs the signed fingerprint and stops
before case 01 on any drift. Static ordering and a synthetic unchanged/changed
binding test pass.

The exact no-input root
`C:\Users\admin\steam-bridge-artifacts\windows-3abcc3f-immutability-20260714-143151`
now closes the live immutability boundary. All four render-health comparisons
rendered visible content without fatal lifecycle events, wrote Chromium logs
under their external case roots, and cleaned up. The immediate post-render-
health gate observed the expected binding
`65469171fc83fa3e699e6ccb32db5ddf52659f6869006421e245b0a2f8375e7b`
before the one no-modal presenter-ready case ran. The semantic summary, task and
package cleanup, launch-env rollback, task deletion, exact Steam continuity,
independent 114-file rebinding, no-package-log check, 4/4 signatures, preserved
valid/invalid rollbacks, and no-stage/no-task audit all pass.

Exact `509f3fe` remains valuable historical behavior evidence. Its canonical
persistent-reuse root completed all three D3D11 cycles, and focused public
checkout approval completed activation, typed lifecycle, guarded close, park,
focus return, semantic audit, cleanup, and Steam continuity. Three later suite
attempts proved title-bar input reached the exact Electron `MainWindowHandle`
but arrived after the observer, settling alternate-HWND/Parsec theories as
notification latency. Do not repeat chat-timed click loops. Because the final
receipt requires one exact candidate binding, neither `509f3fe` root can be
included in a `3abcc3f` receipt; the product conclusions remain regression
evidence only.

## Last Verification

- Native Windows PowerShell 5.1 parses both changed scripts; JavaScript parsing,
  `git diff --check`, and the focused Windows smoke-helper static contract pass.
- A native PowerShell synthetic test accepts an unchanged post-render-health
  binding and writes fail-closed evidence for a changed binding.
- `npm test` passes 196/196; platform, API, native formatting, Windows package-
  gate self-tests, and privacy scans pass.
- Local package smoke reaches its known Windows POSIX/macOS fixture mismatch;
  exact CI package smoke passes. Local native check remains environment-blocked
  by absent MSVC tools; exact Windows CI passes it.
- Exact CI `29362884310`, Release `29363098329`, independent artifact binding,
  local signing, source/stage/active rebinding, 4/4 required signatures,
  publisher agreement, rollback preservation, stage removal, zero package
  processes, and Steam continuity pass.
- Exact no-input `managed / 10-presenter-ready` root passes native load, all four
  render-health comparisons, the immediate integrity gate, lazy D3D11 readiness,
  semantic audit, cleanup, independent post-run binding/signatures/rollback
  audit, and exact Steam continuity.

## Next Actions

1. Collect one exact `persistent-reuse` root. Prefer a
   natural-foreground launch; do not ask the user to race a chat notification.
2. Collect `checkout`, `shortcut-routes`, and `managed-routes` in order, auditing
   after each, then generate and validate the exact receipt.

## Exact Next Step

Run one complete exact-candidate `persistent-reuse` profile through the Limited
interactive wrapper with the public App ID `480` defaults. Prefer natural
foreground; do not repeat chat-timed coordination, synthesis, neutral probes,
or longer waits. Audit the candidate, cleanup, rollbacks, signatures, and Steam
identity immediately afterward before starting checkout.

Detailed live evidence is in
`docs/research/cross-platform-overlay-status.md`; rerun contracts are in
`docs/research/test-findings-ledger.md`; architecture is in
`docs/research/native-overlay-presenter-plan.md`.
