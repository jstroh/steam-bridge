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

Steam Bridge targets Steam desktop platforms for Electron and Node:

- macOS Apple Silicon: `aarch64-apple-darwin`
- Windows x64: `x86_64-pc-windows-msvc`
- Linux x64: `x86_64-unknown-linux-gnu`

Intel macOS is intentionally not supported. CI, release prebuilds, runtime
loading, and native linking enforce the supported target list.

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
- `packages/steam-bridge`: TypeScript public package and compatibility adapter.
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

The example README has the Steam Deck Game Mode, Deck Desktop Mode, and desktop
platform smoke-test flow, including an autorun mode that prints a
`STEAM_BRIDGE_SMOKE_RESULT` JSON line for scripted checks. When scripting Steam
Deck non-Steam shortcuts, reload Steam after writing `shortcuts.vdf` and launch
the printed full shortcut game ID, not the internal shortcut app ID.
The managed Electron overlay helper also owns the default Shift+Tab keyboard
shortcut bridge, routing it through the same presenter-backed Friends/chat path
used by the Deck Desktop proof instead of relying on Steam to hook Chromium
child processes. Apps can set `overlayShortcut.target` to any presenter-backed
target when they want Shift+Tab to open store, web, checkout, community, stats,
achievements, or dialog-equivalent surfaces instead.

SpaceWar `480` and the Electron smoke app are for generic initialization,
callback, input, and overlay plumbing checks. Purchase overlays need a real
Steam app launch with a matching App ID and a configured product or transaction;
keep private app IDs, item definitions, transaction IDs, publisher keys, and
private URLs out of committed examples.

When launching outside Steam, put a `steam_appid.txt` file containing the app ID
next to the executable or in the working directory used by your app.

Before opening a pull request, run the checks that CI runs:

```sh
npm run check:platform
npm test
npm run native:fmt
npm run native:check
npm run api:check
```

## Overlay Diagnostics

On macOS, Steam API initialization and the in-game overlay are separate
successes. `steam_appid.txt` can be enough for Steam ID, auth tickets, and
callbacks while the overlay still never hooks an Electron `BrowserWindow`.

Steam Bridge exposes `client.utils.getOverlayDiagnostics()` so the host app can
log what Steam sees:

- `steamRunning`
- `appId`
- `overlayEnabled`
- `overlayNeedsPresent`
- `steamDeck`
- `bigPicture`
- `steamInstallPath`

Steam Bridge also includes a managed native overlay session for diagnostics and
Deck/Desktop proof runs. The session opens a bridge-owned native presenter,
pumps it on an internal timer, activates the requested Steam overlay target,
and tracks whether Steam reported overlay activation:

```ts
const session = client.overlay.activateToWebPageWithNativeSession("https://store.steampowered.com/app/480/", {
  ...steamworks.electronNativeOverlaySessionOptions(mainWindow),
  modal: true,
  title: "Steam Overlay"
});

// Other overlay targets use the same bridge-owned native presenter lifecycle:
// const session = client.overlay.activateToStoreWithNativeSession(
//   480,
//   client.overlay.StoreFlag.None
// );
// Prefer client.overlay.openFriendsOverlay(...) for a reusable Friends List path.

// Optional explicit cleanup when the proof surface is no longer needed.
session.close();
```

For app-facing Electron integration, create one managed overlay for the game
window and use it for overlay work:

```ts
const steamOverlay = client.overlay.createElectronSteamOverlay(mainWindow, {
  title: "Steam Overlay",
  // Optional diagnostics only:
  // presenterMode: "session"
});

steamOverlay.open({
  type: "web",
  url: "https://store.steampowered.com/app/480/",
  modal: true
});

steamOverlay.open({
  type: "store",
  appId: 480
});

// Prime the presenter before your backend starts an in-game InitTxn flow.
steamOverlay.prepareForCheckout();

// Open a Steam checkout URL returned by InitTxn, or pass transactionId when
// reopening a known transaction approval page.
steamOverlay.open({
  type: "checkout",
  steamUrl: txn.steamurl
});

// Prime the same presenter for passive Steam notifications.
steamOverlay.prepareForNotification();

steamOverlay.open({ type: "friends" });

steamOverlay.open({
  type: "dialog",
  dialog: "Achievements",
  appId: 480
});

steamOverlay.open({
  type: "achievements",
  appId: 480
});

// Optional; the manager closes itself when the Electron window closes.
steamOverlay.close();
```

