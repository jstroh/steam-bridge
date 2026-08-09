# Steam Input product plan

Last reviewed: 2026-08-08

Status: implemented in the active worktree; automated qualification is green.
Physical controller qualification remains evidence-bound to the release-candidate
lanes below and is not claimed from a machine with no connected controller.

## Implementation result

The active worktree at base commit `2927d39` (`Record steam-bridge 0.3.20 release`)
implements every product layer selected by this plan:

- corrected forward-safe raw Steam Input ABI/lifecycle behavior, explicit
  session frame ownership with rejected mixed modes, a bounded asynchronous
  data wait, and multiplexed bounded direct-action events;
- a dependency-free manifest validator and deterministic, schema-strict,
  overwrite-safe typed-definition CLI;
- one-call native frame snapshots and typed `SteamInputSession` state with
  cached handles, edges, two-controller/max-action coverage, disconnect release
  snapshots, retained action-set selection across frames/hot-plug, queued
  unresolved layers, truthful merged-device semantics, isolated consumer
  snapshots, drift-resistant active-controller tracking, and diagnostics;
- live-origin localized prompts, rebinding, vibration/LED helpers, and
  explicit failure diagnostics;
- an acknowledged/coalescing Electron MessagePort transport with renderer and
  peer-port lifecycle cleanup, rollback on failed handoff, and queue metrics;
- a secure context-isolated Electron inspector, a bounded Node diagnostic
  runner, a sample manifest/generated definition, and the public human guide.

Final Windows automated evidence on 2026-08-08 is green: `npm test` passed
417/417 JavaScript/TypeScript tests and 49/49 Rust tests; `package:smoke`,
`api:check`, `check:platform`, `native:fmt`, `native:check`, and
strict Clippy and `git diff --check` passed. A live App ID 480 lifecycle probe and the runnable
diagnostic both initialized Steam, produced monotonic batched frames, and shut
down cleanly. Steam enumerated zero controllers and App ID 480 had no matching
example actions, so button edges, device glyphs, output, rebinding, and the
Windows/macOS/Deck physical lanes remain intentionally unclaimed until a real
candidate is run with the required hardware and published app configuration.

## Outcome

Steam Bridge already exposes nearly all of `ISteamInput006`, but it exposes it
at approximately the same level as Valve's flat C API. That is useful for API
coverage and compatibility, but it leaves a game developer responsible for
manifest plumbing, global lifecycle, raw `bigint` handles, per-frame polling,
button-edge detection, controller hotplug, action-set state, glyph invalidation,
and Electron process transport.

The recommended product is an additive, high-level `SteamInputSession` built on
top of the existing raw `client.input` facade. Its public contract should be:

- game actions and action sets are named and typed;
- action handles are resolved once and retried when Steam has not loaded a
  controller configuration yet;
- one session owns explicit Steam Input lifecycle and frame advancement in the
  process;
- one batched native call samples every requested action for every requested
  controller per game frame;
- digital edge state, controller lifecycle, and the active controller are
  tracked by the session;
- prompts are derived freshly from the action's current Steam origins whenever
  displayed, so rebinding does not depend on a callback or revision arriving;
- Steam owns the rebinding UI through `ShowBindingPanel`;
- Electron gets an optional main-to-renderer transport without loading the
  Steam native addon in two processes; and
- the existing raw facade remains available and source compatible.

This is an input integration layer, not a new game engine input system. It must
not replace a game's keyboard, mouse, touch, or accessibility input. The game
merges Steam action state with those existing sources.

## Evidence and current gaps

The native binding and compatibility facade currently cover initialization,
callbacks, action manifests, controller enumeration, action sets and layers,
digital and analog data, origins and glyphs, motion, haptics, LEDs, binding
panels, Remote Play, and configuration metadata. The public facade is centered
on calls such as:

```ts
client.input.init();
client.input.runFrame();
const controller = client.input.getControllers()[0];
const set = client.input.getActionSet("Gameplay");
const jump = client.input.getDigitalAction("Jump");
controller.activateActionSet(set);
const state = controller.getDigitalActionData(jump);
```

That surface has four important usability problems:

1. A developer must retain and correctly associate untyped handles. Valve says
   action and action-set handles should be resolved once at startup and reused.
2. A normal game reads many actions every frame. The current facade crosses the
   N-API boundary once per action and controller, then leaves edge detection to
   the caller.
