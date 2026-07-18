# Current Work Checkpoint

Last reviewed: 2026-07-18

Review anchor: `ea10a22` (`Fix scaled native host sizing`), published as
immutable `v0.2.11` with exact-candidate Windows live proof.

## Active Goal

Hold `steam-bridge@0.2.11` as the supported standalone Windows native-host
release and preserve its exact candidate, four proof roots, receipt, public
Release assets, publication run, and downstream registry-backed evidence. The
consumer now resolves the exact npm package from a normal non-junction install.
Repeat the release path only after a material native/runtime change or a focused
regression; published bytes and tags remain immutable.

## Current State

`steam-bridge@0.2.11` is npm `latest`. The preceding registry-backed checkout
pass exposed one unhandled Steam window shape: closing a recurring
checkout approval surface creates a separate visible, enabled, foreground
top-level window titled `Steam Dialog`, class `SDL_app`, from
`steamwebhelper.exe`. It has no owner while the bridge's standalone D3D11 host
remains dimmed, so the confirmation appears outside the game host instead of
behaving as its modal. Cancelling the transaction from that dialog closes it,
returns to the game, and authorizes nothing.

The published repair forwards overlay-active state into the native surface.
On Windows standalone hosts only, it snapshots matching dialogs when the
overlay activates, then at a bounded cadence adopts only a newly appearing,
visible, unowned exact-title/exact-class window whose process image basename is
`steamwebhelper.exe`. The bridge assigns the game host as owner, centers the
dialog over the host client area, follows host move/resize, and restores the
original owner and rectangle on deactivation or host teardown. Existing Steam
dialogs and attached managed presenters are excluded. Diagnostics retain the
baseline, adoption count, current owner, and rectangles. In the optimized
source-linked run, the live dialog's owner exactly equalled the native host, its
rectangle was centered over the host, Cancel Transaction removed it cleanly,
and gameplay resumed with the subscription not authorized.

The published sizing repair treats standalone `clientWidth` and
`clientHeight` as logical pixels, scales them with the system DPI before
`AdjustWindowRectExForDpi`, and centers/clamps the resulting outer rectangle in
the primary usable work area. On the 225%-scaled development display, the
source-linked game now opens with an exact 1280 by 720 logical client instead
of a tiny top-left surface. Live restore, maximize/restore, minimize/focus
return, title drag, mapped input, the custom cursor, and ordinary Steam overlay
rendering preserve the corrected geometry. The consumer's real checkout URL is
now routed with Steam's supported modal web-page option; the live one-time Buy
route rendered as a large centered checkout surface, closed without
authorization, and left the ordinary Shift+Tab overlay working independently.

The underlying Windows product path remains the top-level Win32 D3D11 game
host introduced by the `0.2.x` series. It uses Electron offscreen shared
textures, a bridge-owned copy before Electron releases its pool texture,
flip-discard presentation, source-aspect preservation, per-monitor DPI,
display-rate presentation, Windows 11 restored corners, title drag, edge
resize, minimize/maximize/restore, monitor fullscreen, focus parking, and the
managed Electron-owned Steam presenter surface. The diagnostic `WS_CHILD`
experiment is not the product path because Steam activates but does not render
reliably into that child swap chain.

Exact `v0.2.0` through `v0.2.7` remain immutable rejected evidence from the
progressively hardened import, activation-style, lifecycle, modal-target, DPI,
panel-refinement, and receipt-contract gates. `v0.2.8` corrected the final
owned-popup and passive-notification receipt assumptions and was published.
`v0.2.9` is the cursor-suppression predecessor. `v0.2.10` adds exact Steam
checkout-dialog adoption. `v0.2.11` corrects logical standalone client sizing
at high DPI and carries a fresh full live proof and downstream registry-backed
pass.

## Consumer Evidence

The Electron game consumer was linked to `packages/steam-bridge` while the
sizing repair was developed, then returned to an exact non-junction registry
install of `steam-bridge@0.2.11`. At 225% Windows scaling, the requested 1280 by
720 logical client measures 1282 by 750 including native chrome. The
source-linked pass exercised title drag, resize, minimize, maximize/restore,
focus return, aspect preservation, cursor behavior, ordinary overlay, and the
real one-time Buy route. The consumer opens checkout URLs through
`activateToWebPage(url, { modal: true })`; the Buy page rendered as a large
centered Steam surface and was cancelled without authorization.

After npm publication, the consumer lockfile resolved the exact registry
tarball and integrity and `node_modules/steam-bridge` was verified as a normal
directory at `0.2.11`. The final registry-backed process repeated the exact
1280 by 720 client geometry, title drag, maximize/restore, minimize/focus
return, and ordinary Shift+Tab overlay open/close without a tiny presenter,
flicker, hang, or crash. The app remained open in its restored windowed state
for downstream testing.

