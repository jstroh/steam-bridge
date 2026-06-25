import {
  electronConfigureSteamOverlay as electronConfigureSteamOverlayImpl,
  electronEnableSteamOverlay as electronEnableSteamOverlayImpl
} from "./electron";
import {
  loadNativeBinding,
  NativeAppBetaCounts,
  NativeAppBetaInfo,
  NativeAppDlcData,
  NativeAppDlcDownloadProgress,
  NativeAppFileDetails,
  NativeAppTimedTrialInfo,
  NativeAuthTicket,
  NativeBinding,
  NativeCallbackHandle,
  NativeClanActivityCounts,
  NativeClanChatJoinResult,
  NativeClanOfficerListResult,
  NativeCloudFileInfo,
  NativeFollowerCountResult,
  NativeFollowingListResult,
  NativeEquippedProfileItemsResult,
  NativeFriendGameInfo,
  NativeFriendMessage,
  NativeFriendsGroupInfo,
  NativeInputControllerInfo,
  NativeIsFollowingResult,
  NativeAchievementProgressLimitsFloat,
  NativeAchievementProgressLimitsInt,
  NativeAchievementUnlockTime,
  NativeGlobalAchievementInfo,
  NativeGlobalAchievementPercentagesReady,
  NativeGlobalStatsReceivedResult,
  NativeHttpRequestCompleted,
  NativeHttpRequestHeadersReceived,
  NativeChangeNumOpenSlotsResult,
  NativeCreateBeaconResult,
  NativeJoinPartyResult,
  NativeInventoryEligiblePromoItemDefIds,
  NativeInventoryInstanceQuantity,
  NativeInventoryItemDetail,
  NativeInventoryItemQuantity,
  NativeInventoryPrice,
  NativeInventoryRequestPricesResult,
  NativeInventoryStartPurchaseResult,
  NativeLeaderboardEntry,
  NativeLeaderboardFindResult,
  NativeLeaderboardScoresDownloaded,
  NativeLeaderboardScoreUploaded,
  NativeLeaderboardUgcSetResult,
  NativeLobbyChatEntry,
  NativeLobbyGameServer,
  NativeMatchmakingFavoriteGame,
  NativeNumberOfCurrentPlayersResult,
  NativeNetworkingAuthenticationStatus,
  NativeNetworkingCertificateResult,
  NativeNetworkingConnectionRealTimeStatus,
  NativeNetworkingConnectionInfo,
  NativeNetworkingFakeIpResult,
  NativeNetworkingFakeIpIdentity,
  NativeNetworkingIdentity,
  NativeNetworkingIdentityInfo,
  NativeNetworkingIpAddress,
  NativeNetworkingIpAddressInfo,
  NativeNetworkingMessage,
  NativeNetworkingMessagesSessionConnectionInfo,
  NativeNetworkingPingDataCenter,
  NativeNetworkingPingLocation,
  NativeNetworkingRemoteFakeIpResult,
  NativeNetworkingRelayNetworkStatus,
  NativeNetworkingSocketPair,
  NativeNetworkingSocketSendResult,
  NativeOverlayDiagnostics,
  NativePartyBeaconDetails,
  NativePartyBeaconLocation,
  NativeP2PPacket,
  NativeRemotePlayInputEvent,
  NativeRemotePlayResolution,
  NativeRemotePlaySessionInfo,
  NativeSteamId,
  NativeTimelineEventRecordingExists,
  NativeTimelineGamePhaseRecordingExists,
  NativeUgcResult,
  NativeUtilsApiCallCompletion,
  NativeUtilsApiCallResult,
  NativeUtilsFilteredText,
  NativeUtilsImageSize,
  NativeUtilsWarningMessage,
  NativeUserStatsReceivedResult,
  NativeVideoBroadcastStatus,
  NativeWorkshopItem,
  NativeWorkshopItemsResult
} from "./native";

export interface InitOptions {
  appId: number;
  callbackIntervalMs?: number;
}

export interface SteamId {
  steamId64: bigint;
  steamId32: string;
  accountId: number;
}

export interface AuthTicket {
  cancel(): void;
  getBytes(): Buffer;
}

export interface CallbackHandle {
  disconnect(): void;
}

export interface MicroTxnAuthorizationResponse {
  appId?: number;
  app_id?: number;
  orderId?: bigint | string | number;
  order_id?: bigint | string | number;
  authorized?: boolean;
  [key: string]: unknown;
}

export interface GameOverlayActivated {
  active?: boolean;
  userInitiated?: boolean;
  user_initiated?: boolean;
  appId?: number;
  app_id?: number;
  overlayPid?: number;
  overlay_pid?: number;
  [key: string]: unknown;
}

export interface FriendGameInfo {
  gameId: bigint;
  gameIp: number;
  gamePort: number;
  queryPort: number;
  lobby: bigint;
}

export interface FriendMessage {
  data: Buffer;
  size: number;
  text: string;
  entryType: number;
}

export interface FriendsGroupInfo {
  id: number;
  name: string;
  members: SteamId[];
}

export interface EquippedProfileItemsResult {
  result: number;
  steamId: SteamId;
  hasAnimatedAvatar: boolean;
  hasAvatarFrame: boolean;
  hasProfileModifier: boolean;
  hasProfileBackground: boolean;
  hasMiniProfileBackground: boolean;
  fromCache: boolean;
}

export interface ClanActivityCounts {
  online: number;
  inGame: number;
  chatting: number;
}

export interface ClanOfficerListResult {
  clan: SteamId;
  officers: number;
  success: boolean;
}

export interface ClanChatJoinResult {
  clanChat: SteamId;
  response: number;
}

export interface HttpRequestCompleted {
  request: number;
  contextValue: bigint;
  requestSuccessful: boolean;
  statusCode: number;
  bodySize: number;
}

export interface HttpRequestHeadersReceived {
  request: number;
  contextValue: bigint;
}

export interface PartyBeaconLocation {
  locationType: number;
  locationId: bigint;
}

export interface PartyBeaconDetails {
  beacon: bigint;
  owner: SteamId;
  location: PartyBeaconLocation;
  metadata: string;
}

export interface JoinPartyResult {
  result: number;
  beacon: bigint;
  owner: SteamId;
  connectString: string;
}

export interface CreateBeaconResult {
  result: number;
  beacon: bigint;
}

export interface ChangeNumOpenSlotsResult {
  result: number;
}

export interface MatchmakingFavoriteGame {
  appId: number;
  ip: number;
  ipAddress: string;
  connPort: number;
  queryPort: number;
  flags: number;
  lastPlayedOnServer: number;
}

export interface LobbyChatEntry {
  steamId: SteamId;
  data: Buffer;
  size: number;
  text: string;
  entryType: number;
}

export interface LobbyGameServer {
  ip: number;
  ipAddress: string;
  port: number;
  steamId: SteamId;
}

export interface LobbyGameServerOptions {
  ip?: number;
  port?: number;
  steamId64?: bigint;
}

export interface LobbyListStringFilter {
  key: string;
  value: string;
  comparison?: number;
}

export interface LobbyListNumericalFilter {
  key: string;
  value: number;
  comparison?: number;
}

export interface LobbyListNearValueFilter {
  key: string;
  value: number;
}

export interface LobbyListOptions {
  stringFilters?: LobbyListStringFilter[];
  numericalFilters?: LobbyListNumericalFilter[];
  nearValueFilters?: LobbyListNearValueFilter[];
  slotsAvailable?: number;
  distanceFilter?: number;
  resultCount?: number;
  compatibleLobby?: bigint;
}

export interface AppDlcData {
  appId: number;
  available: boolean;
  name: string;
}

export interface AppDlcDownloadProgress {
  bytesDownloaded: bigint;
  bytesTotal: bigint;
}

export interface AppTimedTrialInfo {
  secondsAllowed: number;
  secondsPlayed: number;
}

export interface AppBetaCounts {
  total: number;
  available: number;
  private: number;
}

export interface AppBetaInfo {
  flags: number;
  buildId: number;
  name: string;
  description: string;
  lastUpdated: number;
}

export interface AppFileDetails {
  result: number;
  fileSize: bigint;
  sha: Buffer;
  shaHex: string;
  flags: number;
}

export interface InventoryItemDetail {
  itemId: bigint;
  definition: number;
  quantity: number;
  flags: number;
}

export interface InventoryItemQuantity {
  definition: number;
  quantity: number;
}

export interface InventoryInstanceQuantity {
  itemId: bigint;
  quantity: number;
}

export interface InventoryEligiblePromoItemDefIds {
  result: number;
  steamId: SteamId;
  numEligiblePromoItemDefs: number;
  cachedData: boolean;
}

export interface InventoryStartPurchaseResult {
  result: number;
  orderId: bigint;
  transactionId: bigint;
}

export interface InventoryRequestPricesResult {
  result: number;
  currency: string;
}

export interface InventoryPrice {
  definition: number;
  currentPrice: bigint;
  basePrice: bigint;
}

export interface FollowerCountResult {
  steamId: SteamId;
  result: number;
  count: number;
}

export interface IsFollowingResult {
  steamId: SteamId;
  result: number;
  isFollowing: boolean;
}

export interface FollowingListResult {
  result: number;
  steamIds: SteamId[];
  returnedResults: number;
  totalResults: number;
}

export interface OverlayDiagnostics {
  steamRunning: boolean;
  steamInstallPath?: string;
  appId: number;
  overlayEnabled: boolean;
  overlayNeedsPresent: boolean;
  steamDeck: boolean;
  bigPicture: boolean;
  platform: NodeJS.Platform;
  arch: string;
  pid: number;
}

export interface OverlayWebPageOptions {
  modal?: boolean;
}

export interface UtilsImageSize {
  width: number;
  height: number;
}

export interface UtilsApiCallCompletion {
  completed: boolean;
  failed: boolean;
}

export interface UtilsApiCallResult {
  ok: boolean;
  failed: boolean;
  data: Buffer | null;
}

export interface UtilsWarningMessage {
  severity: number;
  message: string;
}

export interface UtilsFilteredText {
  filtered: string;
  charactersFiltered: number;
}

export interface P2PPacket {
  data: Buffer;
  size: number;
  steamId: SteamId;
}

export interface NetworkingIdentity {
  steamId64?: bigint;
  text?: string;
  genericString?: string;
  localHost?: boolean;
}

export interface NetworkingIdentityInfo {
  identityType: number;
  text: string;
  steamId64: bigint | null;
  genericString: string | null;
  localHost: boolean;
  invalid: boolean;
  fakeIpType: number;
}

export interface NetworkingMessage {
  data: Buffer;
  size: number;
  peer: NetworkingIdentityInfo;
  connection: number;
  connectionUserData: bigint;
  timeReceived: bigint;
  messageNumber: bigint;
  channel: number;
  flags: number;
  userData: bigint;
  lane: number;
}

export interface NetworkingConnectionRealTimeStatus {
  state: number;
  ping: number;
  connectionQualityLocal: number;
  connectionQualityRemote: number;
  outPacketsPerSecond: number;
  outBytesPerSecond: number;
  inPacketsPerSecond: number;
  inBytesPerSecond: number;
  sendRateBytesPerSecond: number;
  pendingUnreliable: number;
  pendingReliable: number;
  sentUnackedReliable: number;
  queueTime: bigint;
  maxJitter: number;
}

export interface NetworkingMessagesSessionConnectionInfo {
  state: number;
  remoteIdentity: NetworkingIdentityInfo;
  userData: bigint;
  listenSocket: number;
  remotePop: number;
  relayPop: number;
  endReason: number;
  endDebug: string;
  connectionDescription: string;
  flags: number;
  quickStatus: NetworkingConnectionRealTimeStatus | null;
}

export interface NetworkingConnectionInfo {
  state: number;
  remoteIdentity: NetworkingIdentityInfo;
  userData: bigint;
  listenSocket: number;
  remoteAddress: NetworkingIpAddressInfo | null;
  remotePop: number;
  relayPop: number;
  endReason: number;
  endDebug: string;
  connectionDescription: string;
  flags: number;
}

export interface NetworkingSocketPair {
  connection1: number;
  connection2: number;
}

export interface NetworkingSocketSendResult {
  result: number;
  messageNumber: bigint;
}

export interface NetworkingFakeIpResult {
  result: number;
  identity: NetworkingIdentityInfo;
  ipv4: number;
  ipv4Address: string;
  ports: number[];
}

export interface NetworkingRemoteFakeIpResult {
  result: number;
  address: NetworkingIpAddressInfo | null;
}

export interface NetworkingCertificateResult {
  success: boolean;
  data: Buffer;
  error: string;
}

export interface NetworkingCloseConnectionOptions {
  reason?: number;
  debug?: string;
  enableLinger?: boolean;
}

export interface NetworkingAuthenticationStatus {
  availability: number;
  debugMessage: string;
}

export interface NetworkingRelayNetworkStatus {
  availability: number;
  pingMeasurementInProgress: boolean;
  networkConfigAvailability: number;
  anyRelayAvailability: number;
  debugMessage: string;
}

export interface NetworkingPingLocation {
  location: string;
  ageSeconds: number;
}

export interface NetworkingPingDataCenter {
  pingMs: number;
  viaRelayPop: number;
}

export interface NetworkingIpAddress {
  text?: string;
  ipv4?: number;
  port?: number;
  localHost?: boolean;
}

export interface NetworkingIpAddressInfo {
  text: string;
  ipv4: number | null;
  port: number;
  ipv4Address: string | null;
  isIpv4: boolean;
  isLocalHost: boolean;
  isFakeIp: boolean;
  fakeIpType: number;
  ipv6AllZeros: boolean;
}

export interface NetworkingFakeIpIdentity {
  result: number;
  identity: NetworkingIdentityInfo | null;
}

export interface VideoBroadcastStatus {
  broadcasting: boolean;
  viewers: number;
}

export interface LeaderboardFindResult {
  leaderboard: bigint;
  found: boolean;
}

export interface LeaderboardEntry {
  steamId: SteamId;
  globalRank: number;
  score: number;
  details: number[];
  ugc: bigint;
}

export interface LeaderboardScoresDownloaded {
  leaderboard: bigint;
  entriesHandle: bigint;
  entryCount: number;
  entries: LeaderboardEntry[];
}

export interface LeaderboardScoreUploaded {
  success: boolean;
  leaderboard: bigint;
  score: number;
  scoreChanged: boolean;
  globalRankNew: number;
  globalRankPrevious: number;
}

export interface LeaderboardUgcSetResult {
  result: number;
  leaderboard: bigint;
}

export interface AchievementUnlockTime {
  achieved: boolean;
  unlockTime: number;
}

export interface UserStatsReceivedResult {
  gameId: bigint;
  result: number;
  steamId: SteamId;
}

export interface NumberOfCurrentPlayersResult {
  success: boolean;
  players: number;
}

export interface GlobalAchievementPercentagesReady {
  gameId: bigint;
  result: number;
}

export interface GlobalStatsReceivedResult {
  gameId: bigint;
  result: number;
}

export interface GlobalAchievementInfo {
  iterator: number;
  name: string;
  percent: number;
  achieved: boolean;
}

export interface AchievementProgressLimitsInt {
  min: number;
  max: number;
}

export interface AchievementProgressLimitsFloat {
  min: number;
  max: number;
}

export interface TimelineEventRecordingExists {
  event: bigint;
  recordingExists: boolean;
}

export interface TimelineGamePhaseRecordingExists {
  phaseId: string;
  recordingMs: bigint;
  longestClipMs: bigint;
  clipCount: number;
  screenshotCount: number;
}

export interface RemotePlayResolution {
  width: number;
  height: number;
}

export interface RemotePlaySessionInfo {
  id: number;
  remotePlayTogether: boolean;
  steamId: SteamId;
  guestId: number;
  smallAvatar: number;
  mediumAvatar: number;
  largeAvatar: number;
  clientName: string;
  clientFormFactor: number;
  resolution: RemotePlayResolution | null;
}

export interface RemotePlayInputEvent {
  sessionId: number;
  inputType: number;
  absolute?: boolean | null;
  normalizedX?: number | null;
  normalizedY?: number | null;
  deltaX?: number | null;
  deltaY?: number | null;
  mouseButton?: number | null;
  wheelDirection?: number | null;
  wheelAmount?: number | null;
  scancode?: number | null;
  modifiers?: number | null;
  keycode?: number | null;
}

export interface AnalogActionVector {
  x: number;
  y: number;
}

export interface UgcResult {
  itemId: bigint;
  needsToAcceptAgreement: boolean;
}

export interface UgcUpdate {
  title?: string;
  description?: string;
  changeNote?: string;
  previewPath?: string;
  contentPath?: string;
  tags?: string[];
  visibility?: number;
}

export interface InstallInfo {
  folder: string;
  sizeOnDisk: bigint;
  timestamp: number;
}

export interface DownloadInfo {
  current: bigint;
  total: bigint;
}

export interface UpdateProgress {
  status: number;
  progress: bigint;
  total: bigint;
}

export interface WorkshopItemStatistic {
  numSubscriptions?: bigint;
  numFavorites?: bigint;
  numFollowers?: bigint;
  numUniqueSubscriptions?: bigint;
  numUniqueFavorites?: bigint;
  numUniqueFollowers?: bigint;
  numUniqueWebsiteViews?: bigint;
  reportScore?: bigint;
  numSecondsPlayed?: bigint;
  numPlaytimeSessions?: bigint;
  numComments?: bigint;
  numSecondsPlayedDuringTimePeriod?: bigint;
  numPlaytimeSessionsDuringTimePeriod?: bigint;
}

export interface WorkshopItem {
  publishedFileId: bigint;
  creatorAppId?: number;
  consumerAppId?: number;
  title: string;
  description: string;
  owner: SteamId;
  timeCreated: number;
  timeUpdated: number;
  timeAddedToUserList: number;
  visibility: number;
  banned: boolean;
  acceptedForUse: boolean;
  tags: string[];
  tagsTruncated: boolean;
  url: string;
  numUpvotes: number;
  numDownvotes: number;
  numChildren: number;
  previewUrl?: string;
  statistics: WorkshopItemStatistic;
}

export interface WorkshopPaginatedResult {
  items: Array<WorkshopItem | null | undefined>;
  returnedResults: number;
  totalResults: number;
  wasCached: boolean;
}

export interface WorkshopItemsResult {
  items: Array<WorkshopItem | null | undefined>;
  wasCached: boolean;
}

export interface WorkshopItemQueryConfig {
  cachedResponseMaxAge?: number;
  includeMetadata?: boolean;
  includeLongDescription?: boolean;
  includeAdditionalPreviews?: boolean;
  onlyIds?: boolean;
  onlyTotal?: boolean;
  language?: string;
  matchAnyTag?: boolean;
  requiredTags?: string[];
  excludedTags?: string[];
  searchText?: string;
  rankedByTrendDays?: number;
}

export interface AppIDs {
  creator?: number;
  consumer?: number;
}

export const SteamCallback = {
  PersonaStateChange: 0,
  SteamServersConnected: 1,
  SteamServersDisconnected: 2,
  SteamServerConnectFailure: 3,
  LobbyDataUpdate: 4,
  LobbyChatUpdate: 5,
  P2PSessionRequest: 6,
  P2PSessionConnectFail: 7,
  GameLobbyJoinRequested: 8,
  MicroTxnAuthorizationResponse: 9,
  GameOverlayActivated: 331,
  EquippedProfileItemsChanged: 350,
  FavoritesListChanged: 502,
  LobbyInvite: 503,
  LobbyEnter: 504,
  LobbyChatMsg: 507,
  LobbyGameCreated: 509,
  LobbyMatchList: 510,
  LobbyKicked: 512,
  IPCountry: 701,
  LowBatteryPower: 702,
  SteamAPICallCompleted: 703,
  SteamShutdown: 704,
  CheckFileSignature: 705,
  GamepadTextInputDismissed: 714,
  AppResumingFromSuspend: 736,
  FloatingGamepadTextInputDismissed: 738,
  FilterTextDictionaryChanged: 739,
  DlcInstalled: 1005,
  NewUrlLaunchParameters: 1014,
  AppProofOfPurchaseKeyResponse: 1021,
  FileDetailsResult: 1023,
  TimedTrialStatus: 1030,
  SteamNetConnectionStatusChanged: 1221,
  SteamNetAuthenticationStatus: 1222,
  SteamNetworkingFakeIPResult: 1223,
  SteamNetworkingMessagesSessionRequest: 1251,
  SteamNetworkingMessagesSessionFailed: 1252,
  SteamRelayNetworkStatus: 1281,
  HTTPRequestCompleted: 2101,
  HTTPRequestHeadersReceived: 2102,
  HTTPRequestDataReceived: 2103,
  JoinParty: 5301,
  CreateBeacon: 5302,
  ReservationNotification: 5303,
  ChangeNumOpenSlots: 5304,
  SteamInventoryResultReady: 4700,
  SteamInventoryFullUpdate: 4701,
  SteamInventoryDefinitionUpdate: 4702,
  SteamInventoryEligiblePromoItemDefIds: 4703,
  SteamInventoryStartPurchaseResult: 4704,
  SteamInventoryRequestPricesResult: 4705
} as const;

export const HttpMethod = {
  Invalid: 0,
  Get: 1,
  Head: 2,
  Post: 3,
  Put: 4,
  Delete: 5,
  Options: 6,
  Patch: 7
} as const;

