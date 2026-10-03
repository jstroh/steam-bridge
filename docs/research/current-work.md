# Current Work Checkpoint

Last reviewed: 2026-10-03

This is the replace-in-place recovery checkpoint described in
[`AGENTS.md`](../../AGENTS.md). Earlier checkpoints, from the 2026-07 release
candidates through the 0.4.9 preparation, and the historical release evidence
are preserved, with private identifiers redacted, in
[checkpoint history](checkpoint-history.md).
Standing architecture decisions live in the
[presenter plan](native-overlay-presenter-plan.md).

## Active goal

A fresh private consumer pass on actual Deck Game Mode admits an additive,
exact-version QA chord contract. Ordered Control/Shift/terminal bindings now
reach all fourteen action terminals, with cursorless shell/world entry,
acknowledged Menu-to-Gameplay handoff, hotbar changes, trigger-modified mirrors,
bags/top-bar entry and ordinary gameplay. Consumer and host release ownership
distinguish synthetic focus cleanup from real neutral; all-terminal offline
regressions pass. Production capability/defaults remain unchanged and the native
identity/deduplication prototype remains disabled. These results do not qualify
built-in HID, every gameplay semantic action or populated items. A subsequent
matched virtual-pad run proves one ordinary overlay held-direction quarantine
and neutral/fresh-press recovery, not the complete terminal/device matrix.

Actual stick activation admitted a standard Chromium slot and moved the world.
The earlier empty-pad observation was not a proven absent analog provider.
Admission also changed consumer prompts from ABXY to positional arrows. The
consumer repair queries exact handles only for native identities and uses
bounded standard raw-family fallbacks otherwise. Actual changed-byte Game Mode
proof identifies Valve's virtual Xbox emulator (28de:11ff), retains ABXY after
stick admission, and retains it through disconnect/reconnect with a changed
Chromium slot. Unknown/nonstandard devices remain positional. Exact identity
regressions reject unrelated Steam controllers sharing a numeric slot. Startup
SDK hints and emulator labels do not qualify underlying hardware or arbitrary
custom remapping. Never match these namespaces numerically or suppress raw pads.
See `DECK-CONSUMER-CHORD-ADMISSION-001` and `DECK-CONSUMER-PROMPT-NAMESPACE-001`.

Another confirmed generator defect inverted physical Start/Menu and Select/View.
Valve's installed templates identify button_escape as Start and button_menu as
Select. The generic generator now uses menu/view respectively, with both analog
and digital source-profile tests for all sixteen controller types. A consumer
canonicalization against its older pinned package is idempotent with this
corrected generator. Matched private revision 2.4 emits the correct physical
commands on actual Game Mode; corrected virtual X/Y helpers use kernel xpad
letter aliases rather than misleading geometric aliases. See
`INPUT-LEGACY-MENU-VIEW-001`. The library source is committed for source push;
no corrected npm package has been published or repinned.

Original installed objects, symlinks and modes were restored exactly. Owned
input, inhibitor, capture, server and debugger resources are stopped; Wayland
Desktop, closed Steam and display-on state are verified. The raw video fully
decodes, but older capture metadata lacks encoder-EOS attestation and late
markers fall outside its duration. The edited diagnostic excludes those markers
and labels a separate passive visible-world ending; it is not a release receipt.
New captures observe encoder EOS and fully decode. A short edited follow-up
uses a same-recording visible-game ending, not substituted pixels. Consumer QA
helpers now fail missing EOS and safely resume an exact interrupted restore.
No binding reset, global keymap change or publication occurred. Do not
repeat the unchanged black text-dialog experiment or suspend without a wake path.

Next consumer scope: RT still defaults to a mouse click. A new typed
selected/nearest visible NPC route reuses range/dispatch and GUI ownership. On
actual Game Mode with a private trigger-emulation layout, RT opens one nearby
NPC window after browser stick admission, stays quarantined across dialog close
while held, and reopens on neutral/repress. The first immediate RT sample had no
browser pad/action; its initialization cause is not established. Chat correctly
owns RT but exposes keyboard-emulated Back being swallowed by native text.
A matched QA-only terminal reservation now retains ignored holds until release,
and separates cleanup-only history from unreleased state. Independent held/focus/
target/history regressions pass; repaired text bytes still need device retest.
Legacy-only admission remains gated because its older reset/neutral path can
spill held input into gameplay. Shipped defaults are unchanged. The short video
preserves failures, uses a same-recording visible-world ending and fully decodes;
late markers outside the source duration are excluded. The original tree and
Desktop/closed-Steam baseline are exactly restored. See
`DECK-CONSUMER-CURSORLESS-NPC-001` and `DECK-CONSUMER-TEXT-BACK-001`.

