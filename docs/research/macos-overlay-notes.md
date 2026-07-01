# macOS Steam Overlay Notes

Last updated: 2026-07-01

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
- The macOS close probe initially focused the smoke app process before sending
  close input to avoid helper/Codex focus stealing. A 2026-06-30 minimal matrix
  showed that pre-close refocus can itself steal input from Steam's active
  overlay, causing a false Store close failure. The helper now leaves the active
  Steam overlay focused for close input and verifies the smoke app returns
  frontmost after `GameOverlayActivated(false)`. With that close input,
  2026-06-29 follow-up runs verified the same
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
  `managedIsolation=true`, `idleStable=true`, `zeroTiming=true`,
  `macInteractive=true`, one `gameoverlayui` target under App ID `480`, clean
  crash diagnostics, and parked presenters for every active managed overlay
  case.
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
  close/parking, private checkout result/lifecycle redaction, and crash
  diagnostics. The manifest and
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
  `/tmp/steam-bridge-macos-overlay-matrix-unavailable-checkout-prepare-20260630-115145`
  captured a genuine locked/asleep-session state. The three-case suite verified
  managed web `openAndWait(...)`, checkout-open, and checkout prepare-only fail
  fast with
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
  on macOS by default and reports `overlayNeedsPresent=false` there. A later
  2026-06-30 Electron `42.5.1` Metal run at
  `/tmp/steam-bridge-macos-overlay-matrix-minimal-shown-gated-20260630-043833`
  reproduced the same crash in the Metal product path during
  `04-dialog-official-openwait`, with
  `SteamBridgeSmoke.electron-2026-06-30-043943.ips` showing
  `gameoverlayrenderer.dylib BOverlayNeedsPresent` above
  `steam_bridge_native::overlay_needs_present_c_callback`. The macOS helper's
  `--require-no-crashes` gate now treats fresh `SteamBridgeSmoke*.ips` reports
  from `~/Library/Logs/DiagnosticReports` as failures and copies them into the
  artifact's `macos-crash-reports/` directory with a short signature summary;
  the matrix summarizer now rejects those copied reports during artifact audit
  as well. Linux/Deck still use needs-present polling for overlay presentation.
  A later user-visible macOS crash dialog corresponded to
  `MTLCompilerService-2026-06-30-084244.ips`, whose report named
  `SteamBridgeSmoke.electron` as the responsible process. The public JavaScript
  wrappers now mirror the native macOS default before reaching native code:
  `overlayNeedsPresent()` returns `false`, `isOverlayNeedsPresentPollingEnabled()`
  returns `false`, and `getOverlayDiagnostics()` assembles safe diagnostics
  without calling the native combined diagnostics path. There is no macOS opt-in
  for the crash-prone SDK poll.
  After modal overlays close, the stable parked macOS state must return to
  `currentFps=0` without post-close pumping.
- New macOS matrix manifests require `overlayNeedsPresentPollingEnabled=false`
  in both the top-level Steam diagnostics and native presenter snapshot. Older
  artifacts without that manifest flag can still be summarized, but newly
  generated artifacts fail audit if they cannot prove Steam Bridge avoided the
  crash-prone `BOverlayNeedsPresent()` call.
- Managed macOS `openAndWait(...)` now waits for Steam's overlay diagnostics to
  report `overlayEnabled=true` before calling the Steam overlay activation API.
  If Steam has injected the renderer but still reports the app as not overlay
  ready, the helper fails with the typed `STEAM_OVERLAY_WAIT_TIMEOUT` state
  `be ready` and includes the latest presenter, Steam, crash, and macOS
  environment diagnostics. This replaces the old false-positive path where a
  matrix case could mark success before Steam actually showed an overlay.
- A 2026-06-30 rapid-relaunch macOS matrix at
  `/tmp/steam-bridge-macos-overlay-matrix-minimal-readiness-retry-20260630-052030`
  and the follow-up graceful-cleanup run at
  `/tmp/steam-bridge-macos-overlay-matrix-minimal-graceful-overlay-cleanup-20260630-052538`
  show the remaining harness-local failure mode: after one Steam-launched App ID
  `480` process exits, the next immediate process can report Steam launch and
  overlay injection while `overlayEnabled=false` until the managed readiness wait
  times out. The matrix retries only this narrow, crash-free readiness case and
  preserves the first attempt artifacts; fixed cooldowns and repeated Steam
  restarts are intentionally avoided. Focused standalone product-route proofs at
  `/tmp/steam-bridge-macos-store-openwait-envfile-20260630-051802.log` and
  `/tmp/steam-bridge-macos-friends-openwait-envfile-20260630-052406.log` passed
  with active/inactive overlay callbacks, close/back-to-app, parked presenter
  state, and no newer crash report than the known `BOverlayNeedsPresent` crash.
