#!/usr/bin/env node

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const zlib = require("node:zlib");
const {
  BUNDLE_CONTENT_ALGORITHM,
  createCandidateBinding
} = require("./windows-release-candidate-fingerprint.cjs");
const {
  PROFILE_CONTRACTS,
  assembleLiveProofReceipt,
  validateLiveProofReceipt
} = require("./windows-live-proof-receipt.cjs");

const SECRET_NAME = "STEAM_BRIDGE_WINDOWS_LIVE_PROOF_GZIP_BASE64";
const DEFAULT_ENVIRONMENT = "npm-production";
const MAX_SECRET_BYTES = 48 * 1024;

if (process.argv.includes("--self-test")) {
  runSelfTest();
  console.log("npm publish-proof configurator self-test passed.");
} else {
  main();
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  const audit = readJson(options.auditManifest, "package audit manifest");
  const receiptBytes = readStableFile(options.receipt, "Windows live-proof receipt");
  const prepared = prepareSecretValue(audit, receiptBytes);
  const { secretValue, validated } = prepared;
  assert.ok(
    Buffer.byteLength(secretValue, "utf8") <= MAX_SECRET_BYTES,
    `Compressed live-proof receipt exceeds the ${MAX_SECRET_BYTES}-byte GitHub secret limit.`
  );

  if (options.dryRun) {
    console.log(
      `Validated live-proof receipt sha256=${validated.receiptSha256} compressedBytes=${Buffer.byteLength(secretValue)}`
    );
    return;
  }

  const result = spawnSync(
    "gh",
    ["secret", "set", SECRET_NAME, "--env", options.environment, "--repo", options.repo],
    {
      input: secretValue,
      stdio: ["pipe", "inherit", "inherit"],
      windowsHide: true
    }
  );
  if (result.error) {
    throw result.error;
  }
  assert.equal(result.status, 0, `gh secret set failed with status ${result.status ?? "unknown"}.`);
  console.log(
    `Configured ${SECRET_NAME} for ${options.repo}/${options.environment} receiptSha256=${validated.receiptSha256}`
  );
}

function parseArgs(args) {
  const options = {
    auditManifest: "",
    receipt: "",
    repo: "",
    environment: DEFAULT_ENVIRONMENT,
    dryRun: false
  };
  for (let index = 0; index < args.length; index += 1) {
    const name = args[index];
    if (name === "--dry-run") {
      options.dryRun = true;
      continue;
    }
    if (!["--audit-manifest", "--receipt", "--repo", "--environment"].includes(name)) {
      throw new Error(`Unknown option: ${name}`);
    }
    const value = args[index + 1];
    if (!value || value.startsWith("--")) {
      throw new Error(`Missing value for ${name}.`);
    }
    index += 1;
    if (name === "--audit-manifest") options.auditManifest = path.resolve(value);
    if (name === "--receipt") options.receipt = path.resolve(value);
    if (name === "--repo") options.repo = value;
    if (name === "--environment") options.environment = value;
  }
  assert.ok(options.auditManifest, "--audit-manifest is required.");
  assert.ok(options.receipt, "--receipt is required.");
  assert.match(options.repo, /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/, "--repo must be owner/name.");
  assert.match(options.environment, /^[A-Za-z0-9_.-]{1,255}$/, "Invalid GitHub environment name.");
  return options;
}

function readStableFile(filePath, label) {
  const before = fs.lstatSync(filePath, { bigint: true });
  assert.ok(before.isFile() && !before.isSymbolicLink(), `${label} must be a regular file.`);
  assert.equal(before.nlink, 1n, `${label} must not be hard linked.`);
  const bytes = fs.readFileSync(filePath);
  const after = fs.lstatSync(filePath, { bigint: true });
  assert.equal(after.dev, before.dev, `${label} changed device while being read.`);
  assert.equal(after.ino, before.ino, `${label} changed identity while being read.`);
  assert.equal(after.size, before.size, `${label} changed size while being read.`);
  assert.equal(after.mtimeNs, before.mtimeNs, `${label} changed timestamp while being read.`);
  return bytes;
}

function readJson(filePath, label) {
  return parseJson(readStableFile(filePath, label), label);
}

function parseJson(bytes, label) {
  try {
    return JSON.parse(bytes.toString("utf8"));
  } catch (error) {
    throw new Error(`${label} is not valid JSON: ${error.message}`);
  }
}

function encodeReceipt(bytes) {
  return zlib.gzipSync(bytes, { level: 9, mtime: 0 }).toString("base64");
}

function prepareSecretValue(audit, receiptBytes) {
  const receipt = parseJson(receiptBytes, "Windows live-proof receipt");
  const candidateBinding = createCandidateBinding(audit);
  const validated = validateLiveProofReceipt(receipt, candidateBinding);
  return { candidateBinding, secretValue: encodeReceipt(receiptBytes), validated };
}

function runSelfTest() {
  const encoded = encodeReceipt(Buffer.from('{"ok":true}\n', "utf8"));
  assert.equal(zlib.gunzipSync(Buffer.from(encoded, "base64")).toString("utf8"), '{"ok":true}\n');
  assert.deepEqual(
    parseArgs([
      "--audit-manifest",
      "audit.json",
      "--receipt",
      "receipt.json",
      "--repo",
      "owner/repo",
      "--environment",
      "production",
      "--dry-run"
    ]),
    {
      auditManifest: path.resolve("audit.json"),
      receipt: path.resolve("receipt.json"),
      repo: "owner/repo",
      environment: "production",
      dryRun: true
    }
  );
  assert.throws(() => parseArgs([]), /--audit-manifest is required/);
  assert.throws(
    () => parseArgs(["--audit-manifest", "audit.json", "--receipt", "receipt.json", "--repo", "invalid"]),
    /owner\/name/
  );
  assert.throws(
    () => parseArgs(["--audit-manifest", "audit.json", "--receipt", "receipt.json", "--repo", "owner/repo", "--bad"]),
    /Unknown option/
  );

  const audit = createSelfTestAudit();
  const candidateBinding = createCandidateBinding(audit);
  const profiles = PROFILE_CONTRACTS.map((contract, index) => ({
    name: contract.name,
    suite: contract.suite,
    candidateBindingSha256: candidateBinding.bindingSha256,
    manifestSha256: (index + 1).toString(16).repeat(64),
    evidenceSha256: (index + 5).toString(16).repeat(64),
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
  const receipt = assembleLiveProofReceipt(candidateBinding, profiles, "2026-07-15T00:00:00.000Z", true);
  const receiptBytes = Buffer.from(`${JSON.stringify(receipt, null, 2)}\n`, "utf8");
  const prepared = prepareSecretValue(audit, receiptBytes);
  assert.deepEqual(prepared.candidateBinding, candidateBinding);
  assert.equal(prepared.validated.receiptSha256, receipt.receiptSha256);
  assert.deepEqual(zlib.gunzipSync(Buffer.from(prepared.secretValue, "base64")), receiptBytes);
}

function createSelfTestAudit() {
  return {
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
      archive: {
        sha256: "3".repeat(64),
        rootDirectory: "win-unpacked",
        fileCount: 2,
        totalSize: 7
      },
      contentFingerprint: {
        schemaVersion: 1,
        algorithm: BUNDLE_CONTENT_ALGORITHM,
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
    release: { gitCommit: "5".repeat(40), gitRefName: "v0.1.0" }
  };
}
