use crate::{
    cancel_auth_ticket, cstring, make_auth_ticket, non_null, run_callbacks, steam_friends,
    steam_id_to_player, steam_user, steam_user_stats, steam_utils, string_from_ptr, AuthTicket,
    CallbackHandle, PlayerSteamId,
};
use napi::bindgen_prelude::{
    BigInt, Buffer, Env, Error, Function, PromiseRaw, Status, ToNapiValue,
};
use napi::threadsafe_function::{ThreadsafeFunction, ThreadsafeFunctionCallMode};
use napi_derive::napi;
use serde_json::Value;
use std::ffi::{c_char, c_void, CStr, CString};
use std::mem::MaybeUninit;
use std::net::IpAddr;
use std::ptr;
use std::sync::atomic::{AtomicU32, Ordering};
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};
use steamworks_sys as sys;
use tokio::sync::oneshot;

const CALLBACK_PERSONA_STATE_CHANGE: i32 = 304;
const CALLBACK_STEAM_SERVERS_CONNECTED: i32 = 101;
const CALLBACK_STEAM_SERVER_CONNECT_FAILURE: i32 = 102;
const CALLBACK_STEAM_SERVERS_DISCONNECTED: i32 = 103;
const CALLBACK_GET_AUTH_SESSION_TICKET_RESPONSE: i32 = 163;
const CALLBACK_GAMEPAD_TEXT_INPUT_DISMISSED: i32 = 714;
const CALLBACK_LOBBY_DATA_UPDATE: i32 = 505;
const CALLBACK_LOBBY_CHAT_UPDATE: i32 = 506;
const CALLBACK_GAME_LOBBY_JOIN_REQUESTED: i32 = 333;
const CALLBACK_P2P_SESSION_REQUEST: i32 = 1202;
const CALLBACK_P2P_SESSION_CONNECT_FAIL: i32 = 1203;
const CALLBACK_STEAM_NET_AUTHENTICATION_STATUS: i32 = 1222;
const CALLBACK_STEAM_NETWORKING_MESSAGES_SESSION_REQUEST: i32 = 1251;
const CALLBACK_STEAM_NETWORKING_MESSAGES_SESSION_FAILED: i32 = 1252;
const CALLBACK_STEAM_RELAY_NETWORK_STATUS: i32 = 1281;
const CALLBACK_HTTP_REQUEST_COMPLETED: i32 = 2101;
const CALLBACK_HTTP_REQUEST_HEADERS_RECEIVED: i32 = 2102;
const CALLBACK_HTTP_REQUEST_DATA_RECEIVED: i32 = 2103;
const CALLBACK_JOIN_PARTY: i32 = 5301;
const CALLBACK_CREATE_BEACON: i32 = 5302;
const CALLBACK_RESERVATION_NOTIFICATION: i32 = 5303;
const CALLBACK_CHANGE_NUM_OPEN_SLOTS: i32 = 5304;
const CALLBACK_STEAM_INVENTORY_RESULT_READY: i32 = 4700;
const CALLBACK_STEAM_INVENTORY_FULL_UPDATE: i32 = 4701;
const CALLBACK_STEAM_INVENTORY_DEFINITION_UPDATE: i32 = 4702;
const CALLBACK_STEAM_INVENTORY_ELIGIBLE_PROMO_ITEM_DEF_IDS: i32 = 4703;
const CALLBACK_STEAM_INVENTORY_START_PURCHASE_RESULT: i32 = 4704;
const CALLBACK_STEAM_INVENTORY_REQUEST_PRICES_RESULT: i32 = 4705;
const H_AUTH_TICKET_INVALID: sys::HAuthTicket = 0;
const DEFAULT_ASYNC_TIMEOUT_SECONDS: u64 = 30;
const LEADERBOARD_DETAILS_MAX: u32 = 64;
const GLOBAL_STAT_HISTORY_MAX: u32 = 10_000;
const PARTY_METADATA_BUFFER_SIZE: usize = 4096;
const FRIEND_FLAG_IMMEDIATE: u32 = 4;

type FatalThreadsafeFunction<T> = ThreadsafeFunction<T, (), Vec<T>, Status, false>;
type JsCallback<'scope, T> = Function<'scope, T, ()>;

fn csteam_id_to_u64(steam_id: sys::CSteamID) -> u64 {
    unsafe { std::mem::transmute::<sys::CSteamID, u64>(steam_id) }
}

fn u64_to_csteam_id(steam_id: u64) -> sys::CSteamID {
    unsafe { std::mem::transmute::<u64, sys::CSteamID>(steam_id) }
}

fn csteam_id_to_player(steam_id: sys::CSteamID) -> PlayerSteamId {
    steam_id_to_player(csteam_id_to_u64(steam_id))
}

#[derive(Debug)]
#[napi(object)]
pub struct CloudFileInfo {
    pub name: String,
    pub size: BigInt,
}

#[derive(Debug)]
#[napi(object)]
pub struct HttpRequestCompleted {
    pub request: u32,
    pub context_value: BigInt,
    pub request_successful: bool,
    pub status_code: u32,
    pub body_size: u32,
}

#[derive(Debug)]
#[napi(object)]
pub struct HttpRequestHeadersReceived {
    pub request: u32,
    pub context_value: BigInt,
}

#[derive(Debug)]
#[napi(object)]
pub struct PartyBeaconLocation {
    pub location_type: u32,
    pub location_id: BigInt,
}

#[derive(Debug)]
#[napi(object)]
pub struct PartyBeaconDetails {
    pub beacon: BigInt,
    pub owner: PlayerSteamId,
    pub location: PartyBeaconLocation,
    pub metadata: String,
}

#[derive(Debug)]
#[napi(object)]
pub struct JoinPartyResult {
    pub result: u32,
    pub beacon: BigInt,
    pub owner: PlayerSteamId,
    pub connect_string: String,
}

#[derive(Debug)]
#[napi(object)]
pub struct CreateBeaconResult {
    pub result: u32,
    pub beacon: BigInt,
}

#[derive(Debug)]
#[napi(object)]
pub struct ChangeNumOpenSlotsResult {
    pub result: u32,
}

#[derive(Debug)]
#[napi(object)]
pub struct InventoryItemDetail {
    pub item_id: BigInt,
    pub definition: i32,
    pub quantity: u32,
    pub flags: u32,
}

#[derive(Debug)]
#[napi(object)]
pub struct InventoryItemQuantity {
    pub definition: i32,
    pub quantity: u32,
}

#[derive(Debug)]
#[napi(object)]
pub struct InventoryInstanceQuantity {
    pub item_id: BigInt,
    pub quantity: u32,
}

#[derive(Debug)]
#[napi(object)]
pub struct InventoryEligiblePromoItemDefIds {
    pub result: u32,
    pub steam_id: PlayerSteamId,
    pub num_eligible_promo_item_defs: i32,
    pub cached_data: bool,
}

#[derive(Debug)]
#[napi(object)]
pub struct InventoryStartPurchaseResult {
    pub result: u32,
    pub order_id: BigInt,
    pub transaction_id: BigInt,
}

#[derive(Debug)]
#[napi(object)]
pub struct InventoryRequestPricesResult {
    pub result: u32,
    pub currency: String,
}

#[derive(Debug)]
#[napi(object)]
pub struct InventoryPrice {
    pub definition: i32,
    pub current_price: BigInt,
    pub base_price: BigInt,
}

#[derive(Debug)]
#[napi(object)]
pub struct AnalogActionVector {
    pub x: f64,
    pub y: f64,
}

#[derive(Debug)]
#[napi(object)]
pub struct InputControllerInfo {
    pub handle: BigInt,
    pub input_type: String,
}

#[napi(object)]
pub struct P2PPacket {
    pub data: Buffer,
    pub size: u32,
    pub steam_id: PlayerSteamId,
}

#[derive(Debug)]
#[napi(object)]
pub struct NetworkingIdentity {
    pub steam_id64: Option<BigInt>,
    pub text: Option<String>,
    pub generic_string: Option<String>,
    pub local_host: Option<bool>,
}

#[derive(Debug)]
#[napi(object)]
pub struct NetworkingIdentityInfo {
    pub identity_type: u32,
    pub text: String,
    pub steam_id64: Option<BigInt>,
    pub generic_string: Option<String>,
    pub local_host: bool,
    pub invalid: bool,
    pub fake_ip_type: u32,
}

#[napi(object)]
pub struct NetworkingMessage {
    pub data: Buffer,
    pub size: u32,
    pub peer: NetworkingIdentityInfo,
    pub connection: u32,
    pub connection_user_data: BigInt,
    pub time_received: BigInt,
    pub message_number: BigInt,
    pub channel: i32,
    pub flags: i32,
    pub user_data: BigInt,
    pub lane: u32,
}

#[derive(Debug)]
#[napi(object)]
pub struct NetworkingConnectionRealTimeStatus {
    pub state: i32,
    pub ping: i32,
    pub connection_quality_local: f64,
    pub connection_quality_remote: f64,
    pub out_packets_per_second: f64,
    pub out_bytes_per_second: f64,
    pub in_packets_per_second: f64,
    pub in_bytes_per_second: f64,
    pub send_rate_bytes_per_second: i32,
    pub pending_unreliable: i32,
    pub pending_reliable: i32,
    pub sent_unacked_reliable: i32,
    pub queue_time: BigInt,
    pub max_jitter: i32,
}

#[derive(Debug)]
#[napi(object)]
pub struct NetworkingMessagesSessionConnectionInfo {
    pub state: i32,
    pub remote_identity: NetworkingIdentityInfo,
    pub user_data: BigInt,
    pub listen_socket: u32,
    pub remote_pop: u32,
    pub relay_pop: u32,
    pub end_reason: i32,
    pub end_debug: String,
    pub connection_description: String,
    pub flags: i32,
    pub quick_status: NetworkingConnectionRealTimeStatus,
}

#[derive(Debug)]
#[napi(object)]
pub struct NetworkingAuthenticationStatus {
    pub availability: i32,
    pub debug_message: String,
}

#[derive(Debug)]
#[napi(object)]
pub struct NetworkingRelayNetworkStatus {
    pub availability: i32,
    pub ping_measurement_in_progress: bool,
    pub network_config_availability: i32,
    pub any_relay_availability: i32,
    pub debug_message: String,
}

#[derive(Debug)]
#[napi(object)]
pub struct NetworkingPingLocation {
    pub location: String,
    pub age_seconds: f64,
}

#[derive(Debug)]
#[napi(object)]
pub struct NetworkingPingDataCenter {
    pub ping_ms: i32,
    pub via_relay_pop: u32,
}

#[derive(Debug)]
#[napi(object)]
pub struct NetworkingIpAddress {
    pub text: Option<String>,
    pub ipv4: Option<u32>,
    pub port: Option<u32>,
    pub local_host: Option<bool>,
}

#[derive(Debug)]
#[napi(object)]
pub struct NetworkingIpAddressInfo {
    pub text: String,
    pub ipv4: Option<u32>,
    pub port: u32,
    pub ipv4_address: Option<String>,
    pub is_ipv4: bool,
    pub is_local_host: bool,
    pub is_fake_ip: bool,
    pub fake_ip_type: u32,
    pub ipv6_all_zeros: bool,
}

#[derive(Debug)]
#[napi(object)]
pub struct NetworkingFakeIpIdentity {
    pub result: u32,
    pub identity: Option<NetworkingIdentityInfo>,
}

#[derive(Debug)]
#[napi(object)]
pub struct LobbyResult {
    pub id: BigInt,
}

#[derive(Debug)]
#[napi(object)]
pub struct WorkshopInstallInfo {
    pub folder: String,
    pub size_on_disk: BigInt,
    pub timestamp: u32,
}

#[derive(Debug)]
#[napi(object)]
pub struct WorkshopDownloadInfo {
    pub current: BigInt,
    pub total: BigInt,
}

#[derive(Debug)]
#[napi(object)]
pub struct UgcResult {
    pub item_id: BigInt,
    pub needs_to_accept_agreement: bool,
}

#[derive(Debug)]
#[napi(object)]
pub struct UpdateProgress {
    pub status: u32,
    pub progress: BigInt,
    pub total: BigInt,
}

#[derive(Debug)]
#[napi(object)]
pub struct WorkshopItem {
    pub published_file_id: BigInt,
    pub creator_app_id: u32,
    pub consumer_app_id: u32,
    pub title: String,
    pub description: String,
    pub owner: PlayerSteamId,
    pub time_created: u32,
    pub time_updated: u32,
    pub time_added_to_user_list: u32,
    pub visibility: u32,
    pub banned: bool,
    pub accepted_for_use: bool,
    pub tags: Vec<String>,
    pub tags_truncated: bool,
    pub url: String,
    pub num_upvotes: u32,
    pub num_downvotes: u32,
    pub num_children: u32,
    pub preview_url: Option<String>,
    pub num_subscriptions: Option<BigInt>,
    pub num_favorites: Option<BigInt>,
    pub num_followers: Option<BigInt>,
    pub num_unique_subscriptions: Option<BigInt>,
    pub num_unique_favorites: Option<BigInt>,
    pub num_unique_followers: Option<BigInt>,
    pub num_unique_website_views: Option<BigInt>,
    pub report_score: Option<BigInt>,
    pub num_seconds_played: Option<BigInt>,
    pub num_playtime_sessions: Option<BigInt>,
    pub num_comments: Option<BigInt>,
    pub num_seconds_played_during_time_period: Option<BigInt>,
    pub num_playtime_sessions_during_time_period: Option<BigInt>,
}

#[derive(Debug)]
#[napi(object)]
pub struct WorkshopItemsResult {
    pub items: Vec<Option<WorkshopItem>>,
    pub returned_results: u32,
    pub total_results: u32,
    pub was_cached: bool,
}

#[derive(Debug)]
#[napi(object)]
pub struct FriendGameInfo {
    pub game_id: BigInt,
    pub game_ip: u32,
    pub game_port: u32,
    pub query_port: u32,
    pub lobby: BigInt,
}

#[derive(Debug)]
#[napi(object)]
pub struct FriendsGroupInfo {
    pub id: i32,
    pub name: String,
    pub members: Vec<PlayerSteamId>,
}

#[derive(Debug)]
#[napi(object)]
pub struct ClanActivityCounts {
    pub online: i32,
    pub in_game: i32,
    pub chatting: i32,
}

#[derive(Debug)]
#[napi(object)]
pub struct ClanOfficerListResult {
    pub clan: PlayerSteamId,
    pub officers: i32,
    pub success: bool,
}

#[derive(Debug)]
#[napi(object)]
pub struct ClanChatJoinResult {
    pub clan_chat: PlayerSteamId,
    pub response: u32,
}

#[derive(Debug)]
#[napi(object)]
pub struct FollowerCountResult {
    pub steam_id: PlayerSteamId,
    pub result: u32,
    pub count: i32,
}

#[derive(Debug)]
#[napi(object)]
pub struct IsFollowingResult {
    pub steam_id: PlayerSteamId,
    pub result: u32,
    pub is_following: bool,
}

#[derive(Debug)]
#[napi(object)]
pub struct FollowingListResult {
    pub result: u32,
    pub steam_ids: Vec<PlayerSteamId>,
    pub returned_results: i32,
    pub total_results: i32,
}

#[derive(Debug)]
#[napi(object)]
pub struct VideoBroadcastStatus {
    pub broadcasting: bool,
    pub viewers: i32,
}

#[derive(Debug)]
#[napi(object)]
pub struct LeaderboardFindResult {
    pub leaderboard: BigInt,
    pub found: bool,
}

#[derive(Debug)]
#[napi(object)]
pub struct LeaderboardEntry {
    pub steam_id: PlayerSteamId,
    pub global_rank: i32,
    pub score: i32,
    pub details: Vec<i32>,
    pub ugc: BigInt,
}

#[derive(Debug)]
#[napi(object)]
pub struct LeaderboardScoresDownloaded {
    pub leaderboard: BigInt,
    pub entries_handle: BigInt,
    pub entry_count: i32,
    pub entries: Vec<LeaderboardEntry>,
}

#[derive(Debug)]
#[napi(object)]
pub struct LeaderboardScoreUploaded {
    pub success: bool,
    pub leaderboard: BigInt,
    pub score: i32,
    pub score_changed: bool,
    pub global_rank_new: i32,
    pub global_rank_previous: i32,
}

#[derive(Debug)]
#[napi(object)]
pub struct LeaderboardUgcSetResult {
    pub result: u32,
    pub leaderboard: BigInt,
}

#[derive(Debug)]
#[napi(object)]
pub struct AchievementUnlockTime {
    pub achieved: bool,
    pub unlock_time: u32,
}

#[derive(Debug)]
#[napi(object)]
pub struct UserStatsReceivedResult {
    pub game_id: BigInt,
    pub result: u32,
    pub steam_id: PlayerSteamId,
}

#[derive(Debug)]
#[napi(object)]
pub struct NumberOfCurrentPlayersResult {
    pub success: bool,
    pub players: i32,
}

#[derive(Debug)]
#[napi(object)]
pub struct GlobalAchievementPercentagesReady {
    pub game_id: BigInt,
    pub result: u32,
}

#[derive(Debug)]
#[napi(object)]
pub struct GlobalStatsReceivedResult {
    pub game_id: BigInt,
    pub result: u32,
}

#[derive(Debug)]
#[napi(object)]
pub struct GlobalAchievementInfo {
    pub iterator: i32,
    pub name: String,
    pub percent: f64,
    pub achieved: bool,
}

#[derive(Debug)]
#[napi(object)]
pub struct AchievementProgressLimitsInt {
    pub min: i32,
    pub max: i32,
}

#[derive(Debug)]
#[napi(object)]
pub struct AchievementProgressLimitsFloat {
    pub min: f64,
    pub max: f64,
}

#[derive(Debug)]
#[napi(object)]
pub struct TimelineEventRecordingExists {
    pub event: BigInt,
    pub recording_exists: bool,
}

#[derive(Debug)]
#[napi(object)]
pub struct TimelineGamePhaseRecordingExists {
    pub phase_id: String,
    pub recording_ms: BigInt,
    pub longest_clip_ms: BigInt,
    pub clip_count: u32,
    pub screenshot_count: u32,
}

#[derive(Debug)]
#[napi(object)]
pub struct RemotePlayResolution {
    pub width: i32,
    pub height: i32,
}

#[derive(Debug)]
#[napi(object)]
pub struct RemotePlaySessionInfo {
    pub id: u32,
    pub remote_play_together: bool,
    pub steam_id: PlayerSteamId,
    pub guest_id: u32,
    pub small_avatar: i32,
    pub medium_avatar: i32,
    pub large_avatar: i32,
    pub client_name: String,
    pub client_form_factor: u32,
    pub resolution: Option<RemotePlayResolution>,
}

#[derive(Debug)]
#[napi(object)]
pub struct RemotePlayInputEvent {
    pub session_id: u32,
    pub input_type: u32,
    pub absolute: Option<bool>,
    pub normalized_x: Option<f64>,
    pub normalized_y: Option<f64>,
    pub delta_x: Option<i32>,
    pub delta_y: Option<i32>,
    pub mouse_button: Option<u32>,
    pub wheel_direction: Option<u32>,
    pub wheel_amount: Option<f64>,
    pub scancode: Option<i32>,
    pub modifiers: Option<u32>,
    pub keycode: Option<u32>,
}

#[napi(js_name = "achievementActivate")]
pub fn achievement_activate(name: String) -> Result<bool, Error> {
    let stats = steam_user_stats()?;
    let name = cstring(name, "achievement name")?;
    Ok(unsafe { sys::SteamAPI_ISteamUserStats_SetAchievement(stats, name.as_ptr()) })
}

#[napi(js_name = "achievementClear")]
pub fn achievement_clear(name: String) -> Result<bool, Error> {
    let stats = steam_user_stats()?;
    let name = cstring(name, "achievement name")?;
    Ok(unsafe { sys::SteamAPI_ISteamUserStats_ClearAchievement(stats, name.as_ptr()) })
}

#[napi(js_name = "achievementNames")]
pub fn achievement_names() -> Result<Vec<String>, Error> {
    let stats = steam_user_stats()?;
    let count = unsafe { sys::SteamAPI_ISteamUserStats_GetNumAchievements(stats) };
    let mut names = Vec::with_capacity(count as usize);
    for index in 0..count {
        let raw = unsafe { sys::SteamAPI_ISteamUserStats_GetAchievementName(stats, index) };
        names.push(string_from_ptr(raw));
    }
    Ok(names)
}

#[napi(js_name = "friendsGetPersonaName")]
pub fn friends_get_persona_name() -> Result<String, Error> {
    let friends = steam_friends()?;
    Ok(string_from_ptr(unsafe {
        sys::SteamAPI_ISteamFriends_GetPersonaName(friends)
    }))
}

#[napi(js_name = "friendsGetPersonaState")]
pub fn friends_get_persona_state() -> Result<u32, Error> {
    let friends = steam_friends()?;
    Ok(unsafe { sys::SteamAPI_ISteamFriends_GetPersonaState(friends) as u32 })
}

#[napi(js_name = "friendsGetFriendCount")]
pub fn friends_get_friend_count(friend_flags: Option<u32>) -> Result<i32, Error> {
    let friends = steam_friends()?;
    Ok(unsafe {
        sys::SteamAPI_ISteamFriends_GetFriendCount(
            friends,
            friend_flags.unwrap_or(FRIEND_FLAG_IMMEDIATE) as i32,
        )
    })
}

#[napi(js_name = "friendsGetFriendByIndex")]
pub fn friends_get_friend_by_index(
    index: i32,
    friend_flags: Option<u32>,
) -> Result<PlayerSteamId, Error> {
    let friends = steam_friends()?;
    let steam_id = unsafe {
        sys::SteamAPI_ISteamFriends_GetFriendByIndex(
            friends,
            index,
            friend_flags.unwrap_or(FRIEND_FLAG_IMMEDIATE) as i32,
        )
    };
    Ok(steam_id_to_player(steam_id))
}

#[napi(js_name = "friendsGetFriends")]
pub fn friends_get_friends(friend_flags: Option<u32>) -> Result<Vec<PlayerSteamId>, Error> {
    let flags = friend_flags.unwrap_or(FRIEND_FLAG_IMMEDIATE);
    let count = friends_get_friend_count(Some(flags))?;
    let mut result = Vec::with_capacity(count.max(0) as usize);
    for index in 0..count {
        result.push(friends_get_friend_by_index(index, Some(flags))?);
    }
    Ok(result)
}

#[napi(js_name = "friendsHasFriend")]
pub fn friends_has_friend(steam_id64: BigInt, friend_flags: Option<u32>) -> Result<bool, Error> {
    let friends = steam_friends()?;
    let steam_id = bigint_to_u64(steam_id64, "steamId64")?;
    Ok(unsafe {
        sys::SteamAPI_ISteamFriends_HasFriend(
            friends,
            steam_id,
            friend_flags.unwrap_or(FRIEND_FLAG_IMMEDIATE) as i32,
        )
    })
}

#[napi(js_name = "friendsGetFriendRelationship")]
pub fn friends_get_friend_relationship(steam_id64: BigInt) -> Result<u32, Error> {
    let friends = steam_friends()?;
    let steam_id = bigint_to_u64(steam_id64, "steamId64")?;
    Ok(unsafe { sys::SteamAPI_ISteamFriends_GetFriendRelationship(friends, steam_id) as u32 })
}

#[napi(js_name = "friendsGetFriendPersonaState")]
pub fn friends_get_friend_persona_state(steam_id64: BigInt) -> Result<u32, Error> {
    let friends = steam_friends()?;
    let steam_id = bigint_to_u64(steam_id64, "steamId64")?;
    Ok(unsafe { sys::SteamAPI_ISteamFriends_GetFriendPersonaState(friends, steam_id) as u32 })
}

#[napi(js_name = "friendsGetFriendPersonaName")]
pub fn friends_get_friend_persona_name(steam_id64: BigInt) -> Result<String, Error> {
    let friends = steam_friends()?;
    let steam_id = bigint_to_u64(steam_id64, "steamId64")?;
    Ok(string_from_ptr(unsafe {
        sys::SteamAPI_ISteamFriends_GetFriendPersonaName(friends, steam_id)
    }))
}

#[napi(js_name = "friendsGetFriendPersonaNameHistory")]
pub fn friends_get_friend_persona_name_history(
    steam_id64: BigInt,
    index: i32,
) -> Result<String, Error> {
    let friends = steam_friends()?;
    let steam_id = bigint_to_u64(steam_id64, "steamId64")?;
    Ok(string_from_ptr(unsafe {
        sys::SteamAPI_ISteamFriends_GetFriendPersonaNameHistory(friends, steam_id, index)
    }))
}

#[napi(js_name = "friendsGetFriendSteamLevel")]
pub fn friends_get_friend_steam_level(steam_id64: BigInt) -> Result<i32, Error> {
    let friends = steam_friends()?;
    let steam_id = bigint_to_u64(steam_id64, "steamId64")?;
    Ok(unsafe { sys::SteamAPI_ISteamFriends_GetFriendSteamLevel(friends, steam_id) })
}

#[napi(js_name = "friendsGetPlayerNickname")]
pub fn friends_get_player_nickname(steam_id64: BigInt) -> Result<String, Error> {
    let friends = steam_friends()?;
    let steam_id = bigint_to_u64(steam_id64, "steamId64")?;
    Ok(string_from_ptr(unsafe {
        sys::SteamAPI_ISteamFriends_GetPlayerNickname(friends, steam_id)
    }))
}

#[napi(js_name = "friendsGetFriendGamePlayed")]
pub fn friends_get_friend_game_played(steam_id64: BigInt) -> Result<Option<FriendGameInfo>, Error> {
    let friends = steam_friends()?;
    let steam_id = bigint_to_u64(steam_id64, "steamId64")?;
    let mut info = MaybeUninit::<sys::FriendGameInfo_t>::zeroed();
    let ok = unsafe {
        sys::SteamAPI_ISteamFriends_GetFriendGamePlayed(friends, steam_id, info.as_mut_ptr())
    };
    if !ok {
        return Ok(None);
    }
    let info = unsafe { info.assume_init() };
    Ok(Some(FriendGameInfo {
        game_id: unsafe { info.m_gameID.__bindgen_anon_1.m_ulGameID }.into(),
        game_ip: info.m_unGameIP,
        game_port: u32::from(info.m_usGamePort),
        query_port: u32::from(info.m_usQueryPort),
        lobby: csteam_id_to_u64(info.m_steamIDLobby).into(),
    }))
}

#[napi(js_name = "friendsGetSmallFriendAvatar")]
pub fn friends_get_small_friend_avatar(steam_id64: BigInt) -> Result<i32, Error> {
    friend_avatar(steam_id64, 0)
}

#[napi(js_name = "friendsGetMediumFriendAvatar")]
pub fn friends_get_medium_friend_avatar(steam_id64: BigInt) -> Result<i32, Error> {
    friend_avatar(steam_id64, 1)
}

#[napi(js_name = "friendsGetLargeFriendAvatar")]
pub fn friends_get_large_friend_avatar(steam_id64: BigInt) -> Result<i32, Error> {
    friend_avatar(steam_id64, 2)
}

fn friend_avatar(steam_id64: BigInt, size: u8) -> Result<i32, Error> {
    let friends = steam_friends()?;
    let steam_id = bigint_to_u64(steam_id64, "steamId64")?;
    Ok(unsafe {
        match size {
            0 => sys::SteamAPI_ISteamFriends_GetSmallFriendAvatar(friends, steam_id),
            1 => sys::SteamAPI_ISteamFriends_GetMediumFriendAvatar(friends, steam_id),
            _ => sys::SteamAPI_ISteamFriends_GetLargeFriendAvatar(friends, steam_id),
        }
    })
}

#[napi(js_name = "friendsRequestUserInformation")]
pub fn friends_request_user_information(
    steam_id64: BigInt,
    name_only: bool,
) -> Result<bool, Error> {
    let friends = steam_friends()?;
    let steam_id = bigint_to_u64(steam_id64, "steamId64")?;
    Ok(unsafe { sys::SteamAPI_ISteamFriends_RequestUserInformation(friends, steam_id, name_only) })
}

#[napi(js_name = "friendsGetFriendsGroups")]
pub fn friends_get_friends_groups() -> Result<Vec<FriendsGroupInfo>, Error> {
    let friends = steam_friends()?;
    let count = unsafe { sys::SteamAPI_ISteamFriends_GetFriendsGroupCount(friends) };
    let mut groups = Vec::with_capacity(count.max(0) as usize);
    for index in 0..count {
        let id = unsafe { sys::SteamAPI_ISteamFriends_GetFriendsGroupIDByIndex(friends, index) };
        let name = string_from_ptr(unsafe {
            sys::SteamAPI_ISteamFriends_GetFriendsGroupName(friends, id)
        });
        let member_count =
            unsafe { sys::SteamAPI_ISteamFriends_GetFriendsGroupMembersCount(friends, id) };
        let mut members = vec![u64_to_csteam_id(0); member_count.max(0) as usize];
        if member_count > 0 {
            unsafe {
                sys::SteamAPI_ISteamFriends_GetFriendsGroupMembersList(
                    friends,
                    id,
                    members.as_mut_ptr(),
                    member_count,
                );
            }
        }
        groups.push(FriendsGroupInfo {
            id: i32::from(id),
            name,
            members: members.into_iter().map(csteam_id_to_player).collect(),
        });
    }
    Ok(groups)
}

#[napi(js_name = "friendsGetClanCount")]
pub fn friends_get_clan_count() -> Result<i32, Error> {
    let friends = steam_friends()?;
    Ok(unsafe { sys::SteamAPI_ISteamFriends_GetClanCount(friends) })
}

#[napi(js_name = "friendsGetClanByIndex")]
pub fn friends_get_clan_by_index(index: i32) -> Result<PlayerSteamId, Error> {
    let friends = steam_friends()?;
    Ok(steam_id_to_player(unsafe {
        sys::SteamAPI_ISteamFriends_GetClanByIndex(friends, index)
    }))
}

#[napi(js_name = "friendsGetClans")]
pub fn friends_get_clans() -> Result<Vec<PlayerSteamId>, Error> {
    let count = friends_get_clan_count()?;
    let mut clans = Vec::with_capacity(count.max(0) as usize);
    for index in 0..count {
        clans.push(friends_get_clan_by_index(index)?);
    }
    Ok(clans)
}

#[napi(js_name = "friendsGetClanName")]
pub fn friends_get_clan_name(clan_id64: BigInt) -> Result<String, Error> {
    let friends = steam_friends()?;
    let clan_id = bigint_to_u64(clan_id64, "clanId64")?;
    Ok(string_from_ptr(unsafe {
        sys::SteamAPI_ISteamFriends_GetClanName(friends, clan_id)
    }))
}

#[napi(js_name = "friendsGetClanTag")]
pub fn friends_get_clan_tag(clan_id64: BigInt) -> Result<String, Error> {
    let friends = steam_friends()?;
    let clan_id = bigint_to_u64(clan_id64, "clanId64")?;
    Ok(string_from_ptr(unsafe {
        sys::SteamAPI_ISteamFriends_GetClanTag(friends, clan_id)
    }))
}

#[napi(js_name = "friendsGetClanActivityCounts")]
pub fn friends_get_clan_activity_counts(
    clan_id64: BigInt,
) -> Result<Option<ClanActivityCounts>, Error> {
    let friends = steam_friends()?;
    let clan_id = bigint_to_u64(clan_id64, "clanId64")?;
    let mut online = 0;
    let mut in_game = 0;
    let mut chatting = 0;
    let ok = unsafe {
        sys::SteamAPI_ISteamFriends_GetClanActivityCounts(
            friends,
            clan_id,
            &mut online,
            &mut in_game,
            &mut chatting,
        )
    };
    Ok(ok.then_some(ClanActivityCounts {
        online,
        in_game,
        chatting,
    }))
}

#[napi(js_name = "friendsRequestClanOfficerList")]
pub async fn friends_request_clan_officer_list(
    clan_id64: BigInt,
) -> Result<ClanOfficerListResult, Error> {
    let friends = steam_friends()?;
    let clan_id = bigint_to_u64(clan_id64, "clanId64")?;
    let call = unsafe { sys::SteamAPI_ISteamFriends_RequestClanOfficerList(friends, clan_id) };
    let result: sys::ClanOfficerListResponse_t = wait_for_api_call(
        call,
        sys::ClanOfficerListResponse_t_k_iCallback as i32,
        DEFAULT_ASYNC_TIMEOUT_SECONDS,
    )
    .await?;
    let clan = unsafe { ptr::addr_of!(result.m_steamIDClan).read_unaligned() };
    let officers = unsafe { ptr::addr_of!(result.m_cOfficers).read_unaligned() };
    let success = unsafe { ptr::addr_of!(result.m_bSuccess).read_unaligned() };
    Ok(ClanOfficerListResult {
        clan: csteam_id_to_player(clan),
        officers,
        success: success != 0,
    })
}

#[napi(js_name = "friendsGetClanOwner")]
pub fn friends_get_clan_owner(clan_id64: BigInt) -> Result<PlayerSteamId, Error> {
    let friends = steam_friends()?;
    let clan_id = bigint_to_u64(clan_id64, "clanId64")?;
    Ok(steam_id_to_player(unsafe {
        sys::SteamAPI_ISteamFriends_GetClanOwner(friends, clan_id)
    }))
}

#[napi(js_name = "friendsGetClanOfficerCount")]
pub fn friends_get_clan_officer_count(clan_id64: BigInt) -> Result<i32, Error> {
    let friends = steam_friends()?;
    let clan_id = bigint_to_u64(clan_id64, "clanId64")?;
    Ok(unsafe { sys::SteamAPI_ISteamFriends_GetClanOfficerCount(friends, clan_id) })
}

#[napi(js_name = "friendsGetClanOfficerByIndex")]
pub fn friends_get_clan_officer_by_index(
    clan_id64: BigInt,
    index: i32,
) -> Result<PlayerSteamId, Error> {
    let friends = steam_friends()?;
    let clan_id = bigint_to_u64(clan_id64, "clanId64")?;
    Ok(steam_id_to_player(unsafe {
        sys::SteamAPI_ISteamFriends_GetClanOfficerByIndex(friends, clan_id, index)
    }))
}

#[napi(js_name = "friendsSetPlayedWith")]
pub fn friends_set_played_with(steam_id64: BigInt) -> Result<(), Error> {
    let friends = steam_friends()?;
    let steam_id = bigint_to_u64(steam_id64, "steamId64")?;
    unsafe { sys::SteamAPI_ISteamFriends_SetPlayedWith(friends, steam_id) };
    Ok(())
}

#[napi(js_name = "friendsSetInGameVoiceSpeaking")]
pub fn friends_set_in_game_voice_speaking(steam_id64: BigInt, speaking: bool) -> Result<(), Error> {
    let friends = steam_friends()?;
    let steam_id = bigint_to_u64(steam_id64, "steamId64")?;
    unsafe { sys::SteamAPI_ISteamFriends_SetInGameVoiceSpeaking(friends, steam_id, speaking) };
    Ok(())
}

#[napi(js_name = "friendsClearRichPresence")]
pub fn friends_clear_rich_presence() -> Result<(), Error> {
    let friends = steam_friends()?;
    unsafe { sys::SteamAPI_ISteamFriends_ClearRichPresence(friends) };
    Ok(())
}

#[napi(js_name = "friendsGetFriendRichPresence")]
pub fn friends_get_friend_rich_presence(steam_id64: BigInt, key: String) -> Result<String, Error> {
    let friends = steam_friends()?;
    let steam_id = bigint_to_u64(steam_id64, "steamId64")?;
    let key = cstring(key, "rich presence key")?;
    Ok(string_from_ptr(unsafe {
        sys::SteamAPI_ISteamFriends_GetFriendRichPresence(friends, steam_id, key.as_ptr())
    }))
}

#[napi(js_name = "friendsGetFriendRichPresenceKeys")]
pub fn friends_get_friend_rich_presence_keys(steam_id64: BigInt) -> Result<Vec<String>, Error> {
    let friends = steam_friends()?;
    let steam_id = bigint_to_u64(steam_id64, "steamId64")?;
    let count =
        unsafe { sys::SteamAPI_ISteamFriends_GetFriendRichPresenceKeyCount(friends, steam_id) };
    let mut keys = Vec::with_capacity(count.max(0) as usize);
    for index in 0..count {
        keys.push(string_from_ptr(unsafe {
            sys::SteamAPI_ISteamFriends_GetFriendRichPresenceKeyByIndex(friends, steam_id, index)
        }));
    }
    Ok(keys)
}

#[napi(js_name = "friendsRequestFriendRichPresence")]
pub fn friends_request_friend_rich_presence(steam_id64: BigInt) -> Result<(), Error> {
    let friends = steam_friends()?;
    let steam_id = bigint_to_u64(steam_id64, "steamId64")?;
    unsafe { sys::SteamAPI_ISteamFriends_RequestFriendRichPresence(friends, steam_id) };
    Ok(())
}

#[napi(js_name = "friendsInviteUserToGame")]
pub fn friends_invite_user_to_game(
    steam_id64: BigInt,
    connect_string: String,
) -> Result<bool, Error> {
    let friends = steam_friends()?;
    let steam_id = bigint_to_u64(steam_id64, "steamId64")?;
    let connect_string = cstring(connect_string, "connect string")?;
    Ok(unsafe {
        sys::SteamAPI_ISteamFriends_InviteUserToGame(friends, steam_id, connect_string.as_ptr())
    })
}

