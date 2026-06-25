# steam-bridge

Native-backed Steamworks bridge for Electron and Node.

This package exposes a TypeScript API and a compatibility-style grouped client
for projects that want to call Steamworks from JavaScript while keeping native
Steam API lifecycle and callback dispatch in Rust.

This project is 100% created and maintained by Codex.

## Install

```sh
npm install steam-bridge
```

Steam Bridge expects Steamworks SDK redistributables to be present at build or
package time. It does not vendor Valve SDK files.

## Quick Start

For local smoke tests, use Valve's SpaceWar sample App ID `480`. Replace it with
your own Steam app ID before testing app-specific features or shipping.

```ts
import steamworks from "steam-bridge";

const client = steamworks.init(480);

const steamId = client.localplayer.getSteamId().steamId64;
const ticket = await client.auth.getAuthTicketForWebApi("steam-bridge-example");

client.overlay.activateToWebPage("https://store.steampowered.com/app/480/");
client.callback.register(
  client.callback.SteamCallback.MicroTxnAuthorizationResponse,
  (event) => console.log(event)
);

console.log({ steamId, ticketBytes: ticket.getBytes().length });
```

The package also includes macOS overlay diagnostics through
`client.utils.getOverlayDiagnostics()` and the Electron helper export
`electronConfigureSteamOverlay()`. These are intentionally diagnostics first:
core Steam API success should not be treated as proof that the Steam overlay has
hooked Electron.

## Development

```sh
npm test
npm run native:fmt
npm run native:check
```
