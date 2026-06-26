const fs = require("node:fs");
const path = require("node:path");
const { app, BrowserWindow, ipcMain } = require("electron");
const steamworks = require("steam-bridge");

const APP_ID = Number(process.env.STEAM_BRIDGE_APP_ID || "480");
const AUTH_IDENTITY = process.env.STEAM_BRIDGE_AUTH_IDENTITY || "steam-bridge-electron-smoke";
const OVERLAY_PROFILE = process.env.STEAM_BRIDGE_ELECTRON_OVERLAY_PROFILE || "compatibility";
const STORE_URL = `https://store.steampowered.com/app/${APP_ID}/`;

steamworks.electronConfigureSteamOverlay({ profile: OVERLAY_PROFILE });
writeSteamAppIdFiles(APP_ID);

let client;
let initError;
let inputInitialized = false;
const callbackHandles = [];
const eventLog = [];

function createWindow() {
  const window = new BrowserWindow({
    width: 1060,
    height: 760,
    minWidth: 860,
    minHeight: 640,
    title: "Steam Bridge Electron Smoke",
    backgroundColor: "#f5f7fb",
    webPreferences: {
      preload: path.join(__dirname, "preload.js")
    }
  });

  window.loadFile(path.join(__dirname, "index.html"));
}

app.whenReady().then(() => {
  try {
    client = steamworks.init({ appId: APP_ID, callbackIntervalMs: 100 });
    registerSteamCallbacks();
    recordEvent("steam:init", { appId: APP_ID });
  } catch (error) {
    initError = serializeError(error);
    recordEvent("steam:init:error", initError);
  }

  createWindow();
});

ipcMain.handle("steam-smoke:snapshot", () => snapshot());
ipcMain.handle("steam-smoke:auth-ticket", async () => {
  const activeClient = requireClient();
  const ticket = await activeClient.auth.getAuthTicketForWebApi(AUTH_IDENTITY);
  const bytes = ticket.getBytes();
  return sanitize({
    identity: AUTH_IDENTITY,
    byteLength: bytes.length,
    prefixHex: bytes.subarray(0, 12).toString("hex")
  });
});
ipcMain.handle("steam-smoke:overlay-store", () => {
  const activeClient = requireClient();
  activeClient.overlay.activateToStore(APP_ID, activeClient.overlay.StoreFlag.None);
  recordEvent("overlay:store", { appId: APP_ID });
  return snapshot();
});
ipcMain.handle("steam-smoke:overlay-web", () => {
  const activeClient = requireClient();
  activeClient.overlay.activateToWebPage(STORE_URL, { modal: false });
  recordEvent("overlay:web", { url: STORE_URL });
  return snapshot();
});
ipcMain.handle("steam-smoke:overlay-dialog", () => {
  const activeClient = requireClient();
  activeClient.overlay.activateDialog("Friends");
  recordEvent("overlay:dialog", { dialog: "Friends" });
  return snapshot();
});
ipcMain.handle("steam-smoke:native-probe-open", () => {
  const activeClient = requireClient();
  activeClient.overlay.openNativeOverlayProbeWindow("Steam Bridge Native Overlay Probe");
  activeClient.overlay.pumpNativeOverlayProbeWindow();
  recordEvent("overlay:native-probe-open", {});
  return snapshot();
});
ipcMain.handle("steam-smoke:native-probe-pump", () => {
  const activeClient = requireClient();
  activeClient.overlay.pumpNativeOverlayProbeWindow();
  return snapshot();
});
ipcMain.handle("steam-smoke:native-probe-close", () => {
  const activeClient = requireClient();
  activeClient.overlay.closeNativeOverlayProbeWindow();
  recordEvent("overlay:native-probe-close", {});
  return snapshot();
});

app.on("window-all-closed", () => {
  for (const handle of callbackHandles.splice(0)) {
    try {
      handle.disconnect();
    } catch {
      // Best-effort shutdown for an example app.
    }
  }

  try {
    if (client) {
      steamworks.shutdown();
    }
  } finally {
    app.quit();
  }
});

function registerSteamCallbacks() {
  callbackHandles.push(
    steamworks.onGameOverlayActivated((event) => recordEvent("callback:overlay-activated", event)),
    steamworks.onSteamServersConnected((event) => recordEvent("callback:servers-connected", event)),
    steamworks.onSteamServerConnectFailure((event) => recordEvent("callback:server-connect-failure", event)),
    steamworks.onSteamServersDisconnected((event) => recordEvent("callback:servers-disconnected", event)),
    steamworks.onMicroTxnAuthorizationResponse((event) => recordEvent("callback:microtxn", event))
  );

  try {
    client.input.enableDeviceCallbacks();
    callbackHandles.push(
      client.input.onDeviceConnected((event) => recordEvent("callback:input-device-connected", event)),
      client.input.onDeviceDisconnected((event) => recordEvent("callback:input-device-disconnected", event)),
      client.input.onConfigurationLoaded((event) => recordEvent("callback:input-configuration-loaded", event)),
      client.input.onGamepadSlotChange((event) => recordEvent("callback:input-slot-change", event))
    );
  } catch (error) {
    recordEvent("callback:input:error", serializeError(error));
  }
}

