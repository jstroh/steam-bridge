# Current Work Checkpoint

Last reviewed: 2026-07-15

Review anchor: `ffcbeec` (`Complete Steam Deck mode readiness proof`).
Reconcile this checkpoint with newer Git history and worktree changes before
acting.

## Active Goal

The fresh Steam Deck production-readiness pass across Desktop Mode and Game Mode
is complete and published through `ffcbeec`. Preserve its separate
mode-appropriate contracts and rerun only under the ledger conditions.

Public App ID `480` remains generic overlay plumbing only. Do not claim or run
real configured-product purchase proof without the separate complete private
runtime handoff and configured-game path.

## Current State

The Windows x64 public release slice remains settled through `37705e1`; exact
CI `29389716034` passed Windows, Linux, macOS Apple Silicon, and package smoke.
Do not rerun its live profiles for this Deck goal.

The Deck implementation/evidence commit is `ffcbeec`. Exact CI `29400961875`
passes Windows x64, Linux x64, macOS Apple Silicon, and full Linux package
smoke.

The fresh current-package Deck pass now has separate mode-appropriate
completion contracts. Desktop Mode passes the full 26-case managed X11/GLX
matrix. Game Mode passes a two-case contract covering passive managed presenter
readiness plus Gamescope-native store activation, compositor capture,
Escape/back-to-app, active/inactive callbacks, focus return, crash health, and
cleanup. The Desktop managed web route is intentionally not projected onto Game
Mode: a fresh control again initialized and attached the X11/GLX host but
produced no active callback or overlay target, matching the prior Game Mode web
boundary.

The ledger keeps raw social/dialog/hotkey routes diagnostic-only because prior
focus, raise, opaque-host, and child-isolation-off variants were unreliable or
created duplicate hook targets. The managed presenter-backed routes are the
product path. Do not repeat those raw experiments unless their implementation
or SteamOS behavior materially changes.

The Deck is reachable on the local network and currently remains in Game Mode.
Its current host key is pinned and a dedicated local key now authenticates
non-interactively; no password was requested or stored. Read-only preflight confirms the Deck user,
x86_64 Neptune kernel, active local graphical login, running Steam client, Git,
and the packaged helper's expected input and capture tools. Game Mode is an
active local Wayland Gamescope session; Desktop Mode was an active KDE Plasma
X11 session. Node/npm are not installed on the Deck host, so repository
orchestration remains on Windows as designed.

The fresh Windows-hosted Linux package exposed three host-runner defects before
the current live proof: the local gate incorrectly required an executable bit
that Git Bash/NTFS cannot represent for the extensionless Linux ELF; the copy
step did not restore executable bits on Electron's crashpad and sandbox runtime
helpers; and SSH direct mode did not inject the active Deck graphical-session
environment. The runner now validates readable package files locally, restores
all required executable bits remotely, audits them in preflight, and supplies
the X11/session environment to helper runs. A separate artifact-privacy audit
also found full Steam client command lines and environment values in visual
state captures plus an SDK Steam ID on direct stderr; state capture now retains
only process identity/parentage and redacted env-key presence, while the Linux
helper redacts the SDK identifier and no longer prints the shortcut game ID.

After those fixes, a fresh direct packaged App ID `480` gate passed Steamworks
initialization, Deck/Desktop identity, overlay readiness, focused window, and
clean crash diagnostics. A focused fullscreen Steam-launched managed web case
then passed injection, visible X11/GLX presentation, one overlay target,
active/inactive callbacks, automatic in-overlay close, focus return, zero-FPS
parking with stable pumping, and clean crash evidence. The two pre-fix visual
state files containing full process command lines were deleted; retained live
screenshots remain local only because visible Steam UI can contain account data.

The first fresh full Desktop matrix passed its first six managed cases (web,
Friends, Friends wait, managed shortcut, checkout prepare, and synthetic
approval routing) before the progress-toast case exposed an evidence-contract
regression. Current Deck Steam visibly rendered the toast and completed its
callback while the passive presenter stayed parked at 0 FPS, but it did not
toggle `BOverlayNeedsPresent()`. An eight-second focused observation confirmed
that a longer wait would not produce the transition. Notification completion
now requires the accepted action callbacks plus state-driven passive parking,
records whether the transition occurred, and labels the observed path as either
`needs-present` or `steam-overlay-target`. The Deck summary requires this event,
its presenter diagnostics, and the actual transition boolean.

Fresh focused progress and unlock runs now both pass with visible public Steam
toasts, the required callbacks, one overlay target, no modal activation,
transparent/click-through 0-FPS parking through `steam-overlay-target`, and clean
crash diagnostics. Their consecutive retained launches also exposed and fixed a
same-shortcut cleanup race: a copied-over but still-running Electron executable
appears as a deleted image in `/proc`, so exact cleanup now normalizes that
suffix before retiring the smoke tree and its orphaned overlay. Steam remained
running throughout.

