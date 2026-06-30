# macOS Steam Overlay Notes

Last updated: 2026-06-30

These notes summarize public guidance and issue reports that shaped Steam
Bridge's macOS Electron overlay diagnostics.

## Summary

- Steam API initialization and overlay injection are separate outcomes. A process
  can initialize Steam, fetch auth tickets, and receive callbacks while the
  overlay never appears.
- Valve documents native overlay support for DirectX, OpenGL, Metal, and Vulkan.
  Browser-style runtimes are harder because rendering often happens in a child
  GPU process rather than the process Steam injected.
- On macOS, native apps need the Steam-required code-signing entitlements for the
  overlay to inject correctly.
- For Electron apps, a native Metal/OpenGL host surface can be useful for
  diagnosing whether the overlay can hook a native graphics surface.
- Microtransaction approval through `usersession=client` is overlay-based. Apps
  should provide a `usersession=web` fallback when the overlay is unavailable or
  unreliable.

## Local Smoke Evidence

As of 2026-06-29, the Apple Silicon local developer path can build and package
the Electron smoke app without downloaded release artifacts:

- `npm run native:build` builds the macOS arm64 native addon and links the Steam
  dylibs into `packages/steam-bridge`.
- `npm run example:package:mac` stages `steam_bridge_native.local.node` under
  the release-style `steam_bridge_native.darwin-arm64.node` name when a release
  prebuild is not present.
- The packaged app contains arm64-only `steam_bridge_native.darwin-arm64.node`,
  `libsteam_api.dylib`, and `libsdkencryptedappticket.dylib`.
- The package includes `macos-electron-smoke.sh` beside `SteamBridgeSmoke.app`;
  its self-test uses the shared Node smoke verifier against `darwin/arm64`
  presenter diagnostics. The helper can also discover the Steam non-Steam
  shortcut, print matching shortcut IDs, launch the shortcut with
  `steam://rungameid`, wait for the smoke result, verify the result, and run a
  close probe that requires `GameOverlayActivated(false)`, `openAndWait(...)`
  completion after close, a parked idle presenter, no crash evidence, and the
  smoke app returned frontmost.

As of 2026-06-26 on macOS Apple Silicon, the packaged Electron smoke app can be
launched through a Steam non-Steam shortcut with SpaceWar App ID `480`.

Verified:

- Steam launches the shortcut after the client reloads `shortcuts.vdf`.
- The smoke app receives `SteamClientLaunch=1` and `SteamEnv=1`.
- Direct executable shortcuts preserve `DYLD_INSERT_LIBRARIES` with
  `gameoverlayrenderer.dylib`, so `snapshot.launch.overlayInjection` is `true`.
- The app initializes Steam as App ID `480`, runs the `dialog` autorun action,
  and writes a verifier-readable `STEAM_BRIDGE_SMOKE_RESULT` line.
- The managed native-session autorun action keeps the native presenter pumped
  during the result wait. With the `compatibility` overlay profile, the
  Steam-launched smoke app reports `overlayEnabled=true`,
  `overlayNeedsPresent=false`, and `nativeProbeOpen=true` on macOS Apple
  Silicon.
- `electronScrubSteamOverlayChildProcessEnv()` now preserves macOS
  `DYLD_INSERT_LIBRARIES` entries whose paths contain spaces, such as Steam's
  `Application Support` install path. Before this fix, Electron helper
  processes inherited a broken dyld path and crashed with `DYLD` termination
  before overlay activation could be diagnosed cleanly.
- Strict Steam-launched `presenter-web` runs after that fix are crash-free for
  both `macos-metal` and `macos-opengl` presenter backends. Steam reports the
  smoke process as App ID `480`, `overlayEnabled=true`,
  `overlayNeedsPresent=false`, and Steam's `console_log.txt` shows
  `gameoverlayui` starting for the smoke process.
- The macOS native host now honors the same state contract as the Linux/X11
  presenter: parked hosts are transparent and click-through, while active
  overlay preparation makes the host opaque and input-capable. The Metal backend
  applies that opacity to the render-pass clear color as well as the Cocoa
  window/layer state. Before the launcher identity fix, a strict Steam-launched
  Metal `presenter-web` run verified the smoke snapshot moved to `mode=active`,
  `clickThrough=false`, `transparent=false`, and `currentFps=30` with no crash
  diagnostics, but it still did not emit `GameOverlayActivated(true)`.