### Earlier transport diagnostics

The latest controlled Game Mode diagnostic distinguishes configuration identity
from emission: unique native Gameplay probes have a bound origin, the current
set, revision 2.3 and SDK down/up on an injected Xbox-compatible device. F19
emits no renderer key; a fresh candidate with Ctrl+Shift+F7 emits trusted keys.
Held F7 generates multiple downs with `repeat=false`; Shift and Control release
before F7. Consumer admission must latch the terminal key until its release.
This probe adds a native Gameplay action and performs diagnostic SDK reads, so
it does not qualify unchanged legacy defaults, built-in HID, modifier overlap,
native deduplication or a release. Original installation and Wayland/closed-Steam
state are restored. See `DECK-GAMEPLAY-CHORD-DIAGNOSTIC-001` before a live rerun.

Qualify the local Electron input lifecycle correction; it is not published.
Renderer requests and their coalesced MessagePort frames now retain an optional
correlation ID. A stale pre-focus frame or failed completion cannot retire a
newer request. Gamepad-only preloads invalidate on browser focus, visibility,
freeze/resume and a producer context epoch. A matched refused poll also clears
cached held actions, even without a consumer-specific context message.
A matched new-epoch frame rejected before separate context IPC now clears the
old cached held state too. Unmatched stale replies still cannot clear a newer
cache or retire its request. Eight tests execute the actual compiled service and
standalone preload together; all pass. The advanced service preserves legacy
manual scheduling by default and honors explicit false; managed connectActionInput
defaults to strict correlation. Renderer-owned advanced consumers must explicitly
opt into correlation. Manual/non-correlated mode lacks strict stale-frame proof.
The current Windows JavaScript suite is 495 tests: 492 pass and three existing
skips. Full npm/native tests (101 native
pass, 13 hardware ignores), platform/type/API, native format/check and whitespace
pass. A fresh Linux source fixture with the current JavaScript/template and
recovery notes passes package smoke using a retained Linux native payload only
for package loading. That is not new native or candidate-bound live proof.
Old request/bootstrap forms remain accepted, but a mixed old non-correlated producer cannot provide
the new strict stale-frame guarantee. Consumer rollout must pair matching bytes.

An extended actual Deck Game Mode consumer pass used private current JavaScript
plus the separately identified Linux key addon below. Controller-only shell
navigation, cancellation, scrolling, reconnect and ordinary overlay recovery
worked. Legacy gameplay delivery remained unqualified for injected generic and
Xbox-compatible profiles. A full-screen native text request showed black pixels
and later left action data inactive until app relaunch; ordinary overlay-only
recovery passed separately. Missing callback evidence is not cancellation proof.
See `DECK-NATIVE-TEXT-UI-001` and `DECK-VIRTUAL-PAD-LEGACY-001`. Real built-in HID
and suspend/resume remain open. The consumer also fixed and device-tested its
separate missing loading-cancellation UI. No user binding or published byte
changed. Exact original installed files/modes were restored and temporary
input/debugger/client-serving state was removed. Plasma Wayland Desktop and the
closed Steam baseline were verified after the session switch.

### Settled Linux extended-key correction

A later private consumer QA assembler accidentally reused the published old
Linux addon while updating its archive and JavaScript. That run's negative
stock-map result is not a regression against the corrected addon below.
With the intended unpacked native hash and ASAR integrity metadata verified,
the corrected private candidate again delivered trusted F19/F20 gameplay keys
and consumer UI actions on actual Game Mode. The consumer now gates swaps and
launches on explicit archive/native/SDK identities. Original installation and
Wayland/closed-Steam state were restored. Selected Gameplay configuration and
controller-to-key delivery remain separate open gates: manifest acceptance,
Menu origins and a Gameplay set handle do not establish its selected groups.
Do not reset player layouts or enable native gameplay to bypass that gap.
See `DECK-CANDIDATE-NATIVE-IDENTITY-001` and `DECK-VIRTUAL-PAD-LEGACY-001`.

