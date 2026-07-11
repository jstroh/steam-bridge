#!/usr/bin/env node

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { isDeepStrictEqual } = require("node:util");
const {
  canonicalJson,
  createCandidateBinding,
  hashCanonicalJson,
  validateCandidateBinding,
  verifyCandidateDirectory
} = require("./windows-release-candidate-fingerprint.cjs");
const { summarizeWindowsOverlayMatrixArtifacts } = require("./summarize-windows-overlay-matrix.cjs");

const RECEIPT_KIND = "steam-bridge-windows-live-proof-receipt";
const RECEIPT_SCHEMA_VERSION = 1;
const RECEIPT_HASH_DOMAIN = "steam-bridge-windows-live-proof-receipt-v1";
const EVIDENCE_HASH_DOMAIN = "steam-bridge-windows-live-proof-evidence-v1";
const RECEIPT_PREFIX = "STEAM_BRIDGE_WINDOWS_LIVE_PROOF_RECEIPT ";
const PUBLIC_APP_ID = 480;
const EXPECTED_BACKEND = "windows-d3d11";
const EXPECTED_HOST_STYLE = "popup-layered";
const EXPECTED_HEALTH_MINUTES = 30;
const OWNER_PROCESS_HANDOFF = "owner-process-native-show-v1";
const SAME_PROCESS_HANDOFF = "same-process-user-gesture-v1";
const EXTERNAL_FOREGROUND_TRANSITION = "external-foreground-event-v1";
const USER_GESTURE_POLICY = "single-cycle-active-v1";
const PERSISTENT_REUSE_POLICY = "initial-user-gesture-verify-only-v1";
const MAX_JSON_BYTES = 16 * 1024 * 1024;

const WAIT_EVENTS = Object.freeze([
  "overlay:presenter-open-and-wait-start",
  "overlay:presenter-wait-closed",
  "overlay:presenter-parked",
  "overlay:presenter-open-and-wait-complete"
]);
const SHORTCUT_WAIT_EVENTS = Object.freeze([
  "overlay:presenter-open-and-wait-start",
  "overlay:shortcut-open",
  "overlay:presenter-wait-closed",
  "overlay:presenter-parked",
  "overlay:presenter-open-and-wait-complete"
]);
const KEYBOARD_EVENTS = Object.freeze([
  "overlay:presenter-shortcut-ready",
  "overlay:shortcut-open",
  "overlay:presenter-wait-shown",
  "overlay:presenter-wait-closed",
  "overlay:presenter-parked"
]);

const MATRIX_MANIFEST_KEYS = Object.freeze([
  "allowUnhealthyDefaultRender",
  "allowUnhealthySteamClientLogs",
  "appId",
  "assumeShortcutConfigured",
  "autorunUserGestureGatePolicy",
  "candidateBinding",
  "candidatePathHasNoReparsePoints",
  "cases",
  "cleanStaleOverlayHelpers",
  "cleanupContract",
  "closeProbe",
  "closeProbeEvidenceSchema",
  "closeProbeForegroundHandoff",
  "closeProbeInput",
  "closeProbeSettleMs",
  "closeProbeTimeoutSeconds",
  "expectedCaseCount",
  "expectedNativeHostBackend",
  "generatedAt",
  "initTxnCapture",
  "installShortcut",
  "javaScriptRunnerExeConfigured",
  "kind",
  "launchEnvOutsideCandidate",
  "launchEnvPathHasNoReparsePoints",
  "launchEnvUsesDefaultPath",
  "launchKind",
  "launchMode",
  "nativeHostBackend",
  "nativeHostStyle",
  "nativePathOverride",
  "onlyCase",
  "overlayDisableDirectComposition",
  "overlayInProcessGpu",
  "overlayIsolateChildProcesses",
  "overlayProfile",
  "overlayScrubChildEnv",
  "persistentReuseGatePolicy",
  "presenterMode",
  "privateEnvImported",
  "requireMicroTxnCallback",
  "shortcutExeConfigured",
  "shortcutLaunchPrefixConfigured",
  "shortcutNamePresent",
  "shortcutStartDirConfigured",
  "skipNativeLoadGate",
  "skipRenderHealthGate",
  "steamClientHealthRecentMinutes",
  "suite",
  "supportedCloseProbeEvidenceSchemas",
  "supportedCloseProbeForegroundHandoffs",
  "supportedExternalForegroundTransitions",
  "supportedPersistentReuseEvidenceSchemas",
  "targetHints",
  "timeoutSeconds",
  "webUrlUsesPublicDefault",
  "windowMode"
]);

const CASE_KEYS = Object.freeze([
  "action",
  "allowOverlayNotReady",
  "autorunUserGestureGate",
  "closeProbeEvidenceSchema",
  "closeProbeForegroundHandoff",
  "closeProbeOnActivation",
  "closeVerificationOrdinals",
  "dialog",
  "expectedCloseProbeInput",
  "externalForegroundTransition",
  "hasCheckoutJsonFile",
  "hasCheckoutTransactionId",
  "hasInitTxnRequestFile",
  "id",
  "initialUserGestureCycle",
  "managedOverlayResultMode",
  "persistentReuseCycles",
  "persistentReuseEvidenceSchema",
  "persistentReuseGate",
  "persistentReuseGatePolicy",
  "requireEvent",
  "requireManagedOverlayComplete",
  "requireMicroTxnCallback",
  "requireNoOverlayActivation",
  "requireOverlayActivated",
  "requirePassiveNotification",
  "resultDelayMs",
  "shortcutTarget",
  "shortcutToggleProbe",
  "storeRoute",
  "userDialog",
  "verifyOnlyCycles",
  "webModal"
]);

const PROFILE_CONTRACTS = Object.freeze(buildProfileContracts());
const TOTAL_CASE_COUNT = PROFILE_CONTRACTS.reduce((total, profile) => total + profile.cases.length, 0);
const TOTAL_ACTIVE_CASE_COUNT = PROFILE_CONTRACTS.reduce(
  (total, profile) => total + profile.cases.filter((entry) => entry.requireOverlayActivated).length,
  0
);

if (require.main === module) {
  if (process.argv.includes("--self-test")) {
    selfTest();
    console.log("Windows live-proof receipt self-test passed.");
  } else {
    try {
      main();
    } catch {
      console.error("Windows live-proof receipt generation failed closed.");
      process.exitCode = 1;
    }
  }
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  const receipt = generateLiveProofReceipt(options);
  writePrivateJson(options.output, receipt);
  console.log(`${RECEIPT_PREFIX}${receipt.receiptSha256}`);
}

function parseArgs(args) {
  const names = new Map([
    ["--audit-manifest", "auditManifest"],
    ["--candidate-directory", "candidateDirectory"],
    ["--persistent-reuse-root", "persistentReuseRoot"],
    ["--checkout-root", "checkoutRoot"],
    ["--shortcut-routes-root", "shortcutRoutesRoot"],
    ["--managed-routes-root", "managedRoutesRoot"],
    ["--output", "output"]
  ]);
  const options = {};
  for (let index = 0; index < args.length; index += 2) {
    const name = args[index];
    const key = names.get(name);
    assert.ok(key, "Unknown live-proof receipt argument.");
    assert.equal(options[key], undefined, "Duplicate live-proof receipt argument.");
    const value = args[index + 1];
    assert.ok(value && !value.startsWith("--"), "Live-proof receipt argument is missing a value.");
    options[key] = value;
  }
  assert.equal(Object.keys(options).length, names.size, "Live-proof receipt arguments are incomplete.");
  return options;
}

function generateLiveProofReceipt(options) {
  const audit = readJsonArtifact(path.resolve(options.auditManifest), "package audit manifest").value;
  const candidateBinding = createCandidateBinding(audit);
  const candidateDirectory = path.resolve(options.candidateDirectory);
  const rootsByProfile = {
    "persistent-reuse": options.persistentReuseRoot,
    checkout: options.checkoutRoot,
    "shortcut-routes": options.shortcutRoutesRoot,
    "managed-routes": options.managedRoutesRoot
  };
  validateReceiptOutputLocation(options.output, candidateDirectory, Object.values(rootsByProfile));
  const seenRoots = new Set();
  const validatedProfiles = [];
  const steamIdentities = [];

  for (const contract of PROFILE_CONTRACTS) {
    const root = validateArtifactRoot(rootsByProfile[contract.name]);
    const rootKey = fs.realpathSync.native(root).toLowerCase();
    assert.ok(!seenRoots.has(rootKey), "Live-proof profile roots must be distinct.");
    seenRoots.add(rootKey);
    const manifestArtifact = readJsonArtifact(path.join(root, "matrix-manifest.json"), "matrix manifest");
    const cleanupPath = path.join(root, "task-cleanup.json");
    const cleanupArtifact = readJsonArtifact(cleanupPath, "task cleanup");
    validatePublicManifest(manifestArtifact.value, contract, candidateBinding);
    const summary = summarizeWindowsOverlayMatrixArtifacts(root);
    const manifestAfterSummary = readJsonArtifact(path.join(root, "matrix-manifest.json"), "matrix manifest");
    const cleanupAfterSummary = readJsonArtifact(cleanupPath, "task cleanup");
    assert.ok(
      manifestArtifact.bytes.equals(manifestAfterSummary.bytes),
      "Matrix manifest changed while its live proof was summarized."
    );
    assert.ok(
      cleanupArtifact.bytes.equals(cleanupAfterSummary.bytes),
      "Task cleanup changed while its live proof was summarized."
    );
    validateProfileSummary(summary, contract, candidateBinding);
    const steamIdentity = readSteamContinuityIdentity(cleanupArtifact.value);
    steamIdentities.push(steamIdentity);
    validatedProfiles.push({
      contract,
      generatedAt: manifestArtifact.value.generatedAt,
      manifestSha256: sha256(manifestArtifact.bytes),
      summary
    });
  }

  for (let index = 1; index < validatedProfiles.length; index += 1) {
    assert.ok(
      Date.parse(validatedProfiles[index - 1].generatedAt) <= Date.parse(validatedProfiles[index].generatedAt),
      "Live-proof profiles were not run in the required order."
    );
  }
  assert.ok(
    steamIdentities.every((identity) => identity === steamIdentities[0]),
    "Steam identity changed between live-proof profiles."
  );
  const finalCandidateBinding = verifyCandidateDirectory(
    candidateDirectory,
    audit
  );
  assert.deepEqual(finalCandidateBinding, candidateBinding, "Candidate directory changed after live proof.");
  const profiles = validatedProfiles.map(({ contract, manifestSha256, summary }) =>
    buildProfileReceipt(contract, manifestSha256, summary, candidateBinding)
  );
  return assembleLiveProofReceipt(candidateBinding, profiles, new Date().toISOString(), true);
}

