# macOS Steam Overlay Notes

Date: 2026-06-24

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
  `steam://rungameid`, wait for the smoke result, and verify the result.

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
  window/layer state. A strict Steam-launched Metal `presenter-web` run verified
  the smoke snapshot moved to `mode=active`, `clickThrough=false`,
  `transparent=false`, and `currentFps=30` with no crash diagnostics. It still
  did not emit `GameOverlayActivated(true)`.
- A delayed diagnostic activation run, with the action fired after Steam had
  enough time to start `gameoverlayui`, also failed to emit
  `GameOverlayActivated(true)`. This weakens the theory that the macOS failure
  is only an early activation race.
- The smoke app now records macOS `gameoverlayui` process snapshots and
  CoreGraphics Steam/window snapshots in the result payload, instead of
  reporting overlay process diagnostics as Linux-only.
- Those macOS diagnostics show `gameoverlayui` attached to the smoke process,
  but with `-gameid` set to the full non-Steam shortcut game ID while Steamworks
  inside the process reports App ID `480`. On Deck/Linux the wrapper can set
  `SteamOverlayGameId=480`; on macOS the direct executable shortcut preserves
  `DYLD_INSERT_LIBRARIES` but inherits Steam's shortcut overlay game ID. This
  app-ID/overlay-game-ID mismatch is now the leading generic macOS smoke
  hypothesis to resolve or avoid with a real installed Steam app proof.

Still not verified:

- `client.utils.isOverlayEnabled()` remains `false` for the Electron
  `BrowserWindow`-only path even with the `compatibility` overlay profile. The
  native presenter is diagnostic evidence that a native graphics surface can
  be useful; it is not a completed product overlay path for Electron apps.
- Ad-hoc signing the packaged app with
  `com.apple.security.cs.allow-dyld-environment-variables` and
  `com.apple.security.cs.disable-library-validation` did not make
  `overlayEnabled` turn `true` for the BrowserWindow-only smoke run.
- A shell-wrapper shortcut can set `SteamAppId=480` before app startup, but macOS
  strips the Steam `DYLD_INSERT_LIBRARIES` injection before the Electron child
  process starts, so that path is not useful for overlay verification.
- The reusable macOS presenter path still has not emitted
  `GameOverlayActivated(true)` in the packaged Electron smoke app. Both Metal
  and OpenGL host backends can be launched and pumped without crashes, but the
  Steam web overlay does not become an active, verifier-proven overlay surface.

The current macOS result should therefore be treated as native probe diagnostic
coverage, Steam launch and injection coverage, and crash-free native presenter
startup coverage. It should not be described as completed Steam Bridge macOS
overlay support.

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