- The macOS proof shape now includes a persistent, Steam-launched smoke process
  rather than only rapid process-per-route matrices. The packaged smoke app has
  an opt-in localhost control server that writes a token-protected control file,
  accepts action requests against the same internal smoke actions as autorun,
  and can write the same `STEAM_BRIDGE_SMOKE_RESULT` payload shape per action.
  This keeps repeated web/store/Friends/checkout/shortcut proof in one real app
  lifecycle without introducing fixed cooldowns, repeated Steam restarts, or
  user-facing Electron builder complexity. At current head, the persistent
  runner also preserves and retries known crash-free managed wait timeouts after
  Steam launch/injection: readiness stuck before `overlayEnabled=true`, or
  post-action `become active` timeout after the action succeeded. A 2026-06-30
  live persistent suite at
  `/tmp/steam-bridge-macos-overlay-matrix-20260630-063754` launched the signed
  Electron `42.5.1` App ID `480` smoke app once through Steam and drove the full
  31-case overlay inventory over the control server: web/store/Friends/dialog
  `openAndWait(...)`, passive progress and unlock notifications, synthetic
  checkout approval-route plumbing, every managed Shift+Tab shortcut target,
  profile, players, community, stats, achievements, user chat/SteamID, and all
  known dialog-equivalent routes. Every active case verified close/back-to-app
  and parked presenter state, every shortcut case opened and closed through
  Shift+Tab, the stable shortcut was already up to date, the run did not restart
  Steam or require retry, quit through the control server, left no
  smoke/gameoverlay processes behind, and produced no fresh `SteamBridgeSmoke`
  crash report.
- Persistent macOS matrix runs now execute the same aggregate summary auditor as
  the per-process suites. The one-process 31-case proof is rejected if any case
  lacks Steam launch/injection identity, close/park lifecycle evidence, expected
  shortcut target evidence, crash diagnostics, or the manifest-required
  `overlayNeedsPresentPollingEnabled=false` proof.
- A 2026-06-30 persistent macOS suite at
  `/tmp/steam-bridge-macos-overlay-matrix-persistent-summary-after-steam-reset-20260630-082731`
  passed all 31 one-process App ID `480` cases after rebuilding the stale native
  addon and resetting a wedged Steam client overlay state. The summary audited
  web/store/Friends/dialog wait routes, passive progress/unlock toasts,
  synthetic checkout approval routing, every supported Shift+Tab shortcut
  target, profile/players/community/stats/achievements/user wait routes, user
  SteamID, every high-level dialog-equivalent route, close/back-to-app proof,
  one overlay target, zero managed timing, clean crash diagnostics, and
  `overlayNeedsPresentPollingEnabled=false` in both Steam diagnostics and native
  presenter snapshots. The pre-reset failure at
  `/tmp/steam-bridge-macos-overlay-matrix-persistent-summary-fixed-20260630-082416`
  was crash-free and already had the disabled-polling proof, but Steam reported
  `overlayEnabled=false` while its log spawned multiple `gameoverlayui`
  processes for one smoke PID; restarting Steam cleared that client-side state.
- A 2026-06-30 core macOS matrix at
  `/tmp/steam-bridge-macos-overlay-matrix-core-inittxn-envelope-20260630-000000`
  passed 24 Steam-launched App ID `480` cases after the smoke app began wrapping
  checkout test inputs in an `InitTxn`-style `response.params` envelope. The
  checkout approval route emitted active/inactive callbacks, completed
  `openCheckoutAndWait(...)` only after close and parking, returned focus to the
  app, kept zero managed overlay timing, and reported no crash evidence.
- The smoke checkout harness can also read
  `STEAM_BRIDGE_SMOKE_CHECKOUT_JSON_FILE` and pass the parsed
  `InitTxn`/checkout response object directly to `openCheckoutAndWait(...)`.
  This gives real-product macOS proof a generic runtime handoff while keeping
  app IDs, item definitions, transaction IDs, checkout URLs, and publisher data
  out of committed files and launch arguments. The macOS helper and matrix
  expose the same path as `--checkout-json-file`; the matrix can pair it with
  `--app-id <your-app-id>` and audits `checkoutSource=json-file` without
  recording the JSON path. Add `--require-microtxn-callback` for real direct
  checkout proofs that should receive Steam authorization; the artifact summary
  then requires a `MicroTxnAuthorizationResponse` callback with a presenter
  snapshot.
