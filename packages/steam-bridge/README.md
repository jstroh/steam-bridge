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

## Platform Targets

Steam Bridge targets Steam desktop platforms for Electron and Node:

- macOS Apple Silicon: `aarch64-apple-darwin`
- Windows x64: `x86_64-pc-windows-msvc`
- Linux x64: `x86_64-unknown-linux-gnu`

### macOS Apple Silicon Only

Intel macOS is intentionally not supported. CI, release prebuilds, runtime
loading, native linking, and macOS smoke-app packaging enforce Apple Silicon
arm64 as the only macOS target; Steam Bridge does not build, run, or verify
Intel or universal macOS apps. Do not package, launch, or verify macOS smoke
apps through Rosetta. Do not package, launch, or verify macOS test or smoke
apps through any `darwin-x64`/universal Electron build. Build and run macOS test
apps only on native `darwin/arm64` Apple Silicon hosts.

The repository's macOS smoke package command intentionally maps to
`aarch64-apple-darwin` / `darwin-arm64` only. Do not add `darwin-x64`,
`x86_64-apple-darwin`, or universal macOS test-app targets. Every local macOS
test app build, launch, package, and overlay run for this package must use that
Apple Silicon target. A macOS command path that builds or runs an Intel,
Rosetta, or universal Electron app is a package bug, not an alternate
validation path.

`npm run check:platform` validates both the published native target list and
the example app's Apple Silicon-only macOS package path.
Any future macOS test app or smoke runner added here must keep that same
Apple Silicon-only shape; Intel macOS is not a secondary package or verification
target.

The packaged Windows smoke helper accepts the same generic smoke actions as the
Deck/macOS helpers for web, store, Friends, dialog-equivalent, checkout,
shortcut, and passive notification regression checks. Windows Electron overlay
testing starts with the normal `electronConfigureSteamOverlay()` path. On
Windows that default no longer forces Chromium's in-process GPU path, because
newer Electron/Chromium builds and Steam wrapper reports tie that switch to
blank or white windows. Pass `-OverlayInProcessGpu 1` only for a focused
compatibility comparison; that mode can prove whether Steam hooks Chromium's
main process, but it is not enough by itself for product overlay proof. If the
app window itself is blank or white, run `windows-render-health-probe.ps1` from
the interactive Windows desktop before more Steam-launched overlay cases. It
captures desktop and client-area screenshots for the default render path, the
explicit in-process GPU comparison, and the explicit `disableDirectComposition`
comparison, then writes `render-health-summary.json`.
If `disableDirectComposition` makes the app visible, keep treating it as an
opt-in diagnostic until it also passes close, Alt+Tab, and crash checks; upstream
Electron/Steam wrapper reports tie that switch to ghost-window regressions, and
local diagnostics have also shown visible-but-crashy behavior.
The Windows package also includes `windows-native-overlay-control.ps1`, which
builds a tiny native OpenGL diagnostic executable for comparing raw Steam
overlay routes against Electron. Use it only as a diagnostic control; it is not
the app-builder API and does not replace the ordinary Windows Electron overlay
path. On Smart App Control/App Control machines, freshly rebuilt generated
diagnostic executables can still need a reputable signature or policy-disabled
test machine even when Authenticode reports `Valid`. Its structured result
redacts the current user's Steam ID and records only presence/type metadata.
Run `windows-electron-smoke.ps1 -Mode preflight` on a Windows test package before
long live overlay runs. It reports Smart App Control/App Control policy state,
the parsed `CiTool.exe -lp` policy inventory, enforced policy names, whether a
`VerifiedAndReputableDesktop*` policy is actually enforced, Authenticode status
for the Electron executable and native `.node` addon, Zone.Identifier streams,
and recent Code Integrity block events that mention the smoke app. Pass
`-PreflightJsonFile <path>` to write the same report as structured JSON. If the
app or native addon is blocked there, Steam cannot initialize and overlay proof
must wait for a trusted/reputable signed package or an explicitly
SAC-disabled/evaluation-mode development machine.
For direct native-load checks, the Windows helper passes smoke state through the
child process environment rather than Electron command-line switches, which keeps
interactive Task Scheduler runs and private checkout values out of fragile
process arguments.
Standalone `windows-electron-smoke.ps1 -Mode steam-launch` refuses to start
Steam by default; pass `-AllowStartSteamClient` only when you intentionally want
the helper to open `steam://rungameid`.
The packaged smoke app also includes `sign-windows-package.ps1` so Windows test
machines can sign the exact bundle that Steam launches. Use
`.\sign-windows-package.ps1 -CertificateThumbprint "<thumbprint>"` with an
installed private-key publisher certificate, or set
`STEAM_BRIDGE_WINDOWS_PFX_PASSWORD` and pass `-PfxPath` to import a PFX. Run
`.\sign-windows-package.ps1 -VerifyOnly -AllowUnsigned` for an audit-only report.
Self-signed certificates are not enough SAC evidence; the live overlay proof
needs a trusted and reputable publisher signing path.
For disposable or dedicated Windows development machines, the package also
includes `windows-app-control-dev-mode.ps1`. It reports the current
`VerifiedAndReputablePolicyState`, captures `CiTool.exe -lp` policy inventory,
and can switch the machine-wide Smart App Control/App Control state with
`.\windows-app-control-dev-mode.ps1 -Mode set -State Off` before refreshing CI
policy. Use `-Mode report` for an audit-only JSON report, and use
`-Mode set -State Enforce` to restore enforcement when the Windows build allows
that transition. This helper is not a per-app allowlist and is not a substitute
for trusted/reputable publisher signing.
The Windows smoke bundle also includes `windows-overlay-matrix.ps1`. Run it
after signing to collect repeatable Steam-launched baseline evidence for the
ordinary Windows Electron overlay path; its preflight stops before live cases if
Smart App Control would block the native addon. The matrix does not trust
Authenticode status alone: after the report-only preflight it runs a short
direct `none` smoke action from the exact packaged app and requires Steam
initialization plus clean crash diagnostics before any live Steam-launched
overlay case. That native-load gate catches local self-signed packages that look
`Valid` to Authenticode but still fail SAC reputation or enterprise signing
policy. Matrix preflight writes `00-preflight/preflight.json`; native-load
gate setup also writes `00-preflight/native-load-gate-app-control.json` with the
enforced policy summary that drove the gate. Native-load failures also write
`00-preflight/native-load-gate-blocker.json` with a stable blocker code and next
actions, plus `00-preflight/native-load-gate/post-gate-preflight.json` after the
failed load attempt so Code Integrity events are captured from the same run.
If a Steam-launched case is run with the native gate skipped and Windows still
blocks the shortcut process, that case writes `steam-launch-blocker.json` with
post-case Code Integrity evidence and the stable
`windows-app-control-steam-launch-block` code when Steam itself was blocked from
loading the smoke executable.
For development-only App Control diagnostics, `windows-electron-smoke.ps1` and
`windows-overlay-matrix.ps1` accept `-NativePath <path-to-.node>`, which sets
`STEAM_BRIDGE_NATIVE_PATH` for the launched smoke process. Matrix manifests
record this as `nativePathOverride=true`. Keep those artifacts separate from
product package proof: they can help compare overlay routes while a freshly
rebuilt bundled native addon is blocked by reputation policy, but they do not
prove the final package's own native addon can load.
When a Windows native presenter is requested, the matrix also records
`expectedNativeHostBackend` and requires the native-load gate to run
`presenter-ready` with that backend before live route cases start. This prevents
an older accepted `-NativePath` override from being mistaken for current D3D11
or WGL presenter proof.
Every run writes `matrix-manifest.json` before preflight with the sanitized suite
and case list, so summary audits can prove a completed artifact contains every
intended case result and satisfies the recorded event, activation, no-activation,
and managed close-completion requirements instead of merely counting whatever
case directories exist.
Use `-InstallShortcut` to let the matrix install or reuse one stable
non-Steam shortcut. The shortcut points at a local smoke env file, and each
matrix case rewrites only that env file before launching through Steam. When
standalone Node.js is absent, the matrix uses the packaged Electron executable
in Node mode to run its shortcut updater. Use `-Suite shortcut` to verify or
refresh only that shortcut before live overlay cases; it runs preflight plus
shortcut resolution only, without the native-load gate or a `steam://rungameid`
launch. On App Control machines without standalone Node.js, that
Electron-in-Node-mode fallback can itself be blocked unless the package has a
trusted/reputable signature; install Node.js or run the shortcut updater from a
repo checkout in that case.

For development-only App Control diagnostics, the matrix can install the Steam
shortcut with `-ShortcutExe`, `-ShortcutStartDir`, and
`-ShortcutLaunchPrefix` while still using the packaged `resources/app` payload
and smoke env file. If the packaged Electron executable is also blocked as the
JavaScript shortcut updater, pass `-JavaScriptRunnerExe` to run
`upsert-steam-shortcut.cjs` through the same diagnostic Electron runtime in
Node mode. Use this to compare a reputable Electron runtime against the blocked
packaged executable, and keep those artifacts separate from product package
proof because the native-load gate still belongs to the exact final package. If
that diagnostic launch writes a smoke result but App Control blocks a native
dependency from `resources/app`, the case writes
`case-app-control-blocker.json` with
`windows-app-control-native-dependency-block`, fresh Code Integrity events, and
trusted/reputable-signing next actions.