#[napi(js_name = "friendsGetCoplayFriendCount")]
pub fn friends_get_coplay_friend_count() -> Result<i32, Error> {
    let friends = steam_friends()?;
    Ok(unsafe { sys::SteamAPI_ISteamFriends_GetCoplayFriendCount(friends) })
}

#[napi(js_name = "friendsGetCoplayFriend")]
pub fn friends_get_coplay_friend(index: i32) -> Result<PlayerSteamId, Error> {
    let friends = steam_friends()?;
    Ok(steam_id_to_player(unsafe {
        sys::SteamAPI_ISteamFriends_GetCoplayFriend(friends, index)
    }))
}

#[napi(js_name = "friendsGetCoplayFriends")]
pub fn friends_get_coplay_friends() -> Result<Vec<PlayerSteamId>, Error> {
    let count = friends_get_coplay_friend_count()?;
    let mut friends_list = Vec::with_capacity(count.max(0) as usize);
    for index in 0..count {
        friends_list.push(friends_get_coplay_friend(index)?);
    }
    Ok(friends_list)
}

#[napi(js_name = "friendsGetFriendCoplayTime")]
pub fn friends_get_friend_coplay_time(steam_id64: BigInt) -> Result<i32, Error> {
    let friends = steam_friends()?;
    let steam_id = bigint_to_u64(steam_id64, "steamId64")?;
    Ok(unsafe { sys::SteamAPI_ISteamFriends_GetFriendCoplayTime(friends, steam_id) })
}

#[napi(js_name = "friendsGetFriendCoplayGame")]
pub fn friends_get_friend_coplay_game(steam_id64: BigInt) -> Result<u32, Error> {
    let friends = steam_friends()?;
    let steam_id = bigint_to_u64(steam_id64, "steamId64")?;
    Ok(unsafe { sys::SteamAPI_ISteamFriends_GetFriendCoplayGame(friends, steam_id) })
}

#[napi(js_name = "friendsJoinClanChatRoom")]
pub async fn friends_join_clan_chat_room(clan_id64: BigInt) -> Result<ClanChatJoinResult, Error> {
    let friends = steam_friends()?;
    let clan_id = bigint_to_u64(clan_id64, "clanId64")?;
    let call = unsafe { sys::SteamAPI_ISteamFriends_JoinClanChatRoom(friends, clan_id) };
    let result: sys::JoinClanChatRoomCompletionResult_t = wait_for_api_call(
        call,
        sys::JoinClanChatRoomCompletionResult_t_k_iCallback as i32,
        DEFAULT_ASYNC_TIMEOUT_SECONDS,
    )
    .await?;
    let clan_chat = unsafe { ptr::addr_of!(result.m_steamIDClanChat).read_unaligned() };
    let response = unsafe { ptr::addr_of!(result.m_eChatRoomEnterResponse).read_unaligned() };
    Ok(ClanChatJoinResult {
        clan_chat: csteam_id_to_player(clan_chat),
        response: response as u32,
    })
}

#[napi(js_name = "friendsLeaveClanChatRoom")]
pub fn friends_leave_clan_chat_room(clan_id64: BigInt) -> Result<bool, Error> {
    let friends = steam_friends()?;
    let clan_id = bigint_to_u64(clan_id64, "clanId64")?;
    Ok(unsafe { sys::SteamAPI_ISteamFriends_LeaveClanChatRoom(friends, clan_id) })
}

#[napi(js_name = "friendsGetClanChatMemberCount")]
pub fn friends_get_clan_chat_member_count(clan_chat_id64: BigInt) -> Result<i32, Error> {
    let friends = steam_friends()?;
    let clan_chat_id = bigint_to_u64(clan_chat_id64, "clanChatId64")?;
    Ok(unsafe { sys::SteamAPI_ISteamFriends_GetClanChatMemberCount(friends, clan_chat_id) })
}

#[napi(js_name = "friendsGetChatMemberByIndex")]
pub fn friends_get_chat_member_by_index(
    clan_chat_id64: BigInt,
    index: i32,
) -> Result<PlayerSteamId, Error> {
    let friends = steam_friends()?;
    let clan_chat_id = bigint_to_u64(clan_chat_id64, "clanChatId64")?;
    Ok(steam_id_to_player(unsafe {
        sys::SteamAPI_ISteamFriends_GetChatMemberByIndex(friends, clan_chat_id, index)
    }))
}

#[napi(js_name = "friendsSendClanChatMessage")]
pub fn friends_send_clan_chat_message(clan_chat_id64: BigInt, text: String) -> Result<bool, Error> {
    let friends = steam_friends()?;
    let clan_chat_id = bigint_to_u64(clan_chat_id64, "clanChatId64")?;
    let text = cstring(text, "chat message")?;
    Ok(unsafe {
        sys::SteamAPI_ISteamFriends_SendClanChatMessage(friends, clan_chat_id, text.as_ptr())
    })
}

#[napi(js_name = "friendsIsClanChatAdmin")]
pub fn friends_is_clan_chat_admin(
    clan_chat_id64: BigInt,
    steam_id64: BigInt,
) -> Result<bool, Error> {
    let friends = steam_friends()?;
    let clan_chat_id = bigint_to_u64(clan_chat_id64, "clanChatId64")?;
    let steam_id = bigint_to_u64(steam_id64, "steamId64")?;
    Ok(unsafe { sys::SteamAPI_ISteamFriends_IsClanChatAdmin(friends, clan_chat_id, steam_id) })
}

#[napi(js_name = "friendsIsClanChatWindowOpenInSteam")]
pub fn friends_is_clan_chat_window_open_in_steam(clan_chat_id64: BigInt) -> Result<bool, Error> {
    let friends = steam_friends()?;
    let clan_chat_id = bigint_to_u64(clan_chat_id64, "clanChatId64")?;
    Ok(unsafe { sys::SteamAPI_ISteamFriends_IsClanChatWindowOpenInSteam(friends, clan_chat_id) })
}

#[napi(js_name = "friendsOpenClanChatWindowInSteam")]
pub fn friends_open_clan_chat_window_in_steam(clan_chat_id64: BigInt) -> Result<bool, Error> {
    let friends = steam_friends()?;
    let clan_chat_id = bigint_to_u64(clan_chat_id64, "clanChatId64")?;
    Ok(unsafe { sys::SteamAPI_ISteamFriends_OpenClanChatWindowInSteam(friends, clan_chat_id) })
}

#[napi(js_name = "friendsCloseClanChatWindowInSteam")]
pub fn friends_close_clan_chat_window_in_steam(clan_chat_id64: BigInt) -> Result<bool, Error> {
    let friends = steam_friends()?;
    let clan_chat_id = bigint_to_u64(clan_chat_id64, "clanChatId64")?;
    Ok(unsafe { sys::SteamAPI_ISteamFriends_CloseClanChatWindowInSteam(friends, clan_chat_id) })
}

#[napi(js_name = "friendsSetListenForFriendsMessages")]
pub fn friends_set_listen_for_friends_messages(enabled: bool) -> Result<bool, Error> {
    let friends = steam_friends()?;
    Ok(unsafe { sys::SteamAPI_ISteamFriends_SetListenForFriendsMessages(friends, enabled) })
}

#[napi(js_name = "friendsReplyToFriendMessage")]
pub fn friends_reply_to_friend_message(steam_id64: BigInt, message: String) -> Result<bool, Error> {
    let friends = steam_friends()?;
    let steam_id = bigint_to_u64(steam_id64, "steamId64")?;
    let message = cstring(message, "friend message")?;
    Ok(unsafe {
        sys::SteamAPI_ISteamFriends_ReplyToFriendMessage(friends, steam_id, message.as_ptr())
    })
}

#[napi(js_name = "friendsGetFollowerCount")]
pub async fn friends_get_follower_count(steam_id64: BigInt) -> Result<FollowerCountResult, Error> {
    let friends = steam_friends()?;
    let steam_id = bigint_to_u64(steam_id64, "steamId64")?;
    let call = unsafe { sys::SteamAPI_ISteamFriends_GetFollowerCount(friends, steam_id) };
    let result: sys::FriendsGetFollowerCount_t = wait_for_api_call(
        call,
        sys::FriendsGetFollowerCount_t_k_iCallback as i32,
        DEFAULT_ASYNC_TIMEOUT_SECONDS,
    )
    .await?;
    let eresult = unsafe { ptr::addr_of!(result.m_eResult).read_unaligned() };
    let steam_id = unsafe { ptr::addr_of!(result.m_steamID).read_unaligned() };
    let count = unsafe { ptr::addr_of!(result.m_nCount).read_unaligned() };
    Ok(FollowerCountResult {
        steam_id: csteam_id_to_player(steam_id),
        result: eresult as u32,
        count,
    })
}

#[napi(js_name = "friendsIsFollowing")]
pub async fn friends_is_following(steam_id64: BigInt) -> Result<IsFollowingResult, Error> {
    let friends = steam_friends()?;
    let steam_id = bigint_to_u64(steam_id64, "steamId64")?;
    let call = unsafe { sys::SteamAPI_ISteamFriends_IsFollowing(friends, steam_id) };
    let result: sys::FriendsIsFollowing_t = wait_for_api_call(
        call,
        sys::FriendsIsFollowing_t_k_iCallback as i32,
        DEFAULT_ASYNC_TIMEOUT_SECONDS,
    )
    .await?;
    let eresult = unsafe { ptr::addr_of!(result.m_eResult).read_unaligned() };
    let steam_id = unsafe { ptr::addr_of!(result.m_steamID).read_unaligned() };
    let is_following = unsafe { ptr::addr_of!(result.m_bIsFollowing).read_unaligned() };
    Ok(IsFollowingResult {
        steam_id: csteam_id_to_player(steam_id),
        result: eresult as u32,
        is_following,
    })
}

#[napi(js_name = "friendsEnumerateFollowingList")]
pub async fn friends_enumerate_following_list(
    start_index: u32,
) -> Result<FollowingListResult, Error> {
    let friends = steam_friends()?;
    let call = unsafe { sys::SteamAPI_ISteamFriends_EnumerateFollowingList(friends, start_index) };
    let result: sys::FriendsEnumerateFollowingList_t = wait_for_api_call(
        call,
        sys::FriendsEnumerateFollowingList_t_k_iCallback as i32,
        DEFAULT_ASYNC_TIMEOUT_SECONDS,
    )
    .await?;
    let eresult = unsafe { ptr::addr_of!(result.m_eResult).read_unaligned() };
    let returned = unsafe { ptr::addr_of!(result.m_nResultsReturned).read_unaligned() };
    let total = unsafe { ptr::addr_of!(result.m_nTotalResultCount).read_unaligned() };
    let mut steam_ids = Vec::with_capacity(returned.max(0) as usize);
    let returned_len = returned.clamp(0, result.m_rgSteamID.len() as i32) as usize;
    for index in 0..returned_len {
        steam_ids.push(csteam_id_to_player(result.m_rgSteamID[index]));
    }
    Ok(FollowingListResult {
        result: eresult as u32,
        steam_ids,
        returned_results: returned,
        total_results: total,
    })
}

#[napi(js_name = "friendsIsClanPublic")]
pub fn friends_is_clan_public(clan_id64: BigInt) -> Result<bool, Error> {
    let friends = steam_friends()?;
    let clan_id = bigint_to_u64(clan_id64, "clanId64")?;
    Ok(unsafe { sys::SteamAPI_ISteamFriends_IsClanPublic(friends, clan_id) })
}

#[napi(js_name = "friendsIsClanOfficialGameGroup")]
pub fn friends_is_clan_official_game_group(clan_id64: BigInt) -> Result<bool, Error> {
    let friends = steam_friends()?;
    let clan_id = bigint_to_u64(clan_id64, "clanId64")?;
    Ok(unsafe { sys::SteamAPI_ISteamFriends_IsClanOfficialGameGroup(friends, clan_id) })
}

#[napi(js_name = "friendsGetNumChatsWithUnreadPriorityMessages")]
pub fn friends_get_num_chats_with_unread_priority_messages() -> Result<i32, Error> {
    let friends = steam_friends()?;
    Ok(unsafe { sys::SteamAPI_ISteamFriends_GetNumChatsWithUnreadPriorityMessages(friends) })
}

#[napi(js_name = "friendsRegisterProtocolInOverlayBrowser")]
pub fn friends_register_protocol_in_overlay_browser(protocol: String) -> Result<bool, Error> {
    let friends = steam_friends()?;
    let protocol = cstring(protocol, "overlay browser protocol")?;
    Ok(unsafe {
        sys::SteamAPI_ISteamFriends_RegisterProtocolInOverlayBrowser(friends, protocol.as_ptr())
    })
}

#[napi(js_name = "appsIsSubscribedApp")]
pub fn apps_is_subscribed_app(app_id: u32) -> Result<bool, Error> {
    Ok(unsafe { sys::SteamAPI_ISteamApps_BIsSubscribedApp(steam_apps()?, app_id) })
}

#[napi(js_name = "appsIsAppInstalled")]
pub fn apps_is_app_installed(app_id: u32) -> Result<bool, Error> {
    Ok(unsafe { sys::SteamAPI_ISteamApps_BIsAppInstalled(steam_apps()?, app_id) })
}

#[napi(js_name = "appsIsDlcInstalled")]
pub fn apps_is_dlc_installed(app_id: u32) -> Result<bool, Error> {
    Ok(unsafe { sys::SteamAPI_ISteamApps_BIsDlcInstalled(steam_apps()?, app_id) })
}

#[napi(js_name = "appsIsSubscribedFromFreeWeekend")]
pub fn apps_is_subscribed_from_free_weekend() -> Result<bool, Error> {
    Ok(unsafe { sys::SteamAPI_ISteamApps_BIsSubscribedFromFreeWeekend(steam_apps()?) })
}

#[napi(js_name = "appsIsVacBanned")]
pub fn apps_is_vac_banned() -> Result<bool, Error> {
    Ok(unsafe { sys::SteamAPI_ISteamApps_BIsVACBanned(steam_apps()?) })
}

#[napi(js_name = "appsIsCybercafe")]
pub fn apps_is_cybercafe() -> Result<bool, Error> {
    Ok(unsafe { sys::SteamAPI_ISteamApps_BIsCybercafe(steam_apps()?) })
}

#[napi(js_name = "appsIsLowViolence")]
pub fn apps_is_low_violence() -> Result<bool, Error> {
    Ok(unsafe { sys::SteamAPI_ISteamApps_BIsLowViolence(steam_apps()?) })
}

#[napi(js_name = "appsIsSubscribed")]
pub fn apps_is_subscribed() -> Result<bool, Error> {
    Ok(unsafe { sys::SteamAPI_ISteamApps_BIsSubscribed(steam_apps()?) })
}

#[napi(js_name = "appsAppBuildId")]
pub fn apps_app_build_id() -> Result<i32, Error> {
    Ok(unsafe { sys::SteamAPI_ISteamApps_GetAppBuildId(steam_apps()?) })
}

#[napi(js_name = "appsAppInstallDir")]
pub fn apps_app_install_dir(app_id: u32) -> Result<String, Error> {
    let apps = steam_apps()?;
    let mut buf = vec![0i8; 4096];
    let len = unsafe {
        sys::SteamAPI_ISteamApps_GetAppInstallDir(apps, app_id, buf.as_mut_ptr(), buf.len() as u32)
    };
    if len == 0 {
        Ok(String::new())
    } else {
        Ok(unsafe { CStr::from_ptr(buf.as_ptr()) }
            .to_string_lossy()
            .into_owned())
    }
}

#[napi(js_name = "appsAppOwner")]
pub fn apps_app_owner() -> Result<PlayerSteamId, Error> {
    let steam_id = unsafe { sys::SteamAPI_ISteamApps_GetAppOwner(steam_apps()?) };
    Ok(steam_id_to_player(steam_id))
}

#[napi(js_name = "appsAvailableGameLanguages")]
pub fn apps_available_game_languages() -> Result<Vec<String>, Error> {
    let langs = unsafe { sys::SteamAPI_ISteamApps_GetAvailableGameLanguages(steam_apps()?) };
    Ok(string_from_ptr(langs)
        .split(',')
        .filter(|value| !value.is_empty())
        .map(ToOwned::to_owned)
        .collect())
}

#[napi(js_name = "appsCurrentGameLanguage")]
pub fn apps_current_game_language() -> Result<String, Error> {
    Ok(string_from_ptr(unsafe {
        sys::SteamAPI_ISteamApps_GetCurrentGameLanguage(steam_apps()?)
    }))
}

#[napi(js_name = "appsCurrentBetaName")]
pub fn apps_current_beta_name() -> Result<Option<String>, Error> {
    let apps = steam_apps()?;
    let mut buf = vec![0i8; 256];
    let ok = unsafe {
        sys::SteamAPI_ISteamApps_GetCurrentBetaName(apps, buf.as_mut_ptr(), buf.len() as i32)
    };
    if ok {
        Ok(Some(
            unsafe { CStr::from_ptr(buf.as_ptr()) }
                .to_string_lossy()
                .into_owned(),
        ))
    } else {
        Ok(None)
    }
}

#[napi(js_name = "localplayerGetName")]
pub fn localplayer_get_name() -> Result<String, Error> {
    Ok(string_from_ptr(unsafe {
        sys::SteamAPI_ISteamFriends_GetPersonaName(steam_friends()?)
    }))
}

#[napi(js_name = "localplayerGetLevel")]
pub fn localplayer_get_level() -> Result<i32, Error> {
    Ok(unsafe { sys::SteamAPI_ISteamUser_GetPlayerSteamLevel(steam_user()?) })
}

#[napi(js_name = "localplayerGetIpCountry")]
pub fn localplayer_get_ip_country() -> Result<String, Error> {
    Ok(string_from_ptr(unsafe {
        sys::SteamAPI_ISteamUtils_GetIPCountry(steam_utils()?)
    }))
}

#[napi(js_name = "localplayerSetRichPresence")]
pub fn localplayer_set_rich_presence(key: String, value: Option<String>) -> Result<(), Error> {
    let friends = steam_friends()?;
    let key = cstring(key, "rich presence key")?;
    let value = cstring(value.unwrap_or_default(), "rich presence value")?;
    let ok = unsafe {
        sys::SteamAPI_ISteamFriends_SetRichPresence(friends, key.as_ptr(), value.as_ptr())
    };
    if ok {
        Ok(())
    } else {
        Err(Error::from_reason("Steam rejected rich presence update"))
    }
}

#[napi(js_name = "cloudIsEnabledForAccount")]
pub fn cloud_is_enabled_for_account() -> Result<bool, Error> {
    Ok(unsafe {
        sys::SteamAPI_ISteamRemoteStorage_IsCloudEnabledForAccount(steam_remote_storage()?)
    })
}

#[napi(js_name = "cloudIsEnabledForApp")]
pub fn cloud_is_enabled_for_app() -> Result<bool, Error> {
    Ok(unsafe { sys::SteamAPI_ISteamRemoteStorage_IsCloudEnabledForApp(steam_remote_storage()?) })
}

#[napi(js_name = "cloudSetEnabledForApp")]
pub fn cloud_set_enabled_for_app(enabled: bool) -> Result<(), Error> {
    unsafe {
        sys::SteamAPI_ISteamRemoteStorage_SetCloudEnabledForApp(steam_remote_storage()?, enabled)
    };
    Ok(())
}

#[napi(js_name = "cloudReadFile")]
pub fn cloud_read_file(name: String) -> Result<String, Error> {
    let storage = steam_remote_storage()?;
    let name = cstring(name, "cloud file name")?;
    let size = unsafe { sys::SteamAPI_ISteamRemoteStorage_GetFileSize(storage, name.as_ptr()) };
    if size < 0 {
        return Err(Error::from_reason("Steam Cloud file does not exist"));
    }
    let mut bytes = vec![0u8; size as usize];
    let read = unsafe {
        sys::SteamAPI_ISteamRemoteStorage_FileRead(
            storage,
            name.as_ptr(),
            bytes.as_mut_ptr().cast::<c_void>(),
            size,
        )
    };
    if read < 0 {
        return Err(Error::from_reason("Steam Cloud file read failed"));
    }
    bytes.truncate(read as usize);
    String::from_utf8(bytes).map_err(|err| Error::from_reason(err.to_string()))
}

#[napi(js_name = "cloudWriteFile")]
pub fn cloud_write_file(name: String, content: String) -> Result<bool, Error> {
    let storage = steam_remote_storage()?;
    let name = cstring(name, "cloud file name")?;
    Ok(unsafe {
        sys::SteamAPI_ISteamRemoteStorage_FileWrite(
            storage,
            name.as_ptr(),
            content.as_ptr().cast::<c_void>(),
            content.len() as i32,
        )
    })
}

#[napi(js_name = "cloudDeleteFile")]
pub fn cloud_delete_file(name: String) -> Result<bool, Error> {
    let name = cstring(name, "cloud file name")?;
    Ok(unsafe {
        sys::SteamAPI_ISteamRemoteStorage_FileDelete(steam_remote_storage()?, name.as_ptr())
    })
}

#[napi(js_name = "cloudFileExists")]
pub fn cloud_file_exists(name: String) -> Result<bool, Error> {
    let name = cstring(name, "cloud file name")?;
    Ok(unsafe {
        sys::SteamAPI_ISteamRemoteStorage_FileExists(steam_remote_storage()?, name.as_ptr())
    })
}

#[napi(js_name = "cloudListFiles")]
pub fn cloud_list_files() -> Result<Vec<CloudFileInfo>, Error> {
    let storage = steam_remote_storage()?;
    let count = unsafe { sys::SteamAPI_ISteamRemoteStorage_GetFileCount(storage) };
    let mut files = Vec::new();
    for index in 0..count {
        let mut size = 0i32;
        let name = unsafe {
            sys::SteamAPI_ISteamRemoteStorage_GetFileNameAndSize(storage, index, &mut size)
        };
        if !name.is_null() {
            files.push(CloudFileInfo {
                name: string_from_ptr(name),
                size: (size.max(0) as u64).into(),
            });
        }
    }
    Ok(files)
}

#[napi(js_name = "httpCreateRequest")]
pub fn http_create_request(method: u32, url: String) -> Result<u32, Error> {
    let url = cstring(url, "HTTP URL")?;
    let request = unsafe {
        sys::SteamAPI_ISteamHTTP_CreateHTTPRequest(
            steam_http()?,
            http_method_from_u32(method)?,
            url.as_ptr(),
        )
    };
    if request == sys::INVALID_HTTPREQUEST_HANDLE {
        Err(Error::from_reason(
            "Steam returned an invalid HTTP request handle",
        ))
    } else {
        Ok(request)
    }
}

#[napi(js_name = "httpSetContextValue")]
pub fn http_set_context_value(request: u32, context_value: BigInt) -> Result<bool, Error> {
    Ok(unsafe {
        sys::SteamAPI_ISteamHTTP_SetHTTPRequestContextValue(
            steam_http()?,
            request,
            bigint_to_u64(context_value, "HTTP context value")?,
        )
    })
}

#[napi(js_name = "httpSetNetworkActivityTimeout")]
pub fn http_set_network_activity_timeout(
    request: u32,
    timeout_seconds: u32,
) -> Result<bool, Error> {
    Ok(unsafe {
        sys::SteamAPI_ISteamHTTP_SetHTTPRequestNetworkActivityTimeout(
            steam_http()?,
            request,
            timeout_seconds,
        )
    })
}

#[napi(js_name = "httpSetHeaderValue")]
pub fn http_set_header_value(request: u32, name: String, value: String) -> Result<bool, Error> {
    let name = cstring(name, "HTTP header name")?;
    let value = cstring(value, "HTTP header value")?;
    Ok(unsafe {
        sys::SteamAPI_ISteamHTTP_SetHTTPRequestHeaderValue(
            steam_http()?,
            request,
            name.as_ptr(),
            value.as_ptr(),
        )
    })
}

#[napi(js_name = "httpSetGetOrPostParameter")]
pub fn http_set_get_or_post_parameter(
    request: u32,
    name: String,
    value: String,
) -> Result<bool, Error> {
    let name = cstring(name, "HTTP parameter name")?;
    let value = cstring(value, "HTTP parameter value")?;
    Ok(unsafe {
        sys::SteamAPI_ISteamHTTP_SetHTTPRequestGetOrPostParameter(
            steam_http()?,
            request,
            name.as_ptr(),
            value.as_ptr(),
        )
    })
}

#[napi(js_name = "httpSendRequest")]
pub async fn http_send_request(
    request: u32,
    timeout_seconds: Option<u32>,
) -> Result<HttpRequestCompleted, Error> {
    let mut call = 0u64;
    let ok = unsafe { sys::SteamAPI_ISteamHTTP_SendHTTPRequest(steam_http()?, request, &mut call) };
    if !ok {
        return Err(Error::from_reason("Steam rejected the HTTP request send"));
    }
    let result: sys::HTTPRequestCompleted_t = wait_for_api_call(
        call,
        sys::HTTPRequestCompleted_t_k_iCallback as i32,
        timeout_seconds
            .map(u64::from)
            .unwrap_or(DEFAULT_ASYNC_TIMEOUT_SECONDS)
            .max(1),
    )
    .await?;
    Ok(http_request_completed_result(&result))
}

#[napi(js_name = "httpSendRequestAndStreamResponse")]
pub async fn http_send_request_and_stream_response(
    request: u32,
    timeout_seconds: Option<u32>,
) -> Result<HttpRequestHeadersReceived, Error> {
    let mut call = 0u64;
    let ok = unsafe {
        sys::SteamAPI_ISteamHTTP_SendHTTPRequestAndStreamResponse(steam_http()?, request, &mut call)
    };
    if !ok {
        return Err(Error::from_reason(
            "Steam rejected the streaming HTTP request send",
        ));
    }
    let result: sys::HTTPRequestHeadersReceived_t = wait_for_api_call(
        call,
        sys::HTTPRequestHeadersReceived_t_k_iCallback as i32,
        timeout_seconds
            .map(u64::from)
            .unwrap_or(DEFAULT_ASYNC_TIMEOUT_SECONDS)
            .max(1),
    )
    .await?;
    Ok(http_request_headers_received_result(&result))
}

#[napi(js_name = "httpDeferRequest")]
pub fn http_defer_request(request: u32) -> Result<bool, Error> {
    Ok(unsafe { sys::SteamAPI_ISteamHTTP_DeferHTTPRequest(steam_http()?, request) })
}

#[napi(js_name = "httpPrioritizeRequest")]
pub fn http_prioritize_request(request: u32) -> Result<bool, Error> {
    Ok(unsafe { sys::SteamAPI_ISteamHTTP_PrioritizeHTTPRequest(steam_http()?, request) })
}

#[napi(js_name = "httpGetResponseHeaderSize")]
pub fn http_get_response_header_size(request: u32, name: String) -> Result<Option<u32>, Error> {
    let name = cstring(name, "HTTP header name")?;
    let mut size = 0u32;
    let ok = unsafe {
        sys::SteamAPI_ISteamHTTP_GetHTTPResponseHeaderSize(
            steam_http()?,
            request,
            name.as_ptr(),
            &mut size,
        )
    };
    Ok(ok.then_some(size))
}

#[napi(js_name = "httpGetResponseHeaderValue")]
pub fn http_get_response_header_value(request: u32, name: String) -> Result<Option<String>, Error> {
    let Some(size) = http_get_response_header_size(request, name.clone())? else {
        return Ok(None);
    };
    let name = cstring(name, "HTTP header name")?;
    let mut bytes = vec![0u8; size as usize];
    let ok = unsafe {
        sys::SteamAPI_ISteamHTTP_GetHTTPResponseHeaderValue(
            steam_http()?,
            request,
            name.as_ptr(),
            bytes.as_mut_ptr(),
            size,
        )
    };
    Ok(ok.then(|| u8_buf_to_string(&bytes)))
}

#[napi(js_name = "httpGetResponseBodySize")]
pub fn http_get_response_body_size(request: u32) -> Result<Option<u32>, Error> {
    let mut size = 0u32;
    let ok = unsafe {
        sys::SteamAPI_ISteamHTTP_GetHTTPResponseBodySize(steam_http()?, request, &mut size)
    };
    Ok(ok.then_some(size))
}

#[napi(js_name = "httpGetResponseBodyData")]
pub fn http_get_response_body_data(request: u32) -> Result<Option<Buffer>, Error> {
    let Some(size) = http_get_response_body_size(request)? else {
        return Ok(None);
    };
    let mut bytes = vec![0u8; size as usize];
    let ok = unsafe {
        sys::SteamAPI_ISteamHTTP_GetHTTPResponseBodyData(
            steam_http()?,
            request,
            bytes.as_mut_ptr(),
            size,
        )
    };
    Ok(ok.then(|| bytes.into()))
}

#[napi(js_name = "httpGetStreamingResponseBodyData")]
pub fn http_get_streaming_response_body_data(
    request: u32,
    offset: u32,
    size: u32,
) -> Result<Option<Buffer>, Error> {
    let mut bytes = vec![0u8; size as usize];
    let ok = unsafe {
        sys::SteamAPI_ISteamHTTP_GetHTTPStreamingResponseBodyData(
            steam_http()?,
            request,
            offset,
            bytes.as_mut_ptr(),
            size,
        )
    };
    Ok(ok.then(|| bytes.into()))
}

#[napi(js_name = "httpReleaseRequest")]
pub fn http_release_request(request: u32) -> Result<bool, Error> {
    Ok(unsafe { sys::SteamAPI_ISteamHTTP_ReleaseHTTPRequest(steam_http()?, request) })
}

#[napi(js_name = "httpGetDownloadProgressPercent")]
pub fn http_get_download_progress_percent(request: u32) -> Result<Option<f64>, Error> {
    let mut percent = 0.0f32;
    let ok = unsafe {
        sys::SteamAPI_ISteamHTTP_GetHTTPDownloadProgressPct(steam_http()?, request, &mut percent)
    };
    Ok(ok.then_some(f64::from(percent)))
}

#[napi(js_name = "httpSetRawPostBody")]
pub fn http_set_raw_post_body(
    request: u32,
    content_type: String,
    body: Buffer,
) -> Result<bool, Error> {
    if body.len() > u32::MAX as usize {
        return Err(Error::from_reason("HTTP body is larger than Steam accepts"));
    }
    let content_type = cstring(content_type, "HTTP content type")?;
    Ok(unsafe {
        sys::SteamAPI_ISteamHTTP_SetHTTPRequestRawPostBody(
            steam_http()?,
            request,
            content_type.as_ptr(),
            body.as_ptr() as *mut u8,
            body.len() as u32,
        )
    })
}

#[napi(js_name = "httpCreateCookieContainer")]
pub fn http_create_cookie_container(allow_responses_to_modify: bool) -> Result<u32, Error> {
    let container = unsafe {
        sys::SteamAPI_ISteamHTTP_CreateCookieContainer(steam_http()?, allow_responses_to_modify)
    };
    if container == sys::INVALID_HTTPCOOKIE_HANDLE {
        Err(Error::from_reason(
            "Steam returned an invalid HTTP cookie container handle",
        ))
    } else {
        Ok(container)
    }
}

#[napi(js_name = "httpReleaseCookieContainer")]
pub fn http_release_cookie_container(container: u32) -> Result<bool, Error> {
    Ok(unsafe { sys::SteamAPI_ISteamHTTP_ReleaseCookieContainer(steam_http()?, container) })
}

#[napi(js_name = "httpSetCookie")]
pub fn http_set_cookie(
    container: u32,
    host: String,
    url: String,
    cookie: String,
) -> Result<bool, Error> {
    let host = cstring(host, "HTTP cookie host")?;
    let url = cstring(url, "HTTP cookie URL")?;
    let cookie = cstring(cookie, "HTTP cookie")?;
    Ok(unsafe {
        sys::SteamAPI_ISteamHTTP_SetCookie(
            steam_http()?,
            container,
            host.as_ptr(),
            url.as_ptr(),
            cookie.as_ptr(),
        )
    })
}

#[napi(js_name = "httpSetRequestCookieContainer")]
pub fn http_set_request_cookie_container(request: u32, container: u32) -> Result<bool, Error> {
    Ok(unsafe {
        sys::SteamAPI_ISteamHTTP_SetHTTPRequestCookieContainer(steam_http()?, request, container)
    })
}

#[napi(js_name = "httpSetUserAgentInfo")]
pub fn http_set_user_agent_info(request: u32, user_agent: String) -> Result<bool, Error> {
    let user_agent = cstring(user_agent, "HTTP user agent")?;
    Ok(unsafe {
        sys::SteamAPI_ISteamHTTP_SetHTTPRequestUserAgentInfo(
            steam_http()?,
            request,
            user_agent.as_ptr(),
        )
    })
}

#[napi(js_name = "httpSetRequiresVerifiedCertificate")]
pub fn http_set_requires_verified_certificate(
    request: u32,
    require_verified_certificate: bool,
) -> Result<bool, Error> {
    Ok(unsafe {
        sys::SteamAPI_ISteamHTTP_SetHTTPRequestRequiresVerifiedCertificate(
            steam_http()?,
            request,
            require_verified_certificate,
        )
    })
}

#[napi(js_name = "httpSetAbsoluteTimeoutMs")]
pub fn http_set_absolute_timeout_ms(request: u32, timeout_ms: u32) -> Result<bool, Error> {
    Ok(unsafe {
        sys::SteamAPI_ISteamHTTP_SetHTTPRequestAbsoluteTimeoutMS(steam_http()?, request, timeout_ms)
    })
}

#[napi(js_name = "httpGetRequestWasTimedOut")]
pub fn http_get_request_was_timed_out(request: u32) -> Result<Option<bool>, Error> {
    let mut timed_out = false;
    let ok = unsafe {
        sys::SteamAPI_ISteamHTTP_GetHTTPRequestWasTimedOut(steam_http()?, request, &mut timed_out)
    };
    Ok(ok.then_some(timed_out))
}

#[napi(js_name = "partiesGetNumActiveBeacons")]
pub fn parties_get_num_active_beacons() -> Result<u32, Error> {
    Ok(unsafe { sys::SteamAPI_ISteamParties_GetNumActiveBeacons(steam_parties()?) })
}

#[napi(js_name = "partiesGetBeaconByIndex")]
pub fn parties_get_beacon_by_index(index: u32) -> Result<Option<BigInt>, Error> {
    let beacon = unsafe { sys::SteamAPI_ISteamParties_GetBeaconByIndex(steam_parties()?, index) };
    Ok((beacon != sys::k_ulPartyBeaconIdInvalid).then_some(beacon.into()))
}

#[napi(js_name = "partiesGetActiveBeacons")]
pub fn parties_get_active_beacons() -> Result<Vec<BigInt>, Error> {
    let parties = steam_parties()?;
    let count = unsafe { sys::SteamAPI_ISteamParties_GetNumActiveBeacons(parties) };
    let mut beacons = Vec::with_capacity(count as usize);
    for index in 0..count {
        let beacon = unsafe { sys::SteamAPI_ISteamParties_GetBeaconByIndex(parties, index) };
        if beacon != sys::k_ulPartyBeaconIdInvalid {
            beacons.push(beacon.into());
        }
    }
    Ok(beacons)
}

#[napi(js_name = "partiesGetBeaconDetails")]
pub fn parties_get_beacon_details(beacon: BigInt) -> Result<Option<PartyBeaconDetails>, Error> {
    let beacon = bigint_to_u64(beacon, "party beacon")?;
    let mut owner = MaybeUninit::<sys::CSteamID>::zeroed();
    let mut location = MaybeUninit::<sys::SteamPartyBeaconLocation_t>::zeroed();
    let mut metadata = [0i8; PARTY_METADATA_BUFFER_SIZE];
    let ok = unsafe {
        sys::SteamAPI_ISteamParties_GetBeaconDetails(
            steam_parties()?,
            beacon,
            owner.as_mut_ptr(),
            location.as_mut_ptr(),
            metadata.as_mut_ptr(),
            metadata.len() as i32,
        )
    };
    if !ok {
        return Ok(None);
    }
    Ok(Some(PartyBeaconDetails {
        beacon: beacon.into(),
        owner: csteam_id_to_player(unsafe { owner.assume_init() }),
        location: party_beacon_location(unsafe { location.assume_init() }),
        metadata: c_buf_to_string(&metadata),
    }))
}

#[napi(js_name = "partiesJoinParty")]
pub async fn parties_join_party(
    beacon: BigInt,
    timeout_seconds: Option<u32>,
) -> Result<JoinPartyResult, Error> {
    let call = unsafe {
        sys::SteamAPI_ISteamParties_JoinParty(
            steam_parties()?,
            bigint_to_u64(beacon, "party beacon")?,
        )
    };
    let result: sys::JoinPartyCallback_t = wait_for_api_call(
        call,
        sys::JoinPartyCallback_t_k_iCallback as i32,
        timeout_seconds
            .map(u64::from)
            .unwrap_or(DEFAULT_ASYNC_TIMEOUT_SECONDS)
            .max(1),
    )
    .await?;
    Ok(join_party_result(&result))
}

#[napi(js_name = "partiesGetNumAvailableBeaconLocations")]
pub fn parties_get_num_available_beacon_locations() -> Result<Option<u32>, Error> {
    let mut count = 0u32;
    let ok = unsafe {
        sys::SteamAPI_ISteamParties_GetNumAvailableBeaconLocations(steam_parties()?, &mut count)
    };
    Ok(ok.then_some(count))
}

