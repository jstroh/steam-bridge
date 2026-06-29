# Native Overlay Presenter Plan

Last updated: 2026-06-29

This is the forward plan for reliable Steam overlay behavior in Electron apps on
Linux/Steam Deck and macOS. Windows overlay behavior appears lower risk, so the
plan treats Windows as a regression baseline rather than the design driver.

The goal is to make Steam Bridge own the hard platform work. Electron app
builders should initialize Steam, attach one presenter to their main window, and
open overlays through bridge APIs. They should not need app-specific overlay
controllers, X11 or Cocoa window code, Steam renderer process knowledge, or
timing hacks.

## Research Summary

- Valve documents the Steam overlay as a native graphics overlay for DirectX,
  OpenGL, Metal, and Vulkan. Steam API initialization should happen before the
  game initializes its graphics device so Steam can hook the right rendering
  path.
- Valve's overlay documentation specifically calls out browser-based games as a
  hard case. Their suggested direction is a native app with a graphics window
  that drives Chromium rendering, not relying on the browser window itself as
  the overlay target.
- `ISteamUtils::BOverlayNeedsPresent()` exists because event-driven renderers can
  starve overlay notifications. Steam may need the app to keep presenting frames
  so achievement toasts, invites, and other overlay UI can advance.
- Public Electron, WebView2, CEF, Tauri, and Steamworks binding reports point to
  the same failure mode: the web runtime often renders in a GPU child process or
  a surface Steam does not reliably hook. Steamworks calls can succeed while the
  visible overlay never appears.
- Steam Bridge's Deck Desktop testing confirmed a second Electron-specific
  failure mode: if Steam's overlay renderer is inherited by Chromium child
  processes, Steam can create competing `gameoverlayui` targets for both the
  Electron GPU process and the bridge-owned native presenter. The duplicate GPU
  hook can leave stale overlay surfaces after the native presenter receives
  `GameOverlayActivated(false)`.
- Steam Bridge's Deck Desktop proof already validates the core idea on Linux:
  a bridge-owned X11/GLX native presenter can show a modal Steam web overlay,
  emit active/inactive overlay callbacks, and return to the Electron smoke app
  cleanly.
- The app-facing reusable presenter path has been verified on Steam Deck Desktop
  Mode for a modal web overlay: passive host attached, active input/opacity
  during overlay UI, Electron child overlay targets isolated, inactive callbacks
  received, and clean return to the Electron smoke app.
- The reusable presenter path has also been verified for passive Steam
  achievement-progress and achievement-unlock notifications on Steam Deck
  Desktop Mode: the host stays transparent and click-through, Steam emits stats
  and achievement callbacks, and the toast renders over the Electron app without
  a modal `GameOverlayActivated` callback. The managed Electron overlay now
  registers its presenter for automatic passive notification priming, so normal
  achievement progress, achievement unlock, and stats-store calls do not require
  app code to manually call `prepareForNotification()`.
- Deck Desktop Friends List now has a product-shaped route:
  `openFriendsOverlay({ presenter })` opens Steam Community chat through the
  same native web presenter used by checkout/store overlays. Deck Desktop
  testing captured visible Friends/chat UI, used one `gameoverlayui` target
  attached to the app's main/native process, and returned cleanly to the app
  after the close probe.
- Deck Desktop Steam profile pages now have a product-shaped route:
  `openProfileOverlay({ steamId64, presenter })` and
  `steamOverlay.open({ type: "profile", steamId64 })` open a Steam Community
  profile through the same reusable native web presenter. A 2026-06-28 Deck
  Desktop run for the current user emitted active/inactive callbacks, showed
  profile web content in the native overlay host, returned focus to the Electron
  smoke app after the web close probe, and parked at `currentFps=0` without
  post-close pumping.
- Steam Community app hub and stats pages now have product-shaped routes:
  `openCommunityOverlay({ appId, presenter })` and
  `openStatsOverlay({ appId, presenter })` use the same native web presenter
  instead of raw Desktop `Community` / `Stats` dialogs. Deck Desktop testing
  verified activation, visible Steam web content, and return to the app with the
  web close probe.
- Deck Desktop achievements now has a product-shaped web route:
  `openAchievementsOverlay({ appId, presenter })` opens the current user's Steam
  Community stats/achievements URL through the same reusable native web
  presenter. Deck Desktop testing with App ID `480` emitted active/inactive
  overlay callbacks and returned cleanly to the app. SpaceWar's web achievements
  URL redirects to the user profile because it has no public web stats page, so
  achievements content proof needs a real app with web-visible stats.
