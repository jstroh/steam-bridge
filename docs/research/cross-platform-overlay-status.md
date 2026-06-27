# Linux and Steam Deck Overlay Status

Date: 2026-06-26

This tracks current runtime evidence for the Electron smoke app on Linux x64 and
Steam Deck using Valve's SpaceWar App ID `480`.

## Current Evidence

| Target | Status | Evidence |
| --- | --- | --- |
| Linux x64 | Verified through Steam Deck | Packaged Linux x64 smoke app launches on Steam Deck and initializes Steam as App ID `480`. The Linux package includes `linux-electron-smoke.sh` for direct, Steam-launched, and verification checks. |
| Steam Deck Game Mode | Verified | Steam-launched shortcut reported `steamDeck=true`, `bigPicture=true`, `steamLaunch=true`, `overlayInjection=true`, `overlayEnabled=true`, and emitted the `overlay:dialog` autorun event. Fresh check on 2026-06-26 launched full shortcut game ID `16558333557412462592` and passed. |
| Steam Deck Desktop Mode | Verified | Steam-launched shortcut reported `steamDeck=true`, `bigPicture=false`, `steamLaunch=true`, `overlayInjection=true`, `overlayEnabled=true`, and emitted both the `overlay:dialog` autorun event and overlay activation callback. Fresh check on 2026-06-26 launched full shortcut game ID `16558333557412462592` from Plasma Desktop and passed. |

## Steam Deck Shortcut Gate

Steam Deck testing uses the packaged Linux x64 app with SpaceWar App ID `480`
inside the process. The Steam launch URL must use the full non-Steam shortcut
game ID, not `480` and not Steam's internal 32-bit shortcut app ID. Launching
the wrong ID can show Steam's `Game configuration unavailable` dialog.

The packaged Linux helper can discover the current shortcut ID from
`shortcuts.vdf`, launch it, and verify the overlay signal:

```sh
cd "$HOME/steam-bridge-smoke/SteamBridgeSmoke-linux-x64"

./linux-electron-smoke.sh \
  --mode steam-launch \
  --shortcut-game-id auto \
  --action dialog \
  --result-file /tmp/steam-bridge-smoke-steam-launch.log \
  --require-steam-deck \
  --require-big-picture \
  --require-overlay-injection \
  --require-event callback:overlay-activated
```

The repository also includes a Deck-only host runner for SSH-driven checks. It
copies the Linux x64 package to the Deck, starts a temporary sleep inhibitor,
and runs the packaged helper:

```sh
npm run steam-deck:smoke -- \
  --mode discover \
  --discover-subnet 192.168.1

npm run steam-deck:smoke -- \
  --host deck@192.168.1.13 \
  --mode preflight

npm run steam-deck:smoke -- \
  --host deck@192.168.1.13 \
  --mode game
```

Use `--mode desktop` for the Steam Deck Desktop Mode shortcut check. Discovery
finds SSH candidates when the Deck address changes; preflight separates a
network/SSH blocker from package, Steam command, and shortcut setup problems.

The latest Deck Game Mode proof was captured at 2026-06-26 18:02 PDT from
`/tmp/steam-bridge-smoke-steam-launch.log` with `appId=480`,
`steamLaunch=true`, `overlayInjection=true`, `overlayEnabled=true`,
`overlayNeedsPresent=false`, `steamDeck=true`, `bigPicture=true`, and
`overlay:dialog`. The Steam overlay environment included
`SteamOverlayGameId=16558333557412462592` and `gameoverlayrenderer` in
`LD_PRELOAD`.

The latest Deck Desktop Mode proof was captured at 2026-06-26 18:08 PDT from
the same result path after switching to Plasma Desktop. It reported `appId=480`,
`steamLaunch=true`, `overlayInjection=true`, `overlayEnabled=true`,
`overlayNeedsPresent=false`, `steamDeck=true`, `bigPicture=false`,
`overlay:dialog`, and `callback:overlay-activated`.
