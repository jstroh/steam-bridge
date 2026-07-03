# Cross-Platform Overlay Status

Last updated: 2026-07-03

This tracks the current runtime evidence for the Electron smoke app on Linux x64,
Steam Deck, and macOS Apple Silicon. The public smoke target is Valve's SpaceWar
App ID `480`.

## Current Evidence

| Target | Status | Evidence |
| --- | --- | --- |
| Linux x64 | Verified through Steam Deck | The packaged Linux x64 smoke app launches on Steam Deck and initializes Steam as App ID `480`. The Linux package includes `linux-electron-smoke.sh` for direct, Steam-launched, and verification checks. A Deck-side `ldd -r` check of the packaged native binding did not report unresolved `steam_bridge_music_remote_*` symbols. |
| Windows x64 | D3D11 native presenter verified for managed web/store/Friends/checkout routing and keyboard shortcut open/close | The packaged Windows x64 smoke app includes `windows-electron-smoke.ps1` for direct, Steam-launched, verification, preflight, stable smoke-env-file launch options, and shortcut launch-option checks. The helper accepts raw Windows baseline actions for web, store, Friends, and passive achievement notifications, plus the managed comparison action names used by Deck/macOS for dialog-equivalent, checkout, shortcut, and passive notification regression coverage. The package also includes `windows-overlay-matrix.ps1`, which runs preflight and then baseline, managed, or full Steam-launched suites with per-case artifacts; it can install/reuse one stable Steam shortcut and rewrite only a local smoke env file for each case. Preflight writes both human logs and structured JSON with policy state, parsed `CiTool.exe -lp` policy inventory, enforced policy names, `VerifiedAndReputableDesktop*` enforcement, signatures, Zone.Identifier state, Steam process state, warnings, and matching Code Integrity events. Before any live Steam-launched case, the matrix runs a direct `none` native-load gate from the exact packaged app and requires real Steam initialization plus clean crash diagnostics; failures capture a post-gate preflight JSON snapshot after the blocked load attempt. Every live matrix case requires clean Electron crash diagnostics so hidden renderer/GPU/native crashes fail the run. A July 2, 2026 Session 0 SSH native-load gate reached `SteamAPI_InitFlat` and failed with `k_ESteamAPIInitResult_NoSteamClient`, proving SSH Session 0 cannot validate Steam IPC or overlay readiness while Steam is running in the interactive desktop session. The same packaged helper launched through an interactive Task Scheduler run in Session 1 passed the direct `none` gate against App ID `480`: Steam initialized, `steam.running=true`, `appId=480`, crash diagnostics were clean, no smoke process was left running, and `process.argv` contained only `SteamBridgeSmoke.exe` because direct Windows smoke state now flows through the child process environment. Because that proof is a direct non-Steam launch, `overlayInjection=false` and `overlayEnabled=false` are expected. Earlier Steam-launched Session 1 follow-up runs proved the ordinary executable shortcut path only under an explicit compatibility comparison: diagnostic baseline failed with `overlayEnabled=false`, `-OverlayDisableDirectComposition 1` alone failed, a launcher that forced `SteamOverlayGameId=480` still failed, the stronger compatibility profile passed, and the ordinary executable shortcut with diagnostic profile plus Chromium in-process GPU emitted store activation without a launcher or repaint loop. That artifact `C:\Users\admin\steam-bridge-artifacts\steam-launch-store-ipgpu-20260702-002` initialized App ID `480`, reported `steamLaunch=true`, `overlayEnabled=true`, `overlayNeedsPresent=true`, emitted `callback:overlay-activated active=true` from the Steam store action, verified cleanly with `windows-electron-smoke.ps1 -Mode verify`, recorded no crash diagnostics, and left no smoke process behind, but it is no longer treated as product guidance because current render-health shows explicit `-OverlayInProcessGpu 1` blanks the packaged app. `electronConfigureSteamOverlay()` no longer forces the in-process GPU path on Windows by default; the Windows helpers leave `-OverlayInProcessGpu` unset unless a focused compatibility comparison passes `-OverlayInProcessGpu 1`, while `-OverlayDisableDirectComposition 1` remains an explicit comparison control. An earlier July 2, 2026 default-path probe at `C:\Users\admin\steam-bridge-artifacts\steam-launch-store-default-ipgpu-20260702-001` captured the old in-process-GPU default, but its final `IsOverlayEnabled` sample was false and is not treated as the overlay-ready pass. A July 2, 2026 wrapper refresh did not find a safer maintained Chromium-flag default; current policy therefore keeps risky Chromium flags explicit and requires any native-surface path to pass the local Windows matrix before becoming a Windows default. The Windows package also includes `sign-windows-package.ps1`, which signs or audits all `.exe`, `.dll`, and `.node` files in the exact smoke bundle using an installed Authenticode certificate or PFX. Earlier Windows 11 laptop runs showed real Smart App Control/App Control native-addon blocks for unreputable `.node` files, and report-only preflight still records SAC/App Control state plus matching historical Code Integrity events. A 2026-07-03 UTC focused D3D11 keyboard artifact, `C:\Users\admin\steam-bridge-artifacts\windows-d3d11-shortcut-keyboard-escapeclose-20260702-190424`, proved Steam-launched App ID `480` Shift+Tab -> Friends open, active callback, Escape close, `overlayClosed=true`, `overlayParked=true`, `overlayComplete=true`, parked presenter `currentFps=0`, no lifecycle errors, and only Steam left running after cleanup. |
| Steam Deck Game Mode | Verified for smoke coverage | A Steam-launched non-Steam shortcut reports `steamDeck=true`, `bigPicture=true`, `steamLaunch=true`, `overlayInjection=true`, `overlayEnabled=true`, and can emit overlay events. |
| Steam Deck Desktop Mode | Verified for smoke and managed overlay coverage | The same packaged app can be launched from Desktop Mode with `steamDeck=true`, `bigPicture=false`, `steamLaunch=true`, `overlayInjection=true`, and `overlayEnabled=true`. Desktop Mode uses the Electron `repaint` overlay profile by default. A 2026-06-29 full Deck Desktop overlay matrix at `/tmp/steam-bridge-deck-overlay-matrix-20260629-002449` passed 26 cases with 52 screenshots, covering managed web/store/Friends/dialog/user/community/stats/achievements surfaces, passive toasts, checkout readiness and approval-route plumbing, open-and-wait helpers, keyboard shortcut open/close, app focus return, presenter parking, and crash diagnostics. |
| macOS Apple Silicon | Verified for Steam-launched managed web/store/Friends/dialog/user/community/stats/achievements, synthetic checkout, shortcut, passive toasts, and signed package launch | The packaged macOS arm64 smoke app uses an in-bundle native launcher that preserves Steam overlay injection while setting `SteamAppId`, `SteamGameId`, and `SteamOverlayGameId` to App ID `480` before `exec`ing Electron. The package script ad-hoc signs both the native launcher and renamed Electron executable with Steam-compatible entitlements before live overlay testing. A 2026-06-29 full matrix at `/tmp/steam-bridge-macos-overlay-matrix-full-dialog-openwait-20260629-195732` passed 23 Steam-launched cases covering web/store/Friends/dialog, profile, players, community, stats, achievements, user chat, user SteamID, and every known high-level dialog-equivalent route through managed `openAndWait(...)`; passive progress/unlock toasts; synthetic checkout approval-route plumbing; managed Shift+Tab shortcut open/close for Friends, web, and store targets; and active/inactive callbacks where expected. A later core matrix at `/tmp/steam-bridge-macos-overlay-matrix-core-all-shortcuts-20260629-203243` expanded shortcut coverage to every supported presenter-backed target, passing 24 Steam-launched cases with Friends/web/store/checkout/profile/players/community/stats/achievements/user/dialog shortcut open/close, active shown presenter snapshots, app focus return, parked presenter state, interactive macOS host state, zero managed overlay timing, one `gameoverlayui` target, and no crash evidence. A fresh full run at `/tmp/steam-bridge-macos-overlay-matrix-full-close-wait-20260629-214233` passed all 31 Steam-launched cases after helper hardening and verified managed wait-helper shown, closed, and parked events for every active managed case, including user SteamID and all known dialog-equivalent routes. A 2026-06-30 core run at `/tmp/steam-bridge-macos-overlay-matrix-core-inittxn-envelope-20260630-000000` passed 24 cases after the smoke app began wrapping checkout test inputs in an `InitTxn`-style `response.params` envelope, proving the generic checkout unwrapping path with App ID `480` approval-route plumbing. A signed-package full run at `/tmp/steam-bridge-macos-overlay-matrix-full-signed-package-20260629-234357` then rebuilt and signed the smoke package and passed all 31 Steam-launched cases against that packaged/signing path, re-verifying web/store/Friends/dialog wait routes, passive toasts, checkout approval routing, every presenter-backed shortcut target, direct profile/players/community/stats/achievements/user wait routes, user SteamID, every high-level dialog-equivalent route, close/back-to-app proof, zero managed overlay timing, one overlay target, and no crash evidence. Non-store targets attach under game ID `480`; the Steam store surface can report the generated shortcut game ID while still emitting app ID `480` callbacks and passing close/back-to-app proof. |
| macOS Electron builder integration | Implemented with package smoke and unit coverage | The package now exports `steam-bridge/electron-builder` so app projects can call `prepareMacosSteamAppAfterPack(context, { skipSign: true })` from `electron-builder` `afterPack`, keep normal Apple signing in control with the published Steam overlay entitlements, then call `verifyMacosSteamAppAfterSign(context)` from `afterSign`. The helpers skip non-mac targets, reject Intel/universal macOS targets, derive the `.app/Contents/MacOS/<executable>` path from the builder context, and wrap the same published preparation/verifier CLIs used by the smoke package. Unit coverage verifies skip/reject behavior, Apple Silicon path resolution, prepare/verify CLI arguments, and failure reporting. Package smoke installs the packed tarball and verifies the helper subpath from CJS, ESM, and TypeScript consumer code. |
| macOS Apple Silicon matrix automation | Implemented; full live coverage exercised except real purchase content | `scripts/macos-overlay-matrix.sh` dry-runs or executes repeatable Steam-launched macOS helper cases. It installs or updates one stable non-Steam shortcut with the native launcher env-file flag, restarts Steam only when that shortcut is added or materially changed, writes per-case launch state through the env file, and now preflights `getMacOverlayEnvironment()` before success suites so locked/asleep Macs fail clearly before case launch. Its `unavailable` suite is the matching expected-failure capture path for genuinely locked/asleep sessions: it records managed web, checkout-open, checkout-prepare, and programmatic shortcut open/wait fail-fast artifacts with `STEAM_OVERLAY_NATIVE_HOST_UNAVAILABLE`, plus passive achievement-progress no-host evidence, the detected `macos-screen-locked` or `macos-display-asleep` reason, no Steam overlay activation, and summary-audited presenter state. The normal suites collect result/diagnostic logs for web/store/Friends/dialog wait routes, passive toast gates, synthetic checkout approval-route plumbing, Shift+Tab shortcut routing, and common presenter-backed web targets. The packaged helper now enforces active shown presenter shape and interactive macOS host state during close and shortcut-open verification. Before live cases, the matrix runs `scripts/verify-macos-steam-signing.cjs` against the native launcher and renamed Electron executable, requiring the bundle `Info.plist` to name the native launcher as `CFBundleExecutable`, the launcher to carry Steam Bridge's identity marker, the renamed Electron executable to not be another launcher copy, arm64-only slices, valid executable signatures, Steam overlay entitlements, and no App Sandbox entitlement. A fresh 2026-06-29 full run at `/tmp/steam-bridge-macos-overlay-matrix-full-dialog-openwait-20260629-195732` passed the broader 23-case suite without updating the stable shortcut or restarting Steam, with every known high-level dialog-equivalent route using the managed wait helper; a later core run at `/tmp/steam-bridge-macos-overlay-matrix-core-all-shortcuts-20260629-203243` added full presenter-backed shortcut coverage without updating the stable shortcut. A 2026-06-30 core run at `/tmp/steam-bridge-macos-overlay-matrix-core-inittxn-envelope-20260630-000000` exercised checkout approval through an `InitTxn`-style `response.params` envelope and passed the same summary auditor. The smoke checkout harness can now read a private `STEAM_BRIDGE_SMOKE_CHECKOUT_JSON_FILE`, and the macOS helper exposes that as `--checkout-json-file`, so future real-product artifacts can feed the actual `InitTxn` response through `openCheckoutAndWait(...)` without committing private data or placing transaction values in launch arguments; a focused 2026-06-30 packaged macOS run at `/tmp/steam-bridge-macos-checkout-json-20260630-030514` proved that JSON-file handoff with active/inactive callbacks, app-frontmost return, post-close parking at `currentFps=0`, and no crash evidence. The signed-package full artifact at `/tmp/steam-bridge-macos-overlay-matrix-full-signed-package-20260629-234357` passed after package-time ad-hoc signing of both smoke executables, keeping the launcher/signing requirements in the live 31-case matrix rather than only in static packaging checks. A focused signing-preflight artifact at `/tmp/steam-bridge-macos-overlay-matrix-minimal-signing-preflight-20260630-000117` rebuilt, signed, verified, and then passed the five-case minimal suite. It also runs `scripts/summarize-macos-overlay-matrix.cjs` after live matrices, and `npm run macos:overlay-matrix:summarize -- --artifact-root <path>` audits existing artifacts for Steam launch/injection identity, one `gameoverlayui` target attached to the smoke process, non-store game ID `480` attachment, interactive macOS host state, active shown presenter snapshots, managed wait-helper shown/closed/parked lifecycle events, zero managed overlay timing, passive notification callbacks, close-and-park lifecycle evidence, checkout `openCheckoutAndWait(...)` completion after close/parking, expected native-host-unavailable fail-fast artifacts, and crash diagnostics. Real purchase-content still requires a real Steam app ID with a configured product. |
| macOS lock/display-sleep host guard | Implemented with unit, verifier, and matrix capture coverage | The native macOS presenter reads CoreGraphics session and display state through `getMacOverlayEnvironment()`. When the screen is locked or the main display is asleep, persistent presenters and native sessions skip host creation, report `nativeHostUnavailableReason` as `macos-screen-locked` or `macos-display-asleep`, keep the presenter at `currentFps=0`, and retry lazy host attachment after the environment becomes available. Managed Electron overlay open/wait and checkout helpers now fail before Steam overlay activation with `SteamOverlayNativeHostUnavailableError` while that unavailable reason is present, so app code can check `code`, `reason`, and `macOverlayEnvironment` and fall back immediately instead of waiting for a timeout. The checkout helper also re-checks availability before opening the returned approval route, so a lock/sleep transition while `InitTxn` is pending releases the presenter hold and prevents a late checkout surface. Passive notification auto-priming skips native host work while unavailable but keeps the presenter registered so the next notification-producing call after unlock/wake primes normally. The macOS Shift+Tab fallback treats an already-unavailable host as a quiet no-op unless the app supplied `overlayShortcut.onError`, and host-unavailable transitions during its callback wait also avoid warning noise. Unit coverage simulates locked, display-asleep, post-unlock attach, pending checkout cancellation, passive notification retry, quiet shortcut behavior, fail-fast managed-open behavior, and the public `getNativeHostAvailability()` helper; smoke artifacts now record `snapshot.overlay.nativeHostAvailability`, and verifiers require it to agree with the presenter snapshot for `--require-native-host-unavailable-reason` cases. The macOS `--suite unavailable` matrix preserves those expected failure requirements from the manifest and refuses to run while macOS is interactive, so lock/asleep artifacts are captured explicitly rather than treated as success-run failures. |
| Desktop Mode Electron-only overlay | Partial | With Electron child overlay isolation disabled for investigation, the raw `dialog` action activates visible Steam desktop overlay UI, emits `callback:overlay-activated` with `active=true`, and starts one `gameoverlayui` attached to Electron's GPU process. Shift+Tab/Escape and an X-click probe did not return to the app, so this is callback/render evidence, not close/back-to-app proof. With default child isolation enabled, social rendering is not reliable. |
| Desktop Mode reusable native presenter web overlay | Verified for open, close, input, fullscreen, and back-to-app | The `presenter-web --web-modal true` action uses `client.overlay.createElectronSteamOverlay(mainWindow)` and `steamOverlay.open({ type: "web", ... })` with the reusable X11/GLX presenter. Deck Desktop testing showed the modal Steam web overlay, emitted paired `active=true` and `active=false` callbacks, returned to the running Electron app, left no crash dumps, and used a single `gameoverlayui` process attached to the main/native process. A focused fullscreen Deck run also used `presenter-shortcut --shortcut-target web --web-modal true`, which focused the app first, opened the Steam store web overlay through Shift+Tab, waited for lifecycle evidence of shortcut-open and active overlay events before capture, emitted `active=true` then `active=false`, returned focus to Electron, and parked with no post-close pumping. `electronConfigureSteamOverlay()` scrubs Steam overlay preload entries for Electron children and adds Linux `no-zygote` isolation by default; `createElectronSteamOverlay(...)` also scrubs those preload entries for future Electron children and records the scrub state in managed overlay snapshots, keeping Chromium GPU/renderer children from becoming competing overlay targets. |
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

