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
  assert.equal(client.gameServer, steam.gameServer);
  assert.equal(client.gameServerStats, steam.gameServerStats);
  assert.equal(client.http, steam.http);
  assert.equal(client.inventory, steam.inventory);
  assert.equal(client.matchmakingServers, steam.matchmakingServers);
  assert.equal(client.parties, steam.parties);
  assert.equal(client.user, steam.user);
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

test("user facade covers voice, auth session, account, and duration helpers", async (t) => {
  const ticketBytes = Buffer.from([9, 8, 7]);
  const fake = createFakeNative({
    userStartVoiceRecording() {
      this.calls.push({ method: "userStartVoiceRecording", args: [] });
    },
    userStopVoiceRecording() {
      this.calls.push({ method: "userStopVoiceRecording", args: [] });
    },
    userGetAvailableVoice(sampleRate) {
      this.calls.push({ method: "userGetAvailableVoice", args: [sampleRate] });
      return { result: 0, compressed_bytes: 4, uncompressedBytes: 8 };
    },
    userGetVoice(wantCompressed, compressedBufferBytes, wantUncompressed, uncompressedBufferBytes, sampleRate) {
      this.calls.push({
        method: "userGetVoice",
        args: [wantCompressed, compressedBufferBytes, wantUncompressed, uncompressedBufferBytes, sampleRate]
      });
      return {
        result: 0,
        compressed: Buffer.from([1, 2]),
        uncompressed: Buffer.from([3, 4]),
        compressed_bytes: 2,
        uncompressedBytes: 2
      };
    },
    userDecompressVoice(compressed, maxBytes, desiredSampleRate) {
      this.calls.push({ method: "userDecompressVoice", args: [compressed, maxBytes, desiredSampleRate] });
      return {
        result: 0,
        uncompressed: Buffer.from([5, 6, 7]),
        compressedBytes: compressed.length,
        uncompressed_bytes: 3
      };
    },
    userGetVoiceOptimalSampleRate() {
      this.calls.push({ method: "userGetVoiceOptimalSampleRate", args: [] });
      return 48000;
    },
    userGetUserDataFolder() {
      this.calls.push({ method: "userGetUserDataFolder", args: [] });
      return "/tmp/steam-user";
    },
    userTrackAppUsageEvent(gameId, event, extraInfo) {
      this.calls.push({ method: "userTrackAppUsageEvent", args: [gameId, event, extraInfo] });
    },
    userBeginAuthSession(ticket, steamId64) {
      this.calls.push({ method: "userBeginAuthSession", args: [ticket, steamId64] });
      return 0;
    },
    userEndAuthSession(steamId64) {
      this.calls.push({ method: "userEndAuthSession", args: [steamId64] });
    },
    userCancelAuthTicket(authTicket) {
      this.calls.push({ method: "userCancelAuthTicket", args: [authTicket] });
    },
    userHasLicenseForApp(steamId64, appId) {
      this.calls.push({ method: "userHasLicenseForApp", args: [steamId64, appId] });
      return 0;
    },
    userIsBehindNat() {
      this.calls.push({ method: "userIsBehindNat", args: [] });
      return true;
    },
    userAdvertiseGame(steamId64, ip, port) {
      this.calls.push({ method: "userAdvertiseGame", args: [steamId64, ip, port] });
    },
    userRequestEncryptedAppTicket(dataToInclude, timeoutSeconds) {
      this.calls.push({ method: "userRequestEncryptedAppTicket", args: [dataToInclude, timeoutSeconds] });
      return Promise.resolve({ result: 0, ticket: ticketBytes });
    },
    userGetEncryptedAppTicket(maxBytes) {
      this.calls.push({ method: "userGetEncryptedAppTicket", args: [maxBytes] });
      return ticketBytes;
    },
    userGetGameBadgeLevel(series, foil) {
      this.calls.push({ method: "userGetGameBadgeLevel", args: [series, foil] });
      return foil ? 2 : 1;
    },
    userGetPlayerSteamLevel() {
      this.calls.push({ method: "userGetPlayerSteamLevel", args: [] });
      return 42;
    },
    userRequestStoreAuthUrl(redirectUrl, timeoutSeconds) {
      this.calls.push({ method: "userRequestStoreAuthUrl", args: [redirectUrl, timeoutSeconds] });
      return Promise.resolve("https://store.steampowered.com/login/");
    },
    userIsPhoneVerified() {
      this.calls.push({ method: "userIsPhoneVerified", args: [] });
      return true;
    },
    userIsTwoFactorEnabled() {
      this.calls.push({ method: "userIsTwoFactorEnabled", args: [] });
      return true;
    },
    userIsPhoneIdentifying() {
      this.calls.push({ method: "userIsPhoneIdentifying", args: [] });
      return false;
    },
    userIsPhoneRequiringVerification() {
      this.calls.push({ method: "userIsPhoneRequiringVerification", args: [] });
      return false;
    },
    userGetMarketEligibility(timeoutSeconds) {
      this.calls.push({ method: "userGetMarketEligibility", args: [timeoutSeconds] });
      return Promise.resolve({
        allowed: false,
        not_allowed_reason: 64,
        allowedAtTime: 1234,
        steam_guard_required_days: 15,
        newDeviceCooldownDays: 7
      });
    },
    userGetDurationControl(timeoutSeconds) {
      this.calls.push({ method: "userGetDurationControl", args: [timeoutSeconds] });
      return Promise.resolve({
        result: 1,
        app_id: 480,
        applicable: true,
        seconds_last_5h: 3600,
        progress: 1,
        notification: 2,
        seconds_today: 7200,
        secondsRemaining: 1800
      });
    },
    userSetDurationControlOnlineState(onlineState) {
      this.calls.push({ method: "userSetDurationControlOnlineState", args: [onlineState] });
      return true;
    }
  });
  const steam = loadSteamWithFakeNative(fake);

  t.after(clearSteamBridgeCache);

  assert.equal(steam.user.VoiceResult.OK, 0);
  assert.equal(steam.user.BeginAuthSessionResult.DuplicateRequest, 2);
  assert.equal(steam.user.UserHasLicenseForAppResult.HasLicense, 0);
  assert.equal(steam.user.MarketNotAllowedReasonFlags.SteamGuardNotEnabled, 64);
  assert.equal(steam.user.DurationControlOnlineState.OnlineHighPri, 3);
  assert.equal(steam.user.DurationControlProgress.Half, 1);

  steam.user.startVoiceRecording();
  steam.user.stopVoiceRecording();
  assert.deepEqual(steam.user.getAvailableVoice(48000), {
    result: 0,
    compressedBytes: 4,
    uncompressedBytes: 8
  });
  assert.deepEqual(steam.user.getVoice(true, 256, true, 512, 48000), {
    result: 0,
    compressed: Buffer.from([1, 2]),
    uncompressed: Buffer.from([3, 4]),
    compressedBytes: 2,
    uncompressedBytes: 2
  });
  assert.deepEqual(steam.user.decompressVoice(Buffer.from([1, 2, 3]), 1024, 48000), {
    result: 0,
    compressed: null,
    uncompressed: Buffer.from([5, 6, 7]),
    compressedBytes: 3,
    uncompressedBytes: 3
  });
  assert.equal(steam.user.getVoiceOptimalSampleRate(), 48000);
  assert.equal(steam.user.getUserDataFolder(), "/tmp/steam-user");
  steam.user.trackAppUsageEvent(480n, 1, "menu");
  assert.equal(steam.user.beginAuthSession(Buffer.from([1, 2]), 76561198000000000n), 0);
  steam.user.endAuthSession(76561198000000000n);
  steam.user.cancelAuthTicket(123);
  assert.equal(steam.user.hasLicenseForApp(76561198000000000n, 480), 0);
  assert.equal(steam.user.isBehindNAT(), true);
  steam.user.advertiseGame(76561198000000000n, 2130706433, 27015);
  assert.deepEqual(await steam.user.requestEncryptedAppTicket("abc", 7), {
    result: 0,
    ticket: ticketBytes
  });
  assert.deepEqual(steam.user.getEncryptedAppTicket(4096), ticketBytes);
  assert.equal(steam.user.getGameBadgeLevel(1, true), 2);
  assert.equal(steam.user.getPlayerSteamLevel(), 42);
  assert.equal(await steam.user.requestStoreAuthURL("https://example.test/return", 5), "https://store.steampowered.com/login/");
  assert.equal(steam.user.isPhoneVerified(), true);
  assert.equal(steam.user.isTwoFactorEnabled(), true);
  assert.equal(steam.user.isPhoneIdentifying(), false);
  assert.equal(steam.user.isPhoneRequiringVerification(), false);
  assert.deepEqual(await steam.user.getMarketEligibility(6), {
    allowed: false,
    notAllowedReason: 64,
    allowedAtTime: 1234,
    steamGuardRequiredDays: 15,
    newDeviceCooldownDays: 7
  });
  assert.deepEqual(await steam.user.getDurationControl(8), {
    result: 1,
    appId: 480,
    applicable: true,
    secondsLast5h: 3600,
    progress: 1,
    notification: 2,
    secondsToday: 7200,
    secondsRemaining: 1800
  });
  assert.equal(steam.user.setDurationControlOnlineState(steam.user.DurationControlOnlineState.Online), true);

  assert.deepEqual(
    fake.calls.filter((call) => call.method.startsWith("user")),
    [
      { method: "userStartVoiceRecording", args: [] },
      { method: "userStopVoiceRecording", args: [] },
      { method: "userGetAvailableVoice", args: [48000] },
      { method: "userGetVoice", args: [true, 256, true, 512, 48000] },
      { method: "userDecompressVoice", args: [Buffer.from([1, 2, 3]), 1024, 48000] },
      { method: "userGetVoiceOptimalSampleRate", args: [] },
      { method: "userGetUserDataFolder", args: [] },
      { method: "userTrackAppUsageEvent", args: [480n, 1, "menu"] },
      { method: "userBeginAuthSession", args: [Buffer.from([1, 2]), 76561198000000000n] },
      { method: "userEndAuthSession", args: [76561198000000000n] },
      { method: "userCancelAuthTicket", args: [123] },
      { method: "userHasLicenseForApp", args: [76561198000000000n, 480] },
      { method: "userIsBehindNat", args: [] },
      { method: "userAdvertiseGame", args: [76561198000000000n, 2130706433, 27015] },
      { method: "userRequestEncryptedAppTicket", args: [Buffer.from("abc"), 7] },
      { method: "userGetEncryptedAppTicket", args: [4096] },
      { method: "userGetGameBadgeLevel", args: [1, true] },
      { method: "userGetPlayerSteamLevel", args: [] },
      { method: "userRequestStoreAuthUrl", args: ["https://example.test/return", 5] },
      { method: "userIsPhoneVerified", args: [] },
      { method: "userIsTwoFactorEnabled", args: [] },
      { method: "userIsPhoneIdentifying", args: [] },
      { method: "userIsPhoneRequiringVerification", args: [] },
      { method: "userGetMarketEligibility", args: [6] },
      { method: "userGetDurationControl", args: [8] },
      { method: "userSetDurationControlOnlineState", args: [2] }
    ]
  );
});

test("game server facade covers lifecycle, metadata, auth, async status, and packet helpers", async (t) => {
  const serverId = { steamId64: "901234", steamId32: "STEAM_0:0:450617", accountId: 901234 };
  const playerId = { steamId64: "76561198000000020", steamId32: "STEAM_0:0:19867146", accountId: 39734292 };
  const fake = createFakeNative({
    gameServerInit(options) {
      this.calls.push({ method: "gameServerInit", args: [options] });
    },
    gameServerShutdown() {
      this.calls.push({ method: "gameServerShutdown", args: [] });
    },
    gameServerRunCallbacks() {
      this.calls.push({ method: "gameServerRunCallbacks", args: [] });
    },
    gameServerIsSecure() {
      this.calls.push({ method: "gameServerIsSecure", args: [] });
      return true;
    },
    gameServerGetSteamId() {
      this.calls.push({ method: "gameServerGetSteamId", args: [] });
      return serverId;
    },
    gameServerSetProduct(product) {
      this.calls.push({ method: "gameServerSetProduct", args: [product] });
    },
    gameServerSetGameDescription(description) {
      this.calls.push({ method: "gameServerSetGameDescription", args: [description] });
    },
    gameServerSetModDir(modDir) {
      this.calls.push({ method: "gameServerSetModDir", args: [modDir] });
    },
    gameServerSetDedicatedServer(dedicated) {
      this.calls.push({ method: "gameServerSetDedicatedServer", args: [dedicated] });
    },
    gameServerLogOn(token) {
      this.calls.push({ method: "gameServerLogOn", args: [token] });
    },
    gameServerLogOnAnonymous() {
      this.calls.push({ method: "gameServerLogOnAnonymous", args: [] });
    },
    gameServerLogOff() {
      this.calls.push({ method: "gameServerLogOff", args: [] });
    },
    gameServerIsLoggedOn() {
      this.calls.push({ method: "gameServerIsLoggedOn", args: [] });
      return true;
    },
    gameServerInterfaceIsSecure() {
      this.calls.push({ method: "gameServerInterfaceIsSecure", args: [] });
      return true;
    },
    gameServerGetInterfaceSteamId() {
      this.calls.push({ method: "gameServerGetInterfaceSteamId", args: [] });
      return serverId;
    },
    gameServerWasRestartRequested() {
      this.calls.push({ method: "gameServerWasRestartRequested", args: [] });
      return false;
    },
    gameServerSetMaxPlayerCount(playersMax) {
      this.calls.push({ method: "gameServerSetMaxPlayerCount", args: [playersMax] });
    },
    gameServerSetBotPlayerCount(botPlayers) {
      this.calls.push({ method: "gameServerSetBotPlayerCount", args: [botPlayers] });
    },
    gameServerSetServerName(name) {
      this.calls.push({ method: "gameServerSetServerName", args: [name] });
    },
    gameServerSetMapName(name) {
      this.calls.push({ method: "gameServerSetMapName", args: [name] });
    },
    gameServerSetPasswordProtected(passwordProtected) {
      this.calls.push({ method: "gameServerSetPasswordProtected", args: [passwordProtected] });
    },
    gameServerSetSpectatorPort(port) {
      this.calls.push({ method: "gameServerSetSpectatorPort", args: [port] });
    },
    gameServerSetSpectatorServerName(name) {
      this.calls.push({ method: "gameServerSetSpectatorServerName", args: [name] });
    },
    gameServerClearAllKeyValues() {
      this.calls.push({ method: "gameServerClearAllKeyValues", args: [] });
    },
    gameServerSetKeyValue(key, value) {
      this.calls.push({ method: "gameServerSetKeyValue", args: [key, value] });
    },
    gameServerSetGameTags(tags) {
      this.calls.push({ method: "gameServerSetGameTags", args: [tags] });
    },
    gameServerSetGameData(data) {
      this.calls.push({ method: "gameServerSetGameData", args: [data] });
    },
    gameServerSetRegion(region) {
      this.calls.push({ method: "gameServerSetRegion", args: [region] });
    },
    gameServerSetAdvertiseServerActive(active) {
      this.calls.push({ method: "gameServerSetAdvertiseServerActive", args: [active] });
    },
    gameServerGetAuthSessionTicket(identity, maxBytes) {
      this.calls.push({ method: "gameServerGetAuthSessionTicket", args: [identity, maxBytes] });
      return { data: Buffer.from("ticket"), handle: 77 };
    },
    gameServerBeginAuthSession(ticket, steamId64) {
      this.calls.push({ method: "gameServerBeginAuthSession", args: [ticket, steamId64] });
      return 0;
    },
    gameServerEndAuthSession(steamId64) {
      this.calls.push({ method: "gameServerEndAuthSession", args: [steamId64] });
    },
    gameServerCancelAuthTicket(authTicket) {
      this.calls.push({ method: "gameServerCancelAuthTicket", args: [authTicket] });
    },
    gameServerUserHasLicenseForApp(steamId64, appId) {
      this.calls.push({ method: "gameServerUserHasLicenseForApp", args: [steamId64, appId] });
      return 0;
    },
    gameServerRequestUserGroupStatus(steamId64, groupId64) {
      this.calls.push({ method: "gameServerRequestUserGroupStatus", args: [steamId64, groupId64] });
      return true;
    },
    gameServerGetGameplayStats() {
      this.calls.push({ method: "gameServerGetGameplayStats", args: [] });
    },
    gameServerGetServerReputation() {
      this.calls.push({ method: "gameServerGetServerReputation", args: [] });
      return Promise.resolve({
        result: 1,
        reputation_score: 900,
        banned: true,
        banned_ip: 2130706433,
        banned_ip_address: "127.0.0.1",
        banned_port: 27015,
        banned_game_id: "480",
        ban_expires: 1234567890
      });
    },
    gameServerAssociateWithClan(clanId64) {
      this.calls.push({ method: "gameServerAssociateWithClan", args: [clanId64] });
      return Promise.resolve({ result: 1 });
    },
    gameServerComputeNewPlayerCompatibility(steamId64) {
      this.calls.push({ method: "gameServerComputeNewPlayerCompatibility", args: [steamId64] });
      return Promise.resolve({
        result: 1,
        players_that_dont_like_candidate: 2,
        players_that_candidate_doesnt_like: 3,
        clan_players_that_dont_like_candidate: 4,
        candidate: playerId
      });
    },
    gameServerGetPublicIp() {
      this.calls.push({ method: "gameServerGetPublicIp", args: [] });
      return { is_set: true, ip_type: 0, ipv4: 2130706433, ipv4_address: "127.0.0.1", ipv6: null };
    },
    gameServerHandleIncomingPacket(data, srcIp, srcPort) {
      this.calls.push({ method: "gameServerHandleIncomingPacket", args: [data, srcIp, srcPort] });
      return true;
    },
    gameServerGetNextOutgoingPacket(maxBytes) {
      this.calls.push({ method: "gameServerGetNextOutgoingPacket", args: [maxBytes] });
      return { data: Buffer.from("out"), ip: 2130706433, ip_address: "127.0.0.1", port: 27015 };
    },
    gameServerSendUserConnectAndAuthenticateDeprecated(clientIp, authBlob) {
      this.calls.push({ method: "gameServerSendUserConnectAndAuthenticateDeprecated", args: [clientIp, authBlob] });
      return { success: true, steam_id: playerId };
    },
    gameServerCreateUnauthenticatedUserConnection() {
      this.calls.push({ method: "gameServerCreateUnauthenticatedUserConnection", args: [] });
      return playerId;
    },
    gameServerSendUserDisconnectDeprecated(steamId64) {
      this.calls.push({ method: "gameServerSendUserDisconnectDeprecated", args: [steamId64] });
    },
    gameServerUpdateUserData(steamId64, playerName, score) {
      this.calls.push({ method: "gameServerUpdateUserData", args: [steamId64, playerName, score] });
      return true;
    }
  });
  const steam = loadSteamWithFakeNative(fake);

  t.after(clearSteamBridgeCache);

  steam.gameServer.init({
    ip: 2130706433,
    gamePort: 27015,
    queryPort: 27016,
    serverMode: steam.ServerMode.AuthenticationAndSecure,
    version: "1.0.0.0"
  });
  steam.gameServer.runCallbacks();
  assert.equal(steam.gameServer.isSecure(), true);
  assert.equal(steam.gameServer.getSteamID().steamId64, 901234n);
  steam.gameServer.setProduct("spacewar");
  steam.gameServer.setGameDescription("Spacewar");
  steam.gameServer.setModDir("spacewar");
  steam.gameServer.setDedicatedServer(true);
  steam.gameServer.logOn("token");
  steam.gameServer.logOnAnonymous();
  steam.gameServer.logOff();
  assert.equal(steam.gameServer.isLoggedOn(), true);
  assert.equal(steam.gameServer.interfaceIsSecure(), true);
  assert.equal(steam.gameServer.getInterfaceSteamID().steamId64, 901234n);
  assert.equal(steam.gameServer.wasRestartRequested(), false);
  steam.gameServer.setMaxPlayerCount(16);
  steam.gameServer.setBotPlayerCount(2);
  steam.gameServer.setServerName("Server");
  steam.gameServer.setMapName("arena");
  steam.gameServer.setPasswordProtected(false);
  steam.gameServer.setSpectatorPort(27020);
  steam.gameServer.setSpectatorServerName("Spectator");
  steam.gameServer.clearAllKeyValues();
  steam.gameServer.setKeyValue("mode", "dm");
  steam.gameServer.setGameTags("dm,pvp");
  steam.gameServer.setGameData("data");
  steam.gameServer.setRegion("usw");
  steam.gameServer.setAdvertiseServerActive(true);
  const ticket = steam.gameServer.getAuthSessionTicket({ steamId64: 76561198000000020n }, 1024);
  assert.equal(ticket.handle, 77);
  assert.equal(ticket.data.toString(), "ticket");
  assert.equal(steam.gameServer.beginAuthSession(Buffer.from("ticket"), 76561198000000020n), 0);
  steam.gameServer.endAuthSession(76561198000000020n);
  steam.gameServer.cancelAuthTicket(77);
  assert.equal(steam.gameServer.userHasLicenseForApp(76561198000000020n, 480), 0);
  assert.equal(steam.gameServer.requestUserGroupStatus(76561198000000020n, 103582791429521412n), true);
  steam.gameServer.getGameplayStats();
  const reputation = await steam.gameServer.getServerReputation();
  assert.equal(reputation.reputationScore, 900);
  assert.equal(reputation.bannedGameId, 480n);
  assert.equal(reputation.bannedIpAddress, "127.0.0.1");
  const clanResult = await steam.gameServer.associateWithClan(103582791429521412n);
  assert.equal(clanResult.result, 1);
  const compatibility = await steam.gameServer.computeNewPlayerCompatibility(76561198000000020n);
  assert.equal(compatibility.playersThatDontLikeCandidate, 2);
  assert.equal(compatibility.playersThatCandidateDoesntLike, 3);
  assert.equal(compatibility.clanPlayersThatDontLikeCandidate, 4);
  assert.equal(compatibility.candidate.steamId64, 76561198000000020n);
  assert.equal(steam.gameServer.getPublicIP().ipv4Address, "127.0.0.1");
  assert.equal(steam.gameServer.handleIncomingPacket(Buffer.from("in"), 2130706433, 27015), true);
  assert.equal(steam.gameServer.getNextOutgoingPacket(2048).data.toString(), "out");
  assert.equal(
    steam.gameServer.sendUserConnectAndAuthenticateDeprecated(2130706433, Buffer.from("auth")).steamId.steamId64,
    76561198000000020n
  );
  assert.equal(steam.gameServer.createUnauthenticatedUserConnection().steamId64, 76561198000000020n);
  steam.gameServer.sendUserDisconnectDeprecated(76561198000000020n);
  assert.equal(steam.gameServer.updateUserData(76561198000000020n, "player", 100), true);
  steam.gameServer.shutdown();

  assert.deepEqual(fake.calls[0], {
    method: "gameServerInit",
    args: [
      {
        ip: 2130706433,
        game_port: 27015,
        query_port: 27016,
        server_mode: steam.ServerMode.AuthenticationAndSecure,
        version: "1.0.0.0"
      }
    ]
  });
  assert.deepEqual(fake.calls.find((call) => call.method === "gameServerGetAuthSessionTicket"), {
    method: "gameServerGetAuthSessionTicket",
    args: [{ steamId64: 76561198000000020n }, 1024]
  });
  assert.deepEqual(fake.calls.find((call) => call.method === "gameServerAssociateWithClan"), {
    method: "gameServerAssociateWithClan",
    args: [103582791429521412n]
  });
});

