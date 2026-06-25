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
  NativeClanChatMessage,
  NativeClanChatJoinResult,
  NativeClanOfficerListResult,
  NativeDownloadClanActivityCountsResult,
  NativeCloudFileInfo,
  NativeCloudFileShareResult,
  NativeCloudLocalFileChange,
  NativeCloudQuota,
  NativeCloudUgcDetails,
  NativeCloudUgcDownloadProgress,
  NativeCloudUgcDownloadResult,
  NativeCloudLegacyEnumerateFilesResult,
  NativeCloudLegacyEnumerateSubscribedFilesResult,
  NativeCloudLegacyEnumerateUserActionFilesResult,
  NativeCloudLegacyEnumerateWorkshopFilesResult,
  NativeCloudLegacyPublishedFileActionResult,
  NativeCloudLegacyPublishedFileDetails,
  NativeCloudLegacyPublishedFileIdResult,
  NativeCloudLegacyPublishedFileResult,
  NativeCloudLegacyPublishedItemVoteDetails,
  NativeCloudLegacyUserVoteDetails,
  NativeFollowerCountResult,
  NativeFollowingListResult,
  NativeEquippedProfileItemsResult,
  NativeGameServerAssociateWithClanResult,
  NativeGameServerAuthTicket,
  NativeGameServerInitOptions,
  NativeGameServerOutgoingPacket,
  NativeGameServerPlayerCompatibilityResult,
  NativeGameServerPublicIp,
  NativeGameServerReputationResult,
  NativeGameServerStatsResult,
  NativeGameServerUserConnectResult,
  NativeFriendGameInfo,
  NativeFriendMessage,
  NativeFriendsGroupInfo,
  NativeInputAnalogActionData,
  NativeInputControllerInfo,
  NativeInputDeviceBindingRevision,
  NativeInputDigitalActionData,
  NativeInputMotionData,
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
  NativeMatchmakingServerItem,
  NativeMatchmakingServerListResult,
  NativeMatchmakingServerListRequest,
  NativeMatchmakingServerListRequestState,
  NativeMatchmakingServerPingResult,
  NativeMatchmakingServerPlayer,
  NativeMatchmakingServerPlayersResult,
  NativeMatchmakingServerRule,
  NativeMatchmakingServerRulesResult,
  NativeLegacyNetworkingListenSocketAvailable,
  NativeLegacyNetworkingListenSocketData,
  NativeLegacyNetworkingListenSocketInfo,
  NativeLegacyNetworkingP2PSessionState,
  NativeLegacyNetworkingSocketData,
  NativeLegacyNetworkingSocketInfo,
  NativeNumberOfCurrentPlayersResult,
  NativeNetworkingAuthenticationStatus,
  NativeNetworkingCertificateResult,
  NativeNetworkingConnectionRealTimeLaneStatus,
  NativeNetworkingConnectionRealTimeStatus,
  NativeNetworkingConnectionRealTimeStatusWithLanes,
  NativeNetworkingConnectionInfo,
  NativeNetworkingConfigValue,
  NativeNetworkingConfigValueInfo,
  NativeNetworkingConfigValueResult,
  NativeNetworkingDebugOutput,
  NativeNetworkingFakeIpResult,
  NativeNetworkingFakeIpIdentity,
  NativeNetworkingGameCoordinatorServerLoginResult,
  NativeNetworkingHostedDedicatedServerAddressResult,
  NativeNetworkingHostedDedicatedServerRouting,
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
  NativeNetworkingSocketOutgoingMessage,
  NativeNetworkingSocketPair,
  NativeNetworkingSocketSendResult,
  NativeOverlayDiagnostics,
  NativePartyBeaconDetails,
  NativePartyBeaconLocation,
  NativeP2PPacket,
  NativeRemotePlayInputEvent,
  NativeRemotePlayResolution,
  NativeRemotePlaySessionInfo,
  NativeSteamClientLocalUser,
  NativeSteamId,
  NativeTimelineEventRecordingExists,
  NativeTimelineGamePhaseRecordingExists,
  NativeWorkshopAppDependenciesResult,
  NativeWorkshopAppDependencyResult,
  NativeWorkshopDeleteItemResult,
  NativeWorkshopDependencyResult,
  NativeWorkshopEulaStatus,
  NativeWorkshopFavoriteResult,
  NativeWorkshopGetUserItemVoteResult,
  NativeUgcResult,
  NativeWorkshopSetUserItemVoteResult,
  NativeWorkshopSimpleResult,
  NativeUserDurationControl,
  NativeUserEncryptedAppTicket,
  NativeUserMarketEligibility,
  NativeUserVoiceAvailable,
  NativeUserVoiceData,
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

export interface GameServerInitOptions {
  ip?: number;
  gamePort: number;
  queryPort: number;
  serverMode?: number;
  version: string;
}

export interface GameServerAuthTicket {
  data: Buffer;
  handle: number;
}

export interface GameServerPublicIp {
  isSet: boolean;
  ipType: number;
  ipv4: number | null;
  ipv4Address: string | null;
  ipv6: Buffer | null;
}

export interface GameServerOutgoingPacket {
  data: Buffer;
  ip: number;
  ipAddress: string;
  port: number;
}

export interface GameServerUserConnectResult {
  success: boolean;
  steamId: SteamId | null;
}

export interface GameServerStatsResult {
  result: number;
  steamId: SteamId;
}

export interface GameServerReputationResult {
  result: number;
  reputationScore: number;
  banned: boolean;
  bannedIp: number;
  bannedIpAddress: string;
  bannedPort: number;
  bannedGameId: bigint;
  banExpires: number;
}

export interface GameServerAssociateWithClanResult {
  result: number;
}

export interface GameServerPlayerCompatibilityResult {
  result: number;
  playersThatDontLikeCandidate: number;
  playersThatCandidateDoesntLike: number;
  clanPlayersThatDontLikeCandidate: number;
  candidate: SteamId;
}

export interface CallbackHandle {
  disconnect(): void;
}

export interface SteamClientLocalUser {
  user: number;
  pipe: number;
}

export type SteamClientInterfaceName =
  | "user"
  | "gameServer"
  | "friends"
  | "utils"
  | "matchmaking"
  | "matchmakingServers"
  | "generic"
  | "userStats"
  | "gameServerStats"
  | "apps"
  | "networking"
  | "remoteStorage"
  | "screenshots"
  | "http"
  | "controller"
  | "ugc"
  | "music"
  | "htmlSurface"
  | "inventory"
  | "video"
  | "parentalSettings"
  | "input"
  | "parties"
  | "remotePlay";

