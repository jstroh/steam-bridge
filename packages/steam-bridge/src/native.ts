import fs from "node:fs";
import path from "node:path";

export interface NativeAuthTicket {
  cancel(): void;
  getBytes(): Buffer;
}

export interface NativeCallbackHandle {
  disconnect(): void;
}

export interface NativeSteamId {
  steamId64: bigint;
  steamId32: string;
  accountId: number;
}

export interface NativeGameServerInitOptions {
  ip?: number;
  gamePort?: number;
  game_port?: number;
  queryPort?: number;
  query_port?: number;
  serverMode?: number;
  server_mode?: number;
  version: string;
}

export interface NativeGameServerAuthTicket {
  data: Buffer;
  handle: number;
}

export interface NativeGameServerPublicIp {
  isSet?: boolean;
  is_set?: boolean;
  ipType?: number;
  ip_type?: number;
  ipv4?: number | null;
  ipv4Address?: string | null;
  ipv4_address?: string | null;
  ipv6?: Buffer | null;
}

export interface NativeGameServerOutgoingPacket {
  data: Buffer;
  ip: number;
  ipAddress?: string;
  ip_address?: string;
  port: number;
}

export interface NativeGameServerUserConnectResult {
  success: boolean;
  steamId?: NativeSteamId | null;
  steam_id?: NativeSteamId | null;
}

export interface NativeGameServerStatsResult {
  result: number;
  steamId?: NativeSteamId;
  steam_id?: NativeSteamId;
}

export interface NativeGameServerReputationResult {
  result: number;
  reputationScore?: number;
  reputation_score?: number;
  banned: boolean;
  bannedIp?: number;
  banned_ip?: number;
  bannedIpAddress?: string;
  banned_ip_address?: string;
  bannedPort?: number;
  banned_port?: number;
  bannedGameId?: bigint | string | number;
  banned_game_id?: bigint | string | number;
  banExpires?: number;
  ban_expires?: number;
}

export interface NativeGameServerAssociateWithClanResult {
  result: number;
}

export interface NativeGameServerPlayerCompatibilityResult {
  result: number;
  playersThatDontLikeCandidate?: number;
  players_that_dont_like_candidate?: number;
  playersThatCandidateDoesntLike?: number;
  players_that_candidate_doesnt_like?: number;
  clanPlayersThatDontLikeCandidate?: number;
  clan_players_that_dont_like_candidate?: number;
  candidate?: NativeSteamId;
}

export interface NativeOverlayDiagnostics {
  steamRunning: boolean;
  steamInstallPath?: string;
  appId: number;
  overlayEnabled: boolean;
  overlayNeedsPresent: boolean;
  steamDeck: boolean;
  bigPicture: boolean;
}

export interface NativeCloudFileInfo {
  name: string;
  size: bigint | string | number;
}

export interface NativeCloudQuota {
  totalBytes?: bigint | string | number;
  total_bytes?: bigint | string | number;
  availableBytes?: bigint | string | number;
  available_bytes?: bigint | string | number;
}

export interface NativeCloudLocalFileChange {
  name: string;
  changeType?: number;
  change_type?: number;
  pathType?: number;
  path_type?: number;
}

export interface NativeCloudFileShareResult {
  result: number;
  file: bigint | string | number;
  name: string;
}

export interface NativeCloudUgcDownloadProgress {
  downloadedBytes?: bigint | string | number;
  downloaded_bytes?: bigint | string | number;
  expectedBytes?: bigint | string | number;
  expected_bytes?: bigint | string | number;
}

export interface NativeCloudUgcDetails {
  appId?: number;
  app_id?: number;
  name: string;
  size: bigint | string | number;
  owner: NativeSteamId;
}

export interface NativeCloudUgcDownloadResult {
  result: number;
  file: bigint | string | number;
  appId?: number;
  app_id?: number;
  size: bigint | string | number;
  name: string;
  owner: NativeSteamId;
}

export interface NativeCloudLegacyPublishedFileResult {
  result: number;
  publishedFileId?: bigint | string | number;
  published_file_id?: bigint | string | number;
  needsToAcceptAgreement?: boolean | null;
  needs_to_accept_agreement?: boolean | null;
}

export interface NativeCloudLegacyPublishedFileIdResult {
  result: number;
  publishedFileId?: bigint | string | number;
  published_file_id?: bigint | string | number;
}

export interface NativeCloudLegacyPublishedFileActionResult extends NativeCloudLegacyPublishedFileIdResult {
  action: number;
}

export interface NativeCloudLegacyPublishedFileDetails extends NativeCloudLegacyPublishedFileIdResult {
  creatorAppId?: number;
  creator_app_id?: number;
  consumerAppId?: number;
  consumer_app_id?: number;
  title: string;
  description: string;
  file: bigint | string | number;
  previewFile?: bigint | string | number;
  preview_file?: bigint | string | number;
  owner: NativeSteamId;
  timeCreated?: number;
  time_created?: number;
  timeUpdated?: number;
  time_updated?: number;
  visibility: number;
  banned: boolean;
  tags: string[];
  tagsTruncated?: boolean;
  tags_truncated?: boolean;
  fileName?: string;
  file_name?: string;
  fileSize?: bigint | string | number;
  file_size?: bigint | string | number;
  previewFileSize?: bigint | string | number;
  preview_file_size?: bigint | string | number;
  url: string;
  fileType?: number;
  file_type?: number;
  acceptedForUse?: boolean;
  accepted_for_use?: boolean;
}

export interface NativeCloudLegacyEnumerateFilesResult {
  result: number;
  returnedResults?: number;
  returned_results?: number;
  totalResultCount?: number;
  total_result_count?: number;
  publishedFileIds?: Array<bigint | string | number>;
  published_file_ids?: Array<bigint | string | number>;
}

export interface NativeCloudLegacyEnumerateSubscribedFilesResult extends NativeCloudLegacyEnumerateFilesResult {
  subscribedTimes?: number[];
  subscribed_times?: number[];
}

export interface NativeCloudLegacyEnumerateWorkshopFilesResult extends NativeCloudLegacyEnumerateFilesResult {
  scores: number[];
  appId?: number;
  app_id?: number;
  startIndex?: number;
  start_index?: number;
}

export interface NativeCloudLegacyEnumerateUserActionFilesResult extends NativeCloudLegacyEnumerateFilesResult {
  action: number;
  updatedTimes?: number[];
  updated_times?: number[];
}

export interface NativeCloudLegacyPublishedItemVoteDetails extends NativeCloudLegacyPublishedFileIdResult {
  votesFor?: number;
  votes_for?: number;
  votesAgainst?: number;
  votes_against?: number;
  reports: number;
  score: number;
}

export interface NativeCloudLegacyUserVoteDetails extends NativeCloudLegacyPublishedFileIdResult {
  vote: number;
}

export interface NativeHttpRequestCompleted {
  request: number;
  contextValue?: bigint | string | number;
  context_value?: bigint | string | number;
  requestSuccessful?: boolean;
  request_successful?: boolean;
  statusCode?: number;
  status_code?: number;
  bodySize?: number;
  body_size?: number;
}

export interface NativeHttpRequestHeadersReceived {
  request: number;
  contextValue?: bigint | string | number;
  context_value?: bigint | string | number;
}

export interface NativePartyBeaconLocation {
  locationType?: number;
  location_type?: number;
  locationId?: bigint | string | number;
  location_id?: bigint | string | number;
}

export interface NativePartyBeaconDetails {
  beacon?: bigint | string | number;
  owner: NativeSteamId;
  location: NativePartyBeaconLocation;
  metadata: string;
}

export interface NativeJoinPartyResult {
  result: number;
  beacon?: bigint | string | number;
  owner: NativeSteamId;
  connectString?: string;
  connect_string?: string;
}

export interface NativeCreateBeaconResult {
  result: number;
  beacon?: bigint | string | number;
}

export interface NativeChangeNumOpenSlotsResult {
  result: number;
}

export interface NativeAppDlcData {
  appId?: number;
  app_id?: number;
  available: boolean;
  name: string;
}

export interface NativeAppDlcDownloadProgress {
  bytesDownloaded?: bigint | string | number;
  bytes_downloaded?: bigint | string | number;
  bytesTotal?: bigint | string | number;
  bytes_total?: bigint | string | number;
}

export interface NativeAppTimedTrialInfo {
  secondsAllowed?: number;
  seconds_allowed?: number;
  secondsPlayed?: number;
  seconds_played?: number;
}

export interface NativeAppBetaCounts {
  total: number;
  available: number;
  private: number;
}

export interface NativeAppBetaInfo {
  flags: number;
  buildId?: number;
  build_id?: number;
  name: string;
  description: string;
  lastUpdated?: number;
  last_updated?: number;
}

export interface NativeAppFileDetails {
  result: number;
  fileSize?: bigint | string | number;
  file_size?: bigint | string | number;
  sha: Buffer;
  shaHex?: string;
  sha_hex?: string;
  flags: number;
}

export interface NativeInventoryItemDetail {
  itemId?: bigint | string | number;
  item_id?: bigint | string | number;
  definition: number;
  quantity: number;
  flags: number;
}

export interface NativeInventoryItemQuantity {
  definition: number;
  quantity: number;
}

export interface NativeInventoryInstanceQuantity {
  itemId?: bigint | string | number;
  item_id?: bigint | string | number;
  quantity: number;
}

export interface NativeInventoryEligiblePromoItemDefIds {
  result: number;
  steamId?: NativeSteamId;
  steam_id?: NativeSteamId;
  numEligiblePromoItemDefs?: number;
  num_eligible_promo_item_defs?: number;
  cachedData?: boolean;
  cached_data?: boolean;
}

export interface NativeInventoryStartPurchaseResult {
  result: number;
  orderId?: bigint | string | number;
  order_id?: bigint | string | number;
  transactionId?: bigint | string | number;
  transaction_id?: bigint | string | number;
}

export interface NativeInventoryRequestPricesResult {
  result: number;
  currency: string;
}

export interface NativeInventoryPrice {
  definition: number;
  currentPrice?: bigint | string | number;
  current_price?: bigint | string | number;
  basePrice?: bigint | string | number;
  base_price?: bigint | string | number;
}

export interface NativeInputControllerInfo {
  handle: bigint;
  inputType: string;
}

export interface NativeAnalogActionVector {
  x: number;
  y: number;
}

export interface NativeInputDigitalActionData {
  state: boolean;
  active: boolean;
}

export interface NativeInputAnalogActionData {
  mode: number;
  x: number;
  y: number;
  active: boolean;
}

export interface NativeInputMotionData {
  rotationQuaternionX?: number;
  rotation_quaternion_x?: number;
  rotationQuaternionY?: number;
  rotation_quaternion_y?: number;
  rotationQuaternionZ?: number;
  rotation_quaternion_z?: number;
  rotationQuaternionW?: number;
  rotation_quaternion_w?: number;
  positionAccelerationX?: number;
  position_acceleration_x?: number;
  positionAccelerationY?: number;
  position_acceleration_y?: number;
  positionAccelerationZ?: number;
  position_acceleration_z?: number;
  rotationVelocityX?: number;
  rotation_velocity_x?: number;
  rotationVelocityY?: number;
  rotation_velocity_y?: number;
  rotationVelocityZ?: number;
  rotation_velocity_z?: number;
}

export interface NativeInputDeviceBindingRevision {
  major: number;
  minor: number;
}

export interface NativeInputActionEvent {
  controllerHandle?: bigint | string | number;
  controller_handle?: bigint | string | number;
  eventType?: number;
  event_type?: number;
  analogActionHandle?: bigint | string | number;
  analog_action_handle?: bigint | string | number;
  analogActionData?: NativeInputAnalogActionData;
  analog_action_data?: NativeInputAnalogActionData;
  digitalActionHandle?: bigint | string | number;
  digital_action_handle?: bigint | string | number;
  digitalActionData?: NativeInputDigitalActionData;
  digital_action_data?: NativeInputDigitalActionData;
}

export interface NativeP2PPacket {
  data: Buffer;
  size: number;
  steamId: NativeSteamId;
}

export interface NativeLegacyNetworkingP2PSessionState {
  connectionActive?: boolean;
  connection_active?: boolean;
  connecting: boolean;
  sessionError?: number;
  session_error?: number;
  usingRelay?: boolean;
  using_relay?: boolean;
  bytesQueuedForSend?: number;
  bytes_queued_for_send?: number;
  packetsQueuedForSend?: number;
  packets_queued_for_send?: number;
  remoteIp?: number;
  remote_ip?: number;
  remoteIpAddress?: string;
  remote_ip_address?: string;
  remotePort?: number;
  remote_port?: number;
}

export interface NativeLegacyNetworkingSocketData {
  data: Buffer;
  size: number;
}

export interface NativeLegacyNetworkingListenSocketAvailable {
  socket: number;
  size: number;
}

export interface NativeLegacyNetworkingListenSocketData {
  socket: number;
  data: Buffer;
  size: number;
}

export interface NativeLegacyNetworkingSocketInfo {
  remoteSteamId?: NativeSteamId;
  remote_steam_id?: NativeSteamId;
  socketStatus?: number;
  socket_status?: number;
  remoteIp?: number | null;
  remote_ip?: number | null;
  remoteIpAddress?: string | null;
  remote_ip_address?: string | null;
  remotePort?: number;
  remote_port?: number;
}

export interface NativeLegacyNetworkingListenSocketInfo {
  ip?: number | null;
  ipAddress?: string | null;
  ip_address?: string | null;
  port: number;
}

export interface NativeNetworkingIdentity {
  steamId64?: bigint | string | number;
  steam_id64?: bigint | string | number;
  text?: string;
  genericString?: string;
  generic_string?: string;
  localHost?: boolean;
  local_host?: boolean;
}

export interface NativeNetworkingIdentityInfo {
  identityType?: number;
  identity_type?: number;
  text: string;
  steamId64?: bigint | string | number | null;
  steam_id64?: bigint | string | number | null;
  genericString?: string | null;
  generic_string?: string | null;
  localHost?: boolean;
  local_host?: boolean;
  invalid: boolean;
  fakeIpType?: number;
  fake_ip_type?: number;
}

export interface NativeNetworkingMessage {
  data: Buffer;
  size: number;
  peer: NativeNetworkingIdentityInfo;
  connection: number;
  connectionUserData?: bigint | string | number;
  connection_user_data?: bigint | string | number;
  timeReceived?: bigint | string | number;
  time_received?: bigint | string | number;
  messageNumber?: bigint | string | number;
  message_number?: bigint | string | number;
  channel: number;
  flags: number;
  userData?: bigint | string | number;
  user_data?: bigint | string | number;
  lane: number;
}

export interface NativeNetworkingSocketOutgoingMessage {
  connection: number;
  data: Buffer;
  sendFlags?: number;
  send_flags?: number;
}

export interface NativeNetworkingConnectionRealTimeStatus {
  state: number;
  ping: number;
  connectionQualityLocal?: number;
  connection_quality_local?: number;
  connectionQualityRemote?: number;
  connection_quality_remote?: number;
  outPacketsPerSecond?: number;
  out_packets_per_second?: number;
  outBytesPerSecond?: number;
  out_bytes_per_second?: number;
  inPacketsPerSecond?: number;
  in_packets_per_second?: number;
  inBytesPerSecond?: number;
  in_bytes_per_second?: number;
  sendRateBytesPerSecond?: number;
  send_rate_bytes_per_second?: number;
  pendingUnreliable?: number;
  pending_unreliable?: number;
  pendingReliable?: number;
  pending_reliable?: number;
  sentUnackedReliable?: number;
  sent_unacked_reliable?: number;
  queueTime?: bigint | string | number;
  queue_time?: bigint | string | number;
  maxJitter?: number;
  max_jitter?: number;
}

export interface NativeNetworkingConnectionRealTimeLaneStatus {
  pendingUnreliable?: number;
  pending_unreliable?: number;
  pendingReliable?: number;
  pending_reliable?: number;
  sentUnackedReliable?: number;
  sent_unacked_reliable?: number;
  queueTime?: bigint | string | number;
  queue_time?: bigint | string | number;
}

export interface NativeNetworkingConnectionRealTimeStatusWithLanes {
  status?: NativeNetworkingConnectionRealTimeStatus;
  lanes: NativeNetworkingConnectionRealTimeLaneStatus[];
}