- Deck Desktop user dialog equivalents now have a product-shaped route:
  `openUserOverlay({ dialog: "steamid", presenter })` and
  `steamOverlay.open({ type: "user", dialog: "steamid" })` route the common
  `ActivateGameOverlayToUser("steamid", user)` profile case through the same
  reusable native web presenter. A 2026-06-28 Deck Desktop core matrix run for
  App ID `480` emitted active/inactive callbacks, returned focus to the Electron
  smoke app after the web close probe, used one `gameoverlayui` target attached
  to the app process, and parked transparent/click-through at `currentFps=0`
  without post-close pumping. The same high-level user router now maps `chat` to
  the verified Steam Community chat/Friends presenter-backed web surface; exact
  native prompt actions such as trade joins and friend requests remain explicit
  raw diagnostics.
- Deck Desktop store pages now have a product-shaped web route:
  `openStoreOverlay(appId, flag, { presenter })` and
  `steamOverlay.open({ type: "store", appId })` default to the Steam store web
  overlay URL through the reusable native web presenter. A 2026-06-28 Deck
  Desktop run for App ID `480` recorded route `web`, emitted active/inactive
  callbacks, returned to the app after the web close probe, and stayed parked
  without post-close pumping. Pass `route: "native"` only for raw
  `ActivateGameOverlayToStore` diagnostics. The smoke app also has
  `presenter-store-open-and-wait`, which exercises
  `steamOverlay.openAndWait({ type: "store", appId: 480 })` and requires the
  promise completion event only after Steam reports overlay inactive and the
  presenter parks.
- Deck Desktop dialog-equivalent pages now have a builder-facing wait proof:
  `presenter-dialog-auto-open-and-wait --dialog OfficialGameGroup` exercises
  `steamOverlay.openAndWait({ type: "dialog", dialog, appId: 480 })` through
  the high-level presenter-backed dialog router and requires the same
  completion-after-inactive-and-parked evidence as web, store, and Friends wait
  actions. A 2026-06-29 Deck Desktop fullscreen run opened, closed, returned
  focus to the Electron smoke app, recorded completion after parking, and kept
  the stable post-close verifier sample at `currentFps=0` without advancing
  `pumpCount`. This extends the product path without depending on raw Desktop
  `ActivateGameOverlay(...)` dialogs.
- Deck Desktop keyboard toggle now has a product-shaped Electron route:
  `createElectronSteamOverlay(...)` installs a default Shift+Tab shortcut bridge
  that opens the verified Friends/chat presenter-backed web overlay instead of
  asking Steam to hook Chromium children. A 2026-06-28 `presenter-shortcut` run
  emitted shortcut-open and active/inactive overlay callbacks, captured visible
  Friends/chat UI, and returned to the smoke app after the close probe.
  Follow-up Deck Desktop runs with `--visual-close-input toggle` proved
  Shift+Tab-only close for managed profile and web shortcut targets, including
  `active=false`, focus return, and post-close parking at `currentFps=0`. A
  2026-06-29 focused fullscreen web shortcut run verified the smoke app now uses
  a static shortcut target plus `overlayShortcut.onOpen` for lifecycle logging:
  presenter diagnostics reported `targetType: "web"` and a sanitized target
  snapshot, then emitted shortcut-open, active/inactive callbacks, Shift+Tab-only
  close, focus return, and stable parked presenter state.
- A 2026-06-29 full Deck Desktop overlay matrix passed 26 cases with 52
  screenshots under App ID `480`, covering managed web, store, Friends, profile,
  players, community, stats, achievements, user chat, known dialog-equivalent
  routes, passive achievement-progress/unlock toasts, checkout readiness,
  synthetic checkout approval-route plumbing, `openAndWait` helpers, and managed
  Shift+Tab shortcut open/close. The matrix verified single overlay target
  attachment, active/inactive callbacks where expected, focus return, parked
  presenter state at `currentFps=0`, no post-close `pumpCount` increase for
  persistent presenter routes, and clean crash diagnostics.
- A generic `steam://open/overlay` URI is not a reliable shortcut around the
  unresolved raw social/toggle path. On Deck Desktop Mode it can emit an overlay
  activation callback while leaving the native presenter black and crashing the
  smoke process, so it should not become a public API strategy.
- Raw Deck Desktop social dialogs remain separate from the product proof. With
  Electron child-process isolation enabled, `ActivateGameOverlay("Friends")` /
  Game Overview may not render. With the reusable presenter and child isolation
  enabled, `ActivateGameOverlay("Achievements")` can render Steam's achievements
  panel through the main/native overlay target, but it does not emit
  `GameOverlayActivated` and does not return cleanly to the Electron app through
  generic close probes. With isolation disabled, Steam can hook Chromium children
  and render social UI but may leave stale overlay surfaces after close.
- Setting `SteamOverlayGameId` to the full non-Steam shortcut game ID is useful
  diagnostic coverage, but it is not a raw overlay fix. A Deck Desktop run
  proved `gameoverlayui` attached with the shortcut ID, while the hotkey/toggle
  path still failed to render overlay UI and the raw Achievements dialog still
  emitted no activation callback.
