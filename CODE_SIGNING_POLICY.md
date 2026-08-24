# Code signing policy

Free code signing provided by [SignPath.io](https://about.signpath.io/),
certificate by [SignPath Foundation](https://signpath.org/).

## Scope

The SignPath Foundation application covers only binaries built from Steam
Bridge's public MIT-licensed source and build scripts. Its first Windows
artifact is:

- `steam_bridge_native.win32-x64-msvc.node`

It does **not** cover applications that consume Steam Bridge, including Fantasy
Online 2. It also does not cover Valve's Steamworks redistributables. In
particular, `steam_api64.dll` and `sdkencryptedappticket64.dll` retain Valve's
own bytes and Authenticode signatures and must never be re-signed with the
Steam Bridge certificate.

The Windows addon dynamically loads those Valve redistributables at runtime.
The signing request contains the project-owned addon and bounded origin
metadata only; it does not submit Valve binaries for signing.

## Source and build provenance

- Source: <https://github.com/jstroh/steam-bridge>
- License: [MIT](LICENSE)
- Releases: <https://github.com/jstroh/steam-bridge/releases>
- Package: <https://www.npmjs.com/package/steam-bridge>

Signing candidates are built from an immutable `v*` tag by the repository's
GitHub-hosted Windows runner. The workflow uploads the unsigned addon to GitHub
before requesting signing, allowing SignPath's GitHub connector to verify the
repository, tag, commit, workflow, and hosted build origin. Every signing
request requires manual approval. The signed addon is verified for a trusted
Authenticode chain, code-signing EKU, RSA key, SignPath Foundation publisher,
and trusted timestamp before it is released.

All GitHub Actions dependencies in the signing workflow are pinned to immutable
commits. Release source, CI, package gates, and the signing workflow are review
security boundaries and must receive the same review as native code.

## Team roles

- Authors/committers: repository collaborators with write access, currently
  [Jeromy Stroh (`@jstroh`)](https://github.com/jstroh).
- Reviewers: repository collaborators who approve proposed changes before they
  are merged. A contributor may not approve their own untrusted contribution.
- Signing approvers: the repository owner and any future maintainer explicitly
  assigned the SignPath approver role. Every release signing request is
  manually reviewed against its tag, CI result, source commit, and artifact
  hash.

All authors, reviewers, and signing approvers must use multi-factor
authentication for GitHub and SignPath.

## Privacy

Steam Bridge itself does not send telemetry or information to its maintainers.
Network access happens only when the application or operator explicitly invokes
Steam/Steamworks or a configured publisher endpoint. See the full
[privacy policy](PRIVACY.md).

## Security and revocation

Security reports should use the repository's private
[GitHub security-advisory flow](https://github.com/jstroh/steam-bridge/security/advisories/new).
If a signing credential, workflow, release artifact, or maintainer account may
be compromised, signing stops immediately while the incident is investigated.
Affected releases will be identified publicly, and the certificate/signature
will be revoked when necessary.