function snapshot() {
  const base = {
    app: {
      appId: APP_ID,
      appName: "Steam Bridge Electron Smoke",
      authIdentity: AUTH_IDENTITY,
      overlayProfile: OVERLAY_PROFILE,
      storeUrl: STORE_URL,
      isPackaged: app.isPackaged
    },
    process: {
      platform: process.platform,
      arch: process.arch,
      node: process.versions.node,
      electron: process.versions.electron,
      chrome: process.versions.chrome,
      cwd: process.cwd(),
      execPath: process.execPath,
      resourcesPath: process.resourcesPath,
      argv: process.argv
    },
    steam: {
      initialized: Boolean(client),
      initError
    },
    events: eventLog.slice(-20)
  };

  if (!client) {
    return sanitize(base);
  }

  return sanitize({
    ...base,
    steam: {
      initialized: true,
      running: readValue(() => client.utils.isSteamRunning()),
      installPath: readValue(() => client.utils.getSteamInstallPath() || null),
      appId: readValue(() => client.utils.getAppId()),
      steamDeck: readValue(() => client.utils.isSteamRunningOnSteamDeck()),
      bigPicture: readValue(() => client.utils.isSteamInBigPictureMode()),
      overlayEnabled: readValue(() => client.utils.isOverlayEnabled()),
      overlayNeedsPresent: readValue(() => client.utils.overlayNeedsPresent()),
      overlayDiagnostics: readValue(() => client.utils.getOverlayDiagnostics()),
      uiLanguage: readValue(() => client.utils.getSteamUILanguage()),
      universe: readValue(() => client.utils.getConnectedUniverse()),
      serverTime: readValue(() => client.utils.getServerRealTime())
    },
    account: {
      steamId: readValue(() => client.localplayer.getSteamId()),
      appOwner: readValue(() => client.apps.appOwner())
    },
    appInfo: {
      subscribed: readValue(() => client.apps.isSubscribed()),
      appInstalled: readValue(() => client.apps.isAppInstalled(APP_ID)),
      subscribedApp: readValue(() => client.apps.isSubscribedApp(APP_ID)),
      buildId: readValue(() => client.apps.appBuildId()),
      currentLanguage: readValue(() => client.apps.currentGameLanguage()),
      availableLanguages: readValue(() => client.apps.availableGameLanguages()),
      installDir: readValue(() => client.apps.appInstallDir(APP_ID))
    },
    overlay: {
      nativeProbeOpen: readValue(() => client.overlay.isNativeOverlayProbeWindowOpen()),
      nativeHostOpen: readValue(() => client.overlay.isNativeOverlayHostViewOpen())
    },
    input: readValue(() => {
      if (!inputInitialized) {
        client.input.init();
        inputInitialized = true;
      }
      client.input.runFrame();
      const controllers = client.input.getControllers();
      return {
        maxControllers: client.input.STEAM_INPUT_MAX_COUNT,
        handleAllControllers: client.input.STEAM_INPUT_HANDLE_ALL_CONTROLLERS,
        controllerCount: controllers.length,
        controllers: controllers.map((controller) => ({
          handle: controller.getHandle(),
          inputType: controller.getInputType()
        }))
      };
    }),
    enumSmoke: {
      okResult: client.SteamworksEnums.EResult.k_EResultOK,
      overlayDialogFriends: client.overlay.Dialog.Friends
    }
  });
}

function readValue(fn) {
  try {
    return { ok: true, value: fn() };
  } catch (error) {
    return { ok: false, error: serializeError(error) };
  }
}

function requireClient() {
  if (!client) {
    throw new Error(initError ? initError.message : "Steam Bridge did not initialize.");
  }

  return client;
}

function recordEvent(type, payload) {
  const event = sanitize({
    type,
    at: new Date().toISOString(),
    payload
  });
  eventLog.push(event);
  eventLog.splice(0, Math.max(0, eventLog.length - 100));

  for (const window of BrowserWindow.getAllWindows()) {
    window.webContents.send("steam-smoke:event", event);
  }
}

function writeSteamAppIdFiles(appId) {
  const directories = new Set([process.cwd(), __dirname]);
  if (app.isPackaged) {
    directories.add(path.dirname(process.execPath));
  }

  for (const directory of directories) {
    try {
      fs.writeFileSync(path.join(directory, "steam_appid.txt"), `${appId}\n`);
    } catch {
      // Some packaged locations can be read-only. One writable/visible app ID file is enough.
    }
  }
}

function serializeError(error) {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack
    };
  }

  return {
    name: "Error",
    message: String(error)
  };
}

function sanitize(value) {
  if (typeof value === "bigint") {
    return value.toString();
  }

  if (Buffer.isBuffer(value)) {
    return {
      type: "Buffer",
      byteLength: value.length,
      prefixHex: value.subarray(0, 12).toString("hex")
    };
  }

  if (Array.isArray(value)) {
    return value.map(sanitize);
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, sanitize(entry)]));
  }

  return value;
}