## Exact Release Evidence

Source and automation:

- commit `ea10a228e9af844975f7b4a941ae9bade46965ea`;
- tag CI `29661177610` and Release assembly `29661177626` passed, including
  macOS arm64, Linux x64, Windows x64 prebuilds, package assembly, and packaged
  Electron validation;
- trusted npm publication `29662440079` passed after restoring the exact
  candidate-bound receipt in the `npm-production` environment;
- public GitHub Release: <https://github.com/jstroh/steam-bridge/releases/tag/v0.2.11>.

Candidate identity:

- npm tarball SHA-256
  `90f09b3832b33ecf14cf02e13ab759b5324b54b248c9437647db4c8b722cff27`;
- Windows archive SHA-256
  `c7e97276d228f65b49dd8ed59b57fd8a37db797e82e1376c930a1ea435104b28`;
- Windows bundle content: 114 files, 398,246,875 bytes, SHA-256
  `9ed387da81ffda664db8103d688106cf46c3bea48963f5f2f19e211080d3cc64`;
- native binding: 1,128 methods, declaration SHA-256
  `cc7a8dd5951d2c42f9a76f54f9c82f3a92ea61319d6e20e6539c10a7d39ce949`;
- candidate binding SHA-256
  `b3137d38f3ed3637c1ca039e1bd878dd0b176a10244d5b03214d4bea48808cc3`;
- live-proof receipt semantic SHA-256
  `9c4ad150eca18fcef16318bfe1743f9fa7b7445061aed5b2c37c851f8386869e`.

The exact protected candidate passed the four required profiles in order:

- `persistent-reuse`: 1 case, 3 active open/close/park cycles;
- `checkout`: 4/4 cases, 3 active routes;
- `shortcut-routes`: 10/10 active routes;
- `managed-routes`: 16/16 cases, 13 active routes.

That is 31/31 clean cases and 27 active Steam routes with D3D11
presenter/host/renderer agreement where applicable, authenticated foreground
handoff, high-DPI target containment, visible modal-frame checks, clean
close/park/focus return, canonical candidate protection after every profile,
one continuous Steam identity, and zero crashes.

All four profiles ran in the required order against one unchanged protected
candidate and one Steam identity. The npm registry tarball is byte-identical to
the audited Release tarball. npm reports the package's SLSA provenance, and the
consumer-wide `npm audit signatures` verifies 705 registry signatures and 132
attestations. All five GitHub Release asset digests match their retained local
files. The release-scoped GitHub proof secret was deleted after publication.

## Verification

The published source tree passes 206/206 repository tests, Rust format
and compile checks, the API and platform audits, and the focused standalone
sizing unit tests. The consumer passes 4/4 tests, TypeScript, ESLint, and the
optimized renderer build. The source-linked process produced the large centered
one-time checkout open/cancel without authorization. The final registry-backed
process retained the measured 1282 by 750 outer window for a 1280 by 720 client
and repeated window-state and ordinary-overlay interaction.

Bridge gates for the exact source passed:

- `npm test`: 206/206;
- platform policy, Rust formatting and compilation, API coverage, package
  smoke/dry-run, diff checks, Windows package assembly, and packaged Electron
  native-load validation;
- exact Windows protected deployment, candidate fingerprint/ACL re-audit, four
  live profiles, receipt generation, trusted publication, registry integrity,
  signature, provenance, and Release-asset digest verification.

Consumer gates on registry `0.2.11` passed:

- 4/4 tests, TypeScript, ESLint, optimized Next renderer build;
- exact non-junction install, lockfile integrity, registry tarball byte identity,
  package signatures, and provenance;
- live 1280 by 720 geometry, title drag, minimize/focus return,
  maximize/restore, aspect-fit rendering, and ordinary overlay open/close.

## Operational Notes

- App ID `480` proves public Steam overlay plumbing and synthetic routing only;
  it does not prove a real commercial authorization.
- Opening and cancelling checkout/subscription panels is allowed proof; never
  finalize a purchase or subscription during smoke testing.
- Do not move or reuse a release tag. A code or native-runtime change requires a
  new version, new exact artifacts, and fresh candidate-bound live proof.
- Preserve failed release roots as diagnostic evidence; receipts may contain
  only complete clean roots from one unchanged candidate and Steam identity.
- The checkout contains unrelated user-owned `AGENTS.md`, `.codex`, and input
  probe files. They must remain unstaged and untouched.
