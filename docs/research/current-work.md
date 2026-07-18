# Current Work Checkpoint

Last reviewed: 2026-07-18

Review anchor: `6eb634f` (`Handle Steam checkout dialogs in native host`),
published as immutable `v0.2.10` with exact-candidate Windows live proof.

## Active Goal

Maintain `steam-bridge@0.2.10` as the supported Windows native-host release and
preserve the exact candidate, proof roots, publication receipt, and downstream
registry-backed evidence. Any native/runtime change requires a new immutable
version and fresh exact-candidate proof.

## Current State

`steam-bridge@0.2.10` is npm `latest`. The preceding registry-backed checkout
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
checkout-dialog adoption and carries a fresh full live proof and downstream
registry-backed pass.

## Consumer Evidence

The Electron game consumer was first linked to the local
`packages/steam-bridge` checkout for iteration, then returned to an exact
non-junction registry install of `steam-bridge@0.2.10`. Both the optimized local
addon and the published registry package were exercised in live gameplay at
1024 by 768. Manual coverage included:

- title drag, edge resize, minimize, maximize/restore, fullscreen enter/exit,
  Alt+Tab, focus loss/return, restored rounded corners, and aspect preservation;
- current-display-rate presentation with no purple startup frame, periodic
  flicker, top-left shrink, or native-host crash;
- mapped mouse and keyboard input plus the game's custom cursor with the native
  Windows cursor hidden across the frame and letterbox;
- Shift+Tab overlay activation and return through Steam's Back to Game control;
- one-time buy and recurring-subscription routes rendered inside the game
  client; the recurring confirmation became a correctly centered host-owned
  dialog and both flows were cancelled with no purchase or subscription
  authorized;
- a post-checkout ordinary-overlay open/close and maximize/restore stress loop,
  followed by clean Electron shutdown with exit code zero.

The previous registry-backed cancellation run exposed the separate Steam
confirmation HWND. The published package now passes the focused cancellation
and broader window/overlay matrix. The consumer lockfile resolves the exact npm
tarball and integrity, `node_modules/steam-bridge` is a normal directory, the
packed Windows native runtime bytes equal the registry install, and the final
manual pass returned from both checkout routes without authorizing a purchase or
subscription.

## Exact Release Evidence

Source and automation:

- commit `6eb634fbcd50989c9f9a949a81e4b89b862776b6`;
- Release assembly `29638085998` passed, including macOS arm64, Linux x64,
  Windows x64 prebuilds, package assembly, and packaged Electron validation;
- trusted npm publication `29639342257` passed after restoring the exact
  candidate-bound receipt in the `npm-production` environment;
- public GitHub Release: <https://github.com/jstroh/steam-bridge/releases/tag/v0.2.10>.

Candidate identity:

- npm tarball SHA-256
  `5b49ea51b520702782ef231f0091969bc0d11e5fe193c5397164a2ea0ac0ffb2`;
- Windows archive SHA-256
  `f32c452c2defa2a22a41f9c1ed9e715180a7da0ce93cec7e5c5cf5aa10079997`;
- Windows bundle content: 114 files, 398,249,435 bytes, SHA-256
  `d83034ebdb474d7d341807e8801b8c3eba838e1c010efb7934cc2e572d95c717`;
- native binding: 1,128 methods, declaration SHA-256
  `cc7a8dd5951d2c42f9a76f54f9c82f3a92ea61319d6e20e6539c10a7d39ce949`;
- candidate binding SHA-256
  `842b1d3b768f86db7a112bc89ff5c1de400ea9e7f5dc8b3a1bcf945aa9492e45`;
- live-proof receipt semantic SHA-256
  `9cb576f6e1caa2a0d894e4cec7eaa778bde2991f9af73fabdb90a11fe2ab821d`.

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

The first pre-receipt launch root is preserved separately because the required
foreground-grant broker was not yet running, so the matrix correctly failed
before live evidence was admitted. After the broker started, all four complete
profiles passed against the unchanged protected candidate and one Steam identity.
The failed root is not used by the receipt.

The npm registry tarball is byte-identical to the audited Release tarball. `npm
audit signatures` verifies one registry signature and one SLSA provenance
attestation. All five GitHub Release asset digests match their retained local
files.

## Verification

Bridge gates for the exact source passed:

- `npm test`: 206/206;
- platform policy, Rust formatting and compilation, API coverage, package
  smoke/dry-run, diff checks, Windows package assembly, and packaged Electron
  native-load validation;
- exact Windows protected deployment, candidate fingerprint/ACL re-audit, four
  live profiles, receipt generation, trusted publication, registry integrity,
  signature, provenance, and Release-asset digest verification.

Consumer gates on registry `0.2.10` passed:

- 4/4 tests, TypeScript, ESLint, optimized Next renderer build;
- unpacked Windows electron-builder packaging with the registry package and
  exact native runtime files included;
- live title drag, keyboard resize, minimize/restore, maximize/restore,
  fullscreen, Alt+Tab/focus return, rounded restored corners, aspect-fit
  rendering, cursor suppression, ordinary overlay, one-time checkout cancel,
  recurring checkout dialog cancel, post-checkout lifecycle stress, and clean
  Electron exit code zero.

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