The manager owns a reusable native presenter, keeps it passive and click-through
while idle, polls Steam overlay state cheaply, and only pumps frames when Steam
reports `overlayNeedsPresent` or an overlay is being opened/active. This is the
path intended for checkout overlays and passive Steam notifications without
forcing the Electron game window into a constant repaint loop. By default
`idleFps` is `0`; set it explicitly only for diagnostic comparisons. Use
`attachPresenter(...)` and pass `presenter` to `openSteamOverlay(...)` directly
only when you need lower-level lifecycle control.
Call `steamOverlay.snapshot()` when you need diagnostics; it returns the native
presenter state plus an `electronOverlay` block with the presenter mode,
shortcut policy, and window-close ownership.
The smoke verifiers can require those managed diagnostics with
`--require-electron-overlay`, `--require-presenter-mode <persistent|session>`,
and `--require-overlay-shortcut-target <target>`. For resolver-backed shortcut
targets, the verifier checks the smoke app's configured target while preserving
`electronOverlay.overlayShortcut.targetType: "function"`. The Deck runner adds
the presenter-mode requirement automatically for presenter-backed product
actions and adds the shortcut-target requirement for `presenter-shortcut`.
For emergency diagnostics, set `presenterMode: "session"` or
`STEAM_BRIDGE_DISABLE_ELECTRON_OVERLAY_PRESENTER=1` to disable the reusable
presenter and fall back to the older one-shot native-session lifecycle while
keeping the same `steamOverlay.open(...)` calls. That mode is intended for
isolating presenter regressions; it may pump more aggressively and is not the
recommended Steam Deck Desktop product path.
The smoke helpers expose the same comparison as `--presenter-mode session`, so
Deck and Linux runs can switch modes without hand-editing Steam shortcut launch
options.

`electronConfigureSteamOverlay()` also keeps Electron's Chromium children from
becoming competing Steam overlay targets. By default it removes Steam's overlay
renderer from child-process preload environment variables and, on Linux, adds
Electron's `no-zygote` switch so GPU/renderer children exec without inheriting
the already-loaded Steam overlay library. This leaves the bridge-owned native
presenter as the single overlay target. Pass
`isolateSteamOverlayChildProcesses: false` only for diagnostics.
The Steam Deck smoke runner can assert this with
`--require-single-overlay-target`, and it enables that assertion automatically
for presenter-backed product actions.
It also asserts idle/passive presenter state where appropriate: checkout
readiness and the managed shortcut bridge must be parked at `idleFps: 0` /
`currentFps: 0`, while passive notification tests must remain transparent,
click-through, non-focusable, and overlay-inactive.
Presenter close and managed shortcut close probes also require delayed
post-close presenter snapshots showing the reusable host parked back at passive
idle: transparent, click-through, non-focusable, overlay-inactive, and
`currentFps: 0`. The Deck verifier compares the first and stable post-close
samples and fails if `pumpCount` increases after the host should be idle.
Presenter-backed product actions also require the smoke app's crash diagnostics
to stay clean: no crash dump files and no fatal Electron lifecycle events.

On Linux/X11, the presenter separates visibility from input. Fully idle mode is
transparent, non-focusable, click-through, and cheap to keep alive. When Steam
reports `overlayNeedsPresent`, the host can become visible while remaining
click-through so passive notifications can render. Opening or active overlay
mode restores both host opacity and input so Steam web or checkout UI can
receive clicks; after Steam reports overlay inactive, the host parks back to
transparent idle mode even if `overlayNeedsPresent` lingers briefly.

The Electron smoke app includes a `presenter-achievement-progress` action for
passive notification proof. On Steam Deck Desktop Mode, this action uses App ID
`480`, keeps the presenter passive, calls `achievement.indicateProgress(...)`,
receives an achievement-stored callback, and captures a visible Steam
achievement-progress toast over the app without requiring a modal overlay
activation callback.

