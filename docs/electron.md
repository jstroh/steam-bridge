# Electron integration

[Documentation home](../README.md) · [Steam Input](steam-input.md) · [Packaging](packaging.md) · [Troubleshooting](troubleshooting.md)

Steam Bridge has two jobs in an Electron game: keep native Steam work in the
main process, and connect that work to a context-isolated game renderer.
Input integration and visible Steam-overlay presentation are separate. A
working controller does not prove the overlay is rendered correctly.

## Startup order

1. Call `configureSteamElectron()` before Electron becomes ready.
2. After readiness, start the single Steam application before creating game
   graphics devices/windows.
3. Install the renderer-input preload on the session the game will actually use,
   before creating/loading its renderer.
4. Create the platform-appropriate game window and any native input forwarder.
5. Create/start the action session, then connect it to the game `webContents`
   **before** `loadFile()` or `loadURL()`.
6. Load the trusted game page. Read input from its existing frame loop.

Minimal configuration and cleanup, before adding your window:

```ts
import { app, session } from "electron";
import { startSteam, type SteamApplication } from "steam-bridge";
import { configureSteamElectron } from "steam-bridge/electron";

const integration = configureSteamElectron();
let steam: SteamApplication | undefined;

app.whenReady().then(() => {
  steam = startSteam({ appId: 480 });
  integration.installRendererInput(session.defaultSession);
  // Create the game's platform window here, connect input, then load the page.
}).catch(() => {
  console.error("Steam startup failed.");
  app.quit();
});

app.once("before-quit", () => {
  try {
    integration.close();
  } finally {
    steam?.close();
  }
});
```

This excerpt does not create a window and assumes no outstanding native
operations at shutdown. A real game must first stop producers and await pending
work. If you use a custom session/partition, register its preload instead of
`session.defaultSession`.

The integration uses the modern session preload API where available and the
older session preload list otherwise. It preserves application-owned preloads.
Use its bundled sandbox-compatible preload rather than exposing `ipcRenderer`
or loading the native addon into a custom renderer preload.

## Choose the window model

| Platform | Supported game presentation | Application responsibilities |
| --- | --- | --- |
| Windows x64 | Standalone native D3D11 host with hidden offscreen Electron | Transfer each shared texture correctly; route native input/focus; synchronize physical size and refresh |
| Linux x64 / Steam Deck | Native X11/GLX application host | Use the packaged launcher, route native input, and qualify Desktop/Game Mode separately |
| macOS arm64 | Managed Metal child attached to the Electron window | Retain one attachment across window transitions; sign and notarize the package |

Use `steam.gameHost.createNativeWindow(options)` for a native host (with
`useLinuxApplicationHost: true` and no `nativeWindowHandle` for the Linux
application-host model) and
`steam.gameHost.attachElectronWindow(window, options)` for the managed macOS
attachment. These APIs own presentation resources, not your application's game
logic, menu policy, or render loop.

Windows attached child/popup presentation is unsupported. Direct Chromium
hooking, WGL, in-process GPU, and DirectComposition-off switches are diagnostic
comparisons, not production fallbacks. Do not choose one merely because a
startup toast appears.

The [advanced smoke runbook](../examples/electron-basic/README.md) covers native
host integration and qualification. It is deliberately not a cross-platform
drop-in game template: Windows release proof uses the real standalone-host
consumer. A short `BrowserWindow` example cannot replace that integration.

## Connect Steam actions to the renderer

The following main-process excerpt assumes `steam`, `integration`, and
`gameWindow` have been created, and the page has **not** loaded yet. Import the
generated action definition from your game:

```ts
import { ipcMain } from "electron";
import { steamInputDefinition } from "./generated/steam-input";

const actions = steam.steamInput.createSession({
  definition: steamInputDefinition
}).start();
actions.activateActionSet("gameplay");

const connection = integration.connectActionInput(
  actions,
  ipcMain,
  gameWindow.webContents,
  {
    isActive: () => gameIsActive(),
    isTrusted: (contents) => isTrustedGamePage(contents.getURL?.() ?? "")
  }
);

// Only now call your game's loadFile()/loadURL().
```

`gameIsActive()` and `isTrustedGamePage()` are application policy, not
Steam Bridge methods:

- For a visible Electron game window, focus can come from that window.
- For a hidden Windows/Linux offscreen renderer, use the **visible native host's**
  focus/minimize/overlay state. `gameWindow.isFocused()` is not authoritative.
- Reject empty URLs and accept only your intended game origin/path. Restrict
  navigation and new windows, and do not allow arbitrary web content onto a
  privileged game session.

The connection attaches on `did-finish-load` and reconnects after document
replacement. If you intentionally create it after a document is already loaded,
call `connection.reconnect()`. Close the connection when retiring that renderer.

Do not also call `actions.update()` in a timer. Renderer reads request the next
native frame; the connection owns polling and bounded delivery.
`connection.read()` is an explicit main-side poll, not a cached renderer read.

## Read cached action frames correctly

Bundle this code into the game renderer. Here `applyMoveIntent` and
`performJump` stand for your game's functions. The sample manifest declares
`move` and `jump`:

```ts
import { getRendererInput } from "steam-bridge/renderer";

const input = getRendererInput();
let lastActionSequence: string | undefined;
let needsFreshFrame = true;

function updateGame(): void {
  if (!gameIsActive()) {
    needsFreshFrame = true;
    applyMoveIntent(0, 0);
    return;
  }
  const sample = input?.gamepads.read();
  const actions = sample?.steamActions;

  if (!actions) {
    needsFreshFrame = true;
    applyMoveIntent(0, 0);
    return;
  }
  if (needsFreshFrame) {
    lastActionSequence = actions.sequence;
    needsFreshFrame = false;
    applyMoveIntent(0, 0);
    return;
  }
  if (actions.sequence === lastActionSequence) return;
  lastActionSequence = actions.sequence;

  const controller = actions.primaryController;
  const move = controller?.analog.move;
  applyMoveIntent(move?.active ? move.x : 0, move?.active ? move.y : 0);
  if (controller?.digital.jump?.pressedThisFrame) performJump();
}
```

