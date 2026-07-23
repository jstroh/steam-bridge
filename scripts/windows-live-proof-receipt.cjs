#!/usr/bin/env node

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const {
  createCandidateBinding,
  fingerprintCandidateDirectory,
  hashCanonicalJson,
  validateCandidateBinding,
  verifyCandidateDirectory
} = require("./windows-release-candidate-fingerprint.cjs");

const RECEIPT_KIND = "steam-bridge-windows-live-proof-receipt";
const RECEIPT_SCHEMA_VERSION = 3;
const RECEIPT_HASH_DOMAIN = "steam-bridge-windows-standalone-live-proof-receipt-v3";
const EVIDENCE_HASH_DOMAIN = "steam-bridge-windows-standalone-live-proof-evidence-v1";
const EVIDENCE_KIND = "steam-bridge-windows-standalone-consumer-evidence";
const EVIDENCE_SCHEMA_VERSION = 1;
const RECEIPT_PREFIX = "STEAM_BRIDGE_WINDOWS_LIVE_PROOF_RECEIPT ";
const EXPECTED_BACKEND = "windows-d3d11";
const EXPECTED_HOST_STYLE = "standalone";
const MAX_JSON_BYTES = 1024 * 1024;
const MAX_FRAME_LATENCY_WAIT_TIMEOUT_COUNT = 3;
const MAX_PACING_SAMPLE_INTERVAL_MS = 2000;
const WINDOWS_RUNTIME_FILES = Object.freeze([
  "steam_bridge_native.win32-x64-msvc.node",
  "steam_api64.dll",
  "sdkencryptedappticket64.dll"
]);
const MANUAL_CHECK_KEYS = Object.freeze([
  "cleanShutdown",
  "cursorBehavior",
  "focusReturn",
  "fullscreenRestore",
  "maximizeRestore",
  "menuInteraction",
  "minimizeRestore",
  "minimumSize",
  "noFlicker",
  "noPurpleSurface",
  "noTinySurface",
  "overlayClientAlignment",
  "overlayClose",
  "resize",
  "roundedCorners",
  "startupChrome",
  "titleDrag"
]);
const PROFILE_CONTRACTS = Object.freeze([
  Object.freeze({
    name: "standalone-consumer",
    suite: "standalone-consumer",
    activeCaseCount: 1,
    cases: Object.freeze([
      Object.freeze({ id: "standalone-startup" }),
      Object.freeze({ id: "standalone-window-transitions" }),
      Object.freeze({ id: "standalone-steam-overlay" }),
      Object.freeze({ id: "standalone-frame-pacing" })
    ])
  })
]);
const TOTAL_CASE_COUNT = PROFILE_CONTRACTS[0].cases.length;
const TOTAL_ACTIVE_CASE_COUNT = PROFILE_CONTRACTS[0].activeCaseCount;

if (require.main === module) {
  if (process.argv.includes("--self-test")) {
    selfTest();
    console.log("Windows standalone live-proof receipt self-test passed.");
  } else if (process.argv.includes("--write-evidence-template")) {
    try {
      writeEvidenceTemplate(parseEvidenceTemplateArgs(process.argv.slice(2)));
    } catch (error) {
      console.error(error);
      process.exitCode = 1;
    }
  } else {
    try {
      main();
    } catch (error) {
      console.error(error);
      console.error("Windows standalone live-proof receipt generation failed closed.");
      process.exitCode = 1;
    }
  }
}

function parseEvidenceTemplateArgs(args) {
  const filtered = args.filter((arg) => arg !== "--write-evidence-template");
  const names = new Map([
    ["--audit-manifest", "auditManifest"],
    ["--stdout", "stdout"],
    ["--stderr", "stderr"],
    ["--output", "output"]
  ]);
  const options = {};
  for (let index = 0; index < filtered.length; index += 2) {
    const name = filtered[index];
    const key = names.get(name);
    assert.ok(key, "Unknown evidence-template argument.");
    assert.equal(options[key], undefined, "Duplicate evidence-template argument.");
    const value = filtered[index + 1];
    assert.ok(value && !value.startsWith("--"), "Evidence-template argument is missing a value.");
    options[key] = value;
  }
  assert.equal(Object.keys(options).length, names.size, "Evidence-template arguments are incomplete.");
  return options;
}

function writeEvidenceTemplate(options) {
  const audit = readStableJson(path.resolve(options.auditManifest), "package audit manifest").value;
  const candidateBinding = createCandidateBinding(audit);
  const output = path.resolve(options.output);
  const outputRoot = path.dirname(output);
  const stdout = path.resolve(options.stdout);
  const stderr = path.resolve(options.stderr);
  assertPathInside(outputRoot, stdout, "stdout");
  assertPathInside(outputRoot, stderr, "stderr");
  readStableRealFile(outputRoot, stdout, "standalone stdout");
  readStableRealFile(outputRoot, stderr, "standalone stderr");
  writePrivateJson(output, {
    kind: EVIDENCE_KIND,
    schemaVersion: EVIDENCE_SCHEMA_VERSION,
    generatedAt: new Date().toISOString(),
    candidateBindingSha256: candidateBinding.bindingSha256,
    logs: {
      stdout: path.relative(outputRoot, stdout),
      stderr: path.relative(outputRoot, stderr)
    },
    manualChecks: Object.fromEntries(MANUAL_CHECK_KEYS.map((key) => [key, false])),
    qa: {
      actualGame: false,
      actualSteamClient: false,
      developmentToolsOpen: false,
      ordinaryOverlayOnly: false,
      purchaseOrSubscriptionAuthorized: false,
      steamClientStable: false
    }
  });
  console.log("Wrote fail-closed standalone evidence template: " + output);
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  const receipt = generateLiveProofReceipt(options);
  writePrivateJson(path.resolve(options.output), receipt);
  console.log(RECEIPT_PREFIX + receipt.receiptSha256);
}

