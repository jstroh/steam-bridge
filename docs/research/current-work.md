# Current Work Checkpoint

Last reviewed: 2026-08-03

Only the release status and checkpoints above `Historical Release Ledger` are
authoritative current state. Everything below that boundary is retained solely
as dated evidence and must not override the current stable version, review
anchor, architecture decisions, or validation results stated here.

Review anchor: `d7bc752d29bee26549ecf353638d73e535f534a7`
(`Bypass npm argument forwarding in release workflows`). npm `latest` and the
stable GitHub Release are `0.3.15`; the review anchor is bound to immutable tag
`v0.3.15`.
Neither the source commit alone nor an intermediate ad-hoc bundle is a
publishable candidate. Exact
`v0.3.0`, `v0.3.1`, `v0.3.2`, and `v0.3.3` are immutable, unpublished,
rejected candidates. Exact `v0.3.5` is also immutable
and unpublished, but is obsolete because the current native and consumer
repairs were made afterward. Exact `v0.3.6` is tagged and its cross-platform
candidate workflow passed, but it remains unpublished and must not be moved or
published: the candidate-bound proof contract still required repeated physical
Shift+Tab input and treated a bounded Win32 modal-menu wait as a GPU failure.
Exact `v0.3.7` is also immutable and unpublished. Its release workflow and
actual-game runtime passed, but its receipt classified one valid 1 FPS -> 60 Hz
minimize/restore target transition as steady-state pacing. `v0.3.8`, `v0.3.9`,
`v0.3.10`, `v0.3.12`, and `v0.3.15` are published; `v0.3.15` is the current
stable release. Exact `v0.3.11` and `v0.3.16` are immutable and unpublished.
The post-tag `v0.3.11` adversarial review found Web API credential fail-open
paths and native lifecycle/resource ownership defects, so it must never be
moved, reused, or published. Never move, reuse, or publish any rejected tag.

Exact `v0.3.13` is also immutable and unpublished. Its three native prebuilds
passed, but the final Windows package gate failed before candidate assembly:
the Node `22.13.0` runner's bundled npm consumed `--artifacts-dir` while
forwarding an internal `npm run` command and left only the option value. No npm
package or GitHub Release was published. Internal assembly now invokes the Node
script directly, the parser accepts only the explicit flag/equal form or the
single unambiguous legacy-npm positional form, and a self-test permanently
covers all accepted and rejected shapes. The corrected release must use a new
version and tag; never move or reuse `v0.3.13`.

Exact `v0.3.14` is likewise immutable and unpublished. It proved the corrected
artifact assembly and completed the exact Windows Electron/ASAR/native-load
package gate, then exposed the same pinned-npm argument stripping in the later
candidate-verifier invocation. It produced no npm package or GitHub Release.
All argument-bearing release and trusted-publication workflow calls now invoke
their Node CLIs directly, and package smoke rejects either workflow if that npm
forwarding pattern returns. The replacement must use a new version and tag;
never move, reuse, or publish `v0.3.14`.

### 2026-08-03 v0.3.17 release preparation

This patch release is required because published `0.3.15` predates the Windows
standalone presenter's asynchronous DXGI frame-readiness scheduling and
two-frame queue selected by the source-linked physical-movement comparison.
The release also carries bounded presentation telemetry, exact native-binding
ABI coverage, the audit memory-failure repair, and compatible stable dependency
updates.

The first tagged candidate `v0.3.16` passed source CI and the cross-platform
Release workflow, but exact Windows actual-game proof caught an ordered-close
failure: one duplicated-handle DXGI frame-readiness wait could remain pending
for its bounded worker interval after the overlay session closed, and the
Steam lifecycle guard therefore rejected immediate `shutdown()`. That tag is
immutable, rejected, and must never be published or moved.

The frame-readiness wait owns an independent duplicated Win32 kernel handle,
does not call Steam, and generation-checks its result before touching the
native surface. It is now explicitly excluded from Steam-client asynchronous
lifecycle accounting; actual Steam async Promises remain fail-closed across
init and shutdown. A regression test closes a Windows session with the wait
unresolved, shuts Steam down successfully, then proves the late result cannot
pump the closed session. The package version is prepared as `0.3.17`; no tag,
npm publication, or GitHub Release exists until the protected candidate,
exact Windows live proof, tag CI, Release workflow, and trusted publication
gates all pass.

### 2026-08-02 v0.3.15 stable release checkpoint

Immutable tag `v0.3.15` is published to npm and as the stable GitHub Release.
Source CI run `30771930886`, tag CI run `30772060516`, and cross-platform
Release run `30772060529` all passed. Trusted npm publication run
`30774081378` restored the exact audited candidate and its candidate-bound
Windows live-proof receipt, then published those bytes through the protected
`npm-production` environment. The temporary compressed-proof environment
secret was deleted after publication and verified absent.

The canonical and registry `steam-bridge-0.3.15.tgz` files are byte-identical:
10,031,589 bytes with SHA-256
`22140c71799d95a88cfa3897d37e735308cdf6601faae79a0b69fba95527b4b6`.
The Windows live-proof receipt semantic SHA-256 is
`7d789fa0c65508f30ab3fece97bf5bd722b862073764b813e4861f496a9e3401`.
The GitHub Release carries the canonical npm tarball, full Windows bundle,
package audit, stable-Electron native-load result, and live-proof receipt.

The candidate-bound pass used the actual configured Fantasy Online 2 game,
actual Steam client, stable Electron 43.2.0, physical native addon, ordinary
Friends overlay, and no DevTools. It covered startup chrome, native menus and
cursor, title drag, resize, exact 640x480 minimum client size,
maximize/minimize/focus/fullscreen transitions and restoration, rounded
corners, overlay client alignment and close, clean shutdown, and settled game
and overlay pacing at the active 60 Hz display rate. It observed no crash,
purple or tiny surface, flicker, device loss/recovery, slow shared-texture
copy, or stderr output. The configured consumer's QA-only native-menu focus
gate required a separate app-side correction because Win32 emits
`captureLost` immediately before the menu `WM_COMMAND`; that correction does
not alter this package's immutable candidate bytes.

## Active Goal: Cross-platform exhaustive actual-game QA

Build and retain one auditable, platform-neutral actual-game QA contract with
strict Windows, macOS Apple Silicon, Linux Desktop, Steam Deck Desktop, and
Steam Deck Game Mode adapters. The shared contract covers exact candidate and
process identity, cold/warm launch, geometry and aspect, menu/chrome and input,
slow/fast/reversing move and resize, exact minimum size, maximize/restore,
minimize/throttle/restore, fullscreen/restore, focus switching, ordinary Steam
overlay open/duplicate suppression/close, every platform-supported transition
or proven native modal constraint while Steam is active, baseline/active/post-
close FPS against the authoritative display rate, crash/orphan cleanup, and
exact display-setting restoration.
Platform adapters add the platform-specific compositor, DPI/backing-scale,
refresh-rate, input, fullscreen, host, and presentation evidence.

### 2026-08-02 Windows movement-stutter root-cause and pacing checkpoint

The reported two-to-three-second movement hitch was reproduced by a human in
the actual configured game, then isolated with synchronized Chromium rAF,
Electron offscreen-paint/shared-texture, native pump/Present, and DXGI frame-
statistics counters. The game loop remained at 60 FPS with 16.8 ms steady
renderer intervals, native wait/Present/render work remained far below one
display frame, and no D3D device loss occurred. DXGI nevertheless recorded
repeated refreshes. This locates the remaining defect at the asynchronous
source-to-swap-chain scheduling boundary, not in game simulation, networking,
shared-texture copy, or GPU execution time.

The Windows renderer still performs a zero-timeout readiness poll before every
Present, but a full flip queue no longer enters a one-millisecond JavaScript
retry loop. Steam Bridge duplicates the DXGI frame-latency waitable handle,
waits on that owned duplicate in a napi-rs blocking worker, records a one-shot
permit because the wait consumes the auto-reset signal, and wakes the retained
presenter on the Promise microtask. Surface and swap-chain generations reject
late completions after close, resize, device recovery, or renderer replacement.
The Electron main/message-pump thread never blocks on DXGI.

Controlled actual-game comparisons at the active 60 Hz display rejected both
one-frame variants. Timer-polled maximum latency one produced 197 repeated
refreshes across 59.174 seconds. With the worker wake-up it improved to 10
repeats across 59.135 seconds, but still lost to maximum latency two. The final
two-frame worker build handled all 368 observed full-queue events asynchronously
and produced 3,546 Presents across 3,550 refreshes in 59.268 seconds: 59.83 FPS
and four isolated repeated refreshes. During 367 real Windows movement
keypresses, the post-boundary trace recorded zero Electron paint or shared-
texture intervals above 25 ms, zero native pump durations, Presents, or renders
above 25 ms, and zero device losses. The initial 100 ms renderer sample was the
measurement/focus boundary; no later renderer interval exceeded 25 ms.

Closed paths: do not block Electron's message thread on the waitable object; do
not restore a one-millisecond readiness timer; do not select maximum latency one
from generic lowest-latency guidance without repeating this exact external-
source pipeline proof; and do not diagnose the residual frame-statistics count
as a JavaScript/game-loop hitch without a matching rAF or paint interval. Repeat
only after Windows presenter scheduling, swap-chain depth, Electron offscreen
delivery, DXGI device recovery, or display-rate selection changes, or if a
fresh physical-input report reproduces a visible periodic hitch on this worker
build. This source-linked repair is not yet an npm release candidate.

The follow-up dirty-tree review restricts async readiness waits to dirty D3D11
surfaces that already retain a real source frame. A merely not-yet-ready host or
the diagnostic OpenGL backend cannot create a false-resolving microtask loop
during renderer startup. Unexpected Win32 wait results now fail explicitly, and
unit coverage locks one wait in flight, timeout re-arming, newest-frame
coalescing, successful wake-up, and late completion after close.

### 2026-08-02 Windows keyboard-layout and movement-cadence checkpoint

A focused source-linked Windows pass addressed two new configured-consumer
reports without reopening any retired popup or child-host architecture. The
standalone host now inherits the foreground thread's active Windows keyboard
layout before it creates its HWND, and diagnostics expose both the host-thread
and foreground-thread layout handles. This ownership belongs in Steam Bridge:
the native standalone window becomes the focused input owner, while the
consumer remains layout-agnostic. On the development host, the installed
English layout matched exactly across creation and a browser-to-game focus
round trip, and `/` opened the in-game command suggestions. No second physical
keyboard layout is installed, so this is not yet a live Hungarian-layout proof;
do not change Windows language settings merely to manufacture one.

The same report exposed a separate configured-consumer translation defect:
Win32 numpad and lock virtual-key values were falling through to
`String.fromCharCode`, so values such as `VK_SUBTRACT` and `VK_CAPITAL` became
ordinary letters or control characters before `webContents.sendInputEvent`.
The consumer now maps the complete Electron-supported numpad family and lock
keys to their documented accelerator names, marks numpad key events with
`iskeypad`, and drops unsupported virtual keys instead of inventing characters.
Steam Bridge now carries the Windows `capsLock` and `numLock` toggle state as
optional native-input metadata; the consumer forwards those documented
Electron modifiers. Text remains owned by the native layout-aware `WM_CHAR`
path rather than a US-layout translation table.

The repaired local native build and configured consumer were then exercised
inside the actual game. Numpad `8` arrived in Chromium as `key=8`,
`code=Numpad8`, `location=3`; numpad multiply arrived as `key=*`,
`code=NumpadMultiply`, `location=3`. Caps Lock changed the captured native
toggle and the next letter arrived as uppercase `A` with `capslock`; Num Lock
likewise set and cleared `numlock`. Both lock keys were restored to their
original off state. This closes the reported numpad/lock translation defect;
it does not manufacture evidence for the still-unavailable Hungarian layout.

The movement-cadence retest first discarded an invalid synthetic sample after
proving its movement letters had remained in the chat input. With chat empty
and unfocused, repeated far-field game clicks visibly moved the character and
camera while telemetry sampled the real game surface. Twenty-four one-second
samples at 60 Hz held renderer rAF at 60.000-60.006 FPS, paint at or above
59.5 FPS, and native presentation at 58.7-61.0 FPS; the largest renderer
interval was 16.8 ms. Twenty-four one-second samples at 165 Hz held renderer
rAF at 164.016-165.033 FPS, paint at or above 163.9 FPS, and native
presentation at 162.9-165.1 FPS; the largest renderer interval was 12.1 ms.
Both runs retained zero device loss/recovery, zero slow shared-texture copies,
and exact host/foreground keyboard-layout agreement. No two-to-three-second
hitch reproduced. This clears the local D3D/presentation path but does not
close the external stutter report without its distinct machine/display/input
conditions or a new reproducible signal.

One earlier explicit QA-menu activation was deliberately invoked after the
game had already been backgrounded and produced an Electron hang. The
configured consumer now refuses that QA-only command unless its native host is
focused and, on Windows, diagnostics confirm the host is foreground. Focused
and backgrounded retests passed the gate. Product checkout, subscription, and
ordinary shortcut routes are unchanged. No crash or hang event occurred during
the fresh post-repair process that supplied the keyboard and movement evidence.

The configured consumer passes its complete 337/337 test suite, ESLint, and
TypeScript. Steam Bridge passes its complete 376/376 JavaScript and 37/37 Rust
test gates plus native formatting. The machine was restored to 1920x1200 at
60 Hz and the recommended 125% scale. This source-linked repair is not a new
package or release candidate.

### 2026-08-02 configured-consumer Bugdesk and external-link checkpoint

A review of the configured consumer's Steam-tagged player reports found two
additional shell-integration defects. Bugdesk's native HTML choice popups were
created outside the offscreen renderer surface, so the report type, severity,
and category controls could not be selected through the standalone native game
host. The client now paints those choices as keyboard-accessible listboxes
inside the game surface. Their accessible names include both label and current
value, and asynchronous option hydration preserves an open list and valid
keyboard focus. A focused actual-game Windows check selected values in all
three controls, scrolled the longer category list, closed only an open list
with the first Escape, and closed the unsent dialog with the second Escape. No
report was submitted.

The complete production outbound-link inventory is four user actions: the
shell TOS-decline YouTube video, the client's HUD Database root, Character
Build's generated canonical database URL, and Welcome's Bluesky profile. The
website-only Stripe navigation is not selected on Steam, logout/recovery stays
inside the shell, and `PxWindowManager`'s similarly named calls operate game
windows rather than browser popups. All four user actions now cross the
explicit Steam preload bridge. The configured shell accepts only the three
exact HTTPS hosts those routes require and opens them through Electron's
system-browser API on Windows, macOS, Linux Desktop, and Steam Deck Desktop
Mode. Steam Deck Game Mode returns `false` before browser dispatch and opens
nothing. The client awaits that result, so Character Open Build reports a
denial instead of false success. The TOS route consumes a system-browser
rejection rather than creating an unhandled Promise rejection. A focused
Windows actual-game check opened the database in a separate Chrome tab while
the game remained in its native host, then closed only that QA-opened tab. The
generated Open Build URL, awaited success, malicious-URL rejection, and Game
Mode denial are source/unit proven rather than browser-launch experiments on
this host.

The diagnostic review also removed per-keystroke renderer logging from the
shell's optional FPS mode; it could capture chat or login input and was not
needed for cadence evidence. The configured shell passes 339/339 tests, ESLint,
and TypeScript. The client passes TypeScript, the focused Bugdesk,
native-bridge, Build-share, and Welcome-link smokes, and a 632-module production
Vite build. Steam Bridge passes its full 376/376 JavaScript and 37/37 Rust
tests, supported-platform, native formatting/check, API audit, packed-package
smoke, and diff check. This source slice was explicitly authorized for commit
and push; publishing a package or release candidate remains a separate action.

## Non-negotiable Linux/Steam sandbox decision

Linux and Steam Deck Electron packages **must** start with both `--no-zygote`
and `--no-sandbox`. Steam injects its overlay into Chromium's zygote and child
processes unless zygote creation is disabled; Electron couples that mode to the
no-sandbox startup path. The resulting competing overlay targets have already
caused startup crashes and broken presentation in the real game. This is a
known, consciously accepted security tradeoff required by the proven Linux
Steam integration.

`prepareLinuxSteamAppAfterPack()` therefore adds both switches by default, and
`electronConfigureSteamOverlay()` keeps Linux child-process isolation enabled
by default. Do not make these switches optional, remove them as a generic
security hardening, or ask the consumer to opt in again. Reconsider this closed
decision only after a replacement is proven in the actual Steam-launched game
on Linux Desktop, Steam Deck Desktop, and Steam Deck Game Mode with child
processes, overlay presentation, input, transitions, and shutdown all passing.

### 2026-08-01 lifecycle, serialization, repaint, and audit remediation

The current post-review slice leaves the required Linux sandbox decision above
unchanged and closes the other actionable findings. All supported client and
game-server native calls now fail closed outside Node's main thread. Every
native Promise is counted until settlement, and client/game-server lifecycle
mutation is rejected before JavaScript resource cleanup while any such work is
pending. Trusted server-side encrypted-ticket inspection uses a deliberately
separate binding path so publisher workers remain supported.

Steam Web API query, form, comma-list, and nested `input_json` serialization
now reject non-finite numbers and integer numbers outside JavaScript's safe
range; 64-bit values remain lossless through `bigint` or decimal strings.
Community URL helpers apply the same safe-integer rule to numeric Steam IDs.
Electron repaint configuration validates timer bounds, replaces an existing
timer when the interval changes, and stops it when the effective interval is
zero or the profile is off.

The direct `tar` advisory and vulnerable transitive npm lock entries are
updated to audited versions. RustSec also exposed `event-listener` 5.4.1's
`StackSlot` cross-thread unsoundness in the Linux `zbus` chain; `Cargo.lock` is
pinned to patched 5.4.2. CI now runs npm and RustSec dependency audits, and
Dependabot monitors npm, Cargo, and pinned GitHub Actions weekly. Focused
regressions cover main-thread enforcement, async-shutdown exclusion, all Web
API serialization routes, and repaint replacement/disable behavior. A fresh
full local gate passed 376/376 JavaScript tests, 37/37 Rust tests, stable
Electron 43.2.0 validation, typecheck/build, package-gate self-tests, and a
zero-finding npm/RustSec audit; this remains unreleased work until reviewed,
committed, pushed, and proven by CI.

### 2026-08-01 deep-review remediation checkpoint

The post-`f23dc31` adversarial pass reproduced a public native crash before
changing code: `callback.unregisterRawCallbackBase(0x1234n)` reached Valve with
an untrusted pointer and the isolated Windows child exited with access violation
`0xC0000005`. All raw callback/call-result register and unregister compatibility
methods now fail closed; JavaScript-supplied native pointers are never
dereferenced. The SDK coverage audit records the four raw manual-dispatch
exports as deliberately unsupported, and native regression coverage calls the
previous crashing values directly.

The same sweep reproduced a second `0xC0000005` child-process crash through
`networking.sockets.connectP2PCustomSignaling(0x1234n)`. Custom-signaling,
custom-signal receipt, and non-null pointer-valued networking config inputs now
fail closed as well. Null pointer config remains available only to clear a
value; the SDK coverage audit records the two intentionally unavailable flat
custom-signaling entrypoints instead of treating dangerous pointer plumbing as
coverage.

Authentication tickets and Workshop query handles now carry the exact client
or game-server lifecycle generation that issued them. Release is serialized
with shutdown and occurs only while that same generation is current, so an old
numeric handle cannot cancel or release an unrelated resource after reinit.
Ticket promises also reject rather than return already-invalid bytes if their
issuing generation ended before the Promise resumed. Workshop query creation,
configuration, send, collection, and release use the same lifecycle lock; a
configuration error releases the newly created query before returning.
The reusable resource guard consumes ownership before calling its release
function, so a panicking cleanup path cannot trigger a second native release
when the guard is subsequently dropped.

The native-test runner now rejects stray arguments and foreign targets instead
of combining one target with another platform's runtime path. The first CI run
that executed Rust tests on every host exposed one test-only unaligned reference
to packed `SteamAPICallCompleted_t` data on macOS and Linux; it now performs an
explicit unaligned copy. Windows package smoke now discovers a real Python
interpreter and supplies stable `python`/`python3` shims to Git Bash instead of
falling into the Microsoft Store alias when no override variable is set.

Focused verification passes: the rebuilt real addon rejects the former crash
input, a live App ID 480 Workshop configuration-error path releases cleanly, a
separate query completes, a Web API ticket arrives, shutdown/reinit succeeds,
and cancelling the stale ticket is safe without printing ticket bytes. The
full local gate passes stable Electron 43.2.0, 371/371 JavaScript tests, 37/37
Rust tests, typecheck/build, Windows release self-tests, format, zero-warning
all-target Clippy, SDK/API coverage, the complete packed-package smoke matrix,
and production audit with zero vulnerabilities. The current worktree is not a
release until it is reviewed, committed, pushed, and passes fresh macOS/Linux/
Windows CI from the resulting commit.

### 2026-08-01 post-review resource and release-gate repair checkpoint

The reviewed working slice closes the actionable findings from the
deep post-`0.3.12` review without changing any proven overlay host architecture.
All four client/game-server Workshop query paths now validate Steam's 1-1000 ID
contract where applicable, reject `k_UGCQueryHandleInvalid`, and own every
created `UGCQueryHandle_t` through a reusable native resource guard. The guard
releases on success, configuration rejection, send failure, timeout, decode
failure, future cancellation, or ordinary unwinding while the owning Steam
lifecycle remains live. Authentication-ticket objects use the same idempotent
resource owner, so explicit `cancel()` releases once and native finalization is
a last-resort cleanup. The public smoke example and README use `try`/`finally`
for timely cancellation.

Successful first-time `initSafe()` and `initAnonymousUser()` calls now start the
same automatic callback pump as `init()`. Existing pumps retain their interval,
and repeated idempotent `initSafe()` still preserves JavaScript-owned overlay
resources. A new cross-platform native-test runner discovers the exact
`steamworks-sys` redistributable directory from Cargo metadata and prepends it
without losing the caller's platform library path. `npm test` now includes the
native suite, so CI and Release execute native lifecycle/resource tests on
Windows x64, Linux x64, and macOS arm64 instead of relying on `cargo check`.
All workflow actions, including the OIDC npm publisher, are pinned to immutable
40-character commits; Dependabot owns weekly GitHub Actions pin updates.

