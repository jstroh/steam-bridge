# Steam Input and renderer input

[Documentation home](../README.md) · [Electron integration](electron.md) · [Packaging](packaging.md)

Start by choosing what the game consumes. Steam actions, browser gamepads, and
keyboard emulation solve different problems:

| Game input model | Use | What the game receives |
| --- | --- | --- |
| Semantic actions such as move, interact or pause | Managed Steam Input session | Named analog/digital actions and prompts from the player's current bindings |
| An existing DOM/Gamepad API game | Renderer input preload | Normalized sticks, position-named buttons, raw axes/buttons, keyboard and pointer state |
| An existing keyboard/mouse game using Steam layouts | Legacy layout generator | Device-correct Steam mappings to the game's existing bindings |

You can support mixed input, but avoid running the same gameplay action through
both a Steam action binding and its emulated key. Full menu navigation, target
selection, hotbar policy, and accessibility behavior belong to the game.

Native Steam Input runs in the process that initialized Steamworks, normally
Electron main. The renderer never initializes Steamworks.

## 1. Define and validate the action manifest

The manifest declares Steam action names and controller configurations.
Steamworks must know about the manifest and every referenced layout in your
depot. A TypeScript definition alone does not publish a configuration to Steam.

Use the [sample manifest](../examples/steam-input/steam_input_manifest.vdf) as a
small starting point. Validate it, generate typed names, and commit the output:

```sh
npx steam-bridge-input validate ./input/steam_input_manifest.vdf
npx steam-bridge-input generate ./input/steam_input_manifest.vdf --out ./src/generated/steam-input.ts
npx steam-bridge-input generate ./input/steam_input_manifest.vdf --out ./src/generated/steam-input.ts --check
```

These single-line commands work in PowerShell and POSIX shells. The generated
module exports `steamInputDefinition`. `--check` fails when committed output
is stale and belongs in CI.

The validator checks KeyValues syntax, action/set/layer names, supported modes,
localization, action limits, and referenced controller layouts. The bundled
SteamInput006 SDK supports 256 unique digital and 24 unique analog actions.
Keep an English fallback for referenced titles and separate gameplay/menu
contexts where appropriate.

For a hand-written definition, developer keys map to exact Steam manifest names:

```ts
import { defineSteamInput } from "steam-bridge";

const definition = defineSteamInput({
  actionSets: { gameplay: "gameplay", menu: "menu" },
  actionLayers: { inventory: "inventory" },
  digital: { jump: "jump", pause: "pause", accept: "accept", cancel: "cancel" },
  analog: { move: "move" }
});
```

Use names that actually exist in your manifest. Prefer generation when the
manifest is the source of truth. The public SpaceWar App ID `480` proves
initialization, not that these game-specific actions are configured.

## 2. Start one managed session

```ts
import { startSteam } from "steam-bridge";
import { steamInputDefinition } from "./generated/steam-input";

const steam = startSteam({ appId: 480 });
const actions = steam.steamInput.createSession({
  definition: steamInputDefinition,
  controllers: "individual",
  activeControllerAnalogThreshold: 0.1
}).start();

actions.activateActionSet("gameplay");
```

Only one managed session may be active in a process. It owns explicit-frame
Steam Input initialization, name resolution, native batch polling, edges,
controller tracking, and cleanup. `steam.close()` disposes sessions it owns;
you can call `actions.dispose()` earlier when retiring input.

For a local development override, pass an existing **absolute**
`manifestPath` when creating the session. The override affects the Steam Input
session, not just one window. Omit it in shipped builds so Steam uses your
configured depot manifest.

## 3. Choose one frame owner

### Gameplay in Node/main

Call `actions.update()` once from the game's existing update loop:

```ts
function updateGame(): void {
  const controller = actions.update().primaryController;
  const move = controller?.analog.move;

  applyMoveIntent(move?.active ? move.x : 0, move?.active ? move.y : 0);
  if (controller?.digital.jump.pressedThisFrame) performJump();
}
```

This excerpt assumes those actions and application functions exist. It is not
a second timer. Reset movement to neutral when there is no active controller.

Each update advances Valve's frame once, enumerates controllers once, and reads
all resolved actions in one native crossing. Do not also call raw
`input.runFrame()` or `input.getControllers()`; they advance native state and
are rejected while the managed session owns it.

### Gameplay in an Electron renderer

