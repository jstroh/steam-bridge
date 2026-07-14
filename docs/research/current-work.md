# Current Work Checkpoint

Last reviewed: 2026-07-14

Implementation anchor: `5a2ee54` (`Route Windows render-health logs externally`).
Always reconcile this checkpoint with Git history and the worktree.

## Active Goal

Close the exact signed Windows x64 D3D11 production-candidate lane on deployed
commit `5a2ee54`: preserve the now-green managed-web recovery; collect complete
candidate-bound public App ID `480` roots in order (`persistent-reuse`,
`checkout`, `shortcut-routes`, `managed-routes`); generate the exact
31-case/27-activation receipt; and complete the Windows production-readiness
audit while requiring an unchanged fingerprint, cleanup, renderer agreement,
and Steam continuity after every profile. Preserve private-purchase, App
Control, full semantic-API, publication-authority, rollback, privacy, and
provenance boundaries. After Windows, return to Steam Deck/Linux desktop and
macOS parity, then do one final Windows parity pass.

## Current State

`origin/main` now contains explicit render-health log repair `5a2ee54`. Exact CI
`29345092393` passed package smoke plus Linux x64, Windows x64, and Apple Silicon
macOS. Release `29345310464` passed all three prebuilds, the unsigned Windows
publish-tarball/ASAR gate, canonical-candidate verification, and artifact
publication. Independent download verification bound commit
`5a2ee54562785c9cd274fbf55034f36a2dc9ab5a`, `main`, Electron `43.1.0`, 114
files, all 1,121 native methods, canonical tarball SHA-256
`94bd677794435c371c7580a0269c4421950a8091e2823f48026d752b95515cb5`, and
unsigned bundle-archive SHA-256
`80d66431ab68e8614845daa26b8bc26997885460b4014fb5cc94aecf4eeb17d5`.

The installed-certificate gate regenerated the exact candidate with signing
required. It passed 4/4 valid required signatures, app/addon publisher
agreement, 114 files/398,125,830 bytes, all 1,121 native methods, zero package-
local logs/processes, content fingerprint
`e08687e93eb2fdf73fcaf924bfabb2f01b00d21dd02380ab6a3b518635019c7f`, and
signed bundle-archive SHA-256
`0c34ca9197a933e585e39ae25460ff67e8ad6a1d78b287cf9863553ba02476a0`.
Transactional deployment preserved the entire mutated 115-file `2d2178c`
directory as rollback, including its unexpected file, and removed the stage.
A separate post-transaction verifier reproved source/active audit binding, 4/4
signatures, app/addon publisher agreement, zero active/rollback package
processes, zero active-package logs, the 115-file rollback and preserved
unexpected file, absent stage, and exact Steam PID/session/start continuity.

The prior exact `2d2178c` candidate passed the complete candidate-bound no-modal
`managed / 10-presenter-ready` task with public App ID `480`, Limited run level,
full native-load and render-health gates, assumed stable shortcut, semantic
summary, all wrapper cleanup guards, and matching pre/post candidate
fingerprints. A second independent post-run verification still found exactly
114 source/active-identical files, 4/4 signatures, matched rollback, no stage,
zero package-local logs or processes, and exact Steam continuity.

Two exact candidate-bound active `managed /
11-managed-web-open-and-wait` attempts first entered the schema-3 nonforeground
branch and failed closed because Parsec input was unavailable: both emitted a
valid source-bound marker but zero acknowledgment, foreground-transition,
activation, or close input. A neutral disposable-window probe then established
the missing coordinator condition: Parsec must be on its full-screen macOS
Space and frontmost for an ordinary client click to reach Windows. After that
condition was restored, one fresh exact-candidate recovery naturally launched
already foreground and took the mutually exclusive schema-3 not-required
branch. It consumed one trusted isolated-preload gesture, dispatched exactly
one activation and one web-panel close, observed shown/inactive/closed/parked/
complete lifecycle and exact source-window focus return, and passed three-way
`windows-d3d11`, semantic summary, crash, task/process/environment cleanup,
candidate fingerprint, rollback, signature, and Steam-continuity gates. The
authoritative artifact is
`C:\Users\admin\steam-bridge-artifacts\windows-2d2178c-managed-web-recovery-20260713-065944`.
No marker or acknowledgment was required or created on this successful branch.
Do not rerun managed-web recovery unless its candidate, input, foreground,
lifecycle, or backend contract changes or a later parity run regresses.