function parseArgs(args) {
  const names = new Map([
    ["--audit-manifest", "auditManifest"],
    ["--candidate-directory", "candidateDirectory"],
    ["--consumer-package-directory", "consumerPackageDirectory"],
    ["--evidence", "evidence"],
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
  const auditArtifact = readStableJson(path.resolve(options.auditManifest), "package audit manifest");
  const audit = auditArtifact.value;
  const candidateBinding = createCandidateBinding(audit);
  const candidateDirectory = path.resolve(options.candidateDirectory);
  const consumerPackageDirectory = path.resolve(options.consumerPackageDirectory);
  const evidencePath = path.resolve(options.evidence);
  const outputPath = path.resolve(options.output);
  assertOutputOutsideInputs(outputPath, [
    candidateDirectory,
    consumerPackageDirectory,
    path.dirname(evidencePath)
  ]);
  const installedRuntime = verifyConsumerPackage(consumerPackageDirectory, audit);
  const evidenceArtifact = readStableRealJson(
    path.dirname(evidencePath),
    evidencePath,
    "standalone consumer evidence"
  );
  const evidence = validateStandaloneEvidence(
    evidenceArtifact.value,
    candidateBinding,
    path.dirname(evidencePath)
  );
  const finalCandidateBinding = verifyCandidateDirectory(candidateDirectory, audit);
  assert.deepEqual(finalCandidateBinding, candidateBinding, "Candidate directory changed after live proof.");
  const finalAuditArtifact = readStableJson(path.resolve(options.auditManifest), "package audit manifest");
  const finalEvidenceArtifact = readStableRealJson(
    path.dirname(evidencePath),
    evidencePath,
    "standalone consumer evidence"
  );
  const finalInstalledRuntime = verifyConsumerPackage(consumerPackageDirectory, audit);
  assert.ok(auditArtifact.bytes.equals(finalAuditArtifact.bytes), "Package audit changed during receipt generation.");
  assert.ok(evidenceArtifact.bytes.equals(finalEvidenceArtifact.bytes), "Evidence changed during receipt generation.");
  assert.deepEqual(finalInstalledRuntime, installedRuntime, "Consumer package changed during receipt generation.");
  const profile = buildProfileReceipt(
    candidateBinding,
    installedRuntime,
    evidence,
    sha256(evidenceArtifact.bytes)
  );
  return assembleLiveProofReceipt(candidateBinding, [profile], new Date().toISOString(), true);
}

function verifyConsumerPackage(packageDirectory, audit) {
  const stat = fs.lstatSync(packageDirectory);
  assert.equal(stat.isSymbolicLink(), false, "Consumer package must be a real registry/tarball install, not a link.");
  assert.ok(stat.isDirectory(), "Consumer package path must be a directory.");
  assert.equal(
    normalizePath(fs.realpathSync.native(packageDirectory)),
    normalizePath(packageDirectory),
    "Consumer package path must not traverse a junction or reparse point."
  );
  const manifest = readStableRealJson(
    packageDirectory,
    path.join(packageDirectory, "package.json"),
    "consumer package manifest"
  ).value;
  assert.equal(manifest.name, audit.package.name, "Consumer package name differs from the candidate.");
  assert.equal(manifest.version, audit.package.version, "Consumer package version differs from the candidate.");
  const expectedFiles = audit.finalBundle && audit.finalBundle.files;
  assert.ok(expectedFiles && typeof expectedFiles === "object", "Audit is missing final Windows runtime files.");
  const files = {};
  for (const name of WINDOWS_RUNTIME_FILES) {
    const filePath = path.join(packageDirectory, name);
    const bytes = readStableRealFile(packageDirectory, filePath, "consumer runtime " + name);
    const digest = sha256(bytes);
    assert.equal(
      digest,
      expectedFiles[name] && expectedFiles[name].sha256,
      "Consumer runtime " + name + " differs from the audited candidate."
    );
    files[name] = { bytes: bytes.length, sha256: digest };
  }
  return { packageName: manifest.name, packageVersion: manifest.version, files };
}

function validateStandaloneEvidence(evidence, candidateBinding, evidenceRoot) {
  assertExactKeys(
    evidence,
    ["candidateBindingSha256", "generatedAt", "kind", "logs", "manualChecks", "qa", "schemaVersion"],
    "standalone consumer evidence"
  );
  assert.equal(evidence.kind, EVIDENCE_KIND);
  assert.equal(evidence.schemaVersion, EVIDENCE_SCHEMA_VERSION);
  assertIsoTimestamp(evidence.generatedAt, "standalone evidence timestamp");
  assert.equal(evidence.candidateBindingSha256, candidateBinding.bindingSha256);
  assertExactKeys(evidence.logs, ["stderr", "stdout"], "standalone evidence logs");
  assertExactKeys(evidence.manualChecks, MANUAL_CHECK_KEYS, "standalone manual checks");
  for (const key of MANUAL_CHECK_KEYS) {
    assert.equal(evidence.manualChecks[key], true, "Manual standalone check did not pass: " + key);
  }
  assertExactKeys(
    evidence.qa,
    [
      "actualGame",
      "actualSteamClient",
      "developmentToolsOpen",
      "ordinaryOverlayOnly",
      "purchaseOrSubscriptionAuthorized",
      "steamClientStable"
    ],
    "standalone QA declaration"
  );
  assert.equal(evidence.qa.actualGame, true);
  assert.equal(evidence.qa.actualSteamClient, true);
  assert.equal(evidence.qa.developmentToolsOpen, false);
  assert.equal(evidence.qa.ordinaryOverlayOnly, true);
  assert.equal(evidence.qa.purchaseOrSubscriptionAuthorized, false);
  assert.equal(evidence.qa.steamClientStable, true);
  const stdoutArtifact = readEvidenceFile(evidenceRoot, evidence.logs.stdout, "standalone stdout");
  const stderrArtifact = readEvidenceFile(evidenceRoot, evidence.logs.stderr, "standalone stderr");
  assert.equal(stderrArtifact.bytes.toString("utf8").trim(), "", "Standalone run wrote to stderr.");
  const runtime = inspectRuntimeLog(stdoutArtifact.bytes.toString("utf8"));
  return {
    generatedAt: evidence.generatedAt,
    manualChecks: { ...evidence.manualChecks },
    qa: { ...evidence.qa },
    runtime,
    artifacts: {
      stdout: { bytes: stdoutArtifact.bytes.length, sha256: sha256(stdoutArtifact.bytes) },
      stderr: { bytes: stderrArtifact.bytes.length, sha256: sha256(stderrArtifact.bytes) }
    }
  };
}

function inspectRuntimeLog(stdout) {
  const samples = [];
  for (const line of stdout.split(/\r?\n/)) {
    const match = line.match(/\[steam-native-host-fps\]\s+(\{.*\})\s*$/);
    if (match) samples.push(JSON.parse(match[1]));
  }
  assert.ok(samples.length >= 3, "Standalone proof requires at least three FPS samples.");
  for (const sample of samples) {
    assert.equal(sample.nativePresenter && sample.nativePresenter.deviceLost, false);
    assert.equal(sample.nativePresenter && sample.nativePresenter.deviceLostCount, 0);
    assert.equal(sample.nativePresenter && sample.nativePresenter.deviceRecoveryCount, 0);
    const waitTimeoutCount = sample.nativePresenter && sample.nativePresenter.frameLatencyWaitTimeoutCount;
    assert.ok(
      Number.isSafeInteger(waitTimeoutCount) &&
        waitTimeoutCount >= 0 &&
        waitTimeoutCount <= MAX_FRAME_LATENCY_WAIT_TIMEOUT_COUNT,
      "Standalone frame-latency wait timeout count exceeded the bounded menu-transition allowance."
    );
    assert.equal(sample.nativePresenter && sample.nativePresenter.sharedTextureCopySlowCount, 0);
    assert.equal(sample.nativeHost && sample.nativeHost.backend, EXPECTED_BACKEND);
    assert.equal(sample.nativeHost && sample.nativeHost.rendererBackend, EXPECTED_BACKEND);
    assert.equal(sample.nativeHost && sample.nativeHost.hostStyle, EXPECTED_HOST_STYLE);
    assert.equal(sample.nativeHost && sample.nativeHost.parentHwnd, null);
  }
  const pacingSamples = samples.filter(
    (sample) =>
      (sample.phase === "game" || sample.phase === "overlay") &&
      sample.nativeHost &&
      sample.nativeHost.minimized !== true &&
      Number.isFinite(sample.intervalMs) &&
      sample.intervalMs > 0 &&
      sample.intervalMs <= MAX_PACING_SAMPLE_INTERVAL_MS &&
      Number.isFinite(sample.gameSurface && sample.gameSurface.paintFps) &&
      sample.gameSurface.paintFps >= 0 &&
      Number.isFinite(sample.nativePresenter && sample.nativePresenter.presentFps) &&
      sample.nativePresenter.presentFps > 0
  );
  const gameSamples = pacingSamples.filter(
    (sample) => sample.phase === "game" && sample.gameSurface.paintFps > 0
  );
  const overlaySamples = pacingSamples.filter((sample) => sample.phase === "overlay");
  assert.ok(gameSamples.length >= 3, "Standalone proof requires at least three active game FPS samples.");
  assert.ok(overlaySamples.length >= 3, "Standalone proof requires at least three active Steam-overlay FPS samples.");
  for (const sample of pacingSamples) {
    const targetFps = sample.targetFps;
    const displayHz = sample.display && sample.display.hz;
    assert.ok(Number.isFinite(targetFps) && targetFps > 0, "Standalone target FPS is missing.");
    assert.ok(Number.isFinite(displayHz) && displayHz > 0, "Standalone display refresh is missing.");
    assert.ok(Math.abs(targetFps - displayHz) <= 1, "Standalone target FPS does not match display refresh.");
  }
  const gameMetrics = summarizePacingPhase(gameSamples, "Game", true);
  const overlayMetrics = summarizePacingPhase(overlaySamples, "Steam overlay", false);
  const finalSample = pacingSamples[pacingSamples.length - 1];
  const frameLatencyWaitTimeoutCount = Math.max(
    ...samples.map((sample) => sample.nativePresenter.frameLatencyWaitTimeoutCount)
  );
  const targetFps = finalSample.targetFps;
  const displayHz = finalSample.display.hz;
  const host = finalSample.nativeHost;
  assert.deepEqual(host.logicalClientSize, { height: 720, width: 1280 });
  assert.deepEqual(host.minimumClientSize, { height: 480, width: 640 });
  assert.ok(Number.isFinite(host.windowDpi) && host.windowDpi > 0, "Standalone window DPI is missing.");
  assert.equal(finalSample.nativePresenter.frameLatencyWaitable, true);
  for (const required of [
    "[steam-native-host] first Electron shared texture",
    "[steam-native-host] fullscreen on",
    "[steam-native-host] fullscreen off",
    "[steam-native-host] renderer paused while minimized",
    "[steam-native-host] renderer resumed after minimize",
    "\"active\":true",
    "\"active\":false",
    "[steam-native-host-overlay-open] {\"dialog\":\"Friends\",\"source\":\"qa-menu\"}"
  ]) {
    assert.ok(stdout.includes(required), "Standalone runtime log is missing: " + required);
  }
  assert.match(stdout, /\[steam-native-host-renderer\]\s+viewport\s+\d+x\d+\s+->\s+(?!1280x720)\d+x\d+/);
  assert.doesNotMatch(
    stdout,
    /deviceLost":true|GPU device|ResizeBuffers failed|present failed|fatal|panic|crashed|unhandled|Error presenting Electron frame|MicroTxnAuthorization|purchase[^\r\n]*authoriz|subscription[^\r\n]*authoriz/i
  );
  return {
    backend: EXPECTED_BACKEND,
    hostStyle: EXPECTED_HOST_STYLE,
    parentHwnd: null,
    logicalClientSize: host.logicalClientSize,
    minimumClientSize: host.minimumClientSize,
    windowDpi: host.windowDpi,
    displayHz: Math.round(displayHz),
    targetFps: Math.round(targetFps),
    gameSampleCount: gameSamples.length,
    gameMedianPaintFpsTenths: gameMetrics.medianPaintFpsTenths,
    gameMedianPresentFpsTenths: gameMetrics.medianPresentFpsTenths,
    overlaySampleCount: overlaySamples.length,
    overlayMedianPaintFpsTenths: overlayMetrics.medianPaintFpsTenths,
    overlayMedianPresentFpsTenths: overlayMetrics.medianPresentFpsTenths,
    frameLatencyWaitable: true,
    frameLatencyWaitTimeoutCount,
    deviceLostCount: 0,
    deviceRecoveryCount: 0,
    sharedTextureCopySlowCount: 0
  };
}

function summarizePacingPhase(samples, label, requirePaintAtTarget) {
  const targetFps = median(samples.map((sample) => sample.targetFps));
  const medianPaintFps = median(samples.map((sample) => sample.gameSurface.paintFps));
  const medianPresentFps = median(samples.map((sample) => sample.nativePresenter.presentFps));
  if (requirePaintAtTarget) {
    assert.ok(medianPaintFps >= targetFps * 0.95, label + " median game-surface FPS is below 95% of target.");
  }
  assert.ok(medianPresentFps >= targetFps * 0.95, label + " median native-present FPS is below 95% of target.");
  return {
    medianPaintFpsTenths: Math.round(medianPaintFps * 10),
    medianPresentFpsTenths: Math.round(medianPresentFps * 10)
  };
}

function median(values) {
  assert.ok(values.length > 0, "Cannot compute a median without samples.");
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[middle - 1] + sorted[middle]) / 2
    : sorted[middle];
}

function buildProfileReceipt(candidateBinding, installedRuntime, evidence, evidenceManifestSha256) {
  const contract = PROFILE_CONTRACTS[0];
  return {
    name: contract.name,
    suite: contract.suite,
    candidateBindingSha256: candidateBinding.bindingSha256,
    evidenceManifestSha256,
    evidenceSha256: hashCanonicalJson(EVIDENCE_HASH_DOMAIN, {
      candidateBindingSha256: candidateBinding.bindingSha256,
      installedRuntime,
      evidence
    }),
    caseIds: contract.cases.map((entry) => entry.id),
    caseCount: contract.cases.length,
    activeCaseCount: contract.activeCaseCount,
    cleanCaseCount: contract.cases.length,
    crashCount: 0,
    passed: true,
    installedRuntime,
    runtime: evidence.runtime,
    artifacts: evidence.artifacts,
    manualChecks: evidence.manualChecks,
    qa: evidence.qa
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
      target: "x86_64-pc-windows-msvc",
      architecture: "standalone-native-host-offscreen-electron",
      expectedNativeHostBackend: EXPECTED_BACKEND,
      expectedNativeHostStyle: EXPECTED_HOST_STYLE,
      attachedWindowsSupported: false,
      popupOrChildFallbackAllowed: false,
      candidateBoundConsumerInstall: true,
      actualGameRequired: true,
      actualSteamClientRequired: true,
      humanInputRequired: false,
      manualVisualQaRequired: true,
      ordinaryOverlayQaMenuRequired: true,
      purchaseAuthorizationAllowed: false,
      fpsPhases: ["game", "overlay"],
      minimumFpsSamplesPerPhase: 3,
      maximumPacingSampleIntervalMs: MAX_PACING_SAMPLE_INTERVAL_MS,
      maximumFrameLatencyWaitTimeoutCount: MAX_FRAME_LATENCY_WAIT_TIMEOUT_COUNT,
      minimumGameMedianPaintAndPresentPercentOfDisplayTarget: 95,
      minimumOverlayMedianPresentPercentOfDisplayTarget: 95,
      profileCount: PROFILE_CONTRACTS.length,
      caseCount: TOTAL_CASE_COUNT,
      activeCaseCount: TOTAL_ACTIVE_CASE_COUNT
    },
    profiles,
    totals: {
      profileCount: PROFILE_CONTRACTS.length,
      caseCount: TOTAL_CASE_COUNT,
      activeCaseCount: TOTAL_ACTIVE_CASE_COUNT,
      cleanCaseCount: TOTAL_CASE_COUNT,
      crashCount: 0,
      sameCandidateAcrossProfiles: true,
      sameSteamIdentityAcrossProfiles
    }
  };
  return { ...base, receiptSha256: hashCanonicalJson(RECEIPT_HASH_DOMAIN, base) };
}