Steam Bridge routes overlay targets by how Steam renders them. Prefer
`client.overlay.createElectronSteamOverlay(mainWindow).open(...)` for Electron
app code: web, store, Friends, Community, Stats, Achievements, and checkout
targets use the presenter-backed paths proven on Steam Deck Desktop Mode, while
`route: "native"`, `openNativeStoreOverlay(...)`, and the lower-level named
helpers remain available for explicit native diagnostics. Store targets default
to the Steam store web overlay surface because that is the reusable Deck
Desktop path that opens, accepts input, closes, and returns to Electron cleanly.
The public smoke app can verify checkout readiness, but
real purchase-content proof still requires a real Steam app and configured
product. For in-game microtransactions, call
`steamOverlay.prepareForCheckout()` before your backend starts `InitTxn` so
Steam's automatic authorization UI has a native presenter ready. If Steam
returns a web checkout URL, pass it with `steamOverlay.open({ type: "checkout",
steamUrl })`. If you have a transaction id, use `transactionId` and Steam
Bridge builds the approval URL. Treat `MicroTxnAuthorizationResponse` as a
purchase authorization event, not as an overlay-close event; keep the presenter
alive until Steam emits overlay inactive and the app has returned. The smoke app
records presenter diagnostics on `callback:microtxn` so real-app purchase runs
can prove the presenter was still available during authorization. For passive
Steam notifications such as
achievement progress toasts, call `steamOverlay.prepareForNotification()` before
invoking the Steam API. With the
default child-process isolation, Deck Desktop Mode has verified this path with a
single `gameoverlayui` process, paired active/inactive callbacks, and visual
return to the Electron app. Passive achievement-progress toasts also render with
the presenter transparent and click-through. For a generic Friends List surface,
call `steamOverlay.open({ type: "friends" })`; on Steam Deck Desktop Mode this
opens Steam Community chat through the same native web presenter with one
`gameoverlayui` target and a clean close/back-to-app result. For app
achievements, call `steamOverlay.open({ type: "achievements", appId })`; it
opens the current user's app achievements page through the same presenter-backed
Steam web overlay route instead of relying on the raw Desktop achievements
dialog. Steam Community may redirect apps without public web stats to the user's
profile, so use your real app for achievements content proof.
The high-level dialog target also uses these verified equivalents for known
dialog names: `Friends` opens chat, `Community` and `OfficialGameGroup` open the
app Community hub, `Stats` opens the current user's app stats page, and
`Achievements` opens the current user's achievements page. On Steam Deck Desktop
Mode, the public App ID `480` smoke matrix has verified all five dialog names
through `presenter-dialog-auto` with visible Steam web content, active/inactive
callbacks, one overlay target, clean return to Electron, parked idle presenter
state, and no crash evidence. Pass `route: "native"` only when you intentionally
need raw `ActivateGameOverlay` dialog behavior for diagnostics.
Do not use `steam://open/overlay` as a generic overlay-toggle substitute; Deck
Desktop testing showed it can activate Steam's callback path while leaving the
native presenter black and the smoke process unrecovered.
Raw `ActivateGameOverlay("Friends")`, Game Overview, and overlay hotkey toggling
remain investigation paths: allowing Steam to hook Electron children can make
Steam's desktop social UI render, but that duplicate hook can leave stale
overlay surfaces after close; isolating children fixes product overlays but
prevents that raw dialog path from rendering through Chromium. For Electron
keyboard toggle behavior, `createElectronSteamOverlay(...)` installs a default
Shift+Tab bridge that opens the verified Friends/chat presenter route.

