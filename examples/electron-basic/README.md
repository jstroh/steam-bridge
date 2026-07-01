# Steam Bridge Electron Smoke

This is a tiny Electron app for proving that Steam Bridge can initialize Steam,
read basic Steamworks state, and exercise overlay paths on supported Steam
desktop platforms. The deepest automated coverage currently targets Steam Deck
Desktop Mode and macOS Apple Silicon; Linux x64 helper coverage is verified
through the Deck, and Windows x64 helper coverage is implemented pending a live
Windows Steam run.

It uses Valve's SpaceWar sample App ID `480` by default. Override it with
`STEAM_BRIDGE_APP_ID` when testing your own app.

The default Electron overlay profile is `diagnostic`, which applies conservative
Electron switches and avoids forcing Chromium's in-process GPU path. Set
`STEAM_BRIDGE_ELECTRON_OVERLAY_PROFILE=repaint` when an event-driven Electron
renderer needs fresh frames for Steam's overlay. Set
`STEAM_BRIDGE_ELECTRON_OVERLAY_PROFILE=compatibility` only when you specifically
want the more aggressive Linux/Desktop workaround that also enables Chromium's
in-process GPU path.

## Development

```sh
npm run native:build
npm run example:start
```

The app writes `steam_appid.txt` for local smoke testing before it initializes
Steam.

## Packaged Smoke Builds

Download release artifacts from a successful `Release` workflow, then package a
self-contained Electron smoke app:

```sh
gh run download <run-id> --dir /tmp/steam-bridge-release
npm run example:package:mac -- --artifacts-dir /tmp/steam-bridge-release
npm run example:package:linux -- --artifacts-dir /tmp/steam-bridge-release
npm run example:package:win -- --artifacts-dir /tmp/steam-bridge-release
```

For the current host platform, `npm run native:build` is enough for a local
package check. The packager will stage `steam_bridge_native.local.node` under
the target prebuild name when a release prebuild is not present:

```sh
npm run native:build
npm run example:package:mac
```

The Windows package includes `windows-electron-smoke.ps1`. Use
`-Mode print-launch-options` to generate non-Steam shortcut arguments, or
`-Mode steam-launch` with `-ShortcutGameId` to verify the shortcut result. The
helper accepts the same generic smoke action names as the Deck/macOS helpers,
including `presenter-ready`, `presenter-web-open-and-wait`,
`presenter-store-open-and-wait`, `presenter-friends-open-and-wait`,
`presenter-dialog-auto-open-and-wait`, `presenter-checkout`,
`presenter-shortcut`, `presenter-shortcut-open-and-wait`, and the passive
achievement notification actions.

Outputs are written under `dist/electron-smoke/<target>/`.
The macOS package includes `macos-electron-smoke.sh` beside
`SteamBridgeSmoke.app`; the Linux package includes `linux-electron-smoke.sh`.
On macOS, the packaged app installs a small native launcher as the bundle's main
executable and moves Electron to `SteamBridgeSmoke.electron`. Steam still
launches the normal `.app` executable path, while the launcher sets the Steam app
and overlay game IDs before `exec`ing Electron. The launcher and entitlement
files come from the published `steam-bridge` package templates, so real apps can
reuse the same shape without copying smoke-app-specific files. The example does
not keep a local macOS entitlement plist; the package CLI supplies the template
that real apps should reference from their own build pipeline.

## Autorun Logs

For scripted checks, set `STEAM_BRIDGE_SMOKE_AUTORUN=1`. The app will open,
optionally trigger one overlay action, print one line beginning with
`STEAM_BRIDGE_SMOKE_RESULT `, and quit.

```sh
STEAM_BRIDGE_SMOKE_AUTORUN=1 \
STEAM_BRIDGE_SMOKE_AUTORUN_ACTION=dialog \
STEAM_BRIDGE_SMOKE_AUTORUN_RESULT_DELAY_MS=5000 \
./SteamBridgeSmoke --no-sandbox
```

For web overlay checks, the default URL is the app's Steam store page. Override
it with `STEAM_BRIDGE_SMOKE_WEB_URL` and set
`STEAM_BRIDGE_SMOKE_WEB_MODAL=1` when you need to exercise a modal checkout or
approval URL for your own Steam app. Add
`STEAM_BRIDGE_SMOKE_REQUIRE_OVERLAY_ACTIVE=1` when the test must fail unless
Steam reports an active overlay.

The Linux, Steam Deck, and macOS helpers expose the same settings as
`--web-url` and `--web-modal`:

```sh
npm run steam-deck:smoke -- \
  --host deck@<deck-host-or-ip> \
  --mode game \
  --action web \
  --web-url https://store.steampowered.com/app/480/ \
  --web-modal false
```

For macOS Apple Silicon packaging checks, use the packaged helper beside the
`.app` bundle:

```sh
dist/electron-smoke/aarch64-apple-darwin/SteamBridgeSmoke-darwin-arm64/macos-electron-smoke.sh \
  --mode print-launch-options \
  --macos-native-launcher \
  --action presenter-web \
  --web-url https://store.steampowered.com/app/480/ \
  --web-modal true
```

The macOS helper can also discover and launch the matching Steam non-Steam
shortcut after you add or update it in `shortcuts.vdf` and restart Steam:

```sh
dist/electron-smoke/aarch64-apple-darwin/SteamBridgeSmoke-darwin-arm64/macos-electron-smoke.sh \
  --mode print-shortcuts

dist/electron-smoke/aarch64-apple-darwin/SteamBridgeSmoke-darwin-arm64/macos-electron-smoke.sh \
  --mode steam-launch \
  --action presenter-web-open-and-wait \
  --web-url https://store.steampowered.com/app/480/ \
  --web-modal true \
  --require-steam-launch \
  --require-overlay-injection \
  --require-overlay-enabled \
  --require-overlay-activated \
  --require-event overlay:presenter-open-and-wait-start \
  --require-no-crashes \
  --close-probe
```

For macOS presenter diagnostics, `--native-host-backend metal` and
`--native-host-backend opengl` select the native host backend used by the smoke
app. This is a diagnostic comparison control, not an app-builder API.

Use `presenter-ready` when you want a cheap managed-overlay preflight before
opening any Steam UI. It creates the same `createElectronSteamOverlay(...)`
manager used by the product actions, records `overlay:presenter-ready`,
captures `snapshot.overlay.nativePresenter`, and captures
`snapshot.overlay.nativeHostAvailability` without calling a Steam overlay
activation API:

```sh
dist/electron-smoke/aarch64-apple-darwin/SteamBridgeSmoke-darwin-arm64/macos-electron-smoke.sh \
  --mode steam-launch \
  --action presenter-ready \
  --require-steam-launch \
  --require-overlay-injection \
  --require-electron-overlay \
  --require-presenter-mode persistent \
  --require-idle-presenter \
  --require-no-overlay-activation \
  --require-no-crashes
```

On macOS, this preflight does not require `overlayEnabled=true`: Steam may
attach a dormant `gameoverlayui` target before any visible overlay activation.

`--close-probe` is a helper-runner check, not an app launch option. It keeps the
smoke app open after the initial result, leaves the active Steam overlay focused
for the macOS close input, and verifies `active=false`, app focus return,
`openAndWait(...)` completion after close, idle presenter parking, and no crash
evidence.