export interface NativeNetworkingMessagesSessionConnectionInfo {
  state: number;
  remoteIdentity?: NativeNetworkingIdentityInfo;
  remote_identity?: NativeNetworkingIdentityInfo;
  userData?: bigint | string | number;
  user_data?: bigint | string | number;
  listenSocket?: number;
  listen_socket?: number;
  remotePop?: number;
  remote_pop?: number;
  relayPop?: number;
  relay_pop?: number;
  endReason?: number;
  end_reason?: number;
  endDebug?: string;
  end_debug?: string;
  connectionDescription?: string;
  connection_description?: string;
  flags: number;
  quickStatus?: NativeNetworkingConnectionRealTimeStatus;
  quick_status?: NativeNetworkingConnectionRealTimeStatus;
}

export interface NativeNetworkingConnectionInfo {
  state: number;
  remoteIdentity?: NativeNetworkingIdentityInfo;
  remote_identity?: NativeNetworkingIdentityInfo;
  userData?: bigint | string | number;
  user_data?: bigint | string | number;
  listenSocket?: number;
  listen_socket?: number;
  remoteAddress?: NativeNetworkingIpAddressInfo;
  remote_address?: NativeNetworkingIpAddressInfo;
  remotePop?: number;
  remote_pop?: number;
  relayPop?: number;
  relay_pop?: number;
  endReason?: number;
  end_reason?: number;
  endDebug?: string;
  end_debug?: string;
  connectionDescription?: string;
  connection_description?: string;
  flags: number;
}

export interface NativeNetworkingSocketPair {
  connection1?: number;
  connection_1?: number;
  connection2?: number;
  connection_2?: number;
}

export interface NativeNetworkingSocketSendResult {
  result: number;
  messageNumber?: bigint | string | number;
  message_number?: bigint | string | number;
}

export interface NativeNetworkingFakeIpResult {
  result: number;
  identity: NativeNetworkingIdentityInfo;
  ipv4?: number;
  ipv4Address?: string;
  ipv4_address?: string;
  ports: number[];
}

export interface NativeNetworkingRemoteFakeIpResult {
  result: number;
  address?: NativeNetworkingIpAddressInfo | null;
}

export interface NativeNetworkingHostedDedicatedServerRouting {
  popId?: number;
  pop_id?: number;
  size: number;
  data: Buffer;
}

export interface NativeNetworkingHostedDedicatedServerAddressResult {
  result: number;
  routing?: NativeNetworkingHostedDedicatedServerRouting | null;
  debugMessage?: string;
  debug_message?: string;
}

export interface NativeNetworkingGameCoordinatorServerLoginResult {
  result: number;
  identity?: NativeNetworkingIdentityInfo | null;
  routing?: NativeNetworkingHostedDedicatedServerRouting | null;
  appId?: number;
  app_id?: number;
  timestamp: number;
  appData?: Buffer;
  app_data?: Buffer;
  signedBlob?: Buffer;
  signed_blob?: Buffer;
  debugMessage?: string;
  debug_message?: string;
}

export interface NativeNetworkingCertificateResult {
  success: boolean;
  data: Buffer;
  error: string;
}

export interface NativeNetworkingAuthenticationStatus {
  availability: number;
  debugMessage?: string;
  debug_message?: string;
}

export interface NativeNetworkingRelayNetworkStatus {
  availability: number;
  pingMeasurementInProgress?: boolean;
  ping_measurement_in_progress?: boolean;
  networkConfigAvailability?: number;
  network_config_availability?: number;
  anyRelayAvailability?: number;
  any_relay_availability?: number;
  debugMessage?: string;
  debug_message?: string;
}

export interface NativeNetworkingConfigValueResult {
  result: number;
  dataType?: number;
  data_type?: number;
  int32Value?: number;
  int32_value?: number;
  int64Value?: bigint | string | number;
  int64_value?: bigint | string | number;
  floatValue?: number;
  float_value?: number;
  stringValue?: string;
  string_value?: string;
}

export interface NativeNetworkingConfigValue {
  value: number;
  dataType?: number;
  data_type?: number;
  int32Value?: number | null;
  int32_value?: number | null;
  int64Value?: bigint | string | number | null;
  int64_value?: bigint | string | number | null;
  floatValue?: number | null;
  float_value?: number | null;
  stringValue?: string | null;
  string_value?: string | null;
}

export interface NativeNetworkingConfigValueInfo {
  value: number;
  name?: string | null;
  dataType?: number;
  data_type?: number;
  scope: number;
}

export interface NativeNetworkingDebugOutput {
  detailLevel?: number;
  detail_level?: number;
  message: string;
}

export interface NativeNetworkingPingLocation {
  location: string;
  ageSeconds?: number;
  age_seconds?: number;
}

export interface NativeNetworkingPingDataCenter {
  pingMs?: number;
  ping_ms?: number;
  viaRelayPop?: number;
  via_relay_pop?: number;
}

export interface NativeNetworkingIpAddress {
  text?: string;
  ipv4?: number;
  port?: number;
  localHost?: boolean;
  local_host?: boolean;
}

export interface NativeNetworkingIpAddressInfo {
  text: string;
  ipv4?: number | null;
  port?: number;
  ipv4Address?: string | null;
  ipv4_address?: string | null;
  isIpv4?: boolean;
  is_ipv4?: boolean;
  isLocalHost?: boolean;
  is_local_host?: boolean;
  isFakeIp?: boolean;
  is_fake_ip?: boolean;
  fakeIpType?: number;
  fake_ip_type?: number;
  ipv6AllZeros?: boolean;
  ipv6_all_zeros?: boolean;
}

export interface NativeNetworkingFakeIpIdentity {
  result: number;
  identity?: NativeNetworkingIdentityInfo | null;
}

export interface NativeLobbyResult {
  id: bigint;
}

export interface NativeMatchmakingFavoriteGame {
  appId?: number;
  app_id?: number;
  ip: number;
  ipAddress?: string;
  ip_address?: string;
  connPort?: number;
  conn_port?: number;
  queryPort?: number;
  query_port?: number;
  flags: number;
  lastPlayedOnServer?: number;
  last_played_on_server?: number;
}

export interface NativeMatchmakingServerAddress {
  ip: number;
  ipAddress?: string;
  ip_address?: string;
  connectionPort?: number;
  connection_port?: number;
  queryPort?: number;
  query_port?: number;
}

export interface NativeMatchmakingServerItem {
  address: NativeMatchmakingServerAddress;
  ping: number;
  hadSuccessfulResponse?: boolean;
  had_successful_response?: boolean;
  doNotRefresh?: boolean;
  do_not_refresh?: boolean;
  gameDir?: string;
  game_dir?: string;
  map: string;
  gameDescription?: string;
  game_description?: string;
  appId?: number;
  app_id?: number;
  players: number;
  maxPlayers?: number;
  max_players?: number;
  botPlayers?: number;
  bot_players?: number;
  password: boolean;
  secure: boolean;
  timeLastPlayed?: number;
  time_last_played?: number;
  serverVersion?: number;
  server_version?: number;
  name: string;
  gameTags?: string;
  game_tags?: string;
  steamId?: NativeSteamId;
  steam_id?: NativeSteamId;
}

export interface NativeMatchmakingServerListResult {
  response: number;
  responded: number[];
  failed: number[];
  servers: NativeMatchmakingServerItem[];
}

export interface NativeMatchmakingServerListRequest {
  handle: bigint | string | number;
  steamRequest?: bigint | string | number;
  steam_request?: bigint | string | number;
  appId?: number;
  app_id?: number;
  kind: string;
}

export interface NativeMatchmakingServerListRequestState extends NativeMatchmakingServerListRequest {
  completed: boolean;
  cancelled?: boolean;
  canceled?: boolean;
  response: number;
  responded: number[];
  failed: number[];
  refreshing: boolean;
  serverCount?: number;
  server_count?: number;
}

export interface NativeMatchmakingServerPingResult {
  responded: boolean;
  server?: NativeMatchmakingServerItem | null;
}

export interface NativeMatchmakingServerPlayer {
  name: string;
  score: number;
  timePlayed?: number;
  time_played?: number;
}

export interface NativeMatchmakingServerPlayersResult {
  responded: boolean;
  players: NativeMatchmakingServerPlayer[];
}

export interface NativeMatchmakingServerRule {
  name: string;
  value: string;
}

export interface NativeMatchmakingServerRulesResult {
  responded: boolean;
  rules: NativeMatchmakingServerRule[];
}

export interface NativeLobbyChatEntry {
  steamId?: NativeSteamId;
  steam_id?: NativeSteamId;
  data: Buffer;
  size: number;
  text: string;
  entryType?: number;
  entry_type?: number;
}

export interface NativeLobbyGameServer {
  ip: number;
  ipAddress?: string;
  ip_address?: string;
  port: number;
  steamId?: NativeSteamId;
  steam_id?: NativeSteamId;
}

export interface NativeWorkshopInstallInfo {
  folder: string;
  sizeOnDisk: bigint;
  timestamp: number;
}

export interface NativeWorkshopDownloadInfo {
  current: bigint;
  total: bigint;
}

export interface NativeUgcResult {
  itemId?: bigint;
  item_id?: bigint;
  needsToAcceptAgreement?: boolean;
  needs_to_accept_agreement?: boolean;
}

export interface NativeWorkshopFavoriteResult {
  result: number;
  itemId?: bigint | string | number;
  item_id?: bigint | string | number;
  wasAddRequest?: boolean;
  was_add_request?: boolean;
}

export interface NativeWorkshopSetUserItemVoteResult {
  result: number;
  itemId?: bigint | string | number;
  item_id?: bigint | string | number;
  voteUp?: boolean;
  vote_up?: boolean;
}

export interface NativeWorkshopGetUserItemVoteResult {
  result: number;
  itemId?: bigint | string | number;
  item_id?: bigint | string | number;
  votedUp?: boolean;
  voted_up?: boolean;
  votedDown?: boolean;
  voted_down?: boolean;
  voteSkipped?: boolean;
  vote_skipped?: boolean;
}

export interface NativeWorkshopSimpleResult {
  result: number;
}

export interface NativeWorkshopDependencyResult {
  result: number;
  itemId?: bigint | string | number;
  item_id?: bigint | string | number;
  childItemId?: bigint | string | number;
  child_item_id?: bigint | string | number;
}

export interface NativeWorkshopAppDependencyResult {
  result: number;
  itemId?: bigint | string | number;
  item_id?: bigint | string | number;
  appId?: number;
  app_id?: number;
}

export interface NativeWorkshopAppDependenciesResult {
  result: number;
  itemId?: bigint | string | number;
  item_id?: bigint | string | number;
  appIds?: number[];
  app_ids?: number[];
  numAppDependencies?: number;
  num_app_dependencies?: number;
  totalNumAppDependencies?: number;
  total_num_app_dependencies?: number;
}

export interface NativeWorkshopDeleteItemResult {
  result: number;
  itemId?: bigint | string | number;
  item_id?: bigint | string | number;
}

export interface NativeWorkshopEulaStatus {
  result: number;
  appId?: number;
  app_id?: number;
  version: number;
  actionTime?: number;
  action_time?: number;
  accepted: boolean;
  needsAction?: boolean;
  needs_action?: boolean;
}

export interface NativeUpdateProgress {
  status: number;
  progress: bigint;
  total: bigint;
}

export interface NativeWorkshopItem {
  [key: string]: unknown;
}

export interface NativeWorkshopItemsResult {
  items: Array<NativeWorkshopItem | null | undefined>;
  returnedResults?: number;
  returned_results?: number;
  totalResults?: number;
  total_results?: number;
  wasCached?: boolean;
  was_cached?: boolean;
  nextCursor?: string;
  next_cursor?: string;
}

export interface NativeSteamClientLocalUser {
  user: number;
  pipe: number;
}

export interface NativeFriendGameInfo {
  gameId?: bigint | string | number;
  game_id?: bigint | string | number;
  gameIp?: number;
  game_ip?: number;
  gamePort?: number;
  game_port?: number;
  queryPort?: number;
  query_port?: number;
  lobby?: bigint | string | number;
}

export interface NativeFriendMessage {
  data: Buffer;
  size: number;
  text: string;
  entryType?: number;
  entry_type?: number;
}

export interface NativeClanChatMessage extends NativeFriendMessage {
  chatter: NativeSteamId;
}

export interface NativeFriendsGroupInfo {
  id: number;
  name: string;
  members: NativeSteamId[];
}

export interface NativeEquippedProfileItemsResult {
  result: number;
  steamId?: NativeSteamId;
  steam_id?: NativeSteamId;
  hasAnimatedAvatar?: boolean;
  has_animated_avatar?: boolean;
  hasAvatarFrame?: boolean;
  has_avatar_frame?: boolean;
  hasProfileModifier?: boolean;
  has_profile_modifier?: boolean;
  hasProfileBackground?: boolean;
  has_profile_background?: boolean;
  hasMiniProfileBackground?: boolean;
  has_mini_profile_background?: boolean;
  fromCache?: boolean;
  from_cache?: boolean;
}

export interface NativeClanActivityCounts {
  online: number;
  inGame?: number;
  in_game?: number;
  chatting: number;
}

export interface NativeDownloadClanActivityCountsResult {
  success: boolean;
}

export interface NativeClanOfficerListResult {
  clan: NativeSteamId;
  officers: number;
  success: boolean;
}

export interface NativeClanChatJoinResult {
  clanChat?: NativeSteamId;
  clan_chat?: NativeSteamId;
  response: number;
}

export interface NativeFollowerCountResult {
  steamId?: NativeSteamId;
  steam_id?: NativeSteamId;
  result: number;
  count: number;
}

export interface NativeIsFollowingResult {
  steamId?: NativeSteamId;
  steam_id?: NativeSteamId;
  result: number;
  isFollowing?: boolean;
  is_following?: boolean;
}

export interface NativeFollowingListResult {
  result: number;
  steamIds?: NativeSteamId[];
  steam_ids?: NativeSteamId[];
  returnedResults?: number;
  returned_results?: number;
  totalResults?: number;
  total_results?: number;
}

export interface NativeVideoBroadcastStatus {
  broadcasting: boolean;
  viewers: number;
}

export interface NativeLeaderboardFindResult {
  leaderboard?: bigint | string | number;
  found?: boolean;
}

export interface NativeLeaderboardEntry {
  steamId?: NativeSteamId;
  steam_id?: NativeSteamId;
  globalRank?: number;
  global_rank?: number;
  score: number;
  details: number[];
  ugc?: bigint | string | number;
}

export interface NativeLeaderboardScoresDownloaded {
  leaderboard?: bigint | string | number;
  entriesHandle?: bigint | string | number;
  entries_handle?: bigint | string | number;
  entryCount?: number;
  entry_count?: number;
  entries: NativeLeaderboardEntry[];
}

export interface NativeLeaderboardScoreUploaded {
  success: boolean;
  leaderboard?: bigint | string | number;
  score: number;
  scoreChanged?: boolean;
  score_changed?: boolean;
  globalRankNew?: number;
  global_rank_new?: number;
  globalRankPrevious?: number;
  global_rank_previous?: number;
}

export interface NativeLeaderboardUgcSetResult {
  result: number;
  leaderboard?: bigint | string | number;
}

export interface NativeAchievementUnlockTime {
  achieved: boolean;
  unlockTime?: number;
  unlock_time?: number;
}

export interface NativeUserStatsReceivedResult {
  gameId?: bigint | string | number;
  game_id?: bigint | string | number;
  result: number;
  steamId?: NativeSteamId;
  steam_id?: NativeSteamId;
}

export interface NativeNumberOfCurrentPlayersResult {
  success: boolean;
  players: number;
}

export interface NativeGlobalAchievementPercentagesReady {
  gameId?: bigint | string | number;
  game_id?: bigint | string | number;
  result: number;
}

export interface NativeGlobalStatsReceivedResult {
  gameId?: bigint | string | number;
  game_id?: bigint | string | number;
  result: number;
}

export interface NativeGlobalAchievementInfo {
  iterator: number;
  name: string;
  percent: number;
  achieved: boolean;
}

export interface NativeAchievementProgressLimitsInt {
  min: number;
  max: number;
}

export interface NativeAchievementProgressLimitsFloat {
  min: number;
  max: number;
}

