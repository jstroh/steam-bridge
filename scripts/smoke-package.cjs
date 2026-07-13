const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const vm = require("node:vm");
const { spawnSync } = require("node:child_process");

const repoRoot = path.resolve(__dirname, "..");
const packageRoot = path.join(repoRoot, "packages", "steam-bridge");
const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "steam-bridge-package-smoke-"));
const packDir = path.join(tempRoot, "pack");
const consumerDir = path.join(tempRoot, "consumer");
const keepTemp = process.env.STEAM_BRIDGE_KEEP_PACKAGE_SMOKE === "1";
const windowsCleanupSelfTestOnly = process.argv.includes("--windows-cleanup-self-test");
const GENERIC_USER_GESTURE_GATE_TARGET = "autorun-user-gesture-target";
const USER_GESTURE_ACTION_TARGETS = Object.freeze({
  "presenter-web-open-and-wait": "presenter-web-wait",
  "presenter-duplicate-open-guard": "presenter-duplicate-guard",
  "presenter-store-open-and-wait": GENERIC_USER_GESTURE_GATE_TARGET,
  "presenter-dialog-auto-open-and-wait": GENERIC_USER_GESTURE_GATE_TARGET,
  "presenter-friends-open-and-wait": GENERIC_USER_GESTURE_GATE_TARGET,
  "presenter-profile-open-and-wait": GENERIC_USER_GESTURE_GATE_TARGET,
  "presenter-players-open-and-wait": GENERIC_USER_GESTURE_GATE_TARGET,
  "presenter-community-open-and-wait": GENERIC_USER_GESTURE_GATE_TARGET,
  "presenter-stats-open-and-wait": GENERIC_USER_GESTURE_GATE_TARGET,
  "presenter-achievements-open-and-wait": GENERIC_USER_GESTURE_GATE_TARGET,
  "presenter-user-open-and-wait": GENERIC_USER_GESTURE_GATE_TARGET,
  "presenter-checkout": GENERIC_USER_GESTURE_GATE_TARGET,
  "presenter-shortcut": GENERIC_USER_GESTURE_GATE_TARGET,
  "presenter-shortcut-open-and-wait": GENERIC_USER_GESTURE_GATE_TARGET
});
const PERSISTENT_USER_GESTURE_ACTION_TARGETS = Object.freeze({
  "presenter-persistent-reuse-three-cycle": GENERIC_USER_GESTURE_GATE_TARGET
});
const ALL_USER_GESTURE_ACTION_TARGETS = Object.freeze({
  ...USER_GESTURE_ACTION_TARGETS,
  ...PERSISTENT_USER_GESTURE_ACTION_TARGETS
});
const WINDOWS_USER_GESTURE_CASE_ACTIONS = Object.freeze({
  "11-managed-web-open-and-wait": "presenter-web-open-and-wait",
  "11b-managed-duplicate-open-guard": "presenter-duplicate-open-guard",
  "12-managed-store-open-and-wait": "presenter-store-open-and-wait",
  "13-managed-friends-open-and-wait": "presenter-friends-open-and-wait",
  "14-managed-dialog-open-and-wait": "presenter-dialog-auto-open-and-wait",
  "15-managed-shortcut": "presenter-shortcut-open-and-wait",
  "15-managed-shortcut-keyboard": "presenter-shortcut",
  "16-managed-checkout-route": "presenter-checkout",
  "17-managed-profile-open-and-wait": "presenter-profile-open-and-wait",
  "18-managed-players-open-and-wait": "presenter-players-open-and-wait",
  "19-managed-community-open-and-wait": "presenter-community-open-and-wait",
  "20-managed-stats-open-and-wait": "presenter-stats-open-and-wait",
  "21-managed-achievements-open-and-wait": "presenter-achievements-open-and-wait",
  "22-managed-user-open-and-wait": "presenter-user-open-and-wait",
  "30-shortcut-friends-open-and-wait": "presenter-shortcut-open-and-wait",
  "30-shortcut-web-open-and-wait": "presenter-shortcut-open-and-wait",
  "30-shortcut-store-open-and-wait": "presenter-shortcut-open-and-wait",
  "30-shortcut-profile-open-and-wait": "presenter-shortcut-open-and-wait",
  "30-shortcut-players-open-and-wait": "presenter-shortcut-open-and-wait",
  "30-shortcut-community-open-and-wait": "presenter-shortcut-open-and-wait",
  "30-shortcut-stats-open-and-wait": "presenter-shortcut-open-and-wait",
  "30-shortcut-achievements-open-and-wait": "presenter-shortcut-open-and-wait",
  "30-shortcut-user-open-and-wait": "presenter-shortcut-open-and-wait",
  "30-shortcut-dialog-open-and-wait": "presenter-shortcut-open-and-wait",
  "02-checkout-approval": "presenter-checkout",
  "03-shortcut-checkout": "presenter-shortcut",
  "04-shortcut-checkout-open-and-wait": "presenter-shortcut-open-and-wait"
});

