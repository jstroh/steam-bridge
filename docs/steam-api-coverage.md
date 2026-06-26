# Steam API Coverage

Steam Bridge is expanding toward broad Steamworks client coverage, but it does
not yet expose every Steamworks interface. This document is a contributor map for
what is available today and what still needs work.

The native layer primarily targets the Steamworks flat C API through
`steamworks-sys 0.13`, with narrow local C++ shims for SDK surfaces that are
documented in headers but omitted from the generated flat bindings.
`npm run api:check` audits the bundled SDK and fails if any generated
`SteamAPI_*` flat function, public SDK `S_API` export, manual shim, or generated
callback constant lacks native/public coverage. Valve internal context/bootstrap
helpers are intentionally excluded when their public inline wrappers are already
covered.

## Implemented Areas

- Steam lifecycle and utils: initialization, anonymous-user initialization, safe
  initialization, shutdown, manual and legacy callback pumping, current-thread
  API memory release, try/catch callback toggles, Breakpad crash handler and
  minidump helpers, restart checks, Steam install path, Steam Deck, Big Picture,
  App ID, overlay diagnostics, server time, activity timers,
  connected universe, Steam UI language, image reads, battery/IPCCall counts,
  legacy CSER IP/port reads,
  overlay notification placement, VR helpers, China launcher checks, text
  filtering, IPv6 connectivity checks, file signature checks, raw APICall
  inspection, raw `CCallbackBase` registration bridges, generic Steamworks
  callback ID aliases, gamepad text input
  helpers, warning hooks, IPC failure, license update, client/server-deny,
  game-web, and utility callback events.
- Steam client: low-level Steam pipe/user creation and release helpers, global
  user connection, local IPv4 binding, typed interface pointer lookup, generic
  interface lookup by version, IPC call counts, warning hooks,
  shutdown-if-all-pipes-closed checks, deprecated private client frame pumping,
  safe wrappers for internal process callback pointer hooks, and private
  destroy-all-interface controls.
- Game coordinator: legacy `ISteamGameCoordinator` binary message send,
  availability, retrieval, and message-available/failed callbacks through a
  local shim because the interface is not emitted in the flat bindings.
- User/auth: local Steam ID helpers, Web API auth tickets, session tickets by
  Steam ID, IPv4, or IPv6 identity, auth session validation helpers, voice
  recording/capture and decompression, encrypted app ticket request/retrieval,
  encrypted ticket decryption and inspection, app ownership ticket data, store
  auth URLs, badge/level/account
  state helpers, market eligibility, duration control, user-data folder reads,
  app usage events, NAT/logged-on checks, Steam user handle reads, game
  advertisement, legacy game-connection auth blobs, license checks, and ticket
  cancellation, plus auth-ticket validation and Web API ticket response callback
  events.
- Friends: persona name/state, friend enumeration, friend profiles, groups,
  clans, rich presence, coplay, clan chat controls, friend message replies, and
  friend and clan chat reads, source membership helpers, downloadable clan
  activity counts, follower async calls, profile item queries, remaining invite
  overlay helpers, and Friends callback events exposed by the current generated
  bindings.
- Overlay: dialog, user, invite, store, web page, and macOS diagnostic probe
  helpers.
- Apps: subscription/install flags, DLC checks and enumeration, DLC
  install/uninstall/progress helpers, depot listing, build ID, install
  directory, owner, language, launch query/command-line reads, timed trials,
  family sharing, beta enumeration/activation, proof-key requests, and
  content-corrupt marking, file detail checks, and DLC, proof-key,
  file-detail, and timed-trial callback events.
- User stats, achievements, and leaderboards: achievement activate/clear/check/list,
  metadata, progress, local/user/global stat reads and writes, current-player
  count, global achievement percentages, global stat history, leaderboard
  find/create, metadata, score downloads, entry reads, score uploads, and UGC
  attachment, plus stats, achievement, leaderboard, and global-stat callback
  events.