- Steam Bridge's macOS evidence is weaker: Steam launch and native probe coverage
  exist, and a Metal host path exists, but completed product overlay behavior on
  macOS is not proven yet.

Useful public references:

- Steam Overlay:
  https://partner.steamgames.com/doc/features/overlay
- `ISteamUtils::BOverlayNeedsPresent()`:
  https://partner.steamgames.com/doc/api/ISteamUtils
- Steam Microtransactions implementation:
  https://partner.steamgames.com/doc/features/microtransactions/implementation
- Electron transparent/click-through window behavior:
  https://www.electronjs.org/docs/latest/api/browser-window
- WebView2 overlay failure analysis:
  https://www.construct.net/en/blogs/ashleys-blog-2/trying-show-steam-overlay-1861
- Browser-based game overlay discussion:
  https://steamcommunity.com/discussions/forum/10/591756872987476379/
- Electron overlay regression report:
  https://github.com/electron/electron/issues/47662
- Steamworks.js overlay reports:
  https://github.com/ceifa/steamworks.js/issues/160
  https://github.com/ceifa/steamworks.js/issues/195
- Tauri overlay report:
  https://github.com/tauri-apps/tauri/issues/6196
- Native-presenter style reference implementation:
  https://github.com/ArtyProf/steamworks-ffi-node/blob/main/docs/STEAM_OVERLAY_INTEGRATION.md

## Design Direction

Build a Steam Bridge owned native overlay presenter:

```ts
const steamOverlay = client.overlay.createElectronSteamOverlay(mainWindow, {
  idleFps: 0,
  needsPresentFps: 30,
  activeOverlayFps: 30
});

await steamOverlay.openAndWait({
  type: "web",
  url: checkoutUrl,
  modal: true
});

await steamOverlay.openCheckoutAndWait(() =>
  backend.createSteamTransaction({ itemId: 100 })
);
```

The presenter should:

- be created early enough for Steam to hook a native graphics surface;
- stay attached to the Electron game window while the game is running;
- be transparent, non-focusable, and click-through during passive mode;
- follow Electron window moves, resizes, fullscreen changes, and visibility;
- present no frames or very few frames while idle;
- increase presentation only when `overlayNeedsPresent` is true or a Steam
  overlay is active;
- reuse the same surface for checkout, store, web, and passive Steam
  notifications;
- route overlay targets by behavior: interactive native host for web, store, and
  checkout; Friends List through a Steam web overlay surface; passive host
  pumping for notifications; raw social/dialog panels remain a separate
  investigation path;
- expose diagnostics so app code and tests can tell whether the presenter is
  attached, visible, passive, active, pumping, and recently touched by overlay
  callbacks; the managed Electron overlay snapshot also reports the selected
  presenter mode, automatic notification-priming policy, shortcut policy, and
  window-close ownership. The smoke verifiers can require those managed Electron
  fields so Deck/Linux runs fail if the wrong presenter mode, notification
  policy, or shortcut target is active.

This should replace app-owned overlay controllers. App builders should not need
to know whether the active platform uses X11/GLX, Metal, or another backend.

## Proposed Public API

Initial product-shaped API:

```ts
const steamOverlay = client.overlay.createElectronSteamOverlay(mainWindow);

steamOverlay.open({
  type: "web",
  url,
  modal: true
});

steamOverlay.open({ type: "friends" });
```

Near-term compatibility API:

```ts
client.overlay.activateToWebPageWithNativeSession(url, {
  ...steamworks.electronNativeOverlaySessionOptions(mainWindow),
  modal: true
});
```

The compatibility API should keep working while the presenter API matures. The
new API should eventually own the native surface lifecycle instead of creating a
fresh session per overlay action.

## Linux and Steam Deck Plan

Primary backend: X11/GLX.

Current evidence:

- Deck Desktop Mode can display and close a modal Steam web overlay over the
  bridge-owned GLX presenter.
- Deck Desktop Mode can do the same through the reusable app-facing presenter
  API (`createElectronSteamOverlay(...).open(...)`, backed by
  `openSteamOverlay`/`openWebOverlay`) while returning the host to transparent,
  click-through passive mode after overlay close. This proof uses
  `electronConfigureSteamOverlay()` child-process isolation so there is only one
  `gameoverlayui` target attached to the main/native process.
- The reusable presenter defaults to `idleFps: 0`, so an attached idle host polls
  overlay state without continuously presenting frames. It starts pumping only
  for operation-scoped activation holds, active overlays, lower-level explicit
  preparation, or `overlayNeedsPresent`. Passive notification priming now
  performs one presenter wake-up/poll and then waits for `overlayNeedsPresent`
  instead of entering a fixed high-FPS boost window.
