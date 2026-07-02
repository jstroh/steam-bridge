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

  if (!fs.existsSync(root)) {
    failures.push(`missing artifact root: ${root}`);
    return {
      root,
      failures,
      warnings,
      preflight: null,
      liveRunReadiness: null,
      nativeLoadBlocker: null,
      caseSummaries,
      totals: buildTotals(caseSummaries)
    };
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

    const caseSummary = summarizeCaseResult(caseName, result, resultLog);
    caseSummaries.push(caseSummary);
    failures.push(...caseSummary.failures);
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
    caseSummaries,
    totals: buildTotals(caseSummaries)
  };
}

function validatePreflight(preflight, failures) {
  expect(preflight.kind === "steam-bridge-windows-preflight", "preflight kind is steam-bridge-windows-preflight", failures);
  expect(Boolean(preflight.generatedAt), "preflight generatedAt is present", failures);
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

function summarizeCaseResult(caseName, result, resultLog) {
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

  return {
    caseName,
    action: String(action.action || ""),
    resultLog,
    appId: app.appId,
    processId: processInfo.pid || null,
    steamLaunch: launch.steamLaunch === true,
    overlayInjection: launch.overlayInjection === true,
    overlayEnabled,
    overlayNeedsPresent,
    overlayActiveEvents,
    overlayInactiveEvents,
    eventTypes: events.map((event) => event && event.type).filter(Boolean),
    crashDumpCount: crashDumps.length,
    fatalLifecycleEventCount: fatalLifecycleEvents.length,
    failures
  };
}

function printSummary(summary) {
  console.log(`Windows overlay matrix summary: ${summary.root}`);
  if (summary.preflight) {
    console.log(
      `preflight: generated=${summary.preflight.generatedAt || "unknown"} ` +
        `appControlVerifiedAndReputable=${formatValue(summary.preflight.verifiedAndReputableEnforced)}`
    );
  }
  if (summary.liveRunReadiness) {
    console.log(
      `readiness: ready=${summary.liveRunReadiness.ready} ` +
        `errors=${summary.liveRunReadiness.errorCount} warnings=${summary.liveRunReadiness.warningCount}`
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
  if (summary.caseSummaries.length > 0) {
    console.log(
      `cases: total=${summary.totals.totalCases} steamLaunch=${summary.totals.steamLaunchCases} ` +
        `overlayActive=${summary.totals.overlayActiveCases} clean=${summary.totals.cleanCases}`
    );
    for (const row of summary.caseSummaries) {
      const ok = row.failures.length === 0 ? "ok" : "fail";
      console.log(
        `  ${row.caseName}: ${ok} action=${row.action || "unknown"} ` +
          `steamLaunch=${row.steamLaunch} overlayActiveEvents=${row.overlayActiveEvents} ` +
          `overlayEnabled=${formatValue(row.overlayEnabled)} crashes=${row.crashDumpCount + row.fatalLifecycleEventCount}`
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
  return {
    generatedAt: preflight.generatedAt || "",
    verifiedAndReputableEnforced: Boolean(
      preflight.appControlPolicy && preflight.appControlPolicy.verifiedAndReputableEnforced
    ),
    recentCodeIntegrityEventCount: Array.isArray(preflight.recentCodeIntegrityEvents)
      ? preflight.recentCodeIntegrityEvents.length
      : 0
  };
}

function summarizeReadiness(readiness) {
  return {
    ready: readiness.ready === true,
    errorCount: Array.isArray(readiness.errors) ? readiness.errors.length : 0,
    warningCount: Array.isArray(readiness.warnings) ? readiness.warnings.length : 0
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

function buildTotals(caseSummaries) {
  return {
    totalCases: caseSummaries.length,
    steamLaunchCases: caseSummaries.filter((row) => row.steamLaunch).length,
    overlayActiveCases: caseSummaries.filter((row) => row.overlayActiveEvents > 0).length,
    cleanCases: caseSummaries.filter((row) => row.failures.length === 0).length
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
    assert.equal(casesSummary.liveRunReadiness.ready, true);

    console.log("Windows overlay matrix summary self-test passed.");
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
}

function writeBlockedFixture(root) {
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
    recentCodeIntegrityEvents: []
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
    recentCodeIntegrityEvents: []
  });
  writeJson(path.join(root, "00-preflight", "live-run-readiness.json"), {
    kind: "steam-bridge-windows-live-run-readiness",
    generatedAt: "2026-07-02T00:00:00.000Z",
    ready: true,
    errors: [],
    warnings: []
  });
  writeResult(path.join(root, "01-web", "result.log"), {
    ok: true,
    action: { ok: true, action: "web" },
    snapshot: {
      app: { appId: 480 },
      process: { pid: 4242, platform: "win32", arch: "x64" },
      launch: { steamLaunch: true, overlayInjection: true },
      steam: {
        initialized: true,
        running: { ok: true, value: true },
        appId: { ok: true, value: 480 },
        overlayEnabled: { ok: true, value: true },
        overlayNeedsPresent: { ok: true, value: false }
      },
      crashDiagnostics: { available: true, ok: true, crashDumps: [], fatalLifecycleEvents: [] },
      events: [{ type: "overlay:web" }, { type: "callback:overlay-activated", payload: { active: true } }]
    }
  });
  writeResult(path.join(root, "99-none", "result.log"), {
    ok: true,
    action: { ok: true, action: "none" },
    snapshot: {
      app: { appId: 480 },
      process: { pid: 4243, platform: "win32", arch: "x64" },
      launch: { steamLaunch: true, overlayInjection: true },
      steam: {
        initialized: true,
        running: { ok: true, value: true },
        appId: { ok: true, value: 480 },
        overlayEnabled: { ok: true, value: true },
        overlayNeedsPresent: { ok: true, value: false }
      },
      crashDiagnostics: { available: true, ok: true, crashDumps: [], fatalLifecycleEvents: [] },
      events: []
    }
  });
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
