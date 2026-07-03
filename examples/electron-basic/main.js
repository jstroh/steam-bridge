const fs = require("node:fs");
const crypto = require("node:crypto");
const { execFileSync } = require("node:child_process");
const http = require("node:http");
const os = require("node:os");
const path = require("node:path");
const { app, BrowserWindow, crashReporter, ipcMain } = require("electron");
const steamworks = require("steam-bridge");
const { sanitizeSmokeValue } = require("./smoke-sanitize.cjs");
const { serializeSmokeError } = require("./smoke-error.cjs");

const CLI_OPTIONS = parseSmokeArgs(process.argv.slice(1));
loadSmokeEnvFile(CLI_OPTIONS.smokeEnvFile || process.env.STEAM_BRIDGE_SMOKE_ENV_FILE || "");
const APP_ID = Number(CLI_OPTIONS.appId || process.env.STEAM_BRIDGE_APP_ID || "480");
const AUTH_IDENTITY = process.env.STEAM_BRIDGE_AUTH_IDENTITY || "steam-bridge-electron-smoke";
const OVERLAY_PROFILE =
  CLI_OPTIONS.overlayProfile || process.env.STEAM_BRIDGE_ELECTRON_OVERLAY_PROFILE || "diagnostic";
const OVERLAY_SCRUB_CHILD_ENV = readOptionalBoolean(
  CLI_OPTIONS.overlayScrubChildEnv || process.env.STEAM_BRIDGE_ELECTRON_OVERLAY_SCRUB_CHILD_ENV
);
const OVERLAY_ISOLATE_CHILD_PROCESSES = readOptionalBoolean(
  CLI_OPTIONS.overlayIsolateChildProcesses ||
    process.env.STEAM_BRIDGE_ELECTRON_OVERLAY_ISOLATE_CHILD_PROCESSES
);
const OVERLAY_IN_PROCESS_GPU = readOptionalBoolean(
  CLI_OPTIONS.overlayInProcessGpu || process.env.STEAM_BRIDGE_ELECTRON_OVERLAY_IN_PROCESS_GPU
);
const OVERLAY_DISABLE_DIRECT_COMPOSITION = readOptionalBoolean(
  CLI_OPTIONS.overlayDisableDirectComposition ||
    process.env.STEAM_BRIDGE_ELECTRON_OVERLAY_DISABLE_DIRECT_COMPOSITION
);
const WINDOW_MODE = CLI_OPTIONS.windowMode || process.env.STEAM_BRIDGE_SMOKE_WINDOW_MODE || "windowed";
const MAC_NATIVE_HOST_BACKEND = normalizeMacNativeHostBackend(
  CLI_OPTIONS.nativeHostBackend || process.env.STEAM_BRIDGE_SMOKE_NATIVE_HOST_BACKEND || ""
);
configureMacNativeHostBackend(MAC_NATIVE_HOST_BACKEND);
const WINDOWS_NATIVE_HOST_STYLE = normalizeWindowsNativeHostStyle(
  CLI_OPTIONS.windowsNativeHostStyle || process.env.STEAM_BRIDGE_WINDOWS_NATIVE_HOST_STYLE || ""
);
configureWindowsNativeHostStyle(WINDOWS_NATIVE_HOST_STYLE);
const WINDOWS_NATIVE_HOST_BACKEND = normalizeWindowsNativeHostBackend(
  CLI_OPTIONS.windowsNativeHostBackend || process.env.STEAM_BRIDGE_WINDOWS_NATIVE_HOST_BACKEND || ""
);
configureWindowsNativeHostBackend(WINDOWS_NATIVE_HOST_BACKEND);
const STORE_URL = `https://store.steampowered.com/app/${APP_ID}/`;
let STORE_ROUTE = normalizeStoreRoute(CLI_OPTIONS.storeRoute || process.env.STEAM_BRIDGE_SMOKE_STORE_ROUTE, "web");
let WEB_URL = CLI_OPTIONS.webUrl || process.env.STEAM_BRIDGE_SMOKE_WEB_URL || STORE_URL;
let WEB_MODAL = readBoolean(CLI_OPTIONS.webModal || process.env.STEAM_BRIDGE_SMOKE_WEB_MODAL, false);
let CHECKOUT_URL = CLI_OPTIONS.checkoutUrl || process.env.STEAM_BRIDGE_SMOKE_CHECKOUT_URL || "";
let CHECKOUT_TRANSACTION_ID =
  CLI_OPTIONS.checkoutTransactionId || process.env.STEAM_BRIDGE_SMOKE_CHECKOUT_TRANSACTION_ID || "";
let CHECKOUT_RETURN_URL =
  CLI_OPTIONS.checkoutReturnUrl || process.env.STEAM_BRIDGE_SMOKE_CHECKOUT_RETURN_URL || "";
let CHECKOUT_JSON_FILE =
  CLI_OPTIONS.checkoutJsonFile || process.env.STEAM_BRIDGE_SMOKE_CHECKOUT_JSON_FILE || "";
let INIT_TXN_REQUEST_FILE =
  CLI_OPTIONS.initTxnRequestFile || process.env.STEAM_BRIDGE_SMOKE_INIT_TXN_REQUEST_FILE || "";
let INIT_TXN_API_KEY_ENV =
  CLI_OPTIONS.initTxnApiKeyEnv || process.env.STEAM_BRIDGE_SMOKE_INIT_TXN_API_KEY_ENV || "";
let INIT_TXN_ENDPOINT =
  CLI_OPTIONS.initTxnEndpoint || process.env.STEAM_BRIDGE_SMOKE_INIT_TXN_ENDPOINT || "";
let OVERLAY_DIALOG = CLI_OPTIONS.overlayDialog || process.env.STEAM_BRIDGE_SMOKE_OVERLAY_DIALOG || "Friends";
let USER_DIALOG = CLI_OPTIONS.userDialog || process.env.STEAM_BRIDGE_SMOKE_USER_DIALOG || "steamid";
let SHORTCUT_TARGET =
  CLI_OPTIONS.shortcutTarget || process.env.STEAM_BRIDGE_SMOKE_SHORTCUT_TARGET || "friends";
const PRESENTER_MODE =
  CLI_OPTIONS.presenterMode ||
  process.env.STEAM_BRIDGE_SMOKE_PRESENTER_MODE ||
  process.env.STEAM_BRIDGE_ELECTRON_OVERLAY_PRESENTER ||
  "";
const DISABLE_ELECTRON_OVERLAY_PRESENTER = readBoolean(
  process.env.STEAM_BRIDGE_DISABLE_ELECTRON_OVERLAY_PRESENTER,
  false
);
const EFFECTIVE_PRESENTER_MODE =
  PRESENTER_MODE || (DISABLE_ELECTRON_OVERLAY_PRESENTER ? "session" : "persistent");
let ACHIEVEMENT_NAME = CLI_OPTIONS.achievementName || process.env.STEAM_BRIDGE_SMOKE_ACHIEVEMENT_NAME || "";
let ACHIEVEMENT_CURRENT = Number(
  CLI_OPTIONS.achievementCurrent || process.env.STEAM_BRIDGE_SMOKE_ACHIEVEMENT_CURRENT || "1"
);
let ACHIEVEMENT_MAX = Number(CLI_OPTIONS.achievementMax || process.env.STEAM_BRIDGE_SMOKE_ACHIEVEMENT_MAX || "2");
const INITIAL_SMOKE_ACTION_OPTIONS = {
  storeRoute: STORE_ROUTE,
  webUrl: WEB_URL,
  webModal: WEB_MODAL,
  checkoutUrl: CHECKOUT_URL,
  checkoutTransactionId: CHECKOUT_TRANSACTION_ID,
  checkoutReturnUrl: CHECKOUT_RETURN_URL,
  checkoutJsonFile: CHECKOUT_JSON_FILE,
  initTxnRequestFile: INIT_TXN_REQUEST_FILE,
  initTxnApiKeyEnv: INIT_TXN_API_KEY_ENV,
  initTxnEndpoint: INIT_TXN_ENDPOINT,
  overlayDialog: OVERLAY_DIALOG,
  userDialog: USER_DIALOG,
  shortcutTarget: SHORTCUT_TARGET,
  achievementName: ACHIEVEMENT_NAME,
  achievementCurrent: ACHIEVEMENT_CURRENT,
  achievementMax: ACHIEVEMENT_MAX
};
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
const CONTROL_SERVER_ENABLED = readBoolean(
  CLI_OPTIONS.controlServer || process.env.STEAM_BRIDGE_SMOKE_CONTROL_SERVER,
  false
);
const CONTROL_FILE = CLI_OPTIONS.controlFile || process.env.STEAM_BRIDGE_SMOKE_CONTROL_FILE || "";
const CONTROL_TOKEN =
  CLI_OPTIONS.controlToken || process.env.STEAM_BRIDGE_SMOKE_CONTROL_TOKEN || crypto.randomBytes(24).toString("hex");
const DIAGNOSTIC_DIR =
  CLI_OPTIONS.diagnosticDir ||
  process.env.STEAM_BRIDGE_SMOKE_DIAGNOSTIC_DIR ||
  path.join(os.tmpdir(), "steam-bridge-smoke-diagnostics", createRunId());
const LIFECYCLE_LOG_FILE = path.join(DIAGNOSTIC_DIR, "lifecycle.jsonl");
const CRASH_DUMP_DIR = path.join(DIAGNOSTIC_DIR, "crash-dumps");
const MANAGED_OVERLAY_WAIT_TIMEOUT_MS = normalizePositiveInteger(
  Number(CLI_OPTIONS.managedOverlayWaitTimeoutMs || process.env.STEAM_BRIDGE_SMOKE_MANAGED_OVERLAY_WAIT_TIMEOUT_MS),
  45000
);
const MANAGED_OVERLAY_PARK_TIMEOUT_MS = normalizePositiveInteger(
  Number(CLI_OPTIONS.managedOverlayParkTimeoutMs || process.env.STEAM_BRIDGE_SMOKE_MANAGED_OVERLAY_PARK_TIMEOUT_MS),
  90000
);
const MANAGED_OVERLAY_RESULT_MODE = normalizeManagedOverlayResultMode(
  CLI_OPTIONS.managedOverlayResultMode || process.env.STEAM_BRIDGE_SMOKE_MANAGED_OVERLAY_RESULT_MODE
);
const FATAL_LIFECYCLE_EVENT_TYPES = new Set([
  "app:render-process-gone",
  "app:child-process-gone",
  "app:gpu-process-crashed",
  "process:uncaught-exception",
  "process:unhandled-rejection"
]);
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
  "STEAM_BRIDGE_MACOS_NATIVE_LAUNCHER",
  "STEAM_BRIDGE_MACOS_NATIVE_LAUNCHER_TARGET",
  "STEAM_BRIDGE_WINDOWS_NATIVE_HOST_BACKEND",
  "STEAM_BRIDGE_WINDOWS_NATIVE_HOST_STYLE",
  "__COMPAT_LAYER"
];
const STARTUP_LAUNCH_CONTEXT = getLaunchContext();
const OVERLAY_CONFIG_OPTIONS = { profile: OVERLAY_PROFILE };
if (OVERLAY_SCRUB_CHILD_ENV !== undefined) {
  OVERLAY_CONFIG_OPTIONS.scrubSteamOverlayChildProcessEnv = OVERLAY_SCRUB_CHILD_ENV;
}
if (OVERLAY_ISOLATE_CHILD_PROCESSES !== undefined) {
  OVERLAY_CONFIG_OPTIONS.isolateSteamOverlayChildProcesses = OVERLAY_ISOLATE_CHILD_PROCESSES;
}
if (OVERLAY_IN_PROCESS_GPU !== undefined) {
  OVERLAY_CONFIG_OPTIONS.enableInProcessGpu = OVERLAY_IN_PROCESS_GPU;
}
if (OVERLAY_DISABLE_DIRECT_COMPOSITION !== undefined) {
  OVERLAY_CONFIG_OPTIONS.disableDirectComposition = OVERLAY_DISABLE_DIRECT_COMPOSITION;
}
const OVERLAY_CONFIG = steamworks.electronConfigureSteamOverlay(OVERLAY_CONFIG_OPTIONS);

setupCrashDiagnostics();
writeSteamAppIdFiles(APP_ID);

let client;
let initError;
let inputInitialized = false;
let shutdownComplete = false;
let mainWindow;
let nativeOverlaySession;
let electronSteamOverlay;
let smokeControlServer;
let smokeControlActionInFlight = false;
let postClosePresenterSnapshotHandle;
let managedOverlayWaitSequence = 0;
let pendingManagedOverlayShownWait;
let pendingManagedOverlayLifecycle;
let pendingManagedOverlayCompletionWait;
let pendingShortcutOpenLifecycleWait;
let managedShortcutOpenSource = "Shift+Tab";
const managedOverlayWaitControllers = new Set();
const callbackHandles = [];
const eventLog = [];

function createWindow() {
  const fullscreen = WINDOW_MODE === "fullscreen" || WINDOW_MODE === "borderless";
  const frame = WINDOW_MODE !== "borderless";
  const showAfterFirstRender = process.platform !== "win32";
  const window = new BrowserWindow({
    width: 1060,
    height: 760,
    minWidth: 860,
    minHeight: 640,
    fullscreen,
    frame,
    show: !showAfterFirstRender,
    autoHideMenuBar: true,
    title: "Steam Bridge Electron Smoke",
    backgroundColor: "#f5f7fb",
    webPreferences: {
      backgroundThrottling: false,
      preload: path.join(__dirname, "preload.js")
    }
  });

  mainWindow = window;
  let loadSettled = false;
  const loaded = new Promise((resolve) => {
    const completeLoad = (eventName, details = {}) => {
      if (loadSettled) {
        return;
      }
      loadSettled = true;
      recordLifecycle("window:first-render", { eventName, ...details });
      if (showAfterFirstRender && !window.isDestroyed() && !window.isVisible()) {
        window.show();
        recordLifecycle("window:shown", { eventName });
      }
      resolve();
    };

    window.once("ready-to-show", () => completeLoad("ready-to-show"));
    window.webContents.once("did-finish-load", () => completeLoad("did-finish-load"));
    window.webContents.once(
      "did-fail-load",
      (_event, errorCode, errorDescription, validatedURL, isMainFrame) =>
        completeLoad("did-fail-load", { errorCode, errorDescription, validatedURL, isMainFrame })
    );
    window.once("closed", () => completeLoad("closed"));
    window.loadFile(path.join(__dirname, "index.html")).catch((error) => {
      completeLoad("load-error", { error: serializeError(error) });
    });
  });
  window.on("closed", () => {
    if (mainWindow === window) {
      mainWindow = undefined;
    }
  });
  return loaded;
}

