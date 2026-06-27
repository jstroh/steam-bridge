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
const session = client.overlay.activateDialogWithNativeSession("Friends", {
  ...steamworks.electronNativeOverlaySessionOptions(mainWindow),
  title: "Steam Overlay"
});

// Other overlay targets use the same bridge-owned native presenter lifecycle:
// const session = client.overlay.activateToStoreWithNativeSession(
//   480,
//   client.overlay.StoreFlag.None
// );
// const session = client.overlay.activateToWebPageWithNativeSession(
//   "https://store.steampowered.com/app/480/",
//   { modal: true, ...steamworks.electronNativeOverlaySessionOptions(mainWindow) }
// );

// Optional explicit cleanup when the proof surface is no longer needed.
session.close();
```

The native presenter currently uses the macOS probe implementation on macOS and
an X11/GLX probe implementation on Linux. On Steam Deck Desktop Mode, the Linux
managed native web session is the current generic proof path for overlay
activation, visual open, close, and back-to-app checks. Use
`activateToWebPageWithNativeSession(..., { modal: true })` or the Electron smoke
app's `native-web` action for that proof. Steam's Desktop Mode social overlay
can still remain visually stuck over Electron after deactivation, so
Friends/Game Overview should be treated as callback/render evidence rather than
a completed dismissal proof.

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
