#!/usr/bin/env node

const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const RESULT_PREFIX = "STEAM_BRIDGE_SMOKE_RESULT ";
const OPEN_AND_WAIT_ACTIONS = new Set([
  "presenter-web-open-and-wait",
  "presenter-duplicate-open-guard",
  "presenter-store-open-and-wait",
  "presenter-dialog-auto-open-and-wait",
  "presenter-friends-open-and-wait",
  "presenter-profile-open-and-wait",
  "presenter-players-open-and-wait",
  "presenter-community-open-and-wait",
  "presenter-stats-open-and-wait",
  "presenter-achievements-open-and-wait",
  "presenter-user-open-and-wait",
  "presenter-shortcut-open-and-wait"
]);
const READINESS_ACTIONS = new Set(["presenter-ready"]);
const PASSIVE_NOTIFICATION_ACTIONS = new Map([
  [
    "presenter-achievement-progress",
    {
      event: "achievement:progress",
      callbacks: ["callback:achievement-stored"]
    }
  ],
  [
    "presenter-achievement-unlock",
    {
      event: "achievement:unlock",
      callbacks: ["callback:user-stats-stored", "callback:achievement-stored"]
    }
  ]
]);
const REDACTED_COMMAND_VALUE = "<redacted>";
const DIRECT_MACOS_CRASH_REPORT_NAME = /^SteamBridgeSmoke(?:\.electron| Helper(?: \(Renderer\))?)?-.*\.ips$/;
const ATTRIBUTED_MACOS_CRASH_REPORT_NAME = /^MTLCompilerService-.*\.ips$/;
const STEAM_BRIDGE_RESPONSIBLE_CRASH_REPORT = /SteamBridgeSmoke(?:\.electron| Helper(?: \(Renderer\))?)?/;
const SENSITIVE_MANIFEST_OPTIONS = new Set([
  "--checkout-json-file",
  "--checkout-return-url",
  "--checkout-transaction-id",
  "--checkout-url"
]);
const SENSITIVE_ARTIFACT_KEY_NAMES = new Set([
  "accountid",
  "authticket",
  "checkoutjsonfile",
  "checkouturl",
  "orderid",
  "returnurl",
  "steamid",
  "steamid32",
  "steamid64",
  "steamurl",
  "transactionid",
  "transid",
  "txnid",
  "url",
  "userid"
]);
const SENSITIVE_ARTIFACT_KEY_PARTS = ["authticket", "checkouturl", "returnurl", "steamurl", "ticketbase64"];
const SENSITIVE_ARTIFACT_ARG_PREFIXES = [
  "--steam-bridge-smoke-checkout-url",
  "--steam-bridge-smoke-checkout-return-url",
  "--steam-bridge-smoke-checkout-transaction-id",
  "--steam-bridge-smoke-checkout-json-file"
];
const CHECKOUT_APPROVAL_URL_PATTERN = /https?:\/\/checkout\.steampowered\.com\/checkout\/approvetxn\/[^/\s"'<>]+/i;
const STEAM_ID64_PATTERN = /\b7656119\d{10}\b/;
const EXPECTED_STEAM_OVERLAY_SCRUBBED_ENV_KEYS = new Set(["LD_PRELOAD", "DYLD_INSERT_LIBRARIES"]);
const MINIMAL_SUITE_REQUIRED_CASE_IDS = [
  "00-presenter-ready",
  "01-web-openwait",
  "01b-duplicate-open-guard",
  "02-store-openwait",
  "03-friends-openwait",
  "04-dialog-official-openwait",
  "05-passive-toast"
];
const CORE_SUITE_REQUIRED_CASE_IDS = [
  ...MINIMAL_SUITE_REQUIRED_CASE_IDS,
  "06-passive-unlock-toast",
  "07-checkout-approval",
  "07b-checkout-prepare",
  "08-shortcut-friends",
  "09-shortcut-web",
  "10-shortcut-store",
  "11-shortcut-checkout",
  "12-shortcut-profile",
  "13-shortcut-players",
  "14-shortcut-community",
  "15-shortcut-stats",
  "16-shortcut-achievements",
  "17-shortcut-user-chat",
  "18-shortcut-dialog",
  "19-profile",
  "20-players",
  "21-community",
  "22-stats",
  "23-achievements",
  "24-user-chat"
];
const FULL_SUITE_REQUIRED_CASE_IDS = [
  ...CORE_SUITE_REQUIRED_CASE_IDS,
  "25-user-steamid",
  "26-dialog-Friends",
  "27-dialog-Players",
  "28-dialog-Community",
  "29-dialog-OfficialGameGroup",
  "30-dialog-Stats",
  "31-dialog-Achievements",
  "32-shortcut-friends-openwait",
  "33-shortcut-web-openwait",
  "34-shortcut-store-openwait",
  "35-shortcut-checkout-openwait",
  "36-shortcut-profile-openwait",
  "37-shortcut-players-openwait",
  "38-shortcut-community-openwait",
  "39-shortcut-stats-openwait",
  "40-shortcut-achievements-openwait",
  "41-shortcut-user-chat-openwait",
  "42-shortcut-dialog-openwait"
];
const PERSISTENT_SUITE_REQUIRED_CASE_IDS = [
  "00-persistent-presenter-ready",
  "01-persistent-web-openwait",
  "01b-persistent-duplicate-open-guard",
  "02-persistent-store-openwait",
  "03-persistent-friends-openwait",
  "04-persistent-dialog-official-openwait",
  "05-persistent-passive-toast",
  "06-persistent-passive-unlock-toast",
  "07-persistent-checkout-approval",
  "07b-persistent-checkout-prepare",
  "08-persistent-shortcut-friends",
  "09-persistent-shortcut-web",
  "10-persistent-shortcut-store",
  "11-persistent-shortcut-checkout",
  "12-persistent-shortcut-profile",
  "13-persistent-shortcut-players",
  "14-persistent-shortcut-community",
  "15-persistent-shortcut-stats",
  "16-persistent-shortcut-achievements",
  "17-persistent-shortcut-user-chat",
  "18-persistent-shortcut-dialog",
  "19-persistent-shortcut-web-openwait",
  "20-persistent-profile",
  "21-persistent-players",
  "22-persistent-community",
  "23-persistent-stats",
  "24-persistent-achievements",
  "25-persistent-user-chat",
  "26-persistent-user-steamid",
  "27-persistent-dialog-Friends",
  "28-persistent-dialog-Players",
  "29-persistent-dialog-Community",
  "30-persistent-dialog-OfficialGameGroup",
  "31-persistent-dialog-Stats",
  "32-persistent-dialog-Achievements",
  "33-persistent-shortcut-friends-openwait",
  "34-persistent-shortcut-store-openwait",
  "35-persistent-shortcut-checkout-openwait",
  "36-persistent-shortcut-profile-openwait",
  "37-persistent-shortcut-players-openwait",
  "38-persistent-shortcut-community-openwait",
  "39-persistent-shortcut-stats-openwait",
  "40-persistent-shortcut-achievements-openwait",
  "41-persistent-shortcut-user-chat-openwait",
  "42-persistent-shortcut-dialog-openwait"
];
const CHECKOUT_SUITE_REQUIRED_CASE_IDS = [
  "01-checkout-prepare",
  "02-checkout-approval",
  "03-shortcut-checkout",
  "04-shortcut-checkout-openwait"
];
const UNAVAILABLE_SUITE_REQUIRED_CASE_IDS = [
  "00-unavailable-presenter-ready",
  "01-unavailable-web-openwait",
  "02-unavailable-checkout",
  "03-unavailable-checkout-prepare",
  "04-unavailable-shortcut-openwait",
  "05-unavailable-passive-toast"
];
const NAMED_OPEN_STATUS_TARGET_TYPES = new Map([
  ["web", "web"],
  ["store", "store"],
  ["friends", "friends"],
  ["profile", "profile"],
  ["players", "players"],
  ["community", "community"],
  ["stats", "stats"],
  ["achievements", "achievements"],
  ["user", "user"],
  ["dialog", "dialog"],
  ["checkout", "checkout"]
]);
const DUPLICATE_OPEN_NAMED_TARGET_NAMES = [...NAMED_OPEN_STATUS_TARGET_TYPES.keys()];
const DUPLICATE_OPEN_NAMED_STATUS_NAMES = [...DUPLICATE_OPEN_NAMED_TARGET_NAMES, "checkoutOperation"];
const REQUIRED_SUITE_CASE_IDS = new Map([
  ["minimal", MINIMAL_SUITE_REQUIRED_CASE_IDS],
  ["core", CORE_SUITE_REQUIRED_CASE_IDS],
  ["full", FULL_SUITE_REQUIRED_CASE_IDS],
  ["persistent", PERSISTENT_SUITE_REQUIRED_CASE_IDS],
  ["checkout", CHECKOUT_SUITE_REQUIRED_CASE_IDS],
  ["unavailable", UNAVAILABLE_SUITE_REQUIRED_CASE_IDS]
]);

main();

function main() {
  let options;
  try {
    options = parseArgs(process.argv.slice(2));
  } catch (error) {
    console.error(error.message);
    printUsage(process.stderr);
    process.exit(2);
  }

  if (options.help) {
    printUsage(process.stdout);
    return;
  }

  if (options.selfTest) {
    runSelfTest();
    return;
  }

  if (!options.artifactRoot) {
    printUsage(process.stderr);
    process.exit(2);
  }

  summarizeMatrixArtifacts(options.artifactRoot);
}

function parseArgs(args) {
  const options = { artifactRoot: "" };
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    switch (arg) {
      case "--help":
      case "-h":
        options.help = true;
        break;
      case "--self-test":
        options.selfTest = true;
        break;
      case "--artifact-root":
        index += 1;
        if (!args[index]) {
          throw new Error("missing --artifact-root value");
        }
        options.artifactRoot = args[index];
        break;
      default:
        if (arg.startsWith("-")) {
          throw new Error(`unknown option: ${arg}`);
        }
        if (options.artifactRoot) {
          throw new Error(`unexpected argument: ${arg}`);
        }
        options.artifactRoot = arg;
        break;
    }
  }
  return options;
}

function printUsage(stream) {
  stream.write(`Usage:
  summarize-macos-overlay-matrix.cjs --artifact-root PATH
  summarize-macos-overlay-matrix.cjs --self-test

Audits a macOS overlay matrix artifact root for collected smoke results,
lifecycle close/park evidence, Steam overlay injection, managed Electron
zero-timing diagnostics, interactive macOS host state, passive notification
callbacks, and crash diagnostics.
`);
}

function summarizeMatrixArtifacts(root) {
  const failures = [];
  const summaries = [];
  const manifestPath = path.join(root, "macos-matrix-cases.jsonl");
  const manifest = readCaseManifest(manifestPath, failures);

  if (!fs.existsSync(root)) {
    failures.push(`missing artifact root: ${root}`);
  }
  if (!manifest.found) {
    failures.push(`missing macOS matrix manifest: ${manifestPath}`);
  }
  if (manifest.byCase.size === 0) {
    failures.push("macOS matrix manifest has no cases");
  }

  const cases = [...manifest.byCase.values()];
  const diagnosticDirCounts = countBy(cases, (metadata) => metadata.diagnosticDir || "");
  const diagnosticDirOrdinals = new Map();

  for (const metadata of cases) {
    const caseFailures = [];
    const caseId = metadata.caseId;
    const resultFile = metadata.resultFile;
    const diagnosticDir = metadata.diagnosticDir;

    if (!resultFile || typeof resultFile !== "string") {
      failures.push(`${caseId}: missing resultFile in manifest`);
      continue;
    }
    if (!diagnosticDir || typeof diagnosticDir !== "string") {
      failures.push(`${caseId}: missing diagnosticDir in manifest`);
      continue;
    }
    if (!fs.existsSync(resultFile)) {
      failures.push(`${caseId}: missing result log: ${resultFile}`);
      continue;
    }
    if (!fs.existsSync(diagnosticDir)) {
      failures.push(`${caseId}: missing diagnostic dir: ${diagnosticDir}`);
      continue;
    }

    let result;
    try {
      result = readSmokeResult(resultFile);
    } catch (error) {
      failures.push(`${caseId}: ${error.message}`);
      continue;
    }

    const lifecycle = readLifecycle(path.join(diagnosticDir, "lifecycle.jsonl"));
    const macosCrashReports = readMacosCrashReports(diagnosticDir);
    const diagnosticDirOrdinal = diagnosticDirOrdinals.get(diagnosticDir) || 0;
    diagnosticDirOrdinals.set(diagnosticDir, diagnosticDirOrdinal + 1);
    const scopedLifecycle = scopeLifecycleForCase(metadata, lifecycle, {
      shared: (diagnosticDirCounts.get(diagnosticDir) || 0) > 1,
      ordinal: diagnosticDirOrdinal
    });
    auditCaseArtifactRedaction(caseId, "result", result, caseFailures);
    auditCaseArtifactRedaction(caseId, "lifecycle", scopedLifecycle.entries, caseFailures);
    const summary = verifyCase(caseId, metadata, result, scopedLifecycle, macosCrashReports, caseFailures);
    summaries.push(summary);

    if (caseFailures.length > 0) {
      failures.push(...caseFailures);
    }
  }
  verifySuiteCoverage(cases, failures);

  for (const summary of summaries) {
    console.log(
      [
        "MACOS_CASE",
        summary.caseId,
        `appId=${summary.expectedAppId}`,
        `action=${summary.action}`,
        `activated=${summary.activated}`,
        `closed=${summary.closed}`,
        `parked=${summary.parked}`,
        `idleStable=${summary.idleStable}`,
        `passive=${summary.passive}`,
        `overlayTargets=${summary.overlayTargets}`,
        `overlayGameIds=${summary.overlayGameIds.join(",") || "none"}`,
        `backend=${summary.nativeHostBackend}`,
        `macInteractive=${summary.macInteractive}`,
        `managedIsolation=${summary.managedIsolation}`,
        `zeroTiming=${summary.zeroTiming}`,
        `shown=${summary.shown}`,
        `webVisible=${summary.webVisible}`,
        `openStatuses=${summary.openStatuses}`,
        `checkoutOperation=${summary.checkoutOperation}`,
        `managedWaits=${summary.managedWaits}`,
        `openAndWait=${summary.openAndWait}`,
        `checkoutWait=${summary.checkoutWait}`,
        `checkoutPrepared=${summary.checkoutPrepared}`,
        `checkoutSource=${summary.checkoutSource}`,
        `microTxnCallback=${summary.microTxnCallback}`,
        `nativeHostUnavailable=${summary.nativeHostUnavailable}`,
        `noOverlayActivation=${summary.noOverlayActivation}`,
        `crashOk=${summary.crashOk}`
      ].join(" ")
    );
  }

  if (failures.length > 0) {
    console.error("macOS overlay matrix summary failed:");
    for (const failure of failures) {
      console.error(`  - ${failure}`);
    }
    process.exit(1);
  }

  console.log(`macOS overlay matrix summary passed: cases=${summaries.length}`);
  return { caseSummaries: summaries };
}

function verifySuiteCoverage(cases, failures) {
  const suiteValues = cases.map((metadata) => nonEmptyString(metadata.suite));
  const taggedSuiteValues = suiteValues.filter(Boolean);
  if (taggedSuiteValues.length > 0 && taggedSuiteValues.length !== cases.length) {
    failures.push("macOS matrix manifest has partial suite metadata");
    return;
  }

  const suites = new Set(taggedSuiteValues);
  if (suites.size === 0) {
    return;
  }
  if (suites.size > 1) {
    failures.push(`macOS matrix manifest mixes suite metadata: ${[...suites].sort().join(", ")}`);
    return;
  }

  const suite = [...suites][0];
  const requiredCaseIds = REQUIRED_SUITE_CASE_IDS.get(suite);
  if (!requiredCaseIds) {
    return;
  }

  const presentCaseIds = new Set(cases.map((metadata) => metadata.caseId));
  for (const caseId of requiredCaseIds) {
    if (!presentCaseIds.has(caseId)) {
      failures.push(`${suite} macOS matrix missing required case ${caseId}`);
    }
  }
}

