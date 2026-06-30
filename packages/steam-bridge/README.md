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

The packaged Windows smoke helper accepts the same generic smoke actions as the
Deck/macOS helpers for web, store, Friends, dialog-equivalent, checkout,
shortcut, and passive notification regression checks.

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
`client.overlay.openWebOverlay()`, `client.overlay.openFriendsOverlay()`, and
`client.overlay.openUserOverlay()`, and
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
  overlayShortcut: {
    // Enabled by default. Shift+Tab opens the verified Friends/chat presenter route.
    target: { type: "friends" },
    onOpen(target) {
      console.info("Steam overlay shortcut opened", target.type);
    }
  },
  // Optional diagnostics only:
  // presenterMode: "session"
});

await steamOverlay.openAndWait({
  type: "web",
  url: checkoutUrl,
  modal: true
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

await steamOverlay.openAndWait({
  type: "user",
  dialog: client.overlay.UserDialog.SteamId
});
```

The manager owns a reusable native presenter, keeps it passive and click-through
while idle, polls Steam overlay state cheaply, and only pumps frames when Steam
reports `overlayNeedsPresent` or an overlay is being opened/active. Automatic
passive notification priming performs one wake-up/poll and then waits for
Steam's `overlayNeedsPresent` signal before entering the notification frame
loop, so quiet achievement/stat calls do not start a fixed high-FPS boost. It also
installs a default Electron `Shift+Tab` shortcut bridge that opens the verified
Friends/chat presenter route without asking Steam to hook Chromium child
processes; pass `overlayShortcut: false` to disable it, or provide
`overlayShortcut: { target: { type: "community", appId } }` to choose another
presenter-backed target. Use `overlayShortcut.onOpen` for app logging or state
updates after the managed shortcut opens; static targets should not need a
resolver function just for side effects. The bridge consumes Shift+Tab only when
it is opening a managed presenter-backed target; once Steam reports an active
overlay, it lets Shift+Tab pass through so Steam can handle the close/toggle
side. On macOS, Steam can consume Shift+Tab before Electron's normal
`before-input-event` hook sees it, so Steam Bridge registers a focused-window
global shortcut fallback only while the game window is focused, then unregisters
it while Steam's overlay is active so the second Shift+Tab still closes
normally. Deck Desktop and macOS proof now verify a second Shift+Tab closes the
managed overlay and returns focus to the app. It is the
recommended builder-facing entry point: web, store, Friends, Profile,
Community, Stats, Achievements, user-profile, and checkout targets route through the
presenter-backed paths
used by the Steam Deck Desktop Mode proofs; `openSteamOverlay(...)` and the
lower-level named helpers remain available for apps that prefer explicit
lifecycle control. The public smoke app can verify checkout readiness, but real
purchase-content proof still requires a real Steam app and configured product.
`open(...)` keeps the presenter active with an operation-scoped hold until Steam
reports the overlay shown; its internal timeout is only a failure guard for the
case where Steam never activates the overlay. Use `openAndWait(...)` for modal
web, store, checkout, and dialog-equivalent overlays when app code should also
wait until Steam closes and the presenter parks. `openAndWait(...)` uses the
same show hold, then parks from overlay callbacks and presenter state changes
instead of depending on a fixed activation window.
It also validates managed targets before preparing the native host and rejects
raw native prompt routes such as `route: "native"` dialog/user targets because
those routes are diagnostic-only and do not have reliable activation/close
semantics.
Managed Electron presenters default activation-boost and close-grace durations
to zero; the public helpers use scoped activation handles and Steam
callback/state waits. Use explicit duration-based preparation only for
lower-level diagnostics or custom split-step flows.
Use `waitForOverlayShown()`, `waitForOverlayClosed()`, and
`parkWhenSteamOverlayCloses()` only when app code needs lower-level lifecycle
await points; in the default persistent presenter mode these resolve from Steam
Bridge's overlay callback and presenter state changes. App code supplies
deadlines or abort signals, not polling intervals; timeout handling is a
guardrail rather than app-facing timing glue. If a wait times out, is aborted,
or the overlay manager closes while the wait is pending, Steam Bridge throws
`SteamOverlayWaitTimeoutError`, `SteamOverlayWaitAbortedError`, or
`SteamOverlayWaitClosedError` with a stable `code`, `state`, and the last
managed presenter `snapshot`; timeout errors also include `timeoutMs`. Use the
matching `isSteamOverlayWaitTimeoutError(error)`,
`isSteamOverlayWaitAbortedError(error)`, or
`isSteamOverlayWaitClosedError(error)` guard to branch without parsing messages.
The Electron smoke app records those await points as `overlay:presenter-wait-shown`,
`overlay:presenter-wait-closed`, and `overlay:presenter-parked` lifecycle
events so Deck/Linux artifact review proves the same public API app builders
call.
For `InitTxn` flows, call
`steamOverlay.openCheckoutAndWait(() => startTxn())`. Steam Bridge primes the
native presenter before the backend starts the transaction, accepts common
backend result shapes such as `steamurl`, `steamUrl`, `transactionId`, or
`transid`, and also unwraps documented `InitTxn` envelopes such as
`response.params.transid` and Steam Bridge Web API responses at
`data.response.params`. It opens the checkout surface, then resolves after
Steam closes and the presenter parks. The preparation is operation-scoped
rather than an app-tuned timer. `steamOverlay.withCheckoutPrepared(...)`,
`steamOverlay.open({ type: "checkout", ... })`, and
`steamOverlay.prepareForCheckout()` remain available for lower-level flows that
need to separate presenter priming from transaction creation or overlay opening;
pass an explicit preparation duration there only when a standalone split-step
hold is intentional.
The Electron smoke app redacts real checkout URLs, transaction IDs, return URLs,
Steam IDs, auth-ticket bytes, and private CLI arguments from result and lifecycle
artifacts while preserving machine-checkable presence flags and presenter
snapshots.
Passive Steam notifications such as achievement progress
or achievement unlock toasts are automatically primed by the managed Electron
overlay before the relevant achievement/stats calls and pump only when Steam
reports `overlayNeedsPresent`; use
`steamOverlay.prepareForNotification()` only for lower-level or custom Steam API
calls. On
Linux/X11, fully idle mode makes the host transparent and click-through;
`overlayNeedsPresent` can make it visible while leaving input click-through for
passive notifications; opening or active overlay mode restores both opacity and
input so Steam web or checkout UI can receive clicks, then parks the host
transparent after Steam reports the overlay inactive. The default `idleFps` is
`0`; opt into nonzero idle pumping only for diagnostics. The managed Electron
helper also keeps the presenter aligned on BrowserWindow move, resize,
fullscreen, maximize, restore, and show events with one native pump per event
instead of a steady render loop. Use
`steamOverlay.snapshot()` for diagnostics; it returns the native presenter state
including the selected `backend` (`x11-glx`, `macos-metal`, `macos-opengl`, or
`none`) and, when available from the Electron window, current `bounds`. On
macOS, snapshots also report `macOverlayEnvironment` and
`nativeHostUnavailableReason` when a locked screen or sleeping display prevents
safe native host creation. Managed overlay open/wait and checkout helpers throw
`SteamOverlayNativeHostUnavailableError` in that state, including lower-level
`prepareForCheckout()` split-step flows; use
`isSteamOverlayNativeHostUnavailableError(error)` and then check `error.reason`
instead of parsing the message when falling back to another purchase or browser
flow:

```ts
try {
  await steamOverlay.openAndWait({ type: "friends" });
} catch (error) {
  if (steamworks.isSteamOverlayNativeHostUnavailableError(error)) {
    console.warn("Steam overlay host unavailable:", error.reason);
    return;
  }
  throw error;
}
```

The app-facing managed helper defaults its restore-focus delay,
activation boost, and active grace window to `0` unless explicitly configured.
The snapshot also includes an `electronOverlay` block with the active presenter
mode, notification-priming policy, restore-focus delay, activation timing,
shortcut policy, and whether the manager owns Electron window-close cleanup.
The smoke verifiers
can require those managed diagnostics with `--require-electron-overlay`,
`--require-presenter-mode <persistent|session>`, and
`--require-overlay-shortcut-target <target>`. Use
`--require-zero-managed-overlay-timing` to prove a smoke artifact is not relying
on delayed restore-focus, activation boost, or active grace timing; use
`--require-restore-focus-delay-ms 0` only for targeted restore-focus checks.
They can also verify expected
managed overlay fail-fast artifacts with `--require-action-error-code` and
`--require-action-error-reason`; add
`--require-native-host-unavailable-reason` to require the presenter snapshot to
show the matching unavailable native host, no attachment, and zero current FPS.
Use `--require-no-overlay-activation` with those flags to prove Steam overlay
activation did not start. That is the preferred way to prove locked or asleep
macOS fallback behavior from a smoke result log. The macOS overlay matrix
manifest and summary auditor carry those same requirements for live artifact
sets. For static shortcut targets,
`electronOverlay.overlayShortcut.target` records sanitized target
metadata such as type, route, modal flag, and whether URL/transaction fields
were configured;
it does not serialize checkout URLs, transaction IDs, return URLs, or Steam IDs.
For dynamic resolver-backed shortcut targets, the verifier checks the smoke app's
configured target while preserving
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
`steamOverlay.open({ type: "user", dialog: client.overlay.UserDialog.SteamId, steamId64 })`
for the same profile route through the high-level user-dialog router. The
`user` target routes verified web-backed user dialog names through the presenter
by default: `steamid`/`profile`, `chat`, `stats`, and `achievements`. The
`chat` route opens the verified Steam Community chat/Friends surface. Native-only
prompt dialogs such as `jointrade` and friend request actions remain raw
Steamworks diagnostics; pass `route: "native"` or call
`openNativeUserOverlay(...)` only when explicitly testing
`ActivateGameOverlayToUser(...)` behavior. Use
`steamOverlay.open({ type: "players", steamId64 })` for the current user's or a
specified user's Steam Community players page through the same presenter-backed
web surface. Use
`steamOverlay.open({ type: "community", appId })` for the app's Steam Community hub,
`steamOverlay.open({ type: "stats", appId })` for the current user's app stats
page, and `steamOverlay.open({ type: "achievements", appId })` for the current
user's app achievements page through that same presenter-backed Steam web
overlay route. Steam Community may redirect apps without public web stats to the
user's profile, so use your real app for achievements content proof.
The high-level dialog target also routes known dialog names through
presenter-backed equivalents: `Friends` opens chat, `Players` opens the current
user's Steam Community players page, `Community` and `OfficialGameGroup` open
the app Community hub, `Stats` opens the current user's app stats page, and
`Achievements` opens the current user's achievements page. A 2026-06-28 Deck
Desktop run verified `Players` through both the direct `presenter-players`
action and the `presenter-dialog-auto --dialog Players` route, with visible
Steam web content, active/inactive callbacks, one overlay target, clean return
to Electron, idle presenter parking, and no crash evidence. In `route: "auto"`
mode, unsupported dialog names throw instead of silently falling back to raw
Steam overlay behavior. Pass
`route: "native"` only when you intentionally need raw `ActivateGameOverlay`
dialog behavior for diagnostics.
The lower-level `activateDialog("Friends")` / Game Overview path is still an
investigation path, and `steam://open/overlay` should not be used as a generic
toggle substitute:
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
`client.overlay.openPlayersOverlay(...)`, `client.overlay.openCommunityOverlay(...)`,
`client.overlay.openStatsOverlay(...)`, and
`client.overlay.openAchievementsOverlay(...)`, `client.overlay.openUserOverlay(...)`, and
`client.overlay.openDialogEquivalentOverlay(...)` helpers, or the Electron smoke app's
`presenter-web` / `presenter-web-open-and-wait` / `presenter-store` /
`presenter-store-open-and-wait` / `presenter-friends` /
`presenter-friends-open-and-wait` / `presenter-profile` /
`presenter-players` / `presenter-community` / `presenter-stats` /
`presenter-achievements` / `presenter-user` / `presenter-dialog-auto` /
`presenter-dialog-auto-open-and-wait` / `presenter-shortcut` actions for
the generic proof. Deck testing has verified a
single Steam overlay target,
`active=true` overlay callbacks, overlay close input, and clean return to the
running app for the Friends List web surface; the web checkout/store proof also
captures `active=false` after closing the modal overlay. The Steam Deck runner
now machine-checks the single-target invariant for presenter-backed product
actions, and it also checks idle/passive presenter state for non-modal presenter
paths. Close/toggle probes also require state-driven post-close presenter
snapshots showing the reusable host transparent, click-through,
overlay-inactive, and back at `currentFps: 0`; the verifier fails if
`pumpCount` increases between the first parked state-change sample and the
following stable sample. Presenter-backed product runs also require
the smoke app's managed wait-helper lifecycle events for shown, closed, and
parked states, plus clean crash diagnostics: no crash dump files and no fatal
Electron lifecycle events. The smoke app's `presenter-achievement-progress` and
`presenter-achievement-unlock` actions verify passive Steam notification
behavior by keeping the presenter click-through and transparent while Steam
displays achievement-progress or achievement-unlock toast surfaces. The unlock
action clears and re-unlocks the selected public test achievement so repeated
smoke runs can exercise a real unlock notification path. A 2026-06-28 Deck
Desktop fullscreen run captured the `Interstellar` unlock toast over the smoke
app with one overlay target, app focus preserved, passive presenter state, and
no crash evidence. The older
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
`user`, or `checkout`; Deck Desktop fullscreen proof includes
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

On macOS Apple Silicon, the packaged smoke app uses an in-bundle native launcher
so Steam keeps `DYLD_INSERT_LIBRARIES` while the launcher aligns `SteamAppId`,
`SteamGameId`, and `SteamOverlayGameId` before Electron starts. The macOS helper
can run `--close-probe`; it focuses the smoke app, sends the close input, and
verifies active/inactive callbacks, app focus return, `openAndWait(...)`
completion after parking, no post-close presenter pumping, and no crash
diagnostics. A 2026-06-29 full macOS matrix at
`/tmp/steam-bridge-macos-overlay-matrix-full-dialog-openwait-20260629-195732`
covers modal web, store, Friends/chat, dialog equivalents, profile, players,
community, stats, achievements, user chat, user SteamID, and every known
high-level dialog-equivalent route through managed `openAndWait(...)`;
synthetic checkout approval-route plumbing; passive notification toasts; and
managed Shift+Tab shortcut open/close for Friends, web, and store targets. The
summary gate requires active shown presenter snapshots,
an interactive macOS host environment for successful overlay cases, focus
return, idle parking at `currentFps=0` after close, no post-close pumping, and
clean crash diagnostics. It verifies macOS passive notification proof through
`--require-passive-notification`; that gate requires the smoke result and
lifecycle log to show the accepted achievement event, the matching Steam
callback, no modal overlay activation, and a passive managed-presenter snapshot.
A later 2026-06-29 core macOS matrix at
`/tmp/steam-bridge-macos-overlay-matrix-core-shortcut-targets-20260629-184303`
expanded the managed Shift+Tab proof from Friends/chat to Friends/chat, modal
web, and store shortcut targets. The summary gate now reads the expected shortcut
target from the matrix manifest and verifies both the `overlay:shortcut-open`
lifecycle payload and `overlayShortcut.targetType` snapshot before accepting a
shortcut case.
A later 2026-06-29 core macOS matrix at
`/tmp/steam-bridge-macos-overlay-matrix-core-players-20260629-185333`
added direct `presenter-players` coverage to the regular macOS suite. The
16-case artifact passed the same Steam launch/injection, active/inactive
callback, active shown presenter, focus return, zero managed timing, parked idle
presenter, and crash-diagnostic gates as the other presenter-backed community
surfaces.
A 2026-06-29 core macOS matrix at
`/tmp/steam-bridge-macos-overlay-matrix-core-openwait-expanded-20260629-190754`
then switched profile, players, community, stats, achievements, and user chat to
managed `openAndWait(...)` actions. That artifact reports `openAndWait=true` for
every interactive presenter-backed product route in the core suite and verifies
completion only after Steam closes and the presenter parks.
A later 2026-06-29 core macOS matrix at
`/tmp/steam-bridge-macos-overlay-matrix-core-shortcut-checkout-20260629-201942`
expanded managed shortcut proof to the synthetic checkout approval route. The
17-case run verified Friends, web, store, and checkout shortcut targets with
Shift+Tab open/close, active/inactive callbacks, app focus return, idle parking
at `currentFps=0`, zero managed overlay timing, and no crash diagnostics. The
checkout shortcut remains App ID `480` approval-route plumbing; real purchase
content still needs a real configured product.
A later 2026-06-29 core macOS matrix at
`/tmp/steam-bridge-macos-overlay-matrix-core-all-shortcuts-20260629-203243`
expanded shortcut proof to every supported presenter-backed target: Friends,
modal web, store, checkout approval route, profile, players, community, stats,
achievements, user chat, and dialog-equivalent. The 24-case run verified
Shift+Tab open/close, active/inactive callbacks, app focus return, idle parking
at `currentFps=0`, zero managed overlay timing, one `gameoverlayui` target, no
post-close pumping, and no crash diagnostics.
A later 2026-06-29 full macOS matrix at
`/tmp/steam-bridge-macos-overlay-matrix-full-close-wait-20260629-214233`
passed all 31 Steam-launched cases after the managed close-wait checks were
hardened. It covers the core routes plus user SteamID and every known
dialog-equivalent route through managed `openAndWait(...)`, with
`managedWaits=true`, `zeroTiming=true`, one `gameoverlayui` target under App ID
`480`, clean crash diagnostics, app focus return, and parked presenters for
every active managed overlay case.
The repository also provides `npm run macos:overlay-matrix`, which installs or
updates one stable macOS Steam shortcut pointing at the in-bundle native
launcher and a launcher env file. Each case rewrites only that env file, so
Steam is restarted only when the shortcut itself is added or materially changed.
Live success runs preflight `getMacOverlayEnvironment()` and stop before case
launch while the Mac is locked or the display is asleep; capture those states
with the expected native-host-unavailable verifier flags instead of treating
them as success-matrix failures. The matrix runs the packaged helper and records
per-case diagnostics. Its
self-test is part of package smoke coverage and includes the macOS artifact
summary self-test. After a live run it summarizes every macOS result and
lifecycle log, failing if a case loses Steam launch/injection identity, uses
nonzero managed overlay timing, reports crash diagnostics, duplicates
`gameoverlayui` targets attached to the smoke process, attaches a non-store
overlay target under a game ID other than `480`, misses passive
notification callbacks, misses checkout `openCheckoutAndWait(...)` completion
after close/parking, misses managed wait-helper shown/closed/parked lifecycle
events, misses active shown presenter snapshots in an interactive macOS host
environment, misses expected native-host-unavailable fail-fast
metadata, or misses active/inactive close-and-park evidence for interactive
overlays. To audit an
existing macOS artifact root, run
`npm run macos:overlay-matrix:summarize -- --artifact-root <path>`. Live runs
still require clearing Steam game processes on other machines first.
For shipped macOS builds, sign the app bundle with Steam-compatible entitlements
like `examples/electron-basic/entitlements.steam.macos.plist`: enable
`com.apple.security.cs.allow-dyld-environment-variables` and
`com.apple.security.cs.disable-library-validation`, and do not enable the App
Sandbox. Keep the in-bundle native launcher as the app's main executable so the
process Steam launches is also the process that aligns the Steam app and overlay
game IDs before Electron starts.

Use the repository-level matrix runner when you need to repeat the full Deck
Desktop product proof instead of hand-running each case:

```sh
npm run steam-deck:overlay-matrix -- \
  --host deck@<deck-host-or-ip> \
  --suite core
```

The matrix collects per-case screenshots and diagnostics for the managed
presenter routes: modal web, store, Friends, profile, community, stats,
achievements, user, dialog equivalents, checkout readiness, synthetic checkout
approval-route plumbing, Shift+Tab shortcut routing, and passive
progress/unlock toasts. After a live run it
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