- The managed Electron lifecycle waits are app-facing state waits, not tuning
  loops. `open(...)` and `openAndWait(...)` keep the presenter active until Steam
  reports the overlay shown; `openAndWait(...)`, `waitForOverlayShown()`,
  `waitForOverlayClosed()`, and `parkWhenSteamOverlayCloses()` resolve from Steam
  overlay callbacks and native presenter state changes in persistent presenter
  mode. App code can pass timeouts or abort signals, but not polling intervals.
- Native hosts realign to their parent window on each pump. The managed
  Electron overlay also listens to BrowserWindow move, resize, fullscreen,
  maximize, restore, and show events and triggers one native presenter pump per
  event, keeping geometry current without introducing an idle frame loop.
- Deck Desktop Mode can show passive achievement-progress and
  achievement-unlock toasts over the Electron smoke app through the reusable
  presenter path while the native host remains click-through and transparent,
  also with a single overlay target. The smoke app's toast routes now rely on
  the managed overlay's automatic passive notification priming instead of
  calling `prepareForNotification()` directly; that priming repolls immediately
  and pumps frames only after Steam reports `overlayNeedsPresent`. A
  2026-06-28 fullscreen unlock
  run selected `ACH_TRAVEL_FAR_ACCUM` (`Interstellar`), cleared and re-unlocked
  it, emitted `achievement:unlock`, `callback:user-stats-stored`, and
  `callback:achievement-stored`, captured the Steam unlock toast over the app,
  kept the app focused, and reported no crash evidence.
- Deck Desktop Mode can show the Steam Friends List / chat UI through
  `steamOverlay.open({ type: "friends" })`, backed by
  `openSteamOverlay({ type: "friends", presenter })`, which opens Steam
  Community chat through the reusable native web presenter, preserves Electron
  child-process isolation, uses one `gameoverlayui` target attached to the app's
  main/native process, and returns to the smoke app after the close probe. A
  `steam://open/friends` URI activated the overlay but remained on a Steam
  loading spinner, so it is not the product path. The smoke app also has
  `presenter-friends-open-and-wait`, which exercises
  `steamOverlay.openAndWait({ type: "friends" })` and requires the promise
  completion event only after Steam reports overlay inactive and the presenter
  parks.
- Deck Desktop Mode can open Steam profile pages through
  `steamOverlay.open({ type: "profile", steamId64 })`, backed by
  `openProfileOverlay({ steamId64, presenter })`. A 2026-06-28 Deck Desktop run
  opened the current user's Steam Community profile through the reusable native
  web presenter, emitted active then inactive overlay callbacks, returned focus
  to the Electron smoke app through the web close probe, used one
  `gameoverlayui` target attached to the app's main/native process, and parked
  transparent/click-through at `currentFps=0` with stable `pumpCount`.
- Steam Bridge has a product-shaped Players route through
  `steamOverlay.open({ type: "players", steamId64 })`, backed by
  `openPlayersOverlay({ steamId64, presenter })`, which opens the Steam
  Community players page through the reusable native web presenter. A
  2026-06-28 Deck Desktop run captured visible Steam Community players content,
  emitted active then inactive overlay callbacks, returned focus to the Electron
  smoke app through the web close probe, used one `gameoverlayui` target
  attached to the app's main/native process, and parked transparent/click-through
  at `currentFps=0` with stable `pumpCount`.
- Deck Desktop Mode has app-facing
  `steamOverlay.open({ type: "community", appId })` /
  `steamOverlay.open({ type: "stats", appId })` routes and lower-level
  `openCommunityOverlay({ appId, presenter })` /
  `openStatsOverlay({ appId, presenter })` helpers that follow the same
  presenter-backed web path for the raw `Community` and `Stats` dialog use
  cases. A 2026-06-28 Deck Desktop run verified both with visible Steam web
  content, active overlay callbacks, and clean return to the app through the web
  close probe.
- Deck Desktop Mode can open the current user's app achievements/profile web
  page through `steamOverlay.open({ type: "achievements", appId })` or
  `openAchievementsOverlay({ appId, presenter })`, preserving the same
  single-overlay-target and close/back-to-app behavior. App ID `480` redirects
  to the user's profile because Steam Community does not expose a public web
  stats page for it.