app.whenReady().then(async () => {
  recordLifecycle("app:ready", { diagnosticDir: DIAGNOSTIC_DIR, crashDumpDir: CRASH_DUMP_DIR });

  try {
    client = steamworks.init({ appId: APP_ID, callbackIntervalMs: 100 });
    registerSteamCallbacks();
    recordEvent("steam:init", { appId: APP_ID });
  } catch (error) {
    initError = serializeError(error);
    recordEvent("steam:init:error", initError);
  }

  await createWindow();
  startSmokeControlServer();
  if (AUTORUN) {
    void runAutorunSmoke();
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
ipcMain.handle("steam-smoke:presenter-ready", () => checkPresenterReady());
ipcMain.handle("steam-smoke:presenter-web", () => openPresenterWebOverlay());
ipcMain.handle("steam-smoke:presenter-web-open-and-wait", () => openPresenterWebOpenAndWaitOverlay());
ipcMain.handle("steam-smoke:presenter-duplicate-open-guard", () => openPresenterDuplicateOpenGuardOverlay());
ipcMain.handle("steam-smoke:presenter-store-open-and-wait", () => openPresenterStoreOpenAndWaitOverlay());
ipcMain.handle("steam-smoke:presenter-dialog-auto-open-and-wait", () =>
  openPresenterDialogAutoOpenAndWaitOverlay()
);
ipcMain.handle("steam-smoke:presenter-friends", () => openPresenterFriendsOverlay());
ipcMain.handle("steam-smoke:presenter-friends-open-and-wait", () => openPresenterFriendsOpenAndWaitOverlay());
ipcMain.handle("steam-smoke:presenter-profile", () => openPresenterProfileOverlay());
ipcMain.handle("steam-smoke:presenter-profile-open-and-wait", () => openPresenterProfileOpenAndWaitOverlay());
ipcMain.handle("steam-smoke:presenter-players", () => openPresenterPlayersOverlay());
ipcMain.handle("steam-smoke:presenter-players-open-and-wait", () => openPresenterPlayersOpenAndWaitOverlay());
ipcMain.handle("steam-smoke:presenter-community", () => openPresenterCommunityOverlay());
ipcMain.handle("steam-smoke:presenter-community-open-and-wait", () => openPresenterCommunityOpenAndWaitOverlay());
ipcMain.handle("steam-smoke:presenter-stats", () => openPresenterStatsOverlay());
ipcMain.handle("steam-smoke:presenter-stats-open-and-wait", () => openPresenterStatsOpenAndWaitOverlay());
ipcMain.handle("steam-smoke:presenter-achievements", () => openPresenterAchievementsOverlay());
ipcMain.handle("steam-smoke:presenter-achievements-open-and-wait", () => openPresenterAchievementsOpenAndWaitOverlay());
ipcMain.handle("steam-smoke:presenter-user", () => openPresenterUserOverlay());
ipcMain.handle("steam-smoke:presenter-user-native", () => openPresenterNativeUserOverlay());
ipcMain.handle("steam-smoke:presenter-user-open-and-wait", () => openPresenterUserOpenAndWaitOverlay());
ipcMain.handle("steam-smoke:presenter-checkout", () => openPresenterCheckoutOverlay());
ipcMain.handle("steam-smoke:presenter-shortcut-status", () => getPresenterShortcutOpenStatus());
ipcMain.handle("steam-smoke:presenter-shortcut-open", () => openPresenterShortcutTargetBridge());
ipcMain.handle("steam-smoke:presenter-shortcut-open-and-wait", () => openPresenterShortcutOpenAndWaitBridge());
ipcMain.handle("steam-smoke:presenter-achievement-progress", () => openPresenterAchievementProgress());
ipcMain.handle("steam-smoke:presenter-achievement-unlock", () => openPresenterAchievementUnlock());
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
  closeSmokeControlServer();
  clearPostClosePresenterSnapshotObserver();
  abortManagedOverlayWaits();
  closeNativeOverlayPresenter();
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
    steamworks.onMicroTxnAuthorizationResponse(recordMicroTxnAuthorizationResponse)
  );

  try {
    callbackHandles.push(
      client.stats.onUserStatsReceived((event) => recordEvent("callback:user-stats-received", event)),
      client.stats.onUserStatsStored((event) => recordEvent("callback:user-stats-stored", event)),
      client.achievement.onStored((event) => recordEvent("callback:achievement-stored", event))
    );
  } catch (error) {
    recordEvent("callback:stats-achievement:error", serializeError(error));
  }

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

function recordMicroTxnAuthorizationResponse(event) {
  const payload = event && typeof event === "object" && !Array.isArray(event) ? { ...event } : { event };
  payload.presenter = electronSteamOverlay && electronSteamOverlay.isOpen() ? electronSteamOverlay.snapshot() : null;
  recordEvent("callback:microtxn", payload);
}

async function runAutorunSmoke() {
  recordEvent("autorun:start", {
    action: AUTORUN_ACTION,
    actionDelayMs: AUTORUN_ACTION_DELAY_MS,
    resultDelayMs: AUTORUN_RESULT_DELAY_MS
  });

  await delay(AUTORUN_ACTION_DELAY_MS);
  const result = await runSmokeActionAndWait(AUTORUN_ACTION, {
    source: "autorun",
    resultDelayMs: AUTORUN_RESULT_DELAY_MS,
    requireOverlayActive: AUTORUN_REQUIRE_OVERLAY_ACTIVE
  });
  recordEvent("autorun:result-ready", { action: AUTORUN_ACTION, resultFile: AUTORUN_RESULT_FILE || null });
  const line = `STEAM_BRIDGE_SMOKE_RESULT ${JSON.stringify(result)}\n`;
  writeSmokeResultLine(line);
  recordEvent("autorun:result-written", { action: AUTORUN_ACTION, resultFile: AUTORUN_RESULT_FILE || null });
  if (AUTORUN_KEEP_OPEN_AFTER_RESULT) {
    recordEvent("autorun:keep-open-after-result", { resultFile: AUTORUN_RESULT_FILE || null });
    process.stdout.write(line);
    return;
  }

  process.stdout.write(line, () => process.exit(0));
}

async function runSmokeActionAndWait(action, options = {}) {
  const source = options.source || "control";
  const resultDelayMs = normalizePositiveInteger(Number(options.resultDelayMs), AUTORUN_RESULT_DELAY_MS);
  const requireOverlayActive =
    typeof options.requireOverlayActive === "boolean" ? options.requireOverlayActive : AUTORUN_REQUIRE_OVERLAY_ACTIVE;
  const overlayActiveCount = countOverlayActiveEvents();
  applySmokeActionOptions(options.actionOptions, { reset: source === "control" });
  recordEvent(`${source}:action-begin`, { action });
  pendingManagedOverlayShownWait = undefined;
  pendingManagedOverlayLifecycle = undefined;
  pendingManagedOverlayCompletionWait = undefined;
  const actionResult = await runAutorunAction(action);
  recordEvent(`${source}:action-complete`, {
    action,
    ok: actionResult.ok,
    error: actionResult.error || null
  });
  recordEvent(`${source}:wait-begin`, { action, resultDelayMs });
  const waitResult = await waitForAutorunResult(action, resultDelayMs, overlayActiveCount, {
    requireOverlayActive
  });
  recordEvent(`${source}:wait-complete`, {
    action,
    ok: waitResult.ok,
    durationMs: waitResult.durationMs
  });
  recordEvent(`${source}:snapshot-begin`, { action });
  const state = snapshot();
  recordEvent(`${source}:snapshot-complete`, { action });

  return sanitize({
    ok: Boolean(client) && !actionResult.error && waitResult.ok,
    action: actionResult,
    wait: waitResult,
    snapshot: state
  });
}

function startSmokeControlServer() {
  if (!CONTROL_SERVER_ENABLED || smokeControlServer) {
    return;
  }

  smokeControlServer = http.createServer((request, response) => {
    handleSmokeControlRequest(request, response).catch((error) => {
      recordEvent("control:request:error", serializeError(error));
      sendJsonResponse(response, 500, { ok: false, error: serializeError(error) });
    });
  });
  smokeControlServer.on("error", (error) => {
    recordLifecycle("control:error", serializeError(error));
  });
  smokeControlServer.listen(0, "127.0.0.1", () => {
    const address = smokeControlServer.address();
    const port = address && typeof address === "object" ? address.port : undefined;
    const ready = {
      host: "127.0.0.1",
      port,
      token: CONTROL_TOKEN,
      pid: process.pid,
      diagnosticDir: DIAGNOSTIC_DIR,
      lifecycleLogFile: LIFECYCLE_LOG_FILE
    };
    writeSmokeControlFile(ready);
    recordEvent("control:ready", {
      host: ready.host,
      port: ready.port,
      pid: ready.pid,
      controlFile: CONTROL_FILE || null,
      tokenPresent: Boolean(CONTROL_TOKEN)
    });
  });
}

function closeSmokeControlServer() {
  if (!smokeControlServer) {
    return;
  }
  const server = smokeControlServer;
  smokeControlServer = undefined;
  try {
    server.close();
  } catch {
    // Best-effort shutdown for the smoke control server.
  }
}

function writeSmokeControlFile(ready) {
  if (!CONTROL_FILE) {
    process.stdout.write(`STEAM_BRIDGE_SMOKE_CONTROL ${JSON.stringify(ready)}\n`);
    return;
  }

  try {
    fs.mkdirSync(path.dirname(CONTROL_FILE), { recursive: true });
    fs.writeFileSync(CONTROL_FILE, `${JSON.stringify(ready)}\n`, { mode: 0o600 });
    fs.chmodSync(CONTROL_FILE, 0o600);
  } catch (error) {
    recordLifecycle("control:file-error", serializeError(error));
  }
}

async function handleSmokeControlRequest(request, response) {
  const requestUrl = new URL(request.url || "/", "http://127.0.0.1");
  if (!isSmokeControlAuthorized(request)) {
    sendJsonResponse(response, 401, { ok: false, error: { message: "Unauthorized smoke control request." } });
    return;
  }

  if (request.method === "GET" && requestUrl.pathname === "/snapshot") {
    sendJsonResponse(response, 200, { ok: true, snapshot: snapshot() });
    return;
  }

  if (request.method === "POST" && requestUrl.pathname === "/action") {
    if (smokeControlActionInFlight) {
      sendJsonResponse(response, 409, { ok: false, error: { message: "A smoke control action is already running." } });
      return;
    }

    const body = await readSmokeControlJson(request);
    const action = typeof body.action === "string" ? body.action.trim() : "";
    if (!action) {
      sendJsonResponse(response, 400, { ok: false, error: { message: "Missing smoke control action." } });
      return;
    }

    smokeControlActionInFlight = true;
    try {
      recordEvent("control:action-request", {
        action,
        resultDelayMs: body.resultDelayMs || null,
        resultFile: typeof body.resultFile === "string" && body.resultFile ? true : false,
        options: summarizeSmokeActionOptions(body.options)
      });
      const result = await runSmokeActionAndWait(action, {
        source: "control",
        actionOptions: body.options,
        resultDelayMs: body.resultDelayMs,
        requireOverlayActive:
          typeof body.requireOverlayActive === "boolean" ? body.requireOverlayActive : undefined
      });
      if (typeof body.resultFile === "string" && body.resultFile) {
        writeSmokeResultLine(`STEAM_BRIDGE_SMOKE_RESULT ${JSON.stringify(result)}\n`, body.resultFile);
      }
      sendJsonResponse(response, 200, { ok: result.ok === true, result });
    } finally {
      smokeControlActionInFlight = false;
    }
    return;
  }

  if (request.method === "POST" && requestUrl.pathname === "/quit") {
    sendJsonResponse(response, 200, { ok: true });
    setImmediate(() => app.quit());
    return;
  }

  sendJsonResponse(response, 404, { ok: false, error: { message: `Unknown smoke control route: ${requestUrl.pathname}` } });
}

function isSmokeControlAuthorized(request) {
  const headerToken = request.headers["x-steam-bridge-smoke-token"];
  const authorization = request.headers.authorization || "";
  const bearerPrefix = "Bearer ";
  const bearerToken = authorization.startsWith(bearerPrefix) ? authorization.slice(bearerPrefix.length) : "";
  return headerToken === CONTROL_TOKEN || bearerToken === CONTROL_TOKEN;
}

function readSmokeControlJson(request) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    request.on("data", (chunk) => {
      size += chunk.length;
      if (size > 1024 * 1024) {
        reject(new Error("Smoke control request body is too large."));
        request.destroy();
        return;
      }
      chunks.push(chunk);
    });
    request.on("error", reject);
    request.on("end", () => {
      const text = Buffer.concat(chunks).toString("utf8").trim();
      if (!text) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(text));
      } catch (error) {
        reject(error);
      }
    });
  });
}

function sendJsonResponse(response, statusCode, body) {
  const text = JSON.stringify(sanitize(body));
  response.writeHead(statusCode, {
    "content-type": "application/json; charset=utf-8",
    "content-length": Buffer.byteLength(text)
  });
  response.end(text);
}

function applySmokeActionOptions(options, { reset = false } = {}) {
  if (reset) {
    resetSmokeActionOptions();
  }

  if (!options || typeof options !== "object" || Array.isArray(options)) {
    return;
  }

  if (typeof options.webUrl === "string" && options.webUrl) {
    WEB_URL = options.webUrl;
  }
  if (Object.prototype.hasOwnProperty.call(options, "webModal")) {
    WEB_MODAL = readBoolean(options.webModal, WEB_MODAL);
  }
  if (typeof options.storeRoute === "string") {
    STORE_ROUTE = normalizeStoreRoute(options.storeRoute, STORE_ROUTE);
  }
  if (typeof options.checkoutUrl === "string") {
    CHECKOUT_URL = options.checkoutUrl;
  }
  if (typeof options.checkoutTransactionId === "string") {
    CHECKOUT_TRANSACTION_ID = options.checkoutTransactionId;
  }
  if (typeof options.checkoutReturnUrl === "string") {
    CHECKOUT_RETURN_URL = options.checkoutReturnUrl;
  }
  if (typeof options.checkoutJsonFile === "string") {
    CHECKOUT_JSON_FILE = options.checkoutJsonFile;
  }
  if (typeof options.initTxnRequestFile === "string") {
    INIT_TXN_REQUEST_FILE = options.initTxnRequestFile;
  }
  if (typeof options.initTxnApiKeyEnv === "string") {
    INIT_TXN_API_KEY_ENV = options.initTxnApiKeyEnv;
  }
  if (typeof options.initTxnEndpoint === "string") {
    INIT_TXN_ENDPOINT = normalizeInitTxnEndpoint(options.initTxnEndpoint);
  }
  if (typeof options.overlayDialog === "string" && options.overlayDialog) {
    OVERLAY_DIALOG = options.overlayDialog;
  }
  if (typeof options.userDialog === "string" && options.userDialog) {
    USER_DIALOG = options.userDialog;
  }
  if (typeof options.shortcutTarget === "string" && options.shortcutTarget) {
    SHORTCUT_TARGET = options.shortcutTarget;
  }
  if (typeof options.achievementName === "string") {
    ACHIEVEMENT_NAME = options.achievementName;
  }
  if (Object.prototype.hasOwnProperty.call(options, "achievementCurrent")) {
    ACHIEVEMENT_CURRENT = Number(options.achievementCurrent);
  }
  if (Object.prototype.hasOwnProperty.call(options, "achievementMax")) {
    ACHIEVEMENT_MAX = Number(options.achievementMax);
  }
}

function resetSmokeActionOptions() {
  STORE_ROUTE = INITIAL_SMOKE_ACTION_OPTIONS.storeRoute;
  WEB_URL = INITIAL_SMOKE_ACTION_OPTIONS.webUrl;
  WEB_MODAL = INITIAL_SMOKE_ACTION_OPTIONS.webModal;
  CHECKOUT_URL = INITIAL_SMOKE_ACTION_OPTIONS.checkoutUrl;
  CHECKOUT_TRANSACTION_ID = INITIAL_SMOKE_ACTION_OPTIONS.checkoutTransactionId;
  CHECKOUT_RETURN_URL = INITIAL_SMOKE_ACTION_OPTIONS.checkoutReturnUrl;
  CHECKOUT_JSON_FILE = INITIAL_SMOKE_ACTION_OPTIONS.checkoutJsonFile;
  INIT_TXN_REQUEST_FILE = INITIAL_SMOKE_ACTION_OPTIONS.initTxnRequestFile;
  INIT_TXN_API_KEY_ENV = INITIAL_SMOKE_ACTION_OPTIONS.initTxnApiKeyEnv;
  INIT_TXN_ENDPOINT = INITIAL_SMOKE_ACTION_OPTIONS.initTxnEndpoint;
  OVERLAY_DIALOG = INITIAL_SMOKE_ACTION_OPTIONS.overlayDialog;
  USER_DIALOG = INITIAL_SMOKE_ACTION_OPTIONS.userDialog;
  SHORTCUT_TARGET = INITIAL_SMOKE_ACTION_OPTIONS.shortcutTarget;
  ACHIEVEMENT_NAME = INITIAL_SMOKE_ACTION_OPTIONS.achievementName;
  ACHIEVEMENT_CURRENT = INITIAL_SMOKE_ACTION_OPTIONS.achievementCurrent;
  ACHIEVEMENT_MAX = INITIAL_SMOKE_ACTION_OPTIONS.achievementMax;
}