## Related Wrapper Evidence

Reviewed on 2026-07-02 for the Windows overlay plan:

- Valve's overlay documentation remains the baseline: initialize Steam before the
  renderer device is created, keep rendering on a supported graphics API, and do
  not expect overlay support from software-rasterized surfaces.
- `ceifa/steamworks.js` is still the closest comparable Electron wrapper, but its
  published npm package is stale and its issue tracker still has open Windows,
  Linux, and macOS overlay failures. Its Windows issue evidence supports keeping
  `disable-direct-composition` as an explicit comparison switch only, because the
  flag has been tied to Alt+Tab ghost-window regressions.
- `greenheartgames/greenworks` has long-running unresolved Electron/NW overlay
  issues, so it is useful only as historical evidence.
- `ArtyProf/steamworks-ffi-node` is active and documents a native
  Metal/OpenGL overlay surface for Electron, but current issues report frame-rate
  loss and shutdown problems after enabling that surface. Treat that architecture
  as fallback research, not a Windows default, until it passes Steam Bridge's own
  Windows matrix without FPS, focus, close, or process-lifetime regressions.

## Latest Windows Evidence

A 2026-07-02 interactive Windows laptop process-per-case baseline slice proved
the current Windows lane without a native presenter or repaint loop. The stable
Steam shortcut launch environment now sets `SteamAppId`, `SteamGameId`, and
`SteamOverlayGameId` to public App ID `480`; the smoke app waits for first
renderer paint before starting autorun; the helper waits for a complete JSON
result and then for the smoke process to exit. With that shape, the web, store,
and Friends cases emitted active overlay callbacks, while achievement progress,
achievement unlock, and `none` cases completed with clean diagnostics without
requiring overlay readiness or activation. The relevant artifacts were captured
under `C:\Users\admin\steam-bridge-artifacts\windows-baseline-matrix-20260702-013-passive-no-ready`.

A later current-head Windows run against the same shortcut failed before
overlay UI activation while the Steam client window itself was rendering blank
or white. The smoke app still loaded the native addon, initialized Steam as App
ID `480`, and launched through Steam with the correct app/game/overlay IDs, but
Steam's logs showed CEF/ANGLE GPU context loss and repeated GPU-process restarts
with `0x887A0022`, and `gameoverlay_renderer.txt` showed the injected overlay
renderer failing `CreateSwapChainForHWND` with the same code. Microsoft defines
`0x887A0022` as `DXGI_ERROR_NOT_CURRENTLY_AVAILABLE`, so this is being treated
as a Steam client / GPU-renderer health blocker before more live Windows
overlay proof, not as a Steam Bridge native-load failure. The Windows matrix now
captures Steam process state, recent Steam log inventory, focused CEF/webhelper/
overlay log tails, matching error lines, and rendering-related config hints
under each artifact's `steam-client/` directory so future failures preserve this
evidence without repeatedly restarting Steam. The same matrix supports
`-OnlyCase <id-or-action>` so a suspect or recovering Windows Steam client can
be checked with one targeted Steam-launched probe before any broader suite is
attempted. Follow-up diagnostics showed the white-client state left only
orphaned `gameoverlayui64.exe` helpers with dead target and Steam parent PIDs,
plus Windows resource pressure and `CreateProcess failed. Error: 1455` in Steam
logs. Current matrix artifacts therefore include overlay-helper orphan state and
Windows memory/pagefile/top-process snapshots, and the matrix exposes an
explicit `-CleanStaleOverlayHelpers` switch for stopping only those orphaned
helpers before a new proof run. Live Steam-launched suites now write
`00-preflight/live-run-readiness.json` and fail before the native-load gate or
`steam://rungameid` launch if Steam is not already running in the interactive
Windows desktop session, preventing accidental Steam client startup while the
test machine is unhealthy. The standalone Windows smoke helper now follows the
same default and refuses `-Mode steam-launch` when Steam is closed unless
`-AllowStartSteamClient` is passed intentionally. The dedicated `-Suite
readiness` path collects the
same report-only preflight and live-readiness JSON, then stops before
native-load, shortcut, or launch work so blank/white Steam-client states can be
captured without more Steam churn. The Windows readiness gate also classifies
recent severe CEF/GPU/overlay-renderer log signals such as `0x887A0022`,
context loss, GPU-process restarts, overlay swap-chain failures, and Win32
resource failures, blocking live launch only when those signals are fresh while
Steam is running and preserving stale signals as diagnostic warnings. The
managed Windows matrix cases now use complete-result mode for active overlays:
the smoke app keeps the result pending until Steam emits `active=false` and the
managed close wait, park wait, and open-and-wait completion have all resolved.
That turns managed cases into real close/back-to-app proof when an operator or
verified UI probe closes the overlay, rather than accepting show-only callback
evidence.

A 2026-07-03 UTC public D3D11 route matrix passed all 15 managed-route cases at
`C:\Users\admin\steam-bridge-artifacts\windows-d3d11-managed-public-routes-with-web-20260703-001`.
The run used the signed Electron `43.0.0` package, the stable Steam shortcut,
App ID `480`, `-Suite managed-routes`, `-NativeHostBackend d3d11`, and
complete-result mode. It covered web, store, Friends, dialog, shortcut
open/close, profile, players, community, stats, achievements, user, passive
achievement progress, and passive achievement unlock. Twelve cases emitted
Steam overlay activation, all active cases reached close/back-to-app completion,
and every case had clean crash diagnostics. The public route suite intentionally
excludes only real transaction checkout plus raw native observe controls.

A 2026-07-03 UTC default Windows D3D11 route matrix passed the public
managed-route suite without passing `-PresenterMode` or `-NativeHostBackend`:
`C:\Users\admin\steam-bridge-artifacts\windows-default-d3d11-managed-routes-auto-20260703-003`.
The run used the signed Electron `43.0.0` package, the stable Steam shortcut,
public App ID `480`, `-Suite managed-routes`, and `-CloseProbeInput auto`.
Preflight reported `expectedNativeHostBackend=windows-d3d11`, the native-load
gate verified the packaged app, and all route cases passed: web, store,
Friends/chat, dialog-equivalent, programmatic shortcut, Shift+Tab shortcut,
profile, players, community, stats, achievements, user, passive achievement
progress, and passive achievement unlock. The auto close probe opens keyboard
shortcut cases with Shift+Tab, then closes Steam web-backed surfaces through a
screenshot-gated web-panel close control after Steam web content has painted.

The Windows matrix now also has a focused `-Suite shortcut-routes` pass for
public, non-checkout `openShortcutTargetAndWait(...)` targets. The smoke app
records the requested shortcut target in managed-overlay diagnostics, and profile
plus players shortcut targets now resolve the active Steam user ID explicitly
instead of relying on implicit Steam API defaults. The close probe rejects
foreign foreground windows such as Windows application-error dialogs, records the
web-panel click target before sending input, emits
`probe:web-close-target-ready` and `probe:web-close-click-target`, sends the
close click through absolute `SendInput`, and falls back only after preserving
the chosen target. A focused players artifact,
`C:\Users\admin\steam-bridge-artifacts\windows-default-d3d11-shortcut-players-sendinput-allowunhealthy-20260703-001`,
passed with `sent=3`, `method=sendinput`, clean crash diagnostics, and focus
returning to the smoke app.

Do not treat the new shortcut suite as fully green yet. A broader run reached
friends, web, store, profile, and players before the community shortcut close
path failed, and the focused community artifact
`C:\Users\admin\steam-bridge-artifacts\windows-default-d3d11-shortcut-community-sendinput-allowunhealthy-20260703-001`
opened the community overlay and sent a `SendInput` close click at `x=1334`,
`y=324` after screenshot content readiness, but Steam stayed active until the
case timed out. Crash diagnostics were clean. Those artifacts used
`-AllowUnhealthyDefaultRender` because fresh severe Steam render-health log
entries from earlier failed runs were still inside the readiness window after a
deliberate Steam restart; the route evidence is useful, but it is not pristine
default-render-health proof.

A 2026-07-03 UTC focused public D3D11 checkout suite passed all four checkout
cases at
`C:\Users\admin\steam-bridge-artifacts\windows-d3d11-checkout-suite-focusfix-20260703-001`.
The run used the signed Electron `43.0.0` package, the stable Steam shortcut,
App ID `480`, `-Suite checkout`, `-PresenterMode persistent`,
`-NativeHostBackend d3d11`, `-CloseProbe`, and
`-CloseProbeInput escape-sendinput`. The matrix summary reported
`expectedNativeHostBackend=windows-d3d11`, `cases: total=4 steamLaunch=4
overlayActive=3 clean=4`, clean crash diagnostics, and successful
prepare-only, direct synthetic approval checkout, managed Shift+Tab checkout,
and programmatic checkout shortcut `openAndWait(...)` cases. The shortcut
checkout close probe recorded `probe:shortcut-focus` with the smoke window
focused before sending Shift+Tab, then sent Escape while the foreground window
was the Steam Bridge native overlay host. This remains public checkout routing
proof only; real purchase authorization still requires a configured app/product
and private checkout JSON with `-RequireMicroTxnCallback`.

Latest Windows D3D11 keyboard proof: the refreshed Electron `43.0.0` smoke
bundle was rebuilt on macOS, deployed to the Windows laptop, and Authenticode
signed with the local test certificate. The focused interactive Session 1
artifact
`C:\Users\admin\steam-bridge-artifacts\windows-d3d11-shortcut-keyboard-escapeclose-20260702-190424`
ran `15-managed-shortcut-keyboard` through the stable Steam shortcut with public
App ID `480`, `-PresenterMode persistent`, and `-NativeHostBackend d3d11`.
The strict complete-result path waited for the next keyboard-triggered
`overlayShortcut.onOpen` lifecycle, sent real Shift+Tab to open the Friends
target, then used the close probe's `escape-sendinput` to dismiss Steam. The
result reported `ok=true`, `steamLaunch=true`, `overlayEnabled=true`,
`overlayNeedsPresent=false`, `overlayShown=true`, `overlayClosed=true`,
`overlayParked=true`, `overlayComplete=true`, and `durationMs=2291`. Lifecycle
events show `overlay:presenter-shortcut-ready`, `overlay:shortcut-open`,
`overlay:presenter-wait-shown`, `callback:overlay-activated active=true`,
`overlay:presenter-wait-closed`, `overlay:presenter-parked`, and clean
`process:exit`. The parked presenter snapshot returned to passive,
transparent/click-through, `nativeHostOpen=true`, `overlayActive=false`,
`overlayNeedsPresent=false`, and `currentFps=0`; no lifecycle `:error` events
or crash dumps were recorded, and cleanup left only the Steam client running.

Latest Windows D3D11 passive notification proof: the refreshed Electron
`43.0.0` smoke bundle was rebuilt on macOS, deployed to the Windows laptop, and
signed with the same local test certificate. Two focused interactive Session 1
artifacts,
`C:\Users\admin\steam-bridge-artifacts\windows-d3d11-passive-progress-exact-20260702-193629`
and
`C:\Users\admin\steam-bridge-artifacts\windows-d3d11-passive-unlock-exact-20260702-193629`,
ran `25-managed-achievement-progress` and `26-managed-achievement-unlock`
through the stable Steam shortcut with public App ID `480`,
`-PresenterMode persistent`, and `-NativeHostBackend d3d11`. Both matrix roots
passed `scripts/summarize-windows-overlay-matrix.cjs` locally after artifact
copy. The result payloads reported `ok=true`, `action.ok=true`, `wait.ok=true`,
`passiveNotificationParked=true`, `steamLaunch=true`, and no modal overlay
activation; the progress case recorded `achievement:progress` with
`indicated=true`, while the unlock case recorded `achievement:unlock` with
`activated=true`. Final presenter snapshots stayed `backend="windows-d3d11"`,
`mode="passive"`, `nativeHostOpen=true`, `transparent=true`,
`clickThrough=true`, `focusable=false`, `overlayActive=false`,
`overlayNeedsPresent=false`, and `currentFps=0`. `overlayEnabled=false` is
acceptable for these non-modal notification cases because the verification
contract is the accepted Steam achievement event plus passive presenter state,
not modal overlay readiness. Crash diagnostics were clean, crash-dump counts
were zero, and cleanup left no `SteamBridgeSmoke` or `gameoverlayui64`
processes.

A follow-up Windows source sweep checked Valve's overlay requirements,
`ISteamFriends` overlay routes, Electron command-line-switch and offscreen
rendering behavior, Electron in-process-GPU issue reports, steamworks.js overlay
issue history, Steamworks.NET launch/injection guidance, WebView2 overlay
reports, Construct's browser-overlay writeups, NW.js/Greenworks regressions, and
newer native surface wrapper research. The sources agree on the core tradeoff:
Steam needs a hookable graphics surface, browser runtimes often push GPU work out
of the main process, and Chromium's in-process GPU path is the common Electron
workaround but has real white-window and composition regressions. A local ad-hoc
interactive render probe on the Windows laptop first captured this split under
`C:\Users\admin\steam-bridge-artifacts\windows-render-flag-probe-20260702-001`:
the then-default `in-process-gpu-on` case loaded Steam and emitted
`window:first-render` while the visible BrowserWindow client was blank; the
`in-process-gpu-off` case rendered the full smoke UI but was only a renderer
baseline, not overlay proof; and the
`in-process-gpu-on-disable-direct-composition` case rendered the UI but then
logged `app:child-process-gone` and `app:render-process-gone` crash events. The
packaged `windows-render-health-probe.ps1` then reran the same comparison from
the interactive desktop after the smoke result event and wrote
`C:\Users\admin\steam-bridge-artifacts\windows-render-health-20260702-003\render-health-summary.json`
with status `default-blank-composition-visible`: the then-default case remained
visually blank, while `-OverlayInProcessGpu 0` and
`-OverlayDisableDirectComposition 1` rendered visible smoke UI. The packaged
Windows app now includes that probe so this three-way visual comparison can be
rerun before any Steam-launched overlay matrix. The current default case is the
plain render path with `-OverlayInProcessGpu` unset; `-OverlayInProcessGpu 1`
and DirectComposition-off are explicit comparisons. If the default case is
blank, stop live overlay launch loops; if the DirectComposition-off case is
visible, keep it as diagnostic-only until it proves close/back-to-app, Alt+Tab,
and clean crash behavior.