3. Steam Bridge's ordinary callback pump defaults to 33 ms. It is appropriate
   for general Steam callbacks, but it is not a render-frame input clock for a
   60-165 Hz game. A high-level input API must not silently equate those clocks.
4. The native addon is process-global and main-thread-only. An Electron game
   must not initialize a second Steam client in its renderer just to read input.

The review also found these foundation defects; the implemented high-level
surface now repairs or rejects each one:

- `input.runFrame()` currently defaults the SDK's reserved Boolean argument to
  `false`; the current SDK header declares the reserved default as `true`.
- Steam documents action-origin values as extensible beyond the SDK header.
  Steam Bridge accepts only values through the compiled enum count (plus the
  maximum sentinel) when a caller passes an origin back for a glyph or string,
  which can defeat Steam's future-proof glyph path for a newly added device.
- `getDigitalActionStateByName()` resolves handles on every call and silently
  activates an action set. Reading state should not mutate controller context.
- `waitForData(true)` was synchronous and could block Node's main thread
  forever. Infinite waits are rejected, and finite synchronous/asynchronous
  waits are capped at 60 seconds to keep accidental main-thread stalls bounded.
- Valve exposes only one direct action-event callback. The raw facade mirrors
  that restriction instead of providing one native owner with safe JavaScript
  subscriber multiplexing and bounded delivery.
- The README lists Steam Input coverage but does not provide a shippable
  manifest-to-game-loop workflow.

## Product decisions

These decisions are part of the plan and should not be reopened during the
first implementation unless new primary evidence disproves them.

### Keep the raw API

`client.input` remains the compatibility and expert surface. Existing calls are
not removed. The high-level session is additive. The deprecated
`client.controller`/`ISteamController` facade remains compatibility-only and is
not used by new examples.

### Use native Steam actions, not emulated Xbox buttons

The primary path is Valve's action API. Gamepad emulation remains a documented
fallback for an existing game that only understands XInput, but it loses
controller-specific capabilities and is not as future-proof for glyphs. Steam
actions also let a player bind an intent such as `Jump` instead of a fixed
button.

### Keep one explicit frame owner

The session will not start an arbitrary hidden 60 Hz JavaScript timer. The game
loop calls `session.update()` once per game frame. That call runs the Steam
Input frame update once and returns one coherent, batched snapshot. Each call is
a real sample; duplicate calls consume separate edge frames and are a caller
bug, not something the session silently coalesces.

An optional wait-driven native input pump can be considered only after the
manual batched path is implemented and benchmarked. `BWaitForData` is designed
for a dedicated input thread, but adding a native thread changes callback and
shutdown ownership. It is not a phase-one shortcut.

### Make the manifest the source of truth

The game owns its action manifest and official controller configurations.
Steam Bridge will not ship a universal default manifest. A CLI reads the
developer's VDF, validates the parts the bridge can prove, and generates a
typed definition. Steam's own developer mode and configuration UI remain the
authority for complete controller-configuration validation.

### Let Steam own rebinding

The session opens Steam's binding panel and reports whether it opened. It does
not implement a competing controller-remapping UI. A later
`SteamInputConfigurationLoaded_t` event refreshes configuration metadata.
Prompt origins are re-queried when requested, as Valve recommends, so
correctness does not depend on that event being delivered first.

### Derive prompts from action origins

Prompt art is requested from the current controller, action set, and action.
It is not selected from a hard-coded Xbox/PlayStation table. The descriptor may
contain multiple origins because a player can bind more than one input to an
action. Steam-provided PNG/SVG paths and localized labels are exposed; games
remain free to render their own art with a documented Steam fallback.

### Do not absorb keyboard and mouse

Steam Bridge reports Steam Input controller actions. It will expose active
controller changes so a game can choose appropriate prompts, but it will not
guess when the game's independent keyboard or mouse was last used. The game
combines those sources and owns the final prompt-switching policy.

## Proposed developer surface

Names may receive a final API review before implementation, but the shape and
ownership are the intended contract.

