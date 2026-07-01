# Cross-Platform Overlay Status

Last updated: 2026-07-01

This tracks the current runtime evidence for the Electron smoke app on Linux x64,
Steam Deck, and macOS Apple Silicon. The public smoke target is Valve's SpaceWar
App ID `480`.

## Current Evidence

| Target | Status | Evidence |
| --- | --- | --- |
| Linux x64 | Verified through Steam Deck | The packaged Linux x64 smoke app launches on Steam Deck and initializes Steam as App ID `480`. The Linux package includes `linux-electron-smoke.sh` for direct, Steam-launched, and verification checks. A Deck-side `ldd -r` check of the packaged native binding did not report unresolved `steam_bridge_music_remote_*` symbols. |
| Windows x64 | Helper coverage implemented; live run pending | The packaged Windows x64 smoke app includes `windows-electron-smoke.ps1` for direct, Steam-launched, verification, and shortcut launch-option checks. The helper now accepts the same generic smoke action names used by Deck/macOS for web, store, Friends, dialog-equivalent, checkout, shortcut, and passive notification regression coverage. This keeps Windows in the verification matrix, but live Windows overlay behavior still needs to be run on a Windows Steam machine. |
| Steam Deck Game Mode | Verified for smoke coverage | A Steam-launched non-Steam shortcut reports `steamDeck=true`, `bigPicture=true`, `steamLaunch=true`, `overlayInjection=true`, `overlayEnabled=true`, and can emit overlay events. |
| Steam Deck Desktop Mode | Verified for smoke and managed overlay coverage | The same packaged app can be launched from Desktop Mode with `steamDeck=true`, `bigPicture=false`, `steamLaunch=true`, `overlayInjection=true`, and `overlayEnabled=true`. Desktop Mode uses the Electron `repaint` overlay profile by default. A 2026-06-29 full Deck Desktop overlay matrix at `/tmp/steam-bridge-deck-overlay-matrix-20260629-002449` passed 26 cases with 52 screenshots, covering managed web/store/Friends/dialog/user/community/stats/achievements surfaces, passive toasts, checkout readiness and approval-route plumbing, open-and-wait helpers, keyboard shortcut open/close, app focus return, presenter parking, and crash diagnostics. |
| macOS Apple Silicon | Verified for Steam-launched managed web/store/Friends/dialog/user/community/stats/achievements, synthetic checkout, shortcut, passive toasts, and signed package launch | The packaged macOS arm64 smoke app uses an in-bundle native launcher that preserves Steam overlay injection while setting `SteamAppId`, `SteamGameId`, and `SteamOverlayGameId` to App ID `480` before `exec`ing Electron. The package script ad-hoc signs both the native launcher and renamed Electron executable with Steam-compatible entitlements before live overlay testing. A 2026-06-29 full matrix at `/tmp/steam-bridge-macos-overlay-matrix-full-dialog-openwait-20260629-195732` passed 23 Steam-launched cases covering web/store/Friends/dialog, profile, players, community, stats, achievements, user chat, user SteamID, and every known high-level dialog-equivalent route through managed `openAndWait(...)`; passive progress/unlock toasts; synthetic checkout approval-route plumbing; managed Shift+Tab shortcut open/close for Friends, web, and store targets; and active/inactive callbacks where expected. A later core matrix at `/tmp/steam-bridge-macos-overlay-matrix-core-all-shortcuts-20260629-203243` expanded shortcut coverage to every supported presenter-backed target, passing 24 Steam-launched cases with Friends/web/store/checkout/profile/players/community/stats/achievements/user/dialog shortcut open/close, active shown presenter snapshots, app focus return, parked presenter state, interactive macOS host state, zero managed overlay timing, one `gameoverlayui` target, and no crash evidence. A fresh full run at `/tmp/steam-bridge-macos-overlay-matrix-full-close-wait-20260629-214233` passed all 31 Steam-launched cases after helper hardening and verified managed wait-helper shown, closed, and parked events for every active managed case, including user SteamID and all known dialog-equivalent routes. A 2026-06-30 core run at `/tmp/steam-bridge-macos-overlay-matrix-core-inittxn-envelope-20260630-000000` passed 24 cases after the smoke app began wrapping checkout test inputs in an `InitTxn`-style `response.params` envelope, proving the generic checkout unwrapping path with App ID `480` approval-route plumbing. A signed-package full run at `/tmp/steam-bridge-macos-overlay-matrix-full-signed-package-20260629-234357` then rebuilt and signed the smoke package and passed all 31 Steam-launched cases against that packaged/signing path, re-verifying web/store/Friends/dialog wait routes, passive toasts, checkout approval routing, every presenter-backed shortcut target, direct profile/players/community/stats/achievements/user wait routes, user SteamID, every high-level dialog-equivalent route, close/back-to-app proof, zero managed overlay timing, one overlay target, and no crash evidence. Non-store targets attach under game ID `480`; the Steam store surface can report the generated shortcut game ID while still emitting app ID `480` callbacks and passing close/back-to-app proof. |
| macOS Apple Silicon matrix automation | Implemented; full live coverage exercised except real purchase content | `scripts/macos-overlay-matrix.sh` dry-runs or executes repeatable Steam-launched macOS helper cases. It installs or updates one stable non-Steam shortcut with the native launcher env-file flag, restarts Steam only when that shortcut is added or materially changed, writes per-case launch state through the env file, and now preflights `getMacOverlayEnvironment()` before success suites so locked/asleep Macs fail clearly before case launch. Its `unavailable` suite is the matching expected-failure capture path for genuinely locked/asleep sessions: it records managed web, checkout-open, checkout-prepare, and programmatic shortcut open/wait fail-fast artifacts with `STEAM_OVERLAY_NATIVE_HOST_UNAVAILABLE`, plus passive achievement-progress no-host evidence, the detected `macos-screen-locked` or `macos-display-asleep` reason, no Steam overlay activation, and summary-audited presenter state. The normal suites collect result/diagnostic logs for web/store/Friends/dialog wait routes, passive toast gates, synthetic checkout approval-route plumbing, Shift+Tab shortcut routing, and common presenter-backed web targets. The packaged helper now enforces active shown presenter shape and interactive macOS host state during close and shortcut-open verification. Before live cases, the matrix runs `scripts/verify-macos-steam-signing.cjs` against the native launcher and renamed Electron executable, requiring the bundle `Info.plist` to name the native launcher as `CFBundleExecutable`, arm64-only slices, valid executable signatures, Steam overlay entitlements, and no App Sandbox entitlement. A fresh 2026-06-29 full run at `/tmp/steam-bridge-macos-overlay-matrix-full-dialog-openwait-20260629-195732` passed the broader 23-case suite without updating the stable shortcut or restarting Steam, with every known high-level dialog-equivalent route using the managed wait helper; a later core run at `/tmp/steam-bridge-macos-overlay-matrix-core-all-shortcuts-20260629-203243` added full presenter-backed shortcut coverage without updating the stable shortcut. A 2026-06-30 core run at `/tmp/steam-bridge-macos-overlay-matrix-core-inittxn-envelope-20260630-000000` exercised checkout approval through an `InitTxn`-style `response.params` envelope and passed the same summary auditor. The smoke checkout harness can now read a private `STEAM_BRIDGE_SMOKE_CHECKOUT_JSON_FILE`, and the macOS helper exposes that as `--checkout-json-file`, so future real-product artifacts can feed the actual `InitTxn` response through `openCheckoutAndWait(...)` without committing private data or placing transaction values in launch arguments; a focused 2026-06-30 packaged macOS run at `/tmp/steam-bridge-macos-checkout-json-20260630-030514` proved that JSON-file handoff with active/inactive callbacks, app-frontmost return, post-close parking at `currentFps=0`, and no crash evidence. The signed-package full artifact at `/tmp/steam-bridge-macos-overlay-matrix-full-signed-package-20260629-234357` passed after package-time ad-hoc signing of both smoke executables, keeping the launcher/signing requirements in the live 31-case matrix rather than only in static packaging checks. A focused signing-preflight artifact at `/tmp/steam-bridge-macos-overlay-matrix-minimal-signing-preflight-20260630-000117` rebuilt, signed, verified, and then passed the five-case minimal suite. It also runs `scripts/summarize-macos-overlay-matrix.cjs` after live matrices, and `npm run macos:overlay-matrix:summarize -- --artifact-root <path>` audits existing artifacts for Steam launch/injection identity, one `gameoverlayui` target attached to the smoke process, non-store game ID `480` attachment, interactive macOS host state, active shown presenter snapshots, managed wait-helper shown/closed/parked lifecycle events, zero managed overlay timing, passive notification callbacks, close-and-park lifecycle evidence, checkout `openCheckoutAndWait(...)` completion after close/parking, expected native-host-unavailable fail-fast artifacts, and crash diagnostics. Real purchase-content still requires a real Steam app ID with a configured product. |
| macOS lock/display-sleep host guard | Implemented with unit, verifier, and matrix capture coverage | The native macOS presenter reads CoreGraphics session and display state through `getMacOverlayEnvironment()`. When the screen is locked or the main display is asleep, persistent presenters and native sessions skip host creation, report `nativeHostUnavailableReason` as `macos-screen-locked` or `macos-display-asleep`, keep the presenter at `currentFps=0`, and retry lazy host attachment after the environment becomes available. Managed Electron overlay open/wait and checkout helpers now fail before Steam overlay activation with `SteamOverlayNativeHostUnavailableError` while that unavailable reason is present, so app code can check `code`, `reason`, and `macOverlayEnvironment` and fall back immediately instead of waiting for a timeout. The checkout helper also re-checks availability before opening the returned approval route, so a lock/sleep transition while `InitTxn` is pending releases the presenter hold and prevents a late checkout surface. Passive notification auto-priming skips native host work while unavailable but keeps the presenter registered so the next notification-producing call after unlock/wake primes normally. The macOS Shift+Tab fallback treats an already-unavailable host as a quiet no-op unless the app supplied `overlayShortcut.onError`, and host-unavailable transitions during its callback wait also avoid warning noise. Unit coverage simulates locked, display-asleep, post-unlock attach, pending checkout cancellation, passive notification retry, quiet shortcut behavior, fail-fast managed-open behavior, and the public `getNativeHostAvailability()` helper; smoke artifacts now record `snapshot.overlay.nativeHostAvailability`, and verifiers require it to agree with the presenter snapshot for `--require-native-host-unavailable-reason` cases. The macOS `--suite unavailable` matrix preserves those expected failure requirements from the manifest and refuses to run while macOS is interactive, so lock/asleep artifacts are captured explicitly rather than treated as success-run failures. |
| Desktop Mode Electron-only overlay | Partial | With Electron child overlay isolation disabled for investigation, the raw `dialog` action activates visible Steam desktop overlay UI, emits `callback:overlay-activated` with `active=true`, and starts one `gameoverlayui` attached to Electron's GPU process. Shift+Tab/Escape and an X-click probe did not return to the app, so this is callback/render evidence, not close/back-to-app proof. With default child isolation enabled, social rendering is not reliable. |
| Desktop Mode reusable native presenter web overlay | Verified for open, close, input, fullscreen, and back-to-app | The `presenter-web --web-modal true` action uses `client.overlay.createElectronSteamOverlay(mainWindow)` and `steamOverlay.open({ type: "web", ... })` with the reusable X11/GLX presenter. Deck Desktop testing showed the modal Steam web overlay, emitted paired `active=true` and `active=false` callbacks, returned to the running Electron app, left no crash dumps, and used a single `gameoverlayui` process attached to the main/native process. A focused fullscreen Deck run also used `presenter-shortcut --shortcut-target web --web-modal true`, which focused the app first, opened the Steam store web overlay through Shift+Tab, waited for lifecycle evidence of shortcut-open and active overlay events before capture, emitted `active=true` then `active=false`, returned focus to Electron, and parked with no post-close pumping. `electronConfigureSteamOverlay()` now scrubs Steam overlay preload entries for Electron children and adds Linux `no-zygote` isolation by default so Chromium GPU/renderer children do not become competing overlay targets. |
| Desktop Mode managed `openAndWait` web overlay | Verified for open, close, and promise completion after parking | The `presenter-web-open-and-wait --web-modal true` action uses `client.overlay.createElectronSteamOverlay(mainWindow).openAndWait(...)` against App ID `480`. A 2026-06-29 Deck Desktop fullscreen run wrote its smoke result while the Steam web overlay was active, closed through the web close probe, emitted `active=false`, returned focus to the Electron app, recorded `overlay:presenter-open-and-wait-complete` after close with `shown.overlayActive=true` and a parked presenter snapshot, and kept the post-close stable sample at `currentFps=0` with unchanged `pumpCount`. |
| Desktop Mode managed `openAndWait` store overlay | Verified for open, close, and promise completion after parking | The `presenter-store-open-and-wait` action uses `client.overlay.createElectronSteamOverlay(mainWindow).openAndWait({ type: "store", appId: 480 })`. The Deck runner and matrix summary require the same `overlay:presenter-open-and-wait-complete` evidence after `active=false`, with shown and parked presenter snapshots, extending the builder-facing one-call helper proof to the Steam store surface. The 2026-06-29 full Deck Desktop matrix passed this route under the same close/back-to-app and crash-diagnostic checks as the modal web route. |
| Desktop Mode managed `openAndWait` Friends List | Verified for open, close, and promise completion after parking | The `presenter-friends-open-and-wait` action uses `client.overlay.createElectronSteamOverlay(mainWindow).openAndWait({ type: "friends" })`. The Deck runner and matrix summary now require `overlay:presenter-open-and-wait-complete` after `active=false`, with shown and parked presenter snapshots, so the builder-facing one-call helper is covered for the social/Friends surface as well as generic web overlays. The 2026-06-29 full Deck Desktop matrix passed this route with visible overlay screenshots, app focus return, and no post-close pumping. |
| Desktop Mode managed `openAndWait` dialog equivalents | Verified for open, close, and promise completion after parking | The `presenter-dialog-auto-open-and-wait --dialog OfficialGameGroup` action uses `client.overlay.createElectronSteamOverlay(mainWindow).openAndWait({ type: "dialog", dialog, appId: 480 })`. A 2026-06-29 Deck Desktop fullscreen run opened the presenter-backed Steam Community app surface through the high-level dialog-equivalent router, wrote its smoke result while the overlay was active, closed through the web close probe, emitted `active=false`, returned focus to the Electron app, recorded `overlay:presenter-open-and-wait-complete` after close with shown and parked presenter snapshots, and kept the verifier's stable post-close sample at `currentFps=0` with unchanged `pumpCount`. |
| Managed Electron presenter geometry sync | Implemented with unit coverage | Native X11/GLX and macOS hosts realign to their parent window during presenter pumps. `createElectronSteamOverlay(...)` now also subscribes to BrowserWindow move, resize, fullscreen, maximize, restore, and show events in persistent-presenter mode and triggers one native presenter pump per event. This keeps the native surface aligned for Desktop Mode move/resize/fullscreen transitions without introducing an idle render loop. |
| Managed Electron overlay session fallback | Implemented as diagnostic coverage | `createElectronSteamOverlay(..., { presenterMode: "session" })`, `STEAM_BRIDGE_ELECTRON_OVERLAY_PRESENTER=session`, and `STEAM_BRIDGE_DISABLE_ELECTRON_OVERLAY_PRESENTER=1` disable the reusable persistent presenter and lazily use the older native-session lifecycle behind the same `steamOverlay.open(...)`, `withCheckoutPrepared(...)` / `prepareForCheckout()`, and shortcut bridge call sites. The Electron smoke app, packaged Linux helper, and Deck SSH runner now expose the same comparison through `STEAM_BRIDGE_SMOKE_PRESENTER_MODE` / `--presenter-mode session`, so Deck Desktop runs can switch presenter implementations without hand-editing wrapper launch options. This is an emergency compatibility switch for isolating presenter regressions; it may pump more aggressively while a session is open and is not the recommended Deck Desktop product path. |
| Desktop Mode reusable native presenter Friends List | Verified for open, close, input, and back-to-app | The `presenter-friends` action uses `client.overlay.createElectronSteamOverlay(mainWindow)` and `steamOverlay.open({ type: "friends" })`, which opens Steam Community chat through the same native web presenter path. Deck Desktop testing showed the Steam Friends List / chat UI, emitted `active=true`, returned to the running Electron app after the close probe, and used a single `gameoverlayui` process attached to the main/native process. A `steam://open/friends` URL opened a Steam loading spinner and is not the product path. |
| Desktop Mode reusable native presenter profile page | Verified for open, close, input, and back-to-app | The `presenter-profile` action uses `client.overlay.createElectronSteamOverlay(mainWindow)` and `steamOverlay.open({ type: "profile", steamId64 })`, which opens a Steam Community profile page through the same native web presenter path. A 2026-06-28 Deck Desktop run for the current user emitted paired `active=true` and `active=false` callbacks, captured profile web content in the native overlay host, returned focus to the Electron smoke app after the web close probe, used one `gameoverlayui` target attached to the main/native process with game ID `480`, and parked transparent/click-through at `currentFps=0` with no post-close pump-count increase or crash evidence. |
| Desktop Mode reusable native presenter user dialog equivalents | Verified for open, close, input, and back-to-app | The `presenter-user --user-dialog steamid` action uses `client.overlay.createElectronSteamOverlay(mainWindow)` and `steamOverlay.open({ type: "user", dialog: "steamid" })`, which maps the common `ActivateGameOverlayToUser("steamid", user)` profile case to the same presenter-backed Steam Community profile route. A 2026-06-28 Deck Desktop core matrix run for App ID `480` emitted paired `active=true` and `active=false` callbacks, captured visible Steam web content, returned focus to the Electron smoke app after the web close probe, used one `gameoverlayui` target attached to the app process, parked transparent/click-through at `currentFps=0`, and showed no post-close pump-count increase or crash evidence. The high-level user router also maps `chat` to the verified Steam Community chat/Friends surface: a 2026-06-29 focused Deck Desktop fullscreen run of `presenter-user --user-dialog chat` opened that surface, emitted paired active/inactive callbacks, returned focus to the Electron smoke app after the web close probe, used one overlay target, parked at `currentFps=0` with stable `pumpCount`, and reported no crash evidence. `stats` and `achievements` also route through presenter-backed web surfaces; prompt-style user dialogs such as `jointrade` and friend request actions stay native-only diagnostics through `route: "native"`. |
| Desktop Mode reusable native presenter Players page | Verified for open, close, input, and back-to-app | The `presenter-players` action uses `client.overlay.createElectronSteamOverlay(mainWindow)` and `steamOverlay.open({ type: "players", steamId64 })`, which opens the current user's Steam Community players page through the same native web presenter path. A 2026-06-28 Deck Desktop run captured visible Steam Community players content, emitted paired `active=true` and `active=false` callbacks, returned focus to the Electron smoke app after the web close probe, used one `gameoverlayui` target attached to the main/native process with game ID `480`, parked transparent/click-through at `currentFps=0`, showed no post-close pump-count increase, and reported no crash evidence. |
| Desktop Mode high-level dialog equivalent router | Verified for known web-backed dialog names | The `presenter-dialog-auto --dialog <name>` action uses `steamOverlay.open({ type: "dialog", dialog })`, which routes known Desktop dialog names through presenter-backed web equivalents instead of raw `ActivateGameOverlay(...)`. A 2026-06-29 Deck Desktop full matrix verified `Friends`, `Players`, `Community`, `OfficialGameGroup`, `Stats`, and `Achievements`: each run recorded `route: "auto"`, emitted paired `active=true` and `active=false` callbacks, captured visible Steam web content in the native overlay host, returned focus to the Electron app after the web close probe, used one `gameoverlayui` target attached to the app process with game ID `480`, parked transparent/click-through at `currentFps=0`, and showed no post-close pump-count increase or crash evidence. Unsupported auto dialog names now throw instead of silently falling back to raw Steam overlay behavior. Raw `presenter-dialog` still passes `route: "native"` and remains investigation-only. |
| Desktop Mode reusable native presenter app community/stats web overlays | Verified for open, close, input, and back-to-app | The `presenter-community` and `presenter-stats` actions use `steamOverlay.open({ type: "community", appId })` and `steamOverlay.open({ type: "stats", appId })`. They route Steam Community app hub and current-user app stats surfaces through the same modal native web presenter as Friends/Achievements instead of raw `ActivateGameOverlay("Community")` or `ActivateGameOverlay("Stats")`. Deck Desktop runs on 2026-06-28 verified overlay activation, captured visible Steam web content in the native overlay surface, and returned to the running smoke app with `--visual-close-input web`. |
| Desktop Mode reusable native presenter achievements/profile web overlay | Verified for open, close, input, and back-to-app | The `presenter-achievements` action uses `steamOverlay.open({ type: "achievements", appId })`, which opens the current user's Steam Community stats/achievements URL through the reusable native web presenter. Deck Desktop testing emitted paired `active=true` and `active=false` callbacks, returned to the running Electron app after the close probe, and used one `gameoverlayui` process attached to the main/native process. SpaceWar App ID `480` redirects that web achievements URL to the user's profile because Steam Community does not expose a public web stats page for it; use a real app with web-visible stats for content proof. |
| Desktop Mode reusable native presenter store web overlay | Verified for open, close, input, and back-to-app | The `presenter-store` action uses `steamOverlay.open({ type: "store", appId })`, which now defaults to the Steam store web overlay URL through the reusable native web presenter. A 2026-06-28 Deck Desktop run for App ID `480` recorded route `web`, URL `https://store.steampowered.com/app/480/`, paired `active=true` and `active=false` callbacks, a single `gameoverlayui` target attached to the main/native process, and post-close snapshots parked transparent, click-through, overlay-inactive, and idle with no pump-count increase. Pass `route: "native"` only to intentionally exercise raw `ActivateGameOverlayToStore`. |
| Desktop Mode reusable native presenter passive notification toasts | Verified | The `presenter-achievement-progress` and `presenter-achievement-unlock` actions attach the reusable presenter, rely on the managed overlay's automatic passive notification priming, and keep the host passive/click-through/transparent without requiring `GameOverlayActivated`. Passive priming wakes and repolls the presenter once, then pumps frames only if Steam reports `overlayNeedsPresent` instead of entering a fixed high-FPS boost window. Progress proof calls `achievement.indicateProgress(...)` against public App ID `480`, receives `callback:achievement-stored`, and captures the Steam achievement-progress toast over the running Electron app. A 2026-06-28 Deck Desktop fullscreen unlock run cleared and re-unlocked `ACH_TRAVEL_FAR_ACCUM` (`Interstellar`), recorded `achievement:unlock`, `callback:user-stats-stored`, and `callback:achievement-stored`, captured the Steam unlock toast over the fullscreen smoke app, kept focus on the app, used one `gameoverlayui` target attached to the main/native process with game ID `480`, and reported no crash evidence. |
| Desktop Mode managed Electron Shift+Tab shortcut bridge | Verified for keyboard toggle open, configurable targets, fullscreen, Shift+Tab-only close, back-to-app, and post-close parking | The `presenter-shortcut` action attaches `client.overlay.createElectronSteamOverlay(mainWindow)` and waits for the Deck runner to send Shift+Tab. The managed Electron shortcut bridge routes that key chord to `steamOverlay.open(...)`, preserving child-process isolation and the same native presenter used by checkout/Friends routes. The default target is `friends`, and the smoke runner accepts `--shortcut-target` to exercise other presenter-backed targets. A 2026-06-28 Deck Desktop Friends run emitted `overlay:shortcut-open`, `callback:overlay-activated active=true`, captured the Steam Friends/chat web overlay in the native host, emitted `active=false` after the close probe, returned focus to the Electron smoke app, and left no crash dumps. Later `--visual-close-input toggle` runs for `--shortcut-target profile` and `--shortcut-target web --web-modal true` sent only the second Shift+Tab for close and still verified `active=false`, focus return, no crash evidence, and idle presenter parking. A 2026-06-29 focused fullscreen run of `presenter-shortcut --shortcut-target web --web-modal true` verified the smoke app now uses a static shortcut target plus `overlayShortcut.onOpen` for lifecycle logging: diagnostics reported `targetType: "web"` with sanitized `{ type: "web", modal: true, hasUrl: true }`, emitted `overlay:shortcut-open`, emitted active/inactive callbacks, closed with Shift+Tab only, returned focus, and parked with `currentFps=0` and stable `pumpCount`. The close verifier now also requires state-driven `overlay:presenter-after-close` and `overlay:presenter-after-close-stable` snapshots with the presenter transparent, click-through, overlay-inactive, at `currentFps=0`, and with no `pumpCount` increase between samples. |
| Desktop Mode raw Steam overlay hotkey/toggle | Open blocker | Deck Desktop `--visual-toggle-probe` runs after the passive presenter toast proof stayed in the Electron app and emitted no `GameOverlayActivated` callback. This has been reproduced with Shift+Tab and with a controller-shaped virtual Guide/Steam-button uinput device after explicitly focusing the smoke app. The Guide run briefly changed `overlayNeedsPresent` to `true` but did not render overlay UI. A 2026-06-28 run with `--overlay-game-id shortcut` proved Steam's overlay renderer can attach to the full non-Steam shortcut game ID, but Shift+Tab and Guide still did not open visible overlay UI. A filtered 2026-06-28 state-capture run confirmed the focused and active X11 window stayed on the smoke app, `gameoverlayui` stayed attached to the app process with game ID `480`, and the X11 tree contained the passive native host plus the Electron window without a visible Steam overlay shell after Shift+Tab. Treat raw Steam overlay hotkey/social toggling as unresolved; the product keyboard-toggle path is Steam Bridge's managed Electron shortcut bridge. |
| Desktop Mode generic Steam overlay URI | Failed; do not use as a product path | A `presenter-web --web-url steam://open/overlay --web-modal true` Deck Desktop run emitted `GameOverlayActivated(true)` but did not write a result, showed a black native presenter/Steam overview thumbnail, and triggered a SteamOS coredump hook for the smoke app. Do not use `steam://open/overlay` as a generic overlay-toggle fallback. |
| Desktop Mode reusable native presenter raw social dialog | Open blocker; not a product proof | With default Electron child-process isolation, `presenter-dialog` calls `ActivateGameOverlay(...)`. The tested `Friends` dialog did not render or emit `callback:overlay-activated`; `--dialog Achievements` rendered Steam's SpaceWar achievements panel through one `gameoverlayui` target attached to the main/native process, but still emitted no activation callback, the Shift+Tab/Escape close probe did not dismiss it, and the visible close control returned to Steam Library instead of the running Electron app. The smoke app and Deck runner now accept `--dialog <name>` so other Steam dialog names can be compared without source edits. A 2026-06-28 `--overlay-game-id shortcut` run set `SteamOverlayGameId` to the full non-Steam shortcut game ID and `gameoverlayui` attached to that ID, but the raw Achievements dialog still emitted no activation callback and the open screenshot showed Desktop Mode's window overview rather than a stable in-app modal surface. The close probe returned to the smoke app, but this remains diagnostic evidence, not a product pass. A focused/raised X11 host experiment on 2026-06-27 still produced no visible Friends overlay and no activation callback with a single `gameoverlayui` target, so focus handoff is not useful. An opaque/interactive dialog-host experiment showed only a black native host and still emitted no activation callback, so dialog activation should remain transparent while this raw dialog route remains unresolved. With isolation disabled, `presenter-dialog` emits active=true and shows Steam's desktop overlay shell, but creates duplicate `gameoverlayui` targets for the GPU child and main/native process and still fails close/back-to-app visual proof. |
| Desktop Mode managed native web session | Compatibility coverage | The `native-web` action with `--web-modal true` calls `activateToWebPageWithNativeSession(...)`, opens a bridge-owned X11/GLX native presenter, keeps it presenting frames, and exercises the older managed-session API. Prefer the reusable `presenter-web --web-modal true` path for current Deck Desktop open/close proof because it also isolates Electron child overlay targets. |
| Desktop Mode managed native social session | Open blocker | The `native-dialog` action calls `activateDialogWithNativeSession("Friends")`, but Deck Desktop social behavior is not a product proof. With child-process isolation enabled the social overlay may not render; with isolation disabled it can render through Electron's Chromium hook but can leave stale overlay surfaces after close. Treat social close/back-to-app as unresolved. |
| Raw store overlay | Diagnostic coverage | `ActivateGameOverlayToStore` can activate the Steam overlay from the Deck smoke shortcut and produce `callback:overlay-activated` with `active=true`, but the reusable high-level store API defaults to the web presenter route because that route has open, close, input, and back-to-app proof. |
| General web-page overlay | Not working from the Deck Game Mode smoke shortcut | `ActivateGameOverlayToWebPage` to a normal Steam web page was called successfully, but did not show a visible web overlay or produce `active=true`. |
| Desktop web-page overlay | Verified through the reusable presenter | With the Desktop overlay profile and reusable presenter, `openWebOverlay(..., { modal: true })` to the public SpaceWar store page produced visible Steam web overlay UI, `active=true`, `active=false` after the overlay close control, and a clean return to the smoke app. |
| Web checkout overlay | Verified for presenter readiness and synthetic approval-route plumbing; real purchase proof still requires a real app/product | A non-Steam shortcut is not enough to prove real purchase content. It can prove the generic Deck Desktop route: a 2026-06-28 `presenter-checkout` prepare-only run parked the reusable presenter back at idle without requiring overlay activation, and a `presenter-checkout --checkout-transaction-id 123456789` run opened `https://checkout.steampowered.com/checkout/approvetxn/123456789/` through the native web presenter, emitted paired `active=true` and `active=false` callbacks, returned focus to the smoke app after the web close probe, and showed no post-close pumping or crash evidence. Use a real Steam-launched app ID with a configured product or transaction for purchase-content proof. |