export interface NativeTimelineEventRecordingExists {
  event?: bigint | string | number;
  recordingExists?: boolean;
  recording_exists?: boolean;
}

export interface NativeTimelineGamePhaseRecordingExists {
  phaseId?: string;
  phase_id?: string;
  recordingMs?: bigint | string | number;
  recording_ms?: bigint | string | number;
  longestClipMs?: bigint | string | number;
  longest_clip_ms?: bigint | string | number;
  clipCount?: number;
  clip_count?: number;
  screenshotCount?: number;
  screenshot_count?: number;
}

export interface NativeRemotePlayResolution {
  width: number;
  height: number;
}

export interface NativeRemotePlaySessionInfo {
  id: number;
  remotePlayTogether?: boolean;
  remote_play_together?: boolean;
  steamId?: NativeSteamId;
  steam_id?: NativeSteamId;
  guestId?: number;
  guest_id?: number;
  smallAvatar?: number;
  small_avatar?: number;
  mediumAvatar?: number;
  medium_avatar?: number;
  largeAvatar?: number;
  large_avatar?: number;
  clientName?: string;
  client_name?: string;
  clientFormFactor?: number;
  client_form_factor?: number;
  resolution?: NativeRemotePlayResolution | null;
}

export interface NativeRemotePlayInputEvent {
  sessionId?: number;
  session_id?: number;
  inputType?: number;
  input_type?: number;
  absolute?: boolean | null;
  normalizedX?: number | null;
  normalized_x?: number | null;
  normalizedY?: number | null;
  normalized_y?: number | null;
  deltaX?: number | null;
  delta_x?: number | null;
  deltaY?: number | null;
  delta_y?: number | null;
  mouseButton?: number | null;
  mouse_button?: number | null;
  wheelDirection?: number | null;
  wheel_direction?: number | null;
  wheelAmount?: number | null;
  wheel_amount?: number | null;
  scancode?: number | null;
  modifiers?: number | null;
  keycode?: number | null;
}

export interface NativeUtilsImageSize {
  width: number;
  height: number;
}

export interface NativeUtilsApiCallCompletion {
  completed: boolean;
  failed: boolean;
}

export interface NativeUtilsApiCallResult {
  ok: boolean;
  failed: boolean;
  data?: Buffer | null;
}

export interface NativeUtilsWarningMessage {
  severity: number;
  message: string;
}

export interface NativeUtilsFilteredText {
  filtered: string;
  charactersFiltered?: number;
  characters_filtered?: number;
}

export interface NativeUserVoiceAvailable {
  result: number;
  compressedBytes?: number;
  compressed_bytes?: number;
  uncompressedBytes?: number;
  uncompressed_bytes?: number;
}

export interface NativeUserVoiceData {
  result: number;
  compressed?: Buffer | null;
  uncompressed?: Buffer | null;
  compressedBytes?: number;
  compressed_bytes?: number;
  uncompressedBytes?: number;
  uncompressed_bytes?: number;
}

export interface NativeUserEncryptedAppTicket {
  result: number;
  ticket?: Buffer | null;
}

export interface NativeUserMarketEligibility {
  allowed: boolean;
  notAllowedReason?: number;
  not_allowed_reason?: number;
  allowedAtTime?: number;
  allowed_at_time?: number;
  steamGuardRequiredDays?: number;
  steam_guard_required_days?: number;
  newDeviceCooldownDays?: number;
  new_device_cooldown_days?: number;
}

export interface NativeUserDurationControl {
  result: number;
  appId?: number;
  app_id?: number;
  applicable: boolean;
  secondsLast5h?: number;
  seconds_last_5h?: number;
  progress: number;
  notification: number;
  secondsToday?: number;
  seconds_today?: number;
  secondsRemaining?: number;
  seconds_remaining?: number;
}

export interface NativeBinding {
  init(appId: number): void;
  shutdown(): void;
  restartAppIfNecessary(appId: number): boolean;
  isSteamRunning(): boolean;
  getSteamInstallPath(): string | undefined;
  runCallbacks(): void;

  gameServerInit(options: NativeGameServerInitOptions): void;
  gameServerShutdown(): void;
  gameServerRunCallbacks(): void;
  gameServerIsSecure(): boolean;
  gameServerGetSteamId(): NativeSteamId;
  gameServerSetProduct(product: string): void;
  gameServerSetGameDescription(description: string): void;
  gameServerSetModDir(modDir: string): void;
  gameServerSetDedicatedServer(dedicated: boolean): void;
  gameServerLogOn(token: string): void;
  gameServerLogOnAnonymous(): void;
  gameServerLogOff(): void;
  gameServerIsLoggedOn(): boolean;
  gameServerInterfaceIsSecure(): boolean;
  gameServerGetInterfaceSteamId(): NativeSteamId;
  gameServerWasRestartRequested(): boolean;
  gameServerSetMaxPlayerCount(playersMax: number): void;
  gameServerSetBotPlayerCount(botPlayers: number): void;
  gameServerSetServerName(name: string): void;
  gameServerSetMapName(name: string): void;
  gameServerSetPasswordProtected(passwordProtected: boolean): void;
  gameServerSetSpectatorPort(port: number): void;
  gameServerSetSpectatorServerName(name: string): void;
  gameServerClearAllKeyValues(): void;
  gameServerSetKeyValue(key: string, value: string): void;
  gameServerSetGameTags(tags: string): void;
  gameServerSetGameData(data: string): void;
  gameServerSetRegion(region: string): void;
  gameServerSetAdvertiseServerActive(active: boolean): void;
  gameServerGetAuthSessionTicket(identity?: NativeNetworkingIdentity | null, maxBytes?: number): NativeGameServerAuthTicket;
  gameServerBeginAuthSession(ticket: Buffer, steamId64: bigint): number;
  gameServerEndAuthSession(steamId64: bigint): void;
  gameServerCancelAuthTicket(authTicket: number): void;
  gameServerUserHasLicenseForApp(steamId64: bigint, appId: number): number;
  gameServerRequestUserGroupStatus(steamId64: bigint, groupId64: bigint): boolean;
  gameServerGetGameplayStats(): void;
  gameServerGetServerReputation(): Promise<NativeGameServerReputationResult>;
  gameServerAssociateWithClan(clanId64: bigint): Promise<NativeGameServerAssociateWithClanResult>;
  gameServerComputeNewPlayerCompatibility(steamId64: bigint): Promise<NativeGameServerPlayerCompatibilityResult>;
  gameServerGetPublicIp(): NativeGameServerPublicIp;
  gameServerHandleIncomingPacket(data: Buffer, srcIp: number, srcPort: number): boolean;
  gameServerGetNextOutgoingPacket(maxBytes?: number): NativeGameServerOutgoingPacket | null | undefined;
  gameServerSendUserConnectAndAuthenticateDeprecated(clientIp: number, authBlob: Buffer): NativeGameServerUserConnectResult;
  gameServerCreateUnauthenticatedUserConnection(): NativeSteamId;
  gameServerSendUserDisconnectDeprecated(steamId64: bigint): void;
  gameServerUpdateUserData(steamId64: bigint, playerName: string, score: number): boolean;
  gameServerStatsRequestUserStats(steamId64: bigint): Promise<NativeGameServerStatsResult>;
  gameServerStatsGetUserInt(steamId64: bigint, name: string): number | null | undefined;
  gameServerStatsGetUserFloat(steamId64: bigint, name: string): number | null | undefined;
  gameServerStatsGetUserAchievement(steamId64: bigint, name: string): boolean | null | undefined;
  gameServerStatsSetUserInt(steamId64: bigint, name: string, value: number): boolean;
  gameServerStatsSetUserFloat(steamId64: bigint, name: string, value: number): boolean;
  gameServerStatsUpdateUserAvgRate(steamId64: bigint, name: string, countThisSession: number, sessionLength: number): boolean;
  gameServerStatsSetUserAchievement(steamId64: bigint, name: string): boolean;
  gameServerStatsClearUserAchievement(steamId64: bigint, name: string): boolean;
  gameServerStatsStoreUserStats(steamId64: bigint): Promise<NativeGameServerStatsResult>;

  getSteamId(): NativeSteamId;
  getAuthTicketForWebApi(identity: string, timeoutSeconds?: number): Promise<NativeAuthTicket>;
  authGetSessionTicketWithSteamId(steamId64: bigint, timeoutSeconds?: number): Promise<NativeAuthTicket>;
  authGetSessionTicketWithIp(ip: string, timeoutSeconds?: number): Promise<NativeAuthTicket>;
  userStartVoiceRecording(): void;
  userStopVoiceRecording(): void;
  userGetAvailableVoice(sampleRate?: number): NativeUserVoiceAvailable;
  userGetVoice(wantCompressed?: boolean, compressedBufferBytes?: number, wantUncompressed?: boolean, uncompressedBufferBytes?: number, sampleRate?: number): NativeUserVoiceData;
  userDecompressVoice(compressed: Buffer, maxBytes?: number, desiredSampleRate?: number): NativeUserVoiceData;
  userGetVoiceOptimalSampleRate(): number;
  userGetUserDataFolder(): string | null | undefined;
  userTrackAppUsageEvent(gameId: bigint, event: number, extraInfo?: string | null): void;
  userBeginAuthSession(ticket: Buffer, steamId64: bigint): number;
  userEndAuthSession(steamId64: bigint): void;
  userCancelAuthTicket(authTicket: number): void;
  userHasLicenseForApp(steamId64: bigint, appId: number): number;
  userIsBehindNat(): boolean;
  userAdvertiseGame(steamId64: bigint, ip: number, port: number): void;
  userRequestEncryptedAppTicket(dataToInclude?: Buffer | null, timeoutSeconds?: number): Promise<NativeUserEncryptedAppTicket>;
  userGetEncryptedAppTicket(maxBytes?: number): Buffer | null | undefined;
  userGetGameBadgeLevel(series: number, foil: boolean): number;
  userGetPlayerSteamLevel(): number;
  userRequestStoreAuthUrl(redirectUrl: string, timeoutSeconds?: number): Promise<string>;
  userIsPhoneVerified(): boolean;
  userIsTwoFactorEnabled(): boolean;
  userIsPhoneIdentifying(): boolean;
  userIsPhoneRequiringVerification(): boolean;
  userGetMarketEligibility(timeoutSeconds?: number): Promise<NativeUserMarketEligibility>;
  userGetDurationControl(timeoutSeconds?: number): Promise<NativeUserDurationControl>;
  userSetDurationControlOnlineState(onlineState: number): boolean;

  isSteamDeck(): boolean;
  getAppId(): number;
  isSteamInBigPictureMode(): boolean;
  isOverlayEnabled(): boolean;
  overlayNeedsPresent(): boolean;
  getOverlayDiagnostics(): NativeOverlayDiagnostics;
  utilsGetServerRealTime(): number;
  utilsGetSecondsSinceAppActive(): number;
  utilsGetSecondsSinceComputerActive(): number;
  utilsGetConnectedUniverse(): number;
  utilsGetSteamUiLanguage(): string;
  utilsGetImageSize(image: number): NativeUtilsImageSize | null | undefined;
  utilsGetImageRgba(image: number): Buffer | null | undefined;
  utilsGetCurrentBatteryPower(): number;
  utilsGetIpcCallCount(): number;
  utilsRegisterWarningMessageHook(handler: (event: NativeUtilsWarningMessage) => void): NativeCallbackHandle;
  utilsIsApiCallCompleted(apiCall: bigint): NativeUtilsApiCallCompletion;
  utilsGetApiCallFailureReason(apiCall: bigint): number;
  utilsGetApiCallResult(apiCall: bigint, expectedCallback: number, byteLength: number): NativeUtilsApiCallResult;
  utilsCheckFileSignature(fileName: string, timeoutSeconds?: number): Promise<number>;
  utilsSetOverlayNotificationPosition(position: number): void;
  utilsSetOverlayNotificationInset(horizontal: number, vertical: number): void;
  utilsIsSteamRunningInVr(): boolean;
  utilsStartVrDashboard(): void;
  utilsIsVrHeadsetStreamingEnabled(): boolean;
  utilsSetVrHeadsetStreamingEnabled(enabled: boolean): void;
  utilsIsSteamChinaLauncher(): boolean;
  utilsInitFilterText(options?: number): boolean;
  utilsFilterText(context: number, sourceSteamId64: bigint, input: string, maxBytes?: number): NativeUtilsFilteredText;
  utilsGetIpv6ConnectivityState(protocol: number): number;
  utilsSetGameLauncherMode(enabled: boolean): void;
  utilsDismissFloatingGamepadTextInput(): boolean;
  utilsDismissGamepadTextInput(): boolean;
  utilsShowGamepadTextInput(inputMode: number, inputLineMode: number, description: string, maxCharacters: number, existingText?: string | null, timeoutSeconds?: number): Promise<string | null | undefined>;
  utilsShowFloatingGamepadTextInput(mode: number, x: number, y: number, width: number, height: number): boolean;

  registerSteamCallback(callback: number, handler: (event: unknown) => void): NativeCallbackHandle;
  registerMicroTxnAuthorizationResponse(handler: (event: unknown) => void): NativeCallbackHandle;
  registerGameOverlayActivated(handler: (event: unknown) => void): NativeCallbackHandle;

  activateOverlay(dialog?: string): void;
  activateOverlayToWebPage(url: string, modal?: boolean): void;
  overlayActivateDialogToUser(dialog: string, steamId64: bigint): void;
  overlayActivateInviteDialog(lobbyId: bigint): void;
  overlayActivateToStore(appId: number, flag: number): void;

  openNativeOverlayProbeWindow(title?: string): void;
  attachNativeOverlayHostView(nativeWindowHandle: Buffer): void;
  pumpNativeOverlayProbeWindow(): void;
  pumpNativeOverlayHostView(): void;
  showNativeOverlayHostView(): void;
  hideNativeOverlayHostView(): void;
  updateNativeOverlayHostFrame(frame: Buffer, width: number, height: number): void;
  closeNativeOverlayProbeWindow(): void;
  detachNativeOverlayHostView(): void;
  isNativeOverlayProbeWindowOpen(): boolean;
  isNativeOverlayHostViewOpen(): boolean;
  getMacWindowSnapshot(appId?: number): string | undefined;

  isAchievementActivated(name: string): boolean;
  achievementActivate(name: string): boolean;
  achievementClear(name: string): boolean;
  achievementNames(): string[];

  appsIsSubscribedApp(appId: number): boolean;
  appsIsAppInstalled(appId: number): boolean;
  appsIsDlcInstalled(appId: number): boolean;
  appsIsSubscribedFromFreeWeekend(): boolean;
  appsIsVacBanned(): boolean;
  appsIsCybercafe(): boolean;
  appsIsLowViolence(): boolean;
  appsIsSubscribed(): boolean;
  appsAppBuildId(): number;
  appsAppInstallDir(appId: number): string;
  appsAppOwner(): NativeSteamId;
  appsAvailableGameLanguages(): string[];
  appsCurrentGameLanguage(): string;
  appsCurrentBetaName(): string | null | undefined;
  appsEarliestPurchaseUnixTime(appId: number): number;
  appsDlcCount(): number;
  appsDlcDataByIndex(index: number): NativeAppDlcData | null | undefined;
  appsInstallDlc(appId: number): void;
  appsUninstallDlc(appId: number): void;
  appsRequestAppProofOfPurchaseKey(appId: number): void;
  appsRequestAllProofOfPurchaseKeys(): void;
  appsMarkContentCorrupt(missingFilesOnly: boolean): boolean;
  appsInstalledDepots(appId: number, maxDepots?: number): number[];
  appsLaunchQueryParam(key: string): string;
  appsDlcDownloadProgress(appId: number): NativeAppDlcDownloadProgress | null | undefined;
  appsLaunchCommandLine(maxBytes?: number): string;
  appsIsSubscribedFromFamilySharing(): boolean;
  appsTimedTrial(): NativeAppTimedTrialInfo | null | undefined;
  appsSetDlcContext(appId: number): boolean;
  appsBetaCounts(): NativeAppBetaCounts;
  appsBetaInfo(index: number): NativeAppBetaInfo | null | undefined;
  appsSetActiveBeta(betaName: string): boolean;
  appsGetFileDetails(fileName: string, timeoutSeconds?: number): Promise<NativeAppFileDetails>;

