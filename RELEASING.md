# Releasing

This project is 100% created and maintained by Codex. Keep releases generic for
Steamworks apps across supported Steam desktop platforms: macOS Apple Silicon,
Windows x64, and Linux x64. Intel macOS is intentionally unsupported.

## Preflight

Run the local checks from a clean `main` checkout:

```sh
npm run check:platform
npm run package:smoke
npm test
npm run native:fmt
npm run native:check
npm run api:check
```

Confirm the package name is available or owned by the project on npm:

```sh
npm view steam-bridge name version
```

## Verify Prebuilds

Run the manual GitHub Actions release workflow before tagging:

```sh
gh workflow run Release --ref main
gh run watch --exit-status
```

Download and inspect the artifacts from the completed run:

```sh
gh run download <run-id> --dir /tmp/steam-bridge-release
find /tmp/steam-bridge-release -type f | sort
```

Each release run must produce exactly one artifact folder per supported target:

- `steam-bridge-aarch64-apple-darwin`
- `steam-bridge-x86_64-pc-windows-msvc`
- `steam-bridge-x86_64-unknown-linux-gnu`

Each artifact folder must contain its target-tagged `.node` file and the two
Steam runtime libraries for that platform. The workflow runs
`scripts/verify-release-artifacts.cjs` before upload.

Assemble the downloaded artifacts into the package directory before the npm dry
run or publish:

```sh
npm run release:assemble -- --artifacts-dir /tmp/steam-bridge-release
```

Do not commit the assembled native/runtime files. They are generated release
outputs and are ignored by git.

## Dry Run

Build the package and run the npm publish dry run:

```sh
npm run build
npm publish --dry-run -w steam-bridge
```

The dry run should include `dist`, package metadata, README, LICENSE, and any
prebuilt native/runtime files assembled into `packages/steam-bridge`.

## Tag

After CI, release prebuild verification, and the npm dry run are clean:

```sh
git tag v0.1.0
git push origin v0.1.0
```

The tag push runs the same Release workflow and uploads the target artifacts.