Use `-Suite preflight` for
report-only Steam-client health capture, or `-Suite readiness` when a shaky
client needs the live-run readiness gate written without native-load,
shortcut-edit, or `steam://rungameid` work. Pass `-OnlyCase 01-web` or another
case ID/action when a recovering client is ready for one focused live probe
instead of a whole suite. Pass `-CleanStaleOverlayHelpers` only when you
intentionally want to stop orphaned Steam overlay helper processes whose target
game process and recorded Steam parent process are both gone. Live Steam-launched
suites require Steam to already be open in the interactive Windows desktop
session; the matrix stops before live launch if
`00-preflight/live-run-readiness.json` records a closed Steam client, a helper
running outside the interactive desktop session, remaining orphan overlay
helpers, or recent severe CEF/GPU/overlay-renderer signals that mean Steam's own
UI is not healthy enough for overlay proof. SSH runs in Windows Session 0; use
the Parsec/local desktop session or an `/IT` scheduled task for live overlay
proof. Session 0 can produce `DXGI_ERROR_NOT_CURRENTLY_AVAILABLE` / `0x887A0022`
swap-chain failures that are not Steam Bridge overlay regressions. Stale
rendering signals are preserved in `steam-client-rendering-health.json` as
warnings.
The packaged smoke app also includes `windows-overlay-task.ps1`, a thin wrapper
around `windows-overlay-matrix.ps1` that creates a temporary interactive `/IT`
scheduled task and waits for the matrix artifact to finish. Use it when you need
to drive a remote Windows laptop from SSH while keeping live overlay work inside
the logged-in desktop session. Pass private publisher values through
`-PrivateEnvFile <path-to-NAME=VALUE-file>`; the wrapper imports them into the
task environment and prints only the count, not the values.
The wrapper accepts both split matrix arguments and inline
`-Name=value`/`-Name:value` forms, and redacts sensitive inline values
case-insensitively in its logs. `-MatrixArgsFile` is still the preferred shape
for private checkout runs because it avoids shell-specific quoting behavior.
The wrapper defaults to `-TaskRunLevel Limited`, matching Steam's logged-in
desktop token. Use `-TaskRunLevel Highest` only as a focused diagnostic when the
test machine's scheduled-task policy requires elevation.
From the repo, run
`npm run windows:overlay-matrix:summarize -- --artifact-root <artifact-root>` to
audit full runs, readiness captures, native-load blocker artifacts, Steam-launch
blockers, and per-case Steam rendering-health signal codes without scraping
helper logs by hand. The packaged bundle also includes
`summarize-windows-overlay-matrix.cjs` for machines with a local Node.js runtime.
The managed suite's active cases opt into complete-result mode and require Steam's
inactive callback plus managed close, park, and open-and-wait completion events,
so they should be run only when the overlay can be closed interactively or by a
verified UI close probe. Use `-Suite managed-routes` for the public App ID `480`
product-facing managed route set without real transaction checkout or the raw
native diagnostic observe cases. For automated Windows managed-route proof,
`-CloseProbeInput auto` is the default: it opens shortcut cases with the
Steam overlay chord and closes Steam web-backed surfaces only after screenshot
evidence shows the panel has painted. Use `-Suite shortcut-routes` for focused
Windows shortcut `openShortcutTargetAndWait(...)` coverage across the public
non-checkout targets, with the requested target recorded in smoke diagnostics.
Check the per-case artifact before treating a route as product-proof. Keep public
checkout routing proof on App ID `480`, and keep real checkout authorization
proof focused on
`-LaunchMode steam-app -Suite checkout -InitTxnRequestFile <private-init-txn-request.json> -RequireMicroTxnCallback -CloseProbe -CloseProbeInput auto`
with your own configured app and product. The real Steam app's launch options
must launch the smoke package through the configured app rather than a
non-Steam shortcut. Prefer a private Steam branch/depot whose Windows launch
option points at `SteamBridgeSmoke.exe`. For local proof on a dedicated Windows
test machine, the smoke package also includes
`windows-steam-app-launch-options.ps1` to inspect, set, and restore a backed-up
per-user Steam launch-option wrapper. Fully quit Steam before setting or
restoring `localconfig.vdf`, because Steam can overwrite that file while it is
running.
The checkout suite covers
prepare-only, direct checkout, Shift+Tab checkout, and programmatic checkout
shortcut open-and-wait without rerunning unrelated overlay surfaces. Add
`-RequireMicroTxnCallback` when the artifact should prove Steam's authorization
callback for the direct managed checkout operation. Shortcut checkout remains
parser, route, and lifecycle proof because it has no in-app transaction
operation boundary to correlate against.

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
`client.utils.getOverlayDiagnostics()`, bridge-owned overlay presenter helpers
such as `client.overlay.attachPresenter()` and
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
variables and adds Electron's Linux `no-zygote` switch by default. On Linux,
macOS, and Windows, that keeps the bridge-owned native presenter as the single
Steam overlay target. Core Steam API success should not be treated as proof that
the Steam overlay has hooked the right surface.
`client.overlay.createElectronSteamOverlay()` applies the same child-process
preload scrub by default for future Electron children, so the managed overlay
path still protects apps that create the overlay manager before later windows or
workers are spawned. Windows managed overlays now use the bridge-owned
D3D11/DXGI presenter by default and report `backend: "windows-d3d11"` in
snapshots. Pass `presenterMode: "session"` or set
`STEAM_BRIDGE_ELECTRON_OVERLAY_PRESENTER=session` only when intentionally
comparing the direct Steam/Electron hook fallback. Set
`STEAM_BRIDGE_WINDOWS_NATIVE_HOST_BACKEND=opengl` only for the older Win32/WGL
diagnostic host. Current Windows evidence covers managed web, store-web,
Friends/chat, dialog-equivalent routes, checkout routing, shortcut
open/close/back-to-app, Community/profile, stats, achievements, user routes, and
passive achievement progress/unlock notifications with clean crash diagnostics.
Real purchase authorization still requires a configured Steam app/product. Pass
`scrubSteamOverlayChildProcessEnv: false` only when collecting raw
Electron-child overlay diagnostics.
Raw activation helpers such as `activateToWebPage(...)` remain available for
Node/native smoke checks and diagnostics, but Electron product overlay work
should go through the managed `createElectronSteamOverlay(...)` path.

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

const webResult = await steamOverlay.openWebAndWaitIfAvailable(checkoutUrl, { modal: true });
if (!webResult) {
  const webStatus = steamOverlay.getWebOpenStatus(checkoutUrl, { modal: true });
  console.warn("Steam overlay target is not waitable right now", webStatus.reason ?? webStatus.waitReason);
}

const realAppId = Number(process.env.STEAM_APP_ID);
const transaction = {
  orderId: Date.now(),
  items: [{ itemId: 100, quantity: 1, amount: 199, description: "Example item" }]
};

const checkoutStatus = steamOverlay.getCheckoutOperationStatus();
if (!checkoutStatus.canStartOperation && !checkoutStatus.canWait) {
  console.warn("Steam checkout is not ready yet", checkoutStatus.reason ?? checkoutStatus.waitReason);
}

const checkoutResult = await steamOverlay.openCheckoutAndWaitIfAvailable(() =>
  steamworks.webApi.microTxn.initClientTxn({
    appId: realAppId,
    orderId: transaction.orderId,
    steamId64: steamId,
    language: "en",
    currency: "USD",
    items: transaction.items
  })
);
if (!checkoutResult) {
  console.warn("Steam checkout overlay is not available right now.");
}

// Optional: reuse the configured Shift+Tab target from a controller/menu button.
// Use the wait form when the app should resume only after Steam closes.
await steamOverlay.openShortcutTargetAndWaitIfAvailable();

// Achievement progress/store notifications are automatically primed while the
// managed overlay is open. Use prepareForNotification() only for custom cases.

steamOverlay.openFriendsIfAvailable();
steamOverlay.openStore({ appId: 480 });

await steamOverlay.openFriendsAndWait();

await steamOverlay.openProfileAndWait();

await steamOverlay.openDialogAndWait({
  dialog: "Achievements",
  appId: 480
});

await steamOverlay.openCommunityAndWait({
  appId: 480
});

await steamOverlay.openStatsAndWait({
  appId: 480
});

await steamOverlay.openAchievementsAndWait({
  appId: 480
});

await steamOverlay.openUserAndWait({
  dialog: client.overlay.UserDialog.SteamId
});
```

The macOS smoke package verifies this managed overlay path from the same shape
apps should ship: Steam launches the bundle's native launcher, the launcher sets
the Steam App ID environment before `exec`ing Electron, and both executables are
signed with Steam-compatible entitlements. macOS support is Apple Silicon only:
build, package, sign, and test arm64 `.app` bundles, not Intel or universal
macOS targets. Use
`npx steam-bridge-prepare-macos-app --app-exe <YourApp.app/Contents/MacOS/YourApp>`
after packaging an arm64 macOS Electron app to install the published native
launcher, rename Electron to `<AppExecutable>.electron`, keep that launcher as
`CFBundleExecutable`, sign both executables, and verify the prepared app shape.
Steam Bridge also publishes the reusable launcher source at
`templates/macos-steam-env-launcher.c` and the matching entitlement template at
`templates/entitlements.steam.macos.plist` for build systems that need to call
the lower-level pieces directly.

For `electron-builder`, run the package helper from `afterPack` so the staged
Apple Silicon `.app` is rewritten before signing, then run the verifier from
`afterSign` so the final signed bundle is checked:

```js
// scripts/steam-bridge-macos-afterpack.cjs
const { prepareMacosSteamAppAfterPack } = require("steam-bridge/electron-builder");

exports.default = async (context) => {
  prepareMacosSteamAppAfterPack(context, { skipSign: true });
};
```

```js
// scripts/steam-bridge-macos-aftersign.cjs
const { verifyMacosSteamAppAfterSign } = require("steam-bridge/electron-builder");