The macOS matrix can now pair `--app-id <your-app-id>` with
`--checkout-json-file <path>` for private configured-product proof. Its manifest
and summary audit the expected app ID and `checkoutSource=json-file`, while
leaving the JSON path, transaction ID, return URL, and product details outside
committed artifacts. The macOS summary auditor now rejects newly generated
checkout manifests that carry unredacted sensitive checkout command values.
Use `--suite checkout` for focused real-product checkout evidence: it runs
checkout prepare-only, direct checkout, managed Shift+Tab checkout, and
programmatic checkout shortcut/open-and-wait with the same redaction,
microtransaction-callback, close/back-to-app, and presenter-parking gates as the
larger suites.

## Latest macOS Evidence

A 2026-06-30 full macOS matrix at
`/tmp/steam-bridge-macos-overlay-matrix-full-electron42-pidfocus-20260630-011628`
rebuilt the smoke app with Electron `42.5.1`, verified the signed native
launcher bundle shape, reused the existing Steam shortcut without restarting
Steam, and passed all 31 Steam-launched App ID `480` cases. This re-proved
web/store/Friends/dialog wait routes, passive progress/unlock toasts, synthetic
checkout approval routing, every supported Shift+Tab shortcut target including
checkout, direct profile/players/community/stats/achievements/user wait routes,
user SteamID, and every high-level dialog-equivalent route. The helper now
focuses the exact smoke process PID from each result log before shortcut-open
probes and waits for old smoke/gameoverlayui processes to exit between cases,
preventing stale app instances from receiving overlay input. A later minimal run
at `/tmp/steam-bridge-macos-overlay-matrix-minimal-close-focus-fix-20260630-042214`
left the active Steam overlay focused for close input and passed web, store,
Friends, dialog-equivalent, and passive-toast cases with app focus return,
parked zero-FPS presenter state, and clean crash diagnostics.
A follow-up full run at
`/tmp/steam-bridge-macos-overlay-matrix-full-reopened-steam-electron42-20260630-013125`
then reused the freshly reopened Steam client, skipped repackaging, verified the
existing signed Electron `42.5.1` bundle, and passed the same 31-case summary
audit without a Steam restart.
A later core run at
`/tmp/steam-bridge-macos-overlay-matrix-core-json-shortcut-20260630-034839`
rebuilt and signed the smoke app, reused the stable Steam shortcut, and passed
all 24 Steam-launched App ID `480` cases while feeding checkout through a local
`InitTxn`-style JSON file. The matrix summary audited `checkoutSource=json-file`
for both direct checkout and `11-shortcut-checkout`, including managed
Shift+Tab open/close, app focus return, parked zero-FPS presenter state, and
clean crash diagnostics.
A focused minimal run at
`/tmp/steam-bridge-macos-overlay-matrix-ready-minimal-20260630-163718`
then added `presenter-ready` as a live managed-overlay preflight. It proved
Steam launch, overlay injection, native host availability, idle presenter state,
zero managed overlay timing, and no overlay-active callback before the visible
web/store/Friends/dialog/passive cases. The readiness case intentionally does
not require `overlayEnabled=true`; on macOS Steam can keep one dormant
`gameoverlayui` target attached before visible overlay activation.
A later full run at
`/tmp/steam-bridge-macos-overlay-matrix-full-ready-current-20260630-164539`
reused the signed Electron `43.0.0` package and stable Steam shortcut without
restarting Steam, skipped repackaging, and passed all 44 Steam-launched App ID
`480` cases. This re-proved the readiness preflight, web/store/Friends/dialog
wait routes, passive progress/unlock toasts, checkout approval and prepare-only
paths, every managed Shift+Tab shortcut target, every direct presenter-backed
profile/community/stats/achievements/user/dialog route, and every programmatic
shortcut open-and-wait target, with one Metal presenter-backed overlay target,
active/inactive callbacks where expected, close/back-to-app proof, zero managed
overlay timing, clean parked state, no leftover smoke/gameoverlay processes, and
no copied macOS crash reports.
A follow-up persistent one-process run at
`/tmp/steam-bridge-macos-overlay-matrix-persistent-ready-retry-current-20260630-170648`
reused the same signed Electron `43.0.0` package and stable Steam shortcut
without restarting Steam or repackaging, launched one Steam-owned App ID `480`
smoke process, drove all 44 cases through the localhost control server, and
passed the summary audit. It re-proved readiness, active web/store/Friends,
dialog-equivalent, user, community, stats, achievements, checkout approval,
checkout prepare-only, every managed Shift+Tab shortcut target, and every
programmatic shortcut open-and-wait target with one Metal presenter-backed
overlay target, active/inactive callbacks where expected, close/back-to-app
proof, zero managed overlay timing, clean parked state, no leftover
smoke/gameoverlay processes, and no copied macOS crash reports. The persistent
matrix retry classifier now treats a crash-free `STEAM_OVERLAY_WAIT_TIMEOUT` at
`become active` after a successful action as retryable for one whole-suite
relaunch; repeated activation misses still fail the matrix.
A fresh full run at
`/tmp/steam-bridge-macos-overlay-matrix-full-json-after-reopen-20260630-040037`
then rebuilt and signed the Electron `42.5.1` smoke package after Steam had been
reopened, reused the stable shortcut without restarting Steam, and passed all
31 cases with the same private JSON-file checkout input. The summary audited
the Metal presenter backend, one overlay target per case, `checkoutSource=json-file`
for direct and shortcut checkout, managed wait-helper shown/closed/parked
lifecycle, app focus return, zero managed overlay timing, and clean crash
diagnostics.
A persistent one-process macOS suite at
`/tmp/steam-bridge-macos-overlay-matrix-20260630-063754` launched the same signed
Electron `42.5.1` App ID `480` smoke app once through Steam, drove all 31
overlay cases through the localhost control server, and quit cleanly. The run
covered web/store/Friends/dialog `openAndWait(...)`, passive progress/unlock
toasts, synthetic checkout approval-route plumbing, every managed Shift+Tab
shortcut target including checkout, direct profile/players/community/stats/
achievements/user wait routes, user SteamID, and every high-level
dialog-equivalent route. Every active case verified close/back-to-app and
parked presenter state, every shortcut case verified Shift+Tab open/close, the
stable shortcut was already up to date so Steam was not restarted, no retry was
needed, no smoke/gameoverlay process was left behind, and no fresh
`SteamBridgeSmoke` crash report was produced. At current head, the persistent
runner preserves failed artifacts and retries once for known crash-free managed
wait timeouts after Steam launch/injection: readiness stuck before
`overlayEnabled=true`, or post-action `become active` timeout after the action
succeeded.
A later persistent suite at
`/tmp/steam-bridge-macos-overlay-matrix-persistent-summary-after-steam-reset-20260630-082731`
passed all 31 cases after refreshing the native addon and resetting a wedged
Steam overlay client state. The aggregate summary now proves
`overlayNeedsPresentPollingEnabled=false` in both the top-level Steam diagnostics
and native presenter diagnostics for every case, while still auditing one
overlay target, close/back-to-app, zero managed timing, passive toasts, checkout
approval routing, every managed Shift+Tab target, and clean crash diagnostics.
The immediately preceding failed artifact was crash-free and already had the
disabled-polling proof, but Steam reported `overlayEnabled=false` and spawned
multiple `gameoverlayui` processes for the same smoke PID, so that one Steam
client reset was a client-state recovery rather than a shortcut/package change.
A newer persistent suite at
`/tmp/steam-bridge-macos-overlay-matrix-persistent-electron43-20260630-084237`
rebuilt and signed the smoke app with Electron `43.0.0`, reused the stable Steam
shortcut without restarting Steam, launched the app once through Steam, drove all
31 overlay cases through the localhost control server, and quit cleanly. The
summary re-proved web/store/Friends/dialog wait routes, passive progress/unlock
toasts, synthetic checkout approval routing, every supported Shift+Tab shortcut
target including checkout, direct profile/players/community/stats/achievements/
user wait routes, user SteamID, every high-level dialog-equivalent route, one
overlay target per case, Metal presenter lifecycle, close/back-to-app proof,
zero managed overlay timing, `overlayNeedsPresentPollingEnabled=false`, and
clean crash diagnostics on the current Electron package.
A later persistent suite at
`/tmp/steam-bridge-macos-overlay-matrix-persistent-generic-launcher-20260630-085852`
rebuilt the same Electron `43.0.0` package after moving the macOS env launcher
and Steam overlay entitlements into published `steam-bridge` templates. It
compiled and signed the smoke bundle from those generic package templates,
reused the stable Steam shortcut without restarting Steam, passed all 31
control-server-driven overlay cases, and re-verified one Metal presenter-backed
overlay target per case, close/back-to-app proof, zero managed timing,
`overlayNeedsPresentPollingEnabled=false`, clean quit behavior, and no fresh
crash reports. A newer persistent suite at
`/tmp/steam-bridge-macos-overlay-matrix-persistent-prepare-cli-visible-close-20260630-094316`
rebuilt the same Electron `43.0.0` package through the published
`steam-bridge-prepare-macos-app` CLI, reused the stable Steam shortcut without
restarting Steam, passed all 31 control-server-driven overlay cases, and
confirmed active Steam web overlays can be closed after the helper sees visible
web content in the presenter host. This closes the race where
`GameOverlayActivated(true)` can arrive before Steam has painted web overlay
content; the product API remains callback-driven, while the live harness waits
for visible pixels before sending the close probe. The post-run check found no
smoke/gameoverlay process left behind and no fresh `SteamBridgeSmoke` crash
report beyond the older known `BOverlayNeedsPresent()` reports.
A newer persistent suite at
`/tmp/steam-bridge-macos-overlay-matrix-persistent-shortcut-openwait-20260630-101406`
rebuilt and signed the Electron `43.0.0` smoke package, reused the stable Steam
shortcut without restarting Steam, launched once through Steam, and passed 32
control-server-driven overlay cases. The new case
`19-persistent-shortcut-web-openwait` calls
`steamOverlay.openShortcutTargetAndWait()` against the configured modal web
shortcut target instead of sending Shift+Tab, then verifies visible Steam web
content, active/inactive callbacks, `overlay:shortcut-open`, completion after
close and parking, app-frontmost return, zero managed overlay timing, one Metal
presenter-backed overlay target, clean control-server quit behavior, no leftover
smoke/gameoverlay process, and no fresh macOS crash reports.
After tightening the programmatic shortcut diagnostics, a focused Steam-launched
proof at
`/tmp/steam-bridge-macos-shortcut-openwait-focused-20260630-102739`
re-verified the same public helper on the final code path. Its lifecycle records
`overlay:shortcut-open` with `shortcut: "openShortcutTargetAndWait"` and
`target: "web"`, observes active/inactive overlay callbacks, completes after
the harness closes the web overlay, parks the persistent Metal presenter at
zero FPS, and leaves no fresh crash report. A later core matrix at
`/tmp/steam-bridge-macos-overlay-matrix-20260630-104809` rebuilt and signed the
Electron `43.0.0` package after checkout began sharing the managed
ready/open/shown/park helper. It reused the stable Steam shortcut without
restarting Steam and passed all 24 core cases, including direct checkout
approval, checkout shortcut, web/store/Friends/dialog wait routes, passive
progress/unlock toasts, every managed shortcut target, direct profile/players/
community/stats/achievements/user wait routes, one Metal presenter-backed
overlay target per case, zero managed overlay timing, clean close/back-to-app
proof, and no fresh `SteamBridgeSmoke` crash report beyond the older known
`BOverlayNeedsPresent()` reports.
A later persistent matrix at
`/tmp/steam-bridge-macos-overlay-matrix-20260630-110920` rebuilt and signed the
Electron `43.0.0` package, reused the stable Steam shortcut without restarting
Steam, launched one App ID `480` process through Steam, and passed all 42
control-server-driven cases. It expands
`steamOverlay.openShortcutTargetAndWait()` from the modal web proof to every
supported shortcut target: Friends, store, checkout approval-route, profile,
players, community, stats, achievements, user chat, and dialog-equivalent. The
run re-verified active/inactive callbacks, completion after overlay close and
presenter parking, zero managed overlay timing, one Metal presenter-backed
`gameoverlayui` target per case, clean quit behavior, no leftover smoke or
overlay process, and no fresh macOS crash reports. The smoke app now collects
macOS overlay process diagnostics by querying `gameoverlayui` PIDs directly
instead of scanning the full process table, avoiding the previous diagnostic
`ps` timeout without weakening the summary gate.
A later full cold-launch matrix at
`/tmp/steam-bridge-macos-overlay-matrix-20260630-112048` reused the signed
Electron `43.0.0` package, verified the signing shape, reused the stable Steam
shortcut without restarting Steam, and passed all 42 process-per-case App ID
`480` cases. The full suite now covers the same public
`steamOverlay.openShortcutTargetAndWait()` target set as the persistent suite:
Friends, web, store, checkout approval-route, profile, players, community,
stats, achievements, user chat, and dialog-equivalent. This proves the
programmatic shortcut helper both across a long-lived presenter process and
across fresh Steam-launched Electron processes, with active/inactive callbacks,
completion after close and presenter parking, one Metal presenter-backed overlay
target, zero managed overlay timing, clean back-to-app proof, no leftover
smoke/gameoverlay process, and no fresh macOS crash reports.
The current macOS matrix definitions add a 43rd case for checkout preparation
without transaction input. That case requires `overlay:presenter-checkout-ready`,
requires no modal overlay activation, and audits that the presenter parks back
at idle; the local matrix self-test and package smoke cover the new summary
field as `checkoutPrepared=true`. The macOS no-crash gate also now copies and
fails attributed `MTLCompilerService*.ips` reports when the report content names
`SteamBridgeSmoke` as the responsible process, which catches first-party Metal
compiler crashes that do not use a `SteamBridgeSmoke*.ips` filename. A live
locked/asleep unavailable matrix at
`/tmp/steam-bridge-macos-overlay-matrix-unavailable-checkout-prepare-20260630-115145`
passed three Steam-launched cases for managed web open/wait, checkout-open, and
checkout prepare-only fail-fast behavior with no overlay activation, zero
overlay targets, hidden zero-FPS presenter state, typed
`STEAM_OVERLAY_NATIVE_HOST_UNAVAILABLE` errors, and clean crash diagnostics. A
later user-visible crash dialog mapped to
`MTLCompilerService-2026-06-30-084244.ips` with
`SteamBridgeSmoke.electron` as the responsible process, so the public
JavaScript wrapper now mirrors the native macOS policy before reaching native
code: `overlayNeedsPresent()` returns `false`, diagnostics are assembled without
the native combined diagnostics poll, and
`overlayNeedsPresentPollingEnabled=false` remains the proof that Steam Bridge
avoided `BOverlayNeedsPresent()`. After rebuilding the native addon and signed
Electron `43.0.0` package, a fresh locked/asleep unavailable matrix at
`/tmp/steam-bridge-macos-overlay-matrix-unavailable-needs-present-20260630-120650`
re-ran web open/wait, checkout-open, and checkout prepare-only with the same
fail-fast/no-activation/zero-target evidence and no fresh `SteamBridgeSmoke` or
attributed `MTLCompilerService` crash reports. A later rebuilt locked/asleep
matrix at
`/tmp/steam-bridge-macos-overlay-matrix-unavailable-passive-toast-final-20260630-123114`
expanded that suite to four cases by adding passive achievement-progress proof:
the presenter stayed registered for automatic passive notification priming but
remained hidden, unattached, host-closed, zero-FPS, `macos-screen-locked`,
overlay-inactive, and produced no `gameoverlayui` target or fresh crash report.
After adding the cheap preflight mode, a fresh locked/asleep matrix at
`/tmp/steam-bridge-macos-overlay-matrix-unavailable-preflight-current-20260630-130448`
rebuilt and signed the Electron `43.0.0` package, reused the stable shortcut
without restarting Steam, and passed the same four unavailable cases with no
overlay activation, zero overlay targets, `overlayNeedsPresent=false`,
`overlayNeedsPresentPollingEnabled=false`, zero managed overlay timing, and no
fresh `SteamBridgeSmoke` or attributed `MTLCompilerService` crash reports.
A follow-up locked/asleep matrix at
`/tmp/steam-bridge-macos-overlay-matrix-unavailable-shortcut-openwait-20260630-131816`
expanded the unavailable suite to five cases by adding
`presenter-shortcut-open-and-wait` against a configured web shortcut target. The
new case records the managed wait start, asserts the configured shortcut target,
then fails fast with `STEAM_OVERLAY_NATIVE_HOST_UNAVAILABLE` before emitting
`overlay:shortcut-open`, before attaching a native host, and before any Steam
overlay activation.
A fresh locked/asleep matrix at
`/tmp/steam-bridge-macos-overlay-matrix-20260630-140541` rebuilt and signed the
Electron `43.0.0` smoke package after the smoke payload began recording
`snapshot.overlay.nativeHostAvailability`, reused the stable shortcut without a
Steam restart, and passed all five unavailable cases. The summary and direct
artifact inspection verified web open/wait, checkout-open, checkout-prepare,
programmatic shortcut open/wait, and passive achievement-progress all reported
`available=false`, `STEAM_OVERLAY_NATIVE_HOST_UNAVAILABLE`, reason
`macos-screen-locked`, an embedded presenter snapshot with
`nativeHostOpen=false`, no overlay activation, zero overlay targets,
`overlayNeedsPresent=false`, `overlayNeedsPresentPollingEnabled=false`, zero
managed overlay timing, and no fresh crash reports.
A later locked/asleep matrix at
`/tmp/steam-bridge-macos-overlay-matrix-20260630-144631` reran the current
head after removing the smoke harness's legacy OpenGL-only needs-present
disable env injection. It rebuilt and signed Electron `43.0.0`, reused the
stable shortcut without a Steam restart, and passed all five unavailable cases
again. The artifact summary and direct result inspection verified web
open/wait, checkout-open, checkout-prepare, programmatic shortcut open/wait,
and passive achievement-progress all reported `available=false`,
`STEAM_OVERLAY_NATIVE_HOST_UNAVAILABLE`, reason `macos-screen-locked`,
`nativeHostOpen=false`, no overlay activation, zero overlay targets, disabled
needs-present polling, zero managed overlay timing, and no copied macOS crash
reports.
A 2026-06-30 13:32 PDT crash-report sweep after a later user-visible Ignore
dialog found no newer `SteamBridgeSmoke`, `gameoverlayui`, `Steam Helper`, or
attributed `MTLCompilerService` DiagnosticReport than the known
`MTLCompilerService-2026-06-30-084244.ips` report.
A fresh interactive full macOS matrix at
`/tmp/steam-bridge-macos-overlay-matrix-20260630-152820` reused the signed
Electron `43.0.0` package, verified the signing shape, reused the stable Steam
shortcut without changing it, and passed all 43 process-per-case App ID `480`
cases after re-summarizing the completed artifact. The run covers web, store,
Friends, dialog-equivalent, profile, players, community, stats, achievements,
user, checkout approval-route, checkout prepare-only, passive notifications,
all managed Shift+Tab shortcut targets, and all
`steamOverlay.openShortcutTargetAndWait()` targets, with active/inactive
callbacks where expected, app-frontmost return, one Metal presenter-backed
overlay target, zero managed overlay timing, no fresh crash reports, and
checkout preparation audited as `checkoutPrepared=true` without modal overlay
activation. The macOS helper now focuses the smoke app before activation/close
probes, treats screenshot/pixel visibility as diagnostic while keeping
callback-driven close/park proof as the hard gate, and allows pre-open shortcut
cases to prove overlay readiness only after the shortcut opens the overlay.
A follow-up persistent suite at
`/tmp/steam-bridge-macos-overlay-matrix-20260630-153959` rebuilt the packaged
smoke app with the latest source, launched one App ID `480` process through
Steam, drove all 43 cases through the localhost control server, and passed the
summary audit. That run specifically proved per-control-action smoke options no
longer leak: checkout approval can run, checkout prepare-only can then prepare
without reusing the old transaction input or opening a modal overlay, and a
later checkout shortcut/open-and-wait action can still supply a fresh explicit
transaction input. Success suites can be launched with
`--wait-for-interactive-seconds <seconds>` or
`STEAM_BRIDGE_MACOS_MATRIX_WAIT_FOR_INTERACTIVE_SECONDS` to wait at the
preflight boundary for unlock/wake; the default remains immediate failure so
locked/asleep state is still captured explicitly with `--suite unavailable`.
`npm run macos:overlay-matrix:preflight` performs only this readiness check,
without package rebuild, shortcut mutation, Steam restart, or case launch.
A focused checkout suite at
`/tmp/steam-bridge-macos-overlay-matrix-checkout-live-20260630-160833` reused the
signed Electron `43.0.0` package, verified the signing shape, reused the stable
Steam shortcut without restarting Steam, and passed all four App ID `480`
checkout cases. The run covered checkout prepare-only with
`checkoutPrepared=true` and no modal activation, direct checkout approval-route
open/close via `openCheckoutAndWait(...)`, managed Shift+Tab checkout open/close,
and programmatic checkout shortcut/open-and-wait. Every activation case used one
Metal presenter-backed `gameoverlayui` target under game ID `480`, recorded
active/inactive callbacks, returned focus to the app, parked at zero managed
overlay timing, and reported no fresh crash evidence. This is generic checkout
plumbing evidence; real purchase content still requires a real configured Steam
app/product and private `InitTxn` response.
A fresh minimal macOS suite at
`/tmp/steam-bridge-macos-overlay-matrix-20260630-174351` rebuilt and signed the
Electron `43.0.0` smoke package after the public `InitTxn` session helpers
landed, reused the existing stable Steam shortcut without restarting Steam, and
passed all six App ID `480` cases. The run re-verified readiness, web, store,
Friends, dialog-equivalent, and passive achievement-progress coverage with one
Metal presenter-backed overlay target for active and passive overlay cases,
visible Steam web content before close probes, active/inactive callbacks for
modal routes, app-frontmost return, zero managed overlay timing,
`overlayNeedsPresentPollingEnabled=false`, and no newer crash report than the
known earlier `MTLCompilerService` report.
An attempted 2026-06-30 persistent run at
`/tmp/steam-bridge-macos-overlay-matrix-20260630-180652` then failed before
visible overlay activation because the local Steam client could no longer
create overlay IPC resources. Steam tracked the smoke app and attempted six
`gameoverlayui` launches for the same smoke PID, but `console_log.txt` reported
`Failed to create PosixMutex: SteamGameStream_<pid>_mutex`; the smoke snapshot
still had `overlayEnabled=false` and zero live `gameoverlayui` targets. The
macOS helper now diagnoses that state into
`steam-overlay-ipc-diagnostics.txt`, and the matrix retry classifier treats it
as non-retryable so IPC exhaustion is not mistaken for a presenter timing bug.
A follow-up 2026-06-30 minimal run at
`/tmp/steam-bridge-macos-overlay-matrix-minimal-guard-20260630-183541`
passed the readiness case after repackaging Electron `43.0.0`, then failed the
first active web overlay with the same fresh Steam IPC/resource errors. The
macOS helper now rejects stale stable-shortcut launcher env files before launch,
and the matrix no longer waits for Steam running-list removal if the Steam URL
handler never starts a smoke game process. A subsequent local Steam restart
entered a client update state and stopped dispatching `steam://rungameid`
shortcuts. A later rerun at
`/tmp/steam-bridge-macos-overlay-matrix-rerun-diagnostics-20260630-192307`
captured that pre-smoke boundary into
`steam-client-launch-diagnostics.txt`: Steam logged a
`rungameid : not allowed yet` failure while the webhelper logged
`SteamChrome_MasterStream_*` `errno: 28` failures, and no gameprocess tracking
entry was written for the App ID `480` smoke shortcut. The same detector is now
available as `npm run macos:steam-client-health`, which checks the currently
running Steam client without launching the smoke app and writes
`steam-client-health-diagnostics.txt` under the selected artifact root when it
finds a bad bootstrap state. Further live macOS proof should resume only after
Steam has finished updating, logged on, and can launch the App ID `480` smoke
shortcut again.