function readAndValidateLiveProofReceipt(filePath, expectedCandidateBinding) {
  return validateLiveProofReceipt(
    readStableJson(path.resolve(filePath), "live-proof receipt").value,
    expectedCandidateBinding
  );
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
  assert.deepEqual(receipt.proofContract, {
    target: "x86_64-pc-windows-msvc",
    architecture: "standalone-native-host-offscreen-electron",
    expectedNativeHostBackend: EXPECTED_BACKEND,
    expectedNativeHostStyle: EXPECTED_HOST_STYLE,
    attachedWindowsSupported: false,
    popupOrChildFallbackAllowed: false,
    candidateBoundConsumerInstall: true,
    actualGameRequired: true,
    actualSteamClientRequired: true,
    humanInputRequired: false,
    manualVisualQaRequired: true,
    ordinaryOverlayQaMenuRequired: true,
    purchaseAuthorizationAllowed: false,
    fpsPhases: ["game", "overlay"],
    minimumFpsSamplesPerPhase: 3,
    maximumPacingSampleIntervalMs: MAX_PACING_SAMPLE_INTERVAL_MS,
    maximumFrameLatencyWaitTimeoutCount: MAX_FRAME_LATENCY_WAIT_TIMEOUT_COUNT,
    minimumGameMedianPaintAndPresentPercentOfDisplayTarget: 95,
    minimumOverlayMedianPresentPercentOfDisplayTarget: 95,
    profileCount: PROFILE_CONTRACTS.length,
    caseCount: TOTAL_CASE_COUNT,
    activeCaseCount: TOTAL_ACTIVE_CASE_COUNT
  });
  assert.ok(Array.isArray(receipt.profiles));
  assert.equal(receipt.profiles.length, PROFILE_CONTRACTS.length);
  validateProfileReceipt(receipt.profiles[0], PROFILE_CONTRACTS[0], receipt.candidate);
  assert.deepEqual(receipt.totals, {
    profileCount: PROFILE_CONTRACTS.length,
    caseCount: TOTAL_CASE_COUNT,
    activeCaseCount: TOTAL_ACTIVE_CASE_COUNT,
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
      "artifacts",
      "candidateBindingSha256",
      "caseCount",
      "caseIds",
      "cleanCaseCount",
      "crashCount",
      "evidenceManifestSha256",
      "evidenceSha256",
      "installedRuntime",
      "manualChecks",
      "name",
      "passed",
      "qa",
      "runtime",
      "suite"
    ],
    "live-proof profile"
  );
  assert.equal(profile.name, contract.name);
  assert.equal(profile.suite, contract.suite);
  assert.equal(profile.candidateBindingSha256, candidateBinding.bindingSha256);
  assert.match(profile.evidenceManifestSha256 || "", /^[a-f0-9]{64}$/);
  assert.match(profile.evidenceSha256 || "", /^[a-f0-9]{64}$/);
  assert.deepEqual(profile.caseIds, contract.cases.map((entry) => entry.id));
  assert.equal(profile.caseCount, contract.cases.length);
  assert.equal(profile.activeCaseCount, contract.activeCaseCount);
  assert.equal(profile.cleanCaseCount, contract.cases.length);
  assert.equal(profile.crashCount, 0);
  assert.equal(profile.passed, true);
  assertExactKeys(
    profile.installedRuntime,
    ["files", "packageName", "packageVersion"],
    "live-proof installed runtime"
  );
  assert.equal(profile.installedRuntime.packageName, "steam-bridge");
  assert.equal(profile.installedRuntime.packageVersion, candidateBinding.package.version);
  assertExactKeys(profile.installedRuntime.files, WINDOWS_RUNTIME_FILES, "live-proof runtime files");
  for (const name of WINDOWS_RUNTIME_FILES) {
    assertExactKeys(
      profile.installedRuntime.files[name],
      ["bytes", "sha256"],
      "live-proof runtime file " + name
    );
    assert.match(profile.installedRuntime.files[name].sha256, /^[a-f0-9]{64}$/);
    assert.ok(Number.isSafeInteger(profile.installedRuntime.files[name].bytes));
    assert.ok(profile.installedRuntime.files[name].bytes > 0);
  }
  assert.deepEqual(Object.keys(profile.manualChecks).sort(), [...MANUAL_CHECK_KEYS].sort());
  for (const key of MANUAL_CHECK_KEYS) assert.equal(profile.manualChecks[key], true);
  assertExactKeys(
    profile.qa,
    [
      "actualGame",
      "actualSteamClient",
      "developmentToolsOpen",
      "ordinaryOverlayOnly",
      "purchaseOrSubscriptionAuthorized",
      "steamClientStable"
    ],
    "live-proof QA declaration"
  );
  assert.equal(profile.qa.actualGame, true);
  assert.equal(profile.qa.actualSteamClient, true);
  assert.equal(profile.qa.developmentToolsOpen, false);
  assert.equal(profile.qa.ordinaryOverlayOnly, true);
  assert.equal(profile.qa.purchaseOrSubscriptionAuthorized, false);
  assert.equal(profile.qa.steamClientStable, true);
  assertExactKeys(
    profile.runtime,
    [
      "backend",
      "deviceLostCount",
      "deviceRecoveryCount",
      "displayHz",
      "frameLatencyWaitTimeoutCount",
      "frameLatencyWaitable",
      "gameMedianPaintFpsTenths",
      "gameMedianPresentFpsTenths",
      "gameSampleCount",
      "hostStyle",
      "logicalClientSize",
      "minimumClientSize",
      "overlayMedianPaintFpsTenths",
      "overlayMedianPresentFpsTenths",
      "overlaySampleCount",
      "parentHwnd",
      "sharedTextureCopySlowCount",
      "targetFps",
      "windowDpi"
    ],
    "live-proof runtime summary"
  );
  assert.equal(profile.runtime.backend, EXPECTED_BACKEND);
  assert.equal(profile.runtime.hostStyle, EXPECTED_HOST_STYLE);
  assert.equal(profile.runtime.parentHwnd, null);
  assert.deepEqual(profile.runtime.logicalClientSize, { height: 720, width: 1280 });
  assert.deepEqual(profile.runtime.minimumClientSize, { height: 480, width: 640 });
  assert.equal(profile.runtime.frameLatencyWaitable, true);
  assert.ok(
    Number.isSafeInteger(profile.runtime.frameLatencyWaitTimeoutCount) &&
      profile.runtime.frameLatencyWaitTimeoutCount >= 0 &&
      profile.runtime.frameLatencyWaitTimeoutCount <= MAX_FRAME_LATENCY_WAIT_TIMEOUT_COUNT
  );
  assert.equal(profile.runtime.deviceLostCount, 0);
  assert.equal(profile.runtime.deviceRecoveryCount, 0);
  assert.equal(profile.runtime.sharedTextureCopySlowCount, 0);
  assert.ok(Number.isSafeInteger(profile.runtime.windowDpi) && profile.runtime.windowDpi > 0);
  assert.ok(Number.isSafeInteger(profile.runtime.displayHz) && profile.runtime.displayHz > 0);
  assert.ok(Number.isSafeInteger(profile.runtime.targetFps) && profile.runtime.targetFps > 0);
  assert.ok(Number.isSafeInteger(profile.runtime.gameSampleCount));
  assert.ok(Number.isSafeInteger(profile.runtime.overlaySampleCount));
  assert.ok(profile.runtime.gameSampleCount >= 3);
  assert.ok(profile.runtime.overlaySampleCount >= 3);
  for (const key of [
    "gameMedianPaintFpsTenths",
    "gameMedianPresentFpsTenths",
    "overlayMedianPaintFpsTenths",
    "overlayMedianPresentFpsTenths"
  ]) {
    assert.ok(Number.isSafeInteger(profile.runtime[key]) && profile.runtime[key] >= 0);
  }
  assert.ok(profile.runtime.gameMedianPaintFpsTenths >= profile.runtime.targetFps * 9.5);
  assert.ok(profile.runtime.gameMedianPresentFpsTenths >= profile.runtime.targetFps * 9.5);
  assert.ok(profile.runtime.overlayMedianPresentFpsTenths >= profile.runtime.targetFps * 9.5);
  assert.ok(Math.abs(profile.runtime.targetFps - profile.runtime.displayHz) <= 1);
  assertExactKeys(profile.artifacts, ["stderr", "stdout"], "live-proof artifacts");
  for (const name of ["stdout", "stderr"]) {
    assertExactKeys(profile.artifacts[name], ["bytes", "sha256"], "live-proof " + name);
    assert.match(profile.artifacts[name].sha256, /^[a-f0-9]{64}$/);
    assert.ok(Number.isSafeInteger(profile.artifacts[name].bytes));
  }
  assert.ok(profile.artifacts.stdout.bytes > 0);
  assert.equal(profile.artifacts.stderr.bytes, 0);
  assert.equal(profile.artifacts.stderr.sha256, sha256(Buffer.alloc(0)));
}