- Before the launcher identity fix, a delayed diagnostic activation run, with
  the action fired after Steam had enough time to start `gameoverlayui`, also
  failed to emit `GameOverlayActivated(true)`. This weakened the theory that the
  macOS failure was only an early activation race.
- The smoke app now records macOS `gameoverlayui` process snapshots and
  CoreGraphics Steam/window snapshots in the result payload, instead of
  reporting overlay process diagnostics as Linux-only.
- Those macOS diagnostics show `gameoverlayui` attached to the smoke process,
  but with `-gameid` set to the full non-Steam shortcut game ID while Steamworks
  inside the process reports App ID `480`. On Deck/Linux the wrapper can set
  `SteamOverlayGameId=480`; on macOS the direct executable shortcut preserves
  `DYLD_INSERT_LIBRARIES` but inherits Steam's shortcut overlay game ID. This
  app-ID/overlay-game-ID mismatch explained why the native presenter could be
  active and pumped without a `GameOverlayActivated(true)` callback.
- Forcing the non-Steam shortcut's internal `appid` to `480` is not viable:
  Steam sanitizes it back to a generated local shortcut app ID because the local
  shortcut flag is missing. Pointing the shortcut at a standalone native
  launcher binary is also not viable on macOS; Steam rejected that configuration
  before process creation with `AppError_9`.
- The packaged macOS smoke app now installs a native launcher as the app
  bundle's main executable and moves the Electron binary to
  `SteamBridgeSmoke.electron`. Steam still launches the normal `.app` executable
  path, preserving `DYLD_INSERT_LIBRARIES`; the launcher sets `SteamAppId`,
  `SteamGameId`, and `SteamOverlayGameId` to `480` before `exec`ing Electron.
  A cold-start strict `presenter-web` run verified `overlayEnabled=true`,
  preserved Steam overlay injection, emitted `GameOverlayActivated(true)`, and
  showed `gameoverlayui -pid <app-pid> -gameid 480` attached to the Electron
  process.
- A 2026-06-29 strict `presenter-web-open-and-wait --web-modal true` run through
  the in-bundle native launcher verified the app-facing managed presenter wait
  path on macOS Apple Silicon. The helper launched the non-Steam shortcut,
  wrote the smoke result while the Steam web overlay was active, sent an Escape
  close probe, observed `GameOverlayActivated(false)`, recorded
  `overlay:presenter-open-and-wait-complete` only after close and parking, kept
  the post-close stable presenter at `currentFps=0` with unchanged `pumpCount`,
  found no crash dumps or fatal lifecycle events, and confirmed the smoke app
  was frontmost after close.
- The macOS close probe now focuses the smoke app process before sending its
  close input. This avoids false failures where the helper process or Codex is
  frontmost and receives Escape instead of the Steam overlay. With that focused
  close input, 2026-06-29 follow-up runs verified the same
  `active=true`/`active=false`, `openAndWait(...)` completion-after-park,
  `currentFps=0`, unchanged-`pumpCount`, app-frontmost, and no-crash evidence
  for `presenter-store-open-and-wait`, `presenter-friends-open-and-wait`, and
  `presenter-dialog-auto-open-and-wait --dialog OfficialGameGroup`.
- The macOS packaged helper now has a passive notification verification gate:
  `--require-passive-notification` requires the smoke result and lifecycle log
  to contain the accepted achievement event, the matching Steam callback, no
  modal overlay activation, and a passive managed-presenter snapshot. A
  2026-06-29 focused live run at
  `/tmp/steam-bridge-macos-passive-toast-20260629-094107` passed this gate for
  `presenter-achievement-progress`: Steam accepted progress for App ID `480`,
  emitted `callback:achievement-stored`, kept the presenter passive,
  transparent, click-through, non-focusable, overlay-inactive, and reported no
  crash evidence.
