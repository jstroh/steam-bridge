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
  assert.equal(client.http, steam.http);
  assert.equal(client.inventory, steam.inventory);
  assert.equal(client.parties, steam.parties);
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

test("utils facade covers activity, images, VR, filtering, and text input helpers", (t) => {
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
  assert.deepEqual(
    fake.calls.filter((call) =>
      [
        "utilsSetOverlayNotificationPosition",
        "utilsSetOverlayNotificationInset",
        "utilsFilterText",
        "utilsSetGameLauncherMode"
      ].includes(call.method)
    ),
    [
      { method: "utilsSetOverlayNotificationPosition", args: [3] },
      { method: "utilsSetOverlayNotificationInset", args: [16, 24] },
      { method: "utilsFilterText", args: [2, 76561198000000000n, "hello", 256] },
      { method: "utilsSetGameLauncherMode", args: [true] }
    ]
  );
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

test("apps facade covers DLC, launch, depot, trial, and beta helpers", (t) => {
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
  assert.deepEqual(
    fake.calls.filter((call) =>
      [
        "appsInstalledDepots",
        "appsMarkContentCorrupt",
        "appsLaunchCommandLine",
        "appsSetActiveBeta"
      ].includes(call.method)
    ),
    [
      { method: "appsMarkContentCorrupt", args: [true] },
      { method: "appsInstalledDepots", args: [480, 4] },
      { method: "appsLaunchCommandLine", args: [512] },
      { method: "appsSetActiveBeta", args: ["public"] }
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

test("networking utils facade covers relay, ping, fake IP, address, and callback flows", (t) => {
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
    }
  });
  const steam = loadSteamWithFakeNative(fake);

  t.after(clearSteamBridgeCache);

  assert.equal(steam.SteamCallback.SteamNetAuthenticationStatus, 1222);
  assert.equal(steam.SteamCallback.SteamRelayNetworkStatus, 1281);
  assert.equal(steam.networking.NetworkingAvailability.Current, 100);
  assert.equal(steam.networking.utils.Availability.Failed, -101);
  assert.equal(steam.networking.utils.FakeIpType.GlobalIPv4, 2);

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
