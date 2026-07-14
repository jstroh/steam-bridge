# Current Work Checkpoint

Last reviewed: 2026-07-14

Review anchor: `509f3fe` (`Stabilize Windows overlay close targeting`). Reconcile this
checkpoint with newer Git history and worktree changes before acting.

## Active Goal

Complete Steam Bridge Windows x64 production readiness on one exact signed
D3D11 candidate. Collect candidate-bound public App ID `480` roots in order
(`persistent-reuse`, `checkout`, `shortcut-routes`, `managed-routes`), generate
and validate the exact 31-case/27-activation receipt, and preserve immutable
package fingerprints, signatures, rollback/stage state, three-way renderer
agreement, task/process/environment cleanup, privacy, and exact Steam continuity
after every profile. Implement only evidence-required repairs; commit, push,
and verify applicable GitHub CI for every meaningful slice.

## Current State

Exact signed candidate `509f3fe` is deployed at the stable package path. Its
independent binding is 114 files/398,126,943 bytes with content SHA-256
`ce36a7b0d9fad0def55de74ec94a64f682b623dcba2d86127fe29c5dce5f9c09`,
4/4 valid required signatures, app/addon publisher agreement, zero package-local
logs or processes, no stage, and exact Steam PID/session/start continuity. The
signed archive SHA-256 is
`b95090b2de262b470c39571616adb6d310db119955abf3f0c5bac28d62d0dc0b`;
audit SHA-256 is
`01f9aaedf8e26656284c47813dd7120c70f702af4c3496622b5d1d1dabd7283b`;
binding SHA-256 is
`55f5ee927fd82781b1f5da0ee5d11295a56efc4f1cc13e431e0e25971b5a699e`.
Do not expose signer identity details.

Exact CI `29350725095` and Release `29350937834` passed for `509f3fe`. Independent
download verification bound the canonical tarball, Electron `43.1.0`, 114-file
bundle, all 1,121 native methods, and exact commit/ref. The installed-certificate
gate rebuilt that tarball with signing required and passed all package and
publisher checks. Transactional deployment retained exact `5a2ee54` as
`rollback-5a2ee54-20260714170053` and left the earlier invalid 115-file
`2d2178c` rollback and its unexpected file intact. A separate post-transaction
audit reproved source/active identity, both exact rollback bindings, all four
signatures, publisher agreement, zero package logs/processes, absent stage, and
exact Steam continuity.

The first replacement attempt at
`C:\Users\admin\steam-bridge-artifacts\windows-5a2ee54-persistent-reuse-prebound-20260714-085347`
failed before product activity because its multi-call Computer Use coordinator
missed the unchanged 30-second foreground hook. Preserve it as fail-closed
coordination evidence; do not repeat that coordinator.

A materially different single-call coordinator then ran window discovery,
fresh marker validation, exact package-bound title matching, one title-bar
click, post-click marker revalidation, and atomic acknowledgment in one Windows
Computer Use call. Its source hash is
`7435c507fc32ec0bf70bdfcf5740a30514549244856d1cd524c13ca13e0d5538`.
It found the marker after 67,877 ms, began the click 372 ms later, completed the
click in 352 ms, and atomically acknowledged 997 ms after marker discovery.
The native hook accepted exactly one challenge-bound foreground event and one
trusted activation dispatch with exact source PID/window/session/geometry
binding and clean teardown.

The resulting root is
`C:\Users\admin\steam-bridge-artifacts\windows-5a2ee54-persistent-reuse-singlecall-20260714-091243`.
It passed signed-candidate binding, native load, all render-health gates,
readiness, assumed-shortcut state, and the initial foreground/activation gate.
Cycle 1 used the D3D11 host, opened visible Steam web content, targeted physical
point `(2586,430)`, closed, became inactive, parked, and completed. Cycle 2
reused the same host and reached active/shown, but the screenshot detector used
the first qualifying bright row. The pointer left by cycle 1 merged with that
row, expanding its detected right edge from the real `2622` to `2672` and
shifting the close target 50 physical pixels right to `(2636,430)`. The guarded
input was sent there, the panel remained open, and the lifecycle failed closed
without cycle 3. This is a deterministic evidence-probe target defect, not a
presenter, renderer, persistent-reuse, or timing regression. The root is not
receipt evidence.

The failed root still deleted its Limited task, emptied runner/package/task
processes, restored launch environment state, removed task files, retained
exact Steam continuity, and passed an independent post-root deployment audit:
the active candidate remained byte-identical at 114 files/398,125,830 bytes,
with no `debug.log`, 4/4 valid signatures, publisher agreement, zero active or
rollback processes, the complete 115-file rollback and preserved unexpected
file, and no stage.

Commit `509f3fe` changes only screenshot panel-bound selection. It
collects qualifying left/right edges from the detected panel's upper band and
uses their lower medians, retaining the prior top-row and average fallbacks.
This preserves the physical per-monitor-DPI, screenshot, foreground,
same-window, and `SendInput` guards. Package smoke now asserts the implementation
shape and replays the observed cursor-expanded edge.