- The managed Electron Shift+Tab shortcut bridge now has a macOS-specific
  focused-window `globalShortcut` fallback. `before-input-event` is too late on
  macOS because Steam can consume Shift+Tab first; the fallback registers only
  while the game window is focused, opens the configured presenter-backed target,
  then unregisters while Steam's overlay is active so a second Shift+Tab closes
  normally.
- A 2026-06-29 full macOS overlay matrix at
  `/tmp/steam-bridge-macos-overlay-matrix-full-20260629-101221` passed 20
  Steam-launched cases for App ID `480`: web/store/Friends/dialog
  `openAndWait(...)`, passive progress/unlock toasts, synthetic checkout
  approval-route plumbing, managed Shift+Tab shortcut open/close, profile,
  community, stats, achievements, user chat/profile, and known dialog
  equivalents. Interactive cases verified active/inactive callbacks, app focus
  return, presenter parking, and no crash evidence. The shortcut case verified
  `overlay:shortcut-open`, `active=true`, presenter shown, Shift+Tab close,
  `active=false`, app frontmost, parked presenter state, and no crash evidence.
- A 2026-06-29 minimal macOS overlay matrix at
  `/tmp/steam-bridge-macos-overlay-matrix-minimal-zero-timing-20260629-151701`
  re-ran web, store, Friends, dialog, and passive achievement-progress routes
  with `--require-zero-managed-overlay-timing` enforced. All five cases passed
  with Steam launch, overlay injection, overlay-enabled diagnostics, no crash
  evidence, and close/focus/park checks for the interactive routes.
- After removing the managed zero-delay restore-focus timer, a 2026-06-29
  minimal macOS overlay matrix at
  `/tmp/steam-bridge-macos-overlay-matrix-minimal-immediate-focus-20260629-152940`
  passed the same five routes with zero managed overlay timing enforced,
  close/focus/park checks for interactive overlays, passive toast diagnostics,
  and no crash evidence.
- A 2026-06-29 full macOS overlay matrix at
  `/tmp/steam-bridge-macos-overlay-matrix-full-helper-current-20260629-171348`
  passed all 20 Steam-launched App ID `480` cases with the current packaged
  helper-level presenter checks, zero managed overlay timing enforced, and no
  Steam restart needed because the stable shortcut was already up to date.
  Coverage included
  web/store/Friends/dialog `openAndWait(...)`, passive progress and unlock
  notifications, synthetic checkout approval-route plumbing, managed Shift+Tab
  shortcut open/close, profile, community, stats, achievements, user chat and
  Steam ID panels, and known dialog variants. Interactive cases verified overlay
  activation/deactivation, active shown presenter snapshots, close/focus
  return, parked idle presenter state, an interactive macOS host environment
  (`screenLocked=false`, `displayAsleep=false`), and no crash evidence. The
  artifact also passes
  `npm run macos:overlay-matrix:summarize -- --artifact-root <path>`, which
  audits each collected result and lifecycle log. Non-store overlay targets must
  attach Steam's `gameoverlayui` to the smoke process under game ID `480`; the
  Steam store surface may report the generated shortcut game ID, so that case is
  validated by Steam launch/injection identity, app ID `480` callbacks,
  close-and-park lifecycle evidence, and crash diagnostics instead.
- A later 2026-06-29 full macOS overlay matrix at
  `/tmp/steam-bridge-macos-overlay-matrix-full-current-20260629-181707`
  repeated the full 20-case Steam-launched suite without updating the stable
  shortcut or restarting Steam. It passed web/store/Friends/dialog
  `openAndWait(...)`, passive progress and unlock notifications, synthetic
  checkout approval-route plumbing, managed Shift+Tab shortcut open/close,
  profile, community, stats, achievements, user chat and Steam ID panels, and
  known dialog variants. Each interactive case verified overlay activation,
  close/deactivation, presenter parking, app focus return, zero managed overlay
  timing, and no crash evidence; passive cases remained parked/passive without
  modal overlay activation.
- A 2026-06-29 minimal macOS overlay matrix at
  `/tmp/steam-bridge-macos-overlay-matrix-minimal-target-validation-20260629-183316`
  passed after adding managed-target preflight validation before presenter
  activation. The five-case suite re-verified web, store, Friends, and
  dialog-equivalent `openAndWait(...)` routes plus passive achievement-progress
  notification proof with zero managed overlay timing, close/focus/park checks
  for interactive overlays, and no crash evidence.