## Steam Deck Shortcut Gate

Steam Deck smoke testing uses the packaged Linux x64 app with SpaceWar App ID
`480` inside the process. The Steam launch URL must use the full non-Steam
shortcut game ID printed by the helper, not `480` and not Steam's internal
32-bit shortcut app ID. Launching the wrong ID can show Steam's `Game
configuration unavailable` dialog.

The packaged Linux helper can discover the current shortcut ID from
`shortcuts.vdf`, launch it, and verify the overlay signal:

```sh
cd "$HOME/steam-bridge-smoke/SteamBridgeSmoke-linux-x64"

./linux-electron-smoke.sh \
  --mode steam-launch \
  --shortcut-game-id auto \
  --action dialog \
  --result-file /tmp/steam-bridge-smoke-steam-launch.log \
  --require-steam-deck \
  --require-big-picture \
  --require-overlay-injection \
  --require-event callback:overlay-activated
```

The repository also includes a Deck-only host runner for SSH-driven checks. It
copies the Linux x64 package to the Deck, writes `SteamAppId` and `SteamGameId`
into the Steam shortcut wrapper, writes `SteamOverlayGameId` from the app ID by
default, starts a temporary sleep inhibitor, and runs the packaged helper. For
raw dialog and hotkey investigation, pass `--overlay-game-id shortcut` to compare
whether Steam overlay close/back routing depends on the full non-Steam shortcut
game ID rather than App ID `480`:

```sh
npm run steam-deck:smoke -- \
  --mode discover \
  --discover-subnet <lan-prefix>