- The high-level `openSteamOverlay({ type: "dialog", dialog })` router maps
  known Desktop dialog names to presenter-backed web equivalents:
  `Friends`, `Players`, `Community`, `OfficialGameGroup`, `Stats`, and
  `Achievements`. `route: "native"` keeps raw `ActivateGameOverlay(...)` dialog
  behavior available for diagnostics, and unsupported auto dialog names throw
  instead of silently falling back to raw Steam overlay behavior. The smoke app's
  `presenter-dialog` action uses that native route explicitly. The smoke app's
  `presenter-dialog-auto` action exercises the high-level router as a
  product-path proof. A 2026-06-28 Deck Desktop full matrix verified
  `presenter-dialog-auto --dialog Friends`, `Players`, `Community`,
  `OfficialGameGroup`, `Stats`, and `Achievements`; each route showed visible
  Steam web content through the native overlay host, emitted active then
  inactive overlay callbacks, used one `gameoverlayui` target for App ID `480`,
  returned focus to the Electron app through the web close probe, parked
  transparent/click-through at `currentFps=0`, and showed no post-close pumping
  or crash evidence.
- The high-level user-dialog router maps the common web-backed cases through the
  presenter by default: `steamid`/`profile`, `chat`, `stats`, and
  `achievements`. `chat` opens the same Steam Community chat/Friends surface as
  the verified Friends List route. A 2026-06-29 focused Deck Desktop fullscreen
  run of `presenter-user --user-dialog chat` emitted active/inactive callbacks,
  captured visible Steam chat/Friends content, returned focus to the Electron
  app, used one `gameoverlayui` target, parked at `currentFps=0` with stable
  `pumpCount`, and reported no crash evidence. Native-only prompt actions such
  as trade join and friend request dialogs remain available only through
  `route: "native"` for explicit raw diagnostics.
- The managed Electron shortcut bridge is the product keyboard-toggle path:
  `createElectronSteamOverlay(mainWindow)` listens for Shift+Tab in Electron and
  opens `steamOverlay.open({ type: "friends" })` by default, with
  `overlayShortcut: false` and `overlayShortcut.target` available for apps that
  need to opt out or choose another presenter-backed target. A 2026-06-28 Deck
  Desktop `presenter-shortcut` run proved visible overlay open, active/inactive
  callbacks, and return to the app after close. The smoke app and Deck
  runner now expose `--shortcut-target` for focused shortcut proofs of other
  presenter-backed targets. The bridge consumes Shift+Tab only while opening a
  managed target; once Steam reports an active overlay, it lets Shift+Tab pass
  through so Steam can handle close/toggle. A
  focused fullscreen run with
  `presenter-shortcut --shortcut-target web --web-modal true` waited for
  lifecycle evidence of shortcut-open and active overlay events before capturing
  the opened Steam web overlay over the fullscreen app, emitted active then
  inactive overlay callbacks, returned focus to Electron after the close probe,
  and parked at
  transparent/click-through `currentFps=0` with no post-close pumping.
  Separate `presenter-shortcut --shortcut-target profile` and
  `presenter-shortcut --shortcut-target web --web-modal true` Deck Desktop runs
  used `--visual-close-input toggle`, sending only the second Shift+Tab for
  close, and passed the same active=false, focus-return, and idle-parking
  verifier. A 2026-06-29 web shortcut run also proved the cleaner static-target
  path: `overlayShortcut.target` reported sanitized web target metadata while
  `overlayShortcut.onOpen` recorded `overlay:shortcut-open`, avoiding target
  resolver side effects for normal shortcut diagnostics.
- The Deck close verifier no longer uses fixed post-close sample delays. A
  2026-06-28 Deck Desktop core matrix passed 15 cases with 30 screenshots after
  switching `overlay:presenter-after-close` and
  `overlay:presenter-after-close-stable` to presenter state-change samples; the
  web-modal proof recorded both parked samples with unchanged `pumpCount` and
  `currentFps=0`. The 2026-06-29 full matrix also hardened the visual close
  probe itself: presenter-backed web surfaces get one Steam web close-control
  click, the runner waits for lifecycle evidence of `active=false`, KWin
  overview/window-switcher effects are cleared before that click when active,
  and the verifier rejects any overlay reactivation after the close probe.
- The same path is good enough for checkout-style proof when launched under a
  real installed Steam app with a configured product or transaction. The public
  API now has a one-call checkout wrapper:
  `steamOverlay.openCheckoutAndWait(() => startTxn())` primes the presenter
  before an in-game `InitTxn`, accepts common backend result shapes such as
  `steamurl`, `steamUrl`, `transactionId`, or `transid`, opens the checkout
  surface under the same scoped activation hold, then resolves after Steam
  closes and the presenter parks. App code can still use
  `withCheckoutPrepared(...)`, `open({ type: "checkout", ... })`,
  `openAndWait(...)`, or the lower-level wait helpers when it needs split-step
  control, instead of carrying local callback/timer plumbing. In default
  persistent presenter mode these waits resolve from Steam Bridge's overlay
  callback and presenter state changes, with timeouts kept as guardrails and
  managed Electron activation/grace durations defaulting to zero.
  The smoke app's `presenter-checkout` action now exercises that exact
  checkout helper when a checkout URL or transaction ID is provided, and records
  `overlay:presenter-checkout-open-and-wait-complete` after
  `GameOverlayActivated(false)` and presenter parking.
  `prepareForCheckout()` remains as the lower-level split-step escape hatch.
  `MicroTxnAuthorizationResponse` is
  treated as an authorization
  event, not an overlay-close signal; the smoke app records the presenter
  snapshot on `callback:microtxn` so real-app purchase proof can show the native
  presenter remained available through authorization and parked only after Steam
  emitted overlay inactive. A 2026-06-28 Deck Desktop prepare-only run verified
  checkout readiness returns to passive idle, and a synthetic
  transaction approval URL run verified checkout-style open, close, app focus,
  no crash evidence, and no post-close pumping without committing private app
  details.
