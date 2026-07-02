# Steam Bridge

Steam Bridge is a native-backed TypeScript package for Electron and Node. It
provides a focused Steamworks API surface through a Rust `napi-rs` addon, plus a
compatibility-shaped default export for projects migrating from Steamworks
wrappers with similar call patterns.

This project is 100% created and maintained by Codex.

The native crate calls the Steamworks flat C API through `steamworks-sys` and
owns Steam API initialization, manual callback dispatch, auth tickets, overlay
helpers, encrypted app ticket parsing, Steam utility checks, Steam ID helpers,
achievements, networking, matchmaking, app metadata and DLC helpers, cloud,
HTTP, game-server, input, stats, inventory, workshop helpers, and a generic
Steam Web API client for publisher inventory, trading, and economy endpoints.
Modern networking socket create/connect helpers accept per-call
`NetworkingConfigOption` arrays.

Steam SDK redistributables are not committed. For local/native builds, provide
the Steamworks SDK in the normal location expected by `steamworks-sys`, or set
`STEAMWORKS_SDK_PATH` according to your SDK setup.

## Platform Targets

Steam Bridge targets Steam desktop platforms for Electron and Node:

- macOS Apple Silicon: `aarch64-apple-darwin`
- Windows x64: `x86_64-pc-windows-msvc`
- Linux x64: `x86_64-unknown-linux-gnu`

### macOS Apple Silicon Only

Intel macOS is intentionally not supported. CI, release prebuilds, runtime
loading, native linking, and macOS smoke-app packaging enforce the supported
target list. All macOS test apps are built and run as Apple Silicon arm64
targets only. Examples, smoke packages, overlay matrices, and live overlay
proofs all use native Apple Silicon `darwin/arm64` shells and arm64 Electron
apps. Steam Bridge does not build, run, or verify Intel or universal macOS apps.
Do not package, launch, or verify macOS smoke apps through Rosetta. Do not
package, launch, or verify macOS test or smoke apps through any
`darwin-x64`/universal Electron build.

The macOS CI and release jobs assert an `arm64` runner so Apple Silicon checks
never silently become Intel cross-compilation checks.
The macOS smoke package command is intentionally `npm run example:package:mac`;
it always resolves to the `aarch64-apple-darwin` / `darwin-arm64` app shape.
Do not add `darwin-x64`, `x86_64-apple-darwin`, or universal macOS test-app
targets to this project. A macOS command path that builds or runs an Intel,
Rosetta, or universal Electron app is a project bug, not an alternate
validation path.

`npm run check:platform` validates both the published native target list and
the example app's Apple Silicon-only macOS package path.

## Quick Start

Valve's public Steamworks example app is SpaceWar, App ID `480`. It is useful for
local smoke testing, but it is not a substitute for your own Steam app ID in
production.

```ts
import {
  init,
  getSteamId,
  getAuthTicketForWebApi,
  onMicroTxnAuthorizationResponse,
  getOverlayDiagnostics,
  activateOverlayToWebPage,
  isAchievementActivated
} from "steam-bridge";

init({ appId: 480 });

const steamId = getSteamId().steamId64;
const ticket = await getAuthTicketForWebApi("steam-bridge-example");
const bytes = ticket.getBytes();

console.log({
  steamId,
  ticketBytes: bytes.length,
  overlay: getOverlayDiagnostics()
});

onMicroTxnAuthorizationResponse((event) => console.log(event));
activateOverlayToWebPage("https://store.steampowered.com/app/480/");
isAchievementActivated("ACH_WIN_ONE_GAME");
```

The compatibility-style default export exposes grouped APIs:

```ts
import steamworks from "steam-bridge";

const client = steamworks.init(480);

client.localplayer.getSteamId().steamId64;
client.auth
  .getAuthTicketForWebApi("steam-bridge-example")
  .then((ticket) => ticket.getBytes());
client.callback.register("MicroTxnAuthorizationResponse", (event) => console.log(event));
client.SteamworksEnums.EResult.k_EResultOK;
client.utils.getOverlayDiagnostics();
client.overlay.activateToWebPage("https://store.steampowered.com/app/480/");
client.achievement.isActivated("ACH_WIN_ONE_GAME");
```

