#!/usr/bin/env node

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const zlib = require("node:zlib");

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
  const caseAppControlBlockers = [];
  const steamLaunchBlockers = [];

  if (!fs.existsSync(root)) {
    failures.push(`missing artifact root: ${root}`);
    return {
      root,
      failures,
      warnings,
      preflight: null,
      initTxnRequestShapePreflight: null,
      liveRunReadiness: null,
      assumedShortcut: null,
      renderHealth: null,
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

  const initTxnRequestShapePreflight = readJsonIfPresent(
    path.join(preflightDir, "init-txn-request-shape.json"),
    failures
  );
  if (manifestRequiresInitTxnRequestPreflight(manifest) && !initTxnRequestShapePreflight) {
    failures.push(
      `missing InitTxn request-shape preflight JSON: ${path.join(preflightDir, "init-txn-request-shape.json")}`
    );
  }
  if (initTxnRequestShapePreflight) {
    validateInitTxnRequestShapePreflight(initTxnRequestShapePreflight, manifest, failures);
  }

  const liveRunReadiness = readJsonIfPresent(path.join(preflightDir, "live-run-readiness.json"), failures);
  if (liveRunReadiness) {
    validateLiveRunReadiness(liveRunReadiness, failures);
  }

  const assumedShortcut = readJsonIfPresent(path.join(preflightDir, "assumed-shortcut.json"), failures);
  if (assumedShortcut) {
    validateAssumedShortcut(assumedShortcut, failures);
  }

  const renderHealthGate = readJsonIfPresent(path.join(preflightDir, "render-health-gate.json"), failures);
  const renderHealth = readJsonIfPresent(
    path.join(preflightDir, "render-health", "render-health-summary.json"),
    failures
  );
  if (renderHealthGate || renderHealth) {
    validateRenderHealth(renderHealth, renderHealthGate, failures);
  }

  const appControlGate = readJsonIfPresent(path.join(preflightDir, "native-load-gate-app-control.json"), failures);
  const nativeLoadBlocker = readJsonIfPresent(path.join(preflightDir, "native-load-gate-blocker.json"), failures);
  if (nativeLoadBlocker) {
    validateNativeLoadBlocker(nativeLoadBlocker, appControlGate, failures);
  }

  for (const caseName of findCaseDirectories(root)) {
    const caseDir = path.join(root, caseName);
    const caseAppControlBlocker = readJsonIfPresent(path.join(caseDir, "case-app-control-blocker.json"), failures);
    const steamLaunchBlocker = readJsonIfPresent(path.join(caseDir, "steam-launch-blocker.json"), failures);
    const resultLog = findResultLog(caseDir);
    if (caseAppControlBlocker) {
      validateCaseAppControlBlocker(caseAppControlBlocker, failures);
      caseAppControlBlockers.push(summarizeCaseAppControlBlocker(caseName, caseAppControlBlocker));
      if (!resultLog || !hasSmokeResultPayload(resultLog)) {
        failures.push(`${caseName}: case-app-control-blocker.json requires a smoke result payload`);
      }
      continue;
    }
    if (steamLaunchBlocker) {
      validateSteamLaunchBlocker(steamLaunchBlocker, failures);
      if (resultLog && hasSmokeResultPayload(resultLog)) {
        failures.push(`${caseName}: steam-launch-blocker.json is invalid when a smoke result payload exists`);
      }
      steamLaunchBlockers.push(summarizeSteamLaunchBlocker(caseName, steamLaunchBlocker));
    }

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
    const closeProbeEvents = readJsonLinesIfPresent(path.join(caseDir, "close-probe.log"), failures);
    const caseSummary = summarizeCaseResult(caseName, result, resultLog, renderingHealth, closeProbeEvents, caseDir);
    caseSummaries.push(caseSummary);
    failures.push(...caseSummary.failures);
  }

  const initTxnRequestShapePreflightSummary = initTxnRequestShapePreflight
    ? summarizeInitTxnRequestShapePreflight(initTxnRequestShapePreflight)
    : null;

  if (manifest && !nativeLoadBlocker) {
    validateManifestCoverage(
      manifest,
      caseSummaries,
      caseAppControlBlockers,
      steamLaunchBlockers,
      initTxnRequestShapePreflightSummary,
      failures,
      warnings
    );
  }

  if (
    !nativeLoadBlocker &&
    caseSummaries.length === 0 &&
    caseAppControlBlockers.length === 0 &&
    steamLaunchBlockers.length === 0 &&
    !preflight &&
    !liveRunReadiness
  ) {
    failures.push("artifact root does not contain preflight, blocker, readiness, or case result artifacts");
  }

  return {
    root,
    failures,
    warnings,
    preflight: preflight ? summarizePreflight(preflight) : null,
    initTxnRequestShapePreflight: initTxnRequestShapePreflightSummary,
    liveRunReadiness: liveRunReadiness ? summarizeReadiness(liveRunReadiness) : null,
    assumedShortcut: assumedShortcut ? summarizeAssumedShortcut(assumedShortcut) : null,
    renderHealth: renderHealth || renderHealthGate ? summarizeRenderHealth(renderHealth, renderHealthGate) : null,
    nativeLoadBlocker: nativeLoadBlocker ? summarizeNativeLoadBlocker(nativeLoadBlocker) : null,
    manifest: manifest ? summarizeManifest(manifest) : null,
    caseSummaries,
    caseAppControlBlockers,
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
  expect(
    [
      "baseline",
      "managed",
      "managed-routes",
      "shortcut-routes",
      "checkout",
      "full",
      "preflight",
      "readiness",
      "shortcut"
    ].includes(manifest.suite),
    `matrix manifest suite is known: ${manifest.suite}`,
    failures
  );
  expect(
    ["steam-launch", "steam-app", "direct"].includes(manifest.launchMode),
    `matrix manifest launchMode is known: ${manifest.launchMode}`,
    failures
  );
  if (manifest.launchKind !== undefined) {
    expect(
      ["shortcut", "app", "direct"].includes(manifest.launchKind),
      `matrix manifest launchKind is known: ${manifest.launchKind}`,
      failures
    );
  }
  expect(Number.isInteger(manifest.appId), "matrix manifest appId is an integer", failures);
  if (manifest.nativePathOverride !== undefined) {
    expect(typeof manifest.nativePathOverride === "boolean", "matrix manifest nativePathOverride is boolean", failures);
  }
  if (manifest.expectedNativeHostBackend !== undefined) {
    expect(
      typeof manifest.expectedNativeHostBackend === "string",
      "matrix manifest expectedNativeHostBackend is a string",
      failures
    );
  }
  if (manifest.requireMicroTxnCallback !== undefined) {
    expect(
      typeof manifest.requireMicroTxnCallback === "boolean",
      "matrix manifest requireMicroTxnCallback is boolean",
      failures
    );
  }
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
        if (Object.prototype.hasOwnProperty.call(entry, "hasCheckoutJsonFile")) {
          expect(
            typeof entry.hasCheckoutJsonFile === "boolean",
            `matrix manifest case ${entry.id} records checkout JSON presence without raw value`,
            failures
          );
        }
        if (Object.prototype.hasOwnProperty.call(entry, "hasInitTxnRequestFile")) {
          expect(
            typeof entry.hasInitTxnRequestFile === "boolean",
            `matrix manifest case ${entry.id} records InitTxn request presence without raw value`,
            failures
          );
        }
        if (Object.prototype.hasOwnProperty.call(entry, "requireMicroTxnCallback")) {
          expect(
            typeof entry.requireMicroTxnCallback === "boolean",
            `matrix manifest case ${entry.id} records MicroTxn callback requirement`,
            failures
          );
        }
      }
    }
  }
}