The final local slice passes 371/371 JavaScript tests, 34/34 Rust tests, exact
stable Electron 43.2.0, TypeScript/build, Windows release self-tests, supported-
target and API audits, native format/check, zero-warning all-target Clippy, a fresh
optimized Windows addon build/link, zero production npm audit findings, and the
complete packed-package consumer/platform smoke matrix. The package remains
version `0.3.12`; this slice does not create a release tag or publish to npm. Physical
non-Deck Linux remains explicitly not green because no real non-Deck x64 host is
configured. CI, WSL, VMs, and Deck receipts cannot satisfy that separate
X11/Wayland qualification lane. Package and contributor READMEs now state this
instead of allowing CI-tested Linux to be mistaken for physical qualification.
A focused live App ID 480 native smoke then initialized through first-time
`initSafe()`, received a 234-byte Web API authentication ticket through the new
automatic callback pump, cancelled it twice safely, rejected a NUL-bearing
Workshop query option after handle creation, completed a separate 50-item
Workshop query, and shut down cleanly. No ticket bytes were printed or retained.

### 2026-08-01 post-0.3.12 adversarial-finding repair checkpoint

The current reviewed slice is based on pushed main commit `f2698a8` and closes
the remaining findings from the `0.3.12` post-release review. Callback timer
intervals now require a positive safe integer within Node's maximum timer
delay before any native call or JavaScript resource cleanup. A failure in the
active callback timer stops that exact timer and emits
`STEAM_BRIDGE_CALLBACK_PUMP_FAILED`; a stale timer cannot warn about or stop a
reentrant replacement. `initSafe()` now preserves the callback pump, managed
controller, presenter, and native-surface ownership when native initialization
is already successful, matching the native operation's idempotent contract.

Steam Web API versions now accept only positive integer or `v`-prefixed
positive-integer values and canonicalize them before URL construction; empty,
fractional, non-finite, zero, negative, oversized, and path-shaped values fail
before fetch. Game-server replacement validates its version, both ports, and
server mode before acquiring the lifecycle lock or shutting down a healthy
server. Focused JavaScript ownership, warning, URL, workflow-policy, and Rust
validation tests pass.

The package retains its documented Node 18 runtime floor. CI now creates one
packed package under the exact Node 22.13 development floor and installs/tests
that same tarball under Node 18, 20, 22, and 24 in both CommonJS and ESM modes.
Tag CI and Release assembly use only the repository-pinned stable Electron;
the mutable npm-latest check remains a branch/PR maintenance signal and cannot
invalidate an immutable historical tag. The Web API guide now keeps both user
and publisher keys in the explicit trusted-server entrypoint, consistent with
Valve's protected-method guidance.

GitHub's Windows runner exposed a filesystem portability defect in both
release-candidate file guards: on that runner a path stat can report zero for
an unavailable device identifier while `fstat` on the opened handle reports
the real value. Both guards now treat zero as unavailable only at explicitly
marked path-to-handle identifier call sites; the default helper mode and every
handle-to-handle comparison remain strict. Nonzero device/inode comparisons,
size, link count, modification time, and change time also remain strict.
Self-tests reproduce the zero-identifier case and still reject unmarked,
changed-identifier, and changed-timestamp comparisons.

The complete local gate passes: 368/368 JavaScript tests, 31/31 Rust tests,
TypeScript/build, supported-target policy, stable-Electron pin, native format
and compilation, API coverage, Windows release self-tests, diff checks, a
direct packed-runtime CommonJS/ESM smoke on Node 24, and the full packed
consumer/platform matrix. The first package-matrix invocation selected the
Windows Store Python alias and failed before its POSIX fixtures; the unchanged
rerun passed through the documented `STEAM_BRIDGE_PYTHON` hook using the
desktop workspace's real Python runtime. Final diff/privacy review passed and
the fixes were committed and pushed in `725ece0`, `efb981b`, and `f2698a8`.
Exact-head GitHub CI run `30724974937` passed Windows x64, Linux x64, macOS
arm64, package smoke, and packed-package runtime installs on Node 18, 20, 22,
and 24. No release tag or live-runtime claim exists for this working slice; a
later publication still requires a new immutable version and the normal
exact-candidate proof.

### 2026-08-01 0.3.12 security and lifecycle release checkpoint

The `0.3.12` candidate replaces rejected `v0.3.11`. Caller-provided Web API
header values now require HTTPS, reject redirects, and participate in transport
error redaction. Valid JSON deeper than the bounded credential-inspection limit
fails closed instead of allowing a recursive traversal failure to be treated as
credential-free. Focused tests reproduce both former leak paths without making
a network request.

Client and game-server lifecycle generations now invalidate pending Steam API
and matchmaking query waits as soon as shutdown begins, so old promises cannot
pump or consume callbacks from a later initialization. Matchmaking server-list
requests and ping/player/rules queries are registered under the lifecycle lock,
cancelled/released before client shutdown, and removed by one explicit owner.
Their response state remains alive until the waiting future observes shutdown
and rejects. Fake UDP ports retain their owning client/game-server domain
and are destroyed before that specific subsystem shuts down; handles cannot be
made valid merely by initializing the other domain. The one-shot matchmaking
paths also retain response cleanup when shutdown prevents query cancellation.
The first live App ID 480 one-shot server-list shutdown probe reproduced an
access violation before active requests were registered; that failed design is
superseded by the explicit active-query ownership above. The rebuilt native
probe now rejects a pending server-list request in 32 ms, rejects a simultaneous
open request as stale after reinitialization in 69 ms, and rejects a generic
pending leaderboard request in 15 ms, with clean process exits. Focused Rust
lifecycle/resource tests, all 30 native tests, native formatting and
compilation, and the complete 363-test JavaScript suite pass locally. A final
live stress probe also completed 20 generic API and 10 matchmaking
init/request/immediate-shutdown cycles with prompt rejections and zero crashes.

Exact `v0.3.12` passed main CI `30722285293`, tag CI `30722419316`, and Release
assembly `30722419288` across macOS arm64, Windows x64, Linux x64, package
smoke, and the Windows publish-tarball/ASAR gate. Candidate-bound Windows
actual-game proof passed all four release cases with 711 qualified game samples
and 35 overlay samples, 59.9 FPS median paint/presentation against 60 Hz, empty
stderr, zero crashes, zero device loss/recovery, and zero slow texture copies.
Trusted npm publication `30723510912` passed from the exact protected tag. npm
serves a tarball byte-identical to the audited candidate at SHA-256
`6d9a62a7aab12e0da121e99d36029f36f62f8634d86d53e2831d9e55000f1331`;
the sanitized receipt semantic SHA-256 is
`a7ccca1379d2897be9bea2e1a90e9c4db3f0ebfa53205fbe3b7b258fae304ec9`.
All five GitHub Release asset digests match the retained local records, and the
temporary publication-proof secret was removed after publication. Do not reuse
`v0.3.11` artifacts or receipts.

### 2026-08-01 0.3.11 rejected release-preparation checkpoint

The current worktree prepares the first release after `v0.3.10`. The public
landing README is reorganized around install, first initialization, platform
window-model selection, client/server trust boundaries, packaging, and a
symptom-first troubleshooting table. The npm README now gives the runnable
client example and integration-path selector before the detailed platform and
release material.

The stable Electron smoke dependency is updated from 43.1.1 to 43.2.0, matching
the configured-product candidate and the current npm stable release. The
optional latest-version verifier now invokes npm without the broken Windows
batch-file spawn, works both inside and outside an npm script, and runs in CI
and the tag Release workflow before package assembly. Prerelease Electron
versions remain rejected by the exact-semver gate.

`ISteamUserAuth.AuthenticateUserTicket` retains its backward-compatible default
publisher-key route on `partner.steam-api.com` and now exposes Valve's official
rate-limited user-authentication-key route on `api.steampowered.com` through
`keyType: "user"`. Invalid JavaScript key types fail before fetch, and focused
coverage proves the access classification, host, key header, and no-fetch
failure path.

The focused Web API test, TypeScript, both direct and npm-driven latest
Electron checks, complete 361-test suite, packed-package smoke, Rust
format/check, API coverage audit, platform policy, production dependency audit,
and diff/credential scan pass locally. Exact baseline commit `b43167b` also
passed GitHub CI run `30702216770` on Apple Silicon macOS, Windows, Linux, and
the isolated packed-package job. This candidate was subsequently rejected by
the adversarial review recorded above and must not be published. This was not a
documentation-only successor: callback, Web API, lifecycle, and ESM changes
after `v0.3.10` require the normal live-proof publication path.

### 2026-08-01 Web API boundary and JavaScript lifecycle checkpoint

The Web API facade no longer guesses that an unclassified helper belongs on
Steam's partner host. All 193 audited facade call sites now carry explicit
`public`, `user-key`, or `publisher-only` access metadata. Host routing is a
separate decision: public and ordinary user-key traffic defaults to
`api.steampowered.com`, publisher-only traffic defaults to
`partner.steam-api.com`, and Valve's keyless
`ISteamUserAuth.AuthenticateUser` exception explicitly selects the partner
host. Conversely, SiteLicense, Inventory price-sheet, and PublishedFile delete
operations retain publisher-only access on Valve's API host. The supported-API
catalog stays anonymous by default but honors a key supplied explicitly to that
call. Generic `request()`, `get()`, and `post()` callers must supply the same
access metadata for authenticated operations and may select an exceptional
host independently; invalid JavaScript metadata fails before fetch. Omitted
access is deliberately keyless/public. This closes the known UserStats
misroutes and makes future helper access omissions a TypeScript error.

Publisher credentials now have a canonical `steam-bridge/server` boundary.
Only that entrypoint discovers `STEAM_PUBLISHER_WEB_API_KEY` or the server-only
`STEAM_WEB_API_KEY` compatibility alias. Keys travel in `x-webapi-key`, never
in generated or returned URLs; authenticated requests require HTTPS,
environment-derived keys cannot leave Valve's official API origins, and
credential-bearing errors and URLs are redacted. Browser and Electron
publisher-secret use fails closed unless a deliberately dangerous migration
override is supplied. Nested `input_json`, form/JSON bodies, camel-case
credential fields, and AuthenticationService's method-specific request IDs,
guard data, codes, and signatures are also inspected and redacted;
credential-bearing fetches require HTTPS and reject redirects so a key or token
cannot cross origins. Fetch and response-body-read failures share that same
sanitizer, and AuthenticationService, UserAuth, and UserOAuth routes enforce
secure, non-redirecting transport independent of field detection.
Root explicit-key and encrypted-ticket-decryption APIs
remain deprecated plain-Node compatibility shims, while encrypted-ticket
symmetric-key inspection is guarded from client runtimes.
The configured-product Electron smoke app retains one deliberately loud,
repository-only exception for its private `InitTxn`/`QueryTxn` ordering proof;
it imports `steam-bridge/server`, opts into the dangerous override in one
central factory, and accepts only the explicit publisher-key environment name
plus the documented compatibility alias. This exception must not migrate into
a shipped Electron client; production commerce calls belong on its backend.

Steam Bridge's callback timer, managed Electron controller, native
session/presenter/raw-surface lease, notification-presenter registrations,
listeners, waits, and timers now share the existing process-global ownership
registry. `shutdown()` and every repeat-init path close these JavaScript
resources before native teardown/reinitialization, including after module
reload, and pending managed waits reject with the established closed error.
Managed-controller setup is rollback-protected from the first fallible
post-presenter display-rate synchronization, so a failed construction cannot
strand the native surface or block an immediate retry.
Successful `initSafe()` and anonymous re-init preserve a previously running
callback pump, while stale timer failures cannot stop a replacement pump.
P1.3's required Linux Steam launch flags are unchanged. Focused unit coverage
passes 361/361, and the packed CJS, ESM, TypeScript, CLI, and export-map consumer
smoke passes with the repository's documented real-Python Windows adapter.
The final local gate also passes supported-target policy, the complete npm test
command, native formatting and compilation, API coverage, and diff checks.
The server entrypoint assigns its cross-module value exports explicitly so
Node 18/20/22 ESM consumers discover the same named API as CommonJS; the packed
consumer smoke asserts every server value export in both module systems.

### 2026-08-01 callback-dispatch correctness checkpoint

The next release includes a focused Steam callback repair. Client and
game-server callback registrations, completed API-call results, dispatch, and
shutdown cleanup are now keyed by an explicit domain. One process-wide lock
serializes both Steam pipes and owns the entire manual-dispatch lifecycle,
including init/shutdown, pipe acquisition, `RunFrame`, `GetNextCallback`,
completion-result retrieval, observer routing, and exactly one
`FreeLastCallback`. API-call results are copied and cached while Valve's
completion callback is still valid, so concurrent async waiters and the normal
JavaScript callback timer cannot steal one another's results. Callback
registration and callback-producing ticket/text-input requests also recheck
initialization and complete their setup under that lock, closing shutdown and
early-delivery races before an async wait begins. Shutdown also drops the sole
sender owned by each pending ticket or gamepad callback, so its promise rejects
promptly instead of waiting for the full operation timeout.

`runLegacyCallbacks()` is now a deprecated alias to the manual client pump;
Steam Bridge never mixes Valve's legacy and manual dispatchers. `initSafe()`
joins the same locked manual lifecycle. Raw `CCallbackBase` and `CCallResult`
registration rejects with facade guidance because it cannot be made valid in
the package's always-manual mode. Generic server subscriptions use
`gameServer.onCallback(...)`, and all typed server facades—including shared
networking and Workshop helpers—register in the game-server domain. P1.3's
required Linux Steam launch flags are unchanged.

Final affected-path validation on the Windows development host passed: 352/352
JavaScript tests, 27/27 Rust tests, TypeScript, native format/check, supported-
target policy, API coverage, npm package dry-run, and the complete packed-
consumer smoke suite. The Rust test build still emits the repository's known
pre-existing dead-code warnings. No overlay presenter or live-Steam behavior
changed in this slice, so no redundant live overlay matrix was run.

### 2026-07-30 configured-product macOS commerce checkpoint

The active lane is an exhaustive configured-product checkout and inventory pass
against a stable Electron 43.2.0 consumer candidate. The product remains on the
one attached Metal child architecture. Subscribe-to-Escape is now understood as
Steam's own Cancel Transaction transition: macOS can emit
`active=true -> active=false -> active=true` for one checkout while Steam swaps
the checkout page for its confirmation dialog. Both active phases must remain
checkout-correlated; the middle inactive callback is provisional and must not
settle the client operation. The consumer/shell focused state suites and the
live configured-product transition are green for that correlation repair.

One active-checkout window-state probe deliberately shrank the parent to
`1100x662` (a `1100x630` content area), then entered application-owned simple
fullscreen. CoreGraphics and native diagnostics agreed that the parent and its
same attached child became `1728x1117`; Metal bounds were `1728x1117`, drawable
size was `3456x2234` at scale 2, parent-content matching remained true, and
presentation continued at roughly 118-120 FPS against 120 Hz with no drawable
or render failures. Pixel inspection showed the dimmed Steam surface covering
the complete game area. Steam intentionally retained its own fully contained
floating checkout-browser panel instead of stretching that browser window to
the full display. This is not the historical tiny/partial host failure. Do not
resize, detach, recreate, promote, or replace the child to stretch Steam-owned
browser chrome. Repeat only if the attached child/drawable stops matching the
parent, the Steam panel escapes the child or becomes unusably small, or the
relevant Steam/AppKit/Metal sizing path changes.

Focused subscription cancellation/retry and non-spending
commerce/inventory/session cases are now green. Run one broad
unchanged-candidate macOS pass only after every applicable individual case is
green. Never authorize a purchase, and never run lock, sleep, display-sleep,
or permission-reset cases.

The isolated configured-product candidate now contains the then-current
client-px main. A real subscription checkout remained active for more
than eleven minutes, crossing both the client's five-minute uncertainty
boundary and the consumer shell's retired ten-minute active-correlation
deadline. The client correctly became fail-closed/unconfirmed at five minutes;
the shell retained checkout correlation while Steam still reported the overlay
active. Two native Escape transitions each emitted the expected provisional
inactive/active Cancel Transaction pair against the same checkout, with no
Friends substitution, duplicate target, child replacement, geometry drift, or
crash. Exact late authorization tests now allow only the known order to settle
that fail-closed state. Prepared intent alone retains a bounded deadline;
Steam-reported active checkout correlation does not expire on elapsed time.
This repair belongs to the consumer shell/client state machines, not Steam
Bridge's attached-child presenter.

The same candidate completed the destructive-but-non-spending inventory/mail
lane. Trusted Steam inventory reads moved from eleven rows/twelve units to
exactly zero, one unit per accepted transfer. Rapid double-clicking produced
one transfer, a full mailbox produced a clean no-op, and newly transferred
items appeared in mail without an extra send. The visible Gem Shop and direct
Steam API both remained empty after Refresh, close/reopen, a real in-game
logout/reload/login, and an exact process close plus Steam-owned relaunch. The
relaunch restored the 1280x720 CSS / 2560x1440 backing surface at DPR 2 and
created no new crash dump.

The first broad pass then exposed a QA ownership defect around the already
accepted stable-Chromium fixed-60 cadence exception. A matching 60 -> 120 -> 60
factor-two trace left the renderer at 30 FPS, so the next independent baseline
could only repeat that known state. The runner now distinguishes exact defect
recognition from final-release authorization, honors the passive-child policy
(an idle child intentionally presents at most 60 FPS on a higher-refresh
display), performs one clean Steam-owned warm relaunch only for the complete
known signature, and requires a fresh scheduler sample at the selected rate
before continuing. Focused live attempt 03 reproduced factors `[1,1,1,2]`, 107
skipped callbacks, exact 30 FPS post-restore, healthy 60 FPS passive Metal at
both the 120 and 60 Hz phases, a new exact app process, 60.000 FPS after
relaunch, and a green immediately following full traced baseline. Fixed 48 Hz,
low-Retina 60 Hz, and scale-1 60 Hz transition/baseline pairs remained green.
The isolated `display-pacing-transition` now runs before the independent
`fps-baseline`, while the broader `display-live-transition` runs last in every
profile. That order gives the exact cadence proof a clean process and prevents
an accepted terminal Chromium residue from contaminating unrelated cases.

The retained private configured-product receipt ran the 25 safe cases under all
five exact profiles: same-resolution 120,
60, and 48 Hz; low-Retina 60 Hz; and scale-1 60 Hz. All 125/125 executions and
all 37/37 canonical requirements passed with no cadence exception used. The
125 retained renderer/presentation samples were 115.028-120.004 FPS at 120 Hz,
59.998-60.004 FPS at fixed 60 Hz, 47.999-48.003 FPS at fixed 48 Hz,
59.669-60.002 FPS at low Retina, and 59.999-60.004 FPS at scale 1. Every ratio
was inside the strict 95%-108% gate. All 275 attached-Metal samples passed app,
display, child alignment, drawable scale, render health, input, corner,
surface-identity, presentation-driver, and frame-rate-policy checks. All 395
visual records passed; steady startup, overlay, duplicate-overlay, fullscreen,
and overlay-display-transition samples had zero blank, purple, chrome-cover,
flash, dropout, or right/bottom coverage failures. Short cover observations
occurred only inside intentional focus-away/minimize/fullscreen transition
streams and recovered within their bounded transition contracts. Three of
the 4,585 active-overlay transition frames reported a one-frame outer-right
lane diagnostic while ScreenCaptureKit rescaled the changing source (one each
at fixed 48 Hz, fixed 60 Hz, and scale-1 60 Hz). They were not coverage or
dropout failures: every coarse continuous-stream gate remained green, and all
six native-scale exact overlay captures in every profile passed both right and
bottom boundary checks (minimum changed ratios 0.934 and 0.961 respectively;
low-Retina bottom minimum 0.980). This is the intended contract split: the
fixed-output transition stream detects broad coverage/dropout continuously,
while unscaled native captures own exact one-pixel edge proof. Every crash
category remained zero. Cleanup closed the exact candidate, kept Steam alive,
removed the private launcher environment, and restored exact display mode 54
at 1728x1117 logical / 3456x2234 backing / 120 Hz. The retained private receipt
binds the candidate, summary, and manifest with SHA-256 fingerprints.
Do not repeat already-green commerce, long-duration checkout, or broad cases
until a relevant implementation surface changes or release-candidate identity
requires one final qualification pass.

### 2026-07-31 macOS unattended-console QA finding

The next unchanged-candidate macOS pass completed its first 23 cases and then
reported visual-helper failures. This was not a product, attached-child, Steam,
or persistent ScreenCaptureKit-session regression. The console lock timestamp
preceded the first failed capture, and unified logging showed ScreenCaptureKit
permission remained allowed while WindowServer rejected each screenshot after
the display entered the locked state. Repeated helper processes and a user-level
`replayd` restart could not make a locked console capturable and are not repair
paths.

The input helper now reports the current IOKit system-console lock state, fails
closed if that state is unavailable, and both controller and profile preflights
stop with `desktop_locked` before launching the game or changing a display mode.
A live locked-console probe exited with that exact code in 2.3 seconds. The
runner keeps one persistent visual-helper session; the temporary per-case
restart experiment was removed after the actual lock cause was established.
Any unattended wrapper must keep an independent, continuous `UserIsActive`
assertion for the complete run in addition to its display/system sleep
assertions; a short wake pulse does not prevent the configured automatic lock.
Release QA still never invokes lock, screen-sleep, or system-sleep transitions.
After one ordinary manual unlock, rerun only the three interrupted tail cases,
then run the one fresh full candidate pass if that focused tail is green.

### 2026-07-31 macOS high-refresh helper finding

Three unchanged-candidate 120 Hz `fps-overlay` attempts retained exact 120 FPS
renderer scheduling, stable focus and layer ownership, zero display-link skips,
and no crashes, but Chromium presentation feedback measured 111.0-113.7 FPS.
Hiding or temporarily pausing other Electron applications did not cross the
strict 114 FPS floor. The repeated `/usr/bin/swift` compilation used for every
input-helper focus and snapshot was the remaining measurement perturbation.