export type HttpMethodValue = typeof HttpMethod[keyof typeof HttpMethod];

export const PartyBeaconLocationType = {
  Invalid: 0,
  ChatGroup: 1,
  Max: 2
} as const;

export const PartyBeaconLocationData = {
  Invalid: 0,
  Name: 1,
  IconURLSmall: 2,
  IconURLMedium: 3,
  IconURLLarge: 4
} as const;

export const InventoryItemFlags = {
  NoTrade: 1,
  Removed: 256,
  Consumed: 512
} as const;

export const FriendFlags = {
  None: 0,
  Blocked: 1,
  FriendshipRequested: 2,
  Immediate: 4,
  ClanMember: 8,
  OnGameServer: 16,
  RequestingFriendship: 128,
  RequestingInfo: 256,
  Ignored: 512,
  IgnoredFriend: 1024,
  ChatMember: 4096,
  All: 65535
} as const;

export const FriendRelationship = {
  None: 0,
  Blocked: 1,
  RequestRecipient: 2,
  Friend: 3,
  RequestInitiator: 4,
  Ignored: 5,
  IgnoredFriend: 6,
  SuggestedDeprecated: 7,
  Max: 8
} as const;

export const PersonaState = {
  Offline: 0,
  Online: 1,
  Busy: 2,
  Away: 3,
  Snooze: 4,
  LookingToTrade: 5,
  LookingToPlay: 6,
  Invisible: 7,
  Max: 8
} as const;

export const ChatRoomEnterResponse = {
  Success: 1,
  DoesntExist: 2,
  NotAllowed: 3,
  Full: 4,
  Error: 5,
  Banned: 6,
  Limited: 7,
  ClanDisabled: 8,
  CommunityBan: 9,
  MemberBlockedYou: 10,
  YouBlockedMember: 11,
  RatelimitExceeded: 15
} as const;

export const ChatEntryType = {
  Invalid: 0,
  ChatMsg: 1,
  Typing: 2,
  InviteGame: 3,
  Emote: 4,
  LeftConversation: 6,
  Entered: 7,
  WasKicked: 8,
  WasBanned: 9,
  Disconnected: 10,
  HistoricalChat: 11,
  LinkBlocked: 14
} as const;

export const CommunityProfileItemType = {
  AnimatedAvatar: 0,
  AvatarFrame: 1,
  ProfileModifier: 2,
  ProfileBackground: 3,
  MiniProfileBackground: 4
} as const;

export const CommunityProfileItemProperty = {
  ImageSmall: 0,
  ImageLarge: 1,
  InternalName: 2,
  Title: 3,
  Description: 4,
  AppId: 5,
  TypeId: 6,
  Class: 7,
  MovieWebM: 8,
  MovieMP4: 9,
  MovieWebMSmall: 10,
  MovieMP4Small: 11
} as const;

export const VRScreenshotType = {
  None: 0,
  Mono: 1,
  Stereo: 2,
  MonoCubemap: 3,
  MonoPanorama: 4,
  StereoPanorama: 5
} as const;

export const AudioPlaybackStatus = {
  Undefined: 0,
  Playing: 1,
  Paused: 2,
  Idle: 3
} as const;

export const LeaderboardDataRequest = {
  Global: 0,
  GlobalAroundUser: 1,
  Friends: 2,
  Users: 3
} as const;

export const LeaderboardSortMethod = {
  None: 0,
  Ascending: 1,
  Descending: 2
} as const;

export const LeaderboardDisplayType = {
  None: 0,
  Numeric: 1,
  TimeSeconds: 2,
  TimeMilliseconds: 3
} as const;

export const LeaderboardUploadScoreMethod = {
  None: 0,
  KeepBest: 1,
  ForceUpdate: 2
} as const;

export const ParentalFeature = {
  Invalid: 0,
  Store: 1,
  Community: 2,
  Profile: 3,
  Friends: 4,
  News: 5,
  Trading: 6,
  Settings: 7,
  Console: 8,
  Browser: 9,
  ParentalSetup: 10,
  Library: 11,
  Test: 12,
  SiteLicense: 13,
  KioskModeDeprecated: 14
} as const;

export const TimelineGameMode = {
  Invalid: 0,
  Playing: 1,
  Staging: 2,
  Menus: 3,
  LoadingScreen: 4,
  Max: 5
} as const;

export const TimelineEventClipPriority = {
  Invalid: 0,
  None: 1,
  Standard: 2,
  Featured: 3
} as const;

export const TimelinePriority = {
  Max: 1000,
  KeepCurrentValue: 1000000
} as const;

export const RemotePlayDeviceFormFactor = {
  Unknown: 0,
  Phone: 1,
  Tablet: 2,
  Computer: 3,
  TV: 4,
  VRHeadset: 5
} as const;

export const RemotePlayInputType = {
  Unknown: 0,
  MouseMotion: 1,
  MouseButtonDown: 2,
  MouseButtonUp: 3,
  MouseWheel: 4,
  KeyDown: 5,
  KeyUp: 6
} as const;

export const RemotePlayMouseButton = {
  Left: 1,
  Right: 2,
  Middle: 16,
  X1: 32,
  X2: 64
} as const;

export const RemotePlayMouseWheelDirection = {
  Up: 1,
  Down: 2,
  Left: 3,
  Right: 4
} as const;

export const RemotePlayKeyModifier = {
  None: 0,
  LeftShift: 1,
  RightShift: 2,
  LeftControl: 64,
  RightControl: 128,
  LeftAlt: 256,
  RightAlt: 512,
  LeftGUI: 1024,
  RightGUI: 2048,
  NumLock: 4096,
  CapsLock: 8192,
  Mask: 65535
} as const;

export const InputType = {
  Unknown: "Unknown",
  SteamController: "SteamController",
  XBox360Controller: "XBox360Controller",
  XBoxOneController: "XBoxOneController",
  GenericGamepad: "GenericGamepad",
  PS4Controller: "PS4Controller",
  AppleMFiController: "AppleMFiController",
  AndroidController: "AndroidController",
  SwitchJoyConPair: "SwitchJoyConPair",
  SwitchJoyConSingle: "SwitchJoyConSingle",
  SwitchProController: "SwitchProController",
  MobileTouch: "MobileTouch",
  PS3Controller: "PS3Controller",
  PS5Controller: "PS5Controller",
  SteamDeckController: "SteamDeckController"
} as const;

export const LobbyType = {
  Private: 0,
  FriendsOnly: 1,
  Public: 2,
  Invisible: 3,
  PrivateUnique: 4
} as const;

export const LobbyComparison = {
  EqualToOrLessThan: -2,
  LessThan: -1,
  Equal: 0,
  GreaterThan: 1,
  EqualToOrGreaterThan: 2,
  NotEqual: 3
} as const;

export const LobbyDistanceFilter = {
  Close: 0,
  Default: 1,
  Far: 2,
  Worldwide: 3
} as const;

export const FavoriteFlags = {
  None: 0,
  Favorite: 1,
  History: 2
} as const;

export const SendType = {
  Unreliable: 0,
  UnreliableNoDelay: 1,
  Reliable: 2,
  ReliableWithBuffering: 3
} as const;

export const NetworkingSendFlags = {
  Unreliable: 0,
  NoNagle: 1,
  UnreliableNoNagle: 1,
  NoDelay: 4,
  UnreliableNoDelay: 5,
  Reliable: 8,
  ReliableNoNagle: 9,
  UseCurrentThread: 16,
  AutoRestartBrokenSession: 32
} as const;

export const NetworkingConnectionState = {
  None: 0,
  Connecting: 1,
  FindingRoute: 2,
  Connected: 3,
  ClosedByPeer: 4,
  ProblemDetectedLocally: 5,
  FinWait: -1,
  Linger: -2,
  Dead: -3
} as const;

export const NetworkingAvailability = {
  CannotTry: -102,
  Failed: -101,
  Previously: -100,
  Retrying: -10,
  Unknown: 0,
  NeverTried: 1,
  Waiting: 2,
  Attempting: 3,
  Current: 100
} as const;

export const NetworkingFakeIpType = {
  Invalid: 0,
  NotFake: 1,
  GlobalIPv4: 2,
  LocalIPv4: 3
} as const;

export const Dialog = {
  Friends: 0,
  Community: 1,
  Players: 2,
  Settings: 3,
  OfficialGameGroup: 4,
  Stats: 5,
  Achievements: 6
} as const;

export const StoreFlag = {
  None: 0,
  AddToCart: 1,
  AddToCartAndShow: 2
} as const;

export const SteamUniverse = {
  Invalid: 0,
  Public: 1,
  Beta: 2,
  Internal: 3,
  Dev: 4,
  Max: 5
} as const;

export const OverlayNotificationPosition = {
  Invalid: -1,
  TopLeft: 0,
  TopRight: 1,
  BottomLeft: 2,
  BottomRight: 3
} as const;

export const GamepadTextInputMode = {
  Normal: 0,
  Password: 1
} as const;

export const GamepadTextInputLineMode = {
  SingleLine: 0,
  MultipleLines: 1
} as const;

export const FloatingGamepadTextInputMode = {
  SingleLine: 0,
  MultipleLines: 1,
  Email: 2,
  Numeric: 3
} as const;

export const TextFilteringContext = {
  Unknown: 0,
  GameContent: 1,
  Chat: 2,
  Name: 3
} as const;

export const IPv6ConnectivityProtocol = {
  Invalid: 0,
  HTTP: 1,
  UDP: 2
} as const;

export const IPv6ConnectivityState = {
  Unknown: 0,
  Good: 1,
  Bad: 2
} as const;

export const CheckFileSignature = {
  InvalidSignature: 0,
  ValidSignature: 1,
  FileNotFound: 2,
  NoSignaturesFoundForThisApp: 3,
  NoSignaturesFoundForThisFile: 4
} as const;

export const UgcItemVisibility = {
  Public: 0,
  FriendsOnly: 1,
  Private: 2,
  Unlisted: 3
} as const;

export const UpdateStatus = {
  Invalid: 0,
  PreparingConfig: 1,
  PreparingContent: 2,
  UploadingContent: 3,
  UploadingPreviewFile: 4,
  CommittingChanges: 5
} as const;

export const UGCQueryType = {
  RankedByVote: 0,
  RankedByPublicationDate: 1,
  AcceptedForGameRankedByAcceptanceDate: 2,
  RankedByTrend: 3,
  FavoritedByFriendsRankedByPublicationDate: 4,
  CreatedByFriendsRankedByPublicationDate: 5,
  RankedByNumTimesReported: 6,
  CreatedByFollowedUsersRankedByPublicationDate: 7,
  NotYetRated: 8,
  RankedByTotalVotesAsc: 9,
  RankedByVotesUp: 10,
  RankedByTextSearch: 11,
  RankedByTotalUniqueSubscriptions: 12,
  RankedByPlaytimeTrend: 13,
  RankedByTotalPlaytime: 14,
  RankedByAveragePlaytimeTrend: 15,
  RankedByLifetimeAveragePlaytime: 16,
  RankedByPlaytimeSessionsTrend: 17,
  RankedByLifetimePlaytimeSessions: 18,
  RankedByLastUpdatedDate: 19
} as const;

export const UGCType = {
  Items: 0,
  ItemsMtx: 1,
  ItemsReadyToUse: 2,
  Collections: 3,
  Artwork: 4,
  Videos: 5,
  Screenshots: 6,
  AllGuides: 7,
  WebGuides: 8,
  IntegratedGuides: 9,
  UsableInGame: 10,
  ControllerBindings: 11,
  GameManagedItems: 12,
  All: 13
} as const;

export const UserListType = {
  Published: 0,
  VotedOn: 1,
  VotedUp: 2,
  VotedDown: 3,
  Favorited: 4,
  Subscribed: 5,
  UsedOrPlayed: 6,
  Followed: 7
} as const;

export const UserListOrder = {
  CreationOrderAsc: 0,
  CreationOrderDesc: 1,
  TitleAsc: 2,
  LastUpdatedDesc: 3,
  SubscriptionDateDesc: 4,
  VoteScoreDesc: 5,
  ForModeration: 6
} as const;

export let electronConfigureSteamOverlay = electronConfigureSteamOverlayImpl;
export let electronEnableSteamOverlay = electronEnableSteamOverlayImpl;

export type SteamCallbackId = typeof SteamCallback[keyof typeof SteamCallback];
export type InputTypeValue = typeof InputType[keyof typeof InputType];

let callbackTimer: NodeJS.Timeout | undefined;
let activeCallbackIntervalMs = 33;

export class Ticket implements AuthTicket {
  constructor(private readonly ticket: NativeAuthTicket) {}

  cancel(): void {
    this.ticket.cancel();
  }

  getBytes(): Buffer {
    return this.ticket.getBytes();
  }
}

export class FileInfo {
  constructor(public name: string, public size: bigint) {}
}

export class Controller {
  constructor(private readonly handle: bigint, private readonly cachedType?: string) {}

  activateActionSet(actionSetHandle: bigint): void {
    native().inputActivateActionSet(this.handle, actionSetHandle);
  }

  isDigitalActionPressed(actionHandle: bigint): boolean {
    return native().inputIsDigitalActionPressed(this.handle, actionHandle);
  }

  getAnalogActionVector(actionHandle: bigint): AnalogActionVector {
    return native().inputGetAnalogActionVector(this.handle, actionHandle);
  }

  getType(): InputTypeValue {
    return normalizeInputType(this.cachedType ?? native().inputGetControllerType(this.handle));
  }

  getHandle(): bigint {
    return this.handle;
  }
}

export class Lobby {
  constructor(public id: bigint) {}

  async join(): Promise<Lobby> {
    return matchmaking.joinLobby(this.id);
  }

  leave(): void {
    native().matchmakingLeaveLobby(this.id);
  }

  openInviteDialog(): void {
    overlay.activateInviteDialog(this.id);
  }

  getMemberCount(): bigint {
    return BigInt(native().matchmakingGetLobbyMemberCount(this.id));
  }

  getMemberLimit(): bigint | null {
    const limit = native().matchmakingGetLobbyMemberLimit(this.id);
    return limit == null ? null : BigInt(limit);
  }

  getMembers(): SteamId[] {
    return native().matchmakingGetLobbyMembers(this.id).map(normalizeSteamId);
  }

  getOwner(): SteamId {
    return normalizeSteamId(native().matchmakingGetLobbyOwner(this.id));
  }

  setJoinable(joinable: boolean): boolean {
    return native().matchmakingSetLobbyJoinable(this.id, joinable);
  }

  getData(key: string): string | null {
    return native().matchmakingGetLobbyData(this.id, key) ?? null;
  }

  setData(key: string, value: string): boolean {
    return native().matchmakingSetLobbyData(this.id, key, value);
  }

  deleteData(key: string): boolean {
    return native().matchmakingDeleteLobbyData(this.id, key);
  }

  getFullData(): Record<string, string> {
    return native().matchmakingGetLobbyFullData(this.id);
  }

  mergeFullData(data: Record<string, string>): boolean {
    let ok = true;
    for (const [key, value] of Object.entries(data)) {
      ok = this.setData(key, value) && ok;
    }
    return ok;
  }

  inviteUser(steamId64: bigint): boolean {
    return native().matchmakingInviteUserToLobby(this.id, steamId64);
  }

  getMemberData(steamId64: bigint, key: string): string | null {
    return native().matchmakingGetLobbyMemberData(this.id, steamId64, key) ?? null;
  }

  setMemberData(key: string, value: string): void {
    native().matchmakingSetLobbyMemberData(this.id, key, value);
  }

  sendChatMessage(data: Buffer | Uint8Array | string): boolean {
    return native().matchmakingSendLobbyChatMsg(this.id, Buffer.from(data));
  }

  getChatEntry(chatId: number, maxBytes?: number | null): LobbyChatEntry | null {
    return normalizeLobbyChatEntry(native().matchmakingGetLobbyChatEntry(this.id, chatId, maxBytes ?? undefined));
  }

  requestData(): boolean {
    return native().matchmakingRequestLobbyData(this.id);
  }

  setGameServer(options: LobbyGameServerOptions): void {
    native().matchmakingSetLobbyGameServer(this.id, options.ip ?? 0, options.port ?? 0, options.steamId64 ?? 0n);
  }

  getGameServer(): LobbyGameServer | null {
    return normalizeLobbyGameServer(native().matchmakingGetLobbyGameServer(this.id));
  }

  setMemberLimit(maxMembers: number): boolean {
    return native().matchmakingSetLobbyMemberLimit(this.id, maxMembers);
  }

  setType(lobbyType: number): boolean {
    return native().matchmakingSetLobbyType(this.id, lobbyType);
  }

  setOwner(steamId64: bigint): boolean {
    return native().matchmakingSetLobbyOwner(this.id, steamId64);
  }

  setLinkedLobby(dependentLobbyId: bigint): boolean {
    return native().matchmakingSetLinkedLobby(this.id, dependentLobbyId);
  }
}

export function init(options?: InitOptions | number | null): SteamBridgeClient {
  const normalized = normalizeInitOptions(options);
  native().init(normalized.appId);
  startCallbackPump(normalized.callbackIntervalMs);
  return createCompatibilityClient();
}

export function shutdown(): void {
  stopCallbackPump();
  native().shutdown();
}

export function restartAppIfNecessary(appId: number): boolean {
  return native().restartAppIfNecessary(appId);
}

export function isSteamRunning(): boolean {
  return native().isSteamRunning();
}

export function getSteamInstallPath(): string | undefined {
  return native().getSteamInstallPath();
}

export function runCallbacks(): void {
  native().runCallbacks();
}

export function getSteamId(): SteamId {
  return normalizeSteamId(native().getSteamId());
}

export async function getAuthTicketForWebApi(identity: string, timeoutSeconds?: number): Promise<AuthTicket> {
  return new Ticket(await native().getAuthTicketForWebApi(identity, timeoutSeconds));
}

export function isSteamDeck(): boolean {
  return native().isSteamDeck();
}

export function getAppId(): number {
  return native().getAppId();
}

export function isSteamInBigPictureMode(): boolean {
  return native().isSteamInBigPictureMode();
}

export function isOverlayEnabled(): boolean {
  return native().isOverlayEnabled();
}

export function overlayNeedsPresent(): boolean {
  return native().overlayNeedsPresent();
}

export function getOverlayDiagnostics(): OverlayDiagnostics {
  return normalizeOverlayDiagnostics(native().getOverlayDiagnostics());
}

export function onMicroTxnAuthorizationResponse(
  handler: (event: MicroTxnAuthorizationResponse) => void
): CallbackHandle {
  return callback.register(SteamCallback.MicroTxnAuthorizationResponse, (event) => {
    handler(normalizeMicroTxnEvent(event));
  });
}

export function onGameOverlayActivated(handler: (event: GameOverlayActivated) => void): CallbackHandle {
  return callback.register(SteamCallback.GameOverlayActivated, (event) => {
    handler(normalizeGameOverlayEvent(event));
  });
}

export function activateOverlay(dialog: number | string = "Friends"): void {
  native().activateOverlay(dialogName(dialog));
}

export function activateOverlayToWebPage(url: string, options: OverlayWebPageOptions = {}): void {
  native().activateOverlayToWebPage(url, options.modal);
}

export function openNativeOverlayProbeWindow(title?: string): void {
  native().openNativeOverlayProbeWindow(title);
}

export function attachNativeOverlayHostView(nativeWindowHandle: Buffer): void {
  native().attachNativeOverlayHostView(nativeWindowHandle);
}

export function pumpNativeOverlayProbeWindow(): void {
  native().pumpNativeOverlayProbeWindow();
}

export function pumpNativeOverlayHostView(): void {
  native().pumpNativeOverlayHostView();
}

export function showNativeOverlayHostView(): void {
  native().showNativeOverlayHostView();
}

export function hideNativeOverlayHostView(): void {
  native().hideNativeOverlayHostView();
}

export function updateNativeOverlayHostFrame(frame: Buffer, width: number, height: number): void {
  native().updateNativeOverlayHostFrame(frame, width, height);
}

export function closeNativeOverlayProbeWindow(): void {
  native().closeNativeOverlayProbeWindow();
}

export function detachNativeOverlayHostView(): void {
  native().detachNativeOverlayHostView();
}

export function isNativeOverlayProbeWindowOpen(): boolean {
  return native().isNativeOverlayProbeWindowOpen();
}

export function isNativeOverlayHostViewOpen(): boolean {
  return native().isNativeOverlayHostViewOpen();
}

export function getMacWindowSnapshot(appId?: number): string | undefined {
  return native().getMacWindowSnapshot(appId);
}

export function isAchievementActivated(name: string): boolean {
  return native().isAchievementActivated(name);
}