  localplayerGetName(): string;
  localplayerGetLevel(): number;
  localplayerGetIpCountry(): string;
  localplayerSetRichPresence(key: string, value?: string | null): void;

  friendsGetPersonaName(): string;
  friendsGetPersonaState(): number;
  friendsGetFriendCount(friendFlags?: number | null): number;
  friendsGetFriendByIndex(index: number, friendFlags?: number | null): NativeSteamId;
  friendsGetFriends(friendFlags?: number | null): NativeSteamId[];
  friendsHasFriend(steamId64: bigint, friendFlags?: number | null): boolean;
  friendsGetFriendRelationship(steamId64: bigint): number;
  friendsGetFriendPersonaState(steamId64: bigint): number;
  friendsGetFriendPersonaName(steamId64: bigint): string;
  friendsGetFriendPersonaNameHistory(steamId64: bigint, index: number): string;
  friendsGetFriendSteamLevel(steamId64: bigint): number;
  friendsGetPlayerNickname(steamId64: bigint): string;
  friendsGetFriendGamePlayed(steamId64: bigint): NativeFriendGameInfo | null | undefined;
  friendsGetSmallFriendAvatar(steamId64: bigint): number;
  friendsGetMediumFriendAvatar(steamId64: bigint): number;
  friendsGetLargeFriendAvatar(steamId64: bigint): number;
  friendsRequestUserInformation(steamId64: bigint, nameOnly: boolean): boolean;
  friendsGetFriendsGroups(): NativeFriendsGroupInfo[];
  friendsGetClanCount(): number;
  friendsGetClanByIndex(index: number): NativeSteamId;
  friendsGetClans(): NativeSteamId[];
  friendsGetClanName(clanId64: bigint): string;
  friendsGetClanTag(clanId64: bigint): string;
  friendsGetClanActivityCounts(clanId64: bigint): NativeClanActivityCounts | null | undefined;
  friendsDownloadClanActivityCounts(clanIds64: bigint[], timeoutSeconds?: number): Promise<NativeDownloadClanActivityCountsResult>;
  friendsGetFriendCountFromSource(sourceId64: bigint): number;
  friendsGetFriendFromSourceByIndex(sourceId64: bigint, index: number): NativeSteamId;
  friendsGetFriendsFromSource(sourceId64: bigint): NativeSteamId[];
  friendsIsUserInSource(steamId64: bigint, sourceId64: bigint): boolean;
  friendsRequestClanOfficerList(clanId64: bigint): Promise<NativeClanOfficerListResult>;
  friendsGetClanOwner(clanId64: bigint): NativeSteamId;
  friendsGetClanOfficerCount(clanId64: bigint): number;
  friendsGetClanOfficerByIndex(clanId64: bigint, index: number): NativeSteamId;
  friendsSetPlayedWith(steamId64: bigint): void;
  friendsSetInGameVoiceSpeaking(steamId64: bigint, speaking: boolean): void;
  friendsClearRichPresence(): void;
  friendsGetFriendRichPresence(steamId64: bigint, key: string): string;
  friendsGetFriendRichPresenceKeys(steamId64: bigint): string[];
  friendsRequestFriendRichPresence(steamId64: bigint): void;
  friendsInviteUserToGame(steamId64: bigint, connectString: string): boolean;
  friendsGetCoplayFriendCount(): number;
  friendsGetCoplayFriend(index: number): NativeSteamId;
  friendsGetCoplayFriends(): NativeSteamId[];
  friendsGetFriendCoplayTime(steamId64: bigint): number;
  friendsGetFriendCoplayGame(steamId64: bigint): number;
  friendsJoinClanChatRoom(clanId64: bigint): Promise<NativeClanChatJoinResult>;
  friendsLeaveClanChatRoom(clanId64: bigint): boolean;
  friendsGetClanChatMemberCount(clanChatId64: bigint): number;
  friendsGetChatMemberByIndex(clanChatId64: bigint, index: number): NativeSteamId;
  friendsSendClanChatMessage(clanChatId64: bigint, text: string): boolean;
  friendsGetClanChatMessage(clanChatId64: bigint, messageId: number, maxBytes?: number): NativeClanChatMessage | null | undefined;
  friendsIsClanChatAdmin(clanChatId64: bigint, steamId64: bigint): boolean;
  friendsIsClanChatWindowOpenInSteam(clanChatId64: bigint): boolean;
  friendsOpenClanChatWindowInSteam(clanChatId64: bigint): boolean;
  friendsCloseClanChatWindowInSteam(clanChatId64: bigint): boolean;
  friendsSetListenForFriendsMessages(enabled: boolean): boolean;
  friendsReplyToFriendMessage(steamId64: bigint, message: string): boolean;
  friendsGetFriendMessage(steamId64: bigint, messageId: number, maxBytes?: number): NativeFriendMessage | null | undefined;
  friendsGetFollowerCount(steamId64: bigint): Promise<NativeFollowerCountResult>;
  friendsIsFollowing(steamId64: bigint): Promise<NativeIsFollowingResult>;
  friendsEnumerateFollowingList(startIndex: number): Promise<NativeFollowingListResult>;
  friendsIsClanPublic(clanId64: bigint): boolean;
  friendsIsClanOfficialGameGroup(clanId64: bigint): boolean;
  friendsGetNumChatsWithUnreadPriorityMessages(): number;
  friendsRegisterProtocolInOverlayBrowser(protocol: string): boolean;
  friendsActivateGameOverlayRemotePlayTogetherInviteDialog(lobbyId64: bigint): void;
  friendsActivateGameOverlayInviteDialogConnectString(connectString: string): void;
  friendsRequestEquippedProfileItems(steamId64: bigint): Promise<NativeEquippedProfileItemsResult>;
  friendsHasEquippedProfileItem(steamId64: bigint, itemType: number): boolean;
  friendsGetProfileItemPropertyString(steamId64: bigint, itemType: number, property: number): string;
  friendsGetProfileItemPropertyUint(steamId64: bigint, itemType: number, property: number): number;

  cloudIsEnabledForAccount(): boolean;
  cloudIsEnabledForApp(): boolean;
  cloudSetEnabledForApp(enabled: boolean): void;
  cloudReadFile(name: string): string;
  cloudWriteFile(name: string, content: string): boolean;
  cloudWriteFileAsync(name: string, data: Buffer, timeoutSeconds?: number): Promise<number>;
  cloudReadFileAsync(name: string, offset?: number, bytesToRead?: number, timeoutSeconds?: number): Promise<Buffer>;
  cloudShareFile(name: string, timeoutSeconds?: number): Promise<NativeCloudFileShareResult>;
  cloudDeleteFile(name: string): boolean;
  cloudForgetFile(name: string): boolean;
  cloudFileExists(name: string): boolean;
  cloudFilePersisted(name: string): boolean;
  cloudGetFileSize(name: string): bigint | string | number | null | undefined;
  cloudGetFileTimestamp(name: string): bigint | string | number | null | undefined;
  cloudGetSyncPlatforms(name: string): number;
  cloudSetSyncPlatforms(name: string, platforms: number): boolean;
  cloudGetQuota(): NativeCloudQuota | null | undefined;
  cloudListFiles(): NativeCloudFileInfo[];
  cloudGetLocalFileChangeCount(): number;
  cloudGetLocalFileChange(index: number): NativeCloudLocalFileChange | null | undefined;
  cloudGetLocalFileChanges(): NativeCloudLocalFileChange[];
  cloudBeginFileWriteBatch(): boolean;
  cloudEndFileWriteBatch(): boolean;
  cloudOpenFileWriteStream(name: string): bigint | string | number | null | undefined;
  cloudWriteFileStreamChunk(handle: bigint, data: Buffer): boolean;
  cloudCloseFileWriteStream(handle: bigint): boolean;
  cloudCancelFileWriteStream(handle: bigint): boolean;
  cloudDownloadUgc(file: bigint, priority?: number, timeoutSeconds?: number): Promise<NativeCloudUgcDownloadResult>;
  cloudDownloadUgcToLocation(file: bigint, location: string, priority?: number, timeoutSeconds?: number): Promise<NativeCloudUgcDownloadResult>;
  cloudGetUgcDownloadProgress(file: bigint): NativeCloudUgcDownloadProgress | null | undefined;
  cloudGetUgcDetails(file: bigint): NativeCloudUgcDetails | null | undefined;
  cloudReadUgc(file: bigint, bytesToRead: number, offset?: number, action?: number): Buffer | null | undefined;
  cloudGetCachedUgcCount(): number;
  cloudGetCachedUgcHandle(index: number): bigint | string | number | null | undefined;
  cloudGetCachedUgcHandles(): Array<bigint | string | number>;
  cloudLegacyPublishWorkshopFile(filePath: string, previewPath: string, consumerAppId: number, title: string, description: string, visibility: number, tags: string[], fileType: number, timeoutSeconds?: number): Promise<NativeCloudLegacyPublishedFileResult>;
  cloudLegacyPublishVideo(provider: number, videoAccount: string, videoIdentifier: string, previewPath: string, consumerAppId: number, title: string, description: string, visibility: number, tags: string[], timeoutSeconds?: number): Promise<NativeCloudLegacyPublishedFileResult>;
  cloudLegacyCreatePublishedFileUpdateRequest(publishedFileId: bigint): bigint | string | number | null | undefined;
  cloudLegacyUpdatePublishedFileFile(handle: bigint, filePath: string): boolean;
  cloudLegacyUpdatePublishedFilePreviewFile(handle: bigint, previewPath: string): boolean;
  cloudLegacyUpdatePublishedFileTitle(handle: bigint, title: string): boolean;
  cloudLegacyUpdatePublishedFileDescription(handle: bigint, description: string): boolean;
  cloudLegacyUpdatePublishedFileVisibility(handle: bigint, visibility: number): boolean;
  cloudLegacyUpdatePublishedFileTags(handle: bigint, tags: string[]): boolean;
  cloudLegacyUpdatePublishedFileSetChangeDescription(handle: bigint, changeDescription: string): boolean;
  cloudLegacyCommitPublishedFileUpdate(handle: bigint, timeoutSeconds?: number): Promise<NativeCloudLegacyPublishedFileResult>;
  cloudLegacyGetPublishedFileDetails(publishedFileId: bigint, maxSecondsOld?: number, timeoutSeconds?: number): Promise<NativeCloudLegacyPublishedFileDetails>;
  cloudLegacyDeletePublishedFile(publishedFileId: bigint, timeoutSeconds?: number): Promise<NativeCloudLegacyPublishedFileIdResult>;
  cloudLegacyEnumerateUserPublishedFiles(startIndex?: number, timeoutSeconds?: number): Promise<NativeCloudLegacyEnumerateFilesResult>;
  cloudLegacySubscribePublishedFile(publishedFileId: bigint, timeoutSeconds?: number): Promise<NativeCloudLegacyPublishedFileIdResult>;
  cloudLegacyEnumerateUserSubscribedFiles(startIndex?: number, timeoutSeconds?: number): Promise<NativeCloudLegacyEnumerateSubscribedFilesResult>;
  cloudLegacyUnsubscribePublishedFile(publishedFileId: bigint, timeoutSeconds?: number): Promise<NativeCloudLegacyPublishedFileIdResult>;
  cloudLegacyGetPublishedItemVoteDetails(publishedFileId: bigint, timeoutSeconds?: number): Promise<NativeCloudLegacyPublishedItemVoteDetails>;
  cloudLegacyUpdateUserPublishedItemVote(publishedFileId: bigint, voteUp: boolean, timeoutSeconds?: number): Promise<NativeCloudLegacyPublishedFileIdResult>;
  cloudLegacyGetUserPublishedItemVoteDetails(publishedFileId: bigint, timeoutSeconds?: number): Promise<NativeCloudLegacyUserVoteDetails>;
  cloudLegacyEnumerateUserSharedWorkshopFiles(steamId64: bigint, startIndex: number | undefined, requiredTags: string[], excludedTags: string[], timeoutSeconds?: number): Promise<NativeCloudLegacyEnumerateFilesResult>;
  cloudLegacySetUserPublishedFileAction(publishedFileId: bigint, action: number, timeoutSeconds?: number): Promise<NativeCloudLegacyPublishedFileActionResult>;
  cloudLegacyEnumeratePublishedFilesByUserAction(action: number, startIndex?: number, timeoutSeconds?: number): Promise<NativeCloudLegacyEnumerateUserActionFilesResult>;
  cloudLegacyEnumeratePublishedWorkshopFiles(enumerationType: number, startIndex: number | undefined, count: number | undefined, days: number | undefined, tags: string[], userTags: string[], timeoutSeconds?: number): Promise<NativeCloudLegacyEnumerateWorkshopFilesResult>;

  httpCreateRequest(method: number, url: string): number;
  httpSetContextValue(request: number, contextValue: bigint): boolean;
  httpSetNetworkActivityTimeout(request: number, timeoutSeconds: number): boolean;
  httpSetHeaderValue(request: number, name: string, value: string): boolean;
  httpSetGetOrPostParameter(request: number, name: string, value: string): boolean;
  httpSendRequest(request: number, timeoutSeconds?: number): Promise<NativeHttpRequestCompleted>;
  httpSendRequestAndStreamResponse(request: number, timeoutSeconds?: number): Promise<NativeHttpRequestHeadersReceived>;
  httpDeferRequest(request: number): boolean;
  httpPrioritizeRequest(request: number): boolean;
  httpGetResponseHeaderSize(request: number, name: string): number | null | undefined;
  httpGetResponseHeaderValue(request: number, name: string): string | null | undefined;
  httpGetResponseBodySize(request: number): number | null | undefined;
  httpGetResponseBodyData(request: number): Buffer | null | undefined;
  httpGetStreamingResponseBodyData(request: number, offset: number, size: number): Buffer | null | undefined;
  httpReleaseRequest(request: number): boolean;
  httpGetDownloadProgressPercent(request: number): number | null | undefined;
  httpSetRawPostBody(request: number, contentType: string, body: Buffer): boolean;
  httpCreateCookieContainer(allowResponsesToModify: boolean): number;
  httpReleaseCookieContainer(container: number): boolean;
  httpSetCookie(container: number, host: string, url: string, cookie: string): boolean;
  httpSetRequestCookieContainer(request: number, container: number): boolean;
  httpSetUserAgentInfo(request: number, userAgent: string): boolean;
  httpSetRequiresVerifiedCertificate(request: number, requireVerifiedCertificate: boolean): boolean;
  httpSetAbsoluteTimeoutMs(request: number, timeoutMs: number): boolean;
  httpGetRequestWasTimedOut(request: number): boolean | null | undefined;

  gameServerHttpCreateRequest(method: number, url: string): number;
  gameServerHttpSetContextValue(request: number, contextValue: bigint): boolean;
  gameServerHttpSetNetworkActivityTimeout(request: number, timeoutSeconds: number): boolean;
  gameServerHttpSetHeaderValue(request: number, name: string, value: string): boolean;
  gameServerHttpSetGetOrPostParameter(request: number, name: string, value: string): boolean;
  gameServerHttpSendRequest(request: number, timeoutSeconds?: number): Promise<NativeHttpRequestCompleted>;
  gameServerHttpSendRequestAndStreamResponse(request: number, timeoutSeconds?: number): Promise<NativeHttpRequestHeadersReceived>;
  gameServerHttpDeferRequest(request: number): boolean;
  gameServerHttpPrioritizeRequest(request: number): boolean;
  gameServerHttpGetResponseHeaderSize(request: number, name: string): number | null | undefined;
  gameServerHttpGetResponseHeaderValue(request: number, name: string): string | null | undefined;
  gameServerHttpGetResponseBodySize(request: number): number | null | undefined;
  gameServerHttpGetResponseBodyData(request: number): Buffer | null | undefined;
  gameServerHttpGetStreamingResponseBodyData(request: number, offset: number, size: number): Buffer | null | undefined;
  gameServerHttpReleaseRequest(request: number): boolean;
  gameServerHttpGetDownloadProgressPercent(request: number): number | null | undefined;
  gameServerHttpSetRawPostBody(request: number, contentType: string, body: Buffer): boolean;
  gameServerHttpCreateCookieContainer(allowResponsesToModify: boolean): number;
  gameServerHttpReleaseCookieContainer(container: number): boolean;
  gameServerHttpSetCookie(container: number, host: string, url: string, cookie: string): boolean;
  gameServerHttpSetRequestCookieContainer(request: number, container: number): boolean;
  gameServerHttpSetUserAgentInfo(request: number, userAgent: string): boolean;
  gameServerHttpSetRequiresVerifiedCertificate(request: number, requireVerifiedCertificate: boolean): boolean;
  gameServerHttpSetAbsoluteTimeoutMs(request: number, timeoutMs: number): boolean;
  gameServerHttpGetRequestWasTimedOut(request: number): boolean | null | undefined;

