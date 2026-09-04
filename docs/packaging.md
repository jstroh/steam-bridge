# Packaging your game

[Documentation home](../README.md) · [Electron integration](electron.md) · [Troubleshooting](troubleshooting.md)

This guide is for an application that **consumes** Steam Bridge. Publishing
the Steam Bridge npm package is a separate [maintainer procedure](../RELEASING.md).
Neither the package nor its build hooks upload Steam depots or choose your
release branch.

## 1. Install a reproducible runtime

Keep `steam-bridge` in the game's production dependencies and commit its
lockfile. Pin the exact Electron/runtime versions qualified for your release.
Use the published package normally, not a local link, copied development addon,
or `STEAM_BRIDGE_NATIVE_PATH` override in a shipping build.

The package already includes the target N-API addon and Valve runtime libraries.
Do not rebuild it against an arbitrary SDK or replace native files after the
package was tested. Building this repository is a different workflow described
in [Contributing](../CONTRIBUTING.md).

## 2. Install both electron-builder hooks

Add the hook pair to your existing `electron-builder.config.cjs`:

```js
const { createSteamBuildHooks } = require("steam-bridge/electron-builder");

const steamBuild = createSteamBuildHooks();

module.exports = {
  // Keep your existing app metadata, files, targets and signing configuration.
  asar: true,
  asarUnpack: [
    "node_modules/steam-bridge/*.node",
    "node_modules/steam-bridge/*.dll",
    "node_modules/steam-bridge/*.so",
    "node_modules/steam-bridge/*.dylib"
  ],
  afterPack: steamBuild.afterPack,
  afterSign: steamBuild.afterSign
};
```

This is a configuration excerpt, not a complete release configuration. Merge
these entries with existing `asarUnpack` rules rather than replacing them.
If you already have hooks, compose them deliberately: Steam Bridge preparation
must run on the final executable layout, and signing verification must run
after the sign operation. Do not silently overwrite another required hook.

| Target | `afterPack` | `afterSign` |
| --- | --- | --- |
| Windows | No platform preparation | No platform verification |
| Linux | Prepares the Steam launcher and renamed binary | No operation |
| macOS arm64 | Prepares the Steam-compatible application executable | Verifies the prepared app's signing contract |

Windows no-op hooks do **not** sign or qualify the application. Native addons
and Valve libraries must be real loadable files outside ASAR. Inspect the final
package rather than assuming the packager unpacked everything correctly.
For custom layouts, use the typed `linux`/`macos` options to
`createSteamBuildHooks()`; advanced individual hooks remain available from
`steam-bridge/electron-builder/advanced`.

## 3. Respect the platform launch model

### Windows x64

Use the standalone D3D11 host with offscreen/shared-texture Electron
presentation. Ship the addon and required Steam DLLs alongside the package's
native load path. Test the actual executable without a development override.

The Windows native addon is unsigned. Preserve Valve's exact runtime bytes and
signatures. Your application signing/reputation policy is your responsibility;
a Microsoft Security Intelligence submission is reputation review, not signing.
Do not weaken App Control or other security settings to declare a candidate
healthy. See the [code signing policy](../CODE_SIGNING_POLICY.md).

### Linux x64 and Steam Deck

The hook turns the packaged executable path into a Bash launcher, keeps the
original binary at the matching `.bin` path, changes into its own directory,
and forwards user arguments. Launch the wrapper, not the renamed binary.

The launcher retains `--no-zygote --no-sandbox`, required by this integration's
current Steam/Electron process model. Disabling the Chromium process sandbox
is a security tradeoff, not a generic recommendation for Electron applications.
Keep Node integration off, context isolation on, and renderer content trusted.
Do not remove the flags without changing and requalifying the native integration.

Native presentation requires X11/GLX. A Wayland desktop needs working Xwayland
and a usable `DISPLAY`. Keep launcher and binary executable permissions intact
when staging depots. Test Steam Deck Desktop and Game Mode separately.
General non-Deck Linux requires its own physical qualification.

### macOS Apple Silicon

Build and test natively on `darwin/arm64`; Intel, Rosetta and universal packages
are unsupported. Retain the managed Metal child window model.

Use the preparation hook before final signing and retain `afterSign`
verification. Sign, notarize and validate the exact final app using your
application's release pipeline. The helper does not supply a signing identity,
enroll a developer account, or automatically notarize your game. Do not bypass
verification or use unsigned development output as shipping proof.

## 4. Include Steam Input assets

If using Steam Input, include its manifest and every referenced controller
layout at the expected relative paths on all depots. Run the validator and
generated-output `--check` before staging. Publish the matching Steamworks app
configuration, then confirm it from an installed Steam launch.

See the [Steam Input shipping checklist](steam-input.md#before-shipping).

## 5. Verify what players will install

For each claimed platform, record the source commit, app and Bridge versions,
Electron version, artifact hash, and Steam build/depot identity when available.
Test the unchanged installed package, not just the development checkout:

- Launch through Steam and verify initialization and the first rendered frame.
- Play with keyboard/mouse and the supported controllers.
- Open and close the real Steam overlay, then return to gameplay.
- Resize, change focus, minimize/restore, and enter/exit fullscreen.
- Check display/DPI/refresh changes and sustained gameplay cadence.
- Check disconnect/reconnect and clean application shutdown.
- Inspect native failures, texture ownership, software fallback and device-loss
  diagnostics, not just a single average FPS number.

A successful compile, native-load probe, or SpaceWar smoke does not prove
your game's commerce, authentication, physical controller mappings, or graphics
quality. Never finalize a real purchase as an incidental packaging smoke test.

For Steam Bridge's own candidate-bound qualification, use the
[advanced runbook](../examples/electron-basic/README.md). Consumer release
approval remains in your application's runbook.