export const achievement = {
  activate(name: string): boolean {
    return native().achievementActivate(name);
  },
  isActivated: isAchievementActivated,
  clear(name: string): boolean {
    return native().achievementClear(name);
  },
  names(): string[] {
    return native().achievementNames();
  },
  getAndUnlockTime(name: string): AchievementUnlockTime | null {
    return normalizeAchievementUnlockTime(native().achievementGetAndUnlockTime(name));
  },
  getIcon(name: string): number {
    return native().achievementGetIcon(name);
  },
  getDisplayAttribute(name: string, key: string): string {
    return native().achievementGetDisplayAttribute(name, key);
  },
  indicateProgress(name: string, current: number, max: number): boolean {
    return native().achievementIndicateProgress(name, current, max);
  },
  getProgressLimitsInt(name: string): AchievementProgressLimitsInt | null {
    return normalizeAchievementProgressLimitsInt(native().achievementGetProgressLimitsInt(name));
  },
  getProgressLimitsFloat(name: string): AchievementProgressLimitsFloat | null {
    return normalizeAchievementProgressLimitsFloat(native().achievementGetProgressLimitsFloat(name));
  }
};

export const apps = {
  isSubscribedApp(appId: number): boolean {
    return native().appsIsSubscribedApp(appId);
  },
  isAppInstalled(appId: number): boolean {
    return native().appsIsAppInstalled(appId);
  },
  isDlcInstalled(appId: number): boolean {
    return native().appsIsDlcInstalled(appId);
  },
  isSubscribedFromFreeWeekend(): boolean {
    return native().appsIsSubscribedFromFreeWeekend();
  },
  isVacBanned(): boolean {
    return native().appsIsVacBanned();
  },
  isCybercafe(): boolean {
    return native().appsIsCybercafe();
  },
  isLowViolence(): boolean {
    return native().appsIsLowViolence();
  },
  isSubscribed(): boolean {
    return native().appsIsSubscribed();
  },
  appBuildId(): number {
    return native().appsAppBuildId();
  },
  appInstallDir(appId: number): string {
    return native().appsAppInstallDir(appId);
  },
  appOwner(): SteamId {
    return normalizeSteamId(native().appsAppOwner());
  },
  availableGameLanguages(): string[] {
    return native().appsAvailableGameLanguages();
  },
  currentGameLanguage(): string {
    return native().appsCurrentGameLanguage();
  },
  currentBetaName(): string | null {
    return native().appsCurrentBetaName() ?? null;
  },
  earliestPurchaseUnixTime(appId: number): number {
    return native().appsEarliestPurchaseUnixTime(appId);
  },
  dlcCount(): number {
    return native().appsDlcCount();
  },
  dlcDataByIndex(index: number): AppDlcData | null {
    return normalizeAppDlcData(native().appsDlcDataByIndex(index));
  },
  installDlc(appId: number): void {
    native().appsInstallDlc(appId);
  },
  uninstallDlc(appId: number): void {
    native().appsUninstallDlc(appId);
  },
  requestAppProofOfPurchaseKey(appId: number): void {
    native().appsRequestAppProofOfPurchaseKey(appId);
  },
  requestAllProofOfPurchaseKeys(): void {
    native().appsRequestAllProofOfPurchaseKeys();
  },
  markContentCorrupt(missingFilesOnly = false): boolean {
    return native().appsMarkContentCorrupt(missingFilesOnly);
  },
  installedDepots(appId: number, maxDepots?: number): number[] {
    return native().appsInstalledDepots(appId, maxDepots);
  },
  launchQueryParam(key: string): string {
    return native().appsLaunchQueryParam(key);
  },
  dlcDownloadProgress(appId: number): AppDlcDownloadProgress | null {
    return normalizeAppDlcDownloadProgress(native().appsDlcDownloadProgress(appId));
  },
  launchCommandLine(maxBytes?: number): string {
    return native().appsLaunchCommandLine(maxBytes);
  },
  isSubscribedFromFamilySharing(): boolean {
    return native().appsIsSubscribedFromFamilySharing();
  },
  timedTrial(): AppTimedTrialInfo | null {
    return normalizeAppTimedTrialInfo(native().appsTimedTrial());
  },
  setDlcContext(appId: number): boolean {
    return native().appsSetDlcContext(appId);
  },
  betaCounts(): AppBetaCounts {
    return normalizeAppBetaCounts(native().appsBetaCounts());
  },
  betaInfo(index: number): AppBetaInfo | null {
    return normalizeAppBetaInfo(native().appsBetaInfo(index));
  },
  setActiveBeta(betaName: string): boolean {
    return native().appsSetActiveBeta(betaName);
  },
  async getFileDetails(fileName: string, timeoutSeconds?: number | null): Promise<AppFileDetails> {
    return normalizeAppFileDetails(await native().appsGetFileDetails(fileName, timeoutSeconds ?? undefined));
  }
};

export const auth = {
  Ticket,
  async getSessionTicketWithSteamId(steamId64: bigint, timeoutSeconds?: number | null): Promise<Ticket> {
    return new Ticket(await native().authGetSessionTicketWithSteamId(steamId64, timeoutSeconds ?? undefined));
  },
  async getSessionTicketWithIp(ip: string, timeoutSeconds?: number | null): Promise<Ticket> {
    return new Ticket(await native().authGetSessionTicketWithIp(ip, timeoutSeconds ?? undefined));
  },
  async getAuthTicketForWebApi(identity: string, timeoutSeconds?: number | null): Promise<Ticket> {
    return new Ticket(await native().getAuthTicketForWebApi(identity, timeoutSeconds ?? undefined));
  }
};

export const callback = {
  SteamCallback,
  register(steamCallback: SteamCallbackId | number, handler: (value: unknown) => void): CallbackHandle {
    return wrapCallbackHandle(
      native().registerSteamCallback(Number(steamCallback), (event) => {
        handler(normalizeCallbackEvent(Number(steamCallback), event));
      })
    );
  }
};

export const cloud = {
  FileInfo,
  isEnabledForAccount(): boolean {
    return native().cloudIsEnabledForAccount();
  },
  isEnabledForApp(): boolean {
    return native().cloudIsEnabledForApp();
  },
  setEnabledForApp(enabled: boolean): void {
    native().cloudSetEnabledForApp(enabled);
  },
  readFile(name: string): string {
    return native().cloudReadFile(name);
  },
  writeFile(name: string, content: string): boolean {
    return native().cloudWriteFile(name, content);
  },
  deleteFile(name: string): boolean {
    return native().cloudDeleteFile(name);
  },
  fileExists(name: string): boolean {
    return native().cloudFileExists(name);
  },
  listFiles(): FileInfo[] {
    return native().cloudListFiles().map((file: NativeCloudFileInfo) => new FileInfo(file.name, BigInt(file.size)));
  }
};

export const http = {
  HttpMethod,
  createRequest(method: HttpMethodValue | number, url: string): number {
    return native().httpCreateRequest(Number(method), url);
  },
  setContextValue(request: number, contextValue: bigint): boolean {
    return native().httpSetContextValue(request, contextValue);
  },
  setNetworkActivityTimeout(request: number, timeoutSeconds: number): boolean {
    return native().httpSetNetworkActivityTimeout(request, timeoutSeconds);
  },
  setHeaderValue(request: number, name: string, value: string): boolean {
    return native().httpSetHeaderValue(request, name, value);
  },
  setGetOrPostParameter(request: number, name: string, value: string): boolean {
    return native().httpSetGetOrPostParameter(request, name, value);
  },
  async sendRequest(request: number, timeoutSeconds?: number | null): Promise<HttpRequestCompleted> {
    return normalizeHttpRequestCompleted(await native().httpSendRequest(request, timeoutSeconds ?? undefined));
  },
  async sendRequestAndStreamResponse(
    request: number,
    timeoutSeconds?: number | null
  ): Promise<HttpRequestHeadersReceived> {
    return normalizeHttpRequestHeadersReceived(
      await native().httpSendRequestAndStreamResponse(request, timeoutSeconds ?? undefined)
    );
  },
  deferRequest(request: number): boolean {
    return native().httpDeferRequest(request);
  },
  prioritizeRequest(request: number): boolean {
    return native().httpPrioritizeRequest(request);
  },
  getResponseHeaderSize(request: number, name: string): number | null {
    return native().httpGetResponseHeaderSize(request, name) ?? null;
  },
  getResponseHeaderValue(request: number, name: string): string | null {
    return native().httpGetResponseHeaderValue(request, name) ?? null;
  },
  getResponseBodySize(request: number): number | null {
    return native().httpGetResponseBodySize(request) ?? null;
  },
  getResponseBodyData(request: number): Buffer | null {
    return native().httpGetResponseBodyData(request) ?? null;
  },
  getStreamingResponseBodyData(request: number, offset: number, size: number): Buffer | null {
    return native().httpGetStreamingResponseBodyData(request, offset, size) ?? null;
  },
  releaseRequest(request: number): boolean {
    return native().httpReleaseRequest(request);
  },
  getDownloadProgressPercent(request: number): number | null {
    return native().httpGetDownloadProgressPercent(request) ?? null;
  },
  setRawPostBody(request: number, contentType: string, body: Buffer | Uint8Array): boolean {
    return native().httpSetRawPostBody(request, contentType, Buffer.from(body));
  },
  createCookieContainer(allowResponsesToModify = false): number {
    return native().httpCreateCookieContainer(allowResponsesToModify);
  },
  releaseCookieContainer(container: number): boolean {
    return native().httpReleaseCookieContainer(container);
  },
  setCookie(container: number, host: string, url: string, cookie: string): boolean {
    return native().httpSetCookie(container, host, url, cookie);
  },
  setRequestCookieContainer(request: number, container: number): boolean {
    return native().httpSetRequestCookieContainer(request, container);
  },
  setUserAgentInfo(request: number, userAgent: string): boolean {
    return native().httpSetUserAgentInfo(request, userAgent);
  },
  setRequiresVerifiedCertificate(request: number, requireVerifiedCertificate: boolean): boolean {
    return native().httpSetRequiresVerifiedCertificate(request, requireVerifiedCertificate);
  },
  setAbsoluteTimeoutMs(request: number, timeoutMs: number): boolean {
    return native().httpSetAbsoluteTimeoutMs(request, timeoutMs);
  },
  getRequestWasTimedOut(request: number): boolean | null {
    return native().httpGetRequestWasTimedOut(request) ?? null;
  }
};

export const parties = {
  PartyBeaconLocationType,
  PartyBeaconLocationData,
  getNumActiveBeacons(): number {
    return native().partiesGetNumActiveBeacons();
  },
  getBeaconByIndex(index: number): bigint | null {
    const beacon = native().partiesGetBeaconByIndex(index);
    return beacon == null ? null : BigInt(beacon);
  },
  getActiveBeacons(): bigint[] {
    return native().partiesGetActiveBeacons().map(BigInt);
  },
  getBeaconDetails(beacon: bigint): PartyBeaconDetails | null {
    return normalizePartyBeaconDetails(native().partiesGetBeaconDetails(beacon));
  },
  async joinParty(beacon: bigint, timeoutSeconds?: number | null): Promise<JoinPartyResult> {
    return normalizeJoinPartyResult(await native().partiesJoinParty(beacon, timeoutSeconds ?? undefined));
  },
  getNumAvailableBeaconLocations(): number | null {
    return native().partiesGetNumAvailableBeaconLocations() ?? null;
  },
  getAvailableBeaconLocations(maxLocations?: number | null): PartyBeaconLocation[] {
    return native()
      .partiesGetAvailableBeaconLocations(maxLocations ?? undefined)
      .map(normalizePartyBeaconLocation);
  },
  async createBeacon(
    openSlots: number,
    location: PartyBeaconLocation,
    connectString: string,
    metadata = "",
    timeoutSeconds?: number | null
  ): Promise<CreateBeaconResult> {
    return normalizeCreateBeaconResult(
      await native().partiesCreateBeacon(
        openSlots,
        nativePartyBeaconLocation(location),
        connectString,
        metadata,
        timeoutSeconds ?? undefined
      )
    );
  },
  onReservationCompleted(beacon: bigint, steamId64: bigint): void {
    native().partiesOnReservationCompleted(beacon, steamId64);
  },
  cancelReservation(beacon: bigint, steamId64: bigint): void {
    native().partiesCancelReservation(beacon, steamId64);
  },
  async changeNumOpenSlots(
    beacon: bigint,
    openSlots: number,
    timeoutSeconds?: number | null
  ): Promise<ChangeNumOpenSlotsResult> {
    return normalizeChangeNumOpenSlotsResult(
      await native().partiesChangeNumOpenSlots(beacon, openSlots, timeoutSeconds ?? undefined)
    );
  },
  destroyBeacon(beacon: bigint): boolean {
    return native().partiesDestroyBeacon(beacon);
  },
  getBeaconLocationData(location: PartyBeaconLocation, data: number): string | null {
    return native().partiesGetBeaconLocationData(nativePartyBeaconLocation(location), data) ?? null;
  }
};

export const inventory = {
  InventoryItemFlags,
  getResultStatus(resultHandle: number): number {
    return native().inventoryGetResultStatus(resultHandle);
  },
  getResultItems(resultHandle: number): InventoryItemDetail[] | null {
    return native().inventoryGetResultItems(resultHandle)?.map(normalizeInventoryItemDetail) ?? null;
  },
  getResultItemProperty(resultHandle: number, itemIndex: number, propertyName?: string | null): string | null {
    return native().inventoryGetResultItemProperty(resultHandle, itemIndex, propertyName ?? undefined) ?? null;
  },
  getResultTimestamp(resultHandle: number): number {
    return native().inventoryGetResultTimestamp(resultHandle);
  },
  checkResultSteamId(resultHandle: number, steamId64: bigint): boolean {
    return native().inventoryCheckResultSteamId(resultHandle, steamId64);
  },
  destroyResult(resultHandle: number): void {
    native().inventoryDestroyResult(resultHandle);
  },
  getAllItems(): number | null {
    return native().inventoryGetAllItems() ?? null;
  },
  getItemsById(instanceIds: bigint[]): number | null {
    return native().inventoryGetItemsById(instanceIds) ?? null;
  },
  serializeResult(resultHandle: number): Buffer | null {
    return native().inventorySerializeResult(resultHandle) ?? null;
  },
  deserializeResult(data: Buffer | Uint8Array): number | null {
    return native().inventoryDeserializeResult(Buffer.from(data)) ?? null;
  },
  generateItems(items: InventoryItemQuantity[]): number | null {
    return native().inventoryGenerateItems(items.map(nativeInventoryItemQuantity)) ?? null;
  },
  grantPromoItems(): number | null {
    return native().inventoryGrantPromoItems() ?? null;
  },
  addPromoItem(definition: number): number | null {
    return native().inventoryAddPromoItem(definition) ?? null;
  },
  addPromoItems(definitions: number[]): number | null {
    return native().inventoryAddPromoItems(definitions) ?? null;
  },
  consumeItem(itemId: bigint, quantity: number): number | null {
    return native().inventoryConsumeItem(itemId, quantity) ?? null;
  },
  exchangeItems(generate: InventoryItemQuantity[], destroy: InventoryInstanceQuantity[]): number | null {
    return (
      native().inventoryExchangeItems(generate.map(nativeInventoryItemQuantity), destroy.map(nativeInventoryInstanceQuantity)) ?? null
    );
  },
  transferItemQuantity(sourceItemId: bigint, quantity: number, destinationItemId?: bigint | null): number | null {
    return native().inventoryTransferItemQuantity(sourceItemId, quantity, destinationItemId ?? undefined) ?? null;
  },
  sendItemDropHeartbeat(): void {
    native().inventorySendItemDropHeartbeat();
  },
  triggerItemDrop(dropListDefinition: number): number | null {
    return native().inventoryTriggerItemDrop(dropListDefinition) ?? null;
  },
  tradeItems(
    tradePartnerSteamId64: bigint,
    give: InventoryInstanceQuantity[],
    get: InventoryInstanceQuantity[]
  ): number | null {
    return (
      native().inventoryTradeItems(
        tradePartnerSteamId64,
        give.map(nativeInventoryInstanceQuantity),
        get.map(nativeInventoryInstanceQuantity)
      ) ?? null
    );
  },
  loadItemDefinitions(): boolean {
    return native().inventoryLoadItemDefinitions();
  },
  getItemDefinitionIds(): number[] {
    return native().inventoryGetItemDefinitionIds();
  },
  getItemDefinitionProperty(definition: number, propertyName?: string | null): string | null {
    return native().inventoryGetItemDefinitionProperty(definition, propertyName ?? undefined) ?? null;
  },
  async requestEligiblePromoItemDefinitionIds(
    steamId64: bigint,
    timeoutSeconds?: number | null
  ): Promise<InventoryEligiblePromoItemDefIds> {
    return normalizeInventoryEligiblePromoItemDefIds(
      await native().inventoryRequestEligiblePromoItemDefinitionIds(steamId64, timeoutSeconds ?? undefined)
    );
  },
  getEligiblePromoItemDefinitionIds(steamId64: bigint): number[] {
    return native().inventoryGetEligiblePromoItemDefinitionIds(steamId64);
  },
  async startPurchase(
    items: InventoryItemQuantity[],
    timeoutSeconds?: number | null
  ): Promise<InventoryStartPurchaseResult> {
    return normalizeInventoryStartPurchaseResult(
      await native().inventoryStartPurchase(items.map(nativeInventoryItemQuantity), timeoutSeconds ?? undefined)
    );
  },
  async requestPrices(timeoutSeconds?: number | null): Promise<InventoryRequestPricesResult> {
    return normalizeInventoryRequestPricesResult(await native().inventoryRequestPrices(timeoutSeconds ?? undefined));
  },
  getNumItemsWithPrices(): number {
    return native().inventoryGetNumItemsWithPrices();
  },
  getItemsWithPrices(maxItems?: number | null): InventoryPrice[] {
    return native()
      .inventoryGetItemsWithPrices(maxItems ?? undefined)
      .map(normalizeInventoryPrice);
  },
  getItemPrice(definition: number): InventoryPrice | null {
    const price = native().inventoryGetItemPrice(definition);
    return price ? normalizeInventoryPrice(price) : null;
  },
  startUpdateProperties(): bigint | null {
    const handle = native().inventoryStartUpdateProperties();
    return handle == null ? null : BigInt(handle);
  },
  removeProperty(updateHandle: bigint, itemId: bigint, propertyName: string): boolean {
    return native().inventoryRemoveProperty(updateHandle, itemId, propertyName);
  },
  setPropertyString(updateHandle: bigint, itemId: bigint, propertyName: string, value: string): boolean {
    return native().inventorySetPropertyString(updateHandle, itemId, propertyName, value);
  },
  setPropertyBool(updateHandle: bigint, itemId: bigint, propertyName: string, value: boolean): boolean {
    return native().inventorySetPropertyBool(updateHandle, itemId, propertyName, value);
  },
  setPropertyInt64(updateHandle: bigint, itemId: bigint, propertyName: string, value: bigint): boolean {
    return native().inventorySetPropertyInt64(updateHandle, itemId, propertyName, value);
  },
  setPropertyFloat(updateHandle: bigint, itemId: bigint, propertyName: string, value: number): boolean {
    return native().inventorySetPropertyFloat(updateHandle, itemId, propertyName, value);
  },
  submitUpdateProperties(updateHandle: bigint): number | null {
    return native().inventorySubmitUpdateProperties(updateHandle) ?? null;
  },
  inspectItem(itemToken: string): number | null {
    return native().inventoryInspectItem(itemToken) ?? null;
  }
};

export const input = {
  InputType,
  Controller,
  init(): void {
    native().inputInit();
  },
  getControllers(): Controller[] {
    return native().inputGetControllers().map((controller: NativeInputControllerInfo) => {
      return new Controller(BigInt(controller.handle), controller.inputType);
    });
  },
  getActionSet(actionSetName: string): bigint {
    return BigInt(native().inputGetActionSet(actionSetName));
  },
  getDigitalAction(actionName: string): bigint {
    return BigInt(native().inputGetDigitalAction(actionName));
  },
  getAnalogAction(actionName: string): bigint {
    return BigInt(native().inputGetAnalogAction(actionName));
  },
  shutdown(): void {
    native().inputShutdown();
  }
};

export const localplayer = {
  getSteamId,
  getName(): string {
    return native().localplayerGetName();
  },
  getLevel(): number {
    return native().localplayerGetLevel();
  },
  getIpCountry(): string {
    return native().localplayerGetIpCountry();
  },
  setRichPresence(key: string, value?: string | null): void {
    native().localplayerSetRichPresence(key, value ?? undefined);
  }
};

