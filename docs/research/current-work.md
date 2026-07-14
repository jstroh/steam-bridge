# Current Work Checkpoint

Last reviewed: 2026-07-14

Review anchor: `e67cde9` (`Record Windows checkout controller blocker`).
Reconcile this checkpoint with newer Git history and worktree changes before
acting.

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

Exact signed candidate `509f3fe` remains deployed at the stable package path.
Its binding is 114 files/398,126,943 bytes with content SHA-256
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

Exact CI `29350725095` and Release `29350937834` passed for `509f3fe`.
Transactional deployment retained exact `5a2ee54` as
`rollback-5a2ee54-20260714170053` and preserved the earlier invalid 115-file
`2d2178c` rollback and its unexpected file.

The receipt-bound `persistent-reuse` root is
`C:\Users\admin\steam-bridge-artifacts\windows-509f3fe-persistent-reuse-singlecall-20260714-102001`.
It passed public App ID `480`, exact candidate binding, native load, readiness,
one trusted isolated-preload activation, three D3D11 shown/closed/parked cycles,
six ordered activation callbacks, stable presenter identities, 17/17 three-way
`windows-d3d11` snapshots, exact focus return, authenticated quit, zero crashes,
semantic audit, Limited-task cleanup, and an independent immutable deployment
audit. Do not rerun it.

Public checkout is currently blocked before product activation by the Windows
Computer Use foreground controller, not by Steam Bridge checkout behavior:

- `C:\Users\admin\steam-bridge-artifacts\windows-509f3fe-checkout-singleclick-20260714-103633`
  passed preflight and prepare-only, then emitted one fresh nonforeground marker
  for `02-checkout-approval`. The suite coordinator incorrectly reused a
  persistent-reuse-only marker validator, rejected the checkout action, and sent
  no click or acknowledgment. Preserve it as superseded coordinator evidence.
- `C:\Users\admin\steam-bridge-artifacts\windows-509f3fe-checkout-singleclickv2-20260714-104254`
  used action-bound coordinator source SHA-256
  `40d0a8dba24664cb2d2de84d6bff99f2392bdee4330242f0d85c5e2447a79236`.
  It validated the exact marker and package window, but Computer Use could not
  activate the captured window. A current-window explicit-activation recovery
  failed identically. No click or acknowledgment occurred; the native hook
  timed out with zero foreground events and zero activation/close input.
- `C:\Users\admin\steam-bridge-artifacts\windows-509f3fe-checkout-approval-appfirst-20260714-104909`
  narrowed the changed premise to `02-checkout-approval`. Coordinator source
  SHA-256
  `2c491922510b845cdcb7a62ae3963badc1b03687be87cc404e25bf13343b6477`
  followed the documented app-first discovery, exact-window rehydration, and
  one explicit activation. Computer Use again returned `failed to activate
  captured window`; it sent no click or acknowledgment and the hook failed
  closed. This settles stale flat-list discovery as not the cause.

Official Win32 documentation closes the remaining autonomous activation
alternatives. `SetForegroundWindow` can still be denied after its listed
conditions are met and directs background applications to notify rather than
force foreground. `AllowSetForegroundWindow` requires a caller that already
has foreground permission; `SetWindowPos` cannot bypass that permission;
`FlashWindowEx` does not activate; and `UIAccess` is restricted to assistive
technology and explicitly not for applications that merely want foreground.
The successful persistent coordinator and failed checkout coordinators bound
the same enabled, non-iconic, same-session Electron window shape and geometry.
There is therefore no evidence-backed package or window-shape repair for exact
`509f3fe`; topmost, injected ALT/click, retry, broker, and `UIAccess` variants
would weaken the trusted-input proof or violate the settled rerun contract.

All three failed tasks deleted their Limited tasks, emptied runner/package/task
processes, restored launch environment state, removed task files, and preserved
exact Steam PID `16720`, session `1`, and native start ticks
`639195030301407830`. Independent audits after the full attempts and focused
attempt retained the exact active and `5a2ee54` rollback bindings, 4/4
signatures, app/addon publisher agreement, the complete 115-file invalid
rollback and its 157-byte unexpected file, no stage, and zero package logs or
processes. No repository code change is justified by these controller-only
failures, and none of these roots is receipt evidence.

## Last Verification

- Native Windows PowerShell 5.1 parses `scripts/windows-overlay-matrix.ps1`.
- The focused Windows smoke-helper static check and exact cursor-contaminated
  screenshot replay pass.
- `npm test` passes 196/196; `npm run check:platform`, `npm run api:check`,
  `npm run native:fmt`, `node --check scripts/smoke-package.cjs`, and
  `git diff --check` pass.
- Local package smoke reaches its known POSIX/macOS fixture assertion because
  WSL is absent; local native check remains environment-blocked by the absent
  MSVC linker/SDK. Exact GitHub CI supplies both gates.
- Exact GitHub CI `29350725095`, Release `29350937834`, artifact verification,
  installed-certificate signing gate, deployment, and rollback audits pass.
- Exact signed `509f3fe` persistent reuse passes its semantic auditor and
  post-profile invariant audit.
- Each checkout-controller failure has an exclusive zero-input fail-closed
  terminal, complete wrapper cleanup, and a matching post-run immutable
  candidate/rollback/signature/stage/process/Steam audit.
- Microsoft foreground, delegation, z-order, notification, injected-input, and
  `UIAccess` documentation agrees with the observed controller boundary; no
  compliant autonomous activation mechanism applies to this exact launch.

## Next Actions

1. Do not repeat the unchanged Computer Use activation experiment. Resume only
   when the Windows controller can activate the exact smoke window, or when a
   person is ready to perform the one physical title-bar click after the fresh
   challenge marker appears. First repeat only focused public
   `02-checkout-approval`; require one foreground event, one accepted
   challenge-bound acknowledgment, and complete lifecycle/cleanup.
2. If the focused approval passes, collect all four public checkout cases in one
   fresh root on exact `509f3fe`, then run the full immutable deployment audit.
3. Collect `shortcut-routes` and `managed-routes` in order, auditing after each;
   then generate and validate the exact 31-case/27-activation receipt.

## Exact Next Step

Have the user present at the Windows desktop for one narrowly timed physical
click. Arm the focused `02-checkout-approval` task and fresh marker first; when
the `Steam Bridge Electron Smoke` window appears nonforeground, instruct the
user to click its title bar once. Do not click inside checkout content, send a
second input, pre-acknowledge, lengthen the hook, or run the four-case suite
until the focused handoff and cleanup pass.

Detailed live evidence is in
`docs/research/cross-platform-overlay-status.md`; rerun contracts are in
`docs/research/test-findings-ledger.md`; architecture is in
`docs/research/native-overlay-presenter-plan.md`.