- Deck Desktop Mode does not yet have a passing raw Steam hotkey/Guide toggle proof. Focused
  `--visual-toggle-probe` evidence for raw Steam hotkey interception after
  passive-presenter toast runs stayed in the Electron app and did not emit
  `GameOverlayActivated` for either Shift+Tab or a controller-shaped virtual
  Guide/Steam-button uinput device. The virtual Guide path can move
  `overlayNeedsPresent` to `true`, but it has not rendered overlay UI, so raw
  Steam hotkey/Guide support remains unresolved. The same probe with
  `SteamOverlayGameId` set to the full non-Steam shortcut game ID attached
  Steam's overlay renderer to that shortcut ID but still did not open visible
  overlay UI.
- Electron-only social overlay can render only when Electron child overlay
  targets are allowed. A Deck Desktop diagnostic run with child env scrubbing and
  `no-zygote` isolation disabled produced visible Steam desktop overlay UI and
  `active=true` from the raw `dialog` action, with `gameoverlayui` attached to
  Electron's GPU process. The same run did not close from Shift+Tab/Escape or an
  X-click probe, so this is not a pass. Reusable presenter dialog activation
  remains an investigation path, not product proof: when children are isolated it
  does not render or emit active=true; when children are unisolated it creates
  duplicate `gameoverlayui` targets for the GPU child and main/native process and
  still fails close/back-to-app proof. A focused/raised X11 host experiment did
  not make `ActivateGameOverlay("Friends")` render or emit an activation
  callback, so do not promote host focus handoff into the presenter API as a raw
  social-dialog fix. Making the dialog host opaque/input-capable like the
  web/store path only exposes a black presenter surface and still does not
  activate Steam social UI, so opacity handoff is also not a social-overlay fix.

Linux/Deck implementation checklist:

The first six items below describe the implemented Deck Desktop product path:
the persistent X11/GLX presenter, passive mode, adaptive pumping, geometry sync,
session fallback, and Electron child-process isolation. Keep them here as the
design checklist for regression review. The current Deck Desktop product path is
the managed presenter route plus the managed `overlayShortcut` bridge. Raw Steam
hotkey/Guide interception and raw social/Game Overview dialogs remain explicit
investigation paths until they can open, close, and return to the app without
duplicate child overlay targets.

1. Promote the current X11/GLX probe into a persistent presenter object.
2. Add passive mode:
   - transparent background;
   - click-through input region;
   - non-focusable window hints;
   - attached/transient relationship to the Electron game window;
   - idle frame budget of zero or near-zero.
   - On Linux/X11, fully idle mode currently uses an empty XFixes input shape
     and `_NET_WM_WINDOW_OPACITY=0`; `overlayNeedsPresent` can restore opacity
     while leaving input click-through for passive notifications; active overlay
     mode restores both input and opacity so Steam UI can receive clicks.
   - When Steam emits `GameOverlayActivated(false)`, park the host transparent
     even if `overlayNeedsPresent` lingers so stale modal surfaces do not remain
     over the app.
3. Add an adaptive pump scheduler:
   - idle: no fixed 30 FPS loop;
   - `overlayNeedsPresent=true`: pump around 30 FPS;
   - `GameOverlayActivated(true)`: pump around 30 FPS;
   - `GameOverlayActivated(false)`: return to passive from the callback/state
     transition, with no default grace timer in the managed Electron path.
4. Track resize/fullscreen state every pump and through window events where
   available.
   - Native X11/GLX and macOS hosts already realign during pump, and the managed
     Electron overlay now repumps once for BrowserWindow move, resize,
     fullscreen, maximize, restore, and show events without adding a continuous
     timer.