For macOS passive-toast proof, use the same packaged helper with the passive
notification gate:

```sh
dist/electron-smoke/aarch64-apple-darwin/SteamBridgeSmoke-darwin-arm64/macos-electron-smoke.sh \
  --mode steam-launch \
  --action presenter-achievement-progress \
  --result-delay-ms 1200 \
  --keep-open-after-result \
  --require-steam-launch \
  --require-overlay-injection \
  --require-overlay-enabled \
  --require-passive-notification \
  --require-no-crashes
```

To run the repeatable macOS proof matrix after the Steam shortcut is configured,
use:

```sh
npm run macos:overlay-matrix -- \
  --steam-user-id <steam-userdata-id> \
  --suite core
```

The matrix installs or updates one stable Steam shortcut that points at the
in-bundle native launcher and a launcher env file. Each case rewrites only that
env file before launching the shortcut, so Steam is restarted only when the
shortcut itself was added or materially changed. It runs the packaged helper and
collects result and diagnostic logs under `/tmp`. Its `minimal` suite covers the
web/store/Friends/dialog `openAndWait(...)` paths plus passive achievement
toast verification; `core` adds passive unlock, synthetic checkout approval
route, managed Shift+Tab shortcut routing for every supported presenter-backed
target, profile, community, stats, achievements, and user chat/profile routes.
Use `--suite full` to add user SteamID plus every known high-level
dialog-equivalent route through the same managed `openAndWait(...)` close/park
proof.
Use `--suite checkout` for focused private purchase proof: it runs checkout
prepare-only, direct checkout, managed Shift+Tab checkout, and programmatic
shortcut checkout/open-and-wait cases. Pair it with `--app-id <your-app-id>`,
`--checkout-json-file <private-init-txn-response.json>`, and
`--require-microtxn-callback` when the direct checkout case should receive
Steam's authorization callback; that callback requirement is rejected unless the
private checkout JSON handoff is configured.
Use `--suite persistent` to launch the smoke app once through Steam, start the
token-protected localhost control server, drive the full web/store/Friends,
dialog-equivalent, passive notification, checkout, managed Shift+Tab shortcut,
profile, players, community, stats, achievements, and user overlay inventory
through that one running process, and then quit it through the control server.
This suite is for proving repeated overlay routes inside one app lifecycle
without fixed cooldowns, repeated app launches, or Steam restarts.
If Steam launches and injects the smoke app but a managed wait times out while
the run is still crash-free (`be ready` before `overlayEnabled=true`, or
`become active` after the action succeeded), the persistent runner preserves
that attempt under an `.attemptN` artifact directory, quits/cleans up through
Steam tracking evidence, and retries once.
Use `--suite unavailable` only when macOS genuinely reports the screen locked or
the display asleep. That suite captures expected managed web, checkout-open,
checkout-prepare, and `presenter-shortcut-open-and-wait` fail-fast artifacts
with `STEAM_OVERLAY_NATIVE_HOST_UNAVAILABLE`, the matching
`nativeHostUnavailableReason`, and no Steam overlay activation. The shortcut
case records the managed wait start and configured target, but it must not emit
`overlay:shortcut-open` because the public helper never reaches Steam overlay
activation while the native host is unavailable. Live
unavailable runs auto-detect `macos-screen-locked` or
`macos-display-asleep`; pass `--expected-native-host-unavailable-reason` when
you need the capture to fail unless the specific state matches. Locked macOS
sessions can also report the display asleep; `macos-screen-locked` takes
precedence in that case. Unavailable captures do not require
`overlayEnabled=true`, because the native host is intentionally never created.
Use `--dry-run` to inspect the stable shortcut setup, env-file path, and helper commands
without launching Steam.

The packaged smoke app also has an opt-in localhost control server for
one-process overlay proof work. Launch it through the same Steam shortcut with
`macos-electron-smoke.sh --control-server --control-file <path> --control-token <token>`;
the helper returns once the running app writes the control JSON instead of
waiting for an autorun result. The server is bound to `127.0.0.1`, requires the
token on every request, and reuses the same internal smoke actions and
`STEAM_BRIDGE_SMOKE_RESULT` payload shape as autorun. Control actions accept the
same per-action options as autorun, so a persistent matrix can change checkout
inputs, dialog names, user dialog routes, web modal settings, achievements, and
managed Shift+Tab shortcut targets without restarting the app. Use
`macos-electron-smoke.sh --mode control-action --control-file <path> --control-token <token>`
to run and verify one action against the live process, and
`macos-electron-smoke.sh --mode control-quit --control-file <path> --control-token <token>`
to shut it down. This is test harness plumbing for persistent app-lifecycle
matrices; it is not part of the app-facing Steam Bridge API and Electron
builders do not need to use it.

For launcher-aware macOS checks, generate shortcut launch options with
`--macos-native-launcher --launcher-env-file <path>` and fully restart Steam
after editing `shortcuts.vdf`. Once that stable shortcut is loaded, repeat
cases can update the env file without restarting Steam.
`--action-delay-ms` can move the autorun action later when comparing Steam
launch/readiness behavior; keep normal product paths callback-driven.

For packaged macOS smoke builds, the example packager runs
`steam-bridge-prepare-macos-app` from the staged package. That CLI compiles the
published `templates/macos-steam-env-launcher.c` launcher, renames Electron to
`<AppExecutable>.electron`, keeps the launcher as `CFBundleExecutable`, ad-hoc
signs both executables with the Steam-compatible entitlements in
`templates/entitlements.steam.macos.plist`, and verifies the final shape before
Steam launches it. That template enables
`com.apple.security.cs.allow-dyld-environment-variables` and
`com.apple.security.cs.disable-library-validation`, and intentionally does not
enable `com.apple.security.app-sandbox`. The native launcher remains the main
bundle executable so Steam can inject its overlay renderer, then the launcher
sets `SteamAppId`, `SteamGameId`, and `SteamOverlayGameId` before executing
Electron. Do not rely on Steam overlay injection into Electron helper
processes; Steam Bridge scrubs those child-process overlay environment entries
so the bridge-owned native presenter stays the single overlay target.

The macOS full overlay matrix is run against this signed package shape; a
signed-package artifact at
`/tmp/steam-bridge-macos-overlay-matrix-full-signed-package-20260629-234357`
passed 31 Steam-launched App ID `480` cases across managed wait routes,
passive notifications, checkout approval routing, all supported shortcut
targets, all high-level dialog-equivalent routes, close/back-to-app proof,
zero managed overlay timing, and crash diagnostics.

For shipped apps, apply the same entitlements through your normal Apple signing
and notarization pipeline to the app process Steam launches and the executable
that process `exec`s.
The macOS matrix preflights those requirements with
`scripts/verify-macos-steam-signing.cjs`: the bundle `Info.plist` must name the
native launcher as `CFBundleExecutable`, and both the native launcher and
renamed Electron executable must be arm64-only, validly signed, allow dyld
environment variables, disable library validation, and omit App Sandbox before
Steam is launched.
The preparation CLI is published with the package as
`steam-bridge-prepare-macos-app`, so app projects can run
`npx steam-bridge-prepare-macos-app --app-exe <YourApp.app/Contents/MacOS/YourApp>`
after their normal Electron package step.
The same verifier is published with the package as
`steam-bridge-verify-macos-signing`, so app projects can run
`npx steam-bridge-verify-macos-signing --app-exe <YourApp.app/Contents/MacOS/YourApp>`
against their own signed release bundle.