The first authorized `persistent-reuse` root reached a fresh exact case-40
marker with zero activation and zero close input, but its 30-second external
foreground hook expired while coordination was still being inspected. The
probe failed closed, the case emitted no result, and the wrapper completed all
task/process/environment/Steam cleanup guards. Its post-run binding and
independent deployment audit still passed at 114 byte-identical files, 4/4
signatures, matched rollback, zero package logs/processes, and exact Steam
continuity. Preserve
`C:\Users\admin\steam-bridge-artifacts\windows-2d2178c-persistent-reuse-20260714-030944`;
do not treat it as product behavior or rerun the old coordination process.

An initial disposable Notepad dry probe reported a foreground transition 1,608
ms after a synthetic Parsec click, but it did not isolate that click from the
task's own asynchronous launch/show lifecycle and is superseded. In exact retry
`C:\Users\admin\steam-bridge-artifacts\windows-2d2178c-persistent-reuse-20260714-033636`,
the pre-armed coordinator wrote an action/ordinal/challenge-matching
acknowledgment 2,823 ms after the fresh marker. The exact Windows hook remained
armed for 30 seconds, observed zero foreground events, and left the source
nonforeground, so the gate accepted no acknowledgment, sent zero activation or
close input, and ended incomplete at zero of three closes. A subsequent
calibrated, raised, atomic desktop-control neutral test also produced no Windows
foreground transition and removed its disposable task, process, and evidence.
Current synthetic macOS and desktop-control Parsec input are therefore settled
negatives in this topology; do not spend another product root on them. The
second exact root again preserved every cleanup guard, candidate binding,
independent deployment/rollback/signature audit, and Steam continuity, but it is
not receipt evidence and does not test persistent presenter reuse.

A zero-input disposable launch A/B then changed only the Limited interactive
task's PowerShell window style. Both normal and hidden task actions launched a
direct-child Notepad window naturally foreground in 5 ms, while the task itself
was never foreground; both cleaned their task, process, and temporary evidence.
Dropping `-WindowStyle Hidden` is therefore not causal and must not be used via
an external wrapper. The remaining material difference is Steam's indirect URI
launch. The materially different Windows-local Computer Use path is now proved
by the neutral exact-HWND gate below.

The first Windows-local Computer Use setup did not produce a valid input
verdict. A command-host foreground hook ran in a different Windows desktop from
the interactive UI and is discarded. A follow-up Limited interactive neutral
task correctly bound and armed an exact Character Map HWND, but its target
closed at the coordination deadline before Computer Use dispatched input; it
recorded zero events and zero product activity, then the task and every
disposable window were removed. Calculator never launched. Do not treat either
setup result as a Computer Use negative or repeat either topology.

The untracked purpose-built **Steam Bridge Input Probe** was repaired through
three hash-pinned independent reviews before use. Its final source and compiled
Windows x64 GUI executable bind the exact PID/HWND/session, publish an atomic
challenge plus future native-event acceptance boundary, require a strictly
post-event closed-schema acknowledgment, report final hook teardown only after
form close, and fail closed on publication, timing, schema, or cleanup errors.
Do not commit the temporary source or executable.

One Limited interactive run at
`C:\Users\admin\steam-bridge-artifacts\windows-local-input-probe-20260714-063655`
then passed. The exact reviewed window showed without activation; one local
Computer Use title-bar click created exactly one challenge-bound foreground
event, followed by one atomic acknowledgment on a later native tick. The result
reported the same PID/HWND/session, valid acknowledgment, target foreground,
one event, successful hook teardown, no hook error, and zero product activity.
The probe/window/process exited, its task returned zero and was deleted, the
root contained only marker/ack/result JSON, no Smoke process ran, and the exact
Steam PID/session/start identity remained unchanged. Do not repeat this neutral
proof unless the Computer Use mechanism or probe contract changes. Its pass
satisfied the ledger prerequisite for the single candidate-bound
`persistent-reuse` root below; it did not itself prove presenter behavior.

