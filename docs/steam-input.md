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
categories and controller-type names, action/set/layer name collisions,
configuration priorities, action limits, English localization fallbacks,
parent-set links, and referenced layout files. Generation refuses to overwrite
the source manifest and replaces an existing output atomically, so an
interrupted write cannot leave a half-generated definition.

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

Valve currently limits a manifest to 128 unique digital actions and 16 unique
analog actions. Keep a dedicated menu action set, give every referenced title
an English fallback, and select **Any Future Devices** in the Steamworks Steam
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
reads every resolved digital and analog action in one native crossing. Do not
also call `input.runFrame()` in the same loop.

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
consumer-owned object cannot corrupt edge detection, prompt caching, events, or
the next frame.

For local multiplayer, consume `frame.controllers` and assign stable controller
handles to player seats. For a single-player game, use `primaryController`. It
starts with the first controller and moves to the controller that produces
digital or analog activity.

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
controller, emits `STEAM_INPUT_ACTION_SET_QUEUED`, and applies the newest queued
set after resolution. This makes the common immediate-after-`start()` call safe
without hiding genuinely unknown names from diagnostics.

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
Steam-client PNG/SVG glyph paths. Cache entries include device binding
revision and are cleared by device/configuration/slot callbacks, so a changed
binding produces new prompt data. Keep a keyboard/mouse fallback in UI when no
Steam prompt is available. Prompt results are returned as isolated copies, so
UI code cannot mutate the session's cached prompt.

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
controller mode/count, primary handle, last sequence, and every unresolved
manifest name. Zero handles are retried after updates and Steam device or
configuration callbacks rather than being treated as permanent failures.
When a controller disappears while an action is held, the disconnect event's
`releasedController` contains a final zeroed snapshot and exactly one release
edge for each held action. Use it to clear per-player state immediately.

## Electron: bounded main-to-renderer delivery

When gameplay runs in a context-isolated renderer, transfer a private
`MessagePort` after the page is ready. The transport allows one frame in
flight; while the renderer is behind it replaces old pending frames with the
newest one. Navigation, renderer failure, `webContents` destruction, or either
`MessagePort` endpoint closing closes the transport and removes every listener.

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