export const friends = {
  FriendFlags,
  FriendRelationship,
  PersonaState,
  ChatRoomEnterResponse,
  ChatEntryType,
  CommunityProfileItemType,
  CommunityProfileItemProperty,
  getPersonaName(): string {
    return native().friendsGetPersonaName();
  },
  getPersonaState(): number {
    return native().friendsGetPersonaState();
  },
  getFriendCount(friendFlags: number = FriendFlags.Immediate): number {
    return native().friendsGetFriendCount(friendFlags);
  },
  getFriendByIndex(index: number, friendFlags: number = FriendFlags.Immediate): SteamId {
    return normalizeSteamId(native().friendsGetFriendByIndex(index, friendFlags));
  },
  getFriends(friendFlags: number = FriendFlags.Immediate): SteamId[] {
    return native().friendsGetFriends(friendFlags).map(normalizeSteamId);
  },
  hasFriend(steamId64: bigint, friendFlags: number = FriendFlags.Immediate): boolean {
    return native().friendsHasFriend(steamId64, friendFlags);
  },
  getFriendRelationship(steamId64: bigint): number {
    return native().friendsGetFriendRelationship(steamId64);
  },
  getFriendPersonaState(steamId64: bigint): number {
    return native().friendsGetFriendPersonaState(steamId64);
  },
  getFriendPersonaName(steamId64: bigint): string {
    return native().friendsGetFriendPersonaName(steamId64);
  },
  getFriendPersonaNameHistory(steamId64: bigint, index: number): string {
    return native().friendsGetFriendPersonaNameHistory(steamId64, index);
  },
  getFriendSteamLevel(steamId64: bigint): number {
    return native().friendsGetFriendSteamLevel(steamId64);
  },
  getPlayerNickname(steamId64: bigint): string {
    return native().friendsGetPlayerNickname(steamId64);
  },
  getFriendGamePlayed(steamId64: bigint): FriendGameInfo | null {
    return normalizeFriendGameInfo(native().friendsGetFriendGamePlayed(steamId64));
  },
  getSmallFriendAvatar(steamId64: bigint): number {
    return native().friendsGetSmallFriendAvatar(steamId64);
  },
  getMediumFriendAvatar(steamId64: bigint): number {
    return native().friendsGetMediumFriendAvatar(steamId64);
  },
  getLargeFriendAvatar(steamId64: bigint): number {
    return native().friendsGetLargeFriendAvatar(steamId64);
  },
  requestUserInformation(steamId64: bigint, nameOnly = false): boolean {
    return native().friendsRequestUserInformation(steamId64, nameOnly);
  },
  getFriendsGroups(): FriendsGroupInfo[] {
    return native().friendsGetFriendsGroups().map(normalizeFriendsGroupInfo);
  },
  getClanCount(): number {
    return native().friendsGetClanCount();
  },
  getClanByIndex(index: number): SteamId {
    return normalizeSteamId(native().friendsGetClanByIndex(index));
  },
  getClans(): SteamId[] {
    return native().friendsGetClans().map(normalizeSteamId);
  },
  getClanName(clanId64: bigint): string {
    return native().friendsGetClanName(clanId64);
  },
  getClanTag(clanId64: bigint): string {
    return native().friendsGetClanTag(clanId64);
  },
  getClanActivityCounts(clanId64: bigint): ClanActivityCounts | null {
    return normalizeClanActivityCounts(native().friendsGetClanActivityCounts(clanId64));
  },
  async requestClanOfficerList(clanId64: bigint): Promise<ClanOfficerListResult> {
    return normalizeClanOfficerListResult(await native().friendsRequestClanOfficerList(clanId64));
  },
  getClanOwner(clanId64: bigint): SteamId {
    return normalizeSteamId(native().friendsGetClanOwner(clanId64));
  },
  getClanOfficerCount(clanId64: bigint): number {
    return native().friendsGetClanOfficerCount(clanId64);
  },
  getClanOfficerByIndex(clanId64: bigint, index: number): SteamId {
    return normalizeSteamId(native().friendsGetClanOfficerByIndex(clanId64, index));
  },
  setPlayedWith(steamId64: bigint): void {
    native().friendsSetPlayedWith(steamId64);
  },
  setInGameVoiceSpeaking(steamId64: bigint, speaking: boolean): void {
    native().friendsSetInGameVoiceSpeaking(steamId64, speaking);
  },
  clearRichPresence(): void {
    native().friendsClearRichPresence();
  },
  getFriendRichPresence(steamId64: bigint, key: string): string {
    return native().friendsGetFriendRichPresence(steamId64, key);
  },
  getFriendRichPresenceKeys(steamId64: bigint): string[] {
    return native().friendsGetFriendRichPresenceKeys(steamId64);
  },
  requestFriendRichPresence(steamId64: bigint): void {
    native().friendsRequestFriendRichPresence(steamId64);
  },
  inviteUserToGame(steamId64: bigint, connectString: string): boolean {
    return native().friendsInviteUserToGame(steamId64, connectString);
  },
  getCoplayFriendCount(): number {
    return native().friendsGetCoplayFriendCount();
  },
  getCoplayFriend(index: number): SteamId {
    return normalizeSteamId(native().friendsGetCoplayFriend(index));
  },
  getCoplayFriends(): SteamId[] {
    return native().friendsGetCoplayFriends().map(normalizeSteamId);
  },
  getFriendCoplayTime(steamId64: bigint): number {
    return native().friendsGetFriendCoplayTime(steamId64);
  },
  getFriendCoplayGame(steamId64: bigint): number {
    return native().friendsGetFriendCoplayGame(steamId64);
  },
  async joinClanChatRoom(clanId64: bigint): Promise<ClanChatJoinResult> {
    return normalizeClanChatJoinResult(await native().friendsJoinClanChatRoom(clanId64));
  },
  leaveClanChatRoom(clanId64: bigint): boolean {
    return native().friendsLeaveClanChatRoom(clanId64);
  },
  getClanChatMemberCount(clanChatId64: bigint): number {
    return native().friendsGetClanChatMemberCount(clanChatId64);
  },
  getChatMemberByIndex(clanChatId64: bigint, index: number): SteamId {
    return normalizeSteamId(native().friendsGetChatMemberByIndex(clanChatId64, index));
  },
  sendClanChatMessage(clanChatId64: bigint, text: string): boolean {
    return native().friendsSendClanChatMessage(clanChatId64, text);
  },
  isClanChatAdmin(clanChatId64: bigint, steamId64: bigint): boolean {
    return native().friendsIsClanChatAdmin(clanChatId64, steamId64);
  },
  isClanChatWindowOpenInSteam(clanChatId64: bigint): boolean {
    return native().friendsIsClanChatWindowOpenInSteam(clanChatId64);
  },
  openClanChatWindowInSteam(clanChatId64: bigint): boolean {
    return native().friendsOpenClanChatWindowInSteam(clanChatId64);
  },
  closeClanChatWindowInSteam(clanChatId64: bigint): boolean {
    return native().friendsCloseClanChatWindowInSteam(clanChatId64);
  },
  setListenForFriendsMessages(enabled: boolean): boolean {
    return native().friendsSetListenForFriendsMessages(enabled);
  },
  replyToFriendMessage(steamId64: bigint, message: string): boolean {
    return native().friendsReplyToFriendMessage(steamId64, message);
  },
  getFriendMessage(steamId64: bigint, messageId: number, maxBytes?: number | null): FriendMessage | null {
    return normalizeFriendMessage(native().friendsGetFriendMessage(steamId64, messageId, maxBytes ?? undefined));
  },
  async getFollowerCount(steamId64: bigint): Promise<FollowerCountResult> {
    return normalizeFollowerCountResult(await native().friendsGetFollowerCount(steamId64));
  },
  async isFollowing(steamId64: bigint): Promise<IsFollowingResult> {
    return normalizeIsFollowingResult(await native().friendsIsFollowing(steamId64));
  },
  async enumerateFollowingList(startIndex = 0): Promise<FollowingListResult> {
    return normalizeFollowingListResult(await native().friendsEnumerateFollowingList(startIndex));
  },
  isClanPublic(clanId64: bigint): boolean {
    return native().friendsIsClanPublic(clanId64);
  },
  isClanOfficialGameGroup(clanId64: bigint): boolean {
    return native().friendsIsClanOfficialGameGroup(clanId64);
  },
  getNumChatsWithUnreadPriorityMessages(): number {
    return native().friendsGetNumChatsWithUnreadPriorityMessages();
  },
  registerProtocolInOverlayBrowser(protocol: string): boolean {
    return native().friendsRegisterProtocolInOverlayBrowser(protocol);
  },
  activateGameOverlayRemotePlayTogetherInviteDialog(lobbyId64: bigint): void {
    native().friendsActivateGameOverlayRemotePlayTogetherInviteDialog(lobbyId64);
  },
  activateGameOverlayInviteDialogConnectString(connectString: string): void {
    native().friendsActivateGameOverlayInviteDialogConnectString(connectString);
  },
  async requestEquippedProfileItems(steamId64: bigint): Promise<EquippedProfileItemsResult> {
    return normalizeEquippedProfileItemsResult(await native().friendsRequestEquippedProfileItems(steamId64));
  },
  hasEquippedProfileItem(steamId64: bigint, itemType: number): boolean {
    return native().friendsHasEquippedProfileItem(steamId64, itemType);
  },
  getProfileItemPropertyString(steamId64: bigint, itemType: number, property: number): string {
    return native().friendsGetProfileItemPropertyString(steamId64, itemType, property);
  },
  getProfileItemPropertyUint(steamId64: bigint, itemType: number, property: number): number {
    return native().friendsGetProfileItemPropertyUint(steamId64, itemType, property);
  }
};

export const matchmaking = {
  LobbyType,
  LobbyComparison,
  LobbyDistanceFilter,
  FavoriteFlags,
  Lobby,
  favoriteGameCount(): number {
    return native().matchmakingGetFavoriteGameCount();
  },
  favoriteGame(index: number): MatchmakingFavoriteGame | null {
    return normalizeMatchmakingFavoriteGame(native().matchmakingGetFavoriteGame(index));
  },
  addFavoriteGame(favorite: MatchmakingFavoriteGame): number {
    return native().matchmakingAddFavoriteGame(
      favorite.appId,
      favorite.ip,
      favorite.connPort,
      favorite.queryPort,
      favorite.flags,
      favorite.lastPlayedOnServer
    );
  },
  removeFavoriteGame(favorite: Pick<MatchmakingFavoriteGame, "appId" | "ip" | "connPort" | "queryPort" | "flags">): boolean {
    return native().matchmakingRemoveFavoriteGame(
      favorite.appId,
      favorite.ip,
      favorite.connPort,
      favorite.queryPort,
      favorite.flags
    );
  },
  addRequestLobbyListStringFilter(key: string, value: string, comparison: number = LobbyComparison.Equal): void {
    native().matchmakingAddRequestLobbyListStringFilter(key, value, comparison);
  },
  addRequestLobbyListNumericalFilter(key: string, value: number, comparison: number = LobbyComparison.Equal): void {
    native().matchmakingAddRequestLobbyListNumericalFilter(key, value, comparison);
  },
  addRequestLobbyListNearValueFilter(key: string, value: number): void {
    native().matchmakingAddRequestLobbyListNearValueFilter(key, value);
  },
  addRequestLobbyListFilterSlotsAvailable(slots: number): void {
    native().matchmakingAddRequestLobbyListFilterSlotsAvailable(slots);
  },
  addRequestLobbyListDistanceFilter(distanceFilter: number): void {
    native().matchmakingAddRequestLobbyListDistanceFilter(distanceFilter);
  },
  addRequestLobbyListResultCountFilter(maxResults: number): void {
    native().matchmakingAddRequestLobbyListResultCountFilter(maxResults);
  },
  addRequestLobbyListCompatibleMembersFilter(lobbyId: bigint): void {
    native().matchmakingAddRequestLobbyListCompatibleMembersFilter(lobbyId);
  },
  async createLobby(lobbyType: number, maxMembers: number): Promise<Lobby> {
    const result = await native().matchmakingCreateLobby(lobbyType, maxMembers);
    return new Lobby(BigInt(result.id));
  },
  async joinLobby(lobbyId: bigint): Promise<Lobby> {
    const result = await native().matchmakingJoinLobby(lobbyId);
    return new Lobby(BigInt(result.id));
  },
  async getLobbies(options: LobbyListOptions = {}): Promise<Lobby[]> {
    applyLobbyListOptions(options);
    const result = await native().matchmakingGetLobbies();
    return result.map((lobby) => new Lobby(BigInt(lobby.id)));
  }
};

export const networking = {
  SendType,
  NetworkingSendFlags,
  NetworkingConnectionState,
  NetworkingAvailability,
  NetworkingFakeIpType,
  sendP2PPacket(steamId64: bigint, sendType: number, data: Buffer): boolean {
    return native().networkingSendP2PPacket(steamId64, sendType, data);
  },
  isP2PPacketAvailable(): number {
    return native().networkingIsP2PPacketAvailable();
  },
  readP2PPacket(size: number): P2PPacket {
    const packet = native().networkingReadP2PPacket(size);
    if (!packet) {
      throw new Error("No Steam P2P packet is available");
    }
    return normalizeP2PPacket(packet);
  },
  acceptP2PSession(steamId64: bigint): void {
    native().networkingAcceptP2PSession(steamId64);
  },
  messages: {
    SendFlags: NetworkingSendFlags,
    ConnectionState: NetworkingConnectionState,
    identityToString(identity: NetworkingIdentity): string {
      return native().networkingIdentityToString(nativeNetworkingIdentity(identity));
    },
    parseIdentity(text: string): NetworkingIdentityInfo | null {
      return normalizeNetworkingIdentityInfo(native().networkingIdentityParse(text));
    },
    sendMessageToUser(
      identity: NetworkingIdentity,
      data: Buffer | Uint8Array,
      sendFlags = NetworkingSendFlags.Reliable,
      channel = 0
    ): number {
      return native().networkingMessagesSendMessageToUser(
        nativeNetworkingIdentity(identity),
        Buffer.from(data),
        sendFlags,
        channel
      );
    },
    receiveMessagesOnChannel(channel = 0, maxMessages?: number | null): NetworkingMessage[] {
      return native()
        .networkingMessagesReceiveMessagesOnChannel(channel, maxMessages ?? undefined)
        .map(normalizeNetworkingMessage);
    },
    acceptSessionWithUser(identity: NetworkingIdentity): boolean {
      return native().networkingMessagesAcceptSessionWithUser(nativeNetworkingIdentity(identity));
    },
    closeSessionWithUser(identity: NetworkingIdentity): boolean {
      return native().networkingMessagesCloseSessionWithUser(nativeNetworkingIdentity(identity));
    },
    closeChannelWithUser(identity: NetworkingIdentity, channel: number): boolean {
      return native().networkingMessagesCloseChannelWithUser(nativeNetworkingIdentity(identity), channel);
    },
    getSessionConnectionInfo(identity: NetworkingIdentity): NetworkingMessagesSessionConnectionInfo {
      return normalizeNetworkingMessagesSessionConnectionInfo(
        native().networkingMessagesGetSessionConnectionInfo(nativeNetworkingIdentity(identity))
      );
    }
  },
  sockets: {
    SendFlags: NetworkingSendFlags,
    ConnectionState: NetworkingConnectionState,
    Availability: NetworkingAvailability,
    createListenSocketIP(address: NetworkingIpAddress): number {
      return native().networkingSocketsCreateListenSocketIp(nativeNetworkingIpAddress(address));
    },
    connectByIPAddress(address: NetworkingIpAddress): number {
      return native().networkingSocketsConnectByIpAddress(nativeNetworkingIpAddress(address));
    },
    createListenSocketP2P(localVirtualPort = 0): number {
      return native().networkingSocketsCreateListenSocketP2p(localVirtualPort);
    },
    connectP2P(identity: NetworkingIdentity, remoteVirtualPort = 0): number {
      return native().networkingSocketsConnectP2p(nativeNetworkingIdentity(identity), remoteVirtualPort);
    },
    acceptConnection(connection: number): number {
      return native().networkingSocketsAcceptConnection(connection);
    },
    closeConnection(connection: number, options: NetworkingCloseConnectionOptions = {}): boolean {
      return native().networkingSocketsCloseConnection(
        connection,
        options.reason,
        options.debug,
        options.enableLinger
      );
    },
    closeListenSocket(socket: number): boolean {
      return native().networkingSocketsCloseListenSocket(socket);
    },
    setConnectionUserData(connection: number, userData: bigint): boolean {
      return native().networkingSocketsSetConnectionUserData(connection, userData);
    },
    getConnectionUserData(connection: number): bigint {
      return BigInt(native().networkingSocketsGetConnectionUserData(connection));
    },
    setConnectionName(connection: number, name: string): void {
      native().networkingSocketsSetConnectionName(connection, name);
    },
    getConnectionName(connection: number): string | null {
      return native().networkingSocketsGetConnectionName(connection) ?? null;
    },
    sendMessageToConnection(
      connection: number,
      data: Buffer | Uint8Array,
      sendFlags = NetworkingSendFlags.Reliable
    ): NetworkingSocketSendResult {
      return normalizeNetworkingSocketSendResult(
        native().networkingSocketsSendMessageToConnection(connection, Buffer.from(data), sendFlags)
      );
    },
    flushMessagesOnConnection(connection: number): number {
      return native().networkingSocketsFlushMessagesOnConnection(connection);
    },
    receiveMessagesOnConnection(connection: number, maxMessages?: number | null): NetworkingMessage[] {
      return native()
        .networkingSocketsReceiveMessagesOnConnection(connection, maxMessages ?? undefined)
        .map(normalizeNetworkingMessage);
    },
    getConnectionInfo(connection: number): NetworkingConnectionInfo | null {
      return normalizeNetworkingConnectionInfo(native().networkingSocketsGetConnectionInfo(connection));
    },
    getConnectionRealTimeStatus(connection: number): NetworkingConnectionRealTimeStatus | null {
      return normalizeNetworkingRealTimeStatus(native().networkingSocketsGetConnectionRealTimeStatus(connection));
    },
    getDetailedConnectionStatus(connection: number, maxBytes?: number | null): string | null {
      return native().networkingSocketsGetDetailedConnectionStatus(connection, maxBytes ?? undefined) ?? null;
    },
    getListenSocketAddress(socket: number): NetworkingIpAddressInfo | null {
      return normalizeNetworkingIpAddressInfo(native().networkingSocketsGetListenSocketAddress(socket));
    },
    createSocketPair(
      useNetworkLoopback = false,
      identity1?: NetworkingIdentity | null,
      identity2?: NetworkingIdentity | null
    ): NetworkingSocketPair | null {
      return normalizeNetworkingSocketPair(
        native().networkingSocketsCreateSocketPair(
          useNetworkLoopback,
          identity1 ? nativeNetworkingIdentity(identity1) : undefined,
          identity2 ? nativeNetworkingIdentity(identity2) : undefined
        )
      );
    },
    configureConnectionLanes(connection: number, priorities: number[], weights?: number[] | null): number {
      return native().networkingSocketsConfigureConnectionLanes(connection, priorities, weights ?? undefined);
    },
    getIdentity(): NetworkingIdentityInfo | null {
      return normalizeNetworkingIdentityInfo(native().networkingSocketsGetIdentity());
    },
    initAuthentication(): number {
      return native().networkingSocketsInitAuthentication();
    },
    getAuthenticationStatus(): NetworkingAuthenticationStatus {
      return normalizeNetworkingAuthenticationStatus(native().networkingSocketsGetAuthenticationStatus());
    },
    createPollGroup(): number {
      return native().networkingSocketsCreatePollGroup();
    },
    runCallbacks(): void {
      native().networkingSocketsRunCallbacks();
    },
    destroyPollGroup(pollGroup: number): boolean {
      return native().networkingSocketsDestroyPollGroup(pollGroup);
    },
    setConnectionPollGroup(connection: number, pollGroup: number): boolean {
      return native().networkingSocketsSetConnectionPollGroup(connection, pollGroup);
    },
    receiveMessagesOnPollGroup(pollGroup: number, maxMessages?: number | null): NetworkingMessage[] {
      return native()
        .networkingSocketsReceiveMessagesOnPollGroup(pollGroup, maxMessages ?? undefined)
        .map(normalizeNetworkingMessage);
    },
    receivedRelayAuthTicket(ticket: Buffer | Uint8Array): boolean {
      return native().networkingSocketsReceivedRelayAuthTicket(Buffer.from(ticket));
    },
    findRelayAuthTicketForServer(identity: NetworkingIdentity, remoteVirtualPort = 0): number {
      return native().networkingSocketsFindRelayAuthTicketForServer(
        nativeNetworkingIdentity(identity),
        remoteVirtualPort
      );
    },
    connectToHostedDedicatedServer(identity: NetworkingIdentity, remoteVirtualPort = 0): number {
      return native().networkingSocketsConnectToHostedDedicatedServer(
        nativeNetworkingIdentity(identity),
        remoteVirtualPort
      );
    },
    getHostedDedicatedServerPort(): number {
      return native().networkingSocketsGetHostedDedicatedServerPort();
    },
    getHostedDedicatedServerPopId(): number {
      return native().networkingSocketsGetHostedDedicatedServerPopId();
    },
    createHostedDedicatedServerListenSocket(localVirtualPort = 0): number {
      return native().networkingSocketsCreateHostedDedicatedServerListenSocket(localVirtualPort);
    },
    getCertificateRequest(maxBytes?: number | null): NetworkingCertificateResult {
      return normalizeNetworkingCertificateResult(native().networkingSocketsGetCertificateRequest(maxBytes ?? undefined));
    },
    setCertificate(certificate: Buffer | Uint8Array): NetworkingCertificateResult {
      return normalizeNetworkingCertificateResult(native().networkingSocketsSetCertificate(Buffer.from(certificate)));
    },
    resetIdentity(identity?: NetworkingIdentity | null): void {
      native().networkingSocketsResetIdentity(identity ? nativeNetworkingIdentity(identity) : undefined);
    },
    beginAsyncRequestFakeIP(numPorts: number): boolean {
      return native().networkingSocketsBeginAsyncRequestFakeIp(numPorts);
    },
    getFakeIP(idxFirstPort = 0): NetworkingFakeIpResult {
      return normalizeNetworkingFakeIpResult(native().networkingSocketsGetFakeIp(idxFirstPort));
    },
    createListenSocketP2PFakeIP(idxFakePort = 0): number {
      return native().networkingSocketsCreateListenSocketP2pFakeIp(idxFakePort);
    },
    getRemoteFakeIPForConnection(connection: number): NetworkingRemoteFakeIpResult {
      return normalizeNetworkingRemoteFakeIpResult(native().networkingSocketsGetRemoteFakeIpForConnection(connection));
    }
  },
  utils: {
    Availability: NetworkingAvailability,
    FakeIpType: NetworkingFakeIpType,
    initRelayNetworkAccess(): void {
      native().networkingUtilsInitRelayNetworkAccess();
    },
    getRelayNetworkStatus(): NetworkingRelayNetworkStatus {
      return normalizeNetworkingRelayNetworkStatus(native().networkingUtilsGetRelayNetworkStatus());
    },
    getLocalPingLocation(): NetworkingPingLocation {
      return normalizeNetworkingPingLocation(native().networkingUtilsGetLocalPingLocation());
    },
    parsePingLocation(location: string): string | null {
      return native().networkingUtilsParsePingLocation(location) ?? null;
    },
    estimatePingTimeBetweenTwoLocations(location1: string, location2: string): number {
      return native().networkingUtilsEstimatePingTimeBetweenTwoLocations(location1, location2);
    },
    estimatePingTimeFromLocalHost(location: string): number {
      return native().networkingUtilsEstimatePingTimeFromLocalHost(location);
    },
    checkPingDataUpToDate(maxAgeSeconds?: number | null): boolean {
      return native().networkingUtilsCheckPingDataUpToDate(maxAgeSeconds ?? undefined);
    },
    getPingToDataCenter(popId: number): NetworkingPingDataCenter {
      return normalizeNetworkingPingDataCenter(native().networkingUtilsGetPingToDataCenter(popId));
    },
    getDirectPingToPop(popId: number): number {
      return native().networkingUtilsGetDirectPingToPop(popId);
    },
    getPopCount(): number {
      return native().networkingUtilsGetPopCount();
    },
    getPopList(maxPops?: number | null): number[] {
      return native().networkingUtilsGetPopList(maxPops ?? undefined);
    },
    getLocalTimestamp(): bigint {
      return native().networkingUtilsGetLocalTimestamp();
    },
    isFakeIpv4(ipv4: number): boolean {
      return native().networkingUtilsIsFakeIpv4(ipv4);
    },
    getIpv4FakeIpType(ipv4: number): number {
      return native().networkingUtilsGetIpv4FakeIpType(ipv4);
    },
    parseIpAddress(text: string): NetworkingIpAddressInfo | null {
      return normalizeNetworkingIpAddressInfo(native().networkingUtilsParseIpAddress(text));
    },
    ipAddressToString(address: NetworkingIpAddress, withPort = true): string {
      return native().networkingUtilsIpAddressToString(nativeNetworkingIpAddress(address), withPort);
    },
    getIpAddressFakeIpType(address: NetworkingIpAddress): number {
      return native().networkingUtilsGetIpAddressFakeIpType(nativeNetworkingIpAddress(address));
    },
    getRealIdentityForFakeIp(address: NetworkingIpAddress): NetworkingFakeIpIdentity {
      return normalizeNetworkingFakeIpIdentity(
        native().networkingUtilsGetRealIdentityForFakeIp(nativeNetworkingIpAddress(address))
      );
    }
  }
};