The actual-game driver now accepts an absolute precompiled input-helper binary.
After compiling the unchanged helper once with `swiftc -O`, two consecutive
strict runs passed without relaxing the 95% floor. The first measured 115.36,
115.03, and 114.35 FPS across baseline, overlay-active, and post-close phases;
the second measured approximately 115.7 FPS in all three phases. The pending
120 -> 60 -> 120 live-display transition then passed with exact child geometry,
input pairing, overlay coverage, cleanup, and display restoration. Use the
precompiled input helper for release cadence evidence; `.swift` source mode
remains available for non-performance diagnostics.

The faster executable also removed the compiler delay between the exact child
and parent-title pointer probes. One final-matrix baseline attempt consequently
hit a transient helper failure while returning to the title bar, even though
eight immediate direct child-to-title repetitions all proved the same attached
pair, exact target, and zero missing or mismatched samples. The consumer QA
driver now gives parent-title acquisition the same bounded five-second retry as
child acquisition; every attempt still has to satisfy the complete pair and
pointer proof. The focused `baseline-geometry` rerun passed against the
unchanged signed candidate before the full matrix resumed.

The first resumed final pass then exposed the same removed compiler delay in
`overlay-state-stress`: both title drags and the shrink transaction passed, but
an immediately spawned, separate expand transaction arrived before the resized
Electron/Metal pair had published a stable new state. It reproduced exactly in
the focused case, while the ordinary rapid resize-reversal case remained green.
One focused rerun passed after synchronizing only between shrink and expand, but
the next independent run showed the shrink itself could begin before the two
title transactions had settled. The overlay case therefore requires fresh
healthy active-overlay telemetry after the title pair and again after shrink,
under the same uninterrupted visual capture, before each distinct resize mouse
transaction. The later focused runs passed both exact resize deltas, returned
to the original frame, retained full overlay coverage, completed every later
window-state transition, restored the display, and recorded zero crashes.

### 2026-07-31 macOS active-overlay fullscreen alpha finding

The first active-overlay fullscreen endpoint captured a real product defect.
The attached Metal child had inherited the Linux active-host policy of clearing
its complete surface opaque black. That is safe behind the titled windowed
content shape, but application-owned simple fullscreen removes the titlebar and
makes the child cover the entire parent. Steam's translucent pixels then
composited against that child clear instead of the Chromium game below it. The
settled fullscreen frame was 86.5-86.7% black with mean luma about 0.020 even
though Steam UI edges remained visible, so the older generic nonblank gate had
incorrectly accepted a Steam-only black backbuffer.

The macOS child now treats requested opacity as effective only while the parent
still has a titlebar consuming frame. Native or application-owned full-frame
states keep the same attached child, input policy, texture, and presentation
clock but clear the Metal layer transparent. The child is never detached,
recreated, promoted to a popup, or replaced by a companion window. Returning to
a titled window restores the requested windowed opacity and the existing bottom
corner mask.

The actual-game contract now compares active-overlay fullscreen against the
active windowed frame and requires retained game-underlay luma and structure
plus bounded black growth. The old signed candidate failed this new gate with
the exact black signature. The rebuilt Developer-ID-signed, notarized, stapled,
and Gatekeeper-accepted stable-Electron-43.2.0 candidate passed two consecutive
focused `overlay-state-stress` receipts,
`focused-fixed-overlay-state-20` and `focused-fixed-overlay-state-21`. Their
settled fullscreen frames measured mean luma 0.084, black ratio 0.294/0.293,
edge density 0.010, exact opaque outer boundaries, and every underlay-retention
check green. Both runs also passed active move, separately synchronized resize,
maximize/restore, minimize/restore, focus away/back, fullscreen enter/exit,
same-child geometry, exact 3456x2234 drawable size at scale 2, roughly 120 FPS
Metal presentation against 120 Hz, rounded window restoration, display restore,
and zero app, Steam overlay, Steam-client, or graphics crashes.

The fullscreen transition stream initially reported windowed-overlay signature
dropout while every broad coverage and health check passed. Predicate-level
counters proved zero baseline-change dropout and zero width, height, right, or
bottom coverage failures; only baseline-proximity and overlay-signature tests
fired while the background deliberately changed from opaque black to alpha and
Steam reflowed its UI. The fullscreen-only transition contract now gates actual
baseline reversion and continuous coverage, while the native-resolution settled
capture owns the active overlay, game-underlay, and exact one-pixel boundary
proof. Ordinary windowed overlay transitions retain their strict zero-dropout
contract. Repeat only if this opacity/fullscreen path or one of those gates
changes; do not revive an always-opaque full-frame child or any popup/companion
architecture.

The exact repaired candidate then completed the fresh `final-06` release gate.
All 125/125 platform-case executions and all 37/37 canonical requirements
passed across native Retina 120/60/48 Hz, low-Retina 60 Hz, and scale-1 60 Hz.
The active-overlay state/fullscreen case passed in every profile with the same
attached child, visible game underlay, exact settled boundary proof, and clean
titled-window restoration. All 125 pacing samples passed the unchanged
95%-108% gate, no known exception was used, every app/Steam-overlay/Steam/
graphics crash count was zero, the exact app closed, Steam remained alive, and
display mode 54 (1728x1117 logical, 3456x2234 backing, 120 Hz) restored exactly.
The signed candidate bundle SHA-256 is
`c1fc8a911a3b7a39c7b0f8645b5c69efeabcd4c3b4295a2b093f219c2ddd6fd1`;
the repaired native addon SHA-256 is
`5ac1743e979a0064078fa8bdafa04249d1ca126d4be753630a8773e46da4d266`.

An earlier fresh matrix stopped at one 112.045/120 FPS presentation sample
(93.4%) while renderer cadence remained 120 FPS, presentation identity stayed
stable, and the macOS trace recorded zero display-link skips. The exact
display-transition -> baseline sequence then passed twice independently at
120.000 and 116.344 FPS, and the unchanged candidate passed that same sequence
inside `final-06`. The acceptance floor was not weakened and no product retry
was added; the failed sample remains retained as isolated variance rather than
being rewritten as a pass.

macOS qualification, both physical Steam Deck modes, and the Windows final pass
are complete at the stable-43.2.0 checkpoints in this document. No physical
non-Deck Linux host is configured, so that lane remains explicitly
environment-unavailable rather than green. The configured physical-platform
qualification is complete; release preparation is a separate, explicit next
step.
During the 2026-07-28 Deck Desktop focused pass, the exact Electron 43.2.0
native-pixmap metadata exposed modifier `0`; Linux defines that value as the
linear modifier, but the Bridge accepted only Chromium's unspecified-modifier
sentinels. That rejection left the native host continuously presenting a
retained frame while page rAF still reported 90 FPS. The unreleased repair
accepts linear modifier zero without broadening support to tiled/vendor
modifiers. Its Deck-native Rust build passes the Linux unit test, and the live
Steam-launched actual game now reports 89-91 shared-texture imports per second,
the `x11-dri3-glx-texture-from-pixmap` backend, continuously increasing import
counts, zero import failures, and 90 FPS native presentation. The ordinary
Friends overlay retains that imported frame at 90 FPS; Escape closes it and
live imports resume at 90 FPS. The rebuilt exact candidate then passed the
complete Desktop sequence: 1280x718 maximized, 1280x800 fullscreen, exact
640x480 minimum, five-step direction-reversing compositor move/resize stress,
maximize/restore, minimize at 1 FPS and restore at 90 FPS, Alt+Tab focus return,
the same transitions while the overlay was active, duplicate-open suppression,
post-overlay 90 FPS import recovery, one application host, zero import failures,
zero presentation errors, and no crash during the product test window. The
normal-runner cleanup initially reused a stale session-specific `XAUTHORITY`
override and failed before opening X11; removing that override and inheriting
Steam's live session environment produced one clean host with CDP disabled.
Never persist a generated X11 authorization filename in a reusable runner.

### 2026-07-30 Deck shutdown and exact-candidate requalification

The exact stable-Electron configured-product candidate now passes both Steam
Deck Game Mode and Plasma Desktop Mode after two narrowly owned Steam Bridge
shutdown repairs. X11 can deliver `WM_DELETE_WINDOW` and `DestroyNotify` in one
native pump. The JavaScript session previously threw the terminal drawable
error before draining the already-captured `close` input, which could leave the
hidden renderer alive. It now dispatches captured input before rethrowing the
terminal pump error. Separately, native shutdown called Steam's deprecated
post-API-result removal virtual method even when no such hook had ever been
registered. That empty cleanup reached `__cxa_pure_virtual` inside the live Deck
Steam client. Empty process-hook cleanup is now a no-op on Linux; exact and
stale registration IDs retain their prior ownership rules. macOS and Windows
retain the empty-state SDK reset required by their process-global callback
state. A focused macOS regression proved that applying the Linux no-op cross-
platform can terminate the process at first overlay activation, while the
platform-specific split preserves that activation.

The repaired Linux addon passed its focused Rust unit test, the complete 350-
test Steam Bridge gate, and live configured-product shutdown. File -> Exit,
`SIGTERM`, and a compositor-native close all reached the complete ordered Steam
shutdown lifecycle, left no app process, kept Steam alive, and warm-relaunched
through Steam. The compositor close is also live proof that the queued close
event survives a same-pump native drawable teardown.

Game Mode passed the full current-product lane on the unchanged packaged
candidate: exact 1280x800/DPR-1 game surface, hidden cursor, native input,
ordinary overlay open plus duplicate suppression, native Escape close, 90 FPS
while active and after close against the Deck's 90 Hz display, all four shipped
non-spending inventory checkout entry/cancel routes, clean shutdown, and warm
relaunch. The earlier state-driven Gamescope capture remains the pixel authority
for upright orientation, full coverage, and absence of bars/crop; the shutdown-
only native delta did not touch GLX sampling or presentation geometry.

Plasma Desktop Mode then passed the complete focused-to-exhaustive sequence:
1280x718 maximized client with the 26-DIP menu, exact 1280x800 fullscreen,
exact 640x480 minimum client, five-step direction-reversing compositor
move/resize stress, maximize/restore, minimize at 1 FPS and restore at 90 FPS,
Alt+Tab focus loss/return, physical File/Edit/View clicks, cursor visible over
the menu and hidden again over the game, and the same geometry, fullscreen,
maximize, minimize, focus, and cadence transitions while Steam remained active.
Native Escape closed Steam, post-close cadence returned to 90 FPS, the final
ordered five-case CDP lane passed, compositor close shut down cleanly, and the
fresh Steam-owned process returned to the live game. This Deck panel advertises
only one 1280x800@90 mode and scale 1 in Plasma X11; no unsupported display mode
or synthetic profile was manufactured.

Steam CEF remote debugging remains invalid Game Mode evidence, and failed
remote non-Steam launch forms remain closed paths. Restore the product's normal
launch options and non-CDP runner after qualification. These source changes are
newer than published `v0.3.9`; any publication requires a new immutable version
and fresh release-candidate artifacts.

### 2026-07-28 stable-43.2.0 final-candidate checkpoint

The current releasable macOS app is the signed, notarized, and stapled stable
Electron 43.2.0 bundle at
`/Users/jeromystroh/fov4-steam/dist/mac/mac-arm64/Fantasy Online 2.app`. Its
product source is FOV4 `2372f1e` with Steam Bridge `5885d35`; subsequent FOV4
commits through `d52f994` are documentation/client-contract work and do not
mutate that packaged candidate. The focused actual-game and baseline receipt at
`/Users/jeromystroh/.codex-qa/receipts/macos-focused-actual-game-b88fbce-08`
is green. The known Chromium post-restore half-rate signature remains the one
explicit product-owner exception described below; every other release gate
remains strict.

The first final-pass root at
`/Users/jeromystroh/.codex-qa/receipts/macos-final-b88fbce-02` retained a clean,
aligned, full-coverage child/parent composite while exposing a macOS synthetic
input limitation: in two consecutive, separately synthesized opposing title
drags, AppKit intermittently accepted either the first or second mouse-down but
not both. The same instability reproduced while the target app, frontmost app,
focused window, attached child, and pointer cleanup remained healthy. Retrying
after `NSEvent.doubleClickInterval`, reactivating/raising the same window, and a
combined `drag-reversal` command merely changed which leg was ignored. Those
unproven retry/reversal experiments and their temporary diagnostics are
removed. Do not change, retarget, recreate, detach, or promote the child to work
around a QA event-injection failure.

The independently proven slow-title-drag repair remains: use one login-session
`CGEventSource`, allow the existing bounded mouse-down latch interval, and make
the first timed title movement cross an eight-point AppKit/WindowServer drag
hysteresis before continuing at the requested cadence. Exact focused receipt
`/Users/jeromystroh/.codex-qa/receipts/macos-focused-title-drag-slow-working-14`
observed the requested `140x70` movement across 73 healthy pair samples with
pointer restoration and clean shutdown. Steam Bridge unit tests and macOS
Swift typechecking cover the retained minimal helper delta.

Treat consecutive synthetic reversal as an instrumentation limitation, not a
green product result and not a reason to rerun already-settled product cases.
Continue the still-unproven exact-candidate cases first. Before release, satisfy
the unchanged direction-reversal product gate with a reliable one-held-drag
input source or other independent evidence; never silently skip it, turn zero
movement into a pass, or ask the product owner for recurring manual input.

Focused exact-candidate receipt
`macos-focused-geometry-stable-01` passed right, bottom, and corner resize plus
the exact `640x480` content minimum. Its fast title drag was the only red case:
the helper's conditional primer allowed that 80 ms gesture to begin with a
roughly 14-point movement instead of the proven eight-point latch. The final
helper now gives every nonzero title drag the same exact eight-point first
movement while retaining total duration, steps, and final delta. Focused receipt
`macos-focused-title-fast-stable-02` then passed exact `100x55` movement, nine
healthy pair samples, exact restoration, visual health, pointer cleanup, and
zero crashes. The slow path's emitted movement is unchanged and retains its
earlier exact `140x70` proof.

Focused receipt `macos-focused-px-interaction-stable-03` passed menu input,
semantic game-surface input, focus round trip, minimize/restore, hide/restore,
simple-fullscreen, ordinary Steam overlay open/close, and overlay FPS. Its
overlay-state stress completed healthy overlay/child/visual work but failed
only when the second of two separately synthesized opposing title drags was
ignored, matching `MAC-QA-SYNTHETIC-TITLE-REVERSAL-001`; do not rerun the eight
green cases. Fixed-60 receipt `macos-focused-display60-stable-04` passed
baseline, FPS, and zoom/restore, while `display-live-transition` failed at the
input-helper boundary. The isolated `macos-focused-display-live60-stable-05`
repeat failed at the same boundary with green cleanup. This remains part of the
synthetic input blocker rather than a product-child repair lane.

The independent display/recovery receipts are green: fixed-48 baseline/FPS at
`macos-focused-display48-stable-06`; scale-1 baseline, semantic input, and
zoom/restore at `macos-focused-scale1-stable-09`; and warm relaunch plus forced
GPU-process recovery at `macos-focused-recovery-stable-10`. Every run restored
the original display configuration, closed the candidate, retained Steam, and
reported zero app/overlay/Steam/graphics crashes.

Low-Retina mode is separately blocked in the automation layer. Receipt
`macos-focused-low-retina-stable-07` reached the actual game and passed
zoom/restore, but the synthetic pointer reached the calculated attached-child
rectangle while Chromium received zero trusted pointer/mouse events; baseline
therefore reported `cursor_visible` and base input reported
`gesture_mismatch`. Receipt `macos-focused-low-retina-input-stable-08`
reproduced the same zero-event input result with exact cleanup and display
restoration. The long-lived ScreenCaptureKit `session` process observed during
both runs was the harness's intentional persistent capture helper, not an
orphan or timeout; the speculative process-group change based on that mistaken
diagnosis was reverted. A login-session pointer event source did not change the
input result and was also removed. A subsequent `NSWindow.windowNumber(at:)`
probe was invalid by construction: ordinary game input keeps the Metal child
in passthrough with `ignoresMouseEvents = YES`, so AppKit correctly resolves
the mouse-down target below the child. It failed identically in low-Retina
receipt `macos-focused-low-retina-hit-test-12` and normal-scale control
`macos-focused-max-hit-test-13`; the probe and its assertions were removed.
Only overlay-active click cases may require the child itself to win AppKit hit
testing. Because the otherwise distinct scale-1 profile passes the same
semantic input/cursor contract, do not reinterpret this as evidence for
changing the product child.

The attempted final root `macos-final-stable-43-2-0-19bba4a-15` was invalid,
not a product regression. After Steam had been restarted, the exact packaged
candidate passed cold launch and the actual production game/WebGL gate, but
the configured append-only app log received no records from that launch.
`baseline-geometry` and `warm-relaunch` consequently timed out as
`fps_unavailable` with empty native telemetry. The run was terminated, the
exact candidate was closed, and an independent live inventory proved the Mac
returned to its saved 3456x2234/120 Hz mode. The product candidate was not
changed. FOV4 now requires a fresh, structurally valid
`[steam-attached-host-fps]` record after launch and before the first profile
case; failure is the distinct `telemetry_unavailable` precondition. Never run
or diagnose the remaining matrix against a stale log.

With Steam relaunched through the documented append-only QA log, focused root
`macos-focused-fresh-telemetry-16` passed the fresh-marker gate, actual game,
120 Hz baseline FPS, cleanup, and exact display restoration. Exhaustive final
root `macos-final-stable-43-2-0-dc8bb13-17` then executed all 25 selected cases
under all five required display profiles. It passed 124/125 profile-case
executions, all five cleanup/display restorations, exact candidate recheck,
Steam continuity, and zero app, overlay, Steam, or graphics crashes. In
particular, title reversal passed under every profile and low-Retina passed
cursor/baseline, semantic input, display transitions, drag/resize, state,
overlay, and FPS coverage; the two prior synthetic blockers are closed.

The only final-root red was max-refresh `fps-baseline`: renderer scheduling was
120 FPS, Chromium presentation feedback was 119.668 FPS with no drops or trace
loss, but the app lost foreground focus after measurement. The same case had
already passed in focused root `macos-focused-fresh-telemetry-16`, and exact
sequence retest `macos-focused-max-transition-fps-18` passed live display
transition, pacing transition, max-refresh FPS, cleanup, and restoration.
Per the focused-retest policy, do not rerun the other 124 green executions.
macOS release-candidate evidence is complete as the exhaustive root plus this
one exact supplemental closure receipt.

### 2026-07-28 RC85 actual-game checkpoint

The current exact signed, notarized, stapled, and Gatekeeper-accepted app is
RC85 at
`/private/tmp/fov4-macos-rc-browser-display-link-85/output/mac-arm64/Fantasy Online 2.app`.
Its sorted-tree fingerprint is
`826a3605dae51ca40f413f7f7d5868bafe5253b333853c031dc8074e2639d73b`
(607 entries, 352338184 bytes). Focused receipt
`/private/tmp/fov4-macos-qa-rc85-low-retina-simple-fullscreen-01` is green for
the application-owned simple-fullscreen repair, semantic maximized-state
restoration, exact work-area recovery, renderer focus, candidate cleanup,
Steam survival, display restoration, and zero crashes.

The prior complete RC82 actual-game attempt passed 119/125 executions. Every
low-Retina baseline, trusted-input, minimum-size, and simple-fullscreen failure
is now individually closed. The remaining scale-1 `display-live-transition`
failure was also a harness defect, not an AppKit or attached-child regression:
after entering the 1168x730 low-Retina mode, the driver reused the scale-1
baseline origin and placed a 900x600 frame at `(360,270)`. Its bottom-right
corner `(1260,870)` was outside the live desktop. Title dragging remained
reachable while every corner drag correctly produced no resize. A one-run
diagnostic sweep across offsets -8, -4, -1, 0, 1, 4, and 8 confirmed that no
offset could make an off-screen target reachable; child/parent pairing,
pointer cleanup, candidate cleanup, display restoration, Steam survival, and
zero crashes remained green.

FOV4 commit `694636d` makes gesture staging optionally consume the temporary
mode's logical dimensions and reserves the contract's full 140-point right and
70-point downward travel. The corrected live-transition frame is
`(128,60,900,600)`. External driver hash
`6d7731ba32c009bb50c61a6d1a6758e9daf2f97e4e9c3e9feec1976b8ddc5c17`
passed the complete focused case at
`/private/tmp/fov4-macos-qa-rc85-scale1-display-live-clamp-01`: physical title
move and corner resize, passive and active scale transitions, exact child
alignment, visual health, target-rate presentation, cleanup, exact desktop
restoration, Steam survival, and all crash categories passed. RC85 itself was
unchanged. Do not add an AppKit resize workaround, retarget the child, or retry
more edge offsets for this settled harness error.

The final scale-1 `overlay-state-stress` failure is individually closed. A
privacy-bounded capture-source extension proved that the long-lived
ScreenCaptureKit session kept the same parent: it measured `1280x752` before
the case and the expected `1920x1170` AppKit work-area frame after the exact
zoom action. The app telemetry independently recorded the native animated
zoom, `maximized=true`, exact child/content alignment, and subsequent exact
restore. The red result was a QA ownership error: the harness required restored
window corners while the parent intentionally occupied the square screen work
area. The visual contract now gives maximized windows a distinct gate requiring
healthy native chrome, square bottom corners, and an opaque screen boundary;
restored windows still require rounded-corner proof. The helper publishes only
bounded frame/filter dimensions and point-pixel scale, never a window ID,
title, pixels, or account data.

Focused receipt
`/private/tmp/fov4-macos-qa-rc85-scale1-overlay-max-contract-05` passed the
complete affected path on unchanged RC85: physical move/resize, zoom and exact
restore, minimize/restore, focus transitions, simple-fullscreen transitions,
continuous active-overlay visual coverage, exact child alignment, cleanup,
desktop restoration, Steam survival, and zero app/overlay/Steam/graphics
crashes. Final consolidation attempt 02 then exposed the complementary native
shape at 2x Retina: AppKit's zoomed standard frame remained inset and rounded
(`roundedCornerScore=0.100`, `bottomEdgeOpaqueRatio=0.994`) rather than becoming
the square work-area boundary seen at scale 1. Apple defines zoom in terms of a
screen-dependent standard frame, so neither shape alone is universal. The
maximized contract now requires one coherent native boundary—rounded or
square—and rejects mixed corner/seam states. Restored windows remain strictly
rounded. Focused-retest the same overlay-state case at max-Hz Retina and scale
1 next; do not treat consolidation attempt 02 as release evidence or start a
new full pass before both shapes are green.