exports.default = async (context) => {
  verifyMacosSteamAppAfterSign(context);
};
```

```json
{
  "build": {
    "afterPack": "scripts/steam-bridge-macos-afterpack.cjs",
    "afterSign": "scripts/steam-bridge-macos-aftersign.cjs",
    "mac": {
      "target": [{ "target": "dir", "arch": ["arm64"] }],
      "entitlements": "node_modules/steam-bridge/templates/entitlements.steam.macos.plist",
      "entitlementsInherit": "node_modules/steam-bridge/templates/entitlements.steam.macos.plist",
      "hardenedRuntime": true
    }
  }
}
```

The helper skips non-mac targets and rejects Intel or universal macOS targets,
so a real app can keep the Steam overlay packaging step hidden in the normal
builder lifecycle.
Do not define secondary macOS x64 or universal targets beside the arm64 target;
Steam Bridge's macOS app-builder path is Apple Silicon only.
The live macOS matrix then exercises the signed package through App ID `480`
overlay cases, including managed waits, shortcut targets, passive notifications,
checkout approval routing, all high-level dialog-equivalent routes,
close/back-to-app proof, and crash diagnostics. Before launching Steam, that
matrix verifies both macOS smoke executables are arm64-only, validly signed,
carry the Steam overlay entitlements, omit App Sandbox, and that the bundle
`Info.plist` names the native launcher as `CFBundleExecutable`. It also verifies
that executable carries Steam Bridge's native launcher identity and that the
renamed `<AppExecutable>.electron` executable does not, so a signing pipeline
cannot silently leave Electron as the bundle entrypoint. The package also
publishes the same check as `steam-bridge-verify-macos-signing`; run
`npx steam-bridge-verify-macos-signing --app-exe <YourApp.app/Contents/MacOS/YourApp>`
against the final signed app shape before Steam overlay testing.

On Linux and macOS, the manager owns a reusable native presenter, keeps it
passive and click-through while idle, polls Steam overlay state cheaply where
the Steam SDK call is safe, and only pumps frames when Steam reports
`overlayNeedsPresent` or an overlay is being opened/active. On Windows, the
same manager uses Steam's ordinary direct overlay hook and does not create a
bridge-owned native host. On macOS, Steam Bridge disables the
`BOverlayNeedsPresent()` poll by default because Steam's injected renderer can
crash inside that call even on the Metal presenter path; macOS presentation is
driven by explicit overlay opens and Steam overlay activation callbacks instead.
`client.utils.overlayNeedsPresent()` returns `false` on that default path
without calling the crash-prone native poll, and
`client.utils.getOverlayDiagnostics()` reports
`overlayNeedsPresent=false` and `overlayNeedsPresentPollingEnabled=false` so
logs can distinguish a disabled poll from a safe poll that simply returned
false.
There is no macOS opt-in for this poll because the failure mode is a process
crash rather than a recoverable diagnostic error. Set
`STEAM_BRIDGE_DISABLE_OVERLAY_NEEDS_PRESENT=1` for the same escape hatch on
other platforms. Automatic passive notification priming performs one wake-up/poll
on platforms with safe needs-present polling and otherwise stays parked unless
an overlay is being opened/active, so quiet achievement/stat calls do not start
a fixed high-FPS boost. The managed Electron overlay also installs a default
`Shift+Tab` shortcut bridge that opens the verified
Friends/chat presenter route without asking Steam to hook Chromium child
processes. It also scrubs Steam's overlay renderer from future Electron
child-process preload env by default; pass
`scrubSteamOverlayChildProcessEnv: false` only for raw diagnostics. Pass
`overlayShortcut: false` to disable the shortcut bridge, or provide
`overlayShortcut: { target: { type: "community", appId } }` to choose another
presenter-backed target. Use `overlayShortcut.onOpen` for app logging or state
updates after the managed shortcut has passed readiness and called Steam's
overlay activation API; readiness failures call `overlayShortcut.onError`
without emitting a false open event. Static targets should not need a resolver
function just for side effects. Controller or in-game menu buttons can
call `steamOverlay.getShortcutOpenStatus()` to inspect the configured target
without invoking Steam or resolving dynamic app callbacks, then call
`steamOverlay.openShortcutTargetIfAvailable()` to open that same configured
managed target, or `steamOverlay.openShortcutTargetAndWaitIfAvailable()` when
the button flow should resolve only after Steam closes and the presenter parks.
The shortcut `IfAvailable` helpers return `null` while the Steam overlay is
already active/opening, while the shortcut bridge is disabled, or while a
side-effect-free status check already knows the host or route is unavailable,
so apps do not need to duplicate the target resolver. For direct targets, named
status helpers such as `steamOverlay.getWebOpenStatus(...)`,
`steamOverlay.getStoreOpenStatus(...)`, and
`steamOverlay.getCheckoutOpenStatus(...)` provide the same side-effect-free
preflight as `steamOverlay.getOpenStatus(target)` without requiring apps to
construct target objects by hand. For purchase buttons that have not called
`InitTxn` yet, `steamOverlay.getCheckoutOperationStatus()` reports whether it
is safe to start the checkout operation at all; `canStartOperation=false` means
app code should not call the backend transaction endpoint yet.
`steamOverlay.openIfAvailable(target)` and
`steamOverlay.openAndWaitIfAvailable(target)` return `null` for known target or
host availability blockers. They also return `null` while Steam's overlay is
already active or the managed presenter is still opening a previous overlay, so
duplicate menu/button presses do not start a second overlay action.
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
`getShortcutOpenStatus()` never resolves dynamic app callbacks; it reports
`reason: "dynamic-target"` unless a stronger side-effect-free blocker is
already known, such as `reason: "steam-unavailable"`,
`reason: "overlay-not-ready"`, or `reason: "native-host-unavailable"` while
macOS is locked or display-asleep.
Keyboard-triggered and programmatic shortcut opens also fail before resolving a
dynamic target callback while a hard blocker such as `steam-unavailable` or
`native-host-unavailable` is already known. The non-waiting
`openShortcutTarget()` helper also fails before resolving dynamic target
callbacks while `overlay-not-ready` is already known; the wait-capable shortcut
helpers can still resolve the target and wait through that temporary readiness
state.
The bridge consumes Shift+Tab only when it is opening
a managed presenter-backed target; once Steam reports an active overlay, it lets
Shift+Tab pass through so Steam can handle the close/toggle side. On macOS,
Steam can consume Shift+Tab before Electron's normal
`before-input-event` hook sees it, so Steam Bridge registers a focused-window
global shortcut fallback only while the game window is focused, then unregisters
it while Steam's overlay is active so the second Shift+Tab still closes
normally. If the shortcut fires before Steam reports the overlay hook ready,
Steam Bridge keeps that open in the managed wait path, waits for readiness
before activation, and leaves the macOS global shortcut unregistered while the
wait is pending so Steam can receive the close/toggle input after the overlay
appears. If macOS already reports the screen locked or display asleep, the
shortcut fallback follows the same native-host-unavailable path as the overlay
helpers: it does not start Steam activation or emit a warning unless app code
provided an `overlayShortcut.onError` handler. If the host becomes unavailable
while the fallback is waiting for Steam's overlay callback, that wait also stays
quiet instead of producing warning noise. Deck Desktop and macOS proof now
verify a second Shift+Tab closes the managed overlay and returns focus to the
app. It is the recommended builder-facing entry point: web, store, Friends, Profile,
Community, Stats, Achievements, user-profile, and checkout targets route through the
presenter-backed paths
used by the Steam Deck Desktop Mode proofs; `openSteamOverlay(...)` and the
lower-level named helpers remain available for apps that prefer explicit
lifecycle control. Non-wait helpers fail before activation when fresh
diagnostics already prove a known blocker such as Steam not running, the
overlay hook not being ready, a busy managed overlay, or an unavailable macOS
native host. Wait helpers share the same preflight: hard blockers fail before
native-host activation, while a temporary `overlay-not-ready` state can wait for
Steam readiness before activating Steam. Use the wait or `IfAvailable` forms
for normal UI buttons and controller bindings.
The public smoke app can verify checkout readiness, but real
purchase-content proof still requires a real Steam app and configured product.
`open(...)` keeps the presenter active with an operation-scoped hold until Steam
reports the overlay shown; its internal timeout is only a failure guard for the
case where Steam never activates the overlay. Use `openAndWait(...)` for modal
web, store, checkout, and dialog-equivalent overlays when app code should also
wait until Steam closes and the presenter parks. `openAndWait(...)` uses the
same side-effect-free status gate, waits for Steam's overlay diagnostics to
report the app ready before activating Steam, then parks from overlay callbacks
and presenter state changes instead of depending on a fixed activation window.
It also validates managed targets before preparing the native host and rejects
raw native prompt routes such as `route: "native"` dialog/user targets because
those routes are diagnostic-only and do not have reliable activation/close
semantics.
Managed Electron presenters default activation-boost and close-grace durations
to zero; the public helpers use scoped activation handles and Steam
callback/state waits. Use explicit duration-based preparation only for
lower-level diagnostics or custom split-step flows.
Use `waitForOverlayReady()`, `waitForOverlayShown()`, `waitForOverlayClosed()`, and
`parkWhenSteamOverlayCloses()` only when app code needs lower-level lifecycle
await points; in the default persistent presenter mode these resolve from Steam
Bridge's overlay diagnostics, overlay callback, and presenter state changes. App code supplies
deadlines or abort signals, not polling intervals; timeout handling is a
guardrail rather than app-facing timing glue. If a wait times out, is aborted,
or the overlay manager closes while the wait is pending, Steam Bridge throws
`SteamOverlayWaitTimeoutError`, `SteamOverlayWaitAbortedError`, or
`SteamOverlayWaitClosedError` with a stable `code`, `state`, and the last
managed presenter `snapshot`. Scoped active presenter holds are released so the
host can park back at idle after the failure. When available, the errors also
expose direct `diagnostics`, `nativeHostUnavailableReason`, and `macOverlayEnvironment`
properties copied from that snapshot; timeout errors also include `timeoutMs`.
Use the matching `isSteamOverlayWaitTimeoutError(error)`,
`isSteamOverlayWaitAbortedError(error)`, or
`isSteamOverlayWaitClosedError(error)` guard to branch without parsing messages.
On macOS, if a managed Shift+Tab shortcut-open attempt fails before Steam
reports a shown overlay, Steam Bridge restores the Electron window and
re-registers the fallback shortcut only when the final error snapshot says the
Steam overlay is no longer active. Native-host-unavailable transitions during
that wait stay quiet and return focus to the app without a timer.
The Electron smoke app records those await points as `overlay:presenter-wait-shown`,
`overlay:presenter-wait-closed`, and `overlay:presenter-parked` lifecycle
events so Deck/Linux artifact review proves the same public API app builders
call.
For `InitTxn` flows, call
`steamOverlay.openCheckoutAndWait(() => startTxn())`. Use
`steamOverlay.getCheckoutOperationStatus()` when the app wants to enable,
disable, or explain a purchase button before calling the backend. Use
`steamOverlay.openCheckoutAndWaitIfAvailable(() => startTxn())` for purchase
buttons that should return `null` instead of starting the transaction while the
managed overlay is closed, Steam is not running, the macOS native host is
unavailable, or another managed overlay action is already active/opening. If
Steam is merely still reporting `overlay-not-ready`, the safe helper waits for
readiness first and still does not call `startTxn()` until the checkout UI can
be shown. If Steam stops during that readiness wait, the safe helper returns
`null` and leaves `startTxn()` uncalled; the throwing checkout wait rejects
before starting the backend transaction. Steam Bridge primes the native
presenter and waits for Steam overlay readiness before the backend starts the
transaction, accepts common backend result shapes such as `steamurl`,
`steamUrl`, `transactionId`, or `transid`, and also unwraps documented
`InitTxn` envelopes such as
`response.params.transid` and Steam Bridge Web API responses at
`data.response.params`. It opens the checkout surface, then resolves after
Steam closes and the presenter parks. If you pass an abort signal, Steam Bridge
also honors it while the transaction operation is still pending, releases the
presenter hold, and throws `SteamOverlayWaitAbortedError`; pass the same signal
to your backend request if you also want to cancel the network I/O. If the
overlay manager closes while that operation is pending, the scoped hold is
released and `SteamOverlayWaitClosedError` is thrown without opening a late
checkout surface. If the returned `InitTxn`/checkout envelope contains an app
ID, `openCheckoutAndWait(...)` verifies it against the initialized Steam app ID
before opening checkout. Mismatch errors do not print either app ID, so private
purchase artifacts stay redacted while stale or wrong-app transactions fail
before Steam UI opens. The preparation is operation-scoped rather than an
app-tuned timer.
`steamOverlay.openCheckout(...)` and
`steamOverlay.openCheckoutIfAvailable(...)` are available for lower-level cases
where the app already has a resolved checkout target and intentionally does not
need to await overlay close. Real purchase flows should normally prefer
`openCheckoutAndWait(...)` so the presenter stays alive until Steam reports the
checkout overlay inactive.
When using the built-in Web API client, prefer the named helpers over raw
session strings. `microTxn.initClientTxn(...)` keeps Steam's client-session
automatic-prompt semantics for apps that need `MicroTxnAuthorizationResponse`
and have proved that prompt path for their configured app/account. For Windows
Electron checkout proof today, `microTxn.initWebTxn(...)` is the end-to-end
verified path: Steam returns a `steamurl`, Steam Bridge opens it through the
managed overlay browser, and the app can follow Steam's web-session
`QueryTxn`/finalization flow.
`steamOverlay.withCheckoutPrepared(...)`,
`steamOverlay.open({ type: "checkout", ... })`, and
`steamOverlay.prepareForCheckout()` remain available for lower-level flows that
need to separate presenter priming from transaction creation or overlay opening;
`withCheckoutPrepared(...)` uses the checkout operation availability gate for
hard blockers and waits through a temporary `overlay-not-ready` state before it
runs the wrapped callback. Standalone `prepareForCheckout()` is synchronous, so
it remains an immediate preflight and does not prime the native surface while
Steam is stopped, the overlay is not ready, the native host is unavailable, or
another managed overlay action is busy. `withCheckoutPrepared(...)` also accepts
the same operation-phase abort behavior plus an optional readiness `timeoutMs`,
and an explicit preparation duration should only be used when a standalone
split-step hold is intentional. Use `openCheckoutAndWait(...)` for the normal
managed purchase path.
When you need a checkout target object for a managed shortcut or split-step
flow, use
`client.overlay.checkoutTargetFromResult(initTxnResponse, { expectedAppId })`
instead of re-parsing `InitTxn` envelopes in app code. That gives custom
checkout routing the same wrong-app guard as `openCheckoutAndWait(...)`.
When you need to log or attach checkout diagnostics, use the checkout wait
result's `targetSnapshot` or call
`client.overlay.snapshotSteamOverlayTarget(target)`. Those sanitized snapshots
record only presence flags for checkout URLs, transaction IDs, return URLs, and
Steam IDs, so real purchase artifacts can stay useful without leaking private
values.
Managed overlay wait failures keep their original error class and also carry a
sanitized `targetSnapshot`. Checkout wait, checkout preparation, pending
checkout-operation abort/close, and checkout native-host-unavailable failures
additionally carry `checkoutTargetSnapshot`; use
`client.overlay.getSteamOverlayErrorTargetSnapshot(error)` or
`client.overlay.getSteamOverlayCheckoutErrorTargetSnapshot(error)` when logging
failures instead of logging the raw checkout target.
The Electron smoke app redacts real checkout URLs, transaction IDs, return URLs,
Steam IDs, auth-ticket bytes, and private CLI arguments from result and lifecycle
artifacts while preserving machine-checkable presence flags and presenter
snapshots. For real product smoke proof from a pre-created checkout result,
write the backend `InitTxn` or checkout response JSON to a private temp file and
pass its path with `STEAM_BRIDGE_SMOKE_CHECKOUT_JSON_FILE`, the macOS
helper/matrix `--checkout-json-file` option, or the Windows helper/matrix
`-CheckoutJsonFile` option; the smoke app feeds that object through
`openCheckoutAndWait(...)` without committing private data or putting
transaction values in launch arguments. To create that private file from a
generic request JSON, run
`steam-bridge-init-client-txn --file <private-init-txn-request.json> --out <private-init-txn-response.json> --production`
with the publisher key in `STEAM_WEB_API_KEY` or `STEAM_API_KEY`; the CLI does
not accept literal keys in command-line arguments and prints only sanitized
checkout-target presence metadata. Client-session captures are written with a
`clientSession: true` wrapper so downstream helpers do not synthesize a browser
checkout URL from Steam's in-game authorization response. Use `--session web`
for a returned Steam URL checkout path, or `--session client-default` to omit
`usersession` for request-shape diagnostics. On Windows, prefer matrix-owned
in-app capture with
`-LaunchMode steam-app -InitTxnRequestFile <private-init-txn-request.json>`.
The smoke app creates the transaction after Steam has initialized and after it
has read the active Steam ID, then records only sanitized checkout-target
presence metadata. Use the non-Steam shortcut lane for public App ID `480`
route and lifecycle coverage; use `steam-app` for callback-required real
purchase proof. The macOS and Windows matrices preflight static checkout JSON
through
`checkoutTargetFromResult(...)` and pass the matrix app ID into that resolver
before any live Steam launch. If the capture includes an app ID, the same
wrong-app guard used by runtime checkout opens rejects mismatches without
printing either value. A malformed, incomplete, or mismatched private `InitTxn`
capture fails early. Run the same validation without the matrix using
`npx steam-bridge-validate-checkout-target --file <private-init-txn-response.json> --expected-app-id <your-app-id>`.
That validator treats Steam SDK-style app ID fields such as `m_unAppID` and
`m_nAppID` as embedded app IDs too, including when they appear inside line-item
arrays, so private captures report
`appId.present=true` without printing the value.
Use the macOS matrix's `--suite checkout` for focused private purchase proof;
pair it with `--app-id <your-app-id>`,
`--checkout-json-file <private-init-txn-response.json>`, and
`--require-microtxn-callback` when the private direct checkout case is expected
to produce a `MicroTxnAuthorizationResponse`. On Windows, keep focused private
checkout proof to
`-LaunchMode steam-app -Suite checkout -InitTxnRequestFile <private-init-txn-request.json> -RequireMicroTxnCallback -CloseProbe -CloseProbeInput auto`
with the matching configured app ID when a purchase authorization callback is
expected. The callback flags require private checkout input, so a real-callback
proof cannot accidentally fall back to the public synthetic App ID `480` or the
non-Steam shortcut harness.
The Windows matrix also rejects `-RequireMicroTxnCallback` with App ID `480`
before live launch because that public app can only prove checkout routing.
The summary will fail if that callback is missing, lacks a
presenter snapshot, or does not report the
launched Steam app ID, Steam authorization result, or a redacted order ID
presence marker. Steam Bridge normalizes the callback's Steam app ID, order ID,
and authorization flag to `appId`, `orderId`, and `authorized` even when the
native payload uses SDK-style field names. Shortcut checkout cases feed that
same parsed object through `checkoutTargetFromResult(...)`, so direct and
shortcut checkout routes share one accepted envelope parser; only the direct
managed checkout case claims operation-scoped callback proof. The macOS
matrix also accepts `--app-id <your-app-id>` and summarizes the expected app ID
plus `checkoutSource=json-file` without persisting the JSON path; the matrix
summarizer rejects new manifests that include unredacted checkout file paths,
transaction IDs, return URLs, or checkout URLs in command metadata. It also
scans smoke result JSON and lifecycle logs for raw checkout approval URLs,
transaction/order IDs, return URLs, Steam IDs, configured-product item
metadata, price/currency details, and private checkout CLI arguments, so
private purchase artifacts fail closed if redaction regresses. SDK-style order
and transaction fields from Steam callbacks are treated as private checkout
identifiers too.
For Windows `usersession=client` diagnostics, the summary also prints
`microTxnListener`, `legacyMicroTxnListener`, `microTxnSources`,
`clientSessionCaptured`, `clientSessionCapturedSession`,
`clientSessionCapturedEndpoint`, `clientSessionCapturedHttp`,
`clientSessionCapturedUsersession`, `clientSessionCapturedIpAddress`,
`clientSessionCapturedRequest`,
`clientPromptMissing`, `clientPromptSession`, `clientPromptEndpoint`,
`clientPromptHttp`, `clientPromptUsersession`, `clientPromptIpAddress`, and
`clientPromptRequest`. If the automatic client prompt is missing after a
client-session target is captured, the smoke app can also run a bounded,
read-only `QueryTxn` probe and the summary prints `clientQuery`,
`clientQuerySchema`, `clientQueryClosed`, `clientQueryAttempted`,
`clientQueryReason`, `clientQueryEndpoint`, `clientQueryId`, `clientQueryOk`,
`clientQueryHttp`, `clientQueryResult`, `clientQueryStatus`, `clientQueryError`,
and `clientQueryRequestError`, plus transaction/order/Steam-ID presence flags.
The probe never finalizes or captures the transaction. Its scalars use a closed
schema and the Windows summarizer normalizes them again before printing.
A case with
`clientSessionCaptured=true` and `clientPromptMissing=true` means the in-app
`InitTxn` call returned a transaction id, Steam Bridge preserved it as a
client-session checkout target without synthesizing a web approval URL. The
historical result remains inconclusive; the corrected operation ordering still
needs one current-head live run. Summary rows print
`clientSessionCapturedTransaction`, `clientSessionWaitStarted`,
`checkoutOperationDeferredInitTxn`, `checkoutOperationObserver`,
`checkoutOperationPresenter`, `clientSessionWaitPrompt`, and
`clientSessionWaitPresenter` so callback-required explicit-client artifacts
must prove the observer and active presenter existed before `InitTxn`. Required
callback artifacts also prove that the smoke app registered both the current
Steamworks and legacy normalized `MicroTxnAuthorizationResponse` listener paths
with value-free `callback:microtxn-listener-registered` events before checkout
proof. Any authorization callback must include `callbackSource` as `steamworks`
or `legacy` and `matchesCurrentCheckoutOperation=true`, computed from the
current app/order pair without logging either identifier. Use a fresh order ID
represented as a decimal string or safe integer for every live attempt.
`microTxnSources` reports the unique source list for the artifact. The
prompt session, endpoint, and HTTP status are copied from sanitized in-app
`InitTxn` metadata so the artifact can be read without correlating private
request files. The request shape fields record only whether the submitted
request used an explicit
`usersession` value, whether an IP address field was present, required
order/user/language/currency field presence, item and bundle counts, and whether
item or bundle entries had their required field names. For focused Windows
diagnostics, a private InitTxn request file can set `"session": "client-default"`
to omit `usersession` and test Steam's documented default logged-in-client
authorization path; `"session": "web"` keeps testing the returned Steam URL
checkout path through the managed overlay browser. Current Windows evidence
treats `client-default` as a request-shape diagnostic only: Steam can reject it
before returning any checkout target, while the web-session Steam URL flow is
the proved managed-overlay checkout path. Target-missing InitTxn diagnostics
print `initTxnTargetMissing`, `initTxnSession`, `initTxnResult`, and
`initTxnErrorCode`, plus `initTxnUsersession`, `initTxnIpAddress`, and
`initTxnRequest`, in the Windows summary without logging private item,
transaction, or account values.
Before live Windows launch, the matrix also writes
`00-preflight/init-txn-request-shape.json` for private `-InitTxnRequestFile`
runs. That preflight artifact records only the same field-presence/count shape,
plus whether a provided request-file app ID matched `-AppId`; mismatches fail
before native-load, render-health, or Steam launch work, without printing either
app ID. The Windows summary auditor requires this preflight artifact whenever
the matrix manifest records an InitTxn request file, and prints only the
value-free `initTxnRequestShapePreflight` booleans, counts, and compact shape
string. It also requires the smoke app's runtime
`checkout:init-txn-request-shape` lifecycle event for those cases and rejects
artifacts where the runtime compact shape does not match the preflight compact
shape. For `usersession=web` request-file runs, the summary also requires the
runtime InitTxn capture to show a value-free Steam approval URL target shape
(`hasSteamUrl=true`), keeping web-session checkout proof distinct from generic
overlay success.
The matrix's dry-run and live command logs also redact checkout file paths,
checkout URLs, return URLs, transaction IDs, and control tokens. Those logs show
the option name plus `REDACTED`, which keeps command-shape review useful without
printing private purchase data. The Windows task wrapper applies the same
redaction to both split arguments and inline `-Name=value`/`-Name:value`
matrix arguments before it logs the scheduled task launch.
On macOS, the helper also copies fresh `SteamBridgeSmoke*.ips` reports from
`~/Library/Logs/DiagnosticReports`, plus `MTLCompilerService*.ips` reports whose
content attributes the crash to `SteamBridgeSmoke`, into `macos-crash-reports/`,
and the matrix summarizer rejects those copied reports during artifact audit.
Passive Steam notifications such as achievement progress
or achievement unlock toasts are automatically primed by the managed Electron
overlay before the relevant achievement/stats calls. If macOS reports the
native host unavailable because the screen is locked or display is asleep,
automatic notification priming skips native host work but keeps the presenter
registered, so the next notification-producing call after unlock/wake can prime
normally. On platforms with safe needs-present polling, the helpers pump only
when Steam reports `overlayNeedsPresent`; use
`steamOverlay.prepareForNotification()` only for lower-level or custom Steam API
calls. On macOS, presenter snapshots keep `overlayNeedsPresent=false` by default
because Steam Bridge avoids the crash-prone Steam polling call there, and
`overlayNeedsPresentPollingEnabled=false` records that policy. On
Linux/X11, fully idle mode makes the host transparent and click-through;
`overlayNeedsPresent` can make it visible while leaving input click-through for
passive notifications; opening or active overlay mode restores both opacity and
input so Steam web or checkout UI can receive clicks, then parks the host
transparent after Steam reports the overlay inactive. On Windows D3D11 proof
runs, the default Windows matrix now proves managed web/store, Friends/chat,
dialog-equivalent, Community/profile, stats, achievements, user routes,
checkout routing, keyboard open/close/back-to-app, and passive notifications
without passing a presenter/backend override. Passive notification verification
allows `overlayEnabled=false` because there is no modal overlay, but still
requires Steam to accept the achievement event, no `GameOverlayActivated(true)`
callback, an attached D3D11 host, passive transparent/click-through state,
`overlayNeedsPresent=false`, `currentFps=0`, and clean crash diagnostics. The
default `idleFps` is
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
`prepareForCheckout()` split-step flows. If you want to branch before starting
an overlay operation, call `steamOverlay.getNativeHostAvailability()` and check
its structured `available`, `reason`, `macOverlayEnvironment`, and `snapshot`
fields:

```ts
const availability = steamOverlay.getNativeHostAvailability();
if (!availability.available) {
  console.warn("Steam overlay host unavailable:", availability.reason);
  return;
}

