# macOS Verification of `claude/fervent-gauss-17k8a8` (2026-09-24)

Run on the maintainer's Apple Silicon Mac against branch head `149e6e1e`, on
behalf of the whole-codebase review session. Goal: verify the branch's checks,
the hardened macOS native launcher
(`MAC-LAUNCHER-ARGUMENT-CONFINEMENT-001`) and the live App ID `480` overlay
matrix.

## Environment

| Item | Value |
| --- | --- |
| macOS | 27.0 (build 26A428), `arm64` native shell |
| Node / npm (default) | 24.18.0 / 12.0.2 |
| Node / npm (packaging workaround) | 22.22.3 / 10.9.8 |
| Rust | stable 1.98.1 |
| Electron (smoke example) | 44.4.5 |
| Steam at start | not running; launched for Phase 3, logged on, then quit again |

## Phase 1: Repository Checks (passed)

| Command | Result |
| --- | --- |
| `npm ci` | passed (npm install-script policy blocked two unrelated optional postinstalls) |
| `npm run check:platform` | passed |
| `npm run native:build` | passed (release build, addon and Steam dylibs linked) |
| `npm test` | passed: 474/474 JS tests, 0 skipped; 44/44 native tests |
| `npm run native:fmt` | passed |
| `npm run native:check` | passed |
| `npm run api:check` | passed |

The JS test `macOS Steam launcher confines launch targets and env-file
variables` ran and passed (not skipped).

## Phase 2: Packaged Launcher (passed, with a tooling workaround)

`npm run example:package:mac` **failed under npm 12** before packaging (see
Defect 1). It succeeded unchanged when run with the Node 22.22.3 / npm 10.9.8
toolchain first on `PATH`. The package step compiled the launcher from
`packages/steam-bridge/templates/macos-steam-env-launcher.c`, signed both
executables and passed its native-binding probe (1,153/1,153 methods).
`npm run macos:verify-signing -- --app-exe <bundle>/Contents/MacOS/SteamBridgeSmoke`
passed.

The compiled launcher binary from the bundle was copied next to a probe
executable named `SteamBridgeSmoke.electron` that prints its argv and the
Steam/`STEAM_BRIDGE_*`/`DYLD_*` environment:

| Case | Exit | Observed |
| --- | --- | --- |
| Default launch, `--steam-bridge-launch-app-id=480 hello` | 0 | reached sibling `.electron`, args forwarded, `SteamAppId`/`SteamGameId`/`SteamOverlayGameId=480`, launcher markers set |
| `--steam-bridge-launch-target=/bin/sh -c 'touch <marker>'` | 2 | rejected as outside the launcher directory; marker file not created |
| env file containing `DYLD_INSERT_LIBRARIES=/tmp/x.dylib` | 2 | `Launcher env file may not set DYLD_INSERT_LIBRARIES` |
| env file with only `SteamAppId`/`SteamGameId`/`SteamOverlayGameId`/`STEAM_BRIDGE_QA_PROBE` | 0 | accepted; all values reached the target |
| in-directory symlink to `/bin/sh` as target | 2 | rejected after `realpath` |
| env file with `STEAM_BRIDGE_NATIVE_PATH` | 2 | rejected |
| explicit in-directory target | 0 | accepted |

A real default launch of the packaged bundle's `SteamBridgeSmoke` exec'd in
place into `Contents/MacOS/SteamBridgeSmoke.electron` (same PID). It was then
stopped with no leftover processes.

## Phase 3: Live Steam Overlay Matrix (not run, blocked before any case)

| Command | Result |
| --- | --- |
| `npm run macos:overlay-matrix:preflight` | **failed**: `MACOS_OVERLAY_ENVIRONMENT null` / "macOS overlay environment is unavailable" while the display was unlocked and awake (see Defect 2) |
| `npm run macos:steam-client-health` | **failed** after Steam was launched and logged on: Steam used 251 of the inherited `launchctl maxfiles` soft limit of 256 (environment blocker) |
| `npm run macos:overlay-matrix -- --skip-package` (default `core` suite, App ID `480`) | **failed** at the same environment gate as preflight, after signing verification and before shortcut upsert, Steam restart or any case |
| `npm run macos:overlay-matrix:summarize` | failed: no artifact root/manifest (no cases ran) |

No shortcut was written and no smoke case was launched. Per-case matrix
results: none. No purchases were attempted.

