const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { app, BrowserWindow, crashReporter, ipcMain } = require("electron");
const steamworks = require("steam-bridge");

const CLI_OPTIONS = parseSmokeArgs(process.argv.slice(1));
const APP_ID = Number(CLI_OPTIONS.appId || process.env.STEAM_BRIDGE_APP_ID || "480");
const AUTH_IDENTITY = process.env.STEAM_BRIDGE_AUTH_IDENTITY || "steam-bridge-electron-smoke";
const OVERLAY_PROFILE =
  CLI_OPTIONS.overlayProfile || process.env.STEAM_BRIDGE_ELECTRON_OVERLAY_PROFILE || "diagnostic";
const WINDOW_MODE = CLI_OPTIONS.windowMode || process.env.STEAM_BRIDGE_SMOKE_WINDOW_MODE || "windowed";
const STORE_URL = `https://store.steampowered.com/app/${APP_ID}/`;
const WEB_URL = CLI_OPTIONS.webUrl || process.env.STEAM_BRIDGE_SMOKE_WEB_URL || STORE_URL;
const WEB_MODAL = readBoolean(CLI_OPTIONS.webModal || process.env.STEAM_BRIDGE_SMOKE_WEB_MODAL, false);
const AUTORUN = CLI_OPTIONS.autorun || process.env.STEAM_BRIDGE_SMOKE_AUTORUN === "1";
const AUTORUN_ACTION = CLI_OPTIONS.autorunAction || process.env.STEAM_BRIDGE_SMOKE_AUTORUN_ACTION || "dialog";
const AUTORUN_ACTION_DELAY_MS = Number(
  CLI_OPTIONS.autorunActionDelayMs || process.env.STEAM_BRIDGE_SMOKE_AUTORUN_ACTION_DELAY_MS || "1500"
);
const AUTORUN_RESULT_DELAY_MS = Number(
  CLI_OPTIONS.autorunResultDelayMs || process.env.STEAM_BRIDGE_SMOKE_AUTORUN_RESULT_DELAY_MS || "5000"
);
const AUTORUN_RESULT_FILE = CLI_OPTIONS.resultFile || process.env.STEAM_BRIDGE_SMOKE_RESULT_FILE || "";
const AUTORUN_KEEP_OPEN_AFTER_RESULT = readBoolean(
  CLI_OPTIONS.keepOpenAfterResult || process.env.STEAM_BRIDGE_SMOKE_KEEP_OPEN_AFTER_RESULT,
  false
);
const DIAGNOSTIC_DIR =
  CLI_OPTIONS.diagnosticDir ||
  process.env.STEAM_BRIDGE_SMOKE_DIAGNOSTIC_DIR ||
  path.join(os.tmpdir(), "steam-bridge-smoke-diagnostics", createRunId());
const LIFECYCLE_LOG_FILE = path.join(DIAGNOSTIC_DIR, "lifecycle.jsonl");
const CRASH_DUMP_DIR = path.join(DIAGNOSTIC_DIR, "crash-dumps");
const AUTORUN_REQUIRE_OVERLAY_ACTIVE = readBoolean(
  CLI_OPTIONS.autorunRequireOverlayActive || process.env.STEAM_BRIDGE_SMOKE_REQUIRE_OVERLAY_ACTIVE,
  false
);
const LAUNCH_ENV_KEYS = [
  "SteamAppId",
  "SteamGameId",
  "SteamOverlayGameId",
  "SteamClientLaunch",
  "SteamEnv",
  "STEAM_COMPAT_APP_ID",
  "STEAM_COMPAT_CLIENT_INSTALL_PATH",
  "STEAM_COMPAT_DATA_PATH",
  "LD_PRELOAD",
  "DYLD_INSERT_LIBRARIES",
  "__COMPAT_LAYER"
];
const STARTUP_LAUNCH_CONTEXT = getLaunchContext();
const OVERLAY_CONFIG = steamworks.electronConfigureSteamOverlay({ profile: OVERLAY_PROFILE });

