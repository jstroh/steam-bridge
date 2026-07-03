# Native Overlay Presenter Plan

Last updated: 2026-07-03

This is the forward plan for reliable Steam overlay behavior in Electron apps on
Linux/Steam Deck, macOS, and Windows. Windows direct-hook behavior is still
useful as a regression baseline, but current Electron 43 testing on the Windows
laptop shows it is not safe to treat that baseline as product-ready until it can
prove visible overlay UI, close/back-to-app behavior, and clean crash
diagnostics.

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
- Windows wrapper history points to the same tradeoff from another angle:
  `--in-process-gpu` can make Steam hook Chromium's main process, but modern
  Chromium/Electron/NW.js builds can turn that path into a blank window; disabling
  DirectComposition can make the app visible on some machines, but it carries
  ghost-window and close/focus regression risk and must remain diagnostic until
  the matrix proves otherwise.
- A July 2, 2026 Windows laptop pass captured the split directly: the default
  in-process-GPU path produced a blank smoke window, while a DirectComposition-off
  comparison rendered the app but showed only Steam overlay activation/dim-toast
  evidence without visible Friends/web UI or close/back-to-app completion. That
  moves a bridge-owned Windows native presenter from fallback research to the
  next serious implementation candidate, while keeping the app-facing
  `createElectronSteamOverlay(...)` API unchanged.

## Windows Source Sweep

Reviewed on 2026-07-02 while investigating Windows Electron overlay failures:

| Source | Relevant signal for Steam Bridge |
| --- | --- |
| [Valve Steam Overlay docs](https://partner.steamgames.com/doc/features/overlay) | Steam expects a supported native graphics API surface and needs `SteamAPI_Init` before the renderer device is created; Valve also says browser-based games are a hard case because the overlay needs steady presents from the rendered surface. |
| [Valve `ISteamUtils::BOverlayNeedsPresent`](https://partner.steamgames.com/doc/api/ISteamUtils#BOverlayNeedsPresent) | Event-driven renderers may need explicit presents for overlay notifications, but this should be demand-driven rather than a fixed repaint loop. |
| [Electron offscreen rendering docs](https://www.electronjs.org/docs/latest/tutorial/offscreen-rendering) | Electron can provide frames as bitmaps or shared GPU textures, but idle pages stop producing frames; any native presenter must keep main-game FPS healthy and avoid unnecessary capture/present work. |
| [Construct WebView2 overlay investigation](https://www.construct.net/en/blogs/ashleys-blog-2/trying-show-steam-overlay-1861) | Browser runtimes push graphics work into GPU/WebView processes; `--in-process-gpu` can explain why Chromium wrappers sometimes work, but relying on process-model tricks is brittle. |
| [Electron overlay issue #3340](https://github.com/electron/electron/issues/3340) | Historical Electron + Steam overlay failures match the two local failure modes: overlay not visible or input delivered to the browser window behind it. |
| [Electron `--in-process-gpu` issue #18048](https://github.com/electron/electron/issues/18048) | Windows Electron can show only a white window with `--in-process-gpu`, matching the local render-health probe and making that flag a diagnostic control, not a product default. |
| [Electron Windows GPU regression #32440](https://github.com/electron/electron/issues/32440) | Blank windows and repeated GPU-process crashes exist across Windows graphics configurations, so Steam Bridge tests must collect renderer/GPU crash diagnostics instead of assuming a Steam API failure. |
| [steamworks.js ghost-window issue #95](https://github.com/ceifa/steamworks.js/issues/95) | `disable-direct-composition` can interact with Alt+Tab and ghost-window behavior; keep it opt-in/diagnostic until the matrix proves close/focus behavior. |
| [steamworks.js white-overlay issue #116](https://github.com/ceifa/steamworks.js/issues/116) | Even wrappers that set known Chromium flags still report white Steam overlay surfaces on newer Electron, reinforcing the need for visual proof and screenshots. |
| [steamworks.js Linux Electron issue #195](https://github.com/ceifa/steamworks.js/issues/195) | Cross-platform Electron reports show Shift+Tab/screenshots can fail even when Steamworks loads, so overlay route success must be proven per platform, not inferred from native API load. |
| [NW.js overlay issue #4982](https://github.com/nwjs/nw.js/issues/4982) | The same Chromium-family GPU-process split has affected Steam overlay injection outside Electron for years. |
| [NW.js `--in-process-gpu` instancing issue #6059](https://github.com/nwjs/nw.js/issues/6059) | `--in-process-gpu` can create process-lifetime and launch failures when started through Steam or other launchers, so Steam Bridge should avoid building its Windows product path around it. |
| [NW.js video issue #7550](https://github.com/nwjs/nw.js/issues/7550) | The flag needed by some apps for Steam overlay can break normal media behavior, another reason to keep Chromium flag profiles behind explicit diagnostics. |
| [Greenworks / NW.js v0.103.1 overlay issue #349](https://github.com/greenheartgames/greenworks/issues/349) | A maintained Chromium-wrapper issue reports the same current-era failure: `--in-process-gpu` was historically required for Steam overlay but newer NW.js blanks the app, so version-specific smoke proof matters more than cargo-culting old launch flags. |
| [Electron 35 overlay regression #47662](https://github.com/electron/electron/issues/47662) | Newer Electron releases can regress Steam overlay behavior even after a previously working version, so the Windows lane needs package-versioned smoke artifacts rather than version assumptions. |
| [Tauri/WebView2 overlay issue #6196](https://github.com/tauri-apps/tauri/issues/6196) | The WebView2/Tauri route shows the same process-model problem outside Electron: a Steamworks call can be valid while the rendered web surface is not the hook target Steam needs. |
| [Steam Community browser-overlay request](https://steamcommunity.com/discussions/forum/10/591756872987476379/) | Public browser-runtime reports group Electron, NW.js, CEF, WebView2, and WKWebView together as unsupported or unreliable Steam overlay targets, reinforcing the bridge-owned native-surface direction. |
| [Steamworks `ISteamFriends` overlay docs](https://partner.steamgames.com/doc/api/isteamfriends) | The raw Steam overlay APIs can open store, web, friends, and user/dialog routes, but Steam Bridge must still prove each route's visible UI, input, close, and focus-return behavior on each platform. |
| [Steam microtransaction implementation guide](https://partner.steamgames.com/doc/features/microtransactions/implementation) | Real checkout is Steam overlay-driven after `InitTxn`, so the presenter must remain alive through the authorization flow and cannot equate a microtransaction callback with overlay close. |
| [Chromium DirectComposition change](https://groups.google.com/a/chromium.org/g/ozone-reviews/c/iihF5rPWLJ8) | `--disable-direct-composition` is a real Chromium switch for disabling DirectComposition, but it changes a core Windows composition path and must be treated as a compatibility experiment. |
| [Microsoft DirectComposition concepts](https://learn.microsoft.com/en-us/windows/win32/directcomp/basic-concepts) | DirectComposition is bitmap/DXGI-content composition, not a magic overlay route; it can be a diagnostic layer, but a product presenter still has to prove Steam's injected renderer, alpha behavior, input, close, and focus return. |
| [Microsoft DXGI Session 0 note](https://learn.microsoft.com/en-us/windows/win32/api/dxgi/nf-dxgi-idxgifactory-createswapchain) | `DXGI_ERROR_NOT_CURRENTLY_AVAILABLE` from Session 0 is expected for swap-chain creation; Windows live overlay tests must launch in the interactive desktop session. |
| [Microsoft Raw Input registration docs](https://learn.microsoft.com/en-us/windows/win32/api/winuser/nf-winuser-registerrawinputdevices) | Raw input delivery is opt-in, and only one window per raw-input device class can be registered in a process; any Windows presenter input mitigation must not steal ownership from the app window. |
| [Steamworks.NET overlay FAQ](https://steamworks.github.io/faq/) | The injection-order rule is not Electron-specific: the overlay must be injected before the renderer initializes, and running through Steam is the reliable development shape. |
| [steamworks-ffi-node native overlay guide](https://github.com/ArtyProf/steamworks-ffi-node/blob/main/docs/STEAM_OVERLAY_INTEGRATION.md) | Independent wrapper research points at native Metal/OpenGL host surfaces, but Steam Bridge still requires its own FPS, shutdown, focus, close, and crash matrix before making a Windows native presenter default. |

- Steam Bridge now has opt-in Windows native presenter candidates behind the
  existing native surface API: `backend: "windows-opengl"` creates the Win32/WGL
  diagnostic surface, and `backend: "windows-d3d11"` creates a D3D11/DXGI
  swap-chain surface for the next live comparison. Neither is the default
  Windows path yet; the ordinary direct Electron hook remains the baseline until
  live Windows matrix proof shows a native presenter is better across visible
  UI, close/back-to-app, passive notifications, FPS/focus behavior, and crash
  diagnostics.
- A 2026-07-03 UTC focused Windows D3D11 pass proved passive
  achievement-progress and achievement-unlock notifications through the same
  managed Electron presenter shape. The Steam-launched App ID `480` artifacts
  `windows-d3d11-passive-progress-exact-20260702-193629` and
  `windows-d3d11-passive-unlock-exact-20260702-193629` both passed the Windows
  matrix summary auditor, accepted the Steam achievement event
  (`indicated=true` / `activated=true`), emitted no modal overlay activation,
  kept the D3D11 native host open in passive transparent/click-through mode, and
  parked at `overlayNeedsPresent=false` and `currentFps=0` with clean crash
  diagnostics. These non-modal notification proofs intentionally allow
  `overlayEnabled=false`; the contract is Steam acceptance plus passive
  presenter state, not modal overlay readiness.
- The broader Windows source sweep points past window-style tweaks. Valve's
  browser-game FAQ specifically names a native D3D window with offscreen
  Chromium and input forwarding, while the WebView2/DirectComposition research
  shows why a composited transparent layer can render Steam overlay content but
  still fail on alpha/input details. The next serious Windows implementation
  comparison is therefore the opt-in D3D11/DXGI presenter beside the existing
  WGL diagnostic, not another default Chromium flag profile.
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
- macOS Apple Silicon now has the same builder-facing wait proof for modal web,
  store, Friends/chat, and dialog-equivalent routes. A 2026-06-29 full
  Steam-launched matrix at
  `/tmp/steam-bridge-macos-overlay-matrix-full-current-20260629-181707`
  passed 20 cases through the in-bundle native launcher with the current
  packaged helper-level presenter checks: web/store/Friends/dialog
  `openAndWait(...)`, passive achievement progress/unlock toasts, synthetic
  checkout approval-route plumbing, managed Shift+Tab shortcut open/close,
  profile, community, stats, achievements, user chat/profile, and known dialog
  equivalents. Interactive cases emitted active/inactive callbacks, returned the
  smoke app frontmost after close, completed waits only after close and parking,
  kept the parked presenter at `currentFps=0` without advancing `pumpCount`, and
  reported no crash evidence. The stable Steam shortcut was already up to date,
  so this run did not update the shortcut or require a Steam restart.
- The macOS smoke helper has a passive-toast-specific verification gate.
  `--require-passive-notification` requires result and lifecycle evidence for
  the achievement event and Steam callback, rejects modal overlay activation, and
  checks the passive managed-presenter snapshot. The 20-case matrix above passed
  that gate for both progress and unlock toasts.
- The macOS proof flow now has a matrix runner. `scripts/macos-overlay-matrix.sh`
  can dry-run or execute Steam-launched helper cases, installs or updates one
  stable non-Steam shortcut that points at the in-bundle native launcher and a
  launcher env file, restarts Steam only when that shortcut materially changes,
  and writes per-case launch state through the env file. It collects diagnostics
  for web/store/Friends/dialog wait routes, passive toasts, synthetic checkout
  approval-route plumbing, managed shortcut routing, and common presenter-backed
  web targets. Its self-test keeps the matrix shape covered in package smoke.
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
- A 2026-06-29 core macOS matrix at
  `/tmp/steam-bridge-macos-overlay-matrix-core-shortcut-targets-20260629-184303`
  expanded that managed shortcut proof into regular macOS coverage for
  Friends/chat, modal web, and store targets. The artifact summary now reads the
  expected shortcut target from each case manifest and rejects mismatches in the
  `overlay:shortcut-open` lifecycle payload or `overlayShortcut.targetType`
  presenter snapshot. The same 15-case run re-verified the core macOS overlay
  surface set with active/inactive callbacks, focus return, zero managed timing,
  parked idle presenter state, and clean crash diagnostics.
- A later 2026-06-29 core macOS matrix at
  `/tmp/steam-bridge-macos-overlay-matrix-core-players-20260629-185333`
  added direct high-level `presenter-players` coverage to the regular macOS
  suite. The 16-case artifact passed the same Steam launch/injection,
  active/inactive callback, active shown presenter, focus return, zero managed
  timing, parked idle presenter, and crash-diagnostic gates as the other
  presenter-backed community surfaces.
- A 2026-06-29 core macOS matrix at
  `/tmp/steam-bridge-macos-overlay-matrix-core-openwait-expanded-20260629-190754`
  upgraded the regular profile, players, community, stats, achievements, and
  user chat cases to managed `openAndWait(...)` actions. The 16-case artifact
  reports `openAndWait=true` for every interactive presenter-backed product
  route in the core suite, proving completion after Steam emits `active=false`
  and after the presenter parks, not merely initial activation.
- A 2026-06-29 full macOS matrix at
  `/tmp/steam-bridge-macos-overlay-matrix-full-dialog-openwait-20260629-195732`
  passed 23 Steam-launched App ID `480` cases after upgrading the full dialog
  equivalent loop to managed `openAndWait(...)`. The run verified
  web/store/Friends/dialog, profile, players, community, stats, achievements,
  user chat, user SteamID, and every known high-level dialog-equivalent route
  through managed wait helpers; passive progress/unlock toasts; synthetic
  checkout approval-route plumbing; and Shift+Tab shortcut open/close for
  Friends, web, and store targets. The artifact summary passed with
  active/inactive callbacks where expected, active shown presenter snapshots,
  one `gameoverlayui` target, app focus return, parked idle state at
  `currentFps=0` after close, no post-close pumping, zero managed overlay
  timing, interactive macOS host state, and clean crash diagnostics.
  Success matrices also preflight `getMacOverlayEnvironment()` and stop before
  case launch if the session is not interactive.
- A later 2026-06-29 core macOS matrix at
  `/tmp/steam-bridge-macos-overlay-matrix-core-shortcut-checkout-20260629-201942`
  expanded managed Shift+Tab shortcut proof to the synthetic checkout approval
  route. The 17-case Steam-launched run covered Friends, web, store, and
  checkout shortcut targets; the checkout shortcut opened
  `steamOverlay.open({ type: "checkout", transactionId })` through the managed
  shortcut bridge, emitted active/inactive callbacks, closed through the second
  Shift+Tab, returned focus to the app, parked at `currentFps=0` without
  post-close pumping, and passed crash diagnostics. This remains public App ID
  `480` approval-route plumbing, not real purchase-content proof.
- A later 2026-06-29 core macOS matrix at
  `/tmp/steam-bridge-macos-overlay-matrix-core-all-shortcuts-20260629-203243`
  expanded the same managed Shift+Tab proof to every supported presenter-backed
  shortcut target: Friends, modal web, store, checkout approval route, profile,
  players, community, stats, achievements, user chat, and the dialog-equivalent
  router. The 24-case Steam-launched run passed with active/inactive callbacks
  where expected, second-Shift+Tab close for every shortcut target, one
  `gameoverlayui` target under App ID `480`, app focus return, parked idle
  presenter state at `currentFps=0`, no post-close pumping, zero managed overlay
  timing, an interactive macOS host environment, and clean crash diagnostics.
- A signed-package macOS full matrix at
  `/tmp/steam-bridge-macos-overlay-matrix-full-signed-package-20260629-234357`
  rebuilt and signed the smoke package, then passed 31 Steam-launched App ID
  `480` cases with the native launcher as the bundle executable and both the
  launcher and renamed Electron executable ad-hoc signed with the Steam overlay
  entitlements. The run re-verified managed web/store/Friends/dialog wait
  routes, passive achievement progress/unlock toasts, checkout approval-route
  plumbing, every supported presenter-backed Shift+Tab target, direct
  profile/players/community/stats/achievements/user wait routes, user SteamID,
  every high-level dialog-equivalent route, close/back-to-app proof, zero
  managed overlay timing, one `gameoverlayui` target, interactive macOS host
  state, and clean crash diagnostics.
- A 2026-06-30 core macOS matrix at
  `/tmp/steam-bridge-macos-overlay-matrix-core-shortcut-focus-electron42-20260630-010009`
  reran the 24-case core suite on Electron `42.5.1` after hardening the macOS
  Shift+Tab shortcut fallback. The fallback now reasserts Electron window focus
  only after `waitForOverlayClosed()` observes Steam overlay deactivation, so a
  shortcut close can return to the game even if the presenter's first
  callback-driven focus restore does not stick. The run passed every shortcut
  target including checkout, kept zero managed overlay timing, and verified
  app-frontmost close/back-to-app proof without adding a timer-based lifecycle.
- A later 2026-06-30 full macOS matrix at
  `/tmp/steam-bridge-macos-overlay-matrix-full-electron42-pidfocus-20260630-011628`
  passed all 31 Steam-launched App ID `480` cases on Electron `42.5.1`. The
  matrix helper now targets close and shortcut probes at the exact smoke process
  PID recorded in the result payload and waits for previous smoke/gameoverlayui
  processes to exit before starting the next case. That keeps the proof aligned
  with the active overlay process instead of relying on ambiguous app-name focus
  when multiple smoke instances briefly coexist.
- A later 2026-06-30 full macOS Metal matrix at
  `/tmp/steam-bridge-macos-overlay-matrix-full-narrow-needs-present-20260630-023000`
  skipped repackaging, reused the signed Electron `42.5.1` bundle, and passed
  all 31 Steam-launched App ID `480` cases after the needs-present guard was
  narrowed to the OpenGL diagnostic backend. A later Metal-path
  `BOverlayNeedsPresent()` crash invalidated that narrower policy, so current
  macOS defaults disable the needs-present SDK call entirely. The artifact still
  re-verified all
  managed modal routes, passive toasts, checkout approval-route plumbing,
  presenter-backed shortcut targets, close/back-to-app proof, zero managed
  overlay timing, one overlay target, and clean crash diagnostics on the Metal
  product path.
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
- Steam Bridge's macOS evidence now has a first strict activation proof for the
  reusable presenter web path. Direct executable shortcuts preserved
  `DYLD_INSERT_LIBRARIES` but let `gameoverlayui` inherit the full non-Steam
  shortcut game ID while Steamworks inside the process reported App ID `480`.
  Forcing the shortcut's internal `appid` to `480` was rejected by Steam, and a
  standalone native launcher shortcut failed before process creation. The
  working path is a package-time launcher installed as the `.app` bundle's main
  executable: it sets `SteamAppId`, `SteamGameId`, and `SteamOverlayGameId` to
  the real app ID before `exec`ing the renamed Electron binary. Cold-start macOS
  Apple Silicon presenter runs now preserve Steam overlay injection, emit paired
  `GameOverlayActivated(true/false)` callbacks, show one `gameoverlayui` target
  on the Electron process with `-gameid 480`, complete `openAndWait(...)` only
  after close and parking for web/store/Friends/dialog-equivalent targets, and
  leave the app frontmost with the presenter parked at `currentFps=0`.

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
  https://github.com/ceifa/steamworks.js/issues/97
  https://github.com/ceifa/steamworks.js/issues/116
  https://github.com/ceifa/steamworks.js/issues/160
  https://github.com/ceifa/steamworks.js/issues/195
- Greenworks Electron overlay reports:
  https://github.com/greenheartgames/greenworks/issues/50
  https://github.com/greenheartgames/greenworks/issues/262
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
- increase presentation only when `overlayNeedsPresent` is true where that
  Steam SDK call is safe, or when a Steam overlay is active;
- reuse the same surface for checkout, store, web, and passive Steam
  notifications;
- route overlay targets by behavior: interactive native host for web, store, and
  checkout; Friends List through a Steam web overlay surface; passive host
  pumping for notifications; raw social/dialog panels remain a separate
  investigation path;
- expose diagnostics so app code and tests can tell whether the presenter is
  attached, visible, passive, active, pumping, and recently touched by overlay
  callbacks; the managed Electron overlay snapshot also reports the selected
  presenter mode, automatic notification-priming policy, restore-focus delay,
  activation timing, shortcut policy, and window-close ownership. The managed
  app-facing helper defaults restore-focus delay, activation boost, and active
  grace timing to `0`; the smoke verifiers can require those managed Electron
  fields, and the Deck/macOS matrix runners require zero managed overlay timing
  by default so runs fail if the wrong presenter mode, notification policy,
  timing, or shortcut target is active.

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
  overlay state where the Steam SDK polling call is safe without continuously
  presenting frames. It starts pumping only for operation-scoped activation
  holds, active overlays, lower-level explicit preparation, or
  `overlayNeedsPresent` on platforms that support safe needs-present polling.
  Passive notification priming now performs one presenter wake-up/poll and then
  waits for `overlayNeedsPresent` on those platforms instead of entering a fixed
  high-FPS boost window. On macOS, Steam Bridge disables `BOverlayNeedsPresent()`
  by default because Steam's injected renderer can crash inside that call on both
  the OpenGL diagnostic and Metal presenter paths; macOS uses operation-scoped
  activation holds and Steam overlay callbacks instead.
- The managed Electron lifecycle waits are app-facing state waits, not tuning
  loops. `open(...)` and `openAndWait(...)` keep the presenter active until Steam
  reports the overlay shown; `openAndWait(...)`, `waitForOverlayShown()`,
  `waitForOverlayClosed()`, and `parkWhenSteamOverlayCloses()` resolve from Steam
  overlay callbacks and native presenter state changes in persistent presenter
  mode. App code can pass timeouts or abort signals, but not polling intervals.
- Shortcut opens share the same readiness contract. Side-effect-free shortcut
  status checks never resolve dynamic app callbacks, and if the macOS
  focused-window shortcut fires before Steam reports the overlay hook ready, the
  bridge waits for readiness before activation while leaving the global shortcut
  unregistered so Steam can receive the later close/toggle input.
- The macOS smoke harness now has a persistent one-process proof mode. A
  2026-06-30 live run at
  `/tmp/steam-bridge-macos-overlay-matrix-20260630-063754` launched the signed
  Electron `42.5.1` App ID `480` smoke app once through Steam, started the
  token-protected localhost control server, and drove the full 31-case overlay
  inventory through that running process: modal web, store, Friends,
  dialog-equivalent `openAndWait(...)`, passive progress/unlock notifications,
  synthetic checkout approval-route plumbing, every managed Shift+Tab shortcut
  target, profile, players, community, stats, achievements, user chat/SteamID,
  and all known dialog-equivalent routes. It verified close/back-to-app and
  parked presenter state for every active overlay, Shift+Tab open/close for
  every shortcut target, clean quit through the control server, no Steam restart
  or retry, no leftover smoke/gameoverlay processes, and no fresh smoke crash
  reports. This validates repeated presenter reuse without fixed cooldowns,
  rapid relaunches, or Steam restarts. At current head, the persistent runner
  preserves failed artifacts and retries once for known crash-free managed wait
  timeouts after Steam launch/injection: readiness stuck before
  `overlayEnabled=true`, or post-action `become active` timeout after the action
  succeeded.
- A later 2026-06-30 persistent macOS run at
  `/tmp/steam-bridge-macos-overlay-matrix-persistent-summary-after-steam-reset-20260630-082731`
  passed the same 31-case one-process inventory after rebuilding a stale native
  addon. Its aggregate summary now audits
  `overlayNeedsPresentPollingEnabled=false` in both top-level Steam diagnostics
  and native presenter snapshots, so macOS artifacts prove Steam Bridge avoided
  the crash-prone `BOverlayNeedsPresent()` SDK call while still covering modal
  routes, passive toasts, checkout approval routing, Shift+Tab targets,
  close/back-to-app, zero managed timing, one overlay target, and clean crash
  diagnostics. A pre-reset failure with the same rebuilt addon showed
  `overlayEnabled=false` and multiple `gameoverlayui` launches for one smoke
  PID in Steam's own log; a single Steam client reset cleared that client state.
- On macOS, `openAndWait(...)` and checkout approval-route helpers also wait for
  Steam's overlay diagnostics to become ready before calling the activation API.
  If a rapid relaunch leaves the process injected but `overlayEnabled=false`,
  the app sees a typed readiness timeout with diagnostics instead of a silent
  no-op. Focused standalone Store/Friends proofs pass with this guard; the
  remaining failure is the live matrix's rapid multi-process relaunch shape, not
  the product-facing overlay primitive.
- The macOS proof harness is moving toward one Steam-launched Electron process
  with an opt-in localhost smoke control server. The server is token-protected,
  test-only, and reuses the same app-facing overlay calls and result payloads as
  autorun. It lets the harness open, externally close, and verify many overlay
  routes inside one normal app lifecycle instead of relying on rapid
  process-per-route launches.
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
  and pumps frames only after Steam reports `overlayNeedsPresent` on Linux/Deck.
  A
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
  closes and the presenter parks. Abort signals now apply while the backend
  checkout operation is still pending as well as during the Steam overlay wait:
  aborting before `InitTxn` returns releases the scoped presenter hold and parks
  back to zero FPS without opening a checkout surface. Closing the overlay
  manager while that operation is pending also releases the hold and rejects
  with the same typed close error used by the overlay wait helpers, preventing
  a late checkout surface after the app window is gone. App code can still use
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
  emitted overlay inactive. The Deck and macOS matrix summarizers now fail any
  `callback:microtxn` lifecycle event that lacks a presenter snapshot, so real
  purchase artifacts are machine-checkable when a configured app/product is
  available. The smoke app can also read a private `InitTxn`/checkout response
  JSON file from `STEAM_BRIDGE_SMOKE_CHECKOUT_JSON_FILE` and feed it directly
  through `openCheckoutAndWait(...)`, giving real-product proof a generic
  runtime hook without committing app IDs, product data, transaction IDs, or
  checkout URLs. A focused 2026-06-30 macOS run at
  `/tmp/steam-bridge-macos-checkout-json-20260630-030514` proved that JSON-file
  handoff through the packaged Electron `42.5.1` app and stable Steam shortcut:
  checkout opened, emitted active/inactive callbacks, returned the app
  frontmost, completed only after presenter parking, and kept raw transaction
  data out of result/lifecycle artifacts. A later 2026-06-30 macOS core matrix at
  `/tmp/steam-bridge-macos-overlay-matrix-core-json-shortcut-20260630-034839`
  passed all 24 cases with the same JSON-file input, including
  `11-shortcut-checkout`; the summary audited `checkoutSource=json-file`,
  Shift+Tab open/close, app focus return, parked zero-FPS presenter state, and
  no crash evidence. A later full 2026-06-30 macOS matrix at
  `/tmp/steam-bridge-macos-overlay-matrix-full-json-after-reopen-20260630-040037`
  rebuilt and signed the Electron `42.5.1` smoke package after Steam had been
  reopened, reused the stable shortcut without restarting Steam, and passed all
  31 Steam-launched App ID `480` cases with the same JSON-file checkout input.
  It re-verified direct and shortcut checkout, every supported shortcut target,
  every high-level dialog-equivalent route, Metal presenter lifecycle,
  close/back-to-app proof, zero managed overlay timing, and clean crash
  diagnostics. A later 2026-06-30 persistent macOS run at
  `/tmp/steam-bridge-macos-overlay-matrix-persistent-electron43-20260630-084237`
  rebuilt and signed the smoke app with Electron `43.0.0`, reused the stable
  Steam shortcut without restarting Steam, launched once through Steam, and
  passed all 31 control-server-driven cases. The summary re-proved the same
  managed overlay surface set plus one Metal presenter-backed overlay target per
  case, close/back-to-app proof, zero managed overlay timing,
  `overlayNeedsPresentPollingEnabled=false`, clean crash diagnostics, and clean
  quit behavior on the current Electron package. A later 2026-06-30 persistent
  macOS run at
  `/tmp/steam-bridge-macos-overlay-matrix-persistent-generic-launcher-20260630-085852`
  rebuilt that Electron `43.0.0` package from the published generic macOS
  launcher and entitlement templates, reused the stable Steam shortcut without a
  Steam restart, and passed the same 31-case inventory. That run proves the
  builder-facing package templates are now the path being exercised by live
  macOS overlay evidence, not a smoke-only launcher source. A later 2026-06-30
  persistent macOS run at
  `/tmp/steam-bridge-macos-overlay-matrix-persistent-prepare-cli-visible-close-20260630-094316`
  rebuilt and signed the Electron `43.0.0` package through the published
  `steam-bridge-prepare-macos-app` CLI, reused the same stable shortcut without
  restarting Steam, and passed all 31 cases again. The macOS harness now waits
  for visible Steam web content inside the presenter host before sending the
  active web close probe because `GameOverlayActivated(true)` can precede the
  first web paint. Current source records that proof as
  `overlay:web-visible`, and web-close macOS matrix cases fail if it is missing;
  this is test evidence plumbing, not a product runtime timer.
  The run left no smoke/gameoverlay process and produced no fresh crash report
  beyond the older known `BOverlayNeedsPresent()` reports. A later 2026-06-30
  persistent macOS run at
  `/tmp/steam-bridge-macos-overlay-matrix-persistent-shortcut-openwait-20260630-101406`
  passed 32 control-server-driven cases after adding a programmatic shortcut
  wait proof. The new `19-persistent-shortcut-web-openwait` case calls
  `steamOverlay.openShortcutTargetAndWait()` for the configured modal web target
  rather than sending Shift+Tab, then verifies `overlay:shortcut-open`, visible
  Steam web content, active/inactive callbacks, completion after overlay close
  and presenter parking, app focus return, zero managed timing, one Metal
  presenter-backed overlay target, clean quit behavior, and no fresh crash
  reports. A focused follow-up proof at
  `/tmp/steam-bridge-macos-shortcut-openwait-focused-20260630-102739`
  re-ran the helper after correcting the diagnostic source label and confirmed
  `shortcut: "openShortcutTargetAndWait"`, `target: "web"`, close-driven
  completion, zero-FPS parking, and no fresh crash report. A later 2026-06-30 core
  macOS run at `/tmp/steam-bridge-macos-overlay-matrix-20260630-104809` rebuilt and
  signed the Electron `43.0.0` package after checkout was moved onto the same
  managed ready/open/shown/park wait helper as the other presenter-backed targets.
  It reused the stable Steam shortcut without restarting Steam and passed all 24
  core cases, including direct checkout approval, checkout shortcut, every managed
  shortcut target, passive toasts, direct community/user routes, one Metal
  presenter-backed overlay target per case, zero managed timing, close/back-to-app
  proof, and no fresh `SteamBridgeSmoke` crash report beyond the older known
  `BOverlayNeedsPresent()` reports. A later 2026-06-30 persistent macOS run at
  `/tmp/steam-bridge-macos-overlay-matrix-20260630-110920` rebuilt and signed the
  Electron `43.0.0` package, reused the stable Steam shortcut without restarting
  Steam, launched one App ID `480` process through Steam, and passed all 42
  control-server-driven cases. It expands
  `steamOverlay.openShortcutTargetAndWait()` coverage from the modal web route
  to Friends, store, checkout approval-route, profile, players, community, stats,
  achievements, user chat, and dialog-equivalent shortcut targets. Every new
  programmatic shortcut target verified `overlay:shortcut-open`, active/inactive
  callbacks, completion after close and presenter parking, zero managed overlay
  timing, one Metal presenter-backed overlay target, clean control-server quit,
  no leftover smoke/gameoverlay process, and no fresh macOS crash reports. The
  smoke app now uses targeted `gameoverlayui` PID diagnostics on macOS rather
  than a full `ps` table scan, preserving the one-target summary proof while
  avoiding diagnostic timeouts in long persistent runs. A later 2026-06-30 full
  cold-launch macOS run at
  `/tmp/steam-bridge-macos-overlay-matrix-20260630-112048` reused the signed
  Electron `43.0.0` package and stable Steam shortcut without restarting Steam
  and passed all 42 process-per-case cases. The full suite now proves the same
  public `steamOverlay.openShortcutTargetAndWait()` targets as the persistent
  suite, including Friends, web, store, checkout approval-route, profile,
  players, community, stats, achievements, user chat, and dialog-equivalent,
  with active/inactive callbacks, close-driven completion, presenter parking, one
  Metal presenter-backed overlay target, zero managed overlay timing, clean
  back-to-app proof, no leftover smoke/gameoverlay process, and no fresh macOS
  crash reports. A later 2026-06-30 full macOS matrix at
  `/tmp/steam-bridge-macos-overlay-matrix-20260630-152820` and persistent
  one-process matrix at
  `/tmp/steam-bridge-macos-overlay-matrix-20260630-153959` both passed 43 App ID
  `480` cases on the Electron `43.0.0` package. Those runs add explicit
  checkout prepare-only proof, all programmatic shortcut wait targets, app focus
  before activation/close probes, and per-control-action smoke option reset so a
  previous checkout transaction cannot leak into a later prepare-only action. A
  later 2026-06-30 full macOS matrix at
  `/tmp/steam-bridge-macos-overlay-matrix-full-ready-current-20260630-164539`
  passed 44 process-per-case App ID `480` cases after adding the managed
  `presenter-ready` preflight to full live coverage. It reused the signed
  Electron `43.0.0` package and stable shortcut without restarting Steam or
  repackaging, then re-proved web/store/Friends/dialog waits, passive
  progress/unlock toasts, checkout approval and prepare-only readiness, every
  managed Shift+Tab shortcut target, every direct presenter-backed
  community/user/dialog route, every programmatic shortcut open-and-wait target,
  one Metal presenter-backed overlay target per case, close/back-to-app proof,
  zero managed overlay timing, parked zero-FPS presenter state, no leftover
  smoke/gameoverlay process, and no copied macOS crash reports. A follow-up
  persistent one-process macOS matrix at
  `/tmp/steam-bridge-macos-overlay-matrix-persistent-ready-retry-current-20260630-170648`
  reused the same package and shortcut without restarting Steam or repackaging,
  launched one Steam-owned App ID `480` smoke process, drove all 44 cases through
  the localhost control server, and passed the same readiness, active overlay,
  passive notification, checkout, shortcut, close/back-to-app, zero-timing,
  cleanup, and no-crash gates. The persistent matrix now retries one crash-free
  post-action `become active` timeout by relaunching the suite; repeated misses
  remain failures. A
  2026-06-28 Deck Desktop
  prepare-only run verified
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
   - `overlayNeedsPresent=true`: pump around 30 FPS on platforms where that
     Steam SDK call is safe;
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
   - `createElectronSteamOverlay(...)` now repeats that preload scrub by
     default for future Electron children and records the scrub state in
     managed overlay snapshots;
   - on Linux, use Electron's `no-zygote` switch so Chromium children exec
     clean instead of forking the already-loaded Steam overlay library;
   - assert Deck proofs have one `gameoverlayui` process for the app.
7. Re-run checkout proof:
   - generic App ID `480` for public plumbing where possible;
   - a real app/product only for private purchase proof;
   - `openCheckoutAndWait(...)` must keep the native presenter prepared and
     wait for Steam overlay readiness before invoking the app's `InitTxn`
     operation, so real transactions are not created while the overlay hook is
     still unavailable;
   - require `callback:microtxn` diagnostics to include presenter state during
     real purchase authorization; current Deck/macOS summary auditors fail if
     that callback lacks a presenter snapshot, and the macOS matrix can add
     `--require-microtxn-callback` to fail if the direct checkout callback is
     missing entirely;
   - keep private app IDs, item definitions, transaction IDs, and URLs out of
     committed files.
8. Treat Wayland as a later backend unless Steam/Electron are running through
   Xwayland. The managed presenter, and the session fallback when it opens, now
   fail before native attachment on Linux when `DISPLAY` is missing, with an
   explicit X11/Xwayland diagnostic; Wayland-only and headless sessions are not
   a supported overlay host yet.

Pass criteria:

- Steam launch and overlay injection. Active modal overlay proofs also require
  `overlayEnabled=true` or an equivalent active overlay callback; passive
  notification proofs require accepted Steam notification events plus passive
  presenter state without modal activation.
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
- Metal is the default macOS host path when an Electron native window handle is
  available; OpenGL remains a diagnostic fallback.
- A post-reboot current-head 2026-07-01 Apple Silicon minimal matrix at
  `/tmp/steam-bridge-macos-overlay-matrix-post-reboot-descriptor-health-20260701`
  passed all 11 Steam-launched App ID `480` cases without repackaging or
  restarting Steam after the Steam health gate was corrected to count numbered
  file descriptors instead of all `lsof` mapped-resource rows. The run proved
  readiness, direct and waited web/store/Friends/dialog routes, duplicate-open
  suppression, passive toast behavior, close/back-to-app proof, one Metal
  presenter-backed overlay target, parked zero-FPS state, zero managed overlay
  timing, managed child-overlay isolation, and clean crash diagnostics.
- A post-reboot current-head 2026-07-01 Apple Silicon core matrix at
  `/tmp/steam-bridge-macos-overlay-matrix-core-post-reboot-20260701` reused the
  signed arm64-only Electron `43.0.0` package and stable App ID `480` shortcut
  without repackaging or restarting Steam, and passed all 37 Steam-launched
  core cases. It re-proved direct and waited managed overlay helpers, checkout
  approval and prepare-only flows, passive progress/unlock toasts, every managed
  Shift+Tab shortcut target, one Metal presenter-backed overlay target,
  interactive macOS host state, close/back-to-app proof, zero-FPS parking, zero
  managed timing, managed child-overlay isolation, named open-status and
  checkout-operation diagnostics, redacted checkout inputs, and clean crash
  diagnostics.
- A post-reboot current-head 2026-07-01 Apple Silicon full matrix at
  `/tmp/steam-bridge-macos-overlay-matrix-full-post-reboot-20260701` reused the
  same signed arm64-only Electron `43.0.0` package and stable App ID `480`
  shortcut without repackaging or restarting Steam, and passed all 55
  process-per-case routes. It extends the post-reboot proof across every
  dialog-equivalent route and every programmatic shortcut `openAndWait(...)`
  target while preserving one Metal presenter-backed overlay target,
  interactive macOS host state, visible Steam web content where applicable,
  close/back-to-app proof, zero-FPS parking, disabled needs-present polling,
  zero managed timing, managed child-overlay isolation, named open-status and
  checkout-operation diagnostics, redacted checkout inputs, and clean crash
  diagnostics.
- A post-reboot current-head 2026-07-01 Apple Silicon persistent matrix at
  `/tmp/steam-bridge-macos-overlay-matrix-persistent-post-reboot-20260701`
  reused the same signed arm64-only Electron `43.0.0` package and stable App ID
  `480` shortcut without repackaging or restarting Steam, then passed all 51
  one-process/control-server cases. The first attempt hit Steam's transient
  overlay-readiness timeout at the profile `openAndWait(...)` case and the
  matrix relaunched through its bounded retry path; the retry passed. The final
  artifact proves the successful long-lived-process route across readiness,
  managed web/store/Friends/dialog waits, checkout approval and prepare-only,
  passive progress/unlock toasts, every managed Shift+Tab shortcut target,
  every direct profile/players/community/stats/achievements/user route, every
  dialog-equivalent route, every programmatic shortcut `openAndWait(...)`
  target, one Metal presenter-backed overlay target, close/back-to-app proof,
  zero-FPS parking, zero managed timing, managed child-overlay isolation, named
  open-status/checkout-operation diagnostics, redacted checkout inputs, and
  clean crash diagnostics.
- The Metal host is borderless, transparent/click-through while idle, cannot
  become key or main, attaches above the Electron parent window, and is kept
  aligned by the managed Electron window sync hooks.
- The packaged app uses an in-bundle native launcher that preserves Steam's
  overlay injection and aligns `SteamOverlayGameId` with the app ID before
  Electron starts.
- Steam-launched macOS Apple Silicon runs now verify managed modal web, store,
  Friends/chat, dialog-equivalent `openAndWait(...)`, passive progress/unlock
  toasts, synthetic checkout `openCheckoutAndWait(...)` approval-route
  plumbing, managed Shift+Tab shortcut open/close, profile, players, community,
  stats, achievements, user
  chat/profile, and known dialog-equivalent routes with paired active/inactive
  callbacks where expected, active shown presenter snapshots, one
  `gameoverlayui` target, app focus return, clean crash diagnostics, an
  interactive macOS host state, and idle presenter parking at `currentFps=0`.
  The current full Apple Silicon artifact covers 55 process-per-case routes
  after adding direct readiness-status proof for profile, players, community,
  stats, achievements, and user chat helpers, and the current persistent
  artifact covers 51 one-process routes, including programmatic
  `openShortcutTargetAndWait()` proof for every supported presenter-backed
  shortcut target. A focused
  2026-07-01 minimal Apple Silicon
  run at `/tmp/steam-bridge-macos-overlay-matrix-20260701-032532` passed all 7
  minimal cases after expanding `presenter-duplicate-open-guard`; it proved
  direct target, shortcut/controller, direct checkout, and checkout wait
  `IfAvailable` helpers return `null` while the presenter is already opening a
  managed overlay, with both
  `getOpenStatus(...)` and `getShortcutOpenStatus()` reporting
  `reason: "opening"`, no checkout operation run, close/back-to-app proof,
  parked zero-FPS state, zero managed overlay timing, and clean crash
  diagnostics. The checkout prepare-only case calls `withCheckoutPrepared(...)`
  without transaction input, requires the checkout-ready lifecycle event,
  rejects modal overlay activation, and audits that the presenter releases back
  to idle. A focused live checkout suite at
  `/tmp/steam-bridge-macos-overlay-matrix-checkout-live-20260630-160833` also
  passed all four App ID `480` checkout cases: prepare-only, direct checkout
  approval-route, managed Shift+Tab checkout, and programmatic checkout
  shortcut/open-and-wait, all with one Metal presenter-backed overlay target
  where expected, close/back-to-app proof, zero managed overlay timing, parked
  presenter state, and no crash evidence. Product routes and all known
  high-level dialog-equivalent routes now use managed `openAndWait(...)` proof
  where applicable, including profile, players, community, stats, achievements,
  user chat, and user SteamID. Non-store targets attach under game ID `480`; the
  Steam store surface can report the generated shortcut game ID while still
  emitting app ID `480` callbacks and passing the same close-and-park proof.
- The macOS native presenter now reads CoreGraphics session/display state before
  creating the host. If the screen is locked or the main display is asleep, the
  presenter skips native host creation, reports
  `nativeHostUnavailableReason` as `macos-screen-locked` or
  `macos-display-asleep`, keeps `currentFps=0`, and retries attachment on the
  next presenter operation after the Mac becomes interactive again. Managed
  Electron overlay open/wait and checkout helpers, including split-step
  `prepareForCheckout()` flows, fail before Steam overlay activation with
  `SteamOverlayNativeHostUnavailableError` while that unavailable reason is
  present, so callers can check `code`, `reason`, and `macOverlayEnvironment`
  and fall back without waiting for a guard timeout. The checkout helper also
  re-checks host availability before opening the returned approval route, so if
  the screen locks or display sleeps while `InitTxn` is still pending, the
  scoped presenter hold releases and no late checkout surface opens. The
  macOS Shift+Tab fallback treats an already-unavailable host as a quiet no-op
  unless app code provides `overlayShortcut.onError`, so those sessions do not
  produce default shortcut warning noise or Steam activation attempts. If the
  host becomes unavailable while the fallback is already waiting for Steam's
  overlay callback, that wait also stays quiet. Automatic passive notification
  priming skips native host work while unavailable but keeps the presenter
  registered, so the next notification-producing achievement/stat call after
  unlock or display wake can prime normally.
  Unit coverage verifies locked, display-asleep, post-unlock lazy attach, and
  managed fail-fast paths, including pending checkout cancellation and quiet
  shortcut behavior when macOS becomes unavailable mid-operation, plus passive
  notification retry after the host becomes available. The shared smoke verifier
  and packaged
  platform helpers can also require the serialized action `code` and `reason`
  fields, plus the presenter `nativeHostUnavailableReason`, no-host, unattached,
  zero-FPS snapshot state, and absence of Steam overlay activation, so
  locked/asleep fallback artifacts can be checked automatically. The macOS
  `unavailable` matrix suite is the explicit live capture path for those
  states: it auto-detects `macos-screen-locked` or `macos-display-asleep`,
  exercises managed web, checkout-open, checkout prepare-only, programmatic
  shortcut open/wait, and passive achievement-progress no-host behavior,
  requires no Steam overlay activation, and records the same manifest metadata
  consumed by the artifact summarizer.
  Success matrices preflight the
  same environment and stop before launching case 1 if the Mac is locked or the
  display is asleep. The matrix runner has an optional
  `--wait-for-interactive-seconds <seconds>` preflight wait, also exposed as
  `STEAM_BRIDGE_MACOS_MATRIX_WAIT_FOR_INTERACTIVE_SECONDS`, for unattended runs
  where the Mac may be unlocked shortly after invocation. The default is still
  immediate failure, and this wait is harness-only rather than a product overlay
  lifecycle timer. `npm run macos:overlay-matrix:preflight` runs the same
  readiness check without packaging, shortcut updates, Steam restarts, or smoke
  case launches. A live 2026-06-30 unavailable matrix at
  `/tmp/steam-bridge-macos-overlay-matrix-unavailable-checkout-prepare-20260630-115145`
  passed all three fail-fast cases in a genuine locked/asleep session. The
  artifact proves Steam launch/injection, typed unavailable action errors, no
  native host attachment, hidden presenter state at `currentFps=0`, no overlay
  activation, zero overlay targets, and no crash evidence. Locked sessions can
  also report `displayAsleep=true`; `macos-screen-locked` takes precedence and
  the verifier allows either display-asleep value while locked. Because the host
  is intentionally not created, unavailable matrix summaries do not require
  `overlayEnabled=true`. A later unavailable matrix at
  `/tmp/steam-bridge-macos-overlay-matrix-unavailable-needs-present-20260630-120650`
  re-ran the same three cases after rebuilding the native addon and signed
  Electron `43.0.0` package with the JavaScript needs-present guard. It proved
  the locked/asleep path reports `overlayNeedsPresent=false` and
  `overlayNeedsPresentPollingEnabled=false` without fresh `SteamBridgeSmoke` or
  attributed `MTLCompilerService` crash reports. A later rebuilt unavailable
  matrix at
  `/tmp/steam-bridge-macos-overlay-matrix-unavailable-passive-toast-final-20260630-123114`
  passed all four cases, adding passive achievement-progress proof that
  automatic passive notification priming keeps the presenter registered but
  does not attach or open the macOS native host while the screen is locked. A
  fresh unavailable matrix at
  `/tmp/steam-bridge-macos-overlay-matrix-unavailable-preflight-current-20260630-130448`
  reran those four cases after adding the cheap preflight mode and rebuilding
  the signed Electron `43.0.0` package; it reused the stable shortcut without a
  Steam restart, reported no overlay activation, zero overlay targets,
  `overlayNeedsPresent=false`, `overlayNeedsPresentPollingEnabled=false`, zero
  managed overlay timing, and no fresh `SteamBridgeSmoke` or attributed
  `MTLCompilerService` crash reports.
  A follow-up unavailable matrix at
  `/tmp/steam-bridge-macos-overlay-matrix-unavailable-shortcut-openwait-20260630-131816`
  expanded that live proof to five cases by adding
  `presenter-shortcut-open-and-wait` for the configured web shortcut target. The
  new case records the managed wait start, confirms the configured target, and
  fails with the typed native-host-unavailable error before `overlay:shortcut-open`,
  native host attachment, Steam overlay activation, or crash evidence.
  A fresh unavailable matrix at
  `/tmp/steam-bridge-macos-overlay-matrix-20260630-140541` rebuilt and signed
  the Electron `43.0.0` smoke package after the smoke snapshot began carrying
  `snapshot.overlay.nativeHostAvailability`, reused the stable shortcut without
  a Steam restart, and passed all five unavailable cases again. The summary and
  direct artifact inspection verified that managed web open/wait, checkout-open,
  checkout prepare-only, programmatic shortcut open/wait, and passive
  achievement-progress all carried `available=false`,
  `STEAM_OVERLAY_NATIVE_HOST_UNAVAILABLE`, reason `macos-screen-locked`, and an
  embedded presenter snapshot with `nativeHostOpen=false`, alongside no overlay
  activation, zero overlay targets, disabled needs-present polling, zero managed
  overlay timing, and no fresh crash reports.
  A later unavailable matrix at
  `/tmp/steam-bridge-macos-overlay-matrix-20260630-144631` reran current head
  after removing the smoke harness's legacy OpenGL-only
  `STEAM_BRIDGE_DISABLE_OVERLAY_NEEDS_PRESENT=1` injection. It rebuilt and
  signed Electron `43.0.0`, reused the stable shortcut without restarting
  Steam, passed all five unavailable cases, and re-verified `available=false`,
  `STEAM_OVERLAY_NATIVE_HOST_UNAVAILABLE`, reason `macos-screen-locked`,
  `nativeHostOpen=false`, no Steam overlay activation, zero overlay targets,
  disabled needs-present polling, zero managed overlay timing, and no copied
  macOS crash reports.
  A current-head locked/asleep unavailable matrix at
  `/tmp/steam-bridge-macos-overlay-matrix-20260630-223644` rebuilt and signed
  the Apple Silicon Electron `43.0.0` package, reused the stable shortcut
  without a Steam restart, and passed all six unavailable cases. It added the
  readiness preflight to the locked/asleep suite and re-verified managed
  web open/wait, checkout-open, checkout prepare-only, programmatic shortcut
  open/wait, and passive achievement-progress no-host behavior with
  `available=false`, `STEAM_OVERLAY_NATIVE_HOST_UNAVAILABLE`, reason
  `macos-screen-locked`, `screenLocked=true`, `displayAsleep=true`,
  `nativeHostOpen=false`, no Steam overlay activation, zero overlay targets,
  disabled needs-present polling, zero managed overlay timing, and clean crash
  diagnostics.
  A current-head 2026-07-01 locked/asleep unavailable matrix at
  `/tmp/steam-bridge-macos-overlay-matrix-unavailable-target-snapshots-20260701-165605`
  reused the rebuilt and signed Apple Silicon Electron `43.0.0` package and
  stable App ID `480` shortcut without restarting Steam, then passed all six
  unavailable cases again after the smoke app began attaching sanitized
  `targetSnapshot` diagnostics to native-host-unavailable fail-fast errors.
  Checkout fail-fast errors also carry `checkoutTargetSnapshot`, so real
  failure artifacts keep builder-actionable target context without leaking raw
  checkout URLs, transaction IDs, or private fixture paths. The run re-proved
  readiness, managed web open/wait, checkout-open, checkout prepare-only,
  programmatic shortcut open/wait, and passive achievement-progress no-host
  behavior with no Steam overlay activation, zero overlay targets, disabled
  needs-present polling, zero managed overlay timing, and clean crash
  diagnostics.
  A follow-up interactive minimal matrix at
  `/tmp/steam-bridge-macos-overlay-matrix-20260630-224312` reused that signed
  package and stable shortcut without repackaging or restarting Steam after the
  Mac became interactive again. It passed readiness, web/store/Friends/dialog
  `openAndWait(...)`, and passive achievement-progress cases with
  `screenLocked=false`, `displayAsleep=false`, one Metal presenter-backed
  overlay target for active/passive overlay cases, visible Steam web content
  before close probes, active/inactive callbacks for modal routes, app focus
  return, parked zero-FPS presenter state, disabled needs-present polling, zero
  managed overlay timing, and clean crash diagnostics.
  A current-head persistent macOS matrix at
  `/tmp/steam-bridge-macos-overlay-matrix-20260630-224828` reused the signed
  Apple Silicon Electron `43.0.0` package and stable shortcut without
  repackaging or restarting Steam, launched one Steam-owned App ID `480` smoke
  process, drove all 44 cases through the control server, and passed the
  summary audit. It re-proved readiness, web/store/Friends/dialog
  `openAndWait(...)`, passive progress/unlock toasts, checkout approval and
  prepare-only, every managed Shift+Tab shortcut target, direct
  profile/players/community/stats/achievements/user/dialog routes, every
  programmatic shortcut open-and-wait target, one Metal presenter-backed
  overlay target, active/inactive callbacks where expected, visible Steam web
  content before close probes, app focus return, parked zero-FPS presenter
  state, disabled needs-present polling, zero managed overlay timing, clean
  control-server quit behavior, no leftover smoke/gameoverlay process, and
  clean crash diagnostics.
  A fresh 2026-07-01 persistent macOS matrix at
  `/tmp/steam-bridge-macos-overlay-matrix-20260701-003835` reused the same
  signed Apple Silicon Electron `43.0.0` package and stable shortcut without
  repackaging or restarting Steam, launched one Steam-owned App ID `480` smoke
  process, drove all 44 cases through the control server, and passed the
  summary audit. It re-proved readiness, web/store/Friends/dialog
  `openAndWait(...)`, passive progress/unlock toasts, checkout approval and
  prepare-only, every managed Shift+Tab shortcut target, direct
  profile/players/community/stats/achievements/user/dialog routes, every
  programmatic shortcut open-and-wait target, one Metal presenter-backed
  overlay target, active/inactive callbacks where expected, visible Steam web
  content before close probes, app focus return, parked zero-FPS presenter
  state, disabled needs-present polling, zero managed overlay timing, clean
  control-server quit behavior, no leftover smoke/gameoverlay process, and
  clean crash diagnostics.
  A fresh 2026-07-01 full cold-launch macOS matrix at
  `/tmp/steam-bridge-macos-overlay-matrix-full-web-visible-fixed-20260701-015118`
  rebuilt and signed the Apple Silicon Electron `43.0.0` package, reused the
  stable shortcut without restarting Steam, and passed all 44 process-per-case
  App ID `480` cases. The summary reported `webVisible=true` for all 29
  web-close cases after the helper event writer stopped using a brace-sensitive
  shell default and started base64-transporting JSON payloads into lifecycle
  events. This keeps visible-content close proof in the machine-audited artifact
  instead of relying on helper console text.
  A focused 2026-07-01 minimal Apple Silicon matrix at
  `/tmp/steam-bridge-macos-overlay-matrix-20260701-032532` passed all 7 minimal
  App ID `480` cases after expanding `presenter-duplicate-open-guard`; the live
  artifact proves direct target, shortcut/controller, and checkout
  `IfAvailable` helpers return `null` while a managed overlay is already
  opening, with the checkout operation callback untouched and the normal
  close/back-to-app, parked zero-FPS, zero managed overlay timing, and crash
  diagnostics still green.
  A current-head 2026-07-01 persistent Apple Silicon matrix at
  `/tmp/steam-bridge-macos-overlay-matrix-20260701-033432` rebuilt and signed
  the arm64-only Electron `43.0.0` package, reused the stable shortcut without
  restarting Steam, launched one Steam-owned App ID `480` smoke process, drove
  all 45 persistent cases through the control server, and passed the summary
  audit. It folds the expanded duplicate-open proof into the broad one-process
  suite and re-proves passive progress/unlock toasts, checkout approval and
  prepare-only, every managed Shift+Tab shortcut target, direct
  profile/players/community/stats/achievements/user/dialog routes, every
  programmatic shortcut open-and-wait target, one Metal presenter-backed
  overlay target, visible Steam web content before close probes, app focus
  return, parked zero-FPS state, disabled needs-present polling, zero managed
  overlay timing, clean control-server quit behavior, no leftover
  smoke/gameoverlay process, and clean crash diagnostics.
  A current-head 2026-07-01 persistent Apple Silicon matrix at
  `/tmp/steam-bridge-macos-overlay-matrix-persistent-open-statuses-20260701-080755`
  then reused the same signed arm64-only Electron `43.0.0` package and stable
  shortcut without repackaging or restarting Steam, launched one Steam-owned App
  ID `480` smoke process, drove all 45 persistent cases through the control
  server, and passed the summary audit with `openStatuses=true` on every row.
  It re-proved readiness, web/store/Friends/dialog `openAndWait(...)`,
  duplicate-open suppression, passive progress/unlock toasts, checkout approval
  and prepare-only, every managed Shift+Tab shortcut target, direct
  profile/players/community/stats/achievements/user/dialog-equivalent routes,
  every programmatic shortcut open-and-wait target, close/back-to-app proof,
  parked zero-FPS state, zero managed timing, managed isolation, clean
  control-server quit behavior, no leftover smoke/gameoverlay process, and clean
  crash diagnostics.
  A focused current-head macOS checkout suite at
  `/tmp/steam-bridge-macos-overlay-matrix-checkout-target-snapshot-20260630-232458`
  rebuilt and signed the Apple Silicon Electron `43.0.0` package, reused the
  stable shortcut without restarting Steam, and passed all four App ID `480`
  checkout cases: prepare-only, direct synthetic approval-route checkout,
  managed Shift+Tab checkout, and programmatic checkout shortcut
  `openAndWait(...)`. The summary now requires checkout completion artifacts to
  include the sanitized `targetSnapshot` presence-flag diagnostic, and the live
  artifact verified close/back-to-app proof, one Metal presenter-backed overlay
  target, zero managed overlay timing, no leftover smoke/gameoverlay process,
  and no raw synthetic transaction ID or checkout approval URL in the matrix
  metadata or lifecycle logs.
  A fresh 2026-07-01 focused checkout suite at
  `/tmp/steam-bridge-macos-overlay-matrix-20260701-034916` rebuilt and signed
  the Apple Silicon Electron `43.0.0` package, reused the stable shortcut
  without restarting Steam, and passed those same four App ID `480` checkout
  cases again: prepare-only, direct synthetic approval-route checkout, managed
  Shift+Tab checkout, and programmatic checkout shortcut `openAndWait(...)`.
  The summary verified one Metal presenter-backed overlay target in every case,
  visible Steam web content for the direct and programmatic web-close paths,
  close/back-to-app proof, parked zero-FPS state, disabled needs-present
  polling, zero managed overlay timing, and clean crash diagnostics. This is
  still public checkout plumbing proof, not a substitute for real configured
  product purchase-content evidence.
  Current source also annotates managed wait failures with sanitized
  `targetSnapshot` context, plus `checkoutTargetSnapshot` for checkout targets,
  while preserving the original wait error class. Checkout preparation,
  pending checkout-operation abort/close, and checkout native-host-unavailable
  failures also carry a sanitized checkout snapshot even before a transaction
  target exists. This keeps real-product checkout failure logs useful without
  requiring apps or smoke artifacts to serialize raw checkout URLs, transaction
  IDs, return URLs, or Steam IDs. The macOS matrix summary self-test now covers
  checkout open and checkout prepare fail-fast artifacts and rejects missing
  checkout error snapshots.
  The safe app-facing purchase helper is deliberately side-effect-free when the
  overlay is known unavailable: `openCheckoutAndWaitIfAvailable(...)` refreshes
  Steam diagnostics before invoking the transaction operation and returns
  `null` without starting `InitTxn` when Steam is not running, the native host
  is unavailable, or another managed overlay action is busy. If the only blocker
  is a temporary `overlay-not-ready` state, the safe helper waits for readiness
  before calling `InitTxn`, matching the direct managed checkout wait path.
  `getCheckoutOperationStatus()` exposes the same no-side-effect preflight
  before a backend transaction exists, so apps can disable, explain, or keep a
  purchase button waiting without touching `InitTxn`. Apps that want a thrown
  readiness error can still call `openCheckoutAndWait(...)`, which keeps the
  presenter prepared, waits for overlay readiness before activation, and
  preserves sanitized checkout error snapshots if readiness fails.
  Current source applies the same fresh diagnostics to generic side-effect-free
  overlay status checks. `openIfAvailable(...)` and shortcut direct-open helpers
  return `null` with `reason: "overlay-not-ready"` while the hook is not ready,
  but the matching wait helpers can still wait for readiness before activation.
  If Steam is not running, generic direct and waited `IfAvailable` helpers both
  return `null` with `reason: "steam-unavailable"` instead of attempting any
  Steam overlay activation.
  Dynamic shortcut status keeps app callbacks side-effect-free by reporting
  these diagnostics before resolving the target callback; direct shortcut
  `IfAvailable` stays quiet while not ready, while the waited helper can resolve
  the target as part of an explicit wait-and-open operation.
  A 2026-07-01 full Apple Silicon matrix at
  `/tmp/steam-bridge-macos-overlay-matrix-full-isolation-proof-20260701-045604`
  rebuilt and signed the Electron `43.0.0` smoke package, reused the stable App
  ID `480` Steam shortcut without restarting Steam, and passed all 45
  process-per-case presenter-backed cases after managed overlay isolation became
  a required product proof. Each presenter case required the child-process
  preload scrub diagnostics, the summary now reports `managedIsolation=true`,
  and the same audit rejects unexpected scrubbed env keys. It re-proved modal
  web/store/Friends/dialog routes, passive progress/unlock toasts, checkout
  approval and
  prepare-only paths, every managed Shift+Tab shortcut target, direct
  profile/players/community/stats/achievements/user/dialog-equivalent routes,
  and every programmatic shortcut `openAndWait(...)` target with one Metal
  presenter-backed overlay target, visible web content where applicable,
  close/back-to-app proof, parked zero-FPS state, `idleStable=true` for active
  close paths, disabled needs-present polling, zero managed overlay timing, and
  clean crash diagnostics.
  A current-head 2026-07-01 core Apple Silicon matrix at
  `/tmp/steam-bridge-macos-overlay-matrix-core-shortcut-readiness-20260701-062656`
  rebuilt and signed the arm64-only Electron `43.0.0` package, reused the
  stable App ID `480` shortcut without restarting Steam, and passed all 27 core
  cases after shortcut readiness hardening. It re-proved readiness,
  web/store/Friends/dialog `openAndWait(...)`, duplicate-open suppression,
  passive progress/unlock toasts, checkout approval and prepare-only, every
  managed Shift+Tab shortcut target, and direct profile/players/community/stats/
  achievements/user routes with one Metal presenter-backed overlay target,
  visible Steam web content where applicable, active/inactive callbacks,
  close/back-to-app proof, parked zero-FPS state, disabled needs-present
  polling, zero managed overlay timing, managed child-overlay isolation, and
  clean crash diagnostics.
  A focused current-head 2026-07-01 minimal Apple Silicon matrix at
  `/tmp/steam-bridge-macos-overlay-matrix-minimal-named-helpers-20260701-064718`
  rebuilt and signed the arm64-only Electron `43.0.0` package, reused the
  stable App ID `480` shortcut without restarting Steam, and passed all 7
  minimal cases after the smoke app switched common managed actions to the
  named builder helpers. It exercised `openWebAndWait(...)`,
  `openStoreAndWait(...)`, `openFriendsAndWait(...)`, `openDialogAndWait(...)`,
  duplicate-open suppression through `openWebAndWaitIfAvailable(...)`, and
  passive notification priming with visible web content where applicable,
  active/inactive callbacks, close/back-to-app proof, parked zero-FPS state,
  disabled needs-present polling, zero managed overlay timing, managed
  child-overlay isolation, and clean crash diagnostics.
  A focused current-head 2026-07-01 minimal Apple Silicon matrix at
  `/tmp/steam-bridge-macos-overlay-matrix-minimal-direct-helpers-20260701-070531`
  rebuilt and signed the same arm64-only Electron `43.0.0` package, reused the
  stable App ID `480` shortcut without restarting Steam, and passed all 11
  minimal cases after adding named direct helpers. It exercised direct
  `openWeb(...)`, `openStore(...)`, `openFriends(...)`, and
  `openDialog(...)` calls plus the existing wait-helper, duplicate-open, and
  passive notification cases, with visible Steam web content where applicable,
  active/inactive callbacks, close/back-to-app proof, parked zero-FPS state,
  disabled needs-present polling, zero managed overlay timing, managed
  child-overlay isolation, and clean crash diagnostics.
  A focused current-head 2026-07-01 minimal Apple Silicon matrix at
  `/tmp/steam-bridge-macos-overlay-matrix-minimal-direct-checkout-20260701-071929`
  rebuilt and signed the same arm64-only Electron `43.0.0` package, reused the
  stable App ID `480` shortcut without restarting Steam, and passed all 11
  minimal cases after adding named direct checkout target helpers. Its
  duplicate-open guard now proves direct target, shortcut/controller,
  `openCheckoutIfAvailable(...)`, and `openCheckoutAndWaitIfAvailable(...)`
  helpers all return `null` while a managed overlay is already opening, and that
  the checkout wait helper does not start its transaction operation in that busy
  state. The same run re-proved direct web/store/Friends/dialog helpers,
  wait-helper open/close, passive notification priming, visible Steam web
  content where applicable, close/back-to-app proof, parked zero-FPS state,
  disabled needs-present polling, zero managed overlay timing, managed
  child-overlay isolation, and clean crash diagnostics.
  A focused current-head 2026-07-01 minimal Apple Silicon matrix at
  `/tmp/steam-bridge-macos-overlay-matrix-20260701-073909`
  rebuilt and signed the same arm64-only Electron `43.0.0` package, reused the
  stable App ID `480` shortcut without restarting Steam, and passed all 11
  minimal cases after the smoke app moved managed open-status snapshots and
  duplicate-open proof onto the named status helpers. The duplicate-open guard
  now requires `getWebOpenStatus(...)`, `getStoreOpenStatus(...)`,
  `getFriendsOpenStatus()`, and `getCheckoutOpenStatus(...)` to report
  `canOpen=false`, `canWait=false`, `reason=opening`, and
  `waitReason=opening` while a managed overlay is already opening. The same run
  re-proved direct web/store/Friends/dialog helpers, wait-helper open/close,
  passive notification priming, visible Steam web content where applicable,
  close/back-to-app proof, parked zero-FPS state, disabled needs-present
  polling, zero managed overlay timing, managed child-overlay isolation, and
  clean crash diagnostics.
  A focused current-head 2026-07-01 minimal Apple Silicon matrix at
  `/tmp/steam-bridge-macos-overlay-matrix-open-statuses-20260701-080050`
  reused the signed arm64-only Electron `43.0.0` package and stable App ID
  `480` shortcut without restarting Steam, then passed all 11 minimal cases
  after the summary auditor began requiring named open-status snapshots from
  every smoke result. Every summary row reported `openStatuses=true`, proving
  the builder-facing `get*OpenStatus(...)` diagnostics stayed wired for direct
  web/store/Friends/dialog opens, `openAndWait(...)` routes, duplicate-open
  suppression, and passive notification priming while preserving the same
  close/back-to-app, zero-FPS parking, zero managed timing, isolation, and
  crash checks.
  A current-head persistent Apple Silicon matrix at
  `/tmp/steam-bridge-macos-overlay-matrix-persistent-checkout-operation-20260701-083629`
  rebuilt and signed the same arm64-only Electron `43.0.0` package, reused the
  stable App ID `480` shortcut without restarting Steam, launched one
  Steam-owned smoke process/control-server lifecycle, and passed all 45
  persistent cases after the macOS summary auditor began printing
  `checkoutOperation=true` beside `openStatuses=true`. A direct artifact probe
  verified all 45 smoke snapshots contained
  `snapshot.overlay.openStatuses.checkoutOperation` with a checkout target
  snapshot and `canStartOperation` boolean; 14 were ready, 30 correctly reported
  `overlay-active`, and one readiness preflight correctly reported
  `overlay-not-ready`. The run preserved the same web/store/Friends/dialog,
  shortcut/toggle, passive progress/unlock toast, checkout approval/prepare,
  close/back-to-app, parked zero-FPS, managed isolation, and clean crash
  diagnostics.
  A focused Apple Silicon minimal matrix at
  `/tmp/steam-bridge-macos-overlay-matrix-minimal-full-ifavailable-fixed-20260701-090347`
  then rebuilt and signed the same arm64-only Electron `43.0.0` package and
  passed all 11 Steam-launched cases after the duplicate-open guard began
  proving every named managed target's direct and wait-style `IfAvailable`
  helpers. That live run caught and re-proved the checkout-operation status
  ordering: while another overlay is already opening,
  `getCheckoutOperationStatus()` reports `reason: "opening"` before any
  transient `overlay-not-ready` diagnostics, so purchase buttons do not start
  `InitTxn` during a managed overlay open.
  A focused current-head 2026-07-01 minimal Apple Silicon matrix at
  `/tmp/steam-bridge-macos-overlay-matrix-minimal-direct-open-status-20260701-091919`
  then reused the signed arm64-only Electron `43.0.0` package and stable App ID
  `480` shortcut without restarting Steam, and passed all 11 Steam-launched
  cases after direct managed opens began using the same status gate as
  `openIfAvailable(...)`. Unit coverage proves direct opens now throw before
  activation when fresh diagnostics already show `overlay-not-ready` or
  `steam-unavailable`; follow-up shortcut coverage proves programmatic shortcut
  opens use the same fresh status gate before resolving dynamic target callbacks
  for Steam-stopped, native-host-unavailable, and non-waiting overlay-not-ready
  paths. The live run re-proved the happy path for direct
  web/store/Friends/dialog opens, wait-style web/store/Friends/dialog routes,
  duplicate-open suppression, passive toast priming, visible Steam web content,
  close/back-to-app proof, parked zero-FPS presenter state, zero managed
  timing, managed isolation, and clean crash diagnostics.
  A focused current-head 2026-07-01 checkout Apple Silicon matrix at
  `/tmp/steam-bridge-macos-overlay-matrix-checkout-readiness-before-inittxn-20260701-093251`
  rebuilt and signed the same arm64-only Electron `43.0.0` package and passed
  all four Steam-launched checkout cases after `openCheckoutAndWait(...)` began
  waiting for Steam overlay readiness before invoking the transaction
  operation. Unit coverage proves a not-yet-ready overlay leaves the
  transaction operation untouched and reports only a sanitized pending checkout
  snapshot on readiness timeout. Follow-up unit coverage also proves
  `withCheckoutPrepared(...)` waits through temporary `overlay-not-ready`
  before calling lower-level transaction/preparation callbacks, while
  standalone `prepareForCheckout()` refuses to prime the native surface while
  Steam is stopped or the overlay is not ready; the live run re-proved
  prepare-only checkout,
  direct synthetic approval checkout, managed Shift+Tab checkout, programmatic
  checkout `openAndWait(...)`, visible Steam web content for web-close paths,
  close/back-to-app proof, parked zero-FPS presenter state, zero managed
  timing, managed isolation, and clean crash diagnostics.
  A later focused current-head 2026-07-01 checkout Apple Silicon matrix at
  `/tmp/steam-bridge-macos-overlay-matrix-20260701-102924` rebuilt and signed
  the same arm64-only Electron `43.0.0` package, reused the stable App ID `480`
  shortcut without restarting Steam, and passed all four checkout cases after a
  first attempt caught that `withCheckoutPrepared(...)` could still run during
  launch-time `overlay-not-ready`. The fixed helper now waits for readiness
  before invoking the wrapped split-step callback, so prepare-only checkout no
  longer needs a startup timer. The run re-proved prepare-only checkout, direct
  synthetic approval checkout, managed Shift+Tab checkout, programmatic checkout
  `openAndWait(...)`, visible Steam web content for web-close paths,
  close/back-to-app proof, parked zero-FPS presenter state, zero managed timing,
  managed isolation, and clean crash diagnostics.
  A focused current-head 2026-07-01 checkout Apple Silicon matrix at
  `/tmp/steam-bridge-macos-overlay-matrix-checkout-redacted-20260701-132412`
  then reused the signed arm64-only Electron `43.0.0` package and stable App ID
  `480` shortcut without restarting Steam and passed prepare-only checkout,
  direct checkout approval, managed Shift+Tab checkout, and programmatic
  shortcut checkout `openAndWait(...)` with live command logs redacting checkout
  transaction inputs as `REDACTED`. The run re-proved named open-status and
  checkout-operation diagnostics, visible checkout web content for waited close
  probes, close/back-to-app proof, parked zero-FPS presenter state, zero managed
  timing, managed isolation, one Metal presenter-backed overlay target under
  game ID `480`, and clean crash diagnostics. This remains public App ID `480`
  routing evidence; real purchase-content proof still requires a configured
  product in a real Steam app.
  A focused current-head 2026-07-01 minimal Apple Silicon matrix at
  `/tmp/steam-bridge-macos-overlay-matrix-20260701-111335` reused the signed
  arm64-only Electron `43.0.0` package and stable App ID `480` shortcut without
  restarting Steam, ran the strengthened signing verifier before launch, and
  passed all 11 minimal cases with the matrix requiring direct-open
  readiness-status evidence for direct web/store/Friends/dialog actions. The
  smoke app records sanitized readiness-status evidence and waits through
  launch-time `overlay-not-ready` with `waitForOverlayReady()` before invoking
  named direct helpers. It re-proved direct web/store/Friends/dialog opens,
  wait-style web/store/Friends/dialog routes, duplicate-open suppression,
  passive toast priming, visible Steam web content, close/back-to-app proof,
  parked zero-FPS presenter state, zero managed timing, managed isolation, and
  clean crash diagnostics from the Apple Silicon package path.
  A current-head 2026-07-01 core Apple Silicon matrix at
  `/tmp/steam-bridge-macos-overlay-matrix-20260701-112850` reused the same
  signed arm64-only Electron `43.0.0` package and stable App ID `480` shortcut
  without restarting Steam, then passed all 31 core cases after the checkout
  approval path joined the direct readiness-status proof. The smoke app now
  records sanitized checkout-operation readiness and waits through launch-time
  `overlay-not-ready` with `waitForOverlayReady()` before starting
  `openCheckoutAndWait(...)`, keeping purchase-route plumbing aligned with the
  same side-effect-free readiness policy already used by direct target opens.
  A later unit-hardening slice moved generic direct `openAndWait(...)` through
  the same fresh status gate as named status and `IfAvailable` helpers. Direct
  wait helpers now fail hard blockers such as `steam-unavailable` before native
  presenter activation, still wait through temporary `overlay-not-ready`
  readiness for verified managed targets, and preserve the checkout path's
  existing operation-scoped activation hold while it opens the approval route.
  A current-head 2026-07-01 core Apple Silicon matrix at
  `/tmp/steam-bridge-macos-overlay-matrix-20260701-114530` reused the signed
  arm64-only Electron `43.0.0` package and stable App ID `480` shortcut without
  restarting Steam, then passed all 37 core cases after adding direct
  readiness-status proof for profile, players, community, stats, achievements,
  and user chat helpers. A follow-up current-head persistent Apple Silicon
  matrix at `/tmp/steam-bridge-macos-overlay-matrix-20260701-115219` reused the
  same package and shortcut without repackaging or restarting Steam, launched
  one Steam-owned smoke process/control server, and passed all 51 persistent
  cases with the same direct helper evidence plus the existing open/wait,
  shortcut, checkout, passive notification, close/back-to-app, parked zero-FPS,
  zero managed timing, managed isolation, and clean crash-diagnostic checks.
  A current-head 2026-07-01 full Apple Silicon matrix at
  `/tmp/steam-bridge-macos-overlay-matrix-20260701-120932` reused that same
  signed package and stable shortcut without repackaging or restarting Steam,
  then passed all 55 process-per-case routes with the same direct helper
  evidence plus the broader waited route, passive toast, checkout, shortcut,
  dialog-equivalent, close/back-to-app, parked zero-FPS, zero managed timing,
  managed isolation, and clean crash-diagnostic checks.
  A focused current-head checkout matrix at
  `/tmp/steam-bridge-macos-overlay-matrix-20260701-123019` reused the same
  signed Apple Silicon package and stable App ID `480` shortcut after adding an
  app-facing checkout app-ID guard. It passed prepare-only checkout, direct
  checkout approval, managed Shift+Tab checkout, and programmatic shortcut
  checkout `openAndWait(...)` with one Metal presenter-backed overlay target,
  active/inactive callbacks where expected, visible checkout web content for
  waited close probes, parked zero-FPS state, zero managed timing, managed
  isolation, and clean crash diagnostics. Unit coverage now proves
  `openCheckoutAndWait(...)` checks any app ID embedded in an `InitTxn`/checkout
  envelope against the initialized Steam app ID before opening Steam UI, keeps
  mismatch errors redacted, releases the scoped presenter hold, and does not
  leak wrong-app transaction IDs into overlay calls. The public
  `checkoutTargetFromResult(initTxnResponse, { expectedAppId })` helper gives
  split-step and shortcut flows the same wrong-app guard.
  A follow-up focused current-head checkout matrix at
  `/tmp/steam-bridge-macos-overlay-matrix-20260701-124434` rebuilt and signed
  the arm64 Electron `43.0.0` smoke package after the smoke app's split-step
  shortcut checkout target began passing `{ expectedAppId: APP_ID }` into that
  helper. It passed prepare-only checkout, direct checkout approval, managed
  Shift+Tab checkout, and programmatic shortcut checkout `openAndWait(...)`
  with close/back-to-app proof, parked zero-FPS state, zero managed timing,
  managed isolation, one Metal presenter-backed overlay target under game ID
  `480`, and clean crash diagnostics.
  A current-head 2026-07-01 core Apple Silicon matrix at
  `/tmp/steam-bridge-macos-overlay-matrix-shortcut-recovery-20260701-133627`
  rebuilt and signed the arm64 Electron `43.0.0` package, reused the stable App
  ID `480` shortcut without restarting Steam, and passed all 37 core cases
  after macOS shortcut suspension recovery hardening. The run re-proved every
  managed Shift+Tab target, direct and waited overlay routes, passive toasts,
  checkout approval and prepare-only, close/back-to-app proof, zero-FPS
  parking, zero managed timing, managed isolation, and clean crash diagnostics.
  Unit coverage now proves a native-host-unavailable transition while the macOS
  shortcut fallback is suspended restores focus and re-registers the fallback
  shortcut only after confirming the overlay is not still active.
  A focused current-head minimal Apple Silicon matrix at
  `/tmp/steam-bridge-macos-overlay-matrix-dynamic-shortcut-20260701-140139`
  rebuilt and signed the arm64-only Electron `43.0.0` package, reused the stable
  App ID `480` shortcut without restarting Steam, and passed all 11 minimal
  cases after dynamic shortcut `IfAvailable` hardening. Unit coverage now proves
  dynamic shortcut availability helpers resolve the target, re-check target
  open/wait status, return `null` for unavailable or unwaitable resolved
  targets without activating Steam overlay UI, and preserve explicit throwing
  behavior for unsupported targets.
  A follow-up current-head readiness-race slice now proves in unit coverage
  that direct `openIfAvailable(...)`, waited `openAndWaitIfAvailable(...)`,
  dynamic shortcut waits, and checkout waits return `null` if Steam stops
  before overlay activation; the checkout helper leaves the transaction callback
  uncalled, while the throwing waited route still rejects before activation. A
  live Apple Silicon minimal rerun at
  `/tmp/steam-bridge-macos-overlay-matrix-ifavailable-readiness-clean-20260701-142457`
  passed the passive presenter-ready case, then failed the first active web
  case in Steam's named IPC layer (`errno: 28`, repeated `gameoverlayui`
  launches, `overlayEnabled=false`). Clearing 611 stale
  `/private/tmp/steam_chrome_overlay_uid501_spid*` entries reduced the stale
  temp count, but Steam remained logged off, so further live proof is blocked
  on local Steam client recovery rather than presenter code. The matrix-owned
  Steam startup/shutdown cleanup now removes stale
  `/private/tmp/steam_chrome_{overlay,shmem}_uid*_spid*` entries after Steam is
  fully stopped, alongside orphan `ipcserver` and `steam.pipe` cleanup.
- BrowserWindow-only overlay support is not proven.
- Steam launch, app ID, auth, and callbacks are not enough to claim overlay
  support.

Next work:

1. Run real purchase-content and `InitTxn` proof from a real configured Steam
   app ID; App ID `480` only proves generic checkout routing. Use the smoke
   app's private checkout JSON file input for artifact capture so transaction
   responses stay outside the repository and launch arguments. The focused
   macOS `--suite checkout` run can pair `--app-id <your-app-id>`,
   `--checkout-json-file <path>`, and `--require-microtxn-callback`, then audits
   checkout prepare-only, direct checkout, managed Shift+Tab checkout, and
   programmatic checkout shortcut/open-and-wait with the expected app ID plus
   `checkoutSource=json-file` without recording the JSON path.
2. Keep code signing requirements explicit in docs and examples. The package now
   publishes `templates/macos-steam-env-launcher.c` plus
   `templates/entitlements.steam.macos.plist`, plus the
   `steam-bridge-prepare-macos-app` CLI that renames Electron, installs the
   launcher as `CFBundleExecutable`, signs both executables, and runs the
   verifier. The package also exposes `steam-bridge/electron-builder` with
   `prepareMacosSteamAppAfterPack(context, { skipSign: true })` and
   `verifyMacosSteamAppAfterSign(context)`, so `electron-builder` apps can put
   the native launcher rewrite in `afterPack`, let their normal Apple signing
   pipeline sign with the Steam Bridge entitlement template, and verify the
   final signed shape from `afterSign`. The generic Electron example uses that
   package CLI instead of carrying private launcher/signing glue. The entitlement
   template enables `com.apple.security.cs.allow-dyld-environment-variables` and
   `com.apple.security.cs.disable-library-validation`, and omits App Sandbox.
   The launcher template is app-name generic: package tooling renames Electron to
   `<AppExecutable>.electron`, compiles the launcher back to `<AppExecutable>`,
   keeps that launcher as `CFBundleExecutable`, signs both executables, and now
   verifies that the bundle entrypoint carries Steam Bridge's launcher identity
   marker while the renamed Electron executable does not.
   Ad-hoc signing is still not enough to claim shipped macOS overlay support;
   real shipped apps must apply equivalent entitlements through the normal Apple
   signing and notarization pipeline.
3. Keep the smoke app on the current stable Electron release, and rerun at least
   the persistent macOS matrix after Electron major-version bumps so overlay
   evidence follows the package developers are actually testing.

Pass criteria:

- Steam launch preserves overlay injection into the shipped app process.
- `overlayEnabled=true` with the native presenter path.
- Passive presenter does not steal focus, input, or visible pixels.
- Notification/toast appears over the app; the current matrix proves the managed
  passive-progress and unlock paths for App ID `480`.
- Web/store/Friends/dialog-equivalent overlays open and close with
  active/inactive callbacks, active shown presenter snapshots, and parked
  presenter state; checkout gets the same proof with a real app/product.
- Locked-screen or display-asleep macOS sessions do not create a native host,
  do not start managed overlay activation, and report an explicit unavailable
  reason until the session becomes interactive.
- No sustained high-FPS idle rendering.

Unsupported for now:

- Intel macOS. The project target is Apple Silicon macOS only.

## Windows Position

Windows should stay in the verification matrix, but it should not drive this
design. If the ordinary Electron overlay path works on Windows, keep it as the
default there and use the presenter only if a future regression proves it is
needed.

When Windows overlay activation fails while the Steam client window is itself
blank or white, stop live launch loops and capture Steam client health first.
The local Windows evidence has shown Steam CEF/ANGLE GPU context loss,
Steam webhelper GPU-process restarts, and overlay renderer
`CreateSwapChainForHWND` failures with `0x887A0022` in that state. That failure
mode must be separated from Steam Bridge native-load or API initialization
failures before changing the product overlay architecture.

Wrapper research points to two risky Chromium-flag comparisons worth keeping,
but neither should be the Windows default. The old Electron workaround is
Chromium's `in-process-gpu` switch, matching long-standing `steamworks.js` and
Greenworks guidance; local and public evidence now tie that switch to blank or
white windows on modern Chromium/Electron. The other comparison is Electron plus
Chromium's `disable-direct-composition` switch: reports show it can address
white/stale overlay rendering, but `steamworks.js` issue #95 also ties that
switch to Alt+Tab ghost-window regressions. Steam Bridge therefore leaves the
Windows diagnostic profile on the plain render path by default, exposes
`-OverlayInProcessGpu 1` and `-OverlayDisableDirectComposition 1` as focused
diagnostics only, and requires any passing mode to include Alt+Tab, close,
back-to-app, and crash checks before it can become product guidance. Newer
wrapper work such as `steamworks-ffi-node` uses native OpenGL/Metal overlay host
surfaces across platforms, which remains useful contingency evidence, but it is
not the first Windows implementation path unless ordinary Electron proves
insufficient.

A July 2, 2026 wrapper scan compared Steam's own overlay requirements,
`steamworks.js`, Greenworks, `steamworks-ffi-node`, and Steamworks.NET guidance
plus open overlay issues. `steamworks.js` remains the most relevant
Electron-only comparison: its helper still adds `in-process-gpu` and
`disable-direct-composition`, while open issue evidence reports white overlay
surfaces without the composition switch and Alt+Tab ghost-window regressions
with that switch. Greenworks has recent repository activity but its Electron
overlay issue history is old enough to treat as background only. The newer
`steamworks-ffi-node` native-surface approach is active and useful fallback
evidence, but its 2026 open issues report frame-rate drops and lingering
Steam-running state after enabling its Electron overlay helper. Steam Bridge
therefore keeps Windows on the ordinary Steam-launched Electron path first,
keeps `disableDirectComposition` opt-in, and requires any native-presenter
fallback to prove FPS, shutdown, Alt+Tab, close, and back-to-app behavior in
the local Windows matrix before becoming a default.

A broader July 2, 2026 Windows source refresh checked Valve's overlay docs,
Valve's browser-game overlay FAQ, the Steam microtransaction implementation
guide, `ISteamFriends` route docs, Electron process/command-line/offscreen
rendering docs, the current Electron stable release index, `steamworks.js`
source and issue history, Electron/Greenworks overlay issues, Construct's
WebView2 overlay writeup, Smart App Control docs, DXGI error docs, and Raw Input
docs. The source-backed design direction is now narrower: the default Windows
path must not rely on legacy Chromium flags; the real product-quality fallback
is a Steam Bridge-owned D3D11 surface that behaves like a normal game render
target, with route-specific proof for web/store/Friends/checkout, passive
notification proof, shortcut/focus proof, and clean app shutdown. Valve's own
FAQ explicitly recommends an embedded Chromium rendered offscreen into a native
D3D window for browser-based games, but calls it difficult. That lines up with
the local D3D11 presenter evidence and argues against more Steam restart loops,
DirectComposition alpha experiments, or blind Electron flag changes.

A focused July 2, 2026 Windows route split also compared Steam Community URL
activation with Valve's native `ActivateGameOverlayToUser("steamid", ...)`
profile route. The native route emitted overlay activation and started
`gameoverlayui64`, but screenshots still showed only the smoke app and Steam's
overlay hint, while Steam webhelper logged Community `application_config`
errors. That rules out "switch profile to the native user API" as a complete
Windows fix. Keep investigating Steam Community overlay rendering and Steam
client webhelper health separately from Electron hook readiness.

A second July 2, 2026 native Windows control comparison used a tiny Steam
Bridge-owned diagnostic executable, not Electron. The control initializes Steam
as App ID `480`, creates a native OpenGL window, calls the flat Steam overlay
APIs, captures screenshots, and exits after an observation window. The first
Steam-launched `ActivateGameOverlayToUser("steamid", currentUser)` run at
`C:\Users\admin\AppData\Local\Temp\steam-bridge-windows-native-overlay-control-20260702-081410`
initialized Steam successfully, observed overlay readiness, started
`gameoverlayui64`, rendered continuously, and showed Steam Community profile
content visible on the desktop with a Back to Game overlay shell. That narrows
the Windows profile/community problem: the Steam client can render the profile
surface during a native OpenGL control run, while the Electron smoke route can
remain active/callback-only with no visible Community surface. This is still
only diagnostic evidence. Do not turn Windows into the macOS-style native
presenter path unless a later matrix proves that the ordinary Electron path
cannot be made reliable for the required routes. The env-file version of this
native control also exposed a local Smart App Control/App Control reputation
block for the freshly rebuilt generated executable, so repeat native-control
proof needs either the previously accepted binary, a reputable publisher-signed
binary, or an explicit policy-disabled development machine.

A current-head Windows native presenter slice on July 2, 2026 added the first
opt-in `windows-opengl` host under the shared native surface API and made active
mode behave more like a real game surface: foregrounded, non-click-through, and
not layered/tool-window styled while active. Focused Session 1 artifacts showed
the host rendering Steam overlay UI and receiving OS foreground plus SendInput
keyboard/mouse delivery, but Shift+Tab, Ctrl+W, Escape, and a click on the
visible Steam web close control all timed out before `GameOverlayActivated(false)`
or presenter parking. Keep the Windows native presenter as rendering/focus
evidence only. The next Windows design problem is Steam input consumption for
that host, not another Electron flag or Steam restart loop.

A follow-up focused Windows slice rebuilt the `windows-opengl` host with WndProc
diagnostics exposed in presenter snapshots and reran the managed modal web route
through the interactive Session 1 Steam shortcut. Artifact
`C:\Users\admin\steam-bridge-artifacts\native-presenter-wndproc-web-20260702-002`
passed `presenter-web-open-and-wait` with App ID `480`: visible overlay
activation, `GameOverlayActivated(true)`, a maintained SendInput mouse click
against the foreground native host, `GameOverlayActivated(false)`, presenter
parking, `openAndWait` completion, app focus return, and clean crash
diagnostics. The host WndProc counters recorded focus/activation traffic but no
left-button messages, which strongly suggests Steam consumed the close click
inside the overlay. The next Windows work is route expansion and regression
coverage, not another proof that the host can receive focus.

A later focused Windows store route check on July 2, 2026 kept Steam running and
ran only `presenter-store-open-and-wait` through the same interactive Session 1
shortcut. Artifacts
`C:\Users\admin\steam-bridge-artifacts\windows-native-presenter-store-20260702-120143`
and
`C:\Users\admin\steam-bridge-artifacts\windows-native-presenter-store-toggle-20260702-001`
both initialized Steam as App ID `480`, attached the `windows-opengl` host,
emitted `GameOverlayActivated(true)`, and showed the Steam overlay browser
spinner plus overlay toast without crash diagnostics or fresh Steam rendering
health failures. Neither a maintained click on the visible Steam web close
control nor a maintained Shift+Tab SendInput close produced
`GameOverlayActivated(false)`, presenter parking, or `openAndWait` completion.
Treat this as a route-specific Windows blocker: the host can be hooked and can
prove modal web close/back-to-app, but the store web surface is not yet a
reliable interactive Windows product route. The next implementation slice should
focus on Windows native-host input/focus/window-shape comparisons and store
route alternatives, not more Steam restarts or Electron Chromium flags.

A D3D11/DXGI Windows presenter comparison was added on July 2, 2026 behind
`STEAM_BRIDGE_WINDOWS_NATIVE_HOST_BACKEND=d3d11` and the Windows helper
`-NativeHostBackend d3d11` option. The first artifact
`C:\Users\admin\steam-bridge-artifacts\windows-d3d11-web-20260702-001` proved
the D3D11 host could show Steam overlay UI, but preserved a close-probe miss
because the old web close click targeted the host corner instead of Steam's
centered web panel. After the close probe switched to the foreground Steam web
panel coordinate, artifact
`C:\Users\admin\steam-bridge-artifacts\windows-d3d11-web-20260702-002` passed
the managed modal web `openAndWait` route from the interactive Session 1 Steam
shortcut with App ID `480`: visible overlay UI, `GameOverlayActivated(true)`,
SendInput click on the Steam web close control, `GameOverlayActivated(false)`,
presenter parking, app focus return, `openAndWait` completion, clean crash
diagnostics, and no leftover smoke or `gameoverlayui64` processes. Keep D3D11
opt-in until route expansion proves it at least as broadly as the WGL presenter.

The first D3D11 route expansion, artifact
`C:\Users\admin\steam-bridge-artifacts\windows-d3d11-store-20260702-141901`,
passed `presenter-store-open-and-wait` with `-StoreRoute web` through the same
interactive Session 1 Steam shortcut and App ID `480`. The D3D11 host rendered
visible Steam store overlay UI, the foreground-window web close click returned
focus to the Electron game window, Steam emitted active and inactive overlay
callbacks, the presenter parked, `openAndWait` completed, and crash diagnostics
remained clean with no leftover smoke or overlay helper processes. This makes
D3D11 the current Windows native-presenter candidate for further route
expansion. A follow-up artifact,
`C:\Users\admin\steam-bridge-artifacts\windows-d3d11-friends-20260702-142741`,
then passed `presenter-friends-open-and-wait` through the same managed
Steam-launched path with visible Friends/chat UI, close/back-to-app proof,
active/inactive callbacks, presenter parking, `openAndWait` completion, and
clean crash diagnostics. A later checkout approval-route artifact,
`C:\Users\admin\steam-bridge-artifacts\windows-d3d11-checkout-20260702-143311`,
passed `presenter-checkout` with the public synthetic transaction ID path:
direct open-status gating, visible Steam checkout approval web UI, active and
inactive overlay callbacks, presenter parking,
`overlay:presenter-checkout-open-and-wait-complete`, focus return, and clean
crash diagnostics. This is approval-route plumbing proof, not real configured
product purchase proof. Keep D3D11 non-default until the broader
Community/profile-style route set, remaining close/input edge cases, and real
configured-product checkout clear the same gates.

A focused D3D11 shortcut-keyboard probe then found a passive-host focus bug:
artifact
`C:\Users\admin\steam-bridge-artifacts\windows-d3d11-shortcut-keyboard-20260702-145900`
sent a real `Shift+Tab` chord after `overlay:presenter-shortcut-ready`, but the
foreground window was the transparent native host and its WndProc received the
key messages. No `overlay:shortcut-open` event or Steam activation followed
because Electron never saw the shortcut. The Windows host primitive now treats
passive attached hosts as truly non-activating by showing them with
`SW_SHOWNOACTIVATE` and returning `MA_NOACTIVATE` for `WM_MOUSEACTIVATE` while
`WS_EX_NOACTIVATE` is present. `cargo-xwin check -p steam-bridge-native
--target x86_64-pc-windows-msvc` validates the Windows target, but live proof of
the fix is paused by local Smart App Control/App Control reputation:
`windows-d3d11-shortcut-keyboard-20260702-1508` blocked the fresh rebuilt
`.node`, and `windows-direct-shortcut-keyboard-20260702-1511` blocked the local
Steam runtime DLL before any overlay case launched. Do not spend more time on
Steam restarts for this state; the next live Windows shortcut pass needs a
trusted/reputable publisher-signed package or an explicitly policy-disabled test
machine.

A later Windows Community-route diagnostic at
`C:\Users\admin\steam-bridge-artifacts\windows-d3d11-community-nativepath-20260702-001`
used the new `-NativePath` override to get past local App Control and launched
only `19-managed-community-open-and-wait` through the interactive Steam
shortcut. Preflight recorded `nativePathOverride=true`, live readiness passed,
and the native-load gate initialized Steam as App ID `480` through the accepted
override. Treat the route result as a negative diagnostic, not D3D11 proof:
because the override pointed at an older accepted native addon, lifecycle
snapshots reported `backend=none` and no native host. Steam emitted
`GameOverlayActivated(true)` for the Community route, but close-probe
screenshots showed a white smoke window with no visible Community overlay, the
foreground stayed on the smoke app, no `GameOverlayActivated(false)` arrived,
and no smoke result was written before the stuck task was stopped and cleaned
up. The next useful Windows route expansion requires a current trusted native
addon or a policy-disabled Windows test machine; repeating this route with the
older override cannot validate the current D3D11 presenter.

The Windows matrix now protects that boundary mechanically. Native-presenter
proof runs record `expectedNativeHostBackend` in `matrix-manifest.json`, and the
native-load gate switches from the generic `none` smoke action to
`presenter-ready` whenever the Windows native presenter is requested. The smoke
verifier then requires the requested backend and an attached native host before
any route case is allowed to run. A focused Session 1 replay at
`C:\Users\admin\steam-bridge-artifacts\codex-native-backend-gate-stale-override-session1-20260702-001`
confirmed the stale accepted `-NativePath` override is rejected up front for not
proving `windows-d3d11`.

The Windows smoke harness now exposes the store route explicitly:
`STEAM_BRIDGE_SMOKE_STORE_ROUTE`, `--steam-bridge-smoke-store-route`, and the
matrix `-StoreRoute web|native` switch all flow into
`steamOverlay.open({ type: "store", route })` and
`openAndWait({ type: "store", route })`. A follow-up native-route artifact,
`C:\Users\admin\steam-bridge-artifacts\windows-native-presenter-store-native-20260702-122846`,
used `-StoreRoute native` against App ID `480` from interactive Session 1. It
activated Steam's native `ActivateGameOverlayToStore` path, foregrounded
`steamwebhelper`, emitted `GameOverlayActivated(true)`, reported
`overlayEnabled=true` and `overlayNeedsPresent=true`, and wrote clean crash
diagnostics. The close probe was also hardened during this run: it now writes
the long probe script to `close-probe.ps1` instead of launching an oversized
`-EncodedCommand`, and its web-close click target is derived from the native
presenter's recorded bounds instead of the foreground webhelper's misleading
`1024x768` rect. The probe sent a real mouse click to `(1445,244)` with
`coordinateSource="presenter-bounds"`, matching the visible Back to Game close
button in the screenshots, but Steam remained active until the managed
90-second close wait timed out. This confirms the native store route opens and
renders, but it is still not close/back-to-app proof on Windows.

A current-package Windows run at
`C:\Users\admin\steam-bridge-artifacts\windows-render-health-current-20260702-130004`
re-verified the new default render policy from the interactive Session 1
desktop: the plain default path with `-OverlayInProcessGpu` unset rendered
visible smoke UI and reported `default-render-health-ok`; explicit
`-OverlayInProcessGpu 1` still produced a blank client area; and explicit
`-OverlayDisableDirectComposition 1` rendered visibly but remains diagnostic.
The follow-up focused native-presenter web run under
`C:\Users\admin\AppData\Local\Temp\steam-bridge-windows-overlay-matrix-20260702-130128`
launched through Steam as App ID `480`, passed Steam client rendering health,
attached `gameoverlayui64`, emitted `GameOverlayActivated(true)`, and focused
the `windows-opengl` host. Its screenshots showed a black native Steam overlay
surface rather than visible web chrome, the maintained SendInput click landed at
the expected presenter-bounds close coordinate with `lastError=0`, and Steam
never emitted `GameOverlayActivated(false)` before the 90-second close wait
timed out. The renderer log showed OpenGL hook setup and
`Failed getting currently registered raw input devices`, but no fresh Steam
CEF/GPU/swap-chain health blocker. Treat this as a Windows native-presenter
content/input blocker, not a return of the old blank Steam client or Electron
render-health problem. Microsoft's Raw Input docs also matter for this symptom:
raw input is opt-in, and only one window per raw-input device class can be
registered in a process. If Steam Bridge adds any Windows raw-input mitigation
for the presenter, it must be an explicit app-window ownership decision rather
than a library-level registration that could steal keyboard or mouse delivery
from the app.

Windows gates:

- packaged helper preflight reports App Control/SAC state, parsed
  `CiTool.exe -lp` policy inventory, enforced policy names,
  `VerifiedAndReputableDesktop*` enforcement, executable and native addon
  Authenticode status, Zone.Identifier streams, and recent Code Integrity block
  events before long live overlay runs;
- packaged Windows matrix copies that preflight App Control summary into
  `native-load-gate-app-control.json` before the native-load gate, so gate
  failures name the exact enforced policy that made Authenticode-only evidence
  insufficient;
- native-load gate failures write `native-load-gate-blocker.json` with a stable
  blocker code, post-gate Code Integrity events, relevant artifact paths, and
  next actions instead of forcing future automation to scrape helper logs;
- `scripts/summarize-windows-overlay-matrix.cjs` audits full Windows matrix
  roots, readiness/preflight-only captures, and native-load blocker artifacts,
  including the App Control blocker shape, case smoke results, overlay callbacks,
  and clean crash diagnostics;
- packaged Windows matrix runs write a sanitized `matrix-manifest.json` before
  preflight, and the summary auditor uses it to prove completed artifact roots
  contain every intended suite or `-OnlyCase` result with required events,
  activation/no-activation callbacks, and managed close/park completion evidence;
- packaged Windows matrix preflight runs a direct `none` smoke action from the
  exact app bundle and requires real Steam initialization plus clean crash
  diagnostics before any Steam-launched overlay case, because Authenticode
  `Valid` alone does not prove a local build can pass SAC/App Control policy;
- packaged Windows smoke bundle includes a repeatable overlay matrix runner that
  uses the ordinary Electron/Steam path for web, store, Friends, and passive
  notifications before any managed/presenter comparison cases;
- packaged Windows smoke bundle includes a repeatable Authenticode signing
  helper for `.exe`, `.dll`, and `.node` files so real publisher-cert builds can
  pass the native-load gate before overlay testing;
- existing Electron overlay path still passes;
- `disableDirectComposition` remains opt-in and is covered by smoke helper
  launch-option diagnostics when used;
- native package still loads;
- checkout/web/store/Friends/dialog-equivalent overlay smoke checks do not
  regress;
- checkout approval-route plumbing and passive notification smoke actions can
  be launched through the packaged Windows helper for baseline coverage.
- Windows packages used for live overlay proof are Authenticode-signed with a
  trusted/reputable publisher certificate. A July 1, 2026 Windows 11 test
  proved that Smart App Control can block the unsigned
  `steam_bridge_native.win32-x64-msvc.node` before `SteamAPI_Init`, even when the
  Windows package was built on macOS from the correct GitHub x64 prebuild.
  Local self-signed trust is not enough for that SAC policy, so generic Windows
  smoke proof needs either a real signed package or an explicitly SAC-disabled
  development machine. The packaged smoke app now includes
  `windows-app-control-dev-mode.ps1` for disposable test rigs: it reports
  `VerifiedAndReputablePolicyState`, captures `CiTool.exe -lp`, and can
  explicitly set the machine-wide state to Off or Enforce before refreshing with
  `CiTool.exe -r`. It is not a per-app allowlist and does not replace
  trusted/reputable publisher signing for release proof.
- After the helper was packaged and the disposable Windows laptop was switched
  to `VerifiedAndReputablePolicyState=0`, the fresh current package passed
  interactive Session 1 readiness and the D3D11 native-load gate. A stale
  focused web sequence under
  `C:\Users\admin\steam-bridge-artifacts\windows-d3d11-web-hidden-clickclose-20260703-001`
  timed out before `GameOverlayActivated(false)` and presenter parking, so that
  artifact remains a web-close miss rather than a product pass. The later
  refreshed package at
  `C:\Users\admin\steam-bridge-artifacts\windows-d3d11-shortcut-keyboard-escapeclose-20260702-190424`
  proved the managed keyboard shortcut route through the same Windows D3D11
  presenter: Steam-launched App ID `480`, real Shift+Tab to Friends, active
  callback, `escape-sendinput` close, `overlayClosed=true`,
  `overlayParked=true`, `overlayComplete=true`, passive transparent/click-through
  parked presenter at `currentFps=0`, no lifecycle errors, no crash dumps, and
  only Steam left running after cleanup. Keep D3D11 opt-in until passive
  notifications, Community/profile-style routes, real configured-product
  checkout, and any remaining web-close edge cases pass the same complete-result
  gates.

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
  overlayNeedsPresentPollingEnabled: boolean;
  lastOverlayEvent?: unknown;
  lastError?: unknown;
}
```

Keep the current `getOverlayDiagnostics()` fields and add presenter diagnostics
beside them instead of replacing them. Snapshots now include the selected
`backend` (`x11-glx`, `macos-metal`, `macos-opengl`, or `none`) so Deck,
Linux, macOS, and fallback artifacts can assert which native host path is in
use without scraping logs. On macOS, snapshots and
`getOverlayDiagnostics()` should report
`overlayNeedsPresentPollingEnabled=false` by default so artifacts prove Steam
Bridge avoided the crash-prone `BOverlayNeedsPresent()` SDK call instead of
merely observing `overlayNeedsPresent=false`. The public JavaScript wrappers
also short-circuit this macOS default before native code: `overlayNeedsPresent()`
returns `false`, and `getOverlayDiagnostics()` assembles safe diagnostics
without calling the native combined diagnostics path. There is no macOS opt-in
because the known failure mode is a process crash, not a recoverable diagnostic
error. Snapshots also
include `bounds` when Electron's
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
7. Keep macOS Apple Silicon Metal modal overlay mode green for web, store,
   Friends, profile, community, stats, achievements, user, and
   dialog-equivalent wait routes. The current full and persistent macOS matrices
   pass these routes with paired active/inactive callbacks, focus return, parked
   presenter state, and no crash diagnostics.
8. Keep macOS passive notification/toast behavior green. The current matrix
   verifies managed achievement progress and unlock toasts for App ID `480`
   without modal overlay activation.
9. Keep macOS checkout plumbing green. The current matrix verifies synthetic
   checkout approval-route open, close, focus return, parked presenter state,
   checkout prepare-only readiness without modal activation, and
   `openCheckoutAndWait(...)` completion after close/parking. The focused
   macOS checkout suite now passes the same generic App ID `480` plumbing path
   for prepare-only, direct checkout, managed Shift+Tab checkout, and
   programmatic checkout shortcut/open-and-wait. Real purchase-content and
   `InitTxn` proof remain app-specific and require a real configured Steam
   product.
10. Keep the presenter API as the recommended app-facing path for Electron.
    Continue treating raw social dialogs, raw overlay hotkey interception,
    real purchase content, and live lock/display-sleep captures as separate
    evidence tracks.

Current real-product checkout guardrail:

- The macOS matrix validates any private `--checkout-json-file` before package
  signing, shortcut work, Steam startup, or overlay launch. Validation resolves
  the file through `checkoutTargetFromResult(...)`, requires a checkout URL,
  Steam checkout URL, transaction ID, or `InitTxn` envelope, passes the matrix
  `--app-id` into that resolver so embedded app IDs use the runtime wrong-app
  guard, and prints only sanitized presence flags. The same resolver is exposed as
  `steam-bridge-validate-checkout-target --expected-app-id <app-id>` for
  standalone fixture checks. The standalone validator reports SDK-style
  `m_unAppID`/`m_nAppID` fields as present app IDs, including inside line-item
  arrays, without printing their values, matching the runtime checkout target
  parser. Malformed, incomplete, or app-ID-mismatched private captures fail
  early without echoing the file path, app ID, transaction ID, checkout URL, or
  return URL. The macOS summary auditor also scans smoke result JSON and
  lifecycle logs for raw checkout approval URLs, transaction/order IDs, return
  URLs, Steam IDs, configured-product item metadata, price/currency details, and
  private checkout CLI arguments, so private purchase artifacts fail closed if
  runtime redaction regresses after validation. Required real-checkout callback
  proof also verifies a redacted order ID presence marker so authorization
  evidence cannot be callback-only.

## Non-Goals

- Do not commit private app IDs, item definitions, publisher keys, transaction
  IDs, or private purchase URLs.
- Do not require app builders to copy an app-specific native overlay controller.
- Do not claim generic purchase support from App ID `480`; purchase and economy
  proof requires the real app and configured products.
- Do not keep a high-FPS transparent surface running forever while idle.
- Do not treat callback-only social overlay behavior as visual close/back-to-app
  proof.