npm run steam-deck:smoke -- \
  --host deck@<deck-host-or-ip> \
  --mode preflight

npm run steam-deck:smoke -- \
  --host deck@<deck-host-or-ip> \
  --mode game
```

Use `--mode desktop` for the Steam Deck Desktop Mode shortcut check. Discovery
finds SSH candidates when the Deck address changes; preflight separates a
network/SSH blocker from package, Steam command, and shortcut setup problems.
The host runner writes a wrapper script and env file before each Steam launch so
the shortcut can switch between Game Mode diagnostic checks and Desktop Mode
repaint checks without rewriting `shortcuts.vdf`.

## Overlay Proof Matrix

Use the smoke app to prove generic overlay plumbing, then use a real Steam app
to prove checkout or transaction behavior:

| API path | Smoke app expectation | What it proves |
| --- | --- | --- |
| `activateDialog("Friends")` | May show the Friends panel and emit an overlay callback when Electron child-process isolation is disabled. | Steamworks initialized, callbacks are flowing, and the overlay IPC path is alive. This is not a product overlay proof. |
| `activateDialogWithNativeSession("Friends")` | Social/Friends remains unresolved. With Electron child-process isolation enabled, the Desktop social overlay may not render; with isolation disabled, duplicate Chromium hooks can render it but leave stale surfaces after close. | Steam Bridge can own the native presenter lifecycle, but Desktop Mode social-overlay close/render behavior remains a blocker. |
| `activateToStoreWithNativeSession(480, ...)` | Opens the bridge-owned native presenter and exercises raw `ActivateGameOverlayToStore`. | Compatibility and diagnostic coverage for the native store activation path; prefer the high-level store target below for Electron product code. |
| `client.overlay.createElectronSteamOverlay(mainWindow).open({ type: "web", url: "https://store.steampowered.com/app/480/", modal: true })` | Reuses one managed presenter, shows Steam's web overlay in Deck Desktop Mode, isolates Electron child processes so only the main/native process is an overlay target, emits `active=false`, and returns cleanly to the smoke app. The same managed overlay exposes `waitForOverlayShown()`, `waitForOverlayClosed()`, and `parkWhenSteamOverlayCloses()` for app-facing lifecycle await points; in default persistent mode those waits resolve from overlay callback and presenter state changes. App code can pass timeouts or abort signals, but not polling intervals. | The current generic Deck Desktop Mode proof for the app-facing reusable presenter API and checkout-style overlays. |
| `client.overlay.createElectronSteamOverlay(mainWindow).openAndWait({ type: "web", url: "https://store.steampowered.com/app/480/", modal: true })` / `openAndWait({ type: "store", appId: 480 })` / `openAndWait({ type: "friends" })` / `openAndWait({ type: "dialog", dialog: "OfficialGameGroup", appId: 480 })` | The `presenter-web-open-and-wait`, `presenter-store-open-and-wait`, `presenter-friends-open-and-wait`, and `presenter-dialog-auto-open-and-wait` smoke actions open managed presenter-backed Steam surfaces, write their smoke result while the overlay is open, then record `overlay:presenter-open-and-wait-complete` only after Steam closes and the presenter parks. The Deck close verifier requires that completion event after `active=false` for these actions. | Direct proof for the builder-facing one-call open/show/close/park helper without making app code manage Steam callbacks or presenter parking. |
| `client.overlay.createElectronSteamOverlay(mainWindow).open({ type: "store", appId: 480 })` | Reuses one managed presenter and opens the app's Steam store page through the native Steam web overlay. A 2026-06-28 Deck Desktop run emitted `active=true` and `active=false`, recorded route `web`, returned focus to the smoke app after the web close probe, and showed no post-close presenter pumping. | Product-shaped replacement for raw Desktop store activation attempts. Use `route: "native"` only for explicit raw-store diagnostics. |
| `steamOverlay.openCheckoutAndWait(() => startTxn())` | With the public SpaceWar smoke app, `presenter-checkout` safely primes the reusable presenter without opening purchase UI unless `STEAM_BRIDGE_SMOKE_CHECKOUT_URL` or `STEAM_BRIDGE_SMOKE_CHECKOUT_TRANSACTION_ID` is provided. When a checkout URL or transaction ID is provided, the smoke action now exercises `openCheckoutAndWait(...)`: it keeps one scoped activation hold through the backend-style checkout result and approval-route open, waits for active/inactive callbacks, records `overlay:presenter-checkout-open-and-wait-complete` after parking, and avoids logging raw checkout URLs or transaction IDs in smoke lifecycle events. The helper accepts direct checkout targets and unwraps documented `InitTxn` envelopes such as `response.params.transid` plus Steam Bridge Web API responses at `data.response.params`. Abort signals, overlay-manager close events, and macOS host-unavailable transitions also cover the pending checkout operation, so stopping before the backend returns releases the presenter hold and parks without opening a checkout surface. When a real app emits `MicroTxnAuthorizationResponse`, the smoke diagnostics include the current presenter snapshot on `callback:microtxn`, and matrix summaries fail any microtransaction callback that lacks that presenter snapshot. | App-facing checkout plumbing no longer requires apps to touch presenter internals, build Steam approval URLs by hand, unwrap common Web API envelopes, or wire local overlay-close timers. A real app/product is still required for purchase-content proof, and authorization callbacks should be treated as purchase events rather than overlay-close signals. |
| `client.overlay.createElectronSteamOverlay(mainWindow).open({ type: "friends" })` | Reuses one managed presenter, opens Steam Community chat as the Friends List surface, shows visible Friends/chat UI in Deck Desktop Mode, isolates Electron child processes so only the main/native process is an overlay target, and returns cleanly to the smoke app after the close probe. | The current generic Deck Desktop Mode proof for Friends List/social UI without allowing Steam to hook Electron Chromium children. |
| `steamOverlay.open({ type: "profile", steamId64 })` | Reuses one managed presenter and opens a Steam Community profile page through the native Steam web overlay. A 2026-06-28 Deck Desktop run emitted active/inactive callbacks, captured profile web content, returned focus to the smoke app after the web close probe, and parked idle with stable `pumpCount`. | Product-shaped replacement for the common profile case of raw `ActivateGameOverlayToUser(...)`. |
| `steamOverlay.open({ type: "user", dialog: "steamid", steamId64 })` / `steamOverlay.open({ type: "user", dialog: "chat" })` | Reuses one managed presenter and opens the specified or current user's Steam Community profile page for `steamid`, or the Steam Community chat/Friends surface for `chat`, through the native Steam web overlay. A 2026-06-28 Deck Desktop core matrix run emitted active/inactive callbacks for `steamid`, captured visible Steam web content, returned focus to the smoke app after the web close probe, used one overlay target, and parked idle with stable `pumpCount`. A 2026-06-29 focused Deck Desktop fullscreen run verified the same open/close/back-to-app path for `chat`, including visible Steam chat/Friends content, one `gameoverlayui` target, `active=false` after close, `currentFps=0`, stable post-close `pumpCount`, and no crash evidence. | Product-shaped replacement for common `ActivateGameOverlayToUser(...)` cases that have web-backed equivalents. `stats` and `achievements` also route to web-backed equivalents; pass `route: "native"` only for raw prompt-style user dialog diagnostics. |
| `steamOverlay.open({ type: "players", steamId64 })` | Reuses one managed presenter and opens the current user's or specified user's Steam Community players page through the native Steam web overlay. A 2026-06-28 Deck Desktop run emitted active/inactive callbacks, captured visible Steam players content, returned focus to the smoke app after the web close probe, and parked idle with stable `pumpCount`. | Product-shaped replacement for the raw Desktop Players dialog. |
| `steamOverlay.open({ type: "community", appId })` | Reuses one managed presenter and opens the app's Steam Community hub through the native Steam web overlay. A 2026-06-28 Deck Desktop run emitted `callback:overlay-activated`, captured Steam web content, and returned to the smoke app after the web close probe. | Product-shaped replacement for raw Desktop Community dialog attempts. |
| `steamOverlay.open({ type: "stats", appId })` | Reuses one managed presenter and opens the current user's app stats page through the native Steam web overlay. A 2026-06-28 Deck Desktop run emitted `callback:overlay-activated`, captured stats/profile web content, and returned to the smoke app after the web close probe. | Product-shaped replacement for raw Desktop Stats dialog attempts. |
| `steamOverlay.open({ type: "achievements", appId })` | Reuses one managed presenter and opens the current user's Steam Community stats/achievements page for the app. With App ID `480`, Steam Community redirects to the user's profile, but the overlay still emits active/inactive callbacks and returns cleanly to the smoke app. | Product-shaped replacement for the raw Desktop achievements dialog on apps that expose web-visible Steam Community stats/achievements. |
| `steamOverlay.open({ type: "dialog", dialog })` | For `Friends`, `Players`, `Community`, `OfficialGameGroup`, `Stats`, and `Achievements`, the high-level router opens a presenter-backed web equivalent instead of raw `ActivateGameOverlay(...)`. A 2026-06-28 `presenter-dialog-auto` Deck Desktop matrix proved `Friends`, `Community`, `OfficialGameGroup`, `Stats`, and `Achievements` with visible Steam web content, active/inactive callbacks, one overlay target, clean return to the app, parked transparent/click-through presenter state at `currentFps=0`, no post-close pumping, and no crash evidence. A focused 2026-06-28 `--dialog Players` run passed the same verifier against the Steam Community players page. Unsupported dialog names throw in `route: "auto"` mode; pass `route: "native"` to intentionally exercise the raw dialog path. | Keeps the easy app-facing API on the presenter-backed route while preserving raw Desktop social/dialog investigation coverage. |
| `client.overlay.createElectronSteamOverlay(mainWindow)` default `overlayShortcut` | Pressing Shift+Tab in the Electron app opens the verified Friends/chat presenter-backed Steam web overlay. Deck Desktop runs show visible overlay content, active/inactive callbacks, back-to-app after close, and Shift+Tab-only close passes for managed profile and web shortcut targets. Static shortcut targets now report sanitized `overlayShortcut.target` diagnostics, and `overlayShortcut.onOpen` lets apps or smoke tests observe successful shortcut opens without using target resolver functions for side effects. | Product-shaped Electron keyboard toggle support without letting Steam hook Chromium child processes. Pass `overlayShortcut: false` to disable or provide `overlayShortcut.target` to choose another presenter-backed route. |
| `presenter-achievement-progress` / `presenter-achievement-unlock` | Reuses one attached passive presenter, relies on automatic passive notification priming from the managed Electron overlay, and captures visible Steam achievement-progress and achievement-unlock toasts over the app with a single overlay target. The unlock action clears and re-unlocks the selected public test achievement so repeated smoke runs can exercise a real unlock notification. | Passive notification/toast behavior works without app-level priming, without making the native host interactive, without a fixed high-FPS preparation window, and without requiring a modal overlay activation callback. |
| `activateToWebPageWithNativeSession("https://store.steampowered.com/app/480/", { modal: true, ... })` | Opens the bridge-owned native presenter and exercises the older managed-session API. | Compatibility coverage; prefer `presenter-web --web-modal true` for the current Deck Desktop open/close proof. |
| `activateToStore(480, ...)` | Should activate the Steam overlay and emit `active=true` from a Steam-launched Deck shortcut. | The Deck/Electron/Steam launch path can display Steam overlay UI. |
| `activateToWebPage("https://store.steampowered.com/app/480/", ...)` | Currently does not activate a visible web overlay from the Deck Game Mode smoke shortcut, but passes from Desktop Mode with the Desktop overlay profile. | The web-page API call was issued; it does not prove purchase UI unless Steam activates the overlay. |
| `steamOverlay.open({ type: "checkout", steamUrl })` or `steamOverlay.open({ type: "checkout", transactionId })` | Must be run from the actual Steam app with the matching App ID and a configured product or transaction. | Purchase or transaction overlay behavior through the same managed presenter as generic web overlays. |
| Web API `InitTxn` flow | Requires your own backend or publisher credentials. | End-to-end transaction overlay behavior for your app. Deck Game Mode and Desktop Mode should both be validated from the real Steam app, not from the public smoke shortcut. |

For managed Electron product paths, `open(...)` and `openAndWait(...)` keep the
presenter active until Steam reports the overlay shown. `openAndWait(...)` then
parks from overlay callbacks and presenter state changes. Timeout options and
internal guards remain failure guardrails rather than activation timing controls.
Managed Electron presenters default activation-boost and close-grace durations
to zero; duration-based prep is an explicit lower-level escape hatch.

Important Deck finding: a non-Steam shortcut can initialize Steamworks with
App ID `480` and can prove the store overlay, but it should not be used to
impersonate another app for purchase-flow proof. For checkout testing, launch
the actual installed Steam app with `steam://rungameid/<your-app-id>` or through
Steam's UI, then trigger the checkout or approval overlay from inside that app's
renderer/main process.

