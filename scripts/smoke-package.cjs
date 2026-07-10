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

  run("node", [path.join(repoRoot, "scripts", "assert-electron-smoke-version.cjs")], { cwd: repoRoot });
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
  const matrixSummary = fs.readFileSync(path.join(repoRoot, "scripts", "summarize-windows-overlay-matrix.cjs"), "utf8");
  const nativeSurfaceSource = fs.readFileSync(
    path.join(repoRoot, "crates", "native", "src", "native_surface.rs"),
    "utf8"
  );
  const electronHelper = fs.readFileSync(path.join(repoRoot, "packages", "steam-bridge", "src", "electron.ts"), "utf8");
  const packageReadme = fs.readFileSync(path.join(repoRoot, "packages", "steam-bridge", "README.md"), "utf8");
  const exampleReadme = fs.readFileSync(path.join(repoRoot, "examples", "electron-basic", "README.md"), "utf8");
  const electronSmokeMain = fs.readFileSync(path.join(repoRoot, "examples", "electron-basic", "main.js"), "utf8");
  for (const expected of [
    '[ValidateSet("Limited", "Highest")]',
    '[string]$TaskRunLevel = "Limited"',
    'taskRunLevel: {0}',
    '$TaskRunLevel.ToUpperInvariant()'
  ]) {
    assert.ok(taskWrapper.includes(expected), `Windows overlay task wrapper missing ${expected}`);
  }
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
  assert.ok(
    matrixHelper.includes('$text -notlike "Steam launch options:*"') &&
      matrixHelper.includes('$text -notlike "Steam shortcut launch options:*"') &&
      matrixHelper.includes('$text -notlike "Launch URL:*"') &&
      matrixHelper.includes("Computed Windows shortcut launch options do not include the smoke env file."),
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
      presenterFocusBlock.includes('mechanism = "owner-process-native-show"') &&
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
  assert.ok(
    ownerHandoffRouteStart >= 0 &&
      ownerHandoffRouteEnd > ownerHandoffRouteStart &&
      ownerHandoffRoute.indexOf("nativePresenterForegroundHandoffConsumed = true") <
        ownerHandoffRoute.indexOf("requestWindowsNativePresenterForegroundHandoff(body.targetWindow)"),
    "Electron handoff route must consume its one-shot latch before invoking native focus"
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
    '$CloseProbeForegroundHandoff = "owner-process-native-show-v1"'
  ]) {
    assert.ok(
      helper.includes(expected) || matrixHelper.includes(expected),
      `Windows owner-process handoff packaging missing ${expected}`
    );
  }
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
      closeInputFocusGate.includes("`$sent = `$true") &&
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
      presenterPreDispatchGate.includes("`$sent = `$true") &&
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
    "AllowUnsigned"
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
    "ValidateSet(\"baseline\", \"managed\", \"managed-routes\", \"shortcut-routes\", \"checkout\", \"full\", \"preflight\", \"readiness\", \"shortcut\")",
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
    /-Id "11b-managed-duplicate-open-guard"[\s\S]*?-WebModal "true"/
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
    '-ManagedOverlayResultMode "complete"'
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
    "LOG_TAIL_BEGIN",
    "Private environment file was not found.",
    "Matrix arguments file must contain a JSON array or an object with matrixArgs.",
    "Private environment file contains an invalid environment variable name.",
    "Read-MatrixArgsFile",
    "Convert-MatrixArgsToSplat",
    "Split-MatrixArgumentNameValue",
    "Format-RedactedMatrixArgs",
    "HashSet[string]",
    "StringComparer]::OrdinalIgnoreCase",
    "HasInlineValue",
    "inlineValue",
    '"-InitTxnResponseFile"',
    '"-SteamUserId"',
    '"-WebUrl"',
    "matrixArgs",
    "matrixSplat",
    "REDACTED"
  ]) {
    assert.ok(taskWrapper.includes(expected), `Windows overlay task wrapper missing ${expected}`);
  }
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

function runPackagedWindowsOverlaySummarySelfTest() {
  const helperDir = path.join(tempRoot, "packaged-windows-overlay-summary");
  fs.mkdirSync(helperDir, { recursive: true });
  const summaryPath = path.join(helperDir, "summarize-windows-overlay-matrix.cjs");
  fs.copyFileSync(path.join(repoRoot, "scripts", "summarize-windows-overlay-matrix.cjs"), summaryPath);
  fs.copyFileSync(
    path.join(repoRoot, "examples", "electron-basic", "checkout-proof.cjs"),
    path.join(helperDir, "checkout-proof.cjs")
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
