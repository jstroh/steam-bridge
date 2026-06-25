# Steam API Coverage

Steam Bridge is expanding toward broad Steamworks client coverage, but it does
not yet expose every Steamworks interface. This document is a contributor map for
what is available today and what still needs work.

The native layer currently targets the Steamworks flat C API through
`steamworks-sys 0.13`.

## Implemented Areas

- Steam lifecycle: initialization, shutdown, callback pumping, restart checks,
  Steam install path, Steam Deck, Big Picture, App ID, and overlay diagnostics.
- User/auth: local Steam ID helpers, Web API auth tickets, session tickets by
  Steam ID or IP, and ticket cancellation.
- Friends: persona name/state, friend enumeration, friend profiles, groups,
  clans, rich presence, coplay, clan chat controls, friend message replies, and
  follower async calls.
- Overlay: dialog, user, invite, store, web page, and macOS diagnostic probe
  helpers.
- Apps: subscription/install flags, DLC checks, build ID, install directory,
  owner, language, and beta name helpers.
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
- Matchmaking/lobbies: create, join, list, leave, member/owner helpers, lobby
  data, joinability, and invite dialogs.
- Parties: party beacon enumeration/details, location discovery and metadata,
  join/create/change async calls, reservation completion/cancel, destroy, and
  reservation callbacks.
- Inventory: result status/items/properties, serialization/deserialization,
  item generation/promo/consume/exchange/transfer/trade flows, item definition
  reads, eligible promo definition queries, purchase and price requests, dynamic
  property updates, inspect tokens, and inventory callbacks.
- Networking: legacy P2P send, receive, availability, session accept/close,
  send-channel close helpers, and modern `ISteamNetworkingMessages`
  identity/session/message send and receive flows.
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

## Not Yet Complete

- Full `ISteamFriends` coverage for buffer-heavy chat reads, profile item APIs,
  and every overlay/social helper.
- `ISteamMusicRemote` is not exposed by the current `steamworks-sys 0.13` macOS
  bindings used by this crate.
- Modern networking interfaces: `ISteamNetworkingSockets` and
  `ISteamNetworkingUtils`.
- Matchmaking server browser and game server APIs.
- Game server, game server stats, and server-only workflows.
- Complete callback/event coverage for every implemented interface, including
  richer streaming HTTP response ergonomics.
- Steam Web API and economy flows beyond client auth ticket helpers.

Use Valve's SpaceWar App ID `480` for generic local smoke tests. Use your own
Steam app ID for app-specific achievements, stats, inventory, UGC, economy, and
shipping validation.