#[napi(js_name = "partiesGetAvailableBeaconLocations")]
pub fn parties_get_available_beacon_locations(
    max_locations: Option<u32>,
) -> Result<Vec<PartyBeaconLocation>, Error> {
    let parties = steam_parties()?;
    let mut available_count = 0u32;
    let ok = unsafe {
        sys::SteamAPI_ISteamParties_GetNumAvailableBeaconLocations(parties, &mut available_count)
    };
    if !ok || available_count == 0 {
        return Ok(Vec::new());
    }
    let count = max_locations
        .filter(|max_locations| *max_locations > 0)
        .map(|max_locations| max_locations.min(available_count))
        .unwrap_or(available_count);
    if count == 0 {
        return Ok(Vec::new());
    }
    let mut locations =
        vec![
            unsafe { MaybeUninit::<sys::SteamPartyBeaconLocation_t>::zeroed().assume_init() };
            count as usize
        ];
    let ok = unsafe {
        sys::SteamAPI_ISteamParties_GetAvailableBeaconLocations(
            parties,
            locations.as_mut_ptr(),
            count,
        )
    };
    if !ok {
        return Ok(Vec::new());
    }
    Ok(locations.into_iter().map(party_beacon_location).collect())
}

#[napi(js_name = "partiesCreateBeacon")]
pub async fn parties_create_beacon(
    open_slots: u32,
    location: PartyBeaconLocation,
    connect_string: String,
    metadata: String,
    timeout_seconds: Option<u32>,
) -> Result<CreateBeaconResult, Error> {
    let connect_string = cstring(connect_string, "party connect string")?;
    let metadata = cstring(metadata, "party metadata")?;
    let mut location = party_beacon_location_to_sys(location)?;
    let call = unsafe {
        sys::SteamAPI_ISteamParties_CreateBeacon(
            steam_parties()?,
            open_slots,
            &mut location,
            connect_string.as_ptr(),
            metadata.as_ptr(),
        )
    };
    let result: sys::CreateBeaconCallback_t = wait_for_api_call(
        call,
        sys::CreateBeaconCallback_t_k_iCallback as i32,
        timeout_seconds
            .map(u64::from)
            .unwrap_or(DEFAULT_ASYNC_TIMEOUT_SECONDS)
            .max(1),
    )
    .await?;
    Ok(create_beacon_result(&result))
}

#[napi(js_name = "partiesOnReservationCompleted")]
pub fn parties_on_reservation_completed(beacon: BigInt, steam_id64: BigInt) -> Result<(), Error> {
    unsafe {
        sys::SteamAPI_ISteamParties_OnReservationCompleted(
            steam_parties()?,
            bigint_to_u64(beacon, "party beacon")?,
            bigint_to_u64(steam_id64, "steamId64")?,
        );
    }
    Ok(())
}

#[napi(js_name = "partiesCancelReservation")]
pub fn parties_cancel_reservation(beacon: BigInt, steam_id64: BigInt) -> Result<(), Error> {
    unsafe {
        sys::SteamAPI_ISteamParties_CancelReservation(
            steam_parties()?,
            bigint_to_u64(beacon, "party beacon")?,
            bigint_to_u64(steam_id64, "steamId64")?,
        );
    }
    Ok(())
}

#[napi(js_name = "partiesChangeNumOpenSlots")]
pub async fn parties_change_num_open_slots(
    beacon: BigInt,
    open_slots: u32,
    timeout_seconds: Option<u32>,
) -> Result<ChangeNumOpenSlotsResult, Error> {
    let call = unsafe {
        sys::SteamAPI_ISteamParties_ChangeNumOpenSlots(
            steam_parties()?,
            bigint_to_u64(beacon, "party beacon")?,
            open_slots,
        )
    };
    let result: sys::ChangeNumOpenSlotsCallback_t = wait_for_api_call(
        call,
        sys::ChangeNumOpenSlotsCallback_t_k_iCallback as i32,
        timeout_seconds
            .map(u64::from)
            .unwrap_or(DEFAULT_ASYNC_TIMEOUT_SECONDS)
            .max(1),
    )
    .await?;
    Ok(ChangeNumOpenSlotsResult {
        result: unsafe { ptr::addr_of!(result.m_eResult).read_unaligned() } as u32,
    })
}

#[napi(js_name = "partiesDestroyBeacon")]
pub fn parties_destroy_beacon(beacon: BigInt) -> Result<bool, Error> {
    Ok(unsafe {
        sys::SteamAPI_ISteamParties_DestroyBeacon(
            steam_parties()?,
            bigint_to_u64(beacon, "party beacon")?,
        )
    })
}

#[napi(js_name = "partiesGetBeaconLocationData")]
pub fn parties_get_beacon_location_data(
    location: PartyBeaconLocation,
    data: u32,
) -> Result<Option<String>, Error> {
    let mut output = [0i8; PARTY_METADATA_BUFFER_SIZE];
    let ok = unsafe {
        sys::SteamAPI_ISteamParties_GetBeaconLocationData(
            steam_parties()?,
            party_beacon_location_to_sys(location)?,
            party_beacon_location_data_from_u32(data)?,
            output.as_mut_ptr(),
            output.len() as i32,
        )
    };
    Ok(ok.then(|| c_buf_to_string(&output)))
}

#[napi(js_name = "inventoryGetResultStatus")]
pub fn inventory_get_result_status(result_handle: i32) -> Result<u32, Error> {
    Ok(unsafe {
        sys::SteamAPI_ISteamInventory_GetResultStatus(steam_inventory()?, result_handle) as u32
    })
}

#[napi(js_name = "inventoryGetResultItems")]
pub fn inventory_get_result_items(
    result_handle: i32,
) -> Result<Option<Vec<InventoryItemDetail>>, Error> {
    let inventory = steam_inventory()?;
    let mut count = 0u32;
    let ok = unsafe {
        sys::SteamAPI_ISteamInventory_GetResultItems(
            inventory,
            result_handle,
            ptr::null_mut(),
            &mut count,
        )
    };
    if !ok {
        return Ok(None);
    }
    if count == 0 {
        return Ok(Some(Vec::new()));
    }
    let mut items = vec![
        unsafe { MaybeUninit::<sys::SteamItemDetails_t>::zeroed().assume_init() };
        count as usize
    ];
    let ok = unsafe {
        sys::SteamAPI_ISteamInventory_GetResultItems(
            inventory,
            result_handle,
            items.as_mut_ptr(),
            &mut count,
        )
    };
    if !ok {
        return Ok(None);
    }
    items.truncate(count as usize);
    Ok(Some(items.into_iter().map(inventory_item_detail).collect()))
}

#[napi(js_name = "inventoryGetResultItemProperty")]
pub fn inventory_get_result_item_property(
    result_handle: i32,
    item_index: u32,
    property_name: Option<String>,
) -> Result<Option<String>, Error> {
    inventory_get_item_property_string(
        result_handle,
        item_index,
        property_name,
        "inventory result item property",
    )
}

#[napi(js_name = "inventoryGetResultTimestamp")]
pub fn inventory_get_result_timestamp(result_handle: i32) -> Result<u32, Error> {
    Ok(unsafe {
        sys::SteamAPI_ISteamInventory_GetResultTimestamp(steam_inventory()?, result_handle)
    })
}

#[napi(js_name = "inventoryCheckResultSteamId")]
pub fn inventory_check_result_steam_id(
    result_handle: i32,
    steam_id64: BigInt,
) -> Result<bool, Error> {
    Ok(unsafe {
        sys::SteamAPI_ISteamInventory_CheckResultSteamID(
            steam_inventory()?,
            result_handle,
            bigint_to_u64(steam_id64, "steamId64")?,
        )
    })
}

#[napi(js_name = "inventoryDestroyResult")]
pub fn inventory_destroy_result(result_handle: i32) -> Result<(), Error> {
    unsafe { sys::SteamAPI_ISteamInventory_DestroyResult(steam_inventory()?, result_handle) };
    Ok(())
}

#[napi(js_name = "inventoryGetAllItems")]
pub fn inventory_get_all_items() -> Result<Option<i32>, Error> {
    let mut result_handle = sys::k_SteamInventoryResultInvalid;
    let ok = unsafe {
        sys::SteamAPI_ISteamInventory_GetAllItems(steam_inventory()?, &mut result_handle)
    };
    Ok(inventory_result_handle(ok, result_handle))
}

#[napi(js_name = "inventoryGetItemsById")]
pub fn inventory_get_items_by_id(instance_ids: Vec<BigInt>) -> Result<Option<i32>, Error> {
    let ids = bigints_to_u64s(instance_ids, "inventory item id")?;
    let mut result_handle = sys::k_SteamInventoryResultInvalid;
    let ok = unsafe {
        sys::SteamAPI_ISteamInventory_GetItemsByID(
            steam_inventory()?,
            &mut result_handle,
            ids.as_ptr(),
            len_to_u32(ids.len(), "inventory item ids")?,
        )
    };
    Ok(inventory_result_handle(ok, result_handle))
}

#[napi(js_name = "inventorySerializeResult")]
pub fn inventory_serialize_result(result_handle: i32) -> Result<Option<Buffer>, Error> {
    let inventory = steam_inventory()?;
    let mut size = 0u32;
    let ok = unsafe {
        sys::SteamAPI_ISteamInventory_SerializeResult(
            inventory,
            result_handle,
            ptr::null_mut(),
            &mut size,
        )
    };
    if !ok {
        return Ok(None);
    }
    let mut bytes = vec![0u8; size as usize];
    let ok = unsafe {
        sys::SteamAPI_ISteamInventory_SerializeResult(
            inventory,
            result_handle,
            bytes.as_mut_ptr().cast::<c_void>(),
            &mut size,
        )
    };
    if !ok {
        return Ok(None);
    }
    bytes.truncate(size as usize);
    Ok(Some(bytes.into()))
}

#[napi(js_name = "inventoryDeserializeResult")]
pub fn inventory_deserialize_result(data: Buffer) -> Result<Option<i32>, Error> {
    let mut result_handle = sys::k_SteamInventoryResultInvalid;
    let ok = unsafe {
        sys::SteamAPI_ISteamInventory_DeserializeResult(
            steam_inventory()?,
            &mut result_handle,
            data.as_ptr().cast::<c_void>(),
            len_to_u32(data.len(), "serialized inventory result")?,
            false,
        )
    };
    Ok(inventory_result_handle(ok, result_handle))
}

#[napi(js_name = "inventoryGenerateItems")]
pub fn inventory_generate_items(items: Vec<InventoryItemQuantity>) -> Result<Option<i32>, Error> {
    let (defs, quantities) = inventory_definition_quantities(items);
    let mut result_handle = sys::k_SteamInventoryResultInvalid;
    let ok = unsafe {
        sys::SteamAPI_ISteamInventory_GenerateItems(
            steam_inventory()?,
            &mut result_handle,
            defs.as_ptr(),
            quantities.as_ptr(),
            len_to_u32(defs.len(), "inventory item definitions")?,
        )
    };
    Ok(inventory_result_handle(ok, result_handle))
}

#[napi(js_name = "inventoryGrantPromoItems")]
pub fn inventory_grant_promo_items() -> Result<Option<i32>, Error> {
    let mut result_handle = sys::k_SteamInventoryResultInvalid;
    let ok = unsafe {
        sys::SteamAPI_ISteamInventory_GrantPromoItems(steam_inventory()?, &mut result_handle)
    };
    Ok(inventory_result_handle(ok, result_handle))
}

#[napi(js_name = "inventoryAddPromoItem")]
pub fn inventory_add_promo_item(definition: i32) -> Result<Option<i32>, Error> {
    let mut result_handle = sys::k_SteamInventoryResultInvalid;
    let ok = unsafe {
        sys::SteamAPI_ISteamInventory_AddPromoItem(
            steam_inventory()?,
            &mut result_handle,
            definition,
        )
    };
    Ok(inventory_result_handle(ok, result_handle))
}

#[napi(js_name = "inventoryAddPromoItems")]
pub fn inventory_add_promo_items(definitions: Vec<i32>) -> Result<Option<i32>, Error> {
    let mut result_handle = sys::k_SteamInventoryResultInvalid;
    let ok = unsafe {
        sys::SteamAPI_ISteamInventory_AddPromoItems(
            steam_inventory()?,
            &mut result_handle,
            definitions.as_ptr(),
            len_to_u32(definitions.len(), "inventory item definitions")?,
        )
    };
    Ok(inventory_result_handle(ok, result_handle))
}

#[napi(js_name = "inventoryConsumeItem")]
pub fn inventory_consume_item(item_id: BigInt, quantity: u32) -> Result<Option<i32>, Error> {
    let mut result_handle = sys::k_SteamInventoryResultInvalid;
    let ok = unsafe {
        sys::SteamAPI_ISteamInventory_ConsumeItem(
            steam_inventory()?,
            &mut result_handle,
            bigint_to_u64(item_id, "inventory item id")?,
            quantity,
        )
    };
    Ok(inventory_result_handle(ok, result_handle))
}

#[napi(js_name = "inventoryExchangeItems")]
pub fn inventory_exchange_items(
    generate: Vec<InventoryItemQuantity>,
    destroy: Vec<InventoryInstanceQuantity>,
) -> Result<Option<i32>, Error> {
    let (generate_defs, generate_quantities) = inventory_definition_quantities(generate);
    let (destroy_ids, destroy_quantities) = inventory_instance_quantities(destroy)?;
    let mut result_handle = sys::k_SteamInventoryResultInvalid;
    let ok = unsafe {
        sys::SteamAPI_ISteamInventory_ExchangeItems(
            steam_inventory()?,
            &mut result_handle,
            generate_defs.as_ptr(),
            generate_quantities.as_ptr(),
            len_to_u32(generate_defs.len(), "generated inventory item definitions")?,
            destroy_ids.as_ptr(),
            destroy_quantities.as_ptr(),
            len_to_u32(destroy_ids.len(), "destroyed inventory item ids")?,
        )
    };
    Ok(inventory_result_handle(ok, result_handle))
}

#[napi(js_name = "inventoryTransferItemQuantity")]
pub fn inventory_transfer_item_quantity(
    source_item_id: BigInt,
    quantity: u32,
    destination_item_id: Option<BigInt>,
) -> Result<Option<i32>, Error> {
    let mut result_handle = sys::k_SteamInventoryResultInvalid;
    let destination = match destination_item_id {
        Some(destination) => bigint_to_u64(destination, "destination inventory item id")?,
        None => unsafe { sys::k_SteamItemInstanceIDInvalid },
    };
    let ok = unsafe {
        sys::SteamAPI_ISteamInventory_TransferItemQuantity(
            steam_inventory()?,
            &mut result_handle,
            bigint_to_u64(source_item_id, "source inventory item id")?,
            quantity,
            destination,
        )
    };
    Ok(inventory_result_handle(ok, result_handle))
}

#[napi(js_name = "inventorySendItemDropHeartbeat")]
pub fn inventory_send_item_drop_heartbeat() -> Result<(), Error> {
    unsafe { sys::SteamAPI_ISteamInventory_SendItemDropHeartbeat(steam_inventory()?) };
    Ok(())
}

#[napi(js_name = "inventoryTriggerItemDrop")]
pub fn inventory_trigger_item_drop(drop_list_definition: i32) -> Result<Option<i32>, Error> {
    let mut result_handle = sys::k_SteamInventoryResultInvalid;
    let ok = unsafe {
        sys::SteamAPI_ISteamInventory_TriggerItemDrop(
            steam_inventory()?,
            &mut result_handle,
            drop_list_definition,
        )
    };
    Ok(inventory_result_handle(ok, result_handle))
}

#[napi(js_name = "inventoryTradeItems")]
pub fn inventory_trade_items(
    trade_partner_steam_id64: BigInt,
    give: Vec<InventoryInstanceQuantity>,
    get: Vec<InventoryInstanceQuantity>,
) -> Result<Option<i32>, Error> {
    let (give_ids, give_quantities) = inventory_instance_quantities(give)?;
    let (get_ids, get_quantities) = inventory_instance_quantities(get)?;
    let mut result_handle = sys::k_SteamInventoryResultInvalid;
    let ok = unsafe {
        sys::SteamAPI_ISteamInventory_TradeItems(
            steam_inventory()?,
            &mut result_handle,
            bigint_to_u64(trade_partner_steam_id64, "trade partner steamId64")?,
            give_ids.as_ptr(),
            give_quantities.as_ptr(),
            len_to_u32(give_ids.len(), "inventory items to give")?,
            get_ids.as_ptr(),
            get_quantities.as_ptr(),
            len_to_u32(get_ids.len(), "inventory items to receive")?,
        )
    };
    Ok(inventory_result_handle(ok, result_handle))
}

#[napi(js_name = "inventoryLoadItemDefinitions")]
pub fn inventory_load_item_definitions() -> Result<bool, Error> {
    Ok(unsafe { sys::SteamAPI_ISteamInventory_LoadItemDefinitions(steam_inventory()?) })
}

#[napi(js_name = "inventoryGetItemDefinitionIds")]
pub fn inventory_get_item_definition_ids() -> Result<Vec<i32>, Error> {
    let inventory = steam_inventory()?;
    let mut count = 0u32;
    let ok = unsafe {
        sys::SteamAPI_ISteamInventory_GetItemDefinitionIDs(inventory, ptr::null_mut(), &mut count)
    };
    if !ok || count == 0 {
        return Ok(Vec::new());
    }
    let mut definitions = vec![0i32; count as usize];
    let ok = unsafe {
        sys::SteamAPI_ISteamInventory_GetItemDefinitionIDs(
            inventory,
            definitions.as_mut_ptr(),
            &mut count,
        )
    };
    if !ok {
        return Ok(Vec::new());
    }
    definitions.truncate(count as usize);
    Ok(definitions)
}

#[napi(js_name = "inventoryGetItemDefinitionProperty")]
pub fn inventory_get_item_definition_property(
    definition: i32,
    property_name: Option<String>,
) -> Result<Option<String>, Error> {
    inventory_get_definition_property_string(definition, property_name)
}

#[napi(js_name = "inventoryRequestEligiblePromoItemDefinitionIds")]
pub async fn inventory_request_eligible_promo_item_definition_ids(
    steam_id64: BigInt,
    timeout_seconds: Option<u32>,
) -> Result<InventoryEligiblePromoItemDefIds, Error> {
    let call = unsafe {
        sys::SteamAPI_ISteamInventory_RequestEligiblePromoItemDefinitionsIDs(
            steam_inventory()?,
            bigint_to_u64(steam_id64, "steamId64")?,
        )
    };
    let result: sys::SteamInventoryEligiblePromoItemDefIDs_t = wait_for_api_call(
        call,
        sys::SteamInventoryEligiblePromoItemDefIDs_t_k_iCallback as i32,
        timeout_seconds
            .map(u64::from)
            .unwrap_or(DEFAULT_ASYNC_TIMEOUT_SECONDS)
            .max(1),
    )
    .await?;
    Ok(inventory_eligible_promo_result(&result))
}

#[napi(js_name = "inventoryGetEligiblePromoItemDefinitionIds")]
pub fn inventory_get_eligible_promo_item_definition_ids(
    steam_id64: BigInt,
) -> Result<Vec<i32>, Error> {
    let inventory = steam_inventory()?;
    let steam_id = bigint_to_u64(steam_id64, "steamId64")?;
    let mut count = 0u32;
    let ok = unsafe {
        sys::SteamAPI_ISteamInventory_GetEligiblePromoItemDefinitionIDs(
            inventory,
            steam_id,
            ptr::null_mut(),
            &mut count,
        )
    };
    if !ok || count == 0 {
        return Ok(Vec::new());
    }
    let mut definitions = vec![0i32; count as usize];
    let ok = unsafe {
        sys::SteamAPI_ISteamInventory_GetEligiblePromoItemDefinitionIDs(
            inventory,
            steam_id,
            definitions.as_mut_ptr(),
            &mut count,
        )
    };
    if !ok {
        return Ok(Vec::new());
    }
    definitions.truncate(count as usize);
    Ok(definitions)
}

#[napi(js_name = "inventoryStartPurchase")]
pub async fn inventory_start_purchase(
    items: Vec<InventoryItemQuantity>,
    timeout_seconds: Option<u32>,
) -> Result<InventoryStartPurchaseResult, Error> {
    let (defs, quantities) = inventory_definition_quantities(items);
    let call = unsafe {
        sys::SteamAPI_ISteamInventory_StartPurchase(
            steam_inventory()?,
            defs.as_ptr(),
            quantities.as_ptr(),
            len_to_u32(defs.len(), "inventory purchase items")?,
        )
    };
    let result: sys::SteamInventoryStartPurchaseResult_t = wait_for_api_call(
        call,
        sys::SteamInventoryStartPurchaseResult_t_k_iCallback as i32,
        timeout_seconds
            .map(u64::from)
            .unwrap_or(DEFAULT_ASYNC_TIMEOUT_SECONDS)
            .max(1),
    )
    .await?;
    Ok(inventory_start_purchase_result(&result))
}

#[napi(js_name = "inventoryRequestPrices")]
pub async fn inventory_request_prices(
    timeout_seconds: Option<u32>,
) -> Result<InventoryRequestPricesResult, Error> {
    let call = unsafe { sys::SteamAPI_ISteamInventory_RequestPrices(steam_inventory()?) };
    let result: sys::SteamInventoryRequestPricesResult_t = wait_for_api_call(
        call,
        sys::SteamInventoryRequestPricesResult_t_k_iCallback as i32,
        timeout_seconds
            .map(u64::from)
            .unwrap_or(DEFAULT_ASYNC_TIMEOUT_SECONDS)
            .max(1),
    )
    .await?;
    Ok(inventory_request_prices_result(&result))
}

#[napi(js_name = "inventoryGetNumItemsWithPrices")]
pub fn inventory_get_num_items_with_prices() -> Result<u32, Error> {
    Ok(unsafe { sys::SteamAPI_ISteamInventory_GetNumItemsWithPrices(steam_inventory()?) })
}

#[napi(js_name = "inventoryGetItemsWithPrices")]
pub fn inventory_get_items_with_prices(
    max_items: Option<u32>,
) -> Result<Vec<InventoryPrice>, Error> {
    let inventory = steam_inventory()?;
    let available = unsafe { sys::SteamAPI_ISteamInventory_GetNumItemsWithPrices(inventory) };
    let count = max_items
        .filter(|max_items| *max_items > 0)
        .map(|max_items| max_items.min(available))
        .unwrap_or(available);
    if count == 0 {
        return Ok(Vec::new());
    }
    let mut definitions = vec![0i32; count as usize];
    let mut current_prices = vec![0u64; count as usize];
    let mut base_prices = vec![0u64; count as usize];
    let ok = unsafe {
        sys::SteamAPI_ISteamInventory_GetItemsWithPrices(
            inventory,
            definitions.as_mut_ptr(),
            current_prices.as_mut_ptr(),
            base_prices.as_mut_ptr(),
            count,
        )
    };
    if !ok {
        return Ok(Vec::new());
    }
    Ok(definitions
        .into_iter()
        .zip(current_prices)
        .zip(base_prices)
        .map(|((definition, current_price), base_price)| InventoryPrice {
            definition,
            current_price: current_price.into(),
            base_price: base_price.into(),
        })
        .collect())
}

#[napi(js_name = "inventoryGetItemPrice")]
pub fn inventory_get_item_price(definition: i32) -> Result<Option<InventoryPrice>, Error> {
    let mut current_price = 0u64;
    let mut base_price = 0u64;
    let ok = unsafe {
        sys::SteamAPI_ISteamInventory_GetItemPrice(
            steam_inventory()?,
            definition,
            &mut current_price,
            &mut base_price,
        )
    };
    Ok(ok.then_some(InventoryPrice {
        definition,
        current_price: current_price.into(),
        base_price: base_price.into(),
    }))
}

#[napi(js_name = "inventoryStartUpdateProperties")]
pub fn inventory_start_update_properties() -> Result<Option<BigInt>, Error> {
    let handle = unsafe { sys::SteamAPI_ISteamInventory_StartUpdateProperties(steam_inventory()?) };
    Ok((handle != sys::k_SteamInventoryUpdateHandleInvalid).then_some(handle.into()))
}

#[napi(js_name = "inventoryRemoveProperty")]
pub fn inventory_remove_property(
    update_handle: BigInt,
    item_id: BigInt,
    property_name: String,
) -> Result<bool, Error> {
    let property_name = cstring(property_name, "inventory property name")?;
    Ok(unsafe {
        sys::SteamAPI_ISteamInventory_RemoveProperty(
            steam_inventory()?,
            bigint_to_u64(update_handle, "inventory update handle")?,
            bigint_to_u64(item_id, "inventory item id")?,
            property_name.as_ptr(),
        )
    })
}

#[napi(js_name = "inventorySetPropertyString")]
pub fn inventory_set_property_string(
    update_handle: BigInt,
    item_id: BigInt,
    property_name: String,
    value: String,
) -> Result<bool, Error> {
    let property_name = cstring(property_name, "inventory property name")?;
    let value = cstring(value, "inventory property value")?;
    Ok(unsafe {
        sys::SteamAPI_ISteamInventory_SetPropertyString(
            steam_inventory()?,
            bigint_to_u64(update_handle, "inventory update handle")?,
            bigint_to_u64(item_id, "inventory item id")?,
            property_name.as_ptr(),
            value.as_ptr(),
        )
    })
}

#[napi(js_name = "inventorySetPropertyBool")]
pub fn inventory_set_property_bool(
    update_handle: BigInt,
    item_id: BigInt,
    property_name: String,
    value: bool,
) -> Result<bool, Error> {
    let property_name = cstring(property_name, "inventory property name")?;
    Ok(unsafe {
        sys::SteamAPI_ISteamInventory_SetPropertyBool(
            steam_inventory()?,
            bigint_to_u64(update_handle, "inventory update handle")?,
            bigint_to_u64(item_id, "inventory item id")?,
            property_name.as_ptr(),
            value,
        )
    })
}

#[napi(js_name = "inventorySetPropertyInt64")]
pub fn inventory_set_property_int64(
    update_handle: BigInt,
    item_id: BigInt,
    property_name: String,
    value: BigInt,
) -> Result<bool, Error> {
    let property_name = cstring(property_name, "inventory property name")?;
    Ok(unsafe {
        sys::SteamAPI_ISteamInventory_SetPropertyInt64(
            steam_inventory()?,
            bigint_to_u64(update_handle, "inventory update handle")?,
            bigint_to_u64(item_id, "inventory item id")?,
            property_name.as_ptr(),
            bigint_to_i64(value, "inventory property value")?,
        )
    })
}

#[napi(js_name = "inventorySetPropertyFloat")]
pub fn inventory_set_property_float(
    update_handle: BigInt,
    item_id: BigInt,
    property_name: String,
    value: f64,
) -> Result<bool, Error> {
    let property_name = cstring(property_name, "inventory property name")?;
    Ok(unsafe {
        sys::SteamAPI_ISteamInventory_SetPropertyFloat(
            steam_inventory()?,
            bigint_to_u64(update_handle, "inventory update handle")?,
            bigint_to_u64(item_id, "inventory item id")?,
            property_name.as_ptr(),
            value as f32,
        )
    })
}

#[napi(js_name = "inventorySubmitUpdateProperties")]
pub fn inventory_submit_update_properties(update_handle: BigInt) -> Result<Option<i32>, Error> {
    let mut result_handle = sys::k_SteamInventoryResultInvalid;
    let ok = unsafe {
        sys::SteamAPI_ISteamInventory_SubmitUpdateProperties(
            steam_inventory()?,
            bigint_to_u64(update_handle, "inventory update handle")?,
            &mut result_handle,
        )
    };
    Ok(inventory_result_handle(ok, result_handle))
}

#[napi(js_name = "inventoryInspectItem")]
pub fn inventory_inspect_item(item_token: String) -> Result<Option<i32>, Error> {
    let item_token = cstring(item_token, "inventory item token")?;
    let mut result_handle = sys::k_SteamInventoryResultInvalid;
    let ok = unsafe {
        sys::SteamAPI_ISteamInventory_InspectItem(
            steam_inventory()?,
            &mut result_handle,
            item_token.as_ptr(),
        )
    };
    Ok(inventory_result_handle(ok, result_handle))
}

#[napi(js_name = "inputInit")]
pub fn input_init() -> Result<(), Error> {
    let ok = unsafe { sys::SteamAPI_ISteamInput_Init(steam_input()?, false) };
    if ok {
        Ok(())
    } else {
        Err(Error::from_reason("Steam Input init failed"))
    }
}

#[napi(js_name = "inputShutdown")]
pub fn input_shutdown() -> Result<(), Error> {
    unsafe { sys::SteamAPI_ISteamInput_Shutdown(steam_input()?) };
    Ok(())
}

#[napi(js_name = "inputGetControllers")]
pub fn input_get_controllers() -> Result<Vec<InputControllerInfo>, Error> {
    let input = steam_input()?;
    unsafe { sys::SteamAPI_ISteamInput_RunFrame(input, false) };
    let mut handles = vec![0u64; 16];
    let count =
        unsafe { sys::SteamAPI_ISteamInput_GetConnectedControllers(input, handles.as_mut_ptr()) };
    handles.truncate(count.max(0) as usize);
    Ok(handles
        .into_iter()
        .map(|handle| InputControllerInfo {
            input_type: input_type_name(unsafe {
                sys::SteamAPI_ISteamInput_GetInputTypeForHandle(input, handle)
            })
            .to_owned(),
            handle: handle.into(),
        })
        .collect())
}

#[napi(js_name = "inputGetActionSet")]
pub fn input_get_action_set(action_set_name: String) -> Result<BigInt, Error> {
    let name = cstring(action_set_name, "action set name")?;
    Ok(
        unsafe { sys::SteamAPI_ISteamInput_GetActionSetHandle(steam_input()?, name.as_ptr()) }
            .into(),
    )
}

#[napi(js_name = "inputGetDigitalAction")]
pub fn input_get_digital_action(action_name: String) -> Result<BigInt, Error> {
    let name = cstring(action_name, "digital action name")?;
    Ok(
        unsafe { sys::SteamAPI_ISteamInput_GetDigitalActionHandle(steam_input()?, name.as_ptr()) }
            .into(),
    )
}

#[napi(js_name = "inputGetAnalogAction")]
pub fn input_get_analog_action(action_name: String) -> Result<BigInt, Error> {
    let name = cstring(action_name, "analog action name")?;
    Ok(
        unsafe { sys::SteamAPI_ISteamInput_GetAnalogActionHandle(steam_input()?, name.as_ptr()) }
            .into(),
    )
}

#[napi(js_name = "inputActivateActionSet")]
pub fn input_activate_action_set(controller: BigInt, action_set: BigInt) -> Result<(), Error> {
    unsafe {
        sys::SteamAPI_ISteamInput_ActivateActionSet(
            steam_input()?,
            bigint_to_u64(controller, "controller handle")?,
            bigint_to_u64(action_set, "action set handle")?,
        );
    }
    Ok(())
}

#[napi(js_name = "inputIsDigitalActionPressed")]
pub fn input_is_digital_action_pressed(controller: BigInt, action: BigInt) -> Result<bool, Error> {
    let data = unsafe {
        sys::SteamAPI_ISteamInput_GetDigitalActionData(
            steam_input()?,
            bigint_to_u64(controller, "controller handle")?,
            bigint_to_u64(action, "digital action handle")?,
        )
    };
    Ok(data.bActive && data.bState)
}

#[napi(js_name = "inputGetAnalogActionVector")]
pub fn input_get_analog_action_vector(
    controller: BigInt,
    action: BigInt,
) -> Result<AnalogActionVector, Error> {
    let data = unsafe {
        sys::SteamAPI_ISteamInput_GetAnalogActionData(
            steam_input()?,
            bigint_to_u64(controller, "controller handle")?,
            bigint_to_u64(action, "analog action handle")?,
        )
    };
    let x = unsafe { ptr::addr_of!(data.x).read_unaligned() } as f64;
    let y = unsafe { ptr::addr_of!(data.y).read_unaligned() } as f64;
    Ok(AnalogActionVector { x, y })
}

#[napi(js_name = "inputGetControllerType")]
pub fn input_get_controller_type(controller: BigInt) -> Result<String, Error> {
    Ok(input_type_name(unsafe {
        sys::SteamAPI_ISteamInput_GetInputTypeForHandle(
            steam_input()?,
            bigint_to_u64(controller, "controller handle")?,
        )
    })
    .to_owned())
}

#[napi(js_name = "statsGetInt")]
pub fn stats_get_int(name: String) -> Result<Option<i32>, Error> {
    let stats = steam_user_stats()?;
    let name = cstring(name, "stat name")?;
    let mut value = 0i32;
    let ok =
        unsafe { sys::SteamAPI_ISteamUserStats_GetStatInt32(stats, name.as_ptr(), &mut value) };
    Ok(if ok { Some(value) } else { None })
}

#[napi(js_name = "statsGetFloat")]
pub fn stats_get_float(name: String) -> Result<Option<f64>, Error> {
    let stats = steam_user_stats()?;
    let name = cstring(name, "stat name")?;
    let mut value = 0f32;
    let ok =
        unsafe { sys::SteamAPI_ISteamUserStats_GetStatFloat(stats, name.as_ptr(), &mut value) };
    Ok(if ok { Some(f64::from(value)) } else { None })
}

#[napi(js_name = "statsSetInt")]
pub fn stats_set_int(name: String, value: i32) -> Result<bool, Error> {
    let name = cstring(name, "stat name")?;
    Ok(unsafe {
        sys::SteamAPI_ISteamUserStats_SetStatInt32(steam_user_stats()?, name.as_ptr(), value)
    })
}

#[napi(js_name = "statsSetFloat")]
pub fn stats_set_float(name: String, value: f64) -> Result<bool, Error> {
    if !value.is_finite() {
        return Err(Error::from_reason("stat float value must be finite"));
    }
    let name = cstring(name, "stat name")?;
    Ok(unsafe {
        sys::SteamAPI_ISteamUserStats_SetStatFloat(steam_user_stats()?, name.as_ptr(), value as f32)
    })
}

#[napi(js_name = "statsUpdateAvgRate")]
pub fn stats_update_avg_rate(
    name: String,
    count_this_session: f64,
    session_length: f64,
) -> Result<bool, Error> {
    if !count_this_session.is_finite() || !session_length.is_finite() {
        return Err(Error::from_reason(
            "average-rate stat count and session length must be finite",
        ));
    }
    let name = cstring(name, "stat name")?;
    Ok(unsafe {
        sys::SteamAPI_ISteamUserStats_UpdateAvgRateStat(
            steam_user_stats()?,
            name.as_ptr(),
            count_this_session as f32,
            session_length,
        )
    })
}

#[napi(js_name = "statsStore")]
pub fn stats_store() -> Result<bool, Error> {
    Ok(unsafe { sys::SteamAPI_ISteamUserStats_StoreStats(steam_user_stats()?) })
}

#[napi(js_name = "statsResetAll")]
pub fn stats_reset_all(achievements_too: bool) -> Result<bool, Error> {
    Ok(unsafe {
        sys::SteamAPI_ISteamUserStats_ResetAllStats(steam_user_stats()?, achievements_too)
    })
}

#[napi(js_name = "achievementGetAndUnlockTime")]
pub fn achievement_get_and_unlock_time(
    name: String,
) -> Result<Option<AchievementUnlockTime>, Error> {
    let name = cstring(name, "achievement name")?;
    let mut achieved = false;
    let mut unlock_time = 0u32;
    let ok = unsafe {
        sys::SteamAPI_ISteamUserStats_GetAchievementAndUnlockTime(
            steam_user_stats()?,
            name.as_ptr(),
            &mut achieved,
            &mut unlock_time,
        )
    };
    Ok(ok.then_some(AchievementUnlockTime {
        achieved,
        unlock_time,
    }))
}

#[napi(js_name = "achievementGetIcon")]
pub fn achievement_get_icon(name: String) -> Result<i32, Error> {
    let name = cstring(name, "achievement name")?;
    Ok(unsafe {
        sys::SteamAPI_ISteamUserStats_GetAchievementIcon(steam_user_stats()?, name.as_ptr())
    })
}

#[napi(js_name = "achievementGetDisplayAttribute")]
pub fn achievement_get_display_attribute(name: String, key: String) -> Result<String, Error> {
    let name = cstring(name, "achievement name")?;
    let key = cstring(key, "achievement display attribute key")?;
    Ok(string_from_ptr(unsafe {
        sys::SteamAPI_ISteamUserStats_GetAchievementDisplayAttribute(
            steam_user_stats()?,
            name.as_ptr(),
            key.as_ptr(),
        )
    }))
}

#[napi(js_name = "achievementIndicateProgress")]
pub fn achievement_indicate_progress(name: String, current: u32, max: u32) -> Result<bool, Error> {
    let name = cstring(name, "achievement name")?;
    Ok(unsafe {
        sys::SteamAPI_ISteamUserStats_IndicateAchievementProgress(
            steam_user_stats()?,
            name.as_ptr(),
            current,
            max,
        )
    })
}

#[napi(js_name = "statsRequestUserStats")]
pub async fn stats_request_user_stats(
    steam_id64: BigInt,
) -> Result<UserStatsReceivedResult, Error> {
    let call = unsafe {
        sys::SteamAPI_ISteamUserStats_RequestUserStats(
            steam_user_stats()?,
            bigint_to_u64(steam_id64, "steamId64")?,
        )
    };
    let result: sys::UserStatsReceived_t = wait_for_api_call(
        call,
        sys::UserStatsReceived_t_k_iCallback as i32,
        DEFAULT_ASYNC_TIMEOUT_SECONDS,
    )
    .await?;
    Ok(user_stats_received_result(result))
}

#[napi(js_name = "statsGetUserInt")]
pub fn stats_get_user_int(steam_id64: BigInt, name: String) -> Result<Option<i32>, Error> {
    let name = cstring(name, "stat name")?;
    let mut value = 0i32;
    let ok = unsafe {
        sys::SteamAPI_ISteamUserStats_GetUserStatInt32(
            steam_user_stats()?,
            bigint_to_u64(steam_id64, "steamId64")?,
            name.as_ptr(),
            &mut value,
        )
    };
    Ok(if ok { Some(value) } else { None })
}