Use `installRendererInput()` plus `connectActionInput()`, then read
`getRendererInput()?.gamepads.read().steamActions` in the renderer.
The [complete connection sequence and edge example](electron.md#connect-steam-actions-to-the-renderer)
show the main and renderer halves.

The connection must be installed before page load, or explicitly reconnected
after an already loaded document. The preload alone does not start native
action polling. Renderer reads request the next frame asynchronously and return
the latest cached one. Consume `pressedThisFrame` only once per
`steamActions.sequence`, even if the game reads the same frame several times.

Do not add a main-process polling timer alongside this path. In particular,
`connection.read()` polls; it is not a harmless cached peek.

## Read actions as state and edges

| Digital field | Meaning |
| --- | --- |
| `active` | Available in the current Steam Input configuration |
| `isDown` | Active and currently held |
| `pressedThisFrame` | Sampled up-to-down transition |
| `releasedThisFrame` | Sampled down-to-up transition |

The first sample does not invent a press/release. That also applies on
reconnect or when an unresolved handle first becomes available. A tap occurring
entirely between polls cannot be reconstructed.

For analog actions, use `active`, `x`, `y`, and `mode` according to the
declared action. The primary-controller threshold is **only a device-selection
heuristic**. It does not clamp, dead-zone, or filter gameplay values.

### One controller or several

- `"individual"` (default): physical controllers in `frame.controllers`.
- `"merged"`: Valve's combined state in `mergedController`.
- `"both"`: both views from one batch.

For single-player input, `primaryController` starts with the first device and
changes on a digital press or meaningful analog motion. Idle connected devices
and small stick drift should not steal prompt ownership. With no physical
device, primary and merged controllers are `null`, not fake devices.

For local multiplayer, assign physical controller handles to player seats
instead of using one shared primary. `inputType` is the friendly device name;
`inputTypeCode` preserves the numeric value for newer, unrecognized devices.

On disconnect, the `controller-disconnected` event's `releasedController`
contains neutral values and release edges for held actions. Clear gameplay
intent on disconnect/focus loss rather than keeping the last nonzero movement.

## Change action sets on game-state transitions

```ts
actions.activateActionSet("menu");
actions.activateActionSet("gameplay", controller);
actions.activateActionLayer("inventory", controller);
actions.deactivateActionLayer("inventory", controller);
actions.deactivateAllActionLayers(controller);
```

The names must exist in your definition. Omitting the controller targets all
controllers. Pass a frame controller or its `bigint` handle for a player-specific
change. Selecting a new all-controller set clears stale individual overrides.

Zero handles can be temporary while Steam loads a configuration. The session
queues the newest unresolved set/layer selection and retries resolution. Base
sets are kept authoritative across later polls and device/configuration changes.
Layers are applied/removed on transitions, not replayed every frame, because
layer order matters. Disconnect and disposal clear pending controller work.

Avoid the deprecated raw `getDigitalActionStateByName()` convenience method:
reading it can activate an action set as a side effect.

## Display the player's actual button glyphs

Ask for the action's prompt rather than assuming that the bottom face button
is always A:

```ts
const prompt = actions.getDigitalPrompt("jump");
if (prompt) {
  for (const glyph of prompt.glyphs) {
    showPromptAsset(glyph.label, glyph.pngPath, glyph.svgPath);
  }
}
```

`showPromptAsset` is your UI/asset-loading function. Glyphs are image paths
provided by the Steam client, **not Unicode characters**. Prompts contain all
bound origins and localized labels, and use the current action set unless you
supply another one. Re-query when displaying/refreshing prompts so player
rebinding is reflected; do not hard-code Xbox labels or wait only for a
configuration callback.

For an isolated renderer, expose only the needed glyph assets through an
application-owned, allowlisted asset/protocol boundary. Do not grant arbitrary
filesystem access or expose a general file-reader IPC method. Retain a text or
keyboard/mouse fallback when no valid glyph is available.

`actions.showBindingPanel()` opens the concrete controller's Steam configurator.
It returns `false` when no controller is available, the overlay is unavailable,
or Steam rejects the request. Handle that result in the UI.

## Existing browser-style games

The Electron preload's `gamepads.read()` path exposes semantic
`sticks.left`/`sticks.right` and position-named buttons such as
`south`, `east`, `west`, and `north`. A button's `pressed` means **held**,
not a new press each frame. Use transitions for one-shot actions and clear your
edge history on focus loss or device replacement.

Mapping is `standard` when Chromium supplies standard gamepad mapping and
`heuristic` for non-standard raw ordering. Retain raw axes/buttons for advanced
binding UI. Position alone does not tell you the symbol printed on every
controller.

Use `input.read()` for keyboard, pointer, touch/pen, wheel, text/composition,
and ordered DOM events as well. Choose one read per game update. The controller
path avoids DOM-event copying; full input uses bounded event storage and
coalesced pointer motion. Empty-controller discovery is limited to once per
second, while connected devices are sampled when the game requests input.

The preload has no independent animation-frame loop. Steam action IPC is
one-in-flight/coalesced, and there is no action IPC without an attached service.
Context isolation still copies/freezes returned data; do not describe it as
zero-cost.

A normal browser/mobile page without this Electron preload must use its host's
Gamepad/DOM input integration. `getRendererInput()` does not install native
Steam or guarantee that every controller is correctly mapped on those hosts.

## Generate legacy controller layouts

For games consuming existing keyboard/mouse or analog gamepad input, keep a
versioned JSON binding specification and generate controller-specific layouts:

```sh
npx steam-bridge-generate-legacy-layouts resources/steam-input-layout.json --out resources/steam-input
npx steam-bridge-generate-legacy-layouts resources/steam-input-layout.json --out resources/steam-input --check
```

The [layout schema](../packages/steam-bridge/src/steam-input-layouts.ts) lists
the complete required binding keys. Version 1 includes `version`, `title`,
`description`, and `bindings`; do not omit directional fields when opting into
analog movement.

By default, the left stick emits the configured four directional bindings.
Set `analogMovement: true` only when your game consumes native left-stick axes;
the generated `joystick_move` group retains `movementClick`, while directional
fields remain required but inactive in that mode.

Generation covers generic, Xbox, PlayStation, Switch/Joy-Con, Steam Controller,
Steam Deck, and Remote Play touch families using their real sources. It emits
deterministic files and an `Action Manifest` with a plural `configurations`
block. Include the manifest and all referenced files in the depot; generation
does not publish Steamworks settings for you.

## Haptics and text entry

Output requires a concrete connected controller:

```ts
actions.vibrate(0.35, 0.8, controller);
actions.setLedColor(20, 100, 255, controller);
actions.restoreLedColor(controller);
```

Vibration uses normalized `0..1`; LED components use integer `0..255`.
A merged/all-controller target resolves to the physical primary for these
helpers. With no physical device, the helper returns `false` and reports a
diagnostic. Use the advanced `Controller` APIs for specialized haptics, motion
or trigger effects.

For controller text entry, `utils.showGamepadTextInput()` from
`steam-bridge/steamworks` resolves to submitted text or `null` on cancellation.
For an existing field, use `showFloatingGamepadTextInput()` and its dismissal
callback. Keep normal keyboard input available and keep Steam alive until the
promise settles. Never put entered text in diagnostic logs.

## Events, timing and advanced transport

Managed events include `controller-connected`, `controller-disconnected`,
`active-controller-changed`, `configuration-loaded`, `gamepad-slot-changed`,
and `diagnostic`.

```ts
const warning = actions.on("diagnostic", ({ code, message }) => {
  console.warn(code, message);
});

// When this subscription is no longer needed:
warning.disconnect();
```

These handles use `disconnect()`; application-level
`steam.events.onOverlayChanged()` returns an unsubscribe function instead.
Listeners execute synchronously. Do not recursively call `actions.update()`
from one. Keep listeners lightweight, and inspect `actions.getDiagnostics()`
on demand for unresolved names, lifecycle and controller state.

`capturedAtNs` is sampled immediately after the native batch returns;
`receivedAtNs` after normalization. Both use the main process's monotonic
clock. Their delta measures that processing interval, not controller hardware
latency, wall-clock time, or renderer presentation latency.

Most Electron games should use the managed connection. If you truly need your
own transport, the advanced APIs are `createElectronSteamInputTransport()`
and `subscribeElectronSteamInput()` from `steam-bridge/electron/advanced`.
Bundle/qualify a custom preload for its Electron sandbox context rather than
assuming arbitrary package imports work there.

The manual transport has one frame in flight and keeps the newest pending
frame. A listener is acknowledged after completion, including an async listener.
New-document navigation, renderer failure, destruction or port closure closes
the old transport. Same-document/subframe navigation retains it.

Call `transport.update()` only if the transport owns polling. If you already
called `actions.update()`, publish that frame with `transport.publish(frame)`
instead. `getDiagnostics()` reports sent, acknowledged and coalesced counts.
Increasing coalescing means the consumer is behind, not an unbounded queue.

IPC serializes native `bigint` values and sequences as decimal strings.
Preserve those strings or reconstruct with `BigInt`, never `Number`.
Keep privileged IPC private and validate any application methods you expose.

## Before shipping

- Validate the manifest and generated-output `--check` in CI.
- Bundle every referenced layout at the expected relative path.
- Publish the intended Steamworks input configuration for your game.
- Test mixed keyboard/mouse/controller use, held-button disconnect, reconnect,
  focus/overlay transitions, two controllers, rebinding, glyph refresh,
  action sets/layers, and suspend/resume where supported.
- Test Steam Deck Desktop and Game Mode separately and representative
  Xbox/PlayStation/Nintendo devices where claimed.
- Launch the installed package through Steam. No-controller or IDE-only runs
  are not physical controller qualification.
- Close renderer connections before sessions, then the Electron integration
  and Steam application. Await pending work before normal shutdown.

The [example guide](../examples/steam-input/README.md) distinguishes runnable
diagnostics from integration excerpts.