```ts
import path from "node:path";
import steamworks, { defineSteamInput } from "steam-bridge";

const client = steamworks.init({ appId: 123456 });

const actions = defineSteamInput({
  actionSets: {
    menu: "Menu",
    gameplay: "Gameplay"
  },
  actionLayers: {
    inventory: "InventoryOverlay"
  },
  digital: {
    accept: "Menu_Accept",
    cancel: "Menu_Cancel",
    jump: "Jump"
  },
  analog: {
    move: "Move",
    look: "Look"
  }
});

const input = client.input.createSession({
  definition: actions,
  manifestPath: path.join(process.resourcesPath, "steam_input_manifest.vdf"),
  controllers: "individual"
});

input.start();
input.activateActionSet("gameplay");

function gameFrame() {
  const frame = input.update();
  const player = frame.primaryController;

  if (player?.digital.jump.pressedThisFrame) jump();
  if (player) move(player.analog.move.x, player.analog.move.y);
}

const prompt = input.getDigitalPrompt("jump");
// { action: "jump", origins, glyphs, localizedActionName, controller }

input.showBindingPanel();
input.dispose();
```

The generated definition should preserve literal keys, so
`player.digital.jump` is typed and `player.digital.jmup` fails at compile time.
The runtime names remain available for JavaScript users.

### Frame data

Each controller snapshot should contain:

- stable Steam Input handle and current gamepad slot, if any;
- controller type, Remote Play session ID, and binding revision;
- current action set and ordered active layers;
- every declared digital action as `active`, `isDown`,
  `pressedThisFrame`, and `releasedThisFrame`;
- every declared analog action as `active`, named source mode, `x`, and `y`;
- monotonic sequence and capture timestamp; and
- whether it was the most recent Steam controller to produce action data.

The session should offer both per-controller state for local multiplayer and a
merged `STEAM_INPUT_HANDLE_ALL_CONTROLLERS` view for single-player games. It
must never merge controllers by default when `controllers: "individual"` is
requested. The merged view exists only while at least one physical controller
is connected, inherits the active physical primary controller's device
metadata, and resolves back to that concrete controller for output APIs.

### Lifecycle events

The session should multiplex and normalize:

- `controller-connected`;
- `controller-disconnected`;
- `configuration-loaded`;
- `gamepad-slot-changed`;
- `active-controller-changed`; and
- `diagnostic` for actionable non-fatal states.

The session owns the one underlying Valve action callback if event delivery is
enabled. JavaScript listeners do not overwrite one another. Analog event
traffic must be coalesced or bounded so a stalled JS loop cannot create an
unbounded queue.

### Electron transport

An optional Electron helper should keep the session in the main process and
send batched snapshots over one authenticated, one-way channel to a specific
`webContents`. It must:

- never expose arbitrary native-method invocation over IPC;
- bind to one session and one intended renderer;
- clean up on renderer destruction, navigation, or peer port closure;
- coalesce stale frames instead of queueing them;
- carry the native sequence and timestamp so the renderer can detect staleness;
- avoid JSON serialization of `bigint`; and
- provide a small preload-side typed consumer.

This helper is optional. Node games and Electron games with their own transport
can consume `SteamInputSession` directly.

## Implementation phases

### P0 - Correct the raw foundation

1. Align the `RunFrame` reserved default with the SDK while preserving an
   explicit compatibility argument.
2. Accept forward-compatible action-origin values returned by Steam when they
   are passed back to Steam glyph/string helpers. Keep bounds checks only where
   Steam Bridge itself indexes a compiled lookup table.
3. Add named source-mode and origin types to the friendly input namespace while
   keeping the full generated Steamworks enums available.
4. Deprecate the side-effectful by-name state helper and add a read-only
   replacement that does not activate an action set or resolve handles per
   frame.
5. Add a non-blocking wait API. Mark the synchronous infinite wait as unsafe;
   decide in API review whether it must reject `waitForever` immediately or be
   removed only in the next major release.
6. Give the bridge one action-event callback owner with JavaScript subscriber
   multiplexing, bounded/coalesced analog delivery, and deterministic cleanup.
7. Add lifecycle tests for init, repeated init, shutdown, disconnect, callback
   replacement, and a Steam-global shutdown while a session exists.

Acceptance: raw API tests cover each corrected SDK contract; existing callers
remain source compatible except for an explicitly documented safety rejection
of an infinite main-thread wait.

### P1 - Manifest tooling and typed definitions

1. Add a small KeyValues parser limited to the action/manifest structures the
   tool needs. Do not import a large general-purpose editor into runtime code.