#[napi(js_name = "statsGetUserFloat")]
pub fn stats_get_user_float(steam_id64: BigInt, name: String) -> Result<Option<f64>, Error> {
    let name = cstring(name, "stat name")?;
    let mut value = 0f32;
    let ok = unsafe {
        sys::SteamAPI_ISteamUserStats_GetUserStatFloat(
            steam_user_stats()?,
            bigint_to_u64(steam_id64, "steamId64")?,
            name.as_ptr(),
            &mut value,
        )
    };
    Ok(if ok { Some(f64::from(value)) } else { None })
}

#[napi(js_name = "statsGetUserAchievement")]
pub fn stats_get_user_achievement(steam_id64: BigInt, name: String) -> Result<Option<bool>, Error> {
    let name = cstring(name, "achievement name")?;
    let mut achieved = false;
    let ok = unsafe {
        sys::SteamAPI_ISteamUserStats_GetUserAchievement(
            steam_user_stats()?,
            bigint_to_u64(steam_id64, "steamId64")?,
            name.as_ptr(),
            &mut achieved,
        )
    };
    Ok(if ok { Some(achieved) } else { None })
}

#[napi(js_name = "statsGetUserAchievementAndUnlockTime")]
pub fn stats_get_user_achievement_and_unlock_time(
    steam_id64: BigInt,
    name: String,
) -> Result<Option<AchievementUnlockTime>, Error> {
    let name = cstring(name, "achievement name")?;
    let mut achieved = false;
    let mut unlock_time = 0u32;
    let ok = unsafe {
        sys::SteamAPI_ISteamUserStats_GetUserAchievementAndUnlockTime(
            steam_user_stats()?,
            bigint_to_u64(steam_id64, "steamId64")?,
            name.as_ptr(),
            &mut achieved,
            &mut unlock_time,
        )
    };
    Ok(ok.then_some(AchievementUnlockTime {
        achieved,
        unlock_time,
    }))
}

#[napi(js_name = "statsGetNumberOfCurrentPlayers")]
pub async fn stats_get_number_of_current_players() -> Result<NumberOfCurrentPlayersResult, Error> {
    let call =
        unsafe { sys::SteamAPI_ISteamUserStats_GetNumberOfCurrentPlayers(steam_user_stats()?) };
    let result: sys::NumberOfCurrentPlayers_t = wait_for_api_call(
        call,
        sys::NumberOfCurrentPlayers_t_k_iCallback as i32,
        DEFAULT_ASYNC_TIMEOUT_SECONDS,
    )
    .await?;
    Ok(NumberOfCurrentPlayersResult {
        success: result.m_bSuccess != 0,
        players: result.m_cPlayers,
    })
}

#[napi(js_name = "statsRequestGlobalAchievementPercentages")]
pub async fn stats_request_global_achievement_percentages(
) -> Result<GlobalAchievementPercentagesReady, Error> {
    let call = unsafe {
        sys::SteamAPI_ISteamUserStats_RequestGlobalAchievementPercentages(steam_user_stats()?)
    };
    let result: sys::GlobalAchievementPercentagesReady_t = wait_for_api_call(
        call,
        sys::GlobalAchievementPercentagesReady_t_k_iCallback as i32,
        DEFAULT_ASYNC_TIMEOUT_SECONDS,
    )
    .await?;
    Ok(GlobalAchievementPercentagesReady {
        game_id: unsafe { ptr::addr_of!(result.m_nGameID).read_unaligned() }.into(),
        result: unsafe { ptr::addr_of!(result.m_eResult).read_unaligned() } as u32,
    })
}

#[napi(js_name = "statsGetMostAchievedAchievementInfo")]
pub fn stats_get_most_achieved_achievement_info() -> Result<Option<GlobalAchievementInfo>, Error> {
    let mut name = [0 as c_char; 128];
    let mut percent = 0f32;
    let mut achieved = false;
    let iterator = unsafe {
        sys::SteamAPI_ISteamUserStats_GetMostAchievedAchievementInfo(
            steam_user_stats()?,
            name.as_mut_ptr(),
            name.len() as u32,
            &mut percent,
            &mut achieved,
        )
    };
    global_achievement_info(iterator, &name, percent, achieved)
}

#[napi(js_name = "statsGetNextMostAchievedAchievementInfo")]
pub fn stats_get_next_most_achieved_achievement_info(
    previous_iterator: i32,
) -> Result<Option<GlobalAchievementInfo>, Error> {
    let mut name = [0 as c_char; 128];
    let mut percent = 0f32;
    let mut achieved = false;
    let iterator = unsafe {
        sys::SteamAPI_ISteamUserStats_GetNextMostAchievedAchievementInfo(
            steam_user_stats()?,
            previous_iterator,
            name.as_mut_ptr(),
            name.len() as u32,
            &mut percent,
            &mut achieved,
        )
    };
    global_achievement_info(iterator, &name, percent, achieved)
}

#[napi(js_name = "statsGetAchievementAchievedPercent")]
pub fn stats_get_achievement_achieved_percent(name: String) -> Result<Option<f64>, Error> {
    let name = cstring(name, "achievement name")?;
    let mut percent = 0f32;
    let ok = unsafe {
        sys::SteamAPI_ISteamUserStats_GetAchievementAchievedPercent(
            steam_user_stats()?,
            name.as_ptr(),
            &mut percent,
        )
    };
    Ok(if ok { Some(f64::from(percent)) } else { None })
}

#[napi(js_name = "statsRequestGlobalStats")]
pub async fn stats_request_global_stats(
    history_days: i32,
) -> Result<GlobalStatsReceivedResult, Error> {
    let call = unsafe {
        sys::SteamAPI_ISteamUserStats_RequestGlobalStats(steam_user_stats()?, history_days)
    };
    let result: sys::GlobalStatsReceived_t = wait_for_api_call(
        call,
        sys::GlobalStatsReceived_t_k_iCallback as i32,
        DEFAULT_ASYNC_TIMEOUT_SECONDS,
    )
    .await?;
    Ok(GlobalStatsReceivedResult {
        game_id: unsafe { ptr::addr_of!(result.m_nGameID).read_unaligned() }.into(),
        result: unsafe { ptr::addr_of!(result.m_eResult).read_unaligned() } as u32,
    })
}

#[napi(js_name = "statsGetGlobalStatInt")]
pub fn stats_get_global_stat_int(name: String) -> Result<Option<BigInt>, Error> {
    let name = cstring(name, "global stat name")?;
    let mut value = 0i64;
    let ok = unsafe {
        sys::SteamAPI_ISteamUserStats_GetGlobalStatInt64(
            steam_user_stats()?,
            name.as_ptr(),
            &mut value,
        )
    };
    Ok(if ok { Some(value.into()) } else { None })
}

#[napi(js_name = "statsGetGlobalStatDouble")]
pub fn stats_get_global_stat_double(name: String) -> Result<Option<f64>, Error> {
    let name = cstring(name, "global stat name")?;
    let mut value = 0f64;
    let ok = unsafe {
        sys::SteamAPI_ISteamUserStats_GetGlobalStatDouble(
            steam_user_stats()?,
            name.as_ptr(),
            &mut value,
        )
    };
    Ok(if ok { Some(value) } else { None })
}

#[napi(js_name = "statsGetGlobalStatHistoryInt")]
pub fn stats_get_global_stat_history_int(
    name: String,
    max_entries: u32,
) -> Result<Vec<BigInt>, Error> {
    let name = cstring(name, "global stat name")?;
    let max_entries = max_entries.min(GLOBAL_STAT_HISTORY_MAX) as usize;
    if max_entries == 0 {
        return Ok(Vec::new());
    }
    let mut values = vec![0i64; max_entries];
    let bytes = values
        .len()
        .checked_mul(std::mem::size_of::<i64>())
        .ok_or_else(|| Error::from_reason("global stat history buffer size overflows usize"))?;
    let count = unsafe {
        sys::SteamAPI_ISteamUserStats_GetGlobalStatHistoryInt64(
            steam_user_stats()?,
            name.as_ptr(),
            values.as_mut_ptr(),
            bytes as u32,
        )
    };
    values.truncate(count.max(0).min(max_entries as i32) as usize);
    Ok(values.into_iter().map(Into::into).collect())
}

#[napi(js_name = "statsGetGlobalStatHistoryDouble")]
pub fn stats_get_global_stat_history_double(
    name: String,
    max_entries: u32,
) -> Result<Vec<f64>, Error> {
    let name = cstring(name, "global stat name")?;
    let max_entries = max_entries.min(GLOBAL_STAT_HISTORY_MAX) as usize;
    if max_entries == 0 {
        return Ok(Vec::new());
    }
    let mut values = vec![0f64; max_entries];
    let bytes = values
        .len()
        .checked_mul(std::mem::size_of::<f64>())
        .ok_or_else(|| Error::from_reason("global stat history buffer size overflows usize"))?;
    let count = unsafe {
        sys::SteamAPI_ISteamUserStats_GetGlobalStatHistoryDouble(
            steam_user_stats()?,
            name.as_ptr(),
            values.as_mut_ptr(),
            bytes as u32,
        )
    };
    values.truncate(count.max(0).min(max_entries as i32) as usize);
    Ok(values)
}

#[napi(js_name = "achievementGetProgressLimitsInt")]
pub fn achievement_get_progress_limits_int(
    name: String,
) -> Result<Option<AchievementProgressLimitsInt>, Error> {
    let name = cstring(name, "achievement name")?;
    let mut min = 0i32;
    let mut max = 0i32;
    let ok = unsafe {
        sys::SteamAPI_ISteamUserStats_GetAchievementProgressLimitsInt32(
            steam_user_stats()?,
            name.as_ptr(),
            &mut min,
            &mut max,
        )
    };
    Ok(ok.then_some(AchievementProgressLimitsInt { min, max }))
}

#[napi(js_name = "achievementGetProgressLimitsFloat")]
pub fn achievement_get_progress_limits_float(
    name: String,
) -> Result<Option<AchievementProgressLimitsFloat>, Error> {
    let name = cstring(name, "achievement name")?;
    let mut min = 0f32;
    let mut max = 0f32;
    let ok = unsafe {
        sys::SteamAPI_ISteamUserStats_GetAchievementProgressLimitsFloat(
            steam_user_stats()?,
            name.as_ptr(),
            &mut min,
            &mut max,
        )
    };
    Ok(ok.then_some(AchievementProgressLimitsFloat {
        min: f64::from(min),
        max: f64::from(max),
    }))
}

#[napi(js_name = "statsFindOrCreateLeaderboard")]
pub async fn stats_find_or_create_leaderboard(
    name: String,
    sort_method: u32,
    display_type: u32,
) -> Result<LeaderboardFindResult, Error> {
    let name = cstring(name, "leaderboard name")?;
    let call = unsafe {
        sys::SteamAPI_ISteamUserStats_FindOrCreateLeaderboard(
            steam_user_stats()?,
            name.as_ptr(),
            leaderboard_sort_method_from_u32(sort_method)?,
            leaderboard_display_type_from_u32(display_type)?,
        )
    };
    let result: sys::LeaderboardFindResult_t = wait_for_api_call(
        call,
        sys::LeaderboardFindResult_t_k_iCallback as i32,
        DEFAULT_ASYNC_TIMEOUT_SECONDS,
    )
    .await?;
    Ok(leaderboard_find_result(result))
}

#[napi(js_name = "statsFindLeaderboard")]
pub async fn stats_find_leaderboard(name: String) -> Result<LeaderboardFindResult, Error> {
    let name = cstring(name, "leaderboard name")?;
    let call = unsafe {
        sys::SteamAPI_ISteamUserStats_FindLeaderboard(steam_user_stats()?, name.as_ptr())
    };
    let result: sys::LeaderboardFindResult_t = wait_for_api_call(
        call,
        sys::LeaderboardFindResult_t_k_iCallback as i32,
        DEFAULT_ASYNC_TIMEOUT_SECONDS,
    )
    .await?;
    Ok(leaderboard_find_result(result))
}

#[napi(js_name = "statsGetLeaderboardName")]
pub fn stats_get_leaderboard_name(leaderboard: BigInt) -> Result<String, Error> {
    Ok(string_from_ptr(unsafe {
        sys::SteamAPI_ISteamUserStats_GetLeaderboardName(
            steam_user_stats()?,
            bigint_to_u64(leaderboard, "leaderboard")?,
        )
    }))
}

#[napi(js_name = "statsGetLeaderboardEntryCount")]
pub fn stats_get_leaderboard_entry_count(leaderboard: BigInt) -> Result<i32, Error> {
    Ok(unsafe {
        sys::SteamAPI_ISteamUserStats_GetLeaderboardEntryCount(
            steam_user_stats()?,
            bigint_to_u64(leaderboard, "leaderboard")?,
        )
    })
}

#[napi(js_name = "statsGetLeaderboardSortMethod")]
pub fn stats_get_leaderboard_sort_method(leaderboard: BigInt) -> Result<u32, Error> {
    Ok(unsafe {
        sys::SteamAPI_ISteamUserStats_GetLeaderboardSortMethod(
            steam_user_stats()?,
            bigint_to_u64(leaderboard, "leaderboard")?,
        ) as u32
    })
}

#[napi(js_name = "statsGetLeaderboardDisplayType")]
pub fn stats_get_leaderboard_display_type(leaderboard: BigInt) -> Result<u32, Error> {
    Ok(unsafe {
        sys::SteamAPI_ISteamUserStats_GetLeaderboardDisplayType(
            steam_user_stats()?,
            bigint_to_u64(leaderboard, "leaderboard")?,
        ) as u32
    })
}

#[napi(js_name = "statsDownloadLeaderboardEntries")]
pub async fn stats_download_leaderboard_entries(
    leaderboard: BigInt,
    request: u32,
    range_start: i32,
    range_end: i32,
    details_max: Option<u32>,
) -> Result<LeaderboardScoresDownloaded, Error> {
    let details_max = leaderboard_details_max(details_max);
    let call = unsafe {
        sys::SteamAPI_ISteamUserStats_DownloadLeaderboardEntries(
            steam_user_stats()?,
            bigint_to_u64(leaderboard, "leaderboard")?,
            leaderboard_data_request_from_u32(request)?,
            range_start,
            range_end,
        )
    };
    let result: sys::LeaderboardScoresDownloaded_t = wait_for_api_call(
        call,
        sys::LeaderboardScoresDownloaded_t_k_iCallback as i32,
        DEFAULT_ASYNC_TIMEOUT_SECONDS,
    )
    .await?;
    let stats = steam_user_stats()?;
    leaderboard_scores_downloaded(stats, result, details_max)
}

#[napi(js_name = "statsDownloadLeaderboardEntriesForUsers")]
pub async fn stats_download_leaderboard_entries_for_users(
    leaderboard: BigInt,
    steam_ids64: Vec<BigInt>,
    details_max: Option<u32>,
) -> Result<LeaderboardScoresDownloaded, Error> {
    if steam_ids64.is_empty() {
        return Err(Error::from_reason(
            "at least one Steam ID is required to download leaderboard entries for users",
        ));
    }
    let leaderboard = bigint_to_u64(leaderboard, "leaderboard")?;
    let mut users = steam_ids64
        .into_iter()
        .map(|steam_id| bigint_to_u64(steam_id, "steamId64").map(u64_to_csteam_id))
        .collect::<Result<Vec<_>, _>>()?;
    let details_max = leaderboard_details_max(details_max);
    let call = unsafe {
        sys::SteamAPI_ISteamUserStats_DownloadLeaderboardEntriesForUsers(
            steam_user_stats()?,
            leaderboard,
            users.as_mut_ptr(),
            users.len() as i32,
        )
    };
    let result: sys::LeaderboardScoresDownloaded_t = wait_for_api_call(
        call,
        sys::LeaderboardScoresDownloaded_t_k_iCallback as i32,
        DEFAULT_ASYNC_TIMEOUT_SECONDS,
    )
    .await?;
    let stats = steam_user_stats()?;
    leaderboard_scores_downloaded(stats, result, details_max)
}

#[napi(js_name = "statsGetDownloadedLeaderboardEntry")]
pub fn stats_get_downloaded_leaderboard_entry(
    entries_handle: BigInt,
    index: i32,
    details_max: Option<u32>,
) -> Result<Option<LeaderboardEntry>, Error> {
    let stats = steam_user_stats()?;
    let entries_handle = bigint_to_u64(entries_handle, "leaderboard entries")?;
    let details_max = leaderboard_details_max(details_max);
    downloaded_leaderboard_entry(stats, entries_handle, index, details_max)
}

#[napi(js_name = "statsUploadLeaderboardScore")]
pub async fn stats_upload_leaderboard_score(
    leaderboard: BigInt,
    method: u32,
    score: i32,
    score_details: Vec<i32>,
) -> Result<LeaderboardScoreUploaded, Error> {
    if score_details.len() > LEADERBOARD_DETAILS_MAX as usize {
        return Err(Error::from_reason(format!(
            "leaderboard score details cannot exceed {} integers",
            LEADERBOARD_DETAILS_MAX
        )));
    }
    let details_ptr = if score_details.is_empty() {
        ptr::null()
    } else {
        score_details.as_ptr()
    };
    let call = unsafe {
        sys::SteamAPI_ISteamUserStats_UploadLeaderboardScore(
            steam_user_stats()?,
            bigint_to_u64(leaderboard, "leaderboard")?,
            leaderboard_upload_score_method_from_u32(method)?,
            score,
            details_ptr,
            score_details.len() as i32,
        )
    };
    let result: sys::LeaderboardScoreUploaded_t = wait_for_api_call(
        call,
        sys::LeaderboardScoreUploaded_t_k_iCallback as i32,
        DEFAULT_ASYNC_TIMEOUT_SECONDS,
    )
    .await?;
    Ok(LeaderboardScoreUploaded {
        success: unsafe { ptr::addr_of!(result.m_bSuccess).read_unaligned() } != 0,
        leaderboard: unsafe { ptr::addr_of!(result.m_hSteamLeaderboard).read_unaligned() }.into(),
        score: unsafe { ptr::addr_of!(result.m_nScore).read_unaligned() },
        score_changed: unsafe { ptr::addr_of!(result.m_bScoreChanged).read_unaligned() } != 0,
        global_rank_new: unsafe { ptr::addr_of!(result.m_nGlobalRankNew).read_unaligned() },
        global_rank_previous: unsafe {
            ptr::addr_of!(result.m_nGlobalRankPrevious).read_unaligned()
        },
    })
}

#[napi(js_name = "statsAttachLeaderboardUgc")]
pub async fn stats_attach_leaderboard_ugc(
    leaderboard: BigInt,
    ugc_handle: BigInt,
) -> Result<LeaderboardUgcSetResult, Error> {
    let call = unsafe {
        sys::SteamAPI_ISteamUserStats_AttachLeaderboardUGC(
            steam_user_stats()?,
            bigint_to_u64(leaderboard, "leaderboard")?,
            bigint_to_u64(ugc_handle, "ugcHandle")?,
        )
    };
    let result: sys::LeaderboardUGCSet_t = wait_for_api_call(
        call,
        sys::LeaderboardUGCSet_t_k_iCallback as i32,
        DEFAULT_ASYNC_TIMEOUT_SECONDS,
    )
    .await?;
    Ok(LeaderboardUgcSetResult {
        result: unsafe { ptr::addr_of!(result.m_eResult).read_unaligned() } as u32,
        leaderboard: unsafe { ptr::addr_of!(result.m_hSteamLeaderboard).read_unaligned() }.into(),
    })
}

#[napi(js_name = "screenshotsWriteScreenshot")]
pub fn screenshots_write_screenshot(rgb: Buffer, width: i32, height: i32) -> Result<u32, Error> {
    if width <= 0 || height <= 0 {
        return Err(Error::from_reason(
            "screenshot width and height must be positive",
        ));
    }
    if rgb.is_empty() {
        return Err(Error::from_reason("screenshot RGB buffer is empty"));
    }
    Ok(unsafe {
        sys::SteamAPI_ISteamScreenshots_WriteScreenshot(
            steam_screenshots()?,
            rgb.as_ptr().cast::<c_void>() as *mut c_void,
            rgb.len() as u32,
            width,
            height,
        )
    })
}

#[napi(js_name = "screenshotsAddScreenshotToLibrary")]
pub fn screenshots_add_screenshot_to_library(
    filename: String,
    thumbnail_filename: Option<String>,
    width: i32,
    height: i32,
) -> Result<u32, Error> {
    if width <= 0 || height <= 0 {
        return Err(Error::from_reason(
            "screenshot width and height must be positive",
        ));
    }
    let filename = cstring(filename, "screenshot filename")?;
    let thumbnail = thumbnail_filename
        .map(|value| cstring(value, "screenshot thumbnail filename"))
        .transpose()?;
    Ok(unsafe {
        sys::SteamAPI_ISteamScreenshots_AddScreenshotToLibrary(
            steam_screenshots()?,
            filename.as_ptr(),
            thumbnail
                .as_ref()
                .map_or(ptr::null(), |value| value.as_ptr()),
            width,
            height,
        )
    })
}

#[napi(js_name = "screenshotsTriggerScreenshot")]
pub fn screenshots_trigger_screenshot() -> Result<(), Error> {
    unsafe { sys::SteamAPI_ISteamScreenshots_TriggerScreenshot(steam_screenshots()?) };
    Ok(())
}

#[napi(js_name = "screenshotsHookScreenshots")]
pub fn screenshots_hook_screenshots(hook: bool) -> Result<(), Error> {
    unsafe { sys::SteamAPI_ISteamScreenshots_HookScreenshots(steam_screenshots()?, hook) };
    Ok(())
}

#[napi(js_name = "screenshotsSetLocation")]
pub fn screenshots_set_location(handle: u32, location: String) -> Result<bool, Error> {
    let location = cstring(location, "screenshot location")?;
    Ok(unsafe {
        sys::SteamAPI_ISteamScreenshots_SetLocation(steam_screenshots()?, handle, location.as_ptr())
    })
}

#[napi(js_name = "screenshotsTagUser")]
pub fn screenshots_tag_user(handle: u32, steam_id64: BigInt) -> Result<bool, Error> {
    Ok(unsafe {
        sys::SteamAPI_ISteamScreenshots_TagUser(
            steam_screenshots()?,
            handle,
            bigint_to_u64(steam_id64, "steamId64")?,
        )
    })
}

#[napi(js_name = "screenshotsTagPublishedFile")]
pub fn screenshots_tag_published_file(
    handle: u32,
    published_file_id: BigInt,
) -> Result<bool, Error> {
    Ok(unsafe {
        sys::SteamAPI_ISteamScreenshots_TagPublishedFile(
            steam_screenshots()?,
            handle,
            bigint_to_u64(published_file_id, "publishedFileId")?,
        )
    })
}

#[napi(js_name = "screenshotsIsScreenshotsHooked")]
pub fn screenshots_is_screenshots_hooked() -> Result<bool, Error> {
    Ok(unsafe { sys::SteamAPI_ISteamScreenshots_IsScreenshotsHooked(steam_screenshots()?) })
}

#[napi(js_name = "screenshotsAddVrScreenshotToLibrary")]
pub fn screenshots_add_vr_screenshot_to_library(
    vr_type: u32,
    filename: String,
    vr_filename: String,
) -> Result<u32, Error> {
    let filename = cstring(filename, "screenshot filename")?;
    let vr_filename = cstring(vr_filename, "VR screenshot filename")?;
    Ok(unsafe {
        sys::SteamAPI_ISteamScreenshots_AddVRScreenshotToLibrary(
            steam_screenshots()?,
            vr_screenshot_type_from_u32(vr_type)?,
            filename.as_ptr(),
            vr_filename.as_ptr(),
        )
    })
}

#[napi(js_name = "musicIsEnabled")]
pub fn music_is_enabled() -> Result<bool, Error> {
    Ok(unsafe { sys::SteamAPI_ISteamMusic_BIsEnabled(steam_music()?) })
}

#[napi(js_name = "musicIsPlaying")]
pub fn music_is_playing() -> Result<bool, Error> {
    Ok(unsafe { sys::SteamAPI_ISteamMusic_BIsPlaying(steam_music()?) })
}

#[napi(js_name = "musicGetPlaybackStatus")]
pub fn music_get_playback_status() -> Result<u32, Error> {
    Ok(unsafe { sys::SteamAPI_ISteamMusic_GetPlaybackStatus(steam_music()?) as u32 })
}

#[napi(js_name = "musicPlay")]
pub fn music_play() -> Result<(), Error> {
    unsafe { sys::SteamAPI_ISteamMusic_Play(steam_music()?) };
    Ok(())
}

#[napi(js_name = "musicPause")]
pub fn music_pause() -> Result<(), Error> {
    unsafe { sys::SteamAPI_ISteamMusic_Pause(steam_music()?) };
    Ok(())
}

#[napi(js_name = "musicPlayPrevious")]
pub fn music_play_previous() -> Result<(), Error> {
    unsafe { sys::SteamAPI_ISteamMusic_PlayPrevious(steam_music()?) };
    Ok(())
}

#[napi(js_name = "musicPlayNext")]
pub fn music_play_next() -> Result<(), Error> {
    unsafe { sys::SteamAPI_ISteamMusic_PlayNext(steam_music()?) };
    Ok(())
}

#[napi(js_name = "musicSetVolume")]
pub fn music_set_volume(volume: f64) -> Result<(), Error> {
    if !volume.is_finite() || !(0.0..=1.0).contains(&volume) {
        return Err(Error::from_reason(
            "Steam Music volume must be between 0 and 1",
        ));
    }
    unsafe { sys::SteamAPI_ISteamMusic_SetVolume(steam_music()?, volume as f32) };
    Ok(())
}

#[napi(js_name = "musicGetVolume")]
pub fn music_get_volume() -> Result<f64, Error> {
    Ok(unsafe { sys::SteamAPI_ISteamMusic_GetVolume(steam_music()?) } as f64)
}

#[napi(js_name = "videoRequestVideoUrl")]
pub fn video_request_video_url(app_id: u32) -> Result<(), Error> {
    unsafe { sys::SteamAPI_ISteamVideo_GetVideoURL(steam_video()?, app_id) };
    Ok(())
}

#[napi(js_name = "videoIsBroadcasting")]
pub fn video_is_broadcasting() -> Result<VideoBroadcastStatus, Error> {
    let mut viewers = 0;
    let broadcasting =
        unsafe { sys::SteamAPI_ISteamVideo_IsBroadcasting(steam_video()?, &mut viewers) };
    Ok(VideoBroadcastStatus {
        broadcasting,
        viewers,
    })
}

#[napi(js_name = "videoRequestOpfSettings")]
pub fn video_request_opf_settings(app_id: u32) -> Result<(), Error> {
    unsafe { sys::SteamAPI_ISteamVideo_GetOPFSettings(steam_video()?, app_id) };
    Ok(())
}

#[napi(js_name = "videoGetOpfStringForApp")]
pub fn video_get_opf_string_for_app(app_id: u32) -> Result<Option<String>, Error> {
    let video = steam_video()?;
    let mut size = 0i32;
    unsafe {
        sys::SteamAPI_ISteamVideo_GetOPFStringForApp(video, app_id, ptr::null_mut(), &mut size);
    }
    if size <= 0 {
        return Ok(None);
    }

    let mut buf = vec![0i8; size as usize];
    let ok = unsafe {
        sys::SteamAPI_ISteamVideo_GetOPFStringForApp(video, app_id, buf.as_mut_ptr(), &mut size)
    };
    Ok(ok.then(|| c_buf_to_string(&buf)))
}

#[napi(js_name = "parentalIsParentalLockEnabled")]
pub fn parental_is_parental_lock_enabled() -> Result<bool, Error> {
    Ok(unsafe {
        sys::SteamAPI_ISteamParentalSettings_BIsParentalLockEnabled(steam_parental_settings()?)
    })
}

#[napi(js_name = "parentalIsParentalLockLocked")]
pub fn parental_is_parental_lock_locked() -> Result<bool, Error> {
    Ok(unsafe {
        sys::SteamAPI_ISteamParentalSettings_BIsParentalLockLocked(steam_parental_settings()?)
    })
}

#[napi(js_name = "parentalIsAppBlocked")]
pub fn parental_is_app_blocked(app_id: u32) -> Result<bool, Error> {
    Ok(unsafe {
        sys::SteamAPI_ISteamParentalSettings_BIsAppBlocked(steam_parental_settings()?, app_id)
    })
}

#[napi(js_name = "parentalIsAppInBlockList")]
pub fn parental_is_app_in_block_list(app_id: u32) -> Result<bool, Error> {
    Ok(unsafe {
        sys::SteamAPI_ISteamParentalSettings_BIsAppInBlockList(steam_parental_settings()?, app_id)
    })
}

#[napi(js_name = "parentalIsFeatureBlocked")]
pub fn parental_is_feature_blocked(feature: u32) -> Result<bool, Error> {
    Ok(unsafe {
        sys::SteamAPI_ISteamParentalSettings_BIsFeatureBlocked(
            steam_parental_settings()?,
            parental_feature_from_u32(feature)?,
        )
    })
}

#[napi(js_name = "parentalIsFeatureInBlockList")]
pub fn parental_is_feature_in_block_list(feature: u32) -> Result<bool, Error> {
    Ok(unsafe {
        sys::SteamAPI_ISteamParentalSettings_BIsFeatureInBlockList(
            steam_parental_settings()?,
            parental_feature_from_u32(feature)?,
        )
    })
}

#[napi(js_name = "timelineSetTimelineTooltip")]
pub fn timeline_set_timeline_tooltip(description: String, time_delta: f64) -> Result<(), Error> {
    let description = cstring(description, "timeline tooltip description")?;
    unsafe {
        sys::SteamAPI_ISteamTimeline_SetTimelineTooltip(
            steam_timeline()?,
            description.as_ptr(),
            time_delta as f32,
        )
    };
    Ok(())
}

#[napi(js_name = "timelineClearTimelineTooltip")]
pub fn timeline_clear_timeline_tooltip(time_delta: f64) -> Result<(), Error> {
    unsafe {
        sys::SteamAPI_ISteamTimeline_ClearTimelineTooltip(steam_timeline()?, time_delta as f32)
    };
    Ok(())
}

#[napi(js_name = "timelineSetTimelineGameMode")]
pub fn timeline_set_timeline_game_mode(mode: u32) -> Result<(), Error> {
    unsafe {
        sys::SteamAPI_ISteamTimeline_SetTimelineGameMode(
            steam_timeline()?,
            timeline_game_mode_from_u32(mode)?,
        )
    };
    Ok(())
}

#[napi(js_name = "timelineAddInstantaneousTimelineEvent")]
pub fn timeline_add_instantaneous_timeline_event(
    title: String,
    description: String,
    icon: String,
    icon_priority: u32,
    start_offset_seconds: f64,
    clip_priority: u32,
) -> Result<BigInt, Error> {
    let title = cstring(title, "timeline event title")?;
    let description = cstring(description, "timeline event description")?;
    let icon = cstring(icon, "timeline event icon")?;
    Ok(unsafe {
        sys::SteamAPI_ISteamTimeline_AddInstantaneousTimelineEvent(
            steam_timeline()?,
            title.as_ptr(),
            description.as_ptr(),
            icon.as_ptr(),
            icon_priority,
            start_offset_seconds as f32,
            timeline_clip_priority_from_u32(clip_priority)?,
        )
    }
    .into())
}

#[napi(js_name = "timelineAddRangeTimelineEvent")]
pub fn timeline_add_range_timeline_event(
    title: String,
    description: String,
    icon: String,
    icon_priority: u32,
    start_offset_seconds: f64,
    duration: f64,
    clip_priority: u32,
) -> Result<BigInt, Error> {
    let title = cstring(title, "timeline event title")?;
    let description = cstring(description, "timeline event description")?;
    let icon = cstring(icon, "timeline event icon")?;
    Ok(unsafe {
        sys::SteamAPI_ISteamTimeline_AddRangeTimelineEvent(
            steam_timeline()?,
            title.as_ptr(),
            description.as_ptr(),
            icon.as_ptr(),
            icon_priority,
            start_offset_seconds as f32,
            duration as f32,
            timeline_clip_priority_from_u32(clip_priority)?,
        )
    }
    .into())
}

#[napi(js_name = "timelineStartRangeTimelineEvent")]
pub fn timeline_start_range_timeline_event(
    title: String,
    description: String,
    icon: String,
    priority: u32,
    start_offset_seconds: f64,
    clip_priority: u32,
) -> Result<BigInt, Error> {
    let title = cstring(title, "timeline event title")?;
    let description = cstring(description, "timeline event description")?;
    let icon = cstring(icon, "timeline event icon")?;
    Ok(unsafe {
        sys::SteamAPI_ISteamTimeline_StartRangeTimelineEvent(
            steam_timeline()?,
            title.as_ptr(),
            description.as_ptr(),
            icon.as_ptr(),
            priority,
            start_offset_seconds as f32,
            timeline_clip_priority_from_u32(clip_priority)?,
        )
    }
    .into())
}

#[napi(js_name = "timelineUpdateRangeTimelineEvent")]
pub fn timeline_update_range_timeline_event(
    event: BigInt,
    title: String,
    description: String,
    icon: String,
    priority: u32,
    clip_priority: u32,
) -> Result<(), Error> {
    let title = cstring(title, "timeline event title")?;
    let description = cstring(description, "timeline event description")?;
    let icon = cstring(icon, "timeline event icon")?;
    unsafe {
        sys::SteamAPI_ISteamTimeline_UpdateRangeTimelineEvent(
            steam_timeline()?,
            bigint_to_u64(event, "timeline event")?,
            title.as_ptr(),
            description.as_ptr(),
            icon.as_ptr(),
            priority,
            timeline_clip_priority_from_u32(clip_priority)?,
        )
    };
    Ok(())
}

#[napi(js_name = "timelineEndRangeTimelineEvent")]
pub fn timeline_end_range_timeline_event(
    event: BigInt,
    end_offset_seconds: f64,
) -> Result<(), Error> {
    unsafe {
        sys::SteamAPI_ISteamTimeline_EndRangeTimelineEvent(
            steam_timeline()?,
            bigint_to_u64(event, "timeline event")?,
            end_offset_seconds as f32,
        )
    };
    Ok(())
}

#[napi(js_name = "timelineRemoveTimelineEvent")]
pub fn timeline_remove_timeline_event(event: BigInt) -> Result<(), Error> {
    unsafe {
        sys::SteamAPI_ISteamTimeline_RemoveTimelineEvent(
            steam_timeline()?,
            bigint_to_u64(event, "timeline event")?,
        )
    };
    Ok(())
}

#[napi(js_name = "timelineDoesEventRecordingExist")]
pub async fn timeline_does_event_recording_exist(
    event: BigInt,
) -> Result<TimelineEventRecordingExists, Error> {
    let call = unsafe {
        sys::SteamAPI_ISteamTimeline_DoesEventRecordingExist(
            steam_timeline()?,
            bigint_to_u64(event, "timeline event")?,
        )
    };
    let result: sys::SteamTimelineEventRecordingExists_t = wait_for_api_call(
        call,
        sys::SteamTimelineEventRecordingExists_t_k_iCallback as i32,
        DEFAULT_ASYNC_TIMEOUT_SECONDS,
    )
    .await?;
    Ok(TimelineEventRecordingExists {
        event: unsafe { ptr::addr_of!(result.m_ulEventID).read_unaligned() }.into(),
        recording_exists: unsafe { ptr::addr_of!(result.m_bRecordingExists).read_unaligned() },
    })
}

#[napi(js_name = "timelineStartGamePhase")]
pub fn timeline_start_game_phase() -> Result<(), Error> {
    unsafe { sys::SteamAPI_ISteamTimeline_StartGamePhase(steam_timeline()?) };
    Ok(())
}

#[napi(js_name = "timelineEndGamePhase")]
pub fn timeline_end_game_phase() -> Result<(), Error> {
    unsafe { sys::SteamAPI_ISteamTimeline_EndGamePhase(steam_timeline()?) };
    Ok(())
}

#[napi(js_name = "timelineSetGamePhaseId")]
pub fn timeline_set_game_phase_id(phase_id: String) -> Result<(), Error> {
    let phase_id = cstring(phase_id, "timeline phase id")?;
    unsafe { sys::SteamAPI_ISteamTimeline_SetGamePhaseID(steam_timeline()?, phase_id.as_ptr()) };
    Ok(())
}

#[napi(js_name = "timelineDoesGamePhaseRecordingExist")]
pub async fn timeline_does_game_phase_recording_exist(
    phase_id: String,
) -> Result<TimelineGamePhaseRecordingExists, Error> {
    let phase_id = cstring(phase_id, "timeline phase id")?;
    let call = unsafe {
        sys::SteamAPI_ISteamTimeline_DoesGamePhaseRecordingExist(
            steam_timeline()?,
            phase_id.as_ptr(),
        )
    };
    let result: sys::SteamTimelineGamePhaseRecordingExists_t = wait_for_api_call(
        call,
        sys::SteamTimelineGamePhaseRecordingExists_t_k_iCallback as i32,
        DEFAULT_ASYNC_TIMEOUT_SECONDS,
    )
    .await?;
    let phase_id = unsafe {
        fixed_char_array_to_string(ptr::addr_of!(result.m_rgchPhaseID).cast::<c_char>(), 64)
    };
    Ok(TimelineGamePhaseRecordingExists {
        phase_id,
        recording_ms: unsafe { ptr::addr_of!(result.m_ulRecordingMS).read_unaligned() }.into(),
        longest_clip_ms: unsafe { ptr::addr_of!(result.m_ulLongestClipMS).read_unaligned() }.into(),
        clip_count: unsafe { ptr::addr_of!(result.m_unClipCount).read_unaligned() },
        screenshot_count: unsafe { ptr::addr_of!(result.m_unScreenshotCount).read_unaligned() },
    })
}

