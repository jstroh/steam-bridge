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
achievements, or dialog-equivalent surfaces instead, and can use
`overlayShortcut.onOpen` for app logging or state updates after the managed
shortcut opens. Static shortcut targets are the normal path; resolver functions
are only needed when the target has to be computed at keypress time. Once Steam
reports an active overlay, the shortcut bridge no longer consumes Shift+Tab;
Deck Desktop proof now verifies that a second Shift+Tab closes the managed
overlay and returns focus to the app.

To rerun the Steam Deck Desktop Mode product overlay proof matrix from this
repo, keep the Deck awake in Desktop Mode with Steam running and use:

```sh
npm run steam-deck:overlay-matrix -- \
  --host deck@<deck-host-or-ip> \
  --suite core
```

The matrix packages the Linux x64 smoke app, runs preflight, then exercises the
managed presenter routes for modal web, store, Friends, profile, community,
stats, achievements, dialog equivalents, builder-facing `openAndWait`
web/store/Friends/dialog-equivalent paths, checkout readiness, synthetic checkout approval-route plumbing,
Shift+Tab shortcut routing, and passive
achievement progress/unlock toasts. It also summarizes every collected result and
lifecycle log so hidden crash dumps, fatal Electron lifecycle events, duplicate
overlay targets, missing presenter diagnostics, and post-close presenter parking
regressions fail the run. Screenshots and diagnostics are collected under
`/tmp/steam-bridge-deck-overlay-matrix-*`; live runs also write
`matrix-cases.jsonl` so summaries can print and audit the close/toggle input
used for each case. Active presenter-backed cases also record the managed
builder-facing lifecycle waits as `overlay:presenter-wait-shown`,
`overlay:presenter-wait-closed`, and `overlay:presenter-parked` lifecycle
events, so Deck artifacts prove the public wait helpers as well as the raw
Steam callbacks.

For CI/local maintenance without a Deck, `npm run steam-deck:overlay-matrix:check`
validates the generated minimal, core, and full matrix command sets plus the
artifact summarizer. To audit an existing artifact root, run
`npm run steam-deck:overlay-matrix:summarize -- --artifact-root <path>`.

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

await steamOverlay.openAndWait({
  type: "web",
  url: "https://store.steampowered.com/app/480/",
  modal: true
});

await steamOverlay.openAndWait({
  type: "store",
  appId: 480
});

await steamOverlay.openCheckoutAndWait(() =>
  backend.createSteamTransaction({ itemId: 100 })
);

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
  type: "achievements",
  appId: 480
});