Fix the confirmed Linux/Deck F13-F24 conversion gap without changing the global
keymap or public input payload. The standard evdev map names these physical
keys FK13-FK24, but its symbols are media actions or NoSymbol; symbol-only
conversion emitted virtual key zero. The repair caches the active server's XKB
key names and rescues only unresolved media/missing symbols on those exact
physical keys. Recognized remaps, printable text, keypad modifiers and dedicated
media keys retain their existing behavior. Core and XKB mapping/name/device
notifications refresh the cache; no server query or allocation was added per key.
Held-key virtual identities remain pinned through repeats and release, so a
mapping change cannot strand the previous key; focus changes clear that state.

The isolated Xvfb/XTest regression failed before the repair with F13 press and
release both reporting zero. It now verifies all twelve down/up pairs through
the real X11/GLX host, alongside punctuation, auto-repeat and pointer edges.
All 62 Linux native tests pass under isolated Xvfb; synthetic XKB name/device
notifications also replace a stale cache from the actual server. A private
consumer on actual Deck Game Mode now received all twelve trusted down/up pairs
from a kernel-uinput keyboard while the original media/NoSymbol keymap remained
unchanged. F19 also worked during gameplay and after ordinary overlay B-close
with native/browser focus restored. Original installed files, symlinks and modes
were restored exactly; the temporary keyboard/pad service, socket and debugger
tunnel were removed. This is focused key conversion proof, not full gameplay,
built-in HID, actual live layout-switch or release-candidate qualification.
Windows `npm test`, platform/type/API checks, native format/check and native
tests pass (101 native passed, 13 existing hardware ignores). Linux package smoke
also passes in an isolated source fixture. A separately identified private Linux
addon was built; it requires at most GLIBC 2.39, not a generic Linux release
baseline. The virtual generic pad still produced no legacy D-pad key during
gameplay despite both controllers reporting the Gameplay set; direct keyboard
F19 on the same candidate worked. Do not treat conversion alone as fixing that
separate unqualified controller/configuration path or alter user bindings.

CI `36956812710` passed unit/native tests, isolated Linux Xvfb, package smoke,
dependency audit and all four Node compatibility jobs, but every platform stopped
at formatting: Rust stable advanced to 1.99 on October 1 and now formats wrapper
macro arguments with trailing commas. Formatting alone reproduced 31 compile
errors against the two older matchers. They now accept optional trailing commas,
with no generated API/argument change; Rust 1.99 formatting is applied. Corrected
Windows native check, full npm/native tests, format and API coverage pass;
the corrected Linux fixture passes all 62 native tests under Xvfb and package
smoke. Follow-up CI `36958046242` at `36a5bfe` passed all nine jobs, including
all three native targets, isolated Linux Xvfb, package smoke, dependency security
and Node 18/20/22/24 compatibility. Next: continue the separate virtual-controller
configuration diagnosis and consumer incoming-code review. The exact Deck-tested native
source remains `f8e01cb`; later formatting/matcher work is not a transferred
candidate-bound live receipt.
No release tag, published package, Steam configuration or global keymap changed.

### Completed incoming-main review

Review of incoming main `b6ccfe3` found and corrected four Deck-helper issues:
the inhibitor stop expanded malformed PID-file contents into `kill` arguments;
capture/close-glyph failures could continue to pointer input and return success;
an identical installed helper without executable permission was treated as
current; and remaining quiet-grep self-test pipelines could fail on producer
SIGPIPE under `pipefail`. Both inhibitor cleanup routes now validate one bounded
positive PID and quote it. Web-close requires its result file and valid display
geometry, propagates capture/detection/input errors and refuses an uncleared KWin
overview. The installer repairs executable permission atomically. Piped source
assertions consume their complete input without changing their conditions.

