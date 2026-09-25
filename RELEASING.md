# Releasing Steam Bridge

This is the maintainer npm-release procedure, not a game's Steam depot upload
guide. Application developers should use [Packaging your game](docs/packaging.md).

| Stage | Required result |
| --- | --- |
| [Prepare source](#1-prepare-the-exact-source) | Reviewed versioned source and passing gates |
| [Build prebuilds](#2-prove-the-cross-platform-prebuilds) | Audited artifacts for all supported targets |
| [Tag candidate](#3-create-the-immutable-candidate-tag) | Exact immutable tag and successful tag-triggered run |
| [Windows live proof](#4-run-the-protected-windows-actual-game-proof) | Sanitized receipt bound to those exact bytes |
| [Publish](#5-publish-the-exact-audited-npm-tarball) | Explicit approval and verified npm publication |
| [Retain and verify](#6-retain-and-verify-the-release) | Registry verification and durable evidence |

Do not substitute a green build for live proof, silently reuse a tag, or
rebuild native files between qualification and publication. Microsoft
reputation review is not signing and does not replace these gates. See
[the code signing policy](CODE_SIGNING_POLICY.md).

Commands containing `<placeholders>` require real release-specific values.
Backslash continuations are POSIX shell syntax; use a single line or PowerShell
continuation syntax on Windows. Run only the stage appropriate to the current
candidate.

Steam Bridge releases are immutable, cross-platform npm packages. The supported
native targets are:

- macOS Apple Silicon (`aarch64-apple-darwin`)
- Windows x64 (`x86_64-pc-windows-msvc`)
- Linux x64 (`x86_64-unknown-linux-gnu`)

Intel macOS is intentionally unsupported. A release is not complete merely
because a tag exists: the exact candidate must pass CI, the cross-platform
artifact audit, the protected Windows actual-game proof, and the gated npm
publication workflow.

## 1. Prepare the exact source

Start from a clean, synchronized `main` checkout. Confirm that the package
version in `packages/steam-bridge/package.json` is the intended version and that
the corresponding `v<version>` tag does not already exist.

Run the normal repository gates:

```sh
npm run check:platform
npm run package:smoke
npm test
npm run native:fmt
npm run native:check
npm run api:check
npm audit --package-lock-only --audit-level=moderate
```

Review the complete diff and confirm that generated native binaries, Valve
redistributables, credentials, local evidence, and temporary release directories
are not tracked.

## 2. Prove the cross-platform prebuilds

Run the manual `Release` workflow on the exact commit before tagging when a
candidate preflight is useful:

```sh
gh workflow run release.yml --ref main
gh run watch --exit-status
```

The workflow builds and audits exactly one artifact for each supported target:

- `steam-bridge-aarch64-apple-darwin`
- `steam-bridge-x86_64-pc-windows-msvc`
- `steam-bridge-x86_64-unknown-linux-gnu`

Windows uses the same direct Cargo compilation as the repository's native-build
helper. Its compiled DLL is copied to the canonical `.node` filename with
SHA-256 equality verification; the exact PDB, native-load and package gates still
apply. This avoids the CLI's Windows post-build reconciliation failure without
deleting locks or changing Windows security settings. Other targets use the CLI.

It also creates `steam-bridge-windows-publish-package-gate`, containing the
canonical npm tarball, retained Windows Electron bundle, package audit, and
native-load result. The workflow itself neither publishes npm bytes nor creates
a GitHub Release.

The Windows prebuild separately verifies and retains the matching
`steam_bridge_native.pdb` as `native-symbols-windows-<commit-sha>`. This artifact
is outside package assembly and must never enter the npm package. Library
releases require no consuming application's crash-service credentials. Consumers
download the matching PDB, verify its debug ID against the addon they distribute,
and upload it through their own crash-service configuration.

For a local inspection, download the completed run and assemble its native
artifacts into the package:

```sh
gh run download <run-id> --dir <artifact-directory>
npm run release:assemble -- --artifacts-dir <artifact-directory>
node scripts/verify-release-artifacts.cjs --target aarch64-apple-darwin
node scripts/verify-release-artifacts.cjs --target x86_64-pc-windows-msvc
node scripts/verify-release-artifacts.cjs --target x86_64-unknown-linux-gnu
npm publish --dry-run -w steam-bridge
```

The assembled native/runtime files are ignored release outputs. Do not commit
them.

## 3. Create the immutable candidate tag

After the exact commit and version are approved:

```sh
git tag v<version>
git push origin v<version>
```

The tag starts the same `Release` workflow. Record the successful tag-triggered
run ID. The workflow verifies that the package version matches the tag and that
the candidate is structurally publishable, but it deliberately does not invent
or bypass the required live Windows evidence.

## 4. Run the protected Windows actual-game proof

Use the exact retained Windows candidate from the tag run. Deploy it with the
transactional protection helper documented in
[`CONTRIBUTING.md`](CONTRIBUTING.md#release-candidates-publication-and-rollback),
then run every required standalone actual-game case from
[`examples/electron-basic/README.md`](examples/electron-basic/README.md).

Generate the sanitized `windows-live-proof-receipt.json` only from that exact
candidate. The receipt must cover:

- standalone startup
- window transitions
- the ordinary Steam Friends overlay
- frame pacing

Receipt schema 7 separately requires fresh shared-texture delivery at 95% of the
display target during gameplay and enforces the two-copy limit in both raw logs
and the sanitized receipt. Paint or repeated native Presents alone cannot prove
fresh content. Earlier receipt schemas cannot qualify this candidate.
The stderr policy accepts an empty log or exactly one ordered pair of Valve's
minidump App ID and cached Steam ID startup banners (`[API loaded no]`). Every
other line, duplicate or malformed banner fails. Retain the raw log privately;
the public receipt records its original hash, byte size and closed classification,
never the IDs. Do not filter the log before generating the receipt.

Do not substitute a development checkout, linked package, attached matrix, or a
receipt from different bytes.

Configure the exact receipt for the gated publisher:

```sh
npm run release:configure-publish-proof -- \
  --audit-manifest <steam-bridge-windows-package-audit.json> \
  --receipt <windows-live-proof-receipt.json> \
  --repo <owner/repository>
```

This stores only the sanitized, compressed release proof in the protected
GitHub environment. Delete the release-scoped secret after publication.

## 5. Publish the exact audited npm tarball

Dispatch the publisher from the immutable tag and supply the successful
tag-triggered `Release` run ID:

```sh
gh workflow run publish.yml --ref v<version> \
  -f release_run_id=<tag-release-run-id> \
  -f release_tag=v<version>
```

Use `-f npm_tag=<dist-tag>` only for an intentional prerelease. The
`npm-production` environment supplies the human approval boundary. The workflow
checks the tag, commit, successful CI run, Release provenance, tarball, retained
Windows bundle, audit, and live-proof receipt before publishing the privately
copied tarball with npm provenance.

For a documentation-only patch whose package bytes are otherwise identical,
the fail-closed predecessor-proof route may be used:

```sh
gh workflow run publish.yml --ref v<new-version> \
  -f release_run_id=<tag-release-run-id> \
  -f release_tag=v<new-version> \
  -f previous_release_tag=v<previous-version>
```

That route accepts only a higher stable patch in the same major/minor line,
requires the package README to change, and permits no other change. Any runtime,
template, helper, metadata, native, or packaged-file change requires fresh live
proof.

## 6. Retain and verify the release

After publication:

1. Download the npm package independently and verify its version, signature,
   provenance, file inventory, and native/runtime hashes against the candidate.
2. Create the stable GitHub Release for `v<version>` and retain the canonical
   `.tgz`, Windows bundle, audit JSON, native-load result, and sanitized live
   receipt together. Download `native-symbols-windows-<commit-sha>` from the same
   tag-triggered run, reverify its PDB against the retained Windows addon with
   `scripts/verify-windows-native-symbols.cjs`, and attach the PDB separately.
3. Confirm the intended npm dist-tag resolves to the new version.
4. Delete `STEAM_BRIDGE_WINDOWS_LIVE_PROOF_GZIP_BASE64` from the GitHub
   environment.
5. Record the immutable commit, workflow runs, hashes, and live-result summary
   in `docs/research/current-work.md` and update the relevant findings-ledger
   row.

GitHub Actions artifacts in this public repository expire after at most 90
days. The stable GitHub Release or equivalent immutable release storage is the
durable evidence boundary.

## Rollback

Never replace bytes for an already published version. Keep the last known-good
version installable, prepare a higher corrective version through the complete
workflow, publish it, then deprecate the bad version with an upgrade message and
move dist-tags if needed. Prefer deprecation to unpublishing; npm versions cannot
be reused.

The full candidate protection, trusted-publisher bootstrap, documentation-only
exception, and rollback policy lives in
[`CONTRIBUTING.md`](CONTRIBUTING.md#release-candidates-publication-and-rollback).