function createSelfTestProfile(candidateBinding, index = 0) {
  const contract = PROFILE_CONTRACTS[index];
  const manualChecks = Object.fromEntries(MANUAL_CHECK_KEYS.map((key) => [key, true]));
  const installedFiles = Object.fromEntries(
    WINDOWS_RUNTIME_FILES.map((name, fileIndex) => [
      name,
      { bytes: 100 + fileIndex, sha256: String(fileIndex + 1).repeat(64) }
    ])
  );
  return {
    name: contract.name,
    suite: contract.suite,
    candidateBindingSha256: candidateBinding.bindingSha256,
    evidenceManifestSha256: "4".repeat(64),
    evidenceSha256: "5".repeat(64),
    caseIds: contract.cases.map((entry) => entry.id),
    caseCount: contract.cases.length,
    activeCaseCount: contract.activeCaseCount,
    cleanCaseCount: contract.cases.length,
    crashCount: 0,
    passed: true,
    installedRuntime: {
      packageName: "steam-bridge",
      packageVersion: candidateBinding.package.version,
      files: installedFiles
    },
    runtime: {
      backend: EXPECTED_BACKEND,
      hostStyle: EXPECTED_HOST_STYLE,
      parentHwnd: null,
      logicalClientSize: { height: 720, width: 1280 },
      minimumClientSize: { height: 480, width: 640 },
      windowDpi: 216,
      displayHz: 60,
      targetFps: 60,
      gameSampleCount: 3,
      gameMedianPaintFpsTenths: 599,
      gameMedianPresentFpsTenths: 599,
      overlaySampleCount: 3,
      overlayMedianPaintFpsTenths: 598,
      overlayMedianPresentFpsTenths: 598,
      frameLatencyWaitable: true,
      frameLatencyWaitTimeoutCount: 0,
      deviceLostCount: 0,
      deviceRecoveryCount: 0,
      sharedTextureCopySlowCount: 0
    },
    artifacts: {
      stdout: { bytes: 200, sha256: "6".repeat(64) },
      stderr: { bytes: 0, sha256: sha256(Buffer.alloc(0)) }
    },
    manualChecks,
    qa: {
      actualGame: true,
      actualSteamClient: true,
      developmentToolsOpen: false,
      ordinaryOverlayOnly: true,
      purchaseOrSubscriptionAuthorized: false,
      steamClientStable: true
    }
  };
}