That one root is preserved at
`C:\Users\admin\steam-bridge-artifacts\windows-2d2178c-persistent-reuse-20260714-064941`.
It passed exact candidate binding, public App ID `480`, assumed shortcut,
interactive readiness, native load, default render health, and every pre-case
package/Steam gate. Case 40 published a valid exact-source marker at
06:53:29 UTC. Its hook then expired cleanly 30 seconds later with zero events,
no acknowledgment present, zero activation input, zero close input, and
incomplete zero of three. Computer Use target discovery and its required fresh
window-state capture completed too late; the atomic acknowledgment was written
at 06:55:07 UTC, after hook teardown, and was never observed or consumed. The
case produced no Smoke result, and the semantic summary correctly rejects it as
`windows-steam-launch-no-result`. This is a coordinator deadline failure, not
product behavior, presenter-reuse evidence, or receipt evidence. Preserve the
late acknowledgment and the complete root; do not retry this topology.

The failed root still completed all ownership-safe cleanup. Its Limited task
was deleted, runner/package/task-file/launch-environment guards passed, no
Smoke or task process remains, and exact Steam continuity passed. Independent
post-run verification reproduced the signed 114-file, 398,165,772-byte active
binding and content fingerprint, 4/4 required signatures with app/addon
publisher agreement, zero package-local `debug.log`, retained rollback, absent
stage, and exact Steam PID/session/start identity.

The materially changed pre-bound coordinator then passed one new neutral proof
at
`C:\Users\admin\steam-bridge-artifacts\windows-local-input-probe-prebound-20260714-003026`.
Its Computer Use app and marker polling began before the Limited task launched
the unchanged reviewed probe. The exact window was discovered and passively
snapshotted 542 ms after its marker; the one title-bar click completed at 1,017
ms and the atomic post-click acknowledgment was written at 2,225 ms, leaving
more than 27 seconds of headroom inside the unchanged product contract. The
result retained exact PID/HWND/session binding, one event 671 ms after the
acceptance boundary, a valid acknowledgment 1,297 native-tick milliseconds
later, target foreground, clean final hook teardown, and zero product activity.
The task returned zero and was deleted; exactly marker/ack/result remained with
no temporary file, process, or window; no Smoke process ran; and Steam retained
its exact PID/session/start identity. This satisfies the updated ledger
condition for at most one fresh pre-bound `persistent-reuse` root. It does not
prove product behavior and must not itself be repeated unchanged.

That authorized root is preserved at
`C:\Users\admin\steam-bridge-artifacts\windows-2d2178c-persistent-reuse-prebound-20260714-004205`.
The pre-bound coordinator retained the current exact window before case 40's
marker, began its single click 125 ms after publication, completed it at 538 ms,
and atomically acknowledged at 644 ms. The semantic auditor passed all three
shown/closed/parked cycles, six ordered active/inactive callbacks, one D3D11
attach, stable persistent identities, exact focus return, 17/17 three-way
D3D11 lifecycle snapshots, final completion, zero crashes, authenticated
cleanup, and every wrapper/Steam-continuity guard.

The root is not receipt evidence because the independent post-profile
fingerprint found a new 157-byte top-level `debug.log`, raising the active
candidate from 114 files/398,165,772 bytes to 115 files/398,165,929 bytes. Its
07:44:15 UTC write time falls immediately after the final render-health summary
and before the product marker, so the presenter case did not create it. Preserve
the file and the complete root; do not delete, exclude, or run another profile
on deployed `2d2178c`. Signatures, task/process/environment cleanup, absent
stage, retained rollback, and exact Steam identity remain healthy, but the
candidate is immutable-invalid.

The bounded source repair retains per-case `ELECTRON_LOG_FILE` and adds the
explicit `--log-file` argument that every other packaged launch class already
uses. A Limited diagnostic against a clean signed 114-file copy in a path with
spaces passed all four render-health cases. A second pass deliberately enabled
Electron logging: four external per-case targets were created, the active
writer produced a non-empty external log, the package produced no `debug.log`,
and its exact 114-file fingerprint remained unchanged after teardown. No task
or product process remained and Steam identity was unchanged. This validates
the writer route and quoting on a disposable copy, not a replacement candidate.