  htmlInit(): boolean;
  htmlShutdown(): boolean;
  htmlCreateBrowser(userAgent?: string, userCss?: string, timeoutSeconds?: number): Promise<number>;
  htmlRemoveBrowser(browser: number): void;
  htmlLoadUrl(browser: number, url: string, postData?: string | null): void;
  htmlSetSize(browser: number, width: number, height: number): void;
  htmlStopLoad(browser: number): void;
  htmlReload(browser: number): void;
  htmlGoBack(browser: number): void;
  htmlGoForward(browser: number): void;
  htmlAddHeader(browser: number, key: string, value: string): void;
  htmlExecuteJavascript(browser: number, script: string): void;
  htmlMouseUp(browser: number, mouseButton: number): void;
  htmlMouseDown(browser: number, mouseButton: number): void;
  htmlMouseDoubleClick(browser: number, mouseButton: number): void;
  htmlMouseMove(browser: number, x: number, y: number): void;
  htmlMouseWheel(browser: number, delta: number): void;
  htmlKeyDown(browser: number, nativeKeyCode: number, keyModifiers: number, isSystemKey: boolean): void;
  htmlKeyUp(browser: number, nativeKeyCode: number, keyModifiers: number): void;
  htmlKeyChar(browser: number, unicodeChar: number, keyModifiers: number): void;
  htmlSetHorizontalScroll(browser: number, absolutePixelScroll: number): void;
  htmlSetVerticalScroll(browser: number, absolutePixelScroll: number): void;
  htmlSetKeyFocus(browser: number, hasKeyFocus: boolean): void;
  htmlViewSource(browser: number): void;
  htmlCopyToClipboard(browser: number): void;
  htmlPasteFromClipboard(browser: number): void;
  htmlFind(browser: number, search: string, currentlyInFind: boolean, reverse: boolean): void;
  htmlStopFind(browser: number): void;
  htmlGetLinkAtPosition(browser: number, x: number, y: number): void;
  htmlSetCookie(hostname: string, key: string, value: string, path?: string, expires?: number, secure?: boolean, httpOnly?: boolean): void;
  htmlSetPageScaleFactor(browser: number, zoom: number, pointX: number, pointY: number): void;
  htmlSetBackgroundMode(browser: number, backgroundMode: boolean): void;
  htmlSetDpiScalingFactor(browser: number, dpiScaling: number): void;
  htmlOpenDeveloperTools(browser: number): void;
  htmlAllowStartRequest(browser: number, allowed: boolean): void;
  htmlJsDialogResponse(browser: number, result: boolean): void;
  htmlFileLoadDialogResponse(browser: number, selectedFiles: string[]): void;

  partiesGetNumActiveBeacons(): number;
  partiesGetBeaconByIndex(index: number): bigint | string | number | null | undefined;
  partiesGetActiveBeacons(): Array<bigint | string | number>;
  partiesGetBeaconDetails(beacon: bigint): NativePartyBeaconDetails | null | undefined;
  partiesJoinParty(beacon: bigint, timeoutSeconds?: number): Promise<NativeJoinPartyResult>;
  partiesGetNumAvailableBeaconLocations(): number | null | undefined;
  partiesGetAvailableBeaconLocations(maxLocations?: number): NativePartyBeaconLocation[];
  partiesCreateBeacon(
    openSlots: number,
    location: NativePartyBeaconLocation,
    connectString: string,
    metadata: string,
    timeoutSeconds?: number
  ): Promise<NativeCreateBeaconResult>;
  partiesOnReservationCompleted(beacon: bigint, steamId64: bigint): void;
  partiesCancelReservation(beacon: bigint, steamId64: bigint): void;
  partiesChangeNumOpenSlots(beacon: bigint, openSlots: number, timeoutSeconds?: number): Promise<NativeChangeNumOpenSlotsResult>;
  partiesDestroyBeacon(beacon: bigint): boolean;
  partiesGetBeaconLocationData(location: NativePartyBeaconLocation, data: number): string | null | undefined;

  inventoryGetResultStatus(resultHandle: number): number;
  inventoryGetResultItems(resultHandle: number): NativeInventoryItemDetail[] | null | undefined;
  inventoryGetResultItemProperty(resultHandle: number, itemIndex: number, propertyName?: string): string | null | undefined;
  inventoryGetResultTimestamp(resultHandle: number): number;
  inventoryCheckResultSteamId(resultHandle: number, steamId64: bigint): boolean;
  inventoryDestroyResult(resultHandle: number): void;
  inventoryGetAllItems(): number | null | undefined;
  inventoryGetItemsById(instanceIds: bigint[]): number | null | undefined;
  inventorySerializeResult(resultHandle: number): Buffer | null | undefined;
  inventoryDeserializeResult(data: Buffer): number | null | undefined;
  inventoryGenerateItems(items: NativeInventoryItemQuantity[]): number | null | undefined;
  inventoryGrantPromoItems(): number | null | undefined;
  inventoryAddPromoItem(definition: number): number | null | undefined;
  inventoryAddPromoItems(definitions: number[]): number | null | undefined;
  inventoryConsumeItem(itemId: bigint, quantity: number): number | null | undefined;
  inventoryExchangeItems(generate: NativeInventoryItemQuantity[], destroy: NativeInventoryInstanceQuantity[]): number | null | undefined;
  inventoryTransferItemQuantity(sourceItemId: bigint, quantity: number, destinationItemId?: bigint): number | null | undefined;
  inventorySendItemDropHeartbeat(): void;
  inventoryTriggerItemDrop(dropListDefinition: number): number | null | undefined;
  inventoryTradeItems(
    tradePartnerSteamId64: bigint,
    give: NativeInventoryInstanceQuantity[],
    get: NativeInventoryInstanceQuantity[]
  ): number | null | undefined;
  inventoryLoadItemDefinitions(): boolean;
  inventoryGetItemDefinitionIds(): number[];
  inventoryGetItemDefinitionProperty(definition: number, propertyName?: string): string | null | undefined;
  inventoryRequestEligiblePromoItemDefinitionIds(steamId64: bigint, timeoutSeconds?: number): Promise<NativeInventoryEligiblePromoItemDefIds>;
  inventoryGetEligiblePromoItemDefinitionIds(steamId64: bigint): number[];
  inventoryStartPurchase(items: NativeInventoryItemQuantity[], timeoutSeconds?: number): Promise<NativeInventoryStartPurchaseResult>;
  inventoryRequestPrices(timeoutSeconds?: number): Promise<NativeInventoryRequestPricesResult>;
  inventoryGetNumItemsWithPrices(): number;
  inventoryGetItemsWithPrices(maxItems?: number): NativeInventoryPrice[];
  inventoryGetItemPrice(definition: number): NativeInventoryPrice | null | undefined;
  inventoryStartUpdateProperties(): bigint | string | number | null | undefined;
  inventoryRemoveProperty(updateHandle: bigint, itemId: bigint, propertyName: string): boolean;
  inventorySetPropertyString(updateHandle: bigint, itemId: bigint, propertyName: string, value: string): boolean;
  inventorySetPropertyBool(updateHandle: bigint, itemId: bigint, propertyName: string, value: boolean): boolean;
  inventorySetPropertyInt64(updateHandle: bigint, itemId: bigint, propertyName: string, value: bigint): boolean;
  inventorySetPropertyFloat(updateHandle: bigint, itemId: bigint, propertyName: string, value: number): boolean;
  inventorySubmitUpdateProperties(updateHandle: bigint): number | null | undefined;
  inventoryInspectItem(itemToken: string): number | null | undefined;
  gameServerInventoryGetResultStatus(resultHandle: number): number;
  gameServerInventoryGetResultItems(resultHandle: number): NativeInventoryItemDetail[] | null | undefined;
  gameServerInventoryGetResultItemProperty(resultHandle: number, itemIndex: number, propertyName?: string): string | null | undefined;
  gameServerInventoryGetResultTimestamp(resultHandle: number): number;
  gameServerInventoryCheckResultSteamId(resultHandle: number, steamId64: bigint): boolean;
  gameServerInventoryDestroyResult(resultHandle: number): void;
  gameServerInventoryGetAllItems(): number | null | undefined;
  gameServerInventoryGetItemsById(instanceIds: bigint[]): number | null | undefined;
  gameServerInventorySerializeResult(resultHandle: number): Buffer | null | undefined;
  gameServerInventoryDeserializeResult(data: Buffer): number | null | undefined;
  gameServerInventoryGenerateItems(items: NativeInventoryItemQuantity[]): number | null | undefined;
  gameServerInventoryGrantPromoItems(): number | null | undefined;
  gameServerInventoryAddPromoItem(definition: number): number | null | undefined;
  gameServerInventoryAddPromoItems(definitions: number[]): number | null | undefined;
  gameServerInventoryConsumeItem(itemId: bigint, quantity: number): number | null | undefined;
  gameServerInventoryExchangeItems(generate: NativeInventoryItemQuantity[], destroy: NativeInventoryInstanceQuantity[]): number | null | undefined;
  gameServerInventoryTransferItemQuantity(sourceItemId: bigint, quantity: number, destinationItemId?: bigint): number | null | undefined;
  gameServerInventorySendItemDropHeartbeat(): void;
  gameServerInventoryTriggerItemDrop(dropListDefinition: number): number | null | undefined;
  gameServerInventoryTradeItems(
    tradePartnerSteamId64: bigint,
    give: NativeInventoryInstanceQuantity[],
    get: NativeInventoryInstanceQuantity[]
  ): number | null | undefined;
  gameServerInventoryLoadItemDefinitions(): boolean;
  gameServerInventoryGetItemDefinitionIds(): number[];
  gameServerInventoryGetItemDefinitionProperty(definition: number, propertyName?: string): string | null | undefined;
  gameServerInventoryRequestEligiblePromoItemDefinitionIds(steamId64: bigint, timeoutSeconds?: number): Promise<NativeInventoryEligiblePromoItemDefIds>;
  gameServerInventoryGetEligiblePromoItemDefinitionIds(steamId64: bigint): number[];
  gameServerInventoryStartPurchase(items: NativeInventoryItemQuantity[], timeoutSeconds?: number): Promise<NativeInventoryStartPurchaseResult>;
  gameServerInventoryRequestPrices(timeoutSeconds?: number): Promise<NativeInventoryRequestPricesResult>;
  gameServerInventoryGetNumItemsWithPrices(): number;
  gameServerInventoryGetItemsWithPrices(maxItems?: number): NativeInventoryPrice[];
  gameServerInventoryGetItemPrice(definition: number): NativeInventoryPrice | null | undefined;
  gameServerInventoryStartUpdateProperties(): bigint | string | number | null | undefined;
  gameServerInventoryRemoveProperty(updateHandle: bigint, itemId: bigint, propertyName: string): boolean;
  gameServerInventorySetPropertyString(updateHandle: bigint, itemId: bigint, propertyName: string, value: string): boolean;
  gameServerInventorySetPropertyBool(updateHandle: bigint, itemId: bigint, propertyName: string, value: boolean): boolean;
  gameServerInventorySetPropertyInt64(updateHandle: bigint, itemId: bigint, propertyName: string, value: bigint): boolean;
  gameServerInventorySetPropertyFloat(updateHandle: bigint, itemId: bigint, propertyName: string, value: number): boolean;
  gameServerInventorySubmitUpdateProperties(updateHandle: bigint): number | null | undefined;
  gameServerInventoryInspectItem(itemToken: string): number | null | undefined;

  inputInit(): void;
  inputShutdown(): void;
  inputRunFrame(reserved?: boolean | null): void;
  inputWaitForData(waitForever?: boolean | null, timeoutMs?: number | null): boolean;
  inputNewDataAvailable(): boolean;
  inputEnableDeviceCallbacks(): void;
  inputRegisterActionEventCallback(handler: (event: NativeInputActionEvent) => void): NativeCallbackHandle;
  inputSetActionManifestFilePath(path: string): boolean;
  inputGetControllers(): NativeInputControllerInfo[];
  inputGetActionSet(actionSetName: string): bigint;
  inputGetDigitalAction(actionName: string): bigint;
  inputGetAnalogAction(actionName: string): bigint;
  inputActivateActionSet(controller: bigint, actionSet: bigint): void;
  inputGetCurrentActionSet(controller: bigint): bigint;
  inputActivateActionSetLayer(controller: bigint, actionSetLayer: bigint): void;
  inputDeactivateActionSetLayer(controller: bigint, actionSetLayer: bigint): void;
  inputDeactivateAllActionSetLayers(controller: bigint): void;
  inputGetActiveActionSetLayers(controller: bigint): bigint[];
  inputGetDigitalActionData(controller: bigint, action: bigint): NativeInputDigitalActionData;
  inputIsDigitalActionPressed(controller: bigint, action: bigint): boolean;
  inputGetDigitalActionOrigins(controller: bigint, actionSet: bigint, action: bigint): number[];
  inputGetStringForDigitalActionName(action: bigint): string;
  inputGetAnalogActionData(controller: bigint, action: bigint): NativeInputAnalogActionData;
  inputGetAnalogActionVector(controller: bigint, action: bigint): NativeAnalogActionVector;
  inputGetAnalogActionOrigins(controller: bigint, actionSet: bigint, action: bigint): number[];
  inputGetStringForAnalogActionName(action: bigint): string;
  inputGetGlyphPngForActionOrigin(origin: number, size?: number | null, flags?: number | null): string;
  inputGetGlyphSvgForActionOrigin(origin: number, flags?: number | null): string;
  inputGetLegacyGlyphForActionOrigin(origin: number): string;
  inputGetStringForActionOrigin(origin: number): string;
  inputStopAnalogActionMomentum(controller: bigint, action: bigint): void;
  inputGetMotionData(controller: bigint): NativeInputMotionData;
  inputTriggerVibration(controller: bigint, leftSpeed: number, rightSpeed: number): void;
  inputTriggerVibrationExtended(
    controller: bigint,
    leftSpeed: number,
    rightSpeed: number,
    leftTriggerSpeed: number,
    rightTriggerSpeed: number
  ): void;
  inputSetDualSenseTriggerEffect(controller: bigint, effect?: Buffer | null): void;
  inputTriggerSimpleHapticEvent(
    controller: bigint,
    location: number,
    intensity: number,
    gainDb: number,
    otherIntensity: number,
    otherGainDb: number
  ): void;
  inputSetLedColor(controller: bigint, red: number, green: number, blue: number, flags?: number | null): void;
  inputLegacyTriggerHapticPulse(controller: bigint, targetPad: number, durationMicroseconds: number): void;
  inputLegacyTriggerRepeatedHapticPulse(
    controller: bigint,
    targetPad: number,
    durationMicroseconds: number,
    offMicroseconds: number,
    repeat: number,
    flags?: number | null
  ): void;
  inputShowBindingPanel(controller: bigint): boolean;
  inputGetControllerType(controller: bigint): string;
  inputGetControllerForGamepadIndex(index: number): bigint | null | undefined;
  inputGetGamepadIndexForController(controller: bigint): number;
  inputGetStringForXboxOrigin(origin: number): string;
  inputGetGlyphForXboxOrigin(origin: number): string;
  inputGetActionOriginFromXboxOrigin(controller: bigint, origin: number): number;
  inputTranslateActionOrigin(destinationInputType: number, sourceOrigin: number): number;
  inputGetDeviceBindingRevision(controller: bigint): NativeInputDeviceBindingRevision | null | undefined;
  inputGetRemotePlaySessionId(controller: bigint): number;
  inputGetSessionInputConfigurationSettings(): number;