This first health check was taken about ten seconds into Steam startup. See the
follow-up below: raising the limit is neither required nor an acceptable
precondition, because users run Steam with the default launchd limit.

## Defects Found (fixed in the follow-up)

1. **Example packager rejects npm 12 `npm pack --json` output.**
   `scripts/package-electron-example.cjs` `packSteamBridge()` reads
   `JSON.parse(stdout)[0]?.filename`. npm 12.0.2 returns an object keyed by
   package name (`{"steam-bridge": {"filename": ...}}`), so packaging throws
   `npm pack did not return a steam-bridge tarball.` Reproduce with Node 24.18 /
   npm 12.0.2: `npm run example:package:mac`. npm 10.9.8 returns the array shape
   and works. The repository only requires Node `>=22.13`, so a default modern
   toolchain can hit this. It also blocks the matrix's default packaging step.
2. **macOS matrix environment gate calls a function absent from the package
   root export.** `scripts/macos-overlay-matrix.sh` (the `node` heredocs in
   `require_interactive_macos_overlay_environment` and
   `read_macos_overlay_unavailable_reason`) does
   `require(path.join(repoRoot, "packages", "steam-bridge")).getMacOverlayEnvironment?.()`.
   The package `main`/`.` export is `dist/app.js`, which exports only
   `packageVersion`, `defineSteamInput` and `startSteam`. The optional call
   therefore returns `undefined`, and every success suite (and the
   `unavailable` suite) exits before launching anything. The native reader
   itself works: the addon returned `{"screenLocked":false,"displayAsleep":false}`.
   `getMacOverlayEnvironment` is exported from the `./steamworks` subpath
   (`dist/index.js`). The reference predates this branch (gate added in
   `f48d3427`; the root export was narrowed in `2dcd62c9`), and the dry-run
   self-test skips the gate, so CI does not catch it. Reproduce:
   `npm run macos:overlay-matrix:preflight` on an unlocked, awake Mac.

## What This Proves

- Branch checks, formatting, native check and API coverage are green on native
  Apple Silicon macOS with the rebuilt addon.
- The launcher compiled into a real packaged app confines `--steam-bridge-launch-target`
  and `--steam-bridge-launch-env-file` as designed. The default sibling target,
  in-directory explicit targets and allowed env-file keys still work.
- The packaged app passes signing/entitlement verification.

## What This Does Not Prove

- No Steam-launched shortcut using `--steam-bridge-launch-env-file` was run, so
  launch and overlay qualification with the hardened launcher remains open.
- No overlay matrix case, FPS, input or visual evidence was produced for this
  branch or Electron 44.4.5.
- Nothing here changes the Linux, Deck or Windows open items.

## Follow-up: Fixes and Rerun

Both defects are fixed on the branch:

- `scripts/npm-pack-output.cjs` reads `npm pack --json` output in either the
  array shape (npm 10/11) or the name-keyed shape (npm 12). The example
  packager, `smoke-package.cjs` and the Windows ASAR gate all use it.
- Both matrix environment-gate heredocs now load
  `packages/steam-bridge/dist/index.js` (the `./steamworks` entry).

Two new JS tests fail against the previous scripts and pass now. With the
fixes, on the default npm 12.0.2 toolchain: `npm test` passed 476/476 JS and
44/44 native tests; `native:fmt`, `native:check`, `api:check`,
`check:platform`, `package:smoke`, the matrix self-test and
`example:package:mac` passed. `npm run macos:overlay-matrix:preflight` passed
(`screenLocked=false`, `displayAsleep=false`).

Steam file limit: users cannot be assumed to have `sudo`, so the launchd
`maxfiles` soft limit was left at its default 256. With Steam started normally
through `open -a Steam`, it held about 201-209 numbered descriptors after
startup (214 in the health snapshot). `npm run macos:steam-client-health`
passed, with only the existing low-limit warnings. The earlier 251/256 failure
was a snapshot taken during startup, not a steady state.

The full `core` matrix was not run in this session: the agent's permission
policy blocked launching it. Launcher qualification through Steam-launched
env-file shortcuts therefore remains open.

## Before Rerunning

With Steam started normally and logged on, confirm
`npm run macos:steam-client-health` passes after startup settles. Then run
`npm run macos:overlay-matrix -- --skip-package` (or without `--skip-package`
to repackage) for the default `core` suite with App ID `480`, and
`npm run macos:overlay-matrix:summarize`.
