# Current Work Checkpoint

Last reviewed: 2026-07-09

Implementation anchor: `646a01c` (`Harden Windows client checkout proof`).
This checkpoint may be committed immediately after that implementation; always
inspect Git history and the worktree before trusting it.

This is the short, replace-in-place operational checkpoint for fast recovery.
It is not an append-only history and does not replace code, tests, the detailed
platform evidence log, or the presenter design plan.

## Active Goal

Finish the Windows x64 real-purchase overlay proof without exposing private
configured app, product, account, or transaction data.

The local implementation and regression-test preparation is complete. Do not
run another unchanged artifact. The next evidence step is exactly one focused
client-session proof after a current Windows package is built and deployed.
The Windows laptop and Steam Deck are currently unavailable, so live work is
deferred without treating device availability as a product finding.

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

### Historical client-session result remains inconclusive

The historical explicit-client run captured a sanitized client-session target
but showed no automatic prompt or authorization callback. The previous docs
attributed the remaining gap to Steam client/product/account behavior.

A 2026-07-09 code audit found that the smoke app awaited the `InitTxn` HTTP call
before entering `openCheckoutAndWait(...)`. The harness now prepares only local
request state first, arms the smoke lifecycle observer, enters the managed
checkout operation, and invokes deferred `InitTxn` while the presenter is active
and the library shown observer is installed. The client-session wait-start event
is recorded from inside that operation after target capture.

The same audit found a second bridge race: if Steam opened the prompt before
the HTTP response returned, the resolved client target could be rejected as an
already-active overlay. The helper now accepts only the activation belonging to
the current client-session operation and uses its preinstalled shown observer.
Tests cover both a prompt that stays open and one that opens and closes entirely
during the operation. A web-session target cannot adopt that early activation,
and any managed checkout rejection aborts the armed smoke observer immediately.

Do not attribute the historical missing prompt to Steam configuration or client
behavior until the corrected current package is rerun once.

### Diagnostics are locally hardened; live evidence is pending

- QueryTxn diagnostics now use schema `1` with closed result, status, error,
  request-error, endpoint, identifier-type, HTTP, and presence values. Caught
  error strings and arbitrary nested upstream fields are never copied.
- The Windows summarizer normalizes those fields again and requires exactly one
  attempted query after the managed wait timeout and before prompt-missing
  classification. Query failure/timeout remains valid diagnostic evidence; the
  gate does not require a successful result.
- Microtransaction callbacks now carry only a
  `matchesCurrentCheckoutOperation` boolean derived privately from the current
  app/order pair. Required proof ignores stale or mismatched callbacks and
  accepts current plus legacy duplicates. An overlapping checkout cannot clear
  the active matcher, and static response correlation reads the order only from
  the same target-bearing envelope selected for checkout.
- Operation-scoped callback proof belongs only to the direct managed checkout
  case. Shortcut checkout remains parser, route, and lifecycle proof and the
  Windows matrix no longer assigns it a callback requirement.
- No post-change live QueryTxn result or correlated authorization callback is
  documented yet.

### Freshness

- The smoke app is pinned to Electron `43.0.0`; on 2026-07-09,
  `npm run check:electron:latest` reported `43.1.0`.
- The most recent successful Release prebuild predates the D3D11 presenter and
  later Windows host activation fixes. Normal CI performs target `cargo check`
  but does not build and load a current-head Windows native addon.
- There are no Git tags or GitHub releases yet; package version is `0.1.0`.

## Next Actions

1. Wait until the Windows laptop is available; no Steam Deck work is required
   for this Windows-only goal.
2. Rebuild/redeploy one current Windows x64 package and run one focused
   `usersession=client` checkout proof in the interactive desktop session with
   managed-operation ordering, callback correlation, close/back-to-app,
   QueryTxn, and crash gates.
3. Use a fresh unique order ID represented as a decimal string or safe integer
   so callback correlation is exact without exposing the value.
4. If correct ordering still yields a healthy pending transaction but no prompt,
   classify the remaining gap using that evidence and retain `usersession=web`
   as the recommended Windows Electron path.
5. Update this checkpoint, the matching ledger entries, and the detailed
   Windows evidence immediately after the result.

Keep Electron `43.0.0` for the first ordering A/B rerun so the diagnosis changes
one premise. Handle the `43.1.0` update and its minimum re-baseline separately.

## Last Reported Verification

Against implementation commit `646a01c` on 2026-07-09:

- `npm run package:smoke` passed.
- `npm test` passed all 174 tests.
- `npm run api:check`, `npm run check:platform`, `npm run native:fmt`, and
  `npm run native:check` passed. `native:check` reported only the existing
  future-incompatibility warning for transitive `block 0.1.6`.
- `pwsh` is not installed on this macOS host, so the expanded PowerShell schema
  gate received package-smoke source coverage but not a local PowerShell parse;
  the Windows package/live lane must exercise it next.
- `git diff --check` passed; the branch was pushed and the worktree was clean.
- GitHub CI run `29057268559` passed package smoke plus the Apple Silicon,
  Windows x64, and Linux x64 target jobs.
- `npm run check:electron:latest` failed only on the intentional/latest-version
  comparison described above; it is not part of normal `npm test`.

Reverify these claims after newer commits. Branch cleanliness and CI status are
live facts and must always be checked rather than inferred from this checkpoint.

## Private/External Prerequisites

Real checkout proof may use a private configured app/product, publisher Web API
credential, and request fixture only through the existing runtime handoff. This
file and the test ledger may record presence and sanitized shape only. Never add
the values, names, IDs, URLs, or paths.

The Windows laptop and Steam Deck are currently unavailable. This is a transient
external prerequisite, not evidence about Steam Bridge or Steam behavior. Only
the Windows laptop is needed for the active goal.

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