The raw activation helpers above are useful for Node/native smoke checks and
diagnostics. Electron apps should use the managed overlay in the
[Electron Overlay](#electron-overlay) section for product overlay work,
especially on macOS and Steam Deck Desktop Mode.

Steam Web API calls can use endpoint helpers or the generic helper. Set
`STEAM_WEB_API_KEY` in the environment, pass `apiKey`, or pass `key` per
request:

```ts
const web = steamworks.createSteamWebApiClient();
const players = await web.get({
  interfaceName: "ISteamUserStats",
  methodName: "GetNumberOfCurrentPlayers",
  version: 1,
  params: { appid: 480 }
});

const schema = await web.userStats.getSchemaForGame({ appId: 480 });
const profile = await web.user.resolveVanityUrl("spacewar");
const news = await web.news.getNewsForApp({ appId: 480, count: 2 });
const appStatus = await web.apps.upToDateCheck({ appId: 480, version: 1 });
const gameServerAccounts = await web.gameServersService.getAccountList();
const notificationSessions = await web.gameNotificationsService.enumerateSessionsForApp({
  appId: 480,
  steamId64: 76561198000000000n
});
const cheatReport = await web.cheatReportingService.reportPlayerCheating({
  appId: 480,
  steamId64: 76561198000000000n,
  noReportId: true
});
const broadcastFrame = await web.broadcastService.postGameDataFrame({
  appId: 480,
  steamId64: 76561198000000000n,
  broadcastId: 123456789n,
  frameData: JSON.stringify({ round: 1, score: 9001 })
});
const cloudFiles = await web.cloudService.enumerateUserFiles({
  accessToken: "oauth-access-token",
  appId: 480,
  extendedDetails: true
});
const workshopDetails = await web.remoteStorage.getPublishedFileDetails([123456789n]);
const workshopFiles = await web.publishedFileService.queryFiles({
  queryType: 3,
  creatorAppId: 480,
  appId: 480,
  numPerPage: 10
});
const workshopContributors = await web.workshopService.getFinalizedContributors({
  appId: 480,
  gameItemId: 100
});
const prices = await web.economy.getAssetPrices({ appId: 480, currency: "USD" });
const marketEligibility = await web.econMarketService.getMarketEligibility({
  steamId64: 76561198000000000n
});
const inventoryCount = await web.inventoryService.getQuantity({
  appId: 480,
  steamId64: 76561198000000000n,
  itemDefIds: [100]
});
const itemHistory = await web.gameInventory.getUserHistory({
  appId: 480,
  steamId64: 76561198000000000n,
  contextId: 2,
  startTime: 1760000000,
  endTime: 1760003600
});
const tradeSummary = await web.econService.getTradeOffersSummary({ timeLastVisit: 0 });
const storeApps = await web.store.getAppList({ includeGames: true, maxResults: 100 });
const siteLicensePlaytime = await web.siteLicenseService.getTotalPlaytime({
  startTime: "2026-06-01T00:00:00Z",
  endTime: "2026-06-02T00:00:00Z",
  siteId: 0
});
const level = await web.player.getSteamLevel(76561198000000000n);
const leaderboard = await web.leaderboards.getLeaderboardsForGame(480);
const voteSummary = await web.publishedItemVoting.userVoteSummary({
  steamId64: 76561198000000000n,
  publishedFileIds: [123456789n]
});
const ticketUser = await web.userAuth.authenticateUserTicket({
  appId: 480,
  ticket: Buffer.from("ticket-bytes").toString("hex"),
  identity: "steam-bridge-example"
});

const txn = await web.microTxnSandbox.initTxn({
  appId: 480,
  orderId: 9001n,
  steamId64: 76561198000000000n,
  language: "en",
  currency: "USD",
  items: [{ itemId: 100, quantity: 1, amount: 199, description: "Credits" }]
});
```

## Layout

- `crates/native`: Rust N-API module.
- `packages/steam-bridge`: TypeScript public package, compatibility adapter,
  reusable macOS launcher/signing templates, and a macOS app preparation CLI for
  Electron overlay packaging.
- `examples/electron-basic`: overlay-focused Electron smoke app using App ID
  `480`, with packaged smoke builds for every supported platform.
- `docs/steam-api-coverage.md`: current Steamworks coverage and known gaps.
- `docs/research`: implementation notes, platform research, and the current
  cross-platform overlay verification status.
- `.github/workflows`: CI and release/prebuild scaffolding.

## Local Development

Prerequisites:

- Node.js 22.13 or newer for the repository toolchain.
- Rust stable.
- Steamworks SDK files available through the standard `steamworks-sys` setup or
  `STEAMWORKS_SDK_PATH`.

```sh
npm install
npm run native:build
npm run build
```

When updating the bundled Steamworks SDK metadata, regenerate the exact SDK enum
surface before running checks:

```sh
npm run steamworks-enums:generate
```

If you build the native module by another path, set `STEAM_BRIDGE_NATIVE_PATH`
to the `.node` file before requiring the package.

To run the Electron smoke app:

```sh
npm install
npm run native:build
npm run example:start
```

You can override the smoke app ID if you have your own Steam app:

```sh
STEAM_BRIDGE_APP_ID=480 npm run example:start
```

To package the smoke app for platform checks, download artifacts from a
successful `Release` workflow and run one of:

```sh
npm run example:package:mac -- --artifacts-dir /tmp/steam-bridge-release
npm run example:package:linux -- --artifacts-dir /tmp/steam-bridge-release
npm run example:package:win -- --artifacts-dir /tmp/steam-bridge-release
```

For the current supported host platform, a local native build is enough for a
local smoke package. On macOS, that means Apple Silicon only: the local package
path builds and tests the `aarch64-apple-darwin` / arm64 `.app` shape, never an
Intel or universal macOS target. The only supported macOS smoke package command
is `npm run example:package:mac`; it must continue to produce
`SteamBridgeSmoke-darwin-arm64`. The example packager stages
`steam_bridge_native.local.node` under the target prebuild name when a release
prebuild is not present:

The macOS overlay matrix checks that it is running in a native Apple Silicon
`darwin/arm64` shell before it packages or launches the smoke app. Do not run
macOS overlay proof from Intel macOS, Rosetta, or a universal Electron app.
Any future macOS test app, example app, or smoke runner added to this
repository must use the same Apple Silicon-only target shape; Intel macOS is
not a secondary test target. When you need to build or run a local macOS test
app, use the `darwin-arm64` smoke package path only.

```sh
npm run native:build
npm run example:package:mac
```

The [`examples/electron-basic` README](examples/electron-basic/README.md) has
the Steam Deck Game Mode, Steam Deck Desktop Mode, and desktop smoke-test flows,
including autorun JSON output, screenshots, and crash diagnostics.

SpaceWar `480` and the Electron smoke app are for generic initialization,
callback, input, and overlay plumbing checks. Purchase overlays need a real
Steam app launch with a matching App ID and a configured product or transaction.
Keep private app IDs, item definitions, transaction IDs, publisher keys, and
private URLs out of committed examples.

When launching outside Steam, put a `steam_appid.txt` file containing the app ID
next to the executable or in the working directory used by your app.

## Electron Overlay

Electron apps should create one managed Steam overlay for each game window. The
managed overlay owns the native presenter, routes supported Steam surfaces
through presenter-backed paths, waits for Steam overlay callbacks, and parks the
presenter after Steam reports that the overlay has closed. App code should not
need platform-specific overlay host, capture, focus, or timer plumbing.
When the managed overlay is created, Steam Bridge also scrubs Steam's overlay
renderer entries from future Electron child-process preload environment
variables by default, keeping the bridge-owned native presenter as the overlay
target. Set `scrubSteamOverlayChildProcessEnv: false` only for raw diagnostic
comparisons.
On Windows, the default Electron configuration enables Chromium's in-process GPU
path without starting a repaint loop. The Windows smoke helper mirrors that with
`-OverlayInProcessGpu 1`; pass `-OverlayInProcessGpu 0` only for a baseline
comparison. If a Windows smoke run still shows a white or stale overlay, use
`electronConfigureSteamOverlay({ disableDirectComposition: true })` or the
helper's `-OverlayDisableDirectComposition 1` flag for an explicit comparison
run; keep Alt+Tab/close regression checks in that pass because this Chromium
switch has known ghost-window risk in upstream Electron Steam wrapper reports.
Before a long Windows run, launch
`windows-electron-smoke.ps1 -Mode preflight` against the packaged app. The
preflight reports Smart App Control/App Control policy state, Authenticode
status for `SteamBridgeSmoke.exe` and the native `.node` addon, Zone.Identifier
streams, and recent Code Integrity events so native-load blockers are visible
before Steam overlay testing starts. The Windows matrix also writes the same
evidence to `00-preflight/preflight.json`. The full Windows matrix then runs a
direct native-load gate from the exact packaged app before any Steam-launched
overlay case, because Authenticode status alone does not prove SAC/App Control
will allow the native addon to load. Windows live cases also require clean
Electron crash diagnostics, so hidden renderer/GPU/native crashes fail the smoke
helper instead of becoming a manual post-run surprise.
Direct Windows smoke runs pass smoke state through the child process environment
instead of Electron command-line switches, which keeps interactive desktop-session
runs and private checkout values out of fragile process arguments.

```ts
import { app, BrowserWindow } from "electron";
import steamworks from "steam-bridge";

steamworks.electronConfigureSteamOverlay();

app.whenReady().then(async () => {
  const mainWindow = new BrowserWindow({
    width: 1280,
    height: 720
  });

  const client = steamworks.init(480);
  const steamOverlay = client.overlay.createElectronSteamOverlay(mainWindow);

  const storeResult = await steamOverlay.openStoreAndWaitIfAvailable({ appId: 480 });
  if (!storeResult) {
    const storeStatus = steamOverlay.getStoreOpenStatus({ appId: 480 });
    console.warn("Steam store overlay is not waitable right now", storeStatus.reason ?? storeStatus.waitReason);
  }

  await steamOverlay.openFriendsAndWait();
  await steamOverlay.openWebAndWait("https://store.steampowered.com/app/480/", { modal: true });

  // Optional: reuse the configured Shift+Tab target from a controller/menu button.
  // Use the wait form when the app should resume only after Steam closes.
  await steamOverlay.openShortcutTargetAndWaitIfAvailable();
});
```

Supported managed targets include web pages, store pages, checkout, Friends/chat,
profiles, players, community hubs, stats, achievements, user routes, and known
dialog equivalents. Use the named helpers such as `openFriends()`,
`openStoreIfAvailable(...)`, `openCheckoutIfAvailable(...)`,
`openFriendsAndWait()`, `openStoreAndWaitIfAvailable(...)`, and
`openWebAndWait(...)` for common
surfaces. Direct helpers return after Steam activation starts; wait helpers
resolve after Steam closes and the presenter parks. Use `open(target)` or
`openAndWait(target)` when you need to construct a target object dynamically.
Non-wait helpers fail before activation when fresh diagnostics already prove a
known blocker such as Steam not running, the overlay hook not being ready, a
busy managed overlay, or an unavailable macOS native host. Wait helpers share
the same preflight: hard blockers fail before native-host activation, while a
temporary `overlay-not-ready` state can wait for Steam readiness before
activating Steam. Prefer the wait or `IfAvailable` forms for normal UI buttons
and controller bindings.
`openAndWait(...)` validates those routes before preparing the native host and
rejects raw native prompt routes. Use
`open({ ..., route: "native" })` only when you are explicitly collecting
diagnostic evidence for raw Steamworks overlay behavior. If overlay readiness
times out before Steam activation, the scoped native-host hold is released and
the presenter returns to its idle state.
Use named status helpers such as `getStoreOpenStatus(...)`,
`getCheckoutOpenStatus(...)`, `getShortcutOpenStatus()`, or the generic
`getOpenStatus(target)` before wiring menus, controller buttons, or checkout
fallbacks when the app needs a side-effect-free target/native-host preflight.
They validate the managed route and report whether the target can be opened and
waited on without touching Steam overlay UI.
For real purchase buttons that do not have a checkout target until `InitTxn`
returns, use `getCheckoutOperationStatus()` first; `canStartOperation=false`
means the app should not start its backend transaction yet.
Use named `*IfAvailable(...)` helpers, `openIfAvailable(target)`, or
`openAndWaitIfAvailable(target)` when a button or controller binding should
quietly do nothing for known unavailable states and still surface real errors
after an overlay open begins. These helpers also return `null` while Steam's
overlay is already active or the managed presenter is still opening a previous
overlay, so duplicate menu/button presses do not start a second overlay action.
If fresh diagnostics report Steam is not running, both helpers return `null`
with `reason: "steam-unavailable"`. If diagnostics report the Steam overlay is
not ready yet, direct `openIfAvailable(target)` returns `null` with
`reason: "overlay-not-ready"`; `openAndWaitIfAvailable(target)` can still wait
for overlay readiness before activation when the target has a verified managed
wait route. If Steam stops while an `IfAvailable` wait is still in that
pre-activation readiness phase, the safe helper returns `null` without opening
Steam overlay UI; the throwing `openAndWait(target)` path rejects before
activation instead. Once Steam overlay activation has actually begun, failures
still surface as errors.
Use `getShortcutOpenStatus()` for the same side-effect-free check against the
configured Shift+Tab/controller target.

While inactive, the presenter stays transparent, click-through, non-focusable,
and idle at `0` FPS. Passive Steam notifications use the same presenter without
forcing a permanent Electron repaint loop. The default Shift+Tab bridge opens a
verified Friends/chat target; set `overlayShortcut.target` to choose another
presenter-backed target. Controller or in-game menu buttons can call
`steamOverlay.openShortcutTargetIfAvailable()` or
`steamOverlay.openShortcutTargetAndWaitIfAvailable()` to reuse that same target
without duplicating resolver logic. Dynamic shortcut targets are resolved only
when the shortcut actually opens. `getShortcutOpenStatus()`
does not call app code; it reports a dynamic target as dynamic unless a stronger
side-effect-free blocker is already known, such as Steam not running, an
overlay hook that is not ready yet, or a locked/asleep macOS native host. On
macOS, keyboard-triggered and programmatic shortcut opens also fail before
resolving a dynamic target callback while a hard blocker such as Steam stopped
or native-host-unavailable is already known. The non-waiting
`openShortcutTarget()` helper also fails before resolving dynamic target
callbacks while the overlay hook is known not ready. If the shortcut fires
before Steam reports the overlay hook ready, Steam Bridge keeps the shortcut in
the managed wait path, waits for readiness before activation, and leaves the
macOS global shortcut unregistered while that wait is pending so Steam can
receive the close/toggle input after the overlay appears.
If a macOS shortcut-open attempt fails before Steam reports a shown overlay,
Steam Bridge restores the Electron window and re-registers the fallback
shortcut only when the final state is no longer an active Steam overlay. A
native-host-unavailable transition during that wait stays warning-free and
returns focus to the app without using a timer.

On macOS, the managed helper fails fast before Steam overlay activation if the
screen is locked or the display is asleep. Use
`steamworks.isSteamOverlayNativeHostUnavailableError(error)` and check
`error.reason` when you need to fall back to another purchase or browser flow.

For checkout, use `steamOverlay.openCheckoutAndWait(() => startTxn())`.
Use `steamOverlay.getCheckoutOperationStatus()` to decide whether the app should
enable or start a purchase operation before `InitTxn` runs.
Use `steamOverlay.openCheckoutAndWaitIfAvailable(() => startTxn())` when a
purchase button should return `null` instead of starting `InitTxn` while the
managed overlay is closed, Steam is not running, the macOS native host is
unavailable, or another managed overlay action is already active/opening. If
Steam is merely still reporting `overlay-not-ready`, this safe helper waits for
readiness first and still does not call `startTxn()` until the checkout UI can
be shown. If Steam stops during that readiness wait, the safe helper returns
`null` and leaves `startTxn()` uncalled; the throwing checkout wait rejects
before starting the backend transaction.
The throwing `openCheckoutAndWait(...)` path also waits for Steam overlay
readiness before it calls `startTxn()`, so a temporary Steam bootstrap delay
does not create a real transaction before Steam can show the checkout UI.
If the returned `InitTxn`/checkout envelope contains an app ID,
`openCheckoutAndWait(...)` checks it against the initialized Steam app ID before
opening checkout, and mismatch errors keep the raw app IDs out of logs. Pass
`expectedAppId` only when you need to override that default in a controlled
test harness.
Lower-level async `withCheckoutPrepared(...)` uses the same hard-blocker
availability gate and also waits through a temporary `overlay-not-ready` state
before calling the wrapped transaction/preparation callback. Standalone
`prepareForCheckout()` is synchronous, so it remains an immediate preflight and
throws instead of priming the native surface while Steam is stopped, the overlay
is not ready, the native host is unavailable, or another managed overlay action
is active. Use `openCheckoutAndWait(...)` for the normal managed purchase path.
`steamOverlay.openCheckout(...)` and
`steamOverlay.openCheckoutIfAvailable(...)` are also available when you already
have a resolved checkout target and intentionally do not need to await overlay
close; real purchase flows should normally prefer the wait helper.
`MicroTxnAuthorizationResponse` is a purchase authorization event, not an
overlay-close signal, so keep the managed presenter alive until Steam reports
the overlay inactive. Steam Bridge normalizes the callback's Steam app ID,
order ID, and authorization flag to `appId`, `orderId`, and `authorized` even
when the native payload uses SDK-style field names. The returned checkout wait
result includes
`targetSnapshot`, and `steamworks.snapshotSteamOverlayTarget(target)` is
available for other diagnostics; use those sanitized snapshots in logs instead
of raw checkout targets because they keep only presence flags for checkout URLs,
transaction IDs, return URLs, and Steam IDs. App ID `480` proves generic
checkout routing only; real purchase UI and `InitTxn` proof require your own
Steam app ID with configured products. The macOS checkout matrix preflights a
private `--checkout-json-file` through the same checkout target resolver before
launching Steam, passing the matrix `--app-id` into that resolver so embedded
app IDs use the same wrong-app guard as runtime checkout opens without printing
either value. Bad `InitTxn` captures fail before any live overlay work and only
sanitized presence flags are printed. You can run the same check directly with
`npx steam-bridge-validate-checkout-target --file <private-init-txn-response.json> --expected-app-id <your-app-id>`.
The validator treats Steam SDK-style app ID fields such as `m_unAppID` and
`m_nAppID` as embedded app IDs too, including when they appear inside line-item
arrays, so private captures report
`appId.present=true` without printing the value.
Matrix dry-run and live command logs also redact checkout file paths, checkout
URLs, return URLs, transaction IDs, and control tokens; they prove those inputs
were wired by showing the option name with `REDACTED`, not the private value.
SDK-style order and transaction fields from Steam callbacks are treated as
private checkout identifiers too.
When `--require-microtxn-callback` is used for real checkout proof, the macOS
summary requires a `MicroTxnAuthorizationResponse` callback with an attached
native presenter snapshot during the `openCheckoutAndWait(...)` lifecycle,
before the checkout wait is allowed to complete. Required real-checkout proof
also verifies the callback app ID matches the launched Steam app and that the
callback includes Steam's authorization result plus a redacted order ID
presence marker.
For split-step checkout targets outside the managed wait helper, call
`steamworks.overlay.checkoutTargetFromResult(initTxnResponse, { expectedAppId })`
to get the same wrong-app guard before handing the target to a shortcut or other
managed overlay route.
If a managed overlay wait, checkout preparation, or checkout native-host guard
fails, catch the original error and call
`steamworks.getSteamOverlayErrorTargetSnapshot(error)` or
`steamworks.getSteamOverlayCheckoutErrorTargetSnapshot(error)` before logging.
Those helpers expose the same sanitized target context without raw checkout
values.

The full Electron overlay API and platform notes are in
[`packages/steam-bridge/README.md`](packages/steam-bridge/README.md). Current
Deck, Linux, macOS, Windows-helper, and real-purchase evidence is tracked in
[`docs/research/cross-platform-overlay-status.md`](docs/research/cross-platform-overlay-status.md).

## Diagnostics

Steam API initialization and overlay readiness are different states. A
`steam_appid.txt` file can be enough for Steam ID, auth tickets, and callbacks
while the overlay still cannot hook the process.

Use `client.utils.getOverlayDiagnostics()` to log `steamRunning`, `appId`,
`overlayEnabled`, `overlayNeedsPresent`,
`overlayNeedsPresentPollingEnabled`, `steamDeck`, `bigPicture`, and
`steamInstallPath`. On macOS,
`overlayNeedsPresentPollingEnabled=false` means Steam Bridge is avoiding
Steam's crash-prone `BOverlayNeedsPresent()` call; `overlayNeedsPresent=false`
alone is not enough to prove that.

## Verification

The Electron smoke app lives in
[`examples/electron-basic`](examples/electron-basic). Its platform helpers emit
`STEAM_BRIDGE_SMOKE_RESULT` JSON, lifecycle logs, screenshots where available,
and crash diagnostics.
All macOS smoke packaging and matrix runs build and execute Apple Silicon arm64
apps only; they do not build, run, or verify Intel or universal macOS bundles.
Use the smoke action `presenter-ready` for a cheap managed-overlay preflight:
it attaches the Electron overlay manager, records native host availability, and
does not activate Steam overlay UI.
Use `presenter-duplicate-open-guard` to prove the public `IfAvailable` overlay
helpers for every named managed target, plus shortcut/controller and checkout
target helpers, return `null` instead of starting a second overlay while a
managed overlay is already opening. The same proof also verifies that checkout
`IfAvailable` wait helpers do not start the transaction operation while busy.
The macOS minimal/core/full/persistent matrix suites require that proof, so
regressions in duplicate menu/button suppression fail before release.
On macOS, that preflight intentionally does not require
`overlayEnabled=true`; Steam can attach an inert `gameoverlayui` target before
any `GameOverlayActivated(true)` callback.
On macOS, `--require-no-crashes` also copies fresh
`SteamBridgeSmoke*.ips` reports from `~/Library/Logs/DiagnosticReports` into
the artifact's `macos-crash-reports/` directory and fails the run with a short
crash signature, so ignored macOS crash dialogs count as test failures. The
macOS matrix summarizer also rejects any copied smoke `.ips` report it finds in
an artifact.

Run platform matrix checks:

```sh
npm run steam-deck:overlay-matrix -- \
  --host deck@<deck-host-or-ip> \
  --suite core

npm run macos:steam-client-health
npm run macos:overlay-matrix -- --suite core
```

`npm run macos:steam-client-health` does not launch the smoke app or touch the
Steam shortcut. Its artifact records the running Steam PID/helper state, current
SteamChrome IPC log evidence, stale SteamChrome temp entry counts, POSIX
semaphore/shared-memory handle counts, Steam process file-descriptor counts,
`launchctl maxfiles`, kernel file
counters, `/private/tmp` disk state, and derived resource warnings. A running
Steam client that is already at roughly the whole `launchctl maxfiles` soft
limit is treated as unhealthy, because that state can prevent SteamChrome and
overlay IPC resources from being created. Failed health artifacts include a
recommended recovery block; for file-limit failures that means restarting Steam
from a macOS session with a higher `launchctl maxfiles` soft limit before live
overlay proof. The macOS overlay matrix also runs this health gate before
launching smoke cases; if the matrix had to restart Steam after a shortcut
update, it waits for this detector to pass before launching the smoke app. When
the matrix owns a Steam startup or shutdown, it
also removes stale
Steam IPC state only after Steam is fully stopped: orphan `ipcserver`, stale
`/private/tmp/steam.pipe`, and stale
`/private/tmp/steam_chrome_{overlay,shmem}_uid*_spid*` entries for the current
user. If the matrix itself attempted to start Steam and Steam exits or remains
stuck before login, the startup health artifact treats the missing `steam_osx`
client as a failure and records orphan `ipcserver`/IPC resource state. This
keeps overlay tests failing at the client boundary instead of producing a
misleading app-level failure.

Validate matrix commands without platform hardware:

```sh
npm run steam-deck:overlay-matrix:check
npm run macos:overlay-matrix:check
```

Run the same core checks as CI:

```sh
npm run check:electron
npm run check:platform
npm test
npm run native:fmt
npm run native:check
npm run api:check
```

Before refreshing live Electron overlay evidence after an Electron release,
check the smoke runtime against npm's current Electron version:

```sh
npm run check:electron:latest
```

Current overlay evidence is tracked in
[`docs/research/cross-platform-overlay-status.md`](docs/research/cross-platform-overlay-status.md).
Native presenter design notes are tracked in
[`docs/research/native-overlay-presenter-plan.md`](docs/research/native-overlay-presenter-plan.md).

Current macOS Apple Silicon overlay proof is intentionally summarized here and
kept in detail in the research docs:

- Full process-per-case proof:
  `/tmp/steam-bridge-macos-overlay-matrix-full-post-reboot-20260701` reused the
  signed arm64 Electron `43.0.0` smoke package and stable App ID `480` Steam
  shortcut after a macOS reboot without repackaging or restarting Steam, then
  passed all 55 presenter-backed overlay routes.
- Persistent one-process proof:
  `/tmp/steam-bridge-macos-overlay-matrix-persistent-post-reboot-20260701`
  reused the same package and shortcut, then passed all 51
  one-process/control-server routes. The first attempt hit Steam's transient
  overlay-readiness timeout at profile `openAndWait(...)`; the bounded retry
  passed, and the final artifact proves the successful long-lived-process
  route.
- Core proof:
  `/tmp/steam-bridge-macos-overlay-matrix-core-post-reboot-20260701` passed all
  37 core routes against the same signed arm64 package and shortcut.
- Locked/asleep unavailable proof:
  `/tmp/steam-bridge-macos-overlay-matrix-unavailable-target-snapshots-20260701-165605`
  reused the signed arm64 Electron `43.0.0` smoke package and stable App ID
  `480` shortcut without restarting Steam, then passed all six unavailable-host
  routes with typed native-host-unavailable errors, sanitized target snapshots,
  no Steam overlay activation, and zero native overlay targets.

Those artifacts cover managed web, store, Friends/chat, checkout, passive
progress/unlock toasts, every supported managed Shift+Tab target, direct
profile/players/community/stats/achievements/user routes, dialog-equivalent
routes, and programmatic shortcut `openAndWait(...)` targets. The summary
auditor requires one Metal presenter-backed overlay target, active/inactive
callback evidence where expected, visible web content where applicable,
close/back-to-app proof, parked `currentFps=0` state, no post-close pumping,
disabled macOS `BOverlayNeedsPresent()` polling, zero managed overlay timing,
managed Electron child-overlay isolation, named open-status and checkout
operation diagnostics, redacted checkout command values, and clean crash
diagnostics. Public App ID `480` proves generic checkout routing only; real
purchase-content proof still requires a real configured Steam app/product and
the private `--checkout-json-file` checkout suite.

## Shipping Notes

- Use App ID `480` only for local Steamworks smoke tests.
- Use your own App ID before shipping or testing app-specific achievements,
  stats, inventory, UGC, economy, checkout, or transaction flows.
- macOS support means Apple Silicon only. Build, package, sign, run, and test
  arm64 `.app` bundles; Steam Bridge does not ship or verify Intel macOS or
  universal macOS targets.
- The macOS smoke package uses
  `npx steam-bridge-prepare-macos-app --app-exe <YourApp.app/Contents/MacOS/YourApp>`
  to install the published native launcher as the bundle executable, rename
  Electron to `<AppExecutable>.electron`, apply the Steam overlay entitlements,
  and verify the prepared app shape. For shipped macOS builds, apply equivalent
  entitlements through your normal Apple signing/notarization pipeline: allow
  dyld environment variables, disable library validation, and keep App Sandbox
  disabled so Steam can inject the overlay into the launched process. The signed
  smoke package is part of the live macOS overlay matrix, and the matrix
  verifies the bundle `Info.plist` names the native launcher as
  `CFBundleExecutable`, verifies that executable carries Steam Bridge's native
  launcher identity while `<AppExecutable>.electron` does not, then checks both
  smoke executables are arm64-only and signed with those entitlements before it
  launches Steam. These packaging requirements are covered by the same
  Steam-launched proof as the public overlay helpers. Published package
  consumers can also run
  `npx steam-bridge-verify-macos-signing --app-exe <YourApp.app/Contents/MacOS/YourApp>`
  against their shipped launcher shape.
- `electron-builder` apps can hide that packaging step in normal lifecycle
  hooks: call `prepareMacosSteamAppAfterPack(context, { skipSign: true })` from
  `afterPack`, sign with the published macOS entitlement template, then call
  `verifyMacosSteamAppAfterSign(context)` from `afterSign`. The helper skips
  non-mac targets and rejects Intel or universal macOS targets.
- Steam Bridge does not vendor the Steamworks SDK or Valve redistributables.
- Windows release and smoke packages must Authenticode-sign the Electron
  executable and native `.node` addon with a trusted publisher certificate
  before testing on machines with Windows Smart App Control or App Control for
  Business enabled. A local Windows 11 live test on July 1, 2026 proved that an
  unsigned `steam_bridge_native.win32-x64-msvc.node` is blocked before Steam can
  initialize, even though the package was built on macOS from the GitHub
  Windows x64 prebuild. Mac-built Windows packages remain supported, but the
  final Windows app must go through a normal Windows code-signing/reputation
  path before overlay proof on SAC-enabled machines. The smoke package includes
  `sign-windows-package.ps1` for this step:

  ```powershell
  # Use an installed private-key code-signing certificate.
  .\sign-windows-package.ps1 -CertificateThumbprint "<thumbprint>"

  # Or import a PFX without putting the password in the command line.
  $env:STEAM_BRIDGE_WINDOWS_PFX_PASSWORD = "<password>"
  .\sign-windows-package.ps1 -PfxPath "C:\path\publisher-cert.pfx"

  # Audit the current package without signing.
  .\sign-windows-package.ps1 -VerifyOnly -AllowUnsigned
  ```

  A self-signed or locally trusted certificate can be useful for syntax checks,
  but it is not enough evidence for Smart App Control; use a real trusted and
  reputable publisher signing path for live Windows overlay proof.
  The smoke package also includes `windows-overlay-matrix.ps1` for repeatable
  Steam-launched Windows proof. It runs the same report-only preflight first,
  then runs a short direct native-load gate from the exact packaged app and
  requires Steam initialization plus clean crash diagnostics before live overlay
  cases. This catches packages that report Authenticode `Valid` locally but are
  still blocked by Smart App Control/App Control reputation or enterprise
  signing policy. Native-load failures leave human logs and structured JSON
  under `00-preflight/native-load-gate`, including a post-failure Code
  Integrity snapshot:

  ```powershell
  .\windows-overlay-matrix.ps1 `
    -Suite baseline `
    -LaunchMode steam-launch `
    -InstallShortcut
  ```

  The baseline suite uses the ordinary Windows Electron/Steam overlay path for
  web, store, Friends, and passive achievement notifications. It enables
  Chromium's in-process GPU path by default, matching the public Electron helper
  default on Windows; pass `-OverlayInProcessGpu 0` only for baseline comparison
  artifacts. The managed suite is available for comparison only; keep the normal
  path as the Windows default unless evidence from that baseline proves
  additional machinery is needed. Each matrix case passes `-RequireNoCrashes`,
  so Windows artifacts must prove both overlay behavior and a clean Electron
  crash-diagnostic snapshot.
  The Windows matrix is intentionally process-per-case right now. A
  one-process control-server harness is useful future research, but it is not
  the Windows proof path until it can wait on overlay readiness and run without
  destabilizing Steam's webhelper/client UI.
  The Windows matrix stores one stable non-Steam shortcut whose launch options
  point at a local smoke env file, then rewrites only that env file for each
  case. If the shortcut must be added or materially updated while Steam is
  already running, the matrix stops and asks for a full Steam restart instead of
  editing `shortcuts.vdf` under a live client. When standalone Node.js is not
  installed, the matrix uses the packaged Electron executable in Node mode to
  run the shortcut updater. Use `-Suite shortcut` when you only want to verify
  or refresh the stable Steam shortcut before live overlay cases.