- Remote storage: cloud enablement, file reads/writes/deletes/forget,
  existence and persistence checks, file metadata, sync platform flags, quota,
  file listing, async file reads/writes, file sharing, write streams, cached
  UGC download/progress/details/reads, legacy published-file publish/update,
  detail, enumeration, subscription, vote, action, and video flows,
  local-change enumeration and notifications, and file write batch controls.
- Steam Web API: generic URL building and JSON/text fetch helpers for any
  `interface/method/version` path, supported-API discovery helpers, user stats
  and achievement endpoint helpers, user/profile/license endpoint helpers,
  app/build/server-list/SDR-config helpers, news helpers, directory and content
  server directory helpers, OAuth CloudService file
  enumeration/upload/delete helpers, remote-storage/workshop detail helpers,
  player profile/playtime/library/offline-playtime helpers, store
  app-list/followed-games/recommended-tags service helpers,
  user-auth ticket validation helpers, AuthenticationService
  credential/QR/guard/mobile-confirmation polling helpers, OAuth token-detail
  helpers, CheatReportingService report/game-ban/VAC
  session helpers, public broadcast stats/heartbeat helpers, BroadcastService
  game-data-frame and RTMP-frame helpers, help-request log helpers, wishlist helpers, EconMarketService
  market eligibility/listing/popularity helpers, community abuse-report helpers,
  game-notification session and user-session helpers, game-server account administration and lookup helpers,
  app-specific public client-stats, game-coordinator-version, Portal 2
  leaderboard, and Team Fortress world-status helpers from Valve's supported
  API list,
  published-file service query/moderation/tag/vote-summary helpers, published-item
  search/voting helpers, WorkshopService payment/contributor/revenue/description
  helpers, SiteLicenseService client-connection/playtime helpers, leaderboard
  helpers, GameInventory history/support/item-definition helpers,
  game-server stats export helpers,
  legacy economy/asset helpers, InventoryService item mutation/query helpers,
  EconService trading/cache helpers, and production and sandbox
  MicroTxn/economy transaction helpers through configurable API keys and base
  URLs.
- HTTP: client and game-server request creation, configuration,
  send/stream-send initiation, response header/body reads, progress/timeout
  checks, raw POST bodies, cookie containers, request priority/defer, and HTTP
  request callbacks.
- HTML surface: initialization/shutdown, browser creation/removal, navigation,
  sizing, headers, JavaScript execution, mouse/key input, scroll/focus,
  clipboard/source/find/link helpers, cookies, scale/background/DPI controls,
  developer tools, request/dialog responses, file dialog responses, and HTML
  callback events with structured metadata and paint-buffer delivery.
- Steam Input: init/shutdown, action manifest selection, frame/data polling,
  connected controllers, device and direct action-event callbacks, gamepad
  index mapping, action sets/layers, digital and analog action data/origins/names,
  named digital-action lookups, all-controller and max-controller constants,
  action-event type constants, glyph/string lookups, Xbox-origin translation,
  DualSense trigger-effect forwarding, motion data, haptics, LED controls,
  binding panels, remote-play session IDs, session configuration, controller
  type, deprecated `ISteamController` compatibility helpers, and text input
  helpers.
- Matchmaking/lobbies: favorite/history server storage, lobby list filters,
  create, join, list, leave, member/owner helpers, lobby and member data,
  joinability, lobby type/owner/limit/link controls, lobby chat, lobby
  game-server metadata, invites, invite dialogs, lobby callbacks, lobby create
  and favorite-account update callbacks, one-shot
  matchmaking server browser list, ping, player-detail, and rule queries, plus
  server address/item/filter struct helpers, response callback dispatch
  wrappers, long-lived server-list request handles with details, refresh,
  cancel, state, and release controls.
- Parties: party beacon enumeration/details, location discovery and metadata,
  join/create/change async calls, reservation completion/cancel, destroy, and
  reservation, available-location, and active-beacon update callbacks.
- Inventory: result status/items/properties, serialization/deserialization,
  item generation/promo/consume/exchange/transfer/trade flows, item definition
  reads, eligible promo definition queries, purchase and price requests, dynamic
  property updates, inspect tokens, client and game-server shared interfaces,
  and inventory callbacks.
