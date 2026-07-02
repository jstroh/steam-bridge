#!/usr/bin/env node

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const RESULT_PREFIX = "STEAM_BRIDGE_SMOKE_RESULT ";
const KNOWN_NATIVE_LOAD_BLOCKERS = new Set([
  "windows-app-control-native-load-block",
  "windows-native-load-gate-failure"
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

  const summary = summarizeWindowsOverlayMatrixArtifacts(options.artifactRoot);
  printSummary(summary);
  if (summary.failures.length > 0) {
    for (const failure of summary.failures) {
      console.error(`FAIL: ${failure}`);
    }
    process.exit(1);
  }
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
  summarize-windows-overlay-matrix.cjs --artifact-root PATH
  summarize-windows-overlay-matrix.cjs --self-test

Audits a Windows overlay matrix artifact root for preflight state, native-load
gate blockers, collected smoke results, overlay callbacks, and crash diagnostics.
`);
}

function summarizeWindowsOverlayMatrixArtifacts(root) {
  const failures = [];
  const warnings = [];
  const caseSummaries = [];
  const steamLaunchBlockers = [];

  if (!fs.existsSync(root)) {
    failures.push(`missing artifact root: ${root}`);
    return {
      root,
      failures,
      warnings,
      preflight: null,
      liveRunReadiness: null,
      nativeLoadBlocker: null,
      manifest: null,
      caseSummaries,
      steamLaunchBlockers,
      totals: buildTotals(caseSummaries)
    };
  }

  const manifest = readJsonIfPresent(path.join(root, "matrix-manifest.json"), failures);
  if (manifest) {
    validateManifest(manifest, failures);
  } else {
    warnings.push(`missing matrix manifest: ${path.join(root, "matrix-manifest.json")}`);
  }

  const preflightDir = path.join(root, "00-preflight");
  const preflight = readJsonIfPresent(path.join(preflightDir, "preflight.json"), failures);
  if (!preflight) {
    failures.push(`missing preflight JSON: ${path.join(preflightDir, "preflight.json")}`);
  } else {
    validatePreflight(preflight, failures);
  }

  const liveRunReadiness = readJsonIfPresent(path.join(preflightDir, "live-run-readiness.json"), failures);
  if (liveRunReadiness) {
    validateLiveRunReadiness(liveRunReadiness, failures);
  }

  const appControlGate = readJsonIfPresent(path.join(preflightDir, "native-load-gate-app-control.json"), failures);
  const nativeLoadBlocker = readJsonIfPresent(path.join(preflightDir, "native-load-gate-blocker.json"), failures);
  if (nativeLoadBlocker) {
    validateNativeLoadBlocker(nativeLoadBlocker, appControlGate, failures);
  }

  for (const caseName of findCaseDirectories(root)) {
    const caseDir = path.join(root, caseName);
    const steamLaunchBlocker = readJsonIfPresent(path.join(caseDir, "steam-launch-blocker.json"), failures);
    if (steamLaunchBlocker) {
      validateSteamLaunchBlocker(steamLaunchBlocker, failures);
      steamLaunchBlockers.push(summarizeSteamLaunchBlocker(caseName, steamLaunchBlocker));
    }

    const resultLog = findResultLog(caseDir);
    if (!resultLog) {
      failures.push(`${caseName}: missing result.log with ${RESULT_PREFIX.trim()} payload`);
      continue;
    }

    let result;
    try {
      result = readSmokeResult(resultLog);
    } catch (error) {
      failures.push(`${caseName}: ${error.message}`);
      continue;
    }

    const renderingHealth = readJsonIfPresent(
      path.join(caseDir, "steam-client", "steam-client-rendering-health.json"),
      failures
    );
    const caseSummary = summarizeCaseResult(caseName, result, resultLog, renderingHealth);
    caseSummaries.push(caseSummary);
    failures.push(...caseSummary.failures);
  }

  if (manifest && !nativeLoadBlocker) {
    validateManifestCoverage(manifest, caseSummaries, failures, warnings);
  }

  if (!nativeLoadBlocker && caseSummaries.length === 0 && !preflight && !liveRunReadiness) {
    failures.push("artifact root does not contain preflight, blocker, readiness, or case result artifacts");
  }

  return {
    root,
    failures,
    warnings,
    preflight: preflight ? summarizePreflight(preflight) : null,
    liveRunReadiness: liveRunReadiness ? summarizeReadiness(liveRunReadiness) : null,
    nativeLoadBlocker: nativeLoadBlocker ? summarizeNativeLoadBlocker(nativeLoadBlocker) : null,
    manifest: manifest ? summarizeManifest(manifest) : null,
    caseSummaries,
    steamLaunchBlockers,
    totals: buildTotals(caseSummaries)
  };
}

function validateManifest(manifest, failures) {
  expect(
    manifest.kind === "steam-bridge-windows-overlay-matrix-manifest",
    "matrix manifest kind is steam-bridge-windows-overlay-matrix-manifest",
    failures
  );
  expect(Boolean(manifest.generatedAt), "matrix manifest generatedAt is present", failures);
  expect(["baseline", "managed", "full", "preflight", "readiness", "shortcut"].includes(manifest.suite), `matrix manifest suite is known: ${manifest.suite}`, failures);
  expect(["steam-launch", "direct"].includes(manifest.launchMode), `matrix manifest launchMode is known: ${manifest.launchMode}`, failures);
  expect(Number.isInteger(manifest.appId), "matrix manifest appId is an integer", failures);
  expect(Array.isArray(manifest.cases), "matrix manifest cases is an array", failures);
  if (Array.isArray(manifest.cases)) {
    expect(
      manifest.expectedCaseCount === manifest.cases.length,
      "matrix manifest expectedCaseCount matches cases length",
      failures
    );
    const seen = new Set();
    for (const entry of manifest.cases) {
      expect(Boolean(entry && entry.id), "matrix manifest case id is present", failures);
      expect(Boolean(entry && entry.action), `matrix manifest case ${entry && entry.id} action is present`, failures);
      if (entry && entry.id) {
        expect(!seen.has(entry.id), `matrix manifest case id is unique: ${entry.id}`, failures);
        seen.add(entry.id);
      }
      if (entry && entry.action) {
        expect(
          typeof entry.hasCheckoutTransactionId === "boolean",
          `matrix manifest case ${entry.id} records checkout transaction presence without raw value`,
          failures
        );
      }
    }
  }
}

function validateManifestCoverage(manifest, caseSummaries, failures, warnings) {
  const expectedCases = Array.isArray(manifest.cases) ? manifest.cases : [];
  const summariesByCase = new Map(caseSummaries.map((row) => [row.caseName, row]));
  for (const expected of expectedCases) {
    const row = summariesByCase.get(expected.id);
    if (!row) {
      failures.push(`matrix manifest case missing result: ${expected.id} (${expected.action})`);
      continue;
    }
    expect(row.action === expected.action, `matrix manifest case ${expected.id} action matches result`, failures);
    expect(row.appId === manifest.appId, `matrix manifest case ${expected.id} App ID matches manifest`, failures);
    if (manifest.launchMode === "steam-launch") {
      expect(row.steamLaunch === true, `matrix manifest case ${expected.id} was Steam-launched`, failures);
      expect(
        row.steamOverlayLaunchMarker === true,
        `matrix manifest case ${expected.id} has Steam overlay launch marker`,
        failures
      );
    }
    if (expected.requireOverlayActivated === true) {
      expect(row.overlayActiveEvents > 0, `matrix manifest case ${expected.id} emitted overlay active callback`, failures);
    }
    if (expected.requireNoOverlayActivation === true) {
      expect(row.overlayActiveEvents === 0, `matrix manifest case ${expected.id} did not emit overlay active callback`, failures);
    }
    for (const eventType of Array.isArray(expected.requireEvent) ? expected.requireEvent : []) {
      expect(row.eventTypes.includes(eventType), `matrix manifest case ${expected.id} emitted required event ${eventType}`, failures);
    }
    if (expected.requireManagedOverlayComplete === true) {
      expect(
        row.managedOverlayResultMode === "complete",
        `matrix manifest case ${expected.id} used complete managed overlay result mode`,
        failures
      );
      expect(row.overlayInactiveEvents > 0, `matrix manifest case ${expected.id} emitted overlay inactive callback`, failures);
      expect(row.wait && row.wait.overlayClosed === true, `matrix manifest case ${expected.id} completed overlay close wait`, failures);
      expect(row.wait && row.wait.overlayParked === true, `matrix manifest case ${expected.id} completed overlay park wait`, failures);
      expect(row.wait && row.wait.overlayComplete === true, `matrix manifest case ${expected.id} completed managed overlay wait`, failures);
    }
  }

  for (const row of caseSummaries) {
    if (!expectedCases.some((expected) => expected.id === row.caseName)) {
      warnings.push(`case result was not listed in matrix manifest: ${row.caseName}`);
    }
  }
}

function validatePreflight(preflight, failures) {
  expect(preflight.kind === "steam-bridge-windows-preflight", "preflight kind is steam-bridge-windows-preflight", failures);
  expect(Boolean(preflight.generatedAt), "preflight generatedAt is present", failures);
  if (preflight.windowsSession) {
    expect(
      typeof preflight.windowsSession.currentSessionId === "number",
      "preflight windowsSession.currentSessionId is numeric",
      failures
    );
    expect(
      Array.isArray(preflight.windowsSession.interactiveSessionIds),
      "preflight windowsSession.interactiveSessionIds is an array",
      failures
    );
  }
  if (preflight.app) {
    expect(Boolean(preflight.app.exe && preflight.app.exe.exists), "preflight app executable exists", failures);
    expect(Boolean(preflight.app.nativeAddon && preflight.app.nativeAddon.exists), "preflight native addon exists", failures);
  }
  if (preflight.appControlPolicy) {
    expect(
      typeof preflight.appControlPolicy.verifiedAndReputableEnforced === "boolean",
      "preflight appControlPolicy.verifiedAndReputableEnforced is boolean",
      failures
    );
  }
}

function validateLiveRunReadiness(readiness, failures) {
  expect(
    readiness.kind === "steam-bridge-windows-live-run-readiness",
    "live-run readiness kind is steam-bridge-windows-live-run-readiness",
    failures
  );
  expect(typeof readiness.ready === "boolean", "live-run readiness ready is boolean", failures);
  expect(Array.isArray(readiness.errors), "live-run readiness errors is an array", failures);
  expect(Array.isArray(readiness.warnings), "live-run readiness warnings is an array", failures);
  if (readiness.windowsSession) {
    expect(
      typeof readiness.windowsSession.currentSessionId === "number",
      "live-run readiness windowsSession.currentSessionId is numeric",
      failures
    );
    expect(
      Array.isArray(readiness.windowsSession.interactiveSessionIds),
      "live-run readiness windowsSession.interactiveSessionIds is an array",
      failures
    );
    expect(
      typeof readiness.windowsSession.currentSessionInteractive === "boolean",
      "live-run readiness windowsSession.currentSessionInteractive is boolean",
      failures
    );
  }
}

function validateNativeLoadBlocker(blocker, appControlGate, failures) {
  expect(
    blocker.kind === "steam-bridge-windows-native-load-gate-blocker",
    "native-load blocker kind is steam-bridge-windows-native-load-gate-blocker",
    failures
  );
  expect(KNOWN_NATIVE_LOAD_BLOCKERS.has(blocker.blockerCode), `native-load blocker code is known: ${blocker.blockerCode}`, failures);
  expect(Boolean(blocker.generatedAt), "native-load blocker generatedAt is present", failures);
  expect(Boolean(blocker.originalError), "native-load blocker originalError is present", failures);
  expect(Boolean(blocker.paths && blocker.paths.gateLog), "native-load blocker gate log path is present", failures);
  expect(Boolean(blocker.paths && blocker.paths.postGatePreflightJson), "native-load blocker post-gate preflight JSON path is present", failures);
  expect(Array.isArray(blocker.nextActions) && blocker.nextActions.length > 0, "native-load blocker next actions are present", failures);
  expect(
    Array.isArray(blocker.postGateCodeIntegrityEvents),
    "native-load blocker postGateCodeIntegrityEvents is an array",
    failures
  );

  if (blocker.blockerCode === "windows-app-control-native-load-block") {
    expect(
      blocker.verifiedAndReputableBlock === true || blocker.codeIntegrityPolicyBlock === true,
      "App Control native-load blocker has a verified/reputable or Code Integrity signal",
      failures
    );
    expect(Boolean(blocker.appControl), "App Control native-load blocker includes appControl summary", failures);
    if (blocker.appControl) {
      expect(
        blocker.appControl.verifiedAndReputableEnforced === true,
        "App Control native-load blocker records verifiedAndReputableEnforced=true",
        failures
      );
    }
    if (appControlGate) {
      expect(
        appControlGate.verifiedAndReputableEnforced === true,
        "native-load gate App Control summary records verifiedAndReputableEnforced=true",
        failures
      );
    }
    expect(
      Array.isArray(blocker.postGateCodeIntegrityEvents) && blocker.postGateCodeIntegrityEvents.length > 0,
      "App Control native-load blocker includes post-gate Code Integrity events",
      failures
    );
  }
}

function validateSteamLaunchBlocker(blocker, failures) {
  expect(
    blocker.kind === "steam-bridge-windows-steam-launch-blocker",
    "Steam-launch blocker kind is steam-bridge-windows-steam-launch-blocker",
    failures
  );
  expect(Boolean(blocker.generatedAt), "Steam-launch blocker generatedAt is present", failures);
  expect(
    ["windows-app-control-steam-launch-block", "windows-steam-launch-no-result"].includes(blocker.blockerCode),
    `Steam-launch blocker code is known: ${blocker.blockerCode}`,
    failures
  );
  expect(Boolean(blocker.caseId), "Steam-launch blocker caseId is present", failures);
  expect(Boolean(blocker.action), "Steam-launch blocker action is present", failures);
  expect(typeof blocker.codeIntegrityPolicyBlock === "boolean", "Steam-launch blocker codeIntegrityPolicyBlock is boolean", failures);
  expect(typeof blocker.steamProcessPolicyBlock === "boolean", "Steam-launch blocker steamProcessPolicyBlock is boolean", failures);
  expect(
    Array.isArray(blocker.postCaseCodeIntegrityEvents),
    "Steam-launch blocker postCaseCodeIntegrityEvents is an array",
    failures
  );
  expect(Array.isArray(blocker.nextActions) && blocker.nextActions.length > 0, "Steam-launch blocker next actions are present", failures);
}

function hasSteamOverlayLaunchMarker(launch) {
  if (launch.overlayInjection === true) {
    return true;
  }

  const env = objectOrEmpty(launch.env);
  return ["SteamOverlayGameId", "SteamClientLaunch", "SteamEnv"].some((key) => {
    const value = env[key];
    return typeof value === "string" && value.length > 0;
  });
}

function summarizeCaseResult(caseName, result, resultLog, renderingHealth = null) {
  const failures = [];
  const snapshot = objectOrEmpty(result.snapshot);
  const app = objectOrEmpty(snapshot.app);
  const processInfo = objectOrEmpty(snapshot.process);
  const launch = objectOrEmpty(snapshot.launch);
  const steam = objectOrEmpty(snapshot.steam);
  const crashDiagnostics = objectOrEmpty(snapshot.crashDiagnostics);
  const action = objectOrEmpty(result.action);
  const events = Array.isArray(snapshot.events) ? snapshot.events : [];
  const overlayActiveEvents = events.filter(isOverlayActiveEvent).length;
  const overlayInactiveEvents = events.filter(isOverlayInactiveEvent).length;
  const crashDumps = Array.isArray(crashDiagnostics.crashDumps) ? crashDiagnostics.crashDumps : [];
  const fatalLifecycleEvents = Array.isArray(crashDiagnostics.fatalLifecycleEvents)
    ? crashDiagnostics.fatalLifecycleEvents
    : [];
  const overlayEnabled = readOkValue(steam.overlayEnabled);
  const overlayNeedsPresent = readOkValue(steam.overlayNeedsPresent);

  expect(result.ok === true, `${caseName}: smoke result ok`, failures);
  expect(action.ok === true, `${caseName}: autorun action succeeded`, failures);
  expect(steam.initialized === true, `${caseName}: Steam initialized`, failures);
  expect(readOkValue(steam.running) === true, `${caseName}: Steam running`, failures);
  expect(readOkValue(steam.appId) === app.appId, `${caseName}: Steam App ID matches app config`, failures);
  expect(processInfo.platform === "win32", `${caseName}: platform is win32`, failures);
  expect(processInfo.arch === "x64", `${caseName}: arch is x64`, failures);
  expect(crashDiagnostics.available === true, `${caseName}: crash diagnostics available`, failures);
  expect(crashDiagnostics.ok === true, `${caseName}: no crash diagnostics reported`, failures);
  expect(crashDumps.length === 0, `${caseName}: no crash dumps found`, failures);
  expect(fatalLifecycleEvents.length === 0, `${caseName}: no fatal lifecycle events found`, failures);

  const steamRenderingHealth = summarizeCaseRenderingHealth(renderingHealth);

  return {
    caseName,
    action: String(action.action || ""),
    resultLog,
    appId: app.appId,
    managedOverlayResultMode: app.managedOverlayResultMode || "",
    processId: processInfo.pid || null,
    steamLaunch: launch.steamLaunch === true,
    overlayInjection: launch.overlayInjection === true,
    steamOverlayLaunchMarker: hasSteamOverlayLaunchMarker(launch),
    overlayEnabled,
    overlayNeedsPresent,
    overlayActiveEvents,
    overlayInactiveEvents,
    eventTypes: events.map((event) => event && event.type).filter(Boolean),
    wait: result.wait && typeof result.wait === "object" && !Array.isArray(result.wait) ? result.wait : null,
    crashDumpCount: crashDumps.length,
    fatalLifecycleEventCount: fatalLifecycleEvents.length,
    steamRenderingHealth,
    failures
  };
}

function printSummary(summary) {
  console.log(`Windows overlay matrix summary: ${summary.root}`);
  if (summary.manifest) {
    console.log(
      `manifest: suite=${summary.manifest.suite} launchMode=${summary.manifest.launchMode} ` +
        `expectedCases=${summary.manifest.expectedCaseCount} onlyCase=${summary.manifest.onlyCase || "none"}`
    );
  }
  if (summary.preflight) {
    console.log(
      `preflight: generated=${summary.preflight.generatedAt || "unknown"} ` +
        `appControlVerifiedAndReputable=${formatValue(summary.preflight.verifiedAndReputableEnforced)} ` +
        `session=${formatValue(summary.preflight.currentSessionId)}`
    );
  }
  if (summary.liveRunReadiness) {
    console.log(
      `readiness: ready=${summary.liveRunReadiness.ready} ` +
        `errors=${summary.liveRunReadiness.errorCount} warnings=${summary.liveRunReadiness.warningCount} ` +
        `session=${formatValue(summary.liveRunReadiness.currentSessionId)} ` +
        `interactive=${formatValue(summary.liveRunReadiness.currentSessionInteractive)}`
    );
  }
  if (summary.nativeLoadBlocker) {
    console.log(
      `native-load blocker: code=${summary.nativeLoadBlocker.blockerCode} ` +
        `verifiedAndReputable=${summary.nativeLoadBlocker.verifiedAndReputableBlock} ` +
        `codeIntegrityPolicy=${summary.nativeLoadBlocker.codeIntegrityPolicyBlock} ` +
        `events=${summary.nativeLoadBlocker.postGateCodeIntegrityEventCount}`
    );
  }
  if (summary.steamLaunchBlockers.length > 0) {
    console.log(`steam-launch blockers: total=${summary.steamLaunchBlockers.length}`);
    for (const blocker of summary.steamLaunchBlockers) {
      console.log(
        `  ${blocker.caseName}: code=${blocker.blockerCode} ` +
          `codeIntegrityPolicy=${blocker.codeIntegrityPolicyBlock} ` +
          `steamProcessPolicy=${blocker.steamProcessPolicyBlock} ` +
          `events=${blocker.postCaseCodeIntegrityEventCount}`
      );
    }
  }
  if (summary.caseSummaries.length > 0) {
    console.log(
      `cases: total=${summary.totals.totalCases} steamLaunch=${summary.totals.steamLaunchCases} ` +
        `overlayActive=${summary.totals.overlayActiveCases} clean=${summary.totals.cleanCases}`
    );
    for (const row of summary.caseSummaries) {
      const ok = row.failures.length === 0 ? "ok" : "fail";
      console.log(
        `  ${row.caseName}: ${ok} action=${row.action || "unknown"} ` +
          `steamLaunch=${row.steamLaunch} steamOverlayLaunchMarker=${row.steamOverlayLaunchMarker} ` +
          `overlayActiveEvents=${row.overlayActiveEvents} ` +
          `overlayEnabled=${formatValue(row.overlayEnabled)} crashes=${row.crashDumpCount + row.fatalLifecycleEventCount}` +
          formatCaseRenderingHealth(row.steamRenderingHealth)
      );
    }
  } else {
    console.log("cases: none");
  }
  for (const warning of summary.warnings) {
    console.log(`warning: ${warning}`);
  }
}

function summarizePreflight(preflight) {
  const appControl = preflight.appControl || preflight.appControlPolicy || {};
  const windowsSession = preflight.windowsSession || {};
  return {
    generatedAt: preflight.generatedAt || "",
    verifiedAndReputableEnforced: Boolean(appControl.verifiedAndReputableEnforced),
    currentSessionId: windowsSession.currentSessionId,
    recentCodeIntegrityEventCount: Array.isArray(preflight.recentCodeIntegrityEvents)
      ? preflight.recentCodeIntegrityEvents.length
      : 0
  };
}

function summarizeManifest(manifest) {
  return {
    suite: manifest.suite || "",
    launchMode: manifest.launchMode || "",
    appId: manifest.appId,
    onlyCase: manifest.onlyCase || "",
    expectedCaseCount: Array.isArray(manifest.cases) ? manifest.cases.length : 0
  };
}

function summarizeReadiness(readiness) {
  const windowsSession = readiness.windowsSession || {};
  return {
    ready: readiness.ready === true,
    errorCount: Array.isArray(readiness.errors) ? readiness.errors.length : 0,
    warningCount: Array.isArray(readiness.warnings) ? readiness.warnings.length : 0,
    currentSessionId: windowsSession.currentSessionId,
    currentSessionInteractive: windowsSession.currentSessionInteractive
  };
}

function summarizeNativeLoadBlocker(blocker) {
  return {
    blockerCode: blocker.blockerCode || "",
    verifiedAndReputableBlock: blocker.verifiedAndReputableBlock === true,
    codeIntegrityPolicyBlock: blocker.codeIntegrityPolicyBlock === true,
    postGateCodeIntegrityEventCount: Array.isArray(blocker.postGateCodeIntegrityEvents)
      ? blocker.postGateCodeIntegrityEvents.length
      : 0
  };
}

function summarizeSteamLaunchBlocker(caseName, blocker) {
  return {
    caseName,
    blockerCode: blocker.blockerCode || "",
    codeIntegrityPolicyBlock: blocker.codeIntegrityPolicyBlock === true,
    steamProcessPolicyBlock: blocker.steamProcessPolicyBlock === true,
    postCaseCodeIntegrityEventCount: Array.isArray(blocker.postCaseCodeIntegrityEvents)
      ? blocker.postCaseCodeIntegrityEvents.length
      : 0
  };
}

function summarizeCaseRenderingHealth(renderingHealth) {
  if (!renderingHealth || typeof renderingHealth !== "object" || Array.isArray(renderingHealth)) {
    return null;
  }

  const recentSignals = Array.isArray(renderingHealth.recentSevereSignals)
    ? renderingHealth.recentSevereSignals
    : [];
  const staleSignals = Array.isArray(renderingHealth.staleSevereSignals)
    ? renderingHealth.staleSevereSignals
    : [];
  const signalCodes = uniqueStrings(
    [...recentSignals, ...staleSignals]
      .map((signal) => signal && signal.code)
      .filter(Boolean)
  );

  return {
    status: renderingHealth.status || "unknown",
    recentSevereSignalCount: Number(renderingHealth.recentSevereSignalCount || 0),
    staleSevereSignalCount: Number(renderingHealth.staleSevereSignalCount || 0),
    signalCodes
  };
}

function buildTotals(caseSummaries) {
  return {
    totalCases: caseSummaries.length,
    steamLaunchCases: caseSummaries.filter((row) => row.steamLaunch).length,
    overlayActiveCases: caseSummaries.filter((row) => row.overlayActiveEvents > 0).length,
    cleanCases: caseSummaries.filter((row) => row.failures.length === 0).length,
    renderingUnhealthyCases: caseSummaries.filter(
      (row) => row.steamRenderingHealth && row.steamRenderingHealth.status === "unhealthy"
    ).length
  };
}

function findCaseDirectories(root) {
  return fs
    .readdirSync(root, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .filter((name) => name !== "00-preflight")
    .filter((name) => fs.existsSync(path.join(root, name, "result.log")) || fs.existsSync(path.join(root, name, "helper.log")))
    .sort();
}

function findResultLog(caseDir) {
  const directResult = path.join(caseDir, "result.log");
  if (fs.existsSync(directResult)) {
    return directResult;
  }
  const helperLog = path.join(caseDir, "helper.log");
  if (fs.existsSync(helperLog) && readText(helperLog).includes(RESULT_PREFIX)) {
    return helperLog;
  }
  return "";
}

function readSmokeResult(resultLog) {
  const line = readText(resultLog)
    .split(/\r?\n/)
    .filter((entry) => entry.startsWith(RESULT_PREFIX))
    .at(-1);
  if (!line) {
    throw new Error(`missing ${RESULT_PREFIX.trim()} line in ${resultLog}`);
  }
  try {
    return JSON.parse(line.slice(RESULT_PREFIX.length));
  } catch (error) {
    throw new Error(`could not parse smoke result JSON in ${resultLog}: ${error.message}`);
  }
}

function readJsonIfPresent(file, failures) {
  if (!fs.existsSync(file)) {
    return null;
  }
  try {
    return JSON.parse(readText(file));
  } catch (error) {
    failures.push(`could not parse JSON ${file}: ${error.message}`);
    return null;
  }
}

function readText(file) {
  return fs.readFileSync(file, "utf8");
}

function readOkValue(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return value;
  }
  if (Object.prototype.hasOwnProperty.call(value, "value")) {
    return value.value;
  }
  return value;
}

function objectOrEmpty(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function isOverlayActiveEvent(event) {
  if (!event || event.type !== "callback:overlay-activated") {
    return false;
  }
  const payload = normalizeOverlayPayload(event.payload);
  return payload === true || payload === 1 || payload.active === true || payload.active === 1 || payload.m_bActive === true || payload.m_bActive === 1;
}

function isOverlayInactiveEvent(event) {
  if (!event || event.type !== "callback:overlay-activated") {
    return false;
  }
  const payload = normalizeOverlayPayload(event.payload);
  return (
    payload === false ||
    payload === 0 ||
    payload.active === false ||
    payload.active === 0 ||
    payload.m_bActive === false ||
    payload.m_bActive === 0
  );
}

function normalizeOverlayPayload(payload) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return payload;
  }
  if (payload["0"] && typeof payload["0"] === "object") {
    return payload["0"];
  }
  return payload;
}

function expect(condition, message, failures) {
  if (!condition) {
    failures.push(message);
  }
}

function formatValue(value) {
  return value === undefined ? "unknown" : String(value);
}

function formatCaseRenderingHealth(renderingHealth) {
  if (!renderingHealth || renderingHealth.status === "healthy") {
    return "";
  }

  const codes = renderingHealth.signalCodes.length > 0
    ? renderingHealth.signalCodes.join(",")
    : "none";
  return (
    ` rendering=${renderingHealth.status}` +
    ` recentSignals=${renderingHealth.recentSevereSignalCount}` +
    ` staleSignals=${renderingHealth.staleSevereSignalCount}` +
    ` codes=${codes}`
  );
}

function uniqueStrings(values) {
  return Array.from(new Set(values.map((value) => String(value)))).sort();
}

function runSelfTest() {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "steam-bridge-windows-summary-"));
  try {
    const blockedRoot = path.join(tempRoot, "blocked");
    writeBlockedFixture(blockedRoot);
    const blockedSummary = summarizeWindowsOverlayMatrixArtifacts(blockedRoot);
    assert.deepEqual(blockedSummary.failures, []);
    assert.equal(blockedSummary.nativeLoadBlocker.blockerCode, "windows-app-control-native-load-block");
    assert.equal(blockedSummary.caseSummaries.length, 0);

    const casesRoot = path.join(tempRoot, "cases");
    writeCaseFixture(casesRoot);
    const casesSummary = summarizeWindowsOverlayMatrixArtifacts(casesRoot);
    assert.deepEqual(casesSummary.failures, []);
    assert.equal(casesSummary.caseSummaries.length, 2);
    assert.equal(casesSummary.totals.steamLaunchCases, 2);
    assert.equal(casesSummary.totals.overlayActiveCases, 1);
    assert.equal(casesSummary.totals.cleanCases, 2);
    assert.equal(casesSummary.totals.renderingUnhealthyCases, 1);
    assert.deepEqual(casesSummary.caseSummaries[0].steamRenderingHealth.signalCodes, [
      "steam-cef-dxgi-not-currently-available",
      "steam-overlay-swapchain-failure"
    ]);
    assert.equal(casesSummary.liveRunReadiness.ready, true);
    assert.equal(casesSummary.manifest.expectedCaseCount, 2);

    const managedRoot = path.join(tempRoot, "managed");
    writeManagedCaseFixture(managedRoot);
    const managedSummary = summarizeWindowsOverlayMatrixArtifacts(managedRoot);
    assert.deepEqual(managedSummary.failures, []);
    assert.equal(managedSummary.caseSummaries.length, 1);
    assert.equal(managedSummary.totals.overlayActiveCases, 1);

    const steamLaunchBlockedRoot = path.join(tempRoot, "steam-launch-blocked");
    writeSteamLaunchBlockedFixture(steamLaunchBlockedRoot);
    const steamLaunchBlockedSummary = summarizeWindowsOverlayMatrixArtifacts(steamLaunchBlockedRoot);
    assert.equal(steamLaunchBlockedSummary.steamLaunchBlockers.length, 1);
    assert.equal(steamLaunchBlockedSummary.steamLaunchBlockers[0].blockerCode, "windows-app-control-steam-launch-block");
    assert(
      steamLaunchBlockedSummary.failures.some((failure) => failure.includes("99-none: missing result.log")),
      "summary self-test should still fail when a Steam-launched case has no smoke result"
    );

    const incompleteRoot = path.join(tempRoot, "incomplete");
    writeCaseFixture(incompleteRoot);
    fs.rmSync(path.join(incompleteRoot, "99-none"), { recursive: true, force: true });
    const incompleteSummary = summarizeWindowsOverlayMatrixArtifacts(incompleteRoot);
    assert(
      incompleteSummary.failures.some((failure) => failure.includes("matrix manifest case missing result: 99-none")),
      "summary self-test should fail when a manifest-listed case result is missing"
    );

    const missingEventRoot = path.join(tempRoot, "missing-event");
    writeCaseFixture(missingEventRoot);
    writeResult(path.join(missingEventRoot, "01-web", "result.log"), {
      ok: true,
      action: { ok: true, action: "web" },
      snapshot: buildWindowsSnapshot({
        pid: 4244,
        events: [{ type: "callback:overlay-activated", payload: { active: true } }]
      })
    });
    const missingEventSummary = summarizeWindowsOverlayMatrixArtifacts(missingEventRoot);
    assert(
      missingEventSummary.failures.some((failure) => failure.includes("emitted required event overlay:web")),
      "summary self-test should fail when a manifest-required event is missing"
    );

    const missingManagedCloseRoot = path.join(tempRoot, "missing-managed-close");
    writeManagedCaseFixture(missingManagedCloseRoot, { omitWait: true });
    const missingManagedCloseSummary = summarizeWindowsOverlayMatrixArtifacts(missingManagedCloseRoot);
    assert(
      missingManagedCloseSummary.failures.some((failure) => failure.includes("completed overlay close wait")),
      "summary self-test should fail when managed completion waits are missing"
    );

    const missingLaunchMarkerRoot = path.join(tempRoot, "missing-launch-marker");
    writeCaseFixture(missingLaunchMarkerRoot);
    writeResult(path.join(missingLaunchMarkerRoot, "01-web", "result.log"), {
      ok: true,
      action: { ok: true, action: "web" },
      snapshot: buildWindowsSnapshot({
        pid: 4246,
        steamOverlayLaunchMarker: false,
        events: [{ type: "overlay:web" }, { type: "callback:overlay-activated", payload: { active: true } }]
      })
    });
    const missingLaunchMarkerSummary = summarizeWindowsOverlayMatrixArtifacts(missingLaunchMarkerRoot);
    assert(
      missingLaunchMarkerSummary.failures.some((failure) => failure.includes("has Steam overlay launch marker")),
      "summary self-test should fail when a Steam-launched case has no Windows Steam overlay launch marker"
    );

    console.log("Windows overlay matrix summary self-test passed.");
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
}

function writeBlockedFixture(root) {
  writeJson(path.join(root, "matrix-manifest.json"), {
    kind: "steam-bridge-windows-overlay-matrix-manifest",
    generatedAt: "2026-07-02T00:00:00.000Z",
    suite: "baseline",
    launchMode: "steam-launch",
    appId: 480,
    onlyCase: "",
    expectedCaseCount: 2,
    cases: [
      {
        id: "01-web",
        action: "web",
        requireEvent: ["overlay:web"],
        requireOverlayActivated: true,
        requireNoOverlayActivation: false,
        allowOverlayNotReady: false,
        requireManagedOverlayComplete: false,
        managedOverlayResultMode: "",
        hasCheckoutTransactionId: false
      },
      {
        id: "99-none",
        action: "none",
        requireEvent: [],
        requireOverlayActivated: false,
        requireNoOverlayActivation: true,
        allowOverlayNotReady: true,
        requireManagedOverlayComplete: false,
        managedOverlayResultMode: "",
        hasCheckoutTransactionId: false
      }
    ]
  });
  writeJson(path.join(root, "00-preflight", "preflight.json"), {
    kind: "steam-bridge-windows-preflight",
    generatedAt: "2026-07-02T00:00:00.000Z",
    app: {
      exe: { exists: true },
      nativeAddon: { exists: true }
    },
    appControlPolicy: {
      verifiedAndReputableEnforced: true
    },
    recentCodeIntegrityEvents: [],
    windowsSession: {
      currentSessionId: 1,
      interactiveSessionIds: [1],
      currentSessionInteractive: true
    }
  });
  const appControl = {
    verifiedAndReputableEnforced: true,
    enforcedPolicyNames: ["VerifiedAndReputableDesktop"]
  };
  writeJson(path.join(root, "00-preflight", "native-load-gate-app-control.json"), appControl);
  writeJson(path.join(root, "00-preflight", "native-load-gate-blocker.json"), {
    kind: "steam-bridge-windows-native-load-gate-blocker",
    generatedAt: "2026-07-02T00:00:01.000Z",
    blockerCode: "windows-app-control-native-load-block",
    verifiedAndReputableBlock: true,
    codeIntegrityPolicyBlock: false,
    originalError: "windows-electron-smoke.ps1 exited with code 1",
    paths: {
      gateLog: "native-load-gate/helper.log",
      postGatePreflightLog: "native-load-gate/post-gate-preflight.log",
      postGatePreflightJson: "native-load-gate/post-gate-preflight.json",
      diagnosticDir: "native-load-gate/diagnostics"
    },
    appControl,
    postGateCodeIntegrityEvents: [{ providerName: "Microsoft-Windows-CodeIntegrity" }],
    nextActions: ["Use a trusted and reputable publisher-signed package."]
  });
}

function writeCaseFixture(root) {
  writeJson(path.join(root, "matrix-manifest.json"), {
    kind: "steam-bridge-windows-overlay-matrix-manifest",
    generatedAt: "2026-07-02T00:00:00.000Z",
    suite: "baseline",
    launchMode: "steam-launch",
    appId: 480,
    onlyCase: "",
    expectedCaseCount: 2,
    cases: [
      {
        id: "01-web",
        action: "web",
        requireEvent: ["overlay:web"],
        requireOverlayActivated: true,
        requireNoOverlayActivation: false,
        allowOverlayNotReady: false,
        requireManagedOverlayComplete: false,
        managedOverlayResultMode: "",
        hasCheckoutTransactionId: false
      },
      {
        id: "99-none",
        action: "none",
        requireEvent: [],
        requireOverlayActivated: false,
        requireNoOverlayActivation: true,
        allowOverlayNotReady: true,
        requireManagedOverlayComplete: false,
        managedOverlayResultMode: "",
        hasCheckoutTransactionId: false
      }
    ]
  });
  writeJson(path.join(root, "00-preflight", "preflight.json"), {
    kind: "steam-bridge-windows-preflight",
    generatedAt: "2026-07-02T00:00:00.000Z",
    app: {
      exe: { exists: true },
      nativeAddon: { exists: true }
    },
    appControlPolicy: {
      verifiedAndReputableEnforced: false
    },
    recentCodeIntegrityEvents: [],
    windowsSession: {
      currentSessionId: 1,
      interactiveSessionIds: [1],
      currentSessionInteractive: true
    }
  });
  writeJson(path.join(root, "00-preflight", "live-run-readiness.json"), {
    kind: "steam-bridge-windows-live-run-readiness",
    generatedAt: "2026-07-02T00:00:00.000Z",
    ready: true,
    windowsSession: {
      currentSessionId: 1,
      interactiveSessionIds: [1],
      currentSessionInteractive: true
    },
    errors: [],
    warnings: []
  });
  writeResult(path.join(root, "01-web", "result.log"), {
    ok: true,
    action: { ok: true, action: "web" },
    snapshot: buildWindowsSnapshot({
      pid: 4242,
      events: [{ type: "overlay:web" }, { type: "callback:overlay-activated", payload: { active: true } }]
    })
  });
  writeJson(path.join(root, "01-web", "steam-client", "steam-client-rendering-health.json"), {
    kind: "steam-bridge-windows-steam-client-rendering-health",
    generatedAt: "2026-07-02T00:00:03.000Z",
    status: "unhealthy",
    healthy: false,
    recentWindowMinutes: 30,
    logDirectory: "C:\\Program Files (x86)\\Steam\\logs",
    recentSevereSignalCount: 2,
    staleSevereSignalCount: 0,
    recentSevereSignals: [
      {
        code: "steam-cef-dxgi-not-currently-available",
        logFile: "gameoverlay_renderer.txt",
        tailLine: 42,
        timestampUtc: "2026-07-02T00:00:02.000Z",
        recent: true,
        line: "g_IDXGIFactory2_CreateSwapChainForHWND failed, hres=887a0022"
      },
      {
        code: "steam-overlay-swapchain-failure",
        logFile: "gameoverlay_renderer.txt",
        tailLine: 43,
        timestampUtc: "2026-07-02T00:00:02.000Z",
        recent: true,
        line: "CreateSwapChainForHWND failed"
      }
    ],
    staleSevereSignals: [],
    warnings: []
  });
  writeResult(path.join(root, "99-none", "result.log"), {
    ok: true,
    action: { ok: true, action: "none" },
    snapshot: buildWindowsSnapshot({ pid: 4243, events: [] })
  });
}

function writeSteamLaunchBlockedFixture(root) {
  writeJson(path.join(root, "matrix-manifest.json"), {
    kind: "steam-bridge-windows-overlay-matrix-manifest",
    generatedAt: "2026-07-02T00:00:00.000Z",
    suite: "baseline",
    launchMode: "steam-launch",
    appId: 480,
    onlyCase: "99-none",
    expectedCaseCount: 1,
    cases: [
      {
        id: "99-none",
        action: "none",
        requireEvent: [],
        requireOverlayActivated: false,
        requireNoOverlayActivation: true,
        allowOverlayNotReady: true,
        requireManagedOverlayComplete: false,
        managedOverlayResultMode: "",
        hasCheckoutTransactionId: false
      }
    ]
  });
  writeJson(path.join(root, "00-preflight", "preflight.json"), {
    kind: "steam-bridge-windows-preflight",
    generatedAt: "2026-07-02T00:00:00.000Z",
    app: {
      exe: { exists: true },
      nativeAddon: { exists: true }
    },
    appControl: {
      verifiedAndReputableEnforced: true
    },
    recentCodeIntegrityEvents: [],
    windowsSession: {
      currentSessionId: 1,
      interactiveSessionIds: [1],
      currentSessionInteractive: true
    }
  });
  writeJson(path.join(root, "00-preflight", "live-run-readiness.json"), {
    kind: "steam-bridge-windows-live-run-readiness",
    generatedAt: "2026-07-02T00:00:00.000Z",
    ready: true,
    windowsSession: {
      currentSessionId: 1,
      interactiveSessionIds: [1],
      currentSessionInteractive: true
    },
    errors: [],
    warnings: []
  });
  writeText(path.join(root, "99-none", "helper.log"), "Timed out waiting for smoke result file\n");
  writeJson(path.join(root, "99-none", "steam-launch-blocker.json"), {
    kind: "steam-bridge-windows-steam-launch-blocker",
    generatedAt: "2026-07-02T00:00:01.000Z",
    blockerCode: "windows-app-control-steam-launch-block",
    caseId: "99-none",
    action: "none",
    codeIntegrityPolicyBlock: true,
    steamProcessPolicyBlock: true,
    originalError: "windows-electron-smoke.ps1 exited with code 1",
    paths: {
      postCasePreflightLog: "99-none/post-case-preflight.log",
      postCasePreflightJson: "99-none/post-case-preflight.json"
    },
    appControl: {
      verifiedAndReputableEnforced: true
    },
    postCaseCodeIntegrityEvents: [
      {
        message:
          "Code Integrity determined that a process (\\Device\\HarddiskVolume3\\Program Files (x86)\\Steam\\steam.exe) attempted to load SteamBridgeSmoke.exe that did not meet the Enterprise signing level requirements."
      }
    ],
    nextActions: ["Use a trusted and reputable publisher-signed package."]
  });
}

function writeManagedCaseFixture(root, options = {}) {
  writeJson(path.join(root, "matrix-manifest.json"), {
    kind: "steam-bridge-windows-overlay-matrix-manifest",
    generatedAt: "2026-07-02T00:00:00.000Z",
    suite: "managed",
    launchMode: "steam-launch",
    appId: 480,
    onlyCase: "",
    expectedCaseCount: 1,
    cases: [
      {
        id: "11-managed-web-open-and-wait",
        action: "presenter-web-open-and-wait",
        requireEvent: [
          "overlay:presenter-open-and-wait-start",
          "overlay:presenter-wait-closed",
          "overlay:presenter-parked",
          "overlay:presenter-open-and-wait-complete"
        ],
        requireOverlayActivated: true,
        requireNoOverlayActivation: false,
        allowOverlayNotReady: false,
        requireManagedOverlayComplete: true,
        managedOverlayResultMode: "complete",
        hasCheckoutTransactionId: false
      }
    ]
  });
  writeJson(path.join(root, "00-preflight", "preflight.json"), {
    kind: "steam-bridge-windows-preflight",
    generatedAt: "2026-07-02T00:00:00.000Z",
    app: {
      exe: { exists: true },
      nativeAddon: { exists: true }
    },
    appControlPolicy: {
      verifiedAndReputableEnforced: false
    },
    recentCodeIntegrityEvents: [],
    windowsSession: {
      currentSessionId: 1,
      interactiveSessionIds: [1],
      currentSessionInteractive: true
    }
  });
  const result = {
    ok: true,
    action: { ok: true, action: "presenter-web-open-and-wait" },
    snapshot: buildWindowsSnapshot({
      pid: 4245,
      managedOverlayResultMode: "complete",
      events: [
        { type: "overlay:presenter-open-and-wait-start" },
        { type: "callback:overlay-activated", payload: { active: true } },
        { type: "callback:overlay-activated", payload: { active: false } },
        { type: "overlay:presenter-wait-closed" },
        { type: "overlay:presenter-parked" },
        { type: "overlay:presenter-open-and-wait-complete" }
      ]
    })
  };
  if (!options.omitWait) {
    result.wait = {
      overlayClosed: true,
      overlayParked: true,
      overlayComplete: true
    };
  }
  writeResult(path.join(root, "11-managed-web-open-and-wait", "result.log"), result);
}

function buildWindowsSnapshot({ pid, events, managedOverlayResultMode = "", steamOverlayLaunchMarker = true }) {
  const launch = { steamLaunch: true, overlayInjection: false };
  if (steamOverlayLaunchMarker) {
    launch.env = {
      SteamAppId: "480",
      SteamGameId: "480",
      SteamOverlayGameId: "480",
      SteamClientLaunch: "1",
      SteamEnv: "1"
    };
  }

  return {
    app: { appId: 480, managedOverlayResultMode },
    process: { pid, platform: "win32", arch: "x64" },
    launch,
    steam: {
      initialized: true,
      running: { ok: true, value: true },
      appId: { ok: true, value: 480 },
      overlayEnabled: { ok: true, value: true },
      overlayNeedsPresent: { ok: true, value: false }
    },
    crashDiagnostics: { available: true, ok: true, crashDumps: [], fatalLifecycleEvents: [] },
    events
  };
}

function writeResult(file, result) {
  writeText(file, `noise before result\n${RESULT_PREFIX}${JSON.stringify(result)}\n`);
}

function writeJson(file, value) {
  writeText(file, `${JSON.stringify(value, null, 2)}\n`);
}

function writeText(file, text) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, text);
}