function validatePublicManifest(manifest, contract, candidateBinding) {
  assertExactKeys(manifest, MATRIX_MANIFEST_KEYS, "matrix manifest");
  assert.equal(manifest.kind, "steam-bridge-windows-overlay-matrix-manifest");
  assertIsoTimestamp(manifest.generatedAt, "matrix manifest timestamp");
  assert.equal(manifest.suite, contract.suite);
  assert.equal(manifest.launchMode, "steam-launch");
  assert.equal(manifest.launchKind, "shortcut");
  assert.equal(manifest.candidatePathHasNoReparsePoints, true);
  assert.equal(manifest.launchEnvOutsideCandidate, true);
  assert.equal(manifest.launchEnvPathHasNoReparsePoints, true);
  assert.equal(manifest.launchEnvUsesDefaultPath, true);
  assert.equal(manifest.appId, PUBLIC_APP_ID);
  assert.equal(manifest.onlyCase, "");
  assert.equal(manifest.expectedCaseCount, contract.cases.length);
  assert.equal(manifest.webUrlUsesPublicDefault, true);
  assert.equal(manifest.shortcutNamePresent, true);
  assert.equal(manifest.shortcutExeConfigured, false);
  assert.equal(manifest.shortcutStartDirConfigured, false);
  assert.equal(manifest.shortcutLaunchPrefixConfigured, false);
  assert.equal(manifest.javaScriptRunnerExeConfigured, false);
  assert.equal(manifest.overlayProfile, "diagnostic");
  assert.equal(manifest.presenterMode, "");
  assert.equal(manifest.nativeHostBackend, "");
  assert.equal(manifest.nativeHostStyle, "");
  assert.equal(manifest.expectedNativeHostBackend, EXPECTED_BACKEND);
  assert.equal(manifest.nativePathOverride, false);
  assert.equal(manifest.overlayInProcessGpu, "");
  assert.equal(manifest.overlayDisableDirectComposition, "");
  assert.equal(manifest.overlayScrubChildEnv, "");
  assert.equal(manifest.overlayIsolateChildProcesses, "");
  assert.equal(manifest.windowMode, "windowed");
  assert.equal(manifest.closeProbe, true);
  assert.equal(manifest.closeProbeInput, "auto");
  assert.equal(manifest.timeoutSeconds, 120);
  assert.equal(manifest.closeProbeSettleMs, 750);
  assert.equal(manifest.closeProbeTimeoutSeconds, 110);
  assert.equal(manifest.autorunUserGestureGatePolicy, USER_GESTURE_POLICY);
  assert.equal(manifest.persistentReuseGatePolicy, PERSISTENT_REUSE_POLICY);
  assert.deepEqual(manifest.supportedPersistentReuseEvidenceSchemas, [1]);
  assert.equal(manifest.closeProbeEvidenceSchema, 2);
  assert.deepEqual(manifest.supportedCloseProbeEvidenceSchemas, [2, 3]);
  assert.equal(manifest.closeProbeForegroundHandoff, OWNER_PROCESS_HANDOFF);
  assert.deepEqual(manifest.supportedCloseProbeForegroundHandoffs, [OWNER_PROCESS_HANDOFF, SAME_PROCESS_HANDOFF]);
  assert.deepEqual(manifest.supportedExternalForegroundTransitions, [EXTERNAL_FOREGROUND_TRANSITION]);
  assert.equal(manifest.skipNativeLoadGate, false);
  assert.equal(manifest.skipRenderHealthGate, false);
  assert.equal(manifest.allowUnhealthyDefaultRender, false);
  assert.equal(manifest.allowUnhealthySteamClientLogs, false);
  assert.equal(manifest.cleanStaleOverlayHelpers, false);
  assert.equal(manifest.steamClientHealthRecentMinutes, EXPECTED_HEALTH_MINUTES);
  assert.equal(manifest.privateEnvImported, false);
  assert.equal(manifest.requireMicroTxnCallback, false);
  validateCandidateBinding(manifest.candidateBinding);
  assert.deepEqual(manifest.candidateBinding, candidateBinding);
  assert.equal(candidateBinding.signing.required, true);
  assert.equal(
    candidateBinding.signing.expectedPublisherSubjectConfigured ||
      candidateBinding.signing.expectedPublisherThumbprintConfigured,
    true
  );
  assert.equal(candidateBinding.signing.appExecutablePublisherMatches, true);
  assert.equal(candidateBinding.signing.nativeAddonPublisherMatches, true);

  assertExactKeys(
    manifest.cleanupContract,
    ["launchEnvRollbackRequired", "processCleanupRequired", "steamContinuityRequired", "taskCleanupExpected"],
    "matrix cleanup contract"
  );
  assert.deepEqual(manifest.cleanupContract, {
    processCleanupRequired: true,
    launchEnvRollbackRequired: true,
    taskCleanupExpected: true,
    steamContinuityRequired: true
  });
  assertExactKeys(
    manifest.initTxnCapture,
    ["apiKeyEnvProvided", "captureInApp", "endpointOption", "hasRequestFile", "hasResponseFile", "publicSyntheticCheckout"],
    "matrix InitTxn capture"
  );
  assert.deepEqual(manifest.initTxnCapture, {
    hasRequestFile: false,
    hasResponseFile: false,
    captureInApp: false,
    apiKeyEnvProvided: false,
    endpointOption: "",
    publicSyntheticCheckout: contract.suite === "checkout"
  });
  assert.equal(manifest.installShortcut, false);
  assert.equal(manifest.assumeShortcutConfigured, true);
  assertExactKeys(
    manifest.targetHints,
    [
      "dialog",
      "hasCheckoutJsonFile",
      "hasCheckoutTransactionId",
      "hasInitTxnRequestFile",
      "hasWebUrl",
      "shortcutTarget",
      "storeRoute",
      "userDialog"
    ],
    "matrix target hints"
  );
  assert.deepEqual(manifest.targetHints, {
    hasWebUrl: true,
    storeRoute: "web",
    dialog: "Friends",
    userDialog: "steamid",
    shortcutTarget: "friends",
    hasCheckoutTransactionId: true,
    hasCheckoutJsonFile: false,
    hasInitTxnRequestFile: false
  });
  assert.ok(Array.isArray(manifest.cases));
  for (const entry of manifest.cases) {
    assertExactKeys(entry, CASE_KEYS, "matrix case");
  }
  assert.deepEqual(manifest.cases, contract.cases);
}