2. Add `steam-bridge-input validate <manifest>` and
   `steam-bridge-input generate <manifest> --out <file>`.
3. Validate absolute/packaged path guidance, globally unique action names,
   action-set and layer names, parent layer references, Valve's action-count
   ceilings, an English localization fallback, localization references, and
   relative official-configuration files.
4. Generate a deterministic TypeScript definition and reject stale generated
   output in a CI `--check` mode.
5. Include a minimal example manifest and configurations as test/example
   assets, not as a production default.

Acceptance: malformed fixtures produce file/section/action-specific messages;
valid fixtures round-trip deterministically on Windows, macOS, and Linux; a
plain JavaScript definition works without code generation.

### P2 - Batched native sampling and `SteamInputSession`

1. Add one native `inputPollSnapshot`-style call that optionally runs
   `ISteamInput::RunFrame`, enumerates controllers once, and reads arrays of
   pre-resolved digital and analog handles in one N-API crossing.
2. Resolve handles once, but treat a zero handle as pending rather than a
   permanent startup failure. Retry after device connection and configuration
   load so starting the game with no controller remains valid.
3. Implement explicit `start`, `update`, and `dispose` ownership. Enforce one
   active high-level session per Steam client process and make cleanup
   deterministic.
4. Track digital edges, connect/disconnect, active controller, action-set/layer
   state, binding revisions, sequences, and timestamps.
5. Support individual and all-controller modes without confusing controller
   identity or local multiplayer.
6. Detect invalid/missing definition entries as aggregated actionable
   diagnostics rather than failing on the first raw handle.

Acceptance: maximum declared actions across two simulated controllers require
one native sampling call per game frame; edge transitions occur exactly once;
hotplug and delayed configuration loading recover without restart; update
reapplies only the action set explicitly selected by the session.

### P3 - Prompts, rebinding, outputs, and Electron delivery

1. Add action-aware digital and analog prompt descriptors with Steam glyph
   paths, localized strings, all bound origins, and documented custom-art
   fallback.
2. Re-query prompt origins each time the game requests a displayed prompt, as
   Valve recommends. The earlier revision-keyed whole-prompt cache was removed
   because a missing or delayed callback could leave UI stale after rebinding.
3. Wrap the binding panel with clear unavailable/overlay-disabled diagnostics;
   observe configuration reload rather than pretending the panel has a close
   result Valve does not provide.
4. Add ergonomic haptic/rumble/LED helpers with range validation and capability
   behavior documented as best-effort.
5. Add the optional coalescing Electron main/preload transport.

Acceptance: changing a binding updates the next prompt without restart;
unknown future origins still produce Steam art; overlay-disabled rebinding
fails clearly; a 165 Hz renderer cannot accumulate an unbounded IPC backlog.

### P4 - Human documentation and release qualification

1. Put a complete ten-minute setup in the root README: partner settings,
   manifest, generated definition, game loop, prompts, rebinding, and cleanup.
2. Add a detailed Steam Input guide covering menu/gameplay action sets,
   narrowly scoped layers, localization, configuration revisions, Steam Deck,
   debugging with `steam://forceinputappid/<appid>`, and packaging paths.
3. Add a runnable Electron example with a secure preload and an on-screen input
   inspector; add a Node example that requires no Electron.
4. Add a diagnostic dump that reports lifecycle, manifest path, pending or
   resolved handles, controllers, action set/layers, revision, Remote Play, and
   prompt origins without user secrets.
5. Release the high-level surface first as additive minor-version functionality
   while keeping raw methods documented under an Advanced/Compatibility
   section.

Acceptance: a developer starting from the README can create a manifest, see a
controller hotplug, read a typed action, show the right glyph, open Steam's
binding panel, and package the same code on every supported platform.

## Test and QA matrix

### Automated contract tests

- no controller at startup, then hotplug;
- controller present before callbacks are enabled;
- configuration still loading, zero handle, later successful retry;
- disconnect while a digital action is held (one release, no stuck state);
- two controllers with independent edges and action sets;
- merged all-controller mode;
- action-set switch and ordered layer activation/deactivation;
- repeated same-set activation and layer idempotence;
- live rebinding with fresh prompt origins even before callback/revision state;
- unknown future action origin passed through to Steam glyph helpers;
- analog source modes, dead values, negative axes, and no `NaN`/infinity;
- action-event listener multiplexing, slow listener, and bounded queue;
- dispose during pending events, global shutdown, and reinitialize;
- overlay unavailable when opening the binding panel;
- stale Electron renderer, navigation, crash, and backpressure coalescing;
- generated definition determinism and stale `--check` failure; and
- malformed, oversized, duplicate, unlocalized, and missing-file VDF fixtures.

