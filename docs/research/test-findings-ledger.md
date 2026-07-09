# Test Findings Ledger

Last reviewed: 2026-07-09

This is the fast index for deciding whether a live, manual, expensive, negative,
or environment-sensitive experiment should be run again. Detailed artifact
history remains in the linked platform documents.

## Ledger Rules

- Search this file before a live experiment.
- Status values are `SETTLED`, `OPEN`, `ENVIRONMENT BLOCKER`,
  `DIAGNOSTIC ONLY`, and `SUPERSEDED`.
- Preserve negative and inconclusive results. Update or supersede an existing
  entry instead of adding the same experiment again.
- Every entry must say what changed before it is worth repeating.
- Routine unit/type/build checks belong in `current-work.md` and CI, not in this
  ledger.
- Never record private app/product/account names or IDs, item IDs,
  order/transaction/Steam IDs, keys, prices, checkout URLs, private fixture
  paths, or raw private payloads.

## Windows x64

| ID | Status | Finding | Repeat only when | Evidence |
| --- | --- | --- | --- | --- |
| `WIN-SESSION-001` | `SETTLED` | SSH Session 0 cannot prove Steam IPC or overlay behavior. It produced no-client/DXGI-unavailable evidence while the same package worked through an interactive Session 1 task. Never classify a bridge regression from a Session 0 live run. | Steam and the app can demonstrably run through a new same-interactive-session mechanism, or Windows/Steam changes its session model. | [Latest Windows evidence](cross-platform-overlay-status.md#latest-windows-evidence) |
| `WIN-HEALTH-001` | `SETTLED` | Fresh Steam CEF/GPU restarts, swap-chain failures, resource exhaustion, or orphan overlay helpers are Steam-client health blockers. More route loops add no evidence while readiness is unhealthy. | Readiness becomes healthy after bounded cleanup or one evidence-backed restart. Stale historical signals alone are not a reason to restart. | [Windows position](native-overlay-presenter-plan.md#windows-position) |
| `WIN-RENDER-001` | `SETTLED` | Plain rendering with in-process GPU unset is the default. Explicit in-process GPU blanked the tested Electron package. DirectComposition-off rendered in comparisons but remains diagnostic because of crash/ghost-window risk. | Electron/Chromium, GPU driver, Steam client, or composition code materially changes, or the default render-health gate regresses. | [Latest Windows evidence](cross-platform-overlay-status.md#latest-windows-evidence) |
| `WIN-APPCONTROL-001` | `ENVIRONMENT BLOCKER` | Local Authenticode `Valid` is insufficient while verified/reputable App Control policy is enforced; executable, addon, and native dependency loads were blocked. Disabling enforcement on the disposable rig allowed current-package D3D11 proof. | Policy state, signing identity/reputation, or the exact package changes. Always use preflight/native-load evidence; do not retry Steam routes through a known block. | [Windows position](native-overlay-presenter-plan.md#windows-position) |
| `WIN-D3D11-001` | `SETTLED` | D3D11 is the Windows managed default. The signed package passed the 15-case public managed suite, public shortcut routes, four synthetic checkout routes, passive notifications, close/back-to-app, zero-FPS parking, and crash gates. | D3D11 host/render/input code, managed lifecycle/isolation, close probing, Electron/Steam/GPU baseline, or release prebuild changes. Do not rerun the full public matrix merely before another private checkout attempt. | [Latest Windows evidence](cross-platform-overlay-status.md#latest-windows-evidence) |
| `WIN-WGL-001` | `DIAGNOSTIC ONLY` | The older WGL and direct-Chromium paths produced blank/black surfaces or unreliable close behavior. They are comparisons, not product paths. | D3D11 regresses or a deliberate alternative-backend change materially alters WGL/direct hooking. | [Windows position](native-overlay-presenter-plan.md#windows-position) |
| `WIN-ONEPROCESS-001` | `DIAGNOSTIC ONLY` | The experimental Windows one-process control server raced overlay readiness and caused Steam/webhelper churn. Process-per-case remains the accepted proof shape. | A readiness-gated redesign exists with explicit lifecycle and cleanup tests. | [Latest Windows evidence](cross-platform-overlay-status.md#latest-windows-evidence) |
| `WIN-CHECKOUT-WEB-001` | `SETTLED` | A private configured-product web-session InitTxn returned a Steam URL, opened through the managed D3D11 overlay, closed cleanly, returned focus, and kept crash diagnostics clean. This does not claim a client-session authorization callback. | Checkout target resolution, managed lifecycle, Steam Web API contract, or configured-app launch lane changes. Otherwise retain this as the recommended Windows Electron path. | [Latest Windows evidence](cross-platform-overlay-status.md#latest-windows-evidence) |
| `WIN-CHECKOUT-CLIENT-001` | `OPEN` | Explicit client InitTxn returned a sanitized client-session target, but no prompt or authorization callback appeared. The result is inconclusive because the smoke app currently calls InitTxn before `openCheckoutAndWait(...)` installs its activation hold and shown observer. Do not attribute this result to Steam product/account/client behavior yet. | First fix the operation ordering and add a regression test proving the presenter/observer exist when InitTxn runs. Then run exactly one focused private client-session proof with callback, close, crash, and allowlist-normalized QueryTxn gates. | [Live evidence](cross-platform-overlay-status.md#latest-windows-evidence), [smoke ordering](../../examples/electron-basic/main.js#L1998-L2028), [managed helper](../../packages/steam-bridge/src/index.ts#L9696-L9746), [unit proof](../../tests/steam-bridge.test.cjs#L12218-L12240) |
| `WIN-CLIENTQUERY-001` | `OPEN` | Commit `620e471` added bounded, read-only `clientQuery*` diagnostics. No post-change live QueryTxn result is documented, the Windows summary does not yet require the query after a missing prompt, and upstream result/status/error scalars are not yet allowlist-normalized. | Run only as part of the correctly ordered client-session test and only after a missing prompt. Keep the artifact private until the scalars are normalized and inspected. Never finalize/capture as diagnosis. | [Current work](current-work.md#diagnosticproof-gaps) |
| `WIN-CHECKOUT-DEFAULT-001` | `SETTLED` | Omitting `usersession` returned a sanitized failure before any transaction/target for the tested configured product/account. Explicit web versus explicit client is the useful comparison. | Request schema, product/account configuration, or Steam's documented default-session behavior changes. | [Latest Windows evidence](cross-platform-overlay-status.md#latest-windows-evidence) |

## Steam Deck and Linux x64

| ID | Status | Finding | Repeat only when | Evidence |
| --- | --- | --- | --- | --- |
| `DECK-MANAGED-001` | `SETTLED` | Deck Desktop's X11/GLX managed presenter passed broad web/store/Friends/dialog/profile/community/stats/achievements/user routes, shortcuts, passive toasts, synthetic checkout routing, close/back-to-app, and zero-FPS parking. | Linux presenter/isolation/input code, SteamOS/Steam client, Electron, or route mapping changes. Prefer a focused suite for a localized change. | [Overlay proof matrix](cross-platform-overlay-status.md#overlay-proof-matrix) |
| `DECK-RAW-001` | `DIAGNOSTIC ONLY` | Raw Steam social/dialog/hotkey behavior remains unreliable; disabling child isolation creates duplicate hook targets. The generic overlay URI produced a black presenter and crash evidence. Managed shortcuts and web-backed routes are the product path. | A specific raw-route implementation changes or Valve changes Deck overlay behavior. Do not retry unchanged focus/raise/opaque-host variants. | [Steam Deck shortcut gate](cross-platform-overlay-status.md#steam-deck-shortcut-gate) |
| `DECK-LAUNCH-001` | `SETTLED` | Steam must launch the full non-Steam shortcut game ID, not `480` or the internal 32-bit shortcut ID. App ID `480` proves generic plumbing only; real purchases require the actual installed app. | Shortcut serialization/runner logic changes or SteamOS changes shortcut IDs. | [Steam Deck shortcut gate](cross-platform-overlay-status.md#steam-deck-shortcut-gate) |

## macOS Apple Silicon

| ID | Status | Finding | Repeat only when | Evidence |
| --- | --- | --- | --- | --- |
| `MAC-BUILD-001` | `SETTLED` | Supported macOS output is arm64-only. The in-bundle launcher, renamed Electron executable, Steam overlay entitlements, and app/game/overlay ID setup are required. Intel, Rosetta, and universal builds are intentionally unsupported. | Packaging, signing, launcher, Electron-builder integration, or platform-support policy changes. | [macOS Apple Silicon plan](native-overlay-presenter-plan.md#macos-apple-silicon-plan) |
| `MAC-POLL-001` | `SETTLED` | `BOverlayNeedsPresent()` crashed Steam's injected renderer on both OpenGL and Metal. macOS wrappers keep polling disabled and expose no opt-in. | Valve supplies a confirmed fix and an isolated crash-safe experiment is explicitly justified. Do not casually re-enable this poll. | [macOS Apple Silicon plan](native-overlay-presenter-plan.md#macos-apple-silicon-plan) |
| `MAC-MANAGED-001` | `SETTLED` | Apple Silicon Metal passed broad process-per-case and persistent managed matrices covering routes, shortcuts, toasts, synthetic checkout, close/back-to-app, one overlay target, zero managed timing, zero-FPS parking, isolation, and crash diagnostics. | Metal host/lifecycle/signing/launcher code, Electron/Steam client, or supported route mapping changes. Use minimal/core suites before another full run. | [Latest macOS evidence](cross-platform-overlay-status.md#latest-macos-evidence) |
| `MAC-HOST-001` | `SETTLED` | Locked or display-asleep Macs must fail fast with native-host-unavailable state; they are not valid success-run environments. Steam health uses current connection and IPC evidence rather than isolated stale warnings. | Host-state detection or Steam health classification changes. Restart Steam only for current wedged IPC/multiple-target evidence. | [Latest macOS recovery evidence](cross-platform-overlay-status.md#latest-macos-recovery-evidence) |

## Cross-platform Invariants

| ID | Status | Finding | Repeat only when | Evidence |
| --- | --- | --- | --- | --- |
| `CROSS-PURCHASE-001` | `SETTLED` | App ID `480` proves generic overlay plumbing and synthetic routing only. It cannot prove real purchase content or authorization. | Never. Real proof always uses private runtime inputs with only sanitized committed evidence. | [Purchase overlay checklist](cross-platform-overlay-status.md#purchase-overlay-checklist) |
