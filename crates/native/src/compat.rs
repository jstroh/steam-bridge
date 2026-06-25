use crate::{
    cancel_auth_ticket, cstring, make_auth_ticket, non_null, run_callbacks, steam_friends,
    steam_id_to_player, steam_user, steam_user_stats, steam_utils, string_from_ptr, AuthTicket,
    CallbackHandle, PlayerSteamId,
};
use base64::engine::general_purpose::STANDARD as BASE64_STANDARD;
use base64::Engine as _;
use napi::bindgen_prelude::{
    BigInt, Buffer, Env, Error, Function, PromiseRaw, Status, ToNapiValue,
};
use napi::threadsafe_function::{ThreadsafeFunction, ThreadsafeFunctionCallMode};
use napi_derive::napi;
use once_cell::sync::Lazy;
use serde_json::Value;
use std::cell::Cell;
use std::collections::HashMap;
use std::ffi::{c_char, c_void, CStr, CString};
use std::future::Future;
use std::mem::MaybeUninit;
use std::net::IpAddr;
use std::pin::Pin;
use std::ptr;
use std::sync::atomic::{AtomicU32, AtomicU64, Ordering};
use std::sync::{Arc, Mutex};
use std::task::{Context as TaskContext, Poll};
use std::time::{Duration, Instant};
use steamworks_sys as sys;
use tokio::sync::oneshot;

// Steam declares HTML key modifiers as enum flags. Bindgen exposes a fieldless
// Rust enum, so raw u32 calls preserve Ctrl+Shift-style combinations safely.
extern "C" {
    #[link_name = "SteamAPI_ISteamHTMLSurface_KeyDown"]
    fn steam_api_isteam_html_surface_key_down_raw(
        self_: *mut sys::ISteamHTMLSurface,
        un_browser_handle: u32,
        native_key_code: u32,
        html_key_modifiers: u32,
        is_system_key: bool,
    );

    #[link_name = "SteamAPI_ISteamHTMLSurface_KeyUp"]
    fn steam_api_isteam_html_surface_key_up_raw(
        self_: *mut sys::ISteamHTMLSurface,
        un_browser_handle: u32,
        native_key_code: u32,
        html_key_modifiers: u32,
    );

    #[link_name = "SteamAPI_ISteamHTMLSurface_KeyChar"]
    fn steam_api_isteam_html_surface_key_char_raw(
        self_: *mut sys::ISteamHTMLSurface,
        un_browser_handle: u32,
        unicode_char: u32,
        html_key_modifiers: u32,
    );
}

const CALLBACK_PERSONA_STATE_CHANGE: i32 = 304;
const CALLBACK_STEAM_SERVERS_CONNECTED: i32 = 101;
const CALLBACK_STEAM_SERVER_CONNECT_FAILURE: i32 = 102;
const CALLBACK_STEAM_SERVERS_DISCONNECTED: i32 = 103;
const CALLBACK_ENCRYPTED_APP_TICKET_RESPONSE: i32 = 154;
const CALLBACK_GET_AUTH_SESSION_TICKET_RESPONSE: i32 = 163;
const CALLBACK_STORE_AUTH_URL_RESPONSE: i32 = 165;
const CALLBACK_MARKET_ELIGIBILITY_RESPONSE: i32 = 166;
const CALLBACK_DURATION_CONTROL: i32 = 167;
const CALLBACK_IP_COUNTRY: i32 = 701;
const CALLBACK_LOW_BATTERY_POWER: i32 = 702;
const CALLBACK_STEAM_API_CALL_COMPLETED: i32 = 703;
const CALLBACK_STEAM_SHUTDOWN: i32 = 704;
const CALLBACK_CHECK_FILE_SIGNATURE: i32 = 705;
const CALLBACK_GAMEPAD_TEXT_INPUT_DISMISSED: i32 = 714;
const CALLBACK_APP_RESUMING_FROM_SUSPEND: i32 = 736;
const CALLBACK_FLOATING_GAMEPAD_TEXT_INPUT_DISMISSED: i32 = 738;
const CALLBACK_FILTER_TEXT_DICTIONARY_CHANGED: i32 = 739;
const CALLBACK_DLC_INSTALLED: i32 = 1005;
const CALLBACK_NEW_URL_LAUNCH_PARAMETERS: i32 = 1014;
const CALLBACK_APP_PROOF_OF_PURCHASE_KEY_RESPONSE: i32 = 1021;
const CALLBACK_FILE_DETAILS_RESULT: i32 = 1023;
const CALLBACK_TIMED_TRIAL_STATUS: i32 = 1030;
const CALLBACK_FAVORITES_LIST_CHANGED: i32 = 502;
const CALLBACK_LOBBY_INVITE: i32 = 503;
const CALLBACK_LOBBY_ENTER: i32 = 504;
const CALLBACK_LOBBY_DATA_UPDATE: i32 = 505;
const CALLBACK_LOBBY_CHAT_UPDATE: i32 = 506;
const CALLBACK_LOBBY_CHAT_MSG: i32 = 507;
const CALLBACK_LOBBY_GAME_CREATED: i32 = 509;
const CALLBACK_LOBBY_MATCH_LIST: i32 = 510;
const CALLBACK_LOBBY_KICKED: i32 = 512;
const CALLBACK_GAME_SERVER_CHANGE_REQUESTED: i32 = 332;
const CALLBACK_GAME_LOBBY_JOIN_REQUESTED: i32 = 333;
const CALLBACK_AVATAR_IMAGE_LOADED: i32 = 334;
const CALLBACK_CLAN_OFFICER_LIST_RESPONSE: i32 = 335;
const CALLBACK_FRIEND_RICH_PRESENCE_UPDATE: i32 = 336;
const CALLBACK_GAME_RICH_PRESENCE_JOIN_REQUESTED: i32 = 337;
const CALLBACK_GAME_CONNECTED_CLAN_CHAT_MSG: i32 = 338;
const CALLBACK_GAME_CONNECTED_CHAT_JOIN: i32 = 339;
const CALLBACK_GAME_CONNECTED_CHAT_LEAVE: i32 = 340;
const CALLBACK_DOWNLOAD_CLAN_ACTIVITY_COUNTS_RESULT: i32 = 341;
const CALLBACK_JOIN_CLAN_CHAT_ROOM_COMPLETION_RESULT: i32 = 342;
const CALLBACK_GAME_CONNECTED_FRIEND_CHAT_MSG: i32 = 343;
const CALLBACK_FRIENDS_GET_FOLLOWER_COUNT: i32 = 344;
const CALLBACK_FRIENDS_IS_FOLLOWING: i32 = 345;
const CALLBACK_FRIENDS_ENUMERATE_FOLLOWING_LIST: i32 = 346;
const CALLBACK_UNREAD_CHAT_MESSAGES_CHANGED: i32 = 348;
const CALLBACK_OVERLAY_BROWSER_PROTOCOL_NAVIGATION: i32 = 349;
const CALLBACK_EQUIPPED_PROFILE_ITEMS_CHANGED: i32 = 350;
const CALLBACK_EQUIPPED_PROFILE_ITEMS: i32 = 351;
const CALLBACK_P2P_SESSION_REQUEST: i32 = 1202;
const CALLBACK_P2P_SESSION_CONNECT_FAIL: i32 = 1203;
const CALLBACK_STEAM_NET_CONNECTION_STATUS_CHANGED: i32 = 1221;
const CALLBACK_STEAM_NET_AUTHENTICATION_STATUS: i32 = 1222;
const CALLBACK_STEAM_NETWORKING_FAKE_IP_RESULT: i32 = 1223;
const CALLBACK_STEAM_NETWORKING_MESSAGES_SESSION_REQUEST: i32 = 1251;
const CALLBACK_STEAM_NETWORKING_MESSAGES_SESSION_FAILED: i32 = 1252;
const CALLBACK_STEAM_RELAY_NETWORK_STATUS: i32 = 1281;
const CALLBACK_STEAM_INPUT_DEVICE_CONNECTED: i32 = 2801;
const CALLBACK_STEAM_INPUT_DEVICE_DISCONNECTED: i32 = 2802;
const CALLBACK_STEAM_INPUT_CONFIGURATION_LOADED: i32 = 2803;
const CALLBACK_STEAM_INPUT_GAMEPAD_SLOT_CHANGE: i32 = 2804;
const STEAM_GAME_SERVER_INTERFACE_VERSIONS: &[u8] = b"SteamUtils010\0SteamNetworkingUtils004\0SteamGameServer015\0SteamGameServerStats001\0STEAMHTTP_INTERFACE_VERSION003\0STEAMINVENTORY_INTERFACE_V003\0SteamNetworking006\0SteamNetworkingMessages002\0SteamNetworkingSockets012\0STEAMUGC_INTERFACE_VERSION021\0\0";
const CALLBACK_GAME_SERVER_CLIENT_APPROVE: i32 = 201;
const CALLBACK_GAME_SERVER_CLIENT_DENY: i32 = 202;
const CALLBACK_GAME_SERVER_CLIENT_KICK: i32 = 203;
const CALLBACK_GAME_SERVER_CLIENT_ACHIEVEMENT_STATUS: i32 = 206;
const CALLBACK_GAME_SERVER_POLICY_RESPONSE: i32 = 115;
const CALLBACK_GAME_SERVER_GAMEPLAY_STATS: i32 = 207;
const CALLBACK_GAME_SERVER_CLIENT_GROUP_STATUS: i32 = 208;
const CALLBACK_GAME_SERVER_REPUTATION: i32 = 209;
const CALLBACK_GAME_SERVER_ASSOCIATE_WITH_CLAN: i32 = 210;
const CALLBACK_GAME_SERVER_PLAYER_COMPATIBILITY: i32 = 211;
const CALLBACK_GAME_SERVER_STATS_UNLOADED: i32 = 1108;
const CALLBACK_GAME_SERVER_STATS_RECEIVED: i32 = 1800;
const CALLBACK_GAME_SERVER_STATS_STORED: i32 = 1801;
const CALLBACK_REMOTE_STORAGE_FILE_SHARE_RESULT: i32 = 1307;
const CALLBACK_REMOTE_STORAGE_PUBLISH_FILE_RESULT: i32 = 1309;
const CALLBACK_REMOTE_STORAGE_DELETE_PUBLISHED_FILE_RESULT: i32 = 1311;
const CALLBACK_REMOTE_STORAGE_ENUMERATE_USER_PUBLISHED_FILES_RESULT: i32 = 1312;
const CALLBACK_REMOTE_STORAGE_SUBSCRIBE_PUBLISHED_FILE_RESULT: i32 = 1313;
const CALLBACK_REMOTE_STORAGE_ENUMERATE_USER_SUBSCRIBED_FILES_RESULT: i32 = 1314;
const CALLBACK_REMOTE_STORAGE_UNSUBSCRIBE_PUBLISHED_FILE_RESULT: i32 = 1315;
const CALLBACK_REMOTE_STORAGE_UPDATE_PUBLISHED_FILE_RESULT: i32 = 1316;
const CALLBACK_REMOTE_STORAGE_DOWNLOAD_UGC_RESULT: i32 = 1317;
const CALLBACK_REMOTE_STORAGE_GET_PUBLISHED_FILE_DETAILS_RESULT: i32 = 1318;
const CALLBACK_REMOTE_STORAGE_ENUMERATE_WORKSHOP_FILES_RESULT: i32 = 1319;
const CALLBACK_REMOTE_STORAGE_GET_PUBLISHED_ITEM_VOTE_DETAILS_RESULT: i32 = 1320;
const CALLBACK_REMOTE_STORAGE_PUBLISHED_FILE_SUBSCRIBED: i32 = 1321;
const CALLBACK_REMOTE_STORAGE_PUBLISHED_FILE_UNSUBSCRIBED: i32 = 1322;
const CALLBACK_REMOTE_STORAGE_PUBLISHED_FILE_DELETED: i32 = 1323;
const CALLBACK_REMOTE_STORAGE_UPDATE_USER_PUBLISHED_ITEM_VOTE_RESULT: i32 = 1324;
const CALLBACK_REMOTE_STORAGE_USER_VOTE_DETAILS: i32 = 1325;
const CALLBACK_REMOTE_STORAGE_ENUMERATE_USER_SHARED_WORKSHOP_FILES_RESULT: i32 = 1326;
const CALLBACK_REMOTE_STORAGE_SET_USER_PUBLISHED_FILE_ACTION_RESULT: i32 = 1327;
const CALLBACK_REMOTE_STORAGE_ENUMERATE_PUBLISHED_FILES_BY_USER_ACTION_RESULT: i32 = 1328;
const CALLBACK_REMOTE_STORAGE_PUBLISH_FILE_PROGRESS: i32 = 1329;
const CALLBACK_REMOTE_STORAGE_PUBLISHED_FILE_UPDATED: i32 = 1330;
const CALLBACK_REMOTE_STORAGE_FILE_WRITE_ASYNC_COMPLETE: i32 = 1331;
const CALLBACK_REMOTE_STORAGE_FILE_READ_ASYNC_COMPLETE: i32 = 1332;
const CALLBACK_STEAM_UGC_QUERY_COMPLETED: i32 = 3401;
const CALLBACK_STEAM_UGC_REQUEST_DETAILS_RESULT: i32 = 3402;
const CALLBACK_STEAM_UGC_CREATE_ITEM_RESULT: i32 = 3403;
const CALLBACK_STEAM_UGC_SUBMIT_ITEM_UPDATE_RESULT: i32 = 3404;
const CALLBACK_STEAM_UGC_ITEM_INSTALLED: i32 = 3405;
const CALLBACK_STEAM_UGC_DOWNLOAD_ITEM_RESULT: i32 = 3406;
const CALLBACK_STEAM_UGC_USER_FAVORITE_ITEMS_LIST_CHANGED: i32 = 3407;
const CALLBACK_STEAM_UGC_SET_USER_ITEM_VOTE_RESULT: i32 = 3408;
const CALLBACK_STEAM_UGC_GET_USER_ITEM_VOTE_RESULT: i32 = 3409;
const CALLBACK_STEAM_UGC_START_PLAYTIME_TRACKING_RESULT: i32 = 3410;
const CALLBACK_STEAM_UGC_STOP_PLAYTIME_TRACKING_RESULT: i32 = 3411;
const CALLBACK_STEAM_UGC_ADD_DEPENDENCY_RESULT: i32 = 3412;
const CALLBACK_STEAM_UGC_REMOVE_DEPENDENCY_RESULT: i32 = 3413;
const CALLBACK_STEAM_UGC_ADD_APP_DEPENDENCY_RESULT: i32 = 3414;
const CALLBACK_STEAM_UGC_REMOVE_APP_DEPENDENCY_RESULT: i32 = 3415;
const CALLBACK_STEAM_UGC_GET_APP_DEPENDENCIES_RESULT: i32 = 3416;
const CALLBACK_STEAM_UGC_DELETE_ITEM_RESULT: i32 = 3417;
const CALLBACK_STEAM_UGC_USER_SUBSCRIBED_ITEMS_LIST_CHANGED: i32 = 3418;
const CALLBACK_STEAM_UGC_WORKSHOP_EULA_STATUS: i32 = 3420;
const MAX_HTML_PAINT_BUFFER_BYTES: u64 = 256 * 1024 * 1024;
const SCE_PAD_TRIGGER_EFFECT_PARAM_BYTES: usize = 120;

static NEXT_NETWORKING_FAKE_UDP_PORT_HANDLE: AtomicU32 = AtomicU32::new(1);
static NETWORKING_FAKE_UDP_PORTS: Lazy<Mutex<HashMap<u32, usize>>> =
    Lazy::new(|| Mutex::new(HashMap::new()));
static NEXT_INPUT_ACTION_EVENT_REGISTRATION: AtomicU64 = AtomicU64::new(1);
static INPUT_ACTION_EVENT_HANDLER: Lazy<Mutex<Option<(u64, FatalThreadsafeFunction<Value>)>>> =
    Lazy::new(|| Mutex::new(None));
static NEXT_MATCHMAKING_SERVER_LIST_HANDLE: AtomicU64 = AtomicU64::new(1);
static MATCHMAKING_SERVER_LIST_REQUESTS: Lazy<
    Mutex<HashMap<u64, MatchmakingServerListRequestEntry>>,
> = Lazy::new(|| Mutex::new(HashMap::new()));
const CALLBACK_HTTP_REQUEST_COMPLETED: i32 = 2101;
const CALLBACK_HTTP_REQUEST_HEADERS_RECEIVED: i32 = 2102;
const CALLBACK_HTTP_REQUEST_DATA_RECEIVED: i32 = 2103;
const CALLBACK_SCREENSHOT_READY: i32 = 2301;
const CALLBACK_SCREENSHOT_REQUESTED: i32 = 2302;
const CALLBACK_PLAYBACK_STATUS_HAS_CHANGED: i32 = 4001;
const CALLBACK_VOLUME_HAS_CHANGED: i32 = 4002;
const CALLBACK_HTML_BROWSER_READY: i32 = 4501;
const CALLBACK_HTML_NEEDS_PAINT: i32 = 4502;
const CALLBACK_HTML_START_REQUEST: i32 = 4503;
const CALLBACK_HTML_CLOSE_BROWSER: i32 = 4504;
const CALLBACK_HTML_URL_CHANGED: i32 = 4505;
const CALLBACK_HTML_FINISHED_REQUEST: i32 = 4506;
const CALLBACK_HTML_OPEN_LINK_IN_NEW_TAB: i32 = 4507;
const CALLBACK_HTML_CHANGED_TITLE: i32 = 4508;
const CALLBACK_HTML_SEARCH_RESULTS: i32 = 4509;
const CALLBACK_HTML_CAN_GO_BACK_AND_FORWARD: i32 = 4510;
const CALLBACK_HTML_HORIZONTAL_SCROLL: i32 = 4511;
const CALLBACK_HTML_VERTICAL_SCROLL: i32 = 4512;
const CALLBACK_HTML_LINK_AT_POSITION: i32 = 4513;
const CALLBACK_HTML_JS_ALERT: i32 = 4514;
const CALLBACK_HTML_JS_CONFIRM: i32 = 4515;
const CALLBACK_HTML_FILE_OPEN_DIALOG: i32 = 4516;
const CALLBACK_HTML_NEW_WINDOW: i32 = 4521;
const CALLBACK_HTML_SET_CURSOR: i32 = 4522;
const CALLBACK_HTML_STATUS_TEXT: i32 = 4523;
const CALLBACK_HTML_SHOW_TOOL_TIP: i32 = 4524;
const CALLBACK_HTML_UPDATE_TOOL_TIP: i32 = 4525;
const CALLBACK_HTML_HIDE_TOOL_TIP: i32 = 4526;
const CALLBACK_HTML_BROWSER_RESTARTED: i32 = 4527;
const CALLBACK_BROADCAST_UPLOAD_START: i32 = 4604;
const CALLBACK_BROADCAST_UPLOAD_STOP: i32 = 4605;
const CALLBACK_GET_VIDEO_URL_RESULT: i32 = 4611;
const CALLBACK_GET_OPF_SETTINGS_RESULT: i32 = 4624;
const CALLBACK_STEAM_PARENTAL_SETTINGS_CHANGED: i32 = 5001;
const CALLBACK_JOIN_PARTY: i32 = 5301;
const CALLBACK_CREATE_BEACON: i32 = 5302;
const CALLBACK_RESERVATION_NOTIFICATION: i32 = 5303;
const CALLBACK_CHANGE_NUM_OPEN_SLOTS: i32 = 5304;
const CALLBACK_STEAM_REMOTE_PLAY_SESSION_CONNECTED: i32 = 5701;
const CALLBACK_STEAM_REMOTE_PLAY_SESSION_DISCONNECTED: i32 = 5702;
const CALLBACK_STEAM_REMOTE_PLAY_TOGETHER_GUEST_INVITE: i32 = 5703;
const CALLBACK_STEAM_REMOTE_PLAY_SESSION_AVATAR_LOADED: i32 = 5704;
const CALLBACK_STEAM_TIMELINE_GAME_PHASE_RECORDING_EXISTS: i32 = 6001;
const CALLBACK_STEAM_TIMELINE_EVENT_RECORDING_EXISTS: i32 = 6002;
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
const MAX_API_CALL_RESULT_BYTES: u32 = 1024 * 1024;
const MAX_NETWORKING_CONFIG_VALUE_BYTES: u32 = 1024 * 1024;
const MAX_USER_VOICE_BYTES: u32 = 1024 * 1024;
const DEFAULT_USER_VOICE_BYTES: u32 = 64 * 1024;
const DEFAULT_DEPRECATED_GAME_CONNECTION_AUTH_BLOB_BYTES: u32 = 2048;
const MAX_ENCRYPTED_APP_TICKET_DATA_BYTES: usize = 1024;
const MAX_ENCRYPTED_APP_TICKET_BYTES: u32 = 4096;
const USER_DATA_FOLDER_BUFFER_SIZE: usize = 4096;
const MAX_CLOUD_ASYNC_READ_BYTES: u32 = 100 * 1024 * 1024;
const MAX_CLOUD_UGC_READ_BYTES: u32 = 100 * 1024 * 1024;

type FatalThreadsafeFunction<T> = ThreadsafeFunction<T, (), Vec<T>, Status, false>;
type JsCallback<'scope, T> = Function<'scope, T, ()>;

#[repr(C)]
struct MatchmakingServerListResponseRaw {
    vtable: *const MatchmakingServerListResponseVTable,
    state: *mut MatchmakingServerListState,
}

#[repr(C)]
struct MatchmakingServerListResponseVTable {
    server_responded: unsafe extern "C" fn(
        *mut MatchmakingServerListResponseRaw,
        sys::HServerListRequest,
        std::os::raw::c_int,
    ),
    server_failed_to_respond: unsafe extern "C" fn(
        *mut MatchmakingServerListResponseRaw,
        sys::HServerListRequest,
        std::os::raw::c_int,
    ),
    refresh_complete: unsafe extern "C" fn(
        *mut MatchmakingServerListResponseRaw,
        sys::HServerListRequest,
        sys::EMatchMakingServerResponse,
    ),
}

struct MatchmakingServerListState {
    inner: Mutex<MatchmakingServerListStateInner>,
}

#[derive(Default)]
struct MatchmakingServerListStateInner {
    request: usize,
    completed: bool,
    cancelled: bool,
    response: u32,
    responded: Vec<i32>,
    failed: Vec<i32>,
}

struct MatchmakingServerListRequestEntry {
    request: usize,
    app_id: u32,
    kind: MatchmakingServerListKind,
    response: Box<MatchmakingServerListResponseRaw>,
}

#[repr(C)]
struct MatchmakingPingResponseRaw {
    vtable: *const MatchmakingPingResponseVTable,
    state: *mut MatchmakingPingState,
}

#[repr(C)]
struct MatchmakingPingResponseVTable {
    server_responded:
        unsafe extern "C" fn(*mut MatchmakingPingResponseRaw, *mut sys::gameserveritem_t),
    server_failed_to_respond: unsafe extern "C" fn(*mut MatchmakingPingResponseRaw),
}

struct MatchmakingPingState {
    inner: Mutex<MatchmakingPingStateInner>,
}

#[derive(Default)]
struct MatchmakingPingStateInner {
    completed: bool,
    responded: bool,
    server: Option<MatchmakingServerItem>,
}

#[repr(C)]
struct MatchmakingPlayersResponseRaw {
    vtable: *const MatchmakingPlayersResponseVTable,
    state: *mut MatchmakingPlayersState,
}

#[repr(C)]
struct MatchmakingPlayersResponseVTable {
    add_player_to_list: unsafe extern "C" fn(
        *mut MatchmakingPlayersResponseRaw,
        *const c_char,
        std::os::raw::c_int,
        f32,
    ),
    players_failed_to_respond: unsafe extern "C" fn(*mut MatchmakingPlayersResponseRaw),
    players_refresh_complete: unsafe extern "C" fn(*mut MatchmakingPlayersResponseRaw),
}

struct MatchmakingPlayersState {
    inner: Mutex<MatchmakingPlayersStateInner>,
}

#[derive(Default)]
struct MatchmakingPlayersStateInner {
    completed: bool,
    responded: bool,
    players: Vec<MatchmakingServerPlayer>,
}

#[repr(C)]
struct MatchmakingRulesResponseRaw {
    vtable: *const MatchmakingRulesResponseVTable,
    state: *mut MatchmakingRulesState,
}

#[repr(C)]
struct MatchmakingRulesResponseVTable {
    rules_responded:
        unsafe extern "C" fn(*mut MatchmakingRulesResponseRaw, *const c_char, *const c_char),
    rules_failed_to_respond: unsafe extern "C" fn(*mut MatchmakingRulesResponseRaw),
    rules_refresh_complete: unsafe extern "C" fn(*mut MatchmakingRulesResponseRaw),
}

struct MatchmakingRulesState {
    inner: Mutex<MatchmakingRulesStateInner>,
}

#[derive(Default)]
struct MatchmakingRulesStateInner {
    completed: bool,
    responded: bool,
    rules: Vec<MatchmakingServerRule>,
}

unsafe impl Send for MatchmakingServerListResponseRaw {}
unsafe impl Send for MatchmakingPingResponseRaw {}
unsafe impl Send for MatchmakingPlayersResponseRaw {}
unsafe impl Send for MatchmakingRulesResponseRaw {}
unsafe impl Sync for MatchmakingServerListResponseRaw {}
unsafe impl Sync for MatchmakingPingResponseRaw {}
unsafe impl Sync for MatchmakingPlayersResponseRaw {}
unsafe impl Sync for MatchmakingRulesResponseRaw {}

static MATCHMAKING_SERVER_LIST_RESPONSE_VTABLE: MatchmakingServerListResponseVTable =
    MatchmakingServerListResponseVTable {
        server_responded: matchmaking_server_list_responded,
        server_failed_to_respond: matchmaking_server_list_failed_to_respond,
        refresh_complete: matchmaking_server_list_refresh_complete,
    };

static MATCHMAKING_PING_RESPONSE_VTABLE: MatchmakingPingResponseVTable =
    MatchmakingPingResponseVTable {
        server_responded: matchmaking_ping_responded,
        server_failed_to_respond: matchmaking_ping_failed_to_respond,
    };

static MATCHMAKING_PLAYERS_RESPONSE_VTABLE: MatchmakingPlayersResponseVTable =
    MatchmakingPlayersResponseVTable {
        add_player_to_list: matchmaking_players_add_player,
        players_failed_to_respond: matchmaking_players_failed_to_respond,
        players_refresh_complete: matchmaking_players_refresh_complete,
    };

static MATCHMAKING_RULES_RESPONSE_VTABLE: MatchmakingRulesResponseVTable =
    MatchmakingRulesResponseVTable {
        rules_responded: matchmaking_rules_responded,
        rules_failed_to_respond: matchmaking_rules_failed_to_respond,
        rules_refresh_complete: matchmaking_rules_refresh_complete,
    };

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
pub struct CloudQuota {
    pub total_bytes: BigInt,
    pub available_bytes: BigInt,
}

#[derive(Debug)]
#[napi(object)]
pub struct CloudLocalFileChange {
    pub name: String,
    pub change_type: u32,
    pub path_type: u32,
}

#[derive(Debug)]
#[napi(object)]
pub struct CloudFileShareResult {
    pub result: u32,
    pub file: BigInt,
    pub name: String,
}

#[derive(Debug)]
#[napi(object)]
pub struct CloudUgcDownloadProgress {
    pub downloaded_bytes: BigInt,
    pub expected_bytes: BigInt,
}

#[derive(Debug)]
#[napi(object)]
pub struct CloudUgcDetails {
    pub app_id: u32,
    pub name: String,
    pub size: BigInt,
    pub owner: PlayerSteamId,
}

#[derive(Debug)]
#[napi(object)]
pub struct CloudUgcDownloadResult {
    pub result: u32,
    pub file: BigInt,
    pub app_id: u32,
    pub size: BigInt,
    pub name: String,
    pub owner: PlayerSteamId,
}

#[derive(Debug)]
#[napi(object)]
pub struct CloudLegacyPublishedFileResult {
    pub result: u32,
    pub published_file_id: BigInt,
    pub needs_to_accept_agreement: Option<bool>,
}

#[derive(Debug)]
#[napi(object)]
pub struct CloudLegacyPublishedFileIdResult {
    pub result: u32,
    pub published_file_id: BigInt,
}

#[derive(Debug)]
#[napi(object)]
pub struct CloudLegacyPublishedFileActionResult {
    pub result: u32,
    pub published_file_id: BigInt,
    pub action: u32,
}

#[derive(Debug)]
#[napi(object)]
pub struct CloudLegacyPublishedFileDetails {
    pub result: u32,
    pub published_file_id: BigInt,
    pub creator_app_id: u32,
    pub consumer_app_id: u32,
    pub title: String,
    pub description: String,
    pub file: BigInt,
    pub preview_file: BigInt,
    pub owner: PlayerSteamId,
    pub time_created: u32,
    pub time_updated: u32,
    pub visibility: u32,
    pub banned: bool,
    pub tags: Vec<String>,
    pub tags_truncated: bool,
    pub file_name: String,
    pub file_size: BigInt,
    pub preview_file_size: BigInt,
    pub url: String,
    pub file_type: u32,
    pub accepted_for_use: bool,
}

#[derive(Debug)]
#[napi(object)]
pub struct CloudLegacyEnumerateFilesResult {
    pub result: u32,
    pub returned_results: i32,
    pub total_result_count: i32,
    pub published_file_ids: Vec<BigInt>,
}

#[derive(Debug)]
#[napi(object)]
pub struct CloudLegacyEnumerateSubscribedFilesResult {
    pub result: u32,
    pub returned_results: i32,
    pub total_result_count: i32,
    pub published_file_ids: Vec<BigInt>,
    pub subscribed_times: Vec<u32>,
}

#[derive(Debug)]
#[napi(object)]
pub struct CloudLegacyEnumerateWorkshopFilesResult {
    pub result: u32,
    pub returned_results: i32,
    pub total_result_count: i32,
    pub published_file_ids: Vec<BigInt>,
    pub scores: Vec<f64>,
    pub app_id: u32,
    pub start_index: u32,
}

#[derive(Debug)]
#[napi(object)]
pub struct CloudLegacyEnumerateUserActionFilesResult {
    pub result: u32,
    pub action: u32,
    pub returned_results: i32,
    pub total_result_count: i32,
    pub published_file_ids: Vec<BigInt>,
    pub updated_times: Vec<u32>,
}

#[derive(Debug)]
#[napi(object)]
pub struct CloudLegacyPublishedItemVoteDetails {
    pub result: u32,
    pub published_file_id: BigInt,
    pub votes_for: i32,
    pub votes_against: i32,
    pub reports: i32,
    pub score: f64,
}

#[derive(Debug)]
#[napi(object)]
pub struct CloudLegacyUserVoteDetails {
    pub result: u32,
    pub published_file_id: BigInt,
    pub vote: u32,
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
pub struct AppDlcData {
    pub app_id: u32,
    pub available: bool,
    pub name: String,
}

#[derive(Debug)]
#[napi(object)]
pub struct AppDlcDownloadProgress {
    pub bytes_downloaded: BigInt,
    pub bytes_total: BigInt,
}

#[derive(Debug)]
#[napi(object)]
pub struct AppTimedTrialInfo {
    pub seconds_allowed: u32,
    pub seconds_played: u32,
}

#[derive(Debug)]
#[napi(object)]
pub struct AppBetaCounts {
    pub total: i32,
    pub available: i32,
    pub private: i32,
}

#[derive(Debug)]
#[napi(object)]
pub struct AppBetaInfo {
    pub flags: u32,
    pub build_id: u32,
    pub name: String,
    pub description: String,
    pub last_updated: u32,
}

#[napi(object)]
pub struct AppFileDetails {
    pub result: u32,
    pub file_size: BigInt,
    pub sha: Buffer,
    pub sha_hex: String,
    pub flags: u32,
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
pub struct InputDigitalActionData {
    pub state: bool,
    pub active: bool,
}

#[derive(Debug)]
#[napi(object)]
pub struct InputAnalogActionData {
    pub mode: u32,
    pub x: f64,
    pub y: f64,
    pub active: bool,
}

#[derive(Debug)]
#[napi(object)]
pub struct InputMotionData {
    pub rotation_quaternion_x: f64,
    pub rotation_quaternion_y: f64,
    pub rotation_quaternion_z: f64,
    pub rotation_quaternion_w: f64,
    pub position_acceleration_x: f64,
    pub position_acceleration_y: f64,
    pub position_acceleration_z: f64,
    pub rotation_velocity_x: f64,
    pub rotation_velocity_y: f64,
    pub rotation_velocity_z: f64,
}

#[derive(Debug)]
#[napi(object)]
pub struct InputDeviceBindingRevision {
    pub major: i32,
    pub minor: i32,
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
pub struct LegacyNetworkingP2PSessionState {
    pub connection_active: bool,
    pub connecting: bool,
    pub session_error: u32,
    pub using_relay: bool,
    pub bytes_queued_for_send: i32,
    pub packets_queued_for_send: i32,
    pub remote_ip: u32,
    pub remote_ip_address: String,
    pub remote_port: u32,
}

#[napi(object)]
pub struct LegacyNetworkingSocketData {
    pub data: Buffer,
    pub size: u32,
}

#[napi(object)]
pub struct LegacyNetworkingListenSocketAvailable {
    pub socket: u32,
    pub size: u32,
}

#[napi(object)]
pub struct LegacyNetworkingListenSocketData {
    pub socket: u32,
    pub data: Buffer,
    pub size: u32,
}

#[derive(Debug)]
#[napi(object)]
pub struct LegacyNetworkingSocketInfo {
    pub remote_steam_id: PlayerSteamId,
    pub socket_status: i32,
    pub remote_ip: Option<u32>,
    pub remote_ip_address: Option<String>,
    pub remote_port: u32,
}

#[derive(Debug)]
#[napi(object)]
pub struct LegacyNetworkingListenSocketInfo {
    pub ip: Option<u32>,
    pub ip_address: Option<String>,
    pub port: u32,
}

#[derive(Debug)]
#[napi(object)]
pub struct GameServerInitOptions {
    pub ip: Option<u32>,
    pub game_port: u32,
    pub query_port: u32,
    pub server_mode: u32,
    pub version: String,
}

#[napi(object)]
pub struct GameServerAuthTicket {
    pub data: Buffer,
    pub handle: u32,
}

#[napi(object)]
pub struct GameServerPublicIp {
    pub is_set: bool,
    pub ip_type: u32,
    pub ipv4: Option<u32>,
    pub ipv4_address: Option<String>,
    pub ipv6: Option<Buffer>,
}

#[napi(object)]
pub struct GameServerOutgoingPacket {
    pub data: Buffer,
    pub ip: u32,
    pub ip_address: String,
    pub port: u32,
}

#[derive(Debug)]
#[napi(object)]
pub struct GameServerUserConnectResult {
    pub success: bool,
    pub steam_id: Option<PlayerSteamId>,
}

#[derive(Debug)]
#[napi(object)]
pub struct GameServerStatsResult {
    pub result: u32,
    pub steam_id: PlayerSteamId,
}

#[derive(Debug)]
#[napi(object)]
pub struct GameServerReputationResult {
    pub result: u32,
    pub reputation_score: u32,
    pub banned: bool,
    pub banned_ip: u32,
    pub banned_ip_address: String,
    pub banned_port: u32,
    pub banned_game_id: BigInt,
    pub ban_expires: u32,
}

#[derive(Debug)]
#[napi(object)]
pub struct GameServerAssociateWithClanResult {
    pub result: u32,
}

#[derive(Debug)]
#[napi(object)]
pub struct GameServerPlayerCompatibilityResult {
    pub result: u32,
    pub players_that_dont_like_candidate: i32,
    pub players_that_candidate_doesnt_like: i32,
    pub clan_players_that_dont_like_candidate: i32,
    pub candidate: PlayerSteamId,
}

#[napi(object)]
pub struct NetworkingIdentity {
    pub steam_id64: Option<BigInt>,
    pub text: Option<String>,
    pub generic_string: Option<String>,
    pub generic_bytes: Option<Buffer>,
    pub psn_id: Option<BigInt>,
    pub xbox_pairwise_id: Option<String>,
    pub ip_address: Option<NetworkingIpAddress>,
    pub ipv4: Option<u32>,
    pub port: Option<u32>,
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

#[napi(object)]
pub struct NetworkingSocketOutgoingMessage {
    pub connection: u32,
    pub data: Buffer,
    pub send_flags: Option<i32>,
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
pub struct NetworkingConnectionRealTimeLaneStatus {
    pub pending_unreliable: i32,
    pub pending_reliable: i32,
    pub sent_unacked_reliable: i32,
    pub queue_time: BigInt,
}

#[derive(Debug)]
#[napi(object)]
pub struct NetworkingConnectionRealTimeStatusWithLanes {
    pub status: NetworkingConnectionRealTimeStatus,
    pub lanes: Vec<NetworkingConnectionRealTimeLaneStatus>,
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
pub struct NetworkingConnectionInfo {
    pub state: i32,
    pub remote_identity: NetworkingIdentityInfo,
    pub user_data: BigInt,
    pub listen_socket: u32,
    pub remote_address: NetworkingIpAddressInfo,
    pub remote_pop: u32,
    pub relay_pop: u32,
    pub end_reason: i32,
    pub end_debug: String,
    pub connection_description: String,
    pub flags: i32,
}

#[derive(Debug)]
#[napi(object)]
pub struct NetworkingSocketPair {
    pub connection1: u32,
    pub connection2: u32,
}

#[derive(Debug)]
#[napi(object)]
pub struct NetworkingSocketSendResult {
    pub result: u32,
    pub message_number: BigInt,
}

#[derive(Debug)]
#[napi(object)]
pub struct NetworkingFakeIpResult {
    pub result: u32,
    pub identity: NetworkingIdentityInfo,
    pub ipv4: u32,
    pub ipv4_address: String,
    pub ports: Vec<u32>,
}

#[derive(Debug)]
#[napi(object)]
pub struct NetworkingRemoteFakeIpResult {
    pub result: u32,
    pub address: Option<NetworkingIpAddressInfo>,
}

#[napi(object)]
pub struct NetworkingHostedDedicatedServerRouting {
    pub pop_id: u32,
    pub size: u32,
    pub data: Buffer,
}

#[napi(object)]
pub struct NetworkingHostedDedicatedServerAddressResult {
    pub result: u32,
    pub routing: Option<NetworkingHostedDedicatedServerRouting>,
    pub debug_message: String,
}

#[napi(object)]
pub struct NetworkingGameCoordinatorServerLoginResult {
    pub result: u32,
    pub identity: Option<NetworkingIdentityInfo>,
    pub routing: Option<NetworkingHostedDedicatedServerRouting>,
    pub app_id: u32,
    pub timestamp: u32,
    pub app_data: Buffer,
    pub signed_blob: Buffer,
    pub debug_message: String,
}

#[napi(object)]
pub struct NetworkingCertificateResult {
    pub success: bool,
    pub data: Buffer,
    pub error: String,
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
pub struct NetworkingConfigValueResult {
    pub result: i32,
    pub data_type: u32,
    pub int32_value: Option<i32>,
    pub int64_value: Option<BigInt>,
    pub float_value: Option<f64>,
    pub string_value: Option<String>,
}

#[napi(object)]
pub struct NetworkingConfigValue {
    pub value: u32,
    pub data_type: Option<u32>,
    pub int32_value: Option<i32>,
    pub int64_value: Option<BigInt>,
    pub float_value: Option<f64>,
    pub string_value: Option<String>,
}

#[derive(Debug)]
#[napi(object)]
pub struct NetworkingConfigValueInfo {
    pub value: u32,
    pub name: Option<String>,
    pub data_type: u32,
    pub scope: u32,
}

#[derive(Debug)]
#[napi(object)]
pub struct NetworkingDebugOutput {
    pub detail_level: i32,
    pub message: String,
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
pub struct SteamClientLocalUser {
    pub user: i32,
    pub pipe: i32,
}

#[napi(object)]
pub struct NetworkingIpAddress {
    pub text: Option<String>,
    pub ipv4: Option<u32>,
    pub ipv6: Option<Buffer>,
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
pub struct MatchmakingFavoriteGame {
    pub app_id: u32,
    pub ip: u32,
    pub ip_address: String,
    pub conn_port: u32,
    pub query_port: u32,
    pub flags: u32,
    pub last_played_on_server: u32,
}

#[derive(Debug)]
#[napi(object)]
pub struct MatchmakingServerAddress {
    pub ip: u32,
    pub ip_address: String,
    pub connection_port: u32,
    pub query_port: u32,
    pub connection_address: String,
    pub query_address: String,
}

#[derive(Debug)]
#[napi(object)]
pub struct MatchmakingServerBrowserFilter {
    pub key: String,
    pub value: String,
}

#[derive(Debug)]
#[napi(object)]
pub struct MatchmakingServerItem {
    pub address: MatchmakingServerAddress,
    pub ping: i32,
    pub had_successful_response: bool,
    pub do_not_refresh: bool,
    pub game_dir: String,
    pub map: String,
    pub game_description: String,
    pub app_id: u32,
    pub players: i32,
    pub max_players: i32,
    pub bot_players: i32,
    pub password: bool,
    pub secure: bool,
    pub time_last_played: u32,
    pub server_version: i32,
    pub name: String,
    pub game_tags: String,
    pub steam_id: PlayerSteamId,
}

#[derive(Debug)]
#[napi(object)]
pub struct MatchmakingServerListResult {
    pub response: u32,
    pub responded: Vec<i32>,
    pub failed: Vec<i32>,
    pub servers: Vec<MatchmakingServerItem>,
}

#[derive(Debug)]
#[napi(object)]
pub struct MatchmakingServerListRequest {
    pub handle: BigInt,
    pub steam_request: BigInt,
    pub app_id: u32,
    pub kind: String,
}

#[derive(Debug)]
#[napi(object)]
pub struct MatchmakingServerListRequestState {
    pub handle: BigInt,
    pub steam_request: BigInt,
    pub app_id: u32,
    pub kind: String,
    pub completed: bool,
    pub cancelled: bool,
    pub response: u32,
    pub responded: Vec<i32>,
    pub failed: Vec<i32>,
    pub refreshing: bool,
    pub server_count: i32,
}

#[derive(Debug)]
#[napi(object)]
pub struct MatchmakingServerPingResult {
    pub responded: bool,
    pub server: Option<MatchmakingServerItem>,
}

#[derive(Debug)]
#[napi(object)]
pub struct MatchmakingServerPlayer {
    pub name: String,
    pub score: i32,
    pub time_played: f64,
}

#[derive(Debug)]
#[napi(object)]
pub struct MatchmakingServerPlayersResult {
    pub responded: bool,
    pub players: Vec<MatchmakingServerPlayer>,
}

#[derive(Debug)]
#[napi(object)]
pub struct MatchmakingServerRule {
    pub name: String,
    pub value: String,
}

#[derive(Debug)]
#[napi(object)]
pub struct MatchmakingServerRulesResult {
    pub responded: bool,
    pub rules: Vec<MatchmakingServerRule>,
}

#[napi(object)]
pub struct LobbyChatEntry {
    pub steam_id: PlayerSteamId,
    pub data: Buffer,
    pub size: u32,
    pub text: String,
    pub entry_type: u32,
}

#[derive(Debug)]
#[napi(object)]
pub struct LobbyGameServer {
    pub ip: u32,
    pub ip_address: String,
    pub port: u32,
    pub steam_id: PlayerSteamId,
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
pub struct WorkshopItemTag {
    pub name: String,
    pub display_name: Option<String>,
}

#[derive(Debug)]
#[napi(object)]
pub struct WorkshopItemAdditionalPreview {
    pub url_or_video_id: String,
    pub original_file_name: String,
    pub preview_type: u32,
}

#[derive(Debug)]
#[napi(object)]
pub struct WorkshopItemKeyValueTag {
    pub key: String,
    pub value: String,
}

#[derive(Debug)]
#[napi(object)]
pub struct WorkshopItemSupportedGameVersion {
    pub game_branch_min: String,
    pub game_branch_max: String,
}

#[derive(Debug)]
#[napi(object)]
pub struct UgcResult {
    pub item_id: BigInt,
    pub needs_to_accept_agreement: bool,
}

#[derive(Debug)]
#[napi(object)]
pub struct WorkshopFavoriteResult {
    pub result: u32,
    pub item_id: BigInt,
    pub was_add_request: bool,
}

#[derive(Debug)]
#[napi(object)]
pub struct WorkshopSetUserItemVoteResult {
    pub result: u32,
    pub item_id: BigInt,
    pub vote_up: bool,
}

#[derive(Debug)]
#[napi(object)]
pub struct WorkshopGetUserItemVoteResult {
    pub result: u32,
    pub item_id: BigInt,
    pub voted_up: bool,
    pub voted_down: bool,
    pub vote_skipped: bool,
}

#[derive(Debug)]
#[napi(object)]
pub struct WorkshopSimpleResult {
    pub result: u32,
}

#[derive(Debug)]
#[napi(object)]
pub struct WorkshopDependencyResult {
    pub result: u32,
    pub item_id: BigInt,
    pub child_item_id: BigInt,
}

#[derive(Debug)]
#[napi(object)]
pub struct WorkshopAppDependencyResult {
    pub result: u32,
    pub item_id: BigInt,
    pub app_id: u32,
}

#[derive(Debug)]
#[napi(object)]
pub struct WorkshopAppDependenciesResult {
    pub result: u32,
    pub item_id: BigInt,
    pub app_ids: Vec<u32>,
    pub num_app_dependencies: u32,
    pub total_num_app_dependencies: u32,
}

#[derive(Debug)]
#[napi(object)]
pub struct WorkshopDeleteItemResult {
    pub result: u32,
    pub item_id: BigInt,
}

#[derive(Debug)]
#[napi(object)]
pub struct WorkshopEulaStatus {
    pub result: u32,
    pub app_id: u32,
    pub version: u32,
    pub action_time: u32,
    pub accepted: bool,
    pub needs_action: bool,
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
    pub tag_details: Vec<WorkshopItemTag>,
    pub tags_truncated: bool,
    pub metadata: Option<String>,
    pub children: Vec<BigInt>,
    pub additional_previews: Vec<WorkshopItemAdditionalPreview>,
    pub key_value_tags: Vec<WorkshopItemKeyValueTag>,
    pub first_key_value_tags: Vec<WorkshopItemKeyValueTag>,
    pub supported_game_versions: Vec<WorkshopItemSupportedGameVersion>,
    pub content_descriptors: Vec<u32>,
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
    pub next_cursor: String,
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

#[napi(object)]
pub struct FriendMessage {
    pub data: Buffer,
    pub size: u32,
    pub text: String,
    pub entry_type: u32,
}

#[napi(object)]
pub struct ClanChatMessage {
    pub chatter: PlayerSteamId,
    pub data: Buffer,
    pub size: u32,
    pub text: String,
    pub entry_type: u32,
}

#[derive(Debug)]
#[napi(object)]
pub struct EquippedProfileItemsResult {
    pub result: u32,
    pub steam_id: PlayerSteamId,
    pub has_animated_avatar: bool,
    pub has_avatar_frame: bool,
    pub has_profile_modifier: bool,
    pub has_profile_background: bool,
    pub has_mini_profile_background: bool,
    pub from_cache: bool,
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
pub struct DownloadClanActivityCountsResult {
    pub success: bool,
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

#[derive(Debug)]
#[napi(object)]
pub struct UtilsImageSize {
    pub width: u32,
    pub height: u32,
}

#[derive(Debug)]
#[napi(object)]
pub struct UtilsApiCallCompletion {
    pub completed: bool,
    pub failed: bool,
}

#[napi(object)]
pub struct UtilsApiCallResult {
    pub ok: bool,
    pub failed: bool,
    pub data: Option<Buffer>,
}

#[derive(Debug)]
#[napi(object)]
pub struct UtilsWarningMessage {
    pub severity: i32,
    pub message: String,
}

#[derive(Debug)]
#[napi(object)]
pub struct UtilsFilteredText {
    pub filtered: String,
    pub characters_filtered: i32,
}

#[derive(Debug)]
#[napi(object)]
pub struct UserVoiceAvailable {
    pub result: u32,
    pub compressed_bytes: u32,
    pub uncompressed_bytes: u32,
}

#[napi(object)]
pub struct UserVoiceData {
    pub result: u32,
    pub compressed: Option<Buffer>,
    pub uncompressed: Option<Buffer>,
    pub compressed_bytes: u32,
    pub uncompressed_bytes: u32,
}

#[napi(object)]
pub struct UserEncryptedAppTicket {
    pub result: u32,
    pub ticket: Option<Buffer>,
}

#[derive(Debug)]
#[napi(object)]
pub struct UserMarketEligibility {
    pub allowed: bool,
    pub not_allowed_reason: u32,
    pub allowed_at_time: u32,
    pub steam_guard_required_days: i32,
    pub new_device_cooldown_days: i32,
}

#[derive(Debug)]
#[napi(object)]
pub struct UserDurationControl {
    pub result: u32,
    pub app_id: u32,
    pub applicable: bool,
    pub seconds_last_5h: i32,
    pub progress: u32,
    pub notification: u32,
    pub seconds_today: i32,
    pub seconds_remaining: i32,
}

#[napi(js_name = "clientCreateSteamPipe")]
pub fn client_create_steam_pipe() -> Result<i32, Error> {
    Ok(unsafe { sys::SteamAPI_ISteamClient_CreateSteamPipe(steam_client()?) })
}

#[napi(js_name = "clientReleaseSteamPipe")]
pub fn client_release_steam_pipe(pipe: i32) -> Result<bool, Error> {
    Ok(unsafe { sys::SteamAPI_ISteamClient_BReleaseSteamPipe(steam_client()?, pipe) })
}

#[napi(js_name = "clientConnectToGlobalUser")]
pub fn client_connect_to_global_user(pipe: i32) -> Result<i32, Error> {
    Ok(unsafe { sys::SteamAPI_ISteamClient_ConnectToGlobalUser(steam_client()?, pipe) })
}

#[napi(js_name = "clientCreateLocalUser")]
pub fn client_create_local_user(account_type: u32) -> Result<SteamClientLocalUser, Error> {
    let mut pipe = 0;
    let user = unsafe {
        sys::SteamAPI_ISteamClient_CreateLocalUser(
            steam_client()?,
            &mut pipe,
            account_type_from_u32(account_type)?,
        )
    };
    Ok(SteamClientLocalUser { user, pipe })
}

#[napi(js_name = "clientReleaseUser")]
pub fn client_release_user(pipe: i32, user: i32) -> Result<(), Error> {
    unsafe { sys::SteamAPI_ISteamClient_ReleaseUser(steam_client()?, pipe, user) };
    Ok(())
}

#[napi(js_name = "clientSetLocalIpBinding")]
pub fn client_set_local_ip_binding(ipv4: u32, port: u32) -> Result<(), Error> {
    let ip = legacy_networking_steam_ip(ipv4);
    unsafe {
        sys::SteamAPI_ISteamClient_SetLocalIPBinding(
            steam_client()?,
            &ip,
            port_to_u16(port, "client local IP binding port")?,
        )
    };
    Ok(())
}

#[napi(js_name = "clientGetInterface")]
pub fn client_get_interface(
    interface_name: String,
    user: Option<i32>,
    pipe: Option<i32>,
    version: Option<String>,
) -> Result<Option<BigInt>, Error> {
    let user = user.unwrap_or(unsafe { sys::SteamAPI_GetHSteamUser() });
    let pipe = pipe.unwrap_or(unsafe { sys::SteamAPI_GetHSteamPipe() });
    let client = steam_client()?;
    let ptr = match interface_name.as_str() {
        "user" => unsafe {
            sys::SteamAPI_ISteamClient_GetISteamUser(
                client,
                user,
                pipe,
                sys::STEAMUSER_INTERFACE_VERSION.as_ptr().cast(),
            )
            .cast::<c_void>()
        },
        "gameServer" => unsafe {
            sys::SteamAPI_ISteamClient_GetISteamGameServer(
                client,
                user,
                pipe,
                sys::STEAMGAMESERVER_INTERFACE_VERSION.as_ptr().cast(),
            )
            .cast::<c_void>()
        },
        "friends" => unsafe {
            sys::SteamAPI_ISteamClient_GetISteamFriends(
                client,
                user,
                pipe,
                sys::STEAMFRIENDS_INTERFACE_VERSION.as_ptr().cast(),
            )
            .cast::<c_void>()
        },
        "utils" => unsafe {
            sys::SteamAPI_ISteamClient_GetISteamUtils(
                client,
                pipe,
                sys::STEAMUTILS_INTERFACE_VERSION.as_ptr().cast(),
            )
            .cast::<c_void>()
        },
        "matchmaking" => unsafe {
            sys::SteamAPI_ISteamClient_GetISteamMatchmaking(
                client,
                user,
                pipe,
                sys::STEAMMATCHMAKING_INTERFACE_VERSION.as_ptr().cast(),
            )
            .cast::<c_void>()
        },
        "matchmakingServers" => unsafe {
            sys::SteamAPI_ISteamClient_GetISteamMatchmakingServers(
                client,
                user,
                pipe,
                sys::STEAMMATCHMAKINGSERVERS_INTERFACE_VERSION
                    .as_ptr()
                    .cast(),
            )
            .cast::<c_void>()
        },
        "generic" => {
            let version = version.ok_or_else(|| {
                Error::from_reason("generic Steam client interface version is required")
            })?;
            let version = cstring(version, "generic Steam client interface version")?;
            unsafe {
                sys::SteamAPI_ISteamClient_GetISteamGenericInterface(
                    client,
                    user,
                    pipe,
                    version.as_ptr(),
                )
            }
        }
        "userStats" => unsafe {
            sys::SteamAPI_ISteamClient_GetISteamUserStats(
                client,
                user,
                pipe,
                sys::STEAMUSERSTATS_INTERFACE_VERSION.as_ptr().cast(),
            )
            .cast::<c_void>()
        },
        "gameServerStats" => unsafe {
            sys::SteamAPI_ISteamClient_GetISteamGameServerStats(
                client,
                user,
                pipe,
                sys::STEAMGAMESERVERSTATS_INTERFACE_VERSION.as_ptr().cast(),
            )
            .cast::<c_void>()
        },
        "apps" => unsafe {
            sys::SteamAPI_ISteamClient_GetISteamApps(
                client,
                user,
                pipe,
                sys::STEAMAPPS_INTERFACE_VERSION.as_ptr().cast(),
            )
            .cast::<c_void>()
        },
        "networking" => unsafe {
            sys::SteamAPI_ISteamClient_GetISteamNetworking(
                client,
                user,
                pipe,
                sys::STEAMNETWORKING_INTERFACE_VERSION.as_ptr().cast(),
            )
            .cast::<c_void>()
        },
        "remoteStorage" => unsafe {
            sys::SteamAPI_ISteamClient_GetISteamRemoteStorage(
                client,
                user,
                pipe,
                sys::STEAMREMOTESTORAGE_INTERFACE_VERSION.as_ptr().cast(),
            )
            .cast::<c_void>()
        },
        "screenshots" => unsafe {
            sys::SteamAPI_ISteamClient_GetISteamScreenshots(
                client,
                user,
                pipe,
                sys::STEAMSCREENSHOTS_INTERFACE_VERSION.as_ptr().cast(),
            )
            .cast::<c_void>()
        },
        "http" => unsafe {
            sys::SteamAPI_ISteamClient_GetISteamHTTP(
                client,
                user,
                pipe,
                sys::STEAMHTTP_INTERFACE_VERSION.as_ptr().cast(),
            )
            .cast::<c_void>()
        },
        "controller" => unsafe {
            sys::SteamAPI_ISteamClient_GetISteamController(
                client,
                user,
                pipe,
                sys::STEAMCONTROLLER_INTERFACE_VERSION.as_ptr().cast(),
            )
            .cast::<c_void>()
        },
        "ugc" => unsafe {
            sys::SteamAPI_ISteamClient_GetISteamUGC(
                client,
                user,
                pipe,
                sys::STEAMUGC_INTERFACE_VERSION.as_ptr().cast(),
            )
            .cast::<c_void>()
        },
        "music" => unsafe {
            sys::SteamAPI_ISteamClient_GetISteamMusic(
                client,
                user,
                pipe,
                sys::STEAMMUSIC_INTERFACE_VERSION.as_ptr().cast(),
            )
            .cast::<c_void>()
        },
        "htmlSurface" => unsafe {
            sys::SteamAPI_ISteamClient_GetISteamHTMLSurface(
                client,
                user,
                pipe,
                sys::STEAMHTMLSURFACE_INTERFACE_VERSION.as_ptr().cast(),
            )
            .cast::<c_void>()
        },
        "inventory" => unsafe {
            sys::SteamAPI_ISteamClient_GetISteamInventory(
                client,
                user,
                pipe,
                sys::STEAMINVENTORY_INTERFACE_VERSION.as_ptr().cast(),
            )
            .cast::<c_void>()
        },
        "video" => unsafe {
            sys::SteamAPI_ISteamClient_GetISteamVideo(
                client,
                user,
                pipe,
                sys::STEAMVIDEO_INTERFACE_VERSION.as_ptr().cast(),
            )
            .cast::<c_void>()
        },
        "parentalSettings" => unsafe {
            sys::SteamAPI_ISteamClient_GetISteamParentalSettings(
                client,
                user,
                pipe,
                sys::STEAMPARENTALSETTINGS_INTERFACE_VERSION.as_ptr().cast(),
            )
            .cast::<c_void>()
        },
        "input" => unsafe {
            sys::SteamAPI_ISteamClient_GetISteamInput(
                client,
                user,
                pipe,
                sys::STEAMINPUT_INTERFACE_VERSION.as_ptr().cast(),
            )
            .cast::<c_void>()
        },
        "parties" => unsafe {
            sys::SteamAPI_ISteamClient_GetISteamParties(
                client,
                user,
                pipe,
                sys::STEAMPARTIES_INTERFACE_VERSION.as_ptr().cast(),
            )
            .cast::<c_void>()
        },
        "remotePlay" => unsafe {
            sys::SteamAPI_ISteamClient_GetISteamRemotePlay(
                client,
                user,
                pipe,
                sys::STEAMREMOTEPLAY_INTERFACE_VERSION.as_ptr().cast(),
            )
            .cast::<c_void>()
        },
        _ => return Err(Error::from_reason("unknown Steam client interface")),
    };
    Ok(pointer_to_bigint(ptr))
}

#[napi(js_name = "clientGetIpcCallCount")]
pub fn client_get_ipc_call_count() -> Result<u32, Error> {
    Ok(unsafe { sys::SteamAPI_ISteamClient_GetIPCCallCount(steam_client()?) })
}

#[napi(js_name = "clientRegisterWarningMessageHook")]
pub fn client_register_warning_message_hook(
    #[napi(ts_arg_type = "(value: any) => void")] handler: JsCallback<'_, UtilsWarningMessage>,
) -> Result<CallbackHandle, Error> {
    crate::state::ensure_initialized()?;
    let threadsafe_handler: FatalThreadsafeFunction<UtilsWarningMessage> = handler
        .build_threadsafe_function::<UtilsWarningMessage>()
        .build_callback(|ctx| Ok(vec![ctx.value]))?;
    unsafe {
        sys::SteamAPI_ISteamClient_SetWarningMessageHook(
            steam_client()?,
            Some(steam_api_warning_message_hook),
        );
    }
    let registration = crate::state::register_warning_message_hook(move |severity, message| {
        threadsafe_handler.call(
            UtilsWarningMessage { severity, message },
            ThreadsafeFunctionCallMode::NonBlocking,
        );
    });
    Ok(CallbackHandle {
        registration: None,
        warning_message_registration: Some(registration),
        networking_debug_output_registration: None,
        input_action_event_registration: None,
    })
}

#[napi(js_name = "clientShutdownIfAllPipesClosed")]
pub fn client_shutdown_if_all_pipes_closed() -> Result<bool, Error> {
    Ok(unsafe { sys::SteamAPI_ISteamClient_BShutdownIfAllPipesClosed(steam_client()?) })
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

#[napi(js_name = "friendsDownloadClanActivityCounts")]
pub async fn friends_download_clan_activity_counts(
    clan_ids64: Vec<BigInt>,
    timeout_seconds: Option<u32>,
) -> Result<DownloadClanActivityCountsResult, Error> {
    let friends = steam_friends()?;
    let mut clan_ids = clan_ids64
        .into_iter()
        .map(|id| bigint_to_u64(id, "clanId64").map(u64_to_csteam_id))
        .collect::<Result<Vec<_>, _>>()?;
    let call = unsafe {
        sys::SteamAPI_ISteamFriends_DownloadClanActivityCounts(
            friends,
            clan_ids.as_mut_ptr(),
            clan_ids.len() as i32,
        )
    };
    drop(clan_ids);
    let result: sys::DownloadClanActivityCountsResult_t = wait_for_api_call(
        call,
        sys::DownloadClanActivityCountsResult_t_k_iCallback as i32,
        timeout_seconds
            .map(u64::from)
            .unwrap_or(DEFAULT_ASYNC_TIMEOUT_SECONDS)
            .max(1),
    )
    .await?;
    Ok(DownloadClanActivityCountsResult {
        success: unsafe { ptr::addr_of!(result.m_bSuccess).read_unaligned() },
    })
}

#[napi(js_name = "friendsGetFriendCountFromSource")]
pub fn friends_get_friend_count_from_source(source_id64: BigInt) -> Result<i32, Error> {
    let friends = steam_friends()?;
    let source_id = bigint_to_u64(source_id64, "sourceId64")?;
    Ok(unsafe { sys::SteamAPI_ISteamFriends_GetFriendCountFromSource(friends, source_id) })
}

#[napi(js_name = "friendsGetFriendFromSourceByIndex")]
pub fn friends_get_friend_from_source_by_index(
    source_id64: BigInt,
    index: i32,
) -> Result<PlayerSteamId, Error> {
    let friends = steam_friends()?;
    let source_id = bigint_to_u64(source_id64, "sourceId64")?;
    Ok(steam_id_to_player(unsafe {
        sys::SteamAPI_ISteamFriends_GetFriendFromSourceByIndex(friends, source_id, index)
    }))
}

#[napi(js_name = "friendsGetFriendsFromSource")]
pub fn friends_get_friends_from_source(source_id64: BigInt) -> Result<Vec<PlayerSteamId>, Error> {
    let friends = steam_friends()?;
    let source_id = bigint_to_u64(source_id64, "sourceId64")?;
    let count = unsafe { sys::SteamAPI_ISteamFriends_GetFriendCountFromSource(friends, source_id) };
    let mut friends_list = Vec::with_capacity(count.max(0) as usize);
    for index in 0..count {
        friends_list.push(steam_id_to_player(unsafe {
            sys::SteamAPI_ISteamFriends_GetFriendFromSourceByIndex(friends, source_id, index)
        }));
    }
    Ok(friends_list)
}

#[napi(js_name = "friendsIsUserInSource")]
pub fn friends_is_user_in_source(steam_id64: BigInt, source_id64: BigInt) -> Result<bool, Error> {
    let friends = steam_friends()?;
    let steam_id = bigint_to_u64(steam_id64, "steamId64")?;
    let source_id = bigint_to_u64(source_id64, "sourceId64")?;
    Ok(unsafe { sys::SteamAPI_ISteamFriends_IsUserInSource(friends, steam_id, source_id) })
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

#[napi(js_name = "friendsGetClanChatMessage")]
pub fn friends_get_clan_chat_message(
    clan_chat_id64: BigInt,
    message_id: i32,
    max_bytes: Option<u32>,
) -> Result<Option<ClanChatMessage>, Error> {
    let friends = steam_friends()?;
    let clan_chat_id = bigint_to_u64(clan_chat_id64, "clanChatId64")?;
    let capacity = max_bytes.unwrap_or(4096).clamp(1, 65_536);
    let mut data = vec![0u8; capacity as usize];
    let mut entry_type = sys::EChatEntryType::k_EChatEntryTypeInvalid;
    let mut chatter = u64_to_csteam_id(0);
    let size = unsafe {
        sys::SteamAPI_ISteamFriends_GetClanChatMessage(
            friends,
            clan_chat_id,
            message_id,
            data.as_mut_ptr().cast::<c_void>(),
            capacity as i32,
            &mut entry_type,
            &mut chatter,
        )
    };
    if size <= 0 {
        return Ok(None);
    }
    let size = size as usize;
    data.truncate(size.min(data.len()));
    Ok(Some(ClanChatMessage {
        chatter: csteam_id_to_player(chatter),
        text: u8_buf_to_string(&data),
        size: size as u32,
        data: data.into(),
        entry_type: entry_type as u32,
    }))
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

#[napi(js_name = "friendsGetFriendMessage")]
pub fn friends_get_friend_message(
    steam_id64: BigInt,
    message_id: i32,
    max_bytes: Option<u32>,
) -> Result<Option<FriendMessage>, Error> {
    let friends = steam_friends()?;
    let steam_id = bigint_to_u64(steam_id64, "steamId64")?;
    let capacity = max_bytes.unwrap_or(4096).clamp(1, 65_536);
    let mut data = vec![0u8; capacity as usize];
    let mut entry_type = sys::EChatEntryType::k_EChatEntryTypeInvalid;
    let size = unsafe {
        sys::SteamAPI_ISteamFriends_GetFriendMessage(
            friends,
            steam_id,
            message_id,
            data.as_mut_ptr().cast::<c_void>(),
            capacity as i32,
            &mut entry_type,
        )
    };
    if size <= 0 {
        return Ok(None);
    }
    let size = size as usize;
    data.truncate(size.min(data.len()));
    Ok(Some(FriendMessage {
        text: u8_buf_to_string(&data),
        size: size as u32,
        data: data.into(),
        entry_type: entry_type as u32,
    }))
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

#[napi(js_name = "friendsActivateGameOverlayRemotePlayTogetherInviteDialog")]
pub fn friends_activate_game_overlay_remote_play_together_invite_dialog(
    lobby_id64: BigInt,
) -> Result<(), Error> {
    let friends = steam_friends()?;
    let lobby_id = bigint_to_u64(lobby_id64, "lobbyId64")?;
    unsafe {
        sys::SteamAPI_ISteamFriends_ActivateGameOverlayRemotePlayTogetherInviteDialog(
            friends, lobby_id,
        )
    };
    Ok(())
}

#[napi(js_name = "friendsActivateGameOverlayInviteDialogConnectString")]
pub fn friends_activate_game_overlay_invite_dialog_connect_string(
    connect_string: String,
) -> Result<(), Error> {
    let friends = steam_friends()?;
    let connect_string = cstring(connect_string, "connect string")?;
    unsafe {
        sys::SteamAPI_ISteamFriends_ActivateGameOverlayInviteDialogConnectString(
            friends,
            connect_string.as_ptr(),
        )
    };
    Ok(())
}

#[napi(js_name = "friendsRequestEquippedProfileItems")]
pub async fn friends_request_equipped_profile_items(
    steam_id64: BigInt,
) -> Result<EquippedProfileItemsResult, Error> {
    let friends = steam_friends()?;
    let steam_id = bigint_to_u64(steam_id64, "steamId64")?;
    let call =
        unsafe { sys::SteamAPI_ISteamFriends_RequestEquippedProfileItems(friends, steam_id) };
    let result: sys::EquippedProfileItems_t = wait_for_api_call(
        call,
        sys::EquippedProfileItems_t_k_iCallback as i32,
        DEFAULT_ASYNC_TIMEOUT_SECONDS,
    )
    .await?;
    Ok(equipped_profile_items_result(&result))
}

#[napi(js_name = "friendsHasEquippedProfileItem")]
pub fn friends_has_equipped_profile_item(
    steam_id64: BigInt,
    item_type: u32,
) -> Result<bool, Error> {
    let friends = steam_friends()?;
    let steam_id = bigint_to_u64(steam_id64, "steamId64")?;
    Ok(unsafe {
        sys::SteamAPI_ISteamFriends_BHasEquippedProfileItem(
            friends,
            steam_id,
            community_profile_item_type_from_u32(item_type)?,
        )
    })
}

#[napi(js_name = "friendsGetProfileItemPropertyString")]
pub fn friends_get_profile_item_property_string(
    steam_id64: BigInt,
    item_type: u32,
    property: u32,
) -> Result<String, Error> {
    let friends = steam_friends()?;
    let steam_id = bigint_to_u64(steam_id64, "steamId64")?;
    Ok(string_from_ptr(unsafe {
        sys::SteamAPI_ISteamFriends_GetProfileItemPropertyString(
            friends,
            steam_id,
            community_profile_item_type_from_u32(item_type)?,
            community_profile_item_property_from_u32(property)?,
        )
    }))
}

#[napi(js_name = "friendsGetProfileItemPropertyUint")]
pub fn friends_get_profile_item_property_uint(
    steam_id64: BigInt,
    item_type: u32,
    property: u32,
) -> Result<u32, Error> {
    let friends = steam_friends()?;
    let steam_id = bigint_to_u64(steam_id64, "steamId64")?;
    Ok(unsafe {
        sys::SteamAPI_ISteamFriends_GetProfileItemPropertyUint(
            friends,
            steam_id,
            community_profile_item_type_from_u32(item_type)?,
            community_profile_item_property_from_u32(property)?,
        )
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

#[napi(js_name = "appsEarliestPurchaseUnixTime")]
pub fn apps_earliest_purchase_unix_time(app_id: u32) -> Result<u32, Error> {
    Ok(unsafe { sys::SteamAPI_ISteamApps_GetEarliestPurchaseUnixTime(steam_apps()?, app_id) })
}

#[napi(js_name = "appsDlcCount")]
pub fn apps_dlc_count() -> Result<i32, Error> {
    Ok(unsafe { sys::SteamAPI_ISteamApps_GetDLCCount(steam_apps()?) })
}

#[napi(js_name = "appsDlcDataByIndex")]
pub fn apps_dlc_data_by_index(index: i32) -> Result<Option<AppDlcData>, Error> {
    let apps = steam_apps()?;
    let mut app_id = 0u32;
    let mut available = false;
    let mut name = vec![0i8; 256];
    let ok = unsafe {
        sys::SteamAPI_ISteamApps_BGetDLCDataByIndex(
            apps,
            index,
            &mut app_id,
            &mut available,
            name.as_mut_ptr(),
            name.len() as i32,
        )
    };
    Ok(ok.then(|| AppDlcData {
        app_id,
        available,
        name: c_buf_to_string(&name),
    }))
}

#[napi(js_name = "appsInstallDlc")]
pub fn apps_install_dlc(app_id: u32) -> Result<(), Error> {
    unsafe { sys::SteamAPI_ISteamApps_InstallDLC(steam_apps()?, app_id) };
    Ok(())
}

#[napi(js_name = "appsUninstallDlc")]
pub fn apps_uninstall_dlc(app_id: u32) -> Result<(), Error> {
    unsafe { sys::SteamAPI_ISteamApps_UninstallDLC(steam_apps()?, app_id) };
    Ok(())
}

#[napi(js_name = "appsRequestAppProofOfPurchaseKey")]
pub fn apps_request_app_proof_of_purchase_key(app_id: u32) -> Result<(), Error> {
    unsafe { sys::SteamAPI_ISteamApps_RequestAppProofOfPurchaseKey(steam_apps()?, app_id) };
    Ok(())
}

#[napi(js_name = "appsRequestAllProofOfPurchaseKeys")]
pub fn apps_request_all_proof_of_purchase_keys() -> Result<(), Error> {
    unsafe { sys::SteamAPI_ISteamApps_RequestAllProofOfPurchaseKeys(steam_apps()?) };
    Ok(())
}

#[napi(js_name = "appsMarkContentCorrupt")]
pub fn apps_mark_content_corrupt(missing_files_only: bool) -> Result<bool, Error> {
    Ok(unsafe { sys::SteamAPI_ISteamApps_MarkContentCorrupt(steam_apps()?, missing_files_only) })
}

#[napi(js_name = "appsInstalledDepots")]
pub fn apps_installed_depots(app_id: u32, max_depots: Option<u32>) -> Result<Vec<u32>, Error> {
    let apps = steam_apps()?;
    let capacity = max_depots.unwrap_or(256).clamp(1, 4096);
    let mut depots = vec![0u32; capacity as usize];
    let returned = unsafe {
        sys::SteamAPI_ISteamApps_GetInstalledDepots(
            apps,
            app_id,
            depots.as_mut_ptr(),
            depots.len() as u32,
        )
    };
    let returned_len = returned.min(depots.len() as u32) as usize;
    depots.truncate(returned_len);
    Ok(depots)
}

#[napi(js_name = "appsLaunchQueryParam")]
pub fn apps_launch_query_param(key: String) -> Result<String, Error> {
    let key = cstring(key, "launch query param key")?;
    Ok(string_from_ptr(unsafe {
        sys::SteamAPI_ISteamApps_GetLaunchQueryParam(steam_apps()?, key.as_ptr())
    }))
}

#[napi(js_name = "appsDlcDownloadProgress")]
pub fn apps_dlc_download_progress(app_id: u32) -> Result<Option<AppDlcDownloadProgress>, Error> {
    let apps = steam_apps()?;
    let mut bytes_downloaded = 0u64;
    let mut bytes_total = 0u64;
    let ok = unsafe {
        sys::SteamAPI_ISteamApps_GetDlcDownloadProgress(
            apps,
            app_id,
            &mut bytes_downloaded,
            &mut bytes_total,
        )
    };
    Ok(ok.then(|| AppDlcDownloadProgress {
        bytes_downloaded: bytes_downloaded.into(),
        bytes_total: bytes_total.into(),
    }))
}

#[napi(js_name = "appsLaunchCommandLine")]
pub fn apps_launch_command_line(max_bytes: Option<u32>) -> Result<String, Error> {
    let apps = steam_apps()?;
    let capacity = max_bytes.unwrap_or(4096).clamp(1, 65_536);
    let mut buf = vec![0i8; capacity as usize];
    let len = unsafe {
        sys::SteamAPI_ISteamApps_GetLaunchCommandLine(apps, buf.as_mut_ptr(), buf.len() as i32)
    };
    if len <= 0 {
        Ok(String::new())
    } else {
        Ok(c_buf_to_string(&buf))
    }
}

#[napi(js_name = "appsIsSubscribedFromFamilySharing")]
pub fn apps_is_subscribed_from_family_sharing() -> Result<bool, Error> {
    Ok(unsafe { sys::SteamAPI_ISteamApps_BIsSubscribedFromFamilySharing(steam_apps()?) })
}

#[napi(js_name = "appsTimedTrial")]
pub fn apps_timed_trial() -> Result<Option<AppTimedTrialInfo>, Error> {
    let apps = steam_apps()?;
    let mut seconds_allowed = 0u32;
    let mut seconds_played = 0u32;
    let ok = unsafe {
        sys::SteamAPI_ISteamApps_BIsTimedTrial(apps, &mut seconds_allowed, &mut seconds_played)
    };
    Ok(ok.then_some(AppTimedTrialInfo {
        seconds_allowed,
        seconds_played,
    }))
}

#[napi(js_name = "appsSetDlcContext")]
pub fn apps_set_dlc_context(app_id: u32) -> Result<bool, Error> {
    Ok(unsafe { sys::SteamAPI_ISteamApps_SetDlcContext(steam_apps()?, app_id) })
}

#[napi(js_name = "appsBetaCounts")]
pub fn apps_beta_counts() -> Result<AppBetaCounts, Error> {
    let apps = steam_apps()?;
    let mut available = 0i32;
    let mut private = 0i32;
    let total = unsafe { sys::SteamAPI_ISteamApps_GetNumBetas(apps, &mut available, &mut private) };
    Ok(AppBetaCounts {
        total,
        available,
        private,
    })
}

#[napi(js_name = "appsBetaInfo")]
pub fn apps_beta_info(index: i32) -> Result<Option<AppBetaInfo>, Error> {
    let apps = steam_apps()?;
    let mut flags = 0u32;
    let mut build_id = 0u32;
    let mut beta_name = vec![0i8; 256];
    let mut description = vec![0i8; 1024];
    let mut last_updated = 0u32;
    let ok = unsafe {
        sys::SteamAPI_ISteamApps_GetBetaInfo(
            apps,
            index,
            &mut flags,
            &mut build_id,
            beta_name.as_mut_ptr(),
            beta_name.len() as i32,
            description.as_mut_ptr(),
            description.len() as i32,
            &mut last_updated,
        )
    };
    Ok(ok.then(|| AppBetaInfo {
        flags,
        build_id,
        name: c_buf_to_string(&beta_name),
        description: c_buf_to_string(&description),
        last_updated,
    }))
}

#[napi(js_name = "appsSetActiveBeta")]
pub fn apps_set_active_beta(beta_name: String) -> Result<bool, Error> {
    let beta_name = cstring(beta_name, "beta name")?;
    Ok(unsafe { sys::SteamAPI_ISteamApps_SetActiveBeta(steam_apps()?, beta_name.as_ptr()) })
}

#[napi(js_name = "appsGetFileDetails")]
pub async fn apps_get_file_details(
    file_name: String,
    timeout_seconds: Option<u32>,
) -> Result<AppFileDetails, Error> {
    let apps = steam_apps()?;
    let file_name = cstring(file_name, "file name")?;
    let call = unsafe { sys::SteamAPI_ISteamApps_GetFileDetails(apps, file_name.as_ptr()) };
    let result: sys::FileDetailsResult_t = wait_for_api_call(
        call,
        sys::FileDetailsResult_t_k_iCallback as i32,
        u64::from(timeout_seconds.unwrap_or(DEFAULT_ASYNC_TIMEOUT_SECONDS as u32)),
    )
    .await?;
    let sha = unsafe { ptr::addr_of!(result.m_FileSHA).read_unaligned() };
    Ok(AppFileDetails {
        result: unsafe { ptr::addr_of!(result.m_eResult).read_unaligned() } as u32,
        file_size: unsafe { ptr::addr_of!(result.m_ulFileSize).read_unaligned() }.into(),
        sha: sha.to_vec().into(),
        sha_hex: bytes_to_hex(&sha),
        flags: unsafe { ptr::addr_of!(result.m_unFlags).read_unaligned() },
    })
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

#[napi(js_name = "cloudWriteFileAsync")]
pub async fn cloud_write_file_async(
    name: String,
    data: Buffer,
    timeout_seconds: Option<u32>,
) -> Result<u32, Error> {
    let name = cstring(name, "cloud file name")?;
    let data = data.to_vec();
    let data_len = len_to_u32(data.len(), "cloud file data")?;
    let call = {
        let storage = steam_remote_storage()?;
        unsafe {
            sys::SteamAPI_ISteamRemoteStorage_FileWriteAsync(
                storage,
                name.as_ptr(),
                data.as_ptr().cast::<c_void>(),
                data_len,
            )
        }
    };
    let result: sys::RemoteStorageFileWriteAsyncComplete_t = wait_for_api_call(
        call,
        sys::RemoteStorageFileWriteAsyncComplete_t_k_iCallback as i32,
        timeout_seconds
            .map(u64::from)
            .unwrap_or(DEFAULT_ASYNC_TIMEOUT_SECONDS)
            .max(1),
    )
    .await?;
    drop(name);
    drop(data);
    Ok(unsafe { ptr::addr_of!(result.m_eResult).read_unaligned() } as u32)
}

#[napi(js_name = "cloudReadFileAsync")]
pub async fn cloud_read_file_async(
    name: String,
    offset: Option<u32>,
    bytes_to_read: Option<u32>,
    timeout_seconds: Option<u32>,
) -> Result<Buffer, Error> {
    let name = cstring(name, "cloud file name")?;
    let offset = offset.unwrap_or(0);
    let bytes_to_read = {
        let storage = steam_remote_storage()?;
        match bytes_to_read {
            Some(bytes) => bytes,
            None => {
                let size = unsafe {
                    sys::SteamAPI_ISteamRemoteStorage_GetFileSize(storage, name.as_ptr())
                };
                if size < 0 {
                    return Err(Error::from_reason("Steam Cloud file does not exist"));
                }
                (size as u32).saturating_sub(offset)
            }
        }
    };
    if bytes_to_read > MAX_CLOUD_ASYNC_READ_BYTES {
        return Err(Error::from_reason(format!(
            "cloud async read cannot exceed {MAX_CLOUD_ASYNC_READ_BYTES} bytes"
        )));
    }
    let call = {
        let storage = steam_remote_storage()?;
        unsafe {
            sys::SteamAPI_ISteamRemoteStorage_FileReadAsync(
                storage,
                name.as_ptr(),
                offset,
                bytes_to_read,
            )
        }
    };
    let result: sys::RemoteStorageFileReadAsyncComplete_t = wait_for_api_call(
        call,
        sys::RemoteStorageFileReadAsyncComplete_t_k_iCallback as i32,
        timeout_seconds
            .map(u64::from)
            .unwrap_or(DEFAULT_ASYNC_TIMEOUT_SECONDS)
            .max(1),
    )
    .await?;
    let eresult = unsafe { ptr::addr_of!(result.m_eResult).read_unaligned() };
    if eresult != sys::EResult::k_EResultOK {
        return Err(Error::from_reason(format!(
            "Steam Cloud async read failed: {eresult:?}"
        )));
    }
    let read_call = unsafe { ptr::addr_of!(result.m_hFileReadAsync).read_unaligned() };
    let bytes_read = unsafe { ptr::addr_of!(result.m_cubRead).read_unaligned() };
    if bytes_read > MAX_CLOUD_ASYNC_READ_BYTES {
        return Err(Error::from_reason(format!(
            "cloud async read cannot exceed {MAX_CLOUD_ASYNC_READ_BYTES} bytes"
        )));
    }
    let mut bytes = vec![0u8; bytes_read as usize];
    let ok = unsafe {
        sys::SteamAPI_ISteamRemoteStorage_FileReadAsyncComplete(
            steam_remote_storage()?,
            read_call,
            bytes.as_mut_ptr().cast::<c_void>(),
            bytes_read,
        )
    };
    drop(name);
    if !ok {
        return Err(Error::from_reason(
            "Steam Cloud async read completed but data retrieval failed",
        ));
    }
    Ok(bytes.into())
}

#[napi(js_name = "cloudShareFile")]
pub async fn cloud_share_file(
    name: String,
    timeout_seconds: Option<u32>,
) -> Result<CloudFileShareResult, Error> {
    let name = cstring(name, "cloud file name")?;
    let call = {
        let storage = steam_remote_storage()?;
        unsafe { sys::SteamAPI_ISteamRemoteStorage_FileShare(storage, name.as_ptr()) }
    };
    let result: sys::RemoteStorageFileShareResult_t = wait_for_api_call(
        call,
        sys::RemoteStorageFileShareResult_t_k_iCallback as i32,
        timeout_seconds
            .map(u64::from)
            .unwrap_or(DEFAULT_ASYNC_TIMEOUT_SECONDS)
            .max(1),
    )
    .await?;
    drop(name);
    Ok(remote_storage_file_share_result(&result))
}

#[napi(js_name = "cloudDeleteFile")]
pub fn cloud_delete_file(name: String) -> Result<bool, Error> {
    let name = cstring(name, "cloud file name")?;
    Ok(unsafe {
        sys::SteamAPI_ISteamRemoteStorage_FileDelete(steam_remote_storage()?, name.as_ptr())
    })
}

#[napi(js_name = "cloudForgetFile")]
pub fn cloud_forget_file(name: String) -> Result<bool, Error> {
    let name = cstring(name, "cloud file name")?;
    Ok(unsafe {
        sys::SteamAPI_ISteamRemoteStorage_FileForget(steam_remote_storage()?, name.as_ptr())
    })
}

#[napi(js_name = "cloudFileExists")]
pub fn cloud_file_exists(name: String) -> Result<bool, Error> {
    let name = cstring(name, "cloud file name")?;
    Ok(unsafe {
        sys::SteamAPI_ISteamRemoteStorage_FileExists(steam_remote_storage()?, name.as_ptr())
    })
}

#[napi(js_name = "cloudFilePersisted")]
pub fn cloud_file_persisted(name: String) -> Result<bool, Error> {
    let name = cstring(name, "cloud file name")?;
    Ok(unsafe {
        sys::SteamAPI_ISteamRemoteStorage_FilePersisted(steam_remote_storage()?, name.as_ptr())
    })
}

#[napi(js_name = "cloudGetFileSize")]
pub fn cloud_get_file_size(name: String) -> Result<Option<BigInt>, Error> {
    let name = cstring(name, "cloud file name")?;
    let size = unsafe {
        sys::SteamAPI_ISteamRemoteStorage_GetFileSize(steam_remote_storage()?, name.as_ptr())
    };
    Ok((size >= 0).then(|| (size as u64).into()))
}

#[napi(js_name = "cloudGetFileTimestamp")]
pub fn cloud_get_file_timestamp(name: String) -> Result<Option<BigInt>, Error> {
    let storage = steam_remote_storage()?;
    let name = cstring(name, "cloud file name")?;
    if !unsafe { sys::SteamAPI_ISteamRemoteStorage_FileExists(storage, name.as_ptr()) } {
        return Ok(None);
    }
    let timestamp =
        unsafe { sys::SteamAPI_ISteamRemoteStorage_GetFileTimestamp(storage, name.as_ptr()) };
    Ok(Some(timestamp.into()))
}

#[napi(js_name = "cloudGetSyncPlatforms")]
pub fn cloud_get_sync_platforms(name: String) -> Result<u32, Error> {
    let name = cstring(name, "cloud file name")?;
    Ok(unsafe {
        sys::SteamAPI_ISteamRemoteStorage_GetSyncPlatforms(steam_remote_storage()?, name.as_ptr()).0
    })
}

#[napi(js_name = "cloudSetSyncPlatforms")]
pub fn cloud_set_sync_platforms(name: String, platforms: u32) -> Result<bool, Error> {
    let name = cstring(name, "cloud file name")?;
    Ok(unsafe {
        sys::SteamAPI_ISteamRemoteStorage_SetSyncPlatforms(
            steam_remote_storage()?,
            name.as_ptr(),
            sys::ERemoteStoragePlatform(platforms),
        )
    })
}

#[napi(js_name = "cloudGetQuota")]
pub fn cloud_get_quota() -> Result<Option<CloudQuota>, Error> {
    let storage = steam_remote_storage()?;
    let mut total = 0u64;
    let mut available = 0u64;
    let ok =
        unsafe { sys::SteamAPI_ISteamRemoteStorage_GetQuota(storage, &mut total, &mut available) };
    Ok(ok.then(|| CloudQuota {
        total_bytes: total.into(),
        available_bytes: available.into(),
    }))
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

#[napi(js_name = "cloudGetLocalFileChangeCount")]
pub fn cloud_get_local_file_change_count() -> Result<i32, Error> {
    Ok(unsafe {
        sys::SteamAPI_ISteamRemoteStorage_GetLocalFileChangeCount(steam_remote_storage()?)
    })
}

#[napi(js_name = "cloudGetLocalFileChange")]
pub fn cloud_get_local_file_change(index: i32) -> Result<Option<CloudLocalFileChange>, Error> {
    let storage = steam_remote_storage()?;
    let mut change_type =
        sys::ERemoteStorageLocalFileChange::k_ERemoteStorageLocalFileChange_Invalid;
    let mut path_type = sys::ERemoteStorageFilePathType::k_ERemoteStorageFilePathType_Invalid;
    let name = unsafe {
        sys::SteamAPI_ISteamRemoteStorage_GetLocalFileChange(
            storage,
            index,
            &mut change_type,
            &mut path_type,
        )
    };
    Ok((!name.is_null()).then(|| CloudLocalFileChange {
        name: string_from_ptr(name),
        change_type: change_type as u32,
        path_type: path_type as u32,
    }))
}

#[napi(js_name = "cloudGetLocalFileChanges")]
pub fn cloud_get_local_file_changes() -> Result<Vec<CloudLocalFileChange>, Error> {
    let count = cloud_get_local_file_change_count()?.max(0);
    let mut changes = Vec::new();
    for index in 0..count {
        if let Some(change) = cloud_get_local_file_change(index)? {
            changes.push(change);
        }
    }
    Ok(changes)
}

#[napi(js_name = "cloudBeginFileWriteBatch")]
pub fn cloud_begin_file_write_batch() -> Result<bool, Error> {
    Ok(unsafe { sys::SteamAPI_ISteamRemoteStorage_BeginFileWriteBatch(steam_remote_storage()?) })
}

#[napi(js_name = "cloudEndFileWriteBatch")]
pub fn cloud_end_file_write_batch() -> Result<bool, Error> {
    Ok(unsafe { sys::SteamAPI_ISteamRemoteStorage_EndFileWriteBatch(steam_remote_storage()?) })
}

#[napi(js_name = "cloudOpenFileWriteStream")]
pub fn cloud_open_file_write_stream(name: String) -> Result<Option<BigInt>, Error> {
    let name = cstring(name, "cloud file name")?;
    let handle = unsafe {
        sys::SteamAPI_ISteamRemoteStorage_FileWriteStreamOpen(
            steam_remote_storage()?,
            name.as_ptr(),
        )
    };
    Ok((handle != sys::k_UGCFileStreamHandleInvalid).then(|| handle.into()))
}

#[napi(js_name = "cloudWriteFileStreamChunk")]
pub fn cloud_write_file_stream_chunk(handle: BigInt, data: Buffer) -> Result<bool, Error> {
    let handle = bigint_to_u64(handle, "cloud file stream handle")?;
    let data_len = len_to_i32(data.len(), "cloud file stream chunk")?;
    Ok(unsafe {
        sys::SteamAPI_ISteamRemoteStorage_FileWriteStreamWriteChunk(
            steam_remote_storage()?,
            handle,
            data.as_ptr().cast::<c_void>(),
            data_len,
        )
    })
}

#[napi(js_name = "cloudCloseFileWriteStream")]
pub fn cloud_close_file_write_stream(handle: BigInt) -> Result<bool, Error> {
    Ok(unsafe {
        sys::SteamAPI_ISteamRemoteStorage_FileWriteStreamClose(
            steam_remote_storage()?,
            bigint_to_u64(handle, "cloud file stream handle")?,
        )
    })
}

#[napi(js_name = "cloudCancelFileWriteStream")]
pub fn cloud_cancel_file_write_stream(handle: BigInt) -> Result<bool, Error> {
    Ok(unsafe {
        sys::SteamAPI_ISteamRemoteStorage_FileWriteStreamCancel(
            steam_remote_storage()?,
            bigint_to_u64(handle, "cloud file stream handle")?,
        )
    })
}

#[napi(js_name = "cloudDownloadUgc")]
pub async fn cloud_download_ugc(
    file: BigInt,
    priority: Option<u32>,
    timeout_seconds: Option<u32>,
) -> Result<CloudUgcDownloadResult, Error> {
    let call = unsafe {
        sys::SteamAPI_ISteamRemoteStorage_UGCDownload(
            steam_remote_storage()?,
            bigint_to_u64(file, "cloud UGC handle")?,
            priority.unwrap_or(0),
        )
    };
    let result: sys::RemoteStorageDownloadUGCResult_t = wait_for_api_call(
        call,
        sys::RemoteStorageDownloadUGCResult_t_k_iCallback as i32,
        timeout_seconds
            .map(u64::from)
            .unwrap_or(DEFAULT_ASYNC_TIMEOUT_SECONDS)
            .max(1),
    )
    .await?;
    Ok(remote_storage_download_ugc_result(&result))
}

#[napi(js_name = "cloudDownloadUgcToLocation")]
pub async fn cloud_download_ugc_to_location(
    file: BigInt,
    location: String,
    priority: Option<u32>,
    timeout_seconds: Option<u32>,
) -> Result<CloudUgcDownloadResult, Error> {
    let location = cstring(location, "cloud UGC download location")?;
    let call = unsafe {
        sys::SteamAPI_ISteamRemoteStorage_UGCDownloadToLocation(
            steam_remote_storage()?,
            bigint_to_u64(file, "cloud UGC handle")?,
            location.as_ptr(),
            priority.unwrap_or(0),
        )
    };
    let result: sys::RemoteStorageDownloadUGCResult_t = wait_for_api_call(
        call,
        sys::RemoteStorageDownloadUGCResult_t_k_iCallback as i32,
        timeout_seconds
            .map(u64::from)
            .unwrap_or(DEFAULT_ASYNC_TIMEOUT_SECONDS)
            .max(1),
    )
    .await?;
    drop(location);
    Ok(remote_storage_download_ugc_result(&result))
}

#[napi(js_name = "cloudGetUgcDownloadProgress")]
pub fn cloud_get_ugc_download_progress(
    file: BigInt,
) -> Result<Option<CloudUgcDownloadProgress>, Error> {
    let mut downloaded = 0i32;
    let mut expected = 0i32;
    let ok = unsafe {
        sys::SteamAPI_ISteamRemoteStorage_GetUGCDownloadProgress(
            steam_remote_storage()?,
            bigint_to_u64(file, "cloud UGC handle")?,
            &mut downloaded,
            &mut expected,
        )
    };
    Ok(ok.then(|| CloudUgcDownloadProgress {
        downloaded_bytes: (downloaded.max(0) as u64).into(),
        expected_bytes: (expected.max(0) as u64).into(),
    }))
}

#[napi(js_name = "cloudGetUgcDetails")]
pub fn cloud_get_ugc_details(file: BigInt) -> Result<Option<CloudUgcDetails>, Error> {
    let mut app_id = 0u32;
    let mut name = ptr::null_mut::<c_char>();
    let mut size = 0i32;
    let mut owner = u64_to_csteam_id(0);
    let ok = unsafe {
        sys::SteamAPI_ISteamRemoteStorage_GetUGCDetails(
            steam_remote_storage()?,
            bigint_to_u64(file, "cloud UGC handle")?,
            &mut app_id,
            &mut name,
            &mut size,
            &mut owner,
        )
    };
    Ok(ok.then(|| CloudUgcDetails {
        app_id,
        name: string_from_ptr(name.cast_const()),
        size: (size.max(0) as u64).into(),
        owner: csteam_id_to_player(owner),
    }))
}

#[napi(js_name = "cloudReadUgc")]
pub fn cloud_read_ugc(
    file: BigInt,
    bytes_to_read: u32,
    offset: Option<u32>,
    action: Option<u32>,
) -> Result<Option<Buffer>, Error> {
    if bytes_to_read > MAX_CLOUD_UGC_READ_BYTES {
        return Err(Error::from_reason(format!(
            "cloud UGC read cannot exceed {MAX_CLOUD_UGC_READ_BYTES} bytes"
        )));
    }
    let mut bytes = vec![0u8; bytes_to_read as usize];
    let read = unsafe {
        sys::SteamAPI_ISteamRemoteStorage_UGCRead(
            steam_remote_storage()?,
            bigint_to_u64(file, "cloud UGC handle")?,
            bytes.as_mut_ptr().cast::<c_void>(),
            len_to_i32(bytes.len(), "cloud UGC read")?,
            offset.unwrap_or(0),
            ugc_read_action_from_u32(action.unwrap_or(0))?,
        )
    };
    if read < 0 {
        return Ok(None);
    }
    bytes.truncate(read as usize);
    Ok(Some(bytes.into()))
}

#[napi(js_name = "cloudGetCachedUgcCount")]
pub fn cloud_get_cached_ugc_count() -> Result<i32, Error> {
    Ok(unsafe { sys::SteamAPI_ISteamRemoteStorage_GetCachedUGCCount(steam_remote_storage()?) })
}

#[napi(js_name = "cloudGetCachedUgcHandle")]
pub fn cloud_get_cached_ugc_handle(index: i32) -> Result<Option<BigInt>, Error> {
    let handle = unsafe {
        sys::SteamAPI_ISteamRemoteStorage_GetCachedUGCHandle(steam_remote_storage()?, index)
    };
    Ok((handle != sys::k_UGCHandleInvalid).then(|| handle.into()))
}

#[napi(js_name = "cloudGetCachedUgcHandles")]
pub fn cloud_get_cached_ugc_handles() -> Result<Vec<BigInt>, Error> {
    let count = cloud_get_cached_ugc_count()?.max(0);
    let mut handles = Vec::new();
    for index in 0..count {
        if let Some(handle) = cloud_get_cached_ugc_handle(index)? {
            handles.push(handle);
        }
    }
    Ok(handles)
}

#[napi(js_name = "cloudLegacyPublishWorkshopFile")]
pub async fn cloud_legacy_publish_workshop_file(
    file_path: String,
    preview_path: String,
    consumer_app_id: u32,
    title: String,
    description: String,
    visibility: u32,
    tags: Vec<String>,
    file_type: u32,
    timeout_seconds: Option<u32>,
) -> Result<CloudLegacyPublishedFileResult, Error> {
    let file_path = cstring(file_path, "published file path")?;
    let preview_path = cstring(preview_path, "published preview path")?;
    let title = cstring(title, "published file title")?;
    let description = cstring(description, "published file description")?;
    let call = {
        let (tag_strings, tag_pointers, mut tag_array) =
            steam_param_string_array(tags, "published file tag")?;
        let call = unsafe {
            sys::SteamAPI_ISteamRemoteStorage_PublishWorkshopFile(
                steam_remote_storage()?,
                file_path.as_ptr(),
                preview_path.as_ptr(),
                consumer_app_id,
                title.as_ptr(),
                description.as_ptr(),
                remote_storage_visibility_from_u32(visibility)?,
                &mut tag_array,
                workshop_file_type_from_u32(file_type)?,
            )
        };
        drop(tag_pointers);
        drop(tag_strings);
        call
    };
    let result: sys::RemoteStoragePublishFileResult_t = wait_for_api_call(
        call,
        sys::RemoteStoragePublishFileResult_t_k_iCallback as i32,
        timeout_seconds
            .map(u64::from)
            .unwrap_or(DEFAULT_ASYNC_TIMEOUT_SECONDS)
            .max(1),
    )
    .await?;
    drop(file_path);
    drop(preview_path);
    drop(title);
    drop(description);
    Ok(remote_storage_publish_file_result(&result))
}

#[napi(js_name = "cloudLegacyPublishVideo")]
pub async fn cloud_legacy_publish_video(
    provider: u32,
    video_account: String,
    video_identifier: String,
    preview_path: String,
    consumer_app_id: u32,
    title: String,
    description: String,
    visibility: u32,
    tags: Vec<String>,
    timeout_seconds: Option<u32>,
) -> Result<CloudLegacyPublishedFileResult, Error> {
    let video_account = cstring(video_account, "published video account")?;
    let video_identifier = cstring(video_identifier, "published video identifier")?;
    let preview_path = cstring(preview_path, "published video preview path")?;
    let title = cstring(title, "published video title")?;
    let description = cstring(description, "published video description")?;
    let call = {
        let (tag_strings, tag_pointers, mut tag_array) =
            steam_param_string_array(tags, "published video tag")?;
        let call = unsafe {
            sys::SteamAPI_ISteamRemoteStorage_PublishVideo(
                steam_remote_storage()?,
                workshop_video_provider_from_u32(provider)?,
                video_account.as_ptr(),
                video_identifier.as_ptr(),
                preview_path.as_ptr(),
                consumer_app_id,
                title.as_ptr(),
                description.as_ptr(),
                remote_storage_visibility_from_u32(visibility)?,
                &mut tag_array,
            )
        };
        drop(tag_pointers);
        drop(tag_strings);
        call
    };
    let result: sys::RemoteStoragePublishFileResult_t = wait_for_api_call(
        call,
        sys::RemoteStoragePublishFileResult_t_k_iCallback as i32,
        timeout_seconds
            .map(u64::from)
            .unwrap_or(DEFAULT_ASYNC_TIMEOUT_SECONDS)
            .max(1),
    )
    .await?;
    drop(video_account);
    drop(video_identifier);
    drop(preview_path);
    drop(title);
    drop(description);
    Ok(remote_storage_publish_file_result(&result))
}

#[napi(js_name = "cloudLegacyCreatePublishedFileUpdateRequest")]
pub fn cloud_legacy_create_published_file_update_request(
    published_file_id: BigInt,
) -> Result<Option<BigInt>, Error> {
    let handle = unsafe {
        sys::SteamAPI_ISteamRemoteStorage_CreatePublishedFileUpdateRequest(
            steam_remote_storage()?,
            bigint_to_u64(published_file_id, "published file id")?,
        )
    };
    Ok((handle != sys::k_PublishedFileUpdateHandleInvalid).then(|| handle.into()))
}

#[napi(js_name = "cloudLegacyUpdatePublishedFileFile")]
pub fn cloud_legacy_update_published_file_file(
    handle: BigInt,
    file_path: String,
) -> Result<bool, Error> {
    let file_path = cstring(file_path, "published file path")?;
    Ok(unsafe {
        sys::SteamAPI_ISteamRemoteStorage_UpdatePublishedFileFile(
            steam_remote_storage()?,
            bigint_to_u64(handle, "published file update handle")?,
            file_path.as_ptr(),
        )
    })
}

#[napi(js_name = "cloudLegacyUpdatePublishedFilePreviewFile")]
pub fn cloud_legacy_update_published_file_preview_file(
    handle: BigInt,
    preview_path: String,
) -> Result<bool, Error> {
    let preview_path = cstring(preview_path, "published preview path")?;
    Ok(unsafe {
        sys::SteamAPI_ISteamRemoteStorage_UpdatePublishedFilePreviewFile(
            steam_remote_storage()?,
            bigint_to_u64(handle, "published file update handle")?,
            preview_path.as_ptr(),
        )
    })
}

#[napi(js_name = "cloudLegacyUpdatePublishedFileTitle")]
pub fn cloud_legacy_update_published_file_title(
    handle: BigInt,
    title: String,
) -> Result<bool, Error> {
    let title = cstring(title, "published file title")?;
    Ok(unsafe {
        sys::SteamAPI_ISteamRemoteStorage_UpdatePublishedFileTitle(
            steam_remote_storage()?,
            bigint_to_u64(handle, "published file update handle")?,
            title.as_ptr(),
        )
    })
}

#[napi(js_name = "cloudLegacyUpdatePublishedFileDescription")]
pub fn cloud_legacy_update_published_file_description(
    handle: BigInt,
    description: String,
) -> Result<bool, Error> {
    let description = cstring(description, "published file description")?;
    Ok(unsafe {
        sys::SteamAPI_ISteamRemoteStorage_UpdatePublishedFileDescription(
            steam_remote_storage()?,
            bigint_to_u64(handle, "published file update handle")?,
            description.as_ptr(),
        )
    })
}

#[napi(js_name = "cloudLegacyUpdatePublishedFileVisibility")]
pub fn cloud_legacy_update_published_file_visibility(
    handle: BigInt,
    visibility: u32,
) -> Result<bool, Error> {
    Ok(unsafe {
        sys::SteamAPI_ISteamRemoteStorage_UpdatePublishedFileVisibility(
            steam_remote_storage()?,
            bigint_to_u64(handle, "published file update handle")?,
            remote_storage_visibility_from_u32(visibility)?,
        )
    })
}

#[napi(js_name = "cloudLegacyUpdatePublishedFileTags")]
pub fn cloud_legacy_update_published_file_tags(
    handle: BigInt,
    tags: Vec<String>,
) -> Result<bool, Error> {
    let (tag_strings, tag_pointers, mut tag_array) =
        steam_param_string_array(tags, "published file tag")?;
    let ok = unsafe {
        sys::SteamAPI_ISteamRemoteStorage_UpdatePublishedFileTags(
            steam_remote_storage()?,
            bigint_to_u64(handle, "published file update handle")?,
            &mut tag_array,
        )
    };
    drop(tag_pointers);
    drop(tag_strings);
    Ok(ok)
}

#[napi(js_name = "cloudLegacyUpdatePublishedFileSetChangeDescription")]
pub fn cloud_legacy_update_published_file_set_change_description(
    handle: BigInt,
    change_description: String,
) -> Result<bool, Error> {
    let change_description = cstring(change_description, "published file change description")?;
    Ok(unsafe {
        sys::SteamAPI_ISteamRemoteStorage_UpdatePublishedFileSetChangeDescription(
            steam_remote_storage()?,
            bigint_to_u64(handle, "published file update handle")?,
            change_description.as_ptr(),
        )
    })
}

#[napi(js_name = "cloudLegacyCommitPublishedFileUpdate")]
pub async fn cloud_legacy_commit_published_file_update(
    handle: BigInt,
    timeout_seconds: Option<u32>,
) -> Result<CloudLegacyPublishedFileResult, Error> {
    let call = unsafe {
        sys::SteamAPI_ISteamRemoteStorage_CommitPublishedFileUpdate(
            steam_remote_storage()?,
            bigint_to_u64(handle, "published file update handle")?,
        )
    };
    let result: sys::RemoteStorageUpdatePublishedFileResult_t = wait_for_api_call(
        call,
        sys::RemoteStorageUpdatePublishedFileResult_t_k_iCallback as i32,
        timeout_seconds
            .map(u64::from)
            .unwrap_or(DEFAULT_ASYNC_TIMEOUT_SECONDS)
            .max(1),
    )
    .await?;
    Ok(remote_storage_update_published_file_result(&result))
}

#[napi(js_name = "cloudLegacyGetPublishedFileDetails")]
pub async fn cloud_legacy_get_published_file_details(
    published_file_id: BigInt,
    max_seconds_old: Option<u32>,
    timeout_seconds: Option<u32>,
) -> Result<CloudLegacyPublishedFileDetails, Error> {
    let call = unsafe {
        sys::SteamAPI_ISteamRemoteStorage_GetPublishedFileDetails(
            steam_remote_storage()?,
            bigint_to_u64(published_file_id, "published file id")?,
            max_seconds_old.unwrap_or(0),
        )
    };
    let result: sys::RemoteStorageGetPublishedFileDetailsResult_t = wait_for_api_call(
        call,
        sys::RemoteStorageGetPublishedFileDetailsResult_t_k_iCallback as i32,
        timeout_seconds
            .map(u64::from)
            .unwrap_or(DEFAULT_ASYNC_TIMEOUT_SECONDS)
            .max(1),
    )
    .await?;
    Ok(remote_storage_published_file_details(&result))
}

#[napi(js_name = "cloudLegacyDeletePublishedFile")]
pub async fn cloud_legacy_delete_published_file(
    published_file_id: BigInt,
    timeout_seconds: Option<u32>,
) -> Result<CloudLegacyPublishedFileIdResult, Error> {
    let call = unsafe {
        sys::SteamAPI_ISteamRemoteStorage_DeletePublishedFile(
            steam_remote_storage()?,
            bigint_to_u64(published_file_id, "published file id")?,
        )
    };
    let result: sys::RemoteStorageDeletePublishedFileResult_t = wait_for_api_call(
        call,
        sys::RemoteStorageDeletePublishedFileResult_t_k_iCallback as i32,
        timeout_seconds
            .map(u64::from)
            .unwrap_or(DEFAULT_ASYNC_TIMEOUT_SECONDS)
            .max(1),
    )
    .await?;
    Ok(remote_storage_delete_published_file_result(&result))
}

#[napi(js_name = "cloudLegacyEnumerateUserPublishedFiles")]
pub async fn cloud_legacy_enumerate_user_published_files(
    start_index: Option<u32>,
    timeout_seconds: Option<u32>,
) -> Result<CloudLegacyEnumerateFilesResult, Error> {
    let call = unsafe {
        sys::SteamAPI_ISteamRemoteStorage_EnumerateUserPublishedFiles(
            steam_remote_storage()?,
            start_index.unwrap_or(0),
        )
    };
    let result: sys::RemoteStorageEnumerateUserPublishedFilesResult_t = wait_for_api_call(
        call,
        sys::RemoteStorageEnumerateUserPublishedFilesResult_t_k_iCallback as i32,
        timeout_seconds
            .map(u64::from)
            .unwrap_or(DEFAULT_ASYNC_TIMEOUT_SECONDS)
            .max(1),
    )
    .await?;
    Ok(remote_storage_enumerate_user_published_files_result(
        &result,
    ))
}

#[napi(js_name = "cloudLegacySubscribePublishedFile")]
pub async fn cloud_legacy_subscribe_published_file(
    published_file_id: BigInt,
    timeout_seconds: Option<u32>,
) -> Result<CloudLegacyPublishedFileIdResult, Error> {
    let call = unsafe {
        sys::SteamAPI_ISteamRemoteStorage_SubscribePublishedFile(
            steam_remote_storage()?,
            bigint_to_u64(published_file_id, "published file id")?,
        )
    };
    let result: sys::RemoteStorageSubscribePublishedFileResult_t = wait_for_api_call(
        call,
        sys::RemoteStorageSubscribePublishedFileResult_t_k_iCallback as i32,
        timeout_seconds
            .map(u64::from)
            .unwrap_or(DEFAULT_ASYNC_TIMEOUT_SECONDS)
            .max(1),
    )
    .await?;
    Ok(remote_storage_subscribe_published_file_result(&result))
}

#[napi(js_name = "cloudLegacyEnumerateUserSubscribedFiles")]
pub async fn cloud_legacy_enumerate_user_subscribed_files(
    start_index: Option<u32>,
    timeout_seconds: Option<u32>,
) -> Result<CloudLegacyEnumerateSubscribedFilesResult, Error> {
    let call = unsafe {
        sys::SteamAPI_ISteamRemoteStorage_EnumerateUserSubscribedFiles(
            steam_remote_storage()?,
            start_index.unwrap_or(0),
        )
    };
    let result: sys::RemoteStorageEnumerateUserSubscribedFilesResult_t = wait_for_api_call(
        call,
        sys::RemoteStorageEnumerateUserSubscribedFilesResult_t_k_iCallback as i32,
        timeout_seconds
            .map(u64::from)
            .unwrap_or(DEFAULT_ASYNC_TIMEOUT_SECONDS)
            .max(1),
    )
    .await?;
    Ok(remote_storage_enumerate_user_subscribed_files_result(
        &result,
    ))
}

#[napi(js_name = "cloudLegacyUnsubscribePublishedFile")]
pub async fn cloud_legacy_unsubscribe_published_file(
    published_file_id: BigInt,
    timeout_seconds: Option<u32>,
) -> Result<CloudLegacyPublishedFileIdResult, Error> {
    let call = unsafe {
        sys::SteamAPI_ISteamRemoteStorage_UnsubscribePublishedFile(
            steam_remote_storage()?,
            bigint_to_u64(published_file_id, "published file id")?,
        )
    };
    let result: sys::RemoteStorageUnsubscribePublishedFileResult_t = wait_for_api_call(
        call,
        sys::RemoteStorageUnsubscribePublishedFileResult_t_k_iCallback as i32,
        timeout_seconds
            .map(u64::from)
            .unwrap_or(DEFAULT_ASYNC_TIMEOUT_SECONDS)
            .max(1),
    )
    .await?;
    Ok(remote_storage_unsubscribe_published_file_result(&result))
}

#[napi(js_name = "cloudLegacyGetPublishedItemVoteDetails")]
pub async fn cloud_legacy_get_published_item_vote_details(
    published_file_id: BigInt,
    timeout_seconds: Option<u32>,
) -> Result<CloudLegacyPublishedItemVoteDetails, Error> {
    let call = unsafe {
        sys::SteamAPI_ISteamRemoteStorage_GetPublishedItemVoteDetails(
            steam_remote_storage()?,
            bigint_to_u64(published_file_id, "published file id")?,
        )
    };
    let result: sys::RemoteStorageGetPublishedItemVoteDetailsResult_t = wait_for_api_call(
        call,
        sys::RemoteStorageGetPublishedItemVoteDetailsResult_t_k_iCallback as i32,
        timeout_seconds
            .map(u64::from)
            .unwrap_or(DEFAULT_ASYNC_TIMEOUT_SECONDS)
            .max(1),
    )
    .await?;
    Ok(remote_storage_published_item_vote_details(&result))
}

#[napi(js_name = "cloudLegacyUpdateUserPublishedItemVote")]
pub async fn cloud_legacy_update_user_published_item_vote(
    published_file_id: BigInt,
    vote_up: bool,
    timeout_seconds: Option<u32>,
) -> Result<CloudLegacyPublishedFileIdResult, Error> {
    let call = unsafe {
        sys::SteamAPI_ISteamRemoteStorage_UpdateUserPublishedItemVote(
            steam_remote_storage()?,
            bigint_to_u64(published_file_id, "published file id")?,
            vote_up,
        )
    };
    let result: sys::RemoteStorageUpdateUserPublishedItemVoteResult_t = wait_for_api_call(
        call,
        sys::RemoteStorageUpdateUserPublishedItemVoteResult_t_k_iCallback as i32,
        timeout_seconds
            .map(u64::from)
            .unwrap_or(DEFAULT_ASYNC_TIMEOUT_SECONDS)
            .max(1),
    )
    .await?;
    Ok(remote_storage_update_user_published_item_vote_result(
        &result,
    ))
}

#[napi(js_name = "cloudLegacyGetUserPublishedItemVoteDetails")]
pub async fn cloud_legacy_get_user_published_item_vote_details(
    published_file_id: BigInt,
    timeout_seconds: Option<u32>,
) -> Result<CloudLegacyUserVoteDetails, Error> {
    let call = unsafe {
        sys::SteamAPI_ISteamRemoteStorage_GetUserPublishedItemVoteDetails(
            steam_remote_storage()?,
            bigint_to_u64(published_file_id, "published file id")?,
        )
    };
    let result: sys::RemoteStorageUserVoteDetails_t = wait_for_api_call(
        call,
        sys::RemoteStorageUserVoteDetails_t_k_iCallback as i32,
        timeout_seconds
            .map(u64::from)
            .unwrap_or(DEFAULT_ASYNC_TIMEOUT_SECONDS)
            .max(1),
    )
    .await?;
    Ok(remote_storage_user_vote_details(&result))
}

#[napi(js_name = "cloudLegacyEnumerateUserSharedWorkshopFiles")]
pub async fn cloud_legacy_enumerate_user_shared_workshop_files(
    steam_id64: BigInt,
    start_index: Option<u32>,
    required_tags: Vec<String>,
    excluded_tags: Vec<String>,
    timeout_seconds: Option<u32>,
) -> Result<CloudLegacyEnumerateFilesResult, Error> {
    let call = {
        let (required_tag_strings, required_tag_pointers, mut required_tag_array) =
            steam_param_string_array(required_tags, "required shared workshop tag")?;
        let (excluded_tag_strings, excluded_tag_pointers, mut excluded_tag_array) =
            steam_param_string_array(excluded_tags, "excluded shared workshop tag")?;
        let call = unsafe {
            sys::SteamAPI_ISteamRemoteStorage_EnumerateUserSharedWorkshopFiles(
                steam_remote_storage()?,
                bigint_to_u64(steam_id64, "steamId64")?,
                start_index.unwrap_or(0),
                &mut required_tag_array,
                &mut excluded_tag_array,
            )
        };
        drop(required_tag_pointers);
        drop(required_tag_strings);
        drop(excluded_tag_pointers);
        drop(excluded_tag_strings);
        call
    };
    let result: sys::RemoteStorageEnumerateUserSharedWorkshopFilesResult_t = wait_for_api_call(
        call,
        sys::RemoteStorageEnumerateUserSharedWorkshopFilesResult_t_k_iCallback as i32,
        timeout_seconds
            .map(u64::from)
            .unwrap_or(DEFAULT_ASYNC_TIMEOUT_SECONDS)
            .max(1),
    )
    .await?;
    Ok(remote_storage_enumerate_user_shared_workshop_files_result(
        &result,
    ))
}

#[napi(js_name = "cloudLegacySetUserPublishedFileAction")]
pub async fn cloud_legacy_set_user_published_file_action(
    published_file_id: BigInt,
    action: u32,
    timeout_seconds: Option<u32>,
) -> Result<CloudLegacyPublishedFileActionResult, Error> {
    let call = unsafe {
        sys::SteamAPI_ISteamRemoteStorage_SetUserPublishedFileAction(
            steam_remote_storage()?,
            bigint_to_u64(published_file_id, "published file id")?,
            workshop_file_action_from_u32(action)?,
        )
    };
    let result: sys::RemoteStorageSetUserPublishedFileActionResult_t = wait_for_api_call(
        call,
        sys::RemoteStorageSetUserPublishedFileActionResult_t_k_iCallback as i32,
        timeout_seconds
            .map(u64::from)
            .unwrap_or(DEFAULT_ASYNC_TIMEOUT_SECONDS)
            .max(1),
    )
    .await?;
    Ok(remote_storage_set_user_published_file_action_result(
        &result,
    ))
}

#[napi(js_name = "cloudLegacyEnumeratePublishedFilesByUserAction")]
pub async fn cloud_legacy_enumerate_published_files_by_user_action(
    action: u32,
    start_index: Option<u32>,
    timeout_seconds: Option<u32>,
) -> Result<CloudLegacyEnumerateUserActionFilesResult, Error> {
    let call = unsafe {
        sys::SteamAPI_ISteamRemoteStorage_EnumeratePublishedFilesByUserAction(
            steam_remote_storage()?,
            workshop_file_action_from_u32(action)?,
            start_index.unwrap_or(0),
        )
    };
    let result: sys::RemoteStorageEnumeratePublishedFilesByUserActionResult_t = wait_for_api_call(
        call,
        sys::RemoteStorageEnumeratePublishedFilesByUserActionResult_t_k_iCallback as i32,
        timeout_seconds
            .map(u64::from)
            .unwrap_or(DEFAULT_ASYNC_TIMEOUT_SECONDS)
            .max(1),
    )
    .await?;
    Ok(remote_storage_enumerate_published_files_by_user_action_result(&result))
}

#[napi(js_name = "cloudLegacyEnumeratePublishedWorkshopFiles")]
pub async fn cloud_legacy_enumerate_published_workshop_files(
    enumeration_type: u32,
    start_index: Option<u32>,
    count: Option<u32>,
    days: Option<u32>,
    tags: Vec<String>,
    user_tags: Vec<String>,
    timeout_seconds: Option<u32>,
) -> Result<CloudLegacyEnumerateWorkshopFilesResult, Error> {
    let call = {
        let (tag_strings, tag_pointers, mut tag_array) =
            steam_param_string_array(tags, "published workshop tag")?;
        let (user_tag_strings, user_tag_pointers, mut user_tag_array) =
            steam_param_string_array(user_tags, "published workshop user tag")?;
        let call = unsafe {
            sys::SteamAPI_ISteamRemoteStorage_EnumeratePublishedWorkshopFiles(
                steam_remote_storage()?,
                workshop_enumeration_type_from_u32(enumeration_type)?,
                start_index.unwrap_or(0),
                count.unwrap_or(sys::k_unEnumeratePublishedFilesMaxResults),
                days.unwrap_or(0),
                &mut tag_array,
                &mut user_tag_array,
            )
        };
        drop(tag_pointers);
        drop(tag_strings);
        drop(user_tag_pointers);
        drop(user_tag_strings);
        call
    };
    let result: sys::RemoteStorageEnumerateWorkshopFilesResult_t = wait_for_api_call(
        call,
        sys::RemoteStorageEnumerateWorkshopFilesResult_t_k_iCallback as i32,
        timeout_seconds
            .map(u64::from)
            .unwrap_or(DEFAULT_ASYNC_TIMEOUT_SECONDS)
            .max(1),
    )
    .await?;
    Ok(remote_storage_enumerate_workshop_files_result(&result))
}

type SteamHttpAccessor = fn() -> Result<*mut sys::ISteamHTTP, Error>;

fn http_create_request_with(
    accessor: SteamHttpAccessor,
    method: u32,
    url: String,
) -> Result<u32, Error> {
    let url = cstring(url, "HTTP URL")?;
    let request = unsafe {
        sys::SteamAPI_ISteamHTTP_CreateHTTPRequest(
            accessor()?,
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

fn http_set_context_value_with(
    accessor: SteamHttpAccessor,
    request: u32,
    context_value: BigInt,
) -> Result<bool, Error> {
    Ok(unsafe {
        sys::SteamAPI_ISteamHTTP_SetHTTPRequestContextValue(
            accessor()?,
            request,
            bigint_to_u64(context_value, "HTTP context value")?,
        )
    })
}

fn http_set_network_activity_timeout_with(
    accessor: SteamHttpAccessor,
    request: u32,
    timeout_seconds: u32,
) -> Result<bool, Error> {
    Ok(unsafe {
        sys::SteamAPI_ISteamHTTP_SetHTTPRequestNetworkActivityTimeout(
            accessor()?,
            request,
            timeout_seconds,
        )
    })
}

fn http_set_header_value_with(
    accessor: SteamHttpAccessor,
    request: u32,
    name: String,
    value: String,
) -> Result<bool, Error> {
    let name = cstring(name, "HTTP header name")?;
    let value = cstring(value, "HTTP header value")?;
    Ok(unsafe {
        sys::SteamAPI_ISteamHTTP_SetHTTPRequestHeaderValue(
            accessor()?,
            request,
            name.as_ptr(),
            value.as_ptr(),
        )
    })
}

fn http_set_get_or_post_parameter_with(
    accessor: SteamHttpAccessor,
    request: u32,
    name: String,
    value: String,
) -> Result<bool, Error> {
    let name = cstring(name, "HTTP parameter name")?;
    let value = cstring(value, "HTTP parameter value")?;
    Ok(unsafe {
        sys::SteamAPI_ISteamHTTP_SetHTTPRequestGetOrPostParameter(
            accessor()?,
            request,
            name.as_ptr(),
            value.as_ptr(),
        )
    })
}

async fn wait_for_http_api_call<T>(
    call: sys::SteamAPICall_t,
    expected_callback: i32,
    timeout_seconds: Option<u32>,
    use_game_server_callbacks: bool,
) -> Result<T, Error> {
    let timeout_seconds = timeout_seconds
        .map(u64::from)
        .unwrap_or(DEFAULT_ASYNC_TIMEOUT_SECONDS)
        .max(1);
    if use_game_server_callbacks {
        wait_for_game_server_api_call(call, expected_callback, timeout_seconds).await
    } else {
        wait_for_api_call(call, expected_callback, timeout_seconds).await
    }
}

async fn http_send_request_with(
    accessor: SteamHttpAccessor,
    request: u32,
    timeout_seconds: Option<u32>,
    use_game_server_callbacks: bool,
) -> Result<HttpRequestCompleted, Error> {
    let call = {
        let mut call = 0u64;
        let ok =
            unsafe { sys::SteamAPI_ISteamHTTP_SendHTTPRequest(accessor()?, request, &mut call) };
        if !ok {
            return Err(Error::from_reason("Steam rejected the HTTP request send"));
        }
        call
    };
    let result: sys::HTTPRequestCompleted_t = wait_for_http_api_call(
        call,
        sys::HTTPRequestCompleted_t_k_iCallback as i32,
        timeout_seconds,
        use_game_server_callbacks,
    )
    .await?;
    Ok(http_request_completed_result(&result))
}

async fn http_send_request_and_stream_response_with(
    accessor: SteamHttpAccessor,
    request: u32,
    timeout_seconds: Option<u32>,
    use_game_server_callbacks: bool,
) -> Result<HttpRequestHeadersReceived, Error> {
    let call = {
        let mut call = 0u64;
        let ok = unsafe {
            sys::SteamAPI_ISteamHTTP_SendHTTPRequestAndStreamResponse(
                accessor()?,
                request,
                &mut call,
            )
        };
        if !ok {
            return Err(Error::from_reason(
                "Steam rejected the streaming HTTP request send",
            ));
        }
        call
    };
    let result: sys::HTTPRequestHeadersReceived_t = wait_for_http_api_call(
        call,
        sys::HTTPRequestHeadersReceived_t_k_iCallback as i32,
        timeout_seconds,
        use_game_server_callbacks,
    )
    .await?;
    Ok(http_request_headers_received_result(&result))
}

fn http_defer_request_with(accessor: SteamHttpAccessor, request: u32) -> Result<bool, Error> {
    Ok(unsafe { sys::SteamAPI_ISteamHTTP_DeferHTTPRequest(accessor()?, request) })
}

fn http_prioritize_request_with(accessor: SteamHttpAccessor, request: u32) -> Result<bool, Error> {
    Ok(unsafe { sys::SteamAPI_ISteamHTTP_PrioritizeHTTPRequest(accessor()?, request) })
}

fn http_get_response_header_size_with(
    accessor: SteamHttpAccessor,
    request: u32,
    name: String,
) -> Result<Option<u32>, Error> {
    let name = cstring(name, "HTTP header name")?;
    let mut size = 0u32;
    let ok = unsafe {
        sys::SteamAPI_ISteamHTTP_GetHTTPResponseHeaderSize(
            accessor()?,
            request,
            name.as_ptr(),
            &mut size,
        )
    };
    Ok(ok.then_some(size))
}

fn http_get_response_header_value_with(
    accessor: SteamHttpAccessor,
    request: u32,
    name: String,
) -> Result<Option<String>, Error> {
    let Some(size) = http_get_response_header_size_with(accessor, request, name.clone())? else {
        return Ok(None);
    };
    let name = cstring(name, "HTTP header name")?;
    let mut bytes = vec![0u8; size as usize];
    let ok = unsafe {
        sys::SteamAPI_ISteamHTTP_GetHTTPResponseHeaderValue(
            accessor()?,
            request,
            name.as_ptr(),
            bytes.as_mut_ptr(),
            size,
        )
    };
    Ok(ok.then(|| u8_buf_to_string(&bytes)))
}

fn http_get_response_body_size_with(
    accessor: SteamHttpAccessor,
    request: u32,
) -> Result<Option<u32>, Error> {
    let mut size = 0u32;
    let ok = unsafe {
        sys::SteamAPI_ISteamHTTP_GetHTTPResponseBodySize(accessor()?, request, &mut size)
    };
    Ok(ok.then_some(size))
}

fn http_get_response_body_data_with(
    accessor: SteamHttpAccessor,
    request: u32,
) -> Result<Option<Buffer>, Error> {
    let Some(size) = http_get_response_body_size_with(accessor, request)? else {
        return Ok(None);
    };
    let mut bytes = vec![0u8; size as usize];
    let ok = unsafe {
        sys::SteamAPI_ISteamHTTP_GetHTTPResponseBodyData(
            accessor()?,
            request,
            bytes.as_mut_ptr(),
            size,
        )
    };
    Ok(ok.then(|| bytes.into()))
}

fn http_get_streaming_response_body_data_with(
    accessor: SteamHttpAccessor,
    request: u32,
    offset: u32,
    size: u32,
) -> Result<Option<Buffer>, Error> {
    let mut bytes = vec![0u8; size as usize];
    let ok = unsafe {
        sys::SteamAPI_ISteamHTTP_GetHTTPStreamingResponseBodyData(
            accessor()?,
            request,
            offset,
            bytes.as_mut_ptr(),
            size,
        )
    };
    Ok(ok.then(|| bytes.into()))
}

fn http_release_request_with(accessor: SteamHttpAccessor, request: u32) -> Result<bool, Error> {
    Ok(unsafe { sys::SteamAPI_ISteamHTTP_ReleaseHTTPRequest(accessor()?, request) })
}

fn http_get_download_progress_percent_with(
    accessor: SteamHttpAccessor,
    request: u32,
) -> Result<Option<f64>, Error> {
    let mut percent = 0.0f32;
    let ok = unsafe {
        sys::SteamAPI_ISteamHTTP_GetHTTPDownloadProgressPct(accessor()?, request, &mut percent)
    };
    Ok(ok.then_some(f64::from(percent)))
}

fn http_set_raw_post_body_with(
    accessor: SteamHttpAccessor,
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
            accessor()?,
            request,
            content_type.as_ptr(),
            body.as_ptr() as *mut u8,
            body.len() as u32,
        )
    })
}

fn http_create_cookie_container_with(
    accessor: SteamHttpAccessor,
    allow_responses_to_modify: bool,
) -> Result<u32, Error> {
    let container = unsafe {
        sys::SteamAPI_ISteamHTTP_CreateCookieContainer(accessor()?, allow_responses_to_modify)
    };
    if container == sys::INVALID_HTTPCOOKIE_HANDLE {
        Err(Error::from_reason(
            "Steam returned an invalid HTTP cookie container handle",
        ))
    } else {
        Ok(container)
    }
}

fn http_release_cookie_container_with(
    accessor: SteamHttpAccessor,
    container: u32,
) -> Result<bool, Error> {
    Ok(unsafe { sys::SteamAPI_ISteamHTTP_ReleaseCookieContainer(accessor()?, container) })
}

fn http_set_cookie_with(
    accessor: SteamHttpAccessor,
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
            accessor()?,
            container,
            host.as_ptr(),
            url.as_ptr(),
            cookie.as_ptr(),
        )
    })
}

fn http_set_request_cookie_container_with(
    accessor: SteamHttpAccessor,
    request: u32,
    container: u32,
) -> Result<bool, Error> {
    Ok(unsafe {
        sys::SteamAPI_ISteamHTTP_SetHTTPRequestCookieContainer(accessor()?, request, container)
    })
}

fn http_set_user_agent_info_with(
    accessor: SteamHttpAccessor,
    request: u32,
    user_agent: String,
) -> Result<bool, Error> {
    let user_agent = cstring(user_agent, "HTTP user agent")?;
    Ok(unsafe {
        sys::SteamAPI_ISteamHTTP_SetHTTPRequestUserAgentInfo(
            accessor()?,
            request,
            user_agent.as_ptr(),
        )
    })
}

fn http_set_requires_verified_certificate_with(
    accessor: SteamHttpAccessor,
    request: u32,
    require_verified_certificate: bool,
) -> Result<bool, Error> {
    Ok(unsafe {
        sys::SteamAPI_ISteamHTTP_SetHTTPRequestRequiresVerifiedCertificate(
            accessor()?,
            request,
            require_verified_certificate,
        )
    })
}

fn http_set_absolute_timeout_ms_with(
    accessor: SteamHttpAccessor,
    request: u32,
    timeout_ms: u32,
) -> Result<bool, Error> {
    Ok(unsafe {
        sys::SteamAPI_ISteamHTTP_SetHTTPRequestAbsoluteTimeoutMS(accessor()?, request, timeout_ms)
    })
}

fn http_get_request_was_timed_out_with(
    accessor: SteamHttpAccessor,
    request: u32,
) -> Result<Option<bool>, Error> {
    let mut timed_out = false;
    let ok = unsafe {
        sys::SteamAPI_ISteamHTTP_GetHTTPRequestWasTimedOut(accessor()?, request, &mut timed_out)
    };
    Ok(ok.then_some(timed_out))
}

#[napi(js_name = "httpCreateRequest")]
pub fn http_create_request(method: u32, url: String) -> Result<u32, Error> {
    http_create_request_with(steam_http, method, url)
}

#[napi(js_name = "httpSetContextValue")]
pub fn http_set_context_value(request: u32, context_value: BigInt) -> Result<bool, Error> {
    http_set_context_value_with(steam_http, request, context_value)
}

#[napi(js_name = "httpSetNetworkActivityTimeout")]
pub fn http_set_network_activity_timeout(
    request: u32,
    timeout_seconds: u32,
) -> Result<bool, Error> {
    http_set_network_activity_timeout_with(steam_http, request, timeout_seconds)
}

#[napi(js_name = "httpSetHeaderValue")]
pub fn http_set_header_value(request: u32, name: String, value: String) -> Result<bool, Error> {
    http_set_header_value_with(steam_http, request, name, value)
}

#[napi(js_name = "httpSetGetOrPostParameter")]
pub fn http_set_get_or_post_parameter(
    request: u32,
    name: String,
    value: String,
) -> Result<bool, Error> {
    http_set_get_or_post_parameter_with(steam_http, request, name, value)
}

#[napi(js_name = "httpSendRequest")]
pub async fn http_send_request(
    request: u32,
    timeout_seconds: Option<u32>,
) -> Result<HttpRequestCompleted, Error> {
    http_send_request_with(steam_http, request, timeout_seconds, false).await
}

#[napi(js_name = "httpSendRequestAndStreamResponse")]
pub async fn http_send_request_and_stream_response(
    request: u32,
    timeout_seconds: Option<u32>,
) -> Result<HttpRequestHeadersReceived, Error> {
    http_send_request_and_stream_response_with(steam_http, request, timeout_seconds, false).await
}

#[napi(js_name = "httpDeferRequest")]
pub fn http_defer_request(request: u32) -> Result<bool, Error> {
    http_defer_request_with(steam_http, request)
}

#[napi(js_name = "httpPrioritizeRequest")]
pub fn http_prioritize_request(request: u32) -> Result<bool, Error> {
    http_prioritize_request_with(steam_http, request)
}

#[napi(js_name = "httpGetResponseHeaderSize")]
pub fn http_get_response_header_size(request: u32, name: String) -> Result<Option<u32>, Error> {
    http_get_response_header_size_with(steam_http, request, name)
}

#[napi(js_name = "httpGetResponseHeaderValue")]
pub fn http_get_response_header_value(request: u32, name: String) -> Result<Option<String>, Error> {
    http_get_response_header_value_with(steam_http, request, name)
}

#[napi(js_name = "httpGetResponseBodySize")]
pub fn http_get_response_body_size(request: u32) -> Result<Option<u32>, Error> {
    http_get_response_body_size_with(steam_http, request)
}

#[napi(js_name = "httpGetResponseBodyData")]
pub fn http_get_response_body_data(request: u32) -> Result<Option<Buffer>, Error> {
    http_get_response_body_data_with(steam_http, request)
}

#[napi(js_name = "httpGetStreamingResponseBodyData")]
pub fn http_get_streaming_response_body_data(
    request: u32,
    offset: u32,
    size: u32,
) -> Result<Option<Buffer>, Error> {
    http_get_streaming_response_body_data_with(steam_http, request, offset, size)
}

#[napi(js_name = "httpReleaseRequest")]
pub fn http_release_request(request: u32) -> Result<bool, Error> {
    http_release_request_with(steam_http, request)
}

#[napi(js_name = "httpGetDownloadProgressPercent")]
pub fn http_get_download_progress_percent(request: u32) -> Result<Option<f64>, Error> {
    http_get_download_progress_percent_with(steam_http, request)
}

#[napi(js_name = "httpSetRawPostBody")]
pub fn http_set_raw_post_body(
    request: u32,
    content_type: String,
    body: Buffer,
) -> Result<bool, Error> {
    http_set_raw_post_body_with(steam_http, request, content_type, body)
}

#[napi(js_name = "httpCreateCookieContainer")]
pub fn http_create_cookie_container(allow_responses_to_modify: bool) -> Result<u32, Error> {
    http_create_cookie_container_with(steam_http, allow_responses_to_modify)
}

#[napi(js_name = "httpReleaseCookieContainer")]
pub fn http_release_cookie_container(container: u32) -> Result<bool, Error> {
    http_release_cookie_container_with(steam_http, container)
}

#[napi(js_name = "httpSetCookie")]
pub fn http_set_cookie(
    container: u32,
    host: String,
    url: String,
    cookie: String,
) -> Result<bool, Error> {
    http_set_cookie_with(steam_http, container, host, url, cookie)
}

#[napi(js_name = "httpSetRequestCookieContainer")]
pub fn http_set_request_cookie_container(request: u32, container: u32) -> Result<bool, Error> {
    http_set_request_cookie_container_with(steam_http, request, container)
}

#[napi(js_name = "httpSetUserAgentInfo")]
pub fn http_set_user_agent_info(request: u32, user_agent: String) -> Result<bool, Error> {
    http_set_user_agent_info_with(steam_http, request, user_agent)
}

#[napi(js_name = "httpSetRequiresVerifiedCertificate")]
pub fn http_set_requires_verified_certificate(
    request: u32,
    require_verified_certificate: bool,
) -> Result<bool, Error> {
    http_set_requires_verified_certificate_with(steam_http, request, require_verified_certificate)
}

#[napi(js_name = "httpSetAbsoluteTimeoutMs")]
pub fn http_set_absolute_timeout_ms(request: u32, timeout_ms: u32) -> Result<bool, Error> {
    http_set_absolute_timeout_ms_with(steam_http, request, timeout_ms)
}

#[napi(js_name = "httpGetRequestWasTimedOut")]
pub fn http_get_request_was_timed_out(request: u32) -> Result<Option<bool>, Error> {
    http_get_request_was_timed_out_with(steam_http, request)
}

#[napi(js_name = "gameServerHttpCreateRequest")]
pub fn game_server_http_create_request(method: u32, url: String) -> Result<u32, Error> {
    http_create_request_with(steam_game_server_http, method, url)
}

#[napi(js_name = "gameServerHttpSetContextValue")]
pub fn game_server_http_set_context_value(
    request: u32,
    context_value: BigInt,
) -> Result<bool, Error> {
    http_set_context_value_with(steam_game_server_http, request, context_value)
}

#[napi(js_name = "gameServerHttpSetNetworkActivityTimeout")]
pub fn game_server_http_set_network_activity_timeout(
    request: u32,
    timeout_seconds: u32,
) -> Result<bool, Error> {
    http_set_network_activity_timeout_with(steam_game_server_http, request, timeout_seconds)
}

#[napi(js_name = "gameServerHttpSetHeaderValue")]
pub fn game_server_http_set_header_value(
    request: u32,
    name: String,
    value: String,
) -> Result<bool, Error> {
    http_set_header_value_with(steam_game_server_http, request, name, value)
}

#[napi(js_name = "gameServerHttpSetGetOrPostParameter")]
pub fn game_server_http_set_get_or_post_parameter(
    request: u32,
    name: String,
    value: String,
) -> Result<bool, Error> {
    http_set_get_or_post_parameter_with(steam_game_server_http, request, name, value)
}

#[napi(js_name = "gameServerHttpSendRequest")]
pub async fn game_server_http_send_request(
    request: u32,
    timeout_seconds: Option<u32>,
) -> Result<HttpRequestCompleted, Error> {
    http_send_request_with(steam_game_server_http, request, timeout_seconds, true).await
}

#[napi(js_name = "gameServerHttpSendRequestAndStreamResponse")]
pub async fn game_server_http_send_request_and_stream_response(
    request: u32,
    timeout_seconds: Option<u32>,
) -> Result<HttpRequestHeadersReceived, Error> {
    http_send_request_and_stream_response_with(
        steam_game_server_http,
        request,
        timeout_seconds,
        true,
    )
    .await
}

#[napi(js_name = "gameServerHttpDeferRequest")]
pub fn game_server_http_defer_request(request: u32) -> Result<bool, Error> {
    http_defer_request_with(steam_game_server_http, request)
}

#[napi(js_name = "gameServerHttpPrioritizeRequest")]
pub fn game_server_http_prioritize_request(request: u32) -> Result<bool, Error> {
    http_prioritize_request_with(steam_game_server_http, request)
}

#[napi(js_name = "gameServerHttpGetResponseHeaderSize")]
pub fn game_server_http_get_response_header_size(
    request: u32,
    name: String,
) -> Result<Option<u32>, Error> {
    http_get_response_header_size_with(steam_game_server_http, request, name)
}

#[napi(js_name = "gameServerHttpGetResponseHeaderValue")]
pub fn game_server_http_get_response_header_value(
    request: u32,
    name: String,
) -> Result<Option<String>, Error> {
    http_get_response_header_value_with(steam_game_server_http, request, name)
}

#[napi(js_name = "gameServerHttpGetResponseBodySize")]
pub fn game_server_http_get_response_body_size(request: u32) -> Result<Option<u32>, Error> {
    http_get_response_body_size_with(steam_game_server_http, request)
}

#[napi(js_name = "gameServerHttpGetResponseBodyData")]
pub fn game_server_http_get_response_body_data(request: u32) -> Result<Option<Buffer>, Error> {
    http_get_response_body_data_with(steam_game_server_http, request)
}

#[napi(js_name = "gameServerHttpGetStreamingResponseBodyData")]
pub fn game_server_http_get_streaming_response_body_data(
    request: u32,
    offset: u32,
    size: u32,
) -> Result<Option<Buffer>, Error> {
    http_get_streaming_response_body_data_with(steam_game_server_http, request, offset, size)
}

#[napi(js_name = "gameServerHttpReleaseRequest")]
pub fn game_server_http_release_request(request: u32) -> Result<bool, Error> {
    http_release_request_with(steam_game_server_http, request)
}

#[napi(js_name = "gameServerHttpGetDownloadProgressPercent")]
pub fn game_server_http_get_download_progress_percent(request: u32) -> Result<Option<f64>, Error> {
    http_get_download_progress_percent_with(steam_game_server_http, request)
}

#[napi(js_name = "gameServerHttpSetRawPostBody")]
pub fn game_server_http_set_raw_post_body(
    request: u32,
    content_type: String,
    body: Buffer,
) -> Result<bool, Error> {
    http_set_raw_post_body_with(steam_game_server_http, request, content_type, body)
}

#[napi(js_name = "gameServerHttpCreateCookieContainer")]
pub fn game_server_http_create_cookie_container(
    allow_responses_to_modify: bool,
) -> Result<u32, Error> {
    http_create_cookie_container_with(steam_game_server_http, allow_responses_to_modify)
}

#[napi(js_name = "gameServerHttpReleaseCookieContainer")]
pub fn game_server_http_release_cookie_container(container: u32) -> Result<bool, Error> {
    http_release_cookie_container_with(steam_game_server_http, container)
}

#[napi(js_name = "gameServerHttpSetCookie")]
pub fn game_server_http_set_cookie(
    container: u32,
    host: String,
    url: String,
    cookie: String,
) -> Result<bool, Error> {
    http_set_cookie_with(steam_game_server_http, container, host, url, cookie)
}

#[napi(js_name = "gameServerHttpSetRequestCookieContainer")]
pub fn game_server_http_set_request_cookie_container(
    request: u32,
    container: u32,
) -> Result<bool, Error> {
    http_set_request_cookie_container_with(steam_game_server_http, request, container)
}

#[napi(js_name = "gameServerHttpSetUserAgentInfo")]
pub fn game_server_http_set_user_agent_info(
    request: u32,
    user_agent: String,
) -> Result<bool, Error> {
    http_set_user_agent_info_with(steam_game_server_http, request, user_agent)
}

#[napi(js_name = "gameServerHttpSetRequiresVerifiedCertificate")]
pub fn game_server_http_set_requires_verified_certificate(
    request: u32,
    require_verified_certificate: bool,
) -> Result<bool, Error> {
    http_set_requires_verified_certificate_with(
        steam_game_server_http,
        request,
        require_verified_certificate,
    )
}

#[napi(js_name = "gameServerHttpSetAbsoluteTimeoutMs")]
pub fn game_server_http_set_absolute_timeout_ms(
    request: u32,
    timeout_ms: u32,
) -> Result<bool, Error> {
    http_set_absolute_timeout_ms_with(steam_game_server_http, request, timeout_ms)
}

#[napi(js_name = "gameServerHttpGetRequestWasTimedOut")]
pub fn game_server_http_get_request_was_timed_out(request: u32) -> Result<Option<bool>, Error> {
    http_get_request_was_timed_out_with(steam_game_server_http, request)
}

#[napi(js_name = "htmlInit")]
pub fn html_init() -> Result<bool, Error> {
    Ok(unsafe { sys::SteamAPI_ISteamHTMLSurface_Init(steam_html_surface()?) })
}

#[napi(js_name = "htmlShutdown")]
pub fn html_shutdown() -> Result<bool, Error> {
    Ok(unsafe { sys::SteamAPI_ISteamHTMLSurface_Shutdown(steam_html_surface()?) })
}

#[napi(js_name = "htmlCreateBrowser")]
pub async fn html_create_browser(
    user_agent: Option<String>,
    user_css: Option<String>,
    timeout_seconds: Option<u32>,
) -> Result<u32, Error> {
    let user_agent = cstring(user_agent.unwrap_or_default(), "HTML user agent")?;
    let user_css = cstring(user_css.unwrap_or_default(), "HTML user CSS")?;
    let call = unsafe {
        sys::SteamAPI_ISteamHTMLSurface_CreateBrowser(
            steam_html_surface()?,
            user_agent.as_ptr(),
            user_css.as_ptr(),
        )
    };
    let result: sys::HTML_BrowserReady_t = wait_for_api_call(
        call,
        sys::HTML_BrowserReady_t_k_iCallback as i32,
        timeout_seconds
            .map(u64::from)
            .unwrap_or(DEFAULT_ASYNC_TIMEOUT_SECONDS)
            .max(1),
    )
    .await?;
    Ok(unsafe { ptr::addr_of!(result.unBrowserHandle).read_unaligned() })
}

#[napi(js_name = "htmlRemoveBrowser")]
pub fn html_remove_browser(browser: u32) -> Result<(), Error> {
    unsafe { sys::SteamAPI_ISteamHTMLSurface_RemoveBrowser(steam_html_surface()?, browser) };
    Ok(())
}

#[napi(js_name = "htmlLoadUrl")]
pub fn html_load_url(browser: u32, url: String, post_data: Option<String>) -> Result<(), Error> {
    let url = cstring(url, "HTML URL")?;
    let post_data = cstring(post_data.unwrap_or_default(), "HTML POST data")?;
    unsafe {
        sys::SteamAPI_ISteamHTMLSurface_LoadURL(
            steam_html_surface()?,
            browser,
            url.as_ptr(),
            post_data.as_ptr(),
        )
    };
    Ok(())
}

#[napi(js_name = "htmlSetSize")]
pub fn html_set_size(browser: u32, width: u32, height: u32) -> Result<(), Error> {
    unsafe {
        sys::SteamAPI_ISteamHTMLSurface_SetSize(steam_html_surface()?, browser, width, height)
    };
    Ok(())
}

#[napi(js_name = "htmlStopLoad")]
pub fn html_stop_load(browser: u32) -> Result<(), Error> {
    unsafe { sys::SteamAPI_ISteamHTMLSurface_StopLoad(steam_html_surface()?, browser) };
    Ok(())
}

#[napi(js_name = "htmlReload")]
pub fn html_reload(browser: u32) -> Result<(), Error> {
    unsafe { sys::SteamAPI_ISteamHTMLSurface_Reload(steam_html_surface()?, browser) };
    Ok(())
}

#[napi(js_name = "htmlGoBack")]
pub fn html_go_back(browser: u32) -> Result<(), Error> {
    unsafe { sys::SteamAPI_ISteamHTMLSurface_GoBack(steam_html_surface()?, browser) };
    Ok(())
}

#[napi(js_name = "htmlGoForward")]
pub fn html_go_forward(browser: u32) -> Result<(), Error> {
    unsafe { sys::SteamAPI_ISteamHTMLSurface_GoForward(steam_html_surface()?, browser) };
    Ok(())
}

#[napi(js_name = "htmlAddHeader")]
pub fn html_add_header(browser: u32, key: String, value: String) -> Result<(), Error> {
    let key = cstring(key, "HTML header key")?;
    let value = cstring(value, "HTML header value")?;
    unsafe {
        sys::SteamAPI_ISteamHTMLSurface_AddHeader(
            steam_html_surface()?,
            browser,
            key.as_ptr(),
            value.as_ptr(),
        )
    };
    Ok(())
}

#[napi(js_name = "htmlExecuteJavascript")]
pub fn html_execute_javascript(browser: u32, script: String) -> Result<(), Error> {
    let script = cstring(script, "HTML JavaScript")?;
    unsafe {
        sys::SteamAPI_ISteamHTMLSurface_ExecuteJavascript(
            steam_html_surface()?,
            browser,
            script.as_ptr(),
        )
    };
    Ok(())
}

#[napi(js_name = "htmlMouseUp")]
pub fn html_mouse_up(browser: u32, mouse_button: u32) -> Result<(), Error> {
    unsafe {
        sys::SteamAPI_ISteamHTMLSurface_MouseUp(
            steam_html_surface()?,
            browser,
            html_mouse_button_from_u32(mouse_button)?,
        )
    };
    Ok(())
}

#[napi(js_name = "htmlMouseDown")]
pub fn html_mouse_down(browser: u32, mouse_button: u32) -> Result<(), Error> {
    unsafe {
        sys::SteamAPI_ISteamHTMLSurface_MouseDown(
            steam_html_surface()?,
            browser,
            html_mouse_button_from_u32(mouse_button)?,
        )
    };
    Ok(())
}

#[napi(js_name = "htmlMouseDoubleClick")]
pub fn html_mouse_double_click(browser: u32, mouse_button: u32) -> Result<(), Error> {
    unsafe {
        sys::SteamAPI_ISteamHTMLSurface_MouseDoubleClick(
            steam_html_surface()?,
            browser,
            html_mouse_button_from_u32(mouse_button)?,
        )
    };
    Ok(())
}

#[napi(js_name = "htmlMouseMove")]
pub fn html_mouse_move(browser: u32, x: i32, y: i32) -> Result<(), Error> {
    unsafe { sys::SteamAPI_ISteamHTMLSurface_MouseMove(steam_html_surface()?, browser, x, y) };
    Ok(())
}

#[napi(js_name = "htmlMouseWheel")]
pub fn html_mouse_wheel(browser: u32, delta: i32) -> Result<(), Error> {
    unsafe { sys::SteamAPI_ISteamHTMLSurface_MouseWheel(steam_html_surface()?, browser, delta) };
    Ok(())
}

#[napi(js_name = "htmlKeyDown")]
pub fn html_key_down(
    browser: u32,
    native_key_code: u32,
    key_modifiers: u32,
    is_system_key: bool,
) -> Result<(), Error> {
    unsafe {
        steam_api_isteam_html_surface_key_down_raw(
            steam_html_surface()?,
            browser,
            native_key_code,
            html_key_modifiers_from_u32(key_modifiers)?,
            is_system_key,
        )
    };
    Ok(())
}

#[napi(js_name = "htmlKeyUp")]
pub fn html_key_up(browser: u32, native_key_code: u32, key_modifiers: u32) -> Result<(), Error> {
    unsafe {
        steam_api_isteam_html_surface_key_up_raw(
            steam_html_surface()?,
            browser,
            native_key_code,
            html_key_modifiers_from_u32(key_modifiers)?,
        )
    };
    Ok(())
}

#[napi(js_name = "htmlKeyChar")]
pub fn html_key_char(browser: u32, unicode_char: u32, key_modifiers: u32) -> Result<(), Error> {
    unsafe {
        steam_api_isteam_html_surface_key_char_raw(
            steam_html_surface()?,
            browser,
            unicode_char,
            html_key_modifiers_from_u32(key_modifiers)?,
        )
    };
    Ok(())
}

#[napi(js_name = "htmlSetHorizontalScroll")]
pub fn html_set_horizontal_scroll(browser: u32, absolute_pixel_scroll: u32) -> Result<(), Error> {
    unsafe {
        sys::SteamAPI_ISteamHTMLSurface_SetHorizontalScroll(
            steam_html_surface()?,
            browser,
            absolute_pixel_scroll,
        )
    };
    Ok(())
}

#[napi(js_name = "htmlSetVerticalScroll")]
pub fn html_set_vertical_scroll(browser: u32, absolute_pixel_scroll: u32) -> Result<(), Error> {
    unsafe {
        sys::SteamAPI_ISteamHTMLSurface_SetVerticalScroll(
            steam_html_surface()?,
            browser,
            absolute_pixel_scroll,
        )
    };
    Ok(())
}

#[napi(js_name = "htmlSetKeyFocus")]
pub fn html_set_key_focus(browser: u32, has_key_focus: bool) -> Result<(), Error> {
    unsafe {
        sys::SteamAPI_ISteamHTMLSurface_SetKeyFocus(steam_html_surface()?, browser, has_key_focus)
    };
    Ok(())
}

#[napi(js_name = "htmlViewSource")]
pub fn html_view_source(browser: u32) -> Result<(), Error> {
    unsafe { sys::SteamAPI_ISteamHTMLSurface_ViewSource(steam_html_surface()?, browser) };
    Ok(())
}

#[napi(js_name = "htmlCopyToClipboard")]
pub fn html_copy_to_clipboard(browser: u32) -> Result<(), Error> {
    unsafe { sys::SteamAPI_ISteamHTMLSurface_CopyToClipboard(steam_html_surface()?, browser) };
    Ok(())
}

#[napi(js_name = "htmlPasteFromClipboard")]
pub fn html_paste_from_clipboard(browser: u32) -> Result<(), Error> {
    unsafe { sys::SteamAPI_ISteamHTMLSurface_PasteFromClipboard(steam_html_surface()?, browser) };
    Ok(())
}

#[napi(js_name = "htmlFind")]
pub fn html_find(
    browser: u32,
    search: String,
    currently_in_find: bool,
    reverse: bool,
) -> Result<(), Error> {
    let search = cstring(search, "HTML search string")?;
    unsafe {
        sys::SteamAPI_ISteamHTMLSurface_Find(
            steam_html_surface()?,
            browser,
            search.as_ptr(),
            currently_in_find,
            reverse,
        )
    };
    Ok(())
}

#[napi(js_name = "htmlStopFind")]
pub fn html_stop_find(browser: u32) -> Result<(), Error> {
    unsafe { sys::SteamAPI_ISteamHTMLSurface_StopFind(steam_html_surface()?, browser) };
    Ok(())
}

#[napi(js_name = "htmlGetLinkAtPosition")]
pub fn html_get_link_at_position(browser: u32, x: i32, y: i32) -> Result<(), Error> {
    unsafe {
        sys::SteamAPI_ISteamHTMLSurface_GetLinkAtPosition(steam_html_surface()?, browser, x, y)
    };
    Ok(())
}

#[napi(js_name = "htmlSetCookie")]
pub fn html_set_cookie(
    hostname: String,
    key: String,
    value: String,
    path: Option<String>,
    expires: Option<u32>,
    secure: Option<bool>,
    http_only: Option<bool>,
) -> Result<(), Error> {
    let hostname = cstring(hostname, "HTML cookie hostname")?;
    let key = cstring(key, "HTML cookie key")?;
    let value = cstring(value, "HTML cookie value")?;
    let path = cstring(path.unwrap_or_else(|| "/".to_owned()), "HTML cookie path")?;
    unsafe {
        sys::SteamAPI_ISteamHTMLSurface_SetCookie(
            steam_html_surface()?,
            hostname.as_ptr(),
            key.as_ptr(),
            value.as_ptr(),
            path.as_ptr(),
            expires.unwrap_or(0),
            secure.unwrap_or(false),
            http_only.unwrap_or(false),
        )
    };
    Ok(())
}

#[napi(js_name = "htmlSetPageScaleFactor")]
pub fn html_set_page_scale_factor(
    browser: u32,
    zoom: f64,
    point_x: i32,
    point_y: i32,
) -> Result<(), Error> {
    if !zoom.is_finite() {
        return Err(Error::from_reason("HTML zoom must be finite"));
    }
    unsafe {
        sys::SteamAPI_ISteamHTMLSurface_SetPageScaleFactor(
            steam_html_surface()?,
            browser,
            zoom as f32,
            point_x,
            point_y,
        )
    };
    Ok(())
}

#[napi(js_name = "htmlSetBackgroundMode")]
pub fn html_set_background_mode(browser: u32, background_mode: bool) -> Result<(), Error> {
    unsafe {
        sys::SteamAPI_ISteamHTMLSurface_SetBackgroundMode(
            steam_html_surface()?,
            browser,
            background_mode,
        )
    };
    Ok(())
}

#[napi(js_name = "htmlSetDpiScalingFactor")]
pub fn html_set_dpi_scaling_factor(browser: u32, dpi_scaling: f64) -> Result<(), Error> {
    if !dpi_scaling.is_finite() {
        return Err(Error::from_reason("HTML DPI scaling must be finite"));
    }
    unsafe {
        sys::SteamAPI_ISteamHTMLSurface_SetDPIScalingFactor(
            steam_html_surface()?,
            browser,
            dpi_scaling as f32,
        )
    };
    Ok(())
}

#[napi(js_name = "htmlOpenDeveloperTools")]
pub fn html_open_developer_tools(browser: u32) -> Result<(), Error> {
    unsafe { sys::SteamAPI_ISteamHTMLSurface_OpenDeveloperTools(steam_html_surface()?, browser) };
    Ok(())
}

#[napi(js_name = "htmlAllowStartRequest")]
pub fn html_allow_start_request(browser: u32, allowed: bool) -> Result<(), Error> {
    unsafe {
        sys::SteamAPI_ISteamHTMLSurface_AllowStartRequest(steam_html_surface()?, browser, allowed)
    };
    Ok(())
}

#[napi(js_name = "htmlJsDialogResponse")]
pub fn html_js_dialog_response(browser: u32, result: bool) -> Result<(), Error> {
    unsafe {
        sys::SteamAPI_ISteamHTMLSurface_JSDialogResponse(steam_html_surface()?, browser, result)
    };
    Ok(())
}

#[napi(js_name = "htmlFileLoadDialogResponse")]
pub fn html_file_load_dialog_response(
    browser: u32,
    selected_files: Vec<String>,
) -> Result<(), Error> {
    let selected_files = selected_files
        .into_iter()
        .map(|file| cstring(file, "HTML selected file"))
        .collect::<Result<Vec<_>, _>>()?;
    let mut pointers: Vec<*const c_char> =
        selected_files.iter().map(|file| file.as_ptr()).collect();
    pointers.push(ptr::null());
    unsafe {
        sys::SteamAPI_ISteamHTMLSurface_FileLoadDialogResponse(
            steam_html_surface()?,
            browser,
            pointers.as_mut_ptr(),
        )
    };
    Ok(())
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
    let result: sys::SteamInventoryEligiblePromoItemDefIDs_t = wait_for_game_server_api_call(
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
    let result: sys::SteamInventoryStartPurchaseResult_t = wait_for_game_server_api_call(
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
    let result: sys::SteamInventoryRequestPricesResult_t = wait_for_game_server_api_call(
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

macro_rules! game_server_inventory_wrapper {
    ($js_name:literal, $fn_name:ident, $client_fn:ident($($arg:ident: $arg_ty:ty),*) -> $return_ty:ty) => {
        #[napi(js_name = $js_name)]
        pub fn $fn_name($($arg: $arg_ty),*) -> Result<$return_ty, Error> {
            with_game_server_inventory(|| $client_fn($($arg),*))
        }
    };
}

game_server_inventory_wrapper!(
    "gameServerInventoryGetResultStatus",
    game_server_inventory_get_result_status,
    inventory_get_result_status(result_handle: i32) -> u32
);
game_server_inventory_wrapper!(
    "gameServerInventoryGetResultItems",
    game_server_inventory_get_result_items,
    inventory_get_result_items(result_handle: i32) -> Option<Vec<InventoryItemDetail>>
);
game_server_inventory_wrapper!(
    "gameServerInventoryGetResultItemProperty",
    game_server_inventory_get_result_item_property,
    inventory_get_result_item_property(
        result_handle: i32,
        item_index: u32,
        property_name: Option<String>
    ) -> Option<String>
);
game_server_inventory_wrapper!(
    "gameServerInventoryGetResultTimestamp",
    game_server_inventory_get_result_timestamp,
    inventory_get_result_timestamp(result_handle: i32) -> u32
);
game_server_inventory_wrapper!(
    "gameServerInventoryCheckResultSteamId",
    game_server_inventory_check_result_steam_id,
    inventory_check_result_steam_id(result_handle: i32, steam_id64: BigInt) -> bool
);
game_server_inventory_wrapper!(
    "gameServerInventoryDestroyResult",
    game_server_inventory_destroy_result,
    inventory_destroy_result(result_handle: i32) -> ()
);
game_server_inventory_wrapper!(
    "gameServerInventoryGetAllItems",
    game_server_inventory_get_all_items,
    inventory_get_all_items() -> Option<i32>
);
game_server_inventory_wrapper!(
    "gameServerInventoryGetItemsById",
    game_server_inventory_get_items_by_id,
    inventory_get_items_by_id(instance_ids: Vec<BigInt>) -> Option<i32>
);
game_server_inventory_wrapper!(
    "gameServerInventorySerializeResult",
    game_server_inventory_serialize_result,
    inventory_serialize_result(result_handle: i32) -> Option<Buffer>
);
game_server_inventory_wrapper!(
    "gameServerInventoryDeserializeResult",
    game_server_inventory_deserialize_result,
    inventory_deserialize_result(data: Buffer) -> Option<i32>
);
game_server_inventory_wrapper!(
    "gameServerInventoryGenerateItems",
    game_server_inventory_generate_items,
    inventory_generate_items(items: Vec<InventoryItemQuantity>) -> Option<i32>
);
game_server_inventory_wrapper!(
    "gameServerInventoryGrantPromoItems",
    game_server_inventory_grant_promo_items,
    inventory_grant_promo_items() -> Option<i32>
);
game_server_inventory_wrapper!(
    "gameServerInventoryAddPromoItem",
    game_server_inventory_add_promo_item,
    inventory_add_promo_item(definition: i32) -> Option<i32>
);
game_server_inventory_wrapper!(
    "gameServerInventoryAddPromoItems",
    game_server_inventory_add_promo_items,
    inventory_add_promo_items(definitions: Vec<i32>) -> Option<i32>
);
game_server_inventory_wrapper!(
    "gameServerInventoryConsumeItem",
    game_server_inventory_consume_item,
    inventory_consume_item(item_id: BigInt, quantity: u32) -> Option<i32>
);
game_server_inventory_wrapper!(
    "gameServerInventoryExchangeItems",
    game_server_inventory_exchange_items,
    inventory_exchange_items(
        generate: Vec<InventoryItemQuantity>,
        destroy: Vec<InventoryInstanceQuantity>
    ) -> Option<i32>
);
game_server_inventory_wrapper!(
    "gameServerInventoryTransferItemQuantity",
    game_server_inventory_transfer_item_quantity,
    inventory_transfer_item_quantity(
        source_item_id: BigInt,
        quantity: u32,
        destination_item_id: Option<BigInt>
    ) -> Option<i32>
);
game_server_inventory_wrapper!(
    "gameServerInventorySendItemDropHeartbeat",
    game_server_inventory_send_item_drop_heartbeat,
    inventory_send_item_drop_heartbeat() -> ()
);
game_server_inventory_wrapper!(
    "gameServerInventoryTriggerItemDrop",
    game_server_inventory_trigger_item_drop,
    inventory_trigger_item_drop(drop_list_definition: i32) -> Option<i32>
);
game_server_inventory_wrapper!(
    "gameServerInventoryTradeItems",
    game_server_inventory_trade_items,
    inventory_trade_items(
        trade_partner_steam_id64: BigInt,
        give: Vec<InventoryInstanceQuantity>,
        get: Vec<InventoryInstanceQuantity>
    ) -> Option<i32>
);
game_server_inventory_wrapper!(
    "gameServerInventoryLoadItemDefinitions",
    game_server_inventory_load_item_definitions,
    inventory_load_item_definitions() -> bool
);
game_server_inventory_wrapper!(
    "gameServerInventoryGetItemDefinitionIds",
    game_server_inventory_get_item_definition_ids,
    inventory_get_item_definition_ids() -> Vec<i32>
);
game_server_inventory_wrapper!(
    "gameServerInventoryGetItemDefinitionProperty",
    game_server_inventory_get_item_definition_property,
    inventory_get_item_definition_property(
        definition: i32,
        property_name: Option<String>
    ) -> Option<String>
);

#[napi(js_name = "gameServerInventoryRequestEligiblePromoItemDefinitionIds")]
pub async fn game_server_inventory_request_eligible_promo_item_definition_ids(
    steam_id64: BigInt,
    timeout_seconds: Option<u32>,
) -> Result<InventoryEligiblePromoItemDefIds, Error> {
    let call = unsafe {
        sys::SteamAPI_ISteamInventory_RequestEligiblePromoItemDefinitionsIDs(
            steam_game_server_inventory()?,
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

game_server_inventory_wrapper!(
    "gameServerInventoryGetEligiblePromoItemDefinitionIds",
    game_server_inventory_get_eligible_promo_item_definition_ids,
    inventory_get_eligible_promo_item_definition_ids(steam_id64: BigInt) -> Vec<i32>
);

#[napi(js_name = "gameServerInventoryStartPurchase")]
pub async fn game_server_inventory_start_purchase(
    items: Vec<InventoryItemQuantity>,
    timeout_seconds: Option<u32>,
) -> Result<InventoryStartPurchaseResult, Error> {
    let (defs, quantities) = inventory_definition_quantities(items);
    let call = unsafe {
        sys::SteamAPI_ISteamInventory_StartPurchase(
            steam_game_server_inventory()?,
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

#[napi(js_name = "gameServerInventoryRequestPrices")]
pub async fn game_server_inventory_request_prices(
    timeout_seconds: Option<u32>,
) -> Result<InventoryRequestPricesResult, Error> {
    let call =
        unsafe { sys::SteamAPI_ISteamInventory_RequestPrices(steam_game_server_inventory()?) };
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

game_server_inventory_wrapper!(
    "gameServerInventoryGetNumItemsWithPrices",
    game_server_inventory_get_num_items_with_prices,
    inventory_get_num_items_with_prices() -> u32
);
game_server_inventory_wrapper!(
    "gameServerInventoryGetItemsWithPrices",
    game_server_inventory_get_items_with_prices,
    inventory_get_items_with_prices(max_items: Option<u32>) -> Vec<InventoryPrice>
);
game_server_inventory_wrapper!(
    "gameServerInventoryGetItemPrice",
    game_server_inventory_get_item_price,
    inventory_get_item_price(definition: i32) -> Option<InventoryPrice>
);
game_server_inventory_wrapper!(
    "gameServerInventoryStartUpdateProperties",
    game_server_inventory_start_update_properties,
    inventory_start_update_properties() -> Option<BigInt>
);
game_server_inventory_wrapper!(
    "gameServerInventoryRemoveProperty",
    game_server_inventory_remove_property,
    inventory_remove_property(update_handle: BigInt, item_id: BigInt, property_name: String) -> bool
);
game_server_inventory_wrapper!(
    "gameServerInventorySetPropertyString",
    game_server_inventory_set_property_string,
    inventory_set_property_string(
        update_handle: BigInt,
        item_id: BigInt,
        property_name: String,
        value: String
    ) -> bool
);
game_server_inventory_wrapper!(
    "gameServerInventorySetPropertyBool",
    game_server_inventory_set_property_bool,
    inventory_set_property_bool(
        update_handle: BigInt,
        item_id: BigInt,
        property_name: String,
        value: bool
    ) -> bool
);
game_server_inventory_wrapper!(
    "gameServerInventorySetPropertyInt64",
    game_server_inventory_set_property_int64,
    inventory_set_property_int64(
        update_handle: BigInt,
        item_id: BigInt,
        property_name: String,
        value: BigInt
    ) -> bool
);
game_server_inventory_wrapper!(
    "gameServerInventorySetPropertyFloat",
    game_server_inventory_set_property_float,
    inventory_set_property_float(
        update_handle: BigInt,
        item_id: BigInt,
        property_name: String,
        value: f64
    ) -> bool
);
game_server_inventory_wrapper!(
    "gameServerInventorySubmitUpdateProperties",
    game_server_inventory_submit_update_properties,
    inventory_submit_update_properties(update_handle: BigInt) -> Option<i32>
);
game_server_inventory_wrapper!(
    "gameServerInventoryInspectItem",
    game_server_inventory_inspect_item,
    inventory_inspect_item(item_token: String) -> Option<i32>
);

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

#[napi(js_name = "inputRunFrame")]
pub fn input_run_frame(reserved: Option<bool>) -> Result<(), Error> {
    unsafe { sys::SteamAPI_ISteamInput_RunFrame(steam_input()?, reserved.unwrap_or(false)) };
    Ok(())
}

#[napi(js_name = "inputWaitForData")]
pub fn input_wait_for_data(
    wait_forever: Option<bool>,
    timeout_ms: Option<u32>,
) -> Result<bool, Error> {
    Ok(unsafe {
        sys::SteamAPI_ISteamInput_BWaitForData(
            steam_input()?,
            wait_forever.unwrap_or(false),
            timeout_ms.unwrap_or(0),
        )
    })
}

#[napi(js_name = "inputNewDataAvailable")]
pub fn input_new_data_available() -> Result<bool, Error> {
    Ok(unsafe { sys::SteamAPI_ISteamInput_BNewDataAvailable(steam_input()?) })
}

#[napi(js_name = "inputEnableDeviceCallbacks")]
pub fn input_enable_device_callbacks() -> Result<(), Error> {
    unsafe { sys::SteamAPI_ISteamInput_EnableDeviceCallbacks(steam_input()?) };
    Ok(())
}

pub(crate) struct InputActionEventRegistration {
    registration_id: u64,
}

impl Drop for InputActionEventRegistration {
    fn drop(&mut self) {
        clear_input_action_event_callback(Some(self.registration_id));
    }
}

unsafe extern "C" fn steam_input_action_event_callback(event: *mut sys::SteamInputActionEvent_t) {
    if event.is_null() {
        return;
    }
    let value = steam_input_action_event_json(event);
    if let Some((_, handler)) = INPUT_ACTION_EVENT_HANDLER
        .lock()
        .expect("Steam input action event handler poisoned")
        .as_ref()
    {
        handler.call(value, ThreadsafeFunctionCallMode::NonBlocking);
    }
}

#[napi(js_name = "inputRegisterActionEventCallback")]
pub fn input_register_action_event_callback(
    #[napi(ts_arg_type = "(value: any) => void")] handler: JsCallback<'_, Value>,
) -> Result<CallbackHandle, Error> {
    crate::state::ensure_initialized()?;
    let input = steam_input()?;
    let threadsafe_handler: FatalThreadsafeFunction<Value> = handler
        .build_threadsafe_function::<Value>()
        .build_callback(|ctx| Ok(vec![ctx.value]))?;
    let registration_id = NEXT_INPUT_ACTION_EVENT_REGISTRATION.fetch_add(1, Ordering::Relaxed);
    *INPUT_ACTION_EVENT_HANDLER
        .lock()
        .expect("Steam input action event handler poisoned") =
        Some((registration_id, threadsafe_handler));
    unsafe {
        sys::SteamAPI_ISteamInput_EnableActionEventCallbacks(
            input,
            Some(steam_input_action_event_callback),
        );
    }
    Ok(CallbackHandle {
        registration: None,
        warning_message_registration: None,
        networking_debug_output_registration: None,
        input_action_event_registration: Some(InputActionEventRegistration { registration_id }),
    })
}

pub(crate) fn clear_input_action_event_callback(registration_id: Option<u64>) {
    let mut handler = INPUT_ACTION_EVENT_HANDLER
        .lock()
        .expect("Steam input action event handler poisoned");
    let should_clear = match (registration_id, handler.as_ref()) {
        (Some(registration_id), Some((active_id, _))) => registration_id == *active_id,
        (Some(_), None) => false,
        (None, _) => true,
    };
    if should_clear {
        *handler = None;
        if let Ok(input) = steam_input() {
            unsafe {
                sys::SteamAPI_ISteamInput_EnableActionEventCallbacks(input, None);
            }
        }
    }
}

#[napi(js_name = "inputSetActionManifestFilePath")]
pub fn input_set_action_manifest_file_path(path: String) -> Result<bool, Error> {
    let path = cstring(path, "input action manifest path")?;
    Ok(unsafe {
        sys::SteamAPI_ISteamInput_SetInputActionManifestFilePath(steam_input()?, path.as_ptr())
    })
}

#[napi(js_name = "inputGetControllers")]
pub fn input_get_controllers() -> Result<Vec<InputControllerInfo>, Error> {
    let input = steam_input()?;
    unsafe { sys::SteamAPI_ISteamInput_RunFrame(input, false) };
    let mut handles = vec![0u64; sys::STEAM_INPUT_MAX_COUNT as usize];
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

#[napi(js_name = "inputGetCurrentActionSet")]
pub fn input_get_current_action_set(controller: BigInt) -> Result<BigInt, Error> {
    Ok(unsafe {
        sys::SteamAPI_ISteamInput_GetCurrentActionSet(
            steam_input()?,
            bigint_to_u64(controller, "controller handle")?,
        )
    }
    .into())
}

#[napi(js_name = "inputActivateActionSetLayer")]
pub fn input_activate_action_set_layer(
    controller: BigInt,
    action_set_layer: BigInt,
) -> Result<(), Error> {
    unsafe {
        sys::SteamAPI_ISteamInput_ActivateActionSetLayer(
            steam_input()?,
            bigint_to_u64(controller, "controller handle")?,
            bigint_to_u64(action_set_layer, "action set layer handle")?,
        );
    }
    Ok(())
}

#[napi(js_name = "inputDeactivateActionSetLayer")]
pub fn input_deactivate_action_set_layer(
    controller: BigInt,
    action_set_layer: BigInt,
) -> Result<(), Error> {
    unsafe {
        sys::SteamAPI_ISteamInput_DeactivateActionSetLayer(
            steam_input()?,
            bigint_to_u64(controller, "controller handle")?,
            bigint_to_u64(action_set_layer, "action set layer handle")?,
        );
    }
    Ok(())
}

#[napi(js_name = "inputDeactivateAllActionSetLayers")]
pub fn input_deactivate_all_action_set_layers(controller: BigInt) -> Result<(), Error> {
    unsafe {
        sys::SteamAPI_ISteamInput_DeactivateAllActionSetLayers(
            steam_input()?,
            bigint_to_u64(controller, "controller handle")?,
        );
    }
    Ok(())
}

#[napi(js_name = "inputGetActiveActionSetLayers")]
pub fn input_get_active_action_set_layers(controller: BigInt) -> Result<Vec<BigInt>, Error> {
    let input = steam_input()?;
    let mut handles = vec![0u64; sys::STEAM_INPUT_MAX_ACTIVE_LAYERS as usize];
    let count = unsafe {
        sys::SteamAPI_ISteamInput_GetActiveActionSetLayers(
            input,
            bigint_to_u64(controller, "controller handle")?,
            handles.as_mut_ptr(),
        )
    };
    handles.truncate(count.max(0) as usize);
    Ok(handles.into_iter().map(BigInt::from).collect())
}

#[napi(js_name = "inputGetDigitalActionData")]
pub fn input_get_digital_action_data(
    controller: BigInt,
    action: BigInt,
) -> Result<InputDigitalActionData, Error> {
    let data = unsafe {
        sys::SteamAPI_ISteamInput_GetDigitalActionData(
            steam_input()?,
            bigint_to_u64(controller, "controller handle")?,
            bigint_to_u64(action, "digital action handle")?,
        )
    };
    Ok(input_digital_action_data(data))
}

#[napi(js_name = "inputIsDigitalActionPressed")]
pub fn input_is_digital_action_pressed(controller: BigInt, action: BigInt) -> Result<bool, Error> {
    let data = input_get_digital_action_data(controller, action)?;
    Ok(data.active && data.state)
}

#[napi(js_name = "inputGetDigitalActionOrigins")]
pub fn input_get_digital_action_origins(
    controller: BigInt,
    action_set: BigInt,
    action: BigInt,
) -> Result<Vec<u32>, Error> {
    let input = steam_input()?;
    let mut origins = vec![
        sys::EInputActionOrigin::k_EInputActionOrigin_None;
        sys::STEAM_INPUT_MAX_ORIGINS as usize
    ];
    let count = unsafe {
        sys::SteamAPI_ISteamInput_GetDigitalActionOrigins(
            input,
            bigint_to_u64(controller, "controller handle")?,
            bigint_to_u64(action_set, "action set handle")?,
            bigint_to_u64(action, "digital action handle")?,
            origins.as_mut_ptr(),
        )
    };
    origins.truncate(count.max(0) as usize);
    Ok(origins.into_iter().map(|origin| origin as u32).collect())
}

#[napi(js_name = "inputGetStringForDigitalActionName")]
pub fn input_get_string_for_digital_action_name(action: BigInt) -> Result<String, Error> {
    Ok(string_from_ptr(unsafe {
        sys::SteamAPI_ISteamInput_GetStringForDigitalActionName(
            steam_input()?,
            bigint_to_u64(action, "digital action handle")?,
        )
    }))
}

#[napi(js_name = "inputGetAnalogActionData")]
pub fn input_get_analog_action_data(
    controller: BigInt,
    action: BigInt,
) -> Result<InputAnalogActionData, Error> {
    let data = unsafe {
        sys::SteamAPI_ISteamInput_GetAnalogActionData(
            steam_input()?,
            bigint_to_u64(controller, "controller handle")?,
            bigint_to_u64(action, "analog action handle")?,
        )
    };
    Ok(input_analog_action_data(data))
}

#[napi(js_name = "inputGetAnalogActionVector")]
pub fn input_get_analog_action_vector(
    controller: BigInt,
    action: BigInt,
) -> Result<AnalogActionVector, Error> {
    let data = input_get_analog_action_data(controller, action)?;
    let x = data.x;
    let y = data.y;
    Ok(AnalogActionVector { x, y })
}

#[napi(js_name = "inputGetAnalogActionOrigins")]
pub fn input_get_analog_action_origins(
    controller: BigInt,
    action_set: BigInt,
    action: BigInt,
) -> Result<Vec<u32>, Error> {
    let input = steam_input()?;
    let mut origins = vec![
        sys::EInputActionOrigin::k_EInputActionOrigin_None;
        sys::STEAM_INPUT_MAX_ORIGINS as usize
    ];
    let count = unsafe {
        sys::SteamAPI_ISteamInput_GetAnalogActionOrigins(
            input,
            bigint_to_u64(controller, "controller handle")?,
            bigint_to_u64(action_set, "action set handle")?,
            bigint_to_u64(action, "analog action handle")?,
            origins.as_mut_ptr(),
        )
    };
    origins.truncate(count.max(0) as usize);
    Ok(origins.into_iter().map(|origin| origin as u32).collect())
}

#[napi(js_name = "inputGetStringForAnalogActionName")]
pub fn input_get_string_for_analog_action_name(action: BigInt) -> Result<String, Error> {
    Ok(string_from_ptr(unsafe {
        sys::SteamAPI_ISteamInput_GetStringForAnalogActionName(
            steam_input()?,
            bigint_to_u64(action, "analog action handle")?,
        )
    }))
}

#[napi(js_name = "inputGetGlyphPngForActionOrigin")]
pub fn input_get_glyph_png_for_action_origin(
    origin: u32,
    size: Option<u32>,
    flags: Option<u32>,
) -> Result<String, Error> {
    Ok(string_from_ptr(unsafe {
        sys::SteamAPI_ISteamInput_GetGlyphPNGForActionOrigin(
            steam_input()?,
            input_action_origin_from_u32(origin)?,
            input_glyph_size_from_u32(size.unwrap_or(1))?,
            flags.unwrap_or(0),
        )
    }))
}

#[napi(js_name = "inputGetGlyphSvgForActionOrigin")]
pub fn input_get_glyph_svg_for_action_origin(
    origin: u32,
    flags: Option<u32>,
) -> Result<String, Error> {
    Ok(string_from_ptr(unsafe {
        sys::SteamAPI_ISteamInput_GetGlyphSVGForActionOrigin(
            steam_input()?,
            input_action_origin_from_u32(origin)?,
            flags.unwrap_or(0),
        )
    }))
}

#[napi(js_name = "inputGetLegacyGlyphForActionOrigin")]
pub fn input_get_legacy_glyph_for_action_origin(origin: u32) -> Result<String, Error> {
    Ok(string_from_ptr(unsafe {
        sys::SteamAPI_ISteamInput_GetGlyphForActionOrigin_Legacy(
            steam_input()?,
            input_action_origin_from_u32(origin)?,
        )
    }))
}

#[napi(js_name = "inputGetStringForActionOrigin")]
pub fn input_get_string_for_action_origin(origin: u32) -> Result<String, Error> {
    Ok(string_from_ptr(unsafe {
        sys::SteamAPI_ISteamInput_GetStringForActionOrigin(
            steam_input()?,
            input_action_origin_from_u32(origin)?,
        )
    }))
}

#[napi(js_name = "inputStopAnalogActionMomentum")]
pub fn input_stop_analog_action_momentum(controller: BigInt, action: BigInt) -> Result<(), Error> {
    unsafe {
        sys::SteamAPI_ISteamInput_StopAnalogActionMomentum(
            steam_input()?,
            bigint_to_u64(controller, "controller handle")?,
            bigint_to_u64(action, "analog action handle")?,
        );
    }
    Ok(())
}

#[napi(js_name = "inputGetMotionData")]
pub fn input_get_motion_data(controller: BigInt) -> Result<InputMotionData, Error> {
    let data = unsafe {
        sys::SteamAPI_ISteamInput_GetMotionData(
            steam_input()?,
            bigint_to_u64(controller, "controller handle")?,
        )
    };
    Ok(input_motion_data(data))
}

#[napi(js_name = "inputTriggerVibration")]
pub fn input_trigger_vibration(
    controller: BigInt,
    left_speed: u32,
    right_speed: u32,
) -> Result<(), Error> {
    unsafe {
        sys::SteamAPI_ISteamInput_TriggerVibration(
            steam_input()?,
            bigint_to_u64(controller, "controller handle")?,
            input_u16(left_speed, "left speed")?,
            input_u16(right_speed, "right speed")?,
        );
    }
    Ok(())
}

#[napi(js_name = "inputTriggerVibrationExtended")]
pub fn input_trigger_vibration_extended(
    controller: BigInt,
    left_speed: u32,
    right_speed: u32,
    left_trigger_speed: u32,
    right_trigger_speed: u32,
) -> Result<(), Error> {
    unsafe {
        sys::SteamAPI_ISteamInput_TriggerVibrationExtended(
            steam_input()?,
            bigint_to_u64(controller, "controller handle")?,
            input_u16(left_speed, "left speed")?,
            input_u16(right_speed, "right speed")?,
            input_u16(left_trigger_speed, "left trigger speed")?,
            input_u16(right_trigger_speed, "right trigger speed")?,
        );
    }
    Ok(())
}

#[napi(js_name = "inputSetDualSenseTriggerEffect")]
pub fn input_set_dualsense_trigger_effect(
    controller: BigInt,
    effect: Option<Buffer>,
) -> Result<(), Error> {
    let effect_ptr = if let Some(effect) = effect.as_ref() {
        if effect.len() != SCE_PAD_TRIGGER_EFFECT_PARAM_BYTES {
            return Err(Error::from_reason(format!(
                "DualSense trigger effect must be {SCE_PAD_TRIGGER_EFFECT_PARAM_BYTES} bytes"
            )));
        }
        effect.as_ptr().cast::<sys::ScePadTriggerEffectParam>()
    } else {
        ptr::null()
    };
    unsafe {
        sys::SteamAPI_ISteamInput_SetDualSenseTriggerEffect(
            steam_input()?,
            bigint_to_u64(controller, "controller handle")?,
            effect_ptr,
        );
    }
    Ok(())
}

#[napi(js_name = "inputTriggerSimpleHapticEvent")]
pub fn input_trigger_simple_haptic_event(
    controller: BigInt,
    location: u32,
    intensity: u32,
    gain_db: i32,
    other_intensity: u32,
    other_gain_db: i32,
) -> Result<(), Error> {
    unsafe {
        sys::SteamAPI_ISteamInput_TriggerSimpleHapticEvent(
            steam_input()?,
            bigint_to_u64(controller, "controller handle")?,
            controller_haptic_location_from_u32(location)?,
            input_u8(intensity, "intensity")?,
            input_i8(gain_db, "gain dB")?,
            input_u8(other_intensity, "other intensity")?,
            input_i8(other_gain_db, "other gain dB")?,
        );
    }
    Ok(())
}

#[napi(js_name = "inputSetLedColor")]
pub fn input_set_led_color(
    controller: BigInt,
    red: u32,
    green: u32,
    blue: u32,
    flags: Option<u32>,
) -> Result<(), Error> {
    unsafe {
        sys::SteamAPI_ISteamInput_SetLEDColor(
            steam_input()?,
            bigint_to_u64(controller, "controller handle")?,
            input_u8(red, "red")?,
            input_u8(green, "green")?,
            input_u8(blue, "blue")?,
            flags.unwrap_or(0),
        );
    }
    Ok(())
}

#[napi(js_name = "inputLegacyTriggerHapticPulse")]
pub fn input_legacy_trigger_haptic_pulse(
    controller: BigInt,
    target_pad: u32,
    duration_microseconds: u32,
) -> Result<(), Error> {
    unsafe {
        sys::SteamAPI_ISteamInput_Legacy_TriggerHapticPulse(
            steam_input()?,
            bigint_to_u64(controller, "controller handle")?,
            steam_controller_pad_from_u32(target_pad)?,
            input_u16(duration_microseconds, "duration microseconds")?,
        );
    }
    Ok(())
}

#[napi(js_name = "inputLegacyTriggerRepeatedHapticPulse")]
pub fn input_legacy_trigger_repeated_haptic_pulse(
    controller: BigInt,
    target_pad: u32,
    duration_microseconds: u32,
    off_microseconds: u32,
    repeat: u32,
    flags: Option<u32>,
) -> Result<(), Error> {
    unsafe {
        sys::SteamAPI_ISteamInput_Legacy_TriggerRepeatedHapticPulse(
            steam_input()?,
            bigint_to_u64(controller, "controller handle")?,
            steam_controller_pad_from_u32(target_pad)?,
            input_u16(duration_microseconds, "duration microseconds")?,
            input_u16(off_microseconds, "off microseconds")?,
            input_u16(repeat, "repeat")?,
            flags.unwrap_or(0),
        );
    }
    Ok(())
}

#[napi(js_name = "inputShowBindingPanel")]
pub fn input_show_binding_panel(controller: BigInt) -> Result<bool, Error> {
    Ok(unsafe {
        sys::SteamAPI_ISteamInput_ShowBindingPanel(
            steam_input()?,
            bigint_to_u64(controller, "controller handle")?,
        )
    })
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

#[napi(js_name = "inputGetControllerForGamepadIndex")]
pub fn input_get_controller_for_gamepad_index(index: i32) -> Result<Option<BigInt>, Error> {
    let handle =
        unsafe { sys::SteamAPI_ISteamInput_GetControllerForGamepadIndex(steam_input()?, index) };
    Ok((handle != 0).then(|| handle.into()))
}

#[napi(js_name = "inputGetGamepadIndexForController")]
pub fn input_get_gamepad_index_for_controller(controller: BigInt) -> Result<i32, Error> {
    Ok(unsafe {
        sys::SteamAPI_ISteamInput_GetGamepadIndexForController(
            steam_input()?,
            bigint_to_u64(controller, "controller handle")?,
        )
    })
}

#[napi(js_name = "inputGetStringForXboxOrigin")]
pub fn input_get_string_for_xbox_origin(origin: u32) -> Result<String, Error> {
    Ok(string_from_ptr(unsafe {
        sys::SteamAPI_ISteamInput_GetStringForXboxOrigin(
            steam_input()?,
            xbox_origin_from_u32(origin)?,
        )
    }))
}

#[napi(js_name = "inputGetGlyphForXboxOrigin")]
pub fn input_get_glyph_for_xbox_origin(origin: u32) -> Result<String, Error> {
    Ok(string_from_ptr(unsafe {
        sys::SteamAPI_ISteamInput_GetGlyphForXboxOrigin(
            steam_input()?,
            xbox_origin_from_u32(origin)?,
        )
    }))
}

#[napi(js_name = "inputGetActionOriginFromXboxOrigin")]
pub fn input_get_action_origin_from_xbox_origin(
    controller: BigInt,
    origin: u32,
) -> Result<u32, Error> {
    Ok(unsafe {
        sys::SteamAPI_ISteamInput_GetActionOriginFromXboxOrigin(
            steam_input()?,
            bigint_to_u64(controller, "controller handle")?,
            xbox_origin_from_u32(origin)?,
        ) as u32
    })
}

#[napi(js_name = "inputTranslateActionOrigin")]
pub fn input_translate_action_origin(
    destination_input_type: u32,
    source_origin: u32,
) -> Result<u32, Error> {
    Ok(unsafe {
        sys::SteamAPI_ISteamInput_TranslateActionOrigin(
            steam_input()?,
            steam_input_type_from_u32(destination_input_type)?,
            input_action_origin_from_u32(source_origin)?,
        ) as u32
    })
}

#[napi(js_name = "inputGetDeviceBindingRevision")]
pub fn input_get_device_binding_revision(
    controller: BigInt,
) -> Result<Option<InputDeviceBindingRevision>, Error> {
    let mut major = 0;
    let mut minor = 0;
    let ok = unsafe {
        sys::SteamAPI_ISteamInput_GetDeviceBindingRevision(
            steam_input()?,
            bigint_to_u64(controller, "controller handle")?,
            &mut major,
            &mut minor,
        )
    };
    Ok(ok.then_some(InputDeviceBindingRevision { major, minor }))
}

#[napi(js_name = "inputGetRemotePlaySessionId")]
pub fn input_get_remote_play_session_id(controller: BigInt) -> Result<u32, Error> {
    Ok(unsafe {
        sys::SteamAPI_ISteamInput_GetRemotePlaySessionID(
            steam_input()?,
            bigint_to_u64(controller, "controller handle")?,
        )
    })
}

#[napi(js_name = "inputGetSessionInputConfigurationSettings")]
pub fn input_get_session_input_configuration_settings() -> Result<u32, Error> {
    Ok(
        unsafe { sys::SteamAPI_ISteamInput_GetSessionInputConfigurationSettings(steam_input()?) }
            as u32,
    )
}

#[napi(js_name = "controllerInit")]
pub fn controller_init() -> Result<bool, Error> {
    Ok(unsafe { sys::SteamAPI_ISteamController_Init(steam_controller()?) })
}

#[napi(js_name = "controllerShutdown")]
pub fn controller_shutdown() -> Result<bool, Error> {
    Ok(unsafe { sys::SteamAPI_ISteamController_Shutdown(steam_controller()?) })
}

#[napi(js_name = "controllerRunFrame")]
pub fn controller_run_frame() -> Result<(), Error> {
    unsafe { sys::SteamAPI_ISteamController_RunFrame(steam_controller()?) };
    Ok(())
}

#[napi(js_name = "controllerGetControllers")]
pub fn controller_get_controllers() -> Result<Vec<InputControllerInfo>, Error> {
    let controller = steam_controller()?;
    unsafe { sys::SteamAPI_ISteamController_RunFrame(controller) };
    let mut handles = vec![0u64; sys::STEAM_CONTROLLER_MAX_COUNT as usize];
    let count = unsafe {
        sys::SteamAPI_ISteamController_GetConnectedControllers(controller, handles.as_mut_ptr())
    };
    handles.truncate(count.max(0) as usize);
    Ok(handles
        .into_iter()
        .map(|handle| InputControllerInfo {
            input_type: input_type_name(unsafe {
                sys::SteamAPI_ISteamController_GetInputTypeForHandle(controller, handle)
            })
            .to_owned(),
            handle: handle.into(),
        })
        .collect())
}

#[napi(js_name = "controllerGetActionSet")]
pub fn controller_get_action_set(action_set_name: String) -> Result<BigInt, Error> {
    let name = cstring(action_set_name, "controller action set name")?;
    Ok(unsafe {
        sys::SteamAPI_ISteamController_GetActionSetHandle(steam_controller()?, name.as_ptr())
    }
    .into())
}

#[napi(js_name = "controllerGetDigitalAction")]
pub fn controller_get_digital_action(action_name: String) -> Result<BigInt, Error> {
    let name = cstring(action_name, "controller digital action name")?;
    Ok(unsafe {
        sys::SteamAPI_ISteamController_GetDigitalActionHandle(steam_controller()?, name.as_ptr())
    }
    .into())
}

#[napi(js_name = "controllerGetAnalogAction")]
pub fn controller_get_analog_action(action_name: String) -> Result<BigInt, Error> {
    let name = cstring(action_name, "controller analog action name")?;
    Ok(unsafe {
        sys::SteamAPI_ISteamController_GetAnalogActionHandle(steam_controller()?, name.as_ptr())
    }
    .into())
}

#[napi(js_name = "controllerActivateActionSet")]
pub fn controller_activate_action_set(controller: BigInt, action_set: BigInt) -> Result<(), Error> {
    unsafe {
        sys::SteamAPI_ISteamController_ActivateActionSet(
            steam_controller()?,
            bigint_to_u64(controller, "controller handle")?,
            bigint_to_u64(action_set, "controller action set handle")?,
        );
    }
    Ok(())
}

#[napi(js_name = "controllerGetCurrentActionSet")]
pub fn controller_get_current_action_set(controller: BigInt) -> Result<BigInt, Error> {
    Ok(unsafe {
        sys::SteamAPI_ISteamController_GetCurrentActionSet(
            steam_controller()?,
            bigint_to_u64(controller, "controller handle")?,
        )
    }
    .into())
}

#[napi(js_name = "controllerActivateActionSetLayer")]
pub fn controller_activate_action_set_layer(
    controller: BigInt,
    action_set_layer: BigInt,
) -> Result<(), Error> {
    unsafe {
        sys::SteamAPI_ISteamController_ActivateActionSetLayer(
            steam_controller()?,
            bigint_to_u64(controller, "controller handle")?,
            bigint_to_u64(action_set_layer, "controller action set layer handle")?,
        );
    }
    Ok(())
}

#[napi(js_name = "controllerDeactivateActionSetLayer")]
pub fn controller_deactivate_action_set_layer(
    controller: BigInt,
    action_set_layer: BigInt,
) -> Result<(), Error> {
    unsafe {
        sys::SteamAPI_ISteamController_DeactivateActionSetLayer(
            steam_controller()?,
            bigint_to_u64(controller, "controller handle")?,
            bigint_to_u64(action_set_layer, "controller action set layer handle")?,
        );
    }
    Ok(())
}

#[napi(js_name = "controllerDeactivateAllActionSetLayers")]
pub fn controller_deactivate_all_action_set_layers(controller: BigInt) -> Result<(), Error> {
    unsafe {
        sys::SteamAPI_ISteamController_DeactivateAllActionSetLayers(
            steam_controller()?,
            bigint_to_u64(controller, "controller handle")?,
        );
    }
    Ok(())
}

#[napi(js_name = "controllerGetActiveActionSetLayers")]
pub fn controller_get_active_action_set_layers(controller: BigInt) -> Result<Vec<BigInt>, Error> {
    let steam_controller = steam_controller()?;
    let mut handles = vec![0u64; sys::STEAM_CONTROLLER_MAX_ACTIVE_LAYERS as usize];
    let count = unsafe {
        sys::SteamAPI_ISteamController_GetActiveActionSetLayers(
            steam_controller,
            bigint_to_u64(controller, "controller handle")?,
            handles.as_mut_ptr(),
        )
    };
    handles.truncate(count.max(0) as usize);
    Ok(handles.into_iter().map(BigInt::from).collect())
}

#[napi(js_name = "controllerGetDigitalActionData")]
pub fn controller_get_digital_action_data(
    controller: BigInt,
    action: BigInt,
) -> Result<InputDigitalActionData, Error> {
    let data = unsafe {
        sys::SteamAPI_ISteamController_GetDigitalActionData(
            steam_controller()?,
            bigint_to_u64(controller, "controller handle")?,
            bigint_to_u64(action, "controller digital action handle")?,
        )
    };
    Ok(input_digital_action_data(data))
}

#[napi(js_name = "controllerIsDigitalActionPressed")]
pub fn controller_is_digital_action_pressed(
    controller: BigInt,
    action: BigInt,
) -> Result<bool, Error> {
    let data = controller_get_digital_action_data(controller, action)?;
    Ok(data.active && data.state)
}

#[napi(js_name = "controllerGetDigitalActionOrigins")]
pub fn controller_get_digital_action_origins(
    controller: BigInt,
    action_set: BigInt,
    action: BigInt,
) -> Result<Vec<u32>, Error> {
    let steam_controller = steam_controller()?;
    let mut origins = vec![
        sys::EControllerActionOrigin::k_EControllerActionOrigin_None;
        sys::STEAM_CONTROLLER_MAX_ORIGINS as usize
    ];
    let count = unsafe {
        sys::SteamAPI_ISteamController_GetDigitalActionOrigins(
            steam_controller,
            bigint_to_u64(controller, "controller handle")?,
            bigint_to_u64(action_set, "controller action set handle")?,
            bigint_to_u64(action, "controller digital action handle")?,
            origins.as_mut_ptr(),
        )
    };
    origins.truncate(count.max(0) as usize);
    Ok(origins.into_iter().map(|origin| origin as u32).collect())
}

#[napi(js_name = "controllerGetAnalogActionData")]
pub fn controller_get_analog_action_data(
    controller: BigInt,
    action: BigInt,
) -> Result<InputAnalogActionData, Error> {
    let data = unsafe {
        sys::SteamAPI_ISteamController_GetAnalogActionData(
            steam_controller()?,
            bigint_to_u64(controller, "controller handle")?,
            bigint_to_u64(action, "controller analog action handle")?,
        )
    };
    Ok(input_analog_action_data(data))
}

#[napi(js_name = "controllerGetAnalogActionVector")]
pub fn controller_get_analog_action_vector(
    controller: BigInt,
    action: BigInt,
) -> Result<AnalogActionVector, Error> {
    let data = controller_get_analog_action_data(controller, action)?;
    Ok(AnalogActionVector {
        x: data.x,
        y: data.y,
    })
}

#[napi(js_name = "controllerGetAnalogActionOrigins")]
pub fn controller_get_analog_action_origins(
    controller: BigInt,
    action_set: BigInt,
    action: BigInt,
) -> Result<Vec<u32>, Error> {
    let steam_controller = steam_controller()?;
    let mut origins = vec![
        sys::EControllerActionOrigin::k_EControllerActionOrigin_None;
        sys::STEAM_CONTROLLER_MAX_ORIGINS as usize
    ];
    let count = unsafe {
        sys::SteamAPI_ISteamController_GetAnalogActionOrigins(
            steam_controller,
            bigint_to_u64(controller, "controller handle")?,
            bigint_to_u64(action_set, "controller action set handle")?,
            bigint_to_u64(action, "controller analog action handle")?,
            origins.as_mut_ptr(),
        )
    };
    origins.truncate(count.max(0) as usize);
    Ok(origins.into_iter().map(|origin| origin as u32).collect())
}

#[napi(js_name = "controllerGetGlyphForActionOrigin")]
pub fn controller_get_glyph_for_action_origin(origin: u32) -> Result<String, Error> {
    Ok(string_from_ptr(unsafe {
        sys::SteamAPI_ISteamController_GetGlyphForActionOrigin(
            steam_controller()?,
            controller_action_origin_from_u32(origin)?,
        )
    }))
}

#[napi(js_name = "controllerGetStringForActionOrigin")]
pub fn controller_get_string_for_action_origin(origin: u32) -> Result<String, Error> {
    Ok(string_from_ptr(unsafe {
        sys::SteamAPI_ISteamController_GetStringForActionOrigin(
            steam_controller()?,
            controller_action_origin_from_u32(origin)?,
        )
    }))
}

#[napi(js_name = "controllerStopAnalogActionMomentum")]
pub fn controller_stop_analog_action_momentum(
    controller: BigInt,
    action: BigInt,
) -> Result<(), Error> {
    unsafe {
        sys::SteamAPI_ISteamController_StopAnalogActionMomentum(
            steam_controller()?,
            bigint_to_u64(controller, "controller handle")?,
            bigint_to_u64(action, "controller analog action handle")?,
        );
    }
    Ok(())
}

#[napi(js_name = "controllerGetMotionData")]
pub fn controller_get_motion_data(controller: BigInt) -> Result<InputMotionData, Error> {
    let data = unsafe {
        sys::SteamAPI_ISteamController_GetMotionData(
            steam_controller()?,
            bigint_to_u64(controller, "controller handle")?,
        )
    };
    Ok(input_motion_data(data))
}

#[napi(js_name = "controllerTriggerHapticPulse")]
pub fn controller_trigger_haptic_pulse(
    controller: BigInt,
    target_pad: u32,
    duration_microseconds: u32,
) -> Result<(), Error> {
    unsafe {
        sys::SteamAPI_ISteamController_TriggerHapticPulse(
            steam_controller()?,
            bigint_to_u64(controller, "controller handle")?,
            steam_controller_pad_from_u32(target_pad)?,
            input_u16(duration_microseconds, "duration microseconds")?,
        );
    }
    Ok(())
}

#[napi(js_name = "controllerTriggerRepeatedHapticPulse")]
pub fn controller_trigger_repeated_haptic_pulse(
    controller: BigInt,
    target_pad: u32,
    duration_microseconds: u32,
    off_microseconds: u32,
    repeat: u32,
    flags: Option<u32>,
) -> Result<(), Error> {
    unsafe {
        sys::SteamAPI_ISteamController_TriggerRepeatedHapticPulse(
            steam_controller()?,
            bigint_to_u64(controller, "controller handle")?,
            steam_controller_pad_from_u32(target_pad)?,
            input_u16(duration_microseconds, "duration microseconds")?,
            input_u16(off_microseconds, "off microseconds")?,
            input_u16(repeat, "repeat")?,
            flags.unwrap_or(0),
        );
    }
    Ok(())
}

#[napi(js_name = "controllerTriggerVibration")]
pub fn controller_trigger_vibration(
    controller: BigInt,
    left_speed: u32,
    right_speed: u32,
) -> Result<(), Error> {
    unsafe {
        sys::SteamAPI_ISteamController_TriggerVibration(
            steam_controller()?,
            bigint_to_u64(controller, "controller handle")?,
            input_u16(left_speed, "left speed")?,
            input_u16(right_speed, "right speed")?,
        );
    }
    Ok(())
}

#[napi(js_name = "controllerSetLedColor")]
pub fn controller_set_led_color(
    controller: BigInt,
    red: u32,
    green: u32,
    blue: u32,
    flags: Option<u32>,
) -> Result<(), Error> {
    unsafe {
        sys::SteamAPI_ISteamController_SetLEDColor(
            steam_controller()?,
            bigint_to_u64(controller, "controller handle")?,
            input_u8(red, "red")?,
            input_u8(green, "green")?,
            input_u8(blue, "blue")?,
            flags.unwrap_or(0),
        );
    }
    Ok(())
}

#[napi(js_name = "controllerShowBindingPanel")]
pub fn controller_show_binding_panel(controller: BigInt) -> Result<bool, Error> {
    Ok(unsafe {
        sys::SteamAPI_ISteamController_ShowBindingPanel(
            steam_controller()?,
            bigint_to_u64(controller, "controller handle")?,
        )
    })
}

#[napi(js_name = "controllerGetControllerType")]
pub fn controller_get_controller_type(controller: BigInt) -> Result<String, Error> {
    Ok(input_type_name(unsafe {
        sys::SteamAPI_ISteamController_GetInputTypeForHandle(
            steam_controller()?,
            bigint_to_u64(controller, "controller handle")?,
        )
    })
    .to_owned())
}

#[napi(js_name = "controllerGetControllerForGamepadIndex")]
pub fn controller_get_controller_for_gamepad_index(index: i32) -> Result<Option<BigInt>, Error> {
    let handle = unsafe {
        sys::SteamAPI_ISteamController_GetControllerForGamepadIndex(steam_controller()?, index)
    };
    Ok((handle != 0).then(|| handle.into()))
}

#[napi(js_name = "controllerGetGamepadIndexForController")]
pub fn controller_get_gamepad_index_for_controller(controller: BigInt) -> Result<i32, Error> {
    Ok(unsafe {
        sys::SteamAPI_ISteamController_GetGamepadIndexForController(
            steam_controller()?,
            bigint_to_u64(controller, "controller handle")?,
        )
    })
}

#[napi(js_name = "controllerGetStringForXboxOrigin")]
pub fn controller_get_string_for_xbox_origin(origin: u32) -> Result<String, Error> {
    Ok(string_from_ptr(unsafe {
        sys::SteamAPI_ISteamController_GetStringForXboxOrigin(
            steam_controller()?,
            xbox_origin_from_u32(origin)?,
        )
    }))
}

#[napi(js_name = "controllerGetGlyphForXboxOrigin")]
pub fn controller_get_glyph_for_xbox_origin(origin: u32) -> Result<String, Error> {
    Ok(string_from_ptr(unsafe {
        sys::SteamAPI_ISteamController_GetGlyphForXboxOrigin(
            steam_controller()?,
            xbox_origin_from_u32(origin)?,
        )
    }))
}

#[napi(js_name = "controllerGetActionOriginFromXboxOrigin")]
pub fn controller_get_action_origin_from_xbox_origin(
    controller: BigInt,
    origin: u32,
) -> Result<u32, Error> {
    Ok(unsafe {
        sys::SteamAPI_ISteamController_GetActionOriginFromXboxOrigin(
            steam_controller()?,
            bigint_to_u64(controller, "controller handle")?,
            xbox_origin_from_u32(origin)?,
        ) as u32
    })
}

#[napi(js_name = "controllerTranslateActionOrigin")]
pub fn controller_translate_action_origin(
    destination_input_type: u32,
    source_origin: u32,
) -> Result<u32, Error> {
    Ok(unsafe {
        sys::SteamAPI_ISteamController_TranslateActionOrigin(
            steam_controller()?,
            steam_input_type_from_u32(destination_input_type)?,
            controller_action_origin_from_u32(source_origin)?,
        ) as u32
    })
}

#[napi(js_name = "controllerGetControllerBindingRevision")]
pub fn controller_get_controller_binding_revision(
    controller: BigInt,
) -> Result<Option<InputDeviceBindingRevision>, Error> {
    let mut major = 0;
    let mut minor = 0;
    let ok = unsafe {
        sys::SteamAPI_ISteamController_GetControllerBindingRevision(
            steam_controller()?,
            bigint_to_u64(controller, "controller handle")?,
            &mut major,
            &mut minor,
        )
    };
    Ok(ok.then_some(InputDeviceBindingRevision { major, minor }))
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

#[napi(js_name = "gameServerInit")]
pub fn game_server_init(options: GameServerInitOptions) -> Result<(), Error> {
    if crate::state::is_game_server_initialized() {
        game_server_shutdown();
    }
    let version = cstring(options.version, "game server version")?;
    let mut err_msg: sys::SteamErrMsg = [0; 1024];
    let result = unsafe {
        sys::SteamInternal_GameServer_Init_V2(
            options.ip.unwrap_or(0),
            port_to_u16(options.game_port, "game server game port")?,
            port_to_u16(options.query_port, "game server query port")?,
            game_server_mode(options.server_mode)?,
            version.as_ptr(),
            STEAM_GAME_SERVER_INTERFACE_VERSIONS
                .as_ptr()
                .cast::<c_char>(),
            &mut err_msg,
        )
    };
    if result == sys::ESteamAPIInitResult::k_ESteamAPIInitResult_OK {
        unsafe {
            sys::SteamAPI_ManualDispatch_Init();
        }
        crate::state::mark_game_server_initialized(true);
        Ok(())
    } else {
        crate::state::mark_game_server_initialized(false);
        Err(Error::from_reason(game_server_init_error_message(
            result, &err_msg,
        )))
    }
}

#[napi(js_name = "gameServerShutdown")]
pub fn game_server_shutdown() {
    if crate::state::is_game_server_initialized() {
        unsafe { sys::SteamGameServer_Shutdown() };
        crate::state::mark_game_server_initialized(false);
        if !crate::state::is_initialized() {
            crate::state::clear_callbacks();
        }
    }
}

#[napi(js_name = "gameServerRunCallbacks")]
pub fn game_server_run_callbacks() {
    run_game_server_callbacks();
}

#[napi(js_name = "gameServerIsSecure")]
pub fn game_server_is_secure() -> Result<bool, Error> {
    crate::state::ensure_game_server_initialized()?;
    Ok(unsafe { sys::SteamGameServer_BSecure() })
}

#[napi(js_name = "gameServerGetSteamId")]
pub fn game_server_get_steam_id() -> Result<PlayerSteamId, Error> {
    crate::state::ensure_game_server_initialized()?;
    Ok(steam_id_to_player(unsafe {
        sys::SteamGameServer_GetSteamID()
    }))
}

#[napi(js_name = "gameServerSetProduct")]
pub fn game_server_set_product(product: String) -> Result<(), Error> {
    let product = cstring(product, "game server product")?;
    unsafe { sys::SteamAPI_ISteamGameServer_SetProduct(steam_game_server()?, product.as_ptr()) };
    Ok(())
}

#[napi(js_name = "gameServerSetGameDescription")]
pub fn game_server_set_game_description(description: String) -> Result<(), Error> {
    let description = cstring(description, "game server description")?;
    unsafe {
        sys::SteamAPI_ISteamGameServer_SetGameDescription(
            steam_game_server()?,
            description.as_ptr(),
        )
    };
    Ok(())
}

#[napi(js_name = "gameServerSetModDir")]
pub fn game_server_set_mod_dir(mod_dir: String) -> Result<(), Error> {
    let mod_dir = cstring(mod_dir, "game server mod dir")?;
    unsafe { sys::SteamAPI_ISteamGameServer_SetModDir(steam_game_server()?, mod_dir.as_ptr()) };
    Ok(())
}

#[napi(js_name = "gameServerSetDedicatedServer")]
pub fn game_server_set_dedicated_server(dedicated: bool) -> Result<(), Error> {
    unsafe { sys::SteamAPI_ISteamGameServer_SetDedicatedServer(steam_game_server()?, dedicated) };
    Ok(())
}

#[napi(js_name = "gameServerLogOn")]
pub fn game_server_log_on(token: String) -> Result<(), Error> {
    let token = cstring(token, "game server login token")?;
    unsafe { sys::SteamAPI_ISteamGameServer_LogOn(steam_game_server()?, token.as_ptr()) };
    Ok(())
}

#[napi(js_name = "gameServerLogOnAnonymous")]
pub fn game_server_log_on_anonymous() -> Result<(), Error> {
    unsafe { sys::SteamAPI_ISteamGameServer_LogOnAnonymous(steam_game_server()?) };
    Ok(())
}

#[napi(js_name = "gameServerLogOff")]
pub fn game_server_log_off() -> Result<(), Error> {
    unsafe { sys::SteamAPI_ISteamGameServer_LogOff(steam_game_server()?) };
    Ok(())
}

#[napi(js_name = "gameServerIsLoggedOn")]
pub fn game_server_is_logged_on() -> Result<bool, Error> {
    Ok(unsafe { sys::SteamAPI_ISteamGameServer_BLoggedOn(steam_game_server()?) })
}

#[napi(js_name = "gameServerInterfaceIsSecure")]
pub fn game_server_interface_is_secure() -> Result<bool, Error> {
    Ok(unsafe { sys::SteamAPI_ISteamGameServer_BSecure(steam_game_server()?) })
}

#[napi(js_name = "gameServerGetInterfaceSteamId")]
pub fn game_server_get_interface_steam_id() -> Result<PlayerSteamId, Error> {
    Ok(steam_id_to_player(unsafe {
        sys::SteamAPI_ISteamGameServer_GetSteamID(steam_game_server()?)
    }))
}

#[napi(js_name = "gameServerWasRestartRequested")]
pub fn game_server_was_restart_requested() -> Result<bool, Error> {
    Ok(unsafe { sys::SteamAPI_ISteamGameServer_WasRestartRequested(steam_game_server()?) })
}

#[napi(js_name = "gameServerSetMaxPlayerCount")]
pub fn game_server_set_max_player_count(players_max: i32) -> Result<(), Error> {
    unsafe { sys::SteamAPI_ISteamGameServer_SetMaxPlayerCount(steam_game_server()?, players_max) };
    Ok(())
}

#[napi(js_name = "gameServerSetBotPlayerCount")]
pub fn game_server_set_bot_player_count(bot_players: i32) -> Result<(), Error> {
    unsafe { sys::SteamAPI_ISteamGameServer_SetBotPlayerCount(steam_game_server()?, bot_players) };
    Ok(())
}

#[napi(js_name = "gameServerSetServerName")]
pub fn game_server_set_server_name(name: String) -> Result<(), Error> {
    let name = cstring(name, "game server name")?;
    unsafe { sys::SteamAPI_ISteamGameServer_SetServerName(steam_game_server()?, name.as_ptr()) };
    Ok(())
}

#[napi(js_name = "gameServerSetMapName")]
pub fn game_server_set_map_name(name: String) -> Result<(), Error> {
    let name = cstring(name, "game server map name")?;
    unsafe { sys::SteamAPI_ISteamGameServer_SetMapName(steam_game_server()?, name.as_ptr()) };
    Ok(())
}

#[napi(js_name = "gameServerSetPasswordProtected")]
pub fn game_server_set_password_protected(password_protected: bool) -> Result<(), Error> {
    unsafe {
        sys::SteamAPI_ISteamGameServer_SetPasswordProtected(
            steam_game_server()?,
            password_protected,
        )
    };
    Ok(())
}

#[napi(js_name = "gameServerSetSpectatorPort")]
pub fn game_server_set_spectator_port(port: u32) -> Result<(), Error> {
    unsafe {
        sys::SteamAPI_ISteamGameServer_SetSpectatorPort(
            steam_game_server()?,
            port_to_u16(port, "game server spectator port")?,
        )
    };
    Ok(())
}

#[napi(js_name = "gameServerSetSpectatorServerName")]
pub fn game_server_set_spectator_server_name(name: String) -> Result<(), Error> {
    let name = cstring(name, "game server spectator server name")?;
    unsafe {
        sys::SteamAPI_ISteamGameServer_SetSpectatorServerName(steam_game_server()?, name.as_ptr())
    };
    Ok(())
}

#[napi(js_name = "gameServerClearAllKeyValues")]
pub fn game_server_clear_all_key_values() -> Result<(), Error> {
    unsafe { sys::SteamAPI_ISteamGameServer_ClearAllKeyValues(steam_game_server()?) };
    Ok(())
}

#[napi(js_name = "gameServerSetKeyValue")]
pub fn game_server_set_key_value(key: String, value: String) -> Result<(), Error> {
    let key = cstring(key, "game server key")?;
    let value = cstring(value, "game server value")?;
    unsafe {
        sys::SteamAPI_ISteamGameServer_SetKeyValue(
            steam_game_server()?,
            key.as_ptr(),
            value.as_ptr(),
        )
    };
    Ok(())
}

#[napi(js_name = "gameServerSetGameTags")]
pub fn game_server_set_game_tags(tags: String) -> Result<(), Error> {
    let tags = cstring(tags, "game server tags")?;
    unsafe { sys::SteamAPI_ISteamGameServer_SetGameTags(steam_game_server()?, tags.as_ptr()) };
    Ok(())
}

#[napi(js_name = "gameServerSetGameData")]
pub fn game_server_set_game_data(data: String) -> Result<(), Error> {
    let data = cstring(data, "game server data")?;
    unsafe { sys::SteamAPI_ISteamGameServer_SetGameData(steam_game_server()?, data.as_ptr()) };
    Ok(())
}

#[napi(js_name = "gameServerSetRegion")]
pub fn game_server_set_region(region: String) -> Result<(), Error> {
    let region = cstring(region, "game server region")?;
    unsafe { sys::SteamAPI_ISteamGameServer_SetRegion(steam_game_server()?, region.as_ptr()) };
    Ok(())
}

#[napi(js_name = "gameServerSetAdvertiseServerActive")]
pub fn game_server_set_advertise_server_active(active: bool) -> Result<(), Error> {
    unsafe {
        sys::SteamAPI_ISteamGameServer_SetAdvertiseServerActive(steam_game_server()?, active)
    };
    Ok(())
}

#[napi(js_name = "gameServerGetAuthSessionTicket")]
pub fn game_server_get_auth_session_ticket(
    identity: Option<NetworkingIdentity>,
    max_bytes: Option<u32>,
) -> Result<GameServerAuthTicket, Error> {
    let identity = identity.map(networking_identity_from_input).transpose()?;
    let identity_ptr = identity
        .as_ref()
        .map_or(ptr::null(), |identity| identity as *const _);
    let size = max_bytes.unwrap_or(4096).clamp(1, 65_536);
    let mut data = vec![0u8; size as usize];
    let mut data_len = 0u32;
    let handle = unsafe {
        sys::SteamAPI_ISteamGameServer_GetAuthSessionTicket(
            steam_game_server()?,
            data.as_mut_ptr().cast::<c_void>(),
            len_to_i32(data.len(), "game server auth ticket")?,
            &mut data_len,
            identity_ptr,
        )
    };
    if handle == H_AUTH_TICKET_INVALID {
        return Err(Error::from_reason(
            "Steam returned an invalid game server auth ticket handle",
        ));
    }
    data.truncate((data_len as usize).min(data.len()));
    Ok(GameServerAuthTicket {
        data: data.into(),
        handle,
    })
}

#[napi(js_name = "gameServerBeginAuthSession")]
pub fn game_server_begin_auth_session(ticket: Buffer, steam_id64: BigInt) -> Result<u32, Error> {
    Ok(unsafe {
        sys::SteamAPI_ISteamGameServer_BeginAuthSession(
            steam_game_server()?,
            ticket.as_ptr().cast::<c_void>(),
            len_to_i32(ticket.len(), "game server auth session ticket")?,
            bigint_to_u64(steam_id64, "steam id")?,
        )
    } as u32)
}

#[napi(js_name = "gameServerEndAuthSession")]
pub fn game_server_end_auth_session(steam_id64: BigInt) -> Result<(), Error> {
    unsafe {
        sys::SteamAPI_ISteamGameServer_EndAuthSession(
            steam_game_server()?,
            bigint_to_u64(steam_id64, "steam id")?,
        )
    };
    Ok(())
}

#[napi(js_name = "gameServerCancelAuthTicket")]
pub fn game_server_cancel_auth_ticket(auth_ticket: u32) -> Result<(), Error> {
    unsafe { sys::SteamAPI_ISteamGameServer_CancelAuthTicket(steam_game_server()?, auth_ticket) };
    Ok(())
}

#[napi(js_name = "gameServerUserHasLicenseForApp")]
pub fn game_server_user_has_license_for_app(steam_id64: BigInt, app_id: u32) -> Result<u32, Error> {
    Ok(unsafe {
        sys::SteamAPI_ISteamGameServer_UserHasLicenseForApp(
            steam_game_server()?,
            bigint_to_u64(steam_id64, "steam id")?,
            app_id,
        )
    } as u32)
}

#[napi(js_name = "gameServerRequestUserGroupStatus")]
pub fn game_server_request_user_group_status(
    steam_id64: BigInt,
    group_id64: BigInt,
) -> Result<bool, Error> {
    Ok(unsafe {
        sys::SteamAPI_ISteamGameServer_RequestUserGroupStatus(
            steam_game_server()?,
            bigint_to_u64(steam_id64, "steam id")?,
            bigint_to_u64(group_id64, "group id")?,
        )
    })
}

#[napi(js_name = "gameServerGetGameplayStats")]
pub fn game_server_get_gameplay_stats() -> Result<(), Error> {
    unsafe { sys::SteamAPI_ISteamGameServer_GetGameplayStats(steam_game_server()?) };
    Ok(())
}

#[napi(js_name = "gameServerGetServerReputation")]
pub async fn game_server_get_server_reputation() -> Result<GameServerReputationResult, Error> {
    let call = unsafe { sys::SteamAPI_ISteamGameServer_GetServerReputation(steam_game_server()?) };
    let result: sys::GSReputation_t = wait_for_game_server_api_call(
        call,
        sys::GSReputation_t_k_iCallback as i32,
        DEFAULT_ASYNC_TIMEOUT_SECONDS,
    )
    .await?;
    Ok(game_server_reputation_result(result))
}

#[napi(js_name = "gameServerAssociateWithClan")]
pub async fn game_server_associate_with_clan(
    clan_id64: BigInt,
) -> Result<GameServerAssociateWithClanResult, Error> {
    let call = unsafe {
        sys::SteamAPI_ISteamGameServer_AssociateWithClan(
            steam_game_server()?,
            bigint_to_u64(clan_id64, "clan id")?,
        )
    };
    let result: sys::AssociateWithClanResult_t = wait_for_game_server_api_call(
        call,
        sys::AssociateWithClanResult_t_k_iCallback as i32,
        DEFAULT_ASYNC_TIMEOUT_SECONDS,
    )
    .await?;
    Ok(game_server_associate_with_clan_result(result))
}

#[napi(js_name = "gameServerComputeNewPlayerCompatibility")]
pub async fn game_server_compute_new_player_compatibility(
    steam_id64: BigInt,
) -> Result<GameServerPlayerCompatibilityResult, Error> {
    let call = unsafe {
        sys::SteamAPI_ISteamGameServer_ComputeNewPlayerCompatibility(
            steam_game_server()?,
            bigint_to_u64(steam_id64, "steam id")?,
        )
    };
    let result: sys::ComputeNewPlayerCompatibilityResult_t = wait_for_game_server_api_call(
        call,
        sys::ComputeNewPlayerCompatibilityResult_t_k_iCallback as i32,
        DEFAULT_ASYNC_TIMEOUT_SECONDS,
    )
    .await?;
    Ok(game_server_player_compatibility_result(result))
}

#[napi(js_name = "gameServerGetPublicIp")]
pub fn game_server_get_public_ip() -> Result<GameServerPublicIp, Error> {
    let mut address = unsafe { sys::SteamAPI_ISteamGameServer_GetPublicIP(steam_game_server()?) };
    Ok(game_server_public_ip(&mut address))
}

#[napi(js_name = "gameServerHandleIncomingPacket")]
pub fn game_server_handle_incoming_packet(
    data: Buffer,
    src_ip: u32,
    src_port: u32,
) -> Result<bool, Error> {
    Ok(unsafe {
        sys::SteamAPI_ISteamGameServer_HandleIncomingPacket(
            steam_game_server()?,
            data.as_ptr().cast::<c_void>(),
            len_to_i32(data.len(), "game server incoming packet")?,
            src_ip,
            port_to_u16(src_port, "game server incoming packet source port")?,
        )
    })
}

#[napi(js_name = "gameServerGetNextOutgoingPacket")]
pub fn game_server_get_next_outgoing_packet(
    max_bytes: Option<u32>,
) -> Result<Option<GameServerOutgoingPacket>, Error> {
    let size = max_bytes.unwrap_or(2048).clamp(1, 65_536);
    let mut data = vec![0u8; size as usize];
    let mut ip = 0u32;
    let mut port = 0u16;
    let packet_size = unsafe {
        sys::SteamAPI_ISteamGameServer_GetNextOutgoingPacket(
            steam_game_server()?,
            data.as_mut_ptr().cast::<c_void>(),
            len_to_i32(data.len(), "game server outgoing packet")?,
            &mut ip,
            &mut port,
        )
    };
    if packet_size <= 0 {
        return Ok(None);
    }
    data.truncate((packet_size as usize).min(data.len()));
    Ok(Some(GameServerOutgoingPacket {
        data: data.into(),
        ip,
        ip_address: ipv4_to_string(ip),
        port: u32::from(port),
    }))
}

#[napi(js_name = "gameServerSendUserConnectAndAuthenticateDeprecated")]
pub fn game_server_send_user_connect_and_authenticate_deprecated(
    client_ip: u32,
    auth_blob: Buffer,
) -> Result<GameServerUserConnectResult, Error> {
    let mut steam_id = unsafe { MaybeUninit::<sys::CSteamID>::zeroed().assume_init() };
    let success = unsafe {
        sys::SteamAPI_ISteamGameServer_SendUserConnectAndAuthenticate_DEPRECATED(
            steam_game_server()?,
            client_ip,
            auth_blob.as_ptr().cast::<c_void>(),
            len_to_u32(auth_blob.len(), "game server user auth blob")?,
            &mut steam_id,
        )
    };
    let steam_id = success.then(|| unsafe {
        steam_id_to_player(ptr::addr_of!(steam_id.m_steamid.m_unAll64Bits).read_unaligned())
    });
    Ok(GameServerUserConnectResult { success, steam_id })
}

#[napi(js_name = "gameServerCreateUnauthenticatedUserConnection")]
pub fn game_server_create_unauthenticated_user_connection() -> Result<PlayerSteamId, Error> {
    Ok(steam_id_to_player(unsafe {
        sys::SteamAPI_ISteamGameServer_CreateUnauthenticatedUserConnection(steam_game_server()?)
    }))
}

#[napi(js_name = "gameServerSendUserDisconnectDeprecated")]
pub fn game_server_send_user_disconnect_deprecated(steam_id64: BigInt) -> Result<(), Error> {
    unsafe {
        sys::SteamAPI_ISteamGameServer_SendUserDisconnect_DEPRECATED(
            steam_game_server()?,
            bigint_to_u64(steam_id64, "steam id")?,
        )
    };
    Ok(())
}

#[napi(js_name = "gameServerUpdateUserData")]
pub fn game_server_update_user_data(
    steam_id64: BigInt,
    player_name: String,
    score: u32,
) -> Result<bool, Error> {
    let player_name = cstring(player_name, "game server player name")?;
    Ok(unsafe {
        sys::SteamAPI_ISteamGameServer_BUpdateUserData(
            steam_game_server()?,
            bigint_to_u64(steam_id64, "steam id")?,
            player_name.as_ptr(),
            score,
        )
    })
}

#[napi(js_name = "gameServerStatsRequestUserStats")]
pub async fn game_server_stats_request_user_stats(
    steam_id64: BigInt,
) -> Result<GameServerStatsResult, Error> {
    let call = unsafe {
        sys::SteamAPI_ISteamGameServerStats_RequestUserStats(
            steam_game_server_stats()?,
            bigint_to_u64(steam_id64, "steam id")?,
        )
    };
    let result: sys::GSStatsReceived_t = wait_for_game_server_api_call(
        call,
        sys::GSStatsReceived_t_k_iCallback as i32,
        DEFAULT_ASYNC_TIMEOUT_SECONDS,
    )
    .await?;
    Ok(game_server_stats_received_result(result))
}

#[napi(js_name = "gameServerStatsGetUserInt")]
pub fn game_server_stats_get_user_int(
    steam_id64: BigInt,
    name: String,
) -> Result<Option<i32>, Error> {
    let name = cstring(name, "game server stat name")?;
    let mut value = 0i32;
    let ok = unsafe {
        sys::SteamAPI_ISteamGameServerStats_GetUserStatInt32(
            steam_game_server_stats()?,
            bigint_to_u64(steam_id64, "steam id")?,
            name.as_ptr(),
            &mut value,
        )
    };
    Ok(if ok { Some(value) } else { None })
}

#[napi(js_name = "gameServerStatsGetUserFloat")]
pub fn game_server_stats_get_user_float(
    steam_id64: BigInt,
    name: String,
) -> Result<Option<f64>, Error> {
    let name = cstring(name, "game server stat name")?;
    let mut value = 0f32;
    let ok = unsafe {
        sys::SteamAPI_ISteamGameServerStats_GetUserStatFloat(
            steam_game_server_stats()?,
            bigint_to_u64(steam_id64, "steam id")?,
            name.as_ptr(),
            &mut value,
        )
    };
    Ok(if ok { Some(f64::from(value)) } else { None })
}

#[napi(js_name = "gameServerStatsGetUserAchievement")]
pub fn game_server_stats_get_user_achievement(
    steam_id64: BigInt,
    name: String,
) -> Result<Option<bool>, Error> {
    let name = cstring(name, "game server achievement name")?;
    let mut achieved = false;
    let ok = unsafe {
        sys::SteamAPI_ISteamGameServerStats_GetUserAchievement(
            steam_game_server_stats()?,
            bigint_to_u64(steam_id64, "steam id")?,
            name.as_ptr(),
            &mut achieved,
        )
    };
    Ok(if ok { Some(achieved) } else { None })
}

#[napi(js_name = "gameServerStatsSetUserInt")]
pub fn game_server_stats_set_user_int(
    steam_id64: BigInt,
    name: String,
    value: i32,
) -> Result<bool, Error> {
    let name = cstring(name, "game server stat name")?;
    Ok(unsafe {
        sys::SteamAPI_ISteamGameServerStats_SetUserStatInt32(
            steam_game_server_stats()?,
            bigint_to_u64(steam_id64, "steam id")?,
            name.as_ptr(),
            value,
        )
    })
}

#[napi(js_name = "gameServerStatsSetUserFloat")]
pub fn game_server_stats_set_user_float(
    steam_id64: BigInt,
    name: String,
    value: f64,
) -> Result<bool, Error> {
    if !value.is_finite() {
        return Err(Error::from_reason(
            "game server stat float value must be finite",
        ));
    }
    let name = cstring(name, "game server stat name")?;
    Ok(unsafe {
        sys::SteamAPI_ISteamGameServerStats_SetUserStatFloat(
            steam_game_server_stats()?,
            bigint_to_u64(steam_id64, "steam id")?,
            name.as_ptr(),
            value as f32,
        )
    })
}

#[napi(js_name = "gameServerStatsUpdateUserAvgRate")]
pub fn game_server_stats_update_user_avg_rate(
    steam_id64: BigInt,
    name: String,
    count_this_session: f64,
    session_length: f64,
) -> Result<bool, Error> {
    if !count_this_session.is_finite() || !session_length.is_finite() {
        return Err(Error::from_reason(
            "game server average-rate stat count and session length must be finite",
        ));
    }
    let name = cstring(name, "game server stat name")?;
    Ok(unsafe {
        sys::SteamAPI_ISteamGameServerStats_UpdateUserAvgRateStat(
            steam_game_server_stats()?,
            bigint_to_u64(steam_id64, "steam id")?,
            name.as_ptr(),
            count_this_session as f32,
            session_length,
        )
    })
}

#[napi(js_name = "gameServerStatsSetUserAchievement")]
pub fn game_server_stats_set_user_achievement(
    steam_id64: BigInt,
    name: String,
) -> Result<bool, Error> {
    let name = cstring(name, "game server achievement name")?;
    Ok(unsafe {
        sys::SteamAPI_ISteamGameServerStats_SetUserAchievement(
            steam_game_server_stats()?,
            bigint_to_u64(steam_id64, "steam id")?,
            name.as_ptr(),
        )
    })
}

#[napi(js_name = "gameServerStatsClearUserAchievement")]
pub fn game_server_stats_clear_user_achievement(
    steam_id64: BigInt,
    name: String,
) -> Result<bool, Error> {
    let name = cstring(name, "game server achievement name")?;
    Ok(unsafe {
        sys::SteamAPI_ISteamGameServerStats_ClearUserAchievement(
            steam_game_server_stats()?,
            bigint_to_u64(steam_id64, "steam id")?,
            name.as_ptr(),
        )
    })
}

#[napi(js_name = "gameServerStatsStoreUserStats")]
pub async fn game_server_stats_store_user_stats(
    steam_id64: BigInt,
) -> Result<GameServerStatsResult, Error> {
    let call = unsafe {
        sys::SteamAPI_ISteamGameServerStats_StoreUserStats(
            steam_game_server_stats()?,
            bigint_to_u64(steam_id64, "steam id")?,
        )
    };
    let result: sys::GSStatsStored_t = wait_for_game_server_api_call(
        call,
        sys::GSStatsStored_t_k_iCallback as i32,
        DEFAULT_ASYNC_TIMEOUT_SECONDS,
    )
    .await?;
    Ok(game_server_stats_stored_result(result))
}

type SteamNetworkingAccessor = fn() -> Result<*mut sys::ISteamNetworking, Error>;

fn networking_send_p2p_packet_with(
    accessor: SteamNetworkingAccessor,
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
            accessor()?,
            bigint_to_u64(steam_id64, "steam id")?,
            data.as_ptr().cast::<c_void>(),
            len_to_u32(data.len(), "P2P packet data")?,
            send_type,
            0,
        )
    })
}

fn networking_is_p2p_packet_available_with(
    accessor: SteamNetworkingAccessor,
) -> Result<u32, Error> {
    let mut size = 0u32;
    let ok =
        unsafe { sys::SteamAPI_ISteamNetworking_IsP2PPacketAvailable(accessor()?, &mut size, 0) };
    Ok(if ok { size } else { 0 })
}

fn networking_read_p2p_packet_with(
    accessor: SteamNetworkingAccessor,
    size: u32,
) -> Result<Option<P2PPacket>, Error> {
    let networking = accessor()?;
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

fn networking_accept_p2p_session_with(
    accessor: SteamNetworkingAccessor,
    steam_id64: BigInt,
) -> Result<(), Error> {
    let ok = unsafe {
        sys::SteamAPI_ISteamNetworking_AcceptP2PSessionWithUser(
            accessor()?,
            bigint_to_u64(steam_id64, "steam id")?,
        )
    };
    if ok {
        Ok(())
    } else {
        Err(Error::from_reason("Steam rejected P2P session"))
    }
}

fn networking_close_p2p_session_with(
    accessor: SteamNetworkingAccessor,
    steam_id64: BigInt,
) -> Result<bool, Error> {
    Ok(unsafe {
        sys::SteamAPI_ISteamNetworking_CloseP2PSessionWithUser(
            accessor()?,
            bigint_to_u64(steam_id64, "steam id")?,
        )
    })
}

fn networking_close_p2p_channel_with(
    accessor: SteamNetworkingAccessor,
    steam_id64: BigInt,
    channel: i32,
) -> Result<bool, Error> {
    Ok(unsafe {
        sys::SteamAPI_ISteamNetworking_CloseP2PChannelWithUser(
            accessor()?,
            bigint_to_u64(steam_id64, "steam id")?,
            channel,
        )
    })
}

fn networking_get_p2p_session_state_with(
    accessor: SteamNetworkingAccessor,
    steam_id64: BigInt,
) -> Result<Option<LegacyNetworkingP2PSessionState>, Error> {
    let mut state = unsafe { MaybeUninit::<sys::P2PSessionState_t>::zeroed().assume_init() };
    let ok = unsafe {
        sys::SteamAPI_ISteamNetworking_GetP2PSessionState(
            accessor()?,
            bigint_to_u64(steam_id64, "steam id")?,
            &mut state,
        )
    };
    Ok(ok.then(|| LegacyNetworkingP2PSessionState {
        connection_active: state.m_bConnectionActive != 0,
        connecting: state.m_bConnecting != 0,
        session_error: u32::from(state.m_eP2PSessionError),
        using_relay: state.m_bUsingRelay != 0,
        bytes_queued_for_send: state.m_nBytesQueuedForSend,
        packets_queued_for_send: state.m_nPacketsQueuedForSend,
        remote_ip: state.m_nRemoteIP,
        remote_ip_address: ipv4_to_string(state.m_nRemoteIP),
        remote_port: u32::from(state.m_nRemotePort),
    }))
}

fn networking_allow_p2p_packet_relay_with(
    accessor: SteamNetworkingAccessor,
    allow: bool,
) -> Result<bool, Error> {
    Ok(unsafe { sys::SteamAPI_ISteamNetworking_AllowP2PPacketRelay(accessor()?, allow) })
}

fn networking_create_listen_socket_with(
    accessor: SteamNetworkingAccessor,
    virtual_p2p_port: Option<i32>,
    ip: Option<u32>,
    port: Option<u32>,
    allow_packet_relay: Option<bool>,
) -> Result<u32, Error> {
    Ok(unsafe {
        sys::SteamAPI_ISteamNetworking_CreateListenSocket(
            accessor()?,
            virtual_p2p_port.unwrap_or(0),
            legacy_networking_steam_ip(ip.unwrap_or(0)),
            port_to_u16(port.unwrap_or(0), "legacy networking listen port")?,
            allow_packet_relay.unwrap_or(true),
        )
    })
}

fn networking_create_p2p_connection_socket_with(
    accessor: SteamNetworkingAccessor,
    steam_id64: BigInt,
    virtual_port: Option<i32>,
    timeout_seconds: Option<i32>,
    allow_packet_relay: Option<bool>,
) -> Result<u32, Error> {
    Ok(unsafe {
        sys::SteamAPI_ISteamNetworking_CreateP2PConnectionSocket(
            accessor()?,
            bigint_to_u64(steam_id64, "steam id")?,
            virtual_port.unwrap_or(0),
            timeout_seconds.unwrap_or(0),
            allow_packet_relay.unwrap_or(true),
        )
    })
}

fn networking_create_connection_socket_with(
    accessor: SteamNetworkingAccessor,
    ip: u32,
    port: u32,
    timeout_seconds: Option<i32>,
) -> Result<u32, Error> {
    Ok(unsafe {
        sys::SteamAPI_ISteamNetworking_CreateConnectionSocket(
            accessor()?,
            legacy_networking_steam_ip(ip),
            port_to_u16(port, "legacy networking connection port")?,
            timeout_seconds.unwrap_or(0),
        )
    })
}

fn networking_destroy_socket_with(
    accessor: SteamNetworkingAccessor,
    socket: u32,
    notify_remote_end: Option<bool>,
) -> Result<bool, Error> {
    Ok(unsafe {
        sys::SteamAPI_ISteamNetworking_DestroySocket(
            accessor()?,
            socket,
            notify_remote_end.unwrap_or(false),
        )
    })
}

fn networking_destroy_listen_socket_with(
    accessor: SteamNetworkingAccessor,
    socket: u32,
    notify_remote_end: Option<bool>,
) -> Result<bool, Error> {
    Ok(unsafe {
        sys::SteamAPI_ISteamNetworking_DestroyListenSocket(
            accessor()?,
            socket,
            notify_remote_end.unwrap_or(false),
        )
    })
}

fn networking_send_data_on_socket_with(
    accessor: SteamNetworkingAccessor,
    socket: u32,
    data: Buffer,
    reliable: Option<bool>,
) -> Result<bool, Error> {
    Ok(unsafe {
        sys::SteamAPI_ISteamNetworking_SendDataOnSocket(
            accessor()?,
            socket,
            data.as_ptr() as *mut c_void,
            len_to_u32(data.len(), "legacy networking socket data")?,
            reliable.unwrap_or(true),
        )
    })
}

fn networking_is_data_available_on_socket_with(
    accessor: SteamNetworkingAccessor,
    socket: u32,
) -> Result<u32, Error> {
    let mut size = 0u32;
    let ok = unsafe {
        sys::SteamAPI_ISteamNetworking_IsDataAvailableOnSocket(accessor()?, socket, &mut size)
    };
    Ok(if ok { size } else { 0 })
}

fn networking_retrieve_data_from_socket_with(
    accessor: SteamNetworkingAccessor,
    socket: u32,
    size: u32,
) -> Result<Option<LegacyNetworkingSocketData>, Error> {
    let mut data = vec![0u8; size as usize];
    let mut actual_size = 0u32;
    let ok = unsafe {
        sys::SteamAPI_ISteamNetworking_RetrieveDataFromSocket(
            accessor()?,
            socket,
            data.as_mut_ptr().cast::<c_void>(),
            size,
            &mut actual_size,
        )
    };
    if !ok {
        return Ok(None);
    }
    data.truncate((actual_size as usize).min(data.len()));
    Ok(Some(LegacyNetworkingSocketData {
        data: data.into(),
        size: actual_size,
    }))
}

fn networking_is_data_available_with(
    accessor: SteamNetworkingAccessor,
    listen_socket: u32,
) -> Result<Option<LegacyNetworkingListenSocketAvailable>, Error> {
    let mut size = 0u32;
    let mut socket = 0u32;
    let ok = unsafe {
        sys::SteamAPI_ISteamNetworking_IsDataAvailable(
            accessor()?,
            listen_socket,
            &mut size,
            &mut socket,
        )
    };
    Ok(ok.then_some(LegacyNetworkingListenSocketAvailable { socket, size }))
}

fn networking_retrieve_data_with(
    accessor: SteamNetworkingAccessor,
    listen_socket: u32,
    size: u32,
) -> Result<Option<LegacyNetworkingListenSocketData>, Error> {
    let mut data = vec![0u8; size as usize];
    let mut actual_size = 0u32;
    let mut socket = 0u32;
    let ok = unsafe {
        sys::SteamAPI_ISteamNetworking_RetrieveData(
            accessor()?,
            listen_socket,
            data.as_mut_ptr().cast::<c_void>(),
            size,
            &mut actual_size,
            &mut socket,
        )
    };
    if !ok {
        return Ok(None);
    }
    data.truncate((actual_size as usize).min(data.len()));
    Ok(Some(LegacyNetworkingListenSocketData {
        socket,
        data: data.into(),
        size: actual_size,
    }))
}

fn networking_get_socket_info_with(
    accessor: SteamNetworkingAccessor,
    socket: u32,
) -> Result<Option<LegacyNetworkingSocketInfo>, Error> {
    let mut remote = unsafe { MaybeUninit::<sys::CSteamID>::zeroed().assume_init() };
    let mut socket_status = 0i32;
    let mut remote_ip = unsafe { MaybeUninit::<sys::SteamIPAddress_t>::zeroed().assume_init() };
    let mut remote_port = 0u16;
    let ok = unsafe {
        sys::SteamAPI_ISteamNetworking_GetSocketInfo(
            accessor()?,
            socket,
            &mut remote,
            &mut socket_status,
            &mut remote_ip,
            &mut remote_port,
        )
    };
    let (remote_ip, remote_ip_address) = legacy_networking_ip_parts(remote_ip);
    Ok(ok.then(|| LegacyNetworkingSocketInfo {
        remote_steam_id: csteam_id_to_player(remote),
        socket_status,
        remote_ip,
        remote_ip_address,
        remote_port: u32::from(remote_port),
    }))
}

fn networking_get_listen_socket_info_with(
    accessor: SteamNetworkingAccessor,
    listen_socket: u32,
) -> Result<Option<LegacyNetworkingListenSocketInfo>, Error> {
    let mut ip = unsafe { MaybeUninit::<sys::SteamIPAddress_t>::zeroed().assume_init() };
    let mut port = 0u16;
    let ok = unsafe {
        sys::SteamAPI_ISteamNetworking_GetListenSocketInfo(
            accessor()?,
            listen_socket,
            &mut ip,
            &mut port,
        )
    };
    let (ip, ip_address) = legacy_networking_ip_parts(ip);
    Ok(ok.then(|| LegacyNetworkingListenSocketInfo {
        ip,
        ip_address,
        port: u32::from(port),
    }))
}

fn networking_get_socket_connection_type_with(
    accessor: SteamNetworkingAccessor,
    socket: u32,
) -> Result<u32, Error> {
    Ok(unsafe {
        sys::SteamAPI_ISteamNetworking_GetSocketConnectionType(accessor()?, socket) as u32
    })
}

fn networking_get_max_packet_size_with(
    accessor: SteamNetworkingAccessor,
    socket: u32,
) -> Result<i32, Error> {
    Ok(unsafe { sys::SteamAPI_ISteamNetworking_GetMaxPacketSize(accessor()?, socket) })
}

#[napi(js_name = "networkingSendP2PPacket")]
pub fn networking_send_p2p_packet(
    steam_id64: BigInt,
    send_type: u32,
    data: Buffer,
) -> Result<bool, Error> {
    networking_send_p2p_packet_with(steam_networking, steam_id64, send_type, data)
}

#[napi(js_name = "networkingIsP2PPacketAvailable")]
pub fn networking_is_p2p_packet_available() -> Result<u32, Error> {
    networking_is_p2p_packet_available_with(steam_networking)
}

#[napi(js_name = "networkingReadP2PPacket")]
pub fn networking_read_p2p_packet(size: u32) -> Result<Option<P2PPacket>, Error> {
    networking_read_p2p_packet_with(steam_networking, size)
}

#[napi(js_name = "networkingAcceptP2PSession")]
pub fn networking_accept_p2p_session(steam_id64: BigInt) -> Result<(), Error> {
    networking_accept_p2p_session_with(steam_networking, steam_id64)
}

#[napi(js_name = "networkingCloseP2PSession")]
pub fn networking_close_p2p_session(steam_id64: BigInt) -> Result<bool, Error> {
    networking_close_p2p_session_with(steam_networking, steam_id64)
}

#[napi(js_name = "networkingCloseP2PChannel")]
pub fn networking_close_p2p_channel(steam_id64: BigInt, channel: i32) -> Result<bool, Error> {
    networking_close_p2p_channel_with(steam_networking, steam_id64, channel)
}

#[napi(js_name = "networkingGetP2PSessionState")]
pub fn networking_get_p2p_session_state(
    steam_id64: BigInt,
) -> Result<Option<LegacyNetworkingP2PSessionState>, Error> {
    networking_get_p2p_session_state_with(steam_networking, steam_id64)
}

#[napi(js_name = "networkingAllowP2PPacketRelay")]
pub fn networking_allow_p2p_packet_relay(allow: bool) -> Result<bool, Error> {
    networking_allow_p2p_packet_relay_with(steam_networking, allow)
}

#[napi(js_name = "networkingCreateListenSocket")]
pub fn networking_create_listen_socket(
    virtual_p2p_port: Option<i32>,
    ip: Option<u32>,
    port: Option<u32>,
    allow_packet_relay: Option<bool>,
) -> Result<u32, Error> {
    networking_create_listen_socket_with(
        steam_networking,
        virtual_p2p_port,
        ip,
        port,
        allow_packet_relay,
    )
}

#[napi(js_name = "networkingCreateP2PConnectionSocket")]
pub fn networking_create_p2p_connection_socket(
    steam_id64: BigInt,
    virtual_port: Option<i32>,
    timeout_seconds: Option<i32>,
    allow_packet_relay: Option<bool>,
) -> Result<u32, Error> {
    networking_create_p2p_connection_socket_with(
        steam_networking,
        steam_id64,
        virtual_port,
        timeout_seconds,
        allow_packet_relay,
    )
}

#[napi(js_name = "networkingCreateConnectionSocket")]
pub fn networking_create_connection_socket(
    ip: u32,
    port: u32,
    timeout_seconds: Option<i32>,
) -> Result<u32, Error> {
    networking_create_connection_socket_with(steam_networking, ip, port, timeout_seconds)
}

#[napi(js_name = "networkingDestroySocket")]
pub fn networking_destroy_socket(
    socket: u32,
    notify_remote_end: Option<bool>,
) -> Result<bool, Error> {
    networking_destroy_socket_with(steam_networking, socket, notify_remote_end)
}

#[napi(js_name = "networkingDestroyListenSocket")]
pub fn networking_destroy_listen_socket(
    socket: u32,
    notify_remote_end: Option<bool>,
) -> Result<bool, Error> {
    networking_destroy_listen_socket_with(steam_networking, socket, notify_remote_end)
}

#[napi(js_name = "networkingSendDataOnSocket")]
pub fn networking_send_data_on_socket(
    socket: u32,
    data: Buffer,
    reliable: Option<bool>,
) -> Result<bool, Error> {
    networking_send_data_on_socket_with(steam_networking, socket, data, reliable)
}

#[napi(js_name = "networkingIsDataAvailableOnSocket")]
pub fn networking_is_data_available_on_socket(socket: u32) -> Result<u32, Error> {
    networking_is_data_available_on_socket_with(steam_networking, socket)
}

#[napi(js_name = "networkingRetrieveDataFromSocket")]
pub fn networking_retrieve_data_from_socket(
    socket: u32,
    size: u32,
) -> Result<Option<LegacyNetworkingSocketData>, Error> {
    networking_retrieve_data_from_socket_with(steam_networking, socket, size)
}

#[napi(js_name = "networkingIsDataAvailable")]
pub fn networking_is_data_available(
    listen_socket: u32,
) -> Result<Option<LegacyNetworkingListenSocketAvailable>, Error> {
    networking_is_data_available_with(steam_networking, listen_socket)
}

#[napi(js_name = "networkingRetrieveData")]
pub fn networking_retrieve_data(
    listen_socket: u32,
    size: u32,
) -> Result<Option<LegacyNetworkingListenSocketData>, Error> {
    networking_retrieve_data_with(steam_networking, listen_socket, size)
}

#[napi(js_name = "networkingGetSocketInfo")]
pub fn networking_get_socket_info(
    socket: u32,
) -> Result<Option<LegacyNetworkingSocketInfo>, Error> {
    networking_get_socket_info_with(steam_networking, socket)
}

#[napi(js_name = "networkingGetListenSocketInfo")]
pub fn networking_get_listen_socket_info(
    listen_socket: u32,
) -> Result<Option<LegacyNetworkingListenSocketInfo>, Error> {
    networking_get_listen_socket_info_with(steam_networking, listen_socket)
}

#[napi(js_name = "networkingGetSocketConnectionType")]
pub fn networking_get_socket_connection_type(socket: u32) -> Result<u32, Error> {
    networking_get_socket_connection_type_with(steam_networking, socket)
}

#[napi(js_name = "networkingGetMaxPacketSize")]
pub fn networking_get_max_packet_size(socket: u32) -> Result<i32, Error> {
    networking_get_max_packet_size_with(steam_networking, socket)
}

#[napi(js_name = "gameServerNetworkingSendP2PPacket")]
pub fn game_server_networking_send_p2p_packet(
    steam_id64: BigInt,
    send_type: u32,
    data: Buffer,
) -> Result<bool, Error> {
    networking_send_p2p_packet_with(steam_game_server_networking, steam_id64, send_type, data)
}

#[napi(js_name = "gameServerNetworkingIsP2PPacketAvailable")]
pub fn game_server_networking_is_p2p_packet_available() -> Result<u32, Error> {
    networking_is_p2p_packet_available_with(steam_game_server_networking)
}

#[napi(js_name = "gameServerNetworkingReadP2PPacket")]
pub fn game_server_networking_read_p2p_packet(size: u32) -> Result<Option<P2PPacket>, Error> {
    networking_read_p2p_packet_with(steam_game_server_networking, size)
}

#[napi(js_name = "gameServerNetworkingAcceptP2PSession")]
pub fn game_server_networking_accept_p2p_session(steam_id64: BigInt) -> Result<(), Error> {
    networking_accept_p2p_session_with(steam_game_server_networking, steam_id64)
}

#[napi(js_name = "gameServerNetworkingCloseP2PSession")]
pub fn game_server_networking_close_p2p_session(steam_id64: BigInt) -> Result<bool, Error> {
    networking_close_p2p_session_with(steam_game_server_networking, steam_id64)
}

#[napi(js_name = "gameServerNetworkingCloseP2PChannel")]
pub fn game_server_networking_close_p2p_channel(
    steam_id64: BigInt,
    channel: i32,
) -> Result<bool, Error> {
    networking_close_p2p_channel_with(steam_game_server_networking, steam_id64, channel)
}

#[napi(js_name = "gameServerNetworkingGetP2PSessionState")]
pub fn game_server_networking_get_p2p_session_state(
    steam_id64: BigInt,
) -> Result<Option<LegacyNetworkingP2PSessionState>, Error> {
    networking_get_p2p_session_state_with(steam_game_server_networking, steam_id64)
}

#[napi(js_name = "gameServerNetworkingAllowP2PPacketRelay")]
pub fn game_server_networking_allow_p2p_packet_relay(allow: bool) -> Result<bool, Error> {
    networking_allow_p2p_packet_relay_with(steam_game_server_networking, allow)
}

#[napi(js_name = "gameServerNetworkingCreateListenSocket")]
pub fn game_server_networking_create_listen_socket(
    virtual_p2p_port: Option<i32>,
    ip: Option<u32>,
    port: Option<u32>,
    allow_packet_relay: Option<bool>,
) -> Result<u32, Error> {
    networking_create_listen_socket_with(
        steam_game_server_networking,
        virtual_p2p_port,
        ip,
        port,
        allow_packet_relay,
    )
}

#[napi(js_name = "gameServerNetworkingCreateP2PConnectionSocket")]
pub fn game_server_networking_create_p2p_connection_socket(
    steam_id64: BigInt,
    virtual_port: Option<i32>,
    timeout_seconds: Option<i32>,
    allow_packet_relay: Option<bool>,
) -> Result<u32, Error> {
    networking_create_p2p_connection_socket_with(
        steam_game_server_networking,
        steam_id64,
        virtual_port,
        timeout_seconds,
        allow_packet_relay,
    )
}

#[napi(js_name = "gameServerNetworkingCreateConnectionSocket")]
pub fn game_server_networking_create_connection_socket(
    ip: u32,
    port: u32,
    timeout_seconds: Option<i32>,
) -> Result<u32, Error> {
    networking_create_connection_socket_with(
        steam_game_server_networking,
        ip,
        port,
        timeout_seconds,
    )
}

#[napi(js_name = "gameServerNetworkingDestroySocket")]
pub fn game_server_networking_destroy_socket(
    socket: u32,
    notify_remote_end: Option<bool>,
) -> Result<bool, Error> {
    networking_destroy_socket_with(steam_game_server_networking, socket, notify_remote_end)
}

#[napi(js_name = "gameServerNetworkingDestroyListenSocket")]
pub fn game_server_networking_destroy_listen_socket(
    socket: u32,
    notify_remote_end: Option<bool>,
) -> Result<bool, Error> {
    networking_destroy_listen_socket_with(steam_game_server_networking, socket, notify_remote_end)
}

#[napi(js_name = "gameServerNetworkingSendDataOnSocket")]
pub fn game_server_networking_send_data_on_socket(
    socket: u32,
    data: Buffer,
    reliable: Option<bool>,
) -> Result<bool, Error> {
    networking_send_data_on_socket_with(steam_game_server_networking, socket, data, reliable)
}

#[napi(js_name = "gameServerNetworkingIsDataAvailableOnSocket")]
pub fn game_server_networking_is_data_available_on_socket(socket: u32) -> Result<u32, Error> {
    networking_is_data_available_on_socket_with(steam_game_server_networking, socket)
}

#[napi(js_name = "gameServerNetworkingRetrieveDataFromSocket")]
pub fn game_server_networking_retrieve_data_from_socket(
    socket: u32,
    size: u32,
) -> Result<Option<LegacyNetworkingSocketData>, Error> {
    networking_retrieve_data_from_socket_with(steam_game_server_networking, socket, size)
}

#[napi(js_name = "gameServerNetworkingIsDataAvailable")]
pub fn game_server_networking_is_data_available(
    listen_socket: u32,
) -> Result<Option<LegacyNetworkingListenSocketAvailable>, Error> {
    networking_is_data_available_with(steam_game_server_networking, listen_socket)
}

#[napi(js_name = "gameServerNetworkingRetrieveData")]
pub fn game_server_networking_retrieve_data(
    listen_socket: u32,
    size: u32,
) -> Result<Option<LegacyNetworkingListenSocketData>, Error> {
    networking_retrieve_data_with(steam_game_server_networking, listen_socket, size)
}

#[napi(js_name = "gameServerNetworkingGetSocketInfo")]
pub fn game_server_networking_get_socket_info(
    socket: u32,
) -> Result<Option<LegacyNetworkingSocketInfo>, Error> {
    networking_get_socket_info_with(steam_game_server_networking, socket)
}

#[napi(js_name = "gameServerNetworkingGetListenSocketInfo")]
pub fn game_server_networking_get_listen_socket_info(
    listen_socket: u32,
) -> Result<Option<LegacyNetworkingListenSocketInfo>, Error> {
    networking_get_listen_socket_info_with(steam_game_server_networking, listen_socket)
}

#[napi(js_name = "gameServerNetworkingGetSocketConnectionType")]
pub fn game_server_networking_get_socket_connection_type(socket: u32) -> Result<u32, Error> {
    networking_get_socket_connection_type_with(steam_game_server_networking, socket)
}

#[napi(js_name = "gameServerNetworkingGetMaxPacketSize")]
pub fn game_server_networking_get_max_packet_size(socket: u32) -> Result<i32, Error> {
    networking_get_max_packet_size_with(steam_game_server_networking, socket)
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

type SteamNetworkingMessagesAccessor = fn() -> Result<*mut sys::ISteamNetworkingMessages, Error>;

fn networking_messages_send_message_to_user_with(
    accessor: SteamNetworkingMessagesAccessor,
    identity: NetworkingIdentity,
    data: Buffer,
    send_flags: Option<i32>,
    channel: Option<i32>,
) -> Result<u32, Error> {
    let identity = networking_identity_from_input(identity)?;
    let result = unsafe {
        sys::SteamAPI_ISteamNetworkingMessages_SendMessageToUser(
            accessor()?,
            &identity,
            data.as_ptr().cast::<c_void>(),
            len_to_u32(data.len(), "networking message")?,
            send_flags.unwrap_or(sys::k_nSteamNetworkingSend_Reliable),
            channel.unwrap_or(0),
        )
    };
    Ok(result as u32)
}

fn networking_messages_receive_messages_on_channel_with(
    accessor: SteamNetworkingMessagesAccessor,
    channel: i32,
    max_messages: Option<u32>,
) -> Result<Vec<NetworkingMessage>, Error> {
    let max_messages = max_messages.unwrap_or(32).clamp(1, 1024);
    let mut messages = vec![ptr::null_mut(); max_messages as usize];
    let received = unsafe {
        sys::SteamAPI_ISteamNetworkingMessages_ReceiveMessagesOnChannel(
            accessor()?,
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

fn networking_messages_accept_session_with_user_with(
    accessor: SteamNetworkingMessagesAccessor,
    identity: NetworkingIdentity,
) -> Result<bool, Error> {
    let identity = networking_identity_from_input(identity)?;
    Ok(unsafe {
        sys::SteamAPI_ISteamNetworkingMessages_AcceptSessionWithUser(accessor()?, &identity)
    })
}

fn networking_messages_close_session_with_user_with(
    accessor: SteamNetworkingMessagesAccessor,
    identity: NetworkingIdentity,
) -> Result<bool, Error> {
    let identity = networking_identity_from_input(identity)?;
    Ok(unsafe {
        sys::SteamAPI_ISteamNetworkingMessages_CloseSessionWithUser(accessor()?, &identity)
    })
}

fn networking_messages_close_channel_with_user_with(
    accessor: SteamNetworkingMessagesAccessor,
    identity: NetworkingIdentity,
    channel: i32,
) -> Result<bool, Error> {
    let identity = networking_identity_from_input(identity)?;
    Ok(unsafe {
        sys::SteamAPI_ISteamNetworkingMessages_CloseChannelWithUser(accessor()?, &identity, channel)
    })
}

fn networking_messages_get_session_connection_info_with(
    accessor: SteamNetworkingMessagesAccessor,
    identity: NetworkingIdentity,
) -> Result<NetworkingMessagesSessionConnectionInfo, Error> {
    let identity = networking_identity_from_input(identity)?;
    let mut info = unsafe { MaybeUninit::<sys::SteamNetConnectionInfo_t>::zeroed().assume_init() };
    let mut quick_status =
        unsafe { MaybeUninit::<sys::SteamNetConnectionRealTimeStatus_t>::zeroed().assume_init() };
    let state = unsafe {
        sys::SteamAPI_ISteamNetworkingMessages_GetSessionConnectionInfo(
            accessor()?,
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

#[napi(js_name = "networkingMessagesSendMessageToUser")]
pub fn networking_messages_send_message_to_user(
    identity: NetworkingIdentity,
    data: Buffer,
    send_flags: Option<i32>,
    channel: Option<i32>,
) -> Result<u32, Error> {
    networking_messages_send_message_to_user_with(
        steam_networking_messages,
        identity,
        data,
        send_flags,
        channel,
    )
}

#[napi(js_name = "networkingMessagesReceiveMessagesOnChannel")]
pub fn networking_messages_receive_messages_on_channel(
    channel: i32,
    max_messages: Option<u32>,
) -> Result<Vec<NetworkingMessage>, Error> {
    networking_messages_receive_messages_on_channel_with(
        steam_networking_messages,
        channel,
        max_messages,
    )
}

#[napi(js_name = "networkingMessagesAcceptSessionWithUser")]
pub fn networking_messages_accept_session_with_user(
    identity: NetworkingIdentity,
) -> Result<bool, Error> {
    networking_messages_accept_session_with_user_with(steam_networking_messages, identity)
}

#[napi(js_name = "networkingMessagesCloseSessionWithUser")]
pub fn networking_messages_close_session_with_user(
    identity: NetworkingIdentity,
) -> Result<bool, Error> {
    networking_messages_close_session_with_user_with(steam_networking_messages, identity)
}

#[napi(js_name = "networkingMessagesCloseChannelWithUser")]
pub fn networking_messages_close_channel_with_user(
    identity: NetworkingIdentity,
    channel: i32,
) -> Result<bool, Error> {
    networking_messages_close_channel_with_user_with(steam_networking_messages, identity, channel)
}

#[napi(js_name = "networkingMessagesGetSessionConnectionInfo")]
pub fn networking_messages_get_session_connection_info(
    identity: NetworkingIdentity,
) -> Result<NetworkingMessagesSessionConnectionInfo, Error> {
    networking_messages_get_session_connection_info_with(steam_networking_messages, identity)
}

#[napi(js_name = "gameServerNetworkingMessagesSendMessageToUser")]
pub fn game_server_networking_messages_send_message_to_user(
    identity: NetworkingIdentity,
    data: Buffer,
    send_flags: Option<i32>,
    channel: Option<i32>,
) -> Result<u32, Error> {
    networking_messages_send_message_to_user_with(
        steam_game_server_networking_messages,
        identity,
        data,
        send_flags,
        channel,
    )
}

#[napi(js_name = "gameServerNetworkingMessagesReceiveMessagesOnChannel")]
pub fn game_server_networking_messages_receive_messages_on_channel(
    channel: i32,
    max_messages: Option<u32>,
) -> Result<Vec<NetworkingMessage>, Error> {
    networking_messages_receive_messages_on_channel_with(
        steam_game_server_networking_messages,
        channel,
        max_messages,
    )
}

#[napi(js_name = "gameServerNetworkingMessagesAcceptSessionWithUser")]
pub fn game_server_networking_messages_accept_session_with_user(
    identity: NetworkingIdentity,
) -> Result<bool, Error> {
    networking_messages_accept_session_with_user_with(
        steam_game_server_networking_messages,
        identity,
    )
}

#[napi(js_name = "gameServerNetworkingMessagesCloseSessionWithUser")]
pub fn game_server_networking_messages_close_session_with_user(
    identity: NetworkingIdentity,
) -> Result<bool, Error> {
    networking_messages_close_session_with_user_with(
        steam_game_server_networking_messages,
        identity,
    )
}

#[napi(js_name = "gameServerNetworkingMessagesCloseChannelWithUser")]
pub fn game_server_networking_messages_close_channel_with_user(
    identity: NetworkingIdentity,
    channel: i32,
) -> Result<bool, Error> {
    networking_messages_close_channel_with_user_with(
        steam_game_server_networking_messages,
        identity,
        channel,
    )
}

#[napi(js_name = "gameServerNetworkingMessagesGetSessionConnectionInfo")]
pub fn game_server_networking_messages_get_session_connection_info(
    identity: NetworkingIdentity,
) -> Result<NetworkingMessagesSessionConnectionInfo, Error> {
    networking_messages_get_session_connection_info_with(
        steam_game_server_networking_messages,
        identity,
    )
}

#[napi(js_name = "networkingSocketsCreateListenSocketIp")]
pub fn networking_sockets_create_listen_socket_ip(
    address: NetworkingIpAddress,
) -> Result<u32, Error> {
    let address = networking_ip_address_from_input(address)?;
    Ok(unsafe {
        sys::SteamAPI_ISteamNetworkingSockets_CreateListenSocketIP(
            steam_networking_sockets()?,
            &address,
            0,
            ptr::null(),
        )
    })
}

#[napi(js_name = "networkingSocketsConnectByIpAddress")]
pub fn networking_sockets_connect_by_ip_address(
    address: NetworkingIpAddress,
) -> Result<u32, Error> {
    let address = networking_ip_address_from_input(address)?;
    Ok(unsafe {
        sys::SteamAPI_ISteamNetworkingSockets_ConnectByIPAddress(
            steam_networking_sockets()?,
            &address,
            0,
            ptr::null(),
        )
    })
}

#[napi(js_name = "networkingSocketsCreateListenSocketP2p")]
pub fn networking_sockets_create_listen_socket_p2p(
    local_virtual_port: Option<i32>,
) -> Result<u32, Error> {
    Ok(unsafe {
        sys::SteamAPI_ISteamNetworkingSockets_CreateListenSocketP2P(
            steam_networking_sockets()?,
            networking_virtual_port(local_virtual_port)?,
            0,
            ptr::null(),
        )
    })
}

#[napi(js_name = "networkingSocketsConnectP2p")]
pub fn networking_sockets_connect_p2p(
    identity: NetworkingIdentity,
    remote_virtual_port: Option<i32>,
) -> Result<u32, Error> {
    let identity = networking_identity_from_input(identity)?;
    Ok(unsafe {
        sys::SteamAPI_ISteamNetworkingSockets_ConnectP2P(
            steam_networking_sockets()?,
            &identity,
            networking_virtual_port(remote_virtual_port)?,
            0,
            ptr::null(),
        )
    })
}

#[napi(js_name = "networkingSocketsAcceptConnection")]
pub fn networking_sockets_accept_connection(connection: u32) -> Result<u32, Error> {
    Ok(unsafe {
        sys::SteamAPI_ISteamNetworkingSockets_AcceptConnection(
            steam_networking_sockets()?,
            connection,
        )
    } as u32)
}

#[napi(js_name = "networkingSocketsCloseConnection")]
pub fn networking_sockets_close_connection(
    connection: u32,
    reason: Option<i32>,
    debug: Option<String>,
    enable_linger: Option<bool>,
) -> Result<bool, Error> {
    let debug = cstring(debug.unwrap_or_default(), "connection debug message")?;
    Ok(unsafe {
        sys::SteamAPI_ISteamNetworkingSockets_CloseConnection(
            steam_networking_sockets()?,
            connection,
            reason.unwrap_or(0),
            debug.as_ptr(),
            enable_linger.unwrap_or(false),
        )
    })
}

#[napi(js_name = "networkingSocketsCloseListenSocket")]
pub fn networking_sockets_close_listen_socket(socket: u32) -> Result<bool, Error> {
    Ok(unsafe {
        sys::SteamAPI_ISteamNetworkingSockets_CloseListenSocket(steam_networking_sockets()?, socket)
    })
}

#[napi(js_name = "networkingSocketsSetConnectionUserData")]
pub fn networking_sockets_set_connection_user_data(
    connection: u32,
    user_data: BigInt,
) -> Result<bool, Error> {
    Ok(unsafe {
        sys::SteamAPI_ISteamNetworkingSockets_SetConnectionUserData(
            steam_networking_sockets()?,
            connection,
            bigint_to_i64(user_data, "connection user data")?,
        )
    })
}

#[napi(js_name = "networkingSocketsGetConnectionUserData")]
pub fn networking_sockets_get_connection_user_data(connection: u32) -> Result<BigInt, Error> {
    Ok(unsafe {
        sys::SteamAPI_ISteamNetworkingSockets_GetConnectionUserData(
            steam_networking_sockets()?,
            connection,
        )
    }
    .into())
}

#[napi(js_name = "networkingSocketsSetConnectionName")]
pub fn networking_sockets_set_connection_name(connection: u32, name: String) -> Result<(), Error> {
    let name = cstring(name, "connection name")?;
    unsafe {
        sys::SteamAPI_ISteamNetworkingSockets_SetConnectionName(
            steam_networking_sockets()?,
            connection,
            name.as_ptr(),
        )
    };
    Ok(())
}

#[napi(js_name = "networkingSocketsGetConnectionName")]
pub fn networking_sockets_get_connection_name(connection: u32) -> Result<Option<String>, Error> {
    let mut output = vec![0i8; 256];
    let ok = unsafe {
        sys::SteamAPI_ISteamNetworkingSockets_GetConnectionName(
            steam_networking_sockets()?,
            connection,
            output.as_mut_ptr(),
            output.len() as i32,
        )
    };
    Ok(ok.then(|| c_buf_to_string(&output)))
}

#[napi(js_name = "networkingSocketsSendMessageToConnection")]
pub fn networking_sockets_send_message_to_connection(
    connection: u32,
    data: Buffer,
    send_flags: Option<i32>,
) -> Result<NetworkingSocketSendResult, Error> {
    let mut message_number = 0i64;
    let result = unsafe {
        sys::SteamAPI_ISteamNetworkingSockets_SendMessageToConnection(
            steam_networking_sockets()?,
            connection,
            data.as_ptr().cast::<c_void>(),
            len_to_u32(data.len(), "networking socket message")?,
            send_flags.unwrap_or(sys::k_nSteamNetworkingSend_Reliable),
            &mut message_number,
        )
    };
    Ok(NetworkingSocketSendResult {
        result: result as u32,
        message_number: message_number.into(),
    })
}

#[napi(js_name = "networkingSocketsSendMessages")]
pub fn networking_sockets_send_messages(
    messages: Vec<NetworkingSocketOutgoingMessage>,
) -> Result<Vec<NetworkingSocketSendResult>, Error> {
    if messages.is_empty() {
        return Ok(Vec::new());
    }

    let sockets = steam_networking_sockets()?;
    let utils = steam_networking_utils()?;
    let message_count = len_to_i32(messages.len(), "networking socket message batch")?;
    let mut raw_messages = Vec::with_capacity(messages.len());

    for message in messages {
        let raw = match allocate_networking_socket_message(utils, message) {
            Ok(raw) => raw,
            Err(error) => {
                release_networking_messages(&raw_messages);
                return Err(error);
            }
        };
        raw_messages.push(raw);
    }

    let mut results = vec![0i64; raw_messages.len()];
    unsafe {
        sys::SteamAPI_ISteamNetworkingSockets_SendMessages(
            sockets,
            message_count,
            raw_messages.as_ptr(),
            results.as_mut_ptr(),
        );
    }

    Ok(results
        .into_iter()
        .map(networking_socket_send_messages_result)
        .collect())
}

#[napi(js_name = "networkingSocketsFlushMessagesOnConnection")]
pub fn networking_sockets_flush_messages_on_connection(connection: u32) -> Result<u32, Error> {
    Ok(unsafe {
        sys::SteamAPI_ISteamNetworkingSockets_FlushMessagesOnConnection(
            steam_networking_sockets()?,
            connection,
        )
    } as u32)
}

#[napi(js_name = "networkingSocketsReceiveMessagesOnConnection")]
pub fn networking_sockets_receive_messages_on_connection(
    connection: u32,
    max_messages: Option<u32>,
) -> Result<Vec<NetworkingMessage>, Error> {
    let sockets = steam_networking_sockets()?;
    receive_networking_messages(max_messages, |messages, max_messages| unsafe {
        sys::SteamAPI_ISteamNetworkingSockets_ReceiveMessagesOnConnection(
            sockets,
            connection,
            messages,
            max_messages,
        )
    })
}

#[napi(js_name = "networkingSocketsGetConnectionInfo")]
pub fn networking_sockets_get_connection_info(
    connection: u32,
) -> Result<Option<NetworkingConnectionInfo>, Error> {
    let mut info = unsafe { MaybeUninit::<sys::SteamNetConnectionInfo_t>::zeroed().assume_init() };
    let ok = unsafe {
        sys::SteamAPI_ISteamNetworkingSockets_GetConnectionInfo(
            steam_networking_sockets()?,
            connection,
            &mut info,
        )
    };
    if ok {
        Ok(Some(networking_connection_info(&info)?))
    } else {
        Ok(None)
    }
}

#[napi(js_name = "networkingSocketsGetConnectionRealTimeStatus")]
pub fn networking_sockets_get_connection_real_time_status(
    connection: u32,
) -> Result<Option<NetworkingConnectionRealTimeStatus>, Error> {
    let mut status =
        unsafe { MaybeUninit::<sys::SteamNetConnectionRealTimeStatus_t>::zeroed().assume_init() };
    let result = unsafe {
        sys::SteamAPI_ISteamNetworkingSockets_GetConnectionRealTimeStatus(
            steam_networking_sockets()?,
            connection,
            &mut status,
            0,
            ptr::null_mut(),
        )
    };
    Ok((result == sys::EResult::k_EResultOK).then(|| networking_real_time_status(&status)))
}

#[napi(js_name = "networkingSocketsGetConnectionRealTimeStatusWithLanes")]
pub fn networking_sockets_get_connection_real_time_status_with_lanes(
    connection: u32,
    max_lanes: Option<u32>,
) -> Result<Option<NetworkingConnectionRealTimeStatusWithLanes>, Error> {
    let lane_count = max_lanes.unwrap_or(16).min(256);
    let mut status =
        unsafe { MaybeUninit::<sys::SteamNetConnectionRealTimeStatus_t>::zeroed().assume_init() };
    let mut lanes = vec![
        unsafe {
            MaybeUninit::<sys::SteamNetConnectionRealTimeLaneStatus_t>::zeroed().assume_init()
        };
        lane_count as usize
    ];
    let lane_ptr = if lanes.is_empty() {
        ptr::null_mut()
    } else {
        lanes.as_mut_ptr()
    };
    let result = unsafe {
        sys::SteamAPI_ISteamNetworkingSockets_GetConnectionRealTimeStatus(
            steam_networking_sockets()?,
            connection,
            &mut status,
            lane_count as i32,
            lane_ptr,
        )
    };
    Ok(
        (result == sys::EResult::k_EResultOK).then(|| {
            NetworkingConnectionRealTimeStatusWithLanes {
                status: networking_real_time_status(&status),
                lanes: lanes.iter().map(networking_real_time_lane_status).collect(),
            }
        }),
    )
}

#[napi(js_name = "networkingSocketsGetDetailedConnectionStatus")]
pub fn networking_sockets_get_detailed_connection_status(
    connection: u32,
    max_bytes: Option<u32>,
) -> Result<Option<String>, Error> {
    let size = max_bytes.unwrap_or(4096).clamp(1, 65_536) as usize;
    let mut output = vec![0i8; size];
    let result = unsafe {
        sys::SteamAPI_ISteamNetworkingSockets_GetDetailedConnectionStatus(
            steam_networking_sockets()?,
            connection,
            output.as_mut_ptr(),
            output.len() as i32,
        )
    };
    Ok((result >= 0).then(|| c_buf_to_string(&output)))
}

#[napi(js_name = "networkingSocketsGetListenSocketAddress")]
pub fn networking_sockets_get_listen_socket_address(
    socket: u32,
) -> Result<Option<NetworkingIpAddressInfo>, Error> {
    let mut address = unsafe { MaybeUninit::<sys::SteamNetworkingIPAddr>::zeroed().assume_init() };
    let ok = unsafe {
        sys::SteamAPI_ISteamNetworkingSockets_GetListenSocketAddress(
            steam_networking_sockets()?,
            socket,
            &mut address,
        )
    };
    if ok {
        Ok(Some(networking_ip_address_info(
            steam_networking_utils()?,
            address,
            true,
        )))
    } else {
        Ok(None)
    }
}

#[napi(js_name = "networkingSocketsCreateSocketPair")]
pub fn networking_sockets_create_socket_pair(
    use_network_loopback: bool,
    identity1: Option<NetworkingIdentity>,
    identity2: Option<NetworkingIdentity>,
) -> Result<Option<NetworkingSocketPair>, Error> {
    let identity1 = identity1.map(networking_identity_from_input).transpose()?;
    let identity2 = identity2.map(networking_identity_from_input).transpose()?;
    let identity1_ptr = identity1
        .as_ref()
        .map_or(ptr::null(), |identity| identity as *const _);
    let identity2_ptr = identity2
        .as_ref()
        .map_or(ptr::null(), |identity| identity as *const _);
    let mut connection1 = 0u32;
    let mut connection2 = 0u32;
    let ok = unsafe {
        sys::SteamAPI_ISteamNetworkingSockets_CreateSocketPair(
            steam_networking_sockets()?,
            &mut connection1,
            &mut connection2,
            use_network_loopback,
            identity1_ptr,
            identity2_ptr,
        )
    };
    Ok(ok.then_some(NetworkingSocketPair {
        connection1,
        connection2,
    }))
}

#[napi(js_name = "networkingSocketsConfigureConnectionLanes")]
pub fn networking_sockets_configure_connection_lanes(
    connection: u32,
    priorities: Vec<i32>,
    weights: Option<Vec<u32>>,
) -> Result<u32, Error> {
    let lane_count = priorities.len();
    let lane_count_i32 = i32::try_from(lane_count)
        .map_err(|_| Error::from_reason("connection lane count exceeds i32"))?;
    let weights = weights
        .map(|weights| {
            if weights.len() != lane_count {
                return Err(Error::from_reason(
                    "connection lane weights must match priorities length",
                ));
            }
            weights
                .into_iter()
                .map(|weight| {
                    u16::try_from(weight)
                        .map_err(|_| Error::from_reason("connection lane weight exceeds u16"))
                })
                .collect::<Result<Vec<_>, _>>()
        })
        .transpose()?;
    let weight_ptr = weights
        .as_ref()
        .map_or(ptr::null(), |weights| weights.as_ptr());
    Ok(unsafe {
        sys::SteamAPI_ISteamNetworkingSockets_ConfigureConnectionLanes(
            steam_networking_sockets()?,
            connection,
            lane_count_i32,
            priorities.as_ptr(),
            weight_ptr,
        )
    } as u32)
}

#[napi(js_name = "networkingSocketsGetIdentity")]
pub fn networking_sockets_get_identity() -> Result<Option<NetworkingIdentityInfo>, Error> {
    let mut identity =
        unsafe { MaybeUninit::<sys::SteamNetworkingIdentity>::zeroed().assume_init() };
    unsafe { sys::SteamAPI_SteamNetworkingIdentity_Clear(&mut identity) };
    let ok = unsafe {
        sys::SteamAPI_ISteamNetworkingSockets_GetIdentity(
            steam_networking_sockets()?,
            &mut identity,
        )
    };
    Ok(ok.then(|| networking_identity_info(identity)))
}

#[napi(js_name = "networkingSocketsInitAuthentication")]
pub fn networking_sockets_init_authentication() -> Result<i32, Error> {
    Ok(unsafe {
        sys::SteamAPI_ISteamNetworkingSockets_InitAuthentication(steam_networking_sockets()?)
    } as i32)
}

#[napi(js_name = "networkingSocketsGetAuthenticationStatus")]
pub fn networking_sockets_get_authentication_status(
) -> Result<NetworkingAuthenticationStatus, Error> {
    let mut status =
        unsafe { MaybeUninit::<sys::SteamNetAuthenticationStatus_t>::zeroed().assume_init() };
    let availability = unsafe {
        sys::SteamAPI_ISteamNetworkingSockets_GetAuthenticationStatus(
            steam_networking_sockets()?,
            &mut status,
        )
    };
    let mut output = networking_authentication_status(&status);
    output.availability = availability as i32;
    Ok(output)
}

#[napi(js_name = "networkingSocketsCreatePollGroup")]
pub fn networking_sockets_create_poll_group() -> Result<u32, Error> {
    Ok(unsafe {
        sys::SteamAPI_ISteamNetworkingSockets_CreatePollGroup(steam_networking_sockets()?)
    })
}

#[napi(js_name = "networkingSocketsRunCallbacks")]
pub fn networking_sockets_run_callbacks() -> Result<(), Error> {
    unsafe { sys::SteamAPI_ISteamNetworkingSockets_RunCallbacks(steam_networking_sockets()?) };
    Ok(())
}

#[napi(js_name = "networkingSocketsDestroyPollGroup")]
pub fn networking_sockets_destroy_poll_group(poll_group: u32) -> Result<bool, Error> {
    Ok(unsafe {
        sys::SteamAPI_ISteamNetworkingSockets_DestroyPollGroup(
            steam_networking_sockets()?,
            poll_group,
        )
    })
}

#[napi(js_name = "networkingSocketsSetConnectionPollGroup")]
pub fn networking_sockets_set_connection_poll_group(
    connection: u32,
    poll_group: u32,
) -> Result<bool, Error> {
    Ok(unsafe {
        sys::SteamAPI_ISteamNetworkingSockets_SetConnectionPollGroup(
            steam_networking_sockets()?,
            connection,
            poll_group,
        )
    })
}

#[napi(js_name = "networkingSocketsReceiveMessagesOnPollGroup")]
pub fn networking_sockets_receive_messages_on_poll_group(
    poll_group: u32,
    max_messages: Option<u32>,
) -> Result<Vec<NetworkingMessage>, Error> {
    let sockets = steam_networking_sockets()?;
    receive_networking_messages(max_messages, |messages, max_messages| unsafe {
        sys::SteamAPI_ISteamNetworkingSockets_ReceiveMessagesOnPollGroup(
            sockets,
            poll_group,
            messages,
            max_messages,
        )
    })
}

#[napi(js_name = "networkingSocketsReceivedRelayAuthTicket")]
pub fn networking_sockets_received_relay_auth_ticket(ticket: Buffer) -> Result<bool, Error> {
    Ok(unsafe {
        sys::SteamAPI_ISteamNetworkingSockets_ReceivedRelayAuthTicket(
            steam_networking_sockets()?,
            ticket.as_ptr().cast::<c_void>(),
            len_to_i32(ticket.len(), "relay auth ticket")?,
            ptr::null_mut(),
        )
    })
}

#[napi(js_name = "networkingSocketsFindRelayAuthTicketForServer")]
pub fn networking_sockets_find_relay_auth_ticket_for_server(
    identity: NetworkingIdentity,
    remote_virtual_port: Option<i32>,
) -> Result<i32, Error> {
    let identity = networking_identity_from_input(identity)?;
    Ok(unsafe {
        sys::SteamAPI_ISteamNetworkingSockets_FindRelayAuthTicketForServer(
            steam_networking_sockets()?,
            &identity,
            networking_virtual_port(remote_virtual_port)?,
            ptr::null_mut(),
        )
    })
}

#[napi(js_name = "networkingSocketsConnectToHostedDedicatedServer")]
pub fn networking_sockets_connect_to_hosted_dedicated_server(
    identity: NetworkingIdentity,
    remote_virtual_port: Option<i32>,
) -> Result<u32, Error> {
    let identity = networking_identity_from_input(identity)?;
    Ok(unsafe {
        sys::SteamAPI_ISteamNetworkingSockets_ConnectToHostedDedicatedServer(
            steam_networking_sockets()?,
            &identity,
            networking_virtual_port(remote_virtual_port)?,
            0,
            ptr::null(),
        )
    })
}

#[napi(js_name = "networkingSocketsGetHostedDedicatedServerPort")]
pub fn networking_sockets_get_hosted_dedicated_server_port() -> Result<u32, Error> {
    Ok(u32::from(unsafe {
        sys::SteamAPI_ISteamNetworkingSockets_GetHostedDedicatedServerPort(
            steam_networking_sockets()?,
        )
    }))
}

#[napi(js_name = "networkingSocketsGetHostedDedicatedServerPopId")]
pub fn networking_sockets_get_hosted_dedicated_server_pop_id() -> Result<u32, Error> {
    Ok(unsafe {
        sys::SteamAPI_ISteamNetworkingSockets_GetHostedDedicatedServerPOPID(
            steam_networking_sockets()?,
        )
    })
}

#[napi(js_name = "networkingSocketsGetHostedDedicatedServerAddress")]
pub fn networking_sockets_get_hosted_dedicated_server_address(
) -> Result<NetworkingHostedDedicatedServerAddressResult, Error> {
    let mut address = SteamDatagramHostedAddressRaw::default();
    unsafe {
        sys::SteamAPI_SteamDatagramHostedAddress_Clear(
            (&mut address as *mut SteamDatagramHostedAddressRaw)
                .cast::<sys::SteamDatagramHostedAddress>(),
        );
    }
    let result = unsafe {
        sys::SteamAPI_ISteamNetworkingSockets_GetHostedDedicatedServerAddress(
            steam_networking_sockets()?,
            (&mut address as *mut SteamDatagramHostedAddressRaw)
                .cast::<sys::SteamDatagramHostedAddress>(),
        )
    };
    Ok(networking_hosted_dedicated_server_address_result(
        result,
        &mut address,
    ))
}

#[napi(js_name = "networkingSocketsCreateHostedDedicatedServerListenSocket")]
pub fn networking_sockets_create_hosted_dedicated_server_listen_socket(
    local_virtual_port: Option<i32>,
) -> Result<u32, Error> {
    Ok(unsafe {
        sys::SteamAPI_ISteamNetworkingSockets_CreateHostedDedicatedServerListenSocket(
            steam_networking_sockets()?,
            networking_virtual_port(local_virtual_port)?,
            0,
            ptr::null(),
        )
    })
}

#[napi(js_name = "networkingSocketsGetGameCoordinatorServerLogin")]
pub fn networking_sockets_get_game_coordinator_server_login(
    app_data: Option<Buffer>,
    max_blob_bytes: Option<u32>,
) -> Result<NetworkingGameCoordinatorServerLoginResult, Error> {
    let app_data = app_data.map(|data| data.to_vec()).unwrap_or_default();
    if app_data.len() > 2048 {
        return Err(Error::from_reason(
            "game coordinator server login app data exceeds 2048 bytes",
        ));
    }

    let mut login = unsafe {
        MaybeUninit::<SteamDatagramGameCoordinatorServerLoginRaw>::zeroed().assume_init()
    };
    login.cb_app_data = len_to_i32(app_data.len(), "game coordinator server login app data")?;
    for (index, byte) in app_data.iter().enumerate() {
        login.app_data[index] = *byte as c_char;
    }

    let size = max_blob_bytes.unwrap_or(4096).clamp(1, 65_536);
    let mut signed_blob_size = i32::try_from(size)
        .map_err(|_| Error::from_reason("game coordinator server login blob size exceeds i32"))?;
    let mut signed_blob = vec![0u8; size as usize];
    let result = unsafe {
        sys::SteamAPI_ISteamNetworkingSockets_GetGameCoordinatorServerLogin(
            steam_networking_sockets()?,
            (&mut login as *mut SteamDatagramGameCoordinatorServerLoginRaw)
                .cast::<sys::SteamDatagramGameCoordinatorServerLogin>(),
            &mut signed_blob_size,
            signed_blob.as_mut_ptr().cast::<c_void>(),
        )
    };
    Ok(networking_game_coordinator_server_login_result(
        result,
        &mut login,
        signed_blob,
        signed_blob_size,
    ))
}

#[napi(js_name = "networkingSocketsGetCertificateRequest")]
pub fn networking_sockets_get_certificate_request(
    max_bytes: Option<u32>,
) -> Result<NetworkingCertificateResult, Error> {
    let size = max_bytes.unwrap_or(1024).clamp(1, 65_536);
    let mut size_i32 = i32::try_from(size)
        .map_err(|_| Error::from_reason("certificate request buffer size exceeds i32"))?;
    let mut data = vec![0u8; size as usize];
    let mut err_msg = [0 as c_char; sys::k_cchMaxSteamNetworkingErrMsg as usize];
    let success = unsafe {
        sys::SteamAPI_ISteamNetworkingSockets_GetCertificateRequest(
            steam_networking_sockets()?,
            &mut size_i32,
            data.as_mut_ptr().cast::<c_void>(),
            &mut err_msg,
        )
    };
    if success && size_i32 >= 0 {
        data.truncate((size_i32 as usize).min(data.len()));
    } else {
        data.clear();
    }
    Ok(NetworkingCertificateResult {
        success,
        data: data.into(),
        error: c_buf_to_string(&err_msg),
    })
}

#[napi(js_name = "networkingSocketsSetCertificate")]
pub fn networking_sockets_set_certificate(
    certificate: Buffer,
) -> Result<NetworkingCertificateResult, Error> {
    let mut err_msg = [0 as c_char; sys::k_cchMaxSteamNetworkingErrMsg as usize];
    let success = unsafe {
        sys::SteamAPI_ISteamNetworkingSockets_SetCertificate(
            steam_networking_sockets()?,
            certificate.as_ptr().cast::<c_void>(),
            len_to_i32(certificate.len(), "certificate")?,
            &mut err_msg,
        )
    };
    Ok(NetworkingCertificateResult {
        success,
        data: Vec::new().into(),
        error: c_buf_to_string(&err_msg),
    })
}

#[napi(js_name = "networkingSocketsResetIdentity")]
pub fn networking_sockets_reset_identity(
    identity: Option<NetworkingIdentity>,
) -> Result<(), Error> {
    let identity = identity.map(networking_identity_from_input).transpose()?;
    let identity_ptr = identity
        .as_ref()
        .map_or(ptr::null(), |identity| identity as *const _);
    unsafe {
        sys::SteamAPI_ISteamNetworkingSockets_ResetIdentity(
            steam_networking_sockets()?,
            identity_ptr,
        )
    };
    Ok(())
}

#[napi(js_name = "networkingSocketsBeginAsyncRequestFakeIp")]
pub fn networking_sockets_begin_async_request_fake_ip(num_ports: i32) -> Result<bool, Error> {
    if !(1..=8).contains(&num_ports) {
        return Err(Error::from_reason(
            "FakeIP port reservation count must be between 1 and 8",
        ));
    }
    Ok(unsafe {
        sys::SteamAPI_ISteamNetworkingSockets_BeginAsyncRequestFakeIP(
            steam_networking_sockets()?,
            num_ports,
        )
    })
}

#[napi(js_name = "networkingSocketsGetFakeIp")]
pub fn networking_sockets_get_fake_ip(
    idx_first_port: Option<i32>,
) -> Result<NetworkingFakeIpResult, Error> {
    let mut info = unsafe { MaybeUninit::<SteamNetworkingFakeIpResultRaw>::zeroed().assume_init() };
    unsafe {
        sys::SteamAPI_ISteamNetworkingSockets_GetFakeIP(
            steam_networking_sockets()?,
            idx_first_port.unwrap_or(0),
            (&mut info as *mut SteamNetworkingFakeIpResultRaw)
                .cast::<sys::SteamNetworkingFakeIPResult_t>(),
        )
    };
    Ok(networking_fake_ip_result(&info))
}

#[napi(js_name = "networkingSocketsCreateListenSocketP2pFakeIp")]
pub fn networking_sockets_create_listen_socket_p2p_fake_ip(
    idx_fake_port: Option<i32>,
) -> Result<u32, Error> {
    let idx_fake_port = idx_fake_port.unwrap_or(0);
    if idx_fake_port < 0 {
        return Err(Error::from_reason("FakeIP port index must be non-negative"));
    }
    Ok(unsafe {
        sys::SteamAPI_ISteamNetworkingSockets_CreateListenSocketP2PFakeIP(
            steam_networking_sockets()?,
            idx_fake_port,
            0,
            ptr::null(),
        )
    })
}

#[napi(js_name = "networkingSocketsGetRemoteFakeIpForConnection")]
pub fn networking_sockets_get_remote_fake_ip_for_connection(
    connection: u32,
) -> Result<NetworkingRemoteFakeIpResult, Error> {
    let mut address = unsafe { MaybeUninit::<sys::SteamNetworkingIPAddr>::zeroed().assume_init() };
    let result = unsafe {
        sys::SteamAPI_ISteamNetworkingSockets_GetRemoteFakeIPForConnection(
            steam_networking_sockets()?,
            connection,
            &mut address,
        )
    };
    let address = if result == sys::EResult::k_EResultOK {
        Some(networking_ip_address_info(
            steam_networking_utils()?,
            address,
            true,
        ))
    } else {
        None
    };
    Ok(NetworkingRemoteFakeIpResult {
        result: result as u32,
        address,
    })
}

#[napi(js_name = "networkingSocketsCreateFakeUdpPort")]
pub fn networking_sockets_create_fake_udp_port(
    fake_server_port: i32,
) -> Result<Option<u32>, Error> {
    if fake_server_port < 0 {
        return Err(Error::from_reason(
            "fake UDP server port index must be non-negative",
        ));
    }
    let port = unsafe {
        sys::SteamAPI_ISteamNetworkingSockets_CreateFakeUDPPort(
            steam_networking_sockets()?,
            fake_server_port,
        )
    };
    if port.is_null() {
        Ok(None)
    } else {
        Ok(Some(register_networking_fake_udp_port(port)?))
    }
}

macro_rules! game_server_networking_sockets_wrapper {
    ($js_name:literal, $fn_name:ident, $client_fn:ident($($arg:ident: $arg_ty:ty),*) -> $return_ty:ty) => {
        #[napi(js_name = $js_name)]
        pub fn $fn_name($($arg: $arg_ty),*) -> Result<$return_ty, Error> {
            with_game_server_networking_sockets(|| $client_fn($($arg),*))
        }
    };
}

game_server_networking_sockets_wrapper!(
    "gameServerNetworkingSocketsCreateListenSocketIp",
    game_server_networking_sockets_create_listen_socket_ip,
    networking_sockets_create_listen_socket_ip(address: NetworkingIpAddress) -> u32
);
game_server_networking_sockets_wrapper!(
    "gameServerNetworkingSocketsConnectByIpAddress",
    game_server_networking_sockets_connect_by_ip_address,
    networking_sockets_connect_by_ip_address(address: NetworkingIpAddress) -> u32
);
game_server_networking_sockets_wrapper!(
    "gameServerNetworkingSocketsCreateListenSocketP2p",
    game_server_networking_sockets_create_listen_socket_p2p,
    networking_sockets_create_listen_socket_p2p(local_virtual_port: Option<i32>) -> u32
);
game_server_networking_sockets_wrapper!(
    "gameServerNetworkingSocketsConnectP2p",
    game_server_networking_sockets_connect_p2p,
    networking_sockets_connect_p2p(identity: NetworkingIdentity, remote_virtual_port: Option<i32>) -> u32
);
game_server_networking_sockets_wrapper!(
    "gameServerNetworkingSocketsAcceptConnection",
    game_server_networking_sockets_accept_connection,
    networking_sockets_accept_connection(connection: u32) -> u32
);
game_server_networking_sockets_wrapper!(
    "gameServerNetworkingSocketsCloseConnection",
    game_server_networking_sockets_close_connection,
    networking_sockets_close_connection(
        connection: u32,
        reason: Option<i32>,
        debug: Option<String>,
        enable_linger: Option<bool>
    ) -> bool
);
game_server_networking_sockets_wrapper!(
    "gameServerNetworkingSocketsCloseListenSocket",
    game_server_networking_sockets_close_listen_socket,
    networking_sockets_close_listen_socket(socket: u32) -> bool
);
game_server_networking_sockets_wrapper!(
    "gameServerNetworkingSocketsSetConnectionUserData",
    game_server_networking_sockets_set_connection_user_data,
    networking_sockets_set_connection_user_data(connection: u32, user_data: BigInt) -> bool
);
game_server_networking_sockets_wrapper!(
    "gameServerNetworkingSocketsGetConnectionUserData",
    game_server_networking_sockets_get_connection_user_data,
    networking_sockets_get_connection_user_data(connection: u32) -> BigInt
);
game_server_networking_sockets_wrapper!(
    "gameServerNetworkingSocketsSetConnectionName",
    game_server_networking_sockets_set_connection_name,
    networking_sockets_set_connection_name(connection: u32, name: String) -> ()
);
game_server_networking_sockets_wrapper!(
    "gameServerNetworkingSocketsGetConnectionName",
    game_server_networking_sockets_get_connection_name,
    networking_sockets_get_connection_name(connection: u32) -> Option<String>
);
game_server_networking_sockets_wrapper!(
    "gameServerNetworkingSocketsSendMessageToConnection",
    game_server_networking_sockets_send_message_to_connection,
    networking_sockets_send_message_to_connection(
        connection: u32,
        data: Buffer,
        send_flags: Option<i32>
    ) -> NetworkingSocketSendResult
);
game_server_networking_sockets_wrapper!(
    "gameServerNetworkingSocketsSendMessages",
    game_server_networking_sockets_send_messages,
    networking_sockets_send_messages(messages: Vec<NetworkingSocketOutgoingMessage>) -> Vec<NetworkingSocketSendResult>
);
game_server_networking_sockets_wrapper!(
    "gameServerNetworkingSocketsFlushMessagesOnConnection",
    game_server_networking_sockets_flush_messages_on_connection,
    networking_sockets_flush_messages_on_connection(connection: u32) -> u32
);
game_server_networking_sockets_wrapper!(
    "gameServerNetworkingSocketsReceiveMessagesOnConnection",
    game_server_networking_sockets_receive_messages_on_connection,
    networking_sockets_receive_messages_on_connection(
        connection: u32,
        max_messages: Option<u32>
    ) -> Vec<NetworkingMessage>
);
game_server_networking_sockets_wrapper!(
    "gameServerNetworkingSocketsGetConnectionInfo",
    game_server_networking_sockets_get_connection_info,
    networking_sockets_get_connection_info(connection: u32) -> Option<NetworkingConnectionInfo>
);
game_server_networking_sockets_wrapper!(
    "gameServerNetworkingSocketsGetConnectionRealTimeStatus",
    game_server_networking_sockets_get_connection_real_time_status,
    networking_sockets_get_connection_real_time_status(connection: u32) -> Option<NetworkingConnectionRealTimeStatus>
);
game_server_networking_sockets_wrapper!(
    "gameServerNetworkingSocketsGetConnectionRealTimeStatusWithLanes",
    game_server_networking_sockets_get_connection_real_time_status_with_lanes,
    networking_sockets_get_connection_real_time_status_with_lanes(
        connection: u32,
        max_lanes: Option<u32>
    ) -> Option<NetworkingConnectionRealTimeStatusWithLanes>
);
game_server_networking_sockets_wrapper!(
    "gameServerNetworkingSocketsGetDetailedConnectionStatus",
    game_server_networking_sockets_get_detailed_connection_status,
    networking_sockets_get_detailed_connection_status(
        connection: u32,
        max_bytes: Option<u32>
    ) -> Option<String>
);
game_server_networking_sockets_wrapper!(
    "gameServerNetworkingSocketsGetListenSocketAddress",
    game_server_networking_sockets_get_listen_socket_address,
    networking_sockets_get_listen_socket_address(socket: u32) -> Option<NetworkingIpAddressInfo>
);
game_server_networking_sockets_wrapper!(
    "gameServerNetworkingSocketsCreateSocketPair",
    game_server_networking_sockets_create_socket_pair,
    networking_sockets_create_socket_pair(
        use_network_loopback: bool,
        identity1: Option<NetworkingIdentity>,
        identity2: Option<NetworkingIdentity>
    ) -> Option<NetworkingSocketPair>
);
game_server_networking_sockets_wrapper!(
    "gameServerNetworkingSocketsConfigureConnectionLanes",
    game_server_networking_sockets_configure_connection_lanes,
    networking_sockets_configure_connection_lanes(
        connection: u32,
        priorities: Vec<i32>,
        weights: Option<Vec<u32>>
    ) -> u32
);
game_server_networking_sockets_wrapper!(
    "gameServerNetworkingSocketsGetIdentity",
    game_server_networking_sockets_get_identity,
    networking_sockets_get_identity() -> Option<NetworkingIdentityInfo>
);
game_server_networking_sockets_wrapper!(
    "gameServerNetworkingSocketsInitAuthentication",
    game_server_networking_sockets_init_authentication,
    networking_sockets_init_authentication() -> i32
);
game_server_networking_sockets_wrapper!(
    "gameServerNetworkingSocketsGetAuthenticationStatus",
    game_server_networking_sockets_get_authentication_status,
    networking_sockets_get_authentication_status() -> NetworkingAuthenticationStatus
);
game_server_networking_sockets_wrapper!(
    "gameServerNetworkingSocketsCreatePollGroup",
    game_server_networking_sockets_create_poll_group,
    networking_sockets_create_poll_group() -> u32
);
game_server_networking_sockets_wrapper!(
    "gameServerNetworkingSocketsRunCallbacks",
    game_server_networking_sockets_run_callbacks,
    networking_sockets_run_callbacks() -> ()
);
game_server_networking_sockets_wrapper!(
    "gameServerNetworkingSocketsDestroyPollGroup",
    game_server_networking_sockets_destroy_poll_group,
    networking_sockets_destroy_poll_group(poll_group: u32) -> bool
);
game_server_networking_sockets_wrapper!(
    "gameServerNetworkingSocketsSetConnectionPollGroup",
    game_server_networking_sockets_set_connection_poll_group,
    networking_sockets_set_connection_poll_group(connection: u32, poll_group: u32) -> bool
);
game_server_networking_sockets_wrapper!(
    "gameServerNetworkingSocketsReceiveMessagesOnPollGroup",
    game_server_networking_sockets_receive_messages_on_poll_group,
    networking_sockets_receive_messages_on_poll_group(
        poll_group: u32,
        max_messages: Option<u32>
    ) -> Vec<NetworkingMessage>
);
game_server_networking_sockets_wrapper!(
    "gameServerNetworkingSocketsReceivedRelayAuthTicket",
    game_server_networking_sockets_received_relay_auth_ticket,
    networking_sockets_received_relay_auth_ticket(ticket: Buffer) -> bool
);
game_server_networking_sockets_wrapper!(
    "gameServerNetworkingSocketsFindRelayAuthTicketForServer",
    game_server_networking_sockets_find_relay_auth_ticket_for_server,
    networking_sockets_find_relay_auth_ticket_for_server(
        identity: NetworkingIdentity,
        remote_virtual_port: Option<i32>
    ) -> i32
);
game_server_networking_sockets_wrapper!(
    "gameServerNetworkingSocketsConnectToHostedDedicatedServer",
    game_server_networking_sockets_connect_to_hosted_dedicated_server,
    networking_sockets_connect_to_hosted_dedicated_server(
        identity: NetworkingIdentity,
        remote_virtual_port: Option<i32>
    ) -> u32
);
game_server_networking_sockets_wrapper!(
    "gameServerNetworkingSocketsGetHostedDedicatedServerPort",
    game_server_networking_sockets_get_hosted_dedicated_server_port,
    networking_sockets_get_hosted_dedicated_server_port() -> u32
);
game_server_networking_sockets_wrapper!(
    "gameServerNetworkingSocketsGetHostedDedicatedServerPopId",
    game_server_networking_sockets_get_hosted_dedicated_server_pop_id,
    networking_sockets_get_hosted_dedicated_server_pop_id() -> u32
);
game_server_networking_sockets_wrapper!(
    "gameServerNetworkingSocketsGetHostedDedicatedServerAddress",
    game_server_networking_sockets_get_hosted_dedicated_server_address,
    networking_sockets_get_hosted_dedicated_server_address() -> NetworkingHostedDedicatedServerAddressResult
);
game_server_networking_sockets_wrapper!(
    "gameServerNetworkingSocketsCreateHostedDedicatedServerListenSocket",
    game_server_networking_sockets_create_hosted_dedicated_server_listen_socket,
    networking_sockets_create_hosted_dedicated_server_listen_socket(local_virtual_port: Option<i32>) -> u32
);
game_server_networking_sockets_wrapper!(
    "gameServerNetworkingSocketsGetGameCoordinatorServerLogin",
    game_server_networking_sockets_get_game_coordinator_server_login,
    networking_sockets_get_game_coordinator_server_login(
        app_data: Option<Buffer>,
        max_blob_bytes: Option<u32>
    ) -> NetworkingGameCoordinatorServerLoginResult
);
game_server_networking_sockets_wrapper!(
    "gameServerNetworkingSocketsGetCertificateRequest",
    game_server_networking_sockets_get_certificate_request,
    networking_sockets_get_certificate_request(max_bytes: Option<u32>) -> NetworkingCertificateResult
);
game_server_networking_sockets_wrapper!(
    "gameServerNetworkingSocketsSetCertificate",
    game_server_networking_sockets_set_certificate,
    networking_sockets_set_certificate(certificate: Buffer) -> NetworkingCertificateResult
);
game_server_networking_sockets_wrapper!(
    "gameServerNetworkingSocketsResetIdentity",
    game_server_networking_sockets_reset_identity,
    networking_sockets_reset_identity(identity: Option<NetworkingIdentity>) -> ()
);
game_server_networking_sockets_wrapper!(
    "gameServerNetworkingSocketsBeginAsyncRequestFakeIp",
    game_server_networking_sockets_begin_async_request_fake_ip,
    networking_sockets_begin_async_request_fake_ip(num_ports: i32) -> bool
);
game_server_networking_sockets_wrapper!(
    "gameServerNetworkingSocketsGetFakeIp",
    game_server_networking_sockets_get_fake_ip,
    networking_sockets_get_fake_ip(idx_first_port: Option<i32>) -> NetworkingFakeIpResult
);
game_server_networking_sockets_wrapper!(
    "gameServerNetworkingSocketsCreateListenSocketP2pFakeIp",
    game_server_networking_sockets_create_listen_socket_p2p_fake_ip,
    networking_sockets_create_listen_socket_p2p_fake_ip(idx_fake_port: Option<i32>) -> u32
);
game_server_networking_sockets_wrapper!(
    "gameServerNetworkingSocketsGetRemoteFakeIpForConnection",
    game_server_networking_sockets_get_remote_fake_ip_for_connection,
    networking_sockets_get_remote_fake_ip_for_connection(connection: u32) -> NetworkingRemoteFakeIpResult
);
game_server_networking_sockets_wrapper!(
    "gameServerNetworkingSocketsCreateFakeUdpPort",
    game_server_networking_sockets_create_fake_udp_port,
    networking_sockets_create_fake_udp_port(fake_server_port: i32) -> Option<u32>
);

#[napi(js_name = "networkingFakeUdpPortDestroy")]
pub fn networking_fake_udp_port_destroy(handle: u32) -> Result<bool, Error> {
    ensure_networking_or_game_server_initialized()?;
    let port = NETWORKING_FAKE_UDP_PORTS
        .lock()
        .expect("Steam fake UDP port registry poisoned")
        .remove(&handle);
    if let Some(port) = port {
        unsafe {
            sys::SteamAPI_ISteamNetworkingFakeUDPPort_DestroyFakeUDPPort(
                port as *mut sys::ISteamNetworkingFakeUDPPort,
            );
        }
        Ok(true)
    } else {
        Ok(false)
    }
}

#[napi(js_name = "networkingFakeUdpPortSendMessageToFakeIp")]
pub fn networking_fake_udp_port_send_message_to_fake_ip(
    handle: u32,
    remote_address: NetworkingIpAddress,
    data: Buffer,
    send_flags: Option<i32>,
) -> Result<u32, Error> {
    let remote_address = networking_ip_address_from_input(remote_address)?;
    let data_len = len_to_u32(data.len(), "fake UDP message")?;
    with_networking_fake_udp_port(handle, |port| {
        Ok(unsafe {
            sys::SteamAPI_ISteamNetworkingFakeUDPPort_SendMessageToFakeIP(
                port,
                &remote_address,
                data.as_ptr().cast::<c_void>(),
                data_len,
                send_flags.unwrap_or(sys::k_nSteamNetworkingSend_Unreliable),
            )
        } as u32)
    })
}

#[napi(js_name = "networkingFakeUdpPortReceiveMessages")]
pub fn networking_fake_udp_port_receive_messages(
    handle: u32,
    max_messages: Option<u32>,
) -> Result<Vec<NetworkingMessage>, Error> {
    with_networking_fake_udp_port(handle, |port| {
        receive_networking_messages(max_messages, |messages, max_messages| unsafe {
            sys::SteamAPI_ISteamNetworkingFakeUDPPort_ReceiveMessages(port, messages, max_messages)
        })
    })
}

#[napi(js_name = "networkingFakeUdpPortScheduleCleanup")]
pub fn networking_fake_udp_port_schedule_cleanup(
    handle: u32,
    remote_address: NetworkingIpAddress,
) -> Result<(), Error> {
    let remote_address = networking_ip_address_from_input(remote_address)?;
    with_networking_fake_udp_port(handle, |port| {
        unsafe {
            sys::SteamAPI_ISteamNetworkingFakeUDPPort_ScheduleCleanup(port, &remote_address);
        }
        Ok(())
    })
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
    let address = networking_ip_address_from_input(address)?;
    Ok(networking_ip_address_string_standalone(
        address,
        with_port.unwrap_or(true),
    ))
}

#[napi(js_name = "networkingUtilsIpAddressEquals")]
pub fn networking_utils_ip_address_equals(
    address1: NetworkingIpAddress,
    address2: NetworkingIpAddress,
) -> Result<bool, Error> {
    let mut address1 = networking_ip_address_from_input(address1)?;
    let address2 = networking_ip_address_from_input(address2)?;
    Ok(unsafe { sys::SteamAPI_SteamNetworkingIPAddr_IsEqualTo(&mut address1, &address2) })
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

#[napi(js_name = "networkingUtilsIdentityToString")]
pub fn networking_utils_identity_to_string(identity: NetworkingIdentity) -> Result<String, Error> {
    let identity = networking_identity_from_input(identity)?;
    Ok(networking_utils_identity_string(
        steam_networking_utils()?,
        identity,
    ))
}

#[napi(js_name = "networkingUtilsParseIdentity")]
pub fn networking_utils_parse_identity(
    text: String,
) -> Result<Option<NetworkingIdentityInfo>, Error> {
    let mut identity =
        unsafe { MaybeUninit::<sys::SteamNetworkingIdentity>::zeroed().assume_init() };
    unsafe { sys::SteamAPI_SteamNetworkingIdentity_Clear(&mut identity) };
    let text = cstring(text, "networking identity")?;
    let ok = unsafe {
        sys::SteamAPI_ISteamNetworkingUtils_SteamNetworkingIdentity_ParseString(
            steam_networking_utils()?,
            &mut identity,
            text.as_ptr(),
        )
    };
    Ok(ok.then(|| networking_identity_info(identity)))
}

#[napi(js_name = "networkingUtilsIdentityGetSteamId")]
pub fn networking_utils_identity_get_steam_id(
    identity: NetworkingIdentity,
) -> Result<BigInt, Error> {
    let mut identity = networking_identity_from_input(identity)?;
    Ok(unsafe { sys::SteamAPI_SteamNetworkingIdentity_GetSteamID(&mut identity) }.into())
}

#[napi(js_name = "networkingUtilsIdentityGetPsnId")]
pub fn networking_utils_identity_get_psn_id(identity: NetworkingIdentity) -> Result<BigInt, Error> {
    let mut identity = networking_identity_from_input(identity)?;
    Ok(unsafe { sys::SteamAPI_SteamNetworkingIdentity_GetPSNID(&mut identity) }.into())
}

#[napi(js_name = "networkingUtilsIdentityGetXboxPairwiseId")]
pub fn networking_utils_identity_get_xbox_pairwise_id(
    identity: NetworkingIdentity,
) -> Result<Option<String>, Error> {
    let mut identity = networking_identity_from_input(identity)?;
    let value = string_from_ptr(unsafe {
        sys::SteamAPI_SteamNetworkingIdentity_GetXboxPairwiseID(&mut identity)
    });
    Ok((!value.is_empty()).then_some(value))
}

#[napi(js_name = "networkingUtilsIdentityGetIpAddress")]
pub fn networking_utils_identity_get_ip_address(
    identity: NetworkingIdentity,
) -> Result<Option<NetworkingIpAddressInfo>, Error> {
    let mut identity = networking_identity_from_input(identity)?;
    let address = unsafe { sys::SteamAPI_SteamNetworkingIdentity_GetIPAddr(&mut identity) };
    if address.is_null() {
        return Ok(None);
    }
    let address = unsafe { ptr::read_unaligned(address) };
    Ok(Some(networking_ip_address_info(
        steam_networking_utils()?,
        address,
        true,
    )))
}

#[napi(js_name = "networkingUtilsIdentityGetIpv4")]
pub fn networking_utils_identity_get_ipv4(identity: NetworkingIdentity) -> Result<u32, Error> {
    let mut identity = networking_identity_from_input(identity)?;
    Ok(unsafe { sys::SteamAPI_SteamNetworkingIdentity_GetIPv4(&mut identity) })
}

#[napi(js_name = "networkingUtilsIdentityGetGenericBytes")]
pub fn networking_utils_identity_get_generic_bytes(
    identity: NetworkingIdentity,
) -> Result<Option<Buffer>, Error> {
    let mut identity = networking_identity_from_input(identity)?;
    let mut size = 0i32;
    let bytes =
        unsafe { sys::SteamAPI_SteamNetworkingIdentity_GetGenericBytes(&mut identity, &mut size) };
    if bytes.is_null() || size <= 0 {
        return Ok(None);
    }
    Ok(Some(
        unsafe { std::slice::from_raw_parts(bytes, size as usize) }
            .to_vec()
            .into(),
    ))
}

#[napi(js_name = "networkingUtilsIdentityEquals")]
pub fn networking_utils_identity_equals(
    identity1: NetworkingIdentity,
    identity2: NetworkingIdentity,
) -> Result<bool, Error> {
    let mut identity1 = networking_identity_from_input(identity1)?;
    let identity2 = networking_identity_from_input(identity2)?;
    Ok(unsafe { sys::SteamAPI_SteamNetworkingIdentity_IsEqualTo(&mut identity1, &identity2) })
}

#[napi(js_name = "networkingUtilsIdentityIsFakeIp")]
pub fn networking_utils_identity_is_fake_ip(identity: NetworkingIdentity) -> Result<bool, Error> {
    let mut identity = networking_identity_from_input(identity)?;
    Ok(unsafe { sys::SteamAPI_SteamNetworkingIdentity_IsFakeIP(&mut identity) })
}

#[napi(js_name = "networkingUtilsSetConfigValueInt32")]
pub fn networking_utils_set_config_value_int32(
    value: u32,
    scope: u32,
    scope_obj: i64,
    data: i32,
) -> Result<bool, Error> {
    Ok(unsafe {
        sys::SteamAPI_ISteamNetworkingUtils_SetConfigValue(
            steam_networking_utils()?,
            networking_config_value(value)?,
            networking_config_scope(scope)?,
            networking_config_scope_obj(scope_obj)?,
            sys::ESteamNetworkingConfigDataType::k_ESteamNetworkingConfig_Int32,
            ptr::addr_of!(data).cast::<c_void>(),
        )
    })
}

#[napi(js_name = "networkingUtilsSetConfigValueInt64")]
pub fn networking_utils_set_config_value_int64(
    value: u32,
    scope: u32,
    scope_obj: i64,
    data: BigInt,
) -> Result<bool, Error> {
    let data = bigint_to_i64(data, "networking config int64 value")?;
    Ok(unsafe {
        sys::SteamAPI_ISteamNetworkingUtils_SetConfigValue(
            steam_networking_utils()?,
            networking_config_value(value)?,
            networking_config_scope(scope)?,
            networking_config_scope_obj(scope_obj)?,
            sys::ESteamNetworkingConfigDataType::k_ESteamNetworkingConfig_Int64,
            ptr::addr_of!(data).cast::<c_void>(),
        )
    })
}

#[napi(js_name = "networkingUtilsSetConfigValueFloat")]
pub fn networking_utils_set_config_value_float(
    value: u32,
    scope: u32,
    scope_obj: i64,
    data: f64,
) -> Result<bool, Error> {
    let data = data as f32;
    Ok(unsafe {
        sys::SteamAPI_ISteamNetworkingUtils_SetConfigValue(
            steam_networking_utils()?,
            networking_config_value(value)?,
            networking_config_scope(scope)?,
            networking_config_scope_obj(scope_obj)?,
            sys::ESteamNetworkingConfigDataType::k_ESteamNetworkingConfig_Float,
            ptr::addr_of!(data).cast::<c_void>(),
        )
    })
}

#[napi(js_name = "networkingUtilsSetConfigValueString")]
pub fn networking_utils_set_config_value_string(
    value: u32,
    scope: u32,
    scope_obj: i64,
    data: String,
) -> Result<bool, Error> {
    let data = cstring(data, "networking config string value")?;
    Ok(unsafe {
        sys::SteamAPI_ISteamNetworkingUtils_SetConfigValue(
            steam_networking_utils()?,
            networking_config_value(value)?,
            networking_config_scope(scope)?,
            networking_config_scope_obj(scope_obj)?,
            sys::ESteamNetworkingConfigDataType::k_ESteamNetworkingConfig_String,
            data.as_ptr().cast::<c_void>(),
        )
    })
}

#[napi(js_name = "networkingUtilsSetConfigValueStruct")]
pub fn networking_utils_set_config_value_struct(
    option: NetworkingConfigValue,
    scope: u32,
    scope_obj: i64,
) -> Result<bool, Error> {
    let (mut option, _string_storage) = networking_config_value_struct(option)?;
    Ok(unsafe {
        sys::SteamAPI_ISteamNetworkingUtils_SetConfigValueStruct(
            steam_networking_utils()?,
            &mut option,
            networking_config_scope(scope)?,
            networking_config_scope_obj(scope_obj)?,
        )
    })
}

#[napi(js_name = "networkingUtilsSetGlobalConfigValueInt32")]
pub fn networking_utils_set_global_config_value_int32(
    value: u32,
    data: i32,
) -> Result<bool, Error> {
    Ok(unsafe {
        sys::SteamAPI_ISteamNetworkingUtils_SetGlobalConfigValueInt32(
            steam_networking_utils()?,
            networking_config_value(value)?,
            data,
        )
    })
}

#[napi(js_name = "networkingUtilsSetGlobalConfigValueFloat")]
pub fn networking_utils_set_global_config_value_float(
    value: u32,
    data: f64,
) -> Result<bool, Error> {
    Ok(unsafe {
        sys::SteamAPI_ISteamNetworkingUtils_SetGlobalConfigValueFloat(
            steam_networking_utils()?,
            networking_config_value(value)?,
            data as f32,
        )
    })
}

#[napi(js_name = "networkingUtilsSetGlobalConfigValueString")]
pub fn networking_utils_set_global_config_value_string(
    value: u32,
    data: String,
) -> Result<bool, Error> {
    let data = cstring(data, "networking global config string value")?;
    Ok(unsafe {
        sys::SteamAPI_ISteamNetworkingUtils_SetGlobalConfigValueString(
            steam_networking_utils()?,
            networking_config_value(value)?,
            data.as_ptr(),
        )
    })
}

#[napi(js_name = "networkingUtilsSetGlobalConfigValuePtr")]
pub fn networking_utils_set_global_config_value_ptr(
    value: u32,
    data: Option<BigInt>,
) -> Result<bool, Error> {
    let data = match data {
        Some(data) => {
            let pointer = bigint_to_u64(data, "networking global config pointer")?;
            let pointer = usize::try_from(pointer).map_err(|_| {
                Error::from_reason("networking global config pointer exceeds pointer size")
            })?;
            pointer as *mut c_void
        }
        None => ptr::null_mut(),
    };
    Ok(unsafe {
        sys::SteamAPI_ISteamNetworkingUtils_SetGlobalConfigValuePtr(
            steam_networking_utils()?,
            networking_config_value(value)?,
            data,
        )
    })
}

#[napi(js_name = "networkingUtilsSetConnectionConfigValueInt32")]
pub fn networking_utils_set_connection_config_value_int32(
    connection: u32,
    value: u32,
    data: i32,
) -> Result<bool, Error> {
    Ok(unsafe {
        sys::SteamAPI_ISteamNetworkingUtils_SetConnectionConfigValueInt32(
            steam_networking_utils()?,
            connection,
            networking_config_value(value)?,
            data,
        )
    })
}

#[napi(js_name = "networkingUtilsSetConnectionConfigValueFloat")]
pub fn networking_utils_set_connection_config_value_float(
    connection: u32,
    value: u32,
    data: f64,
) -> Result<bool, Error> {
    Ok(unsafe {
        sys::SteamAPI_ISteamNetworkingUtils_SetConnectionConfigValueFloat(
            steam_networking_utils()?,
            connection,
            networking_config_value(value)?,
            data as f32,
        )
    })
}

#[napi(js_name = "networkingUtilsSetConnectionConfigValueString")]
pub fn networking_utils_set_connection_config_value_string(
    connection: u32,
    value: u32,
    data: String,
) -> Result<bool, Error> {
    let data = cstring(data, "networking connection config string value")?;
    Ok(unsafe {
        sys::SteamAPI_ISteamNetworkingUtils_SetConnectionConfigValueString(
            steam_networking_utils()?,
            connection,
            networking_config_value(value)?,
            data.as_ptr(),
        )
    })
}

#[napi(js_name = "networkingUtilsGetConfigValue")]
pub fn networking_utils_get_config_value(
    value: u32,
    scope: u32,
    scope_obj: i64,
    max_bytes: Option<u32>,
) -> Result<NetworkingConfigValueResult, Error> {
    let value = networking_config_value(value)?;
    let scope = networking_config_scope(scope)?;
    let scope_obj = networking_config_scope_obj(scope_obj)?;
    let capacity = max_bytes
        .unwrap_or(4096)
        .clamp(8, MAX_NETWORKING_CONFIG_VALUE_BYTES);
    let mut buffer = vec![0u8; capacity as usize];
    let mut data_type = sys::ESteamNetworkingConfigDataType::k_ESteamNetworkingConfig_Int32;
    let mut byte_count = buffer.len();
    let mut result = unsafe {
        sys::SteamAPI_ISteamNetworkingUtils_GetConfigValue(
            steam_networking_utils()?,
            value,
            scope,
            scope_obj,
            &mut data_type,
            buffer.as_mut_ptr().cast::<c_void>(),
            &mut byte_count,
        )
    };

    if result == sys::ESteamNetworkingGetConfigValueResult::k_ESteamNetworkingGetConfigValue_BufferTooSmall
        && max_bytes.is_none()
        && byte_count <= MAX_NETWORKING_CONFIG_VALUE_BYTES as usize
    {
        buffer.resize(byte_count.max(8), 0);
        result = unsafe {
            sys::SteamAPI_ISteamNetworkingUtils_GetConfigValue(
                steam_networking_utils()?,
                value,
                scope,
                scope_obj,
                &mut data_type,
                buffer.as_mut_ptr().cast::<c_void>(),
                &mut byte_count,
            )
        };
    }

    Ok(networking_config_value_result(
        result, data_type, &buffer, byte_count,
    ))
}

#[napi(js_name = "networkingUtilsGetConfigValueInfo")]
pub fn networking_utils_get_config_value_info(
    value: u32,
) -> Result<NetworkingConfigValueInfo, Error> {
    let value_enum = networking_config_value(value)?;
    let mut data_type = sys::ESteamNetworkingConfigDataType::k_ESteamNetworkingConfig_Int32;
    let mut scope = sys::ESteamNetworkingConfigScope::k_ESteamNetworkingConfig_Global;
    let name = unsafe {
        sys::SteamAPI_ISteamNetworkingUtils_GetConfigValueInfo(
            steam_networking_utils()?,
            value_enum,
            &mut data_type,
            &mut scope,
        )
    };
    Ok(NetworkingConfigValueInfo {
        value,
        name: (!name.is_null()).then(|| string_from_ptr(name)),
        data_type: data_type as u32,
        scope: scope as u32,
    })
}

#[napi(js_name = "networkingUtilsIterateGenericEditableConfigValues")]
pub fn networking_utils_iterate_generic_editable_config_values(
    current: u32,
    enumerate_dev_vars: Option<bool>,
) -> Result<u32, Error> {
    let next = unsafe {
        sys::SteamAPI_ISteamNetworkingUtils_IterateGenericEditableConfigValues(
            steam_networking_utils()?,
            networking_config_value(current)?,
            enumerate_dev_vars.unwrap_or(false),
        )
    };
    Ok(next as u32)
}

unsafe extern "C" fn steam_networking_utils_connection_status_changed_callback(
    event: *mut sys::SteamNetConnectionStatusChangedCallback_t,
) {
    if !event.is_null() {
        crate::state::dispatch_callback(
            CALLBACK_STEAM_NET_CONNECTION_STATUS_CHANGED,
            event.cast::<c_void>(),
        );
    }
}

unsafe extern "C" fn steam_networking_utils_authentication_status_changed_callback(
    event: *mut sys::SteamNetAuthenticationStatus_t,
) {
    if !event.is_null() {
        crate::state::dispatch_callback(
            CALLBACK_STEAM_NET_AUTHENTICATION_STATUS,
            event.cast::<c_void>(),
        );
    }
}

unsafe extern "C" fn steam_networking_utils_relay_network_status_changed_callback(
    event: *mut sys::SteamRelayNetworkStatus_t,
) {
    if !event.is_null() {
        crate::state::dispatch_callback(
            CALLBACK_STEAM_RELAY_NETWORK_STATUS,
            event.cast::<c_void>(),
        );
    }
}

unsafe extern "C" fn steam_networking_utils_fake_ip_result_callback(
    event: *mut sys::SteamNetworkingFakeIPResult_t,
) {
    if !event.is_null() {
        crate::state::dispatch_callback(
            CALLBACK_STEAM_NETWORKING_FAKE_IP_RESULT,
            event.cast::<c_void>(),
        );
    }
}

unsafe extern "C" fn steam_networking_utils_messages_session_request_callback(
    event: *mut sys::SteamNetworkingMessagesSessionRequest_t,
) {
    if !event.is_null() {
        crate::state::dispatch_callback(
            CALLBACK_STEAM_NETWORKING_MESSAGES_SESSION_REQUEST,
            event.cast::<c_void>(),
        );
    }
}

unsafe extern "C" fn steam_networking_utils_messages_session_failed_callback(
    event: *mut sys::SteamNetworkingMessagesSessionFailed_t,
) {
    if !event.is_null() {
        crate::state::dispatch_callback(
            CALLBACK_STEAM_NETWORKING_MESSAGES_SESSION_FAILED,
            event.cast::<c_void>(),
        );
    }
}

fn set_networking_utils_global_callbacks(
    utils: *mut sys::ISteamNetworkingUtils,
    enabled: bool,
) -> bool {
    let mut ok = true;
    unsafe {
        if enabled {
            ok &= sys::SteamAPI_ISteamNetworkingUtils_SetGlobalCallback_SteamNetConnectionStatusChanged(
                utils,
                Some(steam_networking_utils_connection_status_changed_callback),
            );
            ok &= sys::SteamAPI_ISteamNetworkingUtils_SetGlobalCallback_SteamNetAuthenticationStatusChanged(
                utils,
                Some(steam_networking_utils_authentication_status_changed_callback),
            );
            ok &= sys::SteamAPI_ISteamNetworkingUtils_SetGlobalCallback_SteamRelayNetworkStatusChanged(
                utils,
                Some(steam_networking_utils_relay_network_status_changed_callback),
            );
            ok &= sys::SteamAPI_ISteamNetworkingUtils_SetGlobalCallback_FakeIPResult(
                utils,
                Some(steam_networking_utils_fake_ip_result_callback),
            );
            ok &= sys::SteamAPI_ISteamNetworkingUtils_SetGlobalCallback_MessagesSessionRequest(
                utils,
                Some(steam_networking_utils_messages_session_request_callback),
            );
            ok &= sys::SteamAPI_ISteamNetworkingUtils_SetGlobalCallback_MessagesSessionFailed(
                utils,
                Some(steam_networking_utils_messages_session_failed_callback),
            );
        } else {
            ok &= sys::SteamAPI_ISteamNetworkingUtils_SetGlobalCallback_SteamNetConnectionStatusChanged(
                utils, None,
            );
            ok &= sys::SteamAPI_ISteamNetworkingUtils_SetGlobalCallback_SteamNetAuthenticationStatusChanged(
                utils, None,
            );
            ok &= sys::SteamAPI_ISteamNetworkingUtils_SetGlobalCallback_SteamRelayNetworkStatusChanged(
                utils, None,
            );
            ok &= sys::SteamAPI_ISteamNetworkingUtils_SetGlobalCallback_FakeIPResult(utils, None);
            ok &= sys::SteamAPI_ISteamNetworkingUtils_SetGlobalCallback_MessagesSessionRequest(
                utils, None,
            );
            ok &= sys::SteamAPI_ISteamNetworkingUtils_SetGlobalCallback_MessagesSessionFailed(
                utils, None,
            );
        }
    }
    ok
}

#[napi(js_name = "networkingUtilsEnableGlobalCallbacks")]
pub fn networking_utils_enable_global_callbacks() -> Result<bool, Error> {
    Ok(set_networking_utils_global_callbacks(
        steam_networking_utils()?,
        true,
    ))
}

#[napi(js_name = "networkingUtilsClearGlobalCallbacks")]
pub fn networking_utils_clear_global_callbacks() -> Result<bool, Error> {
    Ok(set_networking_utils_global_callbacks(
        steam_networking_utils()?,
        false,
    ))
}

pub(crate) fn clear_networking_utils_global_callbacks() {
    if let Ok(utils) = steam_networking_utils() {
        set_networking_utils_global_callbacks(utils, false);
    }
}

unsafe extern "C" fn steam_networking_debug_output_hook(
    detail_level: sys::ESteamNetworkingSocketsDebugOutputType,
    debug_text: *const c_char,
) {
    crate::state::dispatch_networking_debug_output(
        detail_level as i32,
        string_from_ptr(debug_text),
    );
}

pub(crate) fn clear_networking_debug_output_hook() {
    if let Ok(utils) = steam_networking_utils() {
        unsafe {
            sys::SteamAPI_ISteamNetworkingUtils_SetDebugOutputFunction(
                utils,
                sys::ESteamNetworkingSocketsDebugOutputType::k_ESteamNetworkingSocketsDebugOutputType_None,
                None,
            );
        }
    }
}

#[napi(js_name = "networkingUtilsRegisterDebugOutputHook")]
pub fn networking_utils_register_debug_output_hook(
    detail_level: u32,
    #[napi(ts_arg_type = "(value: any) => void")] handler: JsCallback<'_, NetworkingDebugOutput>,
) -> Result<CallbackHandle, Error> {
    crate::state::ensure_initialized()?;
    let utils = steam_networking_utils()?;
    let detail_level = networking_debug_output_type(detail_level)?;
    let threadsafe_handler: FatalThreadsafeFunction<NetworkingDebugOutput> = handler
        .build_threadsafe_function::<NetworkingDebugOutput>()
        .build_callback(|ctx| Ok(vec![ctx.value]))?;
    unsafe {
        sys::SteamAPI_ISteamNetworkingUtils_SetDebugOutputFunction(
            utils,
            detail_level,
            Some(steam_networking_debug_output_hook),
        );
    }
    let registration =
        crate::state::register_networking_debug_output_hook(move |detail_level, message| {
            threadsafe_handler.call(
                NetworkingDebugOutput {
                    detail_level,
                    message,
                },
                ThreadsafeFunctionCallMode::NonBlocking,
            );
        });
    Ok(CallbackHandle {
        registration: None,
        warning_message_registration: None,
        networking_debug_output_registration: Some(registration),
        input_action_event_registration: None,
    })
}

#[napi(js_name = "utilsGetServerRealTime")]
pub fn utils_get_server_real_time() -> Result<u32, Error> {
    Ok(unsafe { sys::SteamAPI_ISteamUtils_GetServerRealTime(steam_utils()?) })
}

#[napi(js_name = "utilsGetSecondsSinceAppActive")]
pub fn utils_get_seconds_since_app_active() -> Result<u32, Error> {
    Ok(unsafe { sys::SteamAPI_ISteamUtils_GetSecondsSinceAppActive(steam_utils()?) })
}

#[napi(js_name = "utilsGetSecondsSinceComputerActive")]
pub fn utils_get_seconds_since_computer_active() -> Result<u32, Error> {
    Ok(unsafe { sys::SteamAPI_ISteamUtils_GetSecondsSinceComputerActive(steam_utils()?) })
}

#[napi(js_name = "utilsGetConnectedUniverse")]
pub fn utils_get_connected_universe() -> Result<u32, Error> {
    Ok(unsafe { sys::SteamAPI_ISteamUtils_GetConnectedUniverse(steam_utils()?) as u32 })
}

#[napi(js_name = "utilsGetSteamUiLanguage")]
pub fn utils_get_steam_ui_language() -> Result<String, Error> {
    Ok(string_from_ptr(unsafe {
        sys::SteamAPI_ISteamUtils_GetSteamUILanguage(steam_utils()?)
    }))
}

#[napi(js_name = "utilsGetImageSize")]
pub fn utils_get_image_size(image: i32) -> Result<Option<UtilsImageSize>, Error> {
    let utils = steam_utils()?;
    let mut width = 0u32;
    let mut height = 0u32;
    let ok =
        unsafe { sys::SteamAPI_ISteamUtils_GetImageSize(utils, image, &mut width, &mut height) };
    Ok(ok.then_some(UtilsImageSize { width, height }))
}

#[napi(js_name = "utilsGetImageRgba")]
pub fn utils_get_image_rgba(image: i32) -> Result<Option<Buffer>, Error> {
    let utils = steam_utils()?;
    let mut width = 0u32;
    let mut height = 0u32;
    let has_size =
        unsafe { sys::SteamAPI_ISteamUtils_GetImageSize(utils, image, &mut width, &mut height) };
    if !has_size {
        return Ok(None);
    }

    let size = u64::from(width)
        .checked_mul(u64::from(height))
        .and_then(|pixels| pixels.checked_mul(4))
        .ok_or_else(|| Error::from_reason("Steam image dimensions overflowed"))?;
    if size > 256 * 1024 * 1024 {
        return Err(Error::from_reason("Steam image is too large to copy"));
    }

    let mut data = vec![0u8; size as usize];
    let ok = unsafe {
        sys::SteamAPI_ISteamUtils_GetImageRGBA(utils, image, data.as_mut_ptr(), data.len() as i32)
    };
    Ok(ok.then(|| data.into()))
}

#[napi(js_name = "utilsGetCurrentBatteryPower")]
pub fn utils_get_current_battery_power() -> Result<u32, Error> {
    Ok(u32::from(unsafe {
        sys::SteamAPI_ISteamUtils_GetCurrentBatteryPower(steam_utils()?)
    }))
}

#[napi(js_name = "utilsGetIpcCallCount")]
pub fn utils_get_ipc_call_count() -> Result<u32, Error> {
    Ok(unsafe { sys::SteamAPI_ISteamUtils_GetIPCCallCount(steam_utils()?) })
}

unsafe extern "C" fn steam_api_warning_message_hook(severity: i32, debug_text: *const c_char) {
    let message = if debug_text.is_null() {
        String::new()
    } else {
        CStr::from_ptr(debug_text).to_string_lossy().into_owned()
    };
    crate::state::dispatch_warning_message(severity, message);
}

pub(crate) fn clear_warning_message_hook() {
    if let Ok(utils) = steam_utils() {
        unsafe {
            sys::SteamAPI_ISteamUtils_SetWarningMessageHook(utils, None);
        }
    }
    if let Ok(client) = steam_client() {
        unsafe {
            sys::SteamAPI_ISteamClient_SetWarningMessageHook(client, None);
        }
    }
}

#[napi(js_name = "utilsRegisterWarningMessageHook")]
pub fn utils_register_warning_message_hook(
    #[napi(ts_arg_type = "(value: any) => void")] handler: JsCallback<'_, UtilsWarningMessage>,
) -> Result<CallbackHandle, Error> {
    crate::state::ensure_initialized()?;
    let utils = steam_utils()?;
    let threadsafe_handler: FatalThreadsafeFunction<UtilsWarningMessage> = handler
        .build_threadsafe_function::<UtilsWarningMessage>()
        .build_callback(|ctx| Ok(vec![ctx.value]))?;
    unsafe {
        sys::SteamAPI_ISteamUtils_SetWarningMessageHook(
            utils,
            Some(steam_api_warning_message_hook),
        );
    }
    let registration = crate::state::register_warning_message_hook(move |severity, message| {
        threadsafe_handler.call(
            UtilsWarningMessage { severity, message },
            ThreadsafeFunctionCallMode::NonBlocking,
        );
    });
    Ok(CallbackHandle {
        registration: None,
        warning_message_registration: Some(registration),
        networking_debug_output_registration: None,
        input_action_event_registration: None,
    })
}

#[napi(js_name = "utilsIsApiCallCompleted")]
pub fn utils_is_api_call_completed(api_call: BigInt) -> Result<UtilsApiCallCompletion, Error> {
    let utils = steam_utils()?;
    let api_call = bigint_to_u64(api_call, "Steam API call handle")?;
    let mut failed = false;
    let completed =
        unsafe { sys::SteamAPI_ISteamUtils_IsAPICallCompleted(utils, api_call, &mut failed) };
    Ok(UtilsApiCallCompletion { completed, failed })
}

#[napi(js_name = "utilsGetApiCallFailureReason")]
pub fn utils_get_api_call_failure_reason(api_call: BigInt) -> Result<i32, Error> {
    let reason = unsafe {
        sys::SteamAPI_ISteamUtils_GetAPICallFailureReason(
            steam_utils()?,
            bigint_to_u64(api_call, "Steam API call handle")?,
        )
    };
    Ok(reason as i32)
}

#[napi(js_name = "utilsGetApiCallResult")]
pub fn utils_get_api_call_result(
    api_call: BigInt,
    expected_callback: i32,
    byte_length: u32,
) -> Result<UtilsApiCallResult, Error> {
    if byte_length > MAX_API_CALL_RESULT_BYTES {
        return Err(Error::from_reason(format!(
            "API call result buffer cannot exceed {MAX_API_CALL_RESULT_BYTES} bytes"
        )));
    }

    let byte_length_i32 = i32::try_from(byte_length)
        .map_err(|_| Error::from_reason("API call result buffer is too large"))?;
    let expected_callback = callback_id_from_compat(expected_callback).unwrap_or(expected_callback);
    let mut data = vec![0u8; byte_length as usize];
    let mut failed = false;
    let ok = unsafe {
        sys::SteamAPI_ISteamUtils_GetAPICallResult(
            steam_utils()?,
            bigint_to_u64(api_call, "Steam API call handle")?,
            data.as_mut_ptr().cast::<c_void>(),
            byte_length_i32,
            expected_callback,
            &mut failed,
        )
    };

    Ok(UtilsApiCallResult {
        ok,
        failed,
        data: ok.then(|| data.into()),
    })
}

#[napi(js_name = "utilsCheckFileSignature")]
pub async fn utils_check_file_signature(
    file_name: String,
    timeout_seconds: Option<u32>,
) -> Result<u32, Error> {
    let utils = steam_utils()?;
    let file_name = cstring(file_name, "file name")?;
    let call = unsafe { sys::SteamAPI_ISteamUtils_CheckFileSignature(utils, file_name.as_ptr()) };
    let result: sys::CheckFileSignature_t = wait_for_api_call(
        call,
        sys::CheckFileSignature_t_k_iCallback as i32,
        u64::from(timeout_seconds.unwrap_or(DEFAULT_ASYNC_TIMEOUT_SECONDS as u32)),
    )
    .await?;
    Ok(result.m_eCheckFileSignature as u32)
}

#[napi(js_name = "utilsSetOverlayNotificationPosition")]
pub fn utils_set_overlay_notification_position(position: i32) -> Result<(), Error> {
    unsafe {
        sys::SteamAPI_ISteamUtils_SetOverlayNotificationPosition(
            steam_utils()?,
            notification_position_from_i32(position)?,
        )
    };
    Ok(())
}

#[napi(js_name = "utilsSetOverlayNotificationInset")]
pub fn utils_set_overlay_notification_inset(horizontal: i32, vertical: i32) -> Result<(), Error> {
    unsafe {
        sys::SteamAPI_ISteamUtils_SetOverlayNotificationInset(steam_utils()?, horizontal, vertical)
    };
    Ok(())
}

#[napi(js_name = "utilsIsSteamRunningInVr")]
pub fn utils_is_steam_running_in_vr() -> Result<bool, Error> {
    Ok(unsafe { sys::SteamAPI_ISteamUtils_IsSteamRunningInVR(steam_utils()?) })
}

#[napi(js_name = "utilsStartVrDashboard")]
pub fn utils_start_vr_dashboard() -> Result<(), Error> {
    unsafe { sys::SteamAPI_ISteamUtils_StartVRDashboard(steam_utils()?) };
    Ok(())
}

#[napi(js_name = "utilsIsVrHeadsetStreamingEnabled")]
pub fn utils_is_vr_headset_streaming_enabled() -> Result<bool, Error> {
    Ok(unsafe { sys::SteamAPI_ISteamUtils_IsVRHeadsetStreamingEnabled(steam_utils()?) })
}

#[napi(js_name = "utilsSetVrHeadsetStreamingEnabled")]
pub fn utils_set_vr_headset_streaming_enabled(enabled: bool) -> Result<(), Error> {
    unsafe { sys::SteamAPI_ISteamUtils_SetVRHeadsetStreamingEnabled(steam_utils()?, enabled) };
    Ok(())
}

#[napi(js_name = "utilsIsSteamChinaLauncher")]
pub fn utils_is_steam_china_launcher() -> Result<bool, Error> {
    Ok(unsafe { sys::SteamAPI_ISteamUtils_IsSteamChinaLauncher(steam_utils()?) })
}

#[napi(js_name = "utilsInitFilterText")]
pub fn utils_init_filter_text(options: Option<u32>) -> Result<bool, Error> {
    Ok(unsafe { sys::SteamAPI_ISteamUtils_InitFilterText(steam_utils()?, options.unwrap_or(0)) })
}

#[napi(js_name = "utilsFilterText")]
pub fn utils_filter_text(
    context: u32,
    source_steam_id64: BigInt,
    input: String,
    max_bytes: Option<u32>,
) -> Result<UtilsFilteredText, Error> {
    let utils = steam_utils()?;
    let source_steam_id = bigint_to_u64(source_steam_id64, "source steamId64")?;
    let default_capacity = (input.len() + 1).max(4096);
    let capacity = max_bytes
        .unwrap_or(default_capacity.min(u32::MAX as usize) as u32)
        .clamp(1, 65_536);
    let input = cstring(input, "text filter input")?;
    let mut output = vec![0i8; capacity as usize];
    let characters_filtered = unsafe {
        sys::SteamAPI_ISteamUtils_FilterText(
            utils,
            text_filtering_context_from_u32(context)?,
            source_steam_id,
            input.as_ptr(),
            output.as_mut_ptr(),
            output.len() as u32,
        )
    };
    Ok(UtilsFilteredText {
        filtered: c_buf_to_string(&output),
        characters_filtered,
    })
}

#[napi(js_name = "utilsGetIpv6ConnectivityState")]
pub fn utils_get_ipv6_connectivity_state(protocol: u32) -> Result<u32, Error> {
    Ok(unsafe {
        sys::SteamAPI_ISteamUtils_GetIPv6ConnectivityState(
            steam_utils()?,
            ipv6_connectivity_protocol_from_u32(protocol)?,
        ) as u32
    })
}

#[napi(js_name = "utilsSetGameLauncherMode")]
pub fn utils_set_game_launcher_mode(enabled: bool) -> Result<(), Error> {
    unsafe { sys::SteamAPI_ISteamUtils_SetGameLauncherMode(steam_utils()?, enabled) };
    Ok(())
}

#[napi(js_name = "utilsDismissFloatingGamepadTextInput")]
pub fn utils_dismiss_floating_gamepad_text_input() -> Result<bool, Error> {
    Ok(unsafe { sys::SteamAPI_ISteamUtils_DismissFloatingGamepadTextInput(steam_utils()?) })
}

#[napi(js_name = "utilsDismissGamepadTextInput")]
pub fn utils_dismiss_gamepad_text_input() -> Result<bool, Error> {
    Ok(unsafe { sys::SteamAPI_ISteamUtils_DismissGamepadTextInput(steam_utils()?) })
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

#[napi(js_name = "userStartVoiceRecording")]
pub fn user_start_voice_recording() -> Result<(), Error> {
    unsafe { sys::SteamAPI_ISteamUser_StartVoiceRecording(steam_user()?) };
    Ok(())
}

#[napi(js_name = "userStopVoiceRecording")]
pub fn user_stop_voice_recording() -> Result<(), Error> {
    unsafe { sys::SteamAPI_ISteamUser_StopVoiceRecording(steam_user()?) };
    Ok(())
}

#[napi(js_name = "userGetHSteamUser")]
pub fn user_get_h_steam_user() -> Result<i32, Error> {
    Ok(unsafe { sys::SteamAPI_ISteamUser_GetHSteamUser(steam_user()?) })
}

#[napi(js_name = "userIsLoggedOn")]
pub fn user_is_logged_on() -> Result<bool, Error> {
    Ok(unsafe { sys::SteamAPI_ISteamUser_BLoggedOn(steam_user()?) })
}

#[napi(js_name = "userGetAvailableVoice")]
pub fn user_get_available_voice(sample_rate: Option<u32>) -> Result<UserVoiceAvailable, Error> {
    let mut compressed_bytes = 0;
    let mut uncompressed_bytes = 0;
    let result = unsafe {
        sys::SteamAPI_ISteamUser_GetAvailableVoice(
            steam_user()?,
            &mut compressed_bytes,
            &mut uncompressed_bytes,
            sample_rate.unwrap_or(0),
        )
    };
    Ok(UserVoiceAvailable {
        result: result as u32,
        compressed_bytes,
        uncompressed_bytes,
    })
}

#[napi(js_name = "userGetVoice")]
pub fn user_get_voice(
    want_compressed: Option<bool>,
    compressed_buffer_bytes: Option<u32>,
    want_uncompressed: Option<bool>,
    uncompressed_buffer_bytes: Option<u32>,
    sample_rate: Option<u32>,
) -> Result<UserVoiceData, Error> {
    let want_compressed = want_compressed.unwrap_or(true);
    let want_uncompressed = want_uncompressed.unwrap_or(false);
    let mut compressed_capacity = requested_user_voice_bytes(
        compressed_buffer_bytes,
        DEFAULT_USER_VOICE_BYTES,
        "compressed voice",
    )?;
    let mut uncompressed_capacity = requested_user_voice_bytes(
        uncompressed_buffer_bytes,
        DEFAULT_USER_VOICE_BYTES,
        "uncompressed voice",
    )?;

    if !want_compressed {
        compressed_capacity = 0;
    }
    if !want_uncompressed {
        uncompressed_capacity = 0;
    }

    let mut compressed = vec![0u8; compressed_capacity as usize];
    let mut uncompressed = vec![0u8; uncompressed_capacity as usize];
    let mut compressed_bytes = 0;
    let mut uncompressed_bytes = 0;
    let result = unsafe {
        sys::SteamAPI_ISteamUser_GetVoice(
            steam_user()?,
            want_compressed,
            compressed.as_mut_ptr().cast::<c_void>(),
            compressed_capacity,
            &mut compressed_bytes,
            want_uncompressed,
            uncompressed.as_mut_ptr().cast::<c_void>(),
            uncompressed_capacity,
            &mut uncompressed_bytes,
            sample_rate.unwrap_or(0),
        )
    };

    compressed.truncate(compressed_bytes.min(compressed_capacity) as usize);
    uncompressed.truncate(uncompressed_bytes.min(uncompressed_capacity) as usize);
    Ok(UserVoiceData {
        result: result as u32,
        compressed: want_compressed.then(|| compressed.into()),
        uncompressed: want_uncompressed.then(|| uncompressed.into()),
        compressed_bytes,
        uncompressed_bytes,
    })
}

#[napi(js_name = "userDecompressVoice")]
pub fn user_decompress_voice(
    compressed: Buffer,
    max_bytes: Option<u32>,
    desired_sample_rate: Option<u32>,
) -> Result<UserVoiceData, Error> {
    let user = steam_user()?;
    let max_bytes =
        requested_user_voice_bytes(max_bytes, MAX_USER_VOICE_BYTES, "decompressed voice")?;
    let sample_rate = desired_sample_rate
        .unwrap_or_else(|| unsafe { sys::SteamAPI_ISteamUser_GetVoiceOptimalSampleRate(user) });
    let mut decompressed = vec![0u8; max_bytes as usize];
    let mut bytes_written = 0;
    let compressed_len = len_to_u32(compressed.len(), "compressed voice")?;
    let result = unsafe {
        sys::SteamAPI_ISteamUser_DecompressVoice(
            user,
            compressed.as_ptr().cast::<c_void>(),
            compressed_len,
            decompressed.as_mut_ptr().cast::<c_void>(),
            max_bytes,
            &mut bytes_written,
            sample_rate,
        )
    };
    decompressed.truncate(bytes_written.min(max_bytes) as usize);
    Ok(UserVoiceData {
        result: result as u32,
        compressed: None,
        uncompressed: Some(decompressed.into()),
        compressed_bytes: compressed_len,
        uncompressed_bytes: bytes_written,
    })
}

#[napi(js_name = "userGetVoiceOptimalSampleRate")]
pub fn user_get_voice_optimal_sample_rate() -> Result<u32, Error> {
    Ok(unsafe { sys::SteamAPI_ISteamUser_GetVoiceOptimalSampleRate(steam_user()?) })
}

#[napi(js_name = "userGetUserDataFolder")]
pub fn user_get_user_data_folder() -> Result<Option<String>, Error> {
    let mut buffer = vec![0i8; USER_DATA_FOLDER_BUFFER_SIZE];
    let ok = unsafe {
        sys::SteamAPI_ISteamUser_GetUserDataFolder(
            steam_user()?,
            buffer.as_mut_ptr(),
            buffer.len() as i32,
        )
    };
    Ok(ok.then(|| c_buf_to_string(&buffer)))
}

#[napi(js_name = "userTrackAppUsageEvent")]
pub fn user_track_app_usage_event(
    game_id: BigInt,
    event: i32,
    extra_info: Option<String>,
) -> Result<(), Error> {
    let extra_info = cstring(extra_info.unwrap_or_default(), "extra app usage info")?;
    unsafe {
        sys::SteamAPI_ISteamUser_TrackAppUsageEvent(
            steam_user()?,
            bigint_to_u64(game_id, "game id")?,
            event,
            extra_info.as_ptr(),
        )
    };
    Ok(())
}

#[napi(js_name = "userBeginAuthSession")]
pub fn user_begin_auth_session(ticket: Buffer, steam_id64: BigInt) -> Result<u32, Error> {
    let ticket_len = len_to_i32(ticket.len(), "auth session ticket")?;
    let result = unsafe {
        sys::SteamAPI_ISteamUser_BeginAuthSession(
            steam_user()?,
            ticket.as_ptr().cast::<c_void>(),
            ticket_len,
            bigint_to_u64(steam_id64, "steam id")?,
        )
    };
    Ok(result as u32)
}

#[napi(js_name = "userEndAuthSession")]
pub fn user_end_auth_session(steam_id64: BigInt) -> Result<(), Error> {
    unsafe {
        sys::SteamAPI_ISteamUser_EndAuthSession(
            steam_user()?,
            bigint_to_u64(steam_id64, "steam id")?,
        )
    };
    Ok(())
}

#[napi(js_name = "userCancelAuthTicket")]
pub fn user_cancel_auth_ticket(auth_ticket: u32) -> Result<(), Error> {
    unsafe { sys::SteamAPI_ISteamUser_CancelAuthTicket(steam_user()?, auth_ticket) };
    Ok(())
}

#[napi(js_name = "userHasLicenseForApp")]
pub fn user_has_license_for_app(steam_id64: BigInt, app_id: u32) -> Result<u32, Error> {
    Ok(unsafe {
        sys::SteamAPI_ISteamUser_UserHasLicenseForApp(
            steam_user()?,
            bigint_to_u64(steam_id64, "steam id")?,
            app_id,
        ) as u32
    })
}

#[napi(js_name = "userIsBehindNat")]
pub fn user_is_behind_nat() -> Result<bool, Error> {
    Ok(unsafe { sys::SteamAPI_ISteamUser_BIsBehindNAT(steam_user()?) })
}

#[napi(js_name = "userAdvertiseGame")]
pub fn user_advertise_game(steam_id64: BigInt, ip: u32, port: u32) -> Result<(), Error> {
    unsafe {
        sys::SteamAPI_ISteamUser_AdvertiseGame(
            steam_user()?,
            bigint_to_u64(steam_id64, "steam id")?,
            ip,
            u16_from_u32(port, "server port")?,
        )
    };
    Ok(())
}

#[napi(js_name = "userInitiateGameConnectionDeprecated")]
pub fn user_initiate_game_connection_deprecated(
    server_steam_id64: BigInt,
    ip: u32,
    port: u32,
    secure: Option<bool>,
    max_bytes: Option<u32>,
) -> Result<Option<Buffer>, Error> {
    let size = max_bytes
        .unwrap_or(DEFAULT_DEPRECATED_GAME_CONNECTION_AUTH_BLOB_BYTES)
        .clamp(1, 65_536);
    let mut auth_blob = vec![0u8; size as usize];
    let bytes_written = unsafe {
        sys::SteamAPI_ISteamUser_InitiateGameConnection_DEPRECATED(
            steam_user()?,
            auth_blob.as_mut_ptr().cast::<c_void>(),
            size as i32,
            bigint_to_u64(server_steam_id64, "game server steam id")?,
            ip,
            u16_from_u32(port, "server port")?,
            secure.unwrap_or(true),
        )
    };
    if bytes_written <= 0 {
        return Ok(None);
    }
    auth_blob.truncate((bytes_written as u32).min(size) as usize);
    Ok(Some(auth_blob.into()))
}

#[napi(js_name = "userTerminateGameConnectionDeprecated")]
pub fn user_terminate_game_connection_deprecated(ip: u32, port: u32) -> Result<(), Error> {
    unsafe {
        sys::SteamAPI_ISteamUser_TerminateGameConnection_DEPRECATED(
            steam_user()?,
            ip,
            u16_from_u32(port, "server port")?,
        )
    };
    Ok(())
}

#[napi(js_name = "userRequestEncryptedAppTicket")]
pub async fn user_request_encrypted_app_ticket(
    data_to_include: Option<Buffer>,
    timeout_seconds: Option<u32>,
) -> Result<UserEncryptedAppTicket, Error> {
    let mut data = data_to_include
        .map(|buffer| buffer.to_vec())
        .unwrap_or_default();
    if data.len() > MAX_ENCRYPTED_APP_TICKET_DATA_BYTES {
        return Err(Error::from_reason(format!(
            "encrypted app ticket data cannot exceed {MAX_ENCRYPTED_APP_TICKET_DATA_BYTES} bytes"
        )));
    }
    let data_len = len_to_i32(data.len(), "encrypted app ticket data")?;
    let data_ptr = if data.is_empty() {
        ptr::null_mut()
    } else {
        data.as_mut_ptr().cast::<c_void>()
    };
    let call = unsafe {
        sys::SteamAPI_ISteamUser_RequestEncryptedAppTicket(steam_user()?, data_ptr, data_len)
    };
    let result: sys::EncryptedAppTicketResponse_t = wait_for_api_call(
        call,
        sys::EncryptedAppTicketResponse_t_k_iCallback as i32,
        u64::from(timeout_seconds.unwrap_or(DEFAULT_ASYNC_TIMEOUT_SECONDS as u32)),
    )
    .await?;
    let result_code = unsafe { ptr::addr_of!(result.m_eResult).read_unaligned() } as u32;
    if result_code != sys::EResult::k_EResultOK as u32 {
        return Ok(UserEncryptedAppTicket {
            result: result_code,
            ticket: None,
        });
    }

    let mut ticket = vec![0u8; MAX_ENCRYPTED_APP_TICKET_BYTES as usize];
    let mut ticket_len = 0;
    let ok = unsafe {
        sys::SteamAPI_ISteamUser_GetEncryptedAppTicket(
            steam_user()?,
            ticket.as_mut_ptr().cast::<c_void>(),
            MAX_ENCRYPTED_APP_TICKET_BYTES as i32,
            &mut ticket_len,
        )
    };
    if !ok {
        return Err(Error::from_reason(
            "Steam encrypted app ticket retrieval failed",
        ));
    }
    ticket.truncate(ticket_len.min(MAX_ENCRYPTED_APP_TICKET_BYTES) as usize);
    Ok(UserEncryptedAppTicket {
        result: result_code,
        ticket: Some(ticket.into()),
    })
}

#[napi(js_name = "userGetEncryptedAppTicket")]
pub fn user_get_encrypted_app_ticket(max_bytes: Option<u32>) -> Result<Option<Buffer>, Error> {
    let max_bytes = max_bytes
        .unwrap_or(MAX_ENCRYPTED_APP_TICKET_BYTES)
        .clamp(1, MAX_ENCRYPTED_APP_TICKET_BYTES);
    let mut ticket = vec![0u8; max_bytes as usize];
    let mut ticket_len = 0;
    let ok = unsafe {
        sys::SteamAPI_ISteamUser_GetEncryptedAppTicket(
            steam_user()?,
            ticket.as_mut_ptr().cast::<c_void>(),
            max_bytes as i32,
            &mut ticket_len,
        )
    };
    if !ok {
        return Ok(None);
    }
    ticket.truncate(ticket_len.min(max_bytes) as usize);
    Ok(Some(ticket.into()))
}

#[napi(js_name = "userGetGameBadgeLevel")]
pub fn user_get_game_badge_level(series: i32, foil: bool) -> Result<i32, Error> {
    Ok(unsafe { sys::SteamAPI_ISteamUser_GetGameBadgeLevel(steam_user()?, series, foil) })
}

#[napi(js_name = "userGetPlayerSteamLevel")]
pub fn user_get_player_steam_level() -> Result<i32, Error> {
    Ok(unsafe { sys::SteamAPI_ISteamUser_GetPlayerSteamLevel(steam_user()?) })
}

#[napi(js_name = "userRequestStoreAuthUrl")]
pub async fn user_request_store_auth_url(
    redirect_url: String,
    timeout_seconds: Option<u32>,
) -> Result<String, Error> {
    let redirect_url = cstring(redirect_url, "store auth redirect URL")?;
    let call = unsafe {
        sys::SteamAPI_ISteamUser_RequestStoreAuthURL(steam_user()?, redirect_url.as_ptr())
    };
    let result: sys::StoreAuthURLResponse_t = wait_for_api_call(
        call,
        sys::StoreAuthURLResponse_t_k_iCallback as i32,
        u64::from(timeout_seconds.unwrap_or(DEFAULT_ASYNC_TIMEOUT_SECONDS as u32)),
    )
    .await?;
    Ok(c_buf_to_string(&result.m_szURL))
}

#[napi(js_name = "userIsPhoneVerified")]
pub fn user_is_phone_verified() -> Result<bool, Error> {
    Ok(unsafe { sys::SteamAPI_ISteamUser_BIsPhoneVerified(steam_user()?) })
}

#[napi(js_name = "userIsTwoFactorEnabled")]
pub fn user_is_two_factor_enabled() -> Result<bool, Error> {
    Ok(unsafe { sys::SteamAPI_ISteamUser_BIsTwoFactorEnabled(steam_user()?) })
}

#[napi(js_name = "userIsPhoneIdentifying")]
pub fn user_is_phone_identifying() -> Result<bool, Error> {
    Ok(unsafe { sys::SteamAPI_ISteamUser_BIsPhoneIdentifying(steam_user()?) })
}

#[napi(js_name = "userIsPhoneRequiringVerification")]
pub fn user_is_phone_requiring_verification() -> Result<bool, Error> {
    Ok(unsafe { sys::SteamAPI_ISteamUser_BIsPhoneRequiringVerification(steam_user()?) })
}

#[napi(js_name = "userGetMarketEligibility")]
pub async fn user_get_market_eligibility(
    timeout_seconds: Option<u32>,
) -> Result<UserMarketEligibility, Error> {
    let call = unsafe { sys::SteamAPI_ISteamUser_GetMarketEligibility(steam_user()?) };
    let result: sys::MarketEligibilityResponse_t = wait_for_api_call(
        call,
        sys::MarketEligibilityResponse_t_k_iCallback as i32,
        u64::from(timeout_seconds.unwrap_or(DEFAULT_ASYNC_TIMEOUT_SECONDS as u32)),
    )
    .await?;
    Ok(UserMarketEligibility {
        allowed: unsafe { ptr::addr_of!(result.m_bAllowed).read_unaligned() },
        not_allowed_reason: unsafe { ptr::addr_of!(result.m_eNotAllowedReason).read_unaligned() }.0,
        allowed_at_time: unsafe { ptr::addr_of!(result.m_rtAllowedAtTime).read_unaligned() },
        steam_guard_required_days: unsafe {
            ptr::addr_of!(result.m_cdaySteamGuardRequiredDays).read_unaligned()
        },
        new_device_cooldown_days: unsafe {
            ptr::addr_of!(result.m_cdayNewDeviceCooldown).read_unaligned()
        },
    })
}

#[napi(js_name = "userGetDurationControl")]
pub async fn user_get_duration_control(
    timeout_seconds: Option<u32>,
) -> Result<UserDurationControl, Error> {
    let call = unsafe { sys::SteamAPI_ISteamUser_GetDurationControl(steam_user()?) };
    let result: sys::DurationControl_t = wait_for_api_call(
        call,
        sys::DurationControl_t_k_iCallback as i32,
        u64::from(timeout_seconds.unwrap_or(DEFAULT_ASYNC_TIMEOUT_SECONDS as u32)),
    )
    .await?;
    Ok(UserDurationControl {
        result: unsafe { ptr::addr_of!(result.m_eResult).read_unaligned() } as u32,
        app_id: unsafe { ptr::addr_of!(result.m_appid).read_unaligned() },
        applicable: unsafe { ptr::addr_of!(result.m_bApplicable).read_unaligned() },
        seconds_last_5h: unsafe { ptr::addr_of!(result.m_csecsLast5h).read_unaligned() },
        progress: unsafe { ptr::addr_of!(result.m_progress).read_unaligned() } as u32,
        notification: unsafe { ptr::addr_of!(result.m_notification).read_unaligned() } as u32,
        seconds_today: unsafe { ptr::addr_of!(result.m_csecsToday).read_unaligned() },
        seconds_remaining: unsafe { ptr::addr_of!(result.m_csecsRemaining).read_unaligned() },
    })
}

#[napi(js_name = "userSetDurationControlOnlineState")]
pub fn user_set_duration_control_online_state(online_state: u32) -> Result<bool, Error> {
    Ok(unsafe {
        sys::SteamAPI_ISteamUser_BSetDurationControlOnlineState(
            steam_user()?,
            duration_control_online_state_from_u32(online_state)?,
        )
    })
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
        warning_message_registration: None,
        networking_debug_output_registration: None,
        input_action_event_registration: None,
    })
}

#[napi(js_name = "matchmakingGetFavoriteGameCount")]
pub fn matchmaking_get_favorite_game_count() -> Result<u32, Error> {
    let count =
        unsafe { sys::SteamAPI_ISteamMatchmaking_GetFavoriteGameCount(steam_matchmaking()?) };
    Ok(count.max(0) as u32)
}

#[napi(js_name = "matchmakingGetFavoriteGame")]
pub fn matchmaking_get_favorite_game(index: u32) -> Result<Option<MatchmakingFavoriteGame>, Error> {
    let mut app_id = 0;
    let mut ip = 0;
    let mut conn_port = 0;
    let mut query_port = 0;
    let mut flags = 0;
    let mut last_played_on_server = 0;
    let ok = unsafe {
        sys::SteamAPI_ISteamMatchmaking_GetFavoriteGame(
            steam_matchmaking()?,
            index as i32,
            &mut app_id,
            &mut ip,
            &mut conn_port,
            &mut query_port,
            &mut flags,
            &mut last_played_on_server,
        )
    };
    Ok(ok.then(|| MatchmakingFavoriteGame {
        app_id,
        ip,
        ip_address: ipv4_to_string(ip),
        conn_port: u32::from(conn_port),
        query_port: u32::from(query_port),
        flags,
        last_played_on_server,
    }))
}

#[napi(js_name = "matchmakingAddFavoriteGame")]
pub fn matchmaking_add_favorite_game(
    app_id: u32,
    ip: u32,
    conn_port: u32,
    query_port: u32,
    flags: u32,
    last_played_on_server: u32,
) -> Result<i32, Error> {
    Ok(unsafe {
        sys::SteamAPI_ISteamMatchmaking_AddFavoriteGame(
            steam_matchmaking()?,
            app_id,
            ip,
            port_to_u16(conn_port, "favorite connection port")?,
            port_to_u16(query_port, "favorite query port")?,
            flags,
            last_played_on_server,
        )
    })
}

#[napi(js_name = "matchmakingRemoveFavoriteGame")]
pub fn matchmaking_remove_favorite_game(
    app_id: u32,
    ip: u32,
    conn_port: u32,
    query_port: u32,
    flags: u32,
) -> Result<bool, Error> {
    Ok(unsafe {
        sys::SteamAPI_ISteamMatchmaking_RemoveFavoriteGame(
            steam_matchmaking()?,
            app_id,
            ip,
            port_to_u16(conn_port, "favorite connection port")?,
            port_to_u16(query_port, "favorite query port")?,
            flags,
        )
    })
}

#[napi(js_name = "matchmakingAddRequestLobbyListStringFilter")]
pub fn matchmaking_add_request_lobby_list_string_filter(
    key: String,
    value: String,
    comparison: i32,
) -> Result<(), Error> {
    let key = cstring(key, "lobby list string filter key")?;
    let value = cstring(value, "lobby list string filter value")?;
    unsafe {
        sys::SteamAPI_ISteamMatchmaking_AddRequestLobbyListStringFilter(
            steam_matchmaking()?,
            key.as_ptr(),
            value.as_ptr(),
            lobby_comparison_from_i32(comparison)?,
        )
    };
    Ok(())
}

#[napi(js_name = "matchmakingAddRequestLobbyListNumericalFilter")]
pub fn matchmaking_add_request_lobby_list_numerical_filter(
    key: String,
    value: i32,
    comparison: i32,
) -> Result<(), Error> {
    let key = cstring(key, "lobby list numerical filter key")?;
    unsafe {
        sys::SteamAPI_ISteamMatchmaking_AddRequestLobbyListNumericalFilter(
            steam_matchmaking()?,
            key.as_ptr(),
            value,
            lobby_comparison_from_i32(comparison)?,
        )
    };
    Ok(())
}

#[napi(js_name = "matchmakingAddRequestLobbyListNearValueFilter")]
pub fn matchmaking_add_request_lobby_list_near_value_filter(
    key: String,
    value: i32,
) -> Result<(), Error> {
    let key = cstring(key, "lobby list near value filter key")?;
    unsafe {
        sys::SteamAPI_ISteamMatchmaking_AddRequestLobbyListNearValueFilter(
            steam_matchmaking()?,
            key.as_ptr(),
            value,
        )
    };
    Ok(())
}

#[napi(js_name = "matchmakingAddRequestLobbyListFilterSlotsAvailable")]
pub fn matchmaking_add_request_lobby_list_filter_slots_available(slots: i32) -> Result<(), Error> {
    unsafe {
        sys::SteamAPI_ISteamMatchmaking_AddRequestLobbyListFilterSlotsAvailable(
            steam_matchmaking()?,
            slots,
        )
    };
    Ok(())
}

#[napi(js_name = "matchmakingAddRequestLobbyListDistanceFilter")]
pub fn matchmaking_add_request_lobby_list_distance_filter(
    distance_filter: u32,
) -> Result<(), Error> {
    unsafe {
        sys::SteamAPI_ISteamMatchmaking_AddRequestLobbyListDistanceFilter(
            steam_matchmaking()?,
            lobby_distance_filter_from_u32(distance_filter)?,
        )
    };
    Ok(())
}

#[napi(js_name = "matchmakingAddRequestLobbyListResultCountFilter")]
pub fn matchmaking_add_request_lobby_list_result_count_filter(
    max_results: i32,
) -> Result<(), Error> {
    unsafe {
        sys::SteamAPI_ISteamMatchmaking_AddRequestLobbyListResultCountFilter(
            steam_matchmaking()?,
            max_results,
        )
    };
    Ok(())
}

#[napi(js_name = "matchmakingAddRequestLobbyListCompatibleMembersFilter")]
pub fn matchmaking_add_request_lobby_list_compatible_members_filter(
    lobby_id: BigInt,
) -> Result<(), Error> {
    unsafe {
        sys::SteamAPI_ISteamMatchmaking_AddRequestLobbyListCompatibleMembersFilter(
            steam_matchmaking()?,
            bigint_to_u64(lobby_id, "lobby id")?,
        )
    };
    Ok(())
}

#[napi(js_name = "matchmakingServersRequestInternetServerList")]
pub async fn matchmaking_servers_request_internet_server_list(
    app_id: u32,
    filters: Option<Value>,
    timeout_seconds: Option<u32>,
) -> Result<MatchmakingServerListResult, Error> {
    request_matchmaking_server_list(
        MatchmakingServerListKind::Internet,
        app_id,
        filters,
        timeout_seconds,
    )
    .await
}

#[napi(js_name = "matchmakingServersRequestLanServerList")]
pub async fn matchmaking_servers_request_lan_server_list(
    app_id: u32,
    timeout_seconds: Option<u32>,
) -> Result<MatchmakingServerListResult, Error> {
    request_matchmaking_server_list(
        MatchmakingServerListKind::Lan,
        app_id,
        None,
        timeout_seconds,
    )
    .await
}

#[napi(js_name = "matchmakingServersRequestFriendsServerList")]
pub async fn matchmaking_servers_request_friends_server_list(
    app_id: u32,
    filters: Option<Value>,
    timeout_seconds: Option<u32>,
) -> Result<MatchmakingServerListResult, Error> {
    request_matchmaking_server_list(
        MatchmakingServerListKind::Friends,
        app_id,
        filters,
        timeout_seconds,
    )
    .await
}

#[napi(js_name = "matchmakingServersRequestFavoritesServerList")]
pub async fn matchmaking_servers_request_favorites_server_list(
    app_id: u32,
    filters: Option<Value>,
    timeout_seconds: Option<u32>,
) -> Result<MatchmakingServerListResult, Error> {
    request_matchmaking_server_list(
        MatchmakingServerListKind::Favorites,
        app_id,
        filters,
        timeout_seconds,
    )
    .await
}

#[napi(js_name = "matchmakingServersRequestHistoryServerList")]
pub async fn matchmaking_servers_request_history_server_list(
    app_id: u32,
    filters: Option<Value>,
    timeout_seconds: Option<u32>,
) -> Result<MatchmakingServerListResult, Error> {
    request_matchmaking_server_list(
        MatchmakingServerListKind::History,
        app_id,
        filters,
        timeout_seconds,
    )
    .await
}

#[napi(js_name = "matchmakingServersRequestSpectatorServerList")]
pub async fn matchmaking_servers_request_spectator_server_list(
    app_id: u32,
    filters: Option<Value>,
    timeout_seconds: Option<u32>,
) -> Result<MatchmakingServerListResult, Error> {
    request_matchmaking_server_list(
        MatchmakingServerListKind::Spectator,
        app_id,
        filters,
        timeout_seconds,
    )
    .await
}

#[napi(js_name = "matchmakingServersOpenInternetServerList")]
pub fn matchmaking_servers_open_internet_server_list(
    app_id: u32,
    filters: Option<Value>,
) -> Result<MatchmakingServerListRequest, Error> {
    open_matchmaking_server_list_request(MatchmakingServerListKind::Internet, app_id, filters)
}

#[napi(js_name = "matchmakingServersOpenLanServerList")]
pub fn matchmaking_servers_open_lan_server_list(
    app_id: u32,
) -> Result<MatchmakingServerListRequest, Error> {
    open_matchmaking_server_list_request(MatchmakingServerListKind::Lan, app_id, None)
}

#[napi(js_name = "matchmakingServersOpenFriendsServerList")]
pub fn matchmaking_servers_open_friends_server_list(
    app_id: u32,
    filters: Option<Value>,
) -> Result<MatchmakingServerListRequest, Error> {
    open_matchmaking_server_list_request(MatchmakingServerListKind::Friends, app_id, filters)
}

#[napi(js_name = "matchmakingServersOpenFavoritesServerList")]
pub fn matchmaking_servers_open_favorites_server_list(
    app_id: u32,
    filters: Option<Value>,
) -> Result<MatchmakingServerListRequest, Error> {
    open_matchmaking_server_list_request(MatchmakingServerListKind::Favorites, app_id, filters)
}

#[napi(js_name = "matchmakingServersOpenHistoryServerList")]
pub fn matchmaking_servers_open_history_server_list(
    app_id: u32,
    filters: Option<Value>,
) -> Result<MatchmakingServerListRequest, Error> {
    open_matchmaking_server_list_request(MatchmakingServerListKind::History, app_id, filters)
}

#[napi(js_name = "matchmakingServersOpenSpectatorServerList")]
pub fn matchmaking_servers_open_spectator_server_list(
    app_id: u32,
    filters: Option<Value>,
) -> Result<MatchmakingServerListRequest, Error> {
    open_matchmaking_server_list_request(MatchmakingServerListKind::Spectator, app_id, filters)
}

#[napi(js_name = "matchmakingServersGetServerListRequestState")]
pub fn matchmaking_servers_get_server_list_request_state(
    handle: BigInt,
) -> Result<MatchmakingServerListRequestState, Error> {
    get_matchmaking_server_list_request_state(handle)
}

#[napi(js_name = "matchmakingServersGetServerListRequestServerDetails")]
pub fn matchmaking_servers_get_server_list_request_server_details(
    handle: BigInt,
    server: i32,
) -> Result<Option<MatchmakingServerItem>, Error> {
    get_matchmaking_server_list_request_server_details(handle, server)
}

#[napi(js_name = "matchmakingServersRefreshServerListQuery")]
pub fn matchmaking_servers_refresh_server_list_query(handle: BigInt) -> Result<(), Error> {
    refresh_matchmaking_server_list_query(handle)
}

#[napi(js_name = "matchmakingServersRefreshServerListServer")]
pub fn matchmaking_servers_refresh_server_list_server(
    handle: BigInt,
    server: i32,
) -> Result<(), Error> {
    refresh_matchmaking_server_list_server(handle, server)
}

#[napi(js_name = "matchmakingServersCancelServerListQuery")]
pub fn matchmaking_servers_cancel_server_list_query(handle: BigInt) -> Result<(), Error> {
    cancel_matchmaking_server_list_query(handle)
}

#[napi(js_name = "matchmakingServersReleaseServerListRequest")]
pub fn matchmaking_servers_release_server_list_request(handle: BigInt) -> Result<bool, Error> {
    release_matchmaking_server_list_request(handle)
}

#[napi(js_name = "matchmakingServersPingServer")]
pub async fn matchmaking_servers_ping_server(
    ip: u32,
    query_port: u32,
    timeout_seconds: Option<u32>,
) -> Result<MatchmakingServerPingResult, Error> {
    ping_matchmaking_server(ip, query_port, timeout_seconds).await
}

#[napi(js_name = "matchmakingServersPlayerDetails")]
pub async fn matchmaking_servers_player_details(
    ip: u32,
    query_port: u32,
    timeout_seconds: Option<u32>,
) -> Result<MatchmakingServerPlayersResult, Error> {
    get_matchmaking_server_players(ip, query_port, timeout_seconds).await
}

#[napi(js_name = "matchmakingServersServerRules")]
pub async fn matchmaking_servers_server_rules(
    ip: u32,
    query_port: u32,
    timeout_seconds: Option<u32>,
) -> Result<MatchmakingServerRulesResult, Error> {
    get_matchmaking_server_rules(ip, query_port, timeout_seconds).await
}

#[napi(js_name = "matchmakingServersCreateServerAddress")]
pub fn matchmaking_servers_create_server_address(
    ip: u32,
    query_port: u32,
    connection_port: u32,
) -> Result<MatchmakingServerAddress, Error> {
    let mut address = matchmaking_server_address_raw(ip, query_port, connection_port)?;
    Ok(matchmaking_server_address(&mut address))
}

#[napi(js_name = "matchmakingServersCopyServerAddress")]
pub fn matchmaking_servers_copy_server_address(
    ip: u32,
    query_port: u32,
    connection_port: u32,
) -> Result<MatchmakingServerAddress, Error> {
    let address = matchmaking_server_address_raw(ip, query_port, connection_port)?;
    let mut output = empty_matchmaking_server_address_raw();
    unsafe { sys::SteamAPI_servernetadr_t_Assign(&mut output, &address) };
    Ok(matchmaking_server_address(&mut output))
}

#[napi(js_name = "matchmakingServersIsServerAddressLessThan")]
pub fn matchmaking_servers_is_server_address_less_than(
    ip: u32,
    query_port: u32,
    connection_port: u32,
    other_ip: u32,
    other_query_port: u32,
    other_connection_port: u32,
) -> Result<bool, Error> {
    let mut address = matchmaking_server_address_raw(ip, query_port, connection_port)?;
    let other = matchmaking_server_address_raw(other_ip, other_query_port, other_connection_port)?;
    Ok(unsafe { sys::SteamAPI_servernetadr_t_IsLessThan(&mut address, &other) })
}

#[napi(js_name = "matchmakingServersCreateServerFilter")]
pub fn matchmaking_servers_create_server_filter(
    key: String,
    value: String,
) -> Result<MatchmakingServerBrowserFilter, Error> {
    let filter = matchmaking_server_filter_pair(key, value)?;
    Ok(MatchmakingServerBrowserFilter {
        key: c_buf_to_string(&filter.m_szKey),
        value: c_buf_to_string(&filter.m_szValue),
    })
}

#[napi(js_name = "matchmakingServersCreateServerItem")]
pub fn matchmaking_servers_create_server_item(
    name: String,
    ip: u32,
    query_port: u32,
    connection_port: u32,
) -> Result<MatchmakingServerItem, Error> {
    let mut item = unsafe { MaybeUninit::<sys::gameserveritem_t>::zeroed().assume_init() };
    unsafe { sys::SteamAPI_gameserveritem_t_Construct(&mut item) };
    let address = matchmaking_server_address_raw(ip, query_port, connection_port)?;
    item.m_NetAdr = address;
    let name = cstring(name, "game server item name")?;
    unsafe { sys::SteamAPI_gameserveritem_t_SetName(&mut item, name.as_ptr()) };
    matchmaking_server_item(&mut item)
        .ok_or_else(|| Error::from_reason("failed to construct matchmaking server item"))
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

#[napi(js_name = "matchmakingInviteUserToLobby")]
pub fn matchmaking_invite_user_to_lobby(
    lobby_id: BigInt,
    steam_id64: BigInt,
) -> Result<bool, Error> {
    Ok(unsafe {
        sys::SteamAPI_ISteamMatchmaking_InviteUserToLobby(
            steam_matchmaking()?,
            bigint_to_u64(lobby_id, "lobby id")?,
            bigint_to_u64(steam_id64, "steamId64")?,
        )
    })
}

#[napi(js_name = "matchmakingGetLobbyMemberData")]
pub fn matchmaking_get_lobby_member_data(
    lobby_id: BigInt,
    steam_id64: BigInt,
    key: String,
) -> Result<Option<String>, Error> {
    let key = cstring(key, "lobby member data key")?;
    let value = unsafe {
        sys::SteamAPI_ISteamMatchmaking_GetLobbyMemberData(
            steam_matchmaking()?,
            bigint_to_u64(lobby_id, "lobby id")?,
            bigint_to_u64(steam_id64, "steamId64")?,
            key.as_ptr(),
        )
    };
    let value = string_from_ptr(value);
    Ok(if value.is_empty() { None } else { Some(value) })
}

#[napi(js_name = "matchmakingSetLobbyMemberData")]
pub fn matchmaking_set_lobby_member_data(
    lobby_id: BigInt,
    key: String,
    value: String,
) -> Result<(), Error> {
    let key = cstring(key, "lobby member data key")?;
    let value = cstring(value, "lobby member data value")?;
    unsafe {
        sys::SteamAPI_ISteamMatchmaking_SetLobbyMemberData(
            steam_matchmaking()?,
            bigint_to_u64(lobby_id, "lobby id")?,
            key.as_ptr(),
            value.as_ptr(),
        )
    };
    Ok(())
}

#[napi(js_name = "matchmakingSendLobbyChatMsg")]
pub fn matchmaking_send_lobby_chat_msg(lobby_id: BigInt, data: Buffer) -> Result<bool, Error> {
    Ok(unsafe {
        sys::SteamAPI_ISteamMatchmaking_SendLobbyChatMsg(
            steam_matchmaking()?,
            bigint_to_u64(lobby_id, "lobby id")?,
            data.as_ptr().cast::<c_void>(),
            len_to_i32(data.len(), "lobby chat message")?,
        )
    })
}

#[napi(js_name = "matchmakingGetLobbyChatEntry")]
pub fn matchmaking_get_lobby_chat_entry(
    lobby_id: BigInt,
    chat_id: i32,
    max_bytes: Option<u32>,
) -> Result<Option<LobbyChatEntry>, Error> {
    let size = max_bytes.unwrap_or(4096).clamp(1, 4096);
    let mut data = vec![0u8; size as usize];
    let mut steam_id = u64_to_csteam_id(0);
    let mut entry_type = sys::EChatEntryType::k_EChatEntryTypeInvalid;
    let written = unsafe {
        sys::SteamAPI_ISteamMatchmaking_GetLobbyChatEntry(
            steam_matchmaking()?,
            bigint_to_u64(lobby_id, "lobby id")?,
            chat_id,
            &mut steam_id,
            data.as_mut_ptr().cast::<c_void>(),
            size as i32,
            &mut entry_type,
        )
    };
    if written <= 0 {
        return Ok(None);
    }
    data.truncate((written as usize).min(data.len()));
    let text_bytes = data.strip_suffix(&[0]).unwrap_or(&data);
    let text = String::from_utf8_lossy(text_bytes).to_string();
    Ok(Some(LobbyChatEntry {
        steam_id: csteam_id_to_player(steam_id),
        size: data.len() as u32,
        text,
        data: data.into(),
        entry_type: entry_type as u32,
    }))
}

#[napi(js_name = "matchmakingRequestLobbyData")]
pub fn matchmaking_request_lobby_data(lobby_id: BigInt) -> Result<bool, Error> {
    Ok(unsafe {
        sys::SteamAPI_ISteamMatchmaking_RequestLobbyData(
            steam_matchmaking()?,
            bigint_to_u64(lobby_id, "lobby id")?,
        )
    })
}

#[napi(js_name = "matchmakingSetLobbyGameServer")]
pub fn matchmaking_set_lobby_game_server(
    lobby_id: BigInt,
    ip: u32,
    port: u32,
    steam_id64: BigInt,
) -> Result<(), Error> {
    unsafe {
        sys::SteamAPI_ISteamMatchmaking_SetLobbyGameServer(
            steam_matchmaking()?,
            bigint_to_u64(lobby_id, "lobby id")?,
            ip,
            port_to_u16(port, "lobby game server port")?,
            bigint_to_u64(steam_id64, "game server steamId64")?,
        )
    };
    Ok(())
}

#[napi(js_name = "matchmakingGetLobbyGameServer")]
pub fn matchmaking_get_lobby_game_server(
    lobby_id: BigInt,
) -> Result<Option<LobbyGameServer>, Error> {
    let mut ip = 0;
    let mut port = 0;
    let mut steam_id = u64_to_csteam_id(0);
    let ok = unsafe {
        sys::SteamAPI_ISteamMatchmaking_GetLobbyGameServer(
            steam_matchmaking()?,
            bigint_to_u64(lobby_id, "lobby id")?,
            &mut ip,
            &mut port,
            &mut steam_id,
        )
    };
    Ok(ok.then(|| LobbyGameServer {
        ip,
        ip_address: ipv4_to_string(ip),
        port: u32::from(port),
        steam_id: csteam_id_to_player(steam_id),
    }))
}

#[napi(js_name = "matchmakingSetLobbyMemberLimit")]
pub fn matchmaking_set_lobby_member_limit(
    lobby_id: BigInt,
    max_members: i32,
) -> Result<bool, Error> {
    Ok(unsafe {
        sys::SteamAPI_ISteamMatchmaking_SetLobbyMemberLimit(
            steam_matchmaking()?,
            bigint_to_u64(lobby_id, "lobby id")?,
            max_members,
        )
    })
}

#[napi(js_name = "matchmakingSetLobbyType")]
pub fn matchmaking_set_lobby_type(lobby_id: BigInt, lobby_type: u32) -> Result<bool, Error> {
    Ok(unsafe {
        sys::SteamAPI_ISteamMatchmaking_SetLobbyType(
            steam_matchmaking()?,
            bigint_to_u64(lobby_id, "lobby id")?,
            lobby_type_from_u32(lobby_type)?,
        )
    })
}

#[napi(js_name = "matchmakingSetLobbyOwner")]
pub fn matchmaking_set_lobby_owner(lobby_id: BigInt, steam_id64: BigInt) -> Result<bool, Error> {
    Ok(unsafe {
        sys::SteamAPI_ISteamMatchmaking_SetLobbyOwner(
            steam_matchmaking()?,
            bigint_to_u64(lobby_id, "lobby id")?,
            bigint_to_u64(steam_id64, "steamId64")?,
        )
    })
}

#[napi(js_name = "matchmakingSetLinkedLobby")]
pub fn matchmaking_set_linked_lobby(
    lobby_id: BigInt,
    dependent_lobby_id: BigInt,
) -> Result<bool, Error> {
    Ok(unsafe {
        sys::SteamAPI_ISteamMatchmaking_SetLinkedLobby(
            steam_matchmaking()?,
            bigint_to_u64(lobby_id, "lobby id")?,
            bigint_to_u64(dependent_lobby_id, "dependent lobby id")?,
        )
    })
}

#[napi(js_name = "workshopCreateItem")]
pub async fn workshop_create_item(app_id: Option<u32>) -> Result<UgcResult, Error> {
    let app_id = app_id.unwrap_or(unsafe { sys::SteamAPI_ISteamUtils_GetAppID(workshop_utils()?) });
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
    let app_id = app_id.unwrap_or(unsafe { sys::SteamAPI_ISteamUtils_GetAppID(workshop_utils()?) });
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
        "language",
        &mut keepalive,
        |ugc, handle, value| unsafe {
            sys::SteamAPI_ISteamUGC_SetItemUpdateLanguage(ugc, handle, value)
        },
    )?;
    set_optional_item_string(
        ugc,
        handle,
        &update_details,
        "metadata",
        &mut keepalive,
        |ugc, handle, value| unsafe { sys::SteamAPI_ISteamUGC_SetItemMetadata(ugc, handle, value) },
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

    if let Some(allow) = update_details
        .get("allowLegacyUpload")
        .and_then(Value::as_bool)
    {
        unsafe { sys::SteamAPI_ISteamUGC_SetAllowLegacyUpload(ugc, handle, allow) };
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

    if update_details
        .get("removeAllKeyValueTags")
        .and_then(Value::as_bool)
        .unwrap_or(false)
    {
        unsafe { sys::SteamAPI_ISteamUGC_RemoveAllItemKeyValueTags(ugc, handle) };
    }

    if let Some(keys) = update_details
        .get("removeKeyValueTags")
        .and_then(Value::as_array)
    {
        for key in keys.iter().filter_map(Value::as_str) {
            let key = CString::new(key).map_err(|_| {
                Error::from_reason("workshop key-value tag key contains a NUL byte")
            })?;
            unsafe { sys::SteamAPI_ISteamUGC_RemoveItemKeyValueTags(ugc, handle, key.as_ptr()) };
        }
    }

    if let Some(tags) = update_details.get("keyValueTags") {
        for (key, value) in string_pairs_from_value(tags, "workshop key-value tag")? {
            let key = CString::new(key).map_err(|_| {
                Error::from_reason("workshop key-value tag key contains a NUL byte")
            })?;
            let value = CString::new(value).map_err(|_| {
                Error::from_reason("workshop key-value tag value contains a NUL byte")
            })?;
            unsafe {
                sys::SteamAPI_ISteamUGC_AddItemKeyValueTag(
                    ugc,
                    handle,
                    key.as_ptr(),
                    value.as_ptr(),
                )
            };
        }
    }

    if let Some(previews) = update_details.get("previewFiles").and_then(Value::as_array) {
        for preview in previews {
            let Some(path) = preview.get("path").and_then(Value::as_str) else {
                return Err(Error::from_reason("workshop preview file path is required"));
            };
            let preview_type = preview
                .get("type")
                .and_then(Value::as_u64)
                .map(|value| item_preview_type_from_u32(value as u32))
                .transpose()?
                .unwrap_or(sys::EItemPreviewType::k_EItemPreviewType_Image);
            let path = CString::new(path).map_err(|_| {
                Error::from_reason("workshop preview file path contains a NUL byte")
            })?;
            unsafe {
                sys::SteamAPI_ISteamUGC_AddItemPreviewFile(ugc, handle, path.as_ptr(), preview_type)
            };
        }
    }

    if let Some(videos) = update_details
        .get("previewVideos")
        .and_then(Value::as_array)
    {
        for video_id in videos.iter().filter_map(Value::as_str) {
            let video_id = CString::new(video_id)
                .map_err(|_| Error::from_reason("workshop preview video id contains a NUL byte"))?;
            unsafe { sys::SteamAPI_ISteamUGC_AddItemPreviewVideo(ugc, handle, video_id.as_ptr()) };
        }
    }

    if let Some(previews) = update_details
        .get("updatePreviewFiles")
        .and_then(Value::as_array)
    {
        for preview in previews {
            let index = value_u32(preview, "index", "workshop preview file index")?;
            let Some(path) = preview.get("path").and_then(Value::as_str) else {
                return Err(Error::from_reason("workshop preview file path is required"));
            };
            let path = CString::new(path).map_err(|_| {
                Error::from_reason("workshop preview file path contains a NUL byte")
            })?;
            unsafe {
                sys::SteamAPI_ISteamUGC_UpdateItemPreviewFile(ugc, handle, index, path.as_ptr())
            };
        }
    }

    if let Some(videos) = update_details
        .get("updatePreviewVideos")
        .and_then(Value::as_array)
    {
        for video in videos {
            let index = value_u32(video, "index", "workshop preview video index")?;
            let Some(video_id) = video
                .get("videoId")
                .or_else(|| video.get("video_id"))
                .and_then(Value::as_str)
            else {
                return Err(Error::from_reason("workshop preview video id is required"));
            };
            let video_id = CString::new(video_id)
                .map_err(|_| Error::from_reason("workshop preview video id contains a NUL byte"))?;
            unsafe {
                sys::SteamAPI_ISteamUGC_UpdateItemPreviewVideo(
                    ugc,
                    handle,
                    index,
                    video_id.as_ptr(),
                )
            };
        }
    }

    if let Some(indexes) = update_details
        .get("removePreviews")
        .and_then(Value::as_array)
    {
        for index in indexes.iter().filter_map(Value::as_u64) {
            unsafe { sys::SteamAPI_ISteamUGC_RemoveItemPreview(ugc, handle, index as u32) };
        }
    }

    if let Some(descriptors) = update_details
        .get("contentDescriptors")
        .and_then(Value::as_array)
    {
        for descriptor in descriptors.iter().filter_map(Value::as_u64) {
            unsafe {
                sys::SteamAPI_ISteamUGC_AddContentDescriptor(
                    ugc,
                    handle,
                    ugc_content_descriptor_from_u32(descriptor as u32)?,
                )
            };
        }
    }

    if let Some(descriptors) = update_details
        .get("removeContentDescriptors")
        .and_then(Value::as_array)
    {
        for descriptor in descriptors.iter().filter_map(Value::as_u64) {
            unsafe {
                sys::SteamAPI_ISteamUGC_RemoveContentDescriptor(
                    ugc,
                    handle,
                    ugc_content_descriptor_from_u32(descriptor as u32)?,
                )
            };
        }
    }

    if let Some(versions) = update_details.get("requiredGameVersions") {
        let Some(min) = versions
            .get("min")
            .or_else(|| versions.get("gameBranchMin"))
            .or_else(|| versions.get("game_branch_min"))
            .and_then(Value::as_str)
        else {
            return Err(Error::from_reason(
                "workshop required game version min is required",
            ));
        };
        let Some(max) = versions
            .get("max")
            .or_else(|| versions.get("gameBranchMax"))
            .or_else(|| versions.get("game_branch_max"))
            .and_then(Value::as_str)
        else {
            return Err(Error::from_reason(
                "workshop required game version max is required",
            ));
        };
        let min = CString::new(min)
            .map_err(|_| Error::from_reason("workshop game branch min contains a NUL byte"))?;
        let max = CString::new(max)
            .map_err(|_| Error::from_reason("workshop game branch max contains a NUL byte"))?;
        unsafe {
            sys::SteamAPI_ISteamUGC_SetRequiredGameVersions(ugc, handle, min.as_ptr(), max.as_ptr())
        };
        keepalive.push(min);
        keepalive.push(max);
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

fn workshop_item_id_vec(item_ids: Vec<BigInt>) -> Result<Vec<u64>, Error> {
    if item_ids.is_empty() {
        return Err(Error::from_reason(
            "at least one workshop item id is required",
        ));
    }
    item_ids
        .into_iter()
        .map(|id| bigint_to_u64(id, "item id"))
        .collect()
}

fn workshop_favorite_result(
    result: &sys::UserFavoriteItemsListChanged_t,
) -> WorkshopFavoriteResult {
    WorkshopFavoriteResult {
        result: unsafe { ptr::addr_of!(result.m_eResult).read_unaligned() } as u32,
        item_id: unsafe { ptr::addr_of!(result.m_nPublishedFileId).read_unaligned() }.into(),
        was_add_request: unsafe { ptr::addr_of!(result.m_bWasAddRequest).read_unaligned() },
    }
}

fn workshop_set_user_item_vote_result(
    result: &sys::SetUserItemVoteResult_t,
) -> WorkshopSetUserItemVoteResult {
    WorkshopSetUserItemVoteResult {
        result: unsafe { ptr::addr_of!(result.m_eResult).read_unaligned() } as u32,
        item_id: unsafe { ptr::addr_of!(result.m_nPublishedFileId).read_unaligned() }.into(),
        vote_up: unsafe { ptr::addr_of!(result.m_bVoteUp).read_unaligned() },
    }
}

fn workshop_get_user_item_vote_result(
    result: &sys::GetUserItemVoteResult_t,
) -> WorkshopGetUserItemVoteResult {
    WorkshopGetUserItemVoteResult {
        result: unsafe { ptr::addr_of!(result.m_eResult).read_unaligned() } as u32,
        item_id: unsafe { ptr::addr_of!(result.m_nPublishedFileId).read_unaligned() }.into(),
        voted_up: unsafe { ptr::addr_of!(result.m_bVotedUp).read_unaligned() },
        voted_down: unsafe { ptr::addr_of!(result.m_bVotedDown).read_unaligned() },
        vote_skipped: unsafe { ptr::addr_of!(result.m_bVoteSkipped).read_unaligned() },
    }
}

fn workshop_dependency_result(
    result: u32,
    item_id: u64,
    child_item_id: u64,
) -> WorkshopDependencyResult {
    WorkshopDependencyResult {
        result,
        item_id: item_id.into(),
        child_item_id: child_item_id.into(),
    }
}

fn workshop_app_dependency_result(
    result: u32,
    item_id: u64,
    app_id: u32,
) -> WorkshopAppDependencyResult {
    WorkshopAppDependencyResult {
        result,
        item_id: item_id.into(),
        app_id,
    }
}

fn ugc_details_json(details: &sys::SteamUGCDetails_t) -> Value {
    let title = unsafe {
        fixed_char_array_to_string(ptr::addr_of!(details.m_rgchTitle).cast::<c_char>(), 129)
    };
    let description = unsafe {
        fixed_char_array_to_string(
            ptr::addr_of!(details.m_rgchDescription).cast::<c_char>(),
            8000,
        )
    };
    let tags = unsafe {
        fixed_char_array_to_string(ptr::addr_of!(details.m_rgchTags).cast::<c_char>(), 1025)
    };
    let file_name = unsafe {
        fixed_char_array_to_string(ptr::addr_of!(details.m_pchFileName).cast::<c_char>(), 260)
    };
    let url = unsafe {
        fixed_char_array_to_string(ptr::addr_of!(details.m_rgchURL).cast::<c_char>(), 256)
    };

    serde_json::json!({
        "published_file_id": unsafe { ptr::addr_of!(details.m_nPublishedFileId).read_unaligned() }.to_string(),
        "result": unsafe { ptr::addr_of!(details.m_eResult).read_unaligned() } as u32,
        "file_type": unsafe { ptr::addr_of!(details.m_eFileType).read_unaligned() } as u32,
        "creator_app_id": unsafe { ptr::addr_of!(details.m_nCreatorAppID).read_unaligned() },
        "consumer_app_id": unsafe { ptr::addr_of!(details.m_nConsumerAppID).read_unaligned() },
        "title": title,
        "description": description,
        "owner": unsafe { ptr::addr_of!(details.m_ulSteamIDOwner).read_unaligned() }.to_string(),
        "time_created": unsafe { ptr::addr_of!(details.m_rtimeCreated).read_unaligned() },
        "time_updated": unsafe { ptr::addr_of!(details.m_rtimeUpdated).read_unaligned() },
        "time_added_to_user_list": unsafe { ptr::addr_of!(details.m_rtimeAddedToUserList).read_unaligned() },
        "visibility": unsafe { ptr::addr_of!(details.m_eVisibility).read_unaligned() } as u32,
        "banned": unsafe { ptr::addr_of!(details.m_bBanned).read_unaligned() },
        "accepted_for_use": unsafe { ptr::addr_of!(details.m_bAcceptedForUse).read_unaligned() },
        "tags_truncated": unsafe { ptr::addr_of!(details.m_bTagsTruncated).read_unaligned() },
        "tags": tags,
        "file": unsafe { ptr::addr_of!(details.m_hFile).read_unaligned() }.to_string(),
        "preview_file": unsafe { ptr::addr_of!(details.m_hPreviewFile).read_unaligned() }.to_string(),
        "file_name": file_name,
        "file_size": unsafe { ptr::addr_of!(details.m_nFileSize).read_unaligned() }.max(0).to_string(),
        "preview_file_size": unsafe { ptr::addr_of!(details.m_nPreviewFileSize).read_unaligned() }.max(0).to_string(),
        "url": url,
        "num_upvotes": unsafe { ptr::addr_of!(details.m_unVotesUp).read_unaligned() },
        "num_downvotes": unsafe { ptr::addr_of!(details.m_unVotesDown).read_unaligned() },
        "score": unsafe { ptr::addr_of!(details.m_flScore).read_unaligned() },
        "num_children": unsafe { ptr::addr_of!(details.m_unNumChildren).read_unaligned() },
        "total_files_size": unsafe { ptr::addr_of!(details.m_ulTotalFilesSize).read_unaligned() }.to_string()
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

#[napi(js_name = "workshopAddFavorite")]
pub async fn workshop_add_favorite(
    item_id: BigInt,
    app_id: Option<u32>,
) -> Result<WorkshopFavoriteResult, Error> {
    let app_id = app_id.unwrap_or(unsafe { sys::SteamAPI_ISteamUtils_GetAppID(workshop_utils()?) });
    let item_id = bigint_to_u64(item_id, "item id")?;
    let call = unsafe { sys::SteamAPI_ISteamUGC_AddItemToFavorites(steam_ugc()?, app_id, item_id) };
    let result: sys::UserFavoriteItemsListChanged_t = wait_for_api_call(
        call,
        sys::UserFavoriteItemsListChanged_t_k_iCallback as i32,
        DEFAULT_ASYNC_TIMEOUT_SECONDS,
    )
    .await?;
    Ok(workshop_favorite_result(&result))
}

#[napi(js_name = "workshopRemoveFavorite")]
pub async fn workshop_remove_favorite(
    item_id: BigInt,
    app_id: Option<u32>,
) -> Result<WorkshopFavoriteResult, Error> {
    let app_id = app_id.unwrap_or(unsafe { sys::SteamAPI_ISteamUtils_GetAppID(workshop_utils()?) });
    let item_id = bigint_to_u64(item_id, "item id")?;
    let call =
        unsafe { sys::SteamAPI_ISteamUGC_RemoveItemFromFavorites(steam_ugc()?, app_id, item_id) };
    let result: sys::UserFavoriteItemsListChanged_t = wait_for_api_call(
        call,
        sys::UserFavoriteItemsListChanged_t_k_iCallback as i32,
        DEFAULT_ASYNC_TIMEOUT_SECONDS,
    )
    .await?;
    Ok(workshop_favorite_result(&result))
}

#[napi(js_name = "workshopSetUserItemVote")]
pub async fn workshop_set_user_item_vote(
    item_id: BigInt,
    vote_up: bool,
) -> Result<WorkshopSetUserItemVoteResult, Error> {
    let item_id = bigint_to_u64(item_id, "item id")?;
    let call = unsafe { sys::SteamAPI_ISteamUGC_SetUserItemVote(steam_ugc()?, item_id, vote_up) };
    let result: sys::SetUserItemVoteResult_t = wait_for_api_call(
        call,
        sys::SetUserItemVoteResult_t_k_iCallback as i32,
        DEFAULT_ASYNC_TIMEOUT_SECONDS,
    )
    .await?;
    Ok(workshop_set_user_item_vote_result(&result))
}

#[napi(js_name = "workshopGetUserItemVote")]
pub async fn workshop_get_user_item_vote(
    item_id: BigInt,
) -> Result<WorkshopGetUserItemVoteResult, Error> {
    let item_id = bigint_to_u64(item_id, "item id")?;
    let call = unsafe { sys::SteamAPI_ISteamUGC_GetUserItemVote(steam_ugc()?, item_id) };
    let result: sys::GetUserItemVoteResult_t = wait_for_api_call(
        call,
        sys::GetUserItemVoteResult_t_k_iCallback as i32,
        DEFAULT_ASYNC_TIMEOUT_SECONDS,
    )
    .await?;
    Ok(workshop_get_user_item_vote_result(&result))
}

#[napi(js_name = "workshopStartPlaytimeTracking")]
pub async fn workshop_start_playtime_tracking(
    item_ids: Vec<BigInt>,
) -> Result<WorkshopSimpleResult, Error> {
    let mut ids = workshop_item_id_vec(item_ids)?;
    let call = unsafe {
        sys::SteamAPI_ISteamUGC_StartPlaytimeTracking(
            steam_ugc()?,
            ids.as_mut_ptr(),
            ids.len() as u32,
        )
    };
    let result: sys::StartPlaytimeTrackingResult_t = wait_for_api_call(
        call,
        sys::StartPlaytimeTrackingResult_t_k_iCallback as i32,
        DEFAULT_ASYNC_TIMEOUT_SECONDS,
    )
    .await?;
    Ok(WorkshopSimpleResult {
        result: unsafe { ptr::addr_of!(result.m_eResult).read_unaligned() } as u32,
    })
}

#[napi(js_name = "workshopStopPlaytimeTracking")]
pub async fn workshop_stop_playtime_tracking(
    item_ids: Vec<BigInt>,
) -> Result<WorkshopSimpleResult, Error> {
    let mut ids = workshop_item_id_vec(item_ids)?;
    let call = unsafe {
        sys::SteamAPI_ISteamUGC_StopPlaytimeTracking(
            steam_ugc()?,
            ids.as_mut_ptr(),
            ids.len() as u32,
        )
    };
    let result: sys::StopPlaytimeTrackingResult_t = wait_for_api_call(
        call,
        sys::StopPlaytimeTrackingResult_t_k_iCallback as i32,
        DEFAULT_ASYNC_TIMEOUT_SECONDS,
    )
    .await?;
    Ok(WorkshopSimpleResult {
        result: unsafe { ptr::addr_of!(result.m_eResult).read_unaligned() } as u32,
    })
}

#[napi(js_name = "workshopStopPlaytimeTrackingForAllItems")]
pub async fn workshop_stop_playtime_tracking_for_all_items() -> Result<WorkshopSimpleResult, Error>
{
    let call = unsafe { sys::SteamAPI_ISteamUGC_StopPlaytimeTrackingForAllItems(steam_ugc()?) };
    let result: sys::StopPlaytimeTrackingResult_t = wait_for_api_call(
        call,
        sys::StopPlaytimeTrackingResult_t_k_iCallback as i32,
        DEFAULT_ASYNC_TIMEOUT_SECONDS,
    )
    .await?;
    Ok(WorkshopSimpleResult {
        result: unsafe { ptr::addr_of!(result.m_eResult).read_unaligned() } as u32,
    })
}

#[napi(js_name = "workshopAddDependency")]
pub async fn workshop_add_dependency(
    parent_item_id: BigInt,
    child_item_id: BigInt,
) -> Result<WorkshopDependencyResult, Error> {
    let parent_item_id = bigint_to_u64(parent_item_id, "parent item id")?;
    let child_item_id = bigint_to_u64(child_item_id, "child item id")?;
    let call = unsafe {
        sys::SteamAPI_ISteamUGC_AddDependency(steam_ugc()?, parent_item_id, child_item_id)
    };
    let result: sys::AddUGCDependencyResult_t = wait_for_api_call(
        call,
        sys::AddUGCDependencyResult_t_k_iCallback as i32,
        DEFAULT_ASYNC_TIMEOUT_SECONDS,
    )
    .await?;
    Ok(workshop_dependency_result(
        unsafe { ptr::addr_of!(result.m_eResult).read_unaligned() } as u32,
        unsafe { ptr::addr_of!(result.m_nPublishedFileId).read_unaligned() },
        unsafe { ptr::addr_of!(result.m_nChildPublishedFileId).read_unaligned() },
    ))
}

#[napi(js_name = "workshopRemoveDependency")]
pub async fn workshop_remove_dependency(
    parent_item_id: BigInt,
    child_item_id: BigInt,
) -> Result<WorkshopDependencyResult, Error> {
    let parent_item_id = bigint_to_u64(parent_item_id, "parent item id")?;
    let child_item_id = bigint_to_u64(child_item_id, "child item id")?;
    let call = unsafe {
        sys::SteamAPI_ISteamUGC_RemoveDependency(steam_ugc()?, parent_item_id, child_item_id)
    };
    let result: sys::RemoveUGCDependencyResult_t = wait_for_api_call(
        call,
        sys::RemoveUGCDependencyResult_t_k_iCallback as i32,
        DEFAULT_ASYNC_TIMEOUT_SECONDS,
    )
    .await?;
    Ok(workshop_dependency_result(
        unsafe { ptr::addr_of!(result.m_eResult).read_unaligned() } as u32,
        unsafe { ptr::addr_of!(result.m_nPublishedFileId).read_unaligned() },
        unsafe { ptr::addr_of!(result.m_nChildPublishedFileId).read_unaligned() },
    ))
}

#[napi(js_name = "workshopAddAppDependency")]
pub async fn workshop_add_app_dependency(
    item_id: BigInt,
    app_id: u32,
) -> Result<WorkshopAppDependencyResult, Error> {
    let item_id = bigint_to_u64(item_id, "item id")?;
    let call = unsafe { sys::SteamAPI_ISteamUGC_AddAppDependency(steam_ugc()?, item_id, app_id) };
    let result: sys::AddAppDependencyResult_t = wait_for_api_call(
        call,
        sys::AddAppDependencyResult_t_k_iCallback as i32,
        DEFAULT_ASYNC_TIMEOUT_SECONDS,
    )
    .await?;
    Ok(workshop_app_dependency_result(
        unsafe { ptr::addr_of!(result.m_eResult).read_unaligned() } as u32,
        unsafe { ptr::addr_of!(result.m_nPublishedFileId).read_unaligned() },
        unsafe { ptr::addr_of!(result.m_nAppID).read_unaligned() },
    ))
}

#[napi(js_name = "workshopRemoveAppDependency")]
pub async fn workshop_remove_app_dependency(
    item_id: BigInt,
    app_id: u32,
) -> Result<WorkshopAppDependencyResult, Error> {
    let item_id = bigint_to_u64(item_id, "item id")?;
    let call =
        unsafe { sys::SteamAPI_ISteamUGC_RemoveAppDependency(steam_ugc()?, item_id, app_id) };
    let result: sys::RemoveAppDependencyResult_t = wait_for_api_call(
        call,
        sys::RemoveAppDependencyResult_t_k_iCallback as i32,
        DEFAULT_ASYNC_TIMEOUT_SECONDS,
    )
    .await?;
    Ok(workshop_app_dependency_result(
        unsafe { ptr::addr_of!(result.m_eResult).read_unaligned() } as u32,
        unsafe { ptr::addr_of!(result.m_nPublishedFileId).read_unaligned() },
        unsafe { ptr::addr_of!(result.m_nAppID).read_unaligned() },
    ))
}

#[napi(js_name = "workshopGetAppDependencies")]
pub async fn workshop_get_app_dependencies(
    item_id: BigInt,
) -> Result<WorkshopAppDependenciesResult, Error> {
    let item_id = bigint_to_u64(item_id, "item id")?;
    let call = unsafe { sys::SteamAPI_ISteamUGC_GetAppDependencies(steam_ugc()?, item_id) };
    let result: sys::GetAppDependenciesResult_t = wait_for_api_call(
        call,
        sys::GetAppDependenciesResult_t_k_iCallback as i32,
        DEFAULT_ASYNC_TIMEOUT_SECONDS,
    )
    .await?;
    let count = unsafe { ptr::addr_of!(result.m_nNumAppDependencies).read_unaligned() };
    let app_ids = unsafe { ptr::addr_of!(result.m_rgAppIDs).read_unaligned() };
    Ok(WorkshopAppDependenciesResult {
        result: unsafe { ptr::addr_of!(result.m_eResult).read_unaligned() } as u32,
        item_id: unsafe { ptr::addr_of!(result.m_nPublishedFileId).read_unaligned() }.into(),
        app_ids: app_ids
            .into_iter()
            .take((count as usize).min(app_ids.len()))
            .collect(),
        num_app_dependencies: count,
        total_num_app_dependencies: unsafe {
            ptr::addr_of!(result.m_nTotalNumAppDependencies).read_unaligned()
        },
    })
}

#[napi(js_name = "workshopDeleteItem")]
pub async fn workshop_delete_item(item_id: BigInt) -> Result<WorkshopDeleteItemResult, Error> {
    let item_id = bigint_to_u64(item_id, "item id")?;
    let call = unsafe { sys::SteamAPI_ISteamUGC_DeleteItem(steam_ugc()?, item_id) };
    let result: sys::DeleteItemResult_t = wait_for_api_call(
        call,
        sys::DeleteItemResult_t_k_iCallback as i32,
        DEFAULT_ASYNC_TIMEOUT_SECONDS,
    )
    .await?;
    Ok(WorkshopDeleteItemResult {
        result: unsafe { ptr::addr_of!(result.m_eResult).read_unaligned() } as u32,
        item_id: unsafe { ptr::addr_of!(result.m_nPublishedFileId).read_unaligned() }.into(),
    })
}

#[napi(js_name = "workshopShowEula")]
pub fn workshop_show_eula() -> Result<bool, Error> {
    Ok(unsafe { sys::SteamAPI_ISteamUGC_ShowWorkshopEULA(steam_ugc()?) })
}

#[napi(js_name = "workshopGetEulaStatus")]
pub async fn workshop_get_eula_status() -> Result<WorkshopEulaStatus, Error> {
    let call = unsafe { sys::SteamAPI_ISteamUGC_GetWorkshopEULAStatus(steam_ugc()?) };
    let result: sys::WorkshopEULAStatus_t = wait_for_api_call(
        call,
        sys::WorkshopEULAStatus_t_k_iCallback as i32,
        DEFAULT_ASYNC_TIMEOUT_SECONDS,
    )
    .await?;
    Ok(WorkshopEulaStatus {
        result: unsafe { ptr::addr_of!(result.m_eResult).read_unaligned() } as u32,
        app_id: unsafe { ptr::addr_of!(result.m_nAppID).read_unaligned() },
        version: unsafe { ptr::addr_of!(result.m_unVersion).read_unaligned() },
        action_time: unsafe { ptr::addr_of!(result.m_rtAction).read_unaligned() },
        accepted: unsafe { ptr::addr_of!(result.m_bAccepted).read_unaligned() },
        needs_action: unsafe { ptr::addr_of!(result.m_bNeedsAction).read_unaligned() },
    })
}

#[napi(js_name = "workshopGetUserContentDescriptorPreferences")]
pub fn workshop_get_user_content_descriptor_preferences(
    max_entries: Option<u32>,
) -> Result<Vec<u32>, Error> {
    let max_entries = max_entries.unwrap_or(16).clamp(1, 64);
    let mut descriptors = vec![
            sys::EUGCContentDescriptorID::k_EUGCContentDescriptor_AnyMatureContent;
            max_entries as usize
        ];
    let count = unsafe {
        sys::SteamAPI_ISteamUGC_GetUserContentDescriptorPreferences(
            steam_ugc()?,
            descriptors.as_mut_ptr(),
            max_entries,
        )
    };
    descriptors.truncate((count as usize).min(descriptors.len()));
    Ok(descriptors
        .into_iter()
        .map(|descriptor| descriptor as u32)
        .collect())
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

#[napi(js_name = "workshopInitWorkshopForGameServer")]
pub fn workshop_init_workshop_for_game_server(
    depot_id: u32,
    folder: String,
) -> Result<bool, Error> {
    let folder = cstring(folder, "workshop game server folder")?;
    Ok(unsafe {
        sys::SteamAPI_ISteamUGC_BInitWorkshopForGameServer(steam_ugc()?, depot_id, folder.as_ptr())
    })
}

#[napi(js_name = "workshopSuspendDownloads")]
pub fn workshop_suspend_downloads(suspend: bool) -> Result<(), Error> {
    unsafe { sys::SteamAPI_ISteamUGC_SuspendDownloads(steam_ugc()?, suspend) };
    Ok(())
}

#[napi(js_name = "workshopSetItemsDisabledLocally")]
pub fn workshop_set_items_disabled_locally(
    item_ids: Vec<BigInt>,
    disabled: bool,
) -> Result<bool, Error> {
    let mut ids = workshop_item_id_vec(item_ids)?;
    Ok(unsafe {
        sys::SteamAPI_ISteamUGC_SetItemsDisabledLocally(
            steam_ugc()?,
            ids.as_mut_ptr(),
            ids.len() as u32,
            disabled,
        )
    })
}

#[napi(js_name = "workshopSetSubscriptionsLoadOrder")]
pub fn workshop_set_subscriptions_load_order(item_ids: Vec<BigInt>) -> Result<bool, Error> {
    let mut ids = workshop_item_id_vec(item_ids)?;
    Ok(unsafe {
        sys::SteamAPI_ISteamUGC_SetSubscriptionsLoadOrder(
            steam_ugc()?,
            ids.as_mut_ptr(),
            ids.len() as u32,
        )
    })
}

#[napi(js_name = "workshopMarkDownloadedItemAsUnused")]
pub fn workshop_mark_downloaded_item_as_unused(item_id: BigInt) -> Result<bool, Error> {
    Ok(unsafe {
        sys::SteamAPI_ISteamUGC_MarkDownloadedItemAsUnused(
            steam_ugc()?,
            bigint_to_u64(item_id, "item id")?,
        )
    })
}

#[napi(js_name = "workshopGetDownloadedItems")]
pub fn workshop_get_downloaded_items(max_entries: Option<u32>) -> Result<Vec<BigInt>, Error> {
    let ugc = steam_ugc()?;
    let count = unsafe { sys::SteamAPI_ISteamUGC_GetNumDownloadedItems(ugc) };
    let max_entries = max_entries.unwrap_or(count).min(count);
    if max_entries == 0 {
        return Ok(Vec::new());
    }
    let mut ids = vec![0u64; max_entries as usize];
    let written =
        unsafe { sys::SteamAPI_ISteamUGC_GetDownloadedItems(ugc, ids.as_mut_ptr(), max_entries) };
    ids.truncate((written as usize).min(ids.len()));
    Ok(ids.into_iter().map(Into::into).collect())
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
    let items = collect_query_items(ugc, handle, &result, query_config.as_ref())?;
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
    let items = collect_query_items(ugc, handle, &result, query_config.as_ref())?;
    unsafe { sys::SteamAPI_ISteamUGC_ReleaseQueryUGCRequest(ugc, handle) };
    Ok(items)
}

#[napi(js_name = "workshopGetAllItemsByCursor")]
pub async fn workshop_get_all_items_by_cursor(
    cursor: String,
    query_type: u32,
    item_type: i32,
    creator_app_id: u32,
    consumer_app_id: u32,
    query_config: Option<Value>,
) -> Result<WorkshopItemsResult, Error> {
    let cursor = cstring(cursor, "workshop query cursor")?;
    let handle;
    let call = {
        let ugc = steam_ugc()?;
        handle = unsafe {
            sys::SteamAPI_ISteamUGC_CreateQueryAllUGCRequestCursor(
                ugc,
                ugc_query_from_u32(query_type)?,
                ugc_matching_type_from_i32(item_type)?,
                creator_app_id,
                consumer_app_id,
                cursor.as_ptr(),
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
    let items = collect_query_items(ugc, handle, &result, query_config.as_ref())?;
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
    let items = collect_query_items(ugc, handle, &result, query_config.as_ref())?;
    unsafe { sys::SteamAPI_ISteamUGC_ReleaseQueryUGCRequest(ugc, handle) };
    Ok(items)
}

#[napi(js_name = "workshopRequestItemDetails")]
pub async fn workshop_request_item_details(
    item_id: BigInt,
    max_age_seconds: Option<u32>,
) -> Result<Value, Error> {
    let call = unsafe {
        sys::SteamAPI_ISteamUGC_RequestUGCDetails(
            steam_ugc()?,
            bigint_to_u64(item_id, "item id")?,
            max_age_seconds.unwrap_or(0),
        )
    };
    let result: sys::SteamUGCRequestUGCDetailsResult_t = wait_for_api_call(
        call,
        sys::SteamUGCRequestUGCDetailsResult_t_k_iCallback as i32,
        DEFAULT_ASYNC_TIMEOUT_SECONDS,
    )
    .await?;
    Ok(serde_json::json!({
        "details": ugc_details_json(&result.m_details),
        "was_cached": unsafe { ptr::addr_of!(result.m_bCachedData).read_unaligned() }
    }))
}

#[napi(js_name = "gameServerWorkshopCreateItem")]
pub async fn game_server_workshop_create_item(app_id: Option<u32>) -> Result<UgcResult, Error> {
    with_game_server_workshop_future(workshop_create_item(app_id)).await
}

#[napi(js_name = "gameServerWorkshopUpdateItem")]
pub async fn game_server_workshop_update_item(
    item_id: BigInt,
    update_details: Value,
    app_id: Option<u32>,
) -> Result<UgcResult, Error> {
    with_game_server_workshop_future(workshop_update_item(item_id, update_details, app_id)).await
}

#[napi(js_name = "gameServerWorkshopUpdateItemWithProgress")]
pub fn game_server_workshop_update_item_with_progress(
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
        with_game_server_workshop_future(async move {
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
        }),
        |env, result| unsafe { UgcResult::to_napi_value(env, result) },
    )?;

    Ok(PromiseRaw::new(raw_env, promise))
}

#[napi(js_name = "gameServerWorkshopGetItemUpdateProgress")]
pub fn game_server_workshop_get_item_update_progress(
    handle: BigInt,
) -> Result<UpdateProgress, Error> {
    with_game_server_workshop(|| workshop_get_item_update_progress(handle))
}

#[napi(js_name = "gameServerWorkshopSubscribe")]
pub async fn game_server_workshop_subscribe(item_id: BigInt) -> Result<(), Error> {
    with_game_server_workshop_future(workshop_subscribe(item_id)).await
}

#[napi(js_name = "gameServerWorkshopUnsubscribe")]
pub async fn game_server_workshop_unsubscribe(item_id: BigInt) -> Result<(), Error> {
    with_game_server_workshop_future(workshop_unsubscribe(item_id)).await
}

#[napi(js_name = "gameServerWorkshopAddFavorite")]
pub async fn game_server_workshop_add_favorite(
    item_id: BigInt,
    app_id: Option<u32>,
) -> Result<WorkshopFavoriteResult, Error> {
    with_game_server_workshop_future(workshop_add_favorite(item_id, app_id)).await
}

#[napi(js_name = "gameServerWorkshopRemoveFavorite")]
pub async fn game_server_workshop_remove_favorite(
    item_id: BigInt,
    app_id: Option<u32>,
) -> Result<WorkshopFavoriteResult, Error> {
    with_game_server_workshop_future(workshop_remove_favorite(item_id, app_id)).await
}

#[napi(js_name = "gameServerWorkshopSetUserItemVote")]
pub async fn game_server_workshop_set_user_item_vote(
    item_id: BigInt,
    vote_up: bool,
) -> Result<WorkshopSetUserItemVoteResult, Error> {
    with_game_server_workshop_future(workshop_set_user_item_vote(item_id, vote_up)).await
}

#[napi(js_name = "gameServerWorkshopGetUserItemVote")]
pub async fn game_server_workshop_get_user_item_vote(
    item_id: BigInt,
) -> Result<WorkshopGetUserItemVoteResult, Error> {
    with_game_server_workshop_future(workshop_get_user_item_vote(item_id)).await
}

#[napi(js_name = "gameServerWorkshopStartPlaytimeTracking")]
pub async fn game_server_workshop_start_playtime_tracking(
    item_ids: Vec<BigInt>,
) -> Result<WorkshopSimpleResult, Error> {
    with_game_server_workshop_future(workshop_start_playtime_tracking(item_ids)).await
}

#[napi(js_name = "gameServerWorkshopStopPlaytimeTracking")]
pub async fn game_server_workshop_stop_playtime_tracking(
    item_ids: Vec<BigInt>,
) -> Result<WorkshopSimpleResult, Error> {
    with_game_server_workshop_future(workshop_stop_playtime_tracking(item_ids)).await
}

#[napi(js_name = "gameServerWorkshopStopPlaytimeTrackingForAllItems")]
pub async fn game_server_workshop_stop_playtime_tracking_for_all_items(
) -> Result<WorkshopSimpleResult, Error> {
    with_game_server_workshop_future(workshop_stop_playtime_tracking_for_all_items()).await
}

#[napi(js_name = "gameServerWorkshopAddDependency")]
pub async fn game_server_workshop_add_dependency(
    parent_item_id: BigInt,
    child_item_id: BigInt,
) -> Result<WorkshopDependencyResult, Error> {
    with_game_server_workshop_future(workshop_add_dependency(parent_item_id, child_item_id)).await
}

#[napi(js_name = "gameServerWorkshopRemoveDependency")]
pub async fn game_server_workshop_remove_dependency(
    parent_item_id: BigInt,
    child_item_id: BigInt,
) -> Result<WorkshopDependencyResult, Error> {
    with_game_server_workshop_future(workshop_remove_dependency(parent_item_id, child_item_id))
        .await
}

#[napi(js_name = "gameServerWorkshopAddAppDependency")]
pub async fn game_server_workshop_add_app_dependency(
    item_id: BigInt,
    app_id: u32,
) -> Result<WorkshopAppDependencyResult, Error> {
    with_game_server_workshop_future(workshop_add_app_dependency(item_id, app_id)).await
}

#[napi(js_name = "gameServerWorkshopRemoveAppDependency")]
pub async fn game_server_workshop_remove_app_dependency(
    item_id: BigInt,
    app_id: u32,
) -> Result<WorkshopAppDependencyResult, Error> {
    with_game_server_workshop_future(workshop_remove_app_dependency(item_id, app_id)).await
}

#[napi(js_name = "gameServerWorkshopGetAppDependencies")]
pub async fn game_server_workshop_get_app_dependencies(
    item_id: BigInt,
) -> Result<WorkshopAppDependenciesResult, Error> {
    with_game_server_workshop_future(workshop_get_app_dependencies(item_id)).await
}

#[napi(js_name = "gameServerWorkshopDeleteItem")]
pub async fn game_server_workshop_delete_item(
    item_id: BigInt,
) -> Result<WorkshopDeleteItemResult, Error> {
    with_game_server_workshop_future(workshop_delete_item(item_id)).await
}

#[napi(js_name = "gameServerWorkshopShowEula")]
pub fn game_server_workshop_show_eula() -> Result<bool, Error> {
    with_game_server_workshop(workshop_show_eula)
}

#[napi(js_name = "gameServerWorkshopGetEulaStatus")]
pub async fn game_server_workshop_get_eula_status() -> Result<WorkshopEulaStatus, Error> {
    with_game_server_workshop_future(workshop_get_eula_status()).await
}

#[napi(js_name = "gameServerWorkshopGetUserContentDescriptorPreferences")]
pub fn game_server_workshop_get_user_content_descriptor_preferences(
    max_entries: Option<u32>,
) -> Result<Vec<u32>, Error> {
    with_game_server_workshop(|| workshop_get_user_content_descriptor_preferences(max_entries))
}

#[napi(js_name = "gameServerWorkshopState")]
pub fn game_server_workshop_state(item_id: BigInt) -> Result<u32, Error> {
    with_game_server_workshop(|| workshop_state(item_id))
}

#[napi(js_name = "gameServerWorkshopInstallInfo")]
pub fn game_server_workshop_install_info(
    item_id: BigInt,
) -> Result<Option<WorkshopInstallInfo>, Error> {
    with_game_server_workshop(|| workshop_install_info(item_id))
}

#[napi(js_name = "gameServerWorkshopDownloadInfo")]
pub fn game_server_workshop_download_info(
    item_id: BigInt,
) -> Result<Option<WorkshopDownloadInfo>, Error> {
    with_game_server_workshop(|| workshop_download_info(item_id))
}

#[napi(js_name = "gameServerWorkshopDownload")]
pub fn game_server_workshop_download(item_id: BigInt, high_priority: bool) -> Result<bool, Error> {
    with_game_server_workshop(|| workshop_download(item_id, high_priority))
}

#[napi(js_name = "gameServerWorkshopInitWorkshopForGameServer")]
pub fn game_server_workshop_init_workshop_for_game_server(
    depot_id: u32,
    folder: String,
) -> Result<bool, Error> {
    with_game_server_workshop(|| workshop_init_workshop_for_game_server(depot_id, folder))
}

#[napi(js_name = "gameServerWorkshopSuspendDownloads")]
pub fn game_server_workshop_suspend_downloads(suspend: bool) -> Result<(), Error> {
    with_game_server_workshop(|| workshop_suspend_downloads(suspend))
}

#[napi(js_name = "gameServerWorkshopSetItemsDisabledLocally")]
pub fn game_server_workshop_set_items_disabled_locally(
    item_ids: Vec<BigInt>,
    disabled: bool,
) -> Result<bool, Error> {
    with_game_server_workshop(|| workshop_set_items_disabled_locally(item_ids, disabled))
}

#[napi(js_name = "gameServerWorkshopSetSubscriptionsLoadOrder")]
pub fn game_server_workshop_set_subscriptions_load_order(
    item_ids: Vec<BigInt>,
) -> Result<bool, Error> {
    with_game_server_workshop(|| workshop_set_subscriptions_load_order(item_ids))
}

#[napi(js_name = "gameServerWorkshopMarkDownloadedItemAsUnused")]
pub fn game_server_workshop_mark_downloaded_item_as_unused(item_id: BigInt) -> Result<bool, Error> {
    with_game_server_workshop(|| workshop_mark_downloaded_item_as_unused(item_id))
}

#[napi(js_name = "gameServerWorkshopGetDownloadedItems")]
pub fn game_server_workshop_get_downloaded_items(
    max_entries: Option<u32>,
) -> Result<Vec<BigInt>, Error> {
    with_game_server_workshop(|| workshop_get_downloaded_items(max_entries))
}

#[napi(js_name = "gameServerWorkshopGetSubscribedItems")]
pub fn game_server_workshop_get_subscribed_items() -> Result<Vec<BigInt>, Error> {
    with_game_server_workshop(workshop_get_subscribed_items)
}

#[napi(js_name = "gameServerWorkshopGetItems")]
pub async fn game_server_workshop_get_items(
    item_ids: Vec<BigInt>,
    query_config: Option<Value>,
) -> Result<WorkshopItemsResult, Error> {
    with_game_server_workshop_future(workshop_get_items(item_ids, query_config)).await
}

#[napi(js_name = "gameServerWorkshopGetAllItems")]
pub async fn game_server_workshop_get_all_items(
    page: u32,
    query_type: u32,
    item_type: i32,
    creator_app_id: u32,
    consumer_app_id: u32,
    query_config: Option<Value>,
) -> Result<WorkshopItemsResult, Error> {
    with_game_server_workshop_future(workshop_get_all_items(
        page,
        query_type,
        item_type,
        creator_app_id,
        consumer_app_id,
        query_config,
    ))
    .await
}

#[napi(js_name = "gameServerWorkshopGetAllItemsByCursor")]
pub async fn game_server_workshop_get_all_items_by_cursor(
    cursor: String,
    query_type: u32,
    item_type: i32,
    creator_app_id: u32,
    consumer_app_id: u32,
    query_config: Option<Value>,
) -> Result<WorkshopItemsResult, Error> {
    with_game_server_workshop_future(workshop_get_all_items_by_cursor(
        cursor,
        query_type,
        item_type,
        creator_app_id,
        consumer_app_id,
        query_config,
    ))
    .await
}

#[napi(js_name = "gameServerWorkshopGetUserItems")]
pub async fn game_server_workshop_get_user_items(
    page: u32,
    account_id: u32,
    list_type: u32,
    item_type: i32,
    sort_order: u32,
    creator_app_id: u32,
    consumer_app_id: u32,
    query_config: Option<Value>,
) -> Result<WorkshopItemsResult, Error> {
    with_game_server_workshop_future(workshop_get_user_items(
        page,
        account_id,
        list_type,
        item_type,
        sort_order,
        creator_app_id,
        consumer_app_id,
        query_config,
    ))
    .await
}

#[napi(js_name = "gameServerWorkshopRequestItemDetails")]
pub async fn game_server_workshop_request_item_details(
    item_id: BigInt,
    max_age_seconds: Option<u32>,
) -> Result<Value, Error> {
    with_game_server_workshop_future(workshop_request_item_details(item_id, max_age_seconds)).await
}

fn steam_apps() -> Result<*mut sys::ISteamApps, Error> {
    crate::state::ensure_initialized()?;
    non_null(unsafe { sys::SteamAPI_SteamApps_v009() }, "ISteamApps")
}

fn steam_client() -> Result<*mut sys::ISteamClient, Error> {
    crate::state::ensure_initialized()?;
    non_null(
        unsafe {
            sys::SteamInternal_CreateInterface(sys::STEAMCLIENT_INTERFACE_VERSION.as_ptr().cast())
        }
        .cast::<sys::ISteamClient>(),
        "ISteamClient",
    )
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

fn steam_game_server_http() -> Result<*mut sys::ISteamHTTP, Error> {
    crate::state::ensure_game_server_initialized()?;
    non_null(
        unsafe { sys::SteamAPI_SteamGameServerHTTP_v003() },
        "ISteamHTTP",
    )
}

fn steam_html_surface() -> Result<*mut sys::ISteamHTMLSurface, Error> {
    crate::state::ensure_initialized()?;
    non_null(
        unsafe { sys::SteamAPI_SteamHTMLSurface_v005() },
        "ISteamHTMLSurface",
    )
}

fn steam_parties() -> Result<*mut sys::ISteamParties, Error> {
    crate::state::ensure_initialized()?;
    non_null(
        unsafe { sys::SteamAPI_SteamParties_v002() },
        "ISteamParties",
    )
}

#[derive(Clone, Copy)]
enum InventoryInterfaceContext {
    Client,
    GameServer,
}

thread_local! {
    static INVENTORY_INTERFACE_CONTEXT: Cell<InventoryInterfaceContext> =
        Cell::new(InventoryInterfaceContext::Client);
}

struct InventoryInterfaceContextGuard {
    previous: InventoryInterfaceContext,
}

impl Drop for InventoryInterfaceContextGuard {
    fn drop(&mut self) {
        INVENTORY_INTERFACE_CONTEXT.with(|context| context.set(self.previous));
    }
}

fn with_game_server_inventory<T>(f: impl FnOnce() -> Result<T, Error>) -> Result<T, Error> {
    let _guard = INVENTORY_INTERFACE_CONTEXT.with(|context| {
        let previous = context.replace(InventoryInterfaceContext::GameServer);
        InventoryInterfaceContextGuard { previous }
    });
    f()
}

fn inventory_interface_context() -> InventoryInterfaceContext {
    INVENTORY_INTERFACE_CONTEXT.with(Cell::get)
}

fn steam_client_inventory() -> Result<*mut sys::ISteamInventory, Error> {
    crate::state::ensure_initialized()?;
    non_null(
        unsafe { sys::SteamAPI_SteamInventory_v003() },
        "ISteamInventory",
    )
}

fn steam_game_server_inventory() -> Result<*mut sys::ISteamInventory, Error> {
    crate::state::ensure_game_server_initialized()?;
    non_null(
        unsafe { sys::SteamAPI_SteamGameServerInventory_v003() },
        "ISteamInventory",
    )
}

fn steam_inventory() -> Result<*mut sys::ISteamInventory, Error> {
    match inventory_interface_context() {
        InventoryInterfaceContext::Client => steam_client_inventory(),
        InventoryInterfaceContext::GameServer => steam_game_server_inventory(),
    }
}

fn steam_input() -> Result<*mut sys::ISteamInput, Error> {
    crate::state::ensure_initialized()?;
    non_null(unsafe { sys::SteamAPI_SteamInput_v006() }, "ISteamInput")
}

fn steam_controller() -> Result<*mut sys::ISteamController, Error> {
    crate::state::ensure_initialized()?;
    non_null(
        unsafe { sys::SteamAPI_SteamController_v008() },
        "ISteamController",
    )
}

fn steam_networking() -> Result<*mut sys::ISteamNetworking, Error> {
    crate::state::ensure_initialized()?;
    non_null(
        unsafe { sys::SteamAPI_SteamNetworking_v006() },
        "ISteamNetworking",
    )
}

fn steam_game_server_networking() -> Result<*mut sys::ISteamNetworking, Error> {
    crate::state::ensure_game_server_initialized()?;
    non_null(
        unsafe { sys::SteamAPI_SteamGameServerNetworking_v006() },
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

fn steam_game_server_networking_messages() -> Result<*mut sys::ISteamNetworkingMessages, Error> {
    crate::state::ensure_game_server_initialized()?;
    non_null(
        unsafe { sys::SteamAPI_SteamGameServerNetworkingMessages_SteamAPI_v002() },
        "ISteamNetworkingMessages",
    )
}

#[derive(Clone, Copy)]
enum NetworkingInterfaceContext {
    Client,
    GameServer,
}

thread_local! {
    static NETWORKING_INTERFACE_CONTEXT: Cell<NetworkingInterfaceContext> =
        Cell::new(NetworkingInterfaceContext::Client);
}

struct NetworkingInterfaceContextGuard {
    previous: NetworkingInterfaceContext,
}

impl Drop for NetworkingInterfaceContextGuard {
    fn drop(&mut self) {
        NETWORKING_INTERFACE_CONTEXT.with(|context| context.set(self.previous));
    }
}

fn with_game_server_networking_sockets<T>(
    f: impl FnOnce() -> Result<T, Error>,
) -> Result<T, Error> {
    let _guard = NETWORKING_INTERFACE_CONTEXT.with(|context| {
        let previous = context.replace(NetworkingInterfaceContext::GameServer);
        NetworkingInterfaceContextGuard { previous }
    });
    f()
}

fn networking_interface_context() -> NetworkingInterfaceContext {
    NETWORKING_INTERFACE_CONTEXT.with(Cell::get)
}

fn steam_client_networking_sockets() -> Result<*mut sys::ISteamNetworkingSockets, Error> {
    crate::state::ensure_initialized()?;
    non_null(
        unsafe { sys::SteamAPI_SteamNetworkingSockets_SteamAPI_v012() },
        "ISteamNetworkingSockets",
    )
}

fn steam_game_server_networking_sockets() -> Result<*mut sys::ISteamNetworkingSockets, Error> {
    crate::state::ensure_game_server_initialized()?;
    non_null(
        unsafe { sys::SteamAPI_SteamGameServerNetworkingSockets_SteamAPI_v012() },
        "ISteamNetworkingSockets",
    )
}

fn steam_networking_sockets() -> Result<*mut sys::ISteamNetworkingSockets, Error> {
    match networking_interface_context() {
        NetworkingInterfaceContext::Client => steam_client_networking_sockets(),
        NetworkingInterfaceContext::GameServer => steam_game_server_networking_sockets(),
    }
}

fn steam_client_networking_utils() -> Result<*mut sys::ISteamNetworkingUtils, Error> {
    crate::state::ensure_initialized()?;
    non_null(
        unsafe { sys::SteamAPI_SteamNetworkingUtils_SteamAPI_v004() },
        "ISteamNetworkingUtils",
    )
}

fn steam_game_server_networking_utils() -> Result<*mut sys::ISteamNetworkingUtils, Error> {
    crate::state::ensure_game_server_initialized()?;
    non_null(
        unsafe { sys::SteamAPI_SteamNetworkingUtils_SteamAPI_v004() },
        "ISteamNetworkingUtils",
    )
}

fn steam_networking_utils() -> Result<*mut sys::ISteamNetworkingUtils, Error> {
    match networking_interface_context() {
        NetworkingInterfaceContext::Client => steam_client_networking_utils(),
        NetworkingInterfaceContext::GameServer => steam_game_server_networking_utils(),
    }
}

fn steam_game_server() -> Result<*mut sys::ISteamGameServer, Error> {
    crate::state::ensure_game_server_initialized()?;
    non_null(
        unsafe { sys::SteamAPI_SteamGameServer_v015() },
        "ISteamGameServer",
    )
}

fn steam_game_server_stats() -> Result<*mut sys::ISteamGameServerStats, Error> {
    crate::state::ensure_game_server_initialized()?;
    non_null(
        unsafe { sys::SteamAPI_SteamGameServerStats_v001() },
        "ISteamGameServerStats",
    )
}

fn steam_game_server_utils() -> Result<*mut sys::ISteamUtils, Error> {
    crate::state::ensure_game_server_initialized()?;
    non_null(
        unsafe { sys::SteamAPI_SteamGameServerUtils_v010() },
        "ISteamUtils",
    )
}

fn steam_matchmaking() -> Result<*mut sys::ISteamMatchmaking, Error> {
    crate::state::ensure_initialized()?;
    non_null(
        unsafe { sys::SteamAPI_SteamMatchmaking_v009() },
        "ISteamMatchmaking",
    )
}

fn steam_matchmaking_servers() -> Result<*mut sys::ISteamMatchmakingServers, Error> {
    crate::state::ensure_initialized()?;
    non_null(
        unsafe { sys::SteamAPI_SteamMatchmakingServers_v002() },
        "ISteamMatchmakingServers",
    )
}

fn remote_storage_file_share_result(
    result: &sys::RemoteStorageFileShareResult_t,
) -> CloudFileShareResult {
    let filename = unsafe { ptr::addr_of!(result.m_rgchFilename).read_unaligned() };
    CloudFileShareResult {
        result: unsafe { ptr::addr_of!(result.m_eResult).read_unaligned() } as u32,
        file: unsafe { ptr::addr_of!(result.m_hFile).read_unaligned() }.into(),
        name: c_buf_to_string(&filename),
    }
}

fn remote_storage_download_ugc_result(
    result: &sys::RemoteStorageDownloadUGCResult_t,
) -> CloudUgcDownloadResult {
    let filename = unsafe { ptr::addr_of!(result.m_pchFileName).read_unaligned() };
    CloudUgcDownloadResult {
        result: unsafe { ptr::addr_of!(result.m_eResult).read_unaligned() } as u32,
        file: unsafe { ptr::addr_of!(result.m_hFile).read_unaligned() }.into(),
        app_id: unsafe { ptr::addr_of!(result.m_nAppID).read_unaligned() },
        size: (unsafe { ptr::addr_of!(result.m_nSizeInBytes).read_unaligned() }.max(0) as u64)
            .into(),
        name: c_buf_to_string(&filename),
        owner: steam_id_to_player(unsafe {
            ptr::addr_of!(result.m_ulSteamIDOwner).read_unaligned()
        }),
    }
}

fn remote_storage_publish_file_result(
    result: &sys::RemoteStoragePublishFileResult_t,
) -> CloudLegacyPublishedFileResult {
    CloudLegacyPublishedFileResult {
        result: unsafe { ptr::addr_of!(result.m_eResult).read_unaligned() } as u32,
        published_file_id: unsafe { ptr::addr_of!(result.m_nPublishedFileId).read_unaligned() }
            .into(),
        needs_to_accept_agreement: Some(unsafe {
            ptr::addr_of!(result.m_bUserNeedsToAcceptWorkshopLegalAgreement).read_unaligned()
        }),
    }
}

fn remote_storage_update_published_file_result(
    result: &sys::RemoteStorageUpdatePublishedFileResult_t,
) -> CloudLegacyPublishedFileResult {
    CloudLegacyPublishedFileResult {
        result: unsafe { ptr::addr_of!(result.m_eResult).read_unaligned() } as u32,
        published_file_id: unsafe { ptr::addr_of!(result.m_nPublishedFileId).read_unaligned() }
            .into(),
        needs_to_accept_agreement: Some(unsafe {
            ptr::addr_of!(result.m_bUserNeedsToAcceptWorkshopLegalAgreement).read_unaligned()
        }),
    }
}

fn remote_storage_delete_published_file_result(
    result: &sys::RemoteStorageDeletePublishedFileResult_t,
) -> CloudLegacyPublishedFileIdResult {
    CloudLegacyPublishedFileIdResult {
        result: unsafe { ptr::addr_of!(result.m_eResult).read_unaligned() } as u32,
        published_file_id: unsafe { ptr::addr_of!(result.m_nPublishedFileId).read_unaligned() }
            .into(),
    }
}

fn remote_storage_subscribe_published_file_result(
    result: &sys::RemoteStorageSubscribePublishedFileResult_t,
) -> CloudLegacyPublishedFileIdResult {
    CloudLegacyPublishedFileIdResult {
        result: unsafe { ptr::addr_of!(result.m_eResult).read_unaligned() } as u32,
        published_file_id: unsafe { ptr::addr_of!(result.m_nPublishedFileId).read_unaligned() }
            .into(),
    }
}

fn remote_storage_unsubscribe_published_file_result(
    result: &sys::RemoteStorageUnsubscribePublishedFileResult_t,
) -> CloudLegacyPublishedFileIdResult {
    CloudLegacyPublishedFileIdResult {
        result: unsafe { ptr::addr_of!(result.m_eResult).read_unaligned() } as u32,
        published_file_id: unsafe { ptr::addr_of!(result.m_nPublishedFileId).read_unaligned() }
            .into(),
    }
}

fn remote_storage_update_user_published_item_vote_result(
    result: &sys::RemoteStorageUpdateUserPublishedItemVoteResult_t,
) -> CloudLegacyPublishedFileIdResult {
    CloudLegacyPublishedFileIdResult {
        result: unsafe { ptr::addr_of!(result.m_eResult).read_unaligned() } as u32,
        published_file_id: unsafe { ptr::addr_of!(result.m_nPublishedFileId).read_unaligned() }
            .into(),
    }
}

fn remote_storage_published_file_details(
    result: &sys::RemoteStorageGetPublishedFileDetailsResult_t,
) -> CloudLegacyPublishedFileDetails {
    let title = unsafe { ptr::addr_of!(result.m_rgchTitle).read_unaligned() };
    let description = unsafe { ptr::addr_of!(result.m_rgchDescription).read_unaligned() };
    let tags = unsafe { ptr::addr_of!(result.m_rgchTags).read_unaligned() };
    let file_name = unsafe { ptr::addr_of!(result.m_pchFileName).read_unaligned() };
    let url = unsafe { ptr::addr_of!(result.m_rgchURL).read_unaligned() };
    CloudLegacyPublishedFileDetails {
        result: unsafe { ptr::addr_of!(result.m_eResult).read_unaligned() } as u32,
        published_file_id: unsafe { ptr::addr_of!(result.m_nPublishedFileId).read_unaligned() }
            .into(),
        creator_app_id: unsafe { ptr::addr_of!(result.m_nCreatorAppID).read_unaligned() },
        consumer_app_id: unsafe { ptr::addr_of!(result.m_nConsumerAppID).read_unaligned() },
        title: c_buf_to_string(&title),
        description: c_buf_to_string(&description),
        file: unsafe { ptr::addr_of!(result.m_hFile).read_unaligned() }.into(),
        preview_file: unsafe { ptr::addr_of!(result.m_hPreviewFile).read_unaligned() }.into(),
        owner: steam_id_to_player(unsafe {
            ptr::addr_of!(result.m_ulSteamIDOwner).read_unaligned()
        }),
        time_created: unsafe { ptr::addr_of!(result.m_rtimeCreated).read_unaligned() },
        time_updated: unsafe { ptr::addr_of!(result.m_rtimeUpdated).read_unaligned() },
        visibility: unsafe { ptr::addr_of!(result.m_eVisibility).read_unaligned() } as u32,
        banned: unsafe { ptr::addr_of!(result.m_bBanned).read_unaligned() },
        tags: c_buf_to_string(&tags)
            .split(',')
            .filter(|tag| !tag.is_empty())
            .map(ToOwned::to_owned)
            .collect(),
        tags_truncated: unsafe { ptr::addr_of!(result.m_bTagsTruncated).read_unaligned() },
        file_name: c_buf_to_string(&file_name),
        file_size: (unsafe { ptr::addr_of!(result.m_nFileSize).read_unaligned() }.max(0) as u64)
            .into(),
        preview_file_size: (unsafe { ptr::addr_of!(result.m_nPreviewFileSize).read_unaligned() }
            .max(0) as u64)
            .into(),
        url: c_buf_to_string(&url),
        file_type: unsafe { ptr::addr_of!(result.m_eFileType).read_unaligned() } as u32,
        accepted_for_use: unsafe { ptr::addr_of!(result.m_bAcceptedForUse).read_unaligned() },
    }
}

fn remote_storage_enumerate_user_published_files_result(
    result: &sys::RemoteStorageEnumerateUserPublishedFilesResult_t,
) -> CloudLegacyEnumerateFilesResult {
    let ids = unsafe { ptr::addr_of!(result.m_rgPublishedFileId).read_unaligned() };
    let returned = unsafe { ptr::addr_of!(result.m_nResultsReturned).read_unaligned() };
    CloudLegacyEnumerateFilesResult {
        result: unsafe { ptr::addr_of!(result.m_eResult).read_unaligned() } as u32,
        returned_results: returned,
        total_result_count: unsafe { ptr::addr_of!(result.m_nTotalResultCount).read_unaligned() },
        published_file_ids: remote_storage_published_ids(ids, returned),
    }
}

fn remote_storage_enumerate_user_shared_workshop_files_result(
    result: &sys::RemoteStorageEnumerateUserSharedWorkshopFilesResult_t,
) -> CloudLegacyEnumerateFilesResult {
    let ids = unsafe { ptr::addr_of!(result.m_rgPublishedFileId).read_unaligned() };
    let returned = unsafe { ptr::addr_of!(result.m_nResultsReturned).read_unaligned() };
    CloudLegacyEnumerateFilesResult {
        result: unsafe { ptr::addr_of!(result.m_eResult).read_unaligned() } as u32,
        returned_results: returned,
        total_result_count: unsafe { ptr::addr_of!(result.m_nTotalResultCount).read_unaligned() },
        published_file_ids: remote_storage_published_ids(ids, returned),
    }
}

fn remote_storage_enumerate_user_subscribed_files_result(
    result: &sys::RemoteStorageEnumerateUserSubscribedFilesResult_t,
) -> CloudLegacyEnumerateSubscribedFilesResult {
    let ids = unsafe { ptr::addr_of!(result.m_rgPublishedFileId).read_unaligned() };
    let times = unsafe { ptr::addr_of!(result.m_rgRTimeSubscribed).read_unaligned() };
    let returned = unsafe { ptr::addr_of!(result.m_nResultsReturned).read_unaligned() };
    let count = remote_storage_result_count(returned);
    CloudLegacyEnumerateSubscribedFilesResult {
        result: unsafe { ptr::addr_of!(result.m_eResult).read_unaligned() } as u32,
        returned_results: returned,
        total_result_count: unsafe { ptr::addr_of!(result.m_nTotalResultCount).read_unaligned() },
        published_file_ids: remote_storage_published_ids(ids, returned),
        subscribed_times: times.into_iter().take(count).collect(),
    }
}

fn remote_storage_enumerate_workshop_files_result(
    result: &sys::RemoteStorageEnumerateWorkshopFilesResult_t,
) -> CloudLegacyEnumerateWorkshopFilesResult {
    let ids = unsafe { ptr::addr_of!(result.m_rgPublishedFileId).read_unaligned() };
    let scores = unsafe { ptr::addr_of!(result.m_rgScore).read_unaligned() };
    let returned = unsafe { ptr::addr_of!(result.m_nResultsReturned).read_unaligned() };
    let count = remote_storage_result_count(returned);
    CloudLegacyEnumerateWorkshopFilesResult {
        result: unsafe { ptr::addr_of!(result.m_eResult).read_unaligned() } as u32,
        returned_results: returned,
        total_result_count: unsafe { ptr::addr_of!(result.m_nTotalResultCount).read_unaligned() },
        published_file_ids: remote_storage_published_ids(ids, returned),
        scores: scores.into_iter().take(count).map(f64::from).collect(),
        app_id: unsafe { ptr::addr_of!(result.m_nAppId).read_unaligned() },
        start_index: unsafe { ptr::addr_of!(result.m_unStartIndex).read_unaligned() },
    }
}

fn remote_storage_enumerate_published_files_by_user_action_result(
    result: &sys::RemoteStorageEnumeratePublishedFilesByUserActionResult_t,
) -> CloudLegacyEnumerateUserActionFilesResult {
    let ids = unsafe { ptr::addr_of!(result.m_rgPublishedFileId).read_unaligned() };
    let times = unsafe { ptr::addr_of!(result.m_rgRTimeUpdated).read_unaligned() };
    let returned = unsafe { ptr::addr_of!(result.m_nResultsReturned).read_unaligned() };
    let count = remote_storage_result_count(returned);
    CloudLegacyEnumerateUserActionFilesResult {
        result: unsafe { ptr::addr_of!(result.m_eResult).read_unaligned() } as u32,
        action: unsafe { ptr::addr_of!(result.m_eAction).read_unaligned() } as u32,
        returned_results: returned,
        total_result_count: unsafe { ptr::addr_of!(result.m_nTotalResultCount).read_unaligned() },
        published_file_ids: remote_storage_published_ids(ids, returned),
        updated_times: times.into_iter().take(count).collect(),
    }
}

fn remote_storage_published_item_vote_details(
    result: &sys::RemoteStorageGetPublishedItemVoteDetailsResult_t,
) -> CloudLegacyPublishedItemVoteDetails {
    CloudLegacyPublishedItemVoteDetails {
        result: unsafe { ptr::addr_of!(result.m_eResult).read_unaligned() } as u32,
        published_file_id: unsafe { ptr::addr_of!(result.m_unPublishedFileId).read_unaligned() }
            .into(),
        votes_for: unsafe { ptr::addr_of!(result.m_nVotesFor).read_unaligned() },
        votes_against: unsafe { ptr::addr_of!(result.m_nVotesAgainst).read_unaligned() },
        reports: unsafe { ptr::addr_of!(result.m_nReports).read_unaligned() },
        score: f64::from(unsafe { ptr::addr_of!(result.m_fScore).read_unaligned() }),
    }
}

fn remote_storage_user_vote_details(
    result: &sys::RemoteStorageUserVoteDetails_t,
) -> CloudLegacyUserVoteDetails {
    CloudLegacyUserVoteDetails {
        result: unsafe { ptr::addr_of!(result.m_eResult).read_unaligned() } as u32,
        published_file_id: unsafe { ptr::addr_of!(result.m_nPublishedFileId).read_unaligned() }
            .into(),
        vote: unsafe { ptr::addr_of!(result.m_eVote).read_unaligned() } as u32,
    }
}

fn remote_storage_set_user_published_file_action_result(
    result: &sys::RemoteStorageSetUserPublishedFileActionResult_t,
) -> CloudLegacyPublishedFileActionResult {
    CloudLegacyPublishedFileActionResult {
        result: unsafe { ptr::addr_of!(result.m_eResult).read_unaligned() } as u32,
        published_file_id: unsafe { ptr::addr_of!(result.m_nPublishedFileId).read_unaligned() }
            .into(),
        action: unsafe { ptr::addr_of!(result.m_eAction).read_unaligned() } as u32,
    }
}

fn remote_storage_published_ids(ids: [u64; 50], returned: i32) -> Vec<BigInt> {
    ids.into_iter()
        .take(remote_storage_result_count(returned))
        .map(Into::into)
        .collect()
}

fn published_id_strings(ids: [u64; 50], returned: i32) -> Vec<String> {
    ids.into_iter()
        .take(remote_storage_result_count(returned))
        .map(|id| id.to_string())
        .collect()
}

fn remote_storage_result_count(returned: i32) -> usize {
    returned
        .max(0)
        .min(sys::k_unEnumeratePublishedFilesMaxResults as i32) as usize
}

fn steam_param_string_array(
    tags: Vec<String>,
    label: &str,
) -> Result<
    (
        Vec<CString>,
        Vec<*const c_char>,
        sys::SteamParamStringArray_t,
    ),
    Error,
> {
    let tag_strings: Vec<CString> = tags
        .into_iter()
        .map(|tag| cstring(tag, label))
        .collect::<Result<_, _>>()?;
    let mut pointers: Vec<*const c_char> = tag_strings.iter().map(|tag| tag.as_ptr()).collect();
    let tag_array = sys::SteamParamStringArray_t {
        m_ppStrings: pointers.as_mut_ptr(),
        m_nNumStrings: pointers.len() as i32,
    };
    Ok((tag_strings, pointers, tag_array))
}

#[derive(Clone, Copy)]
enum UgcInterfaceContext {
    Client,
    GameServer,
}

thread_local! {
    static UGC_INTERFACE_CONTEXT: Cell<UgcInterfaceContext> =
        Cell::new(UgcInterfaceContext::Client);
}

struct UgcInterfaceContextGuard {
    previous: UgcInterfaceContext,
}

impl Drop for UgcInterfaceContextGuard {
    fn drop(&mut self) {
        UGC_INTERFACE_CONTEXT.with(|context| context.set(self.previous));
    }
}

struct UgcInterfaceContextFuture<F> {
    context: UgcInterfaceContext,
    future: F,
}

impl<F: Future> Future for UgcInterfaceContextFuture<F> {
    type Output = F::Output;

    fn poll(self: Pin<&mut Self>, cx: &mut TaskContext<'_>) -> Poll<Self::Output> {
        let context = self.as_ref().get_ref().context;
        let _guard = set_ugc_interface_context(context);
        unsafe { self.map_unchecked_mut(|this| &mut this.future) }.poll(cx)
    }
}

fn set_ugc_interface_context(context: UgcInterfaceContext) -> UgcInterfaceContextGuard {
    UGC_INTERFACE_CONTEXT.with(|current| {
        let previous = current.replace(context);
        UgcInterfaceContextGuard { previous }
    })
}

fn ugc_interface_context() -> UgcInterfaceContext {
    UGC_INTERFACE_CONTEXT.with(Cell::get)
}

fn with_game_server_workshop<T>(f: impl FnOnce() -> Result<T, Error>) -> Result<T, Error> {
    let _guard = set_ugc_interface_context(UgcInterfaceContext::GameServer);
    f()
}

fn with_game_server_workshop_future<F: Future>(future: F) -> UgcInterfaceContextFuture<F> {
    UgcInterfaceContextFuture {
        context: UgcInterfaceContext::GameServer,
        future,
    }
}

fn steam_client_ugc() -> Result<*mut sys::ISteamUGC, Error> {
    crate::state::ensure_initialized()?;
    non_null(unsafe { sys::SteamAPI_SteamUGC_v021() }, "ISteamUGC")
}

fn steam_game_server_ugc() -> Result<*mut sys::ISteamUGC, Error> {
    crate::state::ensure_game_server_initialized()?;
    non_null(
        unsafe { sys::SteamAPI_SteamGameServerUGC_v021() },
        "ISteamUGC",
    )
}

fn steam_ugc() -> Result<*mut sys::ISteamUGC, Error> {
    match ugc_interface_context() {
        UgcInterfaceContext::Client => steam_client_ugc(),
        UgcInterfaceContext::GameServer => steam_game_server_ugc(),
    }
}

fn workshop_utils() -> Result<*mut sys::ISteamUtils, Error> {
    match ugc_interface_context() {
        UgcInterfaceContext::Client => steam_utils(),
        UgcInterfaceContext::GameServer => steam_game_server_utils(),
    }
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
    Ok(sys::EOverlayToStoreFlag(value))
}

fn community_profile_item_type_from_u32(
    value: u32,
) -> Result<sys::ECommunityProfileItemType, Error> {
    match value {
        0 => Ok(sys::ECommunityProfileItemType::k_ECommunityProfileItemType_AnimatedAvatar),
        1 => Ok(sys::ECommunityProfileItemType::k_ECommunityProfileItemType_AvatarFrame),
        2 => Ok(sys::ECommunityProfileItemType::k_ECommunityProfileItemType_ProfileModifier),
        3 => Ok(sys::ECommunityProfileItemType::k_ECommunityProfileItemType_ProfileBackground),
        4 => Ok(sys::ECommunityProfileItemType::k_ECommunityProfileItemType_MiniProfileBackground),
        _ => Err(Error::from_reason(format!(
            "invalid community profile item type {value}"
        ))),
    }
}

fn community_profile_item_property_from_u32(
    value: u32,
) -> Result<sys::ECommunityProfileItemProperty, Error> {
    match value {
        0 => Ok(sys::ECommunityProfileItemProperty::k_ECommunityProfileItemProperty_ImageSmall),
        1 => Ok(sys::ECommunityProfileItemProperty::k_ECommunityProfileItemProperty_ImageLarge),
        2 => Ok(sys::ECommunityProfileItemProperty::k_ECommunityProfileItemProperty_InternalName),
        3 => Ok(sys::ECommunityProfileItemProperty::k_ECommunityProfileItemProperty_Title),
        4 => Ok(sys::ECommunityProfileItemProperty::k_ECommunityProfileItemProperty_Description),
        5 => Ok(sys::ECommunityProfileItemProperty::k_ECommunityProfileItemProperty_AppID),
        6 => Ok(sys::ECommunityProfileItemProperty::k_ECommunityProfileItemProperty_TypeID),
        7 => Ok(sys::ECommunityProfileItemProperty::k_ECommunityProfileItemProperty_Class),
        8 => Ok(sys::ECommunityProfileItemProperty::k_ECommunityProfileItemProperty_MovieWebM),
        9 => Ok(sys::ECommunityProfileItemProperty::k_ECommunityProfileItemProperty_MovieMP4),
        10 => {
            Ok(sys::ECommunityProfileItemProperty::k_ECommunityProfileItemProperty_MovieWebMSmall)
        }
        11 => Ok(sys::ECommunityProfileItemProperty::k_ECommunityProfileItemProperty_MovieMP4Small),
        _ => Err(Error::from_reason(format!(
            "invalid community profile item property {value}"
        ))),
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

fn game_server_stats_received_result(result: sys::GSStatsReceived_t) -> GameServerStatsResult {
    GameServerStatsResult {
        result: unsafe { ptr::addr_of!(result.m_eResult).read_unaligned() } as u32,
        steam_id: csteam_id_to_player(unsafe {
            ptr::addr_of!(result.m_steamIDUser).read_unaligned()
        }),
    }
}

fn game_server_stats_stored_result(result: sys::GSStatsStored_t) -> GameServerStatsResult {
    GameServerStatsResult {
        result: unsafe { ptr::addr_of!(result.m_eResult).read_unaligned() } as u32,
        steam_id: csteam_id_to_player(unsafe {
            ptr::addr_of!(result.m_steamIDUser).read_unaligned()
        }),
    }
}

fn game_server_reputation_result(result: sys::GSReputation_t) -> GameServerReputationResult {
    let banned_ip = unsafe { ptr::addr_of!(result.m_unBannedIP).read_unaligned() };
    GameServerReputationResult {
        result: unsafe { ptr::addr_of!(result.m_eResult).read_unaligned() } as u32,
        reputation_score: unsafe { ptr::addr_of!(result.m_unReputationScore).read_unaligned() },
        banned: unsafe { ptr::addr_of!(result.m_bBanned).read_unaligned() },
        banned_ip,
        banned_ip_address: ipv4_to_string(banned_ip),
        banned_port: unsafe { ptr::addr_of!(result.m_usBannedPort).read_unaligned() }.into(),
        banned_game_id: unsafe { ptr::addr_of!(result.m_ulBannedGameID).read_unaligned() }.into(),
        ban_expires: unsafe { ptr::addr_of!(result.m_unBanExpires).read_unaligned() },
    }
}

fn game_server_associate_with_clan_result(
    result: sys::AssociateWithClanResult_t,
) -> GameServerAssociateWithClanResult {
    GameServerAssociateWithClanResult {
        result: unsafe { ptr::addr_of!(result.m_eResult).read_unaligned() } as u32,
    }
}

fn game_server_player_compatibility_result(
    result: sys::ComputeNewPlayerCompatibilityResult_t,
) -> GameServerPlayerCompatibilityResult {
    GameServerPlayerCompatibilityResult {
        result: unsafe { ptr::addr_of!(result.m_eResult).read_unaligned() } as u32,
        players_that_dont_like_candidate: unsafe {
            ptr::addr_of!(result.m_cPlayersThatDontLikeCandidate).read_unaligned()
        },
        players_that_candidate_doesnt_like: unsafe {
            ptr::addr_of!(result.m_cPlayersThatCandidateDoesntLike).read_unaligned()
        },
        clan_players_that_dont_like_candidate: unsafe {
            ptr::addr_of!(result.m_cClanPlayersThatDontLikeCandidate).read_unaligned()
        },
        candidate: csteam_id_to_player(unsafe {
            ptr::addr_of!(result.m_SteamIDCandidate).read_unaligned()
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

fn pointer_to_bigint<T>(ptr: *mut T) -> Option<BigInt> {
    (!ptr.is_null()).then(|| (ptr as usize as u64).into())
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

fn u16_from_u32(value: u32, label: &str) -> Result<u16, Error> {
    u16::try_from(value).map_err(|_| Error::from_reason(format!("{label} exceeds u16")))
}

fn requested_user_voice_bytes(
    requested: Option<u32>,
    default: u32,
    label: &str,
) -> Result<u32, Error> {
    let value = requested.unwrap_or(default);
    if value > MAX_USER_VOICE_BYTES {
        Err(Error::from_reason(format!(
            "{label} buffer cannot exceed {MAX_USER_VOICE_BYTES} bytes"
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

fn equipped_profile_items_result(
    result: &sys::EquippedProfileItems_t,
) -> EquippedProfileItemsResult {
    EquippedProfileItemsResult {
        result: unsafe { ptr::addr_of!(result.m_eResult).read_unaligned() } as u32,
        steam_id: csteam_id_to_player(unsafe { ptr::addr_of!(result.m_steamID).read_unaligned() }),
        has_animated_avatar: unsafe { ptr::addr_of!(result.m_bHasAnimatedAvatar).read_unaligned() },
        has_avatar_frame: unsafe { ptr::addr_of!(result.m_bHasAvatarFrame).read_unaligned() },
        has_profile_modifier: unsafe {
            ptr::addr_of!(result.m_bHasProfileModifier).read_unaligned()
        },
        has_profile_background: unsafe {
            ptr::addr_of!(result.m_bHasProfileBackground).read_unaligned()
        },
        has_mini_profile_background: unsafe {
            ptr::addr_of!(result.m_bHasMiniProfileBackground).read_unaligned()
        },
        from_cache: unsafe { ptr::addr_of!(result.m_bFromCache).read_unaligned() },
    }
}

fn len_to_u32(len: usize, label: &str) -> Result<u32, Error> {
    u32::try_from(len).map_err(|_| Error::from_reason(format!("{label} length exceeds u32")))
}

fn len_to_i32(len: usize, label: &str) -> Result<i32, Error> {
    i32::try_from(len).map_err(|_| Error::from_reason(format!("{label} length exceeds i32")))
}

fn bigints_to_u64s(values: Vec<BigInt>, label: &str) -> Result<Vec<u64>, Error> {
    values
        .into_iter()
        .map(|value| bigint_to_u64(value, label))
        .collect()
}

#[repr(C)]
#[derive(Copy, Clone)]
struct SteamDatagramHostedAddressRaw {
    cb_size: i32,
    data: [c_char; 128],
}

impl Default for SteamDatagramHostedAddressRaw {
    fn default() -> Self {
        Self {
            cb_size: 0,
            data: [0; 128],
        }
    }
}

#[repr(C)]
#[derive(Copy, Clone)]
struct SteamDatagramGameCoordinatorServerLoginRaw {
    identity: sys::SteamNetworkingIdentity,
    routing: SteamDatagramHostedAddressRaw,
    app_id: u32,
    timestamp: u32,
    cb_app_data: i32,
    app_data: [c_char; 2048],
}

const _: [(); 132] = [(); std::mem::size_of::<SteamDatagramHostedAddressRaw>()];
const _: [(); 2328] = [(); std::mem::size_of::<SteamDatagramGameCoordinatorServerLoginRaw>()];

#[repr(C, packed)]
#[derive(Copy, Clone)]
struct SteamNetworkingFakeIpResultRaw {
    result: sys::EResult,
    identity: sys::SteamNetworkingIdentity,
    ipv4: u32,
    ports: [u16; 8],
}

fn networking_identity_from_input(
    identity: NetworkingIdentity,
) -> Result<sys::SteamNetworkingIdentity, Error> {
    let NetworkingIdentity {
        steam_id64,
        text,
        generic_string,
        generic_bytes,
        psn_id,
        xbox_pairwise_id,
        ip_address,
        ipv4,
        port,
        local_host,
    } = identity;
    let mut output = unsafe { MaybeUninit::<sys::SteamNetworkingIdentity>::zeroed().assume_init() };
    unsafe { sys::SteamAPI_SteamNetworkingIdentity_Clear(&mut output) };

    if let Some(steam_id64) = steam_id64 {
        let steam_id64 = bigint_to_u64(steam_id64, "networking identity steamId64")?;
        unsafe {
            sys::SteamAPI_SteamNetworkingIdentity_SetSteamID64(&mut output, steam_id64);
            sys::SteamAPI_SteamNetworkingIdentity_SetSteamID(&mut output, steam_id64);
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

    if let Some(generic_bytes) = generic_bytes {
        let ok = unsafe {
            sys::SteamAPI_SteamNetworkingIdentity_SetGenericBytes(
                &mut output,
                generic_bytes.as_ptr().cast::<c_void>(),
                len_to_u32(generic_bytes.len(), "generic networking identity bytes")?,
            )
        };
        return ok
            .then_some(output)
            .ok_or_else(|| Error::from_reason("invalid generic networking identity bytes"));
    }

    if let Some(psn_id) = psn_id {
        unsafe {
            sys::SteamAPI_SteamNetworkingIdentity_SetPSNID(
                &mut output,
                bigint_to_u64(psn_id, "networking identity PSN id")?,
            );
        }
        return Ok(output);
    }

    if let Some(xbox_pairwise_id) = xbox_pairwise_id {
        let xbox_pairwise_id = cstring(xbox_pairwise_id, "Xbox pairwise networking identity")?;
        let ok = unsafe {
            sys::SteamAPI_SteamNetworkingIdentity_SetXboxPairwiseID(
                &mut output,
                xbox_pairwise_id.as_ptr(),
            )
        };
        return ok
            .then_some(output)
            .ok_or_else(|| Error::from_reason("invalid Xbox pairwise networking identity"));
    }

    if let Some(ip_address) = ip_address {
        let ip_address = networking_ip_address_from_input(ip_address)?;
        unsafe { sys::SteamAPI_SteamNetworkingIdentity_SetIPAddr(&mut output, &ip_address) };
        return Ok(output);
    }

    if let Some(ipv4) = ipv4 {
        unsafe {
            sys::SteamAPI_SteamNetworkingIdentity_SetIPv4Addr(
                &mut output,
                ipv4,
                networking_port(port)?,
            );
        }
        return Ok(output);
    }

    if local_host.unwrap_or(false) {
        unsafe { sys::SteamAPI_SteamNetworkingIdentity_SetLocalHost(&mut output) };
        return Ok(output);
    }

    Err(Error::from_reason(
        "networking identity requires steamId64, text, genericString, genericBytes, psnId, xboxPairwiseId, ipAddress, ipv4, or localHost",
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

fn networking_utils_identity_string(
    utils: *mut sys::ISteamNetworkingUtils,
    identity: sys::SteamNetworkingIdentity,
) -> String {
    let mut output = vec![0i8; 129];
    unsafe {
        sys::SteamAPI_ISteamNetworkingUtils_SteamNetworkingIdentity_ToString(
            utils,
            &identity,
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

fn networking_hosted_dedicated_server_address_result(
    result: sys::EResult,
    address: &mut SteamDatagramHostedAddressRaw,
) -> NetworkingHostedDedicatedServerAddressResult {
    let routing = (result == sys::EResult::k_EResultOK)
        .then(|| networking_hosted_dedicated_server_routing(address));
    let debug_message = if result == sys::EResult::k_EResultOK {
        String::new()
    } else {
        c_buf_to_string(&address.data)
    };
    NetworkingHostedDedicatedServerAddressResult {
        result: result as u32,
        routing,
        debug_message,
    }
}

fn networking_game_coordinator_server_login_result(
    result: sys::EResult,
    login: &mut SteamDatagramGameCoordinatorServerLoginRaw,
    mut signed_blob: Vec<u8>,
    signed_blob_size: i32,
) -> NetworkingGameCoordinatorServerLoginResult {
    let success = result == sys::EResult::k_EResultOK;
    let debug_message = if success {
        let size = signed_blob_size.max(0) as usize;
        signed_blob.truncate(size.min(signed_blob.len()));
        String::new()
    } else {
        let message = u8_buf_to_string(&signed_blob);
        signed_blob.clear();
        message
    };
    let app_data_size = login.cb_app_data.max(0) as usize;
    let app_data = login.app_data[..app_data_size.min(login.app_data.len())]
        .iter()
        .map(|value| *value as u8)
        .collect::<Vec<_>>();
    NetworkingGameCoordinatorServerLoginResult {
        result: result as u32,
        identity: success.then(|| networking_identity_info(login.identity)),
        routing: success.then(|| networking_hosted_dedicated_server_routing(&mut login.routing)),
        app_id: login.app_id,
        timestamp: login.timestamp,
        app_data: app_data.into(),
        signed_blob: signed_blob.into(),
        debug_message,
    }
}

fn networking_hosted_dedicated_server_routing(
    address: &mut SteamDatagramHostedAddressRaw,
) -> NetworkingHostedDedicatedServerRouting {
    let size = address.cb_size.max(0) as usize;
    let data = address.data[..size.min(address.data.len())]
        .iter()
        .map(|value| *value as u8)
        .collect::<Vec<_>>();
    let pop_id = unsafe {
        sys::SteamAPI_SteamDatagramHostedAddress_GetPopID(
            (address as *mut SteamDatagramHostedAddressRaw)
                .cast::<sys::SteamDatagramHostedAddress>(),
        )
    };
    NetworkingHostedDedicatedServerRouting {
        pop_id,
        size: size as u32,
        data: data.into(),
    }
}

fn networking_fake_ip_result(result: &SteamNetworkingFakeIpResultRaw) -> NetworkingFakeIpResult {
    let ipv4 = unsafe { ptr::addr_of!(result.ipv4).read_unaligned() };
    NetworkingFakeIpResult {
        result: unsafe { ptr::addr_of!(result.result).read_unaligned() } as u32,
        identity: networking_identity_info(unsafe {
            ptr::addr_of!(result.identity).read_unaligned()
        }),
        ipv4,
        ipv4_address: ipv4_to_string(ipv4),
        ports: fake_ip_ports(result),
    }
}

fn networking_fake_ip_result_json(result: &SteamNetworkingFakeIpResultRaw) -> Value {
    let ipv4 = unsafe { ptr::addr_of!(result.ipv4).read_unaligned() };
    serde_json::json!({
        "result": unsafe { ptr::addr_of!(result.result).read_unaligned() } as u32,
        "identity": networking_identity_json(unsafe { ptr::addr_of!(result.identity).read_unaligned() }),
        "ipv4": ipv4,
        "ipv4_address": ipv4_to_string(ipv4),
        "ports": fake_ip_ports(result)
    })
}

fn fake_ip_ports(result: &SteamNetworkingFakeIpResultRaw) -> Vec<u32> {
    let ports = unsafe { ptr::addr_of!(result.ports).read_unaligned() };
    ports
        .into_iter()
        .filter(|port| *port != 0)
        .map(u32::from)
        .collect()
}

fn networking_config_value_result(
    result: sys::ESteamNetworkingGetConfigValueResult,
    data_type: sys::ESteamNetworkingConfigDataType,
    buffer: &[u8],
    byte_count: usize,
) -> NetworkingConfigValueResult {
    let ok = matches!(
        result,
        sys::ESteamNetworkingGetConfigValueResult::k_ESteamNetworkingGetConfigValue_OK
            | sys::ESteamNetworkingGetConfigValueResult::k_ESteamNetworkingGetConfigValue_OKInherited
    );
    let mut output = NetworkingConfigValueResult {
        result: result as i32,
        data_type: data_type as u32,
        int32_value: None,
        int64_value: None,
        float_value: None,
        string_value: None,
    };
    if !ok {
        return output;
    }

    match data_type {
        sys::ESteamNetworkingConfigDataType::k_ESteamNetworkingConfig_Int32
            if buffer.len() >= std::mem::size_of::<i32>() =>
        {
            output.int32_value =
                Some(unsafe { ptr::read_unaligned(buffer.as_ptr().cast::<i32>()) });
        }
        sys::ESteamNetworkingConfigDataType::k_ESteamNetworkingConfig_Int64
            if buffer.len() >= std::mem::size_of::<i64>() =>
        {
            output.int64_value =
                Some(unsafe { ptr::read_unaligned(buffer.as_ptr().cast::<i64>()) }.into());
        }
        sys::ESteamNetworkingConfigDataType::k_ESteamNetworkingConfig_Float
            if buffer.len() >= std::mem::size_of::<f32>() =>
        {
            output.float_value = Some(f64::from(unsafe {
                ptr::read_unaligned(buffer.as_ptr().cast::<f32>())
            }));
        }
        sys::ESteamNetworkingConfigDataType::k_ESteamNetworkingConfig_String => {
            let len = byte_count.min(buffer.len());
            output.string_value = Some(u8_buf_to_string(&buffer[..len]));
        }
        _ => {}
    }

    output
}

fn networking_config_value_struct(
    option: NetworkingConfigValue,
) -> Result<(sys::SteamNetworkingConfigValue_t, Option<CString>), Error> {
    let value = networking_config_value(option.value)?;
    let data_type = networking_config_data_type_from_option(&option)?;
    let mut output =
        unsafe { MaybeUninit::<sys::SteamNetworkingConfigValue_t>::zeroed().assume_init() };

    match data_type {
        sys::ESteamNetworkingConfigDataType::k_ESteamNetworkingConfig_Int32 => {
            let data = option.int32_value.ok_or_else(|| {
                Error::from_reason("networking config int32 value requires int32Value")
            })?;
            unsafe {
                sys::SteamAPI_SteamNetworkingConfigValue_t_SetInt32(&mut output, value, data)
            };
            Ok((output, None))
        }
        sys::ESteamNetworkingConfigDataType::k_ESteamNetworkingConfig_Int64 => {
            let data = option
                .int64_value
                .ok_or_else(|| {
                    Error::from_reason("networking config int64 value requires int64Value")
                })
                .and_then(|value| bigint_to_i64(value, "networking config int64 value"))?;
            unsafe {
                sys::SteamAPI_SteamNetworkingConfigValue_t_SetInt64(&mut output, value, data)
            };
            Ok((output, None))
        }
        sys::ESteamNetworkingConfigDataType::k_ESteamNetworkingConfig_Float => {
            let data = option.float_value.ok_or_else(|| {
                Error::from_reason("networking config float value requires floatValue")
            })? as f32;
            unsafe {
                sys::SteamAPI_SteamNetworkingConfigValue_t_SetFloat(&mut output, value, data)
            };
            Ok((output, None))
        }
        sys::ESteamNetworkingConfigDataType::k_ESteamNetworkingConfig_String => {
            let data = option.string_value.ok_or_else(|| {
                Error::from_reason("networking config string value requires stringValue")
            })?;
            let data = cstring(data, "networking config string value")?;
            unsafe {
                sys::SteamAPI_SteamNetworkingConfigValue_t_SetString(
                    &mut output,
                    value,
                    data.as_ptr(),
                )
            };
            Ok((output, Some(data)))
        }
        sys::ESteamNetworkingConfigDataType::k_ESteamNetworkingConfig_Ptr => {
            Err(Error::from_reason(
                "networking config pointer values are not supported from JavaScript",
            ))
        }
        _ => Err(Error::from_reason(
            "unsupported Steam networking config data type",
        )),
    }
}

fn networking_config_data_type_from_option(
    option: &NetworkingConfigValue,
) -> Result<sys::ESteamNetworkingConfigDataType, Error> {
    if let Some(data_type) = option.data_type {
        return networking_config_data_type(data_type);
    }

    let mut inferred = Vec::new();
    if option.int32_value.is_some() {
        inferred.push(sys::ESteamNetworkingConfigDataType::k_ESteamNetworkingConfig_Int32);
    }
    if option.int64_value.is_some() {
        inferred.push(sys::ESteamNetworkingConfigDataType::k_ESteamNetworkingConfig_Int64);
    }
    if option.float_value.is_some() {
        inferred.push(sys::ESteamNetworkingConfigDataType::k_ESteamNetworkingConfig_Float);
    }
    if option.string_value.is_some() {
        inferred.push(sys::ESteamNetworkingConfigDataType::k_ESteamNetworkingConfig_String);
    }

    match inferred.as_slice() {
        [data_type] => Ok(*data_type),
        [] => Err(Error::from_reason(
            "networking config value requires dataType or one concrete value field",
        )),
        _ => Err(Error::from_reason(
            "networking config value has multiple value fields; pass dataType to disambiguate",
        )),
    }
}

macro_rules! steam_networking_config_value {
    ($value:expr, $($variant:ident),+ $(,)?) => {
        match $value {
            $(
                value if value == sys::ESteamNetworkingConfigValue::$variant as u32 => {
                    Ok(sys::ESteamNetworkingConfigValue::$variant)
                },
            )+
            _ => Err(Error::from_reason(format!(
                "unsupported Steam networking config value {value}",
                value = $value
            ))),
        }
    };
}

fn networking_config_value(value: u32) -> Result<sys::ESteamNetworkingConfigValue, Error> {
    steam_networking_config_value!(
        value,
        k_ESteamNetworkingConfig_Invalid,
        k_ESteamNetworkingConfig_TimeoutInitial,
        k_ESteamNetworkingConfig_TimeoutConnected,
        k_ESteamNetworkingConfig_SendBufferSize,
        k_ESteamNetworkingConfig_RecvBufferSize,
        k_ESteamNetworkingConfig_RecvBufferMessages,
        k_ESteamNetworkingConfig_RecvMaxMessageSize,
        k_ESteamNetworkingConfig_RecvMaxSegmentsPerPacket,
        k_ESteamNetworkingConfig_ConnectionUserData,
        k_ESteamNetworkingConfig_SendRateMin,
        k_ESteamNetworkingConfig_SendRateMax,
        k_ESteamNetworkingConfig_NagleTime,
        k_ESteamNetworkingConfig_IP_AllowWithoutAuth,
        k_ESteamNetworkingConfig_IPLocalHost_AllowWithoutAuth,
        k_ESteamNetworkingConfig_MTU_PacketSize,
        k_ESteamNetworkingConfig_MTU_DataSize,
        k_ESteamNetworkingConfig_Unencrypted,
        k_ESteamNetworkingConfig_SymmetricConnect,
        k_ESteamNetworkingConfig_LocalVirtualPort,
        k_ESteamNetworkingConfig_DualWifi_Enable,
        k_ESteamNetworkingConfig_EnableDiagnosticsUI,
        k_ESteamNetworkingConfig_SendTimeSincePreviousPacket,
        k_ESteamNetworkingConfig_FakePacketLoss_Send,
        k_ESteamNetworkingConfig_FakePacketLoss_Recv,
        k_ESteamNetworkingConfig_FakePacketLag_Send,
        k_ESteamNetworkingConfig_FakePacketLag_Recv,
        k_ESteamNetworkingConfig_FakePacketJitter_Send_Avg,
        k_ESteamNetworkingConfig_FakePacketJitter_Send_Max,
        k_ESteamNetworkingConfig_FakePacketJitter_Send_Pct,
        k_ESteamNetworkingConfig_FakePacketJitter_Recv_Avg,
        k_ESteamNetworkingConfig_FakePacketJitter_Recv_Max,
        k_ESteamNetworkingConfig_FakePacketJitter_Recv_Pct,
        k_ESteamNetworkingConfig_FakePacketReorder_Send,
        k_ESteamNetworkingConfig_FakePacketReorder_Recv,
        k_ESteamNetworkingConfig_FakePacketReorder_Time,
        k_ESteamNetworkingConfig_FakePacketDup_Send,
        k_ESteamNetworkingConfig_FakePacketDup_Recv,
        k_ESteamNetworkingConfig_FakePacketDup_TimeMax,
        k_ESteamNetworkingConfig_PacketTraceMaxBytes,
        k_ESteamNetworkingConfig_FakeRateLimit_Send_Rate,
        k_ESteamNetworkingConfig_FakeRateLimit_Send_Burst,
        k_ESteamNetworkingConfig_FakeRateLimit_Recv_Rate,
        k_ESteamNetworkingConfig_FakeRateLimit_Recv_Burst,
        k_ESteamNetworkingConfig_OutOfOrderCorrectionWindowMicroseconds,
        k_ESteamNetworkingConfig_Callback_ConnectionStatusChanged,
        k_ESteamNetworkingConfig_Callback_AuthStatusChanged,
        k_ESteamNetworkingConfig_Callback_RelayNetworkStatusChanged,
        k_ESteamNetworkingConfig_Callback_MessagesSessionRequest,
        k_ESteamNetworkingConfig_Callback_MessagesSessionFailed,
        k_ESteamNetworkingConfig_Callback_CreateConnectionSignaling,
        k_ESteamNetworkingConfig_Callback_FakeIPResult,
        k_ESteamNetworkingConfig_P2P_STUN_ServerList,
        k_ESteamNetworkingConfig_P2P_Transport_ICE_Enable,
        k_ESteamNetworkingConfig_P2P_Transport_ICE_Penalty,
        k_ESteamNetworkingConfig_P2P_Transport_SDR_Penalty,
        k_ESteamNetworkingConfig_P2P_TURN_ServerList,
        k_ESteamNetworkingConfig_P2P_TURN_UserList,
        k_ESteamNetworkingConfig_P2P_TURN_PassList,
        k_ESteamNetworkingConfig_P2P_Transport_ICE_Implementation,
        k_ESteamNetworkingConfig_SDRClient_ConsecutitivePingTimeoutsFailInitial,
        k_ESteamNetworkingConfig_SDRClient_ConsecutitivePingTimeoutsFail,
        k_ESteamNetworkingConfig_SDRClient_MinPingsBeforePingAccurate,
        k_ESteamNetworkingConfig_SDRClient_SingleSocket,
        k_ESteamNetworkingConfig_SDRClient_ForceRelayCluster,
        k_ESteamNetworkingConfig_SDRClient_DevTicket,
        k_ESteamNetworkingConfig_SDRClient_ForceProxyAddr,
        k_ESteamNetworkingConfig_SDRClient_FakeClusterPing,
        k_ESteamNetworkingConfig_SDRClient_LimitPingProbesToNearestN,
        k_ESteamNetworkingConfig_LogLevel_AckRTT,
        k_ESteamNetworkingConfig_LogLevel_PacketDecode,
        k_ESteamNetworkingConfig_LogLevel_Message,
        k_ESteamNetworkingConfig_LogLevel_PacketGaps,
        k_ESteamNetworkingConfig_LogLevel_P2PRendezvous,
        k_ESteamNetworkingConfig_LogLevel_SDRRelayPings,
        k_ESteamNetworkingConfig_ECN,
        k_ESteamNetworkingConfig_SDRClient_EnableTOSProbes,
        k_ESteamNetworkingConfig_DELETED_EnumerateDevVars,
    )
}

fn networking_config_scope(value: u32) -> Result<sys::ESteamNetworkingConfigScope, Error> {
    match value {
        value
            if value
                == sys::ESteamNetworkingConfigScope::k_ESteamNetworkingConfig_Global as u32 =>
        {
            Ok(sys::ESteamNetworkingConfigScope::k_ESteamNetworkingConfig_Global)
        }
        value
            if value
                == sys::ESteamNetworkingConfigScope::k_ESteamNetworkingConfig_SocketsInterface
                    as u32 =>
        {
            Ok(sys::ESteamNetworkingConfigScope::k_ESteamNetworkingConfig_SocketsInterface)
        }
        value
            if value
                == sys::ESteamNetworkingConfigScope::k_ESteamNetworkingConfig_ListenSocket
                    as u32 =>
        {
            Ok(sys::ESteamNetworkingConfigScope::k_ESteamNetworkingConfig_ListenSocket)
        }
        value
            if value
                == sys::ESteamNetworkingConfigScope::k_ESteamNetworkingConfig_Connection as u32 =>
        {
            Ok(sys::ESteamNetworkingConfigScope::k_ESteamNetworkingConfig_Connection)
        }
        _ => Err(Error::from_reason(format!(
            "unsupported Steam networking config scope {value}"
        ))),
    }
}

fn networking_config_scope_obj(value: i64) -> Result<isize, Error> {
    isize::try_from(value)
        .map_err(|_| Error::from_reason("networking config scope object is too large"))
}

fn networking_config_data_type(value: u32) -> Result<sys::ESteamNetworkingConfigDataType, Error> {
    match value {
        value
            if value
                == sys::ESteamNetworkingConfigDataType::k_ESteamNetworkingConfig_Int32 as u32 =>
        {
            Ok(sys::ESteamNetworkingConfigDataType::k_ESteamNetworkingConfig_Int32)
        }
        value
            if value
                == sys::ESteamNetworkingConfigDataType::k_ESteamNetworkingConfig_Int64 as u32 =>
        {
            Ok(sys::ESteamNetworkingConfigDataType::k_ESteamNetworkingConfig_Int64)
        }
        value
            if value
                == sys::ESteamNetworkingConfigDataType::k_ESteamNetworkingConfig_Float as u32 =>
        {
            Ok(sys::ESteamNetworkingConfigDataType::k_ESteamNetworkingConfig_Float)
        }
        value
            if value
                == sys::ESteamNetworkingConfigDataType::k_ESteamNetworkingConfig_String as u32 =>
        {
            Ok(sys::ESteamNetworkingConfigDataType::k_ESteamNetworkingConfig_String)
        }
        value
            if value
                == sys::ESteamNetworkingConfigDataType::k_ESteamNetworkingConfig_Ptr as u32 =>
        {
            Ok(sys::ESteamNetworkingConfigDataType::k_ESteamNetworkingConfig_Ptr)
        }
        _ => Err(Error::from_reason(format!(
            "unsupported Steam networking config data type {value}"
        ))),
    }
}

fn networking_debug_output_type(
    value: u32,
) -> Result<sys::ESteamNetworkingSocketsDebugOutputType, Error> {
    match value {
        value
            if value
                == sys::ESteamNetworkingSocketsDebugOutputType::k_ESteamNetworkingSocketsDebugOutputType_None
                    as u32 =>
        {
            Ok(sys::ESteamNetworkingSocketsDebugOutputType::k_ESteamNetworkingSocketsDebugOutputType_None)
        }
        value
            if value
                == sys::ESteamNetworkingSocketsDebugOutputType::k_ESteamNetworkingSocketsDebugOutputType_Bug
                    as u32 =>
        {
            Ok(sys::ESteamNetworkingSocketsDebugOutputType::k_ESteamNetworkingSocketsDebugOutputType_Bug)
        }
        value
            if value
                == sys::ESteamNetworkingSocketsDebugOutputType::k_ESteamNetworkingSocketsDebugOutputType_Error
                    as u32 =>
        {
            Ok(sys::ESteamNetworkingSocketsDebugOutputType::k_ESteamNetworkingSocketsDebugOutputType_Error)
        }
        value
            if value
                == sys::ESteamNetworkingSocketsDebugOutputType::k_ESteamNetworkingSocketsDebugOutputType_Important
                    as u32 =>
        {
            Ok(sys::ESteamNetworkingSocketsDebugOutputType::k_ESteamNetworkingSocketsDebugOutputType_Important)
        }
        value
            if value
                == sys::ESteamNetworkingSocketsDebugOutputType::k_ESteamNetworkingSocketsDebugOutputType_Warning
                    as u32 =>
        {
            Ok(sys::ESteamNetworkingSocketsDebugOutputType::k_ESteamNetworkingSocketsDebugOutputType_Warning)
        }
        value
            if value
                == sys::ESteamNetworkingSocketsDebugOutputType::k_ESteamNetworkingSocketsDebugOutputType_Msg
                    as u32 =>
        {
            Ok(sys::ESteamNetworkingSocketsDebugOutputType::k_ESteamNetworkingSocketsDebugOutputType_Msg)
        }
        value
            if value
                == sys::ESteamNetworkingSocketsDebugOutputType::k_ESteamNetworkingSocketsDebugOutputType_Verbose
                    as u32 =>
        {
            Ok(sys::ESteamNetworkingSocketsDebugOutputType::k_ESteamNetworkingSocketsDebugOutputType_Verbose)
        }
        value
            if value
                == sys::ESteamNetworkingSocketsDebugOutputType::k_ESteamNetworkingSocketsDebugOutputType_Debug
                    as u32 =>
        {
            Ok(sys::ESteamNetworkingSocketsDebugOutputType::k_ESteamNetworkingSocketsDebugOutputType_Debug)
        }
        value
            if value
                == sys::ESteamNetworkingSocketsDebugOutputType::k_ESteamNetworkingSocketsDebugOutputType_Everything
                    as u32 =>
        {
            Ok(sys::ESteamNetworkingSocketsDebugOutputType::k_ESteamNetworkingSocketsDebugOutputType_Everything)
        }
        _ => Err(Error::from_reason(format!(
            "unsupported Steam networking debug output type {value}"
        ))),
    }
}

fn networking_virtual_port(port: Option<i32>) -> Result<i32, Error> {
    let port = port.unwrap_or(0);
    if port < 0 {
        Err(Error::from_reason(
            "networking virtual port must be non-negative",
        ))
    } else {
        Ok(port)
    }
}

fn game_server_mode(value: u32) -> Result<sys::EServerMode, Error> {
    match value {
        value if value == sys::EServerMode::eServerModeNoAuthentication as u32 => {
            Ok(sys::EServerMode::eServerModeNoAuthentication)
        }
        value if value == sys::EServerMode::eServerModeAuthentication as u32 => {
            Ok(sys::EServerMode::eServerModeAuthentication)
        }
        value if value == sys::EServerMode::eServerModeAuthenticationAndSecure as u32 => {
            Ok(sys::EServerMode::eServerModeAuthenticationAndSecure)
        }
        _ => Err(Error::from_reason(format!(
            "unsupported game server mode {value}"
        ))),
    }
}

fn game_server_init_error_message(
    result: sys::ESteamAPIInitResult,
    err_msg: &sys::SteamErrMsg,
) -> String {
    let message = c_buf_to_string(err_msg);
    if message.is_empty() {
        format!("Steam Game Server initialization failed: {result:?}")
    } else {
        format!("Steam Game Server initialization failed: {result:?}: {message}")
    }
}

fn game_server_public_ip(address: &mut sys::SteamIPAddress_t) -> GameServerPublicIp {
    let is_set = unsafe { sys::SteamAPI_SteamIPAddress_t_IsSet(address) };
    let ip_type = unsafe { ptr::addr_of!(address.m_eType).read_unaligned() };
    let ipv4 = matches!(ip_type, sys::ESteamIPType::k_ESteamIPTypeIPv4)
        .then(|| unsafe { ptr::addr_of!(address.__bindgen_anon_1.m_unIPv4).read_unaligned() });
    let ipv6 = matches!(ip_type, sys::ESteamIPType::k_ESteamIPTypeIPv6).then(|| {
        let bytes = unsafe { ptr::addr_of!(address.__bindgen_anon_1.m_rgubIPv6).read_unaligned() };
        Vec::from(bytes).into()
    });
    GameServerPublicIp {
        is_set,
        ip_type: ip_type as u32,
        ipv4,
        ipv4_address: ipv4.map(ipv4_to_string),
        ipv6,
    }
}

pub(crate) fn clear_networking_fake_udp_ports() {
    let ports = NETWORKING_FAKE_UDP_PORTS
        .lock()
        .expect("Steam fake UDP port registry poisoned")
        .drain()
        .map(|(_, port)| port)
        .collect::<Vec<_>>();
    for port in ports {
        if port != 0 {
            unsafe {
                sys::SteamAPI_ISteamNetworkingFakeUDPPort_DestroyFakeUDPPort(
                    port as *mut sys::ISteamNetworkingFakeUDPPort,
                );
            }
        }
    }
}

fn register_networking_fake_udp_port(
    port: *mut sys::ISteamNetworkingFakeUDPPort,
) -> Result<u32, Error> {
    let mut registry = NETWORKING_FAKE_UDP_PORTS
        .lock()
        .expect("Steam fake UDP port registry poisoned");
    for _ in 0..u32::MAX {
        let handle = NEXT_NETWORKING_FAKE_UDP_PORT_HANDLE.fetch_add(1, Ordering::Relaxed);
        if handle == 0 || registry.contains_key(&handle) {
            continue;
        }
        registry.insert(handle, port as usize);
        return Ok(handle);
    }
    Err(Error::from_reason("exhausted Steam fake UDP port handles"))
}

fn with_networking_fake_udp_port<T>(
    handle: u32,
    action: impl FnOnce(*mut sys::ISteamNetworkingFakeUDPPort) -> Result<T, Error>,
) -> Result<T, Error> {
    ensure_networking_or_game_server_initialized()?;
    let registry = NETWORKING_FAKE_UDP_PORTS
        .lock()
        .expect("Steam fake UDP port registry poisoned");
    let port = registry
        .get(&handle)
        .copied()
        .ok_or_else(|| Error::from_reason("invalid Steam fake UDP port handle"))?;
    action(port as *mut sys::ISteamNetworkingFakeUDPPort)
}

fn ensure_networking_or_game_server_initialized() -> Result<(), Error> {
    if crate::state::is_initialized() || crate::state::is_game_server_initialized() {
        Ok(())
    } else {
        Err(Error::from_reason(
            "Steam Bridge or Steam Game Server has not been initialized",
        ))
    }
}

fn receive_networking_messages<F>(
    max_messages: Option<u32>,
    receive: F,
) -> Result<Vec<NetworkingMessage>, Error>
where
    F: FnOnce(*mut *mut sys::SteamNetworkingMessage_t, i32) -> i32,
{
    let max_messages = max_messages.unwrap_or(32).clamp(1, 1024);
    let mut messages = vec![ptr::null_mut(); max_messages as usize];
    let received = receive(messages.as_mut_ptr(), max_messages as i32);
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

fn allocate_networking_socket_message(
    utils: *mut sys::ISteamNetworkingUtils,
    message: NetworkingSocketOutgoingMessage,
) -> Result<*mut sys::SteamNetworkingMessage_t, Error> {
    let data_size = networking_socket_message_data_size(&message.data)?;
    let raw = unsafe { sys::SteamAPI_ISteamNetworkingUtils_AllocateMessage(utils, data_size) };
    if raw.is_null() {
        return Err(Error::from_reason(
            "Steam failed to allocate networking socket message",
        ));
    }

    let result = unsafe {
        fill_networking_socket_message(raw, message, data_size)?;
        Ok(raw)
    };
    if result.is_err() {
        unsafe { sys::SteamAPI_SteamNetworkingMessage_t_Release(raw) };
    }
    result
}

unsafe fn fill_networking_socket_message(
    raw: *mut sys::SteamNetworkingMessage_t,
    message: NetworkingSocketOutgoingMessage,
    data_size: i32,
) -> Result<(), Error> {
    let data_ptr = ptr::addr_of!((*raw).m_pData).read_unaligned();
    if data_size > 0 {
        if data_ptr.is_null() {
            return Err(Error::from_reason(
                "Steam allocated networking socket message without payload storage",
            ));
        }
        ptr::copy_nonoverlapping(
            message.data.as_ptr(),
            data_ptr.cast::<u8>(),
            data_size as usize,
        );
    }

    ptr::addr_of_mut!((*raw).m_conn).write_unaligned(message.connection);
    ptr::addr_of_mut!((*raw).m_nFlags).write_unaligned(
        message
            .send_flags
            .unwrap_or(sys::k_nSteamNetworkingSend_Reliable),
    );
    Ok(())
}

fn release_networking_messages(messages: &[*mut sys::SteamNetworkingMessage_t]) {
    for message in messages {
        if !message.is_null() {
            unsafe { sys::SteamAPI_SteamNetworkingMessage_t_Release(*message) };
        }
    }
}

fn networking_socket_message_data_size(data: &Buffer) -> Result<i32, Error> {
    let size = len_to_i32(data.len(), "networking socket message")?;
    if size > sys::k_cbMaxSteamNetworkingSocketsMessageSizeSend {
        return Err(Error::from_reason(format!(
            "networking socket message cannot exceed {} bytes",
            sys::k_cbMaxSteamNetworkingSocketsMessageSizeSend
        )));
    }
    Ok(size)
}

fn networking_socket_send_messages_result(value: i64) -> NetworkingSocketSendResult {
    if value < 0 {
        NetworkingSocketSendResult {
            result: value.saturating_abs() as u32,
            message_number: 0i64.into(),
        }
    } else {
        NetworkingSocketSendResult {
            result: sys::EResult::k_EResultOK as u32,
            message_number: value.into(),
        }
    }
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

fn networking_real_time_lane_status(
    status: &sys::SteamNetConnectionRealTimeLaneStatus_t,
) -> NetworkingConnectionRealTimeLaneStatus {
    NetworkingConnectionRealTimeLaneStatus {
        pending_unreliable: unsafe { ptr::addr_of!(status.m_cbPendingUnreliable).read_unaligned() },
        pending_reliable: unsafe { ptr::addr_of!(status.m_cbPendingReliable).read_unaligned() },
        sent_unacked_reliable: unsafe {
            ptr::addr_of!(status.m_cbSentUnackedReliable).read_unaligned()
        },
        queue_time: unsafe { ptr::addr_of!(status.m_usecQueueTime).read_unaligned() }.into(),
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

fn networking_connection_info(
    info: &sys::SteamNetConnectionInfo_t,
) -> Result<NetworkingConnectionInfo, Error> {
    let remote_address = unsafe { ptr::addr_of!(info.m_addrRemote).read_unaligned() };
    Ok(NetworkingConnectionInfo {
        state: unsafe { ptr::addr_of!(info.m_eState).read_unaligned() } as i32,
        remote_identity: networking_identity_info(unsafe {
            ptr::addr_of!(info.m_identityRemote).read_unaligned()
        }),
        user_data: unsafe { ptr::addr_of!(info.m_nUserData).read_unaligned() }.into(),
        listen_socket: unsafe { ptr::addr_of!(info.m_hListenSocket).read_unaligned() },
        remote_address: networking_ip_address_info(steam_networking_utils()?, remote_address, true),
        remote_pop: unsafe { ptr::addr_of!(info.m_idPOPRemote).read_unaligned() },
        relay_pop: unsafe { ptr::addr_of!(info.m_idPOPRelay).read_unaligned() },
        end_reason: unsafe { ptr::addr_of!(info.m_eEndReason).read_unaligned() },
        end_debug: c_buf_to_string(unsafe { &*ptr::addr_of!(info.m_szEndDebug) }),
        connection_description: c_buf_to_string(unsafe {
            &*ptr::addr_of!(info.m_szConnectionDescription)
        }),
        flags: unsafe { ptr::addr_of!(info.m_nFlags).read_unaligned() },
    })
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

fn networking_connection_info_json(info: &sys::SteamNetConnectionInfo_t) -> Value {
    let remote_address = unsafe { ptr::addr_of!(info.m_addrRemote).read_unaligned() };
    let address = steam_networking_utils().ok().map(|utils| {
        networking_ip_address_info_json(networking_ip_address_info(utils, remote_address, true))
    });
    serde_json::json!({
        "state": unsafe { ptr::addr_of!(info.m_eState).read_unaligned() } as i32,
        "remote_identity": networking_identity_json(unsafe { ptr::addr_of!(info.m_identityRemote).read_unaligned() }),
        "user_data": unsafe { ptr::addr_of!(info.m_nUserData).read_unaligned() }.to_string(),
        "listen_socket": unsafe { ptr::addr_of!(info.m_hListenSocket).read_unaligned() },
        "remote_address": address,
        "remote_pop": unsafe { ptr::addr_of!(info.m_idPOPRemote).read_unaligned() },
        "relay_pop": unsafe { ptr::addr_of!(info.m_idPOPRelay).read_unaligned() },
        "end_reason": unsafe { ptr::addr_of!(info.m_eEndReason).read_unaligned() },
        "end_debug": c_buf_to_string(unsafe { &*ptr::addr_of!(info.m_szEndDebug) }),
        "connection_description": c_buf_to_string(unsafe { &*ptr::addr_of!(info.m_szConnectionDescription) }),
        "flags": unsafe { ptr::addr_of!(info.m_nFlags).read_unaligned() }
    })
}

fn networking_ip_address_info_json(address: NetworkingIpAddressInfo) -> Value {
    serde_json::json!({
        "text": address.text,
        "ipv4": address.ipv4,
        "port": address.port,
        "ipv4_address": address.ipv4_address,
        "is_ipv4": address.is_ipv4,
        "is_local_host": address.is_local_host,
        "is_fake_ip": address.is_fake_ip,
        "fake_ip_type": address.fake_ip_type,
        "ipv6_all_zeros": address.ipv6_all_zeros
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
        ipv6,
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

    if let Some(ipv6) = ipv6 {
        if ipv6.len() != 16 {
            return Err(Error::from_reason(
                "networking IPv6 address must be 16 bytes",
            ));
        }
        unsafe { sys::SteamAPI_SteamNetworkingIPAddr_SetIPv6(&mut output, ipv6.as_ptr(), port) };
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

fn legacy_networking_steam_ip(ip: u32) -> sys::SteamIPAddress_t {
    sys::SteamIPAddress_t {
        __bindgen_anon_1: sys::SteamIPAddress_t__bindgen_ty_1 { m_unIPv4: ip },
        m_eType: sys::ESteamIPType::k_ESteamIPTypeIPv4,
    }
}

fn legacy_networking_ip_parts(ip: sys::SteamIPAddress_t) -> (Option<u32>, Option<String>) {
    let ip_type = unsafe { ptr::addr_of!(ip.m_eType).read_unaligned() };
    let ipv4 = matches!(ip_type, sys::ESteamIPType::k_ESteamIPTypeIPv4)
        .then(|| unsafe { ptr::addr_of!(ip.__bindgen_anon_1.m_unIPv4).read_unaligned() });
    (ipv4, ipv4.map(ipv4_to_string))
}

fn port_to_u16(port: u32, label: &str) -> Result<u16, Error> {
    port.try_into()
        .map_err(|_| Error::from_reason(format!("{label} must be between 0 and 65535")))
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

fn networking_ip_address_string_standalone(
    mut address: sys::SteamNetworkingIPAddr,
    with_port: bool,
) -> String {
    let mut output = vec![0i8; sys::SteamNetworkingIPAddr_k_cchMaxString as usize];
    unsafe {
        sys::SteamAPI_SteamNetworkingIPAddr_ToString(
            &mut address,
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

fn bytes_to_hex(bytes: &[u8]) -> String {
    let mut output = String::with_capacity(bytes.len() * 2);
    for byte in bytes {
        use std::fmt::Write as _;
        let _ = write!(&mut output, "{byte:02x}");
    }
    output
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

fn run_game_server_callbacks() {
    if !crate::state::is_game_server_initialized() {
        return;
    }

    unsafe {
        let pipe = sys::SteamGameServer_GetHSteamPipe();
        if pipe == 0 {
            sys::SteamGameServer_RunCallbacks();
            return;
        }

        sys::SteamAPI_ManualDispatch_RunFrame(pipe);
        let mut callback = std::mem::zeroed::<sys::CallbackMsg_t>();

        while sys::SteamAPI_ManualDispatch_GetNextCallback(pipe, &mut callback) {
            let callback_id = ptr::addr_of!(callback.m_iCallback).read_unaligned();
            let param = ptr::addr_of!(callback.m_pubParam).read_unaligned();

            crate::state::dispatch_callback(callback_id, param.cast::<c_void>());
            sys::SteamAPI_ManualDispatch_FreeLastCallback(pipe);
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

async fn wait_for_game_server_api_call<T>(
    call: sys::SteamAPICall_t,
    expected_callback: i32,
    timeout_seconds: u64,
) -> Result<T, Error> {
    wait_for_game_server_api_call_with_progress(call, expected_callback, timeout_seconds, || {})
        .await
}

async fn wait_for_game_server_api_call_with_progress<T, F>(
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
            "Steam returned an invalid game server API call handle",
        ));
    }
    let started = Instant::now();
    loop {
        run_game_server_callbacks();
        let utils = steam_game_server_utils()?;
        let mut failed = false;
        let completed =
            unsafe { sys::SteamAPI_ISteamUtils_IsAPICallCompleted(utils, call, &mut failed) };
        if completed {
            if failed {
                let reason =
                    unsafe { sys::SteamAPI_ISteamUtils_GetAPICallFailureReason(utils, call) };
                return Err(Error::from_reason(format!(
                    "Steam game server API call failed: {reason:?}"
                )));
            }
            let mut result = MaybeUninit::<T>::zeroed();
            let mut result_failed = false;
            let pipe = unsafe { sys::SteamGameServer_GetHSteamPipe() };
            let ok = (pipe != 0
                && unsafe {
                    sys::SteamAPI_ManualDispatch_GetAPICallResult(
                        pipe,
                        call,
                        result.as_mut_ptr().cast::<c_void>(),
                        std::mem::size_of::<T>() as i32,
                        expected_callback,
                        &mut result_failed,
                    )
                })
                || unsafe {
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
                    "Steam game server API call completed but result retrieval failed",
                ));
            }
            return Ok(unsafe { result.assume_init() });
        }
        if started.elapsed() > Duration::from_secs(timeout_seconds) {
            return Err(Error::from_reason("Steam game server API call timed out"));
        }
        tick();
        tokio::time::sleep(Duration::from_millis(16)).await;
    }
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
    if matches!(ugc_interface_context(), UgcInterfaceContext::GameServer) {
        return wait_for_game_server_api_call_with_progress(
            call,
            expected_callback,
            timeout_seconds,
            tick,
        )
        .await;
    }

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
        CALLBACK_ENCRYPTED_APP_TICKET_RESPONSE => {
            Ok(sys::EncryptedAppTicketResponse_t_k_iCallback as i32)
        }
        CALLBACK_GET_AUTH_SESSION_TICKET_RESPONSE => {
            Ok(sys::GetAuthSessionTicketResponse_t_k_iCallback as i32)
        }
        CALLBACK_STORE_AUTH_URL_RESPONSE => Ok(sys::StoreAuthURLResponse_t_k_iCallback as i32),
        CALLBACK_MARKET_ELIGIBILITY_RESPONSE => {
            Ok(sys::MarketEligibilityResponse_t_k_iCallback as i32)
        }
        CALLBACK_DURATION_CONTROL => Ok(sys::DurationControl_t_k_iCallback as i32),
        331 => Ok(sys::GameOverlayActivated_t_k_iCallback as i32),
        CALLBACK_IP_COUNTRY => Ok(sys::IPCountry_t_k_iCallback as i32),
        CALLBACK_LOW_BATTERY_POWER => Ok(sys::LowBatteryPower_t_k_iCallback as i32),
        CALLBACK_STEAM_API_CALL_COMPLETED => Ok(sys::SteamAPICallCompleted_t_k_iCallback as i32),
        CALLBACK_STEAM_SHUTDOWN => Ok(sys::SteamShutdown_t_k_iCallback as i32),
        CALLBACK_CHECK_FILE_SIGNATURE => Ok(sys::CheckFileSignature_t_k_iCallback as i32),
        CALLBACK_GAMEPAD_TEXT_INPUT_DISMISSED => {
            Ok(sys::GamepadTextInputDismissed_t_k_iCallback as i32)
        }
        CALLBACK_APP_RESUMING_FROM_SUSPEND => Ok(sys::AppResumingFromSuspend_t_k_iCallback as i32),
        CALLBACK_FLOATING_GAMEPAD_TEXT_INPUT_DISMISSED => {
            Ok(sys::FloatingGamepadTextInputDismissed_t_k_iCallback as i32)
        }
        CALLBACK_FILTER_TEXT_DICTIONARY_CHANGED => {
            Ok(sys::FilterTextDictionaryChanged_t_k_iCallback as i32)
        }
        CALLBACK_DLC_INSTALLED => Ok(sys::DlcInstalled_t_k_iCallback as i32),
        CALLBACK_NEW_URL_LAUNCH_PARAMETERS => Ok(sys::NewUrlLaunchParameters_t_k_iCallback as i32),
        CALLBACK_APP_PROOF_OF_PURCHASE_KEY_RESPONSE => {
            Ok(sys::AppProofOfPurchaseKeyResponse_t_k_iCallback as i32)
        }
        CALLBACK_FILE_DETAILS_RESULT => Ok(sys::FileDetailsResult_t_k_iCallback as i32),
        CALLBACK_TIMED_TRIAL_STATUS => Ok(sys::TimedTrialStatus_t_k_iCallback as i32),
        CALLBACK_FAVORITES_LIST_CHANGED => Ok(sys::FavoritesListChanged_t_k_iCallback as i32),
        CALLBACK_LOBBY_INVITE => Ok(sys::LobbyInvite_t_k_iCallback as i32),
        CALLBACK_LOBBY_ENTER => Ok(sys::LobbyEnter_t_k_iCallback as i32),
        CALLBACK_LOBBY_DATA_UPDATE => Ok(sys::LobbyDataUpdate_t_k_iCallback as i32),
        CALLBACK_LOBBY_CHAT_UPDATE => Ok(sys::LobbyChatUpdate_t_k_iCallback as i32),
        CALLBACK_LOBBY_CHAT_MSG => Ok(sys::LobbyChatMsg_t_k_iCallback as i32),
        CALLBACK_LOBBY_GAME_CREATED => Ok(sys::LobbyGameCreated_t_k_iCallback as i32),
        CALLBACK_LOBBY_MATCH_LIST => Ok(sys::LobbyMatchList_t_k_iCallback as i32),
        CALLBACK_LOBBY_KICKED => Ok(sys::LobbyKicked_t_k_iCallback as i32),
        CALLBACK_GAME_SERVER_CHANGE_REQUESTED => {
            Ok(sys::GameServerChangeRequested_t_k_iCallback as i32)
        }
        CALLBACK_GAME_LOBBY_JOIN_REQUESTED => Ok(sys::GameLobbyJoinRequested_t_k_iCallback as i32),
        CALLBACK_AVATAR_IMAGE_LOADED => Ok(sys::AvatarImageLoaded_t_k_iCallback as i32),
        CALLBACK_CLAN_OFFICER_LIST_RESPONSE => {
            Ok(sys::ClanOfficerListResponse_t_k_iCallback as i32)
        }
        CALLBACK_FRIEND_RICH_PRESENCE_UPDATE => {
            Ok(sys::FriendRichPresenceUpdate_t_k_iCallback as i32)
        }
        CALLBACK_GAME_RICH_PRESENCE_JOIN_REQUESTED => {
            Ok(sys::GameRichPresenceJoinRequested_t_k_iCallback as i32)
        }
        CALLBACK_GAME_CONNECTED_CLAN_CHAT_MSG => {
            Ok(sys::GameConnectedClanChatMsg_t_k_iCallback as i32)
        }
        CALLBACK_GAME_CONNECTED_CHAT_JOIN => Ok(sys::GameConnectedChatJoin_t_k_iCallback as i32),
        CALLBACK_GAME_CONNECTED_CHAT_LEAVE => Ok(sys::GameConnectedChatLeave_t_k_iCallback as i32),
        CALLBACK_DOWNLOAD_CLAN_ACTIVITY_COUNTS_RESULT => {
            Ok(sys::DownloadClanActivityCountsResult_t_k_iCallback as i32)
        }
        CALLBACK_JOIN_CLAN_CHAT_ROOM_COMPLETION_RESULT => {
            Ok(sys::JoinClanChatRoomCompletionResult_t_k_iCallback as i32)
        }
        CALLBACK_GAME_CONNECTED_FRIEND_CHAT_MSG => {
            Ok(sys::GameConnectedFriendChatMsg_t_k_iCallback as i32)
        }
        CALLBACK_FRIENDS_GET_FOLLOWER_COUNT => {
            Ok(sys::FriendsGetFollowerCount_t_k_iCallback as i32)
        }
        CALLBACK_FRIENDS_IS_FOLLOWING => Ok(sys::FriendsIsFollowing_t_k_iCallback as i32),
        CALLBACK_FRIENDS_ENUMERATE_FOLLOWING_LIST => {
            Ok(sys::FriendsEnumerateFollowingList_t_k_iCallback as i32)
        }
        CALLBACK_UNREAD_CHAT_MESSAGES_CHANGED => {
            Ok(sys::UnreadChatMessagesChanged_t_k_iCallback as i32)
        }
        CALLBACK_OVERLAY_BROWSER_PROTOCOL_NAVIGATION => {
            Ok(sys::OverlayBrowserProtocolNavigation_t_k_iCallback as i32)
        }
        CALLBACK_STEAM_NET_CONNECTION_STATUS_CHANGED => {
            Ok(sys::SteamNetConnectionStatusChangedCallback_t_k_iCallback as i32)
        }
        CALLBACK_EQUIPPED_PROFILE_ITEMS_CHANGED => {
            Ok(sys::EquippedProfileItemsChanged_t_k_iCallback as i32)
        }
        CALLBACK_EQUIPPED_PROFILE_ITEMS => Ok(sys::EquippedProfileItems_t_k_iCallback as i32),
        CALLBACK_STEAM_NETWORKING_FAKE_IP_RESULT => Ok(CALLBACK_STEAM_NETWORKING_FAKE_IP_RESULT),
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
        CALLBACK_STEAM_INPUT_DEVICE_CONNECTED => {
            Ok(sys::SteamInputDeviceConnected_t_k_iCallback as i32)
        }
        CALLBACK_STEAM_INPUT_DEVICE_DISCONNECTED => {
            Ok(sys::SteamInputDeviceDisconnected_t_k_iCallback as i32)
        }
        CALLBACK_STEAM_INPUT_CONFIGURATION_LOADED => {
            Ok(sys::SteamInputConfigurationLoaded_t_k_iCallback as i32)
        }
        CALLBACK_STEAM_INPUT_GAMEPAD_SLOT_CHANGE => {
            Ok(sys::SteamInputGamepadSlotChange_t_k_iCallback as i32)
        }
        CALLBACK_GAME_SERVER_CLIENT_APPROVE => Ok(sys::GSClientApprove_t_k_iCallback as i32),
        CALLBACK_GAME_SERVER_CLIENT_DENY => Ok(sys::GSClientDeny_t_k_iCallback as i32),
        CALLBACK_GAME_SERVER_CLIENT_KICK => Ok(sys::GSClientKick_t_k_iCallback as i32),
        CALLBACK_GAME_SERVER_CLIENT_ACHIEVEMENT_STATUS => {
            Ok(sys::GSClientAchievementStatus_t_k_iCallback as i32)
        }
        CALLBACK_GAME_SERVER_POLICY_RESPONSE => Ok(sys::GSPolicyResponse_t_k_iCallback as i32),
        CALLBACK_GAME_SERVER_GAMEPLAY_STATS => Ok(sys::GSGameplayStats_t_k_iCallback as i32),
        CALLBACK_GAME_SERVER_CLIENT_GROUP_STATUS => {
            Ok(sys::GSClientGroupStatus_t_k_iCallback as i32)
        }
        CALLBACK_GAME_SERVER_REPUTATION => Ok(sys::GSReputation_t_k_iCallback as i32),
        CALLBACK_GAME_SERVER_ASSOCIATE_WITH_CLAN => {
            Ok(sys::AssociateWithClanResult_t_k_iCallback as i32)
        }
        CALLBACK_GAME_SERVER_PLAYER_COMPATIBILITY => {
            Ok(sys::ComputeNewPlayerCompatibilityResult_t_k_iCallback as i32)
        }
        CALLBACK_GAME_SERVER_STATS_RECEIVED => Ok(sys::GSStatsReceived_t_k_iCallback as i32),
        CALLBACK_GAME_SERVER_STATS_STORED => Ok(sys::GSStatsStored_t_k_iCallback as i32),
        CALLBACK_GAME_SERVER_STATS_UNLOADED => Ok(sys::GSStatsUnloaded_t_k_iCallback as i32),
        CALLBACK_REMOTE_STORAGE_FILE_SHARE_RESULT => {
            Ok(sys::RemoteStorageFileShareResult_t_k_iCallback as i32)
        }
        CALLBACK_REMOTE_STORAGE_PUBLISH_FILE_RESULT => {
            Ok(sys::RemoteStoragePublishFileResult_t_k_iCallback as i32)
        }
        CALLBACK_REMOTE_STORAGE_DELETE_PUBLISHED_FILE_RESULT => {
            Ok(sys::RemoteStorageDeletePublishedFileResult_t_k_iCallback as i32)
        }
        CALLBACK_REMOTE_STORAGE_ENUMERATE_USER_PUBLISHED_FILES_RESULT => {
            Ok(sys::RemoteStorageEnumerateUserPublishedFilesResult_t_k_iCallback as i32)
        }
        CALLBACK_REMOTE_STORAGE_SUBSCRIBE_PUBLISHED_FILE_RESULT => {
            Ok(sys::RemoteStorageSubscribePublishedFileResult_t_k_iCallback as i32)
        }
        CALLBACK_REMOTE_STORAGE_ENUMERATE_USER_SUBSCRIBED_FILES_RESULT => {
            Ok(sys::RemoteStorageEnumerateUserSubscribedFilesResult_t_k_iCallback as i32)
        }
        CALLBACK_REMOTE_STORAGE_UNSUBSCRIBE_PUBLISHED_FILE_RESULT => {
            Ok(sys::RemoteStorageUnsubscribePublishedFileResult_t_k_iCallback as i32)
        }
        CALLBACK_REMOTE_STORAGE_UPDATE_PUBLISHED_FILE_RESULT => {
            Ok(sys::RemoteStorageUpdatePublishedFileResult_t_k_iCallback as i32)
        }
        CALLBACK_REMOTE_STORAGE_DOWNLOAD_UGC_RESULT => {
            Ok(sys::RemoteStorageDownloadUGCResult_t_k_iCallback as i32)
        }
        CALLBACK_REMOTE_STORAGE_GET_PUBLISHED_FILE_DETAILS_RESULT => {
            Ok(sys::RemoteStorageGetPublishedFileDetailsResult_t_k_iCallback as i32)
        }
        CALLBACK_REMOTE_STORAGE_ENUMERATE_WORKSHOP_FILES_RESULT => {
            Ok(sys::RemoteStorageEnumerateWorkshopFilesResult_t_k_iCallback as i32)
        }
        CALLBACK_REMOTE_STORAGE_GET_PUBLISHED_ITEM_VOTE_DETAILS_RESULT => {
            Ok(sys::RemoteStorageGetPublishedItemVoteDetailsResult_t_k_iCallback as i32)
        }
        CALLBACK_REMOTE_STORAGE_PUBLISHED_FILE_SUBSCRIBED => {
            Ok(sys::RemoteStoragePublishedFileSubscribed_t_k_iCallback as i32)
        }
        CALLBACK_REMOTE_STORAGE_PUBLISHED_FILE_UNSUBSCRIBED => {
            Ok(sys::RemoteStoragePublishedFileUnsubscribed_t_k_iCallback as i32)
        }
        CALLBACK_REMOTE_STORAGE_PUBLISHED_FILE_DELETED => {
            Ok(sys::RemoteStoragePublishedFileDeleted_t_k_iCallback as i32)
        }
        CALLBACK_REMOTE_STORAGE_UPDATE_USER_PUBLISHED_ITEM_VOTE_RESULT => {
            Ok(sys::RemoteStorageUpdateUserPublishedItemVoteResult_t_k_iCallback as i32)
        }
        CALLBACK_REMOTE_STORAGE_USER_VOTE_DETAILS => {
            Ok(sys::RemoteStorageUserVoteDetails_t_k_iCallback as i32)
        }
        CALLBACK_REMOTE_STORAGE_ENUMERATE_USER_SHARED_WORKSHOP_FILES_RESULT => {
            Ok(sys::RemoteStorageEnumerateUserSharedWorkshopFilesResult_t_k_iCallback as i32)
        }
        CALLBACK_REMOTE_STORAGE_SET_USER_PUBLISHED_FILE_ACTION_RESULT => {
            Ok(sys::RemoteStorageSetUserPublishedFileActionResult_t_k_iCallback as i32)
        }
        CALLBACK_REMOTE_STORAGE_ENUMERATE_PUBLISHED_FILES_BY_USER_ACTION_RESULT => {
            Ok(sys::RemoteStorageEnumeratePublishedFilesByUserActionResult_t_k_iCallback as i32)
        }
        CALLBACK_REMOTE_STORAGE_PUBLISH_FILE_PROGRESS => {
            Ok(sys::RemoteStoragePublishFileProgress_t_k_iCallback as i32)
        }
        CALLBACK_REMOTE_STORAGE_PUBLISHED_FILE_UPDATED => {
            Ok(sys::RemoteStoragePublishedFileUpdated_t_k_iCallback as i32)
        }
        CALLBACK_REMOTE_STORAGE_FILE_WRITE_ASYNC_COMPLETE => {
            Ok(sys::RemoteStorageFileWriteAsyncComplete_t_k_iCallback as i32)
        }
        CALLBACK_REMOTE_STORAGE_FILE_READ_ASYNC_COMPLETE => {
            Ok(sys::RemoteStorageFileReadAsyncComplete_t_k_iCallback as i32)
        }
        CALLBACK_STEAM_UGC_QUERY_COMPLETED => Ok(sys::SteamUGCQueryCompleted_t_k_iCallback as i32),
        CALLBACK_STEAM_UGC_REQUEST_DETAILS_RESULT => {
            Ok(sys::SteamUGCRequestUGCDetailsResult_t_k_iCallback as i32)
        }
        CALLBACK_STEAM_UGC_CREATE_ITEM_RESULT => Ok(sys::CreateItemResult_t_k_iCallback as i32),
        CALLBACK_STEAM_UGC_SUBMIT_ITEM_UPDATE_RESULT => {
            Ok(sys::SubmitItemUpdateResult_t_k_iCallback as i32)
        }
        CALLBACK_STEAM_UGC_ITEM_INSTALLED => Ok(sys::ItemInstalled_t_k_iCallback as i32),
        CALLBACK_STEAM_UGC_DOWNLOAD_ITEM_RESULT => Ok(sys::DownloadItemResult_t_k_iCallback as i32),
        CALLBACK_STEAM_UGC_USER_FAVORITE_ITEMS_LIST_CHANGED => {
            Ok(sys::UserFavoriteItemsListChanged_t_k_iCallback as i32)
        }
        CALLBACK_STEAM_UGC_SET_USER_ITEM_VOTE_RESULT => {
            Ok(sys::SetUserItemVoteResult_t_k_iCallback as i32)
        }
        CALLBACK_STEAM_UGC_GET_USER_ITEM_VOTE_RESULT => {
            Ok(sys::GetUserItemVoteResult_t_k_iCallback as i32)
        }
        CALLBACK_STEAM_UGC_START_PLAYTIME_TRACKING_RESULT => {
            Ok(sys::StartPlaytimeTrackingResult_t_k_iCallback as i32)
        }
        CALLBACK_STEAM_UGC_STOP_PLAYTIME_TRACKING_RESULT => {
            Ok(sys::StopPlaytimeTrackingResult_t_k_iCallback as i32)
        }
        CALLBACK_STEAM_UGC_ADD_DEPENDENCY_RESULT => {
            Ok(sys::AddUGCDependencyResult_t_k_iCallback as i32)
        }
        CALLBACK_STEAM_UGC_REMOVE_DEPENDENCY_RESULT => {
            Ok(sys::RemoveUGCDependencyResult_t_k_iCallback as i32)
        }
        CALLBACK_STEAM_UGC_ADD_APP_DEPENDENCY_RESULT => {
            Ok(sys::AddAppDependencyResult_t_k_iCallback as i32)
        }
        CALLBACK_STEAM_UGC_REMOVE_APP_DEPENDENCY_RESULT => {
            Ok(sys::RemoveAppDependencyResult_t_k_iCallback as i32)
        }
        CALLBACK_STEAM_UGC_GET_APP_DEPENDENCIES_RESULT => {
            Ok(sys::GetAppDependenciesResult_t_k_iCallback as i32)
        }
        CALLBACK_STEAM_UGC_DELETE_ITEM_RESULT => Ok(sys::DeleteItemResult_t_k_iCallback as i32),
        CALLBACK_STEAM_UGC_USER_SUBSCRIBED_ITEMS_LIST_CHANGED => {
            Ok(sys::UserSubscribedItemsListChanged_t_k_iCallback as i32)
        }
        CALLBACK_STEAM_UGC_WORKSHOP_EULA_STATUS => Ok(sys::WorkshopEULAStatus_t_k_iCallback as i32),
        CALLBACK_HTTP_REQUEST_COMPLETED => Ok(sys::HTTPRequestCompleted_t_k_iCallback as i32),
        CALLBACK_HTTP_REQUEST_HEADERS_RECEIVED => {
            Ok(sys::HTTPRequestHeadersReceived_t_k_iCallback as i32)
        }
        CALLBACK_HTTP_REQUEST_DATA_RECEIVED => {
            Ok(sys::HTTPRequestDataReceived_t_k_iCallback as i32)
        }
        CALLBACK_SCREENSHOT_READY => Ok(sys::ScreenshotReady_t_k_iCallback as i32),
        CALLBACK_SCREENSHOT_REQUESTED => Ok(sys::ScreenshotRequested_t_k_iCallback as i32),
        CALLBACK_PLAYBACK_STATUS_HAS_CHANGED => {
            Ok(sys::PlaybackStatusHasChanged_t_k_iCallback as i32)
        }
        CALLBACK_VOLUME_HAS_CHANGED => Ok(sys::VolumeHasChanged_t_k_iCallback as i32),
        CALLBACK_HTML_BROWSER_READY => Ok(sys::HTML_BrowserReady_t_k_iCallback as i32),
        CALLBACK_HTML_NEEDS_PAINT => Ok(sys::HTML_NeedsPaint_t_k_iCallback as i32),
        CALLBACK_HTML_START_REQUEST => Ok(sys::HTML_StartRequest_t_k_iCallback as i32),
        CALLBACK_HTML_CLOSE_BROWSER => Ok(sys::HTML_CloseBrowser_t_k_iCallback as i32),
        CALLBACK_HTML_URL_CHANGED => Ok(sys::HTML_URLChanged_t_k_iCallback as i32),
        CALLBACK_HTML_FINISHED_REQUEST => Ok(sys::HTML_FinishedRequest_t_k_iCallback as i32),
        CALLBACK_HTML_OPEN_LINK_IN_NEW_TAB => Ok(sys::HTML_OpenLinkInNewTab_t_k_iCallback as i32),
        CALLBACK_HTML_CHANGED_TITLE => Ok(sys::HTML_ChangedTitle_t_k_iCallback as i32),
        CALLBACK_HTML_SEARCH_RESULTS => Ok(sys::HTML_SearchResults_t_k_iCallback as i32),
        CALLBACK_HTML_CAN_GO_BACK_AND_FORWARD => {
            Ok(sys::HTML_CanGoBackAndForward_t_k_iCallback as i32)
        }
        CALLBACK_HTML_HORIZONTAL_SCROLL => Ok(sys::HTML_HorizontalScroll_t_k_iCallback as i32),
        CALLBACK_HTML_VERTICAL_SCROLL => Ok(sys::HTML_VerticalScroll_t_k_iCallback as i32),
        CALLBACK_HTML_LINK_AT_POSITION => Ok(sys::HTML_LinkAtPosition_t_k_iCallback as i32),
        CALLBACK_HTML_JS_ALERT => Ok(sys::HTML_JSAlert_t_k_iCallback as i32),
        CALLBACK_HTML_JS_CONFIRM => Ok(sys::HTML_JSConfirm_t_k_iCallback as i32),
        CALLBACK_HTML_FILE_OPEN_DIALOG => Ok(sys::HTML_FileOpenDialog_t_k_iCallback as i32),
        CALLBACK_HTML_NEW_WINDOW => Ok(sys::HTML_NewWindow_t_k_iCallback as i32),
        CALLBACK_HTML_SET_CURSOR => Ok(sys::HTML_SetCursor_t_k_iCallback as i32),
        CALLBACK_HTML_STATUS_TEXT => Ok(sys::HTML_StatusText_t_k_iCallback as i32),
        CALLBACK_HTML_SHOW_TOOL_TIP => Ok(sys::HTML_ShowToolTip_t_k_iCallback as i32),
        CALLBACK_HTML_UPDATE_TOOL_TIP => Ok(sys::HTML_UpdateToolTip_t_k_iCallback as i32),
        CALLBACK_HTML_HIDE_TOOL_TIP => Ok(sys::HTML_HideToolTip_t_k_iCallback as i32),
        CALLBACK_HTML_BROWSER_RESTARTED => Ok(sys::HTML_BrowserRestarted_t_k_iCallback as i32),
        CALLBACK_BROADCAST_UPLOAD_START => Ok(sys::BroadcastUploadStart_t_k_iCallback as i32),
        CALLBACK_BROADCAST_UPLOAD_STOP => Ok(sys::BroadcastUploadStop_t_k_iCallback as i32),
        CALLBACK_GET_VIDEO_URL_RESULT => Ok(sys::GetVideoURLResult_t_k_iCallback as i32),
        CALLBACK_GET_OPF_SETTINGS_RESULT => Ok(sys::GetOPFSettingsResult_t_k_iCallback as i32),
        CALLBACK_STEAM_PARENTAL_SETTINGS_CHANGED => {
            Ok(sys::SteamParentalSettingsChanged_t_k_iCallback as i32)
        }
        CALLBACK_JOIN_PARTY => Ok(sys::JoinPartyCallback_t_k_iCallback as i32),
        CALLBACK_CREATE_BEACON => Ok(sys::CreateBeaconCallback_t_k_iCallback as i32),
        CALLBACK_RESERVATION_NOTIFICATION => {
            Ok(sys::ReservationNotificationCallback_t_k_iCallback as i32)
        }
        CALLBACK_CHANGE_NUM_OPEN_SLOTS => Ok(sys::ChangeNumOpenSlotsCallback_t_k_iCallback as i32),
        CALLBACK_STEAM_REMOTE_PLAY_SESSION_CONNECTED => {
            Ok(sys::SteamRemotePlaySessionConnected_t_k_iCallback as i32)
        }
        CALLBACK_STEAM_REMOTE_PLAY_SESSION_DISCONNECTED => {
            Ok(sys::SteamRemotePlaySessionDisconnected_t_k_iCallback as i32)
        }
        CALLBACK_STEAM_REMOTE_PLAY_TOGETHER_GUEST_INVITE => {
            Ok(sys::SteamRemotePlayTogetherGuestInvite_t_k_iCallback as i32)
        }
        CALLBACK_STEAM_REMOTE_PLAY_SESSION_AVATAR_LOADED => {
            Ok(sys::SteamRemotePlaySessionAvatarLoaded_t_k_iCallback as i32)
        }
        CALLBACK_STEAM_TIMELINE_GAME_PHASE_RECORDING_EXISTS => {
            Ok(sys::SteamTimelineGamePhaseRecordingExists_t_k_iCallback as i32)
        }
        CALLBACK_STEAM_TIMELINE_EVENT_RECORDING_EXISTS => {
            Ok(sys::SteamTimelineEventRecordingExists_t_k_iCallback as i32)
        }
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
        CALLBACK_ENCRYPTED_APP_TICKET_RESPONSE => {
            let event = param as *const sys::EncryptedAppTicketResponse_t;
            serde_json::json!({
                "result": ptr::addr_of!((*event).m_eResult).read_unaligned() as u32
            })
        }
        CALLBACK_GET_AUTH_SESSION_TICKET_RESPONSE => {
            let event = param as *const sys::GetAuthSessionTicketResponse_t;
            serde_json::json!({
                "auth_ticket": ptr::addr_of!((*event).m_hAuthTicket).read_unaligned(),
                "result": ptr::addr_of!((*event).m_eResult).read_unaligned() as u32
            })
        }
        CALLBACK_STORE_AUTH_URL_RESPONSE => {
            let event = param as *const sys::StoreAuthURLResponse_t;
            serde_json::json!({
                "url": c_buf_to_string(&*ptr::addr_of!((*event).m_szURL))
            })
        }
        CALLBACK_MARKET_ELIGIBILITY_RESPONSE => {
            let event = param as *const sys::MarketEligibilityResponse_t;
            serde_json::json!({
                "allowed": ptr::addr_of!((*event).m_bAllowed).read_unaligned(),
                "not_allowed_reason": ptr::addr_of!((*event).m_eNotAllowedReason).read_unaligned().0,
                "allowed_at_time": ptr::addr_of!((*event).m_rtAllowedAtTime).read_unaligned(),
                "steam_guard_required_days": ptr::addr_of!((*event).m_cdaySteamGuardRequiredDays).read_unaligned(),
                "new_device_cooldown_days": ptr::addr_of!((*event).m_cdayNewDeviceCooldown).read_unaligned()
            })
        }
        CALLBACK_DURATION_CONTROL => {
            let event = param as *const sys::DurationControl_t;
            serde_json::json!({
                "result": ptr::addr_of!((*event).m_eResult).read_unaligned() as u32,
                "app_id": ptr::addr_of!((*event).m_appid).read_unaligned(),
                "applicable": ptr::addr_of!((*event).m_bApplicable).read_unaligned(),
                "seconds_last_5h": ptr::addr_of!((*event).m_csecsLast5h).read_unaligned(),
                "progress": ptr::addr_of!((*event).m_progress).read_unaligned() as u32,
                "notification": ptr::addr_of!((*event).m_notification).read_unaligned() as u32,
                "seconds_today": ptr::addr_of!((*event).m_csecsToday).read_unaligned(),
                "seconds_remaining": ptr::addr_of!((*event).m_csecsRemaining).read_unaligned()
            })
        }
        CALLBACK_IP_COUNTRY
        | CALLBACK_STEAM_SHUTDOWN
        | CALLBACK_APP_RESUMING_FROM_SUSPEND
        | CALLBACK_FLOATING_GAMEPAD_TEXT_INPUT_DISMISSED
        | CALLBACK_NEW_URL_LAUNCH_PARAMETERS => serde_json::json!({}),
        CALLBACK_LOW_BATTERY_POWER => {
            let event = param as *const sys::LowBatteryPower_t;
            serde_json::json!({
                "minutes_battery_left": ptr::addr_of!((*event).m_nMinutesBatteryLeft).read_unaligned()
            })
        }
        CALLBACK_STEAM_API_CALL_COMPLETED => {
            let event = param as *const sys::SteamAPICallCompleted_t;
            serde_json::json!({
                "async_call": ptr::addr_of!((*event).m_hAsyncCall).read_unaligned().to_string(),
                "callback": ptr::addr_of!((*event).m_iCallback).read_unaligned(),
                "parameter_size": ptr::addr_of!((*event).m_cubParam).read_unaligned()
            })
        }
        CALLBACK_CHECK_FILE_SIGNATURE => {
            let event = param as *const sys::CheckFileSignature_t;
            serde_json::json!({
                "check_file_signature": ptr::addr_of!((*event).m_eCheckFileSignature).read_unaligned() as u32
            })
        }
        CALLBACK_GAMEPAD_TEXT_INPUT_DISMISSED => {
            let event = param as *const sys::GamepadTextInputDismissed_t;
            serde_json::json!({
                "submitted": ptr::addr_of!((*event).m_bSubmitted).read_unaligned(),
                "submitted_text": ptr::addr_of!((*event).m_unSubmittedText).read_unaligned(),
                "app_id": ptr::addr_of!((*event).m_unAppID).read_unaligned()
            })
        }
        CALLBACK_FILTER_TEXT_DICTIONARY_CHANGED => {
            let event = param as *const sys::FilterTextDictionaryChanged_t;
            serde_json::json!({
                "language": ptr::addr_of!((*event).m_eLanguage).read_unaligned()
            })
        }
        CALLBACK_DLC_INSTALLED => {
            let event = param as *const sys::DlcInstalled_t;
            serde_json::json!({
                "app_id": ptr::addr_of!((*event).m_nAppID).read_unaligned()
            })
        }
        CALLBACK_APP_PROOF_OF_PURCHASE_KEY_RESPONSE => {
            let event = param as *const sys::AppProofOfPurchaseKeyResponse_t;
            serde_json::json!({
                "result": ptr::addr_of!((*event).m_eResult).read_unaligned() as u32,
                "app_id": ptr::addr_of!((*event).m_nAppID).read_unaligned(),
                "key_length": ptr::addr_of!((*event).m_cchKeyLength).read_unaligned(),
                "key": c_buf_to_string(&*ptr::addr_of!((*event).m_rgchKey))
            })
        }
        CALLBACK_FILE_DETAILS_RESULT => {
            let event = param as *const sys::FileDetailsResult_t;
            let sha = ptr::addr_of!((*event).m_FileSHA).read_unaligned();
            serde_json::json!({
                "result": ptr::addr_of!((*event).m_eResult).read_unaligned() as u32,
                "file_size": ptr::addr_of!((*event).m_ulFileSize).read_unaligned().to_string(),
                "sha_hex": bytes_to_hex(&sha),
                "flags": ptr::addr_of!((*event).m_unFlags).read_unaligned()
            })
        }
        CALLBACK_REMOTE_STORAGE_FILE_SHARE_RESULT => {
            let event = param as *const sys::RemoteStorageFileShareResult_t;
            let filename = ptr::addr_of!((*event).m_rgchFilename).read_unaligned();
            serde_json::json!({
                "result": ptr::addr_of!((*event).m_eResult).read_unaligned() as u32,
                "file": ptr::addr_of!((*event).m_hFile).read_unaligned().to_string(),
                "name": c_buf_to_string(&filename)
            })
        }
        CALLBACK_REMOTE_STORAGE_PUBLISH_FILE_RESULT => {
            let event = param as *const sys::RemoteStoragePublishFileResult_t;
            serde_json::json!({
                "result": ptr::addr_of!((*event).m_eResult).read_unaligned() as u32,
                "published_file_id": ptr::addr_of!((*event).m_nPublishedFileId).read_unaligned().to_string(),
                "needs_to_accept_agreement": ptr::addr_of!((*event).m_bUserNeedsToAcceptWorkshopLegalAgreement).read_unaligned()
            })
        }
        CALLBACK_REMOTE_STORAGE_DELETE_PUBLISHED_FILE_RESULT => {
            let event = param as *const sys::RemoteStorageDeletePublishedFileResult_t;
            serde_json::json!({
                "result": ptr::addr_of!((*event).m_eResult).read_unaligned() as u32,
                "published_file_id": ptr::addr_of!((*event).m_nPublishedFileId).read_unaligned().to_string()
            })
        }
        CALLBACK_REMOTE_STORAGE_ENUMERATE_USER_PUBLISHED_FILES_RESULT => {
            let event = param as *const sys::RemoteStorageEnumerateUserPublishedFilesResult_t;
            let returned = ptr::addr_of!((*event).m_nResultsReturned).read_unaligned();
            let ids = ptr::addr_of!((*event).m_rgPublishedFileId).read_unaligned();
            serde_json::json!({
                "result": ptr::addr_of!((*event).m_eResult).read_unaligned() as u32,
                "returned_results": returned,
                "total_result_count": ptr::addr_of!((*event).m_nTotalResultCount).read_unaligned(),
                "published_file_ids": published_id_strings(ids, returned)
            })
        }
        CALLBACK_REMOTE_STORAGE_SUBSCRIBE_PUBLISHED_FILE_RESULT => {
            let event = param as *const sys::RemoteStorageSubscribePublishedFileResult_t;
            serde_json::json!({
                "result": ptr::addr_of!((*event).m_eResult).read_unaligned() as u32,
                "published_file_id": ptr::addr_of!((*event).m_nPublishedFileId).read_unaligned().to_string()
            })
        }
        CALLBACK_REMOTE_STORAGE_ENUMERATE_USER_SUBSCRIBED_FILES_RESULT => {
            let event = param as *const sys::RemoteStorageEnumerateUserSubscribedFilesResult_t;
            let returned = ptr::addr_of!((*event).m_nResultsReturned).read_unaligned();
            let ids = ptr::addr_of!((*event).m_rgPublishedFileId).read_unaligned();
            let times = ptr::addr_of!((*event).m_rgRTimeSubscribed).read_unaligned();
            serde_json::json!({
                "result": ptr::addr_of!((*event).m_eResult).read_unaligned() as u32,
                "returned_results": returned,
                "total_result_count": ptr::addr_of!((*event).m_nTotalResultCount).read_unaligned(),
                "published_file_ids": published_id_strings(ids, returned),
                "subscribed_times": times.into_iter().take(remote_storage_result_count(returned)).collect::<Vec<_>>()
            })
        }
        CALLBACK_REMOTE_STORAGE_UNSUBSCRIBE_PUBLISHED_FILE_RESULT => {
            let event = param as *const sys::RemoteStorageUnsubscribePublishedFileResult_t;
            serde_json::json!({
                "result": ptr::addr_of!((*event).m_eResult).read_unaligned() as u32,
                "published_file_id": ptr::addr_of!((*event).m_nPublishedFileId).read_unaligned().to_string()
            })
        }
        CALLBACK_REMOTE_STORAGE_UPDATE_PUBLISHED_FILE_RESULT => {
            let event = param as *const sys::RemoteStorageUpdatePublishedFileResult_t;
            serde_json::json!({
                "result": ptr::addr_of!((*event).m_eResult).read_unaligned() as u32,
                "published_file_id": ptr::addr_of!((*event).m_nPublishedFileId).read_unaligned().to_string(),
                "needs_to_accept_agreement": ptr::addr_of!((*event).m_bUserNeedsToAcceptWorkshopLegalAgreement).read_unaligned()
            })
        }
        CALLBACK_REMOTE_STORAGE_DOWNLOAD_UGC_RESULT => {
            let event = param as *const sys::RemoteStorageDownloadUGCResult_t;
            let filename = ptr::addr_of!((*event).m_pchFileName).read_unaligned();
            serde_json::json!({
                "result": ptr::addr_of!((*event).m_eResult).read_unaligned() as u32,
                "file": ptr::addr_of!((*event).m_hFile).read_unaligned().to_string(),
                "app_id": ptr::addr_of!((*event).m_nAppID).read_unaligned(),
                "size": ptr::addr_of!((*event).m_nSizeInBytes).read_unaligned().max(0).to_string(),
                "name": c_buf_to_string(&filename),
                "owner": ptr::addr_of!((*event).m_ulSteamIDOwner).read_unaligned().to_string()
            })
        }
        CALLBACK_REMOTE_STORAGE_GET_PUBLISHED_FILE_DETAILS_RESULT => {
            let event = param as *const sys::RemoteStorageGetPublishedFileDetailsResult_t;
            let title = ptr::addr_of!((*event).m_rgchTitle).read_unaligned();
            let description = ptr::addr_of!((*event).m_rgchDescription).read_unaligned();
            let tags = ptr::addr_of!((*event).m_rgchTags).read_unaligned();
            let file_name = ptr::addr_of!((*event).m_pchFileName).read_unaligned();
            let url = ptr::addr_of!((*event).m_rgchURL).read_unaligned();
            serde_json::json!({
                "result": ptr::addr_of!((*event).m_eResult).read_unaligned() as u32,
                "published_file_id": ptr::addr_of!((*event).m_nPublishedFileId).read_unaligned().to_string(),
                "creator_app_id": ptr::addr_of!((*event).m_nCreatorAppID).read_unaligned(),
                "consumer_app_id": ptr::addr_of!((*event).m_nConsumerAppID).read_unaligned(),
                "title": c_buf_to_string(&title),
                "description": c_buf_to_string(&description),
                "file": ptr::addr_of!((*event).m_hFile).read_unaligned().to_string(),
                "preview_file": ptr::addr_of!((*event).m_hPreviewFile).read_unaligned().to_string(),
                "owner": ptr::addr_of!((*event).m_ulSteamIDOwner).read_unaligned().to_string(),
                "time_created": ptr::addr_of!((*event).m_rtimeCreated).read_unaligned(),
                "time_updated": ptr::addr_of!((*event).m_rtimeUpdated).read_unaligned(),
                "visibility": ptr::addr_of!((*event).m_eVisibility).read_unaligned() as u32,
                "banned": ptr::addr_of!((*event).m_bBanned).read_unaligned(),
                "tags": c_buf_to_string(&tags),
                "tags_truncated": ptr::addr_of!((*event).m_bTagsTruncated).read_unaligned(),
                "file_name": c_buf_to_string(&file_name),
                "file_size": ptr::addr_of!((*event).m_nFileSize).read_unaligned().max(0).to_string(),
                "preview_file_size": ptr::addr_of!((*event).m_nPreviewFileSize).read_unaligned().max(0).to_string(),
                "url": c_buf_to_string(&url),
                "file_type": ptr::addr_of!((*event).m_eFileType).read_unaligned() as u32,
                "accepted_for_use": ptr::addr_of!((*event).m_bAcceptedForUse).read_unaligned()
            })
        }
        CALLBACK_REMOTE_STORAGE_ENUMERATE_WORKSHOP_FILES_RESULT => {
            let event = param as *const sys::RemoteStorageEnumerateWorkshopFilesResult_t;
            let returned = ptr::addr_of!((*event).m_nResultsReturned).read_unaligned();
            let ids = ptr::addr_of!((*event).m_rgPublishedFileId).read_unaligned();
            let scores = ptr::addr_of!((*event).m_rgScore).read_unaligned();
            serde_json::json!({
                "result": ptr::addr_of!((*event).m_eResult).read_unaligned() as u32,
                "returned_results": returned,
                "total_result_count": ptr::addr_of!((*event).m_nTotalResultCount).read_unaligned(),
                "published_file_ids": published_id_strings(ids, returned),
                "scores": scores.into_iter().take(remote_storage_result_count(returned)).map(f64::from).collect::<Vec<_>>(),
                "app_id": ptr::addr_of!((*event).m_nAppId).read_unaligned(),
                "start_index": ptr::addr_of!((*event).m_unStartIndex).read_unaligned()
            })
        }
        CALLBACK_REMOTE_STORAGE_GET_PUBLISHED_ITEM_VOTE_DETAILS_RESULT => {
            let event = param as *const sys::RemoteStorageGetPublishedItemVoteDetailsResult_t;
            serde_json::json!({
                "result": ptr::addr_of!((*event).m_eResult).read_unaligned() as u32,
                "published_file_id": ptr::addr_of!((*event).m_unPublishedFileId).read_unaligned().to_string(),
                "votes_for": ptr::addr_of!((*event).m_nVotesFor).read_unaligned(),
                "votes_against": ptr::addr_of!((*event).m_nVotesAgainst).read_unaligned(),
                "reports": ptr::addr_of!((*event).m_nReports).read_unaligned(),
                "score": ptr::addr_of!((*event).m_fScore).read_unaligned()
            })
        }
        CALLBACK_REMOTE_STORAGE_PUBLISHED_FILE_SUBSCRIBED => {
            let event = param as *const sys::RemoteStoragePublishedFileSubscribed_t;
            serde_json::json!({
                "published_file_id": ptr::addr_of!((*event).m_nPublishedFileId).read_unaligned().to_string(),
                "app_id": ptr::addr_of!((*event).m_nAppID).read_unaligned()
            })
        }
        CALLBACK_REMOTE_STORAGE_PUBLISHED_FILE_UNSUBSCRIBED => {
            let event = param as *const sys::RemoteStoragePublishedFileUnsubscribed_t;
            serde_json::json!({
                "published_file_id": ptr::addr_of!((*event).m_nPublishedFileId).read_unaligned().to_string(),
                "app_id": ptr::addr_of!((*event).m_nAppID).read_unaligned()
            })
        }
        CALLBACK_REMOTE_STORAGE_PUBLISHED_FILE_DELETED => {
            let event = param as *const sys::RemoteStoragePublishedFileDeleted_t;
            serde_json::json!({
                "published_file_id": ptr::addr_of!((*event).m_nPublishedFileId).read_unaligned().to_string(),
                "app_id": ptr::addr_of!((*event).m_nAppID).read_unaligned()
            })
        }
        CALLBACK_REMOTE_STORAGE_UPDATE_USER_PUBLISHED_ITEM_VOTE_RESULT => {
            let event = param as *const sys::RemoteStorageUpdateUserPublishedItemVoteResult_t;
            serde_json::json!({
                "result": ptr::addr_of!((*event).m_eResult).read_unaligned() as u32,
                "published_file_id": ptr::addr_of!((*event).m_nPublishedFileId).read_unaligned().to_string()
            })
        }
        CALLBACK_REMOTE_STORAGE_USER_VOTE_DETAILS => {
            let event = param as *const sys::RemoteStorageUserVoteDetails_t;
            serde_json::json!({
                "result": ptr::addr_of!((*event).m_eResult).read_unaligned() as u32,
                "published_file_id": ptr::addr_of!((*event).m_nPublishedFileId).read_unaligned().to_string(),
                "vote": ptr::addr_of!((*event).m_eVote).read_unaligned() as u32
            })
        }
        CALLBACK_REMOTE_STORAGE_ENUMERATE_USER_SHARED_WORKSHOP_FILES_RESULT => {
            let event = param as *const sys::RemoteStorageEnumerateUserSharedWorkshopFilesResult_t;
            let returned = ptr::addr_of!((*event).m_nResultsReturned).read_unaligned();
            let ids = ptr::addr_of!((*event).m_rgPublishedFileId).read_unaligned();
            serde_json::json!({
                "result": ptr::addr_of!((*event).m_eResult).read_unaligned() as u32,
                "returned_results": returned,
                "total_result_count": ptr::addr_of!((*event).m_nTotalResultCount).read_unaligned(),
                "published_file_ids": published_id_strings(ids, returned)
            })
        }
        CALLBACK_REMOTE_STORAGE_SET_USER_PUBLISHED_FILE_ACTION_RESULT => {
            let event = param as *const sys::RemoteStorageSetUserPublishedFileActionResult_t;
            serde_json::json!({
                "result": ptr::addr_of!((*event).m_eResult).read_unaligned() as u32,
                "published_file_id": ptr::addr_of!((*event).m_nPublishedFileId).read_unaligned().to_string(),
                "action": ptr::addr_of!((*event).m_eAction).read_unaligned() as u32
            })
        }
        CALLBACK_REMOTE_STORAGE_ENUMERATE_PUBLISHED_FILES_BY_USER_ACTION_RESULT => {
            let event =
                param as *const sys::RemoteStorageEnumeratePublishedFilesByUserActionResult_t;
            let returned = ptr::addr_of!((*event).m_nResultsReturned).read_unaligned();
            let ids = ptr::addr_of!((*event).m_rgPublishedFileId).read_unaligned();
            let times = ptr::addr_of!((*event).m_rgRTimeUpdated).read_unaligned();
            serde_json::json!({
                "result": ptr::addr_of!((*event).m_eResult).read_unaligned() as u32,
                "action": ptr::addr_of!((*event).m_eAction).read_unaligned() as u32,
                "returned_results": returned,
                "total_result_count": ptr::addr_of!((*event).m_nTotalResultCount).read_unaligned(),
                "published_file_ids": published_id_strings(ids, returned),
                "updated_times": times.into_iter().take(remote_storage_result_count(returned)).collect::<Vec<_>>()
            })
        }
        CALLBACK_REMOTE_STORAGE_PUBLISH_FILE_PROGRESS => {
            let event = param as *const sys::RemoteStoragePublishFileProgress_t;
            serde_json::json!({
                "percent_file": ptr::addr_of!((*event).m_dPercentFile).read_unaligned(),
                "preview": ptr::addr_of!((*event).m_bPreview).read_unaligned()
            })
        }
        CALLBACK_REMOTE_STORAGE_PUBLISHED_FILE_UPDATED => {
            let event = param as *const sys::RemoteStoragePublishedFileUpdated_t;
            serde_json::json!({
                "published_file_id": ptr::addr_of!((*event).m_nPublishedFileId).read_unaligned().to_string(),
                "app_id": ptr::addr_of!((*event).m_nAppID).read_unaligned(),
                "unused": ptr::addr_of!((*event).m_ulUnused).read_unaligned().to_string()
            })
        }
        CALLBACK_REMOTE_STORAGE_FILE_WRITE_ASYNC_COMPLETE => {
            let event = param as *const sys::RemoteStorageFileWriteAsyncComplete_t;
            serde_json::json!({
                "result": ptr::addr_of!((*event).m_eResult).read_unaligned() as u32
            })
        }
        CALLBACK_REMOTE_STORAGE_FILE_READ_ASYNC_COMPLETE => {
            let event = param as *const sys::RemoteStorageFileReadAsyncComplete_t;
            serde_json::json!({
                "async_call": ptr::addr_of!((*event).m_hFileReadAsync).read_unaligned().to_string(),
                "result": ptr::addr_of!((*event).m_eResult).read_unaligned() as u32,
                "offset": ptr::addr_of!((*event).m_nOffset).read_unaligned(),
                "bytes_read": ptr::addr_of!((*event).m_cubRead).read_unaligned()
            })
        }
        CALLBACK_STEAM_UGC_QUERY_COMPLETED => {
            let event = param as *const sys::SteamUGCQueryCompleted_t;
            let next_cursor = ptr::addr_of!((*event).m_rgchNextCursor).read_unaligned();
            serde_json::json!({
                "handle": ptr::addr_of!((*event).m_handle).read_unaligned().to_string(),
                "result": ptr::addr_of!((*event).m_eResult).read_unaligned() as u32,
                "returned_results": ptr::addr_of!((*event).m_unNumResultsReturned).read_unaligned(),
                "total_results": ptr::addr_of!((*event).m_unTotalMatchingResults).read_unaligned(),
                "was_cached": ptr::addr_of!((*event).m_bCachedData).read_unaligned(),
                "next_cursor": c_buf_to_string(&next_cursor)
            })
        }
        CALLBACK_STEAM_UGC_REQUEST_DETAILS_RESULT => {
            let event = param as *const sys::SteamUGCRequestUGCDetailsResult_t;
            serde_json::json!({
                "details": ugc_details_json(&(*event).m_details),
                "was_cached": ptr::addr_of!((*event).m_bCachedData).read_unaligned()
            })
        }
        CALLBACK_STEAM_UGC_CREATE_ITEM_RESULT => {
            let event = param as *const sys::CreateItemResult_t;
            serde_json::json!({
                "result": ptr::addr_of!((*event).m_eResult).read_unaligned() as u32,
                "item_id": ptr::addr_of!((*event).m_nPublishedFileId).read_unaligned().to_string(),
                "needs_to_accept_agreement": ptr::addr_of!((*event).m_bUserNeedsToAcceptWorkshopLegalAgreement).read_unaligned()
            })
        }
        CALLBACK_STEAM_UGC_SUBMIT_ITEM_UPDATE_RESULT => {
            let event = param as *const sys::SubmitItemUpdateResult_t;
            serde_json::json!({
                "result": ptr::addr_of!((*event).m_eResult).read_unaligned() as u32,
                "needs_to_accept_agreement": ptr::addr_of!((*event).m_bUserNeedsToAcceptWorkshopLegalAgreement).read_unaligned(),
                "item_id": ptr::addr_of!((*event).m_nPublishedFileId).read_unaligned().to_string()
            })
        }
        CALLBACK_STEAM_UGC_ITEM_INSTALLED => {
            let event = param as *const sys::ItemInstalled_t;
            serde_json::json!({
                "app_id": ptr::addr_of!((*event).m_unAppID).read_unaligned(),
                "item_id": ptr::addr_of!((*event).m_nPublishedFileId).read_unaligned().to_string(),
                "legacy_content": ptr::addr_of!((*event).m_hLegacyContent).read_unaligned().to_string(),
                "manifest_id": ptr::addr_of!((*event).m_unManifestID).read_unaligned().to_string()
            })
        }
        CALLBACK_STEAM_UGC_DOWNLOAD_ITEM_RESULT => {
            let event = param as *const sys::DownloadItemResult_t;
            serde_json::json!({
                "app_id": ptr::addr_of!((*event).m_unAppID).read_unaligned(),
                "item_id": ptr::addr_of!((*event).m_nPublishedFileId).read_unaligned().to_string(),
                "result": ptr::addr_of!((*event).m_eResult).read_unaligned() as u32
            })
        }
        CALLBACK_STEAM_UGC_USER_FAVORITE_ITEMS_LIST_CHANGED => {
            let event = param as *const sys::UserFavoriteItemsListChanged_t;
            serde_json::json!({
                "item_id": ptr::addr_of!((*event).m_nPublishedFileId).read_unaligned().to_string(),
                "result": ptr::addr_of!((*event).m_eResult).read_unaligned() as u32,
                "was_add_request": ptr::addr_of!((*event).m_bWasAddRequest).read_unaligned()
            })
        }
        CALLBACK_STEAM_UGC_SET_USER_ITEM_VOTE_RESULT => {
            let event = param as *const sys::SetUserItemVoteResult_t;
            serde_json::json!({
                "item_id": ptr::addr_of!((*event).m_nPublishedFileId).read_unaligned().to_string(),
                "result": ptr::addr_of!((*event).m_eResult).read_unaligned() as u32,
                "vote_up": ptr::addr_of!((*event).m_bVoteUp).read_unaligned()
            })
        }
        CALLBACK_STEAM_UGC_GET_USER_ITEM_VOTE_RESULT => {
            let event = param as *const sys::GetUserItemVoteResult_t;
            serde_json::json!({
                "item_id": ptr::addr_of!((*event).m_nPublishedFileId).read_unaligned().to_string(),
                "result": ptr::addr_of!((*event).m_eResult).read_unaligned() as u32,
                "voted_up": ptr::addr_of!((*event).m_bVotedUp).read_unaligned(),
                "voted_down": ptr::addr_of!((*event).m_bVotedDown).read_unaligned(),
                "vote_skipped": ptr::addr_of!((*event).m_bVoteSkipped).read_unaligned()
            })
        }
        CALLBACK_STEAM_UGC_START_PLAYTIME_TRACKING_RESULT => {
            let event = param as *const sys::StartPlaytimeTrackingResult_t;
            serde_json::json!({
                "result": ptr::addr_of!((*event).m_eResult).read_unaligned() as u32
            })
        }
        CALLBACK_STEAM_UGC_STOP_PLAYTIME_TRACKING_RESULT => {
            let event = param as *const sys::StopPlaytimeTrackingResult_t;
            serde_json::json!({
                "result": ptr::addr_of!((*event).m_eResult).read_unaligned() as u32
            })
        }
        CALLBACK_STEAM_UGC_ADD_DEPENDENCY_RESULT => {
            let event = param as *const sys::AddUGCDependencyResult_t;
            serde_json::json!({
                "result": ptr::addr_of!((*event).m_eResult).read_unaligned() as u32,
                "item_id": ptr::addr_of!((*event).m_nPublishedFileId).read_unaligned().to_string(),
                "child_item_id": ptr::addr_of!((*event).m_nChildPublishedFileId).read_unaligned().to_string()
            })
        }
        CALLBACK_STEAM_UGC_REMOVE_DEPENDENCY_RESULT => {
            let event = param as *const sys::RemoveUGCDependencyResult_t;
            serde_json::json!({
                "result": ptr::addr_of!((*event).m_eResult).read_unaligned() as u32,
                "item_id": ptr::addr_of!((*event).m_nPublishedFileId).read_unaligned().to_string(),
                "child_item_id": ptr::addr_of!((*event).m_nChildPublishedFileId).read_unaligned().to_string()
            })
        }
        CALLBACK_STEAM_UGC_ADD_APP_DEPENDENCY_RESULT => {
            let event = param as *const sys::AddAppDependencyResult_t;
            serde_json::json!({
                "result": ptr::addr_of!((*event).m_eResult).read_unaligned() as u32,
                "item_id": ptr::addr_of!((*event).m_nPublishedFileId).read_unaligned().to_string(),
                "app_id": ptr::addr_of!((*event).m_nAppID).read_unaligned()
            })
        }
        CALLBACK_STEAM_UGC_REMOVE_APP_DEPENDENCY_RESULT => {
            let event = param as *const sys::RemoveAppDependencyResult_t;
            serde_json::json!({
                "result": ptr::addr_of!((*event).m_eResult).read_unaligned() as u32,
                "item_id": ptr::addr_of!((*event).m_nPublishedFileId).read_unaligned().to_string(),
                "app_id": ptr::addr_of!((*event).m_nAppID).read_unaligned()
            })
        }
        CALLBACK_STEAM_UGC_GET_APP_DEPENDENCIES_RESULT => {
            let event = param as *const sys::GetAppDependenciesResult_t;
            let count = ptr::addr_of!((*event).m_nNumAppDependencies).read_unaligned();
            let app_ids = ptr::addr_of!((*event).m_rgAppIDs).read_unaligned();
            serde_json::json!({
                "result": ptr::addr_of!((*event).m_eResult).read_unaligned() as u32,
                "item_id": ptr::addr_of!((*event).m_nPublishedFileId).read_unaligned().to_string(),
                "app_ids": app_ids.into_iter().take((count as usize).min(app_ids.len())).collect::<Vec<_>>(),
                "num_app_dependencies": count,
                "total_num_app_dependencies": ptr::addr_of!((*event).m_nTotalNumAppDependencies).read_unaligned()
            })
        }
        CALLBACK_STEAM_UGC_DELETE_ITEM_RESULT => {
            let event = param as *const sys::DeleteItemResult_t;
            serde_json::json!({
                "result": ptr::addr_of!((*event).m_eResult).read_unaligned() as u32,
                "item_id": ptr::addr_of!((*event).m_nPublishedFileId).read_unaligned().to_string()
            })
        }
        CALLBACK_STEAM_UGC_USER_SUBSCRIBED_ITEMS_LIST_CHANGED => {
            let event = param as *const sys::UserSubscribedItemsListChanged_t;
            serde_json::json!({
                "app_id": ptr::addr_of!((*event).m_nAppID).read_unaligned()
            })
        }
        CALLBACK_STEAM_UGC_WORKSHOP_EULA_STATUS => {
            let event = param as *const sys::WorkshopEULAStatus_t;
            serde_json::json!({
                "result": ptr::addr_of!((*event).m_eResult).read_unaligned() as u32,
                "app_id": ptr::addr_of!((*event).m_nAppID).read_unaligned(),
                "version": ptr::addr_of!((*event).m_unVersion).read_unaligned(),
                "action_time": ptr::addr_of!((*event).m_rtAction).read_unaligned(),
                "accepted": ptr::addr_of!((*event).m_bAccepted).read_unaligned(),
                "needs_action": ptr::addr_of!((*event).m_bNeedsAction).read_unaligned()
            })
        }
        CALLBACK_TIMED_TRIAL_STATUS => {
            let event = param as *const sys::TimedTrialStatus_t;
            serde_json::json!({
                "app_id": ptr::addr_of!((*event).m_unAppID).read_unaligned(),
                "is_offline": ptr::addr_of!((*event).m_bIsOffline).read_unaligned(),
                "seconds_allowed": ptr::addr_of!((*event).m_unSecondsAllowed).read_unaligned(),
                "seconds_played": ptr::addr_of!((*event).m_unSecondsPlayed).read_unaligned()
            })
        }
        CALLBACK_FAVORITES_LIST_CHANGED => {
            let event = param as *const sys::FavoritesListChanged_t;
            serde_json::json!({
                "ip": ptr::addr_of!((*event).m_nIP).read_unaligned(),
                "ip_address": ipv4_to_string(ptr::addr_of!((*event).m_nIP).read_unaligned()),
                "query_port": ptr::addr_of!((*event).m_nQueryPort).read_unaligned(),
                "conn_port": ptr::addr_of!((*event).m_nConnPort).read_unaligned(),
                "app_id": ptr::addr_of!((*event).m_nAppID).read_unaligned(),
                "flags": ptr::addr_of!((*event).m_nFlags).read_unaligned(),
                "add": ptr::addr_of!((*event).m_bAdd).read_unaligned(),
                "account_id": ptr::addr_of!((*event).m_unAccountId).read_unaligned()
            })
        }
        CALLBACK_LOBBY_INVITE => {
            let event = param as *const sys::LobbyInvite_t;
            serde_json::json!({
                "user": ptr::addr_of!((*event).m_ulSteamIDUser).read_unaligned().to_string(),
                "lobby": ptr::addr_of!((*event).m_ulSteamIDLobby).read_unaligned().to_string(),
                "game_id": ptr::addr_of!((*event).m_ulGameID).read_unaligned().to_string()
            })
        }
        CALLBACK_LOBBY_ENTER => {
            let event = param as *const sys::LobbyEnter_t;
            serde_json::json!({
                "lobby": ptr::addr_of!((*event).m_ulSteamIDLobby).read_unaligned().to_string(),
                "chat_permissions": ptr::addr_of!((*event).m_rgfChatPermissions).read_unaligned(),
                "locked": ptr::addr_of!((*event).m_bLocked).read_unaligned(),
                "chat_room_enter_response": ptr::addr_of!((*event).m_EChatRoomEnterResponse).read_unaligned()
            })
        }
        4 | CALLBACK_LOBBY_DATA_UPDATE => {
            let event = param as *const sys::LobbyDataUpdate_t;
            serde_json::json!({
                "lobby": ptr::addr_of!((*event).m_ulSteamIDLobby).read_unaligned().to_string(),
                "member": ptr::addr_of!((*event).m_ulSteamIDMember).read_unaligned().to_string(),
                "success": ptr::addr_of!((*event).m_bSuccess).read_unaligned()
            })
        }
        5 | CALLBACK_LOBBY_CHAT_UPDATE => {
            let event = param as *const sys::LobbyChatUpdate_t;
            serde_json::json!({
                "lobby": ptr::addr_of!((*event).m_ulSteamIDLobby).read_unaligned().to_string(),
                "user_changed": ptr::addr_of!((*event).m_ulSteamIDUserChanged).read_unaligned().to_string(),
                "making_change": ptr::addr_of!((*event).m_ulSteamIDMakingChange).read_unaligned().to_string(),
                "member_state_change": ptr::addr_of!((*event).m_rgfChatMemberStateChange).read_unaligned()
            })
        }
        CALLBACK_LOBBY_CHAT_MSG => {
            let event = param as *const sys::LobbyChatMsg_t;
            serde_json::json!({
                "lobby": ptr::addr_of!((*event).m_ulSteamIDLobby).read_unaligned().to_string(),
                "user": ptr::addr_of!((*event).m_ulSteamIDUser).read_unaligned().to_string(),
                "entry_type": ptr::addr_of!((*event).m_eChatEntryType).read_unaligned(),
                "chat_id": ptr::addr_of!((*event).m_iChatID).read_unaligned()
            })
        }
        CALLBACK_LOBBY_GAME_CREATED => {
            let event = param as *const sys::LobbyGameCreated_t;
            let ip = ptr::addr_of!((*event).m_unIP).read_unaligned();
            serde_json::json!({
                "lobby": ptr::addr_of!((*event).m_ulSteamIDLobby).read_unaligned().to_string(),
                "game_server": ptr::addr_of!((*event).m_ulSteamIDGameServer).read_unaligned().to_string(),
                "ip": ip,
                "ip_address": ipv4_to_string(ip),
                "port": ptr::addr_of!((*event).m_usPort).read_unaligned()
            })
        }
        CALLBACK_LOBBY_MATCH_LIST => {
            let event = param as *const sys::LobbyMatchList_t;
            serde_json::json!({
                "lobbies_matching": ptr::addr_of!((*event).m_nLobbiesMatching).read_unaligned()
            })
        }
        CALLBACK_LOBBY_KICKED => {
            let event = param as *const sys::LobbyKicked_t;
            serde_json::json!({
                "lobby": ptr::addr_of!((*event).m_ulSteamIDLobby).read_unaligned().to_string(),
                "admin": ptr::addr_of!((*event).m_ulSteamIDAdmin).read_unaligned().to_string(),
                "kicked_due_to_disconnect": ptr::addr_of!((*event).m_bKickedDueToDisconnect).read_unaligned() != 0
            })
        }
        CALLBACK_GAME_SERVER_CHANGE_REQUESTED => {
            let event = param as *const sys::GameServerChangeRequested_t;
            serde_json::json!({
                "server": c_buf_to_string(&*ptr::addr_of!((*event).m_rgchServer)),
                "password": c_buf_to_string(&*ptr::addr_of!((*event).m_rgchPassword))
            })
        }
        8 | CALLBACK_GAME_LOBBY_JOIN_REQUESTED => {
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
        CALLBACK_AVATAR_IMAGE_LOADED => {
            let event = param as *const sys::AvatarImageLoaded_t;
            serde_json::json!({
                "steam_id": csteam_id_to_u64(ptr::addr_of!((*event).m_steamID).read_unaligned()).to_string(),
                "image": ptr::addr_of!((*event).m_iImage).read_unaligned(),
                "wide": ptr::addr_of!((*event).m_iWide).read_unaligned(),
                "tall": ptr::addr_of!((*event).m_iTall).read_unaligned()
            })
        }
        CALLBACK_CLAN_OFFICER_LIST_RESPONSE => {
            let event = param as *const sys::ClanOfficerListResponse_t;
            serde_json::json!({
                "clan": csteam_id_to_u64(ptr::addr_of!((*event).m_steamIDClan).read_unaligned()).to_string(),
                "officer_count": ptr::addr_of!((*event).m_cOfficers).read_unaligned(),
                "success": ptr::addr_of!((*event).m_bSuccess).read_unaligned() != 0
            })
        }
        CALLBACK_FRIEND_RICH_PRESENCE_UPDATE => {
            let event = param as *const sys::FriendRichPresenceUpdate_t;
            serde_json::json!({
                "friend": csteam_id_to_u64(ptr::addr_of!((*event).m_steamIDFriend).read_unaligned()).to_string(),
                "app_id": ptr::addr_of!((*event).m_nAppID).read_unaligned()
            })
        }
        CALLBACK_GAME_RICH_PRESENCE_JOIN_REQUESTED => {
            let event = param as *const sys::GameRichPresenceJoinRequested_t;
            serde_json::json!({
                "friend": csteam_id_to_u64(ptr::addr_of!((*event).m_steamIDFriend).read_unaligned()).to_string(),
                "connect": c_buf_to_string(&*ptr::addr_of!((*event).m_rgchConnect))
            })
        }
        CALLBACK_GAME_CONNECTED_CLAN_CHAT_MSG => {
            let event = param as *const sys::GameConnectedClanChatMsg_t;
            serde_json::json!({
                "clan_chat": csteam_id_to_u64(ptr::addr_of!((*event).m_steamIDClanChat).read_unaligned()).to_string(),
                "user": csteam_id_to_u64(ptr::addr_of!((*event).m_steamIDUser).read_unaligned()).to_string(),
                "message_id": ptr::addr_of!((*event).m_iMessageID).read_unaligned()
            })
        }
        CALLBACK_GAME_CONNECTED_CHAT_JOIN => {
            let event = param as *const sys::GameConnectedChatJoin_t;
            serde_json::json!({
                "clan_chat": csteam_id_to_u64(ptr::addr_of!((*event).m_steamIDClanChat).read_unaligned()).to_string(),
                "user": csteam_id_to_u64(ptr::addr_of!((*event).m_steamIDUser).read_unaligned()).to_string()
            })
        }
        CALLBACK_GAME_CONNECTED_CHAT_LEAVE => {
            let event = param as *const sys::GameConnectedChatLeave_t;
            serde_json::json!({
                "clan_chat": csteam_id_to_u64(ptr::addr_of!((*event).m_steamIDClanChat).read_unaligned()).to_string(),
                "user": csteam_id_to_u64(ptr::addr_of!((*event).m_steamIDUser).read_unaligned()).to_string(),
                "kicked": ptr::addr_of!((*event).m_bKicked).read_unaligned(),
                "dropped": ptr::addr_of!((*event).m_bDropped).read_unaligned()
            })
        }
        CALLBACK_DOWNLOAD_CLAN_ACTIVITY_COUNTS_RESULT => {
            let event = param as *const sys::DownloadClanActivityCountsResult_t;
            serde_json::json!({
                "success": ptr::addr_of!((*event).m_bSuccess).read_unaligned()
            })
        }
        CALLBACK_JOIN_CLAN_CHAT_ROOM_COMPLETION_RESULT => {
            let event = param as *const sys::JoinClanChatRoomCompletionResult_t;
            serde_json::json!({
                "clan_chat": csteam_id_to_u64(ptr::addr_of!((*event).m_steamIDClanChat).read_unaligned()).to_string(),
                "chat_room_enter_response": ptr::addr_of!((*event).m_eChatRoomEnterResponse).read_unaligned() as u32
            })
        }
        CALLBACK_GAME_CONNECTED_FRIEND_CHAT_MSG => {
            let event = param as *const sys::GameConnectedFriendChatMsg_t;
            serde_json::json!({
                "user": csteam_id_to_u64(ptr::addr_of!((*event).m_steamIDUser).read_unaligned()).to_string(),
                "message_id": ptr::addr_of!((*event).m_iMessageID).read_unaligned()
            })
        }
        CALLBACK_FRIENDS_GET_FOLLOWER_COUNT => {
            let event = param as *const sys::FriendsGetFollowerCount_t;
            serde_json::json!({
                "result": ptr::addr_of!((*event).m_eResult).read_unaligned() as u32,
                "steam_id": csteam_id_to_u64(ptr::addr_of!((*event).m_steamID).read_unaligned()).to_string(),
                "count": ptr::addr_of!((*event).m_nCount).read_unaligned()
            })
        }
        CALLBACK_FRIENDS_IS_FOLLOWING => {
            let event = param as *const sys::FriendsIsFollowing_t;
            serde_json::json!({
                "result": ptr::addr_of!((*event).m_eResult).read_unaligned() as u32,
                "steam_id": csteam_id_to_u64(ptr::addr_of!((*event).m_steamID).read_unaligned()).to_string(),
                "is_following": ptr::addr_of!((*event).m_bIsFollowing).read_unaligned()
            })
        }
        CALLBACK_FRIENDS_ENUMERATE_FOLLOWING_LIST => {
            let event = param as *const sys::FriendsEnumerateFollowingList_t;
            let steam_ids = ptr::addr_of!((*event).m_rgSteamID).read_unaligned();
            let results_returned = ptr::addr_of!((*event).m_nResultsReturned)
                .read_unaligned()
                .clamp(0, steam_ids.len() as i32) as usize;
            let steam_ids = steam_ids
                .iter()
                .take(results_returned)
                .map(|steam_id| csteam_id_to_u64(*steam_id).to_string())
                .collect::<Vec<_>>();
            serde_json::json!({
                "result": ptr::addr_of!((*event).m_eResult).read_unaligned() as u32,
                "steam_ids": steam_ids,
                "results_returned": ptr::addr_of!((*event).m_nResultsReturned).read_unaligned(),
                "total_result_count": ptr::addr_of!((*event).m_nTotalResultCount).read_unaligned()
            })
        }
        CALLBACK_UNREAD_CHAT_MESSAGES_CHANGED => serde_json::json!({}),
        CALLBACK_OVERLAY_BROWSER_PROTOCOL_NAVIGATION => {
            let event = param as *const sys::OverlayBrowserProtocolNavigation_t;
            serde_json::json!({
                "uri": c_buf_to_string(&*ptr::addr_of!((*event).rgchURI))
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
        CALLBACK_STEAM_NET_CONNECTION_STATUS_CHANGED => {
            let event = param as *const sys::SteamNetConnectionStatusChangedCallback_t;
            let info = ptr::addr_of!((*event).m_info).read_unaligned();
            serde_json::json!({
                "connection": ptr::addr_of!((*event).m_hConn).read_unaligned(),
                "old_state": ptr::addr_of!((*event).m_eOldState).read_unaligned() as i32,
                "info": networking_connection_info_json(&info)
            })
        }
        CALLBACK_STEAM_NETWORKING_FAKE_IP_RESULT => {
            let event = param.cast::<SteamNetworkingFakeIpResultRaw>();
            networking_fake_ip_result_json(&*event)
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
        CALLBACK_STEAM_INPUT_DEVICE_CONNECTED => {
            let event = param as *const sys::SteamInputDeviceConnected_t;
            serde_json::json!({
                "connected_device_handle": ptr::addr_of!((*event).m_ulConnectedDeviceHandle).read_unaligned().to_string()
            })
        }
        CALLBACK_STEAM_INPUT_DEVICE_DISCONNECTED => {
            let event = param as *const sys::SteamInputDeviceDisconnected_t;
            serde_json::json!({
                "disconnected_device_handle": ptr::addr_of!((*event).m_ulDisconnectedDeviceHandle).read_unaligned().to_string()
            })
        }
        CALLBACK_STEAM_INPUT_CONFIGURATION_LOADED => {
            let event = param as *const sys::SteamInputConfigurationLoaded_t;
            serde_json::json!({
                "app_id": ptr::addr_of!((*event).m_unAppID).read_unaligned(),
                "device_handle": ptr::addr_of!((*event).m_ulDeviceHandle).read_unaligned().to_string(),
                "mapping_creator": csteam_id_to_u64(ptr::addr_of!((*event).m_ulMappingCreator).read_unaligned()).to_string(),
                "major_revision": ptr::addr_of!((*event).m_unMajorRevision).read_unaligned(),
                "minor_revision": ptr::addr_of!((*event).m_unMinorRevision).read_unaligned(),
                "uses_steam_input_api": ptr::addr_of!((*event).m_bUsesSteamInputAPI).read_unaligned(),
                "uses_gamepad_api": ptr::addr_of!((*event).m_bUsesGamepadAPI).read_unaligned()
            })
        }
        CALLBACK_STEAM_INPUT_GAMEPAD_SLOT_CHANGE => {
            let event = param as *const sys::SteamInputGamepadSlotChange_t;
            serde_json::json!({
                "app_id": ptr::addr_of!((*event).m_unAppID).read_unaligned(),
                "device_handle": ptr::addr_of!((*event).m_ulDeviceHandle).read_unaligned().to_string(),
                "device_type": ptr::addr_of!((*event).m_eDeviceType).read_unaligned() as u32,
                "old_gamepad_slot": ptr::addr_of!((*event).m_nOldGamepadSlot).read_unaligned(),
                "new_gamepad_slot": ptr::addr_of!((*event).m_nNewGamepadSlot).read_unaligned()
            })
        }
        CALLBACK_GAME_SERVER_CLIENT_APPROVE => {
            let event = param as *const sys::GSClientApprove_t;
            serde_json::json!({
                "steam_id": csteam_id_to_u64(ptr::addr_of!((*event).m_SteamID).read_unaligned()).to_string(),
                "owner_steam_id": csteam_id_to_u64(ptr::addr_of!((*event).m_OwnerSteamID).read_unaligned()).to_string()
            })
        }
        CALLBACK_GAME_SERVER_CLIENT_DENY => {
            let event = param as *const sys::GSClientDeny_t;
            serde_json::json!({
                "steam_id": csteam_id_to_u64(ptr::addr_of!((*event).m_SteamID).read_unaligned()).to_string(),
                "deny_reason": ptr::addr_of!((*event).m_eDenyReason).read_unaligned() as u32,
                "optional_text": c_buf_to_string(&*ptr::addr_of!((*event).m_rgchOptionalText))
            })
        }
        CALLBACK_GAME_SERVER_CLIENT_KICK => {
            let event = param as *const sys::GSClientKick_t;
            serde_json::json!({
                "steam_id": csteam_id_to_u64(ptr::addr_of!((*event).m_SteamID).read_unaligned()).to_string(),
                "deny_reason": ptr::addr_of!((*event).m_eDenyReason).read_unaligned() as u32
            })
        }
        CALLBACK_GAME_SERVER_CLIENT_ACHIEVEMENT_STATUS => {
            let event = param as *const sys::GSClientAchievementStatus_t;
            serde_json::json!({
                "steam_id": ptr::addr_of!((*event).m_SteamID).read_unaligned().to_string(),
                "achievement": c_buf_to_string(&*ptr::addr_of!((*event).m_pchAchievement)),
                "unlocked": ptr::addr_of!((*event).m_bUnlocked).read_unaligned()
            })
        }
        CALLBACK_GAME_SERVER_POLICY_RESPONSE => {
            let event = param as *const sys::GSPolicyResponse_t;
            serde_json::json!({
                "secure": ptr::addr_of!((*event).m_bSecure).read_unaligned() != 0
            })
        }
        CALLBACK_GAME_SERVER_GAMEPLAY_STATS => {
            let event = param as *const sys::GSGameplayStats_t;
            serde_json::json!({
                "result": ptr::addr_of!((*event).m_eResult).read_unaligned() as u32,
                "rank": ptr::addr_of!((*event).m_nRank).read_unaligned(),
                "total_connects": ptr::addr_of!((*event).m_unTotalConnects).read_unaligned(),
                "total_minutes_played": ptr::addr_of!((*event).m_unTotalMinutesPlayed).read_unaligned()
            })
        }
        CALLBACK_GAME_SERVER_CLIENT_GROUP_STATUS => {
            let event = param as *const sys::GSClientGroupStatus_t;
            serde_json::json!({
                "steam_id": csteam_id_to_u64(ptr::addr_of!((*event).m_SteamIDUser).read_unaligned()).to_string(),
                "group_id": csteam_id_to_u64(ptr::addr_of!((*event).m_SteamIDGroup).read_unaligned()).to_string(),
                "member": ptr::addr_of!((*event).m_bMember).read_unaligned(),
                "officer": ptr::addr_of!((*event).m_bOfficer).read_unaligned()
            })
        }
        CALLBACK_GAME_SERVER_REPUTATION => {
            let event = param as *const sys::GSReputation_t;
            let banned_ip = ptr::addr_of!((*event).m_unBannedIP).read_unaligned();
            serde_json::json!({
                "result": ptr::addr_of!((*event).m_eResult).read_unaligned() as u32,
                "reputation_score": ptr::addr_of!((*event).m_unReputationScore).read_unaligned(),
                "banned": ptr::addr_of!((*event).m_bBanned).read_unaligned(),
                "banned_ip": banned_ip,
                "banned_ip_address": ipv4_to_string(banned_ip),
                "banned_port": ptr::addr_of!((*event).m_usBannedPort).read_unaligned(),
                "banned_game_id": ptr::addr_of!((*event).m_ulBannedGameID).read_unaligned().to_string(),
                "ban_expires": ptr::addr_of!((*event).m_unBanExpires).read_unaligned()
            })
        }
        CALLBACK_GAME_SERVER_ASSOCIATE_WITH_CLAN => {
            let event = param as *const sys::AssociateWithClanResult_t;
            serde_json::json!({
                "result": ptr::addr_of!((*event).m_eResult).read_unaligned() as u32
            })
        }
        CALLBACK_GAME_SERVER_PLAYER_COMPATIBILITY => {
            let event = param as *const sys::ComputeNewPlayerCompatibilityResult_t;
            serde_json::json!({
                "result": ptr::addr_of!((*event).m_eResult).read_unaligned() as u32,
                "players_that_dont_like_candidate": ptr::addr_of!((*event).m_cPlayersThatDontLikeCandidate).read_unaligned(),
                "players_that_candidate_doesnt_like": ptr::addr_of!((*event).m_cPlayersThatCandidateDoesntLike).read_unaligned(),
                "clan_players_that_dont_like_candidate": ptr::addr_of!((*event).m_cClanPlayersThatDontLikeCandidate).read_unaligned(),
                "candidate_steam_id": csteam_id_to_u64(ptr::addr_of!((*event).m_SteamIDCandidate).read_unaligned()).to_string()
            })
        }
        CALLBACK_GAME_SERVER_STATS_RECEIVED => {
            let event = param as *const sys::GSStatsReceived_t;
            serde_json::json!({
                "result": ptr::addr_of!((*event).m_eResult).read_unaligned() as u32,
                "steam_id": csteam_id_to_u64(ptr::addr_of!((*event).m_steamIDUser).read_unaligned()).to_string()
            })
        }
        CALLBACK_GAME_SERVER_STATS_STORED => {
            let event = param as *const sys::GSStatsStored_t;
            serde_json::json!({
                "result": ptr::addr_of!((*event).m_eResult).read_unaligned() as u32,
                "steam_id": csteam_id_to_u64(ptr::addr_of!((*event).m_steamIDUser).read_unaligned()).to_string()
            })
        }
        CALLBACK_GAME_SERVER_STATS_UNLOADED => {
            let event = param as *const sys::GSStatsUnloaded_t;
            serde_json::json!({
                "steam_id": csteam_id_to_u64(ptr::addr_of!((*event).m_steamIDUser).read_unaligned()).to_string()
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
        CALLBACK_EQUIPPED_PROFILE_ITEMS_CHANGED => {
            let event = param as *const sys::EquippedProfileItemsChanged_t;
            serde_json::json!({
                "steam_id": csteam_id_to_u64(ptr::addr_of!((*event).m_steamID).read_unaligned()).to_string()
            })
        }
        CALLBACK_EQUIPPED_PROFILE_ITEMS => {
            let event = param as *const sys::EquippedProfileItems_t;
            serde_json::json!({
                "result": ptr::addr_of!((*event).m_eResult).read_unaligned() as u32,
                "steam_id": csteam_id_to_u64(ptr::addr_of!((*event).m_steamID).read_unaligned()).to_string(),
                "has_animated_avatar": ptr::addr_of!((*event).m_bHasAnimatedAvatar).read_unaligned(),
                "has_avatar_frame": ptr::addr_of!((*event).m_bHasAvatarFrame).read_unaligned(),
                "has_profile_modifier": ptr::addr_of!((*event).m_bHasProfileModifier).read_unaligned(),
                "has_profile_background": ptr::addr_of!((*event).m_bHasProfileBackground).read_unaligned(),
                "has_mini_profile_background": ptr::addr_of!((*event).m_bHasMiniProfileBackground).read_unaligned(),
                "from_cache": ptr::addr_of!((*event).m_bFromCache).read_unaligned()
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
        CALLBACK_SCREENSHOT_READY => {
            let event = param as *const sys::ScreenshotReady_t;
            serde_json::json!({
                "local_handle": ptr::addr_of!((*event).m_hLocal).read_unaligned(),
                "result": ptr::addr_of!((*event).m_eResult).read_unaligned() as u32
            })
        }
        CALLBACK_SCREENSHOT_REQUESTED | CALLBACK_PLAYBACK_STATUS_HAS_CHANGED => {
            serde_json::json!({})
        }
        CALLBACK_VOLUME_HAS_CHANGED => {
            let event = param as *const sys::VolumeHasChanged_t;
            serde_json::json!({
                "new_volume": ptr::addr_of!((*event).m_flNewVolume).read_unaligned()
            })
        }
        CALLBACK_HTML_BROWSER_READY => {
            let event = param as *const sys::HTML_BrowserReady_t;
            serde_json::json!({
                "browser_handle": ptr::addr_of!((*event).unBrowserHandle).read_unaligned()
            })
        }
        CALLBACK_HTML_NEEDS_PAINT => {
            let event = param as *const sys::HTML_NeedsPaint_t;
            let bgra = ptr::addr_of!((*event).pBGRA).read_unaligned();
            let wide = ptr::addr_of!((*event).unWide).read_unaligned();
            let tall = ptr::addr_of!((*event).unTall).read_unaligned();
            let byte_length = u64::from(wide)
                .saturating_mul(u64::from(tall))
                .saturating_mul(4);
            let (bgra_base64, bgra_truncated) =
                if !bgra.is_null() && byte_length <= MAX_HTML_PAINT_BUFFER_BYTES {
                    let bytes = std::slice::from_raw_parts(bgra.cast::<u8>(), byte_length as usize);
                    (Some(BASE64_STANDARD.encode(bytes)), false)
                } else {
                    (None::<String>, !bgra.is_null())
                };
            serde_json::json!({
                "browser_handle": ptr::addr_of!((*event).unBrowserHandle).read_unaligned(),
                "has_bgra_data": !bgra.is_null(),
                "bgra_byte_length": byte_length,
                "bgra_base64": bgra_base64,
                "bgra_truncated": bgra_truncated,
                "wide": wide,
                "tall": tall,
                "update_x": ptr::addr_of!((*event).unUpdateX).read_unaligned(),
                "update_y": ptr::addr_of!((*event).unUpdateY).read_unaligned(),
                "update_wide": ptr::addr_of!((*event).unUpdateWide).read_unaligned(),
                "update_tall": ptr::addr_of!((*event).unUpdateTall).read_unaligned(),
                "scroll_x": ptr::addr_of!((*event).unScrollX).read_unaligned(),
                "scroll_y": ptr::addr_of!((*event).unScrollY).read_unaligned(),
                "page_scale": ptr::addr_of!((*event).flPageScale).read_unaligned(),
                "page_serial": ptr::addr_of!((*event).unPageSerial).read_unaligned()
            })
        }
        CALLBACK_HTML_START_REQUEST => {
            let event = param as *const sys::HTML_StartRequest_t;
            serde_json::json!({
                "browser_handle": ptr::addr_of!((*event).unBrowserHandle).read_unaligned(),
                "url": string_from_ptr(ptr::addr_of!((*event).pchURL).read_unaligned()),
                "target": string_from_ptr(ptr::addr_of!((*event).pchTarget).read_unaligned()),
                "post_data": string_from_ptr(ptr::addr_of!((*event).pchPostData).read_unaligned()),
                "is_redirect": ptr::addr_of!((*event).bIsRedirect).read_unaligned()
            })
        }
        CALLBACK_HTML_CLOSE_BROWSER => {
            let event = param as *const sys::HTML_CloseBrowser_t;
            serde_json::json!({
                "browser_handle": ptr::addr_of!((*event).unBrowserHandle).read_unaligned()
            })
        }
        CALLBACK_HTML_URL_CHANGED => {
            let event = param as *const sys::HTML_URLChanged_t;
            serde_json::json!({
                "browser_handle": ptr::addr_of!((*event).unBrowserHandle).read_unaligned(),
                "url": string_from_ptr(ptr::addr_of!((*event).pchURL).read_unaligned()),
                "post_data": string_from_ptr(ptr::addr_of!((*event).pchPostData).read_unaligned()),
                "is_redirect": ptr::addr_of!((*event).bIsRedirect).read_unaligned(),
                "page_title": string_from_ptr(ptr::addr_of!((*event).pchPageTitle).read_unaligned()),
                "new_navigation": ptr::addr_of!((*event).bNewNavigation).read_unaligned()
            })
        }
        CALLBACK_HTML_FINISHED_REQUEST => {
            let event = param as *const sys::HTML_FinishedRequest_t;
            serde_json::json!({
                "browser_handle": ptr::addr_of!((*event).unBrowserHandle).read_unaligned(),
                "url": string_from_ptr(ptr::addr_of!((*event).pchURL).read_unaligned()),
                "page_title": string_from_ptr(ptr::addr_of!((*event).pchPageTitle).read_unaligned())
            })
        }
        CALLBACK_HTML_OPEN_LINK_IN_NEW_TAB => {
            let event = param as *const sys::HTML_OpenLinkInNewTab_t;
            serde_json::json!({
                "browser_handle": ptr::addr_of!((*event).unBrowserHandle).read_unaligned(),
                "url": string_from_ptr(ptr::addr_of!((*event).pchURL).read_unaligned())
            })
        }
        CALLBACK_HTML_CHANGED_TITLE => {
            let event = param as *const sys::HTML_ChangedTitle_t;
            serde_json::json!({
                "browser_handle": ptr::addr_of!((*event).unBrowserHandle).read_unaligned(),
                "title": string_from_ptr(ptr::addr_of!((*event).pchTitle).read_unaligned())
            })
        }
        CALLBACK_HTML_SEARCH_RESULTS => {
            let event = param as *const sys::HTML_SearchResults_t;
            serde_json::json!({
                "browser_handle": ptr::addr_of!((*event).unBrowserHandle).read_unaligned(),
                "results": ptr::addr_of!((*event).unResults).read_unaligned(),
                "current_match": ptr::addr_of!((*event).unCurrentMatch).read_unaligned()
            })
        }
        CALLBACK_HTML_CAN_GO_BACK_AND_FORWARD => {
            let event = param as *const sys::HTML_CanGoBackAndForward_t;
            serde_json::json!({
                "browser_handle": ptr::addr_of!((*event).unBrowserHandle).read_unaligned(),
                "can_go_back": ptr::addr_of!((*event).bCanGoBack).read_unaligned(),
                "can_go_forward": ptr::addr_of!((*event).bCanGoForward).read_unaligned()
            })
        }
        CALLBACK_HTML_HORIZONTAL_SCROLL => {
            let event = param as *const sys::HTML_HorizontalScroll_t;
            serde_json::json!({
                "browser_handle": ptr::addr_of!((*event).unBrowserHandle).read_unaligned(),
                "scroll_max": ptr::addr_of!((*event).unScrollMax).read_unaligned(),
                "scroll_current": ptr::addr_of!((*event).unScrollCurrent).read_unaligned(),
                "page_scale": ptr::addr_of!((*event).flPageScale).read_unaligned(),
                "visible": ptr::addr_of!((*event).bVisible).read_unaligned(),
                "page_size": ptr::addr_of!((*event).unPageSize).read_unaligned()
            })
        }
        CALLBACK_HTML_VERTICAL_SCROLL => {
            let event = param as *const sys::HTML_VerticalScroll_t;
            serde_json::json!({
                "browser_handle": ptr::addr_of!((*event).unBrowserHandle).read_unaligned(),
                "scroll_max": ptr::addr_of!((*event).unScrollMax).read_unaligned(),
                "scroll_current": ptr::addr_of!((*event).unScrollCurrent).read_unaligned(),
                "page_scale": ptr::addr_of!((*event).flPageScale).read_unaligned(),
                "visible": ptr::addr_of!((*event).bVisible).read_unaligned(),
                "page_size": ptr::addr_of!((*event).unPageSize).read_unaligned()
            })
        }
        CALLBACK_HTML_LINK_AT_POSITION => {
            let event = param as *const sys::HTML_LinkAtPosition_t;
            serde_json::json!({
                "browser_handle": ptr::addr_of!((*event).unBrowserHandle).read_unaligned(),
                "x": ptr::addr_of!((*event).x).read_unaligned(),
                "y": ptr::addr_of!((*event).y).read_unaligned(),
                "url": string_from_ptr(ptr::addr_of!((*event).pchURL).read_unaligned()),
                "input": ptr::addr_of!((*event).bInput).read_unaligned(),
                "live_link": ptr::addr_of!((*event).bLiveLink).read_unaligned()
            })
        }
        CALLBACK_HTML_JS_ALERT => {
            let event = param as *const sys::HTML_JSAlert_t;
            serde_json::json!({
                "browser_handle": ptr::addr_of!((*event).unBrowserHandle).read_unaligned(),
                "message": string_from_ptr(ptr::addr_of!((*event).pchMessage).read_unaligned())
            })
        }
        CALLBACK_HTML_JS_CONFIRM => {
            let event = param as *const sys::HTML_JSConfirm_t;
            serde_json::json!({
                "browser_handle": ptr::addr_of!((*event).unBrowserHandle).read_unaligned(),
                "message": string_from_ptr(ptr::addr_of!((*event).pchMessage).read_unaligned())
            })
        }
        CALLBACK_HTML_FILE_OPEN_DIALOG => {
            let event = param as *const sys::HTML_FileOpenDialog_t;
            serde_json::json!({
                "browser_handle": ptr::addr_of!((*event).unBrowserHandle).read_unaligned(),
                "title": string_from_ptr(ptr::addr_of!((*event).pchTitle).read_unaligned()),
                "initial_file": string_from_ptr(ptr::addr_of!((*event).pchInitialFile).read_unaligned())
            })
        }
        CALLBACK_HTML_NEW_WINDOW => {
            let event = param as *const sys::HTML_NewWindow_t;
            serde_json::json!({
                "browser_handle": ptr::addr_of!((*event).unBrowserHandle).read_unaligned(),
                "url": string_from_ptr(ptr::addr_of!((*event).pchURL).read_unaligned()),
                "x": ptr::addr_of!((*event).unX).read_unaligned(),
                "y": ptr::addr_of!((*event).unY).read_unaligned(),
                "wide": ptr::addr_of!((*event).unWide).read_unaligned(),
                "tall": ptr::addr_of!((*event).unTall).read_unaligned(),
                "new_window_browser_handle": ptr::addr_of!((*event).unNewWindow_BrowserHandle_IGNORE).read_unaligned()
            })
        }
        CALLBACK_HTML_SET_CURSOR => {
            let event = param as *const sys::HTML_SetCursor_t;
            serde_json::json!({
                "browser_handle": ptr::addr_of!((*event).unBrowserHandle).read_unaligned(),
                "mouse_cursor": ptr::addr_of!((*event).eMouseCursor).read_unaligned()
            })
        }
        CALLBACK_HTML_STATUS_TEXT => {
            let event = param as *const sys::HTML_StatusText_t;
            serde_json::json!({
                "browser_handle": ptr::addr_of!((*event).unBrowserHandle).read_unaligned(),
                "message": string_from_ptr(ptr::addr_of!((*event).pchMsg).read_unaligned())
            })
        }
        CALLBACK_HTML_SHOW_TOOL_TIP => {
            let event = param as *const sys::HTML_ShowToolTip_t;
            serde_json::json!({
                "browser_handle": ptr::addr_of!((*event).unBrowserHandle).read_unaligned(),
                "message": string_from_ptr(ptr::addr_of!((*event).pchMsg).read_unaligned())
            })
        }
        CALLBACK_HTML_UPDATE_TOOL_TIP => {
            let event = param as *const sys::HTML_UpdateToolTip_t;
            serde_json::json!({
                "browser_handle": ptr::addr_of!((*event).unBrowserHandle).read_unaligned(),
                "message": string_from_ptr(ptr::addr_of!((*event).pchMsg).read_unaligned())
            })
        }
        CALLBACK_HTML_HIDE_TOOL_TIP => {
            let event = param as *const sys::HTML_HideToolTip_t;
            serde_json::json!({
                "browser_handle": ptr::addr_of!((*event).unBrowserHandle).read_unaligned()
            })
        }
        CALLBACK_HTML_BROWSER_RESTARTED => {
            let event = param as *const sys::HTML_BrowserRestarted_t;
            serde_json::json!({
                "browser_handle": ptr::addr_of!((*event).unBrowserHandle).read_unaligned(),
                "old_browser_handle": ptr::addr_of!((*event).unOldBrowserHandle).read_unaligned()
            })
        }
        CALLBACK_BROADCAST_UPLOAD_START => {
            let event = param as *const sys::BroadcastUploadStart_t;
            serde_json::json!({
                "is_rtmp": ptr::addr_of!((*event).m_bIsRTMP).read_unaligned()
            })
        }
        CALLBACK_BROADCAST_UPLOAD_STOP => {
            let event = param as *const sys::BroadcastUploadStop_t;
            serde_json::json!({
                "result": ptr::addr_of!((*event).m_eResult).read_unaligned() as u32
            })
        }
        CALLBACK_GET_VIDEO_URL_RESULT => {
            let event = param as *const sys::GetVideoURLResult_t;
            serde_json::json!({
                "result": ptr::addr_of!((*event).m_eResult).read_unaligned() as u32,
                "video_app_id": ptr::addr_of!((*event).m_unVideoAppID).read_unaligned(),
                "url": c_buf_to_string(&*ptr::addr_of!((*event).m_rgchURL))
            })
        }
        CALLBACK_GET_OPF_SETTINGS_RESULT => {
            let event = param as *const sys::GetOPFSettingsResult_t;
            serde_json::json!({
                "result": ptr::addr_of!((*event).m_eResult).read_unaligned() as u32,
                "video_app_id": ptr::addr_of!((*event).m_unVideoAppID).read_unaligned()
            })
        }
        CALLBACK_STEAM_PARENTAL_SETTINGS_CHANGED => serde_json::json!({}),
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
        CALLBACK_STEAM_REMOTE_PLAY_SESSION_CONNECTED => {
            let event = param as *const sys::SteamRemotePlaySessionConnected_t;
            serde_json::json!({
                "session_id": ptr::addr_of!((*event).m_unSessionID).read_unaligned()
            })
        }
        CALLBACK_STEAM_REMOTE_PLAY_SESSION_DISCONNECTED => {
            let event = param as *const sys::SteamRemotePlaySessionDisconnected_t;
            serde_json::json!({
                "session_id": ptr::addr_of!((*event).m_unSessionID).read_unaligned()
            })
        }
        CALLBACK_STEAM_REMOTE_PLAY_TOGETHER_GUEST_INVITE => {
            let event = param as *const sys::SteamRemotePlayTogetherGuestInvite_t;
            serde_json::json!({
                "connect_url": c_buf_to_string(&*ptr::addr_of!((*event).m_szConnectURL))
            })
        }
        CALLBACK_STEAM_REMOTE_PLAY_SESSION_AVATAR_LOADED => {
            let event = param as *const sys::SteamRemotePlaySessionAvatarLoaded_t;
            serde_json::json!({
                "session_id": ptr::addr_of!((*event).m_unSessionID).read_unaligned(),
                "image": ptr::addr_of!((*event).m_iImage).read_unaligned(),
                "wide": ptr::addr_of!((*event).m_iWide).read_unaligned(),
                "tall": ptr::addr_of!((*event).m_iTall).read_unaligned()
            })
        }
        CALLBACK_STEAM_TIMELINE_GAME_PHASE_RECORDING_EXISTS => {
            let event = param as *const sys::SteamTimelineGamePhaseRecordingExists_t;
            serde_json::json!({
                "phase_id": c_buf_to_string(&*ptr::addr_of!((*event).m_rgchPhaseID)),
                "recording_ms": ptr::addr_of!((*event).m_ulRecordingMS).read_unaligned().to_string(),
                "longest_clip_ms": ptr::addr_of!((*event).m_ulLongestClipMS).read_unaligned().to_string(),
                "clip_count": ptr::addr_of!((*event).m_unClipCount).read_unaligned(),
                "screenshot_count": ptr::addr_of!((*event).m_unScreenshotCount).read_unaligned()
            })
        }
        CALLBACK_STEAM_TIMELINE_EVENT_RECORDING_EXISTS => {
            let event = param as *const sys::SteamTimelineEventRecordingExists_t;
            serde_json::json!({
                "event": ptr::addr_of!((*event).m_ulEventID).read_unaligned().to_string(),
                "recording_exists": ptr::addr_of!((*event).m_bRecordingExists).read_unaligned()
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

fn html_mouse_button_from_u32(
    value: u32,
) -> Result<sys::ISteamHTMLSurface_EHTMLMouseButton, Error> {
    match value {
        0 => Ok(sys::ISteamHTMLSurface_EHTMLMouseButton::eHTMLMouseButton_Left),
        1 => Ok(sys::ISteamHTMLSurface_EHTMLMouseButton::eHTMLMouseButton_Right),
        2 => Ok(sys::ISteamHTMLSurface_EHTMLMouseButton::eHTMLMouseButton_Middle),
        _ => Err(Error::from_reason("invalid HTML mouse button")),
    }
}

fn html_key_modifiers_from_u32(value: u32) -> Result<u32, Error> {
    const VALID_HTML_KEY_MODIFIER_MASK: u32 = 0b111;

    if value & !VALID_HTML_KEY_MODIFIER_MASK == 0 {
        Ok(value)
    } else {
        Err(Error::from_reason("invalid HTML key modifiers"))
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

fn duration_control_online_state_from_u32(
    value: u32,
) -> Result<sys::EDurationControlOnlineState, Error> {
    match value {
        0 => Ok(sys::EDurationControlOnlineState::k_EDurationControlOnlineState_Invalid),
        1 => Ok(sys::EDurationControlOnlineState::k_EDurationControlOnlineState_Offline),
        2 => Ok(sys::EDurationControlOnlineState::k_EDurationControlOnlineState_Online),
        3 => Ok(sys::EDurationControlOnlineState::k_EDurationControlOnlineState_OnlineHighPri),
        _ => Err(Error::from_reason(format!(
            "invalid duration control online state {value}"
        ))),
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

fn input_digital_action_data(data: sys::InputDigitalActionData_t) -> InputDigitalActionData {
    InputDigitalActionData {
        state: data.bState,
        active: data.bActive,
    }
}

fn input_analog_action_data(data: sys::InputAnalogActionData_t) -> InputAnalogActionData {
    InputAnalogActionData {
        mode: unsafe { ptr::addr_of!(data.eMode).read_unaligned() } as u32,
        x: unsafe { ptr::addr_of!(data.x).read_unaligned() } as f64,
        y: unsafe { ptr::addr_of!(data.y).read_unaligned() } as f64,
        active: unsafe { ptr::addr_of!(data.bActive).read_unaligned() },
    }
}

unsafe fn steam_input_action_event_json(event: *mut sys::SteamInputActionEvent_t) -> Value {
    let controller_handle = ptr::addr_of!((*event).controllerHandle).read_unaligned();
    let event_type = ptr::addr_of!((*event).eEventType).read_unaligned();
    match event_type {
        sys::ESteamInputActionEventType::ESteamInputActionEventType_DigitalAction => {
            let digital = ptr::addr_of!((*event).__bindgen_anon_1.digitalAction).read_unaligned();
            let action_handle = ptr::addr_of!(digital.actionHandle).read_unaligned();
            let data = ptr::addr_of!(digital.digitalActionData).read_unaligned();
            serde_json::json!({
                "controller_handle": controller_handle.to_string(),
                "event_type": event_type as u32,
                "digital_action_handle": action_handle.to_string(),
                "digital_action_data": {
                    "state": data.bState,
                    "active": data.bActive
                }
            })
        }
        sys::ESteamInputActionEventType::ESteamInputActionEventType_AnalogAction => {
            let analog = ptr::addr_of!((*event).__bindgen_anon_1.analogAction).read_unaligned();
            let action_handle = ptr::addr_of!(analog.actionHandle).read_unaligned();
            let data = ptr::addr_of!(analog.analogActionData).read_unaligned();
            serde_json::json!({
                "controller_handle": controller_handle.to_string(),
                "event_type": event_type as u32,
                "analog_action_handle": action_handle.to_string(),
                "analog_action_data": {
                    "mode": ptr::addr_of!(data.eMode).read_unaligned() as u32,
                    "x": ptr::addr_of!(data.x).read_unaligned(),
                    "y": ptr::addr_of!(data.y).read_unaligned(),
                    "active": ptr::addr_of!(data.bActive).read_unaligned()
                }
            })
        }
        _ => serde_json::json!({
            "controller_handle": controller_handle.to_string(),
            "event_type": event_type as u32
        }),
    }
}

fn input_motion_data(data: sys::InputMotionData_t) -> InputMotionData {
    InputMotionData {
        rotation_quaternion_x: unsafe { ptr::addr_of!(data.rotQuatX).read_unaligned() } as f64,
        rotation_quaternion_y: unsafe { ptr::addr_of!(data.rotQuatY).read_unaligned() } as f64,
        rotation_quaternion_z: unsafe { ptr::addr_of!(data.rotQuatZ).read_unaligned() } as f64,
        rotation_quaternion_w: unsafe { ptr::addr_of!(data.rotQuatW).read_unaligned() } as f64,
        position_acceleration_x: unsafe { ptr::addr_of!(data.posAccelX).read_unaligned() } as f64,
        position_acceleration_y: unsafe { ptr::addr_of!(data.posAccelY).read_unaligned() } as f64,
        position_acceleration_z: unsafe { ptr::addr_of!(data.posAccelZ).read_unaligned() } as f64,
        rotation_velocity_x: unsafe { ptr::addr_of!(data.rotVelX).read_unaligned() } as f64,
        rotation_velocity_y: unsafe { ptr::addr_of!(data.rotVelY).read_unaligned() } as f64,
        rotation_velocity_z: unsafe { ptr::addr_of!(data.rotVelZ).read_unaligned() } as f64,
    }
}

fn input_action_origin_from_u32(value: u32) -> Result<sys::EInputActionOrigin, Error> {
    if value <= sys::EInputActionOrigin::k_EInputActionOrigin_Count as u32
        || value == sys::EInputActionOrigin::k_EInputActionOrigin_MaximumPossibleValue as u32
    {
        Ok(unsafe { std::mem::transmute::<u32, sys::EInputActionOrigin>(value) })
    } else {
        Err(Error::from_reason(format!(
            "invalid input action origin {value}"
        )))
    }
}

fn controller_action_origin_from_u32(value: u32) -> Result<sys::EControllerActionOrigin, Error> {
    if value <= sys::EControllerActionOrigin::k_EControllerActionOrigin_Count as u32
        || value
            == sys::EControllerActionOrigin::k_EControllerActionOrigin_MaximumPossibleValue as u32
    {
        Ok(unsafe { std::mem::transmute::<u32, sys::EControllerActionOrigin>(value) })
    } else {
        Err(Error::from_reason(format!(
            "invalid controller action origin {value}"
        )))
    }
}

fn input_glyph_size_from_u32(value: u32) -> Result<sys::ESteamInputGlyphSize, Error> {
    match value {
        0 => Ok(sys::ESteamInputGlyphSize::k_ESteamInputGlyphSize_Small),
        1 => Ok(sys::ESteamInputGlyphSize::k_ESteamInputGlyphSize_Medium),
        2 => Ok(sys::ESteamInputGlyphSize::k_ESteamInputGlyphSize_Large),
        _ => Err(Error::from_reason(format!(
            "invalid input glyph size {value}"
        ))),
    }
}

fn steam_input_type_from_u32(value: u32) -> Result<sys::ESteamInputType, Error> {
    match value {
        0 => Ok(sys::ESteamInputType::k_ESteamInputType_Unknown),
        1 => Ok(sys::ESteamInputType::k_ESteamInputType_SteamController),
        2 => Ok(sys::ESteamInputType::k_ESteamInputType_XBox360Controller),
        3 => Ok(sys::ESteamInputType::k_ESteamInputType_XBoxOneController),
        4 => Ok(sys::ESteamInputType::k_ESteamInputType_GenericGamepad),
        5 => Ok(sys::ESteamInputType::k_ESteamInputType_PS4Controller),
        6 => Ok(sys::ESteamInputType::k_ESteamInputType_AppleMFiController),
        7 => Ok(sys::ESteamInputType::k_ESteamInputType_AndroidController),
        8 => Ok(sys::ESteamInputType::k_ESteamInputType_SwitchJoyConPair),
        9 => Ok(sys::ESteamInputType::k_ESteamInputType_SwitchJoyConSingle),
        10 => Ok(sys::ESteamInputType::k_ESteamInputType_SwitchProController),
        11 => Ok(sys::ESteamInputType::k_ESteamInputType_MobileTouch),
        12 => Ok(sys::ESteamInputType::k_ESteamInputType_PS3Controller),
        13 => Ok(sys::ESteamInputType::k_ESteamInputType_PS5Controller),
        14 => Ok(sys::ESteamInputType::k_ESteamInputType_SteamDeckController),
        _ => Err(Error::from_reason(format!("invalid input type {value}"))),
    }
}

fn xbox_origin_from_u32(value: u32) -> Result<sys::EXboxOrigin, Error> {
    match value {
        0 => Ok(sys::EXboxOrigin::k_EXboxOrigin_A),
        1 => Ok(sys::EXboxOrigin::k_EXboxOrigin_B),
        2 => Ok(sys::EXboxOrigin::k_EXboxOrigin_X),
        3 => Ok(sys::EXboxOrigin::k_EXboxOrigin_Y),
        4 => Ok(sys::EXboxOrigin::k_EXboxOrigin_LeftBumper),
        5 => Ok(sys::EXboxOrigin::k_EXboxOrigin_RightBumper),
        6 => Ok(sys::EXboxOrigin::k_EXboxOrigin_Menu),
        7 => Ok(sys::EXboxOrigin::k_EXboxOrigin_View),
        8 => Ok(sys::EXboxOrigin::k_EXboxOrigin_LeftTrigger_Pull),
        9 => Ok(sys::EXboxOrigin::k_EXboxOrigin_LeftTrigger_Click),
        10 => Ok(sys::EXboxOrigin::k_EXboxOrigin_RightTrigger_Pull),
        11 => Ok(sys::EXboxOrigin::k_EXboxOrigin_RightTrigger_Click),
        12 => Ok(sys::EXboxOrigin::k_EXboxOrigin_LeftStick_Move),
        13 => Ok(sys::EXboxOrigin::k_EXboxOrigin_LeftStick_Click),
        14 => Ok(sys::EXboxOrigin::k_EXboxOrigin_LeftStick_DPadNorth),
        15 => Ok(sys::EXboxOrigin::k_EXboxOrigin_LeftStick_DPadSouth),
        16 => Ok(sys::EXboxOrigin::k_EXboxOrigin_LeftStick_DPadWest),
        17 => Ok(sys::EXboxOrigin::k_EXboxOrigin_LeftStick_DPadEast),
        18 => Ok(sys::EXboxOrigin::k_EXboxOrigin_RightStick_Move),
        19 => Ok(sys::EXboxOrigin::k_EXboxOrigin_RightStick_Click),
        20 => Ok(sys::EXboxOrigin::k_EXboxOrigin_RightStick_DPadNorth),
        21 => Ok(sys::EXboxOrigin::k_EXboxOrigin_RightStick_DPadSouth),
        22 => Ok(sys::EXboxOrigin::k_EXboxOrigin_RightStick_DPadWest),
        23 => Ok(sys::EXboxOrigin::k_EXboxOrigin_RightStick_DPadEast),
        24 => Ok(sys::EXboxOrigin::k_EXboxOrigin_DPad_North),
        25 => Ok(sys::EXboxOrigin::k_EXboxOrigin_DPad_South),
        26 => Ok(sys::EXboxOrigin::k_EXboxOrigin_DPad_West),
        27 => Ok(sys::EXboxOrigin::k_EXboxOrigin_DPad_East),
        _ => Err(Error::from_reason(format!("invalid Xbox origin {value}"))),
    }
}

fn controller_haptic_location_from_u32(
    value: u32,
) -> Result<sys::EControllerHapticLocation, Error> {
    match value {
        1 => Ok(sys::EControllerHapticLocation::k_EControllerHapticLocation_Left),
        2 => Ok(sys::EControllerHapticLocation::k_EControllerHapticLocation_Right),
        3 => Ok(sys::EControllerHapticLocation::k_EControllerHapticLocation_Both),
        _ => Err(Error::from_reason(format!(
            "invalid haptic location {value}"
        ))),
    }
}

fn steam_controller_pad_from_u32(value: u32) -> Result<sys::ESteamControllerPad, Error> {
    match value {
        0 => Ok(sys::ESteamControllerPad::k_ESteamControllerPad_Left),
        1 => Ok(sys::ESteamControllerPad::k_ESteamControllerPad_Right),
        _ => Err(Error::from_reason(format!(
            "invalid Steam Controller pad {value}"
        ))),
    }
}

fn input_u8(value: u32, name: &str) -> Result<u8, Error> {
    u8::try_from(value).map_err(|_| Error::from_reason(format!("{name} must be between 0 and 255")))
}

fn input_i8(value: i32, name: &str) -> Result<i8, Error> {
    i8::try_from(value)
        .map_err(|_| Error::from_reason(format!("{name} must be between -128 and 127")))
}

fn input_u16(value: u32, name: &str) -> Result<u16, Error> {
    u16::try_from(value)
        .map_err(|_| Error::from_reason(format!("{name} must be between 0 and 65535")))
}

fn notification_position_from_i32(value: i32) -> Result<sys::ENotificationPosition, Error> {
    match value {
        -1 => Ok(sys::ENotificationPosition::k_EPositionInvalid),
        0 => Ok(sys::ENotificationPosition::k_EPositionTopLeft),
        1 => Ok(sys::ENotificationPosition::k_EPositionTopRight),
        2 => Ok(sys::ENotificationPosition::k_EPositionBottomLeft),
        3 => Ok(sys::ENotificationPosition::k_EPositionBottomRight),
        _ => Err(Error::from_reason(format!(
            "invalid overlay notification position {value}"
        ))),
    }
}

fn text_filtering_context_from_u32(value: u32) -> Result<sys::ETextFilteringContext, Error> {
    match value {
        0 => Ok(sys::ETextFilteringContext::k_ETextFilteringContextUnknown),
        1 => Ok(sys::ETextFilteringContext::k_ETextFilteringContextGameContent),
        2 => Ok(sys::ETextFilteringContext::k_ETextFilteringContextChat),
        3 => Ok(sys::ETextFilteringContext::k_ETextFilteringContextName),
        _ => Err(Error::from_reason(format!(
            "invalid text filtering context {value}"
        ))),
    }
}

fn ipv6_connectivity_protocol_from_u32(
    value: u32,
) -> Result<sys::ESteamIPv6ConnectivityProtocol, Error> {
    match value {
        0 => Ok(sys::ESteamIPv6ConnectivityProtocol::k_ESteamIPv6ConnectivityProtocol_Invalid),
        1 => Ok(sys::ESteamIPv6ConnectivityProtocol::k_ESteamIPv6ConnectivityProtocol_HTTP),
        2 => Ok(sys::ESteamIPv6ConnectivityProtocol::k_ESteamIPv6ConnectivityProtocol_UDP),
        _ => Err(Error::from_reason(format!(
            "invalid IPv6 connectivity protocol {value}"
        ))),
    }
}

#[derive(Clone, Copy)]
enum MatchmakingServerListKind {
    Internet,
    Lan,
    Friends,
    Favorites,
    History,
    Spectator,
}

fn matchmaking_server_list_kind_name(kind: MatchmakingServerListKind) -> &'static str {
    match kind {
        MatchmakingServerListKind::Internet => "internet",
        MatchmakingServerListKind::Lan => "lan",
        MatchmakingServerListKind::Friends => "friends",
        MatchmakingServerListKind::Favorites => "favorites",
        MatchmakingServerListKind::History => "history",
        MatchmakingServerListKind::Spectator => "spectator",
    }
}

async fn request_matchmaking_server_list(
    kind: MatchmakingServerListKind,
    app_id: u32,
    filters: Option<Value>,
    timeout_seconds: Option<u32>,
) -> Result<MatchmakingServerListResult, Error> {
    let mut filter_values = matchmaking_server_filters(filters)?;
    let filter_count = len_to_u32(filter_values.len(), "matchmaking server filters")?;

    let mut response = matchmaking_server_list_response();
    let request_handle = match start_matchmaking_server_list_request(
        kind,
        app_id,
        filter_count,
        &mut filter_values,
        &mut response,
    ) {
        Ok(request) => request,
        Err(err) => {
            drop_matchmaking_server_list_response(response);
            return Err(err);
        }
    };
    matchmaking_server_list_set_request(&response, request_handle);

    let wait_result = wait_for_matchmaking_server_list(
        &response,
        request_handle,
        u64::from(timeout_seconds.unwrap_or(DEFAULT_ASYNC_TIMEOUT_SECONDS as u32)),
    )
    .await;
    let servers = steam_matchmaking_servers()?;
    let request = request_handle as sys::HServerListRequest;
    let result = match wait_result {
        Ok(response_code) => {
            let count =
                unsafe { sys::SteamAPI_ISteamMatchmakingServers_GetServerCount(servers, request) };
            let mut items = Vec::new();
            for index in 0..count.max(0) {
                let item = unsafe {
                    sys::SteamAPI_ISteamMatchmakingServers_GetServerDetails(servers, request, index)
                };
                if let Some(item) = matchmaking_server_item(item) {
                    items.push(item);
                }
            }
            let (responded, failed) = matchmaking_server_list_events(&response);
            Ok(MatchmakingServerListResult {
                response: response_code,
                responded,
                failed,
                servers: items,
            })
        }
        Err(err) => {
            unsafe { sys::SteamAPI_ISteamMatchmakingServers_CancelQuery(servers, request) };
            Err(err)
        }
    };
    unsafe { sys::SteamAPI_ISteamMatchmakingServers_ReleaseRequest(servers, request) };
    drop_matchmaking_server_list_response(response);
    result
}

fn open_matchmaking_server_list_request(
    kind: MatchmakingServerListKind,
    app_id: u32,
    filters: Option<Value>,
) -> Result<MatchmakingServerListRequest, Error> {
    let mut filter_values = matchmaking_server_filters(filters)?;
    let filter_count = len_to_u32(filter_values.len(), "matchmaking server filters")?;
    let mut response = matchmaking_server_list_response();
    let request = match start_matchmaking_server_list_request(
        kind,
        app_id,
        filter_count,
        &mut filter_values,
        &mut response,
    ) {
        Ok(request) => request,
        Err(err) => {
            drop_matchmaking_server_list_response(response);
            return Err(err);
        }
    };
    matchmaking_server_list_set_request(&response, request);
    let handle = NEXT_MATCHMAKING_SERVER_LIST_HANDLE.fetch_add(1, Ordering::Relaxed);
    let entry = MatchmakingServerListRequestEntry {
        request,
        app_id,
        kind,
        response,
    };
    MATCHMAKING_SERVER_LIST_REQUESTS
        .lock()
        .unwrap()
        .insert(handle, entry);
    Ok(MatchmakingServerListRequest {
        handle: handle.into(),
        steam_request: (request as u64).into(),
        app_id,
        kind: matchmaking_server_list_kind_name(kind).to_owned(),
    })
}

fn start_matchmaking_server_list_request(
    kind: MatchmakingServerListKind,
    app_id: u32,
    filter_count: u32,
    filter_values: &mut [sys::MatchMakingKeyValuePair_t],
    response: &mut Box<MatchmakingServerListResponseRaw>,
) -> Result<usize, Error> {
    let response_ptr = response.as_mut() as *mut MatchmakingServerListResponseRaw
        as *mut sys::ISteamMatchmakingServerListResponse;
    let mut filter_value_ptr = filter_values.as_mut_ptr();
    let filter_ptr = if filter_values.is_empty() {
        ptr::null_mut()
    } else {
        &mut filter_value_ptr as *mut *mut sys::MatchMakingKeyValuePair_t
    };
    let servers = steam_matchmaking_servers()?;
    let request = unsafe {
        match kind {
            MatchmakingServerListKind::Internet => {
                sys::SteamAPI_ISteamMatchmakingServers_RequestInternetServerList(
                    servers,
                    app_id,
                    filter_ptr,
                    filter_count,
                    response_ptr,
                )
            }
            MatchmakingServerListKind::Lan => {
                sys::SteamAPI_ISteamMatchmakingServers_RequestLANServerList(
                    servers,
                    app_id,
                    response_ptr,
                )
            }
            MatchmakingServerListKind::Friends => {
                sys::SteamAPI_ISteamMatchmakingServers_RequestFriendsServerList(
                    servers,
                    app_id,
                    filter_ptr,
                    filter_count,
                    response_ptr,
                )
            }
            MatchmakingServerListKind::Favorites => {
                sys::SteamAPI_ISteamMatchmakingServers_RequestFavoritesServerList(
                    servers,
                    app_id,
                    filter_ptr,
                    filter_count,
                    response_ptr,
                )
            }
            MatchmakingServerListKind::History => {
                sys::SteamAPI_ISteamMatchmakingServers_RequestHistoryServerList(
                    servers,
                    app_id,
                    filter_ptr,
                    filter_count,
                    response_ptr,
                )
            }
            MatchmakingServerListKind::Spectator => {
                sys::SteamAPI_ISteamMatchmakingServers_RequestSpectatorServerList(
                    servers,
                    app_id,
                    filter_ptr,
                    filter_count,
                    response_ptr,
                )
            }
        }
    };
    if request.is_null() {
        Err(Error::from_reason(
            "Steam returned an invalid matchmaking server list request",
        ))
    } else {
        Ok(request as usize)
    }
}

fn get_matchmaking_server_list_request_state(
    handle: BigInt,
) -> Result<MatchmakingServerListRequestState, Error> {
    let handle = bigint_to_u64(handle, "matchmaking server list request handle")?;
    run_callbacks();
    let servers = steam_matchmaking_servers()?;
    let requests = MATCHMAKING_SERVER_LIST_REQUESTS.lock().unwrap();
    let entry = requests
        .get(&handle)
        .ok_or_else(|| matchmaking_server_list_request_error(handle))?;
    let request = entry.request as sys::HServerListRequest;
    let refreshing =
        unsafe { sys::SteamAPI_ISteamMatchmakingServers_IsRefreshing(servers, request) };
    let server_count =
        unsafe { sys::SteamAPI_ISteamMatchmakingServers_GetServerCount(servers, request) };
    let inner = unsafe { &*entry.response.state }.inner.lock().unwrap();
    Ok(MatchmakingServerListRequestState {
        handle: handle.into(),
        steam_request: (entry.request as u64).into(),
        app_id: entry.app_id,
        kind: matchmaking_server_list_kind_name(entry.kind).to_owned(),
        completed: inner.completed,
        cancelled: inner.cancelled,
        response: inner.response,
        responded: inner.responded.clone(),
        failed: inner.failed.clone(),
        refreshing,
        server_count,
    })
}

fn get_matchmaking_server_list_request_server_details(
    handle: BigInt,
    server: i32,
) -> Result<Option<MatchmakingServerItem>, Error> {
    let handle = bigint_to_u64(handle, "matchmaking server list request handle")?;
    run_callbacks();
    let servers = steam_matchmaking_servers()?;
    let requests = MATCHMAKING_SERVER_LIST_REQUESTS.lock().unwrap();
    let entry = requests
        .get(&handle)
        .ok_or_else(|| matchmaking_server_list_request_error(handle))?;
    let item = unsafe {
        sys::SteamAPI_ISteamMatchmakingServers_GetServerDetails(
            servers,
            entry.request as sys::HServerListRequest,
            server,
        )
    };
    Ok(matchmaking_server_item(item))
}

fn refresh_matchmaking_server_list_query(handle: BigInt) -> Result<(), Error> {
    let handle = bigint_to_u64(handle, "matchmaking server list request handle")?;
    run_callbacks();
    let servers = steam_matchmaking_servers()?;
    let requests = MATCHMAKING_SERVER_LIST_REQUESTS.lock().unwrap();
    let entry = requests
        .get(&handle)
        .ok_or_else(|| matchmaking_server_list_request_error(handle))?;
    matchmaking_server_list_reset(&entry.response, entry.request);
    unsafe {
        sys::SteamAPI_ISteamMatchmakingServers_RefreshQuery(
            servers,
            entry.request as sys::HServerListRequest,
        )
    };
    Ok(())
}

fn refresh_matchmaking_server_list_server(handle: BigInt, server: i32) -> Result<(), Error> {
    let handle = bigint_to_u64(handle, "matchmaking server list request handle")?;
    run_callbacks();
    let servers = steam_matchmaking_servers()?;
    let requests = MATCHMAKING_SERVER_LIST_REQUESTS.lock().unwrap();
    let entry = requests
        .get(&handle)
        .ok_or_else(|| matchmaking_server_list_request_error(handle))?;
    unsafe {
        sys::SteamAPI_ISteamMatchmakingServers_RefreshServer(
            servers,
            entry.request as sys::HServerListRequest,
            server,
        )
    };
    Ok(())
}

fn cancel_matchmaking_server_list_query(handle: BigInt) -> Result<(), Error> {
    let handle = bigint_to_u64(handle, "matchmaking server list request handle")?;
    run_callbacks();
    let servers = steam_matchmaking_servers()?;
    let requests = MATCHMAKING_SERVER_LIST_REQUESTS.lock().unwrap();
    let entry = requests
        .get(&handle)
        .ok_or_else(|| matchmaking_server_list_request_error(handle))?;
    unsafe {
        sys::SteamAPI_ISteamMatchmakingServers_CancelQuery(
            servers,
            entry.request as sys::HServerListRequest,
        )
    };
    matchmaking_server_list_cancel(&entry.response);
    Ok(())
}

fn release_matchmaking_server_list_request(handle: BigInt) -> Result<bool, Error> {
    let handle = bigint_to_u64(handle, "matchmaking server list request handle")?;
    run_callbacks();
    let servers = steam_matchmaking_servers()?;
    let entry = MATCHMAKING_SERVER_LIST_REQUESTS
        .lock()
        .unwrap()
        .remove(&handle);
    let Some(entry) = entry else {
        return Ok(false);
    };
    let request = entry.request as sys::HServerListRequest;
    if unsafe { sys::SteamAPI_ISteamMatchmakingServers_IsRefreshing(servers, request) } {
        unsafe { sys::SteamAPI_ISteamMatchmakingServers_CancelQuery(servers, request) };
    }
    unsafe { sys::SteamAPI_ISteamMatchmakingServers_ReleaseRequest(servers, request) };
    drop_matchmaking_server_list_response(entry.response);
    Ok(true)
}

fn matchmaking_server_list_request_error(handle: u64) -> Error {
    Error::from_reason(format!(
        "unknown matchmaking server list request handle {handle}"
    ))
}

async fn ping_matchmaking_server(
    ip: u32,
    query_port: u32,
    timeout_seconds: Option<u32>,
) -> Result<MatchmakingServerPingResult, Error> {
    let mut response = matchmaking_ping_response();
    let response_ptr = response.as_mut() as *mut MatchmakingPingResponseRaw
        as *mut sys::ISteamMatchmakingPingResponse;
    let query = {
        let servers = steam_matchmaking_servers()?;
        unsafe {
            sys::SteamAPI_ISteamMatchmakingServers_PingServer(
                servers,
                ip,
                port_to_u16(query_port, "matchmaking server query port")?,
                response_ptr,
            )
        }
    };
    if query == sys::HSERVERQUERY_INVALID {
        drop_matchmaking_ping_response(response);
        return Err(Error::from_reason(
            "Steam returned an invalid matchmaking server ping query",
        ));
    }
    let wait_result = wait_for_matchmaking_ping(
        &response,
        u64::from(timeout_seconds.unwrap_or(DEFAULT_ASYNC_TIMEOUT_SECONDS as u32)),
    )
    .await;
    let result = match wait_result {
        Ok(()) => {
            let mut inner = unsafe { &*response.state }.inner.lock().unwrap();
            Ok(MatchmakingServerPingResult {
                responded: inner.responded,
                server: inner.server.take(),
            })
        }
        Err(err) => {
            let servers = steam_matchmaking_servers()?;
            unsafe { sys::SteamAPI_ISteamMatchmakingServers_CancelServerQuery(servers, query) };
            Err(err)
        }
    };
    drop_matchmaking_ping_response(response);
    result
}

async fn get_matchmaking_server_players(
    ip: u32,
    query_port: u32,
    timeout_seconds: Option<u32>,
) -> Result<MatchmakingServerPlayersResult, Error> {
    let mut response = matchmaking_players_response();
    let response_ptr = response.as_mut() as *mut MatchmakingPlayersResponseRaw
        as *mut sys::ISteamMatchmakingPlayersResponse;
    let query = {
        let servers = steam_matchmaking_servers()?;
        unsafe {
            sys::SteamAPI_ISteamMatchmakingServers_PlayerDetails(
                servers,
                ip,
                port_to_u16(query_port, "matchmaking server query port")?,
                response_ptr,
            )
        }
    };
    if query == sys::HSERVERQUERY_INVALID {
        drop_matchmaking_players_response(response);
        return Err(Error::from_reason(
            "Steam returned an invalid matchmaking server players query",
        ));
    }
    let wait_result = wait_for_matchmaking_players(
        &response,
        u64::from(timeout_seconds.unwrap_or(DEFAULT_ASYNC_TIMEOUT_SECONDS as u32)),
    )
    .await;
    let result = match wait_result {
        Ok(()) => {
            let mut inner = unsafe { &*response.state }.inner.lock().unwrap();
            Ok(MatchmakingServerPlayersResult {
                responded: inner.responded,
                players: std::mem::take(&mut inner.players),
            })
        }
        Err(err) => {
            let servers = steam_matchmaking_servers()?;
            unsafe { sys::SteamAPI_ISteamMatchmakingServers_CancelServerQuery(servers, query) };
            Err(err)
        }
    };
    drop_matchmaking_players_response(response);
    result
}

async fn get_matchmaking_server_rules(
    ip: u32,
    query_port: u32,
    timeout_seconds: Option<u32>,
) -> Result<MatchmakingServerRulesResult, Error> {
    let mut response = matchmaking_rules_response();
    let response_ptr = response.as_mut() as *mut MatchmakingRulesResponseRaw
        as *mut sys::ISteamMatchmakingRulesResponse;
    let query = {
        let servers = steam_matchmaking_servers()?;
        unsafe {
            sys::SteamAPI_ISteamMatchmakingServers_ServerRules(
                servers,
                ip,
                port_to_u16(query_port, "matchmaking server query port")?,
                response_ptr,
            )
        }
    };
    if query == sys::HSERVERQUERY_INVALID {
        drop_matchmaking_rules_response(response);
        return Err(Error::from_reason(
            "Steam returned an invalid matchmaking server rules query",
        ));
    }
    let wait_result = wait_for_matchmaking_rules(
        &response,
        u64::from(timeout_seconds.unwrap_or(DEFAULT_ASYNC_TIMEOUT_SECONDS as u32)),
    )
    .await;
    let result = match wait_result {
        Ok(()) => {
            let mut inner = unsafe { &*response.state }.inner.lock().unwrap();
            Ok(MatchmakingServerRulesResult {
                responded: inner.responded,
                rules: std::mem::take(&mut inner.rules),
            })
        }
        Err(err) => {
            let servers = steam_matchmaking_servers()?;
            unsafe { sys::SteamAPI_ISteamMatchmakingServers_CancelServerQuery(servers, query) };
            Err(err)
        }
    };
    drop_matchmaking_rules_response(response);
    result
}

fn matchmaking_server_filters(
    filters: Option<Value>,
) -> Result<Vec<sys::MatchMakingKeyValuePair_t>, Error> {
    let filters = match filters {
        Some(Value::Array(filters)) => filters,
        Some(_) => {
            return Err(Error::from_reason(
                "matchmaking server filters must be an array",
            ))
        }
        None => return Ok(Vec::new()),
    };
    let mut values = Vec::with_capacity(filters.len());
    for filter in filters {
        let Value::Object(filter) = filter else {
            return Err(Error::from_reason(
                "matchmaking server filters must be objects",
            ));
        };
        let key = filter
            .get("key")
            .and_then(Value::as_str)
            .ok_or_else(|| Error::from_reason("matchmaking server filter key is required"))?;
        let value = filter
            .get("value")
            .and_then(Value::as_str)
            .unwrap_or_default();
        values.push(matchmaking_server_filter_pair(
            key.to_string(),
            value.to_string(),
        )?);
    }
    Ok(values)
}

fn matchmaking_server_list_response() -> Box<MatchmakingServerListResponseRaw> {
    Box::new(MatchmakingServerListResponseRaw {
        vtable: &MATCHMAKING_SERVER_LIST_RESPONSE_VTABLE,
        state: Box::into_raw(Box::new(MatchmakingServerListState {
            inner: Mutex::new(MatchmakingServerListStateInner::default()),
        })),
    })
}

fn drop_matchmaking_server_list_response(response: Box<MatchmakingServerListResponseRaw>) {
    unsafe { drop(Box::from_raw(response.state)) };
}

fn matchmaking_ping_response() -> Box<MatchmakingPingResponseRaw> {
    Box::new(MatchmakingPingResponseRaw {
        vtable: &MATCHMAKING_PING_RESPONSE_VTABLE,
        state: Box::into_raw(Box::new(MatchmakingPingState {
            inner: Mutex::new(MatchmakingPingStateInner::default()),
        })),
    })
}

fn drop_matchmaking_ping_response(response: Box<MatchmakingPingResponseRaw>) {
    unsafe { drop(Box::from_raw(response.state)) };
}

fn matchmaking_players_response() -> Box<MatchmakingPlayersResponseRaw> {
    Box::new(MatchmakingPlayersResponseRaw {
        vtable: &MATCHMAKING_PLAYERS_RESPONSE_VTABLE,
        state: Box::into_raw(Box::new(MatchmakingPlayersState {
            inner: Mutex::new(MatchmakingPlayersStateInner::default()),
        })),
    })
}

fn drop_matchmaking_players_response(response: Box<MatchmakingPlayersResponseRaw>) {
    unsafe { drop(Box::from_raw(response.state)) };
}

fn matchmaking_rules_response() -> Box<MatchmakingRulesResponseRaw> {
    Box::new(MatchmakingRulesResponseRaw {
        vtable: &MATCHMAKING_RULES_RESPONSE_VTABLE,
        state: Box::into_raw(Box::new(MatchmakingRulesState {
            inner: Mutex::new(MatchmakingRulesStateInner::default()),
        })),
    })
}

fn drop_matchmaking_rules_response(response: Box<MatchmakingRulesResponseRaw>) {
    unsafe { drop(Box::from_raw(response.state)) };
}

fn matchmaking_server_list_set_request(
    response: &MatchmakingServerListResponseRaw,
    request: usize,
) {
    let mut inner = unsafe { &*response.state }.inner.lock().unwrap();
    inner.request = request;
}

fn matchmaking_server_list_reset(response: &MatchmakingServerListResponseRaw, request: usize) {
    let mut inner = unsafe { &*response.state }.inner.lock().unwrap();
    inner.request = request;
    inner.completed = false;
    inner.cancelled = false;
    inner.response = 0;
    inner.responded.clear();
    inner.failed.clear();
}

fn matchmaking_server_list_cancel(response: &MatchmakingServerListResponseRaw) {
    let mut inner = unsafe { &*response.state }.inner.lock().unwrap();
    inner.completed = true;
    inner.cancelled = true;
}

fn matchmaking_server_list_events(
    response: &MatchmakingServerListResponseRaw,
) -> (Vec<i32>, Vec<i32>) {
    let inner = unsafe { &*response.state }.inner.lock().unwrap();
    (inner.responded.clone(), inner.failed.clone())
}

async fn wait_for_matchmaking_server_list(
    response: &MatchmakingServerListResponseRaw,
    request: usize,
    timeout_seconds: u64,
) -> Result<u32, Error> {
    let started = Instant::now();
    loop {
        run_callbacks();
        {
            let inner = unsafe { &*response.state }.inner.lock().unwrap();
            if inner.completed && (inner.request == 0 || inner.request == request) {
                return Ok(inner.response);
            }
        }
        if started.elapsed() > Duration::from_secs(timeout_seconds) {
            return Err(Error::from_reason(
                "Steam matchmaking server list request timed out",
            ));
        }
        tokio::time::sleep(Duration::from_millis(16)).await;
    }
}

async fn wait_for_matchmaking_ping(
    response: &MatchmakingPingResponseRaw,
    timeout_seconds: u64,
) -> Result<(), Error> {
    let started = Instant::now();
    loop {
        run_callbacks();
        if unsafe { &*response.state }.inner.lock().unwrap().completed {
            return Ok(());
        }
        if started.elapsed() > Duration::from_secs(timeout_seconds) {
            return Err(Error::from_reason(
                "Steam matchmaking server ping query timed out",
            ));
        }
        tokio::time::sleep(Duration::from_millis(16)).await;
    }
}

async fn wait_for_matchmaking_players(
    response: &MatchmakingPlayersResponseRaw,
    timeout_seconds: u64,
) -> Result<(), Error> {
    let started = Instant::now();
    loop {
        run_callbacks();
        if unsafe { &*response.state }.inner.lock().unwrap().completed {
            return Ok(());
        }
        if started.elapsed() > Duration::from_secs(timeout_seconds) {
            return Err(Error::from_reason(
                "Steam matchmaking server players query timed out",
            ));
        }
        tokio::time::sleep(Duration::from_millis(16)).await;
    }
}

async fn wait_for_matchmaking_rules(
    response: &MatchmakingRulesResponseRaw,
    timeout_seconds: u64,
) -> Result<(), Error> {
    let started = Instant::now();
    loop {
        run_callbacks();
        if unsafe { &*response.state }.inner.lock().unwrap().completed {
            return Ok(());
        }
        if started.elapsed() > Duration::from_secs(timeout_seconds) {
            return Err(Error::from_reason(
                "Steam matchmaking server rules query timed out",
            ));
        }
        tokio::time::sleep(Duration::from_millis(16)).await;
    }
}

fn matchmaking_server_item(item: *mut sys::gameserveritem_t) -> Option<MatchmakingServerItem> {
    if item.is_null() {
        return None;
    }
    let mut net_addr = unsafe { ptr::addr_of!((*item).m_NetAdr).read_unaligned() };
    Some(MatchmakingServerItem {
        address: matchmaking_server_address(&mut net_addr),
        ping: unsafe { ptr::addr_of!((*item).m_nPing).read_unaligned() },
        had_successful_response: unsafe {
            ptr::addr_of!((*item).m_bHadSuccessfulResponse).read_unaligned()
        },
        do_not_refresh: unsafe { ptr::addr_of!((*item).m_bDoNotRefresh).read_unaligned() },
        game_dir: unsafe { c_buf_to_string(&*ptr::addr_of!((*item).m_szGameDir)) },
        map: unsafe { c_buf_to_string(&*ptr::addr_of!((*item).m_szMap)) },
        game_description: unsafe { c_buf_to_string(&*ptr::addr_of!((*item).m_szGameDescription)) },
        app_id: unsafe { ptr::addr_of!((*item).m_nAppID).read_unaligned() },
        players: unsafe { ptr::addr_of!((*item).m_nPlayers).read_unaligned() },
        max_players: unsafe { ptr::addr_of!((*item).m_nMaxPlayers).read_unaligned() },
        bot_players: unsafe { ptr::addr_of!((*item).m_nBotPlayers).read_unaligned() },
        password: unsafe { ptr::addr_of!((*item).m_bPassword).read_unaligned() },
        secure: unsafe { ptr::addr_of!((*item).m_bSecure).read_unaligned() },
        time_last_played: unsafe { ptr::addr_of!((*item).m_ulTimeLastPlayed).read_unaligned() },
        server_version: unsafe { ptr::addr_of!((*item).m_nServerVersion).read_unaligned() },
        name: string_from_ptr(unsafe { sys::SteamAPI_gameserveritem_t_GetName(item) }),
        game_tags: unsafe { c_buf_to_string(&*ptr::addr_of!((*item).m_szGameTags)) },
        steam_id: csteam_id_to_player(unsafe { ptr::addr_of!((*item).m_steamID).read_unaligned() }),
    })
}

fn empty_matchmaking_server_address_raw() -> sys::servernetadr_t {
    let mut address = unsafe { MaybeUninit::<sys::servernetadr_t>::zeroed().assume_init() };
    unsafe { sys::SteamAPI_servernetadr_t_Construct(&mut address) };
    address
}

fn matchmaking_server_address_raw(
    ip: u32,
    query_port: u32,
    connection_port: u32,
) -> Result<sys::servernetadr_t, Error> {
    let mut address = empty_matchmaking_server_address_raw();
    let query_port = port_to_u16(query_port, "query port")?;
    let connection_port = port_to_u16(connection_port, "connection port")?;
    unsafe {
        sys::SteamAPI_servernetadr_t_Init(&mut address, ip, query_port, connection_port);
        sys::SteamAPI_servernetadr_t_SetIP(&mut address, ip);
        sys::SteamAPI_servernetadr_t_SetQueryPort(&mut address, query_port);
        sys::SteamAPI_servernetadr_t_SetConnectionPort(&mut address, connection_port);
    }
    Ok(address)
}

fn matchmaking_server_address(address: &mut sys::servernetadr_t) -> MatchmakingServerAddress {
    let ip = unsafe { sys::SteamAPI_servernetadr_t_GetIP(address) };
    MatchmakingServerAddress {
        ip,
        ip_address: ipv4_to_string(ip),
        connection_port: u32::from(unsafe {
            sys::SteamAPI_servernetadr_t_GetConnectionPort(address)
        }),
        query_port: u32::from(unsafe { sys::SteamAPI_servernetadr_t_GetQueryPort(address) }),
        connection_address: string_from_ptr(unsafe {
            sys::SteamAPI_servernetadr_t_GetConnectionAddressString(address)
        }),
        query_address: string_from_ptr(unsafe {
            sys::SteamAPI_servernetadr_t_GetQueryAddressString(address)
        }),
    }
}

fn matchmaking_server_filter_pair(
    key: String,
    value: String,
) -> Result<sys::MatchMakingKeyValuePair_t, Error> {
    let mut filter =
        unsafe { MaybeUninit::<sys::MatchMakingKeyValuePair_t>::zeroed().assume_init() };
    unsafe { sys::SteamAPI_MatchMakingKeyValuePair_t_Construct(&mut filter) };
    unsafe {
        write_c_char_buffer(
            &mut *ptr::addr_of_mut!(filter.m_szKey),
            &key,
            "matchmaking server filter key",
        )?;
        write_c_char_buffer(
            &mut *ptr::addr_of_mut!(filter.m_szValue),
            &value,
            "matchmaking server filter value",
        )?;
    }
    Ok(filter)
}

fn write_c_char_buffer(buf: &mut [c_char], value: &str, label: &str) -> Result<(), Error> {
    let value = cstring(value.to_string(), label)?;
    let bytes = value.as_bytes_with_nul();
    if bytes.len() > buf.len() {
        return Err(Error::from_reason(format!(
            "{label} must be shorter than {} bytes",
            buf.len()
        )));
    }
    for (slot, byte) in buf.iter_mut().zip(bytes.iter().copied()) {
        *slot = byte as c_char;
    }
    Ok(())
}

unsafe extern "C" fn matchmaking_server_list_responded(
    response: *mut MatchmakingServerListResponseRaw,
    request: sys::HServerListRequest,
    server: std::os::raw::c_int,
) {
    if response.is_null() || (*response).state.is_null() {
        return;
    }
    let mut inner = (&*(*response).state).inner.lock().unwrap();
    let request = request as usize;
    if inner.request == 0 || inner.request == request {
        inner.responded.push(server);
    }
}

unsafe extern "C" fn matchmaking_server_list_failed_to_respond(
    response: *mut MatchmakingServerListResponseRaw,
    request: sys::HServerListRequest,
    server: std::os::raw::c_int,
) {
    if response.is_null() || (*response).state.is_null() {
        return;
    }
    let mut inner = (&*(*response).state).inner.lock().unwrap();
    let request = request as usize;
    if inner.request == 0 || inner.request == request {
        inner.failed.push(server);
    }
}

unsafe extern "C" fn matchmaking_server_list_refresh_complete(
    response: *mut MatchmakingServerListResponseRaw,
    request: sys::HServerListRequest,
    server_response: sys::EMatchMakingServerResponse,
) {
    if response.is_null() || (*response).state.is_null() {
        return;
    }
    let mut inner = (&*(*response).state).inner.lock().unwrap();
    let request = request as usize;
    if inner.request == 0 || inner.request == request {
        inner.request = request;
        inner.response = server_response as u32;
        inner.completed = true;
        inner.cancelled = false;
    }
}

unsafe extern "C" fn matchmaking_ping_responded(
    response: *mut MatchmakingPingResponseRaw,
    server: *mut sys::gameserveritem_t,
) {
    if response.is_null() || (*response).state.is_null() {
        return;
    }
    let mut inner = (&*(*response).state).inner.lock().unwrap();
    inner.server = matchmaking_server_item(server);
    inner.responded = inner.server.is_some();
    inner.completed = true;
}

unsafe extern "C" fn matchmaking_ping_failed_to_respond(response: *mut MatchmakingPingResponseRaw) {
    if response.is_null() || (*response).state.is_null() {
        return;
    }
    let mut inner = (&*(*response).state).inner.lock().unwrap();
    inner.responded = false;
    inner.completed = true;
}

unsafe extern "C" fn matchmaking_players_add_player(
    response: *mut MatchmakingPlayersResponseRaw,
    name: *const c_char,
    score: std::os::raw::c_int,
    time_played: f32,
) {
    if response.is_null() || (*response).state.is_null() {
        return;
    }
    let mut inner = (&*(*response).state).inner.lock().unwrap();
    inner.responded = true;
    inner.players.push(MatchmakingServerPlayer {
        name: string_from_ptr(name),
        score,
        time_played: f64::from(time_played),
    });
}

unsafe extern "C" fn matchmaking_players_failed_to_respond(
    response: *mut MatchmakingPlayersResponseRaw,
) {
    if response.is_null() || (*response).state.is_null() {
        return;
    }
    let mut inner = (&*(*response).state).inner.lock().unwrap();
    inner.responded = false;
    inner.completed = true;
}

unsafe extern "C" fn matchmaking_players_refresh_complete(
    response: *mut MatchmakingPlayersResponseRaw,
) {
    if response.is_null() || (*response).state.is_null() {
        return;
    }
    let mut inner = (&*(*response).state).inner.lock().unwrap();
    inner.responded = true;
    inner.completed = true;
}

unsafe extern "C" fn matchmaking_rules_responded(
    response: *mut MatchmakingRulesResponseRaw,
    rule: *const c_char,
    value: *const c_char,
) {
    if response.is_null() || (*response).state.is_null() {
        return;
    }
    let mut inner = (&*(*response).state).inner.lock().unwrap();
    inner.responded = true;
    inner.rules.push(MatchmakingServerRule {
        name: string_from_ptr(rule),
        value: string_from_ptr(value),
    });
}

unsafe extern "C" fn matchmaking_rules_failed_to_respond(
    response: *mut MatchmakingRulesResponseRaw,
) {
    if response.is_null() || (*response).state.is_null() {
        return;
    }
    let mut inner = (&*(*response).state).inner.lock().unwrap();
    inner.responded = false;
    inner.completed = true;
}

unsafe extern "C" fn matchmaking_rules_refresh_complete(
    response: *mut MatchmakingRulesResponseRaw,
) {
    if response.is_null() || (*response).state.is_null() {
        return;
    }
    let mut inner = (&*(*response).state).inner.lock().unwrap();
    inner.responded = true;
    inner.completed = true;
}

fn lobby_type_from_u32(value: u32) -> Result<sys::ELobbyType, Error> {
    match value {
        0 => Ok(sys::ELobbyType::k_ELobbyTypePrivate),
        1 => Ok(sys::ELobbyType::k_ELobbyTypeFriendsOnly),
        2 => Ok(sys::ELobbyType::k_ELobbyTypePublic),
        3 => Ok(sys::ELobbyType::k_ELobbyTypeInvisible),
        4 => Ok(sys::ELobbyType::k_ELobbyTypePrivateUnique),
        _ => Err(Error::from_reason("invalid lobby type")),
    }
}

fn lobby_comparison_from_i32(value: i32) -> Result<sys::ELobbyComparison, Error> {
    match value {
        -2 => Ok(sys::ELobbyComparison::k_ELobbyComparisonEqualToOrLessThan),
        -1 => Ok(sys::ELobbyComparison::k_ELobbyComparisonLessThan),
        0 => Ok(sys::ELobbyComparison::k_ELobbyComparisonEqual),
        1 => Ok(sys::ELobbyComparison::k_ELobbyComparisonGreaterThan),
        2 => Ok(sys::ELobbyComparison::k_ELobbyComparisonEqualToOrGreaterThan),
        3 => Ok(sys::ELobbyComparison::k_ELobbyComparisonNotEqual),
        _ => Err(Error::from_reason("invalid lobby comparison")),
    }
}

fn lobby_distance_filter_from_u32(value: u32) -> Result<sys::ELobbyDistanceFilter, Error> {
    match value {
        0 => Ok(sys::ELobbyDistanceFilter::k_ELobbyDistanceFilterClose),
        1 => Ok(sys::ELobbyDistanceFilter::k_ELobbyDistanceFilterDefault),
        2 => Ok(sys::ELobbyDistanceFilter::k_ELobbyDistanceFilterFar),
        3 => Ok(sys::ELobbyDistanceFilter::k_ELobbyDistanceFilterWorldwide),
        _ => Err(Error::from_reason("invalid lobby distance filter")),
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

fn ugc_read_action_from_u32(value: u32) -> Result<sys::EUGCReadAction, Error> {
    Ok(match value {
        0 => sys::EUGCReadAction::k_EUGCRead_ContinueReadingUntilFinished,
        1 => sys::EUGCReadAction::k_EUGCRead_ContinueReading,
        2 => sys::EUGCReadAction::k_EUGCRead_Close,
        _ => return Err(Error::from_reason("invalid UGC read action")),
    })
}

fn remote_storage_visibility_from_u32(
    value: u32,
) -> Result<sys::ERemoteStoragePublishedFileVisibility, Error> {
    Ok(match value {
        0 => sys::ERemoteStoragePublishedFileVisibility::k_ERemoteStoragePublishedFileVisibilityPublic,
        1 => sys::ERemoteStoragePublishedFileVisibility::k_ERemoteStoragePublishedFileVisibilityFriendsOnly,
        2 => sys::ERemoteStoragePublishedFileVisibility::k_ERemoteStoragePublishedFileVisibilityPrivate,
        3 => sys::ERemoteStoragePublishedFileVisibility::k_ERemoteStoragePublishedFileVisibilityUnlisted,
        _ => return Err(Error::from_reason("invalid published file visibility")),
    })
}

fn account_type_from_u32(value: u32) -> Result<sys::EAccountType, Error> {
    Ok(match value {
        0 => sys::EAccountType::k_EAccountTypeInvalid,
        1 => sys::EAccountType::k_EAccountTypeIndividual,
        2 => sys::EAccountType::k_EAccountTypeMultiseat,
        3 => sys::EAccountType::k_EAccountTypeGameServer,
        4 => sys::EAccountType::k_EAccountTypeAnonGameServer,
        5 => sys::EAccountType::k_EAccountTypePending,
        6 => sys::EAccountType::k_EAccountTypeContentServer,
        7 => sys::EAccountType::k_EAccountTypeClan,
        8 => sys::EAccountType::k_EAccountTypeChat,
        9 => sys::EAccountType::k_EAccountTypeConsoleUser,
        10 => sys::EAccountType::k_EAccountTypeAnonUser,
        11 => sys::EAccountType::k_EAccountTypeMax,
        _ => return Err(Error::from_reason("invalid Steam account type")),
    })
}

fn workshop_file_type_from_u32(value: u32) -> Result<sys::EWorkshopFileType, Error> {
    Ok(match value {
        0 => sys::EWorkshopFileType::k_EWorkshopFileTypeFirst,
        1 => sys::EWorkshopFileType::k_EWorkshopFileTypeMicrotransaction,
        2 => sys::EWorkshopFileType::k_EWorkshopFileTypeCollection,
        3 => sys::EWorkshopFileType::k_EWorkshopFileTypeArt,
        4 => sys::EWorkshopFileType::k_EWorkshopFileTypeVideo,
        5 => sys::EWorkshopFileType::k_EWorkshopFileTypeScreenshot,
        6 => sys::EWorkshopFileType::k_EWorkshopFileTypeGame,
        7 => sys::EWorkshopFileType::k_EWorkshopFileTypeSoftware,
        8 => sys::EWorkshopFileType::k_EWorkshopFileTypeConcept,
        9 => sys::EWorkshopFileType::k_EWorkshopFileTypeWebGuide,
        10 => sys::EWorkshopFileType::k_EWorkshopFileTypeIntegratedGuide,
        11 => sys::EWorkshopFileType::k_EWorkshopFileTypeMerch,
        12 => sys::EWorkshopFileType::k_EWorkshopFileTypeControllerBinding,
        13 => sys::EWorkshopFileType::k_EWorkshopFileTypeSteamworksAccessInvite,
        14 => sys::EWorkshopFileType::k_EWorkshopFileTypeSteamVideo,
        15 => sys::EWorkshopFileType::k_EWorkshopFileTypeGameManagedItem,
        16 => sys::EWorkshopFileType::k_EWorkshopFileTypeClip,
        _ => return Err(Error::from_reason("invalid workshop file type")),
    })
}

fn workshop_video_provider_from_u32(value: u32) -> Result<sys::EWorkshopVideoProvider, Error> {
    Ok(match value {
        0 => sys::EWorkshopVideoProvider::k_EWorkshopVideoProviderNone,
        1 => sys::EWorkshopVideoProvider::k_EWorkshopVideoProviderYoutube,
        _ => return Err(Error::from_reason("invalid workshop video provider")),
    })
}

fn workshop_file_action_from_u32(value: u32) -> Result<sys::EWorkshopFileAction, Error> {
    Ok(match value {
        0 => sys::EWorkshopFileAction::k_EWorkshopFileActionPlayed,
        1 => sys::EWorkshopFileAction::k_EWorkshopFileActionCompleted,
        _ => return Err(Error::from_reason("invalid workshop file action")),
    })
}

fn workshop_enumeration_type_from_u32(value: u32) -> Result<sys::EWorkshopEnumerationType, Error> {
    Ok(match value {
        0 => sys::EWorkshopEnumerationType::k_EWorkshopEnumerationTypeRankedByVote,
        1 => sys::EWorkshopEnumerationType::k_EWorkshopEnumerationTypeRecent,
        2 => sys::EWorkshopEnumerationType::k_EWorkshopEnumerationTypeTrending,
        3 => sys::EWorkshopEnumerationType::k_EWorkshopEnumerationTypeFavoritesOfFriends,
        4 => sys::EWorkshopEnumerationType::k_EWorkshopEnumerationTypeVotedByFriends,
        5 => sys::EWorkshopEnumerationType::k_EWorkshopEnumerationTypeContentByFriends,
        6 => sys::EWorkshopEnumerationType::k_EWorkshopEnumerationTypeRecentFromFollowedUsers,
        _ => return Err(Error::from_reason("invalid workshop enumeration type")),
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

fn item_preview_type_from_u32(value: u32) -> Result<sys::EItemPreviewType, Error> {
    Ok(match value {
        0 => sys::EItemPreviewType::k_EItemPreviewType_Image,
        1 => sys::EItemPreviewType::k_EItemPreviewType_YouTubeVideo,
        2 => sys::EItemPreviewType::k_EItemPreviewType_Sketchfab,
        3 => sys::EItemPreviewType::k_EItemPreviewType_EnvironmentMap_HorizontalCross,
        4 => sys::EItemPreviewType::k_EItemPreviewType_EnvironmentMap_LatLong,
        5 => sys::EItemPreviewType::k_EItemPreviewType_Clip,
        255 => sys::EItemPreviewType::k_EItemPreviewType_ReservedMax,
        _ => return Err(Error::from_reason("invalid item preview type")),
    })
}

fn ugc_content_descriptor_from_u32(value: u32) -> Result<sys::EUGCContentDescriptorID, Error> {
    Ok(match value {
        1 => sys::EUGCContentDescriptorID::k_EUGCContentDescriptor_NudityOrSexualContent,
        2 => sys::EUGCContentDescriptorID::k_EUGCContentDescriptor_FrequentViolenceOrGore,
        3 => sys::EUGCContentDescriptorID::k_EUGCContentDescriptor_AdultOnlySexualContent,
        4 => sys::EUGCContentDescriptorID::k_EUGCContentDescriptor_GratuitousSexualContent,
        5 => sys::EUGCContentDescriptorID::k_EUGCContentDescriptor_AnyMatureContent,
        _ => return Err(Error::from_reason("invalid UGC content descriptor")),
    })
}

fn value_u32(data: &Value, key: &str, label: &str) -> Result<u32, Error> {
    let value = data
        .get(key)
        .and_then(Value::as_u64)
        .ok_or_else(|| Error::from_reason(format!("{label} is required")))?;
    u32::try_from(value).map_err(|_| Error::from_reason(format!("{label} is too large")))
}

fn string_pairs_from_value(value: &Value, label: &str) -> Result<Vec<(String, String)>, Error> {
    match value {
        Value::Object(map) => map
            .iter()
            .map(|(key, value)| {
                let Some(value) = value.as_str() else {
                    return Err(Error::from_reason(format!(
                        "{label} value must be a string"
                    )));
                };
                Ok((key.clone(), value.to_owned()))
            })
            .collect(),
        Value::Array(values) => values
            .iter()
            .map(|value| {
                let Some(key) = value.get("key").and_then(Value::as_str) else {
                    return Err(Error::from_reason(format!("{label} key is required")));
                };
                let Some(value) = value.get("value").and_then(Value::as_str) else {
                    return Err(Error::from_reason(format!("{label} value is required")));
                };
                Ok((key.to_owned(), value.to_owned()))
            })
            .collect(),
        _ => Err(Error::from_reason(format!(
            "{label} must be an object or array"
        ))),
    }
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
    if let Some(value) = config.get("includeKeyValueTags").and_then(Value::as_bool) {
        unsafe { sys::SteamAPI_ISteamUGC_SetReturnKeyValueTags(ugc, handle, value) };
    }
    if let Some(value) = config.get("includeChildren").and_then(Value::as_bool) {
        unsafe { sys::SteamAPI_ISteamUGC_SetReturnChildren(ugc, handle, value) };
    }
    if let Some(value) = config.get("onlyIds").and_then(Value::as_bool) {
        unsafe { sys::SteamAPI_ISteamUGC_SetReturnOnlyIDs(ugc, handle, value) };
    }
    if let Some(value) = config.get("onlyTotal").and_then(Value::as_bool) {
        unsafe { sys::SteamAPI_ISteamUGC_SetReturnTotalOnly(ugc, handle, value) };
    }
    if let Some(value) = config.get("playtimeStatsDays").and_then(Value::as_u64) {
        unsafe { sys::SteamAPI_ISteamUGC_SetReturnPlaytimeStats(ugc, handle, value as u32) };
    }
    if let Some(value) = config.get("admin").and_then(Value::as_bool) {
        unsafe { sys::SteamAPI_ISteamUGC_SetAdminQuery(ugc, handle, value) };
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
    if let Some(name) = config.get("cloudFileName").and_then(Value::as_str) {
        let name = CString::new(name)
            .map_err(|_| Error::from_reason("query cloud file name contains a NUL byte"))?;
        unsafe { sys::SteamAPI_ISteamUGC_SetCloudFileNameFilter(ugc, handle, name.as_ptr()) };
    }
    if let Some(tags) = config.get("requiredTags").and_then(Value::as_array) {
        for tag in tags.iter().filter_map(Value::as_str) {
            let tag = CString::new(tag)
                .map_err(|_| Error::from_reason("required tag contains a NUL byte"))?;
            unsafe { sys::SteamAPI_ISteamUGC_AddRequiredTag(ugc, handle, tag.as_ptr()) };
        }
    }
    if let Some(groups) = config.get("requiredTagGroups").and_then(Value::as_array) {
        for group in groups {
            let Some(tags) = group.as_array() else {
                return Err(Error::from_reason("required tag group must be an array"));
            };
            let tag_strings: Vec<CString> = tags
                .iter()
                .filter_map(Value::as_str)
                .map(|tag| {
                    CString::new(tag)
                        .map_err(|_| Error::from_reason("required tag group contains a NUL byte"))
                })
                .collect::<Result<_, _>>()?;
            let mut pointers: Vec<*const c_char> =
                tag_strings.iter().map(|tag| tag.as_ptr()).collect();
            let tag_array = sys::SteamParamStringArray_t {
                m_ppStrings: pointers.as_mut_ptr(),
                m_nNumStrings: len_to_i32(pointers.len(), "required tag group")?,
            };
            unsafe { sys::SteamAPI_ISteamUGC_AddRequiredTagGroup(ugc, handle, &tag_array) };
        }
    }
    if let Some(tags) = config.get("excludedTags").and_then(Value::as_array) {
        for tag in tags.iter().filter_map(Value::as_str) {
            let tag = CString::new(tag)
                .map_err(|_| Error::from_reason("excluded tag contains a NUL byte"))?;
            unsafe { sys::SteamAPI_ISteamUGC_AddExcludedTag(ugc, handle, tag.as_ptr()) };
        }
    }
    if let Some(tags) = config.get("requiredKeyValueTags") {
        for (key, value) in string_pairs_from_value(tags, "required key-value tag")? {
            let key = CString::new(key).map_err(|_| {
                Error::from_reason("required key-value tag key contains a NUL byte")
            })?;
            let value = CString::new(value).map_err(|_| {
                Error::from_reason("required key-value tag value contains a NUL byte")
            })?;
            unsafe {
                sys::SteamAPI_ISteamUGC_AddRequiredKeyValueTag(
                    ugc,
                    handle,
                    key.as_ptr(),
                    value.as_ptr(),
                )
            };
        }
    }
    let created_after = config
        .get("createdAfter")
        .or_else(|| config.get("timeCreatedStart"))
        .and_then(Value::as_u64);
    let created_before = config
        .get("createdBefore")
        .or_else(|| config.get("timeCreatedEnd"))
        .and_then(Value::as_u64);
    if created_after.is_some() || created_before.is_some() {
        unsafe {
            sys::SteamAPI_ISteamUGC_SetTimeCreatedDateRange(
                ugc,
                handle,
                created_after.unwrap_or(0) as u32,
                created_before.unwrap_or(u32::MAX as u64) as u32,
            )
        };
    }
    let updated_after = config
        .get("updatedAfter")
        .or_else(|| config.get("timeUpdatedStart"))
        .and_then(Value::as_u64);
    let updated_before = config
        .get("updatedBefore")
        .or_else(|| config.get("timeUpdatedEnd"))
        .and_then(Value::as_u64);
    if updated_after.is_some() || updated_before.is_some() {
        unsafe {
            sys::SteamAPI_ISteamUGC_SetTimeUpdatedDateRange(
                ugc,
                handle,
                updated_after.unwrap_or(0) as u32,
                updated_before.unwrap_or(u32::MAX as u64) as u32,
            )
        };
    }
    Ok(())
}

fn collect_query_items(
    ugc: *mut sys::ISteamUGC,
    handle: sys::UGCQueryHandle_t,
    result: &sys::SteamUGCQueryCompleted_t,
    query_config: Option<&Value>,
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
    let next_cursor = unsafe {
        let cursor = ptr::addr_of!(result.m_rgchNextCursor).read_unaligned();
        c_buf_to_string(&cursor)
    };
    let mut items = Vec::new();
    for index in 0..returned {
        let mut details = unsafe { MaybeUninit::<sys::SteamUGCDetails_t>::zeroed().assume_init() };
        let ok =
            unsafe { sys::SteamAPI_ISteamUGC_GetQueryUGCResult(ugc, handle, index, &mut details) };
        if ok {
            items.push(Some(workshop_item_from_details(
                ugc,
                handle,
                index,
                &details,
                query_config,
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
        next_cursor,
    })
}

fn workshop_item_from_details(
    ugc: *mut sys::ISteamUGC,
    handle: sys::UGCQueryHandle_t,
    index: u32,
    details: &sys::SteamUGCDetails_t,
    query_config: Option<&Value>,
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
    let tag_details = query_tag_details(ugc, handle, index);
    let metadata = query_metadata(ugc, handle, index);
    let children = query_children(ugc, handle, index, unsafe {
        ptr::addr_of!(details.m_unNumChildren).read_unaligned()
    });
    let additional_previews = query_additional_previews(ugc, handle, index);
    let key_value_tags = query_key_value_tags(ugc, handle, index);
    let first_key_value_tags = query_first_key_value_tags(ugc, handle, index, query_config)?;
    let supported_game_versions = query_supported_game_versions(ugc, handle, index);
    let content_descriptors = query_content_descriptors(ugc, handle, index);
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
        tag_details,
        tags_truncated: unsafe { ptr::addr_of!(details.m_bTagsTruncated).read_unaligned() },
        metadata,
        children,
        additional_previews,
        key_value_tags,
        first_key_value_tags,
        supported_game_versions,
        content_descriptors,
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

fn query_tag_details(
    ugc: *mut sys::ISteamUGC,
    handle: sys::UGCQueryHandle_t,
    index: u32,
) -> Vec<WorkshopItemTag> {
    let count = unsafe { sys::SteamAPI_ISteamUGC_GetQueryUGCNumTags(ugc, handle, index) };
    let mut tags = Vec::new();
    for tag_index in 0..count.min(256) {
        let mut name = vec![0i8; 256];
        let ok = unsafe {
            sys::SteamAPI_ISteamUGC_GetQueryUGCTag(
                ugc,
                handle,
                index,
                tag_index,
                name.as_mut_ptr(),
                name.len() as u32,
            )
        };
        if !ok {
            continue;
        }
        let mut display_name = vec![0i8; 256];
        let display_ok = unsafe {
            sys::SteamAPI_ISteamUGC_GetQueryUGCTagDisplayName(
                ugc,
                handle,
                index,
                tag_index,
                display_name.as_mut_ptr(),
                display_name.len() as u32,
            )
        };
        let display_name = display_ok
            .then(|| c_buf_to_string(&display_name))
            .filter(|value| !value.is_empty());
        tags.push(WorkshopItemTag {
            name: c_buf_to_string(&name),
            display_name,
        });
    }
    tags
}

fn query_metadata(
    ugc: *mut sys::ISteamUGC,
    handle: sys::UGCQueryHandle_t,
    index: u32,
) -> Option<String> {
    let mut metadata = vec![0i8; 5000];
    let ok = unsafe {
        sys::SteamAPI_ISteamUGC_GetQueryUGCMetadata(
            ugc,
            handle,
            index,
            metadata.as_mut_ptr(),
            metadata.len() as u32,
        )
    };
    ok.then(|| c_buf_to_string(&metadata))
        .filter(|value| !value.is_empty())
}

fn query_children(
    ugc: *mut sys::ISteamUGC,
    handle: sys::UGCQueryHandle_t,
    index: u32,
    count: u32,
) -> Vec<BigInt> {
    if count == 0 {
        return Vec::new();
    }
    let count = count.min(4096);
    let mut children = vec![0u64; count as usize];
    let ok = unsafe {
        sys::SteamAPI_ISteamUGC_GetQueryUGCChildren(
            ugc,
            handle,
            index,
            children.as_mut_ptr(),
            count,
        )
    };
    if ok {
        children.into_iter().map(Into::into).collect()
    } else {
        Vec::new()
    }
}

fn query_additional_previews(
    ugc: *mut sys::ISteamUGC,
    handle: sys::UGCQueryHandle_t,
    index: u32,
) -> Vec<WorkshopItemAdditionalPreview> {
    let count =
        unsafe { sys::SteamAPI_ISteamUGC_GetQueryUGCNumAdditionalPreviews(ugc, handle, index) };
    let mut previews = Vec::new();
    for preview_index in 0..count.min(64) {
        let mut url_or_video_id = vec![0i8; 1024];
        let mut original_file_name = vec![0i8; 260];
        let mut preview_type = sys::EItemPreviewType::k_EItemPreviewType_Image;
        let ok = unsafe {
            sys::SteamAPI_ISteamUGC_GetQueryUGCAdditionalPreview(
                ugc,
                handle,
                index,
                preview_index,
                url_or_video_id.as_mut_ptr(),
                url_or_video_id.len() as u32,
                original_file_name.as_mut_ptr(),
                original_file_name.len() as u32,
                &mut preview_type,
            )
        };
        if ok {
            previews.push(WorkshopItemAdditionalPreview {
                url_or_video_id: c_buf_to_string(&url_or_video_id),
                original_file_name: c_buf_to_string(&original_file_name),
                preview_type: preview_type as u32,
            });
        }
    }
    previews
}

fn query_key_value_tags(
    ugc: *mut sys::ISteamUGC,
    handle: sys::UGCQueryHandle_t,
    index: u32,
) -> Vec<WorkshopItemKeyValueTag> {
    let count = unsafe { sys::SteamAPI_ISteamUGC_GetQueryUGCNumKeyValueTags(ugc, handle, index) };
    let mut tags = Vec::new();
    for tag_index in 0..count.min(256) {
        let mut key = vec![0i8; 256];
        let mut value = vec![0i8; 1024];
        let ok = unsafe {
            sys::SteamAPI_ISteamUGC_GetQueryUGCKeyValueTag(
                ugc,
                handle,
                index,
                tag_index,
                key.as_mut_ptr(),
                key.len() as u32,
                value.as_mut_ptr(),
                value.len() as u32,
            )
        };
        if ok {
            tags.push(WorkshopItemKeyValueTag {
                key: c_buf_to_string(&key),
                value: c_buf_to_string(&value),
            });
        }
    }
    tags
}

fn query_first_key_value_tags(
    ugc: *mut sys::ISteamUGC,
    handle: sys::UGCQueryHandle_t,
    index: u32,
    query_config: Option<&Value>,
) -> Result<Vec<WorkshopItemKeyValueTag>, Error> {
    let Some(keys) = query_config
        .and_then(|config| config.get("firstKeyValueTagKeys"))
        .and_then(Value::as_array)
    else {
        return Ok(Vec::new());
    };
    let mut tags = Vec::new();
    for key in keys.iter().filter_map(Value::as_str) {
        let key_c = CString::new(key)
            .map_err(|_| Error::from_reason("first key-value tag key contains a NUL byte"))?;
        let mut value = vec![0i8; 1024];
        let ok = unsafe {
            sys::SteamAPI_ISteamUGC_GetQueryFirstUGCKeyValueTag(
                ugc,
                handle,
                index,
                key_c.as_ptr(),
                value.as_mut_ptr(),
                value.len() as u32,
            )
        };
        if ok {
            tags.push(WorkshopItemKeyValueTag {
                key: key.to_owned(),
                value: c_buf_to_string(&value),
            });
        }
    }
    Ok(tags)
}

fn query_supported_game_versions(
    ugc: *mut sys::ISteamUGC,
    handle: sys::UGCQueryHandle_t,
    index: u32,
) -> Vec<WorkshopItemSupportedGameVersion> {
    let count = unsafe { sys::SteamAPI_ISteamUGC_GetNumSupportedGameVersions(ugc, handle, index) };
    let mut versions = Vec::new();
    for version_index in 0..count.min(64) {
        let mut game_branch_min = vec![0i8; 256];
        let mut game_branch_max = vec![0i8; 256];
        let ok = unsafe {
            sys::SteamAPI_ISteamUGC_GetSupportedGameVersionData(
                ugc,
                handle,
                index,
                version_index,
                game_branch_min.as_mut_ptr(),
                game_branch_max.as_mut_ptr(),
                game_branch_min.len() as u32,
            )
        };
        if ok {
            versions.push(WorkshopItemSupportedGameVersion {
                game_branch_min: c_buf_to_string(&game_branch_min),
                game_branch_max: c_buf_to_string(&game_branch_max),
            });
        }
    }
    versions
}

fn query_content_descriptors(
    ugc: *mut sys::ISteamUGC,
    handle: sys::UGCQueryHandle_t,
    index: u32,
) -> Vec<u32> {
    let mut descriptors =
        vec![sys::EUGCContentDescriptorID::k_EUGCContentDescriptor_AnyMatureContent; 64];
    let count = unsafe {
        sys::SteamAPI_ISteamUGC_GetQueryUGCContentDescriptors(
            ugc,
            handle,
            index,
            descriptors.as_mut_ptr(),
            descriptors.len() as u32,
        )
    };
    descriptors.truncate((count as usize).min(descriptors.len()));
    descriptors
        .into_iter()
        .map(|descriptor| descriptor as u32)
        .collect()
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