#[napi(js_name = "timelineAddGamePhaseTag")]
pub fn timeline_add_game_phase_tag(
    tag_name: String,
    tag_icon: String,
    tag_group: String,
    priority: u32,
) -> Result<(), Error> {
    let tag_name = cstring(tag_name, "timeline tag name")?;
    let tag_icon = cstring(tag_icon, "timeline tag icon")?;
    let tag_group = cstring(tag_group, "timeline tag group")?;
    unsafe {
        sys::SteamAPI_ISteamTimeline_AddGamePhaseTag(
            steam_timeline()?,
            tag_name.as_ptr(),
            tag_icon.as_ptr(),
            tag_group.as_ptr(),
            priority,
        )
    };
    Ok(())
}

#[napi(js_name = "timelineSetGamePhaseAttribute")]
pub fn timeline_set_game_phase_attribute(
    attribute_group: String,
    attribute_value: String,
    priority: u32,
) -> Result<(), Error> {
    let attribute_group = cstring(attribute_group, "timeline attribute group")?;
    let attribute_value = cstring(attribute_value, "timeline attribute value")?;
    unsafe {
        sys::SteamAPI_ISteamTimeline_SetGamePhaseAttribute(
            steam_timeline()?,
            attribute_group.as_ptr(),
            attribute_value.as_ptr(),
            priority,
        )
    };
    Ok(())
}

#[napi(js_name = "timelineOpenOverlayToGamePhase")]
pub fn timeline_open_overlay_to_game_phase(phase_id: String) -> Result<(), Error> {
    let phase_id = cstring(phase_id, "timeline phase id")?;
    unsafe {
        sys::SteamAPI_ISteamTimeline_OpenOverlayToGamePhase(steam_timeline()?, phase_id.as_ptr())
    };
    Ok(())
}

#[napi(js_name = "timelineOpenOverlayToTimelineEvent")]
pub fn timeline_open_overlay_to_timeline_event(event: BigInt) -> Result<(), Error> {
    unsafe {
        sys::SteamAPI_ISteamTimeline_OpenOverlayToTimelineEvent(
            steam_timeline()?,
            bigint_to_u64(event, "timeline event")?,
        )
    };
    Ok(())
}

#[napi(js_name = "remotePlayGetSessionCount")]
pub fn remote_play_get_session_count() -> Result<u32, Error> {
    Ok(unsafe { sys::SteamAPI_ISteamRemotePlay_GetSessionCount(steam_remote_play()?) })
}

#[napi(js_name = "remotePlayGetSessionId")]
pub fn remote_play_get_session_id(index: i32) -> Result<u32, Error> {
    Ok(unsafe { sys::SteamAPI_ISteamRemotePlay_GetSessionID(steam_remote_play()?, index) })
}

#[napi(js_name = "remotePlayGetSessions")]
pub fn remote_play_get_sessions() -> Result<Vec<RemotePlaySessionInfo>, Error> {
    let remote_play = steam_remote_play()?;
    let count = unsafe { sys::SteamAPI_ISteamRemotePlay_GetSessionCount(remote_play) };
    let mut sessions = Vec::with_capacity(count as usize);
    for index in 0..count {
        let id = unsafe { sys::SteamAPI_ISteamRemotePlay_GetSessionID(remote_play, index as i32) };
        sessions.push(remote_play_session_info(remote_play, id));
    }
    Ok(sessions)
}

#[napi(js_name = "remotePlayIsRemotePlayTogether")]
pub fn remote_play_is_remote_play_together(session_id: u32) -> Result<bool, Error> {
    Ok(unsafe {
        sys::SteamAPI_ISteamRemotePlay_BSessionRemotePlayTogether(steam_remote_play()?, session_id)
    })
}

#[napi(js_name = "remotePlayGetSessionSteamId")]
pub fn remote_play_get_session_steam_id(session_id: u32) -> Result<PlayerSteamId, Error> {
    Ok(steam_id_to_player(unsafe {
        sys::SteamAPI_ISteamRemotePlay_GetSessionSteamID(steam_remote_play()?, session_id)
    }))
}

#[napi(js_name = "remotePlayGetSessionGuestId")]
pub fn remote_play_get_session_guest_id(session_id: u32) -> Result<u32, Error> {
    Ok(unsafe {
        sys::SteamAPI_ISteamRemotePlay_GetSessionGuestID(steam_remote_play()?, session_id)
    })
}

#[napi(js_name = "remotePlayGetSmallSessionAvatar")]
pub fn remote_play_get_small_session_avatar(session_id: u32) -> Result<i32, Error> {
    Ok(unsafe {
        sys::SteamAPI_ISteamRemotePlay_GetSmallSessionAvatar(steam_remote_play()?, session_id)
    })
}

#[napi(js_name = "remotePlayGetMediumSessionAvatar")]
pub fn remote_play_get_medium_session_avatar(session_id: u32) -> Result<i32, Error> {
    Ok(unsafe {
        sys::SteamAPI_ISteamRemotePlay_GetMediumSessionAvatar(steam_remote_play()?, session_id)
    })
}

#[napi(js_name = "remotePlayGetLargeSessionAvatar")]
pub fn remote_play_get_large_session_avatar(session_id: u32) -> Result<i32, Error> {
    Ok(unsafe {
        sys::SteamAPI_ISteamRemotePlay_GetLargeSessionAvatar(steam_remote_play()?, session_id)
    })
}

#[napi(js_name = "remotePlayGetSessionClientName")]
pub fn remote_play_get_session_client_name(session_id: u32) -> Result<String, Error> {
    Ok(string_from_ptr(unsafe {
        sys::SteamAPI_ISteamRemotePlay_GetSessionClientName(steam_remote_play()?, session_id)
    }))
}

#[napi(js_name = "remotePlayGetSessionClientFormFactor")]
pub fn remote_play_get_session_client_form_factor(session_id: u32) -> Result<u32, Error> {
    Ok(unsafe {
        sys::SteamAPI_ISteamRemotePlay_GetSessionClientFormFactor(steam_remote_play()?, session_id)
            as u32
    })
}

#[napi(js_name = "remotePlayGetSessionClientResolution")]
pub fn remote_play_get_session_client_resolution(
    session_id: u32,
) -> Result<Option<RemotePlayResolution>, Error> {
    let mut width = 0;
    let mut height = 0;
    let ok = unsafe {
        sys::SteamAPI_ISteamRemotePlay_BGetSessionClientResolution(
            steam_remote_play()?,
            session_id,
            &mut width,
            &mut height,
        )
    };
    Ok(ok.then_some(RemotePlayResolution { width, height }))
}

#[napi(js_name = "remotePlayShowRemotePlayTogetherUi")]
pub fn remote_play_show_remote_play_together_ui() -> Result<bool, Error> {
    Ok(unsafe { sys::SteamAPI_ISteamRemotePlay_ShowRemotePlayTogetherUI(steam_remote_play()?) })
}

#[napi(js_name = "remotePlaySendRemotePlayTogetherInvite")]
pub fn remote_play_send_remote_play_together_invite(steam_id64: BigInt) -> Result<bool, Error> {
    Ok(unsafe {
        sys::SteamAPI_ISteamRemotePlay_BSendRemotePlayTogetherInvite(
            steam_remote_play()?,
            bigint_to_u64(steam_id64, "steamId64")?,
        )
    })
}

#[napi(js_name = "remotePlayEnableRemotePlayTogetherDirectInput")]
pub fn remote_play_enable_remote_play_together_direct_input() -> Result<bool, Error> {
    Ok(unsafe {
        sys::SteamAPI_ISteamRemotePlay_BEnableRemotePlayTogetherDirectInput(steam_remote_play()?)
    })
}

#[napi(js_name = "remotePlayDisableRemotePlayTogetherDirectInput")]
pub fn remote_play_disable_remote_play_together_direct_input() -> Result<(), Error> {
    unsafe {
        sys::SteamAPI_ISteamRemotePlay_DisableRemotePlayTogetherDirectInput(steam_remote_play()?)
    };
    Ok(())
}

#[napi(js_name = "remotePlayGetInput")]
pub fn remote_play_get_input(max_events: u32) -> Result<Vec<RemotePlayInputEvent>, Error> {
    let count = max_events.clamp(0, 256);
    if count == 0 {
        return Ok(Vec::new());
    }
    let mut inputs = vec![unsafe { std::mem::zeroed::<sys::RemotePlayInput_t>() }; count as usize];
    let received = unsafe {
        sys::SteamAPI_ISteamRemotePlay_GetInput(steam_remote_play()?, inputs.as_mut_ptr(), count)
    };
    inputs.truncate(received.min(count) as usize);
    Ok(inputs.into_iter().map(remote_play_input_event).collect())
}

#[napi(js_name = "remotePlaySetMouseVisibility")]
pub fn remote_play_set_mouse_visibility(session_id: u32, visible: bool) -> Result<(), Error> {
    unsafe {
        sys::SteamAPI_ISteamRemotePlay_SetMouseVisibility(steam_remote_play()?, session_id, visible)
    };
    Ok(())
}

#[napi(js_name = "remotePlaySetMousePosition")]
pub fn remote_play_set_mouse_position(
    session_id: u32,
    normalized_x: f64,
    normalized_y: f64,
) -> Result<(), Error> {
    if !normalized_x.is_finite() || !normalized_y.is_finite() {
        return Err(Error::from_reason(
            "mouse position coordinates must be finite",
        ));
    }
    unsafe {
        sys::SteamAPI_ISteamRemotePlay_SetMousePosition(
            steam_remote_play()?,
            session_id,
            normalized_x as f32,
            normalized_y as f32,
        )
    };
    Ok(())
}

#[napi(js_name = "remotePlayCreateMouseCursor")]
pub fn remote_play_create_mouse_cursor(
    width: i32,
    height: i32,
    hot_x: i32,
    hot_y: i32,
    bgra: Buffer,
    pitch: i32,
) -> Result<u32, Error> {
    if width <= 0 || height <= 0 || pitch <= 0 {
        return Err(Error::from_reason(
            "mouse cursor width, height, and pitch must be positive",
        ));
    }
    let minimum_pitch = i64::from(width) * 4;
    if i64::from(pitch) < minimum_pitch {
        return Err(Error::from_reason(
            "mouse cursor pitch must be at least width * 4 bytes",
        ));
    }
    let required_len = (height as usize)
        .checked_mul(pitch as usize)
        .ok_or_else(|| Error::from_reason("mouse cursor BGRA buffer size overflows usize"))?;
    if bgra.len() < required_len {
        return Err(Error::from_reason(format!(
            "mouse cursor BGRA buffer must be at least {required_len} bytes"
        )));
    }
    Ok(unsafe {
        sys::SteamAPI_ISteamRemotePlay_CreateMouseCursor(
            steam_remote_play()?,
            width,
            height,
            hot_x,
            hot_y,
            bgra.as_ptr().cast::<c_void>(),
            pitch,
        )
    })
}

#[napi(js_name = "remotePlaySetMouseCursor")]
pub fn remote_play_set_mouse_cursor(session_id: u32, cursor_id: u32) -> Result<(), Error> {
    unsafe {
        sys::SteamAPI_ISteamRemotePlay_SetMouseCursor(steam_remote_play()?, session_id, cursor_id)
    };
    Ok(())
}

#[napi(js_name = "overlayActivateDialogToUser")]
pub fn overlay_activate_dialog_to_user(dialog: String, steam_id64: BigInt) -> Result<(), Error> {
    let dialog = cstring(dialog, "overlay dialog")?;
    unsafe {
        sys::SteamAPI_ISteamFriends_ActivateGameOverlayToUser(
            steam_friends()?,
            dialog.as_ptr(),
            bigint_to_u64(steam_id64, "steam id")?,
        );
    }
    Ok(())
}

#[napi(js_name = "overlayActivateInviteDialog")]
pub fn overlay_activate_invite_dialog(lobby_id: BigInt) -> Result<(), Error> {
    unsafe {
        sys::SteamAPI_ISteamFriends_ActivateGameOverlayInviteDialog(
            steam_friends()?,
            bigint_to_u64(lobby_id, "lobby id")?,
        );
    }
    Ok(())
}

#[napi(js_name = "overlayActivateToStore")]
pub fn overlay_activate_to_store(app_id: u32, flag: u32) -> Result<(), Error> {
    unsafe {
        sys::SteamAPI_ISteamFriends_ActivateGameOverlayToStore(
            steam_friends()?,
            app_id,
            overlay_to_store_flag_from_u32(flag)?,
        );
    }
    Ok(())
}

#[napi(js_name = "networkingSendP2PPacket")]
pub fn networking_send_p2p_packet(
    steam_id64: BigInt,
    send_type: u32,
    data: Buffer,
) -> Result<bool, Error> {
    let send_type = match send_type {
        0 => sys::EP2PSend::k_EP2PSendUnreliable,
        1 => sys::EP2PSend::k_EP2PSendUnreliableNoDelay,
        2 => sys::EP2PSend::k_EP2PSendReliable,
        3 => sys::EP2PSend::k_EP2PSendReliableWithBuffering,
        _ => return Err(Error::from_reason("invalid P2P send type")),
    };
    Ok(unsafe {
        sys::SteamAPI_ISteamNetworking_SendP2PPacket(
            steam_networking()?,
            bigint_to_u64(steam_id64, "steam id")?,
            data.as_ptr().cast::<c_void>(),
            data.len() as u32,
            send_type,
            0,
        )
    })
}

#[napi(js_name = "networkingIsP2PPacketAvailable")]
pub fn networking_is_p2p_packet_available() -> Result<u32, Error> {
    let mut size = 0u32;
    let ok = unsafe {
        sys::SteamAPI_ISteamNetworking_IsP2PPacketAvailable(steam_networking()?, &mut size, 0)
    };
    Ok(if ok { size } else { 0 })
}

#[napi(js_name = "networkingReadP2PPacket")]
pub fn networking_read_p2p_packet(size: u32) -> Result<Option<P2PPacket>, Error> {
    let networking = steam_networking()?;
    let mut data = vec![0u8; size as usize];
    let mut actual_size = 0u32;
    let mut remote: sys::CSteamID = unsafe { std::mem::zeroed() };
    let ok = unsafe {
        sys::SteamAPI_ISteamNetworking_ReadP2PPacket(
            networking,
            data.as_mut_ptr().cast::<c_void>(),
            size,
            &mut actual_size,
            &mut remote,
            0,
        )
    };
    if !ok {
        return Ok(None);
    }
    data.truncate(actual_size as usize);
    Ok(Some(P2PPacket {
        data: data.into(),
        size: actual_size,
        steam_id: steam_id_to_player(unsafe { std::mem::transmute::<sys::CSteamID, u64>(remote) }),
    }))
}

#[napi(js_name = "networkingAcceptP2PSession")]
pub fn networking_accept_p2p_session(steam_id64: BigInt) -> Result<(), Error> {
    let ok = unsafe {
        sys::SteamAPI_ISteamNetworking_AcceptP2PSessionWithUser(
            steam_networking()?,
            bigint_to_u64(steam_id64, "steam id")?,
        )
    };
    if ok {
        Ok(())
    } else {
        Err(Error::from_reason("Steam rejected P2P session"))
    }
}

#[napi(js_name = "networkingIdentityToString")]
pub fn networking_identity_to_string(identity: NetworkingIdentity) -> Result<String, Error> {
    let identity = networking_identity_from_input(identity)?;
    Ok(networking_identity_string(identity))
}

#[napi(js_name = "networkingIdentityParse")]
pub fn networking_identity_parse(text: String) -> Result<Option<NetworkingIdentityInfo>, Error> {
    let mut identity =
        unsafe { MaybeUninit::<sys::SteamNetworkingIdentity>::zeroed().assume_init() };
    unsafe { sys::SteamAPI_SteamNetworkingIdentity_Clear(&mut identity) };
    let text = cstring(text, "networking identity")?;
    let ok =
        unsafe { sys::SteamAPI_SteamNetworkingIdentity_ParseString(&mut identity, text.as_ptr()) };
    Ok(ok.then(|| networking_identity_info(identity)))
}

#[napi(js_name = "networkingMessagesSendMessageToUser")]
pub fn networking_messages_send_message_to_user(
    identity: NetworkingIdentity,
    data: Buffer,
    send_flags: Option<i32>,
    channel: Option<i32>,
) -> Result<u32, Error> {
    let identity = networking_identity_from_input(identity)?;
    let result = unsafe {
        sys::SteamAPI_ISteamNetworkingMessages_SendMessageToUser(
            steam_networking_messages()?,
            &identity,
            data.as_ptr().cast::<c_void>(),
            len_to_u32(data.len(), "networking message")?,
            send_flags.unwrap_or(sys::k_nSteamNetworkingSend_Reliable),
            channel.unwrap_or(0),
        )
    };
    Ok(result as u32)
}

#[napi(js_name = "networkingMessagesReceiveMessagesOnChannel")]
pub fn networking_messages_receive_messages_on_channel(
    channel: i32,
    max_messages: Option<u32>,
) -> Result<Vec<NetworkingMessage>, Error> {
    let max_messages = max_messages.unwrap_or(32).clamp(1, 1024);
    let mut messages = vec![ptr::null_mut(); max_messages as usize];
    let received = unsafe {
        sys::SteamAPI_ISteamNetworkingMessages_ReceiveMessagesOnChannel(
            steam_networking_messages()?,
            channel,
            messages.as_mut_ptr(),
            max_messages as i32,
        )
    };
    if received <= 0 {
        return Ok(Vec::new());
    }

    let mut output = Vec::with_capacity(received as usize);
    for message in messages.into_iter().take(received as usize) {
        if message.is_null() {
            continue;
        }
        let parsed = unsafe { networking_message_from_ptr(message) };
        unsafe { sys::SteamAPI_SteamNetworkingMessage_t_Release(message) };
        output.push(parsed);
    }
    Ok(output)
}

#[napi(js_name = "networkingMessagesAcceptSessionWithUser")]
pub fn networking_messages_accept_session_with_user(
    identity: NetworkingIdentity,
) -> Result<bool, Error> {
    let identity = networking_identity_from_input(identity)?;
    Ok(unsafe {
        sys::SteamAPI_ISteamNetworkingMessages_AcceptSessionWithUser(
            steam_networking_messages()?,
            &identity,
        )
    })
}

#[napi(js_name = "networkingMessagesCloseSessionWithUser")]
pub fn networking_messages_close_session_with_user(
    identity: NetworkingIdentity,
) -> Result<bool, Error> {
    let identity = networking_identity_from_input(identity)?;
    Ok(unsafe {
        sys::SteamAPI_ISteamNetworkingMessages_CloseSessionWithUser(
            steam_networking_messages()?,
            &identity,
        )
    })
}

#[napi(js_name = "networkingMessagesCloseChannelWithUser")]
pub fn networking_messages_close_channel_with_user(
    identity: NetworkingIdentity,
    channel: i32,
) -> Result<bool, Error> {
    let identity = networking_identity_from_input(identity)?;
    Ok(unsafe {
        sys::SteamAPI_ISteamNetworkingMessages_CloseChannelWithUser(
            steam_networking_messages()?,
            &identity,
            channel,
        )
    })
}

#[napi(js_name = "networkingMessagesGetSessionConnectionInfo")]
pub fn networking_messages_get_session_connection_info(
    identity: NetworkingIdentity,
) -> Result<NetworkingMessagesSessionConnectionInfo, Error> {
    let identity = networking_identity_from_input(identity)?;
    let mut info = unsafe { MaybeUninit::<sys::SteamNetConnectionInfo_t>::zeroed().assume_init() };
    let mut quick_status =
        unsafe { MaybeUninit::<sys::SteamNetConnectionRealTimeStatus_t>::zeroed().assume_init() };
    let state = unsafe {
        sys::SteamAPI_ISteamNetworkingMessages_GetSessionConnectionInfo(
            steam_networking_messages()?,
            &identity,
            &mut info,
            &mut quick_status,
        )
    };
    Ok(networking_messages_session_connection_info(
        state as i32,
        &info,
        &quick_status,
    ))
}

#[napi(js_name = "networkingUtilsInitRelayNetworkAccess")]
pub fn networking_utils_init_relay_network_access() -> Result<(), Error> {
    unsafe {
        sys::SteamAPI_ISteamNetworkingUtils_InitRelayNetworkAccess(steam_networking_utils()?)
    };
    Ok(())
}

#[napi(js_name = "networkingUtilsGetRelayNetworkStatus")]
pub fn networking_utils_get_relay_network_status() -> Result<NetworkingRelayNetworkStatus, Error> {
    let mut status =
        unsafe { MaybeUninit::<sys::SteamRelayNetworkStatus_t>::zeroed().assume_init() };
    let availability = unsafe {
        sys::SteamAPI_ISteamNetworkingUtils_GetRelayNetworkStatus(
            steam_networking_utils()?,
            &mut status,
        )
    };
    Ok(networking_relay_network_status(&status, availability))
}

#[napi(js_name = "networkingUtilsGetLocalPingLocation")]
pub fn networking_utils_get_local_ping_location() -> Result<NetworkingPingLocation, Error> {
    let utils = steam_networking_utils()?;
    let mut location =
        unsafe { MaybeUninit::<sys::SteamNetworkPingLocation_t>::zeroed().assume_init() };
    let age_seconds =
        unsafe { sys::SteamAPI_ISteamNetworkingUtils_GetLocalPingLocation(utils, &mut location) };
    Ok(NetworkingPingLocation {
        location: networking_ping_location_string(utils, &location),
        age_seconds: f64::from(age_seconds),
    })
}

#[napi(js_name = "networkingUtilsParsePingLocation")]
pub fn networking_utils_parse_ping_location(location: String) -> Result<Option<String>, Error> {
    let utils = steam_networking_utils()?;
    let location_string = cstring(location, "networking ping location")?;
    let mut output =
        unsafe { MaybeUninit::<sys::SteamNetworkPingLocation_t>::zeroed().assume_init() };
    let ok = unsafe {
        sys::SteamAPI_ISteamNetworkingUtils_ParsePingLocationString(
            utils,
            location_string.as_ptr(),
            &mut output,
        )
    };
    Ok(ok.then(|| networking_ping_location_string(utils, &output)))
}

#[napi(js_name = "networkingUtilsEstimatePingTimeBetweenTwoLocations")]
pub fn networking_utils_estimate_ping_time_between_two_locations(
    location1: String,
    location2: String,
) -> Result<i32, Error> {
    let utils = steam_networking_utils()?;
    let location1 = networking_ping_location_from_string(utils, location1)?;
    let location2 = networking_ping_location_from_string(utils, location2)?;
    Ok(unsafe {
        sys::SteamAPI_ISteamNetworkingUtils_EstimatePingTimeBetweenTwoLocations(
            utils, &location1, &location2,
        )
    })
}

#[napi(js_name = "networkingUtilsEstimatePingTimeFromLocalHost")]
pub fn networking_utils_estimate_ping_time_from_local_host(location: String) -> Result<i32, Error> {
    let utils = steam_networking_utils()?;
    let location = networking_ping_location_from_string(utils, location)?;
    Ok(unsafe {
        sys::SteamAPI_ISteamNetworkingUtils_EstimatePingTimeFromLocalHost(utils, &location)
    })
}

#[napi(js_name = "networkingUtilsCheckPingDataUpToDate")]
pub fn networking_utils_check_ping_data_up_to_date(
    max_age_seconds: Option<f64>,
) -> Result<bool, Error> {
    Ok(unsafe {
        sys::SteamAPI_ISteamNetworkingUtils_CheckPingDataUpToDate(
            steam_networking_utils()?,
            max_age_seconds.unwrap_or(60.0) as f32,
        )
    })
}

#[napi(js_name = "networkingUtilsGetPingToDataCenter")]
pub fn networking_utils_get_ping_to_data_center(
    pop_id: u32,
) -> Result<NetworkingPingDataCenter, Error> {
    let mut via_relay_pop = 0u32;
    let ping_ms = unsafe {
        sys::SteamAPI_ISteamNetworkingUtils_GetPingToDataCenter(
            steam_networking_utils()?,
            pop_id,
            &mut via_relay_pop,
        )
    };
    Ok(NetworkingPingDataCenter {
        ping_ms,
        via_relay_pop,
    })
}

#[napi(js_name = "networkingUtilsGetDirectPingToPop")]
pub fn networking_utils_get_direct_ping_to_pop(pop_id: u32) -> Result<i32, Error> {
    Ok(unsafe {
        sys::SteamAPI_ISteamNetworkingUtils_GetDirectPingToPOP(steam_networking_utils()?, pop_id)
    })
}

#[napi(js_name = "networkingUtilsGetPopCount")]
pub fn networking_utils_get_pop_count() -> Result<i32, Error> {
    Ok(unsafe { sys::SteamAPI_ISteamNetworkingUtils_GetPOPCount(steam_networking_utils()?) })
}

#[napi(js_name = "networkingUtilsGetPopList")]
pub fn networking_utils_get_pop_list(max_pops: Option<u32>) -> Result<Vec<u32>, Error> {
    let utils = steam_networking_utils()?;
    let capacity = max_pops
        .map(|value| {
            i32::try_from(value).map_err(|_| Error::from_reason("max POP count exceeds i32"))
        })
        .transpose()?
        .unwrap_or_else(|| unsafe { sys::SteamAPI_ISteamNetworkingUtils_GetPOPCount(utils) })
        .max(0);
    if capacity == 0 {
        return Ok(Vec::new());
    }
    let mut pops = vec![0u32; capacity as usize];
    let count = unsafe {
        sys::SteamAPI_ISteamNetworkingUtils_GetPOPList(utils, pops.as_mut_ptr(), capacity)
    };
    pops.truncate(count.max(0).min(capacity) as usize);
    Ok(pops)
}

#[napi(js_name = "networkingUtilsGetLocalTimestamp")]
pub fn networking_utils_get_local_timestamp() -> Result<BigInt, Error> {
    Ok(
        unsafe { sys::SteamAPI_ISteamNetworkingUtils_GetLocalTimestamp(steam_networking_utils()?) }
            .into(),
    )
}

#[napi(js_name = "networkingUtilsIsFakeIpv4")]
pub fn networking_utils_is_fake_ipv4(ipv4: u32) -> Result<bool, Error> {
    Ok(unsafe { sys::SteamAPI_ISteamNetworkingUtils_IsFakeIPv4(steam_networking_utils()?, ipv4) })
}

#[napi(js_name = "networkingUtilsGetIpv4FakeIpType")]
pub fn networking_utils_get_ipv4_fake_ip_type(ipv4: u32) -> Result<u32, Error> {
    Ok(unsafe {
        sys::SteamAPI_ISteamNetworkingUtils_GetIPv4FakeIPType(steam_networking_utils()?, ipv4)
            as u32
    })
}

#[napi(js_name = "networkingUtilsParseIpAddress")]
pub fn networking_utils_parse_ip_address(
    text: String,
) -> Result<Option<NetworkingIpAddressInfo>, Error> {
    let utils = steam_networking_utils()?;
    let mut address = unsafe { MaybeUninit::<sys::SteamNetworkingIPAddr>::zeroed().assume_init() };
    unsafe { sys::SteamAPI_SteamNetworkingIPAddr_Clear(&mut address) };
    let text = cstring(text, "networking IP address")?;
    let ok = unsafe {
        sys::SteamAPI_ISteamNetworkingUtils_SteamNetworkingIPAddr_ParseString(
            utils,
            &mut address,
            text.as_ptr(),
        )
    };
    Ok(ok.then(|| networking_ip_address_info(utils, address, true)))
}

#[napi(js_name = "networkingUtilsIpAddressToString")]
pub fn networking_utils_ip_address_to_string(
    address: NetworkingIpAddress,
    with_port: Option<bool>,
) -> Result<String, Error> {
    let utils = steam_networking_utils()?;
    let address = networking_ip_address_from_input(address)?;
    Ok(networking_ip_address_string(
        utils,
        &address,
        with_port.unwrap_or(true),
    ))
}

#[napi(js_name = "networkingUtilsGetIpAddressFakeIpType")]
pub fn networking_utils_get_ip_address_fake_ip_type(
    address: NetworkingIpAddress,
) -> Result<u32, Error> {
    let utils = steam_networking_utils()?;
    let address = networking_ip_address_from_input(address)?;
    Ok(unsafe {
        sys::SteamAPI_ISteamNetworkingUtils_SteamNetworkingIPAddr_GetFakeIPType(utils, &address)
            as u32
    })
}

#[napi(js_name = "networkingUtilsGetRealIdentityForFakeIp")]
pub fn networking_utils_get_real_identity_for_fake_ip(
    address: NetworkingIpAddress,
) -> Result<NetworkingFakeIpIdentity, Error> {
    let address = networking_ip_address_from_input(address)?;
    let mut identity =
        unsafe { MaybeUninit::<sys::SteamNetworkingIdentity>::zeroed().assume_init() };
    unsafe { sys::SteamAPI_SteamNetworkingIdentity_Clear(&mut identity) };
    let result = unsafe {
        sys::SteamAPI_ISteamNetworkingUtils_GetRealIdentityForFakeIP(
            steam_networking_utils()?,
            &address,
            &mut identity,
        )
    };
    Ok(NetworkingFakeIpIdentity {
        result: result as u32,
        identity: (result == sys::EResult::k_EResultOK).then(|| networking_identity_info(identity)),
    })
}

#[napi(js_name = "utilsGetServerRealTime")]
pub fn utils_get_server_real_time() -> Result<u32, Error> {
    Ok(unsafe { sys::SteamAPI_ISteamUtils_GetServerRealTime(steam_utils()?) })
}

#[napi(js_name = "utilsShowGamepadTextInput")]
pub async fn utils_show_gamepad_text_input(
    input_mode: u32,
    input_line_mode: u32,
    description: String,
    max_characters: u32,
    existing_text: Option<String>,
    timeout_seconds: Option<u32>,
) -> Result<Option<String>, Error> {
    crate::state::ensure_initialized()?;
    let utils = steam_utils()?;
    let description = cstring(description, "gamepad text input description")?;
    let existing_text = cstring(existing_text.unwrap_or_default(), "existing gamepad text")?;
    let input_mode = gamepad_text_input_mode_from_u32(input_mode)?;
    let input_line_mode = gamepad_text_input_line_mode_from_u32(input_line_mode)?;

    let (tx, rx) = oneshot::channel::<Option<String>>();
    let tx = Arc::new(Mutex::new(Some(tx)));
    let tx_for_callback = tx.clone();
    let _registration =
        crate::state::register_callback(CALLBACK_GAMEPAD_TEXT_INPUT_DISMISSED, move |param| {
            let event = unsafe { &*(param as *const sys::GamepadTextInputDismissed_t) };
            let submitted = unsafe { ptr::addr_of!(event.m_bSubmitted).read_unaligned() };
            let value = if submitted {
                entered_gamepad_text().ok().flatten()
            } else {
                None
            };
            if let Some(tx) = tx_for_callback
                .lock()
                .expect("gamepad text input sender poisoned")
                .take()
            {
                let _ = tx.send(value);
            }
        });

    let shown = unsafe {
        sys::SteamAPI_ISteamUtils_ShowGamepadTextInput(
            utils,
            input_mode,
            input_line_mode,
            description.as_ptr(),
            max_characters,
            existing_text.as_ptr(),
        )
    };
    if !shown {
        return Ok(None);
    }

    let timeout_seconds = u64::from(timeout_seconds.unwrap_or(300));
    match tokio::time::timeout(std::time::Duration::from_secs(timeout_seconds), rx).await {
        Ok(Ok(value)) => Ok(value),
        Ok(Err(err)) => Err(Error::from_reason(err.to_string())),
        Err(_) => Err(Error::from_reason("Steam gamepad text input timed out")),
    }
}

#[napi(js_name = "utilsShowFloatingGamepadTextInput")]
pub fn utils_show_floating_gamepad_text_input(
    mode: u32,
    x: i32,
    y: i32,
    width: i32,
    height: i32,
) -> Result<bool, Error> {
    Ok(unsafe {
        sys::SteamAPI_ISteamUtils_ShowFloatingGamepadTextInput(
            steam_utils()?,
            floating_gamepad_text_input_mode_from_u32(mode)?,
            x,
            y,
            width,
            height,
        )
    })
}

#[napi(js_name = "authGetSessionTicketWithSteamId")]
pub async fn auth_get_session_ticket_with_steam_id(
    steam_id64: BigInt,
    timeout_seconds: Option<u32>,
) -> Result<AuthTicket, Error> {
    let steam_id = bigint_to_u64(steam_id64, "steam id")?;
    let mut identity =
        unsafe { MaybeUninit::<sys::SteamNetworkingIdentity>::zeroed().assume_init() };
    unsafe {
        sys::SteamAPI_SteamNetworkingIdentity_Clear(&mut identity);
        sys::SteamAPI_SteamNetworkingIdentity_SetSteamID64(&mut identity, steam_id);
    }
    get_session_ticket(Some(identity), timeout_seconds).await
}

#[napi(js_name = "authGetSessionTicketWithIp")]
pub async fn auth_get_session_ticket_with_ip(
    ip: String,
    timeout_seconds: Option<u32>,
) -> Result<AuthTicket, Error> {
    let parsed = ip
        .parse::<IpAddr>()
        .map_err(|err| Error::from_reason(err.to_string()))?;
    let ipv4 = match parsed {
        IpAddr::V4(v4) => v4,
        IpAddr::V6(_) => {
            return Err(Error::from_reason(
                "IPv6 auth identities are not implemented yet",
            ))
        }
    };
    let mut identity =
        unsafe { MaybeUninit::<sys::SteamNetworkingIdentity>::zeroed().assume_init() };
    unsafe {
        sys::SteamAPI_SteamNetworkingIdentity_Clear(&mut identity);
        sys::SteamAPI_SteamNetworkingIdentity_SetIPv4Addr(&mut identity, u32::from(ipv4), 0);
    }
    get_session_ticket(Some(identity), timeout_seconds).await
}

#[napi(js_name = "registerSteamCallback")]
pub fn register_steam_callback(
    callback: i32,
    #[napi(ts_arg_type = "(value: any) => void")] handler: JsCallback<'_, Value>,
) -> Result<CallbackHandle, Error> {
    crate::state::ensure_initialized()?;
    let callback_id = callback_id_from_compat(callback)?;
    let threadsafe_handler: FatalThreadsafeFunction<Value> = handler
        .build_threadsafe_function::<Value>()
        .build_callback(|ctx| Ok(vec![ctx.value]))?;
    let registration = crate::state::register_callback(callback_id, move |param| {
        let value = unsafe { callback_to_json(callback, param) };
        threadsafe_handler.call(value, ThreadsafeFunctionCallMode::NonBlocking);
    });
    Ok(CallbackHandle {
        registration: Some(registration),
    })
}

#[napi(js_name = "matchmakingCreateLobby")]
pub async fn matchmaking_create_lobby(
    lobby_type: u32,
    max_members: u32,
) -> Result<LobbyResult, Error> {
    let call = unsafe {
        sys::SteamAPI_ISteamMatchmaking_CreateLobby(
            steam_matchmaking()?,
            lobby_type_from_u32(lobby_type)?,
            max_members as i32,
        )
    };
    let result: sys::LobbyCreated_t = wait_for_api_call(
        call,
        sys::LobbyCreated_t_k_iCallback as i32,
        DEFAULT_ASYNC_TIMEOUT_SECONDS,
    )
    .await?;
    let eresult = unsafe { ptr::addr_of!(result.m_eResult).read_unaligned() };
    if eresult != sys::EResult::k_EResultOK {
        return Err(Error::from_reason(format!(
            "Steam CreateLobby failed: {eresult:?}"
        )));
    }
    let id = unsafe { ptr::addr_of!(result.m_ulSteamIDLobby).read_unaligned() };
    Ok(LobbyResult { id: id.into() })
}

#[napi(js_name = "matchmakingJoinLobby")]
pub async fn matchmaking_join_lobby(lobby_id: BigInt) -> Result<LobbyResult, Error> {
    let lobby = bigint_to_u64(lobby_id, "lobby id")?;
    let call = unsafe { sys::SteamAPI_ISteamMatchmaking_JoinLobby(steam_matchmaking()?, lobby) };
    let result: sys::LobbyEnter_t = wait_for_api_call(
        call,
        sys::LobbyEnter_t_k_iCallback as i32,
        DEFAULT_ASYNC_TIMEOUT_SECONDS,
    )
    .await?;
    let response = unsafe { ptr::addr_of!(result.m_EChatRoomEnterResponse).read_unaligned() };
    if response != 1 {
        return Err(Error::from_reason(format!(
            "Steam JoinLobby failed: {response}"
        )));
    }
    Ok(LobbyResult { id: lobby.into() })
}

