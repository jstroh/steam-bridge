const assert = require("node:assert/strict");
const path = require("node:path");
const test = require("node:test");

const repoRoot = path.resolve(__dirname, "..");
const distRoot = path.join(repoRoot, "packages", "steam-bridge", "dist");
const steamEnvKeys = ["SteamAppId", "SteamAppID", "STEAM_APP_ID"];

function distFile(fileName) {
  return path.join(distRoot, fileName);
}

function clearSteamBridgeCache() {
  for (const fileName of ["index.js", "native.js", "electron.js"]) {
    try {
      delete require.cache[require.resolve(distFile(fileName))];
    } catch {
      // The build step creates dist before tests run. This keeps direct test
      // execution from failing during cache cleanup.
    }
  }
}

function loadSteamWithFakeNative(fakeNative) {
  clearSteamBridgeCache();
  const nativeModule = require(distFile("native.js"));
  nativeModule.loadNativeBinding = () => fakeNative;
  return require(distFile("index.js"));
}

function setSteamEnv(values = {}) {
  const previous = new Map(steamEnvKeys.map((key) => [key, process.env[key]]));
  for (const key of steamEnvKeys) {
    delete process.env[key];
  }
  Object.assign(process.env, values);
  return () => {
    for (const key of steamEnvKeys) {
      const value = previous.get(key);
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  };
}

function createFakeNative(overrides = {}) {
  const calls = [];
  const callbacks = new Map();

  const fake = {
    calls,
    callbacks,
    init(appId) {
      calls.push({ method: "init", args: [appId] });
    },
    shutdown() {
      calls.push({ method: "shutdown", args: [] });
    },
    restartAppIfNecessary(appId) {
      calls.push({ method: "restartAppIfNecessary", args: [appId] });
      return false;
    },
    isSteamRunning() {
      return true;
    },
    getSteamInstallPath() {
      return "/tmp/steam";
    },
    runCallbacks() {
      calls.push({ method: "runCallbacks", args: [] });
    },
    getSteamId() {
      return { steamId64: "76561198000000000", steamId32: "STEAM_0:0:19867136", accountId: 39734272 };
    },
    isSteamDeck() {
      return false;
    },
    getAppId() {
      return 480;
    },
    isSteamInBigPictureMode() {
      return false;
    },
    isOverlayEnabled() {
      return true;
    },
    overlayNeedsPresent() {
      return false;
    },
    getOverlayDiagnostics() {
      return {
        steamRunning: true,
        steamInstallPath: "/tmp/steam",
        appId: 480,
        overlayEnabled: true,
        overlayNeedsPresent: false,
        steamDeck: false,
        bigPicture: false
      };
    },
    registerSteamCallback(callbackId, handler) {
      calls.push({ method: "registerSteamCallback", args: [callbackId] });
      callbacks.set(callbackId, handler);
      return {
        disconnect() {
          callbacks.delete(callbackId);
          calls.push({ method: "disconnectCallback", args: [callbackId] });
        }
      };
    },
    activateOverlay(dialog) {
      calls.push({ method: "activateOverlay", args: [dialog] });
    },
    activateOverlayToWebPage(url, modal) {
      calls.push({ method: "activateOverlayToWebPage", args: [url, modal] });
    },
    overlayActivateDialogToUser(dialog, steamId64) {
      calls.push({ method: "overlayActivateDialogToUser", args: [dialog, steamId64] });
    },
    overlayActivateInviteDialog(lobbyId) {
      calls.push({ method: "overlayActivateInviteDialog", args: [lobbyId] });
    },
    overlayActivateToStore(appId, flag) {
      calls.push({ method: "overlayActivateToStore", args: [appId, flag] });
    },
    cloudListFiles() {
      return [
        { name: "save.dat", size: "1024" },
        { name: "settings.json", size: 2048n }
      ];
    },
    inputGetControllers() {
      return [
        { handle: "123", inputType: "PS5Controller" },
        { handle: 456n, inputType: "FlightStick" }
      ];
    },
    networkingReadP2PPacket(size) {
      calls.push({ method: "networkingReadP2PPacket", args: [size] });
      return {
        data: Buffer.from("hello"),
        size: 5,
        steamId: { steamId64: "76561198000000001", steamId32: "STEAM_0:1:19867136", accountId: 39734273 }
      };
    },
    workshopUpdateItemWithProgress(itemId, updateDetails, appId, progressHandler, progressIntervalMs) {
      calls.push({
        method: "workshopUpdateItemWithProgress",
        args: [itemId, updateDetails, appId, progressIntervalMs]
      });
      progressHandler({ status: 3, progress: "128", total: "256" });
      return Promise.resolve({ item_id: "12345678901234567890", needs_to_accept_agreement: true });
    },
    workshopGetItems(items, queryConfig) {
      calls.push({ method: "workshopGetItems", args: [items, queryConfig] });
      return Promise.resolve({
        items: [
          {
            published_file_id: "12345678901234567890",
            creator_app_id: 480,
            consumer_app_id: 480,
            title: "Workshop Item",
            description: "Generic workshop item",
            owner: { steamId64: "76561198000000002", steamId32: "STEAM_0:0:19867137", accountId: 39734274 },
            visibility: 0,
            tags: ["example"],
            num_subscriptions: "12"
          }
        ],
        was_cached: true
      });
    },
    ...overrides
  };

  return fake;
}

test("init reads the Steam app ID from the environment and returns the grouped client", (t) => {
  const restoreEnv = setSteamEnv({ STEAM_APP_ID: "480" });
  const fake = createFakeNative();
  const steam = loadSteamWithFakeNative(fake);

  t.after(() => {
    try {
      steam.shutdown();
    } finally {
      restoreEnv();
      clearSteamBridgeCache();
    }
  });

  const client = steam.init();

  assert.deepEqual(fake.calls[0], { method: "init", args: [480] });
  assert.equal(client.overlay, steam.overlay);
  assert.equal(client.workshop, steam.workshop);
  assert.equal(client.friends, steam.friends);
  assert.equal(client.timeline, steam.timeline);
  assert.equal(client.remotePlay, steam.remotePlay);
  assert.equal(client.localplayer.getSteamId().steamId64, 76561198000000000n);
});

test("init rejects missing app IDs with an actionable error", (t) => {
  const restoreEnv = setSteamEnv();
  const fake = createFakeNative();
  const steam = loadSteamWithFakeNative(fake);

  t.after(() => {
    restoreEnv();
    clearSteamBridgeCache();
  });

  assert.throws(() => steam.init(), /requires an appId or STEAM_APP_ID/);
  assert.equal(fake.calls.some((call) => call.method === "init"), false);
});

test("Steam IDs and diagnostics are normalized for JavaScript callers", (t) => {
  const fake = createFakeNative();
  const steam = loadSteamWithFakeNative(fake);

  t.after(clearSteamBridgeCache);

  assert.deepEqual(steam.getSteamId(), {
    steamId64: 76561198000000000n,
    steamId32: "STEAM_0:0:19867136",
    accountId: 39734272
  });
  assert.deepEqual(steam.utils.getOverlayDiagnostics(), {
    steamRunning: true,
    steamInstallPath: "/tmp/steam",
    appId: 480,
    overlayEnabled: true,
    overlayNeedsPresent: false,
    steamDeck: false,
    bigPicture: false,
    platform: process.platform,
    arch: process.arch,
    pid: process.pid
  });
});

test("specific and generic callbacks normalize Steamworks payloads", (t) => {
  const fake = createFakeNative();
  const steam = loadSteamWithFakeNative(fake);

  t.after(clearSteamBridgeCache);

  let txnEvent;
  const txnHandle = steam.onMicroTxnAuthorizationResponse((event) => {
    txnEvent = event;
  });

  fake.callbacks.get(steam.SteamCallback.MicroTxnAuthorizationResponse)({
    app_id: 480,
    order_id: "9223372036854775807",
    authorized: true
  });

  assert.equal(txnEvent.appId, 480);
  assert.equal(txnEvent.orderId, 9223372036854775807n);
  assert.equal(txnEvent.authorized, true);

  let lobbyEvent;
  steam.callback.register(steam.SteamCallback.LobbyDataUpdate, (event) => {
    lobbyEvent = event;
  });
  fake.callbacks.get(steam.SteamCallback.LobbyDataUpdate)({
    lobby: "109775242022617907",
    member: "76561198000000000",
    remote: 42,
    note: "kept"
  });

  assert.equal(lobbyEvent.lobby, 109775242022617907n);
  assert.equal(lobbyEvent.member, 76561198000000000n);
  assert.equal(lobbyEvent.remote, 42n);
  assert.equal(lobbyEvent.note, "kept");

  txnHandle.disconnect();
  assert.equal(fake.callbacks.has(steam.SteamCallback.MicroTxnAuthorizationResponse), false);
});

test("overlay helpers map constants and forward modal/store options", (t) => {
  const fake = createFakeNative();
  const steam = loadSteamWithFakeNative(fake);

  t.after(clearSteamBridgeCache);

  steam.overlay.activateDialog(steam.Dialog.Achievements);
  steam.overlay.activateToWebPage("https://store.steampowered.com/app/480/", { modal: true });
  steam.overlay.activateDialogToUser(steam.Dialog.Friends, 76561198000000000n);
  steam.overlay.activateToStore(480, steam.StoreFlag.AddToCart);

  assert.deepEqual(
    fake.calls.filter((call) => call.method.startsWith("activate") || call.method.startsWith("overlay")),
    [
      { method: "activateOverlay", args: ["Achievements"] },
      { method: "activateOverlayToWebPage", args: ["https://store.steampowered.com/app/480/", true] },
      { method: "overlayActivateDialogToUser", args: ["Friends", 76561198000000000n] },
      { method: "overlayActivateToStore", args: [480, steam.StoreFlag.AddToCart] }
    ]
  );
});

test("cloud, input, and networking facades coerce native values", (t) => {
  const fake = createFakeNative();
  const steam = loadSteamWithFakeNative(fake);

  t.after(clearSteamBridgeCache);

  const files = steam.cloud.listFiles();
  assert.equal(files[0].name, "save.dat");
  assert.equal(files[0].size, 1024n);
  assert.equal(files[1].size, 2048n);

  const controllers = steam.input.getControllers();
  assert.equal(controllers[0].getHandle(), 123n);
  assert.equal(controllers[0].getType(), steam.InputType.PS5Controller);
  assert.equal(controllers[1].getType(), steam.InputType.Unknown);

  const packet = steam.networking.readP2PPacket(64);
  assert.deepEqual(packet.data, Buffer.from("hello"));
  assert.equal(packet.steamId.steamId64, 76561198000000001n);
});

test("friends facade normalizes IDs, groups, rich presence, and async results", async (t) => {
  const friend = { steamId64: "76561198000000003", steamId32: "STEAM_0:1:19867137", accountId: 39734275 };
  const clan = { steamId64: "103582791429521412", steamId32: "STEAM_0:0:0", accountId: 0 };
  const friendFlagArgs = [];
  const fake = createFakeNative({
    friendsGetPersonaName() {
      return "Ada";
    },
    friendsGetPersonaState() {
      return 1;
    },
    friendsGetFriendCount(friendFlags) {
      friendFlagArgs.push(friendFlags);
      return 1;
    },
    friendsGetFriendByIndex(index, friendFlags) {
      friendFlagArgs.push({ index, friendFlags });
      return friend;
    },
    friendsGetFriends(friendFlags) {
      friendFlagArgs.push(friendFlags);
      return [friend];
    },
    friendsHasFriend(steamId64, friendFlags) {
      friendFlagArgs.push({ steamId64, friendFlags });
      return true;
    },
    friendsGetFriendGamePlayed() {
      return { game_id: "480", game_ip: 2130706433, game_port: 27015, query_port: 27016, lobby: "109775242022617907" };
    },
    friendsGetFriendsGroups() {
      return [{ id: 7, name: "Co-op", members: [friend] }];
    },
    friendsGetClanActivityCounts() {
      return { online: 5, in_game: 2, chatting: 1 };
    },
    friendsRequestClanOfficerList() {
      return Promise.resolve({ clan, officers: 4, success: true });
    },
    friendsJoinClanChatRoom() {
      return Promise.resolve({ clan_chat: clan, response: 1 });
    },
    friendsGetFriendRichPresence() {
      return "ready";
    },
    friendsGetFriendRichPresenceKeys() {
      return ["status"];
    },
    friendsInviteUserToGame() {
      return true;
    },
    friendsGetFollowerCount() {
      return Promise.resolve({ steam_id: friend, result: 1, count: 12 });
    },
    friendsIsFollowing() {
      return Promise.resolve({ steam_id: friend, result: 1, is_following: true });
    },
    friendsEnumerateFollowingList() {
      return Promise.resolve({ result: 1, steam_ids: [friend], returned_results: 1, total_results: 2 });
    }
  });
  const steam = loadSteamWithFakeNative(fake);

  t.after(clearSteamBridgeCache);

  assert.equal(steam.friends.getPersonaName(), "Ada");
  assert.equal(steam.friends.getPersonaState(), steam.PersonaState.Online);
  assert.equal(steam.friends.getFriendCount(), 1);
  assert.equal(friendFlagArgs[0], steam.FriendFlags.Immediate);
  assert.equal(steam.friends.getFriendByIndex(0).steamId64, 76561198000000003n);
  assert.equal(steam.friends.getFriends()[0].steamId64, 76561198000000003n);
  assert.equal(steam.friends.hasFriend(76561198000000003n), true);

  assert.deepEqual(steam.friends.getFriendGamePlayed(76561198000000003n), {
    gameId: 480n,
    gameIp: 2130706433,
    gamePort: 27015,
    queryPort: 27016,
    lobby: 109775242022617907n
  });
  assert.deepEqual(steam.friends.getFriendsGroups()[0], {
    id: 7,
    name: "Co-op",
    members: [{ steamId64: 76561198000000003n, steamId32: "STEAM_0:1:19867137", accountId: 39734275 }]
  });
  assert.deepEqual(steam.friends.getClanActivityCounts(103582791429521412n), {
    online: 5,
    inGame: 2,
    chatting: 1
  });
  assert.deepEqual(await steam.friends.requestClanOfficerList(103582791429521412n), {
    clan: { steamId64: 103582791429521412n, steamId32: "STEAM_0:0:0", accountId: 0 },
    officers: 4,
    success: true
  });
  assert.deepEqual(await steam.friends.joinClanChatRoom(103582791429521412n), {
    clanChat: { steamId64: 103582791429521412n, steamId32: "STEAM_0:0:0", accountId: 0 },
    response: steam.ChatRoomEnterResponse.Success
  });
  assert.deepEqual(steam.friends.getFriendRichPresenceKeys(76561198000000003n), ["status"]);
  assert.equal(steam.friends.getFriendRichPresence(76561198000000003n, "status"), "ready");
  assert.equal(steam.friends.inviteUserToGame(76561198000000003n, "+connect_lobby 109775242022617907"), true);
  assert.equal((await steam.friends.getFollowerCount(76561198000000003n)).count, 12);
  assert.equal((await steam.friends.isFollowing(76561198000000003n)).isFollowing, true);
  assert.deepEqual(await steam.friends.enumerateFollowingList(), {
    result: 1,
    steamIds: [{ steamId64: 76561198000000003n, steamId32: "STEAM_0:1:19867137", accountId: 39734275 }],
    returnedResults: 1,
    totalResults: 2
  });
});

test("screenshots, music, video, and parental facades forward utility interfaces", (t) => {
  const fake = createFakeNative({
    screenshotsWriteScreenshot(rgb, width, height) {
      this.calls.push({ method: "screenshotsWriteScreenshot", args: [rgb, width, height] });
      return 101;
    },
    screenshotsAddScreenshotToLibrary(filename, thumbnailFilename, width, height) {
      this.calls.push({ method: "screenshotsAddScreenshotToLibrary", args: [filename, thumbnailFilename, width, height] });
      return 102;
    },
    screenshotsTriggerScreenshot() {
      this.calls.push({ method: "screenshotsTriggerScreenshot", args: [] });
    },
    screenshotsHookScreenshots(hook) {
      this.calls.push({ method: "screenshotsHookScreenshots", args: [hook] });
    },
    screenshotsSetLocation(handle, location) {
      this.calls.push({ method: "screenshotsSetLocation", args: [handle, location] });
      return true;
    },
    screenshotsTagUser(handle, steamId64) {
      this.calls.push({ method: "screenshotsTagUser", args: [handle, steamId64] });
      return true;
    },
    screenshotsTagPublishedFile(handle, publishedFileId) {
      this.calls.push({ method: "screenshotsTagPublishedFile", args: [handle, publishedFileId] });
      return true;
    },
    screenshotsIsScreenshotsHooked() {
      return true;
    },
    screenshotsAddVrScreenshotToLibrary(vrType, filename, vrFilename) {
      this.calls.push({ method: "screenshotsAddVrScreenshotToLibrary", args: [vrType, filename, vrFilename] });
      return 103;
    },
    musicIsEnabled() {
      return true;
    },
    musicIsPlaying() {
      return false;
    },
    musicGetPlaybackStatus() {
      return 2;
    },
    musicPlay() {
      this.calls.push({ method: "musicPlay", args: [] });
    },
    musicPause() {
      this.calls.push({ method: "musicPause", args: [] });
    },
    musicPlayPrevious() {
      this.calls.push({ method: "musicPlayPrevious", args: [] });
    },
    musicPlayNext() {
      this.calls.push({ method: "musicPlayNext", args: [] });
    },
    musicSetVolume(volume) {
      this.calls.push({ method: "musicSetVolume", args: [volume] });
    },
    musicGetVolume() {
      return 0.5;
    },
    videoRequestVideoUrl(appId) {
      this.calls.push({ method: "videoRequestVideoUrl", args: [appId] });
    },
    videoIsBroadcasting() {
      return { broadcasting: true, viewers: 42 };
    },
    videoRequestOpfSettings(appId) {
      this.calls.push({ method: "videoRequestOpfSettings", args: [appId] });
    },
    videoGetOpfStringForApp(appId) {
      this.calls.push({ method: "videoGetOpfStringForApp", args: [appId] });
      return "<opf />";
    },
    parentalIsParentalLockEnabled() {
      return true;
    },
    parentalIsParentalLockLocked() {
      return false;
    },
    parentalIsAppBlocked(appId) {
      return appId === 480;
    },
    parentalIsAppInBlockList(appId) {
      return appId === 480;
    },
    parentalIsFeatureBlocked(feature) {
      return feature === 4;
    },
    parentalIsFeatureInBlockList(feature) {
      return feature === 4;
    }
  });
  const steam = loadSteamWithFakeNative(fake);

  t.after(clearSteamBridgeCache);

  const rgb = Buffer.from([255, 0, 0]);
  assert.equal(steam.screenshots.writeScreenshot(rgb, 1, 1), 101);
  assert.equal(steam.screenshots.addScreenshotToLibrary("screen.png", null, 1920, 1080), 102);
  steam.screenshots.triggerScreenshot();
  steam.screenshots.hookScreenshots(true);
  assert.equal(steam.screenshots.setLocation(101, "Test Map"), true);
  assert.equal(steam.screenshots.tagUser(101, 76561198000000003n), true);
  assert.equal(steam.screenshots.tagPublishedFile(101, 12345678901234567890n), true);
  assert.equal(steam.screenshots.isScreenshotsHooked(), true);
  assert.equal(
    steam.screenshots.addVrScreenshotToLibrary(steam.VRScreenshotType.StereoPanorama, "screen.png", "screen_vr.png"),
    103
  );

  assert.equal(steam.music.isEnabled(), true);
  assert.equal(steam.music.isPlaying(), false);
  assert.equal(steam.music.getPlaybackStatus(), steam.AudioPlaybackStatus.Paused);
  steam.music.play();
  steam.music.pause();
  steam.music.playPrevious();
  steam.music.playNext();
  steam.music.setVolume(0.5);
  assert.equal(steam.music.getVolume(), 0.5);

  steam.video.requestVideoUrl(480);
  assert.deepEqual(steam.video.isBroadcasting(), { broadcasting: true, viewers: 42 });
  steam.video.requestOpfSettings(480);
  assert.equal(steam.video.getOpfStringForApp(480), "<opf />");

  assert.equal(steam.parental.isParentalLockEnabled(), true);
  assert.equal(steam.parental.isParentalLockLocked(), false);
  assert.equal(steam.parental.isAppBlocked(480), true);
  assert.equal(steam.parental.isAppInBlockList(480), true);
  assert.equal(steam.parental.isFeatureBlocked(steam.ParentalFeature.Friends), true);
  assert.equal(steam.parental.isFeatureInBlockList(steam.ParentalFeature.Friends), true);
});

test("timeline and remote play facades normalize timeline and session data", async (t) => {
  const player = { steamId64: "76561198000000004", steamId32: "STEAM_0:0:19867138", accountId: 39734276 };
  const fake = createFakeNative({
    timelineSetTimelineTooltip(description, timeDelta) {
      this.calls.push({ method: "timelineSetTimelineTooltip", args: [description, timeDelta] });
    },
    timelineClearTimelineTooltip(timeDelta) {
      this.calls.push({ method: "timelineClearTimelineTooltip", args: [timeDelta] });
    },
    timelineSetTimelineGameMode(mode) {
      this.calls.push({ method: "timelineSetTimelineGameMode", args: [mode] });
    },
    timelineAddInstantaneousTimelineEvent(...args) {
      this.calls.push({ method: "timelineAddInstantaneousTimelineEvent", args });
      return "9001";
    },
    timelineAddRangeTimelineEvent(...args) {
      this.calls.push({ method: "timelineAddRangeTimelineEvent", args });
      return 9002n;
    },
    timelineStartRangeTimelineEvent(...args) {
      this.calls.push({ method: "timelineStartRangeTimelineEvent", args });
      return 9003n;
    },
    timelineUpdateRangeTimelineEvent(...args) {
      this.calls.push({ method: "timelineUpdateRangeTimelineEvent", args });
    },
    timelineEndRangeTimelineEvent(...args) {
      this.calls.push({ method: "timelineEndRangeTimelineEvent", args });
    },
    timelineRemoveTimelineEvent(event) {
      this.calls.push({ method: "timelineRemoveTimelineEvent", args: [event] });
    },
    timelineDoesEventRecordingExist() {
      return Promise.resolve({ event: "9001", recording_exists: true });
    },
    timelineStartGamePhase() {
      this.calls.push({ method: "timelineStartGamePhase", args: [] });
    },
    timelineEndGamePhase() {
      this.calls.push({ method: "timelineEndGamePhase", args: [] });
    },
    timelineSetGamePhaseId(phaseId) {
      this.calls.push({ method: "timelineSetGamePhaseId", args: [phaseId] });
    },
    timelineDoesGamePhaseRecordingExist() {
      return Promise.resolve({
        phase_id: "round-1",
        recording_ms: "1500",
        longest_clip_ms: "750",
        clip_count: 2,
        screenshot_count: 3
      });
    },
    timelineAddGamePhaseTag(...args) {
      this.calls.push({ method: "timelineAddGamePhaseTag", args });
    },
    timelineSetGamePhaseAttribute(...args) {
      this.calls.push({ method: "timelineSetGamePhaseAttribute", args });
    },
    timelineOpenOverlayToGamePhase(phaseId) {
      this.calls.push({ method: "timelineOpenOverlayToGamePhase", args: [phaseId] });
    },
    timelineOpenOverlayToTimelineEvent(event) {
      this.calls.push({ method: "timelineOpenOverlayToTimelineEvent", args: [event] });
    },
    remotePlayGetSessionCount() {
      return 1;
    },
    remotePlayGetSessionId(index) {
      return index === 0 ? 42 : 0;
    },
    remotePlayGetSessions() {
      return [
        {
          id: 42,
          remote_play_together: true,
          steam_id: player,
          guest_id: 77,
          small_avatar: 11,
          medium_avatar: 12,
          large_avatar: 13,
          client_name: "Living Room",
          client_form_factor: 4,
          resolution: { width: 1920, height: 1080 }
        }
      ];
    },
    remotePlayIsRemotePlayTogether() {
      return true;
    },
    remotePlayGetSessionSteamId() {
      return player;
    },
    remotePlayGetSessionGuestId() {
      return 77;
    },
    remotePlayGetSmallSessionAvatar() {
      return 11;
    },
    remotePlayGetMediumSessionAvatar() {
      return 12;
    },
    remotePlayGetLargeSessionAvatar() {
      return 13;
    },
    remotePlayGetSessionClientName() {
      return "Living Room";
    },
    remotePlayGetSessionClientFormFactor() {
      return 4;
    },
    remotePlayGetSessionClientResolution() {
      return { width: 1920, height: 1080 };
    },
    remotePlayShowRemotePlayTogetherUi() {
      return true;
    },
    remotePlaySendRemotePlayTogetherInvite(steamId64) {
      this.calls.push({ method: "remotePlaySendRemotePlayTogetherInvite", args: [steamId64] });
      return true;
    },
    remotePlayEnableRemotePlayTogetherDirectInput() {
      return true;
    },
    remotePlayDisableRemotePlayTogetherDirectInput() {
      this.calls.push({ method: "remotePlayDisableRemotePlayTogetherDirectInput", args: [] });
    },
    remotePlayGetInput(maxEvents) {
      this.calls.push({ method: "remotePlayGetInput", args: [maxEvents] });
      return [
        { session_id: 42, input_type: 1, absolute: true, normalized_x: 0.25, normalized_y: 0.75, delta_x: 3, delta_y: -2 },
        { session_id: 42, input_type: 5, scancode: 4, modifiers: 1, keycode: 65 }
      ];
    },
    remotePlaySetMouseVisibility(sessionId, visible) {
      this.calls.push({ method: "remotePlaySetMouseVisibility", args: [sessionId, visible] });
    },
    remotePlaySetMousePosition(sessionId, normalizedX, normalizedY) {
      this.calls.push({ method: "remotePlaySetMousePosition", args: [sessionId, normalizedX, normalizedY] });
    },
    remotePlayCreateMouseCursor(width, height, hotX, hotY, bgra, pitch) {
      this.calls.push({ method: "remotePlayCreateMouseCursor", args: [width, height, hotX, hotY, bgra, pitch] });
      return 1234;
    },
    remotePlaySetMouseCursor(sessionId, cursorId) {
      this.calls.push({ method: "remotePlaySetMouseCursor", args: [sessionId, cursorId] });
    }
  });
  const steam = loadSteamWithFakeNative(fake);

  t.after(clearSteamBridgeCache);

  steam.timeline.setTimelineTooltip("Overtime", 0.5);
  steam.timeline.clearTimelineTooltip(0.25);
  steam.timeline.setTimelineGameMode(steam.TimelineGameMode.Playing);
  assert.equal(
    steam.timeline.addInstantaneousTimelineEvent("Goal", "Scored", "icon", 100, -1, steam.TimelineEventClipPriority.Standard),
    9001n
  );
  assert.equal(steam.timeline.addRangeTimelineEvent("Boss", "Fight", "boss", 100, 0, 30, 3), 9002n);
  assert.equal(steam.timeline.startRangeTimelineEvent("Round", "Start", "round", 100, 0, 2), 9003n);
  steam.timeline.updateRangeTimelineEvent(9003n, "Round", "Updated", "round", steam.TimelinePriority.KeepCurrentValue, 2);
  steam.timeline.endRangeTimelineEvent(9003n, 0);
  steam.timeline.removeTimelineEvent(9003n);
  assert.deepEqual(await steam.timeline.doesEventRecordingExist(9001n), { event: 9001n, recordingExists: true });
  steam.timeline.startGamePhase();
  steam.timeline.setGamePhaseId("round-1");
  assert.deepEqual(await steam.timeline.doesGamePhaseRecordingExist("round-1"), {
    phaseId: "round-1",
    recordingMs: 1500n,
    longestClipMs: 750n,
    clipCount: 2,
    screenshotCount: 3
  });
  steam.timeline.addGamePhaseTag("boss", "icon", "encounter", 100);
  steam.timeline.setGamePhaseAttribute("difficulty", "hard", 100);
  steam.timeline.openOverlayToGamePhase("round-1");
  steam.timeline.openOverlayToTimelineEvent(9001n);
  steam.timeline.endGamePhase();

  assert.equal(steam.remotePlay.getSessionCount(), 1);
  assert.equal(steam.remotePlay.getSessionId(0), 42);
  assert.equal(steam.remotePlay.getSessions()[0].steamId.steamId64, 76561198000000004n);
  assert.deepEqual(steam.remotePlay.getSessions()[0].resolution, { width: 1920, height: 1080 });
  assert.equal(steam.remotePlay.isRemotePlayTogether(42), true);
  assert.equal(steam.remotePlay.getSessionSteamId(42).steamId64, 76561198000000004n);
  assert.equal(steam.remotePlay.getSessionGuestId(42), 77);
  assert.equal(steam.remotePlay.getSmallSessionAvatar(42), 11);
  assert.equal(steam.remotePlay.getMediumSessionAvatar(42), 12);
  assert.equal(steam.remotePlay.getLargeSessionAvatar(42), 13);
  assert.equal(steam.remotePlay.getSessionClientName(42), "Living Room");
  assert.equal(steam.remotePlay.getSessionClientFormFactor(42), steam.RemotePlayDeviceFormFactor.TV);
  assert.deepEqual(steam.remotePlay.getSessionClientResolution(42), { width: 1920, height: 1080 });
  assert.equal(steam.remotePlay.showRemotePlayTogetherUi(), true);
  assert.equal(steam.remotePlay.sendRemotePlayTogetherInvite(76561198000000004n), true);
  assert.equal(steam.remotePlay.enableRemotePlayTogetherDirectInput(), true);
  steam.remotePlay.disableRemotePlayTogetherDirectInput();
  assert.equal(steam.remotePlay.getInput(2)[0].normalizedX, 0.25);
  assert.equal(steam.remotePlay.getInput(2)[1].keycode, 65);
  steam.remotePlay.setMouseVisibility(42, true);
  steam.remotePlay.setMousePosition(42, 0.5, 0.5);
  assert.equal(steam.remotePlay.createMouseCursor(1, 1, 0, 0, Buffer.from([0, 0, 0, 255]), 4), 1234);
  steam.remotePlay.setMouseCursor(42, 1234);
});

test("workshop updates and queries normalize progress, IDs, and snake_case fields", async (t) => {
  const fake = createFakeNative();
  const steam = loadSteamWithFakeNative(fake);

  t.after(clearSteamBridgeCache);

  const progressEvents = [];
  const updateDetails = { title: "Generic Workshop Item" };
  const updateResult = await new Promise((resolve, reject) => {
    steam.workshop.updateItemWithCallback(
      42n,
      updateDetails,
      480,
      resolve,
      reject,
      (progress) => progressEvents.push(progress),
      250
    );
  });

  assert.deepEqual(progressEvents, [{ status: 3, progress: 128n, total: 256n }]);
  assert.deepEqual(updateResult, {
    itemId: 12345678901234567890n,
    needsToAcceptAgreement: true
  });

  const updateCall = fake.calls.find((call) => call.method === "workshopUpdateItemWithProgress");
  assert.deepEqual(updateCall.args, [42n, updateDetails, 480, 250]);

  const itemsResult = await steam.workshop.getItems([12345678901234567890n], { includeMetadata: true });
  assert.equal(itemsResult.wasCached, true);
  assert.equal(itemsResult.items[0].publishedFileId, 12345678901234567890n);
  assert.equal(itemsResult.items[0].creatorAppId, 480);
  assert.equal(itemsResult.items[0].owner.steamId64, 76561198000000002n);
  assert.equal(itemsResult.items[0].statistics.numSubscriptions, 12n);
});
