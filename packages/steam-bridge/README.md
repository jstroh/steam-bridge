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
`client.overlay.createElectronSteamOverlay()`, `client.overlay.openSteamOverlay()`,
`client.overlay.openWebOverlay()`, and `client.overlay.openFriendsOverlay()`, and
compatibility session helpers such as
`client.overlay.activateDialogWithNativeSession()`,
`client.overlay.activateToStoreWithNativeSession()`, and
`client.overlay.activateToWebPageWithNativeSession()`. Electron helpers include
`electronConfigureSteamOverlay()`, `electronOverlayPresenterOptions()`, and
`electronNativeOverlaySessionOptions()`; `electronScrubSteamOverlayChildProcessEnv()`
is also available for explicit diagnostics. `electronConfigureSteamOverlay()`
scrubs Steam's overlay renderer from Electron child-process preload environment
variables and adds Electron's Linux `no-zygote` switch by default, leaving the
bridge-owned native presenter as the single Steam overlay target. Core Steam API
success should not be treated as proof that the Steam overlay has hooked the
right surface.

For Electron apps, create one managed overlay for the game window and reuse it
for overlay work:

```ts
const steamOverlay = client.overlay.createElectronSteamOverlay(mainWindow, {
  // Enabled by default. Shift+Tab opens the verified Friends/chat presenter route.
  overlayShortcut: true,
  // Optional diagnostics only:
  // presenterMode: "session"
});

await steamOverlay.openAndWait({
  type: "web",
  url: checkoutUrl,
  modal: true
});

const txn = await steamOverlay.withCheckoutPrepared(() =>
  backend.createSteamTransaction({ itemId: 100 })
);

// If InitTxn returns a web checkout URL, or you need to reopen a known
// transaction approval surface, use the checkout target.
await steamOverlay.openAndWait({
  type: "checkout",
  steamUrl: txn.steamurl
});

// Achievement progress/store notifications are automatically primed while the
// managed overlay is open. Use prepareForNotification() only for custom cases.

await steamOverlay.openAndWait({ type: "friends" });

await steamOverlay.openAndWait({ type: "profile" });

await steamOverlay.openAndWait({
  type: "dialog",
  dialog: "Achievements",
  appId: 480
});

await steamOverlay.openAndWait({
  type: "community",
  appId: 480
});

await steamOverlay.openAndWait({
  type: "stats",
  appId: 480
});

await steamOverlay.openAndWait({
  type: "achievements",
  appId: 480
});
```

