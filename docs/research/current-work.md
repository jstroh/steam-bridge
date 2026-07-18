# Current Work Checkpoint

Last reviewed: 2026-07-18

Review anchor: `627e87e` (`Fix native host cursor suppression`), published as
`steam-bridge@0.2.9` and immutable tag `v0.2.9`.

## Active Goal

The Windows native game-host and managed Steam overlay work is released. The
active downstream task is finishing the FOV4 Electron consumer port on exact
registry `steam-bridge@0.2.9`, reviewing its complete diff, and committing and
pushing the consumer only after the registry-backed manual run remains clean.

No bridge implementation change is currently waiting for release. Future
bridge fixes should follow the same workflow: link the consumer to the local
package, reproduce and fix locally, run automated and manual consumer coverage,
then create a fresh immutable package candidate and repeat the candidate-bound
release proof before publication.

## Current State

`steam-bridge@0.2.9` is the current npm `latest`. It adds a Windows
`WM_SETCURSOR` path that reapplies transparent native-cursor suppression while
`setCursorHidden(true)` is active over the rendered frame or letterbox. The
native cursor is restored on focus loss, hidden state, and close. This fixes the
consumer's duplicate OS cursor without altering Steam overlay input ownership.

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
`v0.2.9` is the cursor-suppression successor and carries fresh full live proof.

## Consumer Evidence

The FOV4 Electron app was linked to the local `packages/steam-bridge` checkout
while the cursor fix was developed. The optimized native addon was exercised in
live gameplay at 1024 by 768. Manual coverage included:

- title drag, edge resize, minimize, maximize/restore, fullscreen enter/exit,
  Alt+Tab, focus loss/return, restored rounded corners, and aspect preservation;
- current-display-rate presentation with no purple startup frame, periodic
  flicker, top-left shrink, or native-host crash;
- mapped mouse and keyboard input plus the game's custom cursor with the native
  Windows cursor hidden across the frame and letterbox;
- Shift+Tab overlay activation and return through Steam's Back to Game control;
- one-time buy and recurring-subscription routes rendered inside the game
  client, with subscription cancellation confirmed and no purchase or
  subscription authorized.

After publication the consumer dependency and lockfile resolve exact registry
`steam-bridge@0.2.9`, not a symlink. Its registry integrity is
`sha512-U/TtIAFLKRXw4OjcH7H2OY8mjgx8PI0uk7YU1uVh0RSV9I1blLiwTf5b6xCGZ/b4771UL4E41du1pDRatKhn9Q==`.

## Exact Release Evidence

Source and automation:

- commit `627e87e4431b3a1d4fbbfe2abe2e99cdfecfaec4`;
- main CI `29634611326`, tag CI `29634614682`, and Release assembly
  `29634614621` passed;
- trusted npm publication `29636032726` passed after restoring the exact
  candidate-bound receipt in the `npm-production` environment;
- public GitHub Release: <https://github.com/jstroh/steam-bridge/releases/tag/v0.2.9>.

Candidate identity:

- npm tarball SHA-256
  `df35811beda67c8cff68b8a459090cd6743ce71c86dcd2fadce0831b964c3590`;
- Windows archive SHA-256
  `8429c39cb13813b84b3dc827a56227cf44e04c8197a0b3655c2d72be54b66575`;
- Windows bundle content: 114 files, 398,231,903 bytes, SHA-256
  `2b8f0fb63a3059337eebd7421d9a4bf0e308950194c3e71e4f73ff3e60156f4d`;
- native binding: 1,127 methods, declaration SHA-256
  `ef216a32eedf680b378cf01a6d84efa8a6c51eab1ac40eb8e693b718eb9507d1`;
- candidate binding SHA-256
  `8595cc73d04d0bb5ccad3f5450c6af5d69558f8ba4c7e47e7540e321d6fb38ef`;
- live-proof receipt semantic SHA-256
  `bdb3859a761d952c2b2b368ffbaf2f6dcff1e9ba59c75532588205af214d25cb`.

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

The first checkout profile attempt is preserved separately because Steam did
not consume one otherwise valid injected close click in shortcut checkout and
the case timed out. Candidate identity, geometry, focus evidence, cleanup, and
Steam health remained valid. A complete fresh-process rerun passed all four
cases without changing bytes, configuration, target resolution, or timeout.
Treat a future repeat as an input-lifecycle regression only if the same miss is
reproducible under a fresh process state; never splice the failed root into a
receipt.

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

Consumer gates on registry `0.2.9` passed:

- 4/4 tests, TypeScript, ESLint, optimized Next renderer build;
- unpacked Windows electron-builder packaging with the registry package and
  native runtime files included.

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
