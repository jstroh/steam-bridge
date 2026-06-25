# Steam API Coverage

Steam Bridge is expanding toward broad Steamworks client coverage, but it does
not yet expose every Steamworks interface. This document is a contributor map for
what is available today and what still needs work.

The native layer currently targets the Steamworks flat C API through
`steamworks-sys 0.13`.

## Implemented Areas

- Steam lifecycle and utils: initialization, shutdown, callback pumping,
  restart checks, Steam install path, Steam Deck, Big Picture, App ID, overlay
  diagnostics, server time, activity timers, connected universe, Steam UI
  language, image reads, battery/IPCCall counts, overlay notification
  placement, VR helpers, China launcher checks, text filtering, IPv6
  connectivity checks, file signature checks, raw APICall inspection, gamepad
  text input helpers, warning hooks, and utility callback events.
- User/auth: local Steam ID helpers, Web API auth tickets, session tickets by
  Steam ID or IP, auth session validation helpers, voice recording/capture and
  decompression, encrypted app tickets, store auth URLs, badge/level/account
  state helpers, market eligibility, duration control, user-data folder reads,
  app usage events, NAT checks, game advertisement, license checks, and ticket
  cancellation.
- Friends: persona name/state, friend enumeration, friend profiles, groups,
  clans, rich presence, coplay, clan chat controls, friend message replies, and
  reads, follower async calls, profile item queries, remaining invite overlay
  helpers, and Friends callback events exposed by the current macOS bindings.
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
  attachment.
- Remote storage: cloud enablement, file reads/writes/deletes, existence checks,
  and file listing.
- HTTP: request creation, configuration, send/stream send initiation, response
  header/body reads, progress/timeout checks, raw POST bodies, cookie
  containers, request priority/defer, and HTTP request callbacks.
- Steam Input: init/shutdown, connected controllers, action sets, digital
  actions, analog vectors, controller type, and text input helpers.
- Matchmaking/lobbies: favorite/history server storage, lobby list filters,
  create, join, list, leave, member/owner helpers, lobby and member data,
  joinability, lobby type/owner/limit/link controls, lobby chat, lobby
  game-server metadata, invites, invite dialogs, and lobby callbacks.
- Parties: party beacon enumeration/details, location discovery and metadata,
  join/create/change async calls, reservation completion/cancel, destroy, and
  reservation callbacks.
- Inventory: result status/items/properties, serialization/deserialization,
  item generation/promo/consume/exchange/transfer/trade flows, item definition
  reads, eligible promo definition queries, purchase and price requests, dynamic
  property updates, inspect tokens, and inventory callbacks.
- Networking: legacy P2P send, receive, availability, session accept/close,
  send-channel close helpers, and modern `ISteamNetworkingMessages`
  identity/session/message send and receive flows, core
  `ISteamNetworkingSockets` connection/listen-socket/message/poll-group
  helpers, relay-auth-ticket cache helpers, hosted dedicated connect/listen
  helpers, hosted dedicated address and game coordinator login blobs,
  certificate request/install/reset helpers, fake-IP allocation and listen
  helpers, fake UDP port wrappers, connection lane status details, plus
  `ISteamNetworkingUtils` relay/auth status, ping location, POP latency,
  fake-IP, IP address, config value, editable config iteration, and
  debug-output helpers.
- UGC/Workshop: item create/update/query flows, install/download information,
  subscription list helpers, item state, statistics, and query configuration.
- Screenshots: screenshot library writes, screenshot triggers/hooks, location
  and user/published-file tagging, and VR screenshot library writes.
- Music: playback state, play/pause/previous/next controls, and volume helpers.
- Video: video URL/OPF request triggers, OPF string fetches, and broadcast
  status/viewer counts.
- Parental settings: parental lock state, app block checks, and feature block
  checks.
- Timeline: timeline tooltips, game modes, events, game phases, recording
  existence checks, phase tags/attributes, and overlay navigation.
- Remote Play: session enumeration/details, Remote Play Together UI/invites,
  direct input toggles, input polling, mouse visibility/position, and custom
  cursor helpers.
- Game server: Steam game-server lifecycle, callback pumping, secure/Steam ID
  status, server metadata publication, login/logoff helpers, auth-session
  ticket helpers, license and group status checks, public IP reads,
  game-socket-share packet helpers, unauthenticated/deprecated user connection
  helpers, and user data updates.

## Not Yet Complete

- Full `ISteamFriends` coverage for any remaining low-use social helpers;
  `SetPersonaNameResponse_t` is not generated by the current
  `steamworks-sys 0.13` macOS bindings used by this crate.
- `ISteamMusicRemote` is not exposed by the current `steamworks-sys 0.13` macOS
  bindings used by this crate.
- Remaining modern networking socket and lower-level networking config/debug
  surfaces: parsed relay-auth-ticket payloads, raw pointer-valued networking
  config callbacks, and custom signaling.
- Matchmaking server browser and game server APIs.
- Game server stats and remaining async server workflows such as reputation,
  clan association, and player compatibility call results.
- Complete callback/event coverage for every implemented interface, including
  richer streaming HTTP response ergonomics.
- Steam Web API and economy flows beyond client auth ticket helpers.

Use Valve's SpaceWar App ID `480` for generic local smoke tests. Use your own
Steam app ID for app-specific achievements, stats, inventory, UGC, economy, and
shipping validation.