- A 2026-06-29 core macOS overlay matrix at
  `/tmp/steam-bridge-macos-overlay-matrix-core-shortcut-targets-20260629-184303`
  passed 15 Steam-launched App ID `480` cases after expanding managed Shift+Tab
  shortcut coverage from Friends/chat to Friends/chat, modal web, and store
  targets. The shortcut cases verified the expected target in the lifecycle
  `overlay:shortcut-open` event and presenter snapshot, then proved
  Shift+Tab-only open/close, active/inactive callbacks, app focus return,
  parked idle presenter state, zero managed overlay timing, and no crash
  evidence. The same run also re-verified web/store/Friends/dialog
  `openAndWait(...)`, passive progress/unlock notifications, synthetic checkout
  approval-route plumbing, profile, community, stats, achievements, and user
  chat routes.
- A 2026-06-29 core macOS overlay matrix at
  `/tmp/steam-bridge-macos-overlay-matrix-core-players-20260629-185333`
  passed 16 Steam-launched App ID `480` cases after adding the direct
  presenter-backed `players` target to regular macOS coverage. The new Players
  case verified Steam launch/injection, overlay activation/deactivation, active
  shown presenter state, one `gameoverlayui` target under App ID `480`, app
  focus return, parked idle presenter state, zero managed overlay timing, and
  clean crash diagnostics. The same run re-verified the web/store/Friends/dialog
  `openAndWait(...)` routes, passive progress/unlock notifications, synthetic
  checkout approval-route plumbing, managed Shift+Tab Friends/web/store targets,
  profile, community, stats, achievements, and user chat.
- A 2026-06-29 core macOS overlay matrix at
  `/tmp/steam-bridge-macos-overlay-matrix-core-openwait-expanded-20260629-190754`
  passed after switching profile, players, community, stats, achievements, and
  user chat from open-only smoke actions to managed `openAndWait(...)` actions.
  The 16-case artifact verifies `openAndWait=true` for web, store, Friends,
  dialog-equivalent, profile, players, community, stats, achievements, and user
  chat routes. Each wait-helper case records `overlay:presenter-open-and-wait-start`,
  active shown presenter evidence, close/deactivation, completion after
  `active=false`, parked presenter evidence, focus return, zero managed overlay
  timing, and clean crash diagnostics.
- A 2026-06-29 full macOS overlay matrix at
  `/tmp/steam-bridge-macos-overlay-matrix-full-dialog-openwait-20260629-195732`
  passed 23 Steam-launched App ID `480` cases with the current full
  product-route shape. It covers web/store/Friends/dialog, profile, players,
  community, stats, achievements, user chat, user SteamID, and all known
  high-level dialog-equivalent routes through managed `openAndWait(...)`;
  passive progress/unlock toasts; synthetic checkout approval-route plumbing;
  and Shift+Tab shortcut open/close for Friends, web, and store targets. The
  run started with
  `MACOS_OVERLAY_ENVIRONMENT {"screenLocked":false,"displayAsleep":false}` from
  the success-matrix preflight, did not update the stable shortcut, and passed
  artifact summary checks for active/inactive callbacks where expected, active
  shown presenter snapshots, one `gameoverlayui` target, focus return, parked
  idle presenter state at `currentFps=0` after close, no post-close pumping,
  zero managed overlay timing, interactive macOS host state, and clean crash
  diagnostics.
- A later 2026-06-29 core macOS overlay matrix at
  `/tmp/steam-bridge-macos-overlay-matrix-core-shortcut-checkout-20260629-201942`
  expanded managed Shift+Tab shortcut coverage to the synthetic checkout
  approval route. The 17-case Steam-launched run verified Friends, web, store,
  and checkout shortcut targets with active/inactive callbacks, second-Shift+Tab
  close, focus return, parked idle presenter state, zero managed overlay timing,
  one `gameoverlayui` target under App ID `480`, and clean crash diagnostics.
  The checkout shortcut case uses public transaction-ID approval-route plumbing;
  real purchase content still requires a real app/product.