The same controls are also available as launch options, which is usually easier
for Steam non-Steam shortcuts:

```sh
--steam-bridge-app-id=480 \
--steam-bridge-electron-overlay-profile=diagnostic \
--steam-bridge-smoke-autorun \
--steam-bridge-smoke-autorun-action=dialog \
--steam-bridge-smoke-autorun-result-delay-ms=8000 \
--steam-bridge-smoke-web-url=https://store.steampowered.com/app/480/ \
--steam-bridge-smoke-web-modal=false \
--steam-bridge-smoke-require-overlay-active=false \
--steam-bridge-smoke-keep-open-after-result=false \
--steam-bridge-smoke-result-file=/tmp/steam-bridge-smoke.log
```

Supported autorun actions are `none`, `dialog`, `friends`, `store`, `web`,
`native-dialog`, `native-store`, `native-web`, `native-probe`,
`presenter-ready`, `presenter-dialog`, `presenter-store`, `presenter-web`,
`presenter-web-open-and-wait`, `presenter-store-open-and-wait`,
`presenter-dialog-auto-open-and-wait`, `presenter-friends`,
`presenter-friends-open-and-wait`, `presenter-profile`,
`presenter-profile-open-and-wait`, `presenter-players`,
`presenter-players-open-and-wait`, `presenter-community`,
`presenter-community-open-and-wait`, `presenter-stats`,
`presenter-stats-open-and-wait`, `presenter-achievements`,
`presenter-achievements-open-and-wait`, `presenter-user`,
`presenter-user-open-and-wait`, `presenter-checkout`, `presenter-shortcut`,
`presenter-shortcut-open-and-wait`, `presenter-achievement-progress`, and
`presenter-achievement-unlock`.
`native-probe` is a compatibility alias for `native-dialog`. On Linux, the
`native-*` actions open a bridge-owned X11/GLX native presenter, keep it
presenting frames, and activate the requested Steam overlay target through the
managed Steam Bridge session API. The current Deck Desktop Mode open, input,
close, and back-to-app proof is the reusable `presenter-web --web-modal true`
path below; `native-web` remains compatibility coverage. Use
`presenter-friends` for the generic Friends List proof. Current Deck Desktop
testing still leaves Steam's raw desktop dialog/Game Overview visually stuck
when Electron child overlay targets are allowed, so neither the native nor
Electron-only `dialog`/`friends` actions prove reliable Desktop Mode
dialog-overlay dismissal yet.
For raw dialog investigation, set `STEAM_BRIDGE_SMOKE_OVERLAY_DIALOG` or pass
`--dialog <name>` to the Linux/Deck helpers. The default is `Friends`; useful
generic comparison values include `Achievements`, `Community`, `Players`,
`Settings`, `OfficialGameGroup`, and `Stats`.