- Networking: legacy client and game-server `ISteamNetworking` P2P send,
  receive, availability, session accept/close/state, relay controls, and
  legacy socket/listen-socket helpers, modern client and game-server
  `ISteamNetworkingMessages` identity/session/message send and receive flows,
  session/channel close helpers,
  core client and game-server `ISteamNetworkingSockets`
  connection/listen-socket/single and batch
  message/poll-group helpers, custom P2P signaling pointer bridges,
  relay-auth-ticket cache helpers, hosted dedicated connect/listen helpers,
  hosted dedicated address, dev-address, and game coordinator login blobs,
  certificate request/install/reset helpers, fake-IP allocation and listen
  helpers, fake UDP port wrappers, connection lane status details, plus
  `ISteamNetworkingUtils` relay/auth status, ping location, POP latency,
  fake-IP, standalone IP address and identity construction/comparison/getter
  helpers, identity conversion, config value, editable config iteration, direct
  global/connection config setters, structured config setters including pointer
  values, pointer-valued global config setters, direct global callback hooks,
  and debug-output helpers.
- UGC/Workshop: item create/update/query flows, cursor queries, request-details
  calls, query metadata/tags/children/previews/key-value tags/content
  descriptors/game-version data, install/download information, downloaded item
  enumeration, local disable/load-order controls, subscription, favorite, vote,
  playtime tracking, item/app dependency, delete, EULA, content descriptor
  preference, item state, statistics, rich query configuration, client and
  game-server shared interfaces, and UGC callback-event coverage.
- Screenshots: screenshot library writes, screenshot triggers/hooks, location
  and user/published-file tagging, VR screenshot library writes, and screenshot
  callback events.
- Music: playback state, play/pause/previous/next controls, volume helpers,
  Music Remote registration, ability/status/current-entry/queue/playlist update
  helpers, and music and Music Remote callback events.
- Video: video URL/OPF request triggers, OPF string fetches, broadcast
  status/viewer counts, and video/broadcast callback events.
- Parental settings: parental lock state, app block checks, and feature block
  checks, plus parental-settings change callback events.
- Timeline: timeline tooltips, game modes, events, game phases, recording
  existence checks, phase tags/attributes, overlay navigation, and
  recording-existence callback events.
- Remote Play: session enumeration/details, Remote Play Together UI/invites,
  direct input toggles, input polling, mouse visibility/position, custom cursor
  helpers, and session/invite/avatar callback events.
- Game server: Steam game-server lifecycle, callback pumping, secure/Steam ID
  status, Steam game-server user handle reads, header-only interface init,
  deprecated master-server heartbeat controls, server metadata publication,
  login/logoff helpers, auth-session
  ticket helpers, license and group status checks, public IP reads,
  game-socket-share packet helpers, unauthenticated/deprecated user connection
  helpers, user data updates, server reputation, clan association and new-player
  compatibility call results, core game-server callbacks, game-server stats
  request/read/write/store helpers, and game-server HTTP, inventory, UGC,
  legacy networking, networking messages, and networking sockets shared
  interfaces.

## Not Yet Complete

- Remaining modern networking surfaces: field-level parsed relay-auth-ticket
  payloads. `steamworks-sys 0.13` exposes the ticket out-parameter but keeps
  `SteamDatagramRelayAuthTicket` opaque in the bundled headers, so safe
  structured decoding needs a newer SDK surface or a maintained local shim.
- Remaining callback/event ergonomics for interfaces not surfaced by the current
  SDK bindings; generated callback constants are covered by the automated
  coverage audit.
- `ISteamPS3OverlayRenderHost` and `ISteamPS3OverlayRender` are PlayStation 3
  overlay interfaces and are outside Steam Bridge's supported Steam desktop
  targets.
- Additional endpoint-specific Steam Web API convenience wrappers outside
  Valve's current supported public API list, or for partner/private service
  interfaces that are not advertised by `ISteamWebAPIUtil.GetSupportedAPIList`.

Use Valve's SpaceWar App ID `480` for generic local smoke tests. Use your own
Steam app ID for app-specific achievements, stats, inventory, UGC, economy, and
shipping validation.
