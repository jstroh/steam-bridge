# Current Work Checkpoint

Last reviewed: 2026-07-14

Review anchor: `491faf2` (`Record human Parsec foreground mismatch`).
Reconcile this checkpoint with newer Git history and worktree changes before
acting.

## Active Goal

Complete Steam Bridge Windows x64 production readiness on one exact signed
D3D11 candidate. Preserve the valid public App ID `480` persistent-reuse root,
replace the now-invalid active package, and collect the remaining candidate-
bound `checkout`, `shortcut-routes`, and `managed-routes` roots before generating
the exact 31-case/27-activation receipt. Keep package fingerprints, signatures,
rollback/stage state, three-way renderer agreement, cleanup, privacy, and exact
Steam continuity fail-closed throughout.

## Current State

Exact signed commit `509f3fe` passed CI/Release, signing, transactional
deployment, and one valid receipt-bound persistent-reuse root. That root remains
canonical and must not be rerun:
`C:\Users\admin\steam-bridge-artifacts\windows-509f3fe-persistent-reuse-singlecall-20260714-102001`.

Public checkout behavior is also proved in the focused root
`C:\Users\admin\steam-bridge-artifacts\windows-509f3fe-checkout-approval-exacthwndv2-20260714-120845`.
The exact source naturally launched foreground, consumed one trusted activation,
attached the D3D11 presenter, completed the checkout open/wait lifecycle, closed
at the guarded target, returned focus, authenticated quit, passed the semantic
auditor, cleaned up, and retained exact Steam continuity. It is focused behavior
evidence, not the required four-case receipt root.

Three later four-case attempts are preserved but are not receipt evidence:

- `windows-509f3fe-checkout-20260714-121338` passed prepare-only; its case-03
  exact observer was missed because the external monitor command was malformed.
- `windows-509f3fe-checkout-20260714-121846` passed prepare-only; the title-bar
  input arrived after the exact observer expired and also maximized the window.
- `windows-509f3fe-checkout-20260714-122304` passed prepare-only; one title-bar
  input again arrived just after the observer expired. A passive capture while
  the control process remained alive proved foreground, process, title,
  executable, owner, and the bound Electron `MainWindowHandle` all agreed.

These attempts settle alternate-HWND and Parsec-delivery theories. The repeated
failure was chat/controller notification latency relative to the unchanged
28-second observer, not checkout or package focus topology. Do not ask the user
to babysit another timed click and do not lengthen the product timeout.

The final attempt exposed the active blocker. Its independent deployment audit
found a new zero-byte top-level `debug.log` in the active package: 115 files
instead of the signed 114-file inventory, unchanged total bytes, and a different
content hash. The file's write time falls inside the `in-process-gpu-off`
render-health launch. All parent launches already supplied both external
`ELECTRON_LOG_FILE` and `--log-file`, but their working directory was still the
signed package. Preserve the entire mutated deployment; do not delete, exclude,
or baseline the file and do not run more live cases on `509f3fe`.

The offline repair now in the worktree adds two independent controls:

- render-health Electron processes start in their external case-artifact
  directory, containing any undocumented relative Chromium log fallback;
- after render-health process cleanup, a candidate-bound matrix re-runs the
  signed fingerprint and stops before case 01 if the package drifted.

The valid rollback `rollback-5a2ee54-20260714170053` and the older preserved
invalid `2d2178c` rollback remain part of the audit contract. Do not expose
signer identity details.

## Last Verification

- Native Windows PowerShell 5.1 parses both changed PowerShell scripts;
  `node --check scripts/smoke-package.cjs` and `git diff --check` pass.
- The focused Windows smoke-helper static check passes, including the external
  render-health working directory and post-render-health binding order.
- A native PowerShell synthetic check proves the new candidate gate accepts an
  unchanged binding and writes fail-closed evidence for a changed binding.
- `npm test` passes 196/196; `npm run check:platform`, `npm run api:check`, and
  `npm run native:fmt` pass.
- `npm run package:smoke` reaches its known local Windows POSIX/macOS fixture
  mismatch (`C:\...` versus `/tmp/...`) before the Windows static checks; the
  focused Windows check was therefore run directly and passed.
- Local `npm run native:check` remains environment-blocked because `link.exe`
  and the MSVC SDK are absent; exact GitHub Windows CI supplies that gate.
- Exact `509f3fe` cleanup after every latest root deleted the Limited task,
  restored launch state, emptied runner/package processes, and preserved exact
  Steam PID/session/start continuity.
- The active package is intentionally invalid and preserved with its unexpected
  zero-byte file. No repair claim has been made from a build or static check.

## Next Actions

1. Review the exact diff and privacy boundary, then commit and push the offline
   containment slice and verify GitHub CI.
2. Publish, independently verify, sign, and transactionally deploy one exact
   replacement candidate. Preserve the mutated `509f3fe` directory as rollback
   evidence; never repair it in place.
3. Prove the replacement's four render-health cases keep the package inventory
   unchanged and that the new immediate candidate-integrity gate passes. This
   can be the next no-input readiness boundary; do not start checkout while the
   user is away.
4. Resume the ordered receipt roots only with a local, timely foreground signal
   or a naturally foreground launch. Do not repeat chat-timed click loops.

## Exact Next Step

Complete offline validation of the external-working-directory and immediate
post-render-health candidate-binding repair, commit it intentionally, push it,
and verify exact GitHub CI. No user interaction or live Steam route is required.

Detailed live evidence is in
`docs/research/cross-platform-overlay-status.md`; rerun contracts are in
`docs/research/test-findings-ledger.md`; architecture is in
`docs/research/native-overlay-presenter-plan.md`.