The `presenter-*` actions use `client.overlay.createElectronSteamOverlay(...)`
and reuse the same passive, click-through presenter for the requested overlay
target. Use
`presenter-web --web-modal true` to verify the app-facing persistent presenter
path. Use `presenter-web-open-and-wait --web-modal true` to exercise the exact
builder-facing `steamOverlay.openAndWait(...)` path; the smoke app records
`overlay:presenter-open-and-wait-start` before writing its result, then records
`overlay:presenter-open-and-wait-complete` only after Steam closes and the
presenter parks. The macOS helper's `--close-probe` and Deck runner's visual
close probes verify that close/park lifecycle from outside the app. Use
`presenter-store-open-and-wait` and
`presenter-friends-open-and-wait` for the same one-call open/close/park proof
against the Steam store and Friends List surfaces. Use
`presenter-dialog-auto-open-and-wait --dialog OfficialGameGroup` for the same
proof through the verified high-level dialog-equivalent router. The profile,
players, community, stats, achievements, and user routes also have
`*-open-and-wait` actions for the same managed wait-helper proof. Managed
`*-open-and-wait` actions wait for Steam's overlay diagnostics to report the app
ready before activating Steam and only mark the autorun successful after the
shown lifecycle wait resolves. On Linux/X11, the presenter is transparent and
click-through while fully idle, polls without pumping frames by default, can
become visible while remaining
click-through for `overlayNeedsPresent`, restores both opacity and input while
opening or showing Steam UI, and parks transparent after Steam emits overlay
inactive callbacks. On macOS, Steam Bridge reports `overlayNeedsPresent=false`
by default because Steam's injected renderer can crash inside
`BOverlayNeedsPresent()` even on the Metal presenter path; smoke snapshots also
report `overlayNeedsPresentPollingEnabled=false` to prove the JavaScript wrapper
and native layer avoided the poll.
macOS presentation is driven by explicit overlay opens and Steam overlay
activation callbacks instead.
The Electron overlay helper also syncs the native presenter
on BrowserWindow move, resize, fullscreen, maximize, restore, and show events
with one native pump per event. It isolates Chromium children by default so Deck
Desktop proof runs have one `gameoverlayui` process attached to the main/native
process, not a duplicate GPU overlay target. `presenter-dialog`
is an investigation action: with child-process isolation enabled, Friends/Game
Overview may not render; with isolation disabled, it may render through the
Chromium hook but still fail close/back-to-app proof.
Smoke snapshots include `snapshot.overlay.nativePresenter`, whose
`backend` reports the selected native host (`x11-glx`, `macos-metal`,
`macos-opengl`, or `none`) and whose `bounds`, when available, report the
Electron window geometry used for presenter alignment. Its `electronOverlay`
diagnostics show the managed presenter mode, restore-focus delay, activation
timing, and shortcut policy used for the run. The app-facing managed helper
defaults restore-focus delay, activation boost, and active grace timing to `0`
unless explicitly configured. The Node verifier and packaged platform helpers
can assert those fields with
`--require-electron-overlay`, `--require-presenter-mode <persistent|session>`, and
`--require-overlay-shortcut-target <target>`. Add
`--require-zero-managed-overlay-timing` to prove a smoke artifact is not relying
on delayed restore-focus, activation boost, or active grace timing. Static
shortcut targets report a
sanitized `electronOverlay.overlayShortcut.target` snapshot with target type and
non-sensitive flags; checkout URLs, transaction IDs, return URLs, and Steam IDs
are not serialized. Lifecycle and result artifacts also redact real checkout
URLs, transaction IDs, return URLs, Steam IDs, auth-ticket bytes, and private
CLI arguments while preserving verifier-safe presence flags and presenter
snapshots. The smoke app uses `overlayShortcut.onOpen` for shortcut lifecycle
logging so normal shortcut targets can stay static; dynamic resolver targets are
only used when a target cannot be validated until keypress time. For
resolver-backed shortcut targets, the verifier checks this smoke app's
configured shortcut target while preserving
`electronOverlay.overlayShortcut.targetType: "function"`. The Deck runner adds
the presenter-mode assertion automatically for presenter-backed product actions
and adds the shortcut-target assertion for `presenter-shortcut` and
`presenter-shortcut-open-and-wait`.
Use `presenter-friends` to verify the recommended Friends List path:
`client.overlay.openFriendsOverlay({ presenter })` opens Steam Community chat
through the same native web presenter used by checkout/store overlays, keeping a
single `gameoverlayui` target attached to the main/native process.
Use `presenter-profile` or `presenter-profile-open-and-wait` to verify
`client.overlay.openProfileOverlay({ steamId64, presenter })`, which opens the
current user's Steam Community profile through the same presenter-backed Steam
web overlay route instead of the raw `ActivateGameOverlayToUser` profile path.
Use `presenter-players` or `presenter-players-open-and-wait` to verify
`client.overlay.openPlayersOverlay({ steamId64, presenter })`, which opens the
current user's Steam Community players page through the same presenter-backed
Steam web overlay route instead of the raw Desktop Players dialog.
Use `presenter-community-open-and-wait` and `presenter-stats-open-and-wait` to
verify the product-shaped Steam Community app hub and current-user app stats routes:
`client.overlay.openCommunityOverlay({ appId, presenter })` and
`client.overlay.openStatsOverlay({ appId, presenter })`. Deck Desktop testing
verified both with visible Steam web content, overlay activation, and return to
the smoke app through `--visual-close-input web`.
Use `presenter-achievements-open-and-wait` to verify
`client.overlay.openAchievementsOverlay({ appId, presenter })`, which opens the
current user's app achievements page through the same presenter-backed Steam web
overlay route instead of the raw Desktop achievements dialog. SpaceWar App ID
`480` can redirect that web achievements URL to the user's profile because Steam
Community does not expose a public web stats page for it; a real app with
web-visible stats is needed for achievements content proof.
Use `presenter-user-open-and-wait --user-dialog steamid` to verify the high-level
`client.overlay.openUserOverlay(...)` route for the common
`ActivateGameOverlayToUser("steamid", user)` profile case. The same router maps
`chat`, `stats`, and `achievements` to presenter-backed web surfaces; `chat`
opens the verified Steam Community chat/Friends surface. Prompt-style names such
as `jointrade` and friend request actions are native-only diagnostics and should
be tested explicitly with `route: "native"` in app code.
Use `presenter-checkout` to verify checkout readiness. Without
`STEAM_BRIDGE_SMOKE_CHECKOUT_JSON_FILE`,
`STEAM_BRIDGE_SMOKE_CHECKOUT_URL`, or
`STEAM_BRIDGE_SMOKE_CHECKOUT_TRANSACTION_ID`, it calls
`steamOverlay.withCheckoutPrepared(...)` and records
`overlay:presenter-checkout-ready`; this is safe for the public SpaceWar smoke
app and proves the public checkout wrapper without opening purchase UI or
depending on a fixed presenter-preparation duration. The helper holds the
presenter active only for the wrapped operation and then parks it. When testing
a real app with a configured product, prefer writing the backend `InitTxn` or
checkout response JSON to a private temp file and setting
`STEAM_BRIDGE_SMOKE_CHECKOUT_JSON_FILE` to that path. The smoke app feeds the
parsed object directly into `steamOverlay.openCheckoutAndWait(...)`, so common
envelopes such as `response.params.transid` are exercised without committing
private products or putting transaction values in launch arguments. For smaller
manual checks, set `STEAM_BRIDGE_SMOKE_CHECKOUT_URL` to the Steam URL returned
by `InitTxn`, or set
`STEAM_BRIDGE_SMOKE_CHECKOUT_TRANSACTION_ID` to build and open the Steam
transaction approval page through `steamOverlay.openCheckoutAndWait(...)`.
The smoke app wraps direct URL or transaction ID inputs in an `InitTxn`-style
`response.params` envelope before calling the helper, so generic overlay
matrices exercise the same unwrapping path a real backend response uses.
The shortcut checkout target uses
`steamworks.overlay.checkoutTargetFromResult(...)` against the same parsed
object, so `presenter-shortcut --shortcut-target checkout` accepts the private
JSON-file proof path too.
Abort signals passed to `openCheckoutAndWait(...)` also cover the pending
checkout operation: aborting before the backend returns releases the presenter
hold and parks it back at zero FPS. Pass that same signal to your backend
request when the network request itself should be canceled too. Closing the
overlay manager while that operation is pending also releases the hold and
prevents a late checkout surface from opening.
The macOS helper and matrix expose the private-file path as
`--checkout-json-file`; the matrix can pair it with `--app-id <your-app-id>`
and records only `checkoutSource=json-file` plus the expected app ID in its
manifest. Use `--suite checkout` for the focused macOS purchase path; it covers
checkout prepare-only, direct checkout, Shift+Tab checkout, and programmatic
checkout shortcut/open-and-wait without rerunning unrelated overlay surfaces.
Add `--require-microtxn-callback` when a real direct checkout proof is expected
to produce `MicroTxnAuthorizationResponse`; the matrix summary will fail if the
callback is missing or lacks a presenter snapshot. The Linux and
Steam Deck helpers expose direct inputs as `--checkout-url`,
`--checkout-transaction-id`, and `--checkout-return-url`. Without a checkout
file, URL, or transaction ID the helpers only require
`overlay:presenter-checkout-ready`;
with one, they require `overlay:presenter-open`, a Steam overlay activation
callback, and lifecycle logs show `overlay:presenter-checkout-open-and-wait-complete`
after Steam closes and the presenter parks. Those lifecycle logs preserve
presence flags such as `hasTransactionId` and the shown/parked presenter
snapshots, and real purchase runs must include a presenter snapshot on any
`callback:microtxn` authorization event. The smoke sanitizers redact the actual
checkout URL, transaction ID, return URL, order ID, and Steam ID values.
For normal app code, `steamOverlay.open(...)` opens a presenter-backed target and
keeps the presenter active until Steam reports the overlay shown. Its timeout is
only a failure guard if Steam never activates the overlay. Use
`steamOverlay.openAndWait(...)` for modal flows that should resolve after Steam
closes and the presenter parks; it uses the same show hold, then parks from
overlay callbacks and presenter state changes instead of relying on a fixed
activation window.
The managed overlay also exposes `waitForOverlayShown()`,
`waitForOverlayClosed()`, and `parkWhenSteamOverlayCloses()` for app code that
needs lower-level lifecycle await points without owning Steam callbacks or
native presenter parking. In default persistent presenter mode, those helpers
resolve from Steam Bridge overlay callback and presenter state changes instead
of app-authored timing loops. The public wait options expose deadlines and abort
signals, not polling intervals. The smoke lifecycle log records those public
wait helpers as `overlay:presenter-wait-shown`,
`overlay:presenter-wait-closed`, and `overlay:presenter-parked` during managed
presenter proofs.
If a wait guard expires, is aborted, or the overlay manager closes while the
wait is pending, app code receives `SteamOverlayWaitTimeoutError`,
`SteamOverlayWaitAbortedError`, or `SteamOverlayWaitClosedError` with a stable
`code`, `state`, the last managed presenter `snapshot`, and direct
`diagnostics`, `nativeHostUnavailableReason`, and `macOverlayEnvironment`
properties copied from that snapshot when available; timeout errors also include
`timeoutMs`. Use the matching `isSteamOverlayWaitTimeoutError(error)`,
`isSteamOverlayWaitAbortedError(error)`, or
`isSteamOverlayWaitClosedError(error)` guard for fallback or diagnostics instead
of parsing the message.
Dynamic shortcut targets are resolved only by the shortcut open helpers. On
macOS, if the native overlay host is already unavailable because the screen is
locked or the display is asleep, those helpers fail before invoking a dynamic
target callback.
The managed overlay automatically primes its passive presenter before
achievement progress, achievement unlock, and stats-store calls that can produce
Steam notification toasts; `prepareForNotification()` remains available for
lower-level custom cases. Passive priming wakes and repolls the presenter once,
then waits for Steam's `overlayNeedsPresent` signal on platforms where that
Steam SDK call is safe before entering the notification frame loop, so quiet
calls do not start a fixed high-FPS boost. On macOS, the smoke app keeps
needs-present polling disabled by default and relies on Steam overlay callbacks
plus the managed open/close lifecycle.
Do not use `steam://open/overlay` as a generic overlay-toggle substitute in this
example. Deck Desktop testing showed it can activate Steam's callback path while
leaving the native presenter black and the smoke process unrecovered.
Use
`presenter-achievement-progress` to verify passive Steam notification rendering:
the action relies on automatic passive priming, keeps the presenter transparent
and click-through, calls `achievement.indicateProgress(...)`, and records
`achievement:progress` plus `callback:achievement-stored` when Steam accepts the
progress notification. On macOS, add `--require-passive-notification` to the
packaged helper command so verification requires both the result snapshot and
`lifecycle.jsonl` to contain the accepted achievement event and Steam callback,
with no modal overlay activation and with a passive presenter snapshot.
Use `presenter-achievement-unlock` to exercise the unlock-toast path through the
same passive presenter. It clears and re-unlocks the selected public test
achievement, stores stats, and records `achievement:unlock`; pass
`--achievement-name <name>` when you want a specific test achievement.
Use `presenter-shortcut` with
`--visual-toggle-probe --visual-toggle-input keyboard --visual-close-input toggle`
to verify the managed Electron shortcut bridge: the app attaches the reusable
presenter, waits for Shift+Tab, and the bridge routes that shortcut to the
verified Friends/chat presenter-backed Steam web overlay. When Steam reports an
active overlay, the bridge lets Shift+Tab pass through instead of swallowing it,
so Steam can handle close/toggle behavior. Deck Desktop proof now verifies the
second Shift+Tab closes the overlay and returns focus to the app. Add
`--shortcut-target <name>` to test another presenter-backed target through the
same focused Shift+Tab path; supported smoke targets are `friends`, `profile`,
`players`, `web`, `store`, `community`, `stats`, `achievements`, `user`, `dialog`, and
`checkout`. App code can also call `steamOverlay.openShortcutTarget()` from a
controller or in-game menu button to reuse that same configured target, or
`steamOverlay.openShortcutTargetAndWait()` when the button flow should resolve
only after Steam closes and the presenter parks. Both helpers avoid duplicating
shortcut resolver logic in app code. The shortcut `onOpen` callback fires only
after the managed path has passed readiness and called Steam's overlay
activation API; readiness failures are reported through `onError` without a
false open callback.
Use `presenter-shortcut-open-and-wait` with `--shortcut-target <name>` to smoke
test that programmatic button/menu path without sending Shift+Tab.
The `dialog` target uses the high-level auto router; unsupported dialog names
throw instead of silently falling back to raw Steam overlay behavior. Use the
raw `presenter-dialog` action only for explicit diagnostics.
For emergency compatibility comparison, set
`STEAM_BRIDGE_DISABLE_ELECTRON_OVERLAY_PRESENTER=1` before launching the smoke
app. The same high-level `presenter-*` actions then use the older native-session
lifecycle instead of the reusable persistent presenter; this is diagnostic
coverage, not the recommended Deck Desktop product path. The Linux and Steam
Deck helpers also accept `--presenter-mode session` to run the same comparison
through repeatable smoke commands without editing the Steam shortcut by hand.

