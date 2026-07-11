#!/usr/bin/env node

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const zlib = require("node:zlib");
const checkoutProofPath = fs.existsSync(path.join(__dirname, "checkout-proof.cjs"))
  ? path.join(__dirname, "checkout-proof.cjs")
  : path.join(__dirname, "..", "examples", "electron-basic", "checkout-proof.cjs");
const {
  CLIENT_SESSION_QUERY_SCHEMA,
  isClientSessionQueryClosedDiagnostic,
  normalizeHttpStatus,
  normalizeMicroTxnErrorCode,
  normalizeMicroTxnResult,
  normalizeMicroTxnStatus,
  normalizeQueryEndpoint,
  normalizeQueryId,
  normalizeQueryReason,
  normalizeRequestError
} = require(checkoutProofPath);

const RESULT_PREFIX = "STEAM_BRIDGE_SMOKE_RESULT ";
const KNOWN_NATIVE_LOAD_BLOCKERS = new Set([
  "windows-app-control-native-load-block",
  "windows-native-load-gate-failure"
]);
const DUPLICATE_OPEN_NAMED_TARGET_NAMES = [
  "web",
  "store",
  "friends",
  "profile",
  "players",
  "community",
  "stats",
  "achievements",
  "user",
  "dialog",
  "checkout"
];
const DUPLICATE_OPEN_NAMED_STATUS_NAMES = [...DUPLICATE_OPEN_NAMED_TARGET_NAMES, "checkoutOperation"];
const SUPPORTED_CLOSE_PROBE_INPUTS = new Set([
  "toggle",
  "escape",
  "close-tab",
  "toggle-sendinput",
  "escape-sendinput",
  "close-tab-sendinput",
  "web-close-click-sendinput"
]);
const SUPPORTED_CLOSE_PROBE_EVIDENCE_SCHEMAS = new Set([1, 2, 3]);
const OWNER_PROCESS_FOREGROUND_HANDOFF = "owner-process-native-show-v1";
const SAME_PROCESS_USER_GESTURE_HANDOFF = "same-process-user-gesture-v1";
const EXTERNAL_FOREGROUND_TRANSITION = "external-foreground-event-v1";
const USER_GESTURE_GATE_EXPECTATIONS = Object.freeze({
  "11-managed-web-open-and-wait": Object.freeze({
    action: "presenter-web-open-and-wait",
    targetId: "presenter-web-wait",
    evidenceSchemas: Object.freeze([2, 3])
  }),
  "11b-managed-duplicate-open-guard": Object.freeze({
    action: "presenter-duplicate-open-guard",
    targetId: "presenter-duplicate-guard",
    evidenceSchemas: Object.freeze([3])
  })
});
const WINDOWS_CLOSE_SCALE_TOLERANCE = 0.02;
const PERSISTENT_REUSE_ACTION = "presenter-persistent-reuse-three-cycle";
const WINDOWS_PERSISTENT_REUSE_CYCLES = 3;
const WINDOWS_LIGHTWEIGHT_POLL_INTERVAL_MS = 30;
const WINDOWS_FULL_DIAGNOSTICS_MIN_INTERVAL_MS = 250;
const FATAL_LIFECYCLE_EVENT_TYPES = new Set([
  "app:render-process-gone",
  "app:child-process-gone",
  "app:gpu-process-crashed",
  "process:uncaught-exception",
  "process:unhandled-rejection"
]);

function getUserGestureGateExpectation(caseId) {
  if (
    typeof caseId !== "string" ||
    !Object.prototype.hasOwnProperty.call(USER_GESTURE_GATE_EXPECTATIONS, caseId)
  ) {
    return null;
  }
  return USER_GESTURE_GATE_EXPECTATIONS[caseId];
}

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

  const processCleanupBefore = readJsonIfPresent(
    path.join(root, "smoke-process-cleanup-before-run.json"),
    failures
  );
  const processCleanupAfter = readJsonIfPresent(
    path.join(root, "smoke-process-cleanup-after-cases.json"),
    failures
  );
  const launchEnvRollback = readJsonIfPresent(path.join(root, "launch-env-rollback.json"), failures);
  const taskCleanup = readJsonIfPresent(path.join(root, "task-cleanup.json"), failures);
  validateCleanupArtifacts(
    manifest,
    processCleanupBefore,
    processCleanupAfter,
    launchEnvRollback,
    taskCleanup,
    failures
  );

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
    cleanup: summarizeCleanupArtifacts(
      processCleanupBefore,
      processCleanupAfter,
      launchEnvRollback,
      taskCleanup
    ),
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
  for (const field of ["shortcutName", "shortcutExe", "shortcutStartDir", "shortcutLaunchPrefix", "javaScriptRunnerExe"]) {
    expect(manifest[field] === undefined, `matrix manifest omits raw ${field}`, failures);
  }
  for (const field of [
    "shortcutNamePresent",
    "shortcutExeConfigured",
    "shortcutStartDirConfigured",
    "shortcutLaunchPrefixConfigured",
    "javaScriptRunnerExeConfigured"
  ]) {
    if (Object.prototype.hasOwnProperty.call(manifest, field)) {
      expect(typeof manifest[field] === "boolean", `matrix manifest ${field} is boolean`, failures);
    }
  }
  expect(
    [
      "baseline",
      "managed",
      "managed-routes",
      "shortcut-routes",
      "checkout",
      "persistent-reuse",
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
  if (manifest.cleanupContract !== undefined) {
    const cleanupContract = objectOrEmpty(manifest.cleanupContract);
    for (const field of [
      "processCleanupRequired",
      "launchEnvRollbackRequired",
      "taskCleanupExpected"
    ]) {
      expect(
        typeof cleanupContract[field] === "boolean",
        `matrix manifest cleanupContract.${field} is boolean`,
        failures
      );
    }
  }
  if (manifest.closeProbeEvidenceSchema !== undefined) {
    expect(
      SUPPORTED_CLOSE_PROBE_EVIDENCE_SCHEMAS.has(manifest.closeProbeEvidenceSchema),
      "matrix manifest closeProbeEvidenceSchema uses supported version 1, 2, or 3",
      failures
    );
    if (manifest.closeProbeEvidenceSchema === 2) {
      expect(
        manifest.closeProbeForegroundHandoff === OWNER_PROCESS_FOREGROUND_HANDOFF,
        `matrix manifest closeProbeForegroundHandoff is ${OWNER_PROCESS_FOREGROUND_HANDOFF}`,
        failures
      );
      if (manifest.supportedCloseProbeForegroundHandoffs !== undefined) {
        expect(
          Array.isArray(manifest.supportedCloseProbeForegroundHandoffs) &&
            manifest.supportedCloseProbeForegroundHandoffs.length === 2 &&
            manifest.supportedCloseProbeForegroundHandoffs.includes(OWNER_PROCESS_FOREGROUND_HANDOFF) &&
            manifest.supportedCloseProbeForegroundHandoffs.includes(SAME_PROCESS_USER_GESTURE_HANDOFF),
          "matrix manifest records both bounded foreground handoff mechanisms",
          failures
        );
      }
    }
  }
  if (manifest.supportedCloseProbeEvidenceSchemas !== undefined) {
    expect(
      Array.isArray(manifest.supportedCloseProbeEvidenceSchemas) &&
        manifest.supportedCloseProbeEvidenceSchemas.length === 2 &&
        manifest.supportedCloseProbeEvidenceSchemas.includes(2) &&
        manifest.supportedCloseProbeEvidenceSchemas.includes(3),
      "matrix manifest records close-probe evidence schemas 2 and 3",
      failures
    );
  }
  if (manifest.supportedExternalForegroundTransitions !== undefined) {
    expect(
      Array.isArray(manifest.supportedExternalForegroundTransitions) &&
        manifest.supportedExternalForegroundTransitions.length === 1 &&
        manifest.supportedExternalForegroundTransitions[0] === EXTERNAL_FOREGROUND_TRANSITION,
      `matrix manifest records external foreground transition ${EXTERNAL_FOREGROUND_TRANSITION}`,
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
        if (SUPPORTED_CLOSE_PROBE_EVIDENCE_SCHEMAS.has(manifest.closeProbeEvidenceSchema)) {
          expect(
            SUPPORTED_CLOSE_PROBE_INPUTS.has(entry.expectedCloseProbeInput),
            `matrix manifest case ${entry.id} records a supported resolved close input`,
            failures
          );
        }
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
        if (Object.prototype.hasOwnProperty.call(entry, "persistentReuseCycles")) {
          expect(
            Number.isInteger(entry.persistentReuseCycles) && entry.persistentReuseCycles >= 0,
            `matrix manifest case ${entry.id} records a nonnegative persistent reuse cycle count`,
            failures
          );
          if (entry.action === PERSISTENT_REUSE_ACTION) {
            expect(
              entry.persistentReuseCycles === WINDOWS_PERSISTENT_REUSE_CYCLES,
              `matrix manifest case ${entry.id} records exactly ${WINDOWS_PERSISTENT_REUSE_CYCLES} persistent reuse cycles`,
              failures
            );
          }
        }
        if (Object.prototype.hasOwnProperty.call(entry, "autorunUserGestureGate")) {
          expect(
            typeof entry.autorunUserGestureGate === "boolean",
            `matrix manifest case ${entry.id} records whether the autorun user-gesture gate is required`,
            failures
          );
          const expectedHandoff = entry.autorunUserGestureGate
            ? SAME_PROCESS_USER_GESTURE_HANDOFF
            : OWNER_PROCESS_FOREGROUND_HANDOFF;
          expect(
            entry.closeProbeForegroundHandoff === expectedHandoff,
            `matrix manifest case ${entry.id} records foreground handoff ${expectedHandoff}`,
            failures
          );
          if (entry.autorunUserGestureGate) {
            const recordedCaseEvidenceSchema = Object.prototype.hasOwnProperty.call(
              entry,
              "closeProbeEvidenceSchema"
            )
              ? entry.closeProbeEvidenceSchema
              : manifest.closeProbeEvidenceSchema;
            expect(
              Number.isInteger(recordedCaseEvidenceSchema),
              `matrix manifest case ${entry.id} records an integer close-probe evidence schema`,
              failures
            );
            const caseEvidenceSchema = Number.isInteger(recordedCaseEvidenceSchema)
              ? recordedCaseEvidenceSchema
              : 0;
            expect(
              caseEvidenceSchema === 2 || caseEvidenceSchema === 3,
              `matrix manifest case ${entry.id} uses close-probe evidence schema 2 or 3`,
              failures
            );
            if (caseEvidenceSchema === 3) {
              expect(
                entry.externalForegroundTransition === EXTERNAL_FOREGROUND_TRANSITION,
                `matrix manifest case ${entry.id} records external foreground transition ${EXTERNAL_FOREGROUND_TRANSITION}`,
                failures
              );
            } else {
              expect(
                !entry.externalForegroundTransition,
                `matrix manifest case ${entry.id} omits the schema-3 external foreground transition`,
                failures
              );
            }
            const userGestureExpectation = getUserGestureGateExpectation(entry.id);
            expect(
              Boolean(
                userGestureExpectation &&
                  entry.action === userGestureExpectation.action &&
                  userGestureExpectation.evidenceSchemas.includes(caseEvidenceSchema)
              ),
              `matrix manifest case ${entry.id} uses its exact supported user-gesture action and evidence schema`,
              failures
            );
            expect(
              Array.isArray(manifest.supportedCloseProbeForegroundHandoffs) &&
                manifest.supportedCloseProbeForegroundHandoffs.length === 2 &&
                manifest.supportedCloseProbeForegroundHandoffs.includes(
                  OWNER_PROCESS_FOREGROUND_HANDOFF
                ) &&
                manifest.supportedCloseProbeForegroundHandoffs.includes(
                  SAME_PROCESS_USER_GESTURE_HANDOFF
                ) &&
                (caseEvidenceSchema === 2 ||
                  (Array.isArray(manifest.supportedCloseProbeEvidenceSchemas) &&
                    manifest.supportedCloseProbeEvidenceSchemas.includes(3) &&
                    Array.isArray(manifest.supportedExternalForegroundTransitions) &&
                    manifest.supportedExternalForegroundTransitions.includes(
                      EXTERNAL_FOREGROUND_TRANSITION
                    ))),
              `matrix manifest case ${entry.id} records the bounded foreground-handoff union`,
              failures
            );
          } else if (Object.prototype.hasOwnProperty.call(entry, "closeProbeEvidenceSchema")) {
            expect(
              entry.closeProbeEvidenceSchema === manifest.closeProbeEvidenceSchema,
              `matrix manifest case ${entry.id} uses the default close-probe evidence schema`,
              failures
            );
            expect(
              entry.externalForegroundTransition === "",
              `matrix manifest case ${entry.id} does not request an external foreground transition`,
              failures
            );
          }
        }
      }
    }
  }
}

function validateCleanupArtifacts(
  manifest,
  processCleanupBefore,
  processCleanupAfter,
  launchEnvRollback,
  taskCleanup,
  failures
) {
  const cleanupContract = objectOrEmpty(manifest && manifest.cleanupContract);
  const processRequired = cleanupContract.processCleanupRequired === true;
  const rollbackRequired = cleanupContract.launchEnvRollbackRequired === true;
  const taskRequired = cleanupContract.taskCleanupExpected === true;

  if (processRequired) {
    expect(Boolean(processCleanupBefore), "live matrix includes before-run package-process cleanup evidence", failures);
    expect(Boolean(processCleanupAfter), "live matrix includes after-cases package-process cleanup evidence", failures);
  }
  if (rollbackRequired) {
    expect(Boolean(launchEnvRollback), "live matrix includes launch-env rollback evidence", failures);
  }
  if (taskRequired) {
    expect(Boolean(taskCleanup), "task-wrapped matrix includes task cleanup evidence", failures);
  }

  validateProcessCleanupArtifact(processCleanupBefore, "before-run", failures);
  validateProcessCleanupArtifact(processCleanupAfter, "after-cases", failures);
  if (launchEnvRollback) {
    expect(
      launchEnvRollback.kind === "steam-bridge-windows-launch-env-rollback",
      "launch-env rollback artifact kind is valid",
      failures
    );
    expect(launchEnvRollback.ok === true, "launch-env rollback completed successfully", failures);
    if (rollbackRequired) {
      expect(launchEnvRollback.attempted === true, "required launch-env rollback transaction was attempted", failures);
    }
    if (launchEnvRollback.attempted === true) {
      expect(launchEnvRollback.generatedRemoved === true, "generated launch env was removed", failures);
      expect(launchEnvRollback.originalRestored === true, "prior launch env state was restored", failures);
      expect(launchEnvRollback.restoredBytesMatch === true, "restored launch env bytes match exactly", failures);
      expect(launchEnvRollback.backupRemoved === true, "launch-env rollback backup was removed", failures);
      if (launchEnvRollback.originalPresent === true) {
        expect(launchEnvRollback.backupCreated === true, "existing launch env was moved to a rollback backup", failures);
      }
    }
  }
  if (taskCleanup) {
    expect(
      taskCleanup.kind === "steam-bridge-windows-overlay-task-cleanup",
      "task cleanup artifact kind is valid",
      failures
    );
    expect(taskCleanup.ok === true, "interactive task cleanup completed successfully", failures);
    const taskFailureContracts = new Map([
      ["success", "none"],
      ["private-env-import", "private-env-error"],
      ["matrix-argument-binding", "matrix-argument-error"],
      ["matrix-invocation", "matrix-invocation-error"],
      ["matrix-exit", "matrix-nonzero-exit"],
      ["runner-termination", "done-missing"],
      ["runner-timeout", "deadline-exceeded"],
      ["wrapper-setup", "wrapper-error"]
    ]);
    expect(
      taskFailureContracts.has(taskCleanup.failureStage),
      "interactive task records a closed-set failure stage",
      failures
    );
    expect(
      taskFailureContracts.get(taskCleanup.failureStage) === taskCleanup.errorKind,
      "interactive task failure stage and error kind agree",
      failures
    );
    expect(
      taskCleanup.errorPresent === (taskCleanup.failureStage !== "success"),
      "interactive task error presence matches its failure stage",
      failures
    );
    expect(
      typeof taskCleanup.runnerTerminatedWithoutDone === "boolean",
      "interactive task records whether the runner ended without done status",
      failures
    );
    if (taskCleanup.runnerTerminatedWithoutDone === true) {
      expect(
        taskCleanup.timedOut === false &&
          taskCleanup.failureStage === "runner-termination" &&
          taskCleanup.errorKind === "done-missing",
        "runner termination without done status is distinct from deadline timeout",
        failures
      );
    }
    expect(
      taskCleanup.failureStage === "success" && taskCleanup.errorPresent === false,
      "interactive task completed without a runner or matrix failure",
      failures
    );
    expect(
      taskCleanup.cleanupPhaseErrorCount === 0,
      "interactive task cleanup phases completed without a suppressed exception",
      failures
    );
    if (taskCleanup.keepTask !== true) {
      expect(taskCleanup.deleteAttempted === true, "interactive task deletion was attempted", failures);
      expect(
        taskCleanup.deleteExitCodeCaptured === true,
        "interactive task deletion exit code was captured",
        failures
      );
      expect(taskCleanup.deleteExitCode === 0, "interactive task deletion command succeeded", failures);
      expect(
        taskCleanup.queryExitCodeCaptured === true && taskCleanup.queryExitCode === 1,
        "interactive task absence query completed with the expected missing-task exit code",
        failures
      );
      expect(taskCleanup.deletionVerified === true, "interactive task deletion was independently verified", failures);
    }
    if (taskCleanup.timedOut === true) {
      expect(
        taskCleanup.runnerTerminatedWithoutDone === false &&
          taskCleanup.failureStage === "runner-timeout" &&
          taskCleanup.errorKind === "deadline-exceeded",
        "live runner deadline timeout has its distinct sanitized status",
        failures
      );
      expect(taskCleanup.endAttempted === true, "timed-out interactive task was explicitly ended", failures);
      expect(
        taskCleanup.endExitCode === 0 || objectOrEmpty(taskCleanup.runnerProcessGuard).verifiedEmpty === true,
        "timed-out interactive task was terminated by /End or captured-tree fallback",
        failures
      );
      expect(
        objectOrEmpty(taskCleanup.runnerProcessGuard).treeTerminationRequired === true &&
          objectOrEmpty(taskCleanup.runnerProcessGuard).rootStopAttemptCount >= 1,
        "timed-out interactive task attempted exact verified runner-root termination before rollback",
        failures
      );
    }
    validateTaskRunnerProcessGuard(taskCleanup.runnerProcessGuard, taskRequired, failures);
    validateTaskLaunchEnvGuard(
      taskCleanup.launchEnvGuard,
      taskRequired && rollbackRequired,
      failures
    );
    validateTaskPackageProcessGuard(taskCleanup.packageProcessGuard, taskRequired, failures);
    validateTaskFileGuard(taskCleanup.taskFileGuard, taskRequired, failures);
  }
}

function validateTaskRunnerProcessGuard(value, required, failures) {
  const guard = objectOrEmpty(value);
  if (required) {
    expect(guard.required === true, "task wrapper runner-tree guard is required", failures);
  }
  if (!value) {
    expect(!required, "task cleanup includes runner-tree guard evidence", failures);
    return;
  }
  expect(guard.ok === true, "task wrapper runner-tree guard completed successfully", failures);
  if (guard.required === true) {
    expect(guard.attempted === true, "task wrapper checked the captured scheduled runner tree", failures);
    expect(guard.captureAttempted === true, "task wrapper attempted immediate runner capture", failures);
    expect(guard.captureSucceeded === true, "task wrapper captured the exact scheduled runner", failures);
    expect(guard.capturedRootCount >= 1, "task wrapper captured at least one exact runner root", failures);
    expect(guard.capturedTreeProcessCount >= 1, "task wrapper tracked at least one runner-tree process", failures);
    expect(guard.enumerationSucceeded === true, "task wrapper enumerated the captured runner tree", failures);
    for (const field of [
      "captureWaitMilliseconds",
      "capturedRootCount",
      "capturedTreeProcessCount",
      "trackingAttemptCount",
      "trackingFailureCount",
      "ancestryRejectionCount",
      "processesBeforeCount",
      "processesAfterCount",
      "emptyVerificationScanCount"
    ]) {
      expect(
        Number.isInteger(guard[field]) && guard[field] >= 0,
        `task wrapper runner-tree guard records nonnegative ${field}`,
        failures
      );
    }
    validateExactProcessStopCounters(guard, "rootStop", "runner root", failures);
    validateExactProcessStopCounters(guard, "fallbackStop", "runner-tree fallback", failures);
    expect(typeof guard.treeTerminationRequired === "boolean", "task wrapper records whether tree termination was required", failures);
    expect(guard.processesAfterCount === 0, "task wrapper left no captured runner-tree process", failures);
    expect(
      guard.emptyVerificationScanCount >= 2,
      "task wrapper observed two empty runner-tree scans",
      failures
    );
    expect(guard.verifiedEmpty === true, "task wrapper independently verified the captured runner tree is gone", failures);
  }
}

function validateTaskFileGuard(value, required, failures) {
  const guard = objectOrEmpty(value);
  if (required) {
    expect(guard.required === true, "task wrapper handoff-file cleanup is required", failures);
  }
  if (!value) {
    expect(!required, "task cleanup includes handoff-file cleanup evidence", failures);
    return;
  }
  expect(guard.ok === true, "task wrapper handoff-file cleanup completed successfully", failures);
  if (guard.required === true) {
    expect(guard.attempted === true, "task wrapper removed its private handoff directory", failures);
    expect(
      Number.isInteger(guard.entryCountBefore) && guard.entryCountBefore >= 0,
      "task wrapper records a nonnegative handoff entry count",
      failures
    );
    expect(guard.directoryRemoved === true, "task wrapper removed the handoff directory", failures);
    expect(guard.verifiedAbsent === true, "task wrapper independently verified handoff files are absent", failures);
  }
}

function validateTaskLaunchEnvGuard(value, required, failures) {
  const guard = objectOrEmpty(value);
  if (required) {
    expect(guard.required === true, "task wrapper launch-env guard is required", failures);
  }
  if (!value) {
    expect(!required, "task cleanup includes wrapper launch-env guard evidence", failures);
    return;
  }
  expect(guard.ok === true, "task wrapper launch-env guard completed successfully", failures);
  if (guard.required === true) {
    expect(guard.attempted === true, "task wrapper launch-env guard was established before launch", failures);
    expect(guard.generatedRemoved === true, "task wrapper removed generated launch-env bytes", failures);
    expect(guard.originalRestored === true, "task wrapper restored the prior launch-env state", failures);
    expect(guard.restoredBytesMatch === true, "task wrapper restored launch-env bytes exactly", failures);
    expect(guard.backupRemoved === true, "task wrapper removed its launch-env backup", failures);
    if (guard.originalPresent === true) {
      expect(guard.backupCreated === true, "task wrapper moved the original launch env to its guard backup", failures);
    }
  }
}

function validateTaskPackageProcessGuard(value, required, failures) {
  const guard = objectOrEmpty(value);
  if (required) {
    expect(guard.required === true, "task wrapper package-process guard is required", failures);
  }
  if (!value) {
    expect(!required, "task cleanup includes package-process guard evidence", failures);
    return;
  }
  expect(guard.ok === true, "task wrapper package-process guard completed successfully", failures);
  if (guard.required === true) {
    expect(guard.attempted === true, "task wrapper package-process guard ran after task completion", failures);
    expect(guard.enumerationSucceeded === true, "task wrapper enumerated package-owned smoke processes", failures);
    for (const field of [
      "processesBeforeCount",
      "processesAfterCount",
      "emptyVerificationScanCount"
    ]) {
      expect(
        Number.isInteger(guard[field]) && guard[field] >= 0,
        `task wrapper package-process guard records nonnegative ${field}`,
        failures
      );
    }
    validateExactProcessStopCounters(guard, "stop", "package-process", failures);
    expect(guard.processesAfterCount === 0, "task wrapper left no package-owned smoke processes", failures);
    expect(
      guard.emptyVerificationScanCount >= 2,
      "task wrapper observed two empty package-process scans",
      failures
    );
    expect(guard.verifiedEmpty === true, "task wrapper independently verified the package process set is empty", failures);
  }
}

function validateExactProcessStopCounters(value, prefix, label, failures) {
  const fields = [
    `${prefix}AttemptCount`,
    `${prefix}TerminatedCount`,
    `${prefix}NotFoundCount`,
    `${prefix}AlreadyExitedCount`,
    `${prefix}IdentityMismatchCount`,
    `${prefix}WaitTimeoutCount`,
    `${prefix}FailureCount`
  ];
  for (const field of fields) {
    expect(
      Number.isInteger(value[field]) && value[field] >= 0,
      `task wrapper ${label} guard records nonnegative ${field}`,
      failures
    );
  }
  expect(
    value[`${prefix}AttemptCount`] ===
      value[`${prefix}TerminatedCount`] +
        value[`${prefix}NotFoundCount`] +
        value[`${prefix}AlreadyExitedCount`] +
        value[`${prefix}IdentityMismatchCount`] +
        value[`${prefix}WaitTimeoutCount`] +
        value[`${prefix}FailureCount`],
    `task wrapper ${label} guard accounts for every exact-handle stop outcome`,
    failures
  );
}

function validateProcessCleanupArtifact(value, phase, failures) {
  if (!value) {
    return;
  }
  expect(
    value.kind === "steam-bridge-windows-smoke-process-cleanup",
    `${phase} package-process cleanup artifact kind is valid`,
    failures
  );
  expect(value.phase === phase, `${phase} package-process cleanup phase matches`, failures);
  expect(value.ok === true, `${phase} package-process cleanup completed successfully`, failures);
  expect(Array.isArray(value.processesBeforeCleanup), `${phase} package-process cleanup records the initial process set`, failures);
  expect(Array.isArray(value.cleanupResults), `${phase} package-process cleanup records exact-handle stop results`, failures);
  if (Array.isArray(value.processesBeforeCleanup) && Array.isArray(value.cleanupResults)) {
    expect(
      value.cleanupResults.length === value.processesBeforeCleanup.length,
      `${phase} package-process cleanup accounts for every initial process`,
      failures
    );
    const beforeProcessIds = value.processesBeforeCleanup.map((process) => objectOrEmpty(process).processId);
    const resultProcessIds = value.cleanupResults.map((result) => objectOrEmpty(result).processId);
    expect(
      beforeProcessIds.every((processId) => Number.isInteger(processId) && processId > 0) &&
        resultProcessIds.every((processId) => Number.isInteger(processId) && processId > 0) &&
        new Set(beforeProcessIds).size === beforeProcessIds.length &&
        new Set(resultProcessIds).size === resultProcessIds.length &&
        [...beforeProcessIds].sort((a, b) => a - b).join(",") ===
          [...resultProcessIds].sort((a, b) => a - b).join(","),
      `${phase} package-process cleanup accounts for each initial process identity exactly once`,
      failures
    );
    for (const process of value.processesBeforeCleanup) {
      expect(
        objectOrEmpty(process).creationDatePresent === true,
        `${phase} package-process cleanup captured each process creation identity`,
        failures
      );
    }
    for (const result of value.cleanupResults) {
      const resultObject = objectOrEmpty(result);
      const safeStatuses = ["terminated", "open-not-found", "already-exited", "identity-mismatch"];
      const failureStatuses = [
        "invalid-identity",
        "open-denied",
        "open-failed",
        "creation-query-failed",
        "terminate-failed",
        "wait-failed",
        "wait-timeout",
        "unknown-failed"
      ];
      expect(
        (safeStatuses.includes(resultObject.status) && !resultObject.error) ||
          (failureStatuses.includes(resultObject.status) && resultObject.error === "exact-process-stop-failed"),
        `${phase} package-process cleanup records a closed exact-handle stop outcome`,
        failures
      );
    }
  }
  expect(
    Array.isArray(value.processesAfterCleanup) && value.processesAfterCleanup.length === 0,
    `${phase} package-process cleanup left no package processes`,
    failures
  );
}

function summarizeCleanupArtifacts(processCleanupBefore, processCleanupAfter, launchEnvRollback, taskCleanup) {
  return {
    processBeforeOk: processCleanupBefore ? processCleanupBefore.ok === true : null,
    processAfterOk: processCleanupAfter ? processCleanupAfter.ok === true : null,
    launchEnvRollbackOk: launchEnvRollback ? launchEnvRollback.ok === true : null,
    launchEnvRollbackAttempted: launchEnvRollback ? launchEnvRollback.attempted === true : null,
    taskCleanupOk: taskCleanup ? taskCleanup.ok === true : null,
    taskDeletionVerified: taskCleanup ? taskCleanup.deletionVerified === true : null,
    taskDeleteExitCodeCaptured: taskCleanup ? taskCleanup.deleteExitCodeCaptured === true : null,
    taskAbsenceQueryExitCodeCaptured: taskCleanup ? taskCleanup.queryExitCodeCaptured === true : null,
    taskAbsenceQueryExitCode: taskCleanup ? taskCleanup.queryExitCode ?? null : null,
    taskCleanupPhaseErrorCount: taskCleanup ? taskCleanup.cleanupPhaseErrorCount ?? null : null,
    taskTimedOut: taskCleanup ? taskCleanup.timedOut === true : null,
    taskRunnerTerminatedWithoutDone: taskCleanup ? taskCleanup.runnerTerminatedWithoutDone === true : null,
    taskFailureStage: taskCleanup ? taskCleanup.failureStage || null : null,
    taskErrorKind: taskCleanup ? taskCleanup.errorKind || null : null,
    taskRunnerGuardOk: taskCleanup ? objectOrEmpty(taskCleanup.runnerProcessGuard).ok === true : null,
    taskLaunchEnvGuardOk: taskCleanup ? objectOrEmpty(taskCleanup.launchEnvGuard).ok === true : null,
    taskPackageProcessGuardOk: taskCleanup ? objectOrEmpty(taskCleanup.packageProcessGuard).ok === true : null,
    taskFileGuardOk: taskCleanup ? objectOrEmpty(taskCleanup.taskFileGuard).ok === true : null
  };
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
    if (expected.action === "presenter-duplicate-open-guard") {
      expect(
        row.duplicateOpenGuardProof === true,
        `matrix manifest case ${expected.id} proved duplicate-open suppression payload`,
        failures
      );
    }
    if (expected.action === PERSISTENT_REUSE_ACTION) {
      expect(
        row.persistentReuseProof === true,
        `matrix manifest case ${expected.id} proved three-cycle persistent native-surface reuse`,
        failures
      );
    }
    const expectedNativeHostBackend = String(manifest.expectedNativeHostBackend || "");
    const requiresAttachedPresenterBackend =
      Boolean(expectedNativeHostBackend) &&
      String(expected.action || "").startsWith("presenter-") &&
      expected.action !== "presenter-ready";
    if (requiresAttachedPresenterBackend) {
      const backendEvidence = objectOrEmpty(row.presenterBackendEvidence);
      const resultBackend = objectOrEmpty(backendEvidence.result);
      const lifecycleBackends = Array.isArray(backendEvidence.lifecycle) ? backendEvidence.lifecycle : [];
      expect(resultBackend.attached === true, `matrix manifest case ${expected.id} result presenter is attached`, failures);
      expect(
        resultBackend.backend === expectedNativeHostBackend,
        `matrix manifest case ${expected.id} result presenter backend is ${expectedNativeHostBackend}`,
        failures
      );
      expect(
        resultBackend.hostBackend === expectedNativeHostBackend,
        `matrix manifest case ${expected.id} result native-host backend is ${expectedNativeHostBackend}`,
        failures
      );
      expect(
        resultBackend.rendererBackend === expectedNativeHostBackend,
        `matrix manifest case ${expected.id} result renderer backend is ${expectedNativeHostBackend}`,
        failures
      );
      expect(
        lifecycleBackends.length > 0,
        `matrix manifest case ${expected.id} lifecycle includes an attached presenter backend snapshot`,
        failures
      );
      expect(
        lifecycleBackends.some((backend) => backend.complete),
        `matrix manifest case ${expected.id} lifecycle includes a complete attached presenter backend snapshot`,
        failures
      );
      for (const lifecycleBackend of lifecycleBackends) {
        for (const [field, label] of [
          ["backend", "presenter"],
          ["hostBackend", "native-host"],
          ["rendererBackend", "renderer"]
        ]) {
          if (lifecycleBackend[field]) {
            expect(
              lifecycleBackend[field] === expectedNativeHostBackend,
              `matrix manifest case ${expected.id} lifecycle ${lifecycleBackend.source} ${label} backend is ${expectedNativeHostBackend}`,
              failures
            );
          }
        }
      }
    }
    if (expected.requirePassiveNotification === true) {
      expect(row.passiveNotificationProof === true, `matrix manifest case ${expected.id} proved passive notification presenter state`, failures);
    }
    const auditedCloseProbeExpected =
      SUPPORTED_CLOSE_PROBE_EVIDENCE_SCHEMAS.has(manifest.closeProbeEvidenceSchema) &&
      manifest.closeProbe === true &&
      (expected.requireManagedOverlayComplete === true ||
        expected.closeProbeOnActivation === true ||
        expected.shortcutToggleProbe === true);
    const expectedCloseProbeInput = String(expected.expectedCloseProbeInput || "");
    const recordedCloseProbeEvidenceSchema = Object.prototype.hasOwnProperty.call(
      expected,
      "closeProbeEvidenceSchema"
    )
      ? expected.closeProbeEvidenceSchema
      : manifest.closeProbeEvidenceSchema;
    const expectedCloseProbeEvidenceSchema = Number.isInteger(recordedCloseProbeEvidenceSchema)
      ? recordedCloseProbeEvidenceSchema
      : 0;
    if (auditedCloseProbeExpected) {
      expect(row.closeProbeSent === true, `matrix manifest case ${expected.id} sent Windows close probe input`, failures);
      expect(
        row.closeProbe && row.closeProbe.input === expectedCloseProbeInput,
        `matrix manifest case ${expected.id} close probe input matches resolved ${expectedCloseProbeInput}`,
        failures
      );
      expect(
        row.closeProbe.nativePresenterFocusEventCount === 1,
        `matrix manifest case ${expected.id} recorded one native-presenter focus step`,
        failures
      );
      expect(
        row.closeProbe.nativePresenterFocusSource === "lifecycle-native-host",
        `matrix manifest case ${expected.id} close probe focus used the lifecycle native-host window`,
        failures
      );
      expect(
        row.closeProbe.nativePresenterFocusSanitized === true,
        `matrix manifest case ${expected.id} close probe focus evidence omits raw native HWND`,
        failures
      );
      expect(
        row.closeProbe.nativePresenterFocusAttempted === true &&
          row.closeProbe.nativePresenterFocusHandlePresent === true &&
          row.closeProbe.nativePresenterFocusHandleFormatValid === true &&
          row.closeProbe.nativePresenterFocusWindowValid === true,
        `matrix manifest case ${expected.id} close probe validated the lifecycle native-host window before focus`,
        failures
      );
      expect(
        row.closeProbe.nativePresenterFocused === true && row.closeProbe.nativePresenterFocusBeforeInput === true,
        `matrix manifest case ${expected.id} native presenter focus succeeded before close input`,
        failures
      );
      expect(
        row.closeProbe.nativePresenterPreDispatchSource === "lifecycle-native-host" &&
          row.closeProbe.nativePresenterPreDispatchHandlePresent === true &&
          row.closeProbe.nativePresenterPreDispatchWindowValid === true &&
          (expectedCloseProbeEvidenceSchema === 1 ||
            (row.closeProbe.nativePresenterPreDispatchOwnerMatches === true &&
              row.closeProbe.nativePresenterPreDispatchEnabled === true &&
              row.closeProbe.nativePresenterPreDispatchNotIconic === true)) &&
          row.closeProbe.nativePresenterPreDispatchFocused === true,
        `matrix manifest case ${expected.id} reconfirmed native presenter focus immediately before input`,
        failures
      );
      expect(
        row.closeProbe.nativePresenterPreDispatchSanitized === true,
        `matrix manifest case ${expected.id} pre-dispatch focus evidence omits raw native HWND`,
        failures
      );
      if (expectedCloseProbeEvidenceSchema >= 2) {
        const usesUserGestureGate = expected.autorunUserGestureGate === true;
        const expectedHandoff = usesUserGestureGate
          ? SAME_PROCESS_USER_GESTURE_HANDOFF
          : OWNER_PROCESS_FOREGROUND_HANDOFF;
        const expectedFocusMechanism = usesUserGestureGate
          ? "same-process-user-gesture"
          : "owner-process-native-show";
        expect(
          row.closeProbe.evidenceSchema === expectedCloseProbeEvidenceSchema &&
            row.closeProbe.foregroundHandoff === expectedHandoff,
          usesUserGestureGate
            ? `matrix manifest case ${expected.id} close probe uses schema-${expectedCloseProbeEvidenceSchema} ${expectedHandoff}`
            : `matrix manifest case ${expected.id} close probe uses schema-2 owner-process handoff`,
          failures
        );
        expect(
          row.closeProbe.nativePresenterFocusSchema === 2 &&
            row.closeProbe.nativePresenterFocusMechanism === expectedFocusMechanism,
          `matrix manifest case ${expected.id} focus evidence identifies ${expectedFocusMechanism}`,
          failures
        );
        if (usesUserGestureGate) {
          if (expectedCloseProbeEvidenceSchema === 3) {
            expect(
              expected.externalForegroundTransition === EXTERNAL_FOREGROUND_TRANSITION &&
                row.closeProbe.externalForegroundTransitionEnabled === true &&
                row.closeProbe.externalForegroundTransition === EXTERNAL_FOREGROUND_TRANSITION,
              `matrix manifest case ${expected.id} enables schema-3 external foreground transition ${EXTERNAL_FOREGROUND_TRANSITION}`,
              failures
            );
            expect(
              row.closeProbe.externalForegroundTransitionEvidenceValid === true,
              `matrix manifest case ${expected.id} recorded one coherent external foreground transition branch`,
              failures
            );
          } else {
            expect(
              expectedCloseProbeEvidenceSchema === 2 &&
                row.closeProbe.externalForegroundTransitionEnabled === false &&
                row.closeProbe.externalForegroundTransition === "",
              `matrix manifest case ${expected.id} retains legacy schema-2 user-gesture evidence`,
              failures
            );
          }
          expect(
            row.closeProbe.userGestureGate === true,
            `matrix manifest case ${expected.id} explicitly armed the one-shot user-gesture probe`,
            failures
          );
          expect(
            row.closeProbe.sameProcessUserGestureEvidenceValid === true,
            `matrix manifest case ${expected.id} recorded one coherent same-process user-gesture handoff`,
            failures
          );
          expect(
            row.closeProbe.userGestureCompletionHandshakeValid === true &&
              row.closeProbe.userGestureGracefulShutdownValid === true &&
              row.closeProbe.userGestureCompletionOrderValid === true,
            `matrix manifest case ${expected.id} held result-written state through focus proof and one graceful completion quit`,
            failures
          );
          expect(
            row.closeProbe.nativePresenterFocusWasForeground === true,
            `matrix manifest case ${expected.id} found the exact native host already foreground`,
            failures
          );
          expect(
            row.closeProbe.nativePresenterHandoffRequestCount === 0 &&
              row.closeProbe.nativePresenterHandoffNativeShowCallCount === 0,
            `matrix manifest case ${expected.id} made no foreground request or native-show retry`,
            failures
          );
          expect(
            row.closeProbe.userGestureActivationPointerSucceeded === true &&
              row.closeProbe.userGestureForegroundClearEventCount === 0 &&
              row.closeProbe.userGesturePreDispatchEventCount === 1 &&
              row.closeProbe.userGestureActivationDispatchStartEventCount === 1 &&
              row.closeProbe.userGestureActivationSentEventCount === 1,
            `matrix manifest case ${expected.id} rechecked the exact source and sent exactly one successful renderer activation click`,
            failures
          );
          expect(
            row.closeProbe.userGestureAppFocusReturnObserved === true,
            `matrix manifest case ${expected.id} returned exact foreground to the source Electron window`,
            failures
          );
        } else {
          expect(
            row.closeProbe.nativePresenterHandoffEvidenceValid === true,
            `matrix manifest case ${expected.id} recorded one coherent owner-process foreground handoff`,
            failures
          );
        }
        expect(
          row.closeProbe.closeProbeSentEventCount === 1 &&
            row.closeProbe.closeProbeSkippedEventCount === 0 &&
            row.closeProbe.closeProbeTerminalExclusive === true,
          `matrix manifest case ${expected.id} recorded exactly one successful close-probe terminal branch`,
          failures
        );
        expect(
          row.windowPresent === true &&
            row.windowVisible === true &&
            row.windowFocused === true &&
            row.windowMinimized === false,
          `matrix manifest case ${expected.id} returned focus to the visible Electron window`,
          failures
        );
      }
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
    if (auditedCloseProbeExpected && expectedCloseProbeInput === "web-close-click-sendinput") {
      expect(
        row.closeProbe.processPerMonitorV2 === true,
        `matrix manifest case ${expected.id} close probe used process per-monitor-v2 DPI awareness`,
        failures
      );
      expect(
        row.closeProbe.threadPerMonitorV2 === true,
        `matrix manifest case ${expected.id} close probe used thread per-monitor-v2 DPI awareness`,
        failures
      );
      expect(
        row.closeProbe.nativePointerSucceeded === true,
        `matrix manifest case ${expected.id} close probe sent all three pointer inputs without error`,
        failures
      );
      if (manifest.closeProbeEvidenceSchema === 2) {
        expect(
          row.closeProbe.nativePointerMethod === "sendinput",
          `matrix manifest case ${expected.id} close probe used only SendInput for the pointer dispatch`,
          failures
        );
        expect(
          row.closeProbe.webCloseTargetBeforeHandoff === true,
          `matrix manifest case ${expected.id} resolved the web close target before foreground handoff`,
          failures
        );
      }
      expect(
        row.closeProbe.nativePointerMatchesTarget === true,
        `matrix manifest case ${expected.id} close probe pointer coordinates match the audited target`,
        failures
      );
      expect(
        row.closeProbe.webCloseTargetInsidePanel === true,
        `matrix manifest case ${expected.id} close probe target lies inside the detected panel`,
        failures
      );
      expect(
        row.closeProbe.webCloseTargetUsesScaleAwareInsets === true,
        `matrix manifest case ${expected.id} close probe target uses scale-aware panel insets`,
        failures
      );
      expect(
        row.closeProbe.webCloseScaleAxesAgree === true,
        `matrix manifest case ${expected.id} physical/logical presenter scale axes agree`,
        failures
      );
      expect(
        row.closeProbe.webCloseScaleEvidence === true,
        `matrix manifest case ${expected.id} close probe scale agrees with independent presenter geometry`,
        failures
      );
      expect(
        row.closeProbe.nativeHostRectPresent === true,
        `matrix manifest case ${expected.id} close probe includes a native host rect`,
        failures
      );
      expect(
        row.closeProbe.physicalScreenshotBoundsCount > 0,
        `matrix manifest case ${expected.id} close probe includes a successful screenshot with declared bounds`,
        failures
      );
      expect(
        row.closeProbe.physicalScreenshotReadableCount > 0,
        `matrix manifest case ${expected.id} close probe includes a readable physical screenshot`,
        failures
      );
      expect(
        row.closeProbe.physicalScreenshotDimensionsMatchCount > 0,
        `matrix manifest case ${expected.id} physical screenshot dimensions match declared bounds`,
        failures
      );
      expect(
        row.closeProbe.screenshotContainsNativeHostRect === true,
        `matrix manifest case ${expected.id} physical screenshot bounds contain the native host rect`,
        failures
      );
      expect(
        row.closeProbe.physicalScreenshotProofCount > 0,
        `matrix manifest case ${expected.id} has one coherent physical screenshot proof record`,
        failures
      );
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
      expect(
        row.microTxnCurrentOperationMatch === true,
        `matrix manifest case ${expected.id} correlated the callback to the current checkout operation`,
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
          row.managedCheckoutOperationStarted === true,
          `matrix manifest case ${expected.id} started InitTxn inside the managed checkout operation`,
          failures
        );
        expect(
          row.managedCheckoutOperationDeferredInitTxn === true,
          `matrix manifest case ${expected.id} deferred InitTxn until the managed checkout operation`,
          failures
        );
        expect(
          row.managedCheckoutOperationShownObserverArmed === true,
          `matrix manifest case ${expected.id} armed the shown observer before InitTxn`,
          failures
        );
        expect(
          row.managedCheckoutOperationPresenterReady === true,
          `matrix manifest case ${expected.id} activated the presenter before InitTxn`,
          failures
        );
        expect(
          row.managedCheckoutOperationBeforeInitTxnCapture === true,
          `matrix manifest case ${expected.id} recorded managed-operation start before InitTxn capture`,
          failures
        );
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
  expect(shortcut.shortcutNamePresent === true, "assumed shortcut name presence is recorded", failures);
  expect(shortcut.shortcutName === undefined, "assumed shortcut artifact omits the configured shortcut name", failures);
  expect(typeof shortcut.changed === "boolean", "assumed shortcut changed is boolean", failures);
  expect(typeof shortcut.existingMatches === "boolean", "assumed shortcut existingMatches is boolean", failures);
  const result = objectOrEmpty(shortcut.result);
  expect(result.shortcutsPathPresent === true, "assumed shortcut records shortcuts path presence", failures);
  expect(result.outputPathPresent === true, "assumed shortcut records output path presence", failures);
  for (const field of ["appName", "shortcutsPath", "outputPath"]) {
    expect(result[field] === undefined, `assumed shortcut result omits raw ${field}`, failures);
  }
  for (const [entry, label] of [
    [objectOrEmpty(result.expected), "expected"],
    [objectOrEmpty(result.existing), "existing"]
  ]) {
    for (const field of ["appName", "exe", "exePath", "startDir", "startDirPath", "launchOptions"]) {
      expect(entry[field] === undefined, `assumed shortcut ${label} entry omits raw ${field}`, failures);
    }
    if (Object.keys(entry).length > 0) {
      for (const field of [
        "appNamePresent",
        "exePresent",
        "exePathPresent",
        "exeExists",
        "startDirPresent",
        "startDirPathPresent",
        "startDirExists",
        "launchOptionsPresent"
      ]) {
        expect(typeof entry[field] === "boolean", `assumed shortcut ${label} records boolean ${field}`, failures);
      }
    }
  }
  if (shortcut.ok !== true) {
    failures.push(
      `assumed Steam shortcut invalid for configured shortcut: ` +
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

function verifyPassiveNotificationProof(caseName, actionName, events, nativePresenter, failures) {
  const eventType =
    actionName === "presenter-achievement-progress"
      ? "achievement:progress"
      : actionName === "presenter-achievement-unlock"
        ? "achievement:unlock"
        : "";
  if (!eventType) {
    return { required: false, ok: true };
  }

  const failuresBefore = failures.length;
  const eventIndex = events.findIndex((entry) => entry && entry.type === eventType);
  const transitionIndex = events.findIndex(
    (entry) => entry && entry.type === "overlay:passive-notification-needs-present"
  );
  const parkedIndex = events.findIndex((entry) => entry && entry.type === "overlay:passive-notification-parked");
  const event = eventIndex >= 0 ? events[eventIndex] : null;
  const transitionEvent = transitionIndex >= 0 ? events[transitionIndex] : null;
  const parkedEvent = parkedIndex >= 0 ? events[parkedIndex] : null;
  const payload = objectOrEmpty(event && event.payload);
  const transition = objectOrEmpty(transitionEvent && transitionEvent.payload);
  const parked = objectOrEmpty(parkedEvent && parkedEvent.payload);
  const initialPresenter = objectOrEmpty(payload.presenter);
  const transitionPresenter = objectOrEmpty(transition.presenter);
  const parkedPresenter = objectOrEmpty(parked.presenter);
  const accepted =
    actionName === "presenter-achievement-progress"
      ? payload.indicated === true
      : actionName === "presenter-achievement-unlock"
        ? payload.activated === true
        : false;
  expect(accepted, `${caseName}: passive notification was accepted by Steam`, failures);
  expect(eventIndex >= 0, `${caseName}: passive notification action event is present`, failures);
  expect(transitionIndex > eventIndex, `${caseName}: passive notification observed false-to-true needs-present`, failures);
  expect(parkedIndex > transitionIndex, `${caseName}: passive notification parked after needs-present wake`, failures);
  expect(
    hasPassivePresenterShape(initialPresenter, { parked: true }),
    `${caseName}: passive notification starts parked with needs-present false`,
    failures
  );
  expect(
    transition.previousOverlayNeedsPresent === false && transition.overlayNeedsPresent === true,
    `${caseName}: passive notification transition records false-to-true`,
    failures
  );
  expect(
    transition.pollIntervalMs === WINDOWS_LIGHTWEIGHT_POLL_INTERVAL_MS,
    `${caseName}: passive notification transition uses the 30ms lightweight cadence`,
    failures
  );
  expect(
    transitionPresenter.overlayNeedsPresent === true,
    `${caseName}: passive notification transition snapshot needs presentation`,
    failures
  );
  expect(
    hasPassivePresenterShape(parkedPresenter, { parked: true }) &&
      hasPassivePresenterShape(nativePresenter, { parked: true }),
    `${caseName}: passive notification returns to false/zero-FPS parked state`,
    failures
  );
  for (const [presenter, label] of [
    [initialPresenter, "initial"],
    [transitionPresenter, "transition"],
    [parkedPresenter, "parked"],
    [nativePresenter, "result"]
  ]) {
    const backend = summarizePresenterBackendSnapshot(presenter, label);
    expect(
      backend.complete && backend.agrees && backend.backend === "windows-d3d11",
      `${caseName}: passive ${label} presenter agrees on windows-d3d11`,
      failures
    );
  }

  const initialLightweight = nonnegativeInteger(initialPresenter.lightweightPollCount);
  const transitionLightweight = nonnegativeInteger(transition.lightweightPollCount);
  const finalLightweight = nonnegativeInteger(parkedPresenter.lightweightPollCount);
  const initialFull = nonnegativeInteger(initialPresenter.fullDiagnosticsPollCount);
  const transitionFull = nonnegativeInteger(transition.fullDiagnosticsPollCount);
  const finalFull = nonnegativeInteger(parkedPresenter.fullDiagnosticsPollCount);
  expect(
    [initialLightweight, transitionLightweight, finalLightweight, initialFull, transitionFull, finalFull].every(
      (value) => value >= 0
    ),
    `${caseName}: passive proof records every split polling counter`,
    failures
  );
  expect(
    transitionLightweight === nonnegativeInteger(transitionPresenter.lightweightPollCount) &&
      transitionFull === nonnegativeInteger(transitionPresenter.fullDiagnosticsPollCount),
    `${caseName}: transition counters match the transition presenter snapshot`,
    failures
  );
  expect(
    transitionLightweight > initialLightweight,
    `${caseName}: false-to-true wake came from a new lightweight poll`,
    failures
  );
  expect(finalLightweight >= transitionLightweight, `${caseName}: lightweight poll count is monotonic`, failures);
  expect(transitionFull >= initialFull && finalFull >= transitionFull, `${caseName}: full diagnostic count is monotonic`, failures);
  expect(
    Number.isFinite(transition.lastLightweightPollAt) &&
      transition.lastLightweightPollAt === transitionPresenter.lastLightweightPollAt,
    `${caseName}: transition records the lightweight poll timestamp`,
    failures
  );
  expect(
    transition.lastFullDiagnosticsPollAt === transitionPresenter.lastFullDiagnosticsPollAt,
    `${caseName}: transition full-diagnostics timestamp matches the presenter snapshot`,
    failures
  );
  const durationMs = Number(parked.durationMs);
  const fullDelta = finalFull - initialFull;
  const lightweightDelta = finalLightweight - initialLightweight;
  const maximumFullRefreshes = Number.isFinite(durationMs)
    ? Math.ceil(Math.max(0, durationMs) / WINDOWS_FULL_DIAGNOSTICS_MIN_INTERVAL_MS) + 1
    : 0;
  expect(Number.isFinite(durationMs) && durationMs > 0, `${caseName}: passive proof records its duration`, failures);
  expect(
    fullDelta <= maximumFullRefreshes,
    `${caseName}: passive proof has no hot full-diagnostics loop`,
    failures
  );
  expect(
    lightweightDelta > fullDelta,
    `${caseName}: lightweight polls outnumber full diagnostics refreshes`,
    failures
  );

  return {
    required: true,
    ok: failures.length === failuresBefore,
    falseToTrue: transition.previousOverlayNeedsPresent === false && transition.overlayNeedsPresent === true,
    lightweightPollDelta: lightweightDelta,
    fullDiagnosticsPollDelta: fullDelta,
    maximumFullDiagnosticsPollDelta: maximumFullRefreshes
  };
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

function nonnegativeInteger(value) {
  return Number.isInteger(value) && value >= 0 ? value : -1;
}

function isMicroTxnCallbackEvent(event) {
  return Boolean(event && event.type === "callback:microtxn");
}

function microTxnEventMatchesCurrentCheckoutOperation(event) {
  return microTxnPayload(event).matchesCurrentCheckoutOperation === true;
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

function summarizeManagedCheckoutOperationStart(events) {
  const startIndex = events.findIndex((candidate) => {
    if (!candidate || candidate.type !== "checkout:managed-operation-start") {
      return false;
    }
    const payload = objectOrEmpty(candidate.payload);
    return payload.target === "checkout" && payload.checkoutSource === "init-txn-request-file";
  });
  if (startIndex === -1) {
    return {
      present: false,
      deferredInitTxn: false,
      shownObserverArmed: false,
      callbackCorrelationPrepared: false,
      presenterReady: false,
      beforeInitTxnCapture: false
    };
  }
  const payload = objectOrEmpty(events[startIndex].payload);
  const presenter = objectOrEmpty(payload.presenter);
  const captureIndex = events.findIndex(
    (candidate, index) => index > startIndex && candidate && candidate.type === "checkout:init-txn-captured"
  );
  return {
    present: true,
    deferredInitTxn: payload.deferredInitTxn === true,
    shownObserverArmed: payload.shownObserverArmed === true,
    callbackCorrelationPrepared: payload.callbackCorrelationPrepared === true,
    presenterReady:
      presenter.mode === "active" &&
      presenter.nativeHostOpen === true &&
      presenter.clickThrough === false &&
      presenter.transparent === false,
    beforeInitTxnCapture: captureIndex > startIndex
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
  const eventCount = events.filter(
    (event) => event && event.type === "checkout:client-session-prompt-missing"
  ).length;
  const matches = events
    .map((event, index) => ({ event, index }))
    .filter(({ event }) => isClientSessionPromptMissingEvent(event));
  if (matches.length === 0) {
    return {
      present: false,
      count: eventCount,
      validCount: 0,
      index: -1,
      session: "",
      endpoint: "",
      httpStatus: "",
      usersessionField: "",
      hasIpAddress: "",
      requestShapeSummary: ""
    };
  }
  const { event, index } = matches[0];
  const payload = objectOrEmpty(event.payload);
  const initTxn = objectOrEmpty(payload.initTxn);
  const requestShape = summarizeInitTxnRequestShape(initTxn.requestShape || payload.requestShape);
  return {
    present: true,
    count: eventCount,
    validCount: matches.length,
    index,
    session: String(initTxn.session || payload.session || ""),
    endpoint: normalizeQueryEndpoint(initTxn.endpoint || payload.endpoint),
    httpStatus: String(initTxn.httpStatus || payload.httpStatus || ""),
    usersessionField: requestShape.usersessionField,
    hasIpAddress: requestShape.hasIpAddress,
    requestShapeSummary: requestShape.summary
  };
}

function summarizeClientSessionQuery(events, promptMissing) {
  const queryEvents = events
    .map((event, index) => ({ event, index }))
    .filter(({ event }) => isClientSessionQueryEvent(event));
  const queryEventCount = events.filter(
    (candidate) => candidate && candidate.type === "checkout:client-session-query"
  ).length;
  const timeoutEvents = events
    .map((event, index) => ({ event, index }))
    .filter(({ event }) => isClientSessionWaitTimeoutEvent(event));
  const timeoutEventCount = events.filter(
    (candidate) => candidate && candidate.type === "checkout:client-session-wait-timeout"
  ).length;
  if (queryEvents.length === 0) {
    return {
      present: false,
      count: queryEventCount,
      validCount: 0,
      timeoutCount: timeoutEventCount,
      validTimeoutCount: timeoutEvents.length,
      schema: 0,
      schemaValid: false,
      attempted: false,
      reason: "none",
      endpoint: "unknown",
      id: "none",
      ok: false,
      httpStatus: null,
      result: "missing",
      status: "missing",
      errorCode: "missing",
      requestError: "none",
      hasTransactionId: false,
      hasOrderId: false,
      hasSteamId64: false,
      closedSchema: false,
      afterWaitTimeout: false,
      beforePromptMissing: false,
      chainContextMatches: false
    };
  }
  const { event, index: eventIndex } = queryEvents[0];
  const payload = objectOrEmpty(event.payload);
  const query = objectOrEmpty(payload.query);
  const timeoutMatch = timeoutEvents.length === 1 ? timeoutEvents[0] : undefined;
  const timeoutPayload = objectOrEmpty(timeoutMatch?.event?.payload);
  const queryInitTxn = objectOrEmpty(payload.initTxn);
  const timeoutInitTxn = objectOrEmpty(timeoutPayload.initTxn);
  const endpoint = normalizeQueryEndpoint(query.endpoint);
  const id = normalizeQueryId(query.id);
  const reason = normalizeQueryReason(query.reason);
  const httpStatus = normalizeHttpStatus(query.httpStatus);
  const result = normalizeMicroTxnResult(query.result);
  const status = normalizeMicroTxnStatus(query.status);
  const errorCode = normalizeMicroTxnErrorCode(query.errorCode);
  const requestError = normalizeRequestError(query.requestError);
  const closedSchema = isClientSessionQueryClosedDiagnostic(query);
  const promptSession = normalizeClientSessionValue(promptMissing.session);
  const promptEndpoint = normalizeQueryEndpoint(promptMissing.endpoint);
  const chainContextMatches =
    promptMissing.present === true &&
    promptSession !== "unknown" &&
    promptEndpoint !== "unknown" &&
    normalizeClientSessionValue(queryInitTxn.session) === promptSession &&
    normalizeClientSessionValue(timeoutInitTxn.session) === promptSession &&
    normalizeQueryEndpoint(queryInitTxn.endpoint) === promptEndpoint &&
    normalizeQueryEndpoint(timeoutInitTxn.endpoint) === promptEndpoint &&
    endpoint === promptEndpoint;
  return {
    present: true,
    count: queryEventCount,
    validCount: queryEvents.length,
    timeoutCount: timeoutEventCount,
    validTimeoutCount: timeoutEvents.length,
    schema: query.schema === CLIENT_SESSION_QUERY_SCHEMA ? CLIENT_SESSION_QUERY_SCHEMA : 0,
    schemaValid: query.schema === CLIENT_SESSION_QUERY_SCHEMA,
    attempted: query.attempted === true,
    reason,
    endpoint,
    id,
    ok: query.ok === true,
    httpStatus,
    result,
    status,
    errorCode,
    requestError,
    hasTransactionId: query.hasTransactionId === true,
    hasOrderId: query.hasOrderId === true,
    hasSteamId64: query.hasSteamId64 === true,
    closedSchema,
    afterWaitTimeout: Boolean(timeoutMatch && timeoutMatch.index < eventIndex),
    beforePromptMissing: promptMissing.index > eventIndex,
    chainContextMatches
  };
}

function isClientSessionPromptMissingEvent(event) {
  if (!event || event.type !== "checkout:client-session-prompt-missing") {
    return false;
  }
  const payload = objectOrEmpty(event.payload);
  return hasClientSessionCheckoutTarget(payload) && hasSteamOverlayWaitTimeout(payload);
}

function isClientSessionQueryEvent(event) {
  if (!event || event.type !== "checkout:client-session-query") {
    return false;
  }
  return hasClientSessionCheckoutTarget(objectOrEmpty(event.payload));
}

function isClientSessionWaitTimeoutEvent(event) {
  if (!event || event.type !== "checkout:client-session-wait-timeout") {
    return false;
  }
  const payload = objectOrEmpty(event.payload);
  return hasClientSessionCheckoutTarget(payload) && hasSteamOverlayWaitTimeout(payload);
}

function hasClientSessionCheckoutTarget(payload) {
  const targetSnapshot = objectOrEmpty(payload.targetSnapshot);
  return targetSnapshot.type === "checkout" && targetSnapshot.clientSession === true;
}

function hasSteamOverlayWaitTimeout(payload) {
  const error = objectOrEmpty(payload.error);
  return error.code === "STEAM_OVERLAY_WAIT_TIMEOUT" || error.name === "SteamOverlayWaitTimeoutError";
}

function normalizeClientSessionValue(value) {
  return value === "client" || value === "client-default" ? value : "unknown";
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

function validateClientSessionPromptMissingQueryProof(promptMissing, query, failures) {
  if (!promptMissing.present) {
    return;
  }
  expect(promptMissing.count === 1, "client-session prompt-missing proof recorded exactly one classification", failures);
  expect(
    promptMissing.validCount === 1,
    "client-session prompt-missing proof recorded one validated classification",
    failures
  );
  expect(query.present === true, "client-session prompt-missing proof recorded a QueryTxn diagnostic", failures);
  expect(query.count === 1, "client-session prompt-missing proof recorded exactly one QueryTxn diagnostic", failures);
  expect(query.validCount === 1, "client-session prompt-missing proof recorded one client-session QueryTxn diagnostic", failures);
  expect(query.timeoutCount === 1, "client-session prompt-missing proof recorded exactly one wait-timeout diagnostic", failures);
  expect(query.validTimeoutCount === 1, "client-session prompt-missing proof recorded one client-session wait timeout", failures);
  expect(query.schemaValid === true, "client-session QueryTxn diagnostic uses schema 1", failures);
  expect(query.closedSchema === true, "client-session QueryTxn diagnostic contains only allowlisted scalar values", failures);
  expect(query.attempted === true, "client-session prompt-missing proof attempted QueryTxn", failures);
  expect(query.reason === "none", "client-session attempted QueryTxn diagnostic has no skip reason", failures);
  expect(
    query.endpoint === promptMissing.endpoint,
    "client-session QueryTxn endpoint matches the InitTxn endpoint",
    failures
  );
  expect(
    query.id === "transaction" || query.id === "order",
    "client-session QueryTxn diagnostic uses a transaction or order identifier",
    failures
  );
  if (query.id === "transaction") {
    expect(query.hasTransactionId === true, "client-session QueryTxn transaction presence marker is true", failures);
  }
  if (query.id === "order") {
    expect(query.hasOrderId === true, "client-session QueryTxn order presence marker is true", failures);
  }
  expect(query.afterWaitTimeout === true, "client-session QueryTxn runs after the managed wait timeout", failures);
  expect(query.beforePromptMissing === true, "client-session QueryTxn runs before prompt-missing classification", failures);
  expect(query.chainContextMatches === true, "client-session QueryTxn chain matches one InitTxn context", failures);
}

function hasMicroTxnCallbackProof(actionName, events, expectedAppId) {
  const failures = [];
  verifyMicroTxnCallbackProof(actionName, events, expectedAppId, failures);
  return { ok: failures.length === 0, failures };
}

function verifyMicroTxnCallbackProof(actionName, events, expectedAppId, failures) {
  const allCallbacks = events
    .map((event, index) => ({ event, index }))
    .filter(({ event }) => isMicroTxnCallbackEvent(event));
  if (allCallbacks.length === 0) {
    failures.push("required MicroTxnAuthorizationResponse callback was not recorded");
    return;
  }
  const callbacks = allCallbacks.filter(({ event }) => microTxnEventMatchesCurrentCheckoutOperation(event));
  if (callbacks.length === 0) {
    failures.push("required MicroTxnAuthorizationResponse callback did not match the current checkout operation");
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
  const normalized = typeof source === "string" && source.trim() ? source.trim().toLowerCase() : "";
  return ["steamworks", "legacy"].includes(normalized) ? normalized : normalized ? "unknown" : "";
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
  if (payload.hasOrderId === true) {
    return true;
  }
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

function verifyPersistentReuseProof(
  caseName,
  actionName,
  events,
  caseDir,
  closeProbeEvents,
  failures
) {
  if (actionName !== PERSISTENT_REUSE_ACTION) {
    return { required: false, ok: true, cycles: 0 };
  }

  const failuresBefore = failures.length;
  const startEvents = events.filter((event) => event && event.type === "overlay:presenter-persistent-reuse-start");
  const cycleEvents = events.filter((event) => event && event.type === "overlay:presenter-persistent-reuse-cycle");
  const completeEvents = events.filter(
    (event) => event && event.type === "overlay:presenter-persistent-reuse-complete"
  );
  const errorEvents = events.filter((event) => event && event.type === "overlay:presenter-persistent-reuse-error");
  expect(startEvents.length === 1, `${caseName}: persistent reuse recorded exactly one start`, failures);
  expect(
    cycleEvents.length === WINDOWS_PERSISTENT_REUSE_CYCLES,
    `${caseName}: persistent reuse recorded exactly ${WINDOWS_PERSISTENT_REUSE_CYCLES} cycles`,
    failures
  );
  expect(completeEvents.length === 1, `${caseName}: persistent reuse recorded exactly one completion`, failures);
  expect(errorEvents.length === 0, `${caseName}: persistent reuse recorded no terminal error`, failures);
  const startIndex = events.indexOf(startEvents[0]);
  const completeIndex = events.indexOf(completeEvents[0]);
  const cycleIndexes = cycleEvents.map((event) => events.indexOf(event));
  expect(
    startIndex >= 0 && cycleIndexes.every((index) => index > startIndex),
    `${caseName}: persistent cycles occur after the start event`,
    failures
  );
  expect(
    completeIndex >= 0 && cycleIndexes.every((index) => index < completeIndex),
    `${caseName}: persistent completion occurs after every cycle`,
    failures
  );

  const readiness = readJsonIfPresent(path.join(caseDir, "persistent-control-readiness.json"), failures);
  expect(Boolean(readiness), `${caseName}: persistent reuse includes control readiness evidence`, failures);
  if (readiness) {
    expect(
      readiness.kind === "steam-bridge-windows-persistent-control-readiness",
      `${caseName}: persistent control readiness artifact kind is valid`,
      failures
    );
    expect(readiness.ok === true, `${caseName}: persistent control reached one-controller readiness`, failures);
    for (const field of [
      "controlProcessMatches",
      "windowsX64",
      "steamInitialized",
      "presenterOpen",
      "presenterOwned",
      "persistentMode",
      "controllerGenerationPositive",
      "nativeSurfaceLeaseGenerationPositive"
    ]) {
      expect(readiness[field] === true, `${caseName}: persistent readiness ${field} is true`, failures);
    }
    expect(
      readiness.cycles === WINDOWS_PERSISTENT_REUSE_CYCLES,
      `${caseName}: persistent readiness records ${WINDOWS_PERSISTENT_REUSE_CYCLES} cycles`,
      failures
    );
  }

  const start = objectOrEmpty(startEvents[0] && startEvents[0].payload);
  const startController = positiveInteger(start.controllerGeneration);
  const startLease = positiveInteger(start.nativeSurfaceLeaseGeneration);
  expect(start.cycles === WINDOWS_PERSISTENT_REUSE_CYCLES, `${caseName}: persistent start records three cycles`, failures);
  expect(startController > 0, `${caseName}: persistent start controller generation is positive`, failures);
  expect(startLease > 0, `${caseName}: persistent start surface lease generation is positive`, failures);
  expect(start.presenterMode === "persistent", `${caseName}: persistent start uses persistent presenter mode`, failures);
  const startReadiness = objectOrEmpty(start.readiness);
  expect(startReadiness.canWait === true, `${caseName}: persistent start can wait`, failures);
  expect(
    Object.prototype.hasOwnProperty.call(startReadiness, "reason") &&
      Object.prototype.hasOwnProperty.call(startReadiness, "waitReason"),
    `${caseName}: persistent start records readiness and wait reasons`,
    failures
  );
  expect(
    Array.isArray(start.foregroundHandoffOrdinals) &&
      start.foregroundHandoffOrdinals.length === WINDOWS_PERSISTENT_REUSE_CYCLES &&
      start.foregroundHandoffOrdinals.every((ordinal, index) => ordinal === index + 1),
    `${caseName}: persistent start binds foreground handoff ordinals 1..3`,
    failures
  );

  let baselineInstance = 0;
  let baselineHostToken = "";
  const orderedCycles = cycleEvents.map((event) => objectOrEmpty(event.payload));
  orderedCycles.forEach((cycle, index) => {
    const ordinal = index + 1;
    expect(cycle.cycle === ordinal, `${caseName}: persistent cycle ${ordinal} is ordered`, failures);
    for (const phase of ["shown", "parked"]) {
      const evidence = objectOrEmpty(cycle[phase]);
      const label = `${caseName}: persistent cycle ${ordinal} ${phase}`;
      const controller = positiveInteger(evidence.controllerGeneration);
      const lease = positiveInteger(evidence.nativeSurfaceLeaseGeneration);
      const instance = positiveInteger(evidence.surfaceInstanceGeneration);
      const hostToken = typeof evidence.nativeHostIdentityToken === "string" ? evidence.nativeHostIdentityToken : "";
      expect(controller === startController, `${label} keeps the captured controller generation`, failures);
      expect(lease === startLease, `${label} keeps the captured surface lease generation`, failures);
      expect(instance > 0, `${label} native surface instance generation is positive`, failures);
      expect(
        evidence.nativeHostIdentityPresent === true && /^[a-f0-9]{64}$/i.test(hostToken),
        `${label} records an opaque native HWND identity token`,
        failures
      );
      baselineInstance ||= instance;
      baselineHostToken ||= hostToken;
      expect(instance === baselineInstance, `${label} reuses one native surface instance`, failures);
      expect(hostToken === baselineHostToken, `${label} reuses one native HWND`, failures);
      expect(evidence.nativeHostOpen === true, `${label} native host stays open`, failures);
      expect(evidence.attached === true, `${label} presenter stays attached`, failures);
      expect(evidence.nativeSurfaceOwner === true, `${label} presenter keeps surface ownership`, failures);
      expect(evidence.closed === false, `${label} presenter stays open`, failures);
      expect(
        evidence.closeReason === undefined || evidence.closeReason === null || evidence.closeReason === "",
        `${label} presenter has no terminal close reason`,
        failures
      );
      expect(evidence.attachCount === 1, `${label} has exactly one controller attach`, failures);
      expect(evidence.detachCount === 0, `${label} has no detach before final shutdown`, failures);
      expectWindowsD3d11Evidence(evidence, label, failures);
      expect(
        evidence.pollIntervalMs === WINDOWS_LIGHTWEIGHT_POLL_INTERVAL_MS,
        `${label} keeps the Windows lightweight poll interval`,
        failures
      );
      if (phase === "shown") {
        expect(evidence.mode === "active", `${label} is active`, failures);
        expect(evidence.overlayActive === true, `${label} observed overlay activation`, failures);
      } else {
        expect(evidence.mode === "passive", `${label} returns to passive mode`, failures);
        expect(evidence.overlayActive === false, `${label} observed overlay close`, failures);
        expect(evidence.overlayNeedsPresent === false, `${label} has no pending presentation`, failures);
        expect(evidence.clickThrough === true, `${label} is click-through`, failures);
        expect(evidence.transparent === true, `${label} is transparent`, failures);
        expect(evidence.currentFps === 0, `${label} is parked at zero FPS`, failures);
      }
    }
  });

  const complete = objectOrEmpty(completeEvents[0] && completeEvents[0].payload);
  expect(
    complete.cyclesCompleted === WINDOWS_PERSISTENT_REUSE_CYCLES,
    `${caseName}: persistent completion records three cycles`,
    failures
  );
  expect(
    positiveInteger(complete.controllerGeneration) === startController,
    `${caseName}: persistent completion keeps the captured controller`,
    failures
  );
  expect(
    positiveInteger(complete.nativeSurfaceLeaseGeneration) === startLease,
    `${caseName}: persistent completion keeps the captured surface lease`,
    failures
  );
  expect(
    positiveInteger(complete.surfaceInstanceGeneration) === baselineInstance,
    `${caseName}: persistent completion keeps the native surface instance`,
    failures
  );
  expect(
    complete.nativeHostIdentityPresent === true && complete.nativeHostIdentityToken === baselineHostToken,
    `${caseName}: persistent completion keeps the native HWND identity`,
    failures
  );
  expect(complete.attachCount === 1, `${caseName}: persistent completion reports one attach`, failures);
  expect(complete.detachCount === 0, `${caseName}: persistent completion reports no detach`, failures);
  expectWindowsD3d11Evidence(complete, `${caseName}: persistent completion`, failures);

  const attachEvents = events.filter((event) => event && event.type === "overlay:presenter-attach");
  const closeEvents = events.filter((event) => event && event.type === "overlay:presenter-close");
  expect(attachEvents.length === 1, `${caseName}: persistent action used one managed controller`, failures);
  expect(closeEvents.length === 0, `${caseName}: persistent action did not close before final shutdown`, failures);
  const lifecycle = readJsonLinesIfPresent(path.join(caseDir, "diagnostics", "lifecycle.jsonl"), failures);
  const lifecycleCompleteIndex = lifecycle.findIndex(
    (event) => event && event.type === "event:overlay:presenter-persistent-reuse-complete"
  );
  const lifecycleCloseIndexes = lifecycle
    .map((event, index) => (event && event.type === "event:overlay:presenter-close" ? index : -1))
    .filter((index) => index >= 0);
  const lifecycleCloseErrorEvents = lifecycle.filter(
    (event) => event && event.type === "event:overlay:presenter-close:error"
  );
  expect(lifecycleCompleteIndex >= 0, `${caseName}: persistent lifecycle records completion`, failures);
  expect(lifecycleCloseIndexes.length === 1, `${caseName}: persistent lifecycle closes once at final shutdown`, failures);
  expect(
    lifecycleCloseIndexes.length === 1 && lifecycleCloseIndexes[0] > lifecycleCompleteIndex,
    `${caseName}: persistent lifecycle closes only after three-cycle completion`,
    failures
  );
  expect(lifecycleCloseErrorEvents.length === 0, `${caseName}: persistent final shutdown recorded no close error`, failures);
  if (lifecycleCloseIndexes.length === 1) {
    const closeEvent = lifecycle[lifecycleCloseIndexes[0]];
    const closePresenter = objectOrEmpty(objectOrEmpty(closeEvent.payload).presenter);
    expect(closePresenter.closed === true, `${caseName}: final shutdown snapshot is closed`, failures);
    expect(closePresenter.closeReason === "closed", `${caseName}: final shutdown reason is closed`, failures);
    expect(closePresenter.nativeSurfaceOwner === false, `${caseName}: final shutdown released surface ownership`, failures);
    expect(closePresenter.nativeHostOpen === false, `${caseName}: final shutdown closed the native host`, failures);
    expect(closePresenter.attached === false, `${caseName}: final shutdown detached the presenter`, failures);
    expect(closePresenter.backend === "none", `${caseName}: final shutdown has no live backend`, failures);
    expect(
      closePresenter.nativeSurfaceAttachCount === 1,
      `${caseName}: final shutdown preserves the single attach count`,
      failures
    );
    expect(
      closePresenter.nativeSurfaceDetachCount === 1,
      `${caseName}: final shutdown records exactly one detach`,
      failures
    );
    expect(
      closePresenter.lastError === undefined || closePresenter.lastError === null || closePresenter.lastError === "",
      `${caseName}: final shutdown snapshot has no close error`,
      failures
    );
  }
  verifyPersistentCloseProbe(caseName, closeProbeEvents, failures);

  return {
    required: true,
    ok: failures.length === failuresBefore,
    cycles: orderedCycles.length,
    controllerGeneration: startController,
    nativeSurfaceLeaseGeneration: startLease,
    surfaceInstanceGeneration: baselineInstance,
    nativeHostIdentityTokenPresent: Boolean(baselineHostToken)
  };
}

function verifyPersistentCloseProbe(caseName, events, failures) {
  const focus = events.filter((event) => event && event.type === "probe:native-presenter-focus");
  const sent = events.filter((event) => event && event.type === "probe:sent");
  const complete = events.filter((event) => event && event.type === "probe:complete");
  const terminalFailures = events.filter(
    (event) => event && ["probe:close-input-skipped", "probe:incomplete", "probe:timeout"].includes(event.type)
  );
  expect(
    focus.length === WINDOWS_PERSISTENT_REUSE_CYCLES,
    `${caseName}: persistent close probe recorded three focus handoffs`,
    failures
  );
  expect(sent.length === WINDOWS_PERSISTENT_REUSE_CYCLES, `${caseName}: persistent close probe sent three inputs`, failures);
  expect(complete.length === 1, `${caseName}: persistent close probe completed once`, failures);
  expect(terminalFailures.length === 0, `${caseName}: persistent close probe had no terminal failure`, failures);
  focus.forEach((event, index) => {
    const payload = objectOrEmpty(event.payload);
    const ordinal = index + 1;
    expect(payload.cycle === ordinal, `${caseName}: persistent focus cycle ${ordinal} is ordered`, failures);
    expect(payload.requestCount === 1, `${caseName}: persistent focus cycle ${ordinal} made one request`, failures);
    expect(payload.requestOrdinal === ordinal, `${caseName}: persistent focus cycle ${ordinal} response matched its ordinal`, failures);
    expect(payload.focused === true, `${caseName}: persistent focus cycle ${ordinal} acquired exact-host foreground`, failures);
  });
  sent.forEach((event, index) => {
    const payload = objectOrEmpty(event.payload);
    const ordinal = index + 1;
    const preDispatch = objectOrEmpty(payload.nativePresenterPreDispatch);
    expect(payload.cycle === ordinal, `${caseName}: persistent input cycle ${ordinal} is ordered`, failures);
    expect(preDispatch.cycle === ordinal, `${caseName}: persistent input cycle ${ordinal} rechecked the same ordinal`, failures);
    expect(preDispatch.focused === true, `${caseName}: persistent input cycle ${ordinal} passed pre-dispatch focus`, failures);
  });
  if (complete.length === 1) {
    const payload = objectOrEmpty(complete[0].payload);
    expect(
      payload.sentCount === WINDOWS_PERSISTENT_REUSE_CYCLES &&
        payload.expectedCloseCount === WINDOWS_PERSISTENT_REUSE_CYCLES,
      `${caseName}: persistent close probe completed all three cycles`,
      failures
    );
  }
}

function expectWindowsD3d11Evidence(evidence, label, failures) {
  expect(evidence.backend === "windows-d3d11", `${label} presenter backend is windows-d3d11`, failures);
  expect(evidence.hostBackend === "windows-d3d11", `${label} host backend is windows-d3d11`, failures);
  expect(evidence.rendererBackend === "windows-d3d11", `${label} renderer backend is windows-d3d11`, failures);
}

function positiveInteger(value) {
  return Number.isInteger(value) && value > 0 ? value : 0;
}

function verifyDuplicateOpenGuard(caseName, actionName, events, failures) {
  if (actionName !== "presenter-duplicate-open-guard") {
    return { required: false, ok: true };
  }

  const failuresBefore = failures.length;
  const guardEvents = events.filter(
    (entry) => entry && entry.type === "overlay:presenter-duplicate-open-guard"
  );
  if (guardEvents.length !== 1) {
    failures.push(
      `${caseName}: expected exactly one overlay:presenter-duplicate-open-guard event, found ${guardEvents.length}`
    );
    return { required: true, ok: false };
  }

  const event = guardEvents[0];
  const payload = objectOrEmpty(event.payload);
  verifyDuplicateOpenBusyStatus(caseName, "status", objectOrEmpty(payload.status), failures);
  verifyDuplicateOpenBusyStatus(
    caseName,
    "shortcut status",
    objectOrEmpty(payload.shortcutStatus),
    failures
  );

  const namedStatuses = objectOrEmpty(payload.namedStatuses);
  for (const name of DUPLICATE_OPEN_NAMED_STATUS_NAMES) {
    verifyDuplicateOpenBusyStatus(
      caseName,
      `named ${name} status`,
      objectOrEmpty(namedStatuses[name]),
      failures
    );
  }
  expect(
    objectOrEmpty(namedStatuses.checkoutOperation).canStartOperation === false,
    `${caseName}: duplicate guard named checkoutOperation status explicitly rejects operation start`,
    failures
  );

  const namedIfAvailableNulls = objectOrEmpty(payload.namedIfAvailableNulls);
  const namedAndWaitIfAvailableNulls = objectOrEmpty(payload.namedAndWaitIfAvailableNulls);
  for (const name of DUPLICATE_OPEN_NAMED_TARGET_NAMES) {
    expect(
      namedIfAvailableNulls[name] === true,
      `${caseName}: open${formatNamedOverlayHelperName(name)}IfAvailable returned null while busy`,
      failures
    );
    expect(
      namedAndWaitIfAvailableNulls[name] === true,
      `${caseName}: open${formatNamedOverlayHelperName(name)}AndWaitIfAvailable returned null while busy`,
      failures
    );
  }

  expect(payload.openIfAvailableNull === true, `${caseName}: openIfAvailable returned null while busy`, failures);
  expect(
    payload.openAndWaitIfAvailableNull === true,
    `${caseName}: openAndWaitIfAvailable returned null while busy`,
    failures
  );
  expect(
    payload.shortcutIfAvailableNull === true,
    `${caseName}: openShortcutTargetIfAvailable returned null while busy`,
    failures
  );
  expect(
    payload.shortcutAndWaitIfAvailableNull === true,
    `${caseName}: openShortcutTargetAndWaitIfAvailable returned null while busy`,
    failures
  );
  expect(
    payload.checkoutOpenIfAvailableNull === true,
    `${caseName}: openCheckoutIfAvailable returned null while busy`,
    failures
  );
  expect(
    payload.checkoutIfAvailableNull === true,
    `${caseName}: openCheckoutAndWaitIfAvailable returned null while busy`,
    failures
  );
  expect(
    payload.checkoutOperationRan === false,
    `${caseName}: checkout IfAvailable did not run the transaction operation while busy`,
    failures
  );

  return { required: true, ok: failures.length === failuresBefore };
}

function verifyDuplicateOpenBusyStatus(caseName, label, status, failures) {
  expect(status.canOpen === false, `${caseName}: duplicate guard ${label} rejects open`, failures);
  expect(status.canWait === false, `${caseName}: duplicate guard ${label} rejects wait`, failures);
  if (Object.prototype.hasOwnProperty.call(status, "canStartOperation")) {
    expect(
      status.canStartOperation === false,
      `${caseName}: duplicate guard ${label} rejects checkout operation start`,
      failures
    );
  }
  expect(
    status.reason === "opening" || status.reason === "overlay-active",
    `${caseName}: duplicate guard ${label} is opening or overlay-active, got ${formatValue(status.reason)}`,
    failures
  );
  expect(
    status.waitReason === "opening" || status.waitReason === "overlay-active",
    `${caseName}: duplicate guard ${label} wait reason is opening or overlay-active, got ${formatValue(
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

function summarizePresenterBackendEvidence(nativePresenter, events) {
  const result = summarizePresenterBackendSnapshot(nativePresenter, "result");
  const lifecycle = [];
  for (const event of Array.isArray(events) ? events : []) {
    const payload = objectOrEmpty(event && event.payload);
    const presenter = payload.presenter;
    if (!presenter || typeof presenter !== "object" || Array.isArray(presenter)) {
      continue;
    }
    const snapshot = summarizePresenterBackendSnapshot(presenter, String((event && event.type) || "lifecycle"));
    if (snapshot.attached) {
      lifecycle.push(snapshot);
    }
  }
  return {
    result,
    lifecycle,
    lifecycleAttachedCount: lifecycle.length,
    lifecycleCompleteCount: lifecycle.filter((snapshot) => snapshot.complete).length
  };
}

function summarizePresenterBackendSnapshot(value, source) {
  const presenter = objectOrEmpty(value);
  const host = objectOrEmpty(presenter.nativeHostDiagnostics);
  const renderer = objectOrEmpty(host.renderer);
  const backend = typeof presenter.backend === "string" ? presenter.backend : "";
  const hostBackend = typeof host.backend === "string" ? host.backend : "";
  const rendererBackend = typeof renderer.backend === "string" ? renderer.backend : "";
  const complete = Boolean(backend && hostBackend && rendererBackend);
  return {
    source,
    present: Object.keys(presenter).length > 0,
    attached: presenter.nativeHostOpen === true || presenter.attached === true,
    backend,
    hostBackend,
    rendererBackend,
    complete,
    agrees: complete && backend === hostBackend && backend === rendererBackend
  };
}

function summarizeCaseResult(caseName, result, resultLog, renderingHealth = null, closeProbeEvents = [], caseDir = "") {
  const failures = [];
  const snapshot = objectOrEmpty(result.snapshot);
  const app = objectOrEmpty(snapshot.app);
  const windowState = objectOrEmpty(snapshot.window);
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
  const presenterBackendEvidence = summarizePresenterBackendEvidence(nativePresenter, events);
  const userGestureCompletion = readJsonIfPresent(
    path.join(caseDir || path.dirname(resultLog), "user-gesture-completion.json"),
    failures
  );
  const externalForegroundReadyMarker = readJsonIfPresent(
    path.join(caseDir || path.dirname(resultLog), "external-foreground-ready.json"),
    failures
  );
  const externalForegroundControllerAck = readJsonIfPresent(
    path.join(caseDir || path.dirname(resultLog), "external-foreground-ack.json"),
    failures
  );
  const fullLifecycleEvents = readJsonLinesIfPresent(
    path.join(caseDir || path.dirname(resultLog), "diagnostics", "lifecycle.jsonl"),
    failures
  );
  const userGestureExpectation = getUserGestureGateExpectation(caseName);
  const closeProbe = summarizeCloseProbe(
    closeProbeEvents,
    caseDir || path.dirname(resultLog),
    nativePresenter,
    events,
    userGestureCompletion,
    fullLifecycleEvents,
    externalForegroundReadyMarker,
    externalForegroundControllerAck,
    userGestureExpectation
  );
  const initTxnRequestShape = summarizeInitTxnRequestShapeEvent(events);
  const initTxnTargetMissing = summarizeInitTxnTargetMissing(events);
  const webSessionCheckoutCapture = summarizeWebSessionCheckoutCapture(events);
  const clientSessionCheckoutCapture = summarizeClientSessionCheckoutCapture(events);
  const managedCheckoutOperationStart = summarizeManagedCheckoutOperationStart(events);
  const clientSessionWaitStart = summarizeClientSessionWaitStart(events);
  const clientSessionPromptMissing = summarizeClientSessionPromptMissing(events);
  const clientSessionQuery = summarizeClientSessionQuery(events, clientSessionPromptMissing);
  const microTxnCallbackProof = hasMicroTxnCallbackProof(String(action.action || ""), events, app.appId);
  const duplicateOpenGuard = verifyDuplicateOpenGuard(String(caseName), String(action.action || ""), events, failures);
  const passiveNotification = verifyPassiveNotificationProof(
    String(caseName),
    String(action.action || ""),
    events,
    nativePresenter,
    failures
  );
  const persistentReuse = verifyPersistentReuseProof(
    String(caseName),
    String(action.action || ""),
    events,
    caseDir || path.dirname(resultLog),
    closeProbeEvents,
    failures
  );

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
  if (userGestureExpectation) {
    expect(
      action.action === userGestureExpectation.action,
      `${caseName}: result action matches its exact case-owned action`,
      failures
    );
  }
  if (closeProbe.sameProcessUserGestureEvidencePresent) {
    expect(
      Boolean(userGestureExpectation),
      `${caseName}: user-gesture evidence belongs to an exact supported case`,
      failures
    );
    expect(
      closeProbe.userGestureGate === true,
      `${caseName}: same-process user-gesture evidence explicitly declares its gate`,
      failures
    );
    expect(
      closeProbe.sameProcessUserGestureEvidenceValid === true,
      `${caseName}: user-gesture evidence matches its exact case-owned action and target`,
      failures
    );
  }
  expectInitTxnRequestShape(initTxnRequestShape, `${caseName}: InitTxn request-shape event`, failures);
  expectInitTxnRequestShape(webSessionCheckoutCapture, `${caseName}: web-session InitTxn capture`, failures);
  expectInitTxnRequestShape(clientSessionCheckoutCapture, `${caseName}: client-session InitTxn capture`, failures);
  expectInitTxnRequestShape(clientSessionPromptMissing, `${caseName}: client-session prompt-missing diagnostic`, failures);
  expectInitTxnRequestShape(initTxnTargetMissing, `${caseName}: InitTxn target-missing diagnostic`, failures);
  validateClientSessionPromptMissingQueryProof(clientSessionPromptMissing, clientSessionQuery, failures);

  const steamRenderingHealth = summarizeCaseRenderingHealth(renderingHealth);

  return {
    caseName,
    action: String(action.action || ""),
    resultLog,
    appId: app.appId,
    managedOverlayResultMode: app.managedOverlayResultMode || "",
    windowPresent: windowState.present === true,
    windowVisible: windowState.visible === true,
    windowFocused: windowState.focused === true,
    windowMinimized: windowState.minimized === true,
    processId: processInfo.pid || null,
    steamLaunch: launch.steamLaunch === true,
    overlayInjection: launch.overlayInjection === true,
    steamOverlayLaunchMarker: hasSteamOverlayLaunchMarker(launch),
    overlayEnabled,
    overlayNeedsPresent,
    overlayActiveEvents,
    overlayInactiveEvents,
    presenterBackendEvidence,
    duplicateOpenGuardProof: duplicateOpenGuard.required ? duplicateOpenGuard.ok : "n/a",
    passiveNotificationProof: passiveNotification.required ? passiveNotification.ok : "n/a",
    passiveNotificationEvidence: passiveNotification,
    persistentReuseProof: persistentReuse.required ? persistentReuse.ok : "n/a",
    persistentReuseEvidence: persistentReuse,
    microTxnCallbackListenerRegistered: hasMicroTxnCallbackListenerRegistered(events),
    legacyMicroTxnCallbackListenerRegistered: hasLegacyMicroTxnCallbackListenerRegistered(events),
    microTxnCallbackCount: events.filter(isMicroTxnCallbackEvent).length,
    microTxnCallbackSources: microTxnCallbackSources(events),
    microTxnCurrentOperationMatch: events.some(
      (event) => isMicroTxnCallbackEvent(event) && microTxnEventMatchesCurrentCheckoutOperation(event)
    ),
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
    managedCheckoutOperationStarted: managedCheckoutOperationStart.present,
    managedCheckoutOperationDeferredInitTxn: managedCheckoutOperationStart.deferredInitTxn,
    managedCheckoutOperationShownObserverArmed: managedCheckoutOperationStart.shownObserverArmed,
    managedCheckoutOperationCallbackCorrelationPrepared: managedCheckoutOperationStart.callbackCorrelationPrepared,
    managedCheckoutOperationPresenterReady: managedCheckoutOperationStart.presenterReady,
    managedCheckoutOperationBeforeInitTxnCapture: managedCheckoutOperationStart.beforeInitTxnCapture,
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
    clientSessionQueryPresent: clientSessionQuery.present,
    clientSessionQuerySchema: clientSessionQuery.schema,
    clientSessionQueryClosedSchema: clientSessionQuery.closedSchema,
    clientSessionQueryAttempted: clientSessionQuery.attempted,
    clientSessionQueryReason: clientSessionQuery.reason,
    clientSessionQueryEndpoint: clientSessionQuery.endpoint,
    clientSessionQueryId: clientSessionQuery.id,
    clientSessionQueryOk: clientSessionQuery.ok,
    clientSessionQueryHttpStatus: clientSessionQuery.httpStatus,
    clientSessionQueryResult: clientSessionQuery.result,
    clientSessionQueryStatus: clientSessionQuery.status,
    clientSessionQueryErrorCode: clientSessionQuery.errorCode,
    clientSessionQueryRequestError: clientSessionQuery.requestError,
    clientSessionQueryHasTransactionId: clientSessionQuery.hasTransactionId,
    clientSessionQueryHasOrderId: clientSessionQuery.hasOrderId,
    clientSessionQueryHasSteamId64: clientSessionQuery.hasSteamId64,
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
        `closeProbeEvidenceSchema=${formatValue(summary.manifest.closeProbeEvidenceSchema)} ` +
        `closeProbeForegroundHandoff=${formatValue(summary.manifest.closeProbeForegroundHandoff)} ` +
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
  if (summary.cleanup) {
    console.log(
      `cleanup: processBefore=${formatValue(summary.cleanup.processBeforeOk)} ` +
        `processAfter=${formatValue(summary.cleanup.processAfterOk)} ` +
        `launchEnvRollback=${formatValue(summary.cleanup.launchEnvRollbackOk)} ` +
        `task=${formatValue(summary.cleanup.taskCleanupOk)} ` +
        `taskDeletionVerified=${formatValue(summary.cleanup.taskDeletionVerified)}`
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
          `duplicateOpenGuard=${formatValue(row.duplicateOpenGuardProof)} ` +
          `persistentReuse=${formatValue(row.persistentReuseProof)} ` +
          `passivePolling=${formatValue(row.passiveNotificationProof)} ` +
          `presenterBackend=${formatValue(row.presenterBackendEvidence.result.backend)} ` +
          `hostBackend=${formatValue(row.presenterBackendEvidence.result.hostBackend)} ` +
          `rendererBackend=${formatValue(row.presenterBackendEvidence.result.rendererBackend)} ` +
          `lifecycleBackendSnapshots=${row.presenterBackendEvidence.lifecycleAttachedCount}/` +
            `${row.presenterBackendEvidence.lifecycleCompleteCount} ` +
          `microTxnListener=${row.microTxnCallbackListenerRegistered} ` +
          `legacyMicroTxnListener=${row.legacyMicroTxnCallbackListenerRegistered} ` +
          `microTxnCallbacks=${row.microTxnCallbackCount} ` +
          `microTxnSources=${formatValue(row.microTxnCallbackSources)} ` +
          `microTxnCurrentOperation=${row.microTxnCurrentOperationMatch} microTxnProof=${row.microTxnCallbackProof} ` +
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
          `checkoutOperationStarted=${row.managedCheckoutOperationStarted} ` +
          `checkoutOperationDeferredInitTxn=${row.managedCheckoutOperationDeferredInitTxn} ` +
          `checkoutOperationObserver=${row.managedCheckoutOperationShownObserverArmed} ` +
          `checkoutOperationCorrelation=${row.managedCheckoutOperationCallbackCorrelationPrepared} ` +
          `checkoutOperationPresenter=${row.managedCheckoutOperationPresenterReady} ` +
          `checkoutOperationBeforeCapture=${row.managedCheckoutOperationBeforeInitTxnCapture} ` +
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
          `clientQuery=${row.clientSessionQueryPresent} ` +
          `clientQuerySchema=${formatValue(row.clientSessionQuerySchema)} ` +
          `clientQueryClosed=${row.clientSessionQueryClosedSchema} ` +
          `clientQueryAttempted=${row.clientSessionQueryAttempted} ` +
          `clientQueryReason=${formatValue(row.clientSessionQueryReason)} ` +
          `clientQueryEndpoint=${formatValue(row.clientSessionQueryEndpoint)} ` +
          `clientQueryId=${formatValue(row.clientSessionQueryId)} ` +
          `clientQueryOk=${row.clientSessionQueryOk} ` +
          `clientQueryHttp=${formatValue(row.clientSessionQueryHttpStatus)} ` +
          `clientQueryResult=${formatValue(row.clientSessionQueryResult)} ` +
          `clientQueryStatus=${formatValue(row.clientSessionQueryStatus)} ` +
          `clientQueryError=${formatValue(row.clientSessionQueryErrorCode)} ` +
          `clientQueryRequestError=${formatValue(row.clientSessionQueryRequestError)} ` +
          `clientQueryTransaction=${row.clientSessionQueryHasTransactionId} ` +
          `clientQueryOrder=${row.clientSessionQueryHasOrderId} ` +
          `clientQuerySteam=${row.clientSessionQueryHasSteamId64} ` +
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
    closeProbeEvidenceSchema: Number(manifest.closeProbeEvidenceSchema || 0),
    closeProbeForegroundHandoff: String(manifest.closeProbeForegroundHandoff || ""),
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
    shortcutName: shortcut.shortcutNamePresent === true ? "configured" : "",
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

function summarizeCloseProbe(
  events,
  caseDir = "",
  nativePresenter = null,
  lifecycleEvents = [],
  userGestureCompletion = null,
  fullLifecycleEvents = [],
  externalForegroundReadyMarker = null,
  externalForegroundControllerAck = null,
  userGestureExpectation = null
) {
  const normalizedEvents = Array.isArray(events) ? events.filter(Boolean) : [];
  const startEvent = normalizedEvents.find((event) => event.type === "probe:start");
  const sentEvents = normalizedEvents.filter((event) => event.type === "probe:sent");
  const skippedEvents = normalizedEvents.filter((event) => event.type === "probe:close-input-skipped");
  const sentEvent = sentEvents[0];
  const skippedEvent = skippedEvents[0];
  const targetEvent = normalizedEvents.find((event) => event.type === "probe:web-close-click-target");
  const nativePresenterFocusEvents = normalizedEvents.filter(
    (event) => event.type === "probe:native-presenter-focus"
  );
  const nativePresenterFocusEvent = nativePresenterFocusEvents[0];
  const userGestureReadyEvents = normalizedEvents.filter(
    (event) => event.type === "probe:user-gesture-gate-ready"
  );
  const userGestureActivationEvents = normalizedEvents.filter(
    (event) => event.type === "probe:user-gesture-gate-activation-sent"
  );
  const userGestureConsumedProbeEvents = normalizedEvents.filter(
    (event) => event.type === "probe:user-gesture-gate-consumed"
  );
  const userGestureFocusReturnEvents = normalizedEvents.filter(
    (event) => event.type === "probe:user-gesture-app-focus-return"
  );
  const externalForegroundSourceReadyEvents = normalizedEvents.filter(
    (event) => event.type === "probe:external-foreground-source-ready"
  );
  const externalForegroundTransitionObservedEvents = normalizedEvents.filter(
    (event) => event.type === "probe:external-foreground-transition-observed"
  );
  const externalForegroundControllerAcknowledgedEvents = normalizedEvents.filter(
    (event) => event.type === "probe:external-foreground-controller-acknowledged"
  );
  const externalForegroundTransitionNotRequiredEvents = normalizedEvents.filter(
    (event) => event.type === "probe:external-foreground-transition-not-required"
  );
  const externalForegroundTransitionRejectedEvents = normalizedEvents.filter(
    (event) => event.type === "probe:external-foreground-transition-rejected"
  );
  const ownerHandoffEvents = (Array.isArray(lifecycleEvents) ? lifecycleEvents : []).filter((event) =>
    ["overlay:presenter-foreground-handoff", "event:overlay:presenter-foreground-handoff"].includes(
      String((event && event.type) || "")
    )
  );
  const ownerHandoffEvent = ownerHandoffEvents[0];
  const nativePresenterFocusIndex = normalizedEvents.indexOf(nativePresenterFocusEvent);
  const targetEventIndex = normalizedEvents.indexOf(targetEvent);
  const sentEventIndex = normalizedEvents.indexOf(sentEvent);
  const startPayload = objectOrEmpty(startEvent && startEvent.payload);
  const evidenceSchema = Number.isInteger(startPayload.evidenceSchema)
    ? startPayload.evidenceSchema
    : 0;
  const sentPayload = objectOrEmpty(sentEvent && sentEvent.payload);
  const skippedPayload = objectOrEmpty(skippedEvent && skippedEvent.payload);
  const targetPayload = objectOrEmpty(targetEvent && targetEvent.payload);
  const nativePresenterFocusPayload = objectOrEmpty(
    nativePresenterFocusEvent && nativePresenterFocusEvent.payload
  );
  const ownerHandoff = summarizeOwnerProcessForegroundHandoff(
    nativePresenterFocusPayload,
    ownerHandoffEvents,
    nativePresenterFocusEvent
  );
  const sameProcessUserGesture = summarizeSameProcessUserGestureHandoff({
    normalizedEvents,
    lifecycleEvents,
    nativePresenterFocusEvent,
    nativePresenterFocusPayload,
    userGestureReadyEvents,
    userGestureActivationEvents,
    userGestureConsumedProbeEvents,
    userGestureFocusReturnEvents,
    userGestureCompletion,
    fullLifecycleEvents,
    externalForegroundReadyMarker,
    externalForegroundControllerAck,
    externalForegroundSourceReadyEvents,
    externalForegroundControllerAcknowledgedEvents,
    externalForegroundTransitionObservedEvents,
    externalForegroundTransitionNotRequiredEvents,
    externalForegroundTransitionRejectedEvents,
    userGestureExpectation
  });
  const nativePresenterPreDispatchPayload = objectOrEmpty(sentPayload.nativePresenterPreDispatch);
  const nativePointerSent = objectOrEmpty(sentPayload.nativePointerSent);
  const webCloseTarget = objectOrEmpty(targetPayload.target);
  const loggedPanel = objectOrEmpty(webCloseTarget.panel);
  const loggedInsets = objectOrEmpty(webCloseTarget.insets);
  const loggedScale = objectOrEmpty(webCloseTarget.scale);
  const webClosePanel = normalizeRect(loggedPanel);
  const nativeHostRect = findNativeHostRect(nativePresenter, lifecycleEvents);
  const presenterScaleGeometry = findPresenterScaleGeometry(nativePresenter, lifecycleEvents);
  const derivedScale = presenterScaleGeometry ? presenterScaleGeometry.scale : NaN;
  const loggedScaleValue = Number(loggedScale.value);
  const scaleSourceSupported = ["native-host-window-dpi", "presenter-geometry-ratio"].includes(
    String(loggedScale.source || "")
  );
  const scaleAgreement = Boolean(
    presenterScaleGeometry &&
      presenterScaleGeometry.axesAgree &&
      Number.isFinite(loggedScaleValue) &&
      Math.abs(loggedScaleValue - derivedScale) <= WINDOWS_CLOSE_SCALE_TOLERANCE
  );
  const targetX = Number(webCloseTarget.x);
  const targetY = Number(webCloseTarget.y);
  const targetInsidePanel = Boolean(
    webClosePanel &&
      Number.isFinite(targetX) &&
      Number.isFinite(targetY) &&
      targetX >= webClosePanel.left &&
      targetX <= webClosePanel.right &&
      targetY >= webClosePanel.top &&
      targetY <= webClosePanel.bottom
  );
  // The probe targets with the authoritative window-DPI scale. Geometry is an
  // independent agreement check and can differ slightly because of rounded
  // physical/logical window dimensions, including across a rounding boundary.
  const expectedTarget = expectedWebCloseTarget(webClosePanel, loggedPanel, loggedScaleValue);
  const targetUsesScaleAwareInsets = Boolean(
    expectedTarget &&
      Number(loggedInsets.right) === expectedTarget.rightInset &&
      Number(loggedInsets.top) === expectedTarget.topInset &&
      Number(loggedInsets.logicalRight) === 16 &&
      Number(loggedInsets.logicalTop) === 18 &&
      targetX === expectedTarget.x &&
      targetY === expectedTarget.y
  );
  const dpiAwareness = String(startPayload.dpiAwareness || "");
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
  const physicalScreenshots = summarizePhysicalScreenshotEvidence(normalizedEvents, caseDir, nativeHostRect);

  return {
    sent: Boolean(sentEvent),
    closeProbeSentEventCount: sentEvents.length,
    closeProbeSkippedEventCount: skippedEvents.length,
    closeProbeSkippedReason: String(skippedPayload.reason || ""),
    closeProbeTerminalExclusive: sentEvents.length + skippedEvents.length === 1,
    input: sentEvent ? String(sentPayload.input || "") : "",
    eventCount: normalizedEvents.length,
    screenshotCount,
    screenshotVisuals,
    foregroundSampleCount: foregroundSamples.length,
    foregroundProcessNames,
    foregroundStayedOnSmoke,
    nativePresenterFocusEventCount: nativePresenterFocusEvents.length,
    evidenceSchema,
    foregroundHandoff: String(startPayload.foregroundHandoff || ""),
    externalForegroundTransition: String(startPayload.externalForegroundTransition || ""),
    externalForegroundTransitionEnabled:
      startPayload.externalForegroundTransitionEnabled === true,
    userGestureGate: startPayload.userGestureGate === true,
    nativePresenterFocusSource: String(nativePresenterFocusPayload.source || ""),
    nativePresenterFocusSchema: Number(nativePresenterFocusPayload.schema || 0),
    nativePresenterFocusMechanism: String(nativePresenterFocusPayload.mechanism || ""),
    nativePresenterFocusAttempted: nativePresenterFocusPayload.attempted === true,
    nativePresenterFocusHandlePresent: nativePresenterFocusPayload.handlePresent === true,
    nativePresenterFocusHandleFormatValid: nativePresenterFocusPayload.handleFormatValid === true,
    nativePresenterFocusWindowValid: nativePresenterFocusPayload.windowValid === true,
    nativePresenterFocusWasForeground: nativePresenterFocusPayload.wasForeground === true,
    nativePresenterFocusSetForegroundResult: nativePresenterFocusPayload.setForegroundResult === true,
    nativePresenterFocused: nativePresenterFocusPayload.focused === true,
    nativePresenterFocusReason: String(nativePresenterFocusPayload.reason || ""),
    nativePresenterHandoffBranch: ownerHandoff.branch,
    nativePresenterHandoffAppEventCount: ownerHandoffEvents.length,
    nativePresenterHandoffAppEventSanitized: ownerHandoff.appEventSanitized,
    nativePresenterHandoffFocusPayloadSanitized: ownerHandoff.focusPayloadSanitized,
    nativePresenterHandoffAppEventBeforeProbeFocus: ownerHandoff.appEventBeforeProbeFocus,
    nativePresenterHandoffEvidenceValid: ownerHandoff.valid,
    nativePresenterHandoffRequestCount: ownerHandoff.requestCount,
    nativePresenterHandoffNativeShowCallCount: ownerHandoff.nativeShowCallCount,
    nativePresenterHandoffOwnerReportedForeground: ownerHandoff.ownerReportsForeground,
    nativePresenterHandoffSameWindow: ownerHandoff.sameWindowBeforeAfter,
    nativePresenterHandoffAppReason: ownerHandoff.appReason,
    nativePresenterHandoffChecks: ownerHandoff.checks,
    sameProcessUserGestureEvidenceValid: sameProcessUserGesture.valid,
    sameProcessUserGestureEvidencePresent: sameProcessUserGesture.evidencePresent,
    sameProcessUserGestureChecks: sameProcessUserGesture.checks,
    userGestureCompletionHandshakeValid: sameProcessUserGesture.completionHandshakeValid,
    userGestureGracefulShutdownValid: sameProcessUserGesture.gracefulShutdownValid,
    userGestureCompletionOrderValid: sameProcessUserGesture.completionOrderValid,
    userGestureReadyEventCount: userGestureReadyEvents.length,
    userGesturePreDispatchEventCount: normalizedEvents.filter(
      (event) => event.type === "probe:user-gesture-gate-pre-dispatch"
    ).length,
    userGestureActivationDispatchStartEventCount: normalizedEvents.filter(
      (event) => event.type === "probe:user-gesture-gate-activation-dispatch-start"
    ).length,
    userGestureActivationSentEventCount: userGestureActivationEvents.length,
    userGestureForegroundClearEventCount: normalizedEvents.filter(
      (event) => event.type === "probe:foreground-clear"
    ).length,
    userGestureConsumedProbeEventCount: userGestureConsumedProbeEvents.length,
    userGestureAppFocusReturnEventCount: userGestureFocusReturnEvents.length,
    externalForegroundSourceReadyEventCount: externalForegroundSourceReadyEvents.length,
    externalForegroundTransitionObservedEventCount: externalForegroundTransitionObservedEvents.length,
    externalForegroundTransitionNotRequiredEventCount:
      externalForegroundTransitionNotRequiredEvents.length,
    externalForegroundTransitionRejectedEventCount: externalForegroundTransitionRejectedEvents.length,
    externalForegroundTransitionEvidenceValid: sameProcessUserGesture.externalForegroundTransitionValid,
    externalForegroundReadyMarkerValid: sameProcessUserGesture.externalForegroundReadyMarkerValid,
    externalForegroundControllerAckValid: sameProcessUserGesture.externalForegroundControllerAckValid,
    externalForegroundControllerAcknowledgedEventCount:
      externalForegroundControllerAcknowledgedEvents.length,
    userGestureProbeRecordOrderValid: sameProcessUserGesture.probeRecordOrderValid,
    userGestureActivationPointerSucceeded: sameProcessUserGesture.activationPointerSucceeded,
    userGestureAppFocusReturnObserved: sameProcessUserGesture.focusReturnObserved,
    nativePresenterFocusBeforeInput:
      nativePresenterFocusIndex >= 0 && sentEventIndex > nativePresenterFocusIndex,
    nativePresenterFocusSanitized:
      Boolean(nativePresenterFocusEvent) && !containsRawNativeWindowHandle(nativePresenterFocusPayload),
    nativePresenterPreDispatchSource: String(nativePresenterPreDispatchPayload.source || ""),
    nativePresenterPreDispatchHandlePresent: nativePresenterPreDispatchPayload.handlePresent === true,
    nativePresenterPreDispatchWindowValid: nativePresenterPreDispatchPayload.windowValid === true,
    nativePresenterPreDispatchOwnerMatches: nativePresenterPreDispatchPayload.ownerMatches === true,
    nativePresenterPreDispatchEnabled: nativePresenterPreDispatchPayload.enabled === true,
    nativePresenterPreDispatchNotIconic: nativePresenterPreDispatchPayload.notIconic === true,
    nativePresenterPreDispatchFocused: nativePresenterPreDispatchPayload.focused === true,
    nativePresenterPreDispatchReason: String(nativePresenterPreDispatchPayload.reason || ""),
    nativePresenterPreDispatchSanitized:
      Boolean(sentEvent) && !containsRawNativeWindowHandle(nativePresenterPreDispatchPayload),
    dpiAwareness,
    processPerMonitorV2: /(?:^|;)process-per-monitor-v2(?:;|$)/.test(dpiAwareness),
    threadPerMonitorV2: /(?:^|;)thread-per-monitor-v2(?:;|$)/.test(dpiAwareness),
    nativePointerSent: Number(nativePointerSent.sent),
    nativePointerExpected: Number(nativePointerSent.expected),
    nativePointerLastError: Number(nativePointerSent.lastError),
    nativePointerMethod: String(nativePointerSent.method || ""),
    nativePointerSucceeded:
      Number(nativePointerSent.sent) === 3 &&
      Number(nativePointerSent.expected) === 3 &&
      Number(nativePointerSent.lastError) === 0,
    nativePointerMatchesTarget:
      Number(nativePointerSent.x) === targetX && Number(nativePointerSent.y) === targetY,
    webCloseTargetPresent: Number.isFinite(targetX) && Number.isFinite(targetY),
    webCloseTargetBeforeHandoff:
      targetEventIndex >= 0 && nativePresenterFocusIndex > targetEventIndex,
    webCloseTargetInsidePanel: targetInsidePanel,
    webCloseTargetUsesScaleAwareInsets: targetUsesScaleAwareInsets,
    webCloseScaleSource: String(loggedScale.source || ""),
    webCloseLoggedScale: Number.isFinite(loggedScaleValue) ? loggedScaleValue : null,
    webCloseDerivedScale: Number.isFinite(derivedScale) ? derivedScale : null,
    webCloseScaleAxesAgree: Boolean(presenterScaleGeometry && presenterScaleGeometry.axesAgree),
    webCloseScaleAgreement: scaleAgreement,
    webCloseScaleEvidence: scaleSourceSupported && scaleAgreement,
    nativeHostRectPresent: Boolean(nativeHostRect),
    physicalScreenshotBoundsCount: physicalScreenshots.declaredBoundsCount,
    physicalScreenshotReadableCount: physicalScreenshots.readableCount,
    physicalScreenshotDimensionsMatchCount: physicalScreenshots.dimensionsMatchCount,
    physicalScreenshotProofCount: physicalScreenshots.proofCount,
    screenshotContainsNativeHostRect: physicalScreenshots.containsNativeHostRect
  };
}

function summarizeSameProcessUserGestureHandoff({
  normalizedEvents,
  lifecycleEvents,
  nativePresenterFocusEvent,
  nativePresenterFocusPayload,
  userGestureReadyEvents,
  userGestureActivationEvents,
  userGestureConsumedProbeEvents,
  userGestureFocusReturnEvents,
  userGestureCompletion,
  fullLifecycleEvents,
  externalForegroundReadyMarker,
  externalForegroundControllerAck,
  externalForegroundSourceReadyEvents,
  externalForegroundControllerAcknowledgedEvents,
  externalForegroundTransitionObservedEvents,
  externalForegroundTransitionNotRequiredEvents,
  externalForegroundTransitionRejectedEvents,
  userGestureExpectation
}) {
  const expectedAction = String((userGestureExpectation && userGestureExpectation.action) || "");
  const expectedTargetId = String((userGestureExpectation && userGestureExpectation.targetId) || "");
  const expectedEvidenceSchemas = Array.isArray(userGestureExpectation?.evidenceSchemas)
    ? userGestureExpectation.evidenceSchemas
    : [];
  const lifecycle = Array.isArray(lifecycleEvents) ? lifecycleEvents.filter(Boolean) : [];
  const startPayload = objectOrEmpty(
    objectOrEmpty(normalizedEvents.find((event) => event.type === "probe:start")).payload
  );
  const evidenceSchema = Number.isInteger(startPayload.evidenceSchema)
    ? startPayload.evidenceSchema
    : 0;
  const completeLifecycle = Array.isArray(fullLifecycleEvents)
    ? fullLifecycleEvents.filter(Boolean)
    : [];
  const completion = objectOrEmpty(userGestureCompletion);
  const armedAppEvents = lifecycle.filter((event) =>
    ["autorun:user-gesture-gate-armed", "event:autorun:user-gesture-gate-armed"].includes(
      String((event && event.type) || "")
    )
  );
  const readyAppEvents = lifecycle.filter((event) =>
    ["autorun:user-gesture-gate-ready", "event:autorun:user-gesture-gate-ready"].includes(
      String((event && event.type) || "")
    )
  );
  const consumedAppEvents = lifecycle.filter((event) =>
    ["autorun:user-gesture-gate-consumed", "event:autorun:user-gesture-gate-consumed"].includes(
      String((event && event.type) || "")
    )
  );
  const rejectedAppEvents = lifecycle.filter((event) =>
    ["autorun:user-gesture-gate-rejected", "event:autorun:user-gesture-gate-rejected"].includes(
      String((event && event.type) || "")
    )
  );
  const armedAppEvent = armedAppEvents[0];
  const readyAppEvent = readyAppEvents[0];
  const consumedAppEvent = consumedAppEvents[0];
  const armedPayload = objectOrEmpty(armedAppEvent && armedAppEvent.payload);
  const readyPayload = objectOrEmpty(readyAppEvent && readyAppEvent.payload);
  const consumedPayload = objectOrEmpty(consumedAppEvent && consumedAppEvent.payload);
  const readyBinding = objectOrEmpty(readyPayload.binding);
  const readyTarget = objectOrEmpty(readyPayload.target);
  const readyViewport = objectOrEmpty(readyPayload.viewport);
  const consumedBinding = objectOrEmpty(consumedPayload.binding);
  const gesture = objectOrEmpty(consumedPayload.gesture);
  const readyProbeEvent = userGestureReadyEvents[0];
  const readyProbePayload = objectOrEmpty(readyProbeEvent && readyProbeEvent.payload);
  const readyProbeBinding = objectOrEmpty(readyProbePayload.binding);
  const readyProbeTarget = objectOrEmpty(readyProbePayload.target);
  const readyProbeDpi = objectOrEmpty(readyProbePayload.dpi);
  const activationEvent = userGestureActivationEvents[0];
  const activationPayload = objectOrEmpty(activationEvent && activationEvent.payload);
  const activationPointer = objectOrEmpty(activationPayload.nativePointerSent);
  const activationBinding = objectOrEmpty(activationPayload.binding);
  const activationDpi = objectOrEmpty(activationPayload.dpi);
  const activationTarget = objectOrEmpty(activationPayload.target);
  const focus = objectOrEmpty(nativePresenterFocusPayload);
  const focusBinding = objectOrEmpty(focus.binding);
  const focusGate = objectOrEmpty(focus.userGestureGate);
  const focusReturnEvent = userGestureFocusReturnEvents[0];
  const focusReturn = objectOrEmpty(focusReturnEvent && focusReturnEvent.payload);
  const consumedProbeEvent = userGestureConsumedProbeEvents[0];
  const consumedProbePayload = objectOrEmpty(consumedProbeEvent && consumedProbeEvent.payload);
  const externalSourceReadyEvent = externalForegroundSourceReadyEvents[0];
  const externalSourceReadyPayload = objectOrEmpty(
    externalSourceReadyEvent && externalSourceReadyEvent.payload
  );
  const externalSourceReadyBinding = objectOrEmpty(externalSourceReadyPayload.binding);
  const externalSourceReadyDpi = objectOrEmpty(externalSourceReadyPayload.dpi);
  const externalTransitionObservedEvent = externalForegroundTransitionObservedEvents[0];
  const externalTransitionObservedPayload = objectOrEmpty(
    externalTransitionObservedEvent && externalTransitionObservedEvent.payload
  );
  const externalTransitionObservedBinding = objectOrEmpty(
    externalTransitionObservedPayload.binding
  );
  const externalTransitionNotRequiredEvent = externalForegroundTransitionNotRequiredEvents[0];
  const externalTransitionNotRequiredPayload = objectOrEmpty(
    externalTransitionNotRequiredEvent && externalTransitionNotRequiredEvent.payload
  );
  const externalTransitionNotRequiredBinding = objectOrEmpty(
    externalTransitionNotRequiredPayload.binding
  );
  const externalReadyMarker = objectOrEmpty(externalForegroundReadyMarker);
  const externalControllerAck = objectOrEmpty(externalForegroundControllerAck);
  const externalControllerAcknowledgedEvent = externalForegroundControllerAcknowledgedEvents[0];
  const externalControllerAcknowledgedPayload = objectOrEmpty(
    externalControllerAcknowledgedEvent && externalControllerAcknowledgedEvent.payload
  );
  const preDispatchEvents = normalizedEvents.filter(
    (event) => event.type === "probe:user-gesture-gate-pre-dispatch"
  );
  const preDispatchEvent = preDispatchEvents[0];
  const preDispatchPayload = objectOrEmpty(preDispatchEvent && preDispatchEvent.payload);
  const preDispatchBinding = objectOrEmpty(preDispatchPayload.binding);
  const preDispatchTarget = objectOrEmpty(preDispatchPayload.target);
  const activationPreDispatch = objectOrEmpty(activationPayload.preDispatch);
  const activationPreDispatchBinding = objectOrEmpty(activationPreDispatch.binding);
  const activationPreDispatchTarget = objectOrEmpty(activationPreDispatch.target);
  const activationFinalDispatch = objectOrEmpty(activationPayload.finalDispatch);
  const activationFinalDispatchBinding = objectOrEmpty(activationFinalDispatch.binding);
  const activationFinalDispatchTarget = objectOrEmpty(activationFinalDispatch.target);
  const activationDispatchStartEvents = normalizedEvents.filter(
    (event) => event.type === "probe:user-gesture-gate-activation-dispatch-start"
  );
  const activationDispatchStartEvent = activationDispatchStartEvents[0];
  const activationDispatchStartPayload = objectOrEmpty(
    activationDispatchStartEvent && activationDispatchStartEvent.payload
  );
  const activationDispatchStartTarget = objectOrEmpty(activationDispatchStartPayload.target);
  const activationDispatchStartPreDispatch = objectOrEmpty(
    activationDispatchStartPayload.preDispatch
  );
  const activationDispatchStartPreDispatchBinding = objectOrEmpty(
    activationDispatchStartPreDispatch.binding
  );
  const activationDispatchStartPreDispatchTarget = objectOrEmpty(
    activationDispatchStartPreDispatch.target
  );
  const activationSkippedEvents = normalizedEvents.filter(
    (event) => event.type === "probe:user-gesture-gate-activation-skipped"
  );
  const foregroundClearEvents = normalizedEvents.filter(
    (event) => event.type === "probe:foreground-clear"
  );
  const resultWrittenEvents = completeLifecycle.filter((event) =>
    ["autorun:result-written", "event:autorun:result-written"].includes(String(event.type || ""))
  );
  const keepOpenEvents = completeLifecycle.filter((event) =>
    ["autorun:keep-open-after-result", "event:autorun:keep-open-after-result"].includes(
      String(event.type || "")
    )
  );
  const afterCloseStableEvents = completeLifecycle.filter((event) =>
    ["overlay:presenter-after-close-stable", "event:overlay:presenter-after-close-stable"].includes(
      String(event.type || "")
    )
  );
  const completionQuitEvents = completeLifecycle.filter((event) =>
    ["control:user-gesture-completion-quit", "event:control:user-gesture-completion-quit"].includes(
      String(event.type || "")
    )
  );
  const beforeQuitEvents = completeLifecycle.filter((event) => event.type === "app:before-quit");
  const willQuitEvents = completeLifecycle.filter((event) => event.type === "app:will-quit");
  const processExitEvents = completeLifecycle.filter((event) => event.type === "process:exit");
  const appQuitEvents = completeLifecycle.filter((event) => event.type === "app:quit");
  const processSignalEvents = completeLifecycle.filter((event) => event.type === "process:signal");
  const fullLifecycleFatalEvents = completeLifecycle.filter((event) =>
    FATAL_LIFECYCLE_EVENT_TYPES.has(String((event && event.type) || ""))
  );
  const evidencePresent = Boolean(
    evidenceSchema === 3 ||
      startPayload.userGestureGate === true ||
      startPayload.foregroundHandoff === SAME_PROCESS_USER_GESTURE_HANDOFF ||
      startPayload.externalForegroundTransition === EXTERNAL_FOREGROUND_TRANSITION ||
      armedAppEvents.length > 0 ||
      readyAppEvents.length > 0 ||
      consumedAppEvents.length > 0 ||
      rejectedAppEvents.length > 0 ||
      userGestureReadyEvents.length > 0 ||
      userGestureActivationEvents.length > 0 ||
      userGestureConsumedProbeEvents.length > 0 ||
      userGestureFocusReturnEvents.length > 0 ||
      externalForegroundSourceReadyEvents.length > 0 ||
      externalForegroundControllerAcknowledgedEvents.length > 0 ||
      externalForegroundTransitionObservedEvents.length > 0 ||
      externalForegroundTransitionNotRequiredEvents.length > 0 ||
      externalForegroundTransitionRejectedEvents.length > 0 ||
      focus.mechanism === "same-process-user-gesture" ||
      focusGate.required === true ||
      Object.keys(completion).length > 0 ||
      Object.keys(externalReadyMarker).length > 0 ||
      Object.keys(externalControllerAck).length > 0 ||
      completionQuitEvents.length > 0
  );

  const readyGeometry = [
    readyTarget.left,
    readyTarget.top,
    readyTarget.width,
    readyTarget.height,
    readyViewport.width,
    readyViewport.height,
    readyViewport.devicePixelRatio
  ];
  const readyGeometryValid = Boolean(
    readyGeometry.every(Number.isFinite) &&
      readyTarget.left >= 0 &&
      readyTarget.top >= 0 &&
      readyTarget.width > 0 &&
      readyTarget.height > 0 &&
      readyViewport.width > 0 &&
      readyViewport.height > 0 &&
      readyTarget.left + readyTarget.width <= readyViewport.width &&
      readyTarget.top + readyTarget.height <= readyViewport.height &&
      readyViewport.devicePixelRatio >= 0.5 &&
      readyViewport.devicePixelRatio <= 8
  );

  const expectationValid = Boolean(
    expectedAction && expectedTargetId && expectedEvidenceSchemas.includes(evidenceSchema)
  );
  const armedShapeValid = Boolean(
    expectationValid &&
      armedPayload.action === expectedAction &&
      !containsRawForegroundHandoffIdentifier(armedPayload)
  );
  const readyShapeValid = Boolean(
    readyPayload.schema === 1 &&
      readyPayload.mechanism === "same-process-user-gesture" &&
      readyPayload.action === expectedAction &&
      readyPayload.targetId === expectedTargetId &&
      readyPayload.ready === true &&
      readyBinding.senderMatches === true &&
      readyBinding.mainFrameMatches === true &&
      readyBinding.nonceMatches === true &&
      readyGeometryValid
  );
  const consumedShapeValid = Boolean(
    consumedPayload.schema === 1 &&
      consumedPayload.mechanism === "same-process-user-gesture" &&
      consumedPayload.action === expectedAction &&
      consumedPayload.targetId === expectedTargetId &&
      consumedPayload.consumed === true &&
      consumedPayload.consumeCount === 1 &&
      consumedBinding.senderMatches === true &&
      consumedBinding.mainFrameMatches === true &&
      consumedBinding.nonceMatches === true &&
      gesture.trusted === true &&
      gesture.userActivationActive === true &&
      gesture.leftButton === true &&
      gesture.singleClick === true
  );
  const appPayloadsSanitized = Boolean(
    armedAppEvent &&
      readyAppEvent &&
      consumedAppEvent &&
      !containsRawForegroundHandoffIdentifier(armedPayload) &&
      !containsRawForegroundHandoffIdentifier(readyPayload) &&
      !containsRawForegroundHandoffIdentifier(consumedPayload)
  );
  const hasExactKeys = (value, expectedKeys) =>
    JSON.stringify(Object.keys(objectOrEmpty(value)).sort()) ===
    JSON.stringify([...expectedKeys].sort());
  const sourceResolverBindingKeys = [
    "ownerMatchesLifecycleProcess",
    "sameInteractiveSession",
    "sourceMatchesBoundProcessIdentity",
    "sourceMatchesBoundWindow",
    "sourceMatchesControlProcess",
    "sourceProcessIdentityPresent",
    "sourceProcessPresent",
    "sourceWindowEnabled",
    "sourceWindowForeground",
    "sourceWindowNotIconic",
    "sourceWindowPresent"
  ];
  const sourceDpiKeys = [
    "clientGeometryAgrees",
    "rendererScale",
    "rendererScalePresent",
    "scaleAgrees",
    "windowDpiPresent",
    "windowScale"
  ];
  const confirmedSourceBindingKeys = [
    "pointOwnerMatchesBoundProcess",
    "pointRootMatchesSourceWindow",
    "pointWindowPresent",
    "sameInteractiveSession",
    "sourceMatchesBoundProcess",
    "sourceMatchesBoundProcessIdentity",
    "sourceMatchesBoundWindow",
    "sourceMatchesControlProcess",
    "sourceOwnerPresent",
    "sourceWindowEnabled",
    "sourceWindowForeground",
    "sourceWindowNotIconic",
    "sourceWindowValid",
    "targetInsideSourceClient"
  ];
  const sourceResolverBindingValid = (binding, expectedForeground) =>
    Boolean(
      binding.sourceProcessPresent === true &&
        binding.sourceProcessIdentityPresent === true &&
        binding.sourceWindowPresent === true &&
        binding.ownerMatchesLifecycleProcess === true &&
        binding.sourceMatchesControlProcess === true &&
        binding.sourceMatchesBoundWindow === true &&
        binding.sourceMatchesBoundProcessIdentity === true &&
        binding.sameInteractiveSession === true &&
        binding.sourceWindowEnabled === true &&
        binding.sourceWindowNotIconic === true &&
        binding.sourceWindowForeground === expectedForeground
    );
  const sourceDpiValid = (dpi) =>
    Boolean(
      dpi.rendererScalePresent === true &&
        dpi.windowDpiPresent === true &&
        dpi.scaleAgrees === true &&
        dpi.clientGeometryAgrees === true &&
        Number.isFinite(dpi.rendererScale) &&
        Number.isFinite(dpi.windowScale) &&
        dpi.rendererScale >= 0.5 &&
        dpi.rendererScale <= 8 &&
        dpi.windowScale >= 0.5 &&
        dpi.windowScale <= 8 &&
        dpi.rendererScale === readyViewport.devicePixelRatio &&
        Math.abs(dpi.rendererScale - dpi.windowScale) <= WINDOWS_CLOSE_SCALE_TOLERANCE
    );
  const observedBindingValid = Boolean(
    externalTransitionObservedBinding.sourceWindowValid === true &&
      externalTransitionObservedBinding.sourceOwnerPresent === true &&
      externalTransitionObservedBinding.sourceMatchesBoundProcess === true &&
      externalTransitionObservedBinding.sourceMatchesBoundProcessIdentity === true &&
      externalTransitionObservedBinding.sourceMatchesBoundWindow === true &&
      externalTransitionObservedBinding.sourceMatchesControlProcess === true &&
      externalTransitionObservedBinding.sameInteractiveSession === true &&
      externalTransitionObservedBinding.sourceWindowEnabled === true &&
      externalTransitionObservedBinding.sourceWindowNotIconic === true &&
      externalTransitionObservedBinding.targetInsideSourceClient === true &&
      externalTransitionObservedBinding.pointWindowPresent === true &&
      externalTransitionObservedBinding.pointOwnerMatchesBoundProcess === true &&
      externalTransitionObservedBinding.pointRootMatchesSourceWindow === true &&
      externalTransitionObservedBinding.sourceWindowForeground === true
  );
  const externalSourceReadyValid = Boolean(
    externalForegroundSourceReadyEvents.length === 1 &&
      externalSourceReadyPayload.schema === 1 &&
      externalSourceReadyPayload.mechanism === EXTERNAL_FOREGROUND_TRANSITION &&
      externalSourceReadyPayload.action === expectedAction &&
      externalSourceReadyPayload.requestOrdinal === 1 &&
      externalSourceReadyPayload.sourceBound === true &&
      externalSourceReadyPayload.transitionHookReady === true &&
      externalSourceReadyPayload.targetReady === true &&
      externalSourceReadyPayload.activationInputCount === 0 &&
      externalSourceReadyPayload.closeInputCount === 0 &&
      hasExactKeys(externalSourceReadyPayload, [
        "action",
        "activationInputCount",
        "binding",
        "closeInputCount",
        "dpi",
        "mechanism",
        "requestOrdinal",
        "schema",
        "sourceBound",
        "targetReady",
        "transitionHookReady"
      ]) &&
      hasExactKeys(externalSourceReadyBinding, sourceResolverBindingKeys) &&
      hasExactKeys(externalSourceReadyDpi, sourceDpiKeys) &&
      sourceResolverBindingValid(externalSourceReadyBinding, false) &&
      sourceDpiValid(externalSourceReadyDpi) &&
      !containsRawForegroundHandoffIdentifier(externalSourceReadyPayload)
  );
  const externalTransitionObservedValid = Boolean(
    externalForegroundTransitionObservedEvents.length === 1 &&
      externalTransitionObservedPayload.schema === 1 &&
      externalTransitionObservedPayload.mechanism === EXTERNAL_FOREGROUND_TRANSITION &&
      externalTransitionObservedPayload.action === expectedAction &&
      externalTransitionObservedPayload.requestOrdinal === 1 &&
      externalTransitionObservedPayload.transitionObserved === true &&
      externalTransitionObservedPayload.eventCount === 1 &&
      externalTransitionObservedPayload.hookStopped === true &&
      externalTransitionObservedPayload.hookErrorPresent === false &&
      externalTransitionObservedPayload.activationInputCount === 0 &&
      externalTransitionObservedPayload.closeInputCount === 0 &&
      hasExactKeys(externalTransitionObservedPayload, [
        "action",
        "activationInputCount",
        "binding",
        "closeInputCount",
        "eventCount",
        "hookErrorPresent",
        "hookStopped",
        "mechanism",
        "requestOrdinal",
        "schema",
        "transitionObserved"
      ]) &&
      hasExactKeys(externalTransitionObservedBinding, confirmedSourceBindingKeys) &&
      observedBindingValid &&
      !containsRawForegroundHandoffIdentifier(externalTransitionObservedPayload)
  );
  const externalReadyMarkerKeys = [
    "action",
    "activationInputCount",
    "challenge",
    "closeInputCount",
    "kind",
    "mechanism",
    "requestOrdinal",
    "schema",
    "sourceBound",
    "transitionHookReady"
  ];
  const externalForegroundReadyMarkerValid = Boolean(
    externalForegroundReadyMarker &&
      JSON.stringify(Object.keys(externalReadyMarker).sort()) ===
        JSON.stringify(externalReadyMarkerKeys) &&
      externalReadyMarker.kind === "steam-bridge-windows-external-foreground-ready" &&
      externalReadyMarker.schema === 1 &&
      externalReadyMarker.action === expectedAction &&
      externalReadyMarker.requestOrdinal === 1 &&
      externalReadyMarker.mechanism === EXTERNAL_FOREGROUND_TRANSITION &&
      typeof externalReadyMarker.challenge === "string" &&
      /^[0-9a-f]{32}$/.test(externalReadyMarker.challenge) &&
      externalReadyMarker.sourceBound === true &&
      externalReadyMarker.transitionHookReady === true &&
      externalReadyMarker.activationInputCount === 0 &&
      externalReadyMarker.closeInputCount === 0 &&
      !containsRawForegroundHandoffIdentifier(externalReadyMarker)
  );
  const externalForegroundControllerAckValid = Boolean(
    externalForegroundControllerAck &&
      hasExactKeys(externalControllerAck, [
        "action",
        "activationInputCount",
        "challenge",
        "clickCompleted",
        "closeInputCount",
        "kind",
        "mechanism",
        "requestOrdinal",
        "schema"
      ]) &&
      externalControllerAck.kind === "steam-bridge-windows-external-foreground-ack" &&
      externalControllerAck.schema === 1 &&
      externalControllerAck.action === expectedAction &&
      externalControllerAck.requestOrdinal === 1 &&
      externalControllerAck.mechanism === EXTERNAL_FOREGROUND_TRANSITION &&
      externalControllerAck.challenge === externalReadyMarker.challenge &&
      externalControllerAck.clickCompleted === true &&
      externalControllerAck.activationInputCount === 0 &&
      externalControllerAck.closeInputCount === 0 &&
      !containsRawForegroundHandoffIdentifier(externalControllerAck)
  );
  const externalForegroundControllerAcknowledgedValid = Boolean(
    externalForegroundControllerAcknowledgedEvents.length === 1 &&
      hasExactKeys(externalControllerAcknowledgedPayload, [
        "action",
        "activationInputCount",
        "clickCompleted",
        "closeInputCount",
        "controllerAckValid",
        "markerWritten",
        "mechanism",
        "requestOrdinal",
        "schema"
      ]) &&
      externalControllerAcknowledgedPayload.schema === 1 &&
      externalControllerAcknowledgedPayload.mechanism === EXTERNAL_FOREGROUND_TRANSITION &&
      externalControllerAcknowledgedPayload.action === expectedAction &&
      externalControllerAcknowledgedPayload.requestOrdinal === 1 &&
      externalControllerAcknowledgedPayload.markerWritten === true &&
      externalControllerAcknowledgedPayload.controllerAckValid === true &&
      externalControllerAcknowledgedPayload.clickCompleted === true &&
      externalControllerAcknowledgedPayload.activationInputCount === 0 &&
      externalControllerAcknowledgedPayload.closeInputCount === 0 &&
      !containsRawForegroundHandoffIdentifier(externalControllerAcknowledgedPayload)
  );
  const externalTransitionNotRequiredValid = Boolean(
    externalForegroundTransitionNotRequiredEvents.length === 1 &&
      externalTransitionNotRequiredPayload.schema === 1 &&
      externalTransitionNotRequiredPayload.mechanism === EXTERNAL_FOREGROUND_TRANSITION &&
      externalTransitionNotRequiredPayload.action === expectedAction &&
      externalTransitionNotRequiredPayload.requestOrdinal === 0 &&
      externalTransitionNotRequiredPayload.alreadyForeground === true &&
      externalTransitionNotRequiredPayload.activationInputCount === 0 &&
      externalTransitionNotRequiredPayload.closeInputCount === 0 &&
      hasExactKeys(externalTransitionNotRequiredPayload, [
        "action",
        "activationInputCount",
        "alreadyForeground",
        "binding",
        "closeInputCount",
        "mechanism",
        "requestOrdinal",
        "schema"
      ]) &&
      hasExactKeys(externalTransitionNotRequiredBinding, sourceResolverBindingKeys) &&
      sourceResolverBindingValid(externalTransitionNotRequiredBinding, true) &&
      !containsRawForegroundHandoffIdentifier(externalTransitionNotRequiredPayload)
  );
  const requestedExternalTransitionBranchValid = Boolean(
    externalSourceReadyValid &&
      externalForegroundControllerAckValid &&
      externalForegroundControllerAcknowledgedValid &&
      externalTransitionObservedValid &&
      externalForegroundReadyMarkerValid &&
      externalForegroundTransitionNotRequiredEvents.length === 0 &&
      externalForegroundTransitionRejectedEvents.length === 0
  );
  const alreadyForegroundBranchValid = Boolean(
    externalForegroundSourceReadyEvents.length === 0 &&
      externalForegroundControllerAcknowledgedEvents.length === 0 &&
      externalForegroundTransitionObservedEvents.length === 0 &&
      externalForegroundTransitionRejectedEvents.length === 0 &&
      !externalForegroundReadyMarker &&
      !externalForegroundControllerAck &&
      externalTransitionNotRequiredValid
  );
  const legacyExternalTransitionAbsent = Boolean(
    evidenceSchema === 2 &&
      externalForegroundSourceReadyEvents.length === 0 &&
      externalForegroundTransitionObservedEvents.length === 0 &&
      externalForegroundTransitionNotRequiredEvents.length === 0 &&
      externalForegroundTransitionRejectedEvents.length === 0 &&
      externalForegroundControllerAcknowledgedEvents.length === 0 &&
      !externalForegroundReadyMarker &&
      !externalForegroundControllerAck
  );
  const externalForegroundTransitionValid =
    evidenceSchema === 3
      ? requestedExternalTransitionBranchValid !== alreadyForegroundBranchValid
      : legacyExternalTransitionAbsent;
  const readyProbeValid = Boolean(
    userGestureReadyEvents.length === 1 &&
      readyProbePayload.ready === true &&
      readyProbePayload.reason === "gate-target-ready" &&
      readyProbeBinding.sourceProcessPresent === true &&
      readyProbeBinding.sourceWindowPresent === true &&
      readyProbeBinding.ownerMatchesLifecycleProcess === true &&
      readyProbeBinding.sourceMatchesControlProcess === true &&
      (evidenceSchema === 2 ||
        (readyProbeBinding.sourceProcessIdentityPresent === true &&
          readyProbeBinding.sourceMatchesBoundWindow === true &&
          readyProbeBinding.sourceMatchesBoundProcessIdentity === true)) &&
      readyProbeBinding.sameInteractiveSession === true &&
      readyProbeBinding.sourceWindowEnabled === true &&
      readyProbeBinding.sourceWindowNotIconic === true &&
      readyProbeBinding.sourceWindowForeground === true &&
      readyProbeTarget.source === "renderer-button-physical-dpi" &&
      readyProbeTarget.insideSourceClient === true &&
      readyProbeDpi.rendererScalePresent === true &&
      readyProbeDpi.windowDpiPresent === true &&
      readyProbeDpi.scaleAgrees === true &&
      readyProbeDpi.clientGeometryAgrees === true &&
      Number.isInteger(readyProbeTarget.x) &&
      Number.isInteger(readyProbeTarget.y) &&
      Number.isFinite(readyProbeDpi.rendererScale) &&
      Number.isFinite(readyProbeDpi.windowScale) &&
      readyProbeDpi.rendererScale >= 0.5 &&
      readyProbeDpi.rendererScale <= 8 &&
      readyProbeDpi.windowScale >= 0.5 &&
      readyProbeDpi.windowScale <= 8 &&
      readyProbeDpi.rendererScale === readyViewport.devicePixelRatio &&
      Math.abs(readyProbeDpi.rendererScale - readyProbeDpi.windowScale) <=
        WINDOWS_CLOSE_SCALE_TOLERANCE
  );
  const preDispatchShapeValid = (payload, binding) => {
    const reboundTarget = objectOrEmpty(payload.target);
    const rendererGeometry = objectOrEmpty(payload.rendererGeometry);
    const rendererTarget = objectOrEmpty(rendererGeometry.target);
    const rendererViewport = objectOrEmpty(rendererGeometry.viewport);
    const dpi = objectOrEmpty(payload.dpi);
    const clientGeometry = objectOrEmpty(payload.clientGeometry);
    const rendererGeometryMatchesReady = Boolean(
      rendererTarget.left === readyTarget.left &&
        rendererTarget.top === readyTarget.top &&
        rendererTarget.width === readyTarget.width &&
        rendererTarget.height === readyTarget.height &&
        rendererViewport.width === readyViewport.width &&
        rendererViewport.height === readyViewport.height &&
        rendererViewport.devicePixelRatio === readyViewport.devicePixelRatio
    );
    const clientGeometryValid = Boolean(
      Number.isInteger(clientGeometry.originX) &&
        Number.isInteger(clientGeometry.originY) &&
        Number.isInteger(clientGeometry.width) &&
        Number.isInteger(clientGeometry.height) &&
        clientGeometry.width > 0 &&
        clientGeometry.height > 0
    );
    const expectedX = roundMidpointToEven(
      clientGeometry.originX + (readyTarget.left + readyTarget.width / 2) * dpi.windowScale
    );
    const expectedY = roundMidpointToEven(
      clientGeometry.originY + (readyTarget.top + readyTarget.height / 2) * dpi.windowScale
    );
    const expectedClientWidth = readyViewport.width * dpi.windowScale;
    const expectedClientHeight = readyViewport.height * dpi.windowScale;
    const clientGeometryMatchesReady = Boolean(
      clientGeometryValid &&
        Number.isFinite(expectedClientWidth) &&
        Number.isFinite(expectedClientHeight) &&
        Math.abs(clientGeometry.width - expectedClientWidth) <= 2 &&
        Math.abs(clientGeometry.height - expectedClientHeight) <= 2
    );
    const reboundMathValid = Boolean(
      clientGeometryValid &&
        Number.isFinite(expectedX) &&
        Number.isFinite(expectedY) &&
        reboundTarget.x === expectedX &&
        reboundTarget.y === expectedY &&
        reboundTarget.x >= clientGeometry.originX &&
        reboundTarget.x < clientGeometry.originX + clientGeometry.width &&
        reboundTarget.y >= clientGeometry.originY &&
        reboundTarget.y < clientGeometry.originY + clientGeometry.height
    );
    return Boolean(
      payload.eligible === true &&
        payload.reason === "gate-source-window-confirmed-before-dispatch" &&
        binding.sourceWindowValid === true &&
        binding.sourceOwnerPresent === true &&
        binding.sourceMatchesBoundProcess === true &&
        (evidenceSchema === 2 || binding.sourceMatchesBoundProcessIdentity === true) &&
        binding.sourceMatchesBoundWindow === true &&
        binding.sourceMatchesControlProcess === true &&
        binding.sameInteractiveSession === true &&
        binding.sourceWindowEnabled === true &&
        binding.sourceWindowNotIconic === true &&
        binding.targetInsideSourceClient === true &&
        binding.pointWindowPresent === true &&
        binding.pointOwnerMatchesBoundProcess === true &&
        binding.pointRootMatchesSourceWindow === true &&
        binding.sourceWindowForeground === true &&
        Number.isInteger(reboundTarget.x) &&
        Number.isInteger(reboundTarget.y) &&
        reboundTarget.source === "renderer-button-physical-dpi-rebound" &&
        reboundTarget.insideSourceClient === true &&
        reboundTarget.reboundFromReadyGeometry === true &&
        rendererGeometryMatchesReady &&
        clientGeometryMatchesReady &&
        reboundMathValid &&
        dpi.rendererScalePresent === true &&
        dpi.windowDpiPresent === true &&
        dpi.scaleAgrees === true &&
        dpi.clientGeometryAgrees === true &&
        Number.isFinite(dpi.rendererScale) &&
        Number.isFinite(dpi.windowScale) &&
        dpi.rendererScale >= 0.5 &&
        dpi.rendererScale <= 8 &&
        dpi.windowScale >= 0.5 &&
        dpi.windowScale <= 8 &&
        dpi.rendererScale === readyViewport.devicePixelRatio &&
        Math.abs(dpi.rendererScale - dpi.windowScale) <= WINDOWS_CLOSE_SCALE_TOLERANCE
    );
  };
  const preDispatchValid = Boolean(
    preDispatchEvents.length === 1 &&
      preDispatchShapeValid(preDispatchPayload, preDispatchBinding) &&
      preDispatchShapeValid(activationPreDispatch, activationPreDispatchBinding) &&
      preDispatchTarget.x === activationPreDispatchTarget.x &&
      preDispatchTarget.y === activationPreDispatchTarget.y
  );
  const activationDispatchStartValid = Boolean(
    activationDispatchStartEvents.length === 1 &&
      activationDispatchStartPayload.input === "renderer-button-click-sendinput" &&
      activationDispatchStartPayload.readyEventCount === 1 &&
      activationDispatchStartPayload.consumedEventCount === 0 &&
      activationDispatchStartPayload.rejectedEventCount === 0 &&
      Number.isInteger(activationDispatchStartTarget.x) &&
      Number.isInteger(activationDispatchStartTarget.y) &&
      activationDispatchStartTarget.x === preDispatchTarget.x &&
      activationDispatchStartTarget.y === preDispatchTarget.y &&
      activationDispatchStartTarget.x === activationPreDispatchTarget.x &&
      activationDispatchStartTarget.y === activationPreDispatchTarget.y &&
      activationDispatchStartTarget.x === activationDispatchStartPreDispatchTarget.x &&
      activationDispatchStartTarget.y === activationDispatchStartPreDispatchTarget.y &&
      activationDispatchStartTarget.source === "renderer-button-physical-dpi-rebound" &&
      activationDispatchStartTarget.insideSourceClient === true &&
      activationDispatchStartTarget.reboundFromReadyGeometry === true &&
      preDispatchShapeValid(
        activationDispatchStartPreDispatch,
        activationDispatchStartPreDispatchBinding
      )
  );
  const activationPointerSucceeded = Boolean(
    userGestureActivationEvents.length === 1 &&
      activationPayload.input === "renderer-button-click-sendinput" &&
      activationPointer.sent === 3 &&
      activationPointer.expected === 3 &&
      activationPointer.lastError === 0 &&
      activationPointer.method === "sendinput" &&
      Number.isInteger(activationPointer.x) &&
      Number.isInteger(activationPointer.y) &&
      Number.isInteger(activationTarget.x) &&
      Number.isInteger(activationTarget.y) &&
      activationPointer.x === activationTarget.x &&
      activationPointer.y === activationTarget.y &&
      activationTarget.source === "renderer-button-physical-dpi-rebound" &&
      activationTarget.insideSourceClient === true &&
      activationTarget.reboundFromReadyGeometry === true &&
      activationTarget.x === activationFinalDispatchTarget.x &&
      activationTarget.y === activationFinalDispatchTarget.y
  );
  const finalDispatchValid = preDispatchShapeValid(
    activationFinalDispatch,
    activationFinalDispatchBinding
  );
  const activationBindingValid = Boolean(
    activationBinding.sourceProcessPresent === true &&
      activationBinding.sourceWindowPresent === true &&
      activationBinding.ownerMatchesLifecycleProcess === true &&
      activationBinding.sourceMatchesControlProcess === true &&
      (evidenceSchema === 2 ||
        (activationBinding.sourceProcessIdentityPresent === true &&
          activationBinding.sourceMatchesBoundWindow === true &&
          activationBinding.sourceMatchesBoundProcessIdentity === true)) &&
      activationBinding.sameInteractiveSession === true &&
      activationBinding.sourceWindowEnabled === true &&
      activationBinding.sourceWindowNotIconic === true &&
      activationBinding.sourceWindowForeground === true
  );
  const activationDpiValid = Boolean(
      activationDpi.rendererScalePresent === true &&
      activationDpi.windowDpiPresent === true &&
      activationDpi.scaleAgrees === true &&
      activationDpi.clientGeometryAgrees === true &&
      Number.isFinite(activationDpi.rendererScale) &&
      Number.isFinite(activationDpi.windowScale) &&
      activationDpi.rendererScale >= 0.5 &&
      activationDpi.rendererScale <= 8 &&
      activationDpi.windowScale >= 0.5 &&
      activationDpi.windowScale <= 8 &&
      activationDpi.rendererScale === readyViewport.devicePixelRatio &&
      activationDpi.rendererScale === readyProbeDpi.rendererScale &&
      activationDpi.windowScale === readyProbeDpi.windowScale &&
      Math.abs(activationDpi.rendererScale - activationDpi.windowScale) <=
        WINDOWS_CLOSE_SCALE_TOLERANCE
  );
  const consumedProbeValid = Boolean(
    userGestureConsumedProbeEvents.length === 1 &&
      consumedProbePayload.readyEventCount === 1 &&
      consumedProbePayload.consumedEventCount === 1 &&
      consumedProbePayload.rejectedEventCount === 0
  );
  const probePayloadsSanitized = Boolean(
    readyProbeEvent &&
      activationEvent &&
      consumedProbeEvent &&
      preDispatchEvent &&
      activationDispatchStartEvent &&
      !containsRawForegroundHandoffIdentifier(readyProbePayload) &&
      !containsRawForegroundHandoffIdentifier(activationPayload) &&
      !containsRawForegroundHandoffIdentifier(consumedProbePayload) &&
      !containsRawForegroundHandoffIdentifier(preDispatchPayload) &&
      !containsRawForegroundHandoffIdentifier(activationDispatchStartPayload)
  );
  const focusTransport = objectOrEmpty(focus.transport);
  const focusMessageDelta = objectOrEmpty(focus.messageDelta);
  const focusShapeValid = Boolean(
    focus.schema === 2 &&
      focus.source === "lifecycle-native-host" &&
      focus.mechanism === "same-process-user-gesture" &&
      focus.attempted === true &&
      focus.handlePresent === true &&
      focus.handleFormatValid === true &&
      focus.windowValid === true &&
      focus.wasForeground === true &&
      focusBinding.ownerThreadPresent === true &&
      focusBinding.lifecycleProcessPresent === true &&
      focusBinding.ownerMatchesLifecycleProcess === true &&
      focusBinding.ownerMatchesControlProcess === true &&
      focusBinding.sameInteractiveSession === true &&
      focus.setForegroundResult === false &&
      focusTransport.ready === true &&
      focusTransport.handoffOnly === true &&
      focusTransport.authenticated === false &&
      focusTransport.responseReceived === false &&
      focusTransport.responseSchemaValid === false &&
      Number.isInteger(focus.requestCount) &&
      focus.requestCount === 0 &&
      Number.isInteger(focus.requestOrdinal) &&
      focus.requestOrdinal === 0 &&
      Number.isInteger(focus.nativeShowCallCount) &&
      focus.nativeShowCallCount === 0 &&
      focus.nativeShowCompleted === false &&
      focus.requestedWindowMatches === false &&
      focus.sameWindowBeforeAfter === true &&
      focus.ownerReportsForeground === true &&
      focusMessageDelta.setFocus === 0 &&
      focusMessageDelta.activate === 0 &&
      focusMessageDelta.activateApp === 0 &&
      focus.focused === true &&
      focus.appReason === "foreground-confirmed-from-user-gesture" &&
      focus.reason === "foreground-confirmed" &&
      focusGate.required === true &&
      focusGate.readyEventCount === 1 &&
      focusGate.consumedEventCount === 1 &&
      focusGate.rejectedEventCount === 0 &&
      focusGate.activationInputCount === 1 &&
      focusGate.sourceWindowBound === true &&
      !containsRawForegroundHandoffIdentifier(focus)
  );
  const focusReturnObserved = Boolean(
    userGestureFocusReturnEvents.length === 1 &&
      focusReturn.observed === true &&
      focusReturn.lifecycleComplete === true &&
      focusReturn.sourceWindowValid === true &&
      focusReturn.ownerMatches === true &&
      focusReturn.sameInteractiveSession === true &&
      focusReturn.focused === true &&
      focusReturn.reason === "exact-source-window-foreground" &&
      !containsRawForegroundHandoffIdentifier(focusReturn)
  );

  const resultWrittenPayload = objectOrEmpty(
    resultWrittenEvents[0] && resultWrittenEvents[0].payload
  );
  const keepOpenPayload = objectOrEmpty(keepOpenEvents[0] && keepOpenEvents[0].payload);
  const completionQuitPayload = objectOrEmpty(
    completionQuitEvents[0] && completionQuitEvents[0].payload
  );
  const processExitPayload = objectOrEmpty(processExitEvents[0] && processExitEvents[0].payload);
  const appQuitPayload = objectOrEmpty(appQuitEvents[0] && appQuitEvents[0].payload);
  const completionHandshakeValid = Boolean(
    completion.schema === 1 &&
      completion.required === true &&
      completion.probeProcessExited === true &&
      completion.probeExitCode === 0 &&
      completion.probeLogPresent === true &&
      completion.probeParseErrorCount === 0 &&
      completion.completeEventCount === 1 &&
      completion.incompleteEventCount === 0 &&
      completion.timeoutEventCount === 0 &&
      completion.terminalEventCount === 1 &&
      completion.terminalExclusive === true &&
      completion.focusReturnEventCount === 1 &&
      completion.focusReturnObserved === true &&
      completion.controlDescriptorValid === true &&
      completion.controlHandoffOnly === true &&
      completion.controlProcessMatchesResult === true &&
      completion.quitAttempted === true &&
      completion.quitResponseOk === true &&
      completion.sourceProcessExited === true &&
      completion.ok === true &&
      !containsRawForegroundHandoffIdentifier(completion)
  );
  const gracefulShutdownValid = Boolean(
    resultWrittenEvents.length === 1 &&
      resultWrittenPayload.action === expectedAction &&
      resultWrittenPayload.resultFileWritten === true &&
      keepOpenEvents.length === 1 &&
      keepOpenPayload.action === expectedAction &&
      keepOpenPayload.resultFileWritten === true &&
      afterCloseStableEvents.length === 1 &&
      completionQuitEvents.length === 1 &&
      completionQuitPayload.action === expectedAction &&
      completionQuitPayload.resultFileWritten === true &&
      completionQuitPayload.gateConsumed === true &&
      !containsRawForegroundHandoffIdentifier(completionQuitPayload) &&
      beforeQuitEvents.length === 1 &&
      willQuitEvents.length === 1 &&
      processExitEvents.length === 1 &&
      processExitPayload.exitCode === 0 &&
      appQuitEvents.length === 1 &&
      appQuitPayload.exitCode === 0 &&
      processSignalEvents.length === 0 &&
      fullLifecycleFatalEvents.length === 0
  );

  const armedAt = Date.parse((armedAppEvent && armedAppEvent.at) || "");
  const readyAt = Date.parse((readyAppEvent && readyAppEvent.at) || "");
  const readyProbeAt = Date.parse((readyProbeEvent && readyProbeEvent.at) || "");
  const externalSourceReadyAt = Date.parse(
    (externalSourceReadyEvent && externalSourceReadyEvent.at) || ""
  );
  const externalTransitionObservedAt = Date.parse(
    (externalTransitionObservedEvent && externalTransitionObservedEvent.at) || ""
  );
  const externalControllerAcknowledgedAt = Date.parse(
    (externalControllerAcknowledgedEvent && externalControllerAcknowledgedEvent.at) || ""
  );
  const externalTransitionNotRequiredAt = Date.parse(
    (externalTransitionNotRequiredEvent && externalTransitionNotRequiredEvent.at) || ""
  );
  const preDispatchAt = Date.parse((preDispatchEvent && preDispatchEvent.at) || "");
  const activationDispatchStartAt = Date.parse(
    (activationDispatchStartEvent && activationDispatchStartEvent.at) || ""
  );
  const activationAt = Date.parse((activationEvent && activationEvent.at) || "");
  const consumedAt = Date.parse((consumedAppEvent && consumedAppEvent.at) || "");
  const consumedProbeAt = Date.parse((consumedProbeEvent && consumedProbeEvent.at) || "");
  const focusAt = Date.parse((nativePresenterFocusEvent && nativePresenterFocusEvent.at) || "");
  const sentEvent = normalizedEvents.find((event) => event.type === "probe:sent");
  const sentAt = Date.parse((sentEvent && sentEvent.at) || "");
  const focusReturnAt = Date.parse((focusReturnEvent && focusReturnEvent.at) || "");
  const resultWrittenAt = Date.parse((resultWrittenEvents[0] && resultWrittenEvents[0].at) || "");
  const keepOpenAt = Date.parse((keepOpenEvents[0] && keepOpenEvents[0].at) || "");
  const afterCloseStableAt = Date.parse(
    (afterCloseStableEvents[0] && afterCloseStableEvents[0].at) || ""
  );
  const completionQuitAt = Date.parse(
    (completionQuitEvents[0] && completionQuitEvents[0].at) || ""
  );
  const beforeQuitAt = Date.parse((beforeQuitEvents[0] && beforeQuitEvents[0].at) || "");
  const willQuitAt = Date.parse((willQuitEvents[0] && willQuitEvents[0].at) || "");
  const processExitAt = Date.parse((processExitEvents[0] && processExitEvents[0].at) || "");
  const appQuitAt = Date.parse((appQuitEvents[0] && appQuitEvents[0].at) || "");
  const lifecycleOrderValid = Boolean(
    [
      resultWrittenEvents[0],
      keepOpenEvents[0],
      afterCloseStableEvents[0],
      completionQuitEvents[0],
      beforeQuitEvents[0],
      willQuitEvents[0],
      processExitEvents[0],
      appQuitEvents[0]
    ].every((event) => completeLifecycle.indexOf(event) >= 0) &&
      completeLifecycle.indexOf(resultWrittenEvents[0]) < completeLifecycle.indexOf(keepOpenEvents[0]) &&
      completeLifecycle.indexOf(keepOpenEvents[0]) < completeLifecycle.indexOf(afterCloseStableEvents[0]) &&
      completeLifecycle.indexOf(afterCloseStableEvents[0]) <
        completeLifecycle.indexOf(completionQuitEvents[0]) &&
      completeLifecycle.indexOf(completionQuitEvents[0]) <
        completeLifecycle.indexOf(beforeQuitEvents[0]) &&
      completeLifecycle.indexOf(beforeQuitEvents[0]) < completeLifecycle.indexOf(willQuitEvents[0]) &&
      completeLifecycle.indexOf(willQuitEvents[0]) < completeLifecycle.indexOf(processExitEvents[0]) &&
      completeLifecycle.indexOf(willQuitEvents[0]) < completeLifecycle.indexOf(appQuitEvents[0])
  );
  const completionOrderValid = Boolean(
    [
      resultWrittenAt,
      keepOpenAt,
      afterCloseStableAt,
      focusReturnAt,
      completionQuitAt,
      beforeQuitAt,
      willQuitAt,
      processExitAt,
      appQuitAt
    ].every(Number.isFinite) &&
      lifecycleOrderValid &&
      resultWrittenAt <= keepOpenAt &&
      keepOpenAt <= focusReturnAt &&
      afterCloseStableAt <= focusReturnAt &&
      focusReturnAt <= completionQuitAt &&
      completionQuitAt <= beforeQuitAt &&
      beforeQuitAt <= willQuitAt &&
      willQuitAt <= processExitAt &&
      willQuitAt <= appQuitAt
  );
  const externalTransitionOrderValid = evidenceSchema === 2
    ? legacyExternalTransitionAbsent
    : requestedExternalTransitionBranchValid
      ? Boolean(
        [
          readyAt,
          externalSourceReadyAt,
          externalControllerAcknowledgedAt,
          externalTransitionObservedAt,
          readyProbeAt
        ].every(Number.isFinite) &&
          readyAt <= externalSourceReadyAt &&
          externalSourceReadyAt <= externalControllerAcknowledgedAt &&
          externalControllerAcknowledgedAt <= externalTransitionObservedAt &&
          externalTransitionObservedAt <= readyProbeAt
        )
      : alreadyForegroundBranchValid
        ? Boolean(
          [readyAt, externalTransitionNotRequiredAt, readyProbeAt].every(Number.isFinite) &&
            readyAt <= externalTransitionNotRequiredAt &&
            externalTransitionNotRequiredAt <= readyProbeAt
          )
        : false;
  const externalProbeRecordPrefix = evidenceSchema === 2
    ? []
    : requestedExternalTransitionBranchValid
      ? [
          externalSourceReadyEvent,
          externalControllerAcknowledgedEvent,
          externalTransitionObservedEvent
        ]
      : alreadyForegroundBranchValid
        ? [externalTransitionNotRequiredEvent]
        : [null];
  const probeRecordOrderEvents = [
    ...externalProbeRecordPrefix,
    readyProbeEvent,
    preDispatchEvent,
    activationDispatchStartEvent,
    activationEvent,
    consumedProbeEvent,
    nativePresenterFocusEvent,
    sentEvent,
    focusReturnEvent
  ];
  const probeRecordOrderValid = probeRecordOrderEvents.every((event, index) => {
    const eventIndex = normalizedEvents.indexOf(event);
    if (eventIndex < 0) {
      return false;
    }
    return index === 0 || normalizedEvents.indexOf(probeRecordOrderEvents[index - 1]) < eventIndex;
  });
  const orderValid = Boolean(
    [
      armedAt,
      readyAt,
      readyProbeAt,
      preDispatchAt,
      activationDispatchStartAt,
      activationAt,
      consumedAt,
      consumedProbeAt,
      focusAt,
      sentAt,
      focusReturnAt
    ].every(Number.isFinite) &&
      armedAt <= readyAt &&
      externalTransitionOrderValid &&
      probeRecordOrderValid &&
      readyAt <= readyProbeAt &&
      readyProbeAt <= preDispatchAt &&
      preDispatchAt <= activationDispatchStartAt &&
      activationDispatchStartAt <= activationAt &&
      activationDispatchStartAt <= consumedAt &&
      activationAt <= consumedProbeAt &&
      consumedAt <= consumedProbeAt &&
      consumedProbeAt <= focusAt &&
      focusAt <= sentAt &&
      sentAt <= focusReturnAt &&
      completionOrderValid
  );

  const checks = {
    expectationValid,
    armedAppEventCount: armedAppEvents.length === 1,
    readyAppEventCount: readyAppEvents.length === 1,
    consumedAppEventCount: consumedAppEvents.length === 1,
    rejectedAppEventCount: rejectedAppEvents.length === 0,
    externalForegroundTransitionValid,
    externalTransitionOrderValid,
    probeRecordOrderValid,
    readyProbeEventCount: userGestureReadyEvents.length === 1,
    preDispatchEventCount: preDispatchEvents.length === 1,
    activationDispatchStartEventCount: activationDispatchStartEvents.length === 1,
    activationProbeEventCount: userGestureActivationEvents.length === 1,
    activationSkippedEventCount: activationSkippedEvents.length === 0,
    foregroundClearEventCount: foregroundClearEvents.length === 0,
    consumedProbeEventCount: userGestureConsumedProbeEvents.length === 1,
    focusReturnEventCount: userGestureFocusReturnEvents.length === 1,
    armedShapeValid,
    readyShapeValid,
    consumedShapeValid,
    appPayloadsSanitized,
    readyProbeValid,
    preDispatchValid,
    activationDispatchStartValid,
    activationPointerSucceeded,
    finalDispatchValid,
    activationBindingValid,
    activationDpiValid,
    consumedProbeValid,
    probePayloadsSanitized,
    focusShapeValid,
    focusReturnObserved,
    completionHandshakeValid,
    gracefulShutdownValid,
    completionOrderValid,
    orderValid
  };
  return {
    valid: Object.values(checks).every(Boolean),
    evidencePresent,
    externalForegroundTransitionValid,
    externalForegroundReadyMarkerValid,
    externalForegroundControllerAckValid,
    activationPointerSucceeded,
    focusReturnObserved,
    completionHandshakeValid,
    gracefulShutdownValid,
    completionOrderValid,
    probeRecordOrderValid,
    checks
  };
}

function summarizeOwnerProcessForegroundHandoff(focusPayload, appEvents, focusEvent) {
  const focus = objectOrEmpty(focusPayload);
  const binding = objectOrEmpty(focus.binding);
  const transport = objectOrEmpty(focus.transport);
  const messageDelta = objectOrEmpty(focus.messageDelta);
  const normalizedAppEvents = Array.isArray(appEvents) ? appEvents.filter(Boolean) : [];
  const appEvent = normalizedAppEvents[0];
  const app = objectOrEmpty(appEvent && appEvent.payload);
  const appPrecondition = objectOrEmpty(app.precondition);
  const requestCount = Number(focus.requestCount);
  const nativeShowCallCount = Number(focus.nativeShowCallCount);
  const appEventSanitized = Boolean(appEvent) && !containsRawForegroundHandoffIdentifier(app);
  const focusPayloadSanitized = !containsRawForegroundHandoffIdentifier(focus);
  const appEventBeforeProbeFocus = Boolean(
    appEvent &&
      focusEvent &&
      Number.isFinite(Date.parse(appEvent.at)) &&
      Number.isFinite(Date.parse(focusEvent.at)) &&
      Date.parse(appEvent.at) <= Date.parse(focusEvent.at)
  );
  const commonBindingValid = Boolean(
    binding.ownerThreadPresent === true &&
      binding.lifecycleProcessPresent === true &&
      binding.ownerMatchesLifecycleProcess === true &&
      binding.sameInteractiveSession === true
  );
  const finiteMessageDelta = [messageDelta.setFocus, messageDelta.activate, messageDelta.activateApp].every(
    (value) => Number.isInteger(Number(value)) && Number(value) >= 0
  );
  const appShapeValid = Boolean(
    app.schema === 1 &&
      app.target === "lifecycle-native-host" &&
      app.mechanism === "owner-process-native-show" &&
      app.requestOrdinal === 1 &&
      app.requestedWindowMatches === true &&
      [0, 1].includes(Number(app.nativeShowCallCount)) &&
      app.sameWindowBeforeAfter === true &&
      app.ownerReportsForeground === true &&
      appPrecondition.windows === true &&
      appPrecondition.presenterActive === true &&
      appPrecondition.hostOpen === true &&
      appPrecondition.hostVisible === true &&
      appPrecondition.hostOpaque === true &&
      appPrecondition.inputPassthrough === false &&
      appPrecondition.requestedWindowPresent === true &&
      appPrecondition.requestedWindowMatches === true
  );
  const responseMatchesApp = Boolean(
    focus.requestOrdinal === app.requestOrdinal &&
      focus.requestedWindowMatches === app.requestedWindowMatches &&
      nativeShowCallCount === Number(app.nativeShowCallCount) &&
      focus.nativeShowCompleted === app.nativeShowCompleted &&
      focus.sameWindowBeforeAfter === app.sameWindowBeforeAfter &&
      focus.ownerReportsForeground === app.ownerReportsForeground &&
      focus.appReason === app.reason &&
      Number(messageDelta.setFocus) === Number(objectOrEmpty(app.messageDelta).setFocus) &&
      Number(messageDelta.activate) === Number(objectOrEmpty(app.messageDelta).activate) &&
      Number(messageDelta.activateApp) === Number(objectOrEmpty(app.messageDelta).activateApp)
  );
  const appNativeShowBranchValid = Boolean(
    (nativeShowCallCount === 0 &&
      appPrecondition.alreadyForeground === true &&
      app.nativeShowCompleted === false &&
      app.reason === "already-foreground") ||
      (nativeShowCallCount === 1 &&
        appPrecondition.alreadyForeground === false &&
        app.nativeShowCompleted === true &&
        app.reason === "foreground-confirmed")
  );
  const requestedValid = Boolean(
    requestCount === 1 &&
      normalizedAppEvents.length === 1 &&
      appEventSanitized &&
      focusPayloadSanitized &&
      appEventBeforeProbeFocus &&
      commonBindingValid &&
      binding.ownerMatchesControlProcess === true &&
      transport.ready === true &&
      transport.handoffOnly === true &&
      transport.authenticated === true &&
      transport.responseReceived === true &&
      transport.responseSchemaValid === true &&
      focus.requestOrdinal === 1 &&
      focus.requestedWindowMatches === true &&
      focus.sameWindowBeforeAfter === true &&
      focus.ownerReportsForeground === true &&
      focus.focused === true &&
      focus.reason === "foreground-confirmed" &&
      finiteMessageDelta &&
      appShapeValid &&
      responseMatchesApp &&
      appNativeShowBranchValid
  );

  return {
    branch: requestCount === 1 ? "owner-process-request" : "invalid",
    valid: requestedValid,
    appEventSanitized,
    focusPayloadSanitized,
    appEventBeforeProbeFocus,
    requestCount,
    nativeShowCallCount,
    ownerReportsForeground: focus.ownerReportsForeground === true,
    sameWindowBeforeAfter: focus.sameWindowBeforeAfter === true,
    appReason: String(focus.appReason || ""),
    checks: {
      appEventCount: normalizedAppEvents.length === 1,
      appEventSanitized,
      focusPayloadSanitized,
      appEventBeforeProbeFocus,
      commonBindingValid,
      controlOwnerMatches: binding.ownerMatchesControlProcess === true,
      transportValid:
        transport.ready === true &&
        transport.handoffOnly === true &&
        transport.authenticated === true &&
        transport.responseReceived === true &&
        transport.responseSchemaValid === true,
      appShapeValid,
      responseMatchesApp,
      appNativeShowBranchValid
    }
  };
}

function containsRawNativeWindowHandle(value) {
  if (typeof value === "string") {
    return /^0x[0-9a-f]+$/i.test(value);
  }
  if (Array.isArray(value)) {
    return value.some((entry) => containsRawNativeWindowHandle(entry));
  }
  if (!value || typeof value !== "object") {
    return false;
  }
  return Object.entries(value).some(([key, entry]) => {
    if (
      /(?:hwnd|windowhandle|nativehandle|^handle$)/i.test(key) &&
      (typeof entry === "string" || typeof entry === "number")
    ) {
      return true;
    }
    return containsRawNativeWindowHandle(entry);
  });
}

function containsRawForegroundHandoffIdentifier(value) {
  if (typeof value === "string") {
    return /^0x[0-9a-f]+$/i.test(value);
  }
  if (Array.isArray(value)) {
    return value.some((entry) => containsRawForegroundHandoffIdentifier(entry));
  }
  if (!value || typeof value !== "object") {
    return false;
  }
  return Object.entries(value).some(([key, entry]) => {
    const normalizedKey = String(key).replace(/[^a-z0-9]/gi, "").toLowerCase();
    const identifierKey =
      /(?:hwnd|handle|windowid|processid|threadid|sessionid|controlfile|filepath)$/.test(normalizedKey) ||
      /(?:processidentity|process(?:start|creation)(?:time|date|ticks|identity)|creation(?:time|date|ticks)|startticks)$/.test(
        normalizedKey
      ) ||
      ["pid", "port", "token", "nonce", "targetwindow", "requestedwindow", "path"].includes(normalizedKey);
    if (identifierKey && entry !== null && typeof entry !== "boolean") {
      return true;
    }
    return containsRawForegroundHandoffIdentifier(entry);
  });
}

function findNativeHostRect(nativePresenter, lifecycleEvents) {
  for (const presenter of presenterSnapshots(nativePresenter, lifecycleEvents)) {
    const rect = normalizeRect(objectOrEmpty(objectOrEmpty(presenter).nativeHostDiagnostics).rect);
    if (rect) {
      return rect;
    }
  }
  return null;
}

function findPresenterScaleGeometry(nativePresenter, lifecycleEvents) {
  let fallback = null;
  for (const presenter of presenterSnapshots(nativePresenter, lifecycleEvents)) {
    const physicalRect = normalizeRect(objectOrEmpty(objectOrEmpty(presenter).nativeHostDiagnostics).rect);
    const logicalBounds = normalizeRect(presenter.bounds);
    if (!physicalRect || !logicalBounds) {
      continue;
    }
    const scaleX = physicalRect.width / logicalBounds.width;
    const scaleY = physicalRect.height / logicalBounds.height;
    if (
      !Number.isFinite(scaleX) ||
      !Number.isFinite(scaleY) ||
      scaleX < 0.5 ||
      scaleX > 8 ||
      scaleY < 0.5 ||
      scaleY > 8
    ) {
      continue;
    }
    const geometry = {
      scaleX,
      scaleY,
      scale: (scaleX + scaleY) / 2,
      axesAgree: Math.abs(scaleX - scaleY) <= WINDOWS_CLOSE_SCALE_TOLERANCE
    };
    if (geometry.axesAgree) {
      return geometry;
    }
    fallback ||= geometry;
  }
  return fallback;
}

function presenterSnapshots(nativePresenter, lifecycleEvents) {
  const presenters = [];
  if (nativePresenter && typeof nativePresenter === "object" && !Array.isArray(nativePresenter)) {
    presenters.push(nativePresenter);
  }
  for (const event of Array.isArray(lifecycleEvents) ? lifecycleEvents : []) {
    const presenter = objectOrEmpty(event && event.payload).presenter;
    if (presenter && typeof presenter === "object" && !Array.isArray(presenter)) {
      presenters.push(presenter);
    }
  }
  return presenters;
}

function expectedWebCloseTarget(panel, loggedPanel, scale) {
  if (!panel || !Number.isFinite(scale) || scale < 0.5 || scale > 8) {
    return null;
  }
  const width = Number(loggedPanel.width);
  const height = Number(loggedPanel.height);
  if (
    !Number.isFinite(width) ||
    !Number.isFinite(height) ||
    width !== panel.width ||
    height !== panel.height
  ) {
    return null;
  }
  const rightInset = Math.min(
    Math.max(1, width - 1),
    Math.max(1, roundMidpointToEven(16 * scale))
  );
  const topInset = Math.min(
    Math.max(1, height - 1),
    Math.max(1, roundMidpointToEven(18 * scale))
  );
  return {
    x: roundMidpointToEven(panel.right - rightInset),
    y: roundMidpointToEven(panel.top + topInset),
    rightInset,
    topInset
  };
}

function summarizePhysicalScreenshotEvidence(events, caseDir, nativeHostRect) {
  let declaredBoundsCount = 0;
  let readableCount = 0;
  let dimensionsMatchCount = 0;
  let proofCount = 0;
  let containsNativeHostRect = false;
  for (const event of events) {
    const screenshot = objectOrEmpty(objectOrEmpty(event && event.payload).screenshot);
    const bounds = normalizeRect(screenshot.bounds);
    if (screenshot.ok !== true || !bounds) {
      continue;
    }
    declaredBoundsCount += 1;
    const resolved = resolveCloseProbeScreenshotPath(String(screenshot.path || ""), caseDir);
    if (!resolved) {
      continue;
    }
    let png;
    try {
      png = decodePng(resolved);
    } catch {
      continue;
    }
    readableCount += 1;
    const dimensionsMatch = png.width === bounds.width && png.height === bounds.height;
    if (dimensionsMatch) {
      dimensionsMatchCount += 1;
    }
    const contains = Boolean(nativeHostRect && rectContainsRect(bounds, nativeHostRect));
    if (contains) {
      containsNativeHostRect = true;
    }
    if (dimensionsMatch && contains) {
      proofCount += 1;
    }
  }
  return {
    declaredBoundsCount,
    readableCount,
    dimensionsMatchCount,
    proofCount,
    containsNativeHostRect
  };
}

function roundMidpointToEven(value) {
  const lower = Math.floor(value);
  const fraction = value - lower;
  if (Math.abs(fraction - 0.5) <= Number.EPSILON * Math.max(1, Math.abs(value)) * 4) {
    return lower % 2 === 0 ? lower : lower + 1;
  }
  return Math.round(value);
}

function normalizeRect(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  const left = Number(value.left !== undefined ? value.left : value.x);
  const top = Number(value.top !== undefined ? value.top : value.y);
  const width = Number(value.width);
  const height = Number(value.height);
  const right = Number(value.right !== undefined ? value.right : left + width);
  const bottom = Number(value.bottom !== undefined ? value.bottom : top + height);
  if (
    !Number.isFinite(left) ||
    !Number.isFinite(top) ||
    !Number.isFinite(right) ||
    !Number.isFinite(bottom) ||
    right <= left ||
    bottom <= top
  ) {
    return null;
  }
  return { left, top, right, bottom, width: right - left, height: bottom - top };
}

function rectContainsRect(outer, inner) {
  return (
    outer.left <= inner.left &&
    outer.top <= inner.top &&
    outer.right >= inner.right &&
    outer.bottom >= inner.bottom
  );
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
  const webCloseEvidence = closeProbe.input === "web-close-click-sendinput"
    ? `dpiPmV2=${closeProbe.processPerMonitorV2}/${closeProbe.threadPerMonitorV2} ` +
      `focus=${closeProbe.nativePresenterFocused}/${closeProbe.nativePresenterFocusBeforeInput} ` +
      `focusPreDispatch=${closeProbe.nativePresenterPreDispatchFocused} ` +
      `focusWindow=${closeProbe.nativePresenterFocusWindowValid} ` +
      `focusSet=${closeProbe.nativePresenterFocusSetForegroundResult} ` +
      `focusReason=${formatValue(closeProbe.nativePresenterFocusReason)} ` +
      `focusHandoff=${formatValue(closeProbe.nativePresenterHandoffBranch)}/${closeProbe.nativePresenterHandoffEvidenceValid} ` +
      `pointer=${closeProbe.nativePointerSent}/${closeProbe.nativePointerExpected}/${closeProbe.nativePointerLastError} ` +
      `targetInsidePanel=${closeProbe.webCloseTargetInsidePanel} ` +
      `targetScaleAware=${closeProbe.webCloseTargetUsesScaleAwareInsets} ` +
      `scale=${formatValue(closeProbe.webCloseLoggedScale)}/${formatValue(closeProbe.webCloseDerivedScale)} ` +
      `scaleSource=${formatValue(closeProbe.webCloseScaleSource)} scaleProof=${closeProbe.webCloseScaleEvidence} ` +
      `physicalScreens=${closeProbe.physicalScreenshotProofCount}/${closeProbe.physicalScreenshotBoundsCount} ` +
      `screenshotContainsHost=${closeProbe.screenshotContainsNativeHostRect} `
    : "";
  return (
    `closeProbe=${closeProbe.sent ? formatValue(closeProbe.input) : "not-sent"} ` +
    `closeProbeFg=${foreground} ` +
    `closeProbeScreens=${closeProbe.screenshotCount} ` +
    formatCloseProbeVisualSummary(closeProbe.screenshotVisuals) +
    webCloseEvidence +
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

function assertFixtureSummaryFailure(tempRoot, name, writeFixture, options, expectedFailure) {
  const root = path.join(tempRoot, name);
  writeFixture(root, options);
  const summary = summarizeWindowsOverlayMatrixArtifacts(root);
  assert(
    summary.failures.some((failure) => failure.includes(expectedFailure)),
    `summary self-test should reject ${name}: ${expectedFailure}`
  );
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

    const managedBackendRoot = path.join(tempRoot, "managed-backend");
    writeManagedBackendFixture(managedBackendRoot);
    const managedBackendSummary = summarizeWindowsOverlayMatrixArtifacts(managedBackendRoot);
    assert.deepEqual(managedBackendSummary.failures, []);
    assert.equal(managedBackendSummary.caseSummaries[0].presenterBackendEvidence.result.agrees, true);
    assert.equal(managedBackendSummary.caseSummaries[0].presenterBackendEvidence.lifecycleCompleteCount, 1);

    for (const [name, options, failure] of [
      ["wrong-result-renderer", { wrongResultRenderer: true }, "result renderer backend is windows-d3d11"],
      [
        "wrong-lifecycle-renderer",
        { wrongLifecycleRenderer: true },
        "lifecycle overlay:presenter-open-and-wait-start renderer backend is windows-d3d11"
      ]
    ]) {
      assertFixtureSummaryFailure(tempRoot, `managed-backend-${name}`, writeManagedBackendFixture, options, failure);
    }

    const passivePollingRoot = path.join(tempRoot, "passive-polling");
    writePassivePollingFixture(passivePollingRoot);
    const passivePollingSummary = summarizeWindowsOverlayMatrixArtifacts(passivePollingRoot);
    assert.deepEqual(passivePollingSummary.failures, []);
    assert.equal(passivePollingSummary.caseSummaries[0].passiveNotificationProof, true);
    assert.equal(passivePollingSummary.caseSummaries[0].passiveNotificationEvidence.falseToTrue, true);
    assertFixtureSummaryFailure(
      tempRoot,
      "passive-polling-missing-transition",
      writePassivePollingFixture,
      { omitTransition: true },
      "observed false-to-true needs-present"
    );
    assertFixtureSummaryFailure(
      tempRoot,
      "passive-polling-hot-full-diagnostics",
      writePassivePollingFixture,
      { hotFullDiagnostics: true },
      "no hot full-diagnostics loop"
    );
    assertFixtureSummaryFailure(
      tempRoot,
      "passive-polling-missing-counter",
      writePassivePollingFixture,
      { missingTransitionCounter: true },
      "records every split polling counter"
    );
    assertFixtureSummaryFailure(
      tempRoot,
      "passive-polling-wrong-renderer",
      writePassivePollingFixture,
      { wrongRenderer: true },
      "passive transition presenter agrees on windows-d3d11"
    );

    const persistentReuseRoot = path.join(tempRoot, "persistent-reuse");
    writePersistentReuseFixture(persistentReuseRoot);
    const persistentReuseSummary = summarizeWindowsOverlayMatrixArtifacts(persistentReuseRoot);
    assert.deepEqual(persistentReuseSummary.failures, []);
    assert.equal(persistentReuseSummary.caseSummaries[0].persistentReuseProof, true);
    assert.equal(persistentReuseSummary.caseSummaries[0].persistentReuseEvidence.cycles, 3);
    assert.equal(persistentReuseSummary.cleanup.processAfterOk, true);
    assert.equal(persistentReuseSummary.cleanup.launchEnvRollbackOk, true);
    assert.equal(persistentReuseSummary.cleanup.taskDeletionVerified, true);
    assert.equal(persistentReuseSummary.cleanup.taskRunnerGuardOk, true);
    assert.equal(persistentReuseSummary.cleanup.taskLaunchEnvGuardOk, true);
    assert.equal(persistentReuseSummary.cleanup.taskPackageProcessGuardOk, true);
    assert.equal(persistentReuseSummary.cleanup.taskFileGuardOk, true);
    assert.equal(persistentReuseSummary.cleanup.taskFailureStage, "success");
    assert.equal(persistentReuseSummary.cleanup.taskRunnerTerminatedWithoutDone, false);
    for (const [name, options, failure] of [
      ["changed-hwnd", { changedHostToken: true }, "reuses one native HWND"],
      ["second-attach", { secondAttach: true }, "has exactly one controller attach"],
      ["out-of-order-cycle", { outOfOrderCycle: true }, "persistent cycle 1 is ordered"],
      ["wrong-close-ordinal", { wrongCloseOrdinal: true }, "response matched its ordinal"],
      ["terminal-close-live", { terminalCloseStillAttached: true }, "final shutdown detached the presenter"],
      ["missing-after-cleanup", { omitAfterCleanup: true }, "after-cases package-process cleanup evidence"],
      ["cleanup-missing-creation-identity", { processCleanupMissingIdentity: true }, "captured each process creation identity"],
      ["cleanup-unknown-stop-outcome", { processCleanupUnknownStop: true }, "closed exact-handle stop outcome"],
      ["cleanup-duplicate-result-identity", { processCleanupDuplicateResult: true }, "accounts for each initial process identity exactly once"],
      ["rollback-failed", { rollbackFailed: true }, "launch-env rollback completed successfully"],
      ["rollback-byte-mismatch", { rollbackByteMismatch: true }, "restored launch env bytes match exactly"],
      ["task-delete-unverified", { taskDeletionUnverified: true }, "interactive task cleanup completed successfully"],
      ["task-delete-exit-uncaptured", { taskDeleteExitUncaptured: true }, "task deletion exit code was captured"],
      ["task-query-exit-uncaptured", { taskQueryExitUncaptured: true }, "task absence query completed with the expected missing-task exit code"],
      ["task-query-wrong-exit", { taskQueryWrongExit: true }, "task absence query completed with the expected missing-task exit code"],
      ["task-cleanup-phase-error", { taskCleanupPhaseError: true }, "cleanup phases completed without a suppressed exception"],
      ["task-runner-leftover", { taskRunnerLeftover: true }, "task wrapper runner-tree guard completed successfully"],
      ["task-runner-stop-counter-imbalance", { taskRootStopCounterImbalance: true }, "accounts for every exact-handle stop outcome"],
      ["task-runner-done-missing", { taskRunnerDoneMissing: true }, "completed without a runner or matrix failure"],
      ["task-live-deadline", { taskDeadlineTimeout: true }, "completed without a runner or matrix failure"],
      ["task-timeout-no-root-stop", { taskTimedOutNoRootStop: true }, "attempted exact verified runner-root termination before rollback"],
      ["task-guard-byte-mismatch", { taskGuardByteMismatch: true }, "task wrapper launch-env guard completed successfully"],
      ["task-process-leftover", { taskProcessLeftover: true }, "task wrapper package-process guard completed successfully"],
      ["task-files-left", { taskFilesLeft: true }, "task wrapper handoff-file cleanup completed successfully"]
    ]) {
      assertFixtureSummaryFailure(tempRoot, `persistent-reuse-${name}`, writePersistentReuseFixture, options, failure);
    }

    const webCloseEvidenceRoot = path.join(tempRoot, "managed-web-close-evidence");
    writeManagedWebCloseEvidenceFixture(webCloseEvidenceRoot);
    const webCloseEvidenceSummary = summarizeWindowsOverlayMatrixArtifacts(webCloseEvidenceRoot);
    assert.deepEqual(webCloseEvidenceSummary.failures, []);
    assert.equal(webCloseEvidenceSummary.caseSummaries[0].closeProbe.processPerMonitorV2, true);
    assert.equal(webCloseEvidenceSummary.caseSummaries[0].closeProbe.threadPerMonitorV2, true);
    assert.equal(webCloseEvidenceSummary.caseSummaries[0].closeProbe.nativePointerSucceeded, true);
    assert.equal(webCloseEvidenceSummary.caseSummaries[0].closeProbe.nativePresenterFocusEventCount, 1);
    assert.equal(webCloseEvidenceSummary.caseSummaries[0].closeProbe.nativePresenterFocusSanitized, true);
    assert.equal(webCloseEvidenceSummary.caseSummaries[0].closeProbe.nativePresenterFocused, true);
    assert.equal(webCloseEvidenceSummary.caseSummaries[0].closeProbe.nativePresenterFocusBeforeInput, true);
    assert.equal(webCloseEvidenceSummary.caseSummaries[0].closeProbe.nativePresenterPreDispatchFocused, true);
    assert.equal(webCloseEvidenceSummary.caseSummaries[0].closeProbe.nativePresenterPreDispatchSanitized, true);
    assert.equal(webCloseEvidenceSummary.caseSummaries[0].closeProbe.webCloseTargetInsidePanel, true);
    assert.equal(webCloseEvidenceSummary.caseSummaries[0].closeProbe.webCloseTargetUsesScaleAwareInsets, true);
    assert.equal(webCloseEvidenceSummary.caseSummaries[0].closeProbe.webCloseScaleEvidence, true);
    assert.equal(webCloseEvidenceSummary.caseSummaries[0].closeProbe.webCloseDerivedScale, 2.25);
    assert.equal(webCloseEvidenceSummary.caseSummaries[0].closeProbe.physicalScreenshotReadableCount, 1);
    assert.equal(webCloseEvidenceSummary.caseSummaries[0].closeProbe.physicalScreenshotDimensionsMatchCount, 1);
    assert.equal(webCloseEvidenceSummary.caseSummaries[0].closeProbe.physicalScreenshotProofCount, 1);
    assert.equal(webCloseEvidenceSummary.caseSummaries[0].closeProbe.screenshotContainsNativeHostRect, true);

    const ownerHandoffRoot = path.join(tempRoot, "managed-web-owner-handoff");
    writeManagedWebCloseEvidenceFixture(ownerHandoffRoot, { closeProbeEvidenceSchema: 2 });
    const ownerHandoffSummary = summarizeWindowsOverlayMatrixArtifacts(ownerHandoffRoot);
    assert.deepEqual(
      ownerHandoffSummary.failures,
      [],
      JSON.stringify(ownerHandoffSummary.caseSummaries[0].closeProbe, null, 2)
    );
    assert.equal(ownerHandoffSummary.caseSummaries[0].closeProbe.evidenceSchema, 2);
    assert.equal(
      ownerHandoffSummary.caseSummaries[0].closeProbe.nativePresenterHandoffBranch,
      "owner-process-request"
    );
    assert.equal(ownerHandoffSummary.caseSummaries[0].closeProbe.nativePresenterHandoffAppEventCount, 1);
    assert.equal(ownerHandoffSummary.caseSummaries[0].closeProbe.nativePresenterHandoffEvidenceValid, true);
    assert.equal(ownerHandoffSummary.caseSummaries[0].closeProbe.nativePointerMethod, "sendinput");

    const userGestureGateRoot = path.join(tempRoot, "managed-web-user-gesture-gate");
    writeManagedWebCloseEvidenceFixture(userGestureGateRoot, {
      userGestureGate: true
    });
    const userGestureGateSummary = summarizeWindowsOverlayMatrixArtifacts(userGestureGateRoot);
    assert.deepEqual(
      userGestureGateSummary.failures,
      [],
      JSON.stringify(userGestureGateSummary.caseSummaries[0].closeProbe, null, 2)
    );
    assert.equal(userGestureGateSummary.caseSummaries[0].closeProbe.evidenceSchema, 3);
    assert.equal(userGestureGateSummary.caseSummaries[0].closeProbe.userGestureGate, true);
    assert.equal(
      userGestureGateSummary.caseSummaries[0].closeProbe.foregroundHandoff,
      SAME_PROCESS_USER_GESTURE_HANDOFF
    );
    assert.equal(
      userGestureGateSummary.caseSummaries[0].closeProbe.sameProcessUserGestureEvidenceValid,
      true
    );
    assert.equal(
      userGestureGateSummary.caseSummaries[0].closeProbe.userGestureActivationSentEventCount,
      1
    );
    assert.equal(
      userGestureGateSummary.caseSummaries[0].closeProbe.userGestureAppFocusReturnObserved,
      true
    );
    assert.equal(
      userGestureGateSummary.caseSummaries[0].closeProbe.userGestureCompletionHandshakeValid,
      true
    );
    assert.equal(
      userGestureGateSummary.caseSummaries[0].closeProbe.userGestureGracefulShutdownValid,
      true
    );
    assert.equal(
      userGestureGateSummary.caseSummaries[0].closeProbe.userGestureCompletionOrderValid,
      true
    );
    assert.equal(
      userGestureGateSummary.caseSummaries[0].closeProbe.nativePresenterHandoffRequestCount,
      0
    );
    assert.equal(
      userGestureGateSummary.caseSummaries[0].closeProbe.nativePresenterHandoffNativeShowCallCount,
      0
    );
    assert.equal(
      userGestureGateSummary.caseSummaries[0].closeProbe.externalForegroundTransitionEvidenceValid,
      true
    );
    assert.equal(
      userGestureGateSummary.caseSummaries[0].closeProbe.externalForegroundReadyMarkerValid,
      true
    );
    assert.equal(
      userGestureGateSummary.caseSummaries[0].closeProbe.externalForegroundControllerAckValid,
      true
    );
    assert.equal(
      userGestureGateSummary.caseSummaries[0].closeProbe
        .externalForegroundControllerAcknowledgedEventCount,
      1
    );

    const duplicateUserGestureOptions = {
      caseId: "11b-managed-duplicate-open-guard",
      action: "presenter-duplicate-open-guard",
      userGestureGate: true
    };
    for (const [name, extraOptions] of [
      ["requested", {}],
      ["already-foreground", { alreadyForeground: true }],
      ["without-manifest", { omitManifest: true }]
    ]) {
      const root = path.join(tempRoot, `duplicate-open-user-gesture-${name}`);
      writeManagedWebCloseEvidenceFixture(root, {
        ...duplicateUserGestureOptions,
        ...extraOptions
      });
      const summary = summarizeWindowsOverlayMatrixArtifacts(root);
      assert.deepEqual(
        summary.failures,
        [],
        JSON.stringify(summary.caseSummaries[0], null, 2)
      );
      assert.equal(summary.caseSummaries[0].closeProbe.sameProcessUserGestureEvidenceValid, true);
      assert.equal(summary.caseSummaries[0].duplicateOpenGuardProof, true);
    }

    for (const [name, options, failure] of [
      [
        "coherent-web-evidence",
        {
          reportedUserGestureAction: "presenter-web-open-and-wait",
          reportedUserGestureTargetId: "presenter-web-wait"
        },
        "user-gesture evidence matches its exact case-owned action and target"
      ],
      [
        "web-target",
        { reportedUserGestureTargetId: "presenter-web-wait" },
        "user-gesture evidence matches its exact case-owned action and target"
      ],
      [
        "schema-2",
        { closeProbeEvidenceSchema: 2, legacyUserGestureSchema2: true },
        "uses its exact supported user-gesture action and evidence schema"
      ],
      [
        "requested-ordinal-two",
        { reportedExternalForegroundRequestOrdinal: 2 },
        "user-gesture evidence matches its exact case-owned action and target"
      ],
      [
        "no-manifest-coherent-web-evidence",
        {
          omitManifest: true,
          reportedUserGestureAction: "presenter-web-open-and-wait",
          reportedUserGestureTargetId: "presenter-web-wait"
        },
        "user-gesture evidence matches its exact case-owned action and target"
      ],
      [
        "no-manifest-result-action-mismatch",
        {
          omitManifest: true,
          reportedResultAction: "presenter-web-open-and-wait"
        },
        "result action matches its exact case-owned action"
      ],
      [
        "no-manifest-gate-declaration-false",
        { omitManifest: true, gestureStartGateFalse: true },
        "same-process user-gesture evidence explicitly declares its gate"
      ],
      [
        "manifest-case-schema-string",
        { manifestCaseSchemaString: true },
        "records an integer close-probe evidence schema"
      ],
      [
        "manifest-case-schema-null",
        { manifestCaseSchemaNull: true },
        "records an integer close-probe evidence schema"
      ],
      [
        "start-schema-string",
        { startSchemaString: true },
        `close probe uses schema-3 ${SAME_PROCESS_USER_GESTURE_HANDOFF}`
      ]
    ]) {
      assertFixtureSummaryFailure(
        tempRoot,
        `duplicate-open-user-gesture-${name}`,
        writeManagedWebCloseEvidenceFixture,
        { ...duplicateUserGestureOptions, ...options },
        failure
      );
    }
    assertFixtureSummaryFailure(
      tempRoot,
      "managed-web-user-gesture-coherent-duplicate-evidence",
      writeManagedWebCloseEvidenceFixture,
      {
        userGestureGate: true,
        reportedUserGestureAction: "presenter-duplicate-open-guard",
        reportedUserGestureTargetId: "presenter-duplicate-guard"
      },
      "user-gesture evidence matches its exact case-owned action and target"
    );
    assertFixtureSummaryFailure(
      tempRoot,
      "managed-web-schema-3-without-gate-or-manifest",
      writeManagedWebCloseEvidenceFixture,
      { closeProbeEvidenceSchema: 3, omitManifest: true },
      "same-process user-gesture evidence explicitly declares its gate"
    );
    assertFixtureSummaryFailure(
      tempRoot,
      "managed-web-schema-2-focus-claim-without-gate-or-manifest",
      writeManagedWebCloseEvidenceFixture,
      {
        closeProbeEvidenceSchema: 2,
        legacyUserGestureSchema2: true,
        userGestureGate: true,
        stripGestureEvidenceExceptFocus: true,
        omitManifest: true
      },
      "same-process user-gesture evidence explicitly declares its gate"
    );
    assert.equal(
      userGestureGateSummary.caseSummaries[0].closeProbe.externalForegroundSourceReadyEventCount,
      1
    );
    assert.equal(
      userGestureGateSummary.caseSummaries[0].closeProbe.externalForegroundTransitionObservedEventCount,
      1
    );
    const userGestureMovementFixtureFailures = [];
    const userGestureMovementEvents = readJsonLinesIfPresent(
      path.join(userGestureGateRoot, "11-managed-web-open-and-wait", "close-probe.log"),
      userGestureMovementFixtureFailures
    );
    const userGestureReadyPoint = objectOrEmpty(
      objectOrEmpty(
        userGestureMovementEvents.find((event) => event.type === "probe:user-gesture-gate-ready")
      ).payload
    ).target;
    const userGesturePreDispatchPoint = objectOrEmpty(
      objectOrEmpty(
        userGestureMovementEvents.find((event) => event.type === "probe:user-gesture-gate-pre-dispatch")
      ).payload
    ).target;
    const userGestureFinalPoint = objectOrEmpty(
      objectOrEmpty(
        userGestureMovementEvents.find((event) => event.type === "probe:user-gesture-gate-activation-sent")
      ).payload
    ).target;
    assert.deepEqual(userGestureMovementFixtureFailures, []);
    assert.notEqual(userGestureReadyPoint.x, userGesturePreDispatchPoint.x);
    assert.notEqual(userGesturePreDispatchPoint.x, userGestureFinalPoint.x);

    const legacyUserGestureRoot = path.join(tempRoot, "managed-web-user-gesture-schema-2");
    writeManagedWebCloseEvidenceFixture(legacyUserGestureRoot, {
      closeProbeEvidenceSchema: 2,
      userGestureGate: true,
      legacyUserGestureSchema2: true
    });
    const legacyUserGestureSummary = summarizeWindowsOverlayMatrixArtifacts(
      legacyUserGestureRoot
    );
    assert.deepEqual(
      legacyUserGestureSummary.failures,
      [],
      JSON.stringify(legacyUserGestureSummary.caseSummaries[0].closeProbe, null, 2)
    );
    assert.equal(legacyUserGestureSummary.caseSummaries[0].closeProbe.evidenceSchema, 2);
    assert.equal(
      legacyUserGestureSummary.caseSummaries[0].closeProbe.externalForegroundTransitionEvidenceValid,
      true
    );
    assert.equal(
      legacyUserGestureSummary.caseSummaries[0].closeProbe.externalForegroundSourceReadyEventCount,
      0
    );
    const legacyUserGestureEvents = readJsonLinesIfPresent(
      path.join(legacyUserGestureRoot, "11-managed-web-open-and-wait", "close-probe.log"),
      []
    );
    for (const binding of [
      objectOrEmpty(
        objectOrEmpty(
          legacyUserGestureEvents.find(
            (event) => event.type === "probe:user-gesture-gate-ready"
          )
        ).payload
      ).binding,
      objectOrEmpty(
        objectOrEmpty(
          legacyUserGestureEvents.find(
            (event) => event.type === "probe:user-gesture-gate-activation-sent"
          )
        ).payload
      ).binding
    ]) {
      assert.equal(Object.prototype.hasOwnProperty.call(binding, "sourceProcessIdentityPresent"), false);
      assert.equal(Object.prototype.hasOwnProperty.call(binding, "sourceMatchesBoundWindow"), false);
      assert.equal(
        Object.prototype.hasOwnProperty.call(binding, "sourceMatchesBoundProcessIdentity"),
        false
      );
    }
    const legacyPreDispatchBinding = objectOrEmpty(
      objectOrEmpty(
        objectOrEmpty(
          legacyUserGestureEvents.find(
            (event) => event.type === "probe:user-gesture-gate-pre-dispatch"
          )
        ).payload
      ).binding
    );
    assert.equal(
      Object.prototype.hasOwnProperty.call(
        legacyPreDispatchBinding,
        "sourceMatchesBoundProcessIdentity"
      ),
      false
    );

    const alreadyForegroundGestureRoot = path.join(
      tempRoot,
      "managed-web-user-gesture-already-foreground"
    );
    writeManagedWebCloseEvidenceFixture(alreadyForegroundGestureRoot, {
      userGestureGate: true,
      alreadyForeground: true
    });
    const alreadyForegroundGestureSummary = summarizeWindowsOverlayMatrixArtifacts(
      alreadyForegroundGestureRoot
    );
    assert.deepEqual(alreadyForegroundGestureSummary.failures, []);
    assert.equal(
      alreadyForegroundGestureSummary.caseSummaries[0].closeProbe
        .externalForegroundTransitionNotRequiredEventCount,
      1
    );
    assert.equal(
      alreadyForegroundGestureSummary.caseSummaries[0].closeProbe.externalForegroundReadyMarkerValid,
      false
    );

    const alreadyForegroundRoot = path.join(tempRoot, "managed-web-already-foreground");
    writeManagedWebCloseEvidenceFixture(alreadyForegroundRoot, {
      closeProbeEvidenceSchema: 2,
      alreadyForeground: true
    });
    const alreadyForegroundSummary = summarizeWindowsOverlayMatrixArtifacts(alreadyForegroundRoot);
    assert.deepEqual(alreadyForegroundSummary.failures, []);
    assert.equal(
      alreadyForegroundSummary.caseSummaries[0].closeProbe.nativePresenterHandoffBranch,
      "owner-process-request"
    );
    assert.equal(alreadyForegroundSummary.caseSummaries[0].closeProbe.nativePresenterHandoffAppEventCount, 1);
    assert.equal(
      alreadyForegroundSummary.caseSummaries[0].closeProbe.nativePresenterHandoffNativeShowCallCount,
      0
    );

    const webCloseRoundingRoot = path.join(tempRoot, "managed-web-close-rounding-boundary");
    writeManagedWebCloseEvidenceFixture(webCloseRoundingRoot, { roundingBoundaryScale: true });
    const webCloseRoundingSummary = summarizeWindowsOverlayMatrixArtifacts(webCloseRoundingRoot);
    assert.deepEqual(webCloseRoundingSummary.failures, []);
    assert.equal(webCloseRoundingSummary.caseSummaries[0].closeProbe.webCloseLoggedScale, 1.25);
    assert.ok(
      webCloseRoundingSummary.caseSummaries[0].closeProbe.webCloseDerivedScale > 1.25,
      "geometry may cross an inset rounding boundary while still agreeing with window DPI"
    );

    for (const [name, options, failure] of [
      [
        "missing-process-dpi",
        { missingProcessPerMonitorV2: true },
        "close probe used process per-monitor-v2 DPI awareness"
      ],
      [
        "missing-thread-dpi",
        { missingThreadPerMonitorV2: true },
        "close probe used thread per-monitor-v2 DPI awareness"
      ],
      ["pointer-failed", { pointerFailed: true }, "close probe sent all three pointer inputs without error"],
      [
        "pointer-mismatch",
        { pointerMissesTarget: true },
        "close probe pointer coordinates match the audited target"
      ],
      ["target-outside", { targetOutsidePanel: true }, "close probe target lies inside the detected panel"],
      [
        "actual-input-mismatch",
        { actualInputMismatch: true },
        "close probe input matches resolved web-close-click-sendinput"
      ],
      [
        "missing-presenter-focus",
        { missingPresenterFocus: true },
        "recorded one native-presenter focus step"
      ],
      [
        "presenter-focus-failed",
        { presenterFocusFailed: true },
        "native presenter focus succeeded before close input"
      ],
      [
        "presenter-focus-after-input",
        { presenterFocusAfterInput: true },
        "native presenter focus succeeded before close input"
      ],
      [
        "presenter-focus-leaks-hwnd",
        { presenterFocusLeaksRawHwnd: true },
        "close probe focus evidence omits raw native HWND"
      ],
      [
        "presenter-pre-dispatch-missing",
        { missingPresenterPreDispatch: true },
        "reconfirmed native presenter focus immediately before input"
      ],
      [
        "presenter-pre-dispatch-failed",
        { presenterPreDispatchFailed: true },
        "reconfirmed native presenter focus immediately before input"
      ],
      [
        "presenter-pre-dispatch-leaks-hwnd",
        { presenterPreDispatchLeaksRawHwnd: true },
        "pre-dispatch focus evidence omits raw native HWND"
      ],
      [
        "unscaled-large-target",
        { unscaledLargeTarget: true },
        "close probe target uses scale-aware panel insets"
      ],
      ["missing-scale", { missingScaleEvidence: true }, "close probe scale agrees with independent presenter geometry"],
      ["scale-mismatch", { scaleMismatch: true }, "close probe scale agrees with independent presenter geometry"],
      [
        "missing-logical-bounds",
        { omitLogicalBounds: true },
        "physical/logical presenter scale axes agree"
      ],
      ["missing-native-rect", { omitNativeRect: true }, "close probe includes a native host rect"],
      [
        "missing-screenshot-bounds",
        { missingScreenshotBounds: true },
        "close probe includes a successful screenshot with declared bounds"
      ],
      [
        "missing-screenshot-file",
        { missingScreenshotFile: true },
        "close probe includes a readable physical screenshot"
      ],
      [
        "screenshot-dimensions-mismatch",
        { screenshotDimensionsMismatch: true },
        "physical screenshot dimensions match declared bounds"
      ],
      [
        "screenshot-miss",
        { screenshotMissesNativeRect: true },
        "physical screenshot bounds contain the native host rect"
      ]
    ]) {
      assertFixtureSummaryFailure(
        tempRoot,
        `managed-web-close-${name}`,
        writeManagedWebCloseEvidenceFixture,
        options,
        failure
      );
    }

    const nonWebFocusRoot = path.join(tempRoot, "managed-non-web-focus");
    writeManagedWebCloseEvidenceFixture(nonWebFocusRoot, {
      expectedCloseProbeInput: "escape-sendinput"
    });
    const nonWebFocusSummary = summarizeWindowsOverlayMatrixArtifacts(nonWebFocusRoot);
    assert.deepEqual(nonWebFocusSummary.failures, []);
    assert.equal(nonWebFocusSummary.caseSummaries[0].closeProbe.nativePresenterFocused, true);
    assert.equal(nonWebFocusSummary.caseSummaries[0].closeProbe.nativePresenterPreDispatchFocused, true);
    assertFixtureSummaryFailure(
      tempRoot,
      "managed-non-web-missing-focus",
      writeManagedWebCloseEvidenceFixture,
      { expectedCloseProbeInput: "escape-sendinput", missingPresenterFocus: true },
      "recorded one native-presenter focus step"
    );
    assertFixtureSummaryFailure(
      tempRoot,
      "managed-web-close-unknown-schema",
      writeManagedWebCloseEvidenceFixture,
      { closeProbeEvidenceSchema: 4 },
      "closeProbeEvidenceSchema uses supported version 1, 2, or 3"
    );

    for (const [name, options, failure] of [
      ["missing-app-event", { missingAppHandoff: true }, "recorded one coherent owner-process foreground handoff"],
      ["duplicate-app-event", { duplicateAppHandoff: true }, "recorded one coherent owner-process foreground handoff"],
      ["app-event-after-focus", { appHandoffAfterFocus: true }, "recorded one coherent owner-process foreground handoff"],
      ["app-event-leaks-hwnd", { appHandoffLeaksRawHwnd: true }, "recorded one coherent owner-process foreground handoff"],
      ["lifecycle-owner-mismatch", { lifecycleOwnerMismatch: true }, "recorded one coherent owner-process foreground handoff"],
      ["control-owner-mismatch", { controlOwnerMismatch: true }, "recorded one coherent owner-process foreground handoff"],
      ["session-mismatch", { sessionMismatch: true }, "recorded one coherent owner-process foreground handoff"],
      ["same-window-mismatch", { sameWindowMismatch: true }, "recorded one coherent owner-process foreground handoff"],
      ["second-native-show", { secondNativeShowCall: true }, "recorded one coherent owner-process foreground handoff"],
      ["transport-failed", { transportFailed: true }, "recorded one coherent owner-process foreground handoff"],
      ["wide-control-server", { wideControlServer: true }, "recorded one coherent owner-process foreground handoff"],
      ["requested-window-mismatch", { requestedWindowMismatch: true }, "recorded one coherent owner-process foreground handoff"],
      ["response-mismatch", { appReasonMismatch: true }, "recorded one coherent owner-process foreground handoff"],
      ["wrong-start-schema", { wrongStartSchema: true }, "close probe uses schema-2 owner-process handoff"],
      ["wrong-start-handoff", { wrongStartHandoff: true }, "close probe uses schema-2 owner-process handoff"],
      ["pointer-fallback", { pointerFallback: true }, "used only SendInput for the pointer dispatch"],
      ["target-after-handoff", { targetAfterHandoff: true }, "resolved the web close target before foreground handoff"],
      ["app-event-leaks-pid", { appHandoffLeaksRawPid: true }, "recorded one coherent owner-process foreground handoff"],
      ["focus-event-leaks-port", { focusHandoffLeaksRawPort: true }, "recorded one coherent owner-process foreground handoff"],
      ["pre-dispatch-owner-mismatch", { presenterPreDispatchOwnerMismatch: true }, "reconfirmed native presenter focus immediately before input"],
      ["pre-dispatch-disabled", { presenterPreDispatchDisabled: true }, "reconfirmed native presenter focus immediately before input"],
      ["pre-dispatch-iconic", { presenterPreDispatchIconic: true }, "reconfirmed native presenter focus immediately before input"],
      ["both-terminal-branches", { bothTerminalBranches: true }, "recorded exactly one successful close-probe terminal branch"],
      ["missing-window-focus", { missingWindowFocus: true }, "returned focus to the visible Electron window"],
      ["skip-instead-of-send", { skipInsteadOfSend: true }, "sent Windows close probe input"]
    ]) {
      assertFixtureSummaryFailure(
        tempRoot,
        `managed-web-owner-handoff-${name}`,
        writeManagedWebCloseEvidenceFixture,
        { closeProbeEvidenceSchema: 2, ...options },
        failure
      );
    }

    for (const [name, options] of [
      ["missing-armed", { missingGestureArmed: true }],
      ["missing-ready", { missingGestureReady: true }],
      ["missing-consumed", { missingGestureConsumed: true }],
      ["consumed-before-activation", { gestureConsumedBeforeActivation: true }],
      ["rejected", { gestureRejected: true }],
      ["duplicate-activation", { duplicateGestureActivation: true }],
      ["sender-mismatch", { gestureSenderMismatch: true }],
      ["frame-mismatch", { gestureFrameMismatch: true }],
      ["nonce-mismatch", { gestureNonceMismatch: true }],
      ["untrusted", { gestureUntrusted: true }],
      ["inactive", { gestureInactive: true }],
      ["ready-geometry-invalid", { gestureReadyGeometryInvalid: true }],
      ["ready-viewport-invalid", { gestureReadyViewportInvalid: true }],
      ["ready-dpr-mismatch", { gestureReadyDprMismatch: true }],
      ["null-coordinates", { gestureNullCoordinates: true }],
      ["null-scales", { gestureNullScales: true }],
      ["source-owner-mismatch", { gestureSourceOwnerMismatch: true }],
      ["source-control-mismatch", { gestureSourceControlMismatch: true }],
      ["source-session-mismatch", { gestureSourceSessionMismatch: true }],
      ["source-not-foreground", { gestureSourceNotForeground: true }],
      ["dpi-mismatch", { gestureDpiMismatch: true }],
      ["window-scale-claim-mismatch", { gestureWindowScaleClaimMismatch: true }],
      ["client-geometry-mismatch", { gestureClientGeometryMismatch: true }],
      ["pre-dispatch-missing", { gesturePreDispatchMissing: true }],
      ["pre-dispatch-source-mismatch", { gesturePreDispatchSourceMismatch: true }],
      ["pre-dispatch-bound-window-mismatch", { gesturePreDispatchBoundWindowMismatch: true }],
      ["pre-dispatch-control-mismatch", { gesturePreDispatchControlMismatch: true }],
      ["pre-dispatch-point-mismatch", { gesturePreDispatchPointMismatch: true }],
      ["pre-dispatch-foreground-lost", { gesturePreDispatchForegroundLost: true }],
      ["pre-dispatch-wrong-rebound-math", { gesturePreDispatchWrongReboundMath: true }],
      ["pre-dispatch-client-size-mismatch", { gesturePreDispatchClientSizeMismatch: true }],
      ["pre-dispatch-dpi-drift", { gesturePreDispatchDpiDrift: true }],
      ["pre-dispatch-renderer-geometry-mismatch", { gesturePreDispatchRendererGeometryMismatch: true }],
      ["dispatch-start-target-mismatch", { gestureDispatchStartTargetMismatch: true }],
      ["dispatch-embedded-target-mismatch", { gestureDispatchEmbeddedTargetMismatch: true }],
      ["final-dispatch-mismatch", { gestureFinalDispatchMismatch: true }],
      ["final-wrong-rebound-math", { gestureFinalWrongReboundMath: true }],
      ["activation-final-target-mismatch", { gestureActivationFinalTargetMismatch: true }],
      ["pointer-uses-pre-dispatch-target", { gesturePointerUsesPreTarget: true }],
      ["pointer-uses-zero-argument-defaults", { gesturePointerUsesZeroArgumentDefaults: true }],
      ["foreground-clear", { gestureForegroundClear: true }],
      ["dispatch-start-missing", { gestureDispatchStartMissing: true }],
      ["dispatch-start-state-wrong", { gestureDispatchStartStateWrong: true }],
      ["dispatch-start-leaks-pid", { gestureDispatchStartLeaksPid: true }],
      ["activation-dispatch-failed", { gestureActivationPointerFailed: true }],
      ["source-unbound", { gestureSourceUnbound: true }],
      ["presenter-not-foreground", { presenterFocusFailed: true }],
      ["focus-return-missing", { gestureFocusReturnMissing: true }],
      ["armed-leaks-pid", { gestureArmedLeaksPid: true }],
      ["ready-leaks-nonce", { gestureReadyLeaksNonce: true }],
      ["consumed-leaks-pid", { gestureConsumedLeaksPid: true }],
      ["focus-transport-wrong", { gestureFocusTransportWrong: true }],
      ["focus-request-ordinal-wrong", { gestureFocusRequestOrdinalWrong: true }],
      ["focus-null-counts", { gestureFocusNullCounts: true }],
      ["focus-native-flags-wrong", { gestureFocusNativeFlagsWrong: true }],
      ["focus-message-delta-wrong", { gestureFocusMessageDeltaWrong: true }],
      ["focus-app-reason-wrong", { gestureFocusAppReasonWrong: true }],
      ["probe-complete-missing", { gestureProbeCompleteMissing: true }],
      ["probe-complete-duplicate", { gestureProbeCompleteDuplicate: true }],
      ["probe-incomplete", { gestureProbeIncomplete: true }],
      ["probe-timeout", { gestureProbeTimeout: true }],
      ["probe-exit-nonzero", { gestureProbeExitNonzero: true }],
      ["after-close-stable-missing", { gestureAfterCloseStableMissing: true }],
      ["completion-control-invalid", { gestureCompletionControlInvalid: true }],
      ["completion-pid-mismatch", { gestureCompletionPidMismatch: true }],
      ["completion-quit-not-attempted", { gestureCompletionQuitAttemptedMissing: true }],
      ["completion-quit-rejected", { gestureCompletionQuitRejected: true }],
      ["completion-source-exit-missing", { gestureCompletionSourceExitMissing: true }],
      ["completion-quit-missing", { gestureCompletionQuitMissing: true }],
      ["completion-quit-before-focus", { gestureCompletionQuitBeforeFocus: true }],
      ["graceful-shutdown-missing", { gestureGracefulShutdownMissing: true }],
      ["result-write-false", { gestureResultWriteFalse: true }],
      ["process-exit-nonzero", { gestureProcessExitNonzero: true }],
      ["app-quit-nonzero", { gestureAppQuitNonzero: true }],
      ["late-fatal", { gestureLateFatal: true }],
      ["completion-leaks-pid", { gestureCompletionLeaksPid: true }],
      ["completion-quit-leaks-port", { gestureCompletionQuitLeaksPort: true }]
    ]) {
      assertFixtureSummaryFailure(
        tempRoot,
        `managed-web-user-gesture-${name}`,
        writeManagedWebCloseEvidenceFixture,
        { userGestureGate: true, ...options },
        "recorded one coherent same-process user-gesture handoff"
      );
    }
    for (const [name, options] of [
      ["external-source-ready-missing", { externalSourceReadyMissing: true }],
      ["external-source-ready-duplicate", { externalSourceReadyDuplicate: true }],
      ["external-source-ready-after-observed", { externalSourceReadyAfterObserved: true }],
      ["external-source-ready-wrong-mechanism", { externalSourceReadyWrongMechanism: true }],
      ["external-source-ready-identity-mismatch", { externalSourceReadyIdentityMismatch: true }],
      ["external-source-ready-foreground", { externalSourceReadyForegroundTrue: true }],
      ["external-source-ready-input-before-transition", { externalSourceReadyInputCountWrong: true }],
      ["external-source-ready-close-before-transition", { externalSourceReadyCloseInputCountWrong: true }],
      ["external-source-ready-leaks-pid", { externalSourceReadyLeaksPid: true }],
      ["external-source-ready-leaks-process-start", { externalSourceReadyLeaksProcessStart: true }],
      ["external-source-ready-leaks-process-start-utc", { externalSourceReadyLeaksProcessStartUtc: true }],
      ["external-ack-event-missing", { externalAckEventMissing: true }],
      ["external-ack-event-duplicate", { externalAckEventDuplicate: true }],
      ["external-ack-event-after-observed", { externalAckEventAfterObserved: true }],
      ["external-ack-record-order-wrong", { externalAckRecordOrderWrong: true }],
      ["external-ack-event-wrong-mechanism", { externalAckEventWrongMechanism: true }],
      ["external-ack-event-activation-input", { externalAckEventActivationInputCountWrong: true }],
      ["external-ack-event-close-input", { externalAckEventCloseInputCountWrong: true }],
      ["external-ack-event-leaks-pid", { externalAckEventLeaksPid: true }],
      ["external-ack-file-missing", { externalAckFileMissing: true }],
      ["external-ack-file-wrong-kind", { externalAckFileWrongKind: true }],
      ["external-ack-file-wrong-ordinal", { externalAckFileOrdinalWrong: true }],
      ["external-ack-file-wrong-mechanism", { externalAckFileWrongMechanism: true }],
      ["external-ack-file-challenge-mismatch", { externalAckFileChallengeMismatch: true }],
      ["external-ack-file-click-incomplete", { externalAckFileClickIncomplete: true }],
      ["external-ack-file-activation-input", { externalAckFileActivationInputCountWrong: true }],
      ["external-ack-file-close-input", { externalAckFileCloseInputCountWrong: true }],
      ["external-ack-file-leaks-pid", { externalAckFileLeaksPid: true }],
      ["external-ack-file-schema-type", { externalAckFileSchemaTypeWrong: true }],
      ["external-ack-file-click-type", { externalAckFileClickTypeWrong: true }],
      ["external-ack-file-activation-type", { externalAckFileActivationInputTypeWrong: true }],
      ["external-ack-file-close-type", { externalAckFileCloseInputTypeWrong: true }],
      ["external-observed-missing", { externalObservedMissing: true }],
      ["external-observed-duplicate", { externalObservedDuplicate: true }],
      ["external-record-order-wrong", { externalRecordOrderWrong: true }],
      ["external-observed-before-source-ready", { externalObservedBeforeSourceReady: true }],
      ["external-observed-wrong-mechanism", { externalObservedWrongMechanism: true }],
      ["external-observed-identity-mismatch", { externalObservedIdentityMismatch: true }],
      ["external-observed-not-foreground", { externalObservedNotForeground: true }],
      ["external-observed-count-wrong", { externalObservedEventCountWrong: true }],
      ["external-observed-hook-not-stopped", { externalObservedHookNotStopped: true }],
      ["external-observed-input-before-transition", { externalObservedInputCountWrong: true }],
      ["external-observed-close-before-transition", { externalObservedCloseInputCountWrong: true }],
      ["external-observed-leaks-hwnd", { externalObservedLeaksHwnd: true }],
      ["external-rejected-with-observed", { externalRejected: true }],
      ["external-marker-missing", { externalMarkerMissing: true }],
      ["external-marker-wrong-kind", { externalMarkerWrongKind: true }],
      ["external-marker-wrong-ordinal", { externalMarkerOrdinalWrong: true }],
      ["external-marker-wrong-mechanism", { externalMarkerWrongMechanism: true }],
      ["external-marker-challenge-invalid", { externalMarkerChallengeInvalid: true }],
      ["external-marker-input-before-transition", { externalMarkerInputCountWrong: true }],
      ["external-marker-close-before-transition", { externalMarkerCloseInputCountWrong: true }],
      ["external-marker-leaks-pid", { externalMarkerLeaksPid: true }]
    ]) {
      assertFixtureSummaryFailure(
        tempRoot,
        `managed-web-user-gesture-${name}`,
        writeManagedWebCloseEvidenceFixture,
        { userGestureGate: true, ...options },
        "recorded one coherent same-process user-gesture handoff"
      );
    }
    for (const [name, options] of [
      ["external-not-required-missing", { externalNotRequiredMissing: true }],
      ["external-not-required-duplicate", { externalNotRequiredDuplicate: true }],
      ["external-not-required-close-input", { externalNotRequiredCloseInputCountWrong: true }],
      ["external-not-required-leaks-process-start", { externalNotRequiredLeaksProcessStart: true }]
    ]) {
      assertFixtureSummaryFailure(
        tempRoot,
        `managed-web-user-gesture-${name}`,
        writeManagedWebCloseEvidenceFixture,
        { userGestureGate: true, alreadyForeground: true, ...options },
        "recorded one coherent same-process user-gesture handoff"
      );
    }
    assertFixtureSummaryFailure(
      tempRoot,
      "managed-web-user-gesture-wrong-external-transition",
      writeManagedWebCloseEvidenceFixture,
      { userGestureGate: true, wrongExternalForegroundTransition: true },
      `enables schema-3 external foreground transition ${EXTERNAL_FOREGROUND_TRANSITION}`
    );
    assertFixtureSummaryFailure(
      tempRoot,
      "managed-web-user-gesture-wrong-manifest-external-transition",
      writeManagedWebCloseEvidenceFixture,
      { userGestureGate: true, wrongManifestExternalForegroundTransition: true },
      `records external foreground transition ${EXTERNAL_FOREGROUND_TRANSITION}`
    );
    assertFixtureSummaryFailure(
      tempRoot,
      "managed-web-user-gesture-wrong-start-handoff",
      writeManagedWebCloseEvidenceFixture,
      { userGestureGate: true, wrongStartHandoff: true },
      `close probe uses schema-3 ${SAME_PROCESS_USER_GESTURE_HANDOFF}`
    );

    const duplicateOpenGuardRoot = path.join(tempRoot, "duplicate-open-guard");
    writeDuplicateOpenGuardCaseFixture(duplicateOpenGuardRoot);
    const duplicateOpenGuardSummary = summarizeWindowsOverlayMatrixArtifacts(duplicateOpenGuardRoot);
    assert.deepEqual(duplicateOpenGuardSummary.failures, []);
    assert.equal(duplicateOpenGuardSummary.caseSummaries[0].duplicateOpenGuardProof, true);
    assert.equal(duplicateOpenGuardSummary.caseSummaries[0].managedOverlayCloseProof, true);

    for (const [name, options, failure] of [
      ["missing-named-status", { omitNamedStatuses: true }, "duplicate guard named web status rejects open"],
      [
        "missing-named-if-available",
        { omitNamedIfAvailableNulls: true },
        "openWebIfAvailable returned null while busy"
      ],
      [
        "missing-named-and-wait",
        { omitNamedAndWaitIfAvailableNulls: true },
        "openWebAndWaitIfAvailable returned null while busy"
      ],
      [
        "checkout-operation-ran",
        { checkoutOperationRan: true },
        "checkout IfAvailable did not run the transaction operation while busy"
      ],
      [
        "duplicate-guard-event",
        { duplicateGuardEvent: true },
        "expected exactly one overlay:presenter-duplicate-open-guard event"
      ],
      [
        "checkout-operation-missing-can-start",
        { omitCheckoutOperationCanStart: true },
        "named checkoutOperation status explicitly rejects operation start"
      ]
    ]) {
      assertFixtureSummaryFailure(
        tempRoot,
        `duplicate-open-guard-${name}`,
        writeDuplicateOpenGuardCaseFixture,
        options,
        failure
      );
    }

    const managedCheckoutMicroTxnRoot = path.join(tempRoot, "managed-checkout-microtxn");
    writeManagedCheckoutMicroTxnFixture(managedCheckoutMicroTxnRoot);
    const managedCheckoutMicroTxnSummary = summarizeWindowsOverlayMatrixArtifacts(managedCheckoutMicroTxnRoot);
    assert.deepEqual(managedCheckoutMicroTxnSummary.failures, []);
    assert.equal(managedCheckoutMicroTxnSummary.caseSummaries[0].microTxnCallbackListenerRegistered, true);
    assert.equal(managedCheckoutMicroTxnSummary.caseSummaries[0].legacyMicroTxnCallbackListenerRegistered, true);
    assert.equal(managedCheckoutMicroTxnSummary.caseSummaries[0].microTxnCallbackCount, 1);
    assert.equal(managedCheckoutMicroTxnSummary.caseSummaries[0].microTxnCallbackSources, "steamworks");
    assert.equal(managedCheckoutMicroTxnSummary.caseSummaries[0].microTxnCurrentOperationMatch, true);
    assert.equal(managedCheckoutMicroTxnSummary.caseSummaries[0].microTxnCallbackProof, true);

    const missingMicroTxnMatchRoot = path.join(tempRoot, "managed-checkout-missing-microtxn-match");
    writeManagedCheckoutMicroTxnFixture(missingMicroTxnMatchRoot, { omitMicroTxnCurrentOperationMatch: true });
    const missingMicroTxnMatchSummary = summarizeWindowsOverlayMatrixArtifacts(missingMicroTxnMatchRoot);
    assert(
      missingMicroTxnMatchSummary.failures.some((failure) =>
        failure.includes("did not match the current checkout operation")
      ),
      "summary self-test should fail when callback proof omits current-operation correlation"
    );

    const falseMicroTxnMatchRoot = path.join(tempRoot, "managed-checkout-false-microtxn-match");
    writeManagedCheckoutMicroTxnFixture(falseMicroTxnMatchRoot, { microTxnCurrentOperationMatch: false });
    const falseMicroTxnMatchSummary = summarizeWindowsOverlayMatrixArtifacts(falseMicroTxnMatchRoot);
    assert(
      falseMicroTxnMatchSummary.failures.some((failure) =>
        failure.includes("did not match the current checkout operation")
      ),
      "summary self-test should fail when callback proof belongs to another operation"
    );

    const staleThenCurrentMicroTxnRoot = path.join(tempRoot, "managed-checkout-stale-then-current-microtxn");
    writeManagedCheckoutMicroTxnFixture(staleThenCurrentMicroTxnRoot, {
      includeStaleMicroTxn: true,
      includeLegacyMicroTxnDuplicate: true
    });
    const staleThenCurrentMicroTxnSummary = summarizeWindowsOverlayMatrixArtifacts(staleThenCurrentMicroTxnRoot);
    assert.deepEqual(staleThenCurrentMicroTxnSummary.failures, []);
    assert.equal(staleThenCurrentMicroTxnSummary.caseSummaries[0].microTxnCallbackCount, 3);
    assert.equal(staleThenCurrentMicroTxnSummary.caseSummaries[0].microTxnCurrentOperationMatch, true);
    assert.equal(staleThenCurrentMicroTxnSummary.caseSummaries[0].microTxnCallbackSources, "legacy,steamworks");

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
    assert.equal(clientPromptMissingSummary.caseSummaries[0].managedCheckoutOperationStarted, true);
    assert.equal(clientPromptMissingSummary.caseSummaries[0].managedCheckoutOperationDeferredInitTxn, true);
    assert.equal(clientPromptMissingSummary.caseSummaries[0].managedCheckoutOperationShownObserverArmed, true);
    assert.equal(clientPromptMissingSummary.caseSummaries[0].managedCheckoutOperationCallbackCorrelationPrepared, true);
    assert.equal(clientPromptMissingSummary.caseSummaries[0].managedCheckoutOperationPresenterReady, true);
    assert.equal(clientPromptMissingSummary.caseSummaries[0].managedCheckoutOperationBeforeInitTxnCapture, true);
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
    assert.equal(clientPromptMissingSummary.caseSummaries[0].clientSessionQueryPresent, true);
    assert.equal(clientPromptMissingSummary.caseSummaries[0].clientSessionQuerySchema, 1);
    assert.equal(clientPromptMissingSummary.caseSummaries[0].clientSessionQueryClosedSchema, true);
    assert.equal(clientPromptMissingSummary.caseSummaries[0].clientSessionQueryAttempted, true);
    assert.equal(clientPromptMissingSummary.caseSummaries[0].clientSessionQueryReason, "none");
    assert.equal(clientPromptMissingSummary.caseSummaries[0].clientSessionQueryEndpoint, "sandbox");
    assert.equal(clientPromptMissingSummary.caseSummaries[0].clientSessionQueryId, "transaction");
    assert.equal(clientPromptMissingSummary.caseSummaries[0].clientSessionQueryOk, true);
    assert.equal(clientPromptMissingSummary.caseSummaries[0].clientSessionQueryHttpStatus, 200);
    assert.equal(clientPromptMissingSummary.caseSummaries[0].clientSessionQueryResult, "OK");
    assert.equal(clientPromptMissingSummary.caseSummaries[0].clientSessionQueryStatus, "Init");
    assert.equal(clientPromptMissingSummary.caseSummaries[0].clientSessionQueryErrorCode, "missing");
    assert.equal(clientPromptMissingSummary.caseSummaries[0].clientSessionQueryRequestError, "none");
    assert.equal(clientPromptMissingSummary.caseSummaries[0].clientSessionQueryHasTransactionId, true);
    assert.equal(clientPromptMissingSummary.caseSummaries[0].clientSessionQueryHasOrderId, true);
    assert.equal(clientPromptMissingSummary.caseSummaries[0].clientSessionQueryHasSteamId64, true);
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

    const missingManagedOperationRoot = path.join(tempRoot, "managed-checkout-missing-operation-start");
    writeManagedCheckoutMicroTxnFixture(missingManagedOperationRoot, {
      clientPromptMissing: true,
      omitManagedCheckoutOperationStart: true
    });
    const missingManagedOperationSummary = summarizeWindowsOverlayMatrixArtifacts(missingManagedOperationRoot);
    assert(
      missingManagedOperationSummary.failures.some((failure) =>
        failure.includes("started InitTxn inside the managed checkout operation")
      ),
      "summary self-test should fail when InitTxn has no managed-operation start proof"
    );

    const missingClientQueryRoot = path.join(tempRoot, "managed-checkout-missing-client-query");
    writeManagedCheckoutMicroTxnFixture(missingClientQueryRoot, {
      clientPromptMissing: true,
      omitClientSessionQuery: true
    });
    const missingClientQuerySummary = summarizeWindowsOverlayMatrixArtifacts(missingClientQueryRoot);
    assert(
      missingClientQuerySummary.failures.some((failure) =>
        failure.includes("prompt-missing proof recorded a QueryTxn diagnostic")
      ),
      "summary self-test should fail when prompt-missing proof omits QueryTxn"
    );

    const skippedClientQueryRoot = path.join(tempRoot, "managed-checkout-skipped-client-query");
    writeManagedCheckoutMicroTxnFixture(skippedClientQueryRoot, {
      clientPromptMissing: true,
      clientQueryAttempted: false,
      clientQueryReason: "disabled"
    });
    const skippedClientQuerySummary = summarizeWindowsOverlayMatrixArtifacts(skippedClientQueryRoot);
    assert(
      skippedClientQuerySummary.failures.some((failure) => failure.includes("prompt-missing proof attempted QueryTxn")),
      "summary self-test should fail when prompt-missing QueryTxn is disabled"
    );

    const lateClientQueryRoot = path.join(tempRoot, "managed-checkout-late-client-query");
    writeManagedCheckoutMicroTxnFixture(lateClientQueryRoot, {
      clientPromptMissing: true,
      clientQueryAfterPromptMissing: true
    });
    const lateClientQuerySummary = summarizeWindowsOverlayMatrixArtifacts(lateClientQueryRoot);
    assert(
      lateClientQuerySummary.failures.some((failure) =>
        failure.includes("QueryTxn runs before prompt-missing classification")
      ),
      "summary self-test should fail when QueryTxn runs after prompt-missing classification"
    );

    const privateQuerySentinel = "do-not-print-private-query-value";
    const unsafeClientQueryRoot = path.join(tempRoot, "managed-checkout-unsafe-client-query");
    writeManagedCheckoutMicroTxnFixture(unsafeClientQueryRoot, {
      clientPromptMissing: true,
      clientQueryEndpoint: privateQuerySentinel,
      clientQueryId: privateQuerySentinel,
      clientQueryHttpStatus: privateQuerySentinel,
      clientQueryResult: privateQuerySentinel,
      clientQueryStatus: privateQuerySentinel,
      clientQueryErrorCode: privateQuerySentinel,
      clientQueryRequestError: privateQuerySentinel
    });
    const unsafeClientQuerySummary = summarizeWindowsOverlayMatrixArtifacts(unsafeClientQueryRoot);
    const unsafeClientQueryRow = unsafeClientQuerySummary.caseSummaries[0];
    assert.equal(unsafeClientQueryRow.clientSessionQueryEndpoint, "unknown");
    assert.equal(unsafeClientQueryRow.clientSessionQueryId, "none");
    assert.equal(unsafeClientQueryRow.clientSessionQueryHttpStatus, null);
    assert.equal(unsafeClientQueryRow.clientSessionQueryResult, "unknown");
    assert.equal(unsafeClientQueryRow.clientSessionQueryStatus, "unknown");
    assert.equal(unsafeClientQueryRow.clientSessionQueryErrorCode, "unknown");
    assert.equal(unsafeClientQueryRow.clientSessionQueryRequestError, "request-failed");
    assert.equal(unsafeClientQueryRow.clientSessionQueryClosedSchema, false);
    const printed = [];
    const originalConsoleLog = console.log;
    console.log = (value) => printed.push(String(value));
    try {
      printSummary(unsafeClientQuerySummary);
    } finally {
      console.log = originalConsoleLog;
    }
    assert.equal(printed.join("\n").includes(privateQuerySentinel), false);

    const extraClientQueryRoot = path.join(tempRoot, "managed-checkout-extra-client-query-field");
    writeManagedCheckoutMicroTxnFixture(extraClientQueryRoot, {
      clientPromptMissing: true,
      clientQueryExtra: { privateMessage: privateQuerySentinel }
    });
    const extraClientQuerySummary = summarizeWindowsOverlayMatrixArtifacts(extraClientQueryRoot);
    assert.equal(extraClientQuerySummary.caseSummaries[0].clientSessionQueryClosedSchema, false);
    assert(
      extraClientQuerySummary.failures.some((failure) => failure.includes("only allowlisted scalar values")),
      "summary self-test should reject extra QueryTxn diagnostic fields"
    );

    const stringHttpClientQueryRoot = path.join(tempRoot, "managed-checkout-string-query-http");
    writeManagedCheckoutMicroTxnFixture(stringHttpClientQueryRoot, {
      clientPromptMissing: true,
      clientQueryHttpStatus: "200"
    });
    const stringHttpClientQuerySummary = summarizeWindowsOverlayMatrixArtifacts(stringHttpClientQueryRoot);
    assert.equal(stringHttpClientQuerySummary.caseSummaries[0].clientSessionQueryHttpStatus, 200);
    assert.equal(stringHttpClientQuerySummary.caseSummaries[0].clientSessionQueryClosedSchema, false);

    const mismatchedQueryChainRoot = path.join(tempRoot, "managed-checkout-mismatched-query-chain");
    writeManagedCheckoutMicroTxnFixture(mismatchedQueryChainRoot, {
      clientPromptMissing: true,
      clientQueryInitTxnEndpoint: "production"
    });
    const mismatchedQueryChainSummary = summarizeWindowsOverlayMatrixArtifacts(mismatchedQueryChainRoot);
    assert(
      mismatchedQueryChainSummary.failures.some((failure) => failure.includes("chain matches one InitTxn context")),
      "summary self-test should reject QueryTxn evidence from a different InitTxn context"
    );

    const extraPromptEventRoot = path.join(tempRoot, "managed-checkout-extra-prompt-event");
    writeManagedCheckoutMicroTxnFixture(extraPromptEventRoot, {
      clientPromptMissing: true,
      appendInvalidPromptMissingEvent: true
    });
    const extraPromptEventSummary = summarizeWindowsOverlayMatrixArtifacts(extraPromptEventRoot);
    assert(
      extraPromptEventSummary.failures.some((failure) => failure.includes("exactly one classification")),
      "summary self-test should reject an extra unvalidated prompt-missing event"
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
    shortcutNamePresent: true,
    requestedShortcutGameId: "111",
    expectedShortcutGameId: "222",
    changed: true,
    action: "updated",
    existingMatches: false,
    result: {
      appNamePresent: true,
      changed: true,
      action: "updated",
      gameId: "222",
      shortcutsPathPresent: true,
      outputPathPresent: true,
      expected: {
        gameId: "222",
        appNamePresent: true,
        exePresent: true,
        exePathPresent: true,
        exeExists: true,
        startDirPresent: true,
        startDirPathPresent: true,
        startDirExists: true,
        launchOptionsPresent: true
      },
      existing: {
        gameId: "111",
        appNamePresent: true,
        exePresent: true,
        exePathPresent: true,
        exeExists: false,
        startDirPresent: true,
        startDirPathPresent: true,
        startDirExists: false,
        launchOptionsPresent: true
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
  const caseId = options.caseId || "11-managed-web-open-and-wait";
  const action = options.action || "presenter-web-open-and-wait";
  const requiredEvents = options.requiredEvents || [
    "overlay:presenter-open-and-wait-start",
    "overlay:presenter-wait-closed",
    "overlay:presenter-parked",
    "overlay:presenter-open-and-wait-complete"
  ];
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
        id: caseId,
        action,
        requireEvent: requiredEvents,
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
  const events = options.events || [
      { type: "overlay:presenter-open-and-wait-start" },
      { type: "callback:overlay-activated", payload: { active: true } },
      { type: "overlay:presenter-wait-closed" },
      { type: "overlay:presenter-parked" },
      { type: "overlay:presenter-open-and-wait-complete" }
    ];
  if (!options.events && !options.omitInactiveEvent) {
    events.splice(2, 0, { type: "callback:overlay-activated", payload: { active: false } });
  }
  const result = {
    ok: true,
    action: { ok: true, action },
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
  writeResult(path.join(root, caseId, "result.log"), result);
  if (options.closeProbeSent) {
    const foreground = {
      processName: "SteamBridgeSmoke",
      title: "Steam Bridge Electron Smoke",
      pid: 4245
    };
    writeRgbPng(path.join(root, caseId, "close-probe-detected.png"), 4, 2, [
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
      path.join(root, caseId, "close-probe.log"),
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

function writeManagedBackendFixture(root, options = {}) {
  writeManagedCaseFixture(root, options);
  const manifestPath = path.join(root, "matrix-manifest.json");
  const manifest = JSON.parse(readText(manifestPath));
  manifest.expectedNativeHostBackend = "windows-d3d11";
  writeJson(manifestPath, manifest);

  const resultPath = path.join(
    root,
    options.caseId || "11-managed-web-open-and-wait",
    "result.log"
  );
  const result = readSmokeResult(resultPath);
  const resultPresenter = attachedWindowsPresenterFixture({
    rendererBackend: options.wrongResultRenderer ? "windows-opengl" : "windows-d3d11",
    omitNativeRect: options.omitNativeRect,
    omitLogicalBounds: options.omitLogicalBounds,
    roundingBoundaryScale: options.roundingBoundaryScale
  });
  const lifecyclePresenter = attachedWindowsPresenterFixture({
    rendererBackend: options.wrongLifecycleRenderer ? "windows-opengl" : "windows-d3d11",
    omitNativeRect: options.omitNativeRect,
    omitLogicalBounds: options.omitLogicalBounds,
    roundingBoundaryScale: options.roundingBoundaryScale
  });
  result.snapshot.overlay = {
    nativePresenter: { ok: true, value: resultPresenter }
  };
  result.snapshot.events[0].payload = { presenter: lifecyclePresenter };
  writeResult(resultPath, result);
}

function writeManagedWebCloseEvidenceFixture(root, options = {}) {
  const caseId = options.caseId || "11-managed-web-open-and-wait";
  const userGestureExpectation = getUserGestureGateExpectation(caseId);
  const action = options.action || userGestureExpectation?.action || "presenter-web-open-and-wait";
  const reportedUserGestureAction =
    options.reportedUserGestureAction || action;
  const reportedUserGestureTargetId =
    options.reportedUserGestureTargetId ||
    userGestureExpectation?.targetId ||
    "presenter-web-wait";
  const reportedExternalForegroundRequestOrdinal =
    options.reportedExternalForegroundRequestOrdinal ?? 1;
  const managedOptions = { ...options, caseId, action };
  if (caseId === "11b-managed-duplicate-open-guard" && !options.events) {
    managedOptions.requiredEvents = duplicateOpenGuardRequiredEventsFixture();
    managedOptions.events = duplicateOpenGuardEventsFixture(options);
  }
  writeManagedBackendFixture(root, managedOptions);
  if (Object.prototype.hasOwnProperty.call(options, "reportedResultAction")) {
    const resultPath = path.join(root, caseId, "result.log");
    const result = readSmokeResult(resultPath);
    result.action.action = options.reportedResultAction;
    writeResult(resultPath, result);
  }
  const expectedCloseProbeInput = options.expectedCloseProbeInput || "web-close-click-sendinput";
  const closeProbeEvidenceSchema =
    options.closeProbeEvidenceSchema || (options.userGestureGate ? 3 : 1);
  const legacyUserGestureSchema2 = Boolean(
    options.userGestureGate &&
      options.legacyUserGestureSchema2 &&
      closeProbeEvidenceSchema === 2
  );
  const manifestPath = path.join(root, "matrix-manifest.json");
  const manifest = JSON.parse(readText(manifestPath));
  manifest.closeProbe = true;
  manifest.closeProbeInput = "auto";
  manifest.closeProbeEvidenceSchema = options.userGestureGate ? 2 : closeProbeEvidenceSchema;
  if (closeProbeEvidenceSchema >= 2) {
    manifest.closeProbeForegroundHandoff = options.wrongManifestHandoff
      ? "wrong-owner-handoff"
      : OWNER_PROCESS_FOREGROUND_HANDOFF;
    if (options.userGestureGate) {
      manifest.supportedCloseProbeForegroundHandoffs = [
        OWNER_PROCESS_FOREGROUND_HANDOFF,
        SAME_PROCESS_USER_GESTURE_HANDOFF
      ];
      if (!legacyUserGestureSchema2) {
        manifest.supportedCloseProbeEvidenceSchemas = [2, 3];
        manifest.supportedExternalForegroundTransitions = [EXTERNAL_FOREGROUND_TRANSITION];
      }
    }
  }
  manifest.cases[0].expectedCloseProbeInput = expectedCloseProbeInput;
  if (!legacyUserGestureSchema2) {
    manifest.cases[0].closeProbeEvidenceSchema = closeProbeEvidenceSchema;
  }
  if (options.manifestCaseSchemaString) {
    manifest.cases[0].closeProbeEvidenceSchema = String(closeProbeEvidenceSchema);
  }
  if (options.manifestCaseSchemaNull) {
    manifest.cases[0].closeProbeEvidenceSchema = null;
  }
  if (options.userGestureGate) {
    manifest.cases[0].autorunUserGestureGate = true;
    manifest.cases[0].closeProbeForegroundHandoff = SAME_PROCESS_USER_GESTURE_HANDOFF;
    if (!legacyUserGestureSchema2) {
      manifest.cases[0].externalForegroundTransition =
        options.wrongManifestExternalForegroundTransition
          ? "wrong-external-foreground-transition"
          : EXTERNAL_FOREGROUND_TRANSITION;
    }
  } else {
    manifest.cases[0].externalForegroundTransition = "";
  }
  writeJson(manifestPath, manifest);

  const caseDir = path.join(root, caseId);
  const screenshotName = "close-probe-detected.png";
  const screenshotWidth = options.roundingBoundaryScale
    ? 1200
    : options.screenshotDimensionsMismatch
      ? 4
      : 300;
  const screenshotHeight = options.roundingBoundaryScale
    ? 900
    : options.screenshotDimensionsMismatch
      ? 2
      : 200;
  if (!options.missingScreenshotFile) {
    writeRgbPng(path.join(caseDir, screenshotName), screenshotWidth, screenshotHeight, []);
  }

  const panel = options.unscaledLargeTarget
    ? { left: 834, top: 390, right: 2622, bottom: 1672, width: 1788, height: 1282 }
    : { left: 20, top: 20, right: 220, bottom: 170, width: 200, height: 150 };
  const loggedScaleValue = options.roundingBoundaryScale ? 1.25 : 2.25;
  const geometryScale = options.roundingBoundaryScale ? 1.2515 : 2.25;
  const expectedTarget = expectedWebCloseTarget(normalizeRect(panel), panel, loggedScaleValue);
  const target = {
    x: options.unscaledLargeTarget ? panel.right - 16 : options.targetOutsidePanel ? panel.right + 5 : expectedTarget.x,
    y: options.unscaledLargeTarget ? panel.top + 18 : expectedTarget.y,
    source: "screenshot-steam-web-panel",
    panel,
    insets: options.unscaledLargeTarget
      ? { right: 16, top: 18, logicalRight: 16, logicalTop: 18 }
      : { right: expectedTarget.rightInset, top: expectedTarget.topInset, logicalRight: 16, logicalTop: 18 },
    ...(!options.missingScaleEvidence
      ? {
          scale: {
            source: "native-host-window-dpi",
            value: options.scaleMismatch ? 2 : loggedScaleValue,
            dpi: options.scaleMismatch ? 192 : Math.round(loggedScaleValue * 96),
            ratioX: geometryScale,
            ratioY: geometryScale
          }
        }
      : {})
  };
  const screenshotBounds = options.screenshotMissesNativeRect
    ? { left: 100, top: 100, width: 300, height: 200 }
    : {
        left: 0,
        top: 0,
        width: options.roundingBoundaryScale ? 1200 : 300,
        height: options.roundingBoundaryScale ? 900 : 200
      };
  const pointer = {
    sent: options.pointerFailed ? 2 : 3,
    expected: 3,
    lastError: options.pointerFailed ? 5 : 0,
    x: options.pointerMissesTarget ? target.x - 1 : target.x,
    y: target.y,
    method: options.pointerFallback ? "cursor-mouse-event-fallback" : "sendinput",
    coordinateSource: target.source
  };
  const foreground = {
    processName: "SteamBridgeSmoke",
    title: "Steam Bridge Native Overlay Host",
    pid: 4245
  };
  const dpiAwareness = options.missingProcessPerMonitorV2
    ? "process-unchanged:5;thread-per-monitor-v2"
    : options.missingThreadPerMonitorV2
      ? "process-per-monitor-v2;thread-unchanged:5"
      : "process-per-monitor-v2;thread-per-monitor-v2";
  const userGestureGate = Boolean(closeProbeEvidenceSchema >= 2 && options.userGestureGate);
  const gestureReadyRendererTarget = {
    left: 700,
    top: 20,
    width: options.gestureReadyGeometryInvalid ? 0 : 120,
    height: 36
  };
  const gestureReadyRendererViewport = {
    width: 1060,
    height: 760,
    devicePixelRatio: options.gestureReadyViewportInvalid
      ? 9
      : options.gestureReadyDprMismatch
        ? 1.5
        : 2.25
  };
  const alreadyForeground = Boolean(closeProbeEvidenceSchema >= 2 && options.alreadyForeground);
  const focusSucceeded = !options.presenterFocusFailed;
  const nativeShowCallCount = alreadyForeground ? 0 : options.secondNativeShowCall ? 2 : 1;
  const appReason = alreadyForeground
    ? "already-foreground"
    : focusSucceeded
      ? "foreground-confirmed"
      : "foreground-not-confirmed";
  const messageDelta = {
    setFocus: focusSucceeded && !alreadyForeground ? 1 : 0,
    activate: focusSucceeded && !alreadyForeground ? 1 : 0,
    activateApp: 0
  };
  const nativePresenterFocus = userGestureGate
    ? {
        schema: 2,
        source: "lifecycle-native-host",
        mechanism: "same-process-user-gesture",
        attempted: true,
        handlePresent: true,
        handleFormatValid: true,
        windowValid: true,
        wasForeground: true,
        setForegroundResult: false,
        binding: {
          ownerThreadPresent: true,
          lifecycleProcessPresent: true,
          ownerMatchesLifecycleProcess: !options.lifecycleOwnerMismatch,
          ownerMatchesControlProcess: !options.controlOwnerMismatch,
          sameInteractiveSession: !options.sessionMismatch
        },
        transport: {
          ready: true,
          handoffOnly: true,
          authenticated: false,
          responseReceived: false,
          responseSchemaValid: false
        },
        requestCount: 0,
        requestOrdinal: 0,
        nativeShowCallCount: 0,
        nativeShowCompleted: false,
        requestedWindowMatches: false,
        sameWindowBeforeAfter: !options.sameWindowMismatch,
        ownerReportsForeground: focusSucceeded,
        messageDelta: { setFocus: 0, activate: 0, activateApp: 0 },
        userGestureGate: {
          required: true,
          readyEventCount: options.missingGestureReady ? 0 : 1,
          consumedEventCount: options.missingGestureConsumed ? 0 : 1,
          rejectedEventCount: options.gestureRejected ? 1 : 0,
          activationInputCount: options.duplicateGestureActivation ? 2 : 1,
          sourceWindowBound: !options.gestureSourceUnbound
        },
        focused: focusSucceeded,
        appReason: focusSucceeded
          ? "foreground-confirmed-from-user-gesture"
          : "user-gesture-foreground-not-observed",
        reason: focusSucceeded ? "foreground-confirmed" : "user-gesture-foreground-not-observed"
      }
    : closeProbeEvidenceSchema >= 2
      ? {
        schema: 2,
        source: "lifecycle-native-host",
        mechanism: "owner-process-native-show",
        attempted: true,
        handlePresent: true,
        handleFormatValid: true,
        windowValid: true,
        wasForeground: alreadyForeground,
        setForegroundResult: false,
        binding: {
          ownerThreadPresent: true,
          lifecycleProcessPresent: true,
          ownerMatchesLifecycleProcess: !options.lifecycleOwnerMismatch,
          ownerMatchesControlProcess: !options.controlOwnerMismatch,
          sameInteractiveSession: !options.sessionMismatch
        },
        transport: {
          ready: !options.transportFailed,
          handoffOnly: !options.wideControlServer,
          authenticated: !options.transportFailed,
          responseReceived: !options.transportFailed,
          responseSchemaValid: !options.transportFailed
        },
        requestCount: 1,
        requestOrdinal: 1,
        nativeShowCallCount,
        nativeShowCompleted: alreadyForeground ? false : !options.nativeShowFailed,
        requestedWindowMatches: !options.requestedWindowMismatch,
        sameWindowBeforeAfter: !options.sameWindowMismatch,
        ownerReportsForeground: focusSucceeded,
        messageDelta,
        focused: focusSucceeded,
        appReason: options.appReasonMismatch ? "foreground-not-confirmed" : appReason,
        reason: focusSucceeded ? "foreground-confirmed" : "owner-handoff-not-observed"
        }
      : {
        source: "lifecycle-native-host",
        attempted: true,
        handlePresent: true,
        handleFormatValid: true,
        windowValid: true,
        wasForeground: false,
        setForegroundResult: !options.presenterFocusFailed,
        focused: !options.presenterFocusFailed,
        reason: options.presenterFocusFailed ? "set-foreground-not-observed" : "focused"
      };
  if (userGestureGate && options.gestureFocusTransportWrong) {
    nativePresenterFocus.transport = {
      ready: false,
      handoffOnly: false,
      authenticated: true,
      responseReceived: true,
      responseSchemaValid: true
    };
  }
  if (userGestureGate && options.gestureFocusRequestOrdinalWrong) {
    nativePresenterFocus.requestOrdinal = 77;
  }
  if (userGestureGate && options.gestureFocusNullCounts) {
    nativePresenterFocus.requestCount = null;
    nativePresenterFocus.nativeShowCallCount = null;
  }
  if (userGestureGate && options.gestureFocusNativeFlagsWrong) {
    nativePresenterFocus.setForegroundResult = true;
    nativePresenterFocus.nativeShowCompleted = true;
    nativePresenterFocus.requestedWindowMatches = true;
  }
  if (userGestureGate && options.gestureFocusMessageDeltaWrong) {
    nativePresenterFocus.messageDelta = { setFocus: 1, activate: 1, activateApp: 1 };
  }
  if (userGestureGate && options.gestureFocusAppReasonWrong) {
    nativePresenterFocus.appReason = "wrong-branch";
  }
  if (options.presenterFocusLeaksRawHwnd) {
    nativePresenterFocus.hwnd = "0x1234";
  }
  if (closeProbeEvidenceSchema >= 2 && !userGestureGate) {
    const resultPath = path.join(root, "11-managed-web-open-and-wait", "result.log");
    const result = readSmokeResult(resultPath);
    if (!options.missingAppHandoff) {
      const appHandoff = {
        schema: 1,
        target: "lifecycle-native-host",
        mechanism: "owner-process-native-show",
        requestOrdinal: 1,
        precondition: {
          windows: true,
          presenterActive: true,
          hostOpen: true,
          hostVisible: true,
          hostOpaque: true,
          inputPassthrough: false,
          requestedWindowPresent: true,
          requestedWindowMatches: !options.requestedWindowMismatch,
          alreadyForeground
        },
        requestedWindowMatches: !options.requestedWindowMismatch,
        nativeShowCallCount,
        nativeShowCompleted: alreadyForeground ? false : !options.nativeShowFailed,
        sameWindowBeforeAfter: !options.sameWindowMismatch,
        ownerReportsForeground: focusSucceeded,
        messageDelta,
        reason: appReason
      };
      if (options.appHandoffLeaksRawHwnd) {
        appHandoff.hwnd = "0x1234";
      }
      if (options.appHandoffLeaksRawPid) {
        appHandoff.pid = 4245;
      }
      const appEvent = {
        type: "overlay:presenter-foreground-handoff",
        at: options.appHandoffAfterFocus
          ? "2026-07-02T00:00:03.500Z"
          : "2026-07-02T00:00:02.450Z",
        payload: appHandoff
      };
      result.snapshot.events.push(appEvent);
      if (options.duplicateAppHandoff) {
        result.snapshot.events.push({ ...appEvent });
      }
    }
    if (options.missingWindowFocus) {
      result.snapshot.window.focused = false;
    }
    writeResult(resultPath, result);
  }
  if (userGestureGate) {
    const resultPath = path.join(root, caseId, "result.log");
    const result = readSmokeResult(resultPath);
    const gateBinding = {
      senderMatches: !options.gestureSenderMismatch,
      mainFrameMatches: !options.gestureFrameMismatch,
      nonceMatches: !options.gestureNonceMismatch
    };
    const readyPayload = {
      schema: 1,
      mechanism: "same-process-user-gesture",
      action: reportedUserGestureAction,
      targetId: reportedUserGestureTargetId,
      ready: true,
      binding: gateBinding,
      target: gestureReadyRendererTarget,
      viewport: gestureReadyRendererViewport
    };
    const consumedPayload = {
      schema: 1,
      mechanism: "same-process-user-gesture",
      action: reportedUserGestureAction,
      targetId: reportedUserGestureTargetId,
      consumed: true,
      consumeCount: 1,
      binding: gateBinding,
      gesture: {
        trusted: !options.gestureUntrusted,
        userActivationActive: !options.gestureInactive,
        leftButton: true,
        singleClick: true
      }
    };
    if (options.gestureReadyLeaksNonce) {
      readyPayload.nonce = "private-capability";
    }
    if (options.gestureConsumedLeaksPid) {
      consumedPayload.pid = 4245;
    }
    const gateOpeningEvents = [];
    if (!options.missingGestureArmed) {
      const armedPayload = { action: reportedUserGestureAction };
      if (options.gestureArmedLeaksPid) {
        armedPayload.pid = 4245;
      }
      gateOpeningEvents.push({
        type: "autorun:user-gesture-gate-armed",
        at: "2026-07-02T00:00:01.050Z",
        payload: armedPayload
      });
    }
    if (!options.missingGestureReady) {
      gateOpeningEvents.push({
        type: "autorun:user-gesture-gate-ready",
        at: "2026-07-02T00:00:01.100Z",
        payload: readyPayload
      });
    }
    result.snapshot.events.unshift(...gateOpeningEvents);
    if (!options.missingGestureConsumed) {
      const openIndex = result.snapshot.events.findIndex(
        (event) => event.type === "overlay:presenter-open-and-wait-start"
      );
      result.snapshot.events.splice(Math.max(0, openIndex), 0, {
        type: "autorun:user-gesture-gate-consumed",
        at: options.gestureConsumedBeforeActivation
          ? "2026-07-02T00:00:01.160Z"
          : "2026-07-02T00:00:01.300Z",
        payload: consumedPayload
      });
    }
    if (options.gestureRejected) {
      result.snapshot.events.push({
        type: "autorun:user-gesture-gate-rejected",
        at: "2026-07-02T00:00:01.250Z",
        payload: { schema: 1, reason: "gesture-invalid" }
      });
    }
    const inactiveIndex = result.snapshot.events.findIndex(
      (event) => event.type === "callback:overlay-activated" && event.payload && event.payload.active === false
    );
    const waitClosedIndex = result.snapshot.events.findIndex(
      (event) => event.type === "overlay:presenter-wait-closed"
    );
    if (inactiveIndex >= 0 && waitClosedIndex > inactiveIndex) {
      const [inactive] = result.snapshot.events.splice(inactiveIndex, 1);
      const currentWaitClosedIndex = result.snapshot.events.findIndex(
        (event) => event.type === "overlay:presenter-wait-closed"
      );
      result.snapshot.events.splice(currentWaitClosedIndex + 1, 0, inactive);
    }
    writeResult(resultPath, result);
  }
  const nativePresenterPreDispatch = {
    source: "lifecycle-native-host",
    handlePresent: true,
    windowValid: true,
    ...(closeProbeEvidenceSchema >= 2
      ? {
          ownerMatches: !options.presenterPreDispatchOwnerMismatch,
          enabled: !options.presenterPreDispatchDisabled,
          notIconic: !options.presenterPreDispatchIconic
        }
      : {}),
    focused: !options.presenterPreDispatchFailed,
    reason: options.presenterPreDispatchFailed
      ? "foreground-lost-before-dispatch"
      : "foreground-confirmed"
  };
  if (options.presenterPreDispatchLeaksRawHwnd) {
    nativePresenterPreDispatch.hwnd = "0x1234";
  }
  if (options.focusHandoffLeaksRawPort && nativePresenterFocus.transport) {
    nativePresenterFocus.transport.port = 43123;
  }
  const closeProbeEvents = [
    {
      type: "probe:start",
      at: "2026-07-02T00:00:01.000Z",
      payload: {
        input: expectedCloseProbeInput,
        dpiAwareness,
        ...(closeProbeEvidenceSchema >= 2
          ? {
              evidenceSchema: options.startSchemaString
                ? String(closeProbeEvidenceSchema)
                : options.wrongStartSchema
                  ? 1
                  : closeProbeEvidenceSchema,
              foregroundHandoff: options.wrongStartHandoff
                ? "wrong-owner-handoff"
                : userGestureGate
                  ? SAME_PROCESS_USER_GESTURE_HANDOFF
                  : OWNER_PROCESS_FOREGROUND_HANDOFF,
              controlExpected: true,
              userGestureGate: options.gestureStartGateFalse ? false : userGestureGate,
              ...(userGestureGate && closeProbeEvidenceSchema === 3
                ? {
                    externalForegroundTransition: options.wrongExternalForegroundTransition
                      ? "wrong-external-foreground-transition"
                      : EXTERNAL_FOREGROUND_TRANSITION,
                    externalForegroundTransitionEnabled: true
                  }
                : {})
            }
          : {})
      }
    },
    {
      type: "probe:detected",
      at: "2026-07-02T00:00:02.000Z",
      payload: {
        foreground,
        screenshot: {
          ok: true,
          path: screenshotName,
          ...(!options.missingScreenshotBounds ? { bounds: screenshotBounds } : {})
        }
      }
    }
  ];
  if (userGestureGate) {
    const activationReadyTarget = {
      x: options.gestureNullCoordinates ? null : 150,
      y: options.gestureNullCoordinates ? null : 80,
      source: "renderer-button-physical-dpi",
      insideSourceClient: true
    };
    const activationBinding = {
      sourceProcessPresent: true,
      sourceWindowPresent: true,
      ownerMatchesLifecycleProcess: !options.gestureSourceOwnerMismatch,
      sourceMatchesControlProcess: !options.gestureSourceControlMismatch,
      ...(closeProbeEvidenceSchema === 3
        ? {
            sourceProcessIdentityPresent: true,
            sourceMatchesBoundWindow: true,
            sourceMatchesBoundProcessIdentity: true
          }
        : {}),
      sameInteractiveSession: !options.gestureSourceSessionMismatch,
      sourceWindowEnabled: true,
      sourceWindowNotIconic: true,
      sourceWindowForeground: !options.gestureSourceNotForeground
    };
    const activationDpi = {
      rendererScalePresent: true,
      windowDpiPresent: true,
      scaleAgrees: !options.gestureDpiMismatch,
      clientGeometryAgrees: !options.gestureClientGeometryMismatch,
      rendererScale: options.gestureNullScales ? null : 2.25,
      windowScale: options.gestureNullScales
        ? null
        : options.gestureWindowScaleClaimMismatch
          ? 3
          : options.gestureDpiMismatch
            ? 2
            : 2.25
    };
    const activationConfirmationDpi = {
      ...activationDpi,
      ...(options.gesturePreDispatchDpiDrift
        ? { scaleAgrees: true, clientGeometryAgrees: true, rendererScale: 2.25, windowScale: 2 }
        : {})
    };
    const activationPreDispatchClient = {
      originX: -1530,
      originY: 14,
      width: options.gesturePreDispatchClientSizeMismatch ? 2300 : 2385,
      height: 1710
    };
    const activationFinalDispatchClient = {
      originX: -1528,
      originY: 14,
      width: 2385,
      height: 1710
    };
    const activationPreDispatch = {
      eligible: !(
        options.gesturePreDispatchSourceMismatch ||
        options.gesturePreDispatchControlMismatch ||
        options.gesturePreDispatchPointMismatch ||
        options.gesturePreDispatchForegroundLost
      ),
      reason:
        options.gesturePreDispatchSourceMismatch ||
        options.gesturePreDispatchControlMismatch ||
        options.gesturePreDispatchPointMismatch ||
        options.gesturePreDispatchForegroundLost
          ? "gate-source-window-changed-before-dispatch"
          : "gate-source-window-confirmed-before-dispatch",
      binding: {
        sourceWindowValid: true,
        sourceOwnerPresent: true,
        sourceMatchesBoundProcess: !options.gesturePreDispatchSourceMismatch,
        ...(closeProbeEvidenceSchema === 3
          ? {
              sourceMatchesBoundProcessIdentity: !options.gesturePreDispatchSourceMismatch
            }
          : {}),
        sourceMatchesBoundWindow: !options.gesturePreDispatchBoundWindowMismatch,
        sourceMatchesControlProcess: !options.gesturePreDispatchControlMismatch,
        sameInteractiveSession: true,
        sourceWindowEnabled: true,
        sourceWindowNotIconic: true,
        targetInsideSourceClient: true,
        pointWindowPresent: true,
        pointOwnerMatchesBoundProcess: !options.gesturePreDispatchPointMismatch,
        pointRootMatchesSourceWindow: !options.gesturePreDispatchPointMismatch,
        sourceWindowForeground: !options.gesturePreDispatchForegroundLost
      },
      target: {
        x: options.gesturePreDispatchWrongReboundMath ? 181 : 180,
        y: 100,
        source: "renderer-button-physical-dpi-rebound",
        insideSourceClient: true,
        reboundFromReadyGeometry: true
      },
      clientGeometry: activationPreDispatchClient,
      rendererGeometry: {
        target: {
          ...gestureReadyRendererTarget,
          ...(options.gesturePreDispatchRendererGeometryMismatch ? { left: 701 } : {})
        },
        viewport: gestureReadyRendererViewport
      },
      dpi: activationConfirmationDpi
    };
    const activationFinalTarget = {
      x: options.gestureFinalWrongReboundMath ? 183 : 182,
      y: 100,
      source: "renderer-button-physical-dpi-rebound",
      insideSourceClient: true,
      reboundFromReadyGeometry: true
    };
    const activationFinalDispatch = options.gestureFinalDispatchMismatch
      ? {
          ...activationPreDispatch,
          eligible: false,
          reason: "gate-source-window-changed-before-dispatch",
          binding: {
            ...activationPreDispatch.binding,
            sourceWindowForeground: false
          },
          target: activationFinalTarget,
          clientGeometry: activationFinalDispatchClient
        }
      : {
          ...activationPreDispatch,
          target: activationFinalTarget,
          clientGeometry: activationFinalDispatchClient
        };
    const activationTarget = {
      ...activationFinalTarget,
      ...(options.gestureActivationFinalTargetMismatch ? { x: 353 } : {})
    };
    const activationPointer = {
      sent: options.gestureActivationPointerFailed ? 2 : 3,
      expected: 3,
      lastError: options.gestureActivationPointerFailed ? 5 : 0,
      method: "sendinput",
      x: options.gesturePointerUsesZeroArgumentDefaults
        ? 0
        : options.gesturePointerUsesPreTarget
          ? activationPreDispatch.target.x
          : activationTarget.x,
      y: options.gesturePointerUsesZeroArgumentDefaults
        ? 0
        : options.gesturePointerUsesPreTarget
          ? activationPreDispatch.target.y
          : activationTarget.y
    };
    const externalForegroundEvents = [];
    if (closeProbeEvidenceSchema === 3) {
      if (alreadyForeground) {
        if (!options.externalNotRequiredMissing) {
          const notRequiredEvent = {
            type: "probe:external-foreground-transition-not-required",
            at: "2026-07-02T00:00:01.140Z",
            payload: {
              schema: 1,
              mechanism: EXTERNAL_FOREGROUND_TRANSITION,
              action: reportedUserGestureAction,
              requestOrdinal: 0,
              alreadyForeground: true,
              binding: {
                ...activationBinding,
                sourceWindowForeground: true,
                ...(options.externalNotRequiredLeaksProcessStart
                  ? { sourceProcessStartTicks: 638870000000000000 }
                  : {})
              },
              activationInputCount: 0,
              closeInputCount: options.externalNotRequiredCloseInputCountWrong ? 1 : 0
            }
          };
          externalForegroundEvents.push(notRequiredEvent);
          if (options.externalNotRequiredDuplicate) {
            externalForegroundEvents.push({
              ...notRequiredEvent,
              at: "2026-07-02T00:00:01.141Z"
            });
          }
        }
      } else {
        const sourceReadyEvent = {
          type: "probe:external-foreground-source-ready",
          at: options.externalSourceReadyAfterObserved
            ? "2026-07-02T00:00:01.145Z"
            : "2026-07-02T00:00:01.115Z",
          payload: {
            schema: 1,
            mechanism: options.externalSourceReadyWrongMechanism
              ? "wrong-external-foreground-transition"
              : EXTERNAL_FOREGROUND_TRANSITION,
            action: reportedUserGestureAction,
            requestOrdinal: reportedExternalForegroundRequestOrdinal,
            sourceBound: true,
            transitionHookReady: true,
            binding: {
              ...activationBinding,
              sourceMatchesBoundProcessIdentity:
                !options.externalSourceReadyIdentityMismatch,
              sourceWindowForeground: options.externalSourceReadyForegroundTrue === true,
              ...(options.externalSourceReadyLeaksProcessStart
                ? { sourceProcessStartTicks: 638870000000000000 }
                : {}),
              ...(options.externalSourceReadyLeaksProcessStartUtc
                ? { sourceProcessStartTimeUtc: "2026-07-10T00:00:00.000Z" }
                : {})
            },
            dpi: activationDpi,
            targetReady: true,
            activationInputCount: options.externalSourceReadyInputCountWrong ? 1 : 0,
            closeInputCount: options.externalSourceReadyCloseInputCountWrong ? 1 : 0,
            ...(options.externalSourceReadyLeaksPid ? { pid: 4245 } : {})
          }
        };
        if (!options.externalSourceReadyMissing) {
          externalForegroundEvents.push(sourceReadyEvent);
          if (options.externalSourceReadyDuplicate) {
            externalForegroundEvents.push({
              ...sourceReadyEvent,
              at: "2026-07-02T00:00:01.116Z"
            });
          }
        }

        const controllerAckEvent = {
          type: "probe:external-foreground-controller-acknowledged",
          at: options.externalAckEventAfterObserved
            ? "2026-07-02T00:00:01.145Z"
            : "2026-07-02T00:00:01.135Z",
          payload: {
            schema: 1,
            mechanism: options.externalAckEventWrongMechanism
              ? "wrong-external-foreground-transition"
              : EXTERNAL_FOREGROUND_TRANSITION,
            action: reportedUserGestureAction,
            requestOrdinal: reportedExternalForegroundRequestOrdinal,
            markerWritten: true,
            controllerAckValid: true,
            clickCompleted: true,
            activationInputCount: options.externalAckEventActivationInputCountWrong ? 1 : 0,
            closeInputCount: options.externalAckEventCloseInputCountWrong ? 1 : 0,
            ...(options.externalAckEventLeaksPid ? { pid: 4245 } : {})
          }
        };
        if (!options.externalAckEventMissing) {
          externalForegroundEvents.push(controllerAckEvent);
          if (options.externalAckEventDuplicate) {
            externalForegroundEvents.push({
              ...controllerAckEvent,
              at: "2026-07-02T00:00:01.136Z"
            });
          }
        }

        const observedEvent = {
          type: "probe:external-foreground-transition-observed",
          at: options.externalObservedBeforeSourceReady
            ? "2026-07-02T00:00:01.105Z"
            : "2026-07-02T00:00:01.140Z",
          payload: {
            schema: 1,
            mechanism: options.externalObservedWrongMechanism
              ? "wrong-external-foreground-transition"
              : EXTERNAL_FOREGROUND_TRANSITION,
            action: reportedUserGestureAction,
            requestOrdinal: reportedExternalForegroundRequestOrdinal,
            transitionObserved: true,
            eventCount: options.externalObservedEventCountWrong ? 2 : 1,
            hookStopped: !options.externalObservedHookNotStopped,
            hookErrorPresent: options.externalObservedHookErrorPresent === true,
            binding: {
              ...activationPreDispatch.binding,
              sourceMatchesBoundProcessIdentity:
                !options.externalObservedIdentityMismatch,
              sourceWindowForeground: !options.externalObservedNotForeground
            },
            activationInputCount: options.externalObservedInputCountWrong ? 1 : 0,
            closeInputCount: options.externalObservedCloseInputCountWrong ? 1 : 0,
            ...(options.externalObservedLeaksHwnd ? { hwnd: "0x1234" } : {})
          }
        };
        if (!options.externalObservedMissing) {
          externalForegroundEvents.push(observedEvent);
          if (options.externalObservedDuplicate) {
            externalForegroundEvents.push({
              ...observedEvent,
              at: "2026-07-02T00:00:01.141Z"
            });
          }
        }
        if (options.externalRejected) {
          externalForegroundEvents.push({
            type: "probe:external-foreground-transition-rejected",
            at: "2026-07-02T00:00:01.142Z",
            payload: {
              schema: 1,
              mechanism: EXTERNAL_FOREGROUND_TRANSITION,
              action: reportedUserGestureAction,
              requestOrdinal: reportedExternalForegroundRequestOrdinal,
              reason: "external-foreground-source-changed",
              hookStarted: true,
              transitionObserved: true,
              activationInputCount: 0,
              closeInputCount: 0
            }
          });
        }
        if (!options.externalMarkerMissing) {
          writeJson(path.join(caseDir, "external-foreground-ready.json"), {
            kind: options.externalMarkerWrongKind
              ? "wrong-external-foreground-ready"
              : "steam-bridge-windows-external-foreground-ready",
            schema: 1,
            action: reportedUserGestureAction,
            requestOrdinal: options.externalMarkerOrdinalWrong
              ? 2
              : reportedExternalForegroundRequestOrdinal,
            mechanism: options.externalMarkerWrongMechanism
              ? "wrong-external-foreground-transition"
              : EXTERNAL_FOREGROUND_TRANSITION,
            challenge: options.externalMarkerChallengeInvalid ? "short" : "a".repeat(32),
            sourceBound: true,
            transitionHookReady: true,
            activationInputCount: options.externalMarkerInputCountWrong ? 1 : 0,
            closeInputCount: options.externalMarkerCloseInputCountWrong ? 1 : 0,
            ...(options.externalMarkerLeaksPid ? { pid: 4245 } : {})
          });
        }
        if (!options.externalAckFileMissing) {
          writeJson(path.join(caseDir, "external-foreground-ack.json"), {
            kind: options.externalAckFileWrongKind
              ? "wrong-external-foreground-ack"
              : "steam-bridge-windows-external-foreground-ack",
            schema: options.externalAckFileSchemaTypeWrong ? "1" : 1,
            action: reportedUserGestureAction,
            requestOrdinal: options.externalAckFileOrdinalWrong
              ? 2
              : reportedExternalForegroundRequestOrdinal,
            mechanism: options.externalAckFileWrongMechanism
              ? "wrong-external-foreground-transition"
              : EXTERNAL_FOREGROUND_TRANSITION,
            challenge: options.externalAckFileChallengeMismatch
              ? "b".repeat(32)
              : "a".repeat(32),
            clickCompleted: options.externalAckFileClickTypeWrong
              ? 1
              : !options.externalAckFileClickIncomplete,
            activationInputCount: options.externalAckFileActivationInputTypeWrong
              ? "0"
              : options.externalAckFileActivationInputCountWrong
                ? 1
                : 0,
            closeInputCount: options.externalAckFileCloseInputTypeWrong
              ? "0"
              : options.externalAckFileCloseInputCountWrong
                ? 1
                : 0,
            ...(options.externalAckFileLeaksPid ? { pid: 4245 } : {})
          });
        }
      }
    }
    closeProbeEvents.splice(
      1,
      0,
      ...externalForegroundEvents,
      {
        type: "probe:user-gesture-gate-ready",
        at: "2026-07-02T00:00:01.150Z",
        payload: {
          ready: true,
          reason: "gate-target-ready",
          binding: activationBinding,
          target: activationReadyTarget,
          dpi: activationDpi
        }
      },
      ...(!options.gesturePreDispatchMissing
        ? [
            {
              type: "probe:user-gesture-gate-pre-dispatch",
              at: "2026-07-02T00:00:01.175Z",
              payload: activationPreDispatch
            }
          ]
        : []),
      ...(!options.gestureDispatchStartMissing
        ? [
            {
              type: "probe:user-gesture-gate-activation-dispatch-start",
              at: "2026-07-02T00:00:01.185Z",
              payload: {
                input: "renderer-button-click-sendinput",
                target: {
                  ...activationPreDispatch.target,
                  ...(options.gestureDispatchStartTargetMismatch ? { x: 351 } : {})
                },
                preDispatch: options.gestureDispatchEmbeddedTargetMismatch
                  ? {
                      ...activationPreDispatch,
                      target: { ...activationPreDispatch.target, x: activationPreDispatch.target.x + 1 }
                    }
                  : activationPreDispatch,
                readyEventCount: 1,
                consumedEventCount: options.gestureDispatchStartStateWrong ? 1 : 0,
                rejectedEventCount: 0,
                ...(options.gestureDispatchStartLeaksPid ? { pid: 4245 } : {})
              }
            }
          ]
        : []),
      {
        type: "probe:user-gesture-gate-activation-sent",
        at: "2026-07-02T00:00:01.200Z",
        payload: {
          input: "renderer-button-click-sendinput",
          target: activationTarget,
          binding: activationBinding,
          dpi: activationDpi,
          preDispatch: activationPreDispatch,
          finalDispatch: activationFinalDispatch,
          nativePointerSent: activationPointer
        }
      },
      {
        type: "probe:user-gesture-gate-consumed",
        at: "2026-07-02T00:00:01.350Z",
        payload: {
          readyEventCount: options.missingGestureReady ? 0 : 1,
          consumedEventCount: options.missingGestureConsumed ? 0 : 1,
          rejectedEventCount: options.gestureRejected ? 1 : 0
        }
      }
    );
    if (options.externalRecordOrderWrong) {
      const sourceReadyIndex = closeProbeEvents.findIndex(
        (event) => event.type === "probe:external-foreground-source-ready"
      );
      const observedIndex = closeProbeEvents.findIndex(
        (event) => event.type === "probe:external-foreground-transition-observed"
      );
      if (sourceReadyIndex >= 0 && observedIndex >= 0) {
        const sourceReadyRecord = closeProbeEvents[sourceReadyIndex];
        closeProbeEvents[sourceReadyIndex] = closeProbeEvents[observedIndex];
        closeProbeEvents[observedIndex] = sourceReadyRecord;
      }
    }
    if (options.externalAckRecordOrderWrong) {
      const acknowledgedIndex = closeProbeEvents.findIndex(
        (event) => event.type === "probe:external-foreground-controller-acknowledged"
      );
      const observedIndex = closeProbeEvents.findIndex(
        (event) => event.type === "probe:external-foreground-transition-observed"
      );
      if (acknowledgedIndex >= 0 && observedIndex >= 0) {
        const acknowledgedRecord = closeProbeEvents[acknowledgedIndex];
        closeProbeEvents[acknowledgedIndex] = closeProbeEvents[observedIndex];
        closeProbeEvents[observedIndex] = acknowledgedRecord;
      }
    }
    if (options.duplicateGestureActivation) {
      const activationIndex = closeProbeEvents.findIndex(
        (event) => event.type === "probe:user-gesture-gate-activation-sent"
      );
      closeProbeEvents.splice(activationIndex + 1, 0, {
        type: "probe:user-gesture-gate-activation-sent",
        at: "2026-07-02T00:00:01.210Z",
        payload: closeProbeEvents[activationIndex].payload
      });
    }
    if (options.gestureForegroundClear) {
      closeProbeEvents.push({
        type: "probe:foreground-clear",
        at: "2026-07-02T00:00:02.100Z",
        payload: { attempted: true, reason: "application-error-dialog" }
      });
    }
  }
  const targetProbeEvent = {
    type: "probe:web-close-click-target",
    at: "2026-07-02T00:00:02.400Z",
    payload: { target, foreground }
  };
  if (closeProbeEvidenceSchema >= 2 && !options.targetAfterHandoff) {
    closeProbeEvents.push(targetProbeEvent);
  }
  if (!options.missingPresenterFocus && !options.presenterFocusAfterInput) {
    closeProbeEvents.push({
      type: "probe:native-presenter-focus",
      at: "2026-07-02T00:00:02.500Z",
      payload: nativePresenterFocus
    });
  }
  if (closeProbeEvidenceSchema < 2 || options.targetAfterHandoff) {
    closeProbeEvents.push(targetProbeEvent);
  }
  closeProbeEvents.push(
    {
      type: "probe:sent",
      at: "2026-07-02T00:00:04.000Z",
      payload: {
        input: options.actualInputMismatch ? "toggle-sendinput" : expectedCloseProbeInput,
        ...(!options.missingPresenterPreDispatch
          ? { nativePresenterPreDispatch }
          : {}),
        nativePointerSent: pointer,
        foreground
      }
    }
  );
  if (userGestureGate) {
    closeProbeEvents.push({
      type: "probe:user-gesture-app-focus-return",
      at: "2026-07-02T00:00:05.000Z",
      payload: {
        observed: !options.gestureFocusReturnMissing,
        lifecycleComplete: true,
        sourceWindowValid: true,
        ownerMatches: true,
        sameInteractiveSession: true,
        focused: !options.gestureFocusReturnMissing,
        reason: options.gestureFocusReturnMissing
          ? "focus-return-timeout"
          : "exact-source-window-foreground"
      }
    });
    if (!options.gestureProbeCompleteMissing) {
      closeProbeEvents.push({
      type: options.gestureProbeIncomplete
        ? "probe:incomplete"
        : options.gestureProbeTimeout
          ? "probe:timeout"
          : "probe:complete",
        at: "2026-07-02T00:00:05.100Z",
        payload: options.gestureProbeIncomplete
          ? { reason: "source-focus-return-not-observed", sentCount: 1, expectedCloseCount: 1 }
          : options.gestureProbeTimeout
            ? { shortcutToggleProbe: false, sentCount: 1, expectedCloseCount: 1 }
            : { sentCount: 1, expectedCloseCount: 1 }
      });
      if (options.gestureProbeCompleteDuplicate) {
        closeProbeEvents.push({
          type: "probe:complete",
          at: "2026-07-02T00:00:05.110Z",
          payload: { sentCount: 1, expectedCloseCount: 1 }
        });
      }
    }

    const completeEventCount = options.gestureProbeCompleteMissing
      ? 0
      : options.gestureProbeCompleteDuplicate
        ? 2
        : options.gestureProbeIncomplete || options.gestureProbeTimeout
          ? 0
          : 1;
    const incompleteEventCount = options.gestureProbeIncomplete ? 1 : 0;
    const timeoutEventCount = options.gestureProbeTimeout ? 1 : 0;
    const terminalEventCount = completeEventCount + incompleteEventCount + timeoutEventCount;
    const terminalExclusive =
      !options.gestureProbeExitNonzero && terminalEventCount === 1;
    const terminalOk = Boolean(
      terminalExclusive &&
        completeEventCount === 1 &&
        incompleteEventCount === 0 &&
        timeoutEventCount === 0 &&
        !options.gestureFocusReturnMissing
    );
    const controlDescriptorValid = Boolean(
      terminalOk && !options.gestureCompletionControlInvalid
    );
    const controlProcessMatchesResult = Boolean(
      controlDescriptorValid && !options.gestureCompletionPidMismatch
    );
    const quitAttempted = Boolean(
      terminalOk &&
        controlProcessMatchesResult &&
        !options.gestureCompletionQuitAttemptedMissing
    );
    const quitResponseOk = Boolean(quitAttempted && !options.gestureCompletionQuitRejected);
    const sourceProcessExited = Boolean(
      quitResponseOk && !options.gestureCompletionSourceExitMissing
    );
    const completionEvidenceFixture = {
      schema: 1,
      required: true,
      probeProcessExited: true,
      probeExitCode: options.gestureProbeExitNonzero ? 1 : 0,
      probeLogPresent: true,
      probeParseErrorCount: 0,
      completeEventCount,
      incompleteEventCount,
      timeoutEventCount,
      terminalEventCount,
      terminalExclusive,
      focusReturnEventCount: 1,
      focusReturnObserved: !options.gestureFocusReturnMissing,
      controlDescriptorValid,
      controlHandoffOnly: controlDescriptorValid,
      controlProcessMatchesResult,
      quitAttempted,
      quitResponseOk,
      sourceProcessExited,
      ok: Boolean(terminalOk && controlProcessMatchesResult && quitResponseOk && sourceProcessExited)
    };
    if (options.gestureCompletionLeaksPid) {
      completionEvidenceFixture.pid = 4245;
    }
    writeJson(path.join(caseDir, "user-gesture-completion.json"), completionEvidenceFixture);

    const completionLifecycle = [
      {
        type: "event:autorun:result-written",
        at: "2026-07-02T00:00:04.200Z",
        payload: {
          action: reportedUserGestureAction,
          resultFileWritten: !options.gestureResultWriteFalse
        }
      },
      {
        type: "event:autorun:keep-open-after-result",
        at: "2026-07-02T00:00:04.210Z",
        payload: { action: reportedUserGestureAction, resultFileWritten: true }
      },
      ...(!options.gestureAfterCloseStableMissing
        ? [
            {
              type: "event:overlay:presenter-after-close-stable",
              at: "2026-07-02T00:00:04.500Z",
              payload: { sample: 2 }
            }
          ]
        : []),
      ...(!options.gestureCompletionQuitMissing
        ? [
            {
              type: "event:control:user-gesture-completion-quit",
              at: options.gestureCompletionQuitBeforeFocus
                ? "2026-07-02T00:00:04.900Z"
                : "2026-07-02T00:00:05.200Z",
              payload: {
                action: reportedUserGestureAction,
                resultFileWritten: true,
                gateConsumed: true,
                ...(options.gestureCompletionQuitLeaksPort ? { port: 43123 } : {})
              }
            }
          ]
        : []),
      ...(!options.gestureGracefulShutdownMissing
        ? [
            { type: "app:before-quit", at: "2026-07-02T00:00:05.300Z", payload: {} },
            { type: "app:will-quit", at: "2026-07-02T00:00:05.400Z", payload: {} },
            {
              type: "process:exit",
              at: "2026-07-02T00:00:05.500Z",
              payload: { exitCode: options.gestureProcessExitNonzero ? 1 : 0 }
            },
            {
              type: "app:quit",
              at: "2026-07-02T00:00:05.510Z",
              payload: { exitCode: options.gestureAppQuitNonzero ? 1 : 0 }
            }
          ]
        : []),
      ...(options.gestureLateFatal
        ? [
            {
              type: "process:unhandled-rejection",
              at: "2026-07-02T00:00:05.505Z",
              payload: { name: "Error", message: "late fixture failure" }
            }
          ]
        : [])
    ];
    writeText(
      path.join(caseDir, "diagnostics", "lifecycle.jsonl"),
      completionLifecycle.map((entry) => JSON.stringify(entry)).join("\n") + "\n"
    );
  }
  if (!options.missingPresenterFocus && options.presenterFocusAfterInput) {
    closeProbeEvents.push({
      type: "probe:native-presenter-focus",
      at: "2026-07-02T00:00:04.500Z",
      payload: nativePresenterFocus
    });
  }
  if (options.skipInsteadOfSend) {
    const sentIndex = closeProbeEvents.findIndex((event) => event.type === "probe:sent");
    if (sentIndex >= 0) {
      closeProbeEvents.splice(sentIndex, 1);
    }
    closeProbeEvents.push({
      type: "probe:close-input-skipped",
      at: "2026-07-02T00:00:04.000Z",
      payload: { reason: "native-presenter-focus-not-confirmed", focus: nativePresenterFocus }
    });
  } else if (options.bothTerminalBranches) {
    closeProbeEvents.push({
      type: "probe:close-input-skipped",
      at: "2026-07-02T00:00:04.100Z",
      payload: { reason: "unexpected-second-terminal" }
    });
  }
  if (options.stripGestureEvidenceExceptFocus) {
    const retainedProbeEvents = closeProbeEvents.filter(
      (event) =>
        event.type === "probe:start" ||
        event.type === "probe:native-presenter-focus" ||
        (!event.type.includes("user-gesture") && !event.type.includes("external-foreground"))
    );
    closeProbeEvents.splice(0, closeProbeEvents.length, ...retainedProbeEvents);
    const start = closeProbeEvents.find((event) => event.type === "probe:start");
    start.payload.evidenceSchema = 2;
    start.payload.foregroundHandoff = OWNER_PROCESS_FOREGROUND_HANDOFF;
    start.payload.userGestureGate = false;
    delete start.payload.externalForegroundTransition;
    delete start.payload.externalForegroundTransitionEnabled;
    const resultPath = path.join(root, caseId, "result.log");
    const strippedResult = readSmokeResult(resultPath);
    strippedResult.snapshot.events = strippedResult.snapshot.events.filter(
      (event) => !String(event.type || "").includes("user-gesture")
    );
    writeResult(resultPath, strippedResult);
    fs.rmSync(path.join(caseDir, "user-gesture-completion.json"), { force: true });
    fs.rmSync(path.join(caseDir, "external-foreground-ready.json"), { force: true });
    fs.rmSync(path.join(caseDir, "external-foreground-ack.json"), { force: true });
    fs.rmSync(path.join(caseDir, "diagnostics", "lifecycle.jsonl"), { force: true });
  }
  writeText(
    path.join(caseDir, "close-probe.log"),
    closeProbeEvents.map((entry) => JSON.stringify(entry)).join("\n") + "\n"
  );
  if (options.omitManifest) {
    fs.rmSync(manifestPath, { force: true });
  }
}

function attachedWindowsPresenterFixture(options = {}) {
  const backend = options.backend || "windows-d3d11";
  const logicalBounds = options.roundingBoundaryScale
    ? { x: 4, y: 4, width: 800, height: 600 }
    : { x: 4, y: 4, width: 80, height: 60 };
  const nativeRect = options.roundingBoundaryScale
    ? { left: 10, top: 10, width: 1001, height: 751 }
    : { left: 10, top: 10, width: 180, height: 135 };
  return {
    mode: "active",
    attached: true,
    nativeHostOpen: true,
    backend,
    ...(!options.omitLogicalBounds ? { bounds: logicalBounds } : {}),
    nativeHostDiagnostics: {
      backend: options.hostBackend || backend,
      ...(!options.omitNativeRect ? { rect: nativeRect } : {}),
      hwnd: "0x1234",
      renderer: {
        backend: options.rendererBackend || backend
      }
    }
  };
}

function writePassivePollingFixture(root, options = {}) {
  const caseId = "25-managed-achievement-progress";
  const initial = passiveWindowsPresenterFixture({ lightweightPollCount: 2, fullDiagnosticsPollCount: 1 });
  const transition = passiveWindowsPresenterFixture({
    overlayNeedsPresent: true,
    transparent: false,
    currentFps: 30,
    lightweightPollCount: 3,
    fullDiagnosticsPollCount: 1,
    lastLightweightPollAt: 130,
    lastFullDiagnosticsPollAt: 100,
    rendererBackend: options.wrongRenderer ? "windows-opengl" : "windows-d3d11"
  });
  const parked = passiveWindowsPresenterFixture({
    lightweightPollCount: 32,
    fullDiagnosticsPollCount: options.hotFullDiagnostics ? 20 : 4,
    lastLightweightPollAt: 1100,
    lastFullDiagnosticsPollAt: 1000
  });
  if (options.missingTransitionCounter) {
    delete transition.lightweightPollCount;
  }
  const events = [
    { type: "overlay:presenter-attach", payload: { presenter: initial } },
    { type: "achievement:progress", payload: { indicated: true, presenter: initial } }
  ];
  if (!options.omitTransition) {
    events.push({
      type: "overlay:passive-notification-needs-present",
      payload: {
        action: "presenter-achievement-progress",
        previousOverlayNeedsPresent: false,
        overlayNeedsPresent: true,
        observedAt: 130,
        pollIntervalMs: WINDOWS_LIGHTWEIGHT_POLL_INTERVAL_MS,
        lightweightPollCount: transition.lightweightPollCount,
        lastLightweightPollAt: transition.lastLightweightPollAt,
        fullDiagnosticsPollCount: transition.fullDiagnosticsPollCount,
        lastFullDiagnosticsPollAt: transition.lastFullDiagnosticsPollAt,
        presenter: transition
      }
    });
  }
  events.push({
    type: "overlay:passive-notification-parked",
    payload: {
      action: "presenter-achievement-progress",
      pumps: 10,
      durationMs: 1000,
      presenter: parked
    }
  });

  writeJson(path.join(root, "matrix-manifest.json"), {
    kind: "steam-bridge-windows-overlay-matrix-manifest",
    generatedAt: "2026-07-10T00:00:00.000Z",
    suite: "managed",
    launchMode: "steam-launch",
    appId: 480,
    onlyCase: caseId,
    expectedCaseCount: 1,
    expectedNativeHostBackend: "windows-d3d11",
    cases: [
      {
        id: caseId,
        action: "presenter-achievement-progress",
        requireEvent: [
          "overlay:presenter-attach",
          "achievement:progress",
          "overlay:passive-notification-needs-present",
          "overlay:passive-notification-parked"
        ],
        requireOverlayActivated: false,
        requireNoOverlayActivation: true,
        allowOverlayNotReady: true,
        requirePassiveNotification: true,
        requireManagedOverlayComplete: false,
        managedOverlayResultMode: "",
        hasCheckoutTransactionId: false,
        persistentReuseCycles: 0
      }
    ]
  });
  writeStandardPreflight(root);
  writeResult(path.join(root, caseId, "result.log"), {
    ok: true,
    action: { ok: true, action: "presenter-achievement-progress" },
    snapshot: {
      ...buildWindowsSnapshot({ pid: 4249, events }),
      overlay: { nativePresenter: { ok: true, value: parked } }
    }
  });
}

function passiveWindowsPresenterFixture(options = {}) {
  return {
    mode: "passive",
    attached: true,
    nativeHostOpen: true,
    nativeSurfaceOwner: true,
    closed: false,
    backend: "windows-d3d11",
    clickThrough: true,
    focusable: false,
    transparent: options.transparent ?? true,
    overlayActive: false,
    overlayNeedsPresent: options.overlayNeedsPresent ?? false,
    currentFps: options.currentFps ?? 0,
    pollIntervalMs: WINDOWS_LIGHTWEIGHT_POLL_INTERVAL_MS,
    lightweightPollCount: options.lightweightPollCount ?? 0,
    lastLightweightPollAt: options.lastLightweightPollAt,
    fullDiagnosticsPollCount: options.fullDiagnosticsPollCount ?? 0,
    lastFullDiagnosticsPollAt: options.lastFullDiagnosticsPollAt,
    nativeHostDiagnostics: {
      backend: "windows-d3d11",
      hwnd: "0x1234",
      renderer: { backend: options.rendererBackend || "windows-d3d11" }
    }
  };
}

function writePersistentReuseFixture(root, options = {}) {
  const caseId = "40-persistent-reuse-three-cycle";
  const controllerGeneration = 7;
  const leaseGeneration = 11;
  const instanceGeneration = 13;
  const hostToken = "a".repeat(64);
  const events = [
    { type: "overlay:presenter-attach", payload: { presenter: attachedWindowsPresenterFixture() } },
    {
      type: "overlay:presenter-persistent-reuse-start",
      payload: {
        cycles: WINDOWS_PERSISTENT_REUSE_CYCLES,
        controllerGeneration,
        nativeSurfaceLeaseGeneration: leaseGeneration,
        presenterMode: "persistent",
        readiness: { canWait: true, reason: "ready", waitReason: "ready" },
        foregroundHandoffOrdinals: [1, 2, 3]
      }
    }
  ];
  for (let cycle = 1; cycle <= WINDOWS_PERSISTENT_REUSE_CYCLES; cycle += 1) {
    const shown = persistentReuseEvidenceFixture({
      cycle,
      controllerGeneration,
      leaseGeneration,
      instanceGeneration,
      hostToken: options.changedHostToken && cycle === 2 ? "b".repeat(64) : hostToken,
      phase: "shown",
      attachCount: options.secondAttach && cycle === 2 ? 2 : 1
    });
    const parked = persistentReuseEvidenceFixture({
      cycle,
      controllerGeneration,
      leaseGeneration,
      instanceGeneration,
      hostToken,
      phase: "parked",
      attachCount: 1
    });
    events.push(
      { type: "overlay:presenter-wait-shown", payload: { api: "persistentReuseThreeCycle", cycle, presenter: attachedWindowsPresenterFixture() } },
      { type: "callback:overlay-activated", payload: { active: true } },
      { type: "callback:overlay-activated", payload: { active: false } },
      { type: "overlay:presenter-persistent-reuse-cycle", payload: { cycle, shown, parked } }
    );
  }
  if (options.outOfOrderCycle) {
    const cycleEventIndexes = events
      .map((event, index) => (event.type === "overlay:presenter-persistent-reuse-cycle" ? index : -1))
      .filter((index) => index >= 0);
    const firstCycle = events[cycleEventIndexes[0]];
    events[cycleEventIndexes[0]] = events[cycleEventIndexes[1]];
    events[cycleEventIndexes[1]] = firstCycle;
  }
  events.push({
    type: "overlay:presenter-persistent-reuse-complete",
    payload: {
      cyclesCompleted: WINDOWS_PERSISTENT_REUSE_CYCLES,
      controllerGeneration,
      nativeSurfaceLeaseGeneration: leaseGeneration,
      surfaceInstanceGeneration: instanceGeneration,
      nativeHostIdentityToken: hostToken,
      nativeHostIdentityPresent: true,
      attachCount: 1,
      detachCount: 0,
      backend: "windows-d3d11",
      hostBackend: "windows-d3d11",
      rendererBackend: "windows-d3d11"
    }
  });

  writeJson(path.join(root, "matrix-manifest.json"), {
    kind: "steam-bridge-windows-overlay-matrix-manifest",
    generatedAt: "2026-07-10T00:00:00.000Z",
    suite: "persistent-reuse",
    launchMode: "steam-launch",
    appId: 480,
    onlyCase: caseId,
    expectedCaseCount: 1,
    expectedNativeHostBackend: "windows-d3d11",
    closeProbe: true,
    closeProbeEvidenceSchema: 2,
    closeProbeForegroundHandoff: OWNER_PROCESS_FOREGROUND_HANDOFF,
    cleanupContract: {
      processCleanupRequired: true,
      launchEnvRollbackRequired: true,
      taskCleanupExpected: true
    },
    cases: [
      {
        id: caseId,
        action: PERSISTENT_REUSE_ACTION,
        requireEvent: [
          "overlay:presenter-persistent-reuse-start",
          "overlay:presenter-persistent-reuse-cycle",
          "overlay:presenter-persistent-reuse-complete"
        ],
        requireOverlayActivated: true,
        requireNoOverlayActivation: false,
        allowOverlayNotReady: false,
        requireManagedOverlayComplete: false,
        managedOverlayResultMode: "",
        expectedCloseProbeInput: "web-close-click-sendinput",
        hasCheckoutTransactionId: false,
        persistentReuseCycles: WINDOWS_PERSISTENT_REUSE_CYCLES
      }
    ]
  });
  writeStandardPreflight(root);
  writeJson(path.join(root, caseId, "persistent-control-readiness.json"), {
    kind: "steam-bridge-windows-persistent-control-readiness",
    generatedAt: "2026-07-10T00:00:00.000Z",
    ok: true,
    controlProcessMatches: true,
    windowsX64: true,
    steamInitialized: true,
    presenterOpen: true,
    presenterOwned: true,
    persistentMode: true,
    controllerGenerationPositive: true,
    nativeSurfaceLeaseGenerationPositive: true,
    cycles: WINDOWS_PERSISTENT_REUSE_CYCLES
  });
  const resultPresenter = {
    ...passiveWindowsPresenterFixture({ lightweightPollCount: 20, fullDiagnosticsPollCount: 3 }),
    nativeSurfaceLeaseGeneration: leaseGeneration,
    nativeHostDiagnostics: {
      backend: "windows-d3d11",
      surfaceInstanceGeneration: instanceGeneration,
      hwnd: "0x1234",
      renderer: { backend: "windows-d3d11" }
    },
    electronOverlay: { presenterMode: "persistent", controllerGeneration }
  };
  writeResult(path.join(root, caseId, "result.log"), {
    ok: true,
    action: { ok: true, action: PERSISTENT_REUSE_ACTION },
    snapshot: {
      ...buildWindowsSnapshot({ pid: 4250, managedOverlayResultMode: "complete", events }),
      overlay: { nativePresenter: { ok: true, value: resultPresenter } }
    }
  });
  const lifecycle = events.map((event) => ({
    type: `event:${event.type}`,
    at: "2026-07-10T00:00:01.000Z",
    pid: 4250,
    payload: event.payload || {}
  }));
  lifecycle.push({
    type: "event:overlay:presenter-close",
    at: "2026-07-10T00:00:10.000Z",
    pid: 4250,
    payload: {
      presenter: {
        closed: true,
        closeReason: "closed",
        nativeSurfaceOwner: false,
        nativeHostOpen: false,
        attached: options.terminalCloseStillAttached ? true : false,
        backend: "none",
        nativeSurfaceAttachCount: 1,
        nativeSurfaceDetachCount: 1,
        lastError: null
      }
    }
  });
  writeText(
    path.join(root, caseId, "diagnostics", "lifecycle.jsonl"),
    `${lifecycle.map((entry) => JSON.stringify(entry)).join("\n")}\n`
  );
  const closeProbeEvents = [];
  for (let cycle = 1; cycle <= WINDOWS_PERSISTENT_REUSE_CYCLES; cycle += 1) {
    closeProbeEvents.push(
      {
        type: "probe:native-presenter-focus",
        payload: { cycle, requestCount: 1, requestOrdinal: cycle, focused: true }
      },
      {
        type: "probe:sent",
        payload: { cycle, nativePresenterPreDispatch: { cycle, focused: true } }
      }
    );
  }
  if (options.wrongCloseOrdinal) {
    closeProbeEvents[2].payload.requestOrdinal = 1;
  }
  closeProbeEvents.push({
    type: "probe:complete",
    payload: { sentCount: WINDOWS_PERSISTENT_REUSE_CYCLES, expectedCloseCount: WINDOWS_PERSISTENT_REUSE_CYCLES }
  });
  writeText(
    path.join(root, caseId, "close-probe.log"),
    `${closeProbeEvents.map((entry) => JSON.stringify(entry)).join("\n")}\n`
  );
  writeCleanupFixture(root, options);
}

function persistentReuseEvidenceFixture(options) {
  const shown = options.phase === "shown";
  return {
    controllerGeneration: options.controllerGeneration,
    nativeSurfaceLeaseGeneration: options.leaseGeneration,
    surfaceInstanceGeneration: options.instanceGeneration,
    nativeHostIdentityToken: options.hostToken,
    nativeHostIdentityPresent: true,
    nativeHostOpen: true,
    attached: true,
    nativeSurfaceOwner: true,
    closed: false,
    closeReason: null,
    backend: "windows-d3d11",
    hostBackend: "windows-d3d11",
    rendererBackend: "windows-d3d11",
    attachCount: options.attachCount,
    detachCount: 0,
    mode: shown ? "active" : "passive",
    overlayActive: shown,
    overlayNeedsPresent: false,
    clickThrough: !shown,
    transparent: !shown,
    currentFps: shown ? 30 : 0,
    pollIntervalMs: WINDOWS_LIGHTWEIGHT_POLL_INTERVAL_MS,
    lightweightPollCount: options.cycle * 10,
    lastLightweightPollAt: options.cycle * 100,
    fullDiagnosticsPollCount: options.cycle,
    lastFullDiagnosticsPollAt: options.cycle * 100
  };
}

function writeCleanupFixture(root, options = {}) {
  const cleanup = (phase) => {
    const hasSyntheticProcess =
      options.processCleanupMissingIdentity ||
      options.processCleanupUnknownStop ||
      options.processCleanupDuplicateResult;
    return {
      kind: "steam-bridge-windows-smoke-process-cleanup",
      phase,
      generatedAt: "2026-07-10T00:00:00.000Z",
      ok: true,
      processesBeforeCleanup: options.processCleanupDuplicateResult
        ? [
            { processId: 100, creationDatePresent: true },
            { processId: 200, creationDatePresent: true }
          ]
        : hasSyntheticProcess
          ? [{ processId: 100, creationDatePresent: !options.processCleanupMissingIdentity }]
        : [],
      cleanupResults: options.processCleanupDuplicateResult
        ? [
            { processId: 100, status: "terminated", error: null },
            { processId: 100, status: "terminated", error: null }
          ]
        : hasSyntheticProcess
          ? [{ processId: 100, status: options.processCleanupUnknownStop ? "unsafe-stop" : "terminated", error: null }]
        : [],
      processesAfterCleanup: []
    };
  };
  writeJson(path.join(root, "smoke-process-cleanup-before-run.json"), cleanup("before-run"));
  if (!options.omitAfterCleanup) {
    writeJson(path.join(root, "smoke-process-cleanup-after-cases.json"), cleanup("after-cases"));
  }
  writeJson(path.join(root, "launch-env-rollback.json"), {
    kind: "steam-bridge-windows-launch-env-rollback",
    generatedAt: "2026-07-10T00:00:00.000Z",
    attempted: true,
    originalPresent: true,
    backupCreated: true,
    generatedRemoved: true,
    originalRestored: true,
    restoredBytesMatch: options.rollbackByteMismatch ? false : true,
    backupRemoved: true,
    ok: options.rollbackFailed || options.rollbackByteMismatch ? false : true,
    error: options.rollbackFailed ? "launch-env-rollback-failed" : ""
  });
  const taskLaunchEnvOk = !options.taskGuardByteMismatch;
  const taskProcessOk = !options.taskProcessLeftover;
  const taskRunnerOk = !options.taskRunnerLeftover;
  const taskFileOk = !options.taskFilesLeft;
  const taskDeadline = options.taskDeadlineTimeout === true || options.taskTimedOutNoRootStop === true;
  const runnerDoneMissing = options.taskRunnerDoneMissing === true;
  const taskCleanupOk =
    !options.taskDeletionUnverified &&
    !options.taskDeleteExitUncaptured &&
    !options.taskQueryExitUncaptured &&
    !options.taskQueryWrongExit &&
    !options.taskCleanupPhaseError &&
    taskRunnerOk &&
    !options.taskTimedOutNoRootStop &&
    taskLaunchEnvOk &&
    taskProcessOk &&
    taskFileOk;
  writeJson(path.join(root, "task-cleanup.json"), {
    kind: "steam-bridge-windows-overlay-task-cleanup",
    generatedAt: "2026-07-10T00:00:00.000Z",
    timedOut: taskDeadline,
    runnerTerminatedWithoutDone: runnerDoneMissing,
    failureStage: runnerDoneMissing ? "runner-termination" : taskDeadline ? "runner-timeout" : "success",
    errorKind: runnerDoneMissing ? "done-missing" : taskDeadline ? "deadline-exceeded" : "none",
    errorPresent: runnerDoneMissing || taskDeadline,
    endAttempted: runnerDoneMissing || taskDeadline,
    endExitCodeCaptured: runnerDoneMissing || taskDeadline,
    endExitCode: runnerDoneMissing ? 1 : taskDeadline ? 0 : null,
    keepTask: false,
    deleteAttempted: true,
    deleteExitCodeCaptured: !options.taskDeleteExitUncaptured,
    deleteExitCode: 0,
    queryExitCodeCaptured: !options.taskQueryExitUncaptured,
    queryExitCode: options.taskQueryWrongExit ? -1 : 1,
    deletionVerified: options.taskDeletionUnverified ? false : true,
    cleanupPhaseErrorCount: options.taskCleanupPhaseError ? 1 : 0,
    runnerProcessGuard: {
      required: true,
      attempted: true,
      completedMarkerObserved: !runnerDoneMissing && !taskDeadline,
      captureAttempted: true,
      captureSucceeded: true,
      captureWaitMilliseconds: 100,
      capturedRootCount: 1,
      capturedTreeProcessCount: 4,
      trackingAttemptCount: 4,
      trackingFailureCount: 0,
      ancestryRejectionCount: 0,
      treeTerminationRequired: runnerDoneMissing || taskDeadline,
      enumerationSucceeded: true,
      processesBeforeCount: options.taskRunnerLeftover || taskDeadline ? 1 : 0,
      rootStopAttemptCount: taskDeadline && !options.taskTimedOutNoRootStop ? 1 : 0,
      rootStopTerminatedCount:
        (taskDeadline && !options.taskTimedOutNoRootStop ? 1 : 0) +
        (options.taskRootStopCounterImbalance ? 1 : 0),
      rootStopNotFoundCount: 0,
      rootStopAlreadyExitedCount: 0,
      rootStopIdentityMismatchCount: 0,
      rootStopWaitTimeoutCount: 0,
      rootStopFailureCount: 0,
      fallbackStopAttemptCount: options.taskRunnerLeftover ? 1 : 0,
      fallbackStopTerminatedCount: 0,
      fallbackStopNotFoundCount: 0,
      fallbackStopAlreadyExitedCount: 0,
      fallbackStopIdentityMismatchCount: 0,
      fallbackStopWaitTimeoutCount: 0,
      fallbackStopFailureCount: options.taskRunnerLeftover ? 1 : 0,
      processesAfterCount: options.taskRunnerLeftover ? 1 : 0,
      emptyVerificationScanCount: options.taskRunnerLeftover ? 0 : 2,
      verifiedEmpty: taskRunnerOk,
      ok: taskRunnerOk
    },
    launchEnvGuard: {
      required: true,
      attempted: true,
      originalPresent: true,
      backupCreated: true,
      generatedRemoved: true,
      originalRestored: true,
      restoredBytesMatch: taskLaunchEnvOk,
      backupRemoved: true,
      ok: taskLaunchEnvOk
    },
    packageProcessGuard: {
      required: true,
      attempted: true,
      enumerationSucceeded: true,
      processesBeforeCount: options.taskProcessLeftover ? 1 : 0,
      stopAttemptCount: options.taskProcessLeftover ? 1 : 0,
      stopTerminatedCount: 0,
      stopNotFoundCount: 0,
      stopAlreadyExitedCount: 0,
      stopIdentityMismatchCount: 0,
      stopWaitTimeoutCount: 0,
      stopFailureCount: options.taskProcessLeftover ? 1 : 0,
      processesAfterCount: options.taskProcessLeftover ? 1 : 0,
      emptyVerificationScanCount: options.taskProcessLeftover ? 0 : 2,
      verifiedEmpty: taskProcessOk,
      ok: taskProcessOk
    },
    taskFileGuard: {
      required: true,
      attempted: true,
      directoryPresentBefore: true,
      entryCountBefore: 4,
      directoryRemoved: taskFileOk,
      verifiedAbsent: taskFileOk,
      ok: taskFileOk
    },
    ok: taskCleanupOk
  });
}

function writeStandardPreflight(root) {
  writeJson(path.join(root, "00-preflight", "preflight.json"), {
    kind: "steam-bridge-windows-preflight",
    generatedAt: "2026-07-10T00:00:00.000Z",
    app: { exe: { exists: true }, nativeAddon: { exists: true } },
    appControlPolicy: { verifiedAndReputableEnforced: false },
    recentCodeIntegrityEvents: [],
    windowsSession: {
      currentSessionId: 1,
      interactiveSessionIds: [1],
      currentSessionInteractive: true
    }
  });
}

function writeDuplicateOpenGuardCaseFixture(root, options = {}) {
  const caseId = "11b-managed-duplicate-open-guard";
  const action = "presenter-duplicate-open-guard";
  writeManagedCaseFixture(root, {
    caseId,
    action,
    requiredEvents: duplicateOpenGuardRequiredEventsFixture(),
    events: duplicateOpenGuardEventsFixture(options)
  });
}

function duplicateOpenGuardRequiredEventsFixture() {
  return [
    "overlay:presenter-open-and-wait-start",
    "overlay:presenter-duplicate-open-guard",
    "overlay:presenter-wait-closed",
    "overlay:presenter-parked",
    "overlay:presenter-open-and-wait-complete"
  ];
}

function duplicateOpenGuardPayloadFixture(options = {}) {
  const guardPayload = {
    status: duplicateOpenBusyStatusFixture(),
    shortcutStatus: duplicateOpenBusyStatusFixture(),
    openIfAvailableNull: true,
    openAndWaitIfAvailableNull: true,
    shortcutIfAvailableNull: true,
    shortcutAndWaitIfAvailableNull: true,
    checkoutOpenIfAvailableNull: true,
    checkoutIfAvailableNull: true,
    checkoutOperationRan: options.checkoutOperationRan === true
  };
  if (!options.omitNamedStatuses) {
    guardPayload.namedStatuses = duplicateOpenNamedBusyStatusesFixture();
    if (options.omitCheckoutOperationCanStart) {
      delete guardPayload.namedStatuses.checkoutOperation.canStartOperation;
    }
  }
  if (!options.omitNamedIfAvailableNulls) {
    guardPayload.namedIfAvailableNulls = duplicateOpenNamedNullsFixture();
  }
  if (!options.omitNamedAndWaitIfAvailableNulls) {
    guardPayload.namedAndWaitIfAvailableNulls = duplicateOpenNamedNullsFixture();
  }
  return guardPayload;
}

function duplicateOpenGuardEventsFixture(options = {}) {
  return [
    { type: "overlay:presenter-open-and-wait-start" },
    {
      type: "overlay:presenter-duplicate-open-guard",
      payload: duplicateOpenGuardPayloadFixture(options)
    },
    ...(options.duplicateGuardEvent
      ? [
          {
            type: "overlay:presenter-duplicate-open-guard",
            payload: duplicateOpenGuardPayloadFixture(options)
          }
        ]
      : []),
    { type: "callback:overlay-activated", payload: { active: true } },
    { type: "callback:overlay-activated", payload: { active: false } },
    { type: "overlay:presenter-wait-closed" },
    { type: "overlay:presenter-parked" },
    { type: "overlay:presenter-open-and-wait-complete" }
  ];
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
  const statuses = {};
  for (const name of DUPLICATE_OPEN_NAMED_TARGET_NAMES) {
    statuses[name] = duplicateOpenBusyStatusFixture();
  }
  statuses.checkoutOperation = duplicateOpenBusyStatusFixture({ canStartOperation: false });
  return statuses;
}

function duplicateOpenNamedNullsFixture() {
  const values = {};
  for (const name of DUPLICATE_OPEN_NAMED_TARGET_NAMES) {
    values[name] = true;
  }
  return values;
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
      ...(!options.omitMicroTxnCurrentOperationMatch
        ? { matchesCurrentCheckoutOperation: options.microTxnCurrentOperationMatch !== false }
        : {}),
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
    const query = {
      schema: options.clientQuerySchema ?? CLIENT_SESSION_QUERY_SCHEMA,
      attempted: options.clientQueryAttempted !== false,
      reason: options.clientQueryReason || "none",
      endpoint: options.clientQueryEndpoint || "sandbox",
      id: options.clientQueryId || "transaction",
      ok: true,
      httpStatus: options.clientQueryHttpStatus ?? 200,
      result: options.clientQueryResult || "OK",
      status: options.clientQueryStatus || "Init",
      errorCode: options.clientQueryErrorCode || "missing",
      requestError: options.clientQueryRequestError || "none",
      hasErrorDescription: false,
      hasTransactionId: options.clientQueryHasTransactionId !== false,
      hasOrderId: true,
      hasSteamId64: true,
      ...(options.clientQueryExtra || {})
    };
    const queryInitTxn = options.clientQueryInitTxnEndpoint
      ? { ...initTxn, endpoint: options.clientQueryInitTxnEndpoint }
      : initTxn;
    const events = [];
    pushMicroTxnListenerRegisteredEvents(events, options);
    events.push(
      { type: "overlay:presenter-wait-start", payload: { target: "checkout" } },
      {
        type: "overlay:presenter-open",
        payload: {
          target: "checkout",
          api: "openCheckoutAndWait",
          checkoutSource: "init-txn-request-file"
        }
      }
    );
    if (!options.omitManagedCheckoutOperationStart) {
      events.push({
        type: "checkout:managed-operation-start",
        payload: {
          target: "checkout",
          api: "openCheckoutAndWait",
          checkoutSource: "init-txn-request-file",
          deferredInitTxn: true,
          shownObserverArmed: true,
          callbackCorrelationPrepared: true,
          presenter: {
            mode: "active",
            nativeHostOpen: true,
            clickThrough: false,
            transparent: false
          }
        }
      });
    }
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
      { type: "overlay:presenter-wait-shown:error", payload: { target: "checkout", error } },
      {
        type: "checkout:client-session-wait-timeout",
        payload: { target: "checkout", targetSnapshot, initTxn, error }
      }
    );
    if (!options.omitClientSessionQuery && !options.clientQueryAfterPromptMissing) {
      events.push({
        type: "checkout:client-session-query",
        payload: {
          target: "checkout",
          targetSnapshot,
          initTxn: queryInitTxn,
          query
        }
      });
    }
    events.push(
      {
        type: "checkout:client-session-prompt-missing",
        payload: {
          target: "checkout",
          targetSnapshot,
          expectedSteamPrompt: true,
          error,
          initTxn
        }
      },
      {
        type: "overlay:presenter-checkout-open-and-wait:error",
        payload: { target: "checkout", targetSnapshot, error, initTxn }
      }
    );
    if (!options.omitClientSessionQuery && options.clientQueryAfterPromptMissing) {
      events.push({
        type: "checkout:client-session-query",
        payload: { target: "checkout", targetSnapshot, initTxn: queryInitTxn, query }
      });
    }
    if (options.appendInvalidPromptMissingEvent) {
      events.push({
        type: "checkout:client-session-prompt-missing",
        payload: {
          target: "checkout",
          targetSnapshot: { type: "store", clientSession: false },
          error,
          initTxn
        }
      });
    }
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
  if (options.includeStaleMicroTxn) {
    events.push(microTxnCallbackEventFixture({ ...options, microTxnCurrentOperationMatch: false }));
  }
  if (!options.omitMicroTxn && !options.lateMicroTxn) {
    events.push(microTxnEvent);
    if (options.includeLegacyMicroTxnDuplicate) {
      events.push(microTxnCallbackEventFixture({ ...options, callbackSource: "legacy" }));
    }
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
    window: { present: true, visible: true, focused: true, minimized: false },
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