function validateProfileSummary(summary, contract, candidateBinding) {
  assert.ok(summary && typeof summary === "object" && !Array.isArray(summary));
  assert.deepEqual(summary.failures, []);
  assert.deepEqual(summary.warnings, []);
  assert.equal(summary.nativeLoadBlocker, null);
  assert.deepEqual(summary.caseAppControlBlockers, []);
  assert.deepEqual(summary.steamLaunchBlockers, []);
  assert.equal(summary.initTxnRequestShapePreflight, null);
  assert.deepEqual(summary.manifest?.candidateBinding, candidateBinding);

  const preflight = summary.preflight;
  assert.ok(preflight);
  assert.equal(preflight.appId, PUBLIC_APP_ID);
  assert.equal(preflight.steamRunning, true);
  assert.equal(preflight.currentSessionInteractive, true);
  assert.equal(preflight.executableExists, true);
  assert.equal(preflight.executableNonEmpty, true);
  assert.equal(preflight.executableAuthenticodeValid, true);
  assert.equal(preflight.executableZoneIdentifier, false);
  assert.equal(preflight.nativeAddonExists, true);
  assert.equal(preflight.nativeAddonNonEmpty, true);
  assert.equal(preflight.nativeAddonAuthenticodeValid, true);
  assert.equal(preflight.nativeAddonZoneIdentifier, false);
  assert.equal(preflight.publisherMatches, true);
  assert.equal(preflight.nativeOverridePresent, false);
  assert.equal(preflight.nativePathOverride, false);
  assert.equal(preflight.packagedRuntimeResolutionErrorPresent, false);

  const readiness = summary.liveRunReadiness;
  assert.ok(readiness);
  assert.equal(readiness.ready, true);
  assert.equal(readiness.errorCount, 0);
  assert.equal(readiness.warningCount, 0);
  assert.equal(readiness.currentSessionInteractive, true);
  assert.equal(readiness.steamProcessCount, 1);
  assert.equal(readiness.staleOverlayHelperCount, 0);
  assert.equal(readiness.renderingHealthStatus, "healthy");
  assert.equal(readiness.renderingHealthRecentSevereSignalCount, 0);
  assert.equal(readiness.renderingHealthStaleSevereSignalCount, 0);

  const shortcut = summary.assumedShortcut;
  assert.ok(shortcut);
  assert.equal(shortcut.ok, true);
  assert.equal(shortcut.changed, false);
  assert.equal(shortcut.existingMatches, true);
  assert.equal(shortcut.expectedExeExists, true);
  assert.equal(shortcut.existingExeExists, true);

  const render = summary.renderHealth;
  assert.ok(render);
  assert.equal(render.gatePresent, true);
  assert.equal(render.summaryPresent, true);
  assert.equal(render.required, true);
  assert.equal(render.skipped, false);
  assert.equal(render.passed, true);
  assert.equal(render.errorPresent, false);
  assert.equal(render.status, "default-render-health-ok");
  assert.equal(render.readyForSteamOverlayMatrix, true);
  assert.equal(render.defaultCasePresent, true);
  assert.equal(render.defaultVisible, true);
  assert.equal(render.defaultBlankLike, false);
  assert.equal(render.defaultFatalLifecycleEventCount, 0);

  const nativeLoad = summary.nativeLoadGate;
  assert.ok(nativeLoad);
  assert.equal(nativeLoad.ok, true);
  assert.equal(nativeLoad.appId, PUBLIC_APP_ID);
  assert.equal(nativeLoad.action, "presenter-ready");
  assert.equal(nativeLoad.backend, EXPECTED_BACKEND);
  assert.equal(nativeLoad.hostBackend, EXPECTED_BACKEND);
  assert.equal(nativeLoad.rendererBackend, EXPECTED_BACKEND);
  assert.equal(nativeLoad.backendAgrees, true);
  assert.ok(nativeLoad.lifecycleCompleteCount >= 1);
  assert.equal(nativeLoad.crashDumpCount, 0);
  assert.equal(nativeLoad.fatalLifecycleEventCount, 0);
  validateRuntimeConfig(nativeLoad.runtimeConfig, candidateBinding.electronVersion, false);

  const cleanup = summary.cleanup;
  assert.ok(cleanup);
  for (const field of [
    "processBeforeOk",
    "processAfterOk",
    "processAfterRenderHealthOk",
    "launchEnvRollbackOk",
    "launchEnvRollbackAttempted",
    "taskCleanupOk",
    "taskDeletionVerified",
    "taskDeleteExitCodeCaptured",
    "taskAbsenceQueryExitCodeCaptured",
    "taskRunnerGuardOk",
    "taskLaunchEnvGuardOk",
    "taskPackageProcessGuardOk",
    "taskSteamContinuityGuardOk",
    "steamContinuityRequired",
    "sameSteamIdentitySet",
    "sameSteamSessionSet",
    "taskFileGuardOk"
  ]) {
    assert.equal(cleanup[field], true);
  }
  assert.equal(cleanup.taskAbsenceQueryExitCode, 1);
  assert.equal(cleanup.taskCleanupPhaseErrorCount, 0);
  assert.equal(cleanup.taskTimedOut, false);
  assert.equal(cleanup.taskRunnerTerminatedWithoutDone, false);
  assert.equal(cleanup.taskFailureStage, "success");
  assert.equal(cleanup.taskErrorKind, "none");
  assert.equal(cleanup.taskRunLevel, "Limited");
  assert.equal(cleanup.steamContinuityBeforeCount, 1);
  assert.equal(cleanup.steamContinuityAfterCount, 1);

  assert.equal(summary.totals.totalCases, contract.cases.length);
  assert.equal(summary.totals.steamLaunchCases, contract.cases.length);
  assert.equal(summary.totals.overlayActiveCases, contract.activeCaseCount);
  assert.equal(summary.totals.cleanCases, contract.cases.length);
  assert.equal(summary.totals.renderingUnhealthyCases, 0);
  assert.equal(summary.caseSummaries.length, contract.cases.length);
  const rows = new Map(summary.caseSummaries.map((row) => [row.caseName, row]));
  assert.equal(rows.size, contract.cases.length);
  for (const expected of contract.cases) {
    const row = rows.get(expected.id);
    assert.ok(row, "Live-proof case summary is missing.");
    assert.deepEqual(row.failures, []);
    assert.equal(row.action, expected.action);
    assert.equal(row.appId, PUBLIC_APP_ID);
    assert.equal(
      row.managedOverlayResultMode,
      expected.requireManagedOverlayComplete ? "complete" : "shown"
    );
    assert.equal(row.steamLaunch, true);
    assert.equal(row.overlayInjection, true);
    assert.equal(row.steamOverlayLaunchMarker, true);
    assert.equal(row.overlayEnabled, true);
    assert.equal(row.crashDumpCount, 0);
    assert.equal(row.fatalLifecycleEventCount, 0);
    assert.equal(row.initTxnRequestShapePresent, false);
    assert.equal(row.webSessionCheckoutCaptured, false);
    assert.equal(row.clientSessionCheckoutCaptured, false);
    assert.equal(row.microTxnCallbackCount, 0);
    validateRuntimeConfig(
      row.runtimeConfig,
      candidateBinding.electronVersion,
      expected.hasCheckoutTransactionId
    );
    validateBackendEvidence(row.presenterBackendEvidence);
    assert.ok(row.steamRenderingHealth);
    assert.equal(row.steamRenderingHealth.status, "healthy");
    assert.equal(row.steamRenderingHealth.recentSevereSignalCount, 0);
    assert.equal(row.steamRenderingHealth.staleSevereSignalCount, 0);
    assert.deepEqual(row.steamRenderingHealth.signalCodes, []);
    if (expected.requireManagedOverlayComplete) {
      assert.equal(row.managedOverlayCloseProof, true);
    }
    if (expected.persistentReuseGate) {
      assert.equal(row.persistentReuseProof, true);
    }
    if (expected.requirePassiveNotification) {
      assert.equal(row.passiveNotificationProof, true);
    }
    if (expected.id === "11b-managed-duplicate-open-guard") {
      assert.equal(row.duplicateOpenGuardProof, true);
    }
    assert.equal(row.overlayActiveEvents > 0, expected.requireOverlayActivated);
  }
}

function validateRuntimeConfig(config, electronVersion, hasCheckoutTransactionId) {
  assertExactKeys(
    config,
    [
      "achievementNameConfigured",
      "achievementProgressUsesDefaults",
      "actualNativeHostStyle",
      "authIdentityUsesPublicDefault",
      "complete",
      "configuredNativeHostBackend",
      "configuredNativeHostStyle",
      "configuredPresenterMode",
      "disableElectronOverlayPresenter",
      "electronVersion",
      "hasCheckoutJsonFile",
      "hasCheckoutReturnUrl",
      "hasCheckoutTransactionId",
      "hasCheckoutUrl",
      "hasInitTxnApiKeyEnv",
      "hasInitTxnRequestFile",
      "initTxnEndpointConfigured",
      "isPackaged",
      "managedOverlayParkTimeoutMs",
      "managedOverlayWaitTimeoutMs",
      "nativePathOverride",
      "overlayDisableDirectComposition",
      "overlayInProcessGpu",
      "overlayIsolateChildProcesses",
      "overlayProfile",
      "overlayScrubChildEnv",
      "presenterMode",
      "webUrlUsesPublicDefault"
    ],
    "resolved runtime config"
  );
  assert.deepEqual(config, {
    complete: true,
    authIdentityUsesPublicDefault: true,
    overlayProfile: "diagnostic",
    overlayScrubChildEnv: true,
    overlayIsolateChildProcesses: false,
    overlayInProcessGpu: false,
    overlayDisableDirectComposition: false,
    configuredNativeHostBackend: "",
    configuredNativeHostStyle: "",
    actualNativeHostStyle: EXPECTED_HOST_STYLE,
    nativePathOverride: false,
    presenterMode: "persistent",
    configuredPresenterMode: "",
    disableElectronOverlayPresenter: false,
    webUrlUsesPublicDefault: true,
    hasCheckoutUrl: false,
    hasCheckoutTransactionId,
    hasCheckoutReturnUrl: false,
    hasCheckoutJsonFile: false,
    hasInitTxnRequestFile: false,
    hasInitTxnApiKeyEnv: false,
    initTxnEndpointConfigured: false,
    managedOverlayWaitTimeoutMs: 45000,
    managedOverlayParkTimeoutMs: 90000,
    achievementNameConfigured: false,
    achievementProgressUsesDefaults: true,
    isPackaged: true,
    electronVersion
  });
}