- A later 2026-06-29 core macOS overlay matrix at
  `/tmp/steam-bridge-macos-overlay-matrix-core-all-shortcuts-20260629-203243`
  expanded that proof to every supported presenter-backed shortcut target:
  Friends, modal web, store, checkout approval route, profile, players,
  community, stats, achievements, user chat, and dialog-equivalent. The 24-case
  Steam-launched run passed with active/inactive callbacks, second-Shift+Tab
  close for every shortcut target, focus return, parked idle presenter state,
  zero managed overlay timing, one `gameoverlayui` target under App ID `480`,
  an interactive macOS host environment, no post-close pumping, and clean crash
  diagnostics.
- A later 2026-06-29 core macOS overlay matrix at
  `/tmp/steam-bridge-macos-overlay-matrix-core-close-wait-20260629-212141`
  repeated the 24-case Steam-launched suite after hardening helper and summary
  checks around managed close-wait state. It passed web/store/Friends/dialog,
  profile, players, community, stats, achievements, and user-chat
  `openAndWait(...)` routes; passive progress/unlock toasts; synthetic checkout
  approval-route plumbing; and every supported presenter-backed Shift+Tab
  shortcut target. Every active managed case recorded
  `overlay:presenter-wait-shown`, `overlay:presenter-wait-closed`, and
  `overlay:presenter-parked`, with wait-closed snapshots still attached/open
  but passive, non-focusable, `overlayActive=false`, and `idleFps=0`; final
  parked samples returned to `currentFps=0` with no post-close pumping.
- A later 2026-06-29 full macOS overlay matrix at
  `/tmp/steam-bridge-macos-overlay-matrix-full-close-wait-20260629-214233`
  repeated the broader 31-case Steam-launched suite under those close-wait
  checks. It passed all core routes plus user SteamID and every known
  dialog-equivalent route (`Friends`, `Players`, `Community`,
  `OfficialGameGroup`, `Stats`, and `Achievements`) through managed
  `openAndWait(...)`. The summary auditor reported `managedWaits=true`,
  `zeroTiming=true`, `macInteractive=true`, one `gameoverlayui` target under
  App ID `480`, clean crash diagnostics, and parked presenters for every active
  managed overlay case.
- A 2026-06-29 minimal macOS overlay matrix at
  `/tmp/steam-bridge-macos-overlay-matrix-minimal-helper-current-20260629-170723`
  re-ran the packaged helper after the source-level presenter-shape checks were
  added. It passed web, store, Friends, dialog, and passive achievement-progress
  routes with Steam launch, overlay injection, one `gameoverlayui` target under
  App ID `480`, active shown presenter snapshots for interactive routes,
  interactive macOS host state, zero managed overlay timing, close/focus/park
  checks, passive toast diagnostics, no crash evidence, and no Steam restart
  because the stable shortcut was already up to date.
- `scripts/macos-overlay-matrix.sh` now owns repeatable macOS proof setup. It
  prints or runs a matrix of Steam-launched helper cases, installs or updates one
  stable Steam shortcut with the native launcher env-file flag, restarts Steam
  only when that shortcut is added or materially changed, and passes per-case
  launch state through the env file. It collects result and diagnostic logs,
  then runs `scripts/summarize-macos-overlay-matrix.cjs` to audit Steam
  launch/injection identity, one `gameoverlayui` target attached to the smoke
  process, zero managed overlay timing, passive notification callbacks,
  active shown presenter snapshots in an interactive macOS host environment,
  managed wait-helper shown/closed/parked lifecycle events, close-and-park
  lifecycle evidence, checkout `openCheckoutAndWait(...)` completion after
  close/parking, and crash diagnostics. The manifest and
  summary auditor also support expected native-host-unavailable fail-fast cases:
  an artifact can require the serialized action error code/reason, matching
  `nativeHostUnavailableReason`, unattached/no-host/zero-FPS presenter state,
  and no overlay activation. The managed checkout fail-fast path covers both
  one-call checkout opening and lower-level `prepareForCheckout()` split-step
  preparation. Live success runs now preflight the same macOS
  environment and stop before launching case 1 while the session is locked or
  the display is asleep. Its self-test validates the matrix shape and the
  artifact summarizer without launching Steam.