The corrected full Desktop matrix then passed 19 consecutive cases before
store `openAndWait` exposed a distinct close-input boundary. Ordinary store
closed through the web X, but two store-wait attempts did not deactivate from
that same detected glyph; XTest activated KWin Overview once, and a device-level
click at the detected physical point also did not close the retained surface.
The managed Shift+Tab path closed it immediately and passed the inactive
callback, wait-helper completion, app-focus return, stable parking, and crash
checks. The web close helper now detects the actual glyph and fails before input
when detection is not confident, while the matrix uses Steam's toggle only for
store `openAndWait`. A fail-closed resume boundary validates the exact existing
manifest and metadata prefix, requires the same remote package plus preflight,
discards later metadata and stale cleanup evidence, and reruns from a named case
so the first 19 green cases need not be repeated.

The resumed Desktop matrix now passes its exact 26-case contract and strict
whole-root summary with 52 screenshots. Every attached managed case agrees on
the X11/GLX presenter, one overlay target, route-specific input, close and focus
return where applicable, parked lifecycle, and clean crash evidence. The first
final cleanup receipt caught a terminating target whose `/proc` directory still
existed; its overlay helpers exited naturally immediately afterward. Cleanup is
now one runner-owned exact-executable path, treats zombie/exited targets as
non-live instead of extending a timeout, and is exposed as an explicit matrix
cleanup mode. Replaying only the final case through the validated resume
boundary produced a green receipt with zero smoke, inhibitor, or overlay
processes while Steam and Plasma remained running.

The Deck has now transitioned through its installed `steamosctl` compatibility
route into the active seat0 Game Mode session. `loginctl` reports a local,
active Wayland session with `Desktop=gamescope`; Gamescope session services and
the Steam launcher are running, Plasma is absent, and pinned unattended SSH
remains reachable. This SteamOS build names the compositor process
`gamescope-wl`, so exact `gamescope` process-name checks are not valid mode
proof; session properties and services are the authoritative evidence.

Game Mode exposed a session-specific capture and input contract rather than a
presenter regression. KDE Spectacle hangs without Plasma, while the installed
`gamescopectl screenshot` command produces state-driven 1280x800 compositor
captures. The raw store route emits `active=true` and renders in SteamUI; a
virtual controller Guide button changes shell chrome and an unregistered
virtual B button cannot navigate, while exact Escape on SteamUI's Xwayland
display emits `active=false` and returns to the focused fullscreen app. The
runner now selects Gamescope capture and the game X display when appropriate,
supports exact Escape close, and requires managed parking events only for
presenter actions. A dedicated `--mode game --suite game` contract prevents
the known non-activating Desktop web matrix from running in Game Mode.

## Last Verification

- Worktree recovery confirms `main` equals `origin/main` at `37705e1` before
  this new checkpoint edit; unrelated `AGENTS.md`, `.codex`, and input-probe
  worktree changes remain untouched.
- Steam Deck matrix self-test passes on the current repository.
- Local name resolution and exact-key SSH authentication reach the powered-on
  Deck in either graphical mode without user input.
- Fresh direct and focused managed Desktop proofs pass after the runner fixes;
  focused passive progress/unlock proofs also pass after the state-driven
  notification and exact-runtime cleanup fixes. The Deck runner, matrix, and
  summary self-tests pass locally, and the packaged helper self-test passes on
  the Deck.
- The strict fresh Desktop root passes all 26 expected cases and its final
  cleanup receipt: 52 screenshots, zero remaining smoke/inhibitor/overlay
  processes, and one running Steam and Plasma process.
- The strict Game Mode root passes both expected cases and its final cleanup
  receipt: passive managed presenter readiness, raw store active/inactive and
  back-to-app proof, two Gamescope screenshots, zero remaining
  smoke/inhibitor/overlay/Plasma processes, and one running Steam process.
- Prior settled Deck findings and their rerun conditions were reviewed before
  starting live work.
- `check:platform`, all 196 unit tests and TypeScript checks, `api:check`, Rust
  formatting, native check, Bash syntax, the Deck runner/matrix/summary
  self-tests, and `git diff --check` pass locally.
- Native-Windows `package:smoke` reaches its known host-semantics boundary: the
  packaged macOS preparation fixture expects `/tmp/...`, while native Windows
  resolves it as `C:\\tmp\\...`. This is the unchanged
  `WIN-PACKAGE-SMOKE-HOST-001` blocker; exact Linux CI remains the supported
  complete package-smoke gate.
- Exact implementation CI `29400961875` passes all four required jobs:
  Windows x64, Linux x64, macOS Apple Silicon, and package smoke.

## Next Actions

1. No further public Deck action is required. Rerun a mode contract only when
   its ledger entry says the relevant implementation, SteamOS/Steam client, or
   evidence contract changed or a gate regressed.
2. Keep real configured-product purchase proof separate until the actual game,
   capable `InitTxn` path, and complete private runtime handoff exist.

## Exact Next Step

No further public Steam Deck work is required. The next meaningful purchase
proof is the private configured-game flow, and only after its documented
`InitTxn` prerequisites exist; App ID `480` must not be used to claim it.

Detailed platform evidence is in
`docs/research/cross-platform-overlay-status.md`; rerun contracts are in
`docs/research/test-findings-ledger.md`; architecture is in
`docs/research/native-overlay-presenter-plan.md`.