The same diagnostic attempt then reproduced the separately tracked Chromium
post-restore half-rate defect in the fixed-60 profile. After the exact
120 -> 60 -> 120 -> 60 sequence, renderer rAF and PID-pinned presentation
feedback were both exactly 30 FPS while the unchanged attached Metal child
remained healthy at 60 FPS. The transition trace recorded 110 skipped browser
display-link callbacks and preference factors ending in factor two. This
proves the newly added immediate one-DIP move-and-restore pair was not a valid
repair: its compensating event allowed Chromium to return to the stale
factor-two preference. Exact signed/notarized/stapled RC86 then tested the
remaining single one-DIP move on only the reduced warm-relaunch/pacing/baseline
prefix. It failed identically: factors `[1,1,1,1,1,2,1,2]`, 102 skipped
callbacks during the transition, 91/91 skipped post-restore callbacks, and
exact 30 FPS through the independent baseline while Metal remained healthy at
60. Synthetic renderer input is now a closed product path.

RC87 tested an app-owned startup disable for `UseFrameIntervalDecider` while
retaining the browser-only CADisplayLink. Focused attempt 01 passed at exact 60
FPS, but the identical attempt 02 failed at exact 30 FPS with preference
factors `[1,1,1,2]`, 103 skipped callbacks during the transition, and 90/91
callbacks skipped after restore. Live process inspection proved the switch was
present in the renderer, so attempt 01 was a nondeterministic false green.
Chromium 150.0.7871.129 source supplies the decisive explanation: its
`FrameIntervalDecider` is unconditional and that release no longer declares a
controllable `UseFrameIntervalDecider` feature. The switch is therefore a
closed path, not a repair.

RC88 tested the remaining optional desktop matcher by disabling
`SingleVideoFrameRateThrottling` before readiness. Exact signed, notarized,
stapled focused receipt
`/private/tmp/fov4-macos-qa-rc88-single-video-pacing-01` failed identically:
the transition and following independent baseline were both exactly 30 FPS.
Its retained trace recorded 1,286 display-link callbacks, 108 skipped-vsync
events, and preferred factors `[1,1,1,2]`; the post-restore and baseline probes
skipped essentially every other callback. Cleanup restored mode 54/120 Hz,
Steam survived, and all crash categories remained zero. The matcher override
is a closed path and has been removed from FOV4.

Chromium 150 source matches the trace: `ExternalBeginFrameSourceMac` stores and
applies `vsync_subsampling_factor_` on every callback, while its same-display
handler recreates the source only if the existing display link reports itself
invalid. This link remained valid. M150 resolves a zero preference by querying
the new hardware interval while its cached minimum can still represent the
prior mode, allowing factor two to be calculated and retained. Another renderer
cadence feature flag is therefore not a justified next candidate.

Chromium commit `b43494c23fc0af79df367767396e3e216bd91e97`, present in M152,
changes this exact browser-display-link path to use the last known cached
minimum for a zero preference instead of an ahead-of-callback hardware query.
Exact signed/notarized/stapled RC89 fingerprint
`cb1d53b7631ba74444b0d06eaac6d905351e5be91acdbb5894620d4b3a4c5b98`
tested that change with test-only Electron `44.0.0-alpha.7` / Chromium
152.0.7969.0. Focused receipts
`/private/tmp/fov4-macos-qa-rc89-electron44-pacing-01` and
`/private/tmp/fov4-macos-qa-rc89-electron44-pacing-02` both passed the exact
reduced prefix. Their transition traces retained factors `[1,1]` with zero
skipped display-link callbacks, restored renderer samples stayed approximately
60 FPS, and presentation feedback measured 59.334 and 57.693 FPS. Both restored
exact mode 54/120 Hz, kept Steam alive, and recorded zero crashes. This
repeatable A/B result validates the M152 repair while preserving Steam Bridge's
browser-only CADisplayLink ownership.

