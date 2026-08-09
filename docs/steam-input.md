# Steam Input for game developers

Steam Bridge exposes two Steam Input layers:

- `client.input.createSession(...)` is the recommended game-facing API. It owns
  the Steam Input lifecycle, resolves manifest names, polls every declared
  action in one native call, computes digital edges, tracks controllers, and
  serves prompts and output helpers.
- The remaining `client.input` methods and `Controller` class mirror Valve's
  lower-level API. Use them only when the session does not expose a Steamworks
  feature you need.

The raw `input.registerActionEventCallback()` path multiplexes JavaScript
subscribers over Valve's single callback and uses a bounded native queue. It is
best-effort under a stalled event loop; use session frame polling as the
authoritative gameplay path so a dropped advisory event cannot stick an action.

Keep Steam Input in the process that initialized Steamworks. For Electron that
means the main process. Do not initialize Steamworks again in a renderer.

## 1. Build and validate the action manifest

Use Valve's action-manifest format and bundle official controller layouts in
the same depot. Steam Bridge validates KeyValues syntax, the exact Valve action
shapes, categories, input modes, and controller-type names, action/set/layer
name collisions, canonical configuration priorities, action limits, required
`#` titles, English localization fallbacks, parent-set links, and referenced
`controller_mappings` layout files. Valve's documented `os_mouse` metadata and
localized button/native mouse-event form are accepted. Windows path separators
are preserved in the parsed manifest and resolve correctly on every host OS.
Generation refuses to overwrite the source manifest and replaces an existing
output atomically, so an interrupted write cannot leave a half-generated
definition.

```sh
npx steam-bridge-input validate ./input/steam_input_manifest.vdf
npx steam-bridge-input generate ./input/steam_input_manifest.vdf \
  --out ./src/generated/steam-input.ts
```

Commit the generated TypeScript and make CI reject stale output:

```sh
npx steam-bridge-input generate ./input/steam_input_manifest.vdf \
  --out ./src/generated/steam-input.ts --check
```

The generated file exports `steamInputDefinition` through
`defineSteamInput(...)`. Its developer keys are inferred as string literals,
so misspelled actions fail TypeScript instead of becoming zero handles at
runtime.

