# Steam Bridge

Steam Bridge is a native-backed TypeScript package for Electron and Node. It is
designed as a small replacement path for the FOV4-used parts of `steamworks.js`,
with a stable TypeScript API and a compatibility adapter for the current call
shape.

## Status

This repository is the first implementation pass. The public package boundary is
ours, and the native module is Rust plus `napi-rs`. The native crate does not
depend on the high-level `steamworks-rs` wrapper. It calls the Steamworks flat C
API through `steamworks-sys` and owns its lifecycle, manual callback dispatch,
Web API ticket, overlay, Steam Deck, Steam ID, achievement, and microtransaction
callback code.

Steam SDK redistributables are not committed. For local/native builds, provide
the Steamworks SDK in the normal location expected by `steamworks-sys`, or wire
`STEAMWORKS_SDK_PATH`/your build environment according to your SDK setup.

## API

```ts
import {
  init,
  getSteamId,
  getAuthTicketForWebApi,
  isSteamDeck,
  onMicroTxnAuthorizationResponse,
  activateOverlayToWebPage,
  isAchievementActivated
} from "steam-bridge";

init({ appId: 2957110 });

const steamId = getSteamId().steamId64;
const ticket = await getAuthTicketForWebApi("fov4");
const bytes = ticket.getBytes();
```

The compatibility adapter keeps the FOV4-used shape:

```ts
import steamworks from "steam-bridge";

const client = steamworks.init(2957110);
client.localplayer.getSteamId().steamId64;
client.auth.getAuthTicketForWebApi("fov4").then((ticket) => ticket.getBytes());
client.callback.register(
  client.callback.SteamCallback.MicroTxnAuthorizationResponse,
  (event) => console.log(event)
);
client.overlay.activateToWebPage("https://store.steampowered.com/");
client.achievement.isActivated("ACHIEVEMENT_NAME");
```

## Layout

- `crates/native`: Rust N-API module.
- `packages/steam-bridge`: TypeScript public package and compatibility adapter.
- `examples/electron-fov4`: minimal Electron smoke app.
- `.github/workflows`: CI and release/prebuild scaffolding.

## Local Development

```sh
npm install
npm run native:build
npm run build
```

If you build the native module by another path, set `STEAM_BRIDGE_NATIVE_PATH`
to the `.node` file before requiring the package.

## FOV4 Swap Target

The intended first swap is replacing `steamworks.js` with `steam-bridge` without
changing the existing main/preload/renderer Steam calls that FOV4 currently
uses. Workshop screenshot upload is intentionally excluded from V1 because FOV4
does not use it.

For local FOV4 testing from sibling folders:

```sh
cd ~/steam-bridge
npm install
npm run build
npm run native:build

cd ~/fov4-steam
printf "2957110" > steam_appid.txt
npm install steamworks.js@file:../steam-bridge/packages/steam-bridge
npm run dev
```

The important smoke path is:

- Steam initializes under app id `2957110`.
- `client.localplayer.getSteamId().steamId64` returns the logged-in Steam ID.
- `client.auth.getAuthTicketForWebApi("fov4").getBytes()` returns ticket bytes.
- FOV4 loads characters through `fov4-steam-api`.
- The renderer can enter the game.