function selfTest() {
  const candidateBinding = createCandidateBinding({
    schemaVersion: 2,
    target: "x86_64-pc-windows-msvc",
    package: {
      name: "steam-bridge",
      version: "1.2.3",
      tarball: { sha256: "1".repeat(64) },
      nativeBinding: { methodCount: 1130, methodsSha256: "2".repeat(64) }
    },
    electronBuilder: { electronVersion: "43.1.0" },
    finalBundle: {
      archive: {
        sha256: "3".repeat(64),
        rootDirectory: "win-unpacked",
        fileCount: 2,
        totalSize: 7
      },
      contentFingerprint: {
        schemaVersion: 1,
        algorithm: "steam-bridge-windows-bundle-content-v1",
        fileCount: 2,
        totalSize: 7,
        sha256: "4".repeat(64)
      }
    },
    signing: {
      required: true,
      expectedPublisherSubjectConfigured: true,
      expectedPublisherThumbprintConfigured: true,
      publisherMatches: { appExecutable: true, nativeAddon: true }
    },
    release: { gitCommit: "5".repeat(40), gitRefName: "v1.2.3" }
  });
  const profile = createSelfTestProfile(candidateBinding);
  const receipt = assembleLiveProofReceipt(
    candidateBinding,
    [profile],
    "2026-07-21T00:00:00.000Z",
    true
  );
  validateLiveProofReceipt(JSON.parse(JSON.stringify(receipt)), candidateBinding);
  assert.throws(
    () => validateLiveProofReceipt({ ...receipt, receiptSha256: "0".repeat(64) }, candidateBinding)
  );
  const popupReceipt = JSON.parse(JSON.stringify(receipt));
  popupReceipt.profiles[0].runtime.hostStyle = "owned-popup";
  assert.throws(() => validateLiveProofReceipt(popupReceipt, candidateBinding));
  const failedProfile = JSON.parse(JSON.stringify(profile));
  failedProfile.passed = false;
  assert.throws(() =>
    validateLiveProofReceipt(
      assembleLiveProofReceipt(candidateBinding, [failedProfile], "2026-07-21T00:00:00.000Z", true),
      candidateBinding
    )
  );
  runGeneratorSelfTest();
}