test("game server stats facade covers user stat and achievement helpers", async (t) => {
  const playerId = { steamId64: "76561198000000020", steamId32: "STEAM_0:0:19867146", accountId: 39734292 };
  const playerSteamId = 76561198000000020n;
  const fake = createFakeNative({
    gameServerStatsRequestUserStats(steamId64) {
      this.calls.push({ method: "gameServerStatsRequestUserStats", args: [steamId64] });
      return Promise.resolve({ result: 1, steam_id: playerId });
    },
    gameServerStatsGetUserInt(steamId64, name) {
      this.calls.push({ method: "gameServerStatsGetUserInt", args: [steamId64, name] });
      return 42;
    },
    gameServerStatsGetUserFloat(steamId64, name) {
      this.calls.push({ method: "gameServerStatsGetUserFloat", args: [steamId64, name] });
      return 3.5;
    },
    gameServerStatsGetUserAchievement(steamId64, name) {
      this.calls.push({ method: "gameServerStatsGetUserAchievement", args: [steamId64, name] });
      return true;
    },
    gameServerStatsSetUserInt(steamId64, name, value) {
      this.calls.push({ method: "gameServerStatsSetUserInt", args: [steamId64, name, value] });
      return true;
    },
    gameServerStatsSetUserFloat(steamId64, name, value) {
      this.calls.push({ method: "gameServerStatsSetUserFloat", args: [steamId64, name, value] });
      return true;
    },
    gameServerStatsUpdateUserAvgRate(steamId64, name, countThisSession, sessionLength) {
      this.calls.push({
        method: "gameServerStatsUpdateUserAvgRate",
        args: [steamId64, name, countThisSession, sessionLength]
      });
      return true;
    },
    gameServerStatsSetUserAchievement(steamId64, name) {
      this.calls.push({ method: "gameServerStatsSetUserAchievement", args: [steamId64, name] });
      return true;
    },
    gameServerStatsClearUserAchievement(steamId64, name) {
      this.calls.push({ method: "gameServerStatsClearUserAchievement", args: [steamId64, name] });
      return true;
    },
    gameServerStatsStoreUserStats(steamId64) {
      this.calls.push({ method: "gameServerStatsStoreUserStats", args: [steamId64] });
      return Promise.resolve({ result: 1, steamId: playerId });
    }
  });
  const steam = loadSteamWithFakeNative(fake);

  t.after(clearSteamBridgeCache);

  assert.equal(steam.gameServer.stats, steam.gameServerStats);
  const requested = await steam.gameServer.stats.requestUserStats(playerSteamId);
  assert.equal(requested.result, 1);
  assert.equal(requested.steamId.steamId64, playerSteamId);
  assert.equal(steam.gameServer.stats.getUserInt(playerSteamId, "kills"), 42);
  assert.equal(steam.gameServer.stats.getUserFloat(playerSteamId, "accuracy"), 3.5);
  assert.equal(steam.gameServer.stats.getUserAchievement(playerSteamId, "WIN_ONE"), true);
  assert.equal(steam.gameServer.stats.setUserInt(playerSteamId, "kills", 43), true);
  assert.equal(steam.gameServer.stats.setUserFloat(playerSteamId, "accuracy", 4.25), true);
  assert.equal(steam.gameServer.stats.updateUserAvgRate(playerSteamId, "score_rate", 10, 60), true);
  assert.equal(steam.gameServer.stats.setUserAchievement(playerSteamId, "WIN_ONE"), true);
  assert.equal(steam.gameServer.stats.clearUserAchievement(playerSteamId, "WIN_ONE"), true);
  const stored = await steam.gameServer.stats.storeUserStats(playerSteamId);
  assert.equal(stored.result, 1);
  assert.equal(stored.steamId.steamId64, playerSteamId);

  assert.deepEqual(
    fake.calls.map((call) => call.method),
    [
      "gameServerStatsRequestUserStats",
      "gameServerStatsGetUserInt",
      "gameServerStatsGetUserFloat",
      "gameServerStatsGetUserAchievement",
      "gameServerStatsSetUserInt",
      "gameServerStatsSetUserFloat",
      "gameServerStatsUpdateUserAvgRate",
      "gameServerStatsSetUserAchievement",
      "gameServerStatsClearUserAchievement",
      "gameServerStatsStoreUserStats"
    ]
  );
});

test("utils facade covers activity, images, VR, filtering, and text input helpers", async (t) => {
  const imageData = Buffer.from([255, 0, 0, 255, 0, 255, 0, 255]);
  const fake = createFakeNative({
    utilsGetSecondsSinceAppActive() {
      this.calls.push({ method: "utilsGetSecondsSinceAppActive", args: [] });
      return 12;
    },
    utilsGetSecondsSinceComputerActive() {
      this.calls.push({ method: "utilsGetSecondsSinceComputerActive", args: [] });
      return 34;
    },
    utilsGetConnectedUniverse() {
      this.calls.push({ method: "utilsGetConnectedUniverse", args: [] });
      return 1;
    },
    utilsGetSteamUiLanguage() {
      this.calls.push({ method: "utilsGetSteamUiLanguage", args: [] });
      return "english";
    },
    utilsGetImageSize(image) {
      this.calls.push({ method: "utilsGetImageSize", args: [image] });
      return image === 7 ? { width: 2, height: 1 } : null;
    },
    utilsGetImageRgba(image) {
      this.calls.push({ method: "utilsGetImageRgba", args: [image] });
      return image === 7 ? imageData : null;
    },
    utilsGetCurrentBatteryPower() {
      this.calls.push({ method: "utilsGetCurrentBatteryPower", args: [] });
      return 95;
    },
    utilsGetIpcCallCount() {
      this.calls.push({ method: "utilsGetIpcCallCount", args: [] });
      return 3;
    },
    utilsRegisterWarningMessageHook(handler) {
      this.calls.push({ method: "utilsRegisterWarningMessageHook", args: [] });
      this.warningMessageHandler = handler;
      return {
        disconnect: () => this.calls.push({ method: "disconnectWarningMessageHook", args: [] })
      };
    },
    utilsIsApiCallCompleted(apiCall) {
      this.calls.push({ method: "utilsIsApiCallCompleted", args: [apiCall] });
      return { completed: true, failed: false };
    },
    utilsGetApiCallFailureReason(apiCall) {
      this.calls.push({ method: "utilsGetApiCallFailureReason", args: [apiCall] });
      return -1;
    },
    utilsGetApiCallResult(apiCall, expectedCallback, byteLength) {
      this.calls.push({ method: "utilsGetApiCallResult", args: [apiCall, expectedCallback, byteLength] });
      return { ok: true, failed: false, data: Buffer.from([1, 2, 3, 4]) };
    },
    utilsCheckFileSignature(fileName, timeoutSeconds) {
      this.calls.push({ method: "utilsCheckFileSignature", args: [fileName, timeoutSeconds] });
      return Promise.resolve(1);
    },
    utilsSetOverlayNotificationPosition(position) {
      this.calls.push({ method: "utilsSetOverlayNotificationPosition", args: [position] });
    },
    utilsSetOverlayNotificationInset(horizontal, vertical) {
      this.calls.push({ method: "utilsSetOverlayNotificationInset", args: [horizontal, vertical] });
    },
    utilsIsSteamRunningInVr() {
      this.calls.push({ method: "utilsIsSteamRunningInVr", args: [] });
      return true;
    },
    utilsStartVrDashboard() {
      this.calls.push({ method: "utilsStartVrDashboard", args: [] });
    },
    utilsIsVrHeadsetStreamingEnabled() {
      this.calls.push({ method: "utilsIsVrHeadsetStreamingEnabled", args: [] });
      return false;
    },
    utilsSetVrHeadsetStreamingEnabled(enabled) {
      this.calls.push({ method: "utilsSetVrHeadsetStreamingEnabled", args: [enabled] });
    },
    utilsIsSteamChinaLauncher() {
      this.calls.push({ method: "utilsIsSteamChinaLauncher", args: [] });
      return false;
    },
    utilsInitFilterText(options) {
      this.calls.push({ method: "utilsInitFilterText", args: [options] });
      return true;
    },
    utilsFilterText(context, sourceSteamId64, input, maxBytes) {
      this.calls.push({ method: "utilsFilterText", args: [context, sourceSteamId64, input, maxBytes] });
      return { filtered: "hello", characters_filtered: 1 };
    },
    utilsGetIpv6ConnectivityState(protocol) {
      this.calls.push({ method: "utilsGetIpv6ConnectivityState", args: [protocol] });
      return protocol === 1 ? 1 : 2;
    },
    utilsSetGameLauncherMode(enabled) {
      this.calls.push({ method: "utilsSetGameLauncherMode", args: [enabled] });
    },
    utilsDismissFloatingGamepadTextInput() {
      this.calls.push({ method: "utilsDismissFloatingGamepadTextInput", args: [] });
      return true;
    },
    utilsDismissGamepadTextInput() {
      this.calls.push({ method: "utilsDismissGamepadTextInput", args: [] });
      return true;
    }
  });
  const steam = loadSteamWithFakeNative(fake);

  t.after(clearSteamBridgeCache);

  assert.equal(steam.utils.SteamUniverse.Public, 1);
  assert.equal(steam.utils.OverlayNotificationPosition.BottomRight, 3);
  assert.equal(steam.utils.TextFilteringContext.Chat, 2);
  assert.equal(steam.utils.IPv6ConnectivityProtocol.HTTP, 1);
  assert.equal(steam.utils.IPv6ConnectivityState.Good, 1);
  assert.equal(steam.utils.getSecondsSinceAppActive(), 12);
  assert.equal(steam.utils.getSecondsSinceComputerActive(), 34);
  assert.equal(steam.utils.getConnectedUniverse(), steam.utils.SteamUniverse.Public);
  assert.equal(steam.utils.getSteamUILanguage(), "english");
  assert.deepEqual(steam.utils.getImageSize(7), { width: 2, height: 1 });
  assert.equal(steam.utils.getImageSize(99), null);
  assert.deepEqual(steam.utils.getImageRGBA(7), imageData);
  assert.equal(steam.utils.getImageRGBA(99), null);
  assert.equal(steam.utils.getCurrentBatteryPower(), 95);
  assert.equal(steam.utils.getIPCCallCount(), 3);
  let warningEvent;
  const warningHandle = steam.utils.registerWarningMessageHook((event) => {
    warningEvent = event;
  });
  fake.warningMessageHandler({ severity: 2, message: "warning text" });
  assert.deepEqual(warningEvent, { severity: 2, message: "warning text" });
  assert.deepEqual(steam.utils.isApiCallCompleted("12345678901234567890"), {
    completed: true,
    failed: false
  });
  assert.equal(steam.utils.getApiCallFailureReason(12345678901234567890n), -1);
  const apiCallResult = steam.utils.getApiCallResult(
    12345678901234567890n,
    steam.SteamCallback.FileDetailsResult,
    36
  );
  assert.equal(apiCallResult.ok, true);
  assert.equal(apiCallResult.failed, false);
  assert.deepEqual(apiCallResult.data, Buffer.from([1, 2, 3, 4]));
  assert.equal(
    await steam.utils.checkFileSignature("steam_appid.txt", 5),
    steam.utils.CheckFileSignature.ValidSignature
  );

  steam.utils.setOverlayNotificationPosition(steam.utils.OverlayNotificationPosition.BottomRight);
  steam.utils.setOverlayNotificationInset(16, 24);

  assert.equal(steam.utils.isSteamRunningInVR(), true);
  steam.utils.startVRDashboard();
  assert.equal(steam.utils.isVRHeadsetStreamingEnabled(), false);
  steam.utils.setVRHeadsetStreamingEnabled(true);
  assert.equal(steam.utils.isSteamChinaLauncher(), false);
  assert.equal(steam.utils.initFilterText(), true);
  assert.deepEqual(
    steam.utils.filterText(steam.utils.TextFilteringContext.Chat, 76561198000000000n, "hello", 256),
    { filtered: "hello", charactersFiltered: 1 }
  );
  assert.equal(
    steam.utils.getIPv6ConnectivityState(steam.utils.IPv6ConnectivityProtocol.HTTP),
    steam.utils.IPv6ConnectivityState.Good
  );
  steam.utils.setGameLauncherMode(true);
  assert.equal(steam.utils.dismissFloatingGamepadTextInput(), true);
  assert.equal(steam.utils.dismissGamepadTextInput(), true);
  warningHandle.disconnect();
  assert.deepEqual(
    fake.calls.filter((call) =>
      [
        "utilsRegisterWarningMessageHook",
        "utilsSetOverlayNotificationPosition",
        "utilsSetOverlayNotificationInset",
        "utilsIsApiCallCompleted",
        "utilsGetApiCallFailureReason",
        "utilsGetApiCallResult",
        "utilsCheckFileSignature",
        "utilsFilterText",
        "utilsSetGameLauncherMode",
        "disconnectWarningMessageHook"
      ].includes(call.method)
    ),
    [
      { method: "utilsRegisterWarningMessageHook", args: [] },
      { method: "utilsIsApiCallCompleted", args: [12345678901234567890n] },
      { method: "utilsGetApiCallFailureReason", args: [12345678901234567890n] },
      { method: "utilsGetApiCallResult", args: [12345678901234567890n, 1023, 36] },
      { method: "utilsCheckFileSignature", args: ["steam_appid.txt", 5] },
      { method: "utilsSetOverlayNotificationPosition", args: [3] },
      { method: "utilsSetOverlayNotificationInset", args: [16, 24] },
      { method: "utilsFilterText", args: [2, 76561198000000000n, "hello", 256] },
      { method: "utilsSetGameLauncherMode", args: [true] },
      { method: "disconnectWarningMessageHook", args: [] }
    ]
  );
});

