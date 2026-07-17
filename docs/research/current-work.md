# Current Work Checkpoint

Last reviewed: 2026-07-17

Review anchor: `9837ff5` (`Release Windows overlay host fixes as v0.2.2`).

## Active Goal

Release-gate `steam-bridge@0.2.3`, whose code-bearing predecessor adds the verified
Windows top-level D3D11 game host, Electron shared-texture ingestion, native
input delivery, production window-state behavior, an interactive owned-popup
focus fix, and display-rate presentation control. The new candidate also makes
the Windows managed-route proof fail closed on the actual inset Steam modal,
sequences repeatable achievement mutations through Steam's stored callbacks,
and gives delayed passive notifications a bounded 20-second evidence window.
Published `steam-bridge@0.1.6` remains the unchanged predecessor. Exact
`v0.2.0`, `v0.2.1`, and `v0.2.2` are preserved as rejected evidence; none
produced a published npm package suitable for use.

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
corners, native chrome controls, mapped mouse input, one-time purchase overlay,
and recurring-subscription overlay. Both Steam panels rendered inside the game
client rather than over native chrome; close/cancel returned to gameplay without
authorizing a purchase or subscription. Diagnostics retained the selected
high-performance adapter, D3D feature level 11.1, exact source dimensions,
successful presents, increasing shared-texture imports, and zero upload
failures.

Native sessions now accept `frameRate`, expose `setFrameRate(...)`, and report
their frame rate and pump interval. The timer wakes just ahead of the selected
display cadence while Windows `Present(1)` synchronizes to vertical blank. The
native continuous-present debounce is 1 ms instead of a product-level 32 ms
cap. Opt-in `continuousPresent` has one timer-owned present path, so Electron
texture updates cannot double-pump the swap chain; the default remains false.

Automation could not make Steam accept a synthetic global Shift+Tab chord, so
that run does not claim physical hotkey deactivation. More importantly, this
consumer run is development evidence, not the repository's publication proof.
Because `0.2.3` carries the new native host and changes its release evidence,
the exact protected packaged candidate still requires fresh public
`persistent-reuse`, `checkout`, `shortcut-routes`,
and `managed-routes` roots and a valid 31-case / 27-activation sanitized receipt
before npm publication.

The rejected `v0.2.0` tag exposed two standard Windows imports that the
fail-closed artifact verifier had not yet classified: `comctl32.dll` for native
window subclassing and `d3dcompiler_47.dll` for the D3D presentation shaders.
The replacement verifier explicitly accepts both system components, retains
the static CRT and arbitrary third-party DLL rejection rules, and passes both
its synthetic regression test and the exact locally packaged native binary.
Exact `v0.2.1` passed CI and Release assembly, but formal proof rejected its
interactive attached presenter because `WS_EX_NOACTIVATE` remained set. The
replacement keeps `WS_EX_NOACTIVATE | WS_EX_TRANSPARENT` only while parked,
removes both while Steam is interactive, and activates only while the visible
parent permits the surface. Exact `v0.2.2` then passed CI and Release assembly,
but its candidate-bound managed-route proof exposed an asynchronous achievement
clear/store race and close-glyph evidence that could fall back to an unproved
target. Development follow-up also caught a false outer-host glyph match and a
progress toast arriving at the old 10-second boundary after a long route
sequence. The replacement waits for a fresh `UserStatsStored` callback before
progress or unlock mutation, requires every web close to use a directly detected
glyph inside an inset modal panel, independently audits that panel geometry,
and allows 20 seconds for passive toast presentation. None of the three failed
tags may be moved, reused, or published; `v0.2.3` is the fresh candidate.

The true `WS_CHILD` experiment remains diagnostic because Steam activates but
does not render into its child swap chain. The repaired attached owned popup is
supported only as the managed, content-bounded overlay presenter; it is not the
standalone Windows game-host design.

The checkout contains unrelated local `AGENTS.md`, `.codex`, and input-probe
changes that belong to the user and must remain untouched.

## Last Verification

- `npm run native:build` produced the exact optimized
  `x86_64-pc-windows-msvc` addon and linked it into the package. The
  source-linked consumer resolves the same bytes.