- A live 2026-06-30 unavailable macOS matrix at
  `/tmp/steam-bridge-macos-overlay-matrix-unavailable-screen-locked-fixed-20260630-024404`
  captured a genuine locked-session state. The two-case suite verified managed
  web `openAndWait(...)` and checkout fail fast with
  `STEAM_OVERLAY_NATIVE_HOST_UNAVAILABLE`, `reason=macos-screen-locked`,
  matching presenter `nativeHostUnavailableReason`, no native host attachment,
  `currentFps=0`, no Steam overlay activation, no `gameoverlayui` targets, and
  clean crash diagnostics. In this state Steam launch and overlay injection were
  still present, while `overlayEnabled=false`; unavailable artifacts therefore
  assert the typed fail-fast/no-host/no-activation contract instead of requiring
  overlay readiness. A display-sleep attempt can also report both
  `screenLocked=true` and `displayAsleep=true`; the verifiers treat
  `macos-screen-locked` as the higher-priority unavailable reason and allow the
  display-asleep flag to be either true or false when the session is locked.
- The packaged macOS helper now performs the same presenter-shape checks at the
  source for close, shortcut-open, and passive-notification verification: active
  shown presenter snapshots must be active/opaque/input-capable with an
  interactive macOS host environment, and parked/passive snapshots must remain
  click-through, overlay-inactive, and interactive. A 2026-06-30 OpenGL rerun
  exposed a macOS Steam renderer crash inside `BOverlayNeedsPresent()` before
  the helper could write a result, so Steam Bridge now disables that SDK call
  for the macOS OpenGL diagnostic backend and reports
  `overlayNeedsPresent=false` there. The macOS Metal product path and Linux/Deck
  still use needs-present polling for overlay presentation. After modal overlays
  close, the stable parked macOS state must return to `currentFps=0` without
  post-close pumping.
- A 2026-06-30 core macOS matrix at
  `/tmp/steam-bridge-macos-overlay-matrix-core-inittxn-envelope-20260630-000000`
  passed 24 Steam-launched App ID `480` cases after the smoke app began wrapping
  checkout test inputs in an `InitTxn`-style `response.params` envelope. The
  checkout approval route emitted active/inactive callbacks, completed
  `openCheckoutAndWait(...)` only after close and parking, returned focus to the
  app, kept zero managed overlay timing, and reported no crash evidence.
- A signed-package full macOS matrix at
  `/tmp/steam-bridge-macos-overlay-matrix-full-signed-package-20260629-234357`
  rebuilt the packaged smoke app, ad-hoc signed the native launcher and renamed
  Electron executable, reused the stable Steam shortcut without restarting
  Steam, and passed all 31 Steam-launched App ID `480` cases. The artifact
  covers web/store/Friends/dialog wait routes, passive progress/unlock toasts,
  checkout approval-route plumbing, every supported Shift+Tab shortcut target,
  direct profile/players/community/stats/achievements/user wait routes, user
  SteamID, every high-level dialog-equivalent route, close/back-to-app proof,
  zero managed overlay timing, one overlay target, and clean crash diagnostics.
- A 2026-06-30 minimal macOS Metal matrix at
  `/tmp/steam-bridge-macos-overlay-matrix-minimal-metal-after-steam-reset-20260630-022500`
  passed after narrowing the needs-present safety guard to the OpenGL diagnostic
  path. The five-case Steam-launched App ID `480` run verified web, store,
  Friends, and dialog-equivalent `openAndWait(...)` routes plus passive
  achievement-progress notification proof with the signed Electron `42.5.1`
  smoke bundle. Interactive cases emitted active/inactive callbacks, returned
  focus to the smoke app after close, parked the Metal presenter at
  `currentFps=0` without post-close pumping, and reported no crash evidence.