Immutable-package repair `6bdca68` CI
`29222269182` passed package smoke plus Linux x64, Windows x64, and Apple Silicon
macOS. Its Release `29222377196` passed all three prebuilds and the Windows
publish-tarball/ASAR gate. Independent verification confirmed commit
`6bdca68262cdd00192a3b26309292038efa4b440`, Electron `43.1.0`, 114 files, all
1,121 native methods, canonical tarball SHA-256
`cda2ae81d4443746d3c3f50d7c2aaea2b6be8499e4c7e5ee20b8f80b92a2f02c`, and
bundle-archive SHA-256
`00bd923693eee86694a3471118c3ffed5e4c9da7a5d550cdaac515e328542d03`.
The canonical local installed-certificate gate regenerated the exact package
with signing required, 4/4 valid required signatures, app/addon publisher
agreement, 114 files, all 1,121 native methods, and zero package-local runtime
logs.

The signed `6bdca68` replacement is now transactionally deployed. A durable
post-transaction verifier independently confirmed source and active binding to
the signed audit, byte-identical 114-file inventories, 4/4 valid signatures,
app/addon publisher and deployment-record agreement, zero package-local logs,
zero active-package processes, a removed staging directory, retained and
inventory-matched rollback, complete deployment fingerprint logs, and exact
Steam PID/session/start continuity.

A pre-profile static contract audit found one mandatory release-tool repair.
At `6bdca68`, the packaged live-proof receipt generator still required attached
host/renderer agreement from both the native-load `presenter-ready` gate and
the `10-presenter-ready` route case. Since `fe7d989`, those deliberately lazy
checks prove D3D11 selection and host availability without attaching a
renderer; the matrix summarizer correctly accepts that selection-only shape,
while the old receipt self-test fabricated attachment. No live profile was
started on `6bdca68` after this finding. Commit `2d2178c` updates
`scripts/windows-live-proof-receipt.cjs`, its package-smoke assertions, public
Windows proof guidance, and the detailed evidence/ledger. Its real-shaped lazy
fixture plus fake-attachment and incomplete-attached-route adversarial checks
pass. Collect final evidence only on the resulting replacement.

The older `e6c0de9` candidate had
114 files and all 1,121 native methods, passed 4/4 required installed-certificate
signatures with app/addon publisher agreement, deployed transactionally with
rollback, and preserved Steam continuity.

That deployment is invalid for further receipt work. A checkout recovery
attempt created a 157-byte top-level `debug.log` during preflight's direct
`in-process-gpu-on` render-health comparison, raising the active package to 115
files. Preserve the unexpected file; do not delete, exclude, or run more receipt
profiles against that deployment.

Commit `6bdca68` contains one comprehensive immutable-package repair:

- every default packaged Electron launch routes Chromium logging outside the
  candidate;
- the final ASAR executable probe compares the complete bundle immediately
  before and after execution;
- packaged smoke no longer rewrites its bundled `steam_appid.txt`;
- generated native-control files default outside the package;
- matrix artifacts must resolve outside the candidate; and
- standalone and matrix launch artifacts remain outside the candidate.

The exact product/evidence files are `README.md`,
`examples/electron-basic/{README.md,main.js}`,
`scripts/{package-electron-example.cjs,smoke-package.cjs,windows-electron-builder-asar-gate.cjs,windows-electron-smoke.ps1,windows-native-overlay-control.ps1,windows-overlay-matrix.ps1,windows-render-health-probe.ps1}`, and
`docs/research/{test-findings-ledger.md,cross-platform-overlay-status.md}`.
Do not stage `AGENTS.md`, this checkpoint, or `.codex/` with that slice.

## Last Verification

- Exact `5a2ee54` CI `29345092393` passed all four jobs, including package smoke
  and the Windows MSVC native check unavailable on this control host.
- Exact `5a2ee54` Release `29345310464` passed all three native prebuilds, the
  Windows ASAR gate, canonical verification, and artifact upload.
- Independent download and installed-certificate gates passed the canonical
  tarball, unsigned and signed bundle archives, 114-file content binding, all
  1,121 native methods, 4/4 signatures, publisher agreement, and zero package-
  local logs/processes.
- Transactional deployment and a separate post-transaction audit passed exact
  source/active binding, a byte-preserved 115-file `2d2178c` rollback with its
  unexpected file intact, removed stage, zero active/rollback processes, and
  exact Steam continuity.