## Verification Signals

The verifier can require an active overlay callback:

```sh
npm run example:verify-result -- \
  --file /tmp/steam-bridge-smoke.log \
  --action store \
  --require-event overlay:store \
  --require-event callback:overlay-activated \
  --require-overlay-activated
```

The callback payload can be either flat or nested, depending on the native
callback binding shape:

```json
{ "active": true }
```

```json
{ "0": { "active": true } }
```

Both shapes are handled by the smoke app and verifier. For visual Deck testing,
a checkout pass means the modal Steam surface appears over the game, and backing
out returns to the running app.

In Deck Desktop Mode, touch, keyboard, and overlay dismissal behavior can differ
from Game Mode. Record the pass only after the Steam surface appears and the
running app regains focus after backing out or closing the surface. The current
generic visual pass is the reusable presenter `--action presenter-web
--web-modal true` path for web/checkout-style overlays, `--action
presenter-store` for store pages, and `--action presenter-friends` for Friends
List UI. `presenter-players` has the same open/close/back-to-app proof for the
Steam Community players page. The Electron overlay helper scrubs Steam overlay
preload entries for child processes and adds Linux
`no-zygote` isolation
by default; the expected Deck process list has one `gameoverlayui` attached to
the main/native process, not a second one attached to Electron's GPU process.
The smoke app snapshots `gameoverlayui` target metadata, and the Deck runner
requires this single-target invariant automatically for default persistent
presenter-backed product actions. The runner also machine-checks idle/passive
presenter state where it is part of the persistent proof: snapshots now include
`backend` (`x11-glx`, `macos-metal`, `macos-opengl`, or `none`) and, when the
Electron window exposes it, current `bounds`; checkout readiness and managed
shortcut attach must park with `idleFps=0` and `currentFps=0`; passive toast
proof must remain click-through, non-focusable, and overlay-inactive while
Steam may temporarily request present frames for notification rendering. The
matrix summary also requires passive toast actions to record their achievement
event, required Steam callbacks, a single overlay target, and a passive
presenter snapshot without requiring modal overlay activation. Presenter-backed
product actions also require clean smoke crash diagnostics: no crash dump files
and no fatal Electron lifecycle events. When `--visual-close-probe` is used on
presenter-backed product web surfaces, the Deck runner also verifies a
post-close `active=false` callback, confirms the smoke app remains the focused
X11 window, and re-checks crash evidence after the close input. In default
persistent mode it additionally requires state-driven
`overlay:presenter-after-close` and `overlay:presenter-after-close-stable`
snapshots parked at passive idle (`transparent=true`, `clickThrough=true`,
`overlayActive=false`, `currentFps=0`) and verifies `pumpCount` does not
increase between the first parked state-change sample and the following stable
sample. The `--presenter-mode session` compatibility
comparison skips those persistent-host parking and single-target assertions
because the session fallback opens lazily and may pump while a session exists.
The older managed native `--action native-web --web-modal true` path remains
compatibility coverage.