- A focused 2026-06-30 macOS checkout JSON-file proof at
  `/tmp/steam-bridge-macos-checkout-json-20260630-030514` launched the packaged
  Electron `42.5.1` smoke app through the stable Steam shortcut and native
  env-file launcher, read a private `InitTxn`-style JSON file, opened the
  checkout approval route through `openCheckoutAndWait(...)`, emitted active
  then inactive overlay callbacks, returned the app frontmost, completed after
  parking, and left the presenter click-through/transparent at `currentFps=0`
  with no crash evidence. The result and lifecycle artifacts record
  `checkoutSource=json-file` and presence flags only; the synthetic transaction
  value is confined to the private input JSON file.
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
- A later 2026-06-30 core macOS matrix at
  `/tmp/steam-bridge-macos-overlay-matrix-core-json-shortcut-20260630-034839`
  rebuilt and signed the smoke app, reused the stable Steam shortcut without
  restarting Steam, and passed all 24 Steam-launched App ID `480` cases while
  feeding checkout through a local `InitTxn`-style JSON file. Both
  `07-checkout-approval` and `11-shortcut-checkout` reported
  `checkoutSource=json-file`; the shortcut case opened from the managed
  Shift+Tab bridge, emitted active/inactive callbacks, closed with the second
  Shift+Tab, returned the app frontmost, parked the Metal presenter at
  `currentFps=0`, kept zero managed overlay timing, and reported no crash
  evidence.
- A later 2026-06-30 full macOS matrix at
  `/tmp/steam-bridge-macos-overlay-matrix-full-electron42-pidfocus-20260630-011628`
  rebuilt and signed the Electron `42.5.1` smoke package, reused the stable
  Steam shortcut without restarting Steam, and passed all 31 Steam-launched App
  ID `480` cases. An earlier full attempt exposed a verifier harness issue:
  stale smoke app instances could remain alive briefly after a successful case,
  and the name-based macOS focus probe could send Escape to the wrong process.
  The helper now focuses the exact result PID before shortcut-open probes, and
  the matrix waits for previous smoke/gameoverlayui processes to exit between
  cases. The passing artifact re-verified every shortcut target, user SteamID,
  all known high-level dialog-equivalent routes, close/back-to-app proof, zero
  managed overlay timing, and clean crash diagnostics.
- A follow-up 2026-06-30 full macOS matrix at
  `/tmp/steam-bridge-macos-overlay-matrix-full-reopened-steam-electron42-20260630-013125`
  reused a freshly reopened Steam client, skipped repackaging, verified the
  existing signed Electron `42.5.1` bundle, and passed the same 31
  Steam-launched App ID `480` cases without restarting Steam. This confirms the
  PID-focused shortcut probes and managed presenter lifecycle are stable
  across a normal Steam client restart.
- A later 2026-06-30 full macOS matrix at
  `/tmp/steam-bridge-macos-overlay-matrix-full-json-after-reopen-20260630-040037`
  rebuilt and signed the Electron `42.5.1` smoke package after Steam had been
  reopened, reused the stable Steam shortcut without restarting Steam, and
  passed all 31 Steam-launched App ID `480` cases while feeding checkout through
  a local `InitTxn`-style JSON file. The summary audited
  `checkoutSource=json-file` for both direct checkout and
  `11-shortcut-checkout`, verified the Metal presenter backend, one overlay
  target per case, managed wait-helper shown/closed/parked lifecycle events,
  Shift+Tab open/close for every supported shortcut target, app focus return,
  zero managed overlay timing, and clean crash diagnostics.
- A later 2026-06-30 minimal macOS matrix at
  `/tmp/steam-bridge-macos-overlay-matrix-minimal-close-focus-fix-20260630-042214`
  rebuilt and signed the Electron `42.5.1` smoke package, reused the stable
  Steam shortcut without restarting Steam, and passed web, store, Friends,
  dialog-equivalent, and passive-toast cases after the close probe stopped
  refocusing the smoke app before sending Escape. The Store case that had
  previously missed `active=false` closed cleanly with the active Steam overlay
  left focused, then returned the smoke app frontmost, parked the presenter at
  `currentFps=0`, kept zero managed overlay timing, and reported no crash
  evidence.
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
  OpenGL guard; it is not a failure from this Metal product-path matrix. A later
  Metal-path crash in
  `/tmp/steam-bridge-macos-overlay-matrix-minimal-shown-gated-20260630-043833`
  supersedes the old Metal-safe assumption, so current macOS defaults avoid
  `BOverlayNeedsPresent()` entirely. There is no macOS opt-in because the known
  failure mode is a process crash.
- A later 2026-06-30 persistent macOS matrix at
  `/tmp/steam-bridge-macos-overlay-matrix-persistent-electron43-20260630-084237`
  rebuilt and signed the smoke app with Electron `43.0.0`, reused the stable
  Steam shortcut without restarting Steam, launched once through Steam, and
  drove all 31 overlay cases through the localhost control server. The run
  re-verified web/store/Friends/dialog wait routes, passive progress/unlock
  toasts, synthetic checkout approval routing, every supported Shift+Tab
  shortcut target including checkout, direct profile/players/community/stats/
  achievements/user wait routes, user SteamID, every high-level
  dialog-equivalent route, one Metal presenter-backed overlay target per case,
  close/back-to-app proof, zero managed overlay timing,
  `overlayNeedsPresentPollingEnabled=false`, clean crash diagnostics, and clean
  control-server quit behavior on the current Electron package.