function runGeneratorSelfTest() {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "steam-bridge-standalone-proof-"));
  try {
    const candidateDirectory = path.join(tempRoot, "candidate");
    const consumerDirectory = path.join(tempRoot, "consumer");
    const evidenceDirectory = path.join(tempRoot, "evidence");
    fs.mkdirSync(candidateDirectory);
    fs.mkdirSync(consumerDirectory);
    fs.mkdirSync(evidenceDirectory);
    fs.writeFileSync(path.join(candidateDirectory, "candidate.bin"), "candidate");
    const runtimeBytes = {
      "steam_bridge_native.win32-x64-msvc.node": Buffer.from("native"),
      "steam_api64.dll": Buffer.from("steam"),
      "sdkencryptedappticket64.dll": Buffer.from("ticket")
    };
    fs.writeFileSync(
      path.join(consumerDirectory, "package.json"),
      JSON.stringify({ name: "steam-bridge", version: "1.2.3" })
    );
    for (const [name, bytes] of Object.entries(runtimeBytes)) {
      fs.writeFileSync(path.join(consumerDirectory, name), bytes);
    }
    const fingerprint = fingerprintCandidateDirectory(candidateDirectory);
    const audit = {
      schemaVersion: 2,
      target: "x86_64-pc-windows-msvc",
      package: {
        name: "steam-bridge",
        version: "1.2.3",
        tarball: { sha256: "1".repeat(64) },
        nativeBinding: { methodCount: 1130, methodsSha256: "2".repeat(64) }
      },
      electronBuilder: { electronVersion: "43.1.0" },
      finalBundle: {
        archive: {
          sha256: "3".repeat(64),
          rootDirectory: "win-unpacked",
          fileCount: fingerprint.fileCount,
          totalSize: fingerprint.totalSize
        },
        contentFingerprint: fingerprint,
        files: Object.fromEntries(
          Object.entries(runtimeBytes).map(([name, bytes]) => [
            name,
            { sha256: sha256(bytes) }
          ])
        )
      },
      signing: {
        required: true,
        expectedPublisherSubjectConfigured: true,
        expectedPublisherThumbprintConfigured: true,
        publisherMatches: { appExecutable: true, nativeAddon: true }
      },
      release: { gitCommit: "5".repeat(40), gitRefName: "v1.2.3" }
    };
    const auditPath = path.join(tempRoot, "audit.json");
    fs.writeFileSync(auditPath, JSON.stringify(audit));
    const candidateBinding = createCandidateBinding(audit);
    const sample = {
      intervalMs: 1000,
      phase: "game",
      display: { hz: 60 },
      targetFps: 60,
      gameSurface: { paintFps: 59.9 },
      nativePresenter: {
        presentFps: 59.9,
        frameLatencyWaitable: true,
        frameLatencyWaitTimeoutCount: 0,
        deviceLost: false,
        deviceLostCount: 0,
        deviceRecoveryCount: 0,
        sharedTextureCopySlowCount: 0
      },
      nativeHost: {
        backend: EXPECTED_BACKEND,
        rendererBackend: EXPECTED_BACKEND,
        hostStyle: EXPECTED_HOST_STYLE,
        parentHwnd: null,
        minimized: false,
        logicalClientSize: { height: 720, width: 1280 },
        minimumClientSize: { height: 480, width: 640 },
        windowDpi: 216
      }
    };
    const stdout = [
      "[steam-native-host] first Electron shared texture",
      "[steam-native-host] fullscreen on",
      "[steam-native-host] fullscreen off",
      "[steam-native-host] renderer paused while minimized",
      "[steam-native-host] renderer resumed after minimize",
      "[steam-overlay-activated] {\"active\":true}",
      "[steam-overlay-activated] {\"active\":false}",
      "[steam-native-host-overlay-open] {\"dialog\":\"Friends\",\"source\":\"qa-menu\"}",
      "[steam-native-host-renderer] viewport 1280x720 -> 1100x620 {}",
      ...Array.from({ length: 3 }, () => "[steam-native-host-fps] " + JSON.stringify(sample)),
      ...Array.from({ length: 3 }, () =>
        "[steam-native-host-fps] " + JSON.stringify({
          ...sample,
          phase: "overlay",
          overlayActive: true,
          gameSurface: { ...sample.gameSurface, paintFps: 0 }
        })
      )
    ].join("\n");
    fs.writeFileSync(path.join(evidenceDirectory, "stdout.log"), stdout);
    fs.writeFileSync(path.join(evidenceDirectory, "stderr.log"), "");
    const evidencePath = path.join(evidenceDirectory, "evidence.json");
    fs.writeFileSync(
      evidencePath,
      JSON.stringify({
        kind: EVIDENCE_KIND,
        schemaVersion: EVIDENCE_SCHEMA_VERSION,
        generatedAt: "2026-07-21T00:00:00.000Z",
        candidateBindingSha256: candidateBinding.bindingSha256,
        logs: { stdout: "stdout.log", stderr: "stderr.log" },
        manualChecks: Object.fromEntries(MANUAL_CHECK_KEYS.map((key) => [key, true])),
        qa: {
          actualGame: true,
          actualSteamClient: true,
          developmentToolsOpen: false,
          ordinaryOverlayOnly: true,
          purchaseOrSubscriptionAuthorized: false,
          steamClientStable: true
        }
      })
    );
    const options = {
      auditManifest: auditPath,
      candidateDirectory,
      consumerPackageDirectory: consumerDirectory,
      evidence: evidencePath,
      output: path.join(tempRoot, "receipt.json")
    };
    validateLiveProofReceipt(generateLiveProofReceipt(options), candidateBinding);
    const slowOverlaySample = {
      ...sample,
      phase: "overlay",
      overlayActive: true,
      gameSurface: { ...sample.gameSurface, paintFps: 20 },
      nativePresenter: { ...sample.nativePresenter, presentFps: 20 }
    };
    const slowOverlayStdout = stdout.replace(
      Array.from({ length: 3 }, () =>
        "[steam-native-host-fps] " + JSON.stringify({
          ...sample,
          phase: "overlay",
          overlayActive: true,
          gameSurface: { ...sample.gameSurface, paintFps: 0 }
        })
      ).join("\n"),
      Array.from({ length: 3 }, () =>
        "[steam-native-host-fps] " + JSON.stringify(slowOverlaySample)
      ).join("\n")
    );
    fs.writeFileSync(path.join(evidenceDirectory, "stdout.log"), slowOverlayStdout);
    assert.throws(() => generateLiveProofReceipt(options), /Steam overlay median/);
    fs.writeFileSync(
      path.join(evidenceDirectory, "stdout.log"),
      stdout.replace(
        "[steam-native-host-overlay-open] {\"dialog\":\"Friends\",\"source\":\"qa-menu\"}",
        "[steam-native-host] user shortcut opened Friends"
      )
    );
    assert.throws(
      () => generateLiveProofReceipt(options),
      /steam-native-host-overlay-open/,
      "A physical shortcut must not be required for repeatable release proof."
    );
    fs.writeFileSync(
      path.join(evidenceDirectory, "stdout.log"),
      stdout.replaceAll(
        '"frameLatencyWaitTimeoutCount":0',
        `"frameLatencyWaitTimeoutCount":${MAX_FRAME_LATENCY_WAIT_TIMEOUT_COUNT + 1}`
      )
    );
    assert.throws(
      () => generateLiveProofReceipt(options),
      /bounded menu-transition allowance/
    );
    fs.writeFileSync(path.join(evidenceDirectory, "stdout.log"), stdout);
    const linkedConsumer = path.join(tempRoot, "linked-consumer");
    fs.symlinkSync(consumerDirectory, linkedConsumer, process.platform === "win32" ? "junction" : "dir");
    assert.throws(
      () => generateLiveProofReceipt({ ...options, consumerPackageDirectory: linkedConsumer }),
      /real registry\/tarball install/
    );
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
}