  controllerInit(): boolean;
  controllerShutdown(): boolean;
  controllerRunFrame(): void;
  controllerGetControllers(): NativeInputControllerInfo[];
  controllerGetActionSet(actionSetName: string): bigint;
  controllerGetDigitalAction(actionName: string): bigint;
  controllerGetAnalogAction(actionName: string): bigint;
  controllerActivateActionSet(controller: bigint, actionSet: bigint): void;
  controllerGetCurrentActionSet(controller: bigint): bigint;
  controllerActivateActionSetLayer(controller: bigint, actionSetLayer: bigint): void;
  controllerDeactivateActionSetLayer(controller: bigint, actionSetLayer: bigint): void;
  controllerDeactivateAllActionSetLayers(controller: bigint): void;
  controllerGetActiveActionSetLayers(controller: bigint): bigint[];
  controllerGetDigitalActionData(controller: bigint, action: bigint): NativeInputDigitalActionData;
  controllerIsDigitalActionPressed(controller: bigint, action: bigint): boolean;
  controllerGetDigitalActionOrigins(controller: bigint, actionSet: bigint, action: bigint): number[];
  controllerGetAnalogActionData(controller: bigint, action: bigint): NativeInputAnalogActionData;
  controllerGetAnalogActionVector(controller: bigint, action: bigint): NativeAnalogActionVector;
  controllerGetAnalogActionOrigins(controller: bigint, actionSet: bigint, action: bigint): number[];
  controllerGetGlyphForActionOrigin(origin: number): string;
  controllerGetStringForActionOrigin(origin: number): string;
  controllerStopAnalogActionMomentum(controller: bigint, action: bigint): void;
  controllerGetMotionData(controller: bigint): NativeInputMotionData;
  controllerTriggerHapticPulse(controller: bigint, targetPad: number, durationMicroseconds: number): void;
  controllerTriggerRepeatedHapticPulse(
    controller: bigint,
    targetPad: number,
    durationMicroseconds: number,
    offMicroseconds: number,
    repeat: number,
    flags?: number | null
  ): void;
  controllerTriggerVibration(controller: bigint, leftSpeed: number, rightSpeed: number): void;
  controllerSetLedColor(controller: bigint, red: number, green: number, blue: number, flags?: number | null): void;
  controllerShowBindingPanel(controller: bigint): boolean;
  controllerGetControllerType(controller: bigint): string;
  controllerGetControllerForGamepadIndex(index: number): bigint | null | undefined;
  controllerGetGamepadIndexForController(controller: bigint): number;
  controllerGetStringForXboxOrigin(origin: number): string;
  controllerGetGlyphForXboxOrigin(origin: number): string;
  controllerGetActionOriginFromXboxOrigin(controller: bigint, origin: number): number;
  controllerTranslateActionOrigin(destinationInputType: number, sourceOrigin: number): number;
  controllerGetControllerBindingRevision(controller: bigint): NativeInputDeviceBindingRevision | null | undefined;

  statsGetInt(name: string): number | null | undefined;
  statsGetFloat(name: string): number | null | undefined;
  statsSetInt(name: string, value: number): boolean;
  statsSetFloat(name: string, value: number): boolean;
  statsUpdateAvgRate(name: string, countThisSession: number, sessionLength: number): boolean;
  statsStore(): boolean;
  statsResetAll(achievementsToo: boolean): boolean;
  achievementGetAndUnlockTime(name: string): NativeAchievementUnlockTime | null | undefined;
  achievementGetIcon(name: string): number;
  achievementGetDisplayAttribute(name: string, key: string): string;
  achievementIndicateProgress(name: string, current: number, max: number): boolean;
  statsRequestUserStats(steamId64: bigint): Promise<NativeUserStatsReceivedResult>;
  statsGetUserInt(steamId64: bigint, name: string): number | null | undefined;
  statsGetUserFloat(steamId64: bigint, name: string): number | null | undefined;
  statsGetUserAchievement(steamId64: bigint, name: string): boolean | null | undefined;
  statsGetUserAchievementAndUnlockTime(steamId64: bigint, name: string): NativeAchievementUnlockTime | null | undefined;
  statsGetNumberOfCurrentPlayers(): Promise<NativeNumberOfCurrentPlayersResult>;
  statsRequestGlobalAchievementPercentages(): Promise<NativeGlobalAchievementPercentagesReady>;
  statsGetMostAchievedAchievementInfo(): NativeGlobalAchievementInfo | null | undefined;
  statsGetNextMostAchievedAchievementInfo(previousIterator: number): NativeGlobalAchievementInfo | null | undefined;
  statsGetAchievementAchievedPercent(name: string): number | null | undefined;
  statsRequestGlobalStats(historyDays: number): Promise<NativeGlobalStatsReceivedResult>;
  statsGetGlobalStatInt(name: string): bigint | string | number | null | undefined;
  statsGetGlobalStatDouble(name: string): number | null | undefined;
  statsGetGlobalStatHistoryInt(name: string, maxEntries: number): Array<bigint | string | number>;
  statsGetGlobalStatHistoryDouble(name: string, maxEntries: number): number[];
  achievementGetProgressLimitsInt(name: string): NativeAchievementProgressLimitsInt | null | undefined;
  achievementGetProgressLimitsFloat(name: string): NativeAchievementProgressLimitsFloat | null | undefined;
  statsFindOrCreateLeaderboard(name: string, sortMethod: number, displayType: number): Promise<NativeLeaderboardFindResult>;
  statsFindLeaderboard(name: string): Promise<NativeLeaderboardFindResult>;
  statsGetLeaderboardName(leaderboard: bigint): string;
  statsGetLeaderboardEntryCount(leaderboard: bigint): number;
  statsGetLeaderboardSortMethod(leaderboard: bigint): number;
  statsGetLeaderboardDisplayType(leaderboard: bigint): number;
  statsDownloadLeaderboardEntries(leaderboard: bigint, request: number, rangeStart: number, rangeEnd: number, detailsMax?: number): Promise<NativeLeaderboardScoresDownloaded>;
  statsDownloadLeaderboardEntriesForUsers(leaderboard: bigint, steamIds64: bigint[], detailsMax?: number): Promise<NativeLeaderboardScoresDownloaded>;
  statsGetDownloadedLeaderboardEntry(entriesHandle: bigint, index: number, detailsMax?: number): NativeLeaderboardEntry | null | undefined;
  statsUploadLeaderboardScore(leaderboard: bigint, method: number, score: number, scoreDetails: number[]): Promise<NativeLeaderboardScoreUploaded>;
  statsAttachLeaderboardUgc(leaderboard: bigint, ugcHandle: bigint): Promise<NativeLeaderboardUgcSetResult>;

  screenshotsWriteScreenshot(rgb: Buffer, width: number, height: number): number;
  screenshotsAddScreenshotToLibrary(filename: string, thumbnailFilename: string | null | undefined, width: number, height: number): number;
  screenshotsTriggerScreenshot(): void;
  screenshotsHookScreenshots(hook: boolean): void;
  screenshotsSetLocation(handle: number, location: string): boolean;
  screenshotsTagUser(handle: number, steamId64: bigint): boolean;
  screenshotsTagPublishedFile(handle: number, publishedFileId: bigint): boolean;
  screenshotsIsScreenshotsHooked(): boolean;
  screenshotsAddVrScreenshotToLibrary(vrType: number, filename: string, vrFilename: string): number;

  musicIsEnabled(): boolean;
  musicIsPlaying(): boolean;
  musicGetPlaybackStatus(): number;
  musicPlay(): void;
  musicPause(): void;
  musicPlayPrevious(): void;
  musicPlayNext(): void;
  musicSetVolume(volume: number): void;
  musicGetVolume(): number;

  videoRequestVideoUrl(appId: number): void;
  videoIsBroadcasting(): NativeVideoBroadcastStatus;
  videoRequestOpfSettings(appId: number): void;
  videoGetOpfStringForApp(appId: number): string | null | undefined;

  parentalIsParentalLockEnabled(): boolean;
  parentalIsParentalLockLocked(): boolean;
  parentalIsAppBlocked(appId: number): boolean;
  parentalIsAppInBlockList(appId: number): boolean;
  parentalIsFeatureBlocked(feature: number): boolean;
  parentalIsFeatureInBlockList(feature: number): boolean;

  timelineSetTimelineTooltip(description: string, timeDelta: number): void;
  timelineClearTimelineTooltip(timeDelta: number): void;
  timelineSetTimelineGameMode(mode: number): void;
  timelineAddInstantaneousTimelineEvent(title: string, description: string, icon: string, iconPriority: number, startOffsetSeconds: number, clipPriority: number): bigint;
  timelineAddRangeTimelineEvent(title: string, description: string, icon: string, iconPriority: number, startOffsetSeconds: number, duration: number, clipPriority: number): bigint;
  timelineStartRangeTimelineEvent(title: string, description: string, icon: string, priority: number, startOffsetSeconds: number, clipPriority: number): bigint;
  timelineUpdateRangeTimelineEvent(event: bigint, title: string, description: string, icon: string, priority: number, clipPriority: number): void;
  timelineEndRangeTimelineEvent(event: bigint, endOffsetSeconds: number): void;
  timelineRemoveTimelineEvent(event: bigint): void;
  timelineDoesEventRecordingExist(event: bigint): Promise<NativeTimelineEventRecordingExists>;
  timelineStartGamePhase(): void;
  timelineEndGamePhase(): void;
  timelineSetGamePhaseId(phaseId: string): void;
  timelineDoesGamePhaseRecordingExist(phaseId: string): Promise<NativeTimelineGamePhaseRecordingExists>;
  timelineAddGamePhaseTag(tagName: string, tagIcon: string, tagGroup: string, priority: number): void;
  timelineSetGamePhaseAttribute(attributeGroup: string, attributeValue: string, priority: number): void;
  timelineOpenOverlayToGamePhase(phaseId: string): void;
  timelineOpenOverlayToTimelineEvent(event: bigint): void;

  remotePlayGetSessionCount(): number;
  remotePlayGetSessionId(index: number): number;
  remotePlayGetSessions(): NativeRemotePlaySessionInfo[];
  remotePlayIsRemotePlayTogether(sessionId: number): boolean;
  remotePlayGetSessionSteamId(sessionId: number): NativeSteamId;
  remotePlayGetSessionGuestId(sessionId: number): number;
  remotePlayGetSmallSessionAvatar(sessionId: number): number;
  remotePlayGetMediumSessionAvatar(sessionId: number): number;
  remotePlayGetLargeSessionAvatar(sessionId: number): number;
  remotePlayGetSessionClientName(sessionId: number): string;
  remotePlayGetSessionClientFormFactor(sessionId: number): number;
  remotePlayGetSessionClientResolution(sessionId: number): NativeRemotePlayResolution | null | undefined;
  remotePlayShowRemotePlayTogetherUi(): boolean;
  remotePlaySendRemotePlayTogetherInvite(steamId64: bigint): boolean;
  remotePlayEnableRemotePlayTogetherDirectInput(): boolean;
  remotePlayDisableRemotePlayTogetherDirectInput(): void;
  remotePlayGetInput(maxEvents: number): NativeRemotePlayInputEvent[];
  remotePlaySetMouseVisibility(sessionId: number, visible: boolean): void;
  remotePlaySetMousePosition(sessionId: number, normalizedX: number, normalizedY: number): void;
  remotePlayCreateMouseCursor(width: number, height: number, hotX: number, hotY: number, bgra: Buffer, pitch: number): number;
  remotePlaySetMouseCursor(sessionId: number, cursorId: number): void;

