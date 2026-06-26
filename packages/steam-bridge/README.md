# steam-bridge

Native-backed Steamworks bridge for Electron and Node.

This package exposes a TypeScript API and a compatibility-style grouped client
for projects that want to call Steamworks from JavaScript while keeping native
Steam API lifecycle and callback dispatch in Rust.

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
client.callback.register(
  client.callback.SteamCallback.MicroTxnAuthorizationResponse,
  (event) => console.log(event)
);

console.log({ steamId, ticketBytes: ticket.getBytes().length });
```

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

The package also includes macOS overlay diagnostics through
`client.utils.getOverlayDiagnostics()` and the Electron helper export
`electronConfigureSteamOverlay()`. These are intentionally diagnostics first:
core Steam API success should not be treated as proof that the Steam overlay has
hooked Electron.

## Development

```sh
npm test
npm run native:fmt
npm run native:check
```