function validateBackendEvidence(evidence) {
  assert.ok(evidence);
  assert.deepEqual(evidence.result, {
    source: "result",
    present: true,
    attached: true,
    backend: EXPECTED_BACKEND,
    hostBackend: EXPECTED_BACKEND,
    rendererBackend: EXPECTED_BACKEND,
    complete: true,
    agrees: true
  });
  assert.ok(evidence.lifecycleCompleteCount >= 1);
  assert.ok(evidence.lifecycleAttachedCount >= evidence.lifecycleCompleteCount);
}

function readSteamContinuityIdentity(cleanup) {
  const guard = cleanup && cleanup.steamContinuityGuard;
  assert.ok(guard && guard.ok === true && guard.required === true);
  assert.equal(guard.beforeCount, 1);
  assert.equal(guard.afterCount, 1);
  assert.equal(guard.sameIdentitySet, true);
  assert.equal(guard.sameSessionSet, true);
  assert.ok(Array.isArray(guard.beforeIdentities) && guard.beforeIdentities.length === 1);
  assert.ok(Array.isArray(guard.afterIdentities) && guard.afterIdentities.length === 1);
  const before = normalizeSteamIdentity(guard.beforeIdentities[0]);
  const after = normalizeSteamIdentity(guard.afterIdentities[0]);
  assert.equal(before, after);
  return before;
}

function normalizeSteamIdentity(identity) {
  assertExactKeys(identity, ["cimStartTicks", "nativeStartTicks", "processId", "sessionId"], "Steam identity");
  assert.ok(Number.isInteger(identity.processId) && identity.processId > 0);
  assert.ok(Number.isInteger(identity.sessionId) && identity.sessionId >= 0);
  assert.match(identity.cimStartTicks || "", /^[1-9][0-9]+$/);
  assert.match(identity.nativeStartTicks || "", /^[1-9][0-9]+$/);
  return [identity.processId, identity.sessionId, identity.cimStartTicks, identity.nativeStartTicks].join(":");
}

function buildProfileReceipt(contract, manifestSha256, summary, candidateBinding) {
  const evidenceProjection = {
    profile: contract.name,
    manifest: {
      suite: summary.manifest.suite,
      launchMode: summary.manifest.launchMode,
      launchKind: summary.manifest.launchKind,
      appId: summary.manifest.appId,
      candidateBindingSha256: candidateBinding.bindingSha256
    },
    preflight: summary.preflight,
    readiness: summary.liveRunReadiness,
    renderHealth: summary.renderHealth,
    nativeLoadGate: summary.nativeLoadGate,
    cleanup: summary.cleanup,
    totals: summary.totals,
    cases: contract.cases.map((expected) => {
      const row = summary.caseSummaries.find((entry) => entry.caseName === expected.id);
      return {
        caseName: row.caseName,
        action: row.action,
        steamLaunch: row.steamLaunch,
        overlayInjection: row.overlayInjection,
        steamOverlayLaunchMarker: row.steamOverlayLaunchMarker,
        overlayActiveEvents: row.overlayActiveEvents,
        managedOverlayCloseProof: row.managedOverlayCloseProof,
        duplicateOpenGuardProof: row.duplicateOpenGuardProof,
        passiveNotificationProof: row.passiveNotificationProof,
        persistentReuseProof: row.persistentReuseProof,
        runtimeConfig: row.runtimeConfig,
        presenterBackendEvidence: row.presenterBackendEvidence,
        crashDumpCount: row.crashDumpCount,
        fatalLifecycleEventCount: row.fatalLifecycleEventCount,
        steamRenderingHealth: row.steamRenderingHealth
      };
    })
  };
  return {
    name: contract.name,
    suite: contract.suite,
    candidateBindingSha256: candidateBinding.bindingSha256,
    manifestSha256,
    evidenceSha256: hashCanonicalJson(EVIDENCE_HASH_DOMAIN, evidenceProjection),
    caseIds: contract.cases.map((entry) => entry.id),
    caseCount: contract.cases.length,
    activeCaseCount: contract.activeCaseCount,
    steamLaunchCaseCount: contract.cases.length,
    cleanCaseCount: contract.cases.length,
    readinessPassed: true,
    nativeLoadPassed: true,
    renderHealthPassed: true,
    semanticPassed: true,
    cleanupPassed: true,
    steamContinuityPassed: true,
    crashCount: 0
  };
}

function assembleLiveProofReceipt(candidateBinding, profiles, generatedAt, sameSteamIdentityAcrossProfiles) {
  validateCandidateBinding(candidateBinding);
  const base = {
    kind: RECEIPT_KIND,
    schemaVersion: RECEIPT_SCHEMA_VERSION,
    generatedAt,
    candidate: candidateBinding,
    proofContract: {
      publicAppId: PUBLIC_APP_ID,
      target: "x86_64-pc-windows-msvc",
      launchMode: "steam-launch",
      launchKind: "shortcut",
      launchEnvOutsideCandidate: true,
      launchEnvUsesDefaultPath: true,
      overlayProfile: "diagnostic",
      configuredRendererOverrides: false,
      effectivePresenterMode: "persistent",
      expectedNativeHostBackend: EXPECTED_BACKEND,
      expectedNativeHostStyle: EXPECTED_HOST_STYLE,
      privateInputs: false,
      reparsePointPathAncestry: false,
      profileCount: PROFILE_CONTRACTS.length,
      caseCount: TOTAL_CASE_COUNT,
      activeCaseCount: TOTAL_ACTIVE_CASE_COUNT
    },
    profiles,
    totals: {
      profileCount: PROFILE_CONTRACTS.length,
      caseCount: TOTAL_CASE_COUNT,
      activeCaseCount: TOTAL_ACTIVE_CASE_COUNT,
      steamLaunchCaseCount: TOTAL_CASE_COUNT,
      cleanCaseCount: TOTAL_CASE_COUNT,
      crashCount: 0,
      sameCandidateAcrossProfiles: true,
      sameSteamIdentityAcrossProfiles
    }
  };
  return {
    ...base,
    receiptSha256: hashCanonicalJson(RECEIPT_HASH_DOMAIN, base)
  };
}

function readAndValidateLiveProofReceipt(filePath, expectedCandidateBinding) {
  const receipt = readJsonArtifact(path.resolve(filePath), "live-proof receipt").value;
  return validateLiveProofReceipt(receipt, expectedCandidateBinding);
}

function validateLiveProofReceipt(receipt, expectedCandidateBinding) {
  assertExactKeys(
    receipt,
    ["candidate", "generatedAt", "kind", "profiles", "proofContract", "receiptSha256", "schemaVersion", "totals"],
    "live-proof receipt"
  );
  assert.equal(receipt.kind, RECEIPT_KIND);
  assert.equal(receipt.schemaVersion, RECEIPT_SCHEMA_VERSION);
  assertIsoTimestamp(receipt.generatedAt, "live-proof receipt timestamp");
  validateCandidateBinding(receipt.candidate);
  if (expectedCandidateBinding) {
    validateCandidateBinding(expectedCandidateBinding);
    assert.deepEqual(receipt.candidate, expectedCandidateBinding);
  }
  assertExactKeys(
    receipt.proofContract,
    [
      "activeCaseCount",
      "caseCount",
      "configuredRendererOverrides",
      "effectivePresenterMode",
      "expectedNativeHostBackend",
      "expectedNativeHostStyle",
      "launchKind",
      "launchEnvOutsideCandidate",
      "launchEnvUsesDefaultPath",
      "launchMode",
      "overlayProfile",
      "privateInputs",
      "profileCount",
      "publicAppId",
      "reparsePointPathAncestry",
      "target"
    ],
    "live-proof contract"
  );
  assert.deepEqual(receipt.proofContract, {
    publicAppId: PUBLIC_APP_ID,
    target: "x86_64-pc-windows-msvc",
    launchMode: "steam-launch",
    launchKind: "shortcut",
    launchEnvOutsideCandidate: true,
    launchEnvUsesDefaultPath: true,
    overlayProfile: "diagnostic",
    configuredRendererOverrides: false,
    effectivePresenterMode: "persistent",
    expectedNativeHostBackend: EXPECTED_BACKEND,
    expectedNativeHostStyle: EXPECTED_HOST_STYLE,
    privateInputs: false,
    reparsePointPathAncestry: false,
    profileCount: PROFILE_CONTRACTS.length,
    caseCount: TOTAL_CASE_COUNT,
    activeCaseCount: TOTAL_ACTIVE_CASE_COUNT
  });
  assert.ok(Array.isArray(receipt.profiles));
  assert.equal(receipt.profiles.length, PROFILE_CONTRACTS.length);
  for (let index = 0; index < PROFILE_CONTRACTS.length; index += 1) {
    validateProfileReceipt(receipt.profiles[index], PROFILE_CONTRACTS[index], receipt.candidate);
  }
  assertExactKeys(
    receipt.totals,
    [
      "activeCaseCount",
      "caseCount",
      "cleanCaseCount",
      "crashCount",
      "profileCount",
      "sameCandidateAcrossProfiles",
      "sameSteamIdentityAcrossProfiles",
      "steamLaunchCaseCount"
    ],
    "live-proof totals"
  );
  assert.deepEqual(receipt.totals, {
    profileCount: PROFILE_CONTRACTS.length,
    caseCount: TOTAL_CASE_COUNT,
    activeCaseCount: TOTAL_ACTIVE_CASE_COUNT,
    steamLaunchCaseCount: TOTAL_CASE_COUNT,
    cleanCaseCount: TOTAL_CASE_COUNT,
    crashCount: 0,
    sameCandidateAcrossProfiles: true,
    sameSteamIdentityAcrossProfiles: true
  });
  const { receiptSha256, ...base } = receipt;
  assert.match(receiptSha256 || "", /^[a-f0-9]{64}$/);
  assert.equal(receiptSha256, hashCanonicalJson(RECEIPT_HASH_DOMAIN, base));
  return receipt;
}