- A later 2026-06-30 persistent macOS matrix at
  `/tmp/steam-bridge-macos-overlay-matrix-persistent-generic-launcher-20260630-085852`
  rebuilt and signed the Electron `43.0.0` smoke app after moving the macOS env
  launcher and Steam overlay entitlements into published `steam-bridge`
  templates. The generic launcher template infers `<AppExecutable>.electron`
  beside the launcher and no longer contains smoke-app-specific target names.
  The rebuilt bundle passed all 31 Steam-launched control-server cases without
  restarting Steam, re-verifying web/store/Friends/dialog wait routes, passive
  progress/unlock toasts, checkout approval routing, every supported Shift+Tab
  target, direct profile/players/community/stats/achievements/user wait routes,
  every high-level dialog-equivalent route, one Metal presenter-backed overlay
  target per case, close/back-to-app proof, zero managed overlay timing,
  `overlayNeedsPresentPollingEnabled=false`, clean quit behavior, and no fresh
  crash reports.
- A later 2026-06-30 persistent macOS matrix at
  `/tmp/steam-bridge-macos-overlay-matrix-persistent-prepare-cli-visible-close-20260630-094316`
  rebuilt and signed the same Electron `43.0.0` package through the published
  `steam-bridge-prepare-macos-app` CLI. It reused the stable Steam shortcut
  without restarting Steam, launched once through Steam, drove all 31 overlay
  cases over the control server, and passed the summary audit. Active
  web-backed cases now close only after the helper observes visible Steam web
  content inside the presenter host; this is a harness readiness gate for the
  close probe because `GameOverlayActivated(true)` can precede the first web
  paint. The run re-verified the Metal presenter lifecycle, one overlay target
  per case, app focus return, parked zero-FPS state, zero managed timing,
  `overlayNeedsPresentPollingEnabled=false`, clean control-server quit, no
  leftover smoke/gameoverlay process, and no fresh crash report beyond the older
  known `BOverlayNeedsPresent()` reports.
- A later 2026-06-30 persistent macOS matrix at
  `/tmp/steam-bridge-macos-overlay-matrix-persistent-shortcut-openwait-20260630-101406`
  reused the stable Steam shortcut without restarting Steam and passed 32
  control-server-driven cases. The added
  `19-persistent-shortcut-web-openwait` case calls the public
  `steamOverlay.openShortcutTargetAndWait()` helper against the configured modal
  web shortcut target instead of using Shift+Tab. It verified
  `overlay:shortcut-open`, visible Steam web content before close input,
  active/inactive callbacks, `openAndWait` completion after close and presenter
  parking, app-frontmost return, zero managed timing, one Metal presenter-backed
  overlay target, clean control-server quit, no leftover smoke/gameoverlay
  process, and no fresh macOS crash report.
- A focused follow-up proof at
  `/tmp/steam-bridge-macos-shortcut-openwait-focused-20260630-102739`
  re-ran the public helper after correcting the diagnostic source label. The
  lifecycle now records `overlay:shortcut-open` with
  `shortcut: "openShortcutTargetAndWait"` and `target: "web"`, then records
  active/inactive callbacks, `overlay:presenter-open-and-wait-complete` after
  the harness closes the web overlay, a persistent Metal presenter parked at
  zero FPS, and no fresh crash report.
- A later locked/asleep unavailable macOS matrix at
  `/tmp/steam-bridge-macos-overlay-matrix-unavailable-needs-present-20260630-120650`
  rebuilt the native addon and signed Electron `43.0.0` smoke package after the
  JavaScript needs-present guard landed, reused the stable Steam shortcut
  without restarting Steam, and passed the three fail-fast unavailable cases:
  web open/wait, checkout open, and checkout prepare-only. Each case reported
  `overlayNeedsPresent=false`, `overlayNeedsPresentPollingEnabled=false`,
  `nativeHostUnavailable=macos-screen-locked`, no Steam overlay activation, zero
  `gameoverlayui` targets, zero managed overlay timing, and no fresh
  `SteamBridgeSmoke` or attributed `MTLCompilerService` crash reports.
- A rebuilt locked/asleep unavailable macOS matrix at
  `/tmp/steam-bridge-macos-overlay-matrix-unavailable-passive-toast-final-20260630-123114`
  repackaged the Electron `43.0.0` smoke app so the packaged helper contained
  the passive-unavailable verifier changes, reused the stable Steam shortcut
  without restarting Steam, and passed four unavailable cases. The added passive
  achievement-progress case received `callback:achievement-stored` while the
  presenter stayed hidden, unattached, host-closed, click-through,
  non-focusable, transparent, zero-FPS, `overlayActive=false`,
  `nativeHostUnavailable=macos-screen-locked`, and produced no modal activation,
  `gameoverlayui` target, `SteamBridgeSmoke` crash report, or attributed
  `MTLCompilerService` crash report.