For social-overlay investigation only, the smoke app and Deck host runner expose
`--steam-bridge-electron-overlay-scrub-child-env`,
`--steam-bridge-electron-overlay-isolate-child-processes`,
`--overlay-scrub-child-env`, and `--overlay-isolate-child-processes`. Set both
to `false` to let Steam's overlay preload reach Chromium children and compare
that behavior against the default isolated presenter proof. Do not use the
unisolated mode as the recommended product path unless a run also proves clean
close/back-to-app pixels and no duplicate stale `gameoverlayui` target.

Each autorun also writes local diagnostics. Pass
`--steam-bridge-smoke-diagnostic-dir=/tmp/steam-bridge-smoke.log.diagnostics`
or set `STEAM_BRIDGE_SMOKE_DIAGNOSTIC_DIR` to choose the directory. The app
starts Electron's crash reporter with uploads disabled, stores Crashpad files
under `crash-dumps/`, and writes lifecycle JSON lines to `lifecycle.jsonl`.
On macOS, the helper's `--require-no-crashes` gate also copies fresh
`SteamBridgeSmoke*.ips` reports from `~/Library/Logs/DiagnosticReports`, plus
`MTLCompilerService*.ips` reports whose content attributes the crash to
`SteamBridgeSmoke`, into `macos-crash-reports/` and fails with the report
timestamp, exception, responsible process, and top symbols. The macOS matrix
summarizer rejects those copied reports when auditing saved artifacts.
Success matrix runs stop before launching cases while macOS is locked or the
display is asleep. Use `npm run macos:overlay-matrix:preflight` for a cheap
readiness check, `--suite unavailable` to capture that state, or
`--wait-for-interactive-seconds <seconds>` for a bounded harness-only wait at the
preflight boundary.
The smoke snapshot includes `snapshot.app.diagnosticDir`,
`snapshot.app.lifecycleLogFile`, and `snapshot.app.crashDumpDir`.
For visual debugging, pass `--steam-bridge-smoke-keep-open-after-result` or set
`STEAM_BRIDGE_SMOKE_KEEP_OPEN_AFTER_RESULT=1` so the verifier can read a result
while the app stays open for overlay close/back-to-game checks.

To verify an autorun log:

```sh
npm run example:verify-result -- \
  --file /tmp/steam-bridge-smoke.log \
  --app-id 480 \
  --platform linux \
  --arch x64
```

Expected managed overlay failures can be verified explicitly instead of
hand-inspecting logs. For example, a macOS locked-screen or sleeping-display
fallback artifact should be checked with:

```sh
npm run example:verify-result -- \
  --file /tmp/steam-bridge-smoke.log \
  --app-id 480 \
  --platform darwin/arm64 \
  --action presenter-web-open-and-wait \
  --require-action-error-code STEAM_OVERLAY_NATIVE_HOST_UNAVAILABLE \
  --require-action-error-reason macos-screen-locked \
  --require-native-host-unavailable-reason macos-screen-locked \
  --require-no-overlay-activation
```