The native presenter currently uses the macOS probe implementation on macOS and
an X11/GLX probe implementation on Linux. On Steam Deck Desktop Mode, the Linux
reusable presenter path is the current generic proof path for product overlay
activation, visual open, close, and back-to-app checks. Use
`client.overlay.createElectronSteamOverlay(...)` with `steamOverlay.open(...)`,
or the lower-level `client.overlay.attachPresenter(...)`,
`client.overlay.openSteamOverlay(...)`, `client.overlay.openWebOverlay(...)`,
`client.overlay.openFriendsOverlay(...)`, `client.overlay.openCommunityOverlay(...)`,
`client.overlay.openStatsOverlay(...)`, `client.overlay.openStoreOverlay(...)`,
and `client.overlay.openDialogEquivalentOverlay(...)` helpers, or the Electron smoke app's
`presenter-web` / `presenter-store` / `presenter-friends` / `presenter-community` /
`presenter-stats` / `presenter-dialog-auto` / `presenter-shortcut` actions for
that proof. The older
`activateToWebPageWithNativeSession(..., { modal: true })` / `native-web` path
remains compatibility coverage. Steam's raw Desktop Mode dialog/Game Overview
overlay and hotkey toggle should not be treated as completed dismissal proofs.
The managed Electron overlay also exposes a compatibility fallback through
`presenterMode: "session"` or
`STEAM_BRIDGE_ELECTRON_OVERLAY_PRESENTER=session`; use it only to compare
against the reusable presenter when diagnosing a platform regression. The
packaged Linux helper and Deck SSH runner also accept `--presenter-mode session`
for that repeatable comparison. In session mode the Deck runner still checks
overlay callbacks, focus return, and crash diagnostics, but it skips the
persistent-host single-target and post-close parking invariants.

For repeatable Deck evidence, the smoke host runner can copy the remote result
log and diagnostics directory back to the local machine with
`--collect-diagnostics-dir`, and can capture Deck screenshots with
`--visual-capture-dir`. Use `--visual-close-probe` for `presenter-friends`
close/back-to-app proof and for raw social-overlay investigation; it sends a
Deck-side Shift+Tab/Escape probe and records before and after screenshots. For
presenter-backed product web surfaces, the close probe also verifies
`active=false`, confirms focus returned to the smoke app, and checks for
post-close crash evidence.
For presenter-backed Steam web surfaces such as `presenter-community` and
`presenter-stats`, add `--visual-close-input web` to close through the visible
Steam web overlay close control.
Use `--visual-toggle-probe` for shortcut evidence. With `presenter-shortcut`,
the default `--visual-toggle-input keyboard` sends Shift+Tab into Steam Bridge's
managed Electron shortcut bridge and verifies `overlay:shortcut-open`,
`active=true`, `active=false`, focus return, and no post-close crash evidence.
Pass `--shortcut-target <name>` to prove non-default shortcut targets; Deck
Desktop fullscreen testing has verified `--shortcut-target web --web-modal true`
with `--visual-toggle-open-delay 6` so the app is focused first and the opened
Steam web surface is captured after it finishes loading.
With passive presenter or raw dialog actions, the same probe tests raw Steam
hotkey interception. `--visual-toggle-input guide` sends a controller
Guide/Steam-button event through a temporary virtual gamepad.
Add `--overlay-game-id shortcut` when investigating
whether raw Steam overlay close/back routing depends on the full non-Steam
shortcut game ID. Focused Deck Desktop runs still show the raw toggle path as
unresolved; the product overlay paths remain the managed shortcut bridge,
`openSteamOverlay(...)`, the lower-level web/store/Friends/Community/Stats
helpers, and passive presenter notifications.

Set `STEAM_BRIDGE_ELECTRON_OVERLAY_PROFILE=repaint`, or pass
`--steam-bridge-electron-overlay-profile=repaint` to the Electron smoke app, to
opt into the Linux/Desktop overlay repaint profile. That profile keeps Electron
presenting frames at about 30 FPS so Steam has fresh frames to composite when
`overlayNeedsPresent` is true. Use `compatibility` as the stronger fallback when
you also need Chromium's in-process GPU path.

The longer-term Linux/macOS overlay plan is tracked in
[`docs/research/native-overlay-presenter-plan.md`](docs/research/native-overlay-presenter-plan.md).
It keeps the current session helpers intact while shaping a persistent,
passive, bridge-owned presenter that can support checkout overlays and Steam
notifications without app-specific overlay controllers.

## Notes

- Use App ID `480` only for local Steamworks smoke tests.
- Use your own App ID before shipping, publishing builds, or testing
  app-specific achievements, stats, inventory, UGC, or economy flows.
- Steam Bridge does not vendor the Steamworks SDK or Valve redistributables.