A current-package Windows refresh on 2026-07-02 rebuilt the Electron `43.0.0`
smoke bundle, deployed it to the Windows laptop, and signed every `.exe`,
`.dll`, and `.node` with the installed local test code-signing certificate.
The package preflight then reported `AuthenticodeStatus=Valid` for both
`SteamBridgeSmoke.exe` and `steam_bridge_native.win32-x64-msvc.node`, and the
Steam live-run readiness gate passed after starting Steam in the interactive
Session 1 desktop: no recent severe CEF/GPU/overlay-renderer signals, only
stale historical severe signals. The native-load gate still failed before live
overlay launch because Smart App Control/App Control blocked
`SteamBridgeSmoke.exe` itself with Code Integrity events 3033/3077 saying the
file did not meet Enterprise signing level requirements. This confirms the
remaining local Windows proof blocker is Windows App Control reputation/policy,
not package freshness or Authenticode syntax. A follow-up diagnostic launch
resolved the existing stable non-Steam shortcut to
`steam://rungameid/13159504457509109760`, then ran one `99-none` case with the
native-load gate intentionally skipped. That artifact,
`C:\Users\admin\steam-bridge-artifacts\windows-steam-launch-appcontrol-blocker-20260702-001`,
timed out without a smoke result and wrote `99-none/steam-launch-blocker.json`
with `blockerCode=windows-app-control-steam-launch-block`, `steamProcessPolicyBlock=true`,
and Code Integrity events showing `Steam\steam.exe` attempted to load
`SteamBridgeSmoke.exe` and was blocked by the same Enterprise signing policy.
This is not overlay proof; it proves the current laptop cannot launch this local
test-signed package even through Steam. Continue live Windows overlay proof only
after using a trusted/reputable
publisher certificate or explicitly moving this development machine's Smart App
Control/App Control policy out of enforcement.
Follow-up policy inventory with `CiTool.exe -lp` confirmed that the laptop has
`VerifiedAndReputableDesktop` and
`VerifiedAndReputableDesktopFlightSupplemental` currently enforced; the
evaluation variants are present but not enforced. Windows preflight now records
that parsed policy list, enforced policy names, and a
`verifiedAndReputableEnforced` flag so future artifacts identify this blocker
directly instead of inferring it only from Code Integrity event text. The matrix
also copies that enforced-policy summary into
`00-preflight/native-load-gate-app-control.json` before it runs the direct
native-load gate. If that gate fails, the matrix writes
`00-preflight/native-load-gate-blocker.json` with a stable blocker code,
post-gate Code Integrity events, related log paths, and next actions for
trusted/reputable signing or explicitly moving the development machine out of
policy enforcement. A later Windows policy research pass checked Microsoft's App
Control and Smart App Control docs: Smart App Control has no individual per-app
bypass, the policy uses `VerifiedAndReputablePolicyState` for
Off/Enforce/Evaluation, and `CiTool.exe` can list and refresh policies on
Windows 11 22H2+. The Windows laptop has `CiTool.exe` and an elevated admin SSH
session but does not expose the ConfigCI policy-authoring cmdlets, so the
repeatable local proof path is now a development-machine state toggle, not an
attempted supplemental policy generated on that host.
`scripts/windows-app-control-dev-mode.ps1` records report JSON, captures
`CiTool.exe -lp`, sets `VerifiedAndReputablePolicyState` only when run
explicitly with `-Mode set`, and refreshes CI policy with `CiTool.exe -r`. If a
Steam-launched case fails before writing a smoke result,
the matrix also captures post-case preflight evidence and writes
`steam-launch-blocker.json`, which the summarizer reports separately from
native-load blockers. `scripts/summarize-windows-overlay-matrix.cjs` now audits
full Windows matrix roots, readiness/preflight captures, native-load blockers,
and Steam-launch blockers so the next live pass can distinguish an expected App
Control gate from an overlay regression without hand-reading helper logs. The Windows
matrix now writes a sanitized `matrix-manifest.json` before preflight, and the
summary auditor uses it to fail completed artifacts that are missing intended
baseline, managed, full, or focused `-OnlyCase` results, required events,
activation/no-activation callbacks, or managed close/park completion evidence.

An experimental one-process Windows control-server run is not accepted as
product proof. It launched and painted correctly, but the first web action ran
before Steam overlay readiness and did not activate the overlay. A separate
readiness diagnostic showed `overlayEnabled=true` shortly after launch, so the
idea may still be useful later, but the current implementation caused too much
Steam client/webhelper churn during live testing. Keep Windows proof on the
ordinary process-per-case baseline matrix until a readiness-gated one-process
harness is designed and proven calmly.

A follow-up Windows App Control diagnostic used a separate non-Steam shortcut
pointing at an unpacked Electron `43.0.0` runtime and the same packaged
`resources/app` payload. This is a development diagnostic only, not product
packaging proof. It bypassed the local `SteamBridgeSmoke.exe` App Control block
for native-load purposes: the `none` action initialized Steam as App ID `480`,
loaded the native addon, wrote a clean result, and exited without crash
diagnostics. Store overlay probes then proved Steam injected
`gameoverlayrenderer64.dll` into `electron.exe` with `GameID = 480` and
`OverlayGameID = 480`, but Steam's renderer failed
`g_IDXGIFactory2_CreateSwapChainForHWND` with `hres=887a0022`, no
`gameoverlayui64.exe` process was started, `IsOverlayEnabled` stayed false, and
no `GameOverlayActivated(true)` callback arrived. The same result held for the
diagnostic in-process GPU path, explicit `--disable-direct-composition`, and
the opt-in compatibility/repaint profile. Current artifacts include
`C:\Users\admin\steam-bridge-artifacts\electron-runtime-steam-none-corrected-20260702-001`,
`C:\Users\admin\steam-bridge-artifacts\electron-runtime-steam-store-corrected-20260702-002`,
`C:\Users\admin\steam-bridge-artifacts\electron-runtime-steam-store-disable-dcomp-20260702-002`,
and
`C:\Users\admin\steam-bridge-artifacts\electron-runtime-steam-store-compat-dcomp-20260702-001`.
The Windows summary auditor now surfaces each case's
`steam-client-rendering-health.json` status and signal codes so this class of
failure reports as a Steam renderer/swap-chain blocker rather than a generic
missing activation.

A later Electron-runtime shortcut diagnostic refreshed the shortcut to point at
the unpacked Electron `43.0.0` runtime while loading the packaged
`resources/app` payload through the smoke env file. The focused Session 1
`10-presenter-ready` run passed live Steam readiness and shortcut verification,
but Windows App Control blocked the nested native dependency load from
`resources/app` even after all signable package files were locally
Authenticode-valid. The artifact
`C:\Users\admin\steam-bridge-artifacts\windows-electron-runtime-presenter-ready-20260702-003`
now writes `10-presenter-ready\case-app-control-blocker.json` with
`windows-app-control-native-dependency-block`, the smoke-result policy evidence,
and fresh Code Integrity events for the blocked native dependency load. This
keeps the current Windows laptop blocker classified as trusted/reputable
signing or local App Control policy state, not an overlay route failure.
Follow-up preflight artifact
`C:\Users\admin\steam-bridge-artifacts\windows-appcontrol-json-preflight-20260702-002`
uses `CiTool.exe -lp -json` and records `ciToolOutputFormat=json`,
`verifiedAndReputableEnforced=true`, and six enforced policies, including
`VerifiedAndReputableDesktop`. That makes the next live-proof choices explicit:
use a trusted/reputable publisher-signing path for product proof, or make a
separate user-approved local App Control test-policy change before continuing
local smoke proof on this laptop.

A focused Community-route diagnostic then used `-NativePath` to point the
updated package at an older native addon that this machine had already accepted.
That run is route evidence only, not packaged-native or D3D11-presenter proof:
the matrix recorded `nativePathOverride=true`, passed live readiness and the
native-load gate, emitted `GameOverlayActivated(true)` for
`presenter-community-open-and-wait`, but lifecycle snapshots reported
`backend=none` and no native host because the override did not contain the
current D3D11 presenter. Close-probe screenshots showed a white smoke window
without visible Community overlay content, no inactive callback arrived, and no
case result was written before the stuck task was stopped and cleaned up.
Continue Windows route expansion only with a current trusted/reputable package
or an explicitly policy-disabled Windows test machine.

The Windows matrix now turns native-presenter native-load checks into a
capability gate. When `-PresenterMode persistent` requests a Windows native
presenter, the preflight gate runs `presenter-ready` instead of `none`, records
`expectedNativeHostBackend` in `matrix-manifest.json`, and requires the smoke
result to show the requested native backend plus an attached native host before
any overlay route case can start. A focused interactive Session 1 diagnostic at
`C:\Users\admin\steam-bridge-artifacts\codex-native-backend-gate-stale-override-session1-20260702-001`
replayed the stale accepted `-NativePath` override with
`-NativeHostBackend d3d11`; the gate rejected it with
`native presenter backend is windows-d3d11` and `native presenter host is open`
before launching a route case. That prevents older accepted native artifacts
from being mistaken for current D3D11 proof.

A follow-up on July 2, 2026 isolated that same `0x887A0022` failure to Windows
Session 0 launches. Microsoft documents `DXGI_ERROR_NOT_CURRENTLY_AVAILABLE` for
DXGI swap-chain creation from Session 0, and SSH-launched Steam/smoke probes
reproduced the failure even with the packaged `SteamBridgeSmoke.exe` shape. The
same `.prev` packaged smoke shortcut launched through an `/IT` scheduled task in
the logged-in desktop Session 1 passed the store overlay path: artifact
`C:\Users\admin\steam-bridge-artifacts\prev-package-interactive-store-20260702-001`
recorded `task-session=1`, `overlayEnabled=true`, `overlayNeedsPresent=true`,
`callback:overlay-activated active=true`, `gameoverlayui64.exe` in Session 1,
and a clean crash snapshot. The Windows helpers now record current and
interactive session IDs and refuse live Steam-launched overlay proof from SSH
Session 0 so future artifacts classify this as a launcher/session error rather
than a Steam Bridge overlay regression.

A current-head July 2, 2026 managed Windows slice keeps Windows on the ordinary
Steam overlay hook instead of creating a native host. The focused
`10-presenter-ready` artifact
`C:\Users\admin\steam-bridge-artifacts\windows-direct-managed-20260702-001-managed-ready-pass-002`
passed from the interactive Session 1 Steam shortcut with `backend=none`,
`nativeHostOpen=false`, `currentFps=0`, `steamLaunch=true`, App ID `480`, clean
crash diagnostics, and no overlay activation requirement. Follow-up artifacts
prove direct managed Windows web, store, and Friends paths can open, receive
Steam overlay callbacks, close, park, and complete without a native presenter:
`windows-managed-web-close-20260702-002`, `windows-managed-store-closeprobe-20260702-003`
using the overlay toggle close probe, and
`windows-managed-friends-escapeprobe-20260702-001` using the Escape close probe.
Those cases recorded `GameOverlayActivated(true)`, `overlay:presenter-wait-shown`,
`GameOverlayActivated(false)`, `overlay:presenter-wait-closed`,
`overlay:presenter-parked`, and `overlay:presenter-open-and-wait-complete`, while
the presenter stayed `backend=none`, `nativeHostOpen=false`, and `currentFps=0`.
The Windows summary auditor now accepts the Windows Steam launch shape by
requiring Steam launch plus `SteamOverlayGameId` / `SteamClientLaunch` /
`SteamEnv` markers instead of requiring a Unix-style `gameoverlayrenderer`
injection marker. It also rejects misleading `steam-launch-blocker.json`
artifacts when a smoke result payload exists beside them, accepts managed close
proof from either the inactive callback or `wait.overlayClosed`, and records
which close probe input was sent.

The Windows native-load gate is now scoped to native addon load/crash proof. It
passes `-AllowSteamNotRunning` because a direct packaged launch can initialize
the App ID and load `steam_bridge_native.win32-x64-msvc.node` while
`isSteamRunning()` reports false. That avoids misclassifying a successful
`STEAM_BRIDGE_SMOKE_RESULT ok:true` direct gate as a Smart App Control native
load blocker because of stale Code Integrity events from earlier runs.

Do not call the Windows managed suite fully clean yet. Dialog-equivalent and
shortcut routes open and emit active overlay callbacks, but the current
automated close probes do not close those Steam UI surfaces. The stronger
dialog artifacts are `windows-managed-dialog-community-closetab-20260702-006`
and `windows-managed-dialog-community-toggle-20260702-001`: both ran from the
interactive Windows Session 1 desktop after a shortcut refresh and Steam
restart, passed readiness and native-load gates, reached
`GameOverlayActivated(true)` and `overlay:presenter-wait-shown`, sent the
requested close probe input, and then timed out before
`GameOverlayActivated(false)`, `overlay:presenter-wait-closed`,
`overlay:presenter-parked`, or `overlay:presenter-open-and-wait-complete`.
`windows-managed-shortcut-escapeprobe-20260702-001` is the equivalent negative
artifact for the managed shortcut target. A follow-up foreground diagnostic,
`windows-managed-dialog-community-foreground-20260702-001`, showed the close
probe was still sending input while the foreground window belonged to
`SteamBridgeSmoke`, not a visible Steam overlay window. Native `SendInput`
diagnostics now cover `toggle-sendinput`, `escape-sendinput`, and
`close-tab-sendinput`; the focused
`windows-managed-dialog-community-close-tab-sendinput-20260702-001` artifact
delivered Ctrl+W successfully with `sent=4`, `expected=4`, and `lastError=0`
while the foreground window remained `SteamBridgeSmoke`, but the overlay stayed
active until the managed close wait timed out. A follow-up focused run,
`windows-managed-dialog-community-screenshot-20260702-001`, added full-desktop
screenshots to the same close-probe lifecycle. Those screenshots show the
foreground smoke window and Steam client desktop, but no visible Steam overlay
surface, even though `GameOverlayActivated(true)` and
`overlay:presenter-wait-shown` fired. Treat this as the remaining Windows
visibility/automation problem for dialog/community-style surfaces, not evidence
that Electron needs a native host on Windows. The Windows managed matrix now
also exposes explicit profile, players, community, stats, achievements, and
user `openAndWait(...)` cases. The focused
`windows-managed-community-screenshot-20260702-002` artifact proved the explicit
`presenter-community-open-and-wait` target has the same invisible-active
behavior. A further generic web probe,
`windows-managed-web-community-url-screenshot-20260702-001`, sent
`presenter-web-open-and-wait` to `https://steamcommunity.com/app/480` and also
reported `GameOverlayActivated(true)` with no visible overlay screenshot before
the managed close wait timed out. That isolates the current Windows failure to
Steam Community-style web content in the overlay rather than the
dialog-equivalent router. A raw native diagnostic follow-up,
`windows-raw-native-dialog-community-observe-20260702-001`, now waits for
`IsOverlayEnabled` before calling `presenter-dialog --dialog Community`, then
uses the close probe for screenshots. It passed Steam-launched verification,
emitted `GameOverlayActivated(true)`, and started `gameoverlayui64`, but the
foreground window stayed `SteamBridgeSmoke` and the detected/before/after
screenshots showed no visible Steam overlay UI. Treat raw native Community on
Windows as callback-only evidence, not a user-visible overlay solution. A
managed profile follow-up,
`windows-managed-profile-screenshot-20260702-001`, tested
`presenter-profile-open-and-wait` against the current user's Steam Community
profile URL. It likewise emitted `GameOverlayActivated(true)` and
`overlay:presenter-wait-shown`, but the foreground window stayed
`SteamBridgeSmoke`, the detected/before/after screenshots showed no visible
Steam overlay UI, and the managed wait timed out before inactive, close, park,
or `open-and-wait` completion. That broadens the Windows issue from the app
Community hub to Steam Community web pages in general. A raw native user
diagnostic,
`windows-native-user-steamid-dcomp-20260702-001`, added
`presenter-user-native --user-dialog steamid` to exercise Valve's documented
`ActivateGameOverlayToUser("steamid", ...)` route. It passed the callback-level
observe case under the same Steam-launched Windows shortcut with
`GameOverlayActivated(true)`, `overlay:presenter-wait-shown`, and no crashes,
but the close-probe screenshots again showed only the smoke app plus Steam's
overlay hint, not a visible profile page. The Steam client logs for the same
timestamp include `OverlayTab1-'Steam Comm'` JavaScript errors for missing
Community `application_config`, so treat native user/profile routes as
callback-only Windows evidence until a visible Steam Community surface is
proven. This also means the current blocker is not simply choosing the native
profile API instead of the Steam Community profile URL.
The Windows summary auditor now surfaces close-probe foreground and screenshot
evidence directly in each row, for example `closeProbeFg=SteamBridgeSmoke`,
`closeProbeScreens=3`, and `closeProbeGameFg=true`, so future active-callback
failures show whether the close probe was still focused on the game window
without opening image files by hand.
It also decodes referenced PNG close-probe screenshots and reports
`closeProbeVisuals=<available>/<referenced>`, mostly-dark counts, low-variance
counts, visible-detail counts, and mean-luma ranges. That makes black, blank,
or visibly detailed overlay screenshots auditable from the matrix summary
before anyone opens the image artifacts manually.