export const overlay = {
  Dialog,
  StoreFlag,
  activateDialog(dialog: number | string): void {
    activateOverlay(dialog);
  },
  activateDialogToUser(dialog: number | string, steamId64: bigint): void {
    native().overlayActivateDialogToUser(dialogName(dialog), steamId64);
  },
  activateInviteDialog(lobbyId: bigint): void {
    native().overlayActivateInviteDialog(lobbyId);
  },
  activateToWebPage(url: string, options?: OverlayWebPageOptions): void {
    activateOverlayToWebPage(url, options ?? {});
  },
  activateToStore(appId: number, flag: number): void {
    native().overlayActivateToStore(appId, flag);
  },
  openNativeOverlayProbeWindow,
  attachNativeOverlayHostView,
  pumpNativeOverlayProbeWindow,
  pumpNativeOverlayHostView,
  showNativeOverlayHostView,
  hideNativeOverlayHostView,
  updateNativeOverlayHostFrame,
  closeNativeOverlayProbeWindow,
  detachNativeOverlayHostView,
  isNativeOverlayProbeWindowOpen,
  isNativeOverlayHostViewOpen,
  getMacWindowSnapshot
};

export const stats = {
  LeaderboardDataRequest,
  LeaderboardSortMethod,
  LeaderboardDisplayType,
  LeaderboardUploadScoreMethod,
  getInt(name: string): number | null {
    return native().statsGetInt(name) ?? null;
  },
  getFloat(name: string): number | null {
    return native().statsGetFloat(name) ?? null;
  },
  setInt(name: string, value: number): boolean {
    return native().statsSetInt(name, value);
  },
  setFloat(name: string, value: number): boolean {
    return native().statsSetFloat(name, value);
  },
  updateAvgRate(name: string, countThisSession: number, sessionLength: number): boolean {
    return native().statsUpdateAvgRate(name, countThisSession, sessionLength);
  },
  store(): boolean {
    return native().statsStore();
  },
  resetAll(achievementsToo: boolean): boolean {
    return native().statsResetAll(achievementsToo);
  },
  async requestUserStats(steamId64: bigint): Promise<UserStatsReceivedResult> {
    return normalizeUserStatsReceivedResult(await native().statsRequestUserStats(steamId64));
  },
  getUserInt(steamId64: bigint, name: string): number | null {
    return native().statsGetUserInt(steamId64, name) ?? null;
  },
  getUserFloat(steamId64: bigint, name: string): number | null {
    return native().statsGetUserFloat(steamId64, name) ?? null;
  },
  getUserAchievement(steamId64: bigint, name: string): boolean | null {
    return native().statsGetUserAchievement(steamId64, name) ?? null;
  },
  getUserAchievementAndUnlockTime(steamId64: bigint, name: string): AchievementUnlockTime | null {
    return normalizeAchievementUnlockTime(native().statsGetUserAchievementAndUnlockTime(steamId64, name));
  },
  async getNumberOfCurrentPlayers(): Promise<NumberOfCurrentPlayersResult> {
    return normalizeNumberOfCurrentPlayersResult(await native().statsGetNumberOfCurrentPlayers());
  },
  async requestGlobalAchievementPercentages(): Promise<GlobalAchievementPercentagesReady> {
    return normalizeGlobalAchievementPercentagesReady(await native().statsRequestGlobalAchievementPercentages());
  },
  getMostAchievedAchievementInfo(): GlobalAchievementInfo | null {
    return normalizeGlobalAchievementInfo(native().statsGetMostAchievedAchievementInfo());
  },
  getNextMostAchievedAchievementInfo(previousIterator: number): GlobalAchievementInfo | null {
    return normalizeGlobalAchievementInfo(native().statsGetNextMostAchievedAchievementInfo(previousIterator));
  },
  getAchievementAchievedPercent(name: string): number | null {
    return native().statsGetAchievementAchievedPercent(name) ?? null;
  },
  async requestGlobalStats(historyDays: number): Promise<GlobalStatsReceivedResult> {
    return normalizeGlobalStatsReceivedResult(await native().statsRequestGlobalStats(historyDays));
  },
  getGlobalStatInt(name: string): bigint | null {
    const value = native().statsGetGlobalStatInt(name);
    return value == null ? null : BigInt(value);
  },
  getGlobalStatDouble(name: string): number | null {
    return native().statsGetGlobalStatDouble(name) ?? null;
  },
  getGlobalStatHistoryInt(name: string, maxEntries = 60): bigint[] {
    return native().statsGetGlobalStatHistoryInt(name, maxEntries).map(BigInt);
  },
  getGlobalStatHistoryDouble(name: string, maxEntries = 60): number[] {
    return native().statsGetGlobalStatHistoryDouble(name, maxEntries).map(Number);
  },
  async findOrCreateLeaderboard(
    name: string,
    sortMethod: number,
    displayType: number
  ): Promise<LeaderboardFindResult> {
    return normalizeLeaderboardFindResult(await native().statsFindOrCreateLeaderboard(name, sortMethod, displayType));
  },
  async findLeaderboard(name: string): Promise<LeaderboardFindResult> {
    return normalizeLeaderboardFindResult(await native().statsFindLeaderboard(name));
  },
  getLeaderboardName(leaderboard: bigint): string {
    return native().statsGetLeaderboardName(leaderboard);
  },
  getLeaderboardEntryCount(leaderboard: bigint): number {
    return native().statsGetLeaderboardEntryCount(leaderboard);
  },
  getLeaderboardSortMethod(leaderboard: bigint): number {
    return native().statsGetLeaderboardSortMethod(leaderboard);
  },
  getLeaderboardDisplayType(leaderboard: bigint): number {
    return native().statsGetLeaderboardDisplayType(leaderboard);
  },
  async downloadLeaderboardEntries(
    leaderboard: bigint,
    request: number,
    rangeStart: number,
    rangeEnd: number,
    detailsMax?: number
  ): Promise<LeaderboardScoresDownloaded> {
    return normalizeLeaderboardScoresDownloaded(
      await native().statsDownloadLeaderboardEntries(leaderboard, request, rangeStart, rangeEnd, detailsMax)
    );
  },
  async downloadLeaderboardEntriesForUsers(
    leaderboard: bigint,
    steamIds64: bigint[],
    detailsMax?: number
  ): Promise<LeaderboardScoresDownloaded> {
    return normalizeLeaderboardScoresDownloaded(
      await native().statsDownloadLeaderboardEntriesForUsers(leaderboard, steamIds64, detailsMax)
    );
  },
  getDownloadedLeaderboardEntry(entriesHandle: bigint, index: number, detailsMax?: number): LeaderboardEntry | null {
    return normalizeLeaderboardEntry(native().statsGetDownloadedLeaderboardEntry(entriesHandle, index, detailsMax));
  },
  async uploadLeaderboardScore(
    leaderboard: bigint,
    method: number,
    score: number,
    scoreDetails: number[] = []
  ): Promise<LeaderboardScoreUploaded> {
    return normalizeLeaderboardScoreUploaded(
      await native().statsUploadLeaderboardScore(leaderboard, method, score, scoreDetails)
    );
  },
  async attachLeaderboardUgc(leaderboard: bigint, ugcHandle: bigint): Promise<LeaderboardUgcSetResult> {
    return normalizeLeaderboardUgcSetResult(await native().statsAttachLeaderboardUgc(leaderboard, ugcHandle));
  }
};

export const screenshots = {
  VRScreenshotType,
  writeScreenshot(rgb: Buffer, width: number, height: number): number {
    return native().screenshotsWriteScreenshot(rgb, width, height);
  },
  addScreenshotToLibrary(
    filename: string,
    thumbnailFilename: string | null | undefined,
    width: number,
    height: number
  ): number {
    return native().screenshotsAddScreenshotToLibrary(filename, thumbnailFilename, width, height);
  },
  triggerScreenshot(): void {
    native().screenshotsTriggerScreenshot();
  },
  hookScreenshots(hook: boolean): void {
    native().screenshotsHookScreenshots(hook);
  },
  setLocation(handle: number, location: string): boolean {
    return native().screenshotsSetLocation(handle, location);
  },
  tagUser(handle: number, steamId64: bigint): boolean {
    return native().screenshotsTagUser(handle, steamId64);
  },
  tagPublishedFile(handle: number, publishedFileId: bigint): boolean {
    return native().screenshotsTagPublishedFile(handle, publishedFileId);
  },
  isScreenshotsHooked(): boolean {
    return native().screenshotsIsScreenshotsHooked();
  },
  addVrScreenshotToLibrary(vrType: number, filename: string, vrFilename: string): number {
    return native().screenshotsAddVrScreenshotToLibrary(vrType, filename, vrFilename);
  }
};

export const music = {
  AudioPlaybackStatus,
  isEnabled(): boolean {
    return native().musicIsEnabled();
  },
  isPlaying(): boolean {
    return native().musicIsPlaying();
  },
  getPlaybackStatus(): number {
    return native().musicGetPlaybackStatus();
  },
  play(): void {
    native().musicPlay();
  },
  pause(): void {
    native().musicPause();
  },
  playPrevious(): void {
    native().musicPlayPrevious();
  },
  playNext(): void {
    native().musicPlayNext();
  },
  setVolume(volume: number): void {
    native().musicSetVolume(volume);
  },
  getVolume(): number {
    return native().musicGetVolume();
  }
};

export const video = {
  requestVideoUrl(appId: number): void {
    native().videoRequestVideoUrl(appId);
  },
  isBroadcasting(): VideoBroadcastStatus {
    return normalizeVideoBroadcastStatus(native().videoIsBroadcasting());
  },
  requestOpfSettings(appId: number): void {
    native().videoRequestOpfSettings(appId);
  },
  getOpfStringForApp(appId: number): string | null {
    return native().videoGetOpfStringForApp(appId) ?? null;
  }
};

export const parental = {
  ParentalFeature,
  isParentalLockEnabled(): boolean {
    return native().parentalIsParentalLockEnabled();
  },
  isParentalLockLocked(): boolean {
    return native().parentalIsParentalLockLocked();
  },
  isAppBlocked(appId: number): boolean {
    return native().parentalIsAppBlocked(appId);
  },
  isAppInBlockList(appId: number): boolean {
    return native().parentalIsAppInBlockList(appId);
  },
  isFeatureBlocked(feature: number): boolean {
    return native().parentalIsFeatureBlocked(feature);
  },
  isFeatureInBlockList(feature: number): boolean {
    return native().parentalIsFeatureInBlockList(feature);
  }
};

export const timeline = {
  TimelineGameMode,
  TimelineEventClipPriority,
  TimelinePriority,
  setTimelineTooltip(description: string, timeDelta = 0): void {
    native().timelineSetTimelineTooltip(description, timeDelta);
  },
  clearTimelineTooltip(timeDelta = 0): void {
    native().timelineClearTimelineTooltip(timeDelta);
  },
  setTimelineGameMode(mode: number): void {
    native().timelineSetTimelineGameMode(mode);
  },
  addInstantaneousTimelineEvent(
    title: string,
    description: string,
    icon: string,
    iconPriority: number,
    startOffsetSeconds: number,
    clipPriority: number
  ): bigint {
    return BigInt(
      native().timelineAddInstantaneousTimelineEvent(title, description, icon, iconPriority, startOffsetSeconds, clipPriority)
    );
  },
  addRangeTimelineEvent(
    title: string,
    description: string,
    icon: string,
    iconPriority: number,
    startOffsetSeconds: number,
    duration: number,
    clipPriority: number
  ): bigint {
    return BigInt(
      native().timelineAddRangeTimelineEvent(title, description, icon, iconPriority, startOffsetSeconds, duration, clipPriority)
    );
  },
  startRangeTimelineEvent(
    title: string,
    description: string,
    icon: string,
    priority: number,
    startOffsetSeconds: number,
    clipPriority: number
  ): bigint {
    return BigInt(
      native().timelineStartRangeTimelineEvent(title, description, icon, priority, startOffsetSeconds, clipPriority)
    );
  },
  updateRangeTimelineEvent(
    event: bigint,
    title: string,
    description: string,
    icon: string,
    priority: number,
    clipPriority: number
  ): void {
    native().timelineUpdateRangeTimelineEvent(event, title, description, icon, priority, clipPriority);
  },
  endRangeTimelineEvent(event: bigint, endOffsetSeconds = 0): void {
    native().timelineEndRangeTimelineEvent(event, endOffsetSeconds);
  },
  removeTimelineEvent(event: bigint): void {
    native().timelineRemoveTimelineEvent(event);
  },
  async doesEventRecordingExist(event: bigint): Promise<TimelineEventRecordingExists> {
    return normalizeTimelineEventRecordingExists(await native().timelineDoesEventRecordingExist(event));
  },
  startGamePhase(): void {
    native().timelineStartGamePhase();
  },
  endGamePhase(): void {
    native().timelineEndGamePhase();
  },
  setGamePhaseId(phaseId: string): void {
    native().timelineSetGamePhaseId(phaseId);
  },
  async doesGamePhaseRecordingExist(phaseId: string): Promise<TimelineGamePhaseRecordingExists> {
    return normalizeTimelineGamePhaseRecordingExists(await native().timelineDoesGamePhaseRecordingExist(phaseId));
  },
  addGamePhaseTag(tagName: string, tagIcon: string, tagGroup: string, priority: number): void {
    native().timelineAddGamePhaseTag(tagName, tagIcon, tagGroup, priority);
  },
  setGamePhaseAttribute(attributeGroup: string, attributeValue: string, priority: number): void {
    native().timelineSetGamePhaseAttribute(attributeGroup, attributeValue, priority);
  },
  openOverlayToGamePhase(phaseId: string): void {
    native().timelineOpenOverlayToGamePhase(phaseId);
  },
  openOverlayToTimelineEvent(event: bigint): void {
    native().timelineOpenOverlayToTimelineEvent(event);
  }
};

export const remotePlay = {
  RemotePlayDeviceFormFactor,
  RemotePlayInputType,
  RemotePlayMouseButton,
  RemotePlayMouseWheelDirection,
  RemotePlayKeyModifier,
  getSessionCount(): number {
    return native().remotePlayGetSessionCount();
  },
  getSessionId(index: number): number {
    return native().remotePlayGetSessionId(index);
  },
  getSessions(): RemotePlaySessionInfo[] {
    return native().remotePlayGetSessions().map(normalizeRemotePlaySessionInfo);
  },
  isRemotePlayTogether(sessionId: number): boolean {
    return native().remotePlayIsRemotePlayTogether(sessionId);
  },
  getSessionSteamId(sessionId: number): SteamId {
    return normalizeSteamId(native().remotePlayGetSessionSteamId(sessionId));
  },
  getSessionGuestId(sessionId: number): number {
    return native().remotePlayGetSessionGuestId(sessionId);
  },
  getSmallSessionAvatar(sessionId: number): number {
    return native().remotePlayGetSmallSessionAvatar(sessionId);
  },
  getMediumSessionAvatar(sessionId: number): number {
    return native().remotePlayGetMediumSessionAvatar(sessionId);
  },
  getLargeSessionAvatar(sessionId: number): number {
    return native().remotePlayGetLargeSessionAvatar(sessionId);
  },
  getSessionClientName(sessionId: number): string {
    return native().remotePlayGetSessionClientName(sessionId);
  },
  getSessionClientFormFactor(sessionId: number): number {
    return native().remotePlayGetSessionClientFormFactor(sessionId);
  },
  getSessionClientResolution(sessionId: number): RemotePlayResolution | null {
    return normalizeRemotePlayResolution(native().remotePlayGetSessionClientResolution(sessionId));
  },
  showRemotePlayTogetherUi(): boolean {
    return native().remotePlayShowRemotePlayTogetherUi();
  },
  sendRemotePlayTogetherInvite(steamId64: bigint): boolean {
    return native().remotePlaySendRemotePlayTogetherInvite(steamId64);
  },
  enableRemotePlayTogetherDirectInput(): boolean {
    return native().remotePlayEnableRemotePlayTogetherDirectInput();
  },
  disableRemotePlayTogetherDirectInput(): void {
    native().remotePlayDisableRemotePlayTogetherDirectInput();
  },
  getInput(maxEvents = 32): RemotePlayInputEvent[] {
    return native().remotePlayGetInput(maxEvents).map(normalizeRemotePlayInputEvent);
  },
  setMouseVisibility(sessionId: number, visible: boolean): void {
    native().remotePlaySetMouseVisibility(sessionId, visible);
  },
  setMousePosition(sessionId: number, normalizedX: number, normalizedY: number): void {
    native().remotePlaySetMousePosition(sessionId, normalizedX, normalizedY);
  },
  createMouseCursor(width: number, height: number, hotX: number, hotY: number, bgra: Buffer, pitch: number): number {
    return native().remotePlayCreateMouseCursor(width, height, hotX, hotY, bgra, pitch);
  },
  setMouseCursor(sessionId: number, cursorId: number): void {
    native().remotePlaySetMouseCursor(sessionId, cursorId);
  }
};