  networkingSendP2PPacket(steamId64: bigint, sendType: number, data: Buffer): boolean;
  networkingIsP2PPacketAvailable(): number;
  networkingReadP2PPacket(size: number): NativeP2PPacket | null | undefined;
  networkingAcceptP2PSession(steamId64: bigint): void;
  networkingCloseP2PSession(steamId64: bigint): boolean;
  networkingCloseP2PChannel(steamId64: bigint, channel: number): boolean;
  networkingGetP2PSessionState(steamId64: bigint): NativeLegacyNetworkingP2PSessionState | null | undefined;
  networkingAllowP2PPacketRelay(allow: boolean): boolean;
  networkingCreateListenSocket(virtualP2PPort?: number, ip?: number, port?: number, allowPacketRelay?: boolean): number;
  networkingCreateP2PConnectionSocket(steamId64: bigint, virtualPort?: number, timeoutSeconds?: number, allowPacketRelay?: boolean): number;
  networkingCreateConnectionSocket(ip: number, port: number, timeoutSeconds?: number): number;
  networkingDestroySocket(socket: number, notifyRemoteEnd?: boolean): boolean;
  networkingDestroyListenSocket(socket: number, notifyRemoteEnd?: boolean): boolean;
  networkingSendDataOnSocket(socket: number, data: Buffer, reliable?: boolean): boolean;
  networkingIsDataAvailableOnSocket(socket: number): number;
  networkingRetrieveDataFromSocket(socket: number, size: number): NativeLegacyNetworkingSocketData | null | undefined;
  networkingIsDataAvailable(listenSocket: number): NativeLegacyNetworkingListenSocketAvailable | null | undefined;
  networkingRetrieveData(listenSocket: number, size: number): NativeLegacyNetworkingListenSocketData | null | undefined;
  networkingGetSocketInfo(socket: number): NativeLegacyNetworkingSocketInfo | null | undefined;
  networkingGetListenSocketInfo(listenSocket: number): NativeLegacyNetworkingListenSocketInfo | null | undefined;
  networkingGetSocketConnectionType(socket: number): number;
  networkingGetMaxPacketSize(socket: number): number;
  gameServerNetworkingSendP2PPacket(steamId64: bigint, sendType: number, data: Buffer): boolean;
  gameServerNetworkingIsP2PPacketAvailable(): number;
  gameServerNetworkingReadP2PPacket(size: number): NativeP2PPacket | null | undefined;
  gameServerNetworkingAcceptP2PSession(steamId64: bigint): void;
  gameServerNetworkingCloseP2PSession(steamId64: bigint): boolean;
  gameServerNetworkingCloseP2PChannel(steamId64: bigint, channel: number): boolean;
  gameServerNetworkingGetP2PSessionState(steamId64: bigint): NativeLegacyNetworkingP2PSessionState | null | undefined;
  gameServerNetworkingAllowP2PPacketRelay(allow: boolean): boolean;
  gameServerNetworkingCreateListenSocket(virtualP2PPort?: number, ip?: number, port?: number, allowPacketRelay?: boolean): number;
  gameServerNetworkingCreateP2PConnectionSocket(steamId64: bigint, virtualPort?: number, timeoutSeconds?: number, allowPacketRelay?: boolean): number;
  gameServerNetworkingCreateConnectionSocket(ip: number, port: number, timeoutSeconds?: number): number;
  gameServerNetworkingDestroySocket(socket: number, notifyRemoteEnd?: boolean): boolean;
  gameServerNetworkingDestroyListenSocket(socket: number, notifyRemoteEnd?: boolean): boolean;
  gameServerNetworkingSendDataOnSocket(socket: number, data: Buffer, reliable?: boolean): boolean;
  gameServerNetworkingIsDataAvailableOnSocket(socket: number): number;
  gameServerNetworkingRetrieveDataFromSocket(socket: number, size: number): NativeLegacyNetworkingSocketData | null | undefined;
  gameServerNetworkingIsDataAvailable(listenSocket: number): NativeLegacyNetworkingListenSocketAvailable | null | undefined;
  gameServerNetworkingRetrieveData(listenSocket: number, size: number): NativeLegacyNetworkingListenSocketData | null | undefined;
  gameServerNetworkingGetSocketInfo(socket: number): NativeLegacyNetworkingSocketInfo | null | undefined;
  gameServerNetworkingGetListenSocketInfo(listenSocket: number): NativeLegacyNetworkingListenSocketInfo | null | undefined;
  gameServerNetworkingGetSocketConnectionType(socket: number): number;
  gameServerNetworkingGetMaxPacketSize(socket: number): number;
  networkingIdentityToString(identity: NativeNetworkingIdentity): string;
  networkingIdentityParse(text: string): NativeNetworkingIdentityInfo | null | undefined;
  networkingMessagesSendMessageToUser(identity: NativeNetworkingIdentity, data: Buffer, sendFlags?: number, channel?: number): number;
  networkingMessagesReceiveMessagesOnChannel(channel: number, maxMessages?: number): NativeNetworkingMessage[];
  networkingMessagesAcceptSessionWithUser(identity: NativeNetworkingIdentity): boolean;
  networkingMessagesCloseSessionWithUser(identity: NativeNetworkingIdentity): boolean;
  networkingMessagesCloseChannelWithUser(identity: NativeNetworkingIdentity, channel: number): boolean;
  networkingMessagesGetSessionConnectionInfo(identity: NativeNetworkingIdentity): NativeNetworkingMessagesSessionConnectionInfo;
  gameServerNetworkingMessagesSendMessageToUser(identity: NativeNetworkingIdentity, data: Buffer, sendFlags?: number, channel?: number): number;
  gameServerNetworkingMessagesReceiveMessagesOnChannel(channel: number, maxMessages?: number): NativeNetworkingMessage[];
  gameServerNetworkingMessagesAcceptSessionWithUser(identity: NativeNetworkingIdentity): boolean;
  gameServerNetworkingMessagesCloseSessionWithUser(identity: NativeNetworkingIdentity): boolean;
  gameServerNetworkingMessagesCloseChannelWithUser(identity: NativeNetworkingIdentity, channel: number): boolean;
  gameServerNetworkingMessagesGetSessionConnectionInfo(identity: NativeNetworkingIdentity): NativeNetworkingMessagesSessionConnectionInfo;
  gameServerNetworkingSocketsCreateListenSocketIp(address: NativeNetworkingIpAddress): number;
  gameServerNetworkingSocketsConnectByIpAddress(address: NativeNetworkingIpAddress): number;
  gameServerNetworkingSocketsCreateListenSocketP2p(localVirtualPort?: number): number;
  gameServerNetworkingSocketsConnectP2p(identity: NativeNetworkingIdentity, remoteVirtualPort?: number): number;
  gameServerNetworkingSocketsAcceptConnection(connection: number): number;
  gameServerNetworkingSocketsCloseConnection(connection: number, reason?: number, debug?: string, enableLinger?: boolean): boolean;
  gameServerNetworkingSocketsCloseListenSocket(socket: number): boolean;
  gameServerNetworkingSocketsSetConnectionUserData(connection: number, userData: bigint): boolean;
  gameServerNetworkingSocketsGetConnectionUserData(connection: number): bigint | string | number;
  gameServerNetworkingSocketsSetConnectionName(connection: number, name: string): void;
  gameServerNetworkingSocketsGetConnectionName(connection: number): string | null | undefined;
  gameServerNetworkingSocketsSendMessageToConnection(connection: number, data: Buffer, sendFlags?: number): NativeNetworkingSocketSendResult;
  gameServerNetworkingSocketsSendMessages(messages: NativeNetworkingSocketOutgoingMessage[]): NativeNetworkingSocketSendResult[];
  gameServerNetworkingSocketsFlushMessagesOnConnection(connection: number): number;
  gameServerNetworkingSocketsReceiveMessagesOnConnection(connection: number, maxMessages?: number): NativeNetworkingMessage[];
  gameServerNetworkingSocketsGetConnectionInfo(connection: number): NativeNetworkingConnectionInfo | null | undefined;
  gameServerNetworkingSocketsGetConnectionRealTimeStatus(connection: number): NativeNetworkingConnectionRealTimeStatus | null | undefined;
  gameServerNetworkingSocketsGetConnectionRealTimeStatusWithLanes(connection: number, maxLanes?: number): NativeNetworkingConnectionRealTimeStatusWithLanes | null | undefined;
  gameServerNetworkingSocketsGetDetailedConnectionStatus(connection: number, maxBytes?: number): string | null | undefined;
  gameServerNetworkingSocketsGetListenSocketAddress(socket: number): NativeNetworkingIpAddressInfo | null | undefined;
  gameServerNetworkingSocketsCreateSocketPair(useNetworkLoopback: boolean, identity1?: NativeNetworkingIdentity | null, identity2?: NativeNetworkingIdentity | null): NativeNetworkingSocketPair | null | undefined;
  gameServerNetworkingSocketsConfigureConnectionLanes(connection: number, priorities: number[], weights?: number[]): number;
  gameServerNetworkingSocketsGetIdentity(): NativeNetworkingIdentityInfo | null | undefined;
  gameServerNetworkingSocketsInitAuthentication(): number;
  gameServerNetworkingSocketsGetAuthenticationStatus(): NativeNetworkingAuthenticationStatus;
  gameServerNetworkingSocketsCreatePollGroup(): number;
  gameServerNetworkingSocketsRunCallbacks(): void;
  gameServerNetworkingSocketsDestroyPollGroup(pollGroup: number): boolean;
  gameServerNetworkingSocketsSetConnectionPollGroup(connection: number, pollGroup: number): boolean;
  gameServerNetworkingSocketsReceiveMessagesOnPollGroup(pollGroup: number, maxMessages?: number): NativeNetworkingMessage[];
  gameServerNetworkingSocketsReceivedRelayAuthTicket(ticket: Buffer): boolean;
  gameServerNetworkingSocketsFindRelayAuthTicketForServer(identity: NativeNetworkingIdentity, remoteVirtualPort?: number): number;
  gameServerNetworkingSocketsConnectToHostedDedicatedServer(identity: NativeNetworkingIdentity, remoteVirtualPort?: number): number;
  gameServerNetworkingSocketsGetHostedDedicatedServerPort(): number;
  gameServerNetworkingSocketsGetHostedDedicatedServerPopId(): number;
  gameServerNetworkingSocketsGetHostedDedicatedServerAddress(): NativeNetworkingHostedDedicatedServerAddressResult;
  gameServerNetworkingSocketsCreateHostedDedicatedServerListenSocket(localVirtualPort?: number): number;
  gameServerNetworkingSocketsGetGameCoordinatorServerLogin(appData?: Buffer, maxBlobBytes?: number): NativeNetworkingGameCoordinatorServerLoginResult;
  gameServerNetworkingSocketsGetCertificateRequest(maxBytes?: number): NativeNetworkingCertificateResult;
  gameServerNetworkingSocketsSetCertificate(certificate: Buffer): NativeNetworkingCertificateResult;
  gameServerNetworkingSocketsResetIdentity(identity?: NativeNetworkingIdentity | null): void;
  gameServerNetworkingSocketsBeginAsyncRequestFakeIp(numPorts: number): boolean;
  gameServerNetworkingSocketsGetFakeIp(idxFirstPort?: number): NativeNetworkingFakeIpResult;
  gameServerNetworkingSocketsCreateListenSocketP2pFakeIp(idxFakePort?: number): number;
  gameServerNetworkingSocketsGetRemoteFakeIpForConnection(connection: number): NativeNetworkingRemoteFakeIpResult;
  gameServerNetworkingSocketsCreateFakeUdpPort(fakeServerPort: number): number | null | undefined;
  networkingSocketsCreateListenSocketIp(address: NativeNetworkingIpAddress): number;
  networkingSocketsConnectByIpAddress(address: NativeNetworkingIpAddress): number;
  networkingSocketsCreateListenSocketP2p(localVirtualPort?: number): number;
  networkingSocketsConnectP2p(identity: NativeNetworkingIdentity, remoteVirtualPort?: number): number;
  networkingSocketsAcceptConnection(connection: number): number;
  networkingSocketsCloseConnection(connection: number, reason?: number, debug?: string, enableLinger?: boolean): boolean;
  networkingSocketsCloseListenSocket(socket: number): boolean;
  networkingSocketsSetConnectionUserData(connection: number, userData: bigint): boolean;
  networkingSocketsGetConnectionUserData(connection: number): bigint | string | number;
  networkingSocketsSetConnectionName(connection: number, name: string): void;
  networkingSocketsGetConnectionName(connection: number): string | null | undefined;
  networkingSocketsSendMessageToConnection(connection: number, data: Buffer, sendFlags?: number): NativeNetworkingSocketSendResult;
  networkingSocketsSendMessages(messages: NativeNetworkingSocketOutgoingMessage[]): NativeNetworkingSocketSendResult[];
  networkingSocketsFlushMessagesOnConnection(connection: number): number;
  networkingSocketsReceiveMessagesOnConnection(connection: number, maxMessages?: number): NativeNetworkingMessage[];
  networkingSocketsGetConnectionInfo(connection: number): NativeNetworkingConnectionInfo | null | undefined;
  networkingSocketsGetConnectionRealTimeStatus(connection: number): NativeNetworkingConnectionRealTimeStatus | null | undefined;
  networkingSocketsGetConnectionRealTimeStatusWithLanes(connection: number, maxLanes?: number): NativeNetworkingConnectionRealTimeStatusWithLanes | null | undefined;
  networkingSocketsGetDetailedConnectionStatus(connection: number, maxBytes?: number): string | null | undefined;
  networkingSocketsGetListenSocketAddress(socket: number): NativeNetworkingIpAddressInfo | null | undefined;
  networkingSocketsCreateSocketPair(useNetworkLoopback: boolean, identity1?: NativeNetworkingIdentity | null, identity2?: NativeNetworkingIdentity | null): NativeNetworkingSocketPair | null | undefined;
  networkingSocketsConfigureConnectionLanes(connection: number, priorities: number[], weights?: number[]): number;
  networkingSocketsGetIdentity(): NativeNetworkingIdentityInfo | null | undefined;
  networkingSocketsInitAuthentication(): number;
  networkingSocketsGetAuthenticationStatus(): NativeNetworkingAuthenticationStatus;
  networkingSocketsCreatePollGroup(): number;
  networkingSocketsRunCallbacks(): void;
  networkingSocketsDestroyPollGroup(pollGroup: number): boolean;
  networkingSocketsSetConnectionPollGroup(connection: number, pollGroup: number): boolean;
  networkingSocketsReceiveMessagesOnPollGroup(pollGroup: number, maxMessages?: number): NativeNetworkingMessage[];
  networkingSocketsReceivedRelayAuthTicket(ticket: Buffer): boolean;
  networkingSocketsFindRelayAuthTicketForServer(identity: NativeNetworkingIdentity, remoteVirtualPort?: number): number;
  networkingSocketsConnectToHostedDedicatedServer(identity: NativeNetworkingIdentity, remoteVirtualPort?: number): number;
  networkingSocketsGetHostedDedicatedServerPort(): number;
  networkingSocketsGetHostedDedicatedServerPopId(): number;
  networkingSocketsGetHostedDedicatedServerAddress(): NativeNetworkingHostedDedicatedServerAddressResult;
  networkingSocketsCreateHostedDedicatedServerListenSocket(localVirtualPort?: number): number;
  networkingSocketsGetGameCoordinatorServerLogin(appData?: Buffer, maxBlobBytes?: number): NativeNetworkingGameCoordinatorServerLoginResult;
  networkingSocketsGetCertificateRequest(maxBytes?: number): NativeNetworkingCertificateResult;
  networkingSocketsSetCertificate(certificate: Buffer): NativeNetworkingCertificateResult;
  networkingSocketsResetIdentity(identity?: NativeNetworkingIdentity | null): void;
  networkingSocketsBeginAsyncRequestFakeIp(numPorts: number): boolean;
  networkingSocketsGetFakeIp(idxFirstPort?: number): NativeNetworkingFakeIpResult;
  networkingSocketsCreateListenSocketP2pFakeIp(idxFakePort?: number): number;
  networkingSocketsGetRemoteFakeIpForConnection(connection: number): NativeNetworkingRemoteFakeIpResult;
  networkingSocketsCreateFakeUdpPort(fakeServerPort: number): number | null | undefined;
  networkingFakeUdpPortDestroy(handle: number): boolean;
  networkingFakeUdpPortSendMessageToFakeIp(handle: number, remoteAddress: NativeNetworkingIpAddress, data: Buffer, sendFlags?: number): number;
  networkingFakeUdpPortReceiveMessages(handle: number, maxMessages?: number): NativeNetworkingMessage[];
  networkingFakeUdpPortScheduleCleanup(handle: number, remoteAddress: NativeNetworkingIpAddress): void;
  networkingUtilsInitRelayNetworkAccess(): void;
  networkingUtilsGetRelayNetworkStatus(): NativeNetworkingRelayNetworkStatus;
  networkingUtilsGetLocalPingLocation(): NativeNetworkingPingLocation;
  networkingUtilsParsePingLocation(location: string): string | null | undefined;
  networkingUtilsEstimatePingTimeBetweenTwoLocations(location1: string, location2: string): number;
  networkingUtilsEstimatePingTimeFromLocalHost(location: string): number;
  networkingUtilsCheckPingDataUpToDate(maxAgeSeconds?: number): boolean;
  networkingUtilsGetPingToDataCenter(popId: number): NativeNetworkingPingDataCenter;
  networkingUtilsGetDirectPingToPop(popId: number): number;
  networkingUtilsGetPopCount(): number;
  networkingUtilsGetPopList(maxPops?: number): number[];
  networkingUtilsGetLocalTimestamp(): bigint;
  networkingUtilsIsFakeIpv4(ipv4: number): boolean;
  networkingUtilsGetIpv4FakeIpType(ipv4: number): number;
  networkingUtilsParseIpAddress(text: string): NativeNetworkingIpAddressInfo | null | undefined;
  networkingUtilsIpAddressToString(address: NativeNetworkingIpAddress, withPort?: boolean): string;
  networkingUtilsGetIpAddressFakeIpType(address: NativeNetworkingIpAddress): number;
  networkingUtilsGetRealIdentityForFakeIp(address: NativeNetworkingIpAddress): NativeNetworkingFakeIpIdentity;
  networkingUtilsIdentityToString(identity: NativeNetworkingIdentity): string;
  networkingUtilsParseIdentity(text: string): NativeNetworkingIdentityInfo | null | undefined;
  networkingUtilsSetConfigValueInt32(value: number, scope: number, scopeObj: number, data: number): boolean;
  networkingUtilsSetConfigValueInt64(value: number, scope: number, scopeObj: number, data: bigint): boolean;
  networkingUtilsSetConfigValueFloat(value: number, scope: number, scopeObj: number, data: number): boolean;
  networkingUtilsSetConfigValueString(value: number, scope: number, scopeObj: number, data: string): boolean;
  networkingUtilsSetConfigValueStruct(option: NativeNetworkingConfigValue, scope: number, scopeObj: number): boolean;
  networkingUtilsSetGlobalConfigValueInt32(value: number, data: number): boolean;
  networkingUtilsSetGlobalConfigValueFloat(value: number, data: number): boolean;
  networkingUtilsSetGlobalConfigValueString(value: number, data: string): boolean;
  networkingUtilsSetGlobalConfigValuePtr(value: number, data?: bigint | null): boolean;
  networkingUtilsSetConnectionConfigValueInt32(connection: number, value: number, data: number): boolean;
  networkingUtilsSetConnectionConfigValueFloat(connection: number, value: number, data: number): boolean;
  networkingUtilsSetConnectionConfigValueString(connection: number, value: number, data: string): boolean;
  networkingUtilsGetConfigValue(value: number, scope: number, scopeObj: number, maxBytes?: number): NativeNetworkingConfigValueResult;
  networkingUtilsGetConfigValueInfo(value: number): NativeNetworkingConfigValueInfo;
  networkingUtilsIterateGenericEditableConfigValues(current: number, enumerateDevVars?: boolean): number;
  networkingUtilsEnableGlobalCallbacks(): boolean;
  networkingUtilsClearGlobalCallbacks(): boolean;
  networkingUtilsRegisterDebugOutputHook(detailLevel: number, handler: (event: NativeNetworkingDebugOutput) => void): NativeCallbackHandle;