The recommended Deck Desktop Friends List path is
`client.overlay.createElectronSteamOverlay(mainWindow).open({ type: "friends" })`,
or the lower-level `client.overlay.openFriendsOverlay({ presenter })`, which opens
`https://steamcommunity.com/chat/` through the native Steam web overlay. A
2026-06-27 Deck Desktop run captured the Steam Friends List / chat UI, reported
`callback:overlay-activated active=true`, had one `gameoverlayui` attached to
the app's main/native process, and returned to the smoke app after the close
probe. A `steam://open/friends` URL activated the overlay but remained on a Steam
loading spinner, so the Steam Community chat URL is the generic social surface.
The recommended achievements page path is
`steamOverlay.open({ type: "achievements", appId })`, or the lower-level
`client.overlay.openAchievementsOverlay({ appId, presenter })`,
which opens
`https://steamcommunity.com/profiles/<steam-id>/stats/<app-id>/achievements/`
through the same native Steam web overlay. A 2026-06-28 Deck Desktop run with
App ID `480` emitted `active=true` and `active=false`, used one `gameoverlayui`
target attached to the app's main/native process, and returned to the smoke app
after the close probe. Steam Community redirected SpaceWar's web achievements
URL to the user's profile because no public web stats page is available for that
app, so use a real app with web-visible stats for achievements content proof.
The high-level router also maps known `dialog` targets to presenter-backed web
equivalents by default: `Friends`, `Players`, `Community`,
`OfficialGameGroup`, `Stats`, and `Achievements`. Use `route: "native"` only
when the test is explicitly about raw `ActivateGameOverlay(...)` dialog
behavior; the Electron smoke app's `presenter-dialog` action passes that native
route so it remains an investigation path. The `presenter-dialog-auto` smoke
action exercises the high-level router and should be treated like the other
presenter-backed product web routes.
A generic `steam://open/overlay` URL is also not a fallback: in Deck Desktop
Mode it activated Steam's overlay callback but left the presenter black, failed
to produce the smoke result, and caused a smoke-app coredump hook. Keep raw
Steam URI tests in investigation scripts only.