The manager owns a reusable native presenter, keeps it passive and click-through
while idle, polls Steam overlay state cheaply, and only pumps frames when Steam
reports `overlayNeedsPresent` or an overlay is being opened/active. It also
installs a default Electron `Shift+Tab` shortcut bridge that opens the verified
Friends/chat presenter route without asking Steam to hook Chromium child
processes; pass `overlayShortcut: false` to disable it, or provide
`overlayShortcut: { target: { type: "community", appId } }` to choose another
presenter-backed target. The bridge consumes Shift+Tab only when it is opening a
managed presenter-backed target; once Steam reports an active overlay, it lets
Shift+Tab pass through so Steam can handle the close/toggle side. Deck Desktop
proof now verifies a second Shift+Tab closes the managed overlay and returns
focus to the app. It is the
recommended builder-facing entry point: web, store, Friends, Profile,
Community, Stats, Achievements, and checkout targets route through the
presenter-backed paths
used by the Steam Deck Desktop Mode proofs; `openSteamOverlay(...)` and the
lower-level named helpers remain available for apps that prefer explicit
lifecycle control. The public smoke app can verify checkout readiness, but real
purchase-content proof still requires a real Steam app and configured product.
Use `openAndWait(...)` for modal web, store, checkout, and dialog-equivalent
overlays when app code should wait until Steam closes and the presenter parks.
Use `waitForOverlayShown()`, `waitForOverlayClosed()`, and
`parkWhenSteamOverlayCloses()` only when app code needs lower-level lifecycle
await points; these wait on Steam Bridge's callback/snapshot state and keep the
native presenter parking behavior inside the bridge. The Electron smoke app
records those await points as `overlay:presenter-wait-shown`,
`overlay:presenter-wait-closed`, and `overlay:presenter-parked` lifecycle
events so Deck/Linux artifact review proves the same public API app builders
call.
For `InitTxn` flows, wrap the app's backend transaction call with
`steamOverlay.withCheckoutPrepared(() => startTxn())`. Steam Bridge primes the
native presenter before the backend starts the transaction, then returns the
backend result unchanged. If Steam returns a web checkout URL, pass it as
`steamOverlay.open({ type: "checkout", steamUrl })`. If you have a transaction
id, call `steamOverlay.open({ type: "checkout", transactionId })` and Steam
Bridge builds the approval URL for you. `steamOverlay.prepareForCheckout()`
remains available for lower-level flows that need to separate presenter priming
from the backend call. Passive Steam notifications such as achievement progress
toasts are automatically
primed by the managed Electron overlay before the relevant achievement/stats
calls; use `steamOverlay.prepareForNotification()` only for lower-level or
custom Steam API calls. On
Linux/X11, fully idle mode makes the host transparent and click-through;
`overlayNeedsPresent` can make it visible while leaving input click-through for
passive notifications; opening or active overlay mode restores both opacity and
input so Steam web or checkout UI can receive clicks, then parks the host
transparent after Steam reports the overlay inactive. The default `idleFps` is
`0`; opt into nonzero idle pumping only for diagnostics. Use
`steamOverlay.snapshot()` for diagnostics; it returns the native presenter state
plus an `electronOverlay` block with the active presenter mode,
notification-priming policy, shortcut policy, and whether the manager owns
Electron window-close cleanup. The smoke verifiers
can require those managed diagnostics with `--require-electron-overlay`,
`--require-presenter-mode <persistent|session>`, and
`--require-overlay-shortcut-target <target>`. For resolver-backed shortcut
targets, the verifier checks the smoke app's configured target while preserving
`electronOverlay.overlayShortcut.targetType: "function"`. The Deck runner adds
the presenter-mode requirement automatically for presenter-backed product
actions and adds the shortcut-target requirement for `presenter-shortcut`. Use
`presenterMode: "session"` or
`STEAM_BRIDGE_DISABLE_ELECTRON_OVERLAY_PRESENTER=1` only as an emergency
compatibility switch: it disables the reusable presenter, uses the older
one-shot native-session lifecycle for the same `steamOverlay.open(...)` calls,
and may pump more aggressively while a session is open. The Linux and Steam Deck
smoke helpers expose this as `--presenter-mode session` for repeatable
diagnostic comparisons. Use
`steamOverlay.open({ type: "friends" })` for a generic Friends List surface; it
opens Steam Community chat through the same native web presenter path, keeping
Electron child-process isolation intact. Use
`steamOverlay.open({ type: "profile", steamId64 })` for a Steam profile page;
omit `steamId64` to open the current user's profile. This covers the common
profile case for raw `ActivateGameOverlayToUser` through the same
presenter-backed Steam web surface. Use
`steamOverlay.open({ type: "community", appId })` for the app's Steam Community hub,
`steamOverlay.open({ type: "stats", appId })` for the current user's app stats
page, and `steamOverlay.open({ type: "achievements", appId })` for the current
user's app achievements page through that same presenter-backed Steam web
overlay route. Steam Community may redirect apps without public web stats to the
user's profile, so use your real app for achievements content proof.
The high-level dialog target also routes known dialog names through these
verified equivalents: `Friends` opens chat, `Community` and
`OfficialGameGroup` open the app Community hub, `Stats` opens the current user's
app stats page, and `Achievements` opens the current user's achievements page.
Pass `route: "native"` only when you intentionally need raw
`ActivateGameOverlay` dialog behavior for diagnostics. The lower-level
`activateDialog("Friends")` / Game Overview path is still an investigation path,
and `steam://open/overlay` should not be used as a generic toggle substitute:
allowing Steam to hook Electron's Chromium children can make Steam's desktop
social UI render, but that duplicate hook can leave stale overlay surfaces after
close; the default child-process isolation keeps product overlays reliable and
prevents that raw dialog path from rendering through Chromium. For Electron
keyboard toggle behavior, use the managed `overlayShortcut` bridge rather than
raw Steam hotkey interception.

For Linux Electron apps, use
`electronConfigureSteamOverlay({ profile: "repaint" })` when the Steam overlay
activates but needs additional presents. The repaint profile invalidates
Electron windows at about 30 FPS so Steam has fresh frames to composite. Use
`profile: "compatibility"` as the stronger fallback when you also need
Chromium's GPU work in-process.

