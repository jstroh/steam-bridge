# Getting started

[Documentation home](../README.md) · [Electron](electron.md) · [Steam Input](steam-input.md) · [Packaging](packaging.md)

Use this guide for installation, the application lifetime, and deciding which
process owns each Steam feature. For a first native-load check, run the
[complete Node example](../README.md#quick-start) before adding a window or input.

## Prerequisites

- A [supported OS and architecture](../README.md#platform-targets).
- Node.js 18+ to consume the package. Repository development uses Node.js 22.13+
  and Rust; see [Contributing](../CONTRIBUTING.md).
- Steam running and signed in under the same desktop user as your application.
- Your game's App ID and an account entitled to use it. Public examples use
  Valve's SpaceWar App ID `480`.

Install the library as a runtime dependency:

```sh
npm install steam-bridge
```

The published package contains target-specific N-API addons and Valve runtime
libraries. Consumers do not compile Rust or download the Steamworks SDK.
Electron is an optional peer: install it separately if your game uses it.

`startSteam({ appId })` passes the explicit ID to native initialization, which
sets the Steam App ID environment. A local `steam_appid.txt` may be useful for
debugging other launch paths, but is not an extra requirement imposed by this
managed call. A successful direct Node launch is not a substitute for testing
your installed game through Steam.

## Own one application lifetime

```ts
import { startSteam } from "steam-bridge";

const steam = startSteam({ appId: 480 });

const stopOverlayEvents = steam.events.onOverlayChanged((active) => {
  console.log("Steam overlay active:", active);
});

// Keep steam alive while the game runs.
// When the application is ready to shut down:
stopOverlayEvents();
steam.close();
```

This is a lifecycle excerpt, not a game loop. In your application, put cleanup
in its shutdown path rather than immediately after startup.

`startSteam()` initializes Steamworks and owns its callback pump. It allows
only one active managed application in a process. Its `close()` is idempotent
and releases still-owned callbacks, action sessions, and game hosts before
Steam shutdown. The Electron integration has its own lifetime and closes
separately.

Do not initialize Steam again in an Electron renderer or worker, run a second
callback pump, or mix managed ownership with independent raw
`init()`/`shutdown()` calls. Finish or cancel outstanding operations and await
their promises before normal shutdown. A host close is not permission to release
an unsafe Windows producer texture; see [the exceptional GPU path](electron.md#windows-texture-ownership).

## Find the service you need

The returned `steam` object groups the ordinary APIs:

| Task | Service |
| --- | --- |
| App ownership, DLC and installation information | `apps` |
| Current player's local Steam identity | `localPlayer` |
| Achievements and user statistics | `achievements`, `stats` |
| Authentication tickets | `auth` |
| Steam Cloud files | `cloud` |
| Friends and lobbies | `friends`, `matchmaking` |
| Networking and Workshop | `networking`, `workshop` |
| Steam Inventory and screenshots | `inventory`, `screenshots` |
| Overlay activation and authorization events | `overlay`, `events` |
| Semantic controller actions | `steamInput` |
| Native presentation and managed window attachments | `gameHost` |

These services preserve their underlying Steamworks types. Use the installed
TypeScript declarations for signatures and the [API coverage map](steam-api-coverage.md)
to locate advanced features. The map describes exported surface coverage, not
proof that every feature has passed live tests on every device.

Public APIs use `bigint` for 64-bit identifiers. Do not convert these to
JavaScript `number`, which can lose precision. Serialize them as decimal strings
when crossing your own JSON boundary.

An App ID alone does not provision achievements, inventory definitions, Workshop,
commerce, or controller layouts. Configure the corresponding feature for your
own game in Steamworks and test it with the correct account. SpaceWar cannot
prove your game's backend or product configuration.

## Open the overlay

Call these from an application action after the game window is ready:

```ts
if (steam.overlay.isAvailable()) {
  steam.overlay.open({ type: "dialog", dialog: "friends" });
}
```

The managed surface also accepts store, web, and user targets. Overlay
availability is a prerequisite, not proof of correct visible rendering.
Electron needs the [platform presentation integration](electron.md#choose-the-window-model);
calling `overlay.open()` alone does not build one.

## Keep the backend boundary explicit

Authentication tickets come from the client and must be verified by your trusted
backend. A local player name or Steam ID is not authentication proof.

Publisher Web API calls belong on that backend:

```ts
import { createSteamPublisherApi } from "steam-bridge/server";

const publisher = createSteamPublisherApi();
```

Configure `STEAM_PUBLISHER_WEB_API_KEY` in the server environment
(`STEAM_WEB_API_KEY` is the legacy fallback), or supply the server-only options.
Never put a publisher key in a shipped Electron main process, preload, renderer,
environment file, or game package. The server facade rejects browser and
Electron runtimes, including Electron main.

For purchases, initialization, player authorization, server finalization, and
granting the result are distinct stages. An `onPurchaseAuthorization` callback
is not by itself proof that the backend finalized a transaction. Keep product
validation and fulfillment on the server and avoid logging tickets, orders,
payment details, or user identifiers.

## Next steps

- [Electron integration](electron.md): startup order, windows, input, GPU ownership.
- [Steam Input](steam-input.md): actions, controller positions, glyphs and rebinding.
- [Packaging](packaging.md): build hooks and exact installed-package checks.
- [Troubleshooting](troubleshooting.md): narrow a failure before changing runtime policy.