Use the game loop you already have. `gamepads.read()` returns the newest cached
action frame and requests another asynchronously. Several renderer reads can
therefore see the same action `sequence`. This example updates persistent
movement intent only on new action frames; the game's simulation still advances
every game frame. Missing/inactive input neutralizes intent. On startup or focus
return, the first cached sequence is treated as a baseline and gameplay waits
for a newer frame, rather than replaying a pre-blur press.
The outer renderer sample's sequence is not a substitute.

Here the renderer's `gameIsActive()` reads application state conveyed from the
visible host over your trusted boundary. The service's `isActive` check stops
new native polls; it does not by itself erase a previously delivered renderer
cache. A hidden offscreen document can still report DOM focus while its native
host is inactive. Gate gameplay as well as polling.

Use `input.read()` if you also need keyboard, pointer, wheel, text/composition,
and ordered DOM input edges. Pick one read path per game update. Neither path
creates a second animation-frame scheduler. Without the installed preload,
`getRendererInput()` returns `null`; it does not install Steam support into a
normal browser page.

## Native input and focus

`integration.connectNativeInput(webContents, options)` returns a forwarder:

- Pass host events to `handle(event)`.
- Call `setActive(false)` on inactive/minimized/overlay-owned transitions and
  reactivate it when the game owns input again.
- Call `close()` when the host/renderer connection ends.

Supply the current renderer content size in DIPs through `getContentSize()`.
The forwarder combines it with native events' physical client dimensions for
centered aspect-fit mapping. Keep that geometry consistent with presentation;
a custom destination rectangle needs matching application input policy. The
forwarder handles key/modifier translation, numpad identity, aspect-fit pointer
mapping, capture continuity, and release cleanup. Menu actions and
fullscreen/overlay shortcuts remain explicit application callbacks.

Keep logical coordinates, physical backing pixels, and DPI conversions distinct.
Render and input must use the same aspect-fit rectangle. Do not fix an input
offset by changing camera zoom or drawing a differently sized game surface.
Preserve the application's custom cursor policy.

## Windows texture ownership

Electron's paint event contains a pooled producer texture. Steam Bridge needs a
descriptor of that texture, not ownership of the entire Electron object:

| Bridge descriptor field | Meaning |
| --- | --- |
| `handle` | This event's Windows NT shared handle, as a `Buffer` |
| `width`, `height` | The texture's coded pixel dimensions |
| `pixelFormat` | Its actual supported pixel format |
| `contentRect` | Updated/dirty region populated by this texture update, if supplied |
| `presentationRect` | Source region within the coded texture to present; defaults to the full coded texture |

Both rectangles use coded-texture coordinates; neither is a destination-window
rectangle. Copy the descriptor from the actual event and your source-region
policy. Do not substitute
CSS window dimensions for coded texture dimensions. Do not cache a pooled
handle and use it for later paint events.

Prefer `host.updateSharedTextureAsync(descriptor)`. The producer associated
with **that exact event** must stay alive until the result establishes release
safety:

| Result | What it means | What to do with that producer |
| --- | --- | --- |
| Resolves `true` | Accepted copy completed safely | Release it once |
| Resolves `false` | Rejected before submission, such as bounded backpressure | Release it once; keep the previous displayed frame, do not retry this handle |
| Typed rejection with `producerReleaseSafe: true` | Failure proven release-safe | Release it once; handle the error |
| Typed rejection with `producerReleaseSafe: false` | Native use may still be in flight | Quarantine without release and terminate/relaunch |
| Unknown/unclassified error | No proven release boundary | Fail closed; do not assume it is safe |

`NativeOverlaySharedTextureCopyError` is exported from
`steam-bridge/steamworks`. Never write an unconditional
`promise.finally(() => texture.release())`: a rejection can be release-unsafe.

For `producerReleaseSafe: false`, retain the exact producer without
`texture.release()` for the remainder of the application process. Closing the
native host/session or reconstructing a graphics device in the same process is
not a proven release boundary. Stop accepting new frames and terminate/relaunch
the application. Do not enlarge timeouts or recycle the producer to hide this
failure. The synchronous compatibility call `updateSharedTexture()` has the
same unsafe-error rule.

This is exceptional error recovery, not the normal shutdown procedure.
Ordinary shutdown stops new submissions, awaits outstanding work, and closes
resources. A promise rejection marked unsafe overrides that ordinary path.

## Sizing, pacing and lifecycle

Use the active display's refresh rate consistently for both Electron's
`webContents.setFrameRate()` and the native session's `setFrameRate()`.
Update them when the host changes display or refresh mode. Keep the native host
and renderer size synchronized without conflating CSS and physical pixels.

`continuousPresent: true` is useful when capture/streaming requires repeated
presentation of retained content even without new Electron damage. It defaults
to `false`. It is not an FPS repair switch and must not add another application
present loop.

On macOS, keep the same managed Metal child through resize, fullscreen,
minimize/restore, and focus changes. On every platform, close input connections
before their renderer, dispose action sessions, close the Electron integration,
and finally close the Steam application after outstanding operations finish.

Before shipping, follow [packaging and live checks](packaging.md). Interpret
renderer cadence and native presentation as separate measurements using the
[diagnostics guide](troubleshooting.md#collect-useful-diagnostics).