The Windows store route can now be selected in the smoke app and matrix through
`STEAM_BRIDGE_SMOKE_STORE_ROUTE`, `--steam-bridge-smoke-store-route`, and
`windows-overlay-matrix.ps1 -StoreRoute web|native`. A focused native-route run,
`C:\Users\admin\steam-bridge-artifacts\windows-native-presenter-store-native-20260702-122846`,
proved Steam's native `ActivateGameOverlayToStore` path can activate from the
interactive Session 1 shortcut: App ID `480`, `GameOverlayActivated(true)`,
foreground `steamwebhelper`, `overlayEnabled=true`, `overlayNeedsPresent=true`,
and clean crash diagnostics. The same artifact also fixed the close-probe
coordinate model by launching the long probe as `close-probe.ps1` and clicking
the visible Back to Game control from recorded presenter bounds
(`coordinateSource=presenter-bounds`, click `(1445,244)`). Steam still did not
emit `GameOverlayActivated(false)`, park the presenter, or resolve
`openAndWait(...)` before the managed 90-second close wait timed out, so native
store is open/render evidence only, not Windows close/back-to-app proof.

A no-restart child-process comparison attempt at
`C:\Users\admin\steam-bridge-artifacts\windows-profile-unisolated-codex-20260702-091200b`
ran the current matrix with `-OverlayScrubChildEnv 0` and
`-OverlayIsolateChildProcesses 0`, but it is not overlay evidence. It reused an
older wrapper-script Steam shortcut whose launch options pointed at a missing
launcher `.cmd`, so the smoke app never started, no `result.log` was written,
and the close probe timed out waiting for lifecycle evidence. Current Windows
proof should use the stable executable shortcut plus smoke env file; refresh it
with the shortcut suite while Steam is closed before running live cases. The
matrix now dry-validates assumed shortcuts before live launch and writes
`00-preflight/assumed-shortcut.json`, so this failure mode is reported as
shortcut drift instead of surfacing later as a missing smoke result.

The Windows matrix now also gates live Steam-launched cases on default render
health. After native-load passes, it runs `windows-render-health-probe.ps1`
against the packaged app and writes `00-preflight/render-health-gate.json` plus
`00-preflight/render-health/render-health-summary.json`. A default blank/white
window or crash stops the matrix before `steam://rungameid`, because the next
step would otherwise confuse an Electron render failure with a Steam overlay
failure. Explicit non-default comparisons such as `-OverlayInProcessGpu 1` or
`-OverlayDisableDirectComposition 1` skip the default gate and remain diagnostic
runs; they are evidence for choosing the next implementation path, not a
promoted app-builder default.

A current-package Windows Session 1 render-health run on July 2, 2026 at
`C:\Users\admin\steam-bridge-artifacts\windows-render-health-current-20260702-130004`
passed the new default: visible smoke UI with `-OverlayInProcessGpu` unset,
blank client content with explicit `-OverlayInProcessGpu 1`, and visible
DirectComposition-off diagnostics. A focused Steam-launched
`presenter-web-open-and-wait` run with the opt-in `windows-opengl` presenter
then reached overlay activation on App ID `480` with healthy Steam client logs,
but screenshots showed a black native overlay surface, not visible web chrome;
the close probe sent a successful presenter-bounds mouse click and the overlay
remained active until the managed close wait timed out. This keeps the current
Windows blocker on native-presenter content/input behavior, not package signing,
Session 0, Steam client white-window health, or Electron default rendering.

The next Windows comparison made that window-shape result explicit instead of
guessing. A fresh current-package build was cross-built with `cargo-xwin`,
copied into `steam_bridge_native.win32-x64-msvc.node`, packaged, deployed to the
Windows laptop, and signed with the local test certificate. The focused
interactive Session 1 artifact
`C:\Users\admin\steam-bridge-artifacts\windows-native-control-web-20260702-001`
ran `11-managed-web-open-and-wait` through the Steam shortcut with
`-PresenterMode persistent -NativeHostStyle control`. The direct native-load
gate passed against App ID `480`, the default render-health gate was correctly
skipped because this was an explicit non-default native-host comparison, and
Steam emitted `GameOverlayActivated(true)` with `gameoverlayui64` running in
Session 1. Presenter diagnostics recorded `backend=windows-opengl`,
`hostStyle=control`, a normal foreground host window, `overlayEnabled=true`, and
clean crash diagnostics. Screenshots still showed a black/dark Steam overlay
shell rather than visible web content, and the maintained close click at the
presenter-bounds close coordinate `(1445,244)` sent successfully
(`sent=3`, `lastError=0`) but did not produce `GameOverlayActivated(false)`,
presenter parking, or `openAndWait` completion before the 90-second wait
timed out. Treat `STEAM_BRIDGE_WINDOWS_NATIVE_HOST_STYLE=control` as a
diagnostic switch only. It narrowed the failure away from popup/layered/
no-activate window styles and toward the graphics surface/present path that
Steam is actually compositing over.

Online source survey, 2026-07-02: Valve's overlay documentation says the overlay
hooks games launched through Steam, must see `SteamAPI_Init` before the
OpenGL/D3D device is initialized in development, and only supports real graphics
APIs such as DirectX, OpenGL, Metal, and Vulkan; Valve's own browser-game note
says web/browser games need a native D3D host that renders Chromium offscreen and
forwards input, and that this is not easy. Electron's documented command-line
path requires switches to be appended before `app.ready`, and Electron's
offscreen rendering docs identify a supported path for obtaining BrowserWindow
frames when a native graphics host needs to render them itself. The public
Electron/NW.js/steamworks.js/WebView2 reports line up with the local Windows
evidence: `--in-process-gpu` can make Steam hook Chromium by moving GPU work into
the main process, but it is also associated with blank or white windows on newer
Chromium/NW.js/Electron combinations; `--disable-direct-composition` can help a
white overlay in some reports but has ghost-window risk in steamworks.js reports,
and a steamworks.js issue found `--in-process-gpu` without
`--disable-direct-composition` worked better for Alt+Tab behavior. Additional
sources from NW.js/Greenworks, Tauri/WebView2, Steamworks.NET, Chromium
DirectComposition notes, Microsoft DirectComposition/DXGI docs, and the native
overlay wrapper ecosystem reinforce the same direction: keep collecting Steam
CEF/GPU/render-health evidence before restarting Steam, keep Chromium flags
diagnostic-only, and compare the opt-in D3D11/DXGI native presenter beside the
existing WGL presenter before promoting any Windows bridge-owned presenter.
Promotion still requires the same visible UI, close/back-to-app, FPS, focus, and
clean-crash matrix required on Linux and macOS. Sources:
https://partner.steamgames.com/doc/features/overlay,
https://partner.steamgames.com/doc/api/ISteamFriends,
https://www.electronjs.org/docs/latest/api/command-line-switches,
https://www.electronjs.org/docs/latest/tutorial/offscreen-rendering,
https://learn.microsoft.com/en-us/windows/win32/api/d3d11/nf-d3d11-d3d11createdeviceandswapchain,
https://learn.microsoft.com/en-us/windows/win32/api/dxgi/nf-dxgi-idxgifactory-createswapchain,
https://github.com/electron/electron/issues/3340,
https://github.com/electron/electron/issues/18048,
https://github.com/ceifa/steamworks.js/issues/95,
https://github.com/ceifa/steamworks.js/issues/116,
https://github.com/ceifa/steamworks.js/issues/195,
https://github.com/greenheartgames/greenworks/issues/349,
https://github.com/tauri-apps/tauri/issues/6196,
https://github.com/MicrosoftEdge/WebView2Feedback/issues/3200,
https://www.construct.net/en/blogs/ashleys-blog-2/trying-show-steam-overlay-1861,
https://liana.one/integrate-electron-steam-api-steamworks,
https://github.com/nwjs/nw.js/issues/4982,
https://github.com/ArtyProf/steamworks-ffi-node/blob/main/docs/STEAM_OVERLAY_INTEGRATION.md,
https://steamcommunity.com/discussions/forum/10/591756872987476379/,
https://github.com/electron/electron/issues/47662,
https://learn.microsoft.com/en-us/windows/win32/directcomp/basic-concepts,
https://learn.microsoft.com/en-us/windows/win32/api/dxgi/nf-dxgi-idxgifactory-createswapchain,
https://learn.microsoft.com/en-us/windows/win32/api/winuser/nf-winuser-registerrawinputdevices,
https://steamworks.github.io/faq/,
https://partner.steamgames.com/doc/api/isteamfriends,
https://partner.steamgames.com/doc/features/microtransactions/implementation,
https://partner.steamgames.com/doc/api/ISteamUtils#BOverlayNeedsPresent,
https://community.monogame.net/t/steam-overlay-not-showing-with-windows-assembly-of-monogame-3-6/8926.

Current-head Windows native presenter evidence, 2026-07-02: Steam Bridge now has
an opt-in `windows-opengl` presenter for focused proof runs, and the Windows
matrix accepts `-PresenterMode persistent` plus
`-CloseProbeInput web-close-click-sendinput`. A first focused artifact,
`C:\Users\admin\steam-bridge-artifacts\native-presenter-focus-web-20260702-1110`,
proved the native host can become the foreground window and render Steam overlay
UI: the close probe foreground was `Steam Bridge Native Overlay Host`, Steam
emitted `GameOverlayActivated(true)` for App ID `480`, `gameoverlayui64` ran in
interactive Session 1, screenshots showed the Steam overlay shell/web window,
and crash diagnostics were clean. However Shift+Tab did not close the overlay.
Follow-up artifacts with Ctrl+W, Escape, and a maintained SendInput mouse click
against the visible Steam web close control also timed out before
`GameOverlayActivated(false)`, `overlay:presenter-wait-closed`,
`overlay:presenter-parked`, or `overlay:presenter-open-and-wait-complete`:
`native-presenter-focus-web-closetab-20260702-1114`,
`native-presenter-focus-web-escape-20260702-1117`,
`native-presenter-focus-web-clickclose-20260702-1119`, and
`native-presenter-stylefix-clickclose-20260702-1123`. The last run also removed
layered/tool-window styles while active so the host behaved more like a normal
native OpenGL game surface, but Steam still did not consume input through that
host. Treat the Windows native presenter as useful rendering/focus evidence, not
product proof, until it can close and return to the app from the same matrix.

Follow-up Windows implementation work introduced the D3D11/DXGI native presenter
behind `STEAM_BRIDGE_WINDOWS_NATIVE_HOST_BACKEND=d3d11`,
`--steam-bridge-windows-native-host-backend=d3d11`, and the Windows helper
`-NativeHostBackend d3d11` parameter. After the later managed-route, checkout
routing, shortcut, and passive-notification proof runs, this D3D11 path became
the managed Windows default. The older `windows-opengl` host remains a focused
diagnostic backend. The live Windows requirements stay the same:
Steam-launched interactive Session 1 run, visible overlay UI, input/close proof,
return to the Electron app, no duplicate stale overlay helpers, and clean
Electron/GPU/native crash diagnostics.