- A fresh locked/asleep unavailable macOS matrix at
  `/tmp/steam-bridge-macos-overlay-matrix-unavailable-preflight-current-20260630-130448`
  rebuilt and signed the Electron `43.0.0` smoke package after adding the cheap
  readiness preflight mode, reused the stable Steam shortcut without restarting
  Steam, and re-passed the four unavailable cases. The summary again proved no
  modal activation, zero overlay targets, zero managed overlay timing,
  `overlayNeedsPresent=false`, `overlayNeedsPresentPollingEnabled=false`,
  `nativeHostUnavailable=macos-screen-locked`, no leftover smoke or overlay
  process, and no fresh `SteamBridgeSmoke` or attributed `MTLCompilerService`
  crash reports.
- A follow-up locked/asleep unavailable macOS matrix at
  `/tmp/steam-bridge-macos-overlay-matrix-unavailable-shortcut-openwait-20260630-131816`
  rebuilt and signed the same Electron `43.0.0` package, reused the stable Steam
  shortcut without restarting Steam, and passed five unavailable cases. The new
  `presenter-shortcut-open-and-wait` case proves the public programmatic
  shortcut/toggle helper records its managed wait start and configured web
  shortcut target, then fails fast with
  `STEAM_OVERLAY_NATIVE_HOST_UNAVAILABLE` while the screen is locked, without
  emitting `overlay:shortcut-open`, attaching a native host, creating a
  `gameoverlayui` target, activating Steam overlay UI, or producing a fresh
  `SteamBridgeSmoke` or attributed `MTLCompilerService` crash report.
- A current-head locked/asleep unavailable macOS matrix at
  `/tmp/steam-bridge-macos-overlay-matrix-20260630-223644` rebuilt and signed
  the Apple Silicon Electron `43.0.0` smoke package, reused the stable Steam
  shortcut without restarting Steam, and passed six unavailable cases. The
  suite now includes readiness preflight plus managed web open/wait,
  checkout-open, checkout prepare-only, programmatic shortcut open/wait, and
  passive achievement-progress. The summary verified `available=false`,
  `STEAM_OVERLAY_NATIVE_HOST_UNAVAILABLE`, reason `macos-screen-locked`,
  `screenLocked=true`, `displayAsleep=true`, `nativeHostOpen=false`, no modal
  activation, zero `gameoverlayui` targets, disabled needs-present polling,
  zero managed overlay timing, and clean crash diagnostics.
- A follow-up interactive minimal macOS matrix at
  `/tmp/steam-bridge-macos-overlay-matrix-20260630-224312` reused that signed
  package and stable shortcut without repackaging or restarting Steam after the
  Mac became interactive again. It passed readiness, web/store/Friends/dialog
  `openAndWait(...)`, and passive achievement-progress cases with
  `screenLocked=false`, `displayAsleep=false`, one Metal presenter-backed
  overlay target for active/passive overlay cases, visible Steam web content
  before close probes, active/inactive callbacks for modal routes, app focus
  return, parked zero-FPS presenter state, disabled needs-present polling, zero
  managed overlay timing, and clean crash diagnostics.
- A current-head persistent macOS matrix at
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
- A 2026-06-30 13:32 PDT crash-report sweep after another user-visible Ignore
  dialog found no newer `SteamBridgeSmoke`, `gameoverlayui`, `Steam Helper`, or
  attributed `MTLCompilerService` DiagnosticReport than the known
  `MTLCompilerService-2026-06-30-084244.ips` report.
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
  entitlement template in `packages/steam-bridge/templates/entitlements.steam.macos.plist`:
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

A 2026-06-30 focused checkout run at
`/tmp/steam-bridge-macos-overlay-matrix-checkout-target-snapshot-20260630-232458`
rebuilt and signed the Apple Silicon Electron `43.0.0` smoke package, reused
the stable Steam shortcut without restarting Steam, and passed checkout
prepare-only, direct synthetic approval-route checkout, managed Shift+Tab
checkout, and programmatic checkout shortcut `openAndWait(...)`. The macOS
summary auditor now requires checkout completion to include the sanitized
`targetSnapshot` diagnostic, and the live artifact kept transaction evidence to
presence flags without raw synthetic transaction IDs or checkout approval URLs
in matrix metadata or lifecycle logs. It also verified one Metal
presenter-backed overlay target, visible Steam web content before close,
active/inactive callbacks for checkout UI, app focus return, parked zero-FPS
state, zero managed overlay timing, clean crash diagnostics, and no leftover
smoke or `gameoverlayui` process.