test("specific and generic callbacks normalize Steamworks payloads", (t) => {
  const fake = createFakeNative();
  const steam = loadSteamWithFakeNative(fake);

  t.after(clearSteamBridgeCache);

  assert.equal(steam.SteamCallback.SteamAPICallCompleted, 703);
  assert.equal(steam.SteamCallback.EncryptedAppTicketResponse, 154);
  assert.equal(steam.SteamCallback.GetAuthSessionTicketResponse, 163);
  assert.equal(steam.SteamCallback.StoreAuthURLResponse, 165);
  assert.equal(steam.SteamCallback.MarketEligibilityResponse, 166);
  assert.equal(steam.SteamCallback.DurationControl, 167);
  assert.equal(steam.SteamCallback.GameServerChangeRequested, 332);
  assert.equal(steam.SteamCallback.GameLobbyJoinRequestedSteamworks, 333);
  assert.equal(steam.SteamCallback.AvatarImageLoaded, 334);
  assert.equal(steam.SteamCallback.FriendRichPresenceUpdate, 336);
  assert.equal(steam.SteamCallback.FriendsEnumerateFollowingList, 346);
  assert.equal(steam.SteamCallback.OverlayBrowserProtocolNavigation, 349);
  assert.equal(steam.SteamCallback.EquippedProfileItems, 351);
  assert.equal(steam.SteamCallback.GamepadTextInputDismissed, 714);
  assert.equal(steam.SteamCallback.DlcInstalled, 1005);
  assert.equal(steam.SteamCallback.AppProofOfPurchaseKeyResponse, 1021);
  assert.equal(steam.SteamCallback.FileDetailsResult, 1023);
  assert.equal(steam.SteamCallback.TimedTrialStatus, 1030);
  assert.equal(steam.SteamCallback.GameServerClientApprove, 201);
  assert.equal(steam.SteamCallback.GameServerClientDeny, 202);
  assert.equal(steam.SteamCallback.GameServerClientKick, 203);
  assert.equal(steam.SteamCallback.GameServerClientAchievementStatus, 206);
  assert.equal(steam.SteamCallback.GameServerPolicyResponse, 115);
  assert.equal(steam.SteamCallback.GameServerGameplayStats, 207);
  assert.equal(steam.SteamCallback.GameServerClientGroupStatus, 208);
  assert.equal(steam.SteamCallback.GameServerReputation, 209);
  assert.equal(steam.SteamCallback.GameServerAssociateWithClan, 210);
  assert.equal(steam.SteamCallback.GameServerPlayerCompatibility, 211);
  assert.equal(steam.SteamCallback.GameServerStatsUnloaded, 1108);
  assert.equal(steam.SteamCallback.GameServerStatsReceived, 1800);
  assert.equal(steam.SteamCallback.GameServerStatsStored, 1801);

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

  let apiCallEvent;
  steam.callback.register(steam.SteamCallback.SteamAPICallCompleted, (event) => {
    apiCallEvent = event;
  });
  fake.callbacks.get(steam.SteamCallback.SteamAPICallCompleted)({
    async_call: "12345678901234567890",
    callback: steam.SteamCallback.AppProofOfPurchaseKeyResponse,
    parameter_size: 252
  });

  assert.equal(apiCallEvent.async_call, 12345678901234567890n);
  assert.equal(apiCallEvent.asyncCall, 12345678901234567890n);
  assert.equal(apiCallEvent.callback, steam.SteamCallback.AppProofOfPurchaseKeyResponse);
  assert.equal(apiCallEvent.parameterSize, 252);

  let proofKeyEvent;
  steam.callback.register(steam.SteamCallback.AppProofOfPurchaseKeyResponse, (event) => {
    proofKeyEvent = event;
  });
  fake.callbacks.get(steam.SteamCallback.AppProofOfPurchaseKeyResponse)({
    result: 1,
    app_id: 480,
    key_length: 8,
    key: "spacewar"
  });

  assert.equal(proofKeyEvent.appId, 480);
  assert.equal(proofKeyEvent.keyLength, 8);
  assert.equal(proofKeyEvent.key, "spacewar");

  let fileDetailsEvent;
  steam.callback.register(steam.SteamCallback.FileDetailsResult, (event) => {
    fileDetailsEvent = event;
  });
  fake.callbacks.get(steam.SteamCallback.FileDetailsResult)({
    result: 1,
    file_size: "4294967297",
    sha_hex: "001122",
    flags: 3
  });

  assert.equal(fileDetailsEvent.file_size, 4294967297n);
  assert.equal(fileDetailsEvent.fileSize, 4294967297n);
  assert.equal(fileDetailsEvent.shaHex, "001122");

  let timedTrialEvent;
  steam.callback.register(steam.SteamCallback.TimedTrialStatus, (event) => {
    timedTrialEvent = event;
  });
  fake.callbacks.get(steam.SteamCallback.TimedTrialStatus)({
    app_id: 480,
    is_offline: false,
    seconds_allowed: 3600,
    seconds_played: 120
  });

  assert.equal(timedTrialEvent.appId, 480);
  assert.equal(timedTrialEvent.isOffline, false);
  assert.equal(timedTrialEvent.secondsAllowed, 3600);
  assert.equal(timedTrialEvent.secondsPlayed, 120);

  let reputationEvent;
  steam.callback.register(steam.SteamCallback.GameServerReputation, (event) => {
    reputationEvent = event;
  });
  fake.callbacks.get(steam.SteamCallback.GameServerReputation)({
    result: 1,
    reputation_score: 900,
    banned: true,
    banned_ip: 2130706433,
    banned_ip_address: "127.0.0.1",
    banned_port: 27015,
    banned_game_id: "480",
    ban_expires: 1234567890
  });

  assert.equal(reputationEvent.reputationScore, 900);
  assert.equal(reputationEvent.bannedGameId, 480n);
  assert.equal(reputationEvent.bannedIpAddress, "127.0.0.1");

  let compatibilityEvent;
  steam.callback.register(steam.SteamCallback.GameServerPlayerCompatibility, (event) => {
    compatibilityEvent = event;
  });
  fake.callbacks.get(steam.SteamCallback.GameServerPlayerCompatibility)({
    result: 1,
    candidate_steam_id: "76561198000000020",
    players_that_dont_like_candidate: 2,
    players_that_candidate_doesnt_like: 3,
    clan_players_that_dont_like_candidate: 4
  });

  assert.equal(compatibilityEvent.candidateSteamId, 76561198000000020n);
  assert.equal(compatibilityEvent.playersThatDontLikeCandidate, 2);
  assert.equal(compatibilityEvent.playersThatCandidateDoesntLike, 3);
  assert.equal(compatibilityEvent.clanPlayersThatDontLikeCandidate, 4);

  let marketEvent;
  steam.callback.register(steam.SteamCallback.MarketEligibilityResponse, (event) => {
    marketEvent = event;
  });
  fake.callbacks.get(steam.SteamCallback.MarketEligibilityResponse)({
    allowed: false,
    not_allowed_reason: 64,
    allowed_at_time: 1234,
    steam_guard_required_days: 15,
    new_device_cooldown_days: 7
  });

  assert.equal(marketEvent.notAllowedReason, 64);
  assert.equal(marketEvent.allowedAtTime, 1234);
  assert.equal(marketEvent.steamGuardRequiredDays, 15);
  assert.equal(marketEvent.newDeviceCooldownDays, 7);

  let durationEvent;
  steam.callback.register(steam.SteamCallback.DurationControl, (event) => {
    durationEvent = event;
  });
  fake.callbacks.get(steam.SteamCallback.DurationControl)({
    result: 1,
    app_id: 480,
    applicable: true,
    seconds_last_5h: 3600,
    progress: 1,
    notification: 2,
    seconds_today: 7200,
    seconds_remaining: 1800
  });

  assert.equal(durationEvent.appId, 480);
  assert.equal(durationEvent.secondsLast5h, 3600);
  assert.equal(durationEvent.secondsToday, 7200);
  assert.equal(durationEvent.secondsRemaining, 1800);

  let gamepadEvent;
  steam.callback.register(steam.SteamCallback.GamepadTextInputDismissed, (event) => {
    gamepadEvent = event;
  });
  fake.callbacks.get(steam.SteamCallback.GamepadTextInputDismissed)({
    submitted: true,
    submitted_text: 12,
    app_id: 480
  });

  assert.equal(gamepadEvent.submitted, true);
  assert.equal(gamepadEvent.submittedText, 12);
  assert.equal(gamepadEvent.appId, 480);

  let avatarEvent;
  steam.callback.register(steam.SteamCallback.AvatarImageLoaded, (event) => {
    avatarEvent = event;
  });
  fake.callbacks.get(steam.SteamCallback.AvatarImageLoaded)({
    steam_id: "76561198000000001",
    image: 17,
    wide: 64,
    tall: 64
  });

  assert.equal(avatarEvent.steamId, 76561198000000001n);
  assert.equal(avatarEvent.image, 17);
  assert.equal(avatarEvent.wide, 64);
  assert.equal(avatarEvent.tall, 64);

  let richPresenceEvent;
  steam.callback.register(steam.SteamCallback.GameRichPresenceJoinRequested, (event) => {
    richPresenceEvent = event;
  });
  fake.callbacks.get(steam.SteamCallback.GameRichPresenceJoinRequested)({
    friend: "76561198000000002",
    connect: "+connect_lobby 109775242022617907"
  });

  assert.equal(richPresenceEvent.friend, 76561198000000002n);
  assert.equal(richPresenceEvent.connect, "+connect_lobby 109775242022617907");

  let lobbyJoinEvent;
  steam.callback.register(steam.SteamCallback.GameLobbyJoinRequestedSteamworks, (event) => {
    lobbyJoinEvent = event;
  });
  fake.callbacks.get(steam.SteamCallback.GameLobbyJoinRequestedSteamworks)({
    lobby_steam_id: "109775242022617907",
    friend_steam_id: "76561198000000003"
  });

  assert.equal(lobbyJoinEvent.lobbySteamId, 109775242022617907n);
  assert.equal(lobbyJoinEvent.friendSteamId, 76561198000000003n);

  let chatLeaveEvent;
  steam.callback.register(steam.SteamCallback.GameConnectedChatLeave, (event) => {
    chatLeaveEvent = event;
  });
  fake.callbacks.get(steam.SteamCallback.GameConnectedChatLeave)({
    clan_chat: "103582791429521408",
    user: "76561198000000003",
    kicked: false,
    dropped: true
  });

  assert.equal(chatLeaveEvent.clan_chat, 103582791429521408n);
  assert.equal(chatLeaveEvent.clanChat, 103582791429521408n);
  assert.equal(chatLeaveEvent.user, 76561198000000003n);
  assert.equal(chatLeaveEvent.dropped, true);

  let followingEvent;
  steam.callback.register(steam.SteamCallback.FriendsEnumerateFollowingList, (event) => {
    followingEvent = event;
  });
  fake.callbacks.get(steam.SteamCallback.FriendsEnumerateFollowingList)({
    result: 1,
    steam_ids: ["76561198000000004", "76561198000000005"],
    results_returned: 2,
    total_result_count: 7
  });

  assert.deepEqual(followingEvent.steam_ids, [76561198000000004n, 76561198000000005n]);
  assert.deepEqual(followingEvent.steamIds, [76561198000000004n, 76561198000000005n]);
  assert.equal(followingEvent.resultsReturned, 2);
  assert.equal(followingEvent.totalResultCount, 7);

  let equippedItemsEvent;
  steam.callback.register(steam.SteamCallback.EquippedProfileItems, (event) => {
    equippedItemsEvent = event;
  });
  fake.callbacks.get(steam.SteamCallback.EquippedProfileItems)({
    result: 1,
    steam_id: "76561198000000006",
    has_animated_avatar: true,
    has_avatar_frame: false,
    has_profile_modifier: true,
    has_profile_background: false,
    has_mini_profile_background: true,
    from_cache: true
  });

  assert.equal(equippedItemsEvent.steamId, 76561198000000006n);
  assert.equal(equippedItemsEvent.hasAnimatedAvatar, true);
  assert.equal(equippedItemsEvent.hasAvatarFrame, false);
  assert.equal(equippedItemsEvent.hasProfileModifier, true);
  assert.equal(equippedItemsEvent.hasMiniProfileBackground, true);
  assert.equal(equippedItemsEvent.fromCache, true);

  let gameServerStatsUnloadedEvent;
  steam.callback.register(steam.SteamCallback.GameServerStatsUnloaded, (event) => {
    gameServerStatsUnloadedEvent = event;
  });
  fake.callbacks.get(steam.SteamCallback.GameServerStatsUnloaded)({
    steam_id: "76561198000000020"
  });

  assert.equal(gameServerStatsUnloadedEvent.steam_id, 76561198000000020n);
  assert.equal(gameServerStatsUnloadedEvent.steamId, 76561198000000020n);

  let navigationEvent;
  steam.callback.register(steam.SteamCallback.OverlayBrowserProtocolNavigation, (event) => {
    navigationEvent = event;
  });
  fake.callbacks.get(steam.SteamCallback.OverlayBrowserProtocolNavigation)({
    uri: "steam://openurl/https://store.steampowered.com/app/480/"
  });

  assert.equal(navigationEvent.uri, "steam://openurl/https://store.steampowered.com/app/480/");

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

test("matchmaking facade covers favorites, lobby filters, metadata, chat, and callbacks", async (t) => {
  const lobbyId = 109775242022617907n;
  const dependentLobbyId = 109775242022617908n;
  const memberId = 76561198000000010n;
  const serverId = 90123456789012345n;
  const nativeServer = {
    address: {
      ip: 2130706433,
      ip_address: "127.0.0.1",
      connection_port: 27015,
      query_port: 27016
    },
    ping: 42,
    had_successful_response: true,
    do_not_refresh: false,
    game_dir: "spacewar",
    map: "arena",
    game_description: "Spacewar",
    app_id: 480,
    players: 3,
    max_players: 8,
    bot_players: 1,
    password: false,
    secure: true,
    time_last_played: 123456,
    server_version: 7,
    name: "Test Server",
    game_tags: "dm,pvp",
    steam_id: { steamId64: String(serverId), steamId32: "STEAM_0:0:2", accountId: 2 }
  };
  const nativeServerList = {
    response: 0,
    responded: [0],
    failed: [1],
    servers: [nativeServer]
  };
  const fake = createFakeNative({
    matchmakingGetFavoriteGameCount() {
      this.calls.push({ method: "matchmakingGetFavoriteGameCount", args: [] });
      return 1;
    },
    matchmakingGetFavoriteGame(index) {
      this.calls.push({ method: "matchmakingGetFavoriteGame", args: [index] });
      return {
        app_id: 480,
        ip: 2130706433,
        ip_address: "127.0.0.1",
        conn_port: 27015,
        query_port: 27016,
        flags: 1,
        last_played_on_server: 123456
      };
    },
    matchmakingAddFavoriteGame(appId, ip, connPort, queryPort, flags, lastPlayedOnServer) {
      this.calls.push({ method: "matchmakingAddFavoriteGame", args: [appId, ip, connPort, queryPort, flags, lastPlayedOnServer] });
      return 2;
    },
    matchmakingRemoveFavoriteGame(appId, ip, connPort, queryPort, flags) {
      this.calls.push({ method: "matchmakingRemoveFavoriteGame", args: [appId, ip, connPort, queryPort, flags] });
      return true;
    },
    matchmakingAddRequestLobbyListStringFilter(key, value, comparison) {
      this.calls.push({ method: "matchmakingAddRequestLobbyListStringFilter", args: [key, value, comparison] });
    },
    matchmakingAddRequestLobbyListNumericalFilter(key, value, comparison) {
      this.calls.push({ method: "matchmakingAddRequestLobbyListNumericalFilter", args: [key, value, comparison] });
    },
    matchmakingAddRequestLobbyListNearValueFilter(key, value) {
      this.calls.push({ method: "matchmakingAddRequestLobbyListNearValueFilter", args: [key, value] });
    },
    matchmakingAddRequestLobbyListFilterSlotsAvailable(slots) {
      this.calls.push({ method: "matchmakingAddRequestLobbyListFilterSlotsAvailable", args: [slots] });
    },
    matchmakingAddRequestLobbyListDistanceFilter(distanceFilter) {
      this.calls.push({ method: "matchmakingAddRequestLobbyListDistanceFilter", args: [distanceFilter] });
    },
    matchmakingAddRequestLobbyListResultCountFilter(maxResults) {
      this.calls.push({ method: "matchmakingAddRequestLobbyListResultCountFilter", args: [maxResults] });
    },
    matchmakingAddRequestLobbyListCompatibleMembersFilter(lobby) {
      this.calls.push({ method: "matchmakingAddRequestLobbyListCompatibleMembersFilter", args: [lobby] });
    },
    matchmakingServersRequestInternetServerList(appId, filters, timeoutSeconds) {
      this.calls.push({ method: "matchmakingServersRequestInternetServerList", args: [appId, filters, timeoutSeconds] });
      return Promise.resolve(nativeServerList);
    },
    matchmakingServersRequestLanServerList(appId, timeoutSeconds) {
      this.calls.push({ method: "matchmakingServersRequestLanServerList", args: [appId, timeoutSeconds] });
      return Promise.resolve(nativeServerList);
    },
    matchmakingServersRequestFriendsServerList(appId, filters, timeoutSeconds) {
      this.calls.push({ method: "matchmakingServersRequestFriendsServerList", args: [appId, filters, timeoutSeconds] });
      return Promise.resolve(nativeServerList);
    },
    matchmakingServersRequestFavoritesServerList(appId, filters, timeoutSeconds) {
      this.calls.push({ method: "matchmakingServersRequestFavoritesServerList", args: [appId, filters, timeoutSeconds] });
      return Promise.resolve(nativeServerList);
    },
    matchmakingServersRequestHistoryServerList(appId, filters, timeoutSeconds) {
      this.calls.push({ method: "matchmakingServersRequestHistoryServerList", args: [appId, filters, timeoutSeconds] });
      return Promise.resolve(nativeServerList);
    },
    matchmakingServersRequestSpectatorServerList(appId, filters, timeoutSeconds) {
      this.calls.push({ method: "matchmakingServersRequestSpectatorServerList", args: [appId, filters, timeoutSeconds] });
      return Promise.resolve(nativeServerList);
    },
    matchmakingServersPingServer(ip, queryPort, timeoutSeconds) {
      this.calls.push({ method: "matchmakingServersPingServer", args: [ip, queryPort, timeoutSeconds] });
      return Promise.resolve({ responded: true, server: nativeServer });
    },
    matchmakingServersPlayerDetails(ip, queryPort, timeoutSeconds) {
      this.calls.push({ method: "matchmakingServersPlayerDetails", args: [ip, queryPort, timeoutSeconds] });
      return Promise.resolve({ responded: true, players: [{ name: "player", score: 10, time_played: 12.5 }] });
    },
    matchmakingServersServerRules(ip, queryPort, timeoutSeconds) {
      this.calls.push({ method: "matchmakingServersServerRules", args: [ip, queryPort, timeoutSeconds] });
      return Promise.resolve({ responded: true, rules: [{ name: "sv_cheats", value: "0" }] });
    },
    matchmakingCreateLobby(lobbyType, maxMembers) {
      this.calls.push({ method: "matchmakingCreateLobby", args: [lobbyType, maxMembers] });
      return Promise.resolve({ id: lobbyId });
    },
    matchmakingJoinLobby(lobby) {
      this.calls.push({ method: "matchmakingJoinLobby", args: [lobby] });
      return Promise.resolve({ id: lobby });
    },
    matchmakingGetLobbies() {
      this.calls.push({ method: "matchmakingGetLobbies", args: [] });
      return Promise.resolve([{ id: lobbyId }]);
    },
    matchmakingLeaveLobby(lobby) {
      this.calls.push({ method: "matchmakingLeaveLobby", args: [lobby] });
    },
    matchmakingGetLobbyMemberCount(lobby) {
      this.calls.push({ method: "matchmakingGetLobbyMemberCount", args: [lobby] });
      return 2;
    },
    matchmakingGetLobbyMemberLimit(lobby) {
      this.calls.push({ method: "matchmakingGetLobbyMemberLimit", args: [lobby] });
      return 4;
    },
    matchmakingGetLobbyMembers(lobby) {
      this.calls.push({ method: "matchmakingGetLobbyMembers", args: [lobby] });
      return [{ steamId64: String(memberId), steamId32: "STEAM_0:0:1", accountId: 1 }];
    },
    matchmakingGetLobbyOwner(lobby) {
      this.calls.push({ method: "matchmakingGetLobbyOwner", args: [lobby] });
      return { steamId64: String(memberId), steamId32: "STEAM_0:0:1", accountId: 1 };
    },
    matchmakingSetLobbyJoinable(lobby, joinable) {
      this.calls.push({ method: "matchmakingSetLobbyJoinable", args: [lobby, joinable] });
      return true;
    },
    matchmakingGetLobbyData(lobby, key) {
      this.calls.push({ method: "matchmakingGetLobbyData", args: [lobby, key] });
      return key === "missing" ? null : "value";
    },
    matchmakingSetLobbyData(lobby, key, value) {
      this.calls.push({ method: "matchmakingSetLobbyData", args: [lobby, key, value] });
      return true;
    },
    matchmakingDeleteLobbyData(lobby, key) {
      this.calls.push({ method: "matchmakingDeleteLobbyData", args: [lobby, key] });
      return true;
    },
    matchmakingGetLobbyFullData(lobby) {
      this.calls.push({ method: "matchmakingGetLobbyFullData", args: [lobby] });
      return { map: "test-map" };
    },
    matchmakingInviteUserToLobby(lobby, steamId64) {
      this.calls.push({ method: "matchmakingInviteUserToLobby", args: [lobby, steamId64] });
      return true;
    },
    matchmakingGetLobbyMemberData(lobby, steamId64, key) {
      this.calls.push({ method: "matchmakingGetLobbyMemberData", args: [lobby, steamId64, key] });
      return "ready";
    },
    matchmakingSetLobbyMemberData(lobby, key, value) {
      this.calls.push({ method: "matchmakingSetLobbyMemberData", args: [lobby, key, value] });
    },
    matchmakingSendLobbyChatMsg(lobby, data) {
      this.calls.push({ method: "matchmakingSendLobbyChatMsg", args: [lobby, data] });
      return true;
    },
    matchmakingGetLobbyChatEntry(lobby, chatId, maxBytes) {
      this.calls.push({ method: "matchmakingGetLobbyChatEntry", args: [lobby, chatId, maxBytes] });
      return {
        steam_id: { steamId64: String(memberId), steamId32: "STEAM_0:0:1", accountId: 1 },
        data: Buffer.from("hello"),
        size: 5,
        text: "hello",
        entry_type: 1
      };
    },
    matchmakingRequestLobbyData(lobby) {
      this.calls.push({ method: "matchmakingRequestLobbyData", args: [lobby] });
      return true;
    },
    matchmakingSetLobbyGameServer(lobby, ip, port, steamId64) {
      this.calls.push({ method: "matchmakingSetLobbyGameServer", args: [lobby, ip, port, steamId64] });
    },
    matchmakingGetLobbyGameServer(lobby) {
      this.calls.push({ method: "matchmakingGetLobbyGameServer", args: [lobby] });
      return {
        ip: 2130706433,
        ip_address: "127.0.0.1",
        port: 27015,
        steam_id: { steamId64: String(serverId), steamId32: "STEAM_0:0:2", accountId: 2 }
      };
    },
    matchmakingSetLobbyMemberLimit(lobby, maxMembers) {
      this.calls.push({ method: "matchmakingSetLobbyMemberLimit", args: [lobby, maxMembers] });
      return true;
    },
    matchmakingSetLobbyType(lobby, lobbyType) {
      this.calls.push({ method: "matchmakingSetLobbyType", args: [lobby, lobbyType] });
      return true;
    },
    matchmakingSetLobbyOwner(lobby, steamId64) {
      this.calls.push({ method: "matchmakingSetLobbyOwner", args: [lobby, steamId64] });
      return true;
    },
    matchmakingSetLinkedLobby(lobby, dependentLobby) {
      this.calls.push({ method: "matchmakingSetLinkedLobby", args: [lobby, dependentLobby] });
      return true;
    }
  });
  const steam = loadSteamWithFakeNative(fake);

  t.after(clearSteamBridgeCache);

  assert.equal(steam.matchmaking.FavoriteFlags.Favorite, 1);
  assert.equal(steam.matchmaking.LobbyType.PrivateUnique, 4);
  assert.equal(steam.matchmaking.servers, steam.matchmakingServers);
  assert.equal(steam.matchmaking.favoriteGameCount(), 1);
  assert.deepEqual(steam.matchmaking.favoriteGame(0), {
    appId: 480,
    ip: 2130706433,
    ipAddress: "127.0.0.1",
    connPort: 27015,
    queryPort: 27016,
    flags: 1,
    lastPlayedOnServer: 123456
  });
  assert.equal(
    steam.matchmaking.addFavoriteGame({
      appId: 480,
      ip: 2130706433,
      ipAddress: "127.0.0.1",
      connPort: 27015,
      queryPort: 27016,
      flags: steam.matchmaking.FavoriteFlags.Favorite,
      lastPlayedOnServer: 123456
    }),
    2
  );
  assert.equal(
    steam.matchmaking.removeFavoriteGame({
      appId: 480,
      ip: 2130706433,
      connPort: 27015,
      queryPort: 27016,
      flags: steam.matchmaking.FavoriteFlags.Favorite
    }),
    true
  );

  const lobbies = await steam.matchmaking.getLobbies({
    stringFilters: [{ key: "mode", value: "coop" }],
    numericalFilters: [{ key: "skill", value: 3, comparison: steam.matchmaking.LobbyComparison.EqualToOrGreaterThan }],
    nearValueFilters: [{ key: "ping", value: 50 }],
    slotsAvailable: 1,
    distanceFilter: steam.matchmaking.LobbyDistanceFilter.Worldwide,
    resultCount: 10,
    compatibleLobby: lobbyId
  });
  assert.equal(lobbies[0].id, lobbyId);

  const internetServers = await steam.matchmaking.servers.requestInternetServerList(480, {
    filters: [{ key: "map", value: "arena" }],
    timeoutSeconds: 5
  });
  assert.equal(internetServers.response, 0);
  assert.deepEqual(internetServers.responded, [0]);
  assert.deepEqual(internetServers.failed, [1]);
  assert.equal(internetServers.servers[0].address.ipAddress, "127.0.0.1");
  assert.equal(internetServers.servers[0].address.connectionPort, 27015);
  assert.equal(internetServers.servers[0].gameDir, "spacewar");
  assert.equal(internetServers.servers[0].gameDescription, "Spacewar");
  assert.equal(internetServers.servers[0].maxPlayers, 8);
  assert.equal(internetServers.servers[0].steamId.steamId64, serverId);
  assert.equal((await steam.matchmaking.servers.requestLANServerList(480, 5)).servers[0].name, "Test Server");
  await steam.matchmaking.servers.requestFriendsServerList(480, { filters: [{ key: "secure" }] });
  await steam.matchmaking.servers.requestFavoritesServerList(480);
  await steam.matchmaking.servers.requestHistoryServerList(480);
  await steam.matchmaking.servers.requestSpectatorServerList(480);
  const ping = await steam.matchmaking.servers.pingServer(2130706433, 27016, 5);
  assert.equal(ping.responded, true);
  assert.equal(ping.server.name, "Test Server");
  const players = await steam.matchmaking.servers.playerDetails(2130706433, 27016, 5);
  assert.equal(players.responded, true);
  assert.equal(players.players[0].timePlayed, 12.5);
  const rules = await steam.matchmaking.servers.serverRules(2130706433, 27016, 5);
  assert.equal(rules.responded, true);
  assert.equal(rules.rules[0].name, "sv_cheats");

  const lobby = await steam.matchmaking.createLobby(steam.matchmaking.LobbyType.Public, 4);
  assert.equal((await steam.matchmaking.joinLobby(lobbyId)).id, lobbyId);
  assert.equal(lobby.getMemberCount(), 2n);
  assert.equal(lobby.getMemberLimit(), 4n);
  assert.equal(lobby.getMembers()[0].steamId64, memberId);
  assert.equal(lobby.getOwner().steamId64, memberId);
  assert.equal(lobby.setJoinable(true), true);
  assert.equal(lobby.getData("key"), "value");
  assert.equal(lobby.setData("key", "value"), true);
  assert.equal(lobby.deleteData("key"), true);
  assert.deepEqual(lobby.getFullData(), { map: "test-map" });
  assert.equal(lobby.inviteUser(memberId), true);
  assert.equal(lobby.getMemberData(memberId, "status"), "ready");
  lobby.setMemberData("status", "ready");
  assert.equal(lobby.sendChatMessage("hello"), true);
  assert.equal(lobby.getChatEntry(7, 128).steamId.steamId64, memberId);
  assert.equal(lobby.requestData(), true);
  lobby.setGameServer({ ip: 2130706433, port: 27015, steamId64: serverId });
  assert.equal(lobby.getGameServer().steamId.steamId64, serverId);
  assert.equal(lobby.setMemberLimit(8), true);
  assert.equal(lobby.setType(steam.matchmaking.LobbyType.Invisible), true);
  assert.equal(lobby.setOwner(memberId), true);
  assert.equal(lobby.setLinkedLobby(dependentLobbyId), true);
  lobby.leave();

  let inviteEvent;
  steam.callback.register(steam.SteamCallback.LobbyInvite, (event) => {
    inviteEvent = event;
  });
  fake.callbacks.get(steam.SteamCallback.LobbyInvite)({
    user: String(memberId),
    lobby: String(lobbyId),
    game_id: "480"
  });
  assert.equal(inviteEvent.user, memberId);
  assert.equal(inviteEvent.lobby, lobbyId);
  assert.equal(inviteEvent.gameId, 480n);

  let chatEvent;
  steam.callback.register(steam.SteamCallback.LobbyChatMsg, (event) => {
    chatEvent = event;
  });
  fake.callbacks.get(steam.SteamCallback.LobbyChatMsg)({
    lobby: String(lobbyId),
    user: String(memberId),
    entry_type: 1,
    chat_id: 7
  });
  assert.equal(chatEvent.entryType, 1);
  assert.equal(chatEvent.chatId, 7);

  assert.deepEqual(fake.calls.find((call) => call.method === "matchmakingAddRequestLobbyListStringFilter"), {
    method: "matchmakingAddRequestLobbyListStringFilter",
    args: ["mode", "coop", steam.matchmaking.LobbyComparison.Equal]
  });
  assert.deepEqual(fake.calls.find((call) => call.method === "matchmakingServersRequestInternetServerList"), {
    method: "matchmakingServersRequestInternetServerList",
    args: [480, [{ key: "map", value: "arena" }], 5]
  });
  assert.deepEqual(fake.calls.find((call) => call.method === "matchmakingServersRequestFriendsServerList"), {
    method: "matchmakingServersRequestFriendsServerList",
    args: [480, [{ key: "secure", value: "" }], undefined]
  });
});

test("apps facade covers DLC, launch, depot, trial, beta, and file-detail helpers", async (t) => {
  const sha = Buffer.from("00112233445566778899aabbccddeeff00112233", "hex");
  const fake = createFakeNative({
    appsEarliestPurchaseUnixTime(appId) {
      this.calls.push({ method: "appsEarliestPurchaseUnixTime", args: [appId] });
      return 1700000000;
    },
    appsDlcCount() {
      this.calls.push({ method: "appsDlcCount", args: [] });
      return 1;
    },
    appsDlcDataByIndex(index) {
      this.calls.push({ method: "appsDlcDataByIndex", args: [index] });
      return index === 0 ? { app_id: 481, available: true, name: "Soundtrack" } : null;
    },
    appsInstallDlc(appId) {
      this.calls.push({ method: "appsInstallDlc", args: [appId] });
    },
    appsUninstallDlc(appId) {
      this.calls.push({ method: "appsUninstallDlc", args: [appId] });
    },
    appsRequestAppProofOfPurchaseKey(appId) {
      this.calls.push({ method: "appsRequestAppProofOfPurchaseKey", args: [appId] });
    },
    appsRequestAllProofOfPurchaseKeys() {
      this.calls.push({ method: "appsRequestAllProofOfPurchaseKeys", args: [] });
    },
    appsMarkContentCorrupt(missingFilesOnly) {
      this.calls.push({ method: "appsMarkContentCorrupt", args: [missingFilesOnly] });
      return true;
    },
    appsInstalledDepots(appId, maxDepots) {
      this.calls.push({ method: "appsInstalledDepots", args: [appId, maxDepots] });
      return [100, 101];
    },
    appsLaunchQueryParam(key) {
      this.calls.push({ method: "appsLaunchQueryParam", args: [key] });
      return "127.0.0.1";
    },
    appsDlcDownloadProgress(appId) {
      this.calls.push({ method: "appsDlcDownloadProgress", args: [appId] });
      return appId === 481 ? { bytes_downloaded: "10", bytes_total: 20n } : null;
    },
    appsLaunchCommandLine(maxBytes) {
      this.calls.push({ method: "appsLaunchCommandLine", args: [maxBytes] });
      return "+connect 127.0.0.1";
    },
    appsIsSubscribedFromFamilySharing() {
      this.calls.push({ method: "appsIsSubscribedFromFamilySharing", args: [] });
      return true;
    },
    appsTimedTrial() {
      this.calls.push({ method: "appsTimedTrial", args: [] });
      return { seconds_allowed: 3600, seconds_played: 120 };
    },
    appsSetDlcContext(appId) {
      this.calls.push({ method: "appsSetDlcContext", args: [appId] });
      return true;
    },
    appsBetaCounts() {
      this.calls.push({ method: "appsBetaCounts", args: [] });
      return { total: 2, available: 1, private: 1 };
    },
    appsBetaInfo(index) {
      this.calls.push({ method: "appsBetaInfo", args: [index] });
      return index === 0
        ? { flags: 1, build_id: 123, name: "public", description: "Public beta", last_updated: 1700000000 }
        : null;
    },
    appsSetActiveBeta(betaName) {
      this.calls.push({ method: "appsSetActiveBeta", args: [betaName] });
      return true;
    },
    appsGetFileDetails(fileName, timeoutSeconds) {
      this.calls.push({ method: "appsGetFileDetails", args: [fileName, timeoutSeconds] });
      return Promise.resolve({ result: 1, file_size: "12345", sha, sha_hex: sha.toString("hex"), flags: 2 });
    }
  });
  const steam = loadSteamWithFakeNative(fake);

  t.after(clearSteamBridgeCache);

  assert.equal(steam.apps.earliestPurchaseUnixTime(480), 1700000000);
  assert.equal(steam.apps.dlcCount(), 1);
  assert.deepEqual(steam.apps.dlcDataByIndex(0), { appId: 481, available: true, name: "Soundtrack" });
  assert.equal(steam.apps.dlcDataByIndex(9), null);

  steam.apps.installDlc(481);
  steam.apps.uninstallDlc(481);
  steam.apps.requestAppProofOfPurchaseKey(481);
  steam.apps.requestAllProofOfPurchaseKeys();

  assert.equal(steam.apps.markContentCorrupt(true), true);
  assert.deepEqual(steam.apps.installedDepots(480, 4), [100, 101]);
  assert.equal(steam.apps.launchQueryParam("server"), "127.0.0.1");
  assert.deepEqual(steam.apps.dlcDownloadProgress(481), { bytesDownloaded: 10n, bytesTotal: 20n });
  assert.equal(steam.apps.dlcDownloadProgress(999), null);
  assert.equal(steam.apps.launchCommandLine(512), "+connect 127.0.0.1");
  assert.equal(steam.apps.isSubscribedFromFamilySharing(), true);
  assert.deepEqual(steam.apps.timedTrial(), { secondsAllowed: 3600, secondsPlayed: 120 });
  assert.equal(steam.apps.setDlcContext(481), true);
  assert.deepEqual(steam.apps.betaCounts(), { total: 2, available: 1, private: 1 });
  assert.deepEqual(steam.apps.betaInfo(0), {
    flags: 1,
    buildId: 123,
    name: "public",
    description: "Public beta",
    lastUpdated: 1700000000
  });
  assert.equal(steam.apps.betaInfo(9), null);
  assert.equal(steam.apps.setActiveBeta("public"), true);
  assert.deepEqual(await steam.apps.getFileDetails("steam_appid.txt", 5), {
    result: 1,
    fileSize: 12345n,
    sha,
    shaHex: sha.toString("hex"),
    flags: 2
  });
  assert.deepEqual(
    fake.calls.filter((call) =>
      [
        "appsInstalledDepots",
        "appsMarkContentCorrupt",
        "appsLaunchCommandLine",
        "appsSetActiveBeta",
        "appsGetFileDetails"
      ].includes(call.method)
    ),
    [
      { method: "appsMarkContentCorrupt", args: [true] },
      { method: "appsInstalledDepots", args: [480, 4] },
      { method: "appsLaunchCommandLine", args: [512] },
      { method: "appsSetActiveBeta", args: ["public"] },
      { method: "appsGetFileDetails", args: ["steam_appid.txt", 5] }
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

test("networking messages facade covers identity, message, session, and callback flows", (t) => {
  const peer = { identity_type: 16, text: "steamid:76561198000000010", steam_id64: "76561198000000010" };
  const quickStatus = {
    state: 3,
    ping: 42,
    connection_quality_local: 0.95,
    connection_quality_remote: 0.9,
    out_packets_per_second: 10.5,
    out_bytes_per_second: 2048.5,
    in_packets_per_second: 9.5,
    in_bytes_per_second: 1024.25,
    send_rate_bytes_per_second: 4096,
    pending_unreliable: 1,
    pending_reliable: 2,
    sent_unacked_reliable: 3,
    queue_time: "5000",
    max_jitter: 50
  };
  const fake = createFakeNative({
    networkingIdentityToString(identity) {
      this.calls.push({ method: "networkingIdentityToString", args: [identity] });
      return identity.steamId64 ? `steamid:${identity.steamId64}` : identity.text;
    },
    networkingIdentityParse(text) {
      this.calls.push({ method: "networkingIdentityParse", args: [text] });
      return text === "bad" ? null : peer;
    },
    networkingMessagesSendMessageToUser(identity, data, sendFlags, channel) {
      this.calls.push({ method: "networkingMessagesSendMessageToUser", args: [identity, data, sendFlags, channel] });
      return 1;
    },
    networkingMessagesReceiveMessagesOnChannel(channel, maxMessages) {
      this.calls.push({ method: "networkingMessagesReceiveMessagesOnChannel", args: [channel, maxMessages] });
      return [
        {
          data: Buffer.from("payload"),
          size: 7,
          peer,
          connection: 99,
          connection_user_data: "123",
          time_received: "456",
          message_number: "7",
          channel,
          flags: 8,
          user_data: "9",
          lane: 1
        }
      ];
    },
    networkingMessagesAcceptSessionWithUser(identity) {
      this.calls.push({ method: "networkingMessagesAcceptSessionWithUser", args: [identity] });
      return true;
    },
    networkingMessagesCloseSessionWithUser(identity) {
      this.calls.push({ method: "networkingMessagesCloseSessionWithUser", args: [identity] });
      return true;
    },
    networkingMessagesCloseChannelWithUser(identity, channel) {
      this.calls.push({ method: "networkingMessagesCloseChannelWithUser", args: [identity, channel] });
      return true;
    },
    networkingMessagesGetSessionConnectionInfo(identity) {
      this.calls.push({ method: "networkingMessagesGetSessionConnectionInfo", args: [identity] });
      return {
        state: 3,
        remote_identity: peer,
        user_data: "11",
        listen_socket: 0,
        remote_pop: 1234,
        relay_pop: 5678,
        end_reason: 0,
        end_debug: "",
        connection_description: "session to peer",
        flags: 4,
        quick_status: quickStatus
      };
    }
  });
  const steam = loadSteamWithFakeNative(fake);

  t.after(clearSteamBridgeCache);

  const identity = { steamId64: 76561198000000010n };
  assert.equal(steam.networking.NetworkingSendFlags.Reliable, 8);
  assert.equal(steam.networking.messages.ConnectionState.Connected, 3);
  assert.equal(steam.networking.messages.identityToString(identity), "steamid:76561198000000010");
  assert.deepEqual(steam.networking.messages.parseIdentity("steamid:76561198000000010"), {
    identityType: 16,
    text: "steamid:76561198000000010",
    steamId64: 76561198000000010n,
    genericString: null,
    localHost: false,
    invalid: false,
    fakeIpType: 0
  });
  assert.equal(steam.networking.messages.parseIdentity("bad"), null);
  assert.equal(
    steam.networking.messages.sendMessageToUser(
      identity,
      Buffer.from("payload"),
      steam.networking.messages.SendFlags.Reliable,
      2
    ),
    1
  );
  assert.deepEqual(steam.networking.messages.receiveMessagesOnChannel(2, 4), [
    {
      data: Buffer.from("payload"),
      size: 7,
      peer: {
        identityType: 16,
        text: "steamid:76561198000000010",
        steamId64: 76561198000000010n,
        genericString: null,
        localHost: false,
        invalid: false,
        fakeIpType: 0
      },
      connection: 99,
      connectionUserData: 123n,
      timeReceived: 456n,
      messageNumber: 7n,
      channel: 2,
      flags: 8,
      userData: 9n,
      lane: 1
    }
  ]);
  assert.equal(steam.networking.messages.acceptSessionWithUser(identity), true);
  assert.equal(steam.networking.messages.closeSessionWithUser(identity), true);
  assert.equal(steam.networking.messages.closeChannelWithUser(identity, 2), true);
  assert.deepEqual(steam.networking.messages.getSessionConnectionInfo(identity), {
    state: 3,
    remoteIdentity: {
      identityType: 16,
      text: "steamid:76561198000000010",
      steamId64: 76561198000000010n,
      genericString: null,
      localHost: false,
      invalid: false,
      fakeIpType: 0
    },
    userData: 11n,
    listenSocket: 0,
    remotePop: 1234,
    relayPop: 5678,
    endReason: 0,
    endDebug: "",
    connectionDescription: "session to peer",
    flags: 4,
    quickStatus: {
      state: 3,
      ping: 42,
      connectionQualityLocal: 0.95,
      connectionQualityRemote: 0.9,
      outPacketsPerSecond: 10.5,
      outBytesPerSecond: 2048.5,
      inPacketsPerSecond: 9.5,
      inBytesPerSecond: 1024.25,
      sendRateBytesPerSecond: 4096,
      pendingUnreliable: 1,
      pendingReliable: 2,
      sentUnackedReliable: 3,
      queueTime: 5000n,
      maxJitter: 50
    }
  });

  let requestEvent;
  steam.callback.register(steam.SteamCallback.SteamNetworkingMessagesSessionRequest, (event) => {
    requestEvent = event;
  });
  fake.callbacks.get(steam.SteamCallback.SteamNetworkingMessagesSessionRequest)({ remote_identity: peer });
  assert.equal(requestEvent.remoteIdentity.steamId64, 76561198000000010n);

  let failedEvent;
  steam.callback.register(steam.SteamCallback.SteamNetworkingMessagesSessionFailed, (event) => {
    failedEvent = event;
  });
  fake.callbacks.get(steam.SteamCallback.SteamNetworkingMessagesSessionFailed)({
    info: {
      state: 5,
      remote_identity: peer,
      user_data: "12",
      flags: 1
    }
  });
  assert.equal(failedEvent.info.remoteIdentity.steamId64, 76561198000000010n);
  assert.equal(failedEvent.info.userData, 12n);
  assert.equal(failedEvent.info.quickStatus, null);
  assert.deepEqual(fake.calls.find((call) => call.method === "networkingMessagesSendMessageToUser"), {
    method: "networkingMessagesSendMessageToUser",
    args: [identity, Buffer.from("payload"), 8, 2]
  });
});

test("networking sockets facade covers connection handles, status, poll groups, and callbacks", (t) => {
  const peer = { identity_type: 16, text: "steamid:76561198000000010", steam_id64: "76561198000000010" };
  const address = {
    text: "127.0.0.1:27015",
    ipv4: 2130706433,
    port: 27015,
    ipv4_address: "127.0.0.1",
    is_ipv4: true,
    is_local_host: true,
    is_fake_ip: false,
    fake_ip_type: 0,
    ipv6_all_zeros: false
  };
  const quickStatus = {
    state: 3,
    ping: 42,
    connection_quality_local: 0.95,
    connection_quality_remote: 0.9,
    out_packets_per_second: 10.5,
    out_bytes_per_second: 2048.5,
    in_packets_per_second: 9.5,
    in_bytes_per_second: 1024.25,
    send_rate_bytes_per_second: 4096,
    pending_unreliable: 1,
    pending_reliable: 2,
    sent_unacked_reliable: 3,
    queue_time: "5000",
    max_jitter: 50
  };
  const connectionInfo = {
    state: 3,
    remote_identity: peer,
    user_data: "88",
    listen_socket: 44,
    remote_address: address,
    remote_pop: 1234,
    relay_pop: 5678,
    end_reason: 0,
    end_debug: "",
    connection_description: "socket to peer",
    flags: 16
  };
  const fake = createFakeNative({
    networkingSocketsCreateListenSocketIp(addr) {
      this.calls.push({ method: "networkingSocketsCreateListenSocketIp", args: [addr] });
      return 44;
    },
    networkingSocketsConnectByIpAddress(addr) {
      this.calls.push({ method: "networkingSocketsConnectByIpAddress", args: [addr] });
      return 101;
    },
    networkingSocketsCreateListenSocketP2p(port) {
      this.calls.push({ method: "networkingSocketsCreateListenSocketP2p", args: [port] });
      return 45;
    },
    networkingSocketsConnectP2p(identity, port) {
      this.calls.push({ method: "networkingSocketsConnectP2p", args: [identity, port] });
      return 102;
    },
    networkingSocketsAcceptConnection(connection) {
      this.calls.push({ method: "networkingSocketsAcceptConnection", args: [connection] });
      return 1;
    },
    networkingSocketsCloseConnection(connection, reason, debug, enableLinger) {
      this.calls.push({ method: "networkingSocketsCloseConnection", args: [connection, reason, debug, enableLinger] });
      return true;
    },
    networkingSocketsCloseListenSocket(socket) {
      this.calls.push({ method: "networkingSocketsCloseListenSocket", args: [socket] });
      return true;
    },
    networkingSocketsSetConnectionUserData(connection, userData) {
      this.calls.push({ method: "networkingSocketsSetConnectionUserData", args: [connection, userData] });
      return true;
    },
    networkingSocketsGetConnectionUserData(connection) {
      this.calls.push({ method: "networkingSocketsGetConnectionUserData", args: [connection] });
      return "88";
    },
    networkingSocketsSetConnectionName(connection, name) {
      this.calls.push({ method: "networkingSocketsSetConnectionName", args: [connection, name] });
    },
    networkingSocketsGetConnectionName(connection) {
      this.calls.push({ method: "networkingSocketsGetConnectionName", args: [connection] });
      return "peer";
    },
    networkingSocketsSendMessageToConnection(connection, data, sendFlags) {
      this.calls.push({ method: "networkingSocketsSendMessageToConnection", args: [connection, data, sendFlags] });
      return { result: 1, message_number: "777" };
    },
    networkingSocketsFlushMessagesOnConnection(connection) {
      this.calls.push({ method: "networkingSocketsFlushMessagesOnConnection", args: [connection] });
      return 1;
    },
    networkingSocketsReceiveMessagesOnConnection(connection, maxMessages) {
      this.calls.push({ method: "networkingSocketsReceiveMessagesOnConnection", args: [connection, maxMessages] });
      return [
        {
          data: Buffer.from("socket"),
          size: 6,
          peer,
          connection,
          connection_user_data: "88",
          time_received: "456",
          message_number: "7",
          channel: 0,
          flags: 8,
          user_data: "9",
          lane: 1
        }
      ];
    },
    networkingSocketsGetConnectionInfo(connection) {
      this.calls.push({ method: "networkingSocketsGetConnectionInfo", args: [connection] });
      return connectionInfo;
    },
    networkingSocketsGetConnectionRealTimeStatus(connection) {
      this.calls.push({ method: "networkingSocketsGetConnectionRealTimeStatus", args: [connection] });
      return quickStatus;
    },
    networkingSocketsGetConnectionRealTimeStatusWithLanes(connection, maxLanes) {
      this.calls.push({ method: "networkingSocketsGetConnectionRealTimeStatusWithLanes", args: [connection, maxLanes] });
      return {
        status: quickStatus,
        lanes: [
          {
            pending_unreliable: 4,
            pending_reliable: 5,
            sent_unacked_reliable: 6,
            queue_time: "7000"
          }
        ]
      };
    },
    networkingSocketsGetDetailedConnectionStatus(connection, maxBytes) {
      this.calls.push({ method: "networkingSocketsGetDetailedConnectionStatus", args: [connection, maxBytes] });
      return "detailed status";
    },
    networkingSocketsGetListenSocketAddress(socket) {
      this.calls.push({ method: "networkingSocketsGetListenSocketAddress", args: [socket] });
      return address;
    },
    networkingSocketsCreateSocketPair(useNetworkLoopback, identity1, identity2) {
      this.calls.push({ method: "networkingSocketsCreateSocketPair", args: [useNetworkLoopback, identity1, identity2] });
      return { connection1: 201, connection2: 202 };
    },
    networkingSocketsConfigureConnectionLanes(connection, priorities, weights) {
      this.calls.push({ method: "networkingSocketsConfigureConnectionLanes", args: [connection, priorities, weights] });
      return 1;
    },
    networkingSocketsGetIdentity() {
      this.calls.push({ method: "networkingSocketsGetIdentity", args: [] });
      return peer;
    },
    networkingSocketsInitAuthentication() {
      this.calls.push({ method: "networkingSocketsInitAuthentication", args: [] });
      return 100;
    },
    networkingSocketsGetAuthenticationStatus() {
      this.calls.push({ method: "networkingSocketsGetAuthenticationStatus", args: [] });
      return { availability: 100, debug_message: "auth ready" };
    },
    networkingSocketsCreatePollGroup() {
      this.calls.push({ method: "networkingSocketsCreatePollGroup", args: [] });
      return 301;
    },
    networkingSocketsRunCallbacks() {
      this.calls.push({ method: "networkingSocketsRunCallbacks", args: [] });
    },
    networkingSocketsDestroyPollGroup(pollGroup) {
      this.calls.push({ method: "networkingSocketsDestroyPollGroup", args: [pollGroup] });
      return true;
    },
    networkingSocketsSetConnectionPollGroup(connection, pollGroup) {
      this.calls.push({ method: "networkingSocketsSetConnectionPollGroup", args: [connection, pollGroup] });
      return true;
    },
    networkingSocketsReceiveMessagesOnPollGroup(pollGroup, maxMessages) {
      this.calls.push({ method: "networkingSocketsReceiveMessagesOnPollGroup", args: [pollGroup, maxMessages] });
      return [];
    },
    networkingSocketsReceivedRelayAuthTicket(ticket) {
      this.calls.push({ method: "networkingSocketsReceivedRelayAuthTicket", args: [ticket] });
      return true;
    },
    networkingSocketsFindRelayAuthTicketForServer(identity, remoteVirtualPort) {
      this.calls.push({ method: "networkingSocketsFindRelayAuthTicketForServer", args: [identity, remoteVirtualPort] });
      return 120;
    },
    networkingSocketsConnectToHostedDedicatedServer(identity, remoteVirtualPort) {
      this.calls.push({ method: "networkingSocketsConnectToHostedDedicatedServer", args: [identity, remoteVirtualPort] });
      return 103;
    },
    networkingSocketsGetHostedDedicatedServerPort() {
      this.calls.push({ method: "networkingSocketsGetHostedDedicatedServerPort", args: [] });
      return 27015;
    },
    networkingSocketsGetHostedDedicatedServerPopId() {
      this.calls.push({ method: "networkingSocketsGetHostedDedicatedServerPopId", args: [] });
      return 1234;
    },
    networkingSocketsGetHostedDedicatedServerAddress() {
      this.calls.push({ method: "networkingSocketsGetHostedDedicatedServerAddress", args: [] });
      return {
        result: 1,
        routing: {
          pop_id: 1234,
          size: 3,
          data: Buffer.from("sdr")
        },
        debug_message: ""
      };
    },
    networkingSocketsCreateHostedDedicatedServerListenSocket(localVirtualPort) {
      this.calls.push({ method: "networkingSocketsCreateHostedDedicatedServerListenSocket", args: [localVirtualPort] });
      return 46;
    },
    networkingSocketsGetGameCoordinatorServerLogin(appData, maxBlobBytes) {
      this.calls.push({ method: "networkingSocketsGetGameCoordinatorServerLogin", args: [appData, maxBlobBytes] });
      return {
        result: 1,
        identity: peer,
        routing: {
          pop_id: 1234,
          size: 3,
          data: Buffer.from("sdr")
        },
        app_id: 480,
        timestamp: 123456,
        app_data: appData,
        signed_blob: Buffer.from("signed-login"),
        debug_message: ""
      };
    },
    networkingSocketsGetCertificateRequest(maxBytes) {
      this.calls.push({ method: "networkingSocketsGetCertificateRequest", args: [maxBytes] });
      return { success: true, data: Buffer.from("cert-request"), error: "" };
    },
    networkingSocketsSetCertificate(certificate) {
      this.calls.push({ method: "networkingSocketsSetCertificate", args: [certificate] });
      return { success: true, data: Buffer.alloc(0), error: "" };
    },
    networkingSocketsResetIdentity(identity) {
      this.calls.push({ method: "networkingSocketsResetIdentity", args: [identity] });
    },
    networkingSocketsBeginAsyncRequestFakeIp(numPorts) {
      this.calls.push({ method: "networkingSocketsBeginAsyncRequestFakeIp", args: [numPorts] });
      return true;
    },
    networkingSocketsGetFakeIp(idxFirstPort) {
      this.calls.push({ method: "networkingSocketsGetFakeIp", args: [idxFirstPort] });
      return {
        result: 1,
        identity: peer,
        ipv4: 167772161,
        ipv4_address: "10.0.0.1",
        ports: [27015, 27016]
      };
    },
    networkingSocketsCreateListenSocketP2pFakeIp(idxFakePort) {
      this.calls.push({ method: "networkingSocketsCreateListenSocketP2pFakeIp", args: [idxFakePort] });
      return 47;
    },
    networkingSocketsGetRemoteFakeIpForConnection(connection) {
      this.calls.push({ method: "networkingSocketsGetRemoteFakeIpForConnection", args: [connection] });
      return { result: 1, address };
    },
    networkingSocketsCreateFakeUdpPort(fakeServerPort) {
      this.calls.push({ method: "networkingSocketsCreateFakeUdpPort", args: [fakeServerPort] });
      return 601;
    },
    networkingFakeUdpPortDestroy(handle) {
      this.calls.push({ method: "networkingFakeUdpPortDestroy", args: [handle] });
      return true;
    },
    networkingFakeUdpPortSendMessageToFakeIp(handle, remoteAddress, data, sendFlags) {
      this.calls.push({ method: "networkingFakeUdpPortSendMessageToFakeIp", args: [handle, remoteAddress, data, sendFlags] });
      return 1;
    },
    networkingFakeUdpPortReceiveMessages(handle, maxMessages) {
      this.calls.push({ method: "networkingFakeUdpPortReceiveMessages", args: [handle, maxMessages] });
      return [
        {
          data: Buffer.from("udp"),
          size: 3,
          peer,
          connection: 0,
          connection_user_data: "0",
          time_received: "789",
          message_number: "10",
          channel: 0,
          flags: 0,
          user_data: "0",
          lane: 0
        }
      ];
    },
    networkingFakeUdpPortScheduleCleanup(handle, remoteAddress) {
      this.calls.push({ method: "networkingFakeUdpPortScheduleCleanup", args: [handle, remoteAddress] });
    }
  });
  const steam = loadSteamWithFakeNative(fake);

  t.after(clearSteamBridgeCache);

  const identity = { steamId64: 76561198000000010n };
  assert.equal(steam.SteamCallback.SteamNetConnectionStatusChanged, 1221);
  assert.equal(steam.SteamCallback.SteamNetworkingFakeIPResult, 1223);
  assert.equal(steam.networking.sockets.ConnectionState.Connected, 3);
  assert.equal(steam.networking.sockets.Availability.Current, 100);
  assert.equal(steam.networking.sockets.createListenSocketIP({ ipv4: 2130706433, port: 27015 }), 44);
  assert.equal(steam.networking.sockets.connectByIPAddress({ text: "127.0.0.1:27015" }), 101);
  assert.equal(steam.networking.sockets.createListenSocketP2P(7), 45);
  assert.equal(steam.networking.sockets.connectP2P(identity, 7), 102);
  assert.equal(steam.networking.sockets.acceptConnection(102), 1);
  assert.equal(steam.networking.sockets.closeConnection(102, { reason: 2000, debug: "done", enableLinger: true }), true);
  assert.equal(steam.networking.sockets.closeListenSocket(44), true);
  assert.equal(steam.networking.sockets.setConnectionUserData(102, 88n), true);
  assert.equal(steam.networking.sockets.getConnectionUserData(102), 88n);
  steam.networking.sockets.setConnectionName(102, "peer");
  assert.equal(steam.networking.sockets.getConnectionName(102), "peer");
  assert.deepEqual(steam.networking.sockets.sendMessageToConnection(102, Buffer.from("socket")), {
    result: 1,
    messageNumber: 777n
  });
  assert.equal(steam.networking.sockets.flushMessagesOnConnection(102), 1);
  assert.equal(steam.networking.sockets.receiveMessagesOnConnection(102, 2)[0].messageNumber, 7n);
  assert.deepEqual(steam.networking.sockets.getConnectionInfo(102), {
    state: 3,
    remoteIdentity: {
      identityType: 16,
      text: "steamid:76561198000000010",
      steamId64: 76561198000000010n,
      genericString: null,
      localHost: false,
      invalid: false,
      fakeIpType: 0
    },
    userData: 88n,
    listenSocket: 44,
    remoteAddress: {
      text: "127.0.0.1:27015",
      ipv4: 2130706433,
      port: 27015,
      ipv4Address: "127.0.0.1",
      isIpv4: true,
      isLocalHost: true,
      isFakeIp: false,
      fakeIpType: 0,
      ipv6AllZeros: false
    },
    remotePop: 1234,
    relayPop: 5678,
    endReason: 0,
    endDebug: "",
    connectionDescription: "socket to peer",
    flags: 16
  });
  assert.equal(steam.networking.sockets.getConnectionRealTimeStatus(102).queueTime, 5000n);
  assert.deepEqual(steam.networking.sockets.getConnectionRealTimeStatusWithLanes(102, 2), {
    status: {
      state: 3,
      ping: 42,
      connectionQualityLocal: 0.95,
      connectionQualityRemote: 0.9,
      outPacketsPerSecond: 10.5,
      outBytesPerSecond: 2048.5,
      inPacketsPerSecond: 9.5,
      inBytesPerSecond: 1024.25,
      sendRateBytesPerSecond: 4096,
      pendingUnreliable: 1,
      pendingReliable: 2,
      sentUnackedReliable: 3,
      queueTime: 5000n,
      maxJitter: 50
    },
    lanes: [
      {
        pendingUnreliable: 4,
        pendingReliable: 5,
        sentUnackedReliable: 6,
        queueTime: 7000n
      }
    ]
  });
  assert.equal(steam.networking.sockets.getDetailedConnectionStatus(102, 512), "detailed status");
  assert.equal(steam.networking.sockets.getListenSocketAddress(44).port, 27015);
  assert.deepEqual(steam.networking.sockets.createSocketPair(true, { localHost: true }, { genericString: "peer" }), {
    connection1: 201,
    connection2: 202
  });
  assert.equal(steam.networking.sockets.configureConnectionLanes(102, [10, 5], [100, 50]), 1);
  assert.equal(steam.networking.sockets.getIdentity().steamId64, 76561198000000010n);
  assert.equal(steam.networking.sockets.initAuthentication(), 100);
  assert.equal(steam.networking.sockets.getAuthenticationStatus().debugMessage, "auth ready");
  const pollGroup = steam.networking.sockets.createPollGroup();
  steam.networking.sockets.runCallbacks();
  assert.equal(steam.networking.sockets.setConnectionPollGroup(102, pollGroup), true);
  assert.deepEqual(steam.networking.sockets.receiveMessagesOnPollGroup(pollGroup, 4), []);
  assert.equal(steam.networking.sockets.destroyPollGroup(pollGroup), true);
  assert.equal(steam.networking.sockets.receivedRelayAuthTicket(Buffer.from("ticket")), true);
  assert.equal(steam.networking.sockets.findRelayAuthTicketForServer(identity, 7), 120);
  assert.equal(steam.networking.sockets.connectToHostedDedicatedServer(identity, 7), 103);
  assert.equal(steam.networking.sockets.getHostedDedicatedServerPort(), 27015);
  assert.equal(steam.networking.sockets.getHostedDedicatedServerPopId(), 1234);
  const hostedAddress = steam.networking.sockets.getHostedDedicatedServerAddress();
  assert.equal(hostedAddress.result, 1);
  assert.equal(hostedAddress.routing.popId, 1234);
  assert.equal(hostedAddress.routing.data.toString(), "sdr");
  assert.equal(steam.networking.sockets.createHostedDedicatedServerListenSocket(7), 46);
  const serverLogin = steam.networking.sockets.getGameCoordinatorServerLogin(Buffer.from("app-data"), 4096);
  assert.equal(serverLogin.result, 1);
  assert.equal(serverLogin.identity.steamId64, 76561198000000010n);
  assert.equal(serverLogin.routing.data.toString(), "sdr");
  assert.equal(serverLogin.appId, 480);
  assert.equal(serverLogin.appData.toString(), "app-data");
  assert.equal(serverLogin.signedBlob.toString(), "signed-login");
  const certificateRequest = steam.networking.sockets.getCertificateRequest(256);
  assert.equal(certificateRequest.success, true);
  assert.equal(certificateRequest.data.toString(), "cert-request");
  const certificateSet = steam.networking.sockets.setCertificate(Buffer.from("cert"));
  assert.equal(certificateSet.success, true);
  steam.networking.sockets.resetIdentity({ localHost: true });
  assert.equal(steam.networking.sockets.beginAsyncRequestFakeIP(2), true);
  assert.deepEqual(steam.networking.sockets.getFakeIP(0), {
    result: 1,
    identity: {
      identityType: 16,
      text: "steamid:76561198000000010",
      steamId64: 76561198000000010n,
      genericString: null,
      localHost: false,
      invalid: false,
      fakeIpType: 0
    },
    ipv4: 167772161,
    ipv4Address: "10.0.0.1",
    ports: [27015, 27016]
  });
  assert.equal(steam.networking.sockets.createListenSocketP2PFakeIP(1), 47);
  assert.equal(steam.networking.sockets.getRemoteFakeIPForConnection(102).address.port, 27015);
  const fakeUdpPort = steam.networking.sockets.createFakeUDPPort(1);
  assert.equal(fakeUdpPort, 601);
  assert.equal(
    steam.networking.fakeUDP.sendMessageToFakeIP(fakeUdpPort, { text: "10.0.0.1:27015" }, Buffer.from("udp")),
    1
  );
  assert.equal(steam.networking.fakeUDP.receiveMessages(fakeUdpPort, 3)[0].data.toString(), "udp");
  steam.networking.fakeUDP.scheduleCleanup(fakeUdpPort, { ipv4: 167772161, port: 27015 });
  assert.equal(steam.networking.fakeUDP.destroy(fakeUdpPort), true);

  let statusEvent;
  steam.callback.register(steam.SteamCallback.SteamNetConnectionStatusChanged, (event) => {
    statusEvent = event;
  });
  fake.callbacks.get(steam.SteamCallback.SteamNetConnectionStatusChanged)({
    connection: 102,
    old_state: 2,
    info: connectionInfo
  });
  assert.equal(statusEvent.connection, 102);
  assert.equal(statusEvent.oldState, 2);
  assert.equal(statusEvent.info.remoteIdentity.steamId64, 76561198000000010n);

  let fakeIpEvent;
  steam.callback.register(steam.SteamCallback.SteamNetworkingFakeIPResult, (event) => {
    fakeIpEvent = event;
  });
  fake.callbacks.get(steam.SteamCallback.SteamNetworkingFakeIPResult)({
    result: 1,
    identity: peer,
    ipv4: 167772161,
    ipv4_address: "10.0.0.1",
    ports: [27015]
  });
  assert.equal(fakeIpEvent.identity.steamId64, 76561198000000010n);
  assert.equal(fakeIpEvent.ipv4Address, "10.0.0.1");
  assert.deepEqual(fakeIpEvent.ports, [27015]);

  assert.deepEqual(fake.calls.find((call) => call.method === "networkingSocketsConnectP2p"), {
    method: "networkingSocketsConnectP2p",
    args: [{ steamId64: 76561198000000010n }, 7]
  });
  assert.deepEqual(fake.calls.find((call) => call.method === "networkingFakeUdpPortSendMessageToFakeIp"), {
    method: "networkingFakeUdpPortSendMessageToFakeIp",
    args: [601, { text: "10.0.0.1:27015" }, Buffer.from("udp"), steam.NetworkingSendFlags.Unreliable]
  });
  assert.deepEqual(fake.calls.find((call) => call.method === "networkingSocketsGetGameCoordinatorServerLogin"), {
    method: "networkingSocketsGetGameCoordinatorServerLogin",
    args: [Buffer.from("app-data"), 4096]
  });
});

test("networking utils facade covers relay, ping, fake IP, address, config, debug, and callback flows", (t) => {
  const peer = { identity_type: 16, text: "steamid:76561198000000010", steam_id64: "76561198000000010" };
  const fake = createFakeNative({
    networkingUtilsInitRelayNetworkAccess() {
      this.calls.push({ method: "networkingUtilsInitRelayNetworkAccess", args: [] });
    },
    networkingUtilsGetRelayNetworkStatus() {
      this.calls.push({ method: "networkingUtilsGetRelayNetworkStatus", args: [] });
      return {
        availability: 100,
        ping_measurement_in_progress: false,
        network_config_availability: 100,
        any_relay_availability: 100,
        debug_message: "relay ready"
      };
    },
    networkingUtilsGetLocalPingLocation() {
      this.calls.push({ method: "networkingUtilsGetLocalPingLocation", args: [] });
      return { location: "local-ping-location", age_seconds: 0.5 };
    },
    networkingUtilsParsePingLocation(location) {
      this.calls.push({ method: "networkingUtilsParsePingLocation", args: [location] });
      return location === "bad" ? null : "canonical-ping-location";
    },
    networkingUtilsEstimatePingTimeBetweenTwoLocations(location1, location2) {
      this.calls.push({ method: "networkingUtilsEstimatePingTimeBetweenTwoLocations", args: [location1, location2] });
      return 44;
    },
    networkingUtilsEstimatePingTimeFromLocalHost(location) {
      this.calls.push({ method: "networkingUtilsEstimatePingTimeFromLocalHost", args: [location] });
      return 22;
    },
    networkingUtilsCheckPingDataUpToDate(maxAgeSeconds) {
      this.calls.push({ method: "networkingUtilsCheckPingDataUpToDate", args: [maxAgeSeconds] });
      return true;
    },
    networkingUtilsGetPingToDataCenter(popId) {
      this.calls.push({ method: "networkingUtilsGetPingToDataCenter", args: [popId] });
      return { ping_ms: 33, via_relay_pop: 5678 };
    },
    networkingUtilsGetDirectPingToPop(popId) {
      this.calls.push({ method: "networkingUtilsGetDirectPingToPop", args: [popId] });
      return 30;
    },
    networkingUtilsGetPopCount() {
      this.calls.push({ method: "networkingUtilsGetPopCount", args: [] });
      return 2;
    },
    networkingUtilsGetPopList(maxPops) {
      this.calls.push({ method: "networkingUtilsGetPopList", args: [maxPops] });
      return [111, 222];
    },
    networkingUtilsGetLocalTimestamp() {
      this.calls.push({ method: "networkingUtilsGetLocalTimestamp", args: [] });
      return 123456789n;
    },
    networkingUtilsIsFakeIpv4(ipv4) {
      this.calls.push({ method: "networkingUtilsIsFakeIpv4", args: [ipv4] });
      return true;
    },
    networkingUtilsGetIpv4FakeIpType(ipv4) {
      this.calls.push({ method: "networkingUtilsGetIpv4FakeIpType", args: [ipv4] });
      return 2;
    },
    networkingUtilsParseIpAddress(text) {
      this.calls.push({ method: "networkingUtilsParseIpAddress", args: [text] });
      return text === "bad" ? null : {
        text: "127.0.0.1:27015",
        ipv4: 2130706433,
        port: 27015,
        ipv4_address: "127.0.0.1",
        is_ipv4: true,
        is_local_host: true,
        is_fake_ip: false,
        fake_ip_type: 1,
        ipv6_all_zeros: false
      };
    },
    networkingUtilsIpAddressToString(address, withPort) {
      this.calls.push({ method: "networkingUtilsIpAddressToString", args: [address, withPort] });
      return withPort ? "127.0.0.1:27015" : "127.0.0.1";
    },
    networkingUtilsGetIpAddressFakeIpType(address) {
      this.calls.push({ method: "networkingUtilsGetIpAddressFakeIpType", args: [address] });
      return 1;
    },
    networkingUtilsGetRealIdentityForFakeIp(address) {
      this.calls.push({ method: "networkingUtilsGetRealIdentityForFakeIp", args: [address] });
      return { result: 1, identity: peer };
    },
    networkingUtilsSetConfigValueInt32(value, scope, scopeObj, data) {
      this.calls.push({ method: "networkingUtilsSetConfigValueInt32", args: [value, scope, scopeObj, data] });
      return true;
    },
    networkingUtilsSetConfigValueInt64(value, scope, scopeObj, data) {
      this.calls.push({ method: "networkingUtilsSetConfigValueInt64", args: [value, scope, scopeObj, data] });
      return true;
    },
    networkingUtilsSetConfigValueFloat(value, scope, scopeObj, data) {
      this.calls.push({ method: "networkingUtilsSetConfigValueFloat", args: [value, scope, scopeObj, data] });
      return true;
    },
    networkingUtilsSetConfigValueString(value, scope, scopeObj, data) {
      this.calls.push({ method: "networkingUtilsSetConfigValueString", args: [value, scope, scopeObj, data] });
      return true;
    },
    networkingUtilsGetConfigValue(value, scope, scopeObj, maxBytes) {
      this.calls.push({ method: "networkingUtilsGetConfigValue", args: [value, scope, scopeObj, maxBytes] });
      if (value === 40) {
        return { result: 2, data_type: 2, int64_value: "9223372036854775807" };
      }
      if (value === 29) {
        return { result: 1, data_type: 4, string_value: "iad" };
      }
      return { result: 1, data_type: 1, int32_value: 5000 };
    },
    networkingUtilsGetConfigValueInfo(value) {
      this.calls.push({ method: "networkingUtilsGetConfigValueInfo", args: [value] });
      return { value, name: "TimeoutInitial", data_type: 1, scope: 4 };
    },
    networkingUtilsIterateGenericEditableConfigValues(current, enumerateDevVars) {
      this.calls.push({ method: "networkingUtilsIterateGenericEditableConfigValues", args: [current, enumerateDevVars] });
      if (current === 0) {
        return 24;
      }
      if (current === 24) {
        return 29;
      }
      return 0;
    },
    networkingUtilsRegisterDebugOutputHook(detailLevel, handler) {
      this.calls.push({ method: "networkingUtilsRegisterDebugOutputHook", args: [detailLevel] });
      this.networkingDebugOutputHandler = handler;
      return {
        disconnect: () => this.calls.push({ method: "disconnectNetworkingDebugOutputHook", args: [] })
      };
    }
  });
  const steam = loadSteamWithFakeNative(fake);

  t.after(clearSteamBridgeCache);

  assert.equal(steam.SteamCallback.SteamNetAuthenticationStatus, 1222);
  assert.equal(steam.SteamCallback.SteamRelayNetworkStatus, 1281);
  assert.equal(steam.networking.NetworkingAvailability.Current, 100);
  assert.equal(steam.networking.utils.Availability.Failed, -101);
  assert.equal(steam.networking.utils.FakeIpType.GlobalIPv4, 2);
  assert.equal(steam.networking.utils.ConfigScope.Connection, 4);
  assert.equal(steam.networking.utils.ConfigDataType.Int64, 2);
  assert.equal(steam.networking.utils.ConfigValue.TimeoutInitial, 24);
  assert.equal(steam.networking.utils.ConfigValue.ConnectionUserData, 40);
  assert.equal(steam.networking.utils.DebugOutputType.Warning, 4);
  assert.equal(steam.networking.utils.IceEnable.All, 2147483647);

  steam.networking.utils.initRelayNetworkAccess();
  assert.deepEqual(steam.networking.utils.getRelayNetworkStatus(), {
    availability: 100,
    pingMeasurementInProgress: false,
    networkConfigAvailability: 100,
    anyRelayAvailability: 100,
    debugMessage: "relay ready"
  });
  assert.deepEqual(steam.networking.utils.getLocalPingLocation(), {
    location: "local-ping-location",
    ageSeconds: 0.5
  });
  assert.equal(steam.networking.utils.parsePingLocation("local-ping-location"), "canonical-ping-location");
  assert.equal(steam.networking.utils.parsePingLocation("bad"), null);
  assert.equal(steam.networking.utils.estimatePingTimeBetweenTwoLocations("a", "b"), 44);
  assert.equal(steam.networking.utils.estimatePingTimeFromLocalHost("b"), 22);
  assert.equal(steam.networking.utils.checkPingDataUpToDate(60), true);
  assert.deepEqual(steam.networking.utils.getPingToDataCenter(1234), { pingMs: 33, viaRelayPop: 5678 });
  assert.equal(steam.networking.utils.getDirectPingToPop(1234), 30);
  assert.equal(steam.networking.utils.getPopCount(), 2);
  assert.deepEqual(steam.networking.utils.getPopList(3), [111, 222]);
  assert.equal(steam.networking.utils.getLocalTimestamp(), 123456789n);
  assert.equal(steam.networking.utils.isFakeIpv4(0x0a000001), true);
  assert.equal(steam.networking.utils.getIpv4FakeIpType(0x0a000001), 2);
  assert.deepEqual(steam.networking.utils.parseIpAddress("127.0.0.1:27015"), {
    text: "127.0.0.1:27015",
    ipv4: 2130706433,
    port: 27015,
    ipv4Address: "127.0.0.1",
    isIpv4: true,
    isLocalHost: true,
    isFakeIp: false,
    fakeIpType: 1,
    ipv6AllZeros: false
  });
  assert.equal(steam.networking.utils.parseIpAddress("bad"), null);
  assert.equal(steam.networking.utils.ipAddressToString({ ipv4: 2130706433, port: 27015 }, true), "127.0.0.1:27015");
  assert.equal(steam.networking.utils.getIpAddressFakeIpType({ text: "127.0.0.1:27015" }), 1);
  assert.deepEqual(steam.networking.utils.getRealIdentityForFakeIp({ text: "10.0.0.1:27015" }), {
    result: 1,
    identity: {
      identityType: 16,
      text: "steamid:76561198000000010",
      steamId64: 76561198000000010n,
      genericString: null,
      localHost: false,
      invalid: false,
      fakeIpType: 0
    }
  });
  assert.equal(
    steam.networking.utils.setGlobalConfigValueInt32(steam.networking.utils.ConfigValue.TimeoutInitial, 5000),
    true
  );
  assert.equal(
    steam.networking.utils.setConnectionConfigValueInt64(
      77,
      steam.networking.utils.ConfigValue.ConnectionUserData,
      9223372036854775807n
    ),
    true
  );
  assert.equal(
    steam.networking.utils.setConfigValueFloat(
      steam.networking.utils.ConfigValue.FakePacketLossSend,
      steam.networking.utils.ConfigScope.Global,
      0,
      12.5
    ),
    true
  );
  assert.equal(
    steam.networking.utils.setConfigValueString(
      steam.networking.utils.ConfigValue.SDRClientForceRelayCluster,
      steam.networking.utils.ConfigScope.Global,
      0,
      "iad"
    ),
    true
  );
  assert.deepEqual(
    steam.networking.utils.getConfigValue(steam.networking.utils.ConfigValue.TimeoutInitial),
    {
      result: 1,
      dataType: 1,
      value: 5000,
      int32Value: 5000,
      int64Value: null,
      floatValue: null,
      stringValue: null
    }
  );
  assert.equal(
    steam.networking.utils.getConfigValue(
      steam.networking.utils.ConfigValue.ConnectionUserData,
      steam.networking.utils.ConfigScope.Connection,
      77
    ).value,
    9223372036854775807n
  );
  assert.equal(
    steam.networking.utils.getConfigValue(steam.networking.utils.ConfigValue.SDRClientForceRelayCluster).value,
    "iad"
  );
  assert.deepEqual(steam.networking.utils.getConfigValueInfo(steam.networking.utils.ConfigValue.TimeoutInitial), {
    value: 24,
    name: "TimeoutInitial",
    dataType: 1,
    scope: 4
  });
  assert.equal(steam.networking.utils.iterateGenericEditableConfigValues(), 24);
  assert.deepEqual(steam.networking.utils.listGenericEditableConfigValues(), [24, 29]);

  let debugEvent;
  const debugHandle = steam.networking.utils.registerDebugOutputHook(
    steam.networking.utils.DebugOutputType.Warning,
    (event) => {
      debugEvent = event;
    }
  );
  fake.networkingDebugOutputHandler({ detail_level: 4, message: "network warning" });
  assert.deepEqual(debugEvent, { detailLevel: 4, message: "network warning" });
  debugHandle.disconnect();

  let authEvent;
  steam.callback.register(steam.SteamCallback.SteamNetAuthenticationStatus, (event) => {
    authEvent = event;
  });
  fake.callbacks.get(steam.SteamCallback.SteamNetAuthenticationStatus)({
    availability: 100,
    debug_message: "auth ready"
  });
  assert.equal(authEvent.debugMessage, "auth ready");

  let relayEvent;
  steam.callback.register(steam.SteamCallback.SteamRelayNetworkStatus, (event) => {
    relayEvent = event;
  });
  fake.callbacks.get(steam.SteamCallback.SteamRelayNetworkStatus)({
    availability: 100,
    ping_measurement_in_progress: true,
    network_config_availability: 100,
    any_relay_availability: 100,
    debug_message: "measurement pending"
  });
  assert.equal(relayEvent.pingMeasurementInProgress, true);
  assert.equal(relayEvent.networkConfigAvailability, 100);
  assert.equal(relayEvent.anyRelayAvailability, 100);
  assert.equal(relayEvent.debugMessage, "measurement pending");

  assert.deepEqual(fake.calls.find((call) => call.method === "networkingUtilsIpAddressToString"), {
    method: "networkingUtilsIpAddressToString",
    args: [{ ipv4: 2130706433, port: 27015 }, true]
  });
  assert.deepEqual(fake.calls.find((call) => call.method === "networkingUtilsSetConfigValueInt64"), {
    method: "networkingUtilsSetConfigValueInt64",
    args: [40, 4, 77, 9223372036854775807n]
  });
  assert.deepEqual(fake.calls.find((call) => call.method === "networkingUtilsRegisterDebugOutputHook"), {
    method: "networkingUtilsRegisterDebugOutputHook",
    args: [4]
  });
  assert.equal(fake.calls.some((call) => call.method === "disconnectNetworkingDebugOutputHook"), true);
});

test("http facade covers request lifecycle, response reads, and callbacks", async (t) => {
  const fake = createFakeNative({
    httpCreateRequest(method, url) {
      this.calls.push({ method: "httpCreateRequest", args: [method, url] });
      return 100;
    },
    httpSetContextValue(request, contextValue) {
      this.calls.push({ method: "httpSetContextValue", args: [request, contextValue] });
      return true;
    },
    httpSetNetworkActivityTimeout(request, timeoutSeconds) {
      this.calls.push({ method: "httpSetNetworkActivityTimeout", args: [request, timeoutSeconds] });
      return true;
    },
    httpSetHeaderValue(request, name, value) {
      this.calls.push({ method: "httpSetHeaderValue", args: [request, name, value] });
      return true;
    },
    httpSetGetOrPostParameter(request, name, value) {
      this.calls.push({ method: "httpSetGetOrPostParameter", args: [request, name, value] });
      return true;
    },
    httpSendRequest(request, timeoutSeconds) {
      this.calls.push({ method: "httpSendRequest", args: [request, timeoutSeconds] });
      return Promise.resolve({
        request,
        context_value: "99",
        request_successful: true,
        status_code: 200,
        body_size: 2
      });
    },
    httpSendRequestAndStreamResponse(request, timeoutSeconds) {
      this.calls.push({ method: "httpSendRequestAndStreamResponse", args: [request, timeoutSeconds] });
      return Promise.resolve({ request, contextValue: 99n });
    },
    httpDeferRequest(request) {
      this.calls.push({ method: "httpDeferRequest", args: [request] });
      return true;
    },
    httpPrioritizeRequest(request) {
      this.calls.push({ method: "httpPrioritizeRequest", args: [request] });
      return true;
    },
    httpGetResponseHeaderSize(request, name) {
      this.calls.push({ method: "httpGetResponseHeaderSize", args: [request, name] });
      return name === "missing" ? null : 16;
    },
    httpGetResponseHeaderValue(request, name) {
      this.calls.push({ method: "httpGetResponseHeaderValue", args: [request, name] });
      return name === "missing" ? undefined : "application/json";
    },
    httpGetResponseBodySize(request) {
      this.calls.push({ method: "httpGetResponseBodySize", args: [request] });
      return 2;
    },
    httpGetResponseBodyData(request) {
      this.calls.push({ method: "httpGetResponseBodyData", args: [request] });
      return Buffer.from("ok");
    },
    httpGetStreamingResponseBodyData(request, offset, size) {
      this.calls.push({ method: "httpGetStreamingResponseBodyData", args: [request, offset, size] });
      return Buffer.from("chunk");
    },
    httpReleaseRequest(request) {
      this.calls.push({ method: "httpReleaseRequest", args: [request] });
      return true;
    },
    httpGetDownloadProgressPercent(request) {
      this.calls.push({ method: "httpGetDownloadProgressPercent", args: [request] });
      return 0.5;
    },
    httpSetRawPostBody(request, contentType, body) {
      this.calls.push({ method: "httpSetRawPostBody", args: [request, contentType, body] });
      return Buffer.isBuffer(body);
    },
    httpCreateCookieContainer(allowResponsesToModify) {
      this.calls.push({ method: "httpCreateCookieContainer", args: [allowResponsesToModify] });
      return 77;
    },
    httpReleaseCookieContainer(container) {
      this.calls.push({ method: "httpReleaseCookieContainer", args: [container] });
      return true;
    },
    httpSetCookie(container, host, url, cookie) {
      this.calls.push({ method: "httpSetCookie", args: [container, host, url, cookie] });
      return true;
    },
    httpSetRequestCookieContainer(request, container) {
      this.calls.push({ method: "httpSetRequestCookieContainer", args: [request, container] });
      return true;
    },
    httpSetUserAgentInfo(request, userAgent) {
      this.calls.push({ method: "httpSetUserAgentInfo", args: [request, userAgent] });
      return true;
    },
    httpSetRequiresVerifiedCertificate(request, requireVerifiedCertificate) {
      this.calls.push({ method: "httpSetRequiresVerifiedCertificate", args: [request, requireVerifiedCertificate] });
      return true;
    },
    httpSetAbsoluteTimeoutMs(request, timeoutMs) {
      this.calls.push({ method: "httpSetAbsoluteTimeoutMs", args: [request, timeoutMs] });
      return true;
    },
    httpGetRequestWasTimedOut(request) {
      this.calls.push({ method: "httpGetRequestWasTimedOut", args: [request] });
      return false;
    }
  });
  const steam = loadSteamWithFakeNative(fake);

  t.after(clearSteamBridgeCache);

  const request = steam.http.createRequest(steam.http.HttpMethod.Post, "https://example.invalid/api");
  assert.equal(request, 100);
  assert.equal(steam.http.setContextValue(request, 99n), true);
  assert.equal(steam.http.setNetworkActivityTimeout(request, 15), true);
  assert.equal(steam.http.setHeaderValue(request, "Accept", "application/json"), true);
  assert.equal(steam.http.setGetOrPostParameter(request, "query", "value"), true);
  assert.deepEqual(await steam.http.sendRequest(request, 3), {
    request: 100,
    contextValue: 99n,
    requestSuccessful: true,
    statusCode: 200,
    bodySize: 2
  });
  assert.deepEqual(await steam.http.sendRequestAndStreamResponse(request), {
    request: 100,
    contextValue: 99n
  });
  assert.equal(steam.http.deferRequest(request), true);
  assert.equal(steam.http.prioritizeRequest(request), true);
  assert.equal(steam.http.getResponseHeaderSize(request, "Content-Type"), 16);
  assert.equal(steam.http.getResponseHeaderSize(request, "missing"), null);
  assert.equal(steam.http.getResponseHeaderValue(request, "Content-Type"), "application/json");
  assert.equal(steam.http.getResponseHeaderValue(request, "missing"), null);
  assert.equal(steam.http.getResponseBodySize(request), 2);
  assert.equal(steam.http.getResponseBodyData(request).toString(), "ok");
  assert.equal(steam.http.getStreamingResponseBodyData(request, 0, 5).toString(), "chunk");
  assert.equal(steam.http.getDownloadProgressPercent(request), 0.5);
  assert.equal(steam.http.setRawPostBody(request, "application/json", new Uint8Array([123, 125])), true);
  assert.equal(steam.http.releaseRequest(request), true);

  const container = steam.http.createCookieContainer(true);
  assert.equal(container, 77);
  assert.equal(steam.http.setCookie(container, "example.invalid", "/", "session=test"), true);
  assert.equal(steam.http.setRequestCookieContainer(request, container), true);
  assert.equal(steam.http.setUserAgentInfo(request, "steam-bridge-test"), true);
  assert.equal(steam.http.setRequiresVerifiedCertificate(request, true), true);
  assert.equal(steam.http.setAbsoluteTimeoutMs(request, 2000), true);
  assert.equal(steam.http.getRequestWasTimedOut(request), false);
  assert.equal(steam.http.releaseCookieContainer(container), true);

  steam.callback.register(steam.SteamCallback.HTTPRequestDataReceived, () => {});
  assert.equal(fake.callbacks.has(steam.SteamCallback.HTTPRequestDataReceived), true);
  assert.deepEqual(fake.calls.find((call) => call.method === "httpCreateRequest"), {
    method: "httpCreateRequest",
    args: [steam.http.HttpMethod.Post, "https://example.invalid/api"]
  });
});

test("parties facade covers party beacon lifecycle and callbacks", async (t) => {
  const owner = { steamId64: "76561198000000009", steamId32: "STEAM_0:1:19867140", accountId: 39734281 };
  const fake = createFakeNative({
    partiesGetNumActiveBeacons() {
      this.calls.push({ method: "partiesGetNumActiveBeacons", args: [] });
      return 2;
    },
    partiesGetBeaconByIndex(index) {
      this.calls.push({ method: "partiesGetBeaconByIndex", args: [index] });
      return index === 0 ? "700" : null;
    },
    partiesGetActiveBeacons() {
      this.calls.push({ method: "partiesGetActiveBeacons", args: [] });
      return ["700", 701n];
    },
    partiesGetBeaconDetails(beacon) {
      this.calls.push({ method: "partiesGetBeaconDetails", args: [beacon] });
      return {
        beacon,
        owner,
        location: { location_type: 1, location_id: "900" },
        metadata: "mode=coop"
      };
    },
    partiesJoinParty(beacon, timeoutSeconds) {
      this.calls.push({ method: "partiesJoinParty", args: [beacon, timeoutSeconds] });
      return Promise.resolve({ result: 1, beacon, owner, connect_string: "connect 127.0.0.1" });
    },
    partiesGetNumAvailableBeaconLocations() {
      this.calls.push({ method: "partiesGetNumAvailableBeaconLocations", args: [] });
      return 1;
    },
    partiesGetAvailableBeaconLocations(maxLocations) {
      this.calls.push({ method: "partiesGetAvailableBeaconLocations", args: [maxLocations] });
      return [{ locationType: 1, locationId: "900" }];
    },
    partiesCreateBeacon(openSlots, location, connectString, metadata, timeoutSeconds) {
      this.calls.push({ method: "partiesCreateBeacon", args: [openSlots, location, connectString, metadata, timeoutSeconds] });
      return Promise.resolve({ result: 1, beacon: "702" });
    },
    partiesOnReservationCompleted(beacon, steamId64) {
      this.calls.push({ method: "partiesOnReservationCompleted", args: [beacon, steamId64] });
    },
    partiesCancelReservation(beacon, steamId64) {
      this.calls.push({ method: "partiesCancelReservation", args: [beacon, steamId64] });
    },
    partiesChangeNumOpenSlots(beacon, openSlots, timeoutSeconds) {
      this.calls.push({ method: "partiesChangeNumOpenSlots", args: [beacon, openSlots, timeoutSeconds] });
      return Promise.resolve({ result: 1 });
    },
    partiesDestroyBeacon(beacon) {
      this.calls.push({ method: "partiesDestroyBeacon", args: [beacon] });
      return true;
    },
    partiesGetBeaconLocationData(location, data) {
      this.calls.push({ method: "partiesGetBeaconLocationData", args: [location, data] });
      return data === 1 ? "Chat Group" : null;
    }
  });
  const steam = loadSteamWithFakeNative(fake);

  t.after(clearSteamBridgeCache);

  assert.equal(steam.parties.getNumActiveBeacons(), 2);
  assert.equal(steam.parties.getBeaconByIndex(0), 700n);
  assert.equal(steam.parties.getBeaconByIndex(1), null);
  assert.deepEqual(steam.parties.getActiveBeacons(), [700n, 701n]);
  assert.deepEqual(steam.parties.getBeaconDetails(700n), {
    beacon: 700n,
    owner: {
      steamId64: 76561198000000009n,
      steamId32: "STEAM_0:1:19867140",
      accountId: 39734281
    },
    location: {
      locationType: steam.parties.PartyBeaconLocationType.ChatGroup,
      locationId: 900n
    },
    metadata: "mode=coop"
  });
  assert.deepEqual(await steam.parties.joinParty(700n, 3), {
    result: 1,
    beacon: 700n,
    owner: {
      steamId64: 76561198000000009n,
      steamId32: "STEAM_0:1:19867140",
      accountId: 39734281
    },
    connectString: "connect 127.0.0.1"
  });
  assert.equal(steam.parties.getNumAvailableBeaconLocations(), 1);
  assert.deepEqual(steam.parties.getAvailableBeaconLocations(4), [
    {
      locationType: steam.parties.PartyBeaconLocationType.ChatGroup,
      locationId: 900n
    }
  ]);
  assert.deepEqual(
    await steam.parties.createBeacon(
      3,
      { locationType: steam.parties.PartyBeaconLocationType.ChatGroup, locationId: 900n },
      "connect 127.0.0.1",
      "mode=coop",
      5
    ),
    { result: 1, beacon: 702n }
  );
  steam.parties.onReservationCompleted(702n, 76561198000000009n);
  steam.parties.cancelReservation(702n, 76561198000000009n);
  assert.deepEqual(await steam.parties.changeNumOpenSlots(702n, 2, 6), { result: 1 });
  assert.equal(steam.parties.destroyBeacon(702n), true);
  assert.equal(
    steam.parties.getBeaconLocationData(
      { locationType: steam.parties.PartyBeaconLocationType.ChatGroup, locationId: 900n },
      steam.parties.PartyBeaconLocationData.Name
    ),
    "Chat Group"
  );
  assert.equal(
    steam.parties.getBeaconLocationData(
      { locationType: steam.parties.PartyBeaconLocationType.ChatGroup, locationId: 900n },
      steam.parties.PartyBeaconLocationData.IconURLSmall
    ),
    null
  );

  steam.callback.register(steam.SteamCallback.ReservationNotification, () => {});
  assert.equal(fake.callbacks.has(steam.SteamCallback.ReservationNotification), true);
  assert.deepEqual(fake.calls.find((call) => call.method === "partiesCreateBeacon"), {
    method: "partiesCreateBeacon",
    args: [
      3,
      { locationType: steam.parties.PartyBeaconLocationType.ChatGroup, locationId: 900n },
      "connect 127.0.0.1",
      "mode=coop",
      5
    ]
  });
});

test("inventory facade covers result, item, definition, price, and update flows", async (t) => {
  const player = { steamId64: "76561198000000008", steamId32: "STEAM_0:0:19867140", accountId: 39734280 };
  const fake = createFakeNative({
    inventoryGetResultStatus(resultHandle) {
      this.calls.push({ method: "inventoryGetResultStatus", args: [resultHandle] });
      return 1;
    },
    inventoryGetResultItems(resultHandle) {
      this.calls.push({ method: "inventoryGetResultItems", args: [resultHandle] });
      return [{ item_id: "1001", definition: 7, quantity: 2, flags: 1 }];
    },
    inventoryGetResultItemProperty(resultHandle, itemIndex, propertyName) {
      this.calls.push({ method: "inventoryGetResultItemProperty", args: [resultHandle, itemIndex, propertyName] });
      return propertyName === "name" ? "Tool" : null;
    },
    inventoryGetResultTimestamp(resultHandle) {
      this.calls.push({ method: "inventoryGetResultTimestamp", args: [resultHandle] });
      return 1700000000;
    },
    inventoryCheckResultSteamId(resultHandle, steamId64) {
      this.calls.push({ method: "inventoryCheckResultSteamId", args: [resultHandle, steamId64] });
      return true;
    },
    inventoryDestroyResult(resultHandle) {
      this.calls.push({ method: "inventoryDestroyResult", args: [resultHandle] });
    },
    inventoryGetAllItems() {
      this.calls.push({ method: "inventoryGetAllItems", args: [] });
      return 10;
    },
    inventoryGetItemsById(instanceIds) {
      this.calls.push({ method: "inventoryGetItemsById", args: [instanceIds] });
      return 11;
    },
    inventorySerializeResult(resultHandle) {
      this.calls.push({ method: "inventorySerializeResult", args: [resultHandle] });
      return Buffer.from("serialized");
    },
    inventoryDeserializeResult(data) {
      this.calls.push({ method: "inventoryDeserializeResult", args: [data] });
      return 12;
    },
    inventoryGenerateItems(items) {
      this.calls.push({ method: "inventoryGenerateItems", args: [items] });
      return 13;
    },
    inventoryGrantPromoItems() {
      this.calls.push({ method: "inventoryGrantPromoItems", args: [] });
      return 14;
    },
    inventoryAddPromoItem(definition) {
      this.calls.push({ method: "inventoryAddPromoItem", args: [definition] });
      return 15;
    },
    inventoryAddPromoItems(definitions) {
      this.calls.push({ method: "inventoryAddPromoItems", args: [definitions] });
      return 16;
    },
    inventoryConsumeItem(itemId, quantity) {
      this.calls.push({ method: "inventoryConsumeItem", args: [itemId, quantity] });
      return 17;
    },
    inventoryExchangeItems(generate, destroy) {
      this.calls.push({ method: "inventoryExchangeItems", args: [generate, destroy] });
      return 18;
    },
    inventoryTransferItemQuantity(sourceItemId, quantity, destinationItemId) {
      this.calls.push({ method: "inventoryTransferItemQuantity", args: [sourceItemId, quantity, destinationItemId] });
      return 19;
    },
    inventorySendItemDropHeartbeat() {
      this.calls.push({ method: "inventorySendItemDropHeartbeat", args: [] });
    },
    inventoryTriggerItemDrop(dropListDefinition) {
      this.calls.push({ method: "inventoryTriggerItemDrop", args: [dropListDefinition] });
      return 20;
    },
    inventoryTradeItems(tradePartnerSteamId64, give, get) {
      this.calls.push({ method: "inventoryTradeItems", args: [tradePartnerSteamId64, give, get] });
      return 21;
    },
    inventoryLoadItemDefinitions() {
      this.calls.push({ method: "inventoryLoadItemDefinitions", args: [] });
      return true;
    },
    inventoryGetItemDefinitionIds() {
      this.calls.push({ method: "inventoryGetItemDefinitionIds", args: [] });
      return [7, 8];
    },
    inventoryGetItemDefinitionProperty(definition, propertyName) {
      this.calls.push({ method: "inventoryGetItemDefinitionProperty", args: [definition, propertyName] });
      return propertyName === "name" ? "Tool" : "";
    },
    inventoryRequestEligiblePromoItemDefinitionIds(steamId64, timeoutSeconds) {
      this.calls.push({ method: "inventoryRequestEligiblePromoItemDefinitionIds", args: [steamId64, timeoutSeconds] });
      return Promise.resolve({
        result: 1,
        steam_id: player,
        num_eligible_promo_item_defs: 2,
        cached_data: true
      });
    },
    inventoryGetEligiblePromoItemDefinitionIds(steamId64) {
      this.calls.push({ method: "inventoryGetEligiblePromoItemDefinitionIds", args: [steamId64] });
      return [7, 8];
    },
    inventoryStartPurchase(items, timeoutSeconds) {
      this.calls.push({ method: "inventoryStartPurchase", args: [items, timeoutSeconds] });
      return Promise.resolve({ result: 1, order_id: "555", transaction_id: 666n });
    },
    inventoryRequestPrices(timeoutSeconds) {
      this.calls.push({ method: "inventoryRequestPrices", args: [timeoutSeconds] });
      return Promise.resolve({ result: 1, currency: "USD" });
    },
    inventoryGetNumItemsWithPrices() {
      this.calls.push({ method: "inventoryGetNumItemsWithPrices", args: [] });
      return 2;
    },
    inventoryGetItemsWithPrices(maxItems) {
      this.calls.push({ method: "inventoryGetItemsWithPrices", args: [maxItems] });
      return [{ definition: 7, current_price: "199", base_price: 299n }];
    },
    inventoryGetItemPrice(definition) {
      this.calls.push({ method: "inventoryGetItemPrice", args: [definition] });
      return definition === 7 ? { definition: 7, current_price: "199", base_price: 299n } : null;
    },
    inventoryStartUpdateProperties() {
      this.calls.push({ method: "inventoryStartUpdateProperties", args: [] });
      return "77";
    },
    inventoryRemoveProperty(updateHandle, itemId, propertyName) {
      this.calls.push({ method: "inventoryRemoveProperty", args: [updateHandle, itemId, propertyName] });
      return true;
    },
    inventorySetPropertyString(updateHandle, itemId, propertyName, value) {
      this.calls.push({ method: "inventorySetPropertyString", args: [updateHandle, itemId, propertyName, value] });
      return true;
    },
    inventorySetPropertyBool(updateHandle, itemId, propertyName, value) {
      this.calls.push({ method: "inventorySetPropertyBool", args: [updateHandle, itemId, propertyName, value] });
      return true;
    },
    inventorySetPropertyInt64(updateHandle, itemId, propertyName, value) {
      this.calls.push({ method: "inventorySetPropertyInt64", args: [updateHandle, itemId, propertyName, value] });
      return true;
    },
    inventorySetPropertyFloat(updateHandle, itemId, propertyName, value) {
      this.calls.push({ method: "inventorySetPropertyFloat", args: [updateHandle, itemId, propertyName, value] });
      return true;
    },
    inventorySubmitUpdateProperties(updateHandle) {
      this.calls.push({ method: "inventorySubmitUpdateProperties", args: [updateHandle] });
      return 22;
    },
    inventoryInspectItem(itemToken) {
      this.calls.push({ method: "inventoryInspectItem", args: [itemToken] });
      return 23;
    }
  });
  const steam = loadSteamWithFakeNative(fake);

  t.after(clearSteamBridgeCache);

  assert.equal(steam.inventory.InventoryItemFlags.NoTrade, 1);
  assert.equal(steam.inventory.getResultStatus(10), 1);
  assert.deepEqual(steam.inventory.getResultItems(10), [{ itemId: 1001n, definition: 7, quantity: 2, flags: 1 }]);
  assert.equal(steam.inventory.getResultItemProperty(10, 0, "name"), "Tool");
  assert.equal(steam.inventory.getResultItemProperty(10, 0), null);
  assert.equal(steam.inventory.getResultTimestamp(10), 1700000000);
  assert.equal(steam.inventory.checkResultSteamId(10, 76561198000000008n), true);
  steam.inventory.destroyResult(10);
  assert.equal(steam.inventory.getAllItems(), 10);
  assert.equal(steam.inventory.getItemsById([1001n]), 11);
  assert.equal(steam.inventory.serializeResult(10).toString(), "serialized");
  assert.equal(steam.inventory.deserializeResult(new Uint8Array([1, 2, 3])), 12);
  assert.equal(steam.inventory.generateItems([{ definition: 7, quantity: 2 }]), 13);
  assert.equal(steam.inventory.grantPromoItems(), 14);
  assert.equal(steam.inventory.addPromoItem(7), 15);
  assert.equal(steam.inventory.addPromoItems([7, 8]), 16);
  assert.equal(steam.inventory.consumeItem(1001n, 1), 17);
  assert.equal(
    steam.inventory.exchangeItems([{ definition: 7, quantity: 1 }], [{ itemId: 1001n, quantity: 1 }]),
    18
  );
  assert.equal(steam.inventory.transferItemQuantity(1001n, 1, 1002n), 19);
  steam.inventory.sendItemDropHeartbeat();
  assert.equal(steam.inventory.triggerItemDrop(9), 20);
  assert.equal(steam.inventory.tradeItems(76561198000000008n, [{ itemId: 1001n, quantity: 1 }], [{ itemId: 1002n, quantity: 1 }]), 21);
  assert.equal(steam.inventory.loadItemDefinitions(), true);
  assert.deepEqual(steam.inventory.getItemDefinitionIds(), [7, 8]);
  assert.equal(steam.inventory.getItemDefinitionProperty(7, "name"), "Tool");
  assert.equal(steam.inventory.getItemDefinitionProperty(7), "");
  assert.deepEqual(await steam.inventory.requestEligiblePromoItemDefinitionIds(76561198000000008n, 4), {
    result: 1,
    steamId: { steamId64: 76561198000000008n, steamId32: "STEAM_0:0:19867140", accountId: 39734280 },
    numEligiblePromoItemDefs: 2,
    cachedData: true
  });
  assert.deepEqual(steam.inventory.getEligiblePromoItemDefinitionIds(76561198000000008n), [7, 8]);
  assert.deepEqual(await steam.inventory.startPurchase([{ definition: 7, quantity: 1 }], 5), {
    result: 1,
    orderId: 555n,
    transactionId: 666n
  });
  assert.deepEqual(await steam.inventory.requestPrices(6), { result: 1, currency: "USD" });
  assert.equal(steam.inventory.getNumItemsWithPrices(), 2);
  assert.deepEqual(steam.inventory.getItemsWithPrices(10), [{ definition: 7, currentPrice: 199n, basePrice: 299n }]);
  assert.deepEqual(steam.inventory.getItemPrice(7), { definition: 7, currentPrice: 199n, basePrice: 299n });
  assert.equal(steam.inventory.getItemPrice(999), null);

  const updateHandle = steam.inventory.startUpdateProperties();
  assert.equal(updateHandle, 77n);
  assert.equal(steam.inventory.removeProperty(updateHandle, 1001n, "rarity"), true);
  assert.equal(steam.inventory.setPropertyString(updateHandle, 1001n, "name", "Tool"), true);
  assert.equal(steam.inventory.setPropertyBool(updateHandle, 1001n, "equipped", true), true);
  assert.equal(steam.inventory.setPropertyInt64(updateHandle, 1001n, "serial", 123n), true);
  assert.equal(steam.inventory.setPropertyFloat(updateHandle, 1001n, "wear", 0.5), true);
  assert.equal(steam.inventory.submitUpdateProperties(updateHandle), 22);
  assert.equal(steam.inventory.inspectItem("inspect-token"), 23);

  let purchaseEvent;
  steam.callback.register(steam.SteamCallback.SteamInventoryStartPurchaseResult, (event) => {
    purchaseEvent = event;
  });
  fake.callbacks.get(steam.SteamCallback.SteamInventoryStartPurchaseResult)({
    result: 1,
    order_id: "555",
    transaction_id: "666"
  });
  assert.equal(purchaseEvent.orderId, 555n);
  assert.equal(purchaseEvent.transactionId, 666n);

  let promoEvent;
  steam.callback.register(steam.SteamCallback.SteamInventoryEligiblePromoItemDefIds, (event) => {
    promoEvent = event;
  });
  fake.callbacks.get(steam.SteamCallback.SteamInventoryEligiblePromoItemDefIds)({
    result: 1,
    steam_id: "76561198000000008",
    num_eligible_promo_item_defs: 2,
    cached_data: true
  });
  assert.equal(promoEvent.steam_id, 76561198000000008n);
  assert.equal(promoEvent.steamId, 76561198000000008n);
  assert.equal(promoEvent.numEligiblePromoItemDefs, 2);
  assert.equal(promoEvent.cachedData, true);

  steam.callback.register(steam.SteamCallback.SteamInventoryResultReady, () => {});
  assert.equal(fake.callbacks.has(steam.SteamCallback.SteamInventoryResultReady), true);
  assert.deepEqual(fake.calls.find((call) => call.method === "inventoryStartPurchase"), {
    method: "inventoryStartPurchase",
    args: [[{ definition: 7, quantity: 1 }], 5]
  });
  assert.deepEqual(fake.calls.find((call) => call.method === "inventoryExchangeItems"), {
    method: "inventoryExchangeItems",
    args: [[{ definition: 7, quantity: 1 }], [{ itemId: 1001n, quantity: 1 }]]
  });
  assert.deepEqual(fake.calls.find((call) => call.method === "inventoryTradeItems"), {
    method: "inventoryTradeItems",
    args: [76561198000000008n, [{ itemId: 1001n, quantity: 1 }], [{ itemId: 1002n, quantity: 1 }]]
  });
  assert.deepEqual(fake.calls.find((call) => call.method === "inventorySubmitUpdateProperties"), {
    method: "inventorySubmitUpdateProperties",
    args: [77n]
  });
});

test("stats leaderboard facade normalizes handles, entries, and async results", async (t) => {
  const player = { steamId64: "76561198000000005", steamId32: "STEAM_0:1:19867138", accountId: 39734277 };
  const fake = createFakeNative({
    statsGetInt(name) {
      this.calls.push({ method: "statsGetInt", args: [name] });
      return name === "score" ? 7 : undefined;
    },
    statsSetInt(name, value) {
      this.calls.push({ method: "statsSetInt", args: [name, value] });
      return true;
    },
    statsStore() {
      this.calls.push({ method: "statsStore", args: [] });
      return true;
    },
    statsResetAll(achievementsToo) {
      this.calls.push({ method: "statsResetAll", args: [achievementsToo] });
      return false;
    },
    statsFindOrCreateLeaderboard(name, sortMethod, displayType) {
      this.calls.push({ method: "statsFindOrCreateLeaderboard", args: [name, sortMethod, displayType] });
      return Promise.resolve({ leaderboard: "44", found: true });
    },
    statsFindLeaderboard(name) {
      this.calls.push({ method: "statsFindLeaderboard", args: [name] });
      return Promise.resolve({ leaderboard: 45n, found: false });
    },
    statsGetLeaderboardName(leaderboard) {
      this.calls.push({ method: "statsGetLeaderboardName", args: [leaderboard] });
      return "Daily Score";
    },
    statsGetLeaderboardEntryCount(leaderboard) {
      this.calls.push({ method: "statsGetLeaderboardEntryCount", args: [leaderboard] });
      return 12;
    },
    statsGetLeaderboardSortMethod() {
      return 2;
    },
    statsGetLeaderboardDisplayType() {
      return 1;
    },
    statsDownloadLeaderboardEntries(leaderboard, request, rangeStart, rangeEnd, detailsMax) {
      this.calls.push({ method: "statsDownloadLeaderboardEntries", args: [leaderboard, request, rangeStart, rangeEnd, detailsMax] });
      return Promise.resolve({
        leaderboard,
        entries_handle: "9000",
        entry_count: 1,
        entries: [{ steam_id: player, global_rank: 2, score: 1234, details: [10, 20], ugc: "777" }]
      });
    },
    statsDownloadLeaderboardEntriesForUsers(leaderboard, steamIds64, detailsMax) {
      this.calls.push({ method: "statsDownloadLeaderboardEntriesForUsers", args: [leaderboard, steamIds64, detailsMax] });
      return Promise.resolve({
        leaderboard,
        entriesHandle: 9001n,
        entryCount: 1,
        entries: [{ steamId: player, globalRank: 3, score: 1200, details: [30], ugc: 778n }]
      });
    },
    statsGetDownloadedLeaderboardEntry(entriesHandle, index, detailsMax) {
      this.calls.push({ method: "statsGetDownloadedLeaderboardEntry", args: [entriesHandle, index, detailsMax] });
      return { steam_id: player, global_rank: 4, score: 1100, details: [40, 50], ugc: "779" };
    },
    statsUploadLeaderboardScore(leaderboard, method, score, scoreDetails) {
      this.calls.push({ method: "statsUploadLeaderboardScore", args: [leaderboard, method, score, scoreDetails] });
      return Promise.resolve({
        success: true,
        leaderboard,
        score,
        score_changed: true,
        global_rank_new: 5,
        global_rank_previous: 9
      });
    },
    statsAttachLeaderboardUgc(leaderboard, ugcHandle) {
      this.calls.push({ method: "statsAttachLeaderboardUgc", args: [leaderboard, ugcHandle] });
      return Promise.resolve({ result: 1, leaderboard });
    }
  });
  const steam = loadSteamWithFakeNative(fake);

  t.after(clearSteamBridgeCache);

  assert.equal(steam.stats.getInt("score"), 7);
  assert.equal(steam.stats.getInt("missing"), null);
  assert.equal(steam.stats.setInt("score", 8), true);
  assert.equal(steam.stats.store(), true);
  assert.equal(steam.stats.resetAll(true), false);

  assert.deepEqual(
    await steam.stats.findOrCreateLeaderboard(
      "Daily Score",
      steam.stats.LeaderboardSortMethod.Descending,
      steam.stats.LeaderboardDisplayType.Numeric
    ),
    { leaderboard: 44n, found: true }
  );
  assert.deepEqual(await steam.stats.findLeaderboard("Weekly Score"), { leaderboard: 45n, found: false });
  assert.equal(steam.stats.getLeaderboardName(44n), "Daily Score");
  assert.equal(steam.stats.getLeaderboardEntryCount(44n), 12);
  assert.equal(steam.stats.getLeaderboardSortMethod(44n), steam.LeaderboardSortMethod.Descending);
  assert.equal(steam.stats.getLeaderboardDisplayType(44n), steam.LeaderboardDisplayType.Numeric);

  const globalEntries = await steam.stats.downloadLeaderboardEntries(
    44n,
    steam.stats.LeaderboardDataRequest.Global,
    1,
    10,
    2
  );
  assert.equal(globalEntries.entriesHandle, 9000n);
  assert.equal(globalEntries.entryCount, 1);
  assert.deepEqual(globalEntries.entries[0], {
    steamId: { steamId64: 76561198000000005n, steamId32: "STEAM_0:1:19867138", accountId: 39734277 },
    globalRank: 2,
    score: 1234,
    details: [10, 20],
    ugc: 777n
  });

  const userEntries = await steam.stats.downloadLeaderboardEntriesForUsers(44n, [76561198000000005n], 1);
  assert.equal(userEntries.entriesHandle, 9001n);
  assert.equal(userEntries.entries[0].globalRank, 3);
  assert.deepEqual(steam.stats.getDownloadedLeaderboardEntry(9000n, 0, 2), {
    steamId: { steamId64: 76561198000000005n, steamId32: "STEAM_0:1:19867138", accountId: 39734277 },
    globalRank: 4,
    score: 1100,
    details: [40, 50],
    ugc: 779n
  });
  assert.deepEqual(await steam.stats.uploadLeaderboardScore(44n, steam.stats.LeaderboardUploadScoreMethod.KeepBest, 1234, [1, 2]), {
    success: true,
    leaderboard: 44n,
    score: 1234,
    scoreChanged: true,
    globalRankNew: 5,
    globalRankPrevious: 9
  });
  assert.deepEqual(await steam.stats.attachLeaderboardUgc(44n, 777n), { result: 1, leaderboard: 44n });
});

test("stats and achievement facades cover user and global Steam stats", async (t) => {
  const player = { steamId64: "76561198000000006", steamId32: "STEAM_0:0:19867139", accountId: 39734278 };
  const fake = createFakeNative({
    achievementGetAndUnlockTime(name) {
      this.calls.push({ method: "achievementGetAndUnlockTime", args: [name] });
      return { achieved: true, unlock_time: 1700000000 };
    },
    achievementGetIcon(name) {
      this.calls.push({ method: "achievementGetIcon", args: [name] });
      return 321;
    },
    achievementGetDisplayAttribute(name, key) {
      this.calls.push({ method: "achievementGetDisplayAttribute", args: [name, key] });
      return `${name}:${key}`;
    },
    achievementIndicateProgress(name, current, max) {
      this.calls.push({ method: "achievementIndicateProgress", args: [name, current, max] });
      return true;
    },
    achievementGetProgressLimitsInt(name) {
      this.calls.push({ method: "achievementGetProgressLimitsInt", args: [name] });
      return { min: 0, max: 100 };
    },
    achievementGetProgressLimitsFloat(name) {
      this.calls.push({ method: "achievementGetProgressLimitsFloat", args: [name] });
      return { min: 0.5, max: 9.5 };
    },
    statsGetFloat(name) {
      this.calls.push({ method: "statsGetFloat", args: [name] });
      return name === "ratio" ? 1.5 : undefined;
    },
    statsSetFloat(name, value) {
      this.calls.push({ method: "statsSetFloat", args: [name, value] });
      return true;
    },
    statsUpdateAvgRate(name, countThisSession, sessionLength) {
      this.calls.push({ method: "statsUpdateAvgRate", args: [name, countThisSession, sessionLength] });
      return true;
    },
    statsRequestUserStats(steamId64) {
      this.calls.push({ method: "statsRequestUserStats", args: [steamId64] });
      return Promise.resolve({ game_id: "480", result: 1, steam_id: player });
    },
    statsGetUserInt(steamId64, name) {
      this.calls.push({ method: "statsGetUserInt", args: [steamId64, name] });
      return 42;
    },
    statsGetUserFloat(steamId64, name) {
      this.calls.push({ method: "statsGetUserFloat", args: [steamId64, name] });
      return 2.5;
    },
    statsGetUserAchievement(steamId64, name) {
      this.calls.push({ method: "statsGetUserAchievement", args: [steamId64, name] });
      return name === "ACH_WIN";
    },
    statsGetUserAchievementAndUnlockTime(steamId64, name) {
      this.calls.push({ method: "statsGetUserAchievementAndUnlockTime", args: [steamId64, name] });
      return { achieved: false, unlockTime: 0 };
    },
    statsGetNumberOfCurrentPlayers() {
      return Promise.resolve({ success: true, players: 123 });
    },
    statsRequestGlobalAchievementPercentages() {
      return Promise.resolve({ game_id: "480", result: 1 });
    },
    statsGetMostAchievedAchievementInfo() {
      return { iterator: 7, name: "ACH_START", percent: 99.5, achieved: true };
    },
    statsGetNextMostAchievedAchievementInfo(previousIterator) {
      this.calls.push({ method: "statsGetNextMostAchievedAchievementInfo", args: [previousIterator] });
      return null;
    },
    statsGetAchievementAchievedPercent(name) {
      this.calls.push({ method: "statsGetAchievementAchievedPercent", args: [name] });
      return 12.5;
    },
    statsRequestGlobalStats(historyDays) {
      this.calls.push({ method: "statsRequestGlobalStats", args: [historyDays] });
      return Promise.resolve({ gameId: 480n, result: 1 });
    },
    statsGetGlobalStatInt(name) {
      this.calls.push({ method: "statsGetGlobalStatInt", args: [name] });
      return "1234567890123";
    },
    statsGetGlobalStatDouble(name) {
      this.calls.push({ method: "statsGetGlobalStatDouble", args: [name] });
      return 123.75;
    },
    statsGetGlobalStatHistoryInt(name, maxEntries) {
      this.calls.push({ method: "statsGetGlobalStatHistoryInt", args: [name, maxEntries] });
      return ["10", 20n, 30];
    },
    statsGetGlobalStatHistoryDouble(name, maxEntries) {
      this.calls.push({ method: "statsGetGlobalStatHistoryDouble", args: [name, maxEntries] });
      return [1.25, 2.5];
    }
  });
  const steam = loadSteamWithFakeNative(fake);

  t.after(clearSteamBridgeCache);

  assert.deepEqual(steam.achievement.getAndUnlockTime("ACH_WIN"), { achieved: true, unlockTime: 1700000000 });
  assert.equal(steam.achievement.getIcon("ACH_WIN"), 321);
  assert.equal(steam.achievement.getDisplayAttribute("ACH_WIN", "name"), "ACH_WIN:name");
  assert.equal(steam.achievement.indicateProgress("ACH_WIN", 5, 10), true);
  assert.deepEqual(steam.achievement.getProgressLimitsInt("ACH_WIN"), { min: 0, max: 100 });
  assert.deepEqual(steam.achievement.getProgressLimitsFloat("ACH_WIN"), { min: 0.5, max: 9.5 });

  assert.equal(steam.stats.getFloat("ratio"), 1.5);
  assert.equal(steam.stats.getFloat("missing"), null);
  assert.equal(steam.stats.setFloat("ratio", 2.5), true);
  assert.equal(steam.stats.updateAvgRate("distance", 50, 10), true);
  assert.deepEqual(await steam.stats.requestUserStats(76561198000000006n), {
    gameId: 480n,
    result: 1,
    steamId: { steamId64: 76561198000000006n, steamId32: "STEAM_0:0:19867139", accountId: 39734278 }
  });
  assert.equal(steam.stats.getUserInt(76561198000000006n, "score"), 42);
  assert.equal(steam.stats.getUserFloat(76561198000000006n, "ratio"), 2.5);
  assert.equal(steam.stats.getUserAchievement(76561198000000006n, "ACH_WIN"), true);
  assert.deepEqual(steam.stats.getUserAchievementAndUnlockTime(76561198000000006n, "ACH_WIN"), {
    achieved: false,
    unlockTime: 0
  });
  assert.deepEqual(await steam.stats.getNumberOfCurrentPlayers(), { success: true, players: 123 });
  assert.deepEqual(await steam.stats.requestGlobalAchievementPercentages(), { gameId: 480n, result: 1 });
  assert.deepEqual(steam.stats.getMostAchievedAchievementInfo(), {
    iterator: 7,
    name: "ACH_START",
    percent: 99.5,
    achieved: true
  });
  assert.equal(steam.stats.getNextMostAchievedAchievementInfo(7), null);
  assert.equal(steam.stats.getAchievementAchievedPercent("ACH_WIN"), 12.5);
  assert.deepEqual(await steam.stats.requestGlobalStats(60), { gameId: 480n, result: 1 });
  assert.equal(steam.stats.getGlobalStatInt("total_score"), 1234567890123n);
  assert.equal(steam.stats.getGlobalStatDouble("total_ratio"), 123.75);
  assert.deepEqual(steam.stats.getGlobalStatHistoryInt("daily_score", 3), [10n, 20n, 30n]);
  assert.deepEqual(steam.stats.getGlobalStatHistoryDouble("daily_ratio", 2), [1.25, 2.5]);
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
    friendsGetFriendMessage(steamId64, messageId, maxBytes) {
      this.calls.push({ method: "friendsGetFriendMessage", args: [steamId64, messageId, maxBytes] });
      return { data: Buffer.from("hello"), size: 5, text: "hello", entry_type: 1 };
    },
    friendsGetFollowerCount() {
      return Promise.resolve({ steam_id: friend, result: 1, count: 12 });
    },
    friendsIsFollowing() {
      return Promise.resolve({ steam_id: friend, result: 1, is_following: true });
    },
    friendsEnumerateFollowingList() {
      return Promise.resolve({ result: 1, steam_ids: [friend], returned_results: 1, total_results: 2 });
    },
    friendsActivateGameOverlayRemotePlayTogetherInviteDialog(lobbyId64) {
      this.calls.push({ method: "friendsActivateGameOverlayRemotePlayTogetherInviteDialog", args: [lobbyId64] });
    },
    friendsActivateGameOverlayInviteDialogConnectString(connectString) {
      this.calls.push({ method: "friendsActivateGameOverlayInviteDialogConnectString", args: [connectString] });
    },
    friendsRequestEquippedProfileItems() {
      return Promise.resolve({
        result: 1,
        steam_id: friend,
        has_animated_avatar: true,
        has_avatar_frame: true,
        has_profile_modifier: false,
        has_profile_background: true,
        has_mini_profile_background: false,
        from_cache: true
      });
    },
    friendsHasEquippedProfileItem(steamId64, itemType) {
      this.calls.push({ method: "friendsHasEquippedProfileItem", args: [steamId64, itemType] });
      return true;
    },
    friendsGetProfileItemPropertyString(steamId64, itemType, property) {
      this.calls.push({ method: "friendsGetProfileItemPropertyString", args: [steamId64, itemType, property] });
      return "profile-item-title";
    },
    friendsGetProfileItemPropertyUint(steamId64, itemType, property) {
      this.calls.push({ method: "friendsGetProfileItemPropertyUint", args: [steamId64, itemType, property] });
      return property === 5 ? 480 : 42;
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
  assert.equal(steam.friends.ChatEntryType.ChatMsg, 1);
  assert.deepEqual(steam.friends.getFriendMessage(76561198000000003n, 77, 256), {
    data: Buffer.from("hello"),
    size: 5,
    text: "hello",
    entryType: steam.friends.ChatEntryType.ChatMsg
  });
  assert.equal((await steam.friends.getFollowerCount(76561198000000003n)).count, 12);
  assert.equal((await steam.friends.isFollowing(76561198000000003n)).isFollowing, true);
  assert.deepEqual(await steam.friends.enumerateFollowingList(), {
    result: 1,
    steamIds: [{ steamId64: 76561198000000003n, steamId32: "STEAM_0:1:19867137", accountId: 39734275 }],
    returnedResults: 1,
    totalResults: 2
  });
  steam.friends.activateGameOverlayRemotePlayTogetherInviteDialog(109775242022617907n);
  steam.friends.activateGameOverlayInviteDialogConnectString("+connect_lobby 109775242022617907");
  assert.deepEqual(await steam.friends.requestEquippedProfileItems(76561198000000003n), {
    result: 1,
    steamId: { steamId64: 76561198000000003n, steamId32: "STEAM_0:1:19867137", accountId: 39734275 },
    hasAnimatedAvatar: true,
    hasAvatarFrame: true,
    hasProfileModifier: false,
    hasProfileBackground: true,
    hasMiniProfileBackground: false,
    fromCache: true
  });
  assert.equal(
    steam.friends.hasEquippedProfileItem(
      76561198000000003n,
      steam.friends.CommunityProfileItemType.AvatarFrame
    ),
    true
  );
  assert.equal(
    steam.friends.getProfileItemPropertyString(
      76561198000000003n,
      steam.friends.CommunityProfileItemType.AvatarFrame,
      steam.friends.CommunityProfileItemProperty.Title
    ),
    "profile-item-title"
  );
  assert.equal(
    steam.friends.getProfileItemPropertyUint(
      76561198000000003n,
      steam.friends.CommunityProfileItemType.AvatarFrame,
      steam.friends.CommunityProfileItemProperty.AppId
    ),
    480
  );

  let equippedChangedEvent;
  steam.callback.register(steam.SteamCallback.EquippedProfileItemsChanged, (event) => {
    equippedChangedEvent = event;
  });
  fake.callbacks.get(steam.SteamCallback.EquippedProfileItemsChanged)({ steam_id: "76561198000000003" });
  assert.equal(equippedChangedEvent.steamId, 76561198000000003n);
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
