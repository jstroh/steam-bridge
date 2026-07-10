# Current Work Checkpoint

Last reviewed: 2026-07-09

Implementation anchor: `646a01c` (`Harden Windows client checkout proof`).
This checkpoint may be committed immediately after that implementation; always
inspect Git history and the worktree before trusting it.

This is the short, replace-in-place operational checkpoint for fast recovery.
It is not an append-only history and does not replace code, tests, the detailed
platform evidence log, or the presenter design plan.

## Active Goal

Finish current-package Windows x64 proof for every non-purchase path using only
public App ID `480`: managed routes, raw-native observe controls, shortcuts,
passive notifications, synthetic checkout routing, close/back-to-app, native
renderer identity, high-DPI input, render health, and crash cleanup.

Do not run another private `InitTxn` suite. Real purchase proof remains paused
until its separate prerequisites exist; it is not part of the active Windows
matrix work.

## Proven Baseline

- Public App ID `480` proves generic Steam initialization and overlay plumbing,
  not real purchase authorization.
- Explicit Windows D3D11 runs have broad passing managed evidence. The claimed
  unset/default renderer identity is under fresh audit because current live
  diagnostics exposed a TypeScript/Rust default mismatch.
- A private configured-product Windows `usersession=web` run proved
  `InitTxn -> returned Steam URL -> managed overlay browser -> close/back-to-app`.
  It does not claim `MicroTxnAuthorizationResponse`.
- macOS Apple Silicon and Steam Deck managed presenter coverage is broad and
  green for generic routes. Intel/Rosetta/universal macOS remains unsupported.
- The package README currently recommends the proved web-session flow for
  Windows Electron checkout while client-session prompt behavior remains open.

## Current Findings and Open Questions

### Current public Windows proof exposed two real harness/product gaps

On 2026-07-10 UTC, a signed current package passed interactive Session 1
readiness, native load, shortcut validation, and default render health. Steam
injected the overlay renderer into the correct public App ID `480` process.

The aggregate `full` suite then stopped on its legacy raw web baseline:
`IsOverlayEnabled` stayed false because that diagnostic action creates no
managed presenter surface. Do not use this raw case as the gate for D3D11
product routes; use the `managed`, `shortcut-routes`, and public `checkout`
suites. The raw baseline remains diagnostic-only unless its implementation
changes.

The first attached managed web case exposed source drift hidden by the previous
verifier. The TypeScript snapshot reported `windows-d3d11`, while authoritative
native host and renderer diagnostics reported `windows-opengl`; Rust still
defaulted an unset backend to OpenGL. The local fix makes only explicit OpenGL
aliases select WGL and defaults the actual native renderer to D3D11. Attached
presenter cases now verify the top-level, host, and renderer backend fields.

The same case opened Steam successfully but could not close at 225% display
scaling. Electron/lifecycle bounds and the PowerShell probe were DPI-virtualized
while the native host rect was physical, so the screenshot and `SendInput`
target missed the visible Steam panel. The local probe now enters process and
thread per-monitor-v2 awareness before screen APIs and prefers the authoritative
physical native-host rect. One focused attached web close must pass before the
broad public suites resume.

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

Do not attribute the historical missing prompt to Steam configuration, client
behavior, or the bridge until the corrected path reaches `InitTxn` once through
that configured application/backend lane.

### Current live lane is environment-blocked

On 2026-07-10 UTC, a current, signed Windows package passed the interactive
Session 1 environment gates and wrote a sanitized request-shape preflight. That
preflight showed the private handoff was not a complete, non-empty product-proof
request. The focused checkout suite also did not reach its direct approval
case: the prepare-only result arrived roughly seven seconds after the existing
no-result guardrail, so the matrix stopped with direct `InitTxn` missing. The
attempt created no transaction, ran no `QueryTxn`, emitted no authorization
callback, and provides no new client-session checkout evidence.

The configured app plus `InitTxn`-capable application/backend test path and a
valid private runtime handoff are not currently available. Treat this as an
external prerequisite, not a bridge or Steam-client finding. Do not rerun the
same suite or lengthen its timeouts. If the prepare launch delay recurs after
those prerequisites exist, diagnose that boundary separately before starting a
transaction.

### Diagnostics are locally hardened; live evidence awaits the prerequisite

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

1. Commit and push the renderer/DPI fix, then use the manual Release prebuild
   workflow to build the Windows addon on `windows-latest`; the macOS packager
   cannot link a changed MSVC addon and must not silently reuse the old prebuild.
2. Repackage, deploy, and sign that exact addon without restarting Steam.
3. Run one focused managed web case at the current 225% scaling. Require actual
   D3D11 in all three backend fields, per-monitor-v2 probe evidence, a physical
   in-panel click, close/back-to-app, parking, and clean crashes.
4. If focused proof passes, run the 18-case `managed`, 10-case
   `shortcut-routes`, and four-case public synthetic `checkout` suites.
5. Record results in the existing ledger/detailed evidence, run full checks,
   commit, push, and verify CI. Keep private purchase work paused.

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

Live Windows review on 2026-07-10 UTC:

- `npm run example:package:win` rebuilt the Electron `43.0.0` Windows x64
  package; deployed source files matched the local package before signing and
  all 12 signable files verified Authenticode `Valid` afterward.
- Interactive Session 1 readiness, native load, and default render health
  passed with no current Steam-client warnings. Sanitized request preflight was
  recorded but showed the private input was not product-proof-ready.
- The suite stopped on the prepare-only launch guardrail before the direct
  `InitTxn` case. The late prepare result was clean, but no transaction,
  `QueryTxn`, callback, or client-session conclusion exists.
- Cleanup left zero smoke processes and zero matrix tasks; Steam and Parsec
  remained running without a Steam restart.
- A public full-suite attempt passed all environment gates but stopped on the
  diagnostic raw web action with no managed surface; Steam injection itself was
  present and current Steam-client health was clean.
- A public managed attempt activated the Steam web overlay, then exposed the
  actual OpenGL default and 225%-DPI close-probe coordinate mismatch described
  above. It timed out waiting for close with no crash evidence and cleaned up.

Recovery-documentation verification on 2026-07-10:

- `npm run package:smoke`, `npm test` (174/174), and `npm run api:check`
  passed.
- `git diff --check` passed. Added-line scans found no private runtime markers,
  long numeric identifiers, URLs, or key assignments.
- After the renderer/DPI fix, `npm run package:smoke`, `npm run native:fmt`, and
  `npm run native:check` passed. A fresh Windows native prebuild is still
  required before live validation because the cached `.node` hash did not
  change when only the macOS-side package step ran.

Reverify these claims after newer commits. Branch cleanliness and CI status are
live facts and must always be checked rather than inferred from this checkpoint.

## Private/External Prerequisites

Real checkout proof may use a private configured app/product, publisher Web API
credential, and request fixture only through the existing runtime handoff. This
file and the test ledger may record presence and sanitized shape only. Never add
the values, names, IDs, URLs, or paths.

The Windows laptop is available and the Steam Deck is irrelevant to this goal.
The blocking prerequisite is a configured app launch that reaches an
`InitTxn`-capable application/backend test path with a complete, non-empty
private product request/runtime handoff. It is not currently available and is
not evidence about Steam Bridge or Steam behavior.

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