function validateProfileReceipt(profile, contract, candidateBinding) {
  assertExactKeys(
    profile,
    [
      "activeCaseCount",
      "candidateBindingSha256",
      "caseCount",
      "caseIds",
      "cleanCaseCount",
      "cleanupPassed",
      "crashCount",
      "evidenceSha256",
      "manifestSha256",
      "name",
      "nativeLoadPassed",
      "readinessPassed",
      "renderHealthPassed",
      "semanticPassed",
      "steamContinuityPassed",
      "steamLaunchCaseCount",
      "suite"
    ],
    "live-proof profile"
  );
  assert.deepEqual(profile, {
    name: contract.name,
    suite: contract.suite,
    candidateBindingSha256: candidateBinding.bindingSha256,
    manifestSha256: profile.manifestSha256,
    evidenceSha256: profile.evidenceSha256,
    caseIds: contract.cases.map((entry) => entry.id),
    caseCount: contract.cases.length,
    activeCaseCount: contract.activeCaseCount,
    steamLaunchCaseCount: contract.cases.length,
    cleanCaseCount: contract.cases.length,
    readinessPassed: true,
    nativeLoadPassed: true,
    renderHealthPassed: true,
    semanticPassed: true,
    cleanupPassed: true,
    steamContinuityPassed: true,
    crashCount: 0
  });
  assert.match(profile.manifestSha256 || "", /^[a-f0-9]{64}$/);
  assert.match(profile.evidenceSha256 || "", /^[a-f0-9]{64}$/);
}

function buildProfileContracts() {
  const persistentReuse = [
    makeCase("40-persistent-reuse-three-cycle", "presenter-persistent-reuse-three-cycle", [
      "overlay:presenter-persistent-reuse-start",
      "overlay:presenter-persistent-reuse-cycle",
      "overlay:presenter-persistent-reuse-complete"
    ], {
      active: true,
      gate: true,
      persistentReuse: true,
      persistentReuseCycles: 3,
      webModal: "true",
      resultDelayMs: 360000
    })
  ];
  const checkout = [
    makeCase("01-checkout-prepare", "presenter-checkout", ["overlay:presenter-checkout-ready"], {
      noActivation: true,
      allowNotReady: true,
      resultDelayMs: 1200
    }),
    makeCase("02-checkout-approval", "presenter-checkout", [
      "overlay:presenter-open",
      "overlay:presenter-wait-closed",
      "overlay:presenter-parked",
      "overlay:presenter-checkout-open-and-wait-complete"
    ], { active: true, complete: true, gate: true, checkout: true }),
    makeCase("03-shortcut-checkout", "presenter-shortcut", KEYBOARD_EVENTS, {
      active: true,
      complete: true,
      gate: true,
      closeProbeOnActivation: true,
      shortcutToggleProbe: true,
      shortcutTarget: "checkout",
      checkout: true,
      resultDelayMs: 30000
    }),
    makeCase("04-shortcut-checkout-open-and-wait", "presenter-shortcut-open-and-wait", SHORTCUT_WAIT_EVENTS, {
      active: true,
      complete: true,
      gate: true,
      shortcutTarget: "checkout",
      checkout: true
    })
  ];
  const shortcutTargets = [
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
  ];
  const shortcutRoutes = shortcutTargets.map((target) =>
    makeCase(`30-shortcut-${target}-open-and-wait`, "presenter-shortcut-open-and-wait", SHORTCUT_WAIT_EVENTS, {
      active: true,
      complete: true,
      gate: true,
      shortcutTarget: target,
      webModal: target === "web" ? "true" : "",
      storeRoute: target === "store" ? "web" : ""
    })
  );
  const managedRoutes = [
    makeCase("10-presenter-ready", "presenter-ready", ["overlay:presenter-ready"], {
      noActivation: true,
      allowNotReady: true,
      resultDelayMs: 1200
    }),
    makeCase("11-managed-web-open-and-wait", "presenter-web-open-and-wait", WAIT_EVENTS, {
      active: true,
      complete: true,
      gate: true,
      webModal: "true"
    }),
    makeCase("11b-managed-duplicate-open-guard", "presenter-duplicate-open-guard", [
      "overlay:presenter-open-and-wait-start",
      "overlay:presenter-duplicate-open-guard",
      "overlay:presenter-wait-closed",
      "overlay:presenter-parked",
      "overlay:presenter-open-and-wait-complete"
    ], { active: true, complete: true, gate: true, webModal: "true" }),
    makeCase("12-managed-store-open-and-wait", "presenter-store-open-and-wait", WAIT_EVENTS, {
      active: true,
      complete: true,
      gate: true,
      storeRoute: "web"
    }),
    makeCase("13-managed-friends-open-and-wait", "presenter-friends-open-and-wait", WAIT_EVENTS, {
      active: true,
      complete: true,
      gate: true
    }),
    makeCase("14-managed-dialog-open-and-wait", "presenter-dialog-auto-open-and-wait", WAIT_EVENTS, {
      active: true,
      complete: true,
      gate: true,
      dialog: "Friends"
    }),
    makeCase("15-managed-shortcut", "presenter-shortcut-open-and-wait", SHORTCUT_WAIT_EVENTS, {
      active: true,
      complete: true,
      gate: true,
      shortcutTarget: "friends"
    }),
    makeCase("15-managed-shortcut-keyboard", "presenter-shortcut", KEYBOARD_EVENTS, {
      active: true,
      complete: true,
      gate: true,
      closeProbeOnActivation: true,
      shortcutToggleProbe: true,
      shortcutTarget: "friends",
      resultDelayMs: 30000
    }),
    ...[
      ["17-managed-profile-open-and-wait", "presenter-profile-open-and-wait"],
      ["18-managed-players-open-and-wait", "presenter-players-open-and-wait"],
      ["19-managed-community-open-and-wait", "presenter-community-open-and-wait"],
      ["20-managed-stats-open-and-wait", "presenter-stats-open-and-wait"],
      ["21-managed-achievements-open-and-wait", "presenter-achievements-open-and-wait"],
      ["22-managed-user-open-and-wait", "presenter-user-open-and-wait"]
    ].map(([id, action]) => makeCase(id, action, WAIT_EVENTS, { active: true, complete: true, gate: true })),
    makeCase("25-managed-achievement-progress", "presenter-achievement-progress", [
      "overlay:presenter-attach",
      "achievement:progress",
      "overlay:passive-notification-needs-present",
      "overlay:passive-notification-parked"
    ], { noActivation: true, allowNotReady: true, passive: true, resultDelayMs: 10000 }),
    makeCase("26-managed-achievement-unlock", "presenter-achievement-unlock", [
      "overlay:presenter-attach",
      "achievement:unlock",
      "overlay:passive-notification-needs-present",
      "overlay:passive-notification-parked"
    ], { noActivation: true, allowNotReady: true, passive: true, resultDelayMs: 10000 })
  ];
  return [
    profileContract("persistent-reuse", persistentReuse),
    profileContract("checkout", checkout),
    profileContract("shortcut-routes", shortcutRoutes),
    profileContract("managed-routes", managedRoutes)
  ];
}

function profileContract(suite, cases) {
  return {
    name: suite,
    suite,
    cases,
    activeCaseCount: cases.filter((entry) => entry.requireOverlayActivated).length
  };
}

function makeCase(id, action, requireEvent, options = {}) {
  const gate = options.gate === true;
  const persistentReuse = options.persistentReuse === true;
  const shortcutTarget = options.shortcutTarget || "";
  return {
    id,
    action,
    requireEvent: [...requireEvent],
    requireOverlayActivated: options.active === true,
    requireNoOverlayActivation: options.noActivation === true,
    allowOverlayNotReady: options.allowNotReady === true,
    requirePassiveNotification: options.passive === true,
    requireManagedOverlayComplete: options.complete === true,
    requireMicroTxnCallback: false,
    closeProbeOnActivation: options.closeProbeOnActivation === true,
    shortcutToggleProbe: options.shortcutToggleProbe === true,
    autorunUserGestureGate: gate,
    persistentReuseGate: persistentReuse,
    persistentReuseGatePolicy: persistentReuse ? PERSISTENT_REUSE_POLICY : "",
    persistentReuseEvidenceSchema: persistentReuse ? 1 : 0,
    initialUserGestureCycle: persistentReuse ? 1 : 0,
    verifyOnlyCycles: persistentReuse ? [2, 3] : [],
    closeVerificationOrdinals: persistentReuse ? [1, 2, 3] : [],
    closeProbeEvidenceSchema: gate ? 3 : 2,
    closeProbeForegroundHandoff: gate ? SAME_PROCESS_HANDOFF : OWNER_PROCESS_HANDOFF,
    externalForegroundTransition: gate ? EXTERNAL_FOREGROUND_TRANSITION : "",
    expectedCloseProbeInput: resolveExpectedCloseProbeInput(id, action, shortcutTarget),
    managedOverlayResultMode: options.complete ? "complete" : "",
    webModal: options.webModal || "",
    storeRoute: options.storeRoute || "",
    dialog: options.dialog || "",
    userDialog: options.userDialog || "",
    shortcutTarget,
    hasCheckoutTransactionId: options.checkout === true,
    hasCheckoutJsonFile: false,
    hasInitTxnRequestFile: false,
    persistentReuseCycles: options.persistentReuseCycles || 0,
    resultDelayMs: options.resultDelayMs || 8000
  };
}