function verifyCase(caseId, metadata, result, lifecycle, macosCrashReports, failures) {
  const snapshot = objectOrEmpty(result.snapshot);
  const app = objectOrEmpty(snapshot.app);
  const processInfo = objectOrEmpty(snapshot.process);
  const launch = objectOrEmpty(snapshot.launch);
  const steam = objectOrEmpty(snapshot.steam);
  const crashDiagnostics = objectOrEmpty(snapshot.crashDiagnostics);
  const overlayProcesses = objectOrEmpty(snapshot.overlayProcesses);
  const overlay = objectOrEmpty(snapshot.overlay);
  const action = objectOrEmpty(result.action);
  const actionName = String(action.action || "unknown");
  const nativePresenter = readOkValue(overlay.nativePresenter);
  const nativeHostAvailability = readOkValue(overlay.nativeHostAvailability);
  const electronOverlay = readElectronOverlay(nativePresenter);
  const expectedAppId = expectedAppIdFromMetadata(metadata);
  const expectedAppIdText = String(expectedAppId);
  const expectedCheckoutSource = nonEmptyString(metadata.checkoutSource);
  const manifestCheckoutSource = checkoutSourceFromMetadata(metadata);
  const summaryCheckoutSource =
    manifestCheckoutSource || (expectedCheckoutSource ? expectedCheckoutSource : "");
  const resultEvents = scopeResultEventsForCase(Array.isArray(snapshot.events) ? snapshot.events : [], actionName);
  const lifecycleEntries = lifecycle.entries;
  const overlayTargets = countOverlayTargets(overlayProcesses);
  const overlayGameIds = collectOverlayGameIds(overlayProcesses);
  const passiveConfig = PASSIVE_NOTIFICATION_ACTIONS.get(actionName);
  const isPassive = Boolean(passiveConfig);
  const isReadinessPreflight = READINESS_ACTIONS.has(actionName);
  const expectedActionError = expectedActionErrorFromMetadata(metadata);
  const hasExpectedActionError = Boolean(expectedActionError.code || expectedActionError.reason);
  const expectedNativeHostUnavailableActionError =
    expectedActionError.code === "STEAM_OVERLAY_NATIVE_HOST_UNAVAILABLE";
  const checkoutPrepareOnly = actionName === "presenter-checkout" && !summaryCheckoutSource && !hasExpectedActionError;
  const expectedNativeHostUnavailableReason = nonEmptyString(
    metadata.requireNativeHostUnavailableReason ?? metadata.expectedNativeHostUnavailableReason
  );
  const requireVisibleWebOverlay =
    metadata.closeInput === "web" && !hasExpectedActionError && !expectedNativeHostUnavailableReason;
  const expectedNativeHostBackend = expectedNativeHostBackendFromMetadata(metadata);
  const expectedNoOverlayActivation =
    metadata.requireNoOverlayActivation === true ||
    metadata.expectedNoOverlayActivation === true ||
    Boolean(expectedNativeHostUnavailableReason);
  const requireMicroTxnCallback =
    metadata.requireMicroTxnCallback === true || metadata.expectedMicroTxnCallback === true;
  const requireMacosNeedsPresentPollingDisabled =
    metadata.requireMacosNeedsPresentPollingDisabled === true ||
    metadata.expectedMacosNeedsPresentPollingDisabled === true;
  const activated = lifecycleEntries.some(isLifecycleOverlayActiveEvent);
  const closed = hasInactiveAfterActive(lifecycleEntries);
  const readiness = hasExpectedActionError
    ? { required: false, ok: true, parked: false }
    : verifyPresenterReadiness(caseId, actionName, resultEvents, lifecycleEntries, nativePresenter, nativeHostAvailability, {
        expectedNativeHostUnavailableReason,
        failures
      });
  const parking = hasExpectedActionError || checkoutPrepareOnly || isReadinessPreflight
    ? { required: false, ok: false, idleStable: "n/a" }
    : verifyLifecycleParking(caseId, lifecycleEntries, isPassive, failures);
  const zeroTiming = Boolean(
    electronOverlay &&
      electronOverlay.restoreFocusDelayMs === 0 &&
      electronOverlay.activationBoostMs === 0 &&
      electronOverlay.activeGraceMs === 0
  );
  const managedIsolation = managedOverlayIsolationOk(electronOverlay);
  const crashOk =
    crashDiagnostics.available === true &&
    crashDiagnostics.ok === true &&
    macosCrashReports.errors.length === 0 &&
    macosCrashReports.reports.length === 0;
  const openAndWait = hasExpectedActionError
    ? { required: false, ok: true }
    : verifyOpenAndWaitCompletion(caseId, actionName, lifecycleEntries, failures);
  const checkoutWait = hasExpectedActionError
    ? { required: false, ok: true }
    : verifyCheckoutOpenAndWait(caseId, actionName, lifecycleEntries, expectedCheckoutSource, failures);
  const checkoutPrepared = hasExpectedActionError
    ? { required: false, ok: true, parked: false }
    : verifyCheckoutPrepared(caseId, actionName, lifecycleEntries, nativePresenter, {
        required: checkoutPrepareOnly,
        failures
      });
  const microTxnCallback = hasExpectedActionError
    ? { required: false, ok: true }
    : verifyMicroTxnCallbackPresenterSnapshots(caseId, lifecycleEntries, failures, {
        required: requireMicroTxnCallback
      });
  const managedWaits = hasExpectedActionError
    ? { required: false, ok: true }
    : verifyManagedLifecycleWaits(caseId, actionName, lifecycleEntries, isPassive, failures);
  const duplicateOpenGuard = hasExpectedActionError
    ? { required: false, ok: true }
    : verifyDuplicateOpenGuard(caseId, actionName, resultEvents, lifecycleEntries, failures);
  const openStatuses = verifyNamedOpenStatusSnapshots(caseId, metadata, overlay, failures);
  const webVisible = requireVisibleWebOverlay
    ? verifyWebOverlayVisibleBeforeClose(caseId, lifecycleEntries, failures)
    : { required: false, ok: true };
  let macInteractive = false;

  if (hasExpectedActionError) {
    expect(result.ok === false, `${caseId}: smoke result failed with expected action error`, failures);
    expect(action.ok === false, `${caseId}: autorun action failed with expected error`, failures);
    verifyExpectedActionError(caseId, action, expectedActionError, failures);
  } else {
    expect(result.ok === true, `${caseId}: smoke result ok`, failures);
    expect(action.ok === true, `${caseId}: autorun action succeeded`, failures);
  }
  if (metadata.action) {
    expect(
      metadata.action === actionName,
      `${caseId}: manifest action expected ${formatValue(actionName)}, got ${formatValue(metadata.action)}`,
      failures
    );
  }
  expect(app.appId === expectedAppId, `${caseId}: app ID is ${expectedAppId}`, failures);
  expect(processInfo.platform === "darwin", `${caseId}: platform is darwin`, failures);
  expect(processInfo.arch === "arm64", `${caseId}: arch is arm64`, failures);
  expect(launch.steamLaunch === true, `${caseId}: Steam launch detected`, failures);
  expect(launch.overlayInjection === true, `${caseId}: Steam overlay injection detected`, failures);
  const env = objectOrEmpty(launch.env);
  expect(env.SteamAppId === expectedAppIdText, `${caseId}: SteamAppId env is ${expectedAppId}`, failures);
  expect(env.SteamGameId === expectedAppIdText, `${caseId}: SteamGameId env is ${expectedAppId}`, failures);
  expect(env.SteamOverlayGameId === expectedAppIdText, `${caseId}: SteamOverlayGameId env is ${expectedAppId}`, failures);
  expect(steam.initialized === true, `${caseId}: Steam initialized`, failures);
  expect(readOkValue(steam.running) === true, `${caseId}: Steam running`, failures);
  expect(Number(readOkValue(steam.appId)) === expectedAppId, `${caseId}: Steam app ID is ${expectedAppId}`, failures);
  expect(readOkValue(steam.steamDeck) === false, `${caseId}: Steam Deck flag is false on macOS`, failures);
  expect(readOkValue(steam.bigPicture) === false, `${caseId}: Big Picture flag is false on macOS`, failures);
  const preOpenShortcutAction = actionName === "presenter-shortcut";
  const preActivationAction = preOpenShortcutAction || isReadinessPreflight;
  if (!expectedNativeHostUnavailableReason && !preActivationAction) {
    expect(readOkValue(steam.overlayEnabled) === true, `${caseId}: Steam overlay enabled`, failures);
  }
  if (requireMacosNeedsPresentPollingDisabled) {
    verifyRequiredMacosNeedsPresentPollingDisabled(caseId, steam, nativePresenter, failures);
  }
  expect(crashOk, `${caseId}: crash diagnostics are available and ok`, failures);
  expect(arrayLength(crashDiagnostics.crashDumps) === 0, `${caseId}: no crash dumps reported`, failures);
  expect(
    arrayLength(crashDiagnostics.fatalLifecycleEvents) === 0,
    `${caseId}: no fatal lifecycle events reported`,
    failures
  );
  for (const error of macosCrashReports.errors) {
    failures.push(`${caseId}: ${error}`);
  }
  for (const report of macosCrashReports.reports) {
    failures.push(`${caseId}: macOS crash report found: ${report.relativePath}${report.summary ? ` ${report.summary}` : ""}`);
  }
  expect(lifecycle.found === true, `${caseId}: lifecycle log present`, failures);
  for (const error of lifecycle.errors) {
    failures.push(`${caseId}: ${error}`);
  }
  if (lifecycle.rawText.includes("Object has been destroyed")) {
    failures.push(`${caseId}: lifecycle log contains Object has been destroyed`);
  }

  expect(Boolean(nativePresenter), `${caseId}: native presenter snapshot available`, failures);
  if (nativePresenter) {
    expect(nativePresenter.backend === "macos-metal" || nativePresenter.backend === "macos-opengl", `${caseId}: macOS native presenter backend`, failures);
    if (expectedNativeHostBackend) {
      expect(
        nativePresenter.backend === expectedNativeHostBackend,
        `${caseId}: native presenter backend expected ${formatValue(expectedNativeHostBackend)}, got ${formatValue(nativePresenter.backend)}`,
        failures
      );
    }
    expect(nativePresenter.idleFps === 0, `${caseId}: native presenter idle FPS is zero`, failures);
    if (expectedNativeHostUnavailableReason) {
      verifyNativeHostUnavailablePresenter(caseId, nativePresenter, expectedNativeHostUnavailableReason, failures);
      verifyNativeHostUnavailableAvailability(
        caseId,
        nativeHostAvailability,
        expectedNativeHostUnavailableReason,
        failures
      );
    } else {
      expect(nativePresenter.attached === true, `${caseId}: native presenter attached`, failures);
      expect(nativePresenter.nativeHostOpen === true, `${caseId}: native presenter host open`, failures);
      macInteractive = expectMacOverlayEnvironmentAvailable(caseId, nativePresenter, "native presenter snapshot", failures);
    }
    expect(Boolean(electronOverlay), `${caseId}: managed Electron overlay diagnostics available`, failures);
  }
  if (electronOverlay) {
    expect(electronOverlay.presenterMode === "persistent", `${caseId}: presenter mode is persistent`, failures);
    expect(electronOverlay.autoPrepareForNotifications === true, `${caseId}: automatic notification priming enabled`, failures);
    expect(
      electronOverlay.scrubSteamOverlayChildProcessEnv === true,
      `${caseId}: managed Electron child process preload scrub enabled`,
      failures
    );
    expect(
      Array.isArray(electronOverlay.scrubbedEnvKeys),
      `${caseId}: managed Electron scrubbed env key diagnostics available`,
      failures
    );
    if (Array.isArray(electronOverlay.scrubbedEnvKeys)) {
      for (const key of electronOverlay.scrubbedEnvKeys) {
        expect(
          EXPECTED_STEAM_OVERLAY_SCRUBBED_ENV_KEYS.has(key),
          `${caseId}: managed Electron scrubbed env key is expected: ${formatValue(key)}`,
          failures
        );
      }
    }
    expect(electronOverlay.restoreFocusDelayMs === 0, `${caseId}: restore focus delay is zero`, failures);
    expect(electronOverlay.activationBoostMs === 0, `${caseId}: activation boost is zero`, failures);
    expect(electronOverlay.activeGraceMs === 0, `${caseId}: active grace is zero`, failures);
  }

  expect(overlayProcesses.available === true, `${caseId}: overlay process diagnostics available`, failures);
  expect(overlayProcesses.platform === "darwin", `${caseId}: overlay process platform is darwin`, failures);
  if (isReadinessPreflight && !expectedNativeHostUnavailableReason) {
    expect(overlayTargets <= 1, `${caseId}: zero or one dormant gameoverlayui target during readiness preflight`, failures);
    for (const target of Array.isArray(overlayProcesses.gameoverlayui) ? overlayProcesses.gameoverlayui : []) {
      expect(target.gameId != null, `${caseId}: gameoverlayui game ID is recorded`, failures);
      expect(String(target.gameId) === expectedAppIdText, `${caseId}: gameoverlayui game ID is ${expectedAppId}`, failures);
      expect(Number(target.targetPid) === Number(processInfo.pid), `${caseId}: gameoverlayui targets the smoke process`, failures);
    }
  } else if (expectedNoOverlayActivation && !checkoutPrepareOnly) {
    expect(overlayTargets === 0, `${caseId}: no gameoverlayui target while overlay activation is expected to be skipped`, failures);
  } else if (checkoutPrepareOnly) {
    expect(overlayTargets <= 1, `${caseId}: zero or one gameoverlayui target while checkout is only prepared`, failures);
    for (const target of Array.isArray(overlayProcesses.gameoverlayui) ? overlayProcesses.gameoverlayui : []) {
      expect(target.gameId != null, `${caseId}: gameoverlayui game ID is recorded`, failures);
      expect(String(target.gameId) === expectedAppIdText, `${caseId}: gameoverlayui game ID is ${expectedAppId}`, failures);
      expect(Number(target.targetPid) === Number(processInfo.pid), `${caseId}: gameoverlayui targets the smoke process`, failures);
    }
  } else {
    expect(overlayTargets === 1, `${caseId}: exactly one gameoverlayui target process/game ID`, failures);
    const requirePublicOverlayGameId = !isStoreOverlayAction(actionName);
    for (const target of Array.isArray(overlayProcesses.gameoverlayui) ? overlayProcesses.gameoverlayui : []) {
      expect(target.gameId != null, `${caseId}: gameoverlayui game ID is recorded`, failures);
      if (requirePublicOverlayGameId) {
        expect(String(target.gameId) === expectedAppIdText, `${caseId}: gameoverlayui game ID is ${expectedAppId}`, failures);
      }
      expect(Number(target.targetPid) === Number(processInfo.pid), `${caseId}: gameoverlayui targets the smoke process`, failures);
      if (requirePublicOverlayGameId && typeof target.command === "string" && target.command.length > 0) {
        expect(
          new RegExp(`\\s-gameid\\s+${escapeRegExp(expectedAppIdText)}(?:\\s|$)`).test(target.command),
          `${caseId}: gameoverlayui command line uses -gameid ${expectedAppId}`,
          failures
        );
      }
    }
  }

  if (hasExpectedActionError) {
    if (expectedNoOverlayActivation) {
      verifyNoOverlayActivation(caseId, resultEvents, lifecycleEntries, failures);
    }
  } else if (isPassive) {
    verifyPassiveNotification(caseId, resultEvents, lifecycleEntries, nativePresenter, passiveConfig, failures, {
      expectedNativeHostUnavailableReason
    });
  } else if (checkoutPrepareOnly) {
    verifyNoOverlayActivation(caseId, resultEvents, lifecycleEntries, failures);
    expect(checkoutPrepared.ok, `${caseId}: checkout presenter prepared and released without opening overlay`, failures);
  } else if (isReadinessPreflight) {
    verifyNoOverlayActivation(caseId, resultEvents, lifecycleEntries, failures);
    expect(readiness.ok, `${caseId}: presenter readiness preflight passed`, failures);
  } else {
    expect(activated, `${caseId}: overlay active callback observed`, failures);
    expect(closed, `${caseId}: overlay inactive callback observed after active`, failures);
    verifyOverlayCallbackAppIds(caseId, lifecycleEntries, expectedAppId, failures);
    verifyOverlayCallbackPids(caseId, lifecycleEntries, overlayProcesses, failures);
    expect(parking.ok, `${caseId}: presenter parked after overlay close`, failures);
  }

  if (isShortcutAction(actionName)) {
    const expectedShortcutTarget =
      typeof metadata.shortcutTarget === "string" && metadata.shortcutTarget.length > 0
        ? metadata.shortcutTarget
        : "friends";
    const shortcutOpen = lifecycleEntries.find((entry) => entry.type === "event:overlay:shortcut-open");
    const shortcutOpenPayload = shortcutOpen ? objectOrEmpty(shortcutOpen.payload) : {};
    if (!hasExpectedActionError) {
      expect(
        Boolean(shortcutOpen),
        `${caseId}: managed shortcut open event recorded`,
        failures
      );
    } else if (expectedNativeHostUnavailableActionError) {
      expect(
        !shortcutOpen,
        `${caseId}: managed shortcut open event was not recorded before native host unavailable failure`,
        failures
      );
    }
    if (shortcutOpen) {
      expect(
        shortcutOpenPayload.target === expectedShortcutTarget,
        `${caseId}: shortcut open target expected ${formatValue(expectedShortcutTarget)}, got ${formatValue(
          shortcutOpenPayload.target
        )}`,
        failures
      );
    }
    if (electronOverlay) {
      const shortcut = objectOrEmpty(electronOverlay.overlayShortcut);
      expect(shortcut.enabled === true, `${caseId}: overlay shortcut enabled`, failures);
      expect(
        shortcut.targetType === expectedShortcutTarget || shortcut.targetType === "function",
        `${caseId}: overlay shortcut target expected ${formatValue(expectedShortcutTarget)}, got ${formatValue(
          shortcut.targetType
        )}`,
        failures
      );
      if (expectedShortcutTarget === "checkout") {
        const targetSnapshot =
          shortcut.targetType === "function"
            ? objectOrEmpty(shortcutOpenPayload.overlayTarget)
            : objectOrEmpty(shortcut.target);
        expect(
          Boolean(summaryCheckoutSource),
          `${caseId}: checkout shortcut source recorded`,
          failures
        );
        expect(
          checkoutTargetSnapshotHasTarget(targetSnapshot),
          `${caseId}: shortcut checkout target snapshot includes a checkout URL or transaction ID`,
          failures
        );
      }
    }
  }

  return {
    caseId,
    expectedAppId,
    action: actionName,
    activated,
    closed,
    parked: isReadinessPreflight ? readiness.parked === true : checkoutPrepareOnly ? checkoutPrepared.parked === true : parking.ok,
    idleStable: parking.required ? parking.idleStable : "n/a",
    passive: isPassive,
    overlayTargets,
    overlayGameIds,
    nativeHostBackend: nativePresenter?.backend ?? "none",
    macInteractive,
    managedIsolation,
    zeroTiming,
    shown: managedWaits.required ? managedWaits.shownOk : "n/a",
    webVisible: webVisible.required ? webVisible.ok : "n/a",
    openStatuses: openStatuses.required ? openStatuses.ok : "n/a",
    checkoutOperation: openStatuses.checkoutOperation,
    managedWaits: managedWaits.required ? managedWaits.ok : "n/a",
    openAndWait: openAndWait.required ? openAndWait.ok : "n/a",
    checkoutWait: checkoutWait.required ? checkoutWait.ok : "n/a",
    checkoutPrepared: checkoutPrepared.required ? checkoutPrepared.ok : "n/a",
    duplicateOpenGuard: duplicateOpenGuard.required ? duplicateOpenGuard.ok : "n/a",
    checkoutSource: checkoutWait.required
      ? checkoutWait.source || summaryCheckoutSource || "unknown"
      : summaryCheckoutSource || "n/a",
    microTxnCallback: microTxnCallback.required ? microTxnCallback.ok : "n/a",
    nativeHostUnavailable: expectedNativeHostUnavailableReason || "none",
    noOverlayActivation: expectedNoOverlayActivation,
    crashOk
  };
}

function verifyDuplicateOpenGuard(caseId, actionName, resultEvents, lifecycleEntries, failures) {
  if (actionName !== "presenter-duplicate-open-guard") {
    return { required: false, ok: true };
  }

  const failuresBefore = failures.length;
  const event = [...resultEvents, ...lifecycleEntries].find(
    (entry) =>
      entry &&
      (entry.type === "overlay:presenter-duplicate-open-guard" ||
        entry.type === "event:overlay:presenter-duplicate-open-guard")
  );
  if (!event) {
    failures.push(`${caseId}: missing overlay:presenter-duplicate-open-guard event`);
    return { required: true, ok: false };
  }

  const payload = objectOrEmpty(event.payload);
  const status = objectOrEmpty(payload.status);
  const shortcutStatus = objectOrEmpty(payload.shortcutStatus);
  verifyDuplicateOpenBusyStatus(caseId, "status", status, failures);
  verifyDuplicateOpenBusyStatus(caseId, "shortcut status", shortcutStatus, failures);

  const namedStatuses = objectOrEmpty(payload.namedStatuses);
  for (const name of DUPLICATE_OPEN_NAMED_STATUS_NAMES) {
    verifyDuplicateOpenBusyStatus(
      caseId,
      `named ${name} status`,
      objectOrEmpty(namedStatuses[name]),
      failures
    );
  }
  const namedIfAvailableNulls = objectOrEmpty(payload.namedIfAvailableNulls);
  const namedAndWaitIfAvailableNulls = objectOrEmpty(payload.namedAndWaitIfAvailableNulls);
  for (const name of DUPLICATE_OPEN_NAMED_TARGET_NAMES) {
    expect(
      namedIfAvailableNulls[name] === true,
      `${caseId}: open${formatNamedOverlayHelperName(name)}IfAvailable returned null while busy`,
      failures
    );
    expect(
      namedAndWaitIfAvailableNulls[name] === true,
      `${caseId}: open${formatNamedOverlayHelperName(name)}AndWaitIfAvailable returned null while busy`,
      failures
    );
  }

  expect(payload.openIfAvailableNull === true, `${caseId}: openIfAvailable returned null while busy`, failures);
  expect(
    payload.openAndWaitIfAvailableNull === true,
    `${caseId}: openAndWaitIfAvailable returned null while busy`,
    failures
  );
  expect(
    payload.shortcutIfAvailableNull === true,
    `${caseId}: openShortcutTargetIfAvailable returned null while busy`,
    failures
  );
  expect(
    payload.shortcutAndWaitIfAvailableNull === true,
    `${caseId}: openShortcutTargetAndWaitIfAvailable returned null while busy`,
    failures
  );
  expect(
    payload.checkoutOpenIfAvailableNull === true,
    `${caseId}: openCheckoutIfAvailable returned null while busy`,
    failures
  );
  expect(
    payload.checkoutIfAvailableNull === true,
    `${caseId}: openCheckoutAndWaitIfAvailable returned null while busy`,
    failures
  );
  expect(
    payload.checkoutOperationRan === false,
    `${caseId}: checkout IfAvailable did not run the transaction operation while busy`,
    failures
  );

  return { required: true, ok: failures.length === failuresBefore };
}

function verifyNamedOpenStatusSnapshots(caseId, metadata, overlay, failures) {
  const requireNamedOpenStatusSnapshots = metadata.requireNamedOpenStatusSnapshots === true;
  const requireCheckoutOperationStatusSnapshot = metadata.requireCheckoutOperationStatusSnapshot === true;
  if (!requireNamedOpenStatusSnapshots && !requireCheckoutOperationStatusSnapshot) {
    return { required: false, ok: true, checkoutOperation: "n/a" };
  }

  const failuresBefore = failures.length;
  let checkoutOperationOk = requireCheckoutOperationStatusSnapshot ? false : "n/a";
  const openStatusesEntry = overlay.openStatuses;
  expect(openStatusesEntry && openStatusesEntry.ok === true, `${caseId}: named open status snapshot read ok`, failures);
  const statuses = readOkValue(openStatusesEntry);
  expect(
    Boolean(statuses && typeof statuses === "object" && !Array.isArray(statuses)),
    `${caseId}: named open status snapshot available`,
    failures
  );
  if (!statuses || typeof statuses !== "object" || Array.isArray(statuses)) {
    return { required: true, ok: false, checkoutOperation: checkoutOperationOk };
  }

  if (requireNamedOpenStatusSnapshots) {
    for (const [name, targetType] of NAMED_OPEN_STATUS_TARGET_TYPES) {
      verifyNamedOpenStatusSnapshot(caseId, statuses, name, targetType, failures);
    }
  }

  if (requireCheckoutOperationStatusSnapshot) {
    const checkoutOperationFailuresBefore = failures.length;
    verifyNamedOpenStatusSnapshot(caseId, statuses, "checkoutOperation", "checkout", failures);
    checkoutOperationOk = failures.length === checkoutOperationFailuresBefore;
  }

  return { required: true, ok: failures.length === failuresBefore, checkoutOperation: checkoutOperationOk };
}

function verifyNamedOpenStatusSnapshot(caseId, statuses, name, targetType, failures) {
  const entry = statuses[name];
  expect(entry && entry.ok === true, `${caseId}: named ${name} open status read ok`, failures);
  const status = readOkValue(entry);
  expect(
    Boolean(status && typeof status === "object" && !Array.isArray(status)),
    `${caseId}: named ${name} open status snapshot available`,
    failures
  );
  if (!status || typeof status !== "object" || Array.isArray(status)) {
    return;
  }
  verifyNamedOpenStatus(caseId, name, targetType, status, failures);
}

