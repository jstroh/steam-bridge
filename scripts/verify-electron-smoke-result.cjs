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
const processInfo = snapshot.process || {};
const events = Array.isArray(snapshot.events) ? snapshot.events : [];
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
  expect(readOkValue(steam.overlayNeedsPresent) === false, "overlay does not need present");
}
if (options.requireOverlayActivated) {
  expect(events.some(isOverlayActiveEvent), "overlay activation callback active=true emitted");
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
    `overlayActivated=${events.some(isOverlayActiveEvent)}`,
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
