# Contributing

Thanks for helping improve Steam Bridge. The project is intended to stay generic
and reusable for any Steamworks app, so examples and docs should use Valve's
SpaceWar sample App ID `480` unless a test explicitly needs another ID.

## Setup

Use Node.js 22.13 or newer for repository development. The published package
keeps a lower runtime engine where possible, but the current Electron and
N-API tooling expect modern Node during install/build.

```sh
npm install
npm run native:build
npm run build
```

Steamworks SDK files and redistributables are not committed to this repository.
Use the standard `steamworks-sys` SDK setup or set `STEAMWORKS_SDK_PATH` for
your local SDK location.

The project supports macOS only on Apple Silicon (`aarch64-apple-darwin`).
Intel macOS targets are intentionally unsupported and should not be added unless
the support policy changes.

## Checks

Run these before opening a pull request:

```sh
npm test
npm run native:fmt
npm run native:check
```

Use `STEAM_BRIDGE_APP_ID=480 npm start -w steam-bridge-electron-example` for a
local Electron smoke test. Use your own Steam app ID for app-specific
achievements, stats, inventory, UGC, and economy behavior.

## Contribution Notes

- Keep public JavaScript behavior covered by tests when practical.
- Keep app-specific names, IDs, URLs, and assets out of shared docs and
  examples.
- Do not commit Steamworks SDK redistributables or generated native build
  output.
- Prefer small changes that preserve the existing TypeScript and Rust API
  shapes.
