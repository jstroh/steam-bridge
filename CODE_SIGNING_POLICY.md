# Code signing policy

Release tags sign the project-owned Windows native addon with Authenticode
through Azure Artifact Signing. The publisher is Pixel Games LLC, using a
Microsoft Public Trust certificate profile. Releases through 0.4.12 contain an
unsigned addon.

## Scope

The project-owned Windows artifact built from Steam Bridge's public MIT-licensed
source and build scripts is:

- `steam_bridge_native.win32-x64-msvc.node`

Release tags sign only that file. Valve's `steam_api64.dll` and
`sdkencryptedappticket64.dll` retain Valve's own bytes and Authenticode
signatures and must never be re-signed as project-owned code. The example
Electron application built by the package gate stays unsigned.

Signing applications that consume Steam Bridge is the distributor's
responsibility. A distributor may keep the Pixel Games LLC signature on the
addon or deliberately replace it with their own. The bundled
`sign-windows-package.ps1` helper keeps and verifies the addon's signature when
`-ExpectedNativeAddonPublisherSubject "CN=Pixel Games LLC"` is passed. Otherwise
it treats the addon as app-owned and refuses to replace its valid signature
unless `-ForceResign` is passed. `-ForceResign` replaces signatures only on the
addon and the application's top-level executables, never on Valve's or other
third-party libraries.

Microsoft Security Intelligence submission is reputation review, not code
signing or a guarantee that Smart App Control will allow an artifact. Record
each determination against the exact submitted bytes. Consumers must still
qualify their complete application under their own signing and security policy.

## Signing identity and credentials

- Service: Azure Artifact Signing account `pixelgames-signing`, Public Trust
  certificate profile `pixelgames-public`.
- Publisher: certificate subject common name and organization
  `Pixel Games LLC`, validated by Microsoft. The service issues short-lived
  certificates, so verifiers check the publisher subject and certificate chain
  rather than a fixed thumbprint.
- Digest and timestamp: SHA-256 file digest and an RFC 3161 timestamp from
  Microsoft's timestamp service, so a signature remains valid after its
  short-lived certificate expires. The package gate therefore checks the signer
  and timestamp chains for a trusted root and revocation, and takes certificate
  time validity from the verified timestamp rather than the current time.
- Credentials: none are stored in GitHub. The `sign-windows-addon` job runs in
  the `windows-signing` environment, which accepts only `v*` tags. It exchanges a
  GitHub OIDC token for an Entra application that holds only the Artifact
  Signing Certificate Profile Signer role on that account. The federated
  credential accepts only tokens issued to the `windows-signing` environment,
  and no other `Release` job can request an OIDC token.

## Source and build provenance

- Source: <https://github.com/jstroh/steam-bridge>
- License: [MIT](LICENSE)
- Releases: <https://github.com/jstroh/steam-bridge/releases>
- Package: <https://www.npmjs.com/package/steam-bridge>

Release candidates are built from an immutable `v*` tag by the repository's
GitHub-hosted runners. The Windows prebuild verifies the tag/version match and
exact addon/PDB pair and retains the matching symbols and the unsigned addon as
CI artifacts outside the package-assembly namespace.

The signing job then downloads that exact prebuild, refuses an addon that is
already signed, signs only the addon, and signs out of Azure. It installs no npm
dependencies and restores no dependency caches. Before replacing the Windows
prebuild artifact with the signed bytes, it verifies:

- a valid Authenticode signature whose signer common name and organization are
  exactly `Pixel Games LLC`, with the code-signing EKU and a timestamp;
- byte-identical Valve DLLs;
- changed addon bytes whose PE content, excluding the Authenticode signature
  area, is identical to the unsigned prebuild.

The Windows package gate runs in a fresh job without Azure access. It checks the
assembled addon against the retained PDB, and requires its PE content, excluding
the Authenticode signature area, to match the retained unsigned addon. It then
runs with `--require-native-addon-signed`. The packaged addon must carry a valid
signature from the expected publisher with a publicly trusted RSA certificate
chain, the code-signing EKU and a trusted timestamp, and the example executable
must remain unsigned. The gate also verifies Valve signatures, runtime-byte
preservation, ASAR layout, native loading, and candidate hashes. A tag run whose
signing job fails never reaches the package gate, so it produces no candidate.
The separate npm publication workflow still requires a successful matching tag
release and candidate-bound Windows live proof.

Manual `Release` runs from a branch skip signing and run the package gate as an
unsigned dry run. The publication workflow accepts only a successful tag-push
`Release` run, so a dry run cannot be published.

The matching PDB is also retained with the stable GitHub Release, outside the npm
package. Signing does not change the addon's debug identifier, so the retained
PDB matches the signed addon. Uploading symbols to a consuming application's
crash service is that application's release responsibility; public library
workflows require no consumer crash-service credentials.

The package gate's full-application mode (`--require-signed`) remains available
for distributors who sign a complete application. It requires the configured
expected publisher, trusted certificate chain, code-signing EKU, RSA key, and
trusted timestamp. Unsigned artifacts are reported as unsigned, and these checks
never weaken consumer application release gates.

All GitHub Actions dependencies in the release workflow, including
`azure/login` and `azure/artifact-signing-action`, are pinned to immutable
commits. Release source, CI, the signing job, package gates, and signature checks
are security boundaries and must receive the same review as native code.

## Team roles

- Authors/committers: repository collaborators with write access, currently
  [Jeromy Stroh (`@jstroh`)](https://github.com/jstroh).
- Reviewers: repository collaborators who approve proposed changes before they
  are merged. A contributor may not approve their own untrusted contribution.
- Release approvers: the repository owner and explicitly authorized maintainers
  review the tag, CI result, source commit, signing result, artifact hashes, and
  live proof before publication.

All authors, reviewers, and release approvers must use multi-factor
authentication for GitHub.

## Privacy

Steam Bridge itself does not send telemetry or information to its maintainers.
Network access happens only when the application or operator explicitly invokes
Steam/Steamworks, the Steam Web API helpers, or a configured publisher endpoint. See the full
[privacy policy](PRIVACY.md).

## Security and revocation

Security reports should use the repository's private
[GitHub security-advisory flow](https://github.com/jstroh/steam-bridge/security/advisories/new).
If a workflow, release artifact, maintainer account, or signing credential may
be compromised, publication stops immediately while the incident is investigated.
Removing the Entra federated credential or the signer role assignment stops
release signing at once. Affected releases will be identified publicly, and any
affected credential or certificate will be revoked when necessary.