function verifyNamedOpenStatus(caseId, name, targetType, status, failures) {
  expect(typeof status.canOpen === "boolean", `${caseId}: named ${name} open status has canOpen boolean`, failures);
  expect(typeof status.canWait === "boolean", `${caseId}: named ${name} open status has canWait boolean`, failures);
  if (name === "checkoutOperation") {
    expect(
      typeof status.canStartOperation === "boolean",
      `${caseId}: named checkoutOperation status has canStartOperation boolean`,
      failures
    );
  }
  if (Object.prototype.hasOwnProperty.call(status, "reason")) {
    expect(
      typeof status.reason === "string" && status.reason.length > 0,
      `${caseId}: named ${name} open status reason is a non-empty string`,
      failures
    );
  }
  if (Object.prototype.hasOwnProperty.call(status, "waitReason")) {
    expect(
      typeof status.waitReason === "string" && status.waitReason.length > 0,
      `${caseId}: named ${name} open status waitReason is a non-empty string`,
      failures
    );
  }

  const targetSnapshot = objectField(status, "targetSnapshot");
  expect(Boolean(targetSnapshot), `${caseId}: named ${name} open status includes targetSnapshot`, failures);
  if (!targetSnapshot) {
    return;
  }
  expect(
    targetSnapshot.type === targetType,
    `${caseId}: named ${name} open status target type expected ${formatValue(targetType)}, got ${formatValue(targetSnapshot.type)}`,
    failures
  );
  expectSanitizedOverlayTargetSnapshot(caseId, `named ${name} open status targetSnapshot`, targetSnapshot, failures);
}

function verifyDuplicateOpenBusyStatus(caseId, label, status, failures) {
  expect(status.canOpen === false, `${caseId}: duplicate guard ${label} rejects open`, failures);
  expect(status.canWait === false, `${caseId}: duplicate guard ${label} rejects wait`, failures);
  if (Object.prototype.hasOwnProperty.call(status, "canStartOperation")) {
    expect(
      status.canStartOperation === false,
      `${caseId}: duplicate guard ${label} rejects checkout operation start`,
      failures
    );
  }
  expect(
    status.reason === "opening" || status.reason === "overlay-active",
    `${caseId}: duplicate guard ${label} is opening or overlay-active, got ${formatValue(status.reason)}`,
    failures
  );
  expect(
    status.waitReason === "opening" || status.waitReason === "overlay-active",
    `${caseId}: duplicate guard ${label} wait reason is opening or overlay-active, got ${formatValue(
      status.waitReason
    )}`,
    failures
  );
}

function formatNamedOverlayHelperName(name) {
  return name
    .split(/[-_]/)
    .map((part) => `${part.slice(0, 1).toUpperCase()}${part.slice(1)}`)
    .join("");
}

function verifyWebOverlayVisibleBeforeClose(caseId, entries, failures) {
  const failuresBefore = failures.length;
  const firstActiveIndex = entries.findIndex(isLifecycleOverlayActiveEvent);
  const inactiveAfterActiveIndex = entries.findIndex(
    (entry, index) => index > firstActiveIndex && isLifecycleOverlayInactiveEvent(entry)
  );
  const visibilityEvents = entries
    .map((entry, index) => ({ entry, index, payload: objectOrEmpty(entry.payload) }))
    .filter(({ entry }) => entry && entry.type === "event:overlay:web-visible");

  if (visibilityEvents.length === 0) {
    failures.push(`${caseId}: no macOS web overlay visibility event before web close probe`);
    return { required: true, ok: false };
  }

  const visibleBeforeClose = visibilityEvents.find(({ index, payload }) => {
    return (
      payload.ok === true &&
      (firstActiveIndex === -1 || index > firstActiveIndex) &&
      (inactiveAfterActiveIndex === -1 || index < inactiveAfterActiveIndex)
    );
  });

  if (!visibleBeforeClose) {
    failures.push(`${caseId}: macOS web overlay visibility was not confirmed before close probe`);
  }

  return { required: true, ok: failures.length === failuresBefore };
}

function isStoreOverlayAction(actionName) {
  return actionName === "presenter-store" || actionName === "presenter-store-open-and-wait";
}

function verifyPresenterReadiness(caseId, actionName, resultEvents, entries, finalPresenter, finalAvailability, options = {}) {
  const failures = Array.isArray(options.failures) ? options.failures : [];
  if (!READINESS_ACTIONS.has(actionName)) {
    return { required: false, ok: true, parked: false };
  }

  const failuresBefore = failures.length;
  const event = [...resultEvents, ...entries].find(
    (entry) => entry && (entry.type === "overlay:presenter-ready" || entry.type === "event:overlay:presenter-ready")
  );
  if (!event) {
    failures.push(`${caseId}: missing overlay:presenter-ready event`);
  }

  const payload = objectOrEmpty(event && event.payload);
  const eventPresenter = objectField(payload, "presenter");
  const eventAvailability = objectField(payload, "nativeHostAvailability");
  const presenter = eventPresenter || finalPresenter;
  const availability = eventAvailability || finalAvailability;
  let parked = false;

  if (!presenter) {
    failures.push(`${caseId}: presenter readiness snapshot available`);
  } else if (options.expectedNativeHostUnavailableReason) {
    verifyNativeHostUnavailablePresenter(caseId, presenter, options.expectedNativeHostUnavailableReason, failures);
  } else {
    const beforeParkedFailures = failures.length;
    expectParkedPresenter(caseId, presenter, "presenter readiness", failures);
    parked = failures.length === beforeParkedFailures;
  }

  if (options.expectedNativeHostUnavailableReason) {
    verifyNativeHostUnavailableAvailability(
      caseId,
      availability,
      options.expectedNativeHostUnavailableReason,
      failures
    );
  } else {
    verifyNativeHostAvailableAvailability(caseId, availability, failures);
  }

  return { required: true, ok: failures.length === failuresBefore, parked };
}

function verifyNativeHostAvailableAvailability(caseId, availability, failures) {
  expect(Boolean(availability), `${caseId}: native host availability snapshot available`, failures);
  if (!availability) {
    return;
  }

  expect(availability.available === true, `${caseId}: native host availability reports available`, failures);
  expect(
    availability.code == null,
    `${caseId}: native host availability code expected none, got ${formatValue(availability.code)}`,
    failures
  );
  expect(
    availability.reason == null,
    `${caseId}: native host availability reason expected none, got ${formatValue(availability.reason)}`,
    failures
  );
  expect(
    availability.nativeHostUnavailableReason == null,
    `${caseId}: native host availability unavailable reason expected none, got ${formatValue(
      availability.nativeHostUnavailableReason
    )}`,
    failures
  );

  const availabilitySnapshot = objectField(availability, "snapshot");
  expect(Boolean(availabilitySnapshot), `${caseId}: native host availability presenter snapshot available`, failures);
  if (availabilitySnapshot) {
    expectParkedPresenter(caseId, availabilitySnapshot, "native host availability", failures);
  }

  const environment = objectField(availability, "macOverlayEnvironment");
  expect(Boolean(environment), `${caseId}: native host availability macOS environment available`, failures);
  if (environment) {
    expect(
      environment.screenLocked === false,
      `${caseId}: native host availability screen locked expected false, got ${formatValue(environment.screenLocked)}`,
      failures
    );
    expect(
      environment.displayAsleep === false,
      `${caseId}: native host availability display asleep expected false, got ${formatValue(environment.displayAsleep)}`,
      failures
    );
  }
}

function collectOverlayGameIds(overlayProcesses) {
  if (!Array.isArray(overlayProcesses.gameoverlayui)) {
    return [];
  }
  return [...new Set(overlayProcesses.gameoverlayui.map((target) => String(target.gameId ?? "unknown")))];
}

function verifyOpenAndWaitCompletion(caseId, actionName, entries, failures) {
  if (!OPEN_AND_WAIT_ACTIONS.has(actionName)) {
    return { required: false, ok: true };
  }

  const failuresBefore = failures.length;
  const start = entries.find((entry) => entry.type === "event:overlay:presenter-open-and-wait-start");
  if (!start) {
    failures.push(`${caseId}: missing overlay:presenter-open-and-wait-start`);
  }

  const inactiveIndex = entries.findIndex(isLifecycleOverlayInactiveEvent);
  if (inactiveIndex === -1) {
    failures.push(`${caseId}: openAndWait did not record active=false before completion`);
    return { required: true, ok: false };
  }

  const complete = entries.find(
    (entry, index) => index > inactiveIndex && entry.type === "event:overlay:presenter-open-and-wait-complete"
  );
  if (!complete) {
    failures.push(`${caseId}: missing overlay:presenter-open-and-wait-complete after active=false`);
    return { required: true, ok: false };
  }

  const payload = objectOrEmpty(complete.payload);
  const shown = objectField(payload, "shown");
  const parked = objectField(payload, "parked");
  if (!shown) {
    failures.push(`${caseId}: openAndWait completion did not include shown presenter snapshot`);
  } else {
    expectActivePresenter(caseId, shown, "openAndWait shown completion", failures);
  }
  if (!parked) {
    failures.push(`${caseId}: openAndWait completion did not include parked presenter snapshot`);
  } else {
    expectParkedPresenter(caseId, parked, "openAndWait completion", failures);
  }

  return { required: true, ok: failures.length === failuresBefore };
}

function verifyCheckoutOpenAndWait(caseId, actionName, entries, expectedCheckoutSource, failures) {
  if (actionName !== "presenter-checkout" || !expectedCheckoutSource) {
    return { required: false, ok: true };
  }

  const open = entries.find((entry) => {
    const payload = objectOrEmpty(entry.payload);
    return entry.type === "event:overlay:presenter-open" && payload.target === "checkout";
  });
  if (!open) {
    failures.push(`${caseId}: missing checkout overlay:presenter-open event`);
    return { required: true, ok: false };
  }

  const failuresBefore = failures.length;
  const openPayload = objectOrEmpty(open.payload);
  if (openPayload.api !== "openCheckoutAndWait") {
    failures.push(`${caseId}: checkout presenter-open did not use openCheckoutAndWait`);
  }
  if (expectedCheckoutSource && openPayload.checkoutSource !== expectedCheckoutSource) {
    failures.push(
      `${caseId}: checkout source expected ${formatValue(expectedCheckoutSource)}, got ${formatValue(openPayload.checkoutSource)}`
    );
  }

  const inactiveIndex = entries.findIndex(isLifecycleOverlayInactiveEvent);
  if (inactiveIndex === -1) {
    failures.push(`${caseId}: checkout openAndWait did not record active=false before completion`);
    return { required: true, ok: false };
  }

  const complete = entries.find(
    (entry, index) => index > inactiveIndex && entry.type === "event:overlay:presenter-checkout-open-and-wait-complete"
  );
  if (!complete) {
    failures.push(`${caseId}: missing overlay:presenter-checkout-open-and-wait-complete after active=false`);
    return { required: true, ok: false };
  }

  const payload = objectOrEmpty(complete.payload);
  if (expectedCheckoutSource && payload.checkoutSource !== expectedCheckoutSource) {
    failures.push(
      `${caseId}: checkout completion source expected ${formatValue(expectedCheckoutSource)}, got ${formatValue(payload.checkoutSource)}`
    );
  }
  const targetSnapshot = objectField(payload, "targetSnapshot");
  if (!targetSnapshot) {
    failures.push(`${caseId}: checkout completion did not include sanitized targetSnapshot`);
  } else {
    expectCheckoutTargetSnapshot(caseId, targetSnapshot, failures);
  }
  const shown = objectField(payload, "shown");
  const parked = objectField(payload, "parked");
  if (!shown) {
    failures.push(`${caseId}: checkout completion did not include shown presenter snapshot`);
  } else {
    expectActivePresenter(caseId, shown, "checkout shown completion", failures);
  }
  if (!parked) {
    failures.push(`${caseId}: checkout completion did not include parked presenter snapshot`);
  } else {
    expectParkedPresenter(caseId, parked, "checkout openAndWait completion", failures);
  }

  return { required: true, ok: failures.length === failuresBefore, source: openPayload.checkoutSource || "" };
}

function verifyCheckoutPrepared(caseId, actionName, entries, finalPresenter, options = {}) {
  const failures = Array.isArray(options.failures) ? options.failures : [];
  if (actionName !== "presenter-checkout" || options.required !== true) {
    return { required: false, ok: true, parked: false };
  }

  const failuresBefore = failures.length;
  const ready = entries.find((entry) => entry && entry.type === "event:overlay:presenter-checkout-ready");
  if (!ready) {
    failures.push(`${caseId}: missing overlay:presenter-checkout-ready event`);
  } else {
    const presenter = presenterPayload(ready);
    if (!presenter) {
      failures.push(`${caseId}: overlay:presenter-checkout-ready did not include a presenter snapshot`);
    } else {
      expectPreparedPresenter(caseId, presenter, "checkout preparation", failures);
    }
  }

  const opened = entries.some((entry) => {
    const payload = objectOrEmpty(entry && entry.payload);
    return entry && entry.type === "event:overlay:presenter-open" && payload.target === "checkout";
  });
  expect(!opened, `${caseId}: checkout preparation did not open a checkout overlay`, failures);

  let parked = false;
  if (!finalPresenter) {
    failures.push(`${caseId}: checkout preparation final presenter snapshot available`);
  } else {
    const beforeParkedFailures = failures.length;
    expectParkedPresenter(caseId, finalPresenter, "checkout preparation release", failures);
    parked = failures.length === beforeParkedFailures;
  }

  return { required: true, ok: failures.length === failuresBefore, parked };
}

function verifyMicroTxnCallbackPresenterSnapshots(caseId, entries, failures, options = {}) {
  const callbacks = entries.filter((entry) => entry && entry.type === "event:callback:microtxn");
  if (callbacks.length === 0) {
    if (options.required === true) {
      failures.push(`${caseId}: required MicroTxnAuthorizationResponse callback was not recorded`);
      return { required: true, ok: false };
    }
    return { required: false, ok: true };
  }

  const failuresBefore = failures.length;
  callbacks.forEach((entry, index) => {
    const presenter = presenterPayload(entry);
    const label = `microtxn callback ${index + 1}`;
    if (!presenter) {
      failures.push(`${caseId}: ${label} did not include a presenter snapshot`);
      return;
    }
    expectMicroTxnCallbackPresenter(caseId, presenter, label, failures);
  });

  return { required: true, ok: failures.length === failuresBefore };
}

function expectMicroTxnCallbackPresenter(caseId, presenter, label, failures) {
  expectMacOverlayEnvironmentAvailable(caseId, presenter, label, failures);
  expectPresenterField(caseId, presenter, "closed", false, `native presenter closed ${label}`, failures);
  expectPresenterField(caseId, presenter, "attached", true, `native presenter attached ${label}`, failures);
  expectPresenterField(caseId, presenter, "nativeHostOpen", true, `native presenter host open ${label}`, failures);
  expect(
    presenter.backend === "macos-metal" || presenter.backend === "macos-opengl",
    `${caseId}: native presenter backend available ${label}`,
    failures
  );
  expect(
    presenter.mode === "active" || presenter.mode === "passive",
    `${caseId}: native presenter mode active or passive ${label}, got ${formatValue(presenter.mode)}`,
    failures
  );
  expectPresenterField(caseId, presenter, "idleFps", 0, `native presenter idle FPS ${label}`, failures);
  expect(
    Number.isFinite(Number(presenter.currentFps)),
    `${caseId}: native presenter current FPS recorded ${label}`,
    failures
  );
}

function checkoutTargetSnapshotHasTarget(targetSnapshot) {
  if (targetSnapshot.type !== "checkout") {
    return false;
  }
  return (
    targetSnapshot.hasSteamUrl === true ||
    targetSnapshot.hasUrl === true ||
    targetSnapshot.hasTransactionId === true ||
    sanitizedTargetValuePresent(targetSnapshot.steamUrl) ||
    sanitizedTargetValuePresent(targetSnapshot.url) ||
    sanitizedTargetValuePresent(targetSnapshot.transactionId)
  );
}

function expectCheckoutTargetSnapshot(caseId, targetSnapshot, failures) {
  expect(
    targetSnapshot.type === "checkout",
    `${caseId}: checkout targetSnapshot type is checkout, got ${formatValue(targetSnapshot.type)}`,
    failures
  );
  expect(
    checkoutTargetSnapshotHasTarget(targetSnapshot),
    `${caseId}: checkout targetSnapshot includes a checkout URL or transaction ID presence marker`,
    failures
  );

  for (const key of ["steamUrl", "url", "transactionId", "returnUrl", "steamId64"]) {
    if (!Object.prototype.hasOwnProperty.call(targetSnapshot, key)) {
      continue;
    }
    expect(
      sanitizedTargetValuePresent(targetSnapshot[key]),
      `${caseId}: checkout targetSnapshot ${key} is redacted instead of raw`,
      failures
    );
  }
}

function expectSanitizedOverlayTargetSnapshot(caseId, label, targetSnapshot, failures) {
  expect(
    typeof targetSnapshot.type === "string" && targetSnapshot.type.length > 0,
    `${caseId}: ${label} has a target type`,
    failures
  );

  for (const key of ["steamUrl", "url", "transactionId", "returnUrl", "steamId64"]) {
    if (!Object.prototype.hasOwnProperty.call(targetSnapshot, key)) {
      continue;
    }
    expect(
      sanitizedTargetValuePresent(targetSnapshot[key]),
      `${caseId}: ${label} ${key} is redacted instead of raw`,
      failures
    );
  }
}

function sanitizedTargetValuePresent(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }
  return value.redacted === true && value.present === true;
}

function verifyManagedLifecycleWaits(caseId, actionName, entries, isPassive, failures) {
  if (isPassive || !requiresManagedLifecycleWaits(actionName, entries)) {
    return { required: false, ok: true };
  }

  const failuresBefore = failures.length;
  let shownOk = false;
  const firstActiveIndex = entries.findIndex(isLifecycleOverlayActiveEvent);
  if (firstActiveIndex === -1) {
    failures.push(`${caseId}: no active=true callback before managed wait lifecycle`);
    return { required: true, ok: false, shownOk };
  }

  const inactiveAfterActiveIndex = entries.findIndex(
    (entry, index) => index > firstActiveIndex && isLifecycleOverlayInactiveEvent(entry)
  );
  if (inactiveAfterActiveIndex === -1) {
    failures.push(`${caseId}: no active=false callback before managed wait close lifecycle`);
    return { required: true, ok: false, shownOk };
  }

  const shown = entries.find(
    (entry, index) => index > firstActiveIndex && entry.type === "event:overlay:presenter-wait-shown"
  );
  const closed = entries.find(
    (entry, index) => index > inactiveAfterActiveIndex && entry.type === "event:overlay:presenter-wait-closed"
  );
  const parked = entries.find(
    (entry, index) => index > inactiveAfterActiveIndex && entry.type === "event:overlay:presenter-parked"
  );

  if (!shown) {
    failures.push(`${caseId}: no overlay:presenter-wait-shown event after active=true`);
  } else {
    const shownPresenter = presenterPayload(shown);
    if (!shownPresenter) {
      failures.push(`${caseId}: overlay:presenter-wait-shown did not include a presenter snapshot`);
    } else {
      const beforeShownFailures = failures.length;
      expectActivePresenter(caseId, shownPresenter, "managed shown wait", failures);
      shownOk = failures.length === beforeShownFailures;
    }
  }

  if (!closed) {
    failures.push(`${caseId}: no overlay:presenter-wait-closed event after active=false`);
  } else {
    const closedPresenter = presenterPayload(closed);
    if (!closedPresenter) {
      failures.push(`${caseId}: overlay:presenter-wait-closed did not include a presenter snapshot`);
    } else {
      expectClosedWaitPresenter(caseId, closedPresenter, "managed close wait", failures);
    }
  }

  if (!parked) {
    failures.push(`${caseId}: no overlay:presenter-parked event after active=false`);
  } else {
    const parkedPresenter = presenterPayload(parked);
    if (!parkedPresenter) {
      failures.push(`${caseId}: overlay:presenter-parked did not include a presenter snapshot`);
    } else {
      expectParkedPresenter(caseId, parkedPresenter, "managed park wait", failures);
    }
  }

  return { required: true, ok: failures.length === failuresBefore, shownOk };
}

function requiresManagedLifecycleWaits(actionName, entries) {
  if (OPEN_AND_WAIT_ACTIONS.has(actionName) || actionName === "presenter-shortcut") {
    return entries.some((entry) => entry.type === "event:callback:overlay-activated");
  }
  if (actionName === "presenter-checkout") {
    return entries.some((entry) => entry.type === "event:overlay:presenter-open");
  }
  return false;
}

function isShortcutAction(actionName) {
  return actionName === "presenter-shortcut" || actionName === "presenter-shortcut-open-and-wait";
}

function verifyPassiveNotification(caseId, resultEvents, entries, presenter, config, failures, options = {}) {
  expect(
    ![...resultEvents, ...entries].some(isOverlayActiveEvent),
    `${caseId}: passive notification did not activate modal overlay`,
    failures
  );
  expect(
    hasResultOrLifecycleEvent(resultEvents, entries, config.event),
    `${caseId}: passive notification event ${config.event} recorded`,
    failures
  );
  for (const callback of config.callbacks) {
    expect(
      hasResultOrLifecycleEvent(resultEvents, entries, callback),
      `${caseId}: passive notification callback ${callback} recorded`,
      failures
    );
  }

  const eventPresenter = [...resultEvents, ...entries]
    .filter((entry) => entry && (entry.type === config.event || entry.type === `event:${config.event}`))
    .map(presenterPayload)
    .find(Boolean);
  const passivePresenter = eventPresenter || presenter;
  if (passivePresenter) {
    if (options.expectedNativeHostUnavailableReason) {
      if (passivePresenter.nativeHostUnavailableReason !== options.expectedNativeHostUnavailableReason) {
        failures.push(
          `${caseId}: passive notification native host unavailable reason expected ` +
            `${options.expectedNativeHostUnavailableReason}, got ${formatValue(passivePresenter.nativeHostUnavailableReason)}`
        );
        return;
      }
      verifyNativeHostUnavailablePresenter(caseId, passivePresenter, options.expectedNativeHostUnavailableReason, failures);
      return;
    }
    expectPassiveNotificationPresenter(caseId, passivePresenter, "passive notification snapshot", failures);
  } else {
    failures.push(`${caseId}: passive notification presenter snapshot available`);
  }
}