5. Keep the presenter kill switch covered:
   - `createElectronSteamOverlay(..., { presenterMode: "session" })` and
     `STEAM_BRIDGE_DISABLE_ELECTRON_OVERLAY_PRESENTER=1` disable the reusable
     persistent presenter and lazily fall back to the older native-session
     lifecycle while preserving the same `steamOverlay.open(...)` app-facing
     calls.
   - The Electron smoke app and Linux/Deck helpers expose the same switch as
     `STEAM_BRIDGE_SMOKE_PRESENTER_MODE` / `--presenter-mode session` so
     comparison runs do not require manual Steam shortcut edits.
   - Treat this as emergency diagnostics or compatibility comparison; the
     default persistent presenter remains the Deck Desktop product path because
     it parks idle at `currentFps=0`.
6. Keep Electron child overlay targets isolated for product proofs:
   - scrub Steam overlay renderer entries from `LD_PRELOAD` /
     `DYLD_INSERT_LIBRARIES` before Electron spawns children;
   - on Linux, use Electron's `no-zygote` switch so Chromium children exec
     clean instead of forking the already-loaded Steam overlay library;
   - assert Deck proofs have one `gameoverlayui` process for the app.
7. Re-run checkout proof:
   - generic App ID `480` for public plumbing where possible;
   - a real app/product only for private purchase proof;
   - require `callback:microtxn` diagnostics to include presenter state during
     real purchase authorization;
   - keep private app IDs, item definitions, transaction IDs, and URLs out of
     committed files.
8. Treat Wayland as a later backend unless Steam/Electron are running through
   Xwayland. The managed presenter, and the session fallback when it opens, now
   fail before native attachment on Linux when `DISPLAY` is missing, with an
   explicit X11/Xwayland diagnostic; Wayland-only and headless sessions are not
   a supported overlay host yet.

Pass criteria:

- Steam launch, overlay injection, and `overlayEnabled=true`.
- One Steam overlay target for product overlay proofs: no competing
  `gameoverlayui` process attached to Electron's GPU/renderer children.
- Presenter attached and passive without stealing focus.
- App receives pointer/keyboard/controller input while presenter is passive.
- Achievement-progress and achievement-unlock notification toasts appear over
  the app through the passive presenter without modal overlay activation.
- Friends List opens through `openFriendsOverlay`, accepts input, closes, and
  returns to the app without duplicate Electron child overlay targets.
- Community and Stats open through `openCommunityOverlay` and
  `openStatsOverlay`, accept input, close through the Steam web close control,
  and return to the app without duplicate Electron child overlay targets.
- Achievements/profile web overlay opens through `openAchievementsOverlay`,
  accepts input, closes, and returns to the app without duplicate Electron child
  overlay targets. Full achievements content proof requires an app whose Steam
  Community stats page is exposed.
- User dialog equivalents for `steamid`/profile, `chat`, `stats`, and `achievements`
  route through `openUserOverlay` / `steamOverlay.open({ type: "user", ... })`
  by default; `chat` uses the verified Steam Community chat/Friends surface.
  Native-only prompt-style user dialogs remain explicit raw diagnostics through
  `route: "native"`.
- Store pages open through `openStoreOverlay` / `steamOverlay.open({ type:
  "store", appId })`, accept input, close through the Steam web close control,
  and return to the app without duplicate Electron child overlay targets.
- High-level `dialog` targets for Friends, Players, Community,
  OfficialGameGroup, Stats, and Achievements route to the same
  presenter-backed web equivalents by default and pass the same open, close,
  back-to-app, no-crash, and no-post-close-pumping checks. Raw native dialog
  activation remains explicit diagnostic behavior.
- The managed Electron Shift+Tab shortcut opens a presenter-backed overlay,
  closes through the Steam web close control, returns to the app, and is
  machine-verified through `overlay:shortcut-open`, active/inactive callbacks,
  app focus, and post-close crash diagnostics. The shortcut target can be
  changed by app code, and the smoke runner can prove non-default targets with
  `--shortcut-target`.
- Modal web/store/checkout overlay opens, accepts input, closes, emits active then
  inactive callbacks, and returns to the app.
- Deck visual close probes for presenter-backed product web surfaces verify the
  inactive callback, app focus, state-driven post-close presenter parking, no
  post-close pumping, managed wait-helper shown/closed/parked lifecycle events,
  no post-close crash evidence, and no overlay reactivation after the close
  probe.
- Post-close presenter parking means the reusable host is transparent,
  click-through, non-focusable, overlay-inactive, and back at `currentFps=0`.
- Post-close no-pumping means the stable presenter snapshot has the same
  `pumpCount` as the first parked snapshot after overlay close.
- No crash dumps from Electron or the native binding, and no fatal Electron
  lifecycle events in the smoke diagnostics.
- No sustained 30 FPS pumping while idle.
- The session fallback is available as a kill switch without changing app
  overlay call sites, and the smoke runners can select it with
  `--presenter-mode session`, but it is documented as diagnostic coverage
  rather than the default product path. Session-mode runner checks do not assert
  persistent-host single-target, idle-parking, or no-post-close-pump invariants
  because the fallback opens lazily and may pump while a session exists.