A second focused D3D11 run at
`C:\Users\admin\steam-bridge-artifacts\windows-d3d11-web-20260702-002` passed
the managed web `openAndWait` route from the interactive Windows desktop. The
matrix used the stable Steam shortcut with App ID `480`, skipped the default
render-health gate as an explicit non-default comparison, selected
`nativeHostBackend=d3d11`, opened visible Steam overlay UI on the native host,
clicked the Steam web panel close control through `SendInput`, returned focus to
the Electron smoke window, verified `overlayEnabled=true`, and completed with
clean Electron/GPU/native crash diagnostics and no leftover smoke or
`gameoverlayui64` process. The first D3D11 artifact
`windows-d3d11-web-20260702-001` is preserved as the useful miss: it showed the
same visible Steam overlay UI, but the older close probe clicked the host
corner instead of the centered Steam web panel close control.
A follow-up D3D11 store web-route run at
`C:\Users\admin\steam-bridge-artifacts\windows-d3d11-store-20260702-141901`
passed the managed `presenter-store-open-and-wait` route through the same
interactive Session 1 Steam shortcut with App ID `480`. The packaged matrix
used `-PresenterMode persistent -NativeHostBackend d3d11 -StoreRoute web`,
opened visible Steam store overlay UI on the D3D11 host, sent the maintained
foreground-window web close click, returned focus to the Electron smoke window,
recorded `overlay:presenter-wait-shown`, `GameOverlayActivated(true)`,
`overlay:presenter-wait-closed`, `GameOverlayActivated(false)`,
`overlay:presenter-parked`, and `overlay:presenter-open-and-wait-complete`, and
exited with clean crash diagnostics and no leftover smoke or `gameoverlayui64`
processes. This promotes the D3D11 comparison from web-only proof to web plus
store-web proof, but it remains opt-in until Friends/chat, checkout, passive
toasts, shortcut behavior, and Community/profile-style surfaces pass the same
close/back-to-app and crash gates.
A follow-up D3D11 Friends/chat route run at
`C:\Users\admin\steam-bridge-artifacts\windows-d3d11-friends-20260702-142741`
passed `presenter-friends-open-and-wait` through the same Steam-launched
interactive Session 1 path. It reused the stable App ID `480` shortcut, opened
the managed Friends/chat web surface on the D3D11 host, closed through the same
foreground-window web close click, returned focus to the Electron smoke window,
and recorded the full shown/active/closed/inactive/parked/open-and-wait-complete
lifecycle with clean crash diagnostics and no leftover smoke or overlay helper
processes. At that point, D3D11 had focused Windows proof for web, store-web, and
Friends/chat, while real checkout content, passive toasts, shortcut behavior,
and Community/profile-style surfaces still need the same route-specific
evidence before the backend can be considered for default use.
A follow-up D3D11 checkout approval-route run at
`C:\Users\admin\steam-bridge-artifacts\windows-d3d11-checkout-20260702-143311`
passed `presenter-checkout` with the public synthetic transaction ID path
through the same managed Steam-launched setup. The route opened the Steam
checkout approval web surface on the D3D11 host, waited through the direct
open-status gate, emitted `GameOverlayActivated(true)` and
`GameOverlayActivated(false)`, parked the presenter, completed
`overlay:presenter-checkout-open-and-wait-complete`, returned focus to the
Electron smoke window, and exited with clean crash diagnostics and no leftover
smoke or overlay helper processes. This is checkout approval-route plumbing
proof with App ID `480`; real purchase content still requires a real configured
Steam app/product and an actual `InitTxn` response.
A fresh current-package rerun later on July 2, 2026, after deploying the smoke
bundle with `windows-app-control-dev-mode.ps1`, signing it with the local test
certificate, and switching the disposable Windows laptop to
`VerifiedAndReputablePolicyState=0`, did not reproduce the earlier D3D11 web
close pass. The readiness artifact
`C:\Users\admin\steam-bridge-artifacts\windows-readiness-current-20260703-002`
passed in interactive Session 1: the exact packaged app was signed, Steam
initialized under App ID `480`, and App Control's Verified/Reputable policies
were present but not enforced. The focused D3D11 web artifacts
`windows-d3d11-web-current-after-appcontrol-off-20260703-001`,
`windows-d3d11-web-current-sendinput-20260703-001`,
`windows-d3d11-web-current-clickclose-20260703-001`, and the hidden task action
`windows-d3d11-web-hidden-clickclose-20260703-001` all passed the native-load
gate with `backend=windows-d3d11` and clean crash diagnostics, opened Steam's
web overlay, and emitted `GameOverlayActivated(true)`, but none produced
`GameOverlayActivated(false)`, presenter parking, or `openAndWait` completion.
Plain Shift+Tab, native SendInput Shift+Tab, and the maintained foreground
Steam web-panel close click all timed out while the presenter remained active.
The hidden run removed the visible PowerShell harness as a focus variable, so
treat current Windows D3D11 web close/input as blocked again until a fresh pass
restores the closed/parked lifecycle.
After restarting the Steam client to clear that stuck overlay-close state, the
filtered public D3D11 route matrix first passed without generic web at
`C:\Users\admin\steam-bridge-artifacts\windows-d3d11-managed-public-routes-no-web-after-restart-20260702-205500`.
A same-session focused web run at
`C:\Users\admin\steam-bridge-artifacts\windows-d3d11-web-focused-escape-20260703-001`
then passed `11-managed-web-open-and-wait` with `escape-sendinput` close,
foreground return to `SteamBridgeSmoke`, presenter parking, and clean crash
diagnostics. The refreshed public route suite at
`C:\Users\admin\steam-bridge-artifacts\windows-d3d11-managed-public-routes-with-web-20260703-001`
then passed 15 total cases with 12 overlay-active cases, all complete-result
close/back-to-app requirements met, and clean crash diagnostics. Generic web is
now part of the repeatable public route suite; private real checkout remains
separate because it requires a configured Steam app/product and actual
transaction response.
A focused real-keyboard D3D11 shortcut probe,
`C:\Users\admin\steam-bridge-artifacts\windows-d3d11-shortcut-keyboard-20260702-145900`,
did not pass, but it identified a concrete host-window bug instead of another
Steam client problem. The probe sent a real `Shift+Tab` `SendInput` chord after
`overlay:presenter-shortcut-ready`; Windows reported the foreground window as
`Steam Bridge Native Overlay Host`, the host WndProc recorded the key down/up
messages, and the Electron shortcut bridge never emitted `overlay:shortcut-open`
or Steam overlay activation. The Windows native host now shows passive,
click-through host windows with `SW_SHOWNOACTIVATE` and answers
`WM_MOUSEACTIVATE` with `MA_NOACTIVATE` while `WS_EX_NOACTIVATE` is set, so the
passive presenter should stop stealing keyboard focus from Electron. The patch
cross-checks with `cargo-xwin check -p steam-bridge-native --target
x86_64-pc-windows-msvc`, but live retest is currently blocked by the Windows
laptop's Smart App Control/App Control policy rather than overlay behavior:
`windows-d3d11-shortcut-keyboard-20260702-1508` stopped at the native-load gate
because the freshly rebuilt `.node` was blocked by `VerifiedAndReputableDesktop`,
and `windows-direct-shortcut-keyboard-20260702-1511` stopped at the same gate
after the restored bundle hit a Code Integrity block for the local Steam runtime
DLL. Continue live Windows shortcut proof only on a policy-disabled development
machine or with a trusted/reputable publisher-signed package.
An earlier focused artifact,
`C:\Users\admin\steam-bridge-artifacts\native-presenter-wndproc-web-20260702-002`,
rebuilt the Windows native addon with WndProc host diagnostics and passed the
managed web `openAndWait` route through the interactive Session 1 Steam shortcut
with App ID `480`: `overlayShown=true`, `overlayClosed=true`,
`overlayParked=true`, `overlayComplete=true`, `backend=windows-opengl`,
`GameOverlayActivated(true)` followed by `GameOverlayActivated(false)`, clean
crash diagnostics, and focus returned to the Electron app. The maintained
SendInput close probe sent a mouse click to the foreground native host with
`sent=3` and `lastError=0`; the native host diagnostics recorded focus and
activation messages but no `WM_LBUTTONDOWN` / `WM_LBUTTONUP`, which is evidence
that Steam consumed the click before it reached the host WndProc. Treat this as
the first Windows native-presenter web close/back-to-app proof, not yet as
coverage for Friends, store, checkout, passive toasts, shortcut toggle, or all
dialog-equivalent routes.

Focused store route follow-up on the same Windows laptop kept the Steam client
running and ran only `presenter-store-open-and-wait` through the interactive
Session 1 shortcut. Artifacts
`C:\Users\admin\steam-bridge-artifacts\windows-native-presenter-store-20260702-120143`
and
`C:\Users\admin\steam-bridge-artifacts\windows-native-presenter-store-toggle-20260702-001`
both initialized Steam as App ID `480`, attached the `windows-opengl` presenter,
emitted `GameOverlayActivated(true)`, and showed the Steam overlay browser
spinner plus overlay toast with Steam client rendering health reported healthy
and no Electron crash diagnostics. The first run sent a maintained mouse click
to the visible web close control; the second sent a maintained Shift+Tab
SendInput close. Both timed out without `GameOverlayActivated(false)`,
`overlay:presenter-wait-closed`, `overlay:presenter-parked`, or
`overlay:presenter-open-and-wait-complete`. This rules out a bad close
coordinate as the only explanation for the WGL presenter and keeps WGL store as
a route-specific blocker. The later D3D11 store-web pass above makes D3D11 the
current Windows native-presenter candidate for further route expansion, while
WGL remains useful as a diagnostic comparison.

A later current-package Windows proof pass on 2026-07-02 contradicted the older
direct-hook optimism. The render-health artifact
`C:\Users\admin\steam-bridge-artifacts\windows-render-health-current-20260702165045`
showed the then-default `in-process-gpu-on` path as blank/pale even though the
smoke app emitted a first-render result; `in-process-gpu-off` and
`in-process-gpu-on-disable-direct-composition` rendered the app. Focused live
DirectComposition-off runs then proved Steam launch, `IsOverlayEnabled`, and
`GameOverlayActivated(true)` for managed web and Friends paths, but the
screenshots showed only dim/toast or spinner states, `SendInput` close probes
were delivered while the foreground window stayed `SteamBridgeSmoke`, and the
managed wait timed out before `GameOverlayActivated(false)`,
`overlay:presenter-wait-closed`, `overlay:presenter-parked`, or
`overlay:presenter-open-and-wait-complete`. The focused artifacts were
`windows-managed-web-dcomp-current-20260702172500`,
`windows-managed-web-dcomp-escape-20260702173500`, and
`windows-managed-friends-toggle-20260702174500`. A default raw dialog observe
artifact, `windows-raw-dialog-default-20260702175500`, passed callback-level
observe checks but captured the same blank default app window. Treat this as
evidence that Windows direct Electron hooking is not product-ready on the current
machine; the next implementation should either produce visible overlay UI with
close/back-to-app through the direct hook or move Windows to a hidden
bridge-owned native presenter behind the same managed Electron API.

A native Windows control comparison now lives beside the smoke package as
`windows-native-overlay-control.ps1` plus a small C# OpenGL source file. It is
diagnostic-only and not an app-facing API. The control initializes Steam before
creating a native OpenGL window, runs from a Steam non-game shortcut under App
ID `480`, calls the same flat Steam overlay APIs, and captures desktop/client
screenshots plus result JSON. A focused run at
`C:\Users\admin\AppData\Local\Temp\steam-bridge-windows-native-overlay-control-20260702-081410`
launched through Steam, initialized successfully as App ID `480`, observed
`IsOverlayEnabled=true` at 1.2s, called
`ActivateGameOverlayToUser("steamid", currentUser)`, rendered 21,331 frames,
and exited without an exception. Its screenshots show Steam Community profile
content visible on the desktop and a `gameoverlayui64` Back to Game shell over
the native window. That proves the Windows Steam client can render that profile
surface during a native OpenGL control run, but it is still comparison evidence:
it does not prove Electron close/back-to-app behavior and does not justify a
Windows native presenter by itself. The native control's structured result now
redacts the current user's Steam ID and records only presence/type metadata
while still using the ID internally for the overlay call. A follow-up env-file
version of the same control updates the shortcut only once, then rewrites
`%LOCALAPPDATA%\SteamBridgeNativeOverlayControl\native-overlay-control.env` for
each case. On the current Windows laptop, the rebuilt generated executable was
then blocked by Smart App Control / App Control despite a valid local test
Authenticode signature; the artifact
`C:\Users\admin\steam-bridge-artifacts\windows-native-control-user-steamid-20260702-002`
records Code Integrity events 3033/3077 for
`SteamBridgeNativeOverlayControl.exe`. Treat that as a local policy/reputation
blocker for the native control binary, not as overlay behavior.

The macOS matrix can pair `--app-id <your-app-id>` with
`--checkout-json-file <path>` for private configured-product proof, and the
Windows matrix now accepts the same private handoff as `-CheckoutJsonFile` for
focused `-Suite checkout -CloseProbe` proof. Pair it with
`-RequireMicroTxnCallback` when the focused Windows artifact should prove
Steam's purchase authorization callback. Their manifests and summaries audit
source/presence metadata while leaving the JSON path, transaction ID, return
URL, and product details outside committed artifacts. Before live launch, the
matrices validate that the private JSON
resolves through `checkoutTargetFromResult(...)` to a checkout URL or transaction
ID, pass the configured matrix app ID into that resolver so embedded app IDs use
the runtime wrong-app guard, and print only sanitized presence flags. The same
resolver is published as
`steam-bridge-validate-checkout-target --expected-app-id <app-id>` for
standalone private fixture checks before a live matrix run. The macOS summary
auditor now rejects newly generated checkout manifests that carry unredacted
sensitive checkout command values, and it scans smoke result JSON plus
lifecycle logs for raw checkout approval URLs, transaction/order IDs, return
URLs, Steam IDs, configured-product item metadata, price/currency details, and
private checkout CLI arguments.
Newly generated macOS matrix manifests also require each smoke result snapshot
to include the named builder-facing `get*OpenStatus(...)` diagnostics for web,
store, Friends, profile, players, community, stats, achievements, user, dialog,
checkout targets, and the checkout-operation preflight used before starting
`InitTxn`. The summary prints this proof as `openStatuses=true` and
`checkoutOperation=true` for each required case, so future artifacts prove the
side-effect-free preflight status surface stayed wired while overlay routes are
exercised.
Use `--suite checkout` for focused real-product checkout evidence: it runs
checkout prepare-only, direct checkout, managed Shift+Tab checkout, and
programmatic checkout shortcut/open-and-wait with the same redaction,
microtransaction-callback, close/back-to-app, and presenter-parking gates as the
larger suites.

## Latest macOS Evidence

A post-reboot current-head 2026-07-01 Apple Silicon minimal matrix at
`/tmp/steam-bridge-macos-overlay-matrix-post-reboot-descriptor-health-20260701`
passed all 11 Steam-launched App ID `480` cases without repackaging or
restarting Steam. The run first proved that the Steam health gate should count
numbered file descriptors rather than every `lsof` mapped-resource row:
post-reboot Steam was logged on and had no current SteamChrome IPC failure, but
the old row-count check would have false-blocked it at `274/256`; the corrected
descriptor count reported `205/256`, leaving a warning rather than a hard
failure. The live matrix then re-proved managed readiness, direct web/store/
Friends/dialog routes, web/store/Friends/dialog `openAndWait(...)`,
duplicate-open suppression, passive achievement-progress toast behavior,
visible Steam web content where expected, active/inactive callbacks,
close/back-to-app proof, one Metal presenter-backed overlay target, parked
zero-FPS state, disabled needs-present polling, zero managed overlay timing,
managed child-overlay isolation, and clean crash diagnostics.

A post-reboot current-head 2026-07-01 Apple Silicon core matrix at
`/tmp/steam-bridge-macos-overlay-matrix-core-post-reboot-20260701` reused the
same signed arm64-only Electron `43.0.0` package and stable App ID `480`
shortcut without repackaging or restarting Steam, then passed all 37
Steam-launched core cases. The run re-proved managed readiness, direct
web/store/Friends/dialog/checkout/profile/players/community/stats/achievements/
user-chat routes, web/store/Friends/dialog and profile/players/community/stats/
achievements/user-chat `openAndWait(...)` routes, duplicate-open suppression,
passive progress/unlock toasts, checkout approval and prepare-only flows, and
every managed Shift+Tab shortcut target. Every active case reported one Metal
presenter-backed overlay target under App ID `480`, interactive macOS host
state, active/inactive callbacks, visible Steam web content where applicable,
close/back-to-app proof, parked zero-FPS state, disabled needs-present polling,
zero managed overlay timing, managed child-overlay isolation, named
open-status/checkout-operation diagnostics, redacted checkout inputs, and clean
crash diagnostics.

A post-reboot current-head 2026-07-01 Apple Silicon full matrix at
`/tmp/steam-bridge-macos-overlay-matrix-full-post-reboot-20260701` reused the
same signed arm64-only Electron `43.0.0` package and stable App ID `480`
shortcut without repackaging or restarting Steam, then passed all 55
Steam-launched process-per-case routes. It expands the post-reboot proof to
every dialog-equivalent route and every programmatic shortcut
`openAndWait(...)` target while re-proving readiness, direct
web/store/Friends/dialog/checkout/profile/players/community/stats/achievements/
user-chat routes, waited routes, passive progress/unlock toasts, checkout
approval and prepare-only flows, every managed Shift+Tab shortcut target,
visible Steam web content where applicable, active/inactive callbacks,
close/back-to-app proof, one Metal presenter-backed overlay target under App
ID `480`, interactive macOS host state, parked zero-FPS state, disabled
needs-present polling, zero managed overlay timing, managed child-overlay
isolation, named open-status/checkout-operation diagnostics, redacted checkout
inputs, and clean crash diagnostics.

A post-reboot current-head 2026-07-01 Apple Silicon persistent matrix at
`/tmp/steam-bridge-macos-overlay-matrix-persistent-post-reboot-20260701`
reused the same signed arm64-only Electron `43.0.0` package and stable App ID
`480` shortcut without repackaging or restarting Steam, then passed all 51
one-process/control-server cases. The first attempt reached the profile
`openAndWait(...)` case and hit Steam's transient overlay-readiness timeout; the
matrix relaunched the persistent suite through its bounded retry path and the
retry passed. Treat the retry as a Steam-client readiness signal to watch, while
the final artifact proves the successful long-lived-process route. The passing
run covers readiness, web/store/Friends/dialog wait helpers, duplicate-open
suppression, passive progress/unlock toasts, checkout approval and
prepare-only, every managed Shift+Tab shortcut target, every direct
profile/players/community/stats/achievements/user route, every
dialog-equivalent route, and every programmatic shortcut `openAndWait(...)`
target. Every active case reported one Metal presenter-backed overlay target
under App ID `480`, interactive macOS host state, active/inactive callbacks,
visible Steam web content where applicable, close/back-to-app proof, parked
zero-FPS state, disabled needs-present polling, zero managed overlay timing,
managed child-overlay isolation, named open-status/checkout-operation
diagnostics, redacted checkout inputs, and clean crash diagnostics.