function readEvidenceFile(root, relativePath, label) {
  assert.equal(typeof relativePath, "string", label + " path must be a string.");
  assert.ok(relativePath && !path.isAbsolute(relativePath), label + " path must be relative.");
  const resolved = path.resolve(root, relativePath);
  assertPathInside(root, resolved, label);
  return { bytes: readStableRealFile(root, resolved, label) };
}

function readStableRealJson(root, filePath, label) {
  const bytes = readStableRealFile(root, filePath, label);
  assert.ok(bytes.length <= MAX_JSON_BYTES, label + " exceeds the size limit.");
  try {
    return { bytes, value: JSON.parse(bytes.toString("utf8")) };
  } catch (error) {
    throw new Error("Invalid " + label + " JSON.", { cause: error });
  }
}

function readStableRealFile(root, filePath, label) {
  const resolvedRoot = fs.realpathSync.native(path.resolve(root));
  const resolvedFile = path.resolve(filePath);
  const stat = fs.lstatSync(resolvedFile);
  assert.equal(stat.isSymbolicLink(), false, label + " must not be a symbolic link or junction.");
  const realFile = fs.realpathSync.native(resolvedFile);
  assert.equal(normalizePath(realFile), normalizePath(resolvedFile), label + " traversed a reparse point.");
  assertPathInside(resolvedRoot, realFile, label);
  return readStableFile(realFile, label);
}

