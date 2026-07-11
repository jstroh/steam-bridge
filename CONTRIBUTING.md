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

The project supports Apple Silicon macOS only (`aarch64-apple-darwin`). Intel
macOS is intentionally unsupported. Keep builds, prebuilds, docs, and examples
aligned with that target unless the support policy changes.

## Checks

Run these before opening a pull request:

```sh
npm run check:platform
npm test
npm run native:fmt
npm run native:check
npm run api:check
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

## Release Candidates, Publication, and Rollback

The Release workflow assembles and validates an exact cross-platform npm
tarball plus a Windows candidate. Tag-triggered runs require signing; a manual
diagnostic run may remain unsigned. The workflow does not publish npm bytes or
create a GitHub Release, and a signed tag run is still a candidate until its
exact retained bundle passes the required live Windows gates.

`--require-publishable` is the signed-tag candidate gate and deliberately runs
before live proof, so it must remain receipt-free. An actual `--publish` must
also receive `--live-proof-receipt <receipt.json>`. Generate that sanitized
receipt only from the exact candidate's complete public `persistent-reuse`,
synthetic `checkout`, `shortcut-routes`, and `managed-routes` roots. The
generator requires all 31 exact cases, including 27 activation cases, rejects
private `InitTxn` inputs, nondefault web/checkout inputs, renderer/health
overrides, elevated tasks, custom runners, and stale-helper cleanup; compares
exact Steam identity through each task cleanup and across profiles; and
fingerprints the deployed candidate again after the live batch. The workflow
must not fabricate this post-live record or run `--publish` automatically.

GitHub Actions artifacts in this public repository are retained for 90 days;
GitHub permits at most 90 days for public repositories. Before the first
production publish, copy the exact `.tgz`, retained Windows bundle, audit JSON,
executable-probe result, and sanitized live-proof receipt to durable immutable
release storage, bind them to the protected `v<package-version>` tag, and keep
the five records together. The audit and receipt JSON are not independently
signed, so their trusted workflow/release provenance is part of the evidence
boundary. See
[GitHub's repository Actions settings](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/enabling-features-for-your-repository/managing-github-actions-settings-for-a-repository).

Publication authority is an explicit maintainer decision and is not required
to build, sign, retain, or live-test a candidate. npm trusted publishing can be
configured only after a package already exists, so the first publication must
use an explicitly approved CI bootstrap authentication path that emits npm
provenance. After that version exists, configure a trusted GitHub Actions
publisher for later versions. Do not add a registry token, `id-token: write`,
`--provenance`, or an automatic `--publish` step without approving that release
design and its live-proof ordering. npm documents
[the trusted-publisher bootstrap constraint](https://docs.npmjs.com/cli/v11/commands/npm-trust/),
[trusted publishing](https://docs.npmjs.com/trusted-publishers/), and
[provenance requirements](https://docs.npmjs.com/generating-provenance-statements/).

Rollback never replaces or reuses an already published version's bytes. Keep
the last known-good version installable; build, sign, package, and live-validate
a higher corrective candidate through the same gates; then publish it,
deprecate the bad version with a message naming the corrected upgrade, and move
npm dist-tags as applicable. Prefer deprecation to unpublishing; npm does not
allow an unpublished name/version to be reused. See npm's
[deprecation guidance](https://docs.npmjs.com/deprecating-and-undeprecating-packages-or-package-versions/)
and [unpublish policy](https://docs.npmjs.com/unpublishing-packages-from-the-registry/).
