# Current Work Checkpoint

Last reviewed: 2026-09-25

This is the replace-in-place recovery checkpoint described in
[`AGENTS.md`](../../AGENTS.md). Earlier checkpoints, from the 2026-07 release
candidates through the 0.4.9 preparation, and the historical release evidence
are preserved verbatim in [checkpoint history](checkpoint-history.md).
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
Not covered: Steam-client launch (the direct launch still loaded Steam's
overlay), a signed candidate, a display matrix, and receipts. For automation:
an elevated foreground utility makes UIPI silently drop injected input, so
check the foreground owner and the host's message counters before trusting
a `SendInput` result. The public example passes a direct App ID `480` smoke, but its
`presenter-*` actions intentionally fail on Windows, so it cannot prove Windows
overlay routes.

Verified without code changes: the `NativeBinding` interface matches all 1,153
napi-generated functions by name, arity, parameter type and optionality; all
210 native callback IDs match the SDK; KWin `qdbus` calls are each bounded by
their timeouts; networking batch-receive errors need corrupted Steam structs
and every message is still released.

## Open before release

1. Candidate-bound Windows release proof on Electron 44.4.5. It needs a
   signed candidate, a Steam-client launch, the display matrix and both
   receipts. The local pass above, including emoji and non-BMP text, is green.
   The consumer's Electron pin must move from 44.4.3 to 44.4.5 first.
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

Documentation cleanup (2026-09-25): old checkpoints moved verbatim to
[checkpoint history](checkpoint-history.md), and standing decisions moved to the
presenter plan. The README, user guides, CONTRIBUTING, RELEASING, PRIVACY,
signing policy and Steam Input example were checked against the code and
corrected. Relative links and anchors across all tracked Markdown are clean.

## Last verification

- CI green on every job at `a27b9cc`. Locally: `npm test` 476/476, native tests
  including the X11 tests under Xvfb, `npm run api:check`,
  `npm run check:platform`, and `git diff --check`.
- macOS Apple Silicon: `core` overlay matrix 37/37 at `44b035aa`.
- Windows 11 x64 at `727bf77`: `npm test` 476 tests (473 pass, 3 skipped),
  81 native tests passing with 3 hardware-only tests ignored, the local
  Electron 44.4.5 live pass above, and the example's direct App ID `480`
  smoke.