## macOS Apple Silicon Plan

Primary backend: Metal host window. OpenGL can remain as a diagnostic fallback,
but Metal should be the product path.

Current evidence:

- Steam Bridge can create a macOS native presenter/probe.
- A Metal host implementation exists and can attach above an Electron window.
- BrowserWindow-only overlay support is not proven.
- Steam launch, app ID, auth, and callbacks are not enough to claim overlay
  support.

Next work:

1. Make the Metal presenter the default macOS host path for Apple Silicon.
2. Keep the host borderless, transparent, click-through, and unable to become key
   or main.
3. Attach it as a child/auxiliary window above the Electron game window and keep
   it aligned during move, resize, fullscreen, display scale, and space changes.
4. Add passive mode and adaptive pumping like Linux:
   - idle: no steady render loop;
   - `overlayNeedsPresent` or active overlay: present around 30 FPS;
   - after Steam reports overlay inactive: return to passive without a default
     grace timer.
5. Add screen-lock/display-sleep awareness so the presenter does not open into a
   black or invalid state while the user cannot interact.
6. Keep code signing requirements explicit in docs and examples. Local smoke
   signing is not enough to claim shipped macOS overlay support.
7. Prove the same three behaviors on Apple Silicon:
   - passive Steam notification/toast;
   - modal web/checkout overlay;
   - close/back-to-app without focus loss or stuck overlay UI.

Pass criteria:

- Steam launch preserves overlay injection into the shipped app process.
- `overlayEnabled=true` with the native presenter path.
- Passive presenter does not steal focus, input, or visible pixels.
- Notification/toast appears over the app.
- Web/checkout overlay opens and closes with active/inactive callbacks.
- No sustained high-FPS idle rendering.

Unsupported for now:

- Intel macOS. The project target is Apple Silicon macOS only.

## Windows Position

Windows should stay in the verification matrix, but it should not drive this
design. If the ordinary Electron overlay path works on Windows, keep it as the
default there and use the presenter only if a future regression proves it is
needed.

Windows gates:

- existing Electron overlay path still passes;
- native package still loads;
- checkout/web/store overlay smoke checks do not regress.

## Presenter Diagnostics

Presenter diagnostics should be machine-readable:

```ts
{
  attached: boolean;
  backend: "x11-glx" | "macos-metal" | "macos-opengl" | "none";
  mode: "passive" | "active" | "hidden" | "closed";
  clickThrough: boolean;
  focusable: boolean;
  transparent: boolean;
  bounds: { x: number; y: number; width: number; height: number };
  idleFps: number;
  activeFps: number;
  pumpCount: number;
  lastPumpAt?: number;
  overlayActive: boolean;
  overlayNeedsPresent: boolean;
  lastOverlayEvent?: unknown;
  lastError?: unknown;
}
```

Keep the current `getOverlayDiagnostics()` fields and add presenter diagnostics
beside them instead of replacing them. Snapshots now include the selected
`backend` (`x11-glx`, `macos-metal`, `macos-opengl`, or `none`) so Deck,
Linux, macOS, and fallback artifacts can assert which native host path is in
use without scraping logs. Snapshots also include `bounds` when Electron's
`BrowserWindow.getBounds()` or a lower-level bounds provider is available, so
Deck/Linux/macOS artifacts can verify presenter alignment without scraping logs.

## Milestones

1. Document the plan and keep existing session helpers intact.
2. Ship the reusable presenter lifecycle and Electron manager API
   (`createElectronSteamOverlay(...).open(...)`) as the app-facing path.
3. Keep lower-level `attachPresenter(...)` and native-session helpers for
   diagnostics and compatibility.
4. Harden Linux X11/GLX passive mode and verify on Steam Deck Desktop Mode.
   The current Deck Desktop matrix proof is green for managed presenter-backed
   product routes; keep rerunning it as regression coverage while macOS is
   brought up.
5. Verify Linux passive achievement/toast behavior.
6. Verify Linux checkout/web close and back-to-app behavior with the managed
   persistent presenter.
7. Harden macOS Apple Silicon Metal passive mode.
8. Verify macOS passive notification/toast behavior.
9. Verify macOS checkout/web close and back-to-app behavior.
10. Promote the presenter API from experimental to recommended only after both
    Linux/Deck and macOS Apple Silicon meet the pass criteria.

## Non-Goals

- Do not commit private app IDs, item definitions, publisher keys, transaction
  IDs, or private purchase URLs.
- Do not require app builders to copy an app-specific native overlay controller.
- Do not claim generic purchase support from App ID `480`; purchase and economy
  proof requires the real app and configured products.
- Do not keep a high-FPS transparent surface running forever while idle.
- Do not treat callback-only social overlay behavior as visual close/back-to-app
  proof.
