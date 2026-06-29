# macOS Steam Overlay Notes

Last updated: 2026-06-29

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
  `/tmp/steam-bridge-macos-overlay-matrix-full-current-20260629-160125`
  passed all 20 Steam-launched App ID `480` cases after that immediate-focus
  change, with zero managed overlay timing enforced and no Steam restart needed
  because the stable shortcut was already up to date. Coverage included
  web/store/Friends/dialog `openAndWait(...)`, passive progress and unlock
  notifications, synthetic checkout approval-route plumbing, managed Shift+Tab
  shortcut open/close, profile, community, stats, achievements, user chat and
  Steam ID panels, and known dialog variants. Interactive cases verified overlay
  activation/deactivation, close/focus return, parked idle presenter state, and
  no crash evidence. The artifact also passes
  `npm run macos:overlay-matrix:summarize -- --artifact-root <path>`, which
  audits each collected result and lifecycle log.
- `scripts/macos-overlay-matrix.sh` now owns repeatable macOS proof setup. It
  prints or runs a matrix of Steam-launched helper cases, installs or updates one
  stable Steam shortcut with the native launcher env-file flag, restarts Steam
  only when that shortcut is added or materially changed, and passes per-case
  launch state through the env file. It collects result and diagnostic logs,
  then runs `scripts/summarize-macos-overlay-matrix.cjs` to audit Steam
  launch/injection identity, one `gameoverlayui` target attached to the smoke
  process, zero managed overlay timing, passive notification callbacks,
  close-and-park lifecycle evidence, and crash diagnostics. Its self-test
  validates the matrix shape and the artifact summarizer without launching
  Steam.

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
- Real purchase UI and `InitTxn` proof still require a real Steam app ID with a
  configured product or transaction. App ID `480` remains suitable only for
  generic overlay smoke tests.

The current macOS result should therefore be treated as Steam launch, injection,
identity alignment, native presenter startup, modal web overlay activation,
close, app focus return, builder-facing `openAndWait(...)` parking coverage,
synthetic checkout approval-route plumbing, managed Shift+Tab shortcut routing,
known presenter-backed web/dialog targets, and passive achievement-progress and
unlock notifications. Real purchase-content and `InitTxn` coverage still need a
real Steam app ID with a configured product before describing purchase overlay
support as complete.

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