function summarizeSmokeActionOptions(options) {
  if (!options || typeof options !== "object" || Array.isArray(options)) {
    return null;
  }

  const summary = {};
  if (typeof options.webUrl === "string" && options.webUrl) {
    summary.hasWebUrl = true;
  }
  if (Object.prototype.hasOwnProperty.call(options, "webModal")) {
    summary.webModal = readBoolean(options.webModal, false);
  }
  if (typeof options.storeRoute === "string") {
    summary.storeRoute = normalizeStoreRoute(options.storeRoute, STORE_ROUTE);
  }
  if (typeof options.checkoutUrl === "string" && options.checkoutUrl) {
    summary.hasCheckoutUrl = true;
  }
  if (typeof options.checkoutTransactionId === "string" && options.checkoutTransactionId) {
    summary.hasCheckoutTransactionId = true;
  }
  if (typeof options.checkoutReturnUrl === "string" && options.checkoutReturnUrl) {
    summary.hasCheckoutReturnUrl = true;
  }
  if (typeof options.checkoutJsonFile === "string" && options.checkoutJsonFile) {
    summary.hasCheckoutJsonFile = true;
  }
  if (typeof options.initTxnRequestFile === "string" && options.initTxnRequestFile) {
    summary.hasInitTxnRequestFile = true;
  }
  if (typeof options.initTxnApiKeyEnv === "string" && options.initTxnApiKeyEnv) {
    summary.hasInitTxnApiKeyEnv = true;
  }
  if (typeof options.initTxnEndpoint === "string" && options.initTxnEndpoint) {
    summary.initTxnEndpoint = normalizeInitTxnEndpoint(options.initTxnEndpoint);
  }
  if (options.overlayDialog) {
    summary.overlayDialog = options.overlayDialog;
  }
  if (options.userDialog) {
    summary.userDialog = options.userDialog;
  }
  if (options.shortcutTarget) {
    summary.shortcutTarget = options.shortcutTarget;
  }
  if (options.achievementName) {
    summary.achievementName = options.achievementName;
  }
  if (options.achievementCurrent != null) {
    summary.achievementCurrent = options.achievementCurrent;
  }
  if (options.achievementMax != null) {
    summary.achievementMax = options.achievementMax;
  }

  return Object.keys(summary).length > 0 ? sanitize(summary) : null;
}

