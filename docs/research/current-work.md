# Current Work Checkpoint

Last reviewed: 2026-07-17

Review anchor: `6577856` (`Stabilize Windows Electron overlay presenter`).

## Active Goal

Release-gate `steam-bridge@0.2.0`, whose code-bearing change adds the verified
Windows top-level D3D11 game host, Electron shared-texture ingestion, native
input delivery, and production window-state behavior. Published
`steam-bridge@0.1.6` remains the unchanged predecessor. No commit, tag, GitHub
Release, or npm publication for `0.2.0` has occurred.

## Current State

The Windows native host is a normal top-level Win32 window with a two-buffer
flip-discard D3D11 swap chain. It preserves source aspect ratio, keeps Steam
inside the native client area, respects Windows 11 restored-window corners,
and implements title drag, edge resize, maximize/restore, minimize/restore,
monitor fullscreen, focus parking, DPI changes, modal move/size repaint, and
cursor suppression. A bounded native queue carries mouse, capture, wheel,
keyboard, text, focus, blur, close, and window-change events to the JavaScript
session owner.

Electron offscreen frame textures now use the documented process-local NT
handle path. The bridge reads the shared-resource adapter LUID, creates the
host on Windows' high-performance DXGI adapter with a compatibility fallback,
opens every pooled texture with `ID3D11Device1::OpenSharedResource1`, and copies
it into a bridge-owned shader-resource texture before returning control to
Electron. The caller can therefore release Electron's pooled texture
immediately. The previous BGRA `updateFrame()` path remains as a bounded CPU
fallback; GDI presentation is absent.

The source-linked consumer uses an exact Electron `43.1.1` offscreen shared
texture and the optimized local addon. Live gameplay rendered at the active
display rate without purple startup pixels, idle flicker, top-left shrink, or
aspect distortion. The same run passed title drag, maximize/restore,
minimize/restore, focus loss/return, Alt+Tab, F11 enter/exit, rounded restored
corners, native chrome controls, mapped mouse input, and checkout overlay
activation. The Steam checkout panel rendered inside the game client rather
than over native chrome and its panel close control worked without authorizing
a purchase. Diagnostics retained the discrete GPU adapter, D3D feature level
11.1, exact source dimensions, successful presents, increasing shared-texture
imports, and zero upload failures.

Automation could not make Steam accept a synthetic global Shift+Tab chord, so
that run does not claim physical hotkey deactivation. More importantly, this
consumer run is development evidence, not the repository's publication proof.
Because `0.2.0` changes native code, the exact protected packaged candidate
still requires fresh public `persistent-reuse`, `checkout`, `shortcut-routes`,
and `managed-routes` roots and a valid 31-case / 27-activation sanitized receipt
before npm publication.

The attached owned-popup and true `WS_CHILD` experiments remain diagnostic.
The popup can track Electron geometry but Steam's input capture conflicts with
Electron chrome while active; the child receives activation but no Steam
pixels. Do not promote either path as the standalone Windows game-host design.

The checkout contains unrelated local `AGENTS.md`, `.codex`, and input-probe
changes that belong to the user and must remain untouched.

## Last Verification

- `npm run native:build` produced the exact optimized
  `x86_64-pc-windows-msvc` addon and linked it into the package. The
  source-linked consumer resolves the same bytes.
- `npm test` passes all 203 tests, TypeScript, Electron-version, shortcut, and
  Windows package-gate self-tests.
- `npm run example:package:win` produces the Electron `43.1.1` unpacked app,
  verifies all 1,127 required native methods and their declaration hash, passes
  the packaged matrix self-test, and loads the exact addon through the packaged
  Electron executable. The run also fixed argument-safe npm invocation on
  Windows and copied the matrix summarizer's fingerprint dependency.
- `npm run native:fmt`, bridge typecheck, consumer typecheck, consumer lint,
  consumer 4/4 tests, consumer main-process syntax, and `git diff --check`
  pass.
- The final manual consumer matrix passed gameplay, mapped input, window-state
  transitions, focus transitions, shared-texture presentation, and in-client
  checkout activation/close without purchase authorization.
- The exhaustive Steam API coverage audit passes against all 1,127 required
  native methods, SDK exports, callback aliases, facade helpers, shim
  references, and generated enum constants. Clean GitHub CI must repeat it
  before a tag candidate is created.
- No private app, product, account, transaction, Steam, key, price, checkout
  URL, or fixture identifier is recorded in committed documentation.

## Next Actions

1. Re-run the complete local package and privacy review after the `0.2.0` README
   and Electron `43.1.1` lock update.
2. Commit and push only if those checks remain green, then create the exact
   protected `v0.2.0` candidate through the tag-triggered Release workflow.
3. Run the required candidate-bound Windows public proof profiles without
   private checkout inputs or evidence overrides, generate the sanitized
   receipt, and configure the publish proof.
4. Dispatch the manual npm publication workflow only after the exact candidate
   and receipt validate. Preserve `0.1.6` as the last known-good package if any
   gate fails.

## Exact Next Step

Run the final package inventory, secret/privacy scan, optimized native checks,
and exact Electron `43.1.1` package gate. Do not tag or publish if the protected
Windows live-proof workflow cannot be completed for the same candidate.

Detailed settled platform evidence is in
`docs/research/cross-platform-overlay-status.md`; rerun contracts are in
`docs/research/test-findings-ledger.md`; architecture is in
`docs/research/electron-steam-overlay-architecture.md`.