function validateManifestCoverage(
  manifest,
  caseSummaries,
  caseAppControlBlockers,
  steamLaunchBlockers,
  initTxnRequestShapePreflight,
  failures,
  warnings
) {
  const expectedCases = Array.isArray(manifest.cases) ? manifest.cases : [];
  const summariesByCase = new Map(caseSummaries.map((row) => [row.caseName, row]));
  const coveredBlockedCases = new Set([
    ...caseAppControlBlockers.map((row) => row.caseName),
    ...steamLaunchBlockers.map((row) => row.caseName)
  ]);
  for (const expected of expectedCases) {
    const row = summariesByCase.get(expected.id);
    if (!row) {
      if (coveredBlockedCases.has(expected.id)) {
        continue;
      }
      failures.push(`matrix manifest case missing result: ${expected.id} (${expected.action})`);
      continue;
    }
    expect(row.action === expected.action, `matrix manifest case ${expected.id} action matches result`, failures);
    expect(row.appId === manifest.appId, `matrix manifest case ${expected.id} App ID matches manifest`, failures);
    if (["steam-launch", "steam-app"].includes(manifest.launchMode)) {
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
    if (expected.requirePassiveNotification === true) {
      expect(row.passiveNotificationProof === true, `matrix manifest case ${expected.id} proved passive notification presenter state`, failures);
    }
    if (expected.requireManagedOverlayComplete === true) {
      expect(
        row.managedOverlayResultMode === "complete",
        `matrix manifest case ${expected.id} used complete managed overlay result mode`,
        failures
      );
      expect(row.managedOverlayCloseProof === true, `matrix manifest case ${expected.id} proved managed overlay close`, failures);
      expect(row.wait && row.wait.overlayClosed === true, `matrix manifest case ${expected.id} completed overlay close wait`, failures);
      expect(row.wait && row.wait.overlayParked === true, `matrix manifest case ${expected.id} completed overlay park wait`, failures);
      expect(row.wait && row.wait.overlayComplete === true, `matrix manifest case ${expected.id} completed managed overlay wait`, failures);
      if (manifest.closeProbe === true) {
        expect(row.closeProbeSent === true, `matrix manifest case ${expected.id} sent Windows close probe input`, failures);
      }
    }
    if (expected.requireMicroTxnCallback === true) {
      expect(
        row.microTxnCallbackListenerRegistered === true,
        `matrix manifest case ${expected.id} registered MicroTxnAuthorizationResponse listener`,
        failures
      );
      expect(
        row.legacyMicroTxnCallbackListenerRegistered === true,
        `matrix manifest case ${expected.id} registered LegacyMicroTxnAuthorizationResponse listener`,
        failures
      );
      expect(
        row.microTxnCallbackProof === true,
        `matrix manifest case ${expected.id} proved MicroTxnAuthorizationResponse callback`,
        failures
      );
      if (row.microTxnCallbackProof !== true && Array.isArray(row.microTxnCallbackProofFailures)) {
        for (const failure of row.microTxnCallbackProofFailures) {
          failures.push(`matrix manifest case ${expected.id}: ${failure}`);
        }
      }
    }
    if (expected.hasInitTxnRequestFile === true) {
      expect(
        row.initTxnRequestShapePresent === true,
        `matrix manifest case ${expected.id} captured InitTxn request-shape event`,
        failures
      );
      if (initTxnRequestShapePreflight && row.initTxnRequestShapeRequestShape) {
        expect(
          row.initTxnRequestShapeRequestShape === initTxnRequestShapePreflight.requestShapeSummary,
          `matrix manifest case ${expected.id} runtime InitTxn request shape matches preflight`,
          failures
        );
      }
      if (initTxnRequestShapePreflight && initTxnRequestShapePreflight.usersessionField === "web") {
        expect(
          row.webSessionCheckoutCaptured === true,
          `matrix manifest case ${expected.id} captured web-session InitTxn checkout target`,
          failures
        );
        expect(
          row.webSessionCheckoutCapturedHasSteamUrl === true,
          `matrix manifest case ${expected.id} captured web-session InitTxn Steam approval URL shape`,
          failures
        );
      }
      if (initTxnRequestShapePreflight && initTxnRequestShapePreflight.session === "client") {
        expect(
          row.clientSessionCheckoutCaptured === true,
          `matrix manifest case ${expected.id} captured client-session InitTxn checkout target`,
          failures
        );
        expect(
          row.clientSessionCheckoutCapturedHasTransactionId === true,
          `matrix manifest case ${expected.id} captured client-session InitTxn transaction shape`,
          failures
        );
        expect(
          row.clientSessionWaitStarted === true,
          `matrix manifest case ${expected.id} started waiting for the client-session Steam prompt`,
          failures
        );
        expect(
          row.clientSessionWaitExpectedSteamPrompt === true,
          `matrix manifest case ${expected.id} recorded the expected client-session Steam prompt`,
          failures
        );
        expect(
          row.clientSessionWaitPresenterReady === true,
          `matrix manifest case ${expected.id} had an active presenter while waiting for the client-session Steam prompt`,
          failures
        );
        if (expected.requireMicroTxnCallback === true && row.microTxnCallbackProof !== true) {
          expect(
            row.clientSessionPromptMissing === true,
            `matrix manifest case ${expected.id} classified the missing client-session Steam prompt`,
            failures
          );
        }
      }
    }
  }

  for (const row of caseSummaries) {
    if (!expectedCases.some((expected) => expected.id === row.caseName)) {
      warnings.push(`case result was not listed in matrix manifest: ${row.caseName}`);
    }
  }
  for (const row of caseAppControlBlockers) {
    if (!expectedCases.some((expected) => expected.id === row.caseName)) {
      warnings.push(`case App Control blocker was not listed in matrix manifest: ${row.caseName}`);
    }
  }
}

function manifestRequiresInitTxnRequestPreflight(manifest) {
  const initTxnCapture = objectOrEmpty(manifest && manifest.initTxnCapture);
  const targetHints = objectOrEmpty(manifest && manifest.targetHints);
  const cases = Array.isArray(manifest && manifest.cases) ? manifest.cases : [];
  return (
    initTxnCapture.hasRequestFile === true ||
    targetHints.hasInitTxnRequestFile === true ||
    cases.some((entry) => entry && entry.hasInitTxnRequestFile === true)
  );
}

function validateInitTxnRequestShapePreflight(shape, manifest, failures) {
  const requestShape = summarizeInitTxnRequestShape(shape);
  expect(
    shape.kind === "steam-bridge-windows-init-txn-request-shape",
    "InitTxn request-shape preflight kind is steam-bridge-windows-init-txn-request-shape",
    failures
  );
  expect(Boolean(shape.generatedAt), "InitTxn request-shape preflight generatedAt is present", failures);
  expect(shape.source === "init-txn-request-file", "InitTxn request-shape preflight source is init-txn-request-file", failures);
  expect(shape.hasRequestFile === true, "InitTxn request-shape preflight records request file presence", failures);
  expect(shape.requestFileExists === true, "InitTxn request-shape preflight records existing request file", failures);
  expect(
    typeof shape.requestAppIdPresent === "boolean",
    "InitTxn request-shape preflight records app ID presence as a boolean",
    failures
  );
  expect(
    typeof shape.requestAppIdMatches === "boolean",
    "InitTxn request-shape preflight records app ID match as a boolean",
    failures
  );
  if (shape.requestAppIdPresent === true) {
    expect(
      shape.requestAppIdMatches === true,
      "InitTxn request-shape preflight app ID matches matrix App ID",
      failures
    );
  }
  expect(shape.matrixAppIdForced === true, "InitTxn request-shape preflight records forced matrix App ID", failures);
  expect(typeof shape.hasUserSessionField === "boolean", "InitTxn request-shape preflight records usersession field presence", failures);
  expect(Boolean(shape.session), "InitTxn request-shape preflight records normalized session", failures);
  expectInitTxnRequestShape(
    {
      present: true,
      ...requestShape,
      requestShapeSummary: requestShape.summary
    },
    "InitTxn request-shape preflight",
    failures
  );
  if (manifestRequiresInitTxnRequestPreflight(manifest)) {
    expect(
      shape.hasRequestFile === true && shape.requestFileExists === true,
      "matrix InitTxn request-file manifest has matching preflight shape",
      failures
    );
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

function validateAssumedShortcut(shortcut, failures) {
  expect(typeof shortcut.ok === "boolean", "assumed shortcut ok is boolean", failures);
  expect(Boolean(shortcut.generatedAt), "assumed shortcut generatedAt is present", failures);
  expect(Boolean(shortcut.shortcutName), "assumed shortcut name is present", failures);
  expect(typeof shortcut.changed === "boolean", "assumed shortcut changed is boolean", failures);
  expect(typeof shortcut.existingMatches === "boolean", "assumed shortcut existingMatches is boolean", failures);
  if (shortcut.ok !== true) {
    failures.push(
      `assumed Steam shortcut invalid for ${shortcut.shortcutName || "unknown"}: ` +
        `action=${shortcut.action || "unknown"} changed=${formatValue(shortcut.changed)}`
    );
  }
}

function validateRenderHealth(renderHealth, gate, failures) {
  if (gate) {
    expect(
      gate.kind === "steam-bridge-windows-render-health-gate",
      "render-health gate kind is steam-bridge-windows-render-health-gate",
      failures
    );
    expect(Boolean(gate.generatedAt), "render-health gate generatedAt is present", failures);
    expect(typeof gate.required === "boolean", "render-health gate required is boolean", failures);
    expect(typeof gate.skipped === "boolean", "render-health gate skipped is boolean", failures);
  }

  if (gate && gate.skipped === true) {
    expect(Boolean(gate.reason), "skipped render-health gate reason is present", failures);
    return;
  }

  if (!renderHealth) {
    failures.push("missing render-health summary for a non-skipped render-health gate");
    return;
  }

  expect(
    renderHealth.kind === "steam-bridge-windows-render-health-probe",
    "render-health summary kind is steam-bridge-windows-render-health-probe",
    failures
  );
  expect(Boolean(renderHealth.generatedAt), "render-health summary generatedAt is present", failures);
  expect(Array.isArray(renderHealth.cases), "render-health summary cases is an array", failures);
  const recommendation = renderHealth.recommendation || {};
  expect(Boolean(recommendation.status), "render-health recommendation status is present", failures);
  expect(
    typeof recommendation.readyForSteamOverlayMatrix === "boolean",
    "render-health readyForSteamOverlayMatrix is boolean",
    failures
  );

  const required = !gate || gate.required !== false;
  if (required && recommendation.readyForSteamOverlayMatrix !== true) {
    failures.push(
      `Windows default render health is not ready for Steam-launched overlay proof: ` +
        `${recommendation.status || "unknown"}; ${recommendation.nextAction || "inspect render-health artifacts"}`
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
        hasVerifiedAndReputableEvidence(blocker.appControl),
        "App Control native-load blocker records VerifiedAndReputable policy evidence",
        failures
      );
    }
    if (appControlGate) {
      expect(
        hasVerifiedAndReputableEvidence(appControlGate),
        "native-load gate App Control summary records VerifiedAndReputable policy evidence",
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

function hasVerifiedAndReputableEvidence(appControl) {
  return (
    appControl &&
    (appControl.verifiedAndReputableEnforced === true ||
      appControl.verifiedAndReputablePolicyState === 1 ||
      appControl.verifiedAndReputablePolicyState === "1")
  );
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

function validateCaseAppControlBlocker(blocker, failures) {
  expect(
    blocker.kind === "steam-bridge-windows-case-app-control-blocker",
    "case App Control blocker kind is steam-bridge-windows-case-app-control-blocker",
    failures
  );
  expect(Boolean(blocker.generatedAt), "case App Control blocker generatedAt is present", failures);
  expect(
    blocker.blockerCode === "windows-app-control-native-dependency-block",
    `case App Control blocker code is known: ${blocker.blockerCode}`,
    failures
  );
  expect(Boolean(blocker.caseId), "case App Control blocker caseId is present", failures);
  expect(Boolean(blocker.action), "case App Control blocker action is present", failures);
  expect(typeof blocker.resultPolicyBlock === "boolean", "case App Control blocker resultPolicyBlock is boolean", failures);
  expect(typeof blocker.codeIntegrityPolicyBlock === "boolean", "case App Control blocker codeIntegrityPolicyBlock is boolean", failures);
  expect(typeof blocker.verifiedAndReputableBlock === "boolean", "case App Control blocker verifiedAndReputableBlock is boolean", failures);
  expect(
    blocker.resultPolicyBlock === true || blocker.codeIntegrityPolicyBlock === true,
    "case App Control blocker has result or Code Integrity policy evidence",
    failures
  );
  expect(Boolean(blocker.paths && blocker.paths.resultFile), "case App Control blocker result path is present", failures);
  expect(
    Array.isArray(blocker.postCaseCodeIntegrityEvents),
    "case App Control blocker postCaseCodeIntegrityEvents is an array",
    failures
  );
  expect(Array.isArray(blocker.nextActions) && blocker.nextActions.length > 0, "case App Control blocker next actions are present", failures);
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

function hasManagedOverlayCloseProof(wait, overlayInactiveEvents) {
  return overlayInactiveEvents > 0 || Boolean(wait && wait.overlayClosed === true);
}

function hasPassiveNotificationProof(actionName, events, nativePresenter) {
  const eventType =
    actionName === "presenter-achievement-progress"
      ? "achievement:progress"
      : actionName === "presenter-achievement-unlock"
        ? "achievement:unlock"
        : "";
  if (!eventType) {
    return false;
  }

  const event = events.find((entry) => entry && entry.type === eventType);
  const payload = event && event.payload && typeof event.payload === "object" ? event.payload : {};
  const accepted =
    actionName === "presenter-achievement-progress"
      ? payload.indicated === true
      : actionName === "presenter-achievement-unlock"
        ? payload.activated === true
        : false;
  return accepted &&
    hasPassivePresenterShape(payload.presenter, { parked: false }) &&
    hasPassivePresenterShape(nativePresenter, { parked: true });
}

function hasPassivePresenterShape(presenter, { parked }) {
  if (!presenter || typeof presenter !== "object" || Array.isArray(presenter)) {
    return false;
  }
  if (
    presenter.mode !== "passive" ||
    presenter.nativeHostOpen !== true ||
    presenter.clickThrough !== true ||
    presenter.focusable !== false ||
    presenter.overlayActive !== false
  ) {
    return false;
  }
  if (!parked) {
    return true;
  }
  return presenter.transparent === true && presenter.overlayNeedsPresent === false && presenter.currentFps === 0;
}

function isMicroTxnCallbackEvent(event) {
  return Boolean(event && event.type === "callback:microtxn");
}

function hasMicroTxnCallbackListenerRegistered(events) {
  return hasNamedMicroTxnCallbackListenerRegistered(events, "MicroTxnAuthorizationResponse");
}

function hasLegacyMicroTxnCallbackListenerRegistered(events) {
  return hasNamedMicroTxnCallbackListenerRegistered(events, "LegacyMicroTxnAuthorizationResponse");
}

function hasNamedMicroTxnCallbackListenerRegistered(events, callbackName) {
  return events.some((event) => {
    if (!event || event.type !== "callback:microtxn-listener-registered") {
      return false;
    }
    const payload = objectOrEmpty(event.payload);
    return payload.callback === callbackName && payload.registered === true;
  });
}

function isClientSessionInitTxnMode(value) {
  return value === "client" || value === "client-default";
}

function summarizeInitTxnRequestShapeEvent(events) {
  const event = events.find((candidate) => candidate && candidate.type === "checkout:init-txn-request-shape");
  if (!event) {
    return {
      present: false,
      session: "",
      endpoint: "",
      usersessionField: "",
      hasIpAddress: "",
      requestShapeSummary: ""
    };
  }
  const payload = objectOrEmpty(event.payload);
  const requestShape = summarizeInitTxnRequestShape(payload.requestShape);
  return {
    present: true,
    session: String(payload.session || ""),
    endpoint: String(payload.endpoint || ""),
    usersessionField: requestShape.usersessionField,
    hasIpAddress: requestShape.hasIpAddress,
    requestShapeSummary: requestShape.summary
  };
}

function summarizeClientSessionCheckoutCapture(events) {
  const event = events.find((candidate) => {
    if (!candidate || candidate.type !== "checkout:init-txn-captured") {
      return false;
    }
    const payload = objectOrEmpty(candidate.payload);
    const targetSnapshot = objectOrEmpty(payload.targetSnapshot);
    return (
      isClientSessionInitTxnMode(payload.session) &&
      targetSnapshot.type === "checkout" &&
      targetSnapshot.clientSession === true
    );
  });
  if (!event) {
    return {
      present: false,
      session: "",
      endpoint: "",
      httpStatus: "",
      hasTransactionId: false,
      hasReturnUrl: false,
      usersessionField: "",
      hasIpAddress: "",
      requestShapeSummary: ""
    };
  }
  const payload = objectOrEmpty(event.payload);
  const targetSnapshot = objectOrEmpty(payload.targetSnapshot);
  const requestShape = summarizeInitTxnRequestShape(payload.requestShape);
  return {
    present: true,
    session: String(payload.session || ""),
    endpoint: String(payload.endpoint || ""),
    httpStatus: String(payload.httpStatus || ""),
    hasTransactionId: targetSnapshot.hasTransactionId === true,
    hasReturnUrl: targetSnapshot.hasReturnUrl === true,
    usersessionField: requestShape.usersessionField,
    hasIpAddress: requestShape.hasIpAddress,
    requestShapeSummary: requestShape.summary
  };
}

function summarizeClientSessionWaitStart(events) {
  const event = events.find((candidate) => {
    if (!candidate || candidate.type !== "checkout:client-session-wait-start") {
      return false;
    }
    const payload = objectOrEmpty(candidate.payload);
    const targetSnapshot = objectOrEmpty(payload.targetSnapshot);
    return targetSnapshot.type === "checkout" && targetSnapshot.clientSession === true;
  });
  if (!event) {
    return {
      present: false,
      expectedSteamPrompt: false,
      hasTransactionId: false,
      hasReturnUrl: false,
      presenterReady: false
    };
  }
  const payload = objectOrEmpty(event.payload);
  const targetSnapshot = objectOrEmpty(payload.targetSnapshot);
  const presenter = objectOrEmpty(payload.presenter);
  return {
    present: true,
    expectedSteamPrompt: payload.expectedSteamPrompt === true,
    hasTransactionId: targetSnapshot.hasTransactionId === true,
    hasReturnUrl: targetSnapshot.hasReturnUrl === true,
    presenterReady:
      presenter.mode === "active" &&
      presenter.nativeHostOpen === true &&
      presenter.clickThrough === false &&
      presenter.transparent === false
  };
}

function summarizeWebSessionCheckoutCapture(events) {
  const event = events.find((candidate) => {
    if (!candidate || candidate.type !== "checkout:init-txn-captured") {
      return false;
    }
    const payload = objectOrEmpty(candidate.payload);
    const targetSnapshot = objectOrEmpty(payload.targetSnapshot);
    return (
      payload.session === "web" &&
      targetSnapshot.type === "checkout" &&
      targetSnapshot.hasSteamUrl === true &&
      targetSnapshot.clientSession !== true
    );
  });
  if (!event) {
    return {
      present: false,
      session: "",
      endpoint: "",
      httpStatus: "",
      hasSteamUrl: false,
      hasTransactionId: false,
      hasReturnUrl: false,
      usersessionField: "",
      hasIpAddress: "",
      requestShapeSummary: ""
    };
  }
  const payload = objectOrEmpty(event.payload);
  const targetSnapshot = objectOrEmpty(payload.targetSnapshot);
  const requestShape = summarizeInitTxnRequestShape(payload.requestShape);
  return {
    present: true,
    session: String(payload.session || ""),
    endpoint: String(payload.endpoint || ""),
    httpStatus: String(payload.httpStatus || ""),
    hasSteamUrl: targetSnapshot.hasSteamUrl === true,
    hasTransactionId: targetSnapshot.hasTransactionId === true,
    hasReturnUrl: targetSnapshot.hasReturnUrl === true,
    usersessionField: requestShape.usersessionField,
    hasIpAddress: requestShape.hasIpAddress,
    requestShapeSummary: requestShape.summary
  };
}

function summarizeClientSessionPromptMissing(events) {
  const event = events.find((candidate) => {
    if (!candidate || candidate.type !== "checkout:client-session-prompt-missing") {
      return false;
    }
    const payload = objectOrEmpty(candidate.payload);
    const targetSnapshot = objectOrEmpty(payload.targetSnapshot);
    const error = objectOrEmpty(payload.error);
    return (
      targetSnapshot.type === "checkout" &&
      targetSnapshot.clientSession === true &&
      (error.code === "STEAM_OVERLAY_WAIT_TIMEOUT" || error.name === "SteamOverlayWaitTimeoutError")
    );
  });
  if (!event) {
    return {
      present: false,
      session: "",
      endpoint: "",
      httpStatus: "",
      usersessionField: "",
      hasIpAddress: "",
      requestShapeSummary: ""
    };
  }
  const payload = objectOrEmpty(event.payload);
  const initTxn = objectOrEmpty(payload.initTxn);
  const requestShape = summarizeInitTxnRequestShape(initTxn.requestShape || payload.requestShape);
  return {
    present: true,
    session: String(initTxn.session || payload.session || ""),
    endpoint: String(initTxn.endpoint || payload.endpoint || ""),
    httpStatus: String(initTxn.httpStatus || payload.httpStatus || ""),
    usersessionField: requestShape.usersessionField,
    hasIpAddress: requestShape.hasIpAddress,
    requestShapeSummary: requestShape.summary
  };
}

function summarizeInitTxnTargetMissing(events) {
  const event = events.find((candidate) => candidate && candidate.type === "checkout:init-txn-target-missing");
  if (!event) {
    return {
      present: false,
      session: "",
      result: "",
      errorCode: "",
      hasErrorDescription: false,
      usersessionField: "",
      hasIpAddress: "",
      requestShapeSummary: ""
    };
  }
  const payload = objectOrEmpty(event.payload);
  const failure = objectOrEmpty(payload.failure);
  const requestShape = summarizeInitTxnRequestShape(payload.requestShape);
  return {
    present: true,
    session: String(payload.session || ""),
    result: String(failure.result || ""),
    errorCode: String(failure.errorCode || ""),
    hasErrorDescription: failure.hasErrorDescription === true,
    usersessionField: requestShape.usersessionField,
    hasIpAddress: requestShape.hasIpAddress,
    requestShapeSummary: requestShape.summary
  };
}

function summarizeInitTxnRequestShape(value) {
  const requestShape = objectOrEmpty(value);
  const summary = {
    usersessionField: String(requestShape.usersession || ""),
    hasIpAddress:
      typeof requestShape.hasIpAddress === "boolean"
        ? String(requestShape.hasIpAddress)
        : "",
    hasOrderId: booleanShapeValue(requestShape.hasOrderId),
    hasSteamId64: booleanShapeValue(requestShape.hasSteamId64),
    hasLanguage: booleanShapeValue(requestShape.hasLanguage),
    hasCurrency: booleanShapeValue(requestShape.hasCurrency),
    itemCount: integerShapeValue(requestShape.itemCount),
    bundleCount: integerShapeValue(requestShape.bundleCount),
    itemsHaveRequiredFields: booleanShapeValue(requestShape.itemsHaveRequiredFields),
    bundlesHaveRequiredFields: booleanShapeValue(requestShape.bundlesHaveRequiredFields)
  };
  summary.summary = [
    `usersession=${summary.usersessionField}`,
    `ip=${summary.hasIpAddress}`,
    `order=${summary.hasOrderId}`,
    `steam=${summary.hasSteamId64}`,
    `language=${summary.hasLanguage}`,
    `currency=${summary.hasCurrency}`,
    `items=${summary.itemCount}`,
    `bundles=${summary.bundleCount}`,
    `itemFields=${summary.itemsHaveRequiredFields}`,
    `bundleFields=${summary.bundlesHaveRequiredFields}`
  ].join(",");
  return summary;
}

function booleanShapeValue(value) {
  return typeof value === "boolean" ? String(value) : "";
}

function integerShapeValue(value) {
  return Number.isInteger(value) && value >= 0 ? String(value) : "";
}

function expectInitTxnRequestShape(summary, label, failures) {
  if (!summary.present) {
    return;
  }
  expect(
    summary.usersessionField !== "",
    `${label}: records sanitized InitTxn usersession request shape`,
    failures
  );
  expect(
    summary.hasIpAddress !== "",
    `${label}: records sanitized InitTxn IP address request-shape flag`,
    failures
  );
  for (const [field, description] of [
    ["hasOrderId", "order ID presence flag"],
    ["hasSteamId64", "Steam ID presence flag"],
    ["hasLanguage", "language presence flag"],
    ["hasCurrency", "currency presence flag"],
    ["itemCount", "item count"],
    ["bundleCount", "bundle count"],
    ["itemsHaveRequiredFields", "line-item required-field flag"],
    ["bundlesHaveRequiredFields", "bundle required-field flag"]
  ]) {
    expect(
      summary[field] !== "",
      `${label}: records sanitized InitTxn ${description}`,
      failures
    );
  }
  expect(
    summary.requestShapeSummary !== "",
    `${label}: records sanitized InitTxn request-shape field summary`,
    failures
  );
}

function hasMicroTxnCallbackProof(actionName, events, expectedAppId) {
  const failures = [];
  verifyMicroTxnCallbackProof(actionName, events, expectedAppId, failures);
  return { ok: failures.length === 0, failures };
}

function verifyMicroTxnCallbackProof(actionName, events, expectedAppId, failures) {
  const callbacks = events
    .map((event, index) => ({ event, index }))
    .filter(({ event }) => isMicroTxnCallbackEvent(event));
  if (callbacks.length === 0) {
    failures.push("required MicroTxnAuthorizationResponse callback was not recorded");
    return;
  }

  callbacks.forEach(({ event }, index) => {
    const label = `microtxn callback ${index + 1}`;
    if (!microTxnPresenterSnapshot(event)) {
      failures.push(`${label} did not include a presenter snapshot`);
    }
    const appId = microTxnEventAppId(event);
    if (appId === undefined) {
      failures.push(`${label} did not include an app ID`);
    } else if (appId !== expectedAppId) {
      failures.push(`${label} app ID expected ${formatValue(expectedAppId)}, got ${formatValue(appId)}`);
    }
    if (microTxnEventAuthorization(event) === undefined) {
      failures.push(`${label} did not include an authorization result`);
    }
    if (!microTxnEventOrderIdPresent(event)) {
      failures.push(`${label} did not include an order ID presence marker`);
    }
    const callbackSource = microTxnEventCallbackSource(event);
    if (!callbackSource) {
      failures.push(`${label} did not include a callback source`);
    } else if (!["steamworks", "legacy"].includes(callbackSource)) {
      failures.push(`${label} callback source expected steamworks or legacy, got ${formatValue(callbackSource)}`);
    }
  });

  const lifecycle = microTxnCheckoutLifecycle(actionName, events, failures);
  if (!lifecycle.ok) {
    return;
  }
  const callbackDuringCheckout = callbacks.some(
    ({ index }) => index > lifecycle.openIndex && index < lifecycle.closeIndex
  );
  if (!callbackDuringCheckout) {
    failures.push("required MicroTxnAuthorizationResponse callback was not recorded during the checkout wait lifecycle");
  }
}

function microTxnCheckoutLifecycle(actionName, events, failures) {
  let openIndex = -1;
  let closeIndex = -1;

  if (actionName === "presenter-checkout") {
    openIndex = events.findIndex((event) => {
      const payload = objectOrEmpty(event && event.payload);
      return event && event.type === "overlay:presenter-open" && payload.target === "checkout";
    });
    closeIndex = events.findIndex(
      (event, index) => index > openIndex && event && event.type === "overlay:presenter-checkout-open-and-wait-complete"
    );
  } else if (actionName === "presenter-shortcut" || actionName === "presenter-shortcut-open-and-wait") {
    openIndex = events.findIndex((event) => {
      const payload = objectOrEmpty(event && event.payload);
      return event && event.type === "overlay:shortcut-open" && payload.target === "checkout";
    });
    closeIndex = events.findIndex(
      (event, index) =>
        index > openIndex &&
        event &&
        (event.type === "overlay:presenter-open-and-wait-complete" || event.type === "overlay:presenter-parked")
    );
  } else {
    failures.push("required MicroTxn callback proof has no supported checkout lifecycle");
    return { ok: false };
  }

  if (openIndex === -1) {
    failures.push("required MicroTxn callback proof has no matching checkout open event");
    return { ok: false };
  }
  if (closeIndex === -1) {
    failures.push("required MicroTxn callback proof has no checkout wait completion event");
    return { ok: false };
  }
  return { ok: true, openIndex, closeIndex };
}

function microTxnPayload(event) {
  const payload = objectOrEmpty(event && event.payload);
  return objectOrEmpty(payload["0"] || payload);
}

function microTxnEventCallbackSource(event) {
  const source = microTxnPayload(event).callbackSource;
  return typeof source === "string" && source.trim() ? source.trim().toLowerCase() : "";
}

function microTxnCallbackSources(events) {
  const sources = new Set();
  for (const event of events) {
    if (!isMicroTxnCallbackEvent(event)) {
      continue;
    }
    const source = microTxnEventCallbackSource(event);
    if (source) {
      sources.add(source);
    }
  }
  return [...sources].sort().join(",");
}

function microTxnPresenterSnapshot(event) {
  const presenter = microTxnPayload(event).presenter;
  return presenter && typeof presenter === "object" && !Array.isArray(presenter) ? presenter : null;
}

function microTxnEventAppId(event) {
  const payload = microTxnPayload(event);
  for (const key of ["appId", "app_id", "m_unAppID", "m_nAppID"]) {
    if (payload[key] != null && payload[key] !== "") {
      return Number(payload[key]);
    }
  }
  return undefined;
}

function microTxnEventAuthorization(event) {
  const payload = microTxnPayload(event);
  for (const key of ["authorized", "m_bAuthorized"]) {
    const value = payload[key];
    if (value === true || value === 1 || value === "1" || value === "true") {
      return true;
    }
    if (value === false || value === 0 || value === "0" || value === "false") {
      return false;
    }
  }
  return undefined;
}

function microTxnEventOrderIdPresent(event) {
  const payload = microTxnPayload(event);
  for (const key of ["orderId", "orderID", "order_id", "orderid", "m_ulOrderID", "m_ulOrderId"]) {
    if (Object.prototype.hasOwnProperty.call(payload, key) && sanitizedValuePresent(payload[key])) {
      return true;
    }
  }
  return false;
}

function sanitizedValuePresent(value) {
  if (value == null) {
    return false;
  }
  if (value && typeof value === "object" && !Array.isArray(value) && Object.prototype.hasOwnProperty.call(value, "present")) {
    return value.present === true;
  }
  if (typeof value === "string") {
    return value.length > 0;
  }
  return true;
}

function summarizeCaseResult(caseName, result, resultLog, renderingHealth = null, closeProbeEvents = [], caseDir = "") {
  const failures = [];
  const snapshot = objectOrEmpty(result.snapshot);
  const app = objectOrEmpty(snapshot.app);
  const processInfo = objectOrEmpty(snapshot.process);
  const launch = objectOrEmpty(snapshot.launch);
  const steam = objectOrEmpty(snapshot.steam);
  const overlay = objectOrEmpty(snapshot.overlay);
  const nativePresenter = readOkValue(overlay.nativePresenter);
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
  const wait = result.wait && typeof result.wait === "object" && !Array.isArray(result.wait) ? result.wait : null;
  const closeProbe = summarizeCloseProbe(closeProbeEvents, caseDir || path.dirname(resultLog));
  const initTxnRequestShape = summarizeInitTxnRequestShapeEvent(events);
  const initTxnTargetMissing = summarizeInitTxnTargetMissing(events);
  const webSessionCheckoutCapture = summarizeWebSessionCheckoutCapture(events);
  const clientSessionCheckoutCapture = summarizeClientSessionCheckoutCapture(events);
  const clientSessionWaitStart = summarizeClientSessionWaitStart(events);
  const clientSessionPromptMissing = summarizeClientSessionPromptMissing(events);
  const microTxnCallbackProof = hasMicroTxnCallbackProof(String(action.action || ""), events, app.appId);

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
  expectInitTxnRequestShape(initTxnRequestShape, `${caseName}: InitTxn request-shape event`, failures);
  expectInitTxnRequestShape(webSessionCheckoutCapture, `${caseName}: web-session InitTxn capture`, failures);
  expectInitTxnRequestShape(clientSessionCheckoutCapture, `${caseName}: client-session InitTxn capture`, failures);
  expectInitTxnRequestShape(clientSessionPromptMissing, `${caseName}: client-session prompt-missing diagnostic`, failures);
  expectInitTxnRequestShape(initTxnTargetMissing, `${caseName}: InitTxn target-missing diagnostic`, failures);

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
    passiveNotificationProof: hasPassiveNotificationProof(String(action.action || ""), events, nativePresenter),
    microTxnCallbackListenerRegistered: hasMicroTxnCallbackListenerRegistered(events),
    legacyMicroTxnCallbackListenerRegistered: hasLegacyMicroTxnCallbackListenerRegistered(events),
    microTxnCallbackCount: events.filter(isMicroTxnCallbackEvent).length,
    microTxnCallbackSources: microTxnCallbackSources(events),
    microTxnCallbackProof: microTxnCallbackProof.ok,
    microTxnCallbackProofFailures: microTxnCallbackProof.failures,
    initTxnRequestShapePresent: initTxnRequestShape.present,
    initTxnRequestShapeSession: initTxnRequestShape.session,
    initTxnRequestShapeEndpoint: initTxnRequestShape.endpoint,
    initTxnRequestShapeUsersessionField: initTxnRequestShape.usersessionField,
    initTxnRequestShapeHasIpAddress: initTxnRequestShape.hasIpAddress,
    initTxnRequestShapeRequestShape: initTxnRequestShape.requestShapeSummary,
    webSessionCheckoutCaptured: webSessionCheckoutCapture.present,
    webSessionCheckoutCapturedSession: webSessionCheckoutCapture.session,
    webSessionCheckoutCapturedEndpoint: webSessionCheckoutCapture.endpoint,
    webSessionCheckoutCapturedHttpStatus: webSessionCheckoutCapture.httpStatus,
    webSessionCheckoutCapturedHasSteamUrl: webSessionCheckoutCapture.hasSteamUrl,
    webSessionCheckoutCapturedHasTransactionId: webSessionCheckoutCapture.hasTransactionId,
    webSessionCheckoutCapturedHasReturnUrl: webSessionCheckoutCapture.hasReturnUrl,
    webSessionCheckoutCapturedUsersessionField: webSessionCheckoutCapture.usersessionField,
    webSessionCheckoutCapturedHasIpAddress: webSessionCheckoutCapture.hasIpAddress,
    webSessionCheckoutCapturedRequestShape: webSessionCheckoutCapture.requestShapeSummary,
    clientSessionCheckoutCaptured: clientSessionCheckoutCapture.present,
    clientSessionCheckoutCapturedSession: clientSessionCheckoutCapture.session,
    clientSessionCheckoutCapturedEndpoint: clientSessionCheckoutCapture.endpoint,
    clientSessionCheckoutCapturedHttpStatus: clientSessionCheckoutCapture.httpStatus,
    clientSessionCheckoutCapturedHasTransactionId: clientSessionCheckoutCapture.hasTransactionId,
    clientSessionCheckoutCapturedHasReturnUrl: clientSessionCheckoutCapture.hasReturnUrl,
    clientSessionCheckoutCapturedUsersessionField: clientSessionCheckoutCapture.usersessionField,
    clientSessionCheckoutCapturedHasIpAddress: clientSessionCheckoutCapture.hasIpAddress,
    clientSessionCheckoutCapturedRequestShape: clientSessionCheckoutCapture.requestShapeSummary,
    clientSessionWaitStarted: clientSessionWaitStart.present,
    clientSessionWaitExpectedSteamPrompt: clientSessionWaitStart.expectedSteamPrompt,
    clientSessionWaitHasTransactionId: clientSessionWaitStart.hasTransactionId,
    clientSessionWaitHasReturnUrl: clientSessionWaitStart.hasReturnUrl,
    clientSessionWaitPresenterReady: clientSessionWaitStart.presenterReady,
    clientSessionPromptMissing: clientSessionPromptMissing.present,
    clientSessionPromptMissingSession: clientSessionPromptMissing.session,
    clientSessionPromptMissingEndpoint: clientSessionPromptMissing.endpoint,
    clientSessionPromptMissingHttpStatus: clientSessionPromptMissing.httpStatus,
    clientSessionPromptMissingUsersessionField: clientSessionPromptMissing.usersessionField,
    clientSessionPromptMissingHasIpAddress: clientSessionPromptMissing.hasIpAddress,
    clientSessionPromptMissingRequestShape: clientSessionPromptMissing.requestShapeSummary,
    initTxnTargetMissing: initTxnTargetMissing.present,
    initTxnTargetMissingSession: initTxnTargetMissing.session,
    initTxnTargetMissingResult: initTxnTargetMissing.result,
    initTxnTargetMissingErrorCode: initTxnTargetMissing.errorCode,
    initTxnTargetMissingHasErrorDescription: initTxnTargetMissing.hasErrorDescription,
    initTxnTargetMissingUsersessionField: initTxnTargetMissing.usersessionField,
    initTxnTargetMissingHasIpAddress: initTxnTargetMissing.hasIpAddress,
    initTxnTargetMissingRequestShape: initTxnTargetMissing.requestShapeSummary,
    managedOverlayCloseProof: hasManagedOverlayCloseProof(wait, overlayInactiveEvents),
    closeProbeSent: closeProbe.sent,
    closeProbeInput: closeProbe.input,
    closeProbe,
    eventTypes: events.map((event) => event && event.type).filter(Boolean),
    wait,
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
        `expectedCases=${summary.manifest.expectedCaseCount} onlyCase=${summary.manifest.onlyCase || "none"} ` +
        `inProcessGpu=${formatValue(summary.manifest.overlayInProcessGpu)} ` +
        `disableDirectComposition=${formatValue(summary.manifest.overlayDisableDirectComposition)} ` +
        `scrubChildEnv=${formatValue(summary.manifest.overlayScrubChildEnv)} ` +
        `isolateChildProcesses=${formatValue(summary.manifest.overlayIsolateChildProcesses)} ` +
        `expectedNativeHostBackend=${formatValue(summary.manifest.expectedNativeHostBackend)} ` +
        `nativePathOverride=${formatValue(summary.manifest.nativePathOverride)} ` +
        `requireMicroTxnCallback=${formatValue(summary.manifest.requireMicroTxnCallback)}`
    );
  }
  if (summary.preflight) {
    console.log(
      `preflight: generated=${summary.preflight.generatedAt || "unknown"} ` +
        `appControlVerifiedAndReputable=${formatValue(summary.preflight.verifiedAndReputableEnforced)} ` +
        `session=${formatValue(summary.preflight.currentSessionId)}`
    );
  }
  if (summary.initTxnRequestShapePreflight) {
    console.log(
      `initTxnRequestShapePreflight: hasRequestFile=${summary.initTxnRequestShapePreflight.hasRequestFile} ` +
        `requestFileExists=${summary.initTxnRequestShapePreflight.requestFileExists} ` +
        `requestAppIdPresent=${summary.initTxnRequestShapePreflight.requestAppIdPresent} ` +
        `requestAppIdMatches=${summary.initTxnRequestShapePreflight.requestAppIdMatches} ` +
        `matrixAppIdForced=${summary.initTxnRequestShapePreflight.matrixAppIdForced} ` +
        `session=${formatValue(summary.initTxnRequestShapePreflight.session)} ` +
        `request=${formatValue(summary.initTxnRequestShapePreflight.requestShapeSummary)}`
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
  if (summary.assumedShortcut) {
    console.log(
      `assumedShortcut: ok=${summary.assumedShortcut.ok} ` +
        `name=${summary.assumedShortcut.shortcutName || "unknown"} ` +
        `changed=${summary.assumedShortcut.changed} action=${summary.assumedShortcut.action || "unknown"} ` +
        `expectedGameId=${summary.assumedShortcut.expectedShortcutGameId || "unknown"} ` +
        `existingGameId=${summary.assumedShortcut.existingGameId || "unknown"} ` +
        `existingExeExists=${formatValue(summary.assumedShortcut.existingExeExists)}`
    );
  }
  if (summary.renderHealth) {
    console.log(
      `renderHealth: status=${summary.renderHealth.status || "unknown"} ` +
        `ready=${formatValue(summary.renderHealth.readyForSteamOverlayMatrix)} ` +
        `required=${formatValue(summary.renderHealth.required)} ` +
        `skipped=${formatValue(summary.renderHealth.skipped)} ` +
        `defaultVisible=${formatValue(summary.renderHealth.defaultVisible)} ` +
        `dcompVisible=${formatValue(summary.renderHealth.disableDirectCompositionVisible)} ` +
        `dcompFatal=${formatValue(summary.renderHealth.disableDirectCompositionFatal)}`
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
  if (summary.caseAppControlBlockers.length > 0) {
    console.log(`case App Control blockers: total=${summary.caseAppControlBlockers.length}`);
    for (const blocker of summary.caseAppControlBlockers) {
      console.log(
        `  ${blocker.caseName}: code=${blocker.blockerCode} ` +
          `resultPolicy=${blocker.resultPolicyBlock} ` +
          `codeIntegrityPolicy=${blocker.codeIntegrityPolicyBlock} ` +
          `verifiedAndReputable=${blocker.verifiedAndReputableBlock} ` +
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
          `overlayEnabled=${formatValue(row.overlayEnabled)} ` +
          `microTxnListener=${row.microTxnCallbackListenerRegistered} ` +
          `legacyMicroTxnListener=${row.legacyMicroTxnCallbackListenerRegistered} ` +
          `microTxnCallbacks=${row.microTxnCallbackCount} ` +
          `microTxnSources=${formatValue(row.microTxnCallbackSources)} microTxnProof=${row.microTxnCallbackProof} ` +
          `initTxnRequestShape=${row.initTxnRequestShapePresent} ` +
          `initTxnRequestSession=${formatValue(row.initTxnRequestShapeSession)} ` +
          `initTxnRequestEndpoint=${formatValue(row.initTxnRequestShapeEndpoint)} ` +
          `initTxnRequestUsersession=${formatValue(row.initTxnRequestShapeUsersessionField)} ` +
          `initTxnRequestIpAddress=${formatValue(row.initTxnRequestShapeHasIpAddress)} ` +
          `initTxnRequestShapeSummary=${formatValue(row.initTxnRequestShapeRequestShape)} ` +
          `webSessionCaptured=${row.webSessionCheckoutCaptured} ` +
          `webSessionCapturedSession=${formatValue(row.webSessionCheckoutCapturedSession)} ` +
          `webSessionCapturedEndpoint=${formatValue(row.webSessionCheckoutCapturedEndpoint)} ` +
          `webSessionCapturedHttp=${formatValue(row.webSessionCheckoutCapturedHttpStatus)} ` +
          `webSessionCapturedSteamUrl=${formatValue(row.webSessionCheckoutCapturedHasSteamUrl)} ` +
          `webSessionCapturedTransaction=${formatValue(row.webSessionCheckoutCapturedHasTransactionId)} ` +
          `webSessionCapturedReturnUrl=${formatValue(row.webSessionCheckoutCapturedHasReturnUrl)} ` +
          `webSessionCapturedUsersession=${formatValue(row.webSessionCheckoutCapturedUsersessionField)} ` +
          `webSessionCapturedIpAddress=${formatValue(row.webSessionCheckoutCapturedHasIpAddress)} ` +
          `webSessionCapturedRequest=${formatValue(row.webSessionCheckoutCapturedRequestShape)} ` +
          `clientSessionCaptured=${row.clientSessionCheckoutCaptured} ` +
          `clientSessionCapturedSession=${formatValue(row.clientSessionCheckoutCapturedSession)} ` +
          `clientSessionCapturedEndpoint=${formatValue(row.clientSessionCheckoutCapturedEndpoint)} ` +
          `clientSessionCapturedHttp=${formatValue(row.clientSessionCheckoutCapturedHttpStatus)} ` +
          `clientSessionCapturedTransaction=${formatValue(row.clientSessionCheckoutCapturedHasTransactionId)} ` +
          `clientSessionCapturedReturnUrl=${formatValue(row.clientSessionCheckoutCapturedHasReturnUrl)} ` +
          `clientSessionCapturedUsersession=${formatValue(row.clientSessionCheckoutCapturedUsersessionField)} ` +
          `clientSessionCapturedIpAddress=${formatValue(row.clientSessionCheckoutCapturedHasIpAddress)} ` +
          `clientSessionCapturedRequest=${formatValue(row.clientSessionCheckoutCapturedRequestShape)} ` +
          `clientSessionWaitStarted=${row.clientSessionWaitStarted} ` +
          `clientSessionWaitPrompt=${row.clientSessionWaitExpectedSteamPrompt} ` +
          `clientSessionWaitTransaction=${row.clientSessionWaitHasTransactionId} ` +
          `clientSessionWaitReturnUrl=${row.clientSessionWaitHasReturnUrl} ` +
          `clientSessionWaitPresenter=${row.clientSessionWaitPresenterReady} ` +
          `clientPromptMissing=${row.clientSessionPromptMissing} ` +
          `clientPromptSession=${formatValue(row.clientSessionPromptMissingSession)} ` +
          `clientPromptEndpoint=${formatValue(row.clientSessionPromptMissingEndpoint)} ` +
          `clientPromptHttp=${formatValue(row.clientSessionPromptMissingHttpStatus)} ` +
          `clientPromptUsersession=${formatValue(row.clientSessionPromptMissingUsersessionField)} ` +
          `clientPromptIpAddress=${formatValue(row.clientSessionPromptMissingHasIpAddress)} ` +
          `clientPromptRequest=${formatValue(row.clientSessionPromptMissingRequestShape)} ` +
          `initTxnTargetMissing=${row.initTxnTargetMissing} ` +
          `initTxnSession=${formatValue(row.initTxnTargetMissingSession)} ` +
          `initTxnResult=${formatValue(row.initTxnTargetMissingResult)} ` +
          `initTxnErrorCode=${formatValue(row.initTxnTargetMissingErrorCode)} ` +
          `initTxnUsersession=${formatValue(row.initTxnTargetMissingUsersessionField)} ` +
          `initTxnIpAddress=${formatValue(row.initTxnTargetMissingHasIpAddress)} ` +
          `initTxnRequest=${formatValue(row.initTxnTargetMissingRequestShape)} ` +
          formatCloseProbeSummary(row.closeProbe) +
          `crashes=${row.crashDumpCount + row.fatalLifecycleEventCount}` +
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

function summarizeInitTxnRequestShapePreflight(shape) {
  const requestShape = summarizeInitTxnRequestShape(shape);
  return {
    hasRequestFile: shape.hasRequestFile === true,
    requestFileExists: shape.requestFileExists === true,
    requestAppIdPresent: shape.requestAppIdPresent === true,
    requestAppIdMatches: shape.requestAppIdMatches === true,
    matrixAppIdForced: shape.matrixAppIdForced === true,
    session: String(shape.session || ""),
    usersessionField: requestShape.usersessionField,
    hasIpAddress: requestShape.hasIpAddress,
    requestShapeSummary: requestShape.summary
  };
}

function summarizeManifest(manifest) {
  return {
    suite: manifest.suite || "",
    launchMode: manifest.launchMode || "",
    appId: manifest.appId,
    onlyCase: manifest.onlyCase || "",
    overlayInProcessGpu: manifest.overlayInProcessGpu || "",
    overlayDisableDirectComposition: manifest.overlayDisableDirectComposition || "",
    overlayScrubChildEnv: manifest.overlayScrubChildEnv || "",
    overlayIsolateChildProcesses: manifest.overlayIsolateChildProcesses || "",
    expectedNativeHostBackend: manifest.expectedNativeHostBackend || "",
    nativePathOverride: Boolean(manifest.nativePathOverride),
    requireMicroTxnCallback: manifest.requireMicroTxnCallback === true,
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

function summarizeAssumedShortcut(shortcut) {
  const result = objectOrEmpty(shortcut.result);
  const expected = objectOrEmpty(result.expected);
  const existing = objectOrEmpty(result.existing);
  return {
    ok: shortcut.ok === true,
    shortcutName: shortcut.shortcutName || "",
    requestedShortcutGameId: shortcut.requestedShortcutGameId || "",
    expectedShortcutGameId: shortcut.expectedShortcutGameId || "",
    changed: shortcut.changed === true,
    action: shortcut.action || "",
    existingMatches: shortcut.existingMatches === true,
    expectedExeExists: expected.exeExists,
    existingExeExists: existing.exeExists,
    existingGameId: existing.gameId || ""
  };
}

function summarizeRenderHealth(renderHealth, gate) {
  const recommendation = objectOrEmpty(renderHealth && renderHealth.recommendation);
  const cases = Array.isArray(renderHealth && renderHealth.cases) ? renderHealth.cases : [];
  const defaultCase =
    cases.find((entry) => entry && entry.name === "default") ||
    cases.find((entry) => entry && entry.name === "in-process-gpu-on") ||
    {};
  return {
    status: gate && gate.status ? gate.status : recommendation.status || "",
    readyForSteamOverlayMatrix: Boolean(
      gate && "readyForSteamOverlayMatrix" in gate
        ? gate.readyForSteamOverlayMatrix
        : recommendation.readyForSteamOverlayMatrix
    ),
    required: gate ? gate.required !== false : true,
    skipped: Boolean(gate && gate.skipped === true),
    reason: (gate && gate.reason) || "",
    defaultVisible: defaultCase.contentVisible,
    defaultBlankLike: defaultCase.blankLike,
    disableDirectCompositionVisible: recommendation.disableDirectCompositionVisible,
    disableDirectCompositionFatal: recommendation.disableDirectCompositionFatal,
    nextAction: (gate && gate.nextAction) || recommendation.nextAction || ""
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

function summarizeCaseAppControlBlocker(caseName, blocker) {
  return {
    caseName,
    blockerCode: blocker.blockerCode || "",
    resultPolicyBlock: blocker.resultPolicyBlock === true,
    codeIntegrityPolicyBlock: blocker.codeIntegrityPolicyBlock === true,
    verifiedAndReputableBlock: blocker.verifiedAndReputableBlock === true,
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

function summarizeCloseProbe(events, caseDir = "") {
  const normalizedEvents = Array.isArray(events) ? events.filter(Boolean) : [];
  const sentEvent = normalizedEvents.find((event) => event.type === "probe:sent");
  const foregroundSamples = normalizedEvents
    .map((event) => {
      const payload = objectOrEmpty(event.payload);
      const foreground = objectOrEmpty(payload.foreground);
      if (!foreground.processName && !foreground.title && !foreground.pid) {
        return null;
      }
      return {
        type: event.type,
        processName: String(foreground.processName || ""),
        title: String(foreground.title || ""),
        pid: foreground.pid || null
      };
    })
    .filter(Boolean);
  const screenshotCount = normalizedEvents.filter((event) => {
    const payload = objectOrEmpty(event.payload);
    const screenshot = objectOrEmpty(payload.screenshot);
    return screenshot.ok === true || typeof screenshot.path === "string";
  }).length;
  const screenshotVisuals = summarizeCloseProbeScreenshotVisuals(normalizedEvents, caseDir);
  const foregroundProcessNames = uniqueStrings(
    foregroundSamples.map((sample) => sample.processName).filter(Boolean)
  );
  const foregroundStayedOnSmoke =
    foregroundSamples.length > 0 &&
    foregroundSamples.every((sample) => /SteamBridgeSmoke/i.test(sample.processName));

  return {
    sent: Boolean(sentEvent),
    input: sentEvent ? String(objectOrEmpty(sentEvent.payload).input || "") : "",
    eventCount: normalizedEvents.length,
    screenshotCount,
    screenshotVisuals,
    foregroundSampleCount: foregroundSamples.length,
    foregroundProcessNames,
    foregroundStayedOnSmoke
  };
}

function summarizeCloseProbeScreenshotVisuals(events, caseDir) {
  const refs = events
    .map((event) => {
      const payload = objectOrEmpty(event.payload);
      const screenshot = objectOrEmpty(payload.screenshot);
      if (screenshot.ok !== true && typeof screenshot.path !== "string") {
        return null;
      }
      return {
        eventType: String(event.type || ""),
        path: String(screenshot.path || "")
      };
    })
    .filter(Boolean);
  const samples = [];
  let missingCount = 0;
  let unreadableCount = 0;

  for (const ref of refs) {
    const resolved = resolveCloseProbeScreenshotPath(ref.path, caseDir);
    if (!resolved) {
      missingCount += 1;
      continue;
    }
    try {
      samples.push({
        eventType: ref.eventType,
        path: resolved,
        ...analyzePngVisuals(resolved)
      });
    } catch (error) {
      unreadableCount += 1;
      samples.push({
        eventType: ref.eventType,
        path: resolved,
        error: error.message
      });
    }
  }

  const readable = samples.filter((sample) => !sample.error);
  const meanValues = readable.map((sample) => sample.meanLuma);
  const minMeanLuma = meanValues.length > 0 ? Math.min(...meanValues) : null;
  const maxMeanLuma = meanValues.length > 0 ? Math.max(...meanValues) : null;
  return {
    referencedCount: refs.length,
    availableCount: readable.length,
    missingCount,
    unreadableCount,
    mostlyDarkCount: readable.filter((sample) => sample.mostlyDark).length,
    lowVarianceCount: readable.filter((sample) => sample.lowVariance).length,
    visibleDetailCount: readable.filter((sample) => sample.visibleDetail).length,
    minMeanLuma: minMeanLuma == null ? null : roundNumber(minMeanLuma, 2),
    maxMeanLuma: maxMeanLuma == null ? null : roundNumber(maxMeanLuma, 2)
  };
}

function resolveCloseProbeScreenshotPath(screenshotPath, caseDir) {
  const candidates = [];
  if (screenshotPath) {
    candidates.push(screenshotPath);
    candidates.push(path.resolve(caseDir || "", screenshotPath));
    const normalized = screenshotPath.replace(/\\/g, "/");
    const basename = normalized.split("/").filter(Boolean).pop();
    if (basename) {
      candidates.push(path.join(caseDir || "", basename));
    }
  }
  for (const candidate of candidates) {
    if (candidate && fs.existsSync(candidate)) {
      return candidate;
    }
  }
  return "";
}

function analyzePngVisuals(filePath) {
  const png = decodePng(filePath);
  let sum = 0;
  let sumSquares = 0;
  let darkPixels = 0;
  let brightPixels = 0;
  let sampleCount = 0;
  const step = Math.max(1, Math.floor(Math.sqrt((png.width * png.height) / 120000)));

  for (let y = 0; y < png.height; y += step) {
    for (let x = 0; x < png.width; x += step) {
      const pixel = (y * png.width + x) * png.channels;
      const r = png.data[pixel];
      const g = png.channels === 1 ? r : png.data[pixel + 1];
      const b = png.channels === 1 ? r : png.data[pixel + 2];
      const luma = (0.2126 * r) + (0.7152 * g) + (0.0722 * b);
      sum += luma;
      sumSquares += luma * luma;
      sampleCount += 1;
      if (luma < 32) {
        darkPixels += 1;
      }
      if (luma > 96) {
        brightPixels += 1;
      }
    }
  }

  const meanLuma = sampleCount > 0 ? sum / sampleCount : 0;
  const variance = sampleCount > 0 ? Math.max(0, (sumSquares / sampleCount) - (meanLuma * meanLuma)) : 0;
  const stddevLuma = Math.sqrt(variance);
  const darkRatio = sampleCount > 0 ? darkPixels / sampleCount : 0;
  const brightRatio = sampleCount > 0 ? brightPixels / sampleCount : 0;
  const mostlyDark = darkRatio >= 0.85 || meanLuma < 35;
  const lowVariance = stddevLuma < 8;
  return {
    width: png.width,
    height: png.height,
    meanLuma: roundNumber(meanLuma, 2),
    stddevLuma: roundNumber(stddevLuma, 2),
    darkRatio: roundNumber(darkRatio, 4),
    brightRatio: roundNumber(brightRatio, 4),
    mostlyDark,
    lowVariance,
    visibleDetail: !mostlyDark && !lowVariance && brightRatio > 0.02
  };
}

function decodePng(filePath) {
  const buffer = fs.readFileSync(filePath);
  const signature = "89504e470d0a1a0a";
  if (buffer.subarray(0, 8).toString("hex") !== signature) {
    throw new Error("not a PNG file");
  }

  let offset = 8;
  let width = 0;
  let height = 0;
  let bitDepth = 0;
  let colorType = 0;
  const idat = [];
  while (offset + 12 <= buffer.length) {
    const length = buffer.readUInt32BE(offset);
    const type = buffer.subarray(offset + 4, offset + 8).toString("ascii");
    const data = buffer.subarray(offset + 8, offset + 8 + length);
    offset += 12 + length;
    if (type === "IHDR") {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      bitDepth = data[8];
      colorType = data[9];
      const interlace = data[12];
      if (interlace !== 0) {
        throw new Error("interlaced PNG is not supported");
      }
    } else if (type === "IDAT") {
      idat.push(data);
    } else if (type === "IEND") {
      break;
    }
  }

  if (!width || !height || bitDepth !== 8) {
    throw new Error("unsupported PNG dimensions or bit depth");
  }
  const channels = pngChannels(colorType);
  const inflated = zlib.inflateSync(Buffer.concat(idat));
  const stride = width * channels;
  const output = Buffer.alloc(width * height * channels);
  let inputOffset = 0;
  let outputOffset = 0;
  let previous = Buffer.alloc(stride);
  for (let y = 0; y < height; y += 1) {
    const filter = inflated[inputOffset++];
    const current = Buffer.alloc(stride);
    inflated.copy(current, 0, inputOffset, inputOffset + stride);
    inputOffset += stride;
    unfilterPngRow(current, previous, channels, filter);
    current.copy(output, outputOffset);
    outputOffset += stride;
    previous = current;
  }
  return { width, height, channels, data: output };
}

function pngChannels(colorType) {
  switch (colorType) {
    case 0:
      return 1;
    case 2:
      return 3;
    case 6:
      return 4;
    default:
      throw new Error(`unsupported PNG color type ${colorType}`);
  }
}

function unfilterPngRow(row, previous, bytesPerPixel, filter) {
  for (let index = 0; index < row.length; index += 1) {
    const left = index >= bytesPerPixel ? row[index - bytesPerPixel] : 0;
    const up = previous[index] || 0;
    const upLeft = index >= bytesPerPixel ? previous[index - bytesPerPixel] || 0 : 0;
    let value = row[index];
    if (filter === 1) {
      value += left;
    } else if (filter === 2) {
      value += up;
    } else if (filter === 3) {
      value += Math.floor((left + up) / 2);
    } else if (filter === 4) {
      value += paethPredictor(left, up, upLeft);
    } else if (filter !== 0) {
      throw new Error(`unsupported PNG row filter ${filter}`);
    }
    row[index] = value & 0xff;
  }
}

function paethPredictor(left, up, upLeft) {
  const predictor = left + up - upLeft;
  const leftDistance = Math.abs(predictor - left);
  const upDistance = Math.abs(predictor - up);
  const upLeftDistance = Math.abs(predictor - upLeft);
  if (leftDistance <= upDistance && leftDistance <= upLeftDistance) {
    return left;
  }
  return upDistance <= upLeftDistance ? up : upLeft;
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

function hasSmokeResultPayload(resultLog) {
  return readText(resultLog)
    .split(/\r?\n/)
    .some((entry) => entry.startsWith(RESULT_PREFIX));
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

function readJsonLinesIfPresent(file, failures) {
  if (!fs.existsSync(file)) {
    return [];
  }
  return readText(file)
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line, index) => {
      try {
        return JSON.parse(line);
      } catch (error) {
        failures.push(`could not parse JSON line ${index + 1} in ${file}: ${error.message}`);
        return null;
      }
    })
    .filter(Boolean);
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

function formatCloseProbeSummary(closeProbe) {
  if (!closeProbe || closeProbe.eventCount === 0) {
    return "";
  }
  const foreground = closeProbe.foregroundProcessNames.length > 0
    ? closeProbe.foregroundProcessNames.join(",")
    : "unknown";
  return (
    `closeProbe=${closeProbe.sent ? formatValue(closeProbe.input) : "not-sent"} ` +
    `closeProbeFg=${foreground} ` +
    `closeProbeScreens=${closeProbe.screenshotCount} ` +
    formatCloseProbeVisualSummary(closeProbe.screenshotVisuals) +
    `closeProbeGameFg=${closeProbe.foregroundStayedOnSmoke} `
  );
}

function formatCloseProbeVisualSummary(visuals) {
  if (!visuals || visuals.referencedCount === 0) {
    return "";
  }
  return (
    `closeProbeVisuals=${visuals.availableCount}/${visuals.referencedCount} ` +
    `dark=${visuals.mostlyDarkCount} lowVar=${visuals.lowVarianceCount} ` +
    `detail=${visuals.visibleDetailCount} ` +
    `luma=${formatValue(visuals.minMeanLuma)}..${formatValue(visuals.maxMeanLuma)} `
  );
}

function roundNumber(value, digits) {
  const scale = 10 ** digits;
  return Math.round(value * scale) / scale;
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

    const shortcutRoutesRoot = path.join(tempRoot, "shortcut-routes");
    writeCaseFixture(shortcutRoutesRoot, { suite: "shortcut-routes" });
    const shortcutRoutesSummary = summarizeWindowsOverlayMatrixArtifacts(shortcutRoutesRoot);
    assert.deepEqual(shortcutRoutesSummary.failures, []);
    assert.equal(shortcutRoutesSummary.manifest.suite, "shortcut-routes");

    const managedRoot = path.join(tempRoot, "managed");
    writeManagedCaseFixture(managedRoot);
    const managedSummary = summarizeWindowsOverlayMatrixArtifacts(managedRoot);
    assert.deepEqual(managedSummary.failures, []);
    assert.equal(managedSummary.caseSummaries.length, 1);
    assert.equal(managedSummary.totals.overlayActiveCases, 1);

    const managedCloseWaitRoot = path.join(tempRoot, "managed-close-wait");
    writeManagedCaseFixture(managedCloseWaitRoot, { omitInactiveEvent: true });
    const managedCloseWaitSummary = summarizeWindowsOverlayMatrixArtifacts(managedCloseWaitRoot);
    assert.deepEqual(managedCloseWaitSummary.failures, []);
    assert.equal(managedCloseWaitSummary.caseSummaries[0].managedOverlayCloseProof, true);

    const managedCheckoutMicroTxnRoot = path.join(tempRoot, "managed-checkout-microtxn");
    writeManagedCheckoutMicroTxnFixture(managedCheckoutMicroTxnRoot);
    const managedCheckoutMicroTxnSummary = summarizeWindowsOverlayMatrixArtifacts(managedCheckoutMicroTxnRoot);
    assert.deepEqual(managedCheckoutMicroTxnSummary.failures, []);
    assert.equal(managedCheckoutMicroTxnSummary.caseSummaries[0].microTxnCallbackListenerRegistered, true);
    assert.equal(managedCheckoutMicroTxnSummary.caseSummaries[0].legacyMicroTxnCallbackListenerRegistered, true);
    assert.equal(managedCheckoutMicroTxnSummary.caseSummaries[0].microTxnCallbackCount, 1);
    assert.equal(managedCheckoutMicroTxnSummary.caseSummaries[0].microTxnCallbackSources, "steamworks");
    assert.equal(managedCheckoutMicroTxnSummary.caseSummaries[0].microTxnCallbackProof, true);

    const missingMicroTxnListenerRoot = path.join(tempRoot, "managed-checkout-missing-microtxn-listener");
    writeManagedCheckoutMicroTxnFixture(missingMicroTxnListenerRoot, { omitMicroTxnListener: true });
    const missingMicroTxnListenerSummary = summarizeWindowsOverlayMatrixArtifacts(missingMicroTxnListenerRoot);
    assert(
      missingMicroTxnListenerSummary.failures.some((failure) =>
        failure.includes("registered MicroTxnAuthorizationResponse listener")
      ),
      "summary self-test should fail when real checkout proof omits listener-registration evidence"
    );

    const missingLegacyMicroTxnListenerRoot = path.join(tempRoot, "managed-checkout-missing-legacy-microtxn-listener");
    writeManagedCheckoutMicroTxnFixture(missingLegacyMicroTxnListenerRoot, { omitLegacyMicroTxnListener: true });
    const missingLegacyMicroTxnListenerSummary =
      summarizeWindowsOverlayMatrixArtifacts(missingLegacyMicroTxnListenerRoot);
    assert(
      missingLegacyMicroTxnListenerSummary.failures.some((failure) =>
        failure.includes("registered LegacyMicroTxnAuthorizationResponse listener")
      ),
      "summary self-test should fail when real checkout proof omits legacy listener-registration evidence"
    );

    const missingMicroTxnRoot = path.join(tempRoot, "managed-checkout-missing-microtxn");
    writeManagedCheckoutMicroTxnFixture(missingMicroTxnRoot, { omitMicroTxn: true });
    const missingMicroTxnSummary = summarizeWindowsOverlayMatrixArtifacts(missingMicroTxnRoot);
    assert(
      missingMicroTxnSummary.failures.some((failure) =>
        failure.includes("proved MicroTxnAuthorizationResponse callback")
      ),
      "summary self-test should fail when real checkout proof omits the MicroTxn callback"
    );

    const missingMicroTxnSourceRoot = path.join(tempRoot, "managed-checkout-missing-microtxn-source");
    writeManagedCheckoutMicroTxnFixture(missingMicroTxnSourceRoot, { omitMicroTxnCallbackSource: true });
    const missingMicroTxnSourceSummary = summarizeWindowsOverlayMatrixArtifacts(missingMicroTxnSourceRoot);
    assert(
      missingMicroTxnSourceSummary.failures.some((failure) =>
        failure.includes("did not include a callback source")
      ),
      "summary self-test should fail when real checkout proof omits the MicroTxn callback source"
    );

    const unknownMicroTxnSourceRoot = path.join(tempRoot, "managed-checkout-unknown-microtxn-source");
    writeManagedCheckoutMicroTxnFixture(unknownMicroTxnSourceRoot, { callbackSource: "raw" });
    const unknownMicroTxnSourceSummary = summarizeWindowsOverlayMatrixArtifacts(unknownMicroTxnSourceRoot);
    assert(
      unknownMicroTxnSourceSummary.failures.some((failure) =>
        failure.includes("callback source expected steamworks or legacy")
      ),
      "summary self-test should fail when real checkout proof records an unknown MicroTxn callback source"
    );

    const webSessionCapturedRoot = path.join(tempRoot, "managed-checkout-web-session-captured");
    writeManagedCheckoutMicroTxnFixture(webSessionCapturedRoot, { webSessionCaptured: true });
    const webSessionCapturedSummary = summarizeWindowsOverlayMatrixArtifacts(webSessionCapturedRoot);
    assert.deepEqual(webSessionCapturedSummary.failures, []);
    assert.equal(webSessionCapturedSummary.caseSummaries[0].webSessionCheckoutCaptured, true);
    assert.equal(webSessionCapturedSummary.caseSummaries[0].webSessionCheckoutCapturedSession, "web");
    assert.equal(webSessionCapturedSummary.caseSummaries[0].webSessionCheckoutCapturedEndpoint, "sandbox");
    assert.equal(webSessionCapturedSummary.caseSummaries[0].webSessionCheckoutCapturedHttpStatus, "200");
    assert.equal(webSessionCapturedSummary.caseSummaries[0].webSessionCheckoutCapturedHasSteamUrl, true);
    assert.equal(webSessionCapturedSummary.caseSummaries[0].webSessionCheckoutCapturedHasTransactionId, true);
    assert.equal(webSessionCapturedSummary.caseSummaries[0].webSessionCheckoutCapturedHasReturnUrl, true);
    assert.equal(webSessionCapturedSummary.caseSummaries[0].webSessionCheckoutCapturedUsersessionField, "web");
    assert.equal(webSessionCapturedSummary.caseSummaries[0].webSessionCheckoutCapturedHasIpAddress, "false");
    assert.equal(
      webSessionCapturedSummary.caseSummaries[0].webSessionCheckoutCapturedRequestShape,
      "usersession=web,ip=false,order=true,steam=true,language=true,currency=true,items=1,bundles=0,itemFields=true,bundleFields=true"
    );
    assert.equal(webSessionCapturedSummary.manifest.requireMicroTxnCallback, false);

    const webSessionMissingSteamUrlRoot = path.join(tempRoot, "managed-checkout-web-session-missing-steam-url");
    writeManagedCheckoutMicroTxnFixture(webSessionMissingSteamUrlRoot, {
      webSessionCaptured: true,
      webSessionHasSteamUrl: false
    });
    const webSessionMissingSteamUrlSummary = summarizeWindowsOverlayMatrixArtifacts(webSessionMissingSteamUrlRoot);
    assert(
      webSessionMissingSteamUrlSummary.failures.some((failure) =>
        failure.includes("captured web-session InitTxn Steam approval URL shape")
      ),
      "summary self-test should fail when a web-session InitTxn artifact omits the Steam approval URL shape"
    );

    const clientPromptMissingRoot = path.join(tempRoot, "managed-checkout-client-prompt-missing");
    writeManagedCheckoutMicroTxnFixture(clientPromptMissingRoot, { clientPromptMissing: true });
    const clientPromptMissingSummary = summarizeWindowsOverlayMatrixArtifacts(clientPromptMissingRoot);
    assert.equal(clientPromptMissingSummary.caseSummaries[0].initTxnRequestShapePresent, true);
    assert.equal(clientPromptMissingSummary.caseSummaries[0].initTxnRequestShapeSession, "client");
    assert.equal(clientPromptMissingSummary.caseSummaries[0].initTxnRequestShapeEndpoint, "sandbox");
    assert.equal(clientPromptMissingSummary.caseSummaries[0].initTxnRequestShapeUsersessionField, "client");
    assert.equal(clientPromptMissingSummary.caseSummaries[0].initTxnRequestShapeHasIpAddress, "false");
    assert.equal(
      clientPromptMissingSummary.caseSummaries[0].initTxnRequestShapeRequestShape,
      "usersession=client,ip=false,order=true,steam=true,language=true,currency=true,items=1,bundles=0,itemFields=true,bundleFields=true"
    );
    assert.equal(clientPromptMissingSummary.caseSummaries[0].clientSessionCheckoutCaptured, true);
    assert.equal(clientPromptMissingSummary.caseSummaries[0].clientSessionCheckoutCapturedSession, "client");
    assert.equal(clientPromptMissingSummary.caseSummaries[0].clientSessionCheckoutCapturedEndpoint, "sandbox");
    assert.equal(clientPromptMissingSummary.caseSummaries[0].clientSessionCheckoutCapturedHttpStatus, "200");
    assert.equal(clientPromptMissingSummary.caseSummaries[0].clientSessionCheckoutCapturedHasTransactionId, true);
    assert.equal(clientPromptMissingSummary.caseSummaries[0].clientSessionCheckoutCapturedHasReturnUrl, false);
    assert.equal(clientPromptMissingSummary.caseSummaries[0].clientSessionCheckoutCapturedUsersessionField, "client");
    assert.equal(clientPromptMissingSummary.caseSummaries[0].clientSessionCheckoutCapturedHasIpAddress, "false");
    assert.equal(
      clientPromptMissingSummary.caseSummaries[0].clientSessionCheckoutCapturedRequestShape,
      "usersession=client,ip=false,order=true,steam=true,language=true,currency=true,items=1,bundles=0,itemFields=true,bundleFields=true"
    );
    assert.equal(clientPromptMissingSummary.caseSummaries[0].clientSessionWaitStarted, true);
    assert.equal(clientPromptMissingSummary.caseSummaries[0].clientSessionWaitExpectedSteamPrompt, true);
    assert.equal(clientPromptMissingSummary.caseSummaries[0].clientSessionWaitHasTransactionId, true);
    assert.equal(clientPromptMissingSummary.caseSummaries[0].clientSessionWaitHasReturnUrl, false);
    assert.equal(clientPromptMissingSummary.caseSummaries[0].clientSessionWaitPresenterReady, true);
    assert.equal(clientPromptMissingSummary.caseSummaries[0].clientSessionPromptMissing, true);
    assert.equal(clientPromptMissingSummary.caseSummaries[0].clientSessionPromptMissingSession, "client");
    assert.equal(clientPromptMissingSummary.caseSummaries[0].clientSessionPromptMissingEndpoint, "sandbox");
    assert.equal(clientPromptMissingSummary.caseSummaries[0].clientSessionPromptMissingHttpStatus, "200");
    assert.equal(clientPromptMissingSummary.caseSummaries[0].clientSessionPromptMissingUsersessionField, "client");
    assert.equal(clientPromptMissingSummary.caseSummaries[0].clientSessionPromptMissingHasIpAddress, "false");
    assert.equal(
      clientPromptMissingSummary.caseSummaries[0].clientSessionPromptMissingRequestShape,
      "usersession=client,ip=false,order=true,steam=true,language=true,currency=true,items=1,bundles=0,itemFields=true,bundleFields=true"
    );
    assert.equal(clientPromptMissingSummary.initTxnRequestShapePreflight.hasRequestFile, true);
    assert.equal(clientPromptMissingSummary.initTxnRequestShapePreflight.requestFileExists, true);
    assert.equal(clientPromptMissingSummary.initTxnRequestShapePreflight.requestAppIdPresent, true);
    assert.equal(clientPromptMissingSummary.initTxnRequestShapePreflight.requestAppIdMatches, true);
    assert.equal(clientPromptMissingSummary.initTxnRequestShapePreflight.matrixAppIdForced, true);
    assert.equal(clientPromptMissingSummary.initTxnRequestShapePreflight.session, "client");
    assert.equal(
      clientPromptMissingSummary.initTxnRequestShapePreflight.requestShapeSummary,
      "usersession=client,ip=false,order=true,steam=true,language=true,currency=true,items=1,bundles=0,itemFields=true,bundleFields=true"
    );

    const missingClientWaitStartRoot = path.join(tempRoot, "managed-checkout-missing-client-wait-start");
    writeManagedCheckoutMicroTxnFixture(missingClientWaitStartRoot, {
      clientPromptMissing: true,
      omitClientSessionWaitStart: true
    });
    const missingClientWaitStartSummary = summarizeWindowsOverlayMatrixArtifacts(missingClientWaitStartRoot);
    assert(
      missingClientWaitStartSummary.failures.some((failure) =>
        failure.includes("started waiting for the client-session Steam prompt")
      ),
      "summary self-test should fail when a client-session InitTxn artifact omits the wait-start diagnostic"
    );

    const missingPreflightRequestShapeRoot = path.join(tempRoot, "managed-checkout-missing-preflight-shape");
    writeManagedCheckoutMicroTxnFixture(missingPreflightRequestShapeRoot, {
      clientPromptMissing: true,
      omitInitTxnRequestShapePreflight: true
    });
    const missingPreflightRequestShapeSummary = summarizeWindowsOverlayMatrixArtifacts(missingPreflightRequestShapeRoot);
    assert(
      missingPreflightRequestShapeSummary.failures.some((failure) =>
        failure.includes("missing InitTxn request-shape preflight JSON")
      ),
      "summary self-test should fail when an InitTxn request-file matrix omits the preflight request shape"
    );

    const mismatchedPreflightRequestShapeRoot = path.join(tempRoot, "managed-checkout-mismatched-preflight-shape");
    writeManagedCheckoutMicroTxnFixture(mismatchedPreflightRequestShapeRoot, { clientPromptMissing: true });
    writeInitTxnRequestShapePreflightFixture(mismatchedPreflightRequestShapeRoot, {
      session: "client",
      overrides: { requestAppIdMatches: false }
    });
    const mismatchedPreflightRequestShapeSummary = summarizeWindowsOverlayMatrixArtifacts(
      mismatchedPreflightRequestShapeRoot
    );
    assert(
      mismatchedPreflightRequestShapeSummary.failures.some((failure) =>
        failure.includes("InitTxn request-shape preflight app ID matches matrix App ID")
      ),
      "summary self-test should fail when an InitTxn request-file preflight records an app ID mismatch"
    );

    const missingRuntimeRequestShapeRoot = path.join(tempRoot, "managed-checkout-missing-runtime-request-shape");
    writeManagedCheckoutMicroTxnFixture(missingRuntimeRequestShapeRoot, {
      clientPromptMissing: true,
      omitInitTxnRequestShapeEvent: true
    });
    const missingRuntimeRequestShapeSummary = summarizeWindowsOverlayMatrixArtifacts(missingRuntimeRequestShapeRoot);
    assert(
      missingRuntimeRequestShapeSummary.failures.some((failure) =>
        failure.includes("captured InitTxn request-shape event")
      ),
      "summary self-test should fail when an InitTxn request-file case omits the runtime request-shape event"
    );

    const driftedRuntimeRequestShapeRoot = path.join(tempRoot, "managed-checkout-drifted-runtime-request-shape");
    writeManagedCheckoutMicroTxnFixture(driftedRuntimeRequestShapeRoot, { clientPromptMissing: true });
    writeInitTxnRequestShapePreflightFixture(driftedRuntimeRequestShapeRoot, {
      session: "client",
      overrides: { hasIpAddress: true }
    });
    const driftedRuntimeRequestShapeSummary = summarizeWindowsOverlayMatrixArtifacts(driftedRuntimeRequestShapeRoot);
    assert(
      driftedRuntimeRequestShapeSummary.failures.some((failure) =>
        failure.includes("runtime InitTxn request shape matches preflight")
      ),
      "summary self-test should fail when runtime and preflight InitTxn request shapes drift"
    );

    const defaultClientPromptMissingRoot = path.join(tempRoot, "managed-checkout-default-client-prompt-missing");
    writeManagedCheckoutMicroTxnFixture(defaultClientPromptMissingRoot, {
      clientPromptMissing: true,
      clientPromptMissingSession: "client-default"
    });
    const defaultClientPromptMissingSummary = summarizeWindowsOverlayMatrixArtifacts(defaultClientPromptMissingRoot);
    assert.equal(defaultClientPromptMissingSummary.caseSummaries[0].clientSessionCheckoutCaptured, true);
    assert.equal(defaultClientPromptMissingSummary.caseSummaries[0].clientSessionCheckoutCapturedSession, "client-default");
    assert.equal(
      defaultClientPromptMissingSummary.caseSummaries[0].clientSessionCheckoutCapturedUsersessionField,
      "omitted"
    );
    assert.equal(
      defaultClientPromptMissingSummary.caseSummaries[0].clientSessionCheckoutCapturedRequestShape,
      "usersession=omitted,ip=false,order=true,steam=true,language=true,currency=true,items=1,bundles=0,itemFields=true,bundleFields=true"
    );
    assert.equal(defaultClientPromptMissingSummary.caseSummaries[0].clientSessionPromptMissing, true);
    assert.equal(defaultClientPromptMissingSummary.caseSummaries[0].clientSessionPromptMissingSession, "client-default");
    assert.equal(
      defaultClientPromptMissingSummary.caseSummaries[0].clientSessionPromptMissingUsersessionField,
      "omitted"
    );
    assert.equal(
      defaultClientPromptMissingSummary.caseSummaries[0].clientSessionPromptMissingRequestShape,
      "usersession=omitted,ip=false,order=true,steam=true,language=true,currency=true,items=1,bundles=0,itemFields=true,bundleFields=true"
    );

    const missingRequestShapeRoot = path.join(tempRoot, "managed-checkout-missing-request-shape");
    writeManagedCheckoutMicroTxnFixture(missingRequestShapeRoot, {
      clientPromptMissing: true,
      omitInitTxnRequestShape: true
    });
    const missingRequestShapeSummary = summarizeWindowsOverlayMatrixArtifacts(missingRequestShapeRoot);
    assert(
      missingRequestShapeSummary.failures.some((failure) =>
        failure.includes("client-session InitTxn capture: records sanitized InitTxn usersession request shape")
      ),
      "summary self-test should fail when a client-session capture omits request-shape diagnostics"
    );

    const initTxnTargetMissingRoot = path.join(tempRoot, "managed-checkout-init-txn-target-missing");
    writeManagedCheckoutMicroTxnFixture(initTxnTargetMissingRoot, {
      initTxnTargetMissing: true,
      initTxnTargetMissingSession: "client-default",
      initTxnTargetMissingResult: "Failure",
      initTxnTargetMissingErrorCode: "3"
    });
    const initTxnTargetMissingSummary = summarizeWindowsOverlayMatrixArtifacts(initTxnTargetMissingRoot);
    const initTxnTargetMissingRow = initTxnTargetMissingSummary.caseSummaries[0];
    assert.equal(initTxnTargetMissingRow.initTxnTargetMissing, true);
    assert.equal(initTxnTargetMissingRow.initTxnTargetMissingSession, "client-default");
    assert.equal(initTxnTargetMissingRow.initTxnTargetMissingResult, "Failure");
    assert.equal(initTxnTargetMissingRow.initTxnTargetMissingErrorCode, "3");
    assert.equal(initTxnTargetMissingRow.initTxnTargetMissingUsersessionField, "omitted");
    assert.equal(initTxnTargetMissingRow.initTxnTargetMissingHasIpAddress, "false");
    assert.equal(
      initTxnTargetMissingRow.initTxnTargetMissingRequestShape,
      "usersession=omitted,ip=false,order=true,steam=true,language=true,currency=true,items=1,bundles=0,itemFields=true,bundleFields=true"
    );

    const targetMissingWithoutShapeRoot = path.join(tempRoot, "managed-checkout-target-missing-no-shape");
    writeManagedCheckoutMicroTxnFixture(targetMissingWithoutShapeRoot, {
      initTxnTargetMissing: true,
      omitInitTxnRequestShape: true
    });
    const targetMissingWithoutShapeSummary = summarizeWindowsOverlayMatrixArtifacts(targetMissingWithoutShapeRoot);
    assert(
      targetMissingWithoutShapeSummary.failures.some((failure) =>
        failure.includes("InitTxn target-missing diagnostic: records sanitized InitTxn usersession request shape")
      ),
      "summary self-test should fail when target-missing InitTxn diagnostics omit request-shape fields"
    );

    const lateMicroTxnRoot = path.join(tempRoot, "managed-checkout-late-microtxn");
    writeManagedCheckoutMicroTxnFixture(lateMicroTxnRoot, { lateMicroTxn: true });
    const lateMicroTxnSummary = summarizeWindowsOverlayMatrixArtifacts(lateMicroTxnRoot);
    assert(
      lateMicroTxnSummary.failures.some((failure) =>
        failure.includes("proved MicroTxnAuthorizationResponse callback")
      ),
      "summary self-test should fail when the MicroTxn callback arrives after checkout completion"
    );

    const closeProbeRoot = path.join(tempRoot, "managed-close-probe");
    writeManagedCaseFixture(closeProbeRoot, { closeProbe: true, closeProbeSent: true });
    const closeProbeSummary = summarizeWindowsOverlayMatrixArtifacts(closeProbeRoot);
    assert.deepEqual(closeProbeSummary.failures, []);
    assert.equal(closeProbeSummary.caseSummaries[0].closeProbeSent, true);
    assert.equal(closeProbeSummary.caseSummaries[0].closeProbeInput, "toggle");
    assert.equal(closeProbeSummary.caseSummaries[0].closeProbe.foregroundStayedOnSmoke, true);
    assert.deepEqual(closeProbeSummary.caseSummaries[0].closeProbe.foregroundProcessNames, ["SteamBridgeSmoke"]);
    assert.equal(closeProbeSummary.caseSummaries[0].closeProbe.screenshotCount, 1);
    assert.equal(closeProbeSummary.caseSummaries[0].closeProbe.screenshotVisuals.availableCount, 1);
    assert.equal(closeProbeSummary.caseSummaries[0].closeProbe.screenshotVisuals.visibleDetailCount, 1);

    const missingCloseProbeRoot = path.join(tempRoot, "managed-close-probe-missing");
    writeManagedCaseFixture(missingCloseProbeRoot, { closeProbe: true });
    const missingCloseProbeSummary = summarizeWindowsOverlayMatrixArtifacts(missingCloseProbeRoot);
    assert(
      missingCloseProbeSummary.failures.some((failure) =>
        failure.includes("sent Windows close probe input")
      ),
      "summary self-test should fail when a close-probe manifest has no probe:sent evidence"
    );

    const steamLaunchBlockedRoot = path.join(tempRoot, "steam-launch-blocked");
    writeSteamLaunchBlockedFixture(steamLaunchBlockedRoot);
    const steamLaunchBlockedSummary = summarizeWindowsOverlayMatrixArtifacts(steamLaunchBlockedRoot);
    assert.equal(steamLaunchBlockedSummary.steamLaunchBlockers.length, 1);
    assert.equal(steamLaunchBlockedSummary.steamLaunchBlockers[0].blockerCode, "windows-app-control-steam-launch-block");
    assert(
      steamLaunchBlockedSummary.failures.some((failure) => failure.includes("99-none: missing result.log")),
      "summary self-test should still fail when a Steam-launched case has no smoke result"
    );

    const caseAppControlBlockedRoot = path.join(tempRoot, "case-app-control-blocked");
    writeCaseAppControlBlockedFixture(caseAppControlBlockedRoot);
    const caseAppControlBlockedSummary = summarizeWindowsOverlayMatrixArtifacts(caseAppControlBlockedRoot);
    assert.deepEqual(caseAppControlBlockedSummary.failures, []);
    assert.equal(caseAppControlBlockedSummary.caseAppControlBlockers.length, 1);
    assert.equal(
      caseAppControlBlockedSummary.caseAppControlBlockers[0].blockerCode,
      "windows-app-control-native-dependency-block"
    );
    assert.equal(caseAppControlBlockedSummary.caseSummaries.length, 0);

    const assumedShortcutDriftRoot = path.join(tempRoot, "assumed-shortcut-drift");
    writeAssumedShortcutDriftFixture(assumedShortcutDriftRoot);
    const assumedShortcutDriftSummary = summarizeWindowsOverlayMatrixArtifacts(assumedShortcutDriftRoot);
    assert.equal(assumedShortcutDriftSummary.assumedShortcut.changed, true);
    assert.equal(assumedShortcutDriftSummary.assumedShortcut.existingExeExists, false);
    assert(
      assumedShortcutDriftSummary.failures.some((failure) =>
        failure.includes("assumed Steam shortcut invalid")
      ),
      "summary self-test should fail when an assumed shortcut points at stale launch fields"
    );

    const renderHealthBlockedRoot = path.join(tempRoot, "render-health-blocked");
    writeRenderHealthBlockedFixture(renderHealthBlockedRoot);
    const renderHealthBlockedSummary = summarizeWindowsOverlayMatrixArtifacts(renderHealthBlockedRoot);
    assert.equal(renderHealthBlockedSummary.renderHealth.status, "default-blank-baseline-visible");
    assert(
      renderHealthBlockedSummary.failures.some((failure) =>
        failure.includes("Windows default render health is not ready")
      ),
      "summary self-test should fail when default render health is not ready"
    );

    const steamLaunchBlockerWithResultRoot = path.join(tempRoot, "steam-launch-blocker-with-result");
    writeSteamLaunchBlockedFixture(steamLaunchBlockerWithResultRoot);
    writeResult(path.join(steamLaunchBlockerWithResultRoot, "99-none", "result.log"), {
      ok: false,
      action: { ok: false, action: "none" },
      snapshot: buildWindowsSnapshot({
        pid: 4444,
        events: []
      })
    });
    const steamLaunchBlockerWithResultSummary = summarizeWindowsOverlayMatrixArtifacts(steamLaunchBlockerWithResultRoot);
    assert(
      steamLaunchBlockerWithResultSummary.failures.some((failure) =>
        failure.includes("steam-launch-blocker.json is invalid when a smoke result payload exists")
      ),
      "summary self-test should fail when a Steam launch blocker is written beside a smoke result"
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

function writeCaseFixture(root, options = {}) {
  writeJson(path.join(root, "matrix-manifest.json"), {
    kind: "steam-bridge-windows-overlay-matrix-manifest",
    generatedAt: "2026-07-02T00:00:00.000Z",
    suite: options.suite || "baseline",
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

function writeCaseAppControlBlockedFixture(root) {
  writeJson(path.join(root, "matrix-manifest.json"), {
    kind: "steam-bridge-windows-overlay-matrix-manifest",
    generatedAt: "2026-07-02T00:00:00.000Z",
    suite: "managed",
    launchMode: "steam-launch",
    appId: 480,
    onlyCase: "10-presenter-ready",
    expectedCaseCount: 1,
    cases: [
      {
        id: "10-presenter-ready",
        action: "presenter-ready",
        requireEvent: ["overlay:presenter-ready"],
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
      verifiedAndReputableEnforced: true,
      verifiedAndReputablePolicyState: 1
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
  writeResult(path.join(root, "10-presenter-ready", "result.log"), {
    ok: false,
    action: {
      ok: false,
      action: "presenter-ready",
      error: {
        message:
          "Unable to load Steam Bridge native module. steam_bridge_native.win32-x64-msvc.node: An Application Control policy has blocked this file."
      }
    },
    snapshot: buildWindowsSnapshot({
      pid: 4244,
      events: [
        {
          type: "steam:init:error",
          payload: {
            message:
              "steam_bridge_native.win32-x64-msvc.node: An Application Control policy has blocked this file."
          }
        }
      ],
      steam: {
        initialized: false,
        initError: {
          message:
            "steam_bridge_native.win32-x64-msvc.node: An Application Control policy has blocked this file."
        }
      }
    })
  });
  writeJson(path.join(root, "10-presenter-ready", "case-app-control-blocker.json"), {
    kind: "steam-bridge-windows-case-app-control-blocker",
    generatedAt: "2026-07-02T00:00:01.000Z",
    caseStartedAt: "2026-07-02T00:00:00.000Z",
    blockerCode: "windows-app-control-native-dependency-block",
    caseId: "10-presenter-ready",
    action: "presenter-ready",
    resultPolicyBlock: true,
    codeIntegrityPolicyBlock: true,
    verifiedAndReputableBlock: true,
    originalError: "windows-electron-smoke.ps1 exited with code 1",
    paths: {
      resultFile: "10-presenter-ready/result.log",
      helperLog: "10-presenter-ready/helper.log",
      postCasePreflightLog: "10-presenter-ready/post-case-preflight.log",
      postCasePreflightJson: "10-presenter-ready/post-case-preflight.json"
    },
    appControl: {
      verifiedAndReputableEnforced: true,
      verifiedAndReputablePolicyState: 1
    },
    postCaseCodeIntegrityEvents: [
      {
        message:
          "Code Integrity determined that a process attempted to load steam_bridge_native.win32-x64-msvc.node that did not meet the Enterprise signing level requirements."
      }
    ],
    nextActions: ["Use a trusted and reputable publisher-signed package."]
  });
}

function writeAssumedShortcutDriftFixture(root) {
  writeJson(path.join(root, "matrix-manifest.json"), {
    kind: "steam-bridge-windows-overlay-matrix-manifest",
    generatedAt: "2026-07-02T00:00:00.000Z",
    suite: "shortcut",
    launchMode: "steam-launch",
    appId: 480,
    onlyCase: "",
    expectedCaseCount: 0,
    cases: []
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
  writeJson(path.join(root, "00-preflight", "assumed-shortcut.json"), {
    ok: false,
    generatedAt: "2026-07-02T00:00:01.000Z",
    shortcutName: "Steam Bridge Smoke",
    requestedShortcutGameId: "111",
    expectedShortcutGameId: "222",
    changed: true,
    action: "updated",
    existingMatches: false,
    result: {
      appName: "Steam Bridge Smoke",
      changed: true,
      action: "updated",
      gameId: "222",
      expected: {
        gameId: "222",
        exeExists: true
      },
      existing: {
        gameId: "111",
        exeExists: false
      },
      existingMatches: false
    }
  });
}

function writeRenderHealthBlockedFixture(root) {
  const nextAction =
    "The app renders when in-process GPU is disabled, but that mode is not overlay proof; continue with a safer graphics/presenter investigation.";
  writeJson(path.join(root, "matrix-manifest.json"), {
    kind: "steam-bridge-windows-overlay-matrix-manifest",
    generatedAt: "2026-07-02T00:00:00.000Z",
    suite: "preflight",
    launchMode: "steam-launch",
    appId: 480,
    onlyCase: "",
    expectedCaseCount: 0,
    cases: []
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
  writeJson(path.join(root, "00-preflight", "render-health-gate.json"), {
    kind: "steam-bridge-windows-render-health-gate",
    generatedAt: "2026-07-02T00:00:02.000Z",
    required: true,
    skipped: false,
    passed: false,
    status: "default-blank-baseline-visible",
    readyForSteamOverlayMatrix: false,
    nextAction,
    summaryPath: "00-preflight/render-health/render-health-summary.json",
    logPath: "00-preflight/render-health.log",
    error: "windows-render-health-probe.ps1 exited with code 1"
  });
  writeJson(path.join(root, "00-preflight", "render-health", "render-health-summary.json"), {
    kind: "steam-bridge-windows-render-health-probe",
    generatedAt: "2026-07-02T00:00:02.000Z",
    appDir: "C:\\Smoke",
    appId: 480,
    artifactRoot: "C:\\Artifacts\\render-health",
    overlayProfile: "diagnostic",
    windowMode: "windowed",
    resultDelayMs: 3000,
    postResultCrashWindowMs: 3000,
    recommendation: {
      status: "default-blank-baseline-visible",
      readyForSteamOverlayMatrix: false,
      defaultCaseHealthy: false,
      inProcessGpuOffVisible: true,
      disableDirectCompositionVisible: false,
      disableDirectCompositionFatal: false,
      nextAction
    },
    cases: [
      {
        name: "default",
        contentVisible: false,
        blankLike: true,
        fatalLifecycleEventCount: 0
      },
      {
        name: "in-process-gpu-on",
        contentVisible: false,
        blankLike: true,
        fatalLifecycleEventCount: 0
      },
      {
        name: "in-process-gpu-off",
        contentVisible: true,
        blankLike: false,
        fatalLifecycleEventCount: 0
      },
      {
        name: "in-process-gpu-on-disable-direct-composition",
        contentVisible: false,
        blankLike: true,
        fatalLifecycleEventCount: 0
      }
    ]
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
    ...(options.closeProbe ? { closeProbe: true, closeProbeInput: "toggle" } : {}),
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
  const events = [
    { type: "overlay:presenter-open-and-wait-start" },
    { type: "callback:overlay-activated", payload: { active: true } },
    { type: "overlay:presenter-wait-closed" },
    { type: "overlay:presenter-parked" },
    { type: "overlay:presenter-open-and-wait-complete" }
  ];
  if (!options.omitInactiveEvent) {
    events.splice(2, 0, { type: "callback:overlay-activated", payload: { active: false } });
  }
  const result = {
    ok: true,
    action: { ok: true, action: "presenter-web-open-and-wait" },
    snapshot: buildWindowsSnapshot({
      pid: 4245,
      managedOverlayResultMode: "complete",
      events
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
  if (options.closeProbeSent) {
    const foreground = {
      processName: "SteamBridgeSmoke",
      title: "Steam Bridge Electron Smoke",
      pid: 4245
    };
    writeRgbPng(path.join(root, "11-managed-web-open-and-wait", "close-probe-detected.png"), 4, 2, [
      [12, 18, 24],
      [220, 225, 230],
      [48, 120, 210],
      [180, 80, 40],
      [8, 8, 10],
      [96, 160, 96],
      [245, 245, 245],
      [24, 36, 48]
    ]);
    writeText(
      path.join(root, "11-managed-web-open-and-wait", "close-probe.log"),
      [
        {
          type: "probe:detected",
          at: "2026-07-02T00:00:03.000Z",
          payload: {
            foreground,
            screenshot: { ok: true, path: "close-probe-detected.png" }
          }
        },
        {
          type: "probe:sent",
          at: "2026-07-02T00:00:04.000Z",
          payload: { input: "toggle", foreground }
        }
      ].map((entry) => JSON.stringify(entry)).join("\n") + "\n"
    );
  }
}

function initTxnRequestShapeFixture(session = "client") {
  return {
    usersession: session === "client-default" ? "omitted" : session,
    hasUserSessionField: session !== "client-default",
    hasOrderId: true,
    hasSteamId64: true,
    hasLanguage: true,
    hasCurrency: true,
    hasIpAddress: false,
    itemCount: 1,
    bundleCount: 0,
    itemsHaveRequiredFields: true,
    bundlesHaveRequiredFields: true
  };
}

function initTxnRequestShapePreflightFixture({ session = "client", overrides = {} } = {}) {
  return {
    kind: "steam-bridge-windows-init-txn-request-shape",
    generatedAt: "2026-07-03T00:00:00.000Z",
    source: "init-txn-request-file",
    hasRequestFile: true,
    requestFileExists: true,
    requestAppIdPresent: true,
    requestAppIdMatches: true,
    matrixAppIdForced: true,
    session,
    ...initTxnRequestShapeFixture(session),
    ...overrides
  };
}

function writeInitTxnRequestShapePreflightFixture(root, options = {}) {
  writeJson(
    path.join(root, "00-preflight", "init-txn-request-shape.json"),
    initTxnRequestShapePreflightFixture(options)
  );
}

function initTxnRequestShapeEventFixture(session = "client", options = {}) {
  const payload = {
    endpoint: "sandbox",
    session
  };
  if (!options.omitShape) {
    payload.requestShape = initTxnRequestShapeFixture(session);
  }
  return {
    type: "checkout:init-txn-request-shape",
    payload
  };
}

function microTxnListenerRegisteredEventFixtures(options = {}) {
  const events = [];
  if (!options.omitMicroTxnListener) {
    events.push({
      type: "callback:microtxn-listener-registered",
      payload: {
        callback: "MicroTxnAuthorizationResponse",
        registered: true
      }
    });
  }
  if (!options.omitLegacyMicroTxnListener) {
    events.push({
      type: "callback:microtxn-listener-registered",
      payload: {
        callback: "LegacyMicroTxnAuthorizationResponse",
        registered: true
      }
    });
  }
  return events;
}

function pushMicroTxnListenerRegisteredEvents(events, options = {}) {
  for (const event of microTxnListenerRegisteredEventFixtures(options)) {
    events.push(event);
  }
}

function microTxnCallbackEventFixture(options = {}) {
  return {
    type: "callback:microtxn",
    payload: {
      appId: 480,
      orderId: { redacted: true, present: true, type: "bigint" },
      authorized: true,
      ...(!options.omitMicroTxnCallbackSource ? { callbackSource: options.callbackSource || "steamworks" } : {}),
      presenter: {
        mode: "active",
        nativeHostOpen: true,
        currentFps: 30
      }
    }
  };
}

function writeManagedCheckoutMicroTxnFixture(root, options = {}) {
  const checkoutCaseId = options.caseId || "02-checkout-approval";
  const usesInitTxnRequestFile = Boolean(
    options.useInitTxnRequestFile ||
      options.webSessionCaptured ||
      options.clientPromptMissing ||
      options.initTxnTargetMissing
  );
  const initTxnRequestSession =
    options.webSessionCapturedSession ||
    options.clientPromptMissingSession ||
    options.initTxnTargetMissingSession ||
    (options.webSessionCaptured ? "web" : "client");
  const requireMicroTxnCallback =
    options.requireMicroTxnCallback !== undefined
      ? options.requireMicroTxnCallback === true
      : options.webSessionCaptured
        ? false
        : true;
  writeJson(path.join(root, "matrix-manifest.json"), {
    kind: "steam-bridge-windows-overlay-matrix-manifest",
    generatedAt: "2026-07-03T00:00:00.000Z",
    suite: options.suite || "checkout",
    launchMode: options.launchMode || (usesInitTxnRequestFile ? "steam-app" : "steam-launch"),
    appId: 480,
    onlyCase: checkoutCaseId,
    expectedCaseCount: 1,
    requireMicroTxnCallback,
    initTxnCapture: {
      hasRequestFile: usesInitTxnRequestFile,
      captureInApp: usesInitTxnRequestFile,
      apiKeyEnvProvided: usesInitTxnRequestFile,
      endpointOption: usesInitTxnRequestFile ? "sandbox" : ""
    },
    targetHints: {
      hasCheckoutTransactionId: false,
      hasCheckoutJsonFile: !usesInitTxnRequestFile,
      hasInitTxnRequestFile: usesInitTxnRequestFile
    },
    cases: [
      {
        id: checkoutCaseId,
        action: "presenter-checkout",
        requireEvent: [
          "overlay:presenter-open",
          "overlay:presenter-wait-closed",
          "overlay:presenter-parked",
          "overlay:presenter-checkout-open-and-wait-complete"
        ],
        requireOverlayActivated: true,
        requireNoOverlayActivation: false,
        allowOverlayNotReady: false,
        requirePassiveNotification: false,
        requireManagedOverlayComplete: true,
        requireMicroTxnCallback,
        managedOverlayResultMode: "complete",
        hasCheckoutTransactionId: false,
        hasCheckoutJsonFile: !usesInitTxnRequestFile,
        hasInitTxnRequestFile: usesInitTxnRequestFile
      }
    ]
  });
  writeJson(path.join(root, "00-preflight", "preflight.json"), {
    kind: "steam-bridge-windows-preflight",
    generatedAt: "2026-07-03T00:00:00.000Z",
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
  if (usesInitTxnRequestFile && !options.omitInitTxnRequestShapePreflight) {
    writeInitTxnRequestShapePreflightFixture(root, { session: initTxnRequestSession });
  }

  const microTxnEvent = microTxnCallbackEventFixture(options);
  if (options.initTxnTargetMissing) {
    const requestShape = options.omitInitTxnRequestShape
      ? undefined
      : initTxnRequestShapeFixture(options.initTxnTargetMissingSession || "client");
    const events = [];
    pushMicroTxnListenerRegisteredEvents(events, options);
    if (!options.omitInitTxnRequestShapeEvent) {
      events.push(
        initTxnRequestShapeEventFixture(options.initTxnTargetMissingSession || "client", {
          omitShape: options.omitInitTxnRequestShape
        })
      );
    }
    events.push(
      {
        type: "checkout:init-txn-target-missing",
        payload: {
          endpoint: "sandbox",
          session: options.initTxnTargetMissingSession || "client",
          httpStatus: 200,
          usedCurrentSteamId: true,
          ...(requestShape ? { requestShape } : {}),
          failure: {
            result: options.initTxnTargetMissingResult || "Failure",
            errorCode: options.initTxnTargetMissingErrorCode || "3",
            hasErrorDescription: false
          }
        }
      }
    );
    writeResult(path.join(root, checkoutCaseId, "result.log"), {
      ok: false,
      action: {
        ok: false,
        action: "presenter-checkout",
        error: {
          name: "Error",
          message: "Steam InitTxn response did not include a checkout target."
        }
      },
      wait: {
        ok: true,
        action: "presenter-checkout"
      },
      snapshot: buildWindowsSnapshot({
        pid: 4248,
        managedOverlayResultMode: "complete",
        events
      })
    });
    return;
  }
  if (options.clientPromptMissing) {
    const targetSnapshot = { type: "checkout", hasTransactionId: true, clientSession: true };
    const requestShape = options.omitInitTxnRequestShape
      ? undefined
      : initTxnRequestShapeFixture(options.clientPromptMissingSession || "client");
    const initTxn = {
      endpoint: "sandbox",
      session: options.clientPromptMissingSession || "client",
      httpStatus: 200,
      usedCurrentSteamId: true,
      ...(requestShape ? { requestShape } : {})
    };
    const error = {
      name: "SteamOverlayWaitTimeoutError",
      code: "STEAM_OVERLAY_WAIT_TIMEOUT",
      message: "Timed out waiting for Steam overlay to become active."
    };
    const events = [];
    pushMicroTxnListenerRegisteredEvents(events, options);
    if (!options.omitInitTxnRequestShapeEvent) {
      events.push(
        initTxnRequestShapeEventFixture(options.clientPromptMissingSession || "client", {
          omitShape: options.omitInitTxnRequestShape
        })
      );
    }
    events.push({
      type: "checkout:init-txn-captured",
      payload: { ...initTxn, targetSnapshot }
    });
    if (!options.omitClientSessionWaitStart) {
      events.push({
        type: "checkout:client-session-wait-start",
        payload: {
          target: "checkout",
          targetSnapshot,
          expectedSteamPrompt: true,
          initTxn,
          presenter: {
            mode: "active",
            nativeHostOpen: true,
            clickThrough: false,
            transparent: false
          }
        }
      });
    }
    events.push(
      {
        type: "overlay:presenter-open",
        payload: { target: "checkout", api: "openCheckoutAndWait", checkoutSource: "init-txn-request-file", targetSnapshot, initTxn }
      },
      { type: "overlay:presenter-wait-start", payload: { target: "checkout" } },
      { type: "overlay:presenter-wait-shown:error", payload: { target: "checkout", error } },
      {
        type: "checkout:client-session-prompt-missing",
        payload: { target: "checkout", targetSnapshot, expectedSteamPrompt: true, error, initTxn }
      },
      {
        type: "overlay:presenter-checkout-open-and-wait:error",
        payload: { target: "checkout", targetSnapshot, error, initTxn }
      }
    );
    writeResult(path.join(root, checkoutCaseId, "result.log"), {
      ok: false,
      action: { ok: true, action: "presenter-checkout" },
      wait: {
        ok: false,
        overlayShown: false,
        overlayComplete: false,
        error
      },
      snapshot: buildWindowsSnapshot({
        pid: 4248,
        managedOverlayResultMode: "complete",
        events
      })
    });
    return;
  }
  if (options.webSessionCaptured) {
    const targetSnapshot = {
      type: "checkout",
      hasSteamUrl: options.webSessionHasSteamUrl !== false,
      hasTransactionId: true,
      hasReturnUrl: options.webSessionHasReturnUrl !== false
    };
    const requestShape = options.omitInitTxnRequestShape
      ? undefined
      : initTxnRequestShapeFixture(options.webSessionCapturedSession || "web");
    const initTxn = {
      endpoint: "sandbox",
      session: options.webSessionCapturedSession || "web",
      httpStatus: 200,
      usedCurrentSteamId: true,
      ...(requestShape ? { requestShape } : {})
    };
    const events = [];
    pushMicroTxnListenerRegisteredEvents(events, options);
    if (!options.omitInitTxnRequestShapeEvent) {
      events.push(
        initTxnRequestShapeEventFixture(options.webSessionCapturedSession || "web", {
          omitShape: options.omitInitTxnRequestShape
        })
      );
    }
    events.push(
      {
        type: "checkout:init-txn-captured",
        payload: { ...initTxn, targetSnapshot }
      },
      {
        type: "overlay:presenter-open",
        payload: { target: "checkout", api: "openCheckoutAndWait", checkoutSource: "init-txn-request-file", targetSnapshot, initTxn }
      },
      { type: "callback:overlay-activated", payload: { active: true } },
      { type: "callback:overlay-activated", payload: { active: false } },
      { type: "overlay:presenter-wait-closed" },
      { type: "overlay:presenter-parked" },
      { type: "overlay:presenter-checkout-open-and-wait-complete" }
    );
    writeResult(path.join(root, checkoutCaseId, "result.log"), {
      ok: true,
      action: { ok: true, action: "presenter-checkout" },
      wait: {
        overlayClosed: true,
        overlayParked: true,
        overlayComplete: true
      },
      snapshot: buildWindowsSnapshot({
        pid: 4248,
        managedOverlayResultMode: "complete",
        events
      })
    });
    return;
  }
  const events = [];
  pushMicroTxnListenerRegisteredEvents(events, options);
  events.push(
    {
      type: "overlay:presenter-open",
      payload: { target: "checkout", api: "openCheckoutAndWait", checkoutSource: "json-file" }
    },
    { type: "callback:overlay-activated", payload: { active: true } }
  );
  if (!options.omitMicroTxn && !options.lateMicroTxn) {
    events.push(microTxnEvent);
  }
  events.push(
    { type: "callback:overlay-activated", payload: { active: false } },
    { type: "overlay:presenter-wait-closed" },
    { type: "overlay:presenter-parked" },
    { type: "overlay:presenter-checkout-open-and-wait-complete" }
  );
  if (!options.omitMicroTxn && options.lateMicroTxn) {
    events.push(microTxnEvent);
  }

  writeResult(path.join(root, checkoutCaseId, "result.log"), {
    ok: true,
    action: { ok: true, action: "presenter-checkout" },
    wait: {
      overlayClosed: true,
      overlayParked: true,
      overlayComplete: true
    },
    snapshot: buildWindowsSnapshot({
      pid: 4248,
      managedOverlayResultMode: "complete",
      events
    })
  });
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

function writeRgbPng(file, width, height, pixels) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const raw = Buffer.alloc((1 + width * 3) * height);
  let rawOffset = 0;
  let pixelOffset = 0;
  for (let y = 0; y < height; y += 1) {
    raw[rawOffset++] = 0;
    for (let x = 0; x < width; x += 1) {
      const pixel = pixels[pixelOffset++] || [0, 0, 0];
      raw[rawOffset++] = pixel[0] & 0xff;
      raw[rawOffset++] = pixel[1] & 0xff;
      raw[rawOffset++] = pixel[2] & 0xff;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;
  fs.writeFileSync(
    file,
    Buffer.concat([
      Buffer.from("89504e470d0a1a0a", "hex"),
      pngChunk("IHDR", ihdr),
      pngChunk("IDAT", zlib.deflateSync(raw)),
      pngChunk("IEND", Buffer.alloc(0))
    ])
  );
}

function pngChunk(type, data) {
  const typeBuffer = Buffer.from(type, "ascii");
  const chunk = Buffer.alloc(12 + data.length);
  chunk.writeUInt32BE(data.length, 0);
  typeBuffer.copy(chunk, 4);
  data.copy(chunk, 8);
  chunk.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])), 8 + data.length);
  return chunk;
}

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let index = 0; index < 8; index += 1) {
      crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function writeText(file, text) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, text);
}
