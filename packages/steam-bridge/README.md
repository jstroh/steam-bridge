# steam-bridge

Native-backed Steamworks bridge for Electron and Node.

This package exposes a TypeScript API and a compatibility-style grouped client
for projects that want to call Steamworks from JavaScript while keeping native
Steam API lifecycle, callback dispatch, and encrypted app ticket parsing in
Rust. Modern networking socket create/connect helpers accept per-call
`NetworkingConfigOption` arrays.

This project is 100% created and maintained by Codex.

## Install

```sh
npm install steam-bridge
```

Steam Bridge expects Steamworks SDK redistributables to be present at build or
package time. It does not vendor Valve SDK files.

Steam Bridge targets Steam desktop platforms for Electron and Node:

- macOS Apple Silicon: `aarch64-apple-darwin`
- Windows x64: `x86_64-pc-windows-msvc`
- Linux x64: `x86_64-unknown-linux-gnu`

Intel macOS is intentionally not supported.

## Quick Start

For local smoke tests, use Valve's SpaceWar sample App ID `480`. Replace it with
your own Steam app ID before testing app-specific features or shipping.

```ts
import steamworks from "steam-bridge";

const client = steamworks.init(480);

const steamId = client.localplayer.getSteamId().steamId64;
const ticket = await client.auth.getAuthTicketForWebApi("steam-bridge-example");

client.overlay.activateToWebPage("https://store.steampowered.com/app/480/");
client.callback.register("MicroTxnAuthorizationResponse", (event) => console.log(event));
client.SteamworksEnums.EResult.k_EResultOK;

console.log({ steamId, ticketBytes: ticket.getBytes().length });
```

SpaceWar is useful for generic initialization, callback, input, and overlay
plumbing checks. Purchase overlays and `InitTxn` approval flows must be proven
from your real Steam-launched app with a matching App ID and a configured
product or transaction.

For Steam Web API, publisher inventory, trading, and economy endpoints, use the Web API client with
`STEAM_WEB_API_KEY`, an explicit `apiKey`, or a per-request `key`:

```ts
const currentPlayers = await steamworks.webApi.userStats.getNumberOfCurrentPlayers(480);
const profile = await steamworks.webApi.user.resolveVanityUrl("spacewar");
const news = await steamworks.webApi.news.getNewsForApp({ appId: 480, count: 2 });
const appStatus = await steamworks.webApi.apps.upToDateCheck({ appId: 480, version: 1 });
const gameServerAccounts = await steamworks.webApi.gameServersService.getAccountList();
const notificationSessions = await steamworks.webApi.gameNotificationsService.enumerateSessionsForApp({
  appId: 480,
  steamId64: 76561198000000000n
});
const cheatReport = await steamworks.webApi.cheatReportingService.reportPlayerCheating({
  appId: 480,
  steamId64: 76561198000000000n,
  noReportId: true
});
const broadcastFrame = await steamworks.webApi.broadcastService.postGameDataFrame({
  appId: 480,
  steamId64: 76561198000000000n,
  broadcastId: 123456789n,
  frameData: JSON.stringify({ round: 1, score: 9001 })
});
const cloudFiles = await steamworks.webApi.cloudService.enumerateUserFiles({
  accessToken: "oauth-access-token",
  appId: 480,
  extendedDetails: true
});
const workshopFiles = await steamworks.webApi.publishedFileService.queryFiles({
  queryType: 3,
  creatorAppId: 480,
  appId: 480,
  numPerPage: 10
});
const workshopContributors = await steamworks.webApi.workshopService.getFinalizedContributors({
  appId: 480,
  gameItemId: 100
});
const prices = await steamworks.webApi.economy.getAssetPrices({ appId: 480, currency: "USD" });
const marketEligibility = await steamworks.webApi.econMarketService.getMarketEligibility({
  steamId64: 76561198000000000n
});
const inventoryCount = await steamworks.webApi.inventoryService.getQuantity({
  appId: 480,
  steamId64: 76561198000000000n,
  itemDefIds: [100]
});
const itemHistory = await steamworks.webApi.gameInventory.getUserHistory({
  appId: 480,
  steamId64: 76561198000000000n,
  contextId: 2,
  startTime: 1760000000,
  endTime: 1760003600
});
const tradeSummary = await steamworks.webApi.econService.getTradeOffersSummary({ timeLastVisit: 0 });
const storeApps = await steamworks.webApi.store.getAppList({ includeGames: true, maxResults: 100 });
const siteLicensePlaytime = await steamworks.webApi.siteLicenseService.getTotalPlaytime({
  startTime: "2026-06-01T00:00:00Z",
  endTime: "2026-06-02T00:00:00Z",
  siteId: 0
});
const level = await steamworks.webApi.player.getSteamLevel(76561198000000000n);
const leaderboard = await steamworks.webApi.leaderboards.getLeaderboardsForGame(480);
const voteSummary = await steamworks.webApi.publishedItemVoting.userVoteSummary({
  steamId64: 76561198000000000n,
  publishedFileIds: [123456789n]
});

const txn = await steamworks.webApi.microTxnSandbox.initTxn({
  appId: 480,
  orderId: 9001n,
  steamId64: 76561198000000000n,
  language: "en",
  currency: "USD",
  items: [{ itemId: 100, quantity: 1, amount: 199, description: "Credits" }]
});
```