#[napi(js_name = "matchmakingGetLobbies")]
pub async fn matchmaking_get_lobbies() -> Result<Vec<LobbyResult>, Error> {
    let call = {
        let matchmaking = steam_matchmaking()?;
        unsafe { sys::SteamAPI_ISteamMatchmaking_RequestLobbyList(matchmaking) }
    };
    let result: sys::LobbyMatchList_t = wait_for_api_call(
        call,
        sys::LobbyMatchList_t_k_iCallback as i32,
        DEFAULT_ASYNC_TIMEOUT_SECONDS,
    )
    .await?;
    let count = unsafe { ptr::addr_of!(result.m_nLobbiesMatching).read_unaligned() };
    let matchmaking = steam_matchmaking()?;
    let mut lobbies = Vec::new();
    for index in 0..count {
        let id =
            unsafe { sys::SteamAPI_ISteamMatchmaking_GetLobbyByIndex(matchmaking, index as i32) };
        lobbies.push(LobbyResult { id: id.into() });
    }
    Ok(lobbies)
}

#[napi(js_name = "matchmakingLeaveLobby")]
pub fn matchmaking_leave_lobby(lobby_id: BigInt) -> Result<(), Error> {
    unsafe {
        sys::SteamAPI_ISteamMatchmaking_LeaveLobby(
            steam_matchmaking()?,
            bigint_to_u64(lobby_id, "lobby id")?,
        )
    };
    Ok(())
}

#[napi(js_name = "matchmakingGetLobbyMemberCount")]
pub fn matchmaking_get_lobby_member_count(lobby_id: BigInt) -> Result<u32, Error> {
    let count = unsafe {
        sys::SteamAPI_ISteamMatchmaking_GetNumLobbyMembers(
            steam_matchmaking()?,
            bigint_to_u64(lobby_id, "lobby id")?,
        )
    };
    Ok(count.max(0) as u32)
}

#[napi(js_name = "matchmakingGetLobbyMemberLimit")]
pub fn matchmaking_get_lobby_member_limit(lobby_id: BigInt) -> Result<Option<u32>, Error> {
    let limit = unsafe {
        sys::SteamAPI_ISteamMatchmaking_GetLobbyMemberLimit(
            steam_matchmaking()?,
            bigint_to_u64(lobby_id, "lobby id")?,
        )
    };
    Ok(if limit <= 0 { None } else { Some(limit as u32) })
}

#[napi(js_name = "matchmakingGetLobbyMembers")]
pub fn matchmaking_get_lobby_members(lobby_id: BigInt) -> Result<Vec<PlayerSteamId>, Error> {
    let matchmaking = steam_matchmaking()?;
    let lobby = bigint_to_u64(lobby_id, "lobby id")?;
    let count = unsafe { sys::SteamAPI_ISteamMatchmaking_GetNumLobbyMembers(matchmaking, lobby) };
    let mut members = Vec::new();
    for index in 0..count.max(0) {
        let id = unsafe {
            sys::SteamAPI_ISteamMatchmaking_GetLobbyMemberByIndex(matchmaking, lobby, index)
        };
        members.push(steam_id_to_player(id));
    }
    Ok(members)
}

#[napi(js_name = "matchmakingGetLobbyOwner")]
pub fn matchmaking_get_lobby_owner(lobby_id: BigInt) -> Result<PlayerSteamId, Error> {
    let id = unsafe {
        sys::SteamAPI_ISteamMatchmaking_GetLobbyOwner(
            steam_matchmaking()?,
            bigint_to_u64(lobby_id, "lobby id")?,
        )
    };
    Ok(steam_id_to_player(id))
}

#[napi(js_name = "matchmakingSetLobbyJoinable")]
pub fn matchmaking_set_lobby_joinable(lobby_id: BigInt, joinable: bool) -> Result<bool, Error> {
    Ok(unsafe {
        sys::SteamAPI_ISteamMatchmaking_SetLobbyJoinable(
            steam_matchmaking()?,
            bigint_to_u64(lobby_id, "lobby id")?,
            joinable,
        )
    })
}

#[napi(js_name = "matchmakingGetLobbyData")]
pub fn matchmaking_get_lobby_data(lobby_id: BigInt, key: String) -> Result<Option<String>, Error> {
    let key = cstring(key, "lobby data key")?;
    let value = unsafe {
        sys::SteamAPI_ISteamMatchmaking_GetLobbyData(
            steam_matchmaking()?,
            bigint_to_u64(lobby_id, "lobby id")?,
            key.as_ptr(),
        )
    };
    let value = string_from_ptr(value);
    Ok(if value.is_empty() { None } else { Some(value) })
}

#[napi(js_name = "matchmakingSetLobbyData")]
pub fn matchmaking_set_lobby_data(
    lobby_id: BigInt,
    key: String,
    value: String,
) -> Result<bool, Error> {
    let key = cstring(key, "lobby data key")?;
    let value = cstring(value, "lobby data value")?;
    Ok(unsafe {
        sys::SteamAPI_ISteamMatchmaking_SetLobbyData(
            steam_matchmaking()?,
            bigint_to_u64(lobby_id, "lobby id")?,
            key.as_ptr(),
            value.as_ptr(),
        )
    })
}

#[napi(js_name = "matchmakingDeleteLobbyData")]
pub fn matchmaking_delete_lobby_data(lobby_id: BigInt, key: String) -> Result<bool, Error> {
    let key = cstring(key, "lobby data key")?;
    Ok(unsafe {
        sys::SteamAPI_ISteamMatchmaking_DeleteLobbyData(
            steam_matchmaking()?,
            bigint_to_u64(lobby_id, "lobby id")?,
            key.as_ptr(),
        )
    })
}

#[napi(js_name = "matchmakingGetLobbyFullData")]
pub fn matchmaking_get_lobby_full_data(lobby_id: BigInt) -> Result<Value, Error> {
    let matchmaking = steam_matchmaking()?;
    let lobby = bigint_to_u64(lobby_id, "lobby id")?;
    let count = unsafe { sys::SteamAPI_ISteamMatchmaking_GetLobbyDataCount(matchmaking, lobby) };
    let mut map = serde_json::Map::new();
    for index in 0..count.max(0) {
        let mut key = vec![0i8; 256];
        let mut value = vec![0i8; 4096];
        let ok = unsafe {
            sys::SteamAPI_ISteamMatchmaking_GetLobbyDataByIndex(
                matchmaking,
                lobby,
                index,
                key.as_mut_ptr(),
                key.len() as i32,
                value.as_mut_ptr(),
                value.len() as i32,
            )
        };
        if ok {
            map.insert(
                c_buf_to_string(&key),
                Value::String(c_buf_to_string(&value)),
            );
        }
    }
    Ok(Value::Object(map))
}

#[napi(js_name = "workshopCreateItem")]
pub async fn workshop_create_item(app_id: Option<u32>) -> Result<UgcResult, Error> {
    let app_id = app_id.unwrap_or(unsafe { sys::SteamAPI_ISteamUtils_GetAppID(steam_utils()?) });
    let call = unsafe {
        sys::SteamAPI_ISteamUGC_CreateItem(
            steam_ugc()?,
            app_id,
            sys::EWorkshopFileType::k_EWorkshopFileTypeCommunity,
        )
    };
    let result: sys::CreateItemResult_t = wait_for_api_call(
        call,
        sys::CreateItemResult_t_k_iCallback as i32,
        DEFAULT_ASYNC_TIMEOUT_SECONDS,
    )
    .await?;
    let eresult = unsafe { ptr::addr_of!(result.m_eResult).read_unaligned() };
    if eresult != sys::EResult::k_EResultOK {
        return Err(Error::from_reason(format!(
            "Steam CreateItem failed: {eresult:?}"
        )));
    }
    Ok(UgcResult {
        item_id: unsafe { ptr::addr_of!(result.m_nPublishedFileId).read_unaligned() }.into(),
        needs_to_accept_agreement: unsafe {
            ptr::addr_of!(result.m_bUserNeedsToAcceptWorkshopLegalAgreement).read_unaligned()
        },
    })
}

#[napi(js_name = "workshopUpdateItem")]
pub async fn workshop_update_item(
    item_id: BigInt,
    update_details: Value,
    app_id: Option<u32>,
) -> Result<UgcResult, Error> {
    workshop_update_item_inner(item_id, update_details, app_id, None).await
}

#[napi(js_name = "workshopUpdateItemWithProgress")]
pub fn workshop_update_item_with_progress(
    env: Env,
    item_id: BigInt,
    update_details: Value,
    app_id: Option<u32>,
    #[napi(ts_arg_type = "(value: any) => void")] progress_handler: JsCallback<'_, Value>,
    progress_interval_ms: Option<u32>,
) -> Result<PromiseRaw<'static, UgcResult>, Error> {
    let threadsafe_handler: FatalThreadsafeFunction<Value> = progress_handler
        .build_threadsafe_function::<Value>()
        .build_callback(|ctx| Ok(vec![ctx.value]))?;
    let progress_interval =
        Duration::from_millis(u64::from(progress_interval_ms.unwrap_or(250).max(16)));
    let raw_env = env.raw();

    let promise = napi::bindgen_prelude::execute_tokio_future(
        raw_env,
        async move {
            let mut last_progress_emit = None::<Instant>;
            let mut emit_progress = move |handle: sys::UGCUpdateHandle_t| {
                let now = Instant::now();
                if last_progress_emit
                    .map(|last| now.duration_since(last) < progress_interval)
                    .unwrap_or(false)
                {
                    return;
                }

                last_progress_emit = Some(now);
                let Ok(ugc) = steam_ugc() else {
                    return;
                };
                threadsafe_handler.call(
                    workshop_update_progress_json(ugc, handle),
                    ThreadsafeFunctionCallMode::NonBlocking,
                );
            };

            workshop_update_item_inner(item_id, update_details, app_id, Some(&mut emit_progress))
                .await
        },
        |env, result| unsafe { UgcResult::to_napi_value(env, result) },
    )?;

    Ok(PromiseRaw::new(raw_env, promise))
}

type WorkshopProgressCallback<'a> = &'a mut (dyn FnMut(sys::UGCUpdateHandle_t) + Send);

async fn workshop_update_item_inner(
    item_id: BigInt,
    update_details: Value,
    app_id: Option<u32>,
    mut progress_callback: Option<WorkshopProgressCallback<'_>>,
) -> Result<UgcResult, Error> {
    let ugc = steam_ugc()?;
    let app_id = app_id.unwrap_or(unsafe { sys::SteamAPI_ISteamUtils_GetAppID(steam_utils()?) });
    let item_id = bigint_to_u64(item_id, "item id")?;
    let handle = unsafe { sys::SteamAPI_ISteamUGC_StartItemUpdate(ugc, app_id, item_id) };
    if handle == sys::k_UGCUpdateHandleInvalid {
        return Err(Error::from_reason(
            "Steam StartItemUpdate returned an invalid handle",
        ));
    }

    let mut keepalive: Vec<CString> = Vec::new();
    set_optional_item_string(
        ugc,
        handle,
        &update_details,
        "title",
        &mut keepalive,
        |ugc, handle, value| unsafe { sys::SteamAPI_ISteamUGC_SetItemTitle(ugc, handle, value) },
    )?;
    set_optional_item_string(
        ugc,
        handle,
        &update_details,
        "description",
        &mut keepalive,
        |ugc, handle, value| unsafe {
            sys::SteamAPI_ISteamUGC_SetItemDescription(ugc, handle, value)
        },
    )?;
    set_optional_item_string(
        ugc,
        handle,
        &update_details,
        "contentPath",
        &mut keepalive,
        |ugc, handle, value| unsafe { sys::SteamAPI_ISteamUGC_SetItemContent(ugc, handle, value) },
    )?;
    set_optional_item_string(
        ugc,
        handle,
        &update_details,
        "previewPath",
        &mut keepalive,
        |ugc, handle, value| unsafe { sys::SteamAPI_ISteamUGC_SetItemPreview(ugc, handle, value) },
    )?;

    if let Some(visibility) = update_details.get("visibility").and_then(Value::as_u64) {
        let visibility = match visibility {
            0 => sys::ERemoteStoragePublishedFileVisibility::k_ERemoteStoragePublishedFileVisibilityPublic,
            1 => sys::ERemoteStoragePublishedFileVisibility::k_ERemoteStoragePublishedFileVisibilityFriendsOnly,
            2 => sys::ERemoteStoragePublishedFileVisibility::k_ERemoteStoragePublishedFileVisibilityPrivate,
            3 => sys::ERemoteStoragePublishedFileVisibility::k_ERemoteStoragePublishedFileVisibilityUnlisted,
            _ => return Err(Error::from_reason("invalid workshop visibility")),
        };
        unsafe { sys::SteamAPI_ISteamUGC_SetItemVisibility(ugc, handle, visibility) };
    }

    if let Some(tags) = update_details.get("tags").and_then(Value::as_array) {
        let tag_strings: Vec<CString> = tags
            .iter()
            .filter_map(Value::as_str)
            .map(|tag| {
                CString::new(tag)
                    .map_err(|_| Error::from_reason("workshop tag contains a NUL byte"))
            })
            .collect::<Result<_, _>>()?;
        let mut pointers: Vec<*const c_char> = tag_strings.iter().map(|tag| tag.as_ptr()).collect();
        let tag_array = sys::SteamParamStringArray_t {
            m_ppStrings: pointers.as_mut_ptr(),
            m_nNumStrings: pointers.len() as i32,
        };
        unsafe { sys::SteamAPI_ISteamUGC_SetItemTags(ugc, handle, &tag_array, false) };
    }

    let change_note = update_details
        .get("changeNote")
        .and_then(Value::as_str)
        .unwrap_or("");
    let change_note = CString::new(change_note)
        .map_err(|_| Error::from_reason("change note contains a NUL byte"))?;
    let call =
        unsafe { sys::SteamAPI_ISteamUGC_SubmitItemUpdate(ugc, handle, change_note.as_ptr()) };
    if let Some(callback) = progress_callback.as_mut() {
        (*callback)(handle);
    }
    let result: sys::SubmitItemUpdateResult_t = wait_for_api_call_with_progress(
        call,
        sys::SubmitItemUpdateResult_t_k_iCallback as i32,
        DEFAULT_ASYNC_TIMEOUT_SECONDS,
        || {
            if let Some(callback) = progress_callback.as_mut() {
                (*callback)(handle);
            }
        },
    )
    .await?;
    if let Some(callback) = progress_callback.as_mut() {
        (*callback)(handle);
    }
    let eresult = unsafe { ptr::addr_of!(result.m_eResult).read_unaligned() };
    if eresult != sys::EResult::k_EResultOK {
        return Err(Error::from_reason(format!(
            "Steam SubmitItemUpdate failed: {eresult:?}"
        )));
    }
    drop(keepalive);
    Ok(UgcResult {
        item_id: unsafe { ptr::addr_of!(result.m_nPublishedFileId).read_unaligned() }.into(),
        needs_to_accept_agreement: unsafe {
            ptr::addr_of!(result.m_bUserNeedsToAcceptWorkshopLegalAgreement).read_unaligned()
        },
    })
}

#[napi(js_name = "workshopGetItemUpdateProgress")]
pub fn workshop_get_item_update_progress(handle: BigInt) -> Result<UpdateProgress, Error> {
    let ugc = steam_ugc()?;
    let handle = bigint_to_u64(handle, "update handle")?;
    let (status, progress, total) = workshop_update_progress(ugc, handle);
    Ok(UpdateProgress {
        status,
        progress: progress.into(),
        total: total.into(),
    })
}

fn workshop_update_progress(
    ugc: *mut sys::ISteamUGC,
    handle: sys::UGCUpdateHandle_t,
) -> (u32, u64, u64) {
    let mut progress = 0u64;
    let mut total = 0u64;
    let status = unsafe {
        sys::SteamAPI_ISteamUGC_GetItemUpdateProgress(ugc, handle, &mut progress, &mut total)
    };
    (status as u32, progress, total)
}

fn workshop_update_progress_json(
    ugc: *mut sys::ISteamUGC,
    handle: sys::UGCUpdateHandle_t,
) -> Value {
    let (status, progress, total) = workshop_update_progress(ugc, handle);
    serde_json::json!({
        "status": status,
        "progress": progress.to_string(),
        "total": total.to_string()
    })
}

#[napi(js_name = "workshopSubscribe")]
pub async fn workshop_subscribe(item_id: BigInt) -> Result<(), Error> {
    let item_id = bigint_to_u64(item_id, "item id")?;
    let call = unsafe { sys::SteamAPI_ISteamUGC_SubscribeItem(steam_ugc()?, item_id) };
    let result: sys::RemoteStorageSubscribePublishedFileResult_t = wait_for_api_call(
        call,
        sys::RemoteStorageSubscribePublishedFileResult_t_k_iCallback as i32,
        DEFAULT_ASYNC_TIMEOUT_SECONDS,
    )
    .await?;
    let eresult = unsafe { ptr::addr_of!(result.m_eResult).read_unaligned() };
    if eresult == sys::EResult::k_EResultOK {
        Ok(())
    } else {
        Err(Error::from_reason(format!(
            "Steam SubscribeItem failed: {eresult:?}"
        )))
    }
}

#[napi(js_name = "workshopUnsubscribe")]
pub async fn workshop_unsubscribe(item_id: BigInt) -> Result<(), Error> {
    let item_id = bigint_to_u64(item_id, "item id")?;
    let call = unsafe { sys::SteamAPI_ISteamUGC_UnsubscribeItem(steam_ugc()?, item_id) };
    let result: sys::RemoteStorageUnsubscribePublishedFileResult_t = wait_for_api_call(
        call,
        sys::RemoteStorageUnsubscribePublishedFileResult_t_k_iCallback as i32,
        DEFAULT_ASYNC_TIMEOUT_SECONDS,
    )
    .await?;
    let eresult = unsafe { ptr::addr_of!(result.m_eResult).read_unaligned() };
    if eresult == sys::EResult::k_EResultOK {
        Ok(())
    } else {
        Err(Error::from_reason(format!(
            "Steam UnsubscribeItem failed: {eresult:?}"
        )))
    }
}

#[napi(js_name = "workshopState")]
pub fn workshop_state(item_id: BigInt) -> Result<u32, Error> {
    Ok(unsafe {
        sys::SteamAPI_ISteamUGC_GetItemState(steam_ugc()?, bigint_to_u64(item_id, "item id")?)
    })
}

#[napi(js_name = "workshopInstallInfo")]
pub fn workshop_install_info(item_id: BigInt) -> Result<Option<WorkshopInstallInfo>, Error> {
    let mut size = 0u64;
    let mut timestamp = 0u32;
    let mut folder = vec![0i8; 4096];
    let ok = unsafe {
        sys::SteamAPI_ISteamUGC_GetItemInstallInfo(
            steam_ugc()?,
            bigint_to_u64(item_id, "item id")?,
            &mut size,
            folder.as_mut_ptr(),
            folder.len() as u32,
            &mut timestamp,
        )
    };
    Ok(if ok {
        Some(WorkshopInstallInfo {
            folder: c_buf_to_string(&folder),
            size_on_disk: size.into(),
            timestamp,
        })
    } else {
        None
    })
}

#[napi(js_name = "workshopDownloadInfo")]
pub fn workshop_download_info(item_id: BigInt) -> Result<Option<WorkshopDownloadInfo>, Error> {
    let mut current = 0u64;
    let mut total = 0u64;
    let ok = unsafe {
        sys::SteamAPI_ISteamUGC_GetItemDownloadInfo(
            steam_ugc()?,
            bigint_to_u64(item_id, "item id")?,
            &mut current,
            &mut total,
        )
    };
    Ok(if ok {
        Some(WorkshopDownloadInfo {
            current: current.into(),
            total: total.into(),
        })
    } else {
        None
    })
}

#[napi(js_name = "workshopDownload")]
pub fn workshop_download(item_id: BigInt, high_priority: bool) -> Result<bool, Error> {
    Ok(unsafe {
        sys::SteamAPI_ISteamUGC_DownloadItem(
            steam_ugc()?,
            bigint_to_u64(item_id, "item id")?,
            high_priority,
        )
    })
}

#[napi(js_name = "workshopGetSubscribedItems")]
pub fn workshop_get_subscribed_items() -> Result<Vec<BigInt>, Error> {
    let ugc = steam_ugc()?;
    let count = unsafe { sys::SteamAPI_ISteamUGC_GetNumSubscribedItems(ugc, false) };
    let mut ids = vec![0u64; count as usize];
    let written =
        unsafe { sys::SteamAPI_ISteamUGC_GetSubscribedItems(ugc, ids.as_mut_ptr(), count, false) };
    ids.truncate(written as usize);
    Ok(ids.into_iter().map(Into::into).collect())
}

#[napi(js_name = "workshopGetItems")]
pub async fn workshop_get_items(
    item_ids: Vec<BigInt>,
    query_config: Option<Value>,
) -> Result<WorkshopItemsResult, Error> {
    let mut ids: Vec<u64> = item_ids
        .into_iter()
        .map(|id| bigint_to_u64(id, "item id"))
        .collect::<Result<_, _>>()?;
    let handle;
    let call = {
        let ugc = steam_ugc()?;
        handle = unsafe {
            sys::SteamAPI_ISteamUGC_CreateQueryUGCDetailsRequest(
                ugc,
                ids.as_mut_ptr(),
                ids.len() as u32,
            )
        };
        apply_query_config(ugc, handle, query_config.as_ref())?;
        unsafe { sys::SteamAPI_ISteamUGC_SendQueryUGCRequest(ugc, handle) }
    };
    let result: sys::SteamUGCQueryCompleted_t = wait_for_api_call(
        call,
        sys::SteamUGCQueryCompleted_t_k_iCallback as i32,
        DEFAULT_ASYNC_TIMEOUT_SECONDS,
    )
    .await?;
    let ugc = steam_ugc()?;
    let items = collect_query_items(ugc, handle, &result)?;
    unsafe { sys::SteamAPI_ISteamUGC_ReleaseQueryUGCRequest(ugc, handle) };
    Ok(items)
}

#[napi(js_name = "workshopGetAllItems")]
pub async fn workshop_get_all_items(
    page: u32,
    query_type: u32,
    item_type: i32,
    creator_app_id: u32,
    consumer_app_id: u32,
    query_config: Option<Value>,
) -> Result<WorkshopItemsResult, Error> {
    let handle;
    let call = {
        let ugc = steam_ugc()?;
        handle = unsafe {
            sys::SteamAPI_ISteamUGC_CreateQueryAllUGCRequestPage(
                ugc,
                ugc_query_from_u32(query_type)?,
                ugc_matching_type_from_i32(item_type)?,
                creator_app_id,
                consumer_app_id,
                page,
            )
        };
        apply_query_config(ugc, handle, query_config.as_ref())?;
        unsafe { sys::SteamAPI_ISteamUGC_SendQueryUGCRequest(ugc, handle) }
    };
    let result: sys::SteamUGCQueryCompleted_t = wait_for_api_call(
        call,
        sys::SteamUGCQueryCompleted_t_k_iCallback as i32,
        DEFAULT_ASYNC_TIMEOUT_SECONDS,
    )
    .await?;
    let ugc = steam_ugc()?;
    let items = collect_query_items(ugc, handle, &result)?;
    unsafe { sys::SteamAPI_ISteamUGC_ReleaseQueryUGCRequest(ugc, handle) };
    Ok(items)
}

#[napi(js_name = "workshopGetUserItems")]
pub async fn workshop_get_user_items(
    page: u32,
    account_id: u32,
    list_type: u32,
    item_type: i32,
    sort_order: u32,
    creator_app_id: u32,
    consumer_app_id: u32,
    query_config: Option<Value>,
) -> Result<WorkshopItemsResult, Error> {
    let handle;
    let call = {
        let ugc = steam_ugc()?;
        handle = unsafe {
            sys::SteamAPI_ISteamUGC_CreateQueryUserUGCRequest(
                ugc,
                account_id,
                user_ugc_list_from_u32(list_type)?,
                ugc_matching_type_from_i32(item_type)?,
                user_ugc_sort_order_from_u32(sort_order)?,
                creator_app_id,
                consumer_app_id,
                page,
            )
        };
        apply_query_config(ugc, handle, query_config.as_ref())?;
        unsafe { sys::SteamAPI_ISteamUGC_SendQueryUGCRequest(ugc, handle) }
    };
    let result: sys::SteamUGCQueryCompleted_t = wait_for_api_call(
        call,
        sys::SteamUGCQueryCompleted_t_k_iCallback as i32,
        DEFAULT_ASYNC_TIMEOUT_SECONDS,
    )
    .await?;
    let ugc = steam_ugc()?;
    let items = collect_query_items(ugc, handle, &result)?;
    unsafe { sys::SteamAPI_ISteamUGC_ReleaseQueryUGCRequest(ugc, handle) };
    Ok(items)
}

fn steam_apps() -> Result<*mut sys::ISteamApps, Error> {
    crate::state::ensure_initialized()?;
    non_null(unsafe { sys::SteamAPI_SteamApps_v009() }, "ISteamApps")
}

fn steam_remote_storage() -> Result<*mut sys::ISteamRemoteStorage, Error> {
    crate::state::ensure_initialized()?;
    non_null(
        unsafe { sys::SteamAPI_SteamRemoteStorage_v016() },
        "ISteamRemoteStorage",
    )
}

fn steam_http() -> Result<*mut sys::ISteamHTTP, Error> {
    crate::state::ensure_initialized()?;
    non_null(unsafe { sys::SteamAPI_SteamHTTP_v003() }, "ISteamHTTP")
}

fn steam_parties() -> Result<*mut sys::ISteamParties, Error> {
    crate::state::ensure_initialized()?;
    non_null(
        unsafe { sys::SteamAPI_SteamParties_v002() },
        "ISteamParties",
    )
}

fn steam_inventory() -> Result<*mut sys::ISteamInventory, Error> {
    crate::state::ensure_initialized()?;
    non_null(
        unsafe { sys::SteamAPI_SteamInventory_v003() },
        "ISteamInventory",
    )
}

fn steam_input() -> Result<*mut sys::ISteamInput, Error> {
    crate::state::ensure_initialized()?;
    non_null(unsafe { sys::SteamAPI_SteamInput_v006() }, "ISteamInput")
}

fn steam_networking() -> Result<*mut sys::ISteamNetworking, Error> {
    crate::state::ensure_initialized()?;
    non_null(
        unsafe { sys::SteamAPI_SteamNetworking_v006() },
        "ISteamNetworking",
    )
}

fn steam_networking_messages() -> Result<*mut sys::ISteamNetworkingMessages, Error> {
    crate::state::ensure_initialized()?;
    non_null(
        unsafe { sys::SteamAPI_SteamNetworkingMessages_SteamAPI_v002() },
        "ISteamNetworkingMessages",
    )
}

fn steam_networking_utils() -> Result<*mut sys::ISteamNetworkingUtils, Error> {
    crate::state::ensure_initialized()?;
    non_null(
        unsafe { sys::SteamAPI_SteamNetworkingUtils_SteamAPI_v004() },
        "ISteamNetworkingUtils",
    )
}

fn steam_matchmaking() -> Result<*mut sys::ISteamMatchmaking, Error> {
    crate::state::ensure_initialized()?;
    non_null(
        unsafe { sys::SteamAPI_SteamMatchmaking_v009() },
        "ISteamMatchmaking",
    )
}

fn steam_ugc() -> Result<*mut sys::ISteamUGC, Error> {
    crate::state::ensure_initialized()?;
    non_null(unsafe { sys::SteamAPI_SteamUGC_v021() }, "ISteamUGC")
}

fn steam_screenshots() -> Result<*mut sys::ISteamScreenshots, Error> {
    crate::state::ensure_initialized()?;
    non_null(
        unsafe { sys::SteamAPI_SteamScreenshots_v003() },
        "ISteamScreenshots",
    )
}

fn steam_music() -> Result<*mut sys::ISteamMusic, Error> {
    crate::state::ensure_initialized()?;
    non_null(unsafe { sys::SteamAPI_SteamMusic_v001() }, "ISteamMusic")
}

fn steam_video() -> Result<*mut sys::ISteamVideo, Error> {
    crate::state::ensure_initialized()?;
    non_null(unsafe { sys::SteamAPI_SteamVideo_v007() }, "ISteamVideo")
}

fn steam_parental_settings() -> Result<*mut sys::ISteamParentalSettings, Error> {
    crate::state::ensure_initialized()?;
    non_null(
        unsafe { sys::SteamAPI_SteamParentalSettings_v001() },
        "ISteamParentalSettings",
    )
}

fn steam_timeline() -> Result<*mut sys::ISteamTimeline, Error> {
    crate::state::ensure_initialized()?;
    non_null(
        unsafe { sys::SteamAPI_SteamTimeline_v004() },
        "ISteamTimeline",
    )
}

fn steam_remote_play() -> Result<*mut sys::ISteamRemotePlay, Error> {
    crate::state::ensure_initialized()?;
    non_null(
        unsafe { sys::SteamAPI_SteamRemotePlay_v004() },
        "ISteamRemotePlay",
    )
}

fn vr_screenshot_type_from_u32(value: u32) -> Result<sys::EVRScreenshotType, Error> {
    match value {
        0 => Ok(sys::EVRScreenshotType::k_EVRScreenshotType_None),
        1 => Ok(sys::EVRScreenshotType::k_EVRScreenshotType_Mono),
        2 => Ok(sys::EVRScreenshotType::k_EVRScreenshotType_Stereo),
        3 => Ok(sys::EVRScreenshotType::k_EVRScreenshotType_MonoCubemap),
        4 => Ok(sys::EVRScreenshotType::k_EVRScreenshotType_MonoPanorama),
        5 => Ok(sys::EVRScreenshotType::k_EVRScreenshotType_StereoPanorama),
        _ => Err(Error::from_reason(format!(
            "invalid VR screenshot type {value}"
        ))),
    }
}

fn parental_feature_from_u32(value: u32) -> Result<sys::EParentalFeature, Error> {
    match value {
        0 => Ok(sys::EParentalFeature::k_EFeatureInvalid),
        1 => Ok(sys::EParentalFeature::k_EFeatureStore),
        2 => Ok(sys::EParentalFeature::k_EFeatureCommunity),
        3 => Ok(sys::EParentalFeature::k_EFeatureProfile),
        4 => Ok(sys::EParentalFeature::k_EFeatureFriends),
        5 => Ok(sys::EParentalFeature::k_EFeatureNews),
        6 => Ok(sys::EParentalFeature::k_EFeatureTrading),
        7 => Ok(sys::EParentalFeature::k_EFeatureSettings),
        8 => Ok(sys::EParentalFeature::k_EFeatureConsole),
        9 => Ok(sys::EParentalFeature::k_EFeatureBrowser),
        10 => Ok(sys::EParentalFeature::k_EFeatureParentalSetup),
        11 => Ok(sys::EParentalFeature::k_EFeatureLibrary),
        12 => Ok(sys::EParentalFeature::k_EFeatureTest),
        13 => Ok(sys::EParentalFeature::k_EFeatureSiteLicense),
        14 => Ok(sys::EParentalFeature::k_EFeatureKioskMode_Deprecated),
        _ => Err(Error::from_reason(format!(
            "invalid parental feature {value}"
        ))),
    }
}

fn overlay_to_store_flag_from_u32(value: u32) -> Result<sys::EOverlayToStoreFlag, Error> {
    #[cfg(windows)]
    {
        let value = i32::try_from(value)
            .map_err(|_| Error::from_reason(format!("invalid overlay store flag {value}")))?;
        Ok(sys::EOverlayToStoreFlag(value))
    }

    #[cfg(not(windows))]
    {
        Ok(sys::EOverlayToStoreFlag(value))
    }
}

fn leaderboard_sort_method_from_u32(value: u32) -> Result<sys::ELeaderboardSortMethod, Error> {
    match value {
        0 => Ok(sys::ELeaderboardSortMethod::k_ELeaderboardSortMethodNone),
        1 => Ok(sys::ELeaderboardSortMethod::k_ELeaderboardSortMethodAscending),
        2 => Ok(sys::ELeaderboardSortMethod::k_ELeaderboardSortMethodDescending),
        _ => Err(Error::from_reason(format!(
            "invalid leaderboard sort method {value}"
        ))),
    }
}

fn leaderboard_display_type_from_u32(value: u32) -> Result<sys::ELeaderboardDisplayType, Error> {
    match value {
        0 => Ok(sys::ELeaderboardDisplayType::k_ELeaderboardDisplayTypeNone),
        1 => Ok(sys::ELeaderboardDisplayType::k_ELeaderboardDisplayTypeNumeric),
        2 => Ok(sys::ELeaderboardDisplayType::k_ELeaderboardDisplayTypeTimeSeconds),
        3 => Ok(sys::ELeaderboardDisplayType::k_ELeaderboardDisplayTypeTimeMilliSeconds),
        _ => Err(Error::from_reason(format!(
            "invalid leaderboard display type {value}"
        ))),
    }
}

fn leaderboard_data_request_from_u32(value: u32) -> Result<sys::ELeaderboardDataRequest, Error> {
    match value {
        0 => Ok(sys::ELeaderboardDataRequest::k_ELeaderboardDataRequestGlobal),
        1 => Ok(sys::ELeaderboardDataRequest::k_ELeaderboardDataRequestGlobalAroundUser),
        2 => Ok(sys::ELeaderboardDataRequest::k_ELeaderboardDataRequestFriends),
        3 => Ok(sys::ELeaderboardDataRequest::k_ELeaderboardDataRequestUsers),
        _ => Err(Error::from_reason(format!(
            "invalid leaderboard data request {value}"
        ))),
    }
}

fn leaderboard_upload_score_method_from_u32(
    value: u32,
) -> Result<sys::ELeaderboardUploadScoreMethod, Error> {
    match value {
        0 => Ok(sys::ELeaderboardUploadScoreMethod::k_ELeaderboardUploadScoreMethodNone),
        1 => Ok(sys::ELeaderboardUploadScoreMethod::k_ELeaderboardUploadScoreMethodKeepBest),
        2 => Ok(sys::ELeaderboardUploadScoreMethod::k_ELeaderboardUploadScoreMethodForceUpdate),
        _ => Err(Error::from_reason(format!(
            "invalid leaderboard upload score method {value}"
        ))),
    }
}

fn user_stats_received_result(result: sys::UserStatsReceived_t) -> UserStatsReceivedResult {
    UserStatsReceivedResult {
        game_id: unsafe { ptr::addr_of!(result.m_nGameID).read_unaligned() }.into(),
        result: unsafe { ptr::addr_of!(result.m_eResult).read_unaligned() } as u32,
        steam_id: csteam_id_to_player(unsafe {
            ptr::addr_of!(result.m_steamIDUser).read_unaligned()
        }),
    }
}

fn global_achievement_info(
    iterator: i32,
    name: &[c_char; 128],
    percent: f32,
    achieved: bool,
) -> Result<Option<GlobalAchievementInfo>, Error> {
    if iterator == -1 {
        return Ok(None);
    }
    Ok(Some(GlobalAchievementInfo {
        iterator,
        name: unsafe { fixed_char_array_to_string(name.as_ptr(), name.len()) },
        percent: f64::from(percent),
        achieved,
    }))
}

fn leaderboard_details_max(details_max: Option<u32>) -> i32 {
    details_max
        .unwrap_or(LEADERBOARD_DETAILS_MAX)
        .min(LEADERBOARD_DETAILS_MAX) as i32
}

fn leaderboard_find_result(result: sys::LeaderboardFindResult_t) -> LeaderboardFindResult {
    LeaderboardFindResult {
        leaderboard: unsafe { ptr::addr_of!(result.m_hSteamLeaderboard).read_unaligned() }.into(),
        found: unsafe { ptr::addr_of!(result.m_bLeaderboardFound).read_unaligned() } != 0,
    }
}

fn leaderboard_scores_downloaded(
    stats: *mut sys::ISteamUserStats,
    result: sys::LeaderboardScoresDownloaded_t,
    details_max: i32,
) -> Result<LeaderboardScoresDownloaded, Error> {
    let leaderboard = unsafe { ptr::addr_of!(result.m_hSteamLeaderboard).read_unaligned() };
    let entries_handle =
        unsafe { ptr::addr_of!(result.m_hSteamLeaderboardEntries).read_unaligned() };
    let entry_count = unsafe { ptr::addr_of!(result.m_cEntryCount).read_unaligned() };
    let mut entries = Vec::with_capacity(entry_count.max(0) as usize);
    for index in 0..entry_count {
        if let Some(entry) =
            downloaded_leaderboard_entry(stats, entries_handle, index, details_max)?
        {
            entries.push(entry);
        }
    }
    Ok(LeaderboardScoresDownloaded {
        leaderboard: leaderboard.into(),
        entries_handle: entries_handle.into(),
        entry_count,
        entries,
    })
}

fn downloaded_leaderboard_entry(
    stats: *mut sys::ISteamUserStats,
    entries_handle: u64,
    index: i32,
    details_max: i32,
) -> Result<Option<LeaderboardEntry>, Error> {
    if index < 0 {
        return Ok(None);
    }
    let mut raw_entry = MaybeUninit::<sys::LeaderboardEntry_t>::zeroed();
    let mut details = vec![0i32; details_max.max(0) as usize];
    let details_ptr = if details.is_empty() {
        ptr::null_mut()
    } else {
        details.as_mut_ptr()
    };
    let ok = unsafe {
        sys::SteamAPI_ISteamUserStats_GetDownloadedLeaderboardEntry(
            stats,
            entries_handle,
            index,
            raw_entry.as_mut_ptr(),
            details_ptr,
            details_max,
        )
    };
    if !ok {
        return Ok(None);
    }
    let raw_entry = unsafe { raw_entry.assume_init() };
    let details_count = unsafe { ptr::addr_of!(raw_entry.m_cDetails).read_unaligned() }
        .max(0)
        .min(details_max) as usize;
    details.truncate(details_count);
    Ok(Some(LeaderboardEntry {
        steam_id: csteam_id_to_player(unsafe {
            ptr::addr_of!(raw_entry.m_steamIDUser).read_unaligned()
        }),
        global_rank: unsafe { ptr::addr_of!(raw_entry.m_nGlobalRank).read_unaligned() },
        score: unsafe { ptr::addr_of!(raw_entry.m_nScore).read_unaligned() },
        details,
        ugc: unsafe { ptr::addr_of!(raw_entry.m_hUGC).read_unaligned() }.into(),
    }))
}