  matchmakingGetFavoriteGameCount(): number;
  matchmakingGetFavoriteGame(index: number): NativeMatchmakingFavoriteGame | null | undefined;
  matchmakingAddFavoriteGame(appId: number, ip: number, connPort: number, queryPort: number, flags: number, lastPlayedOnServer: number): number;
  matchmakingRemoveFavoriteGame(appId: number, ip: number, connPort: number, queryPort: number, flags: number): boolean;
  matchmakingAddRequestLobbyListStringFilter(key: string, value: string, comparison: number): void;
  matchmakingAddRequestLobbyListNumericalFilter(key: string, value: number, comparison: number): void;
  matchmakingAddRequestLobbyListNearValueFilter(key: string, value: number): void;
  matchmakingAddRequestLobbyListFilterSlotsAvailable(slots: number): void;
  matchmakingAddRequestLobbyListDistanceFilter(distanceFilter: number): void;
  matchmakingAddRequestLobbyListResultCountFilter(maxResults: number): void;
  matchmakingAddRequestLobbyListCompatibleMembersFilter(lobbyId: bigint): void;
  matchmakingServersRequestInternetServerList(appId: number, filters?: unknown, timeoutSeconds?: number): Promise<NativeMatchmakingServerListResult>;
  matchmakingServersRequestLanServerList(appId: number, timeoutSeconds?: number): Promise<NativeMatchmakingServerListResult>;
  matchmakingServersRequestFriendsServerList(appId: number, filters?: unknown, timeoutSeconds?: number): Promise<NativeMatchmakingServerListResult>;
  matchmakingServersRequestFavoritesServerList(appId: number, filters?: unknown, timeoutSeconds?: number): Promise<NativeMatchmakingServerListResult>;
  matchmakingServersRequestHistoryServerList(appId: number, filters?: unknown, timeoutSeconds?: number): Promise<NativeMatchmakingServerListResult>;
  matchmakingServersRequestSpectatorServerList(appId: number, filters?: unknown, timeoutSeconds?: number): Promise<NativeMatchmakingServerListResult>;
  matchmakingServersOpenInternetServerList(appId: number, filters?: unknown): NativeMatchmakingServerListRequest;
  matchmakingServersOpenLanServerList(appId: number): NativeMatchmakingServerListRequest;
  matchmakingServersOpenFriendsServerList(appId: number, filters?: unknown): NativeMatchmakingServerListRequest;
  matchmakingServersOpenFavoritesServerList(appId: number, filters?: unknown): NativeMatchmakingServerListRequest;
  matchmakingServersOpenHistoryServerList(appId: number, filters?: unknown): NativeMatchmakingServerListRequest;
  matchmakingServersOpenSpectatorServerList(appId: number, filters?: unknown): NativeMatchmakingServerListRequest;
  matchmakingServersGetServerListRequestState(handle: bigint): NativeMatchmakingServerListRequestState;
  matchmakingServersGetServerListRequestServerDetails(handle: bigint, server: number): NativeMatchmakingServerItem | null | undefined;
  matchmakingServersRefreshServerListQuery(handle: bigint): void;
  matchmakingServersRefreshServerListServer(handle: bigint, server: number): void;
  matchmakingServersCancelServerListQuery(handle: bigint): void;
  matchmakingServersReleaseServerListRequest(handle: bigint): boolean;
  matchmakingServersPingServer(ip: number, queryPort: number, timeoutSeconds?: number): Promise<NativeMatchmakingServerPingResult>;
  matchmakingServersPlayerDetails(ip: number, queryPort: number, timeoutSeconds?: number): Promise<NativeMatchmakingServerPlayersResult>;
  matchmakingServersServerRules(ip: number, queryPort: number, timeoutSeconds?: number): Promise<NativeMatchmakingServerRulesResult>;
  matchmakingCreateLobby(lobbyType: number, maxMembers: number): Promise<NativeLobbyResult>;
  matchmakingJoinLobby(lobbyId: bigint): Promise<NativeLobbyResult>;
  matchmakingGetLobbies(): Promise<NativeLobbyResult[]>;
  matchmakingLeaveLobby(lobbyId: bigint): void;
  matchmakingGetLobbyMemberCount(lobbyId: bigint): number;
  matchmakingGetLobbyMemberLimit(lobbyId: bigint): number | null | undefined;
  matchmakingGetLobbyMembers(lobbyId: bigint): NativeSteamId[];
  matchmakingGetLobbyOwner(lobbyId: bigint): NativeSteamId;
  matchmakingSetLobbyJoinable(lobbyId: bigint, joinable: boolean): boolean;
  matchmakingGetLobbyData(lobbyId: bigint, key: string): string | null | undefined;
  matchmakingSetLobbyData(lobbyId: bigint, key: string, value: string): boolean;
  matchmakingDeleteLobbyData(lobbyId: bigint, key: string): boolean;
  matchmakingGetLobbyFullData(lobbyId: bigint): Record<string, string>;
  matchmakingInviteUserToLobby(lobbyId: bigint, steamId64: bigint): boolean;
  matchmakingGetLobbyMemberData(lobbyId: bigint, steamId64: bigint, key: string): string | null | undefined;
  matchmakingSetLobbyMemberData(lobbyId: bigint, key: string, value: string): void;
  matchmakingSendLobbyChatMsg(lobbyId: bigint, data: Buffer): boolean;
  matchmakingGetLobbyChatEntry(lobbyId: bigint, chatId: number, maxBytes?: number): NativeLobbyChatEntry | null | undefined;
  matchmakingRequestLobbyData(lobbyId: bigint): boolean;
  matchmakingSetLobbyGameServer(lobbyId: bigint, ip: number, port: number, steamId64: bigint): void;
  matchmakingGetLobbyGameServer(lobbyId: bigint): NativeLobbyGameServer | null | undefined;
  matchmakingSetLobbyMemberLimit(lobbyId: bigint, maxMembers: number): boolean;
  matchmakingSetLobbyType(lobbyId: bigint, lobbyType: number): boolean;
  matchmakingSetLobbyOwner(lobbyId: bigint, steamId64: bigint): boolean;
  matchmakingSetLinkedLobby(lobbyId: bigint, dependentLobbyId: bigint): boolean;

  clientCreateSteamPipe(): number;
  clientReleaseSteamPipe(pipe: number): boolean;
  clientConnectToGlobalUser(pipe: number): number;
  clientCreateLocalUser(accountType: number): NativeSteamClientLocalUser;
  clientReleaseUser(pipe: number, user: number): void;
  clientSetLocalIpBinding(ipv4: number, port: number): void;
  clientGetInterface(interfaceName: string, user?: number | null, pipe?: number | null, version?: string | null): bigint | null | undefined;
  clientGetIpcCallCount(): number;
  clientRegisterWarningMessageHook(handler: (event: NativeUtilsWarningMessage) => void): NativeCallbackHandle;
  clientShutdownIfAllPipesClosed(): boolean;

  workshopCreateItem(appId?: number | null): Promise<NativeUgcResult>;
  workshopUpdateItem(itemId: bigint, updateDetails: unknown, appId?: number | null): Promise<NativeUgcResult>;
  workshopUpdateItemWithProgress(
    itemId: bigint,
    updateDetails: unknown,
    appId: number | null | undefined,
    progressHandler: (data: unknown) => void,
    progressIntervalMs?: number | null
  ): Promise<NativeUgcResult>;
  workshopGetItemUpdateProgress(handle: bigint): NativeUpdateProgress;
  workshopSubscribe(itemId: bigint): Promise<void>;
  workshopUnsubscribe(itemId: bigint): Promise<void>;
  workshopAddFavorite(itemId: bigint, appId?: number | null): Promise<NativeWorkshopFavoriteResult>;
  workshopRemoveFavorite(itemId: bigint, appId?: number | null): Promise<NativeWorkshopFavoriteResult>;
  workshopSetUserItemVote(itemId: bigint, voteUp: boolean): Promise<NativeWorkshopSetUserItemVoteResult>;
  workshopGetUserItemVote(itemId: bigint): Promise<NativeWorkshopGetUserItemVoteResult>;
  workshopStartPlaytimeTracking(itemIds: bigint[]): Promise<NativeWorkshopSimpleResult>;
  workshopStopPlaytimeTracking(itemIds: bigint[]): Promise<NativeWorkshopSimpleResult>;
  workshopStopPlaytimeTrackingForAllItems(): Promise<NativeWorkshopSimpleResult>;
  workshopAddDependency(parentItemId: bigint, childItemId: bigint): Promise<NativeWorkshopDependencyResult>;
  workshopRemoveDependency(parentItemId: bigint, childItemId: bigint): Promise<NativeWorkshopDependencyResult>;
  workshopAddAppDependency(itemId: bigint, appId: number): Promise<NativeWorkshopAppDependencyResult>;
  workshopRemoveAppDependency(itemId: bigint, appId: number): Promise<NativeWorkshopAppDependencyResult>;
  workshopGetAppDependencies(itemId: bigint): Promise<NativeWorkshopAppDependenciesResult>;
  workshopDeleteItem(itemId: bigint): Promise<NativeWorkshopDeleteItemResult>;
  workshopShowEula(): boolean;
  workshopGetEulaStatus(): Promise<NativeWorkshopEulaStatus>;
  workshopGetUserContentDescriptorPreferences(maxEntries?: number | null): number[];
  workshopState(itemId: bigint): number;
  workshopInstallInfo(itemId: bigint): NativeWorkshopInstallInfo | null | undefined;
  workshopDownloadInfo(itemId: bigint): NativeWorkshopDownloadInfo | null | undefined;
  workshopDownload(itemId: bigint, highPriority: boolean): boolean;
  workshopInitWorkshopForGameServer(depotId: number, folder: string): boolean;
  workshopSuspendDownloads(suspend: boolean): void;
  workshopSetItemsDisabledLocally(itemIds: bigint[], disabled: boolean): boolean;
  workshopSetSubscriptionsLoadOrder(itemIds: bigint[]): boolean;
  workshopMarkDownloadedItemAsUnused(itemId: bigint): boolean;
  workshopGetDownloadedItems(maxEntries?: number | null): bigint[];
  workshopGetSubscribedItems(): bigint[];
  workshopGetItems(items: bigint[], queryConfig?: unknown): Promise<NativeWorkshopItemsResult>;
  workshopGetAllItems(
    page: number,
    queryType: number,
    itemType: number,
    creatorAppId: number,
    consumerAppId: number,
    queryConfig?: unknown
  ): Promise<NativeWorkshopItemsResult>;
  workshopGetAllItemsByCursor(
    cursor: string,
    queryType: number,
    itemType: number,
    creatorAppId: number,
    consumerAppId: number,
    queryConfig?: unknown
  ): Promise<NativeWorkshopItemsResult>;
  workshopGetUserItems(
    page: number,
    accountId: number,
    listType: number,
    itemType: number,
    sortOrder: number,
    creatorAppId: number,
    consumerAppId: number,
    queryConfig?: unknown
  ): Promise<NativeWorkshopItemsResult>;
  workshopRequestItemDetails(itemId: bigint, maxAgeSeconds?: number | null): Promise<unknown>;
  gameServerWorkshopCreateItem(appId?: number | null): Promise<NativeUgcResult>;
  gameServerWorkshopUpdateItem(itemId: bigint, updateDetails: unknown, appId?: number | null): Promise<NativeUgcResult>;
  gameServerWorkshopUpdateItemWithProgress(
    itemId: bigint,
    updateDetails: unknown,
    appId: number | null | undefined,
    progressHandler: (data: unknown) => void,
    progressIntervalMs?: number | null
  ): Promise<NativeUgcResult>;
  gameServerWorkshopGetItemUpdateProgress(handle: bigint): NativeUpdateProgress;
  gameServerWorkshopSubscribe(itemId: bigint): Promise<void>;
  gameServerWorkshopUnsubscribe(itemId: bigint): Promise<void>;
  gameServerWorkshopAddFavorite(itemId: bigint, appId?: number | null): Promise<NativeWorkshopFavoriteResult>;
  gameServerWorkshopRemoveFavorite(itemId: bigint, appId?: number | null): Promise<NativeWorkshopFavoriteResult>;
  gameServerWorkshopSetUserItemVote(itemId: bigint, voteUp: boolean): Promise<NativeWorkshopSetUserItemVoteResult>;
  gameServerWorkshopGetUserItemVote(itemId: bigint): Promise<NativeWorkshopGetUserItemVoteResult>;
  gameServerWorkshopStartPlaytimeTracking(itemIds: bigint[]): Promise<NativeWorkshopSimpleResult>;
  gameServerWorkshopStopPlaytimeTracking(itemIds: bigint[]): Promise<NativeWorkshopSimpleResult>;
  gameServerWorkshopStopPlaytimeTrackingForAllItems(): Promise<NativeWorkshopSimpleResult>;
  gameServerWorkshopAddDependency(parentItemId: bigint, childItemId: bigint): Promise<NativeWorkshopDependencyResult>;
  gameServerWorkshopRemoveDependency(parentItemId: bigint, childItemId: bigint): Promise<NativeWorkshopDependencyResult>;
  gameServerWorkshopAddAppDependency(itemId: bigint, appId: number): Promise<NativeWorkshopAppDependencyResult>;
  gameServerWorkshopRemoveAppDependency(itemId: bigint, appId: number): Promise<NativeWorkshopAppDependencyResult>;
  gameServerWorkshopGetAppDependencies(itemId: bigint): Promise<NativeWorkshopAppDependenciesResult>;
  gameServerWorkshopDeleteItem(itemId: bigint): Promise<NativeWorkshopDeleteItemResult>;
  gameServerWorkshopShowEula(): boolean;
  gameServerWorkshopGetEulaStatus(): Promise<NativeWorkshopEulaStatus>;
  gameServerWorkshopGetUserContentDescriptorPreferences(maxEntries?: number | null): number[];
  gameServerWorkshopState(itemId: bigint): number;
  gameServerWorkshopInstallInfo(itemId: bigint): NativeWorkshopInstallInfo | null | undefined;
  gameServerWorkshopDownloadInfo(itemId: bigint): NativeWorkshopDownloadInfo | null | undefined;
  gameServerWorkshopDownload(itemId: bigint, highPriority: boolean): boolean;
  gameServerWorkshopInitWorkshopForGameServer(depotId: number, folder: string): boolean;
  gameServerWorkshopSuspendDownloads(suspend: boolean): void;
  gameServerWorkshopSetItemsDisabledLocally(itemIds: bigint[], disabled: boolean): boolean;
  gameServerWorkshopSetSubscriptionsLoadOrder(itemIds: bigint[]): boolean;
  gameServerWorkshopMarkDownloadedItemAsUnused(itemId: bigint): boolean;
  gameServerWorkshopGetDownloadedItems(maxEntries?: number | null): bigint[];
  gameServerWorkshopGetSubscribedItems(): bigint[];
  gameServerWorkshopGetItems(items: bigint[], queryConfig?: unknown): Promise<NativeWorkshopItemsResult>;
  gameServerWorkshopGetAllItems(
    page: number,
    queryType: number,
    itemType: number,
    creatorAppId: number,
    consumerAppId: number,
    queryConfig?: unknown
  ): Promise<NativeWorkshopItemsResult>;
  gameServerWorkshopGetAllItemsByCursor(
    cursor: string,
    queryType: number,
    itemType: number,
    creatorAppId: number,
    consumerAppId: number,
    queryConfig?: unknown
  ): Promise<NativeWorkshopItemsResult>;
  gameServerWorkshopGetUserItems(
    page: number,
    accountId: number,
    listType: number,
    itemType: number,
    sortOrder: number,
    creatorAppId: number,
    consumerAppId: number,
    queryConfig?: unknown
  ): Promise<NativeWorkshopItemsResult>;
  gameServerWorkshopRequestItemDetails(itemId: bigint, maxAgeSeconds?: number | null): Promise<unknown>;
}

let binding: NativeBinding | undefined;

export function loadNativeBinding(): NativeBinding {
  if (binding) {
    return binding;
  }

  if (process.platform !== "darwin" || process.arch !== "arm64") {
    throw new Error("Steam Bridge supports Apple Silicon macOS only (aarch64-apple-darwin).");
  }

  const errors: string[] = [];
  for (const candidate of nativeCandidates()) {
    if (!candidate || !fs.existsSync(candidate)) {
      continue;
    }

    try {
      binding = require(candidate) as NativeBinding;
      return binding;
    } catch (error) {
      errors.push(`${candidate}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  throw new Error(
    [
      "Unable to load Steam Bridge native module.",
      "Run `npm run native:build`, publish/install a prebuild, or set STEAM_BRIDGE_NATIVE_PATH to a .node file.",
      ...errors
    ].join("\n")
  );
}

function nativeCandidates(): string[] {
  const packageRoot = path.resolve(__dirname, "..");
  const repoRoot = path.resolve(packageRoot, "..", "..");
  const taggedName = `steam_bridge_native.${process.platform}-${process.arch}.node`;

  return [
    process.env.STEAM_BRIDGE_NATIVE_PATH || "",
    path.join(packageRoot, "steam_bridge_native.local.node"),
    path.join(packageRoot, "steam_bridge_native.node"),
    path.join(packageRoot, taggedName),
    path.join(packageRoot, "native", taggedName),
    path.join(repoRoot, "target", "release", "steam_bridge_native.node")
  ];
}