For repeatable macOS matrix artifacts, prefer:

```sh
npm run macos:overlay-matrix -- \
  --steam-user-id <steam-userdata-id> \
  --suite unavailable
```

The unavailable suite refuses to run while macOS is interactive, so it does not
fake lock/display-sleep behavior. A locked/asleep artifact should show the
typed unavailable action error, no native host attachment, no overlay
activation, and zero current FPS.

## Steam Deck Checks

For Game Mode, copy the Linux x64 output folder to the Deck and add the packaged
`SteamBridgeSmoke` executable as a non-Steam game. Launch it from Game Mode and
use the overlay buttons in the app.

The Linux package also includes `linux-electron-smoke.sh`. Use it on Steam Deck
or Linux x64 to print the launch options, discover the full shortcut game ID,
launch the Steam shortcut, and verify the autorun log.

```sh
cd "$HOME/steam-bridge-smoke/SteamBridgeSmoke-linux-x64"

./linux-electron-smoke.sh \
  --mode print-launch-options \
  --action dialog \
  --result-file /tmp/steam-bridge-smoke-steam-launch.log
```

From this repository, the Deck-only SSH runner can copy the packaged Linux x64
app to the Deck, keep it awake for the run, and execute the same Steam-launched
gate:

```sh
npm run steam-deck:smoke -- \
  --mode discover \
  --discover-subnet <lan-prefix>

npm run steam-deck:smoke -- \
  --host deck@<deck-host-or-ip> \
  --mode preflight

npm run steam-deck:smoke -- \
  --host deck@<deck-host-or-ip> \
  --mode game
```

Run the same command with `--mode desktop` after switching the Deck to Desktop
Mode. Game Mode defaults to the `diagnostic` overlay profile and requires the Big
Picture signal. Desktop Mode defaults to the `repaint` overlay profile,
omits the Big Picture assertion, and keeps Steam launch, overlay injection,
overlay readiness, and overlay callback checks. If preflight cannot reach SSH,
verify the Deck is awake, SSH is enabled, and the `--host` IP address is still
current; then rerun `--mode discover`.

To repeat the Deck Desktop product overlay matrix, run:

```sh
npm run steam-deck:overlay-matrix -- \
  --host deck@<deck-host-or-ip> \
  --suite core
```

This packages the Linux x64 smoke app, runs preflight, then drives the managed
presenter routes for managed readiness, modal web, store, Friends, profile,
community, stats, achievements, user, dialog equivalents, checkout readiness,
synthetic checkout approval-route plumbing, Shift+Tab shortcut routing, and
passive achievement progress/unlock toasts.
It also summarizes every collected result and lifecycle log, failing if a case
reports crash dumps, fatal Electron lifecycle events, duplicate overlay targets,
missing presenter diagnostics, post-close presenter parking regressions, or
missing managed wait-helper shown/closed/parked lifecycle evidence. It
writes per-case diagnostics and screenshots under
`/tmp/steam-bridge-deck-overlay-matrix-*` plus `matrix-cases.jsonl`, which lets
the summary print and audit each case's close/toggle input. Use `--suite
minimal` for the shortest product smoke pass or `--suite full` to include every
known dialog-equivalent route.

For the current Desktop Mode visual proof of the reusable presenter path, use the
presenter web action with a modal web overlay and leave the app open after the
verifier result:

```sh
npm run steam-deck:smoke -- \
  --host deck@<deck-host-or-ip> \
  --mode desktop \
  --action presenter-web \
  --web-url https://store.steampowered.com/app/480/ \
  --web-modal true \
  --keep-open-after-result \
  --collect-diagnostics-dir /tmp/steam-bridge-deck-artifacts \
  --visual-capture-dir /tmp/steam-bridge-deck-screens
```

After the result passes, close the Steam web overlay with its in-overlay close
control. The lifecycle log should include `callback:overlay-activated` with
`active=true` followed by `active=false`, and the screenshot must return cleanly
to the running app with no black native presenter covering it. The Deck process
list should show one `gameoverlayui` process for the app, attached to the
main/native process. The Deck runner requires that single-target process shape
automatically for presenter-backed product actions. It also requires idle
presenter state for checkout readiness and the managed shortcut bridge, and it
fails presenter-backed product runs if the smoke app reports crash dumps or
fatal Electron lifecycle events. With `--visual-close-probe`, presenter-backed
product web surfaces also require an `active=false` close callback, a still
running and focused smoke app, and no post-close crash evidence.

For the generic Friends List path, use:

```sh
npm run steam-deck:smoke -- \
  --host deck@<deck-host-or-ip> \
  --mode desktop \
  --action presenter-friends \
  --window-mode fullscreen \
  --keep-open-after-result \
  --collect-diagnostics-dir /tmp/steam-bridge-deck-artifacts \
  --visual-capture-dir /tmp/steam-bridge-deck-screens \
  --visual-close-probe
```

A passing `overlay-open.png` shows the Steam Friends List / chat UI in the
native Steam overlay, and `after-close-probe.png` returns to the running smoke
app. The process list should still show one `gameoverlayui` target attached to
the main/native process.

For the generic achievements page path, use:

```sh
npm run steam-deck:smoke -- \
  --host deck@<deck-host-or-ip> \
  --mode desktop \
  --action presenter-achievements \
  --window-mode fullscreen \
  --keep-open-after-result \
  --collect-diagnostics-dir /tmp/steam-bridge-deck-artifacts \
  --visual-capture-dir /tmp/steam-bridge-deck-screens \
  --visual-close-probe