function hasResultOrLifecycleEvent(resultEvents, lifecycleEntries, eventType) {
  return (
    resultEvents.some((entry) => entry && entry.type === eventType) ||
    lifecycleEntries.some((entry) => entry && entry.type === `event:${eventType}`)
  );
}

function verifyOverlayCallbackAppIds(caseId, entries, expectedAppId, failures) {
  for (const entry of entries.filter((item) => item && item.type === "event:callback:overlay-activated")) {
    const appId = overlayEventAppId(entry);
    if (appId !== expectedAppId) {
      failures.push(
        `${caseId}: overlay callback app ID expected ${formatValue(expectedAppId)}, got ${formatValue(appId)}`
      );
    }
  }
}

function verifyOverlayCallbackPids(caseId, entries, overlayProcesses, failures) {
  const expectedPids = new Set(
    (Array.isArray(overlayProcesses.gameoverlayui) ? overlayProcesses.gameoverlayui : [])
      .map((target) => Number(target.pid))
      .filter(Number.isFinite)
  );
  for (const entry of entries.filter((item) => item && item.type === "event:callback:overlay-activated")) {
    const overlayPid = overlayEventPid(entry);
    if (overlayPid === undefined) {
      failures.push(`${caseId}: overlay callback did not include overlay PID`);
    } else if (!expectedPids.has(overlayPid)) {
      failures.push(
        `${caseId}: overlay callback PID expected one of ${formatValue([...expectedPids])}, got ${formatValue(overlayPid)}`
      );
    }
  }
}

function verifyLifecycleParking(caseId, entries, isPassive, failures) {
  if (isPassive) {
    return { required: false, ok: true, idleStable: "n/a" };
  }

  const firstActiveIndex = entries.findIndex(isLifecycleOverlayActiveEvent);
  if (firstActiveIndex === -1) {
    return { required: false, ok: false, idleStable: "n/a" };
  }
  const inactiveAfterActiveIndex = entries.findIndex(
    (entry, index) => index > firstActiveIndex && isLifecycleOverlayInactiveEvent(entry)
  );
  if (inactiveAfterActiveIndex === -1) {
    return { required: true, ok: false, idleStable: false };
  }

  const afterClose = entries
    .map((entry, index) => ({ entry, index, presenter: presenterPayload(entry) }))
    .filter(({ entry, index }) => index > inactiveAfterActiveIndex && entry.type === "event:overlay:presenter-after-close");
  const stable = entries
    .map((entry, index) => ({ entry, index, presenter: presenterPayload(entry) }))
    .filter(
      ({ entry, index }) =>
        index > inactiveAfterActiveIndex && entry.type === "event:overlay:presenter-after-close-stable"
    );
  const parked = entries
    .map((entry, index) => ({ entry, index, presenter: presenterPayload(entry) }))
    .filter(({ entry, index }) => index > inactiveAfterActiveIndex && entry.type === "event:overlay:presenter-parked");
  const firstPresenter = afterClose.filter(({ presenter }) => presenter).at(-1)?.presenter;
  const stablePresenter = stable.filter(({ presenter }) => presenter).at(-1)?.presenter;
  const parkedPresenter = parked.filter(({ presenter }) => presenter).at(-1)?.presenter;

  expect(afterClose.length > 0, `${caseId}: after-close presenter event recorded`, failures);
  expect(stable.length > 0, `${caseId}: stable after-close presenter event recorded`, failures);
  expect(parked.length > 0, `${caseId}: presenter parked event recorded`, failures);
  if (!firstPresenter || !stablePresenter || !parkedPresenter) {
    return { required: true, ok: false, idleStable: false };
  }

  const parkingFailuresBefore = failures.length;
  expectParkedPresenter(caseId, firstPresenter, "first close sample", failures);
  expectParkedPresenter(caseId, stablePresenter, "stable close sample", failures);
  expectParkedPresenter(caseId, parkedPresenter, "parked sample", failures);

  const pumpStable = firstPresenter.pumpCount === stablePresenter.pumpCount;
  if (!pumpStable) {
    failures.push(
      `${caseId}: native presenter pump count changed after close: first=${formatValue(firstPresenter.pumpCount)} stable=${formatValue(stablePresenter.pumpCount)}`
    );
  }

  return { required: true, ok: failures.length === parkingFailuresBefore, idleStable: pumpStable };
}

function expectParkedPresenter(caseId, presenter, label, failures) {
  expectMacOverlayEnvironmentAvailable(caseId, presenter, label, failures);
  expectMacosNeedsPresentPollingDisabled(caseId, presenter, label, failures);
  expectPresenterField(caseId, presenter, "closed", false, `native presenter closed ${label}`, failures);
  expectPresenterField(caseId, presenter, "attached", true, `native presenter attached ${label}`, failures);
  expectPresenterField(caseId, presenter, "nativeHostOpen", true, `native presenter host open ${label}`, failures);
  expectPresenterField(caseId, presenter, "mode", "passive", `native presenter mode ${label}`, failures);
  expectPresenterField(caseId, presenter, "clickThrough", true, `native presenter click-through ${label}`, failures);
  expectPresenterField(caseId, presenter, "focusable", false, `native presenter focusable ${label}`, failures);
  expectPresenterField(caseId, presenter, "transparent", true, `native presenter transparent ${label}`, failures);
  expectPresenterField(caseId, presenter, "overlayActive", false, `native presenter overlay active ${label}`, failures);
  expectPresenterField(caseId, presenter, "idleFps", 0, `native presenter idle FPS ${label}`, failures);
  expectPresenterField(caseId, presenter, "currentFps", 0, `native presenter current FPS ${label}`, failures);
  expectPresenterField(caseId, presenter, "overlayNeedsPresent", false, `native presenter overlay needs present ${label}`, failures);
}

function expectActivePresenter(caseId, presenter, label, failures) {
  expectMacOverlayEnvironmentAvailable(caseId, presenter, label, failures);
  expectMacosNeedsPresentPollingDisabled(caseId, presenter, label, failures);
  expectPresenterField(caseId, presenter, "closed", false, `native presenter closed ${label}`, failures);
  expectPresenterField(caseId, presenter, "attached", true, `native presenter attached ${label}`, failures);
  expectPresenterField(caseId, presenter, "nativeHostOpen", true, `native presenter host open ${label}`, failures);
  expectPresenterField(caseId, presenter, "mode", "active", `native presenter mode ${label}`, failures);
  expectPresenterField(caseId, presenter, "clickThrough", false, `native presenter click-through ${label}`, failures);
  expectPresenterField(caseId, presenter, "focusable", false, `native presenter focusable ${label}`, failures);
  expectPresenterField(caseId, presenter, "transparent", false, `native presenter transparent ${label}`, failures);
  expectPresenterField(caseId, presenter, "overlayActive", true, `native presenter overlay active ${label}`, failures);
  expectPresenterField(caseId, presenter, "idleFps", 0, `native presenter idle FPS ${label}`, failures);
  expectPresenterField(caseId, presenter, "activeOverlayFps", 30, `native presenter active overlay FPS ${label}`, failures);
  expectPresenterField(caseId, presenter, "currentFps", 30, `native presenter current FPS ${label}`, failures);
}

function expectPreparedPresenter(caseId, presenter, label, failures) {
  expectMacOverlayEnvironmentAvailable(caseId, presenter, label, failures);
  expectMacosNeedsPresentPollingDisabled(caseId, presenter, label, failures);
  expectPresenterField(caseId, presenter, "closed", false, `native presenter closed ${label}`, failures);
  expectPresenterField(caseId, presenter, "attached", true, `native presenter attached ${label}`, failures);
  expectPresenterField(caseId, presenter, "nativeHostOpen", true, `native presenter host open ${label}`, failures);
  expectPresenterField(caseId, presenter, "mode", "active", `native presenter mode ${label}`, failures);
  expectPresenterField(caseId, presenter, "clickThrough", false, `native presenter click-through ${label}`, failures);
  expectPresenterField(caseId, presenter, "focusable", false, `native presenter focusable ${label}`, failures);
  expectPresenterField(caseId, presenter, "transparent", false, `native presenter transparent ${label}`, failures);
  expectPresenterField(caseId, presenter, "overlayActive", false, `native presenter overlay active ${label}`, failures);
  expectPresenterField(caseId, presenter, "idleFps", 0, `native presenter idle FPS ${label}`, failures);
  expectPresenterField(caseId, presenter, "activeOverlayFps", 30, `native presenter active overlay FPS ${label}`, failures);
  expectPresenterField(caseId, presenter, "currentFps", 30, `native presenter current FPS ${label}`, failures);
  expectPresenterField(caseId, presenter, "overlayNeedsPresent", false, `native presenter overlay needs present ${label}`, failures);
}

function expectClosedWaitPresenter(caseId, presenter, label, failures) {
  expectMacOverlayEnvironmentAvailable(caseId, presenter, label, failures);
  expectMacosNeedsPresentPollingDisabled(caseId, presenter, label, failures);
  expectPresenterField(caseId, presenter, "closed", false, `native presenter closed ${label}`, failures);
  expectPresenterField(caseId, presenter, "attached", true, `native presenter attached ${label}`, failures);
  expectPresenterField(caseId, presenter, "nativeHostOpen", true, `native presenter host open ${label}`, failures);
  expectPresenterField(caseId, presenter, "mode", "passive", `native presenter mode ${label}`, failures);
  expectPresenterField(caseId, presenter, "focusable", false, `native presenter focusable ${label}`, failures);
  expectPresenterField(caseId, presenter, "overlayActive", false, `native presenter overlay active ${label}`, failures);
  expectPresenterField(caseId, presenter, "idleFps", 0, `native presenter idle FPS ${label}`, failures);
}

function expectPassiveNotificationPresenter(caseId, presenter, label, failures) {
  expectMacOverlayEnvironmentAvailable(caseId, presenter, label, failures);
  expectMacosNeedsPresentPollingDisabled(caseId, presenter, label, failures);
  expectPresenterField(caseId, presenter, "closed", false, `native presenter closed ${label}`, failures);
  expectPresenterField(caseId, presenter, "attached", true, `native presenter attached ${label}`, failures);
  expectPresenterField(caseId, presenter, "nativeHostOpen", true, `native presenter host open ${label}`, failures);
  expectPresenterField(caseId, presenter, "mode", "passive", `native presenter mode ${label}`, failures);
  expectPresenterField(caseId, presenter, "clickThrough", true, `native presenter click-through ${label}`, failures);
  expectPresenterField(caseId, presenter, "focusable", false, `native presenter focusable ${label}`, failures);
  expectPresenterField(caseId, presenter, "overlayActive", false, `native presenter overlay active ${label}`, failures);
  expectPresenterField(caseId, presenter, "idleFps", 0, `native presenter idle FPS ${label}`, failures);

  if (presenter.overlayNeedsPresent === true) {
    const expectedFps = Number(presenter.needsPresentFps);
    expect(
      Number(presenter.currentFps) === expectedFps && expectedFps > 0,
      `${caseId}: native presenter current FPS follows needs-present FPS ${label}`,
      failures
    );
    return;
  }

  expectPresenterField(caseId, presenter, "transparent", true, `native presenter transparent ${label}`, failures);
  expectPresenterField(caseId, presenter, "currentFps", 0, `native presenter current FPS ${label}`, failures);
  expectPresenterField(caseId, presenter, "overlayNeedsPresent", false, `native presenter overlay needs present ${label}`, failures);
}

function verifyExpectedActionError(caseId, action, expected, failures) {
  const error = objectOrEmpty(action.error);
  expect(Boolean(action.error && typeof action.error === "object"), `${caseId}: autorun action error is serialized`, failures);
  if (expected.code) {
    expect(
      error.code === expected.code,
      `${caseId}: autorun action error code expected ${formatValue(expected.code)}, got ${formatValue(error.code)}`,
      failures
    );
  }
  if (expected.reason) {
    expect(
      error.reason === expected.reason,
      `${caseId}: autorun action error reason expected ${formatValue(expected.reason)}, got ${formatValue(error.reason)}`,
      failures
    );
  }
  verifyExpectedActionErrorTargetSnapshot(caseId, action, error, failures);
}

function verifyExpectedActionErrorTargetSnapshot(caseId, action, error, failures) {
  const targetSnapshot = objectField(error, "targetSnapshot");
  expect(Boolean(targetSnapshot), `${caseId}: autorun action error includes sanitized targetSnapshot`, failures);
  if (!targetSnapshot) {
    return;
  }

  expectSanitizedOverlayTargetSnapshot(caseId, "autorun action error targetSnapshot", targetSnapshot, failures);

  if (targetSnapshot.type === "checkout" || action.action === "presenter-checkout") {
    const checkoutTargetSnapshot = objectField(error, "checkoutTargetSnapshot");
    expect(
      Boolean(checkoutTargetSnapshot),
      `${caseId}: autorun checkout action error includes sanitized checkoutTargetSnapshot`,
      failures
    );
    if (checkoutTargetSnapshot) {
      expect(
        checkoutTargetSnapshot.type === "checkout",
        `${caseId}: autorun checkout action error checkoutTargetSnapshot type is checkout, got ${formatValue(checkoutTargetSnapshot.type)}`,
        failures
      );
      expectSanitizedOverlayTargetSnapshot(
        caseId,
        "autorun checkout action error checkoutTargetSnapshot",
        checkoutTargetSnapshot,
        failures
      );
    }
  }
}

function verifyNativeHostUnavailablePresenter(caseId, presenter, expectedReason, failures) {
  expectMacosNeedsPresentPollingDisabled(caseId, presenter, "while host unavailable", failures);
  expectPresenterField(caseId, presenter, "closed", false, "native presenter closed while host unavailable", failures);
  expectPresenterField(
    caseId,
    presenter,
    "nativeHostUnavailableReason",
    expectedReason,
    "native host unavailable reason",
    failures
  );
  expectPresenterField(caseId, presenter, "attached", false, "native presenter attached while host unavailable", failures);
  expectPresenterField(caseId, presenter, "nativeHostOpen", false, "native presenter host open while unavailable", failures);
  expectPresenterField(caseId, presenter, "mode", "hidden", "native presenter mode while unavailable", failures);
  expectPresenterField(caseId, presenter, "clickThrough", true, "native presenter click-through while unavailable", failures);
  expectPresenterField(caseId, presenter, "focusable", false, "native presenter focusable while unavailable", failures);
  expectPresenterField(caseId, presenter, "transparent", true, "native presenter transparent while unavailable", failures);
  expectPresenterField(caseId, presenter, "overlayActive", false, "native presenter overlay active while unavailable", failures);
  expectPresenterField(caseId, presenter, "idleFps", 0, "native presenter idle FPS while unavailable", failures);
  expectPresenterField(caseId, presenter, "currentFps", 0, "native presenter current FPS while unavailable", failures);
  expectPresenterField(
    caseId,
    presenter,
    "overlayNeedsPresent",
    false,
    "native presenter overlay needs present while unavailable",
    failures
  );

  const actualEnvironment = objectField(presenter, "macOverlayEnvironment");
  expect(
    macOverlayEnvironmentMatchesReason(actualEnvironment, expectedReason),
    `${caseId}: mac overlay environment matches ${expectedReason}`,
    failures
  );
}

function verifyNativeHostUnavailableAvailability(caseId, availability, expectedReason, failures) {
  expect(Boolean(availability), `${caseId}: native host availability snapshot available`, failures);
  if (!availability || typeof availability !== "object") {
    return;
  }
  expect(availability.available === false, `${caseId}: native host availability reports unavailable`, failures);
  expect(
    availability.code === "STEAM_OVERLAY_NATIVE_HOST_UNAVAILABLE",
    `${caseId}: native host availability error code is STEAM_OVERLAY_NATIVE_HOST_UNAVAILABLE`,
    failures
  );
  expect(
    availability.reason === expectedReason,
    `${caseId}: native host availability reason expected ${formatValue(expectedReason)}, got ${formatValue(availability.reason)}`,
    failures
  );
  expect(
    availability.nativeHostUnavailableReason === expectedReason,
    `${caseId}: native host availability nativeHostUnavailableReason expected ${formatValue(expectedReason)}, got ${formatValue(availability.nativeHostUnavailableReason)}`,
    failures
  );
  expect(
    macOverlayEnvironmentMatchesReason(availability.macOverlayEnvironment, expectedReason),
    `${caseId}: native host availability mac overlay environment matches ${expectedReason}`,
    failures
  );
  const availabilitySnapshot = objectField(availability, "snapshot");
  expect(Boolean(availabilitySnapshot), `${caseId}: native host availability presenter snapshot available`, failures);
  if (availabilitySnapshot) {
    expect(
      availabilitySnapshot.nativeHostUnavailableReason === expectedReason,
      `${caseId}: native host availability presenter reason expected ${formatValue(expectedReason)}, got ${formatValue(availabilitySnapshot.nativeHostUnavailableReason)}`,
      failures
    );
    expect(
      availabilitySnapshot.nativeHostOpen === false,
      `${caseId}: native host availability presenter host is closed`,
      failures
    );
  }
}

function verifyNoOverlayActivation(caseId, resultEvents, lifecycleEntries, failures) {
  const activeEvents = [...resultEvents, ...lifecycleEntries].filter(isOverlayActiveEvent);
  expect(activeEvents.length === 0, `${caseId}: overlay activation callback active=true was not emitted`, failures);
}

function expectedActionErrorFromMetadata(metadata) {
  return {
    code: nonEmptyString(metadata.requireActionErrorCode ?? metadata.expectedActionErrorCode),
    reason: nonEmptyString(metadata.requireActionErrorReason ?? metadata.expectedActionErrorReason)
  };
}

function expectedNativeHostBackendFromMetadata(metadata) {
  const value = nonEmptyString(metadata.expectedNativeHostBackend ?? metadata.nativeHostBackend);
  if (!value) {
    return "";
  }
  if (value === "metal" || value === "opengl") {
    return `macos-${value}`;
  }
  return value;
}

function expectedAppIdFromMetadata(metadata) {
  const value = Number(metadata.expectedAppId ?? metadata.appId ?? 480);
  if (Number.isFinite(value) && value > 0) {
    return value;
  }
  return 480;
}

function checkoutSourceFromMetadata(metadata) {
  const value = nonEmptyString(metadata.checkoutSource);
  if (value) {
    return value;
  }
  const command = Array.isArray(metadata.command) ? metadata.command : [];
  if (commandHasOption(command, "--checkout-json-file")) {
    return "json-file";
  }
  if (commandHasOption(command, "--checkout-url")) {
    return "checkout-url";
  }
  if (commandHasOption(command, "--checkout-transaction-id")) {
    return "transaction-id";
  }
  return "";
}

function commandHasOption(command, option) {
  return command.some((value) => value === option || (typeof value === "string" && value.startsWith(`${option}=`)));
}

function macOverlayEnvironmentMatchesReason(environment, reason) {
  if (!environment || typeof environment !== "object") {
    return false;
  }
  switch (reason) {
    case "macos-screen-locked":
      return environment.screenLocked === true;
    case "macos-display-asleep":
      return environment.screenLocked === false && environment.displayAsleep === true;
    default:
      return true;
  }
}

function expectMacOverlayEnvironmentAvailable(caseId, presenter, label, failures) {
  const environment = objectField(presenter, "macOverlayEnvironment");
  if (!environment) {
    failures.push(`${caseId}: ${label} missing macOS overlay environment`);
    return false;
  }

  expect(
    environment.screenLocked === false,
    `${caseId}: ${label} screen locked expected false, got ${formatValue(environment.screenLocked)}`,
    failures
  );
  expect(
    environment.displayAsleep === false,
    `${caseId}: ${label} display asleep expected false, got ${formatValue(environment.displayAsleep)}`,
    failures
  );
  expect(
    presenter.nativeHostUnavailableReason == null,
    `${caseId}: ${label} native host unavailable reason expected none, got ${formatValue(presenter.nativeHostUnavailableReason)}`,
    failures
  );

  return (
    environment.screenLocked === false &&
    environment.displayAsleep === false &&
    presenter.nativeHostUnavailableReason == null
  );
}