setupCrashDiagnostics();
writeSteamAppIdFiles(APP_ID);

let client;
let initError;
let inputInitialized = false;
let shutdownComplete = false;
let nativeOverlaySession;
const callbackHandles = [];
const eventLog = [];

function createWindow() {
  const fullscreen = WINDOW_MODE === "fullscreen" || WINDOW_MODE === "borderless";
  const frame = WINDOW_MODE !== "borderless";
  const window = new BrowserWindow({
    width: 1060,
    height: 760,
    minWidth: 860,
    minHeight: 640,
    fullscreen,
    frame,
    autoHideMenuBar: true,
    title: "Steam Bridge Electron Smoke",
    backgroundColor: "#f5f7fb",
    webPreferences: {
      backgroundThrottling: false,
      preload: path.join(__dirname, "preload.js")
    }
  });

  window.loadFile(path.join(__dirname, "index.html"));
}

app.whenReady().then(() => {
  recordLifecycle("app:ready", { diagnosticDir: DIAGNOSTIC_DIR, crashDumpDir: CRASH_DUMP_DIR });

  try {
    client = steamworks.init({ appId: APP_ID, callbackIntervalMs: 100 });
    registerSteamCallbacks();
    recordEvent("steam:init", { appId: APP_ID });
  } catch (error) {
    initError = serializeError(error);
    recordEvent("steam:init:error", initError);
  }

  createWindow();
  if (AUTORUN) {
    runAutorunSmoke();
  }
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
ipcMain.handle("steam-smoke:overlay-store", () => openStoreOverlay());
ipcMain.handle("steam-smoke:overlay-web", () => openWebOverlay());
ipcMain.handle("steam-smoke:overlay-dialog", () => openDialogOverlay());
ipcMain.handle("steam-smoke:native-probe-open", () => openNativeProbe());
ipcMain.handle("steam-smoke:native-probe-pump", () => pumpNativeProbe());
ipcMain.handle("steam-smoke:native-probe-close", () => closeNativeProbe());

app.on("window-all-closed", () => {
  recordLifecycle("app:window-all-closed", {});
  app.quit();
});
app.on("before-quit", () => {
  recordLifecycle("app:before-quit", {});
});
app.on("will-quit", () => {
  recordLifecycle("app:will-quit", {});
  shutdownSteam();
});
app.on("quit", (_event, exitCode) => {
  recordLifecycle("app:quit", { exitCode });
});
app.on("render-process-gone", (_event, webContents, details) => {
  recordLifecycle("app:render-process-gone", {
    url: webContents.getURL(),
    details
  });
});
app.on("child-process-gone", (_event, details) => {
  recordLifecycle("app:child-process-gone", details);
});
app.on("gpu-process-crashed", (_event, killed) => {
  recordLifecycle("app:gpu-process-crashed", { killed });
});

process.on("uncaughtException", (error) => {
  recordLifecycle("process:uncaught-exception", serializeError(error));
  process.exitCode = 1;
  setImmediate(() => process.exit(1));
});
process.on("unhandledRejection", (reason) => {
  recordLifecycle("process:unhandled-rejection", serializeError(reason));
});
process.on("warning", (warning) => {
  recordLifecycle("process:warning", serializeError(warning));
});
process.on("exit", (exitCode) => {
  recordLifecycle("process:exit", { exitCode });
});
process.on("SIGTERM", () => {
  recordLifecycle("process:signal", { signal: "SIGTERM" });
  process.exit(143);
});
process.on("SIGINT", () => {
  recordLifecycle("process:signal", { signal: "SIGINT" });
  process.exit(130);
});

function shutdownSteam() {
  if (shutdownComplete) {
    return;
  }
  shutdownComplete = true;
  closeNativeOverlaySession();

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
  } catch {
    // Best-effort shutdown for an example app.
  }
}

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

async function runAutorunSmoke() {
  recordEvent("autorun:start", {
    action: AUTORUN_ACTION,
    actionDelayMs: AUTORUN_ACTION_DELAY_MS,
    resultDelayMs: AUTORUN_RESULT_DELAY_MS
  });

  await delay(AUTORUN_ACTION_DELAY_MS);
  const overlayActiveCount = countOverlayActiveEvents();
  const actionResult = runAutorunAction(AUTORUN_ACTION);
  const waitResult = await waitForAutorunResult(AUTORUN_ACTION, AUTORUN_RESULT_DELAY_MS, overlayActiveCount);

  const result = sanitize({
    ok: Boolean(client) && !actionResult.error && waitResult.ok,
    action: actionResult,
    wait: waitResult,
    snapshot: snapshot()
  });
  const line = `STEAM_BRIDGE_SMOKE_RESULT ${JSON.stringify(result)}\n`;
  writeSmokeResultLine(line);
  if (AUTORUN_KEEP_OPEN_AFTER_RESULT) {
    recordEvent("autorun:keep-open-after-result", { resultFile: AUTORUN_RESULT_FILE || null });
    process.stdout.write(line);
    return;
  }

  process.stdout.write(line, () => process.exit(0));
}

async function waitForAutorunResult(action, durationMs, overlayActiveCount) {
  if (!isNativeSessionAction(action)) {
    if (!AUTORUN_REQUIRE_OVERLAY_ACTIVE || !isOverlayAction(action)) {
      await delay(durationMs);
      return { ok: true, action, durationMs };
    }

    const startedAt = Date.now();
    const deadline = startedAt + durationMs;
    let overlayActivated = false;
    while (Date.now() < deadline) {
      if (countOverlayActiveEvents() > overlayActiveCount) {
        overlayActivated = true;
      }
      await delay(Math.min(100, Math.max(0, deadline - Date.now())));
    }

    if (overlayActivated) {
      return { ok: true, action, overlayActivated: true, durationMs: Date.now() - startedAt };
    }

    recordEvent("autorun:overlay-active-timeout", { action, durationMs });
    return { ok: false, action, overlayActivated: false, durationMs };
  }

  const startedAt = Date.now();
  const deadline = startedAt + durationMs;
  let pumps = 0;

  while (Date.now() < deadline) {
    await delay(Math.min(100, Math.max(0, deadline - Date.now())));
    try {
      pumpNativeProbe();
      pumps += 1;
    } catch (error) {
      const serialized = serializeError(error);
      recordEvent("overlay:native-session-pump:error", { action, pumps, error: serialized });
      return { ok: false, action, pumps, durationMs: Date.now() - startedAt, error: serialized };
    }
  }

  const elapsedMs = Date.now() - startedAt;
  recordEvent("overlay:native-session-pump", { action, pumps, durationMs: elapsedMs });
  return { ok: true, action, pumps, durationMs: elapsedMs };
}

function runAutorunAction(action) {
  try {
    switch (action) {
      case "none":
        recordEvent("autorun:action", { action });
        return { ok: true, action };
      case "store":
        openStoreOverlay();
        return { ok: true, action };
      case "web":
        openWebOverlay();
        return { ok: true, action };
      case "dialog":
      case "friends":
        openDialogOverlay();
        return { ok: true, action };
      case "native-dialog":
      case "native-probe":
        openNativeDialogOverlay();
        return { ok: true, action };
      case "native-store":
        openNativeStoreOverlay();
        return { ok: true, action };
      case "native-web":
        openNativeWebOverlay();
        return { ok: true, action };
      default:
        throw new Error(`Unsupported autorun action: ${action}`);
    }
  } catch (error) {
    const serialized = serializeError(error);
    recordEvent("autorun:action:error", { action, error: serialized });
    return { ok: false, action, error: serialized };
  }
}

function openStoreOverlay() {
  const activeClient = requireClient();
  activeClient.overlay.activateToStore(APP_ID, activeClient.overlay.StoreFlag.None);
  recordEvent("overlay:store", { appId: APP_ID });
  return snapshot();
}

function openWebOverlay() {
  const activeClient = requireClient();
  activeClient.overlay.activateToWebPage(WEB_URL, { modal: WEB_MODAL });
  recordEvent("overlay:web", { url: WEB_URL, modal: WEB_MODAL });
  return snapshot();
}

function openDialogOverlay() {
  const activeClient = requireClient();
  activeClient.overlay.activateDialog("Friends");
  recordEvent("overlay:dialog", { dialog: "Friends" });
  return snapshot();
}

function openNativeProbe() {
  return openNativeDialogOverlay();
}

function openNativeDialogOverlay() {
  const activeClient = requireClient();
  closeNativeOverlaySession();
  nativeOverlaySession = activeClient.overlay.activateDialogWithNativeSession("Friends", {
    title: "Steam Bridge Native Overlay"
  });
  recordEvent("overlay:native-session-open", {
    target: "dialog",
    dialog: "Friends",
    session: nativeOverlaySession.snapshot()
  });
  return snapshot();
}

function openNativeStoreOverlay() {
  const activeClient = requireClient();
  closeNativeOverlaySession();
  nativeOverlaySession = activeClient.overlay.activateToStoreWithNativeSession(
    APP_ID,
    activeClient.overlay.StoreFlag.None,
    {
      title: "Steam Bridge Native Overlay"
    }
  );
  recordEvent("overlay:native-session-open", {
    target: "store",
    appId: APP_ID,
    flag: activeClient.overlay.StoreFlag.None,
    session: nativeOverlaySession.snapshot()
  });
  return snapshot();
}

function openNativeWebOverlay() {
  const activeClient = requireClient();
  closeNativeOverlaySession();
  nativeOverlaySession = activeClient.overlay.activateToWebPageWithNativeSession(WEB_URL, {
    modal: WEB_MODAL,
    title: "Steam Bridge Native Overlay"
  });
  recordEvent("overlay:native-session-open", {
    target: "web",
    url: WEB_URL,
    modal: WEB_MODAL,
    session: nativeOverlaySession.snapshot()
  });
  return snapshot();
}

function pumpNativeProbe() {
  if (nativeOverlaySession) {
    nativeOverlaySession.pump();
  } else {
    requireClient().overlay.pumpNativeOverlayProbeWindow();
  }
  return snapshot();
}

function closeNativeProbe() {
  closeNativeOverlaySession();
  recordEvent("overlay:native-session-close", {});
  return snapshot();
}

function closeNativeOverlaySession() {
  if (nativeOverlaySession) {
    try {
      nativeOverlaySession.close();
    } catch (error) {
      recordEvent("overlay:native-session-close:error", serializeError(error));
    }
  }
  nativeOverlaySession = undefined;
}

function snapshot() {
  const base = {
    app: {
      appId: APP_ID,
      appName: "Steam Bridge Electron Smoke",
      authIdentity: AUTH_IDENTITY,
      overlayProfile: OVERLAY_PROFILE,
      overlayConfig: OVERLAY_CONFIG,
      windowMode: WINDOW_MODE,
      autorun: AUTORUN,
      autorunAction: AUTORUN_ACTION,
      autorunRequireOverlayActive: AUTORUN_REQUIRE_OVERLAY_ACTIVE,
      autorunKeepOpenAfterResult: AUTORUN_KEEP_OPEN_AFTER_RESULT,
      autorunResultFile: AUTORUN_RESULT_FILE || null,
      diagnosticDir: DIAGNOSTIC_DIR,
      lifecycleLogFile: LIFECYCLE_LOG_FILE,
      crashDumpDir: CRASH_DUMP_DIR,
      crashReporterStarted: crashReporterStarted(),
      storeUrl: STORE_URL,
      webUrl: WEB_URL,
      webModal: WEB_MODAL,
      isPackaged: app.isPackaged
    },
    process: {
      pid: process.pid,
      ppid: process.ppid,
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
    launch: STARTUP_LAUNCH_CONTEXT,
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
      nativeHostOpen: readValue(() => client.overlay.isNativeOverlayHostViewOpen()),
      nativeSession: readValue(() => (nativeOverlaySession ? nativeOverlaySession.snapshot() : null))
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
          inputType: controller.getType()
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

function getLaunchContext() {
  const env = {};
  for (const key of LAUNCH_ENV_KEYS) {
    if (process.env[key]) {
      env[key] = process.env[key];
    }
  }

  const overlayEnv = [env.LD_PRELOAD, env.DYLD_INSERT_LIBRARIES].filter(Boolean).join("\n");
  const overlayInjection = /gameoverlayrenderer/i.test(overlayEnv);
  const steamLaunch = Boolean(
    overlayInjection ||
      env.SteamAppId ||
      env.SteamGameId ||
      env.SteamOverlayGameId ||
      env.SteamClientLaunch ||
      env.SteamEnv ||
      env.STEAM_COMPAT_APP_ID ||
      env.STEAM_COMPAT_DATA_PATH
  );

  return {
    steamLaunch,
    overlayInjection,
    env
  };
}

function delay(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function writeSmokeResultLine(line) {
  if (!AUTORUN_RESULT_FILE) {
    return;
  }

  try {
    fs.mkdirSync(path.dirname(AUTORUN_RESULT_FILE), { recursive: true });
    fs.appendFileSync(AUTORUN_RESULT_FILE, line);
  } catch (error) {
    console.error(`Failed to write smoke result file ${AUTORUN_RESULT_FILE}:`, error);
  }
}

function setupCrashDiagnostics() {
  try {
    fs.mkdirSync(CRASH_DUMP_DIR, { recursive: true });
    app.setPath("crashDumps", CRASH_DUMP_DIR);
    crashReporter.start({
      productName: "Steam Bridge Electron Smoke",
      uploadToServer: false,
      ignoreSystemCrashHandler: false,
      globalExtra: {
        appId: String(APP_ID),
        overlayProfile: OVERLAY_PROFILE,
        runId: path.basename(DIAGNOSTIC_DIR)
      }
    });
    recordLifecycle("crash-reporter:start", {
      diagnosticDir: DIAGNOSTIC_DIR,
      crashDumpDir: CRASH_DUMP_DIR,
      parameters: crashReporter.getParameters()
    });
  } catch (error) {
    recordLifecycle("crash-reporter:error", serializeError(error));
  }
}

function crashReporterStarted() {
  try {
    return Boolean(crashReporter.getParameters());
  } catch {
    return false;
  }
}

function recordLifecycle(type, payload) {
  const entry = sanitize({
    type,
    at: new Date().toISOString(),
    pid: process.pid,
    payload
  });

  try {
    fs.mkdirSync(DIAGNOSTIC_DIR, { recursive: true });
    fs.appendFileSync(LIFECYCLE_LOG_FILE, `${JSON.stringify(entry)}\n`);
  } catch (error) {
    console.error(`Failed to write smoke lifecycle log ${LIFECYCLE_LOG_FILE}:`, error);
  }
}

function recordEvent(type, payload) {
  const event = sanitize({
    type,
    at: new Date().toISOString(),
    payload
  });
  eventLog.push(event);
  eventLog.splice(0, Math.max(0, eventLog.length - 100));
  recordLifecycle(`event:${type}`, payload);

  for (const window of BrowserWindow.getAllWindows()) {
    window.webContents.send("steam-smoke:event", event);
  }
}

function countOverlayActiveEvents() {
  return eventLog.filter(isOverlayActiveEvent).length;
}

function isOverlayActiveEvent(event) {
  if (!event || event.type !== "callback:overlay-activated") {
    return false;
  }

  const payload = event.payload;
  if (payload == null) {
    return false;
  }
  if (payload === true || payload === 1) {
    return true;
  }
  if (typeof payload !== "object") {
    return false;
  }

  const activePayload = payload["0"] && typeof payload["0"] === "object" ? payload["0"] : payload;
  return (
    activePayload.active === true ||
    activePayload.active === 1 ||
    activePayload.m_bActive === true ||
    activePayload.m_bActive === 1
  );
}

function isOverlayAction(action) {
  return action === "dialog" || action === "friends" || action === "store" || action === "web";
}

function isNativeSessionAction(action) {
  return action === "native-probe" || action === "native-dialog" || action === "native-store" || action === "native-web";
}

function readBoolean(value, fallback) {
  if (value == null || value === "") {
    return fallback;
  }

  const normalized = String(value).toLowerCase();
  return normalized === "1" || normalized === "true" || normalized === "yes" || normalized === "on";
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

function createRunId() {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

function parseSmokeArgs(args) {
  const options = {
    appId: undefined,
    autorun: false,
    autorunAction: undefined,
    autorunActionDelayMs: undefined,
    autorunResultDelayMs: undefined,
    overlayProfile: undefined,
    windowMode: undefined,
    autorunRequireOverlayActive: undefined,
    webModal: undefined,
    webUrl: undefined,
    resultFile: undefined,
    diagnosticDir: undefined,
    keepOpenAfterResult: undefined
  };

  for (let index = 0; index < args.length; index += 1) {
    const { name, value, consumedValue } = readOption(args, index);
    if (!name) {
      continue;
    }

    switch (name) {
      case "--steam-bridge-app-id":
        options.appId = value;
        break;
      case "--steam-bridge-smoke-autorun":
        options.autorun = value == null || value === "" || value === "1" || value === "true";
        break;
      case "--steam-bridge-smoke-autorun-action":
        options.autorunAction = value;
        break;
      case "--steam-bridge-smoke-autorun-action-delay-ms":
        options.autorunActionDelayMs = value;
        break;
      case "--steam-bridge-smoke-autorun-result-delay-ms":
        options.autorunResultDelayMs = value;
        break;
      case "--steam-bridge-smoke-require-overlay-active":
        options.autorunRequireOverlayActive = value == null || value === "" ? "1" : value;
        break;
      case "--steam-bridge-smoke-web-modal":
        options.webModal = value == null || value === "" ? "1" : value;
        break;
      case "--steam-bridge-smoke-web-url":
        options.webUrl = value;
        break;
      case "--steam-bridge-electron-overlay-profile":
        options.overlayProfile = value;
        break;
      case "--steam-bridge-smoke-window-mode":
        options.windowMode = value;
        break;
      case "--steam-bridge-smoke-result-file":
        options.resultFile = value;
        break;
      case "--steam-bridge-smoke-diagnostic-dir":
        options.diagnosticDir = value;
        break;
      case "--steam-bridge-smoke-keep-open-after-result":
        options.keepOpenAfterResult = value == null || value === "" ? "1" : value;
        break;
      default:
        break;
    }

    if (consumedValue) {
      index += 1;
    }
  }

  return options;
}

function readOption(args, index) {
  const arg = args[index];
  if (!arg || !arg.startsWith("--steam-bridge-")) {
    return { name: undefined, value: undefined, consumedValue: false };
  }

  const equalsIndex = arg.indexOf("=");
  if (equalsIndex >= 0) {
    return {
      name: arg.slice(0, equalsIndex),
      value: arg.slice(equalsIndex + 1),
      consumedValue: false
    };
  }

  const next = args[index + 1];
  if (next && !next.startsWith("--")) {
    return { name: arg, value: next, consumedValue: true };
  }

  return { name: arg, value: undefined, consumedValue: false };
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