```

This exercises the product-shaped achievements route. It should show a Steam web
overlay, emit active/inactive callbacks, and return to the running smoke app
after the close probe. With App ID `480`, Steam Community may redirect the
achievements URL to the user's profile, so treat this as lifecycle proof rather
than achievements content proof.

For raw dialog/Game Overview investigation, use `presenter-dialog` or
`dialog`/`friends` with `--visual-close-probe`; add `--dialog <name>` to compare
Steam dialog targets without editing the example app. The runner captures
`overlay-open.png`, sends a Deck-side Shift+Tab/Escape probe through
`/dev/uinput` when available, captures `after-close-probe.png`, and copies the
remote result log plus diagnostics back to the local artifact directory. Treat
that raw dialog path as evidence collection, not a pass condition: raw
Friends/Game Overview is only passed once the captured pixels return cleanly to
the running app without duplicate `gameoverlayui` targets.

For presenter-backed Steam web surfaces, add `--visual-close-input web` with
`--visual-close-probe` to close through the visible Steam web overlay close
control instead of Shift+Tab/Escape.
Add `--presenter-mode session` only when you need to compare the compatibility
native-session fallback against the default persistent presenter; the default
persistent mode remains the product proof path. Session-mode Deck runs still
check overlay callbacks, focus return, and crash diagnostics, but skip
persistent-host single-target, idle-parking, and no-post-close-pumping
assertions because the fallback opens lazily and may pump while a session exists.

Use `--visual-toggle-probe` when the question is whether an overlay shortcut
opens from the current app state. With `presenter-shortcut`, this tests Steam
Bridge's managed Electron Shift+Tab bridge. With passive presenter or raw dialog
actions, this tests Steam's raw hotkey interception. The runner focuses the
smoke app when possible, captures `before-toggle-probe.png`, sends the selected
toggle input, captures `after-toggle-open.png`, then closes and captures
`after-toggle-close.png`. The default `--visual-toggle-input keyboard` sends
Shift+Tab. For `presenter-shortcut`, keyboard toggle probes should use
`--visual-close-input toggle` so close is Shift+Tab-only; they also require
`overlay:shortcut-open`, active/inactive callbacks, focus returning to the smoke
app, state-driven post-close presenter snapshots parked at passive idle with no
`pumpCount` increase, managed wait-helper shown/closed/parked events, and no
post-close crash evidence. Use
`--shortcut-target web --web-modal true` to prove the modal web/checkout-style
target from a focused fullscreen app; the Deck runner waits for the smoke
lifecycle log to report shortcut-open and active overlay events before capturing
the opened surface. Use
`--visual-toggle-input guide` to send the controller Guide/Steam button through a
temporary `/dev/uinput` device, or `--visual-toggle-input both` to compare both
paths in one run. The generic `keyboard` close mode still sends Shift+Tab then
Escape for raw investigations; the managed shortcut proof uses `toggle`.
Guide probes press Guide again. Focused Deck Desktop passive-presenter runs
passed the toast proof but did not open Steam overlay UI from Shift+Tab or from
the virtual controller Guide/Steam-button event, so that raw interception probe
remains evidence for an unresolved hotkey/social path unless the action under
test is the managed `presenter-shortcut` bridge and the visual run captures the
overlay opening and returning cleanly to the app.
Add `--overlay-game-id shortcut` when comparing whether raw Steam overlay
dismissal depends on the full non-Steam shortcut game ID.

For passive toast proof, use the achievement-progress presenter action:

```sh
npm run steam-deck:smoke -- \
  --host deck@<deck-host-or-ip> \
  --mode desktop \
  --action presenter-achievement-progress \
  --overlay-profile repaint \
  --window-mode fullscreen \
  --keep-open-after-result \
  --result-delay-ms 1200 \
  --collect-diagnostics-dir /tmp/steam-bridge-deck-artifacts \
  --visual-capture-dir /tmp/steam-bridge-deck-screens
```

A passing screenshot shows the Steam achievement progress toast over the running
app while the presenter snapshot remains passive (`clickThrough=true`,
`transparent=true`, `overlayActive=false`). The Deck runner machine-checks that
passive presenter state for `presenter-achievement-progress`; it does not require
`currentFps=0` because Steam can still be presenting the notification. With App
ID `480`, the smoke action tries the available public achievements until Steam
accepts `achievement.indicateProgress(...)`, records the accepted achievement
and attempts, and the matrix summary requires `indicated=true` plus
`callback:achievement-stored`.

For achievement unlock toasts, use the matching passive unlock action:

```sh
npm run steam-deck:smoke -- \
  --host deck@<deck-host-or-ip> \
  --mode desktop \
  --action presenter-achievement-unlock \
  --overlay-profile repaint \
  --window-mode fullscreen \
  --keep-open-after-result \
  --result-delay-ms 1200 \
  --collect-diagnostics-dir /tmp/steam-bridge-deck-artifacts \
  --visual-capture-dir /tmp/steam-bridge-deck-screens
```

This smoke action intentionally clears and re-unlocks the selected public test
achievement so repeated runs can prove a real unlock notification without
changing Electron app-facing overlay code. A 2026-06-28 Deck Desktop fullscreen
run selected `ACH_TRAVEL_FAR_ACCUM` (`Interstellar`), captured the unlock toast
over the app, kept focus on the smoke window, used one `gameoverlayui` target
attached to the main process, and reported no crash evidence.

For scripted setup, back up and upsert the non-Steam shortcut with:

```sh
npm run steam-shortcut:upsert -- \
  --shortcuts "$HOME/.local/share/Steam/userdata/<steam-user-id>/config/shortcuts.vdf" \
  --app-name "Steam Bridge Smoke" \
  --exe "$HOME/steam-bridge-smoke/run-smoke-autorun.sh" \
  --start-dir "$HOME/steam-bridge-smoke"
```

Use the numeric `userdata` folder for the Steam account currently signed in on
the Deck. The helper backs up an existing shortcut file, writes Steam's binary
shortcut format, and prints both Steam's internal shortcut app ID and the full
shortcut game ID. The host runner writes `run-smoke-autorun.sh` and
`run-smoke-autorun.env` before each Game Mode or Desktop Mode launch, so the same
Steam shortcut can run different smoke actions without editing Steam's shortcut
database every time. Launch with the printed `Launch URL` after Steam has
reloaded shortcuts. On Steam Deck, restart Steam or switch out of and back into
Game Mode after writing `shortcuts.vdf`; Game Mode can keep a stale shortcut
cache:

```sh
steam steam://rungameid/<shortcut-game-id>
```

Do not launch the internal shortcut app ID with `steam://rungameid`. Steam can
show `Game configuration unavailable` when the short app ID is used instead of
the full shortcut game ID. Do not launch `steam://rungameid/480`; `480` is the
SpaceWar test App ID used inside the running process, not the non-Steam shortcut
ID. The same dialog can appear briefly after editing `shortcuts.vdf` while Steam
is running; reload Steam, then launch the full shortcut game ID again.

After Steam has reloaded the shortcut, the packaged helper can auto-discover the
full shortcut game ID and run the Game Mode smoke check:

```sh
./linux-electron-smoke.sh \
  --mode steam-launch \
  --shortcut-game-id auto \
  --action dialog \
  --result-file /tmp/steam-bridge-smoke-steam-launch.log \
  --require-steam-deck \
  --require-big-picture \
  --require-overlay-injection \
  --require-event callback:overlay-activated
```

For Desktop Mode overlay checks, launch the same shortcut URL while Steam is
running in Desktop Mode. A direct shell or file-manager launch can prove Steam
Bridge initialization, but Steam overlay injection is only expected when Steam
launches the shortcut. If you choose a direct executable shortcut instead of the
wrapper, include `--steam-bridge-electron-overlay-profile=repaint` in that
shortcut's launch options before running Desktop Mode overlay checks.

Desktop Mode visual proof for the Electron-only social actions looks like
Steam's desktop overlay panels over the Electron window, such as Game
Overview/Friends and a "Back to Game" control. Those panels can remain visually
stuck after Steam has already emitted `active=false`, so do not record Desktop
Mode raw dialog-overlay close/back-to-app as passed until the pixels return
cleanly to the running app. With the default child-process isolation, those panels may
not render because Steam is prevented from hooking Electron's Chromium GPU
process. The current reusable-presenter close proofs are `--action presenter-web`
with `--web-modal true` for generic web/checkout-style overlays and
`--action presenter-friends` / `--action presenter-community` /
`--action presenter-profile` / `--action presenter-stats` for the
product-shaped social/community surfaces. `presenter-players` now has the same
Deck Desktop visual pass, including active/inactive callbacks, web close, focus
return, no crash evidence, and idle presenter parking.
These call `client.overlay.openWebOverlay(...)`,
`client.overlay.openFriendsOverlay(...)`,
`client.overlay.openProfileOverlay(...)`,
`client.overlay.openPlayersOverlay(...)`,
`client.overlay.openCommunityOverlay(...)`, and
`client.overlay.openStatsOverlay(...)`, show Steam web overlay UI over the
bridge-owned native presenter, and return to the smoke app. The older
`--action native-web` path remains as compatibility coverage for
`activateToWebPageWithNativeSession(...)`.