- `npm test` passes all 204 tests after the callback, modal-geometry, and
  passive-notification timing review, plus TypeScript, Electron-version,
  shortcut, and all Windows package-gate self-tests.
- `npm run example:package:win` builds the `0.2.3` Electron `43.1.1` unpacked
  app, verifies all 1,127 required native methods and their declaration hash,
  passes the packaged matrix self-test, and loads the exact addon through the
  packaged executable. The package path retains argument-safe npm invocation
  on Windows and the matrix summarizer's fingerprint dependency.
- `npm run native:fmt`, bridge typecheck, consumer typecheck, consumer lint,
  consumer 4/4 tests, consumer main-process syntax, and `git diff --check`
  pass.
- `npm run check:platform`, `npm run native:check`, and `npm run api:check`
  pass. The API audit retains 1,127 required native methods.
- `npm run package:smoke` reaches its documented Windows host blocker when the
  Unix fixture tries to launch `bash`; `WIN-PACKAGE-SMOKE-HOST-001` remains the
  applicable rerun decision. No WSL or host reconfiguration was introduced.
- The latest manual consumer matrix passed gameplay, mapped input, window-state
  and focus transitions, shared-texture presentation at the current display
  rate, one-time checkout activation/close, and recurring-subscription
  activation/cancel without authorization.
- A full source-linked persistent run passed native/render gates, its foreground
  grant, all three exact close/park cycles, input and lifecycle audits, strict
  verification, cleanup, and unchanged Steam identity. It is development
  evidence and does not replace candidate-bound proof.
- The rebuilt development package passed focused achievement-progress and
  achievement-unlock reruns, plus an uninterrupted 16/16 managed-routes run.
  All 13 active routes had
  clean close/park lifecycles; every web route directly targeted a glyph inside
  the scale-aware inset modal panel; progress and unlock both recorded their
  stored callbacks, false-to-true needs-present transitions, passive parking,
  zero crashes, complete cleanup, and unchanged Steam continuity.
- The exhaustive Steam API coverage audit passes against all 1,127 required
  native methods, SDK exports, callback aliases, facade helpers, shim
  references, and generated enum constants. Clean GitHub CI must repeat it
  before a tag candidate is created.
- GitHub CI run `29575410461` passed the Windows, Linux, macOS, package-smoke,
  and API gates for commit `2a24089`. Tag Release run `29575564317` built all
  three platform prebuilds but correctly rejected `v0.2.0` before artifact
  assembly because the Windows system-DLL allowlist lacked the new native host
  imports. Nothing was published.
- Commit `9837ff5` passed main CI `29583417694`, tag CI `29583616413`, and tag
  Release assembly `29583614808` for `v0.2.2`. The downloaded exact candidate
  was protected and audited, but the managed-route proof rejected it before
  receipt generation or npm publication. The tag remains immutable evidence.
- The corrected Windows verifier self-test passes and accepts the complete
  import table of the exact local 8,130,560-byte addon while continuing to
  reject dynamic MSVC/UCRT and arbitrary non-system dependencies.
- No private app, product, account, transaction, Steam, key, price, checkout
  URL, or fixture identifier is recorded in committed documentation.

## Next Actions

1. Commit and push the reviewed `0.2.3` replacement, wait for exact CI, then
   create the fresh `v0.2.3` candidate through the tag-triggered Release
   workflow. Preserve and never move rejected `v0.2.0`, `v0.2.1`, or `v0.2.2`.
2. Run the required candidate-bound Windows public proof profiles without
   private checkout inputs or evidence overrides, generate the sanitized
   receipt, and configure the publish proof.
3. Dispatch the manual npm publication workflow only after the exact candidate
   and receipt validate. Preserve `0.1.6` as the last known-good package if any
   gate fails.

## Exact Next Step

Commit and push the reviewed `0.2.3` replacement, then require clean exact CI
before creating the fresh tag. Do not tag or publish if the protected Windows
live-proof workflow cannot be completed for the same exact candidate.

Detailed settled platform evidence is in
`docs/research/cross-platform-overlay-status.md`; rerun contracts are in
`docs/research/test-findings-ledger.md`; architecture is in
`docs/research/electron-steam-overlay-architecture.md`.
