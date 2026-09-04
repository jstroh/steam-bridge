# Code signing policy

The Windows native addon is unsigned. No external signing provider is configured
or required by the release workflow.

## Scope

The project-owned Windows artifact built from Steam Bridge's public MIT-licensed
source and build scripts is:

- `steam_bridge_native.win32-x64-msvc.node`

Signing applications that consume Steam Bridge is the distributor's
responsibility. Valve's `steam_api64.dll` and `sdkencryptedappticket64.dll`
retain Valve's own bytes and Authenticode signatures and must never be re-signed
as project-owned code.

Microsoft Security Intelligence submission is reputation review, not code
signing or a guarantee that Smart App Control will allow an artifact. Record
each determination against the exact submitted bytes. Consumers must still
qualify their complete application under their own signing and security policy.

## Source and build provenance

- Source: <https://github.com/jstroh/steam-bridge>
- License: [MIT](LICENSE)
- Releases: <https://github.com/jstroh/steam-bridge/releases>
- Package: <https://www.npmjs.com/package/steam-bridge>

Release candidates are built from an immutable `v*` tag by the repository's
GitHub-hosted runners. The Windows job verifies the tag/version match and exact
addon/PDB pair, retains and uploads the matching symbols, and passes the exact
prebuild to package assembly without replacing its bytes through a signing
service. The Windows package gate records unsigned addon and example-app status
while verifying Valve signatures, runtime-byte preservation, ASAR layout, native
loading, and candidate hashes. The separate npm publication workflow still
requires a successful matching tag release and candidate-bound Windows live proof.

Generic optional Authenticode verification remains available for separately
signed candidates. When requested, it requires the configured expected
publisher, trusted certificate chain, code-signing EKU, RSA key, and trusted
timestamp. Removing a provider does not make an unsigned artifact signed or
weaken consumer application release gates.

All GitHub Actions dependencies in the release workflow are pinned to immutable
commits. Release source, CI, package gates, and optional signature checks are review
security boundaries and must receive the same review as native code.

## Team roles

- Authors/committers: repository collaborators with write access, currently
  [Jeromy Stroh (`@jstroh`)](https://github.com/jstroh).
- Reviewers: repository collaborators who approve proposed changes before they
  are merged. A contributor may not approve their own untrusted contribution.
- Release approvers: the repository owner and explicitly authorized maintainers
  review the tag, CI result, source commit, artifact hashes, and live proof before
  publication.

All authors, reviewers, and release approvers must use multi-factor
authentication for GitHub.

## Privacy

Steam Bridge itself does not send telemetry or information to its maintainers.
Network access happens only when the application or operator explicitly invokes
Steam/Steamworks or a configured publisher endpoint. See the full
[privacy policy](PRIVACY.md).

## Security and revocation

Security reports should use the repository's private
[GitHub security-advisory flow](https://github.com/jstroh/steam-bridge/security/advisories/new).
If a workflow, release artifact, maintainer account, or signing credential may
be compromised, publication stops immediately while the incident is investigated.
Affected releases will be identified publicly, and any affected credential or
certificate will be revoked when necessary.