function resolveExpectedCloseProbeInput(id, action, shortcutTarget) {
  if (action === "presenter-duplicate-open-guard" || action === "presenter-persistent-reuse-three-cycle") {
    return "web-close-click-sendinput";
  }
  for (const token of [
    "checkout",
    "web",
    "store",
    "friends",
    "dialog",
    "chat",
    "profile",
    "players",
    "community",
    "stats",
    "achievements",
    "user"
  ]) {
    if (action.toLowerCase().includes(token) || id.toLowerCase().includes(token) || shortcutTarget.includes(token)) {
      return "web-close-click-sendinput";
    }
  }
  return "escape-sendinput";
}

function validateArtifactRoot(value) {
  assert.ok(value, "Live-proof artifact root is missing.");
  const resolved = path.resolve(value);
  const stats = fs.lstatSync(resolved);
  assert.ok(stats.isDirectory() && !stats.isSymbolicLink(), "Live-proof artifact root must be a real directory.");
  return resolved;
}

function validateReceiptOutputLocation(output, candidateDirectory, evidenceRoots) {
  assert.ok(output, "Live-proof receipt output is missing.");
  const resolvedOutput = path.resolve(output);
  assert.equal(fs.existsSync(resolvedOutput), false, "Receipt output already exists.");
  const outputParent = path.dirname(resolvedOutput);
  const parentStats = fs.lstatSync(outputParent);
  assert.ok(parentStats.isDirectory() && !parentStats.isSymbolicLink(), "Receipt output parent must be a real directory.");
  const realParent = fs.realpathSync.native(outputParent);
  for (const [label, root] of [
    ["candidate directory", candidateDirectory],
    ...evidenceRoots.map((root, index) => [`live-proof evidence root ${index + 1}`, root])
  ]) {
    const validatedRoot = validateArtifactRoot(root);
    const realRoot = fs.realpathSync.native(validatedRoot);
    assert.equal(
      isPathWithinRoot(realParent, realRoot),
      false,
      `Receipt output must be outside the ${label}.`
    );
  }
  return resolvedOutput;
}

function isPathWithinRoot(candidate, root) {
  const normalizedCandidate = process.platform === "win32" ? candidate.toLowerCase() : candidate;
  const normalizedRoot = process.platform === "win32" ? root.toLowerCase() : root;
  const relative = path.relative(normalizedRoot, normalizedCandidate);
  return relative === "" || (relative !== ".." && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative));
}

function readJsonArtifact(filePath, label) {
  const initial = fs.lstatSync(filePath, { bigint: true });
  assert.ok(initial.isFile() && !initial.isSymbolicLink(), `${label} must be a regular file.`);
  assert.equal(initial.nlink, 1n, `${label} must not be hard linked.`);
  assert.ok(initial.size > 0n && initial.size <= BigInt(MAX_JSON_BYTES), `${label} has an invalid size.`);
  const descriptor = fs.openSync(filePath, "r");
  try {
    const before = fs.fstatSync(descriptor, { bigint: true });
    assertStableArtifactStats(initial, before, label);
    const bytes = Buffer.alloc(Number(before.size));
    let offset = 0;
    while (offset < bytes.length) {
      const count = fs.readSync(descriptor, bytes, offset, bytes.length - offset, null);
      assert.ok(count > 0, `${label} changed while being read.`);
      offset += count;
    }
    const after = fs.fstatSync(descriptor, { bigint: true });
    const finalPathStats = fs.lstatSync(filePath, { bigint: true });
    assertStableArtifactStats(before, after, label);
    assertStableArtifactStats(after, finalPathStats, label);
    return { value: JSON.parse(bytes.toString("utf8")), bytes };
  } finally {
    fs.closeSync(descriptor);
  }
}

function writePrivateJson(filePath, value) {
  const resolved = path.resolve(filePath);
  const parent = path.dirname(resolved);
  const parentStats = fs.lstatSync(parent);
  assert.ok(parentStats.isDirectory() && !parentStats.isSymbolicLink(), "Receipt output parent must be a real directory.");
  assert.equal(fs.existsSync(resolved), false, "Receipt output already exists.");
  const temp = path.join(parent, `.${path.basename(resolved)}.${process.pid}.${crypto.randomBytes(8).toString("hex")}.tmp`);
  let descriptor;
  try {
    descriptor = fs.openSync(temp, "wx", 0o600);
    try {
      fs.writeFileSync(descriptor, `${JSON.stringify(value, null, 2)}\n`);
      fs.fsyncSync(descriptor);
    } finally {
      const descriptorToClose = descriptor;
      descriptor = undefined;
      fs.closeSync(descriptorToClose);
    }
    fs.linkSync(temp, resolved);
  } finally {
    if (descriptor !== undefined) {
      fs.closeSync(descriptor);
    }
    fs.rmSync(temp, { force: true });
  }
}

function assertStableArtifactStats(expected, actual, label) {
  for (const field of ["dev", "ino", "size", "nlink", "mtimeNs", "ctimeNs"]) {
    assert.equal(actual[field], expected[field], `${label} changed while being read.`);
  }
  assert.ok(actual.isFile() && !actual.isSymbolicLink(), `${label} identity is invalid.`);
}

function assertExactKeys(value, expectedKeys, label) {
  assert.ok(value && typeof value === "object" && !Array.isArray(value), `${label} must be an object.`);
  assert.deepEqual(Object.keys(value).sort(compareOrdinal), [...expectedKeys].sort(compareOrdinal));
}

function assertIsoTimestamp(value, label) {
  assert.equal(typeof value, "string", `${label} must be a string.`);
  assert.match(value, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/);
  assert.ok(Number.isFinite(Date.parse(value)), `${label} is invalid.`);
}

function sha256(bytes) {
  return crypto.createHash("sha256").update(bytes).digest("hex");
}

function compareOrdinal(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}

