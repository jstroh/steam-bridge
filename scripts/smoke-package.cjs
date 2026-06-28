const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const repoRoot = path.resolve(__dirname, "..");
const packageRoot = path.join(repoRoot, "packages", "steam-bridge");
const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "steam-bridge-package-smoke-"));
const packDir = path.join(tempRoot, "pack");
const consumerDir = path.join(tempRoot, "consumer");
const keepTemp = process.env.STEAM_BRIDGE_KEEP_PACKAGE_SMOKE === "1";

try {
  fs.mkdirSync(packDir);
  fs.mkdirSync(consumerDir);

  run("npm", ["run", "build", "-w", "steam-bridge"], { cwd: repoRoot });
  const tarball = packPackage();
  installConsumer(tarball);
  runConsumerChecks();
  run("bash", [path.join(repoRoot, "scripts", "linux-electron-smoke.sh"), "--mode", "self-test"], {
    cwd: repoRoot
  });
  run("bash", [path.join(repoRoot, "scripts", "steam-deck-smoke.sh"), "--mode", "self-test"], {
    cwd: repoRoot
  });

  console.log("Packed steam-bridge package smoke test passed.");
} finally {
  if (keepTemp) {
    console.log(`Keeping package smoke temp directory: ${tempRoot}`);
  } else {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
}

function packPackage() {
  const result = run("npm", ["pack", "--json", "--pack-destination", packDir], {
    cwd: packageRoot,
    encoding: "utf8"
  });
  const packages = JSON.parse(result.stdout);
  const filename = packages[0]?.filename;
  assert.equal(typeof filename, "string", "npm pack did not return a filename");

  const tarball = path.join(packDir, filename);
  assertNonEmptyFile(tarball);
  return tarball;
}

function installConsumer(tarball) {
  fs.writeFileSync(
    path.join(consumerDir, "package.json"),
    JSON.stringify(
      {
        name: "steam-bridge-package-smoke-consumer",
        private: true,
        type: "commonjs"
      },
      null,
      2
    )
  );

  run("npm", ["install", "--ignore-scripts", "--no-audit", "--no-fund", tarball], {
    cwd: consumerDir
  });
}

function runConsumerChecks() {
  fs.writeFileSync(
    path.join(consumerDir, "check-cjs.cjs"),
    `
const assert = require("node:assert/strict");
const steam = require("steam-bridge");
const electron = require("steam-bridge/electron");

assert.equal(typeof steam.init, "function");
assert.equal(typeof steam.default.init, "function");
assert.equal(typeof steam.default.openCommunityOverlay, "function");
assert.equal(typeof steam.default.openStatsOverlay, "function");
assert.equal(typeof steam.default.openAchievementsOverlay, "function");
assert.equal(typeof steam.default.openSteamOverlay, "function");
assert.equal(typeof steam.default.createElectronSteamOverlay, "function");
assert.equal(typeof steam.createSteamWebApiClient, "function");
assert.equal(typeof steam.overlay.openNativeOverlayProbeWindow, "function");
assert.equal(typeof steam.overlay.activateDialogWithNativeSession, "function");
assert.equal(typeof steam.overlay.activateToWebPageWithNativeSession, "function");
assert.equal(typeof steam.overlay.activateToStoreWithNativeSession, "function");
assert.equal(typeof steam.overlay.attachPresenter, "function");
assert.equal(typeof steam.overlay.openWebOverlay, "function");
assert.equal(typeof steam.overlay.openFriendsOverlay, "function");
assert.equal(typeof steam.overlay.openCommunityOverlay, "function");
assert.equal(typeof steam.overlay.openStatsOverlay, "function");
assert.equal(typeof steam.overlay.openAchievementsOverlay, "function");
assert.equal(typeof steam.overlay.openSteamOverlay, "function");
assert.equal(typeof steam.overlay.createElectronSteamOverlay, "function");
assert.equal(typeof steam.overlay.setNativeOverlayHostInputPassthrough, "function");
assert.equal(typeof steam.overlay.setNativeOverlayHostOpacity, "function");
assert.equal(steam.STEAM_FRIENDS_OVERLAY_URL, "https://steamcommunity.com/chat/");
assert.equal(typeof steam.electronNativeOverlaySessionOptions, "function");
assert.equal(typeof steam.electronOverlayPresenterOptions, "function");
assert.equal(typeof steam.electronScrubSteamOverlayChildProcessEnv, "function");
assert.equal(steam.SteamworksEnums.EResult.k_EResultOK, 1);
assert.equal(typeof electron.electronConfigureSteamOverlay, "function");
assert.equal(typeof electron.electronNativeOverlaySessionOptions, "function");
assert.equal(typeof electron.electronOverlayPresenterOptions, "function");
assert.equal(typeof electron.electronScrubSteamOverlayChildProcessEnv, "function");
assert.equal(electron.electronConfigureSteamOverlay({ profile: "off" }).profile, "off");
`
  );

  fs.writeFileSync(
    path.join(consumerDir, "check-esm.mjs"),
    `
import assert from "node:assert/strict";
import steam, { createSteamWebApiClient, overlay, SteamworksEnums } from "steam-bridge";
import * as electron from "steam-bridge/electron";

assert.equal(typeof steam.init, "function");
assert.equal(typeof steam.openCommunityOverlay, "function");
assert.equal(typeof steam.openStatsOverlay, "function");
assert.equal(typeof steam.openAchievementsOverlay, "function");
assert.equal(typeof steam.openSteamOverlay, "function");
assert.equal(typeof steam.createElectronSteamOverlay, "function");
assert.equal(typeof createSteamWebApiClient, "function");
assert.equal(typeof overlay.openNativeOverlayProbeWindow, "function");
assert.equal(typeof overlay.activateDialogWithNativeSession, "function");
assert.equal(typeof overlay.activateToWebPageWithNativeSession, "function");
assert.equal(typeof overlay.activateToStoreWithNativeSession, "function");
assert.equal(typeof overlay.attachPresenter, "function");
assert.equal(typeof overlay.openWebOverlay, "function");
assert.equal(typeof overlay.openFriendsOverlay, "function");
assert.equal(typeof overlay.openCommunityOverlay, "function");
assert.equal(typeof overlay.openStatsOverlay, "function");
assert.equal(typeof overlay.openAchievementsOverlay, "function");
assert.equal(typeof overlay.openSteamOverlay, "function");
assert.equal(typeof overlay.createElectronSteamOverlay, "function");
assert.equal(typeof overlay.setNativeOverlayHostInputPassthrough, "function");
assert.equal(typeof overlay.setNativeOverlayHostOpacity, "function");
assert.equal(typeof steam.electronNativeOverlaySessionOptions, "function");
assert.equal(typeof steam.electronOverlayPresenterOptions, "function");
assert.equal(typeof steam.electronScrubSteamOverlayChildProcessEnv, "function");
assert.equal(SteamworksEnums.EResult.k_EResultOK, 1);
assert.equal(typeof electron.electronConfigureSteamOverlay, "function");
assert.equal(typeof electron.electronNativeOverlaySessionOptions, "function");
assert.equal(typeof electron.electronOverlayPresenterOptions, "function");
assert.equal(typeof electron.electronScrubSteamOverlayChildProcessEnv, "function");
assert.equal(electron.electronConfigureSteamOverlay({ profile: "off" }).profile, "off");
`
  );

  const typeRoots = path.join(repoRoot, "node_modules", "@types");
  fs.writeFileSync(
    path.join(consumerDir, "tsconfig.json"),
    JSON.stringify(
      {
        compilerOptions: {
          target: "ES2020",
          module: "Node16",
          moduleResolution: "Node16",
          strict: true,
          skipLibCheck: true,
          types: ["node"],
          typeRoots: [typeRoots]
        },
        include: ["consumer.ts"]
      },
      null,
      2
    )
  );

  fs.writeFileSync(
    path.join(consumerDir, "consumer.ts"),
    `
import steam, {
  createSteamWebApiClient,
  overlay,
  STEAM_FRIENDS_OVERLAY_URL,
  SteamworksEnums,
  type ElectronSteamOverlay,
  type SteamId,
  type SteamOverlayTarget
} from "steam-bridge";
import { electronConfigureSteamOverlay } from "steam-bridge/electron";
import { electronNativeOverlaySessionOptions } from "steam-bridge/electron";
import { electronOverlayPresenterOptions } from "steam-bridge/electron";
import { electronScrubSteamOverlayChildProcessEnv } from "steam-bridge/electron";

const client = steam.init(480);
const web = createSteamWebApiClient({ apiKey: "test" });
const enumValue: number = SteamworksEnums.EResult.k_EResultOK;
const overlayFn: (title?: string) => void = overlay.openNativeOverlayProbeWindow;
const sessionFn = overlay.activateDialogWithNativeSession;
const webSessionFn = overlay.activateToWebPageWithNativeSession;
const storeSessionFn = overlay.activateToStoreWithNativeSession;
const presenterFn = overlay.attachPresenter;
const presenterWebFn = overlay.openWebOverlay;
const presenterFriendsFn = overlay.openFriendsOverlay;
const presenterCommunityFn = overlay.openCommunityOverlay;
const presenterStatsFn = overlay.openStatsOverlay;
const presenterAchievementsFn = overlay.openAchievementsOverlay;
const presenterSteamFn = overlay.openSteamOverlay;
const electronSteamOverlayFn = overlay.createElectronSteamOverlay;
const steamOverlayTarget: SteamOverlayTarget = { type: "friends" };
const inputPassthroughFn: (passThrough: boolean) => void = overlay.setNativeOverlayHostInputPassthrough;
const opacityFn: (opaque: boolean) => void = overlay.setNativeOverlayHostOpacity;
const friendsOverlayUrl: string = STEAM_FRIENDS_OVERLAY_URL;
const config = electronConfigureSteamOverlay({ profile: "off" });
const scrubbedKeys: string[] = electronScrubSteamOverlayChildProcessEnv({});
const electronOptions = electronNativeOverlaySessionOptions({
  isDestroyed: () => false,
  getNativeWindowHandle: () => Buffer.from([1, 0, 0, 0, 0, 0, 0, 0]),
  webContents: {
    once() {},
    invalidate() {},
    send() {}
  }
});
const presenterOptions = electronOverlayPresenterOptions({
  isDestroyed: () => false,
  getNativeWindowHandle: () => Buffer.from([1, 0, 0, 0, 0, 0, 0, 0]),
  webContents: {
    once() {},
    invalidate() {},
    send() {}
  }
});
const electronSteamOverlay = overlay.createElectronSteamOverlay({
  isDestroyed: () => false,
  getNativeWindowHandle: () => Buffer.from([1, 0, 0, 0, 0, 0, 0, 0]),
  once() {},
  webContents: {
    once() {},
    invalidate() {},
    send() {}
  }
});
const typedElectronSteamOverlay: ElectronSteamOverlay = electronSteamOverlay;
const steamId: SteamId | undefined = undefined;

void client;
void web;
void enumValue;
void overlayFn;
void sessionFn;
void webSessionFn;
void storeSessionFn;
void presenterFn;
void presenterWebFn;
void presenterFriendsFn;
void presenterCommunityFn;
void presenterStatsFn;
void presenterAchievementsFn;
void presenterSteamFn;
void electronSteamOverlayFn;
void steamOverlayTarget;
void typedElectronSteamOverlay;
void inputPassthroughFn;
void opacityFn;
void friendsOverlayUrl;
void config;
void electronOptions;
void presenterOptions;
void steamId;
`
  );

  run("node", ["check-cjs.cjs"], { cwd: consumerDir });
  run("node", ["check-esm.mjs"], { cwd: consumerDir });
  run("node", [path.join(repoRoot, "node_modules", "typescript", "bin", "tsc"), "--noEmit", "-p", "tsconfig.json"], {
    cwd: consumerDir
  });
}

function assertNonEmptyFile(filePath) {
  const stat = fs.statSync(filePath);
  assert.ok(stat.isFile(), `${filePath} is not a file`);
  assert.ok(stat.size > 0, `${filePath} is empty`);
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd,
    encoding: options.encoding,
    stdio: options.encoding ? ["ignore", "pipe", "inherit"] : "inherit",
    shell: process.platform === "win32"
  });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }

  return result;
}
