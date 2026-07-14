# Current Work Checkpoint

Last reviewed: 2026-07-14

Review anchor: `f748704` (`Record Windows coordinator deadline`). Reconcile this
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

Exact signed candidate `5a2ee54` is deployed at the stable package path. Its
independent binding remains 114 files/398,125,830 bytes with content SHA-256
`e08687e93eb2fdf73fcaf924bfabb2f01b00d21dd02380ab6a3b518635019c7f`,
4/4 valid required signatures, app/addon publisher agreement, zero package-local
logs or processes, a preserved 115-file invalid `2d2178c` rollback, no stage,
and exact Steam PID/session/start continuity. The signed archive SHA-256 is
`0c34ca9197a933e585e39ae25460ff67e8ad6a1d78b287cf9863553ba02476a0`.
Do not expose signer identity details.

Exact CI `29345092393` and Release `29345310464` passed for `5a2ee54`.
Installed-certificate signing, transactional deployment, and an independent
post-deployment audit passed. The repaired render-health preflight has now kept
this candidate immutable through two replacement-bound persistent attempts.

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

The bounded worktree repair changes only screenshot panel-bound selection. It
collects qualifying left/right edges from the detected panel's upper band and
uses their lower medians, retaining the prior top-row and average fallbacks.
This preserves the physical per-monitor-DPI, screenshot, foreground,
same-window, and `SendInput` guards. Package smoke now asserts the implementation
shape and replays the observed cursor-expanded edge.

Exact replay against both new-root cycle images returns the real panel
`834..2622` and original target `(2586,430)` for cycles 1 and 2. Replay against
all three cycles from the historical passing root
`C:\Users\admin\steam-bridge-artifacts\windows-2d2178c-persistent-reuse-prebound-20260714-004205`
also returns `834..2622` and `(2586,430)`. No currently deployed candidate
contains this source repair, so do not rerun a live profile on `5a2ee54`.

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
  GitHub CI is mandatory.

## Next Actions

1. Commit and push the screenshot-bound repair, smoke assertion, checkpoint,
   ledger, and detailed evidence. Verify exact GitHub CI, including package
   smoke and Windows native check.
2. Run the exact Release workflow, independently verify its artifacts, rebuild
   the exact Windows package with installed-certificate signing required, and
   transactionally deploy it while preserving rollback, stage, process, package
   fingerprint, signature, and exact Steam-continuity invariants.
3. On that replacement only, collect one new `persistent-reuse` root with the
   proved single-call coordinator and unchanged 30-second hook. Require three
   shown/closed/parked cycles, six ordered callbacks, one D3D11 attach, stable
   identities, exact focus return, complete three-way renderer evidence,
   wrapper cleanup, and an unchanged post-profile candidate.
4. If persistent reuse passes, collect `checkout`, `shortcut-routes`, and
   `managed-routes` in order with a complete fingerprint/deployment/Steam audit
   after each. Stop on the first mutation or semantic failure.
5. Generate and validate the exact 31-case/27-activation receipt and complete
   the final Windows production-readiness audit.

## Exact Next Step

Do not launch another live root on `5a2ee54`. Finish source review and publish
the bounded repair, then require exact green GitHub CI and a newly signed,
verified, transactionally deployed replacement before the next single-call
`persistent-reuse` root.

Detailed live evidence is in
`docs/research/cross-platform-overlay-status.md`; rerun contracts are in
`docs/research/test-findings-ledger.md`; architecture is in
`docs/research/native-overlay-presenter-plan.md`.