function selfTest() {
  assert.equal(PROFILE_CONTRACTS.length, 4);
  assert.equal(TOTAL_CASE_COUNT, 31);
  assert.equal(TOTAL_ACTIVE_CASE_COUNT, 27);
  const candidateBinding = createCandidateBinding({
    schemaVersion: 2,
    target: "x86_64-pc-windows-msvc",
    package: {
      name: "steam-bridge",
      version: "0.1.0",
      tarball: { sha256: "1".repeat(64) },
      nativeBinding: { methodCount: 1121, methodsSha256: "2".repeat(64) }
    },
    electronBuilder: { electronVersion: "43.1.0" },
    finalBundle: {
      archive: { sha256: "3".repeat(64), rootDirectory: "win-unpacked", fileCount: 128 },
      contentFingerprint: {
        schemaVersion: 1,
        algorithm: "steam-bridge-windows-bundle-content-v1",
        fileCount: 128,
        totalSize: 123456,
        sha256: "4".repeat(64)
      }
    },
    signing: {
      required: true,
      expectedPublisherSubjectConfigured: false,
      expectedPublisherThumbprintConfigured: true,
      publisherMatches: { appExecutable: true, nativeAddon: true }
    },
    release: { gitCommit: "5".repeat(40), gitRefName: "v0.1.0" }
  });
  const profiles = PROFILE_CONTRACTS.map((contract, index) => ({
    name: contract.name,
    suite: contract.suite,
    candidateBindingSha256: candidateBinding.bindingSha256,
    manifestSha256: String(index + 1).repeat(64),
    evidenceSha256: String(index + 5).repeat(64),
    caseIds: contract.cases.map((entry) => entry.id),
    caseCount: contract.cases.length,
    activeCaseCount: contract.activeCaseCount,
    steamLaunchCaseCount: contract.cases.length,
    cleanCaseCount: contract.cases.length,
    readinessPassed: true,
    nativeLoadPassed: true,
    renderHealthPassed: true,
    semanticPassed: true,
    cleanupPassed: true,
    steamContinuityPassed: true,
    crashCount: 0
  }));
  const receipt = assembleLiveProofReceipt(candidateBinding, profiles, "2026-07-11T00:00:00.000Z", true);
  for (const contract of PROFILE_CONTRACTS) {
    validatePublicManifest(createSelfTestManifest(contract, candidateBinding), contract, candidateBinding);
    validateProfileSummary(createSelfTestSummary(contract, candidateBinding), contract, candidateBinding);
  }
  const privateManifest = createSelfTestManifest(PROFILE_CONTRACTS[1], candidateBinding);
  privateManifest.privateEnvImported = true;
  assert.throws(() => validatePublicManifest(privateManifest, PROFILE_CONTRACTS[1], candidateBinding));
  const arbitraryWebManifest = createSelfTestManifest(PROFILE_CONTRACTS[2], candidateBinding);
  arbitraryWebManifest.webUrlUsesPublicDefault = false;
  assert.throws(() => validatePublicManifest(arbitraryWebManifest, PROFILE_CONTRACTS[2], candidateBinding));
  const candidateLaunchEnvManifest = createSelfTestManifest(PROFILE_CONTRACTS[0], candidateBinding);
  candidateLaunchEnvManifest.launchEnvOutsideCandidate = false;
  assert.throws(() => validatePublicManifest(candidateLaunchEnvManifest, PROFILE_CONTRACTS[0], candidateBinding));
  const reparsePathManifest = createSelfTestManifest(PROFILE_CONTRACTS[0], candidateBinding);
  reparsePathManifest.launchEnvPathHasNoReparsePoints = false;
  assert.throws(() => validatePublicManifest(reparsePathManifest, PROFILE_CONTRACTS[0], candidateBinding));
  const customLaunchEnvManifest = createSelfTestManifest(PROFILE_CONTRACTS[0], candidateBinding);
  customLaunchEnvManifest.launchEnvUsesDefaultPath = false;
  assert.throws(() => validatePublicManifest(customLaunchEnvManifest, PROFILE_CONTRACTS[0], candidateBinding));
  const helperCleanupManifest = createSelfTestManifest(PROFILE_CONTRACTS[3], candidateBinding);
  helperCleanupManifest.cleanStaleOverlayHelpers = true;
  assert.throws(() => validatePublicManifest(helperCleanupManifest, PROFILE_CONTRACTS[3], candidateBinding));
  const customRunnerManifest = createSelfTestManifest(PROFILE_CONTRACTS[0], candidateBinding);
  customRunnerManifest.javaScriptRunnerExeConfigured = true;
  assert.throws(() => validatePublicManifest(customRunnerManifest, PROFILE_CONTRACTS[0], candidateBinding));
  const partialManifest = createSelfTestManifest(PROFILE_CONTRACTS[3], candidateBinding);
  partialManifest.onlyCase = partialManifest.cases[0].id;
  assert.throws(() => validatePublicManifest(partialManifest, PROFILE_CONTRACTS[3], candidateBinding));
  const alteredCaseManifest = createSelfTestManifest(PROFILE_CONTRACTS[2], candidateBinding);
  alteredCaseManifest.cases[0].action = "presenter-ready";
  assert.throws(() => validatePublicManifest(alteredCaseManifest, PROFILE_CONTRACTS[2], candidateBinding));
  const badNativeLoad = createSelfTestSummary(PROFILE_CONTRACTS[0], candidateBinding);
  badNativeLoad.nativeLoadGate.ok = false;
  assert.throws(() => validateProfileSummary(badNativeLoad, PROFILE_CONTRACTS[0], candidateBinding));
  const badRuntime = createSelfTestSummary(PROFILE_CONTRACTS[1], candidateBinding);
  badRuntime.caseSummaries[1].runtimeConfig.nativePathOverride = true;
  assert.throws(() => validateProfileSummary(badRuntime, PROFILE_CONTRACTS[1], candidateBinding));
  const inheritedCheckoutUrl = createSelfTestSummary(PROFILE_CONTRACTS[1], candidateBinding);
  inheritedCheckoutUrl.caseSummaries[1].runtimeConfig.hasCheckoutUrl = true;
  assert.throws(() => validateProfileSummary(inheritedCheckoutUrl, PROFILE_CONTRACTS[1], candidateBinding));
  const inheritedCheckoutTransaction = createSelfTestSummary(PROFILE_CONTRACTS[3], candidateBinding);
  inheritedCheckoutTransaction.caseSummaries[0].runtimeConfig.hasCheckoutTransactionId = true;
  assert.throws(() => validateProfileSummary(inheritedCheckoutTransaction, PROFILE_CONTRACTS[3], candidateBinding));
  const inheritedSmokeConfiguration = createSelfTestSummary(PROFILE_CONTRACTS[3], candidateBinding);
  inheritedSmokeConfiguration.caseSummaries[0].runtimeConfig.authIdentityUsesPublicDefault = false;
  assert.throws(() => validateProfileSummary(inheritedSmokeConfiguration, PROFILE_CONTRACTS[3], candidateBinding));
  const elevatedTask = createSelfTestSummary(PROFILE_CONTRACTS[0], candidateBinding);
  elevatedTask.cleanup.taskRunLevel = "Highest";
  assert.throws(() => validateProfileSummary(elevatedTask, PROFILE_CONTRACTS[0], candidateBinding));
  const badContinuity = createSelfTestSummary(PROFILE_CONTRACTS[3], candidateBinding);
  badContinuity.cleanup.sameSteamIdentitySet = false;
  assert.throws(() => validateProfileSummary(badContinuity, PROFILE_CONTRACTS[3], candidateBinding));
  validateLiveProofReceipt(JSON.parse(JSON.stringify(receipt)), candidateBinding);
  assert.throws(
    () => validateLiveProofReceipt({ ...receipt, receiptSha256: "0".repeat(64) }, candidateBinding),
    /Expected values to be strictly equal/
  );
  const wrongCandidate = { ...candidateBinding, bindingSha256: "0".repeat(64) };
  assert.throws(() => validateLiveProofReceipt(receipt, wrongCandidate));
  assert.throws(() =>
    validateProfileReceipt(
      { ...profiles[0], caseIds: [...profiles[0].caseIds, "unexpected"] },
      PROFILE_CONTRACTS[0],
      candidateBinding
    )
  );
  assert.equal(canonicalJson(receipt).includes("artifactRoot"), false);
  assert.equal(canonicalJson(receipt).includes("processId"), false);
  assert.equal(isDeepStrictEqual(PROFILE_CONTRACTS[1].cases[0].requireEvent, ["overlay:presenter-checkout-ready"]), true);
  const outputRoot = fs.mkdtempSync(path.join(os.tmpdir(), "steam-bridge-live-proof-receipt-self-test-"));
  try {
    const protectedCandidate = path.join(outputRoot, "candidate");
    const protectedEvidence = path.join(outputRoot, "evidence");
    fs.mkdirSync(protectedCandidate);
    fs.mkdirSync(protectedEvidence);
    assert.throws(
      () => validateReceiptOutputLocation(
        path.join(protectedCandidate, "receipt.json"),
        protectedCandidate,
        [protectedEvidence, protectedEvidence, protectedEvidence, protectedEvidence]
      ),
      /outside the candidate directory/
    );
    assert.throws(
      () => validateReceiptOutputLocation(
        path.join(protectedEvidence, "receipt.json"),
        protectedCandidate,
        [protectedEvidence, protectedEvidence, protectedEvidence, protectedEvidence]
      ),
      /outside the live-proof evidence root/
    );
    validateReceiptOutputLocation(
      path.join(outputRoot, "outside.json"),
      protectedCandidate,
      [protectedEvidence, protectedEvidence, protectedEvidence, protectedEvidence]
    );
    const existingOutput = path.join(outputRoot, "existing.json");
    fs.writeFileSync(existingOutput, "preserve");
    assert.throws(() => writePrivateJson(existingOutput, receipt), /already exists/);
    assert.equal(fs.readFileSync(existingOutput, "utf8"), "preserve");
    const newOutput = path.join(outputRoot, "receipt.json");
    writePrivateJson(newOutput, receipt);
    assert.deepEqual(JSON.parse(fs.readFileSync(newOutput, "utf8")), receipt);
    assert.deepEqual(fs.readdirSync(outputRoot).sort(compareOrdinal), [
      "candidate",
      "evidence",
      "existing.json",
      "receipt.json"
    ]);
  } finally {
    fs.rmSync(outputRoot, { recursive: true, force: true });
  }
}