export const utils = {
  SteamUniverse,
  OverlayNotificationPosition,
  GamepadTextInputMode,
  GamepadTextInputLineMode,
  FloatingGamepadTextInputMode,
  TextFilteringContext,
  IPv6ConnectivityProtocol,
  IPv6ConnectivityState,
  CheckFileSignature,
  getAppId,
  getServerRealTime(): number {
    return native().utilsGetServerRealTime();
  },
  getSecondsSinceAppActive(): number {
    return native().utilsGetSecondsSinceAppActive();
  },
  getSecondsSinceComputerActive(): number {
    return native().utilsGetSecondsSinceComputerActive();
  },
  getConnectedUniverse(): number {
    return native().utilsGetConnectedUniverse();
  },
  getSteamUILanguage(): string {
    return native().utilsGetSteamUiLanguage();
  },
  getImageSize(image: number): UtilsImageSize | null {
    return normalizeUtilsImageSize(native().utilsGetImageSize(image));
  },
  getImageRGBA(image: number): Buffer | null {
    return native().utilsGetImageRgba(image) ?? null;
  },
  getCurrentBatteryPower(): number {
    return native().utilsGetCurrentBatteryPower();
  },
  getIPCCallCount(): number {
    return native().utilsGetIpcCallCount();
  },
  registerWarningMessageHook(handler: (event: UtilsWarningMessage) => void): CallbackHandle {
    return wrapCallbackHandle(
      native().utilsRegisterWarningMessageHook((event) => {
        handler(normalizeUtilsWarningMessage(event));
      })
    );
  },
  isApiCallCompleted(apiCall: bigint | number | string): UtilsApiCallCompletion {
    return normalizeUtilsApiCallCompletion(native().utilsIsApiCallCompleted(BigInt(apiCall)));
  },
  getApiCallFailureReason(apiCall: bigint | number | string): number {
    return native().utilsGetApiCallFailureReason(BigInt(apiCall));
  },
  getApiCallResult(
    apiCall: bigint | number | string,
    expectedCallback: number,
    byteLength: number
  ): UtilsApiCallResult {
    return normalizeUtilsApiCallResult(
      native().utilsGetApiCallResult(BigInt(apiCall), expectedCallback, byteLength)
    );
  },
  async checkFileSignature(fileName: string, timeoutSeconds?: number | null): Promise<number> {
    return native().utilsCheckFileSignature(fileName, timeoutSeconds ?? undefined);
  },
  setOverlayNotificationPosition(position: number): void {
    native().utilsSetOverlayNotificationPosition(position);
  },
  setOverlayNotificationInset(horizontal: number, vertical: number): void {
    native().utilsSetOverlayNotificationInset(horizontal, vertical);
  },
  isSteamRunningOnSteamDeck: isSteamDeck,
  isSteamRunning,
  getSteamInstallPath,
  isSteamInBigPictureMode,
  isOverlayEnabled,
  overlayNeedsPresent,
  getOverlayDiagnostics,
  isSteamRunningInVR(): boolean {
    return native().utilsIsSteamRunningInVr();
  },
  startVRDashboard(): void {
    native().utilsStartVrDashboard();
  },
  isVRHeadsetStreamingEnabled(): boolean {
    return native().utilsIsVrHeadsetStreamingEnabled();
  },
  setVRHeadsetStreamingEnabled(enabled: boolean): void {
    native().utilsSetVrHeadsetStreamingEnabled(enabled);
  },
  isSteamChinaLauncher(): boolean {
    return native().utilsIsSteamChinaLauncher();
  },
  initFilterText(options = 0): boolean {
    return native().utilsInitFilterText(options);
  },
  filterText(
    context: number,
    sourceSteamId64: bigint | number | string | null | undefined,
    input: string,
    maxBytes?: number
  ): UtilsFilteredText {
    return normalizeUtilsFilteredText(
      native().utilsFilterText(context, BigInt(sourceSteamId64 ?? 0), input, maxBytes)
    );
  },
  getIPv6ConnectivityState(protocol: number): number {
    return native().utilsGetIpv6ConnectivityState(protocol);
  },
  setGameLauncherMode(enabled: boolean): void {
    native().utilsSetGameLauncherMode(enabled);
  },
  dismissFloatingGamepadTextInput(): boolean {
    return native().utilsDismissFloatingGamepadTextInput();
  },
  dismissGamepadTextInput(): boolean {
    return native().utilsDismissGamepadTextInput();
  },
  async showGamepadTextInput(
    inputMode: number,
    inputLineMode: number,
    description: string,
    maxCharacters: number,
    existingText?: string | null
  ): Promise<string | null> {
    return (await native().utilsShowGamepadTextInput(
      inputMode,
      inputLineMode,
      description,
      maxCharacters,
      existingText ?? undefined
    )) ?? null;
  },
  async showFloatingGamepadTextInput(
    keyboardMode: number,
    x: number,
    y: number,
    width: number,
    height: number
  ): Promise<boolean> {
    return native().utilsShowFloatingGamepadTextInput(keyboardMode, x, y, width, height);
  }
};

export const workshop = {
  UgcItemVisibility,
  UpdateStatus,
  UGCQueryType,
  UGCType,
  UserListType,
  UserListOrder,
  async createItem(appId?: number | null): Promise<UgcResult> {
    return normalizeUgcResult(await native().workshopCreateItem(appId ?? undefined));
  },
  async updateItem(itemId: bigint, updateDetails: UgcUpdate, appId?: number | null): Promise<UgcResult> {
    return normalizeUgcResult(await native().workshopUpdateItem(itemId, updateDetails, appId ?? undefined));
  },
  updateItemWithCallback(
    itemId: bigint,
    updateDetails: UgcUpdate,
    appId: number | undefined | null,
    successCallback: (data: UgcResult) => void,
    errorCallback: (err: unknown) => void,
    progressCallback?: (data: UpdateProgress) => void,
    progressCallbackIntervalMs?: number | null
  ): void {
    const promise = progressCallback
      ? native()
          .workshopUpdateItemWithProgress(
            itemId,
            updateDetails,
            appId,
            (data) => progressCallback(normalizeUpdateProgress(data)),
            progressCallbackIntervalMs ?? undefined
          )
          .then(normalizeUgcResult)
      : native().workshopUpdateItem(itemId, updateDetails, appId ?? undefined).then(normalizeUgcResult);

    promise.then(successCallback, errorCallback);
  },
  async subscribe(itemId: bigint): Promise<void> {
    await native().workshopSubscribe(itemId);
  },
  async unsubscribe(itemId: bigint): Promise<void> {
    await native().workshopUnsubscribe(itemId);
  },
  state(itemId: bigint): number {
    return native().workshopState(itemId);
  },
  installInfo(itemId: bigint): InstallInfo | null {
    return normalizeInstallInfo(native().workshopInstallInfo(itemId));
  },
  downloadInfo(itemId: bigint): DownloadInfo | null {
    return normalizeDownloadInfo(native().workshopDownloadInfo(itemId));
  },
  download(itemId: bigint, highPriority: boolean): boolean {
    return native().workshopDownload(itemId, highPriority);
  },
  getSubscribedItems(): bigint[] {
    return native().workshopGetSubscribedItems().map(BigInt);
  },
  async getItem(item: bigint, queryConfig?: WorkshopItemQueryConfig | null): Promise<WorkshopItem | null> {
    const result = await this.getItems([item], queryConfig ?? undefined);
    return result.items[0] ?? null;
  },
  async getItems(items: bigint[], queryConfig?: WorkshopItemQueryConfig | null): Promise<WorkshopItemsResult> {
    const result = await native().workshopGetItems(items, queryConfig ?? undefined);
    return {
      items: result.items.map(normalizeWorkshopItem),
      wasCached: Boolean(result.wasCached ?? result.was_cached)
    };
  },
  async getAllItems(
    page: number,
    queryType: number,
    itemType: number,
    creatorAppId: number,
    consumerAppId: number,
    queryConfig?: WorkshopItemQueryConfig | null
  ): Promise<WorkshopPaginatedResult> {
    return normalizeWorkshopPaginatedResult(
      await native().workshopGetAllItems(page, queryType, itemType, creatorAppId, consumerAppId, queryConfig ?? undefined)
    );
  },
  async getUserItems(
    page: number,
    accountId: number,
    listType: number,
    itemType: number,
    sortOrder: number,
    appIds: AppIDs,
    queryConfig?: WorkshopItemQueryConfig | null
  ): Promise<WorkshopPaginatedResult> {
    return normalizeWorkshopPaginatedResult(
      await native().workshopGetUserItems(
        page,
        accountId,
        listType,
        itemType,
        sortOrder,
        appIds.creator ?? appIds.consumer ?? getAppId(),
        appIds.consumer ?? appIds.creator ?? getAppId(),
        queryConfig ?? undefined
      )
    );
  }
};

export interface SteamBridgeClient {
  achievement: typeof achievement;
  apps: typeof apps;
  auth: typeof auth;
  callback: typeof callback;
  cloud: typeof cloud;
  friends: typeof friends;
  http: typeof http;
  inventory: typeof inventory;
  input: typeof input;
  localplayer: typeof localplayer;
  matchmaking: typeof matchmaking;
  networking: typeof networking;
  overlay: typeof overlay;
  music: typeof music;
  parties: typeof parties;
  parental: typeof parental;
  remotePlay: typeof remotePlay;
  screenshots: typeof screenshots;
  stats: typeof stats;
  timeline: typeof timeline;
  utils: typeof utils;
  video: typeof video;
  workshop: typeof workshop;
}

export function createCompatibilityClient(): SteamBridgeClient {
  return {
    achievement,
    apps,
    auth,
    callback,
    cloud,
    friends,
    http,
    inventory,
    input,
    localplayer,
    matchmaking,
    networking,
    overlay,
    music,
    parties,
    parental,
    remotePlay,
    screenshots,
    stats,
    timeline,
    utils,
    video,
    workshop
  };
}

function native(): NativeBinding {
  return loadNativeBinding();
}

function normalizeInitOptions(options?: InitOptions | number | null): Required<InitOptions> {
  if (typeof options === "number") {
    return { appId: options, callbackIntervalMs: activeCallbackIntervalMs };
  }

  if (options == null) {
    const appId = Number(process.env.SteamAppId ?? process.env.SteamAppID ?? process.env.STEAM_APP_ID);
    if (!Number.isInteger(appId) || appId <= 0) {
      throw new Error("Steam Bridge init requires an appId or STEAM_APP_ID/SteamAppId environment variable");
    }
    return { appId, callbackIntervalMs: activeCallbackIntervalMs };
  }

  if (!Number.isInteger(options.appId) || options.appId <= 0) {
    throw new Error("Steam Bridge init requires a positive integer appId");
  }

  return {
    appId: options.appId,
    callbackIntervalMs: options.callbackIntervalMs ?? activeCallbackIntervalMs
  };
}

function startCallbackPump(intervalMs: number): void {
  activeCallbackIntervalMs = intervalMs;

  if (callbackTimer) {
    clearInterval(callbackTimer);
  }

  callbackTimer = setInterval(() => {
    try {
      native().runCallbacks();
    } catch {
      stopCallbackPump();
    }
  }, intervalMs);

  callbackTimer.unref?.();
}

function stopCallbackPump(): void {
  if (callbackTimer) {
    clearInterval(callbackTimer);
    callbackTimer = undefined;
  }
}

function normalizeSteamId(steamId: NativeSteamId): SteamId {
  return {
    steamId64: BigInt(steamId.steamId64),
    steamId32: steamId.steamId32,
    accountId: steamId.accountId
  };
}

const EMPTY_NATIVE_STEAM_ID: NativeSteamId = {
  steamId64: 0n,
  steamId32: "STEAM_0:0:0",
  accountId: 0
};

function normalizeFriendGameInfo(info: NativeFriendGameInfo | null | undefined): FriendGameInfo | null {
  if (!info) {
    return null;
  }

  const source = info as Record<string, unknown>;
  return {
    gameId: BigInt((source.gameId ?? source.game_id ?? 0) as bigint | number | string),
    gameIp: Number(source.gameIp ?? source.game_ip ?? 0),
    gamePort: Number(source.gamePort ?? source.game_port ?? 0),
    queryPort: Number(source.queryPort ?? source.query_port ?? 0),
    lobby: BigInt((source.lobby ?? 0) as bigint | number | string)
  };
}

function normalizeFriendMessage(message: NativeFriendMessage | null | undefined): FriendMessage | null {
  if (!message) {
    return null;
  }
  const source = message as unknown as Record<string, unknown>;
  return {
    data: message.data,
    size: Number(source.size ?? message.data.length),
    text: String(source.text ?? ""),
    entryType: Number(source.entryType ?? source.entry_type ?? 0)
  };
}

function normalizeFriendsGroupInfo(group: NativeFriendsGroupInfo): FriendsGroupInfo {
  return {
    id: group.id,
    name: group.name,
    members: (group.members ?? []).map(normalizeSteamId)
  };
}

function normalizeEquippedProfileItemsResult(
  result: NativeEquippedProfileItemsResult
): EquippedProfileItemsResult {
  const source = result as unknown as Record<string, unknown>;
  return {
    result: Number(source.result ?? 0),
    steamId: normalizeSteamId((source.steamId ?? source.steam_id ?? EMPTY_NATIVE_STEAM_ID) as NativeSteamId),
    hasAnimatedAvatar: Boolean(source.hasAnimatedAvatar ?? source.has_animated_avatar),
    hasAvatarFrame: Boolean(source.hasAvatarFrame ?? source.has_avatar_frame),
    hasProfileModifier: Boolean(source.hasProfileModifier ?? source.has_profile_modifier),
    hasProfileBackground: Boolean(source.hasProfileBackground ?? source.has_profile_background),
    hasMiniProfileBackground: Boolean(source.hasMiniProfileBackground ?? source.has_mini_profile_background),
    fromCache: Boolean(source.fromCache ?? source.from_cache)
  };
}

function normalizeHttpRequestCompleted(result: NativeHttpRequestCompleted): HttpRequestCompleted {
  const source = result as unknown as Record<string, unknown>;
  return {
    request: Number(source.request ?? 0),
    contextValue: BigInt((source.contextValue ?? source.context_value ?? 0) as bigint | number | string),
    requestSuccessful: Boolean(source.requestSuccessful ?? source.request_successful),
    statusCode: Number(source.statusCode ?? source.status_code ?? 0),
    bodySize: Number(source.bodySize ?? source.body_size ?? 0)
  };
}

function normalizeHttpRequestHeadersReceived(result: NativeHttpRequestHeadersReceived): HttpRequestHeadersReceived {
  const source = result as unknown as Record<string, unknown>;
  return {
    request: Number(source.request ?? 0),
    contextValue: BigInt((source.contextValue ?? source.context_value ?? 0) as bigint | number | string)
  };
}

function normalizePartyBeaconLocation(location: NativePartyBeaconLocation): PartyBeaconLocation {
  const source = location as unknown as Record<string, unknown>;
  return {
    locationType: Number(source.locationType ?? source.location_type ?? 0),
    locationId: BigInt((source.locationId ?? source.location_id ?? 0) as bigint | number | string)
  };
}

function nativePartyBeaconLocation(location: PartyBeaconLocation): NativePartyBeaconLocation {
  return {
    locationType: location.locationType,
    locationId: location.locationId
  };
}

function normalizePartyBeaconDetails(details: NativePartyBeaconDetails | null | undefined): PartyBeaconDetails | null {
  if (!details) {
    return null;
  }
  const source = details as unknown as Record<string, unknown>;
  return {
    beacon: BigInt((source.beacon ?? 0) as bigint | number | string),
    owner: normalizeSteamId(details.owner),
    location: normalizePartyBeaconLocation(details.location),
    metadata: details.metadata
  };
}

function normalizeJoinPartyResult(result: NativeJoinPartyResult): JoinPartyResult {
  const source = result as unknown as Record<string, unknown>;
  return {
    result: result.result,
    beacon: BigInt((source.beacon ?? 0) as bigint | number | string),
    owner: normalizeSteamId(result.owner),
    connectString: String(source.connectString ?? source.connect_string ?? "")
  };
}

function normalizeCreateBeaconResult(result: NativeCreateBeaconResult): CreateBeaconResult {
  const source = result as unknown as Record<string, unknown>;
  return {
    result: result.result,
    beacon: BigInt((source.beacon ?? 0) as bigint | number | string)
  };
}

function normalizeChangeNumOpenSlotsResult(result: NativeChangeNumOpenSlotsResult): ChangeNumOpenSlotsResult {
  return {
    result: result.result
  };
}

function normalizeMatchmakingFavoriteGame(
  game: NativeMatchmakingFavoriteGame | null | undefined
): MatchmakingFavoriteGame | null {
  if (!game) {
    return null;
  }
  const source = game as unknown as Record<string, unknown>;
  return {
    appId: Number(source.appId ?? source.app_id ?? 0),
    ip: Number(source.ip ?? 0),
    ipAddress: String(source.ipAddress ?? source.ip_address ?? ""),
    connPort: Number(source.connPort ?? source.conn_port ?? 0),
    queryPort: Number(source.queryPort ?? source.query_port ?? 0),
    flags: Number(source.flags ?? 0),
    lastPlayedOnServer: Number(source.lastPlayedOnServer ?? source.last_played_on_server ?? 0)
  };
}

function normalizeLobbyChatEntry(entry: NativeLobbyChatEntry | null | undefined): LobbyChatEntry | null {
  if (!entry) {
    return null;
  }
  const source = entry as unknown as Record<string, unknown>;
  return {
    steamId: normalizeSteamId((source.steamId ?? source.steam_id ?? EMPTY_NATIVE_STEAM_ID) as NativeSteamId),
    data: entry.data,
    size: Number(entry.size ?? 0),
    text: String(entry.text ?? ""),
    entryType: Number(source.entryType ?? source.entry_type ?? 0)
  };
}

function normalizeLobbyGameServer(server: NativeLobbyGameServer | null | undefined): LobbyGameServer | null {
  if (!server) {
    return null;
  }
  const source = server as unknown as Record<string, unknown>;
  return {
    ip: Number(source.ip ?? 0),
    ipAddress: String(source.ipAddress ?? source.ip_address ?? ""),
    port: Number(source.port ?? 0),
    steamId: normalizeSteamId((source.steamId ?? source.steam_id ?? EMPTY_NATIVE_STEAM_ID) as NativeSteamId)
  };
}

function applyLobbyListOptions(options: LobbyListOptions): void {
  for (const filter of options.stringFilters ?? []) {
    matchmaking.addRequestLobbyListStringFilter(filter.key, filter.value, filter.comparison ?? LobbyComparison.Equal);
  }
  for (const filter of options.numericalFilters ?? []) {
    matchmaking.addRequestLobbyListNumericalFilter(filter.key, filter.value, filter.comparison ?? LobbyComparison.Equal);
  }
  for (const filter of options.nearValueFilters ?? []) {
    matchmaking.addRequestLobbyListNearValueFilter(filter.key, filter.value);
  }
  if (options.slotsAvailable !== undefined) {
    matchmaking.addRequestLobbyListFilterSlotsAvailable(options.slotsAvailable);
  }
  if (options.distanceFilter !== undefined) {
    matchmaking.addRequestLobbyListDistanceFilter(options.distanceFilter);
  }
  if (options.resultCount !== undefined) {
    matchmaking.addRequestLobbyListResultCountFilter(options.resultCount);
  }
  if (options.compatibleLobby !== undefined) {
    matchmaking.addRequestLobbyListCompatibleMembersFilter(options.compatibleLobby);
  }
}

function normalizeAppDlcData(data: NativeAppDlcData | null | undefined): AppDlcData | null {
  if (!data) {
    return null;
  }
  return {
    appId: Number(data.appId ?? data.app_id ?? 0),
    available: Boolean(data.available),
    name: data.name
  };
}

function normalizeAppDlcDownloadProgress(
  progress: NativeAppDlcDownloadProgress | null | undefined
): AppDlcDownloadProgress | null {
  if (!progress) {
    return null;
  }
  return {
    bytesDownloaded: BigInt(progress.bytesDownloaded ?? progress.bytes_downloaded ?? 0),
    bytesTotal: BigInt(progress.bytesTotal ?? progress.bytes_total ?? 0)
  };
}

function normalizeAppTimedTrialInfo(info: NativeAppTimedTrialInfo | null | undefined): AppTimedTrialInfo | null {
  if (!info) {
    return null;
  }
  return {
    secondsAllowed: Number(info.secondsAllowed ?? info.seconds_allowed ?? 0),
    secondsPlayed: Number(info.secondsPlayed ?? info.seconds_played ?? 0)
  };
}

function normalizeAppBetaCounts(counts: NativeAppBetaCounts): AppBetaCounts {
  return {
    total: counts.total,
    available: counts.available,
    private: counts.private
  };
}

function normalizeAppBetaInfo(info: NativeAppBetaInfo | null | undefined): AppBetaInfo | null {
  if (!info) {
    return null;
  }
  return {
    flags: info.flags,
    buildId: Number(info.buildId ?? info.build_id ?? 0),
    name: info.name,
    description: info.description,
    lastUpdated: Number(info.lastUpdated ?? info.last_updated ?? 0)
  };
}

function normalizeAppFileDetails(details: NativeAppFileDetails): AppFileDetails {
  const source = details as unknown as Record<string, unknown>;
  const sha = Buffer.from(details.sha);
  return {
    result: details.result,
    fileSize: BigInt((source.fileSize ?? source.file_size ?? 0) as bigint | number | string),
    sha,
    shaHex: String(source.shaHex ?? source.sha_hex ?? sha.toString("hex")),
    flags: details.flags
  };
}

function normalizeInventoryItemDetail(item: NativeInventoryItemDetail): InventoryItemDetail {
  const source = item as unknown as Record<string, unknown>;
  return {
    itemId: BigInt((source.itemId ?? source.item_id ?? 0) as bigint | number | string),
    definition: item.definition,
    quantity: item.quantity,
    flags: item.flags
  };
}

function nativeInventoryItemQuantity(item: InventoryItemQuantity): NativeInventoryItemQuantity {
  return {
    definition: item.definition,
    quantity: item.quantity
  };
}