Electron 44 alpha was a historical isolation dependency only. Do not run or
ship alpha, beta, nightly, or any other prerelease Electron again. FOV4 has
returned to stable Electron 43.2.0. Chromium commit
`b43494c23fc0af79df367767396e3e216bd91e97` remains the upstream repair, but
the product owner explicitly accepted the isolated Chromium post-refresh
cadence defect for the current release instead of waiting indefinitely. FOV4's
schema-v2 final lane permits one explicit
`--allow-known-upstream-cadence-defect` exception only for stable Electron
43.2.0, `display-pacing-transition`, `fps_below_display_rate`, the retained
factor-two/skipped-vsync trace signature, exact focus, and full-rate healthy
native Metal presentation. The receipt exposes every accepted profile and the
exact upstream commit. All other pacing, geometry, input, overlay, crash, and
cleanup gates remain strict. A registry check on
2026-07-28 found 43.2.0 as
the latest stable, 44.0.0-alpha.7 as the only Electron 44 prerelease, and no
44.0.0-beta.1 package yet; the official schedule targets Electron 44 stable for
[2026-08-25](https://releases.electronjs.org/schedule).
The same-day Chromium M150 branch head
`4c63958ce6b907e866b393485a34ee97e3f479f1` still makes the stale hardware
query in `SetPreferredInterval` and `GetSupportedFrameIntervals`, so no current
Electron 43-compatible Chromium backport exists.

FOV4 now owns a durable `--promotion-gate` mode instead of relying on an
ignored RC-number-specific focused wrapper. It hard-selects the exact
`warm-relaunch` / `display-pacing-transition` / `fps-baseline` prefix at the
same-resolution fixed-60 profile, requires the shipped App ID and 95% cadence
floor, rejects ad-hoc cases/profiles, and applies final-mode Developer ID,
hardened-runtime, Gatekeeper, notarization, and stapled-ticket verification in
both controller and isolated profile processes. The executable gate now reads
`CFBundleVersion` from the signed Electron Framework and accepts only stable
Electron. Alpha, beta, nightly, every other prerelease, missing, and malformed
versions fail before display mutation or Steam/game launch in every live QA
mode. `--qualification-gate` remains only so historical receipts can be
interpreted; it now uses the same unconditional stable-Electron preflight and
cannot authorize another prerelease run or a release. The historical RC80 controller
is explicitly non-reusable; HID inactivity is no longer authorization and
lock-capable sleep remains permanently outside QA and release.

Live gate receipt `/private/tmp/fov4-macos-qa-rc89-promotion-gate-02` passed on
the already-qualified test-only RC89 bundle and self-identifies as
`run.mode=promotion`. It recorded 60.006/59.994/59.962 FPS renderer samples and
59.669 FPS PID-pinned presentation feedback after restore, approximately 60 FPS
through the following independent baseline, exact display restoration, Steam
survival, and zero crashes. This qualifies the cadence implementation only; it
does not promote Electron 44 alpha to a release dependency. That receipt
predates the executable channel split and retains its historical mode label.

Focused preflight receipt
`/private/tmp/fov4-macos-qa-rc89-promotion-dependency-reject-03` proves the
hardened release boundary against unchanged RC89. It binds bundle SHA-256
`cb1d53b7631ba74444b0d06eaac6d905351e5be91acdbb5894620d4b3a4c5b98`
to Electron `44.0.0-alpha.7`, records channel `alpha` and
`electronAcceptableForRelease=false`, then fails
`candidate_dependency_prerelease`. Steam remained healthy and the driver never
reached display mutation or game launch.

The affected current qualification lane then passed live on unchanged RC89 at
`/private/tmp/fov4-macos-qa-rc89-qualification-gate-01`. Its canonical receipt
labels the run `qualification`, retains the exact RC89 bundle hash, classifies
Electron `44.0.0-alpha.7` as `alpha` and non-releasable, and closes every
selected case. Post-restore renderer samples measured 60.000/60.002/59.984 FPS;
PID-pinned Chromium presentation measured 58.343 FPS (97.2% of fixed 60 Hz).
The following baseline remained approximately 60 FPS with the same 58.343 FPS
presentation result. All crash categories stayed zero, the exact candidate
closed, Steam survived, and the original 120 Hz display configuration restored
exactly. This is historical causal evidence only, not release eligibility, and
cannot authorize another prerelease run.
The retained owner-executable wrapper SHA-256 is
`acff87ed2bf1ff9224f1b5db12fe92e7a421ed4887252ccf350fdd70c5b0c7cf`;
it pins driver SHA-256
`b21253d6af7a42b57c51aa1533e6aca2ccaacd48184b96d5db1a392c95848225`
and visual-contract SHA-256
`0843430d0484c75419dae63570cd1f6eac872605a13e3852a8384bafd08f28e4`.

The focused controller also corrected a proof-integrity defect by hashing the
exact fixed-name visual-contract module imported by the driver, rather than an
unused hash-named copy. After the fixed-60 pacing prefix and the two affected
zoom-shape cases are green on the new exact candidate, run one complete
25-case/five-profile actual-game pass and then the pinned 55-route matrix on
that same candidate. Do not rerun unrelated focused cases.

Mac pacing has three deliberately separate signals. CoreGraphics supplies the
nominal selected display rate. Renderer-PID-pinned Chromium `PipelineReporter`
presentation feedback is the primary actual-game surface gate, bracketed by
untraced rAF samples so trace perturbation above 5% fails closed. Metal
drawable-presented callbacks are authoritative for the attached child.
ScreenCaptureKit is visual-only and cannot prove cadence. Its persistent
fixed-output stream must preserve source aspect ratio, crop analysis to each
frame's reported `contentRect`, and measure unhealthy/dropout runs from
WindowServer's `displayTime`; helper callback wall time includes analysis or
scheduling latency and is not visible-duration evidence. MTKView's timed loop
is the attached child's sole presentation clock while the parent can present;
JavaScript pumps only lifecycle, geometry, callbacks, and bounded diagnostics.
The same view pauses while its child or parent is hidden, the parent is
miniaturized, or the application is hidden, then resumes without surface
recreation. The child's configured active/passive policy must be checked at
every display phase, but changing, repainting, pausing, or recreating that
child is not a remedy for Chromium renderer cadence. Fixed-rate release samples
must remain between 95% and 108% of nominal so duplicate clocks or silent timer
starvation cannot pass.

RC40 receipt `/private/tmp/fov4-macos-qa-rc40-focused-44` first exposed the
120 -> 60 -> 120 defect. Its restored Chromium surface initially presented at
60.995 FPS with 177 of 362 attempted frames dropped and later recovered only
to 95.139 FPS, below the 114 FPS release floor. RC40 also showed an unhealthy
child rate and therefore motivated AppKit display-notification handling, but
the later isolated sequence below supersedes the original inference that the
child caused the Chromium slowdown. Keep the notification handling needed to
reapply the existing MTKView policy, but do not use child-clock changes as a
renderer workaround.

### 2026-07-26 macOS refresh-transition causal checkpoint

The refresh-transition investigation is now causally isolated, but the exact
actual-game release candidate is not yet qualified. Receipt 59 kept the
passive child synchronized with the selected display and still restored the
renderer at roughly 96-99 FPS. Receipt 61 issued every requested Electron
repaint and still restored at roughly 94-96 scheduler FPS. Receipt 64 stopped
the child completely throughout the transition, preserving the same attached
surface with zero child draws, presents, or errors, and the renderer still
restored at 89-93 scheduler FPS. These controls exonerate the attached child;
repaint and child pause/reconfiguration are closed workaround paths.

A minimal Electron 43.2.0 application with no Steam, Steam Bridge, native
child, or game reproduced the defect in receipt 68: scheduler cadence moved
from 120 to 60 and restored around 90 FPS. Receipt 69 added Chromium
`gpu`/`viz` tracing and pinned the loss to the same persistent
`ExternalBeginFrameSourceMac` begin-frame display link: callbacks changed from
120.003 to 59.997 to 94.325 FPS after restore, with the restored stream missing
roughly every fourth callback. Receipt 70 reproduced the same behavior with
Electron 44.0.0-alpha.6 / Chromium 152, so an Electron upgrade is not a fix.
Receipt 71 reproduced it when the CoreGraphics mode change used session scope,
so application-scoped display transactions are not the cause. Receipt 72 is an
invalid infrastructure artifact: the runner loaded the wrong analysis module
and failed before any display change; it carries no product evidence.

The applicable Chromium 150 experiment is its exact browser-only field-trial
arm:

```text
--enable-features=CADisplayLinkInBrowser
--disable-features=CADisplayLinkInGpuThenBrowser
```

With that arm, receipt 73 held a stable, visible, exactly focused Electron 43
renderer at 120 -> 60 -> 120 scheduler cadence, while the persistent external
begin-frame callback held 119.999 -> 60.002 -> 120.001 FPS. Receipt 75 fully
covered the control window behind another window and deliberately kept both
window and renderer unfocused; it still held roughly 120 -> 60 -> 120 for both
scheduler and external begin-frame callbacks, with one renderer identity and
exact display restoration. Backgrounding was therefore not the original cause.
Both controls are causally green even though their generic summaries say
`fail`: a light CSS animation is not expected to submit a physical frame every
vsync, so the actual-game 95% `PipelineReporter` gate is inapplicable to these
minimal controls and remains unchanged for release QA.

Chromium hard-gates browser-side `CADisplayLink` support to macOS 14 or newer.
The working candidate must merge the two startup feature lists before Electron
readiness only on that supported OS range and must preserve explicit
`CADisplayLinkInGpuThenBrowser` disablement. Do not try the GPU-then-browser arm:
upstream abandoned it after random post-power-resume hangs and a sleep/wake
unresponsive-UI regression. A hidden Electron offscreen renderer feeding an
IOSurface-backed attached child remains a contingency only, not the selected
repair. Before any release claim, complete focused actual-game mode-transition,
cold/warm startup, and GPU-process failure/recovery cases, then the full Mac
actual-game and 55-route gates on one exact signed, notarized, stapled
candidate. Lock-capable display/full-system sleep tests are excluded below.

### 2026-07-27 RC77 actual-game checkpoint

RC77 is the first exact actual-game candidate containing the selected policy.
Its immutable app root is
`/private/tmp/fov4-macos-rc-browser-display-link-77/output/mac-arm64/Fantasy Online 2.app`
and its sorted-tree fingerprint is
`74566f3c33cbe87d85a8069a5c65cc212a1b5f1c03ca9b56a3ab2ba5695f9bd4`
(607 entries, 352274998 bytes). Deep strict code-signing, Developer-ID team and
timestamp checks, Gatekeeper, notarization, and stapler validation all passed.
The retained Bridge and FOV source-archive hashes are respectively
`f759acf7368b055ded45a98ca1ffb9bf7c938216826b182182c8efd92ecf5a91`
and `3e538c4d08838f576bc5162aa9de556f7c500a171e27a5079dd52bc9d57ea397`;
the packed Bridge tarball hash is
`395a4b314579fb170a90dcd00e7684a38266e160712d2a4ffcdf673fc0ba8e8e`.

Steam Bridge now exposes an explicit `enableMacosBrowserDisplayLink` Electron
startup option. It defaults off, is eligible only on Darwin with macOS 14+ and
Chromium 150+, merges the browser-only enable and GPU-then-browser disable
before readiness, makes identical repeated configuration idempotent, and
rejects a conflicting locked decision. FOV4 alone opts in on Darwin before
readiness. Live exact-process inspection proved the expected enable/disable on
the candidate's GPU, utility, and renderer children and proved neither feature
was embedded in the Steam shortcut. Do not move this app-specific rollout into
a global Steam launcher or silently enable it for every Bridge consumer.

The first focused receipt,
`/private/tmp/fov4-macos-qa-rc77-app-optin-pacing-01`, proved warm relaunch,
120 -> 60 -> 120 transition recovery, and canonical overlay pacing. Restored
scheduler samples were 119.501/119.667/119.663 FPS with 119.670 FPS Chromium
presentation feedback; overlay-active presentation feedback was 120.001 FPS.
Its one red row was a verifier ownership defect: the lifecycle duplicate check
reapplied a 95% fixed-rate gate to a static ProMotion overlay that continued to
advance on the exact same healthy child at roughly 76-80 presents per second.
The `fps-overlay` case exclusively owns cadence against display Hz. Overlay
lifecycle owns attachment, geometry, policy, forward presentation progress,
callbacks, visual continuity, and error counters, but not a second fixed-rate
threshold.

The corrected driver is retained independently of the immutable app with hash
`c47901f5581cb77fad7fe0b9b7649455277daeb881db616a30f8481c8db7be61`.
Its focused rerun at
`/private/tmp/fov4-macos-qa-rc77-overlay-lifecycle-harness-c479-02` passed open,
duplicate suppression, Escape close, exact active/inactive callbacks, the same
attached child, 187 continuous visual frames, passive restoration, cleanup,
Steam survival, exact display restoration, and zero crashes. Focused preflight
now always actually runs stapler validation instead of recording an unchecked
ticket as false.

The first transactional shortcut bind encountered a real Steam self-update
handoff after Steam had been stopped and the VDF had been changed. That attempt
is intentionally retained as failed; it was not relabeled. Steam's updater
descendants later completed and left the live shortcut exactly bound to RC77.
The verified recovery receipt is
`/private/tmp/fov4-macos-rc-browser-display-link-77/shortcut-binding-02-post-update-recovery/summary.json`;
the timestamped rollback backup still exactly names RC76. Future binders must
treat the updater's process handoff as a distinct recovery state and verify the
post-update live VDF plus a healthy Steam instance rather than assuming the
first relaunch PID remains Steam. Repeated blind restarts or claiming the
interrupted transaction passed are closed operational paths.

The unchanged RC77 native-Spaces diagnostic subsequently passed at
`/private/tmp/fov4-macos-qa-rc77-native-spaces-harness-c479-03`: both
transitions retained the same attached child, exact restored `1280x720`
content geometry and corners, 340 transition frames contained no unavailable,
blank, purple, chrome-covering, or full-window flash, and cleanup found no
crash. Do not rerun this unchanged case during repair.

Two focused RC77 recovery cases found real defects. Killing only Chromium's GPU
child reinitialized Chromium in 118 ms, but PX correctly treated
`graphics_context_lost` as terminal because its WebGL resources were invalid.
The owner is FOV4's shell: perform one cooldown-bounded page reload and obtain a
fresh Steam auth ticket automatically; never attempt to reuse the lost PX
context. The recovery marker may retain only bounded character-slot and server
routing integers needed to return to the same game; it must never retain a
name, character ID, Steam/account/user ID, auth ticket, or native response. The
replacement GPU case must prove the automatic reload and production canvas
without clicking Play. Display sleep woke and recovered the exact app and child
at approximately 120 Hz, but RC77 kept drawing while the target display was
asleep and accumulated unpresented drawables. Steam Bridge now checks the
target CoreGraphics display's asleep state and pauses the existing MTKView; it
does not detach, recreate, or replace the child.

The first full-power sleep attempt was interrupted because an operator was
actively using the Mac. It is invalid infrastructure evidence and says nothing
about product correctness. A later RC80 display-sleep attempt invoked macOS's
security lock screen and required the operator to unlock the computer manually.
That case also failed without sleep/wake/restore evidence. `display-sleep-wake`
and `power-sleep-wake` are therefore permanently retired from executable QA and
the release gate; full-system sleep was not attempted. The CLI rejects both
names, the old acknowledgement flag is gone, and the external power controller
is a refusal-only tombstone. Never sleep or lock a computer for this QA.

RC80 below is the new exact candidate containing the shell GPU recovery and
native display-asleep pause fixes. Retest only the affected safe focused cases, but
do not bind Steam, launch/focus the app, or run any live desktop case while an
operator is using the Mac. Do not schedule either retired sleep case.
After all individual cases are green, run the one complete actual-game suite
and one final 55-route suite on the same exact candidate; do not publish from
the current checkpoint.

### 2026-07-27 RC78/RC79/RC80 recovery-candidate checkpoint

RC78 was signed and notarized but rejected before any launch. Review found that
a plain renderer reload returns the React shell to its character list, so its
first automatic GPU-recovery implementation could not reach the game by
itself. Do not bind, launch, qualify, or publish RC78; its only value is a
pre-live review finding.

RC79 corrected that basic flow. Only after the exact `graphics_context_lost` fatal does
the session marker retain the selected character slot (0-3) and server (0-5).
After reload the shell consumes that one-shot route, resolves the character
again from freshly loaded user data, obtains a fresh Steam Web API auth ticket,
and launches without QA clicking Play. It never persists the character name or
ID, Steam/account/user ID, ticket, native response, or arbitrary state. A
second context loss inside 60 seconds stays on the manual recovery UI. Missing
characters, changed TOS requirements, unavailable WebGL2, storage errors, and
auth failures all fail closed without a reload loop. However, final pre-live
review found that its consumed auto-resume intent was not cleared when the
resolved character later entered an incomplete, customization-required, or
TOS-invalid route. A subsequent manual setup in the same renderer could
therefore inherit stale intent. RC79 was rejected before bind or launch and must
not be qualified or published.

RC80 clears the one-shot recovery context immediately on every pre-launch route
that cannot auto-launch, including incomplete character, customization, TOS,
missing character, Back, unavailable WebGL2, and storage failure. A fresh-ticket
failure makes exactly one automatic attempt, presents the ordinary manual error,
and cannot reload or retry in a loop. Its source gate passes 253/253 tests,
typecheck, and lint. The exact signed, notarized, stapled, and
Gatekeeper-accepted RC80 bundle is
`/private/tmp/fov4-macos-rc-browser-display-link-80/output/mac-arm64/Fantasy Online 2.app`.
Its sorted-tree fingerprint is
`13a2e73695b656c9ea1b0f1cb1595bf5de9af20411ac2fae38eb2c9756fcfb71`
(607 entries, 352293464 bytes). The app ASAR is
`2c4eb886c882de0edc2249ca8714d0e5852246d7c433d84aaf7e2bfc4bfffea5`;
the signed in-bundle addon is
`2f176fd985337ddd4e1307da4ed811e652f724b80365ec388228cfa742dd3460a`.
The exact Bridge and FOV source archives are respectively
`c832f2f1b1bf3e2715eb6c85bb5dc0b3bf3abe402634d50c398a79c789b3e555`
and `db58f642fe612fdbe1e60c813e605e7f77d75ae745e233f7f9ca10e8014ebe0f`.
RC80 reuses exact Bridge package
`f84f37f329be767c6576aa86d18bfa858287be7faa765c4839265e06946add5c`
only after byte-comparing the package and native source trees with RC79. Its
source manifest is
`0568d4a43cc9bcfd87d77705a20674021bb5c1f4f144602fce226d78b1f60735`;
its source-archive QA driver hash is
`395d368efa9eb6e06b7445284b6ebcc73f4f2a9165643396a885e8d327bb14d7`
and its platform-neutral self-test passes 9/9. A post-freeze, external-only QA
harness revision is installed separately at hash
`4e2d9c2abba49872e219f82a84b87205fd696326e6a3a0ff368aae65825885b9`;
it does not alter the signed app fingerprint. It makes canonical receipts reject
duplicate, missing, reordered, cross-profile, and unselected-case streams, and
prevents adapter-only failures from being hidden by a contradictory green
controller result. Its Windows static suite passes 254/254, typecheck and lint
pass, and its Mac-local self-test passes 9/9. The exact display helper is
`703b8e18838a2135ee799c3ac8ddf457ca9f86ae9d2e54d46de8fa93b41fe96a`.

RC80 is now transactionally bound and its affected focused
`gpu-process-recovery` case is green. The computer-wide display/power cases are
retired and excluded from the final matrix. The installed RC80 safe runner
explicitly rejects both names; no RC80 process or builder agent remains after
focused cleanup. Both owner-executable-only controllers additionally
fail before any Steam, app, or desktop action unless the invocation supplies an
exact unattended-session acknowledgement and real HID input has already been
idle for at least five minutes. Both recheck immediately before Steam shutdown
or QA-driver start, so activity returning during preflight also aborts. Refusal
without acknowledgement is verified for both scripts. The binder and
safe-runner hashes are respectively
`c64cec7d28929b0879122c9b294b6d192f599f8f2e8eb12e9c9b5c7bd8f66dbf`
and `f9e4e6e8ddc249a299b0a30506268947d5816eb63acfdd6157c5552a1be86edd`.
The refusal-only sleep-controller tombstone is installed at hash
`db9ea0b0768d737a902ba221f09434a136533d0bb1ca357847e9692ace6cd3bb`.
A separate owner-executable-only final controller is installed at
`/private/tmp/fov4-macos-rc-browser-display-link-80/run-final-safe.sh`, hash
`c6f86e0149ae486a8bab6431aa56d73cded2f07fcc241496e9a4d3e5ee5a231e`.
It pins the exact driver, all three live helpers, the fingerprint helper, and
RC80 bundle fingerprint before any Steam or desktop action; it then invokes
only the 25-case/five-profile final lane. Its explicit no-acknowledgement test
created no artifact or log. The controller contains no sleep or lock action.

The post-retirement static release audit is green. FOV4 passes 254/254 tests,
typecheck, and lint. Steam Bridge passes its complete `npm test` gate with
347/347 unit tests, Electron/version and binary-VDF checks, Windows release
self-tests, build, and typecheck; API coverage, supported-target policy,
`cargo fmt --check`, and native `cargo check` also pass. The packed-package
smoke passes after supplying the desktop workspace's bundled Python through its
existing `STEAM_BRIDGE_PYTHON` hook, including Linux, Steam Deck, macOS, and
Windows fixture self-tests. The macOS locked/asleep records in that smoke are
synthetic verifier fixtures only; no live lock or sleep action was performed.

Checkpoint CI run `30352751958` later cancelled tests 262-347 on macOS,
Windows, and Linux after the checkout-reservation test became the only owner of
an intentionally unreferenced production poll timer. Parallel local tests had
accidentally kept Node alive and hidden the test-harness dependency. The test
first retained one fixed 30 ms delay across the readiness flip, but follow-up CI
run `30355442301` proved that duration was still shorter than the next poll on
all three runners. The test now races the pending reservation against its own
referenced 600 ms failure deadline and clears that deadline when readiness is
observed. This ties process lifetime to the promise under test instead of a
timing guess; production timer ownership and shutdown behavior are unchanged.
The isolated serial test and complete local `npm test` gate pass, including
347/347 unit tests.

Follow-up CI run `30355879714` confirmed that the Windows reservation test now
passes on Linux and macOS runners, then exposed the identical hidden dependency
in the immediately following Linux application-host warmup test. Both tests now
use one shared referenced-deadline helper around promises whose production
timers intentionally do not own process lifetime. This keeps the harness alive
only until the operation settles or its explicit test deadline fails and avoids
further fixed-delay guesses.

CI run `30356141907` then passed both reservation tests on every runner and
exposed the same harness-lifetime assumption in the adjacent typed-wait/release
coverage. Every timer-owned phase in that test now uses the same shared helper;
abort and close paths that settle synchronously retain their original direct
assertions. This is the final checkout-reservation test block that can depend on
the intentionally unreferenced production readiness and lease timers.

CI run `30356476302` passed the complete macOS and Linux jobs, including unit,
Rust format/native compile, and API gates. Its Windows job failed earlier in two
macOS Objective-C++ source-shape tests because the runner supplied CRLF text and
the tests searched for literal LF method boundaries. Those two test-only reads
now normalize CRLF to LF before slicing. The native source and product behavior
are unchanged.

CI run `30356746271` confirmed the timer-owned checkout fixes across all three
platform jobs and passed the complete macOS and Linux jobs plus package smoke.
Windows progressed past the Objective-C++ assertions and exposed the same
checkout-newline artifact in two Swift helper boundary assertions. Source-shape
tests now read Swift helper text through one CRLF/CR-to-LF normalization helper,
including adjacent assertions whose slices could otherwise silently terminate
at `-1`. The complete local `npm test` gate passes 347/347; this remains a
test-portability repair with no production or native behavior change.

The subsequent route-lane audit proves `--suite full` expands to exactly 55
unique cases and contains zero unavailable, locked, display-asleep, or sleep
actions; the separate `unavailable` suite is not a release requirement. The
example packager now accepts an exact `--package-tarball` only together with a
lowercase `--expected-package-sha256`, rejects symlinks/missing/non-tarball/hash
mismatches, cannot mix the tarball with artifact assembly, and skips workspace
repacking so final route proof cannot drift from the candidate package. Its
adversarial unit coverage and the complete packed-package smoke are green.

An isolated route workspace packaged exact RC80 tarball
`f84f37f329be767c6576aa86d18bfa858287be7faa765c4839265e06946add5c`.
The installed native contract is 1141/1141 methods with hash
`2cf79231048a9b529c901b3099fd024793bbb1dcc0bb228f67cf21c76cbafd0f`;
the prepared/signed smoke app tree fingerprint is
`d8511aa790db74f5b5b2835892c2534ff920bf7695373efb1d5d35d9f29c35f9`
(640 entries, 300123628 bytes), and the existing signing verifier passes. Its
owner-executable-only full-route controller is
`/private/tmp/steam-bridge-macos-rc80-route/run-routes-safe.sh`, hash
`1cfbc9252ec6a615bed78c017f9f3eb5e784cca458ee12f098be8684ce83b627`.
It pins the tarball, app, matrix, helper, summarizer, signing verifier, shortcut
writer, and fingerprint inputs; invokes only `--suite full --skip-package`;
requires 55 unique full-suite rows; fingerprints the app before and after; and
contains no lock/sleep action. Syntax and no-acknowledgement refusal pass, with
no artifact or log created by the refusal.

No launcher environment file remains after the focused/failed-case cleanup.
If a future hard controller death leaves one behind, the unattended/HID gate
must pass before a controller may remove it, and only when it is a regular
non-symlink owned by the current user with mode 0600 and no QA driver, exact
candidate, or open file handle can still own it. Every other shape fails closed.
The binder now uses the same bounded complete Steam-stop routine for both the
forward write and rollback. If post-restart verification fails it stops Steam
again before restoring the backup, and it never starts another instance while
any targeted Steam process survives. It creates and verifies the backup and
arms rollback before calling the updater, closing the updater-write/parent-exit
window as well. Its transaction-order audit passes.
The backup is byte-compared before mutation and the restored VDF is
byte-compared again before Steam can restart.
Restart success no longer means the first healthy PID. The binder allows a
bounded three-minute updater window and requires exactly one healthy primary
Steam PID plus helpers to remain unchanged for twenty half-second samples
before post-restart VDF verification, covering the RC77 updater handoff.

The former computer-wide recovery controller is now a refusal-only tombstone.
It cannot launch the driver or perform Steam, app, display, input, sleep, or
wake actions. The driver has no selectable sleep cases and no disruptive-power
acknowledgement option. Historical receipts remain readable only for audit.
The first authorized binder attempt made no mutation and produced no receipt:
its early-exit HID `awk` caused upstream `ioreg` to receive SIGPIPE under
`pipefail` (exit 141). All three controllers now consume the complete `ioreg`
stream while retaining only its first HID value; syntax and exact hashes were
reverified before retry.
The subsequent transaction reached the RC80 VDF write and pre-restart
verification, then returned non-green during the LaunchAgent request/handoff;
its incomplete `shortcut-binding-01` evidence is retained. A separate read-only
updater verification proves the live VDF currently matches RC80 exactly and
Steam is healthy, but that is not accepted as the final bind receipt. Binder
revision `shortcut-binding-02` treats the `kickstart`/`bootstrap` request status
as advisory and retains the bounded single-primary/helper stability window as
the authoritative restart result.
The second receipt isolated one more `pipefail` edge: during normal startup,
`pgrep` returns 1 before the first primary PID exists, which made the
`primary_count` command substitution abort instead of recording zero. Receipt
`shortcut-binding-03` explicitly converts only that no-primary transient to
zero; the exact-one-primary and helper stability gate itself remains unchanged.
The corrected binder then refused before mutation because HID idle reset to
zero. A bounded 15-minute observer never saw five continuous idle minutes.
Per-event CoreGraphics samples confirmed real repeated key-down, key-up, and
flags-changed events plus a cursor-position change while `parsecd` and an
Apple Remote Desktop agent were active; this was not a harmless stationary
heartbeat. Do not classify that session as unattended or weaken the gate. The
temporary read-only probes were removed after recording this result.
After the operator explicitly authorized disconnection, Parsec was terminated;
the post-disconnect HID clock then advanced continuously. The corrected
`shortcut-binding-03` receipt is green at
`/private/tmp/fov4-macos-rc-browser-display-link-80/shortcut-binding-03` for
candidate `13a2e73695b656c9ea1b0f1cb1595bf5de9af20411ac2fae38eb2c9756fcfb71`,
Steam PID 14026, internal shortcut app ID 3632367583, and shortcut game ID
15600899976069120000.

The exact focused receipt
`/private/tmp/fov4-macos-qa-rc80-gpu-recovery-01` is green. It proves the same
app process and attached child survived a real GPU-child replacement, automatic
shell reload occurred without driving Play, the actual production game surface
returned, and the window restored exactly. At a 120 Hz display, renderer probes
were 120.004/120/120 FPS and Chromium presentation feedback was 119.003 FPS
(ratio 0.992). The visual transition covered 2306 frames with zero unavailable,
unhealthy, blank, purple-cover, chrome-cover, or full-frame-flash frames. Exact
candidate cleanup, Steam survival, display restoration, and app/overlay/Steam/
graphics crash counts are all green/zero. Manifest SHA-256 is
`24353923c706384eef29ebcbd4d465dac17e1506a2b6b6f093761eac1a7fd706`;
summary SHA-256 is
`3983eb317936ab7d4c06c4d21572dfbdd29b333cac3a4f913acf233ae3e6178d`.

The first 25-case/five-profile final attempt is retained as failed at
`/private/tmp/fov4-macos-qa-rc80-final-actual-game-01`. Its complete 120 Hz
profile passed 25/25, then `display-live-transition` failed on the 60 Hz
profile because the QA harness created a second application-scoped
CoreGraphics owner. The inner owner observed its requested 120 Hz and restored
60 Hz before exit, but process exit exposed the session's 120 Hz mode instead
of the outer helper's 60 Hz application scope. This is a QA-supervisor nesting
defect, not a Steam Bridge child-window or Chromium pacing regression. Do not
restore the nested helper/hold-file path.

The display helper now keeps one application-scoped owner for each profile and
accepts atomic, sequence- and token-checked mode requests from its supervised
child. The app driver uses that channel for both temporary transitions and
restoration. Focused receipt
`/private/tmp/fov4-macos-qa-rc80-display-control-60-01` is green for the exact
unchanged RC80 bundle: all four acknowledgements proved 60 -> 120 -> 60 both
passively and with Steam active, the same attached child remained aligned,
overlay presentation reached 118.3 FPS at 120 Hz and 58.9 FPS after restoring
60 Hz, final desktop restoration returned exact mode 54/120 Hz, every crash
count was zero, and Steam survived. Its manifest and summary SHA-256 values are
respectively `7f0b500c6ce480b11d48765a2e156cad18b48a97729579d37bfb7227fde3ae43`
and `a6a9c84311613219a741a08b79fca92389199e0889f62bac388ca9940d78df41`.
The new driver and helper hashes are respectively
`c0da58e2c7d3dae04d7673849b75833dcca7496e313ec3967ac59e9d5ffee680`
and `0b42359e71b719533d2354b6fb49e7852f275355f37e37ba7cc56b9bc02aa5af`.
The only other affected case, `display-pacing-transition` at 60 Hz, is green at
`/private/tmp/fov4-macos-qa-rc80-display-control-pacing-60-01`: renderer
cadence was 60.000 FPS before transition and 60.001/60.000 FPS after restore,
Chromium presentation feedback after restore was 60.000 FPS, cleanup and exact
display restore passed, every crash category was zero, and Steam survived. Its
manifest and summary hashes are respectively
`50571fd2b3c15070f7a429817513ab2be847e7f8a0777d18fa7ef95253bae835`
and `5c4f1913ee9c0665ecbae789f2cbdca2e96f168de9b0bcbcae0a03e05d5726e1`.
Every case affected by the supervisor change is now individually green.

The next clean final attempt is retained as failed at
`/private/tmp/fov4-macos-qa-rc80-final-actual-game-02`. It completed the 120,
60, and 48 Hz profiles with 75/75 passes, then exposed a separate harness-only
boundary error in low-Retina mode 7 (`1168x730`): gesture staging used a
`900x650` window at `y=60`, so AppKit correctly clamped the requested 70-point
downward move to the remaining 20-41 points while the assertion required an
impossible exact delta. The reversal also used the requested rather than
actual first-leg displacement. An interim `900x540` staging frame left the
full move physically achievable. Exact focused receipt
`/private/tmp/fov4-macos-qa-rc80-low-retina-gesture-01` passed only the two
affected cases: slow drag observed exact `140,70`, reversal observed exact
`120,60` then `-120,-60` and returned `0,0`; both retained continuous child
pairing, healthy pixels, exact baseline restore, and roughly 60 Hz attached
presentation. Exact candidate cleanup, mode 54/120 Hz restoration, Steam
survival, and all crash categories passed. Its manifest and summary SHA-256
values are respectively
`3a47798aa9770aa1040f4b77859dfc33dc995cb4873c2e33dd6d41d2b9f2c04a`
and `0964e1c9bc78641d72b40885269ef8bf71e2d4e6c353c7db195a7bee178ab9c3`.

Final attempt 03 is separately retained as failed at
`/private/tmp/fov4-macos-qa-rc80-final-actual-game-03`. Its 120 Hz
`display-live-transition` temporarily entered the same-resolution 60 Hz mode
and proved exact `80,40/-80,-40` title motion, but the interim 540-point frame
could shrink only 28 of the requested 60 points because the app's exact
640x480 content minimum produces a 512-point outer-frame minimum. The single
staging size satisfying both real boundaries is `900x600`: from `y=60` it has
exactly 70 points of downward travel on the 730-point desktop and 88 points of
shrink room above the 512-point minimum. The current immutable driver hash is
`210673c04e0f662bb0fbf9516e358ce666b681772a3516e7e2dd9ea47f8d8eb4`;
the focused and final controller hashes are respectively
`38e899fbfff781d98779bb24f93d25f451c374aedfe9cd103735009591a11171`
and `b2e1f330584956a1242995b6c1b0d2df7eec8fee16d68a31f55ee657149797d0`.
Focused-retest every case sharing that staging helper, then run one new
complete final receipt; do not continue any failed partial pass.

The interrupted focused caller sweep is retained at
`/private/tmp/fov4-macos-qa-rc80-staging-callers-01`. Low-Retina slow/fast/
reversal title movement plus right, bottom, and corner resize all emitted
green case results with the 600-point staging frame. `resize-reversal` then
failed only its post-gesture aspect endpoint: `1128x520` minus the exact
32-point application menu yields `1128x488` (2.311), which is not actually
wider than 21:9 (2.333). The reversal input itself was not the failure. The
wide endpoint now uses the exact 512-point minimum outer height, producing an
`1128x480` game area (2.350) and a genuine wide branch. Focused unchanged-RC80
receipt `/private/tmp/fov4-macos-qa-rc80-aspect-resize-reversal-01` passed
exact reversal, both wide/tall branches, exact cleanup/display restoration,
Steam survival, and zero crashes. Its manifest and summary SHA-256 values are
respectively
`d43997bb530ed3128b3d6fe6ef402014edb32c5103fd66b73704423565f0277f`
and `199564414c145883014de44c2b79c3797664805ed7d4bd3a3e2e9c41438a5a38`.
The current immutable driver, focused controller, and final controller hashes
are respectively
`0b7f9cb085b50d0381c23e1e3a2850def893db9a6e6ac3fbb3ad7fd59fd8c4ba`,
`32a540db95b3dd810f1fde771a7c568dc12b2d215890de0a83945f919feee21b`,
and `a65388bf7daa481f52bd7c2b03dba873a9d936ecfe3a5b58a8efc76be5c786a7`.
Complete focused receipts for the remaining zoom and overlay-state callers,
then run the one clean final receipt.

The last interrupted focused pair is retained at
`/private/tmp/fov4-macos-qa-rc80-staging-zoom-overlay-01`. `zoom-restore`
emitted a green low-Retina case result. Initial `overlay-state-stress` then
failed before gesture execution only because the three-decimal native visual
helper reported `bottomEdgeOpaqueRatio=0.998` with a strong
`roundedCornerScore=0.1`, while the visual contract used strict `<0.998`.
The contract now accepts the highest quantized value that still proves a
non-rectangular edge (`<=0.998`) and continues to reject 0.999/1.000. Focused
unchanged-RC80 receipt
`/private/tmp/fov4-macos-qa-rc80-overlay-rounding-01` passed the complete
active-overlay move, resize, maximize, minimize, focus, and fullscreen stress,
exact cleanup/display restoration, Steam survival, and zero crashes. Its
manifest and summary SHA-256 values are respectively
`e9200f1c0d55742c8a989e18ebe2e50fce72e775a0f2abbba28f6fd51c125f37`
and `f64bf8001bd27647541e18c8b38b5879eadf820c81d0a47fd4f62cc45bd90cf6`.
The imported visual contract is now independently controller-pinned at
`2de1e14224f4cda8c4940aac3563f710f059439b0cbf0500e3c2fccb4897b535`;
the focused and final controller hashes are respectively
`09514812032eb9cc8c36d24dd9047e9de755a1c224f263b62ad285723ea32e46`
and `aac491db6be9183b95dfdbfc651a2e4927769b4644d2018a6a1bb9a67648855e`.
Every affected case is individually green. Run one clean final receipt now;
do not rerun focused cases already proved by these retained results.

That clean final receipt is retained as failed at
`/private/tmp/fov4-macos-qa-rc80-final-actual-game-04`. The complete 120 Hz
profile passed 25/25. On the 60 Hz profile, baseline/menu/input and the live
60 -> 120 -> 60 display transition passed, but the isolated
`display-pacing-transition` restored Chromium renderer and presentation
cadence at exactly 30 FPS instead of 60 FPS. The immediately following
`fps-baseline` independently remained at exactly 30 FPS. Focus and production
canvas identity were exact before and after both samples. The unchanged
attached Metal child remained paired, aligned, error-free, configured for
60 Hz, and presented at 60 FPS, so child geometry, MTKView timing, and Steam
Bridge surface continuity are not the failing signals. Cleanup restored exact
desktop mode 54/120 Hz, Steam survived, and the app was stopped without
continuing unrelated cases. The earlier focused
`fov4-macos-qa-rc80-display-control-pacing-60-01` pass therefore proves the
supervisor repair but does not close this newly observed nondeterministic
Chromium half-rate state. Diagnose and retest only the affected pacing
transition/baseline path until it is repeatably green; do not weaken the 95%
fixed-rate gate, retime or recreate the healthy child, or run another complete
final matrix before the focused defect is closed.

Focused prefix reduction proved that `warm-relaunch` plus the pacing transition
is sufficient; menu, input, display-live, and overlay cases are not required.
The receipt-hardened driver now traces the complete transition and retains only
bounded causal counters. Receipt
`/private/tmp/fov4-macos-qa-rc80-half-rate-causal-02` reproduced exact 30 FPS
with 1,287 browser display-link callbacks, 106 skipped-vsync events, and the
preferred subsampling sequence `[1,1,1,2]`; its post-restore and following
baseline traces skipped essentially every other callback. No new
`FrameIntervalDeciderResult` occurred during that failing transition, proving
the final factor-two call reused a stale stored preferred interval rather than
responding to a new content matcher. Temporary diagnostic receipt
`/private/tmp/fov4-macos-qa-rc80-half-rate-input-nudge-03` then dispatched one
non-clicking CDP mouse move after restore. That forced two fresh interval-decider
results, produced six factor-one preferences, zero skipped callbacks, and exact
60 FPS renderer and Chromium presentation feedback through both the transition
and independent baseline. Cleanup, exact display restoration, Steam survival,
and all crash checks passed. The probe is not product behavior and has been
removed from the maintained driver. Next, prefer a supported compositor
invalidation or upstream lifecycle repair and prove it with this focused prefix;
do not ship synthetic input by default or disturb the healthy attached child.

Signed, notarized, and stapled RC81 is the first app-owned recovery candidate,
bundle SHA-256
`d26cec5e945f7aca2400da8a614b382bd7b1ac3c8d975b56522c980d71a12734`.
Focused receipt `/private/tmp/fov4-macos-qa-rc81-pacing-recovery-focused-01`
passed exact-candidate preflight, startup, actual-game identity, and warm
relaunch, but again measured exact 30 FPS after the 120 -> 60 restore. Its
transition trace recorded four interval-decider results and preferred factors
`[1,1,1,1,1,2,1,2]`, then 91 of 92 post-restore display-link callbacks were
skipped. This proves the app's zero-distance Electron `mouseMove` reached the
decision path and briefly selected factor one, but did not sustain the causal
InputBoost behavior of the successful moved-coordinate CDP control. Preserve
this as a failed candidate. The next focused candidate must use one real
one-DIP renderer-local move followed immediately by restoration of the page
pointer; it must never move the OS cursor, click, focus the app, recreate the
child, or broaden the retest beyond warm-relaunch/pacing/baseline.

The retained failed display-sleep receipt is
`/private/tmp/fov4-macos-qa-rc80-display-sleep-01`. It records
`window_state_mismatch` with no accepted sleep/wake/restore proof; cleanup,
display restoration, candidate re-fingerprint, Steam survival, and zero crashes
all passed. The attempt nevertheless invoked the macOS security lock screen and
required a manual operator unlock. No full-system sleep case was run. This is
the evidence for permanently excluding both lock-capable cases from the
25-case/five-profile (125-execution) final contract.

HID inactivity is rejection evidence only, never authority: set the safe
desktop-controller acknowledgement only after the operator explicitly states
that the Mac is unattended for the applicable live QA. Do not infer consent
from an idle clock, `continue`, or a previously unattended run.

During repair, run only the scenario affected by the current edit. Once every
individual Mac case is green, run one complete clean actual-game candidate pass
and then the existing complete route matrix once on that exact candidate.
Record receipts before moving to the next platform. Keep Steam closed on every
other platform while collecting live overlay evidence, require no recurring
human input, never authorize a purchase or subscription, and sanitize private
Steam/app/account identifiers from retained artifacts.

### 2026-07-26 macOS focused closure checkpoint

Keep the macOS overlay as one `NSWindow` attached with AppKit's parent/child
relationship to the Electron parent. A popup, companion, separately managed
top-level surface, or fallback recreation is a closed path. Keep
`BOverlayNeedsPresent()` disabled; it previously crashed Steam's injected
renderer. Application-owned simple fullscreen remains FOV4 policy, while child
attachment, geometry, presentation lifecycle, and generic Electron focus
restoration belong in Steam Bridge.

The focused receipt sequence closed four distinct issues without rerunning the
already-green route matrix:

- Receipt 31 proved renderer focus both inside and after application-owned
  simple fullscreen, exact `1280x720` child/content geometry after exit,
  rounded corners, exact restoration, and zero crashes. Its fixes defer FOV4's
  renderer focus until native menu dispatch returns and give Steam Bridge one
  coalesced next-turn geometry reconciliation after terminal macOS `resized`.
- Receipt 32 exposed two separate defects during active minimize: the hidden
  MTKView continued drawing at display cadence and accumulated dropped
  drawables, while one later transition-adjacent dropped callback was
  misclassified as a presentation stall. Steam Bridge now pauses the existing
  view whenever its attached parent cannot present. The QA gate now rejects a
  dirty interval but permits it to become the next baseline, still requiring a
  later consecutive clean interval before passing.
- Receipt 34 retained closed proof that passive minimize and application hide
  pause the same Metal child with stable draw, present, drawable-failure, and
  render-failure counters. Its active stress failure was not a product failure:
  Steam legitimately emitted its inactive callback after the prolonged
  minimize, and the harness incorrectly required the overlay to remain active.
- Receipt 35 then proved the public Friends route did reactivate the overlay,
  but the harness looked for an incidental window event instead of Steam's
  activation callback. Receipt 36 is the applicable focused result after the
  verifier repair: clean deactivation was accepted, the public menu route
  reopened the overlay, the exact-app active callback and healthy active
  telemetry were required, the same attached child continued, hidden draw and
  present counters remained stable, every active move/resize/maximize/minimize/
  focus/simple-fullscreen transition passed, the display restored to its exact
  120 Hz mode, and app, overlay, Steam, and graphics crash counts were all zero.

The post-receipt verifier hardening is deliberately fail-closed. Visible
steady-state pacing now passes only on two adjacent same-phase healthy samples:
a phase mismatch, invalid geometry/policy sample, or stalled presentation
resets the baseline, while a bounded late transition callback may seed but
never satisfy the next clean interval. Active minimize proves fresh active
same-child telemetry and checkpoints callbacks before the action. Its hidden
pair resolves either activation state but may not cross a visibility or state
boundary, and every hidden sample is checked against the established surface
identity. Retention requires no exact inactive callback plus active hidden and
restored telemetry; deactivation requires an exact inactive callback and a
later exact active callback in causal order, either automatically or through
the public Friends reopen route. Unit tests cover phase/stall crossings,
active-to-inactive hidden transitions, temporary surface replacement, stale
and wrong-app callbacks, and every minimize classification branch.
Focused passive minimize/hide cases now seed the visible child identity before
the transition, and that identity survives every same-process state change.
Warm relaunch is the sole reset boundary: the old exact process must be closed
without escalation and a different immutable process identity must exist before
the new child can establish its identity. Failure receipts preserve `pending`
or `invalid`; the sanitizer never invents a retained overlay lifecycle.

The receipt-36 bundle fingerprint begins `27de4aee8d20`, but that bundle is an
ad-hoc iteration only: it is not Developer-ID signed, notarized, or stapled.
It also predates the final fail-closed weak-parent refinement in the current
native source. That refinement affects only a vanished-parent teardown path;
do not rerun unrelated focused cases for it. Rebuild the exact current tree for
the release candidate, complete only still-unproven Mac cases, then run one
complete Mac actual-game pass and the retained route matrix once on the exact
signed/notarized candidate. Do not promote or publish an ad-hoc receipt.

## Settled Linux/Deck Application Host

The current Linux/Steam Deck product path is one visible X11/GLX
**application-host window** plus one hidden Electron offscreen renderer. It is
the application window, not a popup, companion, overlay layer, or second
visible surface. Window chrome, minimum size, move, resize, maximize,
fullscreen, minimize, focus, cursor, and Steam's injected overlay all belong to
that one host. Keep this single-host architecture after compaction.

Electron 43 supplies each offscreen frame as a one-plane BGRA native pixmap.
Steam Bridge duplicates the dma-buf descriptor, imports it through XCB DRI3,
binds the resulting GLX pixmap with `GLX_EXT_texture_from_pixmap`, draws it into
a retained GL texture, finishes the copy before Electron can recycle the
producer, and destroys the temporary GLX/X11 objects. While Steam is active,
Electron paint intentionally stops and the same host continuously presents the
retained texture. Diagnostics name this backend
`x11-dri3-glx-texture-from-pixmap` and count imports and failures.

Closed Linux paths must not be retried as fallbacks: top-level popup/companion
hosts; `keepAbove`; resize-time recreate or unmap/remap; nested child GLX;
hidden-root bootstrap/reparent; direct Electron desktop GL or Vulkan;
unmapped-proxy dual drawables; and EGLImage imported into a GLX context. The
last path created the EGL image but crashed Mesa during GL binding/error
inspection. Direct `glCopyImageSubData` from a texture-from-pixmap also returned
`GL_INVALID_OPERATION`; the sampled shader/FBO copy is the proven path. A
direct service launch is not Steam-overlay proof: launch through Steam's game
URI so its injection environment is present.

The exhaustive actual-game pass on 2026-07-25 is green for one visible host,
1280x718 windowed content, exact 1280x800 fullscreen content and restore,
exact 640x480 minimum, interactive direction-reversing move/resize, maximize
and restore, minimize at 1 FPS and restore at 90 FPS, Alt+Tab/focus return,
native keyboard/Escape routing, cursor hide/show, ordinary Steam web-overlay
open/duplicate suppression/close, and retained-overlay presentation while
moving, resizing, maximizing, entering fullscreen, switching focus, and
minimizing. The same process and host survived every transition, and dma-buf
imports reported zero failures. The Deck's X11/XRandR refresh is 89.869 Hz;
game RAF, shared-texture import, and native presentation hold about 90 FPS. An
absolute-deadline scheduler replaced the old fractional timeout loop that
over-presented at 94-95 FPS. A transient post-world-entry sample measured about
48 FPS while content was still loading; the focused steady-state rerun reached
exactly 90 FPS. Pixel screenshots remain unavailable to remote automation in
this session (compositor capture was denied and the remote Windows capture was
protected), so geometry, lifecycle, callbacks, input, cadence, and import
telemetry are proved, but no claim of screenshot-based pixel comparison is
made.

The final application-menu edit received a focused packaged-candidate
requalification on the same date. The preserved three-group menu remained
directly clickable after the live-game handoff, and opening File exposed its
item without depending on React's removed root. The 1280x718 client reserved
exactly 26 DIPs for the menu and presented an undistorted 1280x692 game canvas
at `[0,26,1280,692]`, with the cursor hidden. Steady baseline RAF measured
89.667 FPS; retained presentation while Steam was active measured 90.000 FPS;
native EIS Escape closed Steam; and post-overlay RAF measured 90.003 FPS with
unchanged menu/canvas geometry. One immediate post-menu sample contained a
single 333 ms transition stall and was rejected; the settled focused rerun is
the applicable result.

The 2026-07-28 client-px requalification found one native-pixmap compatibility
gap that page scheduling alone could not detect. Electron 43.2.0 supplied the
standard linear dma-buf modifier as decimal string `0`; the native import guard
rejected it, so presenter cadence advanced against a retained frame while DRI3
import count stayed zero. [Linux's DRM UAPI](https://docs.kernel.org/6.3/gpu/drm-uapi.html#formats-and-modifiers)
defines modifier zero as linear. The
unreleased native repair accepts zero plus the two already-supported unspecified
sentinels and continues to reject every other modifier. A Deck-native rebuild
then held 89-91 shared-texture imports and 90 native presents per second with
backend `x11-dri3-glx-texture-from-pixmap`, continuously increasing imports,
zero failures, no bitmap fallback, and exact 90 FPS page scheduling. During the
ordinary Friends overlay imports paused by design while retained presentation
held 90 FPS; after native Escape, shared imports and the game resumed at 90 FPS.
Do not accept page rAF or presenter cadence as live-game proof unless import or
CPU-frame progress independently advances before overlay activation.

The consumer now has a fail-closed schema-v2 final Linux/Deck receipt auditor at
`scripts/linux-final-qa-receipt.mjs`, with the prior Deck-named path retained as
a compatibility entrypoint. It binds Linux Desktop, Deck Desktop, and Deck Game
Mode receipts to both repositories and the exact package/native binaries,
recomputes the raw artifact manifest, enforces all 37 shared CORE rows,
resanitizes the CDP JSONL,
requires one ordered execution per CORE row and selected physical profile,
fixed per-case assertion sets, and distinct state/process/evidence continuity,
rejects private text even after rehashing, scores three settled
baseline/active/post-close pacing samples per display profile, and rejects
lower self-declared fixed-rate targets, dirty cleanup, stderr, crashes, or
display drift. Desktop permits no omitted CORE rows. The separate `1280x800`
gamescope receipt permits only the enumerated
desktop-window capabilities to be `not-applicable`; it cannot misreport them as
passes or omit supported Game Mode behaviors. This closes the prior prose-only
receipt gap but does not substitute for running the exact final candidate.

The schema-v2 auditor also closes the one-arbitrary-profile loophole. Desktop
receipts require at least three distinct modes collectively proving baseline,
maximum refresh, fixed 60 Hz, lower resolution, 100% scale, and non-100% scale.
Role semantics are checked against logical/pixel dimensions, scale, refresh,
and an exact hashed mode record. Every CORE row must execute once under every
profile in canonical order with profile-isolated evidence. Deck Game Mode is
the only one-profile lane and is fixed to its native `1280x800`, scale-1 mode.

The consumer's `scripts/cross-platform-core-qa-contract.mjs` is the sole source
of truth for the ordered 37 CORE IDs and their fixed required assertion keys.
macOS, Windows, Linux, and both Deck adapters import and re-export that same
immutable module object; platform-local copies are forbidden and unit coverage
locks identity, order, uniqueness, assertion coverage, and frozen state.

Retest only a scenario affected by a new edit. Run the complete Deck pass once
all individual cases are green and immediately before a release candidate.
The temporary CDP runner must then be restored from
`/home/deck/fov4-qa/run-fov4-qa.sh.normal-20260723-012815`, and the final
Steam-launched sanity check must prove port 9233 is unreachable. Keep Steam
closed on every other platform while collecting overlay evidence.

The shared closed CDP runner now has a neutral
`scripts/linux-actual-game-qa.mjs` entrypoint and requires one explicit target:
`linux-desktop`, `steam-deck-desktop`, or `steam-deck-game-mode`. It accepts
only a Linux renderer and requires `isSteamDeck()` to be false for non-Deck
Linux and true for both Deck lanes. The canonical auditor correlates that
attestation with the receipt platform, so a real Deck cannot manufacture Linux
Desktop evidence and a general Linux host cannot manufacture Deck evidence.
Non-Deck Linux owns a documented physical X11/Wayland matrix across
resolution, refresh, scale, move/resize/minimum, state/focus/fullscreen,
overlay-active transitions, actual-game integration, renderer/native pacing,
crashes, cleanup, and exact restoration. Automation is implemented and unit
qualified; no physical non-Deck Linux receipt exists yet.

The Windows audit found a different proof-layer gap: Steam Bridge's schema-v4
`windows-live-proof-receipt.cjs` strongly binds the package, installed runtime,
standalone D3D11 telemetry, manual checklist, and npm publication candidate,
but its four coarse cases are not the consumer's canonical cross-platform
37-CORE actual-game matrix. FOV4 now owns a separate explicit
`windows-desktop` CDP lane and `scripts/windows-final-qa-receipt.mjs` auditor.
It requires a Windows renderer, non-Deck attestation, local loopback, stable
Electron, the exact ordered five-case CDP stream, all 37 ordered CORE rows with
distinct evidence and fixed assertions, pacing against measured display Hz,
exact restoration, empty stderr, and zero crashes. Windows accepts no
`not-applicable` CORE row. Both the new application receipt and the existing
Steam Bridge Windows live-proof receipt are required; the package publication
contract remains unchanged.

Live execution checkpoint: the new Windows adapter's focused launch was not
run because the Windows Steam client opened at an authentication screen. The
automation did not interact with authentication and requested no operator
input; Windows Steam was shut down cleanly and sole Steam ownership was
restored to the already-authenticated Mac. The Deck host was also unreachable,
and no qualifying physical non-Deck Linux host is configured. Do not claim a
live pass from the unit-qualified adapters. Resume Windows only with an already
authenticated client, Deck only when its host is reachable, and non-Deck Linux
only on a real supported x64 desktop. On 2026-07-28 the Deck became reachable
again and two session-scoped QA inhibitors were installed: KDE blocks power
management/screensaver and logind independently blocks sleep, idle, and lid
sleep. Both units were active with zero restarts. Steam started exclusively on
the Deck, but exposed no authenticated helper or IPC session; automation did
not interact with authentication. The game remained stopped. Resume the live
Deck lane only after Steam is already authenticated; do not ask for or automate
login input.

## Read First After Compaction: Windows Architecture

This checkpoint overrides any shortened-context inference that Windows attached
presentation should be repaired with another popup or child-window experiment.

- The requested audit covered all 794 commits in the repository (the entire
  history available to the requested 800-commit window) and inspected the
  Windows host commits and their recorded live failures.
- `e1dfd73` introduced the attached Windows presenter as `WS_POPUP`.
  `f0215bd` added a "control" comparison that was still an unparented
  `WS_OVERLAPPEDWINDOW`. Activation, focus, bounds, message-pump, clipping, and
  parking repairs accumulated through `6577856` without changing the second
  top-level-window architecture. `2a24089` renamed that attached path
  `owned-popup` and separately introduced the successful standalone shared-
  texture game host.
- No committed revision before the current abandoned re-entry contains
  `WS_CHILD` or `SetParent` in the Windows native host. The real-child result was
  a source-linked, uncommitted experiment recorded by `2a24089`: Windows made
  geometry, clipping, move, focus, and minimize behavior automatic, but Steam
  activated without drawing overlay pixels into the child swapchain.
- Attached top-level presenters are a closed path. Live failures included
  Electron chrome coverage, purple startup/Alt+Tab surfaces, tiny or partial
  Steam surfaces, DPI seams, lost rounded corners, toolbar/menu/title-drag and
  maximize conflicts, minimize/focus desynchronization, drag/resize flicker,
  retained or stale pixels, hangs, and crashes. Region synchronization,
  terminal geometry updates, timing delays, DevTools activity, and retained-
  frame resize stretching patched symptoms and must not be retried.
- The true attached `WS_CHILD` path is also closed unless Steam hook selection
  or the renderer architecture materially changes. Its no-pixels result must
  never trigger a popup fallback.
- The proven Windows production path is one visible standalone top-level native
  D3D host which composites a hidden Electron offscreen renderer. FOV4 already
  uses `client.overlay.startNativeOverlaySession()` in `main/main.js` and creates
  its renderer `BrowserWindow` with `show: false`, `frame: false`, and offscreen
  shared-texture presentation.
- A 2026-07-26 actual-game checkout probe proved that Steam captures the exact
  standalone host HWND while its Windows overlay is active. `GetCapture()`
  returned that host; title-bar, resize-border, maximize/minimize, system-menu,
  and fullscreen input did not enter the host as `WM_NCLBUTTONDOWN/UP`,
  `WM_SYSCOMMAND`, or `WM_ENTERSIZEMOVE/WM_EXITSIZEMOVE`. The host and overlay
  stayed aligned, stable, focused, and near the 165 Hz display rate. Escape
  closed the overlay, cleared capture, and the same title drag moved the window
  immediately afterward. Classify active window management on this lane as a
  Steam-owned modal constraint, not as an attached-surface defect. Active focus
  round trips and externally forced display, refresh, resolution, and DPI
  transitions remain valid stress cases.
- Never call `ReleaseCapture()` on Steam's behalf or synthesize
  `WM_NCLBUTTONDOWN`/`DefWindowProc` move-size loops to bypass this constraint.
  Steam may consume the corresponding button-up event, leaving a nested native
  loop or corrupt input state. The popup and `WS_CHILD` alternatives remain
  closed and are not fallbacks for modal behavior.
- Therefore test the actual FOV4 game-host path. Windows attached mode should
  fail clearly rather than create any popup. During iteration, run only tests
  and live transitions affected by the current edit. Run the full cross-
  platform release matrix once after the implementation is stable and directly
  before publication.

## Historical Release Ledger

The remainder of this file is archival evidence from earlier candidates and
releases. Version-specific headings deliberately say `Historical`; none of the
older `latest`, `stable`, `current`, or verification statements below this line
describe today's package state.

### Historical Completed Goal

Steam Bridge and the FOV4 port now use the proven standalone native-host
architecture. The release permanently closes failed Windows attached
popup/child paths, makes unsupported attached Windows use fail clearly,
validates the actual game with change-scoped manual and automated QA,
requalifies affected platforms, and completes one immutable release-candidate
review through documentation, version, commit, push, tag, GitHub Release, npm
publication, and registry verification. That sequence completed for `v0.3.10`;
do not reopen it without a new code change and a new version.

### Historical v0.3.10 State

`steam-bridge@0.3.10` is published to npm and is the stable GitHub Release:
<https://github.com/jstroh/steam-bridge/releases/tag/v0.3.10>. Source commit
`d4f732fa7df9f6c3ea69326335210e39738f058b` is bound to immutable tag
`v0.3.10`. Main CI `30675507597`, tag CI `30675612376`, and Release assembly
`30675612441` all passed macOS arm64, Windows x64, Linux x64, package smoke,
and the exact Windows
publish-tarball ASAR/package gate. Trusted publish workflow `30678228541`
passed from the tag.

The canonical Windows candidate contains 122 files with content SHA-256
`0c1943e5e9627acb52aa6cea108dc7025198c73ab647e44d5a840e4afadb757f`.
Its Windows archive SHA-256 is
`cdf7c40541d4fb0e83cd039464f9a4f031f30036aae5234f1fb58a7443769e3e` and
the npm tarball SHA-256 is
`028303ad5830e9fb6fe512a9174a052187af951c3040ab66fb7ab60f78e954b9`.
The downloaded registry tarball is byte-identical to that audited tarball.
npm reports integrity
`sha512-ldZSgAegduBj0Gh87Ep4FxUbBxXLQosSJg5kb2XFN2zyeglYhYrsLoVxqrQ1yX1DEQSlP2VYiHj3gFyL1z4nYw==`
and SLSA provenance. All five GitHub Release asset digests match the retained
local files, and the release-scoped proof secret was deleted after publication.

The final candidate-bound actual-game receipt is schema 4 with semantic
SHA-256 `41a686f267974d57fe0af3af9dc5d25ccb7c5a75a15ce4eb759a2b8964592091`.
It contains 451 qualified game samples and 20 ordinary Friends-overlay
samples. Game paint, game present, and overlay present medians were all 59.9
FPS against the 60 Hz display, with zero unsynchronized steady-state samples,
one bounded frame-latency wait, zero slow copies, and zero device losses or
recoveries. The computer-driven
pass covered startup chrome, menus, title drag, resize and exact 640 by 480
minimum, maximize/restore, minimize/restore, fullscreen/restore, cursor and
focus behavior, rounded corners, overlay alignment/close, and clean shutdown.
DevTools stayed closed; no purchase or subscription was opened or authorized.

The 2026-07-21 source-linked FOV4 Windows pass now exercises the actual game on
the standalone native host rather than any attached presenter. A long modal
resize first reproduced `DXGI_ERROR_DEVICE_REMOVED` from competing one-
millisecond timer and `WM_SIZE` renders. Modal presentation is now coalesced at
16 ms, device loss is classified and recoverable on the next shared texture,
and diagnostics expose loss/recovery counts. Repeating the exact stress reached
the enforced 640 by 480 logical minimum and returned to 59.9 FPS without device
loss, slow copies, a crash, or Steam-client damage. Minimize also no longer
turns Windows' iconic sentinel geometry into a tiny renderer: the host reports
`minimized`, skips D3D presentation, and the consumer retains its real viewport
while throttled to 1 FPS. Restore returned the unchanged 2883 by 1623 coded
source to 59.9 FPS without recreating texture storage.

That same actual-game run passed default 1280 by 720 geometry at 225% scale,
File/Edit/View chrome, title drag, edge and exact-minimum resize,
maximize/restore, minimize/restore, fullscreen/restore, and focus loss/return.
One OS-level Shift+Tab qualification generated the native shortcut event and
Steam active/inactive callbacks, opened the ordinary Friends overlay, and
closed it. That one-time qualification is retained evidence; a human is not a
recurring release-harness dependency. The consumer now exposes an opt-in
`STEAM_BRIDGE_QA_OVERLAY=1` native View-menu command which calls the same safe
`activateDialog("Friends")` API, logs a closed-schema `qa-menu` marker, and is
absent from production menus. Computer-driven QA opens the ordinary surface
through that visible command and closes it with Escape. The overlay was
correctly bounded to the native client at both
1280 by 720 and maximized sizes, with no right/bottom seam, purple surface, tiny
top-left surface, hang, or crash. The final steady state measured 59.8-59.9
source and native-present FPS against the current 60 Hz display, with zero
frame-latency timeouts and zero device losses. No checkout or subscription was
opened in this pass.

The Windows native module has now physically removed the abandoned attached
implementation rather than merely hiding it behind policy. It contains no
popup host style, owner/parent handle, parent subclass, popup clipping region,
external bounds override, or fallback branch. The ABI-compatible attach calls
return an explicit unsupported error without closing or replacing an existing
standalone surface, and external `setBounds` calls fail because the standalone
host owns its native geometry. Linux and macOS attachment code is unchanged.
The focused Rust, TypeScript, package, and unit gates pass, including 203/203
repository tests.

The post-pruning actual-game regression repeated ordinary Steam Friends open
and close through OS-level Shift+Tab, minimize/restore, maximize/restore,
fullscreen/restore, a live resize, and clean process shutdown. The overlay
remained inside the client with no seam, purple/tiny surface, flicker, hang, or
crash. A separate instrumented launch at 225% DPI recorded the exact 1280 by
720 logical client, 640 by 480 logical minimum, 60 Hz target, 59.9 native
present FPS at steady state, a frame-latency waitable swapchain, and zero frame-
latency timeouts, device losses, recoveries, or slow shared-texture copies.
Artifact roots are
`C:\Users\admin\steam-bridge-artifacts\fov-popup-prune-regression-20260721-220604`
and
`C:\Users\admin\steam-bridge-artifacts\fov-popup-prune-fps-20260721-221429`.

The exact local `0.3.6` tarball then exposed and closed an overlay-only pacing
gap. Game paint/native present held 59.9 FPS against the current 60 Hz display,
but Steam-active retained-frame pumping initially fell to a 47.7 FPS median
because the session scheduler reserved its early DXGI wake-up for construction-
time `continuousPresent`, while overlay activation enabled the same native mode
later. Scheduling from the applied continuous-present state raised a fresh real
checkout overlay to 60.0 FPS median pump/present across 32 samples (57.6 FPS
minimum during activation), with zero device loss, recovery, latency timeout, or
slow-copy counts. Electron paint was zero while Steam owned the visible frame;
the receipt therefore enforces game paint plus present and overlay present while
retaining overlay paint as a reported diagnostic. No transaction or subscription
was authorized. The focused artifact root is
`C:\Users\admin\steam-bridge-artifacts\fov-v0.3.6-pacing-manual-20260721-2330`.

The final `v0.3.6` proof attempt also exposed a receipt-design defect rather
than a runtime regression. Win32's modal menu loop can pause the telemetry
interval and produce one bounded DXGI frame-latency wait timeout; the window
then immediately returns to 59.9-60.4 FPS. Receipt schema 4 excludes telemetry
intervals longer than two seconds from pacing medians, allows at most three
cumulative menu-transition wait timeouts and three valid target/display
transition samples, and still rejects device loss,
recovery, slow shared-texture copies, stderr, crashes, unsafe transaction
activity, or sub-95%-of-refresh game/overlay medians. It also requires the
`qa-menu` ordinary-overlay marker and declares `humanInputRequired: false`, so
future candidate proof cannot silently restore the rejected physical-input
dependency.

Exact `v0.3.7` then passed its tag-bound GitHub Release workflow on macOS
arm64, Windows x64, Linux x64, and the exact Windows package/ASAR gate. Its
fully computer-driven actual-game pass covered the native File/Edit/View menus,
title drag, exact 640 by 480 minimum, maximize/restore, minimize/restore,
fullscreen/restore, focus return, rounded client edges, and an ordinary Friends
overlay opened at minimum size through the opt-in QA menu and closed with
Escape. The surface remained aligned to the client with no purple or tiny
surface, seam, flicker, device loss, slow copy, crash, or stderr. Focused
overlay presentation held a roughly 59.9 FPS median against 60 Hz. One valid
post-minimize sample reported the restored window while the renderer target was
still 1 FPS; later samples immediately returned to 60 FPS. Schema 3 rejected
that transition, so `v0.3.7` remains immutable and unpublished. Schema 4 was
tested against the unchanged raw logs and exact extracted 118-file candidate
and accepts that single transition while rejecting four. The retained evidence
root is
`C:\Users\admin\steam-bridge-artifacts\v0.3.7-rc-run-29971691514`.

Steam Deck requalification is complete for the current working candidate. The
Desktop core passed 21/21 routes and 42 screenshots; focused move, resize,
fullscreen, minimize/restore, same-host reuse, bottom-corner, progress-toast,
and unlock-toast proofs also passed. A true cold launch found that Steam can
report the overlay enabled before Linux `gameoverlayui` is safe to call;
immediate web activation crashed at address zero. The managed Wayland path now
has a configurable 3000 ms activation warmup, fail-closed synchronous helpers,
and wait-aware asynchronous helpers. Managed waits reserve the operation
without activating the presenter, leaving the host transparent, input-empty,
and at zero FPS until readiness is proven. The exact rebuilt package passed a
fresh 6/6 Desktop matrix with 11 screenshots and the bounded 2/2 Game Mode
readiness/compositor-native Store contract at 1280x800. The final checkout
reservation fix then passed the focused exact-candidate duplicate-open guard:
one target, duplicate suppression, visible activation, Escape close,
`active=false`, focus return, stable zero-FPS parking, and no crashes. The SSH
close probe found during that run now discovers and authenticates the active
Xauthority before sending input, and its self-test passes locally and on Deck.

Deck Desktop frame pacing is measured against KWin's authoritative output
state because Electron reports `displayFrequency=0` in this Wayland session.
KWin reports 90.004 Hz. Before presenter attachment the renderer measured
90.000 FPS (99.996% of refresh, 11.1 ms p50/p99). While the Steam browser was
visibly active it measured 86.68 and 86.84 FPS (96.3-96.5% of refresh), with
11.1 ms p50 and sparse 22.2-88.9 ms tail stalls. After Escape, the presenter
was conclusively parked at `currentFps=0` and its `pumpCount` remained exactly
2567, while the renderer measured 86.35 then 83.36 FPS. The remaining tail
stalls therefore occur while Steam's injected `gameoverlayui` process remains
attached, not from passive presenter pumping. A fresh app without that
post-activation process returns to the 90 FPS baseline.

On 2026-07-23, a focused Steam Deck Desktop Mode pass used a real Steam-launched
consumer game package in KDE Wayland. The Linux package helper path moved into
`steam-bridge/electron-builder`: the packaged executable is now a launcher that
renames the real Electron binary to `.bin` and starts it with
`--no-zygote --no-sandbox` before Chromium can create its first zygote. That
closed the Steam-injected `gameoverlayrenderer` zygote crash without leaving the
workaround in the consumer app. The game app still owns Deck window policy: it
creates its fullscreen BrowserWindow at the current display bounds from frame
zero, so the focused launch showed `1280x800` from the first overlay snapshot
and no transient `800x600` or tiny top-left Steam surface. A temporary CDP QA
harness drove DOM buttons because fixed Wayland/XTest coordinates selected the
wrong character and a later Shift+Tab XTest attempt opened KWin's switcher
instead of Steam; that input route remains rejected. The harness was removed and
the Deck wrapper restored after the run.

The same focused run reached the live game canvas, logged Babylon.js WebGL2
startup, and measured a `1280x800` canvas with rect `[0,0,1280,800]` at DPR 1.
It exposed and fixed a consumer cursor bug: `setGameCursorHidden(true)` returned
`false` on the Deck BrowserWindow path because the app only handled the Windows
native-host renderer. After the app fix, the IPC returned `true` and computed
cursor style was `none` on `html`, `body`, and the canvas. Programmatic
application IPC activation of a Steam web route over the live canvas returned
`true`, emitted `active=true`, used bounds `1280x800`, rendered Steam's
fullscreen overlay shell without KDE decoration or a tiny browser, then Escape
emitted `active=false` and returned to the game. KWin reported the display at
90.004 Hz; the live game measured 90.094 FPS before activation, 90.030 FPS while
Steam overlay was active, and 90.084 FPS after close, with 11.1 ms p50 frame
intervals in all three phases. Environment gotchas recorded for future runs:
keep the Deck in Plasma Wayland, keep QA wrappers LF-only, close DevTools, avoid
fixed compositor coordinates, and close Steam on every other platform before
collecting evidence.

After restoring the Deck wrapper to the normal non-CDP form, a final
Steam-launched sanity check showed no remote-debugging endpoint, no CDP command
line arguments, the packaged launcher still starting the `.bin` process with
`--no-zygote --no-sandbox`, `gameoverlayui` attached to the normal process, and
first snapshots still at `1280x800`. A bounded synthetic Shift+Tab retry with
explicit key-up cleanup again opened KWin's switcher and emitted no Steam
activation callback. That remains rejected automation evidence; use the app IPC
route or a physical/user hotkey for release QA instead of tuning XTest.

The following 2026-07-23 paired-host record is historical and superseded by the
single application-host architecture at the top of this checkpoint. It must
not be used as an active implementation or QA plan. That focused check opened
`DECK-WAYLAND-ACTIVE-RESIZE-001` after KWin raised the Electron source above a
paired Xwayland/GLX host during interactive resize. Read-only X11 sampling
showed that the host remained mapped, opaque, and continuously drawing changing
Steam frames; the visible black area was source WebGL occlusion rather than a
stopped Steam presenter.

That paired-host repair was retired before release and has no authority over the
current product. KWin pairing, source restacking, transparent/opaque companion
edges, and source-WebGL recovery are no longer product requirements. Do not
convert the application host to a popup, set `keepAbove`, recreate or remap it
during resize, use fixed compositor coordinates, or use synthetic Shift+Tab as
product evidence; those are closed paths, not fallbacks.

Local validation after the Deck pass: the consumer app passed `npm run lint`,
`npm run typecheck`, `npm test`, `node --check main/main.js`, and two Linux dir
packages. Steam Bridge passed `npm test` and `npm run package:smoke`. The first
package-smoke attempt exposed a Windows harness bug: Git Bash received a
`python3` shim but one POSIX self-test invoked `python`, falling through to the
Windows Store alias. The smoke harness now creates both shims and the rerun
passes with `STEAM_BRIDGE_PYTHON` pointing at the local Python executable.

Current Apple Silicon qualification uses the signed arm64 package on
`jeromystroh@Jeromys-MacBook-Pro.local`. Metal host readiness, Steam
launch/injection, direct web activation, native window transitions, and frame
pacing all pass. The 120.000 Hz Retina display (scale factor 2) measured
120.004 FPS before activation, 118.676 FPS with the browser overlay active, and
118.367 FPS after close. Restored, maximized, minimized/restored, and simple
fullscreen states retained exact content/host geometry and one native host
attachment; simple fullscreen measured 116.92 FPS and maximized measured
118.35 FPS. Steam-launched native Spaces fullscreen did not enter reliably, so
the smoke app uses Electron simple fullscreen while Steam Bridge recognizes
both native and simple fullscreen as fullscreen geometry. Window-state policy
remains application-owned.

The exact signed Apple Silicon full route matrix is now complete: 55/55 checks
passed at `/tmp/steam-bridge-macos-overlay-matrix-full-exact-final-20260719`.
It verified screen-pixel visibility, input close, focus return, capture health,
route lifecycle, passive parking, crash diagnostics, and all 1,130 native
methods against contract hash
`25cfd24fac158d8768732933c153bab01aa1618ac44a6f39eeba23920a443ba4`.
Earlier attempts correctly stopped at macOS TCC boundaries until Screen & System
Audio Recording and Accessibility were granted to the SSH automation host; the
accepted run used those permissions and did not weaken the proof fallback.

The Mac checkout is now fast-forwarded to the same `3da802d`/`0.2.14` baseline
as the Windows working tree and the modified runtime inputs match by SHA-256.
That exact rebuild exposed a package-source precedence bug: an old
target-named addon could override the fresh `steam_bridge_native.local.node`
created by `npm run native:build`. For ordinary current-host builds, the example
packager now prefers that local addon. Cross-target packages and explicit
`--artifacts-dir` release assemblies retain target-named artifact precedence.
Regression coverage proves all three branches. The
rebuilt signed arm64 package verifies all 1,130 expected native methods with
contract hash `25cfd24fac158d8768732933c153bab01aa1618ac44a6f39eeba23920a443ba4`,
and its launcher/Electron pair pass the arm64, signing, entitlement, launcher,
helper, and matrix self-test gates without starting Steam.

Live qualification uses one Steam client at a time. The Deck and macOS Steam
sessions were stopped before final Windows consumer QA. Exact `v0.3.0` at
`f5063b7` passed candidate workflow `29725066150`, but a later true cold Windows
launch exposed a first-activation race and rejects that unpublished tag. Steam
could discover the D3D surface before its `Present` hook was ready; an activation
could then be emitted without opening a usable Steam surface. A five-second
fallback was disproved by consecutive cold runs and has been removed. Exact
`v0.2.14` reproduced the same current-client timing, so this was not introduced
by `v0.3.0`, but the replacement must still handle it correctly.

Valve's browser-game guidance requires Steam initialization before graphics
device creation and continuous full-frame presentation from Chromium into a
native D3D window. The Windows persistent managed path now follows that contract:
the smoke app initializes Steam and registers callbacks before Electron readiness
and lazy-loads display services later; a managed readiness wait holds the native
surface transparent, non-activating, and click-through while presenting at 30
FPS; `IsOverlayEnabled` is the positive hook handshake; and the hold releases to
zero FPS on ready, abort, timeout, or close. No overlay activation or client-
session checkout operation is dispatched before that handshake. See
[Valve's overlay guide](https://partner.steamgames.com/doc/features/overlay?language=english),
[Valve's `ISteamUtils` reference](https://partner.steamgames.com/doc/api/isteamutils?l=english),
and the analogous Chromium multi-process constraint documented in
[WebView2Feedback #3200](https://github.com/MicrosoftEdge/WebView2Feedback/issues/3200).

The rebuilt source passed five consecutive full Steam shutdown/restart cycles:
all five Friends waits produced a visible, interactive, closable overlay, returned
focus, parked at zero FPS, and produced zero crash dumps. Hook readiness varied
from roughly 1.0 to 4.8 seconds, directly confirming that a fixed delay was the
wrong primitive. The focused regression suite proves attach and at least three
presents before activation, operation ordering for client-session checkout, and
zero-FPS cleanup after success and abort. All 215 repository tests, TypeScript
build, API/platform audits, Rust format/check, the complete package smoke, and
the platform helper and matrix self-tests pass. The complete locally assembled
package contains 42 entries and all nine target-native/runtime files; its
Windows Electron-builder ASAR/package gate passes. That local assembly reused
the verified `v0.3.0` cross-platform prebuilds because no native source changed;
exact `v0.3.1` main/tag CI and Release assembly rebuilt and bound fresh
artifacts successfully. Its protected Windows deployment also matched that
candidate exactly. Before the live route profiles, the required Steam-off
shortcut refresh exposed a QA-harness defect: diagnostic collection passed an
absent Steam process timestamp into a non-nullable PowerShell `DateTime`
parameter and emitted a false capture failure. The `0.3.2` replacement models
that timestamp as nullable; the same Steam-off shortcut flow captures its
diagnostics cleanly, verifies the shortcut, and passes all 215 tests. No native
or application runtime behavior changed from `v0.3.1`.

Exact `v0.3.2` then passed main/tag CI, Release assembly, independent candidate
verification, and protected deployment. Its persistent-reuse and checkout
profiles passed, and the shortcut profile completed its first eight routes.
The User route then rendered stacked Steam chat, suspicious-chat warning, and
Community-profile headers. The generic glyph detector correctly proved a
Steam web surface but selected an inner header's X; that click did not dismiss
the whole overlay, so the run failed closed and the final Dialog route was not
started. A focused Escape comparison also failed closed because it sent Escape
after activation but before the Steam web panel was visibly rendered. Those
two immutable roots prove the required composite boundary: User and Dialog
wait for the established modal geometry, dimmed backdrop, loaded content,
direct close glyph, exact pre-dispatch screenshot, and native-host focus, then
send native Escape to dismiss the complete stacked overlay. Ordinary web,
checkout, Store, Friends, profile, and other routes retain glyph-bound pointer
close coverage. `0.3.3` implements that harness-only split and its auditor
rejects missing readiness, reordered evidence, or incomplete native key input.
Current-source live diagnostics against the protected exact `v0.3.2` runtime
then passed User at
`C:\Users\admin\steam-bridge-artifacts\source-v0.3.3-user-diagnostic-20260721`
and Dialog at
`C:\Users\admin\steam-bridge-artifacts\source-v0.3.3-dialog-diagnostic-20260721`:
each proved full Steam web readiness, an exact physical pre-dispatch frame,
native Escape `2/2/0`, inactive/parked/focus-return completion, and zero
crashes. The faster Dialog close also exposed an auditor-only total-order bug:
the managed close-stable event can correctly precede result-file publication
because those are independent completion branches. The corrected partial-order
contract requires both branches before focus return and the single graceful
completion quit, and a fixture now covers that real ordering.
The exact `v0.3.3` workflow rebuilt and bound fresh artifacts; it did not reuse
either failed `v0.3.2` root.

Exact `v0.3.3` passed main/tag CI, three-platform Release assembly, canonical
tarball verification, protected deployment, and the persistent-reuse profile.
Its public checkout profile then passed the first three cases, but the
independent packaged auditor rejected
`04-shortcut-checkout-open-and-wait` at
`C:\Users\admin\steam-bridge-artifacts\windows-v0.3.3-receipt-checkout-20260721-220100`.
The surface opened and closed cleanly with exact glyph-bound pointer input
`3/3/0`, focus returned, the presenter parked, and crash count stayed zero.
The valid event order was close-stable, focus return, result publication, then
completion quit. Focus return and managed-result publication are independent
branches; requiring publication before focus return was another false total
order. `0.3.4` requires input before each branch and all focus, stable, and
result branches before the single completion quit, without ordering the
branches against one another. A checkout-shaped fixture covers the exact live
ordering. The run also exposed that the task wrapper reported only the inner
matrix exit and did not propagate its post-cleanup semantic audit. The `0.3.4`
wrapper now runs the packaged summarizer after cleanup evidence is durable and
returns nonzero on any rejection. No `v0.3.3` artifact may be reused for the
new receipt.

The release assembler now invokes the current Node executable directly instead
of using a deprecated Windows shell argument path. Commit/push, exact candidate
workflow, candidate-bound Windows receipt, GitHub Release, trusted npm
publication, and downstream registry verification remain. Package smoke on this
host requires Git Bash plus a real Python interpreter; the Microsoft Store
`python3` alias is not a valid POSIX-fixture runtime.

The source-linked Windows host now creates a frame-latency-waitable flip-model
swap chain, sets maximum frame latency to one, waits on the DXGI object, and
submits through `Present(1)` on a two-buffer flip-sequential chain. New shared
textures and CPU frames pump
immediately; the scheduled pump remains a retained-frame and Steam-overlay
fallback. On the development display's native 1920 by 1200, 165 Hz mode, DWM
reported 164.766 Hz. An opt-in renderer animation produced 145-149 game-surface
FPS and 162-165 native presents during gameplay. With the Steam checkout
overlay active, the source remained at 147-150 FPS and the native presenter at
163-165 FPS. Both phases had zero frame-latency wait timeouts and zero slow
shared-texture copies on the matching discrete-GPU adapter. The animation runs
only under the local FPS-report flag and is absent from normal development and
release execution. The shared-texture fence wait now has a hard upper bound so
a wedged GPU copy fails instead of spinning the Electron main thread forever;
swap-chain setup also closes a newly acquired wait handle on every failure path.

The final actual-game Windows pass used the production Electron `43.1.1`
consumer at 225% desktop scale. Electron's hidden renderer produced a
2883-by-1623 coded shared texture for a 1280-by-720 logical viewport, and
3459-by-2172 in fullscreen; the extra logical pixel was Chromium allocation
padding, not game content. Forwarding the full coded texture created narrow
side bars and a bottom overrun. Steam Bridge now accepts an explicit
`presentationRect`, crops that viewport into its retained texture, and then
presents it without imposing a browser-client aspect policy. The consumer sets
Electron 42+ offscreen `deviceScaleFactor` to the launch display scale and keeps
that renderer scale stable; scale factor 1 on Electron 42/43 reproducibly turned
live WebGL captures black after resize in both CPU and D3D forwarding, while
Electron 41 native scale and Electron 42/43 explicit native scale passed. The
corrected production game remained live through 1280-by-720 windowed,
1536-by-964 fullscreen, and restored 1280-by-720 transitions at 59-60 game and
native FPS against the current 60 Hz desktop, with zero bitmap fallbacks,
frame-latency wait timeouts, or slow shared-texture copies.

That same actual-game run passed native title drag, edge resize and the retained
640-by-480 logical minimum, rounded restored corners, File/View menu input,
maximize/restore, minimize/restore, fullscreen/restore, focus loss to Steam and
return, Win11 Snap Layout dismissal, and clean exit. Real checkout and
subscription routes opened at the correct centered size. Rapid repeated Buy
clicks had stacked multiple Steam pages, so the consumer now owns a request gate
that admits one pending/active web overlay and releases on close, activation
failure, or a bounded no-activation timeout. A triple-click then opened one
checkout and one close returned directly to gameplay; the next subscription
route proved gate release. No purchase or subscription was authorized.

The standalone host also accepts a validated menu tree, attaches a real Win32
menu, dispatches command IDs as `menuCommand` input events, preserves client
size when the menu changes, removes it in fullscreen, and restores it on return
to windowed mode. `WM_GETMINMAXINFO` enforces a logical minimum client size with
menu- and DPI-aware non-client adjustment. The source-linked consumer exposes
File/Edit/View, reports an exact 1280 by 720 client and 640 by 480 minimum at 96
DPI, and manually passed every File/Edit/View menu click, title drag,
maximize/restore, minimize/focus return, aspect-fit fullscreen, exact windowed
placement restore, rounded restored corners, and both minimum resize axes. The
instrumented host stopped at a 642 by 532 visible frame,
exactly the 640 by 480 client plus border/title/menu chrome. The menu/fullscreen
round trip returned to 162-165 native presents with zero wait timeouts.

The DPI follow-up keeps the standalone thread in per-monitor-v2 awareness,
reports the effective window/menu DPI, and stores the last normal logical
client size independently of whichever menu metrics Windows has already
switched during `WM_DPICHANGED`. It applies the suggested monitor rectangle and
then restores that stored logical client size with the new DPI's non-client
metrics. A live 100%-to-125%-to-100% transition retained an exact 1280 by 720
logical host (1600 by 900 physical at 125%, then 1280 by 720 physical at 100%)
and a 640 by 480 logical minimum. The menu can apply a consumer-requested 1.25
scale floor without changing the title bar, renderer, process scale, Windows
settings, or higher monitor scale. Its owner-drawn path retains the real HMENU,
system colors/font, keyboard mnemonics, command routing, and `MSAAMENUINFO`
accessibility metadata.

Shared-texture imports now mark the copied source frame dirty before Electron's
pooled texture is released. This closes the non-continuous-session hole where
the frame was copied but never presented. With the consumer's production
policy changed to `continuousPresent: false`, ordinary animated gameplay drove
both source and native presentation at roughly 159-165 FPS on the 165 Hz
display. Activating the real checkout automatically restored overlay-driven
continuous presentation: the source ran roughly 140-146 FPS and native
presentation roughly 155-162 FPS, with zero frame-latency wait timeouts and
zero slow shared-texture copies. Checkout was cancelled without authorization.

The local native linker now considers both Cargo's target release directory and
its `deps` directory and chooses the newest matching addon, preventing a stale
top-level DLL from masking current source changes. Native build/check and API
audit subprocesses no longer use deprecated Windows shell argument handling.
The final native review also closes an error-only ownership gap: if Windows
rejects insertion of a newly built owner-drawn menu item, the still-unattached
submenu is destroyed before the partial parent menu is torn down.

`steam-bridge@0.2.14` is npm `latest`. The earlier registry-backed checkout pass
that led to `v0.2.10` exposed one unhandled Steam window shape: closing a recurring
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
two-buffer flip-sequential presentation, source-aspect preservation,
per-monitor DPI,
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
pass. Exact `v0.2.12` at `2b66ef4` passed CI, Release assembly, independent
tarball verification, protected deployment, and public Steam readiness, but is
rejected and unpublished. During persistent-reuse close proof Steam replaced a
just-proved bright/spinner frame with its blank navigation frame before the
exact pre-dispatch screenshot. The probe correctly sent no input, but
incorrectly made that transient invalidation terminal. The retained failed
roots and immutable tag are diagnostic evidence only.

The `v0.2.13` repair kept the same fail-closed boundary: input remained
forbidden unless the exact pre-dispatch screenshot proves the current Steam
panel and close target. A transient frame replacement now records an explicit
readiness-invalidation event and retries inside the existing overall deadline.
The semantic auditor requires every extra readiness proof to have exactly one
ordered invalidation before the final successful proof for that cycle. Package
smoke also now derives Steam userdata IDs with native path components instead
of literal POSIX separators, so the Linux fixture is valid under both POSIX and
Windows-native Python hosts. Exact `v0.2.13` passed main/tag CI, Release
assembly, independent candidate verification, protected deployment, the
three-cycle persistent profile, all four checkout cases, and all ten shortcut
routes. Its managed profile then stopped fail-closed on the fully rendered
Friends panel. The coarse close-glyph scan had forced an even coordinate
origin, permanently skipping a valid close glyph centered on the other Y
phase. After that was repaired, a generic brightness sampler still rejected
Friends' intentionally near-black navigation strip even though the direct
close glyph, modal backdrop, geometry, and loaded content were all proved.
No input was sent in either rejected run, no process crashed, and the tag is
unpublished diagnostic evidence only.

The `v0.2.14` repair preserves each screenshot search rectangle's coordinate
phase and accepts the directly sampled, thresholded close glyph as chrome
evidence for the black-navigation layout. It does not relax dispatch: exact
glyph score/coordinates, modal containment, dark backdrop, loaded content,
foreground ownership, and the exact pre-dispatch frame remain independently
mandatory. A focused protected-candidate Friends rerun found the glyph at its
actual coordinate with a 15/16 score, dispatched one bounded click, completed
the active/inactive/park lifecycle, retained Steam continuity, deleted its
task, and passed the independent semantic summarizer with zero crashes.
The final immutable candidate then passed all four ordered profiles: 31/31
clean cases, 27 active Steam routes, one unchanged protected candidate and
Steam identity, and zero crashes. The exact npm tarball and five GitHub Release
assets were independently verified before and after trusted publication.

### Historical Consumer Evidence

FOV4 commit `04769fd` (`Port native host to Steam Bridge 0.3.8`) is pushed to
`master`. Its manifest, lockfile, and ordinary non-link install resolve exact
registry `steam-bridge@0.3.8` with the published integrity above. The final
registry-backed actual-game smoke opened the ordinary Friends overlay at the
same 1280 by 720 client bounds, closed it with Escape, returned to the game,
and shut down with empty stderr. The broad immutable candidate pass also
covered exact 640 by 480 minimum sizing, title move, native menus,
maximize/restore, minimize/restore, focus loss/return, fullscreen/restore,
rounded bottom corners, cursor behavior, overlay alignment, and clean close.
The consumer passes 16/16 tests, ESLint, TypeScript, 705 verified registry
signatures, and 132 verified attestations.

The remaining consumer paragraphs are retained historical evidence from the
`0.2.x` qualification path; they do not override the current `0.3.8` state.

The Electron game consumer now has an exact non-junction registry install of
`steam-bridge@0.2.14`; its manifest and lockfile bind the published tarball and
integrity. The opt-in FPS report measured both Electron paint/
shared-texture arrivals and native presenter frames across game and checkout-
overlay phases without changing normal execution. The source ran at roughly
146-150 FPS while the native presenter held roughly 163-165 FPS against the
164.766 Hz DWM cadence. Native diagnostics measured a 1280 by 720 logical
client, 640 by 480 logical minimum, attached menu, 96 DPI, and the 165 Hz
target. File/Edit/View menu interaction, title drag, maximize/restore,
minimize/focus return, fullscreen round trip, and an exact 640 by 480
minimum-client resize passed. A fresh 2026-07-19 clean restart repeated the
exact 1280 by 720 default client, keyboard and mouse menu traversal, title drag,
minimum resize, maximize/restore, minimize/focus return, and fullscreen aspect
preservation. Buy and subscription routes opened at the correct size in both
default and manually resized hosts; Escape closed them without authorization,
and the adopted Steam confirmation dialog remained centered after a focus
round trip. The process then shut down cleanly. A prior synthetic Shift+Tab
injection was not accepted by Steam, so it is not counted as ordinary-overlay
proof.

The final DPI and presentation pass removed the process-wide Chromium
`force-device-scale-factor` override. The bridge owns PMv2 conversion,
non-client/menu metrics, minimum tracking, DPI-transition geometry, and the
one-shot/continuous presentation contract; the consumer owns the 1280 by 720
logical viewport, 640 by 480 minimum, 1.25 menu floor, and non-continuous game
policy. The hidden Electron renderer reconciles its content size after a host
DPI change without changing the game aspect ratio. Live testing at 100%, 125%,
and the earlier 225% environment passed title drag, edge resize, minimum size,
rounded corners, maximize/restore, minimize/focus return, fullscreen round
trip, menu keyboard/mouse input, aspect-preserving rendering, and real checkout
open/cancel at both default and manually resized host sizes. The overlay stayed
inside the game client and did not collapse into the former tiny top-right
surface.

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
directory at `0.2.14`. The final registry-backed process repeated the exact
1280 by 720 client geometry, native File/Edit/View menus, title drag,
maximize/restore, minimize/focus return, aspect-fit fullscreen, exact 640 by
480 minimum-client sizing, and checkout open/cancel without flicker, hang, or
crash. The minimum-size checkout pass exposed a consumer compositor issue:
Steam hooked both the fixed offscreen Electron surface and the visible native
host, so differently scaled viewports revealed the same overlay twice. The
consumer now retains its last clean game frame while Steam is active and lets
Steam composite only into the visible host. A repeat at the exact minimum
showed one centered checkout surface; Escape returned to a fresh game frame and
authorized no transaction. Consumer commit `44b8928` is pushed to `master`.

### Historical `v0.2.14` Release Evidence

Source and automation:

- commit `3d0678bbe4d8c98c3511904aedcbdbead0250cf6`;
- tag CI `29681862974` and Release assembly `29681862973` passed, including
  macOS arm64, Linux x64, Windows x64 prebuilds, package assembly, and packaged
  Electron validation;
- trusted npm publication `29682898297` passed after restoring the exact
  candidate-bound receipt in the `npm-production` environment;
- public GitHub Release: <https://github.com/jstroh/steam-bridge/releases/tag/v0.2.14>.

Candidate identity:

- npm tarball SHA-256
  `70de36d8b5c9e5f76a4957f4392023ffdd825d94a101de20336513a6840b8947`;
- Windows archive SHA-256
  `6498a57fa8921677f82e47af1ec3747abb2304ab3d2f3aa14bb7ff803b70b7a2`;
- Windows bundle content: 114 files, 398,368,378 bytes, SHA-256
  `de6d5e5166d9f1b2efe23ae471815d2c0ce1b2a2d43cea9acef9ca69a859ef12`;
- native binding: 1,129 methods, declaration SHA-256
  `7cce9c4c750e754c8b804e6cb7d9ba6a0526d0e03cd16adb8c3f78c5a3c23bf8`;
- candidate binding SHA-256
  `b80aa46d8ea63d70d48bb13fa9fe5ccfe5af5d374a294d627697d6c40876dbe8`;
- live-proof receipt semantic SHA-256
  `3daadf8eca5ca79efc71b000c7b69198ee7917498b8d8ca5d1f514676d6d4509`.

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

### Historical v0.3.8 Verification

Current `v0.3.8` verification is complete: 203/203 Steam Bridge tests pass with
zero skips, the full cross-platform package smoke and exact Windows packaged
native-load gate pass, tag workflow `29973234900` passes all release jobs, the
candidate-bound actual-game receipt passes, all five public GitHub Release
assets match retained local digests, the registry tarball is byte-identical to
the audited candidate, and npm provenance is present. FOV4's exact registry
consumer passes 16/16 tests, ESLint, TypeScript, signature/attestation audit,
and the focused post-publication actual-game smoke. The temporary release proof
secret was deleted after publication.

The remaining paragraphs in this section are retained historical verification
for `v0.2.14`; they are not the current release status.

The reviewed `0.2.14` source passes 206/206 repository tests, TypeScript, Rust
format and compile checks, the platform policy, Steam API coverage, and the
complete package smoke on Windows with the available Git Bash host. The first
smoke invocation correctly exposed that `bash` was absent from the default
PowerShell path and that the available Windows-native Python needed an explicit
Git-Bash path/home adapter; rerunning with those host tools supplied completed
the gate. The package fixture's separator bug was fixed in source rather than
hidden by the adapter. Strict workspace Clippy remains an informational baseline
failure across generated compatibility declarations and longstanding crate-
wide lints; the required zero-warning release checks are Rust formatting and
compilation. The consumer passes ESLint, TypeScript, 4/4 tests, and its
optimized renderer build. Commit, exact-candidate proof, publication, release
assembly, registry verification, and the final consumer pass are complete.

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

Consumer gates on registry `0.2.14` passed:

- 4/4 tests, TypeScript, ESLint, optimized Next renderer build;
- exact non-junction install, lockfile integrity, registry tarball byte identity,
  package signatures, and provenance;
- live 1280 by 720 geometry, title drag, minimize/focus return,
  maximize/restore, aspect-fit fullscreen, exact 640 by 480 minimum sizing,
  single-surface checkout at default and minimum size, and clean cancel return.

### Historical Operational Notes

- Windows production invariant: use one standalone top-level native D3D game
  host with Electron offscreen. Attached `popup-layered`, the unparented
  overlapped comparison, `owned-popup`, popup-region synchronization,
  retained-frame resize stretching, and the no-Steam-pixels `WS_CHILD`
  experiment are closed paths. Attached Windows mode must fail clearly and must
  not fall back between these models.
- Windows active-overlay input invariant: Steam owns mouse capture on the exact
  standalone host HWND. Active title drag, edge resize, maximize/minimize,
  system-menu commands, and application fullscreen shortcuts are therefore
  expected no-ops while that capture is held. Prove stable aligned presentation,
  external focus/display/DPI handling, capture release on close, and immediate
  post-close window-management recovery. Never use `ReleaseCapture`, synthetic
  non-client messages, or a popup/child host to defeat Steam's modal boundary.
- The JavaScript boundary now rejects every Windows `nativeWindowHandle`
  attachment before it claims a surface lease or invokes the native addon. The
  unreachable deferred-attach presenter branch and its Windows popup-era tests
  were removed. Platform-neutral presenter lifecycle and ownership coverage
  remains active under supported Linux attachment; a Windows regression proves
  raw attach, session attach, presenter attach, and default managed Electron
  attach all reject without native attach/detach calls, after which a standalone
  session still opens and closes normally.
- Shared-texture import now classifies device-loss HRESULTs at the point of
  detection. A successful adapter/swap-chain rebuild increments both loss and
  recovery telemetry; a failed rebuild leaves the surface marked device-lost
  for the next valid shared texture. Native check/test, TypeScript, the
  standalone receipt self-test, and all 203 active repository tests pass with
  zero skips after this review.
- The standalone receipt no longer accepts a single best FPS sample or ignores
  Steam-overlay-active pacing. It requires at least three synchronized,
  non-minimized game samples and three synchronized overlay samples. A target
  within 1 Hz of the current display is steady state; at most three otherwise-
  valid target/display transition samples may be excluded, while four fail the
  proof. It requires median Electron paint plus native present FPS to reach 95%
  during the game phase, and median native present FPS to reach 95% while Steam
  owns the visible overlay frame. Overlay-phase Electron paint FPS remains
  reported but may be zero. Critical consumer files, the evidence manifest,
  and both logs must be real in-root files rather than symlink or reparse
  escapes, and the consumer runtime is re-read after validation to detect
  mutation during receipt generation.
- During implementation, run only tests and live transitions affected by the
  current edit. Run the complete cross-platform/release matrix once, after the
  implementation is stable and immediately before publication.
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

### 2026-07-22 Windows actual-game exhaustive QA update

An actual FOV4 game pass was run from
`C:\Users\admin\source\fov4-steam` with Steam Bridge QA overlay and FPS
reporting enabled. Receipts live under
`C:\Users\admin\steam-bridge-artifacts\fov-windows-exhaustive-qa-20260722-205311`.

Covered launch, menu clickability, fast title drag, resize sweeps, exact
`640x480` logical minimum, maximize/restore, minimize/restore,
fullscreen/restore, focus loss/return, Friends overlay open/close, 165 Hz,
60 Hz, high DPI, and `1280x800` low-resolution mode. The overlay stayed bounded
to the client and did not reproduce the old purple/tiny/full-chrome/seam/crash
failures.

Important result: game presentation hits the active display target at both
60 Hz and 165 Hz after transitions. The initial exhaustive pass found
Steam-overlay-active presentation visually correct but paced around 130-133 FPS
median on the 165 Hz display, below the 95% high-refresh pass threshold.

A focused local-source repair retest then linked the unpublished Steam Bridge
build into FOV4 and repeated only that failing 165 Hz Friends-overlay scenario.
Receipts live under
`C:\Users\admin\steam-bridge-artifacts\fov-windows-overlay-165-focused-20260722-212404`.
The display was switched from `1920x1200@60` to `1920x1200@165` for the retest
and restored to `1920x1200@60` afterward. The overlay stayed bounded to the
game client, no FOV/Electron process remained after close, stderr was empty,
and 48 overlay-active 165 Hz samples produced `163.75 FPS` median native
present against the `156.75 FPS` pass threshold. Treat this individual finding
as green; do not reopen retired popup, owned-popup, or `WS_CHILD` presenter
paths for it.

Final Windows actual-game QA then passed after the individual failures were
green. Receipts live under
`C:\Users\admin\steam-bridge-artifacts\fov-windows-exhaustive-qa-final-20260722-2230`.
The final run covered actual-game launch into the world, Steam startup toast,
File/Edit/View menu clicks, title drag, fast drag, resize, minimum clamp,
maximize/restore, fullscreen/restore, focus away/back, baseline overlay,
60->165 Hz live transition, 165 Hz game hold, 165 Hz overlay, `1280x800@60`
low-resolution overlay, restore to `1920x1200@60`, `200%->100%` scale change,
overlay at `100%`, restore to `200%`, and clean File -> Exit. The overlay
remained bounded to the client with no chrome coverage, no right/bottom seam,
no tiny top-left Steam surface, no steady flicker, no crash, empty stderr, and
no leftover Electron process. Display settings were restored to
`1920x1200@60` and `200%` scale.

Final representative medians were: baseline 60 Hz overlay `59.9 FPS`, 165 Hz
overlay `162.65 FPS`, 165 Hz steady-state game surface `157.55 FPS` against
the `156.75 FPS` pass threshold, low-resolution overlay `59.9 FPS`, and
`100%`-scale overlay `59.9 FPS`. High-refresh game-surface scoring must use
steady-state windows after the live mode transition and outside overlay
open/close boundaries; transition-contaminated all-sample medians are useful
diagnostics, not the pass/fail number.

The current fixes validated by the pass are Steam Bridge's Windows standalone
display-synchronized immediate pump scheduling and FOV4's renderer display /
`webContents.setFrameRate()` refresh pulses after live display or DPI changes.
Going forward, if a QA item fails, fix and focused-retest only that item until
it is green. Run the full exhaustive Windows actual-game pass only after every
known individual failure is green and immediately before a release decision.

### 2026-07-26 Windows Steam-modal capture finding

A source-linked actual FOV4 checkout probe at the active 165 Hz display rate
resolved the ambiguity around window management while Steam's Windows overlay
is visible. Native diagnostics reported `GetCapture()` as the exact standalone
game-host HWND. During attempted title drag, right-edge resize, maximize,
minimize, system-menu, and fullscreen input, the outer rectangle did not change
and the host received no `WM_NCLBUTTONDOWN`, `WM_NCLBUTTONUP`, `WM_SYSCOMMAND`,
`WM_ENTERSIZEMOVE`, or `WM_EXITSIZEMOVE`. This was not a child/popup alignment
failure: the single D3D host remained focused, the overlay remained exactly
bounded and visually stable, and retained presentation held about 165 FPS with
no wait timeout, device loss, or slow copy.

Escape emitted the inactive transition, `GetCapture()` returned null, and a
title-bar drag immediately moved the same host. The Windows QA contract now
records active move/resize/maximize/minimize/fullscreen as
`STEAM-MODAL-CONSTRAINT`: attempts must prove Steam owns the capture, the host
does not mutate or flicker, and ordinary window management resumes after close.
Focus away/back and externally initiated display-mode, refresh, resolution, or
DPI changes remain required active-overlay stress where applicable. Do not
release Steam's capture, inject non-client messages, enter a synthetic
`DefWindowProc` move loop, or revisit popup/`WS_CHILD` architectures.

### 2026-07-28 Windows final source-linked QA

After the Deck Game Mode orientation repair, Windows received focused coverage
only for the two affected native surfaces. A full pass followed after both were
green.

The first focused red was a full-event-loop-turn dirty-frame pump that reduced a
settled 165 Hz game surface to about 143.6 FPS. Coalescing on one microtask
restored representative medians of 164.8 FPS baseline, 164.75 FPS with the real
Steam overlay active, and 164.4 FPS after close. Renderer rAF stayed near
165.017 FPS and all device-loss, recovery, and slow-copy counters remained zero.

The second red was low-resolution work-area overflow. The same standalone HWND
now centers and clamps on display/work-area notifications without replacing the
host or overwriting the remembered logical client. At `1280x800@60` and 125%
scale, the entire 1280x752 outer frame remained visible, the real Steam overlay
matched the client including its rounded bottom corners, and eight settled
samples produced 59.95 FPS present, 60.0 FPS paint, and 60.002 FPS rAF. Returning
to `1920x1200@60` restored the exact 1600x900 physical / 1280x720 logical client.

The final pass also covered the 100% and recommended 125% scale profiles, File/
Edit/View menu clicks, slow/fast/reversing title movement, 1000x600, 800x500,
640x480, rejected 500x300, and restored 1280x720 logical resize requests,
maximize/restore, minimize/restore, focus loss/return, aspect-preserving
fullscreen/restore, overlay open/duplicate/close, active-modal no-op window
commands, 60/165 Hz transitions, and the 1280x800 low-resolution profile. The
machine finished at its original `1920x1200@60` and recommended 125% scale.

Do not spawn a disposable Notepad or other auxiliary UI application for future
focus QA. A redundant post-pass attempt exhausted the external capture helper's
D3D resources and destabilized the controller; it was not valid product
evidence. Use an existing operator-approved focus target or direct native focus
state, without capturing the unrelated window. The game was subsequently
re-entered and a focused settled rAF retest passed at 60.002 FPS.

### 2026-08-03 Native API audit memory failure

Cross-platform CI exposed two new Windows frame-wait methods that were
incorrectly marked optional in the exact `NativeBinding` ABI. The audit's
assertion also retained the unexpected TypeScript AST node while formatting
the failure, exhausting Node's heap instead of reporting the contract error.
The methods are now required in the interface, while runtime feature detection
still preserves compatibility with older native binaries. The validator now
asserts a boolean condition so future optional-method mistakes fail promptly
without retaining or rendering an AST graph.