function expectMacosNeedsPresentPollingDisabled(caseId, presenter, label, failures) {
  const values = [];
  if (Object.prototype.hasOwnProperty.call(presenter, "overlayNeedsPresentPollingEnabled")) {
    values.push({ source: "presenter", value: presenter.overlayNeedsPresentPollingEnabled });
  }
  const diagnostics = objectOrEmpty(presenter.diagnostics);
  if (Object.prototype.hasOwnProperty.call(diagnostics, "overlayNeedsPresentPollingEnabled")) {
    values.push({ source: "presenter diagnostics", value: diagnostics.overlayNeedsPresentPollingEnabled });
  }
  for (const entry of values) {
    expect(
      entry.value === false,
      `${caseId}: macOS needs-present polling disabled in ${entry.source} ${label}`,
      failures
    );
  }
  if (values.some((entry) => entry.value === false)) {
    expect(
      presenter.overlayNeedsPresent !== true,
      `${caseId}: native presenter overlay needs present stays false while macOS polling is disabled ${label}`,
      failures
    );
  }
}

function verifyRequiredMacosNeedsPresentPollingDisabled(caseId, steam, nativePresenter, failures) {
  const steamValue = readOkValue(steam.overlayNeedsPresentPollingEnabled);
  expect(
    steamValue === false,
    `${caseId}: Steam needs-present polling disabled expected false, got ${formatValue(steamValue)}`,
    failures
  );

  const presenter = objectOrEmpty(nativePresenter);
  const presenterDiagnostics = objectOrEmpty(presenter.diagnostics);
  const presenterHasValue = Object.prototype.hasOwnProperty.call(presenter, "overlayNeedsPresentPollingEnabled");
  const diagnosticsHasValue = Object.prototype.hasOwnProperty.call(
    presenterDiagnostics,
    "overlayNeedsPresentPollingEnabled"
  );
  expect(
    presenterHasValue || diagnosticsHasValue,
    `${caseId}: native presenter needs-present polling disabled diagnostic present`,
    failures
  );
  if (presenterHasValue) {
    expect(
      presenter.overlayNeedsPresentPollingEnabled === false,
      `${caseId}: native presenter needs-present polling disabled expected false, got ${formatValue(
        presenter.overlayNeedsPresentPollingEnabled
      )}`,
      failures
    );
  }
  if (diagnosticsHasValue) {
    expect(
      presenterDiagnostics.overlayNeedsPresentPollingEnabled === false,
      `${caseId}: native presenter diagnostics needs-present polling disabled expected false, got ${formatValue(
        presenterDiagnostics.overlayNeedsPresentPollingEnabled
      )}`,
      failures
    );
  }
  expect(
    readOkValue(steam.overlayNeedsPresent) !== true,
    `${caseId}: Steam overlay needs present stays false while macOS polling is disabled`,
    failures
  );
  expect(
    presenter.overlayNeedsPresent !== true,
    `${caseId}: native presenter overlay needs present stays false while macOS polling is disabled`,
    failures
  );
}

function expectPresenterField(caseId, presenter, key, expected, label, failures) {
  if (presenter[key] !== expected) {
    failures.push(`${caseId}: ${label} expected ${formatValue(expected)}, got ${formatValue(presenter[key])}`);
  }
}

function runSelfTest() {
  const fixtureRoot = fs.mkdtempSync(path.join(os.tmpdir(), "steam-bridge-macos-matrix-summary."));
  const unredactedFixtureRoot = fs.mkdtempSync(path.join(os.tmpdir(), "steam-bridge-macos-matrix-summary-unredacted."));
  const leakedArtifactFixtureRoot = fs.mkdtempSync(
    path.join(os.tmpdir(), "steam-bridge-macos-matrix-summary-leaked-artifact.")
  );
  const crashFixtureRoot = fs.mkdtempSync(path.join(os.tmpdir(), "steam-bridge-macos-matrix-summary-crash."));
  const metalCrashFixtureRoot = fs.mkdtempSync(path.join(os.tmpdir(), "steam-bridge-macos-matrix-summary-metal-crash."));
  const missingMicroTxnFixtureRoot = fs.mkdtempSync(
    path.join(os.tmpdir(), "steam-bridge-macos-matrix-summary-missing-microtxn.")
  );
  const missingCheckoutErrorSnapshotFixtureRoot = fs.mkdtempSync(
    path.join(os.tmpdir(), "steam-bridge-macos-matrix-summary-missing-checkout-error-snapshot.")
  );
  const missingWebVisibilityFixtureRoot = fs.mkdtempSync(
    path.join(os.tmpdir(), "steam-bridge-macos-matrix-summary-missing-web-visible.")
  );
  const missingNeedsPresentPollingFixtureRoot = fs.mkdtempSync(
    path.join(os.tmpdir(), "steam-bridge-macos-matrix-summary-missing-needs-present-polling.")
  );
  const missingNamedStatusFixtureRoot = fs.mkdtempSync(
    path.join(os.tmpdir(), "steam-bridge-macos-matrix-summary-missing-named-status.")
  );
  const missingNamedIfAvailableFixtureRoot = fs.mkdtempSync(
    path.join(os.tmpdir(), "steam-bridge-macos-matrix-summary-missing-named-if-available.")
  );
  const missingNamedAndWaitIfAvailableFixtureRoot = fs.mkdtempSync(
    path.join(os.tmpdir(), "steam-bridge-macos-matrix-summary-missing-named-and-wait-if-available.")
  );
  const missingOpenStatusSnapshotFixtureRoot = fs.mkdtempSync(
    path.join(os.tmpdir(), "steam-bridge-macos-matrix-summary-missing-open-status-snapshot.")
  );
  const missingCheckoutOperationStatusSnapshotFixtureRoot = fs.mkdtempSync(
    path.join(os.tmpdir(), "steam-bridge-macos-matrix-summary-missing-checkout-operation-status-snapshot.")
  );
  const persistentFixtureRoot = fs.mkdtempSync(path.join(os.tmpdir(), "steam-bridge-macos-matrix-summary-persistent."));
  try {
    createSelfTestFixture(fixtureRoot);
    const summary = summarizeMatrixArtifacts(fixtureRoot);
    assert.equal(summary.caseSummaries.length, 15, "summary self-test should include fifteen cases");
    assert(
      summary.caseSummaries.every((item) => item.closed !== true || item.parked !== true || item.idleStable === true),
      "summary self-test should report stable idle presenters for closed active-overlay cases"
    );
    assert(
      summary.caseSummaries.every((item) => item.checkoutOperation === true),
      "summary self-test should report checkout operation preflight proof"
    );
    createPersistentSelfTestFixture(persistentFixtureRoot);
    const persistentSummary = summarizeMatrixArtifacts(persistentFixtureRoot);
    assert.equal(persistentSummary.caseSummaries.length, 2, "persistent summary self-test should include two cases");
    assert(
      persistentSummary.caseSummaries.every(
        (item) => item.closed !== true || item.parked !== true || item.idleStable === true
      ),
      "persistent summary self-test should report stable idle presenters for closed active-overlay cases"
    );
    assert(
      persistentSummary.caseSummaries.every((item) => item.checkoutOperation === true),
      "persistent summary self-test should report checkout operation preflight proof"
    );
    assertSuiteCoverageSelfTest();
    createSelfTestFixture(unredactedFixtureRoot);
    injectUnredactedCheckoutManifestCommand(unredactedFixtureRoot);
    assertUnredactedManifestRejected(unredactedFixtureRoot);
    createSelfTestFixture(leakedArtifactFixtureRoot);
    injectUnredactedCheckoutLifecycleValue(leakedArtifactFixtureRoot, "06-checkout");
    assertUnredactedArtifactRejected(leakedArtifactFixtureRoot);
    createSelfTestFixture(crashFixtureRoot);
    injectMacosCrashReport(crashFixtureRoot, "01-web-openwait");
    assertMacosCrashReportRejected(crashFixtureRoot);
    createSelfTestFixture(metalCrashFixtureRoot);
    injectMacosMetalCompilerCrashReport(metalCrashFixtureRoot, "01-web-openwait");
    assertMacosMetalCompilerCrashReportRejected(metalCrashFixtureRoot);
    createSelfTestFixture(missingMicroTxnFixtureRoot);
    injectMicroTxnCallbackRequirement(missingMicroTxnFixtureRoot, "01-web-openwait");
    assertMissingMicroTxnCallbackRejected(missingMicroTxnFixtureRoot);
    createSelfTestFixture(missingCheckoutErrorSnapshotFixtureRoot);
    removeCheckoutActionErrorSnapshot(missingCheckoutErrorSnapshotFixtureRoot, "07c-checkout-unavailable");
    assertMissingCheckoutActionErrorSnapshotRejected(missingCheckoutErrorSnapshotFixtureRoot);
    createSelfTestFixture(missingWebVisibilityFixtureRoot);
    removeWebVisibilityProof(missingWebVisibilityFixtureRoot, "01-web-openwait");
    assertMissingWebVisibilityProofRejected(missingWebVisibilityFixtureRoot);
    createSelfTestFixture(missingNeedsPresentPollingFixtureRoot);
    removeMacosNeedsPresentPollingProof(missingNeedsPresentPollingFixtureRoot, "01-web-openwait");
    assertMissingNeedsPresentPollingProofRejected(missingNeedsPresentPollingFixtureRoot);
    createSelfTestFixture(missingNamedStatusFixtureRoot);
    removeDuplicateOpenNamedStatusProof(missingNamedStatusFixtureRoot, "01b-duplicate-open-guard");
    assertMissingDuplicateOpenNamedStatusRejected(missingNamedStatusFixtureRoot);
    createSelfTestFixture(missingNamedIfAvailableFixtureRoot);
    removeDuplicateOpenNamedIfAvailableProof(
      missingNamedIfAvailableFixtureRoot,
      "01b-duplicate-open-guard",
      "namedIfAvailableNulls"
    );
    assertMissingDuplicateOpenNamedIfAvailableRejected(missingNamedIfAvailableFixtureRoot, "openWebIfAvailable");
    createSelfTestFixture(missingNamedAndWaitIfAvailableFixtureRoot);
    removeDuplicateOpenNamedIfAvailableProof(
      missingNamedAndWaitIfAvailableFixtureRoot,
      "01b-duplicate-open-guard",
      "namedAndWaitIfAvailableNulls"
    );
    assertMissingDuplicateOpenNamedIfAvailableRejected(
      missingNamedAndWaitIfAvailableFixtureRoot,
      "openWebAndWaitIfAvailable"
    );
    createSelfTestFixture(missingOpenStatusSnapshotFixtureRoot);
    removeOpenStatusSnapshotProof(missingOpenStatusSnapshotFixtureRoot, "01-web-openwait");
    assertMissingOpenStatusSnapshotRejected(missingOpenStatusSnapshotFixtureRoot);
    createSelfTestFixture(missingCheckoutOperationStatusSnapshotFixtureRoot);
    removeCheckoutOperationStatusSnapshotProof(missingCheckoutOperationStatusSnapshotFixtureRoot, "01-web-openwait");
    assertMissingCheckoutOperationStatusSnapshotRejected(missingCheckoutOperationStatusSnapshotFixtureRoot);
    console.log("macOS overlay matrix summary self-test passed.");
  } finally {
    fs.rmSync(fixtureRoot, { recursive: true, force: true });
    fs.rmSync(unredactedFixtureRoot, { recursive: true, force: true });
    fs.rmSync(leakedArtifactFixtureRoot, { recursive: true, force: true });
    fs.rmSync(crashFixtureRoot, { recursive: true, force: true });
    fs.rmSync(metalCrashFixtureRoot, { recursive: true, force: true });
    fs.rmSync(missingMicroTxnFixtureRoot, { recursive: true, force: true });
    fs.rmSync(missingCheckoutErrorSnapshotFixtureRoot, { recursive: true, force: true });
    fs.rmSync(missingWebVisibilityFixtureRoot, { recursive: true, force: true });
    fs.rmSync(missingNeedsPresentPollingFixtureRoot, { recursive: true, force: true });
    fs.rmSync(missingNamedStatusFixtureRoot, { recursive: true, force: true });
    fs.rmSync(missingOpenStatusSnapshotFixtureRoot, { recursive: true, force: true });
    fs.rmSync(missingCheckoutOperationStatusSnapshotFixtureRoot, { recursive: true, force: true });
    fs.rmSync(persistentFixtureRoot, { recursive: true, force: true });
  }
}

function assertSuiteCoverageSelfTest() {
  const completeCheckoutFailures = [];
  verifySuiteCoverage(
    CHECKOUT_SUITE_REQUIRED_CASE_IDS.map((caseId) => ({ suite: "checkout", caseId })),
    completeCheckoutFailures
  );
  assert.deepEqual(completeCheckoutFailures, [], "complete checkout suite coverage should pass");

  const missingCheckoutFailures = [];
  verifySuiteCoverage(
    CHECKOUT_SUITE_REQUIRED_CASE_IDS.slice(0, -1).map((caseId) => ({ suite: "checkout", caseId })),
    missingCheckoutFailures
  );
  assert.match(
    missingCheckoutFailures.join("\n"),
    /checkout macOS matrix missing required case 04-shortcut-checkout-openwait/,
    "checkout suite coverage should reject missing programmatic checkout proof"
  );

  const coreFailures = [];
  verifySuiteCoverage(
    CORE_SUITE_REQUIRED_CASE_IDS.map((caseId) => ({ suite: "core", caseId })),
    coreFailures
  );
  assert.deepEqual(coreFailures, [], "complete core suite coverage should pass");

  const missingCoreFailures = [];
  verifySuiteCoverage(
    CORE_SUITE_REQUIRED_CASE_IDS.filter((caseId) => caseId !== "11-shortcut-checkout").map((caseId) => ({
      suite: "core",
      caseId
    })),
    missingCoreFailures
  );
  assert.match(
    missingCoreFailures.join("\n"),
    /core macOS matrix missing required case 11-shortcut-checkout/,
    "core suite coverage should reject missing checkout shortcut proof"
  );

  const persistentFailures = [];
  verifySuiteCoverage(
    PERSISTENT_SUITE_REQUIRED_CASE_IDS.map((caseId) => ({ suite: "persistent", caseId })),
    persistentFailures
  );
  assert.deepEqual(persistentFailures, [], "complete persistent suite coverage should pass");

  const unavailableFailures = [];
  verifySuiteCoverage(
    UNAVAILABLE_SUITE_REQUIRED_CASE_IDS.map((caseId) => ({ suite: "unavailable", caseId })),
    unavailableFailures
  );
  assert.deepEqual(unavailableFailures, [], "complete unavailable suite coverage should pass");

  const mixedSuiteFailures = [];
  verifySuiteCoverage(
    [
      { suite: "full", caseId: "00-presenter-ready" },
      { suite: "persistent", caseId: "00-persistent-presenter-ready" }
    ],
    mixedSuiteFailures
  );
  assert.match(
    mixedSuiteFailures.join("\n"),
    /macOS matrix manifest mixes suite metadata: full, persistent/,
    "suite coverage should reject mixed suite metadata"
  );

  const partialSuiteFailures = [];
  verifySuiteCoverage(
    [
      { suite: "checkout", caseId: "01-checkout-prepare" },
      { caseId: "02-checkout-approval" }
    ],
    partialSuiteFailures
  );
  assert.match(
    partialSuiteFailures.join("\n"),
    /macOS matrix manifest has partial suite metadata/,
    "suite coverage should reject partial suite metadata"
  );
}

function injectUnredactedCheckoutManifestCommand(root) {
  const manifestPath = path.join(root, "macos-matrix-cases.jsonl");
  const rows = fs
    .readFileSync(manifestPath, "utf8")
    .trim()
    .split(/\r?\n/)
    .map((line) => JSON.parse(line));
  for (const row of rows) {
    if (row.caseId === "06-checkout") {
      row.command = ["--action", "presenter-checkout", "--checkout-json-file", "/tmp/private-init-txn-response.json"];
      row.checkoutSource = "json-file";
    }
  }
  fs.writeFileSync(manifestPath, rows.map((row) => JSON.stringify(row)).join("\n") + "\n");
}

function assertUnredactedManifestRejected(root) {
  const result = spawnSync(process.execPath, [__filename, "--artifact-root", root], {
    encoding: "utf8"
  });
  assert.notEqual(result.status, 0, "summary should reject unredacted sensitive manifest values");
  assert.match(
    result.stderr,
    /unredacted sensitive manifest option --checkout-json-file/,
    "summary rejection should identify the unredacted checkout JSON option"
  );
}

function injectUnredactedCheckoutLifecycleValue(root, caseId) {
  const row = readManifestRows(root).find((entry) => entry.caseId === caseId);
  assert.ok(row, `self-test fixture should include ${caseId}`);
  const lifecyclePath = path.join(row.diagnosticDir, "lifecycle.jsonl");
  const leakedEntry = {
    type: "event:callback:microtxn",
    payload: {
      transactionId: "123456789",
      checkoutUrl: "https://checkout.steampowered.com/checkout/approvetxn/123456789/",
      presenter: activePresenterFixture(31)
    }
  };
  fs.appendFileSync(lifecyclePath, `${JSON.stringify(leakedEntry)}\n`);
}

function assertUnredactedArtifactRejected(root) {
  const result = spawnSync(process.execPath, [__filename, "--artifact-root", root], {
    encoding: "utf8"
  });
  assert.notEqual(result.status, 0, "summary should reject unredacted sensitive result or lifecycle values");
  assert.match(
    result.stderr,
    /lifecycle contains raw sensitive field lifecycle\[\d+\]\.payload\.transactionId/,
    "summary rejection should identify the raw transaction ID field path"
  );
  assert.doesNotMatch(
    result.stderr,
    /123456789|approvetxn/,
    "summary rejection must not echo leaked checkout values"
  );
}

function injectMacosCrashReport(root, caseId) {
  const manifestPath = path.join(root, "macos-matrix-cases.jsonl");
  const rows = fs
    .readFileSync(manifestPath, "utf8")
    .trim()
    .split(/\r?\n/)
    .map((line) => JSON.parse(line));
  const row = rows.find((entry) => entry.caseId === caseId);
  assert.ok(row, `self-test fixture should include ${caseId}`);
  const crashReportDir = path.join(row.diagnosticDir, "macos-crash-reports");
  fs.mkdirSync(crashReportDir, { recursive: true });
  fs.writeFileSync(
    path.join(crashReportDir, "SteamBridgeSmoke.electron-2099-01-01-000000.ips"),
    [
      '{"app_name":"SteamBridgeSmoke.electron","timestamp":"2099-01-01 00:00:00.00 -0700","name":"SteamBridgeSmoke.electron"}',
      '{"exception":{"type":"EXC_BAD_ACCESS","signal":"SIGSEGV"},"threads":[{"frames":[{"symbol":"BOverlayNeedsPresent"},{"symbol":"steam_bridge_native::overlay_needs_present_c_callback"}]}]}'
    ].join("\n")
  );
}

function assertMacosCrashReportRejected(root) {
  const result = spawnSync(process.execPath, [__filename, "--artifact-root", root], {
    encoding: "utf8"
  });
  assert.notEqual(result.status, 0, "summary should reject copied macOS crash reports");
  assert.match(
    result.stderr,
    /macOS crash report found: macos-crash-reports\/SteamBridgeSmoke\.electron-2099-01-01-000000\.ips/,
    "summary rejection should identify the copied macOS crash report"
  );
  assert.match(
    result.stderr,
    /BOverlayNeedsPresent/,
    "summary rejection should include the crash top symbol"
  );
}

function injectMacosMetalCompilerCrashReport(root, caseId) {
  const manifestPath = path.join(root, "macos-matrix-cases.jsonl");
  const rows = fs
    .readFileSync(manifestPath, "utf8")
    .trim()
    .split(/\r?\n/)
    .map((line) => JSON.parse(line));
  const row = rows.find((entry) => entry.caseId === caseId);
  assert.ok(row, `self-test fixture should include ${caseId}`);
  const crashReportDir = path.join(row.diagnosticDir, "macos-crash-reports");
  fs.mkdirSync(crashReportDir, { recursive: true });
  fs.writeFileSync(
    path.join(crashReportDir, "MTLCompilerService-2099-01-01-000000.ips"),
    [
      '{"app_name":"MTLCompilerService","timestamp":"2099-01-01 00:00:00.00 -0700","name":"MTLCompilerService"}',
      '{"procName":"MTLCompilerService","responsibleProc":"SteamBridgeSmoke.electron","exception":{"type":"EXC_CRASH","signal":"SIGABRT"},"threads":[{"frames":[{"symbol":"__abort_with_payload"}]}]}'
    ].join("\n")
  );
}

function assertMacosMetalCompilerCrashReportRejected(root) {
  const result = spawnSync(process.execPath, [__filename, "--artifact-root", root], {
    encoding: "utf8"
  });
  assert.notEqual(result.status, 0, "summary should reject attributed macOS Metal compiler crash reports");
  assert.match(
    result.stderr,
    /macOS crash report found: macos-crash-reports\/MTLCompilerService-2099-01-01-000000\.ips/,
    "summary rejection should identify the copied Metal compiler crash report"
  );
  assert.match(
    result.stderr,
    /responsible="SteamBridgeSmoke\.electron"/,
    "summary rejection should include the responsible smoke process"
  );
}

function injectMicroTxnCallbackRequirement(root, caseId) {
  const manifestPath = path.join(root, "macos-matrix-cases.jsonl");
  const rows = fs
    .readFileSync(manifestPath, "utf8")
    .trim()
    .split(/\r?\n/)
    .map((line) => JSON.parse(line));
  const row = rows.find((entry) => entry.caseId === caseId);
  assert.ok(row, `self-test fixture should include ${caseId}`);
  row.requireMicroTxnCallback = true;
  fs.writeFileSync(manifestPath, rows.map((entry) => JSON.stringify(entry)).join("\n") + "\n");
}