if (windowsCleanupSelfTestOnly) {
  try {
    assert.equal(process.platform, "win32", "Windows cleanup native self-test requires Windows");
    runWindowsExactProcessStopSelfTest();
    runWindowsTaskTreeAncestrySelfTest();
    runWindowsSteamContinuitySelfTest();
    console.log("Windows overlay cleanup native self-test passed.");
  } finally {
    if (keepTemp) {
      console.log(`Keeping Windows cleanup self-test temp directory: ${tempRoot}`);
    } else {
      fs.rmSync(tempRoot, { recursive: true, force: true });
    }
  }
} else try {
  fs.mkdirSync(packDir);
  fs.mkdirSync(consumerDir);

  run("node", [path.join(repoRoot, "scripts", "assert-electron-smoke-version.cjs")], { cwd: repoRoot });
  run("node", [path.join(repoRoot, "scripts", "native-binding-manifest.cjs")], { cwd: repoRoot });
  run("node", [path.join(repoRoot, "scripts", "windows-release-candidate-fingerprint.cjs"), "--self-test"], {
    cwd: repoRoot
  });
  run("node", [path.join(repoRoot, "scripts", "windows-live-proof-receipt.cjs"), "--self-test"], {
    cwd: repoRoot
  });
  run("node", [path.join(repoRoot, "examples", "electron-basic", "native-binding-probe.cjs")], {
    cwd: repoRoot
  });
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
  run("node", [path.join(repoRoot, "scripts", "summarize-windows-overlay-matrix.cjs"), "--self-test"], {
    cwd: repoRoot
  });
  run("node", [path.join(repoRoot, "scripts", "verify-windows-packaged-artifacts.cjs"), "--self-test"], {
    cwd: repoRoot
  });
  run("node", [path.join(repoRoot, "scripts", "windows-electron-builder-asar-gate.cjs"), "--self-test"], {
    cwd: repoRoot
  });
  run("node", [path.join(repoRoot, "scripts", "publish-release-candidate.cjs"), "--self-test"], {
    cwd: repoRoot
  });
  runPackagedWindowsOverlaySummarySelfTest();
  run("node", [path.join(repoRoot, "scripts", "upsert-steam-app-launch-options.cjs"), "--mode", "self-test"], {
    cwd: repoRoot
  });
  run("node", [path.join(repoRoot, "scripts", "verify-macos-steam-signing.cjs"), "--self-test"], {
    cwd: repoRoot
  });
  runMacosEntitlementsStaticChecks();
  runMacosPackageSigningStaticChecks();
  runElectronSmokeActionStaticChecks();
  runElectronPreloadUserGestureGateSelfTest();
  runWindowsSmokeHelperStaticChecks();
  runWindowsExactProcessStopSelfTest();
  runWindowsTaskTreeAncestrySelfTest();

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
  const initTxnScript = fs.readFileSync(path.join(packageRoot, "bin", "init-client-txn.cjs"), "utf8");
  const prepareScript = fs.readFileSync(path.join(packageRoot, "bin", "prepare-macos-app.cjs"), "utf8");
  const checkoutValidatorScript = fs.readFileSync(path.join(packageRoot, "bin", "validate-checkout-target.cjs"), "utf8");
  const verifierScript = fs.readFileSync(path.join(packageRoot, "bin", "verify-macos-signing.cjs"), "utf8");
  const launcherTemplate = fs.readFileSync(path.join(packageRoot, "templates", "macos-steam-env-launcher.c"), "utf8");
  assert.equal(
    packageJson.bin?.["steam-bridge-init-client-txn"],
    "bin/init-client-txn.cjs",
    "steam-bridge package must expose the InitTxn capture CLI"
  );
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
  assertExecutableFile(path.join(packageRoot, "bin", "init-client-txn.cjs"));
  assert.equal(
    packageJson.exports?.["./electron-builder"]?.default,
    "./dist/electron-builder.js",
    "steam-bridge package must expose the electron-builder helper subpath"
  );
  assertExecutableFile(path.join(packageRoot, "bin", "prepare-macos-app.cjs"));
  assertExecutableFile(path.join(packageRoot, "bin", "validate-checkout-target.cjs"));
  assertExecutableFile(path.join(packageRoot, "bin", "verify-macos-signing.cjs"));
  assert.ok(
    checkoutValidatorScript.includes("defaults.expectedAppId = options.expectedAppId"),
    "checkout target validator must pass expected app ID into checkoutTargetFromResult"
  );
  assert.ok(
    checkoutValidatorScript.includes("checkout JSON app ID does not match --expected-app-id"),
    "checkout target validator must preserve a redacted app ID mismatch error"
  );
  for (const expected of [
    "steam-bridge-init-client-txn",
    "publisher Web API key",
    "initClientTxn",
    "client-default",
    "checkoutTargetFromResult",
    "clientSession: true",
    "App ID 480 only proves generic checkout routing",
    "fchmodSync"
  ]) {
    assert.ok(initTxnScript.includes(expected), `InitTxn capture CLI missing ${expected}`);
  }
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
    "checkout-proof.cjs",
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
    readme,
    /macOS overlay matrix checks that it is running in a native Apple Silicon\s+`darwin\/arm64` shell before it packages or launches/,
    "README must document that the macOS overlay matrix checks Apple Silicon before packaging or launch"
  );
  assert.match(
    packageReadme,
    /## Platform Targets[\s\S]*### macOS Apple Silicon Only/,
    "package README must make the Apple Silicon-only macOS target policy prominent"
  );
  assert.match(
    packageReadme,
    /Build and\s+run macOS test\s+apps only on native `darwin\/arm64` Apple Silicon hosts/,
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
  assert.match(
    exampleReadme,
    /macOS overlay matrix checks for a native Apple Silicon `darwin\/arm64` shell\s+before it packages or launches this smoke app/,
    "Electron example README must document that the macOS overlay matrix checks Apple Silicon before packaging or launch"
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
    "STEAM_BRIDGE_MACOS_ENV_LAUNCHER_V1",
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
    packagerScript.includes("sign-windows-package.ps1"),
    "Windows Electron package must include the Authenticode signing helper"
  );
  assert.ok(
    packagerScript.includes("windows-app-control-dev-mode.ps1"),
    "Windows Electron package must include the App Control development-mode helper"
  );
  assert.ok(
    packagerScript.includes("windows-overlay-matrix.ps1"),
    "Windows Electron package must include the overlay matrix runner"
  );
  assert.ok(
    packagerScript.includes("windows-overlay-task.ps1"),
    "Windows Electron package must include the interactive overlay task wrapper"
  );
  assert.ok(
    packagerScript.includes("windows-render-health-probe.ps1"),
    "Windows Electron package must include the render health probe"
  );
  assert.ok(
    packagerScript.includes("summarize-windows-overlay-matrix.cjs"),
    "Windows Electron package must include the overlay matrix summarizer"
  );
  assert.ok(
    packagerScript.includes('path.join(appPath, "checkout-proof.cjs")') &&
      packagerScript.includes('[matrixSummaryPath, "--self-test"]'),
    "Windows Electron package must include and exercise the summarizer checkout-proof dependency"
  );
  assert.ok(
    packagerScript.includes("upsert-steam-shortcut.cjs"),
    "Windows Electron package must include the Steam shortcut updater"
  );
  assert.ok(
    packagerScript.includes("upsert-steam-app-launch-options.cjs"),
    "Windows Electron package must include the real Steam app launch-options updater"
  );
  assert.ok(
    packagerScript.includes("windows-steam-app-launch-options.ps1"),
    "Windows Electron package must include the real Steam app launch-options PowerShell wrapper"
  );
  assert.ok(
    matrixScript.includes("verify-macos-steam-signing.cjs"),
    "macOS overlay matrix must verify package signing before live cases"
  );
  assert.match(
    matrixScript,
    /ensure_ready\(\) \{\s+validate_checkout_json_file\s+require_macos_arm64_host\s+if \[ "\$skip_package" != "1" \]; then\s+npm run example:package:mac/,
    "macOS overlay matrix must check for native Apple Silicon before packaging or launching the smoke app"
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
    "verifySteamLauncherIdentity(appExe",
    "verifyRenamedElectronIsNotLauncher(`${appExe}.electron`",
    "STEAM_BRIDGE_MACOS_ENV_LAUNCHER_V1",
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
  const signingHelper = fs.readFileSync(path.join(repoRoot, "scripts", "sign-windows-package.ps1"), "utf8");
  const appControlDevModeHelper = fs.readFileSync(
    path.join(repoRoot, "scripts", "windows-app-control-dev-mode.ps1"),
    "utf8"
  );
  const matrixHelper = fs.readFileSync(path.join(repoRoot, "scripts", "windows-overlay-matrix.ps1"), "utf8");
  const taskWrapper = fs.readFileSync(path.join(repoRoot, "scripts", "windows-overlay-task.ps1"), "utf8");
  const renderHealthHelper = fs.readFileSync(path.join(repoRoot, "scripts", "windows-render-health-probe.ps1"), "utf8");
  const steamAppLaunchOptionsHelper = fs.readFileSync(
    path.join(repoRoot, "scripts", "upsert-steam-app-launch-options.cjs"),
    "utf8"
  );
  const steamAppLaunchOptionsWrapper = fs.readFileSync(
    path.join(repoRoot, "scripts", "windows-steam-app-launch-options.ps1"),
    "utf8"
  );
  const nativeControlSource = fs.readFileSync(
    path.join(repoRoot, "scripts", "windows-native-overlay-control", "SteamBridgeNativeOverlayControl.cs"),
    "utf8"
  );
  const nativeControlHelper = fs.readFileSync(
    path.join(repoRoot, "scripts", "windows-native-overlay-control.ps1"),
    "utf8"
  );
  const windowsAsarConfig = fs.readFileSync(
    path.join(repoRoot, "fixtures", "windows-electron-builder-asar", "electron-builder.config.cjs"),
    "utf8"
  );
  const windowsAsarGate = fs.readFileSync(
    path.join(repoRoot, "scripts", "windows-electron-builder-asar-gate.cjs"),
    "utf8"
  );
  const windowsArtifactVerifier = fs.readFileSync(
    path.join(repoRoot, "scripts", "verify-windows-packaged-artifacts.cjs"),
    "utf8"
  );
  const releaseCandidatePublisher = fs.readFileSync(
    path.join(repoRoot, "scripts", "publish-release-candidate.cjs"),
    "utf8"
  );
  const liveProofReceipt = fs.readFileSync(
    path.join(repoRoot, "scripts", "windows-live-proof-receipt.cjs"),
    "utf8"
  );
  const releaseWorkflow = fs.readFileSync(path.join(repoRoot, ".github", "workflows", "release.yml"), "utf8");
  const cargoConfig = fs.readFileSync(path.join(repoRoot, ".cargo", "config.toml"), "utf8");
  const nativeBuildScript = fs.readFileSync(path.join(repoRoot, "crates", "native", "build.rs"), "utf8");
  const matrixSummary = fs.readFileSync(path.join(repoRoot, "scripts", "summarize-windows-overlay-matrix.cjs"), "utf8");
  const nativeSurfaceSource = fs.readFileSync(
    path.join(repoRoot, "crates", "native", "src", "native_surface.rs"),
    "utf8"
  );
  const electronHelper = fs.readFileSync(path.join(repoRoot, "packages", "steam-bridge", "src", "electron.ts"), "utf8");
  const packageReadme = fs.readFileSync(path.join(repoRoot, "packages", "steam-bridge", "README.md"), "utf8");
  const exampleReadme = fs.readFileSync(path.join(repoRoot, "examples", "electron-basic", "README.md"), "utf8");
  const electronSmokeMain = fs.readFileSync(path.join(repoRoot, "examples", "electron-basic", "main.js"), "utf8");
  const closeProbeTemplateStart = matrixHelper.indexOf('$probeScript = @"');
  const closeProbeTemplateEnd = matrixHelper.indexOf('\n"@', closeProbeTemplateStart);
  assert.ok(
    closeProbeTemplateStart >= 0 && closeProbeTemplateEnd > closeProbeTemplateStart,
    "Windows matrix must retain one bounded expandable close-probe template"
  );
  const closeProbeTemplate = matrixHelper.slice(closeProbeTemplateStart, closeProbeTemplateEnd);
  assert.doesNotMatch(
    closeProbeTemplate,
    /`\s*$/m,
    "Windows expandable close-probe template must not consume a generated-script line continuation"
  );
  for (const [label, source] of [
    ["Windows smoke helper", helper],
    ["Windows matrix", matrixHelper],
    ["Windows native control", nativeControlHelper],
    ["Windows signing helper", signingHelper]
  ]) {
    assert.ok(source.includes("resources\\app.asar.unpacked\\node_modules\\steam-bridge"), `${label} must resolve ASAR-unpacked runtime files`);
    for (const fileName of [
      "steam_bridge_native.win32-x64-msvc.node",
      "steam_api64.dll",
      "sdkencryptedappticket64.dll"
    ]) {
      assert.ok(source.includes(fileName), `${label} must require ${fileName}`);
    }
  }
  for (const expected of [
    'productName: "SteamBridgeSmoke"',
    "smartUnpack: false",
    "npmRebuild: false",
    'signExts: [".node"]',
    '"smoke/**/*"',
    "extraFiles"
  ]) {
    assert.ok(windowsAsarConfig.includes(expected), `Windows ASAR fixture config missing ${expected}`);
  }
  for (const expected of [
    "exact-npm-pack-tarball",
    "assertNoPostInstallRepair",
    "assertMatchingRuntimeFiles",
    "verifyAsarLayout",
    "runPackagedExecutable",
    "getAuthenticodeEvidence",
    "sanitizedChildEnvironment",
    "isolatedCandidateEnvironment",
    "createDeterministicBundleArchive",
    "runtimeDllPreservation",
    "verifyLiveSmokeCapability",
    "asarEntryPath",
    "path.win32",
    "preserveFailureExitCode",
    "file:.package-input/steam-bridge.tgz",
    "npm JavaScript CLI from npm_execpath"
  ]) {
    assert.ok(windowsAsarGate.includes(expected), `Windows ASAR gate missing ${expected}`);
  }
  assert.ok(
    windowsAsarGate.includes("windows-live-proof-receipt.cjs") &&
      windowsAsarGate.includes("windows-release-candidate-fingerprint.cjs"),
    "Windows ASAR gate must package the candidate fingerprint and live-proof receipt tools"
  );
  for (const expected of [
    "IMAGE_FILE_MACHINE_AMD64",
    "PE32_PLUS_MAGIC",
    "napi_register_module_v1",
    "readPeImports",
    "readPeDelayImports",
    "api-ms-win-crt-",
    "authenticodeContentSha256"
  ]) {
    assert.ok(windowsArtifactVerifier.includes(expected), `Windows artifact verifier missing ${expected}`);
  }
  assert.ok(
    cargoConfig.includes("target.x86_64-pc-windows-msvc") &&
      cargoConfig.includes("target-feature=+crt-static") &&
      nativeBuildScript.includes("static_crt(true)"),
    "Windows Rust and C++ native builds must link the MSVC/UCRT runtime statically"
  );
  for (const expected of [
    "--publish",
    "npm",
    "publish",
    "audit.package?.tarball",
    "executableProbe?.ok",
    "--bundle-archive",
    "--live-proof-receipt",
    "npm publication requires a matching Windows live-proof receipt",
    "createVerifiedPublishCopy",
    "validatePublishTag",
    "shell: false",
    "npm JavaScript CLI from npm_execpath"
  ]) {
    assert.ok(releaseCandidatePublisher.includes(expected), `Release-candidate publisher missing ${expected}`);
  }
  assert.ok(
    releaseWorkflow.includes("windows-package-gate:") &&
      releaseWorkflow.includes("npm run release:assemble") &&
      releaseWorkflow.includes("npm run windows:package-gate") &&
      releaseWorkflow.includes("--require-signed") &&
      releaseWorkflow.includes("npm run release:publish-candidate") &&
      releaseWorkflow.includes("--require-publishable") &&
      releaseWorkflow.includes("*-win-unpacked.tar") &&
      releaseWorkflow.includes("--bundle-archive"),
    "Release workflow must gate the fully assembled publish tarball in a Windows electron-builder ASAR package"
  );
  assert.doesNotMatch(releaseWorkflow, /(?:^|\s)--publish(?:\s|$)/m, "Release workflow must remain candidate-only");
  assert.ok(
    !releaseWorkflow.includes("--live-proof-receipt"),
    "Release workflow must not fabricate a live-proof receipt before Windows live testing"
  );
  for (const expected of [
    "TOTAL_CASE_COUNT, 31",
    "TOTAL_ACTIVE_CASE_COUNT, 27",
    "--candidate-directory",
    "privateEnvImported",
    "webUrlUsesPublicDefault",
    "hasCheckoutUrl",
    "cleanStaleOverlayHelpers",
    "taskRunLevel",
    "sameSteamIdentityAcrossProfiles",
    "verifyCandidateDirectory",
    "readAndValidateLiveProofReceipt"
  ]) {
    assert.ok(liveProofReceipt.includes(expected), `Windows live-proof receipt missing ${expected}`);
  }
  assert.ok(
    matrixHelper.includes("resources\\steam-bridge-tools") &&
      matrixHelper.includes("bin\\validate-checkout-target.cjs") &&
      matrixHelper.includes("dist\\index.js") &&
      matrixHelper.includes("must stay package-relative"),
    "Windows ASAR checkout validation must preserve the validator CLI and dist runtime as one package-relative tool tree"
  );
  for (const expected of [
    '[ValidateSet("Limited", "Highest")]',
    '[string]$TaskRunLevel = "Limited"',
    'taskRunLevel: {0}',
    '$TaskRunLevel.ToUpperInvariant()'
  ]) {
    assert.ok(taskWrapper.includes(expected), `Windows overlay task wrapper missing ${expected}`);
  }
  const nativeExitCapture = taskWrapper.slice(
    taskWrapper.indexOf("function Invoke-NativeExitCode"),
    taskWrapper.indexOf("function Split-MatrixArgumentNameValue")
  );
  for (const expected of [
    '$result = [ordered]@{',
    'exitCodeCaptured = $false',
    'exitCode = $null',
    '$previousErrorActionPreference = $ErrorActionPreference',
    '$ErrorActionPreference = "Continue"',
    '$global:LASTEXITCODE = $null',
    '& $FilePath @Arguments 1> $null 2> $null',
    '$result.exitCodeCaptured = $true',
    '$result.exitCode = [int]$global:LASTEXITCODE',
    '} catch {',
    '$result.exitCodeCaptured = $false',
    '$result.exitCode = $null',
    '} finally {',
    '$ErrorActionPreference = $previousErrorActionPreference',
    'return [PSCustomObject]$result'
  ]) {
    assert.ok(nativeExitCapture.includes(expected), `Windows native exit capture missing ${expected}`);
  }
  const taskTreeTracking = taskWrapper.slice(
    taskWrapper.indexOf("function Get-TaskProcessStartTicks"),
    taskWrapper.indexOf("function Start-TaskRunnerTreeGuard")
  );
  for (const expected of [
    "function Test-TaskRunnerTreeParentChild",
    "$childStartTicks -ge $parentStartTicks",
    "nativeStartTicks = $nativeStartTicks",
    "$State.ancestryRejectionCount += 1",
    "if (Add-TaskRunnerTreeIdentity -State $State -Process $process -Root $false)",
    "if (-not $capturedRoot)"
  ]) {
    assert.ok(taskTreeTracking.includes(expected), `Windows task-tree ancestry guard missing ${expected}`);
  }
  const taskTreeCleanup = taskWrapper.slice(
    taskWrapper.indexOf("function Start-TaskRunnerTreeGuard"),
    taskWrapper.indexOf("function Stop-AndVerifyTaskSmokePackageProcesses")
  );
  assert.ok(
    taskTreeCleanup.includes("ancestryRejectionCount = [int]$State.ancestryRejectionCount"),
    "Windows task-tree cleanup must record ancestry rejection evidence"
  );
  assert.ok(
    taskTreeCleanup.includes("-ExpectedStartTicks ([int64]$rootIdentity.nativeStartTicks)") &&
      (taskTreeCleanup.match(/-ExpectedStartTicks \(\[int64\]\$identity\.nativeStartTicks\)/g) || []).length >= 2,
    "Windows runner-tree cleanup must terminate only the stored native identities"
  );
  assert.doesNotMatch(
    taskTreeCleanup,
    /taskkill(?:\.exe)?|Stop-Process\s+-Id/i,
    "Windows runner-tree cleanup must terminate only through the exact-handle guard"
  );
  const taskPackageCleanup = taskWrapper.slice(
    taskWrapper.indexOf("function Stop-AndVerifyTaskSmokePackageProcesses"),
    taskWrapper.indexOf("function Remove-AndVerifyTaskFiles")
  );
  assert.doesNotMatch(
    taskPackageCleanup,
    /taskkill(?:\.exe)?|Stop-Process\s+-Id/i,
    "Windows task package cleanup must terminate only through the exact-handle guard"
  );
  assert.ok(
    taskPackageCleanup.includes("-ExpectedStartTicks $nativeStartTicks"),
    "Windows task package cleanup must pass the captured native identity to termination"
  );
  const taskExactStopRuntime = taskWrapper.slice(
    taskWrapper.indexOf('if (-not ("SteamBridgeExactProcessStop" -as [type]))'),
    taskWrapper.indexOf("function Add-ExactProcessStopEvidence")
  ).trim();
  const matrixExactStopRuntime = matrixHelper.slice(
    matrixHelper.indexOf('if (-not ("SteamBridgeExactProcessStop" -as [type]))'),
    matrixHelper.indexOf("$CloseProbeEvidenceSchema")
  ).trim();
  assert.equal(
    taskExactStopRuntime,
    matrixExactStopRuntime,
    "Windows task and matrix cleanup must share the exact tested handle-bound stop runtime"
  );
  for (const expected of [
    "SafeProcessHandle",
    "CaptureExactStartTicks",
    "OpenProcess(access, false",
    "GetProcessTimes(process",
    "actualCreationTicks != expectedNativeCreationTicks",
    "TerminateProcess(process, 1)",
    "WaitForSingleObject(process",
    '"identity-mismatch"',
    '"already-exited"'
  ]) {
    assert.ok(taskExactStopRuntime.includes(expected), `Windows exact process stop runtime missing ${expected}`);
  }
  const matrixProcessCleanup = matrixHelper.slice(
    matrixHelper.indexOf("function Stop-StaleSteamOverlayHelpers"),
    matrixHelper.indexOf("function Start-LaunchEnvRollbackTransaction")
  );
  assert.doesNotMatch(
    matrixProcessCleanup,
    /taskkill(?:\.exe)?|Stop-Process\s+-Id/i,
    "Windows matrix cleanup must terminate only through the exact-handle guard"
  );
  assert.ok(
    matrixProcessCleanup.includes("Get-ExactProcessNativeStartTicks") &&
      matrixProcessCleanup.includes("Invoke-ExactProcessStop") &&
      (matrixProcessCleanup.match(/-ExpectedStartTicks \$nativeStartTicks/g) || []).length >= 2,
    "Windows matrix cleanup must capture and terminate exact process identities"
  );
  const taskCleanupFinally = taskWrapper.slice(taskWrapper.lastIndexOf("} finally {"));
  assert.ok(
    taskCleanupFinally.indexOf("$runnerProcessGuard = Start-TaskRunnerTreeGuard") <
      taskCleanupFinally.indexOf("$endResult = Invoke-NativeExitCode") &&
      taskCleanupFinally.indexOf("$endResult = Invoke-NativeExitCode") <
        taskCleanupFinally.indexOf("$runnerProcessGuard = Complete-TaskRunnerTreeGuard") &&
      taskCleanupFinally.indexOf("$runnerProcessGuard = Complete-TaskRunnerTreeGuard") <
        taskCleanupFinally.indexOf("$deleteResult = Invoke-NativeExitCode") &&
      taskCleanupFinally.indexOf("$deleteResult = Invoke-NativeExitCode") <
        taskCleanupFinally.indexOf("$queryResult = Invoke-NativeExitCode") &&
      taskCleanupFinally.indexOf("$queryResult = Invoke-NativeExitCode") <
        taskCleanupFinally.indexOf("$packageProcessGuard = Stop-AndVerifyTaskSmokePackageProcesses") &&
      taskCleanupFinally.indexOf("$packageProcessGuard = Stop-AndVerifyTaskSmokePackageProcesses") <
        taskCleanupFinally.indexOf("$launchEnvGuardEvidence = Complete-TaskLaunchEnvGuard") &&
      taskCleanupFinally.indexOf("$launchEnvGuardEvidence = Complete-TaskLaunchEnvGuard") <
        taskCleanupFinally.indexOf("$taskFileGuard = Remove-AndVerifyTaskFiles") &&
      taskCleanupFinally.indexOf("$taskFileGuard = Remove-AndVerifyTaskFiles") <
        taskCleanupFinally.indexOf("[System.IO.File]::WriteAllText("),
    "Windows task cleanup must terminate the captured tree, end/delete the task, clean package processes, restore launch env, then remove handoff files"
  );
  assert.doesNotMatch(
    taskWrapper,
    /Get-Content\s+-LiteralPath\s+\$logPath\s+-Tail/,
    "Windows task wrapper must not stream its private handoff transcript"
  );
  assert.match(
    taskWrapper,
    /if \(\$KeepTask\) \{\s*Write-Host \("  taskFiles: \{0\}" -f \$runDir\)\s*\} else \{\s*Write-Host "  taskFiles: configured"\s*\}/,
    "Windows task wrapper must print the handoff directory only for explicit KeepTask runs"
  );
  assert.doesNotMatch(
    taskWrapper,
    /TASK_ERROR|\$_\.Exception\.Message|artifactRoot\s*=\s*if \(\$config\.arguments/,
    "Windows task runner must neither print nor retain raw invocation errors or artifact paths"
  );
  for (const expected of [
    'failureStage = "success"',
    'failureStage = "private-env-import"',
    'failureStage = "matrix-argument-binding"',
    'failureStage = "matrix-invocation"',
    'failureStage = "matrix-exit"',
    'errorKind = "none"',
    'errorKind = "private-env-error"',
    'errorKind = "matrix-argument-error"',
    'errorKind = "matrix-invocation-error"',
    'errorKind = "matrix-nonzero-exit"',
    "errorPresent = $errorPresent",
    "artifactRootPresent = ($config.arguments.Count",
    "$doneFailureStage = [string]$done.failureStage",
    "$doneErrorKind = [string]$done.errorKind",
    "$doneErrorPresent = ($done.errorPresent -eq $true)",
    "$doneFailureContracts.ContainsKey($doneFailureStage)",
    "Scheduled task done status did not match the sanitized failure contract.",
    "$activeRunnerTree = @(Update-TaskRunnerTreeState",
    "$confirmedRunnerTree = @(Update-TaskRunnerTreeState",
    "$runnerTerminatedWithoutDone = $true",
    '$taskFailureStage = "runner-termination"',
    '$taskErrorKind = "done-missing"',
    '$taskFailureStage = "runner-timeout"',
    '$taskErrorKind = "deadline-exceeded"',
    "runnerTerminatedWithoutDone = $runnerTerminatedWithoutDone"
  ]) {
    assert.ok(taskWrapper.includes(expected), `Windows task sanitized done contract missing ${expected}`);
  }
  assert.doesNotMatch(
    taskWrapper,
    /DONE_JSON_MISSING/,
    "Windows task wrapper must classify missing done status by tracked-tree exit or live-tree deadline"
  );
  for (const expected of ["function readJsonFile", 'replace(/^\\uFEFF/, "")']) {
    assert.ok(electronSmokeMain.includes(expected), `Electron smoke app missing ${expected}`);
  }
  const ensureOverlayStart = electronSmokeMain.indexOf("function ensureElectronSteamOverlay(");
  const ensureOverlayEnd = electronSmokeMain.indexOf("\nfunction ", ensureOverlayStart + 1);
  assert.ok(ensureOverlayStart >= 0 && ensureOverlayEnd > ensureOverlayStart, "Electron smoke app missing overlay factory");
  const ensureOverlaySource = electronSmokeMain.slice(ensureOverlayStart, ensureOverlayEnd);
  assert.ok(
    !/\bpollIntervalMs\s*:/.test(ensureOverlaySource),
    "Electron smoke app must exercise the platform presenter polling default"
  );
  assert.ok(
    exampleReadme.includes("The helper leaves `-OverlayInProcessGpu` unset on Windows by default"),
    "Electron example README must document that Windows leaves in-process GPU unset by default"
  );
  assert.ok(
    !exampleReadme.includes("The helper defaults `-OverlayInProcessGpu 1` on Windows"),
    "Electron example README must not describe in-process GPU as the Windows default"
  );
  assert.ok(
    packageReadme.includes("`-Name=value`/`-Name:value` forms") &&
      packageReadme.includes("redacts sensitive inline values") &&
      packageReadme.includes("`-MatrixArgsFile` is still the preferred shape"),
    "package README must document Windows task wrapper inline argument redaction"
  );
  assert.ok(
    exampleReadme.includes("`-Name=value`/`-Name:value` forms") &&
      exampleReadme.includes("Sensitive inline values") &&
      exampleReadme.includes("JSON args file remains the least surprising option"),
    "Electron example README must document Windows task wrapper inline argument redaction"
  );
  for (const expected of [
    'schtasks.exe /End /TN "<taskName>"',
    'schtasks.exe /Delete /TN "<taskName>" /F',
    "Remove-Item C:\\sb\\<runId> -Recurse -Force",
    "These commands are destructive.",
    "never remove `C:\\sb` as a whole"
  ]) {
    assert.ok(exampleReadme.includes(expected), `Electron example README missing KeepTask cleanup warning: ${expected}`);
  }
  for (const expected of [
    "atomically writes the actionable",
    "case-local `external-foreground-ready.json`",
    "copy `action`, `requestOrdinal`, `mechanism`, and `challenge`",
    "must not hardcode the web action",
    "arms the listener",
    "exactly one safe title-bar click",
    "external-foreground-ack.json",
    "acknowledgment only after the click returned success",
    "does not by itself identify the physical input that caused it",
    "stale parent-PID matches are rejected and counted",
    "requires that stored exact identity",
    "never uses recursive `taskkill /T` or a PID-only stop",
    "Steam's exact identity after wrapper cleanup"
  ]) {
    assert.ok(
      exampleReadme.replace(/\s+/g, " ").includes(expected),
      `Electron example README missing Windows safety guidance: ${expected}`
    );
  }
  assert.ok(
    matrixHelper.includes('$text -notlike "Steam launch options:*"') &&
      matrixHelper.includes('$text -notlike "Steam shortcut launch options:*"') &&
      matrixHelper.includes('$text -notlike "Launch URL:*"') &&
      matrixHelper.includes("Computed Windows shortcut launch options do not include the smoke env file.") &&
      matrixHelper.includes(
        "Computed Windows shortcut launch options do not route Electron logging outside the package."
      ),
    "Windows matrix must parse only the actual shortcut launch options line"
  );
  assert.ok(
    matrixHelper.includes("function Get-LatestSteamProcessStartUtc") &&
      matrixHelper.includes("currentSteamStartUtc") &&
      matrixHelper.includes("effectiveRecentCutoffUtc") &&
      matrixHelper.includes("Get-SteamClientRenderingHealth -CurrentSteamStartUtc"),
    "Windows live readiness must classify Steam client log health relative to the current Steam process"
  );
  assert.ok(
    matrixHelper.includes("function Get-SmokePackageProcesses") &&
      matrixHelper.includes("function Stop-SmokePackageProcesses") &&
      matrixHelper.includes("smoke-process-cleanup-before-run.json") &&
      matrixHelper.includes("smoke-process-cleanup-after-render-health.json") &&
      matrixHelper.includes("smoke-process-cleanup-after-cases.json"),
    "Windows matrix must clean up package-owned smoke processes before and after live proof"
  );
  const processCleanupStart = matrixHelper.indexOf("function Stop-SmokePackageProcesses");
  const processCleanupEnd = matrixHelper.indexOf("\nfunction Start-LaunchEnvRollbackTransaction", processCleanupStart);
  const processCleanupBlock = matrixHelper.slice(processCleanupStart, processCleanupEnd);
  assert.ok(
    processCleanupStart >= 0 &&
      processCleanupEnd > processCleanupStart &&
      processCleanupBlock.includes("packageAppDirPresent") &&
      processCleanupBlock.includes("creationDatePresent") &&
      processCleanupBlock.includes("executablePathPresent") &&
      processCleanupBlock.includes("commandLinePresent") &&
      processCleanupBlock.includes('"exact-process-stop-failed"'),
    "Windows process cleanup artifacts must record sanitized presence/status evidence"
  );
  assert.doesNotMatch(
    processCleanupBlock,
    /packageAppDir\s*=|processesBeforeCleanup\s*=\s*@\(\$before\)|processesAfterCleanup\s*=\s*@\(\$after\)|error\s*=\s*\$_\.Exception\.Message/,
    "Windows process cleanup artifacts must not write package paths, command lines, or raw errors"
  );
  assert.doesNotMatch(
    matrixHelper,
    /launchEnvFile:\s*\{0\}"\s*-f\s*\$LaunchEnvFile/,
    "Windows matrix transcript must not print the launch-env path"
  );
  assert.doesNotMatch(
    helper,
    /Wrote Steam Bridge smoke env file:\s*\$SmokeEnvFile/,
    "Windows smoke helper logs must not print the launch-env path"
  );
  assert.ok(
    matrixHelper.includes("function ConvertTo-SanitizedShortcutResult") &&
      matrixHelper.includes("STEAM_SHORTCUT_RESULT_SANITIZED") &&
      matrixHelper.includes('"shortcut-backups"'),
    "Windows shortcut setup must project sanitized output and keep rollback backups outside artifacts"
  );
  assert.doesNotMatch(
    matrixHelper,
    /Join-Path\s+\$ArtifactRoot\s+"windows-shortcuts\.vdf\.bak"|result\s*=\s*\$dryResult|\$output\s*\|\s*Write-Host|shortcutExe\s*=\s*\$ShortcutExe|shortcutStartDir\s*=\s*\$ShortcutStartDir|shortcutLaunchPrefix\s*=\s*\$ShortcutLaunchPrefix|javaScriptRunnerExe\s*=\s*\$JavaScriptRunnerExe/,
    "Windows shortcut setup must not retain or print raw paths, launch options, or shortcut backups"
  );
  assert.ok(
    matrixHelper.includes("function Clear-BlockingForegroundWindow") &&
      matrixHelper.includes("application-error-dialog") &&
      matrixHelper.includes("shell-search-or-start-ui") &&
      matrixHelper.includes('Write-ProbeEvent "probe:foreground-clear"'),
    "Windows close probe must clear known blocking OS foreground UI before close targeting"
  );
  const presenterFocusStart = matrixHelper.indexOf(
    "function Focus-LifecycleNativePresenterForCloseInput"
  );
  const presenterFocusEnd = matrixHelper.indexOf(
    "\nfunction Confirm-LifecycleNativePresenterForegroundForCloseInput",
    presenterFocusStart
  );
  assert.ok(
    presenterFocusStart >= 0 && presenterFocusEnd > presenterFocusStart,
    "Windows close probe must define a bounded lifecycle native-presenter focus step"
  );
  const presenterFocusBlock = matrixHelper.slice(presenterFocusStart, presenterFocusEnd);
  assert.ok(
    presenterFocusBlock.includes("`$geometry = Get-LifecyclePresenterGeometry") &&
      presenterFocusBlock.includes("[SteamBridgeWindowsProbe]::IsWindow(`$handle)") &&
      presenterFocusBlock.includes("[SteamBridgeWindowsProbe]::GetWindowThreadProcessId(`$handle") &&
      presenterFocusBlock.includes("ownerMatchesLifecycleProcess") &&
      presenterFocusBlock.includes("ownerMatchesControlProcess") &&
      presenterFocusBlock.includes("sameInteractiveSession") &&
      presenterFocusBlock.includes("Read-SmokeControlDescriptor") &&
      presenterFocusBlock.includes("Invoke-RestMethod") &&
      presenterFocusBlock.includes('"X-Steam-Bridge-Smoke-Token"') &&
      presenterFocusBlock.includes('"http://127.0.0.1:{0}/foreground-handoff"') &&
      presenterFocusBlock.includes("targetWindow = `$handleText") &&
      presenterFocusBlock.includes("requestCount = 1") &&
      presenterFocusBlock.includes("nativeShowCallCount") &&
      presenterFocusBlock.includes("requestedWindowMatches") &&
      presenterFocusBlock.includes("sameWindowBeforeAfter") &&
      presenterFocusBlock.includes("ownerReportsForeground") &&
      presenterFocusBlock.includes("[SteamBridgeWindowsProbe]::GetForegroundWindow() -eq `$handle") &&
      presenterFocusBlock.includes('source = "lifecycle-native-host"') &&
      presenterFocusBlock.includes(
        'mechanism = if (`$script:UseUserGestureGate) { "same-process-user-gesture" } else { "owner-process-native-show" }'
      ) &&
      presenterFocusBlock.includes("handlePresent =") &&
      presenterFocusBlock.includes("handleFormatValid =") &&
      presenterFocusBlock.includes("windowValid =") &&
      presenterFocusBlock.includes("focused ="),
    "Windows close probe must request and verify one owner-process lifecycle native-host handoff"
  );
  assert.doesNotMatch(
    presenterFocusBlock,
    /Start-Sleep|SetForegroundWindow|AttachThreadInput|Send-NativeMouseClick|Send-NativeKeyChord|SendKeys/,
    "Windows native-presenter handoff must not wait, retry externally, join queues, or send activation input"
  );
  assert.equal(
    (presenterFocusBlock.match(/Invoke-RestMethod/g) || []).length,
    1,
    "Windows native-presenter handoff must make exactly one authenticated loopback request"
  );
  assert.doesNotMatch(
    presenterFocusBlock,
    /^\s*(?:hwnd|handle|windowHandle|nativeHandle)\s*=/im,
    "Windows native-presenter focus evidence must not log a raw HWND"
  );
  assert.ok(
    matrixHelper.includes("`$target = Get-WebCloseClickTarget `$foreground") &&
      matrixHelper.indexOf("`$target = Get-WebCloseClickTarget `$foreground") <
        matrixHelper.indexOf('Write-ProbeEvent "probe:native-presenter-focus"'),
    "Windows close probe must resolve the web close target before consuming the one-shot foreground handoff"
  );
  assert.doesNotMatch(
    matrixHelper,
    /mouse_event|cursor-mouse-event-fallback|SetCursorPos/,
    "Windows close probe must not retry a partial SendInput click through a second pointer mechanism"
  );
  const ownerHandoffFunctionStart = electronSmokeMain.indexOf(
    "function requestWindowsNativePresenterForegroundHandoff"
  );
  const ownerHandoffFunctionEnd = electronSmokeMain.indexOf(
    "\nfunction readWindowsNativePresenterForegroundHandoffState",
    ownerHandoffFunctionStart
  );
  assert.ok(
    ownerHandoffFunctionStart >= 0 && ownerHandoffFunctionEnd > ownerHandoffFunctionStart,
    "Electron smoke app must define the bounded owner-process native-host handoff"
  );
  const ownerHandoffFunction = electronSmokeMain.slice(ownerHandoffFunctionStart, ownerHandoffFunctionEnd);
  assert.ok(
    electronSmokeMain.includes('requestUrl.pathname === "/foreground-handoff"') &&
      electronSmokeMain.includes("nativePresenterForegroundHandoffConsumed") &&
      electronSmokeMain.includes("FOREGROUND_HANDOFF_ALREADY_CONSUMED") &&
      electronSmokeMain.includes("CONTROL_HANDOFF_ONLY") &&
      electronSmokeMain.includes("HANDOFF_ONLY_CONTROL_SERVER") &&
      electronSmokeMain.includes("removeSmokeControlFile()") &&
      ownerHandoffFunction.includes("requestedWindow === before.hostIdentity") &&
      ownerHandoffFunction.includes('reason = "requested-native-host-mismatch"') &&
      ownerHandoffFunction.includes("steamworks.overlay.showNativeOverlayHostView()") &&
      ownerHandoffFunction.includes("nativeShowCallCount = 1") &&
      ownerHandoffFunction.includes('reason = "foreground-confirmed"') &&
      ownerHandoffFunction.includes('reason = "foreground-not-confirmed"'),
    "Electron smoke app must expose one authenticated, one-shot owner-process activation request"
  );
  assert.equal(
    (ownerHandoffFunction.match(/showNativeOverlayHostView\(\)/g) || []).length,
    1,
    "Electron owner-process handoff must make at most one native show call"
  );
  const ownerHandoffRouteStart = electronSmokeMain.indexOf(
    'if (request.method === "POST" && requestUrl.pathname === "/foreground-handoff")'
  );
  const ownerHandoffRouteEnd = electronSmokeMain.indexOf(
    'if (request.method === "POST" && requestUrl.pathname === "/action")',
    ownerHandoffRouteStart
  );
  const ownerHandoffRoute = electronSmokeMain.slice(ownerHandoffRouteStart, ownerHandoffRouteEnd);
  const ownerHandoffInvocation =
    "requestWindowsNativePresenterForegroundHandoff(body.targetWindow, requestOrdinal)";
  assert.ok(
    ownerHandoffRouteStart >= 0 &&
      ownerHandoffRouteEnd > ownerHandoffRouteStart &&
      ownerHandoffRoute.indexOf("nativePresenterForegroundHandoffConsumed = true") <
        ownerHandoffRoute.indexOf(ownerHandoffInvocation),
    "Electron handoff route must consume its scoped latch before invoking native focus"
  );
  assert.equal(
    (ownerHandoffRoute.match(/requestWindowsNativePresenterForegroundHandoff\(/g) || []).length,
    1,
    "Electron handoff route must invoke the owner-process operation exactly once"
  );
  for (const expected of [
    "[switch]$ControlServer",
    "[switch]$ControlHandoffOnly",
    "[string]$ControlFile",
    "STEAM_BRIDGE_SMOKE_CONTROL_SERVER",
    "STEAM_BRIDGE_SMOKE_CONTROL_HANDOFF_ONLY",
    "STEAM_BRIDGE_SMOKE_CONTROL_FILE",
    'closeProbeEvidenceSchema = $CloseProbeEvidenceSchema',
    '$CloseProbeEvidenceSchema = 2',
    '$SameProcessUserGestureEvidenceSchema = 3',
    '$ExternalForegroundTransition = "external-foreground-event-v1"',
    '$CloseProbeForegroundHandoff = "owner-process-native-show-v1"'
  ]) {
    assert.ok(
      helper.includes(expected) || matrixHelper.includes(expected),
      `Windows owner-process handoff packaging missing ${expected}`
    );
  }
  assert.match(
    helper,
    /if \(\$AutorunUserGestureGate\) \{\s*\$args \+= "--steam-bridge-smoke-autorun-user-gesture-gate"\s*\}/,
    "Windows smoke helper must add the user-gesture CLI flag only when explicitly enabled"
  );
  assert.match(
    helper,
    /if \(\$AutorunUserGestureGate\) \{\s*\$envMap\.STEAM_BRIDGE_SMOKE_AUTORUN_USER_GESTURE_GATE = "1"\s*\}/,
    "Windows smoke helper must add the user-gesture launch-env flag only when explicitly enabled"
  );
  const directSmokeStart = helper.indexOf("function Invoke-DirectSmoke");
  const directSmokeEnd = helper.indexOf("\nfunction Invoke-SteamLaunchSmoke", directSmokeStart);
  const directSmokeSource = helper.slice(directSmokeStart, directSmokeEnd);
  assert.ok(
    directSmokeStart >= 0 &&
      directSmokeEnd > directSmokeStart &&
      /} catch \{\s*if \(\$process\) \{/.test(directSmokeSource) &&
      !directSmokeSource.includes("$process -and -not $KeepOpenAfterResult"),
    "Windows direct smoke must terminate its launched process after every failed keep-open run"
  );
  assert.ok(
    helper.includes('[switch]$AutorunUserGestureGate') &&
      helper.includes('if ($AutorunUserGestureGate -and $Action -cnotin @(') &&
      helper.includes('"presenter-web-open-and-wait",') &&
      helper.includes('"presenter-duplicate-open-guard"') &&
      helper.includes('"presenter-persistent-reuse-three-cycle"') &&
      helper.includes('throw "-AutorunUserGestureGate requires one supported gated action."') &&
      helper.includes("-not $KeepOpenAfterResult") &&
      helper.includes("-not $ControlServer") &&
      helper.includes("-not $ControlHandoffOnly") &&
      helper.includes("[string]::IsNullOrWhiteSpace($ControlFile)") &&
      helper.includes('throw "-AutorunUserGestureGate requires keep-open, handoff-only control, and one control file."') &&
      helper.includes("$app.autorunKeepOpenAfterResult -isnot [bool]") &&
      helper.includes("$app.autorunKeepOpenAfterResult -ne [bool]$KeepOpenAfterResult"),
    "Windows smoke helper must restrict the user-gesture gate to the closed single-cycle and persistent action union in one keep-open handoff-only completion scope"
  );
  const userGestureTargetStart = matrixHelper.indexOf("function Resolve-AutorunUserGestureGateTarget");
  const userGestureTargetEnd = matrixHelper.indexOf(
    "\nfunction Confirm-AutorunUserGestureActivationTarget",
    userGestureTargetStart
  );
  assert.ok(
    userGestureTargetStart >= 0 && userGestureTargetEnd > userGestureTargetStart,
    "Windows close probe must define a bounded user-gesture source-window target resolver"
  );
  const userGestureTargetBlock = matrixHelper.slice(userGestureTargetStart, userGestureTargetEnd);
  for (const expected of [
    'mechanism -cne "same-process-user-gesture"',
    "action -cne `$script:UserGestureAction",
    "targetId -cne `$script:UserGestureTargetId",
    "GetWindowThreadProcessId(`$sourceHandle",
    "ownerMatchesLifecycleProcess",
    "sourceMatchesControlProcess",
    "sourceMatchesBoundWindow",
    "sourceMatchesBoundProcessIdentity",
    "sourceProcessIdentityPresent",
    "sameInteractiveSession",
    "IsWindowEnabled(`$sourceHandle)",
    "IsIconic(`$sourceHandle)",
    "GetForegroundWindow() -eq `$sourceHandle",
    "GetDpiForWindow(`$sourceHandle)",
    "rendererScale",
    "windowScale",
    "scaleAgrees",
    "clientGeometryAgrees",
    "GetClientRect(`$sourceHandle",
    "ClientToScreen(`$sourceHandle",
    "UserGestureRendererGeometry",
    'source = "renderer-button-physical-dpi"',
    "insideSourceClient = `$true",
    '"gate-source-window-awaiting-external-foreground"'
  ]) {
    assert.ok(userGestureTargetBlock.includes(expected), `Windows user-gesture target resolver missing ${expected}`);
  }
  for (const expected of [
    "function Resolve-AutorunUserGestureGateCase",
    "$userGestureCase = Resolve-AutorunUserGestureGateCase -Case $Case",
    "$userGestureAction = [string]$userGestureCase.action",
    "$userGestureTargetId = [string]$userGestureCase.targetId",
    "`$script:UserGestureAction = '$userGestureAction'",
    "`$script:UserGestureTargetId = '$userGestureTargetId'",
    "`$script:ExternalForegroundRequestOrdinal = 1"
  ]) {
    assert.ok(matrixHelper.includes(expected), `Windows user-gesture closed mapping missing ${expected}`);
  }
  assert.doesNotMatch(
    userGestureTargetBlock,
    /SetForegroundWindow|ShowWindowAsync|Invoke-RestMethod|\/foreground-handoff|showNativeOverlayHostView|Send-NativeMouseClick|Start-Sleep/,
    "Windows user-gesture target resolution must only inspect exact source-window and DPI state"
  );
  const userGesturePreDispatchStart = matrixHelper.indexOf(
    "function Confirm-AutorunUserGestureActivationTarget"
  );
  const userGesturePreDispatchEnd = matrixHelper.indexOf(
    "\nfunction Wait-AutorunUserGestureSourceFocusReturn",
    userGesturePreDispatchStart
  );
  assert.ok(
    userGesturePreDispatchStart >= 0 &&
      userGesturePreDispatchEnd > userGesturePreDispatchStart,
    "Windows close probe must define an immediate exact-source activation recheck"
  );
  const userGesturePreDispatchBlock = matrixHelper.slice(
    userGesturePreDispatchStart,
    userGesturePreDispatchEnd
  );
  for (const expected of [
    "sourceMatchesBoundProcess",
    "sourceMatchesBoundProcessIdentity",
    "sourceMatchesBoundWindow",
    "sourceMatchesControlProcess",
    "sameInteractiveSession",
    "GetDpiForWindow(`$handle)",
    "ClientToScreen(`$handle",
    "rendererGeometry",
    "clientGeometry",
    "originX = [int]`$clientOrigin.X",
    "originY = [int]`$clientOrigin.Y",
    "width = [int]`$clientWidth",
    "height = [int]`$clientHeight",
    'source = "renderer-button-physical-dpi-rebound"',
    "reboundFromReadyGeometry",
    "targetInsideSourceClient",
    "WindowFromPoint(`$point)",
    "pointOwnerMatchesBoundProcess",
    "GetAncestor(`$pointHandle, 2) -eq `$handle",
    "pointRootMatchesSourceWindow",
    "GetForegroundWindow() -eq `$handle",
    '"gate-source-window-confirmed-before-dispatch"'
  ]) {
    assert.ok(
      userGesturePreDispatchBlock.includes(expected),
      `Windows user-gesture pre-dispatch recheck missing ${expected}`
    );
  }
  assert.doesNotMatch(
    userGesturePreDispatchBlock,
    /SetForegroundWindow|ShowWindowAsync|Invoke-RestMethod|\/foreground-handoff|showNativeOverlayHostView|Send-NativeMouseClick|Start-Sleep/,
    "Windows user-gesture pre-dispatch recheck must inspect only the exact bound source and target point"
  );
  for (const expected of [
    "const clientGeometry = objectOrEmpty(payload.clientGeometry)",
    "const expectedX = roundMidpointToEven(",
    "const expectedY = roundMidpointToEven(",
    "const expectedClientWidth = readyViewport.width * dpi.windowScale",
    "const expectedClientHeight = readyViewport.height * dpi.windowScale",
    "binding.sourceMatchesBoundWindow === true",
    "reboundTarget.x === expectedX",
    "reboundTarget.y === expectedY",
    "clientGeometryMatchesReady",
    "reboundMathValid"
  ]) {
    assert.ok(matrixSummary.includes(expected), `Windows user-gesture summary rebound audit missing ${expected}`);
  }
  const closeProbeLoopStart = matrixHelper.indexOf("while ((Get-Date) -lt `$deadline -and -not `$sent");
  const userGestureActivationStart = matrixHelper.indexOf(
    "    if (`$script:UseUserGestureGate) {",
    closeProbeLoopStart
  );
  const userGestureActivationEnd = matrixHelper.indexOf(
    "    `$shownEventCount =",
    userGestureActivationStart
  );
  assert.ok(
    closeProbeLoopStart >= 0 &&
      userGestureActivationStart > closeProbeLoopStart &&
      userGestureActivationEnd > userGestureActivationStart,
    "Windows close probe must define a bounded one-shot user-gesture activation branch"
  );
  const userGestureActivationBlock = matrixHelper.slice(
    userGestureActivationStart,
    userGestureActivationEnd
  );
  const externalForegroundWaitStart = userGestureActivationBlock.indexOf(
    "`$foregroundWaiter = [SteamBridgeWindowsProbe]::CreateForegroundTransitionWaiter"
  );
  const externalForegroundWaitEnd = userGestureActivationBlock.indexOf(
    "          if (`$activationTarget.ready -and -not `$externalForegroundTransitionCompleted)",
    externalForegroundWaitStart
  );
  assert.ok(
    externalForegroundWaitStart >= 0 && externalForegroundWaitEnd > externalForegroundWaitStart,
    "Windows user-gesture branch must contain one bounded external foreground transition wait"
  );
  const externalForegroundWaitBlock = userGestureActivationBlock.slice(
    externalForegroundWaitStart,
    externalForegroundWaitEnd
  );
  for (const expected of [
    "`$foregroundWaiter.Start(`$hookStartTimeout)",
    'Write-ProbeEvent "probe:external-foreground-source-ready"',
    "`$foregroundWaiter.Arm()",
    "Write-ExternalForegroundReadyMarker",
    "`$foregroundWaiter.Wait(`$transitionWaitTimeout)",
    "Wait-ExternalForegroundControllerAcknowledgment ([int]`$controllerAckTimeout)",
    "`$foregroundWaiter.Stop(`$hookTeardownTimeout)",
    "`$foregroundWaiter.EventCount",
    "`$foregroundWaiter.LastError -ne 0",
    "`$foregroundTransitionEventCount -eq 1",
    "`$foregroundControllerAck.valid",
    "(`$deadline - (Get-Date)).TotalMilliseconds",
    "Confirm-AutorunUserGestureActivationTarget",
    'Write-ProbeEvent "probe:external-foreground-controller-acknowledged"',
    'Write-ProbeEvent "probe:external-foreground-transition-observed"',
    'Write-ProbeEvent "probe:external-foreground-transition-rejected"'
  ]) {
    assert.ok(
      externalForegroundWaitBlock.includes(expected),
      `Windows external foreground transition wait missing ${expected}`
    );
  }
  const hookStartIndex = externalForegroundWaitBlock.indexOf(
    "`$foregroundWaiter.Start(`$hookStartTimeout)"
  );
  const sourceReadyIndex = externalForegroundWaitBlock.indexOf(
    'Write-ProbeEvent "probe:external-foreground-source-ready"'
  );
  const hookArmIndex = externalForegroundWaitBlock.indexOf("`$foregroundWaiter.Arm()");
  const markerWriteIndex = externalForegroundWaitBlock.indexOf(
    "Write-ExternalForegroundReadyMarker"
  );
  const transitionWaitIndex = externalForegroundWaitBlock.indexOf(
    "`$foregroundWaiter.Wait(`$transitionWaitTimeout)"
  );
  const controllerAckWaitIndex = externalForegroundWaitBlock.indexOf(
    "Wait-ExternalForegroundControllerAcknowledgment ([int]`$controllerAckTimeout)"
  );
  const hookStopIndex = externalForegroundWaitBlock.indexOf(
    "`$foregroundWaiter.Stop(`$hookTeardownTimeout)"
  );
  const controllerAckEventIndex = externalForegroundWaitBlock.indexOf(
    'Write-ProbeEvent "probe:external-foreground-controller-acknowledged"'
  );
  const transitionObservedEventIndex = externalForegroundWaitBlock.indexOf(
    'Write-ProbeEvent "probe:external-foreground-transition-observed"'
  );
  assert.ok(
    hookStartIndex >= 0 &&
      hookStartIndex < sourceReadyIndex &&
      sourceReadyIndex < hookArmIndex &&
      hookArmIndex < markerWriteIndex &&
      markerWriteIndex < transitionWaitIndex &&
      transitionWaitIndex < controllerAckWaitIndex &&
      controllerAckWaitIndex < hookStopIndex &&
      hookStopIndex < controllerAckEventIndex &&
      controllerAckEventIndex < transitionObservedEventIndex,
    "Windows external foreground marker must be actionable and acknowledgment-gated before observed evidence"
  );
  assert.doesNotMatch(
    externalForegroundWaitBlock,
    /SetForegroundWindow|ShowWindowAsync|Invoke-RestMethod|\/foreground-handoff|showNativeOverlayHostView|Send-NativeMouseClick|Send-NativeKeyChord|Start-Sleep/,
    "Windows external foreground wait must not send input, request focus, or poll with sleeps"
  );
  for (const expected of [
    "EVENT_SYSTEM_FOREGROUND",
    "SetWinEventHook(",
    "GetMessage(out message",
    "expectedProcessId",
    "GCHandle.Alloc(callback)",
    "Volatile.Read(ref armed) == 1",
    "Interlocked.Increment(ref eventCount)",
    "public int EventCount",
    "public bool Stop(int timeoutMilliseconds)",
    "hwnd == expectedWindow",
    "PostThreadMessage(nativeThreadId, WM_QUIT",
    "UnhookWinEvent(hook)"
  ]) {
    assert.ok(matrixHelper.includes(expected), `Windows foreground WinEvent waiter missing ${expected}`);
  }
  const externalMarkerStart = matrixHelper.indexOf("function Write-ExternalForegroundReadyMarker");
  const externalMarkerEnd = matrixHelper.indexOf("\nfunction Get-LifecyclePresenterGeometry", externalMarkerStart);
  const externalMarkerBlock = matrixHelper.slice(externalMarkerStart, externalMarkerEnd);
  assert.ok(
    externalMarkerStart >= 0 &&
      externalMarkerEnd > externalMarkerStart &&
      externalMarkerBlock.includes('kind = "steam-bridge-windows-external-foreground-ready"') &&
      externalMarkerBlock.includes("action = `$script:UserGestureAction") &&
      externalMarkerBlock.includes("requestOrdinal = `$script:ExternalForegroundRequestOrdinal") &&
      externalMarkerBlock.includes("challenge = `$script:ExternalForegroundChallenge") &&
      externalMarkerBlock.includes("activationInputCount = 0") &&
      externalMarkerBlock.includes("closeInputCount = 0") &&
      externalMarkerBlock.includes("[IO.File]::Move(`$temporaryPath, `$script:ExternalForegroundReadyMarker)"),
    "Windows external foreground readiness marker must be atomic and contain only sanitized state"
  );
  for (const expected of [
    'kind -ceq "steam-bridge-windows-external-foreground-ack"',
    "`$ack.action -ceq `$script:UserGestureAction",
    "Test-ExternalForegroundJsonInteger `$ack.requestOrdinal `$script:ExternalForegroundRequestOrdinal",
    "Test-ExternalForegroundJsonInteger `$ack.schema 1",
    "`$ack.clickCompleted -is [bool]",
    "`$ack.challenge -ceq `$script:ExternalForegroundChallenge",
    "WaitForChanged([IO.WatcherChangeTypes]::All, `$TimeoutMilliseconds)",
    'Remove-Item -LiteralPath ($externalForegroundControllerAck + ".tmp")'
  ]) {
    assert.ok(matrixHelper.includes(expected), `Windows controller acknowledgment gate missing ${expected}`);
  }
  assert.ok(
      userGestureActivationBlock.includes("if (-not `$script:UserGestureActivationSent)") &&
      userGestureActivationBlock.includes("gate-consumed-before-probe-activation") &&
      userGestureActivationBlock.includes("`$gateControl = Read-SmokeControlDescriptor") &&
      userGestureActivationBlock.includes("if (-not `$gateControl.valid)") &&
      userGestureActivationBlock.includes("Resolve-AutorunUserGestureGateTarget") &&
      userGestureActivationBlock.includes("Confirm-AutorunUserGestureActivationTarget") &&
      userGestureActivationBlock.includes("target = `$activationPreDispatch.target") &&
      userGestureActivationBlock.includes("target = `$activationFinalDispatch.target") &&
      userGestureActivationBlock.includes("`$preDispatchGateState.consumedEvents.Count -ne 0") &&
      userGestureActivationBlock.includes(
        'Write-ProbeEvent "probe:user-gesture-gate-activation-dispatch-start"'
      ) &&
      userGestureActivationBlock.includes('Write-ProbeEvent "probe:user-gesture-gate-activation-sent"') &&
      userGestureActivationBlock.includes('input = "renderer-button-click-sendinput"') &&
      userGestureActivationBlock.includes("finalDispatch = `$activationFinalDispatch") &&
      userGestureActivationBlock.includes(
        "`$activationPointer.x -eq [int]`$activationFinalDispatch.target.x"
      ) &&
      userGestureActivationBlock.includes(
        "`$activationPointer.y -eq [int]`$activationFinalDispatch.target.y"
      ) &&
      userGestureActivationBlock.includes("`$script:UserGestureActivationSent = `$true") &&
      userGestureActivationBlock.includes("`$script:UserGestureGateConsumed = `$true"),
    "Windows close probe must consume one ready gate through one renderer-button SendInput activation"
  );
  assert.equal(
    (userGestureActivationBlock.match(/Send-NativeMouseClick/g) || []).length,
    1,
    "Windows user-gesture branch must dispatch exactly one activation click"
  );
  assert.equal(
    (userGestureActivationBlock.match(/Confirm-AutorunUserGestureActivationTarget/g) || []).length,
    3,
    "Windows user-gesture branch must confirm the transition and retain two exact activation rechecks"
  );
  assert.ok(
    userGestureActivationBlock.lastIndexOf("Confirm-AutorunUserGestureActivationTarget") <
      userGestureActivationBlock.indexOf("`$activationPointer = Send-NativeMouseClick"),
    "Windows user-gesture branch must perform its final exact-source check before SendInput"
  );
  const finalUserGestureBindingStart = userGestureActivationBlock.lastIndexOf(
    "`$activationFinalDispatch = Confirm-AutorunUserGestureActivationTarget"
  );
  const finalUserGestureSendStart = userGestureActivationBlock.indexOf(
    "`$activationPointer = Send-NativeMouseClick",
    finalUserGestureBindingStart
  );
  const finalUserGestureSendEnd = userGestureActivationBlock.indexOf(
    "          } else {",
    finalUserGestureSendStart
  );
  assert.ok(
    finalUserGestureBindingStart >= 0 &&
      finalUserGestureSendStart > finalUserGestureBindingStart &&
      finalUserGestureSendEnd > finalUserGestureSendStart,
    "Windows user-gesture branch must send immediately from the successful final rebound"
  );
  const finalUserGestureValidPath = userGestureActivationBlock.slice(
    finalUserGestureBindingStart,
    finalUserGestureSendEnd
  );
  const exactFinalActivationCall =
    "`$activationPointer = Send-NativeMouseClick ([int]`$activationFinalDispatch.target.x) ([int]`$activationFinalDispatch.target.y)";
  assert.ok(
    finalUserGestureValidPath.includes("if (`$activationFinalDispatch.eligible)") &&
      finalUserGestureValidPath.includes(exactFinalActivationCall),
    "Windows user-gesture SendInput must use the final rebound point"
  );
  assert.equal(
    (finalUserGestureValidPath.match(
      /`\$activationPointer = Send-NativeMouseClick \(\[int\]`\$activationFinalDispatch\.target\.x\) \(\[int\]`\$activationFinalDispatch\.target\.y\)/g
    ) || []).length,
    1,
    "Windows generated user-gesture click must retain both positional arguments on one physical line"
  );
  assert.doesNotMatch(
    finalUserGestureValidPath,
    /Send-NativeMouseClick\s+`\r?\n/,
    "Windows expandable probe template must not consume a native-click line continuation"
  );
  assertWindowsExpandableClickShape(exactFinalActivationCall);
  assert.doesNotMatch(
    finalUserGestureValidPath,
    /Write-ProbeEvent|Read-SmokeControlDescriptor|Get-Content|Start-Sleep/,
    "Windows user-gesture final rebound must have no file or logging I/O before SendInput"
  );
  assert.doesNotMatch(
    userGestureActivationBlock,
    /SetForegroundWindow|ShowWindowAsync|Invoke-RestMethod|\/foreground-handoff|showNativeOverlayHostView|Focus-SmokeWindowForShortcutProbe/,
    "Windows user-gesture activation must not refocus, retry through native show, or invoke the legacy HTTP handoff"
  );
  assert.ok(
    matrixHelper.includes(
      "if (-not `$script:UseUserGestureGate) {\n        `$foregroundClear = Clear-BlockingForegroundWindow"
    ),
    "Windows same-process user-gesture branch must preserve foreground instead of invoking the legacy blocker-clear input"
  );
  const userGestureFocusStart = presenterFocusBlock.indexOf("  if (`$script:UseUserGestureGate) {");
  const legacyOwnerFocusStart = presenterFocusBlock.indexOf(
    "  `$evidence.requestCount = 1",
    userGestureFocusStart
  );
  assert.ok(
    userGestureFocusStart >= 0 && legacyOwnerFocusStart > userGestureFocusStart,
    "Windows presenter focus gate must isolate the same-process user-gesture branch from the legacy owner handoff"
  );
  const userGestureFocusBlock = presenterFocusBlock.slice(userGestureFocusStart, legacyOwnerFocusStart);
  for (const expected of [
    "readyEventCount -eq 1",
    "consumedEventCount -eq 1",
    "rejectedEventCount -eq 0",
    "activationInputCount -eq 1",
    "sourceWindowBound",
    "sameWindowBeforeAfter",
    "ownerReportsForeground",
    '"foreground-confirmed-from-user-gesture"',
    "return [PSCustomObject]`$evidence"
  ]) {
    assert.ok(userGestureFocusBlock.includes(expected), `Windows user-gesture presenter gate missing ${expected}`);
  }
  assert.doesNotMatch(
    userGestureFocusBlock,
    /SetForegroundWindow|ShowWindowAsync|Invoke-RestMethod|\/foreground-handoff|showNativeOverlayHostView|nativeShowCallCount\s*=\s*1/,
    "Windows same-process presenter gate must verify existing foreground without a focus or native-show retry"
  );
  for (const expected of [
    '$SameProcessUserGestureForegroundHandoff = "same-process-user-gesture-v1"',
    '$AutorunUserGestureGatePolicy = "single-cycle-active-v1"',
    "autorunUserGestureGatePolicy = $AutorunUserGestureGatePolicy",
    '$PersistentReuseGatePolicy = "initial-user-gesture-verify-only-v1"',
    "$PersistentReuseEvidenceSchema = 1",
    "persistentReuseGatePolicy = $PersistentReuseGatePolicy",
    "supportedPersistentReuseEvidenceSchemas = @($PersistentReuseEvidenceSchema)",
    "$SameProcessUserGestureEvidenceSchema",
    "supportedCloseProbeEvidenceSchemas = @(",
    "supportedExternalForegroundTransitions = @($ExternalForegroundTransition)",
    "externalForegroundTransition = if ($_.autorunUserGestureGate)",
    "supportedCloseProbeForegroundHandoffs = @(",
    "$CloseProbeForegroundHandoff,",
    "$SameProcessUserGestureForegroundHandoff",
    'mechanism = if (`$script:UseUserGestureGate) { "same-process-user-gesture" } else { "owner-process-native-show" }'
  ]) {
    assert.ok(matrixHelper.includes(expected), `Windows close-probe schema union missing ${expected}`);
  }
  for (const expected of [
    "$controlHandoffOnlyExpected = ($useUserGestureGate -or $expectedCloseCount -eq 1)",
    "$script:PersistentReuseNativeHostHandle = [IntPtr]::Zero",
    "$script:PersistentReuseNativeHostOwnerPid = [uint32]0",
    '"initial-user-gesture"',
    '"verify-only"',
    "persistentReuseGate = `$script:UsePersistentReuseGate",
    "sameHostAsCycleOne",
    "Get-PersistentReuseLifecycleState",
    "persistent-cycle-readiness-order-invalid",
    "activeCallbackCount",
    "inactiveCallbackCount",
    "MOUSEEVENTF_MOVE_NOCOALESCE",
    "moveNoCoalesce = `$true",
    "SendMouseClickInputWithApproach",
    "approachUsed = [bool]`$UseApproach",
    "`$useApproach = (`$script:UsePersistentReuseGate -and `$cycle -gt 1)",
    '"cycle-{0:D2}-detected"',
    '"cycle-{0:D2}-before-send"',
    '"cycle-{0:D2}-after-send"',
    '"cycle-{0:D2}-web-close-ready-{1:D2}"',
    "Resolve-MatrixCaseTimeoutSeconds",
    "Invoke-MatrixCase -Case $Case"
  ]) {
    assert.ok(
      matrixHelper.includes(expected),
      `Windows persistent verify-only gate missing ${expected}`
    );
  }
  assert.doesNotMatch(
    matrixHelper,
    /\[regex\]::Matches\(`\$text, '\"active\"\\s\*:\\s\*(?:true|false)'\)/,
    "Windows persistent callback ordering must count typed callback events instead of nested active fields"
  );
  const foregroundSnapshotStart = matrixHelper.indexOf(
    "function Get-ForegroundProbeSnapshot"
  );
  const foregroundSnapshotEnd = matrixHelper.indexOf(
    "\nfunction Test-WebCloseForegroundCandidate",
    foregroundSnapshotStart
  );
  const foregroundSnapshotBlock = matrixHelper.slice(
    foregroundSnapshotStart,
    foregroundSnapshotEnd
  );
  assert.ok(
    foregroundSnapshotStart >= 0 &&
      foregroundSnapshotEnd > foregroundSnapshotStart &&
      foregroundSnapshotBlock.includes("if (`$script:UsePersistentReuseGate) {") &&
      foregroundSnapshotBlock.includes("`$snapshot.handlePresent =") &&
      foregroundSnapshotBlock.includes("`$snapshot.hwnd =") &&
      /if \(`\$script:UsePersistentReuseGate\) \{\s*`\$snapshot\.handlePresent =[\s\S]*?\} else \{\s*`\$snapshot\.hwnd =/.test(
        foregroundSnapshotBlock
      ),
    "Windows current persistent foreground proof must omit raw HWND snapshots"
  );
  const persistentFocusStart = presenterFocusBlock.indexOf(
    "  if (`$script:UsePersistentReuseGate) {"
  );
  const persistentFocusEnd = presenterFocusBlock.indexOf(
    "\n  if (`$script:UseUserGestureGate) {",
    persistentFocusStart
  );
  const persistentFocusBlock = presenterFocusBlock.slice(
    persistentFocusStart,
    persistentFocusEnd
  );
  for (const expected of [
    "if (`$script:CloseCycleOrdinal -eq 1)",
    "`$script:PersistentReuseNativeHostHandle = `$handle",
    "`$script:PersistentReuseNativeHostOwnerPid = `$ownerPid",
    "`$handle -eq `$script:PersistentReuseNativeHostHandle",
    "`$ownerPid -eq `$script:PersistentReuseNativeHostOwnerPid",
    '"persistent-native-host-baseline-already-bound"',
    '"persistent-native-host-changed"'
  ]) {
    assert.ok(
      persistentFocusStart >= 0 &&
        persistentFocusEnd > persistentFocusStart &&
        persistentFocusBlock.includes(expected),
      `Windows persistent presenter confirmation missing ${expected}`
    );
  }
  const persistentPreDispatchStart = matrixHelper.indexOf(
    "function Confirm-LifecycleNativePresenterForegroundForCloseInput"
  );
  const persistentPreDispatchEnd = matrixHelper.indexOf(
    "\nfunction Get-LifecyclePresenterBounds",
    persistentPreDispatchStart
  );
  const persistentPreDispatchBlock = matrixHelper.slice(
    persistentPreDispatchStart,
    persistentPreDispatchEnd
  );
  for (const expected of [
    "`$handle -eq `$script:PersistentReuseNativeHostHandle",
    "`$ownerPid -eq `$script:PersistentReuseNativeHostOwnerPid",
    '"persistent-native-host-changed-before-dispatch"'
  ]) {
    assert.ok(
      persistentPreDispatchStart >= 0 &&
        persistentPreDispatchEnd > persistentPreDispatchStart &&
        persistentPreDispatchBlock.includes(expected),
      `Windows persistent pre-dispatch confirmation missing ${expected}`
    );
  }
  const userGestureResolverStart = matrixHelper.indexOf(
    "function Resolve-AutorunUserGestureGateCase"
  );
  const userGestureResolverEnd = matrixHelper.indexOf(
    "\nfunction Resolve-PersistentReuseGateCase",
    userGestureResolverStart
  );
  assert.ok(
    userGestureResolverStart >= 0 && userGestureResolverEnd > userGestureResolverStart,
    "Windows matrix must define one closed user-gesture case resolver"
  );
  const userGestureResolver = matrixHelper.slice(
    userGestureResolverStart,
    userGestureResolverEnd
  );
  assert.equal(
    Object.keys(WINDOWS_USER_GESTURE_CASE_ACTIONS).length,
    27,
    "Windows gate test contract must cover 27 exact single-cycle active cases"
  );
  const resolvedCaseArms = new Map(
    [...userGestureResolver.matchAll(/^\s*"([^"]+)"\s*\{([^{}]*)\}/gm)].map(
      (match) => [match[1], match[2]]
    )
  );
  assert.deepEqual(
    [...resolvedCaseArms.keys()].sort(),
    Object.keys(WINDOWS_USER_GESTURE_CASE_ACTIONS).sort(),
    "Windows user-gesture resolver must contain exactly the intended 27 case IDs"
  );
  for (const [caseId, action] of Object.entries(WINDOWS_USER_GESTURE_CASE_ACTIONS)) {
    const arm = resolvedCaseArms.get(caseId) || "";
    assert.ok(
      arm.includes(`$expectedAction = "${action}"`),
      `Windows user-gesture resolver missing exact ${caseId} / ${action}`
    );
    if (caseId === "11-managed-web-open-and-wait") {
      assert.ok(
        arm.includes('$targetId = "presenter-web-wait"'),
        "Windows managed-web resolver arm must preserve its historical target"
      );
    } else if (caseId === "11b-managed-duplicate-open-guard") {
      assert.ok(
        arm.includes('$targetId = "presenter-duplicate-guard"'),
        "Windows duplicate-open resolver arm must preserve its historical target"
      );
    } else {
      assert.ok(
        !arm.includes("$targetId ="),
        `Windows expanded resolver arm must use only the generic target fallback: ${caseId}`
      );
    }
  }
  for (const excludedCaseId of [
    "10-presenter-ready",
    "01-checkout-prepare",
    "23-raw-native-dialog-open-observe",
    "24-raw-native-user-open-observe",
    "25-managed-achievement-progress",
    "26-managed-achievement-unlock",
    "40-persistent-reuse-three-cycle"
  ]) {
    assert.ok(
      !userGestureResolver.includes(`"${excludedCaseId}"`),
      `Windows user-gesture resolver must exclude ${excludedCaseId}`
    );
  }
  assert.ok(
    userGestureResolver.includes('$targetId = "presenter-web-wait"') &&
      userGestureResolver.includes('$targetId = "presenter-duplicate-guard"') &&
      userGestureResolver.includes('$targetId = "autorun-user-gesture-target"') &&
      userGestureResolver.includes("[string]$Case.action -cne $expectedAction"),
    "Windows user-gesture resolver must preserve historical targets and fail closed before selecting the generic target"
  );
  const persistentGateResolverStart = matrixHelper.indexOf(
    "function Resolve-PersistentReuseGateCase"
  );
  const persistentGateResolverEnd = matrixHelper.indexOf(
    "\nfunction Test-MatrixCloseProbeRequirements",
    persistentGateResolverStart
  );
  const persistentGateResolver = matrixHelper.slice(
    persistentGateResolverStart,
    persistentGateResolverEnd
  );
  assert.ok(
    persistentGateResolverStart >= 0 &&
      persistentGateResolverEnd > persistentGateResolverStart &&
      persistentGateResolver.includes('[string]$Case.id -cne "40-persistent-reuse-three-cycle"') &&
      persistentGateResolver.includes(
        '[string]$Case.action -cne "presenter-persistent-reuse-three-cycle"'
      ) &&
      persistentGateResolver.includes("[int]$Case.persistentReuseCycles -ne 3") &&
      persistentGateResolver.includes("$Case.persistentReuseGate -ne $true") &&
      persistentGateResolver.includes("$PersistentReuseGatePolicy") &&
      persistentGateResolver.includes("$PersistentReuseEvidenceSchema") &&
      persistentGateResolver.includes('targetId = "autorun-user-gesture-target"'),
    "Windows matrix must isolate persistent reuse behind one exact case/action/policy resolver"
  );

  const allowedGateActionStart = helper.indexOf("if ($AutorunUserGestureGate -and $Action -cnotin @(");
  const allowedGateActionEnd = helper.indexOf(
    "\nif ($AutorunUserGestureGate -and (",
    allowedGateActionStart
  );
  const allowedGateActionBlock = helper.slice(allowedGateActionStart, allowedGateActionEnd);
  assert.ok(
    allowedGateActionStart >= 0 && allowedGateActionEnd > allowedGateActionStart,
    "Windows smoke helper must retain a closed gate action allowlist"
  );
  const allowedGateActions = [...allowedGateActionBlock.matchAll(/^\s*"([^"]+)",?\s*$/gm)]
    .map((match) => match[1])
    .sort();
  assert.deepEqual(
    allowedGateActions,
    Object.keys(ALL_USER_GESTURE_ACTION_TARGETS).sort(),
    "Windows smoke gate allowlist must contain exactly the 14 single-cycle actions plus persistent reuse"
  );

  const matrixLines = matrixHelper.split(/\r?\n/);
  const getExplicitCaseDeclaration = (caseId) => {
    const start = matrixLines.findIndex((line) => line.includes(`-Id "${caseId}"`));
    assert.ok(start >= 0, `Windows matrix case declaration missing ${caseId}`);
    let end = start + 1;
    while (
      end < matrixLines.length &&
      !/^\s{4}New-(?:Case|ManagedOpenAndWaitCase|ShortcutOpenAndWaitCase)\b/.test(
        matrixLines[end]
      )
    ) {
      end += 1;
    }
    return matrixLines.slice(start, end).join("\n");
  };
  for (const caseId of [
    "11-managed-web-open-and-wait",
    "11b-managed-duplicate-open-guard",
    "12-managed-store-open-and-wait",
    "13-managed-friends-open-and-wait",
    "14-managed-dialog-open-and-wait",
    "15-managed-shortcut",
    "15-managed-shortcut-keyboard",
    "16-managed-checkout-route",
    "17-managed-profile-open-and-wait",
    "18-managed-players-open-and-wait",
    "19-managed-community-open-and-wait",
    "20-managed-stats-open-and-wait",
    "21-managed-achievements-open-and-wait",
    "22-managed-user-open-and-wait",
    "02-checkout-approval",
    "03-shortcut-checkout",
    "04-shortcut-checkout-open-and-wait"
  ]) {
    assert.ok(
      getExplicitCaseDeclaration(caseId).includes("-AutorunUserGestureGate"),
      `Windows matrix active case must enable the user-gesture gate: ${caseId}`
    );
  }
  for (const caseId of [
    "10-presenter-ready",
    "01-checkout-prepare",
    "23-raw-native-dialog-open-observe",
    "24-raw-native-user-open-observe",
    "25-managed-achievement-progress",
    "26-managed-achievement-unlock"
  ]) {
    assert.ok(
      !getExplicitCaseDeclaration(caseId).includes("-AutorunUserGestureGate"),
      `Windows matrix non-single-cycle case must remain outside the user-gesture gate: ${caseId}`
    );
  }
  const persistentReuseCase = getExplicitCaseDeclaration("40-persistent-reuse-three-cycle");
  for (const expected of [
    '-Action "presenter-persistent-reuse-three-cycle"',
    "-AutorunUserGestureGate",
    "-PersistentReuseGate",
    "-PersistentReuseCycles 3"
  ]) {
    assert.ok(
      persistentReuseCase.includes(expected),
      `Windows persistent reuse case missing ${expected}`
    );
  }
  const persistentRunnerStart = matrixHelper.indexOf("function Invoke-PersistentReuseCase");
  const persistentRunnerEnd = matrixHelper.indexOf("\nfunction Invoke-MatrixCase", persistentRunnerStart);
  const persistentRunner = matrixHelper.slice(persistentRunnerStart, persistentRunnerEnd);
  assert.ok(
    /if \(\$Case\.persistentReuseGate -eq \$true\) \{\s*Invoke-MatrixCase -Case \$Case\s*return\s*\}/.test(
      persistentRunner
    ) &&
      persistentRunner.indexOf("Invoke-MatrixCase -Case $Case") <
        persistentRunner.indexOf('"persistent-control-readiness.json"'),
    "Windows current persistent reuse must delegate and return before the historical full-control path"
  );
  const publicShortcutCasesStart = matrixHelper.indexOf("function New-PublicShortcutRouteCases");
  const publicShortcutCasesEnd = matrixHelper.indexOf(
    "\nfunction Get-MatrixCases",
    publicShortcutCasesStart
  );
  const publicShortcutCasesBlock = matrixHelper.slice(
    publicShortcutCasesStart,
    publicShortcutCasesEnd
  );
  assert.ok(
    publicShortcutCasesBlock.includes("-AutorunUserGestureGate") &&
      publicShortcutCasesBlock.includes('"30-shortcut-{0}-open-and-wait"'),
    "Windows public shortcut route constructor must gate its exact ten generated cases"
  );
  const publicShortcutTargetsBlock = publicShortcutCasesBlock.match(
    /\$targets = @\(([\s\S]*?)\n\s*\)/
  )?.[1];
  assert.ok(publicShortcutTargetsBlock, "Windows public shortcut route target list is missing");
  const publicShortcutTargets = [
    ...publicShortcutTargetsBlock.matchAll(/^\s*"([^"]+)",?\s*$/gm)
  ]
    .map((match) => match[1])
    .sort();
  assert.deepEqual(
    publicShortcutTargets,
    [
      "friends",
      "web",
      "store",
      "profile",
      "players",
      "community",
      "stats",
      "achievements",
      "user",
      "dialog"
    ].sort(),
    "Windows public shortcut route constructor must retain exactly ten supported targets"
  );
  const matrixCaseStart = matrixHelper.indexOf("function Invoke-MatrixCase");
  const matrixCaseEnd = matrixHelper.indexOf("\nResolve-SmokeExe", matrixCaseStart);
  assert.ok(
    matrixCaseStart >= 0 && matrixCaseEnd > matrixCaseStart,
    "Windows matrix must retain one bounded process-per-case runner"
  );
  const matrixCaseBlock = matrixHelper.slice(matrixCaseStart, matrixCaseEnd);
  for (const expected of [
    "$keepOpenForUserGestureCompletion = [bool]$Case.autorunUserGestureGate",
    '$args += @("-AutorunUserGestureGate", "-KeepOpenAfterResult")',
    "-KeepOpenAfterResult:$keepOpenForUserGestureCompletion",
    "Wait-WindowsOverlayCloseProbeTerminal",
    "Wait-MatrixHandoffOnlySmokeControlDescriptor",
    "[int]$completionControl.pid -eq [int]$result.snapshot.process.pid",
    '-Path "/quit"',
    '"user-gesture-completion.json"',
    "probeExitCode = $terminal.processExitCode",
    "terminalExclusive = $terminal.terminalExclusive",
    "focusReturnObserved = $terminal.focusReturnObserved",
    "quitAttempted = $quitAttempted",
    "quitResponseOk = $quitResponseOk",
    "sourceProcessExited = $sourceProcessExited"
  ]) {
    assert.ok(matrixCaseBlock.includes(expected), `Windows user-gesture completion runner missing ${expected}`);
  }
  assert.ok(
    matrixCaseBlock.indexOf("Wait-WindowsOverlayCloseProbeTerminal") <
      matrixCaseBlock.indexOf('-Path "/quit"') &&
      matrixCaseBlock.includes("if ($terminal.ok -and $controlProcessMatchesResult)"),
    "Windows user-gesture completion must require a successful probe terminal before graceful quit"
  );
  const focusReturnStart = matrixHelper.indexOf("function Wait-AutorunUserGestureSourceFocusReturn");
  const focusReturnEnd = matrixHelper.indexOf("\nfunction Get-ForegroundProbeSnapshot", focusReturnStart);
  const focusReturnBlock = matrixHelper.slice(focusReturnStart, focusReturnEnd);
  assert.ok(
    focusReturnStart >= 0 && focusReturnEnd > focusReturnStart,
    "Windows close probe must retain the source-focus-return waiter"
  );
  for (const expected of [
    "'overlay:presenter-persistent-reuse-cycle')).Count -eq 3",
    "'overlay:presenter-after-close-stable')).Count -ge 1",
    "'overlay:presenter-persistent-reuse-complete'"
  ]) {
    assert.ok(
      focusReturnBlock.includes(expected),
      `Windows persistent focus-return lifecycle gate missing ${expected}`
    );
  }
  assert.ok(
    !focusReturnBlock.includes("'overlay:presenter-after-close-stable')).Count -ge 3"),
    "Windows persistent focus-return must accept the single final stable sample after three completed cycles"
  );
  for (const expected of [
    '$script:UserGestureLifecycleCompleteEvent',
    '$text -match [regex]::Escape(`$script:UserGestureLifecycleCompleteEvent)'
  ]) {
    assert.ok(
      focusReturnBlock.includes(expected),
      `Windows single-cycle focus-return lifecycle gate missing ${expected}`
    );
  }
  assert.ok(
    matrixHelper.includes('$userGestureAction -eq "presenter-checkout"') &&
      matrixHelper.includes('"overlay:presenter-checkout-open-and-wait-complete"') &&
      matrixHelper.includes('"overlay:presenter-open-and-wait-complete"'),
    "Windows focus-return lifecycle gate must select the checkout-specific completion event"
  );
  const probeTerminalStart = matrixHelper.indexOf("function Wait-WindowsOverlayCloseProbeTerminal");
  const probeTerminalEnd = matrixHelper.indexOf(
    "\nfunction Invoke-Preflight",
    probeTerminalStart
  );
  const probeTerminalBlock = matrixHelper.slice(probeTerminalStart, probeTerminalEnd);
  for (const expected of [
    '$_.type -eq "probe:complete"',
    '$_.type -eq "probe:incomplete"',
    '$_.type -eq "probe:timeout"',
    '$_.type -eq "probe:user-gesture-app-focus-return"',
    "$processExitCode -eq 0",
    "$terminalEventCount -eq 1",
    "$focusReturnEvents.Count -eq 1",
    '"exact-source-window-foreground"'
  ]) {
    assert.ok(probeTerminalBlock.includes(expected), `Windows close-probe terminal waiter missing ${expected}`);
  }
  for (const expected of [
    'const OWNER_PROCESS_FOREGROUND_HANDOFF = "owner-process-native-show-v1"',
    'const SAME_PROCESS_USER_GESTURE_HANDOFF = "same-process-user-gesture-v1"',
    'const EXTERNAL_FOREGROUND_TRANSITION = "external-foreground-event-v1"',
    "const USER_GESTURE_GATE_EXPECTATIONS = Object.freeze({",
    '"11b-managed-duplicate-open-guard": Object.freeze({',
    'action: "presenter-duplicate-open-guard"',
    'targetId: "presenter-duplicate-guard"',
    "evidenceSchemas: Object.freeze([3])",
    "getUserGestureGateExpectation(caseName)",
    "Number.isInteger(recordedCaseEvidenceSchema)",
    "Number.isInteger(startPayload.evidenceSchema)",
    "sameProcessUserGestureEvidencePresent",
    "action.action === userGestureExpectation.action",
    "closeProbe.userGestureGate === true",
    "readyPayload.action === expectedAction",
    "readyPayload.targetId === expectedTargetId",
    "guardEvents.length !== 1",
    "SUPPORTED_CLOSE_PROBE_EVIDENCE_SCHEMAS = new Set([1, 2, 3])",
    "manifest.supportedCloseProbeForegroundHandoffs.includes(OWNER_PROCESS_FOREGROUND_HANDOFF)",
    "manifest.supportedCloseProbeForegroundHandoffs.includes(SAME_PROCESS_USER_GESTURE_HANDOFF)",
    'focus.mechanism === "same-process-user-gesture"',
    "Number.isInteger(focus.requestCount)",
    "Number.isInteger(focus.nativeShowCallCount)",
    "focusTransport.authenticated === false",
    'focus.appReason === "foreground-confirmed-from-user-gesture"',
    "armedAppEvents.length === 1",
    "activationDispatchStartEvents.length === 1",
    "userGestureActivationEvents.length === 1",
    "foregroundClearEvents.length === 0",
    "externalForegroundSourceReadyEvents.length === 1",
    "externalForegroundTransitionObservedEvents.length === 1",
    "externalForegroundControllerAcknowledgedEvents.length === 1",
    "externalForegroundTransitionRejectedEvents.length === 0",
    "externalForegroundReadyMarkerValid",
    "externalForegroundControllerAckValid",
    'externalControllerAck.kind === "steam-bridge-windows-external-foreground-ack"',
    "externalControllerAck.challenge === externalReadyMarker.challenge",
    "externalControllerAcknowledgedPayload.clickCompleted === true",
    "externalTransitionOrderValid",
    "probeRecordOrderValid",
    "externalSourceReadyPayload.activationInputCount === 0",
    "externalSourceReadyPayload.closeInputCount === 0",
    "externalTransitionObservedPayload.activationInputCount === 0",
    "externalTransitionObservedPayload.closeInputCount === 0",
    "externalTransitionObservedPayload.hookStopped === true",
    "externalTransitionObservedPayload.hookErrorPresent === false",
    "externalTransitionNotRequiredPayload.closeInputCount === 0",
    "externalReadyMarker.closeInputCount === 0",
    "Number.isInteger(activationTarget.x)",
    "activationDpi.rendererScale === readyViewport.devicePixelRatio",
    "completion.schema === 1",
    "completion.probeExitCode === 0",
    "completion.terminalEventCount === 1",
    "completion.controlProcessMatchesResult === true",
    "completion.quitAttempted === true",
    "completion.quitResponseOk === true",
    "completion.sourceProcessExited === true",
    "afterCloseStableEvents.length === 1",
    "persistentReuseCompleteEvents.length === (persistentReuseUserGesture ? 1 : 0)",
    "completionQuitEvents.length === 1",
    "resultWrittenPayload.resultFileWritten === true",
    "keepOpenPayload.resultFileWritten === true",
    "processExitPayload.exitCode === 0",
    "appQuitPayload.exitCode === 0",
    "fullLifecycleFatalEvents.length === 0",
    "completionOrderValid"
  ]) {
    assert.ok(matrixSummary.includes(expected), `Windows summary user-gesture schema contract missing ${expected}`);
  }
  assert.ok(
    !matrixSummary.includes("persistentReuseUserGesture ? WINDOWS_PERSISTENT_REUSE_CYCLES : 1"),
    "Windows summary must accept the single final stable sample after three persistent cycles"
  );
  assert.ok(
    matrixHelper.includes("$controlFileBase64 = [Convert]::ToBase64String") &&
      matrixHelper.includes("[Convert]::FromBase64String('$controlFileBase64')") &&
      !matrixHelper.includes("`$script:SmokeControlFile = '$ControlFile'"),
    "Windows close probe must encode the token-file path before embedding it in generated PowerShell"
  );
  const presenterPreDispatchStart = matrixHelper.indexOf(
    "function Confirm-LifecycleNativePresenterForegroundForCloseInput"
  );
  const presenterPreDispatchEnd = matrixHelper.indexOf(
    "\nfunction Get-LifecyclePresenterBounds",
    presenterPreDispatchStart
  );
  assert.ok(
    presenterPreDispatchStart >= 0 && presenterPreDispatchEnd > presenterPreDispatchStart,
    "Windows close probe must define a bounded pre-dispatch native-presenter focus confirmation"
  );
  const presenterPreDispatchBlock = matrixHelper.slice(
    presenterPreDispatchStart,
    presenterPreDispatchEnd
  );
  assert.ok(
    presenterPreDispatchBlock.includes("`$script:LifecycleNativePresenterCloseHandle") &&
      presenterPreDispatchBlock.includes("`$script:LifecycleNativePresenterCloseOwnerPid") &&
      presenterPreDispatchBlock.includes("[SteamBridgeWindowsProbe]::IsWindow(`$handle)") &&
      presenterPreDispatchBlock.includes("[SteamBridgeWindowsProbe]::GetWindowThreadProcessId(`$handle") &&
      presenterPreDispatchBlock.includes("[SteamBridgeWindowsProbe]::IsWindowEnabled(`$handle)") &&
      presenterPreDispatchBlock.includes("[SteamBridgeWindowsProbe]::IsIconic(`$handle)") &&
      presenterPreDispatchBlock.includes("[SteamBridgeWindowsProbe]::GetForegroundWindow() -eq `$handle") &&
      presenterPreDispatchBlock.includes('"lifecycle-native-host-owner-changed"') &&
      presenterPreDispatchBlock.includes('"lifecycle-native-host-not-input-ready"') &&
      presenterPreDispatchBlock.includes('reason = "missing-lifecycle-native-host"') &&
      presenterPreDispatchBlock.includes('"foreground-confirmed"') &&
      presenterPreDispatchBlock.includes('"foreground-lost-before-dispatch"'),
    "Windows close probe must revalidate exact presenter foreground ownership before dispatch"
  );
  assert.doesNotMatch(
    presenterPreDispatchBlock,
    /Start-Sleep|SetForegroundWindow|Send-NativeMouseClick|Send-NativeKeyChord|SendKeys/,
    "Windows pre-dispatch focus confirmation must not refocus, wait, or send input"
  );
  const presenterFocusEventIndex = matrixHelper.indexOf(
    'Write-ProbeEvent "probe:native-presenter-focus"'
  );
  const closeInputDispatchIndex = matrixHelper.indexOf("`$nativeInputSent = `$null", presenterFocusEventIndex);
  assert.ok(
    presenterFocusEventIndex >= 0 && closeInputDispatchIndex > presenterFocusEventIndex,
    "Windows close probe must record native-presenter focus before dispatching close input"
  );
  const closeInputFocusGate = matrixHelper.slice(presenterFocusEventIndex, closeInputDispatchIndex);
  assert.ok(
    closeInputFocusGate.includes("if (-not `$nativePresenterFocus.focused)") &&
      closeInputFocusGate.includes('Write-ProbeEvent "probe:close-input-skipped"') &&
      closeInputFocusGate.includes('reason = "native-presenter-focus-not-confirmed"') &&
      closeInputFocusGate.includes("`$terminalFailure = `$true") &&
      closeInputFocusGate.includes("continue"),
    "Windows close probe must skip close input when native-presenter focus is not confirmed"
  );
  assert.doesNotMatch(
    closeInputFocusGate,
    /Send-NativeMouseClick|Send-NativeKeyChord|\.SendKeys\(/,
    "Windows failed initial focus branch must not dispatch close input"
  );
  const presenterPreDispatchCallIndex = matrixHelper.indexOf(
    "`$nativePresenterPreDispatch = Confirm-LifecycleNativePresenterForegroundForCloseInput",
    closeInputDispatchIndex
  );
  const presenterPreDispatchFailureEnd = matrixHelper.indexOf(
    "      if ('$input' -eq 'escape')",
    presenterPreDispatchCallIndex
  );
  assert.ok(
    presenterPreDispatchCallIndex >= 0 && presenterPreDispatchFailureEnd > presenterPreDispatchCallIndex,
    "Windows close probe must reconfirm presenter focus after target preparation and before dispatch"
  );
  const presenterPreDispatchGate = matrixHelper.slice(
    presenterPreDispatchCallIndex,
    presenterPreDispatchFailureEnd
  );
  assert.ok(
    presenterPreDispatchGate.includes("if (-not `$nativePresenterPreDispatch.focused)") &&
      presenterPreDispatchGate.includes('reason = "native-presenter-focus-lost-before-dispatch"') &&
      presenterPreDispatchGate.includes("`$terminalFailure = `$true") &&
      presenterPreDispatchGate.includes("continue"),
    "Windows close probe must fail closed when presenter focus is lost immediately before input"
  );
  assert.doesNotMatch(
    presenterPreDispatchGate,
    /Start-Sleep|Capture-ProbeScreen|Get-WebCloseClickTarget|Send-NativeMouseClick|Send-NativeKeyChord|\.SendKeys\(/,
    "Windows pre-dispatch focus gate must not wait, retarget, or dispatch on failure"
  );
  assert.ok(
    matrixHelper.includes("nativePresenterPreDispatch = `$nativePresenterPreDispatch"),
    "Windows close probe must record sanitized pre-dispatch focus confirmation with sent input"
  );
  const closeInputDispatchStartIndex = matrixHelper.indexOf(
    'Write-ProbeEvent "probe:close-input-dispatch-start"',
    presenterPreDispatchCallIndex
  );
  const closeInputSendIndex = matrixHelper.indexOf(
    "`$nativePointerSent = Send-NativeMouseClick",
    closeInputDispatchStartIndex
  );
  assert.ok(
    closeInputDispatchStartIndex > presenterPreDispatchCallIndex &&
      closeInputSendIndex > closeInputDispatchStartIndex,
    "Windows close probe must timestamp the confirmed dispatch boundary before SendInput"
  );
  assert.ok(
    matrixHelper.includes("SetProcessDpiAwarenessContext") &&
      matrixHelper.includes("SetThreadDpiAwarenessContext") &&
      matrixHelper.includes("new IntPtr(-4)") &&
      matrixHelper.includes("`$script:ProbeDpiAwareness = [SteamBridgeWindowsProbe]::ConfigureDpiAwareness()") &&
      matrixHelper.indexOf("`$script:ProbeDpiAwareness = [SteamBridgeWindowsProbe]::ConfigureDpiAwareness()") <
        matrixHelper.indexOf("Add-Type -AssemblyName System.Drawing") &&
      matrixHelper.includes("dpiAwareness = `$script:ProbeDpiAwareness") &&
      matrixHelper.includes("`$nativeRect = `$nativeHostDiagnostics.rect") &&
      matrixHelper.includes('coordinateSpace = "physical-native-host"') &&
      matrixHelper.includes("GetDpiForWindow") &&
      matrixHelper.includes("Get-WebCloseDpiScale") &&
      matrixHelper.includes('source = "native-host-window-dpi"') &&
      matrixHelper.includes('source = "presenter-geometry-ratio"') &&
      matrixHelper.includes('source = "bounded-geometry-unavailable"') &&
      matrixHelper.includes("[Math]::Max(1, [Math]::Round(16 * `$scale))") &&
      matrixHelper.includes("[Math]::Max(1, [Math]::Round(18 * `$scale))") &&
      matrixHelper.includes("scale = `$scaleEvidence") &&
      matrixHelper.includes("right = `$rightInset") &&
      matrixHelper.includes("top = `$topInset") &&
      matrixHelper.includes("logicalRight = 16") &&
      matrixHelper.includes("logicalTop = 18"),
    "Windows close probe must enter physical per-monitor DPI coordinates before screenshot and SendInput work"
  );
  const roundMidpointToEven = (value) => {
    const lower = Math.floor(value);
    return Math.abs(value - lower - 0.5) < 1e-10 ? (lower % 2 === 0 ? lower : lower + 1) : Math.round(value);
  };
  const screenshotPanelCloseTarget = ({ left, top, width, height, scale }) => {
    const rightInset = Math.min(Math.max(1, width - 1), Math.max(1, roundMidpointToEven(16 * scale)));
    const topInset = Math.min(Math.max(1, height - 1), Math.max(1, roundMidpointToEven(18 * scale)));
    return {
      x: left + width - rightInset,
      y: top + topInset,
      rightInset,
      topInset
    };
  };
  const scaledPanelCloseTarget = screenshotPanelCloseTarget({
    left: 834,
    top: 390,
    width: 1788,
    height: 1282,
    scale: 2.25
  });
  assert.deepEqual(
    scaledPanelCloseTarget,
    { x: 2586, y: 430, rightInset: 36, topInset: 40 },
    "Windows close probe must target the measured 225%-scaled Steam web close control"
  );
  assert.ok(
    scaledPanelCloseTarget.x >= 2582 &&
      scaledPanelCloseTarget.x <= 2592 &&
      scaledPanelCloseTarget.y >= 427 &&
      scaledPanelCloseTarget.y <= 437,
    "Windows scaled panel close target must stay inside the observed close-control bounds"
  );
  assert.deepEqual(
    screenshotPanelCloseTarget({ left: 0, top: 0, width: 640, height: 480, scale: 1 }),
    { x: 624, y: 18, rightInset: 16, topInset: 18 },
    "Windows close probe must preserve its legacy minimum-inset target on a small panel"
  );
  assert.deepEqual(
    screenshotPanelCloseTarget({ left: 100, top: 50, width: 1280, height: 720, scale: 1 }),
    { x: 1364, y: 68, rightInset: 16, topInset: 18 },
    "Windows close probe must keep a conventional panel target near the upper-right close control"
  );
  assert.ok(
    /"opengl"\s*\|\s*"gl"\s*\|\s*"wgl"\s*\|\s*"windows-opengl"\s*=>\s*Self::OpenGl/.test(
      nativeSurfaceSource
    ) &&
      nativeSurfaceSource.includes("_ => Self::D3d11") &&
      nativeSurfaceSource.includes("Err(_) => Self::D3d11") &&
      !nativeSurfaceSource.includes("_ => Self::OpenGl") &&
      !nativeSurfaceSource.includes("Err(_) => Self::OpenGl"),
    "Windows native presenter must default the actual native renderer to D3D11"
  );
  assert.ok(
    helper.includes("native presenter host backend is $RequireNativeHostBackend") &&
      helper.includes("native presenter renderer backend is $RequireNativeHostBackend") &&
      matrixHelper.includes('$args += @("-RequireNativeHostBackend", $expectedNativeHostBackend)'),
    "Windows attached presenter cases must verify the authoritative native host and renderer backends"
  );
  assert.ok(
    matrixHelper.includes("function Test-WebCloseForegroundAllowsPresenterBounds") &&
      matrixHelper.includes("`$Foreground.rect.width -le 0 -or `$Foreground.rect.height -le 0") &&
      matrixHelper.includes("Explorer can become foreground as the taskbar") &&
      matrixHelper.includes("Find-WebClosePanelRectFromScreenshot -Screenshot `$Screenshot -Foreground `$presenterForeground"),
    "Windows close probe must allow presenter-bound close targeting after benign shell foreground recovery"
  );
  assert.ok(
    matrixHelper.includes("`$topRun = `$null") &&
      matrixHelper.includes("topRun = `$topRun") &&
      matrixHelper.includes("`$left = [Math]::Max(`$rect.left, [int]`$topRun.left)") &&
      matrixHelper.includes("`$right = [Math]::Min(`$rect.right, [int]`$topRun.right)"),
    "Windows close probe must use the top-level Steam web frame edge for close targeting"
  );
  assert.ok(
    matrixHelper.includes("focusClick = `$focusClick") &&
      matrixHelper.includes("Send-NativeMouseClick `$clickX `$clickY"),
    "Windows shortcut probe must fall back to a real pointer focus click before sending Shift+Tab"
  );
  for (const expected of [
    "achievement-progress",
    "achievement-unlock",
    "presenter-ready",
    "presenter-web-open-and-wait",
    "presenter-duplicate-open-guard",
    "presenter-store-open-and-wait",
    "presenter-friends-open-and-wait",
    "presenter-dialog-auto-open-and-wait",
    "presenter-profile-open-and-wait",
    "presenter-players-open-and-wait",
    "presenter-community-open-and-wait",
    "presenter-stats-open-and-wait",
    "presenter-achievements-open-and-wait",
    "presenter-user-open-and-wait",
    "presenter-checkout",
    "presenter-shortcut",
    "presenter-shortcut-open-and-wait",
    "presenter-achievement-progress",
    "presenter-achievement-unlock",
    "--steam-bridge-smoke-diagnostic-dir=$DiagnosticDir",
    "--steam-bridge-smoke-web-url=$WebUrl",
    "--steam-bridge-smoke-checkout-transaction-id=$CheckoutTransactionId",
    "--steam-bridge-smoke-checkout-json-file=$CheckoutJsonFile",
    "--steam-bridge-smoke-env-file=$SmokeEnvFile",
    "--log-file=$(Get-ExternalElectronLogFile -LogFile $LogFile)",
    "ELECTRON_LOG_FILE",
    "electron-debug.log",
    "--steam-bridge-electron-overlay-in-process-gpu=$OverlayInProcessGpu",
    "--steam-bridge-windows-native-host-backend=$NativeHostBackend",
    "--steam-bridge-windows-native-host-style=$NativeHostStyle",
    "CheckoutJsonFile",
    "Redact-SmokeLaunchArgument",
    "STEAM_BRIDGE_SMOKE_CHECKOUT_JSON_FILE",
    "Format-SmokeEnvLines (Get-SmokeEnv -LogFile $ResultFile -SmokeAction $Action) -RedactSensitive",
    "STEAM_BRIDGE_NATIVE_PATH",
    "STEAM_BRIDGE_WINDOWS_NATIVE_HOST_BACKEND",
    "STEAM_BRIDGE_WINDOWS_NATIVE_HOST_STYLE",
    "write-launch-env",
    "Get-SmokeEnv",
    "Set-SmokeProcessEnv",
    "PreflightJsonFile",
    "Write-JsonFile",
    "steam-bridge-windows-preflight",
    "Get-CiToolPolicyInventory",
    "Convert-CiToolJsonPolicies",
    "Convert-CiToolPolicies",
    "ciToolOutputFormat",
    "verifiedAndReputableEnforced",
    "enforcedAppControlPolicies",
    "SteamOverlayGameId",
    "function Test-OverlayActiveEvent",
    "function Wait-ForSmokeProcessExit",
    "Windows steam-launch smoke completed.",
    "Windows steam-app smoke completed.",
    "RequireOverlayActivated",
    "AllowOverlayNotReady",
    "RequirePassiveNotification",
    "RequireNoCrashes",
    "RequireNativeHostBackend",
    "ManagedOverlayResultMode",
    "RequireManagedOverlayComplete",
    "RequireMicroTxnCallback",
    "Assert-MicroTxnCallbackProof",
    "STEAM_BRIDGE_SMOKE_MANAGED_OVERLAY_RESULT_MODE",
    "AllowStartSteamClient",
    "function Add-DefaultRequireEvents",
    "Get-WindowsSessionSummary",
    "Assert-InteractiveWindowsSessionForSteamLaunch",
    "currentSessionId",
    "SSH Session 0 can produce",
    "Invoke-CiToolPolicyList",
    "CiToolPath -lp -json",
    "CiTool.exe -lp timed out"
  ]) {
    assert.ok(helper.includes(expected), `Windows smoke helper missing ${expected}`);
  }
  assert.match(
    helper,
    /if \(\$RequireMicroTxnCallback -and \$Action -ne "presenter-checkout"\)/,
    "Windows callback proof must reject every action except direct managed checkout"
  );
  for (const expected of [
    "Get-AuthenticodeSignature",
    "Set-AuthenticodeSignature",
    "Import-PfxCertificate",
    "STEAM_BRIDGE_WINDOWS_PFX_PASSWORD",
    ".exe\", \".dll\", \".node",
    "TimestampServer",
    "VerifyOnly",
    "AllowUnsigned",
    "ExpectedPublisherThumbprint",
    "ExpectedPublisherSubject",
    "publisherFilePaths"
  ]) {
    assert.ok(signingHelper.includes(expected), `Windows signing helper missing ${expected}`);
  }
  for (const expected of [
    "steam-bridge-windows-app-control-dev-mode",
    "VerifiedAndReputablePolicyState",
    "HKLM:\\SYSTEM\\CurrentControlSet\\Control\\CI\\Policy",
    "CiTool.exe",
    "-lp",
    "-r",
    "Smart App Control/App Control",
    "not a per-app allowlist",
    "Test-IsAdministrator",
    "OutputJsonFile"
  ]) {
    assert.ok(appControlDevModeHelper.includes(expected), `Windows App Control dev-mode helper missing ${expected}`);
  }
  for (const expected of [
    "ValidateSet(\"baseline\", \"managed\", \"managed-routes\", \"shortcut-routes\", \"checkout\", \"persistent-reuse\", \"full\", \"preflight\", \"readiness\", \"shortcut\")",
    'ValidateSet("steam-launch", "steam-app", "direct")',
    "Test-NativeLoadGate",
    "Get-PreflightAppControlSummary",
    "New-NativeLoadGateBlocker",
    "New-SteamLaunchBlocker",
    "Read-MatrixJsonFile",
    "Test-NeedsWindowsLiveRunReadiness",
    '$Suite -ne "preflight" -and $Suite -ne "readiness" -and $Suite -ne "shortcut"',
    "steam-launch-blocker.json",
    "windows-app-control-steam-launch-block",
    "The packaged Electron JavaScript runner was blocked by Windows App Control",
    "-Suite readiness checks live Steam-launched readiness",
    "Windows Smart App Control/App Control VerifiedAndReputable policy is enforced",
    "native-load-gate-app-control.json",
    "native-load-gate-blocker.json",
    "matrix-manifest.json",
    "Write-MatrixManifest",
    "steam-bridge-windows-overlay-matrix-manifest",
    "hasCheckoutTransactionId",
    "hasCheckoutJsonFile",
    "CheckoutJsonFile",
    "RequireMicroTxnCallback",
    "requireMicroTxnCallback",
    "-RequireMicroTxnCallback requires a configured Steam app/product; public App ID 480 only proves checkout routing.",
    "Resolve-CheckoutValidatorPath",
    "validate-checkout-target.cjs",
    "Validated Windows checkout JSON target",
    "Configured Windows InitTxn checkout: source=init-txn-request-file capture=in-app expectedAppId=checked",
    "Test-InitTxnEnvironmentReadiness",
    "steam-bridge-windows-init-txn-environment",
    "init-txn-env.json",
    "Write-InitTxnRequestShapePreflight",
    "steam-bridge-windows-init-txn-request-shape",
    "init-txn-request-shape.json",
    "requestAppIdMatches",
    "matrixAppIdForced",
    "itemsHaveRequiredFields",
    "Invalid -InitTxnRequestFile (app ID does not match -AppId).",
    "-InitTxnRequestFile requires -InitTxnApiKeyEnv so the smoke app can call Steam's InitTxn Web API.",
    "Pass it with windows-overlay-task.ps1 -PrivateEnvFile",
    "Use either -CheckoutJsonFile or -InitTxnRequestFile, not both.",
    "-InitTxnRequestFile requires a selected checkout target case.",
    "-InitTxnRequestFile requires a configured Steam app/product; public App ID 480 only proves checkout routing.",
    "-RequireMicroTxnCallback with -InitTxnRequestFile requires -LaunchMode steam-app so Steam launches the configured app, not a non-Steam shortcut.",
    "-RequireMicroTxnCallback requires -LaunchMode steam-app so Steam launches the configured app, not a non-Steam shortcut.",
    "-LaunchMode steam-app requires your configured Steam app ID; use the non-Steam shortcut mode for public App ID 480 smoke proof.",
    "-RequireMicroTxnCallback requires a selected checkout callback case.",
    "Test-MatrixUsesCheckoutTarget",
    "Test-MatrixRequiresMicroTxnCallback",
    "steam-bridge-windows-init-txn-request",
    "captureInApp",
    "initTxnCapture",
    "apiKeyEnvProvided",
    "OverlayScrubChildEnv",
    "OverlayIsolateChildProcesses",
    "overlayScrubChildEnv",
    "overlayIsolateChildProcesses",
    "Running Windows native-load gate with the packaged app.",
    "native-load-gate",
    "preflight.json",
    "post-gate-preflight.log",
    "post-gate-preflight.json",
    "$gateAction = if ($expectedNativeHostBackend)",
    "-Action\", $gateAction",
    "-RequireNoOverlayActivation",
    "achievement-progress",
    "achievement-unlock",
    "presenter-web-open-and-wait",
    "11b-managed-duplicate-open-guard",
    "presenter-duplicate-open-guard",
    "presenter-persistent-reuse-three-cycle",
    "overlay:presenter-persistent-reuse-start",
    "overlay:presenter-persistent-reuse-cycle",
    "overlay:presenter-persistent-reuse-complete",
    "overlay:passive-notification-needs-present",
    "overlay:presenter-duplicate-open-guard",
    "presenter-shortcut-open-and-wait",
    "New-ShortcutOpenAndWaitCase",
    "New-PublicShortcutRouteCases",
    "shortcut-routes",
    "Test-WebCloseForegroundCandidate",
    "Get-WebClosePanelRect",
    "$webCloseReadiness.target",
    "probe:web-close-target-ready",
    "probe:web-close-click-target",
    "SendMouseClickInput",
    "native-mouse-click-returned-no-result",
    "target-ready-before-content-gate",
    "30-shortcut-{0}-open-and-wait",
    "presenter-checkout",
    "01-checkout-prepare",
    "02-checkout-approval",
    "03-shortcut-checkout",
    "04-shortcut-checkout-open-and-wait",
    "overlay:presenter-checkout-ready",
    "overlay:shortcut-open",
    "Selected Windows shortcut toggle probe case(s) require -CloseProbe",
    "$publicManagedRouteExclusions",
    "25-managed-achievement-progress",
    "26-managed-achievement-unlock",
    "InstallShortcut",
    "AssumeShortcutConfigured",
    "assumed-shortcut.json",
    "Windows assumed Steam shortcut verified.",
    "does not match the current package",
    "SkipRenderHealthGate",
    "AllowUnhealthyDefaultRender",
    "render-health-gate.json",
    "render-health-summary.json",
    "Windows render-health gate",
    "Windows default render health is not ready",
    "-not $NativeHostStyle",
    "managed-routes",
    "shortcut",
    "readiness",
    "Resolve-JavaScriptRunner",
    "Invoke-ElectronJavaScriptRunner",
    "Start-Process",
    "RedirectStandardOutput",
    "ELECTRON_RUN_AS_NODE",
    "Write-CaseLaunchEnv",
    "upsert-steam-shortcut.cjs",
    "STEAM_SHORTCUT_RESULT",
    "Windows steam-launch smoke completed.",
    "Windows steam-app smoke completed.",
    "-RequireOverlayActivated",
    "-RequireNoOverlayActivation",
    "-AllowOverlayNotReady",
    "-RequirePassiveNotification",
    "-RequireZeroManagedOverlayTiming",
    "-RequireManagedOverlayComplete",
    "-RequireMicroTxnCallback",
    "ManagedOverlayResultMode \"complete\"",
    "PresenterMode",
    "presenterMode = $PresenterMode",
    "NativeHostBackend",
    "nativeHostBackend = $NativeHostBackend",
    "expectedNativeHostBackend",
    "closeProbeEvidenceSchema",
    "expectedCloseProbeInput",
    "Resolve-ExpectedWindowsNativeHostBackend",
    "-RequireNativeHostBackend",
    "NativeHostStyle",
    "nativeHostStyle = $NativeHostStyle",
    "NativePath",
    "nativePathOverride = [bool]$NativePath",
    "$requiredEvents = @($Case.requireEvent)",
    "$args += $requiredEvents",
    "-RequireNoCrashes",
    "-OverlayInProcessGpu",
    "OnlyCase",
    "Get-SelectedMatrixCases",
    "Invoke-PersistentReuseCase",
    "persistent-control-readiness.json",
    "requestOrdinal = `$script:CloseCycleOrdinal",
    "expectedCloseCount",
    "Start-LaunchEnvRollbackTransaction",
    "Complete-LaunchEnvRollbackTransaction",
    "Test-LaunchEnvBytesMatch",
    "restoredBytesMatch",
    "launch-env-rollback.json",
    "TaskCleanupExpected",
    "CandidateAuditManifest",
    "Get-CandidateBinding",
    "STEAM_BRIDGE_WINDOWS_CANDIDATE_BINDING ",
    "candidateBinding = $candidateBinding",
    "candidatePathHasNoReparsePoints",
    "launchEnvOutsideCandidate",
    "launchEnvPathHasNoReparsePoints",
    "launchEnvUsesDefaultPath",
    "webUrlUsesPublicDefault",
    "cleanStaleOverlayHelpers",
    "steamContinuityRequired",
    "publicSyntheticCheckout",
    "privateEnvImported = [bool]$PrivateEnvImported",
    "steamClientHealthRecentMinutes",
    "Get-RedactedSteamConfigLabel",
    "LocalizedTagNames",
    " ...[truncated]",
    "CleanStaleOverlayHelpers",
    "Stop-StaleSteamOverlayHelpers",
    "Get-OverlayHelperDiagnostics",
    "staleOverlayHelperCount",
    "resourceSnapshot",
    "Get-SteamClientRenderingHealth",
    "steam-client-rendering-health.json",
    "steam-cef-dxgi-not-currently-available",
    "steam-cef-paint-event-warning",
    "AllowUnhealthySteamClientLogs",
    "Test-WindowsLiveRunReadiness",
    "ready = ($errors.Count -eq 0)",
    "live-run-readiness.json",
    "Windows overlay matrix readiness passed.",
    "The matrix will not silently start Steam for live overlay proof.",
    "steam-launch",
    "steam-app",
    "ArtifactRoot",
    "Get-WindowsSessionSummary",
    "currentSessionInteractive",
    "interactive explorer SessionId",
    "DXGI_ERROR_NOT_CURRENTLY_AVAILABLE"
  ]) {
    assert.ok(matrixHelper.includes(expected), `Windows overlay matrix missing ${expected}`);
  }
  assert.doesNotMatch(
    matrixHelper,
    /New-ShortcutOpenAndWaitCase -Id "15-managed-shortcut"[^\r\n]*RequireMicroTxnCallback/,
    "Windows shortcut checkout must not claim operation-scoped MicroTxn callback proof"
  );
  const keyboardShortcutCase = matrixHelper.match(
    /-Id "15-managed-shortcut-keyboard"[\s\S]*?-ResultDelayMs 30000/
  )?.[0];
  assert.ok(keyboardShortcutCase, "Windows managed keyboard shortcut case is missing");
  assert.doesNotMatch(
    keyboardShortcutCase,
    /RequireMicroTxnCallback/,
    "Windows keyboard shortcut checkout must not claim operation-scoped MicroTxn callback proof"
  );
  const duplicateOpenGuardCase = matrixHelper.match(
    /-Id "11b-managed-duplicate-open-guard"[\s\S]*?-AutorunUserGestureGate/
  )?.[0];
  assert.ok(duplicateOpenGuardCase, "Windows managed duplicate-open guard case is missing");
  assert.match(
    matrixHelper,
    /if \(\$action -eq "presenter-duplicate-open-guard"\) \{\s*return "web-close-click-sendinput"\s*\}/,
    "Windows duplicate-open guard must resolve auto close input to the visible web-panel close path"
  );
  for (const expected of [
    '-Action "presenter-duplicate-open-guard"',
    '"overlay:presenter-open-and-wait-start"',
    '"overlay:presenter-duplicate-open-guard"',
    '"overlay:presenter-wait-closed"',
    '"overlay:presenter-parked"',
    '"overlay:presenter-open-and-wait-complete"',
    "-RequireOverlayActivated",
    "-RequireManagedOverlayComplete",
    '-ManagedOverlayResultMode "complete"',
    "-AutorunUserGestureGate"
  ]) {
    assert.ok(
      duplicateOpenGuardCase.includes(expected),
      `Windows managed duplicate-open guard case missing ${expected}`
    );
  }
  assert.match(
    matrixHelper,
    /-Id "01-checkout-prepare"[\s\S]*?-RequireNoOverlayActivation `\r?\n\s+-AllowOverlayNotReady `\r?\n\s+-ResultDelayMs 1200/,
    "Windows checkout prepare case must allow overlay-not-ready while requiring no overlay activation"
  );
  assert.ok(
    matrixSummary.includes('"shortcut-routes"'),
    "Windows overlay matrix summary must accept the shortcut-routes suite"
  );
  assert.ok(
    matrixSummary.includes('"steam-app"'),
    "Windows overlay matrix summary must accept real Steam app launch mode"
  );
  for (const expected of [
    "verifyDuplicateOpenGuard",
    "verifyPersistentReuseProof",
    "verifyPersistentCloseProbe",
    'const PERSISTENT_REUSE_GATE_POLICY = "initial-user-gesture-verify-only-v1"',
    "const PERSISTENT_REUSE_EVIDENCE_SCHEMA = 1",
    "current persistent reuse omits the historical full-control readiness artifact",
    "current persistent close probe keeps handoff-only control across three closes",
    "persistent result and lifecycle projections agree exactly",
    "uses process and thread per-monitor-v2 awareness",
    "scale agrees with independent presenter geometry",
    "has one readable physical screenshot containing its native host",
    "uses distinct pre-send physical screenshot artifacts",
    "causally bridges shown and active to close and inactive",
    "makes no handoff or native-show request",
    "confirmation of the cycle-one host",
    "verifyPassiveNotificationProof",
    "false-to-true needs-present",
    "no hot full-diagnostics loop",
    "reuses one native surface instance",
    "reuses one native HWND",
    "persistent focus cycle ${ordinal} response matched its ordinal",
    "validateCleanupArtifacts",
    "launch-env rollback completed successfully",
    "restored launch env bytes match exactly",
    "interactive task deletion was independently verified",
    "task wrapper runner-tree guard completed successfully",
    "task wrapper launch-env guard completed successfully",
    "task wrapper package-process guard completed successfully",
    "task wrapper handoff-file cleanup completed successfully",
    "final shutdown released surface ownership",
    "final shutdown records exactly one detach",
    "DUPLICATE_OPEN_NAMED_STATUS_NAMES",
    "duplicateOpenGuardProof",
    "proved duplicate-open suppression payload",
    "openCheckoutAndWaitIfAvailable returned null while busy",
    "checkout IfAvailable did not run the transaction operation while busy",
    "presenterBackendEvidence",
    "result renderer backend is ${expectedNativeHostBackend}",
    "lifecycle includes an attached presenter backend snapshot",
    "closeProbeEvidenceSchema",
    "close probe input matches resolved ${expectedCloseProbeInput}",
    "recorded one native-presenter focus step",
    "close probe focus used the lifecycle native-host window",
    "close probe focus evidence omits raw native HWND",
    "close probe validated the lifecycle native-host window before focus",
    "native presenter focus succeeded before close input",
    "nativePresenterFocusSanitized",
    "reconfirmed native presenter focus immediately before input",
    "pre-dispatch focus evidence omits raw native HWND",
    "nativePresenterPreDispatchSanitized",
    "close probe scale agrees with independent presenter geometry",
    "close probe includes a native host rect",
    "close probe includes a successful screenshot with declared bounds",
    "close probe includes a readable physical screenshot",
    "physical screenshot dimensions match declared bounds",
    "has one coherent physical screenshot proof record",
    "close probe used process per-monitor-v2 DPI awareness",
    "close probe used thread per-monitor-v2 DPI awareness",
    "close probe sent all three pointer inputs without error",
    "close probe pointer coordinates match the audited target",
    "close probe target lies inside the detected panel",
    "webCloseTargetUsesScaleAwareInsets",
    "close probe target uses scale-aware panel insets",
    "named checkoutOperation status explicitly rejects operation start",
    "physical screenshot bounds contain the native host rect"
  ]) {
    assert.ok(matrixSummary.includes(expected), `Windows overlay matrix summary missing ${expected}`);
  }
  for (const expected of [
    "SBOverlayMatrix",
    "PrivateEnvFile",
    "MatrixArgsFile",
    '"/IT"',
    "windows-overlay-matrix.ps1",
    "Imported private environment values: count=",
    "DONE_JSON_BEGIN",
    "TASK_LOG_PRESENT=",
    "Private environment file was not found.",
    "Matrix arguments file must contain a JSON array or an object with matrixArgs.",
    "Private environment file contains an invalid environment variable name.",
    "Read-MatrixArgsFile",
    "Convert-MatrixArgsToSplat",
    "Split-MatrixArgumentNameValue",
    "Format-RedactedMatrixArgs",
    '"-CandidateAuditManifest"',
    "HashSet[string]",
    "StringComparer]::OrdinalIgnoreCase",
    "HasInlineValue",
    "inlineValue",
    '"-InitTxnResponseFile"',
    '"-LaunchEnvFile"',
    '"-SteamUserId"',
    '"-WebUrl"',
    "matrixArgs",
    "matrixSplat",
    "REDACTED",
    '"-TaskCleanupExpected"',
    '$endResult = Invoke-NativeExitCode',
    '$deleteResult = Invoke-NativeExitCode',
    '$queryResult = Invoke-NativeExitCode',
    '-Arguments @("/End", "/TN", $taskName)',
    '-Arguments @("/Delete", "/TN", $taskName, "/F")',
    '-Arguments @("/Query", "/TN", $taskName)',
    '$cleanup.endExitCodeCaptured = ($endResult.exitCodeCaptured -eq $true)',
    '$cleanup.deleteExitCodeCaptured = ($deleteResult.exitCodeCaptured -eq $true)',
    '$cleanup.queryExitCodeCaptured = ($queryResult.exitCodeCaptured -eq $true)',
    '$cleanup.deleteExitCodeCaptured -and',
    '$cleanup.queryExitCodeCaptured -and',
    '$cleanup.queryExitCode -eq 1',
    '$cleanup.cleanupPhaseErrorCount += 1',
    '$cleanup.cleanupPhaseErrorCount -eq 0',
    "Resolve-MatrixArgumentValue",
    "New-TaskLaunchEnvGuard",
    "Start-TaskLaunchEnvGuard",
    "Complete-TaskLaunchEnvGuard",
    "Wait-TaskRunnerTreeCapture",
    "Start-TaskRunnerTreeGuard",
    "Complete-TaskRunnerTreeGuard",
    "SteamBridgeExactProcessStop",
    "Invoke-ExactProcessStop",
    "Get-ExactTaskRunnerProcesses",
    "Stop-AndVerifyTaskSmokePackageProcesses",
    "Remove-AndVerifyTaskFiles",
    "runnerProcessGuard",
    "launchEnvGuard",
    "packageProcessGuard",
    "Start-SteamContinuityGuard",
    "Complete-SteamContinuityGuard",
    "steamContinuityGuard",
    "taskRunLevel = $TaskRunLevel",
    'arguments += "-PrivateEnvImported"',
    "taskFileGuard",
    "restoredBytesMatch",
    "emptyVerificationScanCount",
    '"task-cleanup.json"',
    "deletionVerified"
  ]) {
    assert.ok(taskWrapper.includes(expected), `Windows overlay task wrapper missing ${expected}`);
  }
  assert.doesNotMatch(
    taskCleanupFinally,
    /&\s+schtasks\.exe\s+\/(?:End|Delete|Query)\b/,
    "Windows task cleanup must capture expected native failures without direct Stop-preference invocations"
  );
  for (const expected of [
    "steam-bridge-windows-render-health-probe",
    'name = "default"',
    "in-process-gpu-on",
    "in-process-gpu-off",
    "in-process-gpu-on-disable-direct-composition",
    "readyForSteamOverlayMatrix",
    "default-blank-composition-visible-but-crashy",
    "FailOnUnhealthyDefault",
    "Capture-DesktopScreenshot",
    "Analyze-ClientScreenshot",
    "fatalLifecycleEventCount"
  ]) {
    assert.ok(renderHealthHelper.includes(expected), `Windows render health helper missing ${expected}`);
  }
  for (const expected of [
    "steam-bridge-windows-steam-app-launch-options",
    "print-wrapper",
    "set",
    "restore",
    "inspect",
    "SteamBridgeSmoke.exe",
    "--steam-bridge-smoke-env-file=",
    "--log-file=",
    "electron-debug.log",
    "%command%",
    "localconfig.vdf",
    "Fully quit Steam before editing localconfig.vdf",
    "Steam can overwrite that file",
    "while it is running",
    "assertSteamStoppedUnlessAllowed",
    "tasklist.exe",
    "backupPath",
    "containsSmokeExe",
    "containsEnvFileArg",
    "containsLogFileArg",
    "containsCommandToken",
    "parseTextVdf",
    "Windows Steam app launch options self-test passed."
  ]) {
    assert.ok(
      steamAppLaunchOptionsHelper.includes(expected),
      `Windows Steam app launch-options helper missing ${expected}`
    );
  }
  for (const expected of [
    "upsert-steam-app-launch-options.cjs",
    "Resolve-NodeLikeRunner",
    "UseElectronRunAsNode",
    "ELECTRON_RUN_AS_NODE",
    "Start-Process",
    "RedirectStandardOutput",
    "RedirectStandardError",
    "--result-file",
    "resultPath",
    "Join-WindowsProcessArguments",
    "AllowSteamRunning",
    "SteamBridgeSmoke.exe",
    "--smoke-app-dir",
    "--allow-steam-running"
  ]) {
    assert.ok(
      steamAppLaunchOptionsWrapper.includes(expected),
      `Windows Steam app launch-options wrapper missing ${expected}`
    );
  }
  for (const expected of [
    "AddSteamIdentityEvent",
    "AppendRedactedSteamIdProperty",
    "RedactedSteamIdJson",
    "redacted",
    "present",
    "uint64"
  ]) {
    assert.ok(nativeControlSource.includes(expected), `Windows native overlay control missing ${expected}`);
  }
  assert.doesNotMatch(
    nativeControlSource,
    /AppendJsonProperty\(builder,\s*"steamId64",\s*SteamId64\.ToString/,
    "Windows native overlay control result must not write raw Steam IDs"
  );
  assert.doesNotMatch(
    nativeControlSource,
    /AddEvent\("steam-identity",\s*0,\s*"steamId64",\s*steamId64\.ToString/,
    "Windows native overlay control events must not write raw Steam IDs"
  );
  for (const expected of [
    "steam-bridge-windows-native-load-gate-blocker",
    "steam-bridge-windows-overlay-matrix-manifest",
    "matrix manifest case missing result",
    "emitted required event",
    "completed overlay close wait",
    "used complete managed overlay result mode",
    "managedOverlayResultMode",
    "matrix-manifest.json",
    "windows-app-control-native-load-block",
    "native-load-gate-app-control.json",
    "native-load-gate-blocker.json",
    "steam-bridge-windows-steam-launch-blocker",
    "Steam-launch blocker",
    "steam-launch blockers",
    "assumedShortcut",
    "assumed Steam shortcut invalid",
    "renderHealth",
    "Windows default render health is not ready",
    "steamRenderingHealth",
    "renderingUnhealthyCases",
    "steam-overlay-swapchain-failure",
    "recentSignals=",
    "closeProbeVisuals=",
    "analyzePngVisuals",
    "decodePng",
    "expectedNativeHostBackend=",
    "nativePathOverride=",
    "requireMicroTxnCallback=",
    "launchKind",
    "callback:microtxn-listener-registered",
    "registered MicroTxnAuthorizationResponse listener",
    "LegacyMicroTxnAuthorizationResponse",
    "registered LegacyMicroTxnAuthorizationResponse listener",
    "microTxnListener=",
    "legacyMicroTxnListener=",
    "microTxnCallbacks=",
    "microTxnSources=",
    "microTxnCurrentOperation=",
    "microTxnCallbackProof",
    "did not match the current checkout operation",
    "did not include a callback source",
    "callback source expected steamworks or legacy",
    "clientSessionCapturedTransaction=",
    "clientSessionWaitStarted=",
    "clientSessionWaitPrompt=",
    "clientSessionWaitPresenter=",
    "clientSessionCapturedRequest=",
    "clientPromptRequest=",
    "clientQuery=",
    "clientQuerySchema=",
    "clientQueryClosed=",
    "validateClientSessionPromptMissingQueryProof",
    "isClientSessionQueryClosedDiagnostic",
    "chain matches one InitTxn context",
    "checkoutOperationDeferredInitTxn=",
    "checkout:client-session-query",
    "captured client-session InitTxn checkout target",
    "started waiting for the client-session Steam prompt",
    "classified the missing client-session Steam prompt",
    "initTxnRequest=",
    "initTxnRequestShapePreflight:",
    "initTxnRequestShapeSummary=",
    "missing InitTxn request-shape preflight JSON",
    "InitTxn request-shape preflight app ID matches matrix App ID",
    "matrix InitTxn request-file manifest has matching preflight shape",
    "runtime InitTxn request shape matches preflight",
    "captured InitTxn request-shape event",
    "webSessionCaptured=",
    "captured web-session InitTxn checkout target",
    "captured web-session InitTxn Steam approval URL shape",
    "records sanitized InitTxn request-shape field summary",
    "proved MicroTxnAuthorizationResponse callback",
    "steam-bridge-windows-live-run-readiness",
    "windowsSession",
    "currentSessionInteractive",
    "STEAM_BRIDGE_SMOKE_RESULT ",
    "platform is win32",
    "arch is x64",
    "crash diagnostics available",
    "Windows overlay matrix summary self-test passed."
  ]) {
    assert.ok(matrixSummary.includes(expected), `Windows overlay matrix summary missing ${expected}`);
  }
  for (const expected of [
    "OverlayScrubChildEnv",
    "OverlayIsolateChildProcesses",
    "STEAM_BRIDGE_ELECTRON_OVERLAY_SCRUB_CHILD_ENV",
    "STEAM_BRIDGE_ELECTRON_OVERLAY_ISOLATE_CHILD_PROCESSES",
    "--steam-bridge-electron-overlay-scrub-child-env",
    "--steam-bridge-electron-overlay-isolate-child-processes",
    "RequireNativeHostBackend",
    "native presenter backend is $RequireNativeHostBackend",
    "MicroTxnAuthorizationResponse listener was registered before checkout proof",
    "LegacyMicroTxnAuthorizationResponse listener was registered before checkout proof",
    "callback source is steamworks or legacy",
    "required MicroTxnAuthorizationResponse callback matched the current checkout operation",
    "Assert-ClientSessionPromptMissingQueryProof",
    "Test-ClientSessionQueryClosedSchema",
    "-RequireMicroTxnCallback requires presenter-checkout"
  ]) {
    assert.ok(helper.includes(expected), `Windows smoke helper missing ${expected}`);
  }
  for (const expected of [
    "enableInProcessGpu = compatibilityMode"
  ]) {
    assert.ok(electronHelper.includes(expected), `Electron overlay helper missing ${expected}`);
  }
}

function assertWindowsExpandableClickShape(sourceLine) {
  if (process.platform !== "win32") {
    return;
  }
  const command = [
    "$line = $env:STEAM_BRIDGE_EXPANDABLE_LINE",
    "$outer = '$value = @\"' + [Environment]::NewLine + $line + [Environment]::NewLine + '\"@' + [Environment]::NewLine + '$value'",
    "$expanded = & ([ScriptBlock]::Create($outer))",
    "$tokens = $null",
    "$errors = $null",
    "$ast = [System.Management.Automation.Language.Parser]::ParseInput([string]$expanded, [ref]$tokens, [ref]$errors)",
    "$calls = @($ast.FindAll({ param($node) $node -is [System.Management.Automation.Language.CommandAst] -and $node.GetCommandName() -eq 'Send-NativeMouseClick' }, $true))",
    "if (@($errors).Count -ne 0 -or $calls.Count -ne 1 -or $calls[0].CommandElements.Count -ne 3) { Write-Error 'Expandable click command lost positional arguments.'; exit 1 }"
  ].join("; ");
  const result = spawnSync(
    "powershell.exe",
    ["-NoProfile", "-NonInteractive", "-Command", command],
    {
      encoding: "utf8",
      env: { ...process.env, STEAM_BRIDGE_EXPANDABLE_LINE: sourceLine },
      windowsHide: true
    }
  );
  assert.equal(
    result.status,
    0,
    `Windows expandable click AST check failed: ${String(result.stderr || "").trim()}`
  );
}

function runWindowsExactProcessStopSelfTest() {
  if (process.platform !== "win32") {
    return;
  }

  const taskWrapper = fs.readFileSync(
    path.join(repoRoot, "scripts", "windows-overlay-task.ps1"),
    "utf8"
  );
  const runtimeStart = taskWrapper.indexOf('if (-not ("SteamBridgeExactProcessStop" -as [type]))');
  const evidenceStart = taskWrapper.indexOf("function Add-ExactProcessStopEvidence", runtimeStart);
  const evidenceEnd = taskWrapper.indexOf("\nfunction Resolve-FullPath", evidenceStart);
  assert.ok(
    runtimeStart >= 0 && evidenceStart > runtimeStart && evidenceEnd > evidenceStart,
    "Windows exact process stop self-test could not isolate the tested runtime"
  );
  const testPath = path.join(tempRoot, "windows-exact-process-stop-self-test.ps1");
  const testScript = `${taskWrapper.slice(runtimeStart, evidenceStart)}
${taskWrapper.slice(evidenceStart, evidenceEnd)}
$ErrorActionPreference = "Stop"
$sentinel = $null
$unrelated = $null
try {
  $sentinel = Start-Process powershell.exe -ArgumentList @("-NoProfile", "-NonInteractive", "-Command", "Start-Sleep -Seconds 60") -WindowStyle Hidden -PassThru
  $sentinelCim = Get-CimInstance Win32_Process -Filter ("ProcessId = {0}" -f $sentinel.Id) -ErrorAction Stop
  $sentinelCimTicks = ([DateTime]$sentinelCim.CreationDate).ToUniversalTime().Ticks
  $sentinelNativeTicks = Get-ExactProcessNativeStartTicks -ProcessId $sentinel.Id -CimStartTicks $sentinelCimTicks
  if ($sentinelNativeTicks -le 0 -or [Math]::Abs($sentinelNativeTicks - $sentinelCimTicks) -gt 9) { exit 1 }

  $wrong = Invoke-ExactProcessStop -ProcessId $sentinel.Id -ExpectedStartTicks ($sentinelNativeTicks + 10)
  $sentinel.Refresh()
  if ($wrong.status -ne "identity-mismatch" -or -not $wrong.ok -or $sentinel.HasExited) { exit 2 }

  $exact = Invoke-ExactProcessStop -ProcessId $sentinel.Id -ExpectedStartTicks $sentinelNativeTicks
  if ($exact.status -ne "terminated" -or -not $exact.ok -or -not $sentinel.WaitForExit(5000)) { exit 3 }

  $unrelated = Start-Process powershell.exe -ArgumentList @("-NoProfile", "-NonInteractive", "-Command", "Start-Sleep -Seconds 60") -WindowStyle Hidden -PassThru
  $gone = Invoke-ExactProcessStop -ProcessId $sentinel.Id -ExpectedStartTicks $sentinelNativeTicks
  $unrelated.Refresh()
  if (-not $gone.ok -or $gone.status -notin @("open-not-found", "already-exited", "identity-mismatch") -or $unrelated.HasExited) { exit 4 }

  $invalid = Invoke-ExactProcessStop -ProcessId 0 -ExpectedStartTicks 0
  if ($invalid.ok -or $invalid.status -ne "invalid-identity") { exit 5 }

  $evidence = [PSCustomObject]@{
    stopAttemptCount = 0
    stopTerminatedCount = 0
    stopNotFoundCount = 0
    stopAlreadyExitedCount = 0
    stopIdentityMismatchCount = 0
    stopWaitTimeoutCount = 0
    stopFailureCount = 0
  }
  foreach ($result in @($wrong, $exact, $gone, $invalid)) {
    Add-ExactProcessStopEvidence -Evidence $evidence -Prefix "stop" -Result $result
  }
  $outcomes = $evidence.stopTerminatedCount + $evidence.stopNotFoundCount +
    $evidence.stopAlreadyExitedCount + $evidence.stopIdentityMismatchCount +
    $evidence.stopWaitTimeoutCount + $evidence.stopFailureCount
  if ($evidence.stopAttemptCount -ne 4 -or $outcomes -ne 4 -or
      $evidence.stopTerminatedCount -ne 1 -or $evidence.stopFailureCount -ne 1) { exit 6 }
  $serialized = $evidence | ConvertTo-Json -Compress
  if ($serialized -match "(?i)processId|startTicks|path|commandLine") { exit 7 }
  $orderedEvidence = [ordered]@{
    rootStopAttemptCount = 0
    rootStopTerminatedCount = 0
    rootStopNotFoundCount = 0
    rootStopAlreadyExitedCount = 0
    rootStopIdentityMismatchCount = 0
    rootStopWaitTimeoutCount = 0
    rootStopFailureCount = 0
  }
  Add-ExactProcessStopEvidence -Evidence $orderedEvidence -Prefix "rootStop" -Result $wrong
  if ($orderedEvidence.rootStopAttemptCount -ne 1 -or $orderedEvidence.rootStopIdentityMismatchCount -ne 1) { exit 8 }
  Write-Output "WINDOWS_EXACT_PROCESS_STOP_SELF_TEST_OK"
  exit 0
} finally {
  foreach ($owned in @($sentinel, $unrelated)) {
    if ($null -ne $owned) {
      try {
        $owned.Refresh()
        if (-not $owned.HasExited) {
          $owned.Kill()
          [void]$owned.WaitForExit(5000)
        }
      } catch {}
      $owned.Dispose()
    }
  }
}
`;
  fs.writeFileSync(testPath, testScript);
  const result = spawnSync(
    "powershell.exe",
    ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-File", testPath],
    { encoding: "utf8", windowsHide: true }
  );
  assert.equal(
    result.status,
    0,
    `Windows exact process stop self-test failed: ${String(result.stderr || "").trim()}`
  );
}

function runWindowsTaskTreeAncestrySelfTest() {
  if (process.platform !== "win32") {
    return;
  }

  const taskWrapper = fs.readFileSync(
    path.join(repoRoot, "scripts", "windows-overlay-task.ps1"),
    "utf8"
  );
  const start = taskWrapper.indexOf("function Get-TaskProcessStartTicks");
  const end = taskWrapper.indexOf("\nfunction Start-TaskRunnerTreeGuard", start);
  assert.ok(start >= 0 && end > start, "Windows task-tree self-test could not isolate ancestry functions");
  const testPath = path.join(tempRoot, "windows-overlay-task-tree-self-test.ps1");
  const testScript = `${taskWrapper.slice(start, end)}
$parentStart = [DateTime]::UtcNow
function Get-TaskProcessNativeStartTicks {
  param($Process)
  return Get-TaskProcessStartTicks -Process $Process
}
$parent = [PSCustomObject]@{ ProcessId = 100; ParentProcessId = 1; CreationDate = $parentStart }
$validChild = [PSCustomObject]@{ ProcessId = 200; ParentProcessId = 100; CreationDate = $parentStart.AddMilliseconds(1) }
$equalTimeChild = [PSCustomObject]@{ ProcessId = 204; ParentProcessId = 100; CreationDate = $parentStart }
$staleChild = [PSCustomObject]@{ ProcessId = 201; ParentProcessId = 100; CreationDate = $parentStart.AddMinutes(-1) }
$staleGrandchild = [PSCustomObject]@{ ProcessId = 205; ParentProcessId = 201; CreationDate = $parentStart.AddMilliseconds(2) }
$wrongParent = [PSCustomObject]@{ ProcessId = 202; ParentProcessId = 101; CreationDate = $parentStart.AddMilliseconds(1) }
$missingStart = [PSCustomObject]@{ ProcessId = 203; ParentProcessId = 100; CreationDate = $null }
if (-not (Test-TaskRunnerTreeParentChild -Process $validChild -ParentProcess $parent)) { exit 1 }
if (-not (Test-TaskRunnerTreeParentChild -Process $equalTimeChild -ParentProcess $parent)) { exit 2 }
if (Test-TaskRunnerTreeParentChild -Process $staleChild -ParentProcess $parent) { exit 3 }
if (Test-TaskRunnerTreeParentChild -Process $wrongParent -ParentProcess $parent) { exit 4 }
if (Test-TaskRunnerTreeParentChild -Process $missingStart -ParentProcess $parent) { exit 5 }
$state = New-TaskRunnerTreeState -RunnerPath "runner.ps1"
if (Add-TaskRunnerTreeIdentity -State $state -Process $missingStart -Root $true) { exit 6 }
if ($state.rootIdentities.Count -ne 0) { exit 7 }
if (-not (Add-TaskRunnerTreeIdentity -State $state -Process $parent -Root $true)) { exit 8 }
$identity = $state.rootIdentities["100"]
if (-not (Test-TaskRunnerTreeIdentity -Process $parent -Identity $identity)) { exit 9 }
if (Test-TaskRunnerTreeIdentity -Process $parent -Identity $null) { exit 10 }
$script:MockProcesses = @($parent, $validChild, $equalTimeChild, $staleChild, $staleGrandchild, $missingStart)
function Get-CimInstance { return @($script:MockProcesses) }
$active = @(Update-TaskRunnerTreeState -State $state)
$activeIds = @($active | ForEach-Object { [int]$_.ProcessId } | Sort-Object)
if (($activeIds -join ",") -ne "100,200,204") { exit 11 }
$observedIds = @($state.observedIdentities.Values | ForEach-Object { [int]$_.processId } | Sort-Object)
if (($observedIds -join ",") -ne "100,200,204") { exit 12 }
if ($state.ancestryRejectionCount -lt 1) { exit 13 }
$reusedPid = [PSCustomObject]@{ ProcessId = 100; ParentProcessId = 1; CreationDate = $parentStart.AddMinutes(1) }
$script:MockProcesses = @($reusedPid)
if (@(Update-TaskRunnerTreeState -State $state).Count -ne 0) { exit 14 }
$script:MockRootMatches = @($missingStart)
function Get-ExactTaskRunnerProcesses { return @($script:MockRootMatches) }
$invalidRootState = New-TaskRunnerTreeState -RunnerPath "runner.ps1"
if (Wait-TaskRunnerTreeCapture -State $invalidRootState -WaitSeconds 1) { exit 15 }
if ($invalidRootState.rootIdentities.Count -ne 0) { exit 16 }
$validRoot = [PSCustomObject]@{ ProcessId = 300; ParentProcessId = 1; CreationDate = $parentStart }
$invalidRoot = [PSCustomObject]@{ ProcessId = 301; ParentProcessId = 1; CreationDate = $null }
$script:MockRootMatches = @($invalidRoot, $validRoot)
$script:MockProcesses = @($validRoot)
$mixedRootState = New-TaskRunnerTreeState -RunnerPath "runner.ps1"
if (-not (Wait-TaskRunnerTreeCapture -State $mixedRootState -WaitSeconds 1)) { exit 17 }
if ($mixedRootState.rootIdentities.Count -ne 1 -or -not $mixedRootState.rootIdentities.ContainsKey("300")) { exit 18 }
exit 0
`;
  fs.writeFileSync(testPath, testScript);
  const result = spawnSync(
    "powershell.exe",
    ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-File", testPath],
    { encoding: "utf8", windowsHide: true }
  );
  assert.equal(
    result.status,
    0,
    `Windows task-tree ancestry self-test failed: ${String(result.stderr || "").trim()}`
  );
}

function runWindowsSteamContinuitySelfTest() {
  if (process.platform !== "win32") {
    return;
  }
  const taskWrapper = fs.readFileSync(
    path.join(repoRoot, "scripts", "windows-overlay-task.ps1"),
    "utf8"
  );
  const start = taskWrapper.indexOf("function Get-TaskProcessStartTicks");
  const end = taskWrapper.indexOf("\nfunction New-TaskRunnerTreeState", start);
  assert.ok(start >= 0 && end > start, "Windows Steam-continuity self-test could not isolate guard functions");
  const testPath = path.join(tempRoot, "windows-steam-continuity-self-test.ps1");
  const testScript = `${taskWrapper.slice(start, end)}
$ErrorActionPreference = "Stop"
$script:MockProcesses = @()
function Get-CimInstance { return @($script:MockProcesses) }
function Get-TaskProcessNativeStartTicks {
  param($Process)
  return Get-TaskProcessStartTicks -Process $Process
}
$started = [DateTime]::UtcNow
$steam = [PSCustomObject]@{ ProcessId = 101; SessionId = 1; CreationDate = $started }
$script:MockProcesses = @($steam)
$guard = Start-SteamContinuityGuard -Required $true
if (-not $guard.beforeCaptureSucceeded -or $guard.beforeIdentities.Count -ne 1) { exit 1 }
$same = Complete-SteamContinuityGuard -Guard $guard
if (-not $same.ok -or -not $same.sameIdentitySet -or -not $same.sameSessionSet) { exit 2 }
if ($same.beforeIdentities[0].cimStartTicks -isnot [string] -or $same.beforeIdentities[0].nativeStartTicks -isnot [string]) { exit 3 }
$script:MockProcesses = @([PSCustomObject]@{ ProcessId = 101; SessionId = 1; CreationDate = $started.AddSeconds(1) })
$restarted = Complete-SteamContinuityGuard -Guard $guard
if ($restarted.ok -or $restarted.sameIdentitySet -or $restarted.missingIdentityCount -ne 1 -or $restarted.additionalIdentityCount -ne 1) { exit 4 }
$script:MockProcesses = @([PSCustomObject]@{ ProcessId = 101; SessionId = 2; CreationDate = $started })
$sessionDrift = Complete-SteamContinuityGuard -Guard $guard
if ($sessionDrift.ok -or -not $sessionDrift.sameIdentitySet -or $sessionDrift.sameSessionSet) { exit 5 }
$script:MockProcesses = @(
  $steam,
  [PSCustomObject]@{ ProcessId = 102; SessionId = 1; CreationDate = $started }
)
$additional = Complete-SteamContinuityGuard -Guard $guard
if ($additional.ok -or $additional.afterCount -ne 2 -or $additional.additionalIdentityCount -ne 1) { exit 6 }
$optional = Start-SteamContinuityGuard -Required $false
$optionalResult = Complete-SteamContinuityGuard -Guard $optional
if (-not $optionalResult.ok -or $optionalResult.required) { exit 7 }
exit 0
`;
  fs.writeFileSync(testPath, testScript);
  const result = spawnSync(
    "powershell.exe",
    ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-File", testPath],
    { encoding: "utf8", windowsHide: true }
  );
  assert.equal(
    result.status,
    0,
    `Windows Steam-continuity self-test failed: ${String(result.stderr || "").trim()}`
  );
}

function runPackagedWindowsOverlaySummarySelfTest() {
  const helperDir = path.join(tempRoot, "packaged-windows-overlay-summary");
  fs.mkdirSync(helperDir, { recursive: true });
  const summaryPath = path.join(helperDir, "summarize-windows-overlay-matrix.cjs");
  fs.copyFileSync(path.join(repoRoot, "scripts", "summarize-windows-overlay-matrix.cjs"), summaryPath);
  fs.copyFileSync(
    path.join(repoRoot, "examples", "electron-basic", "checkout-proof.cjs"),
    path.join(helperDir, "checkout-proof.cjs")
  );
  fs.copyFileSync(
    path.join(repoRoot, "scripts", "windows-release-candidate-fingerprint.cjs"),
    path.join(helperDir, "windows-release-candidate-fingerprint.cjs")
  );
  run("node", [summaryPath, "--self-test"], { cwd: helperDir });
}

function runElectronSmokeActionStaticChecks() {
  const main = fs.readFileSync(path.join(repoRoot, "examples", "electron-basic", "main.js"), "utf8");
  const checkoutProof = fs.readFileSync(
    path.join(repoRoot, "examples", "electron-basic", "checkout-proof.cjs"),
    "utf8"
  );
  const preload = fs.readFileSync(path.join(repoRoot, "examples", "electron-basic", "preload.js"), "utf8");
  const html = fs.readFileSync(path.join(repoRoot, "examples", "electron-basic", "index.html"), "utf8");
  const linuxHelper = fs.readFileSync(path.join(repoRoot, "scripts", "linux-electron-smoke.sh"), "utf8");
  const deckHelper = fs.readFileSync(path.join(repoRoot, "scripts", "steam-deck-smoke.sh"), "utf8");
  const windowsHelper = fs.readFileSync(path.join(repoRoot, "scripts", "windows-electron-smoke.ps1"), "utf8");

  for (const [label, source, expected] of [
    ["Electron smoke main", main, "case \"presenter-ready\""],
    ["Electron smoke main", main, "case \"achievement-progress\""],
    ["Electron smoke main", main, "case \"achievement-unlock\""],
    ["Electron smoke main", main, "case \"presenter-duplicate-open-guard\""],
    ["Electron smoke main", main, "overlay:presenter-ready"],
    ["Electron smoke main", main, "overlay:presenter-duplicate-open-guard"],
    ["Electron smoke main", main, "overlay:presenter-direct-open-wait-start"],
    ["Electron smoke main", main, "overlay:presenter-direct-open-status"],
    ["Electron smoke main", main, "directPresenterOpenReadinessStatus"],
    ["Electron smoke main", main, "waitForDirectPresenterOpenReadiness"],
    ["Electron smoke main", main, "recordCheckoutOperationReadiness"],
    ["Electron smoke main", main, "overlayDisableDirectComposition"],
    ["Electron smoke main", main, "overlayInProcessGpu"],
    ["Electron smoke main", main, "--steam-bridge-electron-overlay-in-process-gpu"],
    ["Electron smoke main", main, "--steam-bridge-electron-overlay-disable-direct-composition"],
    ["Electron smoke main", main, "const target = checkoutTargetFromOperation(transaction);"],
    ["Electron smoke main", main, "const targetSnapshot = steamworks.overlay.snapshotSteamOverlayTarget(target);"],
    ["Electron smoke main", main, "checkout:client-session-wait-start"],
    ["Electron smoke main", main, "checkout:client-session-prompt-missing"],
    ["Electron smoke main", main, "checkout:init-txn-target-missing"],
    ["Electron smoke main", main, "checkout:init-txn-request-shape"],
    ["Electron smoke main", main, "initTxnFailureDiagnostic"],
    ["Electron smoke main", main, "initTxnRequestShape"],
    ["Electron smoke main", main, "normalizeInitTxnRequestSession"],
    ["Electron smoke main", main, "client-default"],
    ["Electron smoke main", main, "facade.initTxn(initTxnRequest)"],
    ["Electron smoke main", main, "isSteamOverlayWaitTimeout"],
    ["Electron smoke main", main, "throwIfNativeHostUnavailable(readinessSnapshot, pendingTarget)"],
    ["Electron smoke main", main, "checkout:managed-operation-start"],
    ["Electron smoke main", main, "matchesCurrentCheckoutOperation"],
    ["Electron checkout proof", checkoutProof, "startManagedCheckoutOperation"],
    ["Electron checkout proof", checkoutProof, "createMicroTxnCheckoutCorrelationTracker"],
    ["Electron checkout proof", checkoutProof, "CLIENT_SESSION_QUERY_SCHEMA"],
    ["Electron smoke main", main, "throwIfNativeHostUnavailable(initialSnapshot, overlay.getShortcutOpenStatus())"],
    ["Electron smoke main", main, "activeSteamId64ForOverlayTarget()"],
    ["Electron smoke main", main, "return { type: \"profile\", steamId64: activeSteamId64ForOverlayTarget() }"],
    ["Electron smoke main", main, "return { type: \"players\", steamId64: activeSteamId64ForOverlayTarget() }"],
    ["Electron smoke main", main, "snapshotSteamOverlayTarget(targetContext)"],
    ["Electron smoke main", main, "waitForOverlayReady"],
    ["Electron smoke main", main, "await openPresenterWebOverlay();"],
    ["Electron smoke main", main, "await openPresenterStoreOverlay();"],
    ["Electron smoke main", main, "await openPresenterFriendsOverlay();"],
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
    ["Steam Deck smoke helper", deckHelper, "presenter-duplicate-open-guard"],
    ["Windows smoke helper", windowsHelper, '"preflight"'],
    ["Windows smoke helper", windowsHelper, "Get-AuthenticodeSignature"],
    ["Windows smoke helper", windowsHelper, "Microsoft-Windows-CodeIntegrity/Operational"]
  ]) {
    assert.ok(source.includes(expected), `${label} missing ${expected}`);
  }

  for (const expected of [
    "STEAM_BRIDGE_SMOKE_AUTORUN_USER_GESTURE_GATE",
    "--steam-bridge-smoke-autorun-user-gesture-gate",
    'ipcMain.handle("steam-smoke:autorun-user-gesture-gate-ready"',
    'ipcMain.handle("steam-smoke:autorun-user-gesture-gate-consume"',
    'recordEvent("autorun:user-gesture-gate-armed"',
    'recordEvent("autorun:user-gesture-gate-ready"',
    'recordEvent("autorun:user-gesture-gate-consumed"',
    'recordEvent("autorun:user-gesture-gate-rejected"'
  ]) {
    assert.ok(main.includes(expected), `Electron smoke user-gesture gate missing ${expected}`);
  }
  for (const [label, source] of [
    ["main", main],
    ["preload", preload]
  ]) {
    const mappingBlock = source.match(
      /const AUTORUN_USER_GESTURE_GATE_TARGETS = Object\.freeze\(\{([\s\S]*?)\n\}\);/
    )?.[1];
    assert.ok(mappingBlock, `Electron smoke ${label} closed gate mapping block is missing`);
    const actualMappings = Object.fromEntries(
      [...mappingBlock.matchAll(/^\s*"([^"]+)":\s*"([^"]+)",?\s*$/gm)].map(
        (match) => [match[1], match[2]]
      )
    );
    assert.deepEqual(
      actualMappings,
      ALL_USER_GESTURE_ACTION_TARGETS,
      `Electron smoke ${label} must retain exactly the 14 single-cycle mappings plus persistent reuse`
    );
    assert.equal(
      Object.keys(USER_GESTURE_ACTION_TARGETS).length,
      14,
      "Electron smoke single-cycle action boundary must remain exactly 14"
    );
    assert.deepEqual(
      PERSISTENT_USER_GESTURE_ACTION_TARGETS,
      { "presenter-persistent-reuse-three-cycle": GENERIC_USER_GESTURE_GATE_TARGET },
      "Electron smoke persistent gate boundary must contain one exact action"
    );
    for (const expected of [
      'typeof action !== "string"',
      "Object.prototype.hasOwnProperty.call(AUTORUN_USER_GESTURE_GATE_TARGETS, action)"
    ]) {
      assert.ok(source.includes(expected), `Electron smoke ${label} closed gate resolver missing ${expected}`);
    }
  }
  const persistentReuseStart = main.indexOf(
    "async function runPresenterPersistentReuseThreeCycle"
  );
  const persistentReuseEnd = main.indexOf(
    "\nfunction persistentReusePresenterEvidence",
    persistentReuseStart
  );
  const persistentReuseBlock = main.slice(persistentReuseStart, persistentReuseEnd);
  for (const expected of [
    "const userGesturePersistentReuse = AUTORUN_USER_GESTURE_GATE",
    "persistentReuseGatePolicy: PERSISTENT_REUSE_GATE_POLICY",
    "persistentReuseEvidenceSchema: PERSISTENT_REUSE_EVIDENCE_SCHEMA",
    "initialUserGestureCycle: 1",
    "verifyOnlyCycles: [2, 3]",
    "closeVerificationOrdinals: [1, 2, 3]",
    "if (!userGesturePersistentReuse) {\n      beginNativePresenterForegroundHandoffReuseCycle(cycle);",
    "if (!userGesturePersistentReuse) {\n      await waitForNativePresenterForegroundHandoffReuseCycle(cycle);",
    "if (!userGesturePersistentReuse) {\n      finishNativePresenterForegroundHandoffReuseCycle(cycle);"
  ]) {
    assert.ok(
      persistentReuseBlock.includes(expected),
      `Electron smoke persistent verify-only state machine missing ${expected}`
    );
  }
  for (const [call, label] of [
    ["beginNativePresenterForegroundHandoffReuseCycle(cycle)", "begin"],
    ["await waitForNativePresenterForegroundHandoffReuseCycle(cycle)", "wait"],
    ["finishNativePresenterForegroundHandoffReuseCycle(cycle)", "finish"]
  ]) {
    assert.equal(
      persistentReuseBlock.split(call).length - 1,
      1,
      `Electron smoke persistent legacy ${label} handoff must remain one guarded call`
    );
  }
  const persistentEvidenceStart = persistentReuseEnd + 1;
  const persistentEvidenceEnd = main.indexOf(
    "\nfunction validatePersistentReuseCycleEvidence",
    persistentEvidenceStart
  );
  const persistentEvidenceBlock = main.slice(persistentEvidenceStart, persistentEvidenceEnd);
  assert.ok(
    main.includes(
      'const PERSISTENT_REUSE_GATE_POLICY = "initial-user-gesture-verify-only-v1";'
    ) &&
      main.includes("const PERSISTENT_REUSE_EVIDENCE_SCHEMA = 1;") &&
    main.includes("const NATIVE_HOST_IDENTITY_SALT = crypto.randomBytes(32);") &&
      persistentEvidenceStart > 0 &&
      persistentEvidenceEnd > persistentEvidenceStart &&
      persistentEvidenceBlock.includes('.createHash("sha256")') &&
      persistentEvidenceBlock.includes(".update(NATIVE_HOST_IDENTITY_SALT)") &&
      persistentEvidenceBlock.includes('.update("\\0")') &&
      persistentEvidenceBlock.includes(".update(rawNativeHostIdentity)") &&
      persistentEvidenceBlock.includes('.digest("hex")'),
    "Electron smoke persistent HWND identity must remain process-salted SHA-256 evidence"
  );
  assert.doesNotMatch(
    persistentEvidenceBlock,
    /nativeHostIdentityToken:\s*rawNativeHostIdentity\s*[,}]/,
    "Electron smoke persistent evidence must never expose the raw native HWND identity"
  );
  const genericGateButton = html.match(
    /<button id="autorun-user-gesture-target"[^>]*>Run Gated Action<\/button>/
  )?.[0];
  assert.ok(genericGateButton, "Electron smoke UI must include the inert generic gate target");
  assert.ok(
    genericGateButton.includes('type="button"') &&
      genericGateButton.includes(" hidden") &&
      !/\bonclick=|\bdata-/.test(genericGateButton) &&
      (html.match(/autorun-user-gesture-target/g) || []).length === 1,
    "Electron smoke generic gate target must start hidden and carry no main-world action dispatcher"
  );
  assert.ok(
    preload.includes('if (button.id === "autorun-user-gesture-target") {') &&
      preload.includes("button.hidden = false"),
    "Electron smoke preload must reveal the generic gate target before measuring ready evidence"
  );

  const gateArmStart = main.indexOf("function armAutorunUserGestureGate");
  const gateArmEnd = main.indexOf("\nfunction handleAutorunUserGestureGateReady", gateArmStart);
  assert.ok(gateArmStart >= 0 && gateArmEnd > gateArmStart, "Electron smoke app must define a bounded gate arm step");
  const gateArmBlock = main.slice(gateArmStart, gateArmEnd);
  assert.ok(
    gateArmBlock.includes("const targetId = getAutorunUserGestureGateTargetId(action)") &&
      gateArmBlock.includes("if (!targetId)") &&
      gateArmBlock.includes("targetId,") &&
      gateArmBlock.includes("crypto.randomBytes(32).toString(\"hex\")") &&
      gateArmBlock.includes('state: "armed"') &&
      gateArmBlock.includes('window.webContents.send("steam-smoke:autorun-user-gesture-gate-arm"') &&
      gateArmBlock.includes("nonce: gate.nonce"),
    "Electron smoke gate must arm one private nonce before notifying its renderer"
  );
  assert.doesNotMatch(
    gateArmBlock.slice(gateArmBlock.indexOf("window.webContents.send")),
    /targetId/,
    "Electron smoke arm IPC must send only the action and private nonce, not a renderer-selected target"
  );
  assert.doesNotMatch(
    gateArmBlock,
    /setTimeout|setInterval|setImmediate|\bdelay\s*\(/,
    "Electron smoke user-gesture gate must arm from state without a timing delay"
  );

  const gateConsumeStart = main.indexOf("function handleAutorunUserGestureGateConsume");
  const gateConsumeEnd = main.indexOf("\nfunction getAutorunUserGestureGateAvailabilityReason", gateConsumeStart);
  assert.ok(
    gateConsumeStart >= 0 && gateConsumeEnd > gateConsumeStart,
    "Electron smoke app must define a bounded same-turn user-gesture consume step"
  );
  const gateConsumeBlock = main.slice(gateConsumeStart, gateConsumeEnd);
  for (const expected of [
    'gate.state === "consumed"',
    'gate.state !== "ready"',
    '"wrong-nonce"',
    "click.isTrusted !== true",
    "click.userActivationActive !== true",
    "click.button !== 0",
    "click.detail !== 1",
    "Number.isFinite(click.clientX)",
    "Number.isFinite(click.clientY)",
    "isPointInsideAutorunUserGestureGateButton",
    'gate.state = "consumed"',
    "gate.nonce = undefined",
    "runSmokeActionAndWait(gate.action"
  ]) {
    assert.ok(gateConsumeBlock.includes(expected), `Electron smoke gate consume step missing ${expected}`);
  }
  assert.ok(
    gateConsumeBlock.indexOf('gate.state = "consumed"') <
      gateConsumeBlock.indexOf("runSmokeActionAndWait(gate.action"),
    "Electron smoke gate must consume its one-shot latch before invoking the autorun action"
  );
  assert.equal(
    (gateConsumeBlock.match(/runSmokeActionAndWait\(/g) || []).length,
    1,
    "Electron smoke gate must invoke the existing autorun action exactly once"
  );
  assert.doesNotMatch(
    gateConsumeBlock,
    /\bawait\b|setTimeout|setInterval|setImmediate|\bdelay\s*\(|showNativeOverlayHostView|foreground-handoff|SetForegroundWindow/,
    "Electron smoke gate must consume the trusted click and invoke the action in the same event turn"
  );

  const gateSenderStart = main.indexOf("function getAutorunUserGestureGateSenderRejectionReason");
  const gateSenderEnd = main.indexOf("\nfunction getAutorunUserGestureGateWindowRejectionReason", gateSenderStart);
  const gateSenderBlock = main.slice(gateSenderStart, gateSenderEnd);
  assert.ok(
    gateSenderStart >= 0 &&
      gateSenderEnd > gateSenderStart &&
      gateSenderBlock.includes("event.sender !== window.webContents") &&
      gateSenderBlock.includes("event.senderFrame !== window.webContents.mainFrame"),
    "Electron smoke gate must bind ready and consume IPC to the main window and main frame"
  );
  const gateNonceStart = main.indexOf("function matchesAutorunUserGestureGateNonce");
  const gateNonceEnd = main.indexOf("\nfunction getAutorunUserGestureGateTargetId", gateNonceStart);
  const gateNonceBlock = main.slice(gateNonceStart, gateNonceEnd);
  assert.ok(
    gateNonceStart >= 0 &&
      gateNonceEnd > gateNonceStart &&
      gateNonceBlock.includes("receivedBytes.length === expectedBytes.length") &&
      gateNonceBlock.includes("crypto.timingSafeEqual(receivedBytes, expectedBytes)"),
    "Electron smoke gate must compare its private nonce exactly and timing-safely"
  );
  const gateTargetResolverStart = gateNonceEnd + 1;
  const gateTargetResolverEnd = main.indexOf(
    "\nfunction normalizeAutorunUserGestureGateReadyEvidence",
    gateTargetResolverStart
  );
  const gateTargetResolverBlock = main.slice(gateTargetResolverStart, gateTargetResolverEnd);
  assert.ok(
    gateTargetResolverBlock.includes('typeof action !== "string"') &&
      gateTargetResolverBlock.includes(
        "Object.prototype.hasOwnProperty.call(AUTORUN_USER_GESTURE_GATE_TARGETS, action)"
      ) &&
      gateTargetResolverBlock.includes("return AUTORUN_USER_GESTURE_GATE_TARGETS[action]"),
    "Electron smoke main process must derive targets from its own exact mapping"
  );
  const gateReadyStart = main.indexOf("function handleAutorunUserGestureGateReady");
  const gateReadyEnd = main.indexOf("\nfunction handleAutorunUserGestureGateConsume", gateReadyStart);
  const gateReadyBlock = main.slice(gateReadyStart, gateReadyEnd);
  assert.ok(
    gateReadyStart >= 0 &&
      gateReadyEnd > gateReadyStart &&
      gateReadyBlock.includes(
        "normalizeAutorunUserGestureGateReadyEvidence(payload.evidence, gate.targetId)"
      ) &&
      gateReadyBlock.includes("payload?.evidence?.button?.id === gate.targetId"),
    "Electron smoke ready gate must bind renderer evidence to the main-owned mapped target"
  );
  const gateNormalizeStart = gateTargetResolverEnd + 1;
  const gateNormalizeEnd = main.indexOf(
    "\nfunction isPointInsideAutorunUserGestureGateButton",
    gateNormalizeStart
  );
  const gateNormalizeBlock = main.slice(gateNormalizeStart, gateNormalizeEnd);
  assert.ok(
    gateNormalizeBlock.includes("evidence.button.id !== expectedTargetId") &&
      gateNormalizeBlock.includes("id: expectedTargetId"),
    "Electron smoke ready evidence normalizer must retain only the exact expected target"
  );
  const gateRejectStart = main.indexOf("function rejectAutorunUserGestureGate");
  const gateRejectEnd = main.indexOf("\nfunction recordAutorunUserGestureGateRejection", gateRejectStart);
  const gateRejectBlock = main.slice(gateRejectStart, gateRejectEnd);
  assert.ok(
    gateRejectStart >= 0 &&
      gateRejectEnd > gateRejectStart &&
      gateRejectBlock.includes('gate.state = "rejected"') &&
      gateRejectBlock.includes("gate.nonce = undefined"),
    "Electron smoke gate must destroy its nonce on a terminal rejection"
  );
  const readyEventStart = main.indexOf('recordEvent("autorun:user-gesture-gate-ready"');
  const readyEventEnd = main.indexOf("return sanitize({ accepted: true", readyEventStart);
  const consumedEventStart = main.indexOf('recordEvent("autorun:user-gesture-gate-consumed"');
  const consumedEventEnd = main.indexOf("const actionPromise =", consumedEventStart);
  assert.ok(
    readyEventStart >= 0 && readyEventEnd > readyEventStart && consumedEventStart >= 0 && consumedEventEnd > consumedEventStart,
    "Electron smoke gate must emit bounded ready and consumed evidence"
  );
  assert.doesNotMatch(
    main.slice(readyEventStart, readyEventEnd),
    /\bnonce\s*:/,
    "Electron smoke ready evidence must not expose its private nonce"
  );
  assert.doesNotMatch(
    main.slice(consumedEventStart, consumedEventEnd),
    /\bnonce\s*:/,
    "Electron smoke consumed evidence must not expose its private nonce"
  );
  assert.ok(
    main.includes("actionDelayMs: AUTORUN_USER_GESTURE_GATE ? 0 : AUTORUN_ACTION_DELAY_MS") &&
      main.includes("result = await armAutorunUserGestureGate(AUTORUN_ACTION)"),
    "Electron smoke autorun must bypass its ordinary action delay only for the opt-in gate"
  );
  const completionReadyStart = main.indexOf("function canCompleteAutorunUserGestureRun");
  const completionReadyEnd = main.indexOf(
    "\nfunction requestWindowsNativePresenterForegroundHandoff",
    completionReadyStart
  );
  assert.ok(
    completionReadyStart >= 0 && completionReadyEnd > completionReadyStart,
    "Electron smoke app must define one bounded user-gesture completion state gate"
  );
  const completionReadyBlock = main.slice(completionReadyStart, completionReadyEnd);
  for (const expected of [
    "AUTORUN_USER_GESTURE_GATE",
    "AUTORUN_KEEP_OPEN_AFTER_RESULT",
    "const expectedTargetId = getAutorunUserGestureGateTargetId(AUTORUN_ACTION)",
    "expectedTargetId",
    "AUTORUN_RESULT_FILE",
    "autorunUserGestureResultWritten",
    "autorunUserGestureGate?.action === AUTORUN_ACTION",
    "autorunUserGestureGate?.targetId === expectedTargetId",
    'autorunUserGestureGate?.state === "consumed"',
    "!autorunUserGestureCompletionQuitConsumed"
  ]) {
    assert.ok(
      completionReadyBlock.includes(expected),
      `Electron user-gesture completion gate missing ${expected}`
    );
  }
  assert.doesNotMatch(
    completionReadyBlock,
    /setTimeout|setInterval|setImmediate|\bdelay\s*\(/,
    "Electron user-gesture completion eligibility must be state driven"
  );
  const completionQuitStart = main.indexOf(
    'if (request.method === "POST" && requestUrl.pathname === "/quit")'
  );
  const completionQuitEnd = main.indexOf("\n  sendJsonResponse(response, 404", completionQuitStart);
  const completionQuitBlock = main.slice(completionQuitStart, completionQuitEnd);
  assert.ok(
    completionQuitStart >= 0 &&
      completionQuitEnd > completionQuitStart &&
      main.includes("isHandoffOnlySmokeControlRequestAllowed(request.method, requestUrl.pathname)") &&
      completionQuitBlock.includes("canCompleteAutorunUserGestureRun()") &&
      completionQuitBlock.includes("autorunUserGestureCompletionQuitConsumed = true") &&
      completionQuitBlock.includes("removeSmokeControlFile()") &&
      completionQuitBlock.includes('recordEvent("control:user-gesture-completion-quit"') &&
      completionQuitBlock.includes("app.quit()") &&
      !completionQuitBlock.includes("process.exit"),
    "Electron handoff-only completion must consume one state-gated capability before graceful quit"
  );
  const gateOwnerHandoffRouteStart = main.indexOf(
    'if (request.method === "POST" && requestUrl.pathname === "/foreground-handoff")'
  );
  const gateOwnerHandoffRouteEnd = main.indexOf(
    'if (request.method === "POST" && requestUrl.pathname === "/action")',
    gateOwnerHandoffRouteStart
  );
  const gateOwnerHandoffRoute = main.slice(
    gateOwnerHandoffRouteStart,
    gateOwnerHandoffRouteEnd
  );
  const gateOwnerHandoffInvocation =
    "requestWindowsNativePresenterForegroundHandoff(body.targetWindow, requestOrdinal)";
  assert.ok(
    gateOwnerHandoffRouteStart >= 0 &&
      gateOwnerHandoffRouteEnd > gateOwnerHandoffRouteStart &&
      gateOwnerHandoffRoute.includes("if (AUTORUN_USER_GESTURE_GATE)") &&
      gateOwnerHandoffRoute.includes("USER_GESTURE_GATE_FORBIDS_FOREGROUND_HANDOFF") &&
      gateOwnerHandoffRoute.indexOf("USER_GESTURE_GATE_FORBIDS_FOREGROUND_HANDOFF") <
        gateOwnerHandoffRoute.indexOf(gateOwnerHandoffInvocation),
    "Electron same-process gate must reject the legacy foreground-handoff route before native focus"
  );
  const autorunResultWriteStart = main.indexOf("const resultFileWritten = writeSmokeResultLine(line)");
  const autorunKeepOpenStart = main.indexOf("if (AUTORUN_KEEP_OPEN_AFTER_RESULT)", autorunResultWriteStart);
  assert.ok(
    autorunResultWriteStart >= 0 &&
      autorunKeepOpenStart > autorunResultWriteStart &&
      main.slice(autorunResultWriteStart, autorunKeepOpenStart).includes(
        "autorunUserGestureResultWritten = resultFileWritten"
      ),
    "Electron autorun must arm completion only after the configured result write returns"
  );

  for (const expected of [
    'ipcRenderer.on("steam-smoke:autorun-user-gesture-gate-arm"',
    "const targetId = getAutorunUserGestureGateTargetId(value?.action)",
    "!targetId",
    "typeof value.nonce !== \"string\"",
    "!/^[0-9a-f]{64}$/.test(value.nonce)",
    "targetId,",
    "document.getElementById(autorunUserGestureGate.targetId)",
    'button.addEventListener("click", consumeAutorunUserGestureGate, { capture: true, once: true })',
    "autorunUserGestureGateHandler({ action: autorunUserGestureGate.action })",
    'ipcRenderer\n    .invoke("steam-smoke:autorun-user-gesture-gate-ready"',
    "button.getBoundingClientRect()",
    "window.getComputedStyle(button)",
    "rectValues.every(Number.isFinite)",
    "viewportValues.every(Number.isFinite)",
    "document.elementFromPoint",
    "button.isConnected",
    "!button.disabled",
    "window.devicePixelRatio"
  ]) {
    const normalizedExpected = expected.replace(/\\n/g, "\n");
    assert.ok(
      preload.includes(normalizedExpected),
      `Electron smoke preload user-gesture contract missing ${normalizedExpected}`
    );
  }
  assert.doesNotMatch(
    preload,
    /autorunUserGestureGateHandler\(\{[^}]*nonce/s,
    "Electron smoke preload must keep the private nonce out of the renderer-facing arm event"
  );
  const preloadConsumeStart = preload.indexOf("function consumeAutorunUserGestureGate(event)");
  const preloadConsumeEnd = preload.indexOf(
    "\nfunction getAutorunUserGestureGateReadyEvidence",
    preloadConsumeStart
  );
  assert.ok(
    preloadConsumeStart >= 0 && preloadConsumeEnd > preloadConsumeStart,
    "Electron smoke preload must own a bounded isolated-world click consumer"
  );
  const preloadConsumeBlock = preload.slice(preloadConsumeStart, preloadConsumeEnd);
  for (const expected of [
    "gate.attempted",
    "event.currentTarget !== gate.button",
    "gate.attempted = true",
    "const nonce = gate.nonce",
    "gate.nonce = undefined",
    "event.isTrusted === true",
    "navigator.userActivation && navigator.userActivation.isActive === true",
    "button: event.button",
    "detail: event.detail",
    "clientX: event.clientX",
    "clientY: event.clientY",
    '.invoke("steam-smoke:autorun-user-gesture-gate-consume"',
    "nonce,"
  ]) {
    assert.ok(
      preloadConsumeBlock.includes(expected),
      `Electron smoke isolated click consumer missing ${expected}`
    );
  }
  assert.ok(
    preloadConsumeBlock.indexOf("gate.attempted = true") <
      preloadConsumeBlock.indexOf('.invoke("steam-smoke:autorun-user-gesture-gate-consume"'),
    "Electron smoke preload must latch the one-shot click before invoking consume IPC"
  );
  assert.doesNotMatch(
    preloadConsumeBlock,
    /\bawait\b|setTimeout|setInterval|setImmediate|requestAnimationFrame|\bdelay\s*\(/,
    "Electron smoke isolated click consumer must not defer gesture evidence through a later turn"
  );
  const exposedBridgeStart = preload.indexOf('contextBridge.exposeInMainWorld("steamSmoke"');
  const exposedBridge = preload.slice(exposedBridgeStart);
  assert.ok(
    exposedBridgeStart >= 0 &&
      exposedBridge.includes("onAutorunUserGestureGateArm") &&
      !exposedBridge.includes("reportAutorunUserGestureGateReady:") &&
      !exposedBridge.includes("consumeAutorunUserGestureGate:"),
    "Electron smoke main world must receive only the armed notification, not nonce-injecting gate methods"
  );

  const rendererClickStart = html.indexOf("presenterWebWaitButton.onclick = (event) => {");
  const rendererClickEnd = html.indexOf(
    "\n      const presenterDuplicateGuardButton",
    rendererClickStart
  );
  assert.ok(
    rendererClickStart >= 0 && rendererClickEnd > rendererClickStart,
    "Electron smoke renderer must define a bounded presenter click handler"
  );
  const rendererClickBlock = html.slice(rendererClickStart, rendererClickEnd);
  assert.ok(
    rendererClickBlock.includes(
      'if (autorunUserGestureGate?.action !== "presenter-web-open-and-wait")'
    ) &&
      rendererClickBlock.includes(
        'return run("Presenter Web Wait", () => window.steamSmoke.openPresenterWebOpenAndWait())'
      ) &&
      rendererClickBlock.includes("event.preventDefault()") &&
      !rendererClickBlock.includes("consumeAutorunUserGestureGate") &&
      !rendererClickBlock.includes("event.isTrusted") &&
      !rendererClickBlock.includes("navigator.userActivation"),
    "Electron smoke renderer must preserve the manual path and suppress it while isolated preload owns the gate"
  );
  const duplicateRendererClickStart = html.indexOf(
    "presenterDuplicateGuardButton.onclick = (event) => {"
  );
  const duplicateRendererClickEnd = html.indexOf(
    '\n      document.getElementById("presenter-store-wait")',
    duplicateRendererClickStart
  );
  const duplicateRendererClickBlock = html.slice(
    duplicateRendererClickStart,
    duplicateRendererClickEnd
  );
  assert.ok(
    duplicateRendererClickStart >= 0 &&
      duplicateRendererClickEnd > duplicateRendererClickStart &&
      duplicateRendererClickBlock.includes(
        'if (autorunUserGestureGate?.action !== "presenter-duplicate-open-guard")'
      ) &&
      duplicateRendererClickBlock.includes(
        'return run("Duplicate Guard", () => window.steamSmoke.openPresenterDuplicateOpenGuard())'
      ) &&
      duplicateRendererClickBlock.includes("event.preventDefault()") &&
      !duplicateRendererClickBlock.includes("consumeAutorunUserGestureGate") &&
      !duplicateRendererClickBlock.includes("event.isTrusted") &&
      !duplicateRendererClickBlock.includes("navigator.userActivation"),
    "Electron smoke renderer must preserve the duplicate manual path and suppress only its matching isolated gate"
  );
  assert.ok(
    html.includes("window.steamSmoke.onAutorunUserGestureGateArm((gate) => {") &&
      html.includes("autorunUserGestureGate = { action: gate.action };"),
    "Electron smoke renderer must receive only the sanitized armed action"
  );
}

function runElectronPreloadUserGestureGateSelfTest() {
  const preloadPath = path.join(repoRoot, "examples", "electron-basic", "preload.js");
  const source = fs.readFileSync(preloadPath, "utf8");
  const cases = [
    {
      action: "presenter-web-open-and-wait",
      targetId: "presenter-web-wait",
      otherAction: "presenter-duplicate-open-guard",
      otherTargetId: "presenter-duplicate-guard"
    },
    {
      action: "presenter-duplicate-open-guard",
      targetId: "presenter-duplicate-guard",
      otherAction: "presenter-web-open-and-wait",
      otherTargetId: "presenter-web-wait"
    },
    ...Object.entries(ALL_USER_GESTURE_ACTION_TARGETS)
      .filter(([, targetId]) => targetId === GENERIC_USER_GESTURE_GATE_TARGET)
      .map(([action, targetId]) => ({
        action,
        targetId,
        otherAction:
          action === "presenter-store-open-and-wait"
            ? "presenter-friends-open-and-wait"
            : "presenter-web-open-and-wait",
        otherTargetId:
          action === "presenter-store-open-and-wait"
            ? GENERIC_USER_GESTURE_GATE_TARGET
            : "presenter-web-wait"
      }))
  ];

  for (const gateCase of cases) {
    runPreloadGateCase(gateCase);
  }

  function runPreloadGateCase({ action, targetId, otherAction, otherTargetId }) {
    const sharedTargetRetarget = targetId === otherTargetId;
    const ipcListeners = new Map();
    const ipcInvocations = [];
    const buttonListeners = new Map();
    const buttonLookups = [];
    let exposedApi;
    const rect = {
      left: 100,
      top: 40,
      right: 220,
      bottom: 76,
      width: 120,
      height: 36
    };
    const createButton = (id) => ({
      id,
      hidden: id === GENERIC_USER_GESTURE_GATE_TARGET,
      isConnected: true,
      disabled: false,
      getBoundingClientRect: () => ({ ...rect }),
      contains: () => false,
      addEventListener(type, listener, options) {
        assert.equal(type, "click");
        buttonListeners.set(id, { listener, options });
      }
    });
    const buttons = new Map([
      [targetId, createButton(targetId)],
      [otherTargetId, createButton(otherTargetId)]
    ]);
    const electron = {
      contextBridge: {
        exposeInMainWorld(name, api) {
          assert.equal(name, "steamSmoke");
          exposedApi = api;
        }
      },
      ipcRenderer: {
        on(channel, listener) {
          ipcListeners.set(channel, listener);
        },
        invoke(channel, payload) {
          ipcInvocations.push({ channel, payload });
          return Promise.resolve({ accepted: true });
        }
      }
    };
    const sandbox = {
      require(specifier) {
        assert.equal(specifier, "electron");
        return electron;
      },
      document: {
        getElementById(id) {
          buttonLookups.push(id);
          return buttons.get(id) || null;
        },
        elementFromPoint: () => buttons.get(targetId)
      },
      navigator: { userActivation: { isActive: true } },
      window: {
        innerWidth: 1060,
        innerHeight: 760,
        devicePixelRatio: 2.25,
        getComputedStyle: () => ({
          display: "block",
          visibility: "visible",
          opacity: "1"
        })
      },
      console
    };
    vm.runInNewContext(source, sandbox, { filename: preloadPath });

    assert.ok(exposedApi, "Electron smoke preload did not expose its bridge API");
    assert.equal(
      Object.prototype.hasOwnProperty.call(exposedApi, "reportAutorunUserGestureGateReady"),
      false,
      "Electron smoke preload must not expose generic ready evidence injection"
    );
    assert.equal(
      Object.prototype.hasOwnProperty.call(exposedApi, "consumeAutorunUserGestureGate"),
      false,
      "Electron smoke preload must not expose generic user-gesture consumption"
    );

    const armListener = ipcListeners.get("steam-smoke:autorun-user-gesture-gate-arm");
    assert.equal(typeof armListener, "function", "Electron smoke preload did not register its private arm listener");
    const nonce = "a".repeat(64);
    if (targetId === GENERIC_USER_GESTURE_GATE_TARGET) {
      assert.equal(buttons.get(targetId).hidden, true);
    }
    for (const invalidAction of [
      action.toUpperCase(),
      `${action} `,
      "constructor",
      "__proto__",
      42,
      null,
      {}
    ]) {
      armListener({}, { action: invalidAction, nonce });
    }
    assert.equal(ipcInvocations.length, 0, "Invalid actions must not invoke gate IPC");
    assert.equal(buttonLookups.length, 0, "Invalid actions must not select a renderer target");

    armListener({}, { action, targetId: otherTargetId, nonce });
    assert.equal(ipcInvocations.length, 0, "Electron smoke preload must buffer arm until the page registers");

    let armNotice;
    exposedApi.onAutorunUserGestureGateArm((value) => {
      armNotice = value;
    });
    assert.deepEqual(Object.keys(armNotice), ["action"]);
    assert.equal(armNotice.action, action);
    assert.deepEqual(buttonLookups, [targetId]);
    if (targetId === GENERIC_USER_GESTURE_GATE_TARGET) {
      assert.equal(
        buttons.get(targetId).hidden,
        false,
        "Electron smoke preload must reveal the generic gate target before ready IPC"
      );
    }
    if (!sharedTargetRetarget) {
      assert.equal(buttonListeners.has(otherTargetId), false, "The other action button must remain untouched");
    }
    const { listener: clickListener, options: clickListenerOptions } = buttonListeners.get(targetId);
    assert.equal(clickListenerOptions.capture, true);
    assert.equal(clickListenerOptions.once, true);
    assert.equal(typeof clickListener, "function");

    const readyCalls = ipcInvocations.filter(
      (entry) => entry.channel === "steam-smoke:autorun-user-gesture-gate-ready"
    );
    assert.equal(readyCalls.length, 1);
    assert.equal(readyCalls[0].payload.action, action);
    assert.equal(readyCalls[0].payload.nonce, nonce);
    assert.equal(readyCalls[0].payload.evidence.button.id, targetId);
    assert.equal(readyCalls[0].payload.evidence.button.visible, true);
    assert.equal(readyCalls[0].payload.evidence.viewport.devicePixelRatio, 2.25);

    armListener({}, { action: otherAction, nonce: "b".repeat(64) });
    assert.equal(
      ipcInvocations.filter((entry) => entry.channel === "steam-smoke:autorun-user-gesture-gate-ready").length,
      1,
      "A second supported action must not retarget an armed gate"
    );
    if (!sharedTargetRetarget) {
      assert.equal(buttonListeners.has(otherTargetId), false);
    } else {
      assert.equal(
        buttonListeners.get(targetId).listener,
        clickListener,
        "A second generic action sharing the target must not replace the armed click listener"
      );
    }

    const click = {
      currentTarget: buttons.get(targetId),
      isTrusted: true,
      button: 0,
      detail: 1,
      clientX: 160,
      clientY: 58
    };
    if (!sharedTargetRetarget) {
      clickListener({ ...click, currentTarget: buttons.get(otherTargetId) });
      assert.equal(
        ipcInvocations.filter((entry) => entry.channel === "steam-smoke:autorun-user-gesture-gate-consume").length,
        0,
        "A click from the other action button must not consume the gate"
      );
    }
    clickListener(click);
    clickListener(click);
    const consumeCalls = ipcInvocations.filter(
      (entry) => entry.channel === "steam-smoke:autorun-user-gesture-gate-consume"
    );
    assert.equal(consumeCalls.length, 1, "Electron smoke preload must consume at most once");
    assert.equal(consumeCalls[0].payload.action, action);
    assert.equal(consumeCalls[0].payload.nonce, nonce);
    assert.equal(consumeCalls[0].payload.click.isTrusted, true);
    assert.equal(consumeCalls[0].payload.click.userActivationActive, true);
    assert.equal(consumeCalls[0].payload.click.button, 0);
    assert.equal(consumeCalls[0].payload.click.detail, 1);
    assert.equal(consumeCalls[0].payload.click.clientX, 160);
    assert.equal(consumeCalls[0].payload.click.clientY, 58);
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
  const initTxnCapture = path.join(installedPackageRoot, "bin", "init-client-txn.cjs");
  const macosPrepareApp = path.join(installedPackageRoot, "bin", "prepare-macos-app.cjs");
  const macosSigningVerifier = path.join(installedPackageRoot, "bin", "verify-macos-signing.cjs");
  const checkoutTargetValidator = path.join(installedPackageRoot, "bin", "validate-checkout-target.cjs");
  const macosLauncherTemplate = path.join(installedPackageRoot, "templates", "macos-steam-env-launcher.c");
  const macosEntitlementsTemplate = path.join(installedPackageRoot, "templates", "entitlements.steam.macos.plist");
  assertNonEmptyFile(initTxnCapture);
  assertNonEmptyFile(macosPrepareApp);
  assertNonEmptyFile(macosSigningVerifier);
  assertNonEmptyFile(checkoutTargetValidator);
  assertNonEmptyFile(macosLauncherTemplate);
  assertNonEmptyFile(macosEntitlementsTemplate);
  assertExecutableFile(initTxnCapture);
  assertExecutableFile(macosPrepareApp);
  assertExecutableFile(macosSigningVerifier);
  assertExecutableFile(checkoutTargetValidator);
  run("node", [initTxnCapture, "--self-test"], { cwd: consumerDir });
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
assert.equal(typeof steam.SteamOverlayMainThreadRequiredError, "function");
assert.equal(typeof steam.SteamOverlayNativeSurfaceOwnershipError, "function");
assert.equal(typeof steam.SteamOverlayElectronControllerOwnershipError, "function");
assert.equal(typeof steam.default.SteamOverlayNativeSurfaceOwnershipError, "function");
assert.equal(typeof steam.default.SteamOverlayElectronControllerOwnershipError, "function");
assert.equal(typeof steam.default.SteamOverlayMainThreadRequiredError, "function");
assert.equal(steam.SteamworksEnums.EResult.k_EResultOK, 1);
assert.equal(typeof electron.electronConfigureSteamOverlay, "function");
assert.equal(typeof electron.electronNativeOverlaySessionOptions, "function");
assert.equal(typeof electron.electronOverlayPresenterOptions, "function");
assert.equal(typeof electron.electronScrubSteamOverlayChildProcessEnv, "function");
assert.equal(electron.electronConfigureSteamOverlay({ profile: "off" }).profile, "off");
assert.equal(
  electron.electronConfigureSteamOverlay({ profile: "off", disableDirectComposition: true }).disableDirectComposition,
  false
);
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
  SteamOverlayElectronControllerOwnershipError,
  SteamOverlayMainThreadRequiredError,
  SteamOverlayNativeSurfaceOwnershipError,
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
assert.equal(typeof SteamOverlayNativeSurfaceOwnershipError, "function");
assert.equal(typeof SteamOverlayElectronControllerOwnershipError, "function");
assert.equal(SteamworksEnums.EResult.k_EResultOK, 1);
assert.equal(typeof electron.electronConfigureSteamOverlay, "function");
assert.equal(typeof electron.electronNativeOverlaySessionOptions, "function");
assert.equal(typeof electron.electronOverlayPresenterOptions, "function");
assert.equal(typeof electron.electronScrubSteamOverlayChildProcessEnv, "function");
assert.equal(electron.electronConfigureSteamOverlay({ profile: "off" }).profile, "off");
assert.equal(
  electron.electronConfigureSteamOverlay({ profile: "off", disableDirectComposition: true }).disableDirectComposition,
  false
);
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
  SteamOverlayElectronControllerOwnershipError,
  SteamOverlayMainThreadRequiredError,
  SteamOverlayNativeSurfaceOwnershipError,
  SteamworksEnums,
  type ElectronSteamOverlay,
  type ElectronSteamOverlayNativeHostAvailability,
  type ElectronSteamOverlaySnapshot,
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
const nativeOwnerErrorCode: string = new SteamOverlayNativeSurfaceOwnershipError("presenter", "session").code;
const controllerOwnerErrorCode: string = new SteamOverlayElectronControllerOwnershipError().code;
const mainThreadErrorCode: string = new SteamOverlayMainThreadRequiredError().code;
const legacyElectronOverlayMetadata: ElectronSteamOverlaySnapshot["electronOverlay"] = {
  presenterMode: "persistent",
  closeWithWindow: true,
  autoPrepareForNotifications: true,
  scrubSteamOverlayChildProcessEnv: true,
  scrubbedEnvKeys: [],
  restoreFocusDelayMs: 0,
  activationBoostMs: 0,
  activeGraceMs: 0,
  overlayShortcut: {
    enabled: false,
    preventDefault: true,
    targetType: "friends",
    target: null
  }
};
const config = electronConfigureSteamOverlay({ profile: "off", disableDirectComposition: true });
const configDisableDirectComposition: boolean = config.disableDirectComposition;
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
void configDisableDirectComposition;
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