fn timeline_game_mode_from_u32(value: u32) -> Result<sys::ETimelineGameMode, Error> {
    match value {
        0 => Ok(sys::ETimelineGameMode::k_ETimelineGameMode_Invalid),
        1 => Ok(sys::ETimelineGameMode::k_ETimelineGameMode_Playing),
        2 => Ok(sys::ETimelineGameMode::k_ETimelineGameMode_Staging),
        3 => Ok(sys::ETimelineGameMode::k_ETimelineGameMode_Menus),
        4 => Ok(sys::ETimelineGameMode::k_ETimelineGameMode_LoadingScreen),
        5 => Ok(sys::ETimelineGameMode::k_ETimelineGameMode_Max),
        _ => Err(Error::from_reason(format!(
            "invalid timeline game mode {value}"
        ))),
    }
}

fn timeline_clip_priority_from_u32(value: u32) -> Result<sys::ETimelineEventClipPriority, Error> {
    match value {
        0 => Ok(sys::ETimelineEventClipPriority::k_ETimelineEventClipPriority_Invalid),
        1 => Ok(sys::ETimelineEventClipPriority::k_ETimelineEventClipPriority_None),
        2 => Ok(sys::ETimelineEventClipPriority::k_ETimelineEventClipPriority_Standard),
        3 => Ok(sys::ETimelineEventClipPriority::k_ETimelineEventClipPriority_Featured),
        _ => Err(Error::from_reason(format!(
            "invalid timeline clip priority {value}"
        ))),
    }
}

fn remote_play_session_info(
    remote_play: *mut sys::ISteamRemotePlay,
    id: u32,
) -> RemotePlaySessionInfo {
    let mut width = 0;
    let mut height = 0;
    let has_resolution = unsafe {
        sys::SteamAPI_ISteamRemotePlay_BGetSessionClientResolution(
            remote_play,
            id,
            &mut width,
            &mut height,
        )
    };

    RemotePlaySessionInfo {
        id,
        remote_play_together: unsafe {
            sys::SteamAPI_ISteamRemotePlay_BSessionRemotePlayTogether(remote_play, id)
        },
        steam_id: steam_id_to_player(unsafe {
            sys::SteamAPI_ISteamRemotePlay_GetSessionSteamID(remote_play, id)
        }),
        guest_id: unsafe { sys::SteamAPI_ISteamRemotePlay_GetSessionGuestID(remote_play, id) },
        small_avatar: unsafe {
            sys::SteamAPI_ISteamRemotePlay_GetSmallSessionAvatar(remote_play, id)
        },
        medium_avatar: unsafe {
            sys::SteamAPI_ISteamRemotePlay_GetMediumSessionAvatar(remote_play, id)
        },
        large_avatar: unsafe {
            sys::SteamAPI_ISteamRemotePlay_GetLargeSessionAvatar(remote_play, id)
        },
        client_name: string_from_ptr(unsafe {
            sys::SteamAPI_ISteamRemotePlay_GetSessionClientName(remote_play, id)
        }),
        client_form_factor: unsafe {
            sys::SteamAPI_ISteamRemotePlay_GetSessionClientFormFactor(remote_play, id) as u32
        },
        resolution: has_resolution.then_some(RemotePlayResolution { width, height }),
    }
}

fn remote_play_input_event(input: sys::RemotePlayInput_t) -> RemotePlayInputEvent {
    let input_type = input.m_eType as u32;
    let mut event = RemotePlayInputEvent {
        session_id: input.m_unSessionID,
        input_type,
        absolute: None,
        normalized_x: None,
        normalized_y: None,
        delta_x: None,
        delta_y: None,
        mouse_button: None,
        wheel_direction: None,
        wheel_amount: None,
        scancode: None,
        modifiers: None,
        keycode: None,
    };

    unsafe {
        match input.m_eType {
            sys::ERemotePlayInputType::k_ERemotePlayInputMouseMotion => {
                let motion = input.__bindgen_anon_1.m_MouseMotion;
                event.absolute = Some(motion.m_bAbsolute);
                event.normalized_x = Some(f64::from(motion.m_flNormalizedX));
                event.normalized_y = Some(f64::from(motion.m_flNormalizedY));
                event.delta_x = Some(motion.m_nDeltaX);
                event.delta_y = Some(motion.m_nDeltaY);
            }
            sys::ERemotePlayInputType::k_ERemotePlayInputMouseButtonDown
            | sys::ERemotePlayInputType::k_ERemotePlayInputMouseButtonUp => {
                event.mouse_button = Some(input.__bindgen_anon_1.m_eMouseButton as u32);
            }
            sys::ERemotePlayInputType::k_ERemotePlayInputMouseWheel => {
                let wheel = input.__bindgen_anon_1.m_MouseWheel;
                event.wheel_direction = Some(wheel.m_eDirection as u32);
                event.wheel_amount = Some(f64::from(wheel.m_flAmount));
            }
            sys::ERemotePlayInputType::k_ERemotePlayInputKeyDown
            | sys::ERemotePlayInputType::k_ERemotePlayInputKeyUp => {
                let key = input.__bindgen_anon_1.m_Key;
                event.scancode = Some(key.m_eScancode);
                event.modifiers = Some(key.m_unModifiers);
                event.keycode = Some(key.m_unKeycode);
            }
            _ => {}
        }
    }

    event
}

fn bigint_to_u64(value: BigInt, label: &str) -> Result<u64, Error> {
    let (negative, value, lossless) = value.get_u64();
    if negative || !lossless {
        Err(Error::from_reason(format!(
            "{label} must be a non-negative 64-bit bigint"
        )))
    } else {
        Ok(value)
    }
}

fn bigint_to_i64(value: BigInt, label: &str) -> Result<i64, Error> {
    let (value, lossless) = value.get_i64();
    if !lossless {
        Err(Error::from_reason(format!(
            "{label} must be a 64-bit bigint"
        )))
    } else {
        Ok(value)
    }
}

fn http_method_from_u32(value: u32) -> Result<sys::EHTTPMethod, Error> {
    match value {
        0 => Ok(sys::EHTTPMethod::k_EHTTPMethodInvalid),
        1 => Ok(sys::EHTTPMethod::k_EHTTPMethodGET),
        2 => Ok(sys::EHTTPMethod::k_EHTTPMethodHEAD),
        3 => Ok(sys::EHTTPMethod::k_EHTTPMethodPOST),
        4 => Ok(sys::EHTTPMethod::k_EHTTPMethodPUT),
        5 => Ok(sys::EHTTPMethod::k_EHTTPMethodDELETE),
        6 => Ok(sys::EHTTPMethod::k_EHTTPMethodOPTIONS),
        7 => Ok(sys::EHTTPMethod::k_EHTTPMethodPATCH),
        _ => Err(Error::from_reason(format!("invalid HTTP method {value}"))),
    }
}

fn http_request_completed_result(result: &sys::HTTPRequestCompleted_t) -> HttpRequestCompleted {
    HttpRequestCompleted {
        request: unsafe { ptr::addr_of!(result.m_hRequest).read_unaligned() },
        context_value: unsafe { ptr::addr_of!(result.m_ulContextValue).read_unaligned() }.into(),
        request_successful: unsafe { ptr::addr_of!(result.m_bRequestSuccessful).read_unaligned() },
        status_code: unsafe { ptr::addr_of!(result.m_eStatusCode).read_unaligned() } as u32,
        body_size: unsafe { ptr::addr_of!(result.m_unBodySize).read_unaligned() },
    }
}

fn http_request_headers_received_result(
    result: &sys::HTTPRequestHeadersReceived_t,
) -> HttpRequestHeadersReceived {
    HttpRequestHeadersReceived {
        request: unsafe { ptr::addr_of!(result.m_hRequest).read_unaligned() },
        context_value: unsafe { ptr::addr_of!(result.m_ulContextValue).read_unaligned() }.into(),
    }
}

fn party_beacon_location_type_from_u32(
    value: u32,
) -> Result<sys::ESteamPartyBeaconLocationType, Error> {
    match value {
        0 => Ok(sys::ESteamPartyBeaconLocationType::k_ESteamPartyBeaconLocationType_Invalid),
        1 => Ok(sys::ESteamPartyBeaconLocationType::k_ESteamPartyBeaconLocationType_ChatGroup),
        2 => Ok(sys::ESteamPartyBeaconLocationType::k_ESteamPartyBeaconLocationType_Max),
        _ => Err(Error::from_reason(format!(
            "invalid party beacon location type {value}"
        ))),
    }
}

fn party_beacon_location_data_from_u32(
    value: u32,
) -> Result<sys::ESteamPartyBeaconLocationData, Error> {
    match value {
        0 => Ok(sys::ESteamPartyBeaconLocationData::k_ESteamPartyBeaconLocationDataInvalid),
        1 => Ok(sys::ESteamPartyBeaconLocationData::k_ESteamPartyBeaconLocationDataName),
        2 => Ok(sys::ESteamPartyBeaconLocationData::k_ESteamPartyBeaconLocationDataIconURLSmall),
        3 => Ok(sys::ESteamPartyBeaconLocationData::k_ESteamPartyBeaconLocationDataIconURLMedium),
        4 => Ok(sys::ESteamPartyBeaconLocationData::k_ESteamPartyBeaconLocationDataIconURLLarge),
        _ => Err(Error::from_reason(format!(
            "invalid party beacon location data type {value}"
        ))),
    }
}

fn party_beacon_location(location: sys::SteamPartyBeaconLocation_t) -> PartyBeaconLocation {
    PartyBeaconLocation {
        location_type: unsafe { ptr::addr_of!(location.m_eType).read_unaligned() } as u32,
        location_id: unsafe { ptr::addr_of!(location.m_ulLocationID).read_unaligned() }.into(),
    }
}

fn party_beacon_location_to_sys(
    location: PartyBeaconLocation,
) -> Result<sys::SteamPartyBeaconLocation_t, Error> {
    Ok(sys::SteamPartyBeaconLocation_t {
        m_eType: party_beacon_location_type_from_u32(location.location_type)?,
        m_ulLocationID: bigint_to_u64(location.location_id, "party beacon location id")?,
    })
}

fn join_party_result(result: &sys::JoinPartyCallback_t) -> JoinPartyResult {
    JoinPartyResult {
        result: unsafe { ptr::addr_of!(result.m_eResult).read_unaligned() } as u32,
        beacon: unsafe { ptr::addr_of!(result.m_ulBeaconID).read_unaligned() }.into(),
        owner: csteam_id_to_player(unsafe {
            ptr::addr_of!(result.m_SteamIDBeaconOwner).read_unaligned()
        }),
        connect_string: c_buf_to_string(unsafe { &*ptr::addr_of!(result.m_rgchConnectString) }),
    }
}

fn create_beacon_result(result: &sys::CreateBeaconCallback_t) -> CreateBeaconResult {
    CreateBeaconResult {
        result: unsafe { ptr::addr_of!(result.m_eResult).read_unaligned() } as u32,
        beacon: unsafe { ptr::addr_of!(result.m_ulBeaconID).read_unaligned() }.into(),
    }
}

fn inventory_result_handle(ok: bool, result_handle: i32) -> Option<i32> {
    (ok && result_handle != sys::k_SteamInventoryResultInvalid).then_some(result_handle)
}

fn inventory_item_detail(item: sys::SteamItemDetails_t) -> InventoryItemDetail {
    InventoryItemDetail {
        item_id: unsafe { ptr::addr_of!(item.m_itemId).read_unaligned() }.into(),
        definition: unsafe { ptr::addr_of!(item.m_iDefinition).read_unaligned() },
        quantity: u32::from(unsafe { ptr::addr_of!(item.m_unQuantity).read_unaligned() }),
        flags: u32::from(unsafe { ptr::addr_of!(item.m_unFlags).read_unaligned() }),
    }
}

fn inventory_definition_quantities(items: Vec<InventoryItemQuantity>) -> (Vec<i32>, Vec<u32>) {
    items
        .into_iter()
        .map(|item| (item.definition, item.quantity))
        .unzip()
}

fn inventory_instance_quantities(
    items: Vec<InventoryInstanceQuantity>,
) -> Result<(Vec<u64>, Vec<u32>), Error> {
    let mut ids = Vec::with_capacity(items.len());
    let mut quantities = Vec::with_capacity(items.len());
    for item in items {
        ids.push(bigint_to_u64(item.item_id, "inventory item id")?);
        quantities.push(item.quantity);
    }
    Ok((ids, quantities))
}

fn inventory_get_item_property_string(
    result_handle: i32,
    item_index: u32,
    property_name: Option<String>,
    label: &str,
) -> Result<Option<String>, Error> {
    let inventory = steam_inventory()?;
    let property_name = property_name
        .map(|property_name| cstring(property_name, label))
        .transpose()?;
    let property_name = property_name
        .as_ref()
        .map_or(ptr::null(), |property_name| property_name.as_ptr());
    let mut size = 0u32;
    let ok = unsafe {
        sys::SteamAPI_ISteamInventory_GetResultItemProperty(
            inventory,
            result_handle,
            item_index,
            property_name,
            ptr::null_mut(),
            &mut size,
        )
    };
    if !ok {
        return Ok(None);
    }
    let mut output = vec![0i8; size.max(1) as usize];
    let ok = unsafe {
        sys::SteamAPI_ISteamInventory_GetResultItemProperty(
            inventory,
            result_handle,
            item_index,
            property_name,
            output.as_mut_ptr(),
            &mut size,
        )
    };
    Ok(ok.then(|| c_buf_to_string(&output)))
}

fn inventory_get_definition_property_string(
    definition: i32,
    property_name: Option<String>,
) -> Result<Option<String>, Error> {
    let inventory = steam_inventory()?;
    let property_name = property_name
        .map(|property_name| cstring(property_name, "inventory definition property"))
        .transpose()?;
    let property_name = property_name
        .as_ref()
        .map_or(ptr::null(), |property_name| property_name.as_ptr());
    let mut size = 0u32;
    let ok = unsafe {
        sys::SteamAPI_ISteamInventory_GetItemDefinitionProperty(
            inventory,
            definition,
            property_name,
            ptr::null_mut(),
            &mut size,
        )
    };
    if !ok {
        return Ok(None);
    }
    let mut output = vec![0i8; size.max(1) as usize];
    let ok = unsafe {
        sys::SteamAPI_ISteamInventory_GetItemDefinitionProperty(
            inventory,
            definition,
            property_name,
            output.as_mut_ptr(),
            &mut size,
        )
    };
    Ok(ok.then(|| c_buf_to_string(&output)))
}

fn inventory_eligible_promo_result(
    result: &sys::SteamInventoryEligiblePromoItemDefIDs_t,
) -> InventoryEligiblePromoItemDefIds {
    InventoryEligiblePromoItemDefIds {
        result: unsafe { ptr::addr_of!(result.m_result).read_unaligned() } as u32,
        steam_id: csteam_id_to_player(unsafe { ptr::addr_of!(result.m_steamID).read_unaligned() }),
        num_eligible_promo_item_defs: unsafe {
            ptr::addr_of!(result.m_numEligiblePromoItemDefs).read_unaligned()
        },
        cached_data: unsafe { ptr::addr_of!(result.m_bCachedData).read_unaligned() },
    }
}

fn inventory_start_purchase_result(
    result: &sys::SteamInventoryStartPurchaseResult_t,
) -> InventoryStartPurchaseResult {
    InventoryStartPurchaseResult {
        result: unsafe { ptr::addr_of!(result.m_result).read_unaligned() } as u32,
        order_id: unsafe { ptr::addr_of!(result.m_ulOrderID).read_unaligned() }.into(),
        transaction_id: unsafe { ptr::addr_of!(result.m_ulTransID).read_unaligned() }.into(),
    }
}

fn inventory_request_prices_result(
    result: &sys::SteamInventoryRequestPricesResult_t,
) -> InventoryRequestPricesResult {
    InventoryRequestPricesResult {
        result: unsafe { ptr::addr_of!(result.m_result).read_unaligned() } as u32,
        currency: c_buf_to_string(unsafe { &*ptr::addr_of!(result.m_rgchCurrency) }),
    }
}

fn len_to_u32(len: usize, label: &str) -> Result<u32, Error> {
    u32::try_from(len).map_err(|_| Error::from_reason(format!("{label} length exceeds u32")))
}

fn bigints_to_u64s(values: Vec<BigInt>, label: &str) -> Result<Vec<u64>, Error> {
    values
        .into_iter()
        .map(|value| bigint_to_u64(value, label))
        .collect()
}

fn networking_identity_from_input(
    identity: NetworkingIdentity,
) -> Result<sys::SteamNetworkingIdentity, Error> {
    let NetworkingIdentity {
        steam_id64,
        text,
        generic_string,
        local_host,
    } = identity;
    let mut output = unsafe { MaybeUninit::<sys::SteamNetworkingIdentity>::zeroed().assume_init() };
    unsafe { sys::SteamAPI_SteamNetworkingIdentity_Clear(&mut output) };

    if let Some(steam_id64) = steam_id64 {
        unsafe {
            sys::SteamAPI_SteamNetworkingIdentity_SetSteamID64(
                &mut output,
                bigint_to_u64(steam_id64, "networking identity steamId64")?,
            );
        }
        return Ok(output);
    }

    if let Some(text) = text {
        let text = cstring(text, "networking identity")?;
        let ok = unsafe {
            sys::SteamAPI_SteamNetworkingIdentity_ParseString(&mut output, text.as_ptr())
        };
        return ok
            .then_some(output)
            .ok_or_else(|| Error::from_reason("invalid networking identity string"));
    }

    if let Some(generic_string) = generic_string {
        let generic_string = cstring(generic_string, "generic networking identity")?;
        let ok = unsafe {
            sys::SteamAPI_SteamNetworkingIdentity_SetGenericString(
                &mut output,
                generic_string.as_ptr(),
            )
        };
        return ok
            .then_some(output)
            .ok_or_else(|| Error::from_reason("invalid generic networking identity"));
    }

    if local_host.unwrap_or(false) {
        unsafe { sys::SteamAPI_SteamNetworkingIdentity_SetLocalHost(&mut output) };
        return Ok(output);
    }

    Err(Error::from_reason(
        "networking identity requires steamId64, text, genericString, or localHost",
    ))
}

fn networking_identity_string(mut identity: sys::SteamNetworkingIdentity) -> String {
    let mut output = vec![0i8; 129];
    unsafe {
        sys::SteamAPI_SteamNetworkingIdentity_ToString(
            &mut identity,
            output.as_mut_ptr(),
            output.len() as u32,
        );
    }
    c_buf_to_string(&output)
}

fn networking_identity_info(identity: sys::SteamNetworkingIdentity) -> NetworkingIdentityInfo {
    let identity_type = unsafe { ptr::addr_of!(identity.m_eType).read_unaligned() };
    let mut identity_for_getters = identity;
    let steam_id64 = matches!(
        identity_type,
        sys::ESteamNetworkingIdentityType::k_ESteamNetworkingIdentityType_SteamID
    )
    .then(|| unsafe {
        sys::SteamAPI_SteamNetworkingIdentity_GetSteamID64(&mut identity_for_getters).into()
    });
    let generic_string = matches!(
        identity_type,
        sys::ESteamNetworkingIdentityType::k_ESteamNetworkingIdentityType_GenericString
    )
    .then(|| unsafe {
        string_from_ptr(sys::SteamAPI_SteamNetworkingIdentity_GetGenericString(
            &mut identity_for_getters,
        ))
    });
    NetworkingIdentityInfo {
        identity_type: identity_type as u32,
        text: networking_identity_string(identity),
        steam_id64,
        generic_string,
        local_host: unsafe {
            sys::SteamAPI_SteamNetworkingIdentity_IsLocalHost(&mut identity_for_getters)
        },
        invalid: unsafe {
            sys::SteamAPI_SteamNetworkingIdentity_IsInvalid(&mut identity_for_getters)
        },
        fake_ip_type: unsafe {
            sys::SteamAPI_SteamNetworkingIdentity_GetFakeIPType(&mut identity_for_getters)
        } as u32,
    }
}

fn networking_identity_json(identity: sys::SteamNetworkingIdentity) -> Value {
    let identity_type = unsafe { ptr::addr_of!(identity.m_eType).read_unaligned() };
    let mut identity_for_getters = identity;
    let steam_id64 = matches!(
        identity_type,
        sys::ESteamNetworkingIdentityType::k_ESteamNetworkingIdentityType_SteamID
    )
    .then(|| unsafe {
        sys::SteamAPI_SteamNetworkingIdentity_GetSteamID64(&mut identity_for_getters).to_string()
    });
    let identity = networking_identity_info(identity);
    serde_json::json!({
        "identity_type": identity.identity_type,
        "text": identity.text,
        "steam_id64": steam_id64,
        "generic_string": identity.generic_string,
        "local_host": identity.local_host,
        "invalid": identity.invalid,
        "fake_ip_type": identity.fake_ip_type
    })
}

unsafe fn networking_message_from_ptr(
    message: *mut sys::SteamNetworkingMessage_t,
) -> NetworkingMessage {
    let size = ptr::addr_of!((*message).m_cbSize).read_unaligned().max(0) as usize;
    let data_ptr = ptr::addr_of!((*message).m_pData).read_unaligned();
    let data = if data_ptr.is_null() || size == 0 {
        Vec::new()
    } else {
        std::slice::from_raw_parts(data_ptr.cast::<u8>(), size).to_vec()
    };
    NetworkingMessage {
        data: data.into(),
        size: size as u32,
        peer: networking_identity_info(ptr::addr_of!((*message).m_identityPeer).read_unaligned()),
        connection: ptr::addr_of!((*message).m_conn).read_unaligned(),
        connection_user_data: ptr::addr_of!((*message).m_nConnUserData)
            .read_unaligned()
            .into(),
        time_received: ptr::addr_of!((*message).m_usecTimeReceived)
            .read_unaligned()
            .into(),
        message_number: ptr::addr_of!((*message).m_nMessageNumber)
            .read_unaligned()
            .into(),
        channel: ptr::addr_of!((*message).m_nChannel).read_unaligned(),
        flags: ptr::addr_of!((*message).m_nFlags).read_unaligned(),
        user_data: ptr::addr_of!((*message).m_nUserData)
            .read_unaligned()
            .into(),
        lane: u32::from(ptr::addr_of!((*message).m_idxLane).read_unaligned()),
    }
}

fn networking_real_time_status(
    status: &sys::SteamNetConnectionRealTimeStatus_t,
) -> NetworkingConnectionRealTimeStatus {
    NetworkingConnectionRealTimeStatus {
        state: unsafe { ptr::addr_of!(status.m_eState).read_unaligned() } as i32,
        ping: unsafe { ptr::addr_of!(status.m_nPing).read_unaligned() },
        connection_quality_local: f64::from(unsafe {
            ptr::addr_of!(status.m_flConnectionQualityLocal).read_unaligned()
        }),
        connection_quality_remote: f64::from(unsafe {
            ptr::addr_of!(status.m_flConnectionQualityRemote).read_unaligned()
        }),
        out_packets_per_second: f64::from(unsafe {
            ptr::addr_of!(status.m_flOutPacketsPerSec).read_unaligned()
        }),
        out_bytes_per_second: f64::from(unsafe {
            ptr::addr_of!(status.m_flOutBytesPerSec).read_unaligned()
        }),
        in_packets_per_second: f64::from(unsafe {
            ptr::addr_of!(status.m_flInPacketsPerSec).read_unaligned()
        }),
        in_bytes_per_second: f64::from(unsafe {
            ptr::addr_of!(status.m_flInBytesPerSec).read_unaligned()
        }),
        send_rate_bytes_per_second: unsafe {
            ptr::addr_of!(status.m_nSendRateBytesPerSecond).read_unaligned()
        },
        pending_unreliable: unsafe { ptr::addr_of!(status.m_cbPendingUnreliable).read_unaligned() },
        pending_reliable: unsafe { ptr::addr_of!(status.m_cbPendingReliable).read_unaligned() },
        sent_unacked_reliable: unsafe {
            ptr::addr_of!(status.m_cbSentUnackedReliable).read_unaligned()
        },
        queue_time: unsafe { ptr::addr_of!(status.m_usecQueueTime).read_unaligned() }.into(),
        max_jitter: unsafe { ptr::addr_of!(status.m_usecMaxJitter).read_unaligned() },
    }
}

fn networking_messages_session_connection_info(
    state: i32,
    info: &sys::SteamNetConnectionInfo_t,
    quick_status: &sys::SteamNetConnectionRealTimeStatus_t,
) -> NetworkingMessagesSessionConnectionInfo {
    NetworkingMessagesSessionConnectionInfo {
        state,
        remote_identity: networking_identity_info(unsafe {
            ptr::addr_of!(info.m_identityRemote).read_unaligned()
        }),
        user_data: unsafe { ptr::addr_of!(info.m_nUserData).read_unaligned() }.into(),
        listen_socket: unsafe { ptr::addr_of!(info.m_hListenSocket).read_unaligned() },
        remote_pop: unsafe { ptr::addr_of!(info.m_idPOPRemote).read_unaligned() },
        relay_pop: unsafe { ptr::addr_of!(info.m_idPOPRelay).read_unaligned() },
        end_reason: unsafe { ptr::addr_of!(info.m_eEndReason).read_unaligned() },
        end_debug: c_buf_to_string(unsafe { &*ptr::addr_of!(info.m_szEndDebug) }),
        connection_description: c_buf_to_string(unsafe {
            &*ptr::addr_of!(info.m_szConnectionDescription)
        }),
        flags: unsafe { ptr::addr_of!(info.m_nFlags).read_unaligned() },
        quick_status: networking_real_time_status(quick_status),
    }
}

fn networking_messages_session_info_json(info: &sys::SteamNetConnectionInfo_t) -> Value {
    serde_json::json!({
        "remote_identity": networking_identity_json(unsafe { ptr::addr_of!(info.m_identityRemote).read_unaligned() }),
        "user_data": unsafe { ptr::addr_of!(info.m_nUserData).read_unaligned() }.to_string(),
        "listen_socket": unsafe { ptr::addr_of!(info.m_hListenSocket).read_unaligned() },
        "remote_pop": unsafe { ptr::addr_of!(info.m_idPOPRemote).read_unaligned() },
        "relay_pop": unsafe { ptr::addr_of!(info.m_idPOPRelay).read_unaligned() },
        "state": unsafe { ptr::addr_of!(info.m_eState).read_unaligned() } as i32,
        "end_reason": unsafe { ptr::addr_of!(info.m_eEndReason).read_unaligned() },
        "end_debug": c_buf_to_string(unsafe { &*ptr::addr_of!(info.m_szEndDebug) }),
        "connection_description": c_buf_to_string(unsafe { &*ptr::addr_of!(info.m_szConnectionDescription) }),
        "flags": unsafe { ptr::addr_of!(info.m_nFlags).read_unaligned() }
    })
}

fn networking_authentication_status(
    status: &sys::SteamNetAuthenticationStatus_t,
) -> NetworkingAuthenticationStatus {
    NetworkingAuthenticationStatus {
        availability: unsafe { ptr::addr_of!(status.m_eAvail).read_unaligned() } as i32,
        debug_message: c_buf_to_string(unsafe { &*ptr::addr_of!(status.m_debugMsg) }),
    }
}

fn networking_relay_network_status(
    status: &sys::SteamRelayNetworkStatus_t,
    availability: sys::ESteamNetworkingAvailability,
) -> NetworkingRelayNetworkStatus {
    NetworkingRelayNetworkStatus {
        availability: availability as i32,
        ping_measurement_in_progress: unsafe {
            ptr::addr_of!(status.m_bPingMeasurementInProgress).read_unaligned()
        } != 0,
        network_config_availability: unsafe {
            ptr::addr_of!(status.m_eAvailNetworkConfig).read_unaligned()
        } as i32,
        any_relay_availability: unsafe { ptr::addr_of!(status.m_eAvailAnyRelay).read_unaligned() }
            as i32,
        debug_message: c_buf_to_string(unsafe { &*ptr::addr_of!(status.m_debugMsg) }),
    }
}

fn networking_ping_location_from_string(
    utils: *mut sys::ISteamNetworkingUtils,
    location: String,
) -> Result<sys::SteamNetworkPingLocation_t, Error> {
    let location_string = cstring(location, "networking ping location")?;
    let mut output =
        unsafe { MaybeUninit::<sys::SteamNetworkPingLocation_t>::zeroed().assume_init() };
    let ok = unsafe {
        sys::SteamAPI_ISteamNetworkingUtils_ParsePingLocationString(
            utils,
            location_string.as_ptr(),
            &mut output,
        )
    };
    ok.then_some(output)
        .ok_or_else(|| Error::from_reason("invalid networking ping location string"))
}

fn networking_ping_location_string(
    utils: *mut sys::ISteamNetworkingUtils,
    location: &sys::SteamNetworkPingLocation_t,
) -> String {
    let mut output = vec![0i8; 1024];
    unsafe {
        sys::SteamAPI_ISteamNetworkingUtils_ConvertPingLocationToString(
            utils,
            location,
            output.as_mut_ptr(),
            output.len() as i32,
        );
    }
    c_buf_to_string(&output)
}

fn networking_ip_address_from_input(
    address: NetworkingIpAddress,
) -> Result<sys::SteamNetworkingIPAddr, Error> {
    let NetworkingIpAddress {
        text,
        ipv4,
        port,
        local_host,
    } = address;
    let mut output = unsafe { MaybeUninit::<sys::SteamNetworkingIPAddr>::zeroed().assume_init() };
    unsafe { sys::SteamAPI_SteamNetworkingIPAddr_Clear(&mut output) };
    let port = networking_port(port)?;

    if let Some(text) = text {
        let text = cstring(text, "networking IP address")?;
        let ok =
            unsafe { sys::SteamAPI_SteamNetworkingIPAddr_ParseString(&mut output, text.as_ptr()) };
        return ok
            .then_some(output)
            .ok_or_else(|| Error::from_reason("invalid networking IP address string"));
    }

    if let Some(ipv4) = ipv4 {
        unsafe { sys::SteamAPI_SteamNetworkingIPAddr_SetIPv4(&mut output, ipv4, port) };
        return Ok(output);
    }

    if local_host.unwrap_or(false) {
        unsafe { sys::SteamAPI_SteamNetworkingIPAddr_SetIPv6LocalHost(&mut output, port) };
        return Ok(output);
    }

    Ok(output)
}

fn networking_port(port: Option<u32>) -> Result<u16, Error> {
    port.unwrap_or(0)
        .try_into()
        .map_err(|_| Error::from_reason("networking port must be between 0 and 65535"))
}

fn networking_ip_address_string(
    utils: *mut sys::ISteamNetworkingUtils,
    address: &sys::SteamNetworkingIPAddr,
    with_port: bool,
) -> String {
    let mut output = vec![0i8; sys::SteamNetworkingIPAddr_k_cchMaxString as usize];
    unsafe {
        sys::SteamAPI_ISteamNetworkingUtils_SteamNetworkingIPAddr_ToString(
            utils,
            address,
            output.as_mut_ptr(),
            output.len() as u32,
            with_port,
        );
    }
    c_buf_to_string(&output)
}

fn networking_ip_address_info(
    utils: *mut sys::ISteamNetworkingUtils,
    mut address: sys::SteamNetworkingIPAddr,
    with_port: bool,
) -> NetworkingIpAddressInfo {
    let is_ipv4 = unsafe { sys::SteamAPI_SteamNetworkingIPAddr_IsIPv4(&mut address) };
    let ipv4 =
        is_ipv4.then(|| unsafe { sys::SteamAPI_SteamNetworkingIPAddr_GetIPv4(&mut address) });
    NetworkingIpAddressInfo {
        text: networking_ip_address_string(utils, &address, with_port),
        ipv4,
        port: u32::from(unsafe { ptr::addr_of!(address.m_port).read_unaligned() }),
        ipv4_address: ipv4.map(ipv4_to_string),
        is_ipv4,
        is_local_host: unsafe { sys::SteamAPI_SteamNetworkingIPAddr_IsLocalHost(&mut address) },
        is_fake_ip: unsafe { sys::SteamAPI_SteamNetworkingIPAddr_IsFakeIP(&mut address) },
        fake_ip_type: unsafe { sys::SteamAPI_SteamNetworkingIPAddr_GetFakeIPType(&mut address) }
            as u32,
        ipv6_all_zeros: unsafe { sys::SteamAPI_SteamNetworkingIPAddr_IsIPv6AllZeros(&mut address) },
    }
}

fn ipv4_to_string(value: u32) -> String {
    std::net::Ipv4Addr::from(value).to_string()
}

fn c_buf_to_string(buf: &[i8]) -> String {
    let nul = buf
        .iter()
        .position(|value| *value == 0)
        .unwrap_or(buf.len());
    let bytes: Vec<u8> = buf[..nul].iter().map(|value| *value as u8).collect();
    String::from_utf8_lossy(&bytes).into_owned()
}

fn u8_buf_to_string(buf: &[u8]) -> String {
    let nul = buf
        .iter()
        .position(|value| *value == 0)
        .unwrap_or(buf.len());
    String::from_utf8_lossy(&buf[..nul]).into_owned()
}

async fn get_session_ticket(
    identity: Option<sys::SteamNetworkingIdentity>,
    timeout_seconds: Option<u32>,
) -> Result<AuthTicket, Error> {
    crate::state::ensure_initialized()?;
    let (tx, rx) = oneshot::channel::<Result<(), String>>();
    let tx = Arc::new(Mutex::new(Some(tx)));
    let expected_ticket = Arc::new(AtomicU32::new(H_AUTH_TICKET_INVALID));
    let tx_for_callback = tx.clone();
    let expected_for_callback = expected_ticket.clone();
    let _registration =
        crate::state::register_callback(CALLBACK_GET_AUTH_SESSION_TICKET_RESPONSE, move |param| {
            let response = unsafe { &*(param as *const sys::GetAuthSessionTicketResponse_t) };
            let expected = expected_for_callback.load(Ordering::SeqCst);
            if expected == H_AUTH_TICKET_INVALID || response.m_hAuthTicket != expected {
                return;
            }
            let result = if response.m_eResult == sys::EResult::k_EResultOK {
                Ok(())
            } else {
                Err(format!(
                    "Steam auth session ticket failed: {:?}",
                    response.m_eResult
                ))
            };
            if let Some(tx) = tx_for_callback
                .lock()
                .expect("Steam auth ticket callback sender poisoned")
                .take()
            {
                let _ = tx.send(result);
            }
        });

    let mut data = vec![0u8; 4096];
    let mut data_len = 0u32;
    let identity_ptr = identity
        .as_ref()
        .map_or(ptr::null(), |identity| identity as *const _);
    let ticket_handle = unsafe {
        sys::SteamAPI_ISteamUser_GetAuthSessionTicket(
            steam_user()?,
            data.as_mut_ptr().cast::<c_void>(),
            data.len() as i32,
            &mut data_len,
            identity_ptr,
        )
    };
    if ticket_handle == H_AUTH_TICKET_INVALID {
        return Err(Error::from_reason(
            "Steam returned an invalid auth session ticket handle",
        ));
    }
    expected_ticket.store(ticket_handle, Ordering::SeqCst);
    data.truncate(data_len as usize);
    let timeout_seconds = u64::from(timeout_seconds.unwrap_or(10));
    match tokio::time::timeout(std::time::Duration::from_secs(timeout_seconds), rx).await {
        Ok(Ok(Ok(()))) => Ok(make_auth_ticket(data, ticket_handle)),
        Ok(Ok(Err(message))) => {
            cancel_auth_ticket(ticket_handle);
            Err(Error::from_reason(message))
        }
        Ok(Err(err)) => {
            cancel_auth_ticket(ticket_handle);
            Err(Error::from_reason(err.to_string()))
        }
        Err(_) => {
            cancel_auth_ticket(ticket_handle);
            Err(Error::from_reason(
                "Steam did not validate the session ticket before the timeout",
            ))
        }
    }
}

async fn wait_for_api_call<T>(
    call: sys::SteamAPICall_t,
    expected_callback: i32,
    timeout_seconds: u64,
) -> Result<T, Error> {
    wait_for_api_call_with_progress(call, expected_callback, timeout_seconds, || {}).await
}

async fn wait_for_api_call_with_progress<T, F>(
    call: sys::SteamAPICall_t,
    expected_callback: i32,
    timeout_seconds: u64,
    mut tick: F,
) -> Result<T, Error>
where
    F: FnMut(),
{
    if call == 0 {
        return Err(Error::from_reason(
            "Steam returned an invalid API call handle",
        ));
    }
    let started = Instant::now();
    loop {
        run_callbacks();
        let utils = steam_utils()?;
        let mut failed = false;
        let completed =
            unsafe { sys::SteamAPI_ISteamUtils_IsAPICallCompleted(utils, call, &mut failed) };
        if completed {
            if failed {
                let reason =
                    unsafe { sys::SteamAPI_ISteamUtils_GetAPICallFailureReason(utils, call) };
                return Err(Error::from_reason(format!(
                    "Steam API call failed: {reason:?}"
                )));
            }
            let mut result = MaybeUninit::<T>::zeroed();
            let mut result_failed = false;
            let pipe = unsafe { sys::SteamAPI_GetHSteamPipe() };
            let ok = unsafe {
                sys::SteamAPI_ManualDispatch_GetAPICallResult(
                    pipe,
                    call,
                    result.as_mut_ptr().cast::<c_void>(),
                    std::mem::size_of::<T>() as i32,
                    expected_callback,
                    &mut result_failed,
                )
            } || unsafe {
                sys::SteamAPI_ISteamUtils_GetAPICallResult(
                    utils,
                    call,
                    result.as_mut_ptr().cast::<c_void>(),
                    std::mem::size_of::<T>() as i32,
                    expected_callback,
                    &mut result_failed,
                )
            };
            if !ok || result_failed {
                return Err(Error::from_reason(
                    "Steam API call completed but result retrieval failed",
                ));
            }
            return Ok(unsafe { result.assume_init() });
        }
        if started.elapsed() > Duration::from_secs(timeout_seconds) {
            return Err(Error::from_reason("Steam API call timed out"));
        }
        tick();
        tokio::time::sleep(Duration::from_millis(16)).await;
    }
}