function assertMissingMicroTxnCallbackRejected(root) {
  const result = spawnSync(process.execPath, [__filename, "--artifact-root", root], {
    encoding: "utf8"
  });
  assert.notEqual(result.status, 0, "summary should reject missing required MicroTxn callbacks");
  assert.match(
    result.stderr,
    /required MicroTxnAuthorizationResponse callback was not recorded/,
    "summary rejection should identify the missing MicroTxn callback"
  );
}

function removeCheckoutActionErrorSnapshot(root, caseId) {
  const manifestPath = path.join(root, "macos-matrix-cases.jsonl");
  const rows = fs
    .readFileSync(manifestPath, "utf8")
    .trim()
    .split(/\r?\n/)
    .map((line) => JSON.parse(line));
  const row = rows.find((entry) => entry.caseId === caseId);
  assert.ok(row, `self-test fixture should include ${caseId}`);
  const resultLine = fs
    .readFileSync(row.resultFile, "utf8")
    .split(/\r?\n/)
    .find((line) => line.startsWith(RESULT_PREFIX));
  assert.ok(resultLine, `self-test fixture should include a result line for ${caseId}`);
  const result = JSON.parse(resultLine.slice(RESULT_PREFIX.length));
  delete result.action.error.checkoutTargetSnapshot;
  fs.writeFileSync(row.resultFile, `${RESULT_PREFIX}${JSON.stringify(result)}\n`);
}

function assertMissingCheckoutActionErrorSnapshotRejected(root) {
  const result = spawnSync(process.execPath, [__filename, "--artifact-root", root], {
    encoding: "utf8"
  });
  assert.notEqual(result.status, 0, "summary should reject missing checkout action error snapshots");
  assert.match(
    result.stderr,
    /autorun checkout action error includes sanitized checkoutTargetSnapshot/,
    "summary rejection should identify the missing checkout action error snapshot"
  );
}

function readManifestRows(root) {
  const manifestPath = path.join(root, "macos-matrix-cases.jsonl");
  return fs
    .readFileSync(manifestPath, "utf8")
    .trim()
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

function removeWebVisibilityProof(root, caseId) {
  const row = readManifestRows(root).find((entry) => entry.caseId === caseId);
  assert.ok(row, `self-test fixture missing manifest row ${caseId}`);
  const lifecyclePath = path.join(row.diagnosticDir, "lifecycle.jsonl");
  const filtered = fs
    .readFileSync(lifecyclePath, "utf8")
    .split(/\r?\n/)
    .filter((line) => line.trim() && !line.includes('"type":"event:overlay:web-visible"'));
  fs.writeFileSync(lifecyclePath, `${filtered.join("\n")}\n`);
}

function assertMissingWebVisibilityProofRejected(root) {
  const result = spawnSync(process.execPath, [__filename, "--artifact-root", root], {
    encoding: "utf8"
  });
  assert.notEqual(result.status, 0, "summary should reject missing macOS web visibility proof");
  assert.match(
    result.stderr,
    /no macOS web overlay visibility event before web close probe/,
    "summary rejection should identify missing web visibility proof"
  );
}

function removeMacosNeedsPresentPollingProof(root, caseId) {
  const manifestPath = path.join(root, "macos-matrix-cases.jsonl");
  const rows = fs
    .readFileSync(manifestPath, "utf8")
    .trim()
    .split(/\r?\n/)
    .map((line) => JSON.parse(line));
  const row = rows.find((entry) => entry.caseId === caseId);
  assert.ok(row, `self-test fixture should include ${caseId}`);
  const resultLine = fs
    .readFileSync(row.resultFile, "utf8")
    .split(/\r?\n/)
    .find((line) => line.startsWith(RESULT_PREFIX));
  assert.ok(resultLine, `self-test fixture should include a result line for ${caseId}`);
  const result = JSON.parse(resultLine.slice(RESULT_PREFIX.length));
  delete result.snapshot.steam.overlayNeedsPresentPollingEnabled;
  const presenter = result.snapshot.overlay.nativePresenter.value;
  delete presenter.overlayNeedsPresentPollingEnabled;
  if (presenter.diagnostics) {
    delete presenter.diagnostics.overlayNeedsPresentPollingEnabled;
  }
  fs.writeFileSync(row.resultFile, `${RESULT_PREFIX}${JSON.stringify(result)}\n`);
}

function assertMissingNeedsPresentPollingProofRejected(root) {
  const result = spawnSync(process.execPath, [__filename, "--artifact-root", root], {
    encoding: "utf8"
  });
  assert.notEqual(result.status, 0, "summary should reject missing macOS needs-present polling proof");
  assert.match(
    result.stderr,
    /Steam needs-present polling disabled expected false/,
    "summary rejection should identify missing Steam needs-present polling proof"
  );
  assert.match(
    result.stderr,
    /native presenter needs-present polling disabled diagnostic present/,
    "summary rejection should identify missing presenter needs-present polling proof"
  );
}

function removeDuplicateOpenNamedStatusProof(root, caseId) {
  const row = readManifestRows(root).find((entry) => entry.caseId === caseId);
  assert.ok(row, `self-test fixture missing manifest row ${caseId}`);
  const lifecyclePath = path.join(row.diagnosticDir, "lifecycle.jsonl");
  const lines = fs
    .readFileSync(lifecyclePath, "utf8")
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => JSON.parse(line));
  for (const entry of lines) {
    if (entry.type === "event:overlay:presenter-duplicate-open-guard") {
      delete entry.payload.namedStatuses;
    }
  }
  fs.writeFileSync(lifecyclePath, `${lines.map((entry) => JSON.stringify(entry)).join("\n")}\n`);
}

function assertMissingDuplicateOpenNamedStatusRejected(root) {
  const result = spawnSync(process.execPath, [__filename, "--artifact-root", root], {
    encoding: "utf8"
  });
  assert.notEqual(result.status, 0, "summary should reject missing duplicate-open named status proof");
  assert.match(
    result.stderr,
    /duplicate guard named web status rejects open/,
    "summary rejection should identify missing named status proof"
  );
}

function removeDuplicateOpenNamedIfAvailableProof(root, caseId, field) {
  const row = readManifestRows(root).find((entry) => entry.caseId === caseId);
  assert.ok(row, `self-test fixture missing manifest row ${caseId}`);
  const lifecyclePath = path.join(row.diagnosticDir, "lifecycle.jsonl");
  const lines = fs
    .readFileSync(lifecyclePath, "utf8")
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => JSON.parse(line));
  for (const entry of lines) {
    if (entry.type === "event:overlay:presenter-duplicate-open-guard") {
      delete entry.payload[field];
    }
  }
  fs.writeFileSync(lifecyclePath, `${lines.map((entry) => JSON.stringify(entry)).join("\n")}\n`);
}

function assertMissingDuplicateOpenNamedIfAvailableRejected(root, helperName) {
  const result = spawnSync(process.execPath, [__filename, "--artifact-root", root], {
    encoding: "utf8"
  });
  assert.notEqual(result.status, 0, "summary should reject missing duplicate-open named IfAvailable proof");
  assert.match(
    result.stderr,
    new RegExp(`${helperName} returned null while busy`),
    "summary rejection should identify missing named IfAvailable proof"
  );
}

function removeOpenStatusSnapshotProof(root, caseId) {
  const row = readManifestRows(root).find((entry) => entry.caseId === caseId);
  assert.ok(row, `self-test fixture missing manifest row ${caseId}`);
  const resultLine = fs
    .readFileSync(row.resultFile, "utf8")
    .split(/\r?\n/)
    .find((line) => line.startsWith(RESULT_PREFIX));
  assert.ok(resultLine, `self-test fixture should include a result line for ${caseId}`);
  const result = JSON.parse(resultLine.slice(RESULT_PREFIX.length));
  delete result.snapshot.overlay.openStatuses;
  fs.writeFileSync(row.resultFile, `${RESULT_PREFIX}${JSON.stringify(result)}\n`);
}

function assertMissingOpenStatusSnapshotRejected(root) {
  const result = spawnSync(process.execPath, [__filename, "--artifact-root", root], {
    encoding: "utf8"
  });
  assert.notEqual(result.status, 0, "summary should reject missing named open status snapshots");
  assert.match(
    result.stderr,
    /named open status snapshot read ok/,
    "summary rejection should identify missing named open status snapshot proof"
  );
}

function removeCheckoutOperationStatusSnapshotProof(root, caseId) {
  const row = readManifestRows(root).find((entry) => entry.caseId === caseId);
  assert.ok(row, `self-test fixture missing manifest row ${caseId}`);
  const resultLine = fs
    .readFileSync(row.resultFile, "utf8")
    .split(/\r?\n/)
    .find((line) => line.startsWith(RESULT_PREFIX));
  assert.ok(resultLine, `self-test fixture should include a result line for ${caseId}`);
  const result = JSON.parse(resultLine.slice(RESULT_PREFIX.length));
  delete result.snapshot.overlay.openStatuses.value.checkoutOperation;
  fs.writeFileSync(row.resultFile, `${RESULT_PREFIX}${JSON.stringify(result)}\n`);
}

function assertMissingCheckoutOperationStatusSnapshotRejected(root) {
  const result = spawnSync(process.execPath, [__filename, "--artifact-root", root], {
    encoding: "utf8"
  });
  assert.notEqual(result.status, 0, "summary should reject missing checkout operation status snapshot");
  assert.match(
    result.stderr,
    /named checkoutOperation open status read ok/,
    "summary rejection should identify missing checkout operation status proof"
  );
}

