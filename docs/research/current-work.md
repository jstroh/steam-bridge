# Current Work Checkpoint

Last reviewed: 2026-07-14

Review anchor: `90b1601` (`Record Windows candidate immutability proof`).
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

The first no-input root
`C:\Users\admin\steam-bridge-artifacts\windows-3abcc3f-immutability-20260714-143151`
passed all four render-health comparisons and its immediate/post-run binding.
The next complete persistent profile stopped before case 40 because the same
gate found a new 157-byte top-level `debug.log`. Its timestamp and content bind
the writer to a Crashpad registration error 16 ms into render-health
`in-process-gpu-off`. The active directory is now an invalid preserved 115-file/
398,128,809-byte package with content SHA-256
`7e790b7dd4821480bef5ce655b374122d07bb1fafa668d9a4aa7330aeb9f6b1a`.
Task/process/launch-env cleanup and exact Steam continuity still pass; no
persistent case or route input ran. Do not delete or exclude the unexpected
file and do not launch this active directory again.

External working directories, `ELECTRON_LOG_FILE`, quoted `--log-file`, and
explicit Electron logging all remain insufficient. A clean disposable signed
copy survived the first explicit-logging pass but acquired the same 157-byte
file on pass two. Chromium's Windows fallback uses application-directory
`debug.log` and explicitly anticipates that installed application directories
may be nonwritable. A second clean disposable copy was assigned a canonical
protected NTFS ACL: SYSTEM and Administrators retain full control; the current
interactive identity has inherited read/execute only; descendants have no
explicit rules. It denied a root write, remained readable/executable, passed
two consecutive eight-comparison render-health runs, and rebound to the exact
114-file signed fingerprint after both. The new repository deployment helper
applies and audits this ACL with sanitized evidence; its self-test passes.

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
- The first no-input boundary passed, but the next preflight disproved that one-
  pass conclusion and the integrity gate stopped before case 40.
- Explicit logging still mutated a clean disposable copy on pass two. The
  canonical read/execute-only candidate passed two consecutive render-health
  runs and both exact 114-file rebindings; the new helper self-test and audit
  pass.

## Next Actions

1. Finish tests and review for the Windows candidate write-protection helper,
   update the ledger, commit, push, and verify exact CI.
2. Preserve the invalid active `3abcc3f` directory as a new rollback. Deploy a
   fresh clean signed `3abcc3f` copy transactionally, apply the canonical ACL,
   rebind it, and audit signatures, rollbacks, stage/process state, and Steam.
3. Repeat one no-input boundary on the protected candidate, then collect one
   exact `persistent-reuse` root only if it remains unchanged.
4. Collect `checkout`, `shortcut-routes`, and `managed-routes` in order, auditing
   after each, then generate and validate the exact receipt.

## Exact Next Step

Complete and publish the Windows candidate write-protection helper. Do not run
another active-package process before the invalid active directory is preserved
and replaced from the clean signed source. The replacement must bind at 114
files before and after canonical ACL application, emit sanitized protection
evidence outside the candidate, and pass signatures/rollback/stage/process/Steam
audits before one protected no-input boundary is eligible.

Detailed live evidence is in
`docs/research/cross-platform-overlay-status.md`; rerun contracts are in
`docs/research/test-findings-ledger.md`; architecture is in
`docs/research/native-overlay-presenter-plan.md`.