export interface SteamClientInterfaceOptions {
  user?: number | null;
  pipe?: number | null;
  version?: string | null;
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

export interface ClanChatMessage extends FriendMessage {
  chatter: SteamId;
}

export interface FriendsGroupInfo {
  id: number;
  name: string;
  members: SteamId[];
}

export interface CloudQuota {
  totalBytes: bigint;
  availableBytes: bigint;
}

export interface CloudLocalFileChange {
  name: string;
  changeType: number;
  pathType: number;
}

export interface CloudFileShareResult {
  result: number;
  file: bigint;
  name: string;
}

export interface CloudUgcDownloadProgress {
  downloadedBytes: bigint;
  expectedBytes: bigint;
}

export interface CloudUgcDetails {
  appId: number;
  name: string;
  size: bigint;
  owner: SteamId;
}

export interface CloudUgcDownloadResult {
  result: number;
  file: bigint;
  appId: number;
  size: bigint;
  name: string;
  owner: SteamId;
}

export interface CloudLegacyPublishedFileResult {
  result: number;
  publishedFileId: bigint;
  needsToAcceptAgreement: boolean | null;
}

export interface CloudLegacyPublishedFileIdResult {
  result: number;
  publishedFileId: bigint;
}

export interface CloudLegacyPublishedFileActionResult extends CloudLegacyPublishedFileIdResult {
  action: number;
}

export interface CloudLegacyPublishedFileDetails extends CloudLegacyPublishedFileIdResult {
  creatorAppId: number;
  consumerAppId: number;
  title: string;
  description: string;
  file: bigint;
  previewFile: bigint;
  owner: SteamId;
  timeCreated: number;
  timeUpdated: number;
  visibility: number;
  banned: boolean;
  tags: string[];
  tagsTruncated: boolean;
  fileName: string;
  fileSize: bigint;
  previewFileSize: bigint;
  url: string;
  fileType: number;
  acceptedForUse: boolean;
}

export interface CloudLegacyEnumerateFilesResult {
  result: number;
  returnedResults: number;
  totalResultCount: number;
  publishedFileIds: bigint[];
}

export interface CloudLegacyEnumerateSubscribedFilesResult extends CloudLegacyEnumerateFilesResult {
  subscribedTimes: number[];
}

export interface CloudLegacyEnumerateWorkshopFilesResult extends CloudLegacyEnumerateFilesResult {
  scores: number[];
  appId: number;
  startIndex: number;
}

export interface CloudLegacyEnumerateUserActionFilesResult extends CloudLegacyEnumerateFilesResult {
  action: number;
  updatedTimes: number[];
}

export interface CloudLegacyPublishedItemVoteDetails extends CloudLegacyPublishedFileIdResult {
  votesFor: number;
  votesAgainst: number;
  reports: number;
  score: number;
}

export interface CloudLegacyUserVoteDetails extends CloudLegacyPublishedFileIdResult {
  vote: number;
}

export interface CloudLegacyPublishWorkshopFileOptions {
  filePath: string;
  previewPath: string;
  consumerAppId: number;
  title: string;
  description: string;
  visibility?: number;
  tags?: string[] | null;
  fileType?: number;
}

export interface CloudLegacyPublishVideoOptions {
  provider?: number;
  videoAccount: string;
  videoIdentifier: string;
  previewPath: string;
  consumerAppId: number;
  title: string;
  description: string;
  visibility?: number;
  tags?: string[] | null;
}

export interface CloudLegacyTagFilters {
  requiredTags?: string[] | null;
  excludedTags?: string[] | null;
}

export interface CloudLegacyWorkshopFilters {
  tags?: string[] | null;
  userTags?: string[] | null;
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

export interface DownloadClanActivityCountsResult {
  success: boolean;
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

export interface MatchmakingServerBrowserFilter {
  key: string;
  value?: string;
}

export interface MatchmakingServerAddress {
  ip: number;
  ipAddress: string;
  connectionPort: number;
  queryPort: number;
}

export interface MatchmakingServerItem {
  address: MatchmakingServerAddress;
  ping: number;
  hadSuccessfulResponse: boolean;
  doNotRefresh: boolean;
  gameDir: string;
  map: string;
  gameDescription: string;
  appId: number;
  players: number;
  maxPlayers: number;
  botPlayers: number;
  password: boolean;
  secure: boolean;
  timeLastPlayed: number;
  serverVersion: number;
  name: string;
  gameTags: string;
  steamId: SteamId;
}

export interface MatchmakingServerListOptions {
  filters?: MatchmakingServerBrowserFilter[];
  timeoutSeconds?: number | null;
}

export interface MatchmakingServerListResult {
  response: number;
  responded: number[];
  failed: number[];
  servers: MatchmakingServerItem[];
}

export interface MatchmakingServerListRequestState {
  handle: bigint;
  steamRequest: bigint;
  appId: number;
  kind: string;
  completed: boolean;
  cancelled: boolean;
  response: number;
  responded: number[];
  failed: number[];
  refreshing: boolean;
  serverCount: number;
}

export interface MatchmakingServerPingResult {
  responded: boolean;
  server: MatchmakingServerItem | null;
}

export interface MatchmakingServerPlayer {
  name: string;
  score: number;
  timePlayed: number;
}

export interface MatchmakingServerPlayersResult {
  responded: boolean;
  players: MatchmakingServerPlayer[];
}

export interface MatchmakingServerRule {
  name: string;
  value: string;
}

export interface MatchmakingServerRulesResult {
  responded: boolean;
  rules: MatchmakingServerRule[];
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

export interface HtmlCreateBrowserOptions {
  userAgent?: string;
  userCss?: string;
  timeoutSeconds?: number;
}

export interface HtmlCookieOptions {
  path?: string;
  expires?: number;
  secure?: boolean;
  httpOnly?: boolean;
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

export interface UserVoiceAvailable {
  result: number;
  compressedBytes: number;
  uncompressedBytes: number;
}

export interface UserVoiceData {
  result: number;
  compressed: Buffer | null;
  uncompressed: Buffer | null;
  compressedBytes: number;
  uncompressedBytes: number;
}

export interface UserEncryptedAppTicket {
  result: number;
  ticket: Buffer | null;
}

export interface UserMarketEligibility {
  allowed: boolean;
  notAllowedReason: number;
  allowedAtTime: number;
  steamGuardRequiredDays: number;
  newDeviceCooldownDays: number;
}

export interface UserDurationControl {
  result: number;
  appId: number;
  applicable: boolean;
  secondsLast5h: number;
  progress: number;
  notification: number;
  secondsToday: number;
  secondsRemaining: number;
}

export interface P2PPacket {
  data: Buffer;
  size: number;
  steamId: SteamId;
}

export interface LegacyNetworkingP2PSessionState {
  connectionActive: boolean;
  connecting: boolean;
  sessionError: number;
  usingRelay: boolean;
  bytesQueuedForSend: number;
  packetsQueuedForSend: number;
  remoteIp: number;
  remoteIpAddress: string;
  remotePort: number;
}

export interface LegacyNetworkingListenSocketOptions {
  ip?: number;
  port?: number;
  allowPacketRelay?: boolean;
}

export interface LegacyNetworkingSocketData {
  data: Buffer;
  size: number;
}

export interface LegacyNetworkingListenSocketAvailable {
  socket: number;
  size: number;
}

export interface LegacyNetworkingListenSocketData {
  socket: number;
  data: Buffer;
  size: number;
}

export interface LegacyNetworkingSocketInfo {
  remoteSteamId: SteamId;
  socketStatus: number;
  remoteIp: number | null;
  remoteIpAddress: string | null;
  remotePort: number;
}

export interface LegacyNetworkingListenSocketInfo {
  ip: number | null;
  ipAddress: string | null;
  port: number;
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

export interface NetworkingSocketOutgoingMessage {
  connection: number;
  data: Buffer | Uint8Array;
  sendFlags?: number;
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

export interface NetworkingConnectionRealTimeLaneStatus {
  pendingUnreliable: number;
  pendingReliable: number;
  sentUnackedReliable: number;
  queueTime: bigint;
}

export interface NetworkingConnectionRealTimeStatusWithLanes {
  status: NetworkingConnectionRealTimeStatus;
  lanes: NetworkingConnectionRealTimeLaneStatus[];
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

export interface NetworkingHostedDedicatedServerRouting {
  popId: number;
  size: number;
  data: Buffer;
}

export interface NetworkingHostedDedicatedServerAddressResult {
  result: number;
  routing: NetworkingHostedDedicatedServerRouting | null;
  debugMessage: string;
}

export interface NetworkingGameCoordinatorServerLoginResult {
  result: number;
  identity: NetworkingIdentityInfo | null;
  routing: NetworkingHostedDedicatedServerRouting | null;
  appId: number;
  timestamp: number;
  appData: Buffer;
  signedBlob: Buffer;
  debugMessage: string;
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

export interface NetworkingConfigValueResult {
  result: number;
  dataType: number;
  value: number | bigint | string | null;
  int32Value: number | null;
  int64Value: bigint | null;
  floatValue: number | null;
  stringValue: string | null;
}

export interface NetworkingConfigOption {
  value: number;
  dataType?: number;
  int32Value?: number | null;
  int64Value?: bigint | number | string | null;
  floatValue?: number | null;
  stringValue?: string | null;
}

export interface NetworkingConfigValueInfo {
  value: number;
  name: string | null;
  dataType: number;
  scope: number;
}

export interface NetworkingDebugOutput {
  detailLevel: number;
  message: string;
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

export interface InputDigitalActionData {
  state: boolean;
  active: boolean;
}

export interface InputAnalogActionData {
  mode: number;
  x: number;
  y: number;
  active: boolean;
}

export interface InputMotionData {
  rotationQuaternionX: number;
  rotationQuaternionY: number;
  rotationQuaternionZ: number;
  rotationQuaternionW: number;
  positionAccelerationX: number;
  positionAccelerationY: number;
  positionAccelerationZ: number;
  rotationVelocityX: number;
  rotationVelocityY: number;
  rotationVelocityZ: number;
}

export interface InputDeviceBindingRevision {
  major: number;
  minor: number;
}

export interface UgcResult {
  itemId: bigint;
  needsToAcceptAgreement: boolean;
}

export interface WorkshopFavoriteResult {
  result: number;
  itemId: bigint;
  wasAddRequest: boolean;
}

export interface WorkshopSetUserItemVoteResult {
  result: number;
  itemId: bigint;
  voteUp: boolean;
}

export interface WorkshopGetUserItemVoteResult {
  result: number;
  itemId: bigint;
  votedUp: boolean;
  votedDown: boolean;
  voteSkipped: boolean;
}

export interface WorkshopSimpleResult {
  result: number;
}

export interface WorkshopDependencyResult {
  result: number;
  itemId: bigint;
  childItemId: bigint;
}

export interface WorkshopAppDependencyResult {
  result: number;
  itemId: bigint;
  appId: number;
}

export interface WorkshopAppDependenciesResult {
  result: number;
  itemId: bigint;
  appIds: number[];
  numAppDependencies: number;
  totalNumAppDependencies: number;
}

export interface WorkshopDeleteItemResult {
  result: number;
  itemId: bigint;
}

export interface WorkshopEulaStatus {
  result: number;
  appId: number;
  version: number;
  actionTime: number;
  accepted: boolean;
  needsAction: boolean;
}

export interface UgcUpdate {
  title?: string;
  description?: string;
  changeNote?: string;
  previewPath?: string;
  contentPath?: string;
  tags?: string[];
  visibility?: number;
  language?: string;
  metadata?: string;
  allowLegacyUpload?: boolean;
  removeAllKeyValueTags?: boolean;
  removeKeyValueTags?: string[];
  keyValueTags?: Record<string, string> | Array<{ key: string; value: string }>;
  previewFiles?: Array<{ path: string; type?: number }>;
  previewVideos?: string[];
  updatePreviewFiles?: Array<{ index: number; path: string }>;
  updatePreviewVideos?: Array<{ index: number; videoId: string }>;
  removePreviews?: number[];
  contentDescriptors?: number[];
  removeContentDescriptors?: number[];
  requiredGameVersions?: { min?: string; max?: string; gameBranchMin?: string; gameBranchMax?: string };
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

export interface WorkshopItemTag {
  name: string;
  displayName?: string;
}

export interface WorkshopItemAdditionalPreview {
  urlOrVideoId: string;
  originalFileName: string;
  previewType: number;
}

export interface WorkshopItemKeyValueTag {
  key: string;
  value: string;
}

export interface WorkshopItemSupportedGameVersion {
  gameBranchMin: string;
  gameBranchMax: string;
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
  tagDetails: WorkshopItemTag[];
  tagsTruncated: boolean;
  metadata?: string;
  children: bigint[];
  additionalPreviews: WorkshopItemAdditionalPreview[];
  keyValueTags: WorkshopItemKeyValueTag[];
  firstKeyValueTags: WorkshopItemKeyValueTag[];
  supportedGameVersions: WorkshopItemSupportedGameVersion[];
  contentDescriptors: number[];
  url: string;
  numUpvotes: number;
  numDownvotes: number;
  numChildren: number;
  previewUrl?: string;
  statistics: WorkshopItemStatistic;
}

export interface WorkshopItemDetailsResult {
  details: Record<string, unknown>;
  wasCached: boolean;
}

export interface WorkshopPaginatedResult {
  items: Array<WorkshopItem | null | undefined>;
  returnedResults: number;
  totalResults: number;
  wasCached: boolean;
  nextCursor: string;
}

export interface WorkshopItemsResult {
  items: Array<WorkshopItem | null | undefined>;
  wasCached: boolean;
  nextCursor: string;
}

export interface WorkshopItemQueryConfig {
  cachedResponseMaxAge?: number;
  includeMetadata?: boolean;
  includeLongDescription?: boolean;
  includeAdditionalPreviews?: boolean;
  includeKeyValueTags?: boolean;
  includeChildren?: boolean;
  onlyIds?: boolean;
  onlyTotal?: boolean;
  playtimeStatsDays?: number;
  admin?: boolean;
  language?: string;
  matchAnyTag?: boolean;
  requiredTags?: string[];
  requiredTagGroups?: string[][];
  excludedTags?: string[];
  requiredKeyValueTags?: Record<string, string> | Array<{ key: string; value: string }>;
  searchText?: string;
  cloudFileName?: string;
  rankedByTrendDays?: number;
  createdAfter?: number;
  createdBefore?: number;
  updatedAfter?: number;
  updatedBefore?: number;
  firstKeyValueTagKeys?: string[];
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
  EncryptedAppTicketResponse: 154,
  GetAuthSessionTicketResponse: 163,
  StoreAuthURLResponse: 165,
  MarketEligibilityResponse: 166,
  DurationControl: 167,
  GameOverlayActivated: 331,
  GameServerChangeRequested: 332,
  GameLobbyJoinRequestedSteamworks: 333,
  AvatarImageLoaded: 334,
  ClanOfficerListResponse: 335,
  FriendRichPresenceUpdate: 336,
  GameRichPresenceJoinRequested: 337,
  GameConnectedClanChatMsg: 338,
  GameConnectedChatJoin: 339,
  GameConnectedChatLeave: 340,
  DownloadClanActivityCountsResult: 341,
  JoinClanChatRoomCompletionResult: 342,
  GameConnectedFriendChatMsg: 343,
  FriendsGetFollowerCount: 344,
  FriendsIsFollowing: 345,
  FriendsEnumerateFollowingList: 346,
  UnreadChatMessagesChanged: 348,
  OverlayBrowserProtocolNavigation: 349,
  EquippedProfileItemsChanged: 350,
  EquippedProfileItems: 351,
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
  RemoteStorageFileShareResult: 1307,
  RemoteStoragePublishFileResult: 1309,
  RemoteStorageDeletePublishedFileResult: 1311,
  RemoteStorageEnumerateUserPublishedFilesResult: 1312,
  RemoteStorageSubscribePublishedFileResult: 1313,
  RemoteStorageEnumerateUserSubscribedFilesResult: 1314,
  RemoteStorageUnsubscribePublishedFileResult: 1315,
  RemoteStorageUpdatePublishedFileResult: 1316,
  RemoteStorageDownloadUGCResult: 1317,
  RemoteStorageGetPublishedFileDetailsResult: 1318,
  RemoteStorageEnumerateWorkshopFilesResult: 1319,
  RemoteStorageGetPublishedItemVoteDetailsResult: 1320,
  RemoteStoragePublishedFileSubscribed: 1321,
  RemoteStoragePublishedFileUnsubscribed: 1322,
  RemoteStoragePublishedFileDeleted: 1323,
  RemoteStorageUpdateUserPublishedItemVoteResult: 1324,
  RemoteStorageUserVoteDetails: 1325,
  RemoteStorageEnumerateUserSharedWorkshopFilesResult: 1326,
  RemoteStorageSetUserPublishedFileActionResult: 1327,
  RemoteStorageEnumeratePublishedFilesByUserActionResult: 1328,
  RemoteStoragePublishFileProgress: 1329,
  RemoteStoragePublishedFileUpdated: 1330,
  RemoteStorageFileWriteAsyncComplete: 1331,
  RemoteStorageFileReadAsyncComplete: 1332,
  SteamUGCQueryCompleted: 3401,
  SteamUGCRequestDetailsResult: 3402,
  SteamUGCCreateItemResult: 3403,
  SteamUGCSubmitItemUpdateResult: 3404,
  SteamUGCItemInstalled: 3405,
  SteamUGCDownloadItemResult: 3406,
  SteamUGCUserFavoriteItemsListChanged: 3407,
  SteamUGCSetUserItemVoteResult: 3408,
  SteamUGCGetUserItemVoteResult: 3409,
  SteamUGCStartPlaytimeTrackingResult: 3410,
  SteamUGCStopPlaytimeTrackingResult: 3411,
  SteamUGCAddDependencyResult: 3412,
  SteamUGCRemoveDependencyResult: 3413,
  SteamUGCAddAppDependencyResult: 3414,
  SteamUGCRemoveAppDependencyResult: 3415,
  SteamUGCGetAppDependenciesResult: 3416,
  SteamUGCDeleteItemResult: 3417,
  SteamUGCUserSubscribedItemsListChanged: 3418,
  SteamUGCWorkshopEULAStatus: 3420,
  GameServerClientApprove: 201,
  GameServerClientDeny: 202,
  GameServerClientKick: 203,
  GameServerClientAchievementStatus: 206,
  GameServerPolicyResponse: 115,
  GameServerGameplayStats: 207,
  GameServerClientGroupStatus: 208,
  GameServerReputation: 209,
  GameServerAssociateWithClan: 210,
  GameServerPlayerCompatibility: 211,
  GameServerStatsUnloaded: 1108,
  GameServerStatsReceived: 1800,
  GameServerStatsStored: 1801,
  HTTPRequestCompleted: 2101,
  HTTPRequestHeadersReceived: 2102,
  HTTPRequestDataReceived: 2103,
  HTMLBrowserReady: 4501,
  HTMLNeedsPaint: 4502,
  HTMLStartRequest: 4503,
  HTMLCloseBrowser: 4504,
  HTMLURLChanged: 4505,
  HTMLFinishedRequest: 4506,
  HTMLOpenLinkInNewTab: 4507,
  HTMLChangedTitle: 4508,
  HTMLSearchResults: 4509,
  HTMLCanGoBackAndForward: 4510,
  HTMLHorizontalScroll: 4511,
  HTMLVerticalScroll: 4512,
  HTMLLinkAtPosition: 4513,
  HTMLJSAlert: 4514,
  HTMLJSConfirm: 4515,
  HTMLFileOpenDialog: 4516,
  HTMLNewWindow: 4521,
  HTMLSetCursor: 4522,
  HTMLStatusText: 4523,
  HTMLShowToolTip: 4524,
  HTMLUpdateToolTip: 4525,
  HTMLHideToolTip: 4526,
  HTMLBrowserRestarted: 4527,
  ScreenshotReady: 2301,
  ScreenshotRequested: 2302,
  PlaybackStatusHasChanged: 4001,
  VolumeHasChanged: 4002,
  BroadcastUploadStart: 4604,
  BroadcastUploadStop: 4605,
  GetVideoURLResult: 4611,
  GetOPFSettingsResult: 4624,
  SteamParentalSettingsChanged: 5001,
  JoinParty: 5301,
  CreateBeacon: 5302,
  ReservationNotification: 5303,
  ChangeNumOpenSlots: 5304,
  SteamRemotePlaySessionConnected: 5701,
  SteamRemotePlaySessionDisconnected: 5702,
  SteamRemotePlayTogetherGuestInvite: 5703,
  SteamRemotePlaySessionAvatarLoaded: 5704,
  SteamTimelineGamePhaseRecordingExists: 6001,
  SteamTimelineEventRecordingExists: 6002,
  SteamInventoryResultReady: 4700,
  SteamInventoryFullUpdate: 4701,
  SteamInventoryDefinitionUpdate: 4702,
  SteamInventoryEligiblePromoItemDefIds: 4703,
  SteamInventoryStartPurchaseResult: 4704,
  SteamInventoryRequestPricesResult: 4705
} as const;

export const VoiceResult = {
  OK: 0,
  NotInitialized: 1,
  NotRecording: 2,
  NoData: 3,
  BufferTooSmall: 4,
  DataCorrupted: 5,
  Restricted: 6,
  UnsupportedCodec: 7,
  ReceiverOutOfDate: 8,
  ReceiverDidNotAnswer: 9
} as const;

export const BeginAuthSessionResult = {
  OK: 0,
  InvalidTicket: 1,
  DuplicateRequest: 2,
  InvalidVersion: 3,
  GameMismatch: 4,
  ExpiredTicket: 5
} as const;

export const UserHasLicenseForAppResult = {
  HasLicense: 0,
  DoesNotHaveLicense: 1,
  NoAuth: 2
} as const;

export const ServerMode = {
  NoAuthentication: 1,
  Authentication: 2,
  AuthenticationAndSecure: 3
} as const;

export const MarketNotAllowedReasonFlags = {
  None: 0,
  TemporaryFailure: 1,
  AccountDisabled: 2,
  AccountLockedDown: 4,
  AccountLimited: 8,
  TradeBanned: 16,
  AccountNotTrusted: 32,
  SteamGuardNotEnabled: 64,
  SteamGuardOnlyRecentlyEnabled: 128,
  RecentPasswordReset: 256,
  NewPaymentMethod: 512,
  InvalidCookie: 1024,
  UsingNewDevice: 2048,
  RecentSelfRefund: 4096,
  NewPaymentMethodCannotBeVerified: 8192,
  NoRecentPurchases: 16384,
  AcceptedWalletGift: 32768,
  TradeCooldown: 65536
} as const;

export const DurationControlProgress = {
  Full: 0,
  Half: 1,
  None: 2,
  ExitSoon3h: 3,
  ExitSoon5h: 4,
  ExitSoonNight: 5
} as const;

export const DurationControlNotification = {
  None: 0,
  OneHour: 1,
  ThreeHours: 2,
  HalfProgress: 3,
  NoProgress: 4,
  ExitSoon3h: 5,
  ExitSoon5h: 6,
  ExitSoonNight: 7
} as const;

export const DurationControlOnlineState = {
  Invalid: 0,
  Offline: 1,
  Online: 2,
  OnlineHighPri: 3
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

export const HtmlMouseButton = {
  Left: 0,
  Right: 1,
  Middle: 2
} as const;

export const HtmlMouseCursor = {
  User: 0,
  None: 1,
  Arrow: 2,
  IBeam: 3,
  Hourglass: 4,
  WaitArrow: 5,
  Crosshair: 6,
  Up: 7,
  SizeNW: 8,
  SizeSE: 9,
  SizeNE: 10,
  SizeSW: 11,
  SizeW: 12,
  SizeE: 13,
  SizeN: 14,
  SizeS: 15,
  SizeWE: 16,
  SizeNS: 17,
  SizeAll: 18,
  No: 19,
  Hand: 20,
  Blank: 21,
  MiddlePan: 22,
  NorthPan: 23,
  NorthEastPan: 24,
  EastPan: 25,
  SouthEastPan: 26,
  SouthPan: 27,
  SouthWestPan: 28,
  WestPan: 29,
  NorthWestPan: 30,
  Alias: 31,
  Cell: 32,
  ColResize: 33,
  Copy: 34,
  VerticalText: 35,
  RowResize: 36,
  ZoomIn: 37,
  ZoomOut: 38,
  Help: 39,
  Custom: 40,
  Last: 41
} as const;

export const HtmlKeyModifier = {
  None: 0,
  AltDown: 1,
  CtrlDown: 2,
  ShiftDown: 4
} as const;

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

export const InputTypeCode = {
  Unknown: 0,
  SteamController: 1,
  XBox360Controller: 2,
  XBoxOneController: 3,
  GenericGamepad: 4,
  PS4Controller: 5,
  AppleMFiController: 6,
  AndroidController: 7,
  SwitchJoyConPair: 8,
  SwitchJoyConSingle: 9,
  SwitchProController: 10,
  MobileTouch: 11,
  PS3Controller: 12,
  PS5Controller: 13,
  SteamDeckController: 14
} as const;

export const InputGlyphSize = {
  Small: 0,
  Medium: 1,
  Large: 2
} as const;

export const InputGlyphStyle = {
  Knockout: 0,
  Light: 1,
  Dark: 2,
  NeutralColorABXY: 16,
  SolidABXY: 32
} as const;

export const InputHapticLocation = {
  Left: 1,
  Right: 2,
  Both: 3
} as const;

export const SteamControllerPad = {
  Left: 0,
  Right: 1
} as const;

export const InputLedFlag = {
  SetColor: 0,
  RestoreUserDefault: 1
} as const;

export const XboxOrigin = {
  A: 0,
  B: 1,
  X: 2,
  Y: 3,
  LeftBumper: 4,
  RightBumper: 5,
  Menu: 6,
  View: 7,
  LeftTriggerPull: 8,
  LeftTriggerClick: 9,
  RightTriggerPull: 10,
  RightTriggerClick: 11,
  LeftStickMove: 12,
  LeftStickClick: 13,
  LeftStickDPadNorth: 14,
  LeftStickDPadSouth: 15,
  LeftStickDPadWest: 16,
  LeftStickDPadEast: 17,
  RightStickMove: 18,
  RightStickClick: 19,
  RightStickDPadNorth: 20,
  RightStickDPadSouth: 21,
  RightStickDPadWest: 22,
  RightStickDPadEast: 23,
  DPadNorth: 24,
  DPadSouth: 25,
  DPadWest: 26,
  DPadEast: 27
} as const;

export const SessionInputConfigurationSetting = {
  None: 0,
  Playstation: 1,
  Xbox: 2,
  Generic: 4,
  Switch: 8
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

export const P2PSessionError = {
  None: 0,
  NotRunningAppDeleted: 1,
  NoRightsToApp: 2,
  DestinationNotLoggedInDeleted: 3,
  Timeout: 4,
  Max: 5
} as const;

export const LegacyNetworkingSocketState = {
  Invalid: 0,
  Connected: 1,
  Initiated: 10,
  LocalCandidatesFound: 11,
  ReceivedRemoteCandidates: 12,
  ChallengeHandshake: 15,
  Disconnecting: 21,
  LocalDisconnect: 22,
  TimeoutDuringConnect: 23,
  RemoteEndDisconnected: 24,
  ConnectionBroken: 25
} as const;

export const LegacyNetworkingSocketConnectionType = {
  NotConnected: 0,
  UDP: 1,
  UDPRelay: 2
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

export const SteamAccountType = {
  Invalid: 0,
  Individual: 1,
  Multiseat: 2,
  GameServer: 3,
  AnonGameServer: 4,
  Pending: 5,
  ContentServer: 6,
  Clan: 7,
  Chat: 8,
  ConsoleUser: 9,
  AnonUser: 10,
  Max: 11
} as const;

export const NetworkingConfigScope = {
  Global: 1,
  SocketsInterface: 2,
  ListenSocket: 3,
  Connection: 4
} as const;

export const NetworkingConfigDataType = {
  Int32: 1,
  Int64: 2,
  Float: 3,
  String: 4,
  Ptr: 5
} as const;

export const NetworkingGetConfigValueResult = {
  BadValue: -1,
  BadScopeObj: -2,
  BufferTooSmall: -3,
  OK: 1,
  OKInherited: 2
} as const;

export const NetworkingDebugOutputType = {
  None: 0,
  Bug: 1,
  Error: 2,
  Important: 3,
  Warning: 4,
  Msg: 5,
  Verbose: 6,
  Debug: 7,
  Everything: 8
} as const;

export const NetworkingConfigValue = {
  Invalid: 0,
  FakePacketLossSend: 2,
  FakePacketLossRecv: 3,
  FakePacketLagSend: 4,
  FakePacketLagRecv: 5,
  FakePacketReorderSend: 6,
  FakePacketReorderRecv: 7,
  FakePacketReorderTime: 8,
  SendBufferSize: 9,
  SendRateMin: 10,
  SendRateMax: 11,
  NagleTime: 12,
  LogLevelAckRTT: 13,
  LogLevelPacketDecode: 14,
  LogLevelMessage: 15,
  LogLevelPacketGaps: 16,
  LogLevelP2PRendezvous: 17,
  LogLevelSDRRelayPings: 18,
  SDRClientConsecutitivePingTimeoutsFailInitial: 19,
  SDRClientConsecutitivePingTimeoutsFail: 20,
  SDRClientMinPingsBeforePingAccurate: 21,
  SDRClientSingleSocket: 22,
  IPAllowWithoutAuth: 23,
  TimeoutInitial: 24,
  TimeoutConnected: 25,
  FakePacketDupSend: 26,
  FakePacketDupRecv: 27,
  FakePacketDupTimeMax: 28,
  SDRClientForceRelayCluster: 29,
  SDRClientDevTicket: 30,
  SDRClientForceProxyAddr: 31,
  MTUPacketSize: 32,
  MTUDataSize: 33,
  Unencrypted: 34,
  DeletedEnumerateDevVars: 35,
  SDRClientFakeClusterPing: 36,
  SymmetricConnect: 37,
  LocalVirtualPort: 38,
  DualWifiEnable: 39,
  ConnectionUserData: 40,
  PacketTraceMaxBytes: 41,
  FakeRateLimitSendRate: 42,
  FakeRateLimitSendBurst: 43,
  FakeRateLimitRecvRate: 44,
  FakeRateLimitRecvBurst: 45,
  EnableDiagnosticsUI: 46,
  RecvBufferSize: 47,
  RecvBufferMessages: 48,
  RecvMaxMessageSize: 49,
  RecvMaxSegmentsPerPacket: 50,
  OutOfOrderCorrectionWindowMicroseconds: 51,
  IPLocalHostAllowWithoutAuth: 52,
  FakePacketJitterSendAvg: 53,
  FakePacketJitterSendMax: 54,
  FakePacketJitterSendPct: 55,
  FakePacketJitterRecvAvg: 56,
  FakePacketJitterRecvMax: 57,
  FakePacketJitterRecvPct: 58,
  SendTimeSincePreviousPacket: 59,
  SDRClientLimitPingProbesToNearestN: 60,
  P2PSTUNServerList: 103,
  P2PTransportICEEnable: 104,
  P2PTransportICEPenalty: 105,
  P2PTransportSDRPenalty: 106,
  P2PTURNServerList: 107,
  P2PTURNUserList: 108,
  P2PTURNPassList: 109,
  P2PTransportICEImplementation: 110,
  CallbackConnectionStatusChanged: 201,
  CallbackAuthStatusChanged: 202,
  CallbackRelayNetworkStatusChanged: 203,
  CallbackMessagesSessionRequest: 204,
  CallbackMessagesSessionFailed: 205,
  CallbackCreateConnectionSignaling: 206,
  CallbackFakeIPResult: 207,
  SDRClientEnableTOSProbes: 998,
  ECN: 999
} as const;

export const NetworkingIceEnable = {
  Default: -1,
  Disable: 0,
  Relay: 1,
  Private: 2,
  Public: 4,
  All: 2147483647
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

export const RemoteStoragePlatform = {
  None: 0,
  Windows: 1,
  OSX: 2,
  PS3: 4,
  Linux: 8,
  Switch: 16,
  Android: 32,
  IOS: 64,
  All: 0xffffffff
} as const;

export const RemoteStorageLocalFileChange = {
  Invalid: 0,
  FileUpdated: 1,
  FileDeleted: 2
} as const;

export const RemoteStorageFilePathType = {
  Invalid: 0,
  Absolute: 1,
  APIFilename: 2
} as const;

export const UGCReadAction = {
  ContinueReadingUntilFinished: 0,
  ContinueReading: 1,
  Close: 2
} as const;

export const WorkshopFileType = {
  Community: 0,
  Microtransaction: 1,
  Collection: 2,
  Art: 3,
  Video: 4,
  Screenshot: 5,
  Game: 6,
  Software: 7,
  Concept: 8,
  WebGuide: 9,
  IntegratedGuide: 10,
  Merch: 11,
  ControllerBinding: 12,
  SteamworksAccessInvite: 13,
  SteamVideo: 14,
  GameManagedItem: 15,
  Clip: 16
} as const;

export const WorkshopFileAction = {
  Played: 0,
  Completed: 1
} as const;

export const WorkshopEnumerationType = {
  RankedByVote: 0,
  Recent: 1,
  Trending: 2,
  FavoritesOfFriends: 3,
  VotedByFriends: 4,
  ContentByFriends: 5,
  RecentFromFollowedUsers: 6
} as const;

export const WorkshopVideoProvider = {
  None: 0,
  YouTube: 1
} as const;

export const WorkshopVote = {
  Unvoted: 0,
  For: 1,
  Against: 2,
  Later: 3
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

export const UGCContentDescriptor = {
  NudityOrSexualContent: 1,
  FrequentViolenceOrGore: 2,
  AdultOnlySexualContent: 3,
  GratuitousSexualContent: 4,
  AnyMatureContent: 5
} as const;

export const ItemPreviewType = {
  Image: 0,
  YouTubeVideo: 1,
  Sketchfab: 2,
  EnvironmentMapHorizontalCross: 3,
  EnvironmentMapLatLong: 4,
  Clip: 5,
  ReservedMax: 255
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
export type InputTypeCodeValue = typeof InputTypeCode[keyof typeof InputTypeCode];

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

  getCurrentActionSet(): bigint {
    return BigInt(native().inputGetCurrentActionSet(this.handle));
  }

  activateActionSetLayer(actionSetLayerHandle: bigint): void {
    native().inputActivateActionSetLayer(this.handle, actionSetLayerHandle);
  }

  deactivateActionSetLayer(actionSetLayerHandle: bigint): void {
    native().inputDeactivateActionSetLayer(this.handle, actionSetLayerHandle);
  }

  deactivateAllActionSetLayers(): void {
    native().inputDeactivateAllActionSetLayers(this.handle);
  }

  getActiveActionSetLayers(): bigint[] {
    return native().inputGetActiveActionSetLayers(this.handle).map(BigInt);
  }

  getDigitalActionData(actionHandle: bigint): InputDigitalActionData {
    return normalizeInputDigitalActionData(native().inputGetDigitalActionData(this.handle, actionHandle));
  }

  isDigitalActionPressed(actionHandle: bigint): boolean {
    return native().inputIsDigitalActionPressed(this.handle, actionHandle);
  }

  getDigitalActionOrigins(actionSetHandle: bigint, actionHandle: bigint): number[] {
    return native().inputGetDigitalActionOrigins(this.handle, actionSetHandle, actionHandle).map(Number);
  }

  getAnalogActionData(actionHandle: bigint): InputAnalogActionData {
    return normalizeInputAnalogActionData(native().inputGetAnalogActionData(this.handle, actionHandle));
  }

  getAnalogActionVector(actionHandle: bigint): AnalogActionVector {
    return native().inputGetAnalogActionVector(this.handle, actionHandle);
  }

  getAnalogActionOrigins(actionSetHandle: bigint, actionHandle: bigint): number[] {
    return native().inputGetAnalogActionOrigins(this.handle, actionSetHandle, actionHandle).map(Number);
  }

  stopAnalogActionMomentum(actionHandle: bigint): void {
    native().inputStopAnalogActionMomentum(this.handle, actionHandle);
  }

  getMotionData(): InputMotionData {
    return normalizeInputMotionData(native().inputGetMotionData(this.handle));
  }

  triggerVibration(leftSpeed: number, rightSpeed: number): void {
    native().inputTriggerVibration(this.handle, leftSpeed, rightSpeed);
  }

  triggerVibrationExtended(
    leftSpeed: number,
    rightSpeed: number,
    leftTriggerSpeed: number,
    rightTriggerSpeed: number
  ): void {
    native().inputTriggerVibrationExtended(this.handle, leftSpeed, rightSpeed, leftTriggerSpeed, rightTriggerSpeed);
  }

  triggerSimpleHapticEvent(
    location: number,
    intensity: number,
    gainDb: number,
    otherIntensity: number,
    otherGainDb: number
  ): void {
    native().inputTriggerSimpleHapticEvent(this.handle, location, intensity, gainDb, otherIntensity, otherGainDb);
  }

  setLedColor(red: number, green: number, blue: number, flags = InputLedFlag.SetColor): void {
    native().inputSetLedColor(this.handle, red, green, blue, flags);
  }

  legacyTriggerHapticPulse(targetPad: number, durationMicroseconds: number): void {
    native().inputLegacyTriggerHapticPulse(this.handle, targetPad, durationMicroseconds);
  }

  legacyTriggerRepeatedHapticPulse(
    targetPad: number,
    durationMicroseconds: number,
    offMicroseconds: number,
    repeat: number,
    flags = 0
  ): void {
    native().inputLegacyTriggerRepeatedHapticPulse(
      this.handle,
      targetPad,
      durationMicroseconds,
      offMicroseconds,
      repeat,
      flags
    );
  }

  showBindingPanel(): boolean {
    return native().inputShowBindingPanel(this.handle);
  }

  getType(): InputTypeValue {
    return normalizeInputType(this.cachedType ?? native().inputGetControllerType(this.handle));
  }

  getGamepadIndex(): number {
    return native().inputGetGamepadIndexForController(this.handle);
  }

  getDeviceBindingRevision(): InputDeviceBindingRevision | null {
    const revision = native().inputGetDeviceBindingRevision(this.handle);
    return revision ? { major: Number(revision.major), minor: Number(revision.minor) } : null;
  }

  getRemotePlaySessionId(): number {
    return native().inputGetRemotePlaySessionId(this.handle);
  }

  getHandle(): bigint {
    return this.handle;
  }
}

export class LegacyController {
  constructor(private readonly handle: bigint, private readonly cachedType?: string) {}

  activateActionSet(actionSetHandle: bigint): void {
    native().controllerActivateActionSet(this.handle, actionSetHandle);
  }

  getCurrentActionSet(): bigint {
    return BigInt(native().controllerGetCurrentActionSet(this.handle));
  }

  activateActionSetLayer(actionSetLayerHandle: bigint): void {
    native().controllerActivateActionSetLayer(this.handle, actionSetLayerHandle);
  }

  deactivateActionSetLayer(actionSetLayerHandle: bigint): void {
    native().controllerDeactivateActionSetLayer(this.handle, actionSetLayerHandle);
  }

  deactivateAllActionSetLayers(): void {
    native().controllerDeactivateAllActionSetLayers(this.handle);
  }

  getActiveActionSetLayers(): bigint[] {
    return native().controllerGetActiveActionSetLayers(this.handle).map(BigInt);
  }

  getDigitalActionData(actionHandle: bigint): InputDigitalActionData {
    return normalizeInputDigitalActionData(native().controllerGetDigitalActionData(this.handle, actionHandle));
  }

  isDigitalActionPressed(actionHandle: bigint): boolean {
    return native().controllerIsDigitalActionPressed(this.handle, actionHandle);
  }

  getDigitalActionOrigins(actionSetHandle: bigint, actionHandle: bigint): number[] {
    return native().controllerGetDigitalActionOrigins(this.handle, actionSetHandle, actionHandle).map(Number);
  }

  getAnalogActionData(actionHandle: bigint): InputAnalogActionData {
    return normalizeInputAnalogActionData(native().controllerGetAnalogActionData(this.handle, actionHandle));
  }

  getAnalogActionVector(actionHandle: bigint): AnalogActionVector {
    return native().controllerGetAnalogActionVector(this.handle, actionHandle);
  }

  getAnalogActionOrigins(actionSetHandle: bigint, actionHandle: bigint): number[] {
    return native().controllerGetAnalogActionOrigins(this.handle, actionSetHandle, actionHandle).map(Number);
  }

  stopAnalogActionMomentum(actionHandle: bigint): void {
    native().controllerStopAnalogActionMomentum(this.handle, actionHandle);
  }

  getMotionData(): InputMotionData {
    return normalizeInputMotionData(native().controllerGetMotionData(this.handle));
  }

  triggerHapticPulse(targetPad: number, durationMicroseconds: number): void {
    native().controllerTriggerHapticPulse(this.handle, targetPad, durationMicroseconds);
  }

  triggerRepeatedHapticPulse(
    targetPad: number,
    durationMicroseconds: number,
    offMicroseconds: number,
    repeat: number,
    flags = 0
  ): void {
    native().controllerTriggerRepeatedHapticPulse(
      this.handle,
      targetPad,
      durationMicroseconds,
      offMicroseconds,
      repeat,
      flags
    );
  }

  triggerVibration(leftSpeed: number, rightSpeed: number): void {
    native().controllerTriggerVibration(this.handle, leftSpeed, rightSpeed);
  }

  setLedColor(red: number, green: number, blue: number, flags = InputLedFlag.SetColor): void {
    native().controllerSetLedColor(this.handle, red, green, blue, flags);
  }

  showBindingPanel(): boolean {
    return native().controllerShowBindingPanel(this.handle);
  }

  getType(): InputTypeValue {
    return normalizeInputType(this.cachedType ?? native().controllerGetControllerType(this.handle));
  }

  getGamepadIndex(): number {
    return native().controllerGetGamepadIndexForController(this.handle);
  }

  getControllerBindingRevision(): InputDeviceBindingRevision | null {
    const revision = native().controllerGetControllerBindingRevision(this.handle);
    return revision ? { major: Number(revision.major), minor: Number(revision.minor) } : null;
  }

  getHandle(): bigint {
    return this.handle;
  }
}

export class MatchmakingServerListRequest {
  constructor(
    public readonly handle: bigint,
    public readonly steamRequest: bigint,
    public readonly appId: number,
    public readonly kind: string
  ) {}

  getState(): MatchmakingServerListRequestState {
    return normalizeMatchmakingServerListRequestState(
      native().matchmakingServersGetServerListRequestState(this.handle)
    );
  }

  getServerCount(): number {
    return this.getState().serverCount;
  }

  getServerDetails(server: number): MatchmakingServerItem | null {
    const details = native().matchmakingServersGetServerListRequestServerDetails(this.handle, server);
    return details ? normalizeMatchmakingServerItem(details) : null;
  }

  refreshQuery(): void {
    native().matchmakingServersRefreshServerListQuery(this.handle);
  }

  refreshServer(server: number): void {
    native().matchmakingServersRefreshServerListServer(this.handle, server);
  }

  cancelQuery(): void {
    native().matchmakingServersCancelServerListQuery(this.handle);
  }

  release(): boolean {
    return native().matchmakingServersReleaseServerListRequest(this.handle);
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

export const client = {
  SteamAccountType,
  createSteamPipe(): number {
    return native().clientCreateSteamPipe();
  },
  releaseSteamPipe(pipe: number): boolean {
    return native().clientReleaseSteamPipe(pipe);
  },
  connectToGlobalUser(pipe: number): number {
    return native().clientConnectToGlobalUser(pipe);
  },
  createLocalUser(accountType = SteamAccountType.Individual): SteamClientLocalUser {
    return normalizeSteamClientLocalUser(native().clientCreateLocalUser(accountType));
  },
  releaseUser(pipe: number, user: number): void {
    native().clientReleaseUser(pipe, user);
  },
  setLocalIpBinding(ipv4: number, port = 0): void {
    native().clientSetLocalIpBinding(ipv4, port);
  },
  getInterface(name: SteamClientInterfaceName, options: SteamClientInterfaceOptions = {}): bigint | null {
    const pointer = native().clientGetInterface(name, options.user ?? undefined, options.pipe ?? undefined, options.version ?? undefined);
    return pointer == null ? null : BigInt(pointer);
  },
  getIPCCallCount(): number {
    return native().clientGetIpcCallCount();
  },
  registerWarningMessageHook(handler: (event: UtilsWarningMessage) => void): CallbackHandle {
    return wrapCallbackHandle(
      native().clientRegisterWarningMessageHook((event) => {
        handler(normalizeUtilsWarningMessage(event));
      })
    );
  },
  shutdownIfAllPipesClosed(): boolean {
    return native().clientShutdownIfAllPipesClosed();
  }
};

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

export const user = {
  VoiceResult,
  BeginAuthSessionResult,
  UserHasLicenseForAppResult,
  MarketNotAllowedReasonFlags,
  DurationControlProgress,
  DurationControlNotification,
  DurationControlOnlineState,
  startVoiceRecording(): void {
    native().userStartVoiceRecording();
  },
  stopVoiceRecording(): void {
    native().userStopVoiceRecording();
  },
  getAvailableVoice(sampleRate?: number | null): UserVoiceAvailable {
    return normalizeUserVoiceAvailable(native().userGetAvailableVoice(sampleRate ?? undefined));
  },
  getVoice(
    wantCompressed = true,
    compressedBufferBytes?: number | null,
    wantUncompressed = false,
    uncompressedBufferBytes?: number | null,
    sampleRate?: number | null
  ): UserVoiceData {
    return normalizeUserVoiceData(
      native().userGetVoice(
        wantCompressed,
        compressedBufferBytes ?? undefined,
        wantUncompressed,
        uncompressedBufferBytes ?? undefined,
        sampleRate ?? undefined
      )
    );
  },
  decompressVoice(
    compressed: Buffer | Uint8Array,
    maxBytes?: number | null,
    desiredSampleRate?: number | null
  ): UserVoiceData {
    return normalizeUserVoiceData(
      native().userDecompressVoice(Buffer.from(compressed), maxBytes ?? undefined, desiredSampleRate ?? undefined)
    );
  },
  getVoiceOptimalSampleRate(): number {
    return native().userGetVoiceOptimalSampleRate();
  },
  getUserDataFolder(): string | null {
    return native().userGetUserDataFolder() ?? null;
  },
  trackAppUsageEvent(gameId: bigint, event: number, extraInfo?: string | null): void {
    native().userTrackAppUsageEvent(gameId, event, extraInfo ?? undefined);
  },
  beginAuthSession(ticket: Buffer | Uint8Array, steamId64: bigint): number {
    return native().userBeginAuthSession(Buffer.from(ticket), steamId64);
  },
  endAuthSession(steamId64: bigint): void {
    native().userEndAuthSession(steamId64);
  },
  cancelAuthTicket(authTicket: number): void {
    native().userCancelAuthTicket(authTicket);
  },
  hasLicenseForApp(steamId64: bigint, appId: number): number {
    return native().userHasLicenseForApp(steamId64, appId);
  },
  isBehindNAT(): boolean {
    return native().userIsBehindNat();
  },
  advertiseGame(steamId64: bigint, ip: number, port: number): void {
    native().userAdvertiseGame(steamId64, ip, port);
  },
  async requestEncryptedAppTicket(
    dataToInclude?: Buffer | Uint8Array | string | null,
    timeoutSeconds?: number | null
  ): Promise<UserEncryptedAppTicket> {
    const data = dataToInclude == null ? undefined : Buffer.from(dataToInclude);
    return normalizeUserEncryptedAppTicket(
      await native().userRequestEncryptedAppTicket(data, timeoutSeconds ?? undefined)
    );
  },
  getEncryptedAppTicket(maxBytes?: number | null): Buffer | null {
    return native().userGetEncryptedAppTicket(maxBytes ?? undefined) ?? null;
  },
  getGameBadgeLevel(series: number, foil = false): number {
    return native().userGetGameBadgeLevel(series, foil);
  },
  getPlayerSteamLevel(): number {
    return native().userGetPlayerSteamLevel();
  },
  async requestStoreAuthURL(redirectURL: string, timeoutSeconds?: number | null): Promise<string> {
    return native().userRequestStoreAuthUrl(redirectURL, timeoutSeconds ?? undefined);
  },
  isPhoneVerified(): boolean {
    return native().userIsPhoneVerified();
  },
  isTwoFactorEnabled(): boolean {
    return native().userIsTwoFactorEnabled();
  },
  isPhoneIdentifying(): boolean {
    return native().userIsPhoneIdentifying();
  },
  isPhoneRequiringVerification(): boolean {
    return native().userIsPhoneRequiringVerification();
  },
  async getMarketEligibility(timeoutSeconds?: number | null): Promise<UserMarketEligibility> {
    return normalizeUserMarketEligibility(await native().userGetMarketEligibility(timeoutSeconds ?? undefined));
  },
  async getDurationControl(timeoutSeconds?: number | null): Promise<UserDurationControl> {
    return normalizeUserDurationControl(await native().userGetDurationControl(timeoutSeconds ?? undefined));
  },
  setDurationControlOnlineState(onlineState: number): boolean {
    return native().userSetDurationControlOnlineState(onlineState);
  }
};

export const gameServerStats = {
  async requestUserStats(steamId64: bigint): Promise<GameServerStatsResult> {
    return normalizeGameServerStatsResult(await native().gameServerStatsRequestUserStats(steamId64));
  },
  getUserInt(steamId64: bigint, name: string): number | null {
    return native().gameServerStatsGetUserInt(steamId64, name) ?? null;
  },
  getUserFloat(steamId64: bigint, name: string): number | null {
    return native().gameServerStatsGetUserFloat(steamId64, name) ?? null;
  },
  getUserAchievement(steamId64: bigint, name: string): boolean | null {
    return native().gameServerStatsGetUserAchievement(steamId64, name) ?? null;
  },
  setUserInt(steamId64: bigint, name: string, value: number): boolean {
    return native().gameServerStatsSetUserInt(steamId64, name, value);
  },
  setUserFloat(steamId64: bigint, name: string, value: number): boolean {
    return native().gameServerStatsSetUserFloat(steamId64, name, value);
  },
  updateUserAvgRate(steamId64: bigint, name: string, countThisSession: number, sessionLength: number): boolean {
    return native().gameServerStatsUpdateUserAvgRate(steamId64, name, countThisSession, sessionLength);
  },
  setUserAchievement(steamId64: bigint, name: string): boolean {
    return native().gameServerStatsSetUserAchievement(steamId64, name);
  },
  clearUserAchievement(steamId64: bigint, name: string): boolean {
    return native().gameServerStatsClearUserAchievement(steamId64, name);
  },
  async storeUserStats(steamId64: bigint): Promise<GameServerStatsResult> {
    return normalizeGameServerStatsResult(await native().gameServerStatsStoreUserStats(steamId64));
  }
};

export const gameServer = {
  ServerMode,
  BeginAuthSessionResult,
  UserHasLicenseForAppResult,
  stats: gameServerStats,
  init(options: GameServerInitOptions): void {
    const nativeOptions: NativeGameServerInitOptions = {
      ip: options.ip,
      game_port: options.gamePort,
      query_port: options.queryPort,
      server_mode: options.serverMode ?? ServerMode.Authentication,
      version: options.version
    };
    native().gameServerInit(nativeOptions);
  },
  shutdown(): void {
    native().gameServerShutdown();
  },
  runCallbacks(): void {
    native().gameServerRunCallbacks();
  },
  isSecure(): boolean {
    return native().gameServerIsSecure();
  },
  getSteamID(): SteamId {
    return normalizeSteamId(native().gameServerGetSteamId());
  },
  setProduct(product: string): void {
    native().gameServerSetProduct(product);
  },
  setGameDescription(description: string): void {
    native().gameServerSetGameDescription(description);
  },
  setModDir(modDir: string): void {
    native().gameServerSetModDir(modDir);
  },
  setDedicatedServer(dedicated: boolean): void {
    native().gameServerSetDedicatedServer(dedicated);
  },
  logOn(token: string): void {
    native().gameServerLogOn(token);
  },
  logOnAnonymous(): void {
    native().gameServerLogOnAnonymous();
  },
  logOff(): void {
    native().gameServerLogOff();
  },
  isLoggedOn(): boolean {
    return native().gameServerIsLoggedOn();
  },
  interfaceIsSecure(): boolean {
    return native().gameServerInterfaceIsSecure();
  },
  getInterfaceSteamID(): SteamId {
    return normalizeSteamId(native().gameServerGetInterfaceSteamId());
  },
  wasRestartRequested(): boolean {
    return native().gameServerWasRestartRequested();
  },
  setMaxPlayerCount(playersMax: number): void {
    native().gameServerSetMaxPlayerCount(playersMax);
  },
  setBotPlayerCount(botPlayers: number): void {
    native().gameServerSetBotPlayerCount(botPlayers);
  },
  setServerName(name: string): void {
    native().gameServerSetServerName(name);
  },
  setMapName(name: string): void {
    native().gameServerSetMapName(name);
  },
  setPasswordProtected(passwordProtected: boolean): void {
    native().gameServerSetPasswordProtected(passwordProtected);
  },
  setSpectatorPort(port: number): void {
    native().gameServerSetSpectatorPort(port);
  },
  setSpectatorServerName(name: string): void {
    native().gameServerSetSpectatorServerName(name);
  },
  clearAllKeyValues(): void {
    native().gameServerClearAllKeyValues();
  },
  setKeyValue(key: string, value: string): void {
    native().gameServerSetKeyValue(key, value);
  },
  setGameTags(tags: string): void {
    native().gameServerSetGameTags(tags);
  },
  setGameData(data: string): void {
    native().gameServerSetGameData(data);
  },
  setRegion(region: string): void {
    native().gameServerSetRegion(region);
  },
  setAdvertiseServerActive(active: boolean): void {
    native().gameServerSetAdvertiseServerActive(active);
  },
  getAuthSessionTicket(identity?: NetworkingIdentity | null, maxBytes?: number | null): GameServerAuthTicket {
    return normalizeGameServerAuthTicket(
      native().gameServerGetAuthSessionTicket(identity ? nativeNetworkingIdentity(identity) : undefined, maxBytes ?? undefined)
    );
  },
  beginAuthSession(ticket: Buffer | Uint8Array, steamId64: bigint): number {
    return native().gameServerBeginAuthSession(Buffer.from(ticket), steamId64);
  },
  endAuthSession(steamId64: bigint): void {
    native().gameServerEndAuthSession(steamId64);
  },
  cancelAuthTicket(authTicket: number): void {
    native().gameServerCancelAuthTicket(authTicket);
  },
  userHasLicenseForApp(steamId64: bigint, appId: number): number {
    return native().gameServerUserHasLicenseForApp(steamId64, appId);
  },
  requestUserGroupStatus(steamId64: bigint, groupId64: bigint): boolean {
    return native().gameServerRequestUserGroupStatus(steamId64, groupId64);
  },
  getGameplayStats(): void {
    native().gameServerGetGameplayStats();
  },
  async getServerReputation(): Promise<GameServerReputationResult> {
    return normalizeGameServerReputationResult(await native().gameServerGetServerReputation());
  },
  async associateWithClan(clanId64: bigint): Promise<GameServerAssociateWithClanResult> {
    return normalizeGameServerAssociateWithClanResult(await native().gameServerAssociateWithClan(clanId64));
  },
  async computeNewPlayerCompatibility(steamId64: bigint): Promise<GameServerPlayerCompatibilityResult> {
    return normalizeGameServerPlayerCompatibilityResult(
      await native().gameServerComputeNewPlayerCompatibility(steamId64)
    );
  },
  getPublicIP(): GameServerPublicIp {
    return normalizeGameServerPublicIp(native().gameServerGetPublicIp());
  },
  handleIncomingPacket(data: Buffer | Uint8Array, srcIP: number, srcPort: number): boolean {
    return native().gameServerHandleIncomingPacket(Buffer.from(data), srcIP, srcPort);
  },
  getNextOutgoingPacket(maxBytes?: number | null): GameServerOutgoingPacket | null {
    return normalizeGameServerOutgoingPacket(native().gameServerGetNextOutgoingPacket(maxBytes ?? undefined));
  },
  sendUserConnectAndAuthenticateDeprecated(clientIP: number, authBlob: Buffer | Uint8Array): GameServerUserConnectResult {
    return normalizeGameServerUserConnectResult(
      native().gameServerSendUserConnectAndAuthenticateDeprecated(clientIP, Buffer.from(authBlob))
    );
  },
  createUnauthenticatedUserConnection(): SteamId {
    return normalizeSteamId(native().gameServerCreateUnauthenticatedUserConnection());
  },
  sendUserDisconnectDeprecated(steamId64: bigint): void {
    native().gameServerSendUserDisconnectDeprecated(steamId64);
  },
  updateUserData(steamId64: bigint, playerName: string, score: number): boolean {
    return native().gameServerUpdateUserData(steamId64, playerName, score);
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
  RemoteStoragePlatform,
  RemoteStorageLocalFileChange,
  RemoteStorageFilePathType,
  UGCReadAction,
  legacy: {
    PublishedFileVisibility: UgcItemVisibility,
    WorkshopFileType,
    WorkshopFileAction,
    WorkshopEnumerationType,
    WorkshopVideoProvider,
    WorkshopVote,
    async publishWorkshopFile(
      options: CloudLegacyPublishWorkshopFileOptions,
      timeoutSeconds?: number | null
    ): Promise<CloudLegacyPublishedFileResult> {
      return normalizeCloudLegacyPublishedFileResult(
        await native().cloudLegacyPublishWorkshopFile(
          options.filePath,
          options.previewPath,
          options.consumerAppId,
          options.title,
          options.description,
          options.visibility ?? UgcItemVisibility.Public,
          options.tags ?? [],
          options.fileType ?? WorkshopFileType.Community,
          timeoutSeconds ?? undefined
        )
      );
    },
    async publishVideo(
      options: CloudLegacyPublishVideoOptions,
      timeoutSeconds?: number | null
    ): Promise<CloudLegacyPublishedFileResult> {
      return normalizeCloudLegacyPublishedFileResult(
        await native().cloudLegacyPublishVideo(
          options.provider ?? WorkshopVideoProvider.YouTube,
          options.videoAccount,
          options.videoIdentifier,
          options.previewPath,
          options.consumerAppId,
          options.title,
          options.description,
          options.visibility ?? UgcItemVisibility.Public,
          options.tags ?? [],
          timeoutSeconds ?? undefined
        )
      );
    },
    createPublishedFileUpdateRequest(publishedFileId: bigint): bigint | null {
      const handle = native().cloudLegacyCreatePublishedFileUpdateRequest(publishedFileId);
      return handle == null ? null : BigInt(handle);
    },
    updatePublishedFileFile(handle: bigint, filePath: string): boolean {
      return native().cloudLegacyUpdatePublishedFileFile(handle, filePath);
    },
    updatePublishedFilePreviewFile(handle: bigint, previewPath: string): boolean {
      return native().cloudLegacyUpdatePublishedFilePreviewFile(handle, previewPath);
    },
    updatePublishedFileTitle(handle: bigint, title: string): boolean {
      return native().cloudLegacyUpdatePublishedFileTitle(handle, title);
    },
    updatePublishedFileDescription(handle: bigint, description: string): boolean {
      return native().cloudLegacyUpdatePublishedFileDescription(handle, description);
    },
    updatePublishedFileVisibility(handle: bigint, visibility: number): boolean {
      return native().cloudLegacyUpdatePublishedFileVisibility(handle, visibility);
    },
    updatePublishedFileTags(handle: bigint, tags: string[]): boolean {
      return native().cloudLegacyUpdatePublishedFileTags(handle, tags);
    },
    updatePublishedFileSetChangeDescription(handle: bigint, changeDescription: string): boolean {
      return native().cloudLegacyUpdatePublishedFileSetChangeDescription(handle, changeDescription);
    },
    async commitPublishedFileUpdate(
      handle: bigint,
      timeoutSeconds?: number | null
    ): Promise<CloudLegacyPublishedFileResult> {
      return normalizeCloudLegacyPublishedFileResult(
        await native().cloudLegacyCommitPublishedFileUpdate(handle, timeoutSeconds ?? undefined)
      );
    },
    async getPublishedFileDetails(
      publishedFileId: bigint,
      maxSecondsOld?: number | null,
      timeoutSeconds?: number | null
    ): Promise<CloudLegacyPublishedFileDetails> {
      return normalizeCloudLegacyPublishedFileDetails(
        await native().cloudLegacyGetPublishedFileDetails(
          publishedFileId,
          maxSecondsOld ?? undefined,
          timeoutSeconds ?? undefined
        )
      );
    },
    async deletePublishedFile(
      publishedFileId: bigint,
      timeoutSeconds?: number | null
    ): Promise<CloudLegacyPublishedFileIdResult> {
      return normalizeCloudLegacyPublishedFileIdResult(
        await native().cloudLegacyDeletePublishedFile(publishedFileId, timeoutSeconds ?? undefined)
      );
    },
    async enumerateUserPublishedFiles(
      startIndex?: number | null,
      timeoutSeconds?: number | null
    ): Promise<CloudLegacyEnumerateFilesResult> {
      return normalizeCloudLegacyEnumerateFilesResult(
        await native().cloudLegacyEnumerateUserPublishedFiles(startIndex ?? undefined, timeoutSeconds ?? undefined)
      );
    },
    async subscribePublishedFile(
      publishedFileId: bigint,
      timeoutSeconds?: number | null
    ): Promise<CloudLegacyPublishedFileIdResult> {
      return normalizeCloudLegacyPublishedFileIdResult(
        await native().cloudLegacySubscribePublishedFile(publishedFileId, timeoutSeconds ?? undefined)
      );
    },
    async enumerateUserSubscribedFiles(
      startIndex?: number | null,
      timeoutSeconds?: number | null
    ): Promise<CloudLegacyEnumerateSubscribedFilesResult> {
      return normalizeCloudLegacyEnumerateSubscribedFilesResult(
        await native().cloudLegacyEnumerateUserSubscribedFiles(startIndex ?? undefined, timeoutSeconds ?? undefined)
      );
    },
    async unsubscribePublishedFile(
      publishedFileId: bigint,
      timeoutSeconds?: number | null
    ): Promise<CloudLegacyPublishedFileIdResult> {
      return normalizeCloudLegacyPublishedFileIdResult(
        await native().cloudLegacyUnsubscribePublishedFile(publishedFileId, timeoutSeconds ?? undefined)
      );
    },
    async getPublishedItemVoteDetails(
      publishedFileId: bigint,
      timeoutSeconds?: number | null
    ): Promise<CloudLegacyPublishedItemVoteDetails> {
      return normalizeCloudLegacyPublishedItemVoteDetails(
        await native().cloudLegacyGetPublishedItemVoteDetails(publishedFileId, timeoutSeconds ?? undefined)
      );
    },
    async updateUserPublishedItemVote(
      publishedFileId: bigint,
      voteUp: boolean,
      timeoutSeconds?: number | null
    ): Promise<CloudLegacyPublishedFileIdResult> {
      return normalizeCloudLegacyPublishedFileIdResult(
        await native().cloudLegacyUpdateUserPublishedItemVote(publishedFileId, voteUp, timeoutSeconds ?? undefined)
      );
    },
    async getUserPublishedItemVoteDetails(
      publishedFileId: bigint,
      timeoutSeconds?: number | null
    ): Promise<CloudLegacyUserVoteDetails> {
      return normalizeCloudLegacyUserVoteDetails(
        await native().cloudLegacyGetUserPublishedItemVoteDetails(publishedFileId, timeoutSeconds ?? undefined)
      );
    },
    async enumerateUserSharedWorkshopFiles(
      steamId64: bigint,
      startIndex?: number | null,
      filters: CloudLegacyTagFilters = {},
      timeoutSeconds?: number | null
    ): Promise<CloudLegacyEnumerateFilesResult> {
      return normalizeCloudLegacyEnumerateFilesResult(
        await native().cloudLegacyEnumerateUserSharedWorkshopFiles(
          steamId64,
          startIndex ?? undefined,
          filters.requiredTags ?? [],
          filters.excludedTags ?? [],
          timeoutSeconds ?? undefined
        )
      );
    },
    async setUserPublishedFileAction(
      publishedFileId: bigint,
      action: number,
      timeoutSeconds?: number | null
    ): Promise<CloudLegacyPublishedFileActionResult> {
      return normalizeCloudLegacyPublishedFileActionResult(
        await native().cloudLegacySetUserPublishedFileAction(publishedFileId, action, timeoutSeconds ?? undefined)
      );
    },
    async enumeratePublishedFilesByUserAction(
      action: number,
      startIndex?: number | null,
      timeoutSeconds?: number | null
    ): Promise<CloudLegacyEnumerateUserActionFilesResult> {
      return normalizeCloudLegacyEnumerateUserActionFilesResult(
        await native().cloudLegacyEnumeratePublishedFilesByUserAction(
          action,
          startIndex ?? undefined,
          timeoutSeconds ?? undefined
        )
      );
    },
    async enumeratePublishedWorkshopFiles(
      enumerationType: number,
      startIndex?: number | null,
      count?: number | null,
      days?: number | null,
      filters: CloudLegacyWorkshopFilters = {},
      timeoutSeconds?: number | null
    ): Promise<CloudLegacyEnumerateWorkshopFilesResult> {
      return normalizeCloudLegacyEnumerateWorkshopFilesResult(
        await native().cloudLegacyEnumeratePublishedWorkshopFiles(
          enumerationType,
          startIndex ?? undefined,
          count ?? undefined,
          days ?? undefined,
          filters.tags ?? [],
          filters.userTags ?? [],
          timeoutSeconds ?? undefined
        )
      );
    }
  },
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
  async writeFileAsync(name: string, data: Buffer | Uint8Array | string, timeoutSeconds?: number | null): Promise<number> {
    return native().cloudWriteFileAsync(name, Buffer.from(data), timeoutSeconds ?? undefined);
  },
  async readFileAsync(
    name: string,
    offset?: number | null,
    bytesToRead?: number | null,
    timeoutSeconds?: number | null
  ): Promise<Buffer> {
    return native().cloudReadFileAsync(
      name,
      offset ?? undefined,
      bytesToRead ?? undefined,
      timeoutSeconds ?? undefined
    );
  },
  async shareFile(name: string, timeoutSeconds?: number | null): Promise<CloudFileShareResult> {
    return normalizeCloudFileShareResult(await native().cloudShareFile(name, timeoutSeconds ?? undefined));
  },
  deleteFile(name: string): boolean {
    return native().cloudDeleteFile(name);
  },
  forgetFile(name: string): boolean {
    return native().cloudForgetFile(name);
  },
  fileExists(name: string): boolean {
    return native().cloudFileExists(name);
  },
  filePersisted(name: string): boolean {
    return native().cloudFilePersisted(name);
  },
  getFileSize(name: string): bigint | null {
    const size = native().cloudGetFileSize(name);
    return size == null ? null : BigInt(size);
  },
  getFileTimestamp(name: string): bigint | null {
    const timestamp = native().cloudGetFileTimestamp(name);
    return timestamp == null ? null : BigInt(timestamp);
  },
  getSyncPlatforms(name: string): number {
    return native().cloudGetSyncPlatforms(name);
  },
  setSyncPlatforms(name: string, platforms: number): boolean {
    return native().cloudSetSyncPlatforms(name, platforms);
  },
  getQuota(): CloudQuota | null {
    return normalizeCloudQuota(native().cloudGetQuota());
  },
  listFiles(): FileInfo[] {
    return native().cloudListFiles().map((file: NativeCloudFileInfo) => new FileInfo(file.name, BigInt(file.size)));
  },
  getLocalFileChangeCount(): number {
    return native().cloudGetLocalFileChangeCount();
  },
  getLocalFileChange(index: number): CloudLocalFileChange | null {
    return normalizeCloudLocalFileChange(native().cloudGetLocalFileChange(index));
  },
  getLocalFileChanges(): CloudLocalFileChange[] {
    return native().cloudGetLocalFileChanges().map(normalizeCloudLocalFileChange).filter((change) => change !== null);
  },
  beginFileWriteBatch(): boolean {
    return native().cloudBeginFileWriteBatch();
  },
  endFileWriteBatch(): boolean {
    return native().cloudEndFileWriteBatch();
  },
  openFileWriteStream(name: string): bigint | null {
    const handle = native().cloudOpenFileWriteStream(name);
    return handle == null ? null : BigInt(handle);
  },
  writeFileStreamChunk(handle: bigint, data: Buffer | Uint8Array | string): boolean {
    return native().cloudWriteFileStreamChunk(handle, Buffer.from(data));
  },
  closeFileWriteStream(handle: bigint): boolean {
    return native().cloudCloseFileWriteStream(handle);
  },
  cancelFileWriteStream(handle: bigint): boolean {
    return native().cloudCancelFileWriteStream(handle);
  },
  async downloadUgc(
    file: bigint,
    priority?: number | null,
    timeoutSeconds?: number | null
  ): Promise<CloudUgcDownloadResult> {
    return normalizeCloudUgcDownloadResult(
      await native().cloudDownloadUgc(file, priority ?? undefined, timeoutSeconds ?? undefined)
    );
  },
  async downloadUgcToLocation(
    file: bigint,
    location: string,
    priority?: number | null,
    timeoutSeconds?: number | null
  ): Promise<CloudUgcDownloadResult> {
    return normalizeCloudUgcDownloadResult(
      await native().cloudDownloadUgcToLocation(file, location, priority ?? undefined, timeoutSeconds ?? undefined)
    );
  },
  getUgcDownloadProgress(file: bigint): CloudUgcDownloadProgress | null {
    return normalizeCloudUgcDownloadProgress(native().cloudGetUgcDownloadProgress(file));
  },
  getUgcDetails(file: bigint): CloudUgcDetails | null {
    return normalizeCloudUgcDetails(native().cloudGetUgcDetails(file));
  },
  readUgc(file: bigint, bytesToRead: number, offset?: number | null, action?: number | null): Buffer | null {
    return native().cloudReadUgc(file, bytesToRead, offset ?? undefined, action ?? undefined) ?? null;
  },
  getCachedUgcCount(): number {
    return native().cloudGetCachedUgcCount();
  },
  getCachedUgcHandle(index: number): bigint | null {
    const handle = native().cloudGetCachedUgcHandle(index);
    return handle == null ? null : BigInt(handle);
  },
  getCachedUgcHandles(): bigint[] {
    return native().cloudGetCachedUgcHandles().map((handle) => BigInt(handle));
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

export const gameServerHttp = {
  HttpMethod,
  createRequest(method: HttpMethodValue | number, url: string): number {
    return native().gameServerHttpCreateRequest(Number(method), url);
  },
  setContextValue(request: number, contextValue: bigint): boolean {
    return native().gameServerHttpSetContextValue(request, contextValue);
  },
  setNetworkActivityTimeout(request: number, timeoutSeconds: number): boolean {
    return native().gameServerHttpSetNetworkActivityTimeout(request, timeoutSeconds);
  },
  setHeaderValue(request: number, name: string, value: string): boolean {
    return native().gameServerHttpSetHeaderValue(request, name, value);
  },
  setGetOrPostParameter(request: number, name: string, value: string): boolean {
    return native().gameServerHttpSetGetOrPostParameter(request, name, value);
  },
  async sendRequest(request: number, timeoutSeconds?: number | null): Promise<HttpRequestCompleted> {
    return normalizeHttpRequestCompleted(await native().gameServerHttpSendRequest(request, timeoutSeconds ?? undefined));
  },
  async sendRequestAndStreamResponse(
    request: number,
    timeoutSeconds?: number | null
  ): Promise<HttpRequestHeadersReceived> {
    return normalizeHttpRequestHeadersReceived(
      await native().gameServerHttpSendRequestAndStreamResponse(request, timeoutSeconds ?? undefined)
    );
  },
  deferRequest(request: number): boolean {
    return native().gameServerHttpDeferRequest(request);
  },
  prioritizeRequest(request: number): boolean {
    return native().gameServerHttpPrioritizeRequest(request);
  },
  getResponseHeaderSize(request: number, name: string): number | null {
    return native().gameServerHttpGetResponseHeaderSize(request, name) ?? null;
  },
  getResponseHeaderValue(request: number, name: string): string | null {
    return native().gameServerHttpGetResponseHeaderValue(request, name) ?? null;
  },
  getResponseBodySize(request: number): number | null {
    return native().gameServerHttpGetResponseBodySize(request) ?? null;
  },
  getResponseBodyData(request: number): Buffer | null {
    return native().gameServerHttpGetResponseBodyData(request) ?? null;
  },
  getStreamingResponseBodyData(request: number, offset: number, size: number): Buffer | null {
    return native().gameServerHttpGetStreamingResponseBodyData(request, offset, size) ?? null;
  },
  releaseRequest(request: number): boolean {
    return native().gameServerHttpReleaseRequest(request);
  },
  getDownloadProgressPercent(request: number): number | null {
    return native().gameServerHttpGetDownloadProgressPercent(request) ?? null;
  },
  setRawPostBody(request: number, contentType: string, body: Buffer | Uint8Array): boolean {
    return native().gameServerHttpSetRawPostBody(request, contentType, Buffer.from(body));
  },
  createCookieContainer(allowResponsesToModify = false): number {
    return native().gameServerHttpCreateCookieContainer(allowResponsesToModify);
  },
  releaseCookieContainer(container: number): boolean {
    return native().gameServerHttpReleaseCookieContainer(container);
  },
  setCookie(container: number, host: string, url: string, cookie: string): boolean {
    return native().gameServerHttpSetCookie(container, host, url, cookie);
  },
  setRequestCookieContainer(request: number, container: number): boolean {
    return native().gameServerHttpSetRequestCookieContainer(request, container);
  },
  setUserAgentInfo(request: number, userAgent: string): boolean {
    return native().gameServerHttpSetUserAgentInfo(request, userAgent);
  },
  setRequiresVerifiedCertificate(request: number, requireVerifiedCertificate: boolean): boolean {
    return native().gameServerHttpSetRequiresVerifiedCertificate(request, requireVerifiedCertificate);
  },
  setAbsoluteTimeoutMs(request: number, timeoutMs: number): boolean {
    return native().gameServerHttpSetAbsoluteTimeoutMs(request, timeoutMs);
  },
  getRequestWasTimedOut(request: number): boolean | null {
    return native().gameServerHttpGetRequestWasTimedOut(request) ?? null;
  }
};

export const html = {
  MouseButton: HtmlMouseButton,
  MouseCursor: HtmlMouseCursor,
  KeyModifier: HtmlKeyModifier,
  init(): boolean {
    return native().htmlInit();
  },
  shutdown(): boolean {
    return native().htmlShutdown();
  },
  async createBrowser(options: HtmlCreateBrowserOptions = {}): Promise<number> {
    return native().htmlCreateBrowser(options.userAgent, options.userCss, options.timeoutSeconds);
  },
  removeBrowser(browser: number): void {
    native().htmlRemoveBrowser(browser);
  },
  loadUrl(browser: number, url: string, postData?: string | null): void {
    native().htmlLoadUrl(browser, url, postData ?? undefined);
  },
  setSize(browser: number, width: number, height: number): void {
    native().htmlSetSize(browser, width, height);
  },
  stopLoad(browser: number): void {
    native().htmlStopLoad(browser);
  },
  reload(browser: number): void {
    native().htmlReload(browser);
  },
  goBack(browser: number): void {
    native().htmlGoBack(browser);
  },
  goForward(browser: number): void {
    native().htmlGoForward(browser);
  },
  addHeader(browser: number, key: string, value: string): void {
    native().htmlAddHeader(browser, key, value);
  },
  executeJavascript(browser: number, script: string): void {
    native().htmlExecuteJavascript(browser, script);
  },
  mouseUp(browser: number, mouseButton = HtmlMouseButton.Left): void {
    native().htmlMouseUp(browser, mouseButton);
  },
  mouseDown(browser: number, mouseButton = HtmlMouseButton.Left): void {
    native().htmlMouseDown(browser, mouseButton);
  },
  mouseDoubleClick(browser: number, mouseButton = HtmlMouseButton.Left): void {
    native().htmlMouseDoubleClick(browser, mouseButton);
  },
  mouseMove(browser: number, x: number, y: number): void {
    native().htmlMouseMove(browser, x, y);
  },
  mouseWheel(browser: number, delta: number): void {
    native().htmlMouseWheel(browser, delta);
  },
  keyDown(browser: number, nativeKeyCode: number, keyModifiers = HtmlKeyModifier.None, isSystemKey = false): void {
    native().htmlKeyDown(browser, nativeKeyCode, keyModifiers, isSystemKey);
  },
  keyUp(browser: number, nativeKeyCode: number, keyModifiers = HtmlKeyModifier.None): void {
    native().htmlKeyUp(browser, nativeKeyCode, keyModifiers);
  },
  keyChar(browser: number, unicodeChar: number, keyModifiers = HtmlKeyModifier.None): void {
    native().htmlKeyChar(browser, unicodeChar, keyModifiers);
  },
  setHorizontalScroll(browser: number, absolutePixelScroll: number): void {
    native().htmlSetHorizontalScroll(browser, absolutePixelScroll);
  },
  setVerticalScroll(browser: number, absolutePixelScroll: number): void {
    native().htmlSetVerticalScroll(browser, absolutePixelScroll);
  },
  setKeyFocus(browser: number, hasKeyFocus: boolean): void {
    native().htmlSetKeyFocus(browser, hasKeyFocus);
  },
  viewSource(browser: number): void {
    native().htmlViewSource(browser);
  },
  copyToClipboard(browser: number): void {
    native().htmlCopyToClipboard(browser);
  },
  pasteFromClipboard(browser: number): void {
    native().htmlPasteFromClipboard(browser);
  },
  find(browser: number, search: string, currentlyInFind = false, reverse = false): void {
    native().htmlFind(browser, search, currentlyInFind, reverse);
  },
  stopFind(browser: number): void {
    native().htmlStopFind(browser);
  },
  getLinkAtPosition(browser: number, x: number, y: number): void {
    native().htmlGetLinkAtPosition(browser, x, y);
  },
  setCookie(hostname: string, key: string, value: string, options: HtmlCookieOptions = {}): void {
    native().htmlSetCookie(
      hostname,
      key,
      value,
      options.path,
      options.expires,
      options.secure,
      options.httpOnly
    );
  },
  setPageScaleFactor(browser: number, zoom: number, pointX = 0, pointY = 0): void {
    native().htmlSetPageScaleFactor(browser, zoom, pointX, pointY);
  },
  setBackgroundMode(browser: number, backgroundMode: boolean): void {
    native().htmlSetBackgroundMode(browser, backgroundMode);
  },
  setDpiScalingFactor(browser: number, dpiScaling: number): void {
    native().htmlSetDpiScalingFactor(browser, dpiScaling);
  },
  openDeveloperTools(browser: number): void {
    native().htmlOpenDeveloperTools(browser);
  },
  allowStartRequest(browser: number, allowed: boolean): void {
    native().htmlAllowStartRequest(browser, allowed);
  },
  jsDialogResponse(browser: number, result: boolean): void {
    native().htmlJsDialogResponse(browser, result);
  },
  fileLoadDialogResponse(browser: number, selectedFiles: string[]): void {
    native().htmlFileLoadDialogResponse(browser, selectedFiles);
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

export const gameServerInventory = {
  InventoryItemFlags,
  getResultStatus(resultHandle: number): number {
    return native().gameServerInventoryGetResultStatus(resultHandle);
  },
  getResultItems(resultHandle: number): InventoryItemDetail[] | null {
    return native().gameServerInventoryGetResultItems(resultHandle)?.map(normalizeInventoryItemDetail) ?? null;
  },
  getResultItemProperty(resultHandle: number, itemIndex: number, propertyName?: string | null): string | null {
    return native().gameServerInventoryGetResultItemProperty(resultHandle, itemIndex, propertyName ?? undefined) ?? null;
  },
  getResultTimestamp(resultHandle: number): number {
    return native().gameServerInventoryGetResultTimestamp(resultHandle);
  },
  checkResultSteamId(resultHandle: number, steamId64: bigint): boolean {
    return native().gameServerInventoryCheckResultSteamId(resultHandle, steamId64);
  },
  destroyResult(resultHandle: number): void {
    native().gameServerInventoryDestroyResult(resultHandle);
  },
  getAllItems(): number | null {
    return native().gameServerInventoryGetAllItems() ?? null;
  },
  getItemsById(instanceIds: bigint[]): number | null {
    return native().gameServerInventoryGetItemsById(instanceIds) ?? null;
  },
  serializeResult(resultHandle: number): Buffer | null {
    return native().gameServerInventorySerializeResult(resultHandle) ?? null;
  },
  deserializeResult(data: Buffer | Uint8Array): number | null {
    return native().gameServerInventoryDeserializeResult(Buffer.from(data)) ?? null;
  },
  generateItems(items: InventoryItemQuantity[]): number | null {
    return native().gameServerInventoryGenerateItems(items.map(nativeInventoryItemQuantity)) ?? null;
  },
  grantPromoItems(): number | null {
    return native().gameServerInventoryGrantPromoItems() ?? null;
  },
  addPromoItem(definition: number): number | null {
    return native().gameServerInventoryAddPromoItem(definition) ?? null;
  },
  addPromoItems(definitions: number[]): number | null {
    return native().gameServerInventoryAddPromoItems(definitions) ?? null;
  },
  consumeItem(itemId: bigint, quantity: number): number | null {
    return native().gameServerInventoryConsumeItem(itemId, quantity) ?? null;
  },
  exchangeItems(generate: InventoryItemQuantity[], destroy: InventoryInstanceQuantity[]): number | null {
    return (
      native().gameServerInventoryExchangeItems(
        generate.map(nativeInventoryItemQuantity),
        destroy.map(nativeInventoryInstanceQuantity)
      ) ?? null
    );
  },
  transferItemQuantity(sourceItemId: bigint, quantity: number, destinationItemId?: bigint | null): number | null {
    return native().gameServerInventoryTransferItemQuantity(sourceItemId, quantity, destinationItemId ?? undefined) ?? null;
  },
  sendItemDropHeartbeat(): void {
    native().gameServerInventorySendItemDropHeartbeat();
  },
  triggerItemDrop(dropListDefinition: number): number | null {
    return native().gameServerInventoryTriggerItemDrop(dropListDefinition) ?? null;
  },
  tradeItems(
    tradePartnerSteamId64: bigint,
    give: InventoryInstanceQuantity[],
    get: InventoryInstanceQuantity[]
  ): number | null {
    return (
      native().gameServerInventoryTradeItems(
        tradePartnerSteamId64,
        give.map(nativeInventoryInstanceQuantity),
        get.map(nativeInventoryInstanceQuantity)
      ) ?? null
    );
  },
  loadItemDefinitions(): boolean {
    return native().gameServerInventoryLoadItemDefinitions();
  },
  getItemDefinitionIds(): number[] {
    return native().gameServerInventoryGetItemDefinitionIds();
  },
  getItemDefinitionProperty(definition: number, propertyName?: string | null): string | null {
    return native().gameServerInventoryGetItemDefinitionProperty(definition, propertyName ?? undefined) ?? null;
  },
  async requestEligiblePromoItemDefinitionIds(
    steamId64: bigint,
    timeoutSeconds?: number | null
  ): Promise<InventoryEligiblePromoItemDefIds> {
    return normalizeInventoryEligiblePromoItemDefIds(
      await native().gameServerInventoryRequestEligiblePromoItemDefinitionIds(steamId64, timeoutSeconds ?? undefined)
    );
  },
  getEligiblePromoItemDefinitionIds(steamId64: bigint): number[] {
    return native().gameServerInventoryGetEligiblePromoItemDefinitionIds(steamId64);
  },
  async startPurchase(
    items: InventoryItemQuantity[],
    timeoutSeconds?: number | null
  ): Promise<InventoryStartPurchaseResult> {
    return normalizeInventoryStartPurchaseResult(
      await native().gameServerInventoryStartPurchase(items.map(nativeInventoryItemQuantity), timeoutSeconds ?? undefined)
    );
  },
  async requestPrices(timeoutSeconds?: number | null): Promise<InventoryRequestPricesResult> {
    return normalizeInventoryRequestPricesResult(await native().gameServerInventoryRequestPrices(timeoutSeconds ?? undefined));
  },
  getNumItemsWithPrices(): number {
    return native().gameServerInventoryGetNumItemsWithPrices();
  },
  getItemsWithPrices(maxItems?: number | null): InventoryPrice[] {
    return native()
      .gameServerInventoryGetItemsWithPrices(maxItems ?? undefined)
      .map(normalizeInventoryPrice);
  },
  getItemPrice(definition: number): InventoryPrice | null {
    const price = native().gameServerInventoryGetItemPrice(definition);
    return price ? normalizeInventoryPrice(price) : null;
  },
  startUpdateProperties(): bigint | null {
    const handle = native().gameServerInventoryStartUpdateProperties();
    return handle == null ? null : BigInt(handle);
  },
  removeProperty(updateHandle: bigint, itemId: bigint, propertyName: string): boolean {
    return native().gameServerInventoryRemoveProperty(updateHandle, itemId, propertyName);
  },
  setPropertyString(updateHandle: bigint, itemId: bigint, propertyName: string, value: string): boolean {
    return native().gameServerInventorySetPropertyString(updateHandle, itemId, propertyName, value);
  },
  setPropertyBool(updateHandle: bigint, itemId: bigint, propertyName: string, value: boolean): boolean {
    return native().gameServerInventorySetPropertyBool(updateHandle, itemId, propertyName, value);
  },
  setPropertyInt64(updateHandle: bigint, itemId: bigint, propertyName: string, value: bigint): boolean {
    return native().gameServerInventorySetPropertyInt64(updateHandle, itemId, propertyName, value);
  },
  setPropertyFloat(updateHandle: bigint, itemId: bigint, propertyName: string, value: number): boolean {
    return native().gameServerInventorySetPropertyFloat(updateHandle, itemId, propertyName, value);
  },
  submitUpdateProperties(updateHandle: bigint): number | null {
    return native().gameServerInventorySubmitUpdateProperties(updateHandle) ?? null;
  },
  inspectItem(itemToken: string): number | null {
    return native().gameServerInventoryInspectItem(itemToken) ?? null;
  }
};

export const input = {
  InputType,
  InputTypeCode,
  InputGlyphSize,
  InputGlyphStyle,
  InputHapticLocation,
  SteamControllerPad,
  InputLedFlag,
  XboxOrigin,
  SessionInputConfigurationSetting,
  Controller,
  init(): void {
    native().inputInit();
  },
  runFrame(reserved = false): void {
    native().inputRunFrame(reserved);
  },
  waitForData(waitForever = false, timeoutMs = 0): boolean {
    return native().inputWaitForData(waitForever, timeoutMs);
  },
  newDataAvailable(): boolean {
    return native().inputNewDataAvailable();
  },
  setActionManifestFilePath(path: string): boolean {
    return native().inputSetActionManifestFilePath(path);
  },
  getControllers(): Controller[] {
    return native().inputGetControllers().map((controller: NativeInputControllerInfo) => {
      return new Controller(BigInt(controller.handle), controller.inputType);
    });
  },
  getControllerForGamepadIndex(index: number): Controller | null {
    const handle = native().inputGetControllerForGamepadIndex(index);
    return handle == null ? null : new Controller(BigInt(handle));
  },
  getActionSet(actionSetName: string): bigint {
    return BigInt(native().inputGetActionSet(actionSetName));
  },
  getDigitalAction(actionName: string): bigint {
    return BigInt(native().inputGetDigitalAction(actionName));
  },
  getStringForDigitalActionName(actionHandle: bigint): string {
    return native().inputGetStringForDigitalActionName(actionHandle);
  },
  getAnalogAction(actionName: string): bigint {
    return BigInt(native().inputGetAnalogAction(actionName));
  },
  getStringForAnalogActionName(actionHandle: bigint): string {
    return native().inputGetStringForAnalogActionName(actionHandle);
  },
  getGlyphPngForActionOrigin(origin: number, size = InputGlyphSize.Medium, flags = InputGlyphStyle.Knockout): string {
    return native().inputGetGlyphPngForActionOrigin(origin, size, flags);
  },
  getGlyphSvgForActionOrigin(origin: number, flags = InputGlyphStyle.Knockout): string {
    return native().inputGetGlyphSvgForActionOrigin(origin, flags);
  },
  getLegacyGlyphForActionOrigin(origin: number): string {
    return native().inputGetLegacyGlyphForActionOrigin(origin);
  },
  getStringForActionOrigin(origin: number): string {
    return native().inputGetStringForActionOrigin(origin);
  },
  getStringForXboxOrigin(origin: number): string {
    return native().inputGetStringForXboxOrigin(origin);
  },
  getGlyphForXboxOrigin(origin: number): string {
    return native().inputGetGlyphForXboxOrigin(origin);
  },
  getActionOriginFromXboxOrigin(controller: Controller | bigint, origin: number): number {
    const handle = typeof controller === "bigint" ? controller : controller.getHandle();
    return native().inputGetActionOriginFromXboxOrigin(handle, origin);
  },
  translateActionOrigin(destinationInputType: number, sourceOrigin: number): number {
    return native().inputTranslateActionOrigin(destinationInputType, sourceOrigin);
  },
  getSessionInputConfigurationSettings(): number {
    return native().inputGetSessionInputConfigurationSettings();
  },
  shutdown(): void {
    native().inputShutdown();
  }
};

export const controller = {
  InputType,
  InputTypeCode,
  SteamControllerPad,
  InputLedFlag,
  XboxOrigin,
  Controller: LegacyController,
  init(): boolean {
    return native().controllerInit();
  },
  runFrame(): void {
    native().controllerRunFrame();
  },
  getControllers(): LegacyController[] {
    return native().controllerGetControllers().map((controller: NativeInputControllerInfo) => {
      return new LegacyController(BigInt(controller.handle), controller.inputType);
    });
  },
  getControllerForGamepadIndex(index: number): LegacyController | null {
    const handle = native().controllerGetControllerForGamepadIndex(index);
    return handle == null ? null : new LegacyController(BigInt(handle));
  },
  getActionSet(actionSetName: string): bigint {
    return BigInt(native().controllerGetActionSet(actionSetName));
  },
  getDigitalAction(actionName: string): bigint {
    return BigInt(native().controllerGetDigitalAction(actionName));
  },
  getAnalogAction(actionName: string): bigint {
    return BigInt(native().controllerGetAnalogAction(actionName));
  },
  getGlyphForActionOrigin(origin: number): string {
    return native().controllerGetGlyphForActionOrigin(origin);
  },
  getStringForActionOrigin(origin: number): string {
    return native().controllerGetStringForActionOrigin(origin);
  },
  getStringForXboxOrigin(origin: number): string {
    return native().controllerGetStringForXboxOrigin(origin);
  },
  getGlyphForXboxOrigin(origin: number): string {
    return native().controllerGetGlyphForXboxOrigin(origin);
  },
  getActionOriginFromXboxOrigin(controller: LegacyController | bigint, origin: number): number {
    const handle = typeof controller === "bigint" ? controller : controller.getHandle();
    return native().controllerGetActionOriginFromXboxOrigin(handle, origin);
  },
  translateActionOrigin(destinationInputType: number, sourceOrigin: number): number {
    return native().controllerTranslateActionOrigin(destinationInputType, sourceOrigin);
  },
  shutdown(): boolean {
    return native().controllerShutdown();
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
  async downloadClanActivityCounts(
    clanIds64: bigint[],
    timeoutSeconds?: number | null
  ): Promise<DownloadClanActivityCountsResult> {
    return normalizeDownloadClanActivityCountsResult(
      await native().friendsDownloadClanActivityCounts(clanIds64, timeoutSeconds ?? undefined)
    );
  },
  getFriendCountFromSource(sourceId64: bigint): number {
    return native().friendsGetFriendCountFromSource(sourceId64);
  },
  getFriendFromSourceByIndex(sourceId64: bigint, index: number): SteamId {
    return normalizeSteamId(native().friendsGetFriendFromSourceByIndex(sourceId64, index));
  },
  getFriendsFromSource(sourceId64: bigint): SteamId[] {
    return native().friendsGetFriendsFromSource(sourceId64).map(normalizeSteamId);
  },
  isUserInSource(steamId64: bigint, sourceId64: bigint): boolean {
    return native().friendsIsUserInSource(steamId64, sourceId64);
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
  getClanChatMessage(clanChatId64: bigint, messageId: number, maxBytes?: number | null): ClanChatMessage | null {
    return normalizeClanChatMessage(native().friendsGetClanChatMessage(clanChatId64, messageId, maxBytes ?? undefined));
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

export const matchmakingServers = {
  async requestInternetServerList(
    appId: number,
    options: MatchmakingServerListOptions = {}
  ): Promise<MatchmakingServerListResult> {
    return normalizeMatchmakingServerListResult(
      await native().matchmakingServersRequestInternetServerList(
        appId,
        nativeMatchmakingServerFilters(options.filters),
        options.timeoutSeconds ?? undefined
      )
    );
  },
  async requestLANServerList(appId: number, timeoutSeconds?: number | null): Promise<MatchmakingServerListResult> {
    return normalizeMatchmakingServerListResult(
      await native().matchmakingServersRequestLanServerList(appId, timeoutSeconds ?? undefined)
    );
  },
  async requestFriendsServerList(
    appId: number,
    options: MatchmakingServerListOptions = {}
  ): Promise<MatchmakingServerListResult> {
    return normalizeMatchmakingServerListResult(
      await native().matchmakingServersRequestFriendsServerList(
        appId,
        nativeMatchmakingServerFilters(options.filters),
        options.timeoutSeconds ?? undefined
      )
    );
  },
  async requestFavoritesServerList(
    appId: number,
    options: MatchmakingServerListOptions = {}
  ): Promise<MatchmakingServerListResult> {
    return normalizeMatchmakingServerListResult(
      await native().matchmakingServersRequestFavoritesServerList(
        appId,
        nativeMatchmakingServerFilters(options.filters),
        options.timeoutSeconds ?? undefined
      )
    );
  },
  async requestHistoryServerList(
    appId: number,
    options: MatchmakingServerListOptions = {}
  ): Promise<MatchmakingServerListResult> {
    return normalizeMatchmakingServerListResult(
      await native().matchmakingServersRequestHistoryServerList(
        appId,
        nativeMatchmakingServerFilters(options.filters),
        options.timeoutSeconds ?? undefined
      )
    );
  },
  async requestSpectatorServerList(
    appId: number,
    options: MatchmakingServerListOptions = {}
  ): Promise<MatchmakingServerListResult> {
    return normalizeMatchmakingServerListResult(
      await native().matchmakingServersRequestSpectatorServerList(
        appId,
        nativeMatchmakingServerFilters(options.filters),
        options.timeoutSeconds ?? undefined
      )
    );
  },
  openInternetServerList(
    appId: number,
    options: Pick<MatchmakingServerListOptions, "filters"> = {}
  ): MatchmakingServerListRequest {
    return normalizeMatchmakingServerListRequest(
      native().matchmakingServersOpenInternetServerList(appId, nativeMatchmakingServerFilters(options.filters))
    );
  },
  openLANServerList(appId: number): MatchmakingServerListRequest {
    return normalizeMatchmakingServerListRequest(native().matchmakingServersOpenLanServerList(appId));
  },
  openFriendsServerList(
    appId: number,
    options: Pick<MatchmakingServerListOptions, "filters"> = {}
  ): MatchmakingServerListRequest {
    return normalizeMatchmakingServerListRequest(
      native().matchmakingServersOpenFriendsServerList(appId, nativeMatchmakingServerFilters(options.filters))
    );
  },
  openFavoritesServerList(
    appId: number,
    options: Pick<MatchmakingServerListOptions, "filters"> = {}
  ): MatchmakingServerListRequest {
    return normalizeMatchmakingServerListRequest(
      native().matchmakingServersOpenFavoritesServerList(appId, nativeMatchmakingServerFilters(options.filters))
    );
  },
  openHistoryServerList(
    appId: number,
    options: Pick<MatchmakingServerListOptions, "filters"> = {}
  ): MatchmakingServerListRequest {
    return normalizeMatchmakingServerListRequest(
      native().matchmakingServersOpenHistoryServerList(appId, nativeMatchmakingServerFilters(options.filters))
    );
  },
  openSpectatorServerList(
    appId: number,
    options: Pick<MatchmakingServerListOptions, "filters"> = {}
  ): MatchmakingServerListRequest {
    return normalizeMatchmakingServerListRequest(
      native().matchmakingServersOpenSpectatorServerList(appId, nativeMatchmakingServerFilters(options.filters))
    );
  },
  async pingServer(ip: number, queryPort: number, timeoutSeconds?: number | null): Promise<MatchmakingServerPingResult> {
    return normalizeMatchmakingServerPingResult(
      await native().matchmakingServersPingServer(ip, queryPort, timeoutSeconds ?? undefined)
    );
  },
  async playerDetails(
    ip: number,
    queryPort: number,
    timeoutSeconds?: number | null
  ): Promise<MatchmakingServerPlayersResult> {
    return normalizeMatchmakingServerPlayersResult(
      await native().matchmakingServersPlayerDetails(ip, queryPort, timeoutSeconds ?? undefined)
    );
  },
  async serverRules(
    ip: number,
    queryPort: number,
    timeoutSeconds?: number | null
  ): Promise<MatchmakingServerRulesResult> {
    return normalizeMatchmakingServerRulesResult(
      await native().matchmakingServersServerRules(ip, queryPort, timeoutSeconds ?? undefined)
    );
  }
};

export const matchmaking = {
  LobbyType,
  LobbyComparison,
  LobbyDistanceFilter,
  FavoriteFlags,
  Lobby,
  servers: matchmakingServers,
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
  P2PSessionError,
  LegacySocketState: LegacyNetworkingSocketState,
  LegacySocketConnectionType: LegacyNetworkingSocketConnectionType,
  NetworkingSendFlags,
  NetworkingConnectionState,
  NetworkingAvailability,
  NetworkingFakeIpType,
  NetworkingConfigScope,
  NetworkingConfigDataType,
  NetworkingGetConfigValueResult,
  NetworkingDebugOutputType,
  NetworkingConfigValue,
  NetworkingIceEnable,
  sendP2PPacket(steamId64: bigint, sendType: number, data: Buffer | Uint8Array): boolean {
    return native().networkingSendP2PPacket(steamId64, sendType, Buffer.from(data));
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
  closeP2PSession(steamId64: bigint): boolean {
    return native().networkingCloseP2PSession(steamId64);
  },
  closeP2PChannel(steamId64: bigint, channel: number): boolean {
    return native().networkingCloseP2PChannel(steamId64, channel);
  },
  getP2PSessionState(steamId64: bigint): LegacyNetworkingP2PSessionState | null {
    return normalizeLegacyNetworkingP2PSessionState(native().networkingGetP2PSessionState(steamId64));
  },
  allowP2PPacketRelay(allow: boolean): boolean {
    return native().networkingAllowP2PPacketRelay(allow);
  },
  createListenSocket(virtualP2PPort = 0, options: LegacyNetworkingListenSocketOptions = {}): number {
    return native().networkingCreateListenSocket(
      virtualP2PPort,
      options.ip,
      options.port,
      options.allowPacketRelay
    );
  },
  createP2PConnectionSocket(
    steamId64: bigint,
    virtualPort = 0,
    timeoutSeconds = 0,
    allowPacketRelay = true
  ): number {
    return native().networkingCreateP2PConnectionSocket(steamId64, virtualPort, timeoutSeconds, allowPacketRelay);
  },
  createConnectionSocket(ip: number, port: number, timeoutSeconds = 0): number {
    return native().networkingCreateConnectionSocket(ip, port, timeoutSeconds);
  },
  destroySocket(socket: number, notifyRemoteEnd = false): boolean {
    return native().networkingDestroySocket(socket, notifyRemoteEnd);
  },
  destroyListenSocket(socket: number, notifyRemoteEnd = false): boolean {
    return native().networkingDestroyListenSocket(socket, notifyRemoteEnd);
  },
  sendDataOnSocket(socket: number, data: Buffer | Uint8Array, reliable = true): boolean {
    return native().networkingSendDataOnSocket(socket, Buffer.from(data), reliable);
  },
  isDataAvailableOnSocket(socket: number): number {
    return native().networkingIsDataAvailableOnSocket(socket);
  },
  retrieveDataFromSocket(socket: number, size: number): LegacyNetworkingSocketData | null {
    return normalizeLegacyNetworkingSocketData(native().networkingRetrieveDataFromSocket(socket, size));
  },
  isDataAvailable(listenSocket: number): LegacyNetworkingListenSocketAvailable | null {
    return normalizeLegacyNetworkingListenSocketAvailable(native().networkingIsDataAvailable(listenSocket));
  },
  retrieveData(listenSocket: number, size: number): LegacyNetworkingListenSocketData | null {
    return normalizeLegacyNetworkingListenSocketData(native().networkingRetrieveData(listenSocket, size));
  },
  getSocketInfo(socket: number): LegacyNetworkingSocketInfo | null {
    return normalizeLegacyNetworkingSocketInfo(native().networkingGetSocketInfo(socket));
  },
  getListenSocketInfo(listenSocket: number): LegacyNetworkingListenSocketInfo | null {
    return normalizeLegacyNetworkingListenSocketInfo(native().networkingGetListenSocketInfo(listenSocket));
  },
  getSocketConnectionType(socket: number): number {
    return native().networkingGetSocketConnectionType(socket);
  },
  getMaxPacketSize(socket: number): number {
    return native().networkingGetMaxPacketSize(socket);
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
    sendMessages(messages: NetworkingSocketOutgoingMessage[]): NetworkingSocketSendResult[] {
      return native()
        .networkingSocketsSendMessages(messages.map(nativeNetworkingSocketOutgoingMessage))
        .map(normalizeNetworkingSocketSendResult);
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
    getConnectionRealTimeStatusWithLanes(
      connection: number,
      maxLanes?: number | null
    ): NetworkingConnectionRealTimeStatusWithLanes | null {
      return normalizeNetworkingRealTimeStatusWithLanes(
        native().networkingSocketsGetConnectionRealTimeStatusWithLanes(connection, maxLanes ?? undefined)
      );
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
    getHostedDedicatedServerAddress(): NetworkingHostedDedicatedServerAddressResult {
      return normalizeNetworkingHostedDedicatedServerAddressResult(
        native().networkingSocketsGetHostedDedicatedServerAddress()
      );
    },
    createHostedDedicatedServerListenSocket(localVirtualPort = 0): number {
      return native().networkingSocketsCreateHostedDedicatedServerListenSocket(localVirtualPort);
    },
    getGameCoordinatorServerLogin(
      appData?: Buffer | Uint8Array | null,
      maxBlobBytes?: number | null
    ): NetworkingGameCoordinatorServerLoginResult {
      return normalizeNetworkingGameCoordinatorServerLoginResult(
        native().networkingSocketsGetGameCoordinatorServerLogin(
          appData ? Buffer.from(appData) : undefined,
          maxBlobBytes ?? undefined
        )
      );
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
    },
    createFakeUDPPort(fakeServerPort = 0): number | null {
      return native().networkingSocketsCreateFakeUdpPort(fakeServerPort) ?? null;
    }
  },
  fakeUDP: {
    SendFlags: NetworkingSendFlags,
    destroy(handle: number): boolean {
      return native().networkingFakeUdpPortDestroy(handle);
    },
    sendMessageToFakeIP(
      handle: number,
      remoteAddress: NetworkingIpAddress,
      data: Buffer | Uint8Array,
      sendFlags = NetworkingSendFlags.Unreliable
    ): number {
      return native().networkingFakeUdpPortSendMessageToFakeIp(
        handle,
        nativeNetworkingIpAddress(remoteAddress),
        Buffer.from(data),
        sendFlags
      );
    },
    receiveMessages(handle: number, maxMessages?: number | null): NetworkingMessage[] {
      return native()
        .networkingFakeUdpPortReceiveMessages(handle, maxMessages ?? undefined)
        .map(normalizeNetworkingMessage);
    },
    scheduleCleanup(handle: number, remoteAddress: NetworkingIpAddress): void {
      native().networkingFakeUdpPortScheduleCleanup(handle, nativeNetworkingIpAddress(remoteAddress));
    }
  },
  utils: {
    Availability: NetworkingAvailability,
    FakeIpType: NetworkingFakeIpType,
    ConfigScope: NetworkingConfigScope,
    ConfigDataType: NetworkingConfigDataType,
    ConfigValueResult: NetworkingGetConfigValueResult,
    DebugOutputType: NetworkingDebugOutputType,
    ConfigValue: NetworkingConfigValue,
    IceEnable: NetworkingIceEnable,
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
    },
    identityToString(identity: NetworkingIdentity): string {
      return native().networkingUtilsIdentityToString(nativeNetworkingIdentity(identity));
    },
    parseIdentity(text: string): NetworkingIdentityInfo | null {
      return normalizeNetworkingIdentityInfo(native().networkingUtilsParseIdentity(text));
    },
    setConfigValueInt32(value: number, scope: number, scopeObj: number, data: number): boolean {
      return native().networkingUtilsSetConfigValueInt32(value, scope, scopeObj, data);
    },
    setConfigValueInt64(value: number, scope: number, scopeObj: number, data: bigint | number | string): boolean {
      return native().networkingUtilsSetConfigValueInt64(value, scope, scopeObj, BigInt(data));
    },
    setConfigValueFloat(value: number, scope: number, scopeObj: number, data: number): boolean {
      return native().networkingUtilsSetConfigValueFloat(value, scope, scopeObj, data);
    },
    setConfigValueString(value: number, scope: number, scopeObj: number, data: string): boolean {
      return native().networkingUtilsSetConfigValueString(value, scope, scopeObj, data);
    },
    setConfigValueStruct(option: NetworkingConfigOption, scope = NetworkingConfigScope.Global, scopeObj = 0): boolean {
      return native().networkingUtilsSetConfigValueStruct(nativeNetworkingConfigValue(option), scope, scopeObj);
    },
    setGlobalConfigValueInt32(value: number, data: number): boolean {
      return native().networkingUtilsSetGlobalConfigValueInt32(value, data);
    },
    setGlobalConfigValueInt64(value: number, data: bigint | number | string): boolean {
      return native().networkingUtilsSetConfigValueInt64(value, NetworkingConfigScope.Global, 0, BigInt(data));
    },
    setGlobalConfigValueFloat(value: number, data: number): boolean {
      return native().networkingUtilsSetGlobalConfigValueFloat(value, data);
    },
    setGlobalConfigValueString(value: number, data: string): boolean {
      return native().networkingUtilsSetGlobalConfigValueString(value, data);
    },
    setGlobalConfigValueStruct(option: NetworkingConfigOption): boolean {
      return native().networkingUtilsSetConfigValueStruct(
        nativeNetworkingConfigValue(option),
        NetworkingConfigScope.Global,
        0
      );
    },
    setConnectionConfigValueInt32(connection: number, value: number, data: number): boolean {
      return native().networkingUtilsSetConnectionConfigValueInt32(connection, value, data);
    },
    setConnectionConfigValueInt64(connection: number, value: number, data: bigint | number | string): boolean {
      return native().networkingUtilsSetConfigValueInt64(value, NetworkingConfigScope.Connection, connection, BigInt(data));
    },
    setConnectionConfigValueFloat(connection: number, value: number, data: number): boolean {
      return native().networkingUtilsSetConnectionConfigValueFloat(connection, value, data);
    },
    setConnectionConfigValueString(connection: number, value: number, data: string): boolean {
      return native().networkingUtilsSetConnectionConfigValueString(connection, value, data);
    },
    setConnectionConfigValueStruct(connection: number, option: NetworkingConfigOption): boolean {
      return native().networkingUtilsSetConfigValueStruct(
        nativeNetworkingConfigValue(option),
        NetworkingConfigScope.Connection,
        connection
      );
    },
    getConfigValue(
      value: number,
      scope = NetworkingConfigScope.Global,
      scopeObj = 0,
      maxBytes?: number | null
    ): NetworkingConfigValueResult {
      return normalizeNetworkingConfigValueResult(
        native().networkingUtilsGetConfigValue(value, scope, scopeObj, maxBytes ?? undefined)
      );
    },
    getConfigValueInfo(value: number): NetworkingConfigValueInfo {
      return normalizeNetworkingConfigValueInfo(native().networkingUtilsGetConfigValueInfo(value));
    },
    iterateGenericEditableConfigValues(current = NetworkingConfigValue.Invalid, enumerateDevVars = false): number {
      return native().networkingUtilsIterateGenericEditableConfigValues(current, enumerateDevVars);
    },
    listGenericEditableConfigValues(enumerateDevVars = false): number[] {
      const values: number[] = [];
      let current: number = NetworkingConfigValue.Invalid;
      for (let guard = 0; guard < 1024; guard += 1) {
        current = native().networkingUtilsIterateGenericEditableConfigValues(current, enumerateDevVars);
        if (current === NetworkingConfigValue.Invalid) {
          return values;
        }
        values.push(current);
      }
      throw new Error("Steam networking config iteration did not terminate");
    },
    registerDebugOutputHook(
      detailLevel: number,
      handler: (event: NetworkingDebugOutput) => void
    ): CallbackHandle {
      return wrapCallbackHandle(
        native().networkingUtilsRegisterDebugOutputHook(detailLevel, (event) => {
          handler(normalizeNetworkingDebugOutput(event));
        })
      );
    }
  }
};

export const gameServerNetworking = {
  SendType,
  P2PSessionError,
  LegacySocketState: LegacyNetworkingSocketState,
  LegacySocketConnectionType: LegacyNetworkingSocketConnectionType,
  sendP2PPacket(steamId64: bigint, sendType: number, data: Buffer | Uint8Array): boolean {
    return native().gameServerNetworkingSendP2PPacket(steamId64, sendType, Buffer.from(data));
  },
  isP2PPacketAvailable(): number {
    return native().gameServerNetworkingIsP2PPacketAvailable();
  },
  readP2PPacket(size: number): P2PPacket {
    const packet = native().gameServerNetworkingReadP2PPacket(size);
    if (!packet) {
      throw new Error("No Steam game-server P2P packet is available");
    }
    return normalizeP2PPacket(packet);
  },
  acceptP2PSession(steamId64: bigint): void {
    native().gameServerNetworkingAcceptP2PSession(steamId64);
  },
  closeP2PSession(steamId64: bigint): boolean {
    return native().gameServerNetworkingCloseP2PSession(steamId64);
  },
  closeP2PChannel(steamId64: bigint, channel: number): boolean {
    return native().gameServerNetworkingCloseP2PChannel(steamId64, channel);
  },
  getP2PSessionState(steamId64: bigint): LegacyNetworkingP2PSessionState | null {
    return normalizeLegacyNetworkingP2PSessionState(native().gameServerNetworkingGetP2PSessionState(steamId64));
  },
  allowP2PPacketRelay(allow: boolean): boolean {
    return native().gameServerNetworkingAllowP2PPacketRelay(allow);
  },
  createListenSocket(virtualP2PPort = 0, options: LegacyNetworkingListenSocketOptions = {}): number {
    return native().gameServerNetworkingCreateListenSocket(
      virtualP2PPort,
      options.ip,
      options.port,
      options.allowPacketRelay
    );
  },
  createP2PConnectionSocket(
    steamId64: bigint,
    virtualPort = 0,
    timeoutSeconds = 0,
    allowPacketRelay = true
  ): number {
    return native().gameServerNetworkingCreateP2PConnectionSocket(
      steamId64,
      virtualPort,
      timeoutSeconds,
      allowPacketRelay
    );
  },
  createConnectionSocket(ip: number, port: number, timeoutSeconds = 0): number {
    return native().gameServerNetworkingCreateConnectionSocket(ip, port, timeoutSeconds);
  },
  destroySocket(socket: number, notifyRemoteEnd = false): boolean {
    return native().gameServerNetworkingDestroySocket(socket, notifyRemoteEnd);
  },
  destroyListenSocket(socket: number, notifyRemoteEnd = false): boolean {
    return native().gameServerNetworkingDestroyListenSocket(socket, notifyRemoteEnd);
  },
  sendDataOnSocket(socket: number, data: Buffer | Uint8Array, reliable = true): boolean {
    return native().gameServerNetworkingSendDataOnSocket(socket, Buffer.from(data), reliable);
  },
  isDataAvailableOnSocket(socket: number): number {
    return native().gameServerNetworkingIsDataAvailableOnSocket(socket);
  },
  retrieveDataFromSocket(socket: number, size: number): LegacyNetworkingSocketData | null {
    return normalizeLegacyNetworkingSocketData(native().gameServerNetworkingRetrieveDataFromSocket(socket, size));
  },
  isDataAvailable(listenSocket: number): LegacyNetworkingListenSocketAvailable | null {
    return normalizeLegacyNetworkingListenSocketAvailable(native().gameServerNetworkingIsDataAvailable(listenSocket));
  },
  retrieveData(listenSocket: number, size: number): LegacyNetworkingListenSocketData | null {
    return normalizeLegacyNetworkingListenSocketData(native().gameServerNetworkingRetrieveData(listenSocket, size));
  },
  getSocketInfo(socket: number): LegacyNetworkingSocketInfo | null {
    return normalizeLegacyNetworkingSocketInfo(native().gameServerNetworkingGetSocketInfo(socket));
  },
  getListenSocketInfo(listenSocket: number): LegacyNetworkingListenSocketInfo | null {
    return normalizeLegacyNetworkingListenSocketInfo(native().gameServerNetworkingGetListenSocketInfo(listenSocket));
  },
  getSocketConnectionType(socket: number): number {
    return native().gameServerNetworkingGetSocketConnectionType(socket);
  },
  getMaxPacketSize(socket: number): number {
    return native().gameServerNetworkingGetMaxPacketSize(socket);
  }
};

export const gameServerNetworkingMessages = {
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
    return native().gameServerNetworkingMessagesSendMessageToUser(
      nativeNetworkingIdentity(identity),
      Buffer.from(data),
      sendFlags,
      channel
    );
  },
  receiveMessagesOnChannel(channel = 0, maxMessages?: number | null): NetworkingMessage[] {
    return native()
      .gameServerNetworkingMessagesReceiveMessagesOnChannel(channel, maxMessages ?? undefined)
      .map(normalizeNetworkingMessage);
  },
  acceptSessionWithUser(identity: NetworkingIdentity): boolean {
    return native().gameServerNetworkingMessagesAcceptSessionWithUser(nativeNetworkingIdentity(identity));
  },
  closeSessionWithUser(identity: NetworkingIdentity): boolean {
    return native().gameServerNetworkingMessagesCloseSessionWithUser(nativeNetworkingIdentity(identity));
  },
  closeChannelWithUser(identity: NetworkingIdentity, channel: number): boolean {
    return native().gameServerNetworkingMessagesCloseChannelWithUser(nativeNetworkingIdentity(identity), channel);
  },
  getSessionConnectionInfo(identity: NetworkingIdentity): NetworkingMessagesSessionConnectionInfo {
    return normalizeNetworkingMessagesSessionConnectionInfo(
      native().gameServerNetworkingMessagesGetSessionConnectionInfo(nativeNetworkingIdentity(identity))
    );
  }
};

export const gameServerNetworkingSockets = {
  SendFlags: NetworkingSendFlags,
  ConnectionState: NetworkingConnectionState,
  Availability: NetworkingAvailability,
  createListenSocketIP(address: NetworkingIpAddress): number {
    return native().gameServerNetworkingSocketsCreateListenSocketIp(nativeNetworkingIpAddress(address));
  },
  connectByIPAddress(address: NetworkingIpAddress): number {
    return native().gameServerNetworkingSocketsConnectByIpAddress(nativeNetworkingIpAddress(address));
  },
  createListenSocketP2P(localVirtualPort = 0): number {
    return native().gameServerNetworkingSocketsCreateListenSocketP2p(localVirtualPort);
  },
  connectP2P(identity: NetworkingIdentity, remoteVirtualPort = 0): number {
    return native().gameServerNetworkingSocketsConnectP2p(nativeNetworkingIdentity(identity), remoteVirtualPort);
  },
  acceptConnection(connection: number): number {
    return native().gameServerNetworkingSocketsAcceptConnection(connection);
  },
  closeConnection(connection: number, options: NetworkingCloseConnectionOptions = {}): boolean {
    return native().gameServerNetworkingSocketsCloseConnection(
      connection,
      options.reason,
      options.debug,
      options.enableLinger
    );
  },
  closeListenSocket(socket: number): boolean {
    return native().gameServerNetworkingSocketsCloseListenSocket(socket);
  },
  setConnectionUserData(connection: number, userData: bigint): boolean {
    return native().gameServerNetworkingSocketsSetConnectionUserData(connection, userData);
  },
  getConnectionUserData(connection: number): bigint {
    return BigInt(native().gameServerNetworkingSocketsGetConnectionUserData(connection));
  },
  setConnectionName(connection: number, name: string): void {
    native().gameServerNetworkingSocketsSetConnectionName(connection, name);
  },
  getConnectionName(connection: number): string | null {
    return native().gameServerNetworkingSocketsGetConnectionName(connection) ?? null;
  },
  sendMessageToConnection(
    connection: number,
    data: Buffer | Uint8Array,
    sendFlags = NetworkingSendFlags.Reliable
  ): NetworkingSocketSendResult {
    return normalizeNetworkingSocketSendResult(
      native().gameServerNetworkingSocketsSendMessageToConnection(connection, Buffer.from(data), sendFlags)
    );
  },
  sendMessages(messages: NetworkingSocketOutgoingMessage[]): NetworkingSocketSendResult[] {
    return native()
      .gameServerNetworkingSocketsSendMessages(messages.map(nativeNetworkingSocketOutgoingMessage))
      .map(normalizeNetworkingSocketSendResult);
  },
  flushMessagesOnConnection(connection: number): number {
    return native().gameServerNetworkingSocketsFlushMessagesOnConnection(connection);
  },
  receiveMessagesOnConnection(connection: number, maxMessages?: number | null): NetworkingMessage[] {
    return native()
      .gameServerNetworkingSocketsReceiveMessagesOnConnection(connection, maxMessages ?? undefined)
      .map(normalizeNetworkingMessage);
  },
  getConnectionInfo(connection: number): NetworkingConnectionInfo | null {
    return normalizeNetworkingConnectionInfo(native().gameServerNetworkingSocketsGetConnectionInfo(connection));
  },
  getConnectionRealTimeStatus(connection: number): NetworkingConnectionRealTimeStatus | null {
    return normalizeNetworkingRealTimeStatus(
      native().gameServerNetworkingSocketsGetConnectionRealTimeStatus(connection)
    );
  },
  getConnectionRealTimeStatusWithLanes(
    connection: number,
    maxLanes?: number | null
  ): NetworkingConnectionRealTimeStatusWithLanes | null {
    return normalizeNetworkingRealTimeStatusWithLanes(
      native().gameServerNetworkingSocketsGetConnectionRealTimeStatusWithLanes(connection, maxLanes ?? undefined)
    );
  },
  getDetailedConnectionStatus(connection: number, maxBytes?: number | null): string | null {
    return native().gameServerNetworkingSocketsGetDetailedConnectionStatus(connection, maxBytes ?? undefined) ?? null;
  },
  getListenSocketAddress(socket: number): NetworkingIpAddressInfo | null {
    return normalizeNetworkingIpAddressInfo(native().gameServerNetworkingSocketsGetListenSocketAddress(socket));
  },
  createSocketPair(
    useNetworkLoopback = false,
    identity1?: NetworkingIdentity | null,
    identity2?: NetworkingIdentity | null
  ): NetworkingSocketPair | null {
    return normalizeNetworkingSocketPair(
      native().gameServerNetworkingSocketsCreateSocketPair(
        useNetworkLoopback,
        identity1 ? nativeNetworkingIdentity(identity1) : undefined,
        identity2 ? nativeNetworkingIdentity(identity2) : undefined
      )
    );
  },
  configureConnectionLanes(connection: number, priorities: number[], weights?: number[] | null): number {
    return native().gameServerNetworkingSocketsConfigureConnectionLanes(connection, priorities, weights ?? undefined);
  },
  getIdentity(): NetworkingIdentityInfo | null {
    return normalizeNetworkingIdentityInfo(native().gameServerNetworkingSocketsGetIdentity());
  },
  initAuthentication(): number {
    return native().gameServerNetworkingSocketsInitAuthentication();
  },
  getAuthenticationStatus(): NetworkingAuthenticationStatus {
    return normalizeNetworkingAuthenticationStatus(native().gameServerNetworkingSocketsGetAuthenticationStatus());
  },
  createPollGroup(): number {
    return native().gameServerNetworkingSocketsCreatePollGroup();
  },
  runCallbacks(): void {
    native().gameServerNetworkingSocketsRunCallbacks();
  },
  destroyPollGroup(pollGroup: number): boolean {
    return native().gameServerNetworkingSocketsDestroyPollGroup(pollGroup);
  },
  setConnectionPollGroup(connection: number, pollGroup: number): boolean {
    return native().gameServerNetworkingSocketsSetConnectionPollGroup(connection, pollGroup);
  },
  receiveMessagesOnPollGroup(pollGroup: number, maxMessages?: number | null): NetworkingMessage[] {
    return native()
      .gameServerNetworkingSocketsReceiveMessagesOnPollGroup(pollGroup, maxMessages ?? undefined)
      .map(normalizeNetworkingMessage);
  },
  receivedRelayAuthTicket(ticket: Buffer | Uint8Array): boolean {
    return native().gameServerNetworkingSocketsReceivedRelayAuthTicket(Buffer.from(ticket));
  },
  findRelayAuthTicketForServer(identity: NetworkingIdentity, remoteVirtualPort = 0): number {
    return native().gameServerNetworkingSocketsFindRelayAuthTicketForServer(
      nativeNetworkingIdentity(identity),
      remoteVirtualPort
    );
  },
  connectToHostedDedicatedServer(identity: NetworkingIdentity, remoteVirtualPort = 0): number {
    return native().gameServerNetworkingSocketsConnectToHostedDedicatedServer(
      nativeNetworkingIdentity(identity),
      remoteVirtualPort
    );
  },
  getHostedDedicatedServerPort(): number {
    return native().gameServerNetworkingSocketsGetHostedDedicatedServerPort();
  },
  getHostedDedicatedServerPopId(): number {
    return native().gameServerNetworkingSocketsGetHostedDedicatedServerPopId();
  },
  getHostedDedicatedServerAddress(): NetworkingHostedDedicatedServerAddressResult {
    return normalizeNetworkingHostedDedicatedServerAddressResult(
      native().gameServerNetworkingSocketsGetHostedDedicatedServerAddress()
    );
  },
  createHostedDedicatedServerListenSocket(localVirtualPort = 0): number {
    return native().gameServerNetworkingSocketsCreateHostedDedicatedServerListenSocket(localVirtualPort);
  },
  getGameCoordinatorServerLogin(
    appData?: Buffer | Uint8Array | null,
    maxBlobBytes?: number | null
  ): NetworkingGameCoordinatorServerLoginResult {
    return normalizeNetworkingGameCoordinatorServerLoginResult(
      native().gameServerNetworkingSocketsGetGameCoordinatorServerLogin(
        appData ? Buffer.from(appData) : undefined,
        maxBlobBytes ?? undefined
      )
    );
  },
  getCertificateRequest(maxBytes?: number | null): NetworkingCertificateResult {
    return normalizeNetworkingCertificateResult(
      native().gameServerNetworkingSocketsGetCertificateRequest(maxBytes ?? undefined)
    );
  },
  setCertificate(certificate: Buffer | Uint8Array): NetworkingCertificateResult {
    return normalizeNetworkingCertificateResult(
      native().gameServerNetworkingSocketsSetCertificate(Buffer.from(certificate))
    );
  },
  resetIdentity(identity?: NetworkingIdentity | null): void {
    native().gameServerNetworkingSocketsResetIdentity(identity ? nativeNetworkingIdentity(identity) : undefined);
  },
  beginAsyncRequestFakeIP(numPorts: number): boolean {
    return native().gameServerNetworkingSocketsBeginAsyncRequestFakeIp(numPorts);
  },
  getFakeIP(idxFirstPort = 0): NetworkingFakeIpResult {
    return normalizeNetworkingFakeIpResult(native().gameServerNetworkingSocketsGetFakeIp(idxFirstPort));
  },
  createListenSocketP2PFakeIP(idxFakePort = 0): number {
    return native().gameServerNetworkingSocketsCreateListenSocketP2pFakeIp(idxFakePort);
  },
  getRemoteFakeIPForConnection(connection: number): NetworkingRemoteFakeIpResult {
    return normalizeNetworkingRemoteFakeIpResult(
      native().gameServerNetworkingSocketsGetRemoteFakeIpForConnection(connection)
    );
  },
  createFakeUDPPort(fakeServerPort = 0): number | null {
    return native().gameServerNetworkingSocketsCreateFakeUdpPort(fakeServerPort) ?? null;
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
  UGCContentDescriptor,
  ItemPreviewType,
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
  getItemUpdateProgress(handle: bigint): UpdateProgress {
    return normalizeUpdateProgress(native().workshopGetItemUpdateProgress(handle));
  },
  async subscribe(itemId: bigint): Promise<void> {
    await native().workshopSubscribe(itemId);
  },
  async unsubscribe(itemId: bigint): Promise<void> {
    await native().workshopUnsubscribe(itemId);
  },
  async addFavorite(itemId: bigint, appId?: number | null): Promise<WorkshopFavoriteResult> {
    return normalizeWorkshopFavoriteResult(await native().workshopAddFavorite(itemId, appId ?? undefined));
  },
  async removeFavorite(itemId: bigint, appId?: number | null): Promise<WorkshopFavoriteResult> {
    return normalizeWorkshopFavoriteResult(await native().workshopRemoveFavorite(itemId, appId ?? undefined));
  },
  async setUserItemVote(itemId: bigint, voteUp: boolean): Promise<WorkshopSetUserItemVoteResult> {
    return normalizeWorkshopSetUserItemVoteResult(await native().workshopSetUserItemVote(itemId, voteUp));
  },
  async getUserItemVote(itemId: bigint): Promise<WorkshopGetUserItemVoteResult> {
    return normalizeWorkshopGetUserItemVoteResult(await native().workshopGetUserItemVote(itemId));
  },
  async startPlaytimeTracking(itemIds: bigint[]): Promise<WorkshopSimpleResult> {
    return normalizeWorkshopSimpleResult(await native().workshopStartPlaytimeTracking(itemIds));
  },
  async stopPlaytimeTracking(itemIds: bigint[]): Promise<WorkshopSimpleResult> {
    return normalizeWorkshopSimpleResult(await native().workshopStopPlaytimeTracking(itemIds));
  },
  async stopPlaytimeTrackingForAllItems(): Promise<WorkshopSimpleResult> {
    return normalizeWorkshopSimpleResult(await native().workshopStopPlaytimeTrackingForAllItems());
  },
  async addDependency(parentItemId: bigint, childItemId: bigint): Promise<WorkshopDependencyResult> {
    return normalizeWorkshopDependencyResult(await native().workshopAddDependency(parentItemId, childItemId));
  },
  async removeDependency(parentItemId: bigint, childItemId: bigint): Promise<WorkshopDependencyResult> {
    return normalizeWorkshopDependencyResult(await native().workshopRemoveDependency(parentItemId, childItemId));
  },
  async addAppDependency(itemId: bigint, appId: number): Promise<WorkshopAppDependencyResult> {
    return normalizeWorkshopAppDependencyResult(await native().workshopAddAppDependency(itemId, appId));
  },
  async removeAppDependency(itemId: bigint, appId: number): Promise<WorkshopAppDependencyResult> {
    return normalizeWorkshopAppDependencyResult(await native().workshopRemoveAppDependency(itemId, appId));
  },
  async getAppDependencies(itemId: bigint): Promise<WorkshopAppDependenciesResult> {
    return normalizeWorkshopAppDependenciesResult(await native().workshopGetAppDependencies(itemId));
  },
  async deleteItem(itemId: bigint): Promise<WorkshopDeleteItemResult> {
    return normalizeWorkshopDeleteItemResult(await native().workshopDeleteItem(itemId));
  },
  showEula(): boolean {
    return native().workshopShowEula();
  },
  async getEulaStatus(): Promise<WorkshopEulaStatus> {
    return normalizeWorkshopEulaStatus(await native().workshopGetEulaStatus());
  },
  getUserContentDescriptorPreferences(maxEntries?: number | null): number[] {
    return native().workshopGetUserContentDescriptorPreferences(maxEntries ?? undefined).map(Number);
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
  initWorkshopForGameServer(depotId: number, folder: string): boolean {
    return native().workshopInitWorkshopForGameServer(depotId, folder);
  },
  suspendDownloads(suspend: boolean): void {
    native().workshopSuspendDownloads(suspend);
  },
  setItemsDisabledLocally(itemIds: bigint[], disabled: boolean): boolean {
    return native().workshopSetItemsDisabledLocally(itemIds, disabled);
  },
  setSubscriptionsLoadOrder(itemIds: bigint[]): boolean {
    return native().workshopSetSubscriptionsLoadOrder(itemIds);
  },
  markDownloadedItemAsUnused(itemId: bigint): boolean {
    return native().workshopMarkDownloadedItemAsUnused(itemId);
  },
  getDownloadedItems(maxEntries?: number | null): bigint[] {
    return native().workshopGetDownloadedItems(maxEntries ?? undefined).map(BigInt);
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
      wasCached: Boolean(result.wasCached ?? result.was_cached),
      nextCursor: String(result.nextCursor ?? result.next_cursor ?? "")
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
  async getAllItemsByCursor(
    cursor: string,
    queryType: number,
    itemType: number,
    creatorAppId: number,
    consumerAppId: number,
    queryConfig?: WorkshopItemQueryConfig | null
  ): Promise<WorkshopPaginatedResult> {
    return normalizeWorkshopPaginatedResult(
      await native().workshopGetAllItemsByCursor(
        cursor,
        queryType,
        itemType,
        creatorAppId,
        consumerAppId,
        queryConfig ?? undefined
      )
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
  },
  async requestItemDetails(itemId: bigint, maxAgeSeconds?: number | null): Promise<WorkshopItemDetailsResult> {
    return normalizeWorkshopItemDetailsResult(
      await native().workshopRequestItemDetails(itemId, maxAgeSeconds ?? undefined)
    );
  }
};

export const gameServerWorkshop = {
  UgcItemVisibility,
  UpdateStatus,
  UGCQueryType,
  UGCType,
  UGCContentDescriptor,
  ItemPreviewType,
  UserListType,
  UserListOrder,
  async createItem(appId?: number | null): Promise<UgcResult> {
    return normalizeUgcResult(await native().gameServerWorkshopCreateItem(appId ?? undefined));
  },
  async updateItem(itemId: bigint, updateDetails: UgcUpdate, appId?: number | null): Promise<UgcResult> {
    return normalizeUgcResult(await native().gameServerWorkshopUpdateItem(itemId, updateDetails, appId ?? undefined));
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
          .gameServerWorkshopUpdateItemWithProgress(
            itemId,
            updateDetails,
            appId,
            (data) => progressCallback(normalizeUpdateProgress(data)),
            progressCallbackIntervalMs ?? undefined
          )
          .then(normalizeUgcResult)
      : native().gameServerWorkshopUpdateItem(itemId, updateDetails, appId ?? undefined).then(normalizeUgcResult);

    promise.then(successCallback, errorCallback);
  },
  getItemUpdateProgress(handle: bigint): UpdateProgress {
    return normalizeUpdateProgress(native().gameServerWorkshopGetItemUpdateProgress(handle));
  },
  async subscribe(itemId: bigint): Promise<void> {
    await native().gameServerWorkshopSubscribe(itemId);
  },
  async unsubscribe(itemId: bigint): Promise<void> {
    await native().gameServerWorkshopUnsubscribe(itemId);
  },
  async addFavorite(itemId: bigint, appId?: number | null): Promise<WorkshopFavoriteResult> {
    return normalizeWorkshopFavoriteResult(await native().gameServerWorkshopAddFavorite(itemId, appId ?? undefined));
  },
  async removeFavorite(itemId: bigint, appId?: number | null): Promise<WorkshopFavoriteResult> {
    return normalizeWorkshopFavoriteResult(await native().gameServerWorkshopRemoveFavorite(itemId, appId ?? undefined));
  },
  async setUserItemVote(itemId: bigint, voteUp: boolean): Promise<WorkshopSetUserItemVoteResult> {
    return normalizeWorkshopSetUserItemVoteResult(await native().gameServerWorkshopSetUserItemVote(itemId, voteUp));
  },
  async getUserItemVote(itemId: bigint): Promise<WorkshopGetUserItemVoteResult> {
    return normalizeWorkshopGetUserItemVoteResult(await native().gameServerWorkshopGetUserItemVote(itemId));
  },
  async startPlaytimeTracking(itemIds: bigint[]): Promise<WorkshopSimpleResult> {
    return normalizeWorkshopSimpleResult(await native().gameServerWorkshopStartPlaytimeTracking(itemIds));
  },
  async stopPlaytimeTracking(itemIds: bigint[]): Promise<WorkshopSimpleResult> {
    return normalizeWorkshopSimpleResult(await native().gameServerWorkshopStopPlaytimeTracking(itemIds));
  },
  async stopPlaytimeTrackingForAllItems(): Promise<WorkshopSimpleResult> {
    return normalizeWorkshopSimpleResult(await native().gameServerWorkshopStopPlaytimeTrackingForAllItems());
  },
  async addDependency(parentItemId: bigint, childItemId: bigint): Promise<WorkshopDependencyResult> {
    return normalizeWorkshopDependencyResult(await native().gameServerWorkshopAddDependency(parentItemId, childItemId));
  },
  async removeDependency(parentItemId: bigint, childItemId: bigint): Promise<WorkshopDependencyResult> {
    return normalizeWorkshopDependencyResult(await native().gameServerWorkshopRemoveDependency(parentItemId, childItemId));
  },
  async addAppDependency(itemId: bigint, appId: number): Promise<WorkshopAppDependencyResult> {
    return normalizeWorkshopAppDependencyResult(await native().gameServerWorkshopAddAppDependency(itemId, appId));
  },
  async removeAppDependency(itemId: bigint, appId: number): Promise<WorkshopAppDependencyResult> {
    return normalizeWorkshopAppDependencyResult(await native().gameServerWorkshopRemoveAppDependency(itemId, appId));
  },
  async getAppDependencies(itemId: bigint): Promise<WorkshopAppDependenciesResult> {
    return normalizeWorkshopAppDependenciesResult(await native().gameServerWorkshopGetAppDependencies(itemId));
  },
  async deleteItem(itemId: bigint): Promise<WorkshopDeleteItemResult> {
    return normalizeWorkshopDeleteItemResult(await native().gameServerWorkshopDeleteItem(itemId));
  },
  showEula(): boolean {
    return native().gameServerWorkshopShowEula();
  },
  async getEulaStatus(): Promise<WorkshopEulaStatus> {
    return normalizeWorkshopEulaStatus(await native().gameServerWorkshopGetEulaStatus());
  },
  getUserContentDescriptorPreferences(maxEntries?: number | null): number[] {
    return native().gameServerWorkshopGetUserContentDescriptorPreferences(maxEntries ?? undefined).map(Number);
  },
  state(itemId: bigint): number {
    return native().gameServerWorkshopState(itemId);
  },
  installInfo(itemId: bigint): InstallInfo | null {
    return normalizeInstallInfo(native().gameServerWorkshopInstallInfo(itemId));
  },
  downloadInfo(itemId: bigint): DownloadInfo | null {
    return normalizeDownloadInfo(native().gameServerWorkshopDownloadInfo(itemId));
  },
  download(itemId: bigint, highPriority: boolean): boolean {
    return native().gameServerWorkshopDownload(itemId, highPriority);
  },
  initWorkshopForGameServer(depotId: number, folder: string): boolean {
    return native().gameServerWorkshopInitWorkshopForGameServer(depotId, folder);
  },
  suspendDownloads(suspend: boolean): void {
    native().gameServerWorkshopSuspendDownloads(suspend);
  },
  setItemsDisabledLocally(itemIds: bigint[], disabled: boolean): boolean {
    return native().gameServerWorkshopSetItemsDisabledLocally(itemIds, disabled);
  },
  setSubscriptionsLoadOrder(itemIds: bigint[]): boolean {
    return native().gameServerWorkshopSetSubscriptionsLoadOrder(itemIds);
  },
  markDownloadedItemAsUnused(itemId: bigint): boolean {
    return native().gameServerWorkshopMarkDownloadedItemAsUnused(itemId);
  },
  getDownloadedItems(maxEntries?: number | null): bigint[] {
    return native().gameServerWorkshopGetDownloadedItems(maxEntries ?? undefined).map(BigInt);
  },
  getSubscribedItems(): bigint[] {
    return native().gameServerWorkshopGetSubscribedItems().map(BigInt);
  },
  async getItem(item: bigint, queryConfig?: WorkshopItemQueryConfig | null): Promise<WorkshopItem | null> {
    const result = await this.getItems([item], queryConfig ?? undefined);
    return result.items[0] ?? null;
  },
  async getItems(items: bigint[], queryConfig?: WorkshopItemQueryConfig | null): Promise<WorkshopItemsResult> {
    const result = await native().gameServerWorkshopGetItems(items, queryConfig ?? undefined);
    return {
      items: result.items.map(normalizeWorkshopItem),
      wasCached: Boolean(result.wasCached ?? result.was_cached),
      nextCursor: String(result.nextCursor ?? result.next_cursor ?? "")
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
      await native().gameServerWorkshopGetAllItems(
        page,
        queryType,
        itemType,
        creatorAppId,
        consumerAppId,
        queryConfig ?? undefined
      )
    );
  },
  async getAllItemsByCursor(
    cursor: string,
    queryType: number,
    itemType: number,
    creatorAppId: number,
    consumerAppId: number,
    queryConfig?: WorkshopItemQueryConfig | null
  ): Promise<WorkshopPaginatedResult> {
    return normalizeWorkshopPaginatedResult(
      await native().gameServerWorkshopGetAllItemsByCursor(
        cursor,
        queryType,
        itemType,
        creatorAppId,
        consumerAppId,
        queryConfig ?? undefined
      )
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
      await native().gameServerWorkshopGetUserItems(
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
  },
  async requestItemDetails(itemId: bigint, maxAgeSeconds?: number | null): Promise<WorkshopItemDetailsResult> {
    return normalizeWorkshopItemDetailsResult(
      await native().gameServerWorkshopRequestItemDetails(itemId, maxAgeSeconds ?? undefined)
    );
  }
};

export interface SteamBridgeClient {
  achievement: typeof achievement;
  apps: typeof apps;
  auth: typeof auth;
  callback: typeof callback;
  client: typeof client;
  cloud: typeof cloud;
  controller: typeof controller;
  friends: typeof friends;
  gameServer: typeof gameServer;
  gameServerHttp: typeof gameServerHttp;
  gameServerInventory: typeof gameServerInventory;
  gameServerNetworking: typeof gameServerNetworking;
  gameServerNetworkingMessages: typeof gameServerNetworkingMessages;
  gameServerNetworkingSockets: typeof gameServerNetworkingSockets;
  gameServerStats: typeof gameServerStats;
  gameServerWorkshop: typeof gameServerWorkshop;
  http: typeof http;
  inventory: typeof inventory;
  input: typeof input;
  localplayer: typeof localplayer;
  matchmaking: typeof matchmaking;
  matchmakingServers: typeof matchmakingServers;
  networking: typeof networking;
  overlay: typeof overlay;
  music: typeof music;
  parties: typeof parties;
  parental: typeof parental;
  remotePlay: typeof remotePlay;
  screenshots: typeof screenshots;
  stats: typeof stats;
  timeline: typeof timeline;
  user: typeof user;
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
    client,
    cloud,
    controller,
    friends,
    gameServer,
    gameServerHttp,
    gameServerInventory,
    gameServerNetworking,
    gameServerNetworkingMessages,
    gameServerNetworkingSockets,
    gameServerStats,
    gameServerWorkshop,
    http,
    inventory,
    input,
    localplayer,
    matchmaking,
    matchmakingServers,
    networking,
    overlay,
    music,
    parties,
    parental,
    remotePlay,
    screenshots,
    stats,
    timeline,
    user,
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

function normalizeGameServerAuthTicket(ticket: NativeGameServerAuthTicket): GameServerAuthTicket {
  return {
    data: ticket.data,
    handle: Number(ticket.handle)
  };
}

function normalizeGameServerPublicIp(address: NativeGameServerPublicIp): GameServerPublicIp {
  const source = address as unknown as Record<string, unknown>;
  const ipv4 = source.ipv4;
  const ipv4Address = source.ipv4Address ?? source.ipv4_address;
  return {
    isSet: Boolean(source.isSet ?? source.is_set),
    ipType: Number(source.ipType ?? source.ip_type ?? 0),
    ipv4: ipv4 == null ? null : Number(ipv4),
    ipv4Address: ipv4Address == null ? null : String(ipv4Address),
    ipv6: (source.ipv6 as Buffer | null | undefined) ?? null
  };
}

function normalizeGameServerOutgoingPacket(
  packet: NativeGameServerOutgoingPacket | null | undefined
): GameServerOutgoingPacket | null {
  if (!packet) {
    return null;
  }
  const source = packet as unknown as Record<string, unknown>;
  return {
    data: packet.data,
    ip: Number(packet.ip),
    ipAddress: String(source.ipAddress ?? source.ip_address ?? ""),
    port: Number(packet.port)
  };
}

function normalizeGameServerUserConnectResult(
  result: NativeGameServerUserConnectResult
): GameServerUserConnectResult {
  const source = result as unknown as Record<string, unknown>;
  return {
    success: Boolean(result.success),
    steamId: normalizeOptionalSteamId((source.steamId ?? source.steam_id) as NativeSteamId | null | undefined)
  };
}

function normalizeGameServerStatsResult(result: NativeGameServerStatsResult): GameServerStatsResult {
  const source = result as unknown as Record<string, unknown>;
  return {
    result: Number(result.result),
    steamId: normalizeSteamId((source.steamId ?? source.steam_id) as NativeSteamId)
  };
}

function normalizeGameServerReputationResult(result: NativeGameServerReputationResult): GameServerReputationResult {
  const source = result as unknown as Record<string, unknown>;
  return {
    result: Number(result.result),
    reputationScore: Number(source.reputationScore ?? source.reputation_score ?? 0),
    banned: Boolean(result.banned),
    bannedIp: Number(source.bannedIp ?? source.banned_ip ?? 0),
    bannedIpAddress: String(source.bannedIpAddress ?? source.banned_ip_address ?? ""),
    bannedPort: Number(source.bannedPort ?? source.banned_port ?? 0),
    bannedGameId: BigInt((source.bannedGameId ?? source.banned_game_id ?? 0) as bigint | string | number),
    banExpires: Number(source.banExpires ?? source.ban_expires ?? 0)
  };
}

function normalizeGameServerAssociateWithClanResult(
  result: NativeGameServerAssociateWithClanResult
): GameServerAssociateWithClanResult {
  return {
    result: Number(result.result)
  };
}

function normalizeGameServerPlayerCompatibilityResult(
  result: NativeGameServerPlayerCompatibilityResult
): GameServerPlayerCompatibilityResult {
  const source = result as unknown as Record<string, unknown>;
  return {
    result: Number(result.result),
    playersThatDontLikeCandidate: Number(
      source.playersThatDontLikeCandidate ?? source.players_that_dont_like_candidate ?? 0
    ),
    playersThatCandidateDoesntLike: Number(
      source.playersThatCandidateDoesntLike ?? source.players_that_candidate_doesnt_like ?? 0
    ),
    clanPlayersThatDontLikeCandidate: Number(
      source.clanPlayersThatDontLikeCandidate ?? source.clan_players_that_dont_like_candidate ?? 0
    ),
    candidate: normalizeSteamId((source.candidate ?? EMPTY_NATIVE_STEAM_ID) as NativeSteamId)
  };
}

function normalizeOptionalSteamId(steamId: NativeSteamId | null | undefined): SteamId | null {
  return steamId ? normalizeSteamId(steamId) : null;
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

function normalizeClanChatMessage(message: NativeClanChatMessage | null | undefined): ClanChatMessage | null {
  if (!message) {
    return null;
  }
  const normalized = normalizeFriendMessage(message);
  if (!normalized) {
    return null;
  }
  return {
    ...normalized,
    chatter: normalizeSteamId(message.chatter)
  };
}

function normalizeFriendsGroupInfo(group: NativeFriendsGroupInfo): FriendsGroupInfo {
  return {
    id: group.id,
    name: group.name,
    members: (group.members ?? []).map(normalizeSteamId)
  };
}

function normalizeCloudQuota(quota: NativeCloudQuota | null | undefined): CloudQuota | null {
  if (!quota) {
    return null;
  }
  const source = quota as unknown as Record<string, unknown>;
  return {
    totalBytes: BigInt((source.totalBytes ?? source.total_bytes ?? 0) as bigint | number | string),
    availableBytes: BigInt((source.availableBytes ?? source.available_bytes ?? 0) as bigint | number | string)
  };
}

function normalizeCloudLocalFileChange(
  change: NativeCloudLocalFileChange | null | undefined
): CloudLocalFileChange | null {
  if (!change) {
    return null;
  }
  const source = change as unknown as Record<string, unknown>;
  return {
    name: change.name,
    changeType: Number(source.changeType ?? source.change_type ?? 0),
    pathType: Number(source.pathType ?? source.path_type ?? 0)
  };
}

function normalizeCloudFileShareResult(result: NativeCloudFileShareResult): CloudFileShareResult {
  return {
    result: result.result,
    file: BigInt(result.file),
    name: result.name
  };
}

function normalizeCloudUgcDownloadProgress(
  progress: NativeCloudUgcDownloadProgress | null | undefined
): CloudUgcDownloadProgress | null {
  if (!progress) {
    return null;
  }
  const source = progress as unknown as Record<string, unknown>;
  return {
    downloadedBytes: BigInt((source.downloadedBytes ?? source.downloaded_bytes ?? 0) as bigint | number | string),
    expectedBytes: BigInt((source.expectedBytes ?? source.expected_bytes ?? 0) as bigint | number | string)
  };
}

function normalizeCloudUgcDetails(details: NativeCloudUgcDetails | null | undefined): CloudUgcDetails | null {
  if (!details) {
    return null;
  }
  const source = details as unknown as Record<string, unknown>;
  return {
    appId: Number(source.appId ?? source.app_id ?? 0),
    name: details.name,
    size: BigInt(details.size),
    owner: normalizeSteamId(details.owner)
  };
}

function normalizeCloudUgcDownloadResult(result: NativeCloudUgcDownloadResult): CloudUgcDownloadResult {
  const source = result as unknown as Record<string, unknown>;
  return {
    result: result.result,
    file: BigInt(result.file),
    appId: Number(source.appId ?? source.app_id ?? 0),
    size: BigInt(result.size),
    name: result.name,
    owner: normalizeSteamId(result.owner)
  };
}

function normalizeCloudLegacyPublishedFileResult(
  result: NativeCloudLegacyPublishedFileResult
): CloudLegacyPublishedFileResult {
  const source = result as unknown as Record<string, unknown>;
  return {
    result: Number(result.result),
    publishedFileId: BigInt((source.publishedFileId ?? source.published_file_id ?? 0) as bigint | number | string),
    needsToAcceptAgreement:
      (source.needsToAcceptAgreement ?? source.needs_to_accept_agreement ?? null) as boolean | null
  };
}

function normalizeCloudLegacyPublishedFileIdResult(
  result: NativeCloudLegacyPublishedFileIdResult
): CloudLegacyPublishedFileIdResult {
  const source = result as unknown as Record<string, unknown>;
  return {
    result: Number(result.result),
    publishedFileId: BigInt((source.publishedFileId ?? source.published_file_id ?? 0) as bigint | number | string)
  };
}

function normalizeCloudLegacyPublishedFileActionResult(
  result: NativeCloudLegacyPublishedFileActionResult
): CloudLegacyPublishedFileActionResult {
  return {
    ...normalizeCloudLegacyPublishedFileIdResult(result),
    action: Number(result.action)
  };
}

function normalizeCloudLegacyPublishedFileDetails(
  details: NativeCloudLegacyPublishedFileDetails
): CloudLegacyPublishedFileDetails {
  const source = details as unknown as Record<string, unknown>;
  return {
    ...normalizeCloudLegacyPublishedFileIdResult(details),
    creatorAppId: Number(source.creatorAppId ?? source.creator_app_id ?? 0),
    consumerAppId: Number(source.consumerAppId ?? source.consumer_app_id ?? 0),
    title: details.title,
    description: details.description,
    file: BigInt(details.file),
    previewFile: BigInt((source.previewFile ?? source.preview_file ?? 0) as bigint | number | string),
    owner: normalizeSteamId(details.owner),
    timeCreated: Number(source.timeCreated ?? source.time_created ?? 0),
    timeUpdated: Number(source.timeUpdated ?? source.time_updated ?? 0),
    visibility: Number(details.visibility),
    banned: Boolean(details.banned),
    tags: details.tags ?? [],
    tagsTruncated: Boolean(source.tagsTruncated ?? source.tags_truncated),
    fileName: String(source.fileName ?? source.file_name ?? ""),
    fileSize: BigInt((source.fileSize ?? source.file_size ?? 0) as bigint | number | string),
    previewFileSize: BigInt((source.previewFileSize ?? source.preview_file_size ?? 0) as bigint | number | string),
    url: details.url,
    fileType: Number(source.fileType ?? source.file_type ?? 0),
    acceptedForUse: Boolean(source.acceptedForUse ?? source.accepted_for_use)
  };
}

function normalizeCloudLegacyEnumerateFilesResult(
  result: NativeCloudLegacyEnumerateFilesResult
): CloudLegacyEnumerateFilesResult {
  const source = result as unknown as Record<string, unknown>;
  const ids = (source.publishedFileIds ?? source.published_file_ids ?? []) as Array<bigint | number | string>;
  return {
    result: Number(result.result),
    returnedResults: Number(source.returnedResults ?? source.returned_results ?? 0),
    totalResultCount: Number(source.totalResultCount ?? source.total_result_count ?? 0),
    publishedFileIds: ids.map((id) => BigInt(id))
  };
}

function normalizeCloudLegacyEnumerateSubscribedFilesResult(
  result: NativeCloudLegacyEnumerateSubscribedFilesResult
): CloudLegacyEnumerateSubscribedFilesResult {
  const source = result as unknown as Record<string, unknown>;
  return {
    ...normalizeCloudLegacyEnumerateFilesResult(result),
    subscribedTimes: ((source.subscribedTimes ?? source.subscribed_times ?? []) as number[]).map(Number)
  };
}

function normalizeCloudLegacyEnumerateWorkshopFilesResult(
  result: NativeCloudLegacyEnumerateWorkshopFilesResult
): CloudLegacyEnumerateWorkshopFilesResult {
  const source = result as unknown as Record<string, unknown>;
  return {
    ...normalizeCloudLegacyEnumerateFilesResult(result),
    scores: (result.scores ?? []).map(Number),
    appId: Number(source.appId ?? source.app_id ?? 0),
    startIndex: Number(source.startIndex ?? source.start_index ?? 0)
  };
}

function normalizeCloudLegacyEnumerateUserActionFilesResult(
  result: NativeCloudLegacyEnumerateUserActionFilesResult
): CloudLegacyEnumerateUserActionFilesResult {
  const source = result as unknown as Record<string, unknown>;
  return {
    ...normalizeCloudLegacyEnumerateFilesResult(result),
    action: Number(result.action),
    updatedTimes: ((source.updatedTimes ?? source.updated_times ?? []) as number[]).map(Number)
  };
}

function normalizeCloudLegacyPublishedItemVoteDetails(
  result: NativeCloudLegacyPublishedItemVoteDetails
): CloudLegacyPublishedItemVoteDetails {
  const source = result as unknown as Record<string, unknown>;
  return {
    ...normalizeCloudLegacyPublishedFileIdResult(result),
    votesFor: Number(source.votesFor ?? source.votes_for ?? 0),
    votesAgainst: Number(source.votesAgainst ?? source.votes_against ?? 0),
    reports: Number(result.reports),
    score: Number(result.score)
  };
}

function normalizeCloudLegacyUserVoteDetails(result: NativeCloudLegacyUserVoteDetails): CloudLegacyUserVoteDetails {
  return {
    ...normalizeCloudLegacyPublishedFileIdResult(result),
    vote: Number(result.vote)
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

function normalizeMatchmakingServerItem(server: NativeMatchmakingServerItem): MatchmakingServerItem {
  const source = server as unknown as Record<string, unknown>;
  const address = server.address as unknown as Record<string, unknown>;
  return {
    address: {
      ip: Number(address.ip ?? 0),
      ipAddress: String(address.ipAddress ?? address.ip_address ?? ""),
      connectionPort: Number(address.connectionPort ?? address.connection_port ?? 0),
      queryPort: Number(address.queryPort ?? address.query_port ?? 0)
    },
    ping: Number(server.ping ?? 0),
    hadSuccessfulResponse: Boolean(source.hadSuccessfulResponse ?? source.had_successful_response),
    doNotRefresh: Boolean(source.doNotRefresh ?? source.do_not_refresh),
    gameDir: String(source.gameDir ?? source.game_dir ?? ""),
    map: String(server.map ?? ""),
    gameDescription: String(source.gameDescription ?? source.game_description ?? ""),
    appId: Number(source.appId ?? source.app_id ?? 0),
    players: Number(server.players ?? 0),
    maxPlayers: Number(source.maxPlayers ?? source.max_players ?? 0),
    botPlayers: Number(source.botPlayers ?? source.bot_players ?? 0),
    password: Boolean(server.password),
    secure: Boolean(server.secure),
    timeLastPlayed: Number(source.timeLastPlayed ?? source.time_last_played ?? 0),
    serverVersion: Number(source.serverVersion ?? source.server_version ?? 0),
    name: String(server.name ?? ""),
    gameTags: String(source.gameTags ?? source.game_tags ?? ""),
    steamId: normalizeSteamId((source.steamId ?? source.steam_id ?? EMPTY_NATIVE_STEAM_ID) as NativeSteamId)
  };
}

function normalizeMatchmakingServerListResult(
  result: NativeMatchmakingServerListResult
): MatchmakingServerListResult {
  return {
    response: Number(result.response ?? 0),
    responded: (result.responded ?? []).map(Number),
    failed: (result.failed ?? []).map(Number),
    servers: (result.servers ?? []).map(normalizeMatchmakingServerItem)
  };
}

function normalizeMatchmakingServerListRequest(
  request: NativeMatchmakingServerListRequest
): MatchmakingServerListRequest {
  const source = request as unknown as Record<string, unknown>;
  return new MatchmakingServerListRequest(
    BigInt(source.handle as bigint | number | string),
    BigInt((source.steamRequest ?? source.steam_request ?? 0) as bigint | number | string),
    Number(source.appId ?? source.app_id ?? 0),
    String(source.kind ?? "")
  );
}

function normalizeMatchmakingServerListRequestState(
  state: NativeMatchmakingServerListRequestState
): MatchmakingServerListRequestState {
  const source = state as unknown as Record<string, unknown>;
  return {
    handle: BigInt(source.handle as bigint | number | string),
    steamRequest: BigInt((source.steamRequest ?? source.steam_request ?? 0) as bigint | number | string),
    appId: Number(source.appId ?? source.app_id ?? 0),
    kind: String(source.kind ?? ""),
    completed: Boolean(state.completed),
    cancelled: Boolean(source.cancelled ?? source.canceled),
    response: Number(state.response ?? 0),
    responded: (state.responded ?? []).map(Number),
    failed: (state.failed ?? []).map(Number),
    refreshing: Boolean(state.refreshing),
    serverCount: Number(source.serverCount ?? source.server_count ?? 0)
  };
}

function normalizeMatchmakingServerPingResult(
  result: NativeMatchmakingServerPingResult
): MatchmakingServerPingResult {
  return {
    responded: Boolean(result.responded),
    server: result.server ? normalizeMatchmakingServerItem(result.server) : null
  };
}

function normalizeMatchmakingServerPlayersResult(
  result: NativeMatchmakingServerPlayersResult
): MatchmakingServerPlayersResult {
  return {
    responded: Boolean(result.responded),
    players: (result.players ?? []).map((player: NativeMatchmakingServerPlayer) => {
      const source = player as unknown as Record<string, unknown>;
      return {
        name: player.name,
        score: Number(player.score ?? 0),
        timePlayed: Number(source.timePlayed ?? source.time_played ?? 0)
      };
    })
  };
}

function normalizeMatchmakingServerRulesResult(
  result: NativeMatchmakingServerRulesResult
): MatchmakingServerRulesResult {
  return {
    responded: Boolean(result.responded),
    rules: (result.rules ?? []).map((rule: NativeMatchmakingServerRule) => ({
      name: rule.name,
      value: rule.value
    }))
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

function nativeMatchmakingServerFilters(filters: MatchmakingServerBrowserFilter[] | undefined): unknown[] | undefined {
  return filters?.map((filter) => ({
    key: filter.key,
    value: filter.value ?? ""
  }));
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

function normalizeDownloadClanActivityCountsResult(
  result: NativeDownloadClanActivityCountsResult
): DownloadClanActivityCountsResult {
  return {
    success: Boolean(result.success)
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

function normalizeSteamClientLocalUser(result: NativeSteamClientLocalUser): SteamClientLocalUser {
  return {
    user: Number(result.user ?? 0),
    pipe: Number(result.pipe ?? 0)
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
  if (callbackId === SteamCallback.SteamUGCRequestDetailsResult) {
    return normalizeUgcDetailsCallbackEvent(event);
  }
  if (!event || typeof event !== "object") {
    return event;
  }
  const source = event as Record<string, unknown>;
  const result: Record<string, unknown> = { ...source };
  for (const key of [
    "steam_id",
    "clan",
    "clan_chat",
    "friend",
    "lobby",
    "member",
    "user",
    "admin",
    "game_id",
    "game_server",
    "item_id",
    "child_item_id",
    "legacy_content",
    "manifest_id",
    "file",
    "preview_file",
    "published_file_id",
    "total_files_size",
    "handle",
    "user_changed",
    "making_change",
    "remote",
    "lobby_steam_id",
    "friend_steam_id",
    "async_call",
    "file_size",
    "owner_steam_id",
    "group_id",
    "candidate_steam_id",
    "banned_game_id",
    "recording_ms",
    "longest_clip_ms"
  ]) {
    if (key in result) {
      result[key] = normalizeBigIntLike(result[key]);
    }
  }
  if (callbackId === SteamCallback.SteamTimelineEventRecordingExists && "event" in result) {
    result.event = normalizeBigIntLike(result.event);
  }
  if (result.steam_id !== undefined) {
    result.steamId ??= result.steam_id;
  }
  const aliases: Record<string, string> = {
    account_id: "accountId",
    app_id: "appId",
    async_call: "asyncCall",
    allowed_at_time: "allowedAtTime",
    action_time: "actionTime",
    app_ids: "appIds",
    auth_ticket: "authTicket",
    chat_id: "chatId",
    chat_permissions: "chatPermissions",
    chat_room_enter_response: "chatRoomEnterResponse",
    check_file_signature: "checkFileSignature",
    child_item_id: "childItemId",
    clan_chat: "clanChat",
    clan_players_that_dont_like_candidate: "clanPlayersThatDontLikeCandidate",
    clip_count: "clipCount",
    conn_port: "connPort",
    connect_url: "connectUrl",
    candidate_steam_id: "candidateSteamId",
    ban_expires: "banExpires",
    banned_game_id: "bannedGameId",
    banned_ip: "bannedIp",
    banned_ip_address: "bannedIpAddress",
    banned_port: "bannedPort",
    bgra_base64: "bgraBase64",
    bgra_byte_length: "bgraByteLength",
    bgra_truncated: "bgraTruncated",
    browser_handle: "browserHandle",
    can_go_back: "canGoBack",
    can_go_forward: "canGoForward",
    deny_reason: "denyReason",
    entry_type: "entryType",
    file_size: "fileSize",
    file_type: "fileType",
    friend_steam_id: "friendSteamId",
    from_cache: "fromCache",
    game_id: "gameId",
    game_server: "gameServer",
    group_id: "groupId",
    has_animated_avatar: "hasAnimatedAvatar",
    has_avatar_frame: "hasAvatarFrame",
    has_mini_profile_background: "hasMiniProfileBackground",
    has_profile_background: "hasProfileBackground",
    has_profile_modifier: "hasProfileModifier",
    has_bgra_data: "hasBgraData",
    initial_file: "initialFile",
    item_id: "itemId",
    ip_address: "ipAddress",
    is_following: "isFollowing",
    is_offline: "isOffline",
    is_redirect: "isRedirect",
    is_rtmp: "isRtmp",
    key_length: "keyLength",
    kicked_due_to_disconnect: "kickedDueToDisconnect",
    lobby_steam_id: "lobbySteamId",
    local_handle: "localHandle",
    longest_clip_ms: "longestClipMs",
    manifest_id: "manifestId",
    live_link: "liveLink",
    making_change: "makingChange",
    member_state_change: "memberStateChange",
    message_id: "messageId",
    mouse_cursor: "mouseCursor",
    new_navigation: "newNavigation",
    new_window_browser_handle: "newWindowBrowserHandle",
    minutes_battery_left: "minutesBatteryLeft",
    new_volume: "newVolume",
    new_device_cooldown_days: "newDeviceCooldownDays",
    next_cursor: "nextCursor",
    num_app_dependencies: "numAppDependencies",
    not_allowed_reason: "notAllowedReason",
    officer_count: "officerCount",
    optional_text: "optionalText",
    owner_steam_id: "ownerSteamId",
    old_browser_handle: "oldBrowserHandle",
    page_scale: "pageScale",
    page_serial: "pageSerial",
    page_size: "pageSize",
    page_title: "pageTitle",
    parameter_size: "parameterSize",
    phase_id: "phaseId",
    post_data: "postData",
    preview_file: "previewFile",
    preview_file_size: "previewFileSize",
    published_file_id: "publishedFileId",
    players_that_candidate_doesnt_like: "playersThatCandidateDoesntLike",
    players_that_dont_like_candidate: "playersThatDontLikeCandidate",
    query_port: "queryPort",
    recording_exists: "recordingExists",
    recording_ms: "recordingMs",
    reputation_score: "reputationScore",
    results_returned: "resultsReturned",
    returned_results: "returnedResults",
    seconds_allowed: "secondsAllowed",
    seconds_last_5h: "secondsLast5h",
    seconds_remaining: "secondsRemaining",
    seconds_played: "secondsPlayed",
    seconds_today: "secondsToday",
    session_id: "sessionId",
    sha_hex: "shaHex",
    screenshot_count: "screenshotCount",
    scroll_current: "scrollCurrent",
    scroll_max: "scrollMax",
    scroll_x: "scrollX",
    scroll_y: "scrollY",
    steam_guard_required_days: "steamGuardRequiredDays",
    steam_ids: "steamIds",
    submitted_text: "submittedText",
    total_connects: "totalConnects",
    total_files_size: "totalFilesSize",
    total_num_app_dependencies: "totalNumAppDependencies",
    total_results: "totalResults",
    total_minutes_played: "totalMinutesPlayed",
    total_result_count: "totalResultCount",
    vote_skipped: "voteSkipped",
    vote_up: "voteUp",
    voted_down: "votedDown",
    voted_up: "votedUp",
    was_add_request: "wasAddRequest",
    was_cached: "wasCached",
    needs_action: "needsAction",
    update_tall: "updateTall",
    update_wide: "updateWide",
    update_x: "updateX",
    update_y: "updateY",
    user_changed: "userChanged",
    video_app_id: "videoAppId"
  };
  for (const [snake, camel] of Object.entries(aliases)) {
    if (result[snake] !== undefined) {
      result[camel] ??= result[snake];
    }
  }
  if (Array.isArray(result.steam_ids)) {
    result.steam_ids = result.steam_ids.map((value) => normalizeBigIntLike(value));
    result.steamIds = result.steam_ids;
  }
  if (Array.isArray(result.published_file_ids)) {
    result.published_file_ids = result.published_file_ids.map((value) => normalizeBigIntLike(value));
    result.publishedFileIds = result.published_file_ids;
  }
  if (typeof result.bgra_base64 === "string") {
    result.bgra = Buffer.from(result.bgra_base64, "base64");
  }
  return result;
}

function normalizeUgcDetailsCallbackEvent(event: unknown): unknown {
  if (!event || typeof event !== "object") {
    return event;
  }
  const source = event as Record<string, unknown>;
  const result: Record<string, unknown> = { ...source };
  if (result.details && typeof result.details === "object") {
    result.details = normalizeUgcDetailsPayload(result.details as Record<string, unknown>);
  }
  if (result.was_cached !== undefined) {
    result.wasCached ??= result.was_cached;
  }
  return result;
}

function normalizeUgcDetailsPayload(details: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = { ...details };
  for (const key of [
    "published_file_id",
    "owner",
    "file",
    "preview_file",
    "file_size",
    "preview_file_size",
    "total_files_size"
  ]) {
    if (key in result) {
      result[key] = normalizeBigIntLike(result[key]);
    }
  }
  const aliases: Record<string, string> = {
    accepted_for_use: "acceptedForUse",
    consumer_app_id: "consumerAppId",
    creator_app_id: "creatorAppId",
    file_name: "fileName",
    file_size: "fileSize",
    file_type: "fileType",
    num_children: "numChildren",
    num_downvotes: "numDownvotes",
    num_upvotes: "numUpvotes",
    preview_file: "previewFile",
    preview_file_size: "previewFileSize",
    published_file_id: "publishedFileId",
    tags_truncated: "tagsTruncated",
    time_added_to_user_list: "timeAddedToUserList",
    time_created: "timeCreated",
    time_updated: "timeUpdated",
    total_files_size: "totalFilesSize"
  };
  for (const [snake, camel] of Object.entries(aliases)) {
    if (result[snake] !== undefined) {
      result[camel] ??= result[snake];
    }
  }
  if (typeof result.tags === "string") {
    result.tags = result.tags.split(",").filter(Boolean);
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

function normalizeUserVoiceAvailable(result: NativeUserVoiceAvailable): UserVoiceAvailable {
  return {
    result: Number(result.result),
    compressedBytes: Number(result.compressedBytes ?? result.compressed_bytes ?? 0),
    uncompressedBytes: Number(result.uncompressedBytes ?? result.uncompressed_bytes ?? 0)
  };
}

function normalizeUserVoiceData(result: NativeUserVoiceData): UserVoiceData {
  return {
    result: Number(result.result),
    compressed: result.compressed ?? null,
    uncompressed: result.uncompressed ?? null,
    compressedBytes: Number(result.compressedBytes ?? result.compressed_bytes ?? 0),
    uncompressedBytes: Number(result.uncompressedBytes ?? result.uncompressed_bytes ?? 0)
  };
}

function normalizeUserEncryptedAppTicket(result: NativeUserEncryptedAppTicket): UserEncryptedAppTicket {
  return {
    result: Number(result.result),
    ticket: result.ticket ?? null
  };
}

function normalizeUserMarketEligibility(result: NativeUserMarketEligibility): UserMarketEligibility {
  return {
    allowed: Boolean(result.allowed),
    notAllowedReason: Number(result.notAllowedReason ?? result.not_allowed_reason ?? 0),
    allowedAtTime: Number(result.allowedAtTime ?? result.allowed_at_time ?? 0),
    steamGuardRequiredDays: Number(result.steamGuardRequiredDays ?? result.steam_guard_required_days ?? 0),
    newDeviceCooldownDays: Number(result.newDeviceCooldownDays ?? result.new_device_cooldown_days ?? 0)
  };
}

function normalizeUserDurationControl(result: NativeUserDurationControl): UserDurationControl {
  return {
    result: Number(result.result),
    appId: Number(result.appId ?? result.app_id ?? 0),
    applicable: Boolean(result.applicable),
    secondsLast5h: Number(result.secondsLast5h ?? result.seconds_last_5h ?? 0),
    progress: Number(result.progress),
    notification: Number(result.notification),
    secondsToday: Number(result.secondsToday ?? result.seconds_today ?? 0),
    secondsRemaining: Number(result.secondsRemaining ?? result.seconds_remaining ?? 0)
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

function normalizeInputDigitalActionData(data: NativeInputDigitalActionData): InputDigitalActionData {
  return {
    state: Boolean(data.state),
    active: Boolean(data.active)
  };
}

function normalizeInputAnalogActionData(data: NativeInputAnalogActionData): InputAnalogActionData {
  return {
    mode: Number(data.mode),
    x: Number(data.x),
    y: Number(data.y),
    active: Boolean(data.active)
  };
}

function normalizeInputMotionData(data: NativeInputMotionData): InputMotionData {
  const source = data as Record<string, unknown>;
  return {
    rotationQuaternionX: Number(source.rotationQuaternionX ?? source.rotation_quaternion_x ?? 0),
    rotationQuaternionY: Number(source.rotationQuaternionY ?? source.rotation_quaternion_y ?? 0),
    rotationQuaternionZ: Number(source.rotationQuaternionZ ?? source.rotation_quaternion_z ?? 0),
    rotationQuaternionW: Number(source.rotationQuaternionW ?? source.rotation_quaternion_w ?? 0),
    positionAccelerationX: Number(source.positionAccelerationX ?? source.position_acceleration_x ?? 0),
    positionAccelerationY: Number(source.positionAccelerationY ?? source.position_acceleration_y ?? 0),
    positionAccelerationZ: Number(source.positionAccelerationZ ?? source.position_acceleration_z ?? 0),
    rotationVelocityX: Number(source.rotationVelocityX ?? source.rotation_velocity_x ?? 0),
    rotationVelocityY: Number(source.rotationVelocityY ?? source.rotation_velocity_y ?? 0),
    rotationVelocityZ: Number(source.rotationVelocityZ ?? source.rotation_velocity_z ?? 0)
  };
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

function normalizeLegacyNetworkingP2PSessionState(
  state: NativeLegacyNetworkingP2PSessionState | null | undefined
): LegacyNetworkingP2PSessionState | null {
  if (!state) {
    return null;
  }
  const source = state as unknown as Record<string, unknown>;
  return {
    connectionActive: Boolean(source.connectionActive ?? source.connection_active),
    connecting: Boolean(source.connecting),
    sessionError: Number(source.sessionError ?? source.session_error ?? 0),
    usingRelay: Boolean(source.usingRelay ?? source.using_relay),
    bytesQueuedForSend: Number(source.bytesQueuedForSend ?? source.bytes_queued_for_send ?? 0),
    packetsQueuedForSend: Number(source.packetsQueuedForSend ?? source.packets_queued_for_send ?? 0),
    remoteIp: Number(source.remoteIp ?? source.remote_ip ?? 0),
    remoteIpAddress: String(source.remoteIpAddress ?? source.remote_ip_address ?? ""),
    remotePort: Number(source.remotePort ?? source.remote_port ?? 0)
  };
}

function normalizeLegacyNetworkingSocketData(
  data: NativeLegacyNetworkingSocketData | null | undefined
): LegacyNetworkingSocketData | null {
  return data ? { data: data.data, size: Number(data.size) } : null;
}

function normalizeLegacyNetworkingListenSocketAvailable(
  available: NativeLegacyNetworkingListenSocketAvailable | null | undefined
): LegacyNetworkingListenSocketAvailable | null {
  return available ? { socket: Number(available.socket), size: Number(available.size) } : null;
}

function normalizeLegacyNetworkingListenSocketData(
  data: NativeLegacyNetworkingListenSocketData | null | undefined
): LegacyNetworkingListenSocketData | null {
  return data ? { socket: Number(data.socket), data: data.data, size: Number(data.size) } : null;
}

function normalizeLegacyNetworkingSocketInfo(
  info: NativeLegacyNetworkingSocketInfo | null | undefined
): LegacyNetworkingSocketInfo | null {
  if (!info) {
    return null;
  }
  const source = info as unknown as Record<string, unknown>;
  const remoteIp = source.remoteIp ?? source.remote_ip;
  const remoteIpAddress = source.remoteIpAddress ?? source.remote_ip_address;
  return {
    remoteSteamId: normalizeSteamId((source.remoteSteamId ?? source.remote_steam_id) as NativeSteamId),
    socketStatus: Number(source.socketStatus ?? source.socket_status ?? 0),
    remoteIp: remoteIp == null ? null : Number(remoteIp),
    remoteIpAddress: remoteIpAddress == null ? null : String(remoteIpAddress),
    remotePort: Number(source.remotePort ?? source.remote_port ?? 0)
  };
}

function normalizeLegacyNetworkingListenSocketInfo(
  info: NativeLegacyNetworkingListenSocketInfo | null | undefined
): LegacyNetworkingListenSocketInfo | null {
  if (!info) {
    return null;
  }
  const source = info as unknown as Record<string, unknown>;
  const ip = source.ip;
  const ipAddress = source.ipAddress ?? source.ip_address;
  return {
    ip: ip == null ? null : Number(ip),
    ipAddress: ipAddress == null ? null : String(ipAddress),
    port: Number(source.port ?? 0)
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

function nativeNetworkingConfigValue(option: NetworkingConfigOption): NativeNetworkingConfigValue {
  const output: NativeNetworkingConfigValue = {
    value: option.value
  };
  if (option.dataType !== undefined) {
    output.dataType = option.dataType;
  }
  if (option.int32Value !== undefined) {
    output.int32Value = option.int32Value;
  }
  if (option.int64Value !== undefined) {
    output.int64Value = option.int64Value === null ? null : BigInt(option.int64Value);
  }
  if (option.floatValue !== undefined) {
    output.floatValue = option.floatValue;
  }
  if (option.stringValue !== undefined) {
    output.stringValue = option.stringValue;
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

function normalizeNetworkingConfigValueResult(
  result: NativeNetworkingConfigValueResult
): NetworkingConfigValueResult {
  const source = result as unknown as Record<string, unknown>;
  const int32Value = source.int32Value ?? source.int32_value;
  const int64Value = source.int64Value ?? source.int64_value;
  const floatValue = source.floatValue ?? source.float_value;
  const stringValue = source.stringValue ?? source.string_value;
  const dataType = Number(source.dataType ?? source.data_type ?? 0);
  let value: number | bigint | string | null = null;
  if (int32Value !== undefined && int32Value !== null) {
    value = Number(int32Value);
  } else if (int64Value !== undefined && int64Value !== null) {
    value = normalizeBigIntLike(int64Value) as bigint;
  } else if (floatValue !== undefined && floatValue !== null) {
    value = Number(floatValue);
  } else if (stringValue !== undefined && stringValue !== null) {
    value = String(stringValue);
  }
  return {
    result: Number(result.result),
    dataType,
    value,
    int32Value: int32Value === undefined || int32Value === null ? null : Number(int32Value),
    int64Value: int64Value === undefined || int64Value === null ? null : (normalizeBigIntLike(int64Value) as bigint),
    floatValue: floatValue === undefined || floatValue === null ? null : Number(floatValue),
    stringValue: stringValue === undefined || stringValue === null ? null : String(stringValue)
  };
}

function normalizeNetworkingConfigValueInfo(info: NativeNetworkingConfigValueInfo): NetworkingConfigValueInfo {
  const source = info as unknown as Record<string, unknown>;
  return {
    value: Number(info.value),
    name: info.name ?? null,
    dataType: Number(source.dataType ?? source.data_type ?? 0),
    scope: Number(info.scope)
  };
}

function normalizeNetworkingDebugOutput(event: NativeNetworkingDebugOutput): NetworkingDebugOutput {
  const source = event as unknown as Record<string, unknown>;
  return {
    detailLevel: Number(source.detailLevel ?? source.detail_level ?? 0),
    message: String(event.message)
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

function normalizeNetworkingHostedDedicatedServerRouting(
  routing: NativeNetworkingHostedDedicatedServerRouting | null | undefined
): NetworkingHostedDedicatedServerRouting | null {
  if (!routing) {
    return null;
  }
  const source = routing as unknown as Record<string, unknown>;
  return {
    popId: Number(source.popId ?? source.pop_id ?? 0),
    size: Number(source.size ?? 0),
    data: routing.data
  };
}

function normalizeNetworkingHostedDedicatedServerAddressResult(
  result: NativeNetworkingHostedDedicatedServerAddressResult
): NetworkingHostedDedicatedServerAddressResult {
  const source = result as unknown as Record<string, unknown>;
  return {
    result: Number(result.result ?? 0),
    routing: normalizeNetworkingHostedDedicatedServerRouting(result.routing),
    debugMessage: String(source.debugMessage ?? source.debug_message ?? "")
  };
}

function normalizeNetworkingGameCoordinatorServerLoginResult(
  result: NativeNetworkingGameCoordinatorServerLoginResult
): NetworkingGameCoordinatorServerLoginResult {
  const source = result as unknown as Record<string, unknown>;
  return {
    result: Number(result.result ?? 0),
    identity: normalizeNetworkingIdentityInfo(result.identity),
    routing: normalizeNetworkingHostedDedicatedServerRouting(result.routing),
    appId: Number(source.appId ?? source.app_id ?? 0),
    timestamp: Number(result.timestamp ?? 0),
    appData: ((source.appData ?? source.app_data) as Buffer | undefined) ?? Buffer.alloc(0),
    signedBlob: ((source.signedBlob ?? source.signed_blob) as Buffer | undefined) ?? Buffer.alloc(0),
    debugMessage: String(source.debugMessage ?? source.debug_message ?? "")
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

function nativeNetworkingSocketOutgoingMessage(
  message: NetworkingSocketOutgoingMessage
): NativeNetworkingSocketOutgoingMessage {
  return {
    connection: message.connection,
    data: Buffer.from(message.data),
    sendFlags: message.sendFlags
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

function normalizeNetworkingRealTimeLaneStatus(
  status: NativeNetworkingConnectionRealTimeLaneStatus
): NetworkingConnectionRealTimeLaneStatus {
  const source = status as unknown as Record<string, unknown>;
  return {
    pendingUnreliable: Number(source.pendingUnreliable ?? source.pending_unreliable ?? 0),
    pendingReliable: Number(source.pendingReliable ?? source.pending_reliable ?? 0),
    sentUnackedReliable: Number(source.sentUnackedReliable ?? source.sent_unacked_reliable ?? 0),
    queueTime: BigInt((source.queueTime ?? source.queue_time ?? 0) as bigint | number | string)
  };
}

function normalizeNetworkingRealTimeStatusWithLanes(
  result: NativeNetworkingConnectionRealTimeStatusWithLanes | null | undefined
): NetworkingConnectionRealTimeStatusWithLanes | null {
  if (!result) {
    return null;
  }
  const status = normalizeNetworkingRealTimeStatus(result.status);
  if (!status) {
    throw new Error("Steam networking real-time status is missing");
  }
  return {
    status,
    lanes: result.lanes.map(normalizeNetworkingRealTimeLaneStatus)
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

function itemIdFromSource(source: Record<string, unknown>, camel = "itemId", snake = "item_id"): bigint {
  return BigInt((source[camel] ?? source[snake] ?? 0) as bigint | number | string);
}

function normalizeWorkshopFavoriteResult(result: NativeWorkshopFavoriteResult): WorkshopFavoriteResult {
  const source = result as unknown as Record<string, unknown>;
  return {
    result: Number(source.result ?? 0),
    itemId: itemIdFromSource(source),
    wasAddRequest: Boolean(source.wasAddRequest ?? source.was_add_request)
  };
}

function normalizeWorkshopSetUserItemVoteResult(
  result: NativeWorkshopSetUserItemVoteResult
): WorkshopSetUserItemVoteResult {
  const source = result as unknown as Record<string, unknown>;
  return {
    result: Number(source.result ?? 0),
    itemId: itemIdFromSource(source),
    voteUp: Boolean(source.voteUp ?? source.vote_up)
  };
}

function normalizeWorkshopGetUserItemVoteResult(
  result: NativeWorkshopGetUserItemVoteResult
): WorkshopGetUserItemVoteResult {
  const source = result as unknown as Record<string, unknown>;
  return {
    result: Number(source.result ?? 0),
    itemId: itemIdFromSource(source),
    votedUp: Boolean(source.votedUp ?? source.voted_up),
    votedDown: Boolean(source.votedDown ?? source.voted_down),
    voteSkipped: Boolean(source.voteSkipped ?? source.vote_skipped)
  };
}

function normalizeWorkshopSimpleResult(result: NativeWorkshopSimpleResult): WorkshopSimpleResult {
  return { result: Number(result.result ?? 0) };
}

function normalizeWorkshopDependencyResult(result: NativeWorkshopDependencyResult): WorkshopDependencyResult {
  const source = result as unknown as Record<string, unknown>;
  return {
    result: Number(source.result ?? 0),
    itemId: itemIdFromSource(source),
    childItemId: itemIdFromSource(source, "childItemId", "child_item_id")
  };
}

function normalizeWorkshopAppDependencyResult(
  result: NativeWorkshopAppDependencyResult
): WorkshopAppDependencyResult {
  const source = result as unknown as Record<string, unknown>;
  return {
    result: Number(source.result ?? 0),
    itemId: itemIdFromSource(source),
    appId: Number(source.appId ?? source.app_id ?? 0)
  };
}

function normalizeWorkshopAppDependenciesResult(
  result: NativeWorkshopAppDependenciesResult
): WorkshopAppDependenciesResult {
  const source = result as unknown as Record<string, unknown>;
  const appIds = (source.appIds ?? source.app_ids ?? []) as number[];
  return {
    result: Number(source.result ?? 0),
    itemId: itemIdFromSource(source),
    appIds: appIds.map(Number),
    numAppDependencies: Number(source.numAppDependencies ?? source.num_app_dependencies ?? appIds.length),
    totalNumAppDependencies: Number(source.totalNumAppDependencies ?? source.total_num_app_dependencies ?? appIds.length)
  };
}

function normalizeWorkshopDeleteItemResult(result: NativeWorkshopDeleteItemResult): WorkshopDeleteItemResult {
  const source = result as unknown as Record<string, unknown>;
  return {
    result: Number(source.result ?? 0),
    itemId: itemIdFromSource(source)
  };
}

function normalizeWorkshopEulaStatus(result: NativeWorkshopEulaStatus): WorkshopEulaStatus {
  const source = result as unknown as Record<string, unknown>;
  return {
    result: Number(source.result ?? 0),
    appId: Number(source.appId ?? source.app_id ?? 0),
    version: Number(source.version ?? 0),
    actionTime: Number(source.actionTime ?? source.action_time ?? 0),
    accepted: Boolean(source.accepted),
    needsAction: Boolean(source.needsAction ?? source.needs_action)
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
    wasCached: Boolean(result.wasCached ?? result.was_cached),
    nextCursor: String(result.nextCursor ?? result.next_cursor ?? "")
  };
}

function normalizeWorkshopItemDetailsResult(result: unknown): WorkshopItemDetailsResult {
  const source = (result && typeof result === "object" ? result : {}) as Record<string, unknown>;
  const details = source.details && typeof source.details === "object"
    ? normalizeUgcDetailsPayload(source.details as Record<string, unknown>)
    : {};
  return {
    details,
    wasCached: Boolean(source.wasCached ?? source.was_cached)
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
  const stringPairs = (camel: string, snake: string): WorkshopItemKeyValueTag[] =>
    ((source[camel] ?? source[snake] ?? []) as Array<Record<string, unknown>>).map((tag) => ({
      key: String(tag.key ?? ""),
      value: String(tag.value ?? "")
    }));
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
    tagDetails: ((source.tagDetails ?? source.tag_details ?? []) as Array<Record<string, unknown>>).map((tag) => ({
      name: String(tag.name ?? ""),
      displayName: (tag.displayName ?? tag.display_name) == null ? undefined : String(tag.displayName ?? tag.display_name)
    })),
    tagsTruncated: value("tagsTruncated", "tags_truncated", false),
    metadata: value("metadata", "metadata", undefined as string | undefined),
    children: ((source.children ?? []) as Array<bigint | number | string>).map(BigInt),
    additionalPreviews: ((source.additionalPreviews ?? source.additional_previews ?? []) as Array<Record<string, unknown>>).map(
      (preview) => ({
        urlOrVideoId: String(preview.urlOrVideoId ?? preview.url_or_video_id ?? ""),
        originalFileName: String(preview.originalFileName ?? preview.original_file_name ?? ""),
        previewType: Number(preview.previewType ?? preview.preview_type ?? 0)
      })
    ),
    keyValueTags: stringPairs("keyValueTags", "key_value_tags"),
    firstKeyValueTags: stringPairs("firstKeyValueTags", "first_key_value_tags"),
    supportedGameVersions: ((source.supportedGameVersions ?? source.supported_game_versions ?? []) as Array<
      Record<string, unknown>
    >).map((version) => ({
      gameBranchMin: String(version.gameBranchMin ?? version.game_branch_min ?? ""),
      gameBranchMax: String(version.gameBranchMax ?? version.game_branch_max ?? "")
    })),
    contentDescriptors: ((source.contentDescriptors ?? source.content_descriptors ?? []) as number[]).map(Number),
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
  client,
  cloud,
  friends,
  gameServer,
  gameServerHttp,
  gameServerInventory,
  gameServerNetworking,
  gameServerNetworkingMessages,
  gameServerNetworkingSockets,
  gameServerStats,
  gameServerWorkshop,
  html,
  http,
  inventory,
  input,
  localplayer,
  matchmaking,
  matchmakingServers,
  networking,
  overlay,
  music,
  parties,
  parental,
  remotePlay,
  screenshots,
  stats,
  timeline,
  user,
  utils,
  video,
  workshop,
  electronConfigureSteamOverlay,
  electronEnableSteamOverlay,
  SteamCallback
};

export default defaultExport;
