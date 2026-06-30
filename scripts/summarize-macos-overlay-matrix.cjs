#!/usr/bin/env node

const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const RESULT_PREFIX = "STEAM_BRIDGE_SMOKE_RESULT ";
const OPEN_AND_WAIT_ACTIONS = new Set([
  "presenter-web-open-and-wait",
  "presenter-store-open-and-wait",
  "presenter-dialog-auto-open-and-wait",
  "presenter-friends-open-and-wait",
  "presenter-profile-open-and-wait",
  "presenter-players-open-and-wait",
  "presenter-community-open-and-wait",
  "presenter-stats-open-and-wait",
  "presenter-achievements-open-and-wait",
  "presenter-user-open-and-wait"
]);
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
const MACOS_CRASH_REPORT_NAME = /^SteamBridgeSmoke(?:\.electron| Helper(?: \(Renderer\))?)?-.*\.ips$/;
const SENSITIVE_MANIFEST_OPTIONS = new Set([
  "--checkout-json-file",
  "--checkout-return-url",
  "--checkout-transaction-id",
  "--checkout-url"
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
    const summary = verifyCase(caseId, metadata, result, scopedLifecycle, macosCrashReports, caseFailures);
    summaries.push(summary);

    if (caseFailures.length > 0) {
      failures.push(...caseFailures);
    }
  }

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
        `passive=${summary.passive}`,
        `overlayTargets=${summary.overlayTargets}`,
        `overlayGameIds=${summary.overlayGameIds.join(",") || "none"}`,
        `backend=${summary.nativeHostBackend}`,
        `macInteractive=${summary.macInteractive}`,
        `zeroTiming=${summary.zeroTiming}`,
        `shown=${summary.shown}`,
        `managedWaits=${summary.managedWaits}`,
        `openAndWait=${summary.openAndWait}`,
        `checkoutWait=${summary.checkoutWait}`,
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
  const expectedActionError = expectedActionErrorFromMetadata(metadata);
  const hasExpectedActionError = Boolean(expectedActionError.code || expectedActionError.reason);
  const expectedNativeHostUnavailableReason = nonEmptyString(
    metadata.requireNativeHostUnavailableReason ?? metadata.expectedNativeHostUnavailableReason
  );
  const expectedNativeHostBackend = expectedNativeHostBackendFromMetadata(metadata);
  const expectedNoOverlayActivation =
    metadata.requireNoOverlayActivation === true ||
    metadata.expectedNoOverlayActivation === true ||
    Boolean(expectedNativeHostUnavailableReason);
  const requireMicroTxnCallback =
    metadata.requireMicroTxnCallback === true || metadata.expectedMicroTxnCallback === true;
  const activated = lifecycleEntries.some(isLifecycleOverlayActiveEvent);
  const closed = hasInactiveAfterActive(lifecycleEntries);
  const parked = hasExpectedActionError ? false : verifyLifecycleParking(caseId, lifecycleEntries, isPassive, failures);
  const zeroTiming = Boolean(
    electronOverlay &&
      electronOverlay.restoreFocusDelayMs === 0 &&
      electronOverlay.activationBoostMs === 0 &&
      electronOverlay.activeGraceMs === 0
  );
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
  const microTxnCallback = hasExpectedActionError
    ? { required: false, ok: true }
    : verifyMicroTxnCallbackPresenterSnapshots(caseId, lifecycleEntries, failures, {
        required: requireMicroTxnCallback
      });
  const managedWaits = hasExpectedActionError
    ? { required: false, ok: true }
    : verifyManagedLifecycleWaits(caseId, actionName, lifecycleEntries, isPassive, failures);
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
  if (!expectedNativeHostUnavailableReason) {
    expect(readOkValue(steam.overlayEnabled) === true, `${caseId}: Steam overlay enabled`, failures);
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
    expect(electronOverlay.restoreFocusDelayMs === 0, `${caseId}: restore focus delay is zero`, failures);
    expect(electronOverlay.activationBoostMs === 0, `${caseId}: activation boost is zero`, failures);
    expect(electronOverlay.activeGraceMs === 0, `${caseId}: active grace is zero`, failures);
  }

  expect(overlayProcesses.available === true, `${caseId}: overlay process diagnostics available`, failures);
  expect(overlayProcesses.platform === "darwin", `${caseId}: overlay process platform is darwin`, failures);
  if (expectedNoOverlayActivation) {
    expect(overlayTargets === 0, `${caseId}: no gameoverlayui target while overlay activation is expected to be skipped`, failures);
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
    verifyPassiveNotification(caseId, resultEvents, lifecycleEntries, nativePresenter, passiveConfig, failures);
  } else {
    expect(activated, `${caseId}: overlay active callback observed`, failures);
    expect(closed, `${caseId}: overlay inactive callback observed after active`, failures);
    verifyOverlayCallbackAppIds(caseId, lifecycleEntries, expectedAppId, failures);
    verifyOverlayCallbackPids(caseId, lifecycleEntries, overlayProcesses, failures);
    expect(parked, `${caseId}: presenter parked after overlay close`, failures);
  }

  if (actionName === "presenter-shortcut") {
    const expectedShortcutTarget =
      typeof metadata.shortcutTarget === "string" && metadata.shortcutTarget.length > 0
        ? metadata.shortcutTarget
        : "friends";
    const shortcutOpen = lifecycleEntries.find((entry) => entry.type === "event:overlay:shortcut-open");
    const shortcutOpenPayload = shortcutOpen ? objectOrEmpty(shortcutOpen.payload) : {};
    expect(
      Boolean(shortcutOpen),
      `${caseId}: managed shortcut open event recorded`,
      failures
    );
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
    parked,
    passive: isPassive,
    overlayTargets,
    overlayGameIds,
    nativeHostBackend: nativePresenter?.backend ?? "none",
    macInteractive,
    zeroTiming,
    shown: managedWaits.required ? managedWaits.shownOk : "n/a",
    managedWaits: managedWaits.required ? managedWaits.ok : "n/a",
    openAndWait: openAndWait.required ? openAndWait.ok : "n/a",
    checkoutWait: checkoutWait.required ? checkoutWait.ok : "n/a",
    checkoutSource: checkoutWait.required
      ? checkoutWait.source || summaryCheckoutSource || "unknown"
      : summaryCheckoutSource || "n/a",
    microTxnCallback: microTxnCallback.required ? microTxnCallback.ok : "n/a",
    nativeHostUnavailable: expectedNativeHostUnavailableReason || "none",
    noOverlayActivation: expectedNoOverlayActivation,
    crashOk
  };
}