function nativeInventoryInstanceQuantity(item: InventoryInstanceQuantity): NativeInventoryInstanceQuantity {
  return {
    itemId: item.itemId,
    quantity: item.quantity
  };
}

function normalizeInventoryEligiblePromoItemDefIds(
  result: NativeInventoryEligiblePromoItemDefIds
): InventoryEligiblePromoItemDefIds {
  return {
    result: result.result,
    steamId: normalizeSteamId((result.steamId ?? result.steam_id ?? EMPTY_NATIVE_STEAM_ID) as NativeSteamId),
    numEligiblePromoItemDefs: Number(result.numEligiblePromoItemDefs ?? result.num_eligible_promo_item_defs ?? 0),
    cachedData: Boolean(result.cachedData ?? result.cached_data)
  };
}

function normalizeInventoryStartPurchaseResult(
  result: NativeInventoryStartPurchaseResult
): InventoryStartPurchaseResult {
  const source = result as unknown as Record<string, unknown>;
  return {
    result: result.result,
    orderId: BigInt((source.orderId ?? source.order_id ?? 0) as bigint | number | string),
    transactionId: BigInt((source.transactionId ?? source.transaction_id ?? 0) as bigint | number | string)
  };
}

function normalizeInventoryRequestPricesResult(
  result: NativeInventoryRequestPricesResult
): InventoryRequestPricesResult {
  return {
    result: result.result,
    currency: result.currency
  };
}

function normalizeInventoryPrice(price: NativeInventoryPrice): InventoryPrice {
  const source = price as unknown as Record<string, unknown>;
  return {
    definition: price.definition,
    currentPrice: BigInt((source.currentPrice ?? source.current_price ?? 0) as bigint | number | string),
    basePrice: BigInt((source.basePrice ?? source.base_price ?? 0) as bigint | number | string)
  };
}

function normalizeClanActivityCounts(counts: NativeClanActivityCounts | null | undefined): ClanActivityCounts | null {
  if (!counts) {
    return null;
  }

  const source = counts as unknown as Record<string, unknown>;
  return {
    online: Number(source.online ?? 0),
    inGame: Number(source.inGame ?? source.in_game ?? 0),
    chatting: Number(source.chatting ?? 0)
  };
}

function normalizeClanOfficerListResult(result: NativeClanOfficerListResult): ClanOfficerListResult {
  const source = result as unknown as Record<string, unknown>;
  return {
    clan: normalizeSteamId((source.clan ?? EMPTY_NATIVE_STEAM_ID) as NativeSteamId),
    officers: Number(source.officers ?? 0),
    success: Boolean(source.success)
  };
}

function normalizeClanChatJoinResult(result: NativeClanChatJoinResult): ClanChatJoinResult {
  const source = result as unknown as Record<string, unknown>;
  return {
    clanChat: normalizeSteamId((source.clanChat ?? source.clan_chat ?? EMPTY_NATIVE_STEAM_ID) as NativeSteamId),
    response: Number(source.response ?? 0)
  };
}

function normalizeFollowerCountResult(result: NativeFollowerCountResult): FollowerCountResult {
  const source = result as unknown as Record<string, unknown>;
  return {
    steamId: normalizeSteamId((source.steamId ?? source.steam_id ?? EMPTY_NATIVE_STEAM_ID) as NativeSteamId),
    result: Number(source.result ?? 0),
    count: Number(source.count ?? 0)
  };
}

function normalizeIsFollowingResult(result: NativeIsFollowingResult): IsFollowingResult {
  const source = result as unknown as Record<string, unknown>;
  return {
    steamId: normalizeSteamId((source.steamId ?? source.steam_id ?? EMPTY_NATIVE_STEAM_ID) as NativeSteamId),
    result: Number(source.result ?? 0),
    isFollowing: Boolean(source.isFollowing ?? source.is_following)
  };
}

function normalizeFollowingListResult(result: NativeFollowingListResult): FollowingListResult {
  const source = result as unknown as Record<string, unknown>;
  const steamIds = (source.steamIds ?? source.steam_ids ?? []) as NativeSteamId[];
  return {
    result: Number(source.result ?? 0),
    steamIds: steamIds.map(normalizeSteamId),
    returnedResults: Number(source.returnedResults ?? source.returned_results ?? steamIds.length),
    totalResults: Number(source.totalResults ?? source.total_results ?? steamIds.length)
  };
}

function wrapCallbackHandle(handle: NativeCallbackHandle): CallbackHandle {
  return {
    disconnect: () => handle.disconnect()
  };
}

function normalizeCallbackEvent(callbackId: number, event: unknown): unknown {
  if (callbackId === SteamCallback.MicroTxnAuthorizationResponse) {
    return normalizeMicroTxnEvent(event);
  }
  if (callbackId === SteamCallback.GameOverlayActivated) {
    return normalizeGameOverlayEvent(event);
  }
  if (
    callbackId === SteamCallback.SteamInventoryResultReady ||
    callbackId === SteamCallback.SteamInventoryFullUpdate ||
    callbackId === SteamCallback.SteamInventoryEligiblePromoItemDefIds ||
    callbackId === SteamCallback.SteamInventoryStartPurchaseResult ||
    callbackId === SteamCallback.SteamInventoryRequestPricesResult
  ) {
    return normalizeInventoryCallbackEvent(event);
  }
  if (
    callbackId === SteamCallback.SteamNetworkingMessagesSessionRequest ||
    callbackId === SteamCallback.SteamNetworkingMessagesSessionFailed
  ) {
    return normalizeNetworkingMessagesCallbackEvent(event);
  }
  if (callbackId === SteamCallback.SteamNetConnectionStatusChanged) {
    return normalizeNetworkingSocketsCallbackEvent(event);
  }
  if (callbackId === SteamCallback.SteamNetworkingFakeIPResult) {
    return normalizeNetworkingFakeIpCallbackEvent(event);
  }
  if (
    callbackId === SteamCallback.SteamNetAuthenticationStatus ||
    callbackId === SteamCallback.SteamRelayNetworkStatus
  ) {
    return normalizeNetworkingUtilsCallbackEvent(callbackId, event);
  }
  if (!event || typeof event !== "object") {
    return event;
  }
  const source = event as Record<string, unknown>;
  const result: Record<string, unknown> = { ...source };
  for (const key of [
    "steam_id",
    "lobby",
    "member",
    "user",
    "admin",
    "game_id",
    "game_server",
    "user_changed",
    "making_change",
    "remote",
    "lobby_steam_id",
    "friend_steam_id",
    "async_call",
    "file_size"
  ]) {
    if (key in result) {
      result[key] = normalizeBigIntLike(result[key]);
    }
  }
  if (result.steam_id !== undefined) {
    result.steamId ??= result.steam_id;
  }
  const aliases: Record<string, string> = {
    account_id: "accountId",
    app_id: "appId",
    async_call: "asyncCall",
    chat_id: "chatId",
    chat_permissions: "chatPermissions",
    chat_room_enter_response: "chatRoomEnterResponse",
    check_file_signature: "checkFileSignature",
    conn_port: "connPort",
    entry_type: "entryType",
    file_size: "fileSize",
    friend_steam_id: "friendSteamId",
    game_id: "gameId",
    game_server: "gameServer",
    ip_address: "ipAddress",
    is_offline: "isOffline",
    key_length: "keyLength",
    kicked_due_to_disconnect: "kickedDueToDisconnect",
    lobby_steam_id: "lobbySteamId",
    making_change: "makingChange",
    member_state_change: "memberStateChange",
    minutes_battery_left: "minutesBatteryLeft",
    parameter_size: "parameterSize",
    query_port: "queryPort",
    seconds_allowed: "secondsAllowed",
    seconds_played: "secondsPlayed",
    sha_hex: "shaHex",
    submitted_text: "submittedText",
    user_changed: "userChanged"
  };
  for (const [snake, camel] of Object.entries(aliases)) {
    if (result[snake] !== undefined) {
      result[camel] ??= result[snake];
    }
  }
  return result;
}

function normalizeInventoryCallbackEvent(event: unknown): unknown {
  if (!event || typeof event !== "object") {
    return event;
  }

  const source = event as Record<string, unknown>;
  const normalized: Record<string, unknown> = { ...source };

  if (source.steam_id !== undefined) {
    normalized.steam_id = normalizeBigIntLike(source.steam_id);
    normalized.steamId ??= normalized.steam_id;
  }

  if (source.num_eligible_promo_item_defs !== undefined) {
    normalized.numEligiblePromoItemDefs ??= Number(source.num_eligible_promo_item_defs);
  }

  if (source.cached_data !== undefined) {
    normalized.cachedData ??= Boolean(source.cached_data);
  }

  if (source.order_id !== undefined) {
    normalized.orderId ??= normalizeOrderId(source.order_id);
  }

  if (source.transaction_id !== undefined) {
    normalized.transactionId ??= normalizeOrderId(source.transaction_id);
  }

  return normalized;
}

function normalizeNetworkingMessagesCallbackEvent(event: unknown): unknown {
  if (!event || typeof event !== "object") {
    return event;
  }

  const source = event as Record<string, unknown>;
  const normalized: Record<string, unknown> = { ...source };

  if (source.remote_identity !== undefined) {
    normalized.remoteIdentity = normalizeNetworkingIdentityInfo(
      source.remote_identity as NativeNetworkingIdentityInfo
    );
  }

  if (source.info !== undefined) {
    normalized.info = normalizeNetworkingMessagesSessionConnectionInfo(
      source.info as NativeNetworkingMessagesSessionConnectionInfo
    );
  }

  return normalized;
}

function normalizeNetworkingSocketsCallbackEvent(event: unknown): unknown {
  if (!event || typeof event !== "object") {
    return event;
  }
  const source = event as Record<string, unknown>;
  const normalized: Record<string, unknown> = { ...source };
  normalized.connection = Number(source.connection ?? 0);
  normalized.oldState = Number(source.oldState ?? source.old_state ?? 0);
  normalized.old_state ??= normalized.oldState;
  if (source.info && typeof source.info === "object") {
    normalized.info = normalizeNetworkingConnectionInfo(source.info as NativeNetworkingConnectionInfo);
  }
  return normalized;
}

function normalizeNetworkingFakeIpCallbackEvent(event: unknown): unknown {
  if (!event || typeof event !== "object") {
    return event;
  }
  const source = event as Record<string, unknown>;
  return {
    ...source,
    ...normalizeNetworkingFakeIpResult(source as unknown as NativeNetworkingFakeIpResult)
  };
}

function normalizeNetworkingUtilsCallbackEvent(callbackId: number, event: unknown): unknown {
  if (!event || typeof event !== "object") {
    return event;
  }

  const source = event as Record<string, unknown>;
  const normalized: Record<string, unknown> = { ...source };

  if (callbackId === SteamCallback.SteamNetAuthenticationStatus) {
    const status = normalizeNetworkingAuthenticationStatus(source as unknown as NativeNetworkingAuthenticationStatus);
    normalized.availability = status.availability;
    normalized.debugMessage ??= status.debugMessage;
  }

  if (source.debug_message !== undefined) {
    normalized.debugMessage ??= String(source.debug_message);
  }

  if (source.ping_measurement_in_progress !== undefined) {
    normalized.pingMeasurementInProgress ??= Boolean(source.ping_measurement_in_progress);
  }

  if (source.network_config_availability !== undefined) {
    normalized.networkConfigAvailability ??= Number(source.network_config_availability);
  }

  if (source.any_relay_availability !== undefined) {
    normalized.anyRelayAvailability ??= Number(source.any_relay_availability);
  }

  return normalized;
}

function normalizeMicroTxnEvent(event: unknown): MicroTxnAuthorizationResponse {
  if (!event || typeof event !== "object") {
    return { value: event };
  }

  const source = event as Record<string, unknown>;
  const normalized: MicroTxnAuthorizationResponse = { ...source };

  if (typeof source.app_id === "number" && normalized.appId === undefined) {
    normalized.appId = source.app_id;
  }

  if (source.order_id !== undefined && normalized.orderId === undefined) {
    normalized.orderId = normalizeOrderId(source.order_id);
  }

  return normalized;
}

function normalizeGameOverlayEvent(event: unknown): GameOverlayActivated {
  if (!event || typeof event !== "object") {
    return { value: event };
  }

  const source = event as Record<string, unknown>;
  const normalized: GameOverlayActivated = { ...source };

  if (typeof source.user_initiated === "boolean" && normalized.userInitiated === undefined) {
    normalized.userInitiated = source.user_initiated;
  }

  if (typeof source.app_id === "number" && normalized.appId === undefined) {
    normalized.appId = source.app_id;
  }

  if (typeof source.overlay_pid === "number" && normalized.overlayPid === undefined) {
    normalized.overlayPid = source.overlay_pid;
  }

  return normalized;
}

function normalizeOverlayDiagnostics(diagnostics: NativeOverlayDiagnostics): OverlayDiagnostics {
  return {
    steamRunning: diagnostics.steamRunning,
    steamInstallPath: diagnostics.steamInstallPath,
    appId: diagnostics.appId,
    overlayEnabled: diagnostics.overlayEnabled,
    overlayNeedsPresent: diagnostics.overlayNeedsPresent,
    steamDeck: diagnostics.steamDeck,
    bigPicture: diagnostics.bigPicture,
    platform: process.platform,
    arch: process.arch,
    pid: process.pid
  };
}

function normalizeUtilsImageSize(size: NativeUtilsImageSize | null | undefined): UtilsImageSize | null {
  if (!size) {
    return null;
  }
  return {
    width: size.width,
    height: size.height
  };
}

function normalizeUtilsApiCallCompletion(result: NativeUtilsApiCallCompletion): UtilsApiCallCompletion {
  return {
    completed: Boolean(result.completed),
    failed: Boolean(result.failed)
  };
}

function normalizeUtilsApiCallResult(result: NativeUtilsApiCallResult): UtilsApiCallResult {
  return {
    ok: Boolean(result.ok),
    failed: Boolean(result.failed),
    data: result.data ?? null
  };
}

function normalizeUtilsWarningMessage(event: NativeUtilsWarningMessage): UtilsWarningMessage {
  return {
    severity: Number(event.severity),
    message: String(event.message)
  };
}

function normalizeUtilsFilteredText(result: NativeUtilsFilteredText): UtilsFilteredText {
  return {
    filtered: result.filtered,
    charactersFiltered: Number(result.charactersFiltered ?? result.characters_filtered ?? 0)
  };
}

function normalizeOrderId(value: unknown): bigint | string | number {
  if (typeof value === "bigint" || typeof value === "number") {
    return value;
  }

  if (typeof value === "string") {
    try {
      return BigInt(value);
    } catch {
      return value;
    }
  }

  return String(value);
}

function normalizeBigIntLike(value: unknown): bigint | unknown {
  if (typeof value === "bigint") {
    return value;
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return BigInt(Math.trunc(value));
  }
  if (typeof value === "string" && /^\d+$/.test(value)) {
    return BigInt(value);
  }
  return value;
}

function normalizeInputType(value: string): InputTypeValue {
  return Object.values(InputType).includes(value as InputTypeValue) ? (value as InputTypeValue) : InputType.Unknown;
}

function dialogName(dialog: number | string): string {
  if (typeof dialog === "string") {
    return dialog;
  }
  return ["Friends", "Community", "Players", "Settings", "OfficialGameGroup", "Stats", "Achievements"][dialog] ?? "Friends";
}

function normalizeP2PPacket(packet: NativeP2PPacket): P2PPacket {
  return {
    data: packet.data,
    size: packet.size,
    steamId: normalizeSteamId(packet.steamId)
  };
}

function nativeNetworkingIdentity(identity: NetworkingIdentity): NativeNetworkingIdentity {
  const output: NativeNetworkingIdentity = {};
  if (identity.steamId64 !== undefined) {
    output.steamId64 = identity.steamId64;
  }
  if (identity.text !== undefined) {
    output.text = identity.text;
  }
  if (identity.genericString !== undefined) {
    output.genericString = identity.genericString;
  }
  if (identity.localHost !== undefined) {
    output.localHost = identity.localHost;
  }
  return output;
}

function nativeNetworkingIpAddress(address: NetworkingIpAddress): NativeNetworkingIpAddress {
  const output: NativeNetworkingIpAddress = {};
  if (address.text !== undefined) {
    output.text = address.text;
  }
  if (address.ipv4 !== undefined) {
    output.ipv4 = address.ipv4;
  }
  if (address.port !== undefined) {
    output.port = address.port;
  }
  if (address.localHost !== undefined) {
    output.localHost = address.localHost;
  }
  return output;
}

function normalizeNetworkingIdentityInfo(
  identity: NativeNetworkingIdentityInfo | null | undefined
): NetworkingIdentityInfo | null {
  if (!identity) {
    return null;
  }
  const source = identity as unknown as Record<string, unknown>;
  const steamId64 = source.steamId64 ?? source.steam_id64;
  return {
    identityType: Number(source.identityType ?? source.identity_type ?? 0),
    text: String(source.text ?? ""),
    steamId64: steamId64 == null ? null : BigInt(steamId64 as bigint | number | string),
    genericString: ((source.genericString ?? source.generic_string) as string | null | undefined) ?? null,
    localHost: Boolean(source.localHost ?? source.local_host),
    invalid: Boolean(source.invalid),
    fakeIpType: Number(source.fakeIpType ?? source.fake_ip_type ?? 0)
  };
}

function normalizeNetworkingIdentityInfoRequired(
  identity: NativeNetworkingIdentityInfo | null | undefined
): NetworkingIdentityInfo {
  return (
    normalizeNetworkingIdentityInfo(identity) ?? {
      identityType: 0,
      text: "",
      steamId64: null,
      genericString: null,
      localHost: false,
      invalid: true,
      fakeIpType: 0
    }
  );
}

function normalizeNetworkingRelayNetworkStatus(
  status: NativeNetworkingRelayNetworkStatus
): NetworkingRelayNetworkStatus {
  const source = status as unknown as Record<string, unknown>;
  return {
    availability: Number(status.availability),
    pingMeasurementInProgress: Boolean(source.pingMeasurementInProgress ?? source.ping_measurement_in_progress),
    networkConfigAvailability: Number(source.networkConfigAvailability ?? source.network_config_availability ?? 0),
    anyRelayAvailability: Number(source.anyRelayAvailability ?? source.any_relay_availability ?? 0),
    debugMessage: String(source.debugMessage ?? source.debug_message ?? "")
  };
}

function normalizeNetworkingAuthenticationStatus(
  status: NativeNetworkingAuthenticationStatus
): NetworkingAuthenticationStatus {
  const source = status as unknown as Record<string, unknown>;
  return {
    availability: Number(status.availability),
    debugMessage: String(source.debugMessage ?? source.debug_message ?? "")
  };
}

function normalizeNetworkingPingLocation(location: NativeNetworkingPingLocation): NetworkingPingLocation {
  const source = location as unknown as Record<string, unknown>;
  return {
    location: String(location.location ?? ""),
    ageSeconds: Number(source.ageSeconds ?? source.age_seconds ?? 0)
  };
}

function normalizeNetworkingPingDataCenter(dataCenter: NativeNetworkingPingDataCenter): NetworkingPingDataCenter {
  const source = dataCenter as unknown as Record<string, unknown>;
  return {
    pingMs: Number(source.pingMs ?? source.ping_ms ?? 0),
    viaRelayPop: Number(source.viaRelayPop ?? source.via_relay_pop ?? 0)
  };
}

function normalizeNetworkingIpAddressInfo(
  address: NativeNetworkingIpAddressInfo | null | undefined
): NetworkingIpAddressInfo | null {
  if (!address) {
    return null;
  }
  const source = address as unknown as Record<string, unknown>;
  const ipv4 = source.ipv4;
  const ipv4Address = source.ipv4Address ?? source.ipv4_address;
  return {
    text: String(address.text ?? ""),
    ipv4: ipv4 == null ? null : Number(ipv4),
    port: Number(source.port ?? 0),
    ipv4Address: ipv4Address == null ? null : String(ipv4Address),
    isIpv4: Boolean(source.isIpv4 ?? source.is_ipv4),
    isLocalHost: Boolean(source.isLocalHost ?? source.is_local_host),
    isFakeIp: Boolean(source.isFakeIp ?? source.is_fake_ip),
    fakeIpType: Number(source.fakeIpType ?? source.fake_ip_type ?? 0),
    ipv6AllZeros: Boolean(source.ipv6AllZeros ?? source.ipv6_all_zeros)
  };
}

function normalizeNetworkingFakeIpIdentity(identity: NativeNetworkingFakeIpIdentity): NetworkingFakeIpIdentity {
  return {
    result: Number(identity.result ?? 0),
    identity: normalizeNetworkingIdentityInfo(identity.identity)
  };
}

function normalizeNetworkingFakeIpResult(result: NativeNetworkingFakeIpResult): NetworkingFakeIpResult {
  const source = result as unknown as Record<string, unknown>;
  return {
    result: Number(source.result ?? 0),
    identity: normalizeNetworkingIdentityInfoRequired(result.identity),
    ipv4: Number(source.ipv4 ?? 0),
    ipv4Address: String(source.ipv4Address ?? source.ipv4_address ?? ""),
    ports: Array.isArray(source.ports) ? source.ports.map(Number) : []
  };
}

