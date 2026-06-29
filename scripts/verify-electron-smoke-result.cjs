const fs = require("node:fs");

const RESULT_PREFIX = "STEAM_BRIDGE_SMOKE_RESULT ";
const options = parseArgs(process.argv.slice(2));
const input = options.file ? fs.readFileSync(options.file, "utf8") : fs.readFileSync(0, "utf8");
const result = readResult(input);
const snapshot = result.snapshot || {};
const steam = snapshot.steam || {};
const app = snapshot.app || {};
const launch = snapshot.launch || {};
const overlay = snapshot.overlay || {};
const overlayProcesses = snapshot.overlayProcesses || {};
const crashDiagnostics = snapshot.crashDiagnostics || {};
const processInfo = snapshot.process || {};
const nativePresenter = readOkValue(overlay.nativePresenter);
const electronOverlay = nativePresenter && typeof nativePresenter === "object" ? nativePresenter.electronOverlay : undefined;
const events = Array.isArray(snapshot.events) ? snapshot.events : [];
const overlayActivated = events.some(isOverlayActiveEvent);
const failures = [];

expect(result.ok === true, "smoke result ok");
expect(steam.initialized === true, "Steam initialized");
expect(readOkValue(steam.running) === true, "Steam running");
expect(readOkValue(steam.appId) === app.appId, "Steam App ID matches app config");

if (options.appId != null) {
  expect(app.appId === options.appId, `app ID is ${options.appId}`);
}
if (options.platform) {
  expect(processInfo.platform === options.platform, `platform is ${options.platform}`);
}
if (options.arch) {
  expect(processInfo.arch === options.arch, `arch is ${options.arch}`);
}
if (options.action) {
  expect(result.action && result.action.action === options.action, `autorun action is ${options.action}`);
  expect(result.action && result.action.ok === true, `autorun action ${options.action} succeeded`);
}
if (options.requireSteamDeck) {
  expect(readOkValue(steam.steamDeck) === true, "Steam Deck detected");
}
if (options.requireBigPicture) {
  expect(readOkValue(steam.bigPicture) === true, "Big Picture/Game Mode detected");
}
if (options.requireOverlayEnabled) {
  expect(readOkValue(steam.overlayEnabled) === true, "overlay enabled");
}
if (options.requireOverlayReady) {
  expect(readOkValue(steam.overlayEnabled) === true, "overlay enabled");
  expect(
    readOkValue(steam.overlayNeedsPresent) === false || overlayActivated,
    "overlay does not need present or emitted active overlay callback"
  );
}
if (options.requireOverlayActivated) {
  expect(overlayActivated, "overlay activation callback active=true emitted");
}
if (options.requireSingleOverlayTarget) {
  const gameoverlayui = Array.isArray(overlayProcesses.gameoverlayui)
    ? overlayProcesses.gameoverlayui.filter((entry) => entry && entry.targetPid != null)
    : [];
  expect(overlayProcesses.available === true, "overlay process snapshot available");
  expect(gameoverlayui.length === 1, "exactly one gameoverlayui target detected");
  if (gameoverlayui.length > 0) {
    expect(gameoverlayui[0].targetPid === processInfo.pid, "gameoverlayui targets the smoke app process");
  }
}
if (options.requirePassivePresenter || options.requireIdlePresenter) {
  expect(Boolean(nativePresenter), "native presenter snapshot available");
  if (nativePresenter) {
    expect(nativePresenter.attached === true, "native presenter attached");
    expect(nativePresenter.nativeHostOpen === true, "native presenter host open");
    expect(nativePresenter.mode === "passive", "native presenter is passive");
    expect(nativePresenter.clickThrough === true, "native presenter is click-through");
    expect(nativePresenter.focusable === false, "native presenter is non-focusable");
    expect(nativePresenter.transparent === true, "native presenter is transparent");
    expect(nativePresenter.overlayActive === false, "native presenter overlay inactive");
  }
}
if (options.requireElectronOverlay || options.requirePresenterMode || options.requireOverlayShortcutTarget) {
  expect(Boolean(electronOverlay), "managed Electron overlay diagnostics available");
  if (electronOverlay) {
    expect(
      electronOverlay.autoPrepareForNotifications === true,
      "managed Electron overlay automatic notification priming is enabled"
    );
  }
}
if (options.requirePresenterMode && electronOverlay) {
  expect(
    electronOverlay.presenterMode === options.requirePresenterMode,
    `managed Electron presenter mode is ${options.requirePresenterMode}`
  );
}
if (options.requireOverlayShortcutTarget && electronOverlay) {
  const overlayShortcut = electronOverlay.overlayShortcut || {};
  const targetType = overlayShortcut.targetType;
  const targetSnapshotType = overlayShortcut.target && typeof overlayShortcut.target.type === "string" ? overlayShortcut.target.type : undefined;
  const configuredShortcutTarget = typeof app.shortcutTarget === "string" ? app.shortcutTarget : undefined;
  expect(overlayShortcut.enabled === true, "managed Electron overlay shortcut is enabled");
  if (targetSnapshotType) {
    expect(targetType === targetSnapshotType, "managed Electron overlay shortcut target diagnostics are consistent");
  }
  expect(
    targetType === options.requireOverlayShortcutTarget ||
      targetSnapshotType === options.requireOverlayShortcutTarget ||
      (targetType === "function" && configuredShortcutTarget === options.requireOverlayShortcutTarget),
    `managed Electron overlay shortcut target is ${options.requireOverlayShortcutTarget}`
  );
}
if (options.requireIdlePresenter) {
  if (nativePresenter) {
    expect(nativePresenter.idleFps === 0, "native presenter idle FPS is zero");
    expect(nativePresenter.currentFps === 0, "native presenter current FPS is zero");
    expect(nativePresenter.overlayNeedsPresent === false, "native presenter overlay does not need present");
  }
}
if (options.requireNoCrashes) {
  const crashDumps = Array.isArray(crashDiagnostics.crashDumps) ? crashDiagnostics.crashDumps : [];
  const fatalLifecycleEvents = Array.isArray(crashDiagnostics.fatalLifecycleEvents)
    ? crashDiagnostics.fatalLifecycleEvents
    : [];
  expect(crashDiagnostics.available === true, "crash diagnostics available");
  expect(crashDiagnostics.ok === true, "no crash diagnostics reported");
  expect(crashDumps.length === 0, "no crash dumps found");
  expect(fatalLifecycleEvents.length === 0, "no fatal lifecycle events recorded");
}
if (options.requireSteamLaunch) {
  expect(launch.steamLaunch === true, "Steam launch marker detected");
}
if (options.requireOverlayInjection) {
  expect(launch.overlayInjection === true, "Steam overlay injection marker detected");
}
if (options.requireNativeProbeOpen) {
  expect(readOkValue(overlay.nativeProbeOpen) === true, "native overlay probe open");
}
for (const type of options.requiredEvents) {
  expect(events.some((event) => event && event.type === type), `event ${type} emitted`);
}

