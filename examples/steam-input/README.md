# Steam Input examples

[Steam Input guide](../../docs/steam-input.md) · [Electron integration](../../docs/electron.md)

This directory contains a runnable Node diagnostic, a managed game-loop excerpt,
and an advanced Electron transport inspector. They are not three interchangeable
production templates.

| File | Purpose |
| --- | --- |
| [diagnostic.cjs](diagnostic.cjs) | Runnable console diagnostic for native Steam Input state |
| [game.ts](game.ts) | Managed session example exporting update/shutdown functions for an application's loop |
| [steam_input_manifest.vdf](steam_input_manifest.vdf) | Small manifest for learning and code generation |
| [electron-main.cjs](electron-main.cjs), [preload.cjs](preload.cjs) | Advanced manual MessagePort transport inspection |

## Prepare the repository

From the repository root, follow [the contributor setup](../../CONTRIBUTING.md#setup),
including the SDK/native toolchain if you are building from source:

```sh
npm install
npm run native:build
npm run build
```

These repository examples use the local workspace. An ordinary package consumer
instead installs `steam-bridge` from npm and starts with the
[Node quick start](../../README.md#quick-start).

## Run the Node diagnostic

With Steam running and signed in, run from the repository root:

```sh
npm run steam-input:example:node
```

The default run uses SpaceWar `480` for ten seconds and reports controller/action
state and diagnostics. A controller-free run proves lifecycle only. Action
names must exist in the selected app's configuration before button/glyph output
can qualify a real integration.

For a configured development app, set `STEAM_APP_ID`. To load this example
manifest explicitly, set `STEAM_INPUT_MANIFEST` to its absolute path. For a
normal installed Steam launch, omit that override so Steam selects the depot's
configuration. Do not publish app-specific values or raw controller identifiers
in example logs.

## Generate the managed example's definition

Change into this directory before using these relative paths:

```sh
cd examples/steam-input
npx steam-bridge-input validate ./steam_input_manifest.vdf
npx steam-bridge-input generate ./steam_input_manifest.vdf --out ./steam-input.generated.ts
npx steam-bridge-input generate ./steam_input_manifest.vdf --out ./steam-input.generated.ts --check
```

The sample intentionally omits official bundled layouts, so the validator warns
about that omission. A shipping app needs the matching configurations and every
referenced VDF in its depot.

`game.ts` is not a standalone executable: it exports functions for your
game's frame loop and shutdown. Read it alongside
[the single-frame-owner rule](../../docs/steam-input.md#3-choose-one-frame-owner).

## Advanced Electron inspector

From the repository root:

```sh
npm run steam-input:example:electron
```

The inspector deliberately owns the lower-level transport, polling and prompt
UI. It is useful for transport development, not the recommended input setup for
a new application. Use the managed, sandbox-compatible preload and
`connectActionInput()` from the [Electron guide](../../docs/electron.md) instead.

The inspector's custom preload imports an advanced package entrypoint. Qualify
its bundling/sandbox compatibility against the Electron version you run;
do not assume an arbitrary package import is available in a sandboxed preload
or disable isolation just to copy this example. A native-load or unit-test pass
does not establish that this inspector works on your runtime.

## What to verify physically

Test held-button disconnect/reconnect, mixed keyboard/controller use,
action-set changes, remapping, prompt refresh, focus loss, and overlay
open/close. Test the installed app through Steam on every claimed platform.
Software-generated frames and SpaceWar lifecycle checks do not prove a real
controller's glyphs, haptics, or layout.