The Electron-only and managed native social paths can show Steam's desktop
overlay panels over the Electron window when child-process isolation is disabled,
such as Game Overview/Friends with a "Back to Game" affordance. The smoke app
now has investigation-only flags for that comparison:
`--overlay-scrub-child-env false --overlay-isolate-child-processes false`.
In that mode the raw `dialog` action starts a single `gameoverlayui` attached to
Electron's GPU process and emits `active=true`, but Shift+Tab/Escape and a
direct X-click probe still left the overlay shell visible. With the native
presenter attached, unisolated `presenter-dialog` starts duplicate overlay
targets for the GPU child and main/native process and also fails
close/back-to-app visual proof. With default child-process isolation enabled,
`presenter-dialog` is expected to remain an investigation path and may not render
the social overlay. The smoke app supports `--dialog <name>` for the raw
`dialog`, `native-dialog`, and `presenter-dialog` actions; use it to compare
`Friends`, `Achievements`, `Community`, `Players`, `Settings`,
`OfficialGameGroup`, and `Stats`. The first isolated Deck Desktop comparison
with `--dialog Achievements` rendered Steam's SpaceWar achievements panel with
one `gameoverlayui` target attached to the app's main/native process, but it did
not emit `GameOverlayActivated`, the Shift+Tab/Escape close probe left the panel
open, and clicking the panel's visible close control returned to Steam Library
instead of the Electron app. A Deck Desktop run that temporarily focused and
raised the X11 presenter immediately before `ActivateGameOverlay("Friends")`
still captured only the Electron smoke app and emitted no
`GameOverlayActivated` callback, so the presenter should remain non-focusable
for the product path. A separate run that made the dialog host opaque and
input-capable like the web/store path captured only the black native presenter
surface during the activation window, with no Steam social UI and no activation
callback. Keep dialog/social activation transparent; use the Friends target on
`openSteamOverlay(...)` or call `openFriendsOverlay(...)` for the product
Friends List route.

On Linux, the reusable native presenter requires an X11 or Xwayland `DISPLAY`.
`createElectronSteamOverlay(...)` in persistent mode, `attachPresenter(...)`,
and the lazy session fallback when it opens fail with an explicit diagnostic
when `DISPLAY` is missing. A Wayland-only or headless process is not expected to
host the current Steam overlay presenter; launch from Steam Deck Desktop Mode,
an X11 session, or an Xwayland-enabled session that exports `DISPLAY`.

The Deck host runner also has `--visual-toggle-probe` for shortcut evidence. It
captures the app before the probe, sends the selected toggle input, captures
again, then closes and captures the return state. The default
`--visual-toggle-input keyboard` sends Shift+Tab. `--visual-toggle-input guide`
sends the controller Guide/Steam button through a temporary `/dev/uinput`
device, and `--visual-toggle-input both` compares both paths in one run. The
runner focuses the smoke app with `xdotool` before toggle-probe screenshots
when that tool is available on the Deck. For the product keyboard path, use
`--action presenter-shortcut`, `--visual-toggle-probe`,
`--visual-toggle-input keyboard`, and `--visual-close-input toggle`; the Deck
runner verifies `overlay:shortcut-open`, active/inactive callbacks, app focus,
and no post-close crash evidence for this managed shortcut path. A 2026-06-28
Deck Desktop run proved that Steam Bridge's managed Electron shortcut bridge
opens the Friends/chat presenter route from Shift+Tab and returns to the app
after the close probe, and a later profile-target run proved Shift+Tab-only
close. The bridge now consumes Shift+Tab only when it is
opening a managed presenter-backed target; after `GameOverlayActivated(true)`,
it passes Shift+Tab through so Steam can handle close/toggle behavior. Focused
passive-presenter Desktop runs after `presenter-achievement-progress` still did
not open Steam overlay UI from raw Steam Shift+Tab interception or from the
virtual controller Guide/Steam button. The full virtual gamepad Guide run kept a
single `gameoverlayui` attached to the main/native process and briefly changed
`overlayNeedsPresent` to `true`, but the screenshot remained in the Electron app
and no `GameOverlayActivated` callback was emitted. That is evidence for the
current raw overlay-toggle blocker, not a pass. Re-running the same probe with
`--overlay-game-id shortcut` made `gameoverlayui` attach to the full non-Steam
shortcut game ID instead of App ID `480`, but did not make raw Shift+Tab or
Guide open visible overlay UI.

A filtered 2026-06-28 Desktop Mode run of `presenter-achievement-progress` with
`--visual-toggle-probe --visual-toggle-input keyboard` validated the state
capture path itself. The post-toggle screenshot remained on the Electron smoke
app, lifecycle logs still contained no `GameOverlayActivated` event, and the
matching `after-toggle-open-state.txt` showed the active/focused X11 window as
`Steam Bridge Electron Smoke`, `SteamOverlayGameId=480`, one
`gameoverlayui -pid <app-pid> ... -gameid 480`, and the X11 tree entries for the
passive `Steam Bridge Native Overlay` plus the Electron window. That means the
current keyboard-toggle failure is not caused by focus drifting away from the
app or by Steam attaching the overlay renderer to an obvious Electron child
process during the probe.

`overlayNeedsPresent=true` is not a hard failure by itself. It means Steam is
asking an event-driven renderer to keep presenting frames for the overlay. The
Electron `repaint` profile keeps invalidating the window at about 30 FPS without
forcing Chromium's GPU work in-process, and the verifier accepts an active
overlay callback as the stronger pass signal. Use the stronger `compatibility`
profile only when the repaint profile is not enough.