function isStoreOverlayAction(actionName) {
  return actionName === "presenter-store" || actionName === "presenter-store-open-and-wait";
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
  if (actionName !== "presenter-checkout") {
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

function verifyPassiveNotification(caseId, resultEvents, entries, presenter, config, failures) {
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
    return true;
  }

  const firstActiveIndex = entries.findIndex(isLifecycleOverlayActiveEvent);
  if (firstActiveIndex === -1) {
    return false;
  }
  const inactiveAfterActiveIndex = entries.findIndex(
    (entry, index) => index > firstActiveIndex && isLifecycleOverlayInactiveEvent(entry)
  );
  if (inactiveAfterActiveIndex === -1) {
    return false;
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
    return false;
  }

  expectParkedPresenter(caseId, firstPresenter, "first close sample", failures);
  expectParkedPresenter(caseId, stablePresenter, "stable close sample", failures);
  expectParkedPresenter(caseId, parkedPresenter, "parked sample", failures);

  if (firstPresenter.pumpCount !== stablePresenter.pumpCount) {
    failures.push(
      `${caseId}: native presenter pump count changed after close: first=${formatValue(firstPresenter.pumpCount)} stable=${formatValue(stablePresenter.pumpCount)}`
    );
  }

  return true;
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
}

function verifyNativeHostUnavailablePresenter(caseId, presenter, expectedReason, failures) {
  expectMacosNeedsPresentPollingDisabled(caseId, presenter, "while host unavailable", failures);
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
  expectPresenterField(caseId, presenter, "transparent", true, "native presenter transparent while unavailable", failures);
  expectPresenterField(caseId, presenter, "overlayActive", false, "native presenter overlay active while unavailable", failures);
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

function expectPresenterField(caseId, presenter, key, expected, label, failures) {
  if (presenter[key] !== expected) {
    failures.push(`${caseId}: ${label} expected ${formatValue(expected)}, got ${formatValue(presenter[key])}`);
  }
}

function runSelfTest() {
  const fixtureRoot = fs.mkdtempSync(path.join(os.tmpdir(), "steam-bridge-macos-matrix-summary."));
  const unredactedFixtureRoot = fs.mkdtempSync(path.join(os.tmpdir(), "steam-bridge-macos-matrix-summary-unredacted."));
  const crashFixtureRoot = fs.mkdtempSync(path.join(os.tmpdir(), "steam-bridge-macos-matrix-summary-crash."));
  const missingMicroTxnFixtureRoot = fs.mkdtempSync(
    path.join(os.tmpdir(), "steam-bridge-macos-matrix-summary-missing-microtxn.")
  );
  const persistentFixtureRoot = fs.mkdtempSync(path.join(os.tmpdir(), "steam-bridge-macos-matrix-summary-persistent."));
  try {
    createSelfTestFixture(fixtureRoot);
    const summary = summarizeMatrixArtifacts(fixtureRoot);
    assert.equal(summary.caseSummaries.length, 6, "summary self-test should include six cases");
    createPersistentSelfTestFixture(persistentFixtureRoot);
    const persistentSummary = summarizeMatrixArtifacts(persistentFixtureRoot);
    assert.equal(persistentSummary.caseSummaries.length, 2, "persistent summary self-test should include two cases");
    createSelfTestFixture(unredactedFixtureRoot);
    injectUnredactedCheckoutManifestCommand(unredactedFixtureRoot);
    assertUnredactedManifestRejected(unredactedFixtureRoot);
    createSelfTestFixture(crashFixtureRoot);
    injectMacosCrashReport(crashFixtureRoot, "01-web-openwait");
    assertMacosCrashReportRejected(crashFixtureRoot);
    createSelfTestFixture(missingMicroTxnFixtureRoot);
    injectMicroTxnCallbackRequirement(missingMicroTxnFixtureRoot, "01-web-openwait");
    assertMissingMicroTxnCallbackRejected(missingMicroTxnFixtureRoot);
    console.log("macOS overlay matrix summary self-test passed.");
  } finally {
    fs.rmSync(fixtureRoot, { recursive: true, force: true });
    fs.rmSync(unredactedFixtureRoot, { recursive: true, force: true });
    fs.rmSync(crashFixtureRoot, { recursive: true, force: true });
    fs.rmSync(missingMicroTxnFixtureRoot, { recursive: true, force: true });
    fs.rmSync(persistentFixtureRoot, { recursive: true, force: true });
  }
}

function injectUnredactedCheckoutManifestCommand(root) {
  const manifestPath = path.join(root, "macos-matrix-cases.jsonl");
  const rows = fs
    .readFileSync(manifestPath, "utf8")
    .trim()
    .split(/\r?\n/)
    .map((line) => JSON.parse(line));
  for (const row of rows) {
    if (row.caseId === "05-checkout") {
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

function createSelfTestFixture(root) {
  fs.mkdirSync(root, { recursive: true });

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
        overlayEnabled: { ok: true, value: true }
      },
      overlay: {
        nativePresenter: { ok: true, value: activePresenterFixture(10) }
      }
    }
  };

  const cases = [
    {
      caseId: "01-web-openwait",
      action: "presenter-web-open-and-wait",
      resultPresenter: activePresenterFixture(10),
      lifecycle: [
        { type: "event:overlay:presenter-open-and-wait-start", payload: { presenter: activePresenterFixture(10) } },
        { type: "event:callback:overlay-activated", payload: { active: true, appId: 480, overlayPid: 9001 } },
        { type: "event:overlay:presenter-wait-shown", payload: { presenter: activePresenterFixture(11) } },
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
      overlayGameId: "15338446133907161088",
      expectedNativeHostBackend: "macos-opengl",
      resultPresenter: activePresenterFixture(14, "macos-opengl"),
      lifecycle: [
        { type: "event:overlay:presenter-open-and-wait-start", payload: { presenter: activePresenterFixture(14, "macos-opengl") } },
        { type: "event:callback:overlay-activated", payload: { active: true, appId: 480, overlayPid: 9001 } },
        { type: "event:overlay:presenter-wait-shown", payload: { presenter: activePresenterFixture(15, "macos-opengl") } },
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
      caseId: "05-checkout",
      action: "presenter-checkout",
      expectedAppId: 9000,
      checkoutSource: "json-file",
      requireMicroTxnCallback: true,
      command: [
        "--action",
        "presenter-checkout",
        "--checkout-json-file",
        REDACTED_COMMAND_VALUE,
        "--checkout-return-url",
        REDACTED_COMMAND_VALUE
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
            shown: activePresenterFixture(31),
            parked: parkedPresenterFixture(32)
          }
        },
        { type: "event:overlay:presenter-after-close-stable", payload: { presenter: parkedPresenterFixture(32) } }
      ]
    },
    {
      caseId: "06-native-host-unavailable",
      action: "presenter-web-open-and-wait",
      resultOk: false,
      actionOk: false,
      actionError: {
        name: "SteamOverlayNativeHostUnavailableError",
        message: "Steam overlay native host is unavailable: macOS screen is locked.",
        code: "STEAM_OVERLAY_NATIVE_HOST_UNAVAILABLE",
        reason: "macos-screen-locked",
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
    if (fixture.actionError) {
      result.action.error = fixture.actionError;
    } else {
      delete result.action.error;
    }
    result.snapshot.overlay.nativePresenter.value = fixture.resultPresenter;
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
      shortcutTarget: fixture.shortcutTarget || null,
      checkoutSource: fixture.checkoutSource || null,
      expectedNativeHostBackend: fixture.expectedNativeHostBackend || null,
      requireActionErrorCode: fixture.requireActionErrorCode || null,
      requireActionErrorReason: fixture.requireActionErrorReason || null,
      requireNativeHostUnavailableReason: fixture.requireNativeHostUnavailableReason || null,
      requireNoOverlayActivation: fixture.requireNoOverlayActivation === true,
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
      command: ["--action", "presenter-shortcut", "--shortcut-target", fixture.shortcutTarget],
      action: "presenter-shortcut",
      shortcutTarget: fixture.shortcutTarget,
      checkoutSource: null,
      expectedNativeHostBackend: null,
      requireActionErrorCode: null,
      requireActionErrorReason: null,
      requireNativeHostUnavailableReason: null,
      requireNoOverlayActivation: false
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
        overlayEnabled: { ok: true, value: true }
      },
      overlay: {
        nativePresenter: {
          ok: true,
          value: withShortcutTargetSnapshot(parkedPresenterFixture(fixture.pumpCount), "function")
        }
      }
    }
  };
}

function persistentShortcutLifecycleFixture(fixture) {
  const pumpCount = fixture.pumpCount;
  return [
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
    { type: "event:callback:overlay-activated", payload: { active: false, appId: 480, overlayPid: 9001 } },
    { type: "event:overlay:presenter-wait-closed", payload: { presenter: parkedPresenterFixture(pumpCount + 2) } },
    { type: "event:overlay:presenter-after-close", payload: { presenter: parkedPresenterFixture(pumpCount + 2) } },
    { type: "event:overlay:presenter-parked", payload: { presenter: parkedPresenterFixture(pumpCount + 2) } },
    { type: "event:overlay:presenter-after-close-stable", payload: { presenter: parkedPresenterFixture(pumpCount + 2) } }
  ];
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
      if (!entry.isFile() || !MACOS_CRASH_REPORT_NAME.test(entry.name)) {
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
