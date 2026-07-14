# Current Work Checkpoint

Last reviewed: 2026-07-14

Review anchor: `bfc28e2` (`Add challenge-bound Windows foreground coordinator`).
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

The first no-input root passed, but the next persistent preflight created a
157-byte Crashpad `debug.log` and stopped before case 40. Commit `dfcd0e5`
therefore added a canonical NTFS candidate-protection helper; exact CI
`29371513100` passes package smoke plus Windows x64, Linux x64, and Apple
Silicon checks. A disposable protected copy denied writes, remained executable,
survived two consecutive eight-comparison render-health runs, retained its
exact binding, and also retained its ACL and binding through a same-volume
rename round trip.

Transactional redeployment copied the clean signed source to a unique stage,
rebound it before and after protection, verified 4/4 signatures, and activated
it through same-volume renames. The invalid 115-file/398,128,809-byte directory
and its 157-byte file are preserved byte-for-byte as
`rollback-3abcc3f-invalid-20260714150345`; the stage is gone. The active package
is protected and again binds to the exact 114-file signed fingerprint and
binding SHA-256. The earlier invalid `509f3fe` and `2d2178c` rollbacks and valid
`5a2ee54` rollback also retain their exact fingerprints. Deployment evidence is
under
`C:\Users\admin\steam-bridge-artifacts\release-3abcc3f-29363098329\protected-redeployment-20260714150345`.

The protected no-input root
`C:\Users\admin\steam-bridge-artifacts\windows-3abcc3f-protected-immutability-20260714-150700`
passes native load, all four render-health comparisons, stable-shortcut audit,
lazy D3D11 presenter readiness, semantic audit, and every cleanup guard. Its
independent post-run audit reproves the exact 114-file binding, canonical ACL,
4/4 signatures, all required rollback fingerprints, zero package processes,
stages, or temporary tasks, byte-exact launch-environment restoration, and
unchanged Steam PID `16720`, session `1`, and native start ticks
`639195030301407830`.

The first protected persistent attempt
`C:\Users\admin\steam-bridge-artifacts\windows-3abcc3f-protected-persistent-reuse-20260714-151700`
passed binding, ACL, readiness, native load, render health, and shortcut gates,
then reached case 40 with the exact source window bound but nonforeground. Its
30-second event observer saw no transition, so the probe sent zero activation
and close input and wrote a terminal failure. Normal wrapper cleanup, the
independent 114-file binding/ACL/signature/rollback audit, and exact Steam
continuity pass. Do not rerun this natural-foreground premise unchanged.

Commit `bfc28e2` and exact CI `29373540650` tested the remaining autonomous
premise: a same-session coordinator validated a fresh focused case-11 marker,
the exact executable/title/PID-start/session, 225% DPI, and a physical title-bar
point owned by the exact root window. It queued exactly one move/down/up and
wrote the copied-challenge acknowledgment 447 ms after source readiness.
Windows still emitted no foreground event and the source remained
nonforeground, so the matrix sent zero activation/close input and failed
closed. Passive evidence identified the unchanged foreground owner as a
Session-1 `AsHotplugCtrl` window with a zero-area rectangle. The active
candidate, ACL, signatures, rollbacks, cleanup, and Steam continuity remain
exact. The failed helper is removed rather than retained as product guidance;
do not repeat synthetic-input or focus variants.

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
114-file signed fingerprint after both. The published repository deployment
helper applies and audits this ACL with sanitized evidence; its self-test and
exact CI pass.

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
- Exact CI `29362884310`, Release `29363098329`, helper CI `29371513100`,
  independent artifact binding,
  local signing, source/stage/active rebinding, 4/4 required signatures,
  publisher agreement, rollback preservation, stage removal, zero package
  processes, and Steam continuity pass.
- Explicit logging still mutated a clean disposable copy on pass two. The
  canonical read/execute-only candidate passed two consecutive render-health
  runs and both exact 114-file rebindings; the helper self-test, same-volume
  rename check, transactional protected deployment, and active ACL audit pass.
- The protected no-input boundary and its independent post-run binding,
  signatures, rollback, cleanup, launch-environment, and Steam audits pass.
- The protected persistent attempt reached a healthy case 40 but naturally
  stayed nonforeground, sent zero input, and failed closed. Its post-profile
  candidate, ACL, signatures, rollbacks, cleanup, and Steam audits pass.
- Coordinator CI `29373540650` passes. Its focused case-11 live run produced a
  timely exact challenge-bound click but no foreground event; the zero-area OEM
  helper remained foreground. The case sent zero route input and all post-run
  integrity, cleanup, and Steam audits pass.

## Next Actions

1. Remove the rejected coordinator and its guidance, retain the negative live
   conclusion in the ledger, commit, push, and verify exact CI.
2. Resume active route profiles only after either a genuine challenge-bound
   physical click is available inside the existing observer or a separately
   authorized safe-state test changes the zero-area OEM foreground owner.
3. Then collect `persistent-reuse`, `checkout`, `shortcut-routes`, and
   `managed-routes` in order and generate the exact receipt.

## Exact Next Step

Publish the coordinator rejection and remove its implementation. Do not run
another synthetic-input, focus-API, timeout, or unchanged natural-foreground
profile. Further live progress requires a genuine physical click during the
existing challenge window or explicit authority plus a safe-state plan to test
the OEM foreground owner; stopping or suspending that display/hotplug-related
process is not currently authorized.

Detailed live evidence is in
`docs/research/cross-platform-overlay-status.md`; rerun contracts are in
`docs/research/test-findings-ledger.md`; architecture is in
`docs/research/native-overlay-presenter-plan.md`.