- A 2026-06-30 core macOS matrix at
  `/tmp/steam-bridge-macos-overlay-matrix-core-shortcut-focus-electron42-20260630-010009`
  rebuilt the smoke app with Electron `42.5.1`, verified the signed launcher
  bundle shape, did not update the stable shortcut or restart Steam, and passed
  all 24 Steam-launched App ID `480` cases. This run specifically covered the
  checkout shortcut focus-return path after close: `11-shortcut-checkout`
  opened through the macOS Shift+Tab shortcut bridge, closed through the second
  Shift+Tab after `GameOverlayActivated(false)`, parked the presenter at idle,
  returned the smoke app frontmost, kept zero managed overlay timing, and
  reported no crash evidence. The bridge keeps this as a callback/state-driven
  handoff; it does not add a fixed restore-focus delay.
- A later 2026-06-30 full macOS matrix at
  `/tmp/steam-bridge-macos-overlay-matrix-full-electron42-pidfocus-20260630-011628`
  rebuilt and signed the Electron `42.5.1` smoke package, reused the stable
  Steam shortcut without restarting Steam, and passed all 31 Steam-launched App
  ID `480` cases. An earlier full attempt exposed a verifier harness issue:
  stale smoke app instances could remain alive briefly after a successful case,
  and the name-based macOS focus probe could send Escape to the wrong process.
  The helper now focuses the exact result PID before close/shortcut probes, and
  the matrix waits for previous smoke/gameoverlayui processes to exit between
  cases. The passing artifact re-verified every shortcut target, user SteamID,
  all known high-level dialog-equivalent routes, close/back-to-app proof, zero
  managed overlay timing, and clean crash diagnostics.
- A follow-up 2026-06-30 full macOS matrix at
  `/tmp/steam-bridge-macos-overlay-matrix-full-reopened-steam-electron42-20260630-013125`
  reused a freshly reopened Steam client, skipped repackaging, verified the
  existing signed Electron `42.5.1` bundle, and passed the same 31
  Steam-launched App ID `480` cases without restarting Steam. This confirms the
  PID-focused close/shortcut probes and managed presenter lifecycle are stable
  across a normal Steam client restart.
- A later 2026-06-30 full macOS Metal matrix at
  `/tmp/steam-bridge-macos-overlay-matrix-full-narrow-needs-present-20260630-023000`
  skipped repackaging, reused the signed Electron `42.5.1` bundle, and passed
  all 31 Steam-launched App ID `480` cases. The run re-verified web/store,
  Friends/chat, dialog-equivalent routes, passive progress/unlock toasts,
  checkout approval-route plumbing, every supported presenter-backed Shift+Tab
  shortcut target, direct profile/players/community/stats/achievements/user
  wait routes, user SteamID, close/back-to-app proof, zero managed overlay
  timing, one overlay target, and clean crash diagnostics. The macOS crash
  report at `~/Library/Logs/DiagnosticReports/SteamBridgeSmoke.electron-2026-06-30-015110.ips`
  maps to the earlier OpenGL diagnostic rerun
  `/tmp/steam-bridge-macos-overlay-matrix-minimal-opengl-rerun-20260630-015020/04-dialog-official-openwait`,
  where Steam's renderer crashed inside `BOverlayNeedsPresent()` before the
  OpenGL guard; it is not a failure from this Metal product-path matrix.
- The live macOS matrix now runs `scripts/verify-macos-steam-signing.cjs`
  before touching Steam. It checks the native launcher and renamed Electron
  executable for arm64-only slices, valid executable signatures, the dyld
  environment and disabled-library-validation entitlements, absence of App
  Sandbox, and a bundle `Info.plist` whose `CFBundleExecutable` names the native
  launcher rather than the renamed Electron executable. A focused minimal matrix at
  `/tmp/steam-bridge-macos-overlay-matrix-minimal-signing-preflight-20260630-000117`
  rebuilt, signed, verified, and then passed web/store/Friends/dialog wait
  routes plus the passive progress toast. The same verifier is now published in
  the package as `steam-bridge-verify-macos-signing` so app projects can run it
  against their final signed launcher/Electron executable pair before Steam
  overlay testing.
- The macOS helper and matrix summary now fail any `callback:microtxn`
  authorization event that lacks a presenter snapshot. Public App ID `480`
  checkout plumbing normally reports this as `microTxnCallback=n/a`, while real
  configured product runs must show presenter diagnostics at authorization time.