A current-head 2026-07-01 Apple Silicon readiness-race slice tightened
`IfAvailable` helpers around Steam disappearing before overlay activation.
Unit coverage now proves direct `openIfAvailable(...)`,
`openAndWaitIfAvailable(...)`, dynamic
`openShortcutTargetAndWaitIfAvailable()`, and
`openCheckoutAndWaitIfAvailable(...)` return `null` for pre-activation
Steam-stopped races without opening Steam overlay UI; the checkout-safe helper
also leaves the transaction callback uncalled. The throwing
`openAndWait(...)` path still rejects before activation. A live minimal matrix
attempt at
`/tmp/steam-bridge-macos-overlay-matrix-ifavailable-readiness-clean-20260701-142457`
used the signed arm64-only Electron `43.0.0` package and stable App ID `480`
shortcut, passed `00-presenter-ready`, then failed `01a-web-direct` before any
observable overlay target because the local Steam client hit the known named
IPC/resource failure (`Failed to create BinarySemaphore` /
`PosixAutoResetEvent`, `errno: 28`, six `gameoverlayui` launches for the same
smoke PID, `overlayEnabled=false`). After fully quitting Steam and deleting 611
stale `/private/tmp/steam_chrome_overlay_uid501_spid*` socket/pipe entries,
`npm run macos:steam-client-health` reported only two stale temp entries but
the client remained `Logged Off [U:1:0]`. Further live macOS overlay proof is
blocked on recovering the local Steam client login/bootstrap state, not on a
native presenter or Electron app failure. The matrix-owned startup/shutdown
cleanup now removes stale
`/private/tmp/steam_chrome_{overlay,shmem}_uid*_spid*` entries after Steam is
fully stopped, alongside the existing orphan `ipcserver` and `steam.pipe`
cleanup, so future matrix-owned restarts clear the same IPC residue captured in
that failure without touching a live Steam client.

A focused current-head 2026-07-01 minimal macOS Apple Silicon matrix at
`/tmp/steam-bridge-macos-overlay-matrix-dynamic-shortcut-20260701-140139`
rebuilt and signed the arm64-only Electron `43.0.0` smoke package, verified the
native launcher/signing shape, reused the stable App ID `480` Steam shortcut
without restarting Steam, and passed all 11 Steam-launched minimal cases after
dynamic shortcut `IfAvailable` hardening. Unit coverage now proves dynamic
shortcut targets are resolved before availability helpers re-check target open
and wait status: unavailable or unwaitable resolved targets return `null`
without activating Steam overlay UI or reporting `overlayShortcut.onError`,
while explicit throwing shortcut helpers still surface unsupported target
errors. The live run re-proved direct web/store/Friends/dialog helpers,
web/store/Friends/dialog `openAndWait(...)`, duplicate-open suppression, passive
notification priming, visible Steam web content where applicable,
active/inactive callbacks, close/back-to-app proof, parked zero-FPS presenter
state, disabled needs-present polling, zero managed overlay timing, managed
child-overlay isolation, and clean crash diagnostics from the Apple
Silicon-only package path.

A current-head 2026-07-01 core macOS Apple Silicon matrix at
`/tmp/steam-bridge-macos-overlay-matrix-core-shortcut-readiness-20260701-062656`
rebuilt and signed the arm64-only Electron `43.0.0` smoke package, verified the
native launcher/signing shape, reused the stable App ID `480` Steam shortcut
without restarting Steam, and passed all 27 Steam-launched core cases after
shortcut readiness hardening. It re-proved readiness, web/store/Friends/dialog
`openAndWait(...)`, duplicate-open suppression, passive progress/unlock toasts,
checkout approval and prepare-only, every managed Shift+Tab shortcut target
(Friends, web, store, checkout, profile, players, community, stats,
achievements, user, and dialog), and direct profile/players/community/stats/
achievements/user routes. Active cases had one Metal presenter-backed overlay
target, visible Steam web content where applicable, active/inactive callbacks,
close/back-to-app proof, parked zero-FPS state, disabled needs-present polling,
zero managed overlay timing, managed child-overlay isolation, and clean crash
diagnostics. This remains public App ID `480` plumbing evidence; real
purchase-content proof still requires a configured product in a real Steam app.

A focused current-head 2026-07-01 minimal macOS Apple Silicon matrix at
`/tmp/steam-bridge-macos-overlay-matrix-minimal-named-helpers-20260701-064718`
rebuilt and signed the arm64-only Electron `43.0.0` smoke package, reused the
stable App ID `480` Steam shortcut without restarting Steam, and passed all 7
Steam-launched minimal cases after the smoke app moved common managed actions
to the named Electron builder helpers. It exercised `openWebAndWait(...)`,
`openStoreAndWait(...)`, `openFriendsAndWait(...)`, `openDialogAndWait(...)`,
duplicate-open suppression through `openWebAndWaitIfAvailable(...)`, and
passive notification priming with visible Steam web content where applicable,
active/inactive callbacks, close/back-to-app proof, parked zero-FPS presenter
state, disabled needs-present polling, zero managed overlay timing, managed
child-overlay isolation, and clean crash diagnostics.

A focused current-head 2026-07-01 minimal macOS Apple Silicon matrix at
`/tmp/steam-bridge-macos-overlay-matrix-minimal-direct-helpers-20260701-070531`
rebuilt and signed the arm64-only Electron `43.0.0` smoke package, reused the
stable App ID `480` Steam shortcut without restarting Steam, and passed all 11
Steam-launched minimal cases after adding named direct helpers. It exercised
direct `openWeb(...)`, `openStore(...)`, `openFriends(...)`, and
`openDialog(...)` calls plus the existing wait-helper, duplicate-open, and
passive notification cases, with visible Steam web content where applicable,
active/inactive callbacks, close/back-to-app proof, parked zero-FPS presenter
state, disabled needs-present polling, zero managed overlay timing, managed
child-overlay isolation, and clean crash diagnostics.

A focused current-head 2026-07-01 minimal macOS Apple Silicon matrix at
`/tmp/steam-bridge-macos-overlay-matrix-minimal-direct-checkout-20260701-071929`
rebuilt and signed the arm64-only Electron `43.0.0` smoke package, reused the
stable App ID `480` Steam shortcut without restarting Steam, and passed all 11
Steam-launched minimal cases after adding named direct checkout target helpers.
Its duplicate-open guard now proves direct target, shortcut/controller,
`openCheckoutIfAvailable(...)`, and `openCheckoutAndWaitIfAvailable(...)`
helpers all return `null` while a managed overlay is already opening, and that
the checkout wait helper does not start its transaction operation in that busy
state. The same run re-proved direct web/store/Friends/dialog helpers,
wait-helper open/close, passive notification priming, visible Steam web content
where applicable, close/back-to-app proof, parked zero-FPS presenter state,
disabled needs-present polling, zero managed overlay timing, managed
child-overlay isolation, and clean crash diagnostics.

A focused current-head 2026-07-01 minimal macOS Apple Silicon matrix at
`/tmp/steam-bridge-macos-overlay-matrix-20260701-073909` rebuilt and signed the
arm64-only Electron `43.0.0` smoke package, reused the stable App ID `480`
Steam shortcut without restarting Steam, and passed all 11 Steam-launched
minimal cases after the smoke app moved managed open-status snapshots and
duplicate-open proof onto the named status helpers. Its duplicate-open guard
now requires named `getWebOpenStatus(...)`, `getStoreOpenStatus(...)`,
`getFriendsOpenStatus()`, and `getCheckoutOpenStatus(...)` evidence to report
`canOpen=false`, `canWait=false`, `reason=opening`, and `waitReason=opening`
while a managed overlay is already opening. The same run re-proved direct
web/store/Friends/dialog helpers, wait-helper open/close, passive notification
priming, visible Steam web content where applicable, close/back-to-app proof,
parked zero-FPS presenter state, disabled needs-present polling, zero managed
overlay timing, managed child-overlay isolation, and clean crash diagnostics.

A focused current-head 2026-07-01 minimal macOS Apple Silicon matrix at
`/tmp/steam-bridge-macos-overlay-matrix-open-statuses-20260701-080050` reused
the signed arm64-only Electron `43.0.0` package and stable App ID `480` shortcut
without restarting Steam, then passed all 11 Steam-launched minimal cases after
the summary auditor began requiring named open-status snapshots from every
smoke result. Every summary row reported `openStatuses=true`, proving the
builder-facing `get*OpenStatus(...)` diagnostics stayed wired for direct
web/store/Friends/dialog opens, `openAndWait(...)` routes, duplicate-open
suppression, and passive notification priming while preserving the same
close/back-to-app, zero-FPS parking, zero managed timing, isolation, and crash
checks.

A current-head 2026-07-01 persistent macOS Apple Silicon matrix at
`/tmp/steam-bridge-macos-overlay-matrix-persistent-open-statuses-20260701-080755`
reused the signed arm64-only Electron `43.0.0` package and stable App ID `480`
shortcut without repackaging or restarting Steam, launched one Steam-owned smoke
process/control-server lifecycle, and passed all 45 persistent cases with
`openStatuses=true` on every summary row. It re-proved readiness,
web/store/Friends/dialog `openAndWait(...)`, duplicate-open suppression,
passive progress/unlock toasts, checkout approval and prepare-only, every
managed Shift+Tab shortcut target, direct profile/players/community/stats/
achievements/user/dialog-equivalent routes, and every programmatic shortcut
`openAndWait(...)` target with close/back-to-app proof, parked zero-FPS state,
zero managed timing, managed isolation, clean crash diagnostics, and no
leftover smoke or overlay processes.

A focused current-head 2026-07-01 minimal macOS Apple Silicon matrix at
`/tmp/steam-bridge-macos-overlay-matrix-20260701-111335` reused the signed
arm64-only Electron `43.0.0` package and stable App ID `480` shortcut without
restarting Steam, ran the strengthened signing verifier before launch, and
passed all 11 Steam-launched minimal cases with the matrix requiring
direct-open readiness-status evidence for direct web/store/Friends/dialog
actions. The smoke app records sanitized readiness-status evidence and waits
through launch-time `overlay-not-ready` with `waitForOverlayReady()` before
invoking named direct helpers. It re-proved direct web/store/Friends/dialog
opens, web/store/Friends/dialog `openAndWait(...)` routes, duplicate-open
suppression, passive toast priming, visible Steam web content,
close/back-to-app proof, parked zero-FPS presenter state, zero managed timing,
managed isolation, and clean crash diagnostics from the Apple Silicon package
path.

A current-head 2026-07-01 core macOS Apple Silicon matrix at
`/tmp/steam-bridge-macos-overlay-matrix-20260701-112850` reused the signed
arm64-only Electron `43.0.0` package and stable App ID `480` shortcut without
restarting Steam, then passed all 31 Steam-launched core cases after extending
the direct readiness-status evidence gate to the checkout approval path. The
regular `presenter-checkout` proof now records sanitized checkout-operation
readiness, waits through launch-time `overlay-not-ready` with
`waitForOverlayReady()` before starting `openCheckoutAndWait(...)`, and keeps
the same active/inactive callback, visible web content, close/back-to-app,
parked zero-FPS, zero managed timing, managed isolation, open-status,
checkout-operation, and clean crash-diagnostic checks as the rest of the core
Apple Silicon package path.

A current-head 2026-07-01 core macOS Apple Silicon matrix at
`/tmp/steam-bridge-macos-overlay-matrix-20260701-114530` reused the same
signed arm64-only Electron `43.0.0` package and stable App ID `480` shortcut
without restarting Steam, then passed all 37 Steam-launched core cases after
adding direct helper readiness-status proof for profile, players, community,
stats, achievements, and user chat routes. The core suite now proves named
direct helpers for web, store, Friends, dialog, checkout approval, profile,
players, community, stats, achievements, and user chat all wait through
launch-time `overlay-not-ready`, record sanitized readiness evidence before
activation, open visible Steam web content where applicable, close back to the
app, park the presenter at zero FPS, preserve managed child-overlay isolation,
and report clean crash diagnostics from the Apple Silicon package path.

A current-head 2026-07-01 persistent macOS Apple Silicon matrix at
`/tmp/steam-bridge-macos-overlay-matrix-20260701-115219` reused the same
signed arm64-only Electron `43.0.0` package and stable App ID `480` shortcut
without repackaging or restarting Steam, launched one Steam-owned smoke process
and control server, and passed all 51 persistent cases. It folds the new direct
profile/players/community/stats/achievements/user-chat readiness-status proof
into the one-process durability suite while re-proving readiness, web/store/
Friends/dialog `openAndWait(...)`, duplicate-open suppression, passive
progress/unlock toasts, checkout approval and prepare-only, every managed
Shift+Tab shortcut target, every programmatic shortcut `openAndWait(...)`
target, visible Steam web content where applicable, close/back-to-app proof,
parked zero-FPS state, zero managed timing, managed isolation, clean
control-server quit behavior, and clean crash diagnostics.

A current-head 2026-07-01 full macOS Apple Silicon matrix at
`/tmp/steam-bridge-macos-overlay-matrix-20260701-120932` reused the same signed
arm64-only Electron `43.0.0` package and stable App ID `480` shortcut without
repackaging or restarting Steam, and passed all 55 Steam-launched
process-per-case routes. It brings the new direct
profile/players/community/stats/achievements/user-chat readiness-status proof
into the broad cold-launch suite while re-proving readiness, direct
web/store/Friends/dialog/checkout routes, web/store/Friends/dialog
`openAndWait(...)`, duplicate-open suppression, passive progress/unlock toasts,
checkout approval and prepare-only, every managed Shift+Tab shortcut target,
every dialog-equivalent route, every programmatic shortcut
`openAndWait(...)` target, visible Steam web content where applicable,
close/back-to-app proof, parked zero-FPS state, zero managed timing, managed
isolation, one Metal presenter-backed overlay target, disabled needs-present
polling, and clean crash diagnostics.

A focused current-head 2026-07-01 checkout macOS Apple Silicon matrix at
`/tmp/steam-bridge-macos-overlay-matrix-20260701-123019` reused the existing
signed arm64 package and stable App ID `480` shortcut and passed all four
checkout routes: prepare-only, direct approval, managed Shift+Tab checkout, and
programmatic shortcut checkout `openAndWait(...)`. The run re-proved
active/inactive callbacks where expected, visible checkout web content before
waited close probes, close/back-to-app proof, parked zero-FPS state, zero
managed timing, managed isolation, one Metal presenter-backed overlay target,
and clean crash diagnostics after adding the app-facing checkout app-ID guard.
Unit coverage now proves `openCheckoutAndWait(...)` checks any app ID embedded
in an `InitTxn`/checkout envelope against the initialized Steam app ID before
opening Steam UI, keeps mismatch errors redacted, releases the scoped presenter
hold, and does not leak wrong-app transaction IDs into overlay calls. Custom
split-step routes can call
`checkoutTargetFromResult(initTxnResponse, { expectedAppId })` for the same
guard.

A follow-up focused current-head 2026-07-01 checkout macOS Apple Silicon matrix
at `/tmp/steam-bridge-macos-overlay-matrix-20260701-124434` rebuilt and signed
the arm64 Electron `43.0.0` smoke package, reused the stable App ID `480`
shortcut without restarting Steam, and passed the same four checkout routes
after the smoke app's split-step shortcut checkout target began passing
`{ expectedAppId: APP_ID }` into `checkoutTargetFromResult(...)`. This re-proved
prepare-only checkout, direct checkout approval, managed Shift+Tab checkout,
and programmatic shortcut checkout `openAndWait(...)` with close/back-to-app
proof, parked zero-FPS state, zero managed timing, managed isolation, one Metal
presenter-backed overlay target under game ID `480`, visible checkout web
content for waited close probes, and clean crash diagnostics.