fn callback_id_from_compat(callback: i32) -> Result<i32, Error> {
    match callback {
        0 => Ok(CALLBACK_PERSONA_STATE_CHANGE),
        1 => Ok(CALLBACK_STEAM_SERVERS_CONNECTED),
        2 => Ok(CALLBACK_STEAM_SERVERS_DISCONNECTED),
        3 => Ok(CALLBACK_STEAM_SERVER_CONNECT_FAILURE),
        4 => Ok(CALLBACK_LOBBY_DATA_UPDATE),
        5 => Ok(CALLBACK_LOBBY_CHAT_UPDATE),
        6 => Ok(CALLBACK_P2P_SESSION_REQUEST),
        7 => Ok(CALLBACK_P2P_SESSION_CONNECT_FAIL),
        8 => Ok(CALLBACK_GAME_LOBBY_JOIN_REQUESTED),
        9 => Ok(sys::MicroTxnAuthorizationResponse_t_k_iCallback as i32),
        331 => Ok(sys::GameOverlayActivated_t_k_iCallback as i32),
        CALLBACK_STEAM_NET_AUTHENTICATION_STATUS => {
            Ok(sys::SteamNetAuthenticationStatus_t_k_iCallback as i32)
        }
        CALLBACK_STEAM_NETWORKING_MESSAGES_SESSION_REQUEST => {
            Ok(sys::SteamNetworkingMessagesSessionRequest_t_k_iCallback as i32)
        }
        CALLBACK_STEAM_NETWORKING_MESSAGES_SESSION_FAILED => {
            Ok(sys::SteamNetworkingMessagesSessionFailed_t_k_iCallback as i32)
        }
        CALLBACK_STEAM_RELAY_NETWORK_STATUS => {
            Ok(sys::SteamRelayNetworkStatus_t_k_iCallback as i32)
        }
        CALLBACK_HTTP_REQUEST_COMPLETED => Ok(sys::HTTPRequestCompleted_t_k_iCallback as i32),
        CALLBACK_HTTP_REQUEST_HEADERS_RECEIVED => {
            Ok(sys::HTTPRequestHeadersReceived_t_k_iCallback as i32)
        }
        CALLBACK_HTTP_REQUEST_DATA_RECEIVED => {
            Ok(sys::HTTPRequestDataReceived_t_k_iCallback as i32)
        }
        CALLBACK_JOIN_PARTY => Ok(sys::JoinPartyCallback_t_k_iCallback as i32),
        CALLBACK_CREATE_BEACON => Ok(sys::CreateBeaconCallback_t_k_iCallback as i32),
        CALLBACK_RESERVATION_NOTIFICATION => {
            Ok(sys::ReservationNotificationCallback_t_k_iCallback as i32)
        }
        CALLBACK_CHANGE_NUM_OPEN_SLOTS => Ok(sys::ChangeNumOpenSlotsCallback_t_k_iCallback as i32),
        CALLBACK_STEAM_INVENTORY_RESULT_READY => {
            Ok(sys::SteamInventoryResultReady_t_k_iCallback as i32)
        }
        CALLBACK_STEAM_INVENTORY_FULL_UPDATE => {
            Ok(sys::SteamInventoryFullUpdate_t_k_iCallback as i32)
        }
        CALLBACK_STEAM_INVENTORY_DEFINITION_UPDATE => {
            Ok(sys::SteamInventoryDefinitionUpdate_t_k_iCallback as i32)
        }
        CALLBACK_STEAM_INVENTORY_ELIGIBLE_PROMO_ITEM_DEF_IDS => {
            Ok(sys::SteamInventoryEligiblePromoItemDefIDs_t_k_iCallback as i32)
        }
        CALLBACK_STEAM_INVENTORY_START_PURCHASE_RESULT => {
            Ok(sys::SteamInventoryStartPurchaseResult_t_k_iCallback as i32)
        }
        CALLBACK_STEAM_INVENTORY_REQUEST_PRICES_RESULT => {
            Ok(sys::SteamInventoryRequestPricesResult_t_k_iCallback as i32)
        }
        _ => Err(Error::from_reason(format!(
            "unsupported Steam callback {callback}"
        ))),
    }
}

unsafe fn callback_to_json(callback: i32, param: *mut c_void) -> Value {
    match callback {
        0 => {
            let event = param as *const sys::PersonaStateChange_t;
            serde_json::json!({
                "steam_id": ptr::addr_of!((*event).m_ulSteamID).read_unaligned().to_string(),
                "flags": { "bits": ptr::addr_of!((*event).m_nChangeFlags).read_unaligned() }
            })
        }
        1 => serde_json::json!({}),
        2 => {
            let event = param as *const sys::SteamServersDisconnected_t;
            serde_json::json!({ "reason": ptr::addr_of!((*event).m_eResult).read_unaligned() as u32 })
        }
        3 => {
            let event = param as *const sys::SteamServerConnectFailure_t;
            serde_json::json!({
                "reason": ptr::addr_of!((*event).m_eResult).read_unaligned() as u32,
                "still_retrying": ptr::addr_of!((*event).m_bStillRetrying).read_unaligned()
            })
        }
        4 => {
            let event = param as *const sys::LobbyDataUpdate_t;
            serde_json::json!({
                "lobby": ptr::addr_of!((*event).m_ulSteamIDLobby).read_unaligned().to_string(),
                "member": ptr::addr_of!((*event).m_ulSteamIDMember).read_unaligned().to_string(),
                "success": ptr::addr_of!((*event).m_bSuccess).read_unaligned()
            })
        }
        5 => {
            let event = param as *const sys::LobbyChatUpdate_t;
            serde_json::json!({
                "lobby": ptr::addr_of!((*event).m_ulSteamIDLobby).read_unaligned().to_string(),
                "user_changed": ptr::addr_of!((*event).m_ulSteamIDUserChanged).read_unaligned().to_string(),
                "making_change": ptr::addr_of!((*event).m_ulSteamIDMakingChange).read_unaligned().to_string(),
                "member_state_change": ptr::addr_of!((*event).m_rgfChatMemberStateChange).read_unaligned()
            })
        }
        6 => {
            let event = param as *const sys::P2PSessionRequest_t;
            let remote = std::mem::transmute::<sys::CSteamID, u64>(
                ptr::addr_of!((*event).m_steamIDRemote).read_unaligned(),
            );
            serde_json::json!({ "remote": remote.to_string() })
        }
        7 => {
            let event = param as *const sys::P2PSessionConnectFail_t;
            let remote = std::mem::transmute::<sys::CSteamID, u64>(
                ptr::addr_of!((*event).m_steamIDRemote).read_unaligned(),
            );
            serde_json::json!({ "remote": remote.to_string(), "error": ptr::addr_of!((*event).m_eP2PSessionError).read_unaligned() })
        }
        CALLBACK_STEAM_NETWORKING_MESSAGES_SESSION_REQUEST => {
            let event = param as *const sys::SteamNetworkingMessagesSessionRequest_t;
            serde_json::json!({
                "remote_identity": networking_identity_json(ptr::addr_of!((*event).m_identityRemote).read_unaligned())
            })
        }
        CALLBACK_STEAM_NETWORKING_MESSAGES_SESSION_FAILED => {
            let event = param as *const sys::SteamNetworkingMessagesSessionFailed_t;
            let info = ptr::addr_of!((*event).m_info).read_unaligned();
            serde_json::json!({
                "info": networking_messages_session_info_json(&info)
            })
        }
        CALLBACK_STEAM_NET_AUTHENTICATION_STATUS => {
            let event = param as *const sys::SteamNetAuthenticationStatus_t;
            let status = networking_authentication_status(&*event);
            serde_json::json!({
                "availability": status.availability,
                "debug_message": status.debug_message
            })
        }
        CALLBACK_STEAM_RELAY_NETWORK_STATUS => {
            let event = param as *const sys::SteamRelayNetworkStatus_t;
            let status = networking_relay_network_status(
                &*event,
                ptr::addr_of!((*event).m_eAvail).read_unaligned(),
            );
            serde_json::json!({
                "availability": status.availability,
                "ping_measurement_in_progress": status.ping_measurement_in_progress,
                "network_config_availability": status.network_config_availability,
                "any_relay_availability": status.any_relay_availability,
                "debug_message": status.debug_message
            })
        }
        8 => {
            let event = param as *const sys::GameLobbyJoinRequested_t;
            let lobby_steam_id = std::mem::transmute::<sys::CSteamID, u64>(
                ptr::addr_of!((*event).m_steamIDLobby).read_unaligned(),
            );
            let friend_steam_id = std::mem::transmute::<sys::CSteamID, u64>(
                ptr::addr_of!((*event).m_steamIDFriend).read_unaligned(),
            );
            serde_json::json!({
                "lobby_steam_id": lobby_steam_id.to_string(),
                "friend_steam_id": friend_steam_id.to_string()
            })
        }
        9 => {
            let event = param as *const sys::MicroTxnAuthorizationResponse_t;
            serde_json::json!({
                "app_id": ptr::addr_of!((*event).m_unAppID).read_unaligned(),
                "order_id": ptr::addr_of!((*event).m_ulOrderID).read_unaligned().to_string(),
                "authorized": ptr::addr_of!((*event).m_bAuthorized).read_unaligned() == 1
            })
        }
        331 => {
            let event = param as *const sys::GameOverlayActivated_t;
            serde_json::json!({
                "active": ptr::addr_of!((*event).m_bActive).read_unaligned() != 0,
                "user_initiated": ptr::addr_of!((*event).m_bUserInitiated).read_unaligned(),
                "app_id": ptr::addr_of!((*event).m_nAppID).read_unaligned(),
                "overlay_pid": ptr::addr_of!((*event).m_dwOverlayPID).read_unaligned()
            })
        }
        CALLBACK_HTTP_REQUEST_COMPLETED => {
            let event = param as *const sys::HTTPRequestCompleted_t;
            serde_json::json!({
                "request": ptr::addr_of!((*event).m_hRequest).read_unaligned(),
                "context_value": ptr::addr_of!((*event).m_ulContextValue).read_unaligned().to_string(),
                "request_successful": ptr::addr_of!((*event).m_bRequestSuccessful).read_unaligned(),
                "status_code": ptr::addr_of!((*event).m_eStatusCode).read_unaligned() as u32,
                "body_size": ptr::addr_of!((*event).m_unBodySize).read_unaligned()
            })
        }
        CALLBACK_HTTP_REQUEST_HEADERS_RECEIVED => {
            let event = param as *const sys::HTTPRequestHeadersReceived_t;
            serde_json::json!({
                "request": ptr::addr_of!((*event).m_hRequest).read_unaligned(),
                "context_value": ptr::addr_of!((*event).m_ulContextValue).read_unaligned().to_string()
            })
        }
        CALLBACK_HTTP_REQUEST_DATA_RECEIVED => {
            let event = param as *const sys::HTTPRequestDataReceived_t;
            serde_json::json!({
                "request": ptr::addr_of!((*event).m_hRequest).read_unaligned(),
                "context_value": ptr::addr_of!((*event).m_ulContextValue).read_unaligned().to_string(),
                "offset": ptr::addr_of!((*event).m_cOffset).read_unaligned(),
                "bytes_received": ptr::addr_of!((*event).m_cBytesReceived).read_unaligned()
            })
        }
        CALLBACK_JOIN_PARTY => {
            let event = param as *const sys::JoinPartyCallback_t;
            serde_json::json!({
                "result": ptr::addr_of!((*event).m_eResult).read_unaligned() as u32,
                "beacon": ptr::addr_of!((*event).m_ulBeaconID).read_unaligned().to_string(),
                "owner": csteam_id_to_u64(ptr::addr_of!((*event).m_SteamIDBeaconOwner).read_unaligned()).to_string(),
                "connect_string": c_buf_to_string(&*ptr::addr_of!((*event).m_rgchConnectString))
            })
        }
        CALLBACK_CREATE_BEACON => {
            let event = param as *const sys::CreateBeaconCallback_t;
            serde_json::json!({
                "result": ptr::addr_of!((*event).m_eResult).read_unaligned() as u32,
                "beacon": ptr::addr_of!((*event).m_ulBeaconID).read_unaligned().to_string()
            })
        }
        CALLBACK_RESERVATION_NOTIFICATION => {
            let event = param as *const sys::ReservationNotificationCallback_t;
            serde_json::json!({
                "beacon": ptr::addr_of!((*event).m_ulBeaconID).read_unaligned().to_string(),
                "joiner": csteam_id_to_u64(ptr::addr_of!((*event).m_steamIDJoiner).read_unaligned()).to_string()
            })
        }
        CALLBACK_CHANGE_NUM_OPEN_SLOTS => {
            let event = param as *const sys::ChangeNumOpenSlotsCallback_t;
            serde_json::json!({
                "result": ptr::addr_of!((*event).m_eResult).read_unaligned() as u32
            })
        }
        CALLBACK_STEAM_INVENTORY_RESULT_READY => {
            let event = param as *const sys::SteamInventoryResultReady_t;
            serde_json::json!({
                "handle": ptr::addr_of!((*event).m_handle).read_unaligned(),
                "result": ptr::addr_of!((*event).m_result).read_unaligned() as u32
            })
        }
        CALLBACK_STEAM_INVENTORY_FULL_UPDATE => {
            let event = param as *const sys::SteamInventoryFullUpdate_t;
            serde_json::json!({
                "handle": ptr::addr_of!((*event).m_handle).read_unaligned()
            })
        }
        CALLBACK_STEAM_INVENTORY_DEFINITION_UPDATE => serde_json::json!({}),
        CALLBACK_STEAM_INVENTORY_ELIGIBLE_PROMO_ITEM_DEF_IDS => {
            let event = param as *const sys::SteamInventoryEligiblePromoItemDefIDs_t;
            serde_json::json!({
                "result": ptr::addr_of!((*event).m_result).read_unaligned() as u32,
                "steam_id": csteam_id_to_u64(ptr::addr_of!((*event).m_steamID).read_unaligned()).to_string(),
                "num_eligible_promo_item_defs": ptr::addr_of!((*event).m_numEligiblePromoItemDefs).read_unaligned(),
                "cached_data": ptr::addr_of!((*event).m_bCachedData).read_unaligned()
            })
        }
        CALLBACK_STEAM_INVENTORY_START_PURCHASE_RESULT => {
            let event = param as *const sys::SteamInventoryStartPurchaseResult_t;
            serde_json::json!({
                "result": ptr::addr_of!((*event).m_result).read_unaligned() as u32,
                "order_id": ptr::addr_of!((*event).m_ulOrderID).read_unaligned().to_string(),
                "transaction_id": ptr::addr_of!((*event).m_ulTransID).read_unaligned().to_string()
            })
        }
        CALLBACK_STEAM_INVENTORY_REQUEST_PRICES_RESULT => {
            let event = param as *const sys::SteamInventoryRequestPricesResult_t;
            serde_json::json!({
                "result": ptr::addr_of!((*event).m_result).read_unaligned() as u32,
                "currency": c_buf_to_string(&*ptr::addr_of!((*event).m_rgchCurrency))
            })
        }
        _ => Value::Null,
    }
}

fn gamepad_text_input_mode_from_u32(value: u32) -> Result<sys::EGamepadTextInputMode, Error> {
    match value {
        0 => Ok(sys::EGamepadTextInputMode::k_EGamepadTextInputModeNormal),
        1 => Ok(sys::EGamepadTextInputMode::k_EGamepadTextInputModePassword),
        _ => Err(Error::from_reason("invalid gamepad text input mode")),
    }
}

fn gamepad_text_input_line_mode_from_u32(
    value: u32,
) -> Result<sys::EGamepadTextInputLineMode, Error> {
    match value {
        0 => Ok(sys::EGamepadTextInputLineMode::k_EGamepadTextInputLineModeSingleLine),
        1 => Ok(sys::EGamepadTextInputLineMode::k_EGamepadTextInputLineModeMultipleLines),
        _ => Err(Error::from_reason("invalid gamepad text input line mode")),
    }
}

fn floating_gamepad_text_input_mode_from_u32(
    value: u32,
) -> Result<sys::EFloatingGamepadTextInputMode, Error> {
    match value {
        0 => Ok(sys::EFloatingGamepadTextInputMode::k_EFloatingGamepadTextInputModeModeSingleLine),
        1 => Ok(
            sys::EFloatingGamepadTextInputMode::k_EFloatingGamepadTextInputModeModeMultipleLines,
        ),
        2 => Ok(sys::EFloatingGamepadTextInputMode::k_EFloatingGamepadTextInputModeModeEmail),
        3 => Ok(sys::EFloatingGamepadTextInputMode::k_EFloatingGamepadTextInputModeModeNumeric),
        _ => Err(Error::from_reason(
            "invalid floating gamepad text input mode",
        )),
    }
}

fn entered_gamepad_text() -> Result<Option<String>, Error> {
    let utils = steam_utils()?;
    let len = unsafe { sys::SteamAPI_ISteamUtils_GetEnteredGamepadTextLength(utils) };
    if len == 0 {
        return Ok(Some(String::new()));
    }
    let mut buf = vec![0i8; len as usize];
    let ok = unsafe {
        sys::SteamAPI_ISteamUtils_GetEnteredGamepadTextInput(utils, buf.as_mut_ptr(), len)
    };
    if ok {
        Ok(Some(c_buf_to_string(&buf)))
    } else {
        Ok(None)
    }
}

fn input_type_name(input_type: sys::ESteamInputType) -> &'static str {
    match input_type {
        sys::ESteamInputType::k_ESteamInputType_SteamController => "SteamController",
        sys::ESteamInputType::k_ESteamInputType_XBox360Controller => "XBox360Controller",
        sys::ESteamInputType::k_ESteamInputType_XBoxOneController => "XBoxOneController",
        sys::ESteamInputType::k_ESteamInputType_GenericGamepad => "GenericGamepad",
        sys::ESteamInputType::k_ESteamInputType_PS4Controller => "PS4Controller",
        sys::ESteamInputType::k_ESteamInputType_AppleMFiController => "AppleMFiController",
        sys::ESteamInputType::k_ESteamInputType_AndroidController => "AndroidController",
        sys::ESteamInputType::k_ESteamInputType_SwitchJoyConPair => "SwitchJoyConPair",
        sys::ESteamInputType::k_ESteamInputType_SwitchJoyConSingle => "SwitchJoyConSingle",
        sys::ESteamInputType::k_ESteamInputType_SwitchProController => "SwitchProController",
        sys::ESteamInputType::k_ESteamInputType_MobileTouch => "MobileTouch",
        sys::ESteamInputType::k_ESteamInputType_PS3Controller => "PS3Controller",
        sys::ESteamInputType::k_ESteamInputType_PS5Controller => "PS5Controller",
        sys::ESteamInputType::k_ESteamInputType_SteamDeckController => "SteamDeckController",
        _ => "Unknown",
    }
}

fn lobby_type_from_u32(value: u32) -> Result<sys::ELobbyType, Error> {
    match value {
        0 => Ok(sys::ELobbyType::k_ELobbyTypePrivate),
        1 => Ok(sys::ELobbyType::k_ELobbyTypeFriendsOnly),
        2 => Ok(sys::ELobbyType::k_ELobbyTypePublic),
        3 => Ok(sys::ELobbyType::k_ELobbyTypeInvisible),
        _ => Err(Error::from_reason("invalid lobby type")),
    }
}

fn ugc_query_from_u32(value: u32) -> Result<sys::EUGCQuery, Error> {
    Ok(match value {
        0 => sys::EUGCQuery::k_EUGCQuery_RankedByVote,
        1 => sys::EUGCQuery::k_EUGCQuery_RankedByPublicationDate,
        2 => sys::EUGCQuery::k_EUGCQuery_AcceptedForGameRankedByAcceptanceDate,
        3 => sys::EUGCQuery::k_EUGCQuery_RankedByTrend,
        4 => sys::EUGCQuery::k_EUGCQuery_FavoritedByFriendsRankedByPublicationDate,
        5 => sys::EUGCQuery::k_EUGCQuery_CreatedByFriendsRankedByPublicationDate,
        6 => sys::EUGCQuery::k_EUGCQuery_RankedByNumTimesReported,
        7 => sys::EUGCQuery::k_EUGCQuery_CreatedByFollowedUsersRankedByPublicationDate,
        8 => sys::EUGCQuery::k_EUGCQuery_NotYetRated,
        9 => sys::EUGCQuery::k_EUGCQuery_RankedByTotalVotesAsc,
        10 => sys::EUGCQuery::k_EUGCQuery_RankedByVotesUp,
        11 => sys::EUGCQuery::k_EUGCQuery_RankedByTextSearch,
        12 => sys::EUGCQuery::k_EUGCQuery_RankedByTotalUniqueSubscriptions,
        13 => sys::EUGCQuery::k_EUGCQuery_RankedByPlaytimeTrend,
        14 => sys::EUGCQuery::k_EUGCQuery_RankedByTotalPlaytime,
        15 => sys::EUGCQuery::k_EUGCQuery_RankedByAveragePlaytimeTrend,
        16 => sys::EUGCQuery::k_EUGCQuery_RankedByLifetimeAveragePlaytime,
        17 => sys::EUGCQuery::k_EUGCQuery_RankedByPlaytimeSessionsTrend,
        18 => sys::EUGCQuery::k_EUGCQuery_RankedByLifetimePlaytimeSessions,
        19 => sys::EUGCQuery::k_EUGCQuery_RankedByLastUpdatedDate,
        _ => return Err(Error::from_reason("invalid UGC query type")),
    })
}

fn ugc_matching_type_from_i32(value: i32) -> Result<sys::EUGCMatchingUGCType, Error> {
    Ok(match value {
        0 => sys::EUGCMatchingUGCType::k_EUGCMatchingUGCType_Items,
        1 => sys::EUGCMatchingUGCType::k_EUGCMatchingUGCType_Items_Mtx,
        2 => sys::EUGCMatchingUGCType::k_EUGCMatchingUGCType_Items_ReadyToUse,
        3 => sys::EUGCMatchingUGCType::k_EUGCMatchingUGCType_Collections,
        4 => sys::EUGCMatchingUGCType::k_EUGCMatchingUGCType_Artwork,
        5 => sys::EUGCMatchingUGCType::k_EUGCMatchingUGCType_Videos,
        6 => sys::EUGCMatchingUGCType::k_EUGCMatchingUGCType_Screenshots,
        7 => sys::EUGCMatchingUGCType::k_EUGCMatchingUGCType_AllGuides,
        8 => sys::EUGCMatchingUGCType::k_EUGCMatchingUGCType_WebGuides,
        9 => sys::EUGCMatchingUGCType::k_EUGCMatchingUGCType_IntegratedGuides,
        10 => sys::EUGCMatchingUGCType::k_EUGCMatchingUGCType_UsableInGame,
        11 => sys::EUGCMatchingUGCType::k_EUGCMatchingUGCType_ControllerBindings,
        12 => sys::EUGCMatchingUGCType::k_EUGCMatchingUGCType_GameManagedItems,
        13 | -1 => sys::EUGCMatchingUGCType::k_EUGCMatchingUGCType_All,
        _ => return Err(Error::from_reason("invalid UGC type")),
    })
}

fn user_ugc_list_from_u32(value: u32) -> Result<sys::EUserUGCList, Error> {
    Ok(match value {
        0 => sys::EUserUGCList::k_EUserUGCList_Published,
        1 => sys::EUserUGCList::k_EUserUGCList_VotedOn,
        2 => sys::EUserUGCList::k_EUserUGCList_VotedUp,
        3 => sys::EUserUGCList::k_EUserUGCList_VotedDown,
        4 => sys::EUserUGCList::k_EUserUGCList_Favorited,
        5 => sys::EUserUGCList::k_EUserUGCList_Subscribed,
        6 => sys::EUserUGCList::k_EUserUGCList_UsedOrPlayed,
        7 => sys::EUserUGCList::k_EUserUGCList_Followed,
        _ => return Err(Error::from_reason("invalid user UGC list type")),
    })
}

fn user_ugc_sort_order_from_u32(value: u32) -> Result<sys::EUserUGCListSortOrder, Error> {
    Ok(match value {
        0 => sys::EUserUGCListSortOrder::k_EUserUGCListSortOrder_CreationOrderAsc,
        1 => sys::EUserUGCListSortOrder::k_EUserUGCListSortOrder_CreationOrderDesc,
        2 => sys::EUserUGCListSortOrder::k_EUserUGCListSortOrder_TitleAsc,
        3 => sys::EUserUGCListSortOrder::k_EUserUGCListSortOrder_LastUpdatedDesc,
        4 => sys::EUserUGCListSortOrder::k_EUserUGCListSortOrder_SubscriptionDateDesc,
        5 => sys::EUserUGCListSortOrder::k_EUserUGCListSortOrder_VoteScoreDesc,
        6 => sys::EUserUGCListSortOrder::k_EUserUGCListSortOrder_ForModeration,
        _ => return Err(Error::from_reason("invalid user UGC sort order")),
    })
}

fn set_optional_item_string<F>(
    ugc: *mut sys::ISteamUGC,
    handle: sys::UGCUpdateHandle_t,
    data: &Value,
    key: &str,
    keepalive: &mut Vec<CString>,
    setter: F,
) -> Result<(), Error>
where
    F: FnOnce(*mut sys::ISteamUGC, sys::UGCUpdateHandle_t, *const c_char) -> bool,
{
    if let Some(value) = data.get(key).and_then(Value::as_str) {
        let value = CString::new(value)
            .map_err(|_| Error::from_reason(format!("{key} contains a NUL byte")))?;
        let ok = setter(ugc, handle, value.as_ptr());
        if !ok {
            return Err(Error::from_reason(format!("Steam rejected workshop {key}")));
        }
        keepalive.push(value);
    }
    Ok(())
}

fn apply_query_config(
    ugc: *mut sys::ISteamUGC,
    handle: sys::UGCQueryHandle_t,
    config: Option<&Value>,
) -> Result<(), Error> {
    let Some(config) = config else {
        return Ok(());
    };
    if let Some(value) = config.get("cachedResponseMaxAge").and_then(Value::as_u64) {
        unsafe { sys::SteamAPI_ISteamUGC_SetAllowCachedResponse(ugc, handle, value as u32) };
    }
    if let Some(value) = config.get("includeMetadata").and_then(Value::as_bool) {
        unsafe { sys::SteamAPI_ISteamUGC_SetReturnMetadata(ugc, handle, value) };
    }
    if let Some(value) = config
        .get("includeLongDescription")
        .and_then(Value::as_bool)
    {
        unsafe { sys::SteamAPI_ISteamUGC_SetReturnLongDescription(ugc, handle, value) };
    }
    if let Some(value) = config
        .get("includeAdditionalPreviews")
        .and_then(Value::as_bool)
    {
        unsafe { sys::SteamAPI_ISteamUGC_SetReturnAdditionalPreviews(ugc, handle, value) };
    }
    if let Some(value) = config.get("onlyIds").and_then(Value::as_bool) {
        unsafe { sys::SteamAPI_ISteamUGC_SetReturnOnlyIDs(ugc, handle, value) };
    }
    if let Some(value) = config.get("onlyTotal").and_then(Value::as_bool) {
        unsafe { sys::SteamAPI_ISteamUGC_SetReturnTotalOnly(ugc, handle, value) };
    }
    if let Some(value) = config.get("matchAnyTag").and_then(Value::as_bool) {
        unsafe { sys::SteamAPI_ISteamUGC_SetMatchAnyTag(ugc, handle, value) };
    }
    if let Some(value) = config.get("rankedByTrendDays").and_then(Value::as_u64) {
        unsafe { sys::SteamAPI_ISteamUGC_SetRankedByTrendDays(ugc, handle, value as u32) };
    }
    if let Some(language) = config.get("language").and_then(Value::as_str) {
        let language = CString::new(language)
            .map_err(|_| Error::from_reason("query language contains a NUL byte"))?;
        unsafe { sys::SteamAPI_ISteamUGC_SetLanguage(ugc, handle, language.as_ptr()) };
    }
    if let Some(search_text) = config.get("searchText").and_then(Value::as_str) {
        let search_text = CString::new(search_text)
            .map_err(|_| Error::from_reason("query search text contains a NUL byte"))?;
        unsafe { sys::SteamAPI_ISteamUGC_SetSearchText(ugc, handle, search_text.as_ptr()) };
    }
    if let Some(tags) = config.get("requiredTags").and_then(Value::as_array) {
        for tag in tags.iter().filter_map(Value::as_str) {
            let tag = CString::new(tag)
                .map_err(|_| Error::from_reason("required tag contains a NUL byte"))?;
            unsafe { sys::SteamAPI_ISteamUGC_AddRequiredTag(ugc, handle, tag.as_ptr()) };
        }
    }
    if let Some(tags) = config.get("excludedTags").and_then(Value::as_array) {
        for tag in tags.iter().filter_map(Value::as_str) {
            let tag = CString::new(tag)
                .map_err(|_| Error::from_reason("excluded tag contains a NUL byte"))?;
            unsafe { sys::SteamAPI_ISteamUGC_AddExcludedTag(ugc, handle, tag.as_ptr()) };
        }
    }
    Ok(())
}

fn collect_query_items(
    ugc: *mut sys::ISteamUGC,
    handle: sys::UGCQueryHandle_t,
    result: &sys::SteamUGCQueryCompleted_t,
) -> Result<WorkshopItemsResult, Error> {
    let eresult = unsafe { ptr::addr_of!(result.m_eResult).read_unaligned() };
    if eresult != sys::EResult::k_EResultOK {
        return Err(Error::from_reason(format!(
            "Steam UGC query failed: {eresult:?}"
        )));
    }
    let returned = unsafe { ptr::addr_of!(result.m_unNumResultsReturned).read_unaligned() };
    let total = unsafe { ptr::addr_of!(result.m_unTotalMatchingResults).read_unaligned() };
    let cached = unsafe { ptr::addr_of!(result.m_bCachedData).read_unaligned() };
    let mut items = Vec::new();
    for index in 0..returned {
        let mut details = unsafe { MaybeUninit::<sys::SteamUGCDetails_t>::zeroed().assume_init() };
        let ok =
            unsafe { sys::SteamAPI_ISteamUGC_GetQueryUGCResult(ugc, handle, index, &mut details) };
        if ok {
            items.push(Some(workshop_item_from_details(
                ugc, handle, index, &details,
            )?));
        } else {
            items.push(None);
        }
    }
    Ok(WorkshopItemsResult {
        items,
        returned_results: returned,
        total_results: total,
        was_cached: cached,
    })
}

fn workshop_item_from_details(
    ugc: *mut sys::ISteamUGC,
    handle: sys::UGCQueryHandle_t,
    index: u32,
    details: &sys::SteamUGCDetails_t,
) -> Result<WorkshopItem, Error> {
    let title = unsafe {
        fixed_char_array_to_string(ptr::addr_of!(details.m_rgchTitle).cast::<c_char>(), 129)
    };
    let description = unsafe {
        fixed_char_array_to_string(
            ptr::addr_of!(details.m_rgchDescription).cast::<c_char>(),
            8000,
        )
    };
    let tags_raw = unsafe {
        fixed_char_array_to_string(ptr::addr_of!(details.m_rgchTags).cast::<c_char>(), 1025)
    };
    let url = unsafe {
        fixed_char_array_to_string(ptr::addr_of!(details.m_rgchURL).cast::<c_char>(), 256)
    };
    let preview_url = query_preview_url(ugc, handle, index);
    Ok(WorkshopItem {
        published_file_id: unsafe { ptr::addr_of!(details.m_nPublishedFileId).read_unaligned() }
            .into(),
        creator_app_id: unsafe { ptr::addr_of!(details.m_nCreatorAppID).read_unaligned() },
        consumer_app_id: unsafe { ptr::addr_of!(details.m_nConsumerAppID).read_unaligned() },
        title,
        description,
        owner: steam_id_to_player(unsafe {
            ptr::addr_of!(details.m_ulSteamIDOwner).read_unaligned()
        }),
        time_created: unsafe { ptr::addr_of!(details.m_rtimeCreated).read_unaligned() },
        time_updated: unsafe { ptr::addr_of!(details.m_rtimeUpdated).read_unaligned() },
        time_added_to_user_list: unsafe {
            ptr::addr_of!(details.m_rtimeAddedToUserList).read_unaligned()
        },
        visibility: unsafe { ptr::addr_of!(details.m_eVisibility).read_unaligned() as u32 },
        banned: unsafe { ptr::addr_of!(details.m_bBanned).read_unaligned() },
        accepted_for_use: unsafe { ptr::addr_of!(details.m_bAcceptedForUse).read_unaligned() },
        tags: tags_raw
            .split(',')
            .filter(|tag| !tag.is_empty())
            .map(ToOwned::to_owned)
            .collect(),
        tags_truncated: unsafe { ptr::addr_of!(details.m_bTagsTruncated).read_unaligned() },
        url,
        num_upvotes: unsafe { ptr::addr_of!(details.m_unVotesUp).read_unaligned() },
        num_downvotes: unsafe { ptr::addr_of!(details.m_unVotesDown).read_unaligned() },
        num_children: unsafe { ptr::addr_of!(details.m_unNumChildren).read_unaligned() },
        preview_url,
        num_subscriptions: query_stat(
            ugc,
            handle,
            index,
            sys::EItemStatistic::k_EItemStatistic_NumSubscriptions,
        ),
        num_favorites: query_stat(
            ugc,
            handle,
            index,
            sys::EItemStatistic::k_EItemStatistic_NumFavorites,
        ),
        num_followers: query_stat(
            ugc,
            handle,
            index,
            sys::EItemStatistic::k_EItemStatistic_NumFollowers,
        ),
        num_unique_subscriptions: query_stat(
            ugc,
            handle,
            index,
            sys::EItemStatistic::k_EItemStatistic_NumUniqueSubscriptions,
        ),
        num_unique_favorites: query_stat(
            ugc,
            handle,
            index,
            sys::EItemStatistic::k_EItemStatistic_NumUniqueFavorites,
        ),
        num_unique_followers: query_stat(
            ugc,
            handle,
            index,
            sys::EItemStatistic::k_EItemStatistic_NumUniqueFollowers,
        ),
        num_unique_website_views: query_stat(
            ugc,
            handle,
            index,
            sys::EItemStatistic::k_EItemStatistic_NumUniqueWebsiteViews,
        ),
        report_score: query_stat(
            ugc,
            handle,
            index,
            sys::EItemStatistic::k_EItemStatistic_ReportScore,
        ),
        num_seconds_played: query_stat(
            ugc,
            handle,
            index,
            sys::EItemStatistic::k_EItemStatistic_NumSecondsPlayed,
        ),
        num_playtime_sessions: query_stat(
            ugc,
            handle,
            index,
            sys::EItemStatistic::k_EItemStatistic_NumPlaytimeSessions,
        ),
        num_comments: query_stat(
            ugc,
            handle,
            index,
            sys::EItemStatistic::k_EItemStatistic_NumComments,
        ),
        num_seconds_played_during_time_period: query_stat(
            ugc,
            handle,
            index,
            sys::EItemStatistic::k_EItemStatistic_NumSecondsPlayedDuringTimePeriod,
        ),
        num_playtime_sessions_during_time_period: query_stat(
            ugc,
            handle,
            index,
            sys::EItemStatistic::k_EItemStatistic_NumPlaytimeSessionsDuringTimePeriod,
        ),
    })
}

unsafe fn fixed_char_array_to_string(ptr: *const c_char, len: usize) -> String {
    let bytes = std::slice::from_raw_parts(ptr.cast::<u8>(), len);
    let nul = bytes
        .iter()
        .position(|value| *value == 0)
        .unwrap_or(bytes.len());
    String::from_utf8_lossy(&bytes[..nul]).into_owned()
}

fn query_preview_url(
    ugc: *mut sys::ISteamUGC,
    handle: sys::UGCQueryHandle_t,
    index: u32,
) -> Option<String> {
    let mut buf = vec![0i8; 1024];
    let ok = unsafe {
        sys::SteamAPI_ISteamUGC_GetQueryUGCPreviewURL(
            ugc,
            handle,
            index,
            buf.as_mut_ptr(),
            buf.len() as u32,
        )
    };
    if ok {
        Some(c_buf_to_string(&buf))
    } else {
        None
    }
}

fn query_stat(
    ugc: *mut sys::ISteamUGC,
    handle: sys::UGCQueryHandle_t,
    index: u32,
    stat: sys::EItemStatistic,
) -> Option<BigInt> {
    let mut value = 0u64;
    let ok = unsafe {
        sys::SteamAPI_ISteamUGC_GetQueryUGCStatistic(ugc, handle, index, stat, &mut value)
    };
    if ok {
        Some(value.into())
    } else {
        None
    }
}
