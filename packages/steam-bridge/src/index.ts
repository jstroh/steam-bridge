import {
  electronConfigureSteamOverlay as electronConfigureSteamOverlayImpl,
  electronEnableSteamOverlay as electronEnableSteamOverlayImpl
} from "./electron";
import {
  loadNativeBinding,
  NativeAuthTicket,
  NativeBinding,
  NativeCallbackHandle,
  NativeClanActivityCounts,
  NativeClanChatJoinResult,
  NativeClanOfficerListResult,
  NativeCloudFileInfo,
  NativeFollowerCountResult,
  NativeFollowingListResult,
  NativeFriendGameInfo,
  NativeFriendsGroupInfo,
  NativeInputControllerInfo,
  NativeIsFollowingResult,
  NativeOverlayDiagnostics,
  NativeP2PPacket,
  NativeSteamId,
  NativeUgcResult,
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

export interface FriendsGroupInfo {
  id: number;
  name: string;
  members: SteamId[];
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

export interface P2PPacket {
  data: Buffer;
  size: number;
  steamId: SteamId;
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
  GameOverlayActivated: 331
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
  Invisible: 3
} as const;

export const SendType = {
  Unreliable: 0,
  UnreliableNoDelay: 1,
  Reliable: 2,
  ReliableWithBuffering: 3
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
  }
};

export const matchmaking = {
  LobbyType,
  Lobby,
  async createLobby(lobbyType: number, maxMembers: number): Promise<Lobby> {
    const result = await native().matchmakingCreateLobby(lobbyType, maxMembers);
    return new Lobby(BigInt(result.id));
  },
  async joinLobby(lobbyId: bigint): Promise<Lobby> {
    const result = await native().matchmakingJoinLobby(lobbyId);
    return new Lobby(BigInt(result.id));
  },
  async getLobbies(): Promise<Lobby[]> {
    const result = await native().matchmakingGetLobbies();
    return result.map((lobby) => new Lobby(BigInt(lobby.id)));
  }
};

export const networking = {
  SendType,
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
  getInt(name: string): number | null {
    return native().statsGetInt(name) ?? null;
  },
  setInt(name: string, value: number): boolean {
    return native().statsSetInt(name, value);
  },
  store(): boolean {
    return native().statsStore();
  },
  resetAll(achievementsToo: boolean): boolean {
    return native().statsResetAll(achievementsToo);
  }
};

export const utils = {
  GamepadTextInputMode,
  GamepadTextInputLineMode,
  FloatingGamepadTextInputMode,
  getAppId,
  getServerRealTime(): number {
    return native().utilsGetServerRealTime();
  },
  isSteamRunningOnSteamDeck: isSteamDeck,
  isSteamRunning,
  getSteamInstallPath,
  isSteamInBigPictureMode,
  isOverlayEnabled,
  overlayNeedsPresent,
  getOverlayDiagnostics,
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
  input: typeof input;
  localplayer: typeof localplayer;
  matchmaking: typeof matchmaking;
  networking: typeof networking;
  overlay: typeof overlay;
  stats: typeof stats;
  utils: typeof utils;
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
    input,
    localplayer,
    matchmaking,
    networking,
    overlay,
    stats,
    utils,
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

function normalizeFriendsGroupInfo(group: NativeFriendsGroupInfo): FriendsGroupInfo {
  return {
    id: group.id,
    name: group.name,
    members: (group.members ?? []).map(normalizeSteamId)
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
  if (!event || typeof event !== "object") {
    return event;
  }
  const source = event as Record<string, unknown>;
  const result: Record<string, unknown> = { ...source };
  for (const key of ["steam_id", "lobby", "member", "user_changed", "making_change", "remote", "lobby_steam_id", "friend_steam_id"]) {
    if (key in result) {
      result[key] = normalizeBigIntLike(result[key]);
    }
  }
  return result;
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
  input,
  localplayer,
  matchmaking,
  networking,
  overlay,
  stats,
  utils,
  workshop,
  electronConfigureSteamOverlay,
  electronEnableSteamOverlay,
  SteamCallback
};

export default defaultExport;