- Managed overlay wait errors now copy the last presenter snapshot's Steam
  overlay diagnostics, macOS host-unavailable reason, and macOS environment onto
  stable error properties and include them in the error message. A bad macOS
  launch or signing shape therefore reports fields such as `overlayEnabled`,
  `appId`, `steamRunning`, `nativeHostUnavailableReason`, `screenLocked`, and
  `displayAsleep` without requiring app code to parse lifecycle logs.

Still not verified:

- `client.utils.isOverlayEnabled()` remains `false` for the Electron
  `BrowserWindow`-only path even with the `compatibility` overlay profile. The
  native presenter path is the product-shaped overlay route; the Chromium-only
  window remains a diagnostic baseline, not the expected overlay target.
- Ad-hoc signing the packaged app with
  `com.apple.security.cs.allow-dyld-environment-variables` and
  `com.apple.security.cs.disable-library-validation` did not make
  `overlayEnabled` turn `true` for the BrowserWindow-only smoke run.
- A shell-wrapper shortcut can set `SteamAppId=480` before app startup, but macOS
  strips the Steam `DYLD_INSERT_LIBRARIES` injection before the Electron child
  process starts, so that path is not useful for overlay verification.
- Real purchase UI still requires a real Steam app ID with a configured product
  or transaction. App ID `480` remains suitable only for generic overlay smoke
  tests and synthetic checkout approval-route plumbing.
- Shipped macOS apps should sign the app bundle Steam launches with the generic
  entitlement template in `examples/electron-basic/entitlements.steam.macos.plist`:
  allow dyld environment variables, disable library validation, and keep App
  Sandbox disabled.

The current macOS result should therefore be treated as Steam launch, injection,
identity alignment, native presenter startup, modal web overlay activation,
close, app focus return, builder-facing `openAndWait(...)` parking coverage,
synthetic checkout `openCheckoutAndWait(...)` approval-route plumbing, managed
Shift+Tab shortcut routing, known presenter-backed web/dialog targets through
managed wait helpers, generic `InitTxn` response-envelope unwrapping, signed
macOS package compatibility with executable signing preflight, and passive
achievement-progress and unlock notifications. Real purchase-content coverage
still needs a real Steam app ID with a configured product before describing
purchase overlay support as complete.

## Primary References

- Steam Microtransactions Implementation Guide:
  https://partner.steamgames.com/doc/features/microtransactions/implementation
- ISteamMicroTxn Web API:
  https://partner.steamgames.com/doc/webapi/isteammicrotxn
- Steam Overlay:
  https://partner.steamgames.com/doc/features/overlay
- Steam macOS platform notes:
  https://partner.steamgames.com/doc/store/application/platforms
- Steamworks API Example Application (SpaceWar):
  https://partner.steamgames.com/doc/sdk/api/example

## Public Issue Reports

- `InitTxn` succeeds but no overlay prompt appears:
  - https://github.com/rlabrecque/Steamworks.NET/issues/176
  - https://github.com/code-disaster/steamworks4j/issues/102
  - https://github.com/Ventero/FRESteamWorks/issues/47
- Electron/browser overlay challenges:
  - https://github.com/ceifa/steamworks.js/issues/102
  - https://www.construct.net/en/blogs/ashleys-blog-2/trying-show-steam-overlay-1861
  - https://github.com/greenheartgames/greenworks/issues/349
- Native overlay host examples and discussion:
  - https://github.com/ArtyProf/steamworks-ffi-node/blob/main/docs/STEAM_OVERLAY_INTEGRATION.md
  - https://discussions.unity.com/t/steam-overlay-not-working-on-macos-ive-tried-everything-found-in-prior-threads/948105

## Practical Guidance

1. Initialize Steam early in the main process.
2. Log `client.utils.getOverlayDiagnostics()` during local testing.
3. Use App ID `480` only for generic smoke tests; switch to your own App ID for
   app-specific achievements, stats, workshop, inventory, or economy flows.
4. For Electron overlay debugging, test both the BrowserWindow path and the
   native overlay probe surface.
5. For purchase flows, treat the overlay as preferred UX rather than the only
   approval path. If `usersession=client` does not surface UI, use
   `usersession=web`, open the returned Steam URL, poll `QueryTxn`, and finalize
   only after approval.