await steamOverlay.openFriendsAndWait();
```

The Electron smoke snapshot also records that same helper result at
`snapshot.overlay.nativeHostAvailability`, and the macOS unavailable matrix
requires it to agree with the presenter snapshot and expected unavailable
reason.

Still keep an error guard around the actual operation because a Mac can lock or
sleep between a preflight check and Steam activation. Use
`isSteamOverlayNativeHostUnavailableError(error)` and then check `error.reason`
instead of parsing the message when falling back to another purchase or browser
flow:

```ts
try {
  await steamOverlay.openFriendsAndWait();
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
The smoke app's `presenter-ready` action is the cheapest managed-overlay
preflight: it creates the Electron overlay manager, records
`overlay:presenter-ready`, and captures native host availability without
activating Steam overlay UI.
On macOS this is a pre-activation proof, so it should require Steam launch,
overlay injection, native host availability, idle presenter state, and no
overlay-active callback, but not `overlayEnabled=true`.
The `presenter-duplicate-open-guard` action opens a managed web overlay and
immediately proves every named managed target's direct and wait-style
`IfAvailable` helpers, generic `openIfAvailable(...)` /
`openAndWaitIfAvailable(...)`, both checkout helpers, and the
shortcut/controller helpers `openShortcutTargetIfAvailable()` and
`openShortcutTargetAndWaitIfAvailable()` return `null` while that overlay is
opening, without running the checkout operation callback.
Unit coverage also verifies the checkout `IfAvailable` helpers skip or suppress
work when fresh Steam diagnostics already report Steam stopped or the overlay
disabled.
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
actions and adds the shortcut-target requirement for `presenter-shortcut` and
`presenter-shortcut-open-and-wait`. Use
`presenterMode: "session"` or
`STEAM_BRIDGE_DISABLE_ELECTRON_OVERLAY_PRESENTER=1` only as an emergency
compatibility switch: it disables the reusable presenter, uses the older
one-shot native-session lifecycle for the same `steamOverlay.open(...)` calls,
and may pump more aggressively while a session is open. The Linux and Steam Deck
smoke helpers expose this as `--presenter-mode session` for repeatable
diagnostic comparisons. Use `steamOverlay.openFriends()` for a generic Friends
List surface; it opens Steam Community chat through the same native web
presenter path, keeping Electron child-process isolation intact. Use
`steamOverlay.openProfile({ steamId64 })` for a Steam profile page; omit
`steamId64` to open the current user's profile. This covers the common profile
case for raw `ActivateGameOverlayToUser` through the same presenter-backed
Steam web surface. Use
`steamOverlay.openUser({ dialog: client.overlay.UserDialog.SteamId, steamId64 })`
for the same profile route through the high-level user-dialog router. The
`user` target routes verified web-backed user dialog names through the presenter
by default: `steamid`/`profile`, `chat`, `stats`, and `achievements`. The
`chat` route opens the verified Steam Community chat/Friends surface. Native-only
prompt dialogs such as `jointrade` and friend request actions remain raw
Steamworks diagnostics; pass `route: "native"` or call
`openNativeUserOverlay(...)` only when explicitly testing
`ActivateGameOverlayToUser(...)` behavior. Use
`steamOverlay.openPlayers({ steamId64 })` for the current user's or a specified
user's Steam Community players page through the same presenter-backed web
surface. Use `steamOverlay.openCommunity({ appId })` for the app's Steam
Community hub, `steamOverlay.openStats({ appId })` for the current user's app
stats page, and `steamOverlay.openAchievements({ appId })` for the current
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

For Windows Electron apps, start with the default configuration. It keeps
Chromium's in-process GPU path off so the app first proves a healthy visible
render baseline. If the Steam overlay still opens as a dim-only, white, or stale
surface, collect an explicit compatibility run with
`electronConfigureSteamOverlay({ profile: "compatibility" })`,
`electronConfigureSteamOverlay({ enableInProcessGpu: true })`, or
`electronConfigureSteamOverlay({ disableDirectComposition: true })`, then run
the Alt+Tab/close regression checks before shipping any fallback. Steam Bridge
keeps these as explicit options so normal Windows builds do not inherit known
blank-window or ghost-window risks unless evidence says they are needed.

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
`presenter-ready` / `presenter-web` / `presenter-web-open-and-wait` /
`presenter-store` / `presenter-store-open-and-wait` / `presenter-friends` /
`presenter-friends-open-and-wait` / `presenter-profile` /
`presenter-players` / `presenter-community` / `presenter-stats` /
`presenter-achievements` / `presenter-user` / `presenter-dialog-auto` /
`presenter-dialog-auto-open-and-wait` / `presenter-shortcut` /
`presenter-shortcut-open-and-wait` actions for the generic proof. Deck testing has verified a
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
can run `--close-probe`; it leaves the active Steam overlay focused for the
close input and verifies active/inactive callbacks, app focus return, `openAndWait(...)`
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
A 2026-06-30 core macOS matrix at
`/tmp/steam-bridge-macos-overlay-matrix-core-inittxn-envelope-20260630-000000`
passed 24 Steam-launched cases after the smoke checkout path began wrapping
synthetic inputs in an `InitTxn`-style `response.params` envelope, proving the
generic checkout unwrapping path while still leaving real purchase-content proof
to apps with configured Steam products. The same smoke path can now consume a
private checkout JSON file for real-product verification without changing the
committed generic examples.
A 2026-06-30 persistent macOS matrix at
`/tmp/steam-bridge-macos-overlay-matrix-20260630-110920` rebuilt and signed the
Electron `43.0.0` smoke package, reused the stable Steam shortcut without
restarting Steam, launched one App ID `480` process through Steam, and passed all
42 control-server-driven cases. The suite now proves
`steamOverlay.openShortcutTargetAndWait()` for Friends, store, checkout
approval-route, profile, players, community, stats, achievements, user chat, and
dialog-equivalent shortcut targets, with active/inactive callbacks, completion
after close and presenter parking, zero managed overlay timing, one Metal
presenter-backed overlay target per case, clean quit behavior, no leftover smoke
or overlay process, and no fresh macOS crash reports. The smoke app collects
macOS `gameoverlayui` diagnostics by querying matching PIDs directly instead of
scanning the whole process table, keeping the one-target summary proof reliable
through long persistent runs.
A later 2026-06-30 full cold-launch macOS matrix at
`/tmp/steam-bridge-macos-overlay-matrix-20260630-112048` reused the signed
Electron `43.0.0` package, verified the signing shape, reused the stable Steam
shortcut without restarting Steam, and passed all 42 process-per-case App ID
`480` cases. The full suite now proves the same
`steamOverlay.openShortcutTargetAndWait()` target set as the persistent suite,
including Friends, web, store, checkout approval-route, profile, players,
community, stats, achievements, user chat, and dialog-equivalent. Every new
cold-launch programmatic shortcut case verifies active/inactive callbacks,
completion after overlay close and presenter parking, one Metal presenter-backed
overlay target, zero managed overlay timing, clean back-to-app proof, no
leftover smoke/gameoverlay process, and no fresh macOS crash reports.
The repository also provides `npm run macos:overlay-matrix`, which installs or
updates one stable macOS Steam shortcut pointing at the in-bundle native
launcher and a launcher env file. Each case rewrites only that env file, so
Steam is restarted only when the shortcut itself is added or materially changed.
When the matrix owns a Steam startup or shutdown, it cleans stale Steam IPC
state only after Steam is fully stopped, including orphan `ipcserver`, stale
`/private/tmp/steam.pipe`, and stale
`/private/tmp/steam_chrome_{overlay,shmem}_uid*_spid*` entries for the current
user.
Use `--suite checkout` when the immediate question is private purchase behavior:
it runs checkout prepare-only, direct checkout, managed Shift+Tab checkout, and
programmatic shortcut checkout/open-and-wait with the same redacted manifest and
summary gates as the larger suites. Add `--require-microtxn-callback` with a
private checkout JSON file when the artifact should prove real authorization;
the summary then requires the MicroTxn callback to appear during the
`openCheckoutAndWait(...)` lifecycle with the native presenter still attached
and the callback app ID matching the launched Steam app.
The current core/full/persistent suites include a checkout prepare-only case
that calls `withCheckoutPrepared(...)` without transaction input, requires
`overlay:presenter-checkout-ready`, rejects modal overlay activation, and audits
that the presenter releases back to idle; real checkout-open cases remain
separate and require close/back-to-app proof. The current core suite is
live-proven at 37 Apple Silicon cases after adding direct readiness-status
proof for profile, players, community, stats, achievements, and user chat
helpers. The current full suite is live-proven at 55 Apple Silicon
process-per-case routes in
`/tmp/steam-bridge-macos-overlay-matrix-20260701-120932`, and the current
persistent suite is live-proven at 51 Apple Silicon one-process cases in
`/tmp/steam-bridge-macos-overlay-matrix-20260701-115219`, covering the managed
`presenter-ready` preflight, direct and waited web/store/Friends/dialog/
profile/players/community/stats/achievements/user routes, checkout approval
and prepare-only, passive progress/unlock toasts, every managed Shift+Tab
shortcut target, and every programmatic shortcut open-and-wait target with
close/back-to-app proof, zero-FPS parking, zero managed timing, managed
isolation, and clean crash diagnostics.
A 2026-06-30 full macOS artifact at
`/tmp/steam-bridge-macos-overlay-matrix-full-ready-current-20260630-164539`
passed all 44 process-per-case App ID `480` cases, and a persistent one-process
artifact at
`/tmp/steam-bridge-macos-overlay-matrix-persistent-ready-retry-current-20260630-170648`
passed all 44 cases through one Steam-owned process/control-server lifecycle.
A current-head persistent artifact at
`/tmp/steam-bridge-macos-overlay-matrix-20260630-224828` reused the signed Apple
Silicon Electron `43.0.0` package and stable shortcut without repackaging or
restarting Steam, drove all 44 App ID `480` cases through one Steam-owned
process/control-server lifecycle, and passed the summary audit with close,
parking, disabled needs-present polling, clean quit, no leftover
smoke/gameoverlay process, and clean crash diagnostics.
A fresh 2026-07-01 persistent artifact at
`/tmp/steam-bridge-macos-overlay-matrix-20260701-003835` repeated that
one-process Apple Silicon suite without repackaging or restarting Steam and
passed all 44 cases through the same Metal presenter path.
A current-head persistent artifact at
`/tmp/steam-bridge-macos-overlay-matrix-20260701-033432` rebuilt and signed the
same arm64-only Electron `43.0.0` package, launched one Steam-owned App ID
`480` process, and passed all 45 persistent cases. This run adds the expanded
duplicate-open guard proof to the broad one-process suite: direct,
shortcut/controller, and checkout `IfAvailable` helpers returned `null` while a
managed overlay was opening, and the same run re-proved passive toasts,
checkout routing, every managed shortcut target, every programmatic shortcut
`openAndWait(...)` target, all dialog-equivalent routes, close/back-to-app
proof, parked zero-FPS state, zero managed overlay timing, and clean crash
diagnostics.
A fresh 2026-07-01 full cold-launch artifact at
`/tmp/steam-bridge-macos-overlay-matrix-full-isolation-proof-20260701-045604`
rebuilt and signed the arm64 Electron `43.0.0` package, reused the stable
shortcut without restarting Steam, and passed all 45 process-per-case App ID
`480` cases. Every presenter case required managed overlay isolation, and the
summary now reports `managedIsolation=true` from the child-process preload scrub
diagnostics in addition to one Metal presenter-backed overlay target, visible
Steam web content before close input where applicable, close/back-to-app proof,
parked zero-FPS presenter state, disabled needs-present polling, zero managed
overlay timing, `idleStable=true` for active close paths, and clean crash
diagnostics.
A fresh 2026-07-01 full cold-launch artifact at
`/tmp/steam-bridge-macos-overlay-matrix-full-web-visible-fixed-20260701-015118`
rebuilt and signed the arm64 Electron `43.0.0` package, reused the stable
shortcut without restarting Steam, and passed all 44 process-per-case App ID
`480` cases. The summary reported `webVisible=true` for all 29 web-close cases,
proving visible Steam web content before close input in addition to active/
inactive callbacks, close/back-to-app proof, parked zero-FPS presenter state,
disabled needs-present polling, zero managed overlay timing, and clean crash
diagnostics.
New matrix manifests record their suite name, so the summary auditor rejects
named-suite artifacts that drop required overlay surface cases.
New manifests also require the smoke result snapshot to include named
builder-facing open-status diagnostics for web, store, Friends, profile,
players, community, stats, achievements, user, dialog, and checkout targets;
summary rows report this as `openStatuses=true` when the proof is present.
A focused 2026-07-01 checkout artifact at
`/tmp/steam-bridge-macos-overlay-matrix-20260701-034916` rebuilt and signed the
Apple Silicon Electron `43.0.0` package, reused the stable shortcut without
restarting Steam, and passed all four public App ID `480` checkout cases:
prepare-only, direct synthetic approval-route checkout, managed Shift+Tab
checkout, and programmatic checkout shortcut `openAndWait(...)`. The summary
verified one Metal presenter-backed overlay target in every case, visible Steam
web content for the direct and programmatic web-close paths, close/back-to-app
proof, parked zero-FPS state, disabled needs-present polling, zero managed
overlay timing, and clean crash diagnostics. Real purchase-content evidence
still requires a configured product in a real Steam app.
A current-head 2026-07-01 core Apple Silicon artifact at
`/tmp/steam-bridge-macos-overlay-matrix-core-shortcut-readiness-20260701-062656`
rebuilt and signed the arm64-only Electron `43.0.0` package, verified the
native launcher/signing shape, reused the stable App ID `480` Steam shortcut
without restarting Steam, and passed all 27 core cases after shortcut readiness
hardening. It re-proved readiness, managed web/store/Friends/dialog
`openAndWait(...)`, duplicate-open suppression, passive progress/unlock toasts,
checkout approval and prepare-only, every managed Shift+Tab shortcut target,
and direct profile/players/community/stats/achievements/user routes with one
Metal presenter-backed overlay target, visible Steam web content where
applicable, active/inactive callbacks, close/back-to-app proof, parked zero-FPS
state, disabled needs-present polling, zero managed overlay timing, managed
child-overlay isolation, and clean crash diagnostics.
A focused 2026-07-01 minimal Apple Silicon artifact at
`/tmp/steam-bridge-macos-overlay-matrix-minimal-named-helpers-20260701-064718`
rebuilt and signed the same arm64-only Electron `43.0.0` package and passed all
7 Steam-launched cases after the smoke app moved the common managed actions to
the named builder helpers. It exercised `openWebAndWait(...)`,
`openStoreAndWait(...)`, `openFriendsAndWait(...)`, `openDialogAndWait(...)`,
duplicate-open suppression through `openWebAndWaitIfAvailable(...)`, and
passive notification priming with visible web content where applicable,
active/inactive callbacks, close/back-to-app proof, parked zero-FPS state,
disabled needs-present polling, zero managed overlay timing, managed
child-overlay isolation, and clean crash diagnostics.
A focused 2026-07-01 minimal Apple Silicon artifact at
`/tmp/steam-bridge-macos-overlay-matrix-minimal-direct-helpers-20260701-070531`
rebuilt and signed the same arm64-only Electron `43.0.0` package and passed all
11 Steam-launched cases after adding named direct helpers. It exercised direct
`openWeb(...)`, `openStore(...)`, `openFriends(...)`, and `openDialog(...)`
calls plus the existing wait-helper, duplicate-open, and passive notification
cases, with visible Steam web content where applicable, active/inactive
callbacks, close/back-to-app proof, parked zero-FPS state, disabled
needs-present polling, zero managed overlay timing, managed child-overlay
isolation, and clean crash diagnostics.
A focused 2026-07-01 minimal Apple Silicon artifact at
`/tmp/steam-bridge-macos-overlay-matrix-minimal-direct-checkout-20260701-071929`
rebuilt and signed the same arm64-only Electron `43.0.0` package and passed all
11 Steam-launched cases after adding named direct checkout target helpers. Its
duplicate-open guard now proves direct target, shortcut/controller,
`openCheckoutIfAvailable(...)`, and `openCheckoutAndWaitIfAvailable(...)`
helpers all return `null` while a managed overlay is already opening, and that
the checkout wait helper does not start its transaction operation in that busy
state. The same run re-proved direct web/store/Friends/dialog helpers,
wait-helper open/close, passive notification priming, visible Steam web content
where applicable, close/back-to-app proof, parked zero-FPS state, disabled
needs-present polling, zero managed overlay timing, managed child-overlay
isolation, and clean crash diagnostics.
A focused 2026-07-01 minimal Apple Silicon artifact at
`/tmp/steam-bridge-macos-overlay-matrix-20260701-073909`
rebuilt and signed the same arm64-only Electron `43.0.0` package, reused the
stable App ID `480` shortcut without restarting Steam, and passed all 11
Steam-launched cases after the smoke app moved managed open-status snapshots
and duplicate-open proof onto the named status helpers. Its duplicate-open guard
now requires `getWebOpenStatus(...)`, `getStoreOpenStatus(...)`,
`getFriendsOpenStatus()`, and `getCheckoutOpenStatus(...)` to report
`canOpen=false`, `canWait=false`, `reason=opening`, and `waitReason=opening`
while a managed overlay is already opening. The same run re-proved direct
web/store/Friends/dialog helpers, wait-helper open/close, passive notification
priming, visible Steam web content where applicable, close/back-to-app proof,
parked zero-FPS state, disabled needs-present polling, zero managed overlay
timing, managed child-overlay isolation, and clean crash diagnostics.
A focused 2026-07-01 minimal Apple Silicon artifact at
`/tmp/steam-bridge-macos-overlay-matrix-open-statuses-20260701-080050` reused
the signed arm64-only Electron `43.0.0` package and the stable App ID `480`
shortcut without restarting Steam, then passed all 11 Steam-launched cases after
the summary auditor began requiring named open-status snapshots from every
smoke result. Every summary row reported `openStatuses=true`, proving the
builder-facing `get*OpenStatus(...)` diagnostics stayed wired for direct
web/store/Friends/dialog opens, `openAndWait(...)` routes, duplicate-open
suppression, and passive notification priming while preserving the same
close/back-to-app, zero-FPS parking, zero managed timing, isolation, and crash
checks.
A current-head 2026-07-01 persistent Apple Silicon artifact at
`/tmp/steam-bridge-macos-overlay-matrix-persistent-open-statuses-20260701-080755`
then reused the same signed arm64-only Electron `43.0.0` package and stable App
ID `480` shortcut without repackaging or restarting Steam, launched one
Steam-owned smoke process/control-server lifecycle, and passed all 45
persistent cases with `openStatuses=true` on every summary row. It re-proved
readiness, web/store/Friends/dialog `openAndWait(...)`, duplicate-open
suppression, passive progress/unlock toasts, checkout approval and prepare-only,
every managed Shift+Tab shortcut target, direct profile/players/community/
stats/achievements/user/dialog-equivalent routes, and every programmatic
shortcut `openAndWait(...)` target with close/back-to-app proof, parked
zero-FPS state, zero managed timing, managed isolation, clean crash diagnostics,
and no leftover smoke or overlay processes.
A current-head 2026-07-01 persistent Apple Silicon artifact at
`/tmp/steam-bridge-macos-overlay-matrix-persistent-checkout-operation-20260701-083629`
rebuilt and signed the same arm64-only Electron `43.0.0` package, reused the
stable App ID `480` shortcut without restarting Steam, launched one Steam-owned
smoke process/control-server lifecycle, and passed all 45 persistent cases
after the macOS summary auditor began printing `checkoutOperation=true` beside
`openStatuses=true`. The live artifact proves every smoke snapshot included
`snapshot.overlay.openStatuses.checkoutOperation` with a checkout target
snapshot and `canStartOperation` boolean, while preserving the same web/store/
Friends/dialog, shortcut/toggle, passive progress/unlock toast, checkout
approval/prepare, close/back-to-app, parked zero-FPS, managed isolation, and
clean crash diagnostics.
A focused 2026-07-01 minimal Apple Silicon artifact at
`/tmp/steam-bridge-macos-overlay-matrix-minimal-full-ifavailable-fixed-20260701-090347`
then rebuilt and signed the same arm64-only Electron `43.0.0` package and
passed all 11 Steam-launched cases after the duplicate-open guard began proving
every named managed target's direct and wait-style `IfAvailable` helpers. That
live run also caught and re-proved the checkout-operation status ordering:
while another overlay is already opening, `getCheckoutOperationStatus()` now
reports `reason: "opening"` before any transient `overlay-not-ready` state, so
purchase buttons do not start `InitTxn` during a managed overlay open.
A focused 2026-07-01 minimal Apple Silicon artifact at
`/tmp/steam-bridge-macos-overlay-matrix-minimal-direct-open-status-20260701-091919`
then reused the signed arm64-only Electron `43.0.0` package and stable App ID
`480` shortcut without restarting Steam, and passed all 11 Steam-launched cases
after direct managed opens began failing known unavailable statuses before
Steam activation. It re-proved direct web/store/Friends/dialog opens,
web/store/Friends/dialog `openAndWait(...)`, duplicate-open suppression,
passive toast priming, visible Steam web content, close/back-to-app proof,
parked zero-FPS presenter state, zero managed timing, managed isolation, and
clean crash diagnostics.
A focused 2026-07-01 checkout Apple Silicon artifact at
`/tmp/steam-bridge-macos-overlay-matrix-checkout-readiness-before-inittxn-20260701-093251`
then rebuilt and signed the same arm64-only Electron `43.0.0` package and
passed all four Steam-launched checkout cases after `openCheckoutAndWait(...)`
began waiting for Steam overlay readiness before invoking the transaction
operation. Unit coverage proves a not-yet-ready overlay leaves the transaction
operation untouched and reports only a sanitized pending checkout snapshot on
readiness timeout; the live run re-proved prepare-only checkout, direct
synthetic approval checkout, managed Shift+Tab checkout, programmatic checkout
`openAndWait(...)`, visible Steam web content for web-close paths,
close/back-to-app proof, parked zero-FPS presenter state, zero managed timing,
managed isolation, and clean crash diagnostics.
A later focused 2026-07-01 checkout Apple Silicon artifact at
`/tmp/steam-bridge-macos-overlay-matrix-20260701-102924` rebuilt and signed the
same arm64-only Electron `43.0.0` package and passed the four checkout cases
after `withCheckoutPrepared(...)` began waiting through launch-time
`overlay-not-ready` before running the wrapped split-step callback. The run
re-proved prepare-only checkout, direct synthetic approval checkout, managed
Shift+Tab checkout, and programmatic checkout `openAndWait(...)`, including
close/back-to-app proof, parked zero-FPS presenter state, zero managed timing,
managed isolation, and clean crash diagnostics.
A focused 2026-07-01 checkout Apple Silicon artifact at
`/tmp/steam-bridge-macos-overlay-matrix-checkout-redacted-20260701-132412`
then reused the signed arm64-only Electron `43.0.0` package and stable App ID
`480` shortcut without restarting Steam and passed prepare-only checkout,
direct checkout approval, managed Shift+Tab checkout, and programmatic shortcut
checkout `openAndWait(...)` with live command logs redacting checkout
transaction inputs as `REDACTED`. The run re-proved named open-status and
checkout-operation diagnostics, visible checkout web content for waited close
probes, close/back-to-app proof, parked zero-FPS presenter state, zero managed
timing, managed isolation, one Metal presenter-backed overlay target under game
ID `480`, and clean crash diagnostics. This remains public App ID `480` routing
evidence; real purchase-content proof still requires a configured product in a
real Steam app.
A focused 2026-07-01 minimal Apple Silicon artifact at
`/tmp/steam-bridge-macos-overlay-matrix-20260701-111335` then reused the same
signed arm64-only Electron `43.0.0` package, verified the native launcher
identity marker, verified that the renamed `.electron` executable is not a
second launcher copy, and passed all 11 Steam-launched minimal cases with the
matrix requiring direct-open readiness-status evidence for direct
web/store/Friends/dialog actions. The smoke app records sanitized
readiness-status evidence and waits through launch-time `overlay-not-ready`
with `waitForOverlayReady()` before invoking named direct helpers. The run
re-proved direct web/store/Friends/dialog opens, wait-style
web/store/Friends/dialog routes, duplicate-open suppression, passive toast
priming, visible Steam web content, close/back-to-app proof, parked zero-FPS
presenter state, zero managed timing, managed isolation, and clean crash
diagnostics from the Apple Silicon package path.
A current-head 2026-07-01 core Apple Silicon artifact at
`/tmp/steam-bridge-macos-overlay-matrix-20260701-112850` reused the same signed
arm64-only Electron `43.0.0` package and stable App ID `480` shortcut without
restarting Steam, then passed all 31 core cases after the checkout approval
path began requiring direct readiness-status evidence. The smoke app now
records sanitized checkout-operation readiness and waits through launch-time
`overlay-not-ready` with `waitForOverlayReady()` before starting
`openCheckoutAndWait(...)`, preserving active/inactive callbacks, visible web
content, close/back-to-app proof, parked zero-FPS presenter state, zero managed
timing, managed isolation, and clean crash diagnostics from the Apple Silicon
package path.
A later recovered-client full artifact at
`/tmp/steam-bridge-macos-overlay-matrix-20260630-220434` also passed all 44
process-per-case App ID `480` cases after recreating the stable shortcut and
verifying the current Steam login health gate.
Rerun the full or persistent suite on an unlocked Mac after overlay, packaging,
or Electron-major changes.
Live success runs preflight `getMacOverlayEnvironment()` and stop before case
launch while the Mac is locked or the display is asleep; capture those states
with `--suite unavailable`, which expects managed web, checkout-open, and
checkout-prepare helpers, plus `openShortcutTargetAndWait()` against the
configured shortcut target, to throw `STEAM_OVERLAY_NATIVE_HOST_UNAVAILABLE`
before Steam overlay activation. The shortcut case records the managed wait
start and target diagnostics, but must not emit `overlay:shortcut-open` because
Steam Bridge never calls Steam's overlay activation API while the native host is
unavailable. The unavailable suite also exercises passive achievement-progress
notifications, requiring the presenter to stay registered for automatic
notification priming without attaching or opening the native host.
Use `npm run macos:overlay-matrix:preflight` for a cheap readiness check that
reads the macOS overlay environment without rebuilding the package, touching the
Steam shortcut, or launching smoke cases.
For unattended proof runs, pass
`--wait-for-interactive-seconds <seconds>` or set
`STEAM_BRIDGE_MACOS_MATRIX_WAIT_FOR_INTERACTIVE_SECONDS` to wait at this
preflight boundary only; the default is `0`, and product overlay lifecycle code
does not depend on this wait.
All unavailable cases record the matching presenter
`nativeHostUnavailableReason` and `nativeHostAvailability` helper result.
Locked macOS sessions can also report the display asleep; `macos-screen-locked` takes
precedence, and unavailable captures do not require `overlayEnabled=true`
because no native host should be created. A current-head locked/asleep run at
`/tmp/steam-bridge-macos-overlay-matrix-unavailable-target-snapshots-20260701-165605`
reused the signed arm64 Electron `43.0.0` package and stable App ID `480`
shortcut without restarting Steam, and passed all six unavailable cases with
`available=false`, `STEAM_OVERLAY_NATIVE_HOST_UNAVAILABLE`, reason
`macos-screen-locked`, sanitized action-error target snapshots, checkout
target snapshots for checkout errors, `nativeHostOpen=false`, no overlay
activation, zero overlay targets, disabled needs-present polling, zero managed
overlay timing, and no copied macOS crash reports. The matrix runs the packaged
helper and records per-case diagnostics.
Its self-test is part of package smoke coverage and includes the macOS artifact
summary self-test. After a live run it summarizes every macOS result and
lifecycle log, failing if a case loses Steam launch/injection identity, uses
nonzero managed overlay timing, reports crash diagnostics, duplicates
`gameoverlayui` targets attached to the smoke process, attaches a non-store
overlay target under a game ID other than the expected app ID, misses passive
notification callbacks, misses checkout `openCheckoutAndWait(...)` completion
after close/parking, misses managed wait-helper shown/closed/parked lifecycle
events, misses active shown presenter snapshots in an interactive macOS host
environment, records a `callback:microtxn` without a presenter snapshot, misses
expected native-host-unavailable fail-fast metadata, or misses active/inactive
close-and-park evidence for interactive overlays. To audit an
existing macOS artifact root, run
`npm run macos:overlay-matrix:summarize -- --artifact-root <path>`. Live runs
still require clearing Steam game processes on other machines first.
For packaged macOS smoke builds, the example packager compiles
`templates/macos-steam-env-launcher.c`, renames the Electron executable to
`<AppExecutable>.electron`, keeps the launcher as `CFBundleExecutable`, and
ad-hoc signs the native launcher plus renamed Electron executable with
Steam-compatible entitlements from
`templates/entitlements.steam.macos.plist`: enable
`com.apple.security.cs.allow-dyld-environment-variables` and
`com.apple.security.cs.disable-library-validation`, and do not enable the App
Sandbox. Keep the in-bundle native launcher as the app's main executable so the
process Steam launches is also the process that aligns the Steam app and overlay
game IDs before Electron starts. The app bundle `Info.plist` should name that
launcher in `CFBundleExecutable`, not the renamed Electron executable.
For shipped apps, use your normal Apple signing and notarization pipeline with
those same entitlements on the launched app process and the executable it
`exec`s.
The package verifier can check that final shape, including the native launcher
identity marker and the renamed Electron executable not being another launcher
copy:

```sh
npx steam-bridge-verify-macos-signing --app-exe <YourApp.app/Contents/MacOS/YourApp>
```

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