For Deck Desktop Mode visual testing, the Linux native probe must keep pumping
after the smoke result is written. Without continuing GLX presents, Steam may
report activation but later overlay interactions can become visually inert.
Keeping the presenter alive is necessary for the web modal proof. The reusable
presenter path switches to an input-capable, opaque active mode before opening
Steam web/store/checkout UI and returns to a click-through, transparent idle
mode after Steam reports overlay inactive, even if `overlayNeedsPresent` lingers
briefly. Raw dialog/Game Overview overlays are not part of the current product
pass criteria. `overlayNeedsPresent` can keep the host visible while input
remains click-through for passive notifications.

For repeatable Deck Desktop Friends List proof, run the host helper with
artifact collection:

```sh
npm run steam-deck:smoke -- \
  --host deck@<deck-host-or-ip> \
  --mode desktop \
  --action presenter-friends \
  --overlay-profile repaint \
  --window-mode fullscreen \
  --keep-open-after-result \
  --collect-diagnostics-dir /tmp/steam-bridge-deck-artifacts \
  --visual-capture-dir /tmp/steam-bridge-deck-screens \
  --visual-close-probe
```

For repeatable raw dialog investigation, run the host helper with artifact
collection:

```sh
npm run steam-deck:smoke -- \
  --host deck@<deck-host-or-ip> \
  --mode desktop \
  --action presenter-dialog \
  --dialog Achievements \
  --overlay-profile repaint \
  --window-mode fullscreen \
  --keep-open-after-result \
  --collect-diagnostics-dir /tmp/steam-bridge-deck-artifacts \
  --visual-capture-dir /tmp/steam-bridge-deck-screens \
  --visual-close-probe
```

The helper copies the remote result log and diagnostics directory locally,
captures `overlay-open.png`, sends a Deck-side Shift+Tab/Escape close probe, and
captures `after-close-probe.png`. These screenshots are evidence for the current
social-overlay investigation; they are not a passing assertion unless the first
capture visibly shows Steam social UI and the second capture visibly returns to
the running app. If a raw dialog shows a Steam close control, direct close-click
evidence should also return to the running Electron app; returning to Steam
Library is still a failed close/back-to-app proof.

For presenter-backed Steam web overlays, add `--visual-close-input web` with
`--visual-close-probe` when the proof should close through Steam's visible web
overlay close control instead of Shift+Tab/Escape. For managed shortcut proofs,
use `--visual-close-input toggle` to send only the second Shift+Tab. This is the current Deck
Desktop proof path for presenter Community and Stats web surfaces; the first
click can exit SteamOS/Desktop's screenshot overview state, and the second click
lands on the Steam web close control before `after-close-probe.png` is captured.

Use `--visual-toggle-probe` when the question is whether the overlay toggle opens
from the current app state. It focuses the smoke app before the toggle probe when
possible, captures `before-toggle-probe.png`, sends the selected input, captures
`after-toggle-open.png`, then captures `after-toggle-close.png` in addition to
the normal `overlay-open.png`. Each visual capture also writes a matching
`*-state.txt` file with the focused X11 window, active window property, matching
Steam/Electron overlay processes, selected Steam overlay environment variables,
and filtered `wmctrl`/`xwininfo` output when those tools are available on the
Deck. Add `--visual-toggle-input guide` to send a controller Guide/Steam-button
event through a temporary virtual gamepad, or `--visual-toggle-input both` to
compare Shift+Tab and Guide in one run. Add `--overlay-game-id shortcut` to run
the same visual probe while the wrapper sets `SteamOverlayGameId` to the full
non-Steam shortcut game ID; this is an investigation switch for raw overlay
close/back behavior, not a requirement for the verified presenter
web/Friends/checkout paths.

For passive progress-toast proof, run:

```sh
npm run steam-deck:smoke -- \
  --host deck@<deck-host-or-ip> \
  --mode desktop \
  --action presenter-achievement-progress \
  --overlay-profile repaint \
  --window-mode fullscreen \
  --keep-open-after-result \
  --result-delay-ms 1200 \
  --collect-diagnostics-dir /tmp/steam-bridge-deck-artifacts \
  --visual-capture-dir /tmp/steam-bridge-deck-screens
```

A passing capture shows the Steam achievement-progress toast over the running
Electron app while the lifecycle log includes `achievement:progress`,
`callback:achievement-stored`, and a passive presenter snapshot
(`clickThrough=true`, `transparent=true`, `overlayActive=false`) with
`electronOverlay.autoPrepareForNotifications=true` and managed timing
diagnostics such as `restoreFocusDelayMs=0`. The runner now requires that
passive presenter shape and zero managed overlay timing automatically for this
action, and packaged helper verification can require
`--require-zero-managed-overlay-timing` for timing regressions. The smoke action
tries the available public App ID `480`
achievements until Steam accepts
`achievement.indicateProgress(...)`, records the accepted achievement and
attempts, and the matrix summary fails if the progress event is not
`indicated=true` or if `callback:achievement-stored` is missing. A 2026-06-28
Deck Desktop core matrix selected `ACH_TRAVEL_FAR_SINGLE`, reported
`indicated=true`, received `callback:achievement-stored`, and passed the passive
toast audit.

For passive unlock-toast proof, run:

```sh
npm run steam-deck:smoke -- \
  --host deck@<deck-host-or-ip> \
  --mode desktop \
  --action presenter-achievement-unlock \
  --overlay-profile repaint \
  --window-mode fullscreen \
  --keep-open-after-result \
  --result-delay-ms 1200 \
  --collect-diagnostics-dir /tmp/steam-bridge-deck-artifacts \
  --visual-capture-dir /tmp/steam-bridge-deck-screens
```

A 2026-06-28 Deck Desktop run selected `ACH_TRAVEL_FAR_ACCUM`
(`Interstellar`), cleared and re-unlocked it, emitted `achievement:unlock`,
`callback:user-stats-stored`, and `callback:achievement-stored`, captured the
Steam unlock toast over the fullscreen smoke app, kept the app focused, used one
`gameoverlayui` target attached to the app process with game ID `480`, and
reported no crash evidence. This action intentionally mutates the selected
public test achievement so repeated runs can prove a real unlock notification.

To rerun the product Deck Desktop matrix without hand assembling each proof
command, use:

```sh
npm run steam-deck:overlay-matrix -- \
  --host deck@<deck-host-or-ip> \
  --suite core
```

The matrix packages the Linux x64 smoke app, runs preflight, and collects
per-case diagnostics plus screenshots for the managed presenter routes:
web/store/Friends/community/stats/achievements, dialog equivalents, checkout
readiness, synthetic checkout approval-route plumbing, user dialog equivalents,
managed Shift+Tab
shortcut routing, and automatically primed passive achievement progress/unlock toasts.
After a live run, it
summarizes the collected result and lifecycle logs and fails on hidden crash
dumps, fatal Electron lifecycle events, duplicate overlay targets, or missing
presenter diagnostics. For active overlay cases, the summary also verifies
post-close presenter parking: `active=false`, transparent/click-through presenter
snapshots, `currentFps=0`, and no pump-count increase between state-change
samples.
It also requires the smoke app's managed wait-helper lifecycle events:
`overlay:presenter-wait-shown`, `overlay:presenter-wait-closed`, and
`overlay:presenter-parked`.
The Deck web close probe is state-driven: it sends one click to the Steam web
close control, waits for lifecycle evidence of `active=false`, and clears KDE
overview/window-switcher state before clicking when KWin reports those transient
effects as active. The verifier fails if the overlay reactivates after a close
probe, which prevents accidental double-clicks from reopening an overlay through
the smoke UI underneath.
Live matrix runs also write `matrix-cases.jsonl`, and the summary prints/audits
the close/toggle input used for each case. Existing artifact roots can be
audited with `npm run steam-deck:overlay-matrix:summarize -- --artifact-root <path>`.
This remains generic App ID `480` plumbing evidence; real purchase content still
needs the app-specific purchase checklist below. A 2026-06-28 full-suite Deck
Desktop run passed 16 cases with 33 screenshots and a clean artifact summary
that reported `parked=true` and `managedWaits=true` for every active overlay
case. A later 2026-06-28 core run passed 13 cases with 27 screenshots after
moving the synthetic checkout approval route earlier in the suite; both shortcut
cases recorded `closeInput=toggle`, proving Shift+Tab-only managed close in the
matrix. A later 2026-06-28 core run passed 15 cases with 30 screenshots after
the passive progress proof started requiring an accepted `indicated=true`
achievement-progress call plus `callback:achievement-stored`. A 2026-06-28
full run passed 20 cases with 40 screenshots, including every known
dialog-equivalent route (`Friends`, `Players`, `Community`,
`OfficialGameGroup`, `Stats`, and `Achievements`) under the same stricter
passive-toast audit. A later 2026-06-28 core run at
`/tmp/steam-bridge-deck-overlay-matrix-20260628-200433` passed 15 cases with 30
screenshots after replacing fixed post-close sample delays with presenter
state-change samples; the web-modal lifecycle recorded
`source: "state-change"` for both parked samples and kept `pumpCount=308` at
`currentFps=0`. A 2026-06-29 full run at
`/tmp/steam-bridge-deck-overlay-matrix-20260629-002449` passed 26 cases with 52
screenshots after hardening the Deck close probe to use one lifecycle-aware web
close click, clear transient KWin overview/window-switcher state before close,
and reject post-close overlay reactivation.

## Current macOS Client Blocker

The macOS overlay implementation still has broad passing evidence, but the
current local Mac cannot run fresh live proof until Steam recovers from a client
bootstrap/IPC failure. `npm run macos:steam-client-health` now captures this
before any smoke app launch, and the live macOS matrix runs the same health
gate before cases, including a detector-driven wait after matrix-owned Steam
restarts for shortcut updates. A 2026-06-30 artifact at
`/tmp/steam-bridge-macos-steam-health-resource-snapshot-20260630-195055`
reported Steam running with a `-steamid=0` bootstrap helper and fresh
`SteamChrome_MasterStream_*` `errno: 28` failures, while the resource snapshot
showed zero remaining stale SteamChrome temp entries, 214 Steam open files, 84
Steam POSIX semaphore handles, 15 Steam POSIX shared-memory handles, and
`launchctl maxfiles` with a 256 soft limit. The detector now derives explicit
resource warnings from those values. Treat this as local Steam client state,
not overlay presenter evidence; rerun macOS overlay proof after Steam logs in
and the health gate passes.

## Purchase Overlay Checklist

Use this checklist for app-specific purchase validation without committing
private app details to this repository:

1. Install the real Steam app on the Deck.
2. Launch it through Steam, not through the generic smoke shortcut.
3. Confirm `utils.getAppId()` reports your real app ID.
4. Trigger the app's real checkout from inside the running app through
   `steamOverlay.openCheckoutAndWait(() => startTxn())`.
5. Verify the Steam checkout or approval surface appears.
6. Confirm `callback:microtxn` includes a presenter snapshot if authorization
   occurs; the matrix summaries now fail artifacts where that callback lacks
   presenter diagnostics. Order IDs, transaction IDs, Steam IDs, and checkout
   URLs must remain redacted from any shared artifact.
7. Press Back to confirm Steam returns to the running app and the presenter
   parks after `GameOverlayActivated(false)`.
8. Keep private app IDs, item definitions, transaction IDs, publisher keys, and
   private URLs out of committed docs, tests, and examples.