For longer SSH-driven checks, keep the Deck awake from SteamOS/Desktop Mode
power settings. Over SSH, `systemd-inhibit --what=sleep sleep infinity` can keep
the Deck awake while a test slice is running. The host runner starts and stops a
temporary sleep inhibitor automatically unless `--no-keep-awake` is passed.

## Overlay Signals

The important fields are:

- `Initialized`
- `Steam Running`
- `Overlay Enabled`
- `Needs Present`
- `Native Probe`
- `Native Session`
- `callback:overlay-activated`

The Friends dialog is useful as a baseline that Steamworks and overlay IPC are
alive. It is not enough to prove the browser or checkout overlay path. For web,
store, or purchase-style checks, require `callback:overlay-activated` with an
`active: true` payload by passing `--require-overlay-activated`.

On Steam Deck, `activateToStore` is the best generic proof that the smoke app can
bring Steam overlay UI over Electron. In current Game Mode smoke testing,
`activateToWebPage` to a normal Steam web page does not show a visible web
overlay or emit `active: true`. A web checkout or transaction approval flow
needs a real Steam app launch and a real configured product or transaction. Do
not use the non-Steam smoke shortcut to impersonate a private app ID for
purchase-flow proof.

If Steam initializes but overlay does not show, compare those fields between
Deck Game Mode and Deck Desktop Mode.

In autorun output, inspect `snapshot.steam.overlayEnabled`,
`snapshot.steam.overlayNeedsPresent`,
`snapshot.steam.overlayNeedsPresentPollingEnabled`,
`snapshot.steam.overlayDiagnostics`, and
the final `snapshot.events` list. `snapshot.launch.steamLaunch` reports whether
Steam launch environment markers were present. `snapshot.launch.overlayInjection`
reports whether the process environment includes a Steam overlay hook marker such
as `gameoverlayrenderer`.

`overlayNeedsPresent=true` is not a failure by itself. It means Steam is asking
the app to keep presenting frames for the overlay. The smoke verifier treats an
active overlay callback as stronger evidence than the raw present-needed flag.
On macOS, Steam Bridge intentionally reports `overlayNeedsPresent=false` by
default without calling Steam's crash-prone needs-present API, and
`overlayNeedsPresentPollingEnabled=false` is the explicit proof of that policy.

For Steam Deck Game Mode or gamescope checks, the verifier can assert the Deck
signals:

```sh
npm run example:verify-result -- \
  --file /tmp/steam-bridge-smoke.log \
  --platform linux/x64 \
  --require-steam-deck \
  --require-big-picture \
  --require-overlay-ready
```

For a Steam-launched non-Steam game check, add the stronger launch assertions
when they are expected on the target platform:

```sh
npm run example:verify-result -- \
  --file /tmp/steam-bridge-smoke.log \
  --require-steam-launch \
  --require-overlay-injection
```

For an autorun overlay command, assert both the requested action and the emitted
event:

```sh
npm run example:verify-result -- \
  --file /tmp/steam-bridge-smoke.log \
  --action dialog \
  --require-event overlay:dialog
```

For a web overlay command that must prove Steam actually activated the overlay,
also assert the active callback:

```sh
npm run example:verify-result -- \
  --file /tmp/steam-bridge-smoke.log \
  --action web \
  --require-event overlay:web \
  --require-event callback:overlay-activated \
  --require-overlay-activated
```

For purchase or `InitTxn` validation, keep this repo generic and run the
app-specific proof outside the committed examples:

1. Launch your real installed Steam app through Steam.
2. Confirm the running process reports your real app ID.
3. Trigger the backend `InitTxn` call through
   `steamOverlay.openCheckoutAndWait(() => startTxn())`; with the built-in Web
   API client, use `microTxn.initClientTxn(...)` for `usersession=client` and
   keep `microTxn.initWebTxn(...)` for your browser fallback. Do not tune local
   overlay-preparation timers around that call.
4. For smoke proof, save the returned JSON to a private temp file and pass it
   with `STEAM_BRIDGE_SMOKE_CHECKOUT_JSON_FILE` or the macOS helper's
   `--checkout-json-file`. For focused macOS matrix proof, run `--suite
   checkout` and add `--require-microtxn-callback` when the direct checkout case
   should receive Steam's authorization callback.
5. Let Steam Bridge open the returned checkout URL or transaction approval path.
6. Verify the Steam modal appears in both Deck Game Mode and Desktop Mode.
7. Confirm backing out or closing the Steam surface returns focus to the app.
8. Confirm any `callback:microtxn` artifact keeps the presenter snapshot while
   redacting order IDs, transaction IDs, Steam IDs, and checkout URLs.
9. Keep private app IDs, item definitions, transaction IDs, publisher keys, and
   private URLs out of committed docs and examples.

The managed Electron overlay defaults to scoped activation holds instead of
duration-based preparation. Lower-level split-step helpers such as
`prepareForCheckout(durationMs)` are for diagnostics or unusual custom flows
where a standalone hold is intentional.
The managed smoke path also uses zero restore-focus, activation boost, and active
grace timing; platform helper verification can require that with
`--require-zero-managed-overlay-timing`.
Passive notification priming also respects macOS host availability: locked or
display-asleep sessions skip native host work and retry on the next
notification-producing call after the host becomes available.
On macOS, if the screen is locked or the display is asleep, the managed
overlay helpers fail before activation with
`SteamOverlayNativeHostUnavailableError`. Call
`steamOverlay.getNativeHostAvailability()` when you want a cheap preflight before
opening an overlay, and still use
`steamworks.isSteamOverlayNativeHostUnavailableError(error)` plus its `reason`
field around the operation for lock or sleep transitions that happen after the
preflight; do not wait for overlay timeouts in that state. If the
host is already unavailable, the managed Shift+Tab fallback treats the same
state as a quiet no-op unless `overlayShortcut.onError` is provided. The
packaged macOS helper
and other platform helpers accept `--require-action-error-code` and
`--require-action-error-reason`; add `--require-native-host-unavailable-reason`
to verify the presenter snapshot and
`snapshot.overlay.nativeHostAvailability` helper result both report the same
unavailable reason while the presenter stayed unattached, host-closed, and at
zero current FPS. Add `--require-no-overlay-activation` to prove the fail-fast
path did not start Steam overlay activation.

For a Steam Deck Desktop Mode shortcut launch, omit the Big Picture assertion
but keep the Steam launch and overlay injection assertions:

```sh
npm run example:verify-result -- \
  --file /tmp/steam-bridge-smoke-steam-launch.log \
  --platform linux/x64 \
  --require-steam-deck \
  --require-overlay-ready \
  --require-steam-launch \
  --require-overlay-injection \
  --action dialog \
  --require-event overlay:dialog \
  --require-event callback:overlay-activated
```
