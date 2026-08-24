# SignPath Foundation application scope

This document is the application checklist for free Authenticode signing of the
open-source Windows native addon. It is not authorization to sign Fantasy Online
2, Electron/Chromium, or Valve binaries.

## Project facts

- Project: Steam Bridge
- Repository: <https://github.com/jstroh/steam-bridge>
- License: MIT for every tracked project source and build script
- Current release form: public npm package and GitHub releases
- Windows signing artifact: `steam_bridge_native.win32-x64-msvc.node`
- Build system: GitHub-hosted `windows-latest` runner from an immutable release
  tag
- Code signing policy: [CODE_SIGNING_POLICY.md](../CODE_SIGNING_POLICY.md)
- Privacy policy: [PRIVACY.md](../PRIVACY.md)

## Required disclosure

Steam Bridge integrates with Valve Steamworks. The repository does not check in
Valve redistributable binaries. The public package may redistribute
`steam_api64.dll` and `sdkencryptedappticket64.dll` under Valve's Steamworks
terms, but those files are separate from the requested artifact, retain Valve's
own signatures, and must be excluded from the SignPath artifact configuration.

The project requests a determination that its own MIT-licensed native addon is
eligible even though it dynamically links those separately distributed Valve
libraries. If SignPath treats that runtime dependency as a proprietary project
component rather than an excluded upstream redistributable, the application
must stop; the project must not conceal or work around that determination.

## Prepared application answers

- Project name: `Steam Bridge`
- Repository and homepage: <https://github.com/jstroh/steam-bridge>
- Download: <https://www.npmjs.com/package/steam-bridge>
- Privacy policy: <https://github.com/jstroh/steam-bridge/blob/main/PRIVACY.md>
- Tagline: `A lifecycle-owned Node and Electron bridge for Steamworks, Steam Input, and native Steam presentation.`
- Description: `Steam Bridge is an MIT-licensed developer library that gives Node and Electron applications a small, typed, lifecycle-owned interface to Steamworks, Steam Input, secure renderer input, and native Steam presentation on Windows, macOS, and Linux.`
- Reputation: `The public npm package recorded 2,545 downloads from 2026-07-25 through 2026-08-23 and is used by the released Steam title Fantasy Online 2. The project publishes source, CI, documentation, npm packages, and GitHub releases in public.`
- Reputation evidence: <https://api.npmjs.org/downloads/point/last-month/steam-bridge>, <https://store.steampowered.com/app/2957110/Fantasy_Online_2/>, and <https://github.com/jstroh/steam-bridge/releases>
- Maintainer type: `For-profit company or corporate-backed project`
- Build system: `GitHub Actions`
- Discovery channel: `AI / LLM tools`; exact source: `OpenAI Codex research using Microsoft Learn's Windows code-signing options documentation.`

The maintainer name, email, company, required consent checkboxes, CAPTCHA, and
final submission are personal/representational fields. They must be confirmed
immediately before transmission and are not stored in this repository.

## Configuration after acceptance

1. Add SignPath's GitHub connector and grant it access only to this repository.
2. Configure an artifact that contains exactly one Authenticode target:
   `steam_bridge_native.win32-x64-msvc.node`.
3. Enforce product name `Steam Bridge` and one version supplied by the release
   tag for every signed file.
4. Exclude all Valve, Electron, application, and third-party binaries.
5. Configure a release-signing policy limited to immutable `v*` tags and the
   GitHub-hosted workflow in `.github/workflows/signpath.yml`.
6. Assign a submitter token with no configuration or approval permission.
7. Require a separate manual SignPath approval for every signing request.
8. Add the organization/project/policy/configuration identifiers as GitHub
   repository variables and the submitter token as an Actions secret.
9. Run the workflow for a release tag, verify its unsigned hash, review the
   SignPath request, then approve it.
10. Publish only the exact signed artifact produced by that request and retain
    the signing-request URL, source commit, unsigned hash, and signed hash in the
    release record.

Submitting the application or a signing request is external representation and
must be explicitly approved at action time.