function normalizeNetworkingRemoteFakeIpResult(result: NativeNetworkingRemoteFakeIpResult): NetworkingRemoteFakeIpResult {
  return {
    result: Number(result.result ?? 0),
    address: normalizeNetworkingIpAddressInfo(result.address)
  };
}

function normalizeNetworkingCertificateResult(result: NativeNetworkingCertificateResult): NetworkingCertificateResult {
  return {
    success: Boolean(result.success),
    data: result.data,
    error: result.error
  };
}

function normalizeNetworkingSocketPair(
  pair: NativeNetworkingSocketPair | null | undefined
): NetworkingSocketPair | null {
  if (!pair) {
    return null;
  }
  const source = pair as unknown as Record<string, unknown>;
  return {
    connection1: Number(source.connection1 ?? source.connection_1 ?? 0),
    connection2: Number(source.connection2 ?? source.connection_2 ?? 0)
  };
}

function normalizeNetworkingSocketSendResult(result: NativeNetworkingSocketSendResult): NetworkingSocketSendResult {
  const source = result as unknown as Record<string, unknown>;
  return {
    result: Number(result.result ?? 0),
    messageNumber: BigInt((source.messageNumber ?? source.message_number ?? 0) as bigint | number | string)
  };
}

function normalizeNetworkingMessage(message: NativeNetworkingMessage): NetworkingMessage {
  const source = message as unknown as Record<string, unknown>;
  return {
    data: message.data,
    size: Number(message.size),
    peer: normalizeNetworkingIdentityInfoRequired(message.peer),
    connection: Number(message.connection),
    connectionUserData: BigInt((source.connectionUserData ?? source.connection_user_data ?? 0) as bigint | number | string),
    timeReceived: BigInt((source.timeReceived ?? source.time_received ?? 0) as bigint | number | string),
    messageNumber: BigInt((source.messageNumber ?? source.message_number ?? 0) as bigint | number | string),
    channel: Number(message.channel),
    flags: Number(message.flags),
    userData: BigInt((source.userData ?? source.user_data ?? 0) as bigint | number | string),
    lane: Number(message.lane)
  };
}

function normalizeNetworkingConnectionInfo(
  info: NativeNetworkingConnectionInfo | null | undefined
): NetworkingConnectionInfo | null {
  if (!info) {
    return null;
  }
  const source = info as unknown as Record<string, unknown>;
  return {
    state: Number(info.state),
    remoteIdentity: normalizeNetworkingIdentityInfoRequired(
      (source.remoteIdentity ?? source.remote_identity) as NativeNetworkingIdentityInfo | null | undefined
    ),
    userData: BigInt((source.userData ?? source.user_data ?? 0) as bigint | number | string),
    listenSocket: Number(source.listenSocket ?? source.listen_socket ?? 0),
    remoteAddress: normalizeNetworkingIpAddressInfo(
      (source.remoteAddress ?? source.remote_address) as NativeNetworkingIpAddressInfo | null | undefined
    ),
    remotePop: Number(source.remotePop ?? source.remote_pop ?? 0),
    relayPop: Number(source.relayPop ?? source.relay_pop ?? 0),
    endReason: Number(source.endReason ?? source.end_reason ?? 0),
    endDebug: String(source.endDebug ?? source.end_debug ?? ""),
    connectionDescription: String(source.connectionDescription ?? source.connection_description ?? ""),
    flags: Number(info.flags ?? 0)
  };
}

function normalizeNetworkingRealTimeStatus(
  status: NativeNetworkingConnectionRealTimeStatus | null | undefined
): NetworkingConnectionRealTimeStatus | null {
  if (!status) {
    return null;
  }
  const source = status as unknown as Record<string, unknown>;
  return {
    state: Number(status.state),
    ping: Number(status.ping),
    connectionQualityLocal: Number(source.connectionQualityLocal ?? source.connection_quality_local ?? 0),
    connectionQualityRemote: Number(source.connectionQualityRemote ?? source.connection_quality_remote ?? 0),
    outPacketsPerSecond: Number(source.outPacketsPerSecond ?? source.out_packets_per_second ?? 0),
    outBytesPerSecond: Number(source.outBytesPerSecond ?? source.out_bytes_per_second ?? 0),
    inPacketsPerSecond: Number(source.inPacketsPerSecond ?? source.in_packets_per_second ?? 0),
    inBytesPerSecond: Number(source.inBytesPerSecond ?? source.in_bytes_per_second ?? 0),
    sendRateBytesPerSecond: Number(source.sendRateBytesPerSecond ?? source.send_rate_bytes_per_second ?? 0),
    pendingUnreliable: Number(source.pendingUnreliable ?? source.pending_unreliable ?? 0),
    pendingReliable: Number(source.pendingReliable ?? source.pending_reliable ?? 0),
    sentUnackedReliable: Number(source.sentUnackedReliable ?? source.sent_unacked_reliable ?? 0),
    queueTime: BigInt((source.queueTime ?? source.queue_time ?? 0) as bigint | number | string),
    maxJitter: Number(source.maxJitter ?? source.max_jitter ?? 0)
  };
}

function normalizeNetworkingMessagesSessionConnectionInfo(
  info: NativeNetworkingMessagesSessionConnectionInfo
): NetworkingMessagesSessionConnectionInfo {
  const source = info as unknown as Record<string, unknown>;
  return {
    state: Number(info.state),
    remoteIdentity: normalizeNetworkingIdentityInfoRequired(
      (source.remoteIdentity ?? source.remote_identity) as NativeNetworkingIdentityInfo | null | undefined
    ),
    userData: BigInt((source.userData ?? source.user_data ?? 0) as bigint | number | string),
    listenSocket: Number(source.listenSocket ?? source.listen_socket ?? 0),
    remotePop: Number(source.remotePop ?? source.remote_pop ?? 0),
    relayPop: Number(source.relayPop ?? source.relay_pop ?? 0),
    endReason: Number(source.endReason ?? source.end_reason ?? 0),
    endDebug: String(source.endDebug ?? source.end_debug ?? ""),
    connectionDescription: String(source.connectionDescription ?? source.connection_description ?? ""),
    flags: Number(info.flags ?? 0),
    quickStatus: normalizeNetworkingRealTimeStatus(
      (source.quickStatus ?? source.quick_status) as NativeNetworkingConnectionRealTimeStatus | null | undefined
    )
  };
}

function normalizeVideoBroadcastStatus(status: NativeVideoBroadcastStatus): VideoBroadcastStatus {
  return {
    broadcasting: Boolean(status.broadcasting),
    viewers: Number(status.viewers)
  };
}

function normalizeAchievementUnlockTime(
  result: NativeAchievementUnlockTime | null | undefined
): AchievementUnlockTime | null {
  if (!result) {
    return null;
  }
  const source = result as unknown as Record<string, unknown>;
  return {
    achieved: Boolean(source.achieved),
    unlockTime: Number(source.unlockTime ?? source.unlock_time ?? 0)
  };
}

function normalizeUserStatsReceivedResult(result: NativeUserStatsReceivedResult): UserStatsReceivedResult {
  const source = result as unknown as Record<string, unknown>;
  return {
    gameId: BigInt((source.gameId ?? source.game_id ?? 0) as bigint | number | string),
    result: Number(source.result ?? 0),
    steamId: normalizeSteamId((source.steamId ?? source.steam_id ?? EMPTY_NATIVE_STEAM_ID) as NativeSteamId)
  };
}

function normalizeNumberOfCurrentPlayersResult(
  result: NativeNumberOfCurrentPlayersResult
): NumberOfCurrentPlayersResult {
  return {
    success: Boolean(result.success),
    players: Number(result.players)
  };
}

function normalizeGlobalAchievementPercentagesReady(
  result: NativeGlobalAchievementPercentagesReady
): GlobalAchievementPercentagesReady {
  const source = result as unknown as Record<string, unknown>;
  return {
    gameId: BigInt((source.gameId ?? source.game_id ?? 0) as bigint | number | string),
    result: Number(source.result ?? 0)
  };
}

function normalizeGlobalStatsReceivedResult(result: NativeGlobalStatsReceivedResult): GlobalStatsReceivedResult {
  const source = result as unknown as Record<string, unknown>;
  return {
    gameId: BigInt((source.gameId ?? source.game_id ?? 0) as bigint | number | string),
    result: Number(source.result ?? 0)
  };
}

function normalizeGlobalAchievementInfo(
  result: NativeGlobalAchievementInfo | null | undefined
): GlobalAchievementInfo | null {
  if (!result) {
    return null;
  }
  return {
    iterator: Number(result.iterator),
    name: String(result.name),
    percent: Number(result.percent),
    achieved: Boolean(result.achieved)
  };
}

function normalizeAchievementProgressLimitsInt(
  result: NativeAchievementProgressLimitsInt | null | undefined
): AchievementProgressLimitsInt | null {
  return result ? { min: Number(result.min), max: Number(result.max) } : null;
}

function normalizeAchievementProgressLimitsFloat(
  result: NativeAchievementProgressLimitsFloat | null | undefined
): AchievementProgressLimitsFloat | null {
  return result ? { min: Number(result.min), max: Number(result.max) } : null;
}

function normalizeLeaderboardFindResult(result: NativeLeaderboardFindResult): LeaderboardFindResult {
  const source = result as unknown as Record<string, unknown>;
  return {
    leaderboard: BigInt((source.leaderboard ?? 0) as bigint | number | string),
    found: Boolean(source.found)
  };
}

function normalizeLeaderboardEntry(entry: NativeLeaderboardEntry | null | undefined): LeaderboardEntry | null {
  if (!entry) {
    return null;
  }
  const source = entry as unknown as Record<string, unknown>;
  return {
    steamId: normalizeSteamId((source.steamId ?? source.steam_id ?? EMPTY_NATIVE_STEAM_ID) as NativeSteamId),
    globalRank: Number(source.globalRank ?? source.global_rank ?? 0),
    score: Number(source.score ?? 0),
    details: Array.isArray(source.details) ? source.details.map(Number) : [],
    ugc: BigInt((source.ugc ?? 0) as bigint | number | string)
  };
}

function normalizeLeaderboardScoresDownloaded(
  result: NativeLeaderboardScoresDownloaded
): LeaderboardScoresDownloaded {
  const source = result as unknown as Record<string, unknown>;
  const entries = Array.isArray(source.entries) ? source.entries : [];
  const normalizedEntries = entries
    .map((entry) => normalizeLeaderboardEntry(entry as NativeLeaderboardEntry))
    .filter((entry): entry is LeaderboardEntry => entry !== null);
  return {
    leaderboard: BigInt((source.leaderboard ?? 0) as bigint | number | string),
    entriesHandle: BigInt((source.entriesHandle ?? source.entries_handle ?? 0) as bigint | number | string),
    entryCount: Number(source.entryCount ?? source.entry_count ?? 0),
    entries: normalizedEntries
  };
}

function normalizeLeaderboardScoreUploaded(result: NativeLeaderboardScoreUploaded): LeaderboardScoreUploaded {
  const source = result as unknown as Record<string, unknown>;
  return {
    success: Boolean(source.success),
    leaderboard: BigInt((source.leaderboard ?? 0) as bigint | number | string),
    score: Number(source.score ?? 0),
    scoreChanged: Boolean(source.scoreChanged ?? source.score_changed),
    globalRankNew: Number(source.globalRankNew ?? source.global_rank_new ?? 0),
    globalRankPrevious: Number(source.globalRankPrevious ?? source.global_rank_previous ?? 0)
  };
}

function normalizeLeaderboardUgcSetResult(result: NativeLeaderboardUgcSetResult): LeaderboardUgcSetResult {
  const source = result as unknown as Record<string, unknown>;
  return {
    result: Number(source.result ?? 0),
    leaderboard: BigInt((source.leaderboard ?? 0) as bigint | number | string)
  };
}

function normalizeTimelineEventRecordingExists(
  result: NativeTimelineEventRecordingExists
): TimelineEventRecordingExists {
  const source = result as unknown as Record<string, unknown>;
  return {
    event: BigInt((source.event ?? 0) as bigint | number | string),
    recordingExists: Boolean(source.recordingExists ?? source.recording_exists)
  };
}

function normalizeTimelineGamePhaseRecordingExists(
  result: NativeTimelineGamePhaseRecordingExists
): TimelineGamePhaseRecordingExists {
  const source = result as unknown as Record<string, unknown>;
  return {
    phaseId: String(source.phaseId ?? source.phase_id ?? ""),
    recordingMs: BigInt((source.recordingMs ?? source.recording_ms ?? 0) as bigint | number | string),
    longestClipMs: BigInt((source.longestClipMs ?? source.longest_clip_ms ?? 0) as bigint | number | string),
    clipCount: Number(source.clipCount ?? source.clip_count ?? 0),
    screenshotCount: Number(source.screenshotCount ?? source.screenshot_count ?? 0)
  };
}

function normalizeRemotePlayResolution(
  resolution: NativeRemotePlayResolution | null | undefined
): RemotePlayResolution | null {
  return resolution ? { width: resolution.width, height: resolution.height } : null;
}

function normalizeRemotePlaySessionInfo(session: NativeRemotePlaySessionInfo): RemotePlaySessionInfo {
  const source = session as unknown as Record<string, unknown>;
  return {
    id: Number(source.id ?? 0),
    remotePlayTogether: Boolean(source.remotePlayTogether ?? source.remote_play_together),
    steamId: normalizeSteamId((source.steamId ?? source.steam_id ?? EMPTY_NATIVE_STEAM_ID) as NativeSteamId),
    guestId: Number(source.guestId ?? source.guest_id ?? 0),
    smallAvatar: Number(source.smallAvatar ?? source.small_avatar ?? 0),
    mediumAvatar: Number(source.mediumAvatar ?? source.medium_avatar ?? 0),
    largeAvatar: Number(source.largeAvatar ?? source.large_avatar ?? 0),
    clientName: String(source.clientName ?? source.client_name ?? ""),
    clientFormFactor: Number(source.clientFormFactor ?? source.client_form_factor ?? 0),
    resolution: normalizeRemotePlayResolution((source.resolution ?? null) as NativeRemotePlayResolution | null)
  };
}

function normalizeRemotePlayInputEvent(event: NativeRemotePlayInputEvent): RemotePlayInputEvent {
  const source = event as unknown as Record<string, unknown>;
  return {
    sessionId: Number(source.sessionId ?? source.session_id ?? 0),
    inputType: Number(source.inputType ?? source.input_type ?? 0),
    absolute: (source.absolute ?? null) as boolean | null,
    normalizedX: (source.normalizedX ?? source.normalized_x ?? null) as number | null,
    normalizedY: (source.normalizedY ?? source.normalized_y ?? null) as number | null,
    deltaX: (source.deltaX ?? source.delta_x ?? null) as number | null,
    deltaY: (source.deltaY ?? source.delta_y ?? null) as number | null,
    mouseButton: (source.mouseButton ?? source.mouse_button ?? null) as number | null,
    wheelDirection: (source.wheelDirection ?? source.wheel_direction ?? null) as number | null,
    wheelAmount: (source.wheelAmount ?? source.wheel_amount ?? null) as number | null,
    scancode: (source.scancode ?? null) as number | null,
    modifiers: (source.modifiers ?? null) as number | null,
    keycode: (source.keycode ?? null) as number | null
  };
}

function normalizeUgcResult(result: NativeUgcResult): UgcResult {
  return {
    itemId: BigInt(result.itemId ?? result.item_id ?? 0n),
    needsToAcceptAgreement: Boolean(result.needsToAcceptAgreement ?? result.needs_to_accept_agreement)
  };
}

function normalizeInstallInfo(info: InstallInfo | null | undefined): InstallInfo | null {
  return info ? { folder: info.folder, sizeOnDisk: BigInt(info.sizeOnDisk), timestamp: info.timestamp } : null;
}

function normalizeDownloadInfo(info: DownloadInfo | null | undefined): DownloadInfo | null {
  return info ? { current: BigInt(info.current), total: BigInt(info.total) } : null;
}

function normalizeUpdateProgress(progress: unknown): UpdateProgress {
  if (!progress || typeof progress !== "object") {
    return { status: 0, progress: 0n, total: 0n };
  }

  const source = progress as Record<string, unknown>;
  return {
    status: Number(source.status ?? 0),
    progress: BigInt((source.progress ?? 0) as bigint | number | string),
    total: BigInt((source.total ?? 0) as bigint | number | string)
  };
}

function normalizeWorkshopPaginatedResult(result: NativeWorkshopItemsResult): WorkshopPaginatedResult {
  return {
    items: result.items.map(normalizeWorkshopItem),
    returnedResults: result.returnedResults ?? result.returned_results ?? result.items.length,
    totalResults: result.totalResults ?? result.total_results ?? result.items.length,
    wasCached: Boolean(result.wasCached ?? result.was_cached)
  };
}

function normalizeWorkshopItem(item: NativeWorkshopItem | null | undefined): WorkshopItem | null {
  if (!item) {
    return null;
  }
  const source = item as Record<string, unknown>;
  const stat = (camel: string, snake: string): bigint | undefined => {
    const value = source[camel] ?? source[snake];
    return value == null ? undefined : BigInt(value as bigint | number | string);
  };
  const value = <T>(camel: string, snake: string, fallback: T): T => (source[camel] ?? source[snake] ?? fallback) as T;
  return {
    publishedFileId: BigInt(value("publishedFileId", "published_file_id", 0n)),
    creatorAppId: value("creatorAppId", "creator_app_id", undefined as number | undefined),
    consumerAppId: value("consumerAppId", "consumer_app_id", undefined as number | undefined),
    title: value("title", "title", ""),
    description: value("description", "description", ""),
    owner: normalizeSteamId(value("owner", "owner", { steamId64: 0n, steamId32: "STEAM_0:0:0", accountId: 0 } as NativeSteamId)),
    timeCreated: value("timeCreated", "time_created", 0),
    timeUpdated: value("timeUpdated", "time_updated", 0),
    timeAddedToUserList: value("timeAddedToUserList", "time_added_to_user_list", 0),
    visibility: value("visibility", "visibility", 0),
    banned: value("banned", "banned", false),
    acceptedForUse: value("acceptedForUse", "accepted_for_use", false),
    tags: value("tags", "tags", [] as string[]),
    tagsTruncated: value("tagsTruncated", "tags_truncated", false),
    url: value("url", "url", ""),
    numUpvotes: value("numUpvotes", "num_upvotes", 0),
    numDownvotes: value("numDownvotes", "num_downvotes", 0),
    numChildren: value("numChildren", "num_children", 0),
    previewUrl: value("previewUrl", "preview_url", undefined as string | undefined),
    statistics: {
      numSubscriptions: stat("numSubscriptions", "num_subscriptions"),
      numFavorites: stat("numFavorites", "num_favorites"),
      numFollowers: stat("numFollowers", "num_followers"),
      numUniqueSubscriptions: stat("numUniqueSubscriptions", "num_unique_subscriptions"),
      numUniqueFavorites: stat("numUniqueFavorites", "num_unique_favorites"),
      numUniqueFollowers: stat("numUniqueFollowers", "num_unique_followers"),
      numUniqueWebsiteViews: stat("numUniqueWebsiteViews", "num_unique_website_views"),
      reportScore: stat("reportScore", "report_score"),
      numSecondsPlayed: stat("numSecondsPlayed", "num_seconds_played"),
      numPlaytimeSessions: stat("numPlaytimeSessions", "num_playtime_sessions"),
      numComments: stat("numComments", "num_comments"),
      numSecondsPlayedDuringTimePeriod: stat("numSecondsPlayedDuringTimePeriod", "num_seconds_played_during_time_period"),
      numPlaytimeSessionsDuringTimePeriod: stat("numPlaytimeSessionsDuringTimePeriod", "num_playtime_sessions_during_time_period")
    }
  };
}

const defaultExport = {
  init,
  shutdown,
  restartAppIfNecessary,
  isSteamRunning,
  getSteamInstallPath,
  runCallbacks,
  getSteamId,
  getAuthTicketForWebApi,
  isSteamDeck,
  getAppId,
  isSteamInBigPictureMode,
  isOverlayEnabled,
  overlayNeedsPresent,
  getOverlayDiagnostics,
  onMicroTxnAuthorizationResponse,
  onGameOverlayActivated,
  activateOverlay,
  activateOverlayToWebPage,
  openNativeOverlayProbeWindow,
  attachNativeOverlayHostView,
  pumpNativeOverlayProbeWindow,
  pumpNativeOverlayHostView,
  showNativeOverlayHostView,
  hideNativeOverlayHostView,
  updateNativeOverlayHostFrame,
  closeNativeOverlayProbeWindow,
  detachNativeOverlayHostView,
  isNativeOverlayProbeWindowOpen,
  isNativeOverlayHostViewOpen,
  getMacWindowSnapshot,
  isAchievementActivated,
  achievement,
  apps,
  auth,
  callback,
  cloud,
  friends,
  http,
  inventory,
  input,
  localplayer,
  matchmaking,
  networking,
  overlay,
  music,
  parties,
  parental,
  remotePlay,
  screenshots,
  stats,
  timeline,
  utils,
  video,
  workshop,
  electronConfigureSteamOverlay,
  electronEnableSteamOverlay,
  SteamCallback
};

export default defaultExport;