async function waitForAutorunResult(action, durationMs, overlayActiveCount, options = {}) {
  if (pendingManagedOverlayShownWait || isManagedOverlayShownWaitAction(action)) {
    return waitForManagedOverlayShownResult(action);
  }

  if (isImmediateSmokeAction(action)) {
    return { ok: true, action, durationMs: 0 };
  }

  if (isPassiveNotificationAction(action)) {
    return waitForPassiveNotificationResult(action, durationMs);
  }

  const requireOverlayActive =
    typeof options.requireOverlayActive === "boolean" ? options.requireOverlayActive : AUTORUN_REQUIRE_OVERLAY_ACTIVE;
  if (!isNativeSessionAction(action)) {
    if (!requireOverlayActive || !isOverlayAction(action)) {
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

async function waitForPassiveNotificationResult(action, durationMs) {
  const startedAt = Date.now();
  const deadline = startedAt + durationMs;
  const eventType = action === "presenter-achievement-progress" ? "achievement:progress" : "achievement:unlock";
  let pumps = 0;

  while (Date.now() < deadline) {
    try {
      pumpNativeProbe();
      pumps += 1;
    } catch (error) {
      const serialized = serializeError(error);
      recordEvent("overlay:passive-notification-pump:error", { action, pumps, error: serialized });
      return { ok: false, action, pumps, durationMs: Date.now() - startedAt, error: serialized };
    }

    const presenter = safeOverlaySnapshot(electronSteamOverlay);
    const eventSeen = eventLog.some((entry) => entry.type === eventType);
    if (eventSeen && isParkedPassivePresenter(presenter)) {
      const elapsedMs = Date.now() - startedAt;
      recordEvent("overlay:passive-notification-parked", { action, pumps, durationMs: elapsedMs, presenter });
      return { ok: true, action, pumps, passiveNotificationParked: true, durationMs: elapsedMs, presenter };
    }

    await delay(Math.min(100, Math.max(0, deadline - Date.now())));
  }

  const presenter = safeOverlaySnapshot(electronSteamOverlay);
  const error = { message: "Timed out waiting for passive notification presenter to park." };
  recordEvent("overlay:passive-notification-timeout", { action, pumps, durationMs: Date.now() - startedAt, presenter });
  return { ok: false, action, pumps, passiveNotificationParked: false, durationMs: Date.now() - startedAt, error, presenter };
}

async function waitForManagedOverlayShownResult(action) {
  const shownWait = pendingManagedOverlayShownWait;
  const lifecycle = pendingManagedOverlayLifecycle;
  const completionWait = pendingManagedOverlayCompletionWait;
  pendingManagedOverlayShownWait = undefined;
  pendingManagedOverlayLifecycle = undefined;
  pendingManagedOverlayCompletionWait = undefined;
  const startedAt = Date.now();

  if (!shownWait) {
    const error = { message: "No managed overlay shown wait was registered for autorun action." };
    recordEvent("autorun:managed-overlay-shown-missing", { action, error });
    return { ok: false, action, overlayShown: false, durationMs: 0, error };
  }

  const result = await shownWait;
  if (MANAGED_OVERLAY_RESULT_MODE !== "complete") {
    return {
      ok: result.ok === true,
      action,
      overlayShown: result.ok === true,
      durationMs: Date.now() - startedAt,
      ...(result.error ? { error: result.error } : {}),
      ...(result.presenter ? { presenter: result.presenter } : {})
    };
  }

  if (result.ok !== true) {
    const completionResult = completionWait ? await completionWait : { ok: false };
    return {
      ok: false,
      action,
      overlayShown: false,
      overlayComplete: false,
      durationMs: Date.now() - startedAt,
      ...(result.error || completionResult.error ? { error: result.error || completionResult.error } : {}),
      ...(completionResult.result || completionResult.presenter || result.presenter
        ? { presenter: completionResult.result?.parked || completionResult.presenter || result.presenter }
        : {})
    };
  }

  if (!lifecycle || !lifecycle.closed || !lifecycle.parked) {
    const error = { message: "No managed overlay close/park lifecycle was registered for autorun action." };
    recordEvent("autorun:managed-overlay-lifecycle-missing", { action, error });
    return {
      ok: false,
      action,
      overlayShown: true,
      overlayClosed: false,
      overlayParked: false,
      durationMs: Date.now() - startedAt,
      error,
      ...(result.presenter ? { presenter: result.presenter } : {})
    };
  }

  const [closedResult, parkedResult, completionResult] = await Promise.all([
    lifecycle.closed,
    lifecycle.parked,
    completionWait || Promise.resolve({ ok: true })
  ]);
  const ok = closedResult.ok === true && parkedResult.ok === true && completionResult.ok !== false;
  return {
    ok,
    action,
    overlayShown: true,
    overlayClosed: closedResult.ok === true,
    overlayParked: parkedResult.ok === true,
    overlayComplete: completionResult.ok !== false,
    durationMs: Date.now() - startedAt,
    ...(closedResult.error || parkedResult.error || completionResult.error
      ? { error: closedResult.error || parkedResult.error || completionResult.error }
      : {}),
    ...(parkedResult.presenter || closedResult.presenter || result.presenter
      ? { presenter: parkedResult.presenter || closedResult.presenter || result.presenter }
      : {})
  };
}

async function runAutorunAction(action) {
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
      case "achievement-progress":
        openAchievementProgress();
        return { ok: true, action };
      case "achievement-unlock":
        openAchievementUnlock();
        return { ok: true, action };
      case "presenter-ready":
        checkPresenterReady();
        return { ok: true, action };
      case "presenter-dialog":
        await openPresenterDialogOverlay();
        return { ok: true, action };
      case "presenter-dialog-auto":
        await openPresenterDialogAutoOverlay();
        return { ok: true, action };
      case "presenter-dialog-auto-open-and-wait":
        openPresenterDialogAutoOpenAndWaitOverlay();
        return { ok: true, action };
      case "presenter-store":
        await openPresenterStoreOverlay();
        return { ok: true, action };
      case "presenter-web":
        await openPresenterWebOverlay();
        return { ok: true, action };
      case "presenter-web-open-and-wait":
        openPresenterWebOpenAndWaitOverlay();
        return { ok: true, action };
      case "presenter-duplicate-open-guard":
        await openPresenterDuplicateOpenGuardOverlay();
        return { ok: true, action };
      case "presenter-store-open-and-wait":
        openPresenterStoreOpenAndWaitOverlay();
        return { ok: true, action };
      case "presenter-friends":
        await openPresenterFriendsOverlay();
        return { ok: true, action };
      case "presenter-friends-open-and-wait":
        openPresenterFriendsOpenAndWaitOverlay();
        return { ok: true, action };
      case "presenter-profile":
        await openPresenterProfileOverlay();
        return { ok: true, action };
      case "presenter-profile-open-and-wait":
        openPresenterProfileOpenAndWaitOverlay();
        return { ok: true, action };
      case "presenter-players":
        await openPresenterPlayersOverlay();
        return { ok: true, action };
      case "presenter-players-open-and-wait":
        openPresenterPlayersOpenAndWaitOverlay();
        return { ok: true, action };
      case "presenter-community":
        await openPresenterCommunityOverlay();
        return { ok: true, action };
      case "presenter-community-open-and-wait":
        openPresenterCommunityOpenAndWaitOverlay();
        return { ok: true, action };
      case "presenter-stats":
        await openPresenterStatsOverlay();
        return { ok: true, action };
      case "presenter-stats-open-and-wait":
        openPresenterStatsOpenAndWaitOverlay();
        return { ok: true, action };
      case "presenter-achievements":
        await openPresenterAchievementsOverlay();
        return { ok: true, action };
      case "presenter-achievements-open-and-wait":
        openPresenterAchievementsOpenAndWaitOverlay();
        return { ok: true, action };
      case "presenter-user":
        await openPresenterUserOverlay();
        return { ok: true, action };
      case "presenter-user-native":
        await openPresenterNativeUserOverlay();
        return { ok: true, action };
      case "presenter-user-open-and-wait":
        openPresenterUserOpenAndWaitOverlay();
        return { ok: true, action };
      case "presenter-checkout":
        await openPresenterCheckoutOverlay();
        return { ok: true, action };
      case "presenter-shortcut":
        openPresenterShortcutBridge();
        return { ok: true, action };
      case "presenter-shortcut-open-and-wait":
        openPresenterShortcutOpenAndWaitBridge();
        return { ok: true, action };
      case "presenter-achievement-progress":
        openPresenterAchievementProgress();
        return { ok: true, action };
      case "presenter-achievement-unlock":
        openPresenterAchievementUnlock();
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
  activeClient.overlay.activateDialog(OVERLAY_DIALOG);
  recordEvent("overlay:dialog", { dialog: OVERLAY_DIALOG });
  return snapshot();
}

function openNativeProbe() {
  return openNativeDialogOverlay();
}

function openNativeDialogOverlay() {
  const activeClient = requireClient();
  closeNativeOverlaySession();
  nativeOverlaySession = activeClient.overlay.activateDialogWithNativeSession(OVERLAY_DIALOG, {
    ...nativeOverlayOptions(),
    title: "Steam Bridge Native Overlay"
  });
  recordEvent("overlay:native-session-open", {
    target: "dialog",
    dialog: OVERLAY_DIALOG,
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
      ...nativeOverlayOptions(),
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
    ...nativeOverlayOptions(),
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

function openAchievementProgress() {
  const activeClient = requireClient();
  recordEvent("achievement:progress", runAchievementProgressSmoke(activeClient));
  return snapshot();
}

function openAchievementUnlock() {
  const activeClient = requireClient();
  recordEvent("achievement:unlock", runAchievementUnlockSmoke(activeClient));
  return snapshot();
}

function checkPresenterReady() {
  const overlay = ensureElectronSteamOverlay();
  const nativeHostAvailability = overlay.getNativeHostAvailability();
  recordEvent("overlay:presenter-ready", {
    presenter: overlay.snapshot(),
    nativeHostAvailability
  });
  return snapshot();
}

async function openPresenterDialogOverlay() {
  const activeClient = requireClient();
  const overlay = ensureElectronSteamOverlay(activeClient);
  await overlay.waitForOverlayReady({
    timeoutMs: MANAGED_OVERLAY_WAIT_TIMEOUT_MS
  });
  overlay.open({ type: "dialog", dialog: OVERLAY_DIALOG, route: "native" });
  recordEvent("overlay:presenter-open", {
    target: "dialog",
    dialog: OVERLAY_DIALOG,
    route: "native",
    presenter: overlay.snapshot()
  });
  return snapshot();
}

async function openPresenterDialogAutoOverlay() {
  const overlay = ensureElectronSteamOverlay();
  const target = { type: "dialog", dialog: OVERLAY_DIALOG, appId: APP_ID };
  const context = {
    target: "dialog",
    dialog: OVERLAY_DIALOG,
    route: "auto",
    appId: APP_ID,
    api: "openDialog"
  };
  return openPresenterTargetOverlay(overlay, target, context);
}

async function openPresenterStoreOverlay() {
  const activeClient = requireClient();
  const overlay = ensureElectronSteamOverlay(activeClient);
  const url = typeof steamworks.steamStoreAppUrl === "function" ? steamworks.steamStoreAppUrl(APP_ID) : STORE_URL;
  const target = { type: "store", appId: APP_ID, flag: activeClient.overlay.StoreFlag.None, route: STORE_ROUTE };
  const context = {
    target: "store",
    appId: APP_ID,
    flag: activeClient.overlay.StoreFlag.None,
    route: STORE_ROUTE,
    url,
    api: "openStore"
  };
  return openPresenterTargetOverlay(overlay, target, context);
}

async function openPresenterWebOverlay() {
  const overlay = ensureElectronSteamOverlay();
  const target = { type: "web", url: WEB_URL, modal: WEB_MODAL };
  const context = {
    target: "web",
    url: WEB_URL,
    modal: WEB_MODAL,
    api: "openWeb"
  };
  return openPresenterTargetOverlay(overlay, target, context);
}

function openPresenterWebOpenAndWaitOverlay() {
  const overlay = ensureElectronSteamOverlay();
  const target = { type: "web", url: WEB_URL, modal: WEB_MODAL };
  const context = {
    target: "web",
    url: WEB_URL,
    modal: WEB_MODAL,
    api: "openWebAndWait"
  };
  return openPresenterTargetAndWaitOverlay(overlay, target, context);
}

async function openPresenterDuplicateOpenGuardOverlay() {
  const overlay = ensureElectronSteamOverlay();
  const target = { type: "web", url: WEB_URL, modal: WEB_MODAL };
  const context = {
    target: "web",
    url: WEB_URL,
    modal: WEB_MODAL,
    api: "duplicateOpenGuard"
  };
  const openAndWait = overlay.openWebAndWait(WEB_URL, { modal: WEB_MODAL }, {
    showTimeoutMs: MANAGED_OVERLAY_WAIT_TIMEOUT_MS,
    closeTimeoutMs: MANAGED_OVERLAY_PARK_TIMEOUT_MS
  });
  const initialSnapshot = overlay.snapshot();
  recordEvent("overlay:presenter-open-and-wait-start", {
    ...context,
    presenter: initialSnapshot
  });
  const lifecycle = observeManagedOverlayLifecycle(overlay, context);
  pendingManagedOverlayShownWait = lifecycle.shown;
  pendingManagedOverlayLifecycle = lifecycle;

  pendingManagedOverlayCompletionWait = openAndWait
    .then((result) => {
      recordEvent("overlay:presenter-open-and-wait-complete", {
        ...context,
        shown: result.shown,
        parked: result.parked,
        presenter: safeOverlaySnapshot(overlay)
      });
      return { ok: true, result };
    })
    .catch((error) => {
      const serialized = serializeError(error);
      if (!shutdownComplete) {
        recordEvent("overlay:presenter-open-and-wait:error", {
          ...context,
          error: serialized,
          presenter: safeOverlaySnapshot(overlay)
        });
      }
      return { ok: false, error: serialized };
    });

  const namedTargets = duplicateOpenGuardTargets();
  const openingStatus = overlay.getOpenStatus(target);
  const namedStatuses = {};
  const namedIfAvailableResults = {};
  const namedIfAvailableNulls = {};
  const namedAndWaitIfAvailableResults = {};
  const namedAndWaitIfAvailableNulls = {};
  const checkoutOperationState = { ran: false };
  for (const [name, namedTarget] of Object.entries(namedTargets)) {
    namedStatuses[name] = getNamedPresenterTargetOpenStatus(overlay, namedTarget);
  }
  namedStatuses.checkoutOperation = overlay.getCheckoutOperationStatus();
  const shortcutStatus = overlay.getShortcutOpenStatus();
  const openIfAvailableResult = overlay.openIfAvailable(target);
  const openAndWaitIfAvailableResult = await overlay.openWebAndWaitIfAvailable(WEB_URL, { modal: WEB_MODAL }, {
    showTimeoutMs: 5,
    closeTimeoutMs: 5
  });
  for (const [name, namedTarget] of Object.entries(namedTargets)) {
    namedIfAvailableResults[name] = openNamedPresenterTargetIfAvailable(overlay, namedTarget);
    namedIfAvailableNulls[name] = namedIfAvailableResults[name] === null;
  }
  for (const [name, namedTarget] of Object.entries(namedTargets)) {
    namedAndWaitIfAvailableResults[name] = await openNamedPresenterTargetAndWaitIfAvailable(
      overlay,
      namedTarget,
      {
        showTimeoutMs: 5,
        closeTimeoutMs: 5
      },
      name === "checkout" ? checkoutOperationState : undefined
    );
    namedAndWaitIfAvailableNulls[name] = namedAndWaitIfAvailableResults[name] === null;
  }
  const shortcutIfAvailableResult = overlay.openShortcutTargetIfAvailable();
  const shortcutAndWaitIfAvailableResult = await overlay.openShortcutTargetAndWaitIfAvailable({
    showTimeoutMs: 5,
    closeTimeoutMs: 5
  });
  const checkoutOpenIfAvailableResult = namedIfAvailableResults.checkout;
  const checkoutIfAvailableResult = namedAndWaitIfAvailableResults.checkout;

  recordEvent("overlay:presenter-duplicate-open-guard", {
    ...context,
    status: openingStatus,
    namedStatuses,
    namedIfAvailableNulls,
    namedAndWaitIfAvailableNulls,
    shortcutStatus,
    openIfAvailableNull: openIfAvailableResult === null,
    openAndWaitIfAvailableNull: openAndWaitIfAvailableResult === null,
    shortcutIfAvailableNull: shortcutIfAvailableResult === null,
    shortcutAndWaitIfAvailableNull: shortcutAndWaitIfAvailableResult === null,
    checkoutOpenIfAvailableNull: checkoutOpenIfAvailableResult === null,
    checkoutIfAvailableNull: checkoutIfAvailableResult === null,
    checkoutOperationRan: checkoutOperationState.ran,
    presenter: safeOverlaySnapshot(overlay)
  });

  throwIfNativeHostUnavailable(initialSnapshot, target);
  return snapshot();
}

function openPresenterStoreOpenAndWaitOverlay() {
  const activeClient = requireClient();
  const overlay = ensureElectronSteamOverlay(activeClient);
  const url = typeof steamworks.steamStoreAppUrl === "function" ? steamworks.steamStoreAppUrl(APP_ID) : STORE_URL;
  const target = { type: "store", appId: APP_ID, flag: activeClient.overlay.StoreFlag.None, route: STORE_ROUTE };
  const context = {
    target: "store",
    appId: APP_ID,
    flag: activeClient.overlay.StoreFlag.None,
    route: STORE_ROUTE,
    url,
    api: "openStoreAndWait"
  };
  return openPresenterTargetAndWaitOverlay(overlay, target, context);
}

function openPresenterFriendsOpenAndWaitOverlay() {
  const overlay = ensureElectronSteamOverlay();
  const target = { type: "friends" };
  const context = {
    target: "friends",
    url: steamworks.STEAM_FRIENDS_OVERLAY_URL,
    modal: true,
    api: "openFriendsAndWait"
  };
  return openPresenterTargetAndWaitOverlay(overlay, target, context);
}

function openPresenterDialogAutoOpenAndWaitOverlay() {
  const overlay = ensureElectronSteamOverlay();
  const target = { type: "dialog", dialog: OVERLAY_DIALOG, appId: APP_ID };
  const context = {
    target: "dialog",
    dialog: OVERLAY_DIALOG,
    route: "auto",
    appId: APP_ID,
    api: "openDialogAndWait"
  };
  return openPresenterTargetAndWaitOverlay(overlay, target, context);
}

function openPresenterTargetAndWaitOverlay(overlay, target, context) {
  const openAndWait = openNamedPresenterTargetAndWait(overlay, target, {
    showTimeoutMs: MANAGED_OVERLAY_WAIT_TIMEOUT_MS,
    closeTimeoutMs: MANAGED_OVERLAY_PARK_TIMEOUT_MS
  });

  const initialSnapshot = overlay.snapshot();
  recordEvent("overlay:presenter-open-and-wait-start", {
    ...context,
    presenter: initialSnapshot
  });
  const lifecycle = observeManagedOverlayLifecycle(overlay, context);
  pendingManagedOverlayShownWait = lifecycle.shown;
  pendingManagedOverlayLifecycle = lifecycle;

  pendingManagedOverlayCompletionWait = openAndWait
    .then((result) => {
      recordEvent("overlay:presenter-open-and-wait-complete", {
        ...context,
        shown: result.shown,
        parked: result.parked,
        presenter: safeOverlaySnapshot(overlay)
      });
      return { ok: true, result };
    })
    .catch((error) => {
      const serialized = serializeError(error);
      if (!shutdownComplete) {
        recordEvent("overlay:presenter-open-and-wait:error", {
          ...context,
          error: serialized,
          presenter: safeOverlaySnapshot(overlay)
        });
      }
      return { ok: false, error: serialized };
    });

  throwIfNativeHostUnavailable(initialSnapshot, target);
  return snapshot();
}

async function openPresenterTargetOverlay(overlay, target, context) {
  await waitForDirectPresenterOpenReadiness(overlay, target, context);
  openNamedPresenterTarget(overlay, target);
  recordEvent("overlay:presenter-open", { ...context, presenter: overlay.snapshot() });
  observeManagedOverlayLifecycle(overlay, context);
  return snapshot();
}

async function waitForDirectPresenterOpenReadiness(overlay, target, context) {
  const status = getNamedPresenterTargetOpenStatus(overlay, target);
  await waitForPresenterReadinessStatus(overlay, status, context);
}

function recordCheckoutOperationReadiness(overlay, context) {
  const status = overlay.getCheckoutOperationStatus();
  const readiness = directPresenterOpenReadinessStatus(status);
  recordEvent("overlay:presenter-direct-open-status", {
    ...context,
    status: readiness,
    presenter: safeOverlaySnapshot(overlay)
  });
}

async function waitForPresenterReadinessStatus(overlay, status, context) {
  const readiness = directPresenterOpenReadinessStatus(status);
  recordEvent("overlay:presenter-direct-open-status", {
    ...context,
    status: readiness,
    presenter: safeOverlaySnapshot(overlay)
  });
  if (status?.canOpen || status?.reason !== "overlay-not-ready") {
    return;
  }
  recordEvent("overlay:presenter-direct-open-wait-start", {
    ...context,
    status: readiness,
    presenter: safeOverlaySnapshot(overlay)
  });
  const ready = await overlay.waitForOverlayReady({
    timeoutMs: MANAGED_OVERLAY_WAIT_TIMEOUT_MS
  });
  recordEvent("overlay:presenter-direct-open-wait-complete", {
    ...context,
    ready,
    presenter: safeOverlaySnapshot(overlay)
  });
}

function directPresenterOpenReadinessStatus(status) {
  if (!status || typeof status !== "object") {
    return { canOpen: false, canWait: false, reason: "unknown" };
  }
  return {
    canOpen: status.canOpen === true,
    canWait: status.canWait === true,
    ...(typeof status.canStartOperation === "boolean" ? { canStartOperation: status.canStartOperation } : {}),
    ...(typeof status.reason === "string" ? { reason: status.reason } : {}),
    ...(typeof status.waitReason === "string" ? { waitReason: status.waitReason } : {}),
    ...(typeof status.message === "string" ? { message: status.message } : {}),
    ...(status.targetSnapshot && typeof status.targetSnapshot === "object"
      ? { targetSnapshot: status.targetSnapshot }
      : {})
  };
}

function openNamedPresenterTarget(overlay, target) {
  switch (target.type) {
    case "web":
      return overlay.openWeb(target.url, overlayTargetOptions(target, "url"));
    case "store":
      return overlay.openStore(overlayTargetOptions(target));
    case "friends":
      return overlay.openFriends(overlayTargetOptions(target));
    case "profile":
      return overlay.openProfile(overlayTargetOptions(target));
    case "players":
      return overlay.openPlayers(overlayTargetOptions(target));
    case "community":
      return overlay.openCommunity(overlayTargetOptions(target));
    case "stats":
      return overlay.openStats(overlayTargetOptions(target));
    case "achievements":
      return overlay.openAchievements(overlayTargetOptions(target));
    case "user":
      return overlay.openUser(overlayTargetOptions(target));
    case "dialog":
      return overlay.openDialog(overlayTargetOptions(target));
    default:
      return overlay.open(target);
  }
}

function openNamedPresenterTargetAndWait(overlay, target, waitOptions) {
  switch (target.type) {
    case "web":
      return overlay.openWebAndWait(target.url, overlayTargetOptions(target, "url"), waitOptions);
    case "store":
      return overlay.openStoreAndWait(overlayTargetOptions(target), waitOptions);
    case "friends":
      return overlay.openFriendsAndWait(overlayTargetOptions(target), waitOptions);
    case "profile":
      return overlay.openProfileAndWait(overlayTargetOptions(target), waitOptions);
    case "players":
      return overlay.openPlayersAndWait(overlayTargetOptions(target), waitOptions);
    case "community":
      return overlay.openCommunityAndWait(overlayTargetOptions(target), waitOptions);
    case "stats":
      return overlay.openStatsAndWait(overlayTargetOptions(target), waitOptions);
    case "achievements":
      return overlay.openAchievementsAndWait(overlayTargetOptions(target), waitOptions);
    case "user":
      return overlay.openUserAndWait(overlayTargetOptions(target), waitOptions);
    case "dialog":
      return overlay.openDialogAndWait(overlayTargetOptions(target), waitOptions);
    default:
      return overlay.openAndWait(target, waitOptions);
  }
}

function getNamedPresenterTargetOpenStatus(overlay, target) {
  switch (target.type) {
    case "web":
      return overlay.getWebOpenStatus(target.url, overlayTargetOptions(target, "url"));
    case "store":
      return overlay.getStoreOpenStatus(overlayTargetOptions(target));
    case "friends":
      return overlay.getFriendsOpenStatus(overlayTargetOptions(target));
    case "profile":
      return overlay.getProfileOpenStatus(overlayTargetOptions(target));
    case "players":
      return overlay.getPlayersOpenStatus(overlayTargetOptions(target));
    case "community":
      return overlay.getCommunityOpenStatus(overlayTargetOptions(target));
    case "stats":
      return overlay.getStatsOpenStatus(overlayTargetOptions(target));
    case "achievements":
      return overlay.getAchievementsOpenStatus(overlayTargetOptions(target));
    case "user":
      return overlay.getUserOpenStatus(overlayTargetOptions(target));
    case "checkout":
      return overlay.getCheckoutOpenStatus(overlayTargetOptions(target));
    case "dialog":
      return overlay.getDialogOpenStatus(overlayTargetOptions(target));
    default:
      return overlay.getOpenStatus(target);
  }
}

function openNamedPresenterTargetIfAvailable(overlay, target) {
  switch (target.type) {
    case "web":
      return overlay.openWebIfAvailable(target.url, overlayTargetOptions(target, "url"));
    case "store":
      return overlay.openStoreIfAvailable(overlayTargetOptions(target));
    case "friends":
      return overlay.openFriendsIfAvailable(overlayTargetOptions(target));
    case "profile":
      return overlay.openProfileIfAvailable(overlayTargetOptions(target));
    case "players":
      return overlay.openPlayersIfAvailable(overlayTargetOptions(target));
    case "community":
      return overlay.openCommunityIfAvailable(overlayTargetOptions(target));
    case "stats":
      return overlay.openStatsIfAvailable(overlayTargetOptions(target));
    case "achievements":
      return overlay.openAchievementsIfAvailable(overlayTargetOptions(target));
    case "user":
      return overlay.openUserIfAvailable(overlayTargetOptions(target));
    case "checkout":
      return overlay.openCheckoutIfAvailable(overlayTargetOptions(target));
    case "dialog":
      return overlay.openDialogIfAvailable(overlayTargetOptions(target));
    default:
      return overlay.openIfAvailable(target);
  }
}

function openNamedPresenterTargetAndWaitIfAvailable(
  overlay,
  target,
  waitOptions,
  checkoutOperationState = undefined
) {
  switch (target.type) {
    case "web":
      return overlay.openWebAndWaitIfAvailable(target.url, overlayTargetOptions(target, "url"), waitOptions);
    case "store":
      return overlay.openStoreAndWaitIfAvailable(overlayTargetOptions(target), waitOptions);
    case "friends":
      return overlay.openFriendsAndWaitIfAvailable(overlayTargetOptions(target), waitOptions);
    case "profile":
      return overlay.openProfileAndWaitIfAvailable(overlayTargetOptions(target), waitOptions);
    case "players":
      return overlay.openPlayersAndWaitIfAvailable(overlayTargetOptions(target), waitOptions);
    case "community":
      return overlay.openCommunityAndWaitIfAvailable(overlayTargetOptions(target), waitOptions);
    case "stats":
      return overlay.openStatsAndWaitIfAvailable(overlayTargetOptions(target), waitOptions);
    case "achievements":
      return overlay.openAchievementsAndWaitIfAvailable(overlayTargetOptions(target), waitOptions);
    case "user":
      return overlay.openUserAndWaitIfAvailable(overlayTargetOptions(target), waitOptions);
    case "checkout": {
      const options = {
        ...waitOptions,
        ...overlayTargetOptions(target, "transactionId", "steamUrl", "url")
      };
      return overlay.openCheckoutAndWaitIfAvailable(() => {
        if (checkoutOperationState) {
          checkoutOperationState.ran = true;
        }
        return target.transactionId ?? target.steamUrl ?? target.url ?? "123456789";
      }, options);
    }
    case "dialog":
      return overlay.openDialogAndWaitIfAvailable(overlayTargetOptions(target), waitOptions);
    default:
      return overlay.openAndWaitIfAvailable(target, waitOptions);
  }
}

function duplicateOpenGuardTargets() {
  const steamId64 = activeSteamId64ForOverlayTarget();
  return {
    web: { type: "web", url: WEB_URL, modal: WEB_MODAL },
    store: { type: "store", appId: APP_ID, route: STORE_ROUTE },
    friends: { type: "friends" },
    profile: { type: "profile", steamId64 },
    players: { type: "players", steamId64 },
    community: { type: "community", appId: APP_ID },
    stats: { type: "stats", appId: APP_ID },
    achievements: { type: "achievements", appId: APP_ID },
    user: { type: "user", dialog: USER_DIALOG, appId: APP_ID },
    dialog: { type: "dialog", dialog: OVERLAY_DIALOG, appId: APP_ID },
    checkout: { type: "checkout", transactionId: "123456789" }
  };
}

function activeSteamId64ForOverlayTarget() {
  return requireClient().localplayer.getSteamId().steamId64;
}

function overlayTargetOptions(target, ...extraOmittedFields) {
  const options = { ...target };
  delete options.type;
  for (const field of extraOmittedFields) {
    delete options[field];
  }
  return options;
}

function throwIfNativeHostUnavailable(snapshot, targetContext = undefined) {
  if (!snapshot?.nativeHostUnavailableReason) {
    return;
  }
  const error = new steamworks.SteamOverlayNativeHostUnavailableError(snapshot);
  annotateSmokeOverlayTargetSnapshot(error, targetContext);
  throw error;
}

function annotateSmokeOverlayTargetSnapshot(error, targetContext) {
  const targetSnapshot = smokeOverlayTargetSnapshot(targetContext);
  if (!targetSnapshot) {
    return error;
  }
  defineSmokeErrorSnapshot(error, "targetSnapshot", targetSnapshot);
  if (targetSnapshot.type === "checkout") {
    defineSmokeErrorSnapshot(error, "checkoutTargetSnapshot", targetSnapshot);
  }
  return error;
}

function smokeOverlayTargetSnapshot(targetContext) {
  if (!targetContext || typeof targetContext !== "object") {
    return undefined;
  }
  if (targetContext.targetSnapshot && typeof targetContext.targetSnapshot === "object") {
    return targetContext.targetSnapshot;
  }
  try {
    return steamworks.overlay.snapshotSteamOverlayTarget(targetContext);
  } catch {
    return typeof targetContext.type === "string" ? { type: targetContext.type } : undefined;
  }
}

function defineSmokeErrorSnapshot(error, property, targetSnapshot) {
  if (!error || typeof error !== "object" || property in error) {
    return;
  }
  try {
    Object.defineProperty(error, property, {
      configurable: true,
      enumerable: true,
      value: targetSnapshot
    });
  } catch {
    try {
      error[property] = targetSnapshot;
    } catch {
      // Sealed error-like objects should still preserve the original failure.
    }
  }
}

function checkoutTargetFromOperation(transaction) {
  try {
    return steamworks.overlay.checkoutTargetFromResult(transaction, { expectedAppId: APP_ID });
  } catch {
    return { type: "checkout" };
  }
}

async function openPresenterFriendsOverlay() {
  const overlay = ensureElectronSteamOverlay();
  const target = { type: "friends" };
  const context = {
    target: "friends",
    url: steamworks.STEAM_FRIENDS_OVERLAY_URL,
    modal: true,
    api: "openFriends"
  };
  return openPresenterTargetOverlay(overlay, target, context);
}

async function openPresenterProfileOverlay() {
  const activeClient = requireClient();
  const overlay = ensureElectronSteamOverlay(activeClient);
  const steamId64 = activeClient.localplayer.getSteamId().steamId64;
  const target = { type: "profile", steamId64 };
  const context = {
    target: "profile",
    steamId64,
    url: steamworks.steamCommunityProfileUrl(steamId64),
    modal: true,
    api: "openProfile"
  };
  return openPresenterTargetOverlay(overlay, target, context);
}

function openPresenterProfileOpenAndWaitOverlay() {
  const activeClient = requireClient();
  const overlay = ensureElectronSteamOverlay(activeClient);
  const steamId64 = activeClient.localplayer.getSteamId().steamId64;
  const target = { type: "profile", steamId64 };
  const context = {
    target: "profile",
    steamId64,
    url: steamworks.steamCommunityProfileUrl(steamId64),
    modal: true,
    api: "openProfileAndWait"
  };
  return openPresenterTargetAndWaitOverlay(overlay, target, context);
}

async function openPresenterPlayersOverlay() {
  const activeClient = requireClient();
  const overlay = ensureElectronSteamOverlay(activeClient);
  const steamId64 = activeClient.localplayer.getSteamId().steamId64;
  const target = { type: "players", steamId64 };
  const context = {
    target: "players",
    steamId64,
    url: steamworks.steamCommunityPlayersUrl(steamId64),
    modal: true,
    api: "openPlayers"
  };
  return openPresenterTargetOverlay(overlay, target, context);
}

function openPresenterPlayersOpenAndWaitOverlay() {
  const activeClient = requireClient();
  const overlay = ensureElectronSteamOverlay(activeClient);
  const steamId64 = activeClient.localplayer.getSteamId().steamId64;
  const target = { type: "players", steamId64 };
  const context = {
    target: "players",
    steamId64,
    url: steamworks.steamCommunityPlayersUrl(steamId64),
    modal: true,
    api: "openPlayersAndWait"
  };
  return openPresenterTargetAndWaitOverlay(overlay, target, context);
}

async function openPresenterCommunityOverlay() {
  const overlay = ensureElectronSteamOverlay();
  const target = { type: "community", appId: APP_ID };
  const context = {
    target: "community",
    appId: APP_ID,
    url: steamworks.steamCommunityAppUrl(APP_ID),
    modal: true,
    api: "openCommunity"
  };
  return openPresenterTargetOverlay(overlay, target, context);
}

function openPresenterCommunityOpenAndWaitOverlay() {
  const overlay = ensureElectronSteamOverlay();
  const target = { type: "community", appId: APP_ID };
  const context = {
    target: "community",
    appId: APP_ID,
    url: steamworks.steamCommunityAppUrl(APP_ID),
    modal: true,
    api: "openCommunityAndWait"
  };
  return openPresenterTargetAndWaitOverlay(overlay, target, context);
}

async function openPresenterStatsOverlay() {
  const overlay = ensureElectronSteamOverlay();
  const target = { type: "stats", appId: APP_ID };
  const context = {
    target: "stats",
    appId: APP_ID,
    url: steamworks.steamCommunityUserStatsUrl(APP_ID),
    modal: true,
    api: "openStats"
  };
  return openPresenterTargetOverlay(overlay, target, context);
}

function openPresenterStatsOpenAndWaitOverlay() {
  const overlay = ensureElectronSteamOverlay();
  const target = { type: "stats", appId: APP_ID };
  const context = {
    target: "stats",
    appId: APP_ID,
    url: steamworks.steamCommunityUserStatsUrl(APP_ID),
    modal: true,
    api: "openStatsAndWait"
  };
  return openPresenterTargetAndWaitOverlay(overlay, target, context);
}

async function openPresenterAchievementsOverlay() {
  const overlay = ensureElectronSteamOverlay();
  const target = { type: "achievements", appId: APP_ID };
  const context = {
    target: "achievements",
    appId: APP_ID,
    url: steamworks.steamCommunityAchievementsUrl(APP_ID),
    modal: true,
    api: "openAchievements"
  };
  return openPresenterTargetOverlay(overlay, target, context);
}

function openPresenterAchievementsOpenAndWaitOverlay() {
  const overlay = ensureElectronSteamOverlay();
  const target = { type: "achievements", appId: APP_ID };
  const context = {
    target: "achievements",
    appId: APP_ID,
    url: steamworks.steamCommunityAchievementsUrl(APP_ID),
    modal: true,
    api: "openAchievementsAndWait"
  };
  return openPresenterTargetAndWaitOverlay(overlay, target, context);
}

async function openPresenterUserOverlay() {
  const overlay = ensureElectronSteamOverlay();
  const target = { type: "user", dialog: USER_DIALOG, appId: APP_ID };
  const context = {
    target: "user",
    dialog: USER_DIALOG,
    route: "auto",
    appId: APP_ID,
    api: "openUser"
  };
  return openPresenterTargetOverlay(overlay, target, context);
}

async function openPresenterNativeUserOverlay() {
  const activeClient = requireClient();
  const overlay = ensureElectronSteamOverlay(activeClient);
  const steamId64 = activeClient.localplayer.getSteamId().steamId64;
  const target = { type: "user", dialog: USER_DIALOG, route: "native", steamId64 };
  const context = {
    target: "user",
    dialog: USER_DIALOG,
    route: "native",
    steamId64,
    api: "openUser"
  };
  return openPresenterTargetOverlay(overlay, target, context);
}

function openPresenterUserOpenAndWaitOverlay() {
  const overlay = ensureElectronSteamOverlay();
  const target = { type: "user", dialog: USER_DIALOG, appId: APP_ID };
  const context = {
    target: "user",
    dialog: USER_DIALOG,
    route: "auto",
    appId: APP_ID,
    api: "openUserAndWait"
  };
  return openPresenterTargetAndWaitOverlay(overlay, target, context);
}

async function openPresenterCheckoutOverlay() {
  const activeClient = requireClient();
  const overlay = ensureElectronSteamOverlay(activeClient);
  const checkoutOperation = await readCheckoutOperationInput(activeClient);
  if (checkoutOperation) {
    const { transaction, source, initTxn } = checkoutOperation;
    const target = checkoutTargetFromOperation(transaction);
    const targetSnapshot = steamworks.overlay.snapshotSteamOverlayTarget(target);
    const clientSessionCheckout = targetSnapshot.type === "checkout" && targetSnapshot.clientSession === true;
    const context = {
      target: "checkout",
      route: "web",
      modal: true,
      api: "openCheckoutAndWait",
      checkoutSource: source,
      checkout: checkoutDiagnostic(transaction),
      targetSnapshot,
      initTxn
    };
    if (clientSessionCheckout) {
      recordEvent("checkout:client-session-wait-start", {
        ...context,
        expectedSteamPrompt: true,
        presenter: safeOverlaySnapshot(overlay)
      });
    }
    recordCheckoutOperationReadiness(overlay, context);
    const openAndWait = overlay.openCheckoutAndWait(() => transaction, {
      showTimeoutMs: MANAGED_OVERLAY_WAIT_TIMEOUT_MS,
      closeTimeoutMs: MANAGED_OVERLAY_PARK_TIMEOUT_MS
    });
    const initialSnapshot = overlay.snapshot();
    recordEvent("overlay:presenter-open", {
      ...context,
      presenter: initialSnapshot
    });
    const lifecycle = observeManagedOverlayLifecycle(overlay, context);
    pendingManagedOverlayShownWait = lifecycle.shown;
    pendingManagedOverlayLifecycle = lifecycle;
    pendingManagedOverlayCompletionWait = openAndWait
      .then((result) => {
        recordEvent("overlay:presenter-checkout-open-and-wait-complete", {
          ...context,
          resolvedTarget: checkoutDiagnostic(result.target),
          targetSnapshot: result.targetSnapshot,
          shown: result.shown,
          parked: result.parked,
          presenter: safeOverlaySnapshot(overlay)
        });
        return { ok: true, result };
      })
      .catch((error) => {
        const serialized = serializeError(error);
        if (!shutdownComplete) {
          if (clientSessionCheckout && isSteamOverlayWaitTimeout(serialized)) {
            recordEvent("checkout:client-session-prompt-missing", {
              ...context,
              expectedSteamPrompt: true,
              error: serialized,
              presenter: safeOverlaySnapshot(overlay)
            });
          }
          recordEvent("overlay:presenter-checkout-open-and-wait:error", {
            ...context,
            error: serialized,
            presenter: safeOverlaySnapshot(overlay)
          });
        }
        return { ok: false, error: serialized };
      });
    throwIfNativeHostUnavailable(initialSnapshot, target);
  } else {
    await overlay.withCheckoutPrepared(() => {
      recordEvent("overlay:presenter-checkout-ready", {
        target: "checkout",
        note: "set STEAM_BRIDGE_SMOKE_CHECKOUT_URL or STEAM_BRIDGE_SMOKE_CHECKOUT_TRANSACTION_ID to open checkout",
        presenter: overlay.snapshot()
      });
    });
  }
  return snapshot();
}

function isSteamOverlayWaitTimeout(error) {
  return Boolean(
    error &&
      typeof error === "object" &&
      (error.code === "STEAM_OVERLAY_WAIT_TIMEOUT" || error.name === "SteamOverlayWaitTimeoutError")
  );
}

async function readCheckoutOperationInput(activeClient) {
  if (INIT_TXN_REQUEST_FILE) {
    const { transaction, initTxn } = await captureInitTxnCheckout(activeClient);
    return {
      source: "init-txn-request-file",
      transaction,
      initTxn
    };
  }

  return readStaticCheckoutOperationInput();
}

function readStaticCheckoutOperationInput() {
  if (CHECKOUT_JSON_FILE) {
    const transaction = readJsonFile(CHECKOUT_JSON_FILE);
    return {
      source: "json-file",
      transaction
    };
  }

  if (!CHECKOUT_URL && !CHECKOUT_TRANSACTION_ID) {
    return null;
  }

  const transactionParams = {
    steamurl: CHECKOUT_URL || undefined,
    transid: CHECKOUT_URL ? undefined : CHECKOUT_TRANSACTION_ID,
    returnurl: CHECKOUT_RETURN_URL || undefined
  };
  return {
    source: CHECKOUT_URL ? "checkout-url" : "transaction-id",
    transaction: {
      response: {
        result: "OK",
        params: transactionParams
      }
    }
  };
}

async function captureInitTxnCheckout(activeClient) {
  if (APP_ID === 480) {
    throw new Error("Private InitTxn checkout proof requires a configured Steam app/product.");
  }
  const apiKeyEnv = INIT_TXN_API_KEY_ENV || "STEAM_WEB_API_KEY";
  const apiKey = process.env[apiKeyEnv] || (!INIT_TXN_API_KEY_ENV ? process.env.STEAM_API_KEY : "");
  if (!apiKey) {
    throw new Error("Missing Steam publisher Web API key environment variable for private InitTxn checkout.");
  }

  const request = readJsonFile(INIT_TXN_REQUEST_FILE);
  const session = normalizeInitTxnRequestSession(request.session ?? request.userSession ?? request.usersession);
  const {
    sandbox: _sandbox,
    session: _session,
    userSession: _userSession,
    usersession: _usersession,
    ...requestBody
  } = request;
  const steamId64 = readActiveSteamId64(activeClient);
  const initTxnRequest = {
    ...requestBody,
    appId: APP_ID,
    steamId64
  };
  const endpoint = normalizeInitTxnEndpoint(INIT_TXN_ENDPOINT || (request.sandbox === false ? "production" : "sandbox"));
  const requestShape = initTxnRequestShape(initTxnRequest, session);
  const webClient = steamworks.createSteamWebApiClient({ apiKey });
  const facade = endpoint === "production" ? webClient.microTxn : webClient.microTxnSandbox;
  recordEvent("checkout:init-txn-request-shape", {
    endpoint,
    session,
    requestShape
  });
  const response =
    session === "web"
      ? await facade.initWebTxn(initTxnRequest)
      : session === "client-default"
        ? await facade.initTxn(initTxnRequest)
        : await facade.initClientTxn(initTxnRequest);

  if (!response.ok) {
    throw new Error("Steam InitTxn Web API request failed.");
  }

  const transaction =
    session === "web"
      ? response.data
      : {
          clientSession: true,
          data: response.data
        };

  let target;
  try {
    target = steamworks.overlay.checkoutTargetFromResult(transaction, { expectedAppId: APP_ID });
  } catch (error) {
    recordEvent("checkout:init-txn-target-missing", {
      endpoint,
      session,
      httpStatus: response.status,
      usedCurrentSteamId: Boolean(steamId64),
      requestShape,
      failure: initTxnFailureDiagnostic(response.data)
    });
    throw new Error(`Steam InitTxn response did not include a checkout target (${summarizeInitTxnFailure(response.data)}).`);
  }

  const targetSnapshot = steamworks.overlay.snapshotSteamOverlayTarget(target);
  recordEvent("checkout:init-txn-captured", {
    endpoint,
    session,
    httpStatus: response.status,
    appId: APP_ID,
    usedCurrentSteamId: Boolean(steamId64),
    requestShape,
    targetSnapshot
  });
  return {
    transaction,
    initTxn: {
      endpoint,
      session,
      httpStatus: response.status,
      usedCurrentSteamId: Boolean(steamId64),
      requestShape
    }
  };
}

function normalizeInitTxnRequestSession(value) {
  const session = String(value || "").trim().toLowerCase();
  if (session === "web") {
    return "web";
  }
  if (session === "client-default" || session === "default-client" || session === "default") {
    return "client-default";
  }
  return "client";
}

function readActiveSteamId64(activeClient) {
  const steamId = activeClient.localplayer.getSteamId();
  const steamId64 = steamId && steamId.steamId64;
  if (!steamId64) {
    throw new Error("Unable to read the active Steam ID for private InitTxn checkout.");
  }
  return String(steamId64);
}

function initTxnRequestShape(request, session) {
  const items = Array.isArray(request.items) ? request.items : [];
  const bundles = Array.isArray(request.bundles) ? request.bundles : [];
  return {
    usersession: session === "client-default" ? "omitted" : session,
    hasUserSessionField: session !== "client-default",
    hasOrderId: hasAnyPresentField(request, ["orderId", "orderid"]),
    hasSteamId64: hasAnyPresentField(request, ["steamId64", "steamid", "steamId"]),
    hasLanguage: hasAnyPresentField(request, ["language"]),
    hasCurrency: hasAnyPresentField(request, ["currency"]),
    hasIpAddress: Boolean(request.ipAddress),
    itemCount: items.length,
    bundleCount: bundles.length,
    itemsHaveRequiredFields: items.length > 0 && items.every(initTxnItemHasRequiredFields),
    bundlesHaveRequiredFields: bundles.every(initTxnBundleHasRequiredFields)
  };
}

function initTxnItemHasRequiredFields(item) {
  return (
    item &&
    typeof item === "object" &&
    !Array.isArray(item) &&
    hasAnyPresentField(item, ["itemId", "itemid"]) &&
    hasAnyPresentField(item, ["quantity", "qty"]) &&
    hasAnyPresentField(item, ["amount"]) &&
    hasAnyPresentField(item, ["description"])
  );
}

function initTxnBundleHasRequiredFields(bundle) {
  return (
    bundle &&
    typeof bundle === "object" &&
    !Array.isArray(bundle) &&
    hasAnyPresentField(bundle, ["bundleId", "bundleid"]) &&
    hasAnyPresentField(bundle, ["quantity", "qty"]) &&
    hasAnyPresentField(bundle, ["description"])
  );
}

function hasAnyPresentField(source, names) {
  return names.some((name) => {
    const value = source[name];
    return value !== undefined && value !== null && String(value).trim() !== "";
  });
}

function summarizeInitTxnFailure(data) {
  const failure = initTxnFailureDiagnostic(data);
  return `result=${failure.result} errorCode=${failure.errorCode}`;
}

function initTxnFailureDiagnostic(data) {
  const response = data && typeof data === "object" ? data.response : undefined;
  const result = response && typeof response === "object" ? response.result : undefined;
  const error = response && typeof response === "object" ? response.error : undefined;
  const errorCode = error && typeof error === "object" ? error.errorcode : undefined;
  const errorDescription = error && typeof error === "object" ? error.errordesc : undefined;
  return {
    result: String(result || "unknown"),
    errorCode: String(errorCode || "unknown"),
    hasErrorDescription: typeof errorDescription === "string" && errorDescription.length > 0
  };
}

function normalizeInitTxnEndpoint(value) {
  const endpoint = String(value || "").trim().toLowerCase();
  if (!endpoint || endpoint === "sandbox") {
    return "sandbox";
  }
  if (endpoint === "production") {
    return "production";
  }
  throw new Error("Unsupported InitTxn endpoint; expected sandbox or production.");
}

function readJsonFile(filePath) {
  const text = fs.readFileSync(filePath, "utf8");
  return JSON.parse(text.replace(/^\uFEFF/, ""));
}

function checkoutDiagnostic(target) {
  const source = findCheckoutDiagnosticSource(target);
  return {
    hasCheckoutUrl: Boolean(source && (source.steamUrl || source.steamurl || source.url)),
    hasTransactionId: Boolean(source && (source.transactionId || source.transactionID || source.transid)),
    clientSession: Boolean(target && typeof target === "object" && target.clientSession === true),
    hasReturnUrl: Boolean(source && (source.returnUrl || source.returnurl)),
    modal: source && typeof source.modal === "boolean" ? source.modal : true
  };
}

function findCheckoutDiagnosticSource(value, seen = new Set(), depth = 0) {
  if (!value || typeof value !== "object" || Array.isArray(value) || seen.has(value) || depth > 8) {
    return undefined;
  }

  seen.add(value);
  if (hasCheckoutDiagnosticFields(value)) {
    return value;
  }

  for (const key of ["data", "response", "params"]) {
    const source = findCheckoutDiagnosticSource(value[key], seen, depth + 1);
    if (source) {
      return source;
    }
  }

  return undefined;
}

function hasCheckoutDiagnosticFields(value) {
  return [
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

function openPresenterAchievementProgress() {
  const activeClient = requireClient();
  const overlay = ensureElectronSteamOverlay(activeClient);
  const presenter = overlay.presenter;

  recordEvent("achievement:progress", {
    ...runAchievementProgressSmoke(activeClient),
    presenter: presenter.snapshot()
  });
  return snapshot();
}

function openPresenterAchievementUnlock() {
  const activeClient = requireClient();
  const overlay = ensureElectronSteamOverlay(activeClient);
  const presenter = overlay.presenter;

  recordEvent("achievement:unlock", {
    ...runAchievementUnlockSmoke(activeClient),
    presenter: presenter.snapshot()
  });
  return snapshot();
}

function runAchievementProgressSmoke(activeClient) {
  const candidates = resolveAchievementProgressTargets(activeClient);
  const attempts = [];

  for (const target of candidates) {
    const progressSetup = prepareAchievementProgressTarget(activeClient, target.name, target.unlocked);
    const indicated = activeClient.achievement.indicateProgress(target.name, target.current, target.max);
    const attempt = {
      name: target.name,
      current: target.current,
      max: target.max,
      unlocked: target.unlocked,
      ...progressSetup,
      indicated
    };
    attempts.push(attempt);

    if (!indicated) {
      continue;
    }

    return {
      ...target,
      availableNames: candidates.map((candidate) => candidate.name),
      ...progressSetup,
      indicated,
      attempts
    };
  }

  recordEvent("achievement:progress", {
    configuredName: ACHIEVEMENT_NAME.trim() || null,
    availableNames: candidates.map((candidate) => candidate.name),
    attempts,
    indicated: false
  });
  throw new Error("Steam did not accept achievement progress for any available smoke achievement.");
}

function runAchievementUnlockSmoke(activeClient) {
  const target = resolveAchievementUnlockTarget(activeClient);
  const cleared = activeClient.achievement.clear(target.name);
  const clearStored = activeClient.stats.store();
  const activated = activeClient.achievement.activate(target.name);
  const unlockStored = activeClient.stats.store();
  return {
    ...target,
    cleared,
    clearStored,
    activated,
    unlockStored
  };
}

function openPresenterShortcutBridge() {
  const overlay = ensureElectronSteamOverlay();
  if (MANAGED_OVERLAY_RESULT_MODE === "complete") {
    const lifecycle = waitForNextShortcutOpenLifecycle(overlay, {
      target: "shortcut",
      shortcut: "Shift+Tab",
      shortcutTarget: SHORTCUT_TARGET
    });
    pendingManagedOverlayShownWait = lifecycle.then((observed) => observed.shown);
    pendingManagedOverlayLifecycle = {
      closed: lifecycle.then((observed) => observed.closed),
      parked: lifecycle.then((observed) => observed.parked)
    };
    pendingManagedOverlayCompletionWait = Promise.resolve({ ok: true });
  }
  recordEvent("overlay:presenter-shortcut-ready", {
    target: SHORTCUT_TARGET,
    shortcut: "Shift+Tab",
    presenter: overlay.snapshot()
  });
  return snapshot();
}

function getPresenterShortcutOpenStatus() {
  const overlay = ensureElectronSteamOverlay();
  const status = overlay.getShortcutOpenStatus();
  recordEvent("overlay:presenter-shortcut-status", {
    target: SHORTCUT_TARGET,
    status,
    presenter: overlay.snapshot()
  });
  return sanitize({
    status,
    snapshot: snapshot()
  });
}

function openPresenterShortcutTargetBridge() {
  const overlay = ensureElectronSteamOverlay();
  const status = overlay.getShortcutOpenStatus();
  const presenter = withManagedShortcutOpenSource("openShortcutTarget", () => overlay.openShortcutTarget());
  recordEvent("overlay:presenter-shortcut-open", {
    target: "shortcut",
    shortcut: "openShortcutTarget",
    shortcutTarget: SHORTCUT_TARGET,
    opened: Boolean(presenter),
    status,
    presenter: safeOverlaySnapshot(overlay)
  });
  return snapshot();
}

function openPresenterShortcutOpenAndWaitBridge() {
  const overlay = ensureElectronSteamOverlay();
  const context = {
    target: "shortcut",
    shortcut: "openShortcutTargetAndWait",
    shortcutTarget: SHORTCUT_TARGET,
    api: "openShortcutTargetAndWait"
  };
  const lifecycle = observeManagedOverlayLifecycle(overlay, context);
  pendingManagedOverlayShownWait = lifecycle.shown;
  pendingManagedOverlayLifecycle = lifecycle;
  const openAndWait = withManagedShortcutOpenSource("openShortcutTargetAndWait", () =>
    overlay.openShortcutTargetAndWait({
      showTimeoutMs: MANAGED_OVERLAY_WAIT_TIMEOUT_MS,
      closeTimeoutMs: MANAGED_OVERLAY_PARK_TIMEOUT_MS
    })
  );
  const initialSnapshot = overlay.snapshot();
  recordEvent("overlay:presenter-open-and-wait-start", {
    ...context,
    presenter: initialSnapshot
  });

  pendingManagedOverlayCompletionWait = openAndWait
    .then((result) => {
      if (!result) {
        recordEvent("overlay:presenter-open-and-wait-skipped", {
          ...context,
          presenter: safeOverlaySnapshot(overlay)
        });
        return { ok: false, skipped: true };
      }
      recordEvent("overlay:presenter-open-and-wait-complete", {
        ...context,
        shown: result.shown,
        parked: result.parked,
        presenter: safeOverlaySnapshot(overlay)
      });
      return { ok: true, result };
    })
    .catch((error) => {
      const serialized = serializeError(error);
      if (!shutdownComplete) {
        recordEvent("overlay:presenter-open-and-wait:error", {
          ...context,
          error: serialized,
          presenter: safeOverlaySnapshot(overlay)
        });
      }
      return { ok: false, error: serialized };
    });

  throwIfNativeHostUnavailable(initialSnapshot, overlay.getShortcutOpenStatus());
  return snapshot();
}

function withManagedShortcutOpenSource(source, callback) {
  const previous = managedShortcutOpenSource;
  managedShortcutOpenSource = source;
  try {
    return callback();
  } finally {
    managedShortcutOpenSource = previous;
  }
}

function ensureElectronSteamOverlay(activeClient = requireClient()) {
  if (electronSteamOverlay && electronSteamOverlay.isOpen()) {
    return electronSteamOverlay;
  }

  closeNativeOverlaySession();
  const shortcutTarget = resolveInitialShortcutOverlayTarget();
  electronSteamOverlay = activeClient.overlay.createElectronSteamOverlay(requireMainWindow(), {
    title: "Steam Bridge Overlay Presenter",
    presenterMode: PRESENTER_MODE || undefined,
    needsPresentFps: 30,
    activeOverlayFps: 30,
    pollIntervalMs: 250,
    overlayShortcut: {
      target: shortcutTarget,
      onOpen: (target) => {
        recordEvent("overlay:shortcut-open", {
          shortcut: managedShortcutOpenSource,
          target: SHORTCUT_TARGET,
          overlayTarget: target
        });
        if (electronSteamOverlay && electronSteamOverlay.isOpen()) {
          observeShortcutOpenLifecycle(electronSteamOverlay, {
            target: "shortcut",
            shortcut: managedShortcutOpenSource,
            shortcutTarget: SHORTCUT_TARGET,
            overlayTarget: target
          });
        }
      },
      onError: (error) => {
        recordEvent("overlay:shortcut-open:error", serializeError(error));
      }
    }
  });
  recordEvent("overlay:presenter-attach", {
    presenterMode: EFFECTIVE_PRESENTER_MODE,
    configuredPresenterMode: PRESENTER_MODE || null,
    presenter: electronSteamOverlay.snapshot()
  });
  return electronSteamOverlay;
}

function resolveInitialShortcutOverlayTarget() {
  if (CONTROL_SERVER_ENABLED) {
    return () => resolveShortcutOverlayTarget();
  }

  try {
    return resolveShortcutOverlayTarget();
  } catch {
    return () => resolveShortcutOverlayTarget();
  }
}

function resolveShortcutOverlayTarget() {
  const target = String(SHORTCUT_TARGET || "friends").trim().toLowerCase();
  switch (target) {
    case "friends":
      return { type: "friends" };
    case "web":
      return { type: "web", url: WEB_URL, modal: WEB_MODAL };
    case "store":
      return { type: "store", appId: APP_ID, route: STORE_ROUTE };
    case "profile":
      return { type: "profile", steamId64: activeSteamId64ForOverlayTarget() };
    case "players":
      return { type: "players", steamId64: activeSteamId64ForOverlayTarget() };
    case "community":
      return { type: "community", appId: APP_ID };
    case "stats":
      return { type: "stats", appId: APP_ID };
    case "achievements":
      return { type: "achievements", appId: APP_ID };
    case "user":
      return { type: "user", dialog: USER_DIALOG, appId: APP_ID };
    case "dialog":
      return { type: "dialog", dialog: OVERLAY_DIALOG, appId: APP_ID };
    case "checkout":
      {
        if (INIT_TXN_REQUEST_FILE) {
          throw new Error("Shortcut checkout target does not support in-app InitTxn request files.");
        }
        const checkoutOperation = readStaticCheckoutOperationInput();
        if (!checkoutOperation) {
          throw new Error("Shortcut checkout target requires a checkout URL, transaction ID, or JSON file.");
        }
        return steamworks.overlay.checkoutTargetFromResult(checkoutOperation.transaction, { expectedAppId: APP_ID });
      }
    default:
      throw new Error(`Unsupported shortcut target: ${SHORTCUT_TARGET}`);
  }
}

function nativeOverlayOptions() {
  const window = requireMainWindow();
  return steamworks.electronNativeOverlaySessionOptions(window, {
    title: "Steam Bridge Native Overlay",
    restoreFocusDelayMs: 0
  });
}

function resolveAchievementProgressTargets(activeClient) {
  const names = readValue(() => activeClient.achievement.names());
  const achievementNames = Array.isArray(names.value) ? names.value.filter(Boolean) : [];
  const configuredName = ACHIEVEMENT_NAME.trim();
  const targetNames = configuredName ? [configuredName] : orderProgressAchievementNames(activeClient, achievementNames);
  const targets = targetNames.map((name) => readAchievementProgressTarget(activeClient, name, configuredName));
  if (targets.length === 0) {
    throw new Error("No Steam achievement is available for the smoke toast action.");
  }

  return targets;
}

function readAchievementProgressTarget(activeClient, name, configuredName) {
  const limits = readValue(() => activeClient.achievement.getProgressLimitsInt(name));
  const limitValue = limits.value && typeof limits.value === "object" ? limits.value : undefined;
  const defaultMax = limitValue && Number.isFinite(limitValue.max) && limitValue.max > 1 ? limitValue.max : 2;
  const max = Math.max(2, normalizePositiveInteger(ACHIEVEMENT_MAX, defaultMax));
  const defaultCurrent = Math.max(
    1,
    Math.min(max - 1, limitValue && Number.isFinite(limitValue.min) ? limitValue.min + 1 : 1)
  );
  const current = Math.min(max - 1, normalizePositiveInteger(ACHIEVEMENT_CURRENT, defaultCurrent));

  return {
    name,
    configuredName: configuredName || null,
    current,
    max,
    limits,
    displayName: readValue(() => activeClient.achievement.getDisplayAttribute(name, "name")),
    hidden: readValue(() => activeClient.achievement.getDisplayAttribute(name, "hidden")),
    unlocked: readValue(() => activeClient.achievement.getAndUnlockTime(name))
  };
}

function resolveAchievementUnlockTarget(activeClient) {
  const names = readValue(() => activeClient.achievement.names());
  const achievementNames = Array.isArray(names.value) ? names.value.filter(Boolean) : [];
  const configuredName = ACHIEVEMENT_NAME.trim();
  const name = configuredName || achievementNames[0] || "";
  if (!name) {
    throw new Error("No Steam achievement is available for the smoke unlock action.");
  }

  return {
    name,
    configuredName: configuredName || null,
    availableNames: achievementNames,
    beforeUnlock: readValue(() => activeClient.achievement.getAndUnlockTime(name)),
    displayName: readValue(() => activeClient.achievement.getDisplayAttribute(name, "name")),
    hidden: readValue(() => activeClient.achievement.getDisplayAttribute(name, "hidden"))
  };
}

function prepareAchievementProgressTarget(activeClient, name, unlocked) {
  if (!isAchievementAchieved(unlocked)) {
    return {
      wasUnlocked: false,
      clearedForProgress: false
    };
  }

  const cleared = activeClient.achievement.clear(name);
  const clearStored = activeClient.stats.store();
  return {
    wasUnlocked: true,
    clearedForProgress: cleared,
    clearStoredForProgress: clearStored,
    unlockedAfterClear: readValue(() => activeClient.achievement.getAndUnlockTime(name))
  };
}

function orderProgressAchievementNames(activeClient, achievementNames) {
  return achievementNames
    .map((name, index) => {
      const limits = readValue(() => activeClient.achievement.getProgressLimitsInt(name));
      const unlocked = readValue(() => activeClient.achievement.getAndUnlockTime(name));
      const limitValue = limits.value && typeof limits.value === "object" ? limits.value : undefined;
      return {
        name,
        index,
        unlocked,
        hasProgressLimits: Boolean(
          limits.ok && limitValue && Number.isFinite(limitValue.max) && limitValue.max > 1
        )
      };
    })
    .sort((left, right) => {
      const achievedSort = Number(isAchievementAchieved(left.unlocked)) - Number(isAchievementAchieved(right.unlocked));
      if (achievedSort !== 0) {
        return achievedSort;
      }
      const limitSort = Number(right.hasProgressLimits) - Number(left.hasProgressLimits);
      if (limitSort !== 0) {
        return limitSort;
      }
      return left.index - right.index;
    })
    .map((entry) => entry.name);
}

function isAchievementAchieved(unlocked) {
  return Boolean(unlocked && unlocked.ok && unlocked.value && unlocked.value.achieved === true);
}

function normalizePositiveInteger(value, fallback) {
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : fallback;
}

function pumpNativeProbe() {
  if (electronSteamOverlay) {
    electronSteamOverlay.pump();
  } else if (nativeOverlaySession) {
    nativeOverlaySession.pump();
  } else {
    requireClient().overlay.pumpNativeOverlayProbeWindow();
  }
  return snapshot();
}

function closeNativeProbe() {
  closeNativeOverlayPresenter();
  closeNativeOverlaySession();
  recordEvent("overlay:native-session-close", {});
  return snapshot();
}

function closeNativeOverlayPresenter() {
  if (electronSteamOverlay) {
    try {
      electronSteamOverlay.close();
      recordEvent("overlay:presenter-close", {});
    } catch (error) {
      recordEvent("overlay:presenter-close:error", serializeError(error));
    }
  }
  electronSteamOverlay = undefined;
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
      overlayScrubChildEnv: OVERLAY_CONFIG.scrubSteamOverlayChildProcessEnv,
      overlayIsolateChildProcesses: OVERLAY_CONFIG.isolateSteamOverlayChildProcesses,
      overlayInProcessGpu: OVERLAY_CONFIG.switches.includes("in-process-gpu"),
      overlayDisableDirectComposition: OVERLAY_CONFIG.disableDirectComposition,
      overlayConfig: OVERLAY_CONFIG,
      nativeHostBackend: MAC_NATIVE_HOST_BACKEND || WINDOWS_NATIVE_HOST_BACKEND || null,
      windowMode: WINDOW_MODE,
      autorun: AUTORUN,
      autorunAction: AUTORUN_ACTION,
      autorunRequireOverlayActive: AUTORUN_REQUIRE_OVERLAY_ACTIVE,
      autorunKeepOpenAfterResult: AUTORUN_KEEP_OPEN_AFTER_RESULT,
      managedOverlayResultMode: MANAGED_OVERLAY_RESULT_MODE,
      autorunResultFile: AUTORUN_RESULT_FILE || null,
      diagnosticDir: DIAGNOSTIC_DIR,
      lifecycleLogFile: LIFECYCLE_LOG_FILE,
      crashDumpDir: CRASH_DUMP_DIR,
      crashReporterStarted: crashReporterStarted(),
      storeUrl: STORE_URL,
      storeRoute: STORE_ROUTE,
      webUrl: WEB_URL,
      webModal: WEB_MODAL,
      overlayDialog: OVERLAY_DIALOG,
      userDialog: USER_DIALOG,
      shortcutTarget: SHORTCUT_TARGET,
      hasInitTxnRequestFile: Boolean(INIT_TXN_REQUEST_FILE),
      hasInitTxnApiKeyEnv: Boolean(INIT_TXN_API_KEY_ENV),
      initTxnEndpoint: INIT_TXN_ENDPOINT || null,
      presenterMode: EFFECTIVE_PRESENTER_MODE,
      configuredPresenterMode: PRESENTER_MODE || null,
      disableElectronOverlayPresenter: DISABLE_ELECTRON_OVERLAY_PRESENTER,
      achievementName: ACHIEVEMENT_NAME || null,
      achievementCurrent: ACHIEVEMENT_CURRENT,
      achievementMax: ACHIEVEMENT_MAX,
      smokeEnvFile: CLI_OPTIONS.smokeEnvFile || process.env.STEAM_BRIDGE_SMOKE_ENV_FILE || null,
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
    crashDiagnostics: collectCrashDiagnostics(),
    overlayProcesses: collectOverlayProcessSnapshot(),
    steam: {
      initialized: Boolean(client),
      initError
    },
    events: eventLog.slice(-80)
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
      overlayNeedsPresentPollingEnabled: readValue(() => client.utils.isOverlayNeedsPresentPollingEnabled()),
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
      nativeSession: readValue(() => (nativeOverlaySession ? nativeOverlaySession.snapshot() : null)),
      nativePresenter: readValue(() => (electronSteamOverlay ? electronSteamOverlay.snapshot() : null)),
      nativeHostAvailability: readValue(() =>
        electronSteamOverlay ? electronSteamOverlay.getNativeHostAvailability() : null
      ),
      openStatuses: readValue(() =>
        electronSteamOverlay && electronSteamOverlay.isOpen() ? collectManagedOverlayOpenStatuses(electronSteamOverlay) : null
      ),
      shortcutStatus: readValue(() =>
        electronSteamOverlay && electronSteamOverlay.isOpen() ? electronSteamOverlay.getShortcutOpenStatus() : null
      )
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
      overlayDialogFriends: client.overlay.Dialog.Friends,
      overlayUserDialogSteamId: client.overlay.UserDialog.SteamId
    }
  });
}

function collectManagedOverlayOpenStatuses(overlay) {
  return {
    web: readValue(() => overlay.getWebOpenStatus(WEB_URL, { modal: WEB_MODAL })),
    store: readValue(() => overlay.getStoreOpenStatus({ appId: APP_ID })),
    friends: readValue(() => overlay.getFriendsOpenStatus()),
    profile: readValue(() => overlay.getProfileOpenStatus()),
    players: readValue(() => overlay.getPlayersOpenStatus()),
    community: readValue(() => overlay.getCommunityOpenStatus({ appId: APP_ID })),
    stats: readValue(() => overlay.getStatsOpenStatus({ appId: APP_ID })),
    achievements: readValue(() => overlay.getAchievementsOpenStatus({ appId: APP_ID })),
    user: readValue(() => overlay.getUserOpenStatus({ dialog: USER_DIALOG, appId: APP_ID })),
    dialog: readValue(() => overlay.getDialogOpenStatus({ dialog: OVERLAY_DIALOG, appId: APP_ID })),
    checkout: readValue(() =>
      overlay.getCheckoutOpenStatus({
        ...(CHECKOUT_URL ? { url: CHECKOUT_URL } : {}),
        ...(CHECKOUT_TRANSACTION_ID ? { transactionId: CHECKOUT_TRANSACTION_ID } : {}),
        ...(CHECKOUT_RETURN_URL ? { returnUrl: CHECKOUT_RETURN_URL } : {})
      })
    ),
    checkoutOperation: readValue(() => overlay.getCheckoutOperationStatus())
  };
}

function collectCrashDiagnostics() {
  const crashDumpSnapshot = collectCrashDumpSnapshot(CRASH_DUMP_DIR);
  const lifecycleSnapshot = collectFatalLifecycleSnapshot(LIFECYCLE_LOG_FILE);
  const available = crashDumpSnapshot.available && lifecycleSnapshot.available;
  const crashDumps = crashDumpSnapshot.crashDumps;
  const fatalLifecycleEvents = lifecycleSnapshot.fatalLifecycleEvents;

  return {
    available,
    ok: available && crashDumps.length === 0 && fatalLifecycleEvents.length === 0,
    crashDumpDir: CRASH_DUMP_DIR,
    lifecycleLogFile: LIFECYCLE_LOG_FILE,
    crashDumps,
    fatalLifecycleEvents,
    crashDumpFiles: crashDumpSnapshot.files,
    errors: [...crashDumpSnapshot.errors, ...lifecycleSnapshot.errors]
  };
}

function collectCrashDumpSnapshot(rootDir) {
  const files = [];
  const crashDumps = [];
  const errors = [];

  visitCrashDumpDir(rootDir, "");

  return {
    available: errors.length === 0,
    files: files.slice(0, 100),
    crashDumps: crashDumps.slice(0, 100),
    errors
  };

  function visitCrashDumpDir(currentDir, relativeDir) {
    let entries;
    try {
      entries = fs.readdirSync(currentDir, { withFileTypes: true });
    } catch (error) {
      if (error && error.code === "ENOENT") {
        return;
      }
      errors.push({ path: currentDir, error: serializeError(error) });
      return;
    }

    for (const entry of entries) {
      const relativePath = relativeDir ? path.join(relativeDir, entry.name) : entry.name;
      const fullPath = path.join(currentDir, entry.name);
      if (entry.isDirectory()) {
        visitCrashDumpDir(fullPath, relativePath);
        continue;
      }
      if (!entry.isFile()) {
        continue;
      }

      const file = crashDiagnosticFileSnapshot(fullPath, relativePath);
      files.push(file);
      if (isCrashDumpFile(relativePath)) {
        crashDumps.push(file);
      }
    }
  }
}

function crashDiagnosticFileSnapshot(fullPath, relativePath) {
  const file = {
    path: relativePath
  };
  try {
    const stats = fs.statSync(fullPath);
    file.size = stats.size;
    file.modifiedAt = stats.mtime.toISOString();
  } catch (error) {
    file.statError = serializeError(error);
  }
  return file;
}

function isCrashDumpFile(relativePath) {
  const normalized = String(relativePath).replace(/\\/g, "/").toLowerCase();
  return (
    normalized.endsWith(".dmp") ||
    normalized.endsWith(".mdmp") ||
    normalized.endsWith(".dump") ||
    normalized.endsWith(".crash")
  );
}

function collectFatalLifecycleSnapshot(logFile) {
  const fatalLifecycleEvents = [];
  const errors = [];

  let text;
  try {
    text = fs.readFileSync(logFile, "utf8");
  } catch (error) {
    if (error && error.code === "ENOENT") {
      return {
        available: true,
        fatalLifecycleEvents,
        errors
      };
    }
    return {
      available: false,
      fatalLifecycleEvents,
      errors: [{ path: logFile, error: serializeError(error) }]
    };
  }

  for (const line of text.split(/\r?\n/)) {
    if (!line.trim()) {
      continue;
    }

    let entry;
    try {
      entry = JSON.parse(line);
    } catch (error) {
      errors.push({ path: logFile, error: serializeError(error), line: line.slice(0, 200) });
      continue;
    }

    if (entry && FATAL_LIFECYCLE_EVENT_TYPES.has(entry.type)) {
      fatalLifecycleEvents.push(entry);
    }
  }

  return {
    available: errors.length === 0,
    fatalLifecycleEvents: fatalLifecycleEvents.slice(-100),
    errors
  };
}

function collectOverlayProcessSnapshot() {
  if (process.platform !== "linux" && process.platform !== "darwin") {
    return {
      available: false,
      reason: "unsupported-platform",
      platform: process.platform,
      gameoverlayui: []
    };
  }

  try {
    const entries =
      process.platform === "darwin" ? collectMacOverlayProcesses() : collectLinuxOverlayProcesses();
    return {
      available: true,
      platform: process.platform,
      ...(process.platform === "darwin" ? { macWindows: collectMacWindowSnapshot() } : {}),
      gameoverlayui: entries
    };
  } catch (error) {
    if (error && error.status === 1) {
      return {
        available: true,
        platform: process.platform,
        ...(process.platform === "darwin" ? { macWindows: collectMacWindowSnapshot() } : {}),
        gameoverlayui: []
      };
    }
    return {
      available: false,
      reason: "pgrep-failed",
      error: serializeError(error),
      gameoverlayui: []
    };
  }
}

function collectLinuxOverlayProcesses() {
  const output = execFileSync("pgrep", ["-af", "gameoverlayui"], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
    timeout: 1000
  });
  return output
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map(parseOverlayProcessLine)
    .filter(Boolean);
}

function collectMacOverlayProcesses() {
  try {
    return collectMacOverlayProcessesWithPgrep();
  } catch (error) {
    if (error && error.status === 1) {
      return [];
    }
    if (!error || error.code !== "ENOENT") {
      throw error;
    }
  }

  return collectMacOverlayProcessesWithPsScan();
}

function collectMacOverlayProcessesWithPgrep() {
  const pidOutput = execFileSync("pgrep", ["-if", "gameoverlayui"], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
    timeout: 1000
  });
  const pids = [
    ...new Set(
      pidOutput
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter((line) => /^\d+$/.test(line))
    )
  ];

  if (pids.length === 0) {
    return [];
  }

  const output = execFileSync("ps", ["-p", pids.join(","), "-o", "pid=,command="], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
    timeout: 1000
  });
  return parseOverlayProcessSnapshotOutput(output);
}

function collectMacOverlayProcessesWithPsScan() {
  const output = execFileSync("ps", ["-axo", "pid=,command="], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
    timeout: 1000
  });
  return parseOverlayProcessSnapshotOutput(output);
}

function parseOverlayProcessSnapshotOutput(output) {
  return output
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => /gameoverlayui/i.test(line))
    .map(parseOverlayProcessLine)
    .filter(Boolean);
}