A 2026-06-30 focused minimal macOS run at
`/tmp/steam-bridge-macos-overlay-matrix-ready-minimal-20260630-163718`
added the managed `presenter-ready` preflight to the live matrix. It verified
Steam launch, overlay injection, native host availability, zero managed overlay
timing, idle transparent presenter state, and no overlay-active callback before
running the web, store, Friends, dialog-equivalent, and passive-toast cases.
That preflight can report `overlayEnabled=false` while Steam still has one
dormant `gameoverlayui` target attached to the smoke process; the activation
callback stream remains the proof of whether visible Steam overlay UI opened.
A follow-up 2026-06-30 full macOS matrix at
`/tmp/steam-bridge-macos-overlay-matrix-full-ready-current-20260630-164539`
passed all 44 Steam-launched App ID `480` cases with the readiness preflight in
the same run as web/store/Friends/dialog wait routes, passive progress/unlock
toasts, synthetic checkout approval, checkout prepare-only readiness, every
managed Shift+Tab shortcut target, every direct presenter-backed community/user
route, and every programmatic shortcut open-and-wait target. The run reused the
signed Electron `43.0.0` package and stable shortcut without repackaging or
restarting Steam, audited one Metal presenter-backed overlay target per case,
zero managed overlay timing, close/back-to-app proof, parked zero-FPS presenter
state, no leftover smoke/gameoverlay process, and no copied macOS crash reports.
A follow-up persistent one-process macOS matrix at
`/tmp/steam-bridge-macos-overlay-matrix-persistent-ready-retry-current-20260630-170648`
reused the same signed Electron `43.0.0` package and stable shortcut without
repackaging or restarting Steam, launched one Steam-owned App ID `480` smoke
process, drove all 44 cases through the localhost control server, and passed the
summary audit. The run covers the readiness preflight, active web/store/Friends,
dialog-equivalent, user, community, stats, achievements, checkout approval,
checkout prepare-only, every managed Shift+Tab shortcut target, and every
programmatic shortcut open-and-wait target with one Metal presenter-backed
overlay target, callback-driven close/back-to-app proof, zero managed overlay
timing, parked zero-FPS presenter state, no leftover smoke/gameoverlay process,
and no copied macOS crash reports. The persistent matrix can now retry one
crash-free post-action overlay activation timeout by relaunching the whole
one-process suite; a repeated miss still fails.
A fresh 2026-06-30 minimal macOS matrix at
`/tmp/steam-bridge-macos-overlay-matrix-20260630-174351` rebuilt and signed the
Electron `43.0.0` package after the public `InitTxn` session helpers landed,
verified the signing shape, reused the stable Steam shortcut without restarting
Steam, and passed the readiness, web, store, Friends, dialog-equivalent, and
passive achievement-progress cases. The run again proved one Metal
presenter-backed overlay target for active/passive overlay cases, visible Steam
web content before close probes, active/inactive callbacks and app-frontmost
return for modal routes, parked zero-FPS state, zero managed overlay timing,
`overlayNeedsPresentPollingEnabled=false`, and no fresh `SteamBridgeSmoke`,
`gameoverlayui`, `Steam Helper`, or attributed `MTLCompilerService` crash
report beyond the older known `MTLCompilerService-2026-06-30-084244.ips`.
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
proved the stable launcher env handoff still works for readiness after
repackaging Electron `43.0.0`, then failed the first active web overlay on the
same fresh Steam IPC/resource errors. The helper now fails fast if the stable
Steam shortcut points at a stale launcher env file instead of the result/control
paths for the current invocation, which prevents direct one-off helper runs
from silently launching an old persistent-suite configuration. A later local
Steam restart entered a client update state and stopped dispatching
`steam://rungameid/<shortcut>` before any smoke process was tracked; the matrix
now skips the running-list removal wait when no smoke gameprocess log entry was
created, so Steam URL-dispatch failures report as launch failures instead of
cleanup timeouts. A later 2026-06-30 rerun at
`/tmp/steam-bridge-macos-overlay-matrix-rerun-diagnostics-20260630-192307`
confirmed the launch boundary more clearly: Steam refused repeated
`steam://rungameid/<shortcut>` dispatches with `rungameid : not allowed yet`
while `webhelper.txt` simultaneously reported
`SteamChrome_MasterStream_*` `errno: 28` failures. The matrix now writes
`steam-client-launch-diagnostics.txt` from fresh log offsets when this happens
before any smoke result or gameprocess entry exists, so the artifact labels it
as a local Steam client/bootstrap failure rather than an Electron presenter
failure. The same detector is now exposed through
`npm run macos:steam-client-health`, which checks the currently running Steam
client without launching the smoke app or touching the shortcut; unhealthy
bootstrap states write `steam-client-health-diagnostics.txt` under the selected
artifact root. The live macOS matrix now runs that health gate before launching
smoke cases, waiting for it to pass after a matrix-owned Steam restart caused by
a shortcut update. The health artifact includes a local resource snapshot and
derived resource warnings so Steam client failures can be separated from overlay
regressions without a manual `lsof`/`df` pass. A 2026-06-30 health run at
`/tmp/steam-bridge-macos-steam-health-resource-snapshot-20260630-195055`
showed the current local blocker: Steam was still launching its bootstrap
helper with `-steamid=0` and emitting fresh `SteamChrome_MasterStream_*`
`errno: 28` failures every 10 seconds, with zero stale SteamChrome temp entries
left in `/private/tmp`, the Steam process at 214 open files, 84 POSIX
semaphore handles, 15 POSIX shared-memory handles, and `launchctl maxfiles`
reporting a soft limit of 256. Follow-up health checks now call out that
near-soft-limit file usage explicitly. This is still a local Steam
client/bootstrap state, not an Electron presenter result. Further live macOS
overlay proof should wait for Steam to recover, log on, and handle shortcut
launch URLs again; if the same health failure persists after fully quitting
Steam, log out or reboot macOS to clear the user-session IPC state.
- The macOS live matrix now ensures Steam itself is started and logged in before
  launching any smoke case when the stable shortcut is already up to date. A
  2026-06-30 rerun at
  `/tmp/steam-bridge-macos-overlay-matrix-startup-gate-fixed-20260630-204149`
  stopped before `CASE 00` because Steam timed out before logging in. The health
  artifact captured the running `steamid=0` helper, fresh
  `SteamChrome_MasterStream_*` `errno: 28` lines, the visible
  `/private/tmp/steam.pipe`, the orphan `ipcserver`, and fresh user-owned
  System V semaphore counts. This prevents the first smoke case from being used
  as the Steam bootstrap probe when the local client is already unhealthy.
  A follow-up clean retry at
  `/tmp/steam-bridge-macos-overlay-matrix-rerun-clean-20260630-204752`
  reproduced the same pre-case failure after clearing stale semaphores and
  `/private/tmp/steam.pipe`: Steam started as `steamid=0`, logged fresh
  `SteamChrome_MasterStream_*` `errno: 28` failures, and reached 213 open files
  under the local `launchctl maxfiles` soft limit of 256. The startup health
  path now distinguishes a normal standalone "Steam is closed" health pass from
  a failed matrix-owned startup where `steam_osx` was expected to stay running;
  those artifacts also call out orphan `ipcserver` state as Steam global IPC
  state that may require a user-session reset.
