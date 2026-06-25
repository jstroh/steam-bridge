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
- User stats and achievements: achievement activate/clear/check/list plus basic
  stat reads and writes.
- Remote storage: cloud enablement, file reads/writes/deletes, existence checks,
  and file listing.
- Steam Input: init/shutdown, connected controllers, action sets, digital
  actions, analog vectors, controller type, and text input helpers.
- Matchmaking/lobbies: create, join, list, leave, member/owner helpers, lobby
  data, joinability, and invite dialogs.
- Networking: legacy P2P send, receive, availability, session accept/close, and
  send-channel close helpers.
- UGC/Workshop: item create/update/query flows, install/download information,
  subscription list helpers, item state, statistics, and query configuration.
- Screenshots: screenshot library writes, screenshot triggers/hooks, location
  and user/published-file tagging, and VR screenshot library writes.
- Music: playback state, play/pause/previous/next controls, and volume helpers.
- Video: video URL/OPF request triggers, OPF string fetches, and broadcast
  status/viewer counts.
- Parental settings: parental lock state, app block checks, and feature block
  checks.

## Not Yet Complete

- Full `ISteamFriends` coverage for buffer-heavy chat reads, profile item APIs,
  and every overlay/social helper.
- Full stats and leaderboard coverage.
- `ISteamHTTP`, `ISteamInventory`, and `ISteamParties`.
- `ISteamMusicRemote` is not exposed by the current `steamworks-sys 0.13` macOS
  bindings used by this crate.
- Modern networking interfaces: `ISteamNetworkingSockets`,
  `ISteamNetworkingMessages`, and `ISteamNetworkingUtils`.
- Matchmaking server browser and game server APIs.
- Game server, game server stats, and server-only workflows.
- Complete callback/event coverage for every implemented interface.
- Steam Web API and economy flows beyond client auth ticket helpers.

Use Valve's SpaceWar App ID `480` for generic local smoke tests. Use your own
Steam app ID for app-specific achievements, stats, inventory, UGC, economy, and
shipping validation.