if (failures.length > 0) {
  for (const failure of failures) {
    console.error(`Smoke result failed: ${failure}`);
  }
  process.exit(1);
}

console.log(
  [
    "Electron smoke result verified",
    `appId=${app.appId}`,
    `platform=${processInfo.platform}/${processInfo.arch}`,
    `steamDeck=${readOkValue(steam.steamDeck)}`,
    `bigPicture=${readOkValue(steam.bigPicture)}`,
    `overlayEnabled=${readOkValue(steam.overlayEnabled)}`,
    `overlayNeedsPresent=${readOkValue(steam.overlayNeedsPresent)}`,
    `overlayActivated=${overlayActivated}`,
    `steamLaunch=${launch.steamLaunch}`,
    `overlayInjection=${launch.overlayInjection}`,
    `action=${result.action && result.action.action}`
  ].join(" ")
);

function readResult(text) {
  const line = text
    .split(/\r?\n/)
    .reverse()
    .find((entry) => entry.startsWith(RESULT_PREFIX));
  if (!line) {
    throw new Error(`Missing ${RESULT_PREFIX.trim()} line.`);
  }

  return JSON.parse(line.slice(RESULT_PREFIX.length));
}

function readOkValue(entry) {
  return entry && entry.ok === true ? entry.value : undefined;
}

function expect(condition, message) {
  if (!condition) {
    failures.push(message);
  }
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

function parseArgs(args) {
  const parsed = {
    appId: undefined,
    arch: undefined,
    action: undefined,
    file: undefined,
    platform: undefined,
    requireBigPicture: false,
    requireOverlayInjection: false,
    requireOverlayEnabled: false,
    requireOverlayReady: false,
    requireNativeProbeOpen: false,
    requireOverlayActivated: false,
    requireSingleOverlayTarget: false,
    requirePassivePresenter: false,
    requireIdlePresenter: false,
    requireElectronOverlay: false,
    requirePresenterMode: undefined,
    requireOverlayShortcutTarget: undefined,
    requireNoCrashes: false,
    requireSteamLaunch: false,
    requireSteamDeck: false,
    requiredEvents: []
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    switch (arg) {
      case "--action":
        parsed.action = args[++index];
        break;
      case "--app-id":
        parsed.appId = Number(args[++index]);
        break;
      case "--arch":
        parsed.arch = args[++index];
        break;
      case "--file":
        parsed.file = args[++index];
        break;
      case "--platform":
        parsePlatformValue(parsed, args[++index]);
        break;
      case "--require-big-picture":
        parsed.requireBigPicture = true;
        break;
      case "--require-event":
        parsed.requiredEvents.push(args[++index]);
        break;
      case "--require-overlay-injection":
        parsed.requireOverlayInjection = true;
        break;
      case "--require-overlay-enabled":
        parsed.requireOverlayEnabled = true;
        break;
      case "--require-overlay-ready":
        parsed.requireOverlayReady = true;
        break;
      case "--require-overlay-activated":
        parsed.requireOverlayActivated = true;
        break;
      case "--require-single-overlay-target":
        parsed.requireSingleOverlayTarget = true;
        break;
      case "--require-passive-presenter":
        parsed.requirePassivePresenter = true;
        break;
      case "--require-idle-presenter":
        parsed.requireIdlePresenter = true;
        parsed.requirePassivePresenter = true;
        break;
      case "--require-electron-overlay":
        parsed.requireElectronOverlay = true;
        break;
      case "--require-presenter-mode":
        parsed.requirePresenterMode = args[++index];
        parsed.requireElectronOverlay = true;
        break;
      case "--require-overlay-shortcut-target":
        parsed.requireOverlayShortcutTarget = args[++index];
        parsed.requireElectronOverlay = true;
        break;
      case "--require-no-crashes":
        parsed.requireNoCrashes = true;
        break;
      case "--require-native-probe-open":
        parsed.requireNativeProbeOpen = true;
        break;
      case "--require-steam-launch":
        parsed.requireSteamLaunch = true;
        break;
      case "--require-steam-deck":
        parsed.requireSteamDeck = true;
        break;
      default:
        throw new Error(`Unknown option: ${arg}`);
    }
  }

  return parsed;
}

function parsePlatformValue(parsed, value) {
  const [platform, arch, extra] = String(value || "").split("/");
  if (!platform || extra) {
    throw new Error(`Invalid platform value: ${value}`);
  }

  parsed.platform = platform;
  if (arch) {
    parsed.arch = arch;
  }
}