function createSelfTestManifest(contract, candidateBinding) {
  return {
    kind: "steam-bridge-windows-overlay-matrix-manifest",
    generatedAt: "2026-07-11T00:00:00.000Z",
    suite: contract.suite,
    launchMode: "steam-launch",
    launchKind: "shortcut",
    appId: PUBLIC_APP_ID,
    onlyCase: "",
    expectedCaseCount: contract.cases.length,
    candidatePathHasNoReparsePoints: true,
    launchEnvOutsideCandidate: true,
    launchEnvPathHasNoReparsePoints: true,
    launchEnvUsesDefaultPath: true,
    webUrlUsesPublicDefault: true,
    shortcutNamePresent: true,
    shortcutExeConfigured: false,
    shortcutStartDirConfigured: false,
    shortcutLaunchPrefixConfigured: false,
    javaScriptRunnerExeConfigured: false,
    overlayProfile: "diagnostic",
    presenterMode: "",
    nativeHostBackend: "",
    nativeHostStyle: "",
    expectedNativeHostBackend: EXPECTED_BACKEND,
    nativePathOverride: false,
    overlayInProcessGpu: "",
    overlayDisableDirectComposition: "",
    overlayScrubChildEnv: "",
    overlayIsolateChildProcesses: "",
    windowMode: "windowed",
    closeProbe: true,
    closeProbeInput: "auto",
    timeoutSeconds: 120,
    closeProbeSettleMs: 750,
    closeProbeTimeoutSeconds: 110,
    autorunUserGestureGatePolicy: USER_GESTURE_POLICY,
    persistentReuseGatePolicy: PERSISTENT_REUSE_POLICY,
    supportedPersistentReuseEvidenceSchemas: [1],
    closeProbeEvidenceSchema: 2,
    supportedCloseProbeEvidenceSchemas: [2, 3],
    closeProbeForegroundHandoff: OWNER_PROCESS_HANDOFF,
    supportedCloseProbeForegroundHandoffs: [OWNER_PROCESS_HANDOFF, SAME_PROCESS_HANDOFF],
    supportedExternalForegroundTransitions: [EXTERNAL_FOREGROUND_TRANSITION],
    skipNativeLoadGate: false,
    skipRenderHealthGate: false,
    allowUnhealthyDefaultRender: false,
    allowUnhealthySteamClientLogs: false,
    cleanStaleOverlayHelpers: false,
    steamClientHealthRecentMinutes: EXPECTED_HEALTH_MINUTES,
    privateEnvImported: false,
    requireMicroTxnCallback: false,
    candidateBinding: JSON.parse(JSON.stringify(candidateBinding)),
    cleanupContract: {
      processCleanupRequired: true,
      launchEnvRollbackRequired: true,
      taskCleanupExpected: true,
      steamContinuityRequired: true
    },
    initTxnCapture: {
      hasRequestFile: false,
      hasResponseFile: false,
      captureInApp: false,
      apiKeyEnvProvided: false,
      endpointOption: "",
      publicSyntheticCheckout: contract.suite === "checkout"
    },
    installShortcut: false,
    assumeShortcutConfigured: true,
    targetHints: {
      hasWebUrl: true,
      storeRoute: "web",
      dialog: "Friends",
      userDialog: "steamid",
      shortcutTarget: "friends",
      hasCheckoutTransactionId: true,
      hasCheckoutJsonFile: false,
      hasInitTxnRequestFile: false
    },
    cases: JSON.parse(JSON.stringify(contract.cases))
  };
}

function createSelfTestSummary(contract, candidateBinding) {
  const runtimeConfig = (hasCheckoutTransactionId = false) => ({
    complete: true,
    authIdentityUsesPublicDefault: true,
    overlayProfile: "diagnostic",
    overlayScrubChildEnv: true,
    overlayIsolateChildProcesses: false,
    overlayInProcessGpu: false,
    overlayDisableDirectComposition: false,
    configuredNativeHostBackend: "",
    configuredNativeHostStyle: "",
    actualNativeHostStyle: EXPECTED_HOST_STYLE,
    nativePathOverride: false,
    presenterMode: "persistent",
    configuredPresenterMode: "",
    disableElectronOverlayPresenter: false,
    webUrlUsesPublicDefault: true,
    hasCheckoutUrl: false,
    hasCheckoutTransactionId,
    hasCheckoutReturnUrl: false,
    hasCheckoutJsonFile: false,
    hasInitTxnRequestFile: false,
    hasInitTxnApiKeyEnv: false,
    initTxnEndpointConfigured: false,
    managedOverlayWaitTimeoutMs: 45000,
    managedOverlayParkTimeoutMs: 90000,
    achievementNameConfigured: false,
    achievementProgressUsesDefaults: true,
    isPackaged: true,
    electronVersion: candidateBinding.electronVersion
  });
  const backendEvidence = () => ({
    result: {
      source: "result",
      present: true,
      attached: true,
      backend: EXPECTED_BACKEND,
      hostBackend: EXPECTED_BACKEND,
      rendererBackend: EXPECTED_BACKEND,
      complete: true,
      agrees: true
    },
    lifecycle: [],
    lifecycleAttachedCount: 1,
    lifecycleCompleteCount: 1
  });
  const caseSummaries = contract.cases.map((expected) => ({
    caseName: expected.id,
    failures: [],
    action: expected.action,
    appId: PUBLIC_APP_ID,
    managedOverlayResultMode: expected.requireManagedOverlayComplete ? "complete" : "shown",
    steamLaunch: true,
    overlayInjection: true,
    steamOverlayLaunchMarker: true,
    overlayEnabled: true,
    overlayActiveEvents: expected.requireOverlayActivated ? 1 : 0,
    crashDumpCount: 0,
    fatalLifecycleEventCount: 0,
    initTxnRequestShapePresent: false,
    webSessionCheckoutCaptured: false,
    clientSessionCheckoutCaptured: false,
    managedCheckoutOperationStarted: expected.id === "02-checkout-approval",
    microTxnCallbackCount: 0,
    runtimeConfig: runtimeConfig(expected.hasCheckoutTransactionId),
    presenterBackendEvidence: backendEvidence(),
    steamRenderingHealth: {
      status: "healthy",
      recentSevereSignalCount: 0,
      staleSevereSignalCount: 0,
      signalCodes: []
    },
    managedOverlayCloseProof: expected.requireManagedOverlayComplete,
    persistentReuseProof: expected.persistentReuseGate ? true : "n/a",
    passiveNotificationProof: expected.requirePassiveNotification ? true : "n/a",
    duplicateOpenGuardProof: expected.id === "11b-managed-duplicate-open-guard" ? true : "n/a"
  }));
  return {
    failures: [],
    warnings: [],
    nativeLoadBlocker: null,
    caseAppControlBlockers: [],
    steamLaunchBlockers: [],
    initTxnRequestShapePreflight: null,
    manifest: {
      suite: contract.suite,
      launchMode: "steam-launch",
      launchKind: "shortcut",
      appId: PUBLIC_APP_ID,
      candidateBinding: JSON.parse(JSON.stringify(candidateBinding))
    },
    preflight: {
      appId: PUBLIC_APP_ID,
      steamRunning: true,
      currentSessionInteractive: true,
      executableExists: true,
      executableNonEmpty: true,
      executableAuthenticodeValid: true,
      executableZoneIdentifier: false,
      nativeAddonExists: true,
      nativeAddonNonEmpty: true,
      nativeAddonAuthenticodeValid: true,
      nativeAddonZoneIdentifier: false,
      publisherMatches: true,
      nativeOverridePresent: false,
      nativePathOverride: false,
      packagedRuntimeResolutionErrorPresent: false
    },
    liveRunReadiness: {
      ready: true,
      errorCount: 0,
      warningCount: 0,
      currentSessionInteractive: true,
      steamProcessCount: 1,
      staleOverlayHelperCount: 0,
      renderingHealthStatus: "healthy",
      renderingHealthRecentSevereSignalCount: 0,
      renderingHealthStaleSevereSignalCount: 0
    },
    assumedShortcut: {
      ok: true,
      changed: false,
      existingMatches: true,
      expectedExeExists: true,
      existingExeExists: true
    },
    renderHealth: {
      gatePresent: true,
      summaryPresent: true,
      required: true,
      skipped: false,
      passed: true,
      errorPresent: false,
      status: "default-render-health-ok",
      readyForSteamOverlayMatrix: true,
      defaultCasePresent: true,
      defaultVisible: true,
      defaultBlankLike: false,
      defaultFatalLifecycleEventCount: 0
    },
    nativeLoadGate: {
      ok: true,
      appId: PUBLIC_APP_ID,
      action: "presenter-ready",
      backend: EXPECTED_BACKEND,
      hostBackend: EXPECTED_BACKEND,
      rendererBackend: EXPECTED_BACKEND,
      backendAgrees: true,
      lifecycleCompleteCount: 1,
      runtimeConfig: runtimeConfig(),
      crashDumpCount: 0,
      fatalLifecycleEventCount: 0
    },
    cleanup: {
      processBeforeOk: true,
      processAfterOk: true,
      processAfterRenderHealthOk: true,
      launchEnvRollbackOk: true,
      launchEnvRollbackAttempted: true,
      taskCleanupOk: true,
      taskDeletionVerified: true,
      taskDeleteExitCodeCaptured: true,
      taskAbsenceQueryExitCodeCaptured: true,
      taskAbsenceQueryExitCode: 1,
      taskCleanupPhaseErrorCount: 0,
      taskTimedOut: false,
      taskRunnerTerminatedWithoutDone: false,
      taskFailureStage: "success",
      taskErrorKind: "none",
      taskRunLevel: "Limited",
      taskRunnerGuardOk: true,
      taskLaunchEnvGuardOk: true,
      taskPackageProcessGuardOk: true,
      taskSteamContinuityGuardOk: true,
      steamContinuityRequired: true,
      steamContinuityBeforeCount: 1,
      steamContinuityAfterCount: 1,
      sameSteamIdentitySet: true,
      sameSteamSessionSet: true,
      taskFileGuardOk: true
    },
    caseSummaries,
    totals: {
      totalCases: contract.cases.length,
      steamLaunchCases: contract.cases.length,
      overlayActiveCases: contract.activeCaseCount,
      cleanCases: contract.cases.length,
      renderingUnhealthyCases: 0
    }
  };
}

module.exports = {
  PROFILE_CONTRACTS,
  RECEIPT_KIND,
  RECEIPT_SCHEMA_VERSION,
  assembleLiveProofReceipt,
  generateLiveProofReceipt,
  readAndValidateLiveProofReceipt,
  validateLiveProofReceipt
};