function createSelfTestFixture(root) {
  fs.mkdirSync(root, { recursive: true });

  const basePresenter = activePresenterFixture(10);
  const baseResult = {
    ok: true,
    action: { ok: true, action: "presenter-web-open-and-wait" },
    snapshot: {
      app: { appId: 480 },
      process: { pid: 4242, platform: "darwin", arch: "arm64" },
      launch: {
        steamLaunch: true,
        overlayInjection: true,
        env: { SteamAppId: "480", SteamGameId: "480", SteamOverlayGameId: "480" }
      },
      crashDiagnostics: { available: true, ok: true, crashDumps: [], fatalLifecycleEvents: [] },
      overlayProcesses: {
        available: true,
        platform: "darwin",
        gameoverlayui: [{ pid: 9001, targetPid: 4242, gameId: "480" }]
      },
      steam: {
        initialized: true,
        running: { ok: true, value: true },
        appId: { ok: true, value: 480 },
        steamDeck: { ok: true, value: false },
        bigPicture: { ok: true, value: false },
        overlayEnabled: { ok: true, value: true },
        overlayNeedsPresent: { ok: true, value: false },
        overlayNeedsPresentPollingEnabled: { ok: true, value: false }
      },
      overlay: {
        nativePresenter: { ok: true, value: basePresenter },
        nativeHostAvailability: { ok: true, value: nativeHostAvailabilityFixture(basePresenter) },
        openStatuses: namedOpenStatusesFixture()
      }
    }
  };

  const cases = [
    {
      caseId: "00-presenter-ready",
      action: "presenter-ready",
      resultPresenter: parkedPresenterFixture(4),
      overlayTargets: [overlayProcessFixture(9001)],
      requireNoOverlayActivation: true,
      command: [
        "--action",
        "presenter-ready",
        "--require-event",
        "overlay:presenter-ready",
        "--require-no-overlay-activation"
      ],
      lifecycle: [
        {
          type: "event:overlay:presenter-ready",
          payload: {
            presenter: parkedPresenterFixture(4),
            nativeHostAvailability: nativeHostAvailabilityFixture(parkedPresenterFixture(4))
          }
        }
      ]
    },
    {
      caseId: "01-web-openwait",
      action: "presenter-web-open-and-wait",
      closeInput: "web",
      command: ["--action", "presenter-web-open-and-wait", "--close-probe", "--close-input", "web"],
      resultPresenter: activePresenterFixture(10),
      lifecycle: [
        { type: "event:overlay:presenter-open-and-wait-start", payload: { presenter: activePresenterFixture(10) } },
        { type: "event:callback:overlay-activated", payload: { active: true, appId: 480, overlayPid: 9001 } },
        { type: "event:overlay:presenter-wait-shown", payload: { presenter: activePresenterFixture(11) } },
        { type: "event:overlay:web-visible", payload: { ok: true, attempt: 1, rect: "0,0,1280,720" } },
        { type: "event:callback:overlay-activated", payload: { active: false, appId: 480, overlayPid: 9001 } },
        { type: "event:overlay:presenter-wait-closed", payload: { presenter: parkedPresenterFixture(12) } },
        { type: "event:overlay:presenter-after-close", payload: { presenter: parkedPresenterFixture(12) } },
        { type: "event:overlay:presenter-parked", payload: { presenter: parkedPresenterFixture(12) } },
        {
          type: "event:overlay:presenter-open-and-wait-complete",
          payload: { shown: activePresenterFixture(11), parked: parkedPresenterFixture(12) }
        },
        { type: "event:overlay:presenter-after-close-stable", payload: { presenter: parkedPresenterFixture(12) } }
      ]
    },
    {
      caseId: "01b-duplicate-open-guard",
      action: "presenter-duplicate-open-guard",
      closeInput: "web",
      command: [
        "--action",
        "presenter-duplicate-open-guard",
        "--require-event",
        "overlay:presenter-duplicate-open-guard",
        "--close-probe",
        "--close-input",
        "web"
      ],
      resultPresenter: activePresenterFixture(17),
      lifecycle: [
        { type: "event:overlay:presenter-open-and-wait-start", payload: { presenter: activePresenterFixture(17) } },
        {
          type: "event:overlay:presenter-duplicate-open-guard",
          payload: {
            status: {
              canOpen: false,
              canWait: false,
              reason: "opening",
              waitReason: "opening"
            },
            namedStatuses: duplicateOpenNamedBusyStatusesFixture(),
            namedIfAvailableNulls: duplicateOpenNamedNullsFixture(),
            namedAndWaitIfAvailableNulls: duplicateOpenNamedNullsFixture(),
            shortcutStatus: {
              canOpen: false,
              canWait: false,
              reason: "opening",
              waitReason: "opening"
            },
            openIfAvailableNull: true,
            openAndWaitIfAvailableNull: true,
            shortcutIfAvailableNull: true,
            shortcutAndWaitIfAvailableNull: true,
            checkoutOpenIfAvailableNull: true,
            checkoutIfAvailableNull: true,
            checkoutOperationRan: false,
            presenter: activePresenterFixture(17)
          }
        },
        { type: "event:callback:overlay-activated", payload: { active: true, appId: 480, overlayPid: 9001 } },
        { type: "event:overlay:presenter-wait-shown", payload: { presenter: activePresenterFixture(18) } },
        { type: "event:overlay:web-visible", payload: { ok: true, attempt: 1, rect: "0,0,1280,720" } },
        { type: "event:callback:overlay-activated", payload: { active: false, appId: 480, overlayPid: 9001 } },
        { type: "event:overlay:presenter-wait-closed", payload: { presenter: parkedPresenterFixture(19) } },
        { type: "event:overlay:presenter-after-close", payload: { presenter: parkedPresenterFixture(19) } },
        { type: "event:overlay:presenter-parked", payload: { presenter: parkedPresenterFixture(19) } },
        {
          type: "event:overlay:presenter-open-and-wait-complete",
          payload: { shown: activePresenterFixture(18), parked: parkedPresenterFixture(19) }
        },
        { type: "event:overlay:presenter-after-close-stable", payload: { presenter: parkedPresenterFixture(19) } }
      ]
    },
    {
      caseId: "02-passive-toast",
      action: "presenter-achievement-progress",
      resultPresenter: passiveNotificationPresenterFixture(3),
      lifecycle: [
        { type: "event:achievement:progress", payload: { indicated: true, presenter: parkedPresenterFixture(2) } },
        { type: "event:callback:achievement-stored", payload: { achievement: "ACH_TEST" } }
      ]
    },
    {
      caseId: "03-store-openwait",
      action: "presenter-store-open-and-wait",
      closeInput: "web",
      command: ["--action", "presenter-store-open-and-wait", "--close-probe", "--close-input", "web"],
      overlayGameId: "15338446133907161088",
      expectedNativeHostBackend: "macos-opengl",
      resultPresenter: activePresenterFixture(14, "macos-opengl"),
      lifecycle: [
        { type: "event:overlay:presenter-open-and-wait-start", payload: { presenter: activePresenterFixture(14, "macos-opengl") } },
        { type: "event:callback:overlay-activated", payload: { active: true, appId: 480, overlayPid: 9001 } },
        { type: "event:overlay:presenter-wait-shown", payload: { presenter: activePresenterFixture(15, "macos-opengl") } },
        { type: "event:overlay:web-visible", payload: { ok: true, attempt: 1, rect: "0,0,1280,720" } },
        { type: "event:callback:overlay-activated", payload: { active: false, appId: 480, overlayPid: 9001 } },
        { type: "event:overlay:presenter-wait-closed", payload: { presenter: parkedPresenterFixture(16, "macos-opengl") } },
        { type: "event:overlay:presenter-after-close", payload: { presenter: parkedPresenterFixture(16, "macos-opengl") } },
        { type: "event:overlay:presenter-parked", payload: { presenter: parkedPresenterFixture(16, "macos-opengl") } },
        {
          type: "event:overlay:presenter-open-and-wait-complete",
          payload: { shown: activePresenterFixture(15, "macos-opengl"), parked: parkedPresenterFixture(16, "macos-opengl") }
        },
        { type: "event:overlay:presenter-after-close-stable", payload: { presenter: parkedPresenterFixture(16, "macos-opengl") } }
      ]
    },
    {
      caseId: "04-shortcut-checkout",
      action: "presenter-shortcut",
      shortcutTarget: "checkout",
      checkoutSource: "json-file",
      command: [
        "--action",
        "presenter-shortcut",
        "--shortcut-target",
        "checkout",
        "--checkout-json-file",
        REDACTED_COMMAND_VALUE
      ],
      resultPresenter: withShortcutTargetSnapshot(parkedPresenterFixture(1), "function"),
      lifecycle: [
        {
          type: "event:overlay:shortcut-open",
          payload: {
            target: "checkout",
            overlayTarget: {
              type: "checkout",
              transactionId: { redacted: true, present: true, type: "string" }
            }
          }
        },
        { type: "event:callback:overlay-activated", payload: { active: true, appId: 480, overlayPid: 9001 } },
        { type: "event:overlay:presenter-wait-shown", payload: { presenter: activePresenterFixture(20) } },
        { type: "event:callback:overlay-activated", payload: { active: false, appId: 480, overlayPid: 9001 } },
        { type: "event:overlay:presenter-wait-closed", payload: { presenter: parkedPresenterFixture(21) } },
        { type: "event:overlay:presenter-after-close", payload: { presenter: parkedPresenterFixture(21) } },
        { type: "event:overlay:presenter-parked", payload: { presenter: parkedPresenterFixture(21) } },
        { type: "event:overlay:presenter-after-close-stable", payload: { presenter: parkedPresenterFixture(21) } }
      ]
    },
    {
      caseId: "05-shortcut-web-openwait",
      action: "presenter-shortcut-open-and-wait",
      shortcutTarget: "web",
      closeInput: "web",
      command: [
        "--action",
        "presenter-shortcut-open-and-wait",
        "--shortcut-target",
        "web",
        "--close-probe",
        "--close-input",
        "web"
      ],
      resultPresenter: withShortcutTargetSnapshot(activePresenterFixture(40), "function"),
      lifecycle: [
        { type: "event:overlay:presenter-open-and-wait-start", payload: { presenter: parkedPresenterFixture(40) } },
        {
          type: "event:overlay:shortcut-open",
          payload: {
            shortcut: "openShortcutTargetAndWait",
            target: "web",
            overlayTarget: {
              type: "web",
              url: { redacted: true, present: true, type: "string" },
              modal: true
            }
          }
        },
        { type: "event:callback:overlay-activated", payload: { active: true, appId: 480, overlayPid: 9001 } },
        { type: "event:overlay:presenter-wait-shown", payload: { presenter: activePresenterFixture(41) } },
        { type: "event:overlay:web-visible", payload: { ok: true, attempt: 1, rect: "0,0,1280,720" } },
        { type: "event:callback:overlay-activated", payload: { active: false, appId: 480, overlayPid: 9001 } },
        { type: "event:overlay:presenter-wait-closed", payload: { presenter: parkedPresenterFixture(42) } },
        { type: "event:overlay:presenter-after-close", payload: { presenter: parkedPresenterFixture(42) } },
        { type: "event:overlay:presenter-parked", payload: { presenter: parkedPresenterFixture(42) } },
        {
          type: "event:overlay:presenter-open-and-wait-complete",
          payload: { shown: activePresenterFixture(41), parked: parkedPresenterFixture(42) }
        },
        { type: "event:overlay:presenter-after-close-stable", payload: { presenter: parkedPresenterFixture(42) } }
      ]
    },
    {
      caseId: "06-checkout",
      action: "presenter-checkout",
      expectedAppId: 480,
      checkoutSource: "json-file",
      requireMicroTxnCallback: true,
      closeInput: "web",
      command: [
        "--action",
        "presenter-checkout",
        "--checkout-json-file",
        REDACTED_COMMAND_VALUE,
        "--checkout-return-url",
        REDACTED_COMMAND_VALUE,
        "--close-probe",
        "--close-input",
        "web"
      ],
      resultPresenter: activePresenterFixture(30),
      lifecycle: [
        {
          type: "event:overlay:presenter-open",
          payload: {
            target: "checkout",
            api: "openCheckoutAndWait",
            checkoutSource: "json-file",
            checkout: { hasCheckoutUrl: false, hasTransactionId: true, hasReturnUrl: true },
            presenter: activePresenterFixture(30)
          }
        },
        { type: "event:callback:overlay-activated", payload: { active: true, appId: 480, overlayPid: 9001 } },
        { type: "event:overlay:presenter-wait-shown", payload: { presenter: activePresenterFixture(31) } },
        { type: "event:overlay:web-visible", payload: { ok: true, attempt: 1, rect: "0,0,1280,720" } },
        { type: "event:callback:microtxn", payload: { authorized: true, presenter: activePresenterFixture(31) } },
        { type: "event:callback:overlay-activated", payload: { active: false, appId: 480, overlayPid: 9001 } },
        { type: "event:overlay:presenter-wait-closed", payload: { presenter: parkedPresenterFixture(32) } },
        { type: "event:overlay:presenter-after-close", payload: { presenter: parkedPresenterFixture(32) } },
        { type: "event:overlay:presenter-parked", payload: { presenter: parkedPresenterFixture(32) } },
        {
          type: "event:overlay:presenter-checkout-open-and-wait-complete",
          payload: {
            checkoutSource: "json-file",
            resolvedTarget: { hasCheckoutUrl: true, hasTransactionId: true, hasReturnUrl: true },
            targetSnapshot: { type: "checkout", hasSteamUrl: true, hasTransactionId: true, hasReturnUrl: true },
            shown: activePresenterFixture(31),
            parked: parkedPresenterFixture(32)
          }
        },
        { type: "event:overlay:presenter-after-close-stable", payload: { presenter: parkedPresenterFixture(32) } }
      ]
    },
    {
      caseId: "06b-checkout-prepare",
      action: "presenter-checkout",
      command: ["--action", "presenter-checkout", "--require-no-overlay-activation"],
      resultPresenter: parkedPresenterFixture(34),
      requireNoOverlayActivation: true,
      lifecycle: [
        {
          type: "event:overlay:presenter-checkout-ready",
          payload: {
            target: "checkout",
            presenter: preparedPresenterFixture(33)
          }
        }
      ]
    },
    {
      caseId: "07-native-host-unavailable",
      action: "presenter-web-open-and-wait",
      resultOk: false,
      actionOk: false,
      actionError: {
        name: "SteamOverlayNativeHostUnavailableError",
        message: "Steam overlay native host is unavailable: macOS screen is locked.",
        code: "STEAM_OVERLAY_NATIVE_HOST_UNAVAILABLE",
        reason: "macos-screen-locked",
        targetSnapshot: { type: "web", hasUrl: true, modal: true },
        macOverlayEnvironment: { screenLocked: true, displayAsleep: true }
      },
      resultPresenter: nativeHostUnavailablePresenterFixture("macos-screen-locked", {
        screenLocked: true,
        displayAsleep: true
      }),
      overlayTargets: [],
      requireActionErrorCode: "STEAM_OVERLAY_NATIVE_HOST_UNAVAILABLE",
      requireActionErrorReason: "macos-screen-locked",
      requireNativeHostUnavailableReason: "macos-screen-locked",
      requireNoOverlayActivation: true,
      lifecycle: []
    },
    {
      caseId: "07b-presenter-ready-unavailable",
      action: "presenter-ready",
      command: [
        "--action",
        "presenter-ready",
        "--require-event",
        "overlay:presenter-ready",
        "--require-native-host-unavailable-reason",
        "macos-screen-locked",
        "--require-no-overlay-activation"
      ],
      resultPresenter: nativeHostUnavailablePresenterFixture("macos-screen-locked", {
        screenLocked: true,
        displayAsleep: true
      }),
      overlayTargets: [],
      requireNativeHostUnavailableReason: "macos-screen-locked",
      requireNoOverlayActivation: true,
      lifecycle: [
        {
          type: "event:overlay:presenter-ready",
          payload: {
            presenter: nativeHostUnavailablePresenterFixture("macos-screen-locked", {
              screenLocked: true,
              displayAsleep: true
            }),
            nativeHostAvailability: nativeHostAvailabilityFixture(
              nativeHostUnavailablePresenterFixture("macos-screen-locked", {
                screenLocked: true,
                displayAsleep: true
              })
            )
          }
        }
      ]
    },
    {
      caseId: "07c-checkout-unavailable",
      action: "presenter-checkout",
      resultOk: false,
      actionOk: false,
      actionError: {
        name: "SteamOverlayNativeHostUnavailableError",
        message: "Steam overlay native host is unavailable: macOS screen is locked.",
        code: "STEAM_OVERLAY_NATIVE_HOST_UNAVAILABLE",
        reason: "macos-screen-locked",
        targetSnapshot: { type: "checkout", hasTransactionId: true },
        checkoutTargetSnapshot: { type: "checkout", hasTransactionId: true },
        macOverlayEnvironment: { screenLocked: true, displayAsleep: true }
      },
      command: [
        "--action",
        "presenter-checkout",
        "--checkout-transaction-id",
        REDACTED_COMMAND_VALUE,
        "--require-action-error-code",
        "STEAM_OVERLAY_NATIVE_HOST_UNAVAILABLE",
        "--require-action-error-reason",
        "macos-screen-locked",
        "--require-native-host-unavailable-reason",
        "macos-screen-locked",
        "--require-no-overlay-activation"
      ],
      resultPresenter: nativeHostUnavailablePresenterFixture("macos-screen-locked", {
        screenLocked: true,
        displayAsleep: true
      }),
      overlayTargets: [],
      checkoutSource: "transaction-id",
      requireActionErrorCode: "STEAM_OVERLAY_NATIVE_HOST_UNAVAILABLE",
      requireActionErrorReason: "macos-screen-locked",
      requireNativeHostUnavailableReason: "macos-screen-locked",
      requireNoOverlayActivation: true,
      lifecycle: []
    },
    {
      caseId: "07d-checkout-prepare-unavailable",
      action: "presenter-checkout",
      resultOk: false,
      actionOk: false,
      actionError: {
        name: "SteamOverlayNativeHostUnavailableError",
        message: "Steam overlay native host is unavailable: macOS screen is locked.",
        code: "STEAM_OVERLAY_NATIVE_HOST_UNAVAILABLE",
        reason: "macos-screen-locked",
        targetSnapshot: { type: "checkout" },
        checkoutTargetSnapshot: { type: "checkout" },
        macOverlayEnvironment: { screenLocked: true, displayAsleep: true }
      },
      command: [
        "--action",
        "presenter-checkout",
        "--require-action-error-code",
        "STEAM_OVERLAY_NATIVE_HOST_UNAVAILABLE",
        "--require-action-error-reason",
        "macos-screen-locked",
        "--require-native-host-unavailable-reason",
        "macos-screen-locked",
        "--require-no-overlay-activation"
      ],
      resultPresenter: nativeHostUnavailablePresenterFixture("macos-screen-locked", {
        screenLocked: true,
        displayAsleep: true
      }),
      overlayTargets: [],
      requireActionErrorCode: "STEAM_OVERLAY_NATIVE_HOST_UNAVAILABLE",
      requireActionErrorReason: "macos-screen-locked",
      requireNativeHostUnavailableReason: "macos-screen-locked",
      requireNoOverlayActivation: true,
      lifecycle: []
    },
    {
      caseId: "08-shortcut-openwait-unavailable",
      action: "presenter-shortcut-open-and-wait",
      shortcutTarget: "web",
      resultOk: false,
      actionOk: false,
      actionError: {
        name: "SteamOverlayNativeHostUnavailableError",
        message: "Steam overlay native host is unavailable: macOS screen is locked.",
        code: "STEAM_OVERLAY_NATIVE_HOST_UNAVAILABLE",
        reason: "macos-screen-locked",
        targetSnapshot: { type: "web", hasUrl: true, modal: true },
        macOverlayEnvironment: { screenLocked: true, displayAsleep: true }
      },
      command: [
        "--action",
        "presenter-shortcut-open-and-wait",
        "--shortcut-target",
        "web",
        "--require-overlay-shortcut-target",
        "web",
        "--require-event",
        "overlay:presenter-open-and-wait-start",
        "--require-action-error-code",
        "STEAM_OVERLAY_NATIVE_HOST_UNAVAILABLE",
        "--require-action-error-reason",
        "macos-screen-locked",
        "--require-native-host-unavailable-reason",
        "macos-screen-locked",
        "--require-no-overlay-activation"
      ],
      resultPresenter: withShortcutTargetSnapshot(
        nativeHostUnavailablePresenterFixture("macos-screen-locked", {
          screenLocked: true,
          displayAsleep: true
        }),
        "web"
      ),
      overlayTargets: [],
      requireActionErrorCode: "STEAM_OVERLAY_NATIVE_HOST_UNAVAILABLE",
      requireActionErrorReason: "macos-screen-locked",
      requireNativeHostUnavailableReason: "macos-screen-locked",
      requireNoOverlayActivation: true,
      lifecycle: [
        {
          type: "event:overlay:presenter-open-and-wait-start",
          payload: {
            target: "shortcut",
            shortcut: "openShortcutTargetAndWait",
            shortcutTarget: "web",
            api: "openShortcutTargetAndWait",
            presenter: withShortcutTargetSnapshot(
              nativeHostUnavailablePresenterFixture("macos-screen-locked", {
                screenLocked: true,
                displayAsleep: true
              }),
              "web"
            )
          }
        }
      ]
    },
    {
      caseId: "09-passive-toast-unavailable",
      action: "presenter-achievement-progress",
      command: [
        "--action",
        "presenter-achievement-progress",
        "--require-passive-notification",
        "--require-native-host-unavailable-reason",
        "macos-screen-locked",
        "--require-no-overlay-activation"
      ],
      resultPresenter: nativeHostUnavailablePresenterFixture("macos-screen-locked", {
        screenLocked: true,
        displayAsleep: true
      }),
      overlayTargets: [],
      requireNativeHostUnavailableReason: "macos-screen-locked",
      requireNoOverlayActivation: true,
      lifecycle: [
        {
          type: "event:achievement:progress",
          payload: {
            indicated: true,
            presenter: nativeHostUnavailablePresenterFixture("macos-screen-locked", {
              screenLocked: true,
              displayAsleep: true
            })
          }
        },
        { type: "event:callback:achievement-stored", payload: { achievement: "ACH_TEST" } }
      ]
    }
  ];

  const manifest = [];
  for (const fixture of cases) {
    const resultFile = path.join(root, `${fixture.caseId}.log`);
    const diagnosticDir = path.join(root, `${fixture.caseId}.log.diagnostics`);
    const result = JSON.parse(JSON.stringify(baseResult));
    const expectedAppId = fixture.expectedAppId || 480;
    const expectedAppIdText = String(expectedAppId);
    result.ok = fixture.resultOk ?? true;
    result.action.action = fixture.action;
    result.action.ok = fixture.actionOk ?? true;
    result.snapshot.app.appId = expectedAppId;
    result.snapshot.launch.env.SteamAppId = expectedAppIdText;
    result.snapshot.launch.env.SteamGameId = expectedAppIdText;
    result.snapshot.launch.env.SteamOverlayGameId = expectedAppIdText;
    result.snapshot.steam.appId.value = expectedAppId;
    if (fixture.action === "presenter-shortcut" || fixture.action === "presenter-ready") {
      result.snapshot.steam.overlayEnabled.value = false;
    }
    if (fixture.actionError) {
      result.action.error = fixture.actionError;
    } else {
      delete result.action.error;
    }
    result.snapshot.overlay.nativePresenter.value = fixture.resultPresenter;
    result.snapshot.overlay.nativeHostAvailability = {
      ok: true,
      value: nativeHostAvailabilityFixture(fixture.resultPresenter)
    };
    const overlayGameId = fixture.overlayGameId || expectedAppIdText;
    if (Array.isArray(fixture.overlayTargets)) {
      result.snapshot.overlayProcesses.gameoverlayui = fixture.overlayTargets;
    } else {
      result.snapshot.overlayProcesses.gameoverlayui[0].gameId = overlayGameId;
      result.snapshot.overlayProcesses.gameoverlayui[0].command = `gameoverlayui -pid 4242 -gameid ${overlayGameId}`;
    }
    const lifecycle = fixture.lifecycle.map((entry) => {
      const copy = JSON.parse(JSON.stringify(entry));
      if (copy.type === "event:callback:overlay-activated" && copy.payload && copy.payload.appId != null) {
        copy.payload.appId = expectedAppId;
      }
      return copy;
    });
    fs.mkdirSync(diagnosticDir, { recursive: true });
    fs.writeFileSync(resultFile, `${RESULT_PREFIX}${JSON.stringify(result)}\n`);
    fs.writeFileSync(
      path.join(diagnosticDir, "lifecycle.jsonl"),
      lifecycle.map((entry) => JSON.stringify(entry)).join("\n") + "\n"
    );
    manifest.push({
      caseId: fixture.caseId,
      resultFile,
      diagnosticDir,
      expectedAppId,
      command: fixture.command || [],
      action: fixture.action,
      closeInput: fixture.closeInput || null,
      shortcutTarget: fixture.shortcutTarget || null,
      checkoutSource: fixture.checkoutSource || null,
      expectedNativeHostBackend: fixture.expectedNativeHostBackend || null,
      requireActionErrorCode: fixture.requireActionErrorCode || null,
      requireActionErrorReason: fixture.requireActionErrorReason || null,
      requireNativeHostUnavailableReason: fixture.requireNativeHostUnavailableReason || null,
      requireNoOverlayActivation: fixture.requireNoOverlayActivation === true,
      requireMacosNeedsPresentPollingDisabled: true,
      requireNamedOpenStatusSnapshots: true,
      requireCheckoutOperationStatusSnapshot: true,
      requireMicroTxnCallback: fixture.requireMicroTxnCallback === true
    });
  }

  fs.writeFileSync(path.join(root, "macos-matrix-cases.jsonl"), manifest.map((entry) => JSON.stringify(entry)).join("\n") + "\n");
}

function createPersistentSelfTestFixture(root) {
  fs.mkdirSync(root, { recursive: true });
  const diagnosticDir = path.join(root, "persistent.diagnostics");
  fs.mkdirSync(diagnosticDir, { recursive: true });

  const cases = [
    {
      caseId: "01-persistent-shortcut-friends",
      shortcutTarget: "friends",
      overlayTarget: { type: "friends" },
      overlayProcesses: [
        overlayProcessFixture(9001),
        overlayProcessFixture(9002)
      ],
      pumpCount: 40
    },
    {
      caseId: "02-persistent-shortcut-web",
      shortcutTarget: "web",
      closeInput: "web",
      overlayTarget: {
        type: "web",
        url: { redacted: true, present: true, type: "string" },
        modal: true
      },
      overlayProcesses: [overlayProcessFixture(9001)],
      pumpCount: 50
    }
  ];

  const manifest = [];
  const lifecycle = [];
  for (const fixture of cases) {
    const resultFile = path.join(root, `${fixture.caseId}.log`);
    const result = persistentShortcutResultFixture(fixture);
    fs.writeFileSync(resultFile, `${RESULT_PREFIX}${JSON.stringify(result)}\n`);
    lifecycle.push(...persistentShortcutLifecycleFixture(fixture));
    manifest.push({
      caseId: fixture.caseId,
      resultFile,
      diagnosticDir,
      expectedAppId: 480,
      command: [
        "--action",
        "presenter-shortcut",
        "--shortcut-target",
        fixture.shortcutTarget,
        ...(fixture.closeInput ? ["--close-probe", "--close-input", fixture.closeInput] : [])
      ],
      action: "presenter-shortcut",
      closeInput: fixture.closeInput || null,
      shortcutTarget: fixture.shortcutTarget,
      checkoutSource: null,
      expectedNativeHostBackend: null,
      requireActionErrorCode: null,
      requireActionErrorReason: null,
      requireNativeHostUnavailableReason: null,
      requireNoOverlayActivation: false,
      requireMacosNeedsPresentPollingDisabled: true,
      requireNamedOpenStatusSnapshots: true,
      requireCheckoutOperationStatusSnapshot: true
    });
  }

  fs.writeFileSync(
    path.join(diagnosticDir, "lifecycle.jsonl"),
    lifecycle.map((entry) => JSON.stringify(entry)).join("\n") + "\n"
  );
  fs.writeFileSync(path.join(root, "macos-matrix-cases.jsonl"), manifest.map((entry) => JSON.stringify(entry)).join("\n") + "\n");
}

function persistentShortcutResultFixture(fixture) {
  return {
    ok: true,
    action: { ok: true, action: "presenter-shortcut" },
    snapshot: {
      app: { appId: 480 },
      process: { pid: 4242, platform: "darwin", arch: "arm64" },
      launch: {
        steamLaunch: true,
        overlayInjection: true,
        env: { SteamAppId: "480", SteamGameId: "480", SteamOverlayGameId: "480" }
      },
      crashDiagnostics: { available: true, ok: true, crashDumps: [], fatalLifecycleEvents: [] },
      overlayProcesses: {
        available: true,
        platform: "darwin",
        gameoverlayui: fixture.overlayProcesses
      },
      steam: {
        initialized: true,
        running: { ok: true, value: true },
        appId: { ok: true, value: 480 },
        steamDeck: { ok: true, value: false },
        bigPicture: { ok: true, value: false },
        overlayEnabled: { ok: true, value: false },
        overlayNeedsPresent: { ok: true, value: false },
        overlayNeedsPresentPollingEnabled: { ok: true, value: false }
      },
      overlay: {
        nativePresenter: {
          ok: true,
          value: withShortcutTargetSnapshot(parkedPresenterFixture(fixture.pumpCount), "function")
        },
        openStatuses: namedOpenStatusesFixture()
      }
    }
  };
}

function namedOpenStatusesFixture() {
  const snapshots = {
    web: { type: "web", modal: true, hasUrl: true },
    store: { type: "store", appId: 480 },
    friends: { type: "friends" },
    profile: { type: "profile" },
    players: { type: "players" },
    community: { type: "community", appId: 480 },
    stats: { type: "stats", appId: 480 },
    achievements: { type: "achievements", appId: 480 },
    user: { type: "user", appId: 480, dialog: "chat" },
    dialog: { type: "dialog", appId: 480, dialog: "OfficialGameGroup" },
    checkout: { type: "checkout" },
    checkoutOperation: { type: "checkout" }
  };
  const value = {};
  for (const [name, targetSnapshot] of Object.entries(snapshots)) {
    const supported = name !== "checkout";
    value[name] = {
      ok: true,
      value: {
        canOpen: supported,
        canWait: supported,
        ...(name === "checkoutOperation" ? { canStartOperation: true } : {}),
        ...(supported ? {} : { reason: "unsupported-target", waitReason: "unsupported-target" }),
        targetSnapshot
      }
    };
  }
  return { ok: true, value };
}

function duplicateOpenBusyStatusFixture(extra = {}) {
  return {
    canOpen: false,
    canWait: false,
    reason: "opening",
    waitReason: "opening",
    ...extra
  };
}

function duplicateOpenNamedBusyStatusesFixture() {
  const value = {};
  for (const name of DUPLICATE_OPEN_NAMED_TARGET_NAMES) {
    value[name] = duplicateOpenBusyStatusFixture();
  }
  value.checkoutOperation = duplicateOpenBusyStatusFixture({ canStartOperation: false });
  return value;
}

function duplicateOpenNamedNullsFixture() {
  const value = {};
  for (const name of DUPLICATE_OPEN_NAMED_TARGET_NAMES) {
    value[name] = true;
  }
  return value;
}

function persistentShortcutLifecycleFixture(fixture) {
  const pumpCount = fixture.pumpCount;
  const entries = [
    {
      type: "event:control:action-request",
      payload: {
        action: "presenter-shortcut",
        resultDelayMs: 8000,
        resultFile: true,
        options: { shortcutTarget: fixture.shortcutTarget }
      }
    },
    { type: "event:control:action-begin", payload: { action: "presenter-shortcut" } },
    {
      type: "event:overlay:presenter-shortcut-ready",
      payload: {
        target: fixture.shortcutTarget,
        shortcut: "Shift+Tab",
        presenter: parkedPresenterFixture(pumpCount)
      }
    },
    { type: "event:control:action-complete", payload: { action: "presenter-shortcut", ok: true, error: null } },
    {
      type: "event:overlay:shortcut-open",
      payload: {
        shortcut: "Shift+Tab",
        target: fixture.shortcutTarget,
        overlayTarget: fixture.overlayTarget
      }
    },
    { type: "event:callback:overlay-activated", payload: { active: true, appId: 480, overlayPid: 9001 } },
    { type: "event:overlay:presenter-wait-shown", payload: { presenter: activePresenterFixture(pumpCount + 1) } },
    ...(fixture.closeInput === "web"
      ? [{ type: "event:overlay:web-visible", payload: { ok: true, attempt: 1, rect: "0,0,1280,720" } }]
      : []),
    { type: "event:callback:overlay-activated", payload: { active: false, appId: 480, overlayPid: 9001 } },
    { type: "event:overlay:presenter-wait-closed", payload: { presenter: parkedPresenterFixture(pumpCount + 2) } },
    { type: "event:overlay:presenter-after-close", payload: { presenter: parkedPresenterFixture(pumpCount + 2) } },
    { type: "event:overlay:presenter-parked", payload: { presenter: parkedPresenterFixture(pumpCount + 2) } },
    { type: "event:overlay:presenter-after-close-stable", payload: { presenter: parkedPresenterFixture(pumpCount + 2) } }
  ];
  return entries;
}

