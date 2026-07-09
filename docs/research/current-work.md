# Current Work Checkpoint

Last reviewed: 2026-07-09

Code and evidence anchor: `620e471` (`Add Windows client checkout query
diagnostics`). The recovery documentation that introduced this checkpoint is
newer than that anchor. Always inspect Git history and the worktree before
trusting this file.

This is the short, replace-in-place operational checkpoint for fast recovery.
It is not an append-only history and does not replace code, tests, the detailed
platform evidence log, or the presenter design plan.

## Active Goal

Finish the Windows x64 real-purchase overlay proof without exposing private
configured app, product, account, or transaction data.

The immediate task is not another unchanged live run. First correct the smoke
harness so the private `InitTxn` operation executes inside
`openCheckoutAndWait(...)`, after the presenter activation hold and overlay
shown observer are installed. Then rerun one focused client-session proof.

## Proven Baseline

- Public App ID `480` proves generic Steam initialization and overlay plumbing,
  not real purchase authorization.
- Windows D3D11 is the managed default. Public managed routes, shortcut routes,
  passive notifications, synthetic checkout routing, close/back-to-app,
  zero-FPS parking, render health, and crash diagnostics have passing evidence.
- A private configured-product Windows `usersession=web` run proved
  `InitTxn -> returned Steam URL -> managed overlay browser -> close/back-to-app`.
  It does not claim `MicroTxnAuthorizationResponse`.
- macOS Apple Silicon and Steam Deck managed presenter coverage is broad and
  green for generic routes. Intel/Rosetta/universal macOS remains unsupported.
- The package README currently recommends the proved web-session flow for
  Windows Electron checkout while client-session prompt behavior remains open.

## Current Findings and Open Questions

### Client-session checkout result is inconclusive

The historical explicit-client run captured a sanitized client-session target
but showed no automatic prompt or authorization callback. The previous docs
attributed the remaining gap to Steam client/product/account behavior.

A 2026-07-09 code audit found that the smoke app currently awaits
`captureInitTxnCheckout()` before calling `openCheckoutAndWait(() =>
transaction)`. For `usersession=client`, `InitTxn` is the action that can trigger
Steam's automatic prompt. The presenter activation hold and shown observer are
therefore installed after the trigger. The library helper itself has the correct
order and unit coverage verifies that the presenter is active inside its
operation callback.

Do not attribute the missing prompt to Steam configuration or client behavior
until this ordering is fixed and the same focused proof is rerun.

### Diagnostic/proof gaps

- Commit `620e471` added bounded, read-only, value-minimized `clientQuery*`
  diagnostics, but no post-change live QueryTxn result is documented and the
  remaining scalar fields are not yet allowlist-normalized.
- The Windows summarizer prints those fields but does not yet require the query
  attempt after a missing client prompt.
- Required callback proof validates app ID, authorization, source, presenter,
  and lifecycle, but does not correlate the callback to the transaction/order
  created by the current operation. Correlation should be computed privately
  and emitted only as a boolean match marker.
- Query result/status/error scalars should be normalized defensively rather than
  relying entirely on Valve's current response schema for privacy.

### Freshness

- The smoke app is pinned to Electron `43.0.0`; on 2026-07-09,
  `npm run check:electron:latest` reported `43.1.0`.
- The most recent successful Release prebuild predates the D3D11 presenter and
  later Windows host activation fixes. Normal CI performs target `cargo check`
  but does not build and load a current-head Windows native addon.
- There are no Git tags or GitHub releases yet; package version is `0.1.0`.

## Next Actions

1. Refactor the smoke checkout path so in-app private `InitTxn` capture is the
   operation passed to `openCheckoutAndWait(...)` rather than a completed value.
2. Add a regression test that proves the presenter is active and the shown
   observer is established when the smoke harness invokes client `InitTxn`.
3. Allowlist-normalize and require QueryTxn evidence after a classified missing
   prompt, and add a private in-process callback-correlation boolean.
4. Rebuild/redeploy one current Windows x64 package and run one focused
   `usersession=client` checkout proof in the interactive desktop session with
   callback, close/back-to-app, QueryTxn, and crash gates.
5. If correct ordering still yields a healthy pending transaction but no prompt,
   classify the remaining gap using that evidence and retain `usersession=web`
   as the recommended Windows Electron path.
6. Update this checkpoint, the matching ledger entries, and the detailed
   Windows evidence immediately after the result.

Keep Electron `43.0.0` for the first ordering A/B rerun so the diagnosis changes
one premise. Handle the `43.1.0` update and its minimum re-baseline separately.

## Last Reported Verification

Against the worktree based on `620e471` on 2026-07-09, including the recovery
documentation change:

- `npm run package:smoke` passed.
- `npm test` passed all 171 tests.
- `npm run api:check`, `npm run check:platform`, `npm run native:fmt`, and
  `npm run native:check` passed. `native:check` reported only the existing
  future-incompatibility warning for transitive `block 0.1.6`.
- `git diff --check` passed and the worktree began clean.
- The latest CI for `620e471` passed all three target jobs plus package smoke.
- `npm run check:electron:latest` failed only on the intentional/latest-version
  comparison described above; it is not part of normal `npm test`.

Reverify these claims after newer commits. Branch cleanliness and CI status are
live facts and must always be checked rather than inferred from this checkpoint.

## Private/External Prerequisites

Real checkout proof may use a private configured app/product, publisher Web API
credential, and request fixture only through the existing runtime handoff. This
file and the test ledger may record presence and sanitized shape only. Never add
the values, names, IDs, URLs, or paths.

## Detailed Sources

- [Test findings and rerun gates](test-findings-ledger.md)
- [Cross-platform live evidence](cross-platform-overlay-status.md)
- [Native presenter architecture](native-overlay-presenter-plan.md)
- [Windows smoke and matrix runbook](../../examples/electron-basic/README.md)
- [Public project guidance](../../README.md)
- [Package consumer guidance](../../packages/steam-bridge/README.md)

## Update Contract

Keep this file short and current. Replace stale goal/finding/next-step text
rather than accumulating session history. Put durable live results in the test
ledger and cross-platform evidence log, architecture decisions in the presenter
plan, and public recommendations in the READMEs.