Failing-before tests reproduced malformed-PID signaling, a successful result
after failed capture/detection, and the non-executable helper installation. The
expanded helper, host-runner and overlay-matrix self-tests pass with stub input
and a local transport. The full Windows checks passed 484 JavaScript tests
(three existing skips), 101 native tests (13 existing hardware ignores), type
checking, platform/API coverage, native format/check and whitespace. No live
Deck session or Steam client was changed in this review.

Dependency auditing also found vulnerable transitive build tools. For that
remediation, only the lockfile records for `brace-expansion` (1.1.21, 2.1.7 and
5.0.12) and `fast-uri`
(3.1.8) changed; their dependency shapes and root dependency versions are intact.
The updated lockfile audits with zero vulnerabilities. A fresh Linux source
fixture with the changed helper/runner/lockfile passed `package:smoke`; the
Windows dependency install, build and typecheck also pass after the updates.
Main CI `36695993346` passed the three platform jobs and dependency audit, but
its package job stopped at `check:electron:latest`: upstream stable had moved
to 44.5.1. The QA example and lockfile now pin 44.5.1; the Windows ASAR fixture
derives its version from that example. A clean Windows install, the latest-pin
gate, full Windows checks and a fresh Linux `package:smoke` fixture all pass.
These are automated repository checks, not new live qualification on 44.5.1.
The follow-up [main CI run](https://github.com/jstroh/steam-bridge/actions/runs/36697016603)
at `c379a76` passed all nine jobs: Windows x64, Apple Silicon macOS, Linux x64
with isolated Xvfb, package smoke, four Node runtime versions and dependency
security auditing. The incoming-main review is complete.
This work changes repository QA tools and development dependencies; the frozen
published 0.4.10 tag and artifacts remain authoritative for that release.

The maintainer accepted the Windows caption-tooltip hover limitation as
non-blocking and requested release of the unchanged frozen `v0.4.10` candidate.
Do not continue tooltip experiments as a release prerequisite or include the
rejected filter. A fresh protected actual-game run on the exact candidate and
Electron 44.4.5 completed the seventeen manual checks and the four schema-7
cases, ending at the original 1280x720 size and position. Native System Menu
Size and keyboard input proved resize/minimum-size behavior; controller-bounded
pointer-border attempts are not claimed as successful. The ordinary Friends
overlay was observed over the game and closed with Escape. Complete unfiltered
logs pass the frozen receipt validator: 380 game samples at 59.9 median paint/fresh/
native FPS and 52 overlay samples at 59.0 median native FPS on a 60 Hz display.
Two JavaScript readiness promises returned false, with no final fallback/bypass;
the separate renderer wait-timeout count remained zero. All runtime/package
hashes and protections passed after clean exit. Owned QA state was restored.

The passing receipt hash is
`4443e024ea220ef013f64aa22197cc087f03887b002f014907b68aa94d7a3e4d`.
Only its sanitized compressed form was configured for the protected publisher.
[Publish run 36381702276](https://github.com/jstroh/steam-bridge/actions/runs/36381702276)
was dispatched once from the immutable tag using Release run 36292417069. The
maintainer approved the protected environment, and the publisher succeeded at
08:13:19 UTC. npm's initial processing delay resolved: an independent registry
download matches all frozen tarball bytes and all 89 package files, including
all three native targets. Registry signature and provenance verification passed,
binding the immutable tag, source and exact publisher invocation; `latest` is
0.4.10. The [stable GitHub Release](https://github.com/jstroh/steam-bridge/releases/tag/v0.4.10)
was published at 08:27:05 UTC after all six assets were independently downloaded
and matched by size/hash. The downloaded PDB matches the published addon and the
downloaded schema-7 receipt validates. The release-scoped proof secret was then
removed; the sanitized proof remains durably attached. Do not dispatch or publish
again. The tag and bytes remain
unchanged. The consumer's separate production build/signing/display gates are
not satisfied by this Bridge receipt.

Historical diagnosis: a controlled 30-second getter-null experiment suppressed
106 native host diagnostic reads, but the trace still recorded 18 long
PeekMessage stalls and fresh delivery stayed near 56 FPS; the getter is not a
necessary cause. Its original descriptor was restored and all QA launch state
cleaned up. Target, display, focus and viewport stayed unchanged.

A narrowly scoped `WM_NCMOUSEHOVER`/`HTMINBUTTON` prototype was rejected by
live evidence and removed from production source. The isolated build passed
102 native tests (13 hardware tests ignored), 485 JavaScript tests (3 skipped),
native check/format, platform/API and symbol checks. Protected actual gameplay
still reproduced recurring long pump gaps on pointer-only Minimize hover;
the diagnostic ring contained no matching hover event and had not filled.
Returning the pointer to the client restored healthy cadence. This public
message is not the observed tooltip callback interception point. Retain the
experimental binary, diff and raw evidence locally, not as release proof.
No global UI/security setting or frame/GPU policy was changed. A safe scoped
remedy remains open; do not ship ineffective interception or consume unrelated
nonclient messages. Preserve frozen candidate bytes below.

The qualified immutable `v0.4.10` candidate is at
`ef0a536fd28fe77ecfdb7571625742b9f609952c`, containing the merged whole-codebase
review (#17), Windows presentation repairs (#18), and narrow review fixes.
The original reports and later local QA have been reconciled. Preserve
the minimize/background recovery, adapter-switch fixes, optional dedicated
copy device, and measured one-frame queue improvement. The tag and candidate
artifacts are durably retained in the verified npm and stable GitHub releases.

### Current review corrections

- Linux keypad virtual keys now use Xlib's modifier-aware lookup for keypad
  navigation/digit keys. Num Lock plus Shift must agree with the text path;
  ordinary physical key mapping, repeat handling and punctuation stay intact.
  The new four-modifier-state press/release regression and all 11 Linux
  native-surface tests passed under isolated Xvfb.
- Windows output-adapter diagnostics now cache discovery per renderer,
  monitor and display-topology generation. Refresh on display/settings events,
  a stale DXGI factory, monitor changes, or renderer/swap-chain replacement.
  Cache missing results and the containing-output fallback too. Monitor-owner
  discovery remains first, including on hybrid GPUs whose swap chain cannot
  report its containing output. This changes diagnostics, not device selection,
  copy ownership, the two-copy bound, Present flags or frame-wait recovery.
- An initial proposal to restore maximum frame latency two was withdrawn
  before commit. The older cadence comparison is not evidence that depth one
  is defective with the newly repaired gating. Later hybrid-laptop QA at
  `2d2baa0` measured cursor latency back at the pre-latch baseline and healthy
  fresh delivery at 60 and 165 Hz. Keep depth one and its regression test;
  qualify cadence and responsiveness together on the immutable candidate.
- Local QA at `7987d63` found an active-overlay/minimized main-thread spin;
  the `bacc50b` retest reports CPU p50 0.2% instead of about one core, healthy
  restore, and no latch. Those newer results supersede the earlier failure;
  they are source-linked local evidence, not a new release receipt.
- Microsoft cleared the submitted local QA addon from `7987d63`, not every
  later build. Its reference SHA-256 is
  `9c6ba67b1c98e6cef5289f3d3b304eff7e1d64027458f6df319f9367ade0f874`.
  A new candidate must be independently hashed and qualified; do not reuse
  the already-published `0.4.9` tag or transfer clearance to different bytes.

The retained QA summaries have been reconciled with raw results and build
hashes; independent review, local checks, main CI and exact-tag CI passed.
Later hybrid tests reused the cleared executable, which currently identifies
Electron 44.4.3; their launch route supports that runtime inference but lacks
per-run executable attestation. Those tests do not qualify Electron 44.4.5.

### Immutable candidate inventory

- Source/main CI: `36292187153`; tag CI: `36292417095`; tag-push Release:
  `36292417069`. All succeeded for the exact candidate source above.
- The canonical package gate, all three native targets, and matching Windows
  symbols were downloaded without rebuilding. The package/bundle/addon hashes
  were independently checked and the publish-artifact verifier passed in
  verification-only mode.
- npm tarball SHA-256:
  `f4d4b7efe898eef14828c191b0ff4dce031ac1320ef1fac455a4fe82371a733f`.
- Windows addon SHA-256:
  `f6c5a686d2ec0694020b9fd0402ac8303eb5bf3c042e467f470ec76faf8fd081`.
- Windows bundle SHA-256:
  `9650a5a4e0ce1d4e0aa09314b53a59f59d7853c5ccd9f0723bac8a1c40dd3279`.
- Verified addon/PDB debug ID: `6cc0954d-3219-43a8-a8ff-220313a8bd3a-1`.

The retained earlier Microsoft-reviewed addon was independently found to match
`9c6ba67b...ade0f874`; it is not the new candidate. On 2026-09-27, the new
candidate's full `f6c5a686...af8fd081` hash, size, source and build were verified
in Microsoft's submission history alongside its clean Smart App Control
analyst reply. Generic pending/in-progress portal labels are not blockers.
Protected actual-game proof on the frozen candidate with Electron 44.4.5 now
passed as recorded above. Do not rebuild, retag, transfer prior clearance or
reuse a prior receipt. Post-publication identity and provenance verification passed.

The 2026-09-27 continuation extracted and fingerprint-verified the canonical
bundle and installed the frozen tarball in isolated staging. The retained
Electron44.4.5 consumer QA executable subsequently received its own clean
Smart App Control analyst reply; its exact submission binding, full file hash
and size were verified independently. The earlier missing executable is no
longer the target. The operator then confirmed other-host Steam/helper isolation
and availability for elevation/authentication. A reviewed isolated consumer
assembler completed, independently verifying every runtime and packaged file
and all 89 Bridge files against the frozen tarball. The already-staged consumer
was protected using the documented owner-right Apply/Audit route, with no
elevation or security-policy changes; an Interactive/Limited launch succeeded.
A scratch ASAR native-placement defect was corrected in a fresh QA directory,
preserving the rejected attempt. Exact native loading and standalone D3D11
startup then succeeded, but Steam explicitly logged the account off with
`Logged In Elsewhere` during qualification. After authorized remote-client/helper
isolation, an unchanged-candidate smoke reached actual gameplay and ordinary
Friends-overlay open/Escape-close, then exited zero with Steam surviving.
Gameplay paint/fresh/native medians were 59.9 FPS at 60 Hz; overlay native
median was 54.9 FPS, below the required 57. After the operator disconnected
remote streaming, a fresh unchanged-byte run without CDP measured 59.9 FPS
game paint/fresh, 59.8 native and 58.9 active-overlay native medians. DPI and
desktop-window coverage also changed, so streaming-only causation is unproven.
The exact Limited process and loaded modules were attested. Basic native
window transitions and the 640x480 minimum recovered; complete display/manual
coverage and final normal-size restoration were unproved by that earlier run.
Raw stderr matches
the Bridge Valve-startup classifier, but the consumer's literal-empty-stderr
contract conflicts with its mandatory CDP evidence and needs explicit resolution.
Five JavaScript readiness promises returned false (which may mean timeout,
unavailability or a stale generation), while the separate legacy renderer
timeout counter stayed zero; that does not establish zero asynchronous DXGI
timeouts. Neither fallback nor bypass remained active.

The local September 28 post-minimize deficit has been causally narrowed: the pointer was
left over the minimize button. A fresh pointer-only A/control/B/A/B/A run on
unchanged protected bytes, without minimizing or any other window transition,
held 59.9 FPS in the client and over plain caption, fell to about 53 native /
55 fresh FPS over the minimize button, and recovered to 59.9 on each return to
the client. A visible Minimize tooltip accompanied the failing hover. All
64 settled final-recovery samples had zero new gaps over 100 ms. Preserve the
earlier failed measurements, but supersede the minimize-required causal claim;
no version-to-version regression has been established.
This approximately 53-native/55-fresh hover result does not explain or replace
the original reporter's approximately 19.5-fresh/60-native hybrid-copy/bypass
problem; preserve the existing minimize/background and adapter repairs.

A separate short Chromium trace places recurring 124-129 ms stalls inside
main-thread PeekMessage with pending sent messages; non-client mouse messages
follow each stall. V8 profiles show no corresponding JavaScript/GC hotspot.
The renderer RAF remains healthy while main-process frame delivery pauses and
then bursts. A follow-up raw-protobuf native trace captured 601 main-thread
stack samples and 17 long PeekMessage spans. All 42 overlapping samples pass
through USER32 `__xxxTooltipCallback -> CreateTooltipWindow -> AnimateWindow
-> AnimateBlend`, ending in a layered-window update or explicit SleepEx wait.
Microsoft public PDB identity was matched using its documented implementation's
GUID/Info-age/DBI-age rule, and PE x64 runtime-function boundaries independently
confirm the tooltip and animation addresses belong to those functions. This
local stall is Windows caption-tooltip fade work on the frame-delivery thread;
the Steam hook is a caller, not demonstrated to own the delay. Why the tooltip
is repeatedly recreated and the appropriate scoped remedy remain open. No
shader, frame-queue, copy-device or restore-policy change follows from this
finding. The raw records and a bounded
second-hover slice are retained alongside an explicit capture-interruption
caveat for the extended observation. See the
[reconciled diagnostic evidence](test-findings-ledger.md#hybrid-gpu-recovery-and-queue-depth-evidence-reconciliation-2026-09-26).

These diagnostic runs exited zero with Steam surviving. Temporary shortcut/task
state was removed and final protection/content audits passed. Publication was
held during diagnosis; the later accepted limitation and successful exact-candidate
receipt are recorded above. Respect the presentation/lifecycle scope boundary
and do not treat the earlier diagnostic instrumentation or preparation as a
passing live receipt. No released runtime change, candidate rebuild or retag
followed from the tooltip experiment.

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

Not covered: an immutable release candidate, a display matrix, and receipts. For automation:
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
- **Fixed after the comparison:** the web-close probe set `RESULT_FILE`
  without exporting it, so its close wait never read the lifecycle log and
  always waited the full 3 seconds. It was kept unchanged for the byte-for-byte
  runner comparison and is now passed to the wait, which returns as soon as
  the lifecycle log records the close. The wait now takes the result file as
  an argument, and the helper self-test covers both outcomes.
- **Self-test fixes, 2026-09-29:** the inhibitor-cleanup check treated a
  killed but unreaped (zombie) `sleep` as still running, so it failed where
  init does not reap orphans; it now ignores zombies. The runner's wrapper
  checks piped `sed` into `grep -q` under `pipefail`, which could fail on
  SIGPIPE; they now grep captured text. The wrapper env file, which can carry
  the smoke control token, is now written owner-only (`0600`).

## Open consumer and platform follow-ups

1. The Bridge candidate-bound Windows four-case proof on Electron 44.4.5 passed
   as recorded above. A consuming game's changed production package still needs
   its own protected launch, display matrix and required receipts. Earlier local
   emoji/non-BMP input evidence and the new Bridge receipt do not replace those
   separate consumer gates.
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
   Cause found on 2026-09-25: one 25 ms frame-wait timeout (minimize,
   occlusion, F11, overlay or a zone load) permanently latches
   `frameLatencyWaitBypassed`; ungated presents then queue ahead of the copy
   on the same context, and cross-adapter present lengthens that queue. See
   `WIN-FRAME-WAIT-BYPASS-LATCH-001`. Done: expected iconic or hidden
   timeouts no longer latch. The occlusion guard never runs, because a
   flip-model swap chain does not return `DXGI_STATUS_OCCLUDED`, so full
   occlusion by another window still latches and recovers through the
   render re-arm. A latch needs three consecutive
   unexpected timeouts, and both native and JavaScript recover without timers
   on restore, occlusion end, a swap-chain resize, or four consecutive
   signalled polls while bypassed. An adapter switch now releases the old swap
   chain before attaching the new one (`WIN-ADAPTER-SWITCH-SWAPCHAIN-001`).
   Diagnostics now report adapter LUIDs, cross-adapter present, latch and
   re-arm counts, and sampled GPU copy time. The opt-in
   `windowsDedicatedCopyDevice` option moves the copy off the host queue:
   latched completion falls from about 48 ms to 1.35 ms in the harness and
   from 20-37 ms to about 1.3 ms live on a single-GPU desktop. It stays off by
   default until an NVIDIA hybrid laptop at 60 Hz passes the candidate gate in
   `WIN-FRAME-WAIT-BYPASS-LATCH-001`.
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

- 2026-10-03 source CI at `0b07a8e` completed: Windows, Linux (including
  isolated Xvfb), Apple Silicon macOS, package smoke and all four Node runtime
  jobs pass. The dependency audit fails on GHSA-ch52-4w7c-c8xp, propagated into
  eight high-severity development/build-tool findings. Production-only audit
  is clean. All published http-cache-semantics versions remain affected with no
  patched version; no compatible lock-only update fixes the chain. Do not force
  a builder downgrade or override its downloader across a breaking major API.
  No audit bypass, package publication or release qualification followed.
  See `CROSS-BUILD-UNPATCHED-CACHE-AUDIT-001` in the findings ledger.
- 2026-10-03 reviewed input source at `e1d2495`: full Windows npm test passes
  492 JavaScript tests (three existing skips) and 101 native tests (13 hardware
  ignores), plus platform, native format/check, API and whitespace gates. Eight
  actual service/preload tests preserve both strict renderer polling and advanced
  manual compatibility. A fresh Git-archive Linux fixture passes build and complete
  package smoke using a retained Linux native payload only for package loading;
  this is not new native or candidate-bound live proof. The native Windows package
  smoke hits the already-recorded POSIX-permission environment limitation; no host
  security or permission policy was changed. Source push does not publish, repin,
  transfer old live qualification or satisfy the remaining consumer/device gates.
- 2026-09-30 incoming-main review: the four helper corrections above have
  failing-before coverage. With the QA example on Electron 44.5.1, full
  Windows tests, typecheck, platform/API checks, native format/check, the
  latest-pin gate, zero-vulnerability dependency audit and fresh Linux
  `package:smoke` pass. No live Deck session or release artifacts were changed.
- 2026-09-29, main `aceeb4c` merged with the Deck helper branch plus the fixes
  above, on Linux: helper, runner and matrix self-tests, `npm test`
  (487/487 JavaScript plus native tests), `package:smoke`, `check:platform`,
  `native:fmt`, `api:check`, and `git diff --check`. No product code changed.
- Release 0.4.10: exact-tag CI/build and protected schema-7 four-case proof
  passed; npm signature/attestation and 89-file identity checks passed; all six
  GitHub assets matched independent downloads and the Windows symbols pair.
  The final documentation/recovery update passed `package:smoke`, whitespace
  checks and an independent privacy/accuracy review. The Windows tooltip hover
  limitation remains explicitly accepted, not fixed.

- A focused installed-`0.4.9` high-refresh diagnostic on Windows 11 / AMD hybrid
  hardware held 165.0 fresh FPS and 164.53 native/DXGI FPS for an uncontaminated
  30-second interval at 165 Hz. A subsequent external desktop-mode/DPI change
  moved the display to 60 Hz and latched the old JavaScript wait fallback.
  A later PresentMon trace measured 59.915 displayed FPS but about 79.87 ms
  median Present-to-display delay. This is old-runtime diagnostic evidence,
  not a candidate pass or physical input-latency measurement. After the remote
  session ended, a clean restart and uninterrupted minute at 165 Hz held
  164.973 fresh / 164.174 native-DXGI FPS, with two admission drops, 36 repeated
  refreshes, no fallback and no Present budget overruns. The second trace
  elevation request was canceled, so this minute uses built-in/DXGI evidence,
  not a 165 Hz OS trace. The game/debug listener exited and the original desktop
  mode was restored; see `WIN-HIGH-REFRESH-PRESENT-001` in the ledger.

- Main `9ec1faa`: all CI jobs passed; local `npm test` passed 484 JavaScript
  tests (3 skipped) and 98 native tests (13 hardware tests ignored). Platform,
  native formatting/check, API coverage and dependency audit passed.
- Current narrow correction: Windows native tests passed 101/101 (13 hardware
  tests ignored); Linux native-surface tests passed 11/11 under Xvfb. Full
  Windows npm test passed (484 JavaScript tests, 3 skipped), as did formatting,
  native check, API coverage, platform check, dependency audit and diff check.
  Exact corrected-tree and tag CI/package smoke also passed. Two focused
  actual-device tests passed separately: output ownership without a swap chain,
  and copy timing/adapter diagnostics. They do not replace candidate-bound
  actual-game live proof; that separate proof subsequently passed as recorded above.
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
