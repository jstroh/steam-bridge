# Steam Input example

Generate the typed definition before compiling `game.ts`:

```sh
npx steam-bridge-input validate ./steam_input_manifest.vdf
npx steam-bridge-input generate ./steam_input_manifest.vdf --out ./steam-input.generated.ts
```

The sample manifest intentionally omits bundled official layouts, so validation
prints that warning. A shipping game should export its official layouts from
Steam's configurator, add a `configurations` block, and include every referenced
VDF in the depot.

See the complete [Steam Input guide](../../docs/steam-input.md).

## Runnable diagnostics

With Steam running, launch the console diagnostic for ten seconds:

```sh
node ./diagnostic.cjs
```

To exercise this example manifest during development, provide its absolute
path as `STEAM_INPUT_MANIFEST`. For a deployed Steam app, omit that override so
Steam uses the manifest configured for the depot.

The context-isolated Electron inspector demonstrates renderer-cadenced polling,
one-in-flight request backpressure, bounded MessagePort delivery, prompts,
rebinding, and diagnostics without exposing `ipcRenderer` or the native Steam
client:

```sh
npx electron ./electron-main.cjs
```

Run these commands from this directory. Use your own app ID and published Steam
Input configuration for real controller/action proof; SpaceWar only proves the
generic lifecycle when its configuration does not declare these example names.