On Steam Deck Desktop Mode, the Linux X11/GLX reusable presenter path is the
current generic proof path for product overlay activation, visual open, close,
and back-to-app checks. Use `client.overlay.createElectronSteamOverlay(...)`
with `steamOverlay.open(...)`, or the lower-level `client.overlay.attachPresenter(...)`,
`client.overlay.openSteamOverlay(...)`, `client.overlay.openWebOverlay(...)`,
`client.overlay.openFriendsOverlay(...)`, `client.overlay.openProfileOverlay(...)`,
`client.overlay.openCommunityOverlay(...)`,
`client.overlay.openStatsOverlay(...)`, and
`client.overlay.openDialogEquivalentOverlay(...)` helpers, or the Electron smoke app's
`presenter-web` / `presenter-friends` / `presenter-profile` /
`presenter-community` / `presenter-stats` / `presenter-dialog-auto` / `presenter-shortcut` actions for
the generic proof. Deck testing has verified a
single Steam overlay target,
`active=true` overlay callbacks, overlay close input, and clean return to the
running app for the Friends List web surface; the web checkout/store proof also
captures `active=false` after closing the modal overlay. The Steam Deck runner
now machine-checks the single-target invariant for presenter-backed product
actions, and it also checks idle/passive presenter state for non-modal presenter
paths. Close/toggle probes also require delayed post-close presenter snapshots
showing the reusable host transparent, click-through, overlay-inactive, and back
at `currentFps: 0`; the verifier fails if `pumpCount` increases between the
first and stable post-close samples. Presenter-backed product runs also require
the smoke app's managed wait-helper lifecycle events for shown, closed, and
parked states, plus clean crash diagnostics: no crash dump files and no fatal
Electron lifecycle events. The smoke app's
`presenter-achievement-progress` action verifies passive Steam notification
behavior by keeping the presenter click-through and transparent while Steam
displays an achievement-progress toast. The older
`activateToWebPageWithNativeSession(..., { modal: true })` and `native-web` path
remains compatibility coverage. Treat raw Friends/Game Overview dialog dismissal
and raw Steam overlay hotkey interception as open social-overlay diagnostics,
not completed cross-platform guarantees. The managed Electron `Shift+Tab`
shortcut bridge is the product path for Electron keyboard toggle behavior. The
managed overlay also exposes `presenterMode: "session"` and
`STEAM_BRIDGE_ELECTRON_OVERLAY_PRESENTER=session` for diagnostic comparison
against the reusable presenter; keep the default persistent mode for Deck
Desktop product proof. The packaged helper and Deck runner can pass the fallback
explicitly with `--presenter-mode session`. The Deck runner can collect focused
toggle evidence with
`--visual-toggle-probe --visual-toggle-input keyboard|guide|both`; for the
managed `presenter-shortcut` keyboard path, that probe verifies
`overlay:shortcut-open`, active/inactive callbacks, app focus, and crash
diagnostics. Shortcut matrix cases use `--visual-close-input toggle` to prove a
Shift+Tab-only close. Use `--shortcut-target <name>` to test non-default shortcut
targets such as `profile`, `web`, `store`, `community`, `stats`, `achievements`, `dialog`,
or `checkout`; Deck Desktop fullscreen proof includes
`--shortcut-target web --web-modal true`, with the Deck runner waiting for the
smoke lifecycle log to report shortcut-open and active overlay events before
capturing the opened surface. The Deck runner can also
close presenter-backed Steam web surfaces through the visible Steam web close
control with `--visual-close-probe --visual-close-input web`. For those
presenter-backed product surfaces, the close probe also verifies the
post-close `active=false` callback, app focus, and crash diagnostics. Current
focused Desktop evidence for raw Steam interception still does not show
Shift+Tab or a virtual Guide/Steam-button controller event opening overlay UI.
Session-mode smoke comparisons skip the persistent-host single-target,
idle-parking, and no-post-close-pumping assertions because the fallback opens
lazily and may pump while a session exists.

Use the repository-level matrix runner when you need to repeat the full Deck
Desktop product proof instead of hand-running each case:

```sh
npm run steam-deck:overlay-matrix -- \
  --host deck@<deck-host-or-ip> \
  --suite core
```

The matrix collects per-case screenshots and diagnostics for the managed
presenter routes: modal web, store, Friends, profile, community, stats, achievements,
dialog equivalents, checkout readiness, synthetic checkout approval-route
plumbing, Shift+Tab shortcut routing, and passive toasts. After a live run it
summarizes every result and lifecycle log, failing if a case reports crash
dumps, fatal Electron lifecycle events, duplicate overlay targets, or missing
presenter diagnostics, and it verifies post-close presenter parking plus the
managed wait-helper shown/closed/parked lifecycle events for active overlay
cases. It still uses public App ID `480`, so real purchase content must be
validated from a real configured Steam app. Live runs also write
`matrix-cases.jsonl` so summaries can print and audit the close/toggle input
used for each case. To audit an existing artifact root, run
`npm run steam-deck:overlay-matrix:summarize -- --artifact-root <path>`.

Add
`--overlay-game-id shortcut` when investigating whether raw Steam overlay
close/back routing depends on the full non-Steam shortcut game ID. Call
`session.close()` during app cleanup or when you are finished with the proof
surface.

## Development

```sh
npm test
npm run native:fmt
npm run native:check
npm run api:check
```
