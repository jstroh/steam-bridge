# Current Work Checkpoint

Last reviewed: 2026-07-16

Review anchor: `42495d9` (`Record successful v0.1.6 publication`).

## Active Goal

Stabilize the persistent Windows D3D11 presenter after a source-linked Electron
consumer exposed non-client-area coverage, idle flicker, and move/resize hangs.
The local implementation and regression coverage are complete; no new package
candidate or npm publication has started.

## Current State

Published `steam-bridge@0.1.6` remains the unchanged predecessor. The current
source slice:

- positions the Windows host over the Electron client area using
  `GetClientRect` plus `ClientToScreen`;
- filters the presenter message pump to its own HWND, avoids redundant
  `SetWindowPos` calls, and never forces a hidden host visible during geometry
  synchronization;
- synchronizes Electron geometry only after terminal `moved` and `resized`
  events instead of re-entering the live Windows move/size loop; and
- keeps an unprimed passive Windows host detached for unsolicited
  needs-present state, while explicit managed or passive preparation still
  attaches and a falling edge parks the presenter again.

A same-session, source-linked Windows Electron consumer was exercised at a
1024x768 development content size. Startup stayed stable without DevTools; a
pending checkout surface was dismissed with Escape without authorization; the
managed Friends surface opened, closed with Escape, reopened, and closed again;
and a title-bar drag completed without a ghost or unresponsive window. The
surface stayed inside the client area. This proves the local source path, not a
packaged release or real purchase authorization.

The Windows checkout still contains unrelated local `AGENTS.md`, `.codex`, and
input-probe changes that belong to the user and must remain untouched.

## Last Verification

- `npm test` passes all 200 tests, TypeScript, Electron-version, shortcut, and
  Windows package-gate checks.
- `npm run native:fmt`, `npm run native:check`, `npm run check:platform`, and
  `npm run api:check` pass.
- An optimized Windows native build linked into the source consumer and passed
  the live lifecycle above.
- `npm run package:smoke` passes its applicable JavaScript, native-manifest,
  Windows receipt/fingerprint, InitTxn-capture, macOS-helper, signing, and
  checkout-target self-tests before stopping at the known native-Windows Bash
  boundary recorded by `WIN-PACKAGE-SMOKE-HOST-001`.
- `git diff --check` passes, and no private app, product, account, transaction,
  Steam, key, price, checkout URL, or fixture identifier was added.

## Next Actions

1. Commit and push the implementation, tests, and sanitized research updates;
   then verify GitHub CI.
2. Treat this as a new native package payload: assemble and prove a fresh
   three-platform candidate, including proportionate packaged Windows live
   coverage, before any version or npm publication.
3. Keep the consumer on its local source link until a proved package successor
   is public; do not publish directly from this checkout.

## Exact Next Step

Commit and push the Windows presenter stability slice, then inspect its GitHub
Actions result.

Detailed settled platform evidence is in
`docs/research/cross-platform-overlay-status.md`; rerun contracts are in
`docs/research/test-findings-ledger.md`; architecture is in
`docs/research/native-overlay-presenter-plan.md`.
