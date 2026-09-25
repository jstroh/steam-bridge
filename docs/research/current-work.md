# Current Work Checkpoint

Last reviewed: 2026-09-25

This is the replace-in-place recovery checkpoint described in
[`AGENTS.md`](../../AGENTS.md). Earlier checkpoints, from the 2026-07 release
candidates through the 0.4.9 preparation, and the historical release evidence
are preserved, with private identifiers redacted, in
[checkpoint history](checkpoint-history.md).
Standing architecture decisions live in the
[presenter plan](native-overlay-presenter-plan.md).

## Active goal

Deep review of the whole repository on branch `claude/fervent-gauss-17k8a8`
(from `7beb49e`, package `0.4.9`), fixing every confirmed finding, so the branch
can pass to another reviewer and then to a final release. Source behavior
changes only where a failing-before test or an exact source trace proves the
defect.

## Standing decisions

- Linux and Steam Deck Electron packages start with `--no-zygote` and
  `--no-sandbox`; never make them optional. See the
  [sandbox decision](native-overlay-presenter-plan.md#non-negotiable-linuxsteam-sandbox-decision).
- Windows uses the standalone D3D11 game host. Do not return to popup or child
  attached presenters. See the
  [Windows architecture](native-overlay-presenter-plan.md#read-first-after-compaction-windows-architecture).
- Linux and Steam Deck use one visible X11/GLX application-host window and a
  hidden offscreen Electron renderer. See the
  [settled host](native-overlay-presenter-plan.md#settled-linuxdeck-application-host).
- macOS support is Apple Silicon only; never package, launch or verify through
  Rosetta.

### 2026-09-24 whole-codebase review corrections

Fixed with failing-before tests or exact source traces:

- **Linux X11 keyboard.** Printable keysyms were passed through as Windows
  virtual keys (`.` arrived as Delete, `[` as Super). Punctuation now maps to
  the OEM keys, keypad/lock/Pause/Print/Super/Menu keys are mapped, and Num Lock
  selects the keypad level. XKB detectable auto-repeat is enabled and repeated
  presses carry the Windows repeat bit (an Xvfb/XTest hold produced 17
  release/press pairs before). Text comes from `XLookupString` plus
  `libxkbcommon`, so Caps Lock and non-ASCII keysyms work. Live proof is open:
  `LINUX-NATIVE-KEYBOARD-VK-001`.
- **Linux X11 pointer.** Mouse `wparam` now carries the Windows post-event
  button mask. Client geometry is cached per pump batch; 200 queued motion
  events fell from about 11-13 ms to 1.2-2.3 ms under Xvfb (diagnostic, not
  live Deck proof).
- **Windows text.** Non-BMP characters arrive as two UTF-16 surrogate
  `WM_CHAR` messages; the Electron forwarder sent each half alone and Electron
  44.4.5 inserted U+FFFD for each. Surrogates are now paired. Proven live on
  Windows for `SendInput` surrogate pairs and the emoji panel:
  `WINDOWS-NATIVE-CHAR-SURROGATE-001`.
- **Callback dispatch.** User callbacks no longer run under the registry
  mutex; registering or dropping a callback from inside one deadlocked before.
  Unregistering waits for an in-flight hook, and a disconnected JavaScript
  handle ignores events Steam had already queued for the JavaScript thread.
- **`init` app IDs.** Numeric, environment and object forms share one
  validator (positive integer, at most `0xffffffff`).
- **macOS launcher.** The launcher compiled into consumer apps no longer runs
  arbitrary `--steam-bridge-launch-target` paths or applies arbitrary env-file
  variables. The live `core` matrix passed 37/37 at `44b035aa` with App ID
  `480`, every case through Steam and the hardened launcher:
  `MAC-LAUNCHER-ARGUMENT-CONFINEMENT-001` is settled. See the
  [macOS verification](macos-verification-2026-09-24.md).
- **macOS harness.** The matrix environment gate loads the `./steamworks`
  entry, and `npm pack --json` readers accept npm 12's name-keyed output.
- **CI.** Jobs default to `contents: read`; workflow scripts read refs from
  `$env:` rather than interpolating them. Linux reruns native tests under Xvfb
  with `STEAM_BRIDGE_REQUIRE_X11_TESTS=1`. The Windows present-stall unit test
  no longer depends on event-loop timing (reproduced with a 15 ms stall after
  the pump).
- **Smaller fixes.** CPU overlay frames reuse their buffer on Linux and
  Windows; `init` rewrites the Steam app-ID environment only when it differs;
  `build.rs` gates its Windows-only helper; the legacy-layout CLI is committed
  executable.
- **Electron 44.4.5.** Upstream stable moved from 44.4.4, which failed
  `check:electron:latest`; the example, Windows ASAR fixture and lockfile pin
  44.4.5. Earlier 44.4.4 live evidence does not carry over.
- **Privacy.** Committed notes, tests and examples use generic
  `consumer`/`CONSUMER-*` placeholders instead of private product, repository,
  tracker, account-path or app identifiers.

### 2026-09-24 Windows Electron 44.4.5 local requalification

A local, not candidate-bound, Windows pass on Electron 44.4.5 at `727bf77` was
green. See `WIN-ELECTRON-4445-LOCAL-001` for what it covers:

- **Build.** The build was exact: `npm pack` from a scratch copy with the
  addon under its prebuild name, installed as a normal directory into the
  configured consumer. That consumer was overridden locally from its pinned
  Electron 44.4.3 and packaged unsigned for QA.
- **Presentation and overlay.** One standalone D3D11 host rendered at 60 FPS,
  with presenter, native-host and renderer diagnostics agreeing on
  `windows-d3d11`. The QA-menu Friends overlay opened, sent its callbacks and
  closed with Escape, and a duplicate open was suppressed.
- **Window and focus.** Maximize, minimize and restore, keyboard sizing to
  the logical minimum, fullscreen, and focus away and back all passed.
- **Text.** Emoji and non-BMP CJK arrived as one character each.
- **Shutdown.** The app exited cleanly with code 0, and Steam kept running.

Mouse edge, corner and title drags also pass, including the clamp to the
logical minimum, and the host followed a live 125%-to-250% display change.

On 2026-09-25 the published-`0.4.9` QA build was also launched through the
Steam client from a non-Steam shortcut. It passed game entry, backend agreement
in every report, the QA-menu and Shift+Tab overlay open with Escape close, F11
and restore, focus away and back, and an Alt+F4 exit with code 0. Two
behaviours were observed; details are in the ledger row:

- Each Friends activation also raised Steam's desktop client windows. This is
  probably a shortcut-harness artifact.
- The intentional 5-second `windowsSharedTextureResumeDelayMs` hold freezes
  the game image after every overlay close.

Not covered: a signed candidate, a display matrix, and receipts. For automation:
an elevated foreground utility makes UIPI silently drop injected input, so
check the foreground owner and the host's message counters before trusting
a `SendInput` result. The public example passes a direct App ID `480` smoke,
but its `presenter-*` actions intentionally fail on Windows, so it cannot
prove Windows overlay routes.

### 2026-09-25 independent Windows review of this branch

- **Fixed:**
  - `29f49d5`: unregistering a Steam-thread hook returned while a dispatch
    was still running, a regression from moving callbacks out of the
    registry lock. A test fails before the fix.
  - `82071f3`: doc corrections: checkpoint-move wording, remaining consumer
    remnants, and `close()` failure behaviour.
- **Rejected:** the missing-XTest CI risk (the Xvfb step ran the end-to-end
  test), surrogate-pairing gaps (traced), and launcher and `npm pack` parser
  memory-safety or shape issues.
- **Residual, not fixed:**
  - A consumer `onBeforeDispatch` hook sees raw surrogate halves.
  - Nested unregistration from inside another dispatch does not wait.
  - The macOS launcher derives its directory from `argv[0]`.
  - The env-file filter is a denylist.
  - Non-init app IDs lack an upper bound.
- **Checks on Windows:** everything passed except `package:smoke`:
  - Passed: `check:platform`, `native:build`, `npm test` (476/473 pass, 82
    native), `native:fmt`, `native:check`, `api:check`, `git diff --check`.
  - `package:smoke` stops on environment only: CRLF checkout line endings and
    an elevated shell. The same write-protection self-test passes with a
    non-admin token.

Verified without code changes: the `NativeBinding` interface matches all 1,153
napi-generated functions by name, arity, parameter type and optionality; all
210 native callback IDs match the SDK; KWin `qdbus` calls are each bounded by
their timeouts; networking batch-receive errors need corrupted Steam structs
and every message is still released.

### 2026-09-25 Steam Deck remote helper

Goal: lasting SSH access to the Deck in Game and Desktop Mode through the
runner, on branch `claude/steam-deck-remote-helper` from `35164c3`.

- **Helper.** `scripts/steam-deck-remote.sh` now holds every Deck session step
  the runner used to send as inline shell: environment and display selection,
  capture, input, focus and state probes, close verification, the shortcut
  wrapper, keep-awake, launch and cleanup. The runner installs it when its
  content changes (`cmp`, then an atomic `mv`) and calls it. A fake-SSH
  comparison against `35164c3` found no change in the seven Python blocks, the
  wrapper, the env-file bytes (including URLs with `?`, `&` and spaces), the
  remote step order, or the runner output.
- **Preflight** also reports the SteamOS release, session mode, Desktop panel
  power, the six runner tools and `/dev/uinput` access. `check_ssh` used to
  succeed even when SSH failed, because it read `$?` after an `if`; it now
  returns the SSH status.
- **Access between runs:** `npm run steam-deck:remote -- <command>`,
  `--mode capture`, `session game|desktop` (`steamos-session-select gamescope`
  or `plasma-wayland`; plain `plasma` starts Plasma X11), and `wake-display`.
- **Live, in the 13:19-13:39 UTC game-lock window:** the helper switched
  Desktop -> Game -> Desktop through `steamos-session-select`, about 8 s each
  way, with a Gamescope capture in Game Mode (`DECK-SESSION-SELECT-001`).
  The matrix `shortcut-friends` case (App ID `480`, the package already on the
  Deck) then passed with both the new runner and the old one, with matching
  artifacts (`DECK-HOST-001`). Steam was shut down again afterwards. Earlier
  live checks were preflight, status, capture and cleanup. Other ledger rows
  from today: `DECK-DESKTOP-DPMS-CAPTURE-001`, `DECK-STEAM-GAME-LOCK-001`,
  `DECK-STEAM-COLD-LAUNCH-001`.
- **Game lock:** the Deck shares one Steam account with other machines. Run
  nothing that starts Steam on the Deck without the account's game lock.
- **Known, not fixed:** the web-close probe sets `RESULT_FILE` without
  exporting it. Its close wait therefore never reads the lifecycle log and
  always waits the full 3 seconds. It is kept unchanged so the evidence
  contract holds.

## Open before release

1. Candidate-bound Windows release proof on Electron 44.4.5. It needs a
   signed candidate launched through Steam, the display matrix and both
   receipts. The local pass above, including emoji and non-BMP text and a
   local Steam-client shortcut launch, is green.
   `WIN-OVERLAY-RESUME-HOLD-001` covers the 5-second frozen frame after every
   overlay close. A one-rig A/B (5000, 250 and 0 ms) found no correctness
   failure without the hold. It did find a few slow copies and two single
   Present stalls under 200 ms at resume. A follow-up decision A/B on the
   same rig passed 500 ms, with no stall, slow copy or artifact. 250 ms had
   one 137 ms Present stall, and the 5000 ms hold often froze on a fading
   overlay frame. The consumer now overrides the delay to 500 ms. The
   default stays at 5000 ms until the A/B passes on more GPUs and displays
   and a post-close state signal is found.
   The consumer now pins Electron 44.4.5, which needs a new Windows runtime
   epoch before release.
   `WIN-COPY-COMPLETION-FOCUS-001` has a second affected report on `0.4.9`
   (hybrid NVIDIA laptop: copies about 100 ms and fresh delivery about 19 FPS
   once foreground). A single-GPU desktop did not reproduce it but showed a
   20-36 ms completion floor at 3440x1440@50. Next: a hybrid-GPU run, GPU
   timestamps around the copy, and an A/B that moves the copy off the host's
   render/Present context.
2. A live Linux Desktop and Steam Deck keyboard case, as described in the
   ledger entry.
3. Maintainer decision: Git history still contains private product names and
   a Steam account number that looked real (see below). Rewriting it needs
   explicit approval.
4. Release procedure: the documentation-only publish route restores the
   predecessor's proven native payload only for the hard-coded `v0.1.6` tag in
   `release.yml`. For any other tag the Release run rebuilds the addons, so the
   route passes only if that rebuild is byte-identical to the previous release.
   Nothing here proves builds are reproducible; confirm it or generalize the
   restore step before relying on the route.
5. Known low-severity items, not fixed: `startSteam()` and
   `configureSteamElectron()` keep owned cleanup entries for resources the
   caller closed until the application closes; the Electron forwarder keys
   held keys by key code, so left and right Shift share one entry.

The smoke self-tests' Steam `userdata` account number also appeared as
`[U:1:…]` in a copied connection log with real timestamps, so it was treated
as a real account ID and replaced with synthetic `12345678`, and the shortcut
app ID with synthetic `3000000001`. The values are arbitrary inside each self-test.

Documentation cleanup (2026-09-25): old checkpoints moved, with private identifiers redacted, to
[checkpoint history](checkpoint-history.md), and standing decisions moved to the
presenter plan. The README, user guides, CONTRIBUTING, RELEASING, PRIVACY,
signing policy and Steam Input example were checked against the code and
corrected. Relative links and anchors across all tracked Markdown are clean.

## Last verification

- Steam Deck remote helper branch on macOS: runner, helper and matrix
  self-tests, `npm test` (477/477 JavaScript plus native tests),
  `package:smoke`, and `git diff --check`. Live on the Deck (SteamOS 3.8.11)
  at `c0e047b`: both session switches and the `shortcut-friends` case with the
  new and the old runner.
- CI green on every job at `a27b9cc`. Locally: `npm test` 476/476, native tests
  including the X11 tests under Xvfb, `npm run api:check`,
  `npm run check:platform`, and `git diff --check`.
- macOS Apple Silicon: `core` overlay matrix 37/37 at `44b035aa`.
- Windows 11 x64 at `727bf77`: `npm test` 476 tests (473 pass, 3 skipped),
  81 native tests passing with 3 hardware-only tests ignored, the local
  Electron 44.4.5 live pass above, and the example's direct App ID `480`
  smoke. On 2026-09-25 at `6b43256`: `npm test` again 476 tests (473 pass, 3
  skipped) and 82 native tests, plus the Steam-client shortcut launch.
- WSL2 Ubuntu 26.04.1 LTS on the same laptop at `6b43256`, with Node 22.23.3
  and Rust 1.98.1, from a Linux-filesystem clone with LF line endings. These
  are routine checks only; WSL gives no live Steam overlay proof.
  - Passed: `npm ci`, `check:platform`, `native:build`, `native:fmt`,
    `native:check`, `api:check`, `package:smoke`, `git diff --check`, and the
    native tests under Xvfb with `STEAM_BRIDGE_REQUIRE_X11_TESTS=1`.
  - `npm test` passes 476/476 JavaScript and 57/57 Rust tests with `DISPLAY`
    unset, as in CI. Under WSLg's own XWayland display,
    `x11_probe_window_reports_keyboard_and_pointer_edges` runs without the
    Xvfb requirement and fails its XTest button-click assertion. The keyboard
    assertions before it pass, and the same test passes under Xvfb, so run
    Linux native tests under Xvfb on WSLg.