function overlayProcessFixture(pid) {
  return {
    pid,
    targetPid: 4242,
    gameId: "480",
    command: `gameoverlayui -pid 4242 -gameid 480`
  };
}

function activePresenterFixture(pumpCount, backend) {
  return {
    ...parkedPresenterFixture(pumpCount, backend),
    mode: "active",
    clickThrough: false,
    transparent: false,
    currentFps: 30,
    overlayActive: true,
    overlayWasActive: true
  };
}

function preparedPresenterFixture(pumpCount, backend) {
  return {
    ...activePresenterFixture(pumpCount, backend),
    overlayActive: false,
    overlayWasActive: false
  };
}

function passiveNotificationPresenterFixture(pumpCount) {
  return parkedPresenterFixture(pumpCount);
}

function parkedPresenterFixture(pumpCount, backend = "macos-metal") {
  return {
    title: "Steam Bridge Overlay Presenter",
    backend,
    closed: false,
    mode: "passive",
    attached: true,
    nativeProbeOpen: false,
    nativeHostOpen: true,
    macOverlayEnvironment: {
      screenLocked: false,
      displayAsleep: false
    },
    clickThrough: true,
    focusable: false,
    transparent: true,
    idleFps: 0,
    needsPresentFps: 30,
    activeOverlayFps: 30,
    currentFps: 0,
    pumpCount,
    overlayActive: false,
    overlayWasActive: false,
    overlayNeedsPresent: false,
    overlayNeedsPresentPollingEnabled: false,
    electronOverlay: {
      presenterMode: "persistent",
      closeWithWindow: true,
      autoPrepareForNotifications: true,
      scrubSteamOverlayChildProcessEnv: true,
      scrubbedEnvKeys: [],
      restoreFocusDelayMs: 0,
      activationBoostMs: 0,
      activeGraceMs: 0,
      overlayShortcut: {
        enabled: true,
        preventDefault: true,
        targetType: "friends",
        target: { type: "friends" }
      }
    }
  };
}

function withShortcutTargetSnapshot(presenter, targetType, target) {
  return {
    ...presenter,
    electronOverlay: {
      ...presenter.electronOverlay,
      overlayShortcut: {
        ...presenter.electronOverlay.overlayShortcut,
        targetType,
        target
      }
    }
  };
}

function nativeHostAvailabilityFixture(presenter) {
  if (!presenter.nativeHostUnavailableReason) {
    return {
      available: true,
      snapshot: presenter,
      diagnostics: presenter.diagnostics,
      macOverlayEnvironment: presenter.macOverlayEnvironment
    };
  }
  return {
    available: false,
    snapshot: presenter,
    diagnostics: presenter.diagnostics,
    code: "STEAM_OVERLAY_NATIVE_HOST_UNAVAILABLE",
    reason: presenter.nativeHostUnavailableReason,
    nativeHostUnavailableReason: presenter.nativeHostUnavailableReason,
    macOverlayEnvironment: presenter.macOverlayEnvironment
  };
}

function nativeHostUnavailablePresenterFixture(reason, macOverlayEnvironmentOverride) {
  const macOverlayEnvironment = macOverlayEnvironmentOverride || defaultMacOverlayEnvironment(reason) || {
    screenLocked: false,
    displayAsleep: false
  };
  return {
    title: "Steam Bridge Overlay Presenter",
    backend: "macos-metal",
    closed: false,
    mode: "hidden",
    attached: false,
    nativeProbeOpen: false,
    nativeHostOpen: false,
    nativeHostUnavailableReason: reason,
    macOverlayEnvironment,
    clickThrough: true,
    focusable: false,
    transparent: true,
    idleFps: 0,
    needsPresentFps: 30,
    activeOverlayFps: 30,
    currentFps: 0,
    pumpCount: 0,
    overlayActive: false,
    overlayWasActive: false,
    overlayNeedsPresent: false,
    overlayNeedsPresentPollingEnabled: false,
    electronOverlay: {
      presenterMode: "persistent",
      closeWithWindow: true,
      autoPrepareForNotifications: true,
      scrubSteamOverlayChildProcessEnv: true,
      scrubbedEnvKeys: [],
      restoreFocusDelayMs: 0,
      activationBoostMs: 0,
      activeGraceMs: 0,
      overlayShortcut: {
        enabled: true,
        preventDefault: true,
        targetType: "friends",
        target: { type: "friends" }
      }
    }
  };
}

function defaultMacOverlayEnvironment(reason) {
  switch (reason) {
    case "macos-screen-locked":
      return { screenLocked: true, displayAsleep: false };
    case "macos-display-asleep":
      return { screenLocked: false, displayAsleep: true };
    default:
      return undefined;
  }
}

function readSmokeResult(file) {
  const text = fs.readFileSync(file, "utf8");
  const line = text
    .split(/\r?\n/)
    .reverse()
    .find((entry) => entry.startsWith(RESULT_PREFIX));
  if (!line) {
    throw new Error(`missing ${RESULT_PREFIX.trim()} line in ${file}`);
  }
  return JSON.parse(line.slice(RESULT_PREFIX.length));
}

function readCaseManifest(file, failures) {
  const byCase = new Map();
  if (!fs.existsSync(file)) {
    return { found: false, byCase };
  }

  const text = fs.readFileSync(file, "utf8");
  for (const [index, line] of text.split(/\r?\n/).entries()) {
    if (!line.trim()) {
      continue;
    }
    let metadata;
    try {
      metadata = JSON.parse(line);
    } catch (error) {
      failures.push(`invalid macOS matrix manifest JSON in ${file}:${index + 1}: ${error.message}`);
      continue;
    }
    if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
      failures.push(`invalid macOS matrix manifest entry in ${file}:${index + 1}`);
      continue;
    }
    if (!metadata.caseId || typeof metadata.caseId !== "string") {
      failures.push(`macOS matrix manifest entry missing caseId in ${file}:${index + 1}`);
      continue;
    }
    if (byCase.has(metadata.caseId)) {
      failures.push(`duplicate macOS matrix manifest entry for ${metadata.caseId}`);
      continue;
    }
    if (metadata.checkoutSource) {
      verifyManifestCommandRedaction(file, index + 1, metadata, failures);
    }
    byCase.set(metadata.caseId, metadata);
  }

  return { found: true, byCase };
}

function verifyManifestCommandRedaction(file, lineNumber, metadata, failures) {
  if (!Array.isArray(metadata.command)) {
    return;
  }

  for (let index = 0; index < metadata.command.length; index += 1) {
    const arg = metadata.command[index];
    if (typeof arg !== "string") {
      continue;
    }
    const equalsIndex = arg.indexOf("=");
    const optionName = equalsIndex === -1 ? arg : arg.slice(0, equalsIndex);
    if (!SENSITIVE_MANIFEST_OPTIONS.has(optionName)) {
      continue;
    }

    if (equalsIndex !== -1) {
      const value = arg.slice(equalsIndex + 1);
      if (value !== REDACTED_COMMAND_VALUE) {
        failures.push(
          `${metadata.caseId}: unredacted sensitive manifest option ${optionName} in ${file}:${lineNumber}`
        );
      }
      continue;
    }

    const value = metadata.command[index + 1];
    if (value !== REDACTED_COMMAND_VALUE) {
      failures.push(`${metadata.caseId}: unredacted sensitive manifest option ${optionName} in ${file}:${lineNumber}`);
    } else {
      index += 1;
    }
  }
}

function auditCaseArtifactRedaction(caseId, artifactLabel, value, failures) {
  const seen = new WeakSet();
  auditArtifactValue(caseId, artifactLabel, value, {
    path: artifactLabel,
    key: "",
    failures,
    seen
  });
}

function auditArtifactValue(caseId, artifactLabel, value, context) {
  if (value == null) {
    return;
  }

  const keySensitive = isSensitiveArtifactKey(context.key);

  if (typeof value === "string") {
    if (keySensitive && value !== "") {
      context.failures.push(`${caseId}: ${artifactLabel} contains raw sensitive field ${context.path}`);
      return;
    }
    if (containsSensitiveArtifactString(value)) {
      context.failures.push(`${caseId}: ${artifactLabel} contains unredacted checkout value at ${context.path}`);
    }
    return;
  }

  if (typeof value === "number" || typeof value === "bigint") {
    if (keySensitive) {
      context.failures.push(`${caseId}: ${artifactLabel} contains raw sensitive field ${context.path}`);
    }
    return;
  }

  if (typeof value === "boolean") {
    return;
  }

  if (Array.isArray(value)) {
    value.forEach((entry, index) => {
      auditArtifactValue(caseId, artifactLabel, entry, {
        ...context,
        path: `${context.path}[${index}]`,
        key: context.key
      });
    });
    return;
  }

  if (typeof value !== "object") {
    return;
  }

  if (context.seen.has(value)) {
    return;
  }
  context.seen.add(value);

  if (isRedactedArtifactValue(value)) {
    return;
  }

  if (keySensitive) {
    context.failures.push(`${caseId}: ${artifactLabel} contains non-redacted sensitive object ${context.path}`);
    return;
  }

  for (const [entryKey, entryValue] of Object.entries(value)) {
    auditArtifactValue(caseId, artifactLabel, entryValue, {
      ...context,
      path: `${context.path}.${entryKey}`,
      key: entryKey
    });
  }
}

function isSensitiveArtifactKey(key) {
  if (!key) {
    return false;
  }
  const normalized = String(key).replace(/[^a-z0-9]/gi, "").toLowerCase();
  if (!normalized || normalized.startsWith("has")) {
    return false;
  }
  return (
    SENSITIVE_ARTIFACT_KEY_NAMES.has(normalized) ||
    SENSITIVE_ARTIFACT_KEY_PARTS.some((part) => normalized.includes(part))
  );
}

function containsSensitiveArtifactString(value) {
  const trimmed = value.trim().toLowerCase();
  return (
    CHECKOUT_APPROVAL_URL_PATTERN.test(value) ||
    STEAM_ID64_PATTERN.test(value) ||
    SENSITIVE_ARTIFACT_ARG_PREFIXES.some((prefix) => trimmed === prefix || trimmed.startsWith(`${prefix}=`))
  );
}

function isRedactedArtifactValue(value) {
  return (
    value &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    value.redacted === true &&
    typeof value.present === "boolean"
  );
}

function readMacosCrashReports(diagnosticDir) {
  const root = path.join(diagnosticDir, "macos-crash-reports");
  const reports = [];
  const errors = [];

  walk(root);
  return { reports, errors };

  function walk(currentPath) {
    let entries;
    try {
      entries = fs.readdirSync(currentPath, { withFileTypes: true });
    } catch (error) {
      if (error && error.code === "ENOENT") {
        return;
      }
      errors.push(`could not read macOS crash report directory ${currentPath}: ${error.message}`);
      return;
    }

    for (const entry of entries) {
      const entryPath = path.join(currentPath, entry.name);
      if (entry.isDirectory()) {
        walk(entryPath);
        continue;
      }
      if (!entry.isFile() || !isRelevantMacosCrashReport(entryPath, entry.name)) {
        continue;
      }
      reports.push({
        path: entryPath,
        relativePath: path.relative(diagnosticDir, entryPath),
        summary: summarizeMacosCrashReport(entryPath)
      });
    }
  }
}

function isRelevantMacosCrashReport(file, name) {
  if (DIRECT_MACOS_CRASH_REPORT_NAME.test(name)) {
    return true;
  }
  if (!ATTRIBUTED_MACOS_CRASH_REPORT_NAME.test(name)) {
    return false;
  }
  let text = "";
  try {
    text = fs.readFileSync(file, "utf8");
  } catch {
    return true;
  }
  return STEAM_BRIDGE_RESPONSIBLE_CRASH_REPORT.test(text);
}

function summarizeMacosCrashReport(file) {
  let text = "";
  try {
    text = fs.readFileSync(file, "utf8");
  } catch (error) {
    return `(unreadable: ${error.message})`;
  }

  const firstLine = text.split(/\r?\n/, 1)[0] || "";
  let header = {};
  try {
    header = JSON.parse(firstLine);
  } catch {
    header = {};
  }

  const details = [];
  const timestamp = header.timestamp || matchText(text, /"captureTime"\s*:\s*"([^"]+)"/);
  if (timestamp) {
    details.push(`timestamp=${formatValue(timestamp)}`);
  }
  const procName = header.app_name || header.name || matchText(text, /"procName"\s*:\s*"([^"]+)"/);
  if (procName) {
    details.push(`process=${formatValue(procName)}`);
  }
  const responsibleProc = matchText(text, /"responsibleProc"\s*:\s*"([^"]+)"/);
  if (responsibleProc) {
    details.push(`responsible=${formatValue(responsibleProc)}`);
  }
  const exceptionType = matchText(text, /"exception"\s*:\s*\{[^}]*"type"\s*:\s*"([^"]+)"/s);
  const exceptionSignal = matchText(text, /"exception"\s*:\s*\{[^}]*"signal"\s*:\s*"([^"]+)"/s);
  if (exceptionType || exceptionSignal) {
    details.push(`exception=${formatValue([exceptionType, exceptionSignal].filter(Boolean).join("/"))}`);
  }
  const topSymbol = matchText(text, /"frames"\s*:\s*\[\{[^\]]*?"symbol"\s*:\s*"([^"]+)"/s);
  if (topSymbol) {
    details.push(`top=${formatValue(topSymbol)}`);
  }
  const bridgeSymbol = matchText(text, /"symbol"\s*:\s*"([^"]*steam_bridge[^"]*)"/);
  if (bridgeSymbol) {
    details.push(`bridge=${formatValue(bridgeSymbol)}`);
  }

  return details.join(" ");
}

function matchText(text, pattern) {
  const match = text.match(pattern);
  return match ? match[1] : "";
}

function readLifecycle(file) {
  if (!fs.existsSync(file)) {
    return { found: false, rawText: "", entries: [], errors: [] };
  }

  const errors = [];
  const entries = [];
  const rawText = fs.readFileSync(file, "utf8");
  for (const [index, line] of rawText.split(/\r?\n/).entries()) {
    if (!line.trim()) {
      continue;
    }
    try {
      entries.push(JSON.parse(line));
    } catch (error) {
      errors.push(`invalid lifecycle JSON in ${file}:${index + 1}: ${error.message}`);
    }
  }

  return { found: true, rawText, entries, errors };
}

function scopeLifecycleForCase(metadata, lifecycle, options) {
  if (!options.shared) {
    return lifecycle;
  }

  const requestIndexes = lifecycle.entries
    .map((entry, index) => ({ entry, index }))
    .filter(({ entry }) => isLifecycleControlActionRequest(entry))
    .map(({ index }) => index);
  if (requestIndexes.length === 0) {
    return lifecycle;
  }

  const start = requestIndexes[options.ordinal];
  if (start == null) {
    return {
      ...lifecycle,
      errors: [
        ...lifecycle.errors,
        `shared lifecycle has no control action request for ordinal ${options.ordinal + 1}`
      ]
    };
  }

  const end = requestIndexes[options.ordinal + 1] ?? lifecycle.entries.length;
  const entries = lifecycle.entries.slice(start, end);
  const rawText = entries.map((entry) => JSON.stringify(entry)).join("\n");
  return { ...lifecycle, rawText, entries };
}

function scopeResultEventsForCase(events, actionName) {
  const matchingRequestIndexes = events
    .map((entry, index) => ({ entry, index }))
    .filter(({ entry }) => isResultControlActionRequestForAction(entry, actionName))
    .map(({ index }) => index);
  const requestIndexes = events
    .map((entry, index) => ({ entry, index }))
    .filter(({ entry }) => isResultControlActionRequest(entry))
    .map(({ index }) => index);
  const start = matchingRequestIndexes.at(-1) ?? requestIndexes.at(-1);
  return start == null ? events : events.slice(start);
}

function isLifecycleControlActionRequest(entry) {
  return entry && entry.type === "event:control:action-request";
}

function isResultControlActionRequest(entry) {
  return entry && entry.type === "control:action-request";
}

function isResultControlActionRequestForAction(entry, actionName) {
  if (!isResultControlActionRequest(entry)) {
    return false;
  }
  const payload = objectOrEmpty(entry.payload);
  return payload.action === actionName;
}

function readElectronOverlay(presenter) {
  if (!presenter || typeof presenter !== "object" || Array.isArray(presenter)) {
    return undefined;
  }
  return presenter.electronOverlay && typeof presenter.electronOverlay === "object" && !Array.isArray(presenter.electronOverlay)
    ? presenter.electronOverlay
    : undefined;
}

function managedOverlayIsolationOk(electronOverlay) {
  if (!electronOverlay || electronOverlay.scrubSteamOverlayChildProcessEnv !== true) {
    return false;
  }
  if (!Array.isArray(electronOverlay.scrubbedEnvKeys)) {
    return false;
  }
  return electronOverlay.scrubbedEnvKeys.every((key) => EXPECTED_STEAM_OVERLAY_SCRUBBED_ENV_KEYS.has(key));
}

function presenterPayload(entry) {
  const payload = entry && typeof entry.payload === "object" && !Array.isArray(entry.payload) ? entry.payload : {};
  return payload.presenter && typeof payload.presenter === "object" && !Array.isArray(payload.presenter)
    ? payload.presenter
    : undefined;
}

function hasInactiveAfterActive(entries) {
  const firstActiveIndex = entries.findIndex(isLifecycleOverlayActiveEvent);
  return (
    firstActiveIndex !== -1 &&
    entries.some((entry, index) => index > firstActiveIndex && isLifecycleOverlayInactiveEvent(entry))
  );
}

function isLifecycleOverlayActiveEvent(event) {
  return event && event.type === "event:callback:overlay-activated" && overlayEventState(event) === true;
}

function isLifecycleOverlayInactiveEvent(event) {
  return event && event.type === "event:callback:overlay-activated" && overlayEventState(event) === false;
}

function isOverlayActiveEvent(event) {
  return (
    event &&
    (event.type === "callback:overlay-activated" || event.type === "event:callback:overlay-activated") &&
    overlayEventState(event) === true
  );
}

function overlayEventState(event) {
  if (!event) {
    return undefined;
  }
  const payload = event.payload;
  if (payload === true || payload === 1) {
    return true;
  }
  if (payload === false || payload === 0) {
    return false;
  }
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
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

function overlayEventAppId(event) {
  if (!event) {
    return undefined;
  }
  const payload = event.payload;
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return undefined;
  }
  const activePayload = payload["0"] && typeof payload["0"] === "object" ? payload["0"] : payload;
  for (const key of ["appId", "app_id", "m_nAppID"]) {
    if (activePayload[key] != null) {
      return Number(activePayload[key]);
    }
  }
  return undefined;
}

function overlayEventPid(event) {
  if (!event) {
    return undefined;
  }
  const payload = event.payload;
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return undefined;
  }
  const activePayload = payload["0"] && typeof payload["0"] === "object" ? payload["0"] : payload;
  for (const key of ["overlayPid", "overlay_pid", "m_unOverlayPID"]) {
    if (activePayload[key] != null) {
      const pid = Number(activePayload[key]);
      return Number.isFinite(pid) ? pid : undefined;
    }
  }
  return undefined;
}

function objectOrEmpty(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function objectField(value, key) {
  const object = objectOrEmpty(value);
  return object[key] && typeof object[key] === "object" && !Array.isArray(object[key]) ? object[key] : undefined;
}

function readOkValue(entry) {
  return entry && entry.ok === true ? entry.value : undefined;
}

function countOverlayTargets(overlayProcesses) {
  const gameoverlayui = Array.isArray(overlayProcesses.gameoverlayui) ? overlayProcesses.gameoverlayui : [];
  return new Set(
    gameoverlayui
      .filter((entry) => entry && entry.targetPid != null)
      .map((entry) => `${entry.targetPid}:${entry.gameId ?? "unknown"}`)
  ).size;
}

function countBy(items, mapper) {
  const counts = new Map();
  for (const item of items) {
    const key = mapper(item);
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  return counts;
}

function arrayLength(value) {
  return Array.isArray(value) ? value.length : 0;
}

function nonEmptyString(value) {
  return typeof value === "string" && value.length > 0 ? value : "";
}

function expect(condition, message, failures) {
  if (!condition) {
    failures.push(message);
  }
}

function formatValue(value) {
  return JSON.stringify(value);
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