The bundled `SteamInput006` SDK permits 256 unique digital actions and 24
unique analog actions. (Valve's older `SteamInput001` web reference still
shows 128/16.) Keep a dedicated menu action set, give every referenced title an
English fallback, and select **Any Future Devices** in the Steamworks Steam
Input settings. See Valve's [getting-started guide](https://partner.steamgames.com/doc/features/steam_controller/getting_started_for_devs)
and [action-manifest guide](https://partner.steamgames.com/doc/features/steam_controller/action_manifest_file).

## 2. Start one session

```ts
import path from "node:path";
import steamworks from "steam-bridge";
import { steamInputDefinition } from "./generated/steam-input";

const client = steamworks.init(MY_APP_ID);

const steamInput = client.input.createSession({
  definition: steamInputDefinition,
  controllers: "individual",
  // Primary-controller/prompt selection only. Gameplay values are untouched.
  activeControllerAnalogThreshold: 0.1,
  // Development override only. Use an absolute path. Omit this in a deployed
  // Steam build so Steam uses the manifest configured for the depot.
  manifestPath: process.env.STEAM_INPUT_MANIFEST
    ? path.resolve(process.env.STEAM_INPUT_MANIFEST)
    : null
}).start();

steamInput.activateActionSet("gameplay");
```

Only one `SteamInputSession` may be active in a process. It initializes Valve
in explicit-frame mode and owns the matching `RunFrame` calls made by
`update()`. The raw `input.init()` default remains Valve's automatic mode for
backward compatibility. Do not mix that default with a session: Steam Bridge
rejects automatic/explicit ownership mismatches instead of allowing an
accidental double or missing frame advance. A low-level caller that deliberately
shares the session's explicit-frame contract may use `input.init(true)` and must
release its matching reference with `input.shutdown()`. `dispose()` releases
only the session's own reference.

An explicit `manifestPath` is a Steam-session-wide development override, not a
per-window setting. The path must exist and be absolute. A normal Steam launch
should use the action manifest configured in Steamworks and omit it.

## 3. Poll once per game frame

```ts
function updateGame(): void {
  const frame = steamInput.update();
  const controller = frame.primaryController;

  if (controller?.digital.jump.pressedThisFrame) player.jump();
  if (controller?.digital.pause.pressedThisFrame) openPauseMenu();

  const move = controller?.analog.move;
  if (move?.active) player.setMoveIntent(move.x, move.y);
}
```

`update()` calls Valve's `RunFrame(true)`, enumerates controllers once, and
reads every resolved digital and analog action in one native crossing. While a
session is active, Steam Bridge rejects raw `input.runFrame()` and
`input.getControllers()` calls because both advance Valve's frame state; use
the session snapshot as the single frame owner.

`capturedAtNs` is sampled from Node's monotonic `process.hrtime` clock as soon
as the native batch returns; `receivedAtNs` uses that same clock after the
public frame is assembled. Their difference is therefore meaningful and
measures bridge normalization/delivery time. The absolute values have an
arbitrary process-local origin and are not wall-clock or controller-hardware
timestamps.

Digital state has four fields:

- `active`: the action is available in the current Steam Input configuration;
- `isDown`: the action is active and currently held;
- `pressedThisFrame`: a sampled up-to-down transition;
- `releasedThisFrame`: a sampled down-to-up transition.

The first sample of a controller/action never invents a press or release. This
also applies when a zero handle resolves later or a controller reconnects. A
press and release that both occur between two game polls cannot be reconstructed;
poll at the cadence at which the game consumes input.

`controllers` controls aggregation:

- `"individual"` (default) returns physical controllers and no merged sample;
- `"merged"` returns only `mergedController`, sampled with Valve's
  all-controllers handle;
- `"both"` returns both views from one batch.

When no physical Steam Input controller is connected, the merged view and
`primaryController` are `null`; an all-controllers sentinel is never reported
as a device. When devices exist, the merged view carries the active physical
primary controller's type, gamepad slot, action-set/layer, Remote Play, and
binding-revision metadata. Returned frames are isolated snapshots: changing a
consumer-owned object cannot corrupt edge detection, prompt results, events, or
the next frame.

Each controller also exposes both `inputType` and `inputTypeCode`. The friendly
name becomes `"Unknown"` when a newer Steam client reports a controller that
the bundled SDK does not name yet, while the raw numeric `ESteamInputType` value
is preserved in `inputTypeCode`. Low-level `Controller` objects provide the
same distinction through `getType()` and `getTypeCode()`.

For local multiplayer, consume `frame.controllers` and assign stable controller
handles to player seats. For a single-player game, use `primaryController`. It
starts with the first controller and moves on a digital press or intentional
analog motion. The default `activeControllerAnalogThreshold` is `0.1`, which
prevents ordinary stick drift or a return-to-neutral edge from stealing the
primary device and changing UI glyphs. Configure a finite value greater than
zero and at most one when the game's action scale needs a different selection
threshold. This heuristic never clamps, rescales, or filters the analog action
values read by the game.

Steam Input does not replace keyboard, mouse, touch, or accessibility input.
Valve recommends accepting mixed input instead of disabling one input family
when another becomes active.

## Action sets and layers

```ts
steamInput.activateActionSet("menu");
steamInput.activateActionSet("gameplay", controller);
steamInput.activateActionLayer("inventory", controller);
steamInput.deactivateActionLayer("inventory", controller);
steamInput.deactivateAllActionLayers(controller);
```

Omitting a controller applies set/layer operations to Valve's
all-controllers handle. Pass a frame controller or its `bigint` handle for
split-screen behavior. Activate the set that matches the game's current
context; do not make a named state read silently mutate it. The old
`getDigitalActionStateByName(controller, set, action)` helper remains for
compatibility but is deprecated because it activates the set as a side effect.

Action handles can legitimately remain zero while Steam is still loading a
configuration. `activateActionSet()` queues an unresolved named set per target
controller, emits `STEAM_INPUT_ACTION_SET_QUEUED`, and applies the newest
selection after resolution. The selected set remains authoritative and is
reapplied before later polls and after device/configuration callbacks, matching
Valve's recommendation to keep the current game-state set active and ensuring
hot-plugged controllers do not start in the wrong set. Selecting a new set for
all controllers clears stale per-controller overrides; later per-controller
selections override that shared default.

`activateActionLayer()` likewise queues unresolved layers. Calling
`deactivateActionLayer()` cancels that named queued activation, while
`deactivateAllActionLayers()` cancels every queued layer for the target before
forwarding the native reset. Disconnect and disposal clear pending work. Unlike
base action sets, layers are not replayed every frame: Valve documents that
layer order changes behavior and recommends applying/removing them only on
specific game-state transitions.

## Controller prompts and rebinding

```ts
const prompt = steamInput.getDigitalPrompt("jump");
if (prompt) {
  prompt.glyphs.forEach(({ label, pngPath, svgPath }) => {
    console.log(label, pngPath, svgPath);
  });
}

if (!steamInput.showBindingPanel()) {
  // No concrete controller, overlay unavailable, or Steam rejected the panel.
}
```

Prompts use the controller's current action set unless `actionSet` is passed.
They include every bound origin, Valve's localized action/origin labels, and
Steam-client PNG/SVG glyph paths. Every prompt request re-queries its origins,
matching Valve's guidance for live rebinding instead of depending on a
configuration callback or revision value arriving first. Keep a keyboard/mouse
fallback in UI when no Steam prompt is available. Prompt results are returned
as isolated copies, so UI code cannot mutate later results.

`showBindingPanel()` opens Steam's controller configurator for a concrete
controller. It returns `false` and emits a diagnostic if Steam cannot open it;
common causes are no controller, a disabled/unavailable overlay, or an
unpublished Steam Input configuration.

## Output helpers

```ts
steamInput.vibrate(0.35, 0.8, controller); // normalized 0..1
steamInput.setLedColor(20, 100, 255, controller); // integer RGB 0..255
steamInput.restoreLedColor(controller);
```

Output always requires a concrete connected controller. Passing a merged frame
controller or Valve's all-controllers handle targets the current physical
primary controller; with no physical device the helper returns `false` and
emits a diagnostic instead of forwarding the sentinel to a concrete-device
API. Invalid ranges throw before reaching native code. Use the lower-level
`Controller` methods for extended vibration, DualSense trigger effects, motion,
or specialized haptics.

## Controller text entry

Full-controller games should open Steam's text-entry UI automatically when a
controller focuses a field instead of requiring the player to reach for a
keyboard. The one-shot helper resolves to the submitted text, or `null` when
the player cancels:

```ts
const name = await client.utils.showGamepadTextInput(
  client.utils.GamepadTextInputMode.Normal,
  client.utils.GamepadTextInputLineMode.SingleLine,
  "Character name",
  32,
  currentName
);
```

For an already focused on-screen field, use
`showFloatingGamepadTextInput(mode, x, y, width, height)` with the field's
Steam-facing rectangle and listen for
`onFloatingGamepadTextInputDismissed(...)`; call
`dismissFloatingGamepadTextInput()` if the field or window closes first. These
helpers complement ordinary keyboard/mouse text input rather than replacing
it. Keep the client alive until the returned Promise settles.

## Events and diagnostics

```ts
const changed = steamInput.on("active-controller-changed", console.log);
const warning = steamInput.on("diagnostic", ({ code, message }) => {
  console.warn(code, message);
});

console.table(steamInput.getDiagnostics());

changed.disconnect();
warning.disconnect();
```

Session events are `controller-connected`, `controller-disconnected`,
`active-controller-changed`, `configuration-loaded`, `gamepad-slot-changed`,
and `diagnostic`. Diagnostics report lifecycle state, manifest override,
controller mode/count, primary-selection threshold, primary handle, last
sequence, and every unresolved manifest name. Zero handles are retried after
updates and Steam device or configuration callbacks rather than being treated
as permanent failures.
When a controller disappears while an action is held, the disconnect event's
`releasedController` contains a final zeroed snapshot and exactly one release
edge for each held action. Use it to clear per-player state immediately.
Each listener receives its own event snapshot. A listener mutation cannot
change another listener's value, and both synchronous throws and asynchronous
rejections are contained and reported as process warnings.
Listeners are invoked synchronously when an event is emitted. Frame-derived
events run inside their owning `session.update()`; calling `session.update()`
recursively from one of those listeners throws before another native poll can
occur. Calling `dispose()` from a frame-derived listener is supported: disposal
is marked immediately and native teardown is deferred until the current update
unwinds, so a successful update commits its frame before teardown. Native
device/configuration callbacks can emit between session updates as the ordinary
Steam callback pump runs.

## Electron: bounded main-to-renderer delivery

When gameplay runs in a context-isolated renderer, transfer a private
`MessagePort` after the page is ready. The transport allows one frame in
flight; while the renderer is behind it replaces old pending frames with the
newest one. Navigation, renderer failure, `webContents` destruction, or either
`MessagePort` endpoint closing closes the transport and removes every listener.
Published sequences must be canonical unsigned integers and strictly increase;
the renderer acknowledges only validated protocol-versioned frames. A
synchronous listener is acknowledged after it returns; an asynchronous
listener keeps the one-frame backpressure active until its Promise settles.
Rejection is warned and then acknowledged so one bad consumer cannot deadlock
the stream. Keep the listener lightweight, and move durable work out of the
frame path. Listener, port-start, send, and acknowledgement failures are
contained and close the affected transport instead of escaping an Electron
callback.
Subframe and same-document navigations retain the live port because they do not
replace the renderer document; a new main-frame document, renderer failure, or
`webContents` destruction closes it.

Main process:

```ts
import { BrowserWindow } from "electron";
import { createElectronSteamInputTransport } from "steam-bridge/electron";

const transport = createElectronSteamInputTransport(
  steamInput,
  gameWindow.webContents
);

// Call from the same scheduler that advances the game/presentation frame.
function updateGame(): void {
  transport.update();
}
```

Preload:

```ts
import { contextBridge, ipcRenderer } from "electron";
import { subscribeElectronSteamInput } from "steam-bridge/electron";

const listeners = new Set<(frame: unknown) => void>();
const subscription = subscribeElectronSteamInput(ipcRenderer, (frame) => {
  for (const listener of listeners) listener(frame);
});

contextBridge.exposeInMainWorld("steamInput", {
  onFrame(listener: (frame: unknown) => void) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  close() {
    subscription.close();
    listeners.clear();
  }
});
```

Give the preload API an application-specific frame type and validate arguments
before exposing any method that mutates main-process state. Never expose
`ipcRenderer` itself.

IPC frames are JSON-safe: all native `bigint` fields are decimal strings. Do
not convert 64-bit handles to JavaScript `number`; keep them as strings in the
renderer or reconstruct them with `BigInt`.

If the game loop already calls `steamInput.update()`, call
`transport.publish(frame)` instead of `transport.update()` so there is still
exactly one native poll per game frame.

`transport.getDiagnostics()` reports published, sent, acknowledged, and
coalesced frame counts plus the in-flight and newest-pending sequence. A rising
coalesced count means the renderer is slower than the main-process producer;
memory remains bounded and the renderer receives the newest state after its
acknowledgement.

## Shutdown

```ts
transport?.close();
steamInput.dispose();
steamworks.shutdown();
```

Close renderer transport first, dispose the session, then shut down the Steam
client. Await every pending Steam Bridge Promise before client shutdown.

## Release checklist

- Validate the manifest and run generated-definition `--check` in CI.
- Include the action manifest and every referenced configuration in each depot
  at the same relative path on Windows, Linux/Steam Deck, and macOS.
- Select **Custom Configuration (Bundled with Game)** and **Any Future
  Devices** in Steamworks, save, and publish the app configuration.
- Test Xbox, PlayStation, Nintendo, Steam Deck built-in controls, generic/DInput,
  keyboard/mouse mixing, controller disconnect/reconnect, two-controller local
  multiplayer, action-set/layer transitions, binding changes, glyph refresh,
  overlay rebinding, focus loss/return, suspend/resume, and Remote Play where
  supported.
- Test from an actual Steam launch. IDE-only `steam_appid.txt` and
  `steam://forceinputappid/<appid>` are debugging aids, not release proof.