A focused current-head 2026-07-01 checkout macOS Apple Silicon matrix at
`/tmp/steam-bridge-macos-overlay-matrix-checkout-redacted-20260701-132412`
reused the signed arm64-only Electron `43.0.0` package and stable App ID `480`
shortcut without restarting Steam, and passed checkout prepare-only, direct
checkout approval, managed Shift+Tab checkout, and programmatic shortcut
checkout `openAndWait(...)`. The live command logs redacted checkout
transaction inputs as `REDACTED`, while the summary re-proved one Metal
presenter-backed overlay target under game ID `480`, active/inactive callbacks
where expected, visible checkout web content for waited close probes,
close/back-to-app proof, parked zero-FPS state, zero managed timing, managed
child-overlay isolation, named open-status and checkout-operation diagnostics,
and clean crash diagnostics. This remains public App ID `480` routing evidence;
real purchase-content proof still requires a configured product in a real Steam
app.

A current-head 2026-07-01 core macOS Apple Silicon matrix at
`/tmp/steam-bridge-macos-overlay-matrix-shortcut-recovery-20260701-133627`
rebuilt and signed the arm64-only Electron `43.0.0` smoke package, verified the
native launcher/signing shape, reused the stable App ID `480` shortcut without
restarting Steam, and passed all 37 Steam-launched core cases after macOS
shortcut suspension recovery hardening. It re-proved readiness, direct
web/store/Friends/dialog/checkout/profile/players/community/stats/achievements/
user-chat routes, web/store/Friends/dialog `openAndWait(...)`, duplicate-open
suppression, passive progress/unlock toasts, checkout approval and
prepare-only, every managed Shift+Tab target, close/back-to-app proof, parked
zero-FPS state, zero managed timing, managed child-overlay isolation, one Metal
presenter-backed overlay target, disabled needs-present polling, redacted
checkout command logging, and clean crash diagnostics from the Apple
Silicon-only package path. Unit coverage now also proves a
native-host-unavailable transition while a macOS shortcut wait is suspended
restores app focus and re-registers the fallback shortcut without warning
noise.

A 2026-07-01 full macOS Apple Silicon matrix at
`/tmp/steam-bridge-macos-overlay-matrix-full-isolation-proof-20260701-045604`
rebuilt and signed the arm64 Electron `43.0.0` smoke package, verified the
native launcher/signing shape, reused the stable App ID `480` Steam shortcut
without restarting Steam, and passed all 45 Steam-launched process-per-case
presenter-backed overlay cases. This is the first live full artifact after the
managed overlay isolation verifier became a required product proof: every
presenter case carried `--require-managed-overlay-isolation`, and the summary
now reports `managedIsolation=true` from `scrubSteamOverlayChildProcessEnv=true`
plus scrubbed-env-key diagnostics in the managed Electron overlay snapshot. The
run re-proved
readiness, web/store/Friends/dialog `openAndWait(...)`, passive progress/unlock
toasts, checkout approval and prepare-only routes, every managed Shift+Tab
shortcut target including checkout, direct profile/players/community/stats/
achievements/user routes, every dialog-equivalent route, and every
programmatic shortcut `openAndWait(...)` target. Active cases reported one Metal
presenter-backed overlay target, visible Steam web content before close where
applicable, active/inactive callbacks, close/back-to-app proof, parked
zero-FPS presenter state, `idleStable=true` for active close paths, disabled
needs-present polling, zero managed overlay timing, and clean crash diagnostics.
This remains public App ID `480` plumbing
evidence; real purchase-content proof still requires a configured product in a
real Steam app.

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
A current-head persistent run at
`/tmp/steam-bridge-macos-overlay-matrix-20260630-224828` reused the signed Apple
Silicon Electron `43.0.0` package and stable shortcut without repackaging or
restarting Steam, launched one Steam-owned App ID `480` smoke process, drove all
44 cases through the localhost control server, and passed the summary audit. It
re-proved readiness, web/store/Friends/dialog `openAndWait(...)`, passive
progress/unlock toasts, checkout approval and prepare-only, every managed
Shift+Tab shortcut target, direct profile/players/community/stats/achievements/
user/dialog routes, every programmatic shortcut open-and-wait target, one Metal
presenter-backed overlay target, active/inactive callbacks where expected,
visible Steam web content before close probes, app focus return, parked
zero-FPS presenter state, disabled needs-present polling, zero managed overlay
timing, clean control-server quit behavior, no leftover smoke/gameoverlay
process, and clean crash diagnostics.
A fresh 2026-07-01 persistent macOS matrix at
`/tmp/steam-bridge-macos-overlay-matrix-20260701-003835` reused the same signed
Apple Silicon Electron `43.0.0` package and stable shortcut without repackaging
or restarting Steam, launched one Steam-owned App ID `480` smoke process, drove
all 44 cases through the control server, and passed the summary audit. This
re-proved readiness, web/store/Friends/dialog `openAndWait(...)`, passive
progress/unlock toasts, checkout approval and prepare-only, every managed
Shift+Tab shortcut target, direct profile/players/community/stats/achievements/
user/dialog routes, every programmatic shortcut open-and-wait target, one Metal
presenter-backed overlay target, active/inactive callbacks where expected,
visible Steam web content before close probes, app focus return, parked
zero-FPS presenter state, disabled needs-present polling, zero managed overlay
timing, clean control-server quit behavior, no leftover smoke/gameoverlay
process, and clean crash diagnostics. Current macOS web-close helper runs also
record `overlay:web-visible`, and the matrix summary rejects web-close cases
whose lifecycle never proves visible Steam web content before the close input.
A current-head 2026-07-01 persistent macOS matrix at
`/tmp/steam-bridge-macos-overlay-matrix-20260701-033432` rebuilt and signed the
arm64-only Electron `43.0.0` package, reused the stable shortcut without
restarting Steam, launched one Steam-owned App ID `480` smoke process, drove
all 45 persistent cases through the control server, and passed the summary
audit. It adds the expanded `presenter-duplicate-open-guard` proof to the broad
one-process matrix: both `getOpenStatus(...)` and `getShortcutOpenStatus()`
reported `reason: "opening"`, `openIfAvailable(...)`,
`openAndWaitIfAvailable(...)`, `openShortcutTargetIfAvailable()`,
`openShortcutTargetAndWaitIfAvailable()`, and
both `openCheckoutIfAvailable(...)` and
`openCheckoutAndWaitIfAvailable(...)` all returned `null`, and the checkout
operation callback was not run. The same run re-proved readiness,
web/store/Friends/dialog `openAndWait(...)`, passive progress/unlock toasts,
checkout approval and prepare-only, every managed Shift+Tab shortcut target,
every direct profile/players/community/stats/achievements/user/dialog route,
every programmatic shortcut open-and-wait target, one Metal presenter-backed
overlay target, visible Steam web content before close probes, app focus
return, parked zero-FPS state, disabled needs-present polling, zero managed
overlay timing, clean control-server quit behavior, no leftover
smoke/gameoverlay process, and clean crash diagnostics.
A fresh 2026-07-01 full cold-launch macOS matrix at
`/tmp/steam-bridge-macos-overlay-matrix-full-web-visible-fixed-20260701-015118`
rebuilt and signed the Apple Silicon Electron `43.0.0` package, reused the
stable shortcut without restarting Steam, and passed all 44 process-per-case App
ID `480` cases. The summary reported `webVisible=true` for all 29 web-close
cases after the helper event writer stopped appending a stray `}` to JSON
payloads and started base64-transporting lifecycle payloads across the
shell/Node boundary. This re-proved readiness, web/store/Friends/dialog
`openAndWait(...)`, passive progress/unlock toasts, checkout approval and
prepare-only, every managed Shift+Tab shortcut target, direct profile/players/
community/stats/achievements/user/dialog routes, every programmatic shortcut
open-and-wait target, one Metal presenter-backed overlay target,
active/inactive callbacks where expected, visible Steam web content before
web-close input, app focus return, parked zero-FPS presenter state, disabled
needs-present polling, zero managed overlay timing, and clean crash diagnostics.
A focused 2026-07-01 minimal macOS Apple Silicon run at
`/tmp/steam-bridge-macos-overlay-matrix-20260701-032532` then rebuilt and
signed the same arm64-only Electron `43.0.0` package and passed all 7 minimal
cases after expanding `presenter-duplicate-open-guard`. The case opened a
managed modal web overlay, recorded `overlay:presenter-duplicate-open-guard`
while both `getOpenStatus(...)` and `getShortcutOpenStatus()` reported
`reason: "opening"`, proved `openIfAvailable(...)`,
`openAndWaitIfAvailable(...)`, `openShortcutTargetIfAvailable()`,
`openShortcutTargetAndWaitIfAvailable()`, and
both `openCheckoutIfAvailable(...)` and
`openCheckoutAndWaitIfAvailable(...)` all returned `null`, proved the checkout
operation callback was not run, then completed the normal visible-web close,
active=false callback, app-frontmost return, zero-FPS parked presenter, zero
managed overlay timing, and clean crash-diagnostic checks. The macOS matrix
summary treats this direct, shortcut/controller, and checkout duplicate-open
suppression proof as a required named minimal/core/full/persistent suite case.
A focused current-head checkout run at
`/tmp/steam-bridge-macos-overlay-matrix-checkout-target-snapshot-20260630-232458`
rebuilt and signed the Apple Silicon Electron `43.0.0` package, reused the
stable shortcut without restarting Steam, and passed the four-case App ID `480`
checkout suite. It covered checkout prepare-only, direct synthetic
approval-route checkout, managed Shift+Tab checkout, and programmatic checkout
shortcut `openAndWait(...)`; the summary now audits sanitized checkout
`targetSnapshot` presence flags on checkout completion. Direct artifact checks
found no raw synthetic transaction ID or checkout approval URL in matrix
metadata or lifecycle logs, no leftover smoke/gameoverlay process, and the same
one Metal presenter-backed overlay target, close/back-to-app, parked zero-FPS,
zero managed timing, and clean crash-diagnostic proof as the broader matrix.
A fresh 2026-07-01 focused checkout run at
`/tmp/steam-bridge-macos-overlay-matrix-20260701-034916` rebuilt and signed the
Apple Silicon Electron `43.0.0` package, reused the stable shortcut without
restarting Steam, and passed all four App ID `480` checkout cases again:
prepare-only, direct synthetic approval-route checkout, managed Shift+Tab
checkout, and programmatic checkout shortcut `openAndWait(...)`. The summary
reported one Metal presenter-backed overlay target for every case,
`webVisible=true` for the direct and programmatic web-close paths,
close/back-to-app proof, parked zero-FPS state, disabled needs-present polling,
zero managed overlay timing, and clean crash diagnostics. This remains public
checkout plumbing proof; real purchase content still requires a real Steam app
ID with a configured product.
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
A current-head locked/asleep matrix at
`/tmp/steam-bridge-macos-overlay-matrix-20260630-223644` rebuilt and signed the
Apple Silicon Electron `43.0.0` package, reused the stable shortcut without a
Steam restart, and passed all six unavailable cases. It adds locked/asleep
readiness preflight proof to the managed web open/wait, checkout-open,
checkout-prepare, programmatic shortcut open/wait, and passive
achievement-progress no-host cases. The summary verified
`available=false`, `STEAM_OVERLAY_NATIVE_HOST_UNAVAILABLE`, reason
`macos-screen-locked`, `screenLocked=true`, `displayAsleep=true`,
`nativeHostOpen=false`, no overlay activation, zero overlay targets, disabled
needs-present polling, zero managed overlay timing, and clean crash diagnostics.
A follow-up interactive minimal matrix at
`/tmp/steam-bridge-macos-overlay-matrix-20260630-224312` reused that signed
package and stable shortcut without repackaging or restarting Steam after the
Mac became interactive again. It passed readiness, web/store/Friends/dialog
`openAndWait(...)`, and passive achievement-progress cases with
`screenLocked=false`, `displayAsleep=false`, one Metal presenter-backed overlay
target for active/passive overlay cases, visible Steam web content before close
probes, active/inactive callbacks for modal routes, app focus return, parked
zero-FPS presenter state, disabled needs-present polling, zero managed overlay
timing, and clean crash diagnostics.
A current-head persistent macOS matrix at
`/tmp/steam-bridge-macos-overlay-matrix-20260630-224828` reused the signed Apple
Silicon Electron `43.0.0` package and stable shortcut without repackaging or
restarting Steam, launched one Steam-owned App ID `480` smoke process, drove all
44 cases through the control server, and passed the summary audit. It re-proved
readiness, web/store/Friends/dialog `openAndWait(...)`, passive progress/unlock
toasts, checkout approval and prepare-only, every managed Shift+Tab shortcut
target, direct profile/players/community/stats/achievements/user/dialog routes,
every programmatic shortcut open-and-wait target, one Metal presenter-backed
overlay target, active/inactive callbacks where expected, visible Steam web
content before close probes, app focus return, parked zero-FPS presenter state,
disabled needs-present polling, zero managed overlay timing, clean
control-server quit behavior, no leftover smoke/gameoverlay process, and clean
crash diagnostics.
A current-head persistent Apple Silicon matrix at
`/tmp/steam-bridge-macos-overlay-matrix-persistent-checkout-operation-20260701-083629`
rebuilt and signed the same arm64-only Electron `43.0.0` package, reused the
stable App ID `480` shortcut without restarting Steam, launched one Steam-owned
smoke process/control-server lifecycle, and passed all 45 persistent cases
after the macOS summary auditor began printing `checkoutOperation=true` beside
`openStatuses=true`. A direct artifact probe verified all 45 smoke snapshots
contained `snapshot.overlay.openStatuses.checkoutOperation` with a checkout
target snapshot and `canStartOperation` boolean; 14 were ready, 30 correctly
reported `overlay-active`, and one readiness preflight correctly reported
`overlay-not-ready`. The run preserved the same web/store/Friends/dialog,
shortcut/toggle, passive progress/unlock toast, checkout approval/prepare,
close/back-to-app, parked zero-FPS, managed isolation, and clean crash
diagnostics.
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
shortcut again. Current health artifacts also include recommended recovery
actions: file-ceiling failures tell the runner to restart Steam from a macOS
session with a higher `launchctl maxfiles` soft limit before live overlay
proof, so repeated IPC exhaustion is not confused with a presenter regression.

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
| `client.overlay.createElectronSteamOverlay(mainWindow).openAndWait({ type: "web", url: "https://store.steampowered.com/app/480/", modal: true })` / `openAndWait({ type: "store", appId: 480 })` / `openAndWait({ type: "friends" })` / `openAndWait({ type: "dialog", dialog: "OfficialGameGroup", appId: 480 })` | The `presenter-web-open-and-wait`, `presenter-store-open-and-wait`, `presenter-friends-open-and-wait`, and `presenter-dialog-auto-open-and-wait` smoke actions open managed presenter-backed Steam surfaces, write their smoke result while the overlay is open, then record `overlay:presenter-open-and-wait-complete` only after Steam closes and the presenter parks. The Deck close verifier requires that completion event after `active=false` for these actions. Current source refreshes Steam diagnostics for side-effect-free status checks: direct `openIfAvailable(...)` returns `null` with `reason: "overlay-not-ready"` while `overlayEnabled=false`, but `openAndWaitIfAvailable(...)` can still wait for readiness before activation; both return `null` with `reason: "steam-unavailable"` when Steam is not running. Generic `openAndWait(...)` now shares that same status gate, so hard blockers fail before native presenter activation while temporary `overlay-not-ready` can wait through readiness for verified managed routes. | Direct proof for the builder-facing one-call open/show/close/park helper without making app code manage Steam callbacks or presenter parking, while avoiding accidental direct activation before the overlay hook is ready. |
| `client.overlay.createElectronSteamOverlay(mainWindow).open({ type: "store", appId: 480 })` | Reuses one managed presenter and opens the app's Steam store page through the native Steam web overlay. A 2026-06-28 Deck Desktop run emitted `active=true` and `active=false`, recorded route `web`, returned focus to the smoke app after the web close probe, and showed no post-close presenter pumping. | Product-shaped replacement for raw Desktop store activation attempts. Use `route: "native"` only for explicit raw-store diagnostics. |
| `steamOverlay.openCheckoutAndWait(() => startTxn())` | With the public SpaceWar smoke app, `presenter-checkout` safely primes the reusable presenter without opening purchase UI unless `STEAM_BRIDGE_SMOKE_CHECKOUT_URL` or `STEAM_BRIDGE_SMOKE_CHECKOUT_TRANSACTION_ID` is provided. When a checkout URL or transaction ID is provided, the smoke action now exercises `openCheckoutAndWait(...)`: it keeps one scoped activation hold through the backend-style checkout result and approval-route open, waits for active/inactive callbacks, records `overlay:presenter-checkout-open-and-wait-complete` after parking, and avoids logging raw checkout URLs or transaction IDs in smoke lifecycle events. The helper accepts direct checkout targets and unwraps documented `InitTxn` envelopes such as `response.params.transid` plus Steam Bridge Web API responses at `data.response.params`. Checkout wait results now include a sanitized `targetSnapshot`, and managed wait failures annotate the original wait error with sanitized `targetSnapshot` plus checkout-specific `checkoutTargetSnapshot` context so apps and smoke artifacts can log failure target shape without raw checkout values. `snapshotSteamOverlayTarget(target)` exposes the same presence-flag diagnostic shape for other logs. Abort signals, overlay-manager close events, and macOS host-unavailable transitions also cover the pending checkout operation, so stopping before the backend returns releases the presenter hold and parks without opening a checkout surface. The safe `openCheckoutAndWaitIfAvailable(...)` variant refreshes Steam diagnostics first and returns `null` without running the transaction callback when Steam is not running, the native host is unavailable, or another managed overlay action is busy. If the only blocker is temporary `overlay-not-ready`, it waits for readiness and still does not run the transaction callback until the checkout UI can be shown. The lower-level async `withCheckoutPrepared(...)` path now waits through temporary `overlay-not-ready` before running its wrapped split-step callback, while synchronous `prepareForCheckout()` remains an immediate hard preflight that refuses to prime the native surface while Steam is stopped, the overlay is not ready, the native host is unavailable, or another managed overlay action is busy. When a real app emits `MicroTxnAuthorizationResponse`, the smoke diagnostics include the current presenter snapshot on `callback:microtxn`, and matrix summaries fail required real-checkout proof if that callback lacks presenter diagnostics, lacks the matching callback app ID, lacks Steam's authorization result, or lands outside the `openCheckoutAndWait(...)` lifecycle before checkout wait completion. | App-facing checkout plumbing no longer requires apps to touch presenter internals, build Steam approval URLs by hand, unwrap common Web API envelopes, leak private checkout values in diagnostics, start purchase operations while the overlay cannot be shown, or wire local overlay-close timers. A real app/product is still required for purchase-content proof, and authorization callbacks should be treated as purchase events rather than overlay-close signals. |
| `client.overlay.createElectronSteamOverlay(mainWindow).open({ type: "friends" })` | Reuses one managed presenter, opens Steam Community chat as the Friends List surface, shows visible Friends/chat UI in Deck Desktop Mode, isolates Electron child processes so only the main/native process is an overlay target, and returns cleanly to the smoke app after the close probe. | The current generic Deck Desktop Mode proof for Friends List/social UI without allowing Steam to hook Electron Chromium children. |
| `steamOverlay.open({ type: "profile", steamId64 })` | Reuses one managed presenter and opens a Steam Community profile page through the native Steam web overlay. A 2026-06-28 Deck Desktop run emitted active/inactive callbacks, captured profile web content, returned focus to the smoke app after the web close probe, and parked idle with stable `pumpCount`. | Product-shaped replacement for the common profile case of raw `ActivateGameOverlayToUser(...)`. |
| `steamOverlay.open({ type: "user", dialog: "steamid", steamId64 })` / `steamOverlay.open({ type: "user", dialog: "chat" })` | Reuses one managed presenter and opens the specified or current user's Steam Community profile page for `steamid`, or the Steam Community chat/Friends surface for `chat`, through the native Steam web overlay. A 2026-06-28 Deck Desktop core matrix run emitted active/inactive callbacks for `steamid`, captured visible Steam web content, returned focus to the smoke app after the web close probe, used one overlay target, and parked idle with stable `pumpCount`. A 2026-06-29 focused Deck Desktop fullscreen run verified the same open/close/back-to-app path for `chat`, including visible Steam chat/Friends content, one `gameoverlayui` target, `active=false` after close, `currentFps=0`, stable post-close `pumpCount`, and no crash evidence. | Product-shaped replacement for common `ActivateGameOverlayToUser(...)` cases that have web-backed equivalents. `stats` and `achievements` also route to web-backed equivalents; pass `route: "native"` only for raw prompt-style user dialog diagnostics. |
| `steamOverlay.open({ type: "players", steamId64 })` | Reuses one managed presenter and opens the current user's or specified user's Steam Community players page through the native Steam web overlay. A 2026-06-28 Deck Desktop run emitted active/inactive callbacks, captured visible Steam players content, returned focus to the smoke app after the web close probe, and parked idle with stable `pumpCount`. | Product-shaped replacement for the raw Desktop Players dialog. |
| `steamOverlay.open({ type: "community", appId })` | Reuses one managed presenter and opens the app's Steam Community hub through the native Steam web overlay. A 2026-06-28 Deck Desktop run emitted `callback:overlay-activated`, captured Steam web content, and returned to the smoke app after the web close probe. | Product-shaped replacement for raw Desktop Community dialog attempts. |
| `steamOverlay.open({ type: "stats", appId })` | Reuses one managed presenter and opens the current user's app stats page through the native Steam web overlay. A 2026-06-28 Deck Desktop run emitted `callback:overlay-activated`, captured stats/profile web content, and returned to the smoke app after the web close probe. | Product-shaped replacement for raw Desktop Stats dialog attempts. |
| `steamOverlay.open({ type: "achievements", appId })` | Reuses one managed presenter and opens the current user's Steam Community stats/achievements page for the app. With App ID `480`, Steam Community redirects to the user's profile, but the overlay still emits active/inactive callbacks and returns cleanly to the smoke app. | Product-shaped replacement for the raw Desktop achievements dialog on apps that expose web-visible Steam Community stats/achievements. |
| `steamOverlay.open({ type: "dialog", dialog })` | For `Friends`, `Players`, `Community`, `OfficialGameGroup`, `Stats`, and `Achievements`, the high-level router opens a presenter-backed web equivalent instead of raw `ActivateGameOverlay(...)`. A 2026-06-28 `presenter-dialog-auto` Deck Desktop matrix proved `Friends`, `Community`, `OfficialGameGroup`, `Stats`, and `Achievements` with visible Steam web content, active/inactive callbacks, one overlay target, clean return to the app, parked transparent/click-through presenter state at `currentFps=0`, no post-close pumping, and no crash evidence. A focused 2026-06-28 `--dialog Players` run passed the same verifier against the Steam Community players page. Unsupported dialog names throw in `route: "auto"` mode; pass `route: "native"` to intentionally exercise the raw dialog path. | Keeps the easy app-facing API on the presenter-backed route while preserving raw Desktop social/dialog investigation coverage. |
| `client.overlay.createElectronSteamOverlay(mainWindow)` default `overlayShortcut` | Pressing Shift+Tab in the Electron app opens the verified Friends/chat presenter-backed Steam web overlay. Deck Desktop runs show visible overlay content, active/inactive callbacks, back-to-app after close, and Shift+Tab-only close passes for managed profile and web shortcut targets. Static shortcut targets now report sanitized `overlayShortcut.target` diagnostics, and `overlayShortcut.onOpen` lets apps or smoke tests observe successful shortcut opens without using target resolver functions for side effects. Programmatic shortcut opens share the side-effect-free status gate, so dynamic shortcut target callbacks are not resolved while Steam is stopped, the native host is unavailable, or the non-waiting open path already knows the overlay hook is not ready. | Product-shaped Electron keyboard toggle support without letting Steam hook Chromium child processes. Pass `overlayShortcut: false` to disable or provide `overlayShortcut.target` to choose another presenter-backed route. |
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
At current head, direct target status and `IfAvailable` helpers also report
or return `null` while Steam's overlay is already active or the managed
presenter is still opening a previous overlay. Checkout `IfAvailable` checks the
same busy state before invoking the transaction operation, so duplicate purchase
presses do not start a second `InitTxn` while the first overlay action is still
in flight.

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