- The current explicit-log repair passes its focused source assertion, and
  native Windows PowerShell 5.1 parses the changed helper with zero errors.
- Current-worktree `npm test` passes 196/196; `npm run check:platform` and
  `npm run api:check` pass with all 1,121 required native methods accounted for.
- Current-worktree `npm run native:fmt` and `git diff --check` pass.
- This Windows control host cannot complete the repository's POSIX package-
  smoke self-tests because WSL is absent; the direct Windows run reaches the
  hard-coded macOS POSIX-path assertion after packaging and consumer checks.
  Exact GitHub package smoke is mandatory before Release.
- Current-worktree `npm run native:check` is locally environment-blocked because
  this control host has neither the MSVC linker nor Windows SDK libraries. No
  Rust file changed; exact Windows GitHub CI is mandatory before Release.
- A focused interactive Windows regression ran all four render-health cases on
  a disposable 114-file copy. Default health passed, all four cases recorded
  external Electron-log routing, no package-local runtime logs appeared, and
  the complete file/hash inventory stayed identical at 114 files. The final
  candidate-bound matrix will separately enforce exact process cleanup.
- The signed replacement deployment's durable post-transaction verification
  passed every source/active/record/rollback/signature/process/Steam-continuity
  check at exactly 114 files and zero package-local logs.
- Static comparison of the receipt generator against the settled matrix
  summarizer confirmed that `6bdca68` carried stale lazy `presenter-ready`
  expectations; the worktree repair now passes its focused and full checks.
- The focused receipt self-test, `npm run package:smoke`, all 196 tests,
  platform/API checks, Rust format/check, and `git diff --check` pass for the
  repair worktree.
- Exact `2d2178c` CI `29223818759` passed all four jobs.
- Exact `2d2178c` Release `29223856071`, independent artifact verification,
  installed-certificate signing, transactional deployment, independent
  post-deployment audit, and candidate-bound no-modal immutability gate passed.
- The prepared marker watcher and atomic acknowledgment scripts parse under
  native PowerShell 5.1; the acknowledgment correctly rejects the expired
  failed attempt when no exact active probe exists.
- Exact evidence checkpoint `d9f7713` CI `29228168945` passed all four jobs.
- Exact candidate-bound `managed / 11-managed-web-open-and-wait` recovery passed
  with one activation, one automatic panel close, exact focus return, complete
  lifecycle, three-way `windows-d3d11`, clean wrapper/semantic/crash evidence,
  and unchanged post-run package, rollback, signature, and Steam state.
- The first exact `persistent-reuse` root failed closed at its coordinator
  deadline with zero activation/close input; all cleanup guards, the post-run
  candidate binding, and the independent package/rollback/signature/Steam audit
  remained green.
- The initial 1,608 ms disposable coordinator result was superseded because it
  did not isolate click causality. The pre-armed exact retry and a calibrated
  atomic neutral desktop-control test both observed zero Windows foreground
  events; all disposable and exact-run cleanup guards remained green.
- Matched normal/hidden Limited-task direct-child launch diagnostics both made
  Notepad naturally foreground in 5 ms with zero input and complete cleanup,
  disproving task-window visibility as the missing product condition.
- The final hash-pinned neutral Windows-local Computer Use probe passed with one
  exact HWND foreground event, one later atomic acknowledgment, final hook/task/
  process/window cleanup, zero product activity, and exact Steam continuity.
- The one authorized exact-candidate `persistent-reuse` root reached a valid
  marker but the local coordinator missed its 30-second hook window. The hook
  had already stopped at zero events/input before the late acknowledgment was
  written; no cycle ran and the root is not receipt evidence. Every cleanup,
  candidate/signature/rollback/stage, and Steam-continuity check remained green.
- The materially changed pre-bound neutral coordinator started Computer Use
  polling before task launch, snapshotted the exact window 542 ms after its
  marker, completed one click at 1,017 ms, and wrote the later acknowledgment at
  2,225 ms. Its exact event/ack/tick binding, three-file boundary, final hook/
  task/process/window cleanup, zero product activity, and Steam continuity all
  passed.