Exact replay against both new-root cycle images returns the real panel
`834..2622` and original target `(2586,430)` for cycles 1 and 2. Replay against
all three cycles from the historical passing root
`C:\Users\admin\steam-bridge-artifacts\windows-2d2178c-persistent-reuse-prebound-20260714-004205`
also returns `834..2622` and `(2586,430)`. The deployed `509f3fe` candidate now
contains this exact repair.

Its receipt-bound `persistent-reuse` root is
`C:\Users\admin\steam-bridge-artifacts\windows-509f3fe-persistent-reuse-singlecall-20260714-102001`.
The single-call coordinator was armed before task launch, but the source started
naturally foreground and took the valid transition-not-required branch. It
created no marker or acknowledgment and required no Computer Use click. The
unused waiting coordinator was stopped only after the task had completed.

The root passed public App ID `480`, exact signed-candidate binding, native load,
all render-health/readiness/assumed-shortcut gates, one trusted isolated-preload
activation, three D3D11 shown/closed/parked cycles, six ordered active/inactive
callbacks, one attach, stable controller/surface-lease/native-instance/host
identities, exact source focus return, 17/17 presenter/native-host/renderer
`windows-d3d11` lifecycle snapshots, authenticated quit, final completion, and
zero crashes. All three 225%-scaled screenshots detected panel right edge
`2622` and targeted `(2586,430)`, including the formerly failing second cycle.
The wrapper deleted its Limited task and passed runner/package/task-file/
launch-environment/Steam cleanup. The semantic auditor reports zero failures.

Independent post-profile verification retained the exact 114-file/398,126,943-
byte active fingerprint, zero `debug.log`, 4/4 signatures, publisher agreement,
the exact 114-file `5a2ee54` rollback, the complete 115-file invalid `2d2178c`
rollback and its unexpected file, no stage or package process, and exact Steam
PID/session/start continuity. This root is valid receipt evidence. The next
ordered profile is public `checkout`; do not rerun persistent reuse.

## Last Verification

- Native Windows PowerShell 5.1 parses `scripts/windows-overlay-matrix.ps1`.
- The focused Windows smoke-helper static check passes, including the exact
  cursor-contaminated target replay.
- Exact screenshot replay passes for two current failed-root cycles and all
  three historical known-good cycles.
- `npm test` passes 196/196.
- `npm run check:platform`, `npm run api:check`, and `npm run native:fmt` pass;
  the API audit accounts for all 1,121 required native methods.
- `node --check scripts/smoke-package.cjs` and `git diff --check` pass.
- Direct Windows `npm run package:smoke` passes its initial native, receipt,
  packaging, and consumer checks, then reaches the known hard-coded POSIX/macOS
  path assertion because WSL is absent. Exact GitHub package smoke is mandatory.
- Local `npm run native:check` remains environment-blocked because this host has
  no MSVC linker or Windows SDK libraries. No Rust file changed; exact Windows
  GitHub CI supplied the passing native check.
- Exact GitHub CI `29350725095` passed package smoke plus Apple Silicon macOS,
  Linux x64, and Windows MSVC jobs.
- Exact Release `29350937834`, independent artifact verification, the local
  installed-certificate gate, signed source binding, staged-copy binding,
  transactional deployment, and an independent post-transaction audit pass.
- Exact signed `509f3fe` persistent-reuse passes the semantic auditor, all three
  close cycles at the repaired target, full cleanup, and the independent
  post-profile candidate/rollback/signature/stage/process/Steam audit.

## Next Actions

1. Collect public `checkout` on exact signed `509f3fe`. Arm the proved
   single-call coordinator before task launch, but allow the valid naturally-
   foreground branch to require no external click. Require all four public cases,
   action-aware terminal lifecycle, three-way D3D11 agreement, cleanup, and an
   unchanged post-profile deployment audit.
2. If checkout passes, collect `shortcut-routes` and `managed-routes` in order
   with a complete fingerprint/deployment/Steam audit after each. Stop on the
   first mutation or semantic failure.
3. Generate and validate the exact 31-case/27-activation receipt and complete
   the final Windows production-readiness audit.

## Exact Next Step

Collect the four-case public `checkout` root on exact signed `509f3fe`, with the
same coordinator armed for at most one challenge-bound click only if a fresh
nonforeground marker appears. Fingerprint and audit the active package,
rollbacks, stage/process state, signatures, and exact Steam continuity
immediately afterward. Do not start `shortcut-routes` unless every checkout
case and invariant passes.

Detailed live evidence is in
`docs/research/cross-platform-overlay-status.md`; rerun contracts are in
`docs/research/test-findings-ledger.md`; architecture is in
`docs/research/native-overlay-presenter-plan.md`.