## Latest macOS Recovery Evidence

The local macOS Steam client recovered after a Steam update and shortcut reset.
The stable generic App ID `480` shortcut had to be recreated under userdata
`1686541554`, after which a fresh core Apple Silicon matrix at
`/tmp/steam-bridge-macos-overlay-matrix-20260630-215349` passed all 26
Steam-launched cases. That run reused the signed arm64 Electron package,
verified the native launcher/signing shape, and covered readiness, web, store,
Friends, dialog-equivalent routes, passive achievement progress/unlock toasts,
synthetic checkout approval and prepare-only routes, every managed Shift+Tab
shortcut target, and direct profile, players, community, stats, achievements,
and user-chat `openAndWait(...)` routes. Each active case verified
active/inactive callbacks, visible Steam web content before close, close/back to
the app, one Metal presenter-backed overlay target, parked zero-FPS presenter
state, zero managed overlay timing, and clean crash diagnostics.

A follow-up full Apple Silicon matrix at
`/tmp/steam-bridge-macos-overlay-matrix-20260630-220434` passed all 44
process-per-case App ID `480` cases on the same recovered Steam client. It
expanded the post-recovery proof from the 26-case core suite to every
presenter-backed dialog equivalent and every programmatic shortcut
`openAndWait(...)` target, while preserving one Metal presenter-backed overlay
target, visible web content before close, close/back-to-app proof, parked
zero-FPS state, zero managed overlay timing, and clean crash diagnostics.

A focused 2026-07-01 minimal Apple Silicon matrix at
`/tmp/steam-bridge-macos-overlay-matrix-minimal-full-ifavailable-fixed-20260701-090347`
rebuilt and signed the arm64 Electron `43.0.0` package and passed all 11
Steam-launched cases after the duplicate-open guard began proving every named
managed target's direct and wait-style `IfAvailable` helpers. The first attempt
at this broader proof caught a checkout-operation preflight ordering bug:
`getCheckoutOperationStatus()` could report `overlay-not-ready` while a managed
overlay was already opening. The fixed run proves the status now reports
`opening` first, keeping purchase buttons from starting `InitTxn` during another
managed overlay open.

A focused 2026-07-01 minimal Apple Silicon matrix at
`/tmp/steam-bridge-macos-overlay-matrix-minimal-direct-open-status-20260701-091919`
reused the signed arm64 Electron `43.0.0` package and stable App ID `480`
shortcut without restarting Steam, and passed all 11 Steam-launched cases after
direct managed opens began failing known unavailable statuses before Steam
activation. Unit coverage proves direct opens now throw before activation when
fresh diagnostics already show `overlay-not-ready` or `steam-unavailable`; the
live run re-proved the happy path for direct web/store/Friends/dialog opens,
web/store/Friends/dialog `openAndWait(...)`, duplicate-open suppression,
passive toast priming, visible Steam web content, close/back-to-app proof,
parked zero-FPS presenter state, zero managed timing, managed isolation, and
clean crash diagnostics.
Follow-up unit coverage now extends the same fresh status gate to generic
direct `openAndWait(...)`: hard blockers such as `steam-unavailable` fail before
native presenter activation, while temporary `overlay-not-ready` still waits
for readiness before activating Steam on verified managed targets.

A focused 2026-07-01 checkout Apple Silicon matrix at
`/tmp/steam-bridge-macos-overlay-matrix-checkout-readiness-before-inittxn-20260701-093251`
rebuilt and signed the arm64 Electron `43.0.0` package and stable App ID `480`
shortcut, and passed all four Steam-launched checkout cases after
`openCheckoutAndWait(...)` began waiting for Steam overlay readiness before
invoking the transaction operation. Unit coverage proves a not-yet-ready
overlay leaves the transaction operation untouched and reports only a sanitized
pending checkout snapshot on readiness timeout; the live run re-proved
prepare-only checkout, direct synthetic approval checkout, managed Shift+Tab
checkout, programmatic checkout `openAndWait(...)`, visible Steam web content
for web-close paths, close/back-to-app proof, parked zero-FPS presenter state,
zero managed timing, managed isolation, and clean crash diagnostics.

A focused current-head 2026-07-01 checkout Apple Silicon matrix at
`/tmp/steam-bridge-macos-overlay-matrix-20260701-102924` rebuilt and signed the
same arm64 Electron `43.0.0` package, reused the stable App ID `480` shortcut
without restarting Steam, and passed all four Steam-launched checkout cases
after a first attempt caught launch-time `overlay-not-ready` in the
prepare-only split-step path. `withCheckoutPrepared(...)` now waits for overlay
readiness before invoking the wrapped callback, so prepare-only checkout no
longer needs a startup timer. The passing run re-proved prepare-only checkout,
direct synthetic approval checkout, managed Shift+Tab checkout, programmatic
checkout `openAndWait(...)`, visible Steam web content for web-close paths,
close/back-to-app proof, parked zero-FPS presenter state, zero managed timing,
managed isolation, and clean crash diagnostics.

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

`npm run macos:steam-client-health` now uses `connection_log.txt` as the
authoritative login signal. Current Steam builds can keep webhelper processes
running with `-steamid=0` even after the client is logged in, so `steamid=0`
alone is no longer treated as fatal when the latest connection state is
`Logged On` and there are no current SteamChrome IPC failures. A running Steam
client whose latest connection state is `Logged Off`, `Connecting`,
`Connected`, or `Logging On` remains unhealthy for live overlay proof. The
health artifact still records stale SteamChrome temp entries, `/private/tmp`
Steam pipe state, orphan `ipcserver` state, System V IPC counts, POSIX
semaphore/shared-memory handles, `launchctl maxfiles`, and resource warnings.
Low `launchctl maxfiles` remains a warning by itself, but a running Steam client
already at roughly the whole soft limit is now a health failure so live matrices
stop before SteamChrome or overlay IPC creation can fail underneath the smoke
app. The local Mac still reports a low soft limit of 256, and the latest core
matrix proves the overlay presenter path is working again under the recovered
client when Steam is logged in and below that resource ceiling.

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
   occurs; for required real checkout proof, the matrix summaries now fail
   artifacts where that callback lacks presenter diagnostics, lacks the
   matching callback app ID, lacks Steam's authorization result, or lands
   outside the `openCheckoutAndWait(...)` lifecycle before checkout wait
   completion.
   Order IDs, transaction IDs, Steam IDs, and checkout URLs must remain redacted
   from any shared artifact.
7. Press Back to confirm Steam returns to the running app and the presenter
   parks after `GameOverlayActivated(false)`.
8. Keep private app IDs, item definitions, transaction IDs, publisher keys, and
   private URLs out of committed docs, tests, and examples.