- The pre-bound exact-candidate persistent-reuse behavior root passed its one
  marker-bound click at 644 ms, all three cycles, six callbacks, one attach,
  stable identities, 17/17 D3D11 snapshots, semantic/crash/wrapper cleanup, and
  Steam continuity. Independent fingerprinting then found a new 157-byte top-
  level `debug.log` written during render-health preflight, invalidating the
  candidate before the product case and the root for receipt use.
- The explicit render-health `--log-file` repair parses and passes its focused
  package-smoke source assertion. A Limited path-with-spaces disposable pass
  with forced Electron logging produced only external logs, retained zero
  package-local logs and the exact 114-file fingerprint, removed its task/
  processes, and preserved Steam identity.
- The first replacement-bound `5a2ee54` persistent root preserved at
  `C:\Users\admin\steam-bridge-artifacts\windows-5a2ee54-persistent-reuse-prebound-20260714-085347`
  passed the signed candidate, native-load, render-health, readiness, and
  assumed-shortcut gates. Its pre-bound watcher observed the fresh marker 186
  ms after publication, but the multi-call Computer Use dispatch produced no
  exact-window foreground event during the unchanged 30-second hook. The hook
  stopped cleanly at zero events/input; the acknowledgment landed 38.6 seconds
  after hook teardown and was never consumed. The Smoke result correctly
  remained absent, so this is coordinator failure rather than presenter or
  receipt evidence.
- That failed root still completed task deletion, runner/package/process and
  launch-environment cleanup, and exact Steam continuity. Independent post-run
  verification retained the signed 114-file/398,125,830-byte fingerprint, no
  package-local `debug.log`, 4/4 signatures, publisher agreement, the complete
  115-file rollback including its preserved unexpected file, zero stage or
  package processes, and exact Steam identity.

The immutable-invalid `2d2178c` deployment is now a retained rollback and must
not run another profile. Its unexpected file remains preserved. Exact signed
replacement `5a2ee54` is active, independently verified, process-free, and
unchanged at 114 files. The failed `5a2ee54` root proves that the repaired
preflight kept this replacement immutable, but it did not activate or close the
presenter and cannot satisfy the receipt. Do not advance to `checkout` or spend
another product root with the same multi-call coordinator.

## Next Actions

1. Hold exact signed `5a2ee54` unchanged. Do not run `checkout`,
   `shortcut-routes`, or `managed-routes` while its required persistent receipt
   root is absent.
2. Permit another `persistent-reuse` root only after a materially different
   coordinator can deliver the one real exact-window click and later atomic
   acknowledgment inside the unchanged 30-second hook without multiple model/
   tool round trips. A user-coordinated physical local/Parsec click is eligible;
   longer waits, extra input, forged acknowledgment, and the current multi-call
   Computer Use sequence are not.
3. If that gate becomes available and is explicitly authorized, collect the
   four roots in order with a fingerprint after each, generate the exact
   31-case/27-activation receipt, and complete the final Windows audit.

Do not repeat the settled managed-web recovery, macOS/Parsec title-bar
synthesis, task-window-style comparison, or any unchanged foreground
experiment. Windows-local Computer Use is now proved only for the neutral exact-
HWND path; do not generalize that proof to product coordination.

Detailed live evidence is in
`docs/research/cross-platform-overlay-status.md`; rerun contracts are in
`docs/research/test-findings-ledger.md`; architecture is in
`docs/research/native-overlay-presenter-plan.md`.

## Exact Next Step

Do not launch another live root. Preserve the failed `5a2ee54` artifact and the
unchanged active candidate while obtaining explicit coordination for a
materially different one-click path that can complete inside the existing
30-second hook. The most direct eligible path is a user ready at the Windows or
Parsec desktop to click the exact Smoke title bar immediately after the marker;
the agent can retain marker polling and write the later challenge-bound atomic
acknowledgment. Once that condition is available and a new run is authorized,
retain every original public App ID `480`, candidate, lifecycle, cleanup,
fingerprint, signature, rollback/stage, and Steam-continuity requirement.

## Focused Same-Process Exact-Host Gate Is Proved

That settled historical evidence remains in the detailed cross-platform status
and ledger; it is not the current rerun target.

## Duplicate Open and Passive Polling Live Proof Are Settled

Those settled historical results remain in the detailed cross-platform status
and ledger; do not repeat them for the immutable-package repair.