- The live matrix now performs conservative stale Steam IPC cleanup before a
  matrix-owned Steam startup when no `steam_osx` client is running. It stops an
  orphan Steam `ipcserver` and removes `/private/tmp/steam.pipe` so stale global
  endpoints are not carried into the next launch. `--close-steam-after` arms
  the same bounded cleanup for failed startup attempts and normal matrix
  shutdown. Steam's launch services may still recreate `steam_osx` or
  `ipcserver` later after the command returns; health artifacts still report
  those processes if they are present. The matrix does not remove all user-owned
  System V semaphores automatically, because those handles are not provably
  Steam-only; the health artifact keeps reporting them as diagnostic evidence.
- After the local Steam client finished updating and logged back in, a fresh
  2026-06-30 core Apple Silicon matrix at
  `/tmp/steam-bridge-macos-overlay-matrix-20260630-215349` passed all 26
  Steam-launched App ID `480` cases. The run recreated the missing stable
  shortcut under userdata `1686541554`, reused the signed arm64 smoke package,
  and re-verified readiness, modal web/store/Friends/dialog routes, passive
  progress/unlock toasts, checkout approval and prepare-only routes, every
  managed Shift+Tab shortcut target, and direct profile/players/community/stats/
  achievements/user chat `openAndWait(...)` routes. The health detector now
  treats `-steamid=0` webhelpers as healthy only when `connection_log.txt`
  proves the latest state is `Logged On` and no current SteamChrome IPC failure
  is present; running Steam with a latest `Logged Off` or connecting state fails
  the live matrix health gate before smoke launch.
- A follow-up 2026-06-30 full Apple Silicon matrix at
  `/tmp/steam-bridge-macos-overlay-matrix-20260630-220434` passed all 44
  process-per-case App ID `480` cases on the recovered Steam client. This
  extended the recovery proof to every high-level dialog-equivalent route and
  every programmatic shortcut `openAndWait(...)` target, with one Metal
  presenter-backed overlay target, visible web content before close, close/back
  to the app, parked zero-FPS presenter state, zero managed overlay timing, and
  clean crash diagnostics.
