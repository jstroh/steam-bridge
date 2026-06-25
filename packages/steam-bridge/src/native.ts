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
  size: bigint;
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

export interface NativeP2PPacket {
  data: Buffer;
  size: number;
  steamId: NativeSteamId;
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

export interface NativeUtilsFilteredText {
  filtered: string;
  charactersFiltered?: number;
  characters_filtered?: number;
}

export interface NativeBinding {
  init(appId: number): void;
  shutdown(): void;
  restartAppIfNecessary(appId: number): boolean;
  isSteamRunning(): boolean;
  getSteamInstallPath(): string | undefined;
  runCallbacks(): void;

  getSteamId(): NativeSteamId;
  getAuthTicketForWebApi(identity: string, timeoutSeconds?: number): Promise<NativeAuthTicket>;
  authGetSessionTicketWithSteamId(steamId64: bigint, timeoutSeconds?: number): Promise<NativeAuthTicket>;
  authGetSessionTicketWithIp(ip: string, timeoutSeconds?: number): Promise<NativeAuthTicket>;

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
  cloudDeleteFile(name: string): boolean;
  cloudFileExists(name: string): boolean;
  cloudListFiles(): NativeCloudFileInfo[];

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

  inputInit(): void;
  inputShutdown(): void;
  inputGetControllers(): NativeInputControllerInfo[];
  inputGetActionSet(actionSetName: string): bigint;
  inputGetDigitalAction(actionName: string): bigint;
  inputGetAnalogAction(actionName: string): bigint;
  inputActivateActionSet(controller: bigint, actionSet: bigint): void;
  inputIsDigitalActionPressed(controller: bigint, action: bigint): boolean;
  inputGetAnalogActionVector(controller: bigint, action: bigint): NativeAnalogActionVector;
  inputGetControllerType(controller: bigint): string;

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
  networkingIdentityToString(identity: NativeNetworkingIdentity): string;
  networkingIdentityParse(text: string): NativeNetworkingIdentityInfo | null | undefined;
  networkingMessagesSendMessageToUser(identity: NativeNetworkingIdentity, data: Buffer, sendFlags?: number, channel?: number): number;
  networkingMessagesReceiveMessagesOnChannel(channel: number, maxMessages?: number): NativeNetworkingMessage[];
  networkingMessagesAcceptSessionWithUser(identity: NativeNetworkingIdentity): boolean;
  networkingMessagesCloseSessionWithUser(identity: NativeNetworkingIdentity): boolean;
  networkingMessagesCloseChannelWithUser(identity: NativeNetworkingIdentity, channel: number): boolean;
  networkingMessagesGetSessionConnectionInfo(identity: NativeNetworkingIdentity): NativeNetworkingMessagesSessionConnectionInfo;
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
  workshopState(itemId: bigint): number;
  workshopInstallInfo(itemId: bigint): NativeWorkshopInstallInfo | null | undefined;
  workshopDownloadInfo(itemId: bigint): NativeWorkshopDownloadInfo | null | undefined;
  workshopDownload(itemId: bigint, highPriority: boolean): boolean;
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
}

let binding: NativeBinding | undefined;

export function loadNativeBinding(): NativeBinding {
  if (binding) {
    return binding;
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
