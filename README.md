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

For the current host platform, a local native build is enough for a local smoke
package. The example packager stages `steam_bridge_native.local.node` under the
target prebuild name when a release prebuild is not present:

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
managed overlay owns the native presenter, routes common Steam surfaces, waits
for Steam overlay callbacks, and parks itself when Steam reports that the
overlay has closed.

```ts
const steamOverlay = client.overlay.createElectronSteamOverlay(mainWindow, {
  title: "Steam Overlay"
});

await steamOverlay.openAndWait({ type: "store", appId: 480 });
await steamOverlay.openAndWait({ type: "friends" });
await steamOverlay.openAndWait({
  type: "web",
  url: "https://store.steampowered.com/app/480/",
  modal: true
});

await steamOverlay.openCheckoutAndWait(() =>
  backend.createSteamTransaction({ itemId: 100 })
);

steamOverlay.close();
```

Supported high-level targets include web pages, store pages, checkout,
Friends/chat, profiles, players, community hubs, stats, achievements, and known
dialog equivalents.
`openAndWait(...)` validates those managed targets before preparing the native
host and rejects raw native prompt routes; use `open({ ..., route: "native" })`
only for explicit diagnostics.

While inactive, the presenter stays transparent, click-through, non-focusable,
and idle at `0` FPS. Passive Steam notifications use the same presenter without
forcing a permanent Electron repaint loop. The default Shift+Tab bridge opens
the Friends/chat route; set `overlayShortcut.target` to choose another verified
target. The macOS matrix verifies Friends/chat, modal web, and store shortcut
targets with target-aware lifecycle and presenter snapshot checks.

On macOS, the managed helper fails fast before Steam overlay activation if the
screen is locked or the display is asleep. Use
`steamworks.isSteamOverlayNativeHostUnavailableError(error)` and check
`error.reason` instead of waiting for an overlay timeout in that state. If the
host is already unavailable, the managed Shift+Tab bridge treats the same state
as a quiet no-op unless you provide an `overlayShortcut.onError` handler.

`MicroTxnAuthorizationResponse` is a purchase authorization event, not an
overlay-close signal. Keep the managed presenter alive until Steam reports the
overlay inactive. Real purchase UI and `InitTxn` proof require your own Steam
app ID with configured products; App ID `480` is only for generic smoke tests.

## Diagnostics

Steam API initialization and overlay readiness are different states. A
`steam_appid.txt` file can be enough for Steam ID, auth tickets, and callbacks
while the overlay still cannot hook the process.

Use `client.utils.getOverlayDiagnostics()` to log `steamRunning`, `appId`,
`overlayEnabled`, `overlayNeedsPresent`, `steamDeck`, `bigPicture`, and
`steamInstallPath`.

## Verification

The Electron smoke app lives in
[`examples/electron-basic`](examples/electron-basic). Its platform helpers emit
`STEAM_BRIDGE_SMOKE_RESULT` JSON, lifecycle logs, screenshots where available,
and crash diagnostics.

Run platform matrix checks:

```sh
npm run steam-deck:overlay-matrix -- \
  --host deck@<deck-host-or-ip> \
  --suite core

npm run macos:overlay-matrix -- --suite core
```

Validate matrix commands without platform hardware:

```sh
npm run steam-deck:overlay-matrix:check
npm run macos:overlay-matrix:check
```

Run the same core checks as CI:

```sh
npm run check:platform
npm test
npm run native:fmt
npm run native:check
npm run api:check
```

Current overlay evidence is tracked in
[`docs/research/cross-platform-overlay-status.md`](docs/research/cross-platform-overlay-status.md).
Native presenter design notes are tracked in
[`docs/research/native-overlay-presenter-plan.md`](docs/research/native-overlay-presenter-plan.md).

## Shipping Notes

- Use App ID `480` only for local Steamworks smoke tests.
- Use your own App ID before shipping or testing app-specific achievements,
  stats, inventory, UGC, economy, checkout, or transaction flows.
- For shipped macOS builds, sign the app bundle Steam launches with
  `examples/electron-basic/entitlements.steam.macos.plist`-style entitlements:
  allow dyld environment variables, disable library validation, and keep App
  Sandbox disabled so Steam can inject the overlay into the launched process.
- Steam Bridge does not vendor the Steamworks SDK or Valve redistributables.