- A fresh 2026-07-01 full Apple Silicon matrix at
  `/tmp/steam-bridge-macos-overlay-matrix-full-web-visible-fixed-20260701-015118`
  rebuilt and signed the arm64 Electron `43.0.0` package, reused the stable
  shortcut without restarting Steam, and passed all 44 process-per-case App ID
  `480` cases. This run followed a helper instrumentation fix: the macOS helper
  now writes `overlay:web-visible` payloads through a base64-backed lifecycle
  event path instead of hand-built shell JSON, and the helper self-test verifies
  both successful and failed visibility payloads do not degrade to
  `parseError`. The summary reported `webVisible=true` for all 29 web-close
  cases, alongside the same one Metal presenter-backed overlay target,
  active/inactive callbacks, close/back-to-app proof, parked zero-FPS state,
  zero managed overlay timing, and clean crash diagnostics.
- A current-head 2026-07-01 persistent Apple Silicon matrix at
  `/tmp/steam-bridge-macos-overlay-matrix-20260701-033432` rebuilt and signed
  the arm64-only Electron `43.0.0` package, launched one Steam-owned App ID
  `480` smoke process, drove all 45 persistent cases through the control server,
  and passed the summary audit. This run adds the expanded duplicate-open guard
  to the broad one-process proof while re-verifying passive progress/unlock
  toasts, checkout approval and prepare-only, every managed Shift+Tab shortcut
  target, all direct and programmatic shortcut `openAndWait(...)` routes,
  visible web content before close, close/back-to-app proof, parked zero-FPS
  state, zero managed overlay timing, clean quit, and clean crash diagnostics.
- A current-head 2026-07-01 core Apple Silicon matrix at
  `/tmp/steam-bridge-macos-overlay-matrix-core-shortcut-readiness-20260701-062656`
  rebuilt and signed the arm64-only Electron `43.0.0` package, reused the
  stable App ID `480` shortcut without restarting Steam, and passed all 27 core
  cases after shortcut readiness hardening. The run re-proved readiness,
  managed web/store/Friends/dialog `openAndWait(...)`, duplicate-open
  suppression, passive progress/unlock toasts, checkout approval and
  prepare-only, every managed Shift+Tab shortcut target, and direct
  profile/players/community/stats/achievements/user routes with one Metal
  presenter-backed overlay target, visible Steam web content where applicable,
  active/inactive callbacks, close/back-to-app proof, parked zero-FPS state,
  disabled needs-present polling, zero managed overlay timing, managed
  child-overlay isolation, and clean crash diagnostics.
- A focused current-head 2026-07-01 minimal Apple Silicon matrix at
  `/tmp/steam-bridge-macos-overlay-matrix-minimal-named-helpers-20260701-064718`
  rebuilt and signed the arm64-only Electron `43.0.0` package, reused the
  stable App ID `480` shortcut without restarting Steam, and passed all 7
  minimal cases after the smoke app switched common managed actions to the
  named builder helpers. The run exercised `openWebAndWait(...)`,
  `openStoreAndWait(...)`, `openFriendsAndWait(...)`, `openDialogAndWait(...)`,
  duplicate-open suppression through `openWebAndWaitIfAvailable(...)`, and
  passive notification priming with visible web content where applicable,
  active/inactive callbacks, close/back-to-app proof, parked zero-FPS state,
  disabled needs-present polling, zero managed overlay timing, managed
  child-overlay isolation, and clean crash diagnostics.

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
2. Log `client.utils.getOverlayDiagnostics()` during local testing. On macOS,
   `overlayNeedsPresentPollingEnabled=false` is the explicit proof that Steam
   Bridge avoided Steam's crash-prone `BOverlayNeedsPresent()` poll; do not rely
   on `overlayNeedsPresent=false` alone for that conclusion.
3. Use App ID `480` only for generic smoke tests; switch to your own App ID for
   app-specific achievements, stats, workshop, inventory, or economy flows.
4. For Electron overlay debugging, test both the BrowserWindow path and the
   native overlay probe surface.
5. If a macOS artifact contains `steam-overlay-ipc-diagnostics.txt`, recover
   the local Steam client/IPC state before rerunning live overlay proof. This is
   a Steam helper/resource state failure, not a useful signal about the native
   presenter path.
6. For purchase flows, treat the overlay as preferred UX rather than the only
   approval path. If `usersession=client` does not surface UI, use
   `usersession=web`, open the returned Steam URL, poll `QueryTxn`, and finalize
   only after approval.
7. When a managed overlay wait fails, log the sanitized target snapshot from
   `getSteamOverlayErrorTargetSnapshot(error)` or
   `getSteamOverlayCheckoutErrorTargetSnapshot(error)` rather than raw checkout
   targets. Checkout failure context records only presence flags for URLs,
   transaction IDs, return URLs, and Steam IDs.