// Optional; the manager closes itself when the Electron window closes.
steamOverlay.close();
```

The manager owns a reusable native presenter, keeps it passive and click-through
while idle, polls Steam overlay state cheaply, and only pumps frames when Steam
reports `overlayNeedsPresent` or an overlay is being opened/active. While the
managed overlay is open, Steam Bridge automatically primes that passive
presenter before achievement progress, achievement unlock, and stats-store calls
that can produce Steam notification toasts. Passive priming performs one
presenter wake-up/poll and then waits for Steam's `overlayNeedsPresent` signal
before entering the notification frame loop, so quiet notification calls do not
start a fixed high-FPS boost window. This is the path intended for checkout
overlays and passive Steam notifications without forcing the Electron game
window into a constant repaint loop. By default
`idleFps` is `0`; set it explicitly only for diagnostic comparisons. Use
the managed Electron helper to keep the presenter aligned with BrowserWindow
move, resize, fullscreen, maximize, restore, and show events; each event triggers
one native presenter pump rather than a steady render loop. Use
`attachPresenter(...)` and pass `presenter` to `openSteamOverlay(...)` directly
only when you need lower-level lifecycle control.
Use `openAndWait(...)` for modal web, store, checkout, and dialog-equivalent
overlays when app code should wait until Steam closes and the presenter parks.
`openAndWait(...)` keeps the presenter active until Steam reports the overlay
shown, then parks from overlay callbacks and presenter state changes instead of
depending on a fixed activation window.
Managed Electron presenters default their activation boost and close grace
durations to zero; the helper methods hold the presenter with scoped activation
handles and Steam callback/state waits instead. Pass explicit durations only
for lower-level split-step diagnostics.
Use `waitForOverlayShown()`, `waitForOverlayClosed()`, and
`parkWhenSteamOverlayCloses()` only when you need lower-level lifecycle await
points. In persistent presenter mode those waits resolve from Steam overlay
callbacks and native presenter state changes; callers provide deadlines or abort
signals, not polling intervals. The Electron smoke app records those await
points in its lifecycle log as `overlay:presenter-wait-shown`,
`overlay:presenter-wait-closed`, and `overlay:presenter-parked` for Deck/Linux
artifact review. Call
`steamOverlay.snapshot()` when you need diagnostics; it returns the
native presenter state, including the selected `backend`
(`x11-glx`, `macos-metal`, `macos-opengl`, or `none`) and, when available from
the Electron window, current `bounds`, plus an `electronOverlay` block with the
presenter mode, notification-priming policy, shortcut policy, and
window-close ownership.
The smoke verifiers can require those managed diagnostics with
`--require-electron-overlay`, `--require-presenter-mode <persistent|session>`,
and `--require-overlay-shortcut-target <target>`. For static shortcut targets,
`electronOverlay.overlayShortcut.target` records sanitized target metadata such
as type, route, modal flag, and whether URL/transaction fields were configured;
it does not serialize checkout URLs, transaction IDs, return URLs, or Steam IDs.
For dynamic resolver-backed shortcut targets, the verifier checks the smoke app's
configured target while preserving
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
Presenter close and managed shortcut close probes also require state-driven
post-close presenter snapshots showing the reusable host parked back at passive
idle: transparent, click-through, non-focusable, overlay-inactive, and
`currentFps: 0`. The Deck verifier compares the first and stable post-close
samples and fails if `pumpCount` increases after the host should be idle.
For active managed presenter routes it also requires the smoke app's public
wait-helper events for shown, closed, and parked lifecycle states.
Presenter-backed product actions also require the smoke app's crash diagnostics
to stay clean: no crash dump files and no fatal Electron lifecycle events.

On Linux/X11, the presenter separates visibility from input. Fully idle mode is
transparent, non-focusable, click-through, and cheap to keep alive. When Steam
reports `overlayNeedsPresent`, the host can become visible while remaining
click-through so passive notifications can render. Opening or active overlay
mode restores both host opacity and input so Steam web or checkout UI can
receive clicks; after Steam reports overlay inactive, the host parks back to
transparent idle mode even if `overlayNeedsPresent` lingers briefly.

The Electron smoke app includes `presenter-achievement-progress` and
`presenter-achievement-unlock` actions for passive notification proof. On Steam
Deck Desktop Mode, the progress action uses App ID `480`, keeps the presenter
passive, tries the available public achievements until Steam accepts
`achievement.indicateProgress(...)`, receives an achievement-stored callback,
and captures a visible Steam achievement-progress toast over the app without
requiring a modal overlay activation callback. The matrix summary fails if the
recorded progress event is not `indicated=true`. The unlock action uses the same
passive presenter path, clears and re-unlocks the selected public test
achievement, stores stats, and records `achievement:unlock` so unlock-toast
behavior can be checked without app-facing overlay code. A 2026-06-28 Deck
Desktop fullscreen run captured the `Interstellar` unlock toast over the smoke
app with one overlay target, app focus preserved, passive presenter state, and
no crash evidence.

Steam Bridge routes overlay targets by how Steam renders them. Prefer
`client.overlay.createElectronSteamOverlay(mainWindow).open(...)` for Electron
app code: web, store, Friends, Profile, Players, Community, Stats, Achievements, and checkout
targets use the presenter-backed paths proven on Steam Deck Desktop Mode, while
`route: "native"`, `openNativeStoreOverlay(...)`, and the lower-level named
helpers remain available for explicit native diagnostics. Store targets default
to the Steam store web overlay surface because that is the reusable Deck
Desktop path that opens, accepts input, closes, and returns to Electron cleanly.
The public smoke app can verify checkout readiness, but
real purchase-content proof still requires a real Steam app and configured
product. For in-game microtransactions, call
`steamOverlay.openCheckoutAndWait(() => startTxn())`. Steam Bridge primes the
native presenter before the backend starts `InitTxn`, accepts common backend
result shapes such as `steamurl`, `steamUrl`, `transactionId`, or `transid`,
opens the checkout surface, then resolves after Steam closes and the presenter
parks. That preparation is operation-scoped rather than timer-tuned app code;
timeouts are failure guardrails. `steamOverlay.withCheckoutPrepared(...)`,
`steamOverlay.open({ type: "checkout", ... })`, and
`steamOverlay.prepareForCheckout()` remain available for lower-level flows that
need to separate presenter priming from transaction creation or overlay opening;
pass an explicit preparation duration there only when you intentionally need a
standalone split-step hold.
Treat `MicroTxnAuthorizationResponse` as a purchase authorization event, not as
an overlay-close event; keep the presenter alive until Steam emits overlay
inactive and the app has returned. The smoke app
records presenter diagnostics on `callback:microtxn` so real-app purchase runs
can prove the presenter was still available during authorization. Passive Steam
notifications such as achievement progress and achievement unlock toasts are
automatically primed by the managed Electron overlay before the relevant
achievement/stats calls and pump only when Steam reports
`overlayNeedsPresent`; use `steamOverlay.prepareForNotification()` only for
lower-level or custom Steam API
calls. With the
default child-process isolation, Deck Desktop Mode has verified this path with a
single `gameoverlayui` process, paired active/inactive callbacks, and visual
return to the Electron app. Passive achievement progress and unlock toasts also
render with the presenter transparent and click-through. For a generic Friends List surface,
call `steamOverlay.open({ type: "friends" })`; on Steam Deck Desktop Mode this
opens Steam Community chat through the same native web presenter with one
`gameoverlayui` target and a clean close/back-to-app result. For a Steam
profile page, call `steamOverlay.open({ type: "profile", steamId64 })`; omit
`steamId64` to open the current user's profile. This replaces the common
profile case for raw `ActivateGameOverlayToUser` with the same presenter-backed
Steam web surface. For the high-level user-dialog router,
`steamOverlay.open({ type: "user", dialog: client.overlay.UserDialog.Chat })`
opens the same verified Steam Community chat/Friends surface; `steamid` /
`profile`, `stats`, and `achievements` also route through presenter-backed web
surfaces by default. Native-only prompt actions such as trade joins and friend
request actions remain explicit raw diagnostics through `route: "native"`. For
recently played-with players, call
`steamOverlay.open({ type: "players", steamId64 })`; omit `steamId64` to open
the current user's Steam Community players page through the same
presenter-backed web surface. For app
achievements, call `steamOverlay.open({ type: "achievements", appId })`; it
opens the current user's app achievements page through the same presenter-backed
Steam web overlay route instead of relying on the raw Desktop achievements
dialog. Steam Community may redirect apps without public web stats to the user's
profile, so use your real app for achievements content proof.
The high-level dialog target also uses presenter-backed equivalents for known
dialog names: `Friends` opens chat, `Players` opens the current user's Steam
Community players page, `Community` and `OfficialGameGroup` open the app
Community hub, `Stats` opens the current user's app stats page, and
`Achievements` opens the current user's achievements page. On Steam Deck Desktop
Mode, the public App ID `480` smoke matrix has verified `Friends`, `Community`,
`OfficialGameGroup`, `Stats`, and `Achievements` through
`presenter-dialog-auto` with visible Steam web content, active/inactive
callbacks, one overlay target, clean return to Electron, parked idle presenter
state, and no crash evidence. A 2026-06-28 Deck Desktop run verified `Players`
through both `presenter-players` and `presenter-dialog-auto --dialog Players`
with the same active/inactive callbacks, single overlay target, web close,
focus return, idle parking, and no crash evidence. In `route: "auto"` mode,
unsupported dialog names throw instead of silently falling back to raw Steam
overlay behavior. Pass `route: "native"` only when you intentionally need raw
`ActivateGameOverlay` dialog behavior for diagnostics.
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
`client.overlay.openFriendsOverlay(...)`, `client.overlay.openProfileOverlay(...)`,
`client.overlay.openPlayersOverlay(...)`, `client.overlay.openCommunityOverlay(...)`,
`client.overlay.openStatsOverlay(...)`, `client.overlay.openStoreOverlay(...)`,
and `client.overlay.openDialogEquivalentOverlay(...)` helpers, or the Electron smoke app's
`presenter-web` / `presenter-web-open-and-wait` / `presenter-store` /
`presenter-store-open-and-wait` / `presenter-friends` /
`presenter-friends-open-and-wait` / `presenter-profile` /
`presenter-players` / `presenter-community` / `presenter-stats` /
`presenter-dialog-auto` / `presenter-dialog-auto-open-and-wait` /
`presenter-shortcut` actions for
that proof. The `presenter-web-open-and-wait`,
`presenter-store-open-and-wait`, `presenter-friends-open-and-wait`, and
`presenter-dialog-auto-open-and-wait` smoke actions exercise the builder-facing
`steamOverlay.openAndWait(...)` helper and record completion only after Steam
closes and the presenter parks.
The older
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
close/back-to-app proof and for raw social-overlay investigation; by default it
sends a Deck-side Shift+Tab/Escape probe and records before and after
screenshots. For presenter-backed product web surfaces, the close probe also
verifies `active=false`, confirms focus returned to the smoke app, and checks
for post-close crash evidence.
For presenter-backed Steam web surfaces such as `presenter-community` and
`presenter-stats`, add `--visual-close-input web` to close through the visible
Steam web overlay close control.
Use `--visual-toggle-probe` for shortcut evidence. With `presenter-shortcut`,
the default `--visual-toggle-input keyboard` sends Shift+Tab into Steam Bridge's
managed Electron shortcut bridge and verifies `overlay:shortcut-open`,
`active=true`, `active=false`, focus return, and no post-close crash evidence.
Shortcut matrix cases use `--visual-close-input toggle`, which sends only the
second Shift+Tab for close.
Pass `--shortcut-target <name>` to prove non-default shortcut targets; Deck
Desktop fullscreen testing has verified `--shortcut-target web --web-modal true`
by waiting for the smoke lifecycle log to report `overlay:shortcut-open` and
`active=true` before capturing the opened Steam web surface.
With passive presenter or raw dialog actions, the same probe tests raw Steam
hotkey interception. `--visual-toggle-input guide` sends a controller
Guide/Steam-button event through a temporary virtual gamepad.
Add `--overlay-game-id shortcut` when investigating
whether raw Steam overlay close/back routing depends on the full non-Steam
shortcut game ID. Focused Deck Desktop runs still show the raw toggle path as
unresolved; the product overlay paths remain the managed shortcut bridge,
`openSteamOverlay(...)`, the lower-level web/store/Friends/Players/Community/Stats
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