function readStableJson(filePath, label) {
  const bytes = readStableFile(filePath, label);
  assert.ok(bytes.length <= MAX_JSON_BYTES, label + " exceeds the size limit.");
  let value;
  try {
    value = JSON.parse(bytes.toString("utf8"));
  } catch (error) {
    throw new Error("Invalid " + label + " JSON.", { cause: error });
  }
  return { bytes, value };
}

function readStableFile(filePath, label) {
  const before = fs.statSync(filePath, { bigint: true });
  assert.ok(before.isFile(), "Missing " + label + ": " + filePath);
  const bytes = fs.readFileSync(filePath);
  const after = fs.statSync(filePath, { bigint: true });
  assert.equal(before.size, after.size, label + " changed while read.");
  assert.equal(before.mtimeNs, after.mtimeNs, label + " changed while read.");
  assert.equal(BigInt(bytes.length), after.size, label + " size changed while read.");
  return bytes;
}

function writePrivateJson(filePath, value) {
  assert.equal(fs.existsSync(filePath), false, "Receipt output already exists.");
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2) + os.EOL, {
    encoding: "utf8",
    flag: "wx",
    mode: 0o600
  });
}

function assertOutputOutsideInputs(outputPath, roots) {
  for (const root of roots) {
    const resolvedRoot = path.resolve(root);
    assert.ok(
      normalizePath(outputPath) !== normalizePath(resolvedRoot) &&
        !normalizePath(outputPath).startsWith(normalizePath(resolvedRoot) + path.sep),
      "Receipt output must be outside candidate, consumer, and evidence inputs."
    );
  }
}

function assertPathInside(root, target, label) {
  const relative = path.relative(path.resolve(root), path.resolve(target));
  assert.ok(relative && !relative.startsWith("..") && !path.isAbsolute(relative), label + " escaped its root.");
}

function assertExactKeys(value, expected, label) {
  assert.ok(value && typeof value === "object" && !Array.isArray(value), label + " must be an object.");
  assert.deepEqual(Object.keys(value).sort(), [...expected].sort(), label + " keys differ.");
}

function assertIsoTimestamp(value, label) {
  assert.equal(typeof value, "string", label + " must be a string.");
  assert.equal(new Date(value).toISOString(), value, label + " must be canonical ISO-8601.");
}

function normalizePath(value) {
  return path.resolve(value).toLowerCase();
}

function sha256(bytes) {
  return crypto.createHash("sha256").update(bytes).digest("hex");
}

module.exports = {
  PROFILE_CONTRACTS,
  RECEIPT_KIND,
  RECEIPT_SCHEMA_VERSION,
  assembleLiveProofReceipt,
  createSelfTestProfile,
  generateLiveProofReceipt,
  readAndValidateLiveProofReceipt,
  validateLiveProofReceipt
};
