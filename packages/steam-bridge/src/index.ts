import {
  electronConfigureSteamOverlay as electronConfigureSteamOverlayImpl,
  electronEnableSteamOverlay as electronEnableSteamOverlayImpl,
  electronNativeOverlaySessionOptions as electronNativeOverlaySessionOptionsImpl,
  electronOverlayPresenterOptions as electronOverlayPresenterOptionsImpl,
  electronScrubSteamOverlayChildProcessEnv as electronScrubSteamOverlayChildProcessEnvImpl
} from "./electron";
import { SteamworksEnums } from "./generated-steamworks-enums";
import type {
  SteamworksEnumName,
  SteamworksEnumValue,
  SteamworksEnumValueName
} from "./generated-steamworks-enums";
import {
  loadNativeBinding,
  NativeAppBetaCounts,
  NativeAppBetaInfo,
  NativeAppDlcData,
  NativeAppDlcDownloadProgress,
  NativeAppFileDetails,
  NativeAppOwnershipTicketData,
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
  NativeGameServerInterfaceInitOptions,
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
  NativeInputActionEvent,
  NativeInputControllerInfo,
  NativeInputDeviceBindingRevision,
  NativeInputDigitalActionData,
  NativeInputMotionData,
  NativeIsFollowingResult,
  NativeAchievementProgressLimitsFloat,
  NativeAchievementProgressLimitsInt,
  NativeAchievementUnlockTime,
  NativeGameCoordinatorMessage,
  NativeGameCoordinatorMessageAvailable,
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
  NativeMatchmakingServerAddress,
  NativeMatchmakingServerItem,
  NativeMatchmakingServerListResponseCallbackState,
  NativeMatchmakingServerListResult,
  NativeMatchmakingServerListRequest,
  NativeMatchmakingServerListRequestState,
  NativeMatchmakingServerPingResult,
  NativeMatchmakingServerPlayer,
  NativeMatchmakingServerPlayersResult,
  NativeMatchmakingServerResponseCallbackSnapshot,
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
  NativeMacOverlayEnvironment,
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
  NativeUtilsCserIpPort,
  NativeUtilsFilteredText,
  NativeUtilsImageSize,
  NativeUtilsWarningMessage,
  NativeUserStatsReceivedResult,
  NativeVideoBroadcastStatus,
  NativeWorkshopItem,
  NativeWorkshopItemsResult
} from "./native";

export { SteamworksEnums };
export type { SteamworksEnumName, SteamworksEnumValue, SteamworksEnumValueName };

export interface InitOptions {
  appId: number;
  callbackIntervalMs?: number;
}

export interface BreakpadCrashHandlerOptions {
  version?: string;
  date?: string;
  time?: string;
  fullMemoryDumps?: boolean;
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

export interface AppOwnershipTicketData {
  ticket: Buffer;
  bytesWritten: number;
  appIdOffset: number;
  steamIdOffset: number;
  signatureOffset: number;
  signatureLength: number;
}

export interface GameServerInitOptions {
  ip?: number;
  gamePort: number;
  queryPort: number;
  serverMode?: number;
  version: string;
}

export interface GameServerInterfaceInitOptions {
  ip?: number;
  gamePort: number;
  queryPort: number;
  flags: number;
  appId: number;
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

export interface GameServerServersConnectedEvent {
  [key: string]: unknown;
}

export interface GameServerConnectFailureEvent {
  reason: number;
  stillRetrying: boolean;
  still_retrying?: boolean;
  [key: string]: unknown;
}

export interface GameServerServersDisconnectedEvent {
  reason: number;
  [key: string]: unknown;
}

export interface GameServerClientApproveEvent {
  steamId: bigint;
  steam_id?: bigint;
  ownerSteamId: bigint;
  owner_steam_id?: bigint;
  [key: string]: unknown;
}

export interface GameServerClientDenyEvent {
  steamId: bigint;
  steam_id?: bigint;
  denyReason: number;
  deny_reason?: number;
  optionalText: string;
  optional_text?: string;
  [key: string]: unknown;
}

export interface GameServerClientKickEvent {
  steamId: bigint;
  steam_id?: bigint;
  denyReason: number;
  deny_reason?: number;
  [key: string]: unknown;
}

export interface GameServerClientAchievementStatusEvent {
  steamId: bigint;
  steam_id?: bigint;
  achievement: string;
  unlocked: boolean;
  [key: string]: unknown;
}

export interface GameServerPolicyResponseEvent {
  secure: boolean;
  [key: string]: unknown;
}

export interface GameServerGameplayStatsEvent {
  result: number;
  rank: number;
  totalConnects: number;
  total_connects?: number;
  totalMinutesPlayed: number;
  total_minutes_played?: number;
  [key: string]: unknown;
}

export interface GameServerClientGroupStatusEvent {
  steamId: bigint;
  steam_id?: bigint;
  groupId: bigint;
  group_id?: bigint;
  member: boolean;
  officer: boolean;
  [key: string]: unknown;
}

export interface GameServerReputationEvent {
  result: number;
  reputationScore: number;
  reputation_score?: number;
  banned: boolean;
  bannedIp: number;
  banned_ip?: number;
  bannedIpAddress: string;
  banned_ip_address?: string;
  bannedPort: number;
  banned_port?: number;
  bannedGameId: bigint;
  banned_game_id?: bigint;
  banExpires: number;
  ban_expires?: number;
  [key: string]: unknown;
}

export interface GameServerAssociateWithClanEvent {
  result: number;
  [key: string]: unknown;
}

export interface GameServerPlayerCompatibilityEvent {
  result: number;
  playersThatDontLikeCandidate: number;
  players_that_dont_like_candidate?: number;
  playersThatCandidateDoesntLike: number;
  players_that_candidate_doesnt_like?: number;
  clanPlayersThatDontLikeCandidate: number;
  clan_players_that_dont_like_candidate?: number;
  candidateSteamId: bigint;
  candidate_steam_id?: bigint;
  [key: string]: unknown;
}

export interface GameServerStatsReceivedEvent {
  result: number;
  steamId: bigint;
  steam_id?: bigint;
  [key: string]: unknown;
}

export interface GameServerStatsStoredEvent extends GameServerStatsReceivedEvent {}

export interface GameServerStatsUnloadedEvent {
  steamId: bigint;
  steam_id?: bigint;
  [key: string]: unknown;
}

export interface CallbackHandle {
  disconnect(): void;
}

export interface SteamClientLocalUser {
  user: number;
  pipe: number;
}

export interface SteamClientCallbackRegistrationCheck {
  callbackId: number;
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

export interface SteamServersConnectedEvent {
  [key: string]: unknown;
}

export interface SteamServerConnectFailureEvent {
  reason: number;
  stillRetrying: boolean;
  still_retrying?: boolean;
  [key: string]: unknown;
}

export interface SteamServersDisconnectedEvent {
  reason: number;
  [key: string]: unknown;
}

export interface FriendGameInfo {
  gameId: bigint;
  gameIp: number;
  gamePort: number;
  queryPort: number;
  lobby: bigint;
}

export interface FriendsPersonaStateChangeEvent {
  steamId: bigint;
  steam_id?: bigint;
  flags: unknown;
  [key: string]: unknown;
}

export interface FriendsGameServerChangeRequestedEvent {
  server: string;
  password: string;
  [key: string]: unknown;
}

export interface FriendsGameLobbyJoinRequestedEvent {
  lobbySteamId: bigint;
  lobby_steam_id?: bigint;
  friendSteamId: bigint;
  friend_steam_id?: bigint;
  [key: string]: unknown;
}

export interface FriendsAvatarImageLoadedEvent {
  steamId: bigint;
  steam_id?: bigint;
  image: number;
  wide: number;
  tall: number;
  [key: string]: unknown;
}

export interface FriendsClanOfficerListResponseEvent {
  clan: bigint;
  officerCount: number;
  officer_count?: number;
  success: boolean;
  [key: string]: unknown;
}

export interface FriendsRichPresenceUpdateEvent {
  friend: bigint;
  appId: number;
  app_id?: number;
  [key: string]: unknown;
}

export interface FriendsGameRichPresenceJoinRequestedEvent {
  friend: bigint;
  connect: string;
  [key: string]: unknown;
}

export interface FriendsGameConnectedClanChatMessageEvent {
  clanChat: bigint;
  clan_chat?: bigint;
  user: bigint;
  messageId: number;
  message_id?: number;
  [key: string]: unknown;
}

export interface FriendsGameConnectedChatJoinEvent {
  clanChat: bigint;
  clan_chat?: bigint;
  user: bigint;
  [key: string]: unknown;
}

export interface FriendsGameConnectedChatLeaveEvent extends FriendsGameConnectedChatJoinEvent {
  kicked: boolean;
  dropped: boolean;
}

export interface FriendsDownloadClanActivityCountsResultEvent {
  success: boolean;
  [key: string]: unknown;
}

export interface FriendsJoinClanChatRoomCompletionResultEvent {
  clanChat: bigint;
  clan_chat?: bigint;
  chatRoomEnterResponse: number;
  chat_room_enter_response?: number;
  [key: string]: unknown;
}

export interface FriendsGameConnectedFriendChatMessageEvent {
  user: bigint;
  messageId: number;
  message_id?: number;
  [key: string]: unknown;
}

export interface FriendsGetFollowerCountEvent {
  result: number;
  steamId: bigint;
  steam_id?: bigint;
  count: number;
  [key: string]: unknown;
}

export interface FriendsIsFollowingEvent {
  result: number;
  steamId: bigint;
  steam_id?: bigint;
  isFollowing: boolean;
  is_following?: boolean;
  [key: string]: unknown;
}

export interface FriendsEnumerateFollowingListEvent {
  result: number;
  steamIds: bigint[];
  steam_ids?: bigint[];
  resultsReturned: number;
  results_returned?: number;
  totalResultCount: number;
  total_result_count?: number;
  [key: string]: unknown;
}

export interface FriendsUnreadChatMessagesChangedEvent {
  [key: string]: unknown;
}

export interface FriendsOverlayBrowserProtocolNavigationEvent {
  uri: string;
  [key: string]: unknown;
}

export interface FriendsEquippedProfileItemsChangedEvent {
  steamId: bigint;
  steam_id?: bigint;
  [key: string]: unknown;
}

export interface FriendsEquippedProfileItemsEvent {
  result: number;
  steamId: bigint;
  steam_id?: bigint;
  hasAnimatedAvatar: boolean;
  has_animated_avatar?: boolean;
  hasAvatarFrame: boolean;
  has_avatar_frame?: boolean;
  hasProfileModifier: boolean;
  has_profile_modifier?: boolean;
  hasProfileBackground: boolean;
  has_profile_background?: boolean;
  hasMiniProfileBackground: boolean;
  has_mini_profile_background?: boolean;
  fromCache: boolean;
  from_cache?: boolean;
  [key: string]: unknown;
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

export interface CloudFileShareResultEvent {
  result: number;
  file: bigint;
  name: string;
  [key: string]: unknown;
}

export interface CloudPublishedFileResultEvent {
  result: number;
  publishedFileId: bigint;
  published_file_id?: bigint;
  needsToAcceptAgreement: boolean;
  needs_to_accept_agreement?: boolean;
  [key: string]: unknown;
}

export interface CloudPublishedFileIdResultEvent {
  result: number;
  publishedFileId: bigint;
  published_file_id?: bigint;
  [key: string]: unknown;
}

export interface CloudEnumerateFilesResultEvent {
  result: number;
  returnedResults: number;
  returned_results?: number;
  totalResultCount: number;
  total_result_count?: number;
  publishedFileIds: bigint[];
  published_file_ids?: bigint[];
  [key: string]: unknown;
}

export interface CloudEnumerateSubscribedFilesResultEvent extends CloudEnumerateFilesResultEvent {
  subscribedTimes: number[];
  subscribed_times?: number[];
}

export interface CloudEnumerateWorkshopFilesResultEvent extends CloudEnumerateFilesResultEvent {
  scores: number[];
  appId: number;
  app_id?: number;
  startIndex: number;
  start_index?: number;
}

export interface CloudEnumerateUserActionFilesResultEvent extends CloudEnumerateFilesResultEvent {
  action: number;
  updatedTimes: number[];
  updated_times?: number[];
}

export interface CloudUgcDownloadResultEvent {
  result: number;
  file: bigint;
  appId: number;
  app_id?: number;
  size: bigint;
  name: string;
  owner: bigint;
  [key: string]: unknown;
}

export interface CloudPublishedFileDetailsResultEvent extends CloudPublishedFileIdResultEvent {
  creatorAppId: number;
  creator_app_id?: number;
  consumerAppId: number;
  consumer_app_id?: number;
  title: string;
  description: string;
  file: bigint;
  previewFile: bigint;
  preview_file?: bigint;
  owner: bigint;
  timeCreated: number;
  time_created?: number;
  timeUpdated: number;
  time_updated?: number;
  visibility: number;
  banned: boolean;
  tags: string[];
  tagsTruncated: boolean;
  tags_truncated?: boolean;
  fileName: string;
  file_name?: string;
  fileSize: bigint;
  file_size?: bigint;
  previewFileSize: bigint;
  preview_file_size?: bigint;
  url: string;
  fileType: number;
  file_type?: number;
  acceptedForUse: boolean;
  accepted_for_use?: boolean;
}

export interface CloudPublishedItemVoteDetailsEvent extends CloudPublishedFileIdResultEvent {
  votesFor: number;
  votes_for?: number;
  votesAgainst: number;
  votes_against?: number;
  reports: number;
  score: number;
}

export interface CloudUserVoteDetailsEvent extends CloudPublishedFileIdResultEvent {
  vote: number;
}

export interface CloudPublishedFileAppEvent {
  publishedFileId: bigint;
  published_file_id?: bigint;
  appId: number;
  app_id?: number;
  [key: string]: unknown;
}

export interface CloudPublishedFileActionResultEvent extends CloudPublishedFileIdResultEvent {
  action: number;
}

export interface CloudPublishFileProgressEvent {
  percentFile: number;
  percent_file?: number;
  preview: boolean;
  [key: string]: unknown;
}

export interface CloudPublishedFileUpdatedEvent extends CloudPublishedFileAppEvent {
  unused: bigint;
}

export interface CloudFileWriteAsyncCompleteEvent {
  result: number;
  [key: string]: unknown;
}

export interface CloudFileReadAsyncCompleteEvent {
  asyncCall: bigint;
  async_call?: bigint;
  result: number;
  offset: number;
  bytesRead: number;
  bytes_read?: number;
  [key: string]: unknown;
}

export interface CloudLocalFileChangeEvent {
  [key: string]: unknown;
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

export interface HttpRequestCompletedEvent extends HttpRequestCompleted {
  context_value?: bigint;
  request_successful?: boolean;
  status_code?: number;
  body_size?: number;
  [key: string]: unknown;
}

export interface HttpRequestHeadersReceivedEvent extends HttpRequestHeadersReceived {
  context_value?: bigint;
  [key: string]: unknown;
}

export interface HttpRequestDataReceivedEvent {
  request: number;
  contextValue: bigint;
  context_value?: bigint;
  offset: number;
  bytesReceived: number;
  bytes_received?: number;
  [key: string]: unknown;
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

export interface PartyJoinPartyEvent {
  result: number;
  beacon: bigint;
  owner: bigint;
  connectString: string;
  connect_string?: string;
  [key: string]: unknown;
}

export interface PartyCreateBeaconEvent {
  result: number;
  beacon: bigint;
  [key: string]: unknown;
}

export interface PartyReservationNotificationEvent {
  beacon: bigint;
  joiner: bigint;
  [key: string]: unknown;
}

export interface PartyChangeNumOpenSlotsEvent {
  result: number;
  [key: string]: unknown;
}

export interface PartyBeaconLocationsUpdatedEvent {
  [key: string]: unknown;
}

export interface PartyActiveBeaconsUpdatedEvent {
  [key: string]: unknown;
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

export interface MatchmakingFavoritesListChangedEvent {
  ip: number;
  ipAddress: string;
  ip_address?: string;
  queryPort: number;
  query_port?: number;
  connPort: number;
  conn_port?: number;
  appId: number;
  app_id?: number;
  flags: number;
  add: boolean;
  accountId: number;
  account_id?: number;
  [key: string]: unknown;
}

export interface MatchmakingFavoritesListAccountsUpdatedEvent {
  result: number;
  [key: string]: unknown;
}

export interface LobbyInviteEvent {
  user: bigint;
  lobby: bigint;
  gameId: bigint;
  game_id?: bigint;
  [key: string]: unknown;
}

export interface LobbyEnterEvent {
  lobby: bigint;
  chatPermissions: number;
  chat_permissions?: number;
  locked: boolean;
  chatRoomEnterResponse: number;
  chat_room_enter_response?: number;
  [key: string]: unknown;
}

export interface LobbyDataUpdateEvent {
  lobby: bigint;
  member: bigint;
  success: boolean;
  [key: string]: unknown;
}

export interface LobbyChatUpdateEvent {
  lobby: bigint;
  userChanged: bigint;
  user_changed?: bigint;
  makingChange: bigint;
  making_change?: bigint;
  memberStateChange: number;
  member_state_change?: number;
  [key: string]: unknown;
}

export interface LobbyChatMessageEvent {
  lobby: bigint;
  user: bigint;
  entryType: number;
  entry_type?: number;
  chatId: number;
  chat_id?: number;
  [key: string]: unknown;
}

export interface LobbyGameCreatedEvent {
  lobby: bigint;
  gameServer: bigint;
  game_server?: bigint;
  ip: number;
  ipAddress: string;
  ip_address?: string;
  port: number;
  [key: string]: unknown;
}

export interface LobbyMatchListEvent {
  lobbiesMatching: number;
  lobbies_matching?: number;
  [key: string]: unknown;
}

export interface LobbyKickedEvent {
  lobby: bigint;
  admin: bigint;
  kickedDueToDisconnect: boolean;
  kicked_due_to_disconnect?: boolean;
  [key: string]: unknown;
}

export interface LobbyCreatedEvent {
  result: number;
  lobby: bigint;
  [key: string]: unknown;
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
  connectionAddress: string;
  queryAddress: string;
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

export interface MatchmakingServerListResponseCallbackState {
  request: bigint;
  completed: boolean;
  cancelled: boolean;
  response: number;
  responded: number[];
  failed: number[];
}

export interface MatchmakingServerResponseCallbackSnapshot {
  serverList: MatchmakingServerListResponseCallbackState;
  pingSuccess: MatchmakingServerPingResult;
  pingFailure: MatchmakingServerPingResult;
  playersSuccess: MatchmakingServerPlayersResult;
  playersFailure: MatchmakingServerPlayersResult;
  rulesSuccess: MatchmakingServerRulesResult;
  rulesFailure: MatchmakingServerRulesResult;
}

export interface MatchmakingServerResponseCallbackSnapshotOptions {
  request?: bigint | number | string;
  respondedServer?: number;
  failedServer?: number;
  response?: number;
  playerName?: string;
  playerScore?: number;
  playerTimePlayed?: number;
  ruleName?: string;
  ruleValue?: string;
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

export interface AppDlcInstalledEvent {
  appId: number;
  app_id?: number;
  [key: string]: unknown;
}

export interface AppNewUrlLaunchParametersEvent {
  [key: string]: unknown;
}

export interface AppProofOfPurchaseKeyResponseEvent {
  result: number;
  appId: number;
  app_id?: number;
  keyLength: number;
  key_length?: number;
  key: string;
  [key: string]: unknown;
}

export interface AppFileDetailsResultEvent {
  result: number;
  fileSize: bigint;
  file_size?: bigint;
  shaHex: string;
  sha_hex?: string;
  flags: number;
  [key: string]: unknown;
}

export interface AppTimedTrialStatusEvent {
  appId: number;
  app_id?: number;
  isOffline: boolean;
  is_offline?: boolean;
  secondsAllowed: number;
  seconds_allowed?: number;
  secondsPlayed: number;
  seconds_played?: number;
  [key: string]: unknown;
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

export interface InventoryResultReadyEvent {
  handle: number;
  result: number;
  [key: string]: unknown;
}

export interface InventoryFullUpdateEvent {
  handle: number;
  [key: string]: unknown;
}

export interface InventoryDefinitionUpdateEvent {
  [key: string]: unknown;
}

export interface InventoryEligiblePromoItemDefIdsEvent {
  result: number;
  steamId: bigint;
  steam_id?: bigint;
  numEligiblePromoItemDefs: number;
  num_eligible_promo_item_defs?: number;
  cachedData: boolean;
  cached_data?: boolean;
  [key: string]: unknown;
}

export interface InventoryStartPurchaseResultEvent {
  result: number;
  orderId: bigint;
  order_id?: bigint | number | string;
  transactionId: bigint;
  transaction_id?: bigint | number | string;
  [key: string]: unknown;
}

export interface InventoryRequestPricesResultEvent {
  result: number;
  currency: string;
  [key: string]: unknown;
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
  overlayNeedsPresentPollingEnabled: boolean;
  steamDeck: boolean;
  bigPicture: boolean;
  platform: NodeJS.Platform;
  arch: string;
  pid: number;
}

export interface MacOverlayEnvironment {
  screenLocked: boolean;
  displayAsleep: boolean;
}

export type NativeOverlayHostUnavailableReason = "macos-screen-locked" | "macos-display-asleep";

export interface OverlayWebPageOptions {
  modal?: boolean;
}

export interface NativeOverlaySessionOptions {
  title?: string;
  pumpIntervalMs?: number;
  nativeWindowHandle?: Buffer;
  getBounds?: NativeOverlayBoundsProvider;
  restoreFocus?: () => void;
  restoreFocusDelayMs?: number;
  hideNativeHostOnOverlayDeactivate?: boolean;
}

export type NativeOverlayWebPageSessionOptions = NativeOverlaySessionOptions & OverlayWebPageOptions;

export type NativeOverlayBackend = "x11-glx" | "macos-metal" | "macos-opengl" | "none";

export interface NativeOverlayBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export type NativeOverlayBoundsProvider = () => NativeOverlayBounds | undefined;

export interface NativeOverlaySessionSnapshot {
  title: string;
  backend: NativeOverlayBackend;
  bounds?: NativeOverlayBounds;
  closed: boolean;
  startedAt: number;
  pumpCount: number;
  overlayActive: boolean;
  overlayWasActive: boolean;
  lastOverlayEvent?: GameOverlayActivated;
  nativeProbeOpen: boolean;
  nativeHostOpen: boolean;
  nativeHostUnavailableReason?: NativeOverlayHostUnavailableReason;
  macOverlayEnvironment?: MacOverlayEnvironment;
  lastPumpAt?: number;
  lastError?: unknown;
  diagnostics?: OverlayDiagnostics;
}

export interface NativeOverlaySession extends CallbackHandle {
  close(): void;
  pump(): void;
  isOpen(): boolean;
  snapshot(): NativeOverlaySessionSnapshot;
}

export type NativeOverlayPresenterMode = "passive" | "active" | "hidden" | "closed";

export interface NativeOverlayPresenterOptions {
  title?: string;
  nativeWindowHandle?: Buffer;
  getBounds?: NativeOverlayBoundsProvider;
  restoreFocus?: () => void;
  restoreFocusDelayMs?: number;
  idleFps?: number;
  needsPresentFps?: number;
  activeOverlayFps?: number;
  pollIntervalMs?: number;
  activationBoostMs?: number;
  activeGraceMs?: number;
}

export interface NativeOverlayPresenterSnapshot {
  title: string;
  backend: NativeOverlayBackend;
  bounds?: NativeOverlayBounds;
  closed: boolean;
  startedAt: number;
  mode: NativeOverlayPresenterMode;
  attached: boolean;
  nativeProbeOpen: boolean;
  nativeHostOpen: boolean;
  nativeHostUnavailableReason?: NativeOverlayHostUnavailableReason;
  macOverlayEnvironment?: MacOverlayEnvironment;
  clickThrough: boolean;
  focusable: boolean;
  transparent: boolean;
  idleFps: number;
  needsPresentFps: number;
  activeOverlayFps: number;
  pollIntervalMs: number;
  currentFps: number;
  pumpCount: number;
  pollCount: number;
  overlayActive: boolean;
  overlayWasActive: boolean;
  overlayNeedsPresent: boolean;
  overlayNeedsPresentPollingEnabled: boolean;
  lastOverlayEvent?: GameOverlayActivated;
  lastPumpAt?: number;
  lastPollAt?: number;
  lastError?: unknown;
  diagnostics?: OverlayDiagnostics;
}

export interface NativeOverlayPresenter extends CallbackHandle {
  close(): void;
  pump(): void;
  prepareForOverlay(durationMs?: number): void;
  prepareForPassiveOverlay(durationMs?: number): void;
  show(): void;
  hide(): void;
  isOpen(): boolean;
  snapshot(): NativeOverlayPresenterSnapshot;
}

export type NativeOverlayPresenterOverlayOptions = NativeOverlayPresenterOptions & {
  presenter?: NativeOverlayPresenter;
};

export type NativeOverlayWebPagePresenterOptions = NativeOverlayPresenterOverlayOptions & OverlayWebPageOptions;

export type NativeOverlayAppPagePresenterOptions = NativeOverlayWebPagePresenterOptions & {
  appId?: number;
  steamId64?: bigint | number | string;
};

export type SteamOverlayStoreRoute = "web" | "native";

export type NativeOverlayStorePresenterOptions = NativeOverlayWebPagePresenterOptions & {
  route?: SteamOverlayStoreRoute;
};

export type SteamOverlayWebTarget = NativeOverlayWebPagePresenterOptions & {
  type: "web";
  url: string;
};

export type SteamOverlayStoreTarget = NativeOverlayStorePresenterOptions & {
  type: "store";
  appId?: number;
  flag?: number;
};

export type SteamOverlayFriendsTarget = NativeOverlayWebPagePresenterOptions & {
  type: "friends";
};

export type NativeOverlayProfilePresenterOptions = NativeOverlayWebPagePresenterOptions & {
  steamId64?: bigint | number | string;
};

export type SteamOverlayProfileTarget = NativeOverlayProfilePresenterOptions & {
  type: "profile";
};

export type NativeOverlayPlayersPresenterOptions = NativeOverlayWebPagePresenterOptions & {
  steamId64?: bigint | number | string;
};

export type SteamOverlayPlayersTarget = NativeOverlayPlayersPresenterOptions & {
  type: "players";
};

export type SteamOverlayCommunityTarget = NativeOverlayAppPagePresenterOptions & {
  type: "community";
};

export type SteamOverlayStatsTarget = NativeOverlayAppPagePresenterOptions & {
  type: "stats";
};

export type SteamOverlayAchievementsTarget = NativeOverlayAppPagePresenterOptions & {
  type: "achievements";
};

export type SteamOverlayUserDialogRoute = "auto" | "native";

export type NativeOverlayUserDialogPresenterOptions = NativeOverlayAppPagePresenterOptions & {
  dialog?: string;
  steamId64?: bigint | number | string;
  route?: SteamOverlayUserDialogRoute;
};

export type SteamOverlayUserTarget = NativeOverlayUserDialogPresenterOptions & {
  type: "user";
};

export interface SteamOverlayCheckoutUrlOptions {
  returnUrl?: string;
}

export type SteamOverlayCheckoutTarget = NativeOverlayWebPagePresenterOptions &
  SteamOverlayCheckoutUrlOptions & {
    type: "checkout";
    url?: string;
    steamUrl?: string;
    transactionId?: bigint | number | string;
  };

export type SteamOverlayDialogRoute = "auto" | "native";

export type SteamOverlayDialogTarget = NativeOverlayAppPagePresenterOptions & {
  type: "dialog";
  dialog?: number | string;
  route?: SteamOverlayDialogRoute;
};

export type SteamOverlayTarget =
  | SteamOverlayWebTarget
  | SteamOverlayStoreTarget
  | SteamOverlayFriendsTarget
  | SteamOverlayProfileTarget
  | SteamOverlayPlayersTarget
  | SteamOverlayCommunityTarget
  | SteamOverlayStatsTarget
  | SteamOverlayAchievementsTarget
  | SteamOverlayUserTarget
  | SteamOverlayCheckoutTarget
  | SteamOverlayDialogTarget;

export interface ElectronOverlayKeyboardInput {
  type?: string;
  key?: string;
  code?: string;
  shift?: boolean;
  control?: boolean;
  alt?: boolean;
  meta?: boolean;
  isAutoRepeat?: boolean;
}

export interface ElectronOverlayInputEvent {
  preventDefault?(): void;
}

export type ElectronSteamOverlayShortcutTarget = SteamOverlayTarget | (() => SteamOverlayTarget);

export interface ElectronSteamOverlayShortcutOptions {
  enabled?: boolean;
  target?: ElectronSteamOverlayShortcutTarget;
  preventDefault?: boolean;
  onOpen?: (target: SteamOverlayTarget) => void;
  onError?: (error: unknown) => void;
}

export type ElectronSteamOverlayShortcutConfig = boolean | ElectronSteamOverlayShortcutOptions;

export type ElectronSteamOverlayPresenterMode = "persistent" | "session";

export type ElectronSteamOverlayShortcutTargetType = SteamOverlayTarget["type"] | "function" | null;

export type ElectronSteamOverlayShortcutTargetSnapshot = {
  type: Exclude<ElectronSteamOverlayShortcutTargetType, null>;
  appId?: number;
  dialog?: number | string;
  flag?: number;
  route?: string;
  modal?: boolean;
  hasUrl?: boolean;
  hasSteamUrl?: boolean;
  hasTransactionId?: boolean;
  hasReturnUrl?: boolean;
  hasSteamId64?: boolean;
};

export interface ElectronSteamOverlayShortcutSnapshot {
  enabled: boolean;
  preventDefault: boolean;
  targetType: ElectronSteamOverlayShortcutTargetType;
  target: ElectronSteamOverlayShortcutTargetSnapshot | null;
}

export interface ElectronSteamOverlayWaitOptions {
  timeoutMs?: number;
  signal?: AbortSignal;
}

export interface ElectronSteamOverlayOpenAndWaitOptions {
  showTimeoutMs?: number;
  closeTimeoutMs?: number;
  signal?: AbortSignal;
}

export interface ElectronSteamOverlayCheckoutOperationObject
  extends Partial<Omit<SteamOverlayCheckoutTarget, "type" | "presenter">> {
  type?: "checkout";
  steamurl?: string;
  transactionID?: bigint | number | string;
  transid?: bigint | number | string;
  returnurl?: string;
  data?: unknown;
  response?: unknown;
  params?: unknown;
}

export type ElectronSteamOverlayCheckoutOperationResult =
  | string
  | number
  | bigint
  | ElectronSteamOverlayCheckoutOperationObject;

export interface ElectronSteamOverlayCheckoutAndWaitOptions extends ElectronSteamOverlayOpenAndWaitOptions {
  modal?: boolean;
  returnUrl?: string;
}

export interface ElectronSteamOverlaySnapshot extends NativeOverlayPresenterSnapshot {
  electronOverlay: {
    presenterMode: ElectronSteamOverlayPresenterMode;
    closeWithWindow: boolean;
    autoPrepareForNotifications: boolean;
    restoreFocusDelayMs: number;
    activationBoostMs: number;
    activeGraceMs: number;
    overlayShortcut: ElectronSteamOverlayShortcutSnapshot;
  };
}

export interface ElectronSteamOverlayNativeHostAvailability {
  available: boolean;
  snapshot: ElectronSteamOverlaySnapshot;
  diagnostics?: OverlayDiagnostics;
  code?: "STEAM_OVERLAY_NATIVE_HOST_UNAVAILABLE";
  reason?: NativeOverlayHostUnavailableReason;
  nativeHostUnavailableReason?: NativeOverlayHostUnavailableReason;
  macOverlayEnvironment?: MacOverlayEnvironment;
}

export interface ElectronSteamOverlayOpenAndWaitResult {
  shown: ElectronSteamOverlaySnapshot;
  parked: ElectronSteamOverlaySnapshot;
}

export interface ElectronSteamOverlayCheckoutAndWaitResult<T = ElectronSteamOverlayCheckoutOperationResult>
  extends ElectronSteamOverlayOpenAndWaitResult {
  transaction: T;
  target: SteamOverlayCheckoutTarget;
}

export type ElectronSteamOverlayOpenStatusReason =
  | "closed"
  | "native-host-unavailable"
  | "unsupported-target";

export type ElectronSteamOverlayWaitStatusReason =
  | ElectronSteamOverlayOpenStatusReason
  | "not-waitable";

export type ElectronSteamOverlayShortcutStatusReason =
  | ElectronSteamOverlayWaitStatusReason
  | "disabled"
  | "overlay-active"
  | "opening"
  | "dynamic-target";

export interface ElectronSteamOverlayOpenStatus {
  canOpen: boolean;
  canWait: boolean;
  target: SteamOverlayTarget;
  snapshot: ElectronSteamOverlaySnapshot;
  nativeHostAvailability: ElectronSteamOverlayNativeHostAvailability;
  reason?: ElectronSteamOverlayOpenStatusReason;
  waitReason?: ElectronSteamOverlayWaitStatusReason;
  message?: string;
}

export interface ElectronSteamOverlayShortcutStatus {
  canOpen: boolean;
  canWait: boolean;
  enabled: boolean;
  snapshot: ElectronSteamOverlaySnapshot;
  shortcut: ElectronSteamOverlayShortcutSnapshot;
  target?: SteamOverlayTarget;
  targetStatus?: ElectronSteamOverlayOpenStatus;
  nativeHostAvailability?: ElectronSteamOverlayNativeHostAvailability;
  reason?: ElectronSteamOverlayShortcutStatusReason;
  waitReason?: ElectronSteamOverlayShortcutStatusReason;
  message?: string;
}

export interface ElectronSteamOverlayCheckoutPrepareOptions {
  /**
   * @deprecated `withCheckoutPrepared()` now keeps the presenter ready for the
   * lifetime of the wrapped operation. This is only used as a fallback when a
   * custom presenter does not support operation-scoped activation holds.
   */
  durationMs?: number;
  /**
   * Aborts the wrapped operation wait and releases the scoped presenter hold.
   * Pass the same signal to your backend request if the request itself should
   * be canceled.
   */
  signal?: AbortSignal;
}

export class SteamOverlayNativeHostUnavailableError extends Error {
  readonly code = "STEAM_OVERLAY_NATIVE_HOST_UNAVAILABLE";
  readonly reason: NativeOverlayHostUnavailableReason;
  readonly macOverlayEnvironment?: MacOverlayEnvironment;

  constructor(snapshot: Pick<ElectronSteamOverlaySnapshot, "nativeHostUnavailableReason" | "macOverlayEnvironment">) {
    const reason = snapshot.nativeHostUnavailableReason;
    if (!reason) {
      throw new Error("Cannot create SteamOverlayNativeHostUnavailableError without an unavailable reason.");
    }

    super(
      `Steam overlay native host is unavailable: ${formatNativeOverlayHostUnavailableReason(
        reason
      )}. Wait until the session is interactive before opening the Steam overlay.`
    );
    this.name = "SteamOverlayNativeHostUnavailableError";
    Object.setPrototypeOf(this, new.target.prototype);
    this.reason = reason;
    this.macOverlayEnvironment = snapshot.macOverlayEnvironment;
  }
}

export function isSteamOverlayNativeHostUnavailableError(
  error: unknown
): error is SteamOverlayNativeHostUnavailableError {
  if (error instanceof SteamOverlayNativeHostUnavailableError) {
    return true;
  }

  if (!error || typeof error !== "object") {
    return false;
  }

  const candidate = error as { code?: unknown; reason?: unknown };
  return (
    candidate.code === "STEAM_OVERLAY_NATIVE_HOST_UNAVAILABLE" &&
    isNativeOverlayHostUnavailableReason(candidate.reason)
  );
}

export class SteamOverlayWaitTimeoutError extends Error {
  readonly code = "STEAM_OVERLAY_WAIT_TIMEOUT";
  readonly state: string;
  readonly timeoutMs: number;
  readonly snapshot?: ElectronSteamOverlaySnapshot;
  readonly diagnostics?: OverlayDiagnostics;
  readonly nativeHostUnavailableReason?: NativeOverlayHostUnavailableReason;
  readonly macOverlayEnvironment?: MacOverlayEnvironment;

  constructor(state: string, timeoutMs: number, snapshot?: ElectronSteamOverlaySnapshot) {
    super(formatSteamOverlayWaitTimeoutMessage(state, timeoutMs, snapshot));
    this.name = "SteamOverlayWaitTimeoutError";
    Object.setPrototypeOf(this, new.target.prototype);
    this.state = state;
    this.timeoutMs = timeoutMs;
    this.snapshot = snapshot;
    this.diagnostics = snapshot?.diagnostics;
    this.nativeHostUnavailableReason = snapshot?.nativeHostUnavailableReason;
    this.macOverlayEnvironment = snapshot?.macOverlayEnvironment;
  }
}

export function isSteamOverlayWaitTimeoutError(error: unknown): error is SteamOverlayWaitTimeoutError {
  if (error instanceof SteamOverlayWaitTimeoutError) {
    return true;
  }

  if (!error || typeof error !== "object") {
    return false;
  }

  const candidate = error as { code?: unknown; state?: unknown; timeoutMs?: unknown };
  return (
    candidate.code === "STEAM_OVERLAY_WAIT_TIMEOUT" &&
    typeof candidate.state === "string" &&
    typeof candidate.timeoutMs === "number"
  );
}

export class SteamOverlayWaitAbortedError extends Error {
  readonly code = "STEAM_OVERLAY_WAIT_ABORTED";
  readonly state: string;
  readonly snapshot?: ElectronSteamOverlaySnapshot;
  readonly diagnostics?: OverlayDiagnostics;
  readonly nativeHostUnavailableReason?: NativeOverlayHostUnavailableReason;
  readonly macOverlayEnvironment?: MacOverlayEnvironment;

  constructor(state: string, snapshot?: ElectronSteamOverlaySnapshot) {
    super(formatSteamOverlayWaitAbortedMessage(state, snapshot));
    this.name = "SteamOverlayWaitAbortedError";
    Object.setPrototypeOf(this, new.target.prototype);
    this.state = state;
    this.snapshot = snapshot;
    this.diagnostics = snapshot?.diagnostics;
    this.nativeHostUnavailableReason = snapshot?.nativeHostUnavailableReason;
    this.macOverlayEnvironment = snapshot?.macOverlayEnvironment;
  }
}

export function isSteamOverlayWaitAbortedError(error: unknown): error is SteamOverlayWaitAbortedError {
  if (error instanceof SteamOverlayWaitAbortedError) {
    return true;
  }

  if (!error || typeof error !== "object") {
    return false;
  }

  const candidate = error as { code?: unknown; state?: unknown };
  return candidate.code === "STEAM_OVERLAY_WAIT_ABORTED" && typeof candidate.state === "string";
}

export class SteamOverlayWaitClosedError extends Error {
  readonly code = "STEAM_OVERLAY_WAIT_CLOSED";
  readonly state: string;
  readonly snapshot?: ElectronSteamOverlaySnapshot;
  readonly diagnostics?: OverlayDiagnostics;
  readonly nativeHostUnavailableReason?: NativeOverlayHostUnavailableReason;
  readonly macOverlayEnvironment?: MacOverlayEnvironment;

  constructor(state: string, snapshot?: ElectronSteamOverlaySnapshot) {
    super(formatSteamOverlayWaitClosedMessage(state, snapshot));
    this.name = "SteamOverlayWaitClosedError";
    Object.setPrototypeOf(this, new.target.prototype);
    this.state = state;
    this.snapshot = snapshot;
    this.diagnostics = snapshot?.diagnostics;
    this.nativeHostUnavailableReason = snapshot?.nativeHostUnavailableReason;
    this.macOverlayEnvironment = snapshot?.macOverlayEnvironment;
  }
}

export function isSteamOverlayWaitClosedError(error: unknown): error is SteamOverlayWaitClosedError {
  if (error instanceof SteamOverlayWaitClosedError) {
    return true;
  }

  if (!error || typeof error !== "object") {
    return false;
  }

  const candidate = error as { code?: unknown; state?: unknown };
  return candidate.code === "STEAM_OVERLAY_WAIT_CLOSED" && typeof candidate.state === "string";
}

function isNativeOverlayHostUnavailableReason(value: unknown): value is NativeOverlayHostUnavailableReason {
  return value === "macos-screen-locked" || value === "macos-display-asleep";
}

export type ElectronOverlayWindow = Parameters<typeof electronOverlayPresenterOptionsImpl>[0] & {
  isFocused?(): boolean;
  on?(event: ElectronOverlayWindowGeometryEvent, handler: () => void): void;
  off?(event: ElectronOverlayWindowGeometryEvent, handler: () => void): void;
  removeListener?(event: ElectronOverlayWindowGeometryEvent, handler: () => void): void;
  once?(event: "closed", handler: () => void): void;
  webContents: Parameters<typeof electronOverlayPresenterOptionsImpl>[0]["webContents"] & {
    isDestroyed?(): boolean;
    on?(
      event: "before-input-event",
      handler: (event: ElectronOverlayInputEvent, input: ElectronOverlayKeyboardInput) => void
    ): void;
    off?(
      event: "before-input-event",
      handler: (event: ElectronOverlayInputEvent, input: ElectronOverlayKeyboardInput) => void
    ): void;
    removeListener?(
      event: "before-input-event",
      handler: (event: ElectronOverlayInputEvent, input: ElectronOverlayKeyboardInput) => void
    ): void;
  };
};

type ElectronOverlayWindowGeometryEvent =
  | "move"
  | "moved"
  | "resize"
  | "resized"
  | "maximize"
  | "unmaximize"
  | "restore"
  | "show"
  | "enter-full-screen"
  | "leave-full-screen"
  | "enter-html-full-screen"
  | "leave-html-full-screen";

export type ElectronSteamOverlayOptions = NonNullable<Parameters<typeof electronOverlayPresenterOptionsImpl>[1]> & {
  closeWithWindow?: boolean;
  overlayShortcut?: ElectronSteamOverlayShortcutConfig;
  presenterMode?: ElectronSteamOverlayPresenterMode;
  autoPrepareForNotifications?: boolean;
};

export interface ElectronSteamOverlay extends CallbackHandle {
  readonly presenter: NativeOverlayPresenter;
  getNativeHostAvailability(): ElectronSteamOverlayNativeHostAvailability;
  getOpenStatus(target: SteamOverlayTarget): ElectronSteamOverlayOpenStatus;
  getShortcutOpenStatus(): ElectronSteamOverlayShortcutStatus;
  open(target: SteamOverlayTarget): NativeOverlayPresenter;
  openShortcutTarget(): NativeOverlayPresenter | null;
  openShortcutTargetAndWait(
    options?: ElectronSteamOverlayOpenAndWaitOptions
  ): Promise<ElectronSteamOverlayOpenAndWaitResult | null>;
  waitForOverlayReady(options?: ElectronSteamOverlayWaitOptions): Promise<ElectronSteamOverlaySnapshot>;
  openAndWait(
    target: SteamOverlayTarget,
    options?: ElectronSteamOverlayOpenAndWaitOptions
  ): Promise<ElectronSteamOverlayOpenAndWaitResult>;
  openCheckoutAndWait<T extends ElectronSteamOverlayCheckoutOperationResult>(
    operation: () => T | Promise<T>,
    options?: ElectronSteamOverlayCheckoutAndWaitOptions
  ): Promise<ElectronSteamOverlayCheckoutAndWaitResult<T>>;
  withCheckoutPrepared<T>(
    operation: () => T | Promise<T>,
    options?: ElectronSteamOverlayCheckoutPrepareOptions
  ): Promise<T>;
  prepareForCheckout(durationMs?: number): NativeOverlayPresenter;
  prepareForNotification(durationMs?: number): NativeOverlayPresenter;
  waitForOverlayShown(options?: ElectronSteamOverlayWaitOptions): Promise<ElectronSteamOverlaySnapshot>;
  waitForOverlayClosed(options?: ElectronSteamOverlayWaitOptions): Promise<ElectronSteamOverlaySnapshot>;
  parkWhenSteamOverlayCloses(options?: ElectronSteamOverlayWaitOptions): Promise<ElectronSteamOverlaySnapshot>;
  close(): void;
  pump(): void;
  isOpen(): boolean;
  snapshot(): ElectronSteamOverlaySnapshot;
}

type NativeOverlayPresenterActivationMode = "interactive" | "passive" | "transparent-input";

type NativeOverlayPresenterInternal = NativeOverlayPresenter & {
  prepareForTransparentInputOverlay?: (durationMs?: number) => void;
  beginOverlayActivation?: (activationMode?: NativeOverlayPresenterActivationMode) => CallbackHandle;
  onStateChange?: (listener: () => void) => CallbackHandle;
};

interface ElectronSteamOverlayTargetWaitLifecycle {
  activationHandle?: CallbackHandle;
  onOpened?: () => void;
}

const SKIP_NATIVE_OVERLAY_PRESENTER_PREPARE = Symbol("skipNativeOverlayPresenterPrepare");

type InternalNativeOverlayPresenterOverlayOptions = NativeOverlayPresenterOverlayOptions & {
  [SKIP_NATIVE_OVERLAY_PRESENTER_PREPARE]?: boolean;
};

const electronNotificationPresenters = new Set<NativeOverlayPresenter>();

function registerElectronNotificationPresenter(presenter: NativeOverlayPresenter): CallbackHandle {
  electronNotificationPresenters.add(presenter);
  return {
    disconnect() {
      electronNotificationPresenters.delete(presenter);
    }
  };
}

function prepareElectronNotificationPresenters(): void {
  for (const presenter of Array.from(electronNotificationPresenters)) {
    try {
      if (!presenter.isOpen()) {
        electronNotificationPresenters.delete(presenter);
        continue;
      }

      const snapshot = presenter.snapshot();
      if (snapshot.nativeHostUnavailableReason) {
        continue;
      }
      if (snapshot.overlayActive || snapshot.mode === "active") {
        continue;
      }

      presenter.prepareForPassiveOverlay();
    } catch {
      electronNotificationPresenters.delete(presenter);
    }
  }
}

export const STEAM_STORE_BASE_URL = "https://store.steampowered.com";
export const STEAM_COMMUNITY_BASE_URL = "https://steamcommunity.com";
export const STEAM_FRIENDS_OVERLAY_URL = `${STEAM_COMMUNITY_BASE_URL}/chat/`;
export const STEAM_CHECKOUT_BASE_URL = "https://checkout.steampowered.com";

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

export interface HtmlBrowserEvent {
  browserHandle: number;
  browser_handle?: number;
  [key: string]: unknown;
}

export interface HtmlNeedsPaintEvent extends HtmlBrowserEvent {
  hasBgraData: boolean;
  has_bgra_data?: boolean;
  bgraByteLength: number;
  bgra_byte_length?: number;
  bgraBase64?: string | null;
  bgra_base64?: string | null;
  bgraTruncated: boolean;
  bgra_truncated?: boolean;
  bgra?: Buffer;
  wide: number;
  tall: number;
  updateX: number;
  update_x?: number;
  updateY: number;
  update_y?: number;
  updateWide: number;
  update_wide?: number;
  updateTall: number;
  update_tall?: number;
  scrollX: number;
  scroll_x?: number;
  scrollY: number;
  scroll_y?: number;
  pageScale: number;
  page_scale?: number;
  pageSerial: number;
  page_serial?: number;
}

export interface HtmlStartRequestEvent extends HtmlBrowserEvent {
  url: string;
  target: string;
  postData: string;
  post_data?: string;
  isRedirect: boolean;
  is_redirect?: boolean;
}

export interface HtmlUrlChangedEvent extends HtmlBrowserEvent {
  url: string;
  postData: string;
  post_data?: string;
  isRedirect: boolean;
  is_redirect?: boolean;
  pageTitle: string;
  page_title?: string;
  newNavigation: boolean;
  new_navigation?: boolean;
}

export interface HtmlFinishedRequestEvent extends HtmlBrowserEvent {
  url: string;
  pageTitle: string;
  page_title?: string;
}

export interface HtmlOpenLinkInNewTabEvent extends HtmlBrowserEvent {
  url: string;
}

export interface HtmlChangedTitleEvent extends HtmlBrowserEvent {
  title: string;
}

export interface HtmlSearchResultsEvent extends HtmlBrowserEvent {
  results: number;
  currentMatch: number;
  current_match?: number;
}

export interface HtmlCanGoBackAndForwardEvent extends HtmlBrowserEvent {
  canGoBack: boolean;
  can_go_back?: boolean;
  canGoForward: boolean;
  can_go_forward?: boolean;
}

export interface HtmlScrollEvent extends HtmlBrowserEvent {
  scrollMax: number;
  scroll_max?: number;
  scrollCurrent: number;
  scroll_current?: number;
  pageScale: number;
  page_scale?: number;
  visible: boolean;
  pageSize: number;
  page_size?: number;
}

export interface HtmlLinkAtPositionEvent extends HtmlBrowserEvent {
  x: number;
  y: number;
  url: string;
  input: boolean;
  liveLink: boolean;
  live_link?: boolean;
}

export interface HtmlDialogEvent extends HtmlBrowserEvent {
  message: string;
}

export interface HtmlFileOpenDialogEvent extends HtmlBrowserEvent {
  title: string;
  initialFile: string;
  initial_file?: string;
}

export interface HtmlNewWindowEvent extends HtmlBrowserEvent {
  url: string;
  x: number;
  y: number;
  wide: number;
  tall: number;
  newWindowBrowserHandle: number;
  new_window_browser_handle?: number;
}

export interface HtmlSetCursorEvent extends HtmlBrowserEvent {
  mouseCursor: number;
  mouse_cursor?: number;
}

export interface HtmlMessageEvent extends HtmlBrowserEvent {
  message: string;
}

export interface HtmlBrowserRestartedEvent extends HtmlBrowserEvent {
  oldBrowserHandle: number;
  old_browser_handle?: number;
}

export interface UtilsImageSize {
  width: number;
  height: number;
}

export interface UtilsCserIPPort {
  ip: number;
  ipAddress: string;
  port: number;
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

export interface UtilsIpCountryEvent {
  [key: string]: unknown;
}

export interface UtilsLowBatteryPowerEvent {
  minutesBatteryLeft: number;
  minutes_battery_left?: number;
  [key: string]: unknown;
}

export interface UtilsApiCallCompletedEvent {
  asyncCall: bigint;
  async_call?: bigint;
  callback: number;
  parameterSize: number;
  parameter_size?: number;
  [key: string]: unknown;
}

export interface UtilsSteamShutdownEvent {
  [key: string]: unknown;
}

export interface UtilsIpcFailureEvent {
  failureType: number;
  failure_type?: number;
  [key: string]: unknown;
}

export interface UtilsCheckFileSignatureEvent {
  checkFileSignature: number;
  check_file_signature?: number;
  [key: string]: unknown;
}

export interface UtilsGamepadTextInputDismissedEvent {
  submitted: boolean;
  submittedText: number;
  submitted_text?: number;
  appId: number;
  app_id?: number;
  [key: string]: unknown;
}

export interface UtilsAppResumingFromSuspendEvent {
  [key: string]: unknown;
}

export interface UtilsFloatingGamepadTextInputDismissedEvent {
  [key: string]: unknown;
}

export interface UtilsFilterTextDictionaryChangedEvent {
  language: number;
  [key: string]: unknown;
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

export interface UserClientGameServerDenyEvent {
  appId: number;
  app_id?: number;
  gameServerIp: number;
  game_server_ip?: number;
  gameServerIpAddress: string;
  game_server_ip_address?: string;
  gameServerPort: number;
  game_server_port?: number;
  secure: boolean;
  reason: number;
  [key: string]: unknown;
}

export interface UserLicensesUpdatedEvent {
  [key: string]: unknown;
}

export interface UserValidateAuthTicketResponseEvent {
  steamId: bigint;
  steam_id?: bigint;
  authSessionResponse: number;
  auth_session_response?: number;
  ownerSteamId: bigint;
  owner_steam_id?: bigint;
  [key: string]: unknown;
}

export interface UserEncryptedAppTicketResponseEvent {
  result: number;
  [key: string]: unknown;
}

export interface UserGetAuthSessionTicketResponseEvent {
  authTicket: number;
  auth_ticket?: number;
  result: number;
  [key: string]: unknown;
}

export interface UserGameWebCallbackEvent {
  url: string;
  [key: string]: unknown;
}

export interface UserStoreAuthURLResponseEvent {
  url: string;
  [key: string]: unknown;
}

export interface UserMarketEligibilityResponseEvent extends UserMarketEligibility {
  not_allowed_reason?: number;
  allowed_at_time?: number;
  steam_guard_required_days?: number;
  new_device_cooldown_days?: number;
  [key: string]: unknown;
}

export interface UserDurationControlEvent extends UserDurationControl {
  app_id?: number;
  seconds_last_5h?: number;
  seconds_today?: number;
  seconds_remaining?: number;
  [key: string]: unknown;
}

export interface UserGetTicketForWebApiResponseEvent {
  authTicket: number;
  auth_ticket?: number;
  result: number;
  ticketByteLength: number;
  ticket_byte_length?: number;
  ticket: Buffer;
  ticket_base64?: string;
  [key: string]: unknown;
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

export interface LegacyNetworkingSocketStatusEvent {
  socket: number;
  listenSocket: number;
  listen_socket?: number;
  remote: bigint;
  state: number;
  [key: string]: unknown;
}

export interface LegacyNetworkingP2PSessionRequestEvent {
  remote: bigint;
  [key: string]: unknown;
}

export interface LegacyNetworkingP2PSessionConnectFailEvent {
  remote: bigint;
  error: number;
  [key: string]: unknown;
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
  genericBytes?: Buffer | Uint8Array;
  psnId?: bigint;
  xboxPairwiseId?: string;
  ipAddress?: NetworkingIpAddress;
  ipv4?: number;
  port?: number;
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
  pointerValue?: bigint | number | string | null;
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

export interface NetworkingMessagesSessionRequestEvent {
  remoteIdentity: NetworkingIdentityInfo;
  [key: string]: unknown;
}

export interface NetworkingMessagesSessionFailedEvent {
  info: NetworkingMessagesSessionConnectionInfo;
  [key: string]: unknown;
}

export interface NetworkingConnectionStatusChangedEvent {
  connection: number;
  oldState: number;
  old_state?: number;
  info: NetworkingConnectionInfo | null;
  [key: string]: unknown;
}

export interface NetworkingFakeIpResultEvent extends NetworkingFakeIpResult {
  [key: string]: unknown;
}

export interface NetworkingAuthenticationStatusEvent extends NetworkingAuthenticationStatus {
  [key: string]: unknown;
}

export interface NetworkingRelayNetworkStatusEvent extends NetworkingRelayNetworkStatus {
  [key: string]: unknown;
}

export interface NetworkingPingDataCenter {
  pingMs: number;
  viaRelayPop: number;
}

export interface NetworkingIpAddress {
  text?: string;
  ipv4?: number;
  ipv6?: Buffer | Uint8Array;
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

export interface UserStatsReceivedEvent {
  gameId: bigint;
  game_id?: bigint;
  result: number;
  steamId: bigint;
  steam_id?: bigint;
  [key: string]: unknown;
}

export interface UserStatsStoredEvent {
  gameId: bigint;
  game_id?: bigint;
  result: number;
  [key: string]: unknown;
}

export interface UserStatsUnloadedEvent {
  steamId: bigint;
  steam_id?: bigint;
  [key: string]: unknown;
}

export interface UserAchievementStoredEvent {
  gameId: bigint;
  game_id?: bigint;
  groupAchievement: boolean;
  group_achievement?: boolean;
  achievement: string;
  currentProgress: number;
  current_progress?: number;
  maxProgress: number;
  max_progress?: number;
  [key: string]: unknown;
}

export interface UserAchievementIconFetchedEvent {
  gameId: bigint;
  game_id?: bigint;
  achievement: string;
  achieved: boolean;
  iconHandle: number;
  icon_handle?: number;
  [key: string]: unknown;
}

export interface LeaderboardFindResultEvent {
  leaderboard: bigint;
  found: boolean;
  [key: string]: unknown;
}

export interface LeaderboardScoresDownloadedEvent {
  leaderboard: bigint;
  entriesHandle: bigint;
  entries_handle?: bigint;
  entryCount: number;
  entry_count?: number;
  [key: string]: unknown;
}

export interface LeaderboardScoreUploadedEvent {
  success: boolean;
  leaderboard: bigint;
  score: number;
  scoreChanged: boolean;
  score_changed?: boolean;
  globalRankNew: number;
  global_rank_new?: number;
  globalRankPrevious: number;
  global_rank_previous?: number;
  [key: string]: unknown;
}

export interface NumberOfCurrentPlayersEvent {
  success: boolean;
  players: number;
  [key: string]: unknown;
}

export interface GlobalAchievementPercentagesReadyEvent {
  gameId: bigint;
  game_id?: bigint;
  result: number;
  [key: string]: unknown;
}

export interface LeaderboardUgcSetEvent {
  result: number;
  leaderboard: bigint;
  [key: string]: unknown;
}

export interface GlobalStatsReceivedEvent {
  gameId: bigint;
  game_id?: bigint;
  result: number;
  [key: string]: unknown;
}

export interface GameCoordinatorMessageAvailable {
  available: boolean;
  messageSize: number;
}

export interface GameCoordinatorMessage {
  result: number;
  messageType: number;
  messageSize: number;
  data: Buffer | null;
}

export interface GameCoordinatorMessageAvailableEvent {
  messageSize: number;
  message_size?: number;
  [key: string]: unknown;
}

export interface GameCoordinatorMessageFailedEvent {
  [key: string]: unknown;
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

export interface ScreenshotReadyEvent {
  localHandle: number;
  local_handle?: number;
  result: number;
  [key: string]: unknown;
}

export interface ScreenshotRequestedEvent {
  [key: string]: unknown;
}

export interface MusicPlaybackStatusChangedEvent {
  [key: string]: unknown;
}

export interface MusicVolumeHasChangedEvent {
  newVolume: number;
  new_volume?: number;
  [key: string]: unknown;
}

export interface MusicRemoteWantsVolumeEvent {
  newVolume: number;
  new_volume?: number;
  [key: string]: unknown;
}

export interface MusicRemoteSelectsEntryEvent {
  entryId: number;
  entry_id?: number;
  [key: string]: unknown;
}

export interface MusicRemoteControlEvent {
  [key: string]: unknown;
}

export interface MusicRemoteWantsShuffledEvent {
  shuffled: boolean;
  [key: string]: unknown;
}

export interface MusicRemoteWantsLoopedEvent {
  looped: boolean;
  [key: string]: unknown;
}

export interface MusicRemoteWantsPlayingRepeatStatusEvent {
  repeatStatus: number;
  repeat_status?: number;
  [key: string]: unknown;
}

export interface VideoBroadcastUploadStartEvent {
  isRtmp: boolean;
  is_rtmp?: boolean;
  [key: string]: unknown;
}

export interface VideoBroadcastUploadStopEvent {
  result: number;
  [key: string]: unknown;
}

export interface VideoUrlResultEvent {
  result: number;
  videoAppId: number;
  video_app_id?: number;
  url: string;
  [key: string]: unknown;
}

export interface VideoOpfSettingsResultEvent {
  result: number;
  videoAppId: number;
  video_app_id?: number;
  [key: string]: unknown;
}

export interface ParentalSettingsChangedEvent {
  [key: string]: unknown;
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

export interface TimelineEventRecordingExistsEvent {
  event: bigint;
  recordingExists: boolean;
  recording_exists?: boolean;
  [key: string]: unknown;
}

export interface TimelineGamePhaseRecordingExistsEvent {
  phaseId: string;
  phase_id?: string;
  recordingMs: bigint;
  recording_ms?: bigint;
  longestClipMs: bigint;
  longest_clip_ms?: bigint;
  clipCount: number;
  clip_count?: number;
  screenshotCount: number;
  screenshot_count?: number;
  [key: string]: unknown;
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

export interface RemotePlaySessionEvent {
  sessionId: number;
  session_id?: number;
  [key: string]: unknown;
}

export interface RemotePlayTogetherGuestInviteEvent {
  connectUrl: string;
  connect_url?: string;
  [key: string]: unknown;
}

export interface RemotePlaySessionAvatarLoadedEvent {
  sessionId: number;
  session_id?: number;
  image: number;
  wide: number;
  tall: number;
  [key: string]: unknown;
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

export interface InputActionEvent {
  controllerHandle: bigint;
  eventType: number;
  analogActionHandle?: bigint;
  analogActionData?: InputAnalogActionData;
  digitalActionHandle?: bigint;
  digitalActionData?: InputDigitalActionData;
}

export interface SteamInputDeviceConnectedEvent {
  connectedDeviceHandle: bigint;
  connected_device_handle?: bigint;
  [key: string]: unknown;
}

export interface SteamInputDeviceDisconnectedEvent {
  disconnectedDeviceHandle: bigint;
  disconnected_device_handle?: bigint;
  [key: string]: unknown;
}

export interface SteamInputConfigurationLoadedEvent {
  appId: number;
  app_id?: number;
  deviceHandle: bigint;
  device_handle?: bigint;
  mappingCreator: bigint;
  mapping_creator?: bigint;
  majorRevision: number;
  major_revision?: number;
  minorRevision: number;
  minor_revision?: number;
  usesSteamInputApi: boolean;
  uses_steam_input_api?: boolean;
  usesGamepadApi: boolean;
  uses_gamepad_api?: boolean;
  [key: string]: unknown;
}

export interface SteamInputGamepadSlotChangeEvent {
  appId: number;
  app_id?: number;
  deviceHandle: bigint;
  device_handle?: bigint;
  deviceType: number;
  device_type?: number;
  oldGamepadSlot: number;
  old_gamepad_slot?: number;
  newGamepadSlot: number;
  new_gamepad_slot?: number;
  [key: string]: unknown;
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

export interface WorkshopQueryCompletedEvent {
  handle: bigint;
  result: number;
  returnedResults: number;
  returned_results?: number;
  totalResults: number;
  total_results?: number;
  wasCached: boolean;
  was_cached?: boolean;
  nextCursor: string;
  next_cursor?: string;
  [key: string]: unknown;
}

export interface WorkshopCreateItemResultEvent extends UgcResult {
  result: number;
  [key: string]: unknown;
}

export interface WorkshopSubmitItemUpdateResultEvent extends UgcResult {
  result: number;
  [key: string]: unknown;
}

export interface WorkshopItemInstalledEvent {
  appId: number;
  app_id?: number;
  itemId: bigint;
  item_id?: bigint;
  legacyContent: bigint;
  legacy_content?: bigint;
  manifestId: bigint;
  manifest_id?: bigint;
  [key: string]: unknown;
}

export interface WorkshopDownloadItemResultEvent {
  appId: number;
  app_id?: number;
  itemId: bigint;
  item_id?: bigint;
  result: number;
  [key: string]: unknown;
}

export interface WorkshopUserSubscribedItemsListChangedEvent {
  appId: number;
  app_id?: number;
  [key: string]: unknown;
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

export type SteamWebApiMethod = "GET" | "POST";
export type SteamWebApiParamValue = string | number | bigint | boolean | null | undefined;
export type SteamWebApiParams = Record<string, SteamWebApiParamValue | readonly SteamWebApiParamValue[]>;
export type SteamWebApiBody = SteamWebApiParams | URLSearchParams | string | Buffer | Uint8Array | null | undefined;

export interface SteamWebApiRequestOptions {
  interfaceName: string;
  methodName: string;
  version?: string | number;
  method?: SteamWebApiMethod;
  params?: SteamWebApiParams;
  body?: SteamWebApiBody;
  key?: string | null;
  format?: string | null;
  baseUrl?: string;
  headers?: Record<string, string>;
  signal?: AbortSignal;
}

export interface SteamWebApiClientOptions {
  apiKey?: string | null;
  baseUrl?: string;
  defaultFormat?: string | null;
  headers?: Record<string, string>;
  fetch?: SteamWebApiFetch;
}

export interface SteamWebApiEndpointOptions {
  key?: string | null;
  format?: string | null;
  baseUrl?: string;
  headers?: Record<string, string>;
  signal?: AbortSignal;
}

export interface SteamWebApiResponse<T = unknown> {
  ok: boolean;
  status: number;
  url: string;
  headers: Record<string, string>;
  data: T;
  text: string;
}

export interface SteamWebApiClient {
  buildUrl(options: SteamWebApiRequestOptions): string;
  request<T = unknown>(options: SteamWebApiRequestOptions): Promise<SteamWebApiResponse<T>>;
  get<T = unknown>(options: Omit<SteamWebApiRequestOptions, "method" | "body">): Promise<SteamWebApiResponse<T>>;
  post<T = unknown>(options: Omit<SteamWebApiRequestOptions, "method">): Promise<SteamWebApiResponse<T>>;
  apps: SteamWebApiAppsFacade;
  authenticationService: SteamWebApiAuthenticationServiceFacade;
  broadcast: SteamWebApiBroadcastFacade;
  broadcastService: SteamWebApiBroadcastServiceFacade;
  cheatReportingService: SteamWebApiCheatReportingServiceFacade;
  clientStats1046930: SteamWebApiClientStats1046930Facade;
  cloudService: SteamWebApiCloudServiceFacade;
  community: SteamWebApiCommunityFacade;
  contentServerDirectoryService: SteamWebApiContentServerDirectoryServiceFacade;
  directory: SteamWebApiDirectoryFacade;
  econMarketService: SteamWebApiEconMarketServiceFacade;
  econService: SteamWebApiEconServiceFacade;
  economy: SteamWebApiEconomyFacade;
  gameInventory: SteamWebApiGameInventoryFacade;
  gameCoordinatorVersion: SteamWebApiGameCoordinatorVersionFacade;
  gameNotificationsService: SteamWebApiGameNotificationsServiceFacade;
  gameServersService: SteamWebApiGameServersServiceFacade;
  gameServerStats: SteamWebApiGameServerStatsFacade;
  helpRequestLogsService: SteamWebApiHelpRequestLogsServiceFacade;
  inventoryService: SteamWebApiInventoryServiceFacade;
  leaderboards: SteamWebApiLeaderboardsFacade;
  news: SteamWebApiNewsFacade;
  player: SteamWebApiPlayerServiceFacade;
  portal2Leaderboards: SteamWebApiPortal2LeaderboardsFacade;
  publishedFileService: SteamWebApiPublishedFileServiceFacade;
  publishedItemSearch: SteamWebApiPublishedItemSearchFacade;
  publishedItemVoting: SteamWebApiPublishedItemVotingFacade;
  remoteStorage: SteamWebApiRemoteStorageFacade;
  siteLicenseService: SteamWebApiSiteLicenseServiceFacade;
  store: SteamWebApiStoreServiceFacade;
  tfSystem: SteamWebApiTfSystemFacade;
  util: SteamWebApiUtilFacade;
  user: SteamWebApiUserFacade;
  userAuth: SteamWebApiUserAuthFacade;
  userOAuth: SteamWebApiUserOAuthFacade;
  userStats: SteamWebApiUserStatsFacade;
  wishlistService: SteamWebApiWishlistServiceFacade;
  workshopService: SteamWebApiWorkshopServiceFacade;
  microTxn: SteamWebApiMicroTxnFacade;
  microTxnSandbox: SteamWebApiMicroTxnFacade;
}

export interface SteamWebApiFetchResponse {
  ok: boolean;
  status: number;
  headers: {
    forEach(callback: (value: string, key: string) => void): void;
  };
  text(): Promise<string>;
}

export type SteamWebApiFetch = (
  input: string,
  init?: {
    method?: string;
    headers?: Record<string, string>;
    body?: string | Buffer | Uint8Array;
    signal?: AbortSignal;
  }
) => Promise<SteamWebApiFetchResponse>;

export interface SteamWebApiAppsFacade {
  getAppBetas<T = unknown>(appId: number, options?: SteamWebApiEndpointOptions | null): Promise<SteamWebApiResponse<T>>;
  getAppBuilds<T = unknown>(options: SteamWebApiAppBuildsOptions): Promise<SteamWebApiResponse<T>>;
  getAppDepotVersions<T = unknown>(
    appId: number,
    options?: SteamWebApiEndpointOptions | null
  ): Promise<SteamWebApiResponse<T>>;
  getAppList<T = unknown>(options?: SteamWebApiEndpointOptions | null): Promise<SteamWebApiResponse<T>>;
  getPartnerAppListForWebApiKey<T = unknown>(
    options?: SteamWebApiPartnerAppListOptions | null
  ): Promise<SteamWebApiResponse<T>>;
  getPlayersBanned<T = unknown>(
    appId: number,
    options?: SteamWebApiEndpointOptions | null
  ): Promise<SteamWebApiResponse<T>>;
  getSdrConfig<T = unknown>(
    appId: number,
    options?: SteamWebApiEndpointOptions | null
  ): Promise<SteamWebApiResponse<T>>;
  getServerList<T = unknown>(options?: SteamWebApiServerListOptions | null): Promise<SteamWebApiResponse<T>>;
  getServersAtAddress<T = unknown>(
    address: string,
    options?: SteamWebApiEndpointOptions | null
  ): Promise<SteamWebApiResponse<T>>;
  setAppBuildLive<T = unknown>(options: SteamWebApiSetAppBuildLiveOptions): Promise<SteamWebApiResponse<T>>;
  upToDateCheck<T = unknown>(options: SteamWebApiUpToDateCheckOptions): Promise<SteamWebApiResponse<T>>;
}

export interface SteamWebApiAppBuildsOptions extends SteamWebApiEndpointOptions {
  appId: number;
  count?: number;
}

export interface SteamWebApiPartnerAppListOptions extends SteamWebApiEndpointOptions {
  typeFilter?: string | string[];
}

export interface SteamWebApiServerListOptions extends SteamWebApiEndpointOptions {
  filter?: string;
  limit?: number;
}

export interface SteamWebApiSetAppBuildLiveOptions extends SteamWebApiEndpointOptions {
  appId: number;
  buildId: number;
  betaKey: string;
  steamId64?: bigint | number | string;
  description?: string;
}

export interface SteamWebApiUpToDateCheckOptions extends SteamWebApiEndpointOptions {
  appId: number;
  version: number;
}

export interface SteamWebApiNewsFacade {
  getNewsForApp<T = unknown>(options: SteamWebApiNewsForAppOptions): Promise<SteamWebApiResponse<T>>;
  getNewsForAppAuthed<T = unknown>(options: SteamWebApiNewsForAppOptions): Promise<SteamWebApiResponse<T>>;
}

export interface SteamWebApiNewsForAppOptions extends SteamWebApiEndpointOptions {
  appId: number;
  maxLength?: number;
  endDate?: number;
  count?: number;
  feeds?: string | string[];
}

export interface SteamWebApiAuthenticationServiceFacade {
  pollAuthSessionStatus<T = unknown>(
    options: SteamWebApiPollAuthSessionStatusOptions
  ): Promise<SteamWebApiResponse<T>>;
  getAuthSessionInfo<T = unknown>(
    clientId: bigint | number | string,
    options?: SteamWebApiEndpointOptions | null
  ): Promise<SteamWebApiResponse<T>>;
  getAuthSessionRiskInfo<T = unknown>(
    options: SteamWebApiAuthSessionRiskInfoOptions
  ): Promise<SteamWebApiResponse<T>>;
  notifyRiskQuizResults<T = unknown>(
    options: SteamWebApiNotifyRiskQuizResultsOptions
  ): Promise<SteamWebApiResponse<T>>;
  getPasswordRsaPublicKey<T = unknown>(
    accountName: string,
    options?: SteamWebApiEndpointOptions | null
  ): Promise<SteamWebApiResponse<T>>;
  beginAuthSessionViaCredentials<T = unknown>(
    options: SteamWebApiBeginAuthSessionViaCredentialsOptions
  ): Promise<SteamWebApiResponse<T>>;
  updateAuthSessionWithSteamGuardCode<T = unknown>(
    options: SteamWebApiUpdateAuthSessionWithSteamGuardCodeOptions
  ): Promise<SteamWebApiResponse<T>>;
  beginAuthSessionViaQr<T = unknown>(
    options: SteamWebApiBeginAuthSessionViaQrOptions
  ): Promise<SteamWebApiResponse<T>>;
  updateAuthSessionWithMobileConfirmation<T = unknown>(
    options: SteamWebApiUpdateAuthSessionWithMobileConfirmationOptions
  ): Promise<SteamWebApiResponse<T>>;
}

export interface SteamWebApiPollAuthSessionStatusOptions extends SteamWebApiEndpointOptions {
  clientId: bigint | number | string;
  requestId: string;
  tokenToRevoke: bigint | number | string;
}

export interface SteamWebApiAuthSessionRiskInfoOptions extends SteamWebApiEndpointOptions {
  clientId: bigint | number | string;
  language: number;
}

export interface SteamWebApiNotifyRiskQuizResultsOptions extends SteamWebApiEndpointOptions {
  clientId: bigint | number | string;
  results: SteamWebApiInputJsonValue;
  selectedAction: string;
  didConfirmLogin: boolean;
}

export interface SteamWebApiBeginAuthSessionViaCredentialsOptions extends SteamWebApiEndpointOptions {
  deviceFriendlyName: string;
  accountName: string;
  encryptedPassword: string;
  encryptionTimestamp: bigint | number | string;
  rememberLogin: boolean;
  platformType: string | number;
  persistence?: string | number;
  websiteId?: string;
  deviceDetails: SteamWebApiInputJsonValue;
  guardData: string;
  language: number;
  qosLevel?: number;
}

export interface SteamWebApiUpdateAuthSessionWithSteamGuardCodeOptions extends SteamWebApiEndpointOptions {
  clientId: bigint | number | string;
  steamId64: bigint | number | string;
  code: string;
  codeType: string | number;
}

export interface SteamWebApiBeginAuthSessionViaQrOptions extends SteamWebApiEndpointOptions {
  deviceFriendlyName: string;
  platformType: string | number;
  deviceDetails: SteamWebApiInputJsonValue;
  websiteId?: string;
}

export interface SteamWebApiUpdateAuthSessionWithMobileConfirmationOptions extends SteamWebApiEndpointOptions {
  version: number;
  clientId: bigint | number | string;
  steamId64: bigint | number | string;
  signature: string;
  confirm?: boolean;
  persistence?: string | number;
}

export interface SteamWebApiBroadcastFacade {
  playerStats<T = unknown>(options?: SteamWebApiEndpointOptions | null): Promise<SteamWebApiResponse<T>>;
  viewerHeartbeat<T = unknown>(options: SteamWebApiBroadcastViewerHeartbeatOptions): Promise<SteamWebApiResponse<T>>;
}

export interface SteamWebApiBroadcastViewerHeartbeatOptions extends SteamWebApiEndpointOptions {
  steamId64: bigint | number | string;
  sessionId: bigint | number | string;
  token: bigint | number | string;
  stream?: number;
}

export interface SteamWebApiDirectoryFacade {
  getCmList<T = unknown>(options: SteamWebApiDirectoryCmListOptions): Promise<SteamWebApiResponse<T>>;
  getCmListForConnect<T = unknown>(
    options?: SteamWebApiDirectoryCmListForConnectOptions | null
  ): Promise<SteamWebApiResponse<T>>;
  getSteamPipeDomains<T = unknown>(options?: SteamWebApiEndpointOptions | null): Promise<SteamWebApiResponse<T>>;
}

export interface SteamWebApiDirectoryCmListOptions extends SteamWebApiEndpointOptions {
  cellId: number;
  maxCount?: number;
}

export interface SteamWebApiDirectoryCmListForConnectOptions extends SteamWebApiEndpointOptions {
  cellId?: number;
  cmType?: string;
  realm?: string;
  maxCount?: number;
  qosLevel?: number;
}

export interface SteamWebApiPlayerServiceFacade {
  getRecentlyPlayedGames<T = unknown>(
    options: SteamWebApiRecentlyPlayedGamesOptions
  ): Promise<SteamWebApiResponse<T>>;
  getSingleGamePlaytime<T = unknown>(
    options: SteamWebApiSingleGamePlaytimeOptions
  ): Promise<SteamWebApiResponse<T>>;
  getOwnedGames<T = unknown>(options: SteamWebApiOwnedGamesOptions): Promise<SteamWebApiResponse<T>>;
  getSteamLevel<T = unknown>(
    steamId64: bigint | number | string,
    options?: SteamWebApiEndpointOptions | null
  ): Promise<SteamWebApiResponse<T>>;
  getBadges<T = unknown>(
    steamId64: bigint | number | string,
    options?: SteamWebApiEndpointOptions | null
  ): Promise<SteamWebApiResponse<T>>;
  getCommunityBadgeProgress<T = unknown>(
    options: SteamWebApiCommunityBadgeProgressOptions
  ): Promise<SteamWebApiResponse<T>>;
  recordOfflinePlaytime<T = unknown>(
    options: SteamWebApiRecordOfflinePlaytimeOptions
  ): Promise<SteamWebApiResponse<T>>;
}

export interface SteamWebApiRecentlyPlayedGamesOptions extends SteamWebApiEndpointOptions {
  steamId64: bigint | number | string;
  count?: number;
}

export interface SteamWebApiSingleGamePlaytimeOptions extends SteamWebApiEndpointOptions {
  steamId64: bigint | number | string;
  appId: number;
}

export interface SteamWebApiOwnedGamesOptions extends SteamWebApiEndpointOptions {
  steamId64: bigint | number | string;
  includeAppInfo?: boolean;
  includePlayedFreeGames?: boolean;
  appIdsFilter?: number[];
}

export interface SteamWebApiCommunityBadgeProgressOptions extends SteamWebApiEndpointOptions {
  steamId64: bigint | number | string;
  badgeId: number;
}

export interface SteamWebApiRecordOfflinePlaytimeOptions extends SteamWebApiEndpointOptions {
  steamId64: bigint | number | string;
  ticket: string;
  playSessions: readonly SteamWebApiInputJsonValue[];
}

export interface SteamWebApiStoreServiceFacade {
  getAppList<T = unknown>(options?: SteamWebApiStoreAppListOptions | null): Promise<SteamWebApiResponse<T>>;
  getGamesFollowed<T = unknown>(
    steamId64: bigint | number | string,
    options?: SteamWebApiEndpointOptions | null
  ): Promise<SteamWebApiResponse<T>>;
  getGamesFollowedCount<T = unknown>(
    steamId64: bigint | number | string,
    options?: SteamWebApiEndpointOptions | null
  ): Promise<SteamWebApiResponse<T>>;
  getRecommendedTagsForUser<T = unknown>(
    options: SteamWebApiRecommendedTagsForUserOptions
  ): Promise<SteamWebApiResponse<T>>;
}

export interface SteamWebApiTfSystemFacade {
  getWorldStatus<T = unknown>(options?: SteamWebApiEndpointOptions | null): Promise<SteamWebApiResponse<T>>;
}

export interface SteamWebApiSiteLicenseServiceFacade {
  getCurrentClientConnections<T = unknown>(
    options?: SteamWebApiSiteLicenseSiteOptions | null
  ): Promise<SteamWebApiResponse<T>>;
  getTotalPlaytime<T = unknown>(
    options: SteamWebApiSiteLicenseTotalPlaytimeOptions
  ): Promise<SteamWebApiResponse<T>>;
}

export interface SteamWebApiSiteLicenseSiteOptions extends SteamWebApiEndpointOptions {
  siteId?: bigint | number | string;
}

export interface SteamWebApiSiteLicenseTotalPlaytimeOptions extends SteamWebApiSiteLicenseSiteOptions {
  startTime: string;
  endTime: string;
}

export interface SteamWebApiStoreAppListOptions extends SteamWebApiEndpointOptions {
  ifModifiedSince?: number;
  haveDescriptionLanguage?: string;
  includeGames?: boolean;
  includeDlc?: boolean;
  includeSoftware?: boolean;
  includeVideos?: boolean;
  includeHardware?: boolean;
  lastAppId?: number;
  maxResults?: number;
}

export interface SteamWebApiRecommendedTagsForUserOptions extends SteamWebApiEndpointOptions {
  language: string;
  countryCode: string;
  favorRarerTags: boolean;
}

export interface SteamWebApiContentServerDirectoryServiceFacade {
  getCdnForVideo<T = unknown>(
    options: SteamWebApiContentServerCdnForVideoOptions
  ): Promise<SteamWebApiResponse<T>>;
  pickSingleContentServer<T = unknown>(
    options: SteamWebApiPickSingleContentServerOptions
  ): Promise<SteamWebApiResponse<T>>;
  getServersForSteamPipe<T = unknown>(
    options: SteamWebApiServersForSteamPipeOptions
  ): Promise<SteamWebApiResponse<T>>;
  getClientUpdateHosts<T = unknown>(
    options: SteamWebApiClientUpdateHostsOptions
  ): Promise<SteamWebApiResponse<T>>;
  getDepotPatchInfo<T = unknown>(options: SteamWebApiDepotPatchInfoOptions): Promise<SteamWebApiResponse<T>>;
}

export interface SteamWebApiContentServerCdnForVideoOptions extends SteamWebApiEndpointOptions {
  propertyType: number;
  clientIp: string;
  clientRegion: string;
}

export interface SteamWebApiPickSingleContentServerOptions extends SteamWebApiEndpointOptions {
  propertyType: number;
  cellId: number;
  clientIp: string;
}

export interface SteamWebApiServersForSteamPipeOptions extends SteamWebApiEndpointOptions {
  cellId: number;
  maxServers?: number;
  ipOverride?: string;
  launcherType?: number;
  ipv6Public?: string;
  currentConnections?: SteamWebApiInputJsonValue;
}

export interface SteamWebApiClientUpdateHostsOptions extends SteamWebApiEndpointOptions {
  cachedSignature: string;
}

export interface SteamWebApiDepotPatchInfoOptions extends SteamWebApiEndpointOptions {
  appId: number;
  depotId: number;
  sourceManifestId: bigint | number | string;
  targetManifestId: bigint | number | string;
}

export interface SteamWebApiRemoteStorageFacade {
  enumerateUserSubscribedFiles<T = unknown>(
    options: SteamWebApiRemoteStorageUserAppOptions
  ): Promise<SteamWebApiResponse<T>>;
  getCollectionDetails<T = unknown>(
    collectionIds: Array<bigint | number | string>,
    options?: SteamWebApiEndpointOptions | null
  ): Promise<SteamWebApiResponse<T>>;
  getPublishedFileDetails<T = unknown>(
    publishedFileIds: Array<bigint | number | string>,
    options?: SteamWebApiEndpointOptions | null
  ): Promise<SteamWebApiResponse<T>>;
  getUgcFileDetails<T = unknown>(options: SteamWebApiUgcFileDetailsOptions): Promise<SteamWebApiResponse<T>>;
  setUgcUsedByGc<T = unknown>(options: SteamWebApiSetUgcUsedByGcOptions): Promise<SteamWebApiResponse<T>>;
  subscribePublishedFile<T = unknown>(
    options: SteamWebApiPublishedFileUserActionOptions
  ): Promise<SteamWebApiResponse<T>>;
  unsubscribePublishedFile<T = unknown>(
    options: SteamWebApiPublishedFileUserActionOptions
  ): Promise<SteamWebApiResponse<T>>;
}

export interface SteamWebApiCloudServiceFacade {
  enumerateUserFiles<T = unknown>(options: SteamWebApiCloudEnumerateUserFilesOptions): Promise<SteamWebApiResponse<T>>;
  beginAppUploadBatch<T = unknown>(
    options: SteamWebApiCloudBeginAppUploadBatchOptions
  ): Promise<SteamWebApiResponse<T>>;
  completeAppUploadBatch<T = unknown>(
    options: SteamWebApiCloudCompleteAppUploadBatchOptions
  ): Promise<SteamWebApiResponse<T>>;
  beginHttpUpload<T = unknown>(options: SteamWebApiCloudBeginHttpUploadOptions): Promise<SteamWebApiResponse<T>>;
  commitHttpUpload<T = unknown>(options: SteamWebApiCloudCommitHttpUploadOptions): Promise<SteamWebApiResponse<T>>;
  deleteFile<T = unknown>(options: SteamWebApiCloudDeleteFileOptions): Promise<SteamWebApiResponse<T>>;
}

export interface SteamWebApiCloudEndpointOptions extends Omit<SteamWebApiEndpointOptions, "key"> {
  accessToken: string;
  appId: number;
}

export interface SteamWebApiCloudEnumerateUserFilesOptions extends SteamWebApiCloudEndpointOptions {
  extendedDetails?: boolean;
  count?: number;
  startIndex?: number;
}

export interface SteamWebApiCloudBeginAppUploadBatchOptions extends SteamWebApiCloudEndpointOptions {
  machineName: string;
  filesToUpload: readonly string[];
  filesToDelete: readonly string[];
}

export interface SteamWebApiCloudCompleteAppUploadBatchOptions extends SteamWebApiCloudEndpointOptions {
  batchId: bigint | number | string;
  batchEResult: number;
}

export interface SteamWebApiCloudBeginHttpUploadOptions extends SteamWebApiCloudEndpointOptions {
  fileSize: number;
  fileName: string;
  fileSha: string;
  platformsToSync: readonly string[];
  uploadBatchId: bigint | number | string;
  isPublic?: boolean;
}

export interface SteamWebApiCloudCommitHttpUploadOptions extends SteamWebApiCloudEndpointOptions {
  transferSucceeded: boolean;
  fileName: string;
  fileSha: string;
}

export interface SteamWebApiCloudDeleteFileOptions extends SteamWebApiCloudEndpointOptions {
  fileName: string;
}

export interface SteamWebApiHelpRequestLogsServiceFacade {
  uploadUserApplicationLog<T = unknown>(
    options: SteamWebApiUploadUserApplicationLogOptions
  ): Promise<SteamWebApiResponse<T>>;
  getApplicationLogDemand<T = unknown>(
    options: SteamWebApiApplicationLogDemandOptions
  ): Promise<SteamWebApiResponse<T>>;
}

export interface SteamWebApiUploadUserApplicationLogOptions extends SteamWebApiEndpointOptions {
  appId: number;
  logType: string;
  versionString: string;
  logContents: string;
  requestId: bigint | number | string;
}

export interface SteamWebApiApplicationLogDemandOptions extends SteamWebApiEndpointOptions {
  appId: number;
}

export interface SteamWebApiBroadcastServiceFacade {
  postGameDataFrame<T = unknown>(
    options: SteamWebApiBroadcastPostGameDataFrameOptions
  ): Promise<SteamWebApiResponse<T>>;
  postGameDataFrameRtmp<T = unknown>(
    options: SteamWebApiBroadcastPostGameDataFrameRtmpOptions
  ): Promise<SteamWebApiResponse<T>>;
}

export interface SteamWebApiBroadcastPostGameDataFrameOptions extends SteamWebApiEndpointOptions {
  appId: number;
  steamId64: bigint | number | string;
  broadcastId: bigint | number | string;
  frameData: string;
}

export interface SteamWebApiBroadcastPostGameDataFrameRtmpOptions extends SteamWebApiEndpointOptions {
  appId: number;
  steamId64: bigint | number | string;
  rtmpToken: string;
  frameData: string;
}

export interface SteamWebApiClientStats1046930Facade {
  reportEvent<T = unknown>(options?: SteamWebApiEndpointOptions | null): Promise<SteamWebApiResponse<T>>;
}

export interface SteamWebApiCheatReportingServiceFacade {
  reportPlayerCheating<T = unknown>(
    options: SteamWebApiReportPlayerCheatingOptions
  ): Promise<SteamWebApiResponse<T>>;
  requestPlayerGameBan<T = unknown>(
    options: SteamWebApiRequestPlayerGameBanOptions
  ): Promise<SteamWebApiResponse<T>>;
  removePlayerGameBan<T = unknown>(
    options: SteamWebApiCheatReportingPlayerOptions
  ): Promise<SteamWebApiResponse<T>>;
  getCheatingReports<T = unknown>(
    options: SteamWebApiGetCheatingReportsOptions
  ): Promise<SteamWebApiResponse<T>>;
  requestVacStatusForUser<T = unknown>(
    options: SteamWebApiRequestVacStatusForUserOptions
  ): Promise<SteamWebApiResponse<T>>;
  startSecureMultiplayerSession<T = unknown>(
    options: SteamWebApiCheatReportingPlayerOptions
  ): Promise<SteamWebApiResponse<T>>;
  endSecureMultiplayerSession<T = unknown>(
    options: SteamWebApiEndSecureMultiplayerSessionOptions
  ): Promise<SteamWebApiResponse<T>>;
}

export interface SteamWebApiCheatReportingPlayerOptions extends SteamWebApiEndpointOptions {
  steamId64: bigint | number | string;
  appId: number;
}

export interface SteamWebApiReportPlayerCheatingOptions extends SteamWebApiCheatReportingPlayerOptions {
  reporterSteamId64?: bigint | number | string;
  appData?: bigint | number | string;
  heuristic?: boolean;
  detection?: boolean;
  playerReport?: boolean;
  noReportId?: boolean;
  gameMode?: number;
  suspicionStartTime?: number;
  severity?: number;
}

export interface SteamWebApiRequestPlayerGameBanOptions extends SteamWebApiCheatReportingPlayerOptions {
  reportId: bigint | number | string;
  cheatDescription: string;
  duration: number;
  delayBan: boolean;
  flags: number;
}

export interface SteamWebApiGetCheatingReportsOptions extends SteamWebApiEndpointOptions {
  appId: number;
  timeEnd: number;
  timeBegin: number;
  reportIdMin: bigint | number | string;
  includeReports?: boolean;
  includeBans?: boolean;
  steamId64?: bigint | number | string;
}

export interface SteamWebApiRequestVacStatusForUserOptions extends SteamWebApiCheatReportingPlayerOptions {
  sessionId?: bigint | number | string;
}

export interface SteamWebApiEndSecureMultiplayerSessionOptions extends SteamWebApiCheatReportingPlayerOptions {
  sessionId: bigint | number | string;
}

export interface SteamWebApiRemoteStorageUserAppOptions extends SteamWebApiEndpointOptions {
  steamId64: bigint | number | string;
  appId: number;
  listType?: number;
}

export interface SteamWebApiUgcFileDetailsOptions extends SteamWebApiEndpointOptions {
  ugcId: bigint | number | string;
  appId: number;
  steamId64?: bigint | number | string;
}

export interface SteamWebApiSetUgcUsedByGcOptions extends SteamWebApiEndpointOptions {
  steamId64: bigint | number | string;
  ugcId: bigint | number | string;
  appId: number;
  used: boolean;
}

export interface SteamWebApiPublishedFileUserActionOptions extends SteamWebApiEndpointOptions {
  steamId64: bigint | number | string;
  appId: number;
  publishedFileId: bigint | number | string;
}

export interface SteamWebApiEconomyFacade {
  canTrade<T = unknown>(options: SteamWebApiCanTradeOptions): Promise<SteamWebApiResponse<T>>;
  finalizeAssetTransaction<T = unknown>(
    options: SteamWebApiFinalizeAssetTransactionOptions
  ): Promise<SteamWebApiResponse<T>>;
  getAssetClassInfo<T = unknown>(options: SteamWebApiAssetClassInfoOptions): Promise<SteamWebApiResponse<T>>;
  getAssetPrices<T = unknown>(options: SteamWebApiAssetPricesOptions): Promise<SteamWebApiResponse<T>>;
  getExportedAssetsForUser<T = unknown>(
    options: SteamWebApiExportedAssetsForUserOptions
  ): Promise<SteamWebApiResponse<T>>;
  getMarketPrices<T = unknown>(appId: number, options?: SteamWebApiEndpointOptions | null): Promise<SteamWebApiResponse<T>>;
  startAssetTransaction<T = unknown>(
    options: SteamWebApiStartAssetTransactionOptions
  ): Promise<SteamWebApiResponse<T>>;
  startTrade<T = unknown>(options: SteamWebApiStartTradeOptions): Promise<SteamWebApiResponse<T>>;
}

export interface SteamWebApiCanTradeOptions extends SteamWebApiEndpointOptions {
  appId: number;
  steamId64: bigint | number | string;
  targetSteamId64: bigint | number | string;
}

export interface SteamWebApiFinalizeAssetTransactionOptions extends SteamWebApiEndpointOptions {
  appId: number;
  steamId64: bigint | number | string;
  transactionId: bigint | number | string;
  language: string;
}

export interface SteamWebApiAssetClassInfoOptions extends SteamWebApiEndpointOptions {
  appId: number;
  classes: SteamWebApiAssetClassRequest[];
  language?: string;
}

export interface SteamWebApiAssetClassRequest {
  classId: bigint | number | string;
  instanceId?: bigint | number | string;
}

export interface SteamWebApiAssetPricesOptions extends SteamWebApiEndpointOptions {
  appId: number;
  currency?: string;
  language?: string;
}

export interface SteamWebApiExportedAssetsForUserOptions extends SteamWebApiEndpointOptions {
  steamId64: bigint | number | string;
  appId: number;
  contextId: bigint | number | string;
}

export interface SteamWebApiStartAssetTransactionOptions extends SteamWebApiEndpointOptions {
  appId: number;
  steamId64: bigint | number | string;
  assets: SteamWebApiAssetPurchase[];
  currency: string;
  language: string;
  ipAddress: string;
  referrer?: string;
  clientAuth?: boolean;
}

export interface SteamWebApiAssetPurchase {
  assetId: bigint | number | string;
  quantity: number;
}

export interface SteamWebApiStartTradeOptions extends SteamWebApiEndpointOptions {
  appId: number;
  partyA: bigint | number | string;
  partyB: bigint | number | string;
}

export interface SteamWebApiEconMarketServiceFacade {
  getMarketEligibility<T = unknown>(
    options: SteamWebApiEconMarketSteamIdOptions
  ): Promise<SteamWebApiResponse<T>>;
  cancelAppListingsForUser<T = unknown>(
    options: SteamWebApiEconMarketCancelAppListingsOptions
  ): Promise<SteamWebApiResponse<T>>;
  getAssetId<T = unknown>(options: SteamWebApiEconMarketAssetIdOptions): Promise<SteamWebApiResponse<T>>;
  getPopular<T = unknown>(options: SteamWebApiEconMarketPopularOptions): Promise<SteamWebApiResponse<T>>;
}

export interface SteamWebApiEconMarketSteamIdOptions extends SteamWebApiEndpointOptions {
  steamId64: bigint | number | string;
}

export interface SteamWebApiEconMarketCancelAppListingsOptions extends SteamWebApiEconMarketSteamIdOptions {
  appId: number;
  synchronous: boolean;
}

export interface SteamWebApiEconMarketAssetIdOptions extends SteamWebApiEndpointOptions {
  appId: number;
  listingId: bigint | number | string;
}

export interface SteamWebApiEconMarketPopularOptions extends SteamWebApiEndpointOptions {
  language: string;
  start: number;
  rows?: number;
  filterAppId?: number;
  currency?: number;
}

export interface SteamWebApiEconServiceFacade {
  getTradeHistory<T = unknown>(options: SteamWebApiTradeHistoryOptions): Promise<SteamWebApiResponse<T>>;
  flushInventoryCache<T = unknown>(
    options: SteamWebApiFlushInventoryCacheOptions
  ): Promise<SteamWebApiResponse<T>>;
  flushAssetAppearanceCache<T = unknown>(
    appId: number,
    options?: SteamWebApiEndpointOptions | null
  ): Promise<SteamWebApiResponse<T>>;
  flushContextCache<T = unknown>(
    appId: number,
    options?: SteamWebApiEndpointOptions | null
  ): Promise<SteamWebApiResponse<T>>;
  getTradeOffers<T = unknown>(options: SteamWebApiTradeOffersOptions): Promise<SteamWebApiResponse<T>>;
  getTradeOffer<T = unknown>(options: SteamWebApiTradeOfferOptions): Promise<SteamWebApiResponse<T>>;
  getTradeOffersSummary<T = unknown>(
    options?: SteamWebApiTradeOffersSummaryOptions | null
  ): Promise<SteamWebApiResponse<T>>;
}

export interface SteamWebApiTradeHistoryOptions extends SteamWebApiEndpointOptions {
  maxTrades?: number;
  startAfterTime?: number;
  startAfterTradeId?: bigint | number | string;
  navigatingBack?: boolean;
  getDescriptions?: boolean;
  language?: string;
  includeFailed?: boolean;
  includeTotal?: boolean;
}

export interface SteamWebApiFlushInventoryCacheOptions extends SteamWebApiEndpointOptions {
  steamId64: bigint | number | string;
  appId: number;
  contextId: bigint | number | string;
}

export interface SteamWebApiTradeOffersOptions extends SteamWebApiEndpointOptions {
  getSentOffers?: boolean;
  getReceivedOffers?: boolean;
  getDescriptions?: boolean;
  language?: string;
  activeOnly?: boolean;
  historicalOnly?: boolean;
  timeHistoricalCutoff?: number;
}

export interface SteamWebApiTradeOfferOptions extends SteamWebApiEndpointOptions {
  tradeOfferId: bigint | number | string;
  language?: string;
}

export interface SteamWebApiTradeOffersSummaryOptions extends SteamWebApiEndpointOptions {
  timeLastVisit?: number;
}

export interface SteamWebApiGameInventoryFacade {
  getHistoryCommandDetails<T = unknown>(
    options: SteamWebApiGameInventoryHistoryCommandOptions
  ): Promise<SteamWebApiResponse<T>>;
  getUserHistory<T = unknown>(
    options: SteamWebApiGameInventoryUserHistoryOptions
  ): Promise<SteamWebApiResponse<T>>;
  historyExecuteCommands<T = unknown>(
    options: SteamWebApiGameInventoryExecuteCommandsOptions
  ): Promise<SteamWebApiResponse<T>>;
  supportGetAssetHistory<T = unknown>(
    options: SteamWebApiGameInventoryAssetHistoryOptions
  ): Promise<SteamWebApiResponse<T>>;
  updateItemDefs<T = unknown>(
    options: SteamWebApiGameInventoryUpdateItemDefsOptions
  ): Promise<SteamWebApiResponse<T>>;
}

export interface SteamWebApiGameInventoryUserContextOptions extends SteamWebApiEndpointOptions {
  appId: number;
  steamId64: bigint | number | string;
  contextId: bigint | number | string;
}

export interface SteamWebApiGameInventoryHistoryCommandOptions extends SteamWebApiGameInventoryUserContextOptions {
  command: string;
  commandArguments: string;
}

export interface SteamWebApiGameInventoryUserHistoryOptions extends SteamWebApiGameInventoryUserContextOptions {
  startTime: number;
  endTime: number;
}

export interface SteamWebApiGameInventoryExecuteCommandsOptions extends SteamWebApiGameInventoryUserContextOptions {
  actorId: number;
}

export interface SteamWebApiGameInventoryAssetHistoryOptions extends SteamWebApiEndpointOptions {
  appId: number;
  assetId: bigint | number | string;
  contextId: bigint | number | string;
}

export interface SteamWebApiGameInventoryUpdateItemDefsOptions extends SteamWebApiEndpointOptions {
  appId: number;
  itemDefs: readonly SteamWebApiInputJsonValue[];
}

export interface SteamWebApiInventoryServiceFacade {
  addItem<T = unknown>(options: SteamWebApiInventoryAddItemOptions): Promise<SteamWebApiResponse<T>>;
  addPromoItem<T = unknown>(options: SteamWebApiInventoryAddPromoItemOptions): Promise<SteamWebApiResponse<T>>;
  consumeItem<T = unknown>(options: SteamWebApiInventoryConsumeItemOptions): Promise<SteamWebApiResponse<T>>;
  exchangeItem<T = unknown>(options: SteamWebApiInventoryExchangeItemOptions): Promise<SteamWebApiResponse<T>>;
  getInventory<T = unknown>(options: SteamWebApiInventoryUserAppOptions): Promise<SteamWebApiResponse<T>>;
  getItemDefs<T = unknown>(options: SteamWebApiInventoryItemDefsOptions): Promise<SteamWebApiResponse<T>>;
  getPriceSheet<T = unknown>(currency: number, options?: SteamWebApiEndpointOptions | null): Promise<SteamWebApiResponse<T>>;
  consolidate<T = unknown>(options: SteamWebApiInventoryConsolidateOptions): Promise<SteamWebApiResponse<T>>;
  getQuantity<T = unknown>(options: SteamWebApiInventoryQuantityOptions): Promise<SteamWebApiResponse<T>>;
  modifyItems<T = unknown>(options: SteamWebApiInventoryModifyItemsOptions): Promise<SteamWebApiResponse<T>>;
}

export interface SteamWebApiInventoryUserAppOptions extends SteamWebApiEndpointOptions {
  appId: number;
  steamId64: bigint | number | string;
}

export interface SteamWebApiInventoryAddItemOptions extends SteamWebApiInventoryUserAppOptions {
  itemDefIds: Array<bigint | number | string>;
  itemPropsJson?: string;
  notify?: boolean;
  requestId?: bigint | number | string;
  tradeRestriction?: boolean;
}

export interface SteamWebApiInventoryAddPromoItemOptions extends SteamWebApiInventoryUserAppOptions {
  itemDefId?: bigint | number | string;
  notify?: boolean;
  requestId?: bigint | number | string;
}

export interface SteamWebApiInventoryConsumeItemOptions extends SteamWebApiInventoryUserAppOptions {
  itemId: bigint | number | string;
  quantity: bigint | number | string;
  requestId?: bigint | number | string;
}

export interface SteamWebApiInventoryExchangeItemOptions extends SteamWebApiInventoryUserAppOptions {
  materials: SteamWebApiInventoryExchangeMaterial[];
  outputItemDefId: bigint | number | string;
}

export interface SteamWebApiInventoryExchangeMaterial {
  itemId: bigint | number | string;
  quantity: number;
}

export interface SteamWebApiInventoryItemDefsOptions extends SteamWebApiEndpointOptions {
  appId: number;
  modifiedSince?: string;
  itemDefIds?: Array<bigint | number | string>;
  workshopIds?: Array<bigint | number | string>;
  cacheMaxAgeSeconds?: number;
}

export interface SteamWebApiInventoryConsolidateOptions extends SteamWebApiInventoryUserAppOptions {
  itemDefIds: Array<bigint | number | string>;
  force?: boolean;
}

export interface SteamWebApiInventoryQuantityOptions extends SteamWebApiInventoryConsolidateOptions {}

export interface SteamWebApiInventoryModifyItemsOptions extends SteamWebApiInventoryUserAppOptions {
  timestamp: number;
  updates: SteamWebApiInventoryItemPropertyUpdate[];
}

export interface SteamWebApiInventoryItemPropertyUpdate {
  itemId: bigint | number | string;
  propertyName: string;
  propertyValueString?: string;
  propertyValueBool?: boolean;
  propertyValueInt?: bigint | number | string;
  propertyValueFloat?: number | string;
  removeProperty?: boolean;
}

export interface SteamWebApiGameNotificationsServiceFacade {
  createSession<T = unknown>(
    options: SteamWebApiGameNotificationsCreateSessionOptions
  ): Promise<SteamWebApiResponse<T>>;
  userCreateSession<T = unknown>(
    options: SteamWebApiGameNotificationsCreateSessionOptions
  ): Promise<SteamWebApiResponse<T>>;
  updateSession<T = unknown>(
    options: SteamWebApiGameNotificationsUpdateSessionOptions
  ): Promise<SteamWebApiResponse<T>>;
  userUpdateSession<T = unknown>(
    options: SteamWebApiGameNotificationsUpdateSessionOptions
  ): Promise<SteamWebApiResponse<T>>;
  enumerateSessionsForApp<T = unknown>(
    options: SteamWebApiGameNotificationsEnumerateSessionsOptions
  ): Promise<SteamWebApiResponse<T>>;
  getSessionDetailsForApp<T = unknown>(
    options: SteamWebApiGameNotificationsSessionDetailsOptions
  ): Promise<SteamWebApiResponse<T>>;
  requestNotifications<T = unknown>(
    options: SteamWebApiGameNotificationsUserAppOptions
  ): Promise<SteamWebApiResponse<T>>;
  deleteSession<T = unknown>(
    options: SteamWebApiGameNotificationsDeleteSessionOptions
  ): Promise<SteamWebApiResponse<T>>;
  userDeleteSession<T = unknown>(
    options: SteamWebApiGameNotificationsDeleteSessionOptions
  ): Promise<SteamWebApiResponse<T>>;
  deleteSessionBatch<T = unknown>(
    options: SteamWebApiGameNotificationsDeleteSessionBatchOptions
  ): Promise<SteamWebApiResponse<T>>;
}

export interface SteamWebApiGameNotificationsLocalizedText {
  token: string;
  variables?: SteamWebApiGameNotificationsLocalizedTextVariable[];
}

export interface SteamWebApiGameNotificationsLocalizedTextVariable {
  key: string;
  value: bigint | number | string | boolean;
}

export interface SteamWebApiGameNotificationsUserState {
  steamId64: bigint | number | string;
  state: string;
  title?: SteamWebApiGameNotificationsLocalizedText;
  message?: SteamWebApiGameNotificationsLocalizedText;
}

export interface SteamWebApiGameNotificationsCreateSessionOptions extends SteamWebApiEndpointOptions {
  appId: number;
  context: bigint | number | string;
  title: SteamWebApiGameNotificationsLocalizedText;
  users: SteamWebApiGameNotificationsUserState[];
  steamId64?: bigint | number | string;
}

export interface SteamWebApiGameNotificationsUpdateSessionOptions extends SteamWebApiEndpointOptions {
  sessionId: bigint | number | string;
  appId: number;
  title?: SteamWebApiGameNotificationsLocalizedText;
  users?: SteamWebApiGameNotificationsUserState[];
  steamId64?: bigint | number | string;
}

export interface SteamWebApiGameNotificationsEnumerateSessionsOptions extends SteamWebApiEndpointOptions {
  steamId64: bigint | number | string;
  appId?: number;
  includeAllUserMessages?: boolean;
  includeAuthUserMessage?: boolean;
  language?: string;
}

export interface SteamWebApiGameNotificationsSessionDetailsOptions extends SteamWebApiEndpointOptions {
  appId: number;
  sessions: SteamWebApiGameNotificationsSessionDetailsRequest[];
  language: string;
}

export interface SteamWebApiGameNotificationsSessionDetailsRequest {
  sessionId: bigint | number | string;
  includeAllUserMessages?: boolean;
  includeAuthUserMessage?: boolean;
}

export interface SteamWebApiGameNotificationsUserAppOptions extends SteamWebApiEndpointOptions {
  appId: number;
  steamId64: bigint | number | string;
}

export interface SteamWebApiGameNotificationsDeleteSessionOptions extends SteamWebApiEndpointOptions {
  sessionId: bigint | number | string;
  appId: number;
  steamId64?: bigint | number | string;
}

export interface SteamWebApiGameNotificationsDeleteSessionBatchOptions extends SteamWebApiEndpointOptions {
  sessionIds: Array<bigint | number | string>;
  appId: number;
}

export interface SteamWebApiGameServersServiceFacade {
  getAccountList<T = unknown>(options?: SteamWebApiEndpointOptions | null): Promise<SteamWebApiResponse<T>>;
  createAccount<T = unknown>(options: SteamWebApiGameServersCreateAccountOptions): Promise<SteamWebApiResponse<T>>;
  setMemo<T = unknown>(options: SteamWebApiGameServersSetMemoOptions): Promise<SteamWebApiResponse<T>>;
  resetLoginToken<T = unknown>(options: SteamWebApiGameServersSteamIdOptions): Promise<SteamWebApiResponse<T>>;
  deleteAccount<T = unknown>(options: SteamWebApiGameServersSteamIdOptions): Promise<SteamWebApiResponse<T>>;
  getAccountPublicInfo<T = unknown>(
    steamId64: bigint | number | string,
    options?: SteamWebApiEndpointOptions | null
  ): Promise<SteamWebApiResponse<T>>;
  queryLoginToken<T = unknown>(
    loginToken: string,
    options?: SteamWebApiEndpointOptions | null
  ): Promise<SteamWebApiResponse<T>>;
  getServerSteamIdsByIp<T = unknown>(
    serverIps: string | string[],
    options?: SteamWebApiEndpointOptions | null
  ): Promise<SteamWebApiResponse<T>>;
  getServerIpsBySteamId<T = unknown>(
    serverSteamIds: Array<bigint | number | string>,
    options?: SteamWebApiEndpointOptions | null
  ): Promise<SteamWebApiResponse<T>>;
}

export interface SteamWebApiGameCoordinatorVersionFacade {
  app1046930: SteamWebApiGameCoordinatorVersionClientServerFacade;
  app1269260: SteamWebApiGameCoordinatorVersionClientServerFacade;
  app1422450: SteamWebApiGameCoordinatorVersionClientServerFacade;
  teamFortress2: SteamWebApiGameCoordinatorVersionClientServerFacade;
  dota2: SteamWebApiGameCoordinatorVersionClientServerFacade;
  app583950: SteamWebApiGameCoordinatorVersionClientServerFacade;
  counterStrike2: SteamWebApiGameCoordinatorVersionServerFacade;
}

export interface SteamWebApiGameCoordinatorVersionClientServerFacade
  extends SteamWebApiGameCoordinatorVersionServerFacade {
  getClientVersion<T = unknown>(options?: SteamWebApiEndpointOptions | null): Promise<SteamWebApiResponse<T>>;
}

export interface SteamWebApiGameCoordinatorVersionServerFacade {
  getServerVersion<T = unknown>(options?: SteamWebApiEndpointOptions | null): Promise<SteamWebApiResponse<T>>;
}

export interface SteamWebApiGameServersCreateAccountOptions extends SteamWebApiEndpointOptions {
  appId: number;
  memo: string;
}

export interface SteamWebApiGameServersSteamIdOptions extends SteamWebApiEndpointOptions {
  steamId64: bigint | number | string;
}

export interface SteamWebApiGameServersSetMemoOptions extends SteamWebApiGameServersSteamIdOptions {
  memo: string;
}

export interface SteamWebApiGameServerStatsFacade {
  getGameServerPlayerStatsForGame<T = unknown>(
    options: SteamWebApiGameServerPlayerStatsForGameOptions
  ): Promise<SteamWebApiResponse<T>>;
}

export interface SteamWebApiGameServerPlayerStatsForGameOptions extends SteamWebApiEndpointOptions {
  gameId: bigint | number | string;
  appId: number;
  rangeStart: string;
  rangeEnd: string;
  maxResults?: number;
}

export interface SteamWebApiLeaderboardsFacade {
  deleteLeaderboard<T = unknown>(options: SteamWebApiDeleteLeaderboardOptions): Promise<SteamWebApiResponse<T>>;
  deleteLeaderboardScore<T = unknown>(
    options: SteamWebApiLeaderboardSteamIdOptions
  ): Promise<SteamWebApiResponse<T>>;
  findOrCreateLeaderboard<T = unknown>(
    options: SteamWebApiFindOrCreateLeaderboardOptions
  ): Promise<SteamWebApiResponse<T>>;
  getLeaderboardEntries<T = unknown>(
    options: SteamWebApiLeaderboardEntriesOptions
  ): Promise<SteamWebApiResponse<T>>;
  getLeaderboardsForGame<T = unknown>(
    appId: number,
    options?: SteamWebApiEndpointOptions | null
  ): Promise<SteamWebApiResponse<T>>;
  resetLeaderboard<T = unknown>(options: SteamWebApiLeaderboardIdOptions): Promise<SteamWebApiResponse<T>>;
  setLeaderboardScore<T = unknown>(
    options: SteamWebApiSetLeaderboardScoreOptions
  ): Promise<SteamWebApiResponse<T>>;
}

export interface SteamWebApiPortal2LeaderboardsFacade {
  getBucketizedData<T = unknown>(
    leaderboardName: string,
    options?: SteamWebApiEndpointOptions | null
  ): Promise<SteamWebApiResponse<T>>;
}

export interface SteamWebApiDeleteLeaderboardOptions extends SteamWebApiEndpointOptions {
  appId: number;
  name: string;
}

export interface SteamWebApiLeaderboardIdOptions extends SteamWebApiEndpointOptions {
  appId: number;
  leaderboardId: bigint | number | string;
}

export interface SteamWebApiLeaderboardSteamIdOptions extends SteamWebApiLeaderboardIdOptions {
  steamId64: bigint | number | string;
}

export interface SteamWebApiFindOrCreateLeaderboardOptions extends SteamWebApiEndpointOptions {
  appId: number;
  name: string;
  sortMethod?: number;
  displayType?: number;
  createIfNotFound?: boolean;
  onlyTrustedWrites?: boolean;
  onlyFriendsReads?: boolean;
}

export interface SteamWebApiLeaderboardEntriesOptions extends SteamWebApiLeaderboardIdOptions {
  rangeStart: number;
  rangeEnd: number;
  dataRequest: number;
  steamId64?: bigint | number | string;
}

export interface SteamWebApiSetLeaderboardScoreOptions extends SteamWebApiLeaderboardSteamIdOptions {
  score: number;
  scoreMethod?: number;
  details?: SteamWebApiBinaryValue;
}

export interface SteamWebApiPublishedFileServiceFacade {
  deleteFile<T = unknown>(options: SteamWebApiPublishedFileAppOptions): Promise<SteamWebApiResponse<T>>;
  queryFiles<T = unknown>(options: SteamWebApiPublishedFileQueryOptions): Promise<SteamWebApiResponse<T>>;
  getUserVoteSummary<T = unknown>(
    options: SteamWebApiPublishedFileUserVoteSummaryOptions
  ): Promise<SteamWebApiResponse<T>>;
  setDeveloperMetadata<T = unknown>(
    options: SteamWebApiPublishedFileDeveloperMetadataOptions
  ): Promise<SteamWebApiResponse<T>>;
  updateAppUgcBan<T = unknown>(options: SteamWebApiPublishedFileAppUgcBanOptions): Promise<SteamWebApiResponse<T>>;
  updateBanStatus<T = unknown>(options: SteamWebApiPublishedFileBanStatusOptions): Promise<SteamWebApiResponse<T>>;
  updateIncompatibleStatus<T = unknown>(
    options: SteamWebApiPublishedFileIncompatibleStatusOptions
  ): Promise<SteamWebApiResponse<T>>;
  updateTags<T = unknown>(options: SteamWebApiPublishedFileTagsOptions): Promise<SteamWebApiResponse<T>>;
}

export interface SteamWebApiPublishedFileAppOptions extends SteamWebApiEndpointOptions {
  publishedFileId: bigint | number | string;
  appId: number;
}

export interface SteamWebApiPublishedFileKeyValueTag {
  key: string;
  value: string;
}

export interface SteamWebApiPublishedFileQueryOptions extends SteamWebApiEndpointOptions {
  queryType: number;
  page?: number;
  cursor?: string;
  numPerPage?: number;
  creatorAppId?: number;
  appId?: number;
  requiredTags?: string | string[];
  excludedTags?: string | string[];
  matchAllTags?: boolean;
  requiredFlags?: string;
  omittedFlags?: string;
  searchText?: string;
  fileType?: number;
  childPublishedFileId?: bigint | number | string;
  days?: number;
  includeRecentVotesOnly?: boolean;
  cacheMaxAgeSeconds?: number;
  language?: number;
  requiredKeyValueTags?: Record<string, string> | SteamWebApiPublishedFileKeyValueTag[];
  totalOnly?: boolean;
  idsOnly?: boolean;
  returnVoteData?: boolean;
  returnTags?: boolean;
  returnKeyValueTags?: boolean;
  returnPreviews?: boolean;
  returnChildren?: boolean;
  returnShortDescription?: boolean;
  returnForSaleData?: boolean;
  returnMetadata?: boolean;
  returnPlaytimeStats?: number;
}

export interface SteamWebApiPublishedFileDeveloperMetadataOptions extends SteamWebApiPublishedFileAppOptions {
  metadata: string;
}

export interface SteamWebApiPublishedFileUserVoteSummaryOptions extends SteamWebApiEndpointOptions {
  publishedFileIds: Array<bigint | number | string>;
}

export interface SteamWebApiPublishedFileAppUgcBanOptions extends SteamWebApiEndpointOptions {
  steamId64: bigint | number | string;
  appId: number;
  expirationTime: number;
  reason?: string;
}

export interface SteamWebApiPublishedFileBanStatusOptions extends SteamWebApiPublishedFileAppOptions {
  banned: boolean;
  reason: string;
}

export interface SteamWebApiPublishedFileIncompatibleStatusOptions extends SteamWebApiPublishedFileAppOptions {
  incompatible: boolean;
}

export interface SteamWebApiPublishedFileTagsOptions extends SteamWebApiPublishedFileAppOptions {
  addTags?: string[];
  removeTags?: string[];
}

export interface SteamWebApiPublishedItemSearchFacade {
  rankedByPublicationOrder<T = unknown>(
    options: SteamWebApiPublishedItemSearchOptions
  ): Promise<SteamWebApiResponse<T>>;
  rankedByTrend<T = unknown>(
    options: SteamWebApiPublishedItemSearchTrendOptions
  ): Promise<SteamWebApiResponse<T>>;
  rankedByVote<T = unknown>(options: SteamWebApiPublishedItemSearchOptions): Promise<SteamWebApiResponse<T>>;
  resultSetSummary<T = unknown>(
    options: SteamWebApiPublishedItemSearchSummaryOptions
  ): Promise<SteamWebApiResponse<T>>;
}

export interface SteamWebApiPublishedItemSearchBaseOptions extends SteamWebApiEndpointOptions {
  steamId64: bigint | number | string;
  appId: bigint | number | string;
  tags?: string[];
  userTags?: string[];
  hasAppAdminAccess?: boolean;
  fileType?: number;
}

export interface SteamWebApiPublishedItemSearchOptions extends SteamWebApiPublishedItemSearchBaseOptions {
  appId: number;
  startIndex: number;
  count: number;
}

export interface SteamWebApiPublishedItemSearchTrendOptions extends SteamWebApiPublishedItemSearchOptions {
  days?: number;
}

export interface SteamWebApiPublishedItemSearchSummaryOptions extends SteamWebApiPublishedItemSearchBaseOptions {}

export interface SteamWebApiPublishedItemVotingFacade {
  itemVoteSummary<T = unknown>(options: SteamWebApiItemVoteSummaryOptions): Promise<SteamWebApiResponse<T>>;
  userVoteSummary<T = unknown>(options: SteamWebApiUserVoteSummaryOptions): Promise<SteamWebApiResponse<T>>;
}

export interface SteamWebApiPublishedItemIdsOptions extends SteamWebApiEndpointOptions {
  steamId64: bigint | number | string;
  publishedFileIds: Array<bigint | number | string>;
}

export interface SteamWebApiItemVoteSummaryOptions extends SteamWebApiPublishedItemIdsOptions {
  appId: number;
}

export interface SteamWebApiUserVoteSummaryOptions extends SteamWebApiPublishedItemIdsOptions {}

export interface SteamWebApiWishlistServiceFacade {
  getWishlistSortedFiltered<T = unknown>(
    options: SteamWebApiWishlistSortedFilteredOptions
  ): Promise<SteamWebApiResponse<T>>;
  getWishlist<T = unknown>(
    steamId64: bigint | number | string,
    options?: SteamWebApiEndpointOptions | null
  ): Promise<SteamWebApiResponse<T>>;
  getWishlistItemCount<T = unknown>(
    steamId64: bigint | number | string,
    options?: SteamWebApiEndpointOptions | null
  ): Promise<SteamWebApiResponse<T>>;
}

export interface SteamWebApiWishlistSortedFilteredOptions extends SteamWebApiEndpointOptions {
  steamId64: bigint | number | string;
  context: SteamWebApiInputJsonValue;
  dataRequest: SteamWebApiInputJsonValue;
  filters: SteamWebApiInputJsonValue;
  sortOrder?: string | number;
  startIndex?: number;
  pageSize?: number;
  shareToken: string;
}

export interface SteamWebApiWorkshopServiceFacade {
  setItemPaymentRules<T = unknown>(
    options: SteamWebApiWorkshopSetItemPaymentRulesOptions
  ): Promise<SteamWebApiResponse<T>>;
  getFinalizedContributors<T = unknown>(
    options: SteamWebApiWorkshopGameItemOptions
  ): Promise<SteamWebApiResponse<T>>;
  getItemDailyRevenue<T = unknown>(
    options: SteamWebApiWorkshopItemDailyRevenueOptions
  ): Promise<SteamWebApiResponse<T>>;
  populateItemDescriptions<T = unknown>(
    options: SteamWebApiWorkshopPopulateItemDescriptionsOptions
  ): Promise<SteamWebApiResponse<T>>;
}

export interface SteamWebApiWorkshopGameItemOptions extends SteamWebApiEndpointOptions {
  appId: number;
  gameItemId: bigint | number | string;
}

export interface SteamWebApiWorkshopSetItemPaymentRulesOptions extends SteamWebApiWorkshopGameItemOptions {
  associatedWorkshopFiles: SteamWebApiInputJsonValue;
  partnerAccounts: SteamWebApiInputJsonValue;
  validateOnly?: boolean;
  makeWorkshopFilesSubscribable: boolean;
}

export interface SteamWebApiWorkshopItemDailyRevenueOptions extends SteamWebApiEndpointOptions {
  appId: number;
  itemId: bigint | number | string;
  dateStart: number;
  dateEnd: number;
}

export interface SteamWebApiWorkshopPopulateItemDescriptionsOptions extends SteamWebApiEndpointOptions {
  appId: number;
  languages: SteamWebApiInputJsonValue;
}

export interface SteamWebApiUserAuthFacade {
  authenticateUser<T = unknown>(options: SteamWebApiAuthenticateUserOptions): Promise<SteamWebApiResponse<T>>;
  authenticateUserTicket<T = unknown>(
    options: SteamWebApiAuthenticateUserTicketOptions
  ): Promise<SteamWebApiResponse<T>>;
}

export type SteamWebApiBinaryValue = string | Buffer | Uint8Array;

export interface SteamWebApiAuthenticateUserOptions extends SteamWebApiEndpointOptions {
  steamId64: bigint | number | string;
  sessionKey: SteamWebApiBinaryValue;
  encryptedLoginKey: SteamWebApiBinaryValue;
}

export interface SteamWebApiAuthenticateUserTicketOptions extends SteamWebApiEndpointOptions {
  appId: number;
  ticket: SteamWebApiBinaryValue;
  identity?: string;
}

export interface SteamWebApiUserOAuthFacade {
  getTokenDetails<T = unknown>(
    accessToken: string,
    options?: SteamWebApiOAuthEndpointOptions | null
  ): Promise<SteamWebApiResponse<T>>;
}

export interface SteamWebApiCommunityFacade {
  reportAbuse<T = unknown>(options: SteamWebApiReportAbuseOptions): Promise<SteamWebApiResponse<T>>;
}

export interface SteamWebApiReportAbuseOptions extends SteamWebApiEndpointOptions {
  actorSteamId64: bigint | number | string;
  targetSteamId64: bigint | number | string;
  appId: number;
  abuseType: number;
  contentType: number;
  description: string;
  gid?: bigint | number | string;
}

export interface SteamWebApiUtilFacade {
  getServerInfo<T = unknown>(options?: SteamWebApiEndpointOptions | null): Promise<SteamWebApiResponse<T>>;
  getSupportedApiList<T = unknown>(options?: SteamWebApiEndpointOptions | null): Promise<SteamWebApiResponse<T>>;
}

export interface SteamWebApiUserStatsFacade {
  getGlobalAchievementPercentagesForApp<T = unknown>(
    gameId: bigint | number | string,
    options?: SteamWebApiEndpointOptions | null
  ): Promise<SteamWebApiResponse<T>>;
  getGlobalStatsForGame<T = unknown>(
    options: SteamWebApiGlobalStatsForGameOptions
  ): Promise<SteamWebApiResponse<T>>;
  getNumberOfCurrentPlayers<T = unknown>(
    appId: number,
    options?: SteamWebApiEndpointOptions | null
  ): Promise<SteamWebApiResponse<T>>;
  getPlayerAchievements<T = unknown>(
    options: SteamWebApiPlayerAchievementsOptions
  ): Promise<SteamWebApiResponse<T>>;
  getSchemaForGame<T = unknown>(options: SteamWebApiGameSchemaOptions): Promise<SteamWebApiResponse<T>>;
  getUserStatsForGame<T = unknown>(options: SteamWebApiUserStatsForGameOptions): Promise<SteamWebApiResponse<T>>;
  setUserStatsForGame<T = unknown>(options: SteamWebApiSetUserStatsForGameOptions): Promise<SteamWebApiResponse<T>>;
}

export interface SteamWebApiGlobalStatsForGameOptions extends SteamWebApiEndpointOptions {
  appId: number;
  names: string[];
  startDate?: number;
  endDate?: number;
}

export interface SteamWebApiPlayerAchievementsOptions extends SteamWebApiEndpointOptions {
  appId: number;
  steamId64: bigint | number | string;
  language?: string;
}

export interface SteamWebApiGameSchemaOptions extends SteamWebApiEndpointOptions {
  appId: number;
  language?: string;
}

export interface SteamWebApiUserStatsForGameOptions extends SteamWebApiEndpointOptions {
  appId: number;
  steamId64: bigint | number | string;
}

export interface SteamWebApiSetUserStatsForGameOptions extends SteamWebApiEndpointOptions {
  appId: number;
  steamId64: bigint | number | string;
  stats: Record<string, SteamWebApiParamValue> | Array<{ name: string; value: SteamWebApiParamValue }>;
}

export interface SteamWebApiUserFacade {
  checkAppOwnership<T = unknown>(options: SteamWebApiCheckAppOwnershipOptions): Promise<SteamWebApiResponse<T>>;
  getAppPriceInfo<T = unknown>(options: SteamWebApiAppPriceInfoOptions): Promise<SteamWebApiResponse<T>>;
  getDeletedSteamIds<T = unknown>(options: SteamWebApiDeletedSteamIdsOptions): Promise<SteamWebApiResponse<T>>;
  getFriendList<T = unknown>(options: SteamWebApiFriendListOptions): Promise<SteamWebApiResponse<T>>;
  getPlayerBans<T = unknown>(
    steamIds: Array<bigint | number | string>,
    options?: SteamWebApiEndpointOptions | null
  ): Promise<SteamWebApiResponse<T>>;
  getPlayerSummaries<T = unknown>(
    steamIds: Array<bigint | number | string>,
    options?: SteamWebApiEndpointOptions | null
  ): Promise<SteamWebApiResponse<T>>;
  getPublisherAppOwnership<T = unknown>(
    steamId64: bigint | number | string,
    options?: SteamWebApiEndpointOptions | null
  ): Promise<SteamWebApiResponse<T>>;
  getUserGroupList<T = unknown>(
    steamId64: bigint | number | string,
    options?: SteamWebApiEndpointOptions | null
  ): Promise<SteamWebApiResponse<T>>;
  resolveVanityUrl<T = unknown>(
    vanityUrl: string,
    options?: SteamWebApiResolveVanityUrlOptions | null
  ): Promise<SteamWebApiResponse<T>>;
}

export interface SteamWebApiCheckAppOwnershipOptions extends SteamWebApiEndpointOptions {
  appId: number;
  steamId64: bigint | number | string;
}

export interface SteamWebApiAppPriceInfoOptions extends SteamWebApiEndpointOptions {
  appIds: number[];
  steamId64: bigint | number | string;
}

export interface SteamWebApiDeletedSteamIdsOptions extends SteamWebApiEndpointOptions {
  rowVersion: bigint | number | string;
}

export interface SteamWebApiFriendListOptions extends SteamWebApiEndpointOptions {
  steamId64: bigint | number | string;
  relationship?: string;
}

export interface SteamWebApiResolveVanityUrlOptions extends SteamWebApiEndpointOptions {
  urlType?: number;
}

export interface SteamWebApiMicroTxnFacade {
  adjustAgreement<T = unknown>(
    options: SteamWebApiAdjustAgreementOptions
  ): Promise<SteamWebApiResponse<T>>;
  cancelAgreement<T = unknown>(
    options: SteamWebApiAgreementOptions
  ): Promise<SteamWebApiResponse<T>>;
  finalizeTxn<T = unknown>(options: SteamWebApiFinalizeTxnOptions): Promise<SteamWebApiResponse<T>>;
  getReport<T = unknown>(options: SteamWebApiMicroTxnReportOptions): Promise<SteamWebApiResponse<T>>;
  getUserAgreementInfo<T = unknown>(
    options: SteamWebApiUserAgreementInfoOptions
  ): Promise<SteamWebApiResponse<T>>;
  getUserInfo<T = unknown>(options: SteamWebApiMicroTxnUserInfoOptions): Promise<SteamWebApiResponse<T>>;
  initClientTxn<T = unknown>(options: SteamWebApiInitTxnWithPresetSessionOptions): Promise<SteamWebApiResponse<T>>;
  initTxn<T = unknown>(options: SteamWebApiInitTxnOptions): Promise<SteamWebApiResponse<T>>;
  initWebTxn<T = unknown>(options: SteamWebApiInitTxnWithPresetSessionOptions): Promise<SteamWebApiResponse<T>>;
  processAgreement<T = unknown>(
    options: SteamWebApiProcessAgreementOptions
  ): Promise<SteamWebApiResponse<T>>;
  queryTxn<T = unknown>(options: SteamWebApiQueryTxnOptions): Promise<SteamWebApiResponse<T>>;
  refundTxn<T = unknown>(options: SteamWebApiRefundTxnOptions): Promise<SteamWebApiResponse<T>>;
}

export interface SteamWebApiMicroTxnBaseOptions extends SteamWebApiEndpointOptions {
  appId: number;
}

export interface SteamWebApiAgreementOptions extends SteamWebApiMicroTxnBaseOptions {
  steamId64: bigint | number | string;
  agreementId: bigint | number | string;
}

export interface SteamWebApiAdjustAgreementOptions extends SteamWebApiAgreementOptions {
  nextProcessDate: string;
  oldNextProcessDate?: string;
}

export interface SteamWebApiFinalizeTxnOptions extends SteamWebApiMicroTxnBaseOptions {
  orderId: bigint | number | string;
}

export interface SteamWebApiMicroTxnReportOptions extends SteamWebApiMicroTxnBaseOptions {
  type?: string;
  time?: string;
  maxResults?: number;
}

export interface SteamWebApiUserAgreementInfoOptions extends SteamWebApiMicroTxnBaseOptions {
  steamId64: bigint | number | string;
}

export interface SteamWebApiMicroTxnUserInfoOptions extends SteamWebApiMicroTxnBaseOptions {
  steamId64?: bigint | number | string;
  ipAddress?: string;
}

export type SteamWebApiMicroTxnUserSession = "client" | "web" | (string & {});
export type SteamWebApiInitTxnWithPresetSessionOptions = Omit<SteamWebApiInitTxnOptions, "userSession">;

export interface SteamWebApiInitTxnOptions extends SteamWebApiMicroTxnBaseOptions {
  orderId: bigint | number | string;
  steamId64: bigint | number | string;
  language: string;
  currency: string;
  userSession?: SteamWebApiMicroTxnUserSession;
  ipAddress?: string;
  items: SteamWebApiMicroTxnItem[];
  bundles?: SteamWebApiMicroTxnBundle[];
}

export interface SteamWebApiMicroTxnItem {
  itemId: bigint | number | string;
  quantity: number;
  amount: bigint | number | string;
  description: string;
  category?: string;
  associatedBundle?: number;
  billingType?: string;
  period?: string;
  frequency?: number;
  recurringAmount?: bigint | number | string;
}

export interface SteamWebApiMicroTxnBundle {
  bundleId: bigint | number | string;
  quantity: number;
  description: string;
  category?: string;
}

export interface SteamWebApiProcessAgreementOptions extends SteamWebApiAgreementOptions {
  orderId: bigint | number | string;
  amount: number;
  currency: string;
}

export interface SteamWebApiQueryTxnOptions extends SteamWebApiMicroTxnBaseOptions {
  orderId?: bigint | number | string;
  transactionId?: bigint | number | string;
}

export interface SteamWebApiRefundTxnOptions extends SteamWebApiMicroTxnBaseOptions {
  orderId: bigint | number | string;
}

export const SteamCallback = {
  PersonaStateChange: 0,
  SteamServersConnected: 1,
  SteamServersDisconnected: 2,
  SteamServerConnectFailure: 3,
  SteamServersConnectedSteamworks: 101,
  SteamServerConnectFailureSteamworks: 102,
  SteamServersDisconnectedSteamworks: 103,
  ClientGameServerDeny: 113,
  IPCFailure: 117,
  LicensesUpdated: 125,
  ValidateAuthTicketResponse: 143,
  MicroTxnAuthorizationResponseSteamworks: 152,
  LobbyDataUpdate: 4,
  LobbyChatUpdate: 5,
  P2PSessionRequest: 6,
  P2PSessionConnectFail: 7,
  GameLobbyJoinRequested: 8,
  MicroTxnAuthorizationResponse: 9,
  PersonaStateChangeSteamworks: 304,
  EncryptedAppTicketResponse: 154,
  GetAuthSessionTicketResponse: 163,
  GameWebCallback: 164,
  StoreAuthURLResponse: 165,
  MarketEligibilityResponse: 166,
  DurationControl: 167,
  GetTicketForWebApiResponse: 168,
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
  LobbyDataUpdateSteamworks: 505,
  LobbyChatUpdateSteamworks: 506,
  LobbyChatMsg: 507,
  LobbyGameCreated: 509,
  LobbyMatchList: 510,
  LobbyKicked: 512,
  LobbyCreated: 513,
  FavoritesListAccountsUpdated: 516,
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
  SocketStatusCallback: 1201,
  P2PSessionRequestSteamworks: 1202,
  P2PSessionConnectFailSteamworks: 1203,
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
  RemoteStorageLocalFileChange: 1333,
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
  UserStatsReceived: 1101,
  UserStatsStored: 1102,
  UserAchievementStored: 1103,
  LeaderboardFindResult: 1104,
  LeaderboardScoresDownloaded: 1105,
  LeaderboardScoreUploaded: 1106,
  NumberOfCurrentPlayers: 1107,
  UserStatsUnloaded: 1108,
  GameServerStatsUnloaded: 1108,
  UserAchievementIconFetched: 1109,
  GlobalAchievementPercentagesReady: 1110,
  LeaderboardUGCSet: 1111,
  GlobalStatsReceived: 1112,
  GCMessageAvailable: 1701,
  GCMessageFailed: 1702,
  GameServerStatsReceived: 1800,
  GameServerStatsStored: 1801,
  HTTPRequestCompleted: 2101,
  HTTPRequestHeadersReceived: 2102,
  HTTPRequestDataReceived: 2103,
  SteamInputDeviceConnected: 2801,
  SteamInputDeviceDisconnected: 2802,
  SteamInputConfigurationLoaded: 2803,
  SteamInputGamepadSlotChange: 2804,
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
  MusicPlayerWantsVolume: 4011,
  MusicPlayerSelectsQueueEntry: 4012,
  MusicPlayerSelectsPlaylistEntry: 4013,
  MusicPlayerRemoteWillActivate: 4101,
  MusicPlayerRemoteWillDeactivate: 4102,
  MusicPlayerRemoteToFront: 4103,
  MusicPlayerWillQuit: 4104,
  MusicPlayerWantsPlay: 4105,
  MusicPlayerWantsPause: 4106,
  MusicPlayerWantsPlayPrevious: 4107,
  MusicPlayerWantsPlayNext: 4108,
  MusicPlayerWantsShuffled: 4109,
  MusicPlayerWantsLooped: 4110,
  MusicPlayerWantsPlayingRepeatStatus: 4114,
  BroadcastUploadStart: 4604,
  BroadcastUploadStop: 4605,
  GetVideoURLResult: 4611,
  GetOPFSettingsResult: 4624,
  SteamParentalSettingsChanged: 5001,
  JoinParty: 5301,
  CreateBeacon: 5302,
  ReservationNotification: 5303,
  ChangeNumOpenSlots: 5304,
  AvailableBeaconLocationsUpdated: 5305,
  ActiveBeaconsUpdated: 5306,
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

export const GameCoordinatorResult = {
  OK: 0,
  NoMessage: 1,
  BufferTooSmall: 2,
  NotLoggedOn: 3,
  InvalidMessage: 4
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

export const STEAM_INPUT_HANDLE_ALL_CONTROLLERS = 0xffff_ffff_ffff_ffffn;
export const STEAM_INPUT_MAX_COUNT = 16;

export const InputActionEventType = {
  DigitalAction: 0,
  AnalogAction: 1
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

export const UserDialog = {
  SteamId: "steamid",
  Profile: "steamid",
  Chat: "chat",
  JoinTrade: "jointrade",
  Stats: "stats",
  Achievements: "achievements",
  FriendAdd: "friendadd",
  FriendRemove: "friendremove",
  FriendRequestAccept: "friendrequestaccept",
  FriendRequestIgnore: "friendrequestignore"
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

export const SteamWebApiPublishedFileQueryType = {
  RankedByVote: 0,
  RankedByPublicationDate: 1,
  AcceptedForGameRankedByAcceptanceDate: 2,
  RankedByTrend: 3,
  FavoritedByFriendsRankedByPublicationDate: 4,
  CreatedByFriendsRankedByPublicationDate: 5,
  RankedByNumTimesReported: 6,
  CreatedByFollowedUsersRankedByPublicationDate: 7,
  NotYetRated: 8,
  RankedByTotalUniqueSubscriptions: 9,
  RankedByTotalVotesAsc: 10,
  RankedByVotesUp: 11,
  RankedByTextSearch: 12,
  RankedByPlaytimeTrend: 13,
  RankedByTotalPlaytime: 14,
  RankedByAveragePlaytimeTrend: 15,
  RankedByLifetimeAveragePlaytime: 16,
  RankedByPlaytimeSessionsTrend: 17,
  RankedByLifetimePlaytimeSessions: 18,
  RankedByInappropriateContentRating: 19,
  RankedByBanContentCheck: 20,
  RankedByLastUpdatedDate: 21
} as const;

export const SteamWebApiPublishedFileInfoMatchingFileType = {
  Items: 0,
  Collections: 1,
  Art: 2,
  Videos: 3,
  Screenshots: 4,
  CollectionEligible: 5,
  Games: 6,
  Software: 7,
  Concepts: 8,
  GreenlightItems: 9,
  AllGuides: 10,
  WebGuides: 11,
  IntegratedGuides: 12,
  UsableInGame: 13,
  Merch: 14,
  ControllerBindings: 15,
  SteamworksAccessInvites: 16,
  ItemsMtx: 17,
  ItemsReadyToUse: 18,
  WorkshopShowcase: 19,
  GameManagedItems: 20
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
export let electronNativeOverlaySessionOptions = electronNativeOverlaySessionOptionsImpl;
export let electronOverlayPresenterOptions = electronOverlayPresenterOptionsImpl;
export let electronScrubSteamOverlayChildProcessEnv = electronScrubSteamOverlayChildProcessEnvImpl;

export type SteamCallbackId = typeof SteamCallback[keyof typeof SteamCallback];
export type SteamCallbackName = keyof typeof SteamCallback;
export type InputTypeValue = typeof InputType[keyof typeof InputType];
export type InputTypeCodeValue = typeof InputTypeCode[keyof typeof InputTypeCode];

const DEFAULT_STEAM_WEB_API_BASE_URL = "https://api.steampowered.com";
const DEFAULT_STEAM_WEB_API_PARTNER_BASE_URL = "https://partner.steam-api.com";

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

  setDualSenseTriggerEffect(effect?: Buffer | null): void {
    native().inputSetDualSenseTriggerEffect(this.handle, effect ?? undefined);
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

export function getSteamworksEnum<T extends SteamworksEnumName>(enumName: T): typeof SteamworksEnums[T] {
  return SteamworksEnums[enumName];
}

export function getSteamworksEnumValue<T extends SteamworksEnumName>(
  enumName: T,
  valueName: SteamworksEnumValueName<T>
): SteamworksEnumValue<T> {
  return SteamworksEnums[enumName][valueName] as SteamworksEnumValue<T>;
}

export function runCallbacks(): void {
  native().runCallbacks();
}

export function initAnonymousUser(): boolean {
  return native().initAnonymousUser();
}

export function initSafe(): boolean {
  return native().initSafe();
}

export function runLegacyCallbacks(): void {
  native().runLegacyCallbacks();
}

export function releaseCurrentThreadMemory(): void {
  native().releaseCurrentThreadMemory();
}

export function setTryCatchCallbacks(enabled: boolean): void {
  native().setTryCatchCallbacks(enabled);
}

export function setMiniDumpComment(comment: string): void {
  native().setMiniDumpComment(comment);
}

export function writeMiniDump(structuredExceptionCode: number, buildId: number): void {
  native().writeMiniDump(structuredExceptionCode, buildId);
}

export function useBreakpadCrashHandler(options: BreakpadCrashHandlerOptions = {}): void {
  native().useBreakpadCrashHandler(
    options.version ?? "steam-bridge",
    options.date ?? "",
    options.time ?? "",
    options.fullMemoryDumps ?? false
  );
}

export function setBreakpadAppId(appId: number): void {
  native().setBreakpadAppId(appId);
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
  if (!isOverlayNeedsPresentPollingEnabledForProcess()) {
    return false;
  }
  return native().overlayNeedsPresent();
}

export function isOverlayNeedsPresentPollingEnabled(): boolean {
  if (!isOverlayNeedsPresentPollingEnabledForProcess()) {
    return false;
  }
  return native().isOverlayNeedsPresentPollingEnabled();
}

export function steamStoreAppUrl(appId: number = getAppId()): string {
  return `${STEAM_STORE_BASE_URL}/app/${normalizeSteamAppId(appId)}/`;
}

export function steamCommunityAppUrl(appId: number = getAppId()): string {
  return `${STEAM_COMMUNITY_BASE_URL}/app/${normalizeSteamAppId(appId)}/`;
}

export function steamCommunityStatsUrl(appId: number = getAppId()): string {
  return `${STEAM_COMMUNITY_BASE_URL}/stats/${normalizeSteamAppId(appId)}/`;
}

export function steamCommunityProfileUrl(steamId64: bigint | number | string = getSteamId().steamId64): string {
  return `${STEAM_COMMUNITY_BASE_URL}/profiles/${normalizeSteamId64(steamId64)}/`;
}

export function steamCommunityPlayersUrl(steamId64: bigint | number | string = getSteamId().steamId64): string {
  return `${steamCommunityProfileUrl(steamId64)}friends/coplay/`;
}

export function steamCommunityUserStatsUrl(
  appId: number = getAppId(),
  steamId64: bigint | number | string = getSteamId().steamId64
): string {
  return `${STEAM_COMMUNITY_BASE_URL}/profiles/${normalizeSteamId64(steamId64)}/stats/${normalizeSteamAppId(appId)}/`;
}

export function steamCommunityAchievementsUrl(
  appId: number = getAppId(),
  steamId64: bigint | number | string = getSteamId().steamId64
): string {
  return `${steamCommunityUserStatsUrl(appId, steamId64)}achievements/`;
}

export function steamCheckoutTransactionUrl(
  transactionId: bigint | number | string,
  options: SteamOverlayCheckoutUrlOptions = {}
): string {
  const url = new URL(
    `/checkout/approvetxn/${encodeURIComponent(normalizeSteamTransactionId(transactionId))}/`,
    STEAM_CHECKOUT_BASE_URL
  );
  if (options.returnUrl) {
    url.searchParams.set("returnurl", options.returnUrl);
  }
  return url.toString();
}

export function getOverlayDiagnostics(): OverlayDiagnostics {
  if (!isOverlayNeedsPresentPollingEnabledForProcess()) {
    return {
      steamRunning: isSteamRunning(),
      steamInstallPath: getSteamInstallPath(),
      appId: getAppId(),
      overlayEnabled: isOverlayEnabled(),
      overlayNeedsPresent: false,
      overlayNeedsPresentPollingEnabled: false,
      steamDeck: isSteamDeck(),
      bigPicture: isSteamInBigPictureMode(),
      platform: process.platform,
      arch: process.arch,
      pid: process.pid
    };
  }
  return normalizeOverlayDiagnostics(native().getOverlayDiagnostics());
}

export function onMicroTxnAuthorizationResponse(
  handler: (event: MicroTxnAuthorizationResponse) => void
): CallbackHandle {
  return wrapCallbackHandle(native().registerMicroTxnAuthorizationResponse((event) => {
    handler(normalizeMicroTxnEvent(event));
  }));
}

export function onLegacyMicroTxnAuthorizationResponse(
  handler: (event: MicroTxnAuthorizationResponse) => void
): CallbackHandle {
  return onSteamCallback("MicroTxnAuthorizationResponse", (event) => {
    handler(event as MicroTxnAuthorizationResponse);
  });
}

export function onGameOverlayActivated(handler: (event: GameOverlayActivated) => void): CallbackHandle {
  return wrapCallbackHandle(native().registerGameOverlayActivated((event) => {
    handler(normalizeGameOverlayEvent(event));
  }));
}

export function onSteamServersConnected(handler: (event: SteamServersConnectedEvent) => void): CallbackHandle {
  return onSteamCallback("SteamServersConnected", (event) => {
    handler(event as SteamServersConnectedEvent);
  });
}

export function onSteamServerConnectFailure(
  handler: (event: SteamServerConnectFailureEvent) => void
): CallbackHandle {
  return onSteamCallback("SteamServerConnectFailure", (event) => {
    handler(event as SteamServerConnectFailureEvent);
  });
}

export function onSteamServersDisconnected(handler: (event: SteamServersDisconnectedEvent) => void): CallbackHandle {
  return onSteamCallback("SteamServersDisconnected", (event) => {
    handler(event as SteamServersDisconnectedEvent);
  });
}

export function onSteamCallback(
  steamCallback: SteamCallbackName | SteamCallbackId | number,
  handler: (event: unknown) => void
): CallbackHandle {
  const callbackId = resolveSteamCallbackId(steamCallback);
  return wrapCallbackHandle(
    native().registerSteamCallback(callbackId, (event) => {
      handler(normalizeCallbackEvent(callbackId, event));
    })
  );
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

export function setNativeOverlayHostInputPassthrough(passThrough: boolean): void {
  native().setNativeOverlayHostInputPassthrough(passThrough);
}

export function setNativeOverlayHostOpacity(opaque: boolean): void {
  native().setNativeOverlayHostOpacity(opaque);
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

export function getMacOverlayEnvironment(): MacOverlayEnvironment | undefined {
  return readMacOverlayEnvironment();
}

export function startNativeOverlaySession(options: NativeOverlaySessionOptions = {}): NativeOverlaySession {
  assertLinuxNativeOverlayDisplayAvailable();

  const title = options.title ?? "Steam Bridge Native Overlay";
  const backend = resolveNativeOverlayBackend(options);
  const pumpIntervalMs = Math.max(1, options.pumpIntervalMs ?? 33);
  const usesNativeHostView = Boolean(options.nativeWindowHandle);
  const hideNativeHostOnOverlayDeactivate = options.hideNativeHostOnOverlayDeactivate ?? usesNativeHostView;
  const restoreFocusDelayMs = Math.max(0, options.restoreFocusDelayMs ?? 250);
  const hideNativeHostDelayMs = usesNativeHostView ? 500 : 0;

  let closed = false;
  let pumpCount = 0;
  let lastPumpAt: number | undefined;
  let lastError: unknown;
  let overlayActive = false;
  let overlayWasActive = false;
  let lastOverlayEvent: GameOverlayActivated | undefined;
  let nativeHostUnavailableReason: NativeOverlayHostUnavailableReason | undefined;
  let macOverlayEnvironment: MacOverlayEnvironment | undefined;
  let pumpTimer: NodeJS.Timeout | undefined;
  let restoreFocusTimer: NodeJS.Timeout | undefined;
  let hideNativeHostTimer: NodeJS.Timeout | undefined;
  let overlayHandle: CallbackHandle | undefined;

  const pump = (): void => {
    if (closed) {
      return;
    }

    try {
      if (!ensureNativeOverlaySurfaceReady()) {
        return;
      }
      native().pumpNativeOverlayProbeWindow();
      pumpCount += 1;
      lastPumpAt = Date.now();
    } catch (error) {
      lastError = error;
      close();
      throw error;
    }
  };

  const snapshot = (): NativeOverlaySessionSnapshot => {
    if (!closed) {
      updateNativeOverlayHostAvailability();
    }
    const bounds = closed
      ? undefined
      : readNativeOverlayBounds(options.getBounds, (error) => {
          lastError = error;
        });
    const base = {
      title,
      backend: closed ? "none" : backend,
      ...(bounds ? { bounds } : {}),
      closed,
      startedAt,
      pumpCount,
      overlayActive,
      overlayWasActive,
      lastOverlayEvent,
      nativeProbeOpen: safeBoolean(() => native().isNativeOverlayProbeWindowOpen()),
      nativeHostOpen: safeBoolean(() => native().isNativeOverlayHostViewOpen()),
      nativeHostUnavailableReason,
      macOverlayEnvironment,
      lastPumpAt,
      lastError
    };

    try {
      return { ...base, diagnostics: getOverlayDiagnostics() };
    } catch {
      return base;
    }
  };

  const close = (): void => {
    if (closed) {
      return;
    }

    closed = true;
    nativeHostUnavailableReason = undefined;
    macOverlayEnvironment = undefined;

    if (pumpTimer) {
      clearInterval(pumpTimer);
      pumpTimer = undefined;
    }

    if (restoreFocusTimer) {
      clearTimeout(restoreFocusTimer);
      restoreFocusTimer = undefined;
    }

    if (hideNativeHostTimer) {
      clearTimeout(hideNativeHostTimer);
      hideNativeHostTimer = undefined;
    }

    if (overlayHandle) {
      overlayHandle.disconnect();
      overlayHandle = undefined;
    }

    if (usesNativeHostView) {
      native().detachNativeOverlayHostView();
    } else {
      native().closeNativeOverlayProbeWindow();
    }
  };

  const startedAt = Date.now();

  pump();

  overlayHandle = onGameOverlayActivated((event) => {
    lastOverlayEvent = event;
    if (typeof event.active === "boolean") {
      overlayActive = event.active;
    }
    if (event.active === true) {
      overlayWasActive = true;
      setHostInputPassthrough(false);
      setHostOpaque(true);
    } else if (event.active === false) {
      scheduleRestoreFocus();
    }
  });

  pumpTimer = setInterval(() => {
    try {
      pump();
    } catch {
      // The thrown error is stored in the session snapshot and the session closes itself.
    }
  }, pumpIntervalMs);
  pumpTimer.unref?.();

  return {
    close,
    disconnect: close,
    pump,
    isOpen: () => {
      if (closed) {
        return false;
      }
      updateNativeOverlayHostAvailability();
      if (usesNativeHostView) {
        return true;
      }
      return nativeHostUnavailableReason !== undefined || native().isNativeOverlayProbeWindowOpen();
    },
    snapshot
  };

  function updateNativeOverlayHostAvailability(): boolean {
    const availability = readNativeOverlayHostUnavailable((error) => {
      lastError = error;
    });
    nativeHostUnavailableReason = availability.nativeHostUnavailableReason;
    macOverlayEnvironment = availability.macOverlayEnvironment;
    return nativeHostUnavailableReason === undefined;
  }

  function ensureNativeOverlaySurfaceReady(): boolean {
    if (!updateNativeOverlayHostAvailability()) {
      return false;
    }

    if (options.nativeWindowHandle) {
      if (!safeBoolean(() => native().isNativeOverlayHostViewOpen())) {
        native().attachNativeOverlayHostView(options.nativeWindowHandle);
        native().showNativeOverlayHostView();
        setHostInputPassthrough(false);
        setHostOpaque(true);
      }
      return true;
    }

    if (!safeBoolean(() => native().isNativeOverlayProbeWindowOpen())) {
      native().openNativeOverlayProbeWindow(title);
    }
    return true;
  }

  function scheduleRestoreFocus(): void {
    if (!options.restoreFocus && !hideNativeHostOnOverlayDeactivate && !usesNativeHostView) {
      return;
    }

    if (restoreFocusTimer) {
      clearTimeout(restoreFocusTimer);
    }

    const restoreFocus = (): void => {
      restoreFocusTimer = undefined;

      if (closed) {
        return;
      }

      try {
        options.restoreFocus?.();
      } catch (error) {
        lastError = error;
      }

      if (usesNativeHostView && hideNativeHostOnOverlayDeactivate) {
        hideNativeHostTimer = setTimeout(() => {
          hideNativeHostTimer = undefined;
          if (closed) {
            return;
          }
          try {
            native().hideNativeOverlayHostView();
            setHostInputPassthrough(true);
            setHostOpaque(false);
          } catch (error) {
            lastError = error;
          }
        }, hideNativeHostDelayMs);
        hideNativeHostTimer.unref?.();
      } else if (usesNativeHostView) {
        setHostInputPassthrough(true);
        setHostOpaque(false);
      }
    };

    if (restoreFocusDelayMs === 0) {
      restoreFocus();
      return;
    }

    restoreFocusTimer = setTimeout(restoreFocus, restoreFocusDelayMs);
    restoreFocusTimer.unref?.();
  }

  function setHostInputPassthrough(passThrough: boolean): void {
    if (!usesNativeHostView || nativeHostUnavailableReason !== undefined) {
      return;
    }
    try {
      setNativeOverlayHostInputPassthrough(passThrough);
    } catch (error) {
      lastError = error;
    }
  }

  function setHostOpaque(opaque: boolean): void {
    if (!usesNativeHostView || nativeHostUnavailableReason !== undefined) {
      return;
    }
    try {
      setNativeOverlayHostOpacity(opaque);
    } catch (error) {
      lastError = error;
    }
  }
}

export function attachOverlayPresenter(options: NativeOverlayPresenterOptions = {}): NativeOverlayPresenter {
  assertLinuxNativeOverlayDisplayAvailable();

  const title = options.title ?? "Steam Bridge Overlay Presenter";
  const backend = resolveNativeOverlayBackend(options);
  const usesNativeHostView = Boolean(options.nativeWindowHandle);
  const idleFps = normalizedFps(options.idleFps, 0);
  const needsPresentFps = normalizedFps(options.needsPresentFps, 30);
  const activeOverlayFps = normalizedFps(options.activeOverlayFps, 30);
  const pollIntervalMs = Math.max(50, finiteNumber(options.pollIntervalMs, 250));
  const activationBoostMs = Math.max(0, finiteNumber(options.activationBoostMs, 5000));
  const activeGraceMs = Math.max(0, finiteNumber(options.activeGraceMs, 500));
  const restoreFocusDelayMs = Math.max(0, finiteNumber(options.restoreFocusDelayMs, 250));

  let closed = false;
  let visible = true;
  let pumpCount = 0;
  let pollCount = 0;
  let currentFps = idleFps;
  let lastPumpAt: number | undefined;
  let lastPollAt: number | undefined;
  let lastError: unknown;
  let lastDiagnostics: OverlayDiagnostics | undefined;
  let overlayActive = false;
  let overlayWasActive = false;
  let overlayNeedsPresent = false;
  let lastOverlayEvent: GameOverlayActivated | undefined;
  let nativeHostUnavailableReason: NativeOverlayHostUnavailableReason | undefined;
  let macOverlayEnvironment: MacOverlayEnvironment | undefined;
  let hostInputPassthrough = usesNativeHostView;
  let hostOpaque = !usesNativeHostView;
  let hostActivationMode: NativeOverlayPresenterActivationMode = "passive";
  let suppressNeedsPresentOpacity = false;
  let boostUntil = 0;
  let activationHoldCount = 0;
  let timer: NodeJS.Timeout | undefined;
  let restoreFocusTimer: NodeJS.Timeout | undefined;
  let overlayHandle: CallbackHandle | undefined;
  const stateListeners = new Set<() => void>();

  const pump = (): void => {
    if (closed) {
      return;
    }

    try {
      if (!ensureNativeOverlaySurfaceReady()) {
        currentFps = 0;
        emitStateChange();
        return;
      }
      native().pumpNativeOverlayProbeWindow();
      pumpCount += 1;
      lastPumpAt = Date.now();
      emitStateChange();
    } catch (error) {
      lastError = error;
      close();
      throw error;
    }
  };

  const show = (): void => {
    if (closed) {
      return;
    }

    try {
      if (usesNativeHostView) {
        if (!ensureNativeOverlaySurfaceReady()) {
          visible = true;
          currentFps = 0;
          emitStateChange();
          return;
        }
        native().showNativeOverlayHostView();
      } else {
        if (!updateNativeOverlayHostAvailability()) {
          visible = true;
          currentFps = 0;
          emitStateChange();
          return;
        }
        native().openNativeOverlayProbeWindow(title);
      }
      visible = true;
      emitStateChange();
    } catch (error) {
      lastError = error;
      throw error;
    }
  };

  const hide = (): void => {
    if (closed) {
      return;
    }

    try {
      if (usesNativeHostView) {
        native().hideNativeOverlayHostView();
      } else {
        native().closeNativeOverlayProbeWindow();
      }
      visible = false;
      emitStateChange();
    } catch (error) {
      lastError = error;
      throw error;
    }
  };

  const prepareForOverlay = (durationMs = activationBoostMs): void => {
    prepareForActivation("interactive", durationMs);
  };

  const prepareForPassiveOverlay = (durationMs?: number): void => {
    if (durationMs !== undefined) {
      prepareForActivation("passive", durationMs);
      return;
    }
    prepareForPassiveActivation();
  };

  const prepareForTransparentInputOverlay = (durationMs = activationBoostMs): void => {
    prepareForActivation("transparent-input", durationMs);
  };

  const beginOverlayActivation = (
    activationMode: NativeOverlayPresenterActivationMode = "interactive"
  ): CallbackHandle => {
    if (closed) {
      return {
        disconnect() {}
      };
    }

    activationHoldCount += 1;
    focusSourceWindowForActivation(activationMode);
    ensureNativeOverlaySurfaceReady();
    if (!visible) {
      show();
    }
    hostActivationMode = activationMode;
    suppressNeedsPresentOpacity = false;
    currentFps = selectCurrentFps();
    syncHostInputMode();
    pump();
    schedule(0);
    emitStateChange();

    let disconnected = false;
    return {
      disconnect() {
        if (disconnected) {
          return;
        }
        disconnected = true;
        activationHoldCount = Math.max(0, activationHoldCount - 1);
        if (activationHoldCount === 0 && !overlayActive && Date.now() >= boostUntil) {
          hostActivationMode = "passive";
          suppressNeedsPresentOpacity = true;
        }
        currentFps = selectCurrentFps();
        syncHostInputMode();
        schedule(0);
        emitStateChange();
      }
    };
  };

  const prepareForActivation = (
    activationMode: NativeOverlayPresenterActivationMode,
    durationMs = activationBoostMs
  ): void => {
    if (closed) {
      return;
    }

    focusSourceWindowForActivation(activationMode);
    ensureNativeOverlaySurfaceReady();
    if (!visible) {
      show();
    }

    hostActivationMode = activationMode;
    suppressNeedsPresentOpacity = false;
    boostUntil = Math.max(boostUntil, Date.now() + Math.max(0, durationMs));
    currentFps = selectCurrentFps();
    syncHostInputMode();
    pump();
    schedule(0);
    emitStateChange();
  };

  const prepareForPassiveActivation = (): void => {
    if (closed) {
      return;
    }

    ensureNativeOverlaySurfaceReady();
    if (!visible) {
      show();
    }

    hostActivationMode = "passive";
    suppressNeedsPresentOpacity = false;
    poll();
    currentFps = selectCurrentFps();
    syncHostInputMode();
    pump();
    schedule(0);
    emitStateChange();
  };

  const snapshot = (): NativeOverlayPresenterSnapshot => {
    if (!closed) {
      updateNativeOverlayHostAvailability();
    }
    const acceptsOverlayInput = shouldHostAcceptInput(Date.now());
    const mode: NativeOverlayPresenterMode = closed
      ? "closed"
      : nativeHostUnavailableReason !== undefined || !visible
        ? "hidden"
        : acceptsOverlayInput
          ? "active"
          : "passive";
    const nativeProbeOpen = safeBoolean(() => native().isNativeOverlayProbeWindowOpen());
    const nativeHostOpen = safeBoolean(() => native().isNativeOverlayHostViewOpen());
    const bounds = closed
      ? undefined
      : readNativeOverlayBounds(options.getBounds, (error) => {
          lastError = error;
        });
    const base = {
      title,
      backend: closed ? "none" : backend,
      ...(bounds ? { bounds } : {}),
      closed,
      startedAt,
      mode,
      attached: usesNativeHostView ? nativeHostOpen : nativeProbeOpen,
      nativeProbeOpen,
      nativeHostOpen,
      nativeHostUnavailableReason,
      macOverlayEnvironment,
      clickThrough: hostInputPassthrough,
      focusable: !usesNativeHostView,
      transparent: usesNativeHostView && !hostOpaque,
      idleFps,
      needsPresentFps,
      activeOverlayFps,
      pollIntervalMs,
      currentFps,
      pumpCount,
      pollCount,
      overlayActive,
      overlayWasActive,
      overlayNeedsPresent,
      overlayNeedsPresentPollingEnabled:
        lastDiagnostics?.overlayNeedsPresentPollingEnabled ?? safeBoolean(() => isOverlayNeedsPresentPollingEnabled()),
      lastOverlayEvent,
      lastPumpAt,
      lastPollAt,
      lastError
    };

    return lastDiagnostics ? { ...base, diagnostics: lastDiagnostics } : base;
  };

  const close = (): void => {
    if (closed) {
      return;
    }

    closed = true;
    activationHoldCount = 0;
    nativeHostUnavailableReason = undefined;
    macOverlayEnvironment = undefined;

    if (timer) {
      clearTimeout(timer);
      timer = undefined;
    }

    if (restoreFocusTimer) {
      clearTimeout(restoreFocusTimer);
      restoreFocusTimer = undefined;
    }

    if (overlayHandle) {
      overlayHandle.disconnect();
      overlayHandle = undefined;
    }

    if (usesNativeHostView) {
      native().detachNativeOverlayHostView();
    } else {
      native().closeNativeOverlayProbeWindow();
    }
    emitStateChange();
    stateListeners.clear();
  };

  const startedAt = Date.now();

  pump();

  overlayHandle = onGameOverlayActivated((event) => {
    lastOverlayEvent = event;
    if (typeof event.active === "boolean") {
      overlayActive = event.active;
    }
    if (event.active === true) {
      overlayWasActive = true;
      suppressNeedsPresentOpacity = false;
      boostUntil = Math.max(boostUntil, Date.now() + activationBoostMs);
      currentFps = selectCurrentFps();
      syncHostInputMode();
      schedule(0);
      emitStateChange();
    } else if (event.active === false) {
      activationHoldCount = 0;
      hostActivationMode = "passive";
      suppressNeedsPresentOpacity = true;
      boostUntil = Date.now() + activeGraceMs;
      scheduleRestoreFocus();
      currentFps = selectCurrentFps();
      syncHostInputMode();
      schedule(0);
      emitStateChange();
    }
  });

  schedule(pollIntervalMs);

  const presenter: NativeOverlayPresenterInternal = {
    close,
    disconnect: close,
    pump,
    prepareForOverlay,
    prepareForPassiveOverlay,
    prepareForTransparentInputOverlay,
    beginOverlayActivation,
    show,
    hide,
    isOpen: () => {
      if (closed) {
        return false;
      }
      updateNativeOverlayHostAvailability();
      if (usesNativeHostView) {
        return true;
      }
      return nativeHostUnavailableReason !== undefined || native().isNativeOverlayProbeWindowOpen();
    },
    snapshot,
    onStateChange: subscribeStateChange
  };

  return presenter;

  function poll(): void {
    try {
      lastDiagnostics = getOverlayDiagnostics();
      overlayNeedsPresent = lastDiagnostics.overlayNeedsPresent;
      pollCount += 1;
      lastPollAt = Date.now();
    } catch (error) {
      lastError = error;
    }
  }

  function tick(): void {
    timer = undefined;
    if (closed) {
      return;
    }

    ensureNativeOverlaySurfaceReady();
    poll();
    currentFps = selectCurrentFps();
    syncHostInputMode();
    if (currentFps > 0) {
      try {
        pump();
      } catch {
        return;
      }
    }

    emitStateChange();
    schedule(currentFps > 0 ? Math.max(1, Math.round(1000 / currentFps)) : pollIntervalMs);
  }

  function selectCurrentFps(): number {
    if (nativeHostUnavailableReason !== undefined) {
      return 0;
    }
    const now = Date.now();
    if (overlayActive || activationHoldCount > 0 || now < boostUntil) {
      return activeOverlayFps;
    }
    if (overlayNeedsPresent && !suppressNeedsPresentOpacity) {
      return needsPresentFps;
    }
    return idleFps;
  }

  function syncHostInputMode(): void {
    if (!usesNativeHostView || nativeHostUnavailableReason !== undefined) {
      return;
    }
    const now = Date.now();
    const shouldAcceptInput = shouldHostAcceptInput(now);
    const shouldShowHost =
      hostActivationMode === "interactive"
        ? shouldAcceptInput || overlayNeedsPresent
        : hostActivationMode === "passive"
          ? overlayNeedsPresent && !suppressNeedsPresentOpacity
          : false;
    setHostInputPassthrough(!shouldAcceptInput);
    setHostOpaque(shouldShowHost);
  }

  function shouldHostAcceptInput(now: number): boolean {
    return (
      (hostActivationMode === "interactive" || hostActivationMode === "transparent-input") &&
      (overlayActive || activationHoldCount > 0 || now < boostUntil)
    );
  }

  function setHostInputPassthrough(passThrough: boolean): void {
    if (!usesNativeHostView || nativeHostUnavailableReason !== undefined || hostInputPassthrough === passThrough) {
      return;
    }

    try {
      setNativeOverlayHostInputPassthrough(passThrough);
      hostInputPassthrough = passThrough;
    } catch (error) {
      lastError = error;
    }
  }

  function setHostOpaque(opaque: boolean): void {
    if (!usesNativeHostView || nativeHostUnavailableReason !== undefined || hostOpaque === opaque) {
      return;
    }

    try {
      setNativeOverlayHostOpacity(opaque);
      hostOpaque = opaque;
    } catch (error) {
      lastError = error;
    }
  }

  function schedule(delayMs: number): void {
    if (closed) {
      return;
    }
    if (timer) {
      clearTimeout(timer);
    }
    timer = setTimeout(tick, Math.max(0, delayMs));
    timer.unref?.();
  }

  function scheduleRestoreFocus(): void {
    if (!options.restoreFocus) {
      return;
    }

    if (restoreFocusTimer) {
      clearTimeout(restoreFocusTimer);
    }

    const restoreFocus = (): void => {
      restoreFocusTimer = undefined;
      if (closed) {
        return;
      }
      try {
        options.restoreFocus?.();
        emitStateChange();
      } catch (error) {
        lastError = error;
      }
    };

    if (restoreFocusDelayMs === 0) {
      restoreFocus();
      return;
    }

    restoreFocusTimer = setTimeout(restoreFocus, restoreFocusDelayMs);
    restoreFocusTimer.unref?.();
  }

  function focusSourceWindowForActivation(activationMode: NativeOverlayPresenterActivationMode): void {
    if (activationMode === "passive" || !options.restoreFocus) {
      return;
    }

    try {
      options.restoreFocus();
    } catch (error) {
      lastError = error;
    }
  }

  function subscribeStateChange(listener: () => void): CallbackHandle {
    stateListeners.add(listener);
    return {
      disconnect() {
        stateListeners.delete(listener);
      }
    };
  }

  function emitStateChange(): void {
    for (const listener of Array.from(stateListeners)) {
      try {
        listener();
      } catch (error) {
        process.emitWarning(error instanceof Error ? error : String(error), {
          type: "SteamBridgeOverlayStateListenerWarning"
        });
      }
    }
  }

  function updateNativeOverlayHostAvailability(): boolean {
    const availability = readNativeOverlayHostUnavailable((error) => {
      lastError = error;
    });
    nativeHostUnavailableReason = availability.nativeHostUnavailableReason;
    macOverlayEnvironment = availability.macOverlayEnvironment;
    return nativeHostUnavailableReason === undefined;
  }

  function ensureNativeOverlaySurfaceReady(): boolean {
    if (!updateNativeOverlayHostAvailability()) {
      return false;
    }

    if (options.nativeWindowHandle) {
      if (!safeBoolean(() => native().isNativeOverlayHostViewOpen())) {
        native().attachNativeOverlayHostView(options.nativeWindowHandle);
        if (visible) {
          native().showNativeOverlayHostView();
        }
      }
      return true;
    }

    if (!visible) {
      return true;
    }

    if (!safeBoolean(() => native().isNativeOverlayProbeWindowOpen())) {
      native().openNativeOverlayProbeWindow(title);
    }
    return true;
  }
}

function resolveNativeOverlayBackend(options: { nativeWindowHandle?: Buffer } = {}): NativeOverlayBackend {
  if (process.platform === "linux") {
    return "x11-glx";
  }

  if (process.platform === "darwin") {
    if (options.nativeWindowHandle && shouldUseMacMetalOverlayHost()) {
      return "macos-metal";
    }
    return "macos-opengl";
  }

  return "none";
}

function readNativeOverlayBounds(
  getBounds: NativeOverlayBoundsProvider | undefined,
  onError?: (error: unknown) => void
): NativeOverlayBounds | undefined {
  if (!getBounds) {
    return undefined;
  }

  try {
    return normalizeNativeOverlayBounds(getBounds());
  } catch (error) {
    onError?.(error);
    return undefined;
  }
}

function normalizeNativeOverlayBounds(bounds: NativeOverlayBounds | undefined): NativeOverlayBounds | undefined {
  if (!bounds) {
    return undefined;
  }

  const { x, y, width, height } = bounds;
  if (![x, y, width, height].every(Number.isFinite) || width < 0 || height < 0) {
    return undefined;
  }

  return { x, y, width, height };
}

function readMacOverlayEnvironment(onError?: (error: unknown) => void): MacOverlayEnvironment | undefined {
  if (process.platform !== "darwin") {
    return undefined;
  }

  try {
    const binding = native();
    const reader = binding.getMacOverlayEnvironment;
    if (typeof reader !== "function") {
      return {
        screenLocked: false,
        displayAsleep: false
      };
    }
    return normalizeMacOverlayEnvironment(reader.call(binding));
  } catch (error) {
    onError?.(error);
    return undefined;
  }
}

function normalizeMacOverlayEnvironment(
  environment: NativeMacOverlayEnvironment | null | undefined
): MacOverlayEnvironment {
  const source = (environment && typeof environment === "object" ? environment : {}) as Record<string, unknown>;
  return {
    screenLocked: Boolean(source.screenLocked ?? source.screen_locked),
    displayAsleep: Boolean(source.displayAsleep ?? source.display_asleep)
  };
}

function readNativeOverlayHostUnavailable(
  onError?: (error: unknown) => void
): {
  nativeHostUnavailableReason?: NativeOverlayHostUnavailableReason;
  macOverlayEnvironment?: MacOverlayEnvironment;
} {
  const macOverlayEnvironment = readMacOverlayEnvironment(onError);
  if (!macOverlayEnvironment) {
    return {};
  }

  if (macOverlayEnvironment.screenLocked) {
    return {
      nativeHostUnavailableReason: "macos-screen-locked",
      macOverlayEnvironment
    };
  }

  if (macOverlayEnvironment.displayAsleep) {
    return {
      nativeHostUnavailableReason: "macos-display-asleep",
      macOverlayEnvironment
    };
  }

  return { macOverlayEnvironment };
}

function shouldUseMacMetalOverlayHost(): boolean {
  if (process.env.STEAM_BRIDGE_MAC_NATIVE_OPENGL_HOST !== undefined) {
    return false;
  }
  return parseBooleanEnvironment(process.env.STEAM_BRIDGE_MAC_NATIVE_METAL_HOST) ?? true;
}

function assertLinuxNativeOverlayDisplayAvailable(): void {
  if (process.platform !== "linux") {
    return;
  }

  if (process.env.DISPLAY?.trim()) {
    return;
  }

  const waylandDisplay = process.env.WAYLAND_DISPLAY?.trim();
  const waylandNote = waylandDisplay
    ? ` WAYLAND_DISPLAY is set to "${waylandDisplay}", but Steam Bridge needs Xwayland's DISPLAY for this presenter.`
    : "";
  throw new Error(
    "Steam Bridge native overlay presenter requires an X11/Xwayland DISPLAY on Linux. " +
      "Start the Electron app from Steam Deck Desktop Mode, an X11 session, or an Xwayland-enabled session that exports DISPLAY. " +
      "Wayland-only and headless sessions cannot host the native overlay presenter yet." +
      waylandNote
  );
}

export function openDialogOverlay(
  dialog: number | string = "Friends",
  options: NativeOverlayPresenterOverlayOptions = {}
): NativeOverlayPresenter {
  return activateWithOverlayPresenter(
    options,
    () => {
      activateOverlay(dialog);
    },
    "transparent-input"
  );
}

export function openWebOverlay(url: string, options: NativeOverlayWebPagePresenterOptions = {}): NativeOverlayPresenter {
  const { modal, ...presenterOptions } = options;
  return activateWithOverlayPresenter(
    presenterOptions,
    () => {
      activateOverlayToWebPage(url, { modal });
    },
    "interactive"
  );
}

export function openFriendsOverlay(options: NativeOverlayWebPagePresenterOptions = {}): NativeOverlayPresenter {
  const { modal = true, ...presenterOptions } = options;
  return openWebOverlay(STEAM_FRIENDS_OVERLAY_URL, {
    ...presenterOptions,
    modal
  });
}

export function openProfileOverlay(options: NativeOverlayProfilePresenterOptions = {}): NativeOverlayPresenter {
  const { steamId64 = getSteamId().steamId64, modal = true, ...presenterOptions } = options;
  return openWebOverlay(steamCommunityProfileUrl(steamId64), {
    ...presenterOptions,
    modal
  });
}

export function openPlayersOverlay(options: NativeOverlayPlayersPresenterOptions = {}): NativeOverlayPresenter {
  const { steamId64 = getSteamId().steamId64, modal = true, ...presenterOptions } = options;
  return openWebOverlay(steamCommunityPlayersUrl(steamId64), {
    ...presenterOptions,
    modal
  });
}

export function openCommunityOverlay(
  options: NativeOverlayAppPagePresenterOptions = {}
): NativeOverlayPresenter {
  const { appId = getAppId(), modal = true, ...presenterOptions } = options;
  return openWebOverlay(steamCommunityAppUrl(appId), {
    ...presenterOptions,
    modal
  });
}

export function openStatsOverlay(options: NativeOverlayAppPagePresenterOptions = {}): NativeOverlayPresenter {
  const { appId = getAppId(), steamId64 = getSteamId().steamId64, modal = true, ...presenterOptions } = options;
  return openWebOverlay(steamCommunityUserStatsUrl(appId, steamId64), {
    ...presenterOptions,
    modal
  });
}

export function openAchievementsOverlay(
  options: NativeOverlayAppPagePresenterOptions = {}
): NativeOverlayPresenter {
  const { appId = getAppId(), steamId64 = getSteamId().steamId64, modal = true, ...presenterOptions } = options;
  return openWebOverlay(steamCommunityAchievementsUrl(appId, steamId64), {
    ...presenterOptions,
    modal
  });
}

export function openNativeUserOverlay(
  dialog: string = UserDialog.SteamId,
  steamId64: bigint | number | string = getSteamId().steamId64,
  options: NativeOverlayPresenterOverlayOptions = {}
): NativeOverlayPresenter {
  return activateWithOverlayPresenter(
    options,
    () => {
      native().overlayActivateDialogToUser(userDialogName(dialog), BigInt(normalizeSteamId64(steamId64)));
    },
    "transparent-input"
  );
}

export function openUserOverlay(options: NativeOverlayUserDialogPresenterOptions = {}): NativeOverlayPresenter {
  const { dialog = UserDialog.SteamId, route = "auto", steamId64 = getSteamId().steamId64, ...presenterOptions } = options;
  if (route === "native") {
    return openNativeUserOverlay(dialog, steamId64, presenterOptions);
  }
  return openUserEquivalentOverlay(dialog, {
    ...presenterOptions,
    steamId64
  });
}

export function openUserEquivalentOverlay(
  dialog: string = UserDialog.SteamId,
  options: NativeOverlayAppPagePresenterOptions = {}
): NativeOverlayPresenter {
  switch (userEquivalentOverlayRoute(dialog)) {
    case "profile":
      return openProfileOverlay(options);
    case "friends":
      return openFriendsOverlay(options);
    case "stats":
      return openStatsOverlay(options);
    case "achievements":
      return openAchievementsOverlay(options);
  }
}

function userEquivalentOverlayRoute(
  dialog: string = UserDialog.SteamId
): "profile" | "friends" | "stats" | "achievements" {
  const name = userDialogName(dialog);
  switch (name) {
    case "steamid":
    case "profile":
      return "profile";
    case "chat":
      return "friends";
    case "stats":
      return "stats";
    case "achievements":
      return "achievements";
    default:
      throw new Error(
        `Steam overlay user dialog "${name}" does not have a verified presenter-backed route. ` +
          'Pass route: "native" or call openNativeUserOverlay(...) to use raw ActivateGameOverlayToUser diagnostics.'
      );
  }
}

export function openCheckoutOverlay(options: Omit<SteamOverlayCheckoutTarget, "type"> = {}): NativeOverlayPresenter {
  const {
    modal = true,
    url: _url,
    steamUrl: _steamUrl,
    transactionId: _transactionId,
    returnUrl: _returnUrl,
    ...presenterOptions
  } = options;
  return openWebOverlay(resolveSteamCheckoutOverlayUrl(options), {
    ...presenterOptions,
    modal
  });
}

export function checkoutTargetFromResult(
  result: ElectronSteamOverlayCheckoutOperationResult,
  defaults: Pick<ElectronSteamOverlayCheckoutAndWaitOptions, "modal" | "returnUrl"> = {}
): SteamOverlayCheckoutTarget {
  return electronSteamOverlayCheckoutTargetFromResult(result, defaults);
}

export function openDialogEquivalentOverlay(
  dialog: number | string = "Friends",
  options: NativeOverlayAppPagePresenterOptions = {}
): NativeOverlayPresenter {
  switch (dialogEquivalentOverlayRoute(dialog)) {
    case "friends":
      return openFriendsOverlay(options);
    case "players": {
      const { appId: _appId, ...playersOptions } = options;
      return openPlayersOverlay(playersOptions);
    }
    case "community":
      return openCommunityOverlay(options);
    case "stats":
      return openStatsOverlay(options);
    case "achievements":
      return openAchievementsOverlay(options);
  }
}

function dialogEquivalentOverlayRoute(
  dialog: number | string = "Friends"
): "friends" | "players" | "community" | "stats" | "achievements" {
  const name = dialogName(dialog).toLowerCase();
  switch (name) {
    case "friends":
      return "friends";
    case "players":
      return "players";
    case "community":
    case "officialgamegroup":
      return "community";
    case "stats":
      return "stats";
    case "achievements":
      return "achievements";
    default:
      throw new Error(
        `Steam overlay dialog "${dialogName(dialog)}" does not have a verified presenter-backed route. ` +
          'Pass route: "native" or call openDialogOverlay(...) to use raw ActivateGameOverlay diagnostics.'
      );
  }
}

export function openNativeStoreOverlay(
  appId: number = getAppId(),
  flag: number = StoreFlag.None,
  options: NativeOverlayPresenterOverlayOptions = {}
): NativeOverlayPresenter {
  return activateWithOverlayPresenter(
    options,
    () => {
      native().overlayActivateToStore(appId, flag);
    },
    "interactive"
  );
}

export function openStoreOverlay(
  appId: number = getAppId(),
  flag: number = StoreFlag.None,
  options: NativeOverlayStorePresenterOptions = {}
): NativeOverlayPresenter {
  const { route = "web", modal = true, ...presenterOptions } = options;
  if (route === "native") {
    return openNativeStoreOverlay(appId, flag, presenterOptions);
  }
  return openWebOverlay(steamStoreAppUrl(appId), {
    ...presenterOptions,
    modal
  });
}

export function openSteamOverlay(target: SteamOverlayTarget): NativeOverlayPresenter {
  switch (target.type) {
    case "web": {
      const { type, url, ...options } = target;
      return openWebOverlay(url, options);
    }
    case "store": {
      const { type, appId = getAppId(), flag = StoreFlag.None, ...options } = target;
      return openStoreOverlay(appId, flag, options);
    }
    case "friends": {
      const { type, ...options } = target;
      return openFriendsOverlay(options);
    }
    case "profile": {
      const { type, ...options } = target;
      return openProfileOverlay(options);
    }
    case "players": {
      const { type, ...options } = target;
      return openPlayersOverlay(options);
    }
    case "community": {
      const { type, ...options } = target;
      return openCommunityOverlay(options);
    }
    case "stats": {
      const { type, ...options } = target;
      return openStatsOverlay(options);
    }
    case "achievements": {
      const { type, ...options } = target;
      return openAchievementsOverlay(options);
    }
    case "user": {
      const { type, ...options } = target;
      return openUserOverlay(options);
    }
    case "checkout": {
      const { type, ...options } = target;
      return openCheckoutOverlay(options);
    }
    case "dialog": {
      const { type, dialog = "Friends", route = "auto", ...options } = target;
      if (route === "native") {
        return openDialogOverlay(dialog, options);
      }
      return openDialogEquivalentOverlay(dialog, options);
    }
  }
}

function overlayActivationModeForTarget(target: SteamOverlayTarget): NativeOverlayPresenterActivationMode {
  if (target.type === "dialog" && target.route === "native") {
    return "transparent-input";
  }
  if (target.type === "user" && target.route === "native") {
    return "transparent-input";
  }
  return "interactive";
}

function assertElectronSteamOverlayTargetCanOpen(target: SteamOverlayTarget): void {
  switch (target.type) {
    case "dialog":
      if (target.route !== "native") {
        dialogEquivalentOverlayRoute(target.dialog ?? "Friends");
      }
      return;
    case "user":
      if (target.route !== "native") {
        userEquivalentOverlayRoute(target.dialog ?? UserDialog.SteamId);
      }
      return;
    case "checkout": {
      const { type: _type, ...options } = target;
      resolveSteamCheckoutOverlayUrl(options);
      return;
    }
    default:
      return;
  }
}

function assertElectronSteamOverlayTargetCanWait(target: SteamOverlayTarget): void {
  if (overlayActivationModeForTarget(target) !== "transparent-input") {
    return;
  }

  throw new Error(
    "Electron Steam overlay openAndWait() requires a presenter-backed target with reliable overlay activation " +
      'and close callbacks. Use a verified auto route, or call open({ ..., route: "native" }) only for raw diagnostics.'
  );
}

export function createElectronSteamOverlay(
  window: ElectronOverlayWindow,
  options: ElectronSteamOverlayOptions = {}
): ElectronSteamOverlay {
  const {
    closeWithWindow = true,
    overlayShortcut = true,
    presenterMode: modeOption,
    autoPrepareForNotifications = true,
    ...presenterOptions
  } = options;
  const presenterMode = resolveElectronSteamOverlayPresenterMode(modeOption);
  const shortcut = normalizeElectronSteamOverlayShortcut(overlayShortcut);
  const restoreFocusDelayMs = Math.max(0, finiteNumber(presenterOptions.restoreFocusDelayMs, 0));
  const activationBoostMs = Math.max(0, finiteNumber(presenterOptions.activationBoostMs, 0));
  const activeGraceMs = Math.max(0, finiteNumber(presenterOptions.activeGraceMs, 0));
  const managedPresenterOptions = {
    ...presenterOptions,
    restoreFocusDelayMs,
    activationBoostMs,
    activeGraceMs
  };
  const presenter =
    presenterMode === "session"
      ? createNativeOverlaySessionPresenter(electronNativeOverlaySessionOptions(window, {
          title: managedPresenterOptions.title,
          restoreFocusDelayMs: managedPresenterOptions.restoreFocusDelayMs
        }))
      : attachOverlayPresenter(electronOverlayPresenterOptions(window, managedPresenterOptions));
  let removeShortcutListener: (() => void) | undefined;
  let removeWindowSyncListeners: (() => void) | undefined;
  let notificationPresenterHandle: CallbackHandle | undefined;
  const shortcutOpenState: ElectronSteamOverlayShortcutOpenState = { opening: false };
  let closed = false;
  const assertOpen = (): void => {
    if (closed || (presenterMode === "persistent" && !presenter.isOpen())) {
      throw new Error("Electron Steam overlay is closed.");
    }
  };
  const controller: ElectronSteamOverlay = {
    presenter,
    getNativeHostAvailability(): ElectronSteamOverlayNativeHostAvailability {
      return electronSteamOverlayNativeHostAvailability(controller.snapshot());
    },
    getOpenStatus(target: SteamOverlayTarget): ElectronSteamOverlayOpenStatus {
      return electronSteamOverlayOpenStatus(controller, target);
    },
    getShortcutOpenStatus(): ElectronSteamOverlayShortcutStatus {
      return electronSteamOverlayShortcutStatus(controller, shortcut, shortcutOpenState);
    },
    open(target: SteamOverlayTarget): NativeOverlayPresenter {
      assertOpen();
      assertElectronSteamOverlayTargetCanOpen(target);
      assertElectronSteamOverlayNativeHostAvailable(controller.snapshot());
      const presenterInternal = presenter as NativeOverlayPresenterInternal;
      const activationHandle = presenterInternal.beginOverlayActivation?.(overlayActivationModeForTarget(target));
      try {
        const openedPresenter = openSteamOverlay({
          ...target,
          presenter,
          ...(activationHandle ? { [SKIP_NATIVE_OVERLAY_PRESENTER_PREPARE]: true } : {})
        } as SteamOverlayTarget);
        if (activationHandle) {
          releaseElectronSteamOverlayActivationWhenShown(controller, activationHandle);
        }
        return openedPresenter;
      } catch (error) {
        activationHandle?.disconnect();
        throw error;
      }
    },
    openShortcutTarget(): NativeOverlayPresenter | null {
      assertOpen();
      if (!shortcut.enabled) {
        return null;
      }

      const snapshot = controller.snapshot();
      if (snapshot.overlayActive || shortcutOpenState.opening || isElectronSteamOverlayShortcutOpening(snapshot)) {
        return null;
      }

      shortcutOpenState.opening = true;
      try {
        if (typeof shortcut.target === "function") {
          assertElectronSteamOverlayNativeHostAvailable(snapshot);
        }
        const target = resolveElectronSteamOverlayShortcutTarget(shortcut.target);
        const openedPresenter = controller.open(target);
        notifyElectronSteamOverlayShortcutOpened(shortcut, target);
        return openedPresenter;
      } catch (error) {
        notifyElectronSteamOverlayShortcutError(shortcut, error);
        throw error;
      } finally {
        shortcutOpenState.opening = false;
      }
    },
    async openShortcutTargetAndWait(
      options: ElectronSteamOverlayOpenAndWaitOptions = {}
    ): Promise<ElectronSteamOverlayOpenAndWaitResult | null> {
      assertOpen();
      if (!shortcut.enabled) {
        return null;
      }

      const snapshot = controller.snapshot();
      if (snapshot.overlayActive || shortcutOpenState.opening || isElectronSteamOverlayShortcutOpening(snapshot)) {
        return null;
      }

      shortcutOpenState.opening = true;
      try {
        if (typeof shortcut.target === "function") {
          assertElectronSteamOverlayNativeHostAvailable(snapshot);
        }
        const target = resolveElectronSteamOverlayShortcutTarget(shortcut.target);
        return await openElectronSteamOverlayTargetAndWait(target, options, {
          onOpened() {
            notifyElectronSteamOverlayShortcutOpened(shortcut, target);
          }
        });
      } catch (error) {
        notifyElectronSteamOverlayShortcutError(shortcut, error);
        throw error;
      } finally {
        shortcutOpenState.opening = false;
      }
    },
    async openAndWait(
      target: SteamOverlayTarget,
      options: ElectronSteamOverlayOpenAndWaitOptions = {}
    ): Promise<ElectronSteamOverlayOpenAndWaitResult> {
      return openElectronSteamOverlayTargetAndWait(target, options);
    },
    async openCheckoutAndWait<T extends ElectronSteamOverlayCheckoutOperationResult>(
      operation: () => T | Promise<T>,
      options: ElectronSteamOverlayCheckoutAndWaitOptions = {}
    ): Promise<ElectronSteamOverlayCheckoutAndWaitResult<T>> {
      assertOpen();
      const { modal, returnUrl, ...waitOptions } = options;
      assertElectronSteamOverlayNativeHostAvailable(controller.snapshot());
      const presenterInternal = presenter as NativeOverlayPresenterInternal;
      const activationHandle = presenterInternal.beginOverlayActivation?.("interactive");
      let activationReleased = false;
      const releaseActivation = (): void => {
        if (activationReleased) {
          return;
        }
        activationReleased = true;
        activationHandle?.disconnect();
      };

      try {
        const transaction = await runElectronSteamOverlayAbortableOperation(
          controller,
          "finish checkout operation",
          operation,
          waitOptions.signal
        );
        const target = electronSteamOverlayCheckoutTargetFromResult(transaction, { modal, returnUrl });
        const opened = await openElectronSteamOverlayTargetAndWait(target, waitOptions, {
          activationHandle
        });
        return {
          transaction,
          target,
          shown: opened.shown,
          parked: opened.parked
        };
      } catch (error) {
        releaseActivation();
        throw error;
      }
    },
    async withCheckoutPrepared<T>(
      operation: () => T | Promise<T>,
      options: ElectronSteamOverlayCheckoutPrepareOptions = {}
    ): Promise<T> {
      assertOpen();
      assertElectronSteamOverlayNativeHostAvailable(controller.snapshot());
      const presenterInternal = presenter as NativeOverlayPresenterInternal;
      const activationHandle = presenterInternal.beginOverlayActivation?.("interactive");
      if (!activationHandle) {
        presenter.prepareForOverlay(options.durationMs);
      }
      try {
        return await runElectronSteamOverlayAbortableOperation(
          controller,
          "finish checkout preparation operation",
          operation,
          options.signal
        );
      } finally {
        activationHandle?.disconnect();
      }
    },
    prepareForCheckout(durationMs?: number): NativeOverlayPresenter {
      assertOpen();
      assertElectronSteamOverlayNativeHostAvailable(controller.snapshot());
      presenter.prepareForOverlay(durationMs);
      return presenter;
    },
    prepareForNotification(durationMs?: number): NativeOverlayPresenter {
      assertOpen();
      presenter.prepareForPassiveOverlay(durationMs);
      return presenter;
    },
    waitForOverlayReady(options?: ElectronSteamOverlayWaitOptions): Promise<ElectronSteamOverlaySnapshot> {
      assertOpen();
      return waitForElectronSteamOverlayState(
        controller,
        "be ready",
        (snapshot) => snapshot.diagnostics?.overlayEnabled === true,
        options,
        {
          forcePolling: true,
          refreshDiagnostics: true
        }
      );
    },
    waitForOverlayShown(options?: ElectronSteamOverlayWaitOptions): Promise<ElectronSteamOverlaySnapshot> {
      assertOpen();
      return waitForElectronSteamOverlayState(
        controller,
        "become active",
        (snapshot) => snapshot.overlayActive === true,
        options
      );
    },
    waitForOverlayClosed(options?: ElectronSteamOverlayWaitOptions): Promise<ElectronSteamOverlaySnapshot> {
      assertOpen();
      return waitForElectronSteamOverlayState(
        controller,
        "close",
        (snapshot) => snapshot.overlayWasActive === true && snapshot.overlayActive === false,
        options
      );
    },
    parkWhenSteamOverlayCloses(options?: ElectronSteamOverlayWaitOptions): Promise<ElectronSteamOverlaySnapshot> {
      assertOpen();
      return waitForElectronSteamOverlayState(
        controller,
        "close and park",
        (snapshot) =>
          snapshot.overlayWasActive === true &&
          snapshot.overlayActive === false &&
          isElectronSteamOverlayParked(snapshot),
        options
      );
    },
    close(): void {
      if (closed) {
        return;
      }
      closed = true;
      removeWindowSyncListeners?.();
      removeWindowSyncListeners = undefined;
      removeShortcutListener?.();
      removeShortcutListener = undefined;
      notificationPresenterHandle?.disconnect();
      notificationPresenterHandle = undefined;
      presenter.close();
    },
    disconnect(): void {
      controller.close();
    },
    pump(): void {
      presenter.pump();
    },
    isOpen(): boolean {
      return !closed && (presenterMode === "session" || presenter.isOpen());
    },
    snapshot(): ElectronSteamOverlaySnapshot {
      return {
        ...presenter.snapshot(),
        electronOverlay: {
          presenterMode,
          closeWithWindow,
          autoPrepareForNotifications,
          restoreFocusDelayMs,
          activationBoostMs,
          activeGraceMs,
          overlayShortcut: snapshotElectronSteamOverlayShortcut(shortcut)
        }
      };
    }
  };

  removeWindowSyncListeners = installElectronSteamOverlayWindowSync(window, controller, presenterMode);
  removeShortcutListener = installElectronSteamOverlayShortcut(window, controller, shortcut, shortcutOpenState);
  if (autoPrepareForNotifications) {
    notificationPresenterHandle = registerElectronNotificationPresenter(presenter);
  }

  if (closeWithWindow && typeof window.once === "function") {
    window.once("closed", () => {
      controller.close();
    });
  }

  return controller;

  async function openElectronSteamOverlayTargetAndWait(
    target: SteamOverlayTarget,
    options: ElectronSteamOverlayOpenAndWaitOptions = {},
    lifecycle: ElectronSteamOverlayTargetWaitLifecycle = {}
  ): Promise<ElectronSteamOverlayOpenAndWaitResult> {
    let activationHandle = lifecycle.activationHandle;
    let activationReleased = false;
    const releaseActivation = (): void => {
      if (activationReleased) {
        return;
      }
      activationReleased = true;
      activationHandle?.disconnect();
    };
    try {
      assertOpen();
      assertElectronSteamOverlayTargetCanOpen(target);
      assertElectronSteamOverlayTargetCanWait(target);
      assertElectronSteamOverlayNativeHostAvailable(controller.snapshot());
      if (!activationHandle) {
        const presenterInternal = presenter as NativeOverlayPresenterInternal;
        activationHandle = presenterInternal.beginOverlayActivation?.(overlayActivationModeForTarget(target));
      }
      await controller.waitForOverlayReady({
        timeoutMs: finiteNumber(options.showTimeoutMs, 15000),
        signal: options.signal
      });
      openSteamOverlay({
        ...target,
        presenter,
        ...(activationHandle ? { [SKIP_NATIVE_OVERLAY_PRESENTER_PREPARE]: true } : {})
      } as SteamOverlayTarget);
      lifecycle.onOpened?.();
      const shown = await controller.waitForOverlayShown({
        timeoutMs: finiteNumber(options.showTimeoutMs, 15000),
        signal: options.signal
      });
      releaseActivation();
      const parked = await controller.parkWhenSteamOverlayCloses({
        timeoutMs: finiteNumber(options.closeTimeoutMs, 300000),
        signal: options.signal
      });
      return { shown, parked };
    } catch (error) {
      releaseActivation();
      throw error;
    }
  }
}

function resolveElectronSteamOverlayPresenterMode(
  modeOption?: ElectronSteamOverlayPresenterMode
): ElectronSteamOverlayPresenterMode {
  if (modeOption !== undefined) {
    if (modeOption === "persistent" || modeOption === "session") {
      return modeOption;
    }
    throw new Error(`Unsupported Electron Steam overlay presenter mode: ${String(modeOption)}`);
  }

  const disabled = parseBooleanEnvironment(process.env.STEAM_BRIDGE_DISABLE_ELECTRON_OVERLAY_PRESENTER);
  if (disabled === true) {
    return "session";
  }

  const envMode = process.env.STEAM_BRIDGE_ELECTRON_OVERLAY_PRESENTER;
  if (!envMode) {
    return "persistent";
  }

  const normalized = envMode.trim().toLowerCase();
  if (["persistent", "presenter", "native", "auto", "on", "true", "1"].includes(normalized)) {
    return "persistent";
  }
  if (["session", "fallback", "compatibility", "off", "false", "0", "disabled"].includes(normalized)) {
    return "session";
  }

  process.emitWarning(
    `Ignoring unsupported STEAM_BRIDGE_ELECTRON_OVERLAY_PRESENTER value: ${envMode}`,
    { type: "SteamBridgeOverlayPresenterWarning" }
  );
  return "persistent";
}

function parseBooleanEnvironment(value: string | undefined): boolean | undefined {
  if (value === undefined) {
    return undefined;
  }

  const normalized = value.trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(normalized)) {
    return true;
  }
  if (["0", "false", "no", "off"].includes(normalized)) {
    return false;
  }
  return undefined;
}

function isOverlayNeedsPresentPollingEnabledForProcess(): boolean {
  if (parseBooleanEnvironment(process.env.STEAM_BRIDGE_DISABLE_OVERLAY_NEEDS_PRESENT) === true) {
    return false;
  }
  if (process.platform === "darwin") {
    return false;
  }
  return true;
}

function createNativeOverlaySessionPresenter(options: NativeOverlaySessionOptions = {}): NativeOverlayPresenter {
  const title = options.title ?? "Steam Bridge Electron Overlay Session";
  const pumpIntervalMs = Math.max(1, options.pumpIntervalMs ?? 33);
  const startedAt = Date.now();
  let closed = false;
  let session: NativeOverlaySession | undefined;
  let lastSessionSnapshot: NativeOverlaySessionSnapshot | undefined;
  let lastError: unknown;
  const stateListeners = new Set<() => void>();

  const ensureSession = (): NativeOverlaySession => {
    if (closed) {
      throw new Error("Electron Steam overlay is closed.");
    }
    if (!session || !session.isOpen()) {
      session = startNativeOverlaySession({ ...options, title, pumpIntervalMs });
    }
    return session;
  };

  const prepare = (): void => {
    try {
      const activeSession = ensureSession();
      activeSession.pump();
      lastSessionSnapshot = activeSession.snapshot();
      emitStateChange();
    } catch (error) {
      lastError = error;
      throw error;
    }
  };

  const close = (): void => {
    if (closed) {
      return;
    }
    closed = true;
    session?.close();
    session = undefined;
    emitStateChange();
    stateListeners.clear();
  };

  const presenter: NativeOverlayPresenterInternal = {
    close,
    disconnect: close,
    pump(): void {
      session?.pump();
      if (session) {
        lastSessionSnapshot = session.snapshot();
        emitStateChange();
      }
    },
    prepareForOverlay: prepare,
    prepareForPassiveOverlay: prepare,
    beginOverlayActivation(): CallbackHandle {
      prepare();
      return {
        disconnect() {}
      };
    },
    show: prepare,
    hide(): void {
      session?.close();
      session = undefined;
      emitStateChange();
    },
    isOpen(): boolean {
      return !closed;
    },
    snapshot(): NativeOverlayPresenterSnapshot {
      const snapshot = session?.snapshot() ?? lastSessionSnapshot;
      const diagnostics = snapshot?.diagnostics;
      const nativeProbeOpen = closed ? false : (snapshot?.nativeProbeOpen ?? false);
      const nativeHostOpen = closed ? false : (snapshot?.nativeHostOpen ?? false);
      const attached = nativeProbeOpen || nativeHostOpen;
      const overlayActive = closed ? false : (snapshot?.overlayActive ?? false);
      const overlayNeedsPresent = closed ? false : (diagnostics?.overlayNeedsPresent ?? false);
      const overlayNeedsPresentPollingEnabled =
        diagnostics?.overlayNeedsPresentPollingEnabled ?? safeBoolean(() => isOverlayNeedsPresentPollingEnabled());
      const active = attached && (overlayActive || overlayNeedsPresent);
      const fps = Math.round(1000 / pumpIntervalMs);
      const bounds = closed ? undefined : snapshot?.bounds;
      return {
        title,
        backend: closed ? "none" : (snapshot?.backend ?? "none"),
        ...(bounds ? { bounds } : {}),
        closed,
        startedAt,
        mode: closed ? "closed" : attached ? (active ? "active" : "passive") : "hidden",
        attached,
        nativeProbeOpen,
        nativeHostOpen,
        clickThrough: !active,
        focusable: nativeProbeOpen,
        transparent: !active,
        idleFps: 0,
        needsPresentFps: fps,
        activeOverlayFps: fps,
        pollIntervalMs: pumpIntervalMs,
        currentFps: attached ? fps : 0,
        pumpCount: snapshot?.pumpCount ?? 0,
        pollCount: 0,
        overlayActive,
        overlayWasActive: snapshot?.overlayWasActive ?? false,
        overlayNeedsPresent,
        overlayNeedsPresentPollingEnabled,
        lastOverlayEvent: snapshot?.lastOverlayEvent,
        lastPumpAt: snapshot?.lastPumpAt,
        lastError: snapshot?.lastError ?? lastError,
        diagnostics
      };
    },
    onStateChange: subscribeStateChange
  };

  return presenter;

  function subscribeStateChange(listener: () => void): CallbackHandle {
    stateListeners.add(listener);
    return {
      disconnect() {
        stateListeners.delete(listener);
      }
    };
  }

  function emitStateChange(): void {
    for (const listener of Array.from(stateListeners)) {
      try {
        listener();
      } catch (error) {
        process.emitWarning(error instanceof Error ? error : String(error), {
          type: "SteamBridgeOverlayStateListenerWarning"
        });
      }
    }
  }
}

const ELECTRON_STEAM_OVERLAY_WINDOW_SYNC_EVENTS: ElectronOverlayWindowGeometryEvent[] = [
  "move",
  "moved",
  "resize",
  "resized",
  "maximize",
  "unmaximize",
  "restore",
  "show",
  "enter-full-screen",
  "leave-full-screen",
  "enter-html-full-screen",
  "leave-html-full-screen"
];

function installElectronSteamOverlayWindowSync(
  window: ElectronOverlayWindow,
  controller: ElectronSteamOverlay,
  presenterMode: ElectronSteamOverlayPresenterMode
): (() => void) | undefined {
  if (presenterMode !== "persistent" || typeof window.on !== "function") {
    return undefined;
  }

  const sync = (): void => {
    if (!controller.isOpen()) {
      return;
    }
    try {
      controller.pump();
    } catch (error) {
      process.emitWarning(error instanceof Error ? error : String(error), {
        type: "SteamBridgeOverlayWindowSyncWarning"
      });
    }
  };

  for (const event of ELECTRON_STEAM_OVERLAY_WINDOW_SYNC_EVENTS) {
    window.on(event, sync);
  }

  return () => {
    for (const event of ELECTRON_STEAM_OVERLAY_WINDOW_SYNC_EVENTS) {
      removeElectronSteamOverlayWindowListener(window, event, sync);
    }
  };
}

function removeElectronSteamOverlayWindowListener(
  window: ElectronOverlayWindow,
  event: ElectronOverlayWindowGeometryEvent,
  handler: () => void
): void {
  try {
    if (typeof window.off === "function") {
      window.off(event, handler);
    } else if (typeof window.removeListener === "function") {
      window.removeListener(event, handler);
    }
  } catch (error) {
    if (!isElectronWindowDestroyed(window)) {
      throw error;
    }
  }
}

function installElectronSteamOverlayShortcut(
  window: ElectronOverlayWindow,
  controller: ElectronSteamOverlay,
  shortcut: NormalizedElectronSteamOverlayShortcutOptions,
  shortcutOpenState: ElectronSteamOverlayShortcutOpenState
): () => void {
  const webContents = window.webContents;
  if (!shortcut.enabled || typeof webContents.on !== "function") {
    return () => {};
  }

  const handleShortcut = (event?: ElectronOverlayInputEvent): ElectronSteamOverlayShortcutHandleResult => {
    try {
      const snapshot = controller.snapshot();
      if (snapshot.overlayActive) {
        return "ignored";
      }

      if (shortcutOpenState.opening || isElectronSteamOverlayShortcutOpening(snapshot)) {
        if (shortcut.preventDefault) {
          event?.preventDefault?.();
        }
        return "handled";
      }

      if (shortcut.preventDefault) {
        event?.preventDefault?.();
      }

      shortcutOpenState.opening = true;
      if (typeof shortcut.target === "function") {
        assertElectronSteamOverlayNativeHostAvailable(snapshot);
      }
      const target = resolveElectronSteamOverlayShortcutTarget(shortcut.target);
      controller.open(target);
      notifyElectronSteamOverlayShortcutOpened(shortcut, target);
      return "opened";
    } catch (error) {
      notifyElectronSteamOverlayShortcutError(shortcut, error);
      return "handled";
    } finally {
      shortcutOpenState.opening = false;
    }
  };

  const handler = (event: ElectronOverlayInputEvent, input: ElectronOverlayKeyboardInput): void => {
    if (isElectronSteamOverlayShortcutInput(input)) {
      handleShortcut(event);
    }
  };
  const removeGlobalShortcut = installElectronSteamOverlayGlobalShortcut(window, controller, handleShortcut);

  webContents.on("before-input-event", handler);

  return () => {
    removeGlobalShortcut();
    if (isElectronWebContentsDestroyed(webContents)) {
      return;
    }

    try {
      if (typeof webContents.off === "function") {
        webContents.off("before-input-event", handler);
      } else if (typeof webContents.removeListener === "function") {
        webContents.removeListener("before-input-event", handler);
      }
    } catch (error) {
      if (!isElectronWebContentsDestroyed(webContents)) {
        throw error;
      }
    }
  };
}

function installElectronSteamOverlayGlobalShortcut(
  window: ElectronOverlayWindow,
  controller: ElectronSteamOverlay,
  handleShortcut: () => ElectronSteamOverlayShortcutHandleResult
): () => void {
  if (process.platform !== "darwin") {
    return () => {};
  }

  const globalShortcut = loadElectronGlobalShortcut();
  const shortcutWindow = window as ElectronOverlayWindowShortcutEvents;
  if (!globalShortcut || typeof shortcutWindow.on !== "function") {
    return () => {};
  }

  const accelerator = "Shift+Tab";
  let closed = false;
  let registered = false;
  let suspended = false;
  let warnedRegisterFailure = false;

  const unregister = (): void => {
    if (!registered) {
      return;
    }
    registered = false;
    try {
      globalShortcut.unregister(accelerator);
    } catch (error) {
      process.emitWarning(error instanceof Error ? error : String(error), {
        type: "SteamBridgeOverlayShortcutWarning"
      });
    }
  };

  const registerIfFocused = (): void => {
    if (closed || suspended || registered || shortcutWindow.isFocused?.() !== true) {
      return;
    }
    let didRegister = false;
    try {
      didRegister = globalShortcut.register(accelerator, () => {
        const result = handleShortcut();
        if (result === "opened") {
          suspendUntilOverlayCloses();
        }
      });
    } catch (error) {
      process.emitWarning(error instanceof Error ? error : String(error), {
        type: "SteamBridgeOverlayShortcutWarning"
      });
      return;
    }
    if (didRegister) {
      registered = true;
    } else if (!warnedRegisterFailure) {
      warnedRegisterFailure = true;
      process.emitWarning("Could not register macOS Shift+Tab overlay shortcut.", {
        type: "SteamBridgeOverlayShortcutWarning"
      });
    }
  };

  const suspendUntilOverlayCloses = (): void => {
    suspended = true;
    unregister();
    void (async () => {
      let overlayClosed = false;
      try {
        await controller.waitForOverlayShown({ timeoutMs: ELECTRON_STEAM_OVERLAY_OPEN_GUARD_TIMEOUT_MS });
        await controller.waitForOverlayClosed({ timeoutMs: 300000 });
        overlayClosed = true;
      } catch (error) {
        if (!closed) {
          emitElectronSteamOverlayShortcutWarning(error);
        }
      } finally {
        if (overlayClosed && !closed) {
          restoreElectronSteamOverlayShortcutWindowFocus(window);
        }
        suspended = false;
        registerIfFocused();
      }
    })();
  };

  const onFocus = (): void => {
    registerIfFocused();
  };
  const onBlur = (): void => {
    unregister();
  };

  shortcutWindow.on("focus", onFocus);
  shortcutWindow.on("blur", onBlur);
  registerIfFocused();

  return () => {
    closed = true;
    unregister();
    removeElectronSteamOverlayShortcutWindowListener(shortcutWindow, "focus", onFocus);
    removeElectronSteamOverlayShortcutWindowListener(shortcutWindow, "blur", onBlur);
  };
}

function restoreElectronSteamOverlayShortcutWindowFocus(window: ElectronOverlayWindow): void {
  if (isElectronWindowDestroyed(window) || window.isFocused?.() === true) {
    return;
  }

  try {
    if (window.isMinimized?.()) {
      window.restore?.();
    }
    window.show?.();
    window.focus?.();
    if (!isElectronWebContentsDestroyed(window.webContents)) {
      window.webContents.invalidate();
    }
  } catch (error) {
    if (!isElectronWindowDestroyed(window)) {
      process.emitWarning(error instanceof Error ? error : String(error), {
        type: "SteamBridgeOverlayShortcutWarning"
      });
    }
  }
}

function emitElectronSteamOverlayShortcutWarning(error: unknown): void {
  if (isSteamOverlayNativeHostUnavailableError(error)) {
    return;
  }

  process.emitWarning(error instanceof Error ? error : String(error), {
    type: "SteamBridgeOverlayShortcutWarning"
  });
}

function loadElectronGlobalShortcut(): ElectronGlobalShortcutApi | undefined {
  try {
    const electron = require("electron") as ElectronShortcutApi;
    return electron.globalShortcut;
  } catch (_error) {
    return undefined;
  }
}

function removeElectronSteamOverlayShortcutWindowListener(
  window: ElectronOverlayWindowShortcutEvents,
  event: ElectronOverlayWindowShortcutEvent,
  handler: () => void
): void {
  try {
    if (typeof window.off === "function") {
      window.off(event, handler);
    } else if (typeof window.removeListener === "function") {
      window.removeListener(event, handler);
    }
  } catch (error) {
    if (!isElectronWindowDestroyed(window)) {
      throw error;
    }
  }
}

function isElectronWindowDestroyed(window: { isDestroyed?(): boolean }): boolean {
  try {
    return typeof window.isDestroyed === "function" && window.isDestroyed();
  } catch {
    return true;
  }
}

function notifyElectronSteamOverlayShortcutOpened(
  shortcut: NormalizedElectronSteamOverlayShortcutOptions,
  target: SteamOverlayTarget
): void {
  if (!shortcut.onOpen) {
    return;
  }
  try {
    shortcut.onOpen(target);
  } catch (error) {
    if (shortcut.onError) {
      try {
        shortcut.onError(error);
      } catch (onErrorError) {
        process.emitWarning(onErrorError instanceof Error ? onErrorError : String(onErrorError), {
          type: "SteamBridgeOverlayShortcutWarning"
        });
      }
    } else {
      process.emitWarning(error instanceof Error ? error : String(error), {
        type: "SteamBridgeOverlayShortcutWarning"
      });
    }
  }
}

function notifyElectronSteamOverlayShortcutError(
  shortcut: NormalizedElectronSteamOverlayShortcutOptions,
  error: unknown
): void {
  if (!shortcut.onError) {
    emitElectronSteamOverlayShortcutWarning(error);
    return;
  }

  try {
    shortcut.onError(error);
  } catch (onErrorError) {
    emitElectronSteamOverlayShortcutWarning(onErrorError);
  }
}

function isElectronWebContentsDestroyed(webContents: ElectronOverlayWindow["webContents"]): boolean {
  try {
    return typeof webContents.isDestroyed === "function" && webContents.isDestroyed();
  } catch {
    return true;
  }
}

function waitForElectronSteamOverlayState(
  controller: ElectronSteamOverlay,
  stateLabel: string,
  predicate: (snapshot: ElectronSteamOverlaySnapshot) => boolean,
  options: ElectronSteamOverlayWaitOptions = {},
  internalOptions: ElectronSteamOverlayStateWaitInternalOptions = {}
): Promise<ElectronSteamOverlaySnapshot> {
  const timeoutMs = Math.max(0, finiteNumber(options.timeoutMs, 15000));
  const deadline = Date.now() + timeoutMs;
  const signal = options.signal;

  return new Promise((resolve, reject) => {
    let timeoutTimer: NodeJS.Timeout | undefined;
    let fallbackPollTimer: NodeJS.Timeout | undefined;
    let abortHandler: (() => void) | undefined;
    let stateChangeHandle: CallbackHandle | undefined;
    let settled = false;
    let lastSnapshot: ElectronSteamOverlaySnapshot | undefined;

    const cleanup = (): void => {
      if (timeoutTimer) {
        clearTimeout(timeoutTimer);
        timeoutTimer = undefined;
      }
      if (fallbackPollTimer) {
        clearTimeout(fallbackPollTimer);
        fallbackPollTimer = undefined;
      }
      if (abortHandler) {
        signal?.removeEventListener("abort", abortHandler);
        abortHandler = undefined;
      }
      stateChangeHandle?.disconnect();
      stateChangeHandle = undefined;
    };

    const settleReject = (error: unknown): void => {
      if (settled) {
        return;
      }
      settled = true;
      cleanup();
      reject(error);
    };

    const settleResolve = (snapshot: ElectronSteamOverlaySnapshot): void => {
      if (settled) {
        return;
      }
      settled = true;
      cleanup();
      resolve(snapshot);
    };

    abortHandler = (): void => {
      settleReject(new SteamOverlayWaitAbortedError(stateLabel, lastSnapshot));
    };

    const check = (): boolean => {
      let snapshot: ElectronSteamOverlaySnapshot;
      try {
        snapshot = controller.snapshot();
        if (internalOptions.refreshDiagnostics) {
          snapshot = refreshElectronSteamOverlaySnapshotDiagnostics(snapshot);
        }
        lastSnapshot = snapshot;
      } catch (error) {
        settleReject(error);
        return true;
      }

      if (signal?.aborted) {
        abortHandler?.();
        return true;
      }

      const unavailableError = electronSteamOverlayNativeHostUnavailableError(snapshot);
      if (unavailableError) {
        settleReject(unavailableError);
        return true;
      }

      if (predicate(snapshot)) {
        settleResolve(snapshot);
        return true;
      }

      if (!controller.isOpen()) {
        settleReject(new SteamOverlayWaitClosedError(stateLabel, snapshot));
        return true;
      }

      return false;
    };

    const scheduleFallbackPoll = (): void => {
      if (
        settled ||
        (!internalOptions.forcePolling && !shouldUseElectronSteamOverlayFallbackPolling(controller, stateChangeHandle))
      ) {
        return;
      }
      const remainingMs = deadline - Date.now();
      if (remainingMs <= 0) {
        return;
      }
      fallbackPollTimer = setTimeout(() => {
        fallbackPollTimer = undefined;
        if (!check()) {
          scheduleFallbackPoll();
        }
      }, Math.min(ELECTRON_STEAM_OVERLAY_SESSION_WAIT_POLL_INTERVAL_MS, remainingMs));
    };

    signal?.addEventListener("abort", abortHandler, { once: true });
    stateChangeHandle = subscribeElectronSteamOverlayStateChanges(controller, () => {
      check();
    });

    if (check()) {
      return;
    }

    if (timeoutMs <= 0) {
      settleReject(new SteamOverlayWaitTimeoutError(stateLabel, timeoutMs, lastSnapshot));
      return;
    }

    timeoutTimer = setTimeout(() => {
      if (!check()) {
        settleReject(new SteamOverlayWaitTimeoutError(stateLabel, timeoutMs, lastSnapshot));
      }
    }, timeoutMs);
    scheduleFallbackPoll();
  });
}

const ELECTRON_STEAM_OVERLAY_SESSION_WAIT_POLL_INTERVAL_MS = 50;
const ELECTRON_STEAM_OVERLAY_OPEN_GUARD_TIMEOUT_MS = 15000;

interface ElectronSteamOverlayStateWaitInternalOptions {
  forcePolling?: boolean;
  refreshDiagnostics?: boolean;
}

function refreshElectronSteamOverlaySnapshotDiagnostics(
  snapshot: ElectronSteamOverlaySnapshot
): ElectronSteamOverlaySnapshot {
  try {
    return { ...snapshot, diagnostics: getOverlayDiagnostics() };
  } catch {
    return snapshot;
  }
}

function assertElectronSteamOverlayNativeHostAvailable(snapshot: ElectronSteamOverlaySnapshot): void {
  const error = electronSteamOverlayNativeHostUnavailableError(snapshot);
  if (error) {
    throw error;
  }
}

function electronSteamOverlayNativeHostUnavailableError(
  snapshot: ElectronSteamOverlaySnapshot
): SteamOverlayNativeHostUnavailableError | undefined {
  if (snapshot.electronOverlay.presenterMode === "session" || !snapshot.nativeHostUnavailableReason) {
    return undefined;
  }

  return new SteamOverlayNativeHostUnavailableError(snapshot);
}

function electronSteamOverlayNativeHostAvailability(
  snapshot: ElectronSteamOverlaySnapshot
): ElectronSteamOverlayNativeHostAvailability {
  const unavailableError = electronSteamOverlayNativeHostUnavailableError(snapshot);
  if (!unavailableError) {
    return {
      available: true,
      snapshot,
      diagnostics: snapshot.diagnostics,
      macOverlayEnvironment: snapshot.macOverlayEnvironment
    };
  }

  return {
    available: false,
    snapshot,
    diagnostics: snapshot.diagnostics,
    code: unavailableError.code,
    reason: unavailableError.reason,
    nativeHostUnavailableReason: unavailableError.reason,
    macOverlayEnvironment: unavailableError.macOverlayEnvironment
  };
}

function electronSteamOverlayOpenStatus(
  controller: ElectronSteamOverlay,
  target: SteamOverlayTarget
): ElectronSteamOverlayOpenStatus {
  const snapshot = controller.snapshot();
  const nativeHostAvailability = electronSteamOverlayNativeHostAvailability(snapshot);
  const unavailableError = electronSteamOverlayNativeHostUnavailableError(snapshot);

  if (!controller.isOpen()) {
    return {
      canOpen: false,
      canWait: false,
      target,
      snapshot,
      nativeHostAvailability,
      reason: "closed",
      waitReason: "closed",
      message: "Electron Steam overlay is closed."
    };
  }

  try {
    assertElectronSteamOverlayTargetCanOpen(target);
  } catch (error) {
    return {
      canOpen: false,
      canWait: false,
      target,
      snapshot,
      nativeHostAvailability,
      reason: "unsupported-target",
      waitReason: "unsupported-target",
      message: error instanceof Error ? error.message : String(error)
    };
  }

  if (unavailableError) {
    return {
      canOpen: false,
      canWait: false,
      target,
      snapshot,
      nativeHostAvailability,
      reason: "native-host-unavailable",
      waitReason: "native-host-unavailable",
      message: unavailableError.message
    };
  }

  try {
    assertElectronSteamOverlayTargetCanWait(target);
    return {
      canOpen: true,
      canWait: true,
      target,
      snapshot,
      nativeHostAvailability
    };
  } catch (error) {
    return {
      canOpen: true,
      canWait: false,
      target,
      snapshot,
      nativeHostAvailability,
      waitReason: "not-waitable",
      message: error instanceof Error ? error.message : String(error)
    };
  }
}

function electronSteamOverlayShortcutStatus(
  controller: ElectronSteamOverlay,
  shortcut: NormalizedElectronSteamOverlayShortcutOptions,
  shortcutOpenState: ElectronSteamOverlayShortcutOpenState
): ElectronSteamOverlayShortcutStatus {
  const snapshot = controller.snapshot();
  const shortcutSnapshot = snapshot.electronOverlay.overlayShortcut;
  const nativeHostAvailability = electronSteamOverlayNativeHostAvailability(snapshot);
  const unavailableError = electronSteamOverlayNativeHostUnavailableError(snapshot);
  const base = {
    enabled: shortcut.enabled,
    snapshot,
    shortcut: shortcutSnapshot,
    nativeHostAvailability
  };

  if (!controller.isOpen()) {
    return {
      ...base,
      canOpen: false,
      canWait: false,
      reason: "closed",
      waitReason: "closed",
      message: "Electron Steam overlay is closed."
    };
  }

  if (!shortcut.enabled) {
    return {
      ...base,
      canOpen: false,
      canWait: false,
      reason: "disabled",
      waitReason: "disabled",
      message: "Electron Steam overlay shortcut is disabled."
    };
  }

  if (snapshot.overlayActive) {
    return {
      ...base,
      canOpen: false,
      canWait: false,
      reason: "overlay-active",
      waitReason: "overlay-active",
      message: "Steam overlay is already active."
    };
  }

  if (shortcutOpenState.opening || isElectronSteamOverlayShortcutOpening(snapshot)) {
    return {
      ...base,
      canOpen: false,
      canWait: false,
      reason: "opening",
      waitReason: "opening",
      message: "Electron Steam overlay shortcut is already opening."
    };
  }

  if (typeof shortcut.target === "function") {
    if (unavailableError) {
      return {
        ...base,
        canOpen: false,
        canWait: false,
        reason: "native-host-unavailable",
        waitReason: "native-host-unavailable",
        message: unavailableError.message
      };
    }

    return {
      ...base,
      canOpen: false,
      canWait: false,
      reason: "dynamic-target",
      waitReason: "dynamic-target",
      message:
        "Electron Steam overlay shortcut target is dynamic; call openShortcutTarget() or openShortcutTargetAndWait() to resolve it."
    };
  }

  const target = resolveElectronSteamOverlayShortcutTarget(shortcut.target);
  const targetStatus = electronSteamOverlayOpenStatus(controller, target);
  return {
    ...base,
    canOpen: targetStatus.canOpen,
    canWait: targetStatus.canWait,
    target,
    targetStatus,
    reason: targetStatus.reason,
    waitReason: targetStatus.waitReason,
    message: targetStatus.message
  };
}

function formatNativeOverlayHostUnavailableReason(reason: NativeOverlayHostUnavailableReason): string {
  switch (reason) {
    case "macos-screen-locked":
      return "macOS screen is locked";
    case "macos-display-asleep":
      return "macOS display is asleep";
    default:
      return reason;
  }
}

function formatSteamOverlayWaitTimeoutMessage(
  state: string,
  timeoutMs: number,
  snapshot?: ElectronSteamOverlaySnapshot
): string {
  return appendSteamOverlayWaitSnapshotState(
    `Timed out waiting for Steam overlay to ${state} after ${timeoutMs}ms.`,
    snapshot
  );
}

function formatSteamOverlayWaitAbortedMessage(
  state: string,
  snapshot?: ElectronSteamOverlaySnapshot
): string {
  return appendSteamOverlayWaitSnapshotState(`Aborted waiting for Steam overlay to ${state}.`, snapshot);
}

function formatSteamOverlayWaitClosedMessage(
  state: string,
  snapshot?: ElectronSteamOverlaySnapshot
): string {
  return appendSteamOverlayWaitSnapshotState(
    `Electron Steam overlay closed while waiting for Steam overlay to ${state}.`,
    snapshot
  );
}

function appendSteamOverlayWaitSnapshotState(message: string, snapshot?: ElectronSteamOverlaySnapshot): string {
  if (!snapshot) {
    return message;
  }

  let details =
    `${message} Last presenter state: mode=${snapshot.mode}, backend=${snapshot.backend ?? "unknown"}, ` +
    `attached=${snapshot.attached}, nativeHostOpen=${snapshot.nativeHostOpen ?? "unknown"}, ` +
    `overlayActive=${snapshot.overlayActive}, overlayWasActive=${snapshot.overlayWasActive}, ` +
    `overlayNeedsPresent=${snapshot.overlayNeedsPresent}, currentFps=${snapshot.currentFps}, ` +
    `nativeHostUnavailable=${snapshot.nativeHostUnavailableReason ?? "none"}.`;

  if (snapshot.diagnostics) {
    const diagnostics = snapshot.diagnostics;
    details +=
      ` Steam overlay diagnostics: steamRunning=${diagnostics.steamRunning}, appId=${diagnostics.appId}, ` +
      `overlayEnabled=${diagnostics.overlayEnabled}, overlayNeedsPresent=${diagnostics.overlayNeedsPresent}, ` +
      `steamDeck=${diagnostics.steamDeck}, bigPicture=${diagnostics.bigPicture}, ` +
      `process=${diagnostics.platform}/${diagnostics.arch}/${diagnostics.pid}.`;
  }

  if (snapshot.macOverlayEnvironment) {
    const environment = snapshot.macOverlayEnvironment;
    details +=
      ` macOverlayEnvironment: screenLocked=${environment.screenLocked}, ` +
      `displayAsleep=${environment.displayAsleep}.`;
  }

  return details;
}

function releaseElectronSteamOverlayActivationWhenShown(
  controller: ElectronSteamOverlay,
  activationHandle: CallbackHandle
): void {
  let released = false;
  const release = (): void => {
    if (released) {
      return;
    }
    released = true;
    try {
      activationHandle.disconnect();
    } catch (error) {
      process.emitWarning(error instanceof Error ? error : String(error), {
        type: "SteamBridgeOverlayActivationWarning"
      });
    }
  };

  let waitForShown: Promise<ElectronSteamOverlaySnapshot>;
  try {
    waitForShown = controller.waitForOverlayShown({
      timeoutMs: ELECTRON_STEAM_OVERLAY_OPEN_GUARD_TIMEOUT_MS
    });
  } catch {
    release();
    return;
  }

  void waitForShown.then(release, release);
}

function runElectronSteamOverlayAbortableOperation<T>(
  controller: ElectronSteamOverlay,
  stateLabel: string,
  operation: () => T | Promise<T>,
  signal?: AbortSignal
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    let abortHandler: (() => void) | undefined;
    let stateChangeHandle: CallbackHandle | undefined;
    let settled = false;

    const cleanup = (): void => {
      if (abortHandler) {
        signal?.removeEventListener("abort", abortHandler);
        abortHandler = undefined;
      }
      stateChangeHandle?.disconnect();
      stateChangeHandle = undefined;
    };

    const currentSnapshot = (): ElectronSteamOverlaySnapshot | undefined => {
      try {
        return controller.snapshot();
      } catch {
        return undefined;
      }
    };

    const settleReject = (error: unknown): void => {
      if (settled) {
        return;
      }
      settled = true;
      cleanup();
      reject(error);
    };

    const settleResolve = (value: T): void => {
      if (settled) {
        return;
      }
      settled = true;
      cleanup();
      resolve(value);
    };

    abortHandler = (): void => {
      settleReject(new SteamOverlayWaitAbortedError(stateLabel, currentSnapshot()));
    };

    const checkOpen = (): boolean => {
      let snapshot: ElectronSteamOverlaySnapshot;
      try {
        snapshot = controller.snapshot();
      } catch (error) {
        settleReject(error);
        return true;
      }

      const unavailableError = electronSteamOverlayNativeHostUnavailableError(snapshot);
      if (unavailableError) {
        settleReject(unavailableError);
        return true;
      }

      if (snapshot.closed || !controller.isOpen()) {
        settleReject(new SteamOverlayWaitClosedError(stateLabel, snapshot));
        return true;
      }

      return false;
    };

    if (signal) {
      signal.addEventListener("abort", abortHandler, { once: true });
    }

    stateChangeHandle = subscribeElectronSteamOverlayStateChanges(controller, () => {
      checkOpen();
    });

    if (signal?.aborted) {
      abortHandler();
      return;
    }

    if (checkOpen()) {
      return;
    }

    try {
      Promise.resolve(operation()).then((value) => {
        if (checkOpen()) {
          return;
        }
        settleResolve(value);
      }, settleReject);
    } catch (error) {
      settleReject(error);
    }
  });
}

function shouldUseElectronSteamOverlayFallbackPolling(
  controller: ElectronSteamOverlay,
  stateChangeHandle: CallbackHandle | undefined
): boolean {
  if (!stateChangeHandle) {
    return true;
  }

  try {
    return controller.snapshot().electronOverlay.presenterMode === "session";
  } catch {
    return false;
  }
}

function subscribeElectronSteamOverlayStateChanges(
  controller: ElectronSteamOverlay,
  listener: () => void
): CallbackHandle | undefined {
  const presenter = controller.presenter as NativeOverlayPresenterInternal;
  return typeof presenter.onStateChange === "function" ? presenter.onStateChange(listener) : undefined;
}

function isElectronSteamOverlayParked(snapshot: ElectronSteamOverlaySnapshot): boolean {
  if (snapshot.electronOverlay.presenterMode === "session") {
    return snapshot.overlayActive === false;
  }

  return (
    snapshot.closed === false &&
    snapshot.attached === true &&
    snapshot.mode === "passive" &&
    snapshot.clickThrough === true &&
    snapshot.transparent === true &&
    snapshot.overlayActive === false &&
    snapshot.overlayNeedsPresent === false &&
    snapshot.currentFps === 0
  );
}

function electronSteamOverlayCheckoutTargetFromResult(
  result: ElectronSteamOverlayCheckoutOperationResult,
  defaults: Pick<ElectronSteamOverlayCheckoutAndWaitOptions, "modal" | "returnUrl"> = {}
): SteamOverlayCheckoutTarget {
  const target: SteamOverlayCheckoutTarget = { type: "checkout" };

  if (typeof defaults.modal === "boolean") {
    target.modal = defaults.modal;
  }
  if (typeof defaults.returnUrl === "string" && defaults.returnUrl.length > 0) {
    target.returnUrl = defaults.returnUrl;
  }

  if (typeof result === "string") {
    assignElectronSteamOverlayCheckoutString(target, result);
    resolveSteamCheckoutOverlayUrl(target);
    return target;
  }

  if (typeof result === "number" || typeof result === "bigint") {
    target.transactionId = result;
    resolveSteamCheckoutOverlayUrl(target);
    return target;
  }

  if (!result || typeof result !== "object" || Array.isArray(result)) {
    throw new Error("A Steam checkout operation must return a checkout URL, transaction ID, or checkout object.");
  }

  const source = electronSteamOverlayCheckoutSourceFromObject(result);

  if (source.type !== undefined && source.type !== "checkout") {
    throw new Error(`Unsupported Steam checkout operation target type: ${String(source.type)}`);
  }

  const steamUrl = nonEmptyString(source.steamUrl ?? source.steamurl);
  const url = nonEmptyString(source.url);
  const transactionId = source.transactionId ?? source.transactionID ?? source.transid;
  const returnUrl = nonEmptyString(source.returnUrl ?? source.returnurl);

  if (steamUrl) {
    target.steamUrl = steamUrl;
  }
  if (url) {
    target.url = url;
  }
  if (transactionId != null) {
    if (!isElectronSteamOverlayCheckoutTransactionId(transactionId)) {
      throw new Error("A Steam checkout operation returned an invalid transaction ID.");
    }
    target.transactionId = transactionId;
  }
  if (returnUrl) {
    target.returnUrl = returnUrl;
  }
  if (typeof source.modal === "boolean") {
    target.modal = source.modal;
  }

  resolveSteamCheckoutOverlayUrl(target);
  return target;
}

function electronSteamOverlayCheckoutSourceFromObject(
  result: ElectronSteamOverlayCheckoutOperationObject
): Record<string, unknown> {
  return findElectronSteamOverlayCheckoutSource(result) ?? (result as Record<string, unknown>);
}

function findElectronSteamOverlayCheckoutSource(
  value: unknown,
  seen = new Set<unknown>(),
  depth = 0
): Record<string, unknown> | undefined {
  if (!isElectronSteamOverlayCheckoutSourceCandidate(value) || seen.has(value) || depth > 8) {
    return undefined;
  }

  seen.add(value);
  if (isSteamWebApiResponseEnvelopeLike(value)) {
    const source = findElectronSteamOverlayCheckoutSource(value.data, seen, depth + 1);
    if (source) {
      return source;
    }
  }

  if (hasElectronSteamOverlayCheckoutFields(value)) {
    return value;
  }

  for (const key of ["data", "response", "params"]) {
    const source = findElectronSteamOverlayCheckoutSource(value[key], seen, depth + 1);
    if (source) {
      return source;
    }
  }

  return undefined;
}

function isElectronSteamOverlayCheckoutSourceCandidate(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function hasElectronSteamOverlayCheckoutFields(value: Record<string, unknown>): boolean {
  return [
    "type",
    "url",
    "steamUrl",
    "steamurl",
    "transactionId",
    "transactionID",
    "transid",
    "returnUrl",
    "returnurl",
    "modal"
  ].some((key) => Object.prototype.hasOwnProperty.call(value, key));
}

function isSteamWebApiResponseEnvelopeLike(value: Record<string, unknown>): boolean {
  return (
    Object.prototype.hasOwnProperty.call(value, "data") &&
    (Object.prototype.hasOwnProperty.call(value, "ok") ||
      Object.prototype.hasOwnProperty.call(value, "status") ||
      Object.prototype.hasOwnProperty.call(value, "headers") ||
      Object.prototype.hasOwnProperty.call(value, "text"))
  );
}

function isElectronSteamOverlayCheckoutTransactionId(value: unknown): value is bigint | number | string {
  return typeof value === "bigint" || typeof value === "number" || typeof value === "string";
}

function assignElectronSteamOverlayCheckoutString(target: SteamOverlayCheckoutTarget, value: string): void {
  const trimmed = value.trim();
  if (!trimmed) {
    throw new Error("A Steam checkout operation returned an empty checkout URL or transaction ID.");
  }
  if (/^\d+$/.test(trimmed)) {
    target.transactionId = trimmed;
    return;
  }
  target.steamUrl = trimmed;
}

function nonEmptyString(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

type NormalizedElectronSteamOverlayShortcutOptions = Required<
  Pick<ElectronSteamOverlayShortcutOptions, "enabled" | "preventDefault">
> &
  Omit<ElectronSteamOverlayShortcutOptions, "enabled" | "preventDefault">;

type ElectronSteamOverlayShortcutHandleResult = "ignored" | "handled" | "opened";

interface ElectronSteamOverlayShortcutOpenState {
  opening: boolean;
}

interface ElectronGlobalShortcutApi {
  register(accelerator: string, callback: () => void): boolean;
  unregister(accelerator: string): void;
}

interface ElectronShortcutApi {
  globalShortcut?: ElectronGlobalShortcutApi;
}

type ElectronOverlayWindowShortcutEvent = "focus" | "blur";

interface ElectronOverlayWindowShortcutEvents {
  isDestroyed?(): boolean;
  isFocused?(): boolean;
  on?(event: ElectronOverlayWindowShortcutEvent, handler: () => void): void;
  off?(event: ElectronOverlayWindowShortcutEvent, handler: () => void): void;
  removeListener?(event: ElectronOverlayWindowShortcutEvent, handler: () => void): void;
}

function normalizeElectronSteamOverlayShortcut(
  shortcutConfig: ElectronSteamOverlayShortcutConfig
): NormalizedElectronSteamOverlayShortcutOptions {
  if (typeof shortcutConfig === "boolean") {
    return {
      enabled: shortcutConfig,
      preventDefault: true
    };
  }

  return {
    ...shortcutConfig,
    enabled: shortcutConfig.enabled ?? true,
    preventDefault: shortcutConfig.preventDefault ?? true
  };
}

function snapshotElectronSteamOverlayShortcut(
  shortcut: NormalizedElectronSteamOverlayShortcutOptions
): ElectronSteamOverlayShortcutSnapshot {
  const target = shortcut.enabled ? snapshotElectronSteamOverlayShortcutTarget(shortcut.target) : null;
  return {
    enabled: shortcut.enabled,
    preventDefault: shortcut.preventDefault,
    targetType: target?.type ?? null,
    target
  };
}

function snapshotElectronSteamOverlayShortcutTarget(
  target?: ElectronSteamOverlayShortcutTarget
): ElectronSteamOverlayShortcutTargetSnapshot {
  if (typeof target === "function") {
    return { type: "function" };
  }
  const overlayTarget: SteamOverlayTarget = target ?? { type: "friends" };
  const snapshot: ElectronSteamOverlayShortcutTargetSnapshot = { type: overlayTarget.type };
  if ("appId" in overlayTarget && typeof overlayTarget.appId === "number" && Number.isFinite(overlayTarget.appId)) {
    snapshot.appId = overlayTarget.appId;
  }
  if ("dialog" in overlayTarget && overlayTarget.dialog !== undefined) {
    snapshot.dialog = overlayTarget.dialog;
  }
  if ("flag" in overlayTarget && typeof overlayTarget.flag === "number" && Number.isFinite(overlayTarget.flag)) {
    snapshot.flag = overlayTarget.flag;
  }
  if ("route" in overlayTarget && typeof overlayTarget.route === "string") {
    snapshot.route = overlayTarget.route;
  }
  if ("modal" in overlayTarget && typeof overlayTarget.modal === "boolean") {
    snapshot.modal = overlayTarget.modal;
  }
  if ("url" in overlayTarget) {
    snapshot.hasUrl = typeof overlayTarget.url === "string" && overlayTarget.url.length > 0;
  }
  if ("steamUrl" in overlayTarget) {
    snapshot.hasSteamUrl = typeof overlayTarget.steamUrl === "string" && overlayTarget.steamUrl.length > 0;
  }
  if ("transactionId" in overlayTarget) {
    snapshot.hasTransactionId = overlayTarget.transactionId !== undefined && overlayTarget.transactionId !== null;
  }
  if ("returnUrl" in overlayTarget) {
    snapshot.hasReturnUrl = typeof overlayTarget.returnUrl === "string" && overlayTarget.returnUrl.length > 0;
  }
  if ("steamId64" in overlayTarget) {
    snapshot.hasSteamId64 = overlayTarget.steamId64 !== undefined && overlayTarget.steamId64 !== null;
  }
  return snapshot;
}

function isElectronSteamOverlayShortcutOpening(snapshot: ElectronSteamOverlaySnapshot): boolean {
  if (snapshot.electronOverlay.presenterMode === "session") {
    return snapshot.overlayNeedsPresent === true;
  }

  return (
    snapshot.mode === "active" ||
    snapshot.clickThrough === false
  );
}

function isElectronSteamOverlayShortcutInput(input: ElectronOverlayKeyboardInput): boolean {
  const key = input.key?.toLowerCase();
  const code = input.code?.toLowerCase();
  return (
    input.type === "keyDown" &&
    !input.isAutoRepeat &&
    input.shift === true &&
    input.control !== true &&
    input.alt !== true &&
    input.meta !== true &&
    (key === "tab" || code === "tab")
  );
}

function resolveElectronSteamOverlayShortcutTarget(target?: ElectronSteamOverlayShortcutTarget): SteamOverlayTarget {
  if (typeof target === "function") {
    return target();
  }
  return target ?? { type: "friends" };
}

export function activateDialogWithNativeSession(
  dialog: number | string = "Friends",
  options?: NativeOverlaySessionOptions
): NativeOverlaySession {
  return activateWithNativeOverlaySession(options, () => {
    activateOverlay(dialog);
  });
}

export function activateToWebPageWithNativeSession(
  url: string,
  options: NativeOverlayWebPageSessionOptions = {}
): NativeOverlaySession {
  const { modal, ...sessionOptions } = options;
  return activateWithNativeOverlaySession(sessionOptions, () => {
    activateOverlayToWebPage(url, { modal });
  });
}

export function activateToStoreWithNativeSession(
  appId: number,
  flag: number,
  options?: NativeOverlaySessionOptions
): NativeOverlaySession {
  return activateWithNativeOverlaySession(options, () => {
    native().overlayActivateToStore(appId, flag);
  });
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
  },
  runFrameDeprecated(): boolean {
    return native().clientRunFrameDeprecated();
  },
  registerPostApiResultInProcessHook(handler: () => void): CallbackHandle {
    return wrapCallbackHandle(
      native().clientRegisterPostApiResultInProcessHook(() => {
        handler();
      })
    );
  },
  registerCheckCallbackRegisteredInProcessHook(
    handler: (event: SteamClientCallbackRegistrationCheck) => void,
    registered = true
  ): CallbackHandle {
    return wrapCallbackHandle(
      native().clientRegisterCheckCallbackRegisteredInProcessHook((event) => {
        handler(normalizeSteamClientCallbackRegistrationCheck(event));
      }, registered ? 1 : 0)
    );
  },
  destroyAllInterfaces(): boolean {
    return native().clientDestroyAllInterfaces();
  }
};

export const achievement = {
  onStored(handler: (event: UserAchievementStoredEvent) => void): CallbackHandle {
    return onSteamCallback("UserAchievementStored", (event) => {
      handler(event as UserAchievementStoredEvent);
    });
  },
  onIconFetched(handler: (event: UserAchievementIconFetchedEvent) => void): CallbackHandle {
    return onSteamCallback("UserAchievementIconFetched", (event) => {
      handler(event as UserAchievementIconFetchedEvent);
    });
  },
  activate(name: string): boolean {
    prepareElectronNotificationPresenters();
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
    prepareElectronNotificationPresenters();
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
  onDlcInstalled(handler: (event: AppDlcInstalledEvent) => void): CallbackHandle {
    return onSteamCallback("DlcInstalled", (event) => {
      handler(event as AppDlcInstalledEvent);
    });
  },
  onNewUrlLaunchParameters(handler: (event: AppNewUrlLaunchParametersEvent) => void): CallbackHandle {
    return onSteamCallback("NewUrlLaunchParameters", (event) => {
      handler(event as AppNewUrlLaunchParametersEvent);
    });
  },
  onAppProofOfPurchaseKeyResponse(handler: (event: AppProofOfPurchaseKeyResponseEvent) => void): CallbackHandle {
    return onSteamCallback("AppProofOfPurchaseKeyResponse", (event) => {
      handler(event as AppProofOfPurchaseKeyResponseEvent);
    });
  },
  onFileDetailsResult(handler: (event: AppFileDetailsResultEvent) => void): CallbackHandle {
    return onSteamCallback("FileDetailsResult", (event) => {
      handler(event as AppFileDetailsResultEvent);
    });
  },
  onTimedTrialStatus(handler: (event: AppTimedTrialStatusEvent) => void): CallbackHandle {
    return onSteamCallback("TimedTrialStatus", (event) => {
      handler(event as AppTimedTrialStatusEvent);
    });
  },
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

export const appTicket = {
  getAppOwnershipTicketData(appId: number, maxBytes?: number | null): AppOwnershipTicketData | null {
    return normalizeAppOwnershipTicketData(
      native().appTicketGetAppOwnershipTicketData(appId, maxBytes ?? undefined)
    );
  }
};

export const encryptedAppTicket = {
  decrypt(
    ticket: Buffer | Uint8Array,
    key: Buffer | Uint8Array,
    maxBytes?: number | null
  ): Buffer | null {
    return native().encryptedAppTicketDecrypt(
      Buffer.from(ticket),
      Buffer.from(key),
      maxBytes ?? undefined
    ) ?? null;
  },
  isTicketForApp(ticket: Buffer | Uint8Array, appId: number): boolean {
    return native().encryptedAppTicketIsTicketForApp(Buffer.from(ticket), appId);
  },
  getTicketIssueTime(ticket: Buffer | Uint8Array): number {
    return native().encryptedAppTicketGetTicketIssueTime(Buffer.from(ticket));
  },
  getTicketSteamId(ticket: Buffer | Uint8Array): SteamId {
    return normalizeSteamId(native().encryptedAppTicketGetTicketSteamId(Buffer.from(ticket)));
  },
  getTicketAppId(ticket: Buffer | Uint8Array): number {
    return native().encryptedAppTicketGetTicketAppId(Buffer.from(ticket));
  },
  userOwnsAppInTicket(ticket: Buffer | Uint8Array, appId: number): boolean {
    return native().encryptedAppTicketUserOwnsAppInTicket(Buffer.from(ticket), appId);
  },
  userIsVacBanned(ticket: Buffer | Uint8Array): boolean {
    return native().encryptedAppTicketUserIsVacBanned(Buffer.from(ticket));
  },
  getAppDefinedValue(ticket: Buffer | Uint8Array): number | null {
    return native().encryptedAppTicketGetAppDefinedValue(Buffer.from(ticket)) ?? null;
  },
  getUserVariableData(ticket: Buffer | Uint8Array): Buffer | null {
    return native().encryptedAppTicketGetUserVariableData(Buffer.from(ticket)) ?? null;
  },
  isTicketSigned(ticket: Buffer | Uint8Array, rsaKey: Buffer | Uint8Array): boolean {
    return native().encryptedAppTicketIsTicketSigned(Buffer.from(ticket), Buffer.from(rsaKey));
  },
  isLicenseBorrowed(ticket: Buffer | Uint8Array): boolean {
    return native().encryptedAppTicketIsLicenseBorrowed(Buffer.from(ticket));
  },
  isLicenseTemporary(ticket: Buffer | Uint8Array): boolean {
    return native().encryptedAppTicketIsLicenseTemporary(Buffer.from(ticket));
  }
};

export function buildSteamWebApiUrl(options: SteamWebApiRequestOptions): string {
  const url = new URL(
    `${steamWebApiPathComponent(options.interfaceName, "interfaceName")}/${steamWebApiPathComponent(
      options.methodName,
      "methodName"
    )}/${normalizeSteamWebApiVersion(options.version)}/`,
    baseUrlWithTrailingSlash(options.baseUrl ?? DEFAULT_STEAM_WEB_API_BASE_URL)
  );

  if (options.key) {
    url.searchParams.set("key", options.key);
  }

  if (options.format) {
    url.searchParams.set("format", options.format);
  }

  appendSteamWebApiParams(url.searchParams, options.params);
  return url.toString();
}

export async function requestSteamWebApi<T = unknown>(
  options: SteamWebApiRequestOptions
): Promise<SteamWebApiResponse<T>> {
  return requestSteamWebApiWithClient<T>(options, {});
}

export function createSteamWebApiClient(options: SteamWebApiClientOptions = {}): SteamWebApiClient {
  const clientOptions = { ...options };
  return {
    buildUrl(request) {
      return buildSteamWebApiUrl(requestSteamWebApiWithDefaults(request, clientOptions));
    },
    request<T = unknown>(request: SteamWebApiRequestOptions): Promise<SteamWebApiResponse<T>> {
      return requestSteamWebApiWithClient<T>(request, clientOptions);
    },
    get<T = unknown>(
      request: Omit<SteamWebApiRequestOptions, "method" | "body">
    ): Promise<SteamWebApiResponse<T>> {
      return requestSteamWebApiWithClient<T>({ ...request, method: "GET" }, clientOptions);
    },
    post<T = unknown>(request: Omit<SteamWebApiRequestOptions, "method">): Promise<SteamWebApiResponse<T>> {
      const postRequest: SteamWebApiRequestOptions = { ...request, method: "POST" };
      if (postRequest.body === undefined && postRequest.params !== undefined) {
        postRequest.body = postRequest.params;
        postRequest.params = undefined;
      }
      return requestSteamWebApiWithClient<T>(postRequest, clientOptions);
    },
    apps: createSteamWebApiAppsFacade(clientOptions),
    authenticationService: createSteamWebApiAuthenticationServiceFacade(clientOptions),
    broadcast: createSteamWebApiBroadcastFacade(clientOptions),
    broadcastService: createSteamWebApiBroadcastServiceFacade(clientOptions),
    cheatReportingService: createSteamWebApiCheatReportingServiceFacade(clientOptions),
    clientStats1046930: createSteamWebApiClientStats1046930Facade(clientOptions),
    cloudService: createSteamWebApiCloudServiceFacade(clientOptions),
    community: createSteamWebApiCommunityFacade(clientOptions),
    contentServerDirectoryService: createSteamWebApiContentServerDirectoryServiceFacade(clientOptions),
    directory: createSteamWebApiDirectoryFacade(clientOptions),
    econMarketService: createSteamWebApiEconMarketServiceFacade(clientOptions),
    econService: createSteamWebApiEconServiceFacade(clientOptions),
    economy: createSteamWebApiEconomyFacade(clientOptions),
    gameInventory: createSteamWebApiGameInventoryFacade(clientOptions),
    gameCoordinatorVersion: createSteamWebApiGameCoordinatorVersionFacade(clientOptions),
    gameNotificationsService: createSteamWebApiGameNotificationsServiceFacade(clientOptions),
    gameServersService: createSteamWebApiGameServersServiceFacade(clientOptions),
    gameServerStats: createSteamWebApiGameServerStatsFacade(clientOptions),
    helpRequestLogsService: createSteamWebApiHelpRequestLogsServiceFacade(clientOptions),
    inventoryService: createSteamWebApiInventoryServiceFacade(clientOptions),
    leaderboards: createSteamWebApiLeaderboardsFacade(clientOptions),
    news: createSteamWebApiNewsFacade(clientOptions),
    player: createSteamWebApiPlayerServiceFacade(clientOptions),
    portal2Leaderboards: createSteamWebApiPortal2LeaderboardsFacade(clientOptions),
    publishedFileService: createSteamWebApiPublishedFileServiceFacade(clientOptions),
    publishedItemSearch: createSteamWebApiPublishedItemSearchFacade(clientOptions),
    publishedItemVoting: createSteamWebApiPublishedItemVotingFacade(clientOptions),
    remoteStorage: createSteamWebApiRemoteStorageFacade(clientOptions),
    siteLicenseService: createSteamWebApiSiteLicenseServiceFacade(clientOptions),
    store: createSteamWebApiStoreServiceFacade(clientOptions),
    tfSystem: createSteamWebApiTfSystemFacade(clientOptions),
    util: createSteamWebApiUtilFacade(clientOptions),
    user: createSteamWebApiUserFacade(clientOptions),
    userAuth: createSteamWebApiUserAuthFacade(clientOptions),
    userOAuth: createSteamWebApiUserOAuthFacade(clientOptions),
    userStats: createSteamWebApiUserStatsFacade(clientOptions),
    wishlistService: createSteamWebApiWishlistServiceFacade(clientOptions),
    workshopService: createSteamWebApiWorkshopServiceFacade(clientOptions),
    microTxn: createSteamWebApiMicroTxnFacade("ISteamMicroTxn", clientOptions),
    microTxnSandbox: createSteamWebApiMicroTxnFacade("ISteamMicroTxnSandbox", clientOptions)
  };
}

export const webApi = createSteamWebApiClient();

export const user = {
  VoiceResult,
  BeginAuthSessionResult,
  UserHasLicenseForAppResult,
  MarketNotAllowedReasonFlags,
  DurationControlProgress,
  DurationControlNotification,
  DurationControlOnlineState,
  onClientGameServerDeny(handler: (event: UserClientGameServerDenyEvent) => void): CallbackHandle {
    return onSteamCallback("ClientGameServerDeny", (event) => {
      handler(event as UserClientGameServerDenyEvent);
    });
  },
  onLicensesUpdated(handler: (event: UserLicensesUpdatedEvent) => void): CallbackHandle {
    return onSteamCallback("LicensesUpdated", (event) => {
      handler(event as UserLicensesUpdatedEvent);
    });
  },
  onValidateAuthTicketResponse(handler: (event: UserValidateAuthTicketResponseEvent) => void): CallbackHandle {
    return onSteamCallback("ValidateAuthTicketResponse", (event) => {
      handler(event as UserValidateAuthTicketResponseEvent);
    });
  },
  onEncryptedAppTicketResponse(handler: (event: UserEncryptedAppTicketResponseEvent) => void): CallbackHandle {
    return onSteamCallback("EncryptedAppTicketResponse", (event) => {
      handler(event as UserEncryptedAppTicketResponseEvent);
    });
  },
  onGetAuthSessionTicketResponse(handler: (event: UserGetAuthSessionTicketResponseEvent) => void): CallbackHandle {
    return onSteamCallback("GetAuthSessionTicketResponse", (event) => {
      handler(event as UserGetAuthSessionTicketResponseEvent);
    });
  },
  onGameWebCallback(handler: (event: UserGameWebCallbackEvent) => void): CallbackHandle {
    return onSteamCallback("GameWebCallback", (event) => {
      handler(event as UserGameWebCallbackEvent);
    });
  },
  onStoreAuthURLResponse(handler: (event: UserStoreAuthURLResponseEvent) => void): CallbackHandle {
    return onSteamCallback("StoreAuthURLResponse", (event) => {
      handler(event as UserStoreAuthURLResponseEvent);
    });
  },
  onMarketEligibilityResponse(handler: (event: UserMarketEligibilityResponseEvent) => void): CallbackHandle {
    return onSteamCallback("MarketEligibilityResponse", (event) => {
      handler(event as UserMarketEligibilityResponseEvent);
    });
  },
  onDurationControl(handler: (event: UserDurationControlEvent) => void): CallbackHandle {
    return onSteamCallback("DurationControl", (event) => {
      handler(event as UserDurationControlEvent);
    });
  },
  onGetTicketForWebApiResponse(handler: (event: UserGetTicketForWebApiResponseEvent) => void): CallbackHandle {
    return onSteamCallback("GetTicketForWebApiResponse", (event) => {
      handler(event as UserGetTicketForWebApiResponseEvent);
    });
  },
  startVoiceRecording(): void {
    native().userStartVoiceRecording();
  },
  stopVoiceRecording(): void {
    native().userStopVoiceRecording();
  },
  getHSteamUser(): number {
    return native().userGetHSteamUser();
  },
  isLoggedOn(): boolean {
    return native().userIsLoggedOn();
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
  initiateGameConnectionDeprecated(
    serverSteamId64: bigint,
    ip: number,
    port: number,
    secure = true,
    maxBytes?: number | null
  ): Buffer | null {
    return native().userInitiateGameConnectionDeprecated(serverSteamId64, ip, port, secure, maxBytes ?? undefined) ?? null;
  },
  terminateGameConnectionDeprecated(ip: number, port: number): void {
    native().userTerminateGameConnectionDeprecated(ip, port);
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
  onUserStatsReceived(handler: (event: GameServerStatsReceivedEvent) => void): CallbackHandle {
    return onSteamCallback("GameServerStatsReceived", (event) => {
      handler(event as GameServerStatsReceivedEvent);
    });
  },
  onUserStatsStored(handler: (event: GameServerStatsStoredEvent) => void): CallbackHandle {
    return onSteamCallback("GameServerStatsStored", (event) => {
      handler(event as GameServerStatsStoredEvent);
    });
  },
  onUserStatsUnloaded(handler: (event: GameServerStatsUnloadedEvent) => void): CallbackHandle {
    return onSteamCallback("GameServerStatsUnloaded", (event) => {
      handler(event as GameServerStatsUnloadedEvent);
    });
  },
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
  onServersConnected(handler: (event: GameServerServersConnectedEvent) => void): CallbackHandle {
    return onSteamCallback("SteamServersConnectedSteamworks", (event) => {
      handler(event as GameServerServersConnectedEvent);
    });
  },
  onServerConnectFailure(handler: (event: GameServerConnectFailureEvent) => void): CallbackHandle {
    return onSteamCallback("SteamServerConnectFailureSteamworks", (event) => {
      handler(event as GameServerConnectFailureEvent);
    });
  },
  onServersDisconnected(handler: (event: GameServerServersDisconnectedEvent) => void): CallbackHandle {
    return onSteamCallback("SteamServersDisconnectedSteamworks", (event) => {
      handler(event as GameServerServersDisconnectedEvent);
    });
  },
  onClientApprove(handler: (event: GameServerClientApproveEvent) => void): CallbackHandle {
    return onSteamCallback("GameServerClientApprove", (event) => {
      handler(event as GameServerClientApproveEvent);
    });
  },
  onClientDeny(handler: (event: GameServerClientDenyEvent) => void): CallbackHandle {
    return onSteamCallback("GameServerClientDeny", (event) => {
      handler(event as GameServerClientDenyEvent);
    });
  },
  onClientKick(handler: (event: GameServerClientKickEvent) => void): CallbackHandle {
    return onSteamCallback("GameServerClientKick", (event) => {
      handler(event as GameServerClientKickEvent);
    });
  },
  onClientAchievementStatus(handler: (event: GameServerClientAchievementStatusEvent) => void): CallbackHandle {
    return onSteamCallback("GameServerClientAchievementStatus", (event) => {
      handler(event as GameServerClientAchievementStatusEvent);
    });
  },
  onPolicyResponse(handler: (event: GameServerPolicyResponseEvent) => void): CallbackHandle {
    return onSteamCallback("GameServerPolicyResponse", (event) => {
      handler(event as GameServerPolicyResponseEvent);
    });
  },
  onGameplayStats(handler: (event: GameServerGameplayStatsEvent) => void): CallbackHandle {
    return onSteamCallback("GameServerGameplayStats", (event) => {
      handler(event as GameServerGameplayStatsEvent);
    });
  },
  onClientGroupStatus(handler: (event: GameServerClientGroupStatusEvent) => void): CallbackHandle {
    return onSteamCallback("GameServerClientGroupStatus", (event) => {
      handler(event as GameServerClientGroupStatusEvent);
    });
  },
  onReputation(handler: (event: GameServerReputationEvent) => void): CallbackHandle {
    return onSteamCallback("GameServerReputation", (event) => {
      handler(event as GameServerReputationEvent);
    });
  },
  onAssociateWithClan(handler: (event: GameServerAssociateWithClanEvent) => void): CallbackHandle {
    return onSteamCallback("GameServerAssociateWithClan", (event) => {
      handler(event as GameServerAssociateWithClanEvent);
    });
  },
  onPlayerCompatibility(handler: (event: GameServerPlayerCompatibilityEvent) => void): CallbackHandle {
    return onSteamCallback("GameServerPlayerCompatibility", (event) => {
      handler(event as GameServerPlayerCompatibilityEvent);
    });
  },
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
  initGameServer(options: GameServerInterfaceInitOptions): boolean {
    const nativeOptions: NativeGameServerInterfaceInitOptions = {
      ip: options.ip,
      game_port: options.gamePort,
      query_port: options.queryPort,
      flags: options.flags,
      app_id: options.appId,
      version: options.version
    };
    return native().gameServerInitGameServer(nativeOptions);
  },
  shutdown(): void {
    native().gameServerShutdown();
  },
  runCallbacks(): void {
    native().gameServerRunCallbacks();
  },
  getHSteamUser(): number {
    return native().gameServerGetHSteamUser();
  },
  setMasterServerHeartbeatIntervalDeprecated(heartbeatInterval: number): void {
    native().gameServerSetMasterServerHeartbeatIntervalDeprecated(heartbeatInterval);
  },
  forceMasterServerHeartbeatDeprecated(): void {
    native().gameServerForceMasterServerHeartbeatDeprecated();
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
  register(
    steamCallback: SteamCallbackName | SteamCallbackId | number,
    handler: (value: unknown) => void
  ): CallbackHandle {
    return onSteamCallback(steamCallback, handler);
  },
  registerRawCallbackBase(
    callbackBasePointer: bigint,
    steamCallback: SteamCallbackName | SteamCallbackId | number
  ): void {
    native().registerRawSteamCallback(callbackBasePointer, resolveSteamCallbackId(steamCallback));
  },
  unregisterRawCallbackBase(callbackBasePointer: bigint): void {
    native().unregisterRawSteamCallback(callbackBasePointer);
  },
  registerRawCallResult(callbackBasePointer: bigint, apiCall: bigint): void {
    native().registerRawSteamCallResult(callbackBasePointer, BigInt(apiCall));
  },
  unregisterRawCallResult(callbackBasePointer: bigint, apiCall: bigint): void {
    native().unregisterRawSteamCallResult(callbackBasePointer, BigInt(apiCall));
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
  onFileShareResult(handler: (event: CloudFileShareResultEvent) => void): CallbackHandle {
    return onSteamCallback("RemoteStorageFileShareResult", (event) => {
      handler(event as CloudFileShareResultEvent);
    });
  },
  onPublishFileResult(handler: (event: CloudPublishedFileResultEvent) => void): CallbackHandle {
    return onSteamCallback("RemoteStoragePublishFileResult", (event) => {
      handler(event as CloudPublishedFileResultEvent);
    });
  },
  onDeletePublishedFileResult(handler: (event: CloudPublishedFileIdResultEvent) => void): CallbackHandle {
    return onSteamCallback("RemoteStorageDeletePublishedFileResult", (event) => {
      handler(event as CloudPublishedFileIdResultEvent);
    });
  },
  onEnumerateUserPublishedFilesResult(handler: (event: CloudEnumerateFilesResultEvent) => void): CallbackHandle {
    return onSteamCallback("RemoteStorageEnumerateUserPublishedFilesResult", (event) => {
      handler(event as CloudEnumerateFilesResultEvent);
    });
  },
  onSubscribePublishedFileResult(handler: (event: CloudPublishedFileIdResultEvent) => void): CallbackHandle {
    return onSteamCallback("RemoteStorageSubscribePublishedFileResult", (event) => {
      handler(event as CloudPublishedFileIdResultEvent);
    });
  },
  onEnumerateUserSubscribedFilesResult(
    handler: (event: CloudEnumerateSubscribedFilesResultEvent) => void
  ): CallbackHandle {
    return onSteamCallback("RemoteStorageEnumerateUserSubscribedFilesResult", (event) => {
      handler(event as CloudEnumerateSubscribedFilesResultEvent);
    });
  },
  onUnsubscribePublishedFileResult(handler: (event: CloudPublishedFileIdResultEvent) => void): CallbackHandle {
    return onSteamCallback("RemoteStorageUnsubscribePublishedFileResult", (event) => {
      handler(event as CloudPublishedFileIdResultEvent);
    });
  },
  onUpdatePublishedFileResult(handler: (event: CloudPublishedFileResultEvent) => void): CallbackHandle {
    return onSteamCallback("RemoteStorageUpdatePublishedFileResult", (event) => {
      handler(event as CloudPublishedFileResultEvent);
    });
  },
  onDownloadUgcResult(handler: (event: CloudUgcDownloadResultEvent) => void): CallbackHandle {
    return onSteamCallback("RemoteStorageDownloadUGCResult", (event) => {
      handler(event as CloudUgcDownloadResultEvent);
    });
  },
  onGetPublishedFileDetailsResult(
    handler: (event: CloudPublishedFileDetailsResultEvent) => void
  ): CallbackHandle {
    return onSteamCallback("RemoteStorageGetPublishedFileDetailsResult", (event) => {
      handler(event as CloudPublishedFileDetailsResultEvent);
    });
  },
  onEnumerateWorkshopFilesResult(handler: (event: CloudEnumerateWorkshopFilesResultEvent) => void): CallbackHandle {
    return onSteamCallback("RemoteStorageEnumerateWorkshopFilesResult", (event) => {
      handler(event as CloudEnumerateWorkshopFilesResultEvent);
    });
  },
  onGetPublishedItemVoteDetailsResult(
    handler: (event: CloudPublishedItemVoteDetailsEvent) => void
  ): CallbackHandle {
    return onSteamCallback("RemoteStorageGetPublishedItemVoteDetailsResult", (event) => {
      handler(event as CloudPublishedItemVoteDetailsEvent);
    });
  },
  onPublishedFileSubscribed(handler: (event: CloudPublishedFileAppEvent) => void): CallbackHandle {
    return onSteamCallback("RemoteStoragePublishedFileSubscribed", (event) => {
      handler(event as CloudPublishedFileAppEvent);
    });
  },
  onPublishedFileUnsubscribed(handler: (event: CloudPublishedFileAppEvent) => void): CallbackHandle {
    return onSteamCallback("RemoteStoragePublishedFileUnsubscribed", (event) => {
      handler(event as CloudPublishedFileAppEvent);
    });
  },
  onPublishedFileDeleted(handler: (event: CloudPublishedFileAppEvent) => void): CallbackHandle {
    return onSteamCallback("RemoteStoragePublishedFileDeleted", (event) => {
      handler(event as CloudPublishedFileAppEvent);
    });
  },
  onUpdateUserPublishedItemVoteResult(handler: (event: CloudPublishedFileIdResultEvent) => void): CallbackHandle {
    return onSteamCallback("RemoteStorageUpdateUserPublishedItemVoteResult", (event) => {
      handler(event as CloudPublishedFileIdResultEvent);
    });
  },
  onUserVoteDetails(handler: (event: CloudUserVoteDetailsEvent) => void): CallbackHandle {
    return onSteamCallback("RemoteStorageUserVoteDetails", (event) => {
      handler(event as CloudUserVoteDetailsEvent);
    });
  },
  onEnumerateUserSharedWorkshopFilesResult(
    handler: (event: CloudEnumerateFilesResultEvent) => void
  ): CallbackHandle {
    return onSteamCallback("RemoteStorageEnumerateUserSharedWorkshopFilesResult", (event) => {
      handler(event as CloudEnumerateFilesResultEvent);
    });
  },
  onSetUserPublishedFileActionResult(
    handler: (event: CloudPublishedFileActionResultEvent) => void
  ): CallbackHandle {
    return onSteamCallback("RemoteStorageSetUserPublishedFileActionResult", (event) => {
      handler(event as CloudPublishedFileActionResultEvent);
    });
  },
  onEnumeratePublishedFilesByUserActionResult(
    handler: (event: CloudEnumerateUserActionFilesResultEvent) => void
  ): CallbackHandle {
    return onSteamCallback("RemoteStorageEnumeratePublishedFilesByUserActionResult", (event) => {
      handler(event as CloudEnumerateUserActionFilesResultEvent);
    });
  },
  onPublishFileProgress(handler: (event: CloudPublishFileProgressEvent) => void): CallbackHandle {
    return onSteamCallback("RemoteStoragePublishFileProgress", (event) => {
      handler(event as CloudPublishFileProgressEvent);
    });
  },
  onPublishedFileUpdated(handler: (event: CloudPublishedFileUpdatedEvent) => void): CallbackHandle {
    return onSteamCallback("RemoteStoragePublishedFileUpdated", (event) => {
      handler(event as CloudPublishedFileUpdatedEvent);
    });
  },
  onFileWriteAsyncComplete(handler: (event: CloudFileWriteAsyncCompleteEvent) => void): CallbackHandle {
    return onSteamCallback("RemoteStorageFileWriteAsyncComplete", (event) => {
      handler(event as CloudFileWriteAsyncCompleteEvent);
    });
  },
  onFileReadAsyncComplete(handler: (event: CloudFileReadAsyncCompleteEvent) => void): CallbackHandle {
    return onSteamCallback("RemoteStorageFileReadAsyncComplete", (event) => {
      handler(event as CloudFileReadAsyncCompleteEvent);
    });
  },
  onLocalFileChange(handler: (event: CloudLocalFileChangeEvent) => void): CallbackHandle {
    return onSteamCallback("RemoteStorageLocalFileChange", (event) => {
      handler(event as CloudLocalFileChangeEvent);
    });
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
  onRequestCompleted(handler: (event: HttpRequestCompletedEvent) => void): CallbackHandle {
    return onSteamCallback("HTTPRequestCompleted", (event) => {
      handler(event as HttpRequestCompletedEvent);
    });
  },
  onRequestHeadersReceived(handler: (event: HttpRequestHeadersReceivedEvent) => void): CallbackHandle {
    return onSteamCallback("HTTPRequestHeadersReceived", (event) => {
      handler(event as HttpRequestHeadersReceivedEvent);
    });
  },
  onRequestDataReceived(handler: (event: HttpRequestDataReceivedEvent) => void): CallbackHandle {
    return onSteamCallback("HTTPRequestDataReceived", (event) => {
      handler(event as HttpRequestDataReceivedEvent);
    });
  },
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
  onRequestCompleted(handler: (event: HttpRequestCompletedEvent) => void): CallbackHandle {
    return onSteamCallback("HTTPRequestCompleted", (event) => {
      handler(event as HttpRequestCompletedEvent);
    });
  },
  onRequestHeadersReceived(handler: (event: HttpRequestHeadersReceivedEvent) => void): CallbackHandle {
    return onSteamCallback("HTTPRequestHeadersReceived", (event) => {
      handler(event as HttpRequestHeadersReceivedEvent);
    });
  },
  onRequestDataReceived(handler: (event: HttpRequestDataReceivedEvent) => void): CallbackHandle {
    return onSteamCallback("HTTPRequestDataReceived", (event) => {
      handler(event as HttpRequestDataReceivedEvent);
    });
  },
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
  onBrowserReady(handler: (event: HtmlBrowserEvent) => void): CallbackHandle {
    return onSteamCallback("HTMLBrowserReady", (event) => {
      handler(event as HtmlBrowserEvent);
    });
  },
  onNeedsPaint(handler: (event: HtmlNeedsPaintEvent) => void): CallbackHandle {
    return onSteamCallback("HTMLNeedsPaint", (event) => {
      handler(event as HtmlNeedsPaintEvent);
    });
  },
  onStartRequest(handler: (event: HtmlStartRequestEvent) => void): CallbackHandle {
    return onSteamCallback("HTMLStartRequest", (event) => {
      handler(event as HtmlStartRequestEvent);
    });
  },
  onCloseBrowser(handler: (event: HtmlBrowserEvent) => void): CallbackHandle {
    return onSteamCallback("HTMLCloseBrowser", (event) => {
      handler(event as HtmlBrowserEvent);
    });
  },
  onUrlChanged(handler: (event: HtmlUrlChangedEvent) => void): CallbackHandle {
    return onSteamCallback("HTMLURLChanged", (event) => {
      handler(event as HtmlUrlChangedEvent);
    });
  },
  onFinishedRequest(handler: (event: HtmlFinishedRequestEvent) => void): CallbackHandle {
    return onSteamCallback("HTMLFinishedRequest", (event) => {
      handler(event as HtmlFinishedRequestEvent);
    });
  },
  onOpenLinkInNewTab(handler: (event: HtmlOpenLinkInNewTabEvent) => void): CallbackHandle {
    return onSteamCallback("HTMLOpenLinkInNewTab", (event) => {
      handler(event as HtmlOpenLinkInNewTabEvent);
    });
  },
  onChangedTitle(handler: (event: HtmlChangedTitleEvent) => void): CallbackHandle {
    return onSteamCallback("HTMLChangedTitle", (event) => {
      handler(event as HtmlChangedTitleEvent);
    });
  },
  onSearchResults(handler: (event: HtmlSearchResultsEvent) => void): CallbackHandle {
    return onSteamCallback("HTMLSearchResults", (event) => {
      handler(event as HtmlSearchResultsEvent);
    });
  },
  onCanGoBackAndForward(handler: (event: HtmlCanGoBackAndForwardEvent) => void): CallbackHandle {
    return onSteamCallback("HTMLCanGoBackAndForward", (event) => {
      handler(event as HtmlCanGoBackAndForwardEvent);
    });
  },
  onHorizontalScroll(handler: (event: HtmlScrollEvent) => void): CallbackHandle {
    return onSteamCallback("HTMLHorizontalScroll", (event) => {
      handler(event as HtmlScrollEvent);
    });
  },
  onVerticalScroll(handler: (event: HtmlScrollEvent) => void): CallbackHandle {
    return onSteamCallback("HTMLVerticalScroll", (event) => {
      handler(event as HtmlScrollEvent);
    });
  },
  onLinkAtPosition(handler: (event: HtmlLinkAtPositionEvent) => void): CallbackHandle {
    return onSteamCallback("HTMLLinkAtPosition", (event) => {
      handler(event as HtmlLinkAtPositionEvent);
    });
  },
  onJsAlert(handler: (event: HtmlDialogEvent) => void): CallbackHandle {
    return onSteamCallback("HTMLJSAlert", (event) => {
      handler(event as HtmlDialogEvent);
    });
  },
  onJsConfirm(handler: (event: HtmlDialogEvent) => void): CallbackHandle {
    return onSteamCallback("HTMLJSConfirm", (event) => {
      handler(event as HtmlDialogEvent);
    });
  },
  onFileOpenDialog(handler: (event: HtmlFileOpenDialogEvent) => void): CallbackHandle {
    return onSteamCallback("HTMLFileOpenDialog", (event) => {
      handler(event as HtmlFileOpenDialogEvent);
    });
  },
  onNewWindow(handler: (event: HtmlNewWindowEvent) => void): CallbackHandle {
    return onSteamCallback("HTMLNewWindow", (event) => {
      handler(event as HtmlNewWindowEvent);
    });
  },
  onSetCursor(handler: (event: HtmlSetCursorEvent) => void): CallbackHandle {
    return onSteamCallback("HTMLSetCursor", (event) => {
      handler(event as HtmlSetCursorEvent);
    });
  },
  onStatusText(handler: (event: HtmlMessageEvent) => void): CallbackHandle {
    return onSteamCallback("HTMLStatusText", (event) => {
      handler(event as HtmlMessageEvent);
    });
  },
  onShowToolTip(handler: (event: HtmlMessageEvent) => void): CallbackHandle {
    return onSteamCallback("HTMLShowToolTip", (event) => {
      handler(event as HtmlMessageEvent);
    });
  },
  onUpdateToolTip(handler: (event: HtmlMessageEvent) => void): CallbackHandle {
    return onSteamCallback("HTMLUpdateToolTip", (event) => {
      handler(event as HtmlMessageEvent);
    });
  },
  onHideToolTip(handler: (event: HtmlBrowserEvent) => void): CallbackHandle {
    return onSteamCallback("HTMLHideToolTip", (event) => {
      handler(event as HtmlBrowserEvent);
    });
  },
  onBrowserRestarted(handler: (event: HtmlBrowserRestartedEvent) => void): CallbackHandle {
    return onSteamCallback("HTMLBrowserRestarted", (event) => {
      handler(event as HtmlBrowserRestartedEvent);
    });
  },
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
  onJoinParty(handler: (event: PartyJoinPartyEvent) => void): CallbackHandle {
    return onSteamCallback("JoinParty", (event) => {
      handler(event as PartyJoinPartyEvent);
    });
  },
  onCreateBeacon(handler: (event: PartyCreateBeaconEvent) => void): CallbackHandle {
    return onSteamCallback("CreateBeacon", (event) => {
      handler(event as PartyCreateBeaconEvent);
    });
  },
  onReservationNotification(handler: (event: PartyReservationNotificationEvent) => void): CallbackHandle {
    return onSteamCallback("ReservationNotification", (event) => {
      handler(event as PartyReservationNotificationEvent);
    });
  },
  onChangeNumOpenSlots(handler: (event: PartyChangeNumOpenSlotsEvent) => void): CallbackHandle {
    return onSteamCallback("ChangeNumOpenSlots", (event) => {
      handler(event as PartyChangeNumOpenSlotsEvent);
    });
  },
  onAvailableBeaconLocationsUpdated(handler: (event: PartyBeaconLocationsUpdatedEvent) => void): CallbackHandle {
    return onSteamCallback("AvailableBeaconLocationsUpdated", (event) => {
      handler(event as PartyBeaconLocationsUpdatedEvent);
    });
  },
  onActiveBeaconsUpdated(handler: (event: PartyActiveBeaconsUpdatedEvent) => void): CallbackHandle {
    return onSteamCallback("ActiveBeaconsUpdated", (event) => {
      handler(event as PartyActiveBeaconsUpdatedEvent);
    });
  },
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
  onResultReady(handler: (event: InventoryResultReadyEvent) => void): CallbackHandle {
    return onSteamCallback("SteamInventoryResultReady", (event) => {
      handler(event as InventoryResultReadyEvent);
    });
  },
  onFullUpdate(handler: (event: InventoryFullUpdateEvent) => void): CallbackHandle {
    return onSteamCallback("SteamInventoryFullUpdate", (event) => {
      handler(event as InventoryFullUpdateEvent);
    });
  },
  onDefinitionUpdate(handler: (event: InventoryDefinitionUpdateEvent) => void): CallbackHandle {
    return onSteamCallback("SteamInventoryDefinitionUpdate", (event) => {
      handler(event as InventoryDefinitionUpdateEvent);
    });
  },
  onEligiblePromoItemDefIds(handler: (event: InventoryEligiblePromoItemDefIdsEvent) => void): CallbackHandle {
    return onSteamCallback("SteamInventoryEligiblePromoItemDefIds", (event) => {
      handler(event as InventoryEligiblePromoItemDefIdsEvent);
    });
  },
  onStartPurchaseResult(handler: (event: InventoryStartPurchaseResultEvent) => void): CallbackHandle {
    return onSteamCallback("SteamInventoryStartPurchaseResult", (event) => {
      handler(event as InventoryStartPurchaseResultEvent);
    });
  },
  onRequestPricesResult(handler: (event: InventoryRequestPricesResultEvent) => void): CallbackHandle {
    return onSteamCallback("SteamInventoryRequestPricesResult", (event) => {
      handler(event as InventoryRequestPricesResultEvent);
    });
  },
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
  onResultReady(handler: (event: InventoryResultReadyEvent) => void): CallbackHandle {
    return onSteamCallback("SteamInventoryResultReady", (event) => {
      handler(event as InventoryResultReadyEvent);
    });
  },
  onFullUpdate(handler: (event: InventoryFullUpdateEvent) => void): CallbackHandle {
    return onSteamCallback("SteamInventoryFullUpdate", (event) => {
      handler(event as InventoryFullUpdateEvent);
    });
  },
  onDefinitionUpdate(handler: (event: InventoryDefinitionUpdateEvent) => void): CallbackHandle {
    return onSteamCallback("SteamInventoryDefinitionUpdate", (event) => {
      handler(event as InventoryDefinitionUpdateEvent);
    });
  },
  onEligiblePromoItemDefIds(handler: (event: InventoryEligiblePromoItemDefIdsEvent) => void): CallbackHandle {
    return onSteamCallback("SteamInventoryEligiblePromoItemDefIds", (event) => {
      handler(event as InventoryEligiblePromoItemDefIdsEvent);
    });
  },
  onStartPurchaseResult(handler: (event: InventoryStartPurchaseResultEvent) => void): CallbackHandle {
    return onSteamCallback("SteamInventoryStartPurchaseResult", (event) => {
      handler(event as InventoryStartPurchaseResultEvent);
    });
  },
  onRequestPricesResult(handler: (event: InventoryRequestPricesResultEvent) => void): CallbackHandle {
    return onSteamCallback("SteamInventoryRequestPricesResult", (event) => {
      handler(event as InventoryRequestPricesResultEvent);
    });
  },
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
  STEAM_INPUT_HANDLE_ALL_CONTROLLERS,
  STEAM_INPUT_MAX_COUNT,
  InputActionEventType,
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
  enableDeviceCallbacks(): void {
    native().inputEnableDeviceCallbacks();
  },
  onDeviceConnected(handler: (event: SteamInputDeviceConnectedEvent) => void): CallbackHandle {
    return onSteamCallback("SteamInputDeviceConnected", (event) => {
      handler(event as SteamInputDeviceConnectedEvent);
    });
  },
  onDeviceDisconnected(handler: (event: SteamInputDeviceDisconnectedEvent) => void): CallbackHandle {
    return onSteamCallback("SteamInputDeviceDisconnected", (event) => {
      handler(event as SteamInputDeviceDisconnectedEvent);
    });
  },
  onConfigurationLoaded(handler: (event: SteamInputConfigurationLoadedEvent) => void): CallbackHandle {
    return onSteamCallback("SteamInputConfigurationLoaded", (event) => {
      handler(event as SteamInputConfigurationLoadedEvent);
    });
  },
  onGamepadSlotChange(handler: (event: SteamInputGamepadSlotChangeEvent) => void): CallbackHandle {
    return onSteamCallback("SteamInputGamepadSlotChange", (event) => {
      handler(event as SteamInputGamepadSlotChangeEvent);
    });
  },
  registerActionEventCallback(handler: (event: InputActionEvent) => void): CallbackHandle {
    return wrapCallbackHandle(
      native().inputRegisterActionEventCallback((event) => {
        handler(normalizeInputActionEvent(event));
      })
    );
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
  getDigitalActionStateByName(
    controller: Controller | bigint,
    actionSetName: string,
    actionName: string
  ): InputDigitalActionData {
    const handle = typeof controller === "bigint" ? controller : controller.getHandle();
    const actionSetHandle = BigInt(native().inputGetActionSet(actionSetName));
    native().inputActivateActionSet(handle, actionSetHandle);
    const actionHandle = BigInt(native().inputGetDigitalAction(actionName));
    return normalizeInputDigitalActionData(native().inputGetDigitalActionData(handle, actionHandle));
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
  onLegacyPersonaStateChange(handler: (event: FriendsPersonaStateChangeEvent) => void): CallbackHandle {
    return onSteamCallback("PersonaStateChange", (event) => {
      handler(event as FriendsPersonaStateChangeEvent);
    });
  },
  onPersonaStateChange(handler: (event: FriendsPersonaStateChangeEvent) => void): CallbackHandle {
    return onSteamCallback("PersonaStateChangeSteamworks", (event) => {
      handler(event as FriendsPersonaStateChangeEvent);
    });
  },
  onGameServerChangeRequested(handler: (event: FriendsGameServerChangeRequestedEvent) => void): CallbackHandle {
    return onSteamCallback("GameServerChangeRequested", (event) => {
      handler(event as FriendsGameServerChangeRequestedEvent);
    });
  },
  onLegacyGameLobbyJoinRequested(handler: (event: FriendsGameLobbyJoinRequestedEvent) => void): CallbackHandle {
    return onSteamCallback("GameLobbyJoinRequested", (event) => {
      handler(event as FriendsGameLobbyJoinRequestedEvent);
    });
  },
  onGameLobbyJoinRequested(handler: (event: FriendsGameLobbyJoinRequestedEvent) => void): CallbackHandle {
    return onSteamCallback("GameLobbyJoinRequestedSteamworks", (event) => {
      handler(event as FriendsGameLobbyJoinRequestedEvent);
    });
  },
  onAvatarImageLoaded(handler: (event: FriendsAvatarImageLoadedEvent) => void): CallbackHandle {
    return onSteamCallback("AvatarImageLoaded", (event) => {
      handler(event as FriendsAvatarImageLoadedEvent);
    });
  },
  onClanOfficerListResponse(handler: (event: FriendsClanOfficerListResponseEvent) => void): CallbackHandle {
    return onSteamCallback("ClanOfficerListResponse", (event) => {
      handler(event as FriendsClanOfficerListResponseEvent);
    });
  },
  onRichPresenceUpdate(handler: (event: FriendsRichPresenceUpdateEvent) => void): CallbackHandle {
    return onSteamCallback("FriendRichPresenceUpdate", (event) => {
      handler(event as FriendsRichPresenceUpdateEvent);
    });
  },
  onGameRichPresenceJoinRequested(handler: (event: FriendsGameRichPresenceJoinRequestedEvent) => void): CallbackHandle {
    return onSteamCallback("GameRichPresenceJoinRequested", (event) => {
      handler(event as FriendsGameRichPresenceJoinRequestedEvent);
    });
  },
  onGameConnectedClanChatMessage(handler: (event: FriendsGameConnectedClanChatMessageEvent) => void): CallbackHandle {
    return onSteamCallback("GameConnectedClanChatMsg", (event) => {
      handler(event as FriendsGameConnectedClanChatMessageEvent);
    });
  },
  onGameConnectedChatJoin(handler: (event: FriendsGameConnectedChatJoinEvent) => void): CallbackHandle {
    return onSteamCallback("GameConnectedChatJoin", (event) => {
      handler(event as FriendsGameConnectedChatJoinEvent);
    });
  },
  onGameConnectedChatLeave(handler: (event: FriendsGameConnectedChatLeaveEvent) => void): CallbackHandle {
    return onSteamCallback("GameConnectedChatLeave", (event) => {
      handler(event as FriendsGameConnectedChatLeaveEvent);
    });
  },
  onDownloadClanActivityCountsResult(
    handler: (event: FriendsDownloadClanActivityCountsResultEvent) => void
  ): CallbackHandle {
    return onSteamCallback("DownloadClanActivityCountsResult", (event) => {
      handler(event as FriendsDownloadClanActivityCountsResultEvent);
    });
  },
  onJoinClanChatRoomCompletionResult(
    handler: (event: FriendsJoinClanChatRoomCompletionResultEvent) => void
  ): CallbackHandle {
    return onSteamCallback("JoinClanChatRoomCompletionResult", (event) => {
      handler(event as FriendsJoinClanChatRoomCompletionResultEvent);
    });
  },
  onGameConnectedFriendChatMessage(
    handler: (event: FriendsGameConnectedFriendChatMessageEvent) => void
  ): CallbackHandle {
    return onSteamCallback("GameConnectedFriendChatMsg", (event) => {
      handler(event as FriendsGameConnectedFriendChatMessageEvent);
    });
  },
  onFollowerCount(handler: (event: FriendsGetFollowerCountEvent) => void): CallbackHandle {
    return onSteamCallback("FriendsGetFollowerCount", (event) => {
      handler(event as FriendsGetFollowerCountEvent);
    });
  },
  onIsFollowing(handler: (event: FriendsIsFollowingEvent) => void): CallbackHandle {
    return onSteamCallback("FriendsIsFollowing", (event) => {
      handler(event as FriendsIsFollowingEvent);
    });
  },
  onEnumerateFollowingList(handler: (event: FriendsEnumerateFollowingListEvent) => void): CallbackHandle {
    return onSteamCallback("FriendsEnumerateFollowingList", (event) => {
      handler(event as FriendsEnumerateFollowingListEvent);
    });
  },
  onUnreadChatMessagesChanged(handler: (event: FriendsUnreadChatMessagesChangedEvent) => void): CallbackHandle {
    return onSteamCallback("UnreadChatMessagesChanged", (event) => {
      handler(event as FriendsUnreadChatMessagesChangedEvent);
    });
  },
  onOverlayBrowserProtocolNavigation(
    handler: (event: FriendsOverlayBrowserProtocolNavigationEvent) => void
  ): CallbackHandle {
    return onSteamCallback("OverlayBrowserProtocolNavigation", (event) => {
      handler(event as FriendsOverlayBrowserProtocolNavigationEvent);
    });
  },
  onEquippedProfileItemsChanged(handler: (event: FriendsEquippedProfileItemsChangedEvent) => void): CallbackHandle {
    return onSteamCallback("EquippedProfileItemsChanged", (event) => {
      handler(event as FriendsEquippedProfileItemsChangedEvent);
    });
  },
  onEquippedProfileItems(handler: (event: FriendsEquippedProfileItemsEvent) => void): CallbackHandle {
    return onSteamCallback("EquippedProfileItems", (event) => {
      handler(event as FriendsEquippedProfileItemsEvent);
    });
  },
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
  },
  createServerAddress(ip: number, queryPort: number, connectionPort: number): MatchmakingServerAddress {
    return normalizeMatchmakingServerAddress(
      native().matchmakingServersCreateServerAddress(ip, queryPort, connectionPort)
    );
  },
  copyServerAddress(ip: number, queryPort: number, connectionPort: number): MatchmakingServerAddress {
    return normalizeMatchmakingServerAddress(
      native().matchmakingServersCopyServerAddress(ip, queryPort, connectionPort)
    );
  },
  isServerAddressLessThan(
    ip: number,
    queryPort: number,
    connectionPort: number,
    otherIp: number,
    otherQueryPort: number,
    otherConnectionPort: number
  ): boolean {
    return native().matchmakingServersIsServerAddressLessThan(
      ip,
      queryPort,
      connectionPort,
      otherIp,
      otherQueryPort,
      otherConnectionPort
    );
  },
  createServerFilter(key: string, value: string): MatchmakingServerBrowserFilter {
    return native().matchmakingServersCreateServerFilter(key, value);
  },
  createServerItem(name: string, ip: number, queryPort: number, connectionPort: number): MatchmakingServerItem {
    return normalizeMatchmakingServerItem(
      native().matchmakingServersCreateServerItem(name, ip, queryPort, connectionPort)
    );
  },
  createResponseCallbackSnapshot(
    options: MatchmakingServerResponseCallbackSnapshotOptions = {}
  ): MatchmakingServerResponseCallbackSnapshot {
    const request = typeof options.request === "bigint" ? options.request : BigInt(options.request ?? 1);
    return normalizeMatchmakingServerResponseCallbackSnapshot(
      native().matchmakingServersCreateResponseCallbackSnapshot(
        request,
        options.respondedServer ?? 0,
        options.failedServer ?? 1,
        options.response ?? 0,
        options.playerName ?? "player",
        options.playerScore ?? 0,
        options.playerTimePlayed ?? 0,
        options.ruleName ?? "rule",
        options.ruleValue ?? "value"
      )
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
  onFavoritesListChanged(handler: (event: MatchmakingFavoritesListChangedEvent) => void): CallbackHandle {
    return onSteamCallback("FavoritesListChanged", (event) => {
      handler(event as MatchmakingFavoritesListChangedEvent);
    });
  },
  onLobbyInvite(handler: (event: LobbyInviteEvent) => void): CallbackHandle {
    return onSteamCallback("LobbyInvite", (event) => {
      handler(event as LobbyInviteEvent);
    });
  },
  onLobbyEnter(handler: (event: LobbyEnterEvent) => void): CallbackHandle {
    return onSteamCallback("LobbyEnter", (event) => {
      handler(event as LobbyEnterEvent);
    });
  },
  onLegacyLobbyDataUpdate(handler: (event: LobbyDataUpdateEvent) => void): CallbackHandle {
    return onSteamCallback("LobbyDataUpdate", (event) => {
      handler(event as LobbyDataUpdateEvent);
    });
  },
  onLobbyDataUpdate(handler: (event: LobbyDataUpdateEvent) => void): CallbackHandle {
    return onSteamCallback("LobbyDataUpdateSteamworks", (event) => {
      handler(event as LobbyDataUpdateEvent);
    });
  },
  onLegacyLobbyChatUpdate(handler: (event: LobbyChatUpdateEvent) => void): CallbackHandle {
    return onSteamCallback("LobbyChatUpdate", (event) => {
      handler(event as LobbyChatUpdateEvent);
    });
  },
  onLobbyChatUpdate(handler: (event: LobbyChatUpdateEvent) => void): CallbackHandle {
    return onSteamCallback("LobbyChatUpdateSteamworks", (event) => {
      handler(event as LobbyChatUpdateEvent);
    });
  },
  onLobbyChatMessage(handler: (event: LobbyChatMessageEvent) => void): CallbackHandle {
    return onSteamCallback("LobbyChatMsg", (event) => {
      handler(event as LobbyChatMessageEvent);
    });
  },
  onLobbyGameCreated(handler: (event: LobbyGameCreatedEvent) => void): CallbackHandle {
    return onSteamCallback("LobbyGameCreated", (event) => {
      handler(event as LobbyGameCreatedEvent);
    });
  },
  onLobbyMatchList(handler: (event: LobbyMatchListEvent) => void): CallbackHandle {
    return onSteamCallback("LobbyMatchList", (event) => {
      handler(event as LobbyMatchListEvent);
    });
  },
  onLobbyKicked(handler: (event: LobbyKickedEvent) => void): CallbackHandle {
    return onSteamCallback("LobbyKicked", (event) => {
      handler(event as LobbyKickedEvent);
    });
  },
  onLobbyCreated(handler: (event: LobbyCreatedEvent) => void): CallbackHandle {
    return onSteamCallback("LobbyCreated", (event) => {
      handler(event as LobbyCreatedEvent);
    });
  },
  onFavoritesListAccountsUpdated(
    handler: (event: MatchmakingFavoritesListAccountsUpdatedEvent) => void
  ): CallbackHandle {
    return onSteamCallback("FavoritesListAccountsUpdated", (event) => {
      handler(event as MatchmakingFavoritesListAccountsUpdatedEvent);
    });
  },
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

function createLegacyNetworkingCallbackHelpers() {
  return {
    onSocketStatus(handler: (event: LegacyNetworkingSocketStatusEvent) => void): CallbackHandle {
      return onSteamCallback("SocketStatusCallback", (event) => {
        handler(event as LegacyNetworkingSocketStatusEvent);
      });
    },
    onP2PSessionRequest(handler: (event: LegacyNetworkingP2PSessionRequestEvent) => void): CallbackHandle {
      return onSteamCallback("P2PSessionRequestSteamworks", (event) => {
        handler(event as LegacyNetworkingP2PSessionRequestEvent);
      });
    },
    onP2PSessionConnectFail(handler: (event: LegacyNetworkingP2PSessionConnectFailEvent) => void): CallbackHandle {
      return onSteamCallback("P2PSessionConnectFailSteamworks", (event) => {
        handler(event as LegacyNetworkingP2PSessionConnectFailEvent);
      });
    },
    onLegacyP2PSessionRequest(handler: (event: LegacyNetworkingP2PSessionRequestEvent) => void): CallbackHandle {
      return onSteamCallback("P2PSessionRequest", (event) => {
        handler(event as LegacyNetworkingP2PSessionRequestEvent);
      });
    },
    onLegacyP2PSessionConnectFail(handler: (event: LegacyNetworkingP2PSessionConnectFailEvent) => void): CallbackHandle {
      return onSteamCallback("P2PSessionConnectFail", (event) => {
        handler(event as LegacyNetworkingP2PSessionConnectFailEvent);
      });
    }
  };
}

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
  ...createLegacyNetworkingCallbackHelpers(),
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
    },
    onSessionRequest(handler: (event: NetworkingMessagesSessionRequestEvent) => void): CallbackHandle {
      return onSteamCallback("SteamNetworkingMessagesSessionRequest", (event) => {
        handler(event as NetworkingMessagesSessionRequestEvent);
      });
    },
    onSessionFailed(handler: (event: NetworkingMessagesSessionFailedEvent) => void): CallbackHandle {
      return onSteamCallback("SteamNetworkingMessagesSessionFailed", (event) => {
        handler(event as NetworkingMessagesSessionFailedEvent);
      });
    }
  },
  sockets: {
    SendFlags: NetworkingSendFlags,
    ConnectionState: NetworkingConnectionState,
    Availability: NetworkingAvailability,
    createListenSocketIP(address: NetworkingIpAddress, options?: readonly NetworkingConfigOption[] | null): number {
      return native().networkingSocketsCreateListenSocketIp(
        nativeNetworkingIpAddress(address),
        nativeNetworkingConfigValues(options)
      );
    },
    connectByIPAddress(address: NetworkingIpAddress, options?: readonly NetworkingConfigOption[] | null): number {
      return native().networkingSocketsConnectByIpAddress(
        nativeNetworkingIpAddress(address),
        nativeNetworkingConfigValues(options)
      );
    },
    createListenSocketP2P(localVirtualPort = 0, options?: readonly NetworkingConfigOption[] | null): number {
      return native().networkingSocketsCreateListenSocketP2p(
        localVirtualPort,
        nativeNetworkingConfigValues(options)
      );
    },
    connectP2P(
      identity: NetworkingIdentity,
      remoteVirtualPort = 0,
      options?: readonly NetworkingConfigOption[] | null
    ): number {
      return native().networkingSocketsConnectP2p(
        nativeNetworkingIdentity(identity),
        remoteVirtualPort,
        nativeNetworkingConfigValues(options)
      );
    },
    connectP2PCustomSignaling(
      signalingPointer: bigint,
      peerIdentity?: NetworkingIdentity | null,
      remoteVirtualPort = 0,
      options?: readonly NetworkingConfigOption[] | null
    ): number {
      return native().networkingSocketsConnectP2pCustomSignaling(
        signalingPointer,
        peerIdentity ? nativeNetworkingIdentity(peerIdentity) : undefined,
        remoteVirtualPort,
        nativeNetworkingConfigValues(options)
      );
    },
    receivedP2PCustomSignal(message: Buffer | Uint8Array, contextPointer: bigint): boolean {
      return native().networkingSocketsReceivedP2pCustomSignal(Buffer.from(message), contextPointer);
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
    onConnectionStatusChanged(handler: (event: NetworkingConnectionStatusChangedEvent) => void): CallbackHandle {
      return onSteamCallback("SteamNetConnectionStatusChanged", (event) => {
        handler(event as NetworkingConnectionStatusChangedEvent);
      });
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
    connectToHostedDedicatedServer(
      identity: NetworkingIdentity,
      remoteVirtualPort = 0,
      options?: readonly NetworkingConfigOption[] | null
    ): number {
      return native().networkingSocketsConnectToHostedDedicatedServer(
        nativeNetworkingIdentity(identity),
        remoteVirtualPort,
        nativeNetworkingConfigValues(options)
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
    createHostedDedicatedServerDevAddress(ip: number, port: number, popId: number): NetworkingHostedDedicatedServerRouting {
      return normalizeNetworkingHostedDedicatedServerRouting(
        native().networkingSocketsCreateHostedDedicatedServerDevAddress(ip, port, popId)
      )!;
    },
    createHostedDedicatedServerListenSocket(
      localVirtualPort = 0,
      options?: readonly NetworkingConfigOption[] | null
    ): number {
      return native().networkingSocketsCreateHostedDedicatedServerListenSocket(
        localVirtualPort,
        nativeNetworkingConfigValues(options)
      );
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
    onFakeIpResult(handler: (event: NetworkingFakeIpResultEvent) => void): CallbackHandle {
      return onSteamCallback("SteamNetworkingFakeIPResult", (event) => {
        handler(event as NetworkingFakeIpResultEvent);
      });
    },
    getFakeIP(idxFirstPort = 0): NetworkingFakeIpResult {
      return normalizeNetworkingFakeIpResult(native().networkingSocketsGetFakeIp(idxFirstPort));
    },
    createListenSocketP2PFakeIP(
      idxFakePort = 0,
      options?: readonly NetworkingConfigOption[] | null
    ): number {
      return native().networkingSocketsCreateListenSocketP2pFakeIp(
        idxFakePort,
        nativeNetworkingConfigValues(options)
      );
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
    onAuthenticationStatus(handler: (event: NetworkingAuthenticationStatusEvent) => void): CallbackHandle {
      return onSteamCallback("SteamNetAuthenticationStatus", (event) => {
        handler(event as NetworkingAuthenticationStatusEvent);
      });
    },
    onRelayNetworkStatus(handler: (event: NetworkingRelayNetworkStatusEvent) => void): CallbackHandle {
      return onSteamCallback("SteamRelayNetworkStatus", (event) => {
        handler(event as NetworkingRelayNetworkStatusEvent);
      });
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
    ipAddressEquals(address1: NetworkingIpAddress, address2: NetworkingIpAddress): boolean {
      return native().networkingUtilsIpAddressEquals(
        nativeNetworkingIpAddress(address1),
        nativeNetworkingIpAddress(address2)
      );
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
    getIdentitySteamId(identity: NetworkingIdentity): bigint {
      return native().networkingUtilsIdentityGetSteamId(nativeNetworkingIdentity(identity));
    },
    getIdentityPsnId(identity: NetworkingIdentity): bigint {
      return native().networkingUtilsIdentityGetPsnId(nativeNetworkingIdentity(identity));
    },
    getIdentityXboxPairwiseId(identity: NetworkingIdentity): string | null {
      return native().networkingUtilsIdentityGetXboxPairwiseId(nativeNetworkingIdentity(identity)) ?? null;
    },
    getIdentityIpAddress(identity: NetworkingIdentity): NetworkingIpAddressInfo | null {
      return normalizeNetworkingIpAddressInfo(
        native().networkingUtilsIdentityGetIpAddress(nativeNetworkingIdentity(identity))
      );
    },
    getIdentityIpv4(identity: NetworkingIdentity): number {
      return native().networkingUtilsIdentityGetIpv4(nativeNetworkingIdentity(identity));
    },
    getIdentityGenericBytes(identity: NetworkingIdentity): Buffer | null {
      return native().networkingUtilsIdentityGetGenericBytes(nativeNetworkingIdentity(identity)) ?? null;
    },
    identityEquals(identity1: NetworkingIdentity, identity2: NetworkingIdentity): boolean {
      return native().networkingUtilsIdentityEquals(
        nativeNetworkingIdentity(identity1),
        nativeNetworkingIdentity(identity2)
      );
    },
    identityIsFakeIp(identity: NetworkingIdentity): boolean {
      return native().networkingUtilsIdentityIsFakeIp(nativeNetworkingIdentity(identity));
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
    setGlobalConfigValuePointer(value: number, pointer?: bigint | null): boolean {
      return native().networkingUtilsSetGlobalConfigValuePtr(value, pointer ?? null);
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
    enableGlobalCallbacks(): boolean {
      return native().networkingUtilsEnableGlobalCallbacks();
    },
    clearGlobalCallbacks(): boolean {
      return native().networkingUtilsClearGlobalCallbacks();
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
  ...createLegacyNetworkingCallbackHelpers(),
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
  createListenSocketIP(address: NetworkingIpAddress, options?: readonly NetworkingConfigOption[] | null): number {
    return native().gameServerNetworkingSocketsCreateListenSocketIp(
      nativeNetworkingIpAddress(address),
      nativeNetworkingConfigValues(options)
    );
  },
  connectByIPAddress(address: NetworkingIpAddress, options?: readonly NetworkingConfigOption[] | null): number {
    return native().gameServerNetworkingSocketsConnectByIpAddress(
      nativeNetworkingIpAddress(address),
      nativeNetworkingConfigValues(options)
    );
  },
  createListenSocketP2P(localVirtualPort = 0, options?: readonly NetworkingConfigOption[] | null): number {
    return native().gameServerNetworkingSocketsCreateListenSocketP2p(
      localVirtualPort,
      nativeNetworkingConfigValues(options)
    );
  },
  connectP2P(
    identity: NetworkingIdentity,
    remoteVirtualPort = 0,
    options?: readonly NetworkingConfigOption[] | null
  ): number {
    return native().gameServerNetworkingSocketsConnectP2p(
      nativeNetworkingIdentity(identity),
      remoteVirtualPort,
      nativeNetworkingConfigValues(options)
    );
  },
  connectP2PCustomSignaling(
    signalingPointer: bigint,
    peerIdentity?: NetworkingIdentity | null,
    remoteVirtualPort = 0,
    options?: readonly NetworkingConfigOption[] | null
  ): number {
    return native().gameServerNetworkingSocketsConnectP2pCustomSignaling(
      signalingPointer,
      peerIdentity ? nativeNetworkingIdentity(peerIdentity) : undefined,
      remoteVirtualPort,
      nativeNetworkingConfigValues(options)
    );
  },
  receivedP2PCustomSignal(message: Buffer | Uint8Array, contextPointer: bigint): boolean {
    return native().gameServerNetworkingSocketsReceivedP2pCustomSignal(Buffer.from(message), contextPointer);
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
  onConnectionStatusChanged(handler: (event: NetworkingConnectionStatusChangedEvent) => void): CallbackHandle {
    return onSteamCallback("SteamNetConnectionStatusChanged", (event) => {
      handler(event as NetworkingConnectionStatusChangedEvent);
    });
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
  connectToHostedDedicatedServer(
    identity: NetworkingIdentity,
    remoteVirtualPort = 0,
    options?: readonly NetworkingConfigOption[] | null
  ): number {
    return native().gameServerNetworkingSocketsConnectToHostedDedicatedServer(
      nativeNetworkingIdentity(identity),
      remoteVirtualPort,
      nativeNetworkingConfigValues(options)
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
  createHostedDedicatedServerListenSocket(
    localVirtualPort = 0,
    options?: readonly NetworkingConfigOption[] | null
  ): number {
    return native().gameServerNetworkingSocketsCreateHostedDedicatedServerListenSocket(
      localVirtualPort,
      nativeNetworkingConfigValues(options)
    );
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
  onFakeIpResult(handler: (event: NetworkingFakeIpResultEvent) => void): CallbackHandle {
    return onSteamCallback("SteamNetworkingFakeIPResult", (event) => {
      handler(event as NetworkingFakeIpResultEvent);
    });
  },
  getFakeIP(idxFirstPort = 0): NetworkingFakeIpResult {
    return normalizeNetworkingFakeIpResult(native().gameServerNetworkingSocketsGetFakeIp(idxFirstPort));
  },
  createListenSocketP2PFakeIP(idxFakePort = 0, options?: readonly NetworkingConfigOption[] | null): number {
    return native().gameServerNetworkingSocketsCreateListenSocketP2pFakeIp(
      idxFakePort,
      nativeNetworkingConfigValues(options)
    );
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
  UserDialog,
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
  attachPresenter: attachOverlayPresenter,
  openDialogOverlay,
  openWebOverlay,
  openFriendsOverlay,
  openProfileOverlay,
  openPlayersOverlay,
  openCommunityOverlay,
  openStatsOverlay,
  openAchievementsOverlay,
  openNativeUserOverlay,
  openUserOverlay,
  openUserEquivalentOverlay,
  openCheckoutOverlay,
  checkoutTargetFromResult,
  openDialogEquivalentOverlay,
  openNativeStoreOverlay,
  openStoreOverlay,
  openSteamOverlay,
  createElectronSteamOverlay,
  startNativeOverlaySession,
  activateDialogWithNativeSession,
  activateToWebPageWithNativeSession,
  activateToStoreWithNativeSession,
  openNativeOverlayProbeWindow,
  attachNativeOverlayHostView,
  pumpNativeOverlayProbeWindow,
  pumpNativeOverlayHostView,
  showNativeOverlayHostView,
  hideNativeOverlayHostView,
  setNativeOverlayHostInputPassthrough,
  setNativeOverlayHostOpacity,
  updateNativeOverlayHostFrame,
  closeNativeOverlayProbeWindow,
  detachNativeOverlayHostView,
  isNativeOverlayProbeWindowOpen,
  isNativeOverlayHostViewOpen,
  getMacWindowSnapshot,
  getMacOverlayEnvironment
};

export const stats = {
  LeaderboardDataRequest,
  LeaderboardSortMethod,
  LeaderboardDisplayType,
  LeaderboardUploadScoreMethod,
  onUserStatsReceived(handler: (event: UserStatsReceivedEvent) => void): CallbackHandle {
    return onSteamCallback("UserStatsReceived", (event) => {
      handler(event as UserStatsReceivedEvent);
    });
  },
  onUserStatsStored(handler: (event: UserStatsStoredEvent) => void): CallbackHandle {
    return onSteamCallback("UserStatsStored", (event) => {
      handler(event as UserStatsStoredEvent);
    });
  },
  onUserStatsUnloaded(handler: (event: UserStatsUnloadedEvent) => void): CallbackHandle {
    return onSteamCallback("UserStatsUnloaded", (event) => {
      handler(event as UserStatsUnloadedEvent);
    });
  },
  onLeaderboardFindResult(handler: (event: LeaderboardFindResultEvent) => void): CallbackHandle {
    return onSteamCallback("LeaderboardFindResult", (event) => {
      handler(event as LeaderboardFindResultEvent);
    });
  },
  onLeaderboardScoresDownloaded(handler: (event: LeaderboardScoresDownloadedEvent) => void): CallbackHandle {
    return onSteamCallback("LeaderboardScoresDownloaded", (event) => {
      handler(event as LeaderboardScoresDownloadedEvent);
    });
  },
  onLeaderboardScoreUploaded(handler: (event: LeaderboardScoreUploadedEvent) => void): CallbackHandle {
    return onSteamCallback("LeaderboardScoreUploaded", (event) => {
      handler(event as LeaderboardScoreUploadedEvent);
    });
  },
  onNumberOfCurrentPlayers(handler: (event: NumberOfCurrentPlayersEvent) => void): CallbackHandle {
    return onSteamCallback("NumberOfCurrentPlayers", (event) => {
      handler(event as NumberOfCurrentPlayersEvent);
    });
  },
  onGlobalAchievementPercentagesReady(
    handler: (event: GlobalAchievementPercentagesReadyEvent) => void
  ): CallbackHandle {
    return onSteamCallback("GlobalAchievementPercentagesReady", (event) => {
      handler(event as GlobalAchievementPercentagesReadyEvent);
    });
  },
  onLeaderboardUgcSet(handler: (event: LeaderboardUgcSetEvent) => void): CallbackHandle {
    return onSteamCallback("LeaderboardUGCSet", (event) => {
      handler(event as LeaderboardUgcSetEvent);
    });
  },
  onGlobalStatsReceived(handler: (event: GlobalStatsReceivedEvent) => void): CallbackHandle {
    return onSteamCallback("GlobalStatsReceived", (event) => {
      handler(event as GlobalStatsReceivedEvent);
    });
  },
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
    prepareElectronNotificationPresenters();
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

export const gameCoordinator = {
  GameCoordinatorResult,
  onMessageAvailable(handler: (event: GameCoordinatorMessageAvailableEvent) => void): CallbackHandle {
    return onSteamCallback("GCMessageAvailable", (event) => {
      handler(event as GameCoordinatorMessageAvailableEvent);
    });
  },
  onMessageFailed(handler: (event: GameCoordinatorMessageFailedEvent) => void): CallbackHandle {
    return onSteamCallback("GCMessageFailed", (event) => {
      handler(event as GameCoordinatorMessageFailedEvent);
    });
  },
  sendMessage(messageType: number, data: Buffer | Uint8Array | string): number {
    return native().gameCoordinatorSendMessage(messageType, Buffer.from(data));
  },
  isMessageAvailable(): GameCoordinatorMessageAvailable {
    return normalizeGameCoordinatorMessageAvailable(native().gameCoordinatorIsMessageAvailable());
  },
  retrieveMessage(maxBytes?: number | null): GameCoordinatorMessage {
    return normalizeGameCoordinatorMessage(native().gameCoordinatorRetrieveMessage(maxBytes));
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
  },
  onReady(handler: (event: ScreenshotReadyEvent) => void): CallbackHandle {
    return onSteamCallback("ScreenshotReady", (event) => {
      handler(event as ScreenshotReadyEvent);
    });
  },
  onRequested(handler: (event: ScreenshotRequestedEvent) => void): CallbackHandle {
    return onSteamCallback("ScreenshotRequested", (event) => {
      handler(event as ScreenshotRequestedEvent);
    });
  }
};

export const musicRemote = {
  register(name: string): boolean {
    return native().musicRemoteRegister(name);
  },
  deregister(): boolean {
    return native().musicRemoteDeregister();
  },
  isCurrent(): boolean {
    return native().musicRemoteIsCurrent();
  },
  activationSuccess(value: boolean): boolean {
    return native().musicRemoteActivationSuccess(value);
  },
  setDisplayName(displayName: string): boolean {
    return native().musicRemoteSetDisplayName(displayName);
  },
  setPngIcon64x64(data: Buffer | Uint8Array): boolean {
    return native().musicRemoteSetPngIcon64x64(Buffer.from(data));
  },
  enablePlayPrevious(value: boolean): boolean {
    return native().musicRemoteEnablePlayPrevious(value);
  },
  enablePlayNext(value: boolean): boolean {
    return native().musicRemoteEnablePlayNext(value);
  },
  enableShuffled(value: boolean): boolean {
    return native().musicRemoteEnableShuffled(value);
  },
  enableLooped(value: boolean): boolean {
    return native().musicRemoteEnableLooped(value);
  },
  enableQueue(value: boolean): boolean {
    return native().musicRemoteEnableQueue(value);
  },
  enablePlaylists(value: boolean): boolean {
    return native().musicRemoteEnablePlaylists(value);
  },
  updatePlaybackStatus(status: number): boolean {
    return native().musicRemoteUpdatePlaybackStatus(status);
  },
  updateShuffled(value: boolean): boolean {
    return native().musicRemoteUpdateShuffled(value);
  },
  updateLooped(value: boolean): boolean {
    return native().musicRemoteUpdateLooped(value);
  },
  updateVolume(volume: number): boolean {
    return native().musicRemoteUpdateVolume(volume);
  },
  currentEntryWillChange(): boolean {
    return native().musicRemoteCurrentEntryWillChange();
  },
  currentEntryIsAvailable(available: boolean): boolean {
    return native().musicRemoteCurrentEntryIsAvailable(available);
  },
  updateCurrentEntryText(text: string): boolean {
    return native().musicRemoteUpdateCurrentEntryText(text);
  },
  updateCurrentEntryElapsedSeconds(value: number): boolean {
    return native().musicRemoteUpdateCurrentEntryElapsedSeconds(value);
  },
  updateCurrentEntryCoverArt(data: Buffer | Uint8Array): boolean {
    return native().musicRemoteUpdateCurrentEntryCoverArt(Buffer.from(data));
  },
  currentEntryDidChange(): boolean {
    return native().musicRemoteCurrentEntryDidChange();
  },
  queueWillChange(): boolean {
    return native().musicRemoteQueueWillChange();
  },
  resetQueueEntries(): boolean {
    return native().musicRemoteResetQueueEntries();
  },
  setQueueEntry(id: number, position: number, entryText: string): boolean {
    return native().musicRemoteSetQueueEntry(id, position, entryText);
  },
  setCurrentQueueEntry(id: number): boolean {
    return native().musicRemoteSetCurrentQueueEntry(id);
  },
  queueDidChange(): boolean {
    return native().musicRemoteQueueDidChange();
  },
  playlistWillChange(): boolean {
    return native().musicRemotePlaylistWillChange();
  },
  resetPlaylistEntries(): boolean {
    return native().musicRemoteResetPlaylistEntries();
  },
  setPlaylistEntry(id: number, position: number, entryText: string): boolean {
    return native().musicRemoteSetPlaylistEntry(id, position, entryText);
  },
  setCurrentPlaylistEntry(id: number): boolean {
    return native().musicRemoteSetCurrentPlaylistEntry(id);
  },
  playlistDidChange(): boolean {
    return native().musicRemotePlaylistDidChange();
  },
  onWantsVolume(handler: (event: MusicRemoteWantsVolumeEvent) => void): CallbackHandle {
    return onSteamCallback("MusicPlayerWantsVolume", (event) => {
      handler(event as MusicRemoteWantsVolumeEvent);
    });
  },
  onSelectsQueueEntry(handler: (event: MusicRemoteSelectsEntryEvent) => void): CallbackHandle {
    return onSteamCallback("MusicPlayerSelectsQueueEntry", (event) => {
      handler(event as MusicRemoteSelectsEntryEvent);
    });
  },
  onSelectsPlaylistEntry(handler: (event: MusicRemoteSelectsEntryEvent) => void): CallbackHandle {
    return onSteamCallback("MusicPlayerSelectsPlaylistEntry", (event) => {
      handler(event as MusicRemoteSelectsEntryEvent);
    });
  },
  onRemoteWillActivate(handler: (event: MusicRemoteControlEvent) => void): CallbackHandle {
    return onSteamCallback("MusicPlayerRemoteWillActivate", (event) => {
      handler(event as MusicRemoteControlEvent);
    });
  },
  onRemoteWillDeactivate(handler: (event: MusicRemoteControlEvent) => void): CallbackHandle {
    return onSteamCallback("MusicPlayerRemoteWillDeactivate", (event) => {
      handler(event as MusicRemoteControlEvent);
    });
  },
  onRemoteToFront(handler: (event: MusicRemoteControlEvent) => void): CallbackHandle {
    return onSteamCallback("MusicPlayerRemoteToFront", (event) => {
      handler(event as MusicRemoteControlEvent);
    });
  },
  onWillQuit(handler: (event: MusicRemoteControlEvent) => void): CallbackHandle {
    return onSteamCallback("MusicPlayerWillQuit", (event) => {
      handler(event as MusicRemoteControlEvent);
    });
  },
  onWantsPlay(handler: (event: MusicRemoteControlEvent) => void): CallbackHandle {
    return onSteamCallback("MusicPlayerWantsPlay", (event) => {
      handler(event as MusicRemoteControlEvent);
    });
  },
  onWantsPause(handler: (event: MusicRemoteControlEvent) => void): CallbackHandle {
    return onSteamCallback("MusicPlayerWantsPause", (event) => {
      handler(event as MusicRemoteControlEvent);
    });
  },
  onWantsPlayPrevious(handler: (event: MusicRemoteControlEvent) => void): CallbackHandle {
    return onSteamCallback("MusicPlayerWantsPlayPrevious", (event) => {
      handler(event as MusicRemoteControlEvent);
    });
  },
  onWantsPlayNext(handler: (event: MusicRemoteControlEvent) => void): CallbackHandle {
    return onSteamCallback("MusicPlayerWantsPlayNext", (event) => {
      handler(event as MusicRemoteControlEvent);
    });
  },
  onWantsShuffled(handler: (event: MusicRemoteWantsShuffledEvent) => void): CallbackHandle {
    return onSteamCallback("MusicPlayerWantsShuffled", (event) => {
      handler(event as MusicRemoteWantsShuffledEvent);
    });
  },
  onWantsLooped(handler: (event: MusicRemoteWantsLoopedEvent) => void): CallbackHandle {
    return onSteamCallback("MusicPlayerWantsLooped", (event) => {
      handler(event as MusicRemoteWantsLoopedEvent);
    });
  },
  onWantsPlayingRepeatStatus(handler: (event: MusicRemoteWantsPlayingRepeatStatusEvent) => void): CallbackHandle {
    return onSteamCallback("MusicPlayerWantsPlayingRepeatStatus", (event) => {
      handler(event as MusicRemoteWantsPlayingRepeatStatusEvent);
    });
  }
};

export const music = {
  AudioPlaybackStatus,
  remote: musicRemote,
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
  },
  onPlaybackStatusChanged(handler: (event: MusicPlaybackStatusChangedEvent) => void): CallbackHandle {
    return onSteamCallback("PlaybackStatusHasChanged", (event) => {
      handler(event as MusicPlaybackStatusChangedEvent);
    });
  },
  onVolumeChanged(handler: (event: MusicVolumeHasChangedEvent) => void): CallbackHandle {
    return onSteamCallback("VolumeHasChanged", (event) => {
      handler(event as MusicVolumeHasChangedEvent);
    });
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
  },
  onBroadcastUploadStart(handler: (event: VideoBroadcastUploadStartEvent) => void): CallbackHandle {
    return onSteamCallback("BroadcastUploadStart", (event) => {
      handler(event as VideoBroadcastUploadStartEvent);
    });
  },
  onBroadcastUploadStop(handler: (event: VideoBroadcastUploadStopEvent) => void): CallbackHandle {
    return onSteamCallback("BroadcastUploadStop", (event) => {
      handler(event as VideoBroadcastUploadStopEvent);
    });
  },
  onGetVideoUrlResult(handler: (event: VideoUrlResultEvent) => void): CallbackHandle {
    return onSteamCallback("GetVideoURLResult", (event) => {
      handler(event as VideoUrlResultEvent);
    });
  },
  onGetOpfSettingsResult(handler: (event: VideoOpfSettingsResultEvent) => void): CallbackHandle {
    return onSteamCallback("GetOPFSettingsResult", (event) => {
      handler(event as VideoOpfSettingsResultEvent);
    });
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
  },
  onSettingsChanged(handler: (event: ParentalSettingsChangedEvent) => void): CallbackHandle {
    return onSteamCallback("SteamParentalSettingsChanged", (event) => {
      handler(event as ParentalSettingsChangedEvent);
    });
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
  },
  onGamePhaseRecordingExists(handler: (event: TimelineGamePhaseRecordingExistsEvent) => void): CallbackHandle {
    return onSteamCallback("SteamTimelineGamePhaseRecordingExists", (event) => {
      handler(event as TimelineGamePhaseRecordingExistsEvent);
    });
  },
  onEventRecordingExists(handler: (event: TimelineEventRecordingExistsEvent) => void): CallbackHandle {
    return onSteamCallback("SteamTimelineEventRecordingExists", (event) => {
      handler(event as TimelineEventRecordingExistsEvent);
    });
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
  },
  onSessionConnected(handler: (event: RemotePlaySessionEvent) => void): CallbackHandle {
    return onSteamCallback("SteamRemotePlaySessionConnected", (event) => {
      handler(event as RemotePlaySessionEvent);
    });
  },
  onSessionDisconnected(handler: (event: RemotePlaySessionEvent) => void): CallbackHandle {
    return onSteamCallback("SteamRemotePlaySessionDisconnected", (event) => {
      handler(event as RemotePlaySessionEvent);
    });
  },
  onTogetherGuestInvite(handler: (event: RemotePlayTogetherGuestInviteEvent) => void): CallbackHandle {
    return onSteamCallback("SteamRemotePlayTogetherGuestInvite", (event) => {
      handler(event as RemotePlayTogetherGuestInviteEvent);
    });
  },
  onSessionAvatarLoaded(handler: (event: RemotePlaySessionAvatarLoadedEvent) => void): CallbackHandle {
    return onSteamCallback("SteamRemotePlaySessionAvatarLoaded", (event) => {
      handler(event as RemotePlaySessionAvatarLoadedEvent);
    });
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
  onIpCountry(handler: (event: UtilsIpCountryEvent) => void): CallbackHandle {
    return onSteamCallback("IPCountry", (event) => {
      handler(event as UtilsIpCountryEvent);
    });
  },
  onLowBatteryPower(handler: (event: UtilsLowBatteryPowerEvent) => void): CallbackHandle {
    return onSteamCallback("LowBatteryPower", (event) => {
      handler(event as UtilsLowBatteryPowerEvent);
    });
  },
  onApiCallCompleted(handler: (event: UtilsApiCallCompletedEvent) => void): CallbackHandle {
    return onSteamCallback("SteamAPICallCompleted", (event) => {
      handler(event as UtilsApiCallCompletedEvent);
    });
  },
  onSteamShutdown(handler: (event: UtilsSteamShutdownEvent) => void): CallbackHandle {
    return onSteamCallback("SteamShutdown", (event) => {
      handler(event as UtilsSteamShutdownEvent);
    });
  },
  onIpcFailure(handler: (event: UtilsIpcFailureEvent) => void): CallbackHandle {
    return onSteamCallback("IPCFailure", (event) => {
      handler(event as UtilsIpcFailureEvent);
    });
  },
  onCheckFileSignature(handler: (event: UtilsCheckFileSignatureEvent) => void): CallbackHandle {
    return onSteamCallback("CheckFileSignature", (event) => {
      handler(event as UtilsCheckFileSignatureEvent);
    });
  },
  onGamepadTextInputDismissed(handler: (event: UtilsGamepadTextInputDismissedEvent) => void): CallbackHandle {
    return onSteamCallback("GamepadTextInputDismissed", (event) => {
      handler(event as UtilsGamepadTextInputDismissedEvent);
    });
  },
  onAppResumingFromSuspend(handler: (event: UtilsAppResumingFromSuspendEvent) => void): CallbackHandle {
    return onSteamCallback("AppResumingFromSuspend", (event) => {
      handler(event as UtilsAppResumingFromSuspendEvent);
    });
  },
  onFloatingGamepadTextInputDismissed(
    handler: (event: UtilsFloatingGamepadTextInputDismissedEvent) => void
  ): CallbackHandle {
    return onSteamCallback("FloatingGamepadTextInputDismissed", (event) => {
      handler(event as UtilsFloatingGamepadTextInputDismissedEvent);
    });
  },
  onFilterTextDictionaryChanged(handler: (event: UtilsFilterTextDictionaryChangedEvent) => void): CallbackHandle {
    return onSteamCallback("FilterTextDictionaryChanged", (event) => {
      handler(event as UtilsFilterTextDictionaryChangedEvent);
    });
  },
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
  getCSERIPPort(): UtilsCserIPPort | null {
    return normalizeUtilsCserIPPort(native().utilsGetCserIpPort());
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
  isOverlayNeedsPresentPollingEnabled,
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

function createWorkshopCallbackHelpers() {
  return {
    onQueryCompleted(handler: (event: WorkshopQueryCompletedEvent) => void): CallbackHandle {
      return onWorkshopCallback("SteamUGCQueryCompleted", handler);
    },
    onRequestDetailsResult(handler: (event: WorkshopItemDetailsResult) => void): CallbackHandle {
      return onWorkshopCallback("SteamUGCRequestDetailsResult", handler);
    },
    onCreateItemResult(handler: (event: WorkshopCreateItemResultEvent) => void): CallbackHandle {
      return onWorkshopCallback("SteamUGCCreateItemResult", handler);
    },
    onSubmitItemUpdateResult(handler: (event: WorkshopSubmitItemUpdateResultEvent) => void): CallbackHandle {
      return onWorkshopCallback("SteamUGCSubmitItemUpdateResult", handler);
    },
    onItemInstalled(handler: (event: WorkshopItemInstalledEvent) => void): CallbackHandle {
      return onWorkshopCallback("SteamUGCItemInstalled", handler);
    },
    onDownloadItemResult(handler: (event: WorkshopDownloadItemResultEvent) => void): CallbackHandle {
      return onWorkshopCallback("SteamUGCDownloadItemResult", handler);
    },
    onUserFavoriteItemsListChanged(handler: (event: WorkshopFavoriteResult) => void): CallbackHandle {
      return onWorkshopCallback("SteamUGCUserFavoriteItemsListChanged", handler);
    },
    onSetUserItemVoteResult(handler: (event: WorkshopSetUserItemVoteResult) => void): CallbackHandle {
      return onWorkshopCallback("SteamUGCSetUserItemVoteResult", handler);
    },
    onGetUserItemVoteResult(handler: (event: WorkshopGetUserItemVoteResult) => void): CallbackHandle {
      return onWorkshopCallback("SteamUGCGetUserItemVoteResult", handler);
    },
    onStartPlaytimeTrackingResult(handler: (event: WorkshopSimpleResult) => void): CallbackHandle {
      return onWorkshopCallback("SteamUGCStartPlaytimeTrackingResult", handler);
    },
    onStopPlaytimeTrackingResult(handler: (event: WorkshopSimpleResult) => void): CallbackHandle {
      return onWorkshopCallback("SteamUGCStopPlaytimeTrackingResult", handler);
    },
    onAddDependencyResult(handler: (event: WorkshopDependencyResult) => void): CallbackHandle {
      return onWorkshopCallback("SteamUGCAddDependencyResult", handler);
    },
    onRemoveDependencyResult(handler: (event: WorkshopDependencyResult) => void): CallbackHandle {
      return onWorkshopCallback("SteamUGCRemoveDependencyResult", handler);
    },
    onAddAppDependencyResult(handler: (event: WorkshopAppDependencyResult) => void): CallbackHandle {
      return onWorkshopCallback("SteamUGCAddAppDependencyResult", handler);
    },
    onRemoveAppDependencyResult(handler: (event: WorkshopAppDependencyResult) => void): CallbackHandle {
      return onWorkshopCallback("SteamUGCRemoveAppDependencyResult", handler);
    },
    onGetAppDependenciesResult(handler: (event: WorkshopAppDependenciesResult) => void): CallbackHandle {
      return onWorkshopCallback("SteamUGCGetAppDependenciesResult", handler);
    },
    onDeleteItemResult(handler: (event: WorkshopDeleteItemResult) => void): CallbackHandle {
      return onWorkshopCallback("SteamUGCDeleteItemResult", handler);
    },
    onUserSubscribedItemsListChanged(
      handler: (event: WorkshopUserSubscribedItemsListChangedEvent) => void
    ): CallbackHandle {
      return onWorkshopCallback("SteamUGCUserSubscribedItemsListChanged", handler);
    },
    onWorkshopEulaStatus(handler: (event: WorkshopEulaStatus) => void): CallbackHandle {
      return onWorkshopCallback("SteamUGCWorkshopEULAStatus", handler);
    }
  };
}

function onWorkshopCallback<T>(steamCallback: SteamCallbackName, handler: (event: T) => void): CallbackHandle {
  return onSteamCallback(steamCallback, (event) => {
    handler(event as T);
  });
}

export const workshop = {
  UgcItemVisibility,
  UpdateStatus,
  UGCQueryType,
  UGCType,
  UGCContentDescriptor,
  ItemPreviewType,
  UserListType,
  UserListOrder,
  ...createWorkshopCallbackHelpers(),
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
  ...createWorkshopCallbackHelpers(),
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
  SteamworksEnums: typeof SteamworksEnums;
  getSteamworksEnum: typeof getSteamworksEnum;
  getSteamworksEnumValue: typeof getSteamworksEnumValue;
  achievement: typeof achievement;
  appTicket: typeof appTicket;
  apps: typeof apps;
  auth: typeof auth;
  callback: typeof callback;
  client: typeof client;
  cloud: typeof cloud;
  controller: typeof controller;
  encryptedAppTicket: typeof encryptedAppTicket;
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
  musicRemote: typeof musicRemote;
  parties: typeof parties;
  parental: typeof parental;
  remotePlay: typeof remotePlay;
  screenshots: typeof screenshots;
  stats: typeof stats;
  timeline: typeof timeline;
  user: typeof user;
  utils: typeof utils;
  video: typeof video;
  webApi: typeof webApi;
  workshop: typeof workshop;
}

export function createCompatibilityClient(): SteamBridgeClient {
  return {
    SteamworksEnums,
    getSteamworksEnum,
    getSteamworksEnumValue,
    achievement,
    appTicket,
    apps,
    auth,
    callback,
    client,
    cloud,
    controller,
    encryptedAppTicket,
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
    musicRemote,
    parties,
    parental,
    remotePlay,
    screenshots,
    stats,
    timeline,
    user,
    utils,
    video,
    webApi,
    workshop
  };
}

function native(): NativeBinding {
  return loadNativeBinding();
}

function createSteamWebApiAppsFacade(clientOptions: SteamWebApiClientOptions): SteamWebApiAppsFacade {
  return {
    getAppBetas<T = unknown>(
      appId: number,
      options?: SteamWebApiEndpointOptions | null
    ): Promise<SteamWebApiResponse<T>> {
      return steamWebApiGet<T>(clientOptions, "ISteamApps", "GetAppBetas", 1, { appid: appId }, options);
    },
    getAppBuilds<T = unknown>(options: SteamWebApiAppBuildsOptions): Promise<SteamWebApiResponse<T>> {
      return steamWebApiGet<T>(
        clientOptions,
        "ISteamApps",
        "GetAppBuilds",
        1,
        { appid: options.appId, count: options.count },
        options
      );
    },
    getAppDepotVersions<T = unknown>(
      appId: number,
      options?: SteamWebApiEndpointOptions | null
    ): Promise<SteamWebApiResponse<T>> {
      return steamWebApiGet<T>(clientOptions, "ISteamApps", "GetAppDepotVersions", 1, { appid: appId }, options);
    },
    getAppList<T = unknown>(options?: SteamWebApiEndpointOptions | null): Promise<SteamWebApiResponse<T>> {
      return steamWebApiGet<T>(clientOptions, "ISteamApps", "GetAppList", 2, {}, options, false);
    },
    getPartnerAppListForWebApiKey<T = unknown>(
      options?: SteamWebApiPartnerAppListOptions | null
    ): Promise<SteamWebApiResponse<T>> {
      return steamWebApiGet<T>(
        clientOptions,
        "ISteamApps",
        "GetPartnerAppListForWebAPIKey",
        2,
        { type_filter: commaString(options?.typeFilter) },
        options
      );
    },
    getPlayersBanned<T = unknown>(
      appId: number,
      options?: SteamWebApiEndpointOptions | null
    ): Promise<SteamWebApiResponse<T>> {
      return steamWebApiGet<T>(clientOptions, "ISteamApps", "GetPlayersBanned", 1, { appid: appId }, options);
    },
    getSdrConfig<T = unknown>(
      appId: number,
      options?: SteamWebApiEndpointOptions | null
    ): Promise<SteamWebApiResponse<T>> {
      return steamWebApiGet<T>(clientOptions, "ISteamApps", "GetSDRConfig", 1, { appid: appId }, options, false);
    },
    getServerList<T = unknown>(options?: SteamWebApiServerListOptions | null): Promise<SteamWebApiResponse<T>> {
      return steamWebApiGet<T>(
        clientOptions,
        "ISteamApps",
        "GetServerList",
        1,
        { filter: options?.filter, limit: options?.limit },
        options
      );
    },
    getServersAtAddress<T = unknown>(
      address: string,
      options?: SteamWebApiEndpointOptions | null
    ): Promise<SteamWebApiResponse<T>> {
      return steamWebApiGet<T>(clientOptions, "ISteamApps", "GetServersAtAddress", 1, { addr: address }, options, false);
    },
    setAppBuildLive<T = unknown>(options: SteamWebApiSetAppBuildLiveOptions): Promise<SteamWebApiResponse<T>> {
      return steamWebApiPost<T>(
        clientOptions,
        "ISteamApps",
        "SetAppBuildLive",
        2,
        {
          appid: options.appId,
          buildid: options.buildId,
          betakey: options.betaKey,
          steamid: options.steamId64,
          description: options.description
        },
        options
      );
    },
    upToDateCheck<T = unknown>(options: SteamWebApiUpToDateCheckOptions): Promise<SteamWebApiResponse<T>> {
      return steamWebApiGet<T>(
        clientOptions,
        "ISteamApps",
        "UpToDateCheck",
        1,
        { appid: options.appId, version: options.version },
        options,
        false
      );
    }
  };
}

function createSteamWebApiNewsFacade(clientOptions: SteamWebApiClientOptions): SteamWebApiNewsFacade {
  return {
    getNewsForApp<T = unknown>(options: SteamWebApiNewsForAppOptions): Promise<SteamWebApiResponse<T>> {
      return steamWebApiGet<T>(
        clientOptions,
        "ISteamNews",
        "GetNewsForApp",
        2,
        steamWebApiNewsForAppParams(options),
        options,
        false
      );
    },
    getNewsForAppAuthed<T = unknown>(options: SteamWebApiNewsForAppOptions): Promise<SteamWebApiResponse<T>> {
      return steamWebApiGet<T>(
        clientOptions,
        "ISteamNews",
        "GetNewsForAppAuthed",
        2,
        steamWebApiNewsForAppParams(options),
        options
      );
    }
  };
}

function createSteamWebApiAuthenticationServiceFacade(
  clientOptions: SteamWebApiClientOptions
): SteamWebApiAuthenticationServiceFacade {
  return {
    pollAuthSessionStatus<T = unknown>(
      options: SteamWebApiPollAuthSessionStatusOptions
    ): Promise<SteamWebApiResponse<T>> {
      return steamWebApiServicePost<T>(
        clientOptions,
        "IAuthenticationService",
        "PollAuthSessionStatus",
        1,
        {
          client_id: options.clientId,
          request_id: options.requestId,
          token_to_revoke: options.tokenToRevoke
        },
        steamWebApiKeylessEndpointOptions(options),
        false
      );
    },
    getAuthSessionInfo<T = unknown>(
      clientId: bigint | number | string,
      options?: SteamWebApiEndpointOptions | null
    ): Promise<SteamWebApiResponse<T>> {
      return steamWebApiServicePost<T>(
        clientOptions,
        "IAuthenticationService",
        "GetAuthSessionInfo",
        1,
        { client_id: clientId },
        steamWebApiKeylessEndpointOptions(options),
        false
      );
    },
    getAuthSessionRiskInfo<T = unknown>(
      options: SteamWebApiAuthSessionRiskInfoOptions
    ): Promise<SteamWebApiResponse<T>> {
      return steamWebApiServicePost<T>(
        clientOptions,
        "IAuthenticationService",
        "GetAuthSessionRiskInfo",
        1,
        { client_id: options.clientId, language: options.language },
        steamWebApiKeylessEndpointOptions(options),
        false
      );
    },
    notifyRiskQuizResults<T = unknown>(
      options: SteamWebApiNotifyRiskQuizResultsOptions
    ): Promise<SteamWebApiResponse<T>> {
      return steamWebApiServicePost<T>(
        clientOptions,
        "IAuthenticationService",
        "NotifyRiskQuizResults",
        1,
        {
          client_id: options.clientId,
          results: options.results,
          selected_action: options.selectedAction,
          did_confirm_login: options.didConfirmLogin
        },
        steamWebApiKeylessEndpointOptions(options),
        false
      );
    },
    getPasswordRsaPublicKey<T = unknown>(
      accountName: string,
      options?: SteamWebApiEndpointOptions | null
    ): Promise<SteamWebApiResponse<T>> {
      return steamWebApiServiceGet<T>(
        clientOptions,
        "IAuthenticationService",
        "GetPasswordRSAPublicKey",
        1,
        { account_name: accountName },
        steamWebApiKeylessEndpointOptions(options),
        false
      );
    },
    beginAuthSessionViaCredentials<T = unknown>(
      options: SteamWebApiBeginAuthSessionViaCredentialsOptions
    ): Promise<SteamWebApiResponse<T>> {
      return steamWebApiServicePost<T>(
        clientOptions,
        "IAuthenticationService",
        "BeginAuthSessionViaCredentials",
        1,
        {
          device_friendly_name: options.deviceFriendlyName,
          account_name: options.accountName,
          encrypted_password: options.encryptedPassword,
          encryption_timestamp: options.encryptionTimestamp,
          remember_login: options.rememberLogin,
          platform_type: options.platformType,
          persistence: options.persistence,
          website_id: options.websiteId,
          device_details: options.deviceDetails,
          guard_data: options.guardData,
          language: options.language,
          qos_level: options.qosLevel
        },
        steamWebApiKeylessEndpointOptions(options),
        false
      );
    },
    updateAuthSessionWithSteamGuardCode<T = unknown>(
      options: SteamWebApiUpdateAuthSessionWithSteamGuardCodeOptions
    ): Promise<SteamWebApiResponse<T>> {
      return steamWebApiServicePost<T>(
        clientOptions,
        "IAuthenticationService",
        "UpdateAuthSessionWithSteamGuardCode",
        1,
        {
          client_id: options.clientId,
          steamid: options.steamId64,
          code: options.code,
          code_type: options.codeType
        },
        steamWebApiKeylessEndpointOptions(options),
        false
      );
    },
    beginAuthSessionViaQr<T = unknown>(
      options: SteamWebApiBeginAuthSessionViaQrOptions
    ): Promise<SteamWebApiResponse<T>> {
      return steamWebApiServicePost<T>(
        clientOptions,
        "IAuthenticationService",
        "BeginAuthSessionViaQR",
        1,
        {
          device_friendly_name: options.deviceFriendlyName,
          platform_type: options.platformType,
          device_details: options.deviceDetails,
          website_id: options.websiteId
        },
        steamWebApiKeylessEndpointOptions(options),
        false
      );
    },
    updateAuthSessionWithMobileConfirmation<T = unknown>(
      options: SteamWebApiUpdateAuthSessionWithMobileConfirmationOptions
    ): Promise<SteamWebApiResponse<T>> {
      return steamWebApiServicePost<T>(
        clientOptions,
        "IAuthenticationService",
        "UpdateAuthSessionWithMobileConfirmation",
        1,
        {
          version: options.version,
          client_id: options.clientId,
          steamid: options.steamId64,
          signature: options.signature,
          confirm: options.confirm,
          persistence: options.persistence
        },
        steamWebApiKeylessEndpointOptions(options),
        false
      );
    }
  };
}

function createSteamWebApiBroadcastFacade(clientOptions: SteamWebApiClientOptions): SteamWebApiBroadcastFacade {
  return {
    playerStats<T = unknown>(options?: SteamWebApiEndpointOptions | null): Promise<SteamWebApiResponse<T>> {
      return steamWebApiPost<T>(clientOptions, "ISteamBroadcast", "PlayerStats", 1, {}, options, false);
    },
    viewerHeartbeat<T = unknown>(
      options: SteamWebApiBroadcastViewerHeartbeatOptions
    ): Promise<SteamWebApiResponse<T>> {
      return steamWebApiGet<T>(
        clientOptions,
        "ISteamBroadcast",
        "ViewerHeartbeat",
        1,
        {
          steamid: options.steamId64,
          sessionid: options.sessionId,
          token: options.token,
          stream: options.stream
        },
        options,
        false
      );
    }
  };
}

function createSteamWebApiDirectoryFacade(clientOptions: SteamWebApiClientOptions): SteamWebApiDirectoryFacade {
  return {
    getCmList<T = unknown>(options: SteamWebApiDirectoryCmListOptions): Promise<SteamWebApiResponse<T>> {
      return steamWebApiGet<T>(
        clientOptions,
        "ISteamDirectory",
        "GetCMList",
        1,
        { cellid: options.cellId, maxcount: options.maxCount },
        options,
        false
      );
    },
    getCmListForConnect<T = unknown>(
      options?: SteamWebApiDirectoryCmListForConnectOptions | null
    ): Promise<SteamWebApiResponse<T>> {
      return steamWebApiGet<T>(
        clientOptions,
        "ISteamDirectory",
        "GetCMListForConnect",
        1,
        {
          cellid: options?.cellId,
          cmtype: options?.cmType,
          realm: options?.realm,
          maxcount: options?.maxCount,
          qoslevel: options?.qosLevel
        },
        options,
        false
      );
    },
    getSteamPipeDomains<T = unknown>(
      options?: SteamWebApiEndpointOptions | null
    ): Promise<SteamWebApiResponse<T>> {
      return steamWebApiGet<T>(clientOptions, "ISteamDirectory", "GetSteamPipeDomains", 1, {}, options, false);
    }
  };
}

function createSteamWebApiPlayerServiceFacade(clientOptions: SteamWebApiClientOptions): SteamWebApiPlayerServiceFacade {
  return {
    getRecentlyPlayedGames<T = unknown>(
      options: SteamWebApiRecentlyPlayedGamesOptions
    ): Promise<SteamWebApiResponse<T>> {
      return steamWebApiServiceGet<T>(
        clientOptions,
        "IPlayerService",
        "GetRecentlyPlayedGames",
        1,
        { steamid: options.steamId64, count: options.count },
        options
      );
    },
    getSingleGamePlaytime<T = unknown>(
      options: SteamWebApiSingleGamePlaytimeOptions
    ): Promise<SteamWebApiResponse<T>> {
      return steamWebApiServiceGet<T>(
        clientOptions,
        "IPlayerService",
        "GetSingleGamePlaytime",
        1,
        { steamid: options.steamId64, appid: options.appId },
        options
      );
    },
    getOwnedGames<T = unknown>(options: SteamWebApiOwnedGamesOptions): Promise<SteamWebApiResponse<T>> {
      return steamWebApiServiceGet<T>(
        clientOptions,
        "IPlayerService",
        "GetOwnedGames",
        1,
        {
          steamid: options.steamId64,
          include_appinfo: options.includeAppInfo,
          include_played_free_games: options.includePlayedFreeGames,
          appids_filter: options.appIdsFilter
        },
        options
      );
    },
    getSteamLevel<T = unknown>(
      steamId64: bigint | number | string,
      options?: SteamWebApiEndpointOptions | null
    ): Promise<SteamWebApiResponse<T>> {
      return steamWebApiServiceGet<T>(
        clientOptions,
        "IPlayerService",
        "GetSteamLevel",
        1,
        { steamid: steamId64 },
        options
      );
    },
    getBadges<T = unknown>(
      steamId64: bigint | number | string,
      options?: SteamWebApiEndpointOptions | null
    ): Promise<SteamWebApiResponse<T>> {
      return steamWebApiServiceGet<T>(
        clientOptions,
        "IPlayerService",
        "GetBadges",
        1,
        { steamid: steamId64 },
        options
      );
    },
    getCommunityBadgeProgress<T = unknown>(
      options: SteamWebApiCommunityBadgeProgressOptions
    ): Promise<SteamWebApiResponse<T>> {
      return steamWebApiServiceGet<T>(
        clientOptions,
        "IPlayerService",
        "GetCommunityBadgeProgress",
        1,
        { steamid: options.steamId64, badgeid: options.badgeId },
        options
      );
    },
    recordOfflinePlaytime<T = unknown>(
      options: SteamWebApiRecordOfflinePlaytimeOptions
    ): Promise<SteamWebApiResponse<T>> {
      return steamWebApiServicePost<T>(
        clientOptions,
        "IPlayerService",
        "RecordOfflinePlaytime",
        1,
        {
          steamid: options.steamId64,
          ticket: options.ticket,
          play_sessions: options.playSessions
        },
        options
      );
    }
  };
}

function createSteamWebApiStoreServiceFacade(clientOptions: SteamWebApiClientOptions): SteamWebApiStoreServiceFacade {
  return {
    getAppList<T = unknown>(options?: SteamWebApiStoreAppListOptions | null): Promise<SteamWebApiResponse<T>> {
      return steamWebApiServiceGet<T>(
        clientOptions,
        "IStoreService",
        "GetAppList",
        1,
        {
          if_modified_since: options?.ifModifiedSince,
          have_description_language: options?.haveDescriptionLanguage,
          include_games: options?.includeGames,
          include_dlc: options?.includeDlc,
          include_software: options?.includeSoftware,
          include_videos: options?.includeVideos,
          include_hardware: options?.includeHardware,
          last_appid: options?.lastAppId,
          max_results: options?.maxResults
        },
        options
      );
    },
    getGamesFollowed<T = unknown>(
      steamId64: bigint | number | string,
      options?: SteamWebApiEndpointOptions | null
    ): Promise<SteamWebApiResponse<T>> {
      return steamWebApiServiceGet<T>(
        clientOptions,
        "IStoreService",
        "GetGamesFollowed",
        1,
        { steamid: steamId64 },
        options
      );
    },
    getGamesFollowedCount<T = unknown>(
      steamId64: bigint | number | string,
      options?: SteamWebApiEndpointOptions | null
    ): Promise<SteamWebApiResponse<T>> {
      return steamWebApiServiceGet<T>(
        clientOptions,
        "IStoreService",
        "GetGamesFollowedCount",
        1,
        { steamid: steamId64 },
        options
      );
    },
    getRecommendedTagsForUser<T = unknown>(
      options: SteamWebApiRecommendedTagsForUserOptions
    ): Promise<SteamWebApiResponse<T>> {
      return steamWebApiServiceGet<T>(
        clientOptions,
        "IStoreService",
        "GetRecommendedTagsForUser",
        1,
        {
          language: options.language,
          country_code: options.countryCode,
          favor_rarer_tags: options.favorRarerTags
        },
        options
      );
    }
  };
}

function createSteamWebApiTfSystemFacade(clientOptions: SteamWebApiClientOptions): SteamWebApiTfSystemFacade {
  return {
    getWorldStatus<T = unknown>(options?: SteamWebApiEndpointOptions | null): Promise<SteamWebApiResponse<T>> {
      return steamWebApiGet<T>(clientOptions, "ITFSystem_440", "GetWorldStatus", 1, {}, options, false);
    }
  };
}

function createSteamWebApiContentServerDirectoryServiceFacade(
  clientOptions: SteamWebApiClientOptions
): SteamWebApiContentServerDirectoryServiceFacade {
  return {
    getCdnForVideo<T = unknown>(
      options: SteamWebApiContentServerCdnForVideoOptions
    ): Promise<SteamWebApiResponse<T>> {
      return steamWebApiServiceGet<T>(
        clientOptions,
        "IContentServerDirectoryService",
        "GetCDNForVideo",
        1,
        {
          property_type: options.propertyType,
          client_ip: options.clientIp,
          client_region: options.clientRegion
        },
        options,
        false
      );
    },
    pickSingleContentServer<T = unknown>(
      options: SteamWebApiPickSingleContentServerOptions
    ): Promise<SteamWebApiResponse<T>> {
      return steamWebApiServiceGet<T>(
        clientOptions,
        "IContentServerDirectoryService",
        "PickSingleContentServer",
        1,
        {
          property_type: options.propertyType,
          cell_id: options.cellId,
          client_ip: options.clientIp
        },
        options,
        false
      );
    },
    getServersForSteamPipe<T = unknown>(
      options: SteamWebApiServersForSteamPipeOptions
    ): Promise<SteamWebApiResponse<T>> {
      return steamWebApiServiceGet<T>(
        clientOptions,
        "IContentServerDirectoryService",
        "GetServersForSteamPipe",
        1,
        {
          cell_id: options.cellId,
          max_servers: options.maxServers,
          ip_override: options.ipOverride,
          launcher_type: options.launcherType,
          ipv6_public: options.ipv6Public,
          current_connections: options.currentConnections
        },
        options,
        false
      );
    },
    getClientUpdateHosts<T = unknown>(
      options: SteamWebApiClientUpdateHostsOptions
    ): Promise<SteamWebApiResponse<T>> {
      return steamWebApiServiceGet<T>(
        clientOptions,
        "IContentServerDirectoryService",
        "GetClientUpdateHosts",
        1,
        { cached_signature: options.cachedSignature },
        options,
        false
      );
    },
    getDepotPatchInfo<T = unknown>(options: SteamWebApiDepotPatchInfoOptions): Promise<SteamWebApiResponse<T>> {
      return steamWebApiServiceGet<T>(
        clientOptions,
        "IContentServerDirectoryService",
        "GetDepotPatchInfo",
        1,
        {
          appid: options.appId,
          depotid: options.depotId,
          source_manifestid: options.sourceManifestId,
          target_manifestid: options.targetManifestId
        },
        options,
        false
      );
    }
  };
}

function createSteamWebApiHelpRequestLogsServiceFacade(
  clientOptions: SteamWebApiClientOptions
): SteamWebApiHelpRequestLogsServiceFacade {
  return {
    uploadUserApplicationLog<T = unknown>(
      options: SteamWebApiUploadUserApplicationLogOptions
    ): Promise<SteamWebApiResponse<T>> {
      return steamWebApiServicePost<T>(
        clientOptions,
        "IHelpRequestLogsService",
        "UploadUserApplicationLog",
        1,
        {
          appid: options.appId,
          log_type: options.logType,
          version_string: options.versionString,
          log_contents: options.logContents,
          request_id: options.requestId
        },
        options
      );
    },
    getApplicationLogDemand<T = unknown>(
      options: SteamWebApiApplicationLogDemandOptions
    ): Promise<SteamWebApiResponse<T>> {
      return steamWebApiServicePost<T>(
        clientOptions,
        "IHelpRequestLogsService",
        "GetApplicationLogDemand",
        1,
        { appid: options.appId },
        options
      );
    }
  };
}

function createSteamWebApiSiteLicenseServiceFacade(
  clientOptions: SteamWebApiClientOptions
): SteamWebApiSiteLicenseServiceFacade {
  return {
    getCurrentClientConnections<T = unknown>(
      options?: SteamWebApiSiteLicenseSiteOptions | null
    ): Promise<SteamWebApiResponse<T>> {
      return steamWebApiGet<T>(
        clientOptions,
        "ISiteLicenseService",
        "GetCurrentClientConnections",
        1,
        { siteid: options?.siteId },
        options,
        false
      );
    },
    getTotalPlaytime<T = unknown>(
      options: SteamWebApiSiteLicenseTotalPlaytimeOptions
    ): Promise<SteamWebApiResponse<T>> {
      return steamWebApiGet<T>(
        clientOptions,
        "ISiteLicenseService",
        "GetTotalPlaytime",
        1,
        {
          start_time: options.startTime,
          end_time: options.endTime,
          siteid: options.siteId
        },
        options,
        false
      );
    }
  };
}

function createSteamWebApiRemoteStorageFacade(
  clientOptions: SteamWebApiClientOptions
): SteamWebApiRemoteStorageFacade {
  return {
    enumerateUserSubscribedFiles<T = unknown>(
      options: SteamWebApiRemoteStorageUserAppOptions
    ): Promise<SteamWebApiResponse<T>> {
      return steamWebApiPost<T>(
        clientOptions,
        "ISteamRemoteStorage",
        "EnumerateUserSubscribedFiles",
        1,
        { steamid: options.steamId64, appid: options.appId, listtype: options.listType },
        options
      );
    },
    getCollectionDetails<T = unknown>(
      collectionIds: Array<bigint | number | string>,
      options?: SteamWebApiEndpointOptions | null
    ): Promise<SteamWebApiResponse<T>> {
      const body = indexedParams("publishedfileids", collectionIds);
      body.collectioncount = collectionIds.length;
      return steamWebApiPost<T>(
        clientOptions,
        "ISteamRemoteStorage",
        "GetCollectionDetails",
        1,
        body,
        options,
        false
      );
    },
    getPublishedFileDetails<T = unknown>(
      publishedFileIds: Array<bigint | number | string>,
      options?: SteamWebApiEndpointOptions | null
    ): Promise<SteamWebApiResponse<T>> {
      const body = indexedParams("publishedfileids", publishedFileIds);
      body.itemcount = publishedFileIds.length;
      return steamWebApiPost<T>(
        clientOptions,
        "ISteamRemoteStorage",
        "GetPublishedFileDetails",
        1,
        body,
        options,
        false
      );
    },
    getUgcFileDetails<T = unknown>(options: SteamWebApiUgcFileDetailsOptions): Promise<SteamWebApiResponse<T>> {
      return steamWebApiGet<T>(
        clientOptions,
        "ISteamRemoteStorage",
        "GetUGCFileDetails",
        1,
        { ugcid: options.ugcId, appid: options.appId, steamid: options.steamId64 },
        options,
        false
      );
    },
    setUgcUsedByGc<T = unknown>(options: SteamWebApiSetUgcUsedByGcOptions): Promise<SteamWebApiResponse<T>> {
      return steamWebApiPost<T>(
        clientOptions,
        "ISteamRemoteStorage",
        "SetUGCUsedByGC",
        1,
        { steamid: options.steamId64, ugcid: options.ugcId, appid: options.appId, used: options.used },
        options
      );
    },
    subscribePublishedFile<T = unknown>(
      options: SteamWebApiPublishedFileUserActionOptions
    ): Promise<SteamWebApiResponse<T>> {
      return steamWebApiPost<T>(
        clientOptions,
        "ISteamRemoteStorage",
        "SubscribePublishedFile",
        1,
        { steamid: options.steamId64, appid: options.appId, publishedfileid: options.publishedFileId },
        options
      );
    },
    unsubscribePublishedFile<T = unknown>(
      options: SteamWebApiPublishedFileUserActionOptions
    ): Promise<SteamWebApiResponse<T>> {
      return steamWebApiPost<T>(
        clientOptions,
        "ISteamRemoteStorage",
        "UnsubscribePublishedFile",
        1,
        { steamid: options.steamId64, appid: options.appId, publishedfileid: options.publishedFileId },
        options
      );
    }
  };
}

function createSteamWebApiCloudServiceFacade(clientOptions: SteamWebApiClientOptions): SteamWebApiCloudServiceFacade {
  return {
    enumerateUserFiles<T = unknown>(
      options: SteamWebApiCloudEnumerateUserFilesOptions
    ): Promise<SteamWebApiResponse<T>> {
      return steamWebApiOAuthGet<T>(
        clientOptions,
        "ICloudService",
        "EnumerateUserFiles",
        1,
        {
          access_token: options.accessToken,
          appid: options.appId,
          extended_details: options.extendedDetails,
          count: options.count,
          start_index: options.startIndex
        },
        options
      );
    },
    beginAppUploadBatch<T = unknown>(
      options: SteamWebApiCloudBeginAppUploadBatchOptions
    ): Promise<SteamWebApiResponse<T>> {
      return steamWebApiOAuthServicePost<T>(
        clientOptions,
        "ICloudService",
        "BeginAppUploadBatch",
        1,
        options.accessToken,
        {
          appid: options.appId,
          machine_name: options.machineName,
          files_to_upload: options.filesToUpload,
          files_to_delete: options.filesToDelete
        },
        options
      );
    },
    completeAppUploadBatch<T = unknown>(
      options: SteamWebApiCloudCompleteAppUploadBatchOptions
    ): Promise<SteamWebApiResponse<T>> {
      return steamWebApiOAuthServicePost<T>(
        clientOptions,
        "ICloudService",
        "CompleteAppUploadBatch",
        1,
        options.accessToken,
        { appid: options.appId, batch_id: options.batchId, batch_eresult: options.batchEResult },
        options
      );
    },
    beginHttpUpload<T = unknown>(options: SteamWebApiCloudBeginHttpUploadOptions): Promise<SteamWebApiResponse<T>> {
      return steamWebApiOAuthServicePost<T>(
        clientOptions,
        "ICloudService",
        "BeginHTTPUpload",
        1,
        options.accessToken,
        {
          appid: options.appId,
          file_size: options.fileSize,
          filename: options.fileName,
          file_sha: options.fileSha,
          is_public: options.isPublic,
          platforms_to_sync: options.platformsToSync,
          upload_batch_id: options.uploadBatchId
        },
        options
      );
    },
    commitHttpUpload<T = unknown>(options: SteamWebApiCloudCommitHttpUploadOptions): Promise<SteamWebApiResponse<T>> {
      return steamWebApiOAuthServicePost<T>(
        clientOptions,
        "ICloudService",
        "CommitHTTPUpload",
        1,
        options.accessToken,
        {
          appid: options.appId,
          transfer_succeeded: options.transferSucceeded,
          filename: options.fileName,
          file_sha: options.fileSha
        },
        options
      );
    },
    deleteFile<T = unknown>(options: SteamWebApiCloudDeleteFileOptions): Promise<SteamWebApiResponse<T>> {
      return steamWebApiOAuthServicePost<T>(
        clientOptions,
        "ICloudService",
        "Delete",
        1,
        options.accessToken,
        { appid: options.appId, filename: options.fileName },
        options
      );
    }
  };
}

function createSteamWebApiBroadcastServiceFacade(
  clientOptions: SteamWebApiClientOptions
): SteamWebApiBroadcastServiceFacade {
  return {
    postGameDataFrame<T = unknown>(
      options: SteamWebApiBroadcastPostGameDataFrameOptions
    ): Promise<SteamWebApiResponse<T>> {
      return steamWebApiServicePost<T>(
        clientOptions,
        "IBroadcastService",
        "PostGameDataFrame",
        1,
        {
          appid: options.appId,
          steamid: options.steamId64,
          broadcast_id: options.broadcastId,
          frame_data: options.frameData
        },
        options
      );
    },
    postGameDataFrameRtmp<T = unknown>(
      options: SteamWebApiBroadcastPostGameDataFrameRtmpOptions
    ): Promise<SteamWebApiResponse<T>> {
      return steamWebApiServicePost<T>(
        clientOptions,
        "IBroadcastService",
        "PostGameDataFrameRTMP",
        1,
        {
          appid: options.appId,
          steamid: options.steamId64,
          rtmp_token: options.rtmpToken,
          frame_data: options.frameData
        },
        options
      );
    }
  };
}

function createSteamWebApiClientStats1046930Facade(
  clientOptions: SteamWebApiClientOptions
): SteamWebApiClientStats1046930Facade {
  return {
    reportEvent<T = unknown>(options?: SteamWebApiEndpointOptions | null): Promise<SteamWebApiResponse<T>> {
      return steamWebApiPost<T>(clientOptions, "IClientStats_1046930", "ReportEvent", 1, {}, options, false);
    }
  };
}

function createSteamWebApiCheatReportingServiceFacade(
  clientOptions: SteamWebApiClientOptions
): SteamWebApiCheatReportingServiceFacade {
  return {
    reportPlayerCheating<T = unknown>(
      options: SteamWebApiReportPlayerCheatingOptions
    ): Promise<SteamWebApiResponse<T>> {
      return steamWebApiServicePost<T>(
        clientOptions,
        "ICheatReportingService",
        "ReportPlayerCheating",
        1,
        {
          steamid: options.steamId64,
          appid: options.appId,
          steamidreporter: options.reporterSteamId64,
          appdata: options.appData,
          heuristic: options.heuristic,
          detection: options.detection,
          playerreport: options.playerReport,
          noreportid: options.noReportId,
          gamemode: options.gameMode,
          suspicionstarttime: options.suspicionStartTime,
          severity: options.severity
        },
        options
      );
    },
    requestPlayerGameBan<T = unknown>(
      options: SteamWebApiRequestPlayerGameBanOptions
    ): Promise<SteamWebApiResponse<T>> {
      return steamWebApiServicePost<T>(
        clientOptions,
        "ICheatReportingService",
        "RequestPlayerGameBan",
        1,
        {
          steamid: options.steamId64,
          appid: options.appId,
          reportid: options.reportId,
          cheatdescription: options.cheatDescription,
          duration: options.duration,
          delayban: options.delayBan,
          flags: options.flags
        },
        options
      );
    },
    removePlayerGameBan<T = unknown>(
      options: SteamWebApiCheatReportingPlayerOptions
    ): Promise<SteamWebApiResponse<T>> {
      return steamWebApiServicePost<T>(
        clientOptions,
        "ICheatReportingService",
        "RemovePlayerGameBan",
        1,
        { steamid: options.steamId64, appid: options.appId },
        options
      );
    },
    getCheatingReports<T = unknown>(
      options: SteamWebApiGetCheatingReportsOptions
    ): Promise<SteamWebApiResponse<T>> {
      return steamWebApiServiceGet<T>(
        clientOptions,
        "ICheatReportingService",
        "GetCheatingReports",
        1,
        {
          appid: options.appId,
          timeend: options.timeEnd,
          timebegin: options.timeBegin,
          reportidmin: options.reportIdMin,
          includereports: options.includeReports,
          includebans: options.includeBans,
          steamid: options.steamId64
        },
        options
      );
    },
    requestVacStatusForUser<T = unknown>(
      options: SteamWebApiRequestVacStatusForUserOptions
    ): Promise<SteamWebApiResponse<T>> {
      return steamWebApiServicePost<T>(
        clientOptions,
        "ICheatReportingService",
        "RequestVacStatusForUser",
        1,
        { steamid: options.steamId64, appid: options.appId, session_id: options.sessionId },
        options
      );
    },
    startSecureMultiplayerSession<T = unknown>(
      options: SteamWebApiCheatReportingPlayerOptions
    ): Promise<SteamWebApiResponse<T>> {
      return steamWebApiServicePost<T>(
        clientOptions,
        "ICheatReportingService",
        "StartSecureMultiplayerSession",
        1,
        { steamid: options.steamId64, appid: options.appId },
        options
      );
    },
    endSecureMultiplayerSession<T = unknown>(
      options: SteamWebApiEndSecureMultiplayerSessionOptions
    ): Promise<SteamWebApiResponse<T>> {
      return steamWebApiServicePost<T>(
        clientOptions,
        "ICheatReportingService",
        "EndSecureMultiplayerSession",
        1,
        { steamid: options.steamId64, appid: options.appId, session_id: options.sessionId },
        options
      );
    }
  };
}

function createSteamWebApiEconMarketServiceFacade(
  clientOptions: SteamWebApiClientOptions
): SteamWebApiEconMarketServiceFacade {
  return {
    getMarketEligibility<T = unknown>(
      options: SteamWebApiEconMarketSteamIdOptions
    ): Promise<SteamWebApiResponse<T>> {
      return steamWebApiServiceGet<T>(
        clientOptions,
        "IEconMarketService",
        "GetMarketEligibility",
        1,
        { steamid: options.steamId64 },
        options
      );
    },
    cancelAppListingsForUser<T = unknown>(
      options: SteamWebApiEconMarketCancelAppListingsOptions
    ): Promise<SteamWebApiResponse<T>> {
      return steamWebApiServicePost<T>(
        clientOptions,
        "IEconMarketService",
        "CancelAppListingsForUser",
        1,
        {
          appid: options.appId,
          steamid: options.steamId64,
          synchronous: options.synchronous
        },
        options
      );
    },
    getAssetId<T = unknown>(options: SteamWebApiEconMarketAssetIdOptions): Promise<SteamWebApiResponse<T>> {
      return steamWebApiServiceGet<T>(
        clientOptions,
        "IEconMarketService",
        "GetAssetID",
        1,
        { appid: options.appId, listingid: options.listingId },
        options
      );
    },
    getPopular<T = unknown>(options: SteamWebApiEconMarketPopularOptions): Promise<SteamWebApiResponse<T>> {
      return steamWebApiServiceGet<T>(
        clientOptions,
        "IEconMarketService",
        "GetPopular",
        1,
        {
          language: options.language,
          rows: options.rows,
          start: options.start,
          filter_appid: options.filterAppId,
          ecurrency: options.currency
        },
        options
      );
    }
  };
}

function createSteamWebApiEconomyFacade(clientOptions: SteamWebApiClientOptions): SteamWebApiEconomyFacade {
  return {
    canTrade<T = unknown>(options: SteamWebApiCanTradeOptions): Promise<SteamWebApiResponse<T>> {
      return steamWebApiGet<T>(
        clientOptions,
        "ISteamEconomy",
        "CanTrade",
        1,
        { appid: options.appId, steamid: options.steamId64, targetid: options.targetSteamId64 },
        options
      );
    },
    finalizeAssetTransaction<T = unknown>(
      options: SteamWebApiFinalizeAssetTransactionOptions
    ): Promise<SteamWebApiResponse<T>> {
      return steamWebApiPost<T>(
        clientOptions,
        "ISteamEconomy",
        "FinalizeAssetTransaction",
        1,
        {
          appid: options.appId,
          steamid: options.steamId64,
          txnid: options.transactionId,
          language: options.language
        },
        options
      );
    },
    getAssetClassInfo<T = unknown>(options: SteamWebApiAssetClassInfoOptions): Promise<SteamWebApiResponse<T>> {
      const params = numberedParams(
        "classid",
        options.classes.map((assetClass) => assetClass.classId)
      );
      Object.assign(
        params,
        numberedParams(
          "instanceid",
          options.classes.map((assetClass) => assetClass.instanceId)
        )
      );
      params.appid = options.appId;
      params.class_count = options.classes.length;
      params.language = options.language;
      return steamWebApiGet<T>(clientOptions, "ISteamEconomy", "GetAssetClassInfo", 1, params, options, false);
    },
    getAssetPrices<T = unknown>(options: SteamWebApiAssetPricesOptions): Promise<SteamWebApiResponse<T>> {
      return steamWebApiGet<T>(
        clientOptions,
        "ISteamEconomy",
        "GetAssetPrices",
        1,
        { appid: options.appId, currency: options.currency, language: options.language },
        options,
        false
      );
    },
    getExportedAssetsForUser<T = unknown>(
      options: SteamWebApiExportedAssetsForUserOptions
    ): Promise<SteamWebApiResponse<T>> {
      return steamWebApiGet<T>(
        clientOptions,
        "ISteamEconomy",
        "GetExportedAssetsForUser",
        1,
        { steamid: options.steamId64, appid: options.appId, contextid: options.contextId },
        options
      );
    },
    getMarketPrices<T = unknown>(
      appId: number,
      options?: SteamWebApiEndpointOptions | null
    ): Promise<SteamWebApiResponse<T>> {
      return steamWebApiGet<T>(clientOptions, "ISteamEconomy", "GetMarketPrices", 1, { appid: appId }, options);
    },
    startAssetTransaction<T = unknown>(
      options: SteamWebApiStartAssetTransactionOptions
    ): Promise<SteamWebApiResponse<T>> {
      const body = numberedParams(
        "assetid",
        options.assets.map((asset) => asset.assetId)
      );
      Object.assign(
        body,
        numberedParams(
          "assetquantity",
          options.assets.map((asset) => asset.quantity)
        )
      );
      body.appid = options.appId;
      body.steamid = options.steamId64;
      body.currency = options.currency;
      body.language = options.language;
      body.ipaddress = options.ipAddress;
      body.referrer = options.referrer;
      body.clientauth = options.clientAuth;
      return steamWebApiPost<T>(clientOptions, "ISteamEconomy", "StartAssetTransaction", 1, body, options);
    },
    startTrade<T = unknown>(options: SteamWebApiStartTradeOptions): Promise<SteamWebApiResponse<T>> {
      return steamWebApiGet<T>(
        clientOptions,
        "ISteamEconomy",
        "StartTrade",
        1,
        { appid: options.appId, partya: options.partyA, partyb: options.partyB },
        options
      );
    }
  };
}

function createSteamWebApiEconServiceFacade(clientOptions: SteamWebApiClientOptions): SteamWebApiEconServiceFacade {
  return {
    getTradeHistory<T = unknown>(options: SteamWebApiTradeHistoryOptions): Promise<SteamWebApiResponse<T>> {
      return steamWebApiServiceGet<T>(
        clientOptions,
        "IEconService",
        "GetTradeHistory",
        1,
        {
          max_trades: options.maxTrades,
          start_after_time: options.startAfterTime,
          start_after_tradeid: options.startAfterTradeId,
          navigating_back: options.navigatingBack,
          get_descriptions: options.getDescriptions,
          language: options.language,
          include_failed: options.includeFailed,
          include_total: options.includeTotal
        },
        options,
        false
      );
    },
    flushInventoryCache<T = unknown>(
      options: SteamWebApiFlushInventoryCacheOptions
    ): Promise<SteamWebApiResponse<T>> {
      return steamWebApiServicePost<T>(
        clientOptions,
        "IEconService",
        "FlushInventoryCache",
        1,
        {
          steamid: options.steamId64,
          appid: options.appId,
          contextid: options.contextId
        },
        options
      );
    },
    flushAssetAppearanceCache<T = unknown>(
      appId: number,
      options?: SteamWebApiEndpointOptions | null
    ): Promise<SteamWebApiResponse<T>> {
      return steamWebApiServicePost<T>(
        clientOptions,
        "IEconService",
        "FlushAssetAppearanceCache",
        1,
        { appid: appId },
        options
      );
    },
    flushContextCache<T = unknown>(
      appId: number,
      options?: SteamWebApiEndpointOptions | null
    ): Promise<SteamWebApiResponse<T>> {
      return steamWebApiServicePost<T>(
        clientOptions,
        "IEconService",
        "FlushContextCache",
        1,
        { appid: appId },
        options
      );
    },
    getTradeOffers<T = unknown>(options: SteamWebApiTradeOffersOptions): Promise<SteamWebApiResponse<T>> {
      return steamWebApiServiceGet<T>(
        clientOptions,
        "IEconService",
        "GetTradeOffers",
        1,
        {
          get_sent_offers: options.getSentOffers,
          get_received_offers: options.getReceivedOffers,
          get_descriptions: options.getDescriptions,
          language: options.language,
          active_only: options.activeOnly,
          historical_only: options.historicalOnly,
          time_historical_cutoff: options.timeHistoricalCutoff
        },
        options,
        false
      );
    },
    getTradeOffer<T = unknown>(options: SteamWebApiTradeOfferOptions): Promise<SteamWebApiResponse<T>> {
      return steamWebApiServiceGet<T>(
        clientOptions,
        "IEconService",
        "GetTradeOffer",
        1,
        { tradeofferid: options.tradeOfferId, language: options.language },
        options,
        false
      );
    },
    getTradeOffersSummary<T = unknown>(
      options?: SteamWebApiTradeOffersSummaryOptions | null
    ): Promise<SteamWebApiResponse<T>> {
      return steamWebApiServiceGet<T>(
        clientOptions,
        "IEconService",
        "GetTradeOffersSummary",
        1,
        { time_last_visit: options?.timeLastVisit },
        options,
        false
      );
    }
  };
}

function createSteamWebApiGameInventoryFacade(
  clientOptions: SteamWebApiClientOptions
): SteamWebApiGameInventoryFacade {
  return {
    getHistoryCommandDetails<T = unknown>(
      options: SteamWebApiGameInventoryHistoryCommandOptions
    ): Promise<SteamWebApiResponse<T>> {
      return steamWebApiGet<T>(
        clientOptions,
        "IGameInventory",
        "GetHistoryCommandDetails",
        1,
        {
          appid: options.appId,
          steamid: options.steamId64,
          command: options.command,
          contextid: options.contextId,
          arguments: options.commandArguments
        },
        options
      );
    },
    getUserHistory<T = unknown>(
      options: SteamWebApiGameInventoryUserHistoryOptions
    ): Promise<SteamWebApiResponse<T>> {
      return steamWebApiGet<T>(
        clientOptions,
        "IGameInventory",
        "GetUserHistory",
        1,
        {
          appid: options.appId,
          steamid: options.steamId64,
          contextid: options.contextId,
          starttime: options.startTime,
          endtime: options.endTime
        },
        options
      );
    },
    historyExecuteCommands<T = unknown>(
      options: SteamWebApiGameInventoryExecuteCommandsOptions
    ): Promise<SteamWebApiResponse<T>> {
      return steamWebApiPost<T>(
        clientOptions,
        "IGameInventory",
        "HistoryExecuteCommands",
        1,
        {
          appid: options.appId,
          steamid: options.steamId64,
          contextid: options.contextId,
          actorid: options.actorId
        },
        options
      );
    },
    supportGetAssetHistory<T = unknown>(
      options: SteamWebApiGameInventoryAssetHistoryOptions
    ): Promise<SteamWebApiResponse<T>> {
      return steamWebApiGet<T>(
        clientOptions,
        "IGameInventory",
        "SupportGetAssetHistory",
        1,
        { appid: options.appId, assetid: options.assetId, contextid: options.contextId },
        options
      );
    },
    updateItemDefs<T = unknown>(
      options: SteamWebApiGameInventoryUpdateItemDefsOptions
    ): Promise<SteamWebApiResponse<T>> {
      return steamWebApiPost<T>(
        clientOptions,
        "IGameInventory",
        "UpdateItemDefs",
        1,
        { appid: options.appId, itemdefs: steamWebApiInputJsonValue(options.itemDefs) },
        options
      );
    }
  };
}

function createSteamWebApiGameCoordinatorVersionFacade(
  clientOptions: SteamWebApiClientOptions
): SteamWebApiGameCoordinatorVersionFacade {
  return {
    app1046930: {
      getClientVersion<T = unknown>(
        options?: SteamWebApiEndpointOptions | null
      ): Promise<SteamWebApiResponse<T>> {
        return steamWebApiGet<T>(clientOptions, "IGCVersion_1046930", "GetClientVersion", 1, {}, options, false);
      },
      getServerVersion<T = unknown>(
        options?: SteamWebApiEndpointOptions | null
      ): Promise<SteamWebApiResponse<T>> {
        return steamWebApiGet<T>(clientOptions, "IGCVersion_1046930", "GetServerVersion", 1, {}, options, false);
      }
    },
    app1269260: {
      getClientVersion<T = unknown>(
        options?: SteamWebApiEndpointOptions | null
      ): Promise<SteamWebApiResponse<T>> {
        return steamWebApiGet<T>(clientOptions, "IGCVersion_1269260", "GetClientVersion", 1, {}, options, false);
      },
      getServerVersion<T = unknown>(
        options?: SteamWebApiEndpointOptions | null
      ): Promise<SteamWebApiResponse<T>> {
        return steamWebApiGet<T>(clientOptions, "IGCVersion_1269260", "GetServerVersion", 1, {}, options, false);
      }
    },
    app1422450: {
      getClientVersion<T = unknown>(
        options?: SteamWebApiEndpointOptions | null
      ): Promise<SteamWebApiResponse<T>> {
        return steamWebApiGet<T>(clientOptions, "IGCVersion_1422450", "GetClientVersion", 1, {}, options, false);
      },
      getServerVersion<T = unknown>(
        options?: SteamWebApiEndpointOptions | null
      ): Promise<SteamWebApiResponse<T>> {
        return steamWebApiGet<T>(clientOptions, "IGCVersion_1422450", "GetServerVersion", 1, {}, options, false);
      }
    },
    teamFortress2: {
      getClientVersion<T = unknown>(
        options?: SteamWebApiEndpointOptions | null
      ): Promise<SteamWebApiResponse<T>> {
        return steamWebApiGet<T>(clientOptions, "IGCVersion_440", "GetClientVersion", 1, {}, options, false);
      },
      getServerVersion<T = unknown>(
        options?: SteamWebApiEndpointOptions | null
      ): Promise<SteamWebApiResponse<T>> {
        return steamWebApiGet<T>(clientOptions, "IGCVersion_440", "GetServerVersion", 1, {}, options, false);
      }
    },
    dota2: {
      getClientVersion<T = unknown>(
        options?: SteamWebApiEndpointOptions | null
      ): Promise<SteamWebApiResponse<T>> {
        return steamWebApiGet<T>(clientOptions, "IGCVersion_570", "GetClientVersion", 1, {}, options, false);
      },
      getServerVersion<T = unknown>(
        options?: SteamWebApiEndpointOptions | null
      ): Promise<SteamWebApiResponse<T>> {
        return steamWebApiGet<T>(clientOptions, "IGCVersion_570", "GetServerVersion", 1, {}, options, false);
      }
    },
    app583950: {
      getClientVersion<T = unknown>(
        options?: SteamWebApiEndpointOptions | null
      ): Promise<SteamWebApiResponse<T>> {
        return steamWebApiGet<T>(clientOptions, "IGCVersion_583950", "GetClientVersion", 1, {}, options, false);
      },
      getServerVersion<T = unknown>(
        options?: SteamWebApiEndpointOptions | null
      ): Promise<SteamWebApiResponse<T>> {
        return steamWebApiGet<T>(clientOptions, "IGCVersion_583950", "GetServerVersion", 1, {}, options, false);
      }
    },
    counterStrike2: {
      getServerVersion<T = unknown>(
        options?: SteamWebApiEndpointOptions | null
      ): Promise<SteamWebApiResponse<T>> {
        return steamWebApiGet<T>(clientOptions, "IGCVersion_730", "GetServerVersion", 1, {}, options, false);
      }
    }
  };
}

function createSteamWebApiInventoryServiceFacade(
  clientOptions: SteamWebApiClientOptions
): SteamWebApiInventoryServiceFacade {
  return {
    addItem<T = unknown>(options: SteamWebApiInventoryAddItemOptions): Promise<SteamWebApiResponse<T>> {
      return steamWebApiServicePost<T>(
        clientOptions,
        "IInventoryService",
        "AddItem",
        1,
        {
          appid: options.appId,
          itemdefid: options.itemDefIds,
          itempropsjson: options.itemPropsJson,
          steamid: options.steamId64,
          notify: options.notify,
          requestid: options.requestId,
          trade_restriction: options.tradeRestriction
        },
        options
      );
    },
    addPromoItem<T = unknown>(options: SteamWebApiInventoryAddPromoItemOptions): Promise<SteamWebApiResponse<T>> {
      return steamWebApiServicePost<T>(
        clientOptions,
        "IInventoryService",
        "AddPromoItem",
        1,
        {
          appid: options.appId,
          itemdefid: options.itemDefId,
          steamid: options.steamId64,
          notify: options.notify,
          requestid: options.requestId
        },
        options
      );
    },
    consumeItem<T = unknown>(options: SteamWebApiInventoryConsumeItemOptions): Promise<SteamWebApiResponse<T>> {
      return steamWebApiServicePost<T>(
        clientOptions,
        "IInventoryService",
        "ConsumeItem",
        1,
        {
          appid: options.appId,
          itemid: options.itemId,
          quantity: options.quantity,
          steamid: options.steamId64,
          requestid: options.requestId
        },
        options
      );
    },
    exchangeItem<T = unknown>(options: SteamWebApiInventoryExchangeItemOptions): Promise<SteamWebApiResponse<T>> {
      return steamWebApiServicePost<T>(
        clientOptions,
        "IInventoryService",
        "ExchangeItem",
        1,
        {
          appid: options.appId,
          steamid: options.steamId64,
          materialsitemid: options.materials.map((material) => material.itemId),
          materialsquantity: options.materials.map((material) => material.quantity),
          outputitemdefid: options.outputItemDefId
        },
        options
      );
    },
    getInventory<T = unknown>(options: SteamWebApiInventoryUserAppOptions): Promise<SteamWebApiResponse<T>> {
      return steamWebApiServiceGet<T>(
        clientOptions,
        "IInventoryService",
        "GetInventory",
        1,
        { appid: options.appId, steamid: options.steamId64 },
        options
      );
    },
    getItemDefs<T = unknown>(options: SteamWebApiInventoryItemDefsOptions): Promise<SteamWebApiResponse<T>> {
      return steamWebApiServiceGet<T>(
        clientOptions,
        "IInventoryService",
        "GetItemDefs",
        1,
        {
          appid: options.appId,
          modifiedsince: options.modifiedSince,
          itemdefids: options.itemDefIds,
          workshopids: options.workshopIds,
          cache_max_age_seconds: options.cacheMaxAgeSeconds
        },
        options
      );
    },
    getPriceSheet<T = unknown>(
      currency: number,
      options?: SteamWebApiEndpointOptions | null
    ): Promise<SteamWebApiResponse<T>> {
      return steamWebApiServiceGet<T>(
        clientOptions,
        "IInventoryService",
        "GetPriceSheet",
        1,
        { ecurrency: currency },
        options,
        false
      );
    },
    consolidate<T = unknown>(options: SteamWebApiInventoryConsolidateOptions): Promise<SteamWebApiResponse<T>> {
      return steamWebApiServicePost<T>(
        clientOptions,
        "IInventoryService",
        "Consolidate",
        1,
        {
          appid: options.appId,
          steamid: options.steamId64,
          itemdefid: options.itemDefIds,
          force: options.force
        },
        options
      );
    },
    getQuantity<T = unknown>(options: SteamWebApiInventoryQuantityOptions): Promise<SteamWebApiResponse<T>> {
      return steamWebApiServiceGet<T>(
        clientOptions,
        "IInventoryService",
        "GetQuantity",
        1,
        {
          appid: options.appId,
          steamid: options.steamId64,
          itemdefid: options.itemDefIds,
          force: options.force
        },
        options
      );
    },
    modifyItems<T = unknown>(options: SteamWebApiInventoryModifyItemsOptions): Promise<SteamWebApiResponse<T>> {
      return steamWebApiServicePost<T>(
        clientOptions,
        "IInventoryService",
        "ModifyItems",
        1,
        {
          appid: options.appId,
          steamid: options.steamId64,
          timestamp: options.timestamp,
          updates: options.updates.map((update) => ({
            itemid: update.itemId,
            property_name: update.propertyName,
            property_value_string: update.propertyValueString,
            property_value_bool: update.propertyValueBool,
            property_value_int: update.propertyValueInt,
            property_value_float: update.propertyValueFloat,
            remove_property: update.removeProperty
          }))
        },
        options
      );
    }
  };
}

function createSteamWebApiGameNotificationsServiceFacade(
  clientOptions: SteamWebApiClientOptions
): SteamWebApiGameNotificationsServiceFacade {
  return {
    createSession<T = unknown>(
      options: SteamWebApiGameNotificationsCreateSessionOptions
    ): Promise<SteamWebApiResponse<T>> {
      return steamWebApiServicePost<T>(
        clientOptions,
        "IGameNotificationsService",
        "CreateSession",
        1,
        {
          appid: options.appId,
          context: options.context,
          title: steamWebApiGameNotificationsLocalizedText(options.title),
          users: options.users.map(steamWebApiGameNotificationsUserState),
          steamid: options.steamId64
        },
        options
      );
    },
    userCreateSession<T = unknown>(
      options: SteamWebApiGameNotificationsCreateSessionOptions
    ): Promise<SteamWebApiResponse<T>> {
      return steamWebApiServicePost<T>(
        clientOptions,
        "IGameNotificationsService",
        "UserCreateSession",
        1,
        {
          appid: options.appId,
          context: options.context,
          title: steamWebApiGameNotificationsLocalizedText(options.title),
          users: options.users.map(steamWebApiGameNotificationsUserState),
          steamid: options.steamId64
        },
        options
      );
    },
    updateSession<T = unknown>(
      options: SteamWebApiGameNotificationsUpdateSessionOptions
    ): Promise<SteamWebApiResponse<T>> {
      return steamWebApiServicePost<T>(
        clientOptions,
        "IGameNotificationsService",
        "UpdateSession",
        1,
        {
          sessionid: options.sessionId,
          appid: options.appId,
          title: steamWebApiGameNotificationsLocalizedText(options.title),
          users: options.users?.map(steamWebApiGameNotificationsUserState),
          steamid: options.steamId64
        },
        options
      );
    },
    userUpdateSession<T = unknown>(
      options: SteamWebApiGameNotificationsUpdateSessionOptions
    ): Promise<SteamWebApiResponse<T>> {
      return steamWebApiServicePost<T>(
        clientOptions,
        "IGameNotificationsService",
        "UserUpdateSession",
        1,
        {
          sessionid: options.sessionId,
          appid: options.appId,
          title: steamWebApiGameNotificationsLocalizedText(options.title),
          users: options.users?.map(steamWebApiGameNotificationsUserState),
          steamid: options.steamId64
        },
        options
      );
    },
    enumerateSessionsForApp<T = unknown>(
      options: SteamWebApiGameNotificationsEnumerateSessionsOptions
    ): Promise<SteamWebApiResponse<T>> {
      return steamWebApiServiceGet<T>(
        clientOptions,
        "IGameNotificationsService",
        "EnumerateSessionsForApp",
        1,
        {
          appid: options.appId,
          steamid: options.steamId64,
          include_all_user_messages: options.includeAllUserMessages,
          include_auth_user_message: options.includeAuthUserMessage,
          language: options.language
        },
        options
      );
    },
    getSessionDetailsForApp<T = unknown>(
      options: SteamWebApiGameNotificationsSessionDetailsOptions
    ): Promise<SteamWebApiResponse<T>> {
      return steamWebApiServiceGet<T>(
        clientOptions,
        "IGameNotificationsService",
        "GetSessionDetailsForApp",
        1,
        {
          appid: options.appId,
          sessions: options.sessions.map(steamWebApiGameNotificationsSessionDetailsRequest),
          language: options.language
        },
        options
      );
    },
    requestNotifications<T = unknown>(
      options: SteamWebApiGameNotificationsUserAppOptions
    ): Promise<SteamWebApiResponse<T>> {
      return steamWebApiServicePost<T>(
        clientOptions,
        "IGameNotificationsService",
        "RequestNotifications",
        1,
        { steamid: options.steamId64, appid: options.appId },
        options
      );
    },
    deleteSession<T = unknown>(
      options: SteamWebApiGameNotificationsDeleteSessionOptions
    ): Promise<SteamWebApiResponse<T>> {
      return steamWebApiServicePost<T>(
        clientOptions,
        "IGameNotificationsService",
        "DeleteSession",
        1,
        { sessionid: options.sessionId, appid: options.appId, steamid: options.steamId64 },
        options
      );
    },
    userDeleteSession<T = unknown>(
      options: SteamWebApiGameNotificationsDeleteSessionOptions
    ): Promise<SteamWebApiResponse<T>> {
      return steamWebApiServicePost<T>(
        clientOptions,
        "IGameNotificationsService",
        "UserDeleteSession",
        1,
        { sessionid: options.sessionId, appid: options.appId, steamid: options.steamId64 },
        options
      );
    },
    deleteSessionBatch<T = unknown>(
      options: SteamWebApiGameNotificationsDeleteSessionBatchOptions
    ): Promise<SteamWebApiResponse<T>> {
      return steamWebApiServicePost<T>(
        clientOptions,
        "IGameNotificationsService",
        "DeleteSessionBatch",
        1,
        { sessionid: options.sessionIds, appid: options.appId },
        options
      );
    }
  };
}

function createSteamWebApiGameServersServiceFacade(
  clientOptions: SteamWebApiClientOptions
): SteamWebApiGameServersServiceFacade {
  return {
    getAccountList<T = unknown>(
      options?: SteamWebApiEndpointOptions | null
    ): Promise<SteamWebApiResponse<T>> {
      return steamWebApiServiceGet<T>(
        clientOptions,
        "IGameServersService",
        "GetAccountList",
        1,
        {},
        options,
        false
      );
    },
    createAccount<T = unknown>(
      options: SteamWebApiGameServersCreateAccountOptions
    ): Promise<SteamWebApiResponse<T>> {
      return steamWebApiServicePost<T>(
        clientOptions,
        "IGameServersService",
        "CreateAccount",
        1,
        { appid: options.appId, memo: options.memo },
        options,
        false
      );
    },
    setMemo<T = unknown>(options: SteamWebApiGameServersSetMemoOptions): Promise<SteamWebApiResponse<T>> {
      return steamWebApiServicePost<T>(
        clientOptions,
        "IGameServersService",
        "SetMemo",
        1,
        { steamid: options.steamId64, memo: options.memo },
        options,
        false
      );
    },
    resetLoginToken<T = unknown>(
      options: SteamWebApiGameServersSteamIdOptions
    ): Promise<SteamWebApiResponse<T>> {
      return steamWebApiServicePost<T>(
        clientOptions,
        "IGameServersService",
        "ResetLoginToken",
        1,
        { steamid: options.steamId64 },
        options,
        false
      );
    },
    deleteAccount<T = unknown>(
      options: SteamWebApiGameServersSteamIdOptions
    ): Promise<SteamWebApiResponse<T>> {
      return steamWebApiServicePost<T>(
        clientOptions,
        "IGameServersService",
        "DeleteAccount",
        1,
        { steamid: options.steamId64 },
        options,
        false
      );
    },
    getAccountPublicInfo<T = unknown>(
      steamId64: bigint | number | string,
      options?: SteamWebApiEndpointOptions | null
    ): Promise<SteamWebApiResponse<T>> {
      return steamWebApiServiceGet<T>(
        clientOptions,
        "IGameServersService",
        "GetAccountPublicInfo",
        1,
        { steamid: steamId64 },
        options,
        false
      );
    },
    queryLoginToken<T = unknown>(
      loginToken: string,
      options?: SteamWebApiEndpointOptions | null
    ): Promise<SteamWebApiResponse<T>> {
      return steamWebApiServiceGet<T>(
        clientOptions,
        "IGameServersService",
        "QueryLoginToken",
        1,
        { login_token: loginToken },
        options,
        false
      );
    },
    getServerSteamIdsByIp<T = unknown>(
      serverIps: string | string[],
      options?: SteamWebApiEndpointOptions | null
    ): Promise<SteamWebApiResponse<T>> {
      return steamWebApiServiceGet<T>(
        clientOptions,
        "IGameServersService",
        "GetServerSteamIDsByIP",
        1,
        { server_ips: commaString(serverIps) },
        options,
        false
      );
    },
    getServerIpsBySteamId<T = unknown>(
      serverSteamIds: Array<bigint | number | string>,
      options?: SteamWebApiEndpointOptions | null
    ): Promise<SteamWebApiResponse<T>> {
      return steamWebApiServiceGet<T>(
        clientOptions,
        "IGameServersService",
        "GetServerIPsBySteamID",
        1,
        { server_steamids: commaList(serverSteamIds) },
        options,
        false
      );
    }
  };
}

function createSteamWebApiGameServerStatsFacade(
  clientOptions: SteamWebApiClientOptions
): SteamWebApiGameServerStatsFacade {
  return {
    getGameServerPlayerStatsForGame<T = unknown>(
      options: SteamWebApiGameServerPlayerStatsForGameOptions
    ): Promise<SteamWebApiResponse<T>> {
      return steamWebApiGet<T>(
        clientOptions,
        "ISteamGameServerStats",
        "GetGameServerPlayerStatsForGame",
        1,
        {
          gameid: options.gameId,
          appid: options.appId,
          rangestart: options.rangeStart,
          rangeend: options.rangeEnd,
          maxresults: options.maxResults
        },
        options
      );
    }
  };
}

function createSteamWebApiLeaderboardsFacade(clientOptions: SteamWebApiClientOptions): SteamWebApiLeaderboardsFacade {
  return {
    deleteLeaderboard<T = unknown>(options: SteamWebApiDeleteLeaderboardOptions): Promise<SteamWebApiResponse<T>> {
      return steamWebApiPost<T>(
        clientOptions,
        "ISteamLeaderboards",
        "DeleteLeaderboard",
        1,
        { appid: options.appId, name: options.name },
        options
      );
    },
    deleteLeaderboardScore<T = unknown>(
      options: SteamWebApiLeaderboardSteamIdOptions
    ): Promise<SteamWebApiResponse<T>> {
      return steamWebApiPost<T>(
        clientOptions,
        "ISteamLeaderboards",
        "DeleteLeaderboardScore",
        1,
        { appid: options.appId, leaderboardid: options.leaderboardId, steamid: options.steamId64 },
        options
      );
    },
    findOrCreateLeaderboard<T = unknown>(
      options: SteamWebApiFindOrCreateLeaderboardOptions
    ): Promise<SteamWebApiResponse<T>> {
      return steamWebApiPost<T>(
        clientOptions,
        "ISteamLeaderboards",
        "FindOrCreateLeaderboard",
        2,
        {
          appid: options.appId,
          name: options.name,
          sortmethod: options.sortMethod,
          displaytype: options.displayType,
          createifnotfound: options.createIfNotFound,
          onlytrustedwrites: options.onlyTrustedWrites,
          onlyfriendsreads: options.onlyFriendsReads
        },
        options
      );
    },
    getLeaderboardEntries<T = unknown>(
      options: SteamWebApiLeaderboardEntriesOptions
    ): Promise<SteamWebApiResponse<T>> {
      return steamWebApiGet<T>(
        clientOptions,
        "ISteamLeaderboards",
        "GetLeaderboardEntries",
        1,
        {
          appid: options.appId,
          rangestart: options.rangeStart,
          rangeend: options.rangeEnd,
          steamid: options.steamId64,
          leaderboardid: options.leaderboardId,
          datarequest: options.dataRequest
        },
        options
      );
    },
    getLeaderboardsForGame<T = unknown>(
      appId: number,
      options?: SteamWebApiEndpointOptions | null
    ): Promise<SteamWebApiResponse<T>> {
      return steamWebApiGet<T>(clientOptions, "ISteamLeaderboards", "GetLeaderboardsForGame", 2, { appid: appId }, options);
    },
    resetLeaderboard<T = unknown>(options: SteamWebApiLeaderboardIdOptions): Promise<SteamWebApiResponse<T>> {
      return steamWebApiPost<T>(
        clientOptions,
        "ISteamLeaderboards",
        "ResetLeaderboard",
        1,
        { appid: options.appId, leaderboardid: options.leaderboardId },
        options
      );
    },
    setLeaderboardScore<T = unknown>(
      options: SteamWebApiSetLeaderboardScoreOptions
    ): Promise<SteamWebApiResponse<T>> {
      return steamWebApiPost<T>(
        clientOptions,
        "ISteamLeaderboards",
        "SetLeaderboardScore",
        1,
        {
          appid: options.appId,
          leaderboardid: options.leaderboardId,
          steamid: options.steamId64,
          score: options.score,
          scoremethod: options.scoreMethod,
          details: options.details === undefined ? undefined : steamWebApiBinaryString(options.details)
        },
        options
      );
    }
  };
}

function createSteamWebApiPortal2LeaderboardsFacade(
  clientOptions: SteamWebApiClientOptions
): SteamWebApiPortal2LeaderboardsFacade {
  return {
    getBucketizedData<T = unknown>(
      leaderboardName: string,
      options?: SteamWebApiEndpointOptions | null
    ): Promise<SteamWebApiResponse<T>> {
      return steamWebApiGet<T>(
        clientOptions,
        "IPortal2Leaderboards_620",
        "GetBucketizedData",
        1,
        { leaderboardName },
        options,
        false
      );
    }
  };
}

function createSteamWebApiPublishedFileServiceFacade(
  clientOptions: SteamWebApiClientOptions
): SteamWebApiPublishedFileServiceFacade {
  return {
    deleteFile<T = unknown>(options: SteamWebApiPublishedFileAppOptions): Promise<SteamWebApiResponse<T>> {
      return steamWebApiServiceGet<T>(
        clientOptions,
        "IPublishedFileService",
        "Delete",
        1,
        { publishedfileid: options.publishedFileId, appid: options.appId },
        options,
        false
      );
    },
    queryFiles<T = unknown>(options: SteamWebApiPublishedFileQueryOptions): Promise<SteamWebApiResponse<T>> {
      return steamWebApiServiceGet<T>(
        clientOptions,
        "IPublishedFileService",
        "QueryFiles",
        1,
        {
          query_type: options.queryType,
          page: options.page,
          cursor: options.cursor,
          numperpage: options.numPerPage,
          creator_appid: options.creatorAppId,
          appid: options.appId,
          requiredtags: options.requiredTags,
          excludedtags: options.excludedTags,
          match_all_tags: options.matchAllTags,
          required_flags: options.requiredFlags,
          omitted_flags: options.omittedFlags,
          search_text: options.searchText,
          filetype: options.fileType,
          child_publishedfileid: options.childPublishedFileId,
          days: options.days,
          include_recent_votes_only: options.includeRecentVotesOnly,
          cache_max_age_seconds: options.cacheMaxAgeSeconds,
          language: options.language,
          required_kv_tags: steamWebApiKeyValueTags(options.requiredKeyValueTags),
          totalonly: options.totalOnly,
          ids_only: options.idsOnly,
          return_vote_data: options.returnVoteData,
          return_tags: options.returnTags,
          return_kv_tags: options.returnKeyValueTags,
          return_previews: options.returnPreviews,
          return_children: options.returnChildren,
          return_short_description: options.returnShortDescription,
          return_for_sale_data: options.returnForSaleData,
          return_metadata: options.returnMetadata,
          return_playtime_stats: options.returnPlaytimeStats
        },
        options,
        false
      );
    },
    getUserVoteSummary<T = unknown>(
      options: SteamWebApiPublishedFileUserVoteSummaryOptions
    ): Promise<SteamWebApiResponse<T>> {
      return steamWebApiServiceGet<T>(
        clientOptions,
        "IPublishedFileService",
        "GetUserVoteSummary",
        1,
        { publishedfileids: options.publishedFileIds },
        options,
        false
      );
    },
    setDeveloperMetadata<T = unknown>(
      options: SteamWebApiPublishedFileDeveloperMetadataOptions
    ): Promise<SteamWebApiResponse<T>> {
      return steamWebApiServicePost<T>(
        clientOptions,
        "IPublishedFileService",
        "SetDeveloperMetadata",
        1,
        { publishedfileid: options.publishedFileId, appid: options.appId, metadata: options.metadata },
        options
      );
    },
    updateAppUgcBan<T = unknown>(
      options: SteamWebApiPublishedFileAppUgcBanOptions
    ): Promise<SteamWebApiResponse<T>> {
      return steamWebApiServicePost<T>(
        clientOptions,
        "IPublishedFileService",
        "UpdateAppUGCBan",
        1,
        {
          steamid: options.steamId64,
          appid: options.appId,
          expiration_time: options.expirationTime,
          reason: options.reason
        },
        options
      );
    },
    updateBanStatus<T = unknown>(
      options: SteamWebApiPublishedFileBanStatusOptions
    ): Promise<SteamWebApiResponse<T>> {
      return steamWebApiServicePost<T>(
        clientOptions,
        "IPublishedFileService",
        "UpdateBanStatus",
        1,
        {
          publishedfileid: options.publishedFileId,
          appid: options.appId,
          banned: options.banned,
          reason: options.reason
        },
        options
      );
    },
    updateIncompatibleStatus<T = unknown>(
      options: SteamWebApiPublishedFileIncompatibleStatusOptions
    ): Promise<SteamWebApiResponse<T>> {
      return steamWebApiServicePost<T>(
        clientOptions,
        "IPublishedFileService",
        "UpdateIncompatibleStatus",
        1,
        {
          publishedfileid: options.publishedFileId,
          appid: options.appId,
          incompatible: options.incompatible
        },
        options
      );
    },
    updateTags<T = unknown>(options: SteamWebApiPublishedFileTagsOptions): Promise<SteamWebApiResponse<T>> {
      return steamWebApiServicePost<T>(
        clientOptions,
        "IPublishedFileService",
        "UpdateTags",
        1,
        {
          publishedfileid: options.publishedFileId,
          appid: options.appId,
          add_tags: options.addTags,
          remove_tags: options.removeTags
        },
        options
      );
    }
  };
}

function createSteamWebApiPublishedItemSearchFacade(
  clientOptions: SteamWebApiClientOptions
): SteamWebApiPublishedItemSearchFacade {
  return {
    rankedByPublicationOrder<T = unknown>(
      options: SteamWebApiPublishedItemSearchOptions
    ): Promise<SteamWebApiResponse<T>> {
      return steamWebApiPost<T>(
        clientOptions,
        "ISteamPublishedItemSearch",
        "RankedByPublicationOrder",
        1,
        steamWebApiPublishedItemSearchBody(options, true),
        options
      );
    },
    rankedByTrend<T = unknown>(
      options: SteamWebApiPublishedItemSearchTrendOptions
    ): Promise<SteamWebApiResponse<T>> {
      const body = steamWebApiPublishedItemSearchBody(options, true);
      body.days = options.days;
      return steamWebApiPost<T>(clientOptions, "ISteamPublishedItemSearch", "RankedByTrend", 1, body, options);
    },
    rankedByVote<T = unknown>(options: SteamWebApiPublishedItemSearchOptions): Promise<SteamWebApiResponse<T>> {
      return steamWebApiPost<T>(
        clientOptions,
        "ISteamPublishedItemSearch",
        "RankedByVote",
        1,
        steamWebApiPublishedItemSearchBody(options, true),
        options
      );
    },
    resultSetSummary<T = unknown>(
      options: SteamWebApiPublishedItemSearchSummaryOptions
    ): Promise<SteamWebApiResponse<T>> {
      return steamWebApiPost<T>(
        clientOptions,
        "ISteamPublishedItemSearch",
        "ResultSetSummary",
        1,
        steamWebApiPublishedItemSearchBody(options, false),
        options
      );
    }
  };
}

function createSteamWebApiPublishedItemVotingFacade(
  clientOptions: SteamWebApiClientOptions
): SteamWebApiPublishedItemVotingFacade {
  return {
    itemVoteSummary<T = unknown>(options: SteamWebApiItemVoteSummaryOptions): Promise<SteamWebApiResponse<T>> {
      return steamWebApiPost<T>(
        clientOptions,
        "ISteamPublishedItemVoting",
        "ItemVoteSummary",
        1,
        steamWebApiPublishedItemVoteBody(options, options.appId),
        options
      );
    },
    userVoteSummary<T = unknown>(options: SteamWebApiUserVoteSummaryOptions): Promise<SteamWebApiResponse<T>> {
      return steamWebApiPost<T>(
        clientOptions,
        "ISteamPublishedItemVoting",
        "UserVoteSummary",
        1,
        steamWebApiPublishedItemVoteBody(options),
        options
      );
    }
  };
}

function createSteamWebApiWishlistServiceFacade(
  clientOptions: SteamWebApiClientOptions
): SteamWebApiWishlistServiceFacade {
  return {
    getWishlistSortedFiltered<T = unknown>(
      options: SteamWebApiWishlistSortedFilteredOptions
    ): Promise<SteamWebApiResponse<T>> {
      return steamWebApiServiceGet<T>(
        clientOptions,
        "IWishlistService",
        "GetWishlistSortedFiltered",
        1,
        {
          steamid: options.steamId64,
          context: options.context,
          data_request: options.dataRequest,
          sort_order: options.sortOrder,
          filters: options.filters,
          start_index: options.startIndex,
          page_size: options.pageSize,
          share_token: options.shareToken
        },
        options,
        false
      );
    },
    getWishlist<T = unknown>(
      steamId64: bigint | number | string,
      options?: SteamWebApiEndpointOptions | null
    ): Promise<SteamWebApiResponse<T>> {
      return steamWebApiServiceGet<T>(
        clientOptions,
        "IWishlistService",
        "GetWishlist",
        1,
        { steamid: steamId64 },
        options,
        false
      );
    },
    getWishlistItemCount<T = unknown>(
      steamId64: bigint | number | string,
      options?: SteamWebApiEndpointOptions | null
    ): Promise<SteamWebApiResponse<T>> {
      return steamWebApiServiceGet<T>(
        clientOptions,
        "IWishlistService",
        "GetWishlistItemCount",
        1,
        { steamid: steamId64 },
        options,
        false
      );
    }
  };
}

function createSteamWebApiWorkshopServiceFacade(
  clientOptions: SteamWebApiClientOptions
): SteamWebApiWorkshopServiceFacade {
  return {
    setItemPaymentRules<T = unknown>(
      options: SteamWebApiWorkshopSetItemPaymentRulesOptions
    ): Promise<SteamWebApiResponse<T>> {
      return steamWebApiServicePost<T>(
        clientOptions,
        "IWorkshopService",
        "SetItemPaymentRules",
        1,
        {
          appid: options.appId,
          gameitemid: options.gameItemId,
          associated_workshop_files: options.associatedWorkshopFiles,
          partner_accounts: options.partnerAccounts,
          validate_only: options.validateOnly,
          make_workshop_files_subscribable: options.makeWorkshopFilesSubscribable
        },
        options
      );
    },
    getFinalizedContributors<T = unknown>(
      options: SteamWebApiWorkshopGameItemOptions
    ): Promise<SteamWebApiResponse<T>> {
      return steamWebApiServiceGet<T>(
        clientOptions,
        "IWorkshopService",
        "GetFinalizedContributors",
        1,
        { appid: options.appId, gameitemid: options.gameItemId },
        options
      );
    },
    getItemDailyRevenue<T = unknown>(
      options: SteamWebApiWorkshopItemDailyRevenueOptions
    ): Promise<SteamWebApiResponse<T>> {
      return steamWebApiServiceGet<T>(
        clientOptions,
        "IWorkshopService",
        "GetItemDailyRevenue",
        1,
        {
          appid: options.appId,
          item_id: options.itemId,
          date_start: options.dateStart,
          date_end: options.dateEnd
        },
        options
      );
    },
    populateItemDescriptions<T = unknown>(
      options: SteamWebApiWorkshopPopulateItemDescriptionsOptions
    ): Promise<SteamWebApiResponse<T>> {
      return steamWebApiServicePost<T>(
        clientOptions,
        "IWorkshopService",
        "PopulateItemDescriptions",
        1,
        { appid: options.appId, languages: options.languages },
        options
      );
    }
  };
}

function createSteamWebApiUserAuthFacade(clientOptions: SteamWebApiClientOptions): SteamWebApiUserAuthFacade {
  return {
    authenticateUser<T = unknown>(options: SteamWebApiAuthenticateUserOptions): Promise<SteamWebApiResponse<T>> {
      const requestOptions = steamWebApiEndpointRequestOptions(options, clientOptions, true);
      requestOptions.key = options.key ?? null;
      return requestSteamWebApiWithClient<T>(
        {
          ...requestOptions,
          interfaceName: "ISteamUserAuth",
          methodName: "AuthenticateUser",
          version: 1,
          method: "POST",
          body: {
            steamid: options.steamId64,
            sessionkey: steamWebApiBinaryString(options.sessionKey),
            encrypted_loginkey: steamWebApiBinaryString(options.encryptedLoginKey)
          }
        },
        clientOptions
      );
    },
    authenticateUserTicket<T = unknown>(
      options: SteamWebApiAuthenticateUserTicketOptions
    ): Promise<SteamWebApiResponse<T>> {
      return steamWebApiGet<T>(
        clientOptions,
        "ISteamUserAuth",
        "AuthenticateUserTicket",
        1,
        { appid: options.appId, ticket: steamWebApiBinaryString(options.ticket), identity: options.identity },
        options
      );
    }
  };
}

function createSteamWebApiUserOAuthFacade(clientOptions: SteamWebApiClientOptions): SteamWebApiUserOAuthFacade {
  return {
    getTokenDetails<T = unknown>(
      accessToken: string,
      options?: SteamWebApiOAuthEndpointOptions | null
    ): Promise<SteamWebApiResponse<T>> {
      return steamWebApiOAuthGet<T>(
        clientOptions,
        "ISteamUserOAuth",
        "GetTokenDetails",
        1,
        { access_token: accessToken },
        options
      );
    }
  };
}

function createSteamWebApiCommunityFacade(clientOptions: SteamWebApiClientOptions): SteamWebApiCommunityFacade {
  return {
    reportAbuse<T = unknown>(options: SteamWebApiReportAbuseOptions): Promise<SteamWebApiResponse<T>> {
      return steamWebApiPost<T>(
        clientOptions,
        "ISteamCommunity",
        "ReportAbuse",
        1,
        {
          steamidActor: options.actorSteamId64,
          steamidTarget: options.targetSteamId64,
          appid: options.appId,
          abuseType: options.abuseType,
          contentType: options.contentType,
          description: options.description,
          gid: options.gid
        },
        options
      );
    }
  };
}

function createSteamWebApiUtilFacade(clientOptions: SteamWebApiClientOptions): SteamWebApiUtilFacade {
  return {
    getServerInfo<T = unknown>(options?: SteamWebApiEndpointOptions | null): Promise<SteamWebApiResponse<T>> {
      return steamWebApiGet<T>(clientOptions, "ISteamWebAPIUtil", "GetServerInfo", 1, {}, options, false);
    },
    getSupportedApiList<T = unknown>(options?: SteamWebApiEndpointOptions | null): Promise<SteamWebApiResponse<T>> {
      return steamWebApiGet<T>(clientOptions, "ISteamWebAPIUtil", "GetSupportedAPIList", 1, {}, options, false);
    }
  };
}

function createSteamWebApiUserStatsFacade(clientOptions: SteamWebApiClientOptions): SteamWebApiUserStatsFacade {
  return {
    getGlobalAchievementPercentagesForApp<T = unknown>(
      gameId: bigint | number | string,
      options?: SteamWebApiEndpointOptions | null
    ): Promise<SteamWebApiResponse<T>> {
      return steamWebApiGet<T>(
        clientOptions,
        "ISteamUserStats",
        "GetGlobalAchievementPercentagesForApp",
        2,
        { gameid: gameId },
        options
      );
    },
    getGlobalStatsForGame<T = unknown>(
      options: SteamWebApiGlobalStatsForGameOptions
    ): Promise<SteamWebApiResponse<T>> {
      const params = indexedParams("name", options.names);
      params.appid = options.appId;
      params.count = options.names.length;
      params.startdate = options.startDate;
      params.enddate = options.endDate;
      return steamWebApiGet<T>(clientOptions, "ISteamUserStats", "GetGlobalStatsForGame", 1, params, options);
    },
    getNumberOfCurrentPlayers<T = unknown>(
      appId: number,
      options?: SteamWebApiEndpointOptions | null
    ): Promise<SteamWebApiResponse<T>> {
      return steamWebApiGet<T>(
        clientOptions,
        "ISteamUserStats",
        "GetNumberOfCurrentPlayers",
        1,
        { appid: appId },
        options
      );
    },
    getPlayerAchievements<T = unknown>(
      options: SteamWebApiPlayerAchievementsOptions
    ): Promise<SteamWebApiResponse<T>> {
      return steamWebApiGet<T>(
        clientOptions,
        "ISteamUserStats",
        "GetPlayerAchievements",
        1,
        { appid: options.appId, steamid: options.steamId64, l: options.language },
        options
      );
    },
    getSchemaForGame<T = unknown>(options: SteamWebApiGameSchemaOptions): Promise<SteamWebApiResponse<T>> {
      return steamWebApiGet<T>(
        clientOptions,
        "ISteamUserStats",
        "GetSchemaForGame",
        2,
        { appid: options.appId, l: options.language },
        options
      );
    },
    getUserStatsForGame<T = unknown>(
      options: SteamWebApiUserStatsForGameOptions
    ): Promise<SteamWebApiResponse<T>> {
      return steamWebApiGet<T>(
        clientOptions,
        "ISteamUserStats",
        "GetUserStatsForGame",
        2,
        { appid: options.appId, steamid: options.steamId64 },
        options
      );
    },
    setUserStatsForGame<T = unknown>(
      options: SteamWebApiSetUserStatsForGameOptions
    ): Promise<SteamWebApiResponse<T>> {
      const stats = Array.isArray(options.stats)
        ? options.stats
        : Object.entries(options.stats).map(([name, value]) => ({ name, value }));
      const body = indexedParams("name", stats.map((stat) => stat.name));
      Object.assign(body, indexedParams("value", stats.map((stat) => stat.value)));
      body.appid = options.appId;
      body.steamid = options.steamId64;
      body.count = stats.length;
      return steamWebApiPost<T>(clientOptions, "ISteamUserStats", "SetUserStatsForGame", 1, body, options);
    }
  };
}

function createSteamWebApiUserFacade(clientOptions: SteamWebApiClientOptions): SteamWebApiUserFacade {
  return {
    checkAppOwnership<T = unknown>(options: SteamWebApiCheckAppOwnershipOptions): Promise<SteamWebApiResponse<T>> {
      return steamWebApiGet<T>(
        clientOptions,
        "ISteamUser",
        "CheckAppOwnership",
        4,
        { appid: options.appId, steamid: options.steamId64 },
        options
      );
    },
    getAppPriceInfo<T = unknown>(options: SteamWebApiAppPriceInfoOptions): Promise<SteamWebApiResponse<T>> {
      return steamWebApiGet<T>(
        clientOptions,
        "ISteamUser",
        "GetAppPriceInfo",
        1,
        { appids: options.appIds.join(","), steamid: options.steamId64 },
        options
      );
    },
    getDeletedSteamIds<T = unknown>(options: SteamWebApiDeletedSteamIdsOptions): Promise<SteamWebApiResponse<T>> {
      return steamWebApiGet<T>(
        clientOptions,
        "ISteamUser",
        "GetDeletedSteamIDs",
        1,
        { rowversion: options.rowVersion },
        options
      );
    },
    getFriendList<T = unknown>(options: SteamWebApiFriendListOptions): Promise<SteamWebApiResponse<T>> {
      return steamWebApiGet<T>(
        clientOptions,
        "ISteamUser",
        "GetFriendList",
        1,
        { steamid: options.steamId64, relationship: options.relationship },
        options
      );
    },
    getPlayerBans<T = unknown>(
      steamIds: Array<bigint | number | string>,
      options?: SteamWebApiEndpointOptions | null
    ): Promise<SteamWebApiResponse<T>> {
      return steamWebApiGet<T>(
        clientOptions,
        "ISteamUser",
        "GetPlayerBans",
        1,
        { steamids: commaList(steamIds) },
        options
      );
    },
    getPlayerSummaries<T = unknown>(
      steamIds: Array<bigint | number | string>,
      options?: SteamWebApiEndpointOptions | null
    ): Promise<SteamWebApiResponse<T>> {
      return steamWebApiGet<T>(
        clientOptions,
        "ISteamUser",
        "GetPlayerSummaries",
        2,
        { steamids: commaList(steamIds) },
        options
      );
    },
    getPublisherAppOwnership<T = unknown>(
      steamId64: bigint | number | string,
      options?: SteamWebApiEndpointOptions | null
    ): Promise<SteamWebApiResponse<T>> {
      return steamWebApiGet<T>(
        clientOptions,
        "ISteamUser",
        "GetPublisherAppOwnership",
        4,
        { steamid: steamId64 },
        options
      );
    },
    getUserGroupList<T = unknown>(
      steamId64: bigint | number | string,
      options?: SteamWebApiEndpointOptions | null
    ): Promise<SteamWebApiResponse<T>> {
      return steamWebApiGet<T>(clientOptions, "ISteamUser", "GetUserGroupList", 1, { steamid: steamId64 }, options);
    },
    resolveVanityUrl<T = unknown>(
      vanityUrl: string,
      options?: SteamWebApiResolveVanityUrlOptions | null
    ): Promise<SteamWebApiResponse<T>> {
      return steamWebApiGet<T>(
        clientOptions,
        "ISteamUser",
        "ResolveVanityURL",
        1,
        { vanityurl: vanityUrl, url_type: options?.urlType },
        options
      );
    }
  };
}

function createSteamWebApiMicroTxnFacade(
  interfaceName: "ISteamMicroTxn" | "ISteamMicroTxnSandbox",
  clientOptions: SteamWebApiClientOptions
): SteamWebApiMicroTxnFacade {
  const initTxn = <T = unknown>(options: SteamWebApiInitTxnOptions): Promise<SteamWebApiResponse<T>> =>
    steamWebApiPost<T>(
      clientOptions,
      interfaceName,
      "InitTxn",
      3,
      steamWebApiInitTxnBody(options),
      options
    );

  return {
    adjustAgreement<T = unknown>(options: SteamWebApiAdjustAgreementOptions): Promise<SteamWebApiResponse<T>> {
      return steamWebApiPost<T>(
        clientOptions,
        interfaceName,
        "AdjustAgreement",
        1,
        {
          appid: options.appId,
          steamid: options.steamId64,
          agreementid: options.agreementId,
          nextprocessdate: options.nextProcessDate,
          oldnextprocessdate: options.oldNextProcessDate
        },
        options
      );
    },
    cancelAgreement<T = unknown>(options: SteamWebApiAgreementOptions): Promise<SteamWebApiResponse<T>> {
      return steamWebApiPost<T>(
        clientOptions,
        interfaceName,
        "CancelAgreement",
        1,
        { appid: options.appId, steamid: options.steamId64, agreementid: options.agreementId },
        options
      );
    },
    finalizeTxn<T = unknown>(options: SteamWebApiFinalizeTxnOptions): Promise<SteamWebApiResponse<T>> {
      return steamWebApiPost<T>(
        clientOptions,
        interfaceName,
        "FinalizeTxn",
        2,
        { appid: options.appId, orderid: options.orderId },
        options
      );
    },
    getReport<T = unknown>(options: SteamWebApiMicroTxnReportOptions): Promise<SteamWebApiResponse<T>> {
      return steamWebApiGet<T>(
        clientOptions,
        interfaceName,
        "GetReport",
        5,
        { appid: options.appId, type: options.type, time: options.time, maxresults: options.maxResults },
        options
      );
    },
    getUserAgreementInfo<T = unknown>(
      options: SteamWebApiUserAgreementInfoOptions
    ): Promise<SteamWebApiResponse<T>> {
      return steamWebApiGet<T>(
        clientOptions,
        interfaceName,
        "GetUserAgreementInfo",
        1,
        { appid: options.appId, steamid: options.steamId64 },
        options
      );
    },
    getUserInfo<T = unknown>(options: SteamWebApiMicroTxnUserInfoOptions): Promise<SteamWebApiResponse<T>> {
      return steamWebApiGet<T>(
        clientOptions,
        interfaceName,
        "GetUserInfo",
        2,
        { appid: options.appId, steamid: options.steamId64, ipaddress: options.ipAddress },
        options
      );
    },
    initClientTxn<T = unknown>(
      options: SteamWebApiInitTxnWithPresetSessionOptions
    ): Promise<SteamWebApiResponse<T>> {
      return initTxn<T>({ ...options, userSession: "client" });
    },
    initTxn,
    initWebTxn<T = unknown>(options: SteamWebApiInitTxnWithPresetSessionOptions): Promise<SteamWebApiResponse<T>> {
      return initTxn<T>({ ...options, userSession: "web" });
    },
    processAgreement<T = unknown>(options: SteamWebApiProcessAgreementOptions): Promise<SteamWebApiResponse<T>> {
      return steamWebApiPost<T>(
        clientOptions,
        interfaceName,
        "ProcessAgreement",
        1,
        {
          appid: options.appId,
          orderid: options.orderId,
          steamid: options.steamId64,
          agreementid: options.agreementId,
          amount: options.amount,
          currency: options.currency
        },
        options
      );
    },
    queryTxn<T = unknown>(options: SteamWebApiQueryTxnOptions): Promise<SteamWebApiResponse<T>> {
      return steamWebApiGet<T>(
        clientOptions,
        interfaceName,
        "QueryTxn",
        3,
        { appid: options.appId, orderid: options.orderId, transid: options.transactionId },
        options
      );
    },
    refundTxn<T = unknown>(options: SteamWebApiRefundTxnOptions): Promise<SteamWebApiResponse<T>> {
      return steamWebApiPost<T>(
        clientOptions,
        interfaceName,
        "RefundTxn",
        2,
        { appid: options.appId, orderid: options.orderId },
        options
      );
    }
  };
}

function steamWebApiGet<T>(
  clientOptions: SteamWebApiClientOptions,
  interfaceName: string,
  methodName: string,
  version: number,
  params: SteamWebApiParams,
  options?: SteamWebApiEndpointOptions | null,
  preferPartnerBaseUrl = true
): Promise<SteamWebApiResponse<T>> {
  return requestSteamWebApiWithClient<T>(
    {
      ...steamWebApiEndpointRequestOptions(options, clientOptions, preferPartnerBaseUrl),
      interfaceName,
      methodName,
      version,
      method: "GET",
      params
    },
    clientOptions
  );
}

function steamWebApiPost<T>(
  clientOptions: SteamWebApiClientOptions,
  interfaceName: string,
  methodName: string,
  version: number,
  body: SteamWebApiParams,
  options?: SteamWebApiEndpointOptions | null,
  preferPartnerBaseUrl = true
): Promise<SteamWebApiResponse<T>> {
  return requestSteamWebApiWithClient<T>(
    {
      ...steamWebApiEndpointRequestOptions(options, clientOptions, preferPartnerBaseUrl),
      interfaceName,
      methodName,
      version,
      method: "POST",
      body
    },
    clientOptions
  );
}

export type SteamWebApiInputJsonValue =
  | SteamWebApiParamValue
  | readonly SteamWebApiInputJsonValue[]
  | { readonly [key: string]: SteamWebApiInputJsonValue };

function steamWebApiServiceGet<T>(
  clientOptions: SteamWebApiClientOptions,
  interfaceName: string,
  methodName: string,
  version: number,
  input: Record<string, SteamWebApiInputJsonValue>,
  options?: SteamWebApiEndpointOptions | null,
  preferPartnerBaseUrl = true
): Promise<SteamWebApiResponse<T>> {
  return steamWebApiGet<T>(
    clientOptions,
    interfaceName,
    methodName,
    version,
    { input_json: steamWebApiInputJson(input) },
    options,
    preferPartnerBaseUrl
  );
}

function steamWebApiServicePost<T>(
  clientOptions: SteamWebApiClientOptions,
  interfaceName: string,
  methodName: string,
  version: number,
  input: Record<string, SteamWebApiInputJsonValue>,
  options?: SteamWebApiEndpointOptions | null,
  preferPartnerBaseUrl = true
): Promise<SteamWebApiResponse<T>> {
  return steamWebApiPost<T>(
    clientOptions,
    interfaceName,
    methodName,
    version,
    { input_json: steamWebApiInputJson(input) },
    options,
    preferPartnerBaseUrl
  );
}

export type SteamWebApiOAuthEndpointOptions = Omit<SteamWebApiEndpointOptions, "key">;

function steamWebApiOAuthGet<T>(
  clientOptions: SteamWebApiClientOptions,
  interfaceName: string,
  methodName: string,
  version: number,
  params: SteamWebApiParams,
  options?: SteamWebApiOAuthEndpointOptions | null
): Promise<SteamWebApiResponse<T>> {
  return requestSteamWebApiWithClient<T>(
    {
      ...steamWebApiOAuthEndpointRequestOptions(options, clientOptions),
      interfaceName,
      methodName,
      version,
      method: "GET",
      params
    },
    clientOptions
  );
}

function steamWebApiOAuthServicePost<T>(
  clientOptions: SteamWebApiClientOptions,
  interfaceName: string,
  methodName: string,
  version: number,
  accessToken: string,
  input: Record<string, SteamWebApiInputJsonValue>,
  options?: SteamWebApiOAuthEndpointOptions | null
): Promise<SteamWebApiResponse<T>> {
  return requestSteamWebApiWithClient<T>(
    {
      ...steamWebApiOAuthEndpointRequestOptions(options, clientOptions),
      interfaceName,
      methodName,
      version,
      method: "POST",
      body: {
        access_token: accessToken,
        input_json: steamWebApiInputJson(input)
      }
    },
    clientOptions
  );
}

function steamWebApiNewsForAppParams(options: SteamWebApiNewsForAppOptions): SteamWebApiParams {
  return {
    appid: options.appId,
    maxlength: options.maxLength,
    enddate: options.endDate,
    count: options.count,
    feeds: commaString(options.feeds)
  };
}

function steamWebApiPublishedItemSearchBody(
  options: SteamWebApiPublishedItemSearchBaseOptions,
  includePage: boolean
): SteamWebApiParams {
  const tags = options.tags ?? [];
  const userTags = options.userTags ?? [];
  const body: SteamWebApiParams = {
    steamid: options.steamId64,
    appid: options.appId
  };
  if (includePage) {
    const pagedOptions = options as SteamWebApiPublishedItemSearchOptions;
    body.startidx = pagedOptions.startIndex;
    body.count = pagedOptions.count;
  }
  body.tagcount = tags.length;
  body.usertagcount = userTags.length;
  body.hasappadminaccess = options.hasAppAdminAccess;
  body.fileType = options.fileType;
  Object.assign(body, indexedParams("tag", tags), indexedParams("usertag", userTags));
  return body;
}

function steamWebApiKeyValueTags(
  tags: Record<string, string> | readonly SteamWebApiPublishedFileKeyValueTag[] | undefined
): SteamWebApiInputJsonValue[] | undefined {
  if (tags === undefined) {
    return undefined;
  }

  const entries = Array.isArray(tags) ? tags : Object.entries(tags).map(([key, value]) => ({ key, value }));
  return entries.map((tag) => ({ key: tag.key, value: tag.value }));
}

function steamWebApiGameNotificationsLocalizedText(
  text: SteamWebApiGameNotificationsLocalizedText | undefined
): SteamWebApiInputJsonValue | undefined {
  if (!text) {
    return undefined;
  }
  return {
    token: text.token,
    variables: text.variables?.map((variable) => ({ key: variable.key, value: variable.value }))
  };
}

function steamWebApiGameNotificationsUserState(
  user: SteamWebApiGameNotificationsUserState
): SteamWebApiInputJsonValue {
  return {
    steamid: user.steamId64,
    state: user.state,
    title: steamWebApiGameNotificationsLocalizedText(user.title),
    message: steamWebApiGameNotificationsLocalizedText(user.message)
  };
}

function steamWebApiGameNotificationsSessionDetailsRequest(
  session: SteamWebApiGameNotificationsSessionDetailsRequest
): SteamWebApiInputJsonValue {
  return {
    sessionid: session.sessionId,
    include_all_user_messages: session.includeAllUserMessages,
    include_auth_user_message: session.includeAuthUserMessage
  };
}

function steamWebApiPublishedItemVoteBody(
  options: SteamWebApiPublishedItemIdsOptions,
  appId?: number
): SteamWebApiParams {
  const body: SteamWebApiParams = {
    steamid: options.steamId64,
    appid: appId,
    count: options.publishedFileIds.length
  };
  Object.assign(body, indexedParams("publishedfileid", options.publishedFileIds));
  return body;
}

function steamWebApiKeylessEndpointOptions(
  options: SteamWebApiEndpointOptions | null | undefined
): SteamWebApiEndpointOptions {
  return options ? { ...options, key: options.key ?? null } : { key: null };
}

function steamWebApiEndpointRequestOptions(
  options: SteamWebApiEndpointOptions | null | undefined,
  clientOptions: SteamWebApiClientOptions,
  preferPartnerBaseUrl: boolean
): SteamWebApiEndpointOptions {
  return {
    key: options?.key,
    format: options?.format,
    baseUrl:
      options?.baseUrl ?? clientOptions.baseUrl ?? (preferPartnerBaseUrl ? DEFAULT_STEAM_WEB_API_PARTNER_BASE_URL : undefined),
    headers: options?.headers,
    signal: options?.signal
  };
}

function steamWebApiOAuthEndpointRequestOptions(
  options: SteamWebApiOAuthEndpointOptions | null | undefined,
  clientOptions: SteamWebApiClientOptions
): SteamWebApiEndpointOptions {
  return {
    key: null,
    format: options?.format,
    baseUrl: options?.baseUrl ?? clientOptions.baseUrl,
    headers: options?.headers,
    signal: options?.signal
  };
}

function indexedParams(prefix: string, values: readonly SteamWebApiParamValue[]): SteamWebApiParams {
  const params: SteamWebApiParams = {};
  values.forEach((value, index) => {
    params[`${prefix}[${index}]`] = value;
  });
  return params;
}

function numberedParams(prefix: string, values: readonly SteamWebApiParamValue[]): SteamWebApiParams {
  const params: SteamWebApiParams = {};
  values.forEach((value, index) => {
    params[`${prefix}${index}`] = value;
  });
  return params;
}

function commaString(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value.join(",") : value;
}

function commaList(values: Array<bigint | number | string>): string {
  return values.map(String).join(",");
}

function steamWebApiBinaryString(value: SteamWebApiBinaryValue): string {
  if (typeof value === "string") {
    return value;
  }
  return Buffer.from(value).toString("hex");
}

function steamWebApiInputJson(input: Record<string, SteamWebApiInputJsonValue>): string {
  return steamWebApiInputJsonValue(input);
}

function steamWebApiInputJsonValue(input: SteamWebApiInputJsonValue): string {
  return JSON.stringify(steamWebApiJsonReady(input));
}

function steamWebApiJsonReady(value: SteamWebApiInputJsonValue): unknown {
  if (value === undefined) {
    return undefined;
  }
  if (typeof value === "bigint") {
    return value.toString();
  }
  if (Array.isArray(value)) {
    return value.map(steamWebApiJsonReady);
  }
  if (value !== null && typeof value === "object") {
    const output: Record<string, unknown> = {};
    for (const [key, entry] of Object.entries(value)) {
      const ready = steamWebApiJsonReady(entry);
      if (ready !== undefined) {
        output[key] = ready;
      }
    }
    return output;
  }
  return value;
}

function steamWebApiInitTxnBody(options: SteamWebApiInitTxnOptions): SteamWebApiParams {
  const body: SteamWebApiParams = {
    orderid: options.orderId,
    steamid: options.steamId64,
    appid: options.appId,
    itemcount: options.items.length,
    language: options.language,
    currency: options.currency,
    usersession: options.userSession,
    ipaddress: options.ipAddress,
    bundlecount: options.bundles?.length
  };

  options.items.forEach((item, index) => {
    body[`itemid[${index}]`] = item.itemId;
    body[`qty[${index}]`] = item.quantity;
    body[`amount[${index}]`] = item.amount;
    body[`description[${index}]`] = item.description;
    body[`category[${index}]`] = item.category;
    body[`associated_bundle[${index}]`] = item.associatedBundle;
    body[`billingtype[${index}]`] = item.billingType;
    body[`period[${index}]`] = item.period;
    body[`frequency[${index}]`] = item.frequency;
    body[`recurringamt[${index}]`] = item.recurringAmount;
  });

  options.bundles?.forEach((bundle, index) => {
    body[`bundleid[${index}]`] = bundle.bundleId;
    body[`bundle_qty[${index}]`] = bundle.quantity;
    body[`bundle_desc[${index}]`] = bundle.description;
    body[`bundle_category[${index}]`] = bundle.category;
  });

  return body;
}

function requestSteamWebApiWithDefaults(
  request: SteamWebApiRequestOptions,
  options: SteamWebApiClientOptions
): SteamWebApiRequestOptions {
  const envApiKey = process.env.STEAM_WEB_API_KEY ?? process.env.STEAM_API_KEY;
  const apiKey =
    request.key !== undefined ? request.key : options.apiKey !== undefined ? options.apiKey : envApiKey;
  return {
    ...request,
    key: apiKey,
    baseUrl: request.baseUrl ?? options.baseUrl,
    format: request.format === undefined ? options.defaultFormat ?? "json" : request.format,
    headers: {
      ...options.headers,
      ...request.headers
    }
  };
}

async function requestSteamWebApiWithClient<T = unknown>(
  request: SteamWebApiRequestOptions,
  clientOptions: SteamWebApiClientOptions
): Promise<SteamWebApiResponse<T>> {
  const options = requestSteamWebApiWithDefaults(request, clientOptions);
  const fetchImpl = clientOptions.fetch ?? (globalThis.fetch as unknown as SteamWebApiFetch | undefined);
  if (!fetchImpl) {
    throw new Error("global fetch is unavailable; pass a fetch implementation to createSteamWebApiClient()");
  }

  const headers = { ...(options.headers ?? {}) };
  const body = serializeSteamWebApiBody(options.body, headers);
  const url = buildSteamWebApiUrl(options);
  const method = options.method ?? (body == null ? "GET" : "POST");
  const response = await fetchImpl(url, {
    method,
    headers,
    body,
    signal: options.signal
  });
  const text = await response.text();
  const responseHeaders = steamWebApiHeadersToRecord(response.headers);
  return {
    ok: response.ok,
    status: response.status,
    url,
    headers: responseHeaders,
    data: parseSteamWebApiResponse<T>(text, responseHeaders, options.format),
    text
  };
}

function baseUrlWithTrailingSlash(value: string): string {
  return value.endsWith("/") ? value : `${value}/`;
}

function steamWebApiPathComponent(value: string, name: string): string {
  const trimmed = value.trim();
  if (!trimmed) {
    throw new Error(`Steam Web API ${name} is required`);
  }
  return encodeURIComponent(trimmed);
}

function normalizeSteamWebApiVersion(version: string | number | undefined): string {
  if (version === undefined) {
    return "v0001";
  }

  if (typeof version === "number") {
    return `v${Math.trunc(version).toString().padStart(4, "0")}`;
  }

  const trimmed = version.trim();
  const numeric = trimmed.match(/^v?(\d+)$/i);
  if (numeric) {
    return `v${numeric[1].padStart(4, "0")}`;
  }
  return trimmed;
}

function appendSteamWebApiParams(searchParams: URLSearchParams, params: SteamWebApiParams | undefined): void {
  if (!params) {
    return;
  }

  for (const [key, value] of Object.entries(params)) {
    if (Array.isArray(value)) {
      for (const entry of value as readonly SteamWebApiParamValue[]) {
        appendSteamWebApiParam(searchParams, key, entry);
      }
    } else {
      appendSteamWebApiParam(searchParams, key, value as SteamWebApiParamValue);
    }
  }
}

function appendSteamWebApiParam(searchParams: URLSearchParams, key: string, value: SteamWebApiParamValue): void {
  if (value === undefined || value === null) {
    return;
  }
  searchParams.append(key, serializeSteamWebApiValue(value));
}

function serializeSteamWebApiValue(value: Exclude<SteamWebApiParamValue, null | undefined>): string {
  if (typeof value === "bigint") {
    return value.toString();
  }
  if (typeof value === "boolean") {
    return value ? "1" : "0";
  }
  return String(value);
}

function serializeSteamWebApiBody(
  body: SteamWebApiBody,
  headers: Record<string, string>
): string | Buffer | Uint8Array | undefined {
  if (body === undefined || body === null) {
    return undefined;
  }

  if (typeof body === "string" || Buffer.isBuffer(body) || body instanceof Uint8Array) {
    return body;
  }

  setSteamWebApiContentType(headers, "application/x-www-form-urlencoded");
  const searchParams = body instanceof URLSearchParams ? body : new URLSearchParams();
  if (!(body instanceof URLSearchParams)) {
    appendSteamWebApiParams(searchParams, body);
  }
  return searchParams.toString();
}

function setSteamWebApiContentType(headers: Record<string, string>, value: string): void {
  if (Object.keys(headers).some((key) => key.toLowerCase() === "content-type")) {
    return;
  }
  headers["content-type"] = value;
}

function steamWebApiHeadersToRecord(headers: SteamWebApiFetchResponse["headers"]): Record<string, string> {
  const output: Record<string, string> = {};
  headers.forEach((value, key) => {
    output[key.toLowerCase()] = value;
  });
  return output;
}

function parseSteamWebApiResponse<T>(
  text: string,
  headers: Record<string, string>,
  format: string | null | undefined
): T {
  if (!text) {
    return null as T;
  }

  const contentType = headers["content-type"] ?? "";
  const expectsJson = format === "json" || contentType.includes("json") || /^[\s]*[{[]/.test(text);
  if (expectsJson) {
    try {
      return JSON.parse(text) as T;
    } catch {
      return text as T;
    }
  }

  return text as T;
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
  return {
    address: normalizeMatchmakingServerAddress(server.address),
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

function normalizeMatchmakingServerAddress(address: NativeMatchmakingServerAddress): MatchmakingServerAddress {
  const source = address as unknown as Record<string, unknown>;
  return {
    ip: Number(source.ip ?? 0),
    ipAddress: String(source.ipAddress ?? source.ip_address ?? ""),
    connectionPort: Number(source.connectionPort ?? source.connection_port ?? 0),
    queryPort: Number(source.queryPort ?? source.query_port ?? 0),
    connectionAddress: String(source.connectionAddress ?? source.connection_address ?? ""),
    queryAddress: String(source.queryAddress ?? source.query_address ?? "")
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

function normalizeMatchmakingServerListResponseCallbackState(
  state: NativeMatchmakingServerListResponseCallbackState
): MatchmakingServerListResponseCallbackState {
  const source = state as unknown as Record<string, unknown>;
  return {
    request: BigInt((source.request ?? 0) as bigint | number | string),
    completed: Boolean(state.completed),
    cancelled: Boolean(source.cancelled ?? source.canceled),
    response: Number(state.response ?? 0),
    responded: (state.responded ?? []).map(Number),
    failed: (state.failed ?? []).map(Number)
  };
}

function normalizeMatchmakingServerResponseCallbackSnapshot(
  snapshot: NativeMatchmakingServerResponseCallbackSnapshot
): MatchmakingServerResponseCallbackSnapshot {
  const source = snapshot as unknown as Record<string, unknown>;
  const emptyServerList: NativeMatchmakingServerListResponseCallbackState = {
    request: 0n,
    completed: false,
    cancelled: false,
    response: 0,
    responded: [],
    failed: []
  };
  return {
    serverList: normalizeMatchmakingServerListResponseCallbackState(
      (source.serverList ?? source.server_list ?? emptyServerList) as NativeMatchmakingServerListResponseCallbackState
    ),
    pingSuccess: normalizeMatchmakingServerPingResult(
      (source.pingSuccess ?? source.ping_success ?? { responded: false }) as NativeMatchmakingServerPingResult
    ),
    pingFailure: normalizeMatchmakingServerPingResult(
      (source.pingFailure ?? source.ping_failure ?? { responded: false }) as NativeMatchmakingServerPingResult
    ),
    playersSuccess: normalizeMatchmakingServerPlayersResult(
      (source.playersSuccess ?? source.players_success ?? { responded: false, players: [] }) as NativeMatchmakingServerPlayersResult
    ),
    playersFailure: normalizeMatchmakingServerPlayersResult(
      (source.playersFailure ?? source.players_failure ?? { responded: false, players: [] }) as NativeMatchmakingServerPlayersResult
    ),
    rulesSuccess: normalizeMatchmakingServerRulesResult(
      (source.rulesSuccess ?? source.rules_success ?? { responded: false, rules: [] }) as NativeMatchmakingServerRulesResult
    ),
    rulesFailure: normalizeMatchmakingServerRulesResult(
      (source.rulesFailure ?? source.rules_failure ?? { responded: false, rules: [] }) as NativeMatchmakingServerRulesResult
    )
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

function normalizeSteamClientCallbackRegistrationCheck(
  event: unknown
): SteamClientCallbackRegistrationCheck {
  const source = (event && typeof event === "object" ? event : {}) as Record<string, unknown>;
  return {
    callbackId: Number(source.callbackId ?? source.callback_id ?? 0)
  };
}

function wrapCallbackHandle(handle: NativeCallbackHandle): CallbackHandle {
  return {
    disconnect: () => handle.disconnect()
  };
}

function safeBoolean(fn: () => boolean): boolean {
  try {
    return fn();
  } catch {
    return false;
  }
}

function finiteNumber(value: number | undefined, fallback: number): number {
  return Number.isFinite(value) ? Number(value) : fallback;
}

function normalizeSteamAppId(appId: number): number {
  if (!Number.isInteger(appId) || appId <= 0) {
    throw new Error(`Invalid Steam App ID: ${appId}`);
  }
  return appId;
}

function normalizeSteamId64(steamId64: bigint | number | string): string {
  let normalized: bigint;
  try {
    normalized = BigInt(steamId64);
  } catch {
    throw new Error(`Invalid Steam ID: ${steamId64}`);
  }
  if (normalized <= 0n) {
    throw new Error(`Invalid Steam ID: ${steamId64}`);
  }
  return normalized.toString();
}

function normalizeSteamTransactionId(transactionId: bigint | number | string): string {
  if (typeof transactionId === "number" && !Number.isSafeInteger(transactionId)) {
    throw new Error(`Invalid Steam transaction ID: ${transactionId}`);
  }
  let normalized: bigint;
  try {
    normalized = BigInt(transactionId);
  } catch {
    throw new Error(`Invalid Steam transaction ID: ${transactionId}`);
  }
  if (normalized <= 0n) {
    throw new Error(`Invalid Steam transaction ID: ${transactionId}`);
  }
  return normalized.toString();
}

function resolveSteamCheckoutOverlayUrl(options: Omit<SteamOverlayCheckoutTarget, "type">): string {
  const url = options.steamUrl ?? options.url;
  if (url) {
    return String(url);
  }
  if (options.transactionId != null) {
    return steamCheckoutTransactionUrl(options.transactionId, {
      returnUrl: options.returnUrl
    });
  }
  throw new Error("A Steam checkout overlay requires a url, steamUrl, or transactionId.");
}

function normalizedFps(value: number | undefined, fallback: number): number {
  return Math.max(0, finiteNumber(value, fallback));
}

function activateWithNativeOverlaySession(
  options: NativeOverlaySessionOptions | undefined,
  activate: () => void
): NativeOverlaySession {
  const session = startNativeOverlaySession(options);

  try {
    activate();
  } catch (error) {
    session.close();
    throw error;
  }

  return session;
}

function activateWithOverlayPresenter(
  options: NativeOverlayPresenterOverlayOptions,
  activate: () => void,
  activationMode: NativeOverlayPresenterActivationMode
): NativeOverlayPresenter {
  const providedPresenter = options.presenter;
  const skipPrepare = Boolean(
    (options as InternalNativeOverlayPresenterOverlayOptions)[SKIP_NATIVE_OVERLAY_PRESENTER_PREPARE]
  );
  const { presenter: _presenter, ...presenterOptions } = options;
  const activePresenter = providedPresenter ?? attachOverlayPresenter(presenterOptions);

  try {
    if (!skipPrepare) {
      if (activationMode === "interactive") {
        activePresenter.prepareForOverlay();
      } else if (activationMode === "transparent-input") {
        const presenterInternal = activePresenter as NativeOverlayPresenterInternal;
        if (typeof presenterInternal.prepareForTransparentInputOverlay === "function") {
          presenterInternal.prepareForTransparentInputOverlay();
        } else {
          activePresenter.prepareForPassiveOverlay();
        }
      } else {
        activePresenter.prepareForPassiveOverlay();
      }
    }
    activate();
  } catch (error) {
    if (!providedPresenter) {
      activePresenter.close();
    }
    throw error;
  }

  return activePresenter;
}

function unwrapNativeCallbackArgument(event: unknown): unknown {
  if (!event || typeof event !== "object") {
    return event;
  }

  const source = event as Record<string, unknown>;
  const keys = Object.keys(source);
  if (keys.length === 1 && keys[0] === "0" && source[0] && typeof source[0] === "object") {
    return source[0];
  }

  return event;
}

function resolveSteamCallbackId(steamCallback: SteamCallbackName | SteamCallbackId | number): number {
  if (typeof steamCallback === "string") {
    const callbackId = SteamCallback[steamCallback as SteamCallbackName];
    if (callbackId === undefined) {
      throw new Error(`Unknown Steam callback: ${steamCallback}`);
    }
    return callbackId;
  }
  return Number(steamCallback);
}

function normalizeCallbackEvent(callbackId: number, event: unknown): unknown {
  if (
    callbackId === SteamCallback.MicroTxnAuthorizationResponse ||
    callbackId === SteamCallback.MicroTxnAuthorizationResponseSteamworks
  ) {
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
    "beacon",
    "item_id",
    "child_item_id",
    "legacy_content",
    "manifest_id",
    "file",
    "owner",
    "preview_file",
    "published_file_id",
    "preview_file_size",
    "size",
    "total_files_size",
    "unused",
    "handle",
    "leaderboard",
    "entries_handle",
    "user_changed",
    "making_change",
    "remote",
    "lobby_steam_id",
    "friend_steam_id",
    "async_call",
    "context_value",
    "joiner",
    "file_size",
    "owner_steam_id",
    "group_id",
    "candidate_steam_id",
    "banned_game_id",
    "connected_device_handle",
    "disconnected_device_handle",
    "device_handle",
    "mapping_creator",
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
    accepted_for_use: "acceptedForUse",
    app_id: "appId",
    auth_session_response: "authSessionResponse",
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
    connected_device_handle: "connectedDeviceHandle",
    conn_port: "connPort",
    connect_string: "connectString",
    connect_url: "connectUrl",
    candidate_steam_id: "candidateSteamId",
    current_progress: "currentProgress",
    ban_expires: "banExpires",
    banned_game_id: "bannedGameId",
    banned_ip: "bannedIp",
    banned_ip_address: "bannedIpAddress",
    banned_port: "bannedPort",
    bgra_base64: "bgraBase64",
    bgra_byte_length: "bgraByteLength",
    bgra_truncated: "bgraTruncated",
    browser_handle: "browserHandle",
    body_size: "bodySize",
    bytes_received: "bytesReceived",
    bytes_read: "bytesRead",
    can_go_back: "canGoBack",
    can_go_forward: "canGoForward",
    context_value: "contextValue",
    consumer_app_id: "consumerAppId",
    creator_app_id: "creatorAppId",
    current_match: "currentMatch",
    deny_reason: "denyReason",
    device_handle: "deviceHandle",
    device_type: "deviceType",
    disconnected_device_handle: "disconnectedDeviceHandle",
    entry_id: "entryId",
    entry_count: "entryCount",
    entry_type: "entryType",
    entries_handle: "entriesHandle",
    event_type: "eventType",
    file_name: "fileName",
    file_size: "fileSize",
    failure_type: "failureType",
    file_type: "fileType",
    friend_steam_id: "friendSteamId",
    game_server_ip: "gameServerIp",
    game_server_ip_address: "gameServerIpAddress",
    game_server_port: "gameServerPort",
    from_cache: "fromCache",
    game_id: "gameId",
    game_server: "gameServer",
    group_id: "groupId",
    group_achievement: "groupAchievement",
    global_rank_new: "globalRankNew",
    global_rank_previous: "globalRankPrevious",
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
    icon_handle: "iconHandle",
    key_length: "keyLength",
    kicked_due_to_disconnect: "kickedDueToDisconnect",
    listen_socket: "listenSocket",
    lobby_steam_id: "lobbySteamId",
    legacy_content: "legacyContent",
    local_handle: "localHandle",
    longest_clip_ms: "longestClipMs",
    lobbies_matching: "lobbiesMatching",
    manifest_id: "manifestId",
    max_progress: "maxProgress",
    live_link: "liveLink",
    major_revision: "majorRevision",
    making_change: "makingChange",
    mapping_creator: "mappingCreator",
    member_state_change: "memberStateChange",
    message_id: "messageId",
    message_size: "messageSize",
    minor_revision: "minorRevision",
    mouse_cursor: "mouseCursor",
    new_navigation: "newNavigation",
    new_gamepad_slot: "newGamepadSlot",
    new_window_browser_handle: "newWindowBrowserHandle",
    minutes_battery_left: "minutesBatteryLeft",
    new_volume: "newVolume",
    new_device_cooldown_days: "newDeviceCooldownDays",
    next_cursor: "nextCursor",
    needs_to_accept_agreement: "needsToAcceptAgreement",
    num_app_dependencies: "numAppDependencies",
    not_allowed_reason: "notAllowedReason",
    officer_count: "officerCount",
    optional_text: "optionalText",
    owner_steam_id: "ownerSteamId",
    old_gamepad_slot: "oldGamepadSlot",
    old_browser_handle: "oldBrowserHandle",
    page_scale: "pageScale",
    page_serial: "pageSerial",
    page_size: "pageSize",
    page_title: "pageTitle",
    parameter_size: "parameterSize",
    percent_file: "percentFile",
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
    repeat_status: "repeatStatus",
    request_successful: "requestSuccessful",
    results_returned: "resultsReturned",
    returned_results: "returnedResults",
    seconds_allowed: "secondsAllowed",
    seconds_last_5h: "secondsLast5h",
    seconds_remaining: "secondsRemaining",
    seconds_played: "secondsPlayed",
    seconds_today: "secondsToday",
    session_id: "sessionId",
    sha_hex: "shaHex",
    score_changed: "scoreChanged",
    screenshot_count: "screenshotCount",
    scroll_current: "scrollCurrent",
    scroll_max: "scrollMax",
    scroll_x: "scrollX",
    scroll_y: "scrollY",
    steam_guard_required_days: "steamGuardRequiredDays",
    steam_ids: "steamIds",
    still_retrying: "stillRetrying",
    status_code: "statusCode",
    start_index: "startIndex",
    submitted_text: "submittedText",
    subscribed_times: "subscribedTimes",
    tags_truncated: "tagsTruncated",
    ticket_base64: "ticketBase64",
    ticket_byte_length: "ticketByteLength",
    time_created: "timeCreated",
    time_updated: "timeUpdated",
    total_connects: "totalConnects",
    total_files_size: "totalFilesSize",
    total_num_app_dependencies: "totalNumAppDependencies",
    total_results: "totalResults",
    total_minutes_played: "totalMinutesPlayed",
    total_result_count: "totalResultCount",
    uses_gamepad_api: "usesGamepadApi",
    uses_steam_input_api: "usesSteamInputApi",
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
    updated_times: "updatedTimes",
    user_changed: "userChanged",
    video_app_id: "videoAppId",
    votes_against: "votesAgainst",
    votes_for: "votesFor"
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
  if (typeof result.tags === "string") {
    result.tags = result.tags.split(",").filter(Boolean);
  }
  if (typeof result.bgra_base64 === "string") {
    result.bgra = Buffer.from(result.bgra_base64, "base64");
  }
  if (typeof result.ticket_base64 === "string") {
    result.ticket = Buffer.from(result.ticket_base64, "base64");
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
  event = unwrapNativeCallbackArgument(event);
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
  event = unwrapNativeCallbackArgument(event);
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
    overlayNeedsPresentPollingEnabled: diagnostics.overlayNeedsPresentPollingEnabled,
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

function normalizeUtilsCserIPPort(result: NativeUtilsCserIpPort | null | undefined): UtilsCserIPPort | null {
  if (!result) {
    return null;
  }
  const source = result as unknown as Record<string, unknown>;
  return {
    ip: Number(source.ip ?? 0),
    ipAddress: String(source.ipAddress ?? source.ip_address ?? ""),
    port: Number(source.port ?? 0)
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

function normalizeAppOwnershipTicketData(
  result: NativeAppOwnershipTicketData | null | undefined
): AppOwnershipTicketData | null {
  if (!result) {
    return null;
  }
  return {
    ticket: result.ticket,
    bytesWritten: Number(result.bytesWritten ?? result.bytes_written ?? result.ticket.length),
    appIdOffset: Number(result.appIdOffset ?? result.app_id_offset ?? 0),
    steamIdOffset: Number(result.steamIdOffset ?? result.steam_id_offset ?? 0),
    signatureOffset: Number(result.signatureOffset ?? result.signature_offset ?? 0),
    signatureLength: Number(result.signatureLength ?? result.signature_length ?? 0)
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

function normalizeInputActionEvent(event: NativeInputActionEvent): InputActionEvent {
  const analogActionData = event.analogActionData ?? event.analog_action_data;
  const digitalActionData = event.digitalActionData ?? event.digital_action_data;
  return {
    controllerHandle: BigInt(event.controllerHandle ?? event.controller_handle ?? 0),
    eventType: Number(event.eventType ?? event.event_type ?? 0),
    analogActionHandle:
      event.analogActionHandle == null && event.analog_action_handle == null
        ? undefined
        : BigInt(event.analogActionHandle ?? event.analog_action_handle ?? 0),
    analogActionData: analogActionData == null ? undefined : normalizeInputAnalogActionData(analogActionData),
    digitalActionHandle:
      event.digitalActionHandle == null && event.digital_action_handle == null
        ? undefined
        : BigInt(event.digitalActionHandle ?? event.digital_action_handle ?? 0),
    digitalActionData: digitalActionData == null ? undefined : normalizeInputDigitalActionData(digitalActionData)
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

function userDialogName(dialog: string): string {
  const name = dialog.trim().toLowerCase();
  if (!name) {
    throw new Error("Steam overlay user dialog name cannot be empty.");
  }
  return name;
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
  if (identity.genericBytes !== undefined) {
    output.genericBytes = Buffer.from(identity.genericBytes);
  }
  if (identity.psnId !== undefined) {
    output.psnId = identity.psnId;
  }
  if (identity.xboxPairwiseId !== undefined) {
    output.xboxPairwiseId = identity.xboxPairwiseId;
  }
  if (identity.ipAddress !== undefined) {
    output.ipAddress = nativeNetworkingIpAddress(identity.ipAddress);
  }
  if (identity.ipv4 !== undefined) {
    output.ipv4 = identity.ipv4;
  }
  if (identity.port !== undefined) {
    output.port = identity.port;
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
  if (address.ipv6 !== undefined) {
    output.ipv6 = Buffer.from(address.ipv6);
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
  if (option.pointerValue !== undefined) {
    output.pointerValue = option.pointerValue === null ? null : BigInt(option.pointerValue);
  }
  return output;
}

function nativeNetworkingConfigValues(
  options?: readonly NetworkingConfigOption[] | null
): NativeNetworkingConfigValue[] | undefined {
  if (!options || options.length === 0) {
    return undefined;
  }
  return options.map(nativeNetworkingConfigValue);
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

function normalizeGameCoordinatorMessageAvailable(
  result: NativeGameCoordinatorMessageAvailable
): GameCoordinatorMessageAvailable {
  const source = result as unknown as Record<string, unknown>;
  return {
    available: Boolean(source.available),
    messageSize: Number(source.messageSize ?? source.message_size ?? 0)
  };
}

function normalizeGameCoordinatorMessage(result: NativeGameCoordinatorMessage): GameCoordinatorMessage {
  const source = result as unknown as Record<string, unknown>;
  return {
    result: Number(source.result ?? 0),
    messageType: Number(source.messageType ?? source.message_type ?? 0),
    messageSize: Number(source.messageSize ?? source.message_size ?? 0),
    data: (source.data as Buffer | null | undefined) ?? null
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
  initAnonymousUser,
  initSafe,
  runLegacyCallbacks,
  releaseCurrentThreadMemory,
  setTryCatchCallbacks,
  setMiniDumpComment,
  writeMiniDump,
  useBreakpadCrashHandler,
  setBreakpadAppId,
  getSteamId,
  getAuthTicketForWebApi,
  isSteamDeck,
  getAppId,
  isSteamInBigPictureMode,
  isOverlayEnabled,
  overlayNeedsPresent,
  isOverlayNeedsPresentPollingEnabled,
  getOverlayDiagnostics,
  getSteamworksEnum,
  getSteamworksEnumValue,
  onMicroTxnAuthorizationResponse,
  onLegacyMicroTxnAuthorizationResponse,
  onGameOverlayActivated,
  onSteamServersConnected,
  onSteamServerConnectFailure,
  onSteamServersDisconnected,
  onSteamCallback,
  activateOverlay,
  activateOverlayToWebPage,
  attachOverlayPresenter,
  openDialogOverlay,
  openWebOverlay,
  openFriendsOverlay,
  openProfileOverlay,
  openPlayersOverlay,
  openCommunityOverlay,
  openStatsOverlay,
  openAchievementsOverlay,
  openNativeUserOverlay,
  openUserOverlay,
  openUserEquivalentOverlay,
  openCheckoutOverlay,
  checkoutTargetFromResult,
  openDialogEquivalentOverlay,
  openNativeStoreOverlay,
  openStoreOverlay,
  openSteamOverlay,
  createElectronSteamOverlay,
  startNativeOverlaySession,
  activateDialogWithNativeSession,
  activateToWebPageWithNativeSession,
  activateToStoreWithNativeSession,
  SteamOverlayNativeHostUnavailableError,
  isSteamOverlayNativeHostUnavailableError,
  SteamOverlayWaitTimeoutError,
  isSteamOverlayWaitTimeoutError,
  SteamOverlayWaitAbortedError,
  isSteamOverlayWaitAbortedError,
  SteamOverlayWaitClosedError,
  isSteamOverlayWaitClosedError,
  openNativeOverlayProbeWindow,
  attachNativeOverlayHostView,
  pumpNativeOverlayProbeWindow,
  pumpNativeOverlayHostView,
  showNativeOverlayHostView,
  hideNativeOverlayHostView,
  setNativeOverlayHostInputPassthrough,
  setNativeOverlayHostOpacity,
  updateNativeOverlayHostFrame,
  closeNativeOverlayProbeWindow,
  detachNativeOverlayHostView,
  isNativeOverlayProbeWindowOpen,
  isNativeOverlayHostViewOpen,
  getMacWindowSnapshot,
  getMacOverlayEnvironment,
  isAchievementActivated,
  achievement,
  appTicket,
  apps,
  auth,
  callback,
  client,
  cloud,
  encryptedAppTicket,
  friends,
  gameServer,
  gameServerHttp,
  gameServerInventory,
  gameServerNetworking,
  gameServerNetworkingMessages,
  gameServerNetworkingSockets,
  gameServerStats,
  gameServerWorkshop,
  gameCoordinator,
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
  musicRemote,
  parties,
  parental,
  remotePlay,
  screenshots,
  stats,
  timeline,
  user,
  utils,
  video,
  webApi,
  workshop,
  buildSteamWebApiUrl,
  createSteamWebApiClient,
  requestSteamWebApi,
  electronConfigureSteamOverlay,
  electronEnableSteamOverlay,
  electronNativeOverlaySessionOptions,
  electronOverlayPresenterOptions,
  electronScrubSteamOverlayChildProcessEnv,
  steamStoreAppUrl,
  steamCommunityAppUrl,
  steamCommunityProfileUrl,
  steamCommunityPlayersUrl,
  steamCommunityStatsUrl,
  steamCommunityUserStatsUrl,
  steamCommunityAchievementsUrl,
  steamCheckoutTransactionUrl,
  STEAM_STORE_BASE_URL,
  STEAM_COMMUNITY_BASE_URL,
  STEAM_FRIENDS_OVERLAY_URL,
  STEAM_CHECKOUT_BASE_URL,
  SteamCallback,
  SteamworksEnums,
  GameCoordinatorResult
};

export default defaultExport;