### Performance qualification

Instrument native capture timestamp, JS receipt timestamp, update duration,
queue depth, coalesced frame count, and renderer receipt timestamp. Exercise
30, 60, 75, 120, 144, 165, and mixed-refresh display cases. The gate is:

- one native batch per declared game frame;
- no increasing queue depth or memory use under sustained analog input;
- no repeated or missed digital edges in the deterministic injector test;
- no stale input caused by the 33 ms general callback pump;
- no material render-pacing regression against the same build with the input
  session disabled; and
- input update cost is measured against, and kept to a small fraction of, the
  active display's frame budget rather than assuming a 60 Hz target.

### Physical devices and platforms

| Platform | Required physical paths |
| --- | --- |
| Windows 11 | Xbox/XInput, DualSense, hotplug, two-controller order, mixed-refresh displays, binding panel |
| Apple Silicon macOS | DualSense or Xbox-compatible controller, hotplug, focus/fullscreen, binding-panel desktop window |
| Steam Deck Game Mode | built-in Deck controls, correct Deck glyphs, OS keyboard for text, suspend/resume, binding overlay |
| Steam Deck Desktop | built-in controls plus one external controller, focus changes, desktop binding window |
| Qualified Linux desktop | X11/Wayland session recorded, external controller, hotplug, focus/fullscreen, binding window |

For every physical lane, verify menu navigation, sustained analog movement,
rapid digital taps, simultaneous actions, action-set transitions, layer
transitions, prompt changes, rebinding, disconnect/reconnect, and clean exit.
Steam Deck verification additionally requires that the default official
configuration reaches all game functionality and that controller interaction
never leaves keyboard-only prompts visible.

## Explicit non-goals and closed paths

- Do not remove or redesign the raw compatibility API in this work.
- Do not revive deprecated `ISteamController` as the recommended surface.
- Do not build a custom rebinding UI or edit a player's Steam configuration.
- Do not hard-code a universal Xbox layout or assume one origin per action.
- Do not initialize Steam independently in an Electron renderer.
- Do not drive input from the 33 ms general callback timer and call it a game
  frame.
- Do not start with a native dedicated input thread before the manual batched
  design is correct, measured, and lifecycle-safe.
- Do not treat a missing controller at startup as fatal.
- Do not claim Steam Deck readiness from desktop emulation or CI alone.

## Primary references

- [Valve: Steam Input overview](https://partner.steamgames.com/doc/features/steam_controller)
- [Valve: getting started for developers](https://partner.steamgames.com/doc/features/steam_controller/getting_started_for_devs?l=english)
- [Valve: ISteamInput reference](https://partner.steamgames.com/doc/api/ISteamInput)
- [Valve: in-game actions file](https://partner.steamgames.com/doc/features/steam_controller/iga_file?l=english)
- [Valve: action manifest files](https://partner.steamgames.com/doc/features/steam_controller/action_manifest_file?l=english)
- [Valve: action set layers](https://partner.steamgames.com/doc/features/steam_controller/action_set_layers?l=english)
- [Valve: gamepad emulation best practices](https://partner.steamgames.com/doc/features/steam_controller/steam_input_gamepad_emulation_bestpractices)
- [Valve: Steam Deck and Steam Machine recommendations](https://partner.steamgames.com/doc/steamhardware/recommendations)
- [Unity Input System actions](https://docs.unity3d.com/Packages/com.unity.inputsystem@1.4/manual/Actions.html)
- [Unity Input System device changes](https://docs.unity3d.com/Packages/com.unity.inputsystem@1.4/api/UnityEngine.InputSystem.InputSystem.html)
- [Epic: Unreal Engine Enhanced Input](https://dev.epicgames.com/documentation/unreal-engine/enhanced-input-in-unreal-engine)

The exact bundled SDK contract used during this review is
`steamworks-sys 0.13.0`'s `public/steam/isteaminput.h`, interface
`SteamInput006`. Its comments are the authority for newer methods that Valve's
web reference does not yet describe, including data waiting and direct action
events.
