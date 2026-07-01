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
  run("bash", [path.join(repoRoot, "scripts", "steam-deck-overlay-matrix.sh"), "--mode", "self-test"], {
    cwd: repoRoot
  });
  run("bash", [path.join(repoRoot, "scripts", "macos-overlay-matrix.sh"), "--mode", "self-test"], {
    cwd: repoRoot
  });
  run("node", [path.join(repoRoot, "scripts", "verify-macos-steam-signing.cjs"), "--self-test"], {
    cwd: repoRoot
  });
  runMacosEntitlementsStaticChecks();
  runMacosPackageSigningStaticChecks();
  runElectronSmokeActionStaticChecks();
  runWindowsSmokeHelperStaticChecks();

  console.log("Packed steam-bridge package smoke test passed.");
} finally {
  if (keepTemp) {
    console.log(`Keeping package smoke temp directory: ${tempRoot}`);
  } else {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
}

function runMacosEntitlementsStaticChecks() {
  const entitlementsPath = path.join(packageRoot, "templates", "entitlements.steam.macos.plist");
  const exampleEntitlementsPath = path.join(repoRoot, "examples", "electron-basic", "entitlements.steam.macos.plist");
  const entitlements = fs.readFileSync(entitlementsPath, "utf8");
  assert.ok(
    !fs.existsSync(exampleEntitlementsPath),
    "Electron example must use the published steam-bridge macOS entitlement template instead of carrying a local copy"
  );
  for (const expected of [
    "com.apple.security.cs.allow-dyld-environment-variables",
    "com.apple.security.cs.disable-library-validation"
  ]) {
    assert.ok(entitlements.includes(`<key>${expected}</key>`), `macOS Steam entitlements missing ${expected}`);
  }
  assert.ok(
    /<key>com\.apple\.security\.cs\.allow-dyld-environment-variables<\/key>\s*<true\/>/.test(entitlements),
    "macOS Steam entitlements must enable allow-dyld-environment-variables"
  );
  assert.ok(
    /<key>com\.apple\.security\.cs\.disable-library-validation<\/key>\s*<true\/>/.test(entitlements),
    "macOS Steam entitlements must enable disable-library-validation"
  );
  assert.ok(
    !entitlements.includes("com.apple.security.app-sandbox"),
    "macOS Steam entitlements must not enable the App Sandbox"
  );
}

function runMacosPackageSigningStaticChecks() {
  const packageJson = JSON.parse(fs.readFileSync(path.join(packageRoot, "package.json"), "utf8"));
  const examplePackageJson = JSON.parse(
    fs.readFileSync(path.join(repoRoot, "examples", "electron-basic", "package.json"), "utf8")
  );
  const exampleReadme = fs.readFileSync(path.join(repoRoot, "examples", "electron-basic", "README.md"), "utf8");
  const packagerScript = fs.readFileSync(path.join(repoRoot, "scripts", "package-electron-example.cjs"), "utf8");
  const matrixScript = fs.readFileSync(path.join(repoRoot, "scripts", "macos-overlay-matrix.sh"), "utf8");
  const ciWorkflow = fs.readFileSync(path.join(repoRoot, ".github", "workflows", "ci.yml"), "utf8");
  const releaseWorkflow = fs.readFileSync(path.join(repoRoot, ".github", "workflows", "release.yml"), "utf8");
  const readme = fs.readFileSync(path.join(repoRoot, "README.md"), "utf8");
  const packageReadme = fs.readFileSync(path.join(packageRoot, "README.md"), "utf8");
  const prepareScript = fs.readFileSync(path.join(packageRoot, "bin", "prepare-macos-app.cjs"), "utf8");
  const verifierScript = fs.readFileSync(path.join(packageRoot, "bin", "verify-macos-signing.cjs"), "utf8");
  const launcherTemplate = fs.readFileSync(path.join(packageRoot, "templates", "macos-steam-env-launcher.c"), "utf8");
  assert.equal(
    packageJson.bin?.["steam-bridge-prepare-macos-app"],
    "bin/prepare-macos-app.cjs",
    "steam-bridge package must expose the macOS app preparation CLI"
  );
  assert.equal(
    packageJson.bin?.["steam-bridge-validate-checkout-target"],
    "bin/validate-checkout-target.cjs",
    "steam-bridge package must expose the checkout target validator CLI"
  );
  assert.equal(
    packageJson.bin?.["steam-bridge-verify-macos-signing"],
    "bin/verify-macos-signing.cjs",
    "steam-bridge package must expose the macOS signing verifier CLI"
  );
  assert.equal(
    packageJson.exports?.["./electron-builder"]?.default,
    "./dist/electron-builder.js",
    "steam-bridge package must expose the electron-builder helper subpath"
  );
  assertExecutableFile(path.join(packageRoot, "bin", "prepare-macos-app.cjs"));
  assertExecutableFile(path.join(packageRoot, "bin", "validate-checkout-target.cjs"));
  assertExecutableFile(path.join(packageRoot, "bin", "verify-macos-signing.cjs"));
  assert.ok(packageJson.files.includes("bin"), "steam-bridge package must publish verifier CLI files");
  assert.ok(packageJson.files.includes("templates"), "steam-bridge package must publish macOS launcher templates");
  assert.equal(
    examplePackageJson.scripts?.["package:mac"],
    "node ../../scripts/package-electron-example.cjs --target aarch64-apple-darwin",
    "Electron example package:mac script must build only the Apple Silicon macOS target"
  );
  assert.ok(
    !JSON.stringify(examplePackageJson).includes("x86_64-apple-darwin") &&
      !JSON.stringify(examplePackageJson).includes("darwin-x64") &&
      !JSON.stringify(examplePackageJson).includes("universal"),
    "Electron example must not expose Intel or universal macOS package scripts"
  );
  for (const expected of [
    "assertSupportedPackageHost(target)",
    "Steam Bridge does not build, run, or verify Intel or multi-arch macOS test apps",
    "prepare-macos-app.cjs",
    "validateStagePackageArtifacts(stageDir, config.requiredFiles)",
    "isOverlayNeedsPresentPollingEnabled",
    "loadNativeBinding"
  ]) {
    assert.ok(packagerScript.includes(expected), `macOS package script missing ${expected}`);
  }
  assert.match(
    packagerScript,
    /"aarch64-apple-darwin":\s*\{[\s\S]*?platform:\s*"darwin"[\s\S]*?arch:\s*"arm64"/,
    "example packager must package macOS as Apple Silicon arm64"
  );
  assert.doesNotMatch(
    packagerScript,
    /x86_64-apple-darwin|darwin-x64|universal2?|platform:\s*"darwin"[\s\S]{0,160}arch:\s*"x64"/,
    "example packager must not expose Intel or universal macOS targets"
  );
  assert.match(
    readme,
    /## Platform Targets[\s\S]*### macOS Apple Silicon Only/,
    "README must make the Apple Silicon-only macOS target policy prominent"
  );
  assert.match(
    readme,
    /All macOS test apps are built and run as Apple Silicon arm64\s+targets only/,
    "README must document that macOS test apps are Apple Silicon only"
  );
  assert.match(
    readme,
    /never silently become\s+Intel cross-compilation checks/,
    "README must document the macOS arm64 runner guard"
  );
  assert.match(
    readme,
    /The macOS smoke package command is intentionally `npm run example:package:mac`/,
    "README must document the Apple Silicon-only macOS package command"
  );
  assert.match(
    packageReadme,
    /## Platform Targets[\s\S]*### macOS Apple Silicon Only/,
    "package README must make the Apple Silicon-only macOS target policy prominent"
  );
  assert.match(
    packageReadme,
    /Build and\s+run macOS test apps only on native `darwin\/arm64` Apple Silicon hosts/,
    "package README must document native Apple Silicon-only macOS test apps"
  );
  assert.match(
    packageReadme,
    /prepareMacosSteamAppAfterPack[\s\S]*afterPack/,
    "package README must document the electron-builder afterPack helper"
  );
  assert.match(
    exampleReadme,
    /### macOS Apple Silicon Only/,
    "Electron example README must make Apple Silicon-only macOS smoke packaging prominent"
  );
  assert.match(
    exampleReadme,
    /The only supported macOS smoke package command is\s+`npm run example:package:mac`/,
    "Electron example README must document the Apple Silicon-only macOS package command"
  );
  for (const [label, workflow] of [
    ["CI workflow", ciWorkflow],
    ["Release workflow", releaseWorkflow]
  ]) {
    assert.ok(
      workflow.includes("matrix.target == 'aarch64-apple-darwin'"),
      `${label} must gate macOS runner checks to the Apple Silicon target`
    );
    assert.ok(
      workflow.includes('test "$(uname -m)" = arm64'),
      `${label} must verify the macOS runner is arm64`
    );
  }
  assert.ok(
    !packagerScript.includes("signMacSteamExecutable"),
    "macOS package script must use the published Steam Bridge preparation CLI"
  );
  for (const expected of [
    "templates\", \"macos-steam-env-launcher.c",
    "templates\", \"entitlements.steam.macos.plist",
    "readCfBundleExecutable",
    "verifyMacAppBundleLauncher",
    "verifySignedExecutable",
    "\"-arch\"",
    "\"arm64\"",
    "--skip-sign",
    "--dry-run",
    "\"clang\"",
    "\"codesign\"",
    "\"--entitlements\""
  ]) {
    assert.ok(prepareScript.includes(expected), `macOS preparation CLI missing ${expected}`);
  }
  for (const expected of [
    "--steam-bridge-launch-target",
    "--steam-bridge-launch-app-id",
    "--steam-bridge-launch-overlay-game-id",
    "--steam-bridge-launch-env-file",
    "STEAM_BRIDGE_MACOS_NATIVE_LAUNCHER_TARGET",
    "%s/%s.electron"
  ]) {
    assert.ok(launcherTemplate.includes(expected), `macOS launcher template missing ${expected}`);
  }
  assert.ok(
    !launcherTemplate.includes("SteamBridgeSmoke"),
    "macOS launcher template must stay app-name generic"
  );
  assert.ok(
    matrixScript.includes("verify-macos-steam-signing.cjs"),
    "macOS overlay matrix must verify package signing before live cases"
  );
  for (const expected of [
    "require_macos_arm64_host",
    "Apple Silicon macOS (darwin/arm64)",
    "Intel macOS and Rosetta shells are unsupported"
  ]) {
    assert.ok(matrixScript.includes(expected), `macOS overlay matrix missing ${expected}`);
  }
  for (const expected of [
    "verifyMacAppBundleLauncher(appExe",
    "CFBundleExecutable",
    "Contents\", \"Info.plist",
    "/usr/bin/plutil"
  ]) {
    assert.ok(verifierScript.includes(expected), `macOS signing verifier missing ${expected}`);
  }
  assert.ok(
    prepareScript.indexOf("signExecutable(resolved.electronExe") <
      prepareScript.indexOf("signExecutable(resolved.appExe"),
    "macOS preparation CLI must sign the nested Electron executable before the launcher"
  );
}

function runWindowsSmokeHelperStaticChecks() {
  const helper = fs.readFileSync(path.join(repoRoot, "scripts", "windows-electron-smoke.ps1"), "utf8");
  for (const expected of [
    "presenter-ready",
    "presenter-web-open-and-wait",
    "presenter-duplicate-open-guard",
    "presenter-store-open-and-wait",
    "presenter-friends-open-and-wait",
    "presenter-dialog-auto-open-and-wait",
    "presenter-checkout",
    "presenter-shortcut",
    "presenter-shortcut-open-and-wait",
    "presenter-achievement-progress",
    "presenter-achievement-unlock",
    "--steam-bridge-smoke-diagnostic-dir=$DiagnosticDir",
    "--steam-bridge-smoke-web-url=$WebUrl",
    "--steam-bridge-smoke-checkout-transaction-id=$CheckoutTransactionId",
    "function Test-OverlayActiveEvent",
    "RequireOverlayActivated",
    "function Add-DefaultRequireEvents"
  ]) {
    assert.ok(helper.includes(expected), `Windows smoke helper missing ${expected}`);
  }
}

function runElectronSmokeActionStaticChecks() {
  const main = fs.readFileSync(path.join(repoRoot, "examples", "electron-basic", "main.js"), "utf8");
  const preload = fs.readFileSync(path.join(repoRoot, "examples", "electron-basic", "preload.js"), "utf8");
  const html = fs.readFileSync(path.join(repoRoot, "examples", "electron-basic", "index.html"), "utf8");
  const linuxHelper = fs.readFileSync(path.join(repoRoot, "scripts", "linux-electron-smoke.sh"), "utf8");
  const deckHelper = fs.readFileSync(path.join(repoRoot, "scripts", "steam-deck-smoke.sh"), "utf8");

  for (const [label, source, expected] of [
    ["Electron smoke main", main, "case \"presenter-ready\""],
    ["Electron smoke main", main, "case \"presenter-duplicate-open-guard\""],
    ["Electron smoke main", main, "overlay:presenter-ready"],
    ["Electron smoke main", main, "overlay:presenter-duplicate-open-guard"],
    ["Electron smoke main", main, "getNativeHostAvailability"],
    ["Electron smoke main", main, "steam-smoke:presenter-shortcut-status"],
    ["Electron smoke main", main, "openShortcutTarget()"],
    ["Electron smoke main", main, "getShortcutOpenStatus()"],
    ["Electron smoke main", main, "collectManagedOverlayOpenStatuses"],
    ["Electron smoke main", main, "getWebOpenStatus"],
    ["Electron smoke main", main, "getCheckoutOpenStatus"],
    ["Electron smoke main", main, "openStatuses"],
    ["Electron smoke main", main, "shortcutStatus"],
    ["Electron smoke preload", preload, "checkPresenterReady"],
    ["Electron smoke preload", preload, "openPresenterDuplicateOpenGuard"],
    ["Electron smoke preload", preload, "openPresenterProfileOpenAndWait"],
    ["Electron smoke preload", preload, "openPresenterPlayersOpenAndWait"],
    ["Electron smoke preload", preload, "openPresenterCommunityOpenAndWait"],
    ["Electron smoke preload", preload, "openPresenterStatsOpenAndWait"],
    ["Electron smoke preload", preload, "openPresenterAchievementsOpenAndWait"],
    ["Electron smoke preload", preload, "openPresenterUserOpenAndWait"],
    ["Electron smoke preload", preload, "getPresenterShortcutOpenStatus"],
    ["Electron smoke preload", preload, "openPresenterShortcutTarget"],
    ["Electron smoke preload", preload, "openPresenterShortcutTargetOpenAndWait"],
    ["Electron smoke UI", html, "presenter-ready"],
    ["Electron smoke UI", html, "presenter-duplicate-guard"],
    ["Electron smoke UI", html, "presenter-profile-wait"],
    ["Electron smoke UI", html, "presenter-players-wait"],
    ["Electron smoke UI", html, "presenter-community-wait"],
    ["Electron smoke UI", html, "presenter-stats-wait"],
    ["Electron smoke UI", html, "presenter-achievements-wait"],
    ["Electron smoke UI", html, "presenter-user-wait"],
    ["Electron smoke UI", html, "shortcut-status"],
    ["Electron smoke UI", html, "shortcut-open"],
    ["Electron smoke UI", html, "shortcut-wait"],
    ["Linux smoke helper", linuxHelper, "overlay:presenter-ready"],
    ["Linux smoke helper", linuxHelper, "presenter-duplicate-open-guard"],
    ["Steam Deck smoke helper", deckHelper, "overlay:presenter-ready"],
    ["Steam Deck smoke helper", deckHelper, "presenter-duplicate-open-guard"]
  ]) {
    assert.ok(source.includes(expected), `${label} missing ${expected}`);
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
  const installedPackageRoot = path.join(consumerDir, "node_modules", "steam-bridge");
  const macosPrepareApp = path.join(installedPackageRoot, "bin", "prepare-macos-app.cjs");
  const macosSigningVerifier = path.join(installedPackageRoot, "bin", "verify-macos-signing.cjs");
  const checkoutTargetValidator = path.join(installedPackageRoot, "bin", "validate-checkout-target.cjs");
  const macosLauncherTemplate = path.join(installedPackageRoot, "templates", "macos-steam-env-launcher.c");
  const macosEntitlementsTemplate = path.join(installedPackageRoot, "templates", "entitlements.steam.macos.plist");
  assertNonEmptyFile(macosPrepareApp);
  assertNonEmptyFile(macosSigningVerifier);
  assertNonEmptyFile(checkoutTargetValidator);
  assertNonEmptyFile(macosLauncherTemplate);
  assertNonEmptyFile(macosEntitlementsTemplate);
  assertExecutableFile(macosPrepareApp);
  assertExecutableFile(macosSigningVerifier);
  assertExecutableFile(checkoutTargetValidator);
  run("node", [macosPrepareApp, "--self-test"], { cwd: consumerDir });
  run("node", [macosSigningVerifier, "--self-test"], { cwd: consumerDir });
  run("node", [checkoutTargetValidator, "--self-test"], { cwd: consumerDir });

  fs.writeFileSync(
    path.join(consumerDir, "check-cjs.cjs"),
    `
const assert = require("node:assert/strict");
const steam = require("steam-bridge");
const electron = require("steam-bridge/electron");
const electronBuilder = require("steam-bridge/electron-builder");

assert.equal(typeof steam.init, "function");
assert.equal(typeof steam.default.init, "function");
assert.equal(typeof steam.default.openProfileOverlay, "function");
assert.equal(typeof steam.default.openCommunityOverlay, "function");
assert.equal(typeof steam.default.openStatsOverlay, "function");
assert.equal(typeof steam.default.openAchievementsOverlay, "function");
assert.equal(typeof steam.default.openDialogEquivalentOverlay, "function");
assert.equal(typeof steam.default.openSteamOverlay, "function");
assert.equal(typeof steam.default.createElectronSteamOverlay, "function");
assert.equal(typeof steam.createSteamWebApiClient, "function");
assert.equal(typeof steam.isOverlayNeedsPresentPollingEnabled, "function");
assert.equal(typeof steam.overlay.openNativeOverlayProbeWindow, "function");
assert.equal(typeof steam.overlay.activateDialogWithNativeSession, "function");
assert.equal(typeof steam.overlay.activateToWebPageWithNativeSession, "function");
assert.equal(typeof steam.overlay.activateToStoreWithNativeSession, "function");
assert.equal(typeof steam.overlay.attachPresenter, "function");
assert.equal(typeof steam.overlay.openWebOverlay, "function");
assert.equal(typeof steam.overlay.openFriendsOverlay, "function");
assert.equal(typeof steam.overlay.openProfileOverlay, "function");
assert.equal(typeof steam.overlay.openCommunityOverlay, "function");
assert.equal(typeof steam.overlay.openStatsOverlay, "function");
assert.equal(typeof steam.overlay.openAchievementsOverlay, "function");
assert.equal(typeof steam.overlay.openDialogEquivalentOverlay, "function");
assert.equal(typeof steam.overlay.openSteamOverlay, "function");
assert.equal(typeof steam.overlay.createElectronSteamOverlay, "function");
assert.equal(typeof steam.overlay.setNativeOverlayHostInputPassthrough, "function");
assert.equal(typeof steam.overlay.setNativeOverlayHostOpacity, "function");
assert.equal(typeof steam.utils.isOverlayNeedsPresentPollingEnabled, "function");
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
assert.equal(typeof electronBuilder.prepareMacosSteamAppAfterPack, "function");
assert.equal(typeof electronBuilder.verifyMacosSteamAppAfterSign, "function");
const skipped = electronBuilder.prepareMacosSteamAppAfterPack({
  appOutDir: "/tmp/steam-bridge-package-smoke",
  electronPlatformName: "linux",
  arch: "x64"
});
assert.equal(skipped.skipped, true);
assert.match(skipped.reason, /^non-macos-target:/);
assert.equal(electronBuilder.verifyMacosSteamAppAfterSign({
  appOutDir: "/tmp/steam-bridge-package-smoke",
  electronPlatformName: "win32",
  arch: "x64"
}).skipped, true);
assert.throws(() => electronBuilder.prepareMacosSteamAppAfterPack({
  appOutDir: "/tmp/steam-bridge-package-smoke",
  electronPlatformName: "darwin",
  arch: "x64",
  packager: { appInfo: { productFilename: "SteamBridgeSmoke" } }
}), /Apple Silicon arm64/);
`
  );

  fs.writeFileSync(
    path.join(consumerDir, "check-esm.mjs"),
    `
import assert from "node:assert/strict";
import steam, {
  createSteamWebApiClient,
  isOverlayNeedsPresentPollingEnabled,
  openDialogEquivalentOverlay,
  overlay,
  SteamworksEnums
} from "steam-bridge";
import * as electron from "steam-bridge/electron";
import * as electronBuilder from "steam-bridge/electron-builder";

assert.equal(typeof steam.init, "function");
assert.equal(typeof steam.openCommunityOverlay, "function");
assert.equal(typeof steam.openStatsOverlay, "function");
assert.equal(typeof steam.openAchievementsOverlay, "function");
assert.equal(typeof steam.openDialogEquivalentOverlay, "function");
assert.equal(typeof steam.openSteamOverlay, "function");
assert.equal(typeof openDialogEquivalentOverlay, "function");
assert.equal(typeof isOverlayNeedsPresentPollingEnabled, "function");
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
assert.equal(typeof overlay.openDialogEquivalentOverlay, "function");
assert.equal(typeof overlay.openSteamOverlay, "function");
assert.equal(typeof overlay.createElectronSteamOverlay, "function");
assert.equal(typeof overlay.setNativeOverlayHostInputPassthrough, "function");
assert.equal(typeof overlay.setNativeOverlayHostOpacity, "function");
assert.equal(typeof steam.utils.isOverlayNeedsPresentPollingEnabled, "function");
assert.equal(typeof steam.electronNativeOverlaySessionOptions, "function");
assert.equal(typeof steam.electronOverlayPresenterOptions, "function");
assert.equal(typeof steam.electronScrubSteamOverlayChildProcessEnv, "function");
assert.equal(SteamworksEnums.EResult.k_EResultOK, 1);
assert.equal(typeof electron.electronConfigureSteamOverlay, "function");
assert.equal(typeof electron.electronNativeOverlaySessionOptions, "function");
assert.equal(typeof electron.electronOverlayPresenterOptions, "function");
assert.equal(typeof electron.electronScrubSteamOverlayChildProcessEnv, "function");
assert.equal(electron.electronConfigureSteamOverlay({ profile: "off" }).profile, "off");
assert.equal(typeof electronBuilder.prepareMacosSteamAppAfterPack, "function");
assert.equal(typeof electronBuilder.verifyMacosSteamAppAfterSign, "function");
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
  isOverlayNeedsPresentPollingEnabled,
  overlay,
  STEAM_FRIENDS_OVERLAY_URL,
  SteamworksEnums,
  type ElectronSteamOverlay,
  type ElectronSteamOverlayNativeHostAvailability,
  type MacOverlayEnvironment,
  type NativeOverlayHostUnavailableReason,
  type OverlayDiagnostics,
  type SteamId,
  type SteamOverlayTarget
} from "steam-bridge";
import { electronConfigureSteamOverlay } from "steam-bridge/electron";
import { electronNativeOverlaySessionOptions } from "steam-bridge/electron";
import { electronOverlayPresenterOptions } from "steam-bridge/electron";
import { electronScrubSteamOverlayChildProcessEnv } from "steam-bridge/electron";
import {
  prepareMacosSteamAppAfterPack,
  verifyMacosSteamAppAfterSign,
  type ElectronBuilderAfterPackContext,
  type PrepareMacosSteamAppAfterPackResult
} from "steam-bridge/electron-builder";

const client = steam.init(480);
const web = createSteamWebApiClient({ apiKey: "test" });
const enumValue: number = SteamworksEnums.EResult.k_EResultOK;
const needsPresentPollingFn: () => boolean = isOverlayNeedsPresentPollingEnabled;
const needsPresentPollingUtilsFn: () => boolean = steam.utils.isOverlayNeedsPresentPollingEnabled;
const overlayFn: (title?: string) => void = overlay.openNativeOverlayProbeWindow;
const sessionFn = overlay.activateDialogWithNativeSession;
const webSessionFn = overlay.activateToWebPageWithNativeSession;
const storeSessionFn = overlay.activateToStoreWithNativeSession;
const presenterFn = overlay.attachPresenter;
const presenterWebFn = overlay.openWebOverlay;
const presenterFriendsFn = overlay.openFriendsOverlay;
const presenterProfileFn = overlay.openProfileOverlay;
const presenterCommunityFn = overlay.openCommunityOverlay;
const presenterStatsFn = overlay.openStatsOverlay;
const presenterAchievementsFn = overlay.openAchievementsOverlay;
const presenterSteamFn = overlay.openSteamOverlay;
const electronSteamOverlayFn = overlay.createElectronSteamOverlay;
const steamOverlayTarget: SteamOverlayTarget = { type: "friends" };
const profileOverlayTarget: SteamOverlayTarget = { type: "profile", steamId64: 76561198000000000n };
const inputPassthroughFn: (passThrough: boolean) => void = overlay.setNativeOverlayHostInputPassthrough;
const opacityFn: (opaque: boolean) => void = overlay.setNativeOverlayHostOpacity;
const friendsOverlayUrl: string = STEAM_FRIENDS_OVERLAY_URL;
const config = electronConfigureSteamOverlay({ profile: "off" });
const scrubbedKeys: string[] = electronScrubSteamOverlayChildProcessEnv({});
const afterPackContext: ElectronBuilderAfterPackContext = {
  appOutDir: "/tmp/steam-bridge-package-smoke",
  electronPlatformName: "linux",
  arch: "x64"
};
const afterPackResult: PrepareMacosSteamAppAfterPackResult =
  prepareMacosSteamAppAfterPack(afterPackContext);
const afterSignResult: PrepareMacosSteamAppAfterPackResult =
  verifyMacosSteamAppAfterSign(afterPackContext);
const afterPackSkipped: boolean = afterPackResult.skipped;
const afterSignSkipped: boolean = afterSignResult.skipped;
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
}, {
  autoPrepareForNotifications: true
});
const typedElectronSteamOverlay: ElectronSteamOverlay = electronSteamOverlay;
const nativeHostAvailability: ElectronSteamOverlayNativeHostAvailability =
  typedElectronSteamOverlay.getNativeHostAvailability();
const nativeHostAvailable: boolean = nativeHostAvailability.available;
const nativeHostAvailabilitySnapshot = nativeHostAvailability.snapshot;
const nativeHostAvailabilityReason: NativeOverlayHostUnavailableReason | undefined =
  nativeHostAvailability.reason;
const openIfAvailableResult = typedElectronSteamOverlay.openIfAvailable(steamOverlayTarget);
const openAndWaitPromise = typedElectronSteamOverlay.openAndWait(steamOverlayTarget, {
  showTimeoutMs: 15000,
  closeTimeoutMs: 300000
});
const openAndWaitIfAvailablePromise = typedElectronSteamOverlay.openAndWaitIfAvailable(steamOverlayTarget, {
  showTimeoutMs: 15000,
  closeTimeoutMs: 300000
});
const shortcutOpenResult = typedElectronSteamOverlay.openShortcutTargetIfAvailable();
const shortcutOpenAndWaitPromise = typedElectronSteamOverlay.openShortcutTargetAndWait({
  showTimeoutMs: 15000,
  closeTimeoutMs: 300000
});
const shortcutOpenAndWaitIfAvailablePromise = typedElectronSteamOverlay.openShortcutTargetAndWaitIfAvailable({
  showTimeoutMs: 15000,
  closeTimeoutMs: 300000
});
const checkoutPreparePromise = typedElectronSteamOverlay.withCheckoutPrepared(() => ({
  steamUrl: "https://checkout.steampowered.com/checkout/approvetxn/123/"
}));
const checkoutAndWaitPromise = typedElectronSteamOverlay.openCheckoutAndWait(() => ({
  steamUrl: "https://checkout.steampowered.com/checkout/approvetxn/123/"
}));
const checkoutAndWaitIfAvailablePromise = typedElectronSteamOverlay.openCheckoutAndWaitIfAvailable(() => ({
  steamUrl: "https://checkout.steampowered.com/checkout/approvetxn/123/"
}));
const checkoutTargetSnapshot = overlay.snapshotSteamOverlayTarget({
  type: "checkout",
  steamUrl: "https://checkout.steampowered.com/checkout/approvetxn/123/"
});
checkoutAndWaitPromise.then((result) => {
  const targetSnapshotType: "checkout" = result.targetSnapshot.type;
  void targetSnapshotType;
});
const waitError = new steam.SteamOverlayWaitTimeoutError("become active", 1);
const waitDiagnostics: OverlayDiagnostics | undefined = waitError.diagnostics;
const waitNativeHostUnavailable: NativeOverlayHostUnavailableReason | undefined = waitError.nativeHostUnavailableReason;
const waitMacEnvironment: MacOverlayEnvironment | undefined = waitError.macOverlayEnvironment;
const steamId: SteamId | undefined = undefined;

void client;
void web;
void enumValue;
void needsPresentPollingFn;
void needsPresentPollingUtilsFn;
void overlayFn;
void sessionFn;
void webSessionFn;
void storeSessionFn;
void presenterFn;
void presenterWebFn;
void presenterFriendsFn;
void presenterProfileFn;
void presenterCommunityFn;
void presenterStatsFn;
void presenterAchievementsFn;
void presenterSteamFn;
void electronSteamOverlayFn;
void steamOverlayTarget;
void profileOverlayTarget;
void typedElectronSteamOverlay;
void nativeHostAvailability;
void nativeHostAvailable;
void nativeHostAvailabilitySnapshot;
void nativeHostAvailabilityReason;
void openIfAvailableResult;
void openAndWaitPromise;
void openAndWaitIfAvailablePromise;
void shortcutOpenResult;
void shortcutOpenAndWaitPromise;
void shortcutOpenAndWaitIfAvailablePromise;
void checkoutPreparePromise;
void checkoutAndWaitPromise;
void checkoutAndWaitIfAvailablePromise;
void checkoutTargetSnapshot;
void waitDiagnostics;
void waitNativeHostUnavailable;
void waitMacEnvironment;
void inputPassthroughFn;
void opacityFn;
void friendsOverlayUrl;
void config;
void afterPackContext;
void afterPackResult;
void afterSignResult;
void afterPackSkipped;
void afterSignSkipped;
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

function assertExecutableFile(filePath) {
  const stat = fs.statSync(filePath);
  assert.ok(stat.isFile(), `${filePath} is not a file`);
  if (process.platform !== "win32") {
    assert.ok((stat.mode & 0o111) !== 0, `${filePath} is not executable`);
  }
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