function collectMacWindowSnapshot() {
  try {
    const raw = typeof steamworks.getMacWindowSnapshot === "function" ? steamworks.getMacWindowSnapshot(APP_ID) : "";
    if (!raw) {
      return { available: true, appId: APP_ID, windows: [] };
    }
    return { available: true, ...JSON.parse(raw) };
  } catch (error) {
    return { available: false, appId: APP_ID, error: serializeError(error), windows: [] };
  }
}

function parseOverlayProcessLine(line) {
  const match = /^(\d+)\s+(.*)$/.exec(line);
  if (!match) {
    return undefined;
  }

  const command = match[2];
  return {
    pid: Number(match[1]),
    targetPid: readCommandNumberArg(command, "-pid"),
    gameId: readCommandStringArg(command, "-gameid"),
    command
  };
}

function readCommandNumberArg(command, name) {
  const value = readCommandStringArg(command, name);
  if (!value || !/^\d+$/.test(value)) {
    return undefined;
  }
  return Number(value);
}

function readCommandStringArg(command, name) {
  const pattern = new RegExp(`${escapeRegExp(name)}(?:=|\\s+)(\\S+)`);
  const match = pattern.exec(command);
  return match ? match[1] : undefined;
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
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

function requireMainWindow() {
  if (!mainWindow || mainWindow.isDestroyed()) {
    throw new Error("Steam Bridge smoke window is not available");
  }
  return mainWindow;
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

function writeSmokeResultLine(line, resultFile = AUTORUN_RESULT_FILE) {
  if (!resultFile) {
    return;
  }

  try {
    fs.mkdirSync(path.dirname(resultFile), { recursive: true });
    fs.appendFileSync(resultFile, line);
  } catch (error) {
    console.error(`Failed to write smoke result file ${resultFile}:`, error);
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

  maybeRecordPostClosePresenterSnapshot(type, payload);
}

function countOverlayActiveEvents() {
  return eventLog.filter(isOverlayActiveEvent).length;
}

function isOverlayActiveEvent(event) {
  if (!event || event.type !== "callback:overlay-activated") {
    return false;
  }

  return readOverlayActiveValue(event.payload) === true;
}

function maybeRecordPostClosePresenterSnapshot(type, payload) {
  if (type !== "callback:overlay-activated" || readOverlayActiveValue(payload) !== false) {
    return;
  }
  const overlay = electronSteamOverlay;
  if (!overlay || !overlay.isOpen()) {
    return;
  }

  clearPostClosePresenterSnapshotObserver();

  let firstParkedSnapshot;
  const observe = () => {
    if (shutdownComplete || !overlay.isOpen()) {
      clearPostClosePresenterSnapshotObserver();
      return;
    }

    const presenter = overlay.snapshot();
    if (!isParkedPersistentPresenter(presenter)) {
      return;
    }

    if (!firstParkedSnapshot || presenter.pumpCount !== firstParkedSnapshot.pumpCount) {
      firstParkedSnapshot = presenter;
      recordEvent("overlay:presenter-after-close", {
        source: "state-change",
        sample: 1,
        presenter
      });
      return;
    }

    recordEvent("overlay:presenter-after-close-stable", {
      source: "state-change",
      sample: 2,
      presenter
    });
    clearPostClosePresenterSnapshotObserver();
  };

  const stateHandle = overlay.presenter && overlay.presenter.onStateChange?.(observe);
  if (stateHandle) {
    postClosePresenterSnapshotHandle = stateHandle;
  }
  observe();
}

function isParkedPersistentPresenter(presenter) {
  const electronOverlay = presenter && presenter.electronOverlay;
  if (!electronOverlay || electronOverlay.presenterMode !== "persistent") {
    return false;
  }

  return (
    presenter.closed === false &&
    presenter.attached === true &&
    presenter.mode === "passive" &&
    presenter.clickThrough === true &&
    presenter.focusable === false &&
    presenter.transparent === true &&
    presenter.overlayActive === false &&
    presenter.overlayNeedsPresent === false &&
    presenter.currentFps === 0
  );
}

function clearPostClosePresenterSnapshotObserver() {
  postClosePresenterSnapshotHandle?.disconnect?.();
  postClosePresenterSnapshotHandle = undefined;
}

function waitForNextShortcutOpenLifecycle(overlay, context) {
  if (pendingShortcutOpenLifecycleWait) {
    pendingShortcutOpenLifecycleWait.fail("Superseded by a newer shortcut lifecycle wait.");
  }

  return new Promise((resolve) => {
    let settled = false;
    const timeout = setTimeout(() => {
      recordEvent("overlay:shortcut-open:timeout", {
        ...context,
        timeoutMs: MANAGED_OVERLAY_WAIT_TIMEOUT_MS,
        presenter: safeOverlaySnapshot(overlay)
      });
      settle(createFailedManagedOverlayLifecycle(context, overlay, "Timed out waiting for Steam overlay shortcut open."));
    }, MANAGED_OVERLAY_WAIT_TIMEOUT_MS);

    const settle = (lifecycle) => {
      if (settled) {
        return;
      }
      settled = true;
      clearTimeout(timeout);
      if (pendingShortcutOpenLifecycleWait?.settle === settle) {
        pendingShortcutOpenLifecycleWait = undefined;
      }
      resolve(lifecycle);
    };

    pendingShortcutOpenLifecycleWait = {
      settle,
      fail: (message) => settle(createFailedManagedOverlayLifecycle(context, overlay, message))
    };
  });
}

function observeShortcutOpenLifecycle(overlay, context) {
  const lifecycle = observeManagedOverlayLifecycle(overlay, context);
  pendingShortcutOpenLifecycleWait?.settle(lifecycle);
  return lifecycle;
}

function createFailedManagedOverlayLifecycle(context, overlay, message) {
  return {
    shown: Promise.resolve(createFailedManagedOverlayWaitResult("overlay:presenter-wait-shown", context, overlay, message)),
    closed: Promise.resolve(
      createFailedManagedOverlayWaitResult("overlay:presenter-wait-closed", context, overlay, message)
    ),
    parked: Promise.resolve(createFailedManagedOverlayWaitResult("overlay:presenter-parked", context, overlay, message))
  };
}

function createFailedManagedOverlayWaitResult(type, context, overlay, message) {
  return {
    ok: false,
    type,
    context,
    error: { message },
    presenter: safeOverlaySnapshot(overlay)
  };
}

function observeManagedOverlayLifecycle(overlay, context) {
  if (!overlay || !overlay.isOpen()) {
    return;
  }

  const sequence = ++managedOverlayWaitSequence;
  const waitContext = { sequence, ...context };
  const controller = new AbortController();
  managedOverlayWaitControllers.add(controller);

  recordEvent("overlay:presenter-wait-start", {
    ...waitContext,
    waitTimeoutMs: MANAGED_OVERLAY_WAIT_TIMEOUT_MS,
    parkTimeoutMs: MANAGED_OVERLAY_PARK_TIMEOUT_MS,
    presenter: overlay.snapshot()
  });

  const shown = recordManagedOverlayWait(
    "overlay:presenter-wait-shown",
    overlay.waitForOverlayShown({
      timeoutMs: MANAGED_OVERLAY_WAIT_TIMEOUT_MS,
      signal: controller.signal
    }),
    waitContext,
    overlay
  );
  const closed = shown.then((result) => {
    if (!result.ok) {
      return result;
    }
    return recordManagedOverlayWait(
      "overlay:presenter-wait-closed",
      overlay.waitForOverlayClosed({
        timeoutMs: MANAGED_OVERLAY_PARK_TIMEOUT_MS,
        signal: controller.signal
      }),
      waitContext,
      overlay
    );
  });
  const parked = shown.then((result) => {
    if (!result.ok) {
      return result;
    }
    return recordManagedOverlayWait(
      "overlay:presenter-parked",
      overlay.parkWhenSteamOverlayCloses({
        timeoutMs: MANAGED_OVERLAY_PARK_TIMEOUT_MS,
        signal: controller.signal
      }),
      waitContext,
      overlay
    );
  });

  Promise.allSettled([shown, closed, parked]).finally(() => {
    managedOverlayWaitControllers.delete(controller);
  });

  return { shown, closed, parked };
}

function recordManagedOverlayWait(type, promise, context, overlay, onDone = () => {}) {
  return promise
    .then((presenter) => {
      recordEvent(type, {
        ...context,
        presenter
      });
      return { ok: true, type, context, presenter };
    })
    .catch((error) => {
      const serialized = serializeError(error);
      if (!shutdownComplete) {
        recordEvent(`${type}:error`, {
          ...context,
          error: serialized,
          presenter: safeOverlaySnapshot(overlay)
        });
      }
      return { ok: false, type, context, error: serialized, presenter: safeOverlaySnapshot(overlay) };
    })
    .finally(onDone);
}

function safeOverlaySnapshot(overlay) {
  try {
    return overlay && overlay.isOpen() ? overlay.snapshot() : null;
  } catch (error) {
    return { error: serializeError(error) };
  }
}

function abortManagedOverlayWaits() {
  for (const controller of managedOverlayWaitControllers) {
    try {
      controller.abort();
    } catch {
      // Best-effort shutdown for pending smoke observers.
    }
  }
  managedOverlayWaitControllers.clear();
}

function readOverlayActiveValue(payload) {
  if (payload == null) {
    return undefined;
  }
  if (payload === true || payload === 1) {
    return true;
  }
  if (payload === false || payload === 0) {
    return false;
  }
  if (typeof payload !== "object") {
    return undefined;
  }

  const activePayload = payload["0"] && typeof payload["0"] === "object" ? payload["0"] : payload;
  for (const key of ["active", "m_bActive"]) {
    if (activePayload[key] === true || activePayload[key] === 1) {
      return true;
    }
    if (activePayload[key] === false || activePayload[key] === 0) {
      return false;
    }
  }
  return undefined;
}

function isOverlayAction(action) {
  return action === "dialog" || action === "friends" || action === "store" || action === "web";
}

function isImmediateSmokeAction(action) {
  return action === "presenter-ready";
}

function isPassiveNotificationAction(action) {
  return action === "presenter-achievement-progress" || action === "presenter-achievement-unlock";
}

function isParkedPassivePresenter(presenter) {
  return (
    presenter &&
    presenter.mode === "passive" &&
    presenter.nativeHostOpen === true &&
    presenter.clickThrough === true &&
    presenter.focusable === false &&
    presenter.transparent === true &&
    presenter.overlayActive === false &&
    presenter.overlayNeedsPresent === false &&
    presenter.currentFps === 0
  );
}

function isNativeSessionAction(action) {
  return (
    action === "native-probe" ||
    action === "native-dialog" ||
    action === "native-store" ||
    action === "native-web" ||
    action === "presenter-dialog" ||
    action === "presenter-dialog-auto" ||
    action === "presenter-dialog-auto-open-and-wait" ||
    action === "presenter-store" ||
    action === "presenter-store-open-and-wait" ||
    action === "presenter-web" ||
    action === "presenter-web-open-and-wait" ||
    action === "presenter-duplicate-open-guard" ||
    action === "presenter-friends" ||
    action === "presenter-friends-open-and-wait" ||
    action === "presenter-profile" ||
    action === "presenter-profile-open-and-wait" ||
    action === "presenter-players" ||
    action === "presenter-players-open-and-wait" ||
    action === "presenter-community" ||
    action === "presenter-community-open-and-wait" ||
    action === "presenter-stats" ||
    action === "presenter-stats-open-and-wait" ||
    action === "presenter-achievements" ||
    action === "presenter-achievements-open-and-wait" ||
    action === "presenter-user" ||
    action === "presenter-user-native" ||
    action === "presenter-user-open-and-wait" ||
    action === "presenter-checkout" ||
    action === "presenter-shortcut" ||
    action === "presenter-shortcut-open-and-wait" ||
    action === "presenter-achievement-progress" ||
    action === "presenter-achievement-unlock"
  );
}

function isManagedOverlayShownWaitAction(action) {
  return (
    action === "presenter-dialog-auto-open-and-wait" ||
    action === "presenter-store-open-and-wait" ||
    action === "presenter-web-open-and-wait" ||
    action === "presenter-duplicate-open-guard" ||
    action === "presenter-friends-open-and-wait" ||
    action === "presenter-profile-open-and-wait" ||
    action === "presenter-players-open-and-wait" ||
    action === "presenter-community-open-and-wait" ||
    action === "presenter-stats-open-and-wait" ||
    action === "presenter-achievements-open-and-wait" ||
    action === "presenter-user-open-and-wait" ||
    action === "presenter-shortcut-open-and-wait"
  );
}

function readBoolean(value, fallback) {
  if (value == null || value === "") {
    return fallback;
  }

  const normalized = String(value).toLowerCase();
  return normalized === "1" || normalized === "true" || normalized === "yes" || normalized === "on";
}

function readOptionalBoolean(value) {
  if (value == null || value === "") {
    return undefined;
  }

  const normalized = String(value).toLowerCase();
  if (["1", "true", "yes", "on"].includes(normalized)) {
    return true;
  }
  if (["0", "false", "no", "off"].includes(normalized)) {
    return false;
  }
  return undefined;
}

function normalizeManagedOverlayResultMode(value) {
  const normalized = String(value || "").trim().toLowerCase();
  if (normalized === "complete") {
    return "complete";
  }
  return "shown";
}

function normalizeMacNativeHostBackend(value) {
  const normalized = String(value || "").toLowerCase();
  if (normalized === "metal" || normalized === "opengl") {
    return normalized;
  }
  return "";
}

function configureMacNativeHostBackend(backend) {
  if (process.platform !== "darwin") {
    return;
  }

  if (backend === "opengl") {
    process.env.STEAM_BRIDGE_MAC_NATIVE_OPENGL_HOST = "1";
    delete process.env.STEAM_BRIDGE_MAC_NATIVE_METAL_HOST;
  } else if (backend === "metal") {
    process.env.STEAM_BRIDGE_MAC_NATIVE_METAL_HOST = "1";
    delete process.env.STEAM_BRIDGE_MAC_NATIVE_OPENGL_HOST;
  }
}

function normalizeWindowsNativeHostStyle(value) {
  const normalized = String(value || "").trim().toLowerCase();
  if (["control", "overlapped", "plain"].includes(normalized)) {
    return "control";
  }
  if (["default", "popup", "popup-layered", "layered"].includes(normalized)) {
    return "popup-layered";
  }
  return "";
}

function configureWindowsNativeHostStyle(style) {
  if (process.platform !== "win32" || !style) {
    return;
  }

  process.env.STEAM_BRIDGE_WINDOWS_NATIVE_HOST_STYLE = style;
}

function normalizeWindowsNativeHostBackend(value) {
  const normalized = String(value || "").trim().toLowerCase();
  if (["default", "d3d", "d3d11", "direct3d", "direct3d11", "dxgi", "windows-d3d11"].includes(normalized)) {
    return "d3d11";
  }
  if (["opengl", "gl", "wgl", "windows-opengl"].includes(normalized)) {
    return "opengl";
  }
  return "";
}

function configureWindowsNativeHostBackend(backend) {
  if (process.platform !== "win32" || !backend) {
    return;
  }

  process.env.STEAM_BRIDGE_WINDOWS_NATIVE_HOST_BACKEND = backend;
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
    overlayDialog: undefined,
    userDialog: undefined,
    shortcutTarget: undefined,
    presenterMode: undefined,
    overlayScrubChildEnv: undefined,
    overlayIsolateChildProcesses: undefined,
    overlayInProcessGpu: undefined,
    overlayDisableDirectComposition: undefined,
    windowMode: undefined,
    nativeHostBackend: undefined,
    windowsNativeHostBackend: undefined,
    windowsNativeHostStyle: undefined,
    autorunRequireOverlayActive: undefined,
    webModal: undefined,
    storeRoute: undefined,
    webUrl: undefined,
    checkoutUrl: undefined,
    checkoutTransactionId: undefined,
    checkoutReturnUrl: undefined,
    checkoutJsonFile: undefined,
    initTxnRequestFile: undefined,
    initTxnApiKeyEnv: undefined,
    initTxnEndpoint: undefined,
    managedOverlayWaitTimeoutMs: undefined,
    managedOverlayParkTimeoutMs: undefined,
    managedOverlayResultMode: undefined,
    achievementName: undefined,
    achievementCurrent: undefined,
    achievementMax: undefined,
    resultFile: undefined,
    diagnosticDir: undefined,
    smokeEnvFile: undefined,
    keepOpenAfterResult: undefined,
    controlServer: undefined,
    controlFile: undefined,
    controlToken: undefined
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
      case "--steam-bridge-smoke-store-route":
        options.storeRoute = value;
        break;
      case "--steam-bridge-smoke-checkout-url":
        options.checkoutUrl = value;
        break;
      case "--steam-bridge-smoke-checkout-transaction-id":
        options.checkoutTransactionId = value;
        break;
      case "--steam-bridge-smoke-checkout-return-url":
        options.checkoutReturnUrl = value;
        break;
      case "--steam-bridge-smoke-checkout-json-file":
        options.checkoutJsonFile = value;
        break;
      case "--steam-bridge-smoke-init-txn-request-file":
        options.initTxnRequestFile = value;
        break;
      case "--steam-bridge-smoke-init-txn-api-key-env":
        options.initTxnApiKeyEnv = value;
        break;
      case "--steam-bridge-smoke-init-txn-endpoint":
        options.initTxnEndpoint = value;
        break;
      case "--steam-bridge-smoke-managed-overlay-wait-timeout-ms":
        options.managedOverlayWaitTimeoutMs = value;
        break;
      case "--steam-bridge-smoke-managed-overlay-park-timeout-ms":
        options.managedOverlayParkTimeoutMs = value;
        break;
      case "--steam-bridge-smoke-managed-overlay-result-mode":
        options.managedOverlayResultMode = value;
        break;
      case "--steam-bridge-smoke-overlay-dialog":
        options.overlayDialog = value;
        break;
      case "--steam-bridge-smoke-user-dialog":
        options.userDialog = value;
        break;
      case "--steam-bridge-smoke-shortcut-target":
        options.shortcutTarget = value;
        break;
      case "--steam-bridge-smoke-presenter-mode":
        options.presenterMode = value;
        break;
      case "--steam-bridge-smoke-achievement-name":
        options.achievementName = value;
        break;
      case "--steam-bridge-smoke-achievement-current":
        options.achievementCurrent = value;
        break;
      case "--steam-bridge-smoke-achievement-max":
        options.achievementMax = value;
        break;
      case "--steam-bridge-electron-overlay-profile":
        options.overlayProfile = value;
        break;
      case "--steam-bridge-electron-overlay-scrub-child-env":
        options.overlayScrubChildEnv = value == null || value === "" ? "1" : value;
        break;
      case "--steam-bridge-electron-overlay-isolate-child-processes":
        options.overlayIsolateChildProcesses = value == null || value === "" ? "1" : value;
        break;
      case "--steam-bridge-electron-overlay-in-process-gpu":
        options.overlayInProcessGpu = value == null || value === "" ? "1" : value;
        break;
      case "--steam-bridge-electron-overlay-disable-direct-composition":
        options.overlayDisableDirectComposition = value == null || value === "" ? "1" : value;
        break;
      case "--steam-bridge-smoke-window-mode":
        options.windowMode = value;
        break;
      case "--steam-bridge-smoke-native-host-backend":
        options.nativeHostBackend = value;
        break;
      case "--steam-bridge-windows-native-host-backend":
      case "--steam-bridge-smoke-windows-native-host-backend":
        options.windowsNativeHostBackend = value;
        break;
      case "--steam-bridge-windows-native-host-style":
      case "--steam-bridge-smoke-windows-native-host-style":
        options.windowsNativeHostStyle = value;
        break;
      case "--steam-bridge-smoke-result-file":
        options.resultFile = value;
        break;
      case "--steam-bridge-smoke-diagnostic-dir":
        options.diagnosticDir = value;
        break;
      case "--steam-bridge-smoke-env-file":
        options.smokeEnvFile = value;
        break;
      case "--steam-bridge-smoke-keep-open-after-result":
        options.keepOpenAfterResult = value == null || value === "" ? "1" : value;
        break;
      case "--steam-bridge-smoke-control-server":
        options.controlServer = value == null || value === "" ? "1" : value;
        break;
      case "--steam-bridge-smoke-control-file":
        options.controlFile = value;
        break;
      case "--steam-bridge-smoke-control-token":
        options.controlToken = value;
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

function loadSmokeEnvFile(filePath) {
  if (!filePath) {
    return;
  }

  let text;
  try {
    text = fs.readFileSync(filePath, "utf8");
  } catch (error) {
    console.error(`Failed to read Steam Bridge smoke env file ${filePath}:`, error);
    return;
  }

  process.env.STEAM_BRIDGE_SMOKE_ENV_FILE = filePath;
  for (const [index, rawLine] of text.split(/\r?\n/).entries()) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) {
      continue;
    }

    const separator = line.indexOf("=");
    if (separator <= 0) {
      console.error(`Ignoring invalid Steam Bridge smoke env line ${index + 1} in ${filePath}.`);
      continue;
    }

    const key = line.slice(0, separator).trim();
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) {
      console.error(`Ignoring invalid Steam Bridge smoke env key "${key}" in ${filePath}.`);
      continue;
    }

    process.env[key] = line.slice(separator + 1);
  }
}

function normalizeStoreRoute(value, fallback = "web") {
  const route = String(value || "").trim().toLowerCase();
  if (!route) {
    return fallback;
  }
  if (route === "web" || route === "native") {
    return route;
  }
  throw new Error(`Unsupported Steam store overlay route: ${value}`);
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
  return serializeSmokeError(error);
}

function sanitize(value) {
  return sanitizeSmokeValue(value);
}