The package also includes overlay diagnostics through
`client.utils.getOverlayDiagnostics()`, bridge-owned native overlay presenter
helpers such as `client.overlay.attachPresenter()` and
`client.overlay.openWebOverlay()`, and compatibility session helpers such as
`client.overlay.activateDialogWithNativeSession()`,
`client.overlay.activateToStoreWithNativeSession()`, and
`client.overlay.activateToWebPageWithNativeSession()`. Electron helpers include
`electronConfigureSteamOverlay()`, `electronOverlayPresenterOptions()`, and
`electronNativeOverlaySessionOptions()`. Core Steam API success should not be
treated as proof that the Steam overlay has hooked Electron.

For Electron apps, attach a reusable presenter once and reuse it for overlay
work:

```ts
const presenter = client.overlay.attachPresenter(
  steamworks.electronOverlayPresenterOptions(mainWindow)
);

client.overlay.openWebOverlay(checkoutUrl, {
  modal: true,
  presenter
});
```

The presenter stays passive and click-through while idle, polls Steam overlay
state cheaply, and only pumps frames when Steam reports `overlayNeedsPresent` or
an overlay is being opened/active. On Linux/X11, fully idle mode makes the host
transparent and click-through; `overlayNeedsPresent` can make it visible while
leaving input click-through for passive notifications; opening or active overlay
mode restores both opacity and input so Steam web or checkout UI can receive
clicks, then returns to passive mode after Steam reports the overlay inactive.

For Linux Electron apps, use
`electronConfigureSteamOverlay({ profile: "repaint" })` when the Steam overlay
activates but needs additional presents. The repaint profile invalidates
Electron windows at about 30 FPS so Steam has fresh frames to composite. Use
`profile: "compatibility"` as the stronger fallback when you also need
Chromium's GPU work in-process.

On Steam Deck Desktop Mode, the Linux X11/GLX reusable presenter path is the
current generic proof path for overlay activation, visual open, close, and
back-to-app checks. Use `client.overlay.attachPresenter(...)` with
`client.overlay.openWebOverlay(...)` or the Electron smoke app's `presenter-web`
action for the generic proof. Deck testing has verified `active=true` and
`active=false` overlay callbacks, overlay close input, and clean return to the
running app. The older `activateToWebPageWithNativeSession(..., { modal: true })`
and `native-web` path remains compatibility coverage.
Steam's Desktop Mode social overlay can still remain visually stuck over
Electron after deactivation, so treat Friends/Game Overview dismissal as an open
social-overlay blocker, not a completed cross-platform guarantee. Call
`session.close()` during app cleanup or when you are finished with the proof
surface.

## Development

```sh
npm test
npm run native:fmt
npm run native:check
npm run api:check
```
